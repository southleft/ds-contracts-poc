import test from 'node:test';import assert from 'node:assert/strict';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {proposeDeclaredDrawnDraftPaintCandidate} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';
import {mountGenerated} from './react-test-runtime.js';import {chromium} from 'playwright-core';
const gray={color:{r:.5,g:.5,b:.5},opacity:1,blendMode:'NORMAL'};
function fixture(wrapped:boolean){
 const child=ContractSchema.parse({id:'test.default-paint',name:'DefaultPaint',version:'1.0.0',status:'draft',description:'Independent child paint',semantics:{element:'div'},states:[],props:[],anatomy:{root:{literals:{width:'20px',height:'20px'},solidFillComposition:gray}},bindings:{code:{anchors:{importPath:'./DefaultPaint',export:'DefaultPaint'}},figma:{anchors:{fileKey:'fixture',componentSetKey:'child-key',nodeId:'main'}}}});
 const layout={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
 const set:any={setName:'PaintSlot',key:'parent-key',type:'COMPONENT_SET',propertyDefinitions:{Tone:{type:'VARIANT',defaultValue:'Red',variantOptions:['Red','Blue']},Icon:{type:'INSTANCE_SWAP',defaultValue:'main'}},variants:['Red','Blue'].map((tone,i)=>{const instance={name:'DefaultPaint',nodeId:'usage'+i,type:'INSTANCE',instanceOf:'DefaultPaint',instanceKey:'child-key',propRefs:{mainComponent:'Icon'},bbox:{width:20,height:20},sourceFillComposition:{paint:{color:{r:i?0:1,g:0,b:i?1:0},opacity:.5,blendMode:'MULTIPLY'}}};return{name:'Tone='+tone,type:'COMPONENT',variantProperties:{Tone:tone},layout,children:[wrapped?{name:'Host',type:'FRAME',layout,children:[instance]}:instance]};})};
 const opts={fileKey:'fixture',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,stampsObservable:true,contractIdByName:new Map([[child.name,child.id]]),contractIdByKey:new Map([['child-key',child.id]]),contractsById:new Map([[child.id,child]])};
 return{child,set,opts};
}
test('a keyed component named Slot retains its declared runtime default rather than losing visible content by name',()=>{
 const {child,set,opts}=fixture(false);
 child.name='Slot';opts.contractIdByName=new Map([['Slot',child.id]]);
 for(const variant of set.variants){variant.children[0].instanceOf='Slot';variant.children[0].name='Slot';}
 const result=proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)).proposal;
 const slot=walkAnatomy(ContractSchema.parse(result.contract)).find(w=>w.part.slot)!.part.slot!;
 assert.equal(slot.renderDefault,true);assert.equal(slot.defaultContent?.[0].id,child.id);
 opts.contractIdByKey.clear();
 assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)),/solid-fill-composition-slot-layout-unqualified/);
});
test('omitted slot content carries independently observed rectangular root size without sizing replacements',async t=>{
 const {child,set,opts}=fixture(false);child.anatomy.root.instanceRootInputs=['width','height','opacity'];
 for(const [i,v] of set.variants.entries()){
  const n=v.children[0],transform=[[1,0,0],[0,1,0]],localSize={width:i?60:40,height:20};
  n.instanceGeometry={nodeId:n.nodeId,componentId:'main',transform,localSize};
  n.opacity=.5;
  n.instanceRootOverrides={nodeId:n.nodeId,componentId:'main',componentKey:'child-key',fields:['width','height','opacity'],localTransform:transform,localSize,mainSize:{width:20,height:20}};
 }
 const result=proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)).proposal;
 const parent=ContractSchema.parse(result.contract),slot=walkAnatomy(parent).find(w=>w.part.slot)!.part;
 const fallback=Object.values(slot.parts!)[0];assert(fallback.component?.rootOverrides?.width);
 assert.equal(fallback.component?.rootOverrides?.opacity,undefined,'slot wrapper opacity must not be applied a second time');
 const contracts=new Map([[child.id,child],[parent.id,parent]]),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const out=emitter.emit(parent,{contracts,tokens,icons:new Map()}),dep=emitter.emit(child,{contracts,tokens,icons:new Map()}),page=await browser.newPage();
  const render=await mountGenerated(page,parent.name,out[0].contents,out.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:dep[0].contents,css:dep.find(f=>f.path.endsWith('.css'))?.contents??''}});
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const tone of ['red','blue','red']){
   await render({tone});assert.equal(await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').evaluate(el=>el.getBoundingClientRect().width),tone==='red'?40:60);
   await render({tone,children:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');assert.equal(await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').count(),0);
  }
  await page.close();
 }
});
for(const wrapped of [true,false])test(`composed instance paint belongs only to omitted ${wrapped?'wrapped':'bare'} slot default`,async t=>{
 const {child,set,opts}=fixture(wrapped),before=JSON.stringify({child,set});
 const result=proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)).proposal;
 const parent=ContractSchema.parse(result.contract),slot=walkAnatomy(parent).find(w=>w.part.slot)!.part,instance=Object.values(slot.parts??{})[0];
 assert.equal(JSON.stringify({child,set}),before);assert(slot.slot!.renderDefault);assert(!slot.solidFillComposition&&!slot.solidFillCompositionByCombination);
 assert.equal(instance.component?.id,child.id);assert.equal(instance.solidFillCompositionByCombination?.rows.length,2);assert.equal(result.draftPaintQualification?.sourceOccurrences,2);
 const contracts=new Map([[child.id,child],[parent.id,parent]]),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,contracts);
 for(const variant of data.variants){const host=variant.spec.children![0];assert.equal(host.type,'slot');assert.equal(host.solidFillComposition,undefined);assert.equal(host.children![0].type,'instance');assert.equal(host.children![0].solidFillComposition?.blendMode,'MULTIPLY');}
 const b=await chromium.launch();t.after(()=>b.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const out=emitter.emit(parent,{contracts,tokens,icons:new Map()}),dep=emitter.emit(child,{contracts,tokens,icons:new Map()}),page=await b.newPage();
  const render=await mountGenerated(page,parent.name,out[0].contents,out.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:dep[0].contents,css:dep.find(f=>f.path.endsWith('.css'))?.contents??''}});
  for(const tone of ['red','blue']){
   await render({tone});assert.equal(await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').count(),1);
   const color=await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').evaluate(el=>getComputedStyle(el).getPropertyValue('--dsc-instance-fill-color').replace(/\s+/g,''));
   assert.equal(color,tone==='red'?'rgba(255,0,0,0.5)':'rgba(0,0,255,0.5)');
   await render({tone,children:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');assert.equal(await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').count(),0);
   await render({tone,children:null});assert.equal(await page.locator('#root [style*="--dsc-instance-fill-blend: multiply"]').count(),0);
  }
  await page.close();
 }
});
test('unlinked or undeclared slot defaults cannot consume source paint evidence',()=>{
 for(const mutation of ['unlinked','wrong-default']){
  const {set,opts}=fixture(true);if(mutation==='unlinked'){opts.contractsById.clear();opts.contractIdByName.clear();opts.contractIdByKey.clear();}else set.propertyDefinitions.Icon.defaultValue='other';
  assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)),/source-occurrence-unconsumed/);
 }
});

