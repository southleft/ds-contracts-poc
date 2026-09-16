import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { emitNativeContractReadbackScript } from '../core/native-source-observation.js';
import { nativeRootSizeUpdateFixture } from '../core/native-contract-size-update-test-fixture.js';
import { nativeUpdateFixture } from '../core/native-contract-update-test-fixture.js';
import { createNativeUpdatePlans } from './native-update-plans.js';
import { createNativeUpdateJobs } from './native-update-jobs.js';
import { createNativeOperationTransport } from './native-operation-transport.js';

async function fixture(t:test.TestContext, make: typeof nativeUpdateFixture | typeof nativeRootSizeUpdateFixture = nativeUpdateFixture) {
  const f=await make(),repo=mkdtempSync(path.join(tmpdir(),'native-update-delivery-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  let stale=false,lose='',failStorage=false,readerRevision=0;
  const readers={readback:(...args:Parameters<typeof emitNativeContractReadbackScript>) =>
    (readerRevision ? '// Current independent reader '+readerRevision+'\n' : '') + emitNativeContractReadbackScript(...args)};
  const plans=createNativeUpdatePlans(repo,()=>{if(stale) throw Error('source changed');return {parentJournalRevision:'a'.repeat(64),input:f.input};});
  const proposal=plans.prepare(f.input.before.operation.id);
  let jobs=createNativeUpdateJobs(repo,plans,readers);
  const first=jobs.prepare(proposal.parentId,proposal.id),id=first.id;
  let transport=createNativeOperationTransport(repo,jobs);
  const pair=transport.pair(id),secret=pair.split('.')[1];
  const storage=new Map<string,any>(),messages:any[]=[],delivered:any[]=[];
  f.figma.showUI=()=>{};
  f.figma.clientStorage={getAsync:async(k:string)=>structuredClone(storage.get(k)),
    setAsync:async(k:string,v:any)=>{if(failStorage&&v.stage==='result'){failStorage=false;throw Error('storage unavailable');}storage.set(k,JSON.parse(JSON.stringify(v)));},
    deleteAsync:async(k:string)=>{storage.delete(k);}};
  const plugin=readFileSync(new URL('../figma-sync/plugin/code.js',import.meta.url),'utf8');
  const fetch=async(url:string,init:any)=>{
    assert(url.startsWith(`http://localhost:5181/api/source-reference/native/${id}/`));
    const payload=JSON.parse(init.body),supplied=init.headers.Authorization.slice(7);
    let response;
    if(url.endsWith('/claim')) {
      response=transport.claim(id,supplied,payload.fileKey,payload.replaceReadbackAttemptId);
      if('command' in response) delivered.push(response.command);
    } else response=transport.accept(id,supplied,payload);
    if(lose===(url.endsWith('/claim')?'claim':'result')){lose='';throw Error('response lost');}
    return {ok:true,json:async()=>JSON.parse(JSON.stringify(response))};
  };
  const boot=()=>{
    f.figma.ui={postMessage:(m:any)=>messages.push(JSON.parse(JSON.stringify(m)))};
    vm.runInNewContext(plugin,{figma:f.figma,fetch,__html__:'',console},{timeout:5000});
    return (m:any)=>f.figma.ui.onmessage(m);
  };
  let send=boot();await send({type:'native-connect',connection:pair});
  assert.equal(messages.at(-1).status,'ready');transport.start(id);
  return {...f,repo,id,proposal,plans,secret,storage,messages,delivered,
    jobs:()=>jobs,transport:()=>transport,poll:()=>send({type:'native-poll'}),
    restart:()=>{jobs=createNativeUpdateJobs(repo,plans,readers);transport=createNativeOperationTransport(repo,jobs);send=boot();},
    advanceReader:()=>{readerRevision++;},stale:()=>{stale=true;},lose:(where:string)=>{lose=where;},failStorage:()=>{failStorage=true;}};
}

test('the actual companion delivers preflight, an existing-node update, and independent exports across restarts',async t=>{
  const f=await fixture(t),ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
  for(const expected of ['update-preflight-observed','update-applied','update-verified']) {
    await f.poll();assert.equal(f.jobs().get(f.id).phase,expected,JSON.stringify(f.messages.slice(-3)));f.restart();
  }
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.25));
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  assert.deepEqual(f.delivered.map(c=>c.readOnly),[true,false,true]);
  assert.equal(f.jobs().get(f.id).imageObservation?.images.length,2);
  assert.equal(f.jobs().prepare(f.proposal.parentId,f.proposal.id).id,f.id);
  await f.poll();assert.equal(f.delivered.length,3);
  f.transport().retryObservation(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  const image=f.jobs().get(f.id).imageObservation!.images[0];
  assert.ok(f.jobs().image(f.id,image.sha256).length>0);
  assert(!JSON.stringify(f.messages).includes(f.secret));
});

test('source drift or a manual native edit prevents the write',async t=>{
  const changed=await fixture(t);await changed.poll();changed.stale();await changed.poll();
  assert.equal(changed.delivered.length,1);assert.ok(changed.nodes.every((n:any)=>n.opacity===0.5));
  const conflict=await fixture(t);conflict.nodes[0].opacity=0.8;await conflict.poll();
  assert.equal(conflict.jobs().get(conflict.id).phase,'update-refused');await conflict.poll();
  assert.equal(conflict.delivered.length,1);assert.equal(conflict.nodes[0].opacity,0.8);assert.equal(conflict.nodes[1].opacity,0.5);
});

test('a lost update acknowledgement is retained and resent without repeating a write even after source drift',async t=>{
  const f=await fixture(t);await f.poll();f.lose('result');await f.poll();
  assert.equal(f.storage.get('ds_native_receipt:'+f.id).stage,'result');
  f.stale();f.restart();await f.poll();await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.equal(f.jobs().get(f.id).sourceCurrent,false);
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
});

test('an interrupted write is never replayed and a missing write history fails closed',async t=>{
  const f=await fixture(t);await f.poll();f.failStorage();await f.poll();
  assert.equal(f.storage.get('ds_native_receipt:'+f.id).stage,'received');
  f.restart();await f.poll();
  assert.equal(f.jobs().get(f.id).pendingPhase,'update-apply');
  assert.throws(()=>f.transport().retryObservation(f.id),/write-outcome-unknown/);
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  const dir=path.join(f.repo,'private/source-native-updates',f.id,'events');
  for(const file of readdirSync(dir).filter(n=>n>='00000002.json')) unlinkSync(path.join(dir,file));
  assert.throws(()=>f.jobs().get(f.id),/write-journal-incomplete/);
});

test('an interrupted readback can be explicitly replaced through the companion',async t=>{
  const f=await fixture(t);f.lose('claim');await f.poll();
  const abandoned=f.jobs().get(f.id).pendingPhase;assert.equal(abandoned,'update-preflight-readback');
  f.transport().retryObservation(f.id);f.restart();await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-preflight-observed');
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,0);
});


