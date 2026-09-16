import type { DumpSet } from '../extract/figma/types.js';
import { chromium } from 'playwright-core';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';
import { mapRestToDump } from '../extract/figma/rest/map.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {ContractSchema, type Contract} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';

import {primitives,tokens,rootSlotSeed as seed} from './figma-root-slot.fixture.js';
const engine=createFigmaEngine({tokens,icons:new Map()});
const compile=(c:Contract)=>engine.compileComponentData(c,new Map([[c.id,c]]));

test('root content becomes one native slot with copied flow, spacing and no doubled box styling',()=>{
 const c=seed(),before=structuredClone(c),data=compile(c),root=data.variants[0].spec;
 assert.deepEqual(c,before);assert.deepEqual(data.rootSlot,{version:1,property:'Children'});
 assert.equal(root.bindings?.paddingTop,'gap8');
 assert.equal(root.children?.length,1);const slot=root.children![0];
 assert.equal(slot.type,'slot');assert.equal(slot.rootSlotContent,true);assert.equal(slot.slotProperty,'Children');
 assert.deepEqual(slot.layout,root.layout);assert.equal(slot.bindings?.itemSpacing,'gap8');
 assert.equal(slot.bindings?.paddingTop,undefined);assert.equal(slot.fixedWidth,undefined);assert.equal(slot.lits?.height,undefined);
 assert.equal(slot.slotDefault,undefined,'no sample inserted into an empty main');
 assert.equal(compile(c).variants[0].spec.children![0].rootSlotContent,true);
 const state=seed();state.states=['hover'];state.anatomy.root.states={hover:{gap:'{gap8}'}};
 assert.ok(compile(state).variants.every(v=>v.spec.children?.[0].rootSlotContent));
});

test('unknown, grid, wrapping, reversed and distributed root content cannot silently degrade',()=>{
 for(const mutate of [
  (c:Contract)=>{delete c.anatomy.root.layout;},
  (c:Contract)=>{c.anatomy.root.layout={display:'grid',columns:[{fr:1}]};},
  (c:Contract)=>{c.anatomy.root.layout!.wrap=true;},
  (c:Contract)=>{c.anatomy.root.layout!.direction='row-reverse';},
  (c:Contract)=>{c.anatomy.root.layout!.justify='space-between';},
  (c:Contract)=>{c.anatomy.root.parts={body:{text:'conflict'}};},
 ]){const c=seed();mutate(c);assert.throws(()=>compile(c),/FIGMA_ROOT_SLOT_(LAYOUT|DISTRIBUTION|SHAPE)_UNSUPPORTED|slot "children" declares display:grid/);}
});

