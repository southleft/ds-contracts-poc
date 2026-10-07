import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractSchema, literalValueOk, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';

function fixture(): Contract {
  return ContractSchema.parse({
    id: 'probe.weight', name: 'Weight', version: '0.1.0', status: 'draft', description: 'Conditional local label weight regression',
    props: [{ name: 'selected', type: 'boolean', default: false,
      bindings: { code: { prop: 'selected' }, figma: { kind: 'VARIANT', property: 'Selected' } } }],
    states: [], semantics: { element: 'div' },
    anatomy: { root: { layout: { display: 'flex' },
      parts: { label: { text: 'Label', literalsByCombination: [{ props: ['selected'], rows: [
        { values: ['false'], literals: { 'font-weight': '500' } },
        { values: ['true'], literals: { 'font-weight': '600' } },
      ] }] } } } },
    bindings: { code: { anchors: { importPath: './Weight', export: 'Weight' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}
const engine = () => createFigmaEngine({ tokens: {
  primitives: { weight: { regular: { $type: 'number', $value: '400' } } },
  semantic: {}, light: {}, dark: {}, brands: { default: {} },
}, icons: new Map() });
function compile(c: Contract) {
  const data = engine().compileComponentData(c, new Map([[c.id, c]]));
  const labels: Array<{ variant: string; style?: string; weight?: string }> = [];
  const visit = (node: any, variant: string) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && node.name === 'label') labels.push({ variant, style: node.fontStyle, weight: node.fontWeightVar });
    for (const [key, value] of Object.entries(node)) {
      if (key === 'codeOnlyFacts') continue;
      if (Array.isArray(value)) value.forEach(v => visit(v, variant));
      else if (value && typeof value === 'object') visit(value, variant);
    }
  };
  for (const v of data.variants) visit(v.spec, v.name);
  assert.equal(labels.length, 2);
  assert.equal(labels.length, 2, 'both observed boolean variants must carry a label');
  return { data, labels };
}
test('weight literals require unitless in-range decimal values', () => {
  for (const value of ['1', '400', '500', '600', '510', '510.25', '1000']) assert.equal(literalValueOk('font-weight', value), true, value);
  for (const value of ['0', '0.5', '1001', '500px', '500%', 'NaN', '-500', 'bold']) assert.equal(literalValueOk('font-weight', value), false, value);
});
test('native conditional labels preserve exact Medium and Semi Bold faces', () => {
  const { data, labels } = compile(fixture());
  for (const label of labels) assert.equal(label.style, /Selected=True/i.test(label.variant) ? 'Semi Bold' : 'Medium');
  assert.equal(data.codeOnlyFacts?.some(f => f.channel === 'font-weight') ?? false, false);
});
test('child literal supersedes inherited weight binding; own binding keeps precedence with a named conflict', () => {
  const inherited = fixture(); inherited.anatomy.root.tokens = { 'font-weight': '{weight.regular}' };
  for (const label of compile(inherited).labels) {
    assert.equal(label.style, /Selected=True/i.test(label.variant) ? 'Semi Bold' : 'Medium');
    assert.equal(label.weight, undefined);
  }
  const own = fixture(); own.anatomy.root.parts!.label.tokens = { 'font-weight': '{weight.regular}' };
  const { data, labels } = compile(own);
  for (const label of labels) { assert.equal(label.style, 'Regular'); assert.equal(label.weight, 'weight/regular'); }
  assert.equal(data.codeOnlyFacts?.filter(f => f.channel === 'font-weight').reduce((n, f) => n + f.variants.count, 0), 2);
});
test('valid CSS weight without an exact native face is refused by name without rounding', () => {
  const c = fixture(); c.anatomy.root.parts!.label.literalsByCombination![0].rows[0].literals['font-weight'] = '510';
  const { data } = compile(c);
  const refusal = data.codeOnlyFacts?.find(f => f.channel === 'font-weight' && f.value === '510');
  assert.match(refusal?.reason ?? '', /no exact native face/);
  assert.equal(refusal?.variants.count, 1);
});


import {mapRestToDump} from '../extract/figma/rest/map.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';
function numericWeightFixture(weights:number[], unresolvedBinding = false) {
  const document={id:'1:1',name:'Weight source',type:'COMPONENT_SET',componentPropertyDefinitions:{Size:{type:'VARIANT',defaultValue:'0',variantOptions:weights.map((_,i)=>String(i))}},children:weights.map((weight,i)=>({
    id:`2:${i}`,name:`Size=${i}`,type:'COMPONENT',variantProperties:{Size:String(i)},children:[{
      ...(unresolvedBinding ? {boundVariables:{fontWeight:[{type:'VARIABLE_ALIAS',id:'unavailable'}]}} : {}),
      id:`3:${i}`,name:'Label',type:'TEXT',characters:'Exact weight',style:{fontFamily:'Inter',fontSize:16,fontStyle:'Medium',fontWeight:weight},
    }],
  }))};
  const before=JSON.stringify(document);
  const {dump}=mapRestToDump({name:'Fixture',nodes:{'1:1':{document}}} as never);
  assert.equal(JSON.stringify(document),before);
  const set=dump['Weight source'] as DumpSet;
  const propose=()=>proposeFromDump(set,{mintUnbound:true,contractIdByName:new Map(),corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}})});
  return {set,propose};
}
test('REST numeric weight survives without a binding and outranks a rounded face label',()=>{
  for(const weights of [[510],[274],[510,510.25],[500,510]]){
    const f=numericWeightFixture(weights);
    assert.deepEqual(f.set.variants.map(v=>v.children![0].text!.fontWeight),weights);
    const result=f.propose();
    const actual=result.mintedTokens!.entries.filter(e=>e.ref.includes('font-weight')).map(e=>e.value);
    assert.deepEqual([...new Set(actual)].sort(),[...new Set(weights.map(String))].sort());
    assert(!result.notes.some(n=>n.includes('font-weight NAMED')));
  }
});
test('an invalid explicit numeric weight never falls back to the face label',()=>{
  const f=numericWeightFixture([510]);f.set.variants[0].children![0].text!.fontWeight=1001;
  const result=f.propose();
  assert(!result.mintedTokens?.entries.some(e=>e.ref.includes('font-weight')));
  assert(result.notes.some(n=>n.includes('font-weight NAMED')));
});

