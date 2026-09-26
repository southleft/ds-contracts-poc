import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput} from './native-source-observation.js';
import {prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate, nativeContractUpdateMatches} from './native-contract-update.js';
import {nativeAppUpdateDesired} from '../source-reference/native-app-update.js';
import type {Contract} from '../scripts/contract-schema.js';

async function fixture(change:(root:Contract)=>void = root=>{root.anatomy.root.tokens={opacity:'{rootOpacity}'};}) {
  const f = await nativeComparisonFixture();
  (f.tokens as Record<string,unknown>).rootOpacity = {$type:'number',$value:0.4};
  const leaf = f.contract('fixture.update-leaf', {root:{layout:{display:'flex'}, parts:{
    label:{text:'Keep this child', tokens:{color:'{ink}'}, declared:{'font-family':'Inter'}},
  }}});
  leaf.name = 'Leaf';
  const middle = f.contract('fixture.update-middle', {root:{layout:{display:'flex'}, parts:{leaf:{component:{id:leaf.id}}}}});
  middle.name = 'Middle';
  const root = f.contract('fixture.update-main', {root:{layout:{display:'flex'}, parts:{middle:{component:{id:middle.id}}}}});
  root.props = [{name:'kind',type:{enum:['a','b']},default:'a',bindings:{code:{prop:'kind'},figma:{kind:'VARIANT',property:'Kind'}}}];
  const contracts = new Map([[root.id,root],[middle.id,middle],[leaf.id,leaf]]);
  const context = await f.context('30000000-0000-4000-8000-000000000006');
  const engine = createFigmaEngine({tokens:{primitives:f.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(f.assets)});
  const compiled = engine.compileNativeContractGraphDraft(root, contracts, f.source, context.operation.id);
  const creation = await f.run(engine.buildNativeContractGraphDraftScript(root, contracts, f.source, context, 1));
  assert.equal(creation.status, 'created-candidate', JSON.stringify(creation.problems));
  const before:NativeContractObservationInput = {operation:context.operation,planRevision:revisionOf(compiled),
    component:compiled.component,projection:compiled.projection,graphComponents:compiled.components,graphVerification:1,
    tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
  const baseline = await f.run(emitNativeContractReadbackScript(before));
  assert.equal(verifyNativeContractReadback(before,baseline).status,'supported-structure-observed');
  const next = structuredClone(root);
  change(next);
  const desiredGraph = engine.compileNativeContractGraphDraft(next,new Map([...contracts,[next.id,next]]),
    {...f.source,evidenceRevision:revisionOf('changed evidence')},context.operation.id);
  const desiredPlan = {component:desiredGraph.component,graphComponents:desiredGraph.components,tokenInput:context.tokens.input};
  const desired = nativeAppUpdateDesired({plan:desiredPlan,revision:revisionOf(desiredPlan)}).desired;
  return {...f,before,baseline,desired,desiredPlan,input:{before,baseline,desired}};
}

test('compiled graph updates retain every desired dependency and authenticate the complete plan',async()=>{
  const f=await fixture();
  assert.equal(f.desired.graphComponents?.length,3);
  assert.deepEqual(f.desired.graphComponents,f.desiredPlan.graphComponents);
  assert.notEqual(f.desired.graphComponents,f.desiredPlan.graphComponents);
  const forged=structuredClone(f.desiredPlan);
  forged.graphComponents[0].description='Substituted';
  assert.throws(()=>nativeAppUpdateDesired({plan:forged,revision:revisionOf(f.desiredPlan)}),/compiled-source-changed/);
  const mixed={...f.desiredPlan,templateGraph:{input:{component:f.desired.component,tokens:f.desired.tokenInput}}};
  assert.throws(()=>nativeAppUpdateDesired({plan:mixed as any,revision:revisionOf(mixed)}),/template-graph-source-unqualified/);
});

test('the shared shadow-stack planner keeps the graph root synchronized through its channel-specific changes',async()=>{
  const f=await fixture(root=>{root.anatomy.root.literals={'box-shadow':'0px 1px 2px 0px #000000, 0px 0px 0px 1px #ffffff'};});
  const {plan}=prepareNativeContractUpdate(f.input);
  assert.equal(plan.kind,'native-contract-shadow-update');
  assert.deepEqual(plan.after.graphComponents?.at(-1),plan.after.component);
  const applied=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(plan,applied.observation).status,'supported-structure-observed');
  assert(nativeContractUpdateMatches(plan,applied.observation,true));
  assert.equal((await f.run(emitNativeContractUpdateScript(plan))).status,'no-op');
  const rollback=await f.run(emitNativeContractUpdateScript(plan,'rollback'));
  assert.equal(rollback.status,'updated');
  assert.deepEqual(rollback.observation,f.baseline);
});

test('a composed root correction preserves the complete graph, verifies, repeats and rolls back',async()=>{
  const f=await fixture(), snapshot=revisionOf(f.input), ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
  const {plan}=prepareNativeContractUpdate(f.input);
  assert.equal(plan.kind,'native-contract-opacity-update');
  assert.equal(plan.changes.length,2);
  assert.equal(revisionOf(f.input),snapshot,'planning must not modify evidence');
  assert.deepEqual(plan.after.graphComponents?.at(-1),plan.after.component);
  assert.deepEqual(plan.after.graphComponents?.slice(0,-1),f.before.graphComponents?.slice(0,-1));
  assert.deepEqual(plan.after.creation,f.before.creation);
  assert.equal((await f.run(emitNativeContractUpdateScript(plan,'apply',true))).status,'preflight-observed');
  const applied=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(verifyNativeContractUpdate(plan,applied.observation).status,'supported-structure-observed');
  assert(nativeContractUpdateMatches(plan,applied.observation,true));
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  assert.equal((await f.run(emitNativeContractUpdateScript(plan))).status,'no-op');
  const rollback=await f.run(emitNativeContractUpdateScript(plan,'rollback'));
  assert.equal(rollback.status,'updated',JSON.stringify(rollback.problems));
  assert.deepEqual(rollback.observation,f.baseline);
});

test('a missing, reordered or changed dependency cannot disappear from an update proposal',async()=>{
  const f=await fixture();
  for(const mutate of [
    (x:typeof f.input)=>{delete x.desired.graphComponents;},
    (x:typeof f.input)=>{x.desired.graphComponents!.shift();},
    (x:typeof f.input)=>{x.desired.graphComponents!.reverse();},
    (x:typeof f.input)=>{x.desired.graphComponents![1]=structuredClone(x.desired.graphComponents![0]);},
    (x:typeof f.input)=>{x.desired.graphComponents![2]={...x.desired.graphComponents![2],description:'Different root'};},
    (x:typeof f.input)=>{delete x.before.graphVerification;},
    (x:typeof f.input)=>{x.desired.graphComponents![0].variants[0].spec.children![0].characters='Dropped edit';},
    (x:typeof f.input)=>{x.desired.graphComponents![0].variants[0].spec.opacity=0.7;},
    (x:typeof f.input)=>{x.desired.graphComponents![1].variants[0].spec.children![0].depContractId='Other child';},
    (x:typeof f.input)=>{delete x.desired.graphComponents![0].nativeContractDraft;},
    (x:typeof f.input)=>{x.desired.graphComponents![0].variants[0].spec.nativeContractPart!.contractRevision='bad';},
  ]) {
    const input=structuredClone(f.input);mutate(input);
    assert.throws(()=>prepareNativeContractUpdate(input),/native-update-(complete-graph-required|dependency-change-unqualified)/);
  }
});

test('child conflicts prevent writes and interrupted root corrections resume without allocation',async()=>{
  const f=await fixture(), {plan}=prepareNativeContractUpdate(f.input);
  const childId=f.before.creation.graphTargets[0].variants[0].id;
  const child=await f.figma.getNodeByIdAsync(childId), name=child.name;
  child.name='Concurrent child edit';
  const refused=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(refused.status,'refused');assert.deepEqual(refused.changes,[]);
  for(const c of plan.changes) assert.equal((await f.figma.getNodeByIdAsync(c.nodeId)).opacity,c.before);
  child.name=name;
  const first=plan.changes[0], firstNode=await f.figma.getNodeByIdAsync(first.nodeId);
  firstNode.opacity=first.after;
  const partial=await f.run(emitNativeContractUpdateScript(plan,'apply',true));
  assert.equal(partial.status,'preflight-observed');
  assert(nativeContractUpdateMatches(plan,partial.observation));
  const resumed=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(resumed.status,'updated');assert.deepEqual(resumed.changes,[plan.changes[1].nodeId]);
  assert.equal(verifyNativeContractUpdate(plan,resumed.observation).status,'supported-structure-observed');
  await f.run(emitNativeContractUpdateScript(plan,'rollback'));
  const second=await f.figma.getNodeByIdAsync(plan.changes[1].nodeId);let opacity=second.opacity;
  Object.defineProperty(second,'opacity',{configurable:true,get:()=>opacity,set:(v:number)=>{
    if(v===plan.changes[1].after)throw Error('Simulated assignment failure');opacity=v;
  }});
  const failed=await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(failed.status,'rolled-back',JSON.stringify(failed.problems));
  assert.deepEqual(await f.run(emitNativeContractReadbackScript(f.before)),f.baseline);
});
