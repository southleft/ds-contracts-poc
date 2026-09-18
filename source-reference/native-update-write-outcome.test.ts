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
