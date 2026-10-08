import test from 'node:test';import assert from 'node:assert/strict';
import {mapRestToDump,type RestNodesResponse} from '../extract/figma/rest/map.js';
import {proposeBatchFromDump,asMinimalChildContract} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {reactEmitter,reactInlineEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {mintedTokenCss} from './mint-tokens.js';
import {chromium} from 'playwright-core';
import {createFigmaEngine} from './emit-figma-script.js';
import {validateContract} from './emit-react.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function capture(enabled:boolean|undefined=undefined,controlled=false,filled=false,mixed=false){
 const box={x:0,y:0,width:16,height:16},size={x:16,y:16},relativeTransform=[[1,0,0],[0,1,0]];
 const raw={name:'Fixture',nodes:{parent:{document:{id:'parent',name:'Host',type:'COMPONENT',size,absoluteBoundingBox:box,relativeTransform,
 children:[{id:'use',name:'Progress',type:'INSTANCE',componentId:'main',size,absoluteBoundingBox:box,relativeTransform,clipsContent:false,
 componentProperties:{Label:{type:'BOOLEAN',value:true}},children:[{id:'path',name:'Ink',type:'VECTOR',size,absoluteBoundingBox:box,relativeTransform,
 fills:[],strokes:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}],strokeGeometry:[{path:'M0 0L16 0L8 16Z',windingRule:'NONZERO'}]}]}]},
 components:{main:{name:'Remote',key:'main-key',remote:true}},styles:{}}}} as unknown as RestNodesResponse;
 if(filled){const root=raw.nodes.parent!.document.children![0];
  root.fills=[{type:'SOLID',color:{r:0,g:.4,b:.8,a:1}}];root.cornerRadius=3;
  const ink=root.children![0];ink.fillGeometry=[{path:'M0 0L16 0L8 16Z',windingRule:'NONZERO'}];
  ink.fills=[{type:'SOLID',color:{r:1,g:1,b:1,a:1}}];ink.strokes=[];
 }
 if(controlled){const root=raw.nodes.parent!.document;root.componentPropertyDefinitions={Shown:{type:'BOOLEAN',defaultValue:false}};
 root.children![0].componentPropertyReferences={visible:'Shown'};root.children![0].visible=false;}
 if(mixed){
  const parent=raw.nodes.parent!.document,observed=structuredClone(parent),unresolved=structuredClone(parent);
  for(const [i,variant]of [observed,unresolved].entries()){
   variant.id=`variant-${i}`;variant.name=`Type=${i?'Unresolved':'Observed'}`;variant.layoutMode='HORIZONTAL';
   variant.children![0].relativeTransform=[[1,5.551115123125783e-17,0],[-5.551115123125783e-17,1,0]];
   if(i)variant.children![0].children![0].relativeTransform=[[0,-1,16],[1,0,0]];
  }
  parent.type='COMPONENT_SET';parent.children=[observed,unresolved];
  parent.componentPropertyDefinitions={Type:{type:'VARIANT',defaultValue:'Observed',variantOptions:['Observed','Unresolved']}};
 }
 const before=JSON.stringify(raw),out=mapRestToDump(raw,{fileKey:'fixture',inspectInstanceCompositions:enabled});assert.equal(JSON.stringify(raw),before);return out.dump;
}
const project=(dump:ReturnType<typeof capture>)=>proposeBatchFromDump(dump,{corpus,contractIdByName:new Map(),mintUnbound:true});
test('ordinary mapping retains original instance identity and projects bounded caller geometry; opt-out stays unchanged',()=>{
 const off=capture(false),on=capture();const original=(on.Host as any).variants[0].children[0];
 assert.equal(original.type,'INSTANCE');assert.equal(original.instanceKey,'main-key');assert(original.instanceComposition);
 assert.equal((off.Host as any).variants[0].children[0].instanceComposition,undefined);
 const result=project(on);assert.equal(result.skipped.length,0);assert.match(JSON.stringify(result.proposals[0].contract.anatomy),/M0 0L16 0L8 16Z/);
 assert.equal(result.proposals[0].childStubs?.length??0,0);
 const c=ContractSchema.parse(result.proposals[0].contract);const persisted=JSON.stringify(c.anatomy);assert.match(persisted,/Captured caller appearance only/);assert.match(persisted,/main-key/);assert.match(persisted,/applied/);assert.match(persisted,/Label/);
});
test('a key-qualified known child takes precedence over caller observation',()=>{
 const known=ContractSchema.parse({id:'ds.known',name:'Known',version:'1.0.0',status:'draft',description:'Authoritative child',
 semantics:{element:'div'},states:[],props:[],anatomy:{root:{text:'Known content'}},
 bindings:{code:{anchors:{importPath:'./Known',export:'Known'}},figma:{anchors:{fileKey:'fixture',componentSetKey:'main-key',nodeId:'main'}}}});
 const result=proposeBatchFromDump(capture(),{corpus,mintUnbound:true,contractIdByName:new Map([['Remote','ds.known']]),
 contractIdByKey:new Map([['main-key','ds.known']]),contractsById:new Map([['ds.known',asMinimalChildContract(known)]])});
 assert.equal(result.skipped.length,0);assert.match(JSON.stringify(result.proposals[0].contract.anatomy),/ds.known/);
 assert.doesNotMatch(JSON.stringify(result.proposals[0].contract.anatomy),/M0 0L16 0L8 16Z/);
 assert(!result.proposals[0].notes.some(n=>n.includes('observed caller composition')));
});
test('initially hidden observed geometry follows the caller Boolean repeatedly on both React surfaces',async t=>{
 const proposal=project(capture(true,true)).proposals[0],c=ContractSchema.parse(proposal.contract);
 const prop=c.props.find(p=>p.bindings.figma.property==='Shown');assert(prop);assert.equal(prop.default,false);
 const tokens={primitives:proposal.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
 const files=emitter.emit(c,{contracts:new Map([[c.id,c]]),tokens,icons:new Map()}),page=await browser.newPage();
 try{const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
 await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
 for(const shown of [false,true,false,true]){await render({[prop.bindings.code.prop]:shown});assert.equal(await page.locator('#root svg path').count(),shown?1:0);}
 }finally{await page.close();}
 }
});
test('tampered occurrence identity and applied values cannot authorize caller projection',()=>{
 for(const change of [(c:any)=>c.source.key='foreign',(c:any)=>c.applied.Label=false]){
 const dump=capture();change((dump.Host as any).variants[0].children[0].instanceComposition);const result=project(dump);
 assert(result.proposals[0].notes.some(n=>n.includes('observed-caller-composition-refused')));
 assert.doesNotMatch(JSON.stringify(result.proposals[0].contract.anatomy),/M0 0L16 0L8 16Z/);
 }
});

