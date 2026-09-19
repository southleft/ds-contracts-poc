// bindings.figma.absentVariants — DECLARED UNDRAWN COMBINATIONS (docs/23 §D.40).
//
// A designer's component set is often not the full Cartesian product of its
// variant axes (measured read-only: CBDS Checkbox-icon 42 of 48, CBDS Alert 30
// of 40, Altitude Menu Item 16 of 18, Altitude Checkbox 26 of 30, Progress 10 of
// 16, Radio 18 of 20). The exact projection refused every one as
// EXACT_MATRIX_RAGGED. The contract may now DECLARE the undrawn combinations;
// nothing about exactness is relaxed — the matrix must equal the product minus
// the declaration, exactly — and an inference the missing cells make ambiguous
// refuses the set by name instead of being decided by axis order.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump } from './rest/map.js';
import {
  proposeBatchFromDump,
  proposeFromDump,
  SparseMatrixInferenceError,
  ExactProjectionError,
} from '../../core/propose-figma.js';
import { deriveAbsentVariants, validateExactVariantProjection, type ExactDumpSet } from '../../core/exact-projection.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import { emitReact, validateContract } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import type { DumpSet } from './types.js';

// ---------------------------------------------------------------------------
// 1. the exact projection
// ---------------------------------------------------------------------------
const definitions = {
  Tone: { type: 'VARIANT', defaultValue: 'A', variantOptions: ['A', 'B', 'C'] },
  Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S', 'L'] },
};
const row = (Tone: string, Size: string) => ({ name: `Tone=${Tone}, Size=${Size}`, variantProperties: { Tone, Size } });
const FULL = [row('A', 'S'), row('A', 'L'), row('B', 'S'), row('B', 'L'), row('C', 'S'), row('C', 'L')];
const SPARSE = FULL.filter((r) => r.name !== 'Tone=C, Size=L');
const matrix = (variants: typeof FULL): ExactDumpSet => ({ setName: 'Tag', type: 'COMPONENT_SET', propertyDefinitions: definitions, variants });
const C_L = [{ Tone: 'C', Size: 'L' }];

test('exact projection: a DECLARED sparse matrix is verified against the product minus the declaration, exactly', () => {
  const verified = validateExactVariantProjection(matrix(SPARSE), undefined, { absentVariants: C_L });
  assert.equal(verified.status, 'source-matrix-verified');
  assert.equal(verified.status === 'source-matrix-verified' && verified.expectedCount, 5);
  // …and the returned rows are held to the same five.
  assert.equal(validateExactVariantProjection(matrix(SPARSE), SPARSE, { absentVariants: C_L }).status, 'verified-exact');
  const returnedFull = validateExactVariantProjection(matrix(SPARSE), FULL, { absentVariants: C_L });
  assert.equal(returnedFull.status === 'refused' && returnedFull.code, 'EXACT_ROWS_EXTRA', 'a contract that would draw the undrawn cell does not round-trip');
});

test('exact projection: an UNDECLARED ragged source refuses EXACT_MATRIX_RAGGED exactly as before — the validator never infers a declaration', () => {
  const refused = validateExactVariantProjection(matrix(SPARSE));
  assert.equal(refused.status, 'refused');
  assert.ok(refused.status === 'refused');
  assert.equal(refused.code, 'EXACT_MATRIX_RAGGED');
  assert.equal(refused.refusals[0].message, 'Source matrix has 5 rows; Cartesian definitions require 6.', 'the message every existing receipt quotes is unchanged');
  assert.deepEqual(validateExactVariantProjection(matrix(SPARSE), undefined, {}), refused);
  // A full matrix is untouched by the option being absent.
  assert.equal(validateExactVariantProjection(matrix(FULL)).status, 'source-matrix-verified');
});

