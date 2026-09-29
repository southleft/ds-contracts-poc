/**
 * Figma → React, the shared half: `npm run figma:to-react` (this repository,
 * scripts/figma-to-react.ts) and `ds-contracts figma-to-react` (the installed
 * CLI, packages/cli/src/commands/figma-to-react.ts) both run this module. Only
 * HOW the playground's import engine is loaded differs, so it is injected:
 * the repository loads it under Vite's SSR module loader; the CLI bundle has
 * it built in (packages/cli/vite-glob-plugin.mjs resolves its import.meta.glob
 * and ?raw imports at build time). Nothing here imports Vite.
 *
 * figmaToReact runs the engine on a fresh session and packages the request
 * with the app server's buildReactLibrary: the same engine functions, in the
 * same order, with the same packager as the local app's "Prepare React
 * library". It writes <out>/request.json (the library request the app would
 * POST), <out>/<name>.tgz and <out>/result.json.
 *
 * checkGenerated then CHECKS what it generated (design:consumer:check,
 * receipt and images in <out>/check): each Figma variant is mounted from the
 * installed package, compared with Figma's own image (the unchanged 5% limit,
 * white and black) and content-checked (every text and icon it draws).
 * reportCheck prints one line per variant: PASS, FAIL with the named reasons,
 * or UNVERIFIED when something could not be measured (no FIGMA_TOKEN for
 * Figma's images). Any FAIL exits 1 unless --allow-failures (the package is
 * written either way; the report still says FAIL). Without a Chromium it says
 * NOT CHECKED. A green check is printed only when every variant passed.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildReactLibrary, parseLibraryRequest } from '../playground/server/react-library.js';
import { canonicalJson } from '../core/contract-provenance.js';
import { formatVerdictTable, type Verdict, type Verdicts } from './design-consumer-verdict.js';
import { consumerFontManifest, readConsumerFonts } from './design-consumer-fonts.js';
import type { Toolchain } from './package-react-library.js';

export type HeadlessEngine = Pick<typeof import('../playground/src/engine/headless-figma-to-react.js'), 'figmaDumpToLibraryRequest'>;
/** Loads the playground's headless import engine for one run; `close`
 *  releases whatever loaded it. Called after the fresh session is installed. */
export type EngineLoader = () => Promise<{ engine: HeadlessEngine; close?: () => Promise<void> }>;

