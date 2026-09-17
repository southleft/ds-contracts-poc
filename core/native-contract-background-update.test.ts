import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeBackgroundUpdateFixture as fixture} from './native-contract-background-update-test-fixture.js';
import {revisionOf} from './contract-provenance.js';
import {emitNativeContractReadbackScript} from './native-source-observation.js';
import {prepareNativeContractUpdate,emitNativeContractUpdateScript,nativeContractUpdateMatches,nativeContractUpdateAfter,verifyNativeContractUpdate} from './native-contract-update.js';


test('paint migration retains old nodes, independently resolves new allocation and repeats with no allocation',async()=>{
 const f=await fixture(),oldIds=f.input.baseline.nodes!.map(n=>n.id),slot=f.root.children[0];
 const pre=await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
 assert.equal(pre.status,'preflight-observed',JSON.stringify(pre.problems));assert.ok(nativeContractUpdateMatches(f.plan,pre.observation));
 const applied=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(applied.status,'updated',JSON.stringify(applied.problems));
 const read=await f.run(emitNativeContractReadbackScript(f.plan.after));
 assert.ok(nativeContractUpdateMatches(f.plan,read,true),JSON.stringify(verifyNativeContractUpdate(f.plan,read)));
 assert.equal(verifyNativeContractUpdate(f.plan,read).status,'supported-structure-observed');
 const resolved=nativeContractUpdateAfter(f.plan,read);
 assert.equal(resolved.creation.nodes.length,oldIds.length+1);
 assert.equal(f.root.children[1].id,slot.id);assert.equal(f.root.children[0].width,114);assert.equal(f.root.children[0].height,34);
 assert.deepEqual(oldIds.filter(id=>!read.nodes.some((n:any)=>n.id===id)),[]);
 const repeat=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(repeat.status,'no-op',JSON.stringify(repeat.problems));assert.deepEqual(repeat.allocations,[]);
 assert.equal(f.root.children.length,2);
 for(const mutate of [
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.width=116;},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').metadata.nativeBackgroundMigration='foreign';},
  (r:any)=>{r.nodes.find((n:any)=>n.type==='RECTANGLE').values.relativeTransform=[[0,-1,1],[1,0,1]];},
  (r:any)=>{r.nodes.find((n:any)=>n.id===slot.id).metadata.nativeContractPart='{}';},
  (r:any)=>{r.nodes.find((n:any)=>n.id===f.root.id).values.paddingLeft=9;},
  (r:any)=>{r.nodes.push(structuredClone(r.nodes.find((n:any)=>n.type==='RECTANGLE')));},
 ]){const bad=structuredClone(read);mutate(bad);assert.equal(nativeContractUpdateMatches(f.plan,bad,true),false);}
});

test('migration refuses unrelated compiler edits and live conflicts without allocating',async()=>{
 const f=await fixture(),bad=structuredClone(f.input);
 bad.desired.component.variants[0].spec.opacity=0.5;
 assert.throws(()=>prepareNativeContractUpdate(bad),/mixed-channels/);
 const forged=structuredClone(f.input);forged.desired.component.variants[0].spec.children![0].backgroundPaint!.inset=5;
 assert.throws(()=>prepareNativeContractUpdate(forged),/paint-not-derived/);
 f.root.opacity=0.5;
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'refused');assert.equal(f.root.children.length,1);assert.deepEqual(result.allocations,[]);
});

test('a failure after allocation rolls back its layer and restores original metadata and paint',async()=>{
 const f=await fixture(),slot=f.root.children[0],before=slot.getSharedPluginData('ds_contracts','nativeContractPart');
 const original=slot.setSharedPluginData.bind(slot);let fail=true;
 slot.setSharedPluginData=(ns:string,key:string,value:string)=>{if(fail&&key==='nativeContractPart'){fail=false;throw Error('injected metadata failure');}return original(ns,key,value);};
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'rolled-back',JSON.stringify(result.problems));assert.deepEqual(result.unrestored,[]);
 assert.equal(f.root.children.length,1);assert.equal(slot.getSharedPluginData('ds_contracts','nativeContractPart'),before);
 const receipt=await f.run(emitNativeContractReadbackScript(f.input.before));
 assert.ok(nativeContractUpdateMatches(f.plan,receipt));
});


test('nested paint migrations map shifted descendant paths without replacing nested frames',async()=>{
 const f=await fixture(true),beforeIds=f.input.before.creation.nodes.map((n:any)=>n.id);
 assert.equal(f.plan.changes.length,2);
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'updated',JSON.stringify(result.problems));
 const receipt=await f.run(emitNativeContractReadbackScript(f.plan.after));
 assert.ok(nativeContractUpdateMatches(f.plan,receipt,true));
 assert.equal(nativeContractUpdateAfter(f.plan,receipt).creation.nodes.length,beforeIds.length+2);
 assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status,'no-op');
});

test('an edit during post-write observation preserves the edited layer for recovery',async()=>{
 const f=await fixture(),read=f.figma.variables.getVariableCollectionByIdAsync.bind(f.figma.variables);
 let edited=false;
 f.figma.variables.getVariableCollectionByIdAsync=async(id:string)=>{
  if(!edited&&f.root.children.length===2){edited=true;f.root.children[0].name='Designer edit';}
  return read(id);
 };
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'recovery-required',JSON.stringify(result));
 assert.ok(edited);assert.equal(f.root.children[0].name,'Designer edit');
 assert.ok(result.unrestored.includes(f.root.children[0].id));
});


test('an existing first rectangle is preserved when its old path becomes the paint path',async()=>{
 const f=await fixture('shape'),original=f.root.children[0].id;
 const result=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(result.status,'updated',JSON.stringify(result.problems));
 assert.equal(f.root.children[1].id,original);
 assert.ok(nativeContractUpdateMatches(f.plan,await f.run(emitNativeContractReadbackScript(f.plan.after)),true));
});