test('size correction becomes reusable only after independent readback, and drift invalidates it', async t => {
  const f = await fixture(t, nativeRootSizeUpdateFixture), parent = f.proposal.parentId;
  assert.equal(f.jobs().verifiedForParent(parent), undefined);
  await f.poll(); await f.poll();
  assert.throws(() => f.jobs().verifiedForParent(parent), /effective-observation-unavailable/);
  f.restart(); await f.poll();
  assert.equal(f.jobs().get(f.id).phase, 'update-verified');
  const effective = f.jobs().verifiedForParent(parent)!;
  assert.equal(effective.input.component.variants[0].spec.lits!.height, 36);
  assert.equal(effective.receipt.nodes!.find(n=>n.id===f.nodes[0].id)!.values.height, 36);
  assert.equal(f.delivered.filter(c=>!c.readOnly).length, 1);
  f.stale(); assert.throws(() => f.jobs().verifiedForParent(parent), /source changed/);
});


test('current read-only inspection recovers a completed correction without replacing its write history',async t=>{
  const f=await fixture(t);await f.poll();await f.poll();await f.poll();
  const root=path.join(f.repo,'private/source-native-updates',f.id),events=path.join(root,'events');
  const originals=Object.fromEntries(['operation.json','apply-claim.json',...readdirSync(events).map(n=>'events/'+n)]
    .map(file=>[file,readFileSync(path.join(root,file),'utf8')]));
  assert.ok(f.jobs().verifiedForParent(f.proposal.parentId));
  f.advanceReader();f.restart();
  assert.equal(f.jobs().get(f.id).sourceCurrent,false);
  assert.equal(f.jobs().get(f.id).canRefreshObservation,true);
  assert.throws(()=>f.jobs().verifiedForParent(f.proposal.parentId),/current-reader-observation-required/);
  f.transport().retryObservation(f.id);
  const pending=f.jobs().pendingCommand(f.id)!;
  assert.equal(pending.phase,'update-readback');assert.equal(pending.readOnly,true);
  assert.ok(pending.script.startsWith('// Current independent reader 1'));
  f.lose('result');await f.poll();f.restart();await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');
  assert.equal(f.jobs().get(f.id).sourceCurrent,true);
  assert.ok(f.jobs().verifiedForParent(f.proposal.parentId));
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  for(const[file,bytes]of Object.entries(originals))assert.equal(readFileSync(path.join(root,file),'utf8'),bytes);
  assert.equal(readdirSync(events).length,Object.keys(originals).length); // two new events, two non-event originals
  f.advanceReader();
  assert.equal(f.jobs().get(f.id).sourceCurrent,false);
  f.transport().retryObservation(f.id);f.nodes[0].opacity=0.8;await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-recovery-required');
  assert.throws(()=>f.jobs().verifiedForParent(f.proposal.parentId),/effective-observation-unavailable/);
  assert.equal(f.nodes[0].opacity,0.8);
});

