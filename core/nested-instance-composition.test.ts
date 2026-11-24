import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRestToDump, type RestNode, type RestNodesResponse} from '../extract/figma/rest/map.js';
import {observeInstanceComposition} from '../extract/figma/rest/observed-composition.js';
import {proposeBatchFromDump, asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {validateContract} from './emit-react.js';

const corpus = tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}});
const size = {x: 20, y: 20}, box = {x: 0, y: 0, width: 20, height: 20}, at = (x: number, y: number) => [[1, 0, x], [0, 1, y]];
// A use of a linked child whose drawn subtree holds a nested (remote) instance: use → nested instance → one filled vector.
const use = (): RestNode => ({id: 'use', name: 'Badge', type: 'INSTANCE', componentId: 'main', size, absoluteBoundingBox: box, relativeTransform: at(0, 0),
  clipsContent: false, fills: [{type: 'SOLID', color: {r: 1, g: 1, b: 1, a: 1}, opacity: 0.00001}],
  children: [{id: 'I-use;glyph', name: 'Glyph', type: 'INSTANCE', componentId: 'remote', size, absoluteBoundingBox: box, relativeTransform: at(0, 0),
    clipsContent: true, children: [{id: 'I-use;ink', name: 'Vector', type: 'VECTOR', size: {x: 16, y: 16}, absoluteBoundingBox: {x: 2, y: 2, width: 16, height: 16},
      relativeTransform: at(2, 2), fills: [{type: 'SOLID', color: {r: 0.85, g: 0.12, b: 0.16, a: 1}}], strokes: [],
      fillGeometry: [{path: 'M8 0C12.4 0 16 3.6 16 8C16 12.4 12.4 16 8 16C3.6 16 0 12.4 0 8C0 3.6 3.6 0 8 0Z', windingRule: 'NONZERO'}]} as RestNode]} as RestNode]});
const identities = new Map([['main', {key: 'main-key'}], ['remote', {key: 'remote-key'}]]);

test('observeInstanceComposition: nested instances are refused by default and observed only when asked', () => {
  assert.equal(observeInstanceComposition(use(), identities), undefined);
  const n = use(), before = structuredClone(n), out = observeInstanceComposition(n, identities, true);
  assert(out); assert.deepEqual(n, before); assert.deepEqual(out.source, {nodeId: 'use', componentId: 'main', key: 'main-key'});
  // A nested instance with its own inputs, or a foreign root identity, stays refused.
  const props = use(); (props.children![0] as RestNode).componentProperties = {Size: {type: 'VARIANT', value: '16'}};
  assert.equal(observeInstanceComposition(props, identities, true), undefined);
  assert.equal(observeInstanceComposition(use(), new Map(), true), undefined);
});

const capture = (observe: boolean) => {
  const raw = {name: 'Fixture', nodes: {parent: {document: {id: 'parent', name: 'Host', type: 'COMPONENT', size, absoluteBoundingBox: box, relativeTransform: at(0, 0),
    children: [use()]}, components: {main: {name: 'Badge', key: 'main-key'}, remote: {name: 'Glyph', key: 'remote-key', remote: true}}, styles: {}}}} as unknown as RestNodesResponse;
  const before = JSON.stringify(raw), out = mapRestToDump(raw, {fileKey: 'fixture', ...(observe ? {observeNestedInstanceCompositions: true} : {})});
  assert.equal(JSON.stringify(raw), before); return out.dump;
};
const strip = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (k, v) => k === 'instanceNestedComposition' ? undefined : v));

test('capture: the nested observation is opt-in, drawn as frames, and changes only its own field', () => {
  const off = capture(false), on = capture(true), node = (on.Host as any).variants[0].children[0];
  assert.equal((off.Host as any).variants[0].children[0].instanceNestedComposition, undefined);
  assert.equal(node.instanceComposition, undefined);
  const c = node.instanceNestedComposition; assert(c);
  assert.equal(c.root.type, 'FRAME'); assert.equal(c.root.children[0].type, 'FRAME'); assert.equal(c.root.children[0].instanceOf, undefined);
  assert.equal(c.root.children[0].children[0].type, 'VECTOR');
  assert.deepEqual(strip(on), strip(off));
});

// The linked child holds no drawing content: an empty root, as captured for a main whose drawing lives only in its uses.
const empty = ContractSchema.parse({id: 'ds.badge', name: 'Badge', version: '1.0.0', status: 'draft', description: 'Linked child', semantics: {element: 'div'},
  states: [], props: [], anatomy: {root: {}}, bindings: {code: {anchors: {importPath: './Badge', export: 'Badge'}},
    figma: {anchors: {fileKey: 'fixture', componentSetKey: 'main-key', nodeId: 'main'}}}});
const propose = (conventions: string[], dump = capture(true)) => proposeBatchFromDump(dump, {corpus, mintUnbound: true, conventions,
  contractIdByName: new Map([['Badge', 'ds.badge']]), contractIdByKey: new Map([['main-key', 'ds.badge']]), contractsById: new Map([['ds.badge', asMinimalChildContract(empty)]])});

test('profile convention nested-instance-composition-observed: an empty linked child draws each use\'s observation', () => {
  const ink = /M8 0C12\.4 0 16 3\.6/;
  for (const [conventions, dump] of [[[], capture(true)], [['nested-instance-composition-observed'], capture(false)]] as const) {
    const off = propose([...conventions], dump).proposals[0];
    assert.match(JSON.stringify(off.contract.anatomy), /ds\.badge/); assert.doesNotMatch(JSON.stringify(off.contract.anatomy), ink);
  }
  const on = propose(['nested-instance-composition-observed']).proposals[0];
  assert.doesNotMatch(JSON.stringify(on.contract.anatomy), /ds\.badge/); assert.match(JSON.stringify(on.contract.anatomy), ink);
  assert(on.notes.some(n => n.includes('(profile convention nested-instance-composition-observed)')), JSON.stringify(on.notes));
  const c = ContractSchema.parse(on.contract), errors: string[] = [];
  validateContract(c, new Map([[c.id, c], [empty.id, empty]]), errors, new Map());
  assert.deepEqual(errors, []);
  // A linked child that draws anything of its own keeps precedence over the observation.
  const drawn = ContractSchema.parse({...empty, anatomy: {root: {text: 'Badge'}}});
  const kept = proposeBatchFromDump(capture(true), {corpus, mintUnbound: true, conventions: ['nested-instance-composition-observed'],
    contractIdByName: new Map([['Badge', 'ds.badge']]), contractIdByKey: new Map([['main-key', 'ds.badge']]), contractsById: new Map([['ds.badge', asMinimalChildContract(drawn)]])}).proposals[0];
  assert.match(JSON.stringify(kept.contract.anatomy), /ds\.badge/); assert.doesNotMatch(JSON.stringify(kept.contract.anatomy), ink);
});
