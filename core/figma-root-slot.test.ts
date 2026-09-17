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
import {flattenTokens} from './tokens.js';
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
  (c:Contract)=>{c.anatomy.root.layoutByProp={prop:'mode',map:{inline:{display:'inline-flex'}}};},
 ]){const c=seed();mutate(c);assert.throws(()=>compile(c),/FIGMA_ROOT_SLOT_(LAYOUT|DISTRIBUTION|SHAPE)_UNSUPPORTED|slot "children" declares display:grid/);}
});

for(const display of ['flex','inline-flex'] as const) test(`native ${display} root-slot sizing, repeat, amend and checked React readback`,async()=>{
 const c=seed(),byId=new Map([[c.id,c]]);
 c.anatomy.root.layout!.display=display;
 const marker={version:1,property:'Children',...(display==='inline-flex'?{display}:{})};
 const {figma,root}=createFigmaMock();
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
 await run(engine.buildTokensScript(null));const script=()=>engine.buildComponentScript(c,byId);
 await run(script());
 const comp=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(comp);const slot=comp.children![0];const key=slot.componentPropertyReferences.slotContentId;
 assert.equal(slot.type,'SLOT');assert.equal(slot.layoutSizingHorizontal,'FILL');assert.equal(slot.layoutSizingVertical,'FILL');
 assert.deepEqual(JSON.parse(comp.getSharedPluginData('ds_contracts','rootSlot')),marker);
 await run(script());assert.equal(comp.children![0].id,slot.id);assert.equal(comp.children![0].componentPropertyReferences.slotContentId,key);
 c.anatomy.root.literals={};await run(script());assert.equal(comp.children![0].componentPropertyReferences.slotContentId,key);
 assert.equal(comp.children![0].layoutSizingHorizontal,'HUG');assert.equal(comp.children![0].layoutSizingVertical,'HUG');
 const dumpSource=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([comp.name])};`);
 const dump=JSON.parse(JSON.stringify((await run(dumpSource))[comp.name]));assert.deepEqual(dump.rootSlot,marker);
 const corpus=tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}});
 for(const mode of ['exact','reviewable-inversion'] as const){
  const proposal=proposeFromDump(dump,{corpus,contractIdByName:new Map(),fileKey:null,projectionMode:mode,mintUnbound:true});
  const restored=ContractSchema.parse(proposal.contract);
  assert.deepEqual(restored.anatomy.root.slot,{name:'children'});
  assert.equal(restored.anatomy.root.parts,undefined);
  assert.equal(restored.anatomy.root.tokens?.gap,'{gap8}');
  assert.equal(restored.anatomy.root.layout?.display,display);
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
    assert.equal(await page.locator('#root > *').evaluate(n=>getComputedStyle(n).display),display,format);
    const measure=()=>page.locator('#root > *').evaluate(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,children:[...n.children].map(c=>({name:c.getAttribute('data-content'),x:c.getBoundingClientRect().x-n.getBoundingClientRect().x,y:c.getBoundingClientRect().y-n.getBoundingClientRect().y}))}));
    assert.deepEqual(await measure(),{width:156,height:88,children:[{name:'first',x:8,y:8},{name:'second',x:8,y:40}]},format);
    await render({reverse:true});assert.deepEqual((await measure()).children,[{name:'second',x:8,y:8},{name:'first',x:8,y:56}]);
    await page.close();
   }}finally{await browser.close()}
  }
 }
 for(const mutate of [
  (d:any)=>{d.rootSlot.version=2;},
  (d:any)=>{d.rootSlot.display='grid';},
  (d:any)=>{d.rootSlot.unrecognized=true;},
  (d:any)=>{d.variants[0].children.push({name:'extra',type:'FRAME'});},
  (d:any)=>{d.variants[0].children[0].fill={color:'#ff0000'};},
  (d:any)=>{d.variants[0].children[0].layout.spacing=17;},
  (d:any)=>{d.variants[0].children[0].layout.padding[0]=8;},
  (d:any)=>{d.variants[0].children[0].fillWidth=true;},
  (d:any)=>{d.variants[0].children[0].children=[{type:'TEXT',name:'authored'}];},
  (d:any)=>{d.variants[0].children[0].propRefs.slotContentId='Other';},
  (d:any)=>{d.propertyDefinitions={};},
 ]){const changed=structuredClone(dump);mutate(changed);assert.throws(()=>proposeFromDump(changed,{corpus,contractIdByName:new Map()}),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);}
 const before=comp.children![0].id;
 c.anatomy.root.layout!.display=display==='flex'?'inline-flex':'flex';
 await assert.rejects(()=>run(script()),/FIGMA_ROOT_SLOT_RETIREMENT_REFUSED/);
 assert.equal(comp.children![0].id,before);
 c.anatomy.root.layout!.display=display;delete c.anatomy.root.slot;
 await assert.rejects(()=>run(script()),/FIGMA_ROOT_SLOT_RETIREMENT_REFUSED/);assert.equal(comp.children![0].id,before);
});


test('REST retains malformed root metadata so proposal cannot silently unwrap it',()=>{
 for(const rootSlot of ['{bad',JSON.stringify({version:1,property:'Children'})]){
  const mapped=mapRestToDump({name:'fixture',nodes:{'1:1':{document:{id:'1:1',name:'Box',type:'COMPONENT',children:[],sharedPluginData:{ds_contracts:{rootSlot}}}}}} as any);
  assert.equal(typeof (mapped.dump.Box as DumpSet).rootSlot,rootSlot==='{bad'?'string':'object');
  assert.throws(()=>proposeFromDump(mapped.dump.Box as DumpSet,{corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map()}),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);
 }
});


for (const display of ['flex', 'inline-flex', 'grid', 'block'] as const) test(`full-width ${display} content restores a parent-relative React width`, async () => {
 const c=seed();c.anatomy.root.literals={width:'100%',height:'fit-content'};
 c.anatomy.root.layout=display==='grid'
  ? {display,columns:[{fr:1}],rows:[{fit:true}],autoRows:{fit:true},flow:'row'}
  : display === 'block' ? undefined : {display,direction:'column',align:'start'};
 if(display==='block'){c.anatomy.root.declared={display:'block'};delete c.anatomy.root.tokens!.gap;}
 const data=compile(c);
 assert.deepEqual(data.rootSlot,{version:display==='block'?4:3,property:'Children',display,width:'fill'});
 assert.equal(data.variants[0].spec.rootFillWidth,true);
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
 await run(engine.buildTokensScript(null));
 const script=engine.buildComponentScript(c,new Map([[c.id,c]]));await run(script);
 const comp=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(comp);assert.equal(comp.counterAxisSizingMode,'FIXED');
 assert.equal(comp.children![0].layoutSizingHorizontal,'FILL');
 const id=comp.id;await run(script);assert.equal(comp.id,id);
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([comp.name])};`);
 const dump=JSON.parse(JSON.stringify((await run(source))[comp.name]));
 const options={corpus:tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),fileKey:null,mintUnbound:true};
 const proposal=proposeFromDump(dump,options),restored=ContractSchema.parse(proposal.contract);
 assert.equal(restored.anatomy.root.literals?.width,'100%');
 assert.equal(restored.anatomy.root.tokens?.width,undefined);
 if(display==='block'){
  assert.equal(restored.anatomy.root.declared?.display,'block');assert.equal(restored.anatomy.root.layout,undefined);
  assert.equal(restored.anatomy.root.literals?.height,'fit-content');
  for(const mutate of [(d:any)=>{d.variants[0].layout.mode='HORIZONTAL';},
    (d:any)=>{d.variants[0].layout.spacing=8;},(d:any)=>{d.variants[0].layout.primarySizing='FIXED';}]){
   const bad=structuredClone(dump);mutate(bad);assert.throws(()=>proposeFromDump(bad,options),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);
  }
 }
 for(const mutate of [
  (d:any)=>{d.rootSlot.width='auto';},
  (d:any)=>{d.variants[0].layout.counterSizing='AUTO';},
  (d:any)=>{d.variants[0].bound={...d.variants[0].bound,width:'gap8'};},
  (d:any)=>{d.variants[0].children[0].fillWidth=false;},
 ]){const bad=structuredClone(dump);mutate(bad);assert.throws(()=>proposeFromDump(bad,options),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);}
 const browser=await chromium.launch();
 try {for(const contract of [c,restored]) for(const format of ['inline','module']) {
  const mergedTokens={...tokens,primitives:{...primitives,...proposal.mintedTokens?.tree}},flat=flattenTokens(mergedTokens.primitives);
  const generated=format==='inline'?emitReactInline(contract,{tokens:mergedTokens,icons:new Map(),contracts:new Map([[contract.id,contract]])})
   :emitReact(contract,{tokens:new Set(flat.keys()),icons:new Map(),contracts:new Map([[contract.id,contract]])});
  const consumer=generated.tsx+(display==='block'
   ? `\nexport function Consumer({width=360,label="Reusable content"}:{width?:number;label?:string}){return <div style={{width}}><${contract.name}>{label}</${contract.name}><div data-reference style={{padding:8,boxSizing:'border-box'}}>{label}</div></div>}`
   : `\nexport function Consumer({width=360}:{width?:number}){return <div style={{width}}><${contract.name}><span>Reusable content</span></${contract.name}></div>}`);
  const page=await browser.newPage(),render=await mountGenerated(page,'Consumer',consumer,'',format==='module'?{[contract.name]:{tsx:generated.tsx,css:'css' in generated?generated.css as string:''}}:{});
  await page.addStyleTag({content:':root{'+[...flat].map(([name,token])=>'--'+name.replaceAll('.','-')+':'+token.value).join(';')+'}'});
  for(const width of [360,520,240]){await render({width});assert.equal(await page.locator('#root > div > :first-child').evaluate(n=>n.getBoundingClientRect().width),width,`${format}/${contract.id}`);
   if(display==='block')for(const label of ['Short title','A longer description with enough text to wrap across several lines when the parent width is reduced. '.repeat(3)]){
    await render({width,label});
    assert.equal(await page.locator('#root > div > :first-child').evaluate(n=>getComputedStyle(n).display),'block');
    const boxes=await page.locator('#root > div > *').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,text:n.textContent})));
    assert.deepEqual(boxes[0],boxes[1],`${format}/${contract.id}/${width}/text wrapping`);
   }}
  await page.close();
 }} finally {await browser.close();}
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

