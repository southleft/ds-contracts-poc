/**
 * CODE-ONLY FACT RECEIPTS — the facts the canvas cannot carry are NAMED
 * everywhere the bundle goes, not collapsed to one trailing dagger.
 *
 *   npx tsx core/code-only-facts-check.ts
 *
 * THE DEFECT THIS PINS. compileComponentData computed, per contract, the
 * full list of facts the canvas cannot carry (declared-not-drawn channels,
 * gradient / shadow grammar misses, cross-axis gaps, per-side border
 * colours, in-flow offsets, events, runtime-sized meters, scrim bounding,
 * preview-only washes) — and then DISCARDED the strings. The only consumer
 * was `.size`, feeding one trailing `†` in the set description. Measured on
 * the eight Flowbite contracts: ~300 named lines collapsed to 8 bare daggers,
 * the plugin UI never mentioned the dagger, and the committed scripts carried
 * only the description mark. A dropped fact must be named where a person can
 * read it — that is the v1 bar, and this check holds every surface to it:
 *
 *   1. compiled ComponentData carries `codeOnlyFacts` (one shape, sorted);
 *      the per-stem counts below are pinned EXACTLY — a count moving in
 *      either direction is a human's decision (see dagger-census.ts for why
 *      "fewer" is not automatically progress);
 *   2. `figma bundle` writes the list into the bundle JSON as a sibling of
 *      `contracts` (so the paste carries it) and prints a per-contract
 *      summary to stdout;
 *   3. the plugin engine's plan step carries the list, and a mock plugin run
 *      stamps it as shared plugin data `ds_contracts/codeOnlyFacts` on the
 *      built set (capped, "+N more" by name), returns it in the step result
 *      (what the plugin UI's run report lists), and keeps the `†` in the
 *      description with the count appended.
 *
 * Naming, not carrying: this check must NOT change which facts are dropped.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ContractSchema, createFigmaEngine, tokenSetTokenTrees, type CodeOnlyFact, type Contract, type TokenSetPayload } from './index.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

const ROOT = process.cwd();
const failures: string[] = [];
const check = (label: string, condition: boolean): void => {
  if (!condition) failures.push(label);
  console.log(`  ${condition ? '✔' : '✖'} ${label}`);
};

/** The pinned census — re-measured 2026-08-22 on the committed Flowbite
 *  eight. Keyed by contract id; the value is the EXACT number of named
 *  code-only facts (every kind), with the per-kind split beside it so a
 *  moved count says WHICH honesty channel moved. */
const PINNED: Record<string, { total: number; byKind: Record<string, number> }> = {
  // Per-side border colours are per Color (4 × 4 sides = 16 facts, one
  // variant each) + column-gap once (all 4 variants) + the dismiss event +
  // label display:block declared.
  'flowbite.alert': { total: 19, byKind: { channel: 17, event: 1, declared: 1 } },
  // row-gap once (all 24 variants) + label display declared.
  'flowbite.badge': { total: 2, byKind: { channel: 1, declared: 1 } },
  // top/right/bottom/left in-flow insets (one token each, all 45 variants) +
  // outline-color per Color (5) + root position/pointer-events declared.
  'flowbite.button': { total: 11, byKind: { channel: 9, declared: 2 } },
  // label column-gap on a VERTICAL stack (cross axis).
  'flowbite.card': { total: 1, byKind: { channel: 1 } },
  // root margin-top (FC-EMIT-ROOT-MARGIN-SILENT, all 5 Color variants) + root display.
  'flowbite.helpertext': { total: 2, byKind: { channel: 1, declared: 1 } },
  // per-side border-style ×4 + display, all declared on root.
  'flowbite.kbd': { total: 5, byKind: { declared: 5 } },
  'flowbite.label': { total: 2, byKind: { declared: 2 } },
  // part-0's four inset bindings on an in-flow box + 7 declared + the toggle event.
  'flowbite.toggleswitch': { total: 12, byKind: { channel: 4, declared: 7, event: 1 } },
};

const tsx = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const dir = mkdtempSync(path.join(tmpdir(), 'code-only-facts-'));
const bundlePath = path.join(dir, 'tailwind.bundle.json');

interface BundleFacts {
  contractId: string;
  name: string;
  facts?: CodeOnlyFact[];
  refused?: string;
}