test('exact projection: a declaration that names a DRAWN tuple refuses; so does one that misses an undrawn tuple', () => {
  // The set draws C×L; the declaration calls it absent → an extra row.
  const drawn = validateExactVariantProjection(matrix(FULL), undefined, { absentVariants: C_L });
  assert.ok(drawn.status === 'refused' && drawn.code === 'EXACT_MATRIX_RAGGED');
  assert.match(drawn.refusals[0].message, /6 rows; Cartesian definitions minus 1 declared absent variant\(s\) require 5/);
  assert.deepEqual(drawn.refusals[0].tuples, ['[["Size","L"],["Tone","C"]]']);
  // The set leaves C×L undrawn; the declaration names B×L instead → one missing, one extra.
  const wrong = validateExactVariantProjection(matrix(SPARSE), undefined, { absentVariants: [{ Tone: 'B', Size: 'L' }] });
  assert.ok(wrong.status === 'refused' && wrong.code === 'EXACT_MATRIX_RAGGED');
  assert.equal(wrong.refusals[0].tuples?.length, 2);
});

test('exact projection: an extra row still refuses with a declaration present', () => {
  const duplicate = validateExactVariantProjection(matrix([...SPARSE, row('A', 'S')]), undefined, { absentVariants: C_L });
  assert.ok(duplicate.status === 'refused' && duplicate.code === 'EXACT_TUPLE_DUPLICATE');
  const outside = validateExactVariantProjection(matrix([...SPARSE, row('D', 'S')]), undefined, { absentVariants: C_L });
  assert.ok(outside.status === 'refused' && outside.code === 'EXACT_TUPLE_INVALID_VALUE');
});

test('exact projection: an unreadable or disagreeing declaration is IGNORED — it can only fall back to the full Cartesian, never widen what is exact', () => {
  const bad: unknown[] = [
    'C×L', // not a list
    [], // empty
    [{ Tone: 'C' }], // a pattern, not a complete tuple
    [{ Tone: 'C', Size: 'L', Extra: 'x' }], // an unknown property
    [{ Tone: 'C', Size: 'XL' }], // an option the axis does not offer
    [{ Tone: 'C', Size: 'L' }, { Size: 'L', Tone: 'C' }], // a duplicate
    FULL.map((r) => r.variantProperties), // nothing left to draw
  ];
  for (const absentVariants of bad) {
    const result = validateExactVariantProjection(matrix(SPARSE), undefined, { absentVariants });
    assert.ok(result.status === 'refused' && result.code === 'EXACT_MATRIX_RAGGED', JSON.stringify(absentVariants));
    assert.equal(result.refusals[0].message, 'Source matrix has 5 rows; Cartesian definitions require 6.');
  }
  // A set that declares a state-preview matrix keeps THAT expectation; the absence list is not composed with it.
  const previewed = { ...matrix(SPARSE), statePreviewAxis: { axis: 'State', default: 'Default', states: ['Hover'], primary: 'Tone', pinned: { Size: 'S' } } };
  assert.equal(validateExactVariantProjection(previewed, undefined, { absentVariants: C_L }).status, 'refused');
  assert.equal(deriveAbsentVariants(previewed), null);
});

test('deriveAbsentVariants reads a STRICT SUBSET only — a full, invalid, duplicated or unstructured matrix yields nothing to declare', () => {
  assert.deepEqual(deriveAbsentVariants(matrix(SPARSE)), [{ Size: 'L', Tone: 'C' }]);
  assert.equal(deriveAbsentVariants(matrix(FULL)), null);
  assert.equal(deriveAbsentVariants(matrix([...SPARSE, row('D', 'S')])), null);
  assert.equal(deriveAbsentVariants(matrix([...SPARSE.slice(1), SPARSE[1]])), null);
  assert.equal(deriveAbsentVariants({ setName: 'Tag', variants: SPARSE.map((r) => ({ name: r.name })), propertyDefinitions: definitions }), null);
});