test('native root-slot sizing, repeat identity, amend and retirement/readback guards execute on emitted programs',async()=>{
 const c=seed(),byId=new Map([[c.id,c]]);
 const {figma,root}=createFigmaMock();
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
 await run(engine.buildTokensScript(null));const script=()=>engine.buildComponentScript(c,byId);
 await run(script());
 const comp=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(comp);const slot=comp.children![0];const key=slot.componentPropertyReferences.slotContentId;
 assert.equal(slot.type,'SLOT');assert.equal(slot.layoutSizingHorizontal,'FILL');assert.equal(slot.layoutSizingVertical,'FILL');
 assert.deepEqual(JSON.parse(comp.getSharedPluginData('ds_contracts','rootSlot')),{version:1,property:'Children'});
 await run(script());assert.equal(comp.children![0].id,slot.id);assert.equal(comp.children![0].componentPropertyReferences.slotContentId,key);
 c.anatomy.root.literals={};await run(script());assert.equal(comp.children![0].componentPropertyReferences.slotContentId,key);
 assert.equal(comp.children![0].layoutSizingHorizontal,'HUG');assert.equal(comp.children![0].layoutSizingVertical,'HUG');
 const dumpSource=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([comp.name])};`);
 const dump=JSON.parse(JSON.stringify((await run(dumpSource))[comp.name]));assert.deepEqual(dump.rootSlot,{version:1,property:'Children'});
 const corpus=tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}});
 for(const mode of ['exact','reviewable-inversion'] as const){
  const proposal=proposeFromDump(dump,{corpus,contractIdByName:new Map(),fileKey:null,projectionMode:mode,mintUnbound:true});
  const restored=ContractSchema.parse(proposal.contract);
  assert.deepEqual(restored.anatomy.root.slot,{name:'children'});
  assert.equal(restored.anatomy.root.parts,undefined);
  assert.equal(restored.anatomy.root.tokens?.gap,'{gap8}');
  assert.equal(restored.anatomy.root.layout?.direction,'column');
  assert.equal(restored.anatomy.root.layout?.align,'start');
  assert.equal(restored.anatomy.root.layout?.justify,'start');
  if(mode==='exact'){
   const browser=await chromium.launch();
   try{for(const format of ['inline','module']){
    const byId=new Map([[restored.id,restored]]);
    const generated=format==='inline'?emitReactInline(restored,{tokens,icons:new Map(),contracts:byId}):emitReact(restored,{tokens:new Set(['gap8']),icons:new Map(),contracts:byId});
    const consumer=generated.tsx+`
export function Consumer({reverse=false}:{reverse?:boolean}){const first=<div key="first" data-content="first" style={{width:80,height:24}}/>;const second=<div key="second" data-content="second" style={{width:140,height:40}}/>;return <${restored.name}>{reverse?[second,first]:[first,second]}</${restored.name}>}`;
    const page=await browser.newPage();
    const render=await mountGenerated(page,'Consumer',consumer,'',format==='module'?{[restored.name]:{tsx:generated.tsx,css:'css' in generated ? generated.css as string : ''}}:{});
    await page.addStyleTag({content:':root{--gap8:8px}'});
    const measure=()=>page.locator('#root > *').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,children:[...n.children].map(c=>({name:c.getAttribute('data-content'),x:c.getBoundingClientRect().x-n.getBoundingClientRect().x,y:c.getBoundingClientRect().y-n.getBoundingClientRect().y}))}));
    assert.deepEqual(await measure(),{width:156,height:88,children:[{name:'first',x:8,y:8},{name:'second',x:8,y:40}]},format);
    await render({reverse:true});assert.deepEqual((await measure()).children,[{name:'second',x:8,y:8},{name:'first',x:8,y:56}]);
    await page.close();
   }}finally{await browser.close()}
  }
 }
 for(const mutate of [
  (d:any)=>{d.rootSlot.version=2;},
  (d:any)=>{d.variants[0].children.push({name:'extra',type:'FRAME'});},
  (d:any)=>{d.variants[0].children[0].fill={color:'#ff0000'};},
  (d:any)=>{d.variants[0].children[0].layout.spacing=17;},
  (d:any)=>{d.variants[0].children[0].layout.padding[0]=8;},
  (d:any)=>{d.variants[0].children[0].fillWidth=true;},
  (d:any)=>{d.variants[0].children[0].children=[{type:'TEXT',name:'authored'}];},
  (d:any)=>{d.variants[0].children[0].propRefs.slotContentId='Other';},
  (d:any)=>{d.propertyDefinitions={};},
 ]){const changed=structuredClone(dump);mutate(changed);assert.throws(()=>proposeFromDump(changed,{corpus,contractIdByName:new Map()}),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);}
 const before=comp.children![0].id;delete c.anatomy.root.slot;
 await assert.rejects(()=>run(script()),/FIGMA_ROOT_SLOT_RETIREMENT_REFUSED/);assert.equal(comp.children![0].id,before);
});


test('REST retains malformed root metadata so proposal cannot silently unwrap it',()=>{
 for(const rootSlot of ['{bad',JSON.stringify({version:1,property:'Children'})]){
  const mapped=mapRestToDump({name:'fixture',nodes:{'1:1':{document:{id:'1:1',name:'Box',type:'COMPONENT',children:[],sharedPluginData:{ds_contracts:{rootSlot}}}}}} as any);
  assert.equal(typeof (mapped.dump.Box as DumpSet).rootSlot,rootSlot==='{bad'?'string':'object');
  assert.throws(()=>proposeFromDump(mapped.dump.Box as DumpSet,{corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map()}),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);
 }
});


test('fixed content roots keep their native outer dimensions without a consumer CSS reset',async()=>{
 const c=seed(),byId=new Map([[c.id,c]]),browser=await chromium.launch();
 try{for(const format of ['inline','module']){
  const generated=format==='inline'?emitReactInline(c,{tokens,icons:new Map(),contracts:byId}):emitReact(c,{tokens:new Set(['gap8']),icons:new Map(),contracts:byId});
  const consumer=generated.tsx+`\nexport function Consumer(){return <${c.name}><span>Caller content</span></${c.name}>}`;
  const page=await browser.newPage();
  await mountGenerated(page,'Consumer',consumer,'',format==='module'?{[c.name]:{tsx:generated.tsx,css:'css' in generated ? generated.css as string : ''}}:{});
  await page.addStyleTag({content:':root{--gap8:8px}'});
  const size=await page.locator('#root > *').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,boxSizing:getComputedStyle(n).boxSizing,padding:getComputedStyle(n).padding}));
  assert.deepEqual(size,{width:300,height:180,boxSizing:'border-box',padding:'8px'},format);
  await page.close();
 }}finally{await browser.close()}
});
