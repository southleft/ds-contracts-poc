import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {revisionOf} from '../core/contract-provenance.js';
import {sourceWitnessFixture} from './react-source-witness-test-fixture.js';
import {createReactSourceRepairApplications,type SourceRepairValidation} from './react-source-repair-apply.js';
import {createSourceFileTransactions} from './react-source-file-transaction.js';
import type {NativeOperationCommand} from './native-operation-jobs.js';
import {createReactReferenceService,type ReactReference} from './react-reference.js';

const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function fixture(t:test.TestContext){
  const f=await sourceWitnessFixture(t,true),p=await f.preview();
  const reads:NativeOperationCommand[]=[],validated:string[]=[];
  let latest:NativeOperationCommand|undefined,wait=false,conflict=false,afterConflict=false;
  let beforeRead:(()=>void)|undefined,validateHook:((v:SourceRepairValidation)=>void)|undefined;
  const dependencies={
    requestRead:()=>{
      beforeRead?.();
      latest={version:1,kind:'SOURCE-NATIVE-OPERATION',operationId:p.input.plan.operationId,phase:'update-readback',
        attemptId:randomUUID(),nonce:'fixture',planRevision:p.input.plan.revision,script:'read only',scriptSha256:sha('read only'),
        fileKey:'T56aKuRnoay1L7CKAjSWRO',readOnly:true};reads.push(latest);return latest;
    },
    readNative:(_plan:unknown,attemptId:string)=>{
      if(wait)return null;
      assert.equal(latest?.attemptId,attemptId);
      return {operationId:p.input.plan.operationId,parentId:p.input.plan.parentId,proposalId:p.input.plan.proposalId,
        fileKey:latest!.fileKey,attemptId,journalRevision:revisionOf(attemptId),scriptSha256:latest!.scriptSha256,
        baselineRevision:p.input.plan.baselineRevision,
        observed:(conflict||(afterConflict&&reads.length%2===0)?'changed':'observed') as any};
    },
    validate:async(reference:ReactReference)=>{
      validated.push(reference.id);
      const dir=path.join(f.repo,'private/validation-fixture');mkdirSync(dir,{recursive:true});
      const file=path.join(dir,randomUUID()+'.json'),contents=JSON.stringify({id:reference.id,cases:reference.cohort.cases});
      writeFileSync(file,contents,{flag:'wx'});
      const result={referenceId:reference.id,caseIds:reference.cohort.cases.map(c=>c.id),valid:reference.cohort.cases.length,files:{[file]:sha(contents)}};
      validateHook?.(result);return result;
    },
    pause:async():Promise<void>=>{throw Error('fixture-process-ended');},
  };
  const store=()=>createReactSourceRepairApplications(f.repo,f.root,dependencies);
  const selected={input:p.input,stage:p.stage,previewDirectory:p.dir,resultRevision:revisionOf(p.result)};
  const app=store(),prepared=app.prepare(selected);
  return {...f,p,app,store,prepared,reads,validated,selected,
    pause:(fn:()=>Promise<void>)=>{dependencies.pause=fn;},
    wait:(value:boolean)=>{wait=value;},conflict:()=>{conflict=true;},afterConflict:()=>{afterConflict=true;},
    beforeRead:(fn:()=>void)=>{beforeRead=fn;},validation:(fn:(v:SourceRepairValidation)=>void)=>{validateHook=fn;}};
}

