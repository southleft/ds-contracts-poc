/**
 * THE DAGGER CENSUS — `npm run dagger:census` (`--update` to re-record).
 *
 * WHY THIS EXISTS, precisely. On 2026-08-03 I shipped a "closure check" in
 * applyLiterals meant to name any literal the canvas silently dropped. It
 * produced 107 dropped-fact receipts across the committed corpora, of which
 * TWO were real. The flagship Untitled UI button-base gained two bogus
 * refusals — `width: fit-content` compiles BY OMISSION as Figma HUG, which a
 * spec snapshot cannot distinguish from a drop.
 *
 * IT PASSED 182/182. Every byte guard in this repo watches `src/` (the golden
 * manifest, 265 files) or the per-library emitted figma scripts (the freshness check,
 * six libraries). The main `contracts/` corpus produces ZERO daggers, so the
 * goldens regenerated clean; and Untitled UI and Eventz — the two ADOPTER-
 * FACING kits, the ones an outsider actually tries — have NO committed emitted
 * output for any guard to compare. The damage was invisible by construction.
 *
 * So this pins the thing that actually changed: for every committed contract in
 * every corpus, HOW MANY facts the emitter reports it could not carry. A
 * dropped-fact receipt is the engine's honesty channel; its COUNT is therefore
 * a number that must never drift unnoticed in either direction.
 *
 *   a receipt APPEARING   = either a real newly-found loss, or a false alarm
 *   a receipt VANISHING   = either a real fix, or honesty quietly switched off
 *
 * Both are changes a human must look at, which is why this is an exact-match
 * pin and not a decrease-only ratchet: "fewer refusals" is exactly what a
 * broken refusal path looks like.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPluginEngine } from '../../figma-sync/plugin/engine/entry.js';

const ROOT = process.cwd();
const UPDATE = process.argv.includes('--update');
const BASELINE = path.join(ROOT, 'extract', 'figma', 'dagger-census.json');

interface Corpus {
  id: string;
  contractsDir: string;
  tokens: string[];
  modes?: string[];
  icons?: string;
}

/** Every corpus that ships committed contracts. The two kits at the top are the
 *  ones no existing guard covers, and the reason this file exists. */
const CORPORA: Corpus[] = [
  {
    id: 'untitled-ui',
    contractsDir: 'examples/untitled-ui/storybook/contracts',
    tokens: ['examples/untitled-ui/storybook/tokens/captured.dtcg.json', 'examples/untitled-ui/storybook/tokens/minted.dtcg.json'],
    icons: 'examples/untitled-ui/assets/icons',
  },
  {
    id: 'eventz-vars',
    contractsDir: 'examples/eventz-vars/contracts',
    tokens: ['examples/eventz-vars/tokens/captured.dtcg.json', 'examples/eventz-vars/tokens/minted.dtcg.json'],
    modes: ['examples/eventz-vars/tokens/light.dtcg.json', 'examples/eventz-vars/tokens/dark.dtcg.json'],
  },
  { id: 'mui', contractsDir: 'examples/mui/contracts', tokens: ['examples/mui/tokens/mui.dtcg.json', 'examples/mui/tokens/mui-minted.dtcg.json'], icons: 'examples/mui/assets/icons' },
  { id: 'carbon', contractsDir: 'examples/carbon/contracts', tokens: ['examples/carbon/tokens/carbon.dtcg.json', 'examples/carbon/tokens/carbon-minted.dtcg.json'], icons: 'examples/carbon/assets/icons' },
  { id: 'altitude', contractsDir: 'examples/altitude/contracts', tokens: ['examples/altitude/tokens/altitude.dtcg.json', 'examples/altitude/tokens/altitude-minted.dtcg.json'], icons: 'examples/altitude/assets/icons' },
  // Exact-conversion wave (c924c9c2) threaded icon assets through the
  // tailwind/astryx generate + bundle lanes; their contracts now reference
  // real svg assets, so a bundle without --icons REFUSES by name. The census
  // must pass the same icon dirs the canonical bundle commands pass, or the
  // whole-corpus refusal masks every per-component receipt row.
  { id: 'tailwind', contractsDir: 'examples/tailwind/contracts', tokens: ['examples/tailwind/tokens/tailwind.dtcg.json', 'examples/tailwind/tokens/tailwind-minted.dtcg.json'], icons: 'examples/tailwind/assets/icons' },
  { id: 'astryx', contractsDir: 'examples/astryx/contracts', tokens: ['examples/astryx/tokens/astryx.dtcg.json', 'examples/astryx/tokens/astryx-minted.dtcg.json'], icons: 'examples/astryx/assets/icons' },
  { id: 'polaris', contractsDir: 'examples/polaris/contracts', tokens: ['examples/polaris/tokens/polaris-light.dtcg.json', 'examples/polaris/tokens/polaris-minted.dtcg.json'], icons: 'examples/polaris/assets/icons' },
];

const CLI = path.join(ROOT, 'packages/cli/dist/cli.js');
if (!existsSync(CLI)) {
  console.error('REFUSED: packages/cli/dist/cli.js is not built — run `npm run build -w @ds-contracts/cli` first.');
  process.exit(1);
}

