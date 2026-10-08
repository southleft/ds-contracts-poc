import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeFromDump, proposeBatchFromDump, dumpCapturesEffects, type MinimalChildContract } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { tokenInventoryFromJson } from './index.js';
import { emitReact } from './emit-react.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema, type Part } from '../scripts/contract-schema.js';
import type { DumpEffect, DumpSet } from '../extract/figma/types.js';

const empty = { primitives: {}, semantic: {}, light: {}, brandDefault: {} };
const corpus = tokenCorpusFromJson(empty);
const inner = (patch: Partial<DumpEffect> = {}): DumpEffect => ({ type: 'INNER_SHADOW', color: { hex: '000932', alpha: 0.12 }, offset: { x: 0, y: 0 }, radius: 0, spread: 1, ...patch });
const drop = (): DumpEffect => ({ ...inner(), type: 'DROP_SHADOW', offset: { x: 2, y: -1 }, radius: 3 });
function specimen(stacks: DumpEffect[][], part = false, state = false): DumpSet {
  const values = stacks.map((_, i) => state ? ['Default', 'Hover'][i] : `V${i}`);
  return { setName: 'Surface', type: 'COMPONENT_SET',
    propertyDefinitions: { [state ? 'State' : 'Tone']: { type: 'VARIANT', defaultValue: values[0], variantOptions: values } },
    variants: stacks.map((effects, i) => ({ name: `${state ? 'State' : 'Tone'}=${values[i]}`, variantProperties: { [state ? 'State' : 'Tone']: values[i] }, type: 'COMPONENT', bbox: { width: 40, height: 24 },
      fill: { hex: 'ffffff' }, effects: part ? [] : effects,
      children: part ? [{ name: 'surface', type: 'FRAME', fixedSize: { width: 40, height: 24 }, fill: { hex: 'ffffff' }, effects, children: [] }] : [] })) };
}
const propose = (set: DumpSet, extra: Record<string, unknown> = {}) => proposeFromDump(set, {
  corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true, stampsObservable: true, ...extra,
});
const rootOf = (result: ReturnType<typeof propose>) => ContractSchema.parse(result.contract).anatomy.root;
const valueOf = (result: ReturnType<typeof propose>, ref: string | undefined) => {
  assert.ok(ref, 'shadow token reference required');
  return tokenCorpusFromJson({ ...empty, primitives: result.mintedTokens!.tree }).resolveLiteral(ref.slice(1, -1));
};

test('zero-border inset rings lower without adding fill, clipping or layout space', () => {
  for (const onPart of [false, true]) for (const bound of [false, true]) {
    const result = propose(specimen([[inner()]], onPart)), contract = ContractSchema.parse(result.contract);
    const part = onPart ? contract.anatomy.root.parts!.surface : contract.anatomy.root;
    if (bound) part.tokens = {...part.tokens, 'border-width':'{zeroRingWidth}'};
    else part.literals = {...part.literals, 'border-width':'0px'};
    const tokens = {primitives:{...result.mintedTokens!.tree,zeroRingWidth:{$type:'dimension',$value:'0px'}},semantic:{},light:{},dark:{},brands:{default:{}}};
    const compiled = createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]]));
    const root = compiled.variants[0].spec, spec = onPart ? root.children![0] : root;
    assert.deepEqual(spec.effectStack, []);
    assert.equal(spec.lits?.strokeWeight,1);
    assert.equal(spec.lits?.strokeColor?.a,0.12);
    assert.equal(spec.strokesIncludedInLayout,false);
    assert.notEqual(spec.clipsContent,true);
    assert.equal(spec.bindings?.strokeWeight,undefined);
  }
});

test('inset lowering does not overwrite existing borders or reinterpret blur and offset', () => {
  for (const patch of [{radius:1},{offset:{x:1,y:0}},{}]) {
    const result=propose(specimen([[inner(patch)]])),contract=ContractSchema.parse(result.contract);
    contract.anatomy.root.literals={'border-width':Object.keys(patch).length?'0px':'2px'};
    const tokens={primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}};
    const spec=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]])).variants[0].spec;
    assert.equal(spec.effectStack?.length,1);
  }
});

