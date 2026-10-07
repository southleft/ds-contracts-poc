import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {emitReactInline} from './emit-react-inline.js';
import {reactEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {flattenTokens} from './tokens.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpSet} from '../extract/figma/types.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function source():DumpSet {return {setName:'CompoundEllipse',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},Side:{type:'VARIANT',defaultValue:'Left',variantOptions:['Left','Right']}},variants:['Small','Large'].flatMap(size=>['Left','Right'].map(side=>{
 const width=size==='Small'?40:60,height=size==='Small'?12:20,x=side==='Left'?0:width-height;
 return {name:`Size=${size}, Side=${side}`,variantProperties:{Size:size,Side:side},type:'COMPONENT',bbox:{width,height},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'CENTER',primarySizing:'FIXED',counterSizing:'AUTO',spacing:0,padding:[2,2,2,2]},children:[{name:'thumb',type:'ELLIPSE',shape:{kind:'ellipse',width:height,height,x,y:0,right:width-x-height,bottom:0,constraints:{horizontal:'LEFT',vertical:'CENTER'}},fill:{hex:'ffffff'}}]};
}))};}
function propose(dump=source()) {const p=proposeFromDump(dump,{corpus,mintUnbound:true,contractIdByName:new Map()});return {...p,contract:ContractSchema.parse(p.contract)};}
test('multi-axis ellipse placement preserves both size and out-of-flow position in generated React and native compilation',async t=>{
 const p=propose(),c=p.contract,thumb=c.anatomy.root.parts!.thumb;
 assert.equal(thumb.absoluteGeometryByCombination?.rows.length,4);
 assert.equal(thumb.literalsByProp,undefined,'derived shape dimensions have one owner');
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),mode:'light' as const};
 const files=reactEmitter.emit(c,ctx),browser=await chromium.launch();t.after(()=>browser.close());
 const inline=emitReactInline(c,ctx);
 // Shared CSS needs the same resolved variables as the inline token emitter.
 const cssVars=[...flattenTokens(p.mintedTokens!.tree)].map(([k,v])=>`--${k.split('.').join('-')}:${v.value}${v.type==='dimension'&&typeof v.value==='number'?'px':''}`).join(';');
 for(const output of [{tsx:inline.tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]) {
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:`:root{${cssVars}}`});
  for(const size of ['small','large'])for(const side of ['left','right']){
   await render({size,side});const box=await page.locator('#root > :first-child').evaluate(root=>{const r=root.getBoundingClientRect(),child=root.firstElementChild!,b=child.getBoundingClientRect();return {width:r.width,height:r.height,x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height,position:getComputedStyle(child).position};});
   const width=size==='small'?40:60,height=size==='small'?12:20;
   assert.deepEqual(box,{width,height,x:side==='left'?0:width-height,y:0,w:height,h:height,position:'absolute'});
  }
  await page.close();
 }
 const data=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);
 assert.equal(data.variants.length,4);
 for(const variant of data.variants) {
  const item=variant.spec.children![0],width=variant.name.includes('Large')?60:40,height=variant.name.includes('Large')?20:12;
  assert.deepEqual(item.absolute,{h:'MIN',v:'MIN',left:variant.name.includes('Right')?width-height:0,top:0});
  assert.equal(item.lits?.width,height);assert.equal(item.lits?.height,height);
 }
});

test('unproven parent extents and in-flow shapes do not acquire captured placement',()=>{
 const inconsistent=source();inconsistent.variants[0].bbox!.width+=5;
 const bad=propose(inconsistent);
 assert.equal(bad.contract.anatomy.root.parts!.thumb.absoluteGeometryByCombination,undefined);
 assert(bad.notes.some(note=>note.includes('absolute-placement-parent-inconsistent')));
 const flow=source();for(const variant of flow.variants){const shape=variant.children![0].shape!;delete shape.x;delete shape.y;delete shape.right;delete shape.bottom;}
 const c=propose(flow).contract;
 assert.equal(c.anatomy.root.parts!.thumb.absoluteGeometryByCombination,undefined);
 assert.equal(c.anatomy.root.tokens?.['min-height'],undefined);
});

test('uniform ellipse preserves stretch and scale constraints when its parent shrinks and grows',async t=>{
 for(const constraint of ['STRETCH','SCALE'] as const){
 const dump:DumpSet={setName:'StretchDot',type:'COMPONENT',variants:[{name:'StretchDot',type:'COMPONENT',bbox:{width:20,height:20},children:[{name:'dot',type:'ELLIPSE',fill:{hex:'334455'},shape:{kind:'ellipse',width:10,height:10,x:5,y:5,right:5,bottom:5,constraints:{horizontal:constraint,vertical:constraint}}}]}]};
 const p=propose(dump),c=p.contract;
 assert.equal(c.anatomy.root.parts!.dot.absoluteGeometry?.box.constraints.horizontal,constraint);
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:p.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),mode:'light' as const};
 const files=reactEmitter.emit(c,ctx),inline=emitReactInline(c,ctx),browser=await chromium.launch();t.after(()=>browser.close());
 const cssVars=[...flattenTokens(p.mintedTokens!.tree)].map(([k,v])=>`--${k.split('.').join('-')}:${v.value}${v.type==='dimension'&&typeof v.value==='number'?'px':''}`).join(';');
 for(const output of [{tsx:inline.tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]){
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,output.tsx,output.css);await page.addStyleTag({content:`:root{${cssVars}}`});await render({});
  for(const size of [20,16,32,20]){
   const box=await page.locator('#root > :first-child').evaluate((root,size)=>{const e=root as HTMLElement;e.style.width=`${size}px`;e.style.height=`${size}px`;const r=e.getBoundingClientRect(),b=e.firstElementChild!.getBoundingClientRect();return {x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height};},size);
   assert.deepEqual(box,constraint==='STRETCH'?{x:5,y:5,w:size-10,h:size-10}:{x:size/4,y:size/4,w:size/2,h:size/2});
  }
  await page.close();
 }
 const bad=structuredClone(dump);bad.variants[0].bbox!.width=25;
 assert.equal(propose(bad).contract.anatomy.root.parts!.dot.absoluteGeometry,undefined);
 }
});
