import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {applyNativeObservedLayout,checkNativeObservedLayout,type NativeObservedLayoutContext} from './native-observed-layout.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeContractObservationInput} from './native-source-observation.js';
import {validNativeGraphCreation} from './native-graph-creation.js';

const context:NativeObservedLayoutContext={version:1,contractId:'fixture.observed-main',treeSha256:'a'.repeat(64),host:{width:200,height:4},
  parts:[{path:[0],width:{kind:'percent',value:100},height:{kind:'percent',value:100}},{path:[0,0],width:{kind:'percent',value:10},height:{kind:'percent',value:100}}]};

test('observed context refuses malformed, duplicate, zero and unsupported percentage claims',()=>{
  checkNativeObservedLayout(context,context.contractId);
  for(const change of [null,{...context,contractId:'another'}, {...context,host:{width:0,height:4}},
    {...context,parts:[context.parts[0],context.parts[0]]},{...context,parts:[{path:[0],width:{kind:'percent',value:0}}]},
    {...context,parts:[{path:[0],height:{kind:'percent',value:50}}]},
    {...context,parts:[{path:[0.5],width:{kind:'percent',value:10}}]}, {...context,extra:true}])
    assert.throws(()=>checkNativeObservedLayout(change,context.contractId),/unqualified/);
});

async function fixture(observed=true, selected=context){
  const f=await nativeComparisonFixture();
  const parent=f.contract(context.contractId,{root:{layout:{display:'flex',direction:'row'},literals:{height:'4px'},parts:{
    track:{layout:{display:'flex',direction:'column',grow:true},parts:{inner:{layout:{display:'flex',direction:'row'}}}},
  }}});
  const contracts=new Map([[parent.id,parent]]),native=await f.context('50000000-0000-4000-8000-000000000001');
  const compiled=f.engine.compileNativeContractGraphDraft(parent,contracts,f.source,native.operation.id,observed?selected:undefined);
  const script=f.engine.buildNativeContractGraphDraftScript(parent,contracts,f.source,{...native,...(observed?{observedLayout:selected}:{})},1);
  const creation=await f.run(script);assert.equal(creation.status,'created-candidate',JSON.stringify(creation.problems));
  const input:NativeContractObservationInput={operation:native.operation,planRevision:revisionOf('observed-layout'),component:compiled.component,
    projection:compiled.projection,graphComponents:compiled.components,graphVerification:1,tokenInput:native.tokens.input,
    tokenIdentity:native.tokens.identity,creation,...(observed?{observedLayout:selected}:{})};
  const readback=emitNativeContractReadbackScript(input),receipt=await f.run(readback);
  assert.equal(receipt.status,'native-readback-collected',JSON.stringify(receipt.problems));
  return {f,parent,contracts,native,compiled,script,creation,input,receipt,readback};
}

test('normal graph owns a neutral host, preserves its component identity and resolves descendant percentages after placement',async()=>{
  const {f,compiled,creation,input,receipt}=await fixture();
  assert.equal(validNativeGraphCreation(compiled.components,creation,1,context),true);
  assert.equal(validNativeGraphCreation(compiled.components,creation,1),false,'host mapping cannot be accepted by an old context');
  assert.equal(creation.target.id,creation.variants[0].id);
  assert.equal(creation.target.type,'COMPONENT');
  const target=await f.figma.getNodeByIdAsync(creation.target.id),host=await f.figma.getNodeByIdAsync(creation.observedLayout.hostId);
  assert.equal(target.parent.id,host.id);assert.equal(host.parent.id,creation.pageId);
  assert.equal(target.width,200);assert.equal(target.height,4);assert.equal(target.children[0].height,4);
  assert.equal(target.children[0].children[0].width,20);assert.equal(target.children[0].children[0].height,4);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  for(const mutate of [
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).values.width=199;},
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).values.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}];},
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).values.clipsContent=true;},
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).values.boundVariables={width:{type:'VARIABLE_ALIAS',id:'foreign'}};},
    (r:any)=>{r.nodes.find((n:any)=>n.id===target.id).values.layoutSizingHorizontal='FIXED';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===target.children[0].children[0].id).values.width=21;},
    (r:any)=>{r.nodes.find((n:any)=>n.id===target.children[0].id).values.layoutSizingVertical='HUG';},
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).childIds=[];},
    (r:any)=>{r.nodes.find((n:any)=>n.id===host.id).metadata.nativeObservedLayoutHost='foreign';},
  ]){const changed=structuredClone(receipt);mutate(changed);assert.equal(verifyNativeContractReadback(input,changed).status,'refused');}
  assert.throws(()=>emitNativeContractReadbackScript({...input,observedLayout:{...context,host:{width:201,height:4}}}),/creation-invalid/);
});

