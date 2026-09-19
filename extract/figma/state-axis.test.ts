// A DESIGNER'S INTERACTION-STATE VARIANT AXIS (docs/23 §D.41).
//
// A designer draws what the platform RUNS — :hover, :focus-visible, :active,
// native disabled — as a variant axis ("State = Default | Hover | Focus |
// Disabled"). Exact mode refused every such set
// (EXACT_SEMANTIC_PROJECTION_AMBIGUOUS): measured read-only, CBDS Checkbox-icon
// and Altitude Menu Item (the two children PR 130's sparse path was opened for),
// Altitude Chip, Link, Toggle, CBDS Toggle. What made it ambiguous was never
// the value table — it was not knowing WHOSE axis it is. With PR 130's positive
// designer fact (no ds_contracts stamp AND a reader that could have seen one)
// the projection is a table lookup; without it the refusal stands, by name.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump } from './rest/map.js';
import { proposeBatchFromDump, proposeFromDump, SparseMatrixInferenceError, ExactProjectionError } from '../../core/propose-figma.js';
import { INTERACTION_STATE_BY_VALUE, interactionStateOf, readStateAxes, readStateAxis } from '../../core/interaction-state-axis.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import { emitReact, validateContract } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { tokenInventoryFromJson } from '../../core/index.js';
import { planVariant } from './visual-parity/match.js';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpSet } from './types.js';

// ---------------------------------------------------------------------------
// 1. the closed table — one reader
// ---------------------------------------------------------------------------
test('the table: every value, case/space/underscore-insensitive and EXACT per token', () => {
  assert.deepEqual(INTERACTION_STATE_BY_VALUE, {
    default: 'default', hover: 'hover', active: 'active', pressed: 'active', focus: 'focus-visible', 'focus-visible': 'focus-visible', disabled: 'disabled',
  });
  for (const [spelled, state] of [
    ['Default', 'default'], ['default', 'default'], [' DEFAULT ', 'default'],
    ['Hover', 'hover'], ['Active', 'active'], ['Pressed', 'active'],
    ['Focus', 'focus-visible'], ['Focus Visible', 'focus-visible'], ['focus_visible', 'focus-visible'], ['FOCUS-VISIBLE', 'focus-visible'],
    ['Disabled', 'disabled'],
  ] as const) assert.equal(interactionStateOf(spelled), state, spelled);
  // No fuzzy matching, no prototype keys: a near-miss is simply not in the table.
  for (const outside of ['Focused', 'Hovered', 'Rest', 'Enabled', 'Normal', 'Error', 'Selected', 'Loading', 'Open', 'Filled', 'diabled', 'Hover ed', 'constructor', 'toString', ''])
    assert.equal(interactionStateOf(outside), undefined, outside);
});

test('the reader: a projected axis keeps the designer\'s spelling and order; every refusal names the value or condition that stopped it', () => {
  const ok = readStateAxis('State', ['Default', 'Disabled', 'Focus']);
  assert.deepEqual(ok, { kind: 'projected', projection: { property: 'State', restValue: 'Default', values: [
    { value: 'Default', state: 'default' }, { value: 'Disabled', state: 'disabled' }, { value: 'Focus', state: 'focus-visible' }] } });
  // A NAMED axis, one value short of the rule: projected (Altitude Chip: State = Default | Focus).
  assert.equal(readStateAxis('state', ['Default', 'Focus']).kind, 'projected');
  const refused = (property: string, values: string[]) => { const r = readStateAxis(property, values); assert.equal(r.kind, 'refused', `${property} ${values}`); return r as Extract<typeof r, { kind: 'refused' }>; };
  for (const extra of ['error', 'selected', 'loading', 'open', 'Focused']) {
    const r = refused('state', ['default', 'hover', extra]);
    assert.equal(r.reason, 'state-axis-value-outside-vocabulary');
    assert.ok(r.detail.includes(`"${extra}"`), 'the value that stopped it is spelled');
    assert.ok(!r.detail.includes('"hover"'), 'and only that value');
  }
  assert.equal(refused('State', ['Hover', 'Focus']).reason, 'state-axis-no-rest-value');
  assert.equal(refused('State', ['Default']).reason, 'state-axis-no-state-value');
  assert.equal(refused('Interaction', ['Default', 'Hover']).reason, 'state-axis-unnamed-incomplete');
  assert.equal(readStateAxis('Interaction', ['Default', 'Hover', 'Pressed']).kind, 'projected', 'unnamed, but two non-rest states');
  const dup = refused('State', ['Default', 'Pressed', 'Active']);
  assert.equal(dup.reason, 'state-axis-duplicate-state');
  assert.match(dup.detail, /"Pressed" and "Active" both mean contract state "active"/);
  // An axis that neither says "state" nor is purely table values is API: nothing is said.
  assert.deepEqual(readStateAxis('Tone', ['Default', 'Danger']), { kind: 'not-a-state-axis' });
  assert.deepEqual(readStateAxis('Size', ['S', 'L']), { kind: 'not-a-state-axis' });
  // Two pure state axes on one set: which one the platform runs is not drawn.
  const two = readStateAxes([{ property: 'State', values: ['Default', 'Hover'] }, { property: 'Interaction', values: ['Default', 'Pressed', 'Focus'] }]);
  assert.ok(two.kind === 'refused' && two.reason === 'state-axis-multiple');
  assert.ok(two.kind === 'refused' && /"State" and "Interaction"/.test(two.detail));
});

