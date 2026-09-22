import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePollNeedsRefresh, nativeProgressRoutes } from './native-inspection-poll.js';

const connection = {paired:true, started:true, finished:false};
const root = {operation:{id:'root-id', phase:'awaiting-native-result'}, connection};
const update = {id:'proposal-id', operation:{phase:'awaiting-native-result'}, connection};
const settled = {...root, connection:{...connection, finished:true}, operation:{id:'root-id', phase:'component-structure-observed'}};

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