test('every painted slot default must match the child key; names cannot grant paint authority',()=>{
 for(const key of [undefined,'different-key']){
  const {set,opts}=fixture(true);set.variants[1].children[0].children[0].instanceKey=key;
  assert.throws(()=>proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)),/slot-default-identity-unqualified/);
 }
});

test('a Boolean-controlled swap keeps the same named caller input with or without a frame wrapper',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const wrapped of [false,true]){
  const {child,set,opts}=fixture(wrapped);
  set.propertyDefinitions.Enabled={type:'BOOLEAN',defaultValue:true};
  for(const variant of set.variants){const host=variant.children[0];host.propRefs={...host.propRefs,visible:'Enabled'};}
  const result=proposeDeclaredDrawnDraftPaintCandidate(set,opts,set.variants.map((v:any)=>v.variantProperties)).proposal;
  const parent=ContractSchema.parse(result.contract),slots=walkAnatomy(parent).filter(w=>w.part.slot);
  assert.equal(slots.length,1);assert.equal(slots[0].part.slot!.name,'icon');assert.equal(slots[0].part.visibleWhen!.prop,'enabled');
  const contracts=new Map([[child.id,child],[parent.id,parent]]),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const out=emitter.emit(parent,{contracts,tokens,icons:new Map()}),dep=emitter.emit(child,{contracts,tokens,icons:new Map()}),page=await browser.newPage();
   const render=await mountGenerated(page,parent.name,out[0].contents,out.find(f=>f.path.endsWith('.css'))?.contents,{[child.name]:{tsx:dep[0].contents,css:dep.find(f=>f.path.endsWith('.css'))?.contents??''}});
   await render({enabled:true,icon:'Caller glyph'});assert.equal(await page.locator('#root').innerText(),'Caller glyph');
   await render({enabled:false,icon:'Caller glyph'});assert.equal(await page.locator('#root').innerText(),'');
   await page.close();
  }
 }
});

test('optional slot convention is not reintroduced as an independent Boolean',async()=>{
 const {proposeFromDump}=await import('./propose-figma.js');
 const {loadTokenCorpus}=await import('../extract/figma/tokens.js');
 const {readFileSync}=await import('node:fs');
 const dump=JSON.parse(readFileSync('extract/figma/fixtures/main-file-dumps.json','utf8')).Card;
 const options={projectionMode:'reviewable-inversion' as const,corpus:loadTokenCorpus(process.cwd()),contractIdByName:new Map([['Avatar','ds.avatar'],['Slot','ds.slot']])};
 const proposed=proposeFromDump(dump,options).contract as any;
 assert.equal(proposed.anatomy.root.parts.footer.optional,true);
 assert.equal(proposed.anatomy.root.parts.footer.visibleWhen,undefined);
 assert.equal(proposed.props.some((p:any)=>p.name==='showActions'),false);
 const independent=structuredClone(dump);
 for(const variant of independent.variants)variant.children.find((n:any)=>n.name==='footer').propRefs.visible='Enabled';
 const explicit=proposeFromDump(independent,options).contract as any;
 assert.deepEqual(explicit.anatomy.root.parts.footer.visibleWhen,{prop:'enabled'});
 assert(explicit.props.some((p:any)=>p.name==='enabled'));
});
