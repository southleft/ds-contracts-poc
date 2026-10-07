import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,writeFileSync,rmSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {reactInputFilesUnchanged} from './react-input-files.js';
import {reactHelperObservationUnchanged,reactHelperObservationsUnchanged,type ReactHelperObservation} from './react-helper-observation.js';
import {reactJsxHelperObservationUnchanged,type ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
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

test('refused JSX diagnostic prefixes retain source freshness without observation authority',t=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'react-jsx-refused-inputs-')));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'source.js'),link=path.join(root,'link.js');writeFileSync(file,'original');symlinkSync(file,link);
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 // A wrapper can refuse after collecting callbacks/context diagnostics and before
 // sealing the evidence. Such data must not masquerade as a changed source file.
 const refused={version:1,acceptedContract:null,effectsVerified:false,qualification:'original-call-wrapper-state-only',status:'refused',reason:'context-consumer-function-values',
  inputs:{[file]:hash('original')},
  callbackCreations:{qualification:'observed-callback-helper-creation-only',effectsVerified:false,acceptedContract:null,rows:[]},
  contextConsumers:{qualification:'observed-context-consumer-body-only',effectsVerified:false,acceptedContract:null,rows:[]},
  renderGraph:{qualification:'observed-host-render-links-only',effectsVerified:false,acceptedContract:null,rows:[]}} as ReactJsxHelperObservation;
 assert.equal(reactJsxHelperObservationUnchanged(refused),true);
 assert.equal(refused.status,'refused');assert.equal(refused.effectsVerified,false);assert.equal(refused.acceptedContract,null);assert.equal(refused.reason,'context-consumer-function-values');
 const promoted={...refused,status:'observed'} as ReactJsxHelperObservation;
 assert.equal(reactJsxHelperObservationUnchanged(promoted),false,'unsealed prefix cannot be promoted to observation');
 writeFileSync(file,'changed');assert.equal(reactJsxHelperObservationUnchanged(refused),false);
 writeFileSync(file,'original');assert.equal(reactJsxHelperObservationUnchanged(refused),true,'freshness is reread on every call');
 assert.equal(reactJsxHelperObservationUnchanged({...refused,inputs:{[file]:hash('changed')}}),false);
 assert.equal(reactJsxHelperObservationUnchanged({...refused,inputs:{[link]:hash('original')}}),false,'noncanonical paths remain rejected');
 const sealed={...refused,status:'observed',runtime:{status:'observed'},lookup:{status:'verified'},evidence:{
  callbackCreationsSha256:hash(JSON.stringify(refused.callbackCreations,null,2)+'\n'),contextConsumersSha256:hash(JSON.stringify(refused.contextConsumers,null,2)+'\n'),renderGraphSha256:hash(JSON.stringify(refused.renderGraph,null,2)+'\n')
 }} as unknown as ReactJsxHelperObservation;
 assert.equal(reactJsxHelperObservationUnchanged(sealed),true,'sealed evidence retains its existing integrity contract');
 const changed=structuredClone(sealed);delete changed.contextConsumers;
 assert.equal(reactJsxHelperObservationUnchanged(changed),false,'sealed context tampering remains rejected');
 assert.equal(reactJsxHelperObservationUnchanged({...changed,status:'refused'}),false,'refused records with sealed evidence remain integrity checked');
 unlinkSync(file);assert.equal(reactJsxHelperObservationUnchanged(refused),false,'missing inputs still refuse');
});