test('reviewed application verifies the exact rebuilt source, reopens, repeats without writes, and restores source',async t=>{
  const f=await fixture(t),source=readFileSync(f.sourceFile),css=readFileSync(f.cssFile),id=f.prepared.id;
  assert.equal(f.prepared.phase,'prepared');assert.deepEqual(readFileSync(f.sourceFile),source);
  await f.app.start(id,'apply','http://localhost:5181').promise;
  const applied=f.app.read(id);assert.equal(applied.phase,'applied',applied.problem??'applied');
  assert.equal(applied.recordedCompletion,'applied');
  const appliedSource=readFileSync(f.sourceFile),appliedCss=readFileSync(f.cssFile);
  assert.equal(applied.validation?.valid,1);assert.notEqual(applied.validation?.referenceId,f.p.reference.id);
  assert.equal(readFileSync(f.sourceFile,'utf8').includes('disabled:opacity-60'),true);
  assert.equal(f.reads.length,2);assert.deepEqual(f.store().read(id),applied);
  const events=path.join(f.repo,'private/react-source-repair-applications',id,'events');
  const before=readdirSync(events);await f.store().start(id,'apply','http://localhost:5181').promise;
  assert.deepEqual(readdirSync(events),before);assert.equal(f.reads.length,2);
  await f.store().start(id,'rollback','http://localhost:5181').promise;
  const restored=f.store().read(id);assert.equal(restored.phase,'rolled-back',restored.problem??'restored');
  assert.equal(restored.recordedCompletion,'rolled-back');
  assert.equal(restored.validation?.referenceId,f.p.reference.id);
  assert.deepEqual(readFileSync(f.sourceFile),source);assert.deepEqual(readFileSync(f.cssFile),css);
  assert.throws(()=>f.store().start(id,'apply','http://localhost:5181'),/new-review-required/);
  // A later authorized change can produce the same bytes as this old review.
  // Keep its completed history visible without certifying the current source
  // or allowing the old rolled-back transaction to become an Apply again.
  writeFileSync(f.sourceFile,appliedSource);writeFileSync(f.cssFile,appliedCss);
  const historical=f.store().read(id);
  assert.equal(historical.phase,'recovery-required');assert.equal(historical.recordedCompletion,'rolled-back');
  await f.store().start(id,'apply','http://localhost:5181').promise;
  assert.match(f.store().read(id).problem??'',/new-review-required-after-rollback/);
  assert.deepEqual(readFileSync(f.sourceFile),appliedSource);assert.deepEqual(readFileSync(f.cssFile),appliedCss);
});

test('changed canvas or source refuses before any source write',async t=>{
  for(const target of ['canvas','source'] as const){
    const f=await fixture(t),original=readFileSync(f.sourceFile);
    if(target==='canvas')f.conflict();else f.beforeRead(()=>writeFileSync(f.sourceFile,'owner edit'));
    await f.app.start(f.prepared.id,'apply','http://localhost:5181').promise;
    const state=f.app.read(f.prepared.id);assert.equal(state.phase,'refused');
    assert.equal(f.validated.length,0);assert.deepEqual(readFileSync(f.sourceFile),target==='source'?Buffer.from('owner edit'):original);
  }
});

test('post-write validation or changed native content cannot produce completion',async t=>{
  for(const target of ['count','inventory','reference','evidence','source','canvas'] as const){
    const f=await fixture(t);
    if(target==='canvas')f.afterConflict();
    else f.validation(result=>{
      if(target==='count')result.valid=0;
      if(target==='inventory')result.caseIds=['another'];
      if(target==='reference')result.referenceId='f'.repeat(64);
      if(target==='evidence')writeFileSync(Object.keys(result.files)[0],'changed');
      if(target==='source')writeFileSync(f.sourceFile,'owner edit');
    });
    await f.app.start(f.prepared.id,'apply','http://localhost:5181').promise;
    const state=f.store().read(f.prepared.id);assert.equal(state.phase,'refused',target);
    assert.equal(state.transaction,target==='source'?'conflict':'applied');
    if(target==='source')assert.equal(readFileSync(f.sourceFile,'utf8'),'owner edit');
  }
});

test('a retained partial file transaction resumes only after a fresh native read',async t=>{
  for(const direction of ['apply','rollback'] as const){
    const f=await fixture(t),id=f.prepared.id;
    const interrupted=createSourceFileTransactions(f.repo,{checkpoint:(point,index)=>{if(point==='moved'&&index===0)throw Error('process ended');}});
    assert.throws(()=>interrupted.run(id,'apply',()=>{}),/process ended/);
    const job=f.store();await job.start(id,direction,'http://localhost:5181').promise;
    const state=job.read(id);assert.equal(state.phase,direction==='apply'?'applied':'rolled-back',state.problem??'completed');
    assert.equal(f.reads.length,2);
  }
});