/** A fresh tab: the playground's session stores persist to sessionStorage. */
export function installSessionStorage() {
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

export async function figmaToReact(loadEngine: EngineLoader, dumpPath: string, outDirArg: string, expectRequest?: string, source: 'json' | 'figma' = 'json',
  options: { packageName?: string; toolchain?: Toolchain } = {}) {
  // The packager runs npm from inside the package directory, so a relative
  // --out (as the preview page shows: ./out) must be anchored here first.
  const outDir = path.resolve(outDirArg);
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  installSessionStorage();
  const { engine, close } = await loadEngine();
  let imported;
  try {
    imported = engine.figmaDumpToLibraryRequest(dump, source);
  } finally {
    await close?.();
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'request.json'), JSON.stringify(imported.request, null, 2) + '\n');
  if (expectRequest) {
    const recorded = JSON.parse(readFileSync(expectRequest, 'utf8'));
    if (canonicalJson(recorded) !== canonicalJson(imported.request)) {
      const differ = (['rootId', 'contracts', 'tokens', 'icons'] as const)
        .filter(k => canonicalJson(recorded[k]) !== canonicalJson((imported.request as unknown as Record<string, unknown>)[k]));
      throw Error(`figma-to-react-request-differs: ${differ.join(', ') || 'shape'} (recorded ${expectRequest})`);
    }
  }
  const input = parseLibraryRequest(imported.request);
  // The first argument only names buildReactLibrary's default parent; the
  // parent is given here, so no repository path is involved.
  const library = await buildReactLibrary(outDir, input, path.join(outDir, 'work'), options);
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
export type FigmaToReactResult = Awaited<ReturnType<typeof figmaToReact>>;

export type CheckOutcome =
  | { status: 'not-checked'; reason: string }
  | { status: Verdict; receipt: string; verdicts: Verdicts };

/** playwright-core as installed beside this module (the repository's, or the
 *  CLI's optional dependency), or why there is none. */
async function playwright(): Promise<{ chromium: typeof import('playwright-core').chromium; version: string } | { missing: string }> {
  try {
    const version = String(createRequire(import.meta.url)('playwright-core/package.json').version);
    const { chromium } = await import('playwright-core');
    return { chromium, version };
  } catch (error) {
    return { missing: `playwright-core is not installed (${(error instanceof Error ? error.message : String(error)).split('\n')[0]}); it is an optional dependency, so install without --omit=optional` };
  }
}

/** THE CHECK ON WHAT WAS JUST GENERATED: design:consumer:check (install in a
 *  clean Vite consumer, mount every Figma variant, compare with Figma's own
 *  images, and the content check) on the package figmaToReact wrote. Needs a
 *  Chromium; without one it says it did not check. The verdict is written into
 *  <out>/result.json under `check`, the receipt and images into <out>/check. */
export async function checkGenerated(r: FigmaToReactResult, dumpPath: string,
  options: { token?: string; chromiumPath?: string; fonts?: string;
    /** The check itself; injected only by tests. */
    runCheck?: (args: import('./design-consumer-check.js').ConsumerCheckArgs) => Promise<any> } = {}): Promise<CheckOutcome> {
  const fonts = options.fonts ? consumerFontManifest(readConsumerFonts(path.resolve(options.fonts))).fonts.map(({ file: _file, ...face }) => face) : null;
  const pw = await playwright();
  const browser = 'missing' in pw ? null : options.chromiumPath ?? pw.chromium.executablePath();
  let outcome: CheckOutcome;
  if ('missing' in pw) {
    outcome = { status: 'not-checked', reason: `no Chromium for the consumer check: ${pw.missing}` };
  } else if (!browser || !existsSync(browser)) {
    outcome = { status: 'not-checked', reason: `no Chromium for the consumer check (${browser || 'none found'}); install one with: npx playwright-core@${pw.version} install chromium` };
  } else {
    const out = path.join(r.outDir, 'check');
    rmSync(out, { recursive: true, force: true }); // this command's own subdirectory, rewritten each run
    const runCheck = options.runCheck ?? (await import('./design-consumer-check.js')).runConsumerCheck;
    const receipt = await runCheck({ dump: dumpPath, contract: r.contractFile, generated: r.generatedDir, component: r.component, out, token: options.token,
      ...(options.chromiumPath ? { chromiumPath: options.chromiumPath } : {}),
      ...(options.fonts ? { fonts: path.resolve(options.fonts) } : {}) });
    outcome = { status: receipt.verdict.verdict, receipt: path.relative(r.outDir, path.join(out, 'receipt.json')), verdicts: receipt.verdict };
  }
  const resultFile = path.join(r.outDir, 'result.json');
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  result.check = outcome.status === 'not-checked' ? { ...outcome, fonts } : { status: outcome.status, receipt: outcome.receipt, counts: outcome.verdicts.counts, fonts,
    variants: outcome.verdicts.variants.map(v => ({ key: v.key, figmaName: v.figmaName, verdict: v.verdict, reasons: v.reasons })), setProblems: outcome.verdicts.setProblems };
  writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
  return outcome;
}

/** What the command prints after it packaged: never a green check unless every
 *  variant passed. Returns the lines and the exit code. `label` is how the
 *  command names itself (figma:to-react here, figma-to-react in the CLI). */
export function reportCheck(r: { component: string; setName: string; tarball: string; notes: unknown[] }, out: string, outcome: CheckOutcome,
  allowFailures = false, label = 'figma:to-react'): { lines: string[]; exitCode: number } {
  const tgz = path.join(out, r.tarball), name = r.component || r.setName;
  const notes = `${r.notes.length} proposal note(s) in ${path.join(out, 'result.json')}`;
  if (outcome.status === 'not-checked')
    return { exitCode: 0, lines: [`◌ ${label} ${name}: NOT CHECKED — ${outcome.reason}`, `  package: ${tgz} (written, not verified against the design)`, `  ${notes}`] };
  const { counts, setProblems } = outcome.verdicts, total = outcome.verdicts.variants.length;
  const lines = [`consumer check (receipt: ${path.join(out, outcome.receipt)}):`, ...formatVerdictTable(outcome.verdicts)];
  if (outcome.status === 'pass') {
    lines.push(`✔ ${label} ${name}: all ${total} variant(s) pass the consumer check → ${tgz}`);
    return { exitCode: 0, lines: [...lines, `  ${notes}`] };
  }
  if (outcome.status === 'unverified') {
    lines.push(`◌ ${label} ${name}: NOT VERIFIED — ${counts.pass} of ${total} variant(s) pass, ${counts.unverified} could not be measured${setProblems.length ? `, ${setProblems.length} set problem(s)` : ''}; nothing failed → ${tgz}`);
    return { exitCode: 0, lines: [...lines, `  ${notes}`] };
  }
  lines.push(`✖ ${label} ${name}: FAIL — ${counts.fail} of ${total} variant(s) fail${setProblems.length ? `, ${setProblems.length} set problem(s)` : ''}; the package was written but does not match the design → ${tgz}`);
  lines.push(`  ${notes}`);
  if (allowFailures) lines.push('  --allow-failures: exiting 0; the result is still FAIL');
  return { exitCode: allowFailures ? 0 : 1, lines };
}

export interface FigmaToReactRun {
  dump?: string; url?: string; out: string; name?: string; expectRequest?: string; fonts?: string; allowFailures?: boolean;
}

/** The whole command after its flags are read, for both shells: fetch (with
 *  --url), package, check, report. Returns the exit code. */
export async function runFigmaToReact(run: FigmaToReactRun, deps: { loadEngine: EngineLoader; toolchain?: Toolchain; label: string;
  log?: (line: string) => void; error?: (line: string) => void }): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line)), error = deps.error ?? ((line: string) => console.error(line));
  // Both command entrypoints authenticate the manifest before fetching or writing.
  if (run.fonts) {
    const faces = readConsumerFonts(path.resolve(run.fonts));
    log(`fonts: ${faces.length} face(s) from ${run.fonts} (${[...new Set(faces.map(f => f.family))].join(', ')})`);
  }
  let dumpPath = run.dump!, source: 'json' | 'figma' = 'json';
  if (run.url) {
    const fetched = await dumpFromFigmaUrl(run.url, run.out);
    for (const r of fetched.refusals) error('variables: ' + r);
    dumpPath = path.join(run.out, 'dump.json'); source = 'figma';
  }
  const r = await figmaToReact(deps.loadEngine, dumpPath, run.out, run.expectRequest, source,
    { ...(run.name ? { packageName: run.name } : {}), ...(deps.toolchain ? { toolchain: deps.toolchain } : {}) });
  log(`packaged ${r.component || r.setName} → ${path.join(run.out, r.tarball)} (sha256 ${r.tarballSha256.slice(0, 12)})`);
  if (r.skipped.length) log(`  not proposed: ${r.skipped.map((s: { setName: string; reason: string }) => `${s.setName} (${s.reason})`).join('; ')}`);
  log(`checking ${r.component} in a clean consumer (npm install, vite build, Chromium, Figma images; about a minute)…`);
  const outcome = await checkGenerated(r, dumpPath, { token: process.env.FIGMA_TOKEN || undefined, ...(run.fonts ? { fonts: run.fonts } : {}) });
  const report = reportCheck(r, run.out, outcome, run.allowFailures === true, deps.label);
  for (const line of report.lines) log(line);
  if (report.exitCode === 0) log(`  install: npm install ${path.resolve(run.out, r.tarball)}`);
  return report.exitCode;
}
