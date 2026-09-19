import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {nativeUpdateFixture} from '../core/native-contract-update-test-fixture.js';
import {createNativeUpdatePlans} from './native-update-plans.js';
import {createNativeUpdateJobs} from './native-update-jobs.js';
import {createNativeOperationTransport} from './native-operation-transport.js';

// A write whose result never arrived is settled by reading the canvas. It is
// never sent again, and only the canvas decides what happened.
async function fixture(t:test.TestContext) {
 const f=await nativeUpdateFixture(),repo=mkdtempSync(path.join(tmpdir(),'native-update-write-outcome-'));
 t.after(()=>rmSync(repo,{recursive:true,force:true}));
 const plans=createNativeUpdatePlans(repo,()=>({parentJournalRevision:'a'.repeat(64),input:f.input}),id=>jobs.updateHistory(id));
 let jobs=createNativeUpdateJobs(repo,plans);
 const parent=f.input.before.operation.id,proposal=plans.prepare(parent),id=jobs.prepare(parent,proposal.id).id;
 const dir=path.join(repo,'private/source-native-updates',id);
 const run=async(phase:'update-preflight-readback'|'update-apply'|'update-readback')=>{const c=jobs.dispatch(id,phase);return jobs.accept(id,{...c,result:await f.run(c.script)});};
 const settle=async()=>{const c=jobs.resolveWriteOutcome(id);return {command:c,snapshot:jobs.accept(id,{...c,result:await f.run(c.script)})};};
 const writes=()=>readdirSync(path.join(dir,'events')).map(file=>JSON.parse(readFileSync(path.join(dir,'events',file),'utf8')))
  .filter(e=>e.kind==='dispatch'&&!e.command.readOnly).length;
 return {...f,run_script:f.run,repo,parent,id,dir,run,settle,writes,jobs:()=>jobs,restart:()=>{jobs=createNativeUpdateJobs(repo,plans);}};
}

test('a write the companion never received is settled as untouched and retried under its own claim',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 f.jobs().dispatch(f.id,'update-apply'); // journaled and claimed; the response was lost, so nothing ran
 assert.equal(f.jobs().get(f.id).unresolvedWrite,'awaiting-result');
 assert.throws(()=>f.jobs().retryObservation(f.id),/write-outcome-unknown/);
 assert.throws(()=>f.jobs().dispatch(f.id,'update-apply'),/dispatch-refused/,'the write is never sent again');
 f.restart();
 const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-write-untouched');assert.equal(snapshot.unresolvedWrite,undefined);
 assert.equal(f.jobs().updateHistory(f.parent).length,0,'an untouched write holds no place in the correction chain');
 assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
 // Nothing more is sent until an operator decides to: not a preflight, not a retry.
 assert.throws(()=>f.jobs().dispatch(f.id,'update-preflight-readback'),/write-rearm-required/);
 assert.throws(()=>f.jobs().retryObservation(f.id),/write-rearm-required/);
 f.restart();f.jobs().rearmWrite(f.id);assert.throws(()=>f.jobs().rearmWrite(f.id),/write-rearm-refused/);
 for(const phase of ['update-preflight-readback','update-apply','update-readback'] as const)await f.run(phase);
 assert.equal(f.jobs().get(f.id).phase,'update-verified');
 assert.ok(existsSync(path.join(f.dir,'apply-claim.json'))&&existsSync(path.join(f.dir,'apply-claim.1.json')));
 assert.equal(f.writes(),2,'two write attempts are journaled; only the second reached the canvas');
 f.restart();assert.equal(f.jobs().get(f.id).phase,'update-verified');
});

test('a write that landed but lost its result continues to independent verification without a second write',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const write=f.jobs().dispatch(f.id,'update-apply');await f.run_script(write.script);
 const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-applied');
 await f.run('update-readback');
 assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.equal(f.writes(),1);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.25);
});

test('a canvas that is neither the saved baseline nor the completed update stays unresolved and blocks the chain',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 f.jobs().dispatch(f.id,'update-apply');f.nodes[0].opacity=0.8;
 const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-recovery-required');
 assert.deepEqual(snapshot.problems,['native-update-write-outcome-unresolved']);
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
 assert.equal(f.nodes[0].opacity,0.8,'resolution only reads');
});

