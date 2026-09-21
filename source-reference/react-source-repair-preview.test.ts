import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {createReactSourceRepairPreviews,type ReactSourceRepairInput} from './react-source-repair-preview.js';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';
import type {RepairStateObservation} from './react-source-repair-observation.js';
const sha=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const referenceId='a'.repeat(64),parentId='00000000-0000-4000-8000-000000000001',proposalId='b'.repeat(64);

function fixture(t:test.TestContext) {
  const repo=realpathSync(mkdtempSync(path.join(tmpdir(),'source-repair-preview-')));t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const root=path.join(repo,'original'),staged=path.join(repo,'staged');mkdirSync(root);mkdirSync(staged);
  const text='function Control() { return <button className="disabled:opacity-50"/>; }',file=path.join(root,'control.tsx');writeFileSync(file,text);
  const source={module:'control.tsx',exportName:'Control',sourceSha256:sha(text),span:{start:0,end:text.length}};
  const candidate=proposeReactOpacityUtilityEdits(text,source,{before:.5,after:.6})[0];
  writeFileSync(path.join(root,'output.css'),'old CSS');writeFileSync(path.join(staged,'output.css'),'new CSS');
  const tree={tag:'button',classes:['disabled:opacity-50'],style:{opacity:'0.5',width:'16px'},pseudo:{},nodes:[]};
  const row={id:'0',changes:{disabled:{kind:'set',value:true}},status:'observed',restored:true};
  const snapshot={tree,image:sha('before'),ownership:{version:1,rendererVersions:['19.2.4'],components:[{id:'instance-0',source,props:{disabled:true},roots:['']}],nodes:[{path:'',tag:'button',nearestComponent:'instance-0'}],problems:[]},
    styleOrigin:{version:1,roots:[]},bounds:{width:16,height:16},descendantSizes:{version:1,nodes:[]},
    fonts:{version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]},svg:{version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]}};
  const before={observation:{instanceId:'instance-0',source,axes:[],heldProps:{disabled:true},planned:1,problems:[],rows:[row]},snapshots:{'0':snapshot}} as unknown as RepairStateObservation;
  const after=structuredClone(before);after.observation.source.sourceSha256=candidate.afterSha256;
  after.snapshots['0'].tree.classes=[candidate.edit.after];after.snapshots['0'].tree.style.opacity='0.6';after.snapshots['0'].image=sha('after');
  after.snapshots['0'].ownership.components[0].source.sourceSha256=candidate.afterSha256;
  after.snapshots['0'].fonts!.treeRevision=revisionOf(after.snapshots['0'].tree);after.snapshots['0'].svg.treeRevision=revisionOf(after.snapshots['0'].tree);
  const input={reference:{id:referenceId,files:{[file]:sha(text)},sourceRoot:root,cohort:{declared:false}},program:{files:{[file]:sha(text)}},recorded:before,caseId:'control',
    variants:[{observation:'0',variant:'disabled=true'}],recipe:{input:'input.css',output:'output.css'},
    plan:{revision:'sha256:'+referenceId,changes:[{nodeId:'1:1',variant:'disabled=true',before:.5,after:.6}],candidates:[candidate]}} as unknown as ReactSourceRepairInput;
  let stageHook=()=>{},observeHook=async()=>{},cohortHook=async()=>{};
  const deps={
    async stage(){stageHook();return {workspace:staged,css:{file:path.join(root,'output.css'),beforeSha256:sha('old CSS'),afterSha256:sha('new CSS')}};},
    async observe(args:{dir:string}){await observeHook();const original=args.dir.endsWith('/original'),value=structuredClone(original?before:after);mkdirSync(path.join(args.dir,'states'),{recursive:true});writeFileSync(path.join(args.dir,'states/0.png'),original?'before':'after');return value;},
    async build(){return {...input.reference,sourceRoot:staged};},program(){return input.program;},
    async cohort({dir}:{dir:string}){await cohortHook();for(const [side,text] of [['original','before'],['candidate','after']]){mkdirSync(path.join(dir,'control',side),{recursive:true});writeFileSync(path.join(dir,'control',side,'initial.png'),text);}
      return {qualification:'configured-caller-effects-verified',cases:[{caseId:'control',changedRoots:1,beforeImage:sha('before'),afterImage:sha('after'),finite:[],interactions:[]}],limitations:['source-write-not-authorized']};},
  } as unknown as NonNullable<Parameters<typeof createReactSourceRepairPreviews>[2]>;
  let derivations=0;
  const store=createReactSourceRepairPreviews(repo,()=>{derivations++;return structuredClone(input);},deps);
  return {repo,root,file,text,input,store,derivations:()=>derivations,setStageHook(fn:()=>void){stageHook=fn;},setObserveHook(fn:()=>Promise<void>){observeHook=fn;},setCohortHook(fn:()=>Promise<void>){cohortHook=fn;}};
}

