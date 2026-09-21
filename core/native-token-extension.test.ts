import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
import {revisionOf} from './contract-provenance.js';
import {prepareNativeTokenContext,nativeTokenAllocationBase,restoreNativeTokenAllocationInput,type NativeTokenContextInput} from './native-token-context.js';
import {emitNativeTokenContextScript,emitNativeTokenContextReadbackScript} from './token-set.js';
import {prepareNativeTokenExtension,emitNativeTokenExtensionScript,emitNativeTokenExtensionReadbackScript,verifyNativeTokenExtension} from './native-token-extension.js';

const copy=<T>(v:T):T=>structuredClone(v);
function input():NativeTokenContextInput {
 const tokens={old:{$type:'number',$value:'0.5'},palette:{$type:'color',$value:'#4375ff'}};
 return {fileKey:'scratch-key',scopeId:'extension-test',source:{revision:'source',sourceProgramSha256:'a'.repeat(64),tokensSha256:'b'.repeat(64)},
  tokenPaths:['old','palette'],modes:[{sourceMode:'default',brand:'default',nativeModeName:'Default',tokens,tokenTreeRevision:revisionOf(tokens)}]};
}
const revise=(i:NativeTokenContextInput)=>{for(const m of i.modes)m.tokenTreeRevision=revisionOf(m.tokens);return i;};
const desired=(before:NativeTokenContextInput)=>{
 const after=copy(before);after.tokenPaths.push('added.false','added.true');
 after.modes[0].tokens.added={$type:'number',false:{$value:'1'},true:{$value:'0.6'}};
 return revise(after);
};
async function fixture(){
 const h=createFigmaMock(),figma=h.figma as any,variables=h.variables as any[],collections=h.collections as any[];
 figma.fileKey='scratch-key';
 const createCollection=figma.variables.createVariableCollection.bind(figma.variables),createVariable=figma.variables.createVariable.bind(figma.variables);
 figma.variables.createVariableCollection=(name:string)=>{
  const c=createCollection(name);Object.defineProperties(c,{key:{value:'key-'+c.id},remote:{value:false},
   defaultModeId:{get:()=>c.modes[0].modeId},variableIds:{get:()=>variables.filter(v=>v.variableCollectionId===c.id).map(v=>v.id)}});return c;
 };
 figma.variables.createVariable=(name:string,c:any,type:string)=>{
  const v=createVariable(name,c,type);Object.defineProperties(v,{key:{value:'key-'+v.id},remote:{value:false}});
  const set=v.setValueForMode.bind(v);v.setValueForMode=(mode:string,value:any)=>set(mode,typeof value==='number'?Math.fround(value):value);return v;
 };
 const run=async(script:string)=>JSON.parse(JSON.stringify(await vm.runInNewContext('(async()=>{'+script+'})()',{figma},{timeout:5000})));
 const before=input(),created=await run(emitNativeTokenContextScript(before).script);
 assert.equal(created.status,'created-candidate',JSON.stringify(created.problems));
 const identity=created.creationIdentity;
 const baseline=(await run(emitNativeTokenContextReadbackScript(before,identity))).receipt;
 const next=desired(before),plan=prepareNativeTokenExtension(before,identity,baseline,next);
 const read=()=>run(emitNativeTokenExtensionReadbackScript(plan));
 return {figma,variables,collections,run,before,identity,baseline,next,plan,read};
}