test('the write\'s own result outranks a pending canvas read; one arriving after settlement is kept but changes nothing',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const write=f.jobs().dispatch(f.id,'update-apply'),result=await f.run_script(write.script);
 const read=f.jobs().resolveWriteOutcome(f.id);
 assert.equal(f.jobs().get(f.id).unresolvedWrite,'reading-canvas');
 assert.equal(f.jobs().accept(f.id,{...write,result}).phase,'update-applied','the genuine result settles it');
 assert.throws(()=>f.jobs().accept(f.id,{...read,result:{}}),/unsolicited-result/,'the abandoned read can no longer answer');
 assert.equal(f.jobs().abandonedObservationPhase(f.id,read.attemptId),'update-readback');

 const g=await fixture(t);await g.run('update-preflight-readback');
 const lost=g.jobs().dispatch(g.id,'update-apply'),landed=await g.run_script(lost.script);await g.settle();
 const before=readdirSync(path.join(g.dir,'events')).length;
 assert.equal(g.jobs().accept(g.id,{...lost,result:landed}).phase,'update-applied');
 assert.equal(g.jobs().accept(g.id,{...lost,result:landed}).phase,'update-applied','a repeated late delivery records nothing more');
 assert.equal(readdirSync(path.join(g.dir,'events')).length,before+1);
 assert.throws(()=>g.jobs().accept(g.id,{...lost,result:{...landed,status:'no-op'}}),/result-replay-conflict/);
});

test('a late result claiming a write the canvas read found untouched raises recovery instead of being believed',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const lost=f.jobs().dispatch(f.id,'update-apply');await f.settle();
 assert.equal(f.jobs().accept(f.id,{...lost,result:{status:'updated'}}).phase,'update-recovery-required');
 assert.deepEqual(f.jobs().get(f.id).problems,['native-update-write-ran-without-begin','native-update-late-write-result-contradicts-canvas']);
 f.restart();assert.equal(f.jobs().get(f.id).phase,'update-recovery-required');
 // The canvas may hold this update's values: every chain guard must see a written, unverified correction.
 assert.equal(f.jobs().updateHistory(f.parent).length,1);
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
});

test('late results are judged by an allow-list: an unknown execution outcome or a rollback after "landed" raises recovery',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const lost=f.jobs().dispatch(f.id,'update-apply');await f.settle();
 assert.equal(f.jobs().accept(f.id,{...lost,result:{status:'native-execution-outcome-unknown'}}).phase,'update-recovery-required');
 const g=await fixture(t);await g.run('update-preflight-readback');
 const write=g.jobs().dispatch(g.id,'update-apply');await g.run_script(write.script);await g.settle();await g.run('update-readback');
 assert.equal(g.jobs().get(g.id).phase,'update-verified');
 assert.equal(g.jobs().accept(g.id,{...write,result:{status:'rolled-back'}}).phase,'update-recovery-required');
 const h=await fixture(t);await h.run('update-preflight-readback');
 const benign=h.jobs().dispatch(h.id,'update-apply');await h.settle();
 assert.equal(h.jobs().accept(h.id,{...benign,result:{status:'refused'}}).phase,'update-write-untouched','a refusal changed nothing, as the canvas said');
});

test('the companion must ask before a write executes, and is refused once a canvas read judges that write',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const write=f.jobs().dispatch(f.id,'update-apply');
 assert.throws(()=>f.jobs().beginWrite(f.id,'00000000-0000-4000-8000-000000000000'),/write-begin-refused/);
 f.jobs().resolveWriteOutcome(f.id);
 assert.throws(()=>f.jobs().beginWrite(f.id,write.attemptId),/write-begin-refused/,'a held-up write can no longer start');

 // A write that HAD begun and is not on the canvas yet is never treated as dead.
 const g=await fixture(t);await g.run('update-preflight-readback');
 const begun=g.jobs().dispatch(g.id,'update-apply');g.jobs().beginWrite(g.id,begun.attemptId);g.jobs().beginWrite(g.id,begun.attemptId);
 g.restart();const {snapshot}=await g.settle();
 assert.equal(snapshot.phase,'update-recovery-required');
 assert.deepEqual(snapshot.problems,['native-update-write-begun-outcome-unresolved']);
 assert.throws(()=>g.jobs().rearmWrite(g.id),/write-rearm-refused/);
 // It did land afterwards: the ordinary independent readback recovers it, with one write.
 await g.run_script(begun.script);g.jobs().retryObservation(g.id);
 const read=g.jobs().pendingCommand(g.id)!;
 assert.equal(g.jobs().accept(g.id,{...read,result:await g.run_script(read.script)}).phase,'update-verified');
 assert.equal(g.writes(),1);
});

