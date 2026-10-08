import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {z} from 'zod';
import {ContractSchema, LayoutByCombinationSchema, VectorStrokeTableSchema, refuseVectorStrokeSurface} from '../scripts/contract-schema.js';
import {revisionOf} from './contract-provenance.js';
import {qualifyNativeVectorStrokeCapture, assertQualifiedVectorStrokeCapture} from './source-vector-stroke.js';
import {REACT_VECTOR_STROKE_SELECTOR_SOURCE} from './react-vector-stroke.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {vectorStrokeSourceFixture, vectorStrokeContractFixture} from './vector-stroke.test-fixture.js';

const clone = structuredClone;
function reseal(capture: any) {const {captureRevision: ignored, ...payload} = capture; capture.captureRevision = revisionOf(payload); return capture;}
function qualify(capture: any, dump = vectorStrokeSourceFixture().dump) {return qualifyNativeVectorStrokeCapture(dump, capture, dump._provenance.fileKey);}
function poisons(rows: Array<[(c: any) => void, RegExp]>) {
  for (const [change, reason] of rows) {const f = vectorStrokeSourceFixture(); change(f.capture); assert.throws(() => qualify(reseal(f.capture), f.dump), reason);}
}
const resolveStroke = Function(transformSync(REACT_VECTOR_STROKE_SELECTOR_SOURCE, {loader: 'ts', minify: true}).code + ';return __dscResolveVectorStroke;')();
const contract = () => vectorStrokeContractFixture();
const line = () => contract().anatomy.root.parts!.rule;
const tokens = {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}};

