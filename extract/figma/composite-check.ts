/**
 * Receipts for COMPOSITE CHILDREN (dump v1.5) — `npm run extract:figma:composite:check`.
 *
 * The queue-head failure class: composite children rendered HOLLOW — a
 * nested instance either name-coincidence-linked to the WRONG design
 * system's contract (Shoelace "Button" → repo ds.button, 36 variants
 * undiffable), stubbed into an invisible zero-size box, or dropped its slot
 * content entirely (Eventz icons, Δ-82px on every row). Three mechanisms fix
 * it, each pinned here against the COMMITTED fixtures:
 *
 *   1. KEY-BASED SESSION LINKING (rename-safe)
 *      Nested instances resolve by componentSetKey FIRST (dump v1.5
 *      instanceSetKey / instanceKey vs contracts' anchors), name as a
 *      fallback — and a name match whose keys CONTRADICT is refused by
 *      name. Same key + different name LINKS; same name + different key
 *      does NOT.
 *
 *   2. STUB GEOMETRY (honest observed box)
 *      When only a STUB exists, the instance's OBSERVED bounding box +
 *      primary paint (dump v1.5 bbox/fill/stroke) mint provisional
 *      imported.stub-* tokens the stub's root binds — a correctly-sized,
 *      correctly-colored box (per-variant via the stub's own axes), never
 *      invented anatomy. Slot design-time content becomes defaultContent
 *      carrying the stub.
 *
 *   3. PREFERRED VALUES → slot `accepts`
 *      INSTANCE_SWAP preferredValues (component keys, dump v1.5
 *      swapPreferredValues) resolve through the session key index into
 *      slot `accepts` (acceptsMode 'prefer'); unresolvable keys stay a
 *      NAMED note carrying the keys verbatim.
 *
 * Fixtures: extract/fidelity-matrix/fixtures/{shoelace-button-group,
 * eventz-button}/dump.json — REST captures remapped at dump v1.5.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitHtml } from '../../core/emit-html.js';
import { proposeFromDump, type MinimalChildContract } from '../../core/propose-figma.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';
import { loadTokenCorpus } from './tokens.js';
import type { DumpFile, DumpSet } from './types.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

const corpus = loadTokenCorpus(ROOT);
const contracts = new Map<string, Contract>();
for (const file of ['button', 'badge']) {
  const c = ContractSchema.parse(read(`contracts/${file}.contract.json`));
  contracts.set(c.id, c);
}
const repoButton = contracts.get('ds.button')!;
const contractIdByName = new Map([...contracts.values()].map((c) => [c.name, c.id]));
const contractIdByKey = new Map(
  [...contracts.values()]
    .filter((c) => c.anchors.figma.componentSetKey !== null)
    .map((c) => [c.anchors.figma.componentSetKey!, c.id]),
);

const shoelaceDump = read('extract/fidelity-matrix/fixtures/shoelace-button-group/dump.json') as DumpFile;
const shoelaceSet = shoelaceDump['Button group'] as DumpSet;
const eventzDump = read('extract/fidelity-matrix/fixtures/eventz-button/dump.json') as DumpFile;
const eventzSet = eventzDump['Button'] as DumpSet;

const childInstance = shoelaceSet.variants[0].children!.find((c) => c.type === 'INSTANCE')!;
const childSetKey = childInstance.instanceSetKey!;

// ---------------------------------------------------------------------------
console.log('\n1. Key-based session linking (rename-safe)');
// ---------------------------------------------------------------------------

check('fixture: the nested "Button" instance carries its owning set key (dump v1.5)', typeof childSetKey === 'string' && childSetKey.length > 0);
check(
  `fixture: the key CONTRADICTS the repo ds.button anchor (${childSetKey.slice(0, 8)}… vs ${String(repoButton.anchors.figma.componentSetKey).slice(0, 8)}…)`,
  repoButton.anchors.figma.componentSetKey !== null && repoButton.anchors.figma.componentSetKey !== childSetKey,
);

const propose = (set: DumpSet, extra?: { byKey?: Map<string, string>; byId?: Map<string, MinimalChildContract> }) =>
  proposeFromDump(JSON.parse(JSON.stringify(set)) as DumpSet, {
    corpus,
    contractIdByName,
    contractIdByKey: new Map([...contractIdByKey, ...(extra?.byKey ?? new Map())]),
    contractsById: new Map<string, MinimalChildContract>([...contracts, ...(extra?.byId ?? new Map())]),
    fileKey: 'fixture',
    mintUnbound: true,
  });

// (a) name coincidence REFUSED: "Button" name-matches ds.button, keys differ.
const refused = propose(shoelaceSet);
const refusedAnatomy = JSON.stringify(refused.contract);
check(
  'name-coincidence link REFUSED by key contradiction (no component ref to ds.button)',
  !refusedAnatomy.includes('"id":"ds.button"') &&
    refused.notes.some((n) => n.includes('keys CONTRADICT') && n.includes('ds.button')),
);
check(
  'the stub id is suffixed PAST the contradicting in-scope contract (ds.button-2, never ds.button)',
  (refused.childStubs ?? []).some((s) => (s as { id?: string }).id === 'ds.button-2') &&
    refusedAnatomy.includes('"id":"ds.button-2"'),
);

// (b) RENAME-SAFE link: a session contract with a DIFFERENT name but the
// SAME componentSetKey — the instance links to it by key.
const renamed = ContractSchema.parse({
  ...JSON.parse(JSON.stringify(read('contracts/button.contract.json'))),
  id: 'sl.totally-renamed-button',
  name: 'TotallyRenamedButton',
  anchors: {
    figma: { fileKey: 'fixture', componentSetKey: childSetKey, nodeId: null },
    code: { importPath: 'src/components/TotallyRenamedButton', export: 'TotallyRenamedButton' },
  },
});
const linked = propose(shoelaceSet, {
  byKey: new Map([[childSetKey, renamed.id]]),
  byId: new Map([[renamed.id, renamed]]),
});
check(
  'same key + DIFFERENT name LINKS (rename-safe): component ref → sl.totally-renamed-button',
  JSON.stringify(linked.contract).includes('"id":"sl.totally-renamed-button"') &&
    linked.notes.some((n) => n.includes('LINKED to sl.totally-renamed-button by componentSetKey')),
);
check('no ds.button-2 stub when the key resolves', !(linked.childStubs ?? []).some((s) => (s as { id?: string }).id === 'ds.button-2'));

// ---------------------------------------------------------------------------
console.log('\n2. Stub geometry (honest observed box)');
// ---------------------------------------------------------------------------

const stub = ContractSchema.parse((refused.childStubs ?? []).find((s) => (s as { id?: string }).id === 'ds.button-2'));
const stubTokens = (stub.anatomy.root.tokens ?? {}) as Record<string, string>;
check(
  'stub root binds minted geometry per the STUB\'S OWN axes (width/height substitute {size})',
  stubTokens.width === '{imported.stub-button-2.root.width.{size}}' &&
    stubTokens.height === '{imported.stub-button-2.root.height.{size}}',
);
check(
  'primary paint rides the variant axis (background-color substitutes {variant})',
  stubTokens['background-color'] === '{imported.stub-button-2.root.background-color.{variant}}',
);
check(
  'minted leaves carry the OBSERVED values (small width 44px, large 82px, default fill #ffffff)',
  (refused.mintedTokens?.entries ?? []).some((e) => e.ref === '{imported.stub-button-2.root.width.small}' && e.value === '44px') &&
    (refused.mintedTokens?.entries ?? []).some((e) => e.ref === '{imported.stub-button-2.root.width.large}' && e.value === '82px') &&
    (refused.mintedTokens?.entries ?? []).some((e) => e.ref === '{imported.stub-button-2.root.background-color.default}' && e.value === '#ffffff'),
);
check(
  'the parent\'s applied props THREAD the axes ("{size}"/"{type}" per variant, ComponentRefSchema)',
  JSON.stringify(refused.contract).includes('"size":"{size}"') &&
    JSON.stringify(refused.contract).includes('"variant":"{type}"'),
);
check(
  'inconsistent stroke is NAMED, never faked (border not carried on the stub geometry)',
  refused.notes.some((n) => n.includes('border not carried on the stub geometry')),
);

// The stub renders: emit-html compiles the geometry to per-size rules.
{
  const parent = ContractSchema.parse(refused.contract);
  const scope = new Map<string, Contract>([[parent.id, parent], [stub.id, stub], ...contracts]);
  const trees: unknown[] = [
    read('tokens/primitives.tokens.json'),
    read('tokens/semantic.tokens.json'),
    read('tokens/modes/semantic.light.tokens.json'),
    refused.mintedTokens!.tree,
  ];
  const { css, html } = emitHtml(parent, { tokens: tokenInventoryFromJson(trees), icons: new Map(), contracts: scope });
  check(
    'emit-html: the stub box renders per size (.button--size-small { width: var(--imported-stub-button-2-root-width-small) })',
    css.includes('.button--size-small {') && css.includes('width: var(--imported-stub-button-2-root-width-small)'),
  );
  check(
    'emit-html: the stub renders its OBSERVED label text, and never its contract name',
    html.includes('>Label<') && !/>\s*Button\s*</.test(html.replaceAll('button-group', '')),
  );
}

// Eventz icons: slot design-time content → defaultContent stub with geometry.
const eventz = propose(eventzSet);
const eventzJson = JSON.stringify(eventz.contract);
check(
  'eventz: slot design-time content proposed as defaultContent (startIcon → ds.play stub)',
  eventzJson.includes('"defaultContent":[{"id":"ds.play"}]') && eventzJson.includes('"defaultContent":[{"id":"ds.pause"}]'),
);
const playStub = (eventz.childStubs ?? []).find((s) => (s as { id?: string }).id === 'ds.play') as { anatomy?: { root?: { tokens?: Record<string, string> } } };
check(
  'eventz: the icon stub carries the observed 20×20 box (minted uniform width/height)',
  playStub?.anatomy?.root?.tokens?.width === '{imported.stub-play.root.width}' &&
    (eventz.mintedTokens?.entries ?? []).some((e) => e.ref === '{imported.stub-play.root.width}' && e.value === '20px'),
);
check(
  'eventz: hasStartIcon/hasEndIcon default TRUE from the BOOLEAN property definitions (dump v1.5 boolDefaults)',
  eventz.notes.filter((n) => n.includes("default true: the property definition's defaultValue")).length >= 2,
);

// ---------------------------------------------------------------------------
console.log('\n3. INSTANCE_SWAP preferredValues → slot accepts');
// ---------------------------------------------------------------------------

const prefKey = (eventzSet.swapPreferredValues?.startIcon ?? [])[0]?.key;
check('fixture: startIcon/endIcon carry preferredValues component keys (dump v1.5)', typeof prefKey === 'string' && prefKey.length > 0);
check(
  'unresolvable keys stay a NAMED note carrying the keys verbatim (no accepts invented)',
  !eventzJson.includes('"accepts"') &&
    eventz.notes.some((n) => n.includes('preferredValues name') && n.includes(prefKey!)),
);

// Register a contract holding the preferred key → accepts resolves.
const iconContract = ContractSchema.parse({
  ...JSON.parse(JSON.stringify(read('contracts/badge.contract.json'))),
  id: 'ev.icon',
  name: 'EvIcon',
  anchors: {
    figma: { fileKey: 'fixture', componentSetKey: prefKey!, nodeId: null },
    code: { importPath: 'src/components/EvIcon', export: 'EvIcon' },
  },
});
const eventzLinked = propose(eventzSet, {
  byKey: new Map([[prefKey!, iconContract.id]]),
  byId: new Map([[iconContract.id, iconContract]]),
});
const linkedJson = JSON.stringify(eventzLinked.contract);
check(
  'with the key in scope, accepts resolves: slot accepts ["ev.icon"], acceptsMode "prefer"',
  linkedJson.includes('"accepts":["ev.icon"]') && linkedJson.includes('"acceptsMode":"prefer"'),
);
check(
  'the resolution is NAMED (preferredValues → accepts note)',
  eventzLinked.notes.some((n) => n.includes('accepts proposed from INSTANCE_SWAP preferredValues') && n.includes('ev.icon')),
);

// ---------------------------------------------------------------------------
console.log('');
if (failures.length > 0) {
  console.error(`✖ ${failures.length} composite-children invariant(s) failed`);
  process.exit(1);
}
console.log('✔ all composite-children invariants hold (key linking rename-safe + contradiction-refused, stub geometry minted/threaded/rendered, preferredValues → accepts)');
