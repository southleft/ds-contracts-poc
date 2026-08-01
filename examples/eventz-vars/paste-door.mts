/**
 * THE PASTE DOOR, DRIVEN FOR REAL — `npx tsx examples/eventz-vars/paste-door.mts`
 *
 * LEDGER.md §3.4 (Untitled UI) calls the plugin's paste referee "the largest
 * single refusal for an adopter": the round-trip runner had to BYPASS it to
 * measure anything, because that kit publishes zero variables, so its bundle's
 * `base` tokenSet is empty and the referee refuses it. That left the developer
 * path — contract → CLI bundle → paste into Figma — unproven end to end.
 *
 * Eventz publishes real variables, so its bundle has a non-empty base. This
 * script runs the TWO CALLS THE PLUGIN ITSELF MAKES on a paste, with no
 * bypass and no reimplementation of the referee:
 *
 *   engine.parseIncomingText(json)   envelope + parseTokenSet + icons section
 *   engine.planGenerate(contracts)   schema referee per contract, then emit
 *
 * and then asserts the thing a green parse does NOT prove: that the two-mode
 * plane survived. 43 of Eventz's variables genuinely differ between Light and
 * Dark, and a bundle built from `base` alone flattens them — the collection
 * still has two modes, still reports success, and Dark is silently Light. So
 * the receipt requires a DIFFERENCE COUNT, not a mode count.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createPluginEngine } from '../../figma-sync/plugin/engine/entry.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'eventz.bundle.json');

const fail = (msg: string): never => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

// 1. Build the bundle with the REAL CLI — the same command an adopter runs.
const contracts = execFileSync('sh', ['-c', `ls ${path.join(HERE, 'contracts')}/*.contract.json`], { encoding: 'utf8' })
  .trim()
  .split('\n');
execFileSync(
  process.execPath,
  [
    path.join(ROOT, 'packages/cli/dist/cli.js'),
    'figma',
    'bundle',
    ...contracts,
    '--out',
    OUT,
    '--tokens',
    `${path.join(HERE, 'tokens/captured.dtcg.json')},${path.join(HERE, 'tokens/minted.dtcg.json')}`,
    '--modes',
    `${path.join(HERE, 'tokens/light.dtcg.json')},${path.join(HERE, 'tokens/dark.dtcg.json')}`,
    '--name',
    'Eventz',
  ],
  { encoding: 'utf8', cwd: ROOT },
);

// 2. GATE 1 — the paste.
const engine = createPluginEngine({
  tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
  contracts: [],
  icons: {},
});
const parsed = engine.parseIncomingText(readFileSync(OUT, 'utf8')) as {
  ok: boolean;
  issue?: { headline: string };
  contracts?: unknown[];
  tokenSet?: { name: string; base: Record<string, unknown>; modes?: Record<string, unknown> } | null;
  icons?: Record<string, string> | null;
};
if (!parsed.ok) fail(`GATE 1 — the plugin REFUSED the paste: ${parsed.issue?.headline}`);
const ts = parsed.tokenSet;
if (!ts) fail('GATE 1 parsed but surfaced no tokenSet — the whole point of this round');

// 3. GATE 2 — the generate plan.
const plan = engine.planGenerate(parsed.contracts as unknown[], {
  withTokens: true,
  fileKey: '',
  tokenSet: ts as never,
  icons: parsed.icons ?? undefined,
}) as { ok: boolean; issues?: Array<{ headline: string }>; steps?: Array<Record<string, unknown>> };
if (!plan.ok) fail(`GATE 2 — generate REFUSED: ${(plan.issues ?? []).map((i) => i.headline).join(' | ')}`);

const steps = plan.steps ?? [];
const tokensStep = steps.find((s) => s.kind === 'tokens');
if (!tokensStep) fail('GATE 2 built a plan with NO tokens step — the variable collection would never sync');

// 4. THE MODE PLANE — a difference count, not a mode count.
const code = String(tokensStep.code);
const table = /const TOKENS = (\[[\s\S]*?\]);/.exec(code);
if (!table) fail('the tokens step carries no TOKENS table — the generator shape changed; fix this probe');
const tokens = JSON.parse(table![1]) as Array<{ name: string; light?: unknown; dark?: unknown }>;
const varying = tokens.filter((t) => JSON.stringify(t.light) !== JSON.stringify(t.dark));
if (varying.length === 0) {
  fail(
    `every one of ${tokens.length} variables has light === dark. The collection would still have TWO modes and still ` +
      'report success, and Dark would silently BE Light — the exact failure this receipt exists to catch.',
  );
}

const componentSteps = steps.filter((s) => s.kind === 'component');
console.log(`✔ GATE 1 paste accepted — ${(parsed.contracts ?? []).length} contracts, tokenSet "${ts.name}" (${Object.keys(ts.base).length} base tokens, modes ${Object.keys(ts.modes ?? {}).join('+') || 'none'})`);
console.log(`✔ GATE 2 generate plan — ${steps.length} steps: tokens-first, then ${componentSteps.length} component script(s)`);
console.log(`✔ MODE PLANE — ${varying.length} of ${tokens.length} variables genuinely differ between Light and Dark`);
console.log(
  '\nTHE PASTE DOOR IS OPEN. LEDGER §3.4 records it shut for Untitled UI (empty base tokenSet, zero published\n' +
    'variables); the refusal was a property of that KIT, not of the engine. A library that publishes variables\n' +
    'walks the developer path end to end: contract → CLI bundle → paste → variable collection + component sets.',
);