test('number additions retain the original allocation, source owner and values; later value history stays valid',async()=>{
 const f=await fixture(),{plan}=f;
 assert.equal(prepareNativeTokenContext(plan.after).revision,prepareNativeTokenContext(f.before).revision);
 assert.deepEqual(plan.after.source,f.before.source);
 assert.throws(()=>emitNativeTokenContextScript(plan.after),/extension-not-creatable/);
 const before=copy(f.baseline),preflight=await f.run(emitNativeTokenExtensionScript(plan,true));
 assert.equal(preflight.status,'preflight-observed');assert.equal(f.variables.length,2);
 const applied=await f.run(emitNativeTokenExtensionScript(plan));
 assert.equal(applied.status,'extended',JSON.stringify(applied.problems));
 const observed=await f.read(),resolved=verifyNativeTokenExtension(plan,observed);
 assert.equal(f.collections.length,1);assert.equal(f.variables.length,4);
 assert.deepEqual(observed.receipt.variables.slice(0,2),before.variables);
 assert.deepEqual(resolved.identity.variables.slice(0,2),f.identity.variables);
 assert.deepEqual(resolved.identity.collection,f.identity.collection);
 assert.deepEqual(resolved.identity.modes,f.identity.modes);
 assert.deepEqual(observed.receipt.collection.ownership,before.collection.ownership);
 const ordinary=await f.run(emitNativeTokenContextReadbackScript(resolved.input,resolved.identity));
 assert.equal(ordinary.status,'readback-collected');assert.deepEqual(ordinary.receipt,observed.receipt);
 const repeated=await f.run(emitNativeTokenExtensionScript(plan));assert.equal(repeated.status,'no-op');assert.equal(f.variables.length,4);
 const later=copy(resolved.input);(later.modes[0].tokens.added as any).true.$value='0.4';revise(later);
 later.allocatedValues=[{sourceMode:'default',brand:'default',tokenPath:'added.true',value:'0.6'}];
 assert.equal(prepareNativeTokenContext(later).revision,f.identity.preparationRevision);
 assert.equal(prepareNativeTokenContext(later).variables.find(v=>v.tokenPath==='added.true')!.values[0].value,0.4);
 assert.deepEqual(nativeTokenAllocationBase(later),f.before);
 assert.deepEqual(restoreNativeTokenAllocationInput(later),resolved.input);
 const withColor=copy(later);(withColor.modes[0].tokens.palette as any).$value='#123abc';revise(withColor);
 withColor.allocatedValueProtocol='template-values-v1';
 withColor.allocatedValues!.push({sourceMode:'default',brand:'default',tokenPath:'palette',value:'#4375ff'});
 assert.equal(prepareNativeTokenContext(withColor).revision,f.identity.preparationRevision);
 assert.deepEqual(nativeTokenAllocationBase(withColor),f.before);
 assert.deepEqual(restoreNativeTokenAllocationInput(withColor),resolved.input);
 const next=copy(resolved.input);next.tokenPaths.push('more');next.modes[0].tokens.more={$type:'number',$value:4};revise(next);
 const p2=prepareNativeTokenExtension(resolved.input,resolved.identity,observed.receipt,next);
 assert.equal((await f.run(emitNativeTokenExtensionScript(p2))).status,'extended');
 const r2=verifyNativeTokenExtension(p2,await f.run(emitNativeTokenExtensionReadbackScript(p2)));
 assert.equal(r2.identity.extensions!.length,2);assert.deepEqual(r2.identity.variables.slice(0,4),resolved.identity.variables);
 assert.deepEqual(plan.baseline,before,'no mutation of saved evidence');
});

test('addition planner refuses changed old definitions, metadata, modes, aliases, types and hidden leaves',async()=>{
 const f=await fixture();
 const corruptions:Array<(i:NativeTokenContextInput)=>void>=[
  i=>{(i.modes[0].tokens.old as any).$value='0.6';},
  i=>{(i.modes[0].tokens.old as any).$description='changed';},
  i=>{i.modes[0].nativeModeName='Other';},
  i=>{(i.modes[0].tokens.added as any).true.$value='{old}';},
  i=>{(i.modes[0].tokens.added as any).true={$type:'string',$value:'1'};},
  i=>{(i.modes[0].tokens.added as any).hidden={$value:'1'};},
  i=>{i.tokenPaths=i.tokenPaths.filter(p=>p!=='old');},
  i=>{i.modes[0].tokens.empty={};},
  i=>{(i.modes[0].tokens.added as any).$description='unsupported';},
 ];
 for(const corrupt of corruptions){const d=copy(f.next);corrupt(d);revise(d);assert.throws(()=>prepareNativeTokenExtension(f.before,f.identity,f.baseline,d),/native-token-/);}
 const bad=copy(f.plan.after);bad.allocationBase=copy(bad);assert.throws(()=>prepareNativeTokenContext(bad),/allocation-base-invalid/);
 assert.equal(f.variables.length,2);
});