test('filled caller geometry retains painted frame and live visibility through ordinary proposal',async t=>{
 const dump=capture(true,true,true),original=(dump.Host as any).variants[0].children[0];
 assert(original.instanceComposition);assert.equal(original.instanceKey,'main-key');
 const proposal=project(dump).proposals[0],c=ContractSchema.parse(proposal.contract);
 assert.equal(proposal.childStubs?.length??0,0);assert.match(JSON.stringify(c.anatomy),/M0 0L16 0L8 16Z/);
 const prop=c.props.find(p=>p.bindings.figma.property==='Shown')!;
 const tokens={primitives:proposal.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{contracts:new Map([[c.id,c]]),tokens,icons:new Map()}),page=await browser.newPage();
  try{const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const shown of [false,true,false,true]){await render({[prop.bindings.code.prop]:shown});assert.equal(await page.locator('#root svg path').count(),shown?1:0);}
   const paints=await page.locator('#root *').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
   assert(paints.includes('rgb(0, 102, 204)'),JSON.stringify(paints));
  }finally{await page.close();}
 }
});


test('supported captured occurrence survives an unresolved sibling plane without changing its source matrix',async t=>{
 const proposal=project(capture(true,false,true,true)).proposals[0],c=ContractSchema.parse(proposal.contract);
 const owner=c.anatomy.root.parts!.Progress,observed=owner.parts!.capturedAppearance;
 assert.equal(observed.instanceAffine!.transform[0][1],5.551115123125783e-17);
 assert.equal(observed.instanceAffine!.transform[1][0],-5.551115123125783e-17);
 assert.deepEqual(observed.visibleWhen,{prop:'type',equals:'observed'});
 assert.deepEqual(owner.parts!.unresolvedAppearance.visibleWhen,{prop:'type',equals:'unresolved'});
 assert(owner.parts!.unresolvedAppearance.component);
 const tokens={primitives:proposal.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const children=(proposal.childStubs??[]).map(s=>ContractSchema.parse(s));
 const contracts=new Map([c,...children].map(x=>[x.id,x]));
 const validation:string[]=[];validateContract(c,contracts,validation,new Map());assert.deepEqual(validation,[]);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);
 assert.equal(native.variants.length,2);
 const allocations=(n:any):number=>Number(!!n.instanceAffineAllocation)+(n.children??[]).reduce((sum:number,c:any)=>sum+allocations(c),0);
 assert.deepEqual(native.variants.map(v=>allocations(v.spec)).sort(),[0,1]);

 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,{contracts,tokens,icons:new Map()});
  const page=await browser.newPage();
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   const dependencies=Object.fromEntries(children.map(child=>{
    const files=emitter.emit({...child,anatomy:{root:{text:'Unresolved marker'}}},{contracts,tokens,icons:new Map()});
    return [child.name,{tsx:files[0].contents,css:files.find(f=>f.path.endsWith('.css'))?.contents}];
   }));
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents,dependencies);
   await page.addStyleTag({content:mintedTokenCss(tokens.primitives)});
   for(const value of ['observed','unresolved','observed']){
    await render({[c.props.find(p=>p.name==='type')!.bindings.code.prop]:value});
    assert.equal(await page.locator('#root svg path').count(),value==='observed'?1:0,JSON.stringify({value,props:c.props,errors,html:await page.locator('#root').innerHTML()}));
    assert.deepEqual(errors,[]);
    assert.equal(await page.getByText('Unresolved marker',{exact:true}).count(),value==='unresolved'?1:0);
   }
  }finally{await page.close();}
 }
});
