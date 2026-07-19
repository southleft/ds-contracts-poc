/**
 * Package the Sync Runner dev plugin (figma-sync/plugin) as a downloadable
 * zip the playground serves (/ds-contracts-sync-runner-plugin.zip). Runs at
 * playground build/dev time via a tiny vite hook (playground/vite.config.ts)
 * and stands alone as `node scripts/build-plugin-zip.mjs`.
 *
 * Three jobs:
 *   1. DRIFT GUARD (dump) — ui.html embeds extract/figma/dump.plugin.js
 *      verbatim (the "Send to Playground" tab runs it through the same
 *      runScript path as the paste box). This build REFUSES to package when
 *      the embedded copy differs from the repo file.
 *   2. ENGINE BUNDLE + DRIFT GUARD (engine) — esbuild bundles the plugin
 *      engine entry (figma-sync/plugin/engine/entry.ts → the core barrel)
 *      with the repo's tokens, contracts and icons baked in, and injects it
 *      into the packaged ui.html's #plugin-engine block (window.DSC). The
 *      committed receipt (figma-sync/plugin/engine.receipt.json) records a
 *      hash over every bundle input; when core (or tokens/contracts/icons)
 *      changed and the receipt was not re-recorded, the build REFUSES by
 *      name — run with --update-engine-receipt to record deliberately.
 *      The receipt also records the bundle size (the zip cost is a number).
 *   3. ZIP — dependency-free STORE-method zip with a fixed timestamp, so
 *      identical inputs produce identical bytes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = join(repoRoot, 'figma-sync', 'plugin');
const DUMP_SOURCE = join(repoRoot, 'extract', 'figma', 'dump.plugin.js');
const ENGINE_ENTRY = join(PLUGIN_DIR, 'engine', 'entry.ts');
const ENGINE_RECEIPT = join(PLUGIN_DIR, 'engine.receipt.json');
export const ZIP_BASENAME = 'ds-contracts-sync-runner-plugin.zip';
const DEFAULT_OUT = join(repoRoot, 'playground', 'public', ZIP_BASENAME);

/** Folder prefix inside the zip — unzipping creates one tidy directory. */
const ZIP_PREFIX = 'ds-contracts-sync-runner/';
const FILES = ['manifest.json', 'code.js', 'ui.html', 'README.md'];

// Fixed DOS date/time (2026-01-01 00:00) for deterministic bytes.
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