test('captured inner and mixed shadows reach React and Figma with layer order and numeric values intact', () => {
  for (const onPart of [false, true]) {
    const result = propose(specimen([[inner(), drop()]], onPart));
    const contract = ContractSchema.parse(result.contract), root = contract.anatomy.root;
    const part = onPart ? root.parts!.surface : root;
    const value = valueOf(result, part.tokens?.['box-shadow']);
    assert.equal(value, 'inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12), 2px -1px 3px 1px rgba(0, 9, 50, 0.12)');
    const tokens = result.mintedTokens!.tree;
    const output = emitReact(contract, { tokens: tokenInventoryFromJson([tokens]), icons: new Map(), contracts: new Map([[contract.id, contract]]) });
    assert.match(output.css, /box-shadow: var\(--imported-surface-/);
    const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
    const compiled = engine.compileComponentData(contract, new Map([[contract.id, contract]]));
    const spec = onPart ? compiled.variants[0].spec.children!.find(n => n.name === 'surface')! : compiled.variants[0].spec;
    assert.deepEqual(spec.effectStack, [
      { inner: true, x: 0, y: 0, radius: 0, spread: 1, color: { r: 0, g: 9 / 255, b: 50 / 255, a: 0.12 } },
      { x: 2, y: -1, radius: 3, spread: 1, color: { r: 0, g: 9 / 255, b: 50 / 255, a: 0.12 } },
    ]);
  }
});

test('inner geometry and alpha are not quantized; exponent values use equivalent decimal CSS', () => {
  const result = propose(specimen([[inner({ offset: { x: 0.123456789, y: -0.0000001 }, radius: 1.23456789, spread: -0.123456789, color: { hex: '123456', alpha: 0.123456789 } })]]));
  assert.equal(valueOf(result, rootOf(result).tokens?.['box-shadow']), 'inset 0.123456789px -0.0000001px 1.23456789px -0.123456789px rgba(18, 52, 86, 0.123456789)');
});

test('inner root and part hover stacks survive state projection without inventing a state prop', () => {
  for (const onPart of [false, true]) {
    for (const rest of [[], [drop()]]) {
      const result = propose(specimen([rest, [inner(), drop()]], onPart, true), { projectionMode: 'exact' });
      const root = rootOf(result), part: Part = onPart ? root.parts!.surface : root;
      if (!rest.length) assert.equal(part.tokens?.['box-shadow'], undefined);
      assert.match(String(valueOf(result, part.states?.hover?.['box-shadow'])), /^inset .*rgba\(0, 9, 50, 0.12\), 2px/);
      assert.ok(!ContractSchema.parse(result.contract).props.some(p => p.name === 'state'));
    }
  }
});

test('blur, invalid inner values and partial presence are named without a partial shadow stack', () => {
  for (const effects of [[inner(), { type: 'LAYER_BLUR', radius: 2 }],
    [inner({ radius: -1 })], [inner({ radius: NaN })], [inner({ offset: undefined })],
    [inner({ color: { hex: 'xyzxyz' } })], [inner({ color: { hex: '000000', alpha: 2 } })]]) {
    const result = propose(specimen([effects]));
    assert.equal(rootOf(result).tokens?.['box-shadow'], undefined);
    assert.ok(result.notes.some(n => n.includes('channel NAMED, not proposed')));
  }
  const partial = propose(specimen([[inner()], []]));
  assert.equal(rootOf(partial).tokens?.['box-shadow'], undefined);
  assert.ok(partial.notes.some(n => n.includes('present in every variant')));
  for (const onPart of [false, true]) {
    const unsupported = propose(specimen([[], [inner(), { type: 'BACKGROUND_BLUR', radius: 2 }]], onPart, true));
    const root = rootOf(unsupported), part = onPart ? root.parts!.surface : root;
    assert.equal(part.states?.hover?.['box-shadow'], undefined);
    assert.ok(unsupported.notes.some(n => n.includes('effects') && n.includes('NAMED')));
  }
});

test('authored recovery distinguishes inner from outer and accepts only exact or float32 inner values', () => {
  const set = { ...specimen([[inner()]]), contractId: 'ds.surface' };
  const authored: MinimalChildContract = { id: 'ds.surface', props: [], anatomy: { root: { tokens: { 'box-shadow': '{shadow.surface}' } } } };
  for (const [css, recovered] of [
    ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)', true],
    [`inset 0px 0px 0px 1px rgba(0, 9, 50, ${Math.fround(0.12)})`, true],
    ['0px 0px 0px 1px rgba(0, 9, 50, 0.12)', false],
    ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.121)', false],
    ['inset 0px 0px 0px 1px rgba(0, 10, 50, 0.12)', false],
    ['inset 0px 0px 0px 1.001px rgba(0, 9, 50, 0.12)', false],
  ] as const) {
    const result = propose(set, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: css } } } }),
      contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
    assert.equal(rootOf(result).tokens?.['box-shadow'] === '{shadow.surface}', recovered, css);
  }
  const outer = { ...set, variants: [{ ...set.variants[0], effects: [{ ...inner(), type: 'DROP_SHADOW' }] }] };
  const recoveredOuter = propose(outer, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: 'inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)' } } } }),
    contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
  assert.notEqual(rootOf(recoveredOuter).tokens?.['box-shadow'], '{shadow.surface}', 'an outer capture must not recover an inset token');
});

