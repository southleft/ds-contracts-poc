/**
 * Package the Sync Runner dev plugin (figma-sync/plugin) as a downloadable
 * zip the playground serves (/ds-contracts-sync-runner-plugin.zip). Runs at
 * playground build/dev time via a tiny vite hook (playground/vite.config.ts)
 * and stands alone as `node scripts/build-plugin-zip.mjs`.
 *
 * Two jobs:
 *   1. DRIFT GUARD — ui.html embeds extract/figma/dump.plugin.js verbatim
 *      (the "Send to Playground" tab runs it through the same runScript path
 *      as the paste box). This build REFUSES to package when the embedded
 *      copy differs from the repo file, so the two can never drift silently.
 *   2. ZIP — dependency-free STORE-method zip (no compression; the plugin is
 *      ~40 KB of text) with a fixed timestamp, so identical inputs produce
 *      identical bytes.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = join(repoRoot, 'figma-sync', 'plugin');
const DUMP_SOURCE = join(repoRoot, 'extract', 'figma', 'dump.plugin.js');
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

export async function buildPluginZip(outFile = DEFAULT_OUT) {
  await verifyEmbeddedDumpSource();
  const entries = [];
  for (const name of FILES) {
    entries.push({ name: ZIP_PREFIX + name, data: await readFile(join(PLUGIN_DIR, name)) });
  }
  const zip = makeZip(entries);
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, zip);
  return { outFile, bytes: zip.length, files: FILES.length };
}

// CLI: node scripts/build-plugin-zip.mjs [outFile]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { outFile, bytes, files } = await buildPluginZip(process.argv[2] ?? DEFAULT_OUT);
  console.log(`plugin-zip: wrote ${outFile} (${files} files, ${bytes} bytes) — embedded dump script verified against extract/figma/dump.plugin.js`);
}