test('a second poller cannot turn an untouched settlement into a second write, and the stalled first poller cannot begin',async t=>{
 const f=await fixture(t),transport=createNativeOperationTransport(f.repo,f.jobs());
 const secret=transport.pair(f.id).split('.')[1],fileKey=f.input.before.operation.fileKey;transport.start(f.id);
 const preflight=transport.claim(f.id,secret,fileKey,undefined,undefined,2);assert.ok(preflight.status==='command');
 if(preflight.status==='command')transport.accept(f.id,secret,{...preflight.command,result:await f.run_script(preflight.command.script)});
 const a=transport.claim(f.id,secret,fileKey,undefined,undefined,2);assert.ok(a.status==='command'&&!a.command.readOnly,'poller A is handed the write, then stalls');
 transport.resolveWriteOutcome(f.id);
 const b=transport.claim(f.id,secret,fileKey,undefined,undefined,2);assert.ok(b.status==='command'&&b.command.readOnly,'poller B takes the canvas read');
 if(b.status==='command')transport.accept(f.id,secret,{...b.command,result:await f.run_script(b.command.script)});
 assert.equal(f.jobs().get(f.id).phase,'update-write-untouched');
 for(let i=0;i<3;i++)assert.equal(transport.claim(f.id,secret,fileKey,undefined,undefined,2).status,'finished','no preflight and no second write is handed out');
 if(a.status==='command')assert.throws(()=>transport.begin(f.id,secret,a.command.attemptId),/write-begin-refused/,'A wakes up and may not execute');
 assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));assert.equal(f.writes(),1);
 // Only an explicit operator decision sends another write, and that one must ask too.
 transport.rearmWrite(f.id);
 for(let i=0;i<3;i++){const d=transport.claim(f.id,secret,fileKey,undefined,undefined,2);assert.equal(d.status,'command');if(d.status!=='command')break;
  if(!d.command.readOnly)transport.begin(f.id,secret,d.command.attemptId);
  transport.accept(f.id,secret,{...d.command,result:await f.run_script(d.command.script)});}
 assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.equal(f.writes(),2);
});

test('a canvas read is refused without an unresolved write, and a forged one fails the journal closed',async t=>{
 const f=await fixture(t);
 assert.throws(()=>f.jobs().resolveWriteOutcome(f.id),/write-outcome-not-pending/);
 await f.run('update-preflight-readback');f.jobs().dispatch(f.id,'update-apply');
 f.jobs().resolveWriteOutcome(f.id);
 assert.throws(()=>f.jobs().resolveWriteOutcome(f.id),/write-outcome-not-pending/,'one read at a time');
 const replaced=f.jobs().retryObservation(f.id);
 assert.equal(f.jobs().writeOutcomeRead(f.id)?.readAttemptId,replaced.attemptId,'an interrupted canvas read is replaced, never the write');
 const events=path.join(f.dir,'events'),last=path.join(events,readdirSync(events).sort().at(-1)!),entry=JSON.parse(readFileSync(last,'utf8'));
 writeFileSync(last,JSON.stringify({...entry,outcomeOf:'00000000-0000-4000-8000-000000000000'}));
 f.restart();assert.throws(()=>f.jobs().get(f.id),/outcome-dispatch-invalid/);
});

test('a companion holding an interrupted write marker is handed only the read that settles that write',async t=>{
 const f=await fixture(t),transport=createNativeOperationTransport(f.repo,f.jobs());
 const secret=transport.pair(f.id).split('.')[1],fileKey=f.input.before.operation.fileKey;transport.start(f.id);
 for(let i=0;i<2;i++){const d=transport.claim(f.id,secret,fileKey,undefined,undefined,2);assert.equal(d.status,'command');
  if(d.status==='command'&&d.command.readOnly)transport.accept(f.id,secret,{...d.command,result:await f.run_script(d.command.script)});else if(d.status==='command')var write=d.command;}
 // The companion died after taking the write. It reconnects holding that marker.
 assert.equal(transport.claim(f.id,secret,fileKey,undefined,write!.attemptId,2).status,'awaiting-result');
 transport.resolveWriteOutcome(f.id);
 assert.equal(transport.claim(f.id,secret,fileKey,undefined,'00000000-0000-4000-8000-000000000000',2).status,'awaiting-result','another write\'s marker is not served');
 const d=transport.claim(f.id,secret,fileKey,undefined,write!.attemptId,2);
 assert.ok(d.status==='command'&&d.command.readOnly&&d.resolvesWriteAttemptId===write!.attemptId);
});