test('authored mixed-stack recovery does not ignore layer order', () => {
  const set = { ...specimen([[inner(), drop()]]), contractId: 'ds.surface' };
  const authored: MinimalChildContract = { id: 'ds.surface', props: [], anatomy: { root: { tokens: { 'box-shadow': '{shadow.surface}' } } } };
  const css = ['inset 0px 0px 0px 1px rgba(0, 9, 50, 0.12)', '2px -1px 3px 1px rgba(0, 9, 50, 0.12)'];
  for (const reverse of [false, true]) {
    const result = propose(set, { corpus: tokenCorpusFromJson({ ...empty, primitives: { shadow: { surface: { $type: 'shadow', $value: (reverse ? [...css].reverse() : css).join(', ') } } } }),
      contractIdByName: new Map([['Surface', 'ds.surface']]), contractsById: new Map([['ds.surface', authored]]) });
    assert.equal(rootOf(result).tokens?.['box-shadow'] === '{shadow.surface}', !reverse);
  }
});

test('effect binding metadata alone does not invent a visual hover override', () => {
  for (const onPart of [false, true]) {
    const effect = drop();
    const result = propose(specimen([[effect], [{ ...effect, bound: { radius: 'shadow/radius' } }]], onPart, true));
    const root = rootOf(result), part = onPart ? root.parts!.surface : root;
    assert.equal(part.states?.hover?.['box-shadow'], undefined);
  }
});


test('effect absence requires positive capture provenance and respects effect read limits',()=>{
 const rest={note:'Node-tree dump mapped from the Figma REST API (extract/figma/rest/map.ts, dump v1.44)',dumpVersion:'1.44'};
 assert.equal(dumpCapturesEffects(rest),true);
 assert.equal(dumpCapturesEffects({note:'Node-tree dump (extract/figma/dump.plugin.js, dump v1.48)',dumpVersion:'1.48'}),true);
 for(const provenance of [undefined,{}, {dumpVersion:'1.44',note:'hand-authored'}, {...rest,dumpVersion:'1.1'}, {...rest,dumpVersion:'garbage'}, {...rest,captureGaps:['visible effects not captured']}, {...rest,captureGaps:['shadow read failed']}, {...rest,captureGaps:{}}, {...rest,captureGaps:[null]}])
  assert.equal(dumpCapturesEffects(provenance as never),false,JSON.stringify(provenance));
 const set=specimen([[],[inner(),drop()]]);
 for(const capturing of [false,true]) {
  const dump={_provenance:capturing?rest:{dumpVersion:'1.44',note:'unknown producer'},Surface:set};
  const batch=proposeBatchFromDump(dump as never,{corpus,contractIdByName:new Map(),fileKey:null,projectionMode:'reviewable-inversion',mintUnbound:true,stampsObservable:true});
  assert.ok(batch);
  const serialized=JSON.stringify(batch);
  assert.equal(serialized.includes('observed empty stack(s) carried as box-shadow none'),capturing);
 }
});