// ---------------------------------------------------------------------------
// 2. the referee
// ---------------------------------------------------------------------------
const enumProp = (name: string, property: string, values: string[], extra: Record<string, unknown> = {}) => ({
  name, type: { enum: values }, default: values[0],
  bindings: { code: { prop: name }, figma: { kind: 'VARIANT', property, values: Object.fromEntries(values.map((v) => [v, v.toUpperCase()])) } }, ...extra,
});
const seed = (absentVariants: unknown, patch: (c: Record<string, any>) => void = () => {}): Contract => {
  const raw: Record<string, any> = {
    id: 'check.sparse', name: 'Sparse', version: '0.1.0', status: 'draft', description: 'Declared undrawn combinations',
    props: [
      enumProp('tone', 'Tone', ['a', 'b', 'c']),
      enumProp('size', 'Size', ['s', 'l']),
      { name: 'flag', type: 'boolean', default: false, bindings: { code: { prop: 'flag' }, figma: { kind: 'VARIANT', property: 'Flag', values: { true: 'True', false: 'False' } } } },
      { name: 'quiet', type: 'boolean', default: false, bindings: { code: { prop: 'quiet' }, figma: { kind: 'BOOLEAN', property: 'Quiet' } } },
    ],
    states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' }, text: 'Tag', tokens: { 'background-color': '{paint.{tone}}', 'padding-inline': '{space.{size}}' } } },
    bindings: { figma: { ...(absentVariants === undefined ? {} : { absentVariants }), anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/sparse', export: 'Sparse' } } },
  };
  patch(raw);
  return ContractSchema.parse(raw);
};
const refusals = (c: Contract): string[] => {
  const errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map());
  return errors.filter((e) => e.includes('absent-variant'));
};
const CL_TRUE = { tone: 'c', size: 'l', flag: true };

test('validateContract: a sound declaration is accepted; every unsound one is refused BY NAME', () => {
  assert.deepEqual(refusals(seed([CL_TRUE])), []);
  assert.deepEqual(refusals(seed(undefined)), []);
  const named = (absent: unknown, code: RegExp, patch?: (c: Record<string, any>) => void) => {
    const errors = refusals(seed(absent, patch));
    assert.ok(errors.some((e) => code.test(e)), `${code} not in ${JSON.stringify(errors)}`);
  };
  named([{ tone: 'z', size: 'l', flag: true }], /absent-variant-not-in-product: .*"tone" the value "z"/);
  named([{ tone: 'c', size: 'l', flag: 'true' }], /absent-variant-not-in-product: .*"flag" the value "true"/); // a boolean axis takes a JSON boolean
  named([{ tone: 'c', size: 'l', flag: null }], /absent-variant-not-in-product/); // null is only the unsetValue option
  named([{ tone: 'c', size: 'l' }], /absent-variant-incomplete: .*does not name "flag"/);
  named([CL_TRUE, { ...CL_TRUE }], /absent-variant-duplicate/);
  named([{ ...CL_TRUE, quiet: true }], /absent-variant-non-variant-axis: .*"quiet", which is not a variant axis \(figma kind BOOLEAN\)/);
  named([{ ...CL_TRUE, nope: 'x' }], /absent-variant-non-variant-axis: .*"nope", which is not a prop/);
  named([{ tone: 'a', size: 's', flag: false }], /absent-variants-default-tuple/);
  named([CL_TRUE, { tone: 'c', size: 's', flag: true }], /absent-variants-order/); // tuples out of enumeration order
  named([{ size: 'l', tone: 'c', flag: true }], /absent-variants-order/); // keys out of prop order
  named(
    [{ tone: 'c', size: 's', flag: false }, { tone: 'c', size: 's', flag: true }, { tone: 'c', size: 'l', flag: false }, CL_TRUE],
    /absent-variants-erase-axis-value: .*"tone" = "c"/,
  );
  named([CL_TRUE], /absent-variants-native-representation/, (c) => { c.bindings.figma.representation = 'native'; });
  // Together with statePreviews: refused — the two sparse shapes do not compose.
  named([CL_TRUE], /absent-variants-with-state-previews/, (c) => {
    c.bindings.figma.statePreviews = true;
    c.states = ['hover'];
    c.anatomy.root.states = { hover: { 'background-color': '{paint.b}' } };
  });
});

test('validateContract: a list that names every combination is refused (and the schema refuses an empty one)', () => {
  const all: Array<Record<string, unknown>> = [];
  for (const tone of ['a', 'b', 'c']) for (const size of ['s', 'l']) for (const flag of [false, true]) all.push({ tone, size, flag });
  assert.ok(refusals(seed(all)).some((e) => /absent-variants-cover-product: .*all 12 combinations/.test(e)));
  assert.throws(() => seed([]), /absentVariants/);
});

test('validateContract: an axis with a canvas-only unsetValue option addresses it as null', () => {
  const withUnset = (absent: unknown) => seed(absent, (c) => {
    c.props = [enumProp('tone', 'Tone', ['a', 'b']), { ...enumProp('size', 'Size', ['s', 'l']), default: undefined }];
    delete c.props[1].default;
    c.props[1].bindings.figma.unsetValue = 'Unset';
    c.anatomy.root.tokens = { 'background-color': '{paint.{tone}}' };
  });
  assert.deepEqual(refusals(withUnset([{ tone: 'b', size: null }])), []);
  assert.ok(refusals(withUnset([{ tone: 'a', size: null }])).some((e) => /absent-variants-default-tuple/.test(e)), 'the omission option IS the default cell of that axis');
});

// ---------------------------------------------------------------------------
// 3. the proposer, on a synthetic designer set (REST shape, exact mode)
// ---------------------------------------------------------------------------
const SOLID = (hex: string) => [{ type: 'SOLID', color: { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: 1 } }];
const restVariant = (id: string, name: string, fill: string, padding: number) => ({ id, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL',
  primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', paddingTop: 4, paddingBottom: 4, paddingLeft: padding, paddingRight: padding,
  absoluteBoundingBox: { x: 0, y: 0, width: 40 + 2 * padding, height: 24 }, fills: SOLID(fill), children: [] });
const designerSet = (name: string, axes: Record<string, string[]>, cells: Array<{ at: Record<string, string>; fill: string; padding: number }>): DumpSet => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: {
    id: '1:1', name, type: 'COMPONENT_SET',
    componentPropertyDefinitions: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, { type: 'VARIANT', defaultValue: v[0], variantOptions: v }])),
    children: cells.map((c, i) => restVariant(`1:${i + 2}`, Object.entries(c.at).map(([k, v]) => `${k}=${v}`).join(', '), c.fill, c.padding)),
  } } } } as never);
  return (result.dump as unknown as Record<string, DumpSet>)[name];
};
const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const exact = (set: DumpSet) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true });
const FILL = { A: 'cc0000', B: '00aa00', C: '0000cc' } as Record<string, string>;
const PAD = { S: 8, L: 16 } as Record<string, number>;
const tagCells = (keep: (tone: string, size: string) => boolean) =>
  ['A', 'B', 'C'].flatMap((tone) => ['S', 'L'].filter((size) => keep(tone, size)).map((size) => ({ at: { Tone: tone, Size: size }, fill: FILL[tone], padding: PAD[size] })));

