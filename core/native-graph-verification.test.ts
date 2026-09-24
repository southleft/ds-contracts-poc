import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput} from './native-source-observation.js';
import {validNativeGraphCreation} from './native-graph-creation.js';

async function fixture(graphVerification?:1) {
  const f=await nativeComparisonFixture();
  const leaf=f.contract('fixture.graph-leaf',{root:{layout:{display:'flex'},parts:{
    label:{content:{prop:'label'},tokens:{color:'{ink}'},declared:{'font-family':'Inter'}},
  }}});
  leaf.name='Leaf';
  leaf.props=[{name:'label',type:'text',default:'Dependency label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},
    {name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}];
  const middle=f.contract('fixture.graph-middle',{root:{layout:{display:'flex',direction:'column'},parts:{leaf:{component:{id:leaf.id}}}}});
  middle.name='Middle';
  const parent=f.contract('fixture.graph-main',{root:{layout:{display:'flex'},parts:{first:{component:{id:middle.id}},second:{component:{id:leaf.id}}}}});
  const contracts=new Map([[parent.id,parent],[middle.id,middle],[leaf.id,leaf]]);
  const engine=createFigmaEngine({tokens:{primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(f.assets)});
  const context=await f.context('30000000-0000-4000-8000-000000000001');
  const compiled=engine.compileNativeContractGraphDraft(parent,contracts,f.source,context.operation.id);
  const script=engine.buildNativeContractGraphDraftScript(parent,contracts,f.source,context,graphVerification);
  const creation=await f.run(script);
  assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
  const input:NativeContractObservationInput={operation:context.operation,planRevision:revisionOf({name:'graph-verification',graphVerification:graphVerification??null}),
    projection:compiled.projection,component:compiled.component,graphComponents:compiled.components,
    tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation,
    ...(graphVerification?{graphVerification}:{})};
  const receipt=await f.run(emitNativeContractReadbackScript(input));
  assert.equal(receipt.status,'native-readback-collected',JSON.stringify(receipt.problems));
  return {f,input,receipt,creation,script,compiled};
}

test('versioned graph creation retains every dependency identity and independently checks its semantics',async()=>{
  const {input,receipt,creation,compiled,f,script}=await fixture(1);
  assert.ok(validNativeGraphCreation(compiled.components,creation));
  assert.equal(creation.graphTargets.length,3);
  assert.equal(creation.graphTargets[0].variants.length,2);
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed',JSON.stringify(verifyNativeContractReadback(input,receipt)));
  const target=creation.graphTargets[0], text=receipt.nodes.find((n:any)=>n.parentId===target.variants[0].id&&n.type==='TEXT');
  assert.ok(text);assert.equal(text.metadata.fontWeightVar,'','dependency-only text metadata is independently collected');
  for(const [name,mutate] of [
    ['text',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.characters='Corrupted';}],
    ['binding',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.boundVariables={fontSize:{type:'VARIABLE_ALIAS',id:'foreign:1'}};}],
    ['property references',(r:any)=>{r.nodes.find((n:any)=>n.id===text.id).values.componentPropertyReferences={};}],
    ['extra property',(r:any)=>{r.nodes.find((n:any)=>n.id===target.id).definitions['Extra#bad']={type:'TEXT',defaultValue:'bad'};}],
    ['variant order',(r:any)=>{r.nodes.find((n:any)=>n.id===target.id).childIds.reverse();}],
    ['variant values',(r:any)=>{r.nodes.find((n:any)=>n.id===target.variants[1].id).variantProperties.Size='Wrong';}],
    ['missing descendant',(r:any)=>{r.nodes=r.nodes.filter((n:any)=>n.id!==text.id);}],
  ] as const){const changed=structuredClone(receipt);mutate(changed);assert.notDeepEqual(changed,receipt,name);assert.equal(verifyNativeContractReadback(input,changed).status,'refused',name);}
  for(const mutate of [
    (c:any)=>{delete c.graphTargets[0].variants;},
    (c:any)=>{c.graphTargets[0].variants.reverse();},
    (c:any)=>{c.graphTargets[0].variants[0].id=c.graphTargets[1].variants[0].id;},
    (c:any)=>{c.graphTargets[0].propertyDefinitions=null;},
    (c:any)=>{delete c.graphVerification;},
    (c:any)=>{c.graphVerification=2;},
  ]){const changed=structuredClone(creation);mutate(changed);assert.equal(validNativeGraphCreation(compiled.components,changed),false);assert.throws(()=>emitNativeContractReadbackScript({...input,creation:changed}),/creation-invalid/);}
  assert.throws(()=>emitNativeContractReadbackScript({...input,graphVerification:undefined}),/creation-invalid/,'a new acknowledgement cannot be downgraded');
  const repeated=await f.run(script);
  assert.equal(repeated.allocationAttempted,false,'a raw replay must refuse before allocating duplicates');
  assert.equal(repeated.status,'refused');
});

test('legacy graph receipts remain readable and are not silently upgraded',async()=>{
  const {input,receipt,creation}=await fixture();
  assert.equal(creation.graphVerification,undefined);
  assert.ok(creation.graphTargets.every((row:any)=>Object.keys(row).sort().join(',')==='contractId,id,key'));
  assert.equal(verifyNativeContractReadback(input,receipt).status,'supported-structure-observed');
  assert.throws(()=>emitNativeContractReadbackScript({...input,graphVerification:1}),/creation-invalid/);
});
