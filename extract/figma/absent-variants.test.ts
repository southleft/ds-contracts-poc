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
  dumpStampsObservable,
  proposeBatchFromDump,
  proposeFromDump,
  proposeDeclaredDrawnCandidate,
  SparseMatrixInferenceError,
  ExactProjectionError,
} from '../../core/propose-figma.js';
import { deriveAbsentVariants, EXACT_ABSENT_VARIANTS_MAX_PRODUCT, validateExactVariantProjection, type ExactDumpSet } from '../../core/exact-projection.js';
import { compareContracts } from './roundtrip.js';
import { verifyFigmaDrawnDomain } from '../../core/figma-drawn-variants.js';
import { createFigmaEngine } from '../../core/emit-figma-script.js';
import { emitWebComponent } from '../../packages/emitter-web-components/src/emit-wc.js';
import { chromium } from 'playwright-core';
import { mountGenerated, generatedTypeErrors } from '../../core/react-test-runtime.js';
import { emitReactInline } from '../../core/emit-react-inline.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReact, validateContract } from '../../core/emit-react.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { ABSENT_VARIANTS_MAX_PRODUCT, absentVariantIssues, drawnVariantIssues, drawnGeometryTupleKeys, ContractSchema, type Contract } from '../../scripts/contract-schema.js';
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
  // KEY order inside a tuple is NOT validity (a JSON object is unordered; jq -S / canonicalJson sort keys).
  assert.deepEqual(refusals(seed([{ size: 'l', tone: 'c', flag: true }])), []);
  assert.deepEqual(refusals(seed([{ flag: true, size: 'l', tone: 'b' }, { size: 'l', flag: true, tone: 'c' }])), [], 'tuple order still holds with shuffled keys');
  named([{ flag: true, size: 'l', tone: 'c' }, { size: 'l', flag: true, tone: 'b' }], /absent-variants-order/);
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
/** A DESIGNER's set: unstamped, read by a reader that COULD have seen a stamp (the fact fetch.ts records). */
const exact = (set: DumpSet, stampsObservable = true) => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true, stampsObservable });
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
  const batch = proposeBatchFromDump({ Chip: set } as never, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true, stampsObservable: true });
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
  const reviewable = proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, stampsObservable: true });
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
  const sync = (c: Contract) => run(engine.buildComponentScript(c, new Map([[c.id, c]]))) as Promise<{ results: Array<Record<string, unknown>> }>;
  const write = async (c: Contract) => {
    await sync(c);
    type Found = { type: string; getSharedPluginData(ns: string, key: string): string };
    return root.findOne((n: Found) => n.type === 'COMPONENT_SET' && n.getSharedPluginData('ds_contracts', 'contractId') === c.id) as unknown as CanvasNode;
  };
  const read = async (node: CanvasNode) => {
    const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
      .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([node.name])};`);
    const dumps = await run(source) as Record<string, unknown>;
    lastProvenance = JSON.parse(JSON.stringify(dumps._provenance));
    return JSON.parse(JSON.stringify(dumps[node.name])) as DumpSet;
  };
  let lastProvenance: unknown;
  return { write, read, sync, provenance: () => lastProvenance as Parameters<typeof dumpStampsObservable>[0] };
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

test('NAMED DIVERGENCE (docs/23 §D.40), pinned so it can never be silent: a set written BEFORE the declaration keeps the variant — and the writer says so on EVERY sync, the read-back refuses, the comparer sees it', async () => {
  const { write, sync, read } = await canvas();
  const declared = writable([{ tone: 'c', size: 'l' }]);
  await write(writable());
  const plainJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T; // results come from the vm realm
  const amend = plainJson((await sync(declared)).results[0]); // same contract id, same set
  assert.deepEqual(amend.extraVariants, ['Tone=C, Size=L'], 'the writer never deletes a designer-visible variant; the amend report names it');
  const repeat = plainJson((await sync(declared)).results[0]);
  assert.equal(repeat.skipped, true);
  assert.equal(repeat.reason, 'unchanged-with-extra-variants:[Tone=C, Size=L]', 'a standing disagreement is not "unchanged"');
  assert.deepEqual(repeat.extraVariants, ['Tone=C, Size=L']);
  assert.equal((await sync(declared)).results[0].reason, 'unchanged-with-extra-variants:[Tone=C, Size=L]', '…named again, every time');
  const node = await write(declared);
  assert.equal(node.children.length, 6);
  // THE READ-BACK. A full product passes the Cartesian check; the scoped declaration is consulted ANYWAY,
  // so the drawn cell the contract calls absent is an extra row — it used to read verified-exact and drop the declaration.
  const set = await read(node);
  assert.equal(validateExactVariantProjection(set).status, 'source-matrix-verified');
  for (const projectionMode of ['exact', 'reviewable-inversion'] as const) {
    assert.throws(
      () => proposeFromDump(set, { corpus: writerCorpus, contractIdByName: new Map([[declared.name, declared.id]]), contractsById: new Map([[declared.id, declared as never]]), fileKey: null, projectionMode, mintUnbound: false }),
      (error: unknown) => error instanceof ExactProjectionError && error.code === 'EXACT_MATRIX_RAGGED' && /6 rows; Cartesian definitions minus 1 declared absent variant\(s\) require 5/.test(error.message),
    );
  }
  // Without the declaring contract in scope the canvas is simply a full set — and the COMPARER is what catches the dropped declaration.
  const dropped = back(set);
  assert.equal('absentVariants' in dropped.bindings.figma, false);
  const finding = (shipping: Contract, proposed: Contract) => compareContracts(shipping as never, proposed as never, writerCorpus).filter((f) => f.subject === 'bindings.figma.absentVariants');
  assert.deepEqual(finding(declared, dropped).map((f) => f.status), ['mismatch'], 'a DROPPED declaration is a difference');
  assert.deepEqual(finding(declared, writable([{ tone: 'b', size: 'l' }])).map((f) => f.status), ['mismatch'], 'a MOVED declaration is a difference');
  assert.deepEqual(finding(writable(), declared).map((f) => f.status), ['mismatch'], 'a GAINED declaration is a difference');
  assert.deepEqual(finding(declared, ContractSchema.parse(JSON.parse(JSON.stringify(declared).replace('{"tone":"c","size":"l"}', '{"size":"l","tone":"c"}')))).map((f) => f.status), ['matched'], 'key order is not a difference');
  assert.deepEqual(finding(writable(), writable()), [], 'no declaration on either side adds no row to any existing report');
  // A contract that declares nothing keeps the plain skip reason and an unchanged script.
  const plain = await canvas();
  await plain.write(writable());
  assert.equal((await plain.sync(writable())).results[0].reason, 'unchanged');
  assert.doesNotMatch(engine.buildComponentScript(writable(), new Map([[writable().id, writable()]])), /unchanged-with-extra-variants/);
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
  assert.match(declared.tsx, /\/\/ undrawn-combination-rendered-by-composition: the design does not draw 1 of this\n\s+\/\/ component's prop combinations \(bindings\.figma\.absentVariants: tone="c" size="l"\)/);
  const strip = (tsx: string) => tsx.split('\n').filter((l) => !/^\s*\/\/ (undrawn-combination|component's prop combinations|Nothing here refuses|drawn variants, which)/.test(l)).join('\n');
  assert.equal(strip(declared.tsx), plain.tsx, 'the note is the only difference');
});

// ---------------------------------------------------------------------------
// 6. H2 — "unstamped" is evidence of a designer ONLY when a stamp could have been seen
// ---------------------------------------------------------------------------
test('stamps observable is a POSITIVE reader fact: the plugin reader always, REST only when the fetch layer says the request carried the plane, everything else fails closed', async () => {
  assert.equal(dumpStampsObservable(undefined), false);
  assert.equal(dumpStampsObservable({}), false);
  assert.equal(dumpStampsObservable({ dumpVersion: '1.35', note: 'hand-authored fixture' }), false);
  assert.equal(dumpStampsObservable({ dumpVersion: '1.25', note: 'Node-tree dump (extract/figma/dump.plugin.js, dump v1.25)' }), false, 'before the contract-id stamp was carried');
  assert.equal(dumpStampsObservable({ dumpVersion: '1.35', note: 'mapped from the Figma REST API (extract/figma/rest/map.ts)' }), false);
  assert.equal(dumpStampsObservable({ dumpVersion: '1.35', note: 'x', stampsObservable: 'true' }), false, 'only the boolean the mapper writes');
  assert.equal(dumpStampsObservable({ dumpVersion: '1.35', note: 'x', stampsObservable: true }), true);
  const live = await canvas();
  await live.read(await live.write(writable()));
  assert.equal(dumpStampsObservable(live.provenance()), true, 'the REAL plugin reader says who it is');

  // The mapper writes the key ONLY when told, so every fixture mapped without it keeps its bytes.
  const response = { name: 'fixture', nodes: { '1:1': { document: { id: '1:1', name: 'Tag', type: 'COMPONENT_SET', children: [] } } } };
  const bare = mapRestToDump(response as never).dump as { _provenance: Record<string, unknown> };
  const told = mapRestToDump(response as never, { stampsObservable: true }).dump as { _provenance: Record<string, unknown> };
  assert.equal('stampsObservable' in bare._provenance, false);
  assert.equal(told._provenance.stampsObservable, true);
  const { stampsObservable: _dropped, ...rest } = told._provenance;
  assert.deepEqual(rest, bare._provenance, 'the one key is the only difference');
  assert.equal(bare._provenance.dumpVersion, '1.63', 'current REST producer carries inherited instance padding as well as explicitly empty fills');
});

test('the SAME pipeline-written set that lost a variant refuses whether or not the REST response carried sharedPluginData', () => {
  const lost = (stamped: boolean) => {
    const doc = { id: '1:1', name: 'Tag', type: 'COMPONENT_SET',
      ...(stamped ? { sharedPluginData: { ds_contracts: { contractId: 'ds.tag', semantics: JSON.stringify({ element: 'div' }) } } } : {}),
      componentPropertyDefinitions: { Tone: { type: 'VARIANT', defaultValue: 'A', variantOptions: ['A', 'B', 'C'] }, Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S', 'L'] } },
      children: tagCells((t, s) => !(t === 'B' && s === 'L')).map((c, i) => restVariant(`1:${i + 2}`, `Tone=${c.at.Tone}, Size=${c.at.Size}`, c.fill, c.padding)) };
    return (options: { stampsObservable?: boolean }) => mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: doc } } } as never, options).dump as unknown as Record<string, unknown>;
  };
  const opts = { corpus, contractIdByName: new Map<string, string>(), fileKey: null, projectionMode: 'exact' as const, mintUnbound: true };
  const skip = (dump: Record<string, unknown>) => proposeBatchFromDump(dump, opts).skipped.map((s) => s.reason).join(' ');
  assert.match(skip(lost(true)({ stampsObservable: true })), /Source matrix has 5 rows; Cartesian definitions require 6\.$/, 'stamped: a generated set that lost a variant, as always');
  assert.match(skip(lost(true)({})), /Cartesian definitions require 6\.$/);
  // UNSTAMPED response, nothing said about the request: this used to propose absentVariants=[{tone:b,size:l}] as verified-exact.
  assert.match(skip(lost(false)({})), /Cartesian definitions require 6\.$/);
  assert.match(proposeBatchFromDump(lost(false)({}), opts).skipped[0].detail!, /^stamps-not-observable: /);
  assert.throws(() => exact(lost(false)({}).Tag as DumpSet, false), (e: unknown) => e instanceof ExactProjectionError && e.code === 'EXACT_MATRIX_RAGGED' && /stamps-not-observable/.test(e.detail ?? '') && e.message === 'Source matrix has 5 rows; Cartesian definitions require 6.');
  // The fetch layer asked for the plane and nothing is stamped: a designer's set. The batch reads the fact from the dump itself.
  const observed = proposeBatchFromDump(lost(false)({ stampsObservable: true }), opts);
  assert.deepEqual(observed.skipped, []);
  assert.deepEqual((observed.proposals[0].contract.bindings as { figma: { absentVariants: unknown } }).figma.absentVariants, [{ tone: 'b', size: 'l' }]);
});

// ---------------------------------------------------------------------------
// 7. M1 — the encoding grows with the PRODUCT: bounds that are about meaning, and a referee that cannot be a memory DoS
// ---------------------------------------------------------------------------
const starSet = (axisCount: number, options: number): DumpSet => {
  const axes = Object.fromEntries(Array.from({ length: axisCount }, (_, a) => [`Ax${a}`, Array.from({ length: options }, (_, o) => `v${o}`)]));
  const base = Object.fromEntries(Object.keys(axes).map((k) => [k, 'v0']));
  const cells = [base, ...Object.keys(axes).flatMap((k) => axes[k].slice(1).map((v) => ({ ...base, [k]: v })))];
  return designerSet('Star', axes, cells.map((at) => ({ at, fill: FILL.A, padding: 8 })));
};

test('a "star" set (the default plus each axis varied alone) is not a product with holes: refused by name, in milliseconds, before any product is materialised', () => {
  const started = Date.now();
  // 3 axes × 3: 7 of 27 drawn — more undrawn than drawn.
  assert.throws(() => exact(starSet(3, 3)), (e: unknown) => e instanceof ExactProjectionError && e.code === 'EXACT_MATRIX_RAGGED' && /sparse-matrix-mostly-undrawn: 7 of 27 combinations are drawn and 20 are not/.test(e.message));
  // 13 axes × 2 = 8192 > 4096: the cap, not the ratio, and no 8192-cell walk.
  assert.throws(() => exact(starSet(13, 2)), (e: unknown) => e instanceof ExactProjectionError && /sparse-matrix-product-too-large: the variant axes multiply to 8192 combinations, above the 4096/.test(e.message));
  assert.ok(Date.now() - started < 5_000);
  assert.equal(deriveAbsentVariants(starSet(13, 2)), null, 'the reader door holds the same cap');
  // Exactly half undrawn is still a product with holes (2 of 4 — the diagonal sets above); one more undrawn is not.
  assert.equal(EXACT_ABSENT_VARIANTS_MAX_PRODUCT, ABSENT_VARIANTS_MAX_PRODUCT, 'one bound, two doors');
});

test('the initial exactness check refuses an oversized sparse product before expanding it', () => {
  const set = starSet(13, 2), flatMap = Array.prototype.flatMap;
  // A bounded sentry makes the pre-fix expansion fail without risking an OOM.
  // The public proposer calls this validator before its own product limit.
  Array.prototype.flatMap = function (this: unknown[], ...args: Parameters<typeof flatMap>) {
    const result = flatMap.apply(this, args);
    assert.ok(result.length <= EXACT_ABSENT_VARIANTS_MAX_PRODUCT, 'expanded a product beyond the declared limit');
    return result;
  } as typeof flatMap;
  try {
    const result = validateExactVariantProjection(set);
    assert.equal(result.status, 'refused');
    if (result.status !== 'refused') throw Error('expected refusal');
    assert.equal(result.code, 'EXACT_MATRIX_RAGGED');
    assert.equal(result.refusals[0].expected, 8192);
    assert.equal(result.refusals[0].actual, 14);
    assert.equal(result.refusals[0].tuples, undefined, 'oversized missing tuples are counted, not enumerated');
    assert.throws(() => exact(set), /sparse-matrix-product-too-large/);
  } finally { Array.prototype.flatMap = flatMap; }
});

test('a fully observed large product still verifies, and its returned rows must remain complete', () => {
  const set = starSet(13, 2), names = Object.keys(set.propertyDefinitions!);
  set.variants = Array.from({ length: 8192 }, (_, mask) => ({
    ...set.variants[0],
    variantProperties: Object.fromEntries(names.map((name, index) => [name, `v${(mask >>> index) & 1}`])),
  }));
  const full = validateExactVariantProjection(set, set.variants);
  assert.equal(full.status, 'verified-exact');
  if (full.status !== 'verified-exact') throw Error('expected full coverage');
  assert.equal(full.expectedCount, 8192);
  assert.equal(full.observedCount, 8192);
  const missing = validateExactVariantProjection(set, set.variants.slice(1));
  assert.equal(missing.status, 'refused');
  if (missing.status !== 'refused') throw Error('expected missing-row refusal');
  assert.equal(missing.code, 'EXACT_ROWS_MISSING');
});

test('referee: mostly-undrawn and product-too-large are refused by name, and validating ONE tuple over a huge product costs nothing', () => {
  // 3 × 2 × 2 = 12 cells; 7 undrawn > 5 drawn.
  const seven = [
    { tone: 'a', size: 'l', flag: true }, { tone: 'b', size: 's', flag: true }, { tone: 'b', size: 'l', flag: false }, { tone: 'b', size: 'l', flag: true },
    { tone: 'c', size: 's', flag: false }, { tone: 'c', size: 'l', flag: false }, { tone: 'c', size: 'l', flag: true },
  ];
  assert.ok(refusals(seed(seven)).some((e) => /absent-variants-mostly-undrawn: .*leaves 5 of 12 combinations drawn and 7 undrawn/.test(e)));
  assert.deepEqual(refusals(seed(seven.slice(0, 6))), [], 'six of twelve undrawn is still a product with holes');
  const wide = seed([{}], (c) => {
    c.props = Array.from({ length: 13 }, (_, i) => ({ name: `b${i}`, type: 'boolean', default: false, bindings: { code: { prop: `b${i}` }, figma: { kind: 'VARIANT', property: `B${i}`, values: { true: 'True', false: 'False' } } } }));
    c.bindings.figma.absentVariants = [Object.fromEntries(c.props.map((p: { name: string }) => [p.name, true]))];
    c.anatomy.root.tokens = {};
  });
  const started = Date.now();
  const issues = absentVariantIssues(wide);
  assert.ok(Date.now() - started < 200, 'no product walk');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /^absent-variants-product-too-large: .*ranges over 8192 combinations .*refused above 4096/);
});

test('code: the emitted note is CAPPED and its values are JSON-spelled — an enum value holding a newline cannot end the comment', () => {
  const evil = 'l\n  ; globalThis.PWNED = 1; //';
  const c = seed([{ tone: 'a', size: evil }, { tone: 'b', size: evil }, { tone: 'c', size: 's' }, { tone: 'c', size: 'm' }], (raw) => {
    raw.props = [enumProp('tone', 'Tone', ['a', 'b', 'c']), enumProp('size', 'Size', ['s', 'm', evil])];
    raw.anatomy.root.tokens = { 'background-color': '{paint.{tone}}' };
  });
  const { tsx } = emitReact(c, { tokens: new Set(['paint.a', 'paint.b', 'paint.c']), icons: new Map(), contracts: new Map([[c.id, c]]) });
  const lines = tsx.split('\n');
  const at = lines.findIndex((l) => l.includes('undrawn-combination-rendered-by-composition'));
  assert.ok(at >= 0);
  assert.deepEqual(lines.slice(at, at + 4).map((l) => l.trimStart().startsWith('//')), [true, true, true, true], 'four comment lines, none broken open');
  assert.match(lines[at + 1], /size="l\\n  ; globalThis\.PWNED = 1; \/\/"/);
  assert.match(lines[at + 1], /; … 1 more in the contract\)\.$/, 'the comment names the limit; the contract carries the list');
  assert.match(lines[at + 4], /^\s*const classes = /);
});

// ---------------------------------------------------------------------------
// 8. the remaining named refusals, and every fenced call-site category
// ---------------------------------------------------------------------------
test('validateContract: absent-variants-no-axes', () => {
  const c = seed([{}], (raw) => { raw.props = [raw.props[3]]; raw.anatomy.root.tokens = {}; });
  assert.ok(refusals(c).some((e) => /absent-variants-no-axes: .*no variant axis/.test(e)));
});

test('proposer: a PROMOTED interaction-state axis on a sparse set keeps its refusal in both modes unless it is a DESIGNER\'s axis (docs/23 §D.41, extract/figma/state-axis.test.ts)', () => {
  const cells = ['Default', 'Hover', 'Disabled'].flatMap((State) => ['A', 'B'].filter((Tone) => !(State === 'Disabled' && Tone === 'B')).map((Tone) => ({ at: { State, Tone }, fill: State === 'Hover' ? FILL.B : State === 'Disabled' ? FILL.C : FILL.A, padding: 8 })));
  const set = designerSet('Pill', { State: ['Default', 'Hover', 'Disabled'], Tone: ['A', 'B'] }, cells);
  // Without the designer fact "unstamped" proves nothing: the ragged refusal stands, as it did (the sparse wall comes first).
  for (const projectionMode of ['exact', 'reviewable-inversion'] as const) {
    assert.throws(
      () => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode, mintUnbound: true, stampsObservable: false }),
      (e: unknown) => e instanceof ExactProjectionError && e.code === 'EXACT_MATRIX_RAGGED',
      `${projectionMode}: an undrawn cell naming a promoted value has no spelling`,
    );
  }
  // A set THIS PIPELINE stamped keeps the interaction-state wall whatever the reader saw.
  assert.throws(() => exact({ ...set, contractId: 'ds.pill' } as DumpSet), (e: unknown) => e instanceof ExactProjectionError && (e.code === 'EXACT_MATRIX_RAGGED' || e.code === 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS'));
  // WITH the fact, the axis is a designer's drawing of the platform's states and the hole is a state cell, not a contract absence.
  const projected = exact(set);
  assert.equal(projected.projection.status, 'verified-exact');
  assert.deepEqual(projected.stateAxisProjection?.undrawnStateCells, [{ State: 'Disabled', Tone: 'B' }]);
  assert.equal('absentVariants' in (projected.contract.bindings as { figma: object }).figma, false);
});

test('the fence has no arity bound: f(A) against parity(B,C,D,E) over five binary axes is found and refused (it used to stop at triples and propose {a})', () => {
  const names = ['A', 'B', 'C', 'D', 'E'];
  const cells: Array<{ at: Record<string, string>; fill: string; padding: number }> = [];
  for (let m = 0; m < 32; m++) {
    const bits = names.map((_, i) => (m >> (4 - i)) & 1);
    const parity = (bits[1] + bits[2] + bits[3] + bits[4]) % 2;
    if (bits[0] !== parity) continue; // drawn only where A equals the parity of the other four: 16 of 32
    cells.push({ at: Object.fromEntries(names.map((k, i) => [k, String(bits[i])])), fill: bits[0] ? FILL.B : FILL.A, padding: 8 });
  }
  const set = designerSet('Parity', Object.fromEntries(names.map((k) => [k, ['0', '1']])), cells);
  assert.throws(() => exact(set), (e: unknown) => {
    assert.ok(e instanceof SparseMatrixInferenceError);
    assert.deepEqual(e.inferences, ['background-color@Parity:root']);
    assert.match(e.message, /a function of "A" and equally of "B" × "C" × "D" × "E" on every drawn variant/);
    return true;
  });
});

test('every fenced call-site category refuses BY ITS OWN NAME on a confounded set (A×S and B×L only): fill, padding, gap, radius, stroke, text, text colour, presence, hidden, opacity', () => {
  type Knob = 'fill' | 'pad' | 'gap' | 'radius' | 'stroke' | 'text' | 'textFill' | 'icon' | 'hidden' | 'opacity';
  const cell = (i: number, name: string, second: boolean, k: Knob) => ({ id: `1:${i}`, name, type: 'COMPONENT', layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
    paddingTop: 4, paddingBottom: 4, paddingLeft: k === 'pad' && second ? 16 : 8, paddingRight: k === 'pad' && second ? 16 : 8, itemSpacing: k === 'gap' && second ? 12 : 4, cornerRadius: k === 'radius' && second ? 10 : 2,
    strokes: SOLID('222222'), strokeWeight: k === 'stroke' && second ? 3 : 1, strokeAlign: 'INSIDE', opacity: k === 'opacity' && second ? 0.5 : 1,
    absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 24 }, fills: SOLID(k === 'fill' && second ? '00aa00' : 'cc0000'),
    children: [
      { id: `1:${i}1`, name: 'Label', type: 'TEXT', characters: k === 'text' && second ? 'Beta' : 'Alpha', style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 12, lineHeightPx: 16, lineHeightUnit: 'PIXELS' },
        fills: SOLID(k === 'textFill' && second ? '0000cc' : '111111'), absoluteBoundingBox: { x: 8, y: 4, width: 30, height: 16 } },
      ...(k === 'icon' && !second ? [] : [{ id: `1:${i}2`, name: 'Icon', type: 'RECTANGLE', fills: SOLID('333333'), absoluteBoundingBox: { x: 40, y: 4, width: 16, height: 16 } }]),
      { id: `1:${i}3`, name: 'Dot', type: 'ELLIPSE', layoutPositioning: 'ABSOLUTE', constraints: { horizontal: 'LEFT', vertical: 'TOP' }, fills: SOLID('999999'),
        absoluteBoundingBox: { x: 60, y: 8, width: 8, height: 8 }, ...(k === 'hidden' && second ? { visible: false } : {}) },
    ] });
  const expected: Record<Knob, string> = { fill: 'background-color@Cat:root', pad: 'padding-inline@Cat:root', gap: 'gap@Cat:root', radius: 'border-radius@Cat:root', stroke: 'border-width@Cat:root',
    text: 'text@Cat:root/Label', textFill: 'color@Cat:root/Label', icon: 'presence@Cat:root/Icon', hidden: 'visibility@Cat:root/Dot', opacity: 'opacity@Cat:root' };
  for (const [knob, label] of Object.entries(expected) as Array<[Knob, string]>) {
    const first = knob === 'opacity' ? ['Flag', 'False', 'True'] : ['Tone', 'A', 'B'];
    const doc = { id: '1:1', name: 'Cat', type: 'COMPONENT_SET',
      componentPropertyDefinitions: { [first[0]]: { type: 'VARIANT', defaultValue: first[1], variantOptions: [first[1], first[2]] }, Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S', 'L'] } },
      children: [cell(2, `${first[0]}=${first[1]}, Size=S`, false, knob), cell(3, `${first[0]}=${first[2]}, Size=L`, true, knob)] };
    const set = (mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: doc } } } as never).dump as unknown as Record<string, DumpSet>).Cat;
    assert.throws(
      () => proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true, stampsObservable: true, hiddenCaptured: true }),
      (e: unknown) => e instanceof SparseMatrixInferenceError && e.inferences.includes(label),
      `${knob} → ${label}`,
    );
  }
});

// Positive domain authoring is separate from a canvas-only absence list.
const positiveTuples = [
  { tone: 'a', size: 's', flag: false },
  { tone: 'a', size: 'l', flag: true },
  { tone: 'b', size: 's', flag: false },
  { tone: 'c', size: 's', flag: false },
];
const positiveSeed = (tuples: unknown = positiveTuples, patch?: (c: Record<string, any>) => void) => seed(undefined, c => { c.bindings.figma.drawnVariants = tuples; patch?.(c); });
test('positive tuple domain: schema preserves majority-undrawn complete typed tuples', () => {
  const contract = positiveSeed();
  assert.deepEqual(contract.bindings.figma.drawnVariants, positiveTuples);
  assert.deepEqual(drawnVariantIssues(contract), []);
});
test('positive tuple domain: schema refuses malformed, duplicate, unordered, missing-default and erased-option declarations', () => {
  for (const [tuples, code] of [
    [[], /drawnVariants/],
    [[{ tone: 'a', size: 's' }], /drawn-variants-incomplete/],
    [[...positiveTuples, positiveTuples[0]], /drawn-variants-duplicate/],
    [[...positiveTuples].reverse(), /drawn-variants-order/],
    [positiveTuples.slice(1), /drawn-variants-default-undrawn/],
    [positiveTuples.slice(0, -1), /drawn-variants-erased-option/],
    [[...positiveTuples, { tone: 'z', size: 'l', flag: true }], /drawn-variants-invalid-option/],
    [[...positiveTuples, { tone: 'a', size: 's', flag: 'false' }], /drawn-variants-invalid-option/],
    [[...positiveTuples, { tone: 'a', size: 's', flag: false, quiet: true }], /drawn-variants-unknown-axis/],
    [Array(4097).fill(positiveTuples[0]), /drawnVariants/],
  ] as const) assert.throws(() => positiveSeed(tuples), code);
});
test('positive tuple domain: schema refuses incompatible shapes and unqualified default/omission semantics', () => {
  assert.throws(() => positiveSeed(positiveTuples, c => { c.bindings.figma.absentVariants = [CL_TRUE]; }), /drawn-variants-with-absent-variants/);
  assert.throws(() => positiveSeed(positiveTuples, c => { c.bindings.figma.statePreviews = true; }), /drawn-variants-with-state-previews/);
  assert.throws(() => positiveSeed(positiveTuples, c => { c.bindings.figma.representation = 'native'; }), /drawn-variants-native-representation/);
  assert.throws(() => positiveSeed(positiveTuples, c => { delete c.props[0].default; }), /drawn-variants-explicit-default-required/);
  assert.throws(() => positiveSeed(positiveTuples, c => { c.props[0].bindings.figma.unsetValue = 'Unset'; }), /drawn-variants-unset-axis-not-qualified/);
});
test('positive tuple domain: key order does not change the accepted domain', () => {
  assert.deepEqual(drawnVariantIssues(positiveSeed(positiveTuples.map(tuple => ({ flag: tuple.flag, size: tuple.size, tone: tuple.tone })))), []);
});
test('positive tuple domain: unqualified validation callers remain closed', () => {
  const c = positiveSeed(), errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map());
  assert.ok(errors.some(error => error.includes('drawn-variants-surfaces-unqualified')));
});

test('positive tuple domain: React, Figma and HTML enforce declared planes while Web Components remain closed', () => {
  const contract = positiveSeed(), contracts = new Map([[contract.id, contract]]), icons = new Map<string, string>();
  const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const cssContext = { tokens: new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']), contracts, icons };
  assert.match(emitReact(contract, cssContext).tsx, /DRAWN_VARIANT_UNDECLARED/);
  assert.match(emitReactInline(contract, { tokens, contracts, icons }).tsx, /DRAWN_VARIANT_UNDECLARED/);
  const before = JSON.stringify(contract), html = emitHtml(contract, cssContext).html;
  const snapshots = [...html.matchAll(/class="showcase__item">\n    <p class="showcase__label">([^<]*)<\/p>\n([\s\S]*?)\n  <\/div>/g)]
    .map(match => {
      const root = match[2].match(/<div class="([^"]+)"([^>]*)>/);
      assert(root, 'every actual HTML snapshot contains the emitted component root');
      const classes = root[1].split(' ');
      return {label: match[1], tuple: {
        tone: classes.find(name => name.startsWith('sparse--tone-'))?.slice('sparse--tone-'.length),
        size: classes.find(name => name.startsWith('sparse--size-'))?.slice('sparse--size-'.length),
        flag: root[2].includes('data-flag="true"'),
      }, quiet: root[2].includes('data-quiet="true"')};
    });
  assert.deepEqual(snapshots.map(snapshot => snapshot.label), ['default',
    ...positiveTuples.slice(1).map(tuple => `tone=${tuple.tone}, size=${tuple.size}, flag=${tuple.flag}`), 'quiet=true']);
  assert.deepEqual(snapshots.slice(0, positiveTuples.length).map(snapshot => snapshot.tuple), positiveTuples,
    'default and every declared positive plane are actual HTML snapshots');
  assert(snapshots.every(snapshot => positiveTuples.some(tuple => JSON.stringify(tuple) === JSON.stringify(snapshot.tuple))),
    'no undeclared Cartesian plane reaches HTML, including the independent live Boolean showcase');
  assert.deepEqual(snapshots.filter(snapshot => snapshot.quiet), [{label:'quiet=true',tuple:positiveTuples[0],quiet:true}],
    'the independent Boolean control remains addressable on the qualified default plane');
  assert.equal(JSON.stringify(contract), before, 'HTML does not alter the source domain or defaults');
  assert.throws(() => emitWebComponent(contract, cssContext), /drawn-variants-surfaces-unqualified/);
  assert.doesNotThrow(() => engine.buildComponentScript(contract, contracts));
});

test('positive tuple domain: actual generated React accepts every declared row and defaults, rejects undeclared/invalid/null/string-boolean inputs before painting', async () => {
  const browser = await chromium.launch();
  try {
    const c = positiveSeed(), scope = new Map([[c.id, c]]), icons = new Map<string, string>();
    const tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    const emitted = [emitReact(c, { tokens: new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']), contracts: scope, icons }), emitReactInline(c, { tokens, contracts: scope, icons })];
    for (const generated of emitted) {
      assert.deepEqual(generatedTypeErrors(c.name, generated.tsx), []);
      const page = await browser.newPage();
      const render = await mountGenerated(page, c.name, generated.tsx, 'css' in generated && typeof generated.css === 'string' ? generated.css : '');
      for (const props of [{}, ...positiveTuples]) { await render(props); assert.equal(await page.locator('#root').textContent(), 'Tag'); }
      await page.close();
      for (const props of [
        { tone: 'a', size: 's', flag: true },
        { tone: 'b', size: 'l', flag: false },
        { tone: 'invalid' }, { tone: null }, { size: null }, { flag: null }, { flag: 'false' },
      ]) {
        const bad = await browser.newPage();
        await mountGenerated(bad, c.name, generated.tsx, 'css' in generated && typeof generated.css === 'string' ? generated.css : '');
        const result = await bad.evaluate(props => {
          let failure: any;
          window.addEventListener('error', event => { failure = event.error; event.preventDefault(); });
          try { (window as any).renderSubject(props); } catch (error) { failure = error; }
          return { refused: failure !== undefined, code: failure?.code, message: failure?.message };
        }, props);
        assert.equal(result.refused, true, JSON.stringify(props));
        assert.equal(result.code, 'DRAWN_VARIANT_UNDECLARED');
        assert.equal(await bad.locator('#root').textContent(), '');
        await bad.close();
      }
    }
  } finally { await browser.close(); }
});

test('positive tuple domain: canonical mapped code values and authored aliases cannot shadow the generated guard', async () => {
  const browser = await chromium.launch();
  try {
    const c = positiveSeed(positiveTuples, raw => {
      raw.props[0].bindings.code = { prop: 'values', values: { a: 1, b: 2, c: 3 } };
      raw.props[1].bindings.code.prop = 'tuple';
      raw.props[2].bindings.code.prop = 'axis';
      raw.props[3].bindings.code.prop = 'globalThis';
    });
    const scope = new Map([[c.id, c]]), icons = new Map<string, string>(), tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    for (const generated of [emitReact(c, { tokens: new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']), contracts: scope, icons }), emitReactInline(c, { tokens, contracts: scope, icons })]) {
      assert.deepEqual(generatedTypeErrors(c.name, generated.tsx), []);
      const page = await browser.newPage(), render = await mountGenerated(page, c.name, generated.tsx, 'css' in generated && typeof generated.css === 'string' ? generated.css : '');
      await render({ values: 2, tuple: 's', axis: false });
      assert.equal(await page.locator('#root').textContent(), 'Tag');
      const result = await page.evaluate(() => {
        let failure: any;
        window.addEventListener('error', event => { failure = event.error; event.preventDefault(); });
        try { (window as any).renderSubject({ values: 2, tuple: 'l', axis: true }); } catch (error) { failure = error; }
        return failure?.code === 'DRAWN_VARIANT_UNDECLARED';
      });
      assert.equal(result, true);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('positive tuple domain: guard reads resolved uncontrolled state and refuses an interaction that leaves the domain', async () => {
  const browser = await chromium.launch();
  try {
    const c = positiveSeed(positiveTuples, raw => {
      raw.semantics = { element: 'button', role: 'checkbox', roleException: 'Declared button-backed toggle.' };
      raw.props[0].bindings.code.initial = { prop: 'defaultTone', default: 'a' };
      raw.events = [{ name: 'change', trigger: 'root', toggles: { prop: 'tone', between: ['a', 'b'], aria: 'checked' }, bindings: { code: { prop: 'onToneChange', argument: 'next-value' } } }];
    });
    const scope = new Map([[c.id, c]]), icons = new Map<string, string>(), tokens = { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    for (const generated of [emitReact(c, { tokens: new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']), contracts: scope, icons }), emitReactInline(c, { tokens, contracts: scope, icons })]) {
      assert.deepEqual(generatedTypeErrors(c.name, generated.tsx), []);
      const page = await browser.newPage(), render = await mountGenerated(page, c.name, generated.tsx, 'css' in generated && typeof generated.css === 'string' ? generated.css : '');
      await page.addStyleTag({ content: ':root{--paint-a:#cc0000;--paint-b:#00aa00;--paint-c:#0000cc;--space-s:8px;--space-l:16px}' });
      await render({ key: 'initial-b', defaultTone: 'b', size: 's', flag: false });
      assert.equal(await page.locator('#root > button').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 170, 0)');
      await page.locator('#root > button').click();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#root > button')!).backgroundColor === 'rgb(204, 0, 0)');
      await page.evaluate(() => {
        window.addEventListener('error', event => { (window as any).drawnFailure = event.error?.code; event.preventDefault(); });
      });
      await render({ key: 'controlled-a', tone: 'a', size: 'l', flag: true });
      // Controlled props remain authoritative: the click does not replace tone.
      await page.locator('#root > button').click();
      assert.equal(await page.locator('#root').textContent(), 'Tag');
      // Recreate the actual generated component with an uncontrolled initial a.
      const bad = await browser.newPage(), renderBad = await mountGenerated(bad, c.name, generated.tsx, 'css' in generated && typeof generated.css === 'string' ? generated.css : '');
      await bad.evaluate(() => { window.addEventListener('error', event => { (window as any).drawnFailure = event.error?.code; event.preventDefault(); }); });
      await renderBad({ key: 'uncontrolled-a', defaultTone: 'a', size: 'l', flag: true });
      await bad.locator('#root > button').click();
      await bad.waitForFunction(() => (window as any).drawnFailure === 'DRAWN_VARIANT_UNDECLARED');
      assert.equal(await bad.locator('#root').textContent(), '');
      await bad.close(); await page.close();
    }
  } finally { await browser.close(); }
});

test('positive tuple domain: retained runtime cannot opt into a generated React guard it does not execute', () => {
  const c = positiveSeed(positiveTuples, raw => {
    raw.bindings.code.runtime = { version: 1, kind: 'custom-element', artifactRevision: 'sha256:' + 'a'.repeat(64), interfaceRevision: 'sha256:' + 'b'.repeat(64), bindingRevision: 'sha256:' + 'c'.repeat(64) };
  });
  const errors: string[] = [];
  validateContract(c, new Map([[c.id, c]]), errors, new Map(), { drawnVariants: 'react-runtime' });
  assert.ok(errors.some(error => error.includes('drawn-variants-surfaces-unqualified')));
  assert.throws(() => emitReact(c, { tokens: new Set(['paint.a', 'paint.b', 'paint.c', 'space.s', 'space.l']), contracts: new Map([[c.id, c]]), icons: new Map() }), /drawn-variants-surfaces-unqualified/);
});

test('positive domain writer: exactly declared rows, default first, actual plugin capture and independently scoped proof', async () => {
  const c = positiveSeed(positiveTuples, raw => { raw.props[0].default = 'b'; });
  const data = engine.compileComponentData(c, new Map([[c.id, c]]));
  assert.equal(data.variants.length, 4);
  assert.equal(data.variants[0].name, 'Tone=B, Size=S, Flag=False');
  assert.deepEqual(data.drawnVariants, positiveTuples, 'canonical declaration order is preserved separately from canvas default order');
  const live = await canvas(), node = await live.write(c), dump = await live.read(node);
  assert.equal(dump.variants.length, 4);
  assert.deepEqual(dump.drawnVariants, positiveTuples);
  assert.equal(verifyFigmaDrawnDomain(c, dump).status, 'source-matrix-verified');
  assert.equal(verifyFigmaDrawnDomain(c, dump, dump.variants).status, 'verified-exact');
  assert.equal((await live.sync(c)).results[0].reason, 'unchanged');
  const changed = structuredClone(dump); changed.variants.pop();
  assert.equal(verifyFigmaDrawnDomain(c, changed).status, 'refused');
  const extra = structuredClone(dump); extra.variants.push({ ...extra.variants[0], variantProperties: { Tone: 'C', Size: 'L', Flag: 'True' } });
  assert.equal(verifyFigmaDrawnDomain(c, extra).status, 'refused');
  const duplicate = structuredClone(dump); duplicate.variants.push(structuredClone(duplicate.variants[0]));
  assert.equal(verifyFigmaDrawnDomain(c, duplicate).status, 'refused');
  assert.equal(verifyFigmaDrawnDomain(c, dump, changed.variants).status, 'refused');
  for (const drawnVariants of [undefined, 'broken-json', positiveTuples.slice(1), [...positiveTuples].reverse()])
    assert.throws(() => verifyFigmaDrawnDomain(c, { ...dump, drawnVariants }), /STAMP_MISMATCH/);
  assert.throws(() => verifyFigmaDrawnDomain(c, { ...dump, contractId: 'another.component' }), /IDENTITY_MISMATCH/);
  const wrongDefault = structuredClone(dump); wrongDefault.propertyDefinitions!.Tone.defaultValue = 'A';
  assert.throws(() => verifyFigmaDrawnDomain(c, wrongDefault), /DEFAULT_MISMATCH/);
  assert.throws(() => verifyFigmaDrawnDomain(seed(undefined), dump), /DECLARATION_REQUIRED/);
  // The production importer remains closed; the raw stamp does not promote a proposal.
  assert.throws(() => proposeFromDump(dump, { corpus: writerCorpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'exact', mintUnbound: true, stampsObservable: true }), /drawn-domain-import-unqualified/);
});

test('positive domain writer: refuses extra/duplicate/missing existing rows before changing stamps or children', async () => {
  const live = await canvas(), c = positiveSeed(), node = await live.write(c);
  const mutable = node as CanvasNode & { setSharedPluginData(ns: string, key: string, value: string): void };
  const victim = node.children[0], name = victim.name;
  mutable.setSharedPluginData('ds_contracts', 'drawnVariants', 'must remain unchanged');
  victim.name = 'Tone=C, Size=L, Flag=True';
  await assert.rejects(live.sync(c), /FIGMA_DRAWN_DOMAIN_EXTRA_OR_DUPLICATE_VARIANT/);
  assert.equal(mutable.getSharedPluginData('ds_contracts', 'drawnVariants'), 'must remain unchanged');
  assert.equal(node.children.length, 4);
  victim.name = node.children[1].name;
  await assert.rejects(live.sync(c), /FIGMA_DRAWN_DOMAIN_EXTRA_OR_DUPLICATE_VARIANT/);
  victim.name = name;
  (node.children[3] as CanvasNode & { remove(): void }).remove();
  await assert.rejects(live.sync(c), /FIGMA_DRAWN_DOMAIN_MISSING_VARIANT/);
  assert.equal(mutable.getSharedPluginData('ds_contracts', 'drawnVariants'), 'must remain unchanged');
  assert.equal(node.children.length, 3);
});

test('positive domain child selections: fixed and parent-mapped undeclared rows refuse at compile', () => {
  const child = positiveSeed();
  const parent = (props: Record<string, string | boolean>, mapped = false): Contract => ContractSchema.parse({
    id: 'check.domain-host', name: 'DomainHost', version: '0.1.0', status: 'draft', description: 'Domain selection host',
    props: mapped ? [enumProp('tone', 'Tone', ['a', 'b', 'c'])] : [], states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' }, parts: { tag: { component: { id: child.id, props } } } } },
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'check/domain-host', export: 'DomainHost' } } },
  });
  const build = (p: Contract) => engine.buildComponentScript(p, new Map([[p.id, p], [child.id, child]]));
  assert.doesNotThrow(() => build(parent({ tone: 'a', size: 'l', flag: true })));
  assert.doesNotThrow(() => build(parent({ tone: 'c' })));
  assert.throws(() => build(parent({ tone: 'c', size: 'l', flag: true })), /FIGMA_COMPONENT_REF_UNDRAWN_VARIANT/);
  assert.throws(() => build(parent({ tone: '{tone}', size: 'l', flag: true }, true)), /FIGMA_COMPONENT_REF_UNDRAWN_VARIANT/);
});

test('positive domain raw capture: plugin and REST preserve valid and malformed stamps without granting authority', async () => {
  const live = await canvas(), c = positiveSeed(), node = await live.write(c);
  (node as CanvasNode & { setSharedPluginData(ns: string, key: string, value: string): void }).setSharedPluginData('ds_contracts', 'drawnVariants', '{broken');
  assert.equal((await live.read(node)).drawnVariants, '{broken');
  for (const stamp of [JSON.stringify(positiveTuples), '{broken']) {
    const response = { name: 'fixture', nodes: { '1:1': { document: { id: '1:1', name: 'Domain', type: 'COMPONENT_SET', children: [], sharedPluginData: { ds_contracts: { drawnVariants: stamp } } } } } };
    const dump = mapRestToDump(response as never, { stampsObservable: true }).dump as unknown as Record<string, DumpSet>;
    assert.deepEqual(dump.Domain.drawnVariants, stamp === '{broken' ? stamp : positiveTuples);
  }
});

test('positive domain inverse stays closed even for a full product, missing stamp or malformed observation', async () => {
  const all = ['a', 'b', 'c'].flatMap(tone => ['s', 'l'].flatMap(size => [false, true].map(flag => ({ tone, size, flag }))));
  const c = positiveSeed(all), live = await canvas(), dump = await live.read(await live.write(c));
  assert.equal(validateExactVariantProjection(dump).status, 'source-matrix-verified');
  const opts = { corpus: writerCorpus, contractIdByName: new Map([[c.name, c.id]]), contractsById: new Map([[c.id, c as never]]), fileKey: null, projectionMode: 'exact' as const, mintUnbound: true, stampsObservable: true };
  assert.throws(() => proposeFromDump(dump, opts), /drawn-domain-import-unqualified/);
  const absent = { ...dump }; delete absent.drawnVariants;
  assert.throws(() => proposeFromDump(absent, opts), /drawn-domain-import-unqualified/);
  for (const drawnVariants of ['broken', null, [], all])
    assert.throws(() => proposeFromDump({ ...dump, drawnVariants }, { ...opts, contractsById: undefined }), /drawn-domain-import-unqualified/);
  const { contractId: _dropped, ...unstamped } = absent;
  assert.throws(() => proposeFromDump(unstamped, opts), /drawn-domain-import-unqualified/);
});

test('positive domain writer: twenty binary axes emit and lay out only twenty-one declared rows, not a million grid cells', async () => {
  const names = Array.from({ length: 20 }, (_, i) => `axis${i}`);
  const defaults = Object.fromEntries(names.map(name => [name, 'off']));
  const domain = [defaults, ...[...names].reverse().map(name => ({ ...defaults, [name]: 'on' }))];
  const c = positiveSeed(domain, raw => {
    raw.props = names.map((name, i) => enumProp(name, `Axis${i}`, ['off', 'on']));
    raw.anatomy.root = { layout: { display: 'flex' }, text: 'Finite domain' };
  });
  const data = engine.compileComponentData(c, new Map([[c.id, c]]));
  assert.equal(data.variants.length, 21);
  assert.ok(data.variants.every(v => v.col < 5 && v.row < 5));
  const live = await canvas(), dump = await live.read(await live.write(c));
  assert.equal(dump.variants.length, 21);
  assert.equal(verifyFigmaDrawnDomain(c, dump, dump.variants).status, 'verified-exact');
});

const domainGeometry = (x = 0) => ({
  box: { x, y: 10, width: 20, height: 20, right: 80 - x, bottom: 70, constraints: { horizontal: 'LEFT', vertical: 'TOP' } },
  parent: { width: 100, height: 100 }, border: { left: 0, right: 0, top: 0, bottom: 0 },
});
const geometrySeed = (props: string[], values: Array<Array<string | null>>, visibleWhen?: Record<string, unknown>) => positiveSeed(positiveTuples, raw => {
  raw.anatomy.root = { literals: { width: '100px', height: '100px' }, parts: {
    item: { ...(visibleWhen ? { visibleWhen } : {}), absoluteGeometryByCombination: { props, rows: values.map((values, i) => ({ values, geometry: domainGeometry(i * 5) })) } },
  } };
});

test('positive geometry domain: covers exactly reachable tuples, rejecting missing, invented, duplicate and nested missing observations', () => {
  const values = positiveTuples.map(tuple => [tuple.tone, tuple.size, String(tuple.flag)]);
  assert.doesNotThrow(() => geometrySeed(['tone', 'size', 'flag'], values));
  assert.throws(() => geometrySeed(['tone', 'size', 'flag'], values.slice(1)), /absolute-geometry-drawn-domain-incomplete/);
  assert.throws(() => geometrySeed(['tone', 'size', 'flag'], [...values, ['c', 'l', 'true']]), /absolute-geometry-drawn-domain-incomplete/);
  assert.throws(() => geometrySeed(['tone', 'size', 'flag'], [...values, values[0]]), /absolute-geometry-duplicate-tuple/);
  assert.throws(() => geometrySeed(['tone', 'size', 'flag'], [['a', 's']]), /absolute-geometry-tuple-arity/);
  const c = geometrySeed(['tone', 'size', 'flag'], values);
  const raw = structuredClone(c) as any;
  raw.anatomy.root.parts.item.parts = { nested: { absoluteGeometryByCombination: { props: ['tone', 'size', 'flag'], rows: values.slice(1).map(values => ({ values, geometry: domainGeometry() })) } } };
  assert.throws(() => ContractSchema.parse(raw), /absolute-geometry-drawn-domain-incomplete/, 'outer tables cannot skip nested validation');
  delete raw.bindings.figma.drawnVariants; delete raw.anatomy.root.parts.item.parts;
  assert.throws(() => ContractSchema.parse(raw), /absolute-geometry-combination-incomplete/, 'no declaration retains the Cartesian rule');
});

test('positive geometry domain: subset-axis projections deduplicate; visibility on an external enum or boolean filters complete tuples before projection', () => {
  const c = geometrySeed(['size'], [['s'], ['l']]);
  assert.deepEqual([...drawnGeometryTupleKeys(c, ['size'])!].sort(), ['["l"]', '["s"]']);
  assert.throws(() => geometrySeed(['size'], [['s']]), /absolute-geometry-drawn-domain-incomplete/, 'projecting fewer axes cannot erase a reachable row');
  assert.doesNotThrow(() => geometrySeed(['size'], [['s']], { prop: 'tone', equals: ['b', 'c'] }));
  assert.throws(() => geometrySeed(['size'], [['s'], ['l']], { prop: 'tone', equals: ['b', 'c'] }), /absolute-geometry-drawn-domain-incomplete/);
  assert.doesNotThrow(() => geometrySeed(['size'], [['l']], { prop: 'flag' }));
  assert.throws(() => geometrySeed(['size'], [['s'], ['l']], { prop: 'flag' }), /absolute-geometry-drawn-domain-incomplete/);
  assert.equal(drawnGeometryTupleKeys(seed(undefined), ['size']), null);
});

const unmarkCandidateFixture = (dump: DumpSet): DumpSet => {
  const source = structuredClone(dump);
  for (const key of ['contractId', 'propNames', 'semantics', 'version', 'drawnVariants', 'codeValueAxes', 'unsetVariantAxes', 'statePreviewAxis']) delete (source as unknown as Record<string, unknown>)[key];
  return source;
};
const candidateOpts = { corpus: writerCorpus, contractIdByName: new Map<string, string>(), fileKey: null, projectionMode: 'exact' as const, mintUnbound: true, stampsObservable: true, hiddenCaptured: true };
const positiveCanvasDeclaration = positiveTuples.map(tuple => ({ Tone: tuple.tone.toUpperCase(), Size: tuple.size.toUpperCase(), Flag: tuple.flag ? 'True' : 'False' }));

test('positive inverse inspection: preserves complete API and defaults, supplied declaration and input bytes; public import stays closed', async () => {
  const c = positiveSeed(positiveTuples, raw => { raw.props[0].default = 'b'; });
  const live = await canvas(), source = unmarkCandidateFixture(await live.read(await live.write(c))), before = JSON.stringify(source);
  const candidate = proposeDeclaredDrawnCandidate(source, candidateOpts, positiveCanvasDeclaration);
  assert.equal(candidate.acceptedContract, null);
  assert.equal(candidate.proposal.projection.status, 'verified-exact');
  const contract = ContractSchema.parse(candidate.proposal.contract);
  const tupleKeys = (rows: Array<Record<string, string | boolean | null>>) => rows.map(tuple => JSON.stringify([tuple.tone, tuple.size, tuple.flag])).sort();
  assert.deepEqual(tupleKeys(contract.bindings.figma.drawnVariants!), tupleKeys(positiveTuples));
  assert.equal(contract.props.find(prop => prop.name === 'tone')?.default, 'b');
  assert.equal(JSON.stringify(source), before);
  assert.throws(() => proposeFromDump(source, candidateOpts), /sparse-matrix-mostly-undrawn/, 'inspection does not change the public route or leak its domain fence');
  const scope = new Map([contract, ...(candidate.proposal.childStubs ?? []).map(stub => ContractSchema.parse(stub))].map(c => [c.id, c]));
  const generated = emitReactInline(contract, { tokens: { primitives: { ...primitives, ...(candidate.proposal.mintedTokens?.tree ?? {}) }, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, contracts: scope, icons: new Map() });
  assert.deepEqual(generatedTypeErrors(contract.name, generated.tsx), []);
  assert.match(generated.tsx, /DRAWN_VARIANT_UNDECLARED/);
});

test('positive inverse inspection: observation/marked-source/bad-declaration guards reject before inversion', async () => {
  const live = await canvas(), marked = await live.read(await live.write(positiveSeed())), source = unmarkCandidateFixture(marked);
  assert.throws(() => proposeDeclaredDrawnCandidate(source, { ...candidateOpts, stampsObservable: false }, positiveCanvasDeclaration), /source-observation-unqualified/);
  assert.throws(() => proposeDeclaredDrawnCandidate(source, { ...candidateOpts, projectionMode: 'reviewable-inversion' }, positiveCanvasDeclaration), /source-observation-unqualified/);
  assert.throws(() => proposeDeclaredDrawnCandidate(marked, candidateOpts, positiveCanvasDeclaration), /source-marked/);
  for (const declaration of [undefined, [], positiveCanvasDeclaration.slice(1), [...positiveCanvasDeclaration, positiveCanvasDeclaration[0]], [...positiveCanvasDeclaration, { Tone: 'C', Size: 'L', Flag: 'True' }]])
    assert.throws(() => proposeDeclaredDrawnCandidate(source, candidateOpts, declaration));
});

test('positive inverse inspection: state-named source axis remains an API axis; no state or mode promotion erases reachable rows', async () => {
  const c = positiveSeed(positiveTuples, raw => {
    raw.props[0].bindings.figma.property = 'State';
    raw.props[0].bindings.figma.values = { a: 'Default', b: 'Hover', c: 'Pressed' };
  });
  const live = await canvas(), source = unmarkCandidateFixture(await live.read(await live.write(c)));
  const declaration = positiveCanvasDeclaration.map(tuple => ({ State: ({ A: 'Default', B: 'Hover', C: 'Pressed' } as Record<string, string>)[tuple.Tone], Size: tuple.Size, Flag: tuple.Flag }));
  const candidate = proposeDeclaredDrawnCandidate(source, candidateOpts, declaration), contract = ContractSchema.parse(candidate.proposal.contract);
  assert.deepEqual(contract.states, []);
  assert.equal(contract.bindings.figma.drawnVariants!.length, 4);
  const prop = contract.props.find(prop => prop.bindings.figma.property === 'State')!;
  assert.deepEqual(prop.type, { enum: ['default', 'hover', 'pressed'] });
  assert.equal(candidate.acceptedContract, null);
});