test('proposer: a strict-subset designer set proposes the declaration, and every inference that stays unambiguous proposes normally', () => {
  const set = designerSet('Tag', { Tone: ['A', 'B', 'C'], Size: ['S', 'L'] }, tagCells((t, s) => !(t === 'C' && s === 'L')));
  assert.equal(set.variants.length, 5);
  const result = exact(set);
  assert.equal(result.projection.status, 'verified-exact');
  assert.equal(result.projection.status === 'verified-exact' && result.projection.observedCount, 5);
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.bindings.figma.absentVariants, [{ tone: 'c', size: 'l' }]);
  assert.deepEqual(Object.keys(result.contract.bindings as object), ['figma', 'code']);
  assert.deepEqual(Object.keys((result.contract.bindings as { figma: object }).figma), ['absentVariants', 'anchors'], 'the declaration sits beside the anchors, in schema order');
  // Fill is a function of Tone alone and padding of Size alone: both carried per axis, neither guessed.
  const tokens = contract.anatomy.root.tokens as Record<string, string>;
  assert.match(tokens['background-color'], /\{tone\}/);
  assert.match(tokens['padding-inline'], /\{size\}/);
  assert.deepEqual(refusalsOf(contract), []);
  const note = result.notes.find((n) => n.startsWith('bindings.figma.absentVariants: the set draws 5 of the 6 combinations'));
  assert.ok(note?.includes('(Size=L, Tone=C)'), 'the undrawn cell is spelled in the designer\'s own terms');
  assert.ok(note?.includes('undrawn-combination-rendered-by-composition'), 'the code-side limit is named on the proposal');
  // The full set is untouched: no declaration, no note.
  const full = exact(designerSet('Tag', { Tone: ['A', 'B', 'C'], Size: ['S', 'L'] }, tagCells(() => true)));
  assert.equal('absentVariants' in (full.contract.bindings as { figma: object }).figma, false);
  assert.ok(!full.notes.some((n) => n.includes('absentVariants')));
});
const refusalsOf = (c: Contract) => { const errors: string[] = []; validateContract(c, new Map([[c.id, c]]), errors, new Map()); return errors; };

