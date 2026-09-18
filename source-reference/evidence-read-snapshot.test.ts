import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {withEvidenceReadSnapshot,evidenceReadOnce,assertOutsideEvidenceSnapshot} from './evidence-read-snapshot.js';
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