test('a companion older than the begin handshake is never handed a write, and no attempt is burned on it',async t=>{
 const f=await fixture(t),transport=createNativeOperationTransport(f.repo,f.jobs());
 const secret=transport.pair(f.id).split('.')[1],fileKey=f.input.before.operation.fileKey;transport.start(f.id);
 const preflight=transport.claim(f.id,secret,fileKey);assert.ok(preflight.status==='command'&&preflight.command.readOnly,'reads are still served');
 if(preflight.status==='command')transport.accept(f.id,secret,{...preflight.command,result:await f.run_script(preflight.command.script)});
 const events=()=>readdirSync(path.join(f.dir,'events')).length,before=events();
 for(let i=0;i<3;i++)assert.equal(transport.claim(f.id,secret,fileKey).status,'companion-upgrade-required');
 assert.equal(events(),before,'the write was not even dispatched');assert.equal(existsSync(path.join(f.dir,'apply-claim.json')),false);
 const current=transport.claim(f.id,secret,fileKey,undefined,undefined,2);
 assert.ok(current.status==='command'&&!current.command.readOnly,'the current companion receives it');
 assert.equal(transport.claim(f.id,secret,fileKey).status,'companion-upgrade-required','and an old one still cannot take it over');
});

test('any late result after an untouched settlement names a companion that wrote without asking; after an unresolved one a rollback raises recovery',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');
 const lost=f.jobs().dispatch(f.id,'update-apply');await f.settle();
 const benign=f.jobs().accept(f.id,{...lost,result:{status:'no-op'}});
 assert.equal(benign.phase,'update-write-untouched');assert.deepEqual(benign.problems,['native-update-write-ran-without-begin']);
 const g=await fixture(t);await g.run('update-preflight-readback');
 const begun=g.jobs().dispatch(g.id,'update-apply');g.jobs().beginWrite(g.id,begun.attemptId);await g.settle();
 await g.run_script(begun.script);g.jobs().retryObservation(g.id);
 const read=g.jobs().pendingCommand(g.id)!;g.jobs().accept(g.id,{...read,result:await g.run_script(read.script)});
 assert.equal(g.jobs().get(g.id).phase,'update-verified');
 assert.equal(g.jobs().accept(g.id,{...begun,result:{status:'rolled-back'}}).phase,'update-recovery-required','verified must not survive its own write reporting a rollback');
});

// Design-led direction, first half: name what a designer changed, change nothing.
test('a design read names a canvas edit without moving the verified state, and the chain stays usable',async t=>{
 const f=await fixture(t);for(const phase of ['update-preflight-readback','update-apply','update-readback'] as const)await f.run(phase);
 const observe=async()=>{const c=f.jobs().observeDesign(f.id);assert.equal(f.jobs().get(f.id).designRead,true);return f.jobs().accept(f.id,{...c,result:await f.run_script(c.script)});};
 assert.equal((await observe()).designChanges!.total,0,'an untouched canvas reports nothing');
 f.nodes[0].opacity=0.8;
 const seen=await observe();
 assert.equal(seen.phase,'update-verified');assert.deepEqual(seen.problems,[]);
 assert.deepEqual(seen.designChanges!.changes.map(c=>[c.nodeId,c.channel,c.recorded,c.observed]),[[f.nodes[0].id,'opacity',0.25,0.8]]);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.25,'the verified observation is still the chain\'s truth');
 assert.equal(f.writes(),1);assert.equal(f.nodes[0].opacity,0.8,'the designer\'s value is left alone');
 f.restart();assert.equal(f.jobs().get(f.id).designChanges!.total,1);
 // Only a verified, idle update can be read this way; an interrupted read is simply dropped.
 f.jobs().observeDesign(f.id);assert.throws(()=>f.jobs().observeDesign(f.id),/design-observation-refused/);
 f.jobs().retryObservation(f.id);
});

