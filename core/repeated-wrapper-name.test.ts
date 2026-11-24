import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpNode, DumpSet} from '../extract/figma/types.js';

// The short variant puts each text in its own wrapper, and both wrappers share one name. The long variant stacks
// the same two texts flat in a column. One synthetic copy of the name would hold both texts in the first wrapper's row.
const flex = (mode: 'HORIZONTAL' | 'VERTICAL') => ({mode, primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO'}) as DumpNode['layout'];
const text = (name: string): DumpNode => ({name, type: 'TEXT', text: {characters: name, fontStyle: 'Regular', fontFamily: 'Arial', fontSize: 12, lineHeight: 16, fontWeight: 400}} as DumpNode);
const wrapper = (member: string): DumpNode => ({name: 'Overflow', type: 'FRAME', layout: flex('HORIZONTAL'), children: [text(member)]});
const set: DumpSet = {setName: 'Stacked Notice', type: 'COMPONENT_SET',
  propertyDefinitions: {Long: {type: 'VARIANT', defaultValue: 'No', variantOptions: ['No', 'Yes']}} as DumpSet['propertyDefinitions'],
  variants: ['No', 'Yes'].map(long => ({name: `Long=${long}`, type: 'COMPONENT', variantProperties: {Long: long}, layout: flex('VERTICAL'),
    children: [{name: 'Body', type: 'FRAME', layout: flex(long === 'No' ? 'HORIZONTAL' : 'VERTICAL'),
      children: long === 'No' ? [wrapper('Title'), wrapper('Message')] : [text('Title'), text('Message')]}]}))};
const read = (conventions: string[]) => {
  const proposal = proposeFromDump(structuredClone(set), {corpus: tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}}),
    mintUnbound: true, contractIdByName: new Map(), fileKey: 'fixture', projectionMode: 'exact', conventions});
  return {notes: proposal.notes, paths: walkAnatomy(ContractSchema.parse(proposal.contract)).map(w => w.path.join('/'))};
};

test('profile convention repeated-wrapper-name-not-folded: a name drawn on two wrappers in one variant is not folded', () => {
  const off = read([]), on = read(['repeated-wrapper-name-not-folded']), folded = (notes: string[]) => notes.some(n => n.includes('nest under wrapper "Overflow" — folded'));
  // Off: the long variant's two texts become members of one synthetic wrapper, laid out as the first wrapper's row.
  assert(folded(off.notes), JSON.stringify(off.notes));
  assert(off.paths.includes('root/Body/Overflow/Message'), JSON.stringify(off.paths));
  assert(!off.notes.some(n => n.includes('repeated-wrapper-name-not-folded')));
  // On: the long variant keeps its texts flat in its own column; each real wrapper keeps the one text it draws.
  assert(!folded(on.notes), JSON.stringify(on.notes));
  assert(on.notes.some(n => n.includes('wrapper "Overflow" is drawn more than once in one variant') && n.includes('(profile convention repeated-wrapper-name-not-folded)')), JSON.stringify(on.notes));
  assert(on.paths.includes('root/Body/Title') && on.paths.includes('root/Body/Message'), JSON.stringify(on.paths));
  assert(!on.paths.includes('root/Body/Overflow/Message'), JSON.stringify(on.paths));
});