// ---------------------------------------------------------------------------
// 2. the proposer, on synthetic DESIGNER sets (REST shape)
// ---------------------------------------------------------------------------
const SOLID = (hex: string) => [{ type: 'SOLID', color: { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: 1 } }];
type Cell = { at: Record<string, string>; fill: string; padding?: number; opacity?: number };
const restVariant = (id: string, name: string, c: Cell) => ({ id, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL',
  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingTop: 4, paddingBottom: 4, paddingLeft: c.padding ?? 8, paddingRight: c.padding ?? 8,
  absoluteBoundingBox: { x: 0, y: 0, width: 40 + 2 * (c.padding ?? 8), height: 24 }, fills: SOLID(c.fill), ...(c.opacity === undefined ? {} : { opacity: c.opacity }), children: [] });
const designerSet = (name: string, axes: Record<string, string[]>, cells: Cell[], extraDefinitions: Record<string, unknown> = {}): DumpSet => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: {
    id: '1:1', name, type: 'COMPONENT_SET',
    componentPropertyDefinitions: { ...Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, { type: 'VARIANT', defaultValue: v[0], variantOptions: v }])), ...extraDefinitions },
    children: cells.map((c, i) => restVariant(`1:${i + 2}`, Object.entries(c.at).map(([k, v]) => `${k}=${v}`).join(', '), c)),
  } } } } as never);
  return (result.dump as unknown as Record<string, DumpSet>)[name];
};
const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const opts = (projectionMode: 'exact' | 'reviewable-inversion', stampsObservable: boolean) => ({ corpus, contractIdByName: new Map(), fileKey: null, projectionMode, mintUnbound: true, stampsObservable });
/** A DESIGNER's set: unstamped, read by a reader that COULD have seen a stamp (what extract/figma/rest/fetch.ts records). */
const exact = (set: DumpSet, stampsObservable = true) => proposeFromDump(set, opts('exact', stampsObservable));
const refusalOf = (run: () => unknown): ExactProjectionError => {
  try { run(); } catch (e) { assert.ok(e instanceof ExactProjectionError, String(e)); return e; }
  throw new Error('expected a refusal');
};
const refusalsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors; };

const REST = { A: 'cc0000', B: '00aa00' } as Record<string, string>;
const BY_STATE: Record<string, Record<string, string>> = {
  Default: REST, Hover: { A: '990000', B: '007700' }, Pressed: { A: '660000', B: '004400' }, Focus: { A: 'cc0044', B: '00aa44' }, Disabled: { A: 'cccccc', B: 'cccccc' },
};
const pillCells = (states: string[], keep: (state: string, tone: string) => boolean = () => true): Cell[] =>
  states.flatMap((State) => ['A', 'B'].filter((Tone) => keep(State, Tone)).map((Tone) => ({ at: { State, Tone }, fill: BY_STATE[State][Tone] })));
const ALL = ['Default', 'Hover', 'Pressed', 'Focus', 'Disabled'];