test('proposer: an inference the undrawn cells make AMBIGUOUS refuses the set by name — sparse-matrix-inference-ambiguous:<channel>@<part>', () => {
  // Only A×S and B×L are drawn: the fill is a function of Tone AND equally of
  // Size, and the two disagree at the undrawn A×L (red vs green). Before the
  // fence the first axis in order won.
  const cells = [
    { at: { Tone: 'A', Size: 'S' }, fill: FILL.A, padding: 8 },
    { at: { Tone: 'B', Size: 'L' }, fill: FILL.B, padding: 8 },
  ];
  const set = designerSet('Chip', { Tone: ['A', 'B'], Size: ['S', 'L'] }, cells);
  assert.throws(() => exact(set), (error: unknown) => {
    assert.ok(error instanceof SparseMatrixInferenceError);
    assert.equal(error.code, 'sparse-matrix-inference-ambiguous');
    assert.deepEqual(error.inferences, ['background-color@Chip:root']);
    assert.match(error.message, /^sparse-matrix-inference-ambiguous:background-color@Chip:root — /);
    assert.match(error.message, /a function of "Tone" and equally of "Size" on every drawn variant; at the undrawn Size=L, Tone=A they give "#cc0000" vs "#00aa00"/);
    return true;
  });
  // The batch names it in the skip headline (never "a technical error").
  const batch = proposeBatchFromDump({ Chip: set } as never, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true });
  assert.equal(batch.proposals.length, 0);
  assert.match(batch.skipped[0].reason, /could not be proposed: sparse-matrix-inference-ambiguous:background-color@Chip:root — /);
  // The SAME two cells with a uniform fill infer nothing per axis, so nothing is ambiguous.
  const uniform = exact(designerSet('Chip', { Tone: ['A', 'B'], Size: ['S', 'L'] }, cells.map((c) => ({ ...c, fill: FILL.A }))));
  assert.deepEqual(ContractSchema.parse(uniform.contract).bindings.figma.absentVariants, [{ tone: 'a', size: 'l' }, { tone: 'b', size: 's' }]);
});

test('proposer: extra or invalid rows keep the ragged refusal; reviewable inversion derives the same declaration', () => {
  const set = designerSet('Tag', { Tone: ['A', 'B', 'C'], Size: ['S', 'L'] }, tagCells((t, s) => !(t === 'C' && s === 'L')));
  const doubled = structuredClone(set);
  doubled.variants.push(structuredClone(doubled.variants[0]));
  assert.throws(() => exact(doubled), (error: unknown) => error instanceof ExactProjectionError && error.code === 'EXACT_TUPLE_DUPLICATE');
  const reviewable = proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  assert.equal(reviewable.projection.status, 'verified-exact');
  assert.deepEqual(reviewable.contract, exact(set).contract);
});

