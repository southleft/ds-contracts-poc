import test from 'node:test';import assert from 'node:assert/strict';
import {proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {walkAnatomy,ContractSchema} from '../scripts/contract-schema.js';

test('captured instance geometry supersedes only its redundant inferred square size',()=>{
 const child:any={setName:'Glyph',type:'COMPONENT',key:'glyph-key',nodeId:'1:1',variants:[{name:'Glyph',type:'COMPONENT',nodeId:'1:1',bbox:{width:24,height:24},sourceEmptyFill:true,children:[{name:'Ink',type:'VECTOR',nodeId:'1:2',fill:{hex:'000000'},shape:{kind:'path',paths:[{data:'M0 0L12 0L12 12L0 12Z',windingRule:'NONZERO'}],width:12,height:12,x:6,y:6,right:6,bottom:6,constraints:{horizontal:'SCALE',vertical:'SCALE'}}}]}]};
 const parent:any={setName:'Host',type:'COMPONENT_SET',key:'host-key',nodeId:'2:0',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'small',variantOptions:['small','large']}},variants:[20,28].map((size,i)=>({name:'Size='+['small','large'][i],type:'COMPONENT',nodeId:'2:'+i,variantProperties:{Size:['small','large'][i]},bbox:{width:40,height:40},sourceEmptyFill:true,children:[{name:'Glyph',type:'INSTANCE',nodeId:'3:'+i,instanceOf:'Glyph',instanceKey:'glyph-key',sourceEmptyFill:true,bbox:{width:size,height:size},abs:{x:6,y:6,right:34-size,bottom:34-size,width:size,height:size,constraints:{horizontal:'LEFT',vertical:'TOP'}},instanceGeometry:{nodeId:'3:'+i,componentId:'1:1',transform:[[1,0,6],[0,1,6]],localSize:{width:size,height:size}},instanceRootOverrides:{nodeId:'3:'+i,componentId:'1:1',componentKey:'glyph-key',fields:['width','height'],mainSize:{width:24,height:24},localSize:{width:size,height:size},localTransform:[[1,0,6],[0,1,6]]}}]}))};
 for(const stampsObservable of [true,false]){
 const batch=proposeBatchFromDump({Glyph:child,Host:parent},{fileKey:'file',stampsObservable,hiddenCaptured:true,mintUnbound:true,contractIdByName:new Map(),corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}})});
 assert.deepEqual(batch.skipped,[]);
 const result=batch.proposals.find(p=>p.setName==='Host')!,c=ContractSchema.parse(result.contract),ref=walkAnatomy(c).find(w=>w.part.component)!.part;
 if(!stampsObservable){assert(ref.component!.overrides?.size);assert.equal(ref.absoluteGeometryByCombination,undefined);continue;}
 assert(ref.absoluteGeometryByCombination,JSON.stringify({ref,notes:result.notes}));assert.equal(ref.component!.overrides?.size,undefined);
 assert.deepEqual(ref.absoluteGeometryByCombination.rows.map(r=>r.geometry.box.width).sort(),[20,28]);
 assert(result.notes.some(n=>n.includes('redundant inferred square-size override omitted')));
 }
});

test('absolute geometry absorbs matching pending root dimensions without discarding opacity',()=>{
 const child:any={setName:'Panel',type:'COMPONENT',key:'panel-key',nodeId:'10:1',variants:[{name:'Panel',type:'COMPONENT',nodeId:'10:1',bbox:{width:24,height:16},fill:{hex:'112233'}}]};
 const parent:any={setName:'Host',type:'COMPONENT_SET',key:'host-key',nodeId:'20:0',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'small',variantOptions:['small','large']}},variants:[20,28].map((width,i)=>({name:'Size='+['small','large'][i],type:'COMPONENT',nodeId:'20:'+i,variantProperties:{Size:['small','large'][i]},bbox:{width:40,height:40},sourceEmptyFill:true,children:[{name:'Panel',type:'INSTANCE',nodeId:'30:'+i,instanceOf:'Panel',instanceKey:'panel-key',opacity:0.5,bbox:{width,height:16},abs:{x:6,y:6,right:34-width,bottom:18,width,height:16,constraints:{horizontal:'LEFT',vertical:'TOP'}},instanceGeometry:{nodeId:'30:'+i,componentId:'10:1',transform:[[1,0,6],[0,1,6]],localSize:{width,height:16}},instanceRootOverrides:{nodeId:'30:'+i,componentId:'10:1',componentKey:'panel-key',fields:['width','height','opacity'],mainSize:{width:24,height:16},localSize:{width,height:16},localTransform:[[1,0,6],[0,1,6]]}}]}))};
 const batch=proposeBatchFromDump({Panel:child,Host:parent},{fileKey:'file',stampsObservable:true,hiddenCaptured:true,mintUnbound:true,contractIdByName:new Map(),corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}})});
 assert.deepEqual(batch.skipped,[]);
 const result=batch.proposals.find(p=>p.setName==='Host')!,c=ContractSchema.parse(result.contract),ref=walkAnatomy(c).find(w=>w.part.component)!.part;
 assert(ref.absoluteGeometryByCombination);
 assert.equal(ref.component!.rootOverrides?.width,undefined);
 assert.equal(ref.component!.rootOverrides?.height,undefined);
 assert(ref.component!.rootOverrides?.opacity);
 assert.deepEqual(ref.absoluteGeometryByCombination.rows.map(r=>[r.geometry.box.width,r.geometry.box.height]),[[20,16],[28,16]]);
 assert(result.notes.some(n=>n.includes('redundant inferred root dimensions omitted')));
});
