import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync, linkSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {vectorStrokeSourceFixture} from '../core/vector-stroke.test-fixture.js';
import {prepareNativeVectorStrokeInput, assembleNativeVectorStrokeCapture, planNativeVectorStrokeRead,
  buildNativeVectorStrokeRead, assertNativeVectorInputPaths} from './native-vector-stroke-capture.js';
import {figmaToReact, runFigmaToReact, type EngineLoader} from './figma-to-react-lib.js';

test('explicit new receipt supplies an immutable clone with independently authenticated raw bytes', () => {
  const f = vectorStrokeSourceFixture(), before = JSON.stringify(f), input = prepareNativeVectorStrokeInput(f.rawDumpText, f.capture);
  assert.deepEqual(input._nativeVectorStrokeCapture, f.capture); assert.equal(JSON.stringify(f), before);
  (input._nativeVectorStrokeCapture as any).occurrences.length = 0; assert.equal(f.capture.occurrences.length, 1);
  for (const raw of [f.rawDumpText + '\n', '{}']) assert.throws(() => prepareNativeVectorStrokeInput(raw, f.capture), /raw-source-changed/);
  assert.throws(() => prepareNativeVectorStrokeInput(f.rawDumpText, {...f.capture, kind: 'native-stroke-capture'}), /receipt-invalid/);
});
test('generic assembler requires exact before/after reference and native observation file identity', () => {
  const f = vectorStrokeSourceFixture(), observed = {fileKey: f.dump._provenance.fileKey, mains: f.capture.mains, occurrences: f.capture.occurrences};
  assert.deepEqual(assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, f.capture.reference, observed), f.capture);
  const after = structuredClone(f.capture.reference); after.version = 'changed';
  assert.throws(() => assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, after, observed), /acquisition-source-changed/);
  assert.throws(() => assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, f.capture.reference, {...observed, fileKey: 'WrongFile'}), /acquisition-source-changed/);
  const missing = structuredClone(observed); missing.mains.pop();
  assert.throws(() => assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, f.capture.reference, missing), /membership-unqualified/);
});
test('source-derived read plan preserves physical absence, exact instance IDs and unrelated display labels', () => {
  const f = vectorStrokeSourceFixture(), plan = planNativeVectorStrokeRead(f.rawDumpText, f.capture.reference);
  assert.deepEqual(plan.mains.map(m => m.nodeId), f.capture.mains.map((m: any) => m.nodeId));
  assert.deepEqual(plan.occurrences, [{rootId: '30:1', hostId: 'I30:10;20:10', leafId: 'I30:10;20:10;10:11'}]);
  f.dump.Meter.setName = 'Unrelated'; assert.deepEqual(planNativeVectorStrokeRead(JSON.stringify(f.dump), f.capture.reference), plan);
  delete f.dump.Meter.variants[0].componentKey;
  assert.throws(() => planNativeVectorStrokeRead(JSON.stringify(f.dump), f.capture.reference), /direct-owner-unqualified/);
});
test('generated read-only native program observes explicit channels and feeds the ordinary assembler', async () => {
  const f = vectorStrokeSourceFixture(), plan = planNativeVectorStrokeRead(f.rawDumpText, f.capture.reference), nodes = new Map<string, any>();
  for (const main of f.capture.mains) {
    const parent = {id: main.componentId, key: main.componentKey, parent: {key: main.setKey}};
    nodes.set(main.nodeId, {...structuredClone(main.native), id: main.nodeId, parent});
  }
  const row = f.capture.occurrences[0], main = {id: row.main.id, key: row.main.key, parent: {key: row.main.componentSetKey}};
  const host = {...structuredClone(row.host), id: row.hostId, relativeTransform: row.hostTransform,
    absoluteBoundingBox: row.hostBox, getMainComponentAsync: async () => main};
  const leaf = {...structuredClone(row.leaf), id: row.leafId, parent: host, absoluteBoundingBox: row.leafBox, absoluteRenderBounds: row.paintBox};
  nodes.set(row.hostId, host); nodes.set(row.leafId, leaf);
  const execute = Function('figma', `return (async()=>{${buildNativeVectorStrokeRead(plan)}})();`);
  const observed = await execute({fileKey: plan.fileKey, getNodeByIdAsync: async (id: string) => nodes.get(id)});
  const capture = assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, f.capture.reference, observed);
  assert.equal(capture.occurrences[0].leaf.vectorPaths[0].data, 'M 0 0 L 99.99999999999999 0');
  await assert.rejects(execute({fileKey: 'WrongFile'}), /file-mismatch/);
  leaf.strokeCap = undefined;
  const unsupported = await execute({fileKey: plan.fileKey, getNodeByIdAsync: async (id: string) => nodes.get(id)});
  assert.equal(unsupported.occurrences[0].leaf.strokeCap, null);
  assert.throws(() => assembleNativeVectorStrokeCapture(f.rawDumpText, f.capture.reference, f.capture.reference, unsupported), /native-segment-context/);
  leaf.vectorPaths[0].data = 'M' + '0'.repeat(20000);
  await assert.rejects(execute({fileKey: plan.fileKey, getNodeByIdAsync: async (id: string) => nodes.get(id)}), /response-budget-exceeded/);
});
test('new source/capture inputs refuse reserved output paths and filesystem aliases', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-input-paths-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const out = path.join(root, 'out'), source = path.join(root, 'source.json'), capture = path.join(root, 'capture.json');
  mkdirSync(out); writeFileSync(source, 'source'); writeFileSync(capture, 'capture');
  for (const name of ['request.json', 'result.json', 'dump.json', 'native-vector-stroke-receipt.json', 'work/input.json', 'check/receipt.json']) {
    assert.throws(() => assertNativeVectorInputPaths(out, path.join(out, name), capture), /input-conflicts-with-output/);
    assert.throws(() => assertNativeVectorInputPaths(out, source, path.join(out, name)), /input-conflicts-with-output/);
  }
  assert.doesNotThrow(() => assertNativeVectorInputPaths(out, path.join(out, 'dump.json'), capture, 'figma'));
  symlinkSync(source, path.join(out, 'request.json')); assert.throws(() => assertNativeVectorInputPaths(out, source, capture), /output-aliases-input/);
  rmSync(path.join(out, 'request.json')); linkSync(capture, path.join(out, 'result.json'));
  assert.throws(() => assertNativeVectorInputPaths(out, source, capture), /output-aliases-input/);
  rmSync(path.join(out, 'result.json')); symlinkSync(out, path.join(root, 'alias-out'));
  assert.throws(() => assertNativeVectorInputPaths(path.join(root, 'alias-out'), path.join(out, 'request.json'), capture), /input-conflicts-with-output/);
});
test('ordinary shared command carries new receipt before headless import while original bytes remain unchanged', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-command-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const f = vectorStrokeSourceFixture(), source = path.join(root, 'source.json'), capture = path.join(root, 'capture.json'), out = path.join(root, 'out');
  writeFileSync(source, f.rawDumpText); writeFileSync(capture, JSON.stringify(f.capture)); let closed = 0;
  const loader: EngineLoader = async () => ({engine: {figmaDumpToLibraryRequest(input) {
    assert.deepEqual((input as any)._nativeVectorStrokeCapture, f.capture);
    const {_nativeVectorStrokeCapture: ignored, ...original} = input; assert.deepEqual(original, f.dump);
    throw Error('TEST_IMPORT_BOUNDARY');
  }}, close: async () => {closed++;}});
  await assert.rejects(runFigmaToReact({dump: source, out, nativeStrokes: capture}, {loadEngine: loader, label: 'test', log: () => {}}), /TEST_IMPORT_BOUNDARY/);
  assert.equal(closed, 1); assert.equal(readFileSync(source, 'utf8'), f.rawDumpText);
  assert.equal(readFileSync(capture, 'utf8'), JSON.stringify(f.capture));
  assert(!existsSync(path.join(out, 'native-stroke-dump.json')));
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'native-vector-stroke-receipt.json'), 'utf8')), f.capture);
});
test('direct shared import rejects source clobber and false raw authority before loading the engine', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-direct-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const f = vectorStrokeSourceFixture(), out = path.join(root, 'out'); mkdirSync(out);
  const source = path.join(out, 'request.json'); writeFileSync(source, f.rawDumpText); let loaded = 0;
  const loader: EngineLoader = async () => {loaded++; throw Error('UNEXPECTED_ENGINE');};
  await assert.rejects(figmaToReact(loader, source, out, undefined, 'json', {nativeVectorStrokeCapture: f.capture}), /input-conflicts-with-output/);
  const external = path.join(root, 'external.json'); writeFileSync(external, f.rawDumpText + '\n');
  await assert.rejects(figmaToReact(loader, external, path.join(root, 'new-out'), undefined, 'json', {nativeVectorStrokeCapture: f.capture}), /raw-source-changed/);
  assert.equal(loaded, 0); assert.equal(readFileSync(source, 'utf8'), f.rawDumpText);
});
test('new URL receipt conflict refuses before fetching can replace the capture with dump.json', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-url-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const f = vectorStrokeSourceFixture(), out = path.join(root, 'out'); mkdirSync(out);
  const capture = path.join(out, 'dump.json'), original = JSON.stringify(f.capture); writeFileSync(capture, original);
  await assert.rejects(runFigmaToReact({url: 'https://www.figma.com/design/SyntheticFile/Test?node-id=30-0', out, nativeStrokes: capture},
    {loadEngine: async () => {throw Error('UNEXPECTED_ENGINE');}, label: 'test'}), /input-conflicts-with-output/);
  assert.equal(readFileSync(capture, 'utf8'), original);
});
test('unknown capture kind is named refused and never enters the engine', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-kind-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const f = vectorStrokeSourceFixture(), source = path.join(root, 'source.json'), capture = path.join(root, 'capture.json');
  writeFileSync(source, f.rawDumpText); writeFileSync(capture, JSON.stringify({...f.capture, kind: 'unknown'}));
  await assert.rejects(runFigmaToReact({dump: source, out: path.join(root, 'out'), nativeStrokes: capture},
    {loadEngine: async () => {throw Error('UNEXPECTED_ENGINE');}, label: 'test'}), /receipt-kind-unsupported/);
});
test('null, array and malformed receipt kinds retain the old named invalid-receipt refusal', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-invalid-kind-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const f = vectorStrokeSourceFixture(), source = path.join(root, 'source.json'), capture = path.join(root, 'capture.json');
  writeFileSync(source, f.rawDumpText);
  for (const receipt of [null, [], {}, {kind: null}, {kind: false}, {kind: 1}]) {
    writeFileSync(capture, JSON.stringify(receipt));
    await assert.rejects(runFigmaToReact({dump: source, out: path.join(root, 'out'), nativeStrokes: capture},
      {loadEngine: async () => {throw Error('UNEXPECTED_ENGINE');}, label: 'test'}), /native-stroke-supplement-receipt-invalid/);
    assert.equal(readFileSync(source, 'utf8'), f.rawDumpText);
  }
});
test('ordinary old receipt branch still supplies its enriched dump and keeps the original input unchanged', async t => {
  const root = mkdtempSync(path.join(tmpdir(), 'old-stroke-command-')); t.after(() => rmSync(root, {recursive: true, force: true}));
  const source = path.join(root, 'source.json'), capture = path.join(root, 'capture.json'), out = path.join(root, 'out');
  const geometry = {parentId: '1:1', transform: [[1, 0, 8], [0, 1, 6]], localSize: {width: 7, height: 7}, parentSize: {width: 20, height: 20}};
  const dump = {_provenance: {fileKey: 'OldSourceFile'}, Example: {variants: [{children: [{nodeId: '1:2', type: 'VECTOR',
    localGeometry: geometry, stroke: {hex: 'ffffff'}, strokeWeight: 1, strokeAlign: 'CENTER'}]}]}};
  const shape = {kind: 'stroked-path', width: 7, height: 7, strokePath: {data: 'M0 7L7 0M4 7L7 4', cap: 'NONE', join: 'MITER',
    miterLimit: 4, constraints: {horizontal: 'MAX', vertical: 'MAX'}, viewport: {width: 20, height: 20, x: 8, y: 6}}};
  const receipt = {version: 1, kind: 'native-stroke-capture', fileKey: 'OldSourceFile', records: [{nodeId: '1:2', parentId: '1:1',
    localGeometry: {transform: geometry.transform, localSize: geometry.localSize, parentSize: geometry.parentSize},
    strokeWeight: 1, strokeAlign: 'CENTER', strokes: [{type: 'SOLID', blendMode: 'NORMAL', color: {r: 1, g: 1, b: 1}}], shape, issue: null}]};
  const original = JSON.stringify(dump); writeFileSync(source, original); writeFileSync(capture, JSON.stringify(receipt));
  await assert.rejects(runFigmaToReact({dump: source, out, nativeStrokes: capture}, {label: 'test', log: () => {},
    loadEngine: async () => ({engine: {figmaDumpToLibraryRequest(input) {
      assert.deepEqual((input as any).Example.variants[0].children[0].shape, shape);
      assert(!Object.hasOwn(input, '_nativeVectorStrokeCapture')); throw Error('TEST_OLD_IMPORT_BOUNDARY');
    }}})}), /TEST_OLD_IMPORT_BOUNDARY/);
  assert.equal(readFileSync(source, 'utf8'), original);
  assert.deepEqual(JSON.parse(readFileSync(path.join(out, 'native-stroke-dump.json'), 'utf8')).Example.variants[0].children[0].shape, shape);
  assert(!existsSync(path.join(out, 'native-vector-stroke-receipt.json')));
});
