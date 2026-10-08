import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import {createElement, type ComponentType, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ContractSchema, walkAnatomy, type Contract, type Part} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {proposeDeclaredDrawnDraftPaintCandidate, proposeFromDump, proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {tokenInventoryFromJson} from './tokens.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {emitHtml} from './emit-html.js';
import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
import {emitCodeConnectReact, emitCodeConnectHtml} from './emit-code-connect.js';
import type {DumpSet, DumpNode} from '../extract/figma/types.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';

const corpus = tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout = {mode:'VERTICAL' as const,primary:'MIN' as const,counter:'MIN' as const,
  spacing:2,padding:[0,0,0,0] as [number,number,number,number],primarySizing:'FIXED' as const,counterSizing:'FIXED' as const};
const text = (id:string, characters:string):DumpNode => ({name:'Label',type:'TEXT',nodeId:id,
  text:{characters,fontFamily:'Arial',fontStyle:'Regular',fontSize:12,lineHeight:14,textAutoResize:'WIDTH_AND_HEIGHT'}});

/** Synthetic generic source; no real component, node key, geometry or score
 * is substituted for the original corpus. Different counts, lexically
 * inverted names and literal contents exercise physical source order. */
function fixture() {
  const set:DumpSet = {setName:'DirectDefaults',key:'fixture-main-key',type:'COMPONENT_SET',
    propertyDefinitions:{Density:{type:'VARIANT',defaultValue:'Solo',variantOptions:['Solo','Pair']},
      Content:{type:'SLOT',defaultValue:'{source-slot}',preferredValues:[]}},
    variants:['Solo','Pair'].map((density,plane) => ({name:`Density=${density}`,nodeId:`main:${plane}`,
      type:'COMPONENT',variantProperties:{Density:density},layout:structuredClone(layout),fixedSize:{width:120,height:80},
      children:[{name:'Content',nodeId:`slot:${plane}`,type:'SLOT',layout:structuredClone(layout),fixedSize:{width:100,height:60},
        children:['First',...(plane ? ['Second'] : [])].map((label,index) => ({name:index ? 'Alpha' : 'Zulu',
          nodeId:`frame:${plane}:${index}`,type:'FRAME',layout:structuredClone(layout),fixedSize:{width:80,height:24},
          children:[text(`text:${plane}:${index}`,label)]}))}]}))};
  const opts = {fileKey:'fixture-file',corpus,mintUnbound:true,hiddenCaptured:true,stampsObservable:true,
    contractIdByName:new Map<string,string>()};
  const read = () => {
    const result = proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map(v => v.variantProperties!)).proposal;
    const contract = ContractSchema.parse(result.contract),part = walkAnatomy(contract).find(w => w.part.slot)!.part;
    const tokens = {primitives:result.mintedTokens?.tree ?? {},semantic:{},light:{},dark:{},brands:{default:{}}};
    const scope = new Map([[contract.id,contract]]);
    return {result,contract,part,tokens,scope};
  };
  return {set,opts,read};
}

function subject(c:Contract, tsx:string):ComponentType<Record<string,unknown>> {
  const module = {exports:{} as Record<string,ComponentType<Record<string,unknown>>>},require = createRequire(import.meta.url);
  vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,
    {module,exports:module.exports,require:(id:string) => id.endsWith('.css') ? {} : require(id)});
  return module.exports[c.name];
}
const slotOf = (c:Contract):Part => walkAnatomy(c).find(w => w.part.slot)!.part;
const scalarText = (node:any):string[] => [
  ...(typeof node.characters === 'string' ? [node.characters] : []),
  ...(node.children ?? []).flatMap(scalarText),
];

