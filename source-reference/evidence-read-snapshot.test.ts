import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {withEvidenceReadSnapshot,evidenceReadOnce,readSnapshotValue,assertOutsideEvidenceSnapshot,type EvidenceReadEntry} from './evidence-read-snapshot.js';
import {inventoryEvidence,evidenceUnchanged} from './react-validation-evidence.js';

test('one synchronous response reuses isolated values and clears them on return, error and async refusal',()=>{
 let calls=0;const read=()=>evidenceReadOnce('test',{pin:'a'},()=>({n:++calls}));
 withEvidenceReadSnapshot(()=>{
  const first=read();first.n=999;
  assert.equal(withEvidenceReadSnapshot(read).n,1);assert.equal(calls,1);
  assert.equal(evidenceReadOnce('test',{pin:'b'},()=>({n:++calls})).n,2);
  assert.throws(assertOutsideEvidenceSnapshot,/write-during/);
 });
 assert.equal(read().n,3);assert.equal(read().n,4);
 assert.throws(()=>withEvidenceReadSnapshot(()=>{read();throw Error('read failed');}),/read failed/);
 assert.equal(read().n,6);
 assert.throws(()=>withEvidenceReadSnapshot(()=>Promise.resolve(read())),/async-evidence/);
 assert.equal(read().n,8);assert.doesNotThrow(assertOutsideEvidenceSnapshot);
});

test('archive validation keeps the captured inventory within a display and detects edits on the next read',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'evidence-snapshot-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'original.json');writeFileSync(file,'original');const seal=inventoryEvidence(dir);
 withEvidenceReadSnapshot(()=>{
  assert.equal(evidenceUnchanged(dir,seal),true);writeFileSync(file,'changed');
  assert.equal(evidenceUnchanged(dir,seal),true);
  assert.equal(evidenceUnchanged(dir,{...seal,'unknown.json':'f'.repeat(64)}),false);
 });
 assert.equal(evidenceUnchanged(dir,seal),false);
 assert.equal(withEvidenceReadSnapshot(()=>evidenceUnchanged(dir,seal)),false);
});

test('plain refusals are isolated and reused only within one synchronous display',()=>{
 let calls=0;
 const read=()=>evidenceReadOnce('refusal',{pin:'a'},()=>{calls++;throw Error('native-update-input-changed');});
 withEvidenceReadSnapshot(()=>{
  try {read();assert.fail('expected refusal');} catch(error) {(error as Error).message='changed by caller';}
  assert.throws(()=>withEvidenceReadSnapshot(read),{name:'Error',message:'native-update-input-changed'});
  assert.equal(calls,1);
  assert.throws(()=>evidenceReadOnce('refusal',{pin:'b'},()=>{calls++;throw Error('different-input');}),/different-input/);
  assert.equal(calls,2);
  assert.throws(assertOutsideEvidenceSnapshot,/write-during/);
 });
 assert.throws(read,/native-update-input-changed/);assert.equal(calls,3);
 assert.throws(()=>withEvidenceReadSnapshot(read),/native-update-input-changed/);assert.equal(calls,4);
 assert.throws(()=>withEvidenceReadSnapshot(read),/native-update-input-changed/);assert.equal(calls,5);
 assert.doesNotThrow(assertOutsideEvidenceSnapshot);
});

test('custom errors and thrown values keep their original behavior without failure reuse',()=>{
 const errors=[new TypeError('typed'),Object.assign(Error('custom'),{code:'custom-code'}),
  Error('caused',{cause:'detail'}),new Proxy(Error('proxy'),{}),
  {message:'not an Error'},'plain string'];
 for(const error of errors) {
  let calls=0;
  withEvidenceReadSnapshot(()=>{
   for(let i=0;i<2;i++) {
    try {evidenceReadOnce('custom','same',()=>{calls++;throw error;});assert.fail('expected refusal');}
    catch(actual) {assert.equal(actual,error);}
   }
  });
  assert.equal(calls,2);
 }
});

test('failed display reads do not hide repaired evidence in the next request',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'evidence-refusal-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'original.json');writeFileSync(file,'original');const seal=inventoryEvidence(dir);
 writeFileSync(file,'changed');
 const read=()=>evidenceReadOnce('validated-archive',dir,()=>{
  if(!evidenceUnchanged(dir,seal))throw Error('source-evidence-changed');return 'verified';
 });
 withEvidenceReadSnapshot(()=>{
  assert.throws(read,/source-evidence-changed/);writeFileSync(file,'original');
  assert.throws(read,/source-evidence-changed/);
 });
 assert.equal(read(),'verified');
 writeFileSync(file,'changed');assert.throws(read,/source-evidence-changed/);
});

test('display copies preserve structured values, aliasing, sparse arrays and special numbers',()=>{
 const shared={n:1},cycle:any={};cycle.self=cycle;
 const values:unknown[]=[JSON.parse('{"__proto__":{"n":1},"constructor":2}'),
  {text:'\ud800💡',nested:[null,true,2.5]},undefined,1n,-0,NaN,Infinity,
  {a:undefined,b:-0},Array(3),Object.assign([1,2],{named:'retained'}),
  new Date(0),new Map([['a',{n:1}]]),new Set([1,2]),new Uint8Array([1,2]),
  {a:shared,b:shared},cycle,{toJSON:'ordinary property'},Error('kept error')];
 for(const value of values){
  const map=new Map<string,EvidenceReadEntry>();let reads=0;
  const read=()=>readSnapshotValue(map,'same',()=>{reads++;return value;});
  read();const second=read(),third=read();
  assert.deepEqual(second,structuredClone(value));assert.deepEqual(third,second);
  assert.equal(reads,1);
  if(second&&typeof second==='object'){assert.notEqual(second,value);assert.notEqual(third,second);}
  if(value===cycle)assert.equal((second as any).self,second);
  if(value&&typeof value==='object'&&'a' in value&&value.a===shared){
   assert.equal((second as any).a,(second as any).b);
   (second as any).a.n=99;assert.equal((read() as any).a.n,1);
  }
 }
});

test('JSON display copies remain isolated and do not repeat getters or hide clone refusals',()=>{
 const map=new Map<string,EvidenceReadEntry>(),value={nested:{n:1}};
 const read=()=>readSnapshotValue(map,'json',()=>value);
 read().nested.n=2;const second=read();assert.equal(second.nested.n,1);
 second.nested.n=3;assert.equal(read().nested.n,1);
 let getters=0;
 const accessor=Object.defineProperty({},'nested',{enumerable:true,get(){getters++;return {n:1};}});
 readSnapshotValue(map,'getter',()=>accessor);readSnapshotValue(map,'getter',()=>null);
 assert.equal(getters,1);
 for(const uncloneable of [()=>{},Symbol('x'),{bad:()=>{}},new Proxy({n:1},{})]){
  let reads=0;const scope=new Map<string,EvidenceReadEntry>();
  for(let i=0;i<2;i++)assert.throws(()=>readSnapshotValue(scope,'bad',()=>{reads++;return uncloneable;}));
  assert.equal(reads,2);
 }
});