test('exact: a designer\'s full State axis is PROJECTED — every table value lands on the contract\'s own state vocabulary, the axis is not a prop, the decision is named', () => {
  const set = designerSet('Pill', { State: ALL, Tone: ['A', 'B'] }, pillCells(ALL));
  assert.equal(set.variants.length, 10);
  const result = exact(set);
  assert.equal(result.projection.status, 'verified-exact');
  assert.equal(result.projection.status === 'verified-exact' && result.projection.observedCount, 10, 'all ten source rows are accounted for, exactly');
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.states, ['hover', 'active', 'focus-visible', 'disabled']);
  assert.deepEqual(contract.props.map((p) => [p.name, p.bindings.figma.kind]), [['tone', 'VARIANT'], ['disabled', 'BOOLEAN']], 'State is NOT a prop; Disabled is the boolean the contract already models disabled with');
  assert.deepEqual(Object.keys(contract.anatomy.root.states ?? {}), ['hover', 'active', 'focus-visible', 'disabled']);
  for (const s of ['hover', 'active', 'focus-visible']) assert.match((contract.anatomy.root.states as Record<string, Record<string, string>>)[s]['background-color'], /\{tone\}/, `${s} is read per Tone, against the rest plane`);
  assert.deepEqual(refusalsOf(contract), []);
  assert.deepEqual(result.stateAxisProjection, {
    decision: 'designer-state-axis-projected', property: 'State', restValue: 'Default', undrawnStateCells: [],
    values: [
      { value: 'Default', state: 'default', carried: true }, { value: 'Hover', state: 'hover', carried: true }, { value: 'Pressed', state: 'active', carried: true },
      { value: 'Focus', state: 'focus-visible', carried: true }, { value: 'Disabled', state: 'disabled', carried: true },
    ],
  });
  const note = result.notes.find((n) => n.startsWith('state-axis-projected (DECISION designer-state-axis-projected, docs/23 §D.41)'));
  assert.ok(note, 'the decision is a note too');
  for (const spelled of ['Default→rest', 'Hover→hover', 'Pressed→active', 'Focus→focus-visible', 'Disabled→the `disabled` boolean prop + the disabled state block']) assert.ok(note!.includes(spelled), spelled);
  // Reviewable inversion derives the SAME contract, and now proves the same matrix.
  const reviewable = proposeFromDump(set, opts('reviewable-inversion', true));
  assert.deepEqual(reviewable.contract, result.contract);
  assert.equal(reviewable.projection.status, 'verified-exact');
});

test('exact: a state whose drawing carries nothing is NAMED, not dropped in silence — carried:false on the decision, the rows still accounted for', () => {
  // Hover is drawn identically to Default.
  const cells = pillCells(['Default', 'Hover', 'Focus']).map((c) => (c.at.State === 'Hover' ? { ...c, fill: REST[c.at.Tone] } : c));
  const result = exact(designerSet('Pill', { State: ['Default', 'Hover', 'Focus'], Tone: ['A', 'B'] }, cells));
  assert.equal(result.projection.status, 'verified-exact');
  assert.deepEqual(ContractSchema.parse(result.contract).states, ['focus-visible']);
  assert.deepEqual(result.stateAxisProjection?.values.map((v) => [v.value, v.carried]), [['Default', true], ['Hover', false], ['Focus', true]]);
  assert.ok(result.notes.some((n) => n.startsWith('state "hover": promoted from the axis but no root or part override was recoverable')));
  assert.ok(result.notes.some((n) => n.includes('Hover→hover (NOT carried: no override recoverable, named below)')));
});