test('ordinary reviewable inversion preserves the named direct subtree without inventing defaults', () => {
  const f = fixture(),before = JSON.stringify(f.set);
  const result = proposeFromDump(f.set,{...f.opts,projectionMode:'reviewable-inversion'});
  const contract = ContractSchema.parse(result.contract),part = slotOf(contract);
  assert.equal(part.slot!.renderDefaultAnatomy,undefined);
  assert.equal(part.slot!.renderDefault,undefined);
  assert.equal(part.slot!.defaultContent,undefined);
  assert.equal(part.parts,undefined,'reviewable partial anatomy must not claim carried content');
  const notes = result.notes.filter(note => note.includes('native slot "Content" drawn content includes'));
  assert.equal(notes.length,1);
  assert.match(notes[0],/FRAME "Zulu" \[TEXT "Label" "First"\]/);
  assert.match(notes[0],/FRAME "Alpha" \[TEXT "Label" "Second"\]/);
  assert.match(notes[0],/NAMED, not carried/);
  assert(!result.notes.some(note => note.startsWith('captured-drawn-react-domain:') ||
    note.includes('declaration-owned direct SLOT anatomy retained')));
  assert.equal(JSON.stringify(f.set),before,'all source content and membership remain unchanged');
  assert.throws(() => proposeFromDump(f.set,{...f.opts,projectionMode:'exact'}),
    /native-slot-default-anatomy-unqualified.*complete-declared-source-domain-required/,
    'explicit exact mode remains closed without a guarded declaration');
});

test('direct declaration defaults retain source order and finite per-plane membership without reference identities', () => {
  const f = fixture(),before = JSON.stringify(f.set),{contract,part,scope} = f.read();
  assert.equal(part.slot!.renderDefaultAnatomy,true);
  assert.equal(part.slot!.renderDefault,undefined);assert.equal(part.slot!.defaultContent,undefined);
  assert.equal(Object.keys(part.parts!).length,2);
  assert(!walkAnatomy(contract).some(w => w.part.component || w.part.repeat),'direct frames are not invented components or collections');
  const errors:string[] = [];validateContract(contract,scope,errors,new Map(),{drawnVariants:'react-runtime'});
  assert.deepEqual(errors,[]);assert.equal(JSON.stringify(f.set),before,'source tree is immutable');
});

test('both React receivers use defaults only on omission, and keep explicit replacement and clearing in every plane', () => {
  const {contract,part,scope,tokens} = fixture().read(),ctx = {contracts:scope,icons:new Map<string,string>(),tokens};
  for (const tsx of [emitReact(contract,{...ctx,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens}).tsx,emitReactInline(contract,ctx).tsx]) {
    const Subject = subject(contract,tsx);
    const render = (density:string, supplied=false, value?:ReactNode) => renderToStaticMarkup(createElement(Subject,
      {density,...(supplied ? {[part.slot!.name]:value} : {})}));
    for (const density of ['solo','pair','solo']) {
      assert.match(render(density),/>First</);
      assert.equal(render(density).includes('>Second<'),density === 'pair');
      const replacement = render(density,true,createElement('strong',null,'Caller'));
      assert.match(replacement,/>Caller</);assert.doesNotMatch(replacement,/>First<|>Second</);
      for (const empty of [null,false,'']) assert.doesNotMatch(render(density,true,empty),/>First<|>Second</);
      assert.match(render(density,true,0),/>0</,'zero is an explicit caller value');
      assert.equal(render(density,true,undefined),render(density),'undefined has omission semantics');
    }
    assert.throws(() => render('unknown'),(error:unknown) => {
      const refusal = error as {code?:unknown;message?:unknown;contractId?:unknown};
      return typeof error === 'object' && error !== null && refusal.code === 'DRAWN_VARIANT_UNDECLARED' &&
        refusal.message === `Undeclared variant combination: ${contract.id}` && refusal.contractId === contract.id;
    },'unobserved parent tuple cannot borrow defaults');
  }
});

test('native compilation retains exactly the corresponding direct defaults and no sample reference list', () => {
  const {contract,scope,tokens} = fixture().read(),engine = createFigmaEngine({tokens,icons:new Map()});
  const variants = engine.compileComponentData(contract,scope).variants;
  assert.equal(variants.length,2);
  for (const variant of variants) {
    const slot = variant.spec.children!.find(n => n.type === 'slot')!;assert(slot);
    assert.equal(slot.slotDefault,undefined);
    assert.deepEqual(scalarText(slot),variant.name.includes('Pair') ? ['First','Second'] : ['First']);
  }
});

