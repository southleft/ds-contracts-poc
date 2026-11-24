import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';

// The Ringed variant rings its box with a 2 px spread shadow outside a 2 px OUTSIDE stroke that paints nothing. Figma
// draws the ring 2 px out from the box with a clear band between; a box-shadow from the border box draws it touching.
const box = (ringed: string, i: number) => ({name: 'Box', type: 'FRAME', nodeId: `5:${i}`, bbox: {width: 20, height: 20}, fill: {hex: 'ffffff'},
  ...(ringed === 'Yes' ? {stroke: {hex: 'ffffff', alpha: 0.00001}, strokeAlign: 'OUTSIDE', strokeWeight: 2,
    effects: [{type: 'DROP_SHADOW', color: {hex: '0f62fe'}, offset: {x: 0, y: 0}, radius: 0, spread: 2}]} : {})});
const set = {setName: 'Ringed Box', type: 'COMPONENT_SET', key: 'ringed-key', nodeId: '4:0',
  propertyDefinitions: {Ringed: {type: 'VARIANT', defaultValue: 'No', variantOptions: ['No', 'Yes']}},
  variants: ['No', 'Yes'].map((ringed, i) => ({name: `Ringed=${ringed}`, type: 'COMPONENT', nodeId: `4:${i + 1}`, variantProperties: {Ringed: ringed},
    bbox: {width: 24, height: 24}, sourceEmptyFill: true, layout: {mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [2, 2, 2, 2], primarySizing: 'AUTO', counterSizing: 'AUTO'},
    children: [box(ringed, i)]}))};
const read = (conventions: string[]) => {
  const batch = proposeBatchFromDump({'Ringed Box': structuredClone(set)}, {fileKey: 'file', mintUnbound: true, effectsCaptured: true, contractIdByName: new Map(), conventions,
    corpus: tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}})});
  assert.deepEqual(batch.skipped, []);
  const result = batch.proposals[0]!, part = walkAnatomy(ContractSchema.parse(result.contract)).find(w => w.path.join('/') === 'root/Box')!.part;
  return {notes: result.notes, part: JSON.stringify(part)};
};

test('profile convention imperceptible-outside-stroke-spread-shadow-as-outline: the ring is an outline offset by the stroke', () => {
  const off = read([]), on = read(['imperceptible-outside-stroke-spread-shadow-as-outline']);
  // Off: the shadow is a box-shadow from the border box and the stroke an outline at offset 0.
  assert(off.part.includes('"box-shadow"') && !off.part.includes('"outline-offset"'), off.part);
  assert(!off.notes.some(n => n.includes('imperceptible-outside-stroke-spread-shadow-as-outline')));
  // On: no box-shadow; the outline takes the shadow's color and spread, offset by the stroke's weight.
  assert(!on.part.includes('"box-shadow"') && on.part.includes('"outline-offset"'), on.part);
  assert(on.notes.some(n => n.includes('(root)/Box: a spread-only drop shadow around an imperceptible OUTSIDE stroke') &&
    n.includes('(profile convention imperceptible-outside-stroke-spread-shadow-as-outline)')), JSON.stringify(on.notes));
});