test('reader refresh cannot promote a changed source or replace an unknown write',async t=>{
  const f=await fixture(t);await f.poll();await f.poll();await f.poll();
  f.advanceReader();f.stale();f.restart();
  assert.equal(f.jobs().get(f.id).canRefreshObservation,false);
  f.transport().retryObservation(f.id);
  assert.ok(!f.jobs().pendingCommand(f.id)!.script.startsWith('// Current independent reader'));
  await f.poll();assert.equal(f.jobs().get(f.id).sourceCurrent,false);
  assert.throws(()=>f.jobs().verifiedForParent(f.proposal.parentId),/source changed/);
  const unknown=await fixture(t);await unknown.poll();unknown.failStorage();await unknown.poll();unknown.advanceReader();
  assert.equal(unknown.jobs().get(unknown.id).canRefreshObservation,false);
  assert.throws(()=>unknown.transport().retryObservation(unknown.id),/write-outcome-unknown/);
});

test('read-only program records refuse changed input, hash and write phase',async t=>{
  for(const tamper of [
    (e:any)=>{e.reader.inputRevision='sha256:'+'f'.repeat(64);},
    (e:any)=>{e.command.script+='\nreturn null;';},
    (e:any)=>{e.command.phase='update-apply';e.command.readOnly=false;},
  ]){
    const f=await fixture(t);await f.poll();await f.poll();await f.poll();f.advanceReader();
    f.transport().retryObservation(f.id);
    const dir=path.join(f.repo,'private/source-native-updates',f.id,'events');
    const file=path.join(dir,readdirSync(dir).sort().at(-1)!);
    const event=JSON.parse(readFileSync(file,'utf8'));tamper(event);writeFileSync(file,JSON.stringify(event));
    assert.throws(()=>f.jobs().get(f.id),/reader-dispatch-invalid/);
  }
});
