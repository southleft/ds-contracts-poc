import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeComparisonFixture} from './native-contract-comparison-test-fixture.js';
import {emitNativeContractReadbackScript} from './native-source-observation.js';
import {revisionOf} from './contract-provenance.js';
import {prepareNativeContractUpdate as prepareAbsoluteShape,emitNativeContractUpdateScript as emitAbsoluteShape,nativeContractUpdateMatches, nativeContractUpdateUntouched, verifyNativeContractUpdate} from './native-contract-update.js';
import type {NativeAbsoluteShapeUpdatePlan} from './native-contract-absolute-shape-update.js';
const absoluteShapeMatches=(plan:NativeAbsoluteShapeUpdatePlan,receipt:unknown,complete=false,untouched=false)=>untouched?nativeContractUpdateUntouched(plan,receipt):nativeContractUpdateMatches(plan,receipt,complete);
const readShape=emitNativeContractReadbackScript;

async function fixture(kind:'rect'|'ellipse'='rect') {
 const f=await nativeComparisonFixture();
 const contract=f.contract('fixture.absolute-update',{root:{layout:{display:'flex'},declared:{position:'relative'},
  literals:{width:'64px',height:'48px','border-width':'1px','border-color':'transparent'},parts:{
   mark:{shape:{kind,width:54,height:32.3906},declared:{position:'absolute'},literals:{left:'-13px',top:'-9px','background-color':'transparent'}},
  }}});
 const byId=new Map([[contract.id,contract]]),compiled=f.engine.compileNativeContractDraft(contract,byId,f.source);
 const context=await f.context('40000000-0000-4000-8000-000000000049');
 const creation=await f.run(f.engine.buildNativeContractDraftScript(contract,byId,f.source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const before={operation:context.operation,planRevision:revisionOf(contract),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 // The shared mock defaults all scene nodes to HUG; real absolute leaves are FIXED.
 const leaf=await f.figma.getNodeByIdAsync(creation.variants[0].id);
 leaf.children[0].layoutSizingHorizontal='FIXED'; leaf.children[0].layoutSizingVertical='FIXED';
 Object.defineProperty(leaf.children[0],'relativeTransform',{get(){return [[1,0,this.x],[0,1,this.y]];}});
 const baseline=await f.run(emitNativeContractReadbackScript(before)),desired=structuredClone(before.component);
 desired.variants[0].spec.children![0].shape!.height=32.390625;
 desired.variants[0].spec.children![0].absolute!.left=-11;
 desired.variants[0].spec.children![0].absolute!.top=-7;
 const input={before,baseline,desired:{component:desired,revision:revisionOf(desired),tokenInput:before.tokenInput}};
 let prepared; try { prepared=prepareAbsoluteShape(input)!; } catch(e) { console.log(JSON.stringify(baseline.nodes.filter((n:any)=>['RECTANGLE','ELLIPSE'].includes(n.type)),null,2)); throw e; } const plan=prepared.plan; if(plan.kind!=='native-contract-absolute-shape-update')throw Error('wrong plan');
 const node=await f.figma.getNodeByIdAsync(plan.transitions[0].nodeId);
 return {...f,input,plan,node};
}
test('absolute shape update preserves all identity and nongeometry facts for fixed absolute rectangle and ellipse; repeat and rollback',async()=>{
 for(const kind of ['rect','ellipse'] as const){
  const f=await fixture(kind),ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
  const pre=await f.run(emitAbsoluteShape(f.plan,'apply',true));assert.equal(pre.status,'preflight-observed',JSON.stringify(pre));
  assert(absoluteShapeMatches(f.plan,pre.observation,false,true));
  const applied=await f.run(emitAbsoluteShape(f.plan));assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
  assert.equal(f.node.x,-11);assert.equal(f.node.y,-7);assert.equal(f.node.height,32.390625);
  assert(absoluteShapeMatches(f.plan,applied.observation,true));
  assert(absoluteShapeMatches(f.plan,await f.run(readShape(f.plan.after)),true));
  const missing=await f.run(readShape(f.plan.after)); delete missing.nodes.find((n:any)=>n.id===f.node.id).values.constraints;
  assert(!absoluteShapeMatches(f.plan,missing,true),'required constraint evidence cannot be omitted');
  assert.equal(verifyNativeContractUpdate(f.plan,missing).status,'refused');
  assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
  const repeat=await f.run(emitAbsoluteShape(f.plan));assert.equal(repeat.status,'no-op',JSON.stringify(repeat.problems));
  const rollback=await f.run(emitAbsoluteShape(f.plan,'rollback'));assert.equal(rollback.status,'updated',JSON.stringify(rollback.problems));
  assert(absoluteShapeMatches(f.plan,rollback.observation,false,true));
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
 }
});
test('absolute shape update refuses unrelated edits and constraint drift, and restores throwing resize without replacing unrelated edits',async()=>{
 const f=await fixture();f.node.constraints={horizontal:'CENTER',vertical:'MIN'};
 const refused=await f.run(emitAbsoluteShape(f.plan));assert.equal(refused.status,'refused');assert.deepEqual(refused.changes,[]);
 f.node.constraints={horizontal:'MIN',vertical:'MIN'};
 const resize=f.node.resizeWithoutConstraints.bind(f.node),height=f.node.height;
 f.node.resizeWithoutConstraints=(w:number,h:number)=>{resize(w,h);if(h===32.390625){f.node.name='independent edit';throw Error('test partial resize');}};
 const failed=await f.run(emitAbsoluteShape(f.plan));assert.equal(failed.status,'rolled-back',JSON.stringify(failed.problems));
 assert.equal(f.node.height,height);assert.equal(f.node.x,-12);assert.equal(f.node.y,-8);assert.equal(f.node.name,'independent edit');
 const altered=structuredClone(f.input);altered.desired.component.variants[0].spec.opacity=.5;
 assert.throws(()=>prepareAbsoluteShape(altered),/mixed-channels/);
});

test('absolute shape recovery preserves a third geometry value and requires explicit recovery',async()=>{
 const f=await fixture(),resize=f.node.resizeWithoutConstraints.bind(f.node);
 f.node.resizeWithoutConstraints=(w:number,h:number)=>{resize(w,h);if(h===32.390625){f.node.x=17;throw Error('independent geometry edit');}};
 const result=await f.run(emitAbsoluteShape(f.plan));
 assert.equal(result.status,'recovery-required');assert.deepEqual(result.unrestored,[f.node.id]);
 assert.equal(f.node.x,17);assert(!nativeContractUpdateUntouched(f.plan,await f.run(readShape(f.plan.after))));
});

test('absolute shape planning refuses bindings, size limits, rotation, nonleaf topology and mixed changes',async()=>{
 const f=await fixture();
 for(const edit of [
  (x:any)=>{x.desired.component.variants[0].spec.children[0].shape.rotation=2;},
  (x:any)=>{x.desired.component.variants[0].spec.children[0].absolute.h='CENTER';},
  (x:any)=>{x.desired.component.variants[0].spec.children[0].bindings={width:'size'};},
  (x:any)=>{x.desired.component.variants[0].spec.children[0].children=[{type:'frame',name:'extra'}];},
  (x:any)=>{x.baseline.nodes.find((n:any)=>n.id===f.node.id).values.minWidth=1;},
  (x:any)=>{x.baseline.nodes.find((n:any)=>n.id===f.node.id).values.relativeTransform=[[1,1,-12],[0,1,-8]];},
 ]){const input=structuredClone(f.input);edit(input);assert.throws(()=>prepareAbsoluteShape(input));}
 const missing=structuredClone(f.plan.after);missing.absoluteShapeReadback!.nodeIds.push('unowned');
 assert.throws(()=>readShape(missing),/readback-input-invalid/);
});


test('exact leaf resize avoids the native resize deadband and refuses aspect locks',async()=>{
 for(const kind of ['rect','ellipse'] as const){
  const f=await fixture(kind),resize=f.node.resize.bind(f.node);let ordinary=0;
  f.node.resizeWithoutConstraints=resize;
  f.node.resize=(w:number,h:number)=>{ordinary++;if(Math.abs(h-f.node.height)>.001)resize(w,h);};
  // A historical plan still uses its pinned resize semantics and rolls back.
  const legacy=structuredClone(f.plan);delete legacy.resizeProtocol;legacy.after.absoluteShapeReadback!.version=1;
  const old=await f.run(emitAbsoluteShape(legacy));assert.equal(old.status,'rolled-back');
  ordinary=0;
  const result=await f.run(emitAbsoluteShape(f.plan));assert.equal(result.status,'updated',JSON.stringify(result.problems));
  assert.equal(ordinary,0);assert.equal(f.node.height,32.390625);
  assert.equal((await f.run(emitAbsoluteShape(f.plan,'rollback'))).status,'updated');
  f.node.targetAspectRatio={x:54,y:32};
  const locked=await f.run(emitAbsoluteShape(f.plan));assert.equal(locked.status,'refused');assert.deepEqual(locked.changes,[]);
 }
});