// ---------------------------------------------------------------------------
// 4. the writer, on the mock canvas: contract → set → REAL plugin reader → contract
// ---------------------------------------------------------------------------
const primitives = {
  paint: { a: { $type: 'color', $value: '#cc0000' }, b: { $type: 'color', $value: '#00aa00' }, c: { $type: 'color', $value: '#0000cc' } },
  space: { s: { $type: 'dimension', $value: '8px' }, l: { $type: 'dimension', $value: '16px' } },
};
const engine = createFigmaEngine({ tokens: { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
const writable = (absentVariants?: unknown): Contract => seed(absentVariants, (c) => { c.props = c.props.slice(0, 2); });
type CanvasNode = { name: string; type: string; children: CanvasNode[]; getSharedPluginData(ns: string, key: string): string };
async function canvas() {
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
    return JSON.parse(JSON.stringify((await run(source) as Record<string, unknown>)[node.name])) as DumpSet;
  };
  return { write, read };
}
const writerCorpus = tokenCorpusFromJson({ primitives, semantic: {}, light: {}, brandDefault: {} });
/** Propose a set back. `scope` = the contracts in scope: a set this pipeline drew takes its declaration from its OWN stamped contract, never from its rows. */
const back = (set: DumpSet, scope: Contract[] = []) => ContractSchema.parse(proposeFromDump(set, { corpus: writerCorpus, contractIdByName: new Map(scope.map((c) => [c.name, c.id])),
  contractsById: new Map(scope.map((c) => [c.id, c as never])), fileKey: null, projectionMode: 'exact', mintUnbound: false }).contract);

test('writer: a contract with declared absences generates a set WITHOUT those variants, and the set proposes back to its own declaration', async () => {
  const c = writable([{ tone: 'c', size: 'l' }]);
  assert.deepEqual(refusalsOf(c), []);
  const { write, read } = await canvas();
  const node = await write(c);
  assert.deepEqual(node.children.map((v) => v.name), ['Tone=A, Size=S', 'Tone=A, Size=L', 'Tone=B, Size=S', 'Tone=B, Size=L', 'Tone=C, Size=S'], 'the default combination is still first; the undrawn one was never built');
  const set = await read(node);
  assert.equal(set.variants.length, 5);
  assert.equal(validateExactVariantProjection(set).status, 'refused', 'the generated set is ragged against the bare Cartesian — it is exact only against its declaration');
  const proposed = back(set, [c]);
  assert.deepEqual(proposed.bindings.figma.absentVariants, c.bindings.figma.absentVariants);
  assert.deepEqual(proposed.props.map((p) => [p.name, p.type, p.default]), c.props.map((p) => [p.name, p.type, p.default]));
  assert.deepEqual(proposed.anatomy.root.tokens, c.anatomy.root.tokens, 'per-axis bindings return as they left — the hole made nothing ambiguous');
  // A second trip is a fixed point.
  const { write: write2, read: read2 } = await canvas();
  assert.deepEqual(back(await read2(await write2(proposed)), [proposed]).bindings.figma.absentVariants, c.bindings.figma.absentVariants);
});

test('writer: a set THIS PIPELINE drew never declares by its rows — a lost variant, a contract out of scope, or a declaration that disagrees all keep EXACT_MATRIX_RAGGED', async () => {
  const c = writable([{ tone: 'c', size: 'l' }]);
  const { write, read } = await canvas();
  const set = await read(await write(c));
  const ragged = (run: () => unknown) => assert.throws(run, (error: unknown) => error instanceof ExactProjectionError && error.code === 'EXACT_MATRIX_RAGGED');
  ragged(() => back(set)); // the stamped contract is not in scope: nothing declares the hole
  ragged(() => back(set, [writable()])); // in scope, but it declares nothing
  ragged(() => back(set, [writable([{ tone: 'b', size: 'l' }])])); // in scope, declares a DIFFERENT cell
  const damaged = structuredClone(set);
  damaged.variants.splice(1, 1); // a designer deleted Tone=A, Size=L from the generated set
  ragged(() => back(damaged, [c]));
  // A FULL generated set that lost a variant: refused exactly as before this field existed.
  const full = await canvas();
  const fullSet = await full.read(await full.write(writable()));
  fullSet.variants.splice(1, 1);
  ragged(() => back(fullSet, [writable()]));
});

test('writer: a contract with NO declaration emits the script it always did, draws the full product and proposes back without the field', async () => {
  const plain = writable();
  const declared = writable([{ tone: 'c', size: 'l' }]);
  const script = engine.buildComponentScript(plain, new Map([[plain.id, plain]]));
  assert.doesNotMatch(script, /absentVariants/);
  // The runtime is the same text either way — only the compiled variant list differs.
  const sparseScript = engine.buildComponentScript(declared, new Map([[declared.id, declared]]));
  assert.ok(script.includes('"name": "Tone=C, Size=L"') && !sparseScript.includes('"name": "Tone=C, Size=L"'));
  const { write, read } = await canvas();
  const node = await write(plain);
  assert.equal(node.children.length, 6);
  assert.equal('absentVariants' in back(await read(node), [plain]).bindings.figma, false);
});

test('writer: an instance that selects a combination its child declares undrawn refuses BY NAME at compile, never mid-paste', () => {
  const child = writable([{ tone: 'c', size: 'l' }]);
  const parent = (props: Record<string, string>): Contract => ContractSchema.parse({
    id: 'check.sparse-host', name: 'SparseHost', version: '0.1.0', status: 'draft', description: 'Hosts a sparse child', props: [], states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' }, parts: { tag: { component: { id: child.id, props } } } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/sparse-host', export: 'SparseHost' } } },
  });
  const build = (p: Contract) => engine.buildComponentScript(p, new Map([[p.id, p], [child.id, child]]));
  assert.throws(() => build(parent({ tone: 'c', size: 'l' })), /FIGMA_COMPONENT_REF_ABSENT_VARIANT: check\.sparse-host places check\.sparse at \{"tone":"c","size":"l"\}/);
  assert.doesNotThrow(() => build(parent({ tone: 'c' })), 'size falls to the child default (s), which is drawn');
});