test('a failed pending preflight restarts with a new attempt and conflicting direction refuses',async t=>{
  const f=await fixture(t),id=f.prepared.id;f.wait(true);
  const job=f.app.start(id,'apply','http://localhost:5181');
  assert.equal(f.app.start(id,'apply','http://localhost:5181'),job);
  assert.throws(()=>f.app.start(id,'rollback','http://localhost:5181'),/another-direction-running/);
  await job.promise;assert.equal(f.app.read(id).phase,'refused');
  const old=f.reads[0].attemptId;f.wait(false);
  await f.store().start(id,'apply','http://localhost:5181').promise;
  assert.equal(f.store().read(id).phase,'applied');assert.notEqual(f.reads[1].attemptId,old);
});

test('completed application refuses changed proof, validation evidence and source',async t=>{
  for(const target of ['proof','validation','source'] as const){
    const f=await fixture(t),id=f.prepared.id;
    await f.app.start(id,'apply','http://localhost:5181').promise;
    assert.equal(f.app.read(id).phase,'applied');
    if(target==='proof')writeFileSync(path.join(f.p.dir,'callers/toggle/candidate/initial.png'),'changed');
    if(target==='validation'){
      const dir=path.join(f.repo,'private/validation-fixture');writeFileSync(path.join(dir,readdirSync(dir)[0]),'changed');
      assert.equal(f.store().read(id).phase,'recovery-required');
      await f.store().start(id,'apply','http://localhost:5181').promise;
      assert.equal(f.store().read(id).phase,'applied');
      continue;
    }
    if(target==='source'){
      writeFileSync(f.sourceFile,'owner edit');assert.equal(f.store().read(id).phase,'refused');
      assert.throws(()=>f.store().start(id,'rollback','http://localhost:5181'),/source-conflict/);
      assert.equal(readFileSync(f.sourceFile,'utf8'),'owner edit');
    }else assert.throws(()=>f.store().read(id),/changed/);
  }
});

test('HTTP recovery remains available before loading originals and refuses caller input or an unavailable companion',async t=>{
  const f=await fixture(t),source=readFileSync(f.sourceFile),id=f.prepared.id;
  const handle=createReactReferenceService(f.repo,f.root);
  const server=createServer((req,res)=>void handle(req,res,(req.url??'').slice(1)));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/react/source-repairs';
  const first=await fetch(url);assert.equal(first.status,200);
  const listed=await first.json();assert.equal(listed.applications[0].id,id);
  assert(!JSON.stringify(listed).includes(f.root),'absolute paths remain host-only');
  for(const body of [{sourceRoot:'/tmp/elsewhere'},{script:'write arbitrary source'},{direction:'rollback'}]){
    const refused=await fetch(`${url}/${id}/apply`,{method:'POST',body:JSON.stringify(body)});
    assert.equal(refused.status,409);assert.equal((await refused.json()).reason,'react-source-apply-body-refused');
  }
  assert.equal((await fetch(`${url}/${id}/apply`)).status,409);
  const attempt=await fetch(`${url}/${id}/apply`,{method:'POST'});assert.equal(attempt.status,202);
  const state=(await (await fetch(`${url}/${id}`)).json()).application;
  assert.equal(state.phase,'refused');assert.equal(state.problem,'react-source-apply-companion-unavailable');
  assert.deepEqual(readFileSync(f.sourceFile),source);
  const interrupted=createSourceFileTransactions(f.repo,{checkpoint:(point,index)=>{if(point==='moved'&&index===0)throw Error('process ended');}});
  assert.throws(()=>interrupted.run(id,'apply',()=>{}),/process ended/);
  assert.equal((await fetch(url)).status,200,'listing does not require loading a partially missing source');
  const load=await fetch(url.replace('/source-repairs',''),{method:'POST'});assert.equal(load.status,409);
});

test('closing a service stops its pending run without writing or corrupting a newer run',async t=>{
  const f=await fixture(t),id=f.prepared.id;
  let release!:()=>void;f.wait(true);f.pause(()=>new Promise<void>(resolve=>{release=resolve;}));
  const stopped=f.app.start(id,'apply','http://localhost:5181');f.app.close();
  assert.throws(()=>f.app.start(id,'apply','http://localhost:5181'),/interrupted/);
  f.wait(false);const next=f.store();await next.start(id,'apply','http://localhost:5181').promise;
  assert.equal(next.read(id).phase,'applied');
  const dir=path.join(f.repo,'private/react-source-repair-applications',id,'events'),before=readdirSync(dir);
  release();await stopped.promise;
  assert.deepEqual(readdirSync(dir),before);assert.equal(next.read(id).phase,'applied');
});