test('independent verification refuses forged ledger, substituted IDs, extra allocation, changed old values and mode changes',async()=>{
 const f=await fixture();await f.run(emitNativeTokenExtensionScript(f.plan));const observed=await f.read();
 const corruptions:Array<(r:any)=>void>=[
  r=>{r.ledger[0].revision='sha256:'+'f'.repeat(64);},
  r=>{r.ledger[0].variables[0].id=f.identity.variables[0].id;},
  r=>{r.receipt.variables[2].key='different';},
  r=>{r.receipt.variables[0].valuesByMode[f.identity.modes[0].modeId]=0.4;},
  r=>{r.receipt.variables.push(copy(r.receipt.variables[2]));},
  r=>{r.receipt.collection.modes[0].name='Different';},
  r=>{r.receipt.collection.ownership.source.revision='different';},
  r=>{r.receipt.variables[2].valuesByMode.other=1;},
 ];
 for(const corrupt of corruptions){const r=copy(observed);corrupt(r);assert.throws(()=>verifyNativeTokenExtension(f.plan,r),/native-token-extension-/);}
 f.variables[0].setValueForMode(f.identity.modes[0].modeId,0.4);
 const stopped=await f.run(emitNativeTokenExtensionScript(f.plan));assert.equal(stopped.status,'refused');assert.equal(f.variables.length,4);
});

test('interruption before allocation resumes; unknown or partial allocations refuse without duplicates',async()=>{
 for(const stopAt of ['before-intent','after-create-before-id','after-first-id','after-all-values'] as const){
  const f=await fixture(),c=f.collections[0],originalSet=c.setSharedPluginData.bind(c),create=f.figma.variables.createVariable.bind(f.figma.variables);
  let stopped=false;
  c.setSharedPluginData=(ns:string,key:string,raw:string)=>{
   if(key==='nativeTokenExtensions'&&!stopped){
    const ledger=JSON.parse(raw);
    if(stopAt==='before-intent'||(stopAt==='after-first-id'&&ledger.variables?.length===1)||(stopAt==='after-all-values'&&Array.isArray(ledger))){
     stopped=true;throw Error('simulated-interruption');
    }
   }
   originalSet(ns,key,raw);
  };
  if(stopAt==='after-create-before-id')f.figma.variables.createVariable=(...args:any[])=>{const v=create(...args);if(!stopped){stopped=true;throw Error('simulated-interruption');}return v;};
  const first=await f.run(emitNativeTokenExtensionScript(f.plan));assert.equal(first.status,'refused',stopAt);
  const count=f.variables.length;
  const second=await f.run(emitNativeTokenExtensionScript(f.plan));
  if(stopAt==='before-intent'||stopAt==='after-all-values'){
   assert.equal(second.status,'extended',stopAt+JSON.stringify(second.problems));verifyNativeTokenExtension(f.plan,await f.read());assert.equal(f.variables.length,4);
  }else{assert.equal(second.status,'refused',stopAt);assert.match(second.problems[0],/partial-allocation-recovery-required/);assert.equal(f.variables.length,count);}
 }
});

test('a concurrent token edit during async reads refuses before recording intent',async()=>{
 const f=await fixture(),get=f.figma.variables.getVariableByIdAsync.bind(f.figma.variables);let changed=false;
 f.figma.variables.getVariableByIdAsync=async(id:string)=>{const v=await get(id);if(!changed){changed=true;f.variables[0].setValueForMode(f.identity.modes[0].modeId,0.4);}return v;};
 const out=await f.run(emitNativeTokenExtensionScript(f.plan));assert.equal(out.status,'refused');assert.equal(f.variables.length,2);
 assert.equal(f.collections[0].getSharedPluginData('ds_contracts','nativeTokenExtensions'),'');
});