test('exact: WHOSE axis it is decides — without the designer fact the refusal stands, in its old words plus the missing half', () => {
  const set = designerSet('Pill', { State: ALL, Tone: ['A', 'B'] }, pillCells(ALL));
  const unobservable = refusalOf(() => exact(set, false));
  assert.equal(unobservable.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.ok(unobservable.message.startsWith('Exact proposal cannot promote variant axis "State" to interaction-state semantics because that changes the authoritative Figma variant projection.'), 'the sentence every receipt quotes is unchanged');
  assert.match(unobservable.message, /state-axis-stamps-not-observable: /);
  // A set THIS PIPELINE stamped, with no statePreviewAxis declaration for the axis: not a designer's, not a readable preview.
  const stamped = refusalOf(() => exact({ ...set, contractId: 'ds.pill' } as DumpSet));
  assert.equal(stamped.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(stamped.message, /state-axis-pipeline-drawn-undeclared: /);
  // Reviewable inversion without the fact is what it always was: promoted, unverified.
  const legacy = proposeFromDump(set, opts('reviewable-inversion', false));
  assert.equal(legacy.projection.status, 'legacy-unverified');
  assert.equal(legacy.stateAxisProjection, undefined);
  assert.deepEqual(legacy.contract, exact(set).contract, 'the same table either way — only the evidence differs');
  // The batch derives the fact from the dump's own provenance and names the refusal in the skip.
  const batch = proposeBatchFromDump({ Pill: set } as never, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true });
  assert.equal(batch.proposals.length, 0);
  assert.match(batch.skipped[0].detail ?? batch.skipped[0].reason, /state-axis-stamps-not-observable|EXACT_SEMANTIC_PROJECTION_AMBIGUOUS/);
});

test('exact: every condition that is not a table lookup refuses by name — never a guess', () => {
  // Two values, one contract state.
  const dupStates = ['Default', 'Pressed', 'Active'];
  const dup = refusalOf(() => exact(designerSet('Pill', { State: dupStates, Tone: ['A', 'B'] },
    dupStates.flatMap((State) => ['A', 'B'].map((Tone) => ({ at: { State, Tone }, fill: State === 'Default' ? REST[Tone] : State === 'Pressed' ? '660000' : '440000' }))))));
  assert.equal(dup.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(dup.message, /state-axis-duplicate-state: .*"Pressed" and "Active" both mean contract state "active"/);
  // Two pure state axes.
  const two = refusalOf(() => exact(designerSet('Pill', { State: ['Default', 'Hover'], Interaction: ['Default', 'Pressed', 'Focus'] },
    ['Default', 'Hover'].flatMap((State) => ['Default', 'Pressed', 'Focus'].map((Interaction) => ({ at: { State, Interaction }, fill: State === 'Hover' ? '990000' : Interaction === 'Default' ? 'cc0000' : '660000' }))))));
  assert.equal(two.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(two.message, /state-axis-multiple: .*"State" and "Interaction"/);
  // The set ALREADY has a `Disabled` boolean property AND draws State=Disabled: two spellings of one fact.
  const veil = (id: string) => ({ id, name: 'veil', type: 'RECTANGLE', visible: false, componentPropertyReferences: { visible: 'Disabled#9:1' }, absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 }, fills: SOLID('ffffff') });
  const mapped = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: { id: '1:1', name: 'Pill', type: 'COMPONENT_SET',
    componentPropertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover', 'Disabled'] }, 'Disabled#9:1': { type: 'BOOLEAN', defaultValue: false } },
    children: ['Default', 'Hover', 'Disabled'].map((State, i) => ({ ...restVariant(`1:${i + 2}`, `State=${State}`, { at: { State }, fill: BY_STATE[State].A }), children: [veil(`1:${i + 2}9`)] })) } } } } as never);
  const collision = refusalOf(() => exact((mapped.dump as unknown as Record<string, DumpSet>).Pill));
  assert.equal(collision.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(collision.message, /state-axis-disabled-prop-collision: "State=Disabled" projects to the `disabled` boolean, but the set already carries a `disabled` boolean property/);
});

test('exact: a value OUTSIDE the table keeps the axis as the designer\'s own enum prop, and the note names the value — nothing is projected, nothing is refused', () => {
  const states = ['Default', 'Hover', 'Error'];
  const result = exact(designerSet('Field', { State: states, Tone: ['A', 'B'] },
    states.flatMap((State) => ['A', 'B'].map((Tone) => ({ at: { State, Tone }, fill: State === 'Error' ? 'ff0000' : State === 'Hover' ? '990000' : REST[Tone] })))));
  assert.equal(result.projection.status, 'verified-exact');
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.props.map((p) => p.name), ['state', 'tone']);
  assert.deepEqual(contract.states, []);
  assert.equal(result.stateAxisProjection, undefined);
  assert.ok(result.notes.some((n) => /variant axis "State": named like an interaction-state axis but value\(s\) Error are outside the interaction-state vocabulary/.test(n)));
});