// An operator may attest that a begun write's companion is gone. The attestation
// revokes that attempt, so no late result or late begin is accepted, and the write
// is then settled by a canvas read dispatched after it like any other unknown write.
const events=(dir:string)=>readdirSync(path.join(dir,'events')).sort().map(file=>JSON.parse(readFileSync(path.join(dir,'events',file),'utf8')));
async function begun(t:test.TestContext) {
 const f=await fixture(t);await f.run('update-preflight-readback');
 const write=f.jobs().dispatch(f.id,'update-apply');f.jobs().beginWrite(f.id,write.attemptId);
 return {...f,write};
}

test('begun, then the companion died: an attestation revokes the write, the canvas read finds it untouched, and a re-armed write verifies',async t=>{
 const f=await begun(t);
 assert.equal(f.jobs().get(f.id).canAttestDead,true);
 f.jobs().attestDead(f.id);
 const attested=events(f.dir).at(-1);
 assert.equal(attested.kind,'update-attempt-attested-dead');assert.equal(attested.attemptId,f.write.attemptId);
 assert.match(attested.statement,/companion .* is gone/);assert.ok(Number.isFinite(Date.parse(attested.at)));
 assert.equal(f.jobs().get(f.id).attestedDead!.attemptId,f.write.attemptId);
 assert.equal(f.jobs().get(f.id).unresolvedWrite,'awaiting-result','attesting settles nothing by itself');
 assert.throws(()=>f.jobs().beginWrite(f.id,f.write.attemptId),/write-begin-refused/,'a revoked write may not begin again');
 assert.throws(()=>f.jobs().dispatch(f.id,'update-apply'),/dispatch-refused/,'and it is never sent again');
 f.restart();const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-write-untouched');assert.deepEqual(snapshot.problems,[]);
 assert.equal(f.jobs().updateHistory(f.parent).length,0,'the chain is free: an untouched write holds no place in it');
 f.jobs().rearmWrite(f.id);
 for(const phase of ['update-preflight-readback','update-apply','update-readback'] as const)await f.run(phase);
 assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.deepEqual(f.jobs().get(f.id).problems,[]);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.25);
 assert.equal(f.writes(),2);f.restart();assert.equal(f.jobs().get(f.id).phase,'update-verified');
});

test('the ledger\'s frozen case: a begun write settled as unresolved is unfrozen by attestation, and a write that had landed verifies with no second write',async t=>{
 const f=await begun(t);
 const first=await f.settle();
 assert.equal(first.snapshot.phase,'update-recovery-required');
 assert.deepEqual(first.snapshot.problems,['native-update-write-begun-outcome-unresolved']);
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/,'before: the chain is frozen');
 // The companion executed after that read and died before reporting.
 await f.run_script(f.write.script);
 assert.equal(f.jobs().get(f.id).canAttestDead,true);
 const reopened=f.jobs().attestDead(f.id);
 assert.equal(reopened.unresolvedWrite,'awaiting-result','revoked, it is an unknown write again');
 const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-applied');
 await f.run('update-readback');
 assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.equal(f.writes(),1);
 assert.equal(f.jobs().verifiedForParent(f.parent)!.input.component.variants[0].spec.opacity,0.25,'after: the chain continues from the verified correction');
 const plans=createNativeUpdatePlans(f.repo,()=>({parentJournalRevision:'a'.repeat(64),input:f.input}),id=>f.jobs().updateHistory(id));
 assert.doesNotThrow(()=>plans.prepare(f.parent),'the next proposal can be planned');
 assert.equal(f.jobs().attestDead(f.id).phase,'update-verified','attesting again records nothing');
});

test('an attestation abandons a canvas read dispatched before it; only a read after it may judge the write',async t=>{
 const f=await begun(t);const early=f.jobs().resolveWriteOutcome(f.id);
 f.jobs().attestDead(f.id);
 assert.deepEqual(events(f.dir).slice(-2).map(e=>[e.kind,e.attemptId]),[['abandon-observation',early.attemptId],['update-attempt-attested-dead',f.write.attemptId]]);
 const answer=await f.run_script(early.script);
 assert.throws(()=>f.jobs().accept(f.id,{...early,result:answer}),/result-correlation-invalid|unsolicited-result/,'the abandoned read can no longer answer');
 assert.equal((await f.settle()).snapshot.phase,'update-write-untouched');
});