test('native instance caller replacement and explicit empty parts replace the direct omitted default', async () => {
  const {contract,scope,tokens,part} = fixture().read(),engine = createFigmaEngine({tokens,icons:new Map()});
  const {figma,root} = createFigmaMock(),context = vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const run = (script:string) => vm.runInContext(`(async()=>{${script}\n})()`,context);
  await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(contract,scope));
  for (const supplied of [false,true]) for (const empty of [false,true]) {
    const caller = ContractSchema.parse({id:`fixture.caller-${Number(supplied)}-${Number(empty)}`,name:`Caller${Number(supplied)}${Number(empty)}`,
      version:'1.0.0',status:'draft',description:'Independent slot caller',semantics:{element:'div'},states:[],props:[],
      anatomy:{root:{parts:{usage:{component:{id:contract.id,props:{density:'solo'},...(supplied ? {contentSlot:part.slot!.name} : {})},
        ...(supplied ? {parts:empty ? {} : {replacement:{text:'Caller'}}} : {})}}}},
      bindings:{code:{anchors:{importPath:'./Caller',export:'Caller'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    scope.set(caller.id,caller);await run(engine.buildComponentScript(caller,scope));
    const component = root.findOne(n => (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') && n.getSharedPluginData('ds_contracts','contractId') === caller.id);
    assert(component);
    const texts = component.findAll(n => n.type === 'TEXT').map(n => n.characters);
    assert.deepEqual(texts,supplied ? (empty ? [] : ['Caller']) : ['First']);
  }
});

test('unrelated direct TEXT default uses the same declaration carrier', () => {
  const f = fixture();f.set.setName = 'HelperBody';
  for (const [i,v] of f.set.variants.entries()) v.children![0].children = [text(`independent:${i}`,'Independent')];
  const {part,contract} = f.read();assert.equal(part.slot!.renderDefaultAnatomy,true);
  assert.equal(walkAnatomy(contract).filter(w => w.part.text === 'Independent').length,1);
});

test('source-owned FILL uses ordinary parent allocation without replacing it with an observed pixel size', () => {
  const f = fixture();
  for (const v of f.set.variants) {
    const body = v.children![0].children![0];
    body.fillWidth = true;body.fixedSize = {height:24};body.bbox = {width:100,height:24};
  }
  const {part} = f.read(),body = Object.values(part.parts!)[0];
  assert.equal(body.layout?.alignSelf,'stretch');
  assert.equal(body.absoluteGeometry,undefined,'no new absolute allocation is invented');
});

test('new direct mode rejects mixed defaults and empty bodies while the legacy reference identity guard stays exact', () => {
  const {contract,part,scope} = fixture().read();
  for (const mutation of [
    (p:Part) => {p.slot!.renderDefault = true;},
    (p:Part) => {p.slot!.defaultContent = [];},
    (p:Part) => {delete p.parts;},
    (p:Part) => {p.parts = {};},
  ]) {
    const invalid = structuredClone(contract);mutation(slotOf(invalid));
    assert.equal(ContractSchema.safeParse(invalid).success,false);
    const errors:string[] = [];validateContract(invalid,new Map([[invalid.id,invalid]]),errors,new Map());
    assert(errors.some(e => e.includes('SLOT_DIRECT_DEFAULT_')));
  }
  const legacy = structuredClone(contract),legacyPart = slotOf(legacy);
  delete legacyPart.slot!.renderDefaultAnatomy;legacyPart.slot!.renderDefault = true;
  legacyPart.slot!.defaultContent = [{id:contract.id}];
  legacyPart.parts = {default:{component:{id:'different.reference'}}};
  const errors:string[] = [];validateContract(legacy,scope,errors,new Map());
  assert(errors.some(e => e.includes('SLOT_RUNTIME_DEFAULT_ANATOMY_MISMATCH')),'no reference identity relaxation');
  assert.equal(part.slot!.renderDefaultAnatomy,true,'negative controls cannot alter the positive source');
});

test('source inference refuses missing declaration, caller-owned roots, ambiguous IDs and unsupported member allocation', () => {
  for (const change of [
    (f:ReturnType<typeof fixture>) => {delete f.set.propertyDefinitions!.Content;},
    (f:ReturnType<typeof fixture>) => {f.set.propertyDefinitions!['Content#1:2'] = f.set.propertyDefinitions!.Content;},
    (f:ReturnType<typeof fixture>) => {f.set.variants[0].type = 'INSTANCE';},
    (f:ReturnType<typeof fixture>) => {delete f.set.variants[0].children![0].nodeId;},
    (f:ReturnType<typeof fixture>) => {f.set.variants[1].children![0].children![1].nodeId = f.set.variants[1].children![0].children![0].nodeId;},
    (f:ReturnType<typeof fixture>) => {f.set.variants[0].children![0].children![0].fillWidth = true;delete f.set.variants[0].children![0].layout;},
    (f:ReturnType<typeof fixture>) => {delete (f.set.variants[0].children![0].children![0].children![0] as any).text;},
    (f:ReturnType<typeof fixture>) => {f.set.variants[0].children![0].children![0].type = 'INSTANCE';},
  ]) {
    const f = fixture();change(f);
    assert.throws(f.read,/native-slot-default-anatomy-unqualified|declared.*(source|drawn)|source.*(declaration|projection)/i);
  }
  const incomplete = fixture();delete incomplete.set.variants[1].children![0].children![1];
  assert.throws(incomplete.read,{message:'figma-source-children-incomplete'},'a missing raw child refuses before source traversals');
  const unguarded = fixture();
  assert.throws(() => proposeFromDump(unguarded.set,unguarded.opts),/native-slot-default-anatomy-unqualified.*complete-declared-source-domain-required/);
  const hiddenUnknown = fixture();hiddenUnknown.opts.hiddenCaptured = false;
  assert.throws(hiddenUnknown.read,/native-slot-default-anatomy-unqualified.*hidden-membership-capture-required/);
  const noGeometryMint = fixture();noGeometryMint.opts.mintUnbound = false;
  assert.throws(noGeometryMint.read,/native-slot-default-anatomy-unqualified.*ordinary-source-geometry-mint-required/);
});

test('unsupported output surfaces refuse the new mode by name rather than outputting an empty slot', () => {
  const {contract,scope,tokens} = fixture().read(),ctx = {contracts:scope,tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map<string,string>()};
  assert.throws(() => emitHtml(contract,ctx),/SLOT_DIRECT_DEFAULT_ANATOMY_UNSUPPORTED:html/);
  assert.throws(() => emitWebComponent(contract,ctx),/SLOT_DIRECT_DEFAULT_ANATOMY_UNSUPPORTED:web-components/);
  assert.throws(() => emitCodeConnectReact(contract),/SLOT_DIRECT_DEFAULT_ANATOMY_UNSUPPORTED:code-connect/);
  assert.throws(() => emitCodeConnectHtml(contract),/SLOT_DIRECT_DEFAULT_ANATOMY_UNSUPPORTED:code-connect-html/);
});

test('same-named direct or nested defaults cannot borrow the first plane node type', () => {
  for (const nested of [false,true]) {
    const f = fixture();
    if (nested) {
      for (const [plane,variant] of f.set.variants.entries()) {
        const frame = variant.children![0].children![0];
        frame.children = [plane
          ? {...text(`cell:${plane}`,'Second plane'),name:'Cell'}
          : {name:'Cell',nodeId:`cell:${plane}`,type:'FRAME',layout:structuredClone(layout),
              fixedSize:{width:40,height:20},children:[text(`nested-label:${plane}`,'First plane')]}];
      }
    } else {
      const slot = f.set.variants[1].children![0],frame = slot.children![0];
      slot.children![0] = {...text(frame.nodeId!,'Second plane'),name:frame.name};
    }
    const before = JSON.stringify(f.set);
    assert.throws(f.read,error => error instanceof Error &&
      error.message.startsWith('native-slot-default-anatomy-unqualified:') &&
      error.message.endsWith(':direct-member-type-varies'));
    assert.equal(JSON.stringify(f.set),before,'type refusal retains every original source occurrence');
  }
});

test('ordinary React production proposal and batch retain direct defaults through the existing captured tuple route', () => {
  const f = fixture(),before = JSON.stringify(f.set),options = {...f.opts,drawnVariantSurface:'react-runtime' as const};
  const result = proposeFromDump(f.set,options),contract = ContractSchema.parse(result.contract),part = slotOf(contract);
  assert.equal(part.slot!.renderDefaultAnatomy,true);assert.equal(Object.keys(part.parts!).length,2);
  assert.deepEqual(contract.bindings.figma.drawnVariants,f.read().contract.bindings.figma.drawnVariants);
  assert(result.notes.some(note => note.startsWith('captured-drawn-react-domain:')));
  const batch = proposeBatchFromDump({[f.set.setName]:f.set},options);
  assert.deepEqual(batch.skipped,[]);assert.equal(batch.proposals.length,1);
  const batched = ContractSchema.parse(batch.proposals[0].contract);
  assert.deepEqual(slotOf(batched).slot,part.slot);
  assert.deepEqual(batched.bindings.figma.drawnVariants,contract.bindings.figma.drawnVariants);
  const tokens = {primitives:result.mintedTokens?.tree ?? {},semantic:{},light:{},dark:{},brands:{default:{}}};
  const scope = new Map([[contract.id,contract]]),Subject = subject(contract,emitReactInline(contract,{contracts:scope,tokens,icons:new Map()}).tsx);
  assert.throws(() => renderToStaticMarkup(createElement(Subject,{density:'unknown'})),(error:unknown) => {
    const refusal = error as {code?:unknown;message?:unknown;contractId?:unknown};
    return typeof error === 'object' && error !== null && refusal.code === 'DRAWN_VARIANT_UNDECLARED' &&
      refusal.message === `Undeclared variant combination: ${contract.id}` && refusal.contractId === contract.id;
  });
  assert.equal(JSON.stringify(f.set),before,'ordinary and batch routes retain the original source');
});

test('direct defaults cannot arm captured-domain inference for non-React, marked or unobserved sources', () => {
  const unguarded = fixture();
  assert.throws(() => proposeFromDump(unguarded.set,unguarded.opts),/complete-declared-source-domain-required/);
  const marked = fixture();marked.set.contractId = 'fixture.generated';
  assert.throws(() => proposeFromDump(marked.set,{...marked.opts,drawnVariantSurface:'react-runtime'}),/drawn-domain-source-marked/);
  const unreadable = fixture();
  assert.throws(() => proposeFromDump(unreadable.set,{...unreadable.opts,stampsObservable:false,drawnVariantSurface:'react-runtime'}),/drawn-domain-source-observation-unqualified/);
  const reviewable = fixture();
  assert.throws(() => proposeFromDump(reviewable.set,{...reviewable.opts,projectionMode:'reviewable-inversion',drawnVariantSurface:'react-runtime'}),/drawn-domain-source-observation-unqualified/);
  const counterfeit = fixture(),technical = new Error('native-slot-default-anatomy-unqualified:borrowed:complete-declared-source-domain-required');
  Object.defineProperty(counterfeit.set.variants[0],'children',{get(){throw technical;}});
  assert.throws(() => proposeFromDump(counterfeit.set,{...counterfeit.opts,drawnVariantSurface:'react-runtime'}),error => error === technical,
    'an arbitrary technical exception with the same headline cannot authorize a captured domain');
});
