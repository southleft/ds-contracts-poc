import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,writeFileSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {reactInputFilesUnchanged} from './react-input-files.js';
import {reactHelperObservationUnchanged,reactHelperObservationsUnchanged,type ReactHelperObservation} from './react-helper-observation.js';
test('overlapping input inventories retain conflicts, fresh reads and canonical-path checks',t=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'react-input-files-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'source.js'),other=path.join(root,'other.js'),link=path.join(root,'link.js');
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 writeFileSync(file,'original');writeFileSync(other,'original');symlinkSync(file,link);
 const pin={[file]:hash('original')},second={[other]:hash('original')};
 assert.equal(reactInputFilesUnchanged([pin,pin,second]),true);
 assert.equal(reactInputFilesUnchanged([pin,{[file]:hash('changed')}]),false);
 assert.equal(reactInputFilesUnchanged([{[file]:hash('changed')},pin]),false);
 writeFileSync(file,'changed');assert.equal(reactInputFilesUnchanged([pin,pin,second]),false,'no cross-call cache');
 writeFileSync(file,'original');assert.equal(reactInputFilesUnchanged([pin,pin,second]),true);
 assert.equal(reactInputFilesUnchanged([{[link]:hash('original')}]),false,'symlink paths are not canonical witnesses');
 unlinkSync(file);symlinkSync(other,file);assert.equal(reactInputFilesUnchanged([pin]),false,'replacement by same-byte symlink refuses');
 unlinkSync(file);assert.equal(reactInputFilesUnchanged([pin]),false,'missing input refuses');
});

test('batch freshness retains metadata authority, conflicting pins and reads after each call',t=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'react-observation-batch-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'source.js');writeFileSync(file,'original');
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 const observed={status:'observed',inputs:{[file]:hash('original')},evidence:{},runtime:{status:'observed'}} as ReactHelperObservation;
 assert.equal(reactHelperObservationsUnchanged([observed,structuredClone(observed)]),true);
 for(const alter of [
  (r:any)=>{delete r.inputs;},(r:any)=>{r.inputs={};},
  (r:any)=>{delete r.evidence;},(r:any)=>{delete r.runtime;},
  (r:any)=>{r.runtime.status='refused';},
 ]){
  const invalid=structuredClone(observed);alter(invalid);
  assert.equal(reactHelperObservationsUnchanged([observed,invalid]),false);
  assert.equal(reactHelperObservationUnchanged(invalid),false);
 }
 const conflict=structuredClone(observed);conflict.inputs![file]=hash('changed');
 assert.equal(reactHelperObservationsUnchanged([observed,conflict]),false);
 assert.equal(reactHelperObservationsUnchanged([conflict,observed]),false);
 writeFileSync(file,'changed');assert.equal(reactHelperObservationsUnchanged([observed,observed]),false);
 writeFileSync(file,'original');assert.equal(reactHelperObservationsUnchanged([observed,observed]),true);
 const refused={status:'refused'} as ReactHelperObservation;
 assert.equal(reactHelperObservationsUnchanged([refused]),true,'unobserved records may have no inputs, as before');
 assert.equal(reactHelperObservationsUnchanged([{...refused,inputs:{[file]:hash('changed')}}]),false,'present inputs remain checked even for refusals');
});
