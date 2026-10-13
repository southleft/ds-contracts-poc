import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDeliveryPendingFromAcknowledgement, nativePollNeedsRefresh, nativeProgressRoutes, readCurrentNativeInspection } from './native-inspection-poll.js';

const connection = {paired:true, started:true, finished:false};
const root = {operation:{id:'root-id', phase:'awaiting-native-result'}, connection};
const update = {id:'proposal-id', operation:{phase:'awaiting-native-result'}, connection};
const settled = {...root, connection:{...connection, finished:true}, operation:{id:'root-id', phase:'component-structure-observed'}};

test('compact delivery acknowledgements cannot supply verification and retain bounded progress refresh', async () => {
  const pending=nativeDeliveryPendingFromAcknowledgement({operationId:'root-id',pending:true},'root-id');
  assert.equal(pending,true);
  const acknowledged={...settled,connection:{...settled.connection,started:true,finished:!pending}};
  const reads:string[]=[];
  assert.equal(await nativePollNeedsRefresh([acknowledged],async route=>{reads.push(route);return {pending:true};}),false);
  assert.deepEqual(reads,['native-operation/root-id/progress']);
  assert.equal(await nativePollNeedsRefresh([acknowledged],async()=>({pending:false})),true,'settlement fetches the verified listing');
  assert.equal(await nativePollNeedsRefresh([acknowledged],async()=>{assert.fail('full recovery refresh is due');},true),true,'pending delivery still has a bounded full refresh');
  assert.equal(nativeDeliveryPendingFromAcknowledgement({operationId:'root-id',pending:false},'root-id'),false);
  for(const value of [null,{},[],{operationId:'wrong-id',pending:true},{operationId:'root-id',pending:'true'},
    {operationId:'root-id',pending:true,sourceCurrent:true},{operationId:'root-id',pending:false,phase:'component-structure-observed'}])
    assert.throws(()=>nativeDeliveryPendingFromAcknowledgement(value,'root-id'),/acknowledgement unavailable/);
  assert.deepEqual(settled.operation,{id:'root-id',phase:'component-structure-observed'},'acknowledgement changes no verified operation fields');
});

test('a full read begun before an acknowledgement cannot replace its newer delivery state', async () => {
  let revision=0;
  let finishOld!:(value:typeof settled)=>void;
  const old=readCurrentNativeInspection(()=>new Promise<typeof settled>(resolve=>{finishOld=resolve;}),()=>revision);
  revision++;
  const pending={...settled,connection:{...connection,finished:false}};
  let displayed=pending;
  finishOld(settled);
  const obsolete=await old;
  if(obsolete && obsolete.revision===revision) displayed=obsolete.value;
  assert.equal(obsolete,undefined);
  assert.equal(displayed.connection.finished,false,'old full response cannot stop progress polling');
  assert.deepEqual(await readCurrentNativeInspection(async()=>settled,()=>revision),{revision,value:settled},'fresh full response may settle delivery');
  const between=readCurrentNativeInspection(async()=>settled,()=>revision);
  queueMicrotask(()=>revision++);
  const resumed=await between;
  assert(resumed,'helper finished before the queued acknowledgement');
  assert.notEqual(resumed.revision,revision,'publication must recheck the returned token after its await');
  if(resumed.revision===revision) displayed=resumed.value;
  assert.equal(displayed.connection.finished,false,'acknowledgement between helper return and caller continuation still wins');
  let rejectOld!:(error:Error)=>void;
  const oldFailure=readCurrentNativeInspection(()=>new Promise<never>((_,reject)=>{rejectOld=reject;}),()=>revision);
  revision++;rejectOld(Error('obsolete read failed'));
  assert.equal(await oldFailure,undefined,'obsolete read cannot replace the current error state');
  await assert.rejects(readCurrentNativeInspection(async()=>{throw Error('current read failed');},()=>revision),/current read failed/);
});

test('creation and update polls defer expensive verification only while every delivery is pending', async () => {
  const rows = [{...root, updates:[update]}], reads:string[]=[];
  const waiting = async (route:string) => {reads.push(route);return {pending:true};};
  assert.equal(await nativePollNeedsRefresh(rows, waiting), false);
  assert.deepEqual(reads, ['native-operation/root-id/progress', 'native-operation/root-id/update/proposal-id/progress']);
  assert.equal(await nativePollNeedsRefresh(rows, async route => ({pending:!route.includes('/update/')})), true);
  assert.equal(await nativePollNeedsRefresh(rows, async () => ({pending:false})), true);
});

test('refused or malformed progress cannot become a verified result or leave the display stuck', async () => {
  for (const body of [null, {}, {pending:'true'}, {phase:'update-verified',sourceCurrent:true}]) {
    assert.equal(await nativePollNeedsRefresh([root], async () => body), true);
  }
  assert.equal(await nativePollNeedsRefresh([root], async () => {throw Error('journal changed');}), true);
});

test('idle views do not poll and source inspection still refreshes its full evidence', async () => {
  const noRead = async () => {assert.fail('no progress request expected');};
  assert.equal(await nativePollNeedsRefresh([settled], noRead, true), false);
  assert.equal(await nativePollNeedsRefresh([{...settled,content:{phase:'running'}}], noRead), true);
  assert.equal(await nativePollNeedsRefresh([{...root,connection:{...connection,started:false}}], noRead), false);
});

test('transport completion races, read-only reinspection and interrupted commands retain refresh paths', async () => {
  const finished = {...connection,finished:true};
  assert.deepEqual(nativeProgressRoutes([{...settled,operation:{...settled.operation,pendingPhase:'component-readback'}}]), ['native-operation/root-id/progress']);
  const rows = [{...settled,updates:[{...update,connection:finished}]}];
  assert.equal(await nativePollNeedsRefresh(rows, async () => ({pending:false})), true, 'the older journal view must settle too');
  assert.equal(await nativePollNeedsRefresh([root], async () => {assert.fail('full recovery status is due');}, true), true);
});