test('captured empty and ordered shadow stacks survive enum changes at root and nested parts',()=>{
 for(const onPart of [false,true]) {
  const result=propose(specimen([[],[inner(),drop()]],onPart),{effectsCaptured:true});
  const contract=ContractSchema.parse(result.contract),tokens=result.mintedTokens!.tree;
  assert.ok(result.notes.some(n=>n.includes('observed empty stack(s) carried as box-shadow none')));
  const output=emitReact(contract,{tokens:tokenInventoryFromJson([tokens]),icons:new Map(),contracts:new Map([[contract.id,contract]])});
  assert.match(output.css,/box-shadow:/);
  const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const compiled=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
  assert.equal(compiled.variants.length,2);
  const stacks=compiled.variants.map(v=>(onPart?v.spec.children!.find(n=>n.name==='surface')!:v.spec).effectStack??[]);
  assert.deepEqual(stacks.map(stack=>stack.length),[0,2]);
  assert.equal(stacks[1][0].inner,true);assert.equal(stacks[1][1].inner,undefined);
 }
});

test('positive effect capture does not carry a partial unsupported stack or alter hover projection',()=>{
 for(const onPart of [false,true]) {
  const bad=propose(specimen([[],[inner(),{type:'BACKGROUND_BLUR',radius:2}]],onPart),{effectsCaptured:true});
  const root=rootOf(bad),part=onPart?root.parts!.surface:root;
  assert.equal(part.tokens?.['box-shadow'],undefined);
  assert.ok(bad.notes.some(n=>n.includes('channel NAMED, not proposed')));
  const hover=propose(specimen([[],[inner(),drop()]],onPart,true),{effectsCaptured:true,projectionMode:'exact'});
  const hroot=rootOf(hover),hpart=onPart?hroot.parts!.surface:hroot;
  assert.equal(hpart.tokens?.['box-shadow'],undefined);
  assert.match(String(valueOf(hover,hpart.states?.hover?.['box-shadow'])),/^inset /);
  assert.ok(!ContractSchema.parse(hover.contract).props.some(p=>p.name==='state'));
 }
});


test('captured empty stacks retain a complete two-axis shadow domain without borrowing another row',()=>{
 const set=specimen([[],[inner()],[drop()],[inner(),drop()]]);
 const tuples=[['small','bare'],['small','glow'],['large','bare'],['large','glow']];
 set.propertyDefinitions={Size:{type:'VARIANT',defaultValue:'small',variantOptions:['small','large']},Tone:{type:'VARIANT',defaultValue:'bare',variantOptions:['bare','glow']}};
 set.variants=set.variants.map((v,i)=>({...v,name:`Size=${tuples[i][0]}, Tone=${tuples[i][1]}`,variantProperties:{Size:tuples[i][0],Tone:tuples[i][1]}}));
 const result=propose(set,{effectsCaptured:true,projectionMode:'exact'}),contract=ContractSchema.parse(result.contract);
 const engine=createFigmaEngine({tokens:{primitives:result.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const compiled=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
 assert.equal(compiled.variants.length,4);
 const rows=compiled.variants.map(v=>({name:v.name,stack:v.spec.effectStack??(v.spec.dropShadow?[{...v.spec.dropShadow,inner:undefined}]:[])}));
 assert.deepEqual(rows.map(r=>r.stack.length),[0,1,1,2]);
 assert.equal(rows[1].stack[0].inner,true);
 assert.equal(rows[2].stack[0].inner,undefined);
 assert.deepEqual(rows[3].stack.map(e=>Boolean(e.inner)),[true,false]);
});

test('captured exponent dimensions retain their exact value in scalar tokens', async () => {
  const {cssDecimal}=await import('./css-decimal.js');
  const {literalValueOk}=await import('../scripts/contract-schema.js');
  for(const value of [1.7484558156866115e-7, -1e-8, 1e21, 24, 0]) {
    const decimal=cssDecimal(value);
    assert(!/[eE]/.test(decimal));
    assert.equal(Number(decimal),value);
    assert(literalValueOk('width',decimal+'px'));
  }
  const set=specimen([[]],true);
  set.variants[0].children![0].fixedSize!.width=1.7484558156866115e-7;
  const result=propose(set), part=rootOf(result).parts!.surface;
  const value=valueOf(result,part.tokens!.width);
  assert.equal(String(value),'0.00000017484558156866115px');
});