test('verified preview reuses its identity, pins images and never changes original bytes',async t=>{
  const f=fixture(t),job=f.store.start(referenceId,parentId,proposalId);await job.promise;
  assert.equal(job.state.phase,'reviewable');assert.equal(job.state.selected,0);
  assert.equal(f.store.start(referenceId,parentId,proposalId).state.id,job.state.id);
  assert.equal(readFileSync(f.file,'utf8'),f.text);
  assert.equal(f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','0',sha('after')).toString(),'after');
  assert.equal(f.store.image(referenceId,parentId,proposalId,job.state.id,'caller-candidate','control',sha('after')).toString(),'after');
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'caller-candidate','unknown',sha('after')),/image-mismatch/);
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'caller-original','control',sha('after')),/image-mismatch/);
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-1','0',sha('after')),/image-mismatch/);
  f.input.plan.revision='sha256:'+proposalId;
  assert.equal(f.store.read(referenceId,parentId,proposalId)?.current,false);
  // Evidence remains the same historical bytes; it does not make a changed
  // preview current. Every metadata read still checks the current source pair.
  const before=f.derivations();
  assert.equal(f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','0',sha('after')).toString(),'after');
  assert.equal(f.derivations(),before,'asset reads do not repeatedly derive the native correction chain');
  assert.equal(f.store.read(referenceId,parentId,proposalId)?.current,false);
  assert.equal(f.derivations(),before+1);
  assert.throws(()=>f.store.image(referenceId,parentId,'c'.repeat(64),job.state.id,'candidate-0','0',sha('after')),/image-unavailable/);
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','..',sha('after')),/image-unavailable/);
  writeFileSync(path.join(job.dir,'candidate-0/states/0.png'),'tampered');
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','0',sha('after')),/image-changed/);
  writeFileSync(path.join(job.dir,'callers/control/candidate/initial.png'),'tampered');
  assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'caller-candidate','control',sha('after')),/image-changed/);
});

test('concurrent previews, changed evidence and changed original source refuse',async t=>{
  for(const mode of ['evidence','source'] as const) {
    const f=fixture(t);let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
    f.setObserveHook(()=>barrier);const job=f.store.start(referenceId,parentId,proposalId);
    const before=f.derivations(),progress=f.store.read(referenceId,parentId,proposalId);
    assert.equal(progress?.phase,'running');assert.equal(progress?.current,false);
    assert.equal(f.derivations(),before,'progress-only reads cannot authorize a write and do not replay history');
    assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','0',sha('after')),/image-unavailable/);
    assert.equal(f.store.start(referenceId,parentId,proposalId).state.id,job.state.id);
    assert.throws(()=>f.store.start(referenceId,parentId,'c'.repeat(64)),/already-running/);
    if(mode==='evidence')f.input.plan.revision='changed';else writeFileSync(f.file,f.text+'\n');
    release();await job.promise;assert.equal(job.state.phase,'refused');assert.match(job.state.problems[0],/-changed$/);
  }
});

test('zero or multiple matching candidates do not produce an applicable selection',async t=>{
  for(const mode of ['none','multiple'] as const) {
    const f=fixture(t);
    if(mode==='none')f.setStageHook(()=>{throw Error('test-stage-refused');});
    else f.input.plan.candidates.push(structuredClone(f.input.plan.candidates[0]));
    const job=f.store.start(referenceId,parentId,proposalId);await job.promise;
    assert.equal(job.state.phase,'refused');assert.equal(job.state.selected,undefined);
    assert.match(job.state.problems[0],mode==='none'?/no-matching-effect/:/ambiguous-effect/);
  }
});

test('a matching local state set cannot bypass a failed caller check or evidence drift during it',async t=>{
  for(const reason of ['caller-failure','drift'] as const){
    const f=fixture(t);let called=0;
    f.setCohortHook(async()=>{called++;if(reason==='caller-failure')throw Error('react-source-repair-cohort-behavior-changed');f.input.plan.revision='changed';});
    const job=f.store.start(referenceId,parentId,proposalId);await job.promise;
    assert.equal(called,1);assert.equal(job.state.phase,'refused');assert.equal(job.state.selected,undefined);
    assert.match(job.state.problems[0],reason==='caller-failure'?/cohort-behavior-changed/:/evidence-changed/);
    assert.throws(()=>f.store.image(referenceId,parentId,proposalId,job.state.id,'candidate-0','0',sha('after')),/image-unavailable/);
  }
});