// ---------------------------------------------------------------------------
// 3. sparse + a state axis (PR 130's declaration vocabulary stays valid)
// ---------------------------------------------------------------------------
test('sparse, hole ONLY in a non-rest state (the measured shape: CBDS Checkbox-icon, Altitude Menu Item): nothing is declared on the contract, the cells ride the decision, the matrix is exact', () => {
  const states = ['Default', 'Hover', 'Disabled'];
  const set = designerSet('Pill', { State: states, Tone: ['A', 'B'] }, pillCells(states, (s, t) => !(s === 'Disabled' && t === 'B')));
  assert.equal(set.variants.length, 5);
  const result = exact(set);
  assert.equal(result.projection.status, 'verified-exact');
  assert.equal(result.projection.status === 'verified-exact' && result.projection.observedCount, 5);
  const contract = ContractSchema.parse(result.contract);
  assert.equal('absentVariants' in (result.contract.bindings as { figma: object }).figma, false, 'every Tone is drawn at rest: no PROP combination is missing');
  assert.equal(contract.bindings.figma.statePreviews, true);
  assert.deepEqual(result.stateAxisProjection?.undrawnStateCells, [{ State: 'Disabled', Tone: 'B' }]);
  assert.deepEqual(refusalsOf(contract), []);
  const note = result.notes.find((n) => n.startsWith('bindings.figma.absentVariants + a projected state axis: the set draws 5 of the 6 combinations'));
  assert.ok(note?.includes('the contract declares NO absent variant'));
  assert.ok(note?.includes('state-axis-undrawn-state-cells: 1 combination(s) are undrawn ONLY in a non-rest state (State=Disabled, Tone=B)'));
  assert.ok(note?.includes('undrawn-combination-rendered-by-composition'));
  // Reviewable inversion, with the fact, derives the same; without it the ragged refusal stands in both modes.
  assert.deepEqual(proposeFromDump(set, opts('reviewable-inversion', true)).contract, result.contract);
  for (const mode of ['exact', 'reviewable-inversion'] as const)
    assert.equal(refusalOf(() => proposeFromDump(set, opts(mode, false))).code, 'EXACT_MATRIX_RAGGED', `${mode}: "unstamped" proves nothing when no stamp was observable`);
});

const gridCells = (keep: (state: string, tone: string, size: string) => boolean, fillOf: (state: string, tone: string, size: string) => string): Cell[] =>
  ['Default', 'Hover'].flatMap((State) => ['A', 'B'].flatMap((Tone) => ['S', 'L'].filter((Size) => keep(State, Tone, Size)).map((Size) => ({ at: { State, Tone, Size }, fill: fillOf(State, Tone, Size), padding: Size === 'S' ? 8 : 16 }))));
const GRID = { State: ['Default', 'Hover'], Tone: ['A', 'B'], Size: ['S', 'L'] };

test('sparse, hole in the REST plane and in every state: the contract declares it over the REMAINING axes (a valid absentVariants), and state previews are not composed with it', () => {
  const set = designerSet('Tag', GRID, gridCells((_s, t, z) => !(t === 'B' && z === 'L'), (s, t) => (s === 'Hover' ? BY_STATE.Hover[t] : REST[t])));
  assert.equal(set.variants.length, 6);
  const result = exact(set);
  assert.equal(result.projection.status, 'verified-exact');
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.bindings.figma.absentVariants, [{ tone: 'b', size: 'l' }], 'keyed by the contract\'s own props — the state axis is not one and does not appear');
  assert.equal(contract.bindings.figma.statePreviews, undefined);
  assert.deepEqual(contract.states, ['hover']);
  assert.deepEqual(refusalsOf(contract), [], 'absent-variants-with-state-previews never fires');
  assert.deepEqual(result.stateAxisProjection?.undrawnStateCells, []);
  assert.ok(result.notes.some((n) => n.startsWith('bindings.figma.statePreviews NOT set: the contract declares bindings.figma.absentVariants')));
  assert.ok(result.notes.some((n) => n.includes('1 combination(s) of the REMAINING axes are undrawn in the rest state ("State=Default") and in every other state — DECLARED on the contract (Size=L, Tone=B)') || n.includes('DECLARED on the contract (Tone=B, Size=L)')));
});

