import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,renameSync,symlinkSync,unlinkSync,statSync,utimesSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createNativeJournalReplayMemo} from './native-journal-replay-memo.js';
import {createNativeOperationJobs} from './native-operation-jobs.js';
import {nativeFixturePrepare,nativeFixtureRequest,nativeFixtureHost} from './native-operation-test-fixture.js';
function fixture(t:test.TestContext){
 const root=mkdtempSync(path.join(tmpdir(),'native-replay-memo-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 let stale=false,calls=0;
 const options={prepare:(...args:Parameters<typeof nativeFixturePrepare>)=>{calls++;if(stale)throw Error('source changed');return nativeFixturePrepare(...args);}};
 const jobs=createNativeOperationJobs(root,options),id=jobs.prepare(nativeFixtureRequest).id;
 const dir=path.join(root,'private/source-native-app/operations',id);
 return {root,jobs,id,dir,fresh:()=>createNativeOperationJobs(root,options),stale:()=>{stale=true;},calls:()=>calls};
}
test('cache returns detached exact values and bounded/failed puts evict old values',()=>{
 const memo=createNativeJournalReplayMemo<any>({storedBytes:1024,decodedBytes:4096});
 const value={nested:{x:1},missing:undefined,negativeZero:-0,values:new Set([1,2])};memo.put('a',value);
 value.nested.x=9;const first=memo.get('a');assert.equal(first.nested.x,1);assert.ok(Object.is(first.negativeZero,-0));assert.ok(Object.hasOwn(first,'missing'));
 first.nested.x=5;assert.equal(memo.get('a').nested.x,1);
 assert.equal(memo.get('b'),undefined);memo.put('b',{huge:'x'.repeat(5000)});assert.equal(memo.get('a'),undefined);assert.equal(memo.get('b'),undefined);
 memo.put('a',value);memo.clear();assert.equal(memo.get('a'),undefined);
 memo.put('a',value);memo.put('b',{fn:()=>0});assert.equal(memo.get('a'),undefined);
});
test('fresh byte identity governs repeated journal reads and caller mutation stays isolated',t=>{
 const f=fixture(t);f.jobs.dispatch(f.id,'token-create');const first=f.jobs.deliveryState(f.id),command=f.jobs.pendingCommand(f.id)!;command.script='changed by caller';
 assert.deepEqual(f.jobs.deliveryState(f.id),first);assert.deepEqual(f.jobs.pendingCommand(f.id),f.fresh().pendingCommand(f.id));
});
test('same-length journal mutation with restored mtime refuses even after a warm hit',t=>{
 const f=fixture(t);f.jobs.dispatch(f.id,'token-create');f.jobs.deliveryState(f.id);const file=path.join(f.dir,'events/00000000.json'),saved=readFileSync(file),stat=statSync(file);
 const changed=saved.toString().replace('"version": 1','"version": 2');assert.equal(Buffer.byteLength(changed),saved.length);assert.notEqual(changed,saved.toString());writeFileSync(file,changed);utimesSync(file,stat.atime,stat.mtime);
 assert.throws(()=>f.jobs.deliveryState(f.id),/journal-chain-invalid/);writeFileSync(file,saved);assert.deepEqual(f.jobs.deliveryState(f.id),f.fresh().deliveryState(f.id));
});
test('missing, extra, renamed and symlink journal files cannot reuse a warm snapshot',t=>{
 const f=fixture(t);f.jobs.dispatch(f.id,'token-create');const file=path.join(f.dir,'events/00000000.json');const saved=readFileSync(file);
 f.jobs.deliveryState(f.id);unlinkSync(file);assert.throws(()=>f.jobs.deliveryState(f.id),/creation-journal-incomplete/);writeFileSync(file,saved);
 f.jobs.deliveryState(f.id);const extra=path.join(f.dir,'events/00000001.json');writeFileSync(extra,saved);assert.throws(()=>f.jobs.deliveryState(f.id),/journal-chain-invalid/);unlinkSync(extra);
 f.jobs.deliveryState(f.id);const renamed=path.join(f.dir,'events/not-an-event.json');renameSync(file,renamed);assert.throws(()=>f.jobs.deliveryState(f.id),/journal-sequence-invalid/);renameSync(renamed,file);
 f.jobs.deliveryState(f.id);const actual=path.join(f.root,'event-copy.json');writeFileSync(actual,saved);unlinkSync(file);symlinkSync(actual,file);assert.throws(()=>f.jobs.deliveryState(f.id),/artifact-refused/);unlinkSync(file);writeFileSync(file,saved);
 assert.deepEqual(f.jobs.deliveryState(f.id),f.fresh().deliveryState(f.id));
});
test('source authentication remains fresh outside the journal memo',t=>{
 const f=fixture(t);f.jobs.get(f.id);const before=f.calls();f.jobs.get(f.id);assert.ok(f.calls()>before);f.stale();assert.equal(f.jobs.get(f.id).sourceCurrent,false);assert.throws(()=>f.jobs.dispatch(f.id,'token-create'),/source changed/);
});
test('new result and next pending command match an uncached manager',async t=>{
 const f=fixture(t),host=nativeFixtureHost();const command=f.jobs.dispatch(f.id,'token-create');f.jobs.deliveryState(f.id);const result=await host.run(command);f.jobs.acceptDelivery(f.id,result);
 assert.deepEqual(f.jobs.deliveryState(f.id),f.fresh().deliveryState(f.id));f.jobs.dispatch(f.id,'token-readback');assert.deepEqual(f.jobs.pendingCommand(f.id),f.fresh().pendingCommand(f.id));
});