try {
  // --- 2. the CLI bundle: JSON sibling + stdout summary --------------------
  const stdout = execFileSync(
    tsx,
    [
      'packages/cli/src/cli.ts',
      'figma',
      'bundle',
      'examples/tailwind/contracts',
      '--tokens',
      'examples/tailwind/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json',
      '--name',
      'Tailwind',
      '--icons',
      'examples/tailwind/assets/icons',
      '--out',
      bundlePath,
    ],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
  );
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as {
    tokenSet: TokenSetPayload;
    icons?: Record<string, string>;
    contracts: unknown[];
    codeOnlyFacts?: BundleFacts[];
  };
  check('bundle has eight Flowbite contracts', bundle.contracts.length === 8);
  const keys = Object.keys(bundle);
  check(
    'bundle JSON carries codeOnlyFacts as a SIBLING of contracts (after it — the paste carries the receipt)',
    Array.isArray(bundle.codeOnlyFacts) && keys.indexOf('codeOnlyFacts') === keys.indexOf('contracts') + 1,
  );
  const bundleFacts = bundle.codeOnlyFacts ?? [];
  check('bundle codeOnlyFacts has one row per contract, in contract order', bundleFacts.length === 8 &&
    bundleFacts.every((row, i) => row.contractId === (bundle.contracts[i] as { id: string }).id));
  check('bundle codeOnlyFacts refuses nothing (every Flowbite stem compiled)', bundleFacts.every((row) => row.refused === undefined));

  // --- 1. compiled ComponentData: the one receipt shape, pinned counts -----
  // The SAME engine construction the plugin applies to a paste (foreignEngineFor).
  const engine = createFigmaEngine({
    tokens: tokenSetTokenTrees(bundle.tokenSet),
    icons: new Map(Object.entries(bundle.icons ?? {})),
  });
  const contracts = bundle.contracts.map((c) => ContractSchema.parse(c)) as Contract[];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const compiled = new Map<string, CodeOnlyFact[]>();
  for (const contract of contracts) {
    const data = engine.compileComponentData(contract, byId);
    const facts = data.codeOnlyFacts ?? [];
    compiled.set(contract.id, facts);
    const pin = PINNED[contract.id];
    const byKind: Record<string, number> = {};
    for (const f of facts) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    const split = Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
    check(
      `${contract.name}: ${facts.length} code-only fact(s) named (${split}) — pinned ${pin?.total ?? '?'}`,
      pin !== undefined && facts.length === pin.total &&
        JSON.stringify(Object.entries(byKind).sort()) === JSON.stringify(Object.entries(pin.byKind).sort()),
    );
    // Every fact is a complete sentence: part + kind + channel + reason.
    check(
      `${contract.name}: every fact carries part, kind, channel, a reason and its variant coverage`,
      facts.every((f) => f.part.length > 0 && f.kind.length > 0 && f.channel.length > 0 && f.reason.length > 0 && typeof f.value === 'string' &&
        f.variants.count >= 1 && f.variants.count <= f.variants.of && (f.variants.count === f.variants.of ? f.variants.names === undefined : Array.isArray(f.variants.names))),
    );
    // Deterministic order: sorted, no duplicates.
    const keyOf = (f: CodeOnlyFact) => JSON.stringify([f.part, f.kind, f.channel, f.value, f.reason]);
    const sorted = [...facts].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
    check(
      `${contract.name}: codeOnlyFacts is sorted and duplicate-free`,
      JSON.stringify(sorted) === JSON.stringify(facts) && new Set(facts.map(keyOf)).size === facts.length,
    );
    // The dagger stays, with the count beside it — or is absent when there is nothing to name.
    check(
      `${contract.name}: description ${facts.length > 0 ? `ends with "† (${facts.length} code-only facts — see plugin report)"` : 'carries no dagger'}`,
      facts.length > 0
        ? data.description.endsWith(` † (${facts.length} code-only facts — see plugin report)`)
        : !data.description.includes('†') && data.codeOnlyFacts === undefined,
    );
    // The bundle's row is the compiled list, byte for byte.
    const row = bundleFacts.find((r) => r.contractId === contract.id);
    check(`${contract.name}: bundle row equals the compiled list`, JSON.stringify(row?.facts ?? null) === JSON.stringify(facts));
    // stdout names it per contract.
    const line = stdout.split('\n').find((l) => l.includes(`${contract.name}: ${facts.length} fact`));
    check(
      `${contract.name}: figma bundle stdout says "${contract.name}: ${facts.length} fact(s) stay code-only"`,
      line !== undefined && (facts.length === 0 || line.includes('see bundle.codeOnlyFacts')),
    );
  }
  // The specific facts the task was measured on — present BY NAME.
  const alert = compiled.get('flowbite.alert') ?? [];
  check('Alert names the dismiss EVENT (kind event, value onDismiss)', alert.some((f) => f.kind === 'event' && f.channel === 'dismiss' && f.value === 'onDismiss'));
  check('Alert names column-gap as a cross-axis channel miss', alert.some((f) => f.kind === 'channel' && f.channel === 'column-gap'));
  // Per-side border colours differ per Color, so each is its own fact, each
  // carried by exactly ONE of the four variants and naming it.
  const alertTop = alert.filter((f) => f.kind === 'channel' && f.channel === 'border-top-color' && f.part === 'root');
  check('Alert names the per-side border colours once per Color (border-top-color ×4, each on 1 of 4 variants, named)',
    alertTop.length === 4 && alertTop.every((f) => f.variants.count === 1 && f.variants.of === 4 && f.variants.names?.length === 1) &&
      new Set(alertTop.map((f) => f.variants.names?.[0])).size === 4);
  const alertGap = alert.filter((f) => f.kind === 'channel' && f.channel === 'column-gap');
  check('Alert names column-gap ONCE, carried by all 4 variants (one fact, not four)', alertGap.length === 1 && alertGap[0].variants.count === 4 && alertGap[0].variants.of === 4);
  const button = compiled.get('flowbite.button') ?? [];
  const outline = button.filter((f) => f.kind === 'channel' && f.channel === 'outline-color');
  check('Button names the resting outline-color — folded across its 45 variants, never 45 entries',
    outline.length > 0 && outline.length < 45 && outline.reduce((n, f) => n + f.variants.count, 0) === 45 && outline.every((f) => f.variants.of === 45));
  check('Button names its declared position on root as a contract-wide fact (all 45 variants, no names)',
    button.some((f) => f.kind === 'declared' && f.channel === 'position' && f.part === 'root' && f.variants.count === 45 && f.variants.of === 45 && f.variants.names === undefined));
  const toggle = compiled.get('flowbite.toggleswitch') ?? [];
  check('ToggleSwitch names its declared-not-drawn facts (kind declared)', toggle.some((f) => f.kind === 'declared'));
  check('ToggleSwitch names the in-flow inset bindings (bottom on an in-flow box)', toggle.some((f) => f.kind === 'channel' && f.channel === 'bottom'));

  // --- 3. the plugin: plan step + mock run stamps plugin data -------------
  const plugin = createPluginEngine({
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    contracts: [],
    icons: {},
  });
  const parsed = plugin.parseIncomingText(readFileSync(bundlePath, 'utf8'));
  check('plugin parses the bundle', parsed.ok && parsed.kind === 'bundle');
  if (!parsed.ok) throw new Error('bundle paste refused');
  const plan = plugin.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  check('plugin plans the bundle', plan.ok);
  if (!plan.ok) throw new Error(plan.issues.map((i) => i.headline).join('; '));
  const componentSteps = plan.steps.filter((s) => s.kind === 'component');
  check('every component plan step carries codeOnlyFacts equal to the compiled list', componentSteps.every((s) =>
    JSON.stringify(s.codeOnlyFacts ?? []) === JSON.stringify(compiled.get(s.contractId ?? '') ?? [])));

  const { figma, root } = createFigmaMock();
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string): Promise<unknown> => vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { timeout: 300_000 }) as Promise<unknown>;
  const stepResults = new Map<string, Record<string, unknown>>();
  for (const step of plan.steps) {
    const result = (await run(step.code)) as { results?: Array<Record<string, unknown>> } | undefined;
    if (step.kind === 'component' && step.contractId) stepResults.set(step.contractId, result?.results?.[0] ?? {});
  }
  for (const contract of contracts) {
    const facts = compiled.get(contract.id) ?? [];
    const node = root.findOne(
      (n: { type: string; getSharedPluginData: (ns: string, k: string) => string }) =>
        (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getSharedPluginData('ds_contracts', 'contractId') === contract.id,
    ) as { description: string; getSharedPluginData: (ns: string, k: string) => string } | null;
    check(`${contract.name}: built in the mock file`, node !== null);
    if (!node) continue;
    const raw = node.getSharedPluginData('ds_contracts', 'codeOnlyFacts');
    if (facts.length === 0) {
      check(`${contract.name}: no facts → no ds_contracts/codeOnlyFacts stamp`, raw === '');
      continue;
    }
    const stamp = JSON.parse(raw) as { count: number; facts: CodeOnlyFact[]; more: number; moreNames?: string[] };
    check(
      `${contract.name}: ds_contracts/codeOnlyFacts stamped — count ${stamp.count}, ${stamp.facts.length} in full${stamp.more > 0 ? `, +${stamp.more} more by name` : ''} (${raw.length} bytes)`,
      stamp.count === facts.length && stamp.facts.length + stamp.more === facts.length && raw.length <= 32 * 1024 &&
        (stamp.more === 0 || (Array.isArray(stamp.moreNames) && stamp.moreNames.length > 0)),
    );
    check(`${contract.name}: stamped facts are a prefix of the compiled list`, JSON.stringify(stamp.facts) === JSON.stringify(facts.slice(0, stamp.facts.length)));
    check(`${contract.name}: canvas description keeps the dagger with the count`, node.description.endsWith(` † (${facts.length} code-only facts — see plugin report)`));
    const rep = stepResults.get(contract.id) ?? {};
    check(`${contract.name}: the step RESULT carries the full list (what the plugin report lists under the set)`,
      JSON.stringify(rep.codeOnlyFacts ?? null) === JSON.stringify(facts));
  }
  // The amend path re-stamps on an UNCHANGED skip too (a stale stamp would
  // describe facts nobody named) — re-run Alert and read the stamp back.
  {
    const alertStep = componentSteps.find((s) => s.contractId === 'flowbite.alert')!;
    const node = root.findOne((n: { type: string; getSharedPluginData: (ns: string, k: string) => string }) =>
      n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === 'flowbite.alert') as { setSharedPluginData: (ns: string, k: string, v: string) => void; getSharedPluginData: (ns: string, k: string) => string };
    node.setSharedPluginData('ds_contracts', 'codeOnlyFacts', '{"stale":true}');
    const again = (await run(alertStep.code)) as { results: Array<Record<string, unknown>> };
    check('re-running Alert skips as unchanged', again.results[0]?.skipped === true && again.results[0]?.reason === 'unchanged');
    const stamp = JSON.parse(node.getSharedPluginData('ds_contracts', 'codeOnlyFacts')) as { count?: number };
    check('an unchanged skip still refreshes ds_contracts/codeOnlyFacts', stamp.count === alert.length);
    check('an unchanged skip still returns the list in the step result', JSON.stringify(again.results[0]?.codeOnlyFacts ?? null) === JSON.stringify(alert));
  }
  // The plugin UI lists them: ui.html reads rep.codeOnlyFacts in runSteps.
  const ui = readFileSync(path.join(ROOT, 'figma-sync', 'plugin', 'ui.html'), 'utf8');
  check('plugin ui.html runSteps lists codeOnlyFacts under the set (the same place the tokens step logs leftovers)',
    ui.includes('codeOnlyFacts') && ui.includes('stay code-only'));

  // --- 4. R8 (2026-08-22): the declared paths that escaped the naming -------
  // Found by conformance/canvas.ts: `aspect-ratio` was the one SILENT row.
  // The registry calls the channel 'draw' (so the declared collector names
  // nothing) and the emitter lowers it to a FIXED HEIGHT — the ratio itself
  // never reaches a canvas that has no aspect-ratio field, the dump reads a
  // height back and the proposal mints a height token. Synthetic seeds pin
  // every branch of that lowering as a NAMED channel fact, and pin that a
  // declared channel the registry does not know (compileComponentData does
  // NOT run validateContract — only the script emitter does) produces a
  // fact instead of the bare `return` it used to.
  const seed = (root: Record<string, unknown>): Contract =>
    ContractSchema.parse({
      $schema: './contract.schema.json',
      id: 'check.code-only-synthetic',
      name: 'CodeOnlySynthetic',
      version: '0.1.0',
      status: 'draft',
      description: 'code-only facts synthetic seed',
      semantics: { element: 'div' },
      props: [],
      states: [],
      anatomy: { root },
      anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: '@ds-contracts/code-only-facts-check', export: 'CodeOnlySynthetic' } },
    }) as Contract;
  const factsOf = (root: Record<string, unknown>): CodeOnlyFact[] => {
    const c = seed(root);
    return engine.compileComponentData(c, new Map([[c.id, c]])).codeOnlyFacts ?? [];
  };
  const names = (facts: CodeOnlyFact[], part: string, kind: CodeOnlyFact['kind'], channel: string, value: string, words: string[]): boolean =>
    facts.some((f) => f.part === part && f.kind === kind && f.channel === channel && f.value === value && words.every((w) => f.reason.includes(w)));
  {
    const lowered = factsOf({ layout: { display: 'flex' }, declared: { 'aspect-ratio': '2 / 1' }, literals: { width: '80px' } });
    check('aspect-ratio lowered from a literal width is NAMED with its numbers (kind channel, "LOWERED to a fixed height of 40px")',
      names(lowered, 'root', 'channel', 'aspect-ratio', '2 / 1', ['no aspect-ratio field', 'LOWERED to a fixed height of 40px', '80px ÷ 2']));
    const widthless = factsOf({ layout: { display: 'flex' }, declared: { 'aspect-ratio': '2 / 1' } });
    check('aspect-ratio with no width to derive from is NAMED (nothing drawn, and the receipt says why)',
      names(widthless, 'root', 'channel', 'aspect-ratio', '2 / 1', ['no aspect-ratio field', 'no bound or literal width']));
    const heightWins = factsOf({ layout: { display: 'flex' }, declared: { 'aspect-ratio': '2 / 1' }, literals: { width: '80px', height: '20px' } });
    check('aspect-ratio beside a carried height is NAMED (the height wins; the ratio is not enforced)',
      names(heightWins, 'root', 'channel', 'aspect-ratio', '2 / 1', ['no aspect-ratio field', 'height channel, which wins']));
    const parent = factsOf({
      layout: { display: 'flex' },
      literals: { width: '80px' },
      parts: { glyph: { element: 'span', declared: { position: 'absolute', 'aspect-ratio': '1 / 1' } } },
    });
    check('a parent taking its height from an absolute child\'s aspect-ratio NAMES that lowering on itself, by child name',
      names(parent, 'root', 'channel', 'aspect-ratio', '1 / 1', ['child "glyph"', 'LOWERED to this frame\'s fixed height of 80px']));
    check('…and the child still names its own ratio (no width of its own)',
      names(parent, 'glyph', 'channel', 'aspect-ratio', '1 / 1', ['no bound or literal width']));
    const unknown = factsOf({ layout: { display: 'flex' }, declared: { 'scroll-snap-type': 'x mandatory' }, literals: { width: '80px', height: '20px' } });
    check('a declared channel the DECLARED_CHANNELS registry does not know is a NAMED declared fact, never silence',
      names(unknown, 'root', 'declared', 'scroll-snap-type', 'x mandatory', ['outside the DECLARED_CHANNELS registry']));
    const unknownState = factsOf({
      layout: { display: 'flex' },
      declaredStates: { hover: { 'scroll-snap-type': 'x mandatory' } },
      literals: { width: '80px', height: '20px' },
    });
    check('…and so is one declared for a state',
      names(unknownState, 'root', 'declared', 'scroll-snap-type', 'x mandatory', ['hover state', 'outside the DECLARED_CHANNELS registry']));
    // Naming, not carrying: the synthetic seeds must not make the Flowbite
    // census move — the eight stems declare no aspect-ratio (pinned above).
    check('no Flowbite stem names aspect-ratio (the census above is untouched by this round)',
      [...compiled.values()].every((facts) => !facts.some((f) => f.channel === 'aspect-ratio')));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n✘ code-only-facts: ${failures.length} pin(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ code-only-facts: every fact the canvas cannot carry is named in the script, the bundle, the plugin data and the plugin report');
