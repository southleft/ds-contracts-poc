import test from 'node:test';
import assert from 'node:assert/strict';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';

test('a swap-bound instance and a fixed selection retain both observed choices across variants',async()=>{
 const children=['First','Second'].map(name=>ContractSchema.parse({id:`test.${name.toLowerCase()}`,name,version:'1.0.0',description:'Captured icon',semantics:{element:'div'},states:[],props:[],anatomy:{root:{literals:{width:'20px',height:'20px','background-color':name==='First'?'#ff0000':'#0000ff'}}},bindings:{code:{anchors:{importPath:`./${name}`,export:name}},figma:{anchors:{fileKey:'fixture',componentSetKey:`${name==='First'?'z':'a'}-key`,nodeId:`${name}-main`}}}}));
 const set:any={setName:'MixedSelection',type:'COMPONENT_SET',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'A',variantOptions:['A','B']},Icon:{type:'INSTANCE_SWAP',defaultValue:'First-main'}},variants:children.map((child,i)=>({name:`Mode=${i?'B':'A'}`,type:'COMPONENT',variantProperties:{Mode:i?'B':'A'},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Icon',type:'INSTANCE',nodeId:`usage-${i}`,instanceOf:child.name,instanceKey:`${child.name==='First'?'z':'a'}-key`,...(i?{}:{propRefs:{mainComponent:'Icon'}}),bbox:{width:20,height:20},instanceGeometry:{nodeId:`usage-${i}`,componentId:`${child.name}-main`,transform:[[1,0,0],[0,1,0]],localSize:{width:20,height:20}}}]}))};
 const result=proposeFromDump(set,{fileKey:'fixture',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,stampsObservable:true,contractIdByName:new Map(children.map(c=>[c.name,c.id])),contractIdByKey:new Map(children.map(c=>[`${c.name==='First'?'z':'a'}-key`,c.id])),contractsById:new Map(children.map(c=>[c.id,c]))});
 const {canonicalJson}=await import('./contract-provenance.js');
 const contract=ContractSchema.parse(JSON.parse(canonicalJson(result.contract))),parts=walkAnatomy(contract);
 const runtimeIds=new Set(parts.flatMap(({part})=>[...(part.component?[part.component.id]:[]),...(part.slot?.renderDefault?(part.slot.defaultContent??[]).map(item=>item.id):[])]));
 assert.deepEqual([...runtimeIds].sort(),children.map(c=>c.id).sort(),'omission must retain both identity-qualified source choices; sample content alone is not a runtime fallback');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const {chromium}=await import('playwright-core');
 const contracts=new Map([...children,contract].map(c=>[c.id,c])),tokens={primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const slot=parts.find(p=>p.part.slot)!.part.slot!.name;
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,contracts);
 const all=(n:any):any[]=>[n,...(n.children??[]).flatMap(all)];
 assert.equal(native.variants.length,2);
 for(const variant of native.variants){
  const selected=all(variant.spec).filter(n=>n.type==='instance');
  assert.equal(selected.length,1,'native fallback must choose exactly one branch');
  assert.equal(selected[0].depContractId,variant.name.includes('Mode=B')?'test.second':'test.first');
  assert(all(variant.spec).filter(n=>n.type==='slot').every(n=>n.slotDefault===undefined),'do not duplicate alternatives as samples');
 }
 const {emitReact}=await import('./emit-react.js');
 emitReact(ContractSchema.parse(result.contract),{contracts,icons:new Map(),tokens:new Set(),tokenValues:tokens});
 const stories=emitReact(contract,{contracts,icons:new Map(),tokens:new Set(),tokenValues:tokens}).stories;
 assert(!stories.includes('The quick brown fox'),'stories must not override a runtime fallback with placeholder text');
 const meta=stories.slice(stories.indexOf('const meta'),stories.indexOf('export default'));
 assert(!meta.includes('render:'),'default and variant stories must exercise omission rather than inject all choices');
 const browser=await chromium.launch();try{for(const emitter of [reactEmitter,reactInlineEmitter]){
  const ctx={contracts,tokens,icons:new Map<string,string>()},out=emitter.emit(contract,ctx),deps:Record<string,{tsx:string;css:string}>={};
  for(const child of children){const files=emitter.emit(child,ctx);deps[child.name]={tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents??''};}
  const page=await browser.newPage();try{const render=await mountGenerated(page,contract.name,out[0].contents,out.find(f=>f.path.endsWith('.css'))?.contents??'',deps);
   for(const [mode,color]of [['a','rgb(255, 0, 0)'],['b','rgb(0, 0, 255)'],['a','rgb(255, 0, 0)']]){
    await render({mode});
    const paints=await page.locator('#root *').evaluateAll(nodes=>nodes.filter(n=>['rgb(255, 0, 0)','rgb(0, 0, 255)'].includes(getComputedStyle(n).backgroundColor)).map(n=>getComputedStyle(n).backgroundColor));
    assert.deepEqual(paints,[color]);
    await render({mode,[slot]:'Replacement'});assert.equal(await page.locator('#root').innerText(),'Replacement');
    await render({mode,[slot]:null});assert.equal(await page.locator('#root').innerText(),'');
    assert.equal(await page.locator('#root *').evaluateAll(nodes=>nodes.filter(n=>['rgb(255, 0, 0)','rgb(0, 0, 255)'].includes(getComputedStyle(n).backgroundColor)).length),0);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
});