// ---------------------------------------------------------------------------
// CRC32 (standard polynomial), table-driven.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Minimal STORE-method zip writer (APPNOTE 4.4.x subset).
// ---------------------------------------------------------------------------
function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: STORE
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed
    local.writeUInt32LE(data.length, 22); // uncompressed
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    chunks.push(local, nameBytes, data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory header
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(0, 10); // method: STORE
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    // extra/comment/disk/attrs all zero
    dir.writeUInt32LE(offset, 42); // local header offset
    central.push(Buffer.concat([dir, nameBytes]));

    offset += local.length + nameBytes.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ---------------------------------------------------------------------------
// Engine bundle — the core barrel + baked repo data, bundled for the plugin
// UI iframe. Pure esbuild output: deterministic for a given lockfile.
// ---------------------------------------------------------------------------

/** Repo data baked into the bundle (PluginEngineData in engine/entry.ts). */
function collectEngineData() {
  const readJson = (p) => JSON.parse(readFileSync(join(repoRoot, p), 'utf8'));
  const brands = Object.fromEntries(
    readdirSync(join(repoRoot, 'tokens', 'modes'))
      .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
      .sort()
      .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), readJson(`tokens/modes/${f}`)]),
  );
  const contracts = readdirSync(join(repoRoot, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .sort()
    .map((f) => readJson(`contracts/${f}`));
  const icons = Object.fromEntries(
    readdirSync(join(repoRoot, 'assets', 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .sort()
      .map((f) => [f.replace(/\.svg$/, ''), readFileSync(join(repoRoot, 'assets', 'icons', f), 'utf8')]),
  );
  return {
    tokens: {
      primitives: readJson('tokens/primitives.tokens.json'),
      semantic: readJson('tokens/semantic.tokens.json'),
      light: readJson('tokens/modes/semantic.light.tokens.json'),
      dark: readJson('tokens/modes/semantic.dark.tokens.json'),
      brands,
    },
    contracts,
    icons,
  };
}

/** esbuild the engine entry + data into one classic script (window.DSC). */
export async function buildEngineBundle() {
  const { build, version: esbuildVersion } = await import('esbuild');
  const data = collectEngineData();
  const dataJson = JSON.stringify(data);
  const result = await build({
    stdin: {
      contents: `import { createPluginEngine } from ${JSON.stringify(ENGINE_ENTRY)};
window.DSC = createPluginEngine(__DSC_DATA__);
`,
      resolveDir: repoRoot,
      loader: 'ts',
      sourcefile: 'plugin-engine-main.ts',
    },
    define: { __DSC_DATA__: dataJson },
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2018',
    minify: true,
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  if (result.errors.length > 0) {
    throw new Error(`plugin-zip: engine bundle failed — ${result.errors.map((e) => e.text).join('; ')}`);
  }
  let code = result.outputFiles[0].text;
  // The bundle lands inside a <script> block in ui.html — a literal
  // "</script" inside any of the engine's strings would end the block early.
  code = code.replace(/<\/script/gi, '<\\/script');
  if (code.includes('</script')) throw new Error('plugin-zip: engine bundle still contains "</script" after escaping');

  // Input hash: every module esbuild consumed (path + content hash, sorted)
  // plus the baked data and the esbuild version — any change to core, the
  // entry, tokens, contracts, or icons changes this hash. Dependency inputs
  // (node_modules) are keyed by their PACKAGE-RELATIVE path so the hash is
  // identical whether node_modules is local, a worktree symlink, or the
  // evals scratch symlink (contents still hashed — a dep upgrade changes it).
  const hasher = createHash('sha256');
  const inputs = Object.keys(result.metafile.inputs)
    // Real files only — the metafile also lists virtual entries (the stdin
    // wrapper "plugin-engine-main.ts", "<define:…>" injections, esbuild's
    // "(disabled):…" browser shims). The data JSON hashed below already
    // covers everything the virtual entries carry.
    .filter((p) => !p.startsWith('<') && !p.startsWith('(') && p !== 'plugin-engine-main.ts')
    .sort();
  const stableKey = (p) => {
    const norm = p.split('\\').join('/');
    const i = norm.lastIndexOf('node_modules/');
    return i >= 0 ? norm.slice(i) : relative(repoRoot, resolve(repoRoot, norm)).split('\\').join('/');
  };
  for (const p of [...inputs].sort((a, b) => (stableKey(a) < stableKey(b) ? -1 : 1))) {
    hasher.update(stableKey(p));
    hasher.update('\0');
    hasher.update(readFileSync(resolve(repoRoot, p)));
    hasher.update('\0');
  }
  hasher.update(dataJson);
  hasher.update(`esbuild@${esbuildVersion}`);
  const inputHash = hasher.digest('hex');
  return { code, inputHash, minifiedBytes: Buffer.byteLength(code), inputFiles: inputs.length, esbuildVersion };
}

/** Engine drift guard: the committed receipt must match a fresh build. */
export async function verifyEngineReceipt(bundle, { update = false } = {}) {
  const next = {
    note:
      'Engine-bundle drift guard — scripts/build-plugin-zip.mjs refuses to package when a fresh bundle of figma-sync/plugin/engine/entry.ts (core barrel + baked tokens/contracts/icons) no longer matches this receipt. Re-record deliberately: node scripts/build-plugin-zip.mjs --update-engine-receipt',
    inputHash: bundle.inputHash,
    minifiedBytes: bundle.minifiedBytes,
    inputFiles: bundle.inputFiles,
    esbuild: bundle.esbuildVersion,
  };
  if (update) {
    await writeFile(ENGINE_RECEIPT, JSON.stringify(next, null, 2) + '\n');
    return;
  }
  let recorded = null;
  try {
    recorded = JSON.parse(await readFile(ENGINE_RECEIPT, 'utf8'));
  } catch {
    throw new Error(
      'plugin-zip: figma-sync/plugin/engine.receipt.json is missing — the engine bundle has no recorded receipt. Run `node scripts/build-plugin-zip.mjs --update-engine-receipt` and commit the receipt.',
    );
  }
  if (recorded.inputHash !== bundle.inputHash || recorded.minifiedBytes !== bundle.minifiedBytes) {
    throw new Error(
      `plugin-zip: the plugin engine bundle is STALE vs core — a fresh bundle hashes ${bundle.inputHash.slice(0, 12)}… (${bundle.minifiedBytes} bytes) but the committed receipt records ${String(recorded.inputHash).slice(0, 12)}… (${recorded.minifiedBytes} bytes). Core (or tokens/contracts/icons) changed without re-recording. Review the change, then run \`node scripts/build-plugin-zip.mjs --update-engine-receipt\` and commit engine.receipt.json.`,
    );
  }
}

/** Inject the bundle into ui.html's #plugin-engine block (packaged copy
 *  only — the repo file keeps the stub so the diff stays reviewable). */
export function injectEngine(uiHtml, engineCode) {
  const openTag = '<script id="plugin-engine">';
  const start = uiHtml.indexOf(openTag);
  if (start < 0) {
    throw new Error(
      'plugin-zip: figma-sync/plugin/ui.html has no #plugin-engine block — nowhere to inject the engine bundle',
    );
  }
  const end = uiHtml.indexOf('</script>', start);
  return uiHtml.slice(0, start + openTag.length) + '\n' + engineCode + '\n' + uiHtml.slice(end);
}

// ---------------------------------------------------------------------------
// Drift guard + build.
// ---------------------------------------------------------------------------
export async function verifyEmbeddedDumpSource() {
  const ui = await readFile(join(PLUGIN_DIR, 'ui.html'), 'utf8');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  if (start < 0) {
    throw new Error(
      'plugin-zip: figma-sync/plugin/ui.html has no #dump-source block — the Send to Playground tab has nothing to run',
    );
  }
  const end = ui.indexOf('</script>', start);
  const embedded = ui.slice(start + openTag.length, end).trim();
  const canonical = (await readFile(DUMP_SOURCE, 'utf8')).trim();
  if (embedded !== canonical) {
    throw new Error(
      'plugin-zip: the dump script embedded in figma-sync/plugin/ui.html differs from extract/figma/dump.plugin.js — ' +
        're-embed the canonical file (the block is verbatim by contract; see the comment above it). Refusing to package a drifted copy.',
    );
  }
}

export async function buildPluginZip(outFile = DEFAULT_OUT, { updateEngineReceipt = false } = {}) {
  await verifyEmbeddedDumpSource();
  const engine = await buildEngineBundle();
  await verifyEngineReceipt(engine, { update: updateEngineReceipt });
  const entries = [];
  for (const name of FILES) {
    let data = await readFile(join(PLUGIN_DIR, name));
    if (name === 'ui.html') {
      data = Buffer.from(injectEngine(data.toString('utf8'), engine.code), 'utf8');
    }
    entries.push({ name: ZIP_PREFIX + name, data });
  }
  const zip = makeZip(entries);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, zip);
  return { outFile, bytes: zip.length, files: FILES.length, engineBytes: engine.minifiedBytes };
}

// CLI: node scripts/build-plugin-zip.mjs [outFile] [--update-engine-receipt]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const updateEngineReceipt = args.includes('--update-engine-receipt');
  const outArg = args.find((a) => !a.startsWith('--'));
  const { outFile, bytes, files, engineBytes } = await buildPluginZip(outArg ?? DEFAULT_OUT, { updateEngineReceipt });
  console.log(
    `plugin-zip: wrote ${outFile} (${files} files, ${bytes} bytes; engine bundle ${(engineBytes / 1024 / 1024).toFixed(2)} MB minified) — dump script verified, engine receipt ${updateEngineReceipt ? 'RE-RECORDED' : 'verified'}`,
  );
}
