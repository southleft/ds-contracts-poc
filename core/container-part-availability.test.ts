import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {qualifyDirectPartAvailability, qualifyOwnedContainerAvailability, qualifyOwnedTextAvailability} from './source-part-availability.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpNode, DumpSet} from '../extract/figma/types.js';

// A full 2×2 set whose Content frame (it owns a mark) is absent where A=X, B=Q.
const domain = [{A: 'X', B: 'P'}, {A: 'X', B: 'Q'}, {A: 'Y', B: 'P'}, {A: 'Y', B: 'Q'}];
const axes: Array<{property: string; prop: string; values: string[]; map: Record<string, string>}> = [{property: 'A', prop: 'a', values: ['X', 'Y'], map: {X: 'x', Y: 'y'}}, {property: 'B', prop: 'b', values: ['P', 'Q'], map: {P: 'p', Q: 'q'}}];
const raw = () => domain.map(t => [axes[0].map[t.A], axes[1].map[t.B]]);
const layout = {mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO'} as DumpNode['layout'];
const frame = (i: number): DumpNode => ({name: 'Content', type: 'FRAME', nodeId: 'content' + i, layout,
  children: [{name: 'Mark', type: 'RECTANGLE', nodeId: 'mark' + i, bbox: {width: 8, height: 8}, fill: {hex: '525252'}}]});
// composed: Content is an instance whose captured caller composition is that frame.
function source(composed = false): DumpSet {
  const definitions = {A: {type: 'VARIANT', defaultValue: 'X', variantOptions: ['X', 'Y']}, B: {type: 'VARIANT', defaultValue: 'P', variantOptions: ['P', 'Q']}};
  return {setName: 'Row', type: 'COMPONENT_SET', nodeId: 'set', key: 'row-set', propertyDefinitions: definitions as DumpSet['propertyDefinitions'],
    variants: domain.map((tuple, i) => ({name: `A=${tuple.A}, B=${tuple.B}`, nodeId: 'main' + i, type: 'COMPONENT', variantProperties: {...tuple}, layout,
      children: i === 1 ? [] : [composed ? {name: 'Content', type: 'INSTANCE', nodeId: 'content' + i, instanceKey: 'mark-key',
        instanceGeometry: {nodeId: 'content' + i, componentId: 'mark', transform: [[1, 0, 0], [0, 1, 0]], localSize: {width: 8, height: 8}}, instanceComposition: {source: {nodeId: 'content' + i, componentId: 'mark', key: 'mark-key'}, applied: {}, root: frame(i)}} : frame(i)]}))};
}
const occurrences = (s: DumpSet) => s.variants.flatMap(v => (v.children ?? []).map(node => ({variant: v.name, node: node.instanceComposition?.root ?? node})));

test('a container part takes exact original-path membership; leaf witnesses do not claim it', () => {
  for (const composed of [false, true]) {
    const s = source(composed), before = JSON.stringify(s), occ = occurrences(s);
    assert.equal(qualifyDirectPartAvailability(s, occ, axes, raw(), true), undefined);
    assert.equal(qualifyOwnedTextAvailability(s, occ, axes, raw(), true), undefined);
    assert.deepEqual(qualifyOwnedContainerAvailability(s, occ, axes, raw(), true)?.rows.map(r => r.present), [true, false, true, true]);
    assert.equal(JSON.stringify(s), before);
    assert.equal(qualifyOwnedContainerAvailability(s, occ, axes, raw(), false), undefined, 'needs the qualified drawn domain');
  }
  for (const mutate of [(s: any) => { s.variants[2].children[0].name = 'Moved'; }, (s: any) => { s.variants[2].children[0].hidden = true; },
    (s: any) => { s.variants[2].children[0].instanceComposition.root.nodeId = 'other'; }, (s: any) => { s.variants[3].children[0].instanceComposition.root.children = []; }]) {
    const s = source(true), occ = occurrences(source(true));
    mutate(s);
    assert.equal(qualifyOwnedContainerAvailability(s, occ, axes, raw(), true), undefined);
  }
});

test('container-part-availability-by-path: off refuses the hidden container, on carries its availability', () => {
  const target = {instanceId: 'usage', componentId: 'main0', nodeId: 'Iusage;content0', instancePath: [], childPath: [0], visible: false};
  const run = (conventions: string[]) => proposeFromDump(source(true), {corpus: tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}}),
    contractIdByName: new Map(), mintUnbound: true, fileKey: 'file', projectionMode: 'exact', stampsObservable: true, hiddenCaptured: true,
    drawnVariantSurface: 'react-runtime', visibilityDemands: [{fileKey: 'file', target}], conventions} as Parameters<typeof proposeFromDump>[1]);
  assert.throws(() => run([]), /visibility-demand-owned-part-unqualified/);
  const contract = ContractSchema.parse(run(['container-part-availability-by-path']).contract);
  const part = walkAnatomy(contract).find(w => w.part.availabilityByCombination)!.part;
  assert(part.parts && part.visibilityOverrideProp);
  assert.deepEqual(part.availabilityByCombination!.rows.map(r => r.present), [true, false, true, true]);
  assert.equal(contract.bindings.figma.drawnVariants!.length, 4);
});
