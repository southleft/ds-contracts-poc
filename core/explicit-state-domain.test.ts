import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture():any{return {setName:'Drawn State',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover','Focus']}},variants:['Default','Hover','Focus'].map(state=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Label',type:'TEXT',text:{characters:'Same captured drawing',fontSize:12,fontFamily:'Arial',fontStyle:'Regular',lineHeight:16}}]}))};}
const opts={corpus,mintUnbound:true,stampsObservable:true,contractIdByName:new Map<string,string>()};
test('uncarried interaction drawings remain explicit finite states only on the qualified runtime route',()=>{
 const set=fixture(),before=JSON.stringify(set);
 assert.throws(()=>proposeFromDump(set,opts),/state-axis-state-not-carried/);
 const r=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 assert.equal(c.bindings.figma.drawnVariants?.length,3);
 const state=c.props.find(p=>p.bindings.figma.property==='State');assert(state);assert.deepEqual(state.type,{enum:['default','hover','focus']});
 assert.deepEqual(c.states,[]);assert.equal(JSON.stringify(set),before);
 assert(r.notes.some(n=>n.includes('interaction behavior and visual fidelity are not inferred')));
 assert.throws(()=>proposeFromDump(set,{...opts,stampsObservable:false,drawnVariantSurface:'react-runtime'}));
});
test('both React renderers preserve distinct drawn state content through switches',async t=>{
 const set=fixture();for(const v of set.variants)v.children[0].text.characters=v.variantProperties.State+' drawing';
 const r=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  for(const [state,expected] of [['default','Default drawing'],['hover','Hover drawing'],['focus','Focus drawing'],['default','Default drawing']]){
   await render({state});assert.equal(await page.locator('#root').innerText(),expected);
  }
  await page.evaluate(()=>window.addEventListener('error',event=>{(window as any).__drawnError=event.error}));
  const error=page.waitForEvent('pageerror');await render({state:'unknown'});await error;
  assert.equal(await page.evaluate(()=>(window as any).__drawnError?.code),'DRAWN_VARIANT_UNDECLARED');
  await page.close();
 }
});