test('unbound REST numeric weights require every character override to retain the same weight',()=>{
  for(const [table,expected] of [[{'1':{fontWeight:510}},510],[{'1':{fontWeight:700}},undefined],[{},undefined]] as const){
    const document={id:'1:1',name:'Ranges',type:'COMPONENT',children:[{id:'2:1',name:'Label',type:'TEXT',characters:'AB',style:{fontWeight:510,fontStyle:'Medium',fontSize:16},characterStyleOverrides:[0,1],styleOverrideTable:table}]};
    const before=JSON.stringify(document);
    const {dump,report}=mapRestToDump({nodes:{'1:1':{document}}} as never);
    assert.equal((dump.Ranges as DumpSet).variants[0].children![0].text!.fontWeight,expected);
    if(expected===undefined)assert(report.degradations.some(d=>d.field==='text.fontWeight'&&d.message.includes('character ranges')));
    assert.equal(JSON.stringify(document),before);
  }
});

test('unresolved weight aliases retain exact observed values through contract proposal',()=>{
  const f=numericWeightFixture([653],true);
  assert.equal(f.set.variants[0].children![0].text!.fontWeightVar,undefined);
  const result=f.propose();
  assert.deepEqual(result.mintedTokens!.entries.filter(e=>e.ref.includes('font-weight')).map(e=>e.value),['653']);
  assert(!result.notes.some(n=>n.includes('font-weight NAMED')));
});
