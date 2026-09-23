import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { nativeFixtureHost } from '../source-reference/native-operation-test-fixture.js';
import { layeredNativeTokenModes, type LayeredNativeTokenMode } from './layered-native-token-modes.js';
import { prepareNativeTokenContext, verifyNativeTokenContextReceipt, type NativeTokenContextInput } from './native-token-context.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { revisionOf } from './contract-provenance.js';
import { type TokenTreeInput } from './tokens.js';

const leaf = ($type: string, $value: unknown) => ({ $type, $value });
const trees = (): TokenTreeInput => ({
  primitives: {
    ink: leaf('color', '#112233'), paper: leaf('color', '#ddeeff'),
    small: leaf('dimension', '14px'), large: leaf('dimension', '22px'),
    gap: leaf('dimension', '1.000001px'),
  },
  semantic: {
    imported: { label: { $type: 'dimension', 'font-size': { $value: '14px',
      $extensions: { dsContracts: { textStyle: { name: 'Captured label', key: 'source-key' } } } } } },
    size: leaf('dimension', '{brand.size}'), paint: leaf('color', '{ink}'),
  },
  light: { paint: leaf('color', '{ink}') }, dark: { paint: leaf('color', '{paper}') },
  brands: { default: { 'brand.size': leaf('dimension', '{small}') }, alternate: { 'brand.size': leaf('dimension', '{large}') } },
});
const contexts: LayeredNativeTokenMode[] = [
  { sourceMode: 'light', brand: 'default', nativeModeName: 'Default Light' },
  { sourceMode: 'dark', brand: 'default', nativeModeName: 'Default Dark' },
  { sourceMode: 'light', brand: 'alternate', nativeModeName: 'Alternate Light' },
  { sourceMode: 'dark', brand: 'alternate', nativeModeName: 'Alternate Dark' },
];
const request = (layers = trees()): NativeTokenContextInput => {
  const routed = layeredNativeTokenModes(layers, contexts);
  return { fileKey: 'mock-file', scopeId: 'layered-probe', writeProtocol: 'explicit-modes-v1',
    source: { revision: 'test-source', sourceProgramSha256: 'a'.repeat(64), tokensSha256: routed.tokensSha256 },
    tokenPaths: ['imported.label.font-size', 'paint', 'size', 'gap'], modes: routed.modes };
};
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x));

