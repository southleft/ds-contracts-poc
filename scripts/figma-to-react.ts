/**
 * Headless Figma → React: `npm run figma:to-react -- --dump <dump.json> --out <dir>`.
 *
 * Runs the playground's own import engine (playground/src/engine/
 * headless-figma-to-react.ts) under Vite's SSR module loader — the engine's
 * data modules use import.meta.glob and ?raw imports, so Vite, not plain
 * Node, is what can load them unchanged — then packages the request with the
 * app server's buildReactLibrary. Same engine functions, same order, same
 * packager as the local app's "Prepare React library", on a fresh session.
 *
 * Writes <out>/request.json (the library request the app would POST),
 * <out>/<name>.tgz and <out>/result.json. With --expect-request <input.json>
 * it refuses unless the request is canonically equal to a recorded one.
 *
 * The command then CHECKS what it generated (checkGenerated →
 * design:consumer:check, receipt and images in <out>/check): each Figma variant
 * is mounted from the installed package, compared with Figma's own image (the
 * unchanged 5% limit, white and black) and content-checked (every text and
 * icon it draws). It prints one line per variant — PASS, FAIL with the named
 * reasons, or UNVERIFIED when something could not be measured (no FIGMA_TOKEN
 * for Figma's images) — and exits 1 when any variant fails, unless
 * --allow-failures (the package is written either way; the report still says
 * FAIL). Without a Chromium it says NOT CHECKED. A green check is printed only
 * when every variant passed. The cold-start test (2026-09-28) found the old
 * command printing ✔ for a Radio with no circle and a Dialog without its
 * heading. The programmatic figmaToReact() (the benchmark replay) does not run
 * the check.
 */
import { createServer } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactLibrary, parseLibraryRequest } from '../playground/server/react-library.js';
import { canonicalJson } from '../core/contract-provenance.js';
import { formatVerdictTable, type Verdict, type Verdicts } from './design-consumer-verdict.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** A fresh tab: the playground's session stores persist to sessionStorage. */
function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

/** A Figma URL through the app's own URL import (closure on), token from the
 *  environment only. The mapped dump is kept beside the output. */
export async function dumpFromFigmaUrl(url: string, outDirArg: string) {
  const outDir = path.resolve(outDirArg);
  const token = process.env.FIGMA_TOKEN;
  if (!token) throw Error('figma-to-react-token-missing: set FIGMA_TOKEN (a Figma personal access token with file read access); it is read from the environment only');
  const { importFigmaUrl } = await import('../playground/src/engine/figma-url-import.js');
  const refusals: string[] = [];
  const { dump } = await importFigmaUrl(url, token, { onVariablesUnavailable: (info: { message: string }) => { refusals.push(info.message); } });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'dump.json'), JSON.stringify(dump, null, 2) + '\n');
  return { dump, refusals };
}