test('source ownership joins all synthetic mains and usage without changing source or rounding endpoint', () => {
  const f = vectorStrokeSourceFixture(), before = JSON.stringify(f), q = qualify(f.capture, f.dump);
  assert.equal(q.owners.size, 3); assert.equal(q.usages.size, 1);
  assert.equal(q.owners.get('10:11')!.stroke!.data, 'M 0 0 L 40 0');
  assert.equal(q.usages.get('20:10')!.stroke.data, 'M 0 0 L 99.99999999999999 0');
  assert.equal(q.usages.get('20:10')!.stroke.height, 0); assert.equal(JSON.stringify(f), before);
});
test('raw byte, parsed object and file version disagreements refuse even after capture reseal', () => poisons([
  [c => c.source.rawDumpSha256 = '0'.repeat(64), /raw-source-bytes/],
  [c => c.source.rawDumpText += ' ', /raw-source-bytes/],
  [c => {c.source.rawDumpText = '{}'; c.source.rawDumpSha256 = createHash('sha256').update('{}').digest('hex');}, /raw-source-object-disagreement/],
  [c => c.source.fileVersion = 'other-version', /source-revision/],
  [c => c.source.dumpRevision = revisionOf({}), /source-revision/],
]));
test('missing, sparse, null and inherited observation records stay distinct and refused', () => {
  poisons([[c => c.occurrences.pop(), /missing-records/], [c => delete c.occurrences[0], /raw-source-bytes/],
    [c => c.occurrences[0] = null, /missing-occurrence-record/], [c => c.occurrences[0].rootId = 'unknown', /occurrence-root/]]);
  const f = vectorStrokeSourceFixture(); Object.setPrototypeOf(f.capture.occurrences[0], {rootId: '30:1'});
  delete f.capture.occurrences[0].rootId; assert.throws(() => qualify(reseal(f.capture), f.dump), /raw-source-bytes/);
});
test('cap, dash, exact path and paint channels require their own source witnesses', () => poisons([
  [c => delete c.mains[0].native.strokeCap, /native-segment-context/],
  [c => c.mains[0].native.dashPattern = [2, 2], /occurrence-main/],
  [c => c.mains[0].native.height = 12, /main-ownership/],
  [c => c.occurrences[0].leaf.vectorPaths[0].data = 'M 0 0 L 100 0', /native-path-network-disagreement/],
  [c => c.occurrences[0].leaf.strokes[0].color.r = 0.1, /occurrence-paint/],
  [c => delete c.mains[0].native.strokes[0].opacity, /native-segment-paint-or-network/],
]));
test('identity, descendant FILL and zero-height centerline allocation are independently guarded', () => poisons([
  [c => c.occurrences[0].leafId = 'unknown', /occurrence-raw-source/],
  [c => c.occurrences[0].main.key = 'unknown', /occurrence-main/],
  [c => c.occurrences[0].leaf.layoutSizingHorizontal = 'FIXED', /occurrence-allocation/],
  [c => c.occurrences[0].leaf.layoutPositioning = 'ABSOLUTE', /occurrence-allocation/],
  [c => c.occurrences[0].leaf.relativeTransform[1][2] = 0, /occurrence-allocation/],
  [c => c.occurrences[0].leaf.height = 1, /native-segment-context/],
]));
test('missing padding cannot be invented by an otherwise valid capture', () => {
  const f = vectorStrokeSourceFixture(); delete f.dump.Meter.variants[0].layout.padding;
  f.capture.source.rawDumpText = JSON.stringify(f.dump); f.capture.source.rawDumpSha256 = createHash('sha256').update(f.capture.source.rawDumpText).digest('hex');
  f.capture.source.dumpRevision = revisionOf(f.dump); assert.throws(() => qualify(reseal(f.capture), f.dump), /main-allocation/);
});
test('internal qualified maps cannot be forged or mutated after their source join', () => {
  const f = vectorStrokeSourceFixture(), q = qualify(f.capture, f.dump); assertQualifiedVectorStrokeCapture(q);
  assert.throws(() => assertQualifiedVectorStrokeCapture({...q, owners: new Map(q.owners)}), /unvalidated-or-changed/);
  q.usages.clear(); assert.throws(() => assertQualifiedVectorStrokeCapture(q), /unvalidated-or-changed/);
});
test('omitted caller choice keeps main paint and explicit choice cannot open unsupported geometry', () => {
  const p = line(), rows = p.vectorStrokeByCombination!.rows, choices = p.vectorStrokeOverride!.choices;
  assert.deepEqual(resolveStroke(rows, ['line'], choices, undefined), rows[0].stroke);
  assert.deepEqual(resolveStroke(rows, ['line'], choices, 'captured'), choices.captured);
  for (const row of rows.filter(r => !r.stroke)) for (const choice of [undefined, 'captured'])
    assert.throws(() => resolveStroke(rows, row.values, choices, choice), new RegExp(row.refusal!));
  for (const choice of [null, false, 'unknown']) assert.throws(() => resolveStroke(rows, ['line'], choices, choice), /override-value-unqualified/);
});
test('unknown, absent, sparse, Boolean and extra selector cells cannot use a known stroke', () => {
  const p = line(); for (const values of [[], ['line', 'extra'], ['unknown'], [false], [null], [,]])
    assert.throws(() => resolveStroke(p.vectorStrokeByCombination!.rows, values, p.vectorStrokeOverride!.choices, 'captured'), /geometry-unqualified/);
});
test('ordinary JSON schema retains dense arrays and explicit null requires a named geometry limit', () => {
  const json: any = z.toJSONSchema(VectorStrokeTableSchema, {target: 'draft-7', io: 'input'});
  assert.equal(json.properties.props.type, 'array'); assert.equal(json.properties.rows.items.properties.values.type, 'array');
  assert(VectorStrokeTableSchema.safeParse({props: ['mode'], rows: [{values: [null], stroke: null, refusal: 'vector-stroke-vertical-unqualified'}]}).success);
  assert(!VectorStrokeTableSchema.safeParse({props: ['mode'], rows: [{values: [null], stroke: null}]}).success);
  for (const field of ['props', 'rows', 'values']) {
    const table: any = {props: ['mode'], rows: [{values: ['line'], stroke: null, refusal: 'vector-stroke-vertical-unqualified'}]};
    delete (field === 'values' ? table.rows[0].values : table[field])[0]; assert(!VectorStrokeTableSchema.safeParse(table).success);
  }
});
test('complete source table and optional owned input remain required at contract schema boundary', () => {
  for (const change of [(c: any) => c.anatomy.root.parts.rule.vectorStrokeByCombination.rows.pop(),
    (c: any) => c.anatomy.root.parts.rule.vectorStrokeByCombination.rows[0].values[0] = 'unknown',
    (c: any) => delete c.bindings.figma.drawnVariants, (c: any) => c.props[2].default = 'captured',
    (c: any) => c.anatomy.root.parts.rule.tokens = {'border-color': '{invented.paint}'},
    (c: any) => c.anatomy.root.parts.rule.layoutByCombination.rows[0].layout.grow = true]) {
    const c = clone(contract()); change(c); assert(!ContractSchema.safeParse(c).success);
  }
  assert(LayoutByCombinationSchema.safeParse({props: ['mode'], rows: [{values: ['line'], layout: {alignSelf: 'stretch'}}]}).success);
});
test('both React generators execute source/default controls and preserve zero logical height with real path paint', () => {
  const c = contract(), contracts = new Map([[c.id, c]]), req = createRequire(import.meta.url);
  const full = emitReact(c, {contracts, tokens: new Set(), icons: new Map()}), inline = emitReactInline(c, {contracts, tokens, icons: new Map()});
  assert.match(full.css, /align-self: stretch/);
  for (const code of [full.tsx, inline.tsx]) {
    const module = {exports: {} as any};
    vm.runInNewContext(transformSync(code, {loader: 'tsx', format: 'cjs', jsx: 'automatic'}).code,
      {module, exports: module.exports, require: (p: string) => p.endsWith('.css') ? {default: new Proxy({}, {get: (_, k) => String(k)})} : req(p)});
    const C = module.exports.Meter, render = (props: any) => renderToStaticMarkup(createElement(C, props));
    assert.match(render({}), /M 0 0 L 40 0/); assert.match(render({stroke: 'captured'}), /99\.99999999999999/);
    assert.match(render({}), /height:0;min-height:0/); assert.match(render({}), /non-scaling-stroke/);
    assert.doesNotMatch(render({mode: 'empty'}), /<svg/);
    assert.throws(() => render({mode: 'empty', showRule: true}), /structural-availability-target-unavailable/);
    assert.throws(() => render({mode: 'dash', stroke: 'captured'}), /vector-stroke-dashed-unqualified/);
    assert.throws(() => render({mode: 'unknown'}), (e: any) => e.code === 'DRAWN_VARIANT_UNDECLARED');
  }
});
test('unqualified native, HTML and Web Components receivers refuse transitive strokes by name', () => {
  const c = contract(), host: any = {id: 'test.host', anatomy: {root: {parts: {meter: {component: {id: c.id}}}}}};
  const contracts = new Map([[c.id, c], [host.id, host]]);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.throws(() => refuseVectorStrokeSurface(host, contracts, surface), new RegExp('vector-stroke-surface-unqualified:' + surface));
});
function nonVectorMultiRootContract() {
  const c = contract(); c.props = [];
  delete c.bindings.figma.drawnVariants;
  c.anatomy = {leading: {literals: {width: '8px', height: '8px'}}, trailing: {literals: {width: '4px', height: '4px'}}};
  return ContractSchema.parse(c);
}
test('ordinary non-vector multi-root anatomy retains actual native compiler admission', async () => {
  const c = nonVectorMultiRootContract(), contracts = new Map([[c.id, c]]);
  assert.equal(Object.hasOwn(c.anatomy, 'root'), false);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.doesNotThrow(() => refuseVectorStrokeSurface(c, contracts, surface));
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const data = createFigmaEngine({tokens, icons: new Map()}).compileComponentData(c, contracts);
  assert.equal(data.variants.length, 1);
  assert.deepEqual(data.variants[0].spec.children!.map(child => child.name), ['leading', 'trailing']);
});
test('a witnessed vector under a later named anatomy root retains exact surface refusal', () => {
  const c = contract(), original = c.anatomy.root;
  c.anatomy = {empty: {literals: {width: '0px', height: '0px'}}, drawing: original};
  const parsed = ContractSchema.parse(c), contracts = new Map([[parsed.id, parsed]]);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.throws(() => refuseVectorStrokeSurface(parsed, contracts, surface),
      (error: unknown) => error instanceof Error && error.message === 'vector-stroke-surface-unqualified:' + surface + ':' + parsed.id);
});
test('linked multi-root dependency cycles cannot hide a later vector root or reject ordinary cycles', () => {
  const first = nonVectorMultiRootContract(), second = nonVectorMultiRootContract(), vector = contract();
  first.id = 'test.first'; second.id = 'test.second';
  first.anatomy.leading.parts = {next: {component: {id: second.id}}};
  second.anatomy.leading.parts = {back: {component: {id: first.id}}};
  const contracts = new Map([[first.id, first], [second.id, second], [vector.id, vector]]);
  for (const surface of ['figma-script', 'html', 'web-components']) {
    assert.doesNotThrow(() => refuseVectorStrokeSurface(first, contracts, surface));
    second.anatomy.trailing.parts = {stroke: {component: {id: vector.id}}};
    assert.throws(() => refuseVectorStrokeSurface(first, contracts, surface),
      (error: unknown) => error instanceof Error && error.message === 'vector-stroke-surface-unqualified:' + surface + ':' + vector.id);
    delete second.anatomy.trailing.parts;
  }
});

