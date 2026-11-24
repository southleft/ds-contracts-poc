import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema, walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpNode, DumpSet} from '../extract/figma/types.js';

// Unbound where Actionable is False, so the stamp always draws there; bound to a BOOLEAN (default false) where Actionable
// is True, so it draws there only when that BOOLEAN is true.
const stamp = (bound: boolean): DumpNode => ({name: 'Stamp', type: 'TEXT', ...(bound ? {hidden: true, propRefs: {visible: 'Stamp shown'}} : {}),
  text: {characters: 'Stamp', fontStyle: 'Regular', fontFamily: 'Arial', fontSize: 12, lineHeight: 16, fontWeight: 400}} as DumpNode);
const set: DumpSet = {setName: 'Stamped Notice', type: 'COMPONENT_SET',
  propertyDefinitions: {Actionable: {type: 'VARIANT', defaultValue: 'False', variantOptions: ['False', 'True']},
    'Stamp shown#1:0': {type: 'BOOLEAN', defaultValue: false}} as DumpSet['propertyDefinitions'], boolDefaults: {'Stamp shown': false},
  variants: ['False', 'True'].map(actionable => ({name: `Actionable=${actionable}`, type: 'COMPONENT', variantProperties: {Actionable: actionable},
    layout: {mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO'},
    children: [stamp(actionable === 'True')]}) as DumpNode)};
const read = (conventions: string[]) => {
  const proposal = proposeFromDump(structuredClone(set), {corpus: tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}}),
    mintUnbound: true, hiddenCaptured: true, contractIdByName: new Map(), fileKey: 'fixture', projectionMode: 'exact', conventions});
  const contract = ContractSchema.parse(proposal.contract);
  return {notes: proposal.notes, props: contract.props, part: walkAnatomy(contract).find(w => w.path.join('/') === 'root/Stamp')!.part};
};

test('profile convention partly-bound-text-visibility-carried: bound planes gate on the BOOLEAN, unbound planes draw', () => {
  const off = read([]), on = read(['partly-bound-text-visibility-carried']);
  // Off: the binding is dropped, so the stamp draws in every variant and the BOOLEAN is no prop.
  assert(off.notes.some(n => n.includes('visibility property reference differs or is missing')), JSON.stringify(off.notes));
  assert.equal(off.part.stylesWhen, undefined);
  assert(!off.props.some(p => p.type === 'boolean' && p.name !== 'actionable'), JSON.stringify(off.props));
  // On: hidden where Actionable is true, shown again where the BOOLEAN is true (the later rule wins).
  const flag = on.props.find(p => p.type === 'boolean' && p.name !== 'actionable');
  assert(flag && flag.default === false, JSON.stringify(on.props));
  assert.deepEqual(on.part.stylesWhen, [{prop: 'actionable', equals: 'true', styles: {display: 'none'}}, {prop: flag.name, equals: 'true', styles: {display: 'block'}}]);
  assert.equal(on.part.visibleWhen, undefined);
  assert(on.notes.some(n => n.includes('(profile convention partly-bound-text-visibility-carried)')), JSON.stringify(on.notes));
});
