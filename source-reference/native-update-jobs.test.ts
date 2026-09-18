import {PNG} from 'pngjs';
import {nativeDefaultFillUpdateFixture} from '../core/native-contract-default-fill-update-test-fixture.js';
import {nativeBackgroundUpdateFixture} from '../core/native-contract-background-update-test-fixture.js';
import {withEvidenceReadSnapshot} from './evidence-read-snapshot.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { emitNativeContractReadbackScript } from '../core/native-source-observation.js';
import { nativeRootSizeUpdateFixture } from '../core/native-contract-size-update-test-fixture.js';
import { nativeSvgUpdateFixture } from '../core/native-contract-svg-update-test-fixture.js';
import { nativeUpdateFixture } from '../core/native-contract-update-test-fixture.js';
import { createNativeUpdatePlans } from './native-update-plans.js';
import { createNativeUpdateJobs } from './native-update-jobs.js';
import { createNativeOperationTransport } from './native-operation-transport.js';

async function fixture(t:test.TestContext, make: typeof nativeUpdateFixture | typeof nativeRootSizeUpdateFixture | typeof nativeSvgUpdateFixture | typeof nativeBackgroundUpdateFixture | typeof nativeDefaultFillUpdateFixture = nativeUpdateFixture, legacyFraming = false) {
  const f=await make(),repo=mkdtempSync(path.join(tmpdir(),'native-update-delivery-'));
  t.after(()=>rmSync(repo,{recursive:true,force:true}));
  let stale=false,lose='',failStorage=false,readerRevision=0,derivations=0;
  const readers={readback:(...args:Parameters<typeof emitNativeContractReadbackScript>) =>
    (readerRevision ? '// Current independent reader '+readerRevision+'\n' : '') + emitNativeContractReadbackScript(args[0], args[1], legacyFraming ? false : args[2])};
  const plans=createNativeUpdatePlans(repo,()=>{derivations++;if(stale) throw Error('source changed');return {parentJournalRevision:'a'.repeat(64),input:f.input};});
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
    if(url.endsWith('/begin')) return {ok:true,json:async()=>transport.begin(id,supplied,payload.attemptId)};
    if(url.endsWith('/claim')) {
      response=transport.claim(id,supplied,payload.fileKey,payload.replaceReadbackAttemptId,payload.resolveWriteAttemptId,payload.protocol);
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
    enableFraming:()=>{legacyFraming=false;},derivations:()=>derivations,advanceReader:()=>{readerRevision++;},stale:()=>{stale=true;},lose:(where:string)=>{lose=where;},failStorage:()=>{failStorage=true;}};
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


test('the bundled companion delivers the SVG stroke correction with a separate verified export',async t=>{
  const f=await fixture(t,nativeSvgUpdateFixture),ids=f.figma.root.findAll(()=>true).map((n:any)=>n.id);
  for(const expected of ['update-preflight-observed','update-applied','update-verified']) {
    await f.poll();assert.equal(f.jobs().get(f.id).phase,expected,JSON.stringify(f.messages.slice(-3)));f.restart();
  }
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  assert.equal(f.figma.root.findAll((n:any)=>n.type==='VECTOR')[0].strokeWeight,Math.fround(14/12));
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  assert.ok(f.jobs().verifiedForParent(f.proposal.parentId));
});


test('historical image lookup verifies its journal and hash without rederiving current source',async t=>{
  const f=await fixture(t);await f.poll();await f.poll();await f.poll();
  const hash=f.jobs().get(f.id).imageObservation!.images[0].sha256;
  const expected=f.jobs().image(f.id,hash),count=f.derivations();
  f.stale(); // Historical images remain visible; stale source cannot authorize a write.
  assert.deepEqual(f.jobs().imageForProposal(f.proposal.parentId,f.proposal.id,hash),expected);
  assert.equal(f.derivations(),count);
  assert.throws(()=>f.jobs().imageForProposal(f.proposal.parentId,f.proposal.id,'f'.repeat(64)),/image-unavailable/);
  assert.throws(()=>f.jobs().imageForProposal('10000000-0000-4000-8000-000000000099',f.proposal.id,hash));
  assert.throws(()=>f.jobs().imageForProposal(f.proposal.parentId,'f'.repeat(64),hash));
  const dir=path.join(f.repo,'private/source-native-updates',f.id,'events');
  const file=path.join(dir,readdirSync(dir).sort().at(-1)!);
  const event=JSON.parse(readFileSync(file,'utf8'));event.envelope.scriptSha256='0'.repeat(64);writeFileSync(file,JSON.stringify(event));
  assert.throws(()=>f.jobs().imageForProposal(f.proposal.parentId,f.proposal.id,hash),/result-correlation-invalid/);
  assert.equal(f.derivations(),count);
});


test('a display evidence snapshot cannot prepare, dispatch, accept or redeliver an update',async t=>{
 const f=await fixture(t),before=readdirSync(path.join(f.repo,'private/source-native-updates',f.id,'events'));
 withEvidenceReadSnapshot(()=>{
  assert.ok(f.jobs().get(f.id));
  for(const mutate of [()=>f.plans.prepare(f.proposal.parentId),()=>f.jobs().prepare(f.proposal.parentId,f.proposal.id),
   ()=>f.jobs().dispatch(f.id,'update-apply'),()=>f.jobs().accept(f.id,{} as any),()=>f.jobs().retryObservation(f.id),()=>f.jobs().pendingCommand(f.id)])
    assert.throws(mutate,/write-during-evidence-read-snapshot/);
 });
 assert.deepEqual(readdirSync(path.join(f.repo,'private/source-native-updates',f.id,'events')),before);
 await f.poll();assert.equal(f.jobs().get(f.id).phase,'update-preflight-observed');
});


test('the companion migrates a background once and independent readback adopts only the new paint allocation',async t=>{
 const f=await fixture(t,nativeBackgroundUpdateFixture),before=f.input.before.creation.nodes.map((n:any)=>n.id);
 await f.poll();assert.equal(f.jobs().get(f.id).phase,'update-preflight-observed');
 f.lose('result');await f.poll();f.restart();await f.poll();await f.poll();
 assert.equal(f.jobs().get(f.id).phase,'update-verified',JSON.stringify(f.messages.slice(-3)));
 assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
 const effective=f.jobs().verifiedForParent(f.proposal.parentId)!;
 assert.equal(effective.input.creation.nodes.length,before.length+1);
 assert.ok(before.every((id:string)=>effective.input.creation.nodes.some((n:any)=>n.id===id)));
 f.transport().retryObservation(f.id);await f.poll();
 assert.equal(f.jobs().get(f.id).phase,'update-verified');assert.equal(f.nodes[0].children.length,2);
});


test('display responses share verified update reads but delivery reauthenticates after the scope closes', async t => {
  const f = await fixture(t);
  await f.poll(); await f.poll(); await f.poll();
  const before = f.derivations();
  withEvidenceReadSnapshot(() => {
    assert.equal(f.jobs().get(f.id).sourceCurrent, true);
    const first = f.jobs().verifiedForParent(f.proposal.parentId)!;
    const original = structuredClone(first);
    first.input.creation.variants[0].id = 'tampered';
    const calls = f.derivations();
    assert.deepEqual(f.jobs().verifiedForParent(f.proposal.parentId), original);
    assert.equal(f.jobs().get(f.id).sourceCurrent, true);
    assert.equal(f.derivations(), calls);
    assert.throws(() => f.jobs().pendingCommand(f.id), /write-during-evidence-read-snapshot/);
    assert.throws(() => f.jobs().dispatch(f.id, 'update-readback'), /write-during-evidence-read-snapshot/);
  });
  assert.ok(f.derivations() > before);
  f.stale();
  assert.equal(f.jobs().get(f.id).sourceCurrent, false);
  assert.throws(() => f.jobs().verifiedForParent(f.proposal.parentId), /source changed/);
  withEvidenceReadSnapshot(() => assert.equal(f.jobs().get(f.id).sourceCurrent, false));
});

 test('default-fill repair uses the companion journal and independent readback without duplicating nodes', async t => {
  const f = await fixture(t, nativeDefaultFillUpdateFixture), ids = f.figma.root.findAll(()=>true).map((n:any)=>n.id);
  for (const phase of ['update-preflight-observed','update-applied','update-verified']) {
    await f.poll(); assert.equal(f.jobs().get(f.id).phase,phase,JSON.stringify(f.messages.slice(-2)));f.restart();
  }
  assert.deepEqual(f.figma.root.findAll(()=>true).map((n:any)=>n.id),ids);
  assert.ok(f.nodes.every((n:any)=>n.fills.length===0));
  f.transport().retryObservation(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
});


test('read-only framing enrichment preserves current structural evidence and never repeats the update', async t => {
  const f = await fixture(t, nativeUpdateFixture, true);
  const png = new PNG({width:20,height:18}); png.data.fill(255);
  for (const node of f.nodes) {
    Object.defineProperty(node, 'absoluteBoundingBox', {value:{x:40,y:20,width:16,height:16},configurable:true});
    Object.defineProperty(node, 'absoluteRenderBounds', {value:{x:38,y:19,width:20,height:18},configurable:true});
    node.exportAsync = async()=>PNG.sync.write(png);
  }
  await f.poll();await f.poll();await f.poll();
  assert.equal(f.jobs().get(f.id).sourceCurrent,true);
  assert.equal(f.jobs().get(f.id).imageObservation!.images[0].layoutOffset,undefined);
  f.enableFraming();f.restart();
  assert.equal(f.jobs().get(f.id).sourceCurrent,true,'adding image geometry does not invalidate the old structural proof');
  f.transport().retryObservation(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');
  assert.deepEqual(f.jobs().get(f.id).imageObservation!.images[0].layoutOffset,{x:2,y:1});
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  const originalExport=f.nodes[0].exportAsync;
  f.nodes[0].exportAsync=async()=>{const bytes=await originalExport();f.nodes[0].absoluteRenderBounds.x++;return bytes;};
  f.transport().retryObservation(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-recovery-required','moving export bounds during rasterization refuse observation');
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
});

// The live case of 2026-09-18: the app died after journaling the write and
// before the companion received it.
test('the actual companion settles a write it never received through a canvas read, and only an operator sends another',async t=>{
  const f=await fixture(t);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-preflight-observed');
  f.lose('claim');await f.poll();
  assert.equal(f.jobs().get(f.id).pendingPhase,'update-apply');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.5),'the write never ran');
  f.restart();await f.poll();
  assert.equal(f.jobs().get(f.id).pendingPhase,'update-apply','reconnecting does not resend it');
  f.transport().resolveWriteOutcome(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-write-untouched');
  for(let i=0;i<3;i++)await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-write-untouched','polling alone never sends another write');
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,1);
  f.transport().rearmWrite(f.id);for(let i=0;i<3;i++)await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-verified');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.25));
  assert.equal(f.delivered.filter(c=>!c.readOnly).length,2,'one dead write, one operator-approved write');
});

test('the actual companion that died holding a write marker takes only the read that settles that write',async t=>{
  const f=await fixture(t);await f.poll();f.lose('claim');await f.poll();
  const write=f.jobs().pendingCommand(f.id)!;
  // The plugin had saved its "received" marker and then died before executing.
  f.storage.set('ds_native_receipt:'+f.id,{stage:'received',identity:{operationId:f.id,phase:write.phase,attemptId:write.attemptId}});
  f.restart();await f.poll();
  assert.equal(f.messages.at(-1).status,'unknown','it runs nothing while the app has not dispatched a settling read');
  assert.equal(f.jobs().get(f.id).pendingPhase,'update-apply');
  f.transport().resolveWriteOutcome(f.id);await f.poll();
  assert.equal(f.jobs().get(f.id).phase,'update-write-untouched');
  assert.equal(f.storage.has('ds_native_receipt:'+f.id),false,'the settled marker is released');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.5));
});

test('the actual companion does not execute a write the app refuses to let it begin',async t=>{
  const f=await fixture(t);await f.poll();
  // The app has already dispatched a read to judge this write; a held-up holder asks too late.
  const refuse=f.transport().begin;(f.transport() as any).begin=()=>{throw Error('native-update-write-begin-refused');};
  await f.poll();
  assert.equal(f.messages.at(-1).status,'refused');
  assert.ok(f.nodes.every((n:any)=>n.opacity===0.5),'nothing executed');
  assert.equal(f.storage.has('ds_native_receipt:'+f.id),false,'and no marker was left behind');
  (f.transport() as any).begin=refuse;
});