test('slot default vector dependencies refuse through the public native compiler', async () => {
  const vector = contract(), host = nonVectorMultiRootContract(); host.id = 'test.slot-host';
  host.anatomy.trailing.parts = {content: {slot: {name: 'content', defaultContent: [{id: vector.id}]}}};
  const parsed = ContractSchema.parse(host), contracts = new Map([[parsed.id, parsed], [vector.id, vector]]);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.throws(() => refuseVectorStrokeSurface(parsed, contracts, surface),
      (error: unknown) => error instanceof Error && error.message === 'vector-stroke-surface-unqualified:' + surface + ':' + vector.id);
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  assert.throws(() => createFigmaEngine({tokens, icons: new Map()}).compileComponentData(parsed, contracts),
    (error: unknown) => error instanceof Error && error.message === 'vector-stroke-surface-unqualified:figma-script:' + vector.id);
});
test('ordinary slot default dependency cycles retain vector guard and native compiler admission', async () => {
  const first = nonVectorMultiRootContract(), second = nonVectorMultiRootContract();
  first.id = 'test.slot-first'; second.id = 'test.slot-second';
  first.anatomy.leading.parts = {next: {slot: {name: 'next', defaultContent: [{id: second.id}]}}};
  second.anatomy.leading.parts = {back: {slot: {name: 'back', defaultContent: [{id: first.id}]}}};
  const a = ContractSchema.parse(first), b = ContractSchema.parse(second), contracts = new Map([[a.id, a], [b.id, b]]);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.doesNotThrow(() => refuseVectorStrokeSurface(a, contracts, surface));
  const {createFigmaEngine} = await import('./emit-figma-script.js');
  const data = createFigmaEngine({tokens, icons: new Map()}).compileComponentData(a, contracts);
  assert.equal(data.variants.length, 1);
  assert.equal(data.variants[0].spec.children![0].children![0].slotDefault![0].contractId, b.id);
});
test('mixed dependency cycles cannot hide a later transitive slot default vector', () => {
  const first = nonVectorMultiRootContract(), second = nonVectorMultiRootContract(), vector = contract();
  first.id = 'test.mixed-first'; second.id = 'test.mixed-second';
  first.anatomy.leading.parts = {next: {component: {id: second.id}}};
  second.anatomy.leading.parts = {back: {slot: {name: 'back', defaultContent: [{id: first.id}]}}};
  const a = ContractSchema.parse(first), b = ContractSchema.parse(second), contracts = new Map([[a.id, a], [b.id, b], [vector.id, vector]]);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.doesNotThrow(() => refuseVectorStrokeSurface(a, contracts, surface));
  second.anatomy.trailing.parts = {stroke: {slot: {name: 'stroke', defaultContent: [{id: vector.id}]}}};
  const changed = ContractSchema.parse(second); contracts.set(changed.id, changed);
  for (const surface of ['figma-script', 'html', 'web-components'])
    assert.throws(() => refuseVectorStrokeSurface(a, contracts, surface),
      (error: unknown) => error instanceof Error && error.message === 'vector-stroke-surface-unqualified:' + surface + ':' + vector.id);
});
test('ownership admission is independent of source display names', () => {
  const f = vectorStrokeSourceFixture(); for (const set of Object.values(f.dump) as any[]) if (set.variants) set.setName = 'Different display label';
  f.capture.source.rawDumpText = JSON.stringify(f.dump); f.capture.source.rawDumpSha256 = createHash('sha256').update(f.capture.source.rawDumpText).digest('hex');
  f.capture.source.dumpRevision = revisionOf(f.dump); assert.equal(qualify(reseal(f.capture), f.dump).usages.size, 1);
});
