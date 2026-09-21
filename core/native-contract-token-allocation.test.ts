import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeUpdateFixture} from './native-contract-update-test-fixture.js';
import {prepareNativeContractUpdate,emitNativeContractUpdateScript,verifyNativeContractUpdate,nativeContractUpdateMatches,
  nativeContractUpdateUntouched,nativeContractUpdateAfter} from './native-contract-update.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback} from './native-source-observation.js';

async function fixture(){
 const f=await nativeUpdateFixture();
 f.input.desired=f.desiredFor({...f.tokens,added:{$type:'number',$value:0.6}});
 return {...f,plan:prepareNativeContractUpdate(f.input).plan};
}
test('allocation update preserves every component fact, uses independent inventory, and resumes ordinary correction',async()=>{
 const f=await fixture(),ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
 assert.equal(f.plan.kind,'native-contract-token-allocation-update');
 assert.ok(nativeContractUpdateUntouched(f.plan,f.input.baseline));
 const preflight=await f.run(emitNativeContractUpdateScript(f.plan,'apply',true));
 assert.equal(preflight.status,'preflight-observed',JSON.stringify(preflight.problems));
 assert.deepEqual(preflight.observation,f.input.baseline);
 assert.ok(nativeContractUpdateMatches(f.plan,preflight.observation));
 const applied=await f.run(emitNativeContractUpdateScript(f.plan));
 assert.equal(applied.status,'updated',JSON.stringify(applied.problems));assert.equal(applied.tokenAllocations.length,1);
 assert.deepEqual(applied.observation.nodes,f.input.baseline.nodes);assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
 assert.ok(nativeContractUpdateMatches(f.plan,applied.observation,true));
 assert.equal(verifyNativeContractUpdate(f.plan,applied.observation).status,'supported-structure-observed');
 const independent=await f.run(emitNativeContractReadbackScript(f.plan.after));
 const after=nativeContractUpdateAfter(f.plan,independent);
 assert.equal(verifyNativeContractReadback(after,independent).status,'supported-structure-observed');
 assert.equal(after.tokenIdentity.variables.length,f.input.before.tokenIdentity.variables.length+1);
 assert.equal(after.tokenExtensionReadback,undefined);
 assert.equal((await f.run(emitNativeContractUpdateScript(f.plan))).status,'no-op');
 assert.equal(nativeContractUpdateUntouched(f.plan,independent),false);
 const next=prepareNativeContractUpdate({...f.input,before:after,baseline:independent}).plan;
 assert.equal(next.kind,'native-contract-opacity-update');assert.equal(next.changes.length,0);
 assert.deepEqual(await f.run(emitNativeContractReadbackScript(after)),independent);
});

test('component conflicts refuse allocation, including edits during the last token read',async()=>{
 for(const during of [false,true]){
  const f=await fixture();
  if(during){
   const get=f.figma.variables.getVariableCollectionByIdAsync.bind(f.figma.variables);let reads=0;
   f.figma.variables.getVariableCollectionByIdAsync=async(id:string)=>{const c=await get(id);reads++;if(reads===2)f.nodes[0].opacity=0.2;return c;};
  }else f.nodes[0].opacity=0.2;
  const out=await f.run(emitNativeContractUpdateScript(f.plan));assert.equal(out.status,'refused',JSON.stringify(out));
  const c=await f.figma.variables.getVariableCollectionByIdAsync(f.input.before.tokenIdentity.collection.id);
  assert.equal(c.getSharedPluginData('ds_contracts','nativeTokenExtensions'),'');
  assert.equal(c.variableIds.length,f.input.before.tokenIdentity.variables.length);
 }
});