test('a partial landing after attestation still needs recovery, by name; attesting again adds no event',async t=>{
 const f=await begun(t);f.jobs().attestDead(f.id);f.nodes[0].opacity=0.8;
 const {snapshot}=await f.settle();
 assert.equal(snapshot.phase,'update-recovery-required');assert.deepEqual(snapshot.problems,['native-update-write-outcome-unresolved']);
 assert.equal(snapshot.canAttestDead,false);
 const before=events(f.dir).length;f.jobs().attestDead(f.id);f.jobs().attestDead(f.id);
 assert.equal(events(f.dir).length,before);
 assert.equal(events(f.dir).filter(e=>e.kind==='update-attempt-attested-dead').length,1);
 assert.throws(()=>f.jobs().rearmWrite(f.id),/write-rearm-refused/);
 assert.throws(()=>f.jobs().verifiedForParent(f.parent),/effective-observation-unavailable/);
});

test('a late result after attestation is recorded as late and never counted as the outcome',async t=>{
 // Before the read: it does not settle the write, however much it claims.
 const f=await begun(t);f.jobs().attestDead(f.id);
 const landed=await f.run_script(f.write.script);
 const late=f.jobs().accept(f.id,{...f.write,result:landed});
 assert.equal(events(f.dir).at(-1).kind,'late-result-after-revocation');
 assert.equal(late.phase,'awaiting-native-result');assert.equal(late.unresolvedWrite,'awaiting-result');
 assert.deepEqual(late.problems,['native-update-late-result-after-revocation']);
 const count=events(f.dir).length;
 assert.equal(f.jobs().accept(f.id,{...f.write,result:landed}).phase,'awaiting-native-result','a repeated delivery records nothing more');
 assert.equal(events(f.dir).length,count);
 assert.throws(()=>f.jobs().accept(f.id,{...f.write,result:{...landed,status:'no-op'}}),/result-replay-conflict/);
 assert.equal(f.writes(),1);
 // While the settling read is in flight: it does not outrank the read, as an unrevoked result would.
 const g=await begun(t);g.jobs().attestDead(g.id);const read=g.jobs().resolveWriteOutcome(g.id);
 const phase=g.jobs().get(g.id).phase,problems=g.jobs().get(g.id).problems;
 g.jobs().accept(g.id,{...g.write,result:{status:'updated'}});
 assert.equal(g.jobs().get(g.id).phase,phase);assert.equal(g.jobs().writeOutcomeRead(g.id)?.readAttemptId,read.attemptId,'the read is still the judge');
 assert.deepEqual(g.jobs().get(g.id).problems,[...problems,'native-update-late-result-after-revocation']);
 assert.equal(g.jobs().accept(g.id,{...read,result:await g.run_script(read.script)}).phase,'update-write-untouched','the canvas decides');
 // After settlement: the settled state stands; the alarm is kept.
 const h=await begun(t);h.jobs().attestDead(h.id);await h.settle();
 const after=h.jobs().accept(h.id,{...h.write,result:{status:'updated'}});
 assert.equal(after.phase,'update-write-untouched');assert.deepEqual(after.problems,['native-update-late-result-after-revocation']);
 h.restart();assert.equal(h.jobs().get(h.id).phase,'update-write-untouched');
 assert.equal(h.jobs().updateHistory(h.parent).length,0);
});

test('an attestation is refused by name unless the latest write was begun and is unresolved',async t=>{
 const f=await fixture(t);
 assert.throws(()=>f.jobs().attestDead(f.id),/^Error: native-update-attest-dead-no-write$/);
 await f.run('update-preflight-readback');const write=f.jobs().dispatch(f.id,'update-apply');
 assert.throws(()=>f.jobs().attestDead(f.id),/^Error: native-update-attest-dead-write-not-begun$/,'never begun: the canvas read already settles it');
 assert.equal(f.jobs().get(f.id).canAttestDead,false);
 f.jobs().beginWrite(f.id,write.attemptId);
 f.jobs().accept(f.id,{...write,result:await f.run_script(write.script)});
 assert.throws(()=>f.jobs().attestDead(f.id),/^Error: native-update-attest-dead-write-answered$/,'a companion that reported is not gone');
 await f.run('update-readback');
 assert.throws(()=>f.jobs().attestDead(f.id),/^Error: native-update-attest-dead-write-answered$/);
 // Begun, settled unresolved, then a separate read of the canvas is in flight.
 const g=await begun(t);await g.settle();g.jobs().retryObservation(g.id);
 assert.throws(()=>g.jobs().attestDead(g.id),/^Error: native-update-attest-dead-observation-in-flight$/);
 // Begun, and a later readback verified it landed: nothing left to attest.
 const pending=g.jobs().pendingCommand(g.id)!;await g.run_script(g.write.script);
 g.jobs().accept(g.id,{...pending,result:await g.run_script(pending.script)});
 assert.equal(g.jobs().get(g.id).phase,'update-verified');
 assert.throws(()=>g.jobs().attestDead(g.id),/^Error: native-update-attest-dead-write-settled$/);
});