test('percentage evaluation retains fractional native sizes and refuses an integer approximation',async()=>{
  const selected=structuredClone(context);selected.host.width=205.75;selected.parts[1].width!.value=12.5;
  const {input,receipt,creation}=await fixture(true,selected);
  const target=receipt.nodes.find((n:any)=>n.id===creation.target.id),track=receipt.nodes.find((n:any)=>n.id===target.childIds[0]);
  const inner=receipt.nodes.find((n:any)=>n.id===track.childIds[0]);assert.equal(inner.values.width,25.71875);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
  const rounded=structuredClone(receipt);rounded.nodes.find((n:any)=>n.id===inner.id).values.width=26;
  assert.equal(verifyNativeContractReadback(input,rounded).status,'refused');
});

test('observed parent host preserves separate dependency targets and complete page census',async()=>{
  const f=await nativeComparisonFixture(),layout={...context,parts:[]};
  const leaf=f.contract('fixture.leaf',{root:{layout:{display:'flex'},literals:{width:'12px',height:'4px'}}});
  const parent=f.contract(context.contractId,{root:{layout:{display:'flex'},literals:{height:'4px'},parts:{leaf:{component:{id:leaf.id}}}}});
  const byId=new Map([[parent.id,parent],[leaf.id,leaf]]),native=await f.context('50000000-0000-4000-8000-000000000004');
  const compiled=f.engine.compileNativeContractGraphDraft(parent,byId,f.source,native.operation.id,layout);
  const creation=await f.run(f.engine.buildNativeContractGraphDraftScript(parent,byId,f.source,{...native,observedLayout:layout},1));
  assert.equal(creation.status,'created-candidate');assert.equal(creation.graphTargets.length,2);
  const input:NativeContractObservationInput={operation:native.operation,planRevision:revisionOf('hosted-dependency'),
    component:compiled.component,projection:compiled.projection,graphComponents:compiled.components,graphVerification:1,
    tokenInput:native.tokens.input,tokenIdentity:native.tokens.identity,creation,observedLayout:layout};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  const dependency=receipt.nodes.find((n:any)=>n.id===creation.graphTargets[0].id);
  assert.equal(dependency.parentId,creation.pageId);
  assert.equal(receipt.nodes.find((n:any)=>n.id===creation.target.id).parentId,creation.observedLayout.hostId);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  const missing=structuredClone(receipt);missing.nodes=missing.nodes.filter((n:any)=>n.id!==dependency.id);
  assert.equal(verifyNativeContractReadback(input,missing).status,'refused');
});

test('absent observed context keeps ordinary graph topology and adds no host program or readback fields',async()=>{
  const f=await fixture(false);
  assert.equal(f.creation.observedLayout,undefined);
  assert.equal((await f.f.figma.getNodeByIdAsync(f.creation.target.id)).parent.id,f.creation.pageId);
  assert(!f.script.includes('nativeObservedLayoutHost'));assert(!f.readback.includes('nativeObservedLayoutHost'));
  assert.equal(verifyNativeContractReadback(f.input,f.receipt).status,'supported-structure-observed');
  assert.throws(()=>applyNativeObservedLayout({...f.compiled.component,isSet:true},context),/unqualified/);
  assert.throws(()=>f.f.engine.buildNativeContractDraftScript(f.parent,f.contracts,f.f.source,{...f.native,observedLayout:context}),/observed-layout-context-unqualified/);
});
