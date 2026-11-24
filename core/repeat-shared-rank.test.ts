import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema, type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract, proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {childPaintOrderPlans} from '../packages/core/src/child-paint-order.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpNode, DumpSet} from '../extract/figma/types.js';

const entry = ContractSchema.parse({id: 'ds.entry', name: 'Entry', version: '0.1.0', status: 'draft', description: 'Synthetic repeated item',
  semantics: {element: 'span'}, props: [{name: 'text', type: 'text', default: 'Item', bindings: {figma: {kind: 'TEXT', property: 'Text'}, code: {prop: 'children'}}}],
  states: [], anatomy: {root: {parts: {label: {content: {prop: 'children'}}}}},
  bindings: {figma: {anchors: {fileKey: 'fixture', componentSetKey: 'entry-key'}}, code: {anchors: {importPath: './Entry', export: 'Entry'}}}});
// The first child paints on top (itemReverseZIndex); three items of one child component become a repeat, and a text follows.
const bar = (clips: boolean): DumpSet => ({setName: 'Bar', type: 'COMPONENT', propertyDefinitions: {}, variants: [{name: 'Bar', type: 'COMPONENT', itemReverseZIndex: true,
  layout: {mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO'},
  children: [...['One', 'Two', 'Three'].map(text => ({type: 'INSTANCE', name: 'entry', instanceOf: 'Entry', instanceSetKey: 'entry-key', clipsContent: clips,
    componentProperties: {'Text#1:0': text}})), {name: 'Tail', type: 'TEXT', text: {characters: 'Tail', fontStyle: 'Regular', fontFamily: 'Arial', fontSize: 12, lineHeight: 16, fontWeight: 400}}]} as DumpNode]});
const propose = (conventions: string[], clips = true) => {
  const result = proposeFromDump(bar(clips), {corpus: tokenCorpusFromJson({primitives: {}, semantic: {}, light: {}, brandDefault: {}}), mintUnbound: true, conventions,
    contractIdByName: new Map([['Entry', entry.id]]), contractIdByKey: new Map([['entry-key', entry.id]]), contractsById: new Map([[entry.id, asMinimalChildContract(entry)]])});
  return {notes: result.notes, contract: ContractSchema.parse(result.contract)};
};
const contracts = (c: Contract) => new Map([[c.id, c], [entry.id, entry]]);

test('profile convention repeat-shares-paint-rank: a ranked repeat whose items cannot overlap shares one rank', () => {
  const off = propose([]), on = propose(['repeat-shares-paint-rank']);
  // Off: the root ranks its children and the generator refuses the repeat child by name.
  assert.equal(off.contract.anatomy.root.layout?.reversePaint, true);
  assert.equal(off.contract.anatomy.root.layout?.repeatSharesRank, undefined);
  assert.throws(() => childPaintOrderPlans(off.contract, contracts(off.contract)), /child-paint-order-expanding-child/);
  // On: the field is written and the repeat takes one rank beside its sibling.
  assert.equal(on.contract.anatomy.root.layout?.repeatSharesRank, true, JSON.stringify(on.notes));
  const [plan] = childPaintOrderPlans(on.contract, contracts(on.contract));
  assert.equal(plan!.base.length, 2);
  assert(on.notes.some(n => n.includes('(profile convention repeat-shares-paint-rank)')));
  // Items that do not clip their content could paint into each other: no field, still refused.
  assert.equal(propose(['repeat-shares-paint-rank'], false).contract.anatomy.root.layout?.repeatSharesRank, undefined);
});

test('layout.repeatSharesRank: the generator and the Figma writer refuse it by name without a ranked repeat', () => {
  const {contract} = propose(['repeat-shares-paint-rank']);
  for (const part of Object.values(contract.anatomy.root.parts ?? {})) delete part.tokens; // stacking only: no token values here
  // The canvas draws the shared rank natively: each item is its own child under itemReverseZIndex.
  const engine = createFigmaEngine({tokens: {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}}, icons: new Map(), variableCollection: 'Shared rank'});
  assert.equal(engine.compileComponentData(contract, contracts(contract)).variants[0]!.spec.itemReverseZIndex, true);
  const unranked = structuredClone(contract);
  delete unranked.anatomy.root.layout!.reversePaint;
  assert.throws(() => childPaintOrderPlans(unranked, contracts(unranked)), /child-paint-order-shared-rank-unqualified/);
  assert.throws(() => engine.compileComponentData(unranked, contracts(unranked)), /shared-rank/);
});