test('a forged attestation fails the journal closed',async t=>{
 const f=await fixture(t);await f.run('update-preflight-readback');f.jobs().dispatch(f.id,'update-apply');
 const dir=path.join(f.dir,'events'),files=readdirSync(dir).sort(),last=JSON.parse(readFileSync(path.join(dir,files.at(-1)!),'utf8'));
 const {createHash}=await import('node:crypto');
 const previous=createHash('sha256').update(readFileSync(path.join(dir,files.at(-1)!),'utf8')).digest('hex');
 const write=last.command.attemptId;
 writeFileSync(path.join(dir,String(files.length).padStart(8,'0')+'.json'),JSON.stringify({kind:'update-attempt-attested-dead',attemptId:write,
  statement:'x',at:new Date().toISOString(),sequence:files.length,previous}));
 f.restart();assert.throws(()=>f.jobs().get(f.id),/attestation-invalid/,'not begun, and not the recorded statement');
});

test('a revoked write that executes after its settlement is named by the next preflight, and the update converges without a second change',async t=>{
 const f=await begun(t);f.jobs().attestDead(f.id);await f.settle();
 assert.equal(f.jobs().get(f.id).phase,'update-write-untouched');
 // The companion was alive after all: its program runs after the canvas read.
 const late=await f.run_script(f.write.script);
 assert.equal(late.status,'updated');assert.ok(f.nodes.every((n:any)=>n.opacity===0.25));
 f.jobs().rearmWrite(f.id);await f.run('update-preflight-readback');
 const named=f.jobs().get(f.id);
 assert.equal(named.phase,'update-preflight-observed');
 assert.deepEqual(named.problems,['native-update-canvas-moved-after-revoked-settlement']);
 await f.run('update-apply');await f.run('update-readback');
 const verified=f.jobs().get(f.id);
 assert.equal(verified.phase,'update-verified');
 assert.deepEqual(verified.problems,['native-update-canvas-moved-after-revoked-settlement'],'the divergence stays on the record');
 f.restart();assert.deepEqual(f.jobs().get(f.id).problems,['native-update-canvas-moved-after-revoked-settlement']);
 // The pinned program is guarded and idempotent: running it again on the settled canvas writes nothing.
 assert.equal((await f.run_script(f.write.script)).status,'no-op');
 // And a late run over a designer's edit refuses by name instead of overwriting it.
 f.nodes[0].opacity=0.8;const refused=await f.run_script(f.write.script);
 assert.equal(refused.status,'refused');assert.equal(f.nodes[0].opacity,0.8);
});

test('a journal recorded before attestation existed replays unchanged: the frozen case still reads as frozen, and nothing is written by reading it',async t=>{
 const f=await begun(t);await f.settle();
 const bytes=()=>readdirSync(path.join(f.dir,'events')).sort().map(file=>readFileSync(path.join(f.dir,'events',file),'utf8')).join('\n');
 const recorded=bytes();
 assert.ok(!recorded.includes('attested')&&!recorded.includes('revocation'));
 f.restart();const replayed=f.jobs().get(f.id);
 assert.equal(replayed.phase,'update-recovery-required');
 assert.deepEqual(replayed.problems,['native-update-write-begun-outcome-unresolved']);
 assert.equal(replayed.attestedDead,undefined);assert.equal(replayed.canAttestDead,true);
 assert.equal(f.jobs().updateHistory(f.parent)[0].phase,'update-recovery-required');
 assert.equal(bytes(),recorded);
});