test('sparse, a state drawn where its rest cell is NOT: refused by name (state-axis-orphan-state-cell) — a state is read against its rest variant, and there is none', () => {
  const set = designerSet('Tag', GRID, gridCells((s, t, z) => !(s === 'Default' && t === 'B' && z === 'L'), (s, t) => (s === 'Hover' ? BY_STATE.Hover[t] : REST[t])));
  const refused = refusalOf(() => exact(set));
  assert.equal(refused.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(refused.message, /state-axis-orphan-state-cell: 1 state variant\(s\) are drawn where the rest state \("State=Default"\) is not \(State=Hover at /);
});

test('sparse, the fence holds INSIDE a state plane: a hover fill two axes explain equally, split by the undrawn hover cells, refuses the set by name', () => {
  // Rest plane full and uniform. Hover draws only A×S and B×L, with different fills:
  // a function of Tone and equally of Size, and they disagree at the undrawn A×L.
  const set = designerSet('Chip', GRID,
    gridCells((s, t, z) => s === 'Default' || (t === 'A' && z === 'S') || (t === 'B' && z === 'L'), (s, t) => (s === 'Hover' ? BY_STATE.Hover[t] : 'cc0000')));
  assert.equal(set.variants.length, 6);
  assert.throws(() => exact(set), (error: unknown) => {
    assert.ok(error instanceof SparseMatrixInferenceError, String(error));
    assert.equal(error.code, 'sparse-matrix-inference-ambiguous');
    assert.match(error.message, /a function of "Tone" and equally of "Size" on every drawn variant/);
    return true;
  });
  // The same holes with a UNIFORM hover fill infer nothing per axis: proposes, holes on the decision.
  const uniform = exact(designerSet('Chip', GRID, gridCells((s, t, z) => s === 'Default' || (t === 'A' && z === 'S') || (t === 'B' && z === 'L'), (s) => (s === 'Hover' ? '990000' : 'cc0000'))));
  assert.equal(uniform.projection.status, 'verified-exact');
  assert.deepEqual(uniform.stateAxisProjection?.undrawnStateCells.map((t) => `${t.Tone}${t.Size}`).sort(), ['AL', 'BS']);
});

// ---------------------------------------------------------------------------
// 4. the writer round trip — a designer's axis and a pipeline preview axis are never confused
// ---------------------------------------------------------------------------
type CanvasNode = { name: string; type: string; children: CanvasNode[]; getSharedPluginData(ns: string, key: string): string };
async function canvas(tokens: Record<string, unknown>) {
  const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(engine.buildTokensScript(null));
  const write = async (c: Contract) => {
    await run(engine.buildComponentScript(c, new Map([[c.id, c]])));
    type Found = { type: string; getSharedPluginData(ns: string, key: string): string };
    return root.findOne((n: Found) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as unknown as CanvasNode;
  };
  const read = async (node: CanvasNode) => {
    const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
      .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`);
    const dumps = await run(source) as Record<string, unknown>;
    return JSON.parse(JSON.stringify(dumps[node.name])) as DumpSet;
  };
  return { write, read };
}

test('round trip: the contract a designer\'s State axis proposes is WRITTEN as this pipeline\'s stamped preview axis and proposes back to itself — by the declared path, never the designer path', async () => {
  const states = ['Default', 'Hover', 'Focus'];
  const first = exact(designerSet('Pill', { State: states, Tone: ['A', 'B'] }, pillCells(states)));
  const c1 = ContractSchema.parse(first.contract);
  assert.equal(c1.bindings.figma.statePreviews, true);
  assert.ok(first.mintedTokens, 'literal paints minted');
  const { write, read } = await canvas(first.mintedTokens!.tree);
  const node = await write(c1);
  assert.deepEqual(node.children.map((v) => v.name).sort(), ['Tone=A, State=Default', 'Tone=A, State=Focus Visible', 'Tone=A, State=Hover', 'Tone=B, State=Default', 'Tone=B, State=Focus Visible', 'Tone=B, State=Hover'].sort(),
    'the writer\'s own spelling: State = Default | Hover | Focus Visible');
  const set = await read(node);
  assert.ok((set as { statePreviewAxis?: unknown }).statePreviewAxis, 'the set DECLARES its preview axis (dump v1.21) and carries the contract-id stamp');
  const writerCorpus = tokenCorpusFromJson({ primitives: first.mintedTokens!.tree, semantic: {}, light: {}, brandDefault: {} });
  const back = proposeFromDump(set, { corpus: writerCorpus, contractIdByName: new Map([[c1.name, c1.id]]), contractsById: new Map([[c1.id, c1 as never]]), fileKey: null, projectionMode: 'exact', mintUnbound: false });
  assert.equal(back.projection.status, 'verified-exact');
  assert.equal(back.stateAxisProjection, undefined, 'a pipeline-drawn preview axis is read back by its declaration, not projected as a designer\'s');
  const c2 = ContractSchema.parse(back.contract);
  assert.deepEqual(c2.states, c1.states);
  assert.deepEqual(c2.props.map((p) => [p.name, p.type, p.default]), c1.props.map((p) => [p.name, p.type, p.default]));
  assert.deepEqual(c2.anatomy.root.states, c1.anatomy.root.states);
  assert.deepEqual(c2.anatomy.root.tokens, c1.anatomy.root.tokens);
  assert.equal(c2.bindings.figma.statePreviews, true);
  // The SAME canvas with its stamps stripped, through a reader that could not have seen them, is NOT taken for a designer's.
  const { statePreviewAxis: _a, contractId: _b, propNames: _c, semantics: _d, ...bare } = set as DumpSet & Record<string, unknown>;
  const refused = refusalOf(() => proposeFromDump(bare as DumpSet, { corpus: writerCorpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: false, stampsObservable: false }));
  assert.equal(refused.code, 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS');
  assert.match(refused.message, /state-axis-stamps-not-observable/);
});

// ---------------------------------------------------------------------------
// 5. the generated React BEHAVES, and a harness can mount every Figma variant
// ---------------------------------------------------------------------------
test('emitted React: the states plane renders as the platform\'s own pseudo-classes and disabled as the native attribute — no `state` prop exists', () => {
  const result = exact(designerSet('Pill', { State: ALL, Tone: ['A', 'B'] }, pillCells(ALL)));
  const contract = ContractSchema.parse(result.contract);
  assert.equal(contract.semantics.element, 'button', 'an interaction-state axis is the structural evidence of an interactive element');
  const inventory = tokenInventoryFromJson([result.mintedTokens!.tree]);
  const { tsx, css } = emitReact(contract, { tokens: inventory, icons: new Map(), contracts: new Map([[contract.id, contract]]) });
  for (const selector of ['.tone-a:hover:not(:disabled)', '.tone-b:hover:not(:disabled)', '.tone-a:active:not(:disabled)', '.tone-a:focus-visible', '.root:disabled'])
    assert.ok(css.includes(`${selector} {`), `${selector} in\n${css}`);
  assert.ok(!/\bstate\b\??:/.test(tsx), 'no state prop in the component API');
  assert.match(tsx, /disabled\?: boolean/);
  assert.match(tsx, /disabled=\{disabled\}/, 'the native attribute, so :disabled matches and the platform blocks interaction');
});

test('visual parity and the proposer read ONE table: a designer state variant plans as a real interaction, disabled as the prop', () => {
  const contract = ContractSchema.parse(exact(designerSet('Pill', { State: ALL, Tone: ['A', 'B'] }, pillCells(ALL))).contract);
  const plan = (name: string) => { const p = planVariant(contract, name); assert.ok(p.ok, name); return p as Extract<typeof p, { ok: true }>; };
  assert.deepEqual([plan('State=Hover, Tone=B').interaction, plan('State=Pressed, Tone=B').interaction, plan('State=Focus, Tone=B').interaction, plan('State=Default, Tone=B').interaction], ['hover', 'active', 'focus-visible', 'none']);
  assert.deepEqual(plan('State=Disabled, Tone=B').bools, { disabled: true });
  assert.deepEqual(plan('State=Hover, Tone=B').subst, { tone: 'b' });
});