export async function figmaToReact(dumpPath: string, outDirArg: string, expectRequest?: string, source: 'json' | 'figma' = 'json',
  options: { packageName?: string } = {}) {
  // The packager runs npm from inside the package directory, so a relative
  // --out (as the preview page shows: ./out) must be anchored here first.
  const outDir = path.resolve(outDirArg);
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  installSessionStorage();
  const server = await createServer({
    configFile: false,
    root: path.join(repoRoot, 'playground'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null, fs: { allow: [repoRoot] } },
    resolve: {
      alias: {
        '@ds-contracts/core': path.join(repoRoot, 'packages', 'core', 'src', 'index.ts'),
        '@ds-contracts/schema': path.join(repoRoot, 'packages', 'schema', 'src', 'index.ts'),
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  let imported;
  try {
    const engine = await server.ssrLoadModule('/src/engine/headless-figma-to-react.ts');
    imported = engine.figmaDumpToLibraryRequest(dump, source);
  } finally {
    await server.close();
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'request.json'), JSON.stringify(imported.request, null, 2) + '\n');
  if (expectRequest) {
    const recorded = JSON.parse(readFileSync(expectRequest, 'utf8'));
    if (canonicalJson(recorded) !== canonicalJson(imported.request)) {
      const differ = (['rootId', 'contracts', 'tokens', 'icons'] as const)
        .filter(k => canonicalJson(recorded[k]) !== canonicalJson((imported.request as Record<string, unknown>)[k]));
      throw Error(`figma-to-react-request-differs: ${differ.join(', ') || 'shape'} (recorded ${expectRequest})`);
    }
  }
  const input = parseLibraryRequest(imported.request);
  const library = await buildReactLibrary(repoRoot, input, path.join(outDir, 'work'), options);
  const generatedDir = path.join(path.dirname(library.tarball), 'generated');
  if (!existsSync(generatedDir)) throw Error('figma-to-react-generated-missing: ' + generatedDir);
  const tarball = path.join(outDir, path.basename(library.tarball));
  copyFileSync(library.tarball, tarball);
  const request = imported.request as { rootId: string; contracts: Array<{ id?: unknown; name?: unknown }> };
  const rootIndex = request.contracts.findIndex(c => c.id === request.rootId);
  const component = String(request.contracts[rootIndex]?.name ?? '');
  const result = { setName: imported.setName, rootId: imported.request.rootId, component, proposed: imported.proposed,
    skipped: imported.skipped, tarball: path.basename(tarball), tarballSha256: library.tarballSha256,
    requestSha256: createHash('sha256').update(canonicalJson(imported.request)).digest('hex'), notes: imported.notes };
  writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  // buildReactLibrary writes contract i of the request to inputs/<i>.contract.json.
  const contractFile = path.join(path.dirname(library.tarball), 'inputs', `${rootIndex}.contract.json`);
  return { ...result, generatedDir, contractFile, outDir };
}

export type CheckOutcome =
  | { status: 'not-checked'; reason: string }
  | { status: Verdict; receipt: string; verdicts: Verdicts };

/** THE CHECK ON WHAT WAS JUST GENERATED: design:consumer:check (install in a
 *  clean Vite consumer, mount every Figma variant, compare with Figma's own
 *  images, and the content check) on the package figmaToReact wrote. Needs a
 *  Chromium; without one it says it did not check. The verdict is written into
 *  <out>/result.json under `check`, the receipt and images into <out>/check. */
export async function checkGenerated(r: Awaited<ReturnType<typeof figmaToReact>>, dumpPath: string,
  options: { token?: string; chromiumPath?: string } = {}): Promise<CheckOutcome> {
  const { chromium } = await import('playwright-core');
  const browser = options.chromiumPath ?? chromium.executablePath();
  let outcome: CheckOutcome;
  if (!browser || !existsSync(browser)) {
    outcome = { status: 'not-checked', reason: `no Chromium for the consumer check (${browser || 'none found'}); install one with: npx playwright-core install chromium` };
  } else {
    const out = path.join(r.outDir, 'check');
    rmSync(out, { recursive: true, force: true }); // this command's own subdirectory, rewritten each run
    const { runConsumerCheck } = await import('./design-consumer-check.js');
    const receipt = await runConsumerCheck({ dump: dumpPath, contract: r.contractFile, generated: r.generatedDir, component: r.component, out, token: options.token });
    outcome = { status: receipt.verdict.verdict, receipt: path.relative(r.outDir, path.join(out, 'receipt.json')), verdicts: receipt.verdict };
  }
  const resultFile = path.join(r.outDir, 'result.json');
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  result.check = outcome.status === 'not-checked' ? outcome : { status: outcome.status, receipt: outcome.receipt, counts: outcome.verdicts.counts,
    variants: outcome.verdicts.variants.map(v => ({ key: v.key, figmaName: v.figmaName, verdict: v.verdict, reasons: v.reasons })), setProblems: outcome.verdicts.setProblems };
  writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  return outcome;
}

/** What the command prints after it packaged: never a green check unless every
 *  variant passed. Returns the lines and the exit code. */
export function reportCheck(r: { component: string; setName: string; tarball: string; notes: unknown[] }, out: string, outcome: CheckOutcome,
  allowFailures = false): { lines: string[]; exitCode: number } {
  const tgz = path.join(out, r.tarball), name = r.component || r.setName;
  const notes = `${r.notes.length} proposal note(s) in ${path.join(out, 'result.json')}`;
  if (outcome.status === 'not-checked')
    return { exitCode: 0, lines: [`◌ figma:to-react ${name}: NOT CHECKED — ${outcome.reason}`, `  package: ${tgz} (written, not verified against the design)`, `  ${notes}`] };
  const { counts, setProblems } = outcome.verdicts, total = outcome.verdicts.variants.length;
  const lines = [`consumer check (receipt: ${path.join(out, outcome.receipt)}):`, ...formatVerdictTable(outcome.verdicts)];
  if (outcome.status === 'pass') {
    lines.push(`✔ figma:to-react ${name}: all ${total} variant(s) pass the consumer check → ${tgz}`);
    return { exitCode: 0, lines: [...lines, `  ${notes}`] };
  }
  if (outcome.status === 'unverified') {
    lines.push(`◌ figma:to-react ${name}: NOT VERIFIED — ${counts.pass} of ${total} variant(s) pass, ${counts.unverified} could not be measured${setProblems.length ? `, ${setProblems.length} set problem(s)` : ''}; nothing failed → ${tgz}`);
    return { exitCode: 0, lines: [...lines, `  ${notes}`] };
  }
  lines.push(`✖ figma:to-react ${name}: FAIL — ${counts.fail} of ${total} variant(s) fail${setProblems.length ? `, ${setProblems.length} set problem(s)` : ''}; the package was written but does not match the design → ${tgz}`);
  lines.push(`  ${notes}`);
  if (allowFailures) lines.push('  --allow-failures: exiting 0; the result is still FAIL');
  return { exitCode: allowFailures ? 0 : 1, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dump = flag('--dump'), url = flag('--url'), out = flag('--out');
  if ((!dump && !url) || (dump && url) || !out) {
    console.error('usage: npm run figma:to-react -- (--dump <dump.json> | --url <figma component-set URL>) --out <dir> [--name <npm package name>] [--expect-request <input.json>] [--allow-failures]\n'
      + '  --url reads FIGMA_TOKEN from the environment (never from the command line).\n'
      + '  After packaging, the generated package is checked against the design (design:consumer:check) and each\n'
      + '  variant is reported pass / FAIL / unverified; any FAIL exits 1 unless --allow-failures is given.');
    process.exit(2);
  }
  (async () => {
    let dumpPath = dump!, source: 'json' | 'figma' = 'json';
    if (url) {
      const fetched = await dumpFromFigmaUrl(url, out);
      for (const r of fetched.refusals) console.error('variables: ' + r);
      dumpPath = path.join(out, 'dump.json'); source = 'figma';
    }
    const name = flag('--name');
    const r = await figmaToReact(dumpPath, out, flag('--expect-request'), source, name ? { packageName: name } : {});
    console.log(`packaged ${r.component || r.setName} → ${path.join(out, r.tarball)} (sha256 ${r.tarballSha256.slice(0, 12)})`);
    if (r.skipped.length) console.log(`  not proposed: ${r.skipped.map((s: { setName: string; reason: string }) => `${s.setName} (${s.reason})`).join('; ')}`);
    console.log(`checking ${r.component} in a clean consumer (npm install, vite build, Chromium, Figma images; about a minute)…`);
    const outcome = await checkGenerated(r, dumpPath, { token: process.env.FIGMA_TOKEN || undefined });
    const report = reportCheck(r, out, outcome, process.argv.includes('--allow-failures'));
    for (const line of report.lines) console.log(line);
    if (report.exitCode === 0) console.log(`  install: npm install ${path.resolve(out, r.tarball)}`);
    process.exit(report.exitCode);
  })().catch(e => { console.error('✖ ' + (e instanceof Error ? e.message : String(e))); process.exit(1); });
}