test('NAMED DIVERGENCE (docs/23 §D.40), pinned so it cannot become silent: amending a set written BEFORE the declaration reports the now-undrawn variant, it does not delete it', async () => {
  const { write } = await canvas();
  await write(writable());
  const node = await write(writable([{ tone: 'c', size: 'l' }])); // amend: same contract id, same set
  assert.equal(node.children.length, 6, 'the writer never deletes a designer-visible variant; the amend report lists it under extraVariants');
});

// ---------------------------------------------------------------------------
// 5. the code surfaces: unchanged, and the limit is named in the emitted file
// ---------------------------------------------------------------------------
test('code: the declaration changes no rule — the component still renders every combination — and the emitted file NAMES undrawn-combination-rendered-by-composition', () => {
  const inventory = new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']);
  const emit = (c: Contract) => emitReact(c, { tokens: inventory, icons: new Map(), contracts: new Map([[c.id, c]]) });
  const plain = emit(writable());
  const declared = emit(writable([{ tone: 'c', size: 'l' }]));
  assert.equal(declared.css, plain.css, 'the stylesheet is byte-identical: .tone-c and .size-l still compose');
  assert.doesNotMatch(plain.tsx, /undrawn-combination/);
  assert.match(declared.tsx, /\/\/ undrawn-combination-rendered-by-composition: the design does not draw 1 of this\n\s+\/\/ component's prop combinations \(bindings\.figma\.absentVariants: tone=c size=l\)/);
  const strip = (tsx: string) => tsx.split('\n').filter((l) => !/^\s*\/\/ (undrawn-combination|component's prop combinations|Nothing here refuses|drawn variants, which)/.test(l)).join('\n');
  assert.equal(strip(declared.tsx), plain.tsx, 'the note is the only difference');
});
