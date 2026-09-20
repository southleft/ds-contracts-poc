/** Construct authentic historical journal bytes in an isolated temporary store.
 * Legacy programs remain evidence; today's dispatcher must not grant them a
 * new write, even if a command was handed out or begun before the upgrade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {prepareNativeContractUpdate,emitNativeContractUpdateScript,type NativeOpacityUpdatePlan} from '../core/native-contract-update.js';
import {emitNativeContractReadbackScript} from '../core/native-source-observation.js';
import {createNativeUpdatePlans,NATIVE_TOKEN_VALUE_SCOPE_LIMITATION} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';
import type {NativeOperationCommand} from './native-operation-jobs.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
async function legacy(t:test.TestContext,state:'unwritten'|'pending'|'begun'|'landed'|'variable'|'literal') {
 const f=await nativeUpdateFixture(),repo=mkdtempSync(path.join(tmpdir(),'native-legacy-scope-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 const changed={...structuredClone(f.tokens),opacity:{$type:'number',$value:0.4}};
 const input={...f.input,desired:f.desiredFor(changed)},parent=input.before.operation.id;
 const plan=prepareNativeContractUpdate(input).plan as NativeOpacityUpdatePlan;
 delete plan.tokenBindingScope;
 const record={version:1 as const,parentId:parent,parentJournalRevision:'a'.repeat(64),update:{plan,revision:revisionOf(plan)}};
 const proposal=revisionOf(record).slice(7),hash=sha('native-update:'+parent+':'+proposal);
 const id=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
 const planDir=path.join(repo,'private/source-native-update-plans',parent),dir=path.join(repo,'private/source-native-updates',id);
 mkdirSync(planDir,{recursive:true});mkdirSync(path.join(dir,'events'),{recursive:true});
 const planFile=path.join(planDir,proposal+'.json'),originalPlan=JSON.stringify(record);writeFileSync(planFile,originalPlan);
 const scripts=Object.fromEntries([
  ['update-preflight-readback',emitNativeContractUpdateScript(plan,'apply',true)],
  ['update-apply',emitNativeContractUpdateScript(plan)],
  ['update-readback',emitNativeContractReadbackScript(plan.after,true,true)],
 ].map(([phase,script])=>[phase,{script,sha256:sha(script)}]));
 const header={version:1,id,parentId:parent,proposalId:proposal,planRevision:record.update.revision,scripts};
 const headerBytes=JSON.stringify(header);writeFileSync(path.join(dir,'operation.json'),headerBytes);
 let previous=sha(headerBytes),sequence=0;
 const append=(entry:object)=>{const bytes=JSON.stringify({...entry,sequence,previous});writeFileSync(path.join(dir,'events',String(sequence++).padStart(8,'0')+'.json'),bytes);previous=sha(bytes);};
 const command=(phase:'update-preflight-readback'|'update-apply'):NativeOperationCommand=>({version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:id,phase,
   attemptId:randomUUID(),nonce:'b'.repeat(64),fileKey:plan.before.operation.fileKey,planRevision:record.update.revision,
   script:scripts[phase].script,scriptSha256:scripts[phase].sha256,readOnly:phase!=='update-apply'});
 const preflight=command('update-preflight-readback');append({kind:'dispatch',command:preflight});
 append({kind:'result',envelope:{...preflight,result:await f.run(preflight.script)}});
 const write=command('update-apply');
 if(state!=='unwritten') {
   writeFileSync(path.join(dir,'apply-claim.json'),JSON.stringify(write));append({kind:'dispatch',command:write});
   if(state==='begun')append({kind:'begin',attemptId:write.attemptId,at:'2026-09-19T00:00:00.000Z'});
   if(state==='landed')await f.run(write.script);
   if(state==='variable') {
     const variable=await f.figma.variables.getVariableByIdAsync(plan.tokenChanges![0].variableId);
     variable.setValueForMode(plan.tokenChanges![0].modeId,0.4);
   }
   if(state==='literal')f.nodes[0].opacity=0.4;
 }
 let jobs:ReturnType<typeof createNativeUpdateJobs>;
 const plans=createNativeUpdatePlans(repo,()=>({parentJournalRevision:'a'.repeat(64),input}),p=>jobs.updateHistory(p));
 jobs=createNativeUpdateJobs(repo,plans);
 return {...f,repo,parent,proposal,id,write,plans,jobs,input,planFile,originalPlan};
}

test('legacy unapplied proposals are obsolete and cannot authorize a new write',async t=>{
 const f=await legacy(t,'unwritten');
 assert.throws(()=>f.plans.current(f.parent,f.proposal),/native-update-input-changed/);
 assert.throws(()=>f.jobs.dispatch(f.id,'update-apply'),/legacy-token-write-scope-refused/);
 const next=f.plans.prepare(f.parent);assert.notEqual(next.id,f.proposal);assert.equal(next.tokenBindingScope,'document-v1');
 assert.ok(f.plans.list(f.parent).find(p=>p.id===f.proposal)!.limitations.includes(NATIVE_TOKEN_VALUE_SCOPE_LIMITATION));
 assert.equal(readFileSync(f.planFile,'utf8'),f.originalPlan);
});

test('pending legacy writes cannot be redelivered or begun, including an idempotent old begin',async t=>{
 for(const state of ['pending','begun'] as const) {
  const f=await legacy(t,state);
  assert.throws(()=>f.jobs.pendingCommand(f.id),/legacy-token-write-scope-refused/);
  assert.throws(()=>f.jobs.beginWrite(f.id,f.write.attemptId),/legacy-token-write-scope-refused/);
  if(state==='begun')f.jobs.attestDead(f.id);
  const read=f.jobs.resolveWriteOutcome(f.id);assert.equal(read.readOnly,true);
  const settled=f.jobs.accept(f.id,{...read,result:await f.run(read.script)});
  assert.equal(settled.phase,'update-write-untouched');
  assert.throws(()=>f.jobs.rearmWrite(f.id),/legacy-token-write-scope-refused/);
  assert.equal(readFileSync(f.planFile,'utf8'),f.originalPlan);
 }
});

test('landed legacy writes remain readable and qualify unchanged repeats without new write authority',async t=>{
 const f=await legacy(t,'landed');
 const read=f.jobs.resolveWriteOutcome(f.id);assert.equal(f.jobs.accept(f.id,{...read,result:await f.run(read.script)}).phase,'update-applied');
 const verify=f.jobs.dispatch(f.id,'update-readback');assert.equal(verify.readOnly,true);
 assert.equal(f.jobs.accept(f.id,{...verify,result:await f.run(verify.script)}).phase,'update-verified');
 assert.equal(f.jobs.get(f.id).sourceCurrent,true);
 assert.equal(f.plans.prepare(f.parent).id,f.proposal,'unchanged review reopens the authenticated legacy result');
 assert.ok(f.jobs.verifiedForParent(f.parent));
 assert.equal(readFileSync(f.planFile,'utf8'),f.originalPlan);
 // Current source is still re-derived. Compatibility cannot conceal source drift.
 f.input.desired.revision=revisionOf('different-source');
 assert.throws(()=>f.plans.current(f.parent,f.proposal),/input-changed/);
});

test('partial legacy writes remain unresolved evidence and cannot qualify a successor',async t=>{
 for(const state of ['variable','literal'] as const) {
  const f=await legacy(t,state),read=f.jobs.resolveWriteOutcome(f.id);
  assert.equal(f.jobs.accept(f.id,{...read,result:await f.run(read.script)}).phase,'update-recovery-required');
  assert.throws(()=>f.plans.prepare(f.parent),/effective-observation-unavailable/);
  assert.throws(()=>f.jobs.verifiedForParent(f.parent),/effective-observation-unavailable/);
  assert.equal(readFileSync(f.planFile,'utf8'),f.originalPlan);
 }
});