for (const intrinsic of [false, true]) for (const spacing of ['layout', 'token', 'mixed', 'literal', 'fractional', 'flow'] as const)
if (!intrinsic || spacing !== 'fractional') test(`grid root slot restores one React root (${intrinsic ? 'intrinsic' : 'fixed'} height, ${spacing} gaps)`, async () => {
 const c=seed();
 c.anatomy.root.layout={display:'grid',columns:[{fr:1},{fr:1}],rows:[{fit:true},{fit:true}],flow:'row',gap:{row:8,column:12}};
 if(spacing==='fractional')c.anatomy.root.layout.rows=[{fr:1}];
 if(spacing==='flow'){delete c.anatomy.root.layout.rows;c.anatomy.root.layout.autoRows={fit:true};}
 delete c.anatomy.root.tokens!.gap;
 let expectedGap: {row:number|string;column:number|string}={row:8,column:12};
 if(spacing==='token') {
  c.anatomy.root.tokens!.gap='{gap8}';
  expectedGap={row:'{gap8}',column:'{gap8}'};
 } else if(spacing==='mixed') {
  c.anatomy.root.layout.gap={row:'{gap8}',column:20};
  expectedGap={row:'{gap8}',column:20};
 } else if(spacing==='literal') {
  c.anatomy.root.tokens!['row-gap']='{gap8}';
  c.anatomy.root.literals!.gap='16px';
  expectedGap={row:16,column:16};
 }
 if(intrinsic)c.anatomy.root.literals!.height='fit-content';
 const before=structuredClone(c),data=compile(c),outer=data.variants[0].spec,slot=outer.children![0],grid=slot.children![0];
 assert.deepEqual(c,before);
 assert.deepEqual(data.rootSlot,{version:2,property:'Children',display:'grid'});
 assert.equal(outer.layout!.mode,'VERTICAL');assert.equal(slot.layout!.mode,'VERTICAL');
 assert.equal(grid.type,'frame');assert.equal(grid.layout!.mode,'GRID');assert.deepEqual(grid.children,[]);
 assert.equal(grid.fixedWidth,undefined);
 assert.equal(outer.bindings?.itemSpacing,undefined);assert.equal(outer.bindings?.gridRowGap,undefined);
 assert.equal(slot.bindings,undefined,'neutral slot has no active gap binding');
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(code:string)=>vm.runInContext(`(async()=>{${code}\n})()`,context,{timeout:20000}) as Promise<any>;
 const byId=new Map([[c.id,c]]);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(c,byId));
 const comp=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);
 assert.ok(comp);const nativeSlot=comp.children![0],nativeGrid=nativeSlot.children![0];
 assert.equal(nativeSlot.type,'SLOT');assert.equal(nativeGrid.type,'FRAME');assert.equal(nativeGrid.layoutMode,'GRID');
 assert.equal(nativeGrid.layoutSizingHorizontal,'FILL');assert.equal(nativeGrid.layoutSizingVertical,intrinsic?'HUG':'FILL');
 assert.deepEqual(JSON.parse(JSON.stringify(nativeGrid.gridRowSizes)),spacing==='fractional'?[{type:'FLEX',value:1}]:spacing==='flow'?[{type:'HUG',value:1}]:[{type:'HUG',value:1},{type:'HUG',value:1}]);
 const source=readFileSync(new URL('../extract/figma/dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,`const TARGET_SETS = ${JSON.stringify([comp.name])};`);
 const dump=JSON.parse(JSON.stringify((await run(source))[comp.name]));
 const corpus=tokenCorpusFromJson({primitives,semantic:{},light:{},brandDefault:{}});
 const options={corpus,contractIdByName:new Map<string,string>(),fileKey:null,mintUnbound:true};
 const originalDump=structuredClone(dump);
 const proposal=proposeFromDump(dump,options),restored=ContractSchema.parse(proposal.contract);
 assert.deepEqual(dump,originalDump,'checked normalization must not mutate the source dump');
 assert.deepEqual(restored.anatomy.root.slot,{name:'children'});assert.equal(restored.anatomy.root.parts,undefined);
 assert.equal(restored.anatomy.root.layout?.display,'grid');
 assert.deepEqual(restored.anatomy.root.layout?.columns,[{fr:1},{fr:1}]);
 assert.deepEqual(restored.anatomy.root.layout?.rows,c.anatomy.root.layout.rows,'empty content must not erase declared fractional rows');
 assert.deepEqual(restored.anatomy.root.layout?.autoRows,c.anatomy.root.layout.autoRows);
 if(spacing==='flow') {
  for(const mutate of [(g:any)=>{g.rows[0]={px:23}},(g:any)=>{g.flowRows.version=2},(g:any)=>{g.flowRows.extra=true}]){
   const bad=structuredClone(dump);mutate(bad.variants[0].children[0].children[0].layout.grid);
   assert.throws(()=>proposeFromDump(bad,options),/grid-flow-rows-/);
  }
 }
 assert.deepEqual(restored.anatomy.root.layout?.gap,expectedGap);
 assert.equal(nativeGrid.gridRowGap,typeof expectedGap.row==='number'?expectedGap.row:8);
 assert.equal(nativeGrid.gridColumnGap,typeof expectedGap.column==='number'?expectedGap.column:8);
 assert.equal(Boolean(nativeGrid.boundVariables.gridRowGap),typeof expectedGap.row==='string');
 assert.equal(Boolean(nativeGrid.boundVariables.gridColumnGap),typeof expectedGap.column==='string');
 const browser=await chromium.launch();
 try{
  const results=[];
  for(const contract of [c,restored]) for(const format of ['inline','module']) {
   const mergedTokens={...tokens,primitives:{...primitives,...proposal.mintedTokens?.tree}};
   const flat=flattenTokens(mergedTokens.primitives);
   const generated=format==='inline'?emitReactInline(contract,{tokens:mergedTokens,icons:new Map(),contracts:new Map([[contract.id,contract]])})
    :emitReact(contract,{tokens:new Set(flat.keys()),icons:new Map(),contracts:new Map([[contract.id,contract]])});
   const consumer=generated.tsx+`\nexport function Consumer({height=24,reverse=false,count=3}:{height?:number;reverse?:boolean;count?:number}){const children=[<div key="a" data-child="a" style={{width:40,height}}/>,<div key="b" data-child="b" style={{width:80,height:40}}/>,<div key="c" data-child="c" style={{width:60,height:28}}/>].slice(0,count);return <${contract.name}>{reverse?children.reverse():children}</${contract.name}>}`;
   const page=await browser.newPage(),render=await mountGenerated(page,'Consumer',consumer,'',format==='module'?{[contract.name]:{tsx:generated.tsx,css:'css' in generated?generated.css as string:''}}:{});
   await page.addStyleTag({content:':root{'+[...flat].map(([name,token])=>'--'+name.replaceAll('.','-')+':'+token.value).join(';')+'}'});
   const measurements=[];
   for(const props of [{height:24},{height:72},{height:72,reverse:true},{height:24,count:1}]){
    await render(props);
    measurements.push(await page.locator('#root > *').evaluate(n=>{
     const box=n.getBoundingClientRect();return {display:getComputedStyle(n).display,width:box.width,height:box.height,
      children:[...n.children].map(child=>{const b=child.getBoundingClientRect();return {id:child.getAttribute('data-child'),x:b.x-box.x,y:b.y-box.y,width:b.width,height:b.height}})};
    }));
   }
   results.push(measurements);await page.close();
  }
  assert.deepEqual(results[1],results[0],'both React styling formats implement the same declared grid');
  assert.deepEqual(results[2],results[0],'extracted inline React preserves dynamic caller content without extra DOM wrappers');
  assert.deepEqual(results[3],results[1],'extracted CSS-module React preserves dynamic caller content without extra DOM wrappers');
  assert.equal(results[1][0].display,'grid');assert.equal(results[1][0].width,300);
  assert.deepEqual(results[1][0].children.map(child=>child.id),['a','b','c']);
 }finally{await browser.close()}
 for(const change of [
  (d:any)=>{d.variants[0].children[0].children=[];},
  (d:any)=>{d.variants[0].children[0].children[0].children=[{type:'TEXT',name:'default'}];},
  (d:any)=>{d.variants[0].children[0].children[0].fill={hex:'#ffffff'};},
  (d:any)=>{d.variants[0].children[0].children[0].bound={opacity:'gap8'};},
  (d:any)=>{d.variants[0].bound={...d.variants[0].bound,itemSpacing:'gap8'};},
  (d:any)=>{d.variants[0].children[0].children[0].layout.padding[0]=4;},
  (d:any)=>{d.variants[0].children[0].children[0].layout.grid.flow=undefined;},
  (d:any)=>{d.variants[0].children[0].children[0].fillWidth=false;},
  (d:any)=>{d.variants[0].children[0].layout.spacing=3;},
  (d:any)=>{const second=structuredClone(d.variants[0]);second.name='Other';second.children[0].children[0].layout.grid.rowGap++;d.variants.push(second);},
  (d:any)=>{const second=structuredClone(d.variants[0]);second.name='Other';second.children[0].children[0].bound={gridRowGap:'different'};d.variants.push(second);},
  (d:any)=>{d.rootSlot.version=1;},
 ]){const altered=structuredClone(dump);change(altered);assert.throws(()=>proposeFromDump(altered,options),/FIGMA_ROOT_SLOT_READBACK_UNQUALIFIED/);}
 const slotId=nativeSlot.id;
 await run(engine.buildComponentScript(c,byId));assert.equal(comp.children![0].id,slotId,'repeat does not replace the slot');
});
