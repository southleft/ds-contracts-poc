/**
 * THE PASTE DOOR — `npm run paste:check`
 *
 * LEDGER §3.4 called the plugin's paste referee "the largest single refusal
 * for an adopter": the round-trip runner had to BYPASS it to measure anything,
 * because no Untitled UI set could reach the shipping path. That left the
 * developer journey — contract → CLI bundle → paste into Figma — unproven for
 * the flagship kit, which is the one an outside adopter would actually try.
 *
 * Two blockers, both real, both now closed and both pinned here:
 *
 *   1. AN EMPTY `base`. A kit that publishes ZERO Figma variables mints every
 *      styled fact instead, so its base is legitimately `{}` and its whole
 *      vocabulary lives in `minted`. The referee demanded a non-empty base and
 *      refused the shape outright — with 989 self-sufficient literal leaves
 *      (zero aliases into base) sitting in the tree. Now it refuses only when
 *      there is nothing to sync AT ALL.
 *   2. A PER-VARIANT ICON REF. ds.social-icon's glyph is `{"asset":"{platform}"}`
 *      over six platforms. Every emitter expands that; the BUNDLER read it as a
 *      literal filename, hunted for an icon called "{platform}", and refused —
 *      with all six SVGs present. The refusal was real; the cause was a missing
 *      expansion, not a missing asset.
 *
 * This check runs the TWO CALLS THE PLUGIN ITSELF MAKES on a paste, for BOTH
 * kits, with no bypass and no reimplementation of the referee:
 *
 *   engine.parseIncomingText(json)   envelope + parseTokenSet + icons section
 *   engine.planGenerate(contracts)   schema referee per contract, then emit
 *
 * and asserts what a green parse does NOT prove: that a variable collection is
 * actually planned, and — for a multi-mode kit — that the modes carry a
 * DIFFERENCE. A mode COUNT cannot tell "two modes" from "one theme twice".
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPluginEngine } from '../../figma-sync/plugin/engine/entry.js';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, cond: boolean, detail = ''): void => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`);
};

interface Kit {
  name: string;
  collection: string;
  contractsDir: string;
  tokens: string[];
  modes?: string[];
  icons?: string;
  /** Minimum variables the tokens step must plan. */
  minVariables: number;
  /** When set, this many variables must differ between Light and Dark. */
  minModeVarying?: number;
}

const KITS: Kit[] = [
  {
    name: 'Untitled UI (a real Figma Community kit — ZERO published variables)',
    collection: 'Untitled UI',
    contractsDir: 'examples/untitled-ui/storybook/contracts',
    tokens: ['examples/untitled-ui/storybook/tokens/captured.dtcg.json', 'examples/untitled-ui/storybook/tokens/minted.dtcg.json'],
    icons: 'examples/untitled-ui/assets/icons',
    minVariables: 900,
  },
  {
    name: 'Eventz (a kit that publishes real variables, Light/Dark)',
    collection: 'Eventz',
    contractsDir: 'examples/eventz-vars/contracts',
    tokens: ['examples/eventz-vars/tokens/captured.dtcg.json', 'examples/eventz-vars/tokens/minted.dtcg.json'],
    modes: ['examples/eventz-vars/tokens/light.dtcg.json', 'examples/eventz-vars/tokens/dark.dtcg.json'],
    minVariables: 100,
    minModeVarying: 40,
  },
];

const engine = createPluginEngine({
  tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
  contracts: [],
  icons: {},
});

for (const kit of KITS) {
  console.log(`\n${kit.name}`);
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'paste-door-')), 'bundle.json');
  const contracts = readdirSync(path.join(ROOT, kit.contractsDir))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => path.join(ROOT, kit.contractsDir, f));
  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'packages/cli/dist/cli.js'),
      'figma', 'bundle', ...contracts,
      '--out', out,
      '--tokens', kit.tokens.map((t) => path.join(ROOT, t)).join(','),
      ...(kit.modes ? ['--modes', kit.modes.map((m) => path.join(ROOT, m)).join(',')] : []),
      ...(kit.icons ? ['--icons', path.join(ROOT, kit.icons)] : []),
      '--name', kit.collection,
    ],
    { encoding: 'utf8', cwd: ROOT },
  );

  const parsed = engine.parseIncomingText(readFileSync(out, 'utf8')) as {
    ok: boolean;
    issue?: { headline: string };
    contracts?: unknown[];
    tokenSet?: { name: string } | null;
    icons?: Record<string, string> | null;
  };
  check(
    `GATE 1 — the plugin ACCEPTS the paste (${contracts.length} contracts)`,
    parsed.ok,
    parsed.ok ? '' : parsed.issue?.headline,
  );
  if (!parsed.ok) continue;

  const plan = engine.planGenerate(parsed.contracts as unknown[], {
    withTokens: true,
    fileKey: '',
    tokenSet: parsed.tokenSet as never,
    icons: parsed.icons ?? undefined,
  }) as { ok: boolean; issues?: Array<{ headline: string }>; steps?: Array<Record<string, unknown>> };
  check(
    'GATE 2 — generate plans without refusal',
    plan.ok,
    plan.ok ? '' : (plan.issues ?? []).map((i) => i.headline).join(' | '),
  );
  if (!plan.ok) continue;

  const steps = plan.steps ?? [];
  const tokensStep = steps.find((s) => s.kind === 'tokens');
  const componentSteps = steps.filter((s) => s.kind === 'component');
  check('the plan syncs a variable collection FIRST', steps[0]?.kind === 'tokens');
  check(
    `the plan builds every contract (${componentSteps.length})`,
    componentSteps.length === (parsed.contracts as unknown[]).length,
  );

  const code = String(tokensStep?.code ?? '');
  const table = /const TOKENS = (\[[\s\S]*?\]);/.exec(code);
  check('the tokens step carries a variable table', table !== null);
  if (!table) continue;
  const tokens = JSON.parse(table[1]) as Array<{ name: string; light?: unknown; dark?: unknown }>;
  check(
    `the collection plans ≥${kit.minVariables} variables (${tokens.length})`,
    tokens.length >= kit.minVariables,
  );
  if (kit.minModeVarying !== undefined) {
    const varying = tokens.filter((t) => JSON.stringify(t.light) !== JSON.stringify(t.dark)).length;
    check(
      `≥${kit.minModeVarying} variables genuinely DIFFER between Light and Dark (${varying}) — a mode COUNT cannot tell two modes from one theme twice`,
      varying >= kit.minModeVarying,
    );
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`✘ the paste door is SHUT for ${failures.length} invariant(s):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  '✔ THE PASTE DOOR IS OPEN for both kits — the developer path (contract → CLI bundle → paste →\n' +
    '  variable collection + component sets) runs end to end, for a kit with real variables AND for a\n' +
    '  real Figma Community kit that publishes none.',
);