/** Per-contract dropped-fact receipts, read out of the emitted bundle. */
function censusOf(c: Corpus): Record<string, number> | null {
  const dir = path.join(ROOT, c.contractsDir);
  if (!existsSync(dir)) return null;
  const contracts = readdirSync(dir).filter((f) => f.endsWith('.contract.json')).map((f) => path.join(dir, f));
  if (contracts.length === 0) return null;
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'dagger-')), 'bundle.json');
  const tokens = c.tokens.filter((t) => existsSync(path.join(ROOT, t)));
  // A MISSING TOKEN FILE MUST NOT SILENTLY SHRINK THE CORPUS. My first config
  // named `polaris.dtcg.json`, which does not exist (it is `polaris-light`),
  // so the filter quietly dropped it and the bundle refused for a reason that
  // looked like a real engine refusal. Name the miss instead.
  const missing = c.tokens.filter((t) => !existsSync(path.join(ROOT, t)));
  if (missing.length > 0) return { [`(token file NOT FOUND: ${missing.join(', ')})`]: 1 };
  if (tokens.length === 0) return null;
  try {
    execFileSync(
      process.execPath,
      [
        CLI, 'figma', 'bundle', ...contracts, '--out', out,
        '--tokens', tokens.map((t) => path.join(ROOT, t)).join(','),
        ...(c.modes ? ['--modes', c.modes.map((m) => path.join(ROOT, m)).join(',')] : []),
        ...(c.icons && existsSync(path.join(ROOT, c.icons)) ? ['--icons', path.join(ROOT, c.icons)] : []),
        '--name', c.id,
      ],
      { encoding: 'utf8', cwd: ROOT, stdio: 'pipe' },
    );
  } catch (e) {
    // A corpus the CLI refuses is a finding, not a skip — record it as such so
    // the pin notices when a bundle stops building at all.
    return { '(bundle REFUSED)': 1 };
  }
  // COUNT WHERE THE DAGGERS ACTUALLY LIVE. `figma bundle` emits CONTRACTS; the
  // dropped-fact receipts are produced later, when the plugin engine COMPILES
  // them. Counting in the bundle measured almost nothing (1 receipt across all
  // eight corpora) — so run the same two calls the plugin runs on a paste and
  // count per compiled component, which is where an adopter would see them.
  const engine = createPluginEngine({
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    contracts: [], icons: {},
  } as never);
  const parsed = engine.parseIncomingText(readFileSync(out, 'utf8')) as {
    ok: boolean; contracts?: unknown[]; tokenSet?: unknown; icons?: Record<string, string> | null;
  };
  const counts: Record<string, number> = {};
  if (!parsed.ok) return { '(paste REFUSED)': 1 };
  const plan = engine.planGenerate(parsed.contracts as unknown[], {
    withTokens: true, fileKey: '', tokenSet: parsed.tokenSet as never, icons: parsed.icons ?? undefined,
  }) as { ok: boolean; steps?: Array<Record<string, unknown>> };
  if (!plan.ok) return { '(generate REFUSED)': 1 };
  for (const step of plan.steps ?? []) {
    if (step.kind !== 'component') continue;
    const code = String(step.code ?? '');
    const n = (code.match(/†/g) ?? []).length + (code.match(/channelMiss/g) ?? []).length;
    // `contractId` — NOT `name`/`id`, which are undefined on a step. Keying on
    // a missing field made every component overwrite one `(unnamed)` bucket, so
    // the census recorded the LAST component's count as the whole corpus's.
    if (n > 0) counts[String(step.contractId ?? step.title ?? '(unnamed)')] = n;
  }
  return counts;
}

const current: Record<string, Record<string, number>> = {};
for (const c of CORPORA) {
  const r = censusOf(c);
  if (r !== null) current[c.id] = r;
}

const total = Object.values(current).reduce((a, m) => a + Object.values(m).reduce((x, y) => x + y, 0), 0);

if (UPDATE) {
  writeFileSync(BASELINE, `${JSON.stringify({ generatedBy: 'extract/figma/dagger-census.ts', census: current }, null, 2)}\n`);
  console.log(`recorded ${Object.keys(current).length} corpus/corpora, ${total} dropped-fact receipt(s) → ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('REFUSED: no baseline. Run `npm run dagger:census -- --update` in a reviewed change.');
  process.exit(1);
}
const baseline = (JSON.parse(readFileSync(BASELINE, 'utf8')) as { census: Record<string, Record<string, number>> }).census;

const drift: string[] = [];
for (const id of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  const was = baseline[id] ?? {};
  const now = current[id] ?? {};
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const a = was[key] ?? 0;
    const b = now[key] ?? 0;
    if (a !== b) drift.push(`  ${id} ▸ ${key}: ${a} → ${b}${b > a ? '  (NEW receipts — a real loss found, or a false alarm)' : '  (receipts GONE — a real fix, or honesty switched off)'}`);
  }
}

for (const [id, m] of Object.entries(current)) {
  const n = Object.values(m).reduce((x, y) => x + y, 0);
  console.log(`  ${id.padEnd(14)} ${n} dropped-fact receipt(s)${n === 0 ? '' : ` across ${Object.keys(m).length} contract(s)`}`);
}
console.log(`\n${total} dropped-fact receipt(s) across ${Object.keys(current).length} corpora.`);

if (drift.length > 0) {
  console.error(
    `\n✘ DAGGER DRIFT — ${drift.length} change(s) no gate would otherwise have shown:\n${drift.join('\n')}\n\n` +
      'Both directions matter. MORE receipts is either a newly-found loss or a false alarm (a "closure check" I shipped\n' +
      'produced 107 of these, 2 of them real). FEWER is either a real fix or a refusal path that quietly stopped firing.\n' +
      'Review, then re-record with `npm run dagger:census -- --update`.',
  );
  process.exit(1);
}
console.log('✔ every corpus reports exactly the dropped facts it reported when this was last reviewed.');