test('explicit mode routing preserves literals, alias targets, precedence and the original compiler input', () => {
  const layers = trees(), before = structuredClone(layers);
  const contract = ContractSchema.parse({
    id: 'test.layered-routing', name: 'LayeredRouting', version: '0.1.0', status: 'draft', archetype: 'none',
    description: 'Original compiler-input preservation', props: [], states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' }, parts: { label: { text: 'Label', tokens: {
      'font-size': '{imported.label.font-size}', color: '{paint}',
    } } } } }, bindings: { code: { anchors: { importPath: 'test/LayeredRouting', export: 'LayeredRouting' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const compile = () => createFigmaEngine({ tokens: layers, icons: new Map() }).compileComponentData(contract, new Map([[contract.id, contract]]));
  const compiledBefore = compile(), mapped = layeredNativeTokenModes(layers, contexts);
  assert.deepEqual(layers, before);
  assert.deepEqual(compile(), compiledBefore);
  assert.equal(compiledBefore.variants[0].spec.children?.[0].textStyle, undefined);
  assert.equal(mapped.tokensSha256, revisionOf(layers).slice(7));
  const values = mapped.modes.map(m => m.tokens as Record<string, { $type: string; $value: unknown; $extensions?: unknown }>);
  assert.deepEqual(values.map(t => [t.paint.$value, t['brand.size'].$value]),
    [['{ink}', '{small}'], ['{paper}', '{small}'], ['{ink}', '{large}'], ['{paper}', '{large}']]);
  assert.deepEqual(values.map(t => t['imported.label.font-size'].$type), ['dimension', 'dimension', 'dimension', 'dimension']);
  values[0]['imported.label.font-size'].$value = '999px';
  (values[0]['imported.label.font-size'].$extensions as any).dsContracts.textStyle.name = 'changed';
  assert.deepEqual(layers, before, 'returned allocation trees have no mutable source aliases');
  assert.equal(values[1]['imported.label.font-size'].$value, '14px');
});

test('ambiguous or missing contexts and malformed source trees refuse before allocation', () => {
  for (const invalid of [[], [contexts[0], contexts[0]], [contexts[0], { ...contexts[1], nativeModeName: contexts[0].nativeModeName }],
    [{ ...contexts[0], brand: 'missing' }], [{ ...contexts[0], sourceMode: 'invented' }], [{ ...contexts[0], nativeModeName: ' padded ' }]]) {
    assert.throws(() => layeredNativeTokenModes(trees(), invalid as LayeredNativeTokenMode[]), /layered-native-tokens-context/);
  }
  const ambiguous = trees();
  ambiguous.semantic['imported.label.font-size'] = leaf('dimension', '16px');
  assert.throws(() => layeredNativeTokenModes(ambiguous, contexts), /token-path-ambiguous/);
  for (const bad of [Infinity, NaN, undefined, new Date(), () => 1]) {
    const layers = trees(); layers.primitives.bad = leaf('number', bad);
    assert.throws(() => layeredNativeTokenModes(layers, contexts), /tree-not-json/);
  }
  for (const bad of [null, true, [], 'bad']) {
    const layers = trees(); layers.dark = bad as any;
    assert.throws(() => layeredNativeTokenModes(layers, contexts), /tree-shape/);
  }
  const cycle = trees(); cycle.primitives.loop = cycle.primitives;
  assert.throws(() => layeredNativeTokenModes(cycle, contexts), /tree-not-json/);
});

test('routing retains the scoped planner refusals for bad aliases, missing types and incompatible modes', () => {
  for (const edit of [
    (t: TokenTreeInput) => { t.semantic.size = leaf('dimension', '{missing}'); },
    (t: TokenTreeInput) => { t.semantic.size = leaf('dimension', '{size}'); },
    (t: TokenTreeInput) => { t.semantic.size = { $value: '14px' }; },
    (t: TokenTreeInput) => { t.semantic.size = leaf('number', '{brand.size}'); },
    (t: TokenTreeInput) => { t.dark.size = leaf('color', '#123'); },
  ]) {
    const layers = trees(); edit(layers);
    assert.throws(() => prepareNativeTokenContext(request(layers)), /native-token-context-/);
  }
});

test('existing scoped allocation preserves foreign variables and reads aliases by exact ID in all four explicit contexts', async () => {
  const input = request(), prep = prepareNativeTokenContext(input);
  const mock = nativeFixtureHost({ modeLimit: 4 }); mock.figma.fileKey = input.fileKey;
  const foreign = mock.figma.variables.createVariableCollection('Semantic');
  const twin = mock.figma.variables.createVariable('ink', foreign, 'COLOR');
  twin.setValueForMode(foreign.modes[0].modeId, { r: 0, g: 0, b: 0, a: 1 });
  const foreignBefore = JSON.stringify({ collection: foreign, variable: twin });
  const context = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async () => {${script}\n})()`, context);
  const created = await run(emitNativeTokenContextScript(input).script);
  assert.equal(created.status, 'created-candidate', JSON.stringify(created.problems));
  assert.equal((await mock.figma.getLocalTextStylesAsync()).length, 0);
  assert.equal(JSON.stringify({ collection: foreign, variable: twin }), foreignBefore);
  const identity = plain(created.creationIdentity);
  const readback = await run(emitNativeTokenContextReadbackScript(input, identity));
  assert.equal(readback.status, 'readback-collected');
  const verify = (receipt: any) => verifyNativeTokenContextReceipt({ input, expectedIdentity: identity, receipt: plain(receipt) });
  assert.equal(verify(readback.receipt).status, 'native-token-context-observed');
  const byPath = new Map<string, any>(identity.variables.map((v: any) => [v.tokenPath, v]));
  const paint = mock.variables.find((v: any) => v.id === byPath.get('paint').id);
  const brand = mock.variables.find((v: any) => v.id === byPath.get('brand.size').id);
  for (let i = 0; i < contexts.length; i++) {
    const mode = identity.modes[i].modeId;
    assert.equal(paint.valuesByMode[mode].id, byPath.get(i % 2 ? 'paper' : 'ink').id);
    assert.equal(brand.valuesByMode[mode].id, byPath.get(i < 2 ? 'small' : 'large').id);
  }
  const edited = plain(readback.receipt);
  edited.variables.find((v: any) => v.name === 'gap').valuesByMode[identity.modes[0].modeId] = 1.000002;
  assert.equal(verify(edited).status, 'refused', 'differences below four decimal places stay visible');
  const redirected = plain(readback.receipt);
  redirected.variables.find((v: any) => v.name === 'paint').valuesByMode[identity.modes[0].modeId].id = twin.id;
  assert.equal(verify(redirected).status, 'refused', 'same-name foreign aliases cannot substitute for owned IDs');
  const identities = mock.variables.map((v: any) => v.id), beforeRepeat = JSON.stringify(mock.variables);
  const repeated = await run(emitNativeTokenContextScript(input).script);
  assert.equal(repeated.status, 'refused');
  assert.deepEqual(plain(repeated.problems), ['native-token-write-collection-name-collision']);
  assert.deepEqual(mock.variables.map((v: any) => v.id), identities);
  assert.equal(JSON.stringify(mock.variables), beforeRepeat, 'a direct create replay cannot allocate duplicates or change values');
  assert.equal(prep.variables.length, identity.variables.length);
});
