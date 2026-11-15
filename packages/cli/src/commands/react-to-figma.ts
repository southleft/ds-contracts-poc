/**
 * `ds-contracts react-to-figma` — from inside a React library: its own Storybook, built and served
 * (scripts/storybook-local.ts), read in the pinned reader (scripts/storybook-reader.ts, Docker), then each component's
 * contract and, with --file-key, its Figma programs (scripts/storybook-contracts.ts), one row per component with every
 * refusal named. The three steps ship as their own bundles beside dist/cli.js (build.mjs) and run as they do in the
 * repository; this verb only orders them and reads their reports. Writing into Figma is the plugin's (next step).
 *
 *   npx @ds-contracts/cli react-to-figma --out ./ds-contracts/r2f [--storybook-dir .] [--profile p.json] [--file-key <key>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CliUsageError, flagString, parseFlags } from '../lib.js';

export const REACT_TO_FIGMA_USAGE =
  'react-to-figma --out <dir> [--storybook-dir <library> | --storybook <url>] [--profile <profile.json>] [--only <titles.json>] [--file-key <figma file key>]';

export interface ReactToFigmaRun { out: string; storybookDir?: string; storybook?: string; profile?: string; only?: string; fileKey?: string }

export function parseReactToFigmaArgs(argv: string[]): ReactToFigmaRun {
  const p = parseFlags(argv, { value: ['out', 'storybook-dir', 'storybook', 'profile', 'only', 'file-key'] });
  if (p.positionals.length) throw new CliUsageError(`react-to-figma takes no positional arguments (got ${p.positionals.join(' ')}); usage: ${REACT_TO_FIGMA_USAGE}`);
  const out = flagString(p, 'out'), dir = flagString(p, 'storybook-dir'), url = flagString(p, 'storybook');
  if (!out) throw new CliUsageError(`react-to-figma needs --out <dir>; usage: ${REACT_TO_FIGMA_USAGE}`);
  if (dir && url) throw new CliUsageError('react-to-figma takes --storybook-dir or --storybook, not both');
  const fileKey = flagString(p, 'file-key');
  if (fileKey && !/^[A-Za-z0-9]+$/.test(fileKey)) throw new CliUsageError(`--file-key is a Figma file key (letters and digits), got ${fileKey}`);
  const pick = (k: string, v: string | undefined) => (v ? { [k]: v } : {});
  return { out, ...(url ? { storybook: url } : { storybookDir: dir ?? '.' }), ...pick('profile', flagString(p, 'profile')), ...pick('only', flagString(p, 'only')), ...pick('fileKey', fileKey) };
}

/** What the verb runs: the Storybook build and server, and one bundled step as its own node process. */
export interface ReactToFigmaSteps {
  storybook(dir: string, out: string): Promise<{ url: string; sha256: string; stop: () => void }>;
  step(script: 'storybook-reader.js' | 'storybook-contracts.js', args: string[]): { status: number | null; output: string };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const bundled = (name: string) => { const f = path.join(here, name); if (!existsSync(f)) throw Error(`react-to-figma-not-built: ${f} (build the CLI: npm --prefix packages/cli run build)`); return f; };
export const bundledSteps: ReactToFigmaSteps = {
  async storybook(dir, out) {
    const local = await import(pathToFileURL(bundled('storybook-local.js')).href) as typeof import('../../../../scripts/storybook-local.js');
    const built = local.buildLocalStorybook(dir, path.join(out, 'storybook-static')), served = await local.serveInChild(built.static);
    return { url: served.url, sha256: built.sha256, stop: served.stop };
  },
  step(script, args) {
    const r = spawnSync(process.execPath, [bundled(script), ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
    return { status: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` };
  },
};

type Row = { subject: string; refusals?: string[]; captured?: string; setName?: string; variants?: number | null; contract?: string };
/** One line per component: written (its set, variants, what it captured, any refusal beside) or refused, by name. */
export function reportLines(report: { refused: Array<{ subject: string; reason: string }>; components: Row[] }, fileKey?: string): string[] {
  const lines: string[] = [], written = report.components.filter((c) => c.setName);
  for (const c of report.components) {
    const more = c.refusals?.length ? `; ${c.refusals.length} refusal(s): ${c.refusals.join('; ')}` : '';
    lines.push(c.setName ? `✔ ${c.setName} (${c.subject}): ${c.variants ?? 1} variant(s), captured ${c.captured ?? '?'}${more}` : `✖ ${c.subject}: ${c.refusals?.join('; ') || 'not written'}`);
  }
  for (const r of report.refused) lines.push(`✖ ${r.subject}: ${r.reason}`);
  const total = report.components.length + report.refused.length;
  lines.push(`${written.length} of ${total} component(s) ${fileKey ? `written as Figma programs for file ${fileKey}` : 'written as contracts (add --file-key to build the Figma programs)'}; ${total - written.length} refused`);
  return lines;
}

export async function reactToFigmaCommand(argv: string[], steps: ReactToFigmaSteps = bundledSteps, log = (l: string) => console.log(l)): Promise<number> {
  const run = parseReactToFigmaArgs(argv), out = path.resolve(run.out);
  if (existsSync(out) && readdirSync(out).length) throw Error(`react-to-figma-out-not-empty: ${out}`);
  for (const [flag, file] of [['--profile', run.profile], ['--only', run.only]] as const) if (file && !existsSync(file)) throw Error(`react-to-figma-file-missing: ${flag} ${file}`);
  mkdirSync(out, { recursive: true });
  // The contract step reads the profile's conventions from the reader's record, which the reader writes under --only:
  // with a profile and no list, the list is every component the profile declares.
  let only = run.only;
  if (run.profile && !only) {
    const names = (JSON.parse(readFileSync(run.profile, 'utf8')).components ?? []).map((c: { name: string }) => c.name);
    if (!names.length) throw Error(`react-to-figma-profile-declares-nothing: ${run.profile}`);
    writeFileSync(only = path.join(out, 'only.json'), JSON.stringify(names) + '\n');
  }
  let url = run.storybook!, stop = () => {};
  if (run.storybookDir) {
    const s = await steps.storybook(run.storybookDir, out);
    url = s.url; stop = s.stop;
    log(`storybook: built ${path.resolve(run.storybookDir)} (sha256 ${s.sha256.slice(0, 12)}), served at ${url}`);
  }
  try {
    const reader = steps.step('storybook-reader.js', ['--storybook', url, '--out', path.join(out, 'reader'), ...(run.profile ? ['--profile', run.profile] : []), ...(only ? ['--only', only] : [])]);
    writeFileSync(path.join(out, 'reader.log'), reader.output);
    if (reader.status !== 0) throw Error(`react-to-figma-reader-failed: exit ${reader.status}: ${reader.output.trim().split('\n').pop() ?? ''} (log ${path.join(out, 'reader.log')})`);
    log(reader.output.trim().split('\n').pop() ?? '');
    const contracts = steps.step('storybook-contracts.js', ['--stories', path.join(out, 'reader', 'stories.json'), '--out', path.join(out, 'contracts'), '--storybook', url, ...(run.fileKey ? ['--file-key', run.fileKey] : [])]);
    writeFileSync(path.join(out, 'contracts.log'), contracts.output);
    const reportFile = path.join(out, 'contracts', 'storybook-contracts.json');
    if (!existsSync(reportFile)) throw Error(`react-to-figma-contracts-failed: exit ${contracts.status}, no report (log ${path.join(out, 'contracts.log')})`);
    for (const line of reportLines(JSON.parse(readFileSync(reportFile, 'utf8')), run.fileKey)) log(line);
    log(`  contracts: ${path.join(out, 'contracts', 'contracts')}${run.fileKey ? `; programs: ${path.join(out, 'contracts', 'figma')}` : ''}; report: ${reportFile}`);
    return 0;
  } finally { stop(); }
}
