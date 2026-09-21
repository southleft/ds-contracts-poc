import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {revisionOf} from '../core/contract-provenance.js';
import {createReactSourceWitnessSuccessions} from './react-source-witness-succession.js';
import {createSourceFileTransactions} from './react-source-file-transaction.js';
import {buildReactReference,createReactReferenceService,reactReferenceUnchanged} from './react-reference.js';
import {reactWitnessesMatch} from './react-reference-profiles.js';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';
import {reactSourceRepairInputRevision,type ReactSourceRepairInput} from './react-source-repair-preview.js';
import {verifyRepairCallerFrames,type RepairCallerFrame} from './react-source-repair-cohort.js';
import {loadReactCohort,type ReactCohort} from './react-cohort.js';
import type {stageReactUtilitySourceEdit} from './react-source-repair-stage.js';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const bytes=(value:unknown)=>JSON.stringify(value)+'\n';

async function fixture(t:test.TestContext,declared=false){
  const repo=realpathSync(mkdtempSync(path.join(tmpdir(),'react-source-witness-')));t.after(()=>rmSync(repo,{recursive:true,force:true}));
  const root=path.join(repo,'original');
  const put=(relative:string,value:string)=>{const file=path.join(root,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,value);return file;};
  put('package.json','{"type":"module"}');put('package-lock.json','{}');put('tsconfig.json','{}');
  put('src/index.css','body{}');put('capture-input.css','body{}');
  put('node_modules/react/package.json','{"type":"module","exports":{"./jsx-runtime":"./runtime.js"}}');
  put('node_modules/react/runtime.js','export const jsx=(tag,props)=>({tag,props});export const jsxs=jsx;');
  const original='export function Toggle() { return <button className="disabled:opacity-50"/>; }';
  const sourceFile=put('toggle.tsx',original),cssFile=put('output.css',':root{--fixture:1}.disabled{opacity:0.5}');
  let base:ReactCohort={declared:false,source:'test originals',theme:'Light',cases:[{id:'toggle',subject:'Toggle',label:'Toggle'}],
    entry:'import "./output.css";import {Toggle} from "./toggle";window.fixture=Toggle;',negativeCaseIds:['toggle'],
    witnessFiles:{'toggle.tsx':sha(original),'output.css':sha(readFileSync(cssFile))},
    profile:()=>({id:'toggle',provenance:'frozen witness',path:['button'],fontFamily:'Inter',requiredTokens:{},requiredStyles:{opacity:'0.5',width:'16px'}})};
  if(declared){
    put('node_modules/react/package.json','{"type":"module","exports":{".":"./index.js","./jsx-runtime":"./runtime.js"}}');
    put('node_modules/react/index.js','export default {createElement(){}};');
    put('node_modules/react-dom/package.json','{"type":"module","exports":{"./client":"./client.js"}}');
    put('node_modules/react-dom/client.js','export const createRoot=()=>({render(){}});');
    put('ds-contracts.react.json',bytes({version:1,source:'declared test originals',theme:'Light',fontFamily:'Inter',sideEffectImports:['./output.css'],requiredTokens:{'--fixture':'1'},
      witnessFiles:base.witnessFiles,cases:[{id:'toggle',subject:'Toggle',label:'Toggle',negativeControl:true,mount:{module:'./toggle',export:'Toggle'},
        witness:{path:['button'],requiredStyles:{opacity:'0.5',width:'16px'}}}]}));
    base=loadReactCohort(root);
  }
  let number=0;
  const store=()=>createReactSourceWitnessSuccessions(repo);
  async function preview(cohort=base,beforeValue=.5,afterValue=.6){
    const reference=await buildReactReference(root,cohort),text=readFileSync(sourceFile,'utf8');
    const source={module:'toggle.tsx',exportName:'Toggle',sourceSha256:sha(text),span:{start:0,end:text.length}};
    const candidate=proposeReactOpacityUtilityEdits(text,source,{before:beforeValue,after:afterValue})[0];
    const tree={tag:'button',classes:[candidate.edit.before],style:{opacity:String(beforeValue),width:'16px'},pseudo:{},nodes:[]};
    const ownership={version:1,rendererVersions:['19.2.4'],components:[{id:'instance-0',source,props:{disabled:true},roots:['']}],nodes:[{path:'',tag:'button',nearestComponent:'instance-0'}],problems:[]};
    const fonts={version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]};
    const snapshot={tree,image:sha('before'),ownership,styleOrigin:{version:1,roots:[]},bounds:{width:16,height:16},descendantSizes:{version:1,nodes:[]},fonts,
      svg:{version:1,treeRevision:revisionOf(tree),status:'observed',rows:[],problems:[]}};
    const recorded={observation:{instanceId:'instance-0',source,axes:[],heldProps:{disabled:true},planned:1,problems:[],rows:[{id:'0',changes:{disabled:{kind:'set',value:true}},status:'observed',restored:true}]},snapshots:{'0':snapshot}} as unknown as ReactSourceRepairInput['recorded'];
    const rawPlan={version:1,qualification:'unverified-original-source-repair',operationId:'fixture',parentId:'fixture',proposalId:sha('proposal'),
      journalRevision:revisionOf('journal'),attemptId:'read',baselineRevision:revisionOf('baseline'),observedRevision:revisionOf('observed'),
      changes:[{nodeId:'1:1',variant:'disabled=true',before:beforeValue,after:afterValue}],candidates:[candidate]};
    const plan={...rawPlan,revision:revisionOf(rawPlan)} as ReactSourceRepairInput['plan'],variants=[{observation:'0',variant:'disabled=true'}];
    const before={caseId:'toggle',captured:{status:'captured',tree,sourcePngSha256:sha('before')},ownership,fonts,finite:[{instanceId:'instance-0',...recorded}],
      behavior:[{instanceId:'instance-0',observation:{version:1,scope:'source-checkbox-interactions',status:'observed',role:'checkbox',problems:[],rows:['associated-label','space'].map(action=>({action,before:'false',after:'false',expected:'false',passed:true}))}}]} as unknown as RepairCallerFrame;
    const after=structuredClone(before);after.captured.tree!.classes=[candidate.edit.after];after.captured.tree!.style.opacity=String(afterValue);
    after.captured.sourcePngSha256=sha('after');after.ownership.components[0].source.sourceSha256=candidate.afterSha256;after.fonts.treeRevision=revisionOf(after.captured.tree);
    const changed=after.finite[0];changed.observation.source.sourceSha256=candidate.afterSha256;
    changed.snapshots['0'].tree.classes=[candidate.edit.after];changed.snapshots['0'].tree.style.opacity=String(afterValue);changed.snapshots['0'].image=sha('after');
    changed.snapshots['0'].ownership.components[0].source.sourceSha256=candidate.afterSha256;
    changed.snapshots['0'].fonts!.treeRevision=revisionOf(changed.snapshots['0'].tree);changed.snapshots['0'].svg.treeRevision=revisionOf(changed.snapshots['0'].tree);
    const input={reference,program:{files:reference.files},recorded,caseId:'toggle',variants,plan,recipe:{input:'capture-input.css',output:'output.css'}} as ReactSourceRepairInput;
    const dir=path.join(repo,'private','preview-'+(++number)),workspace=path.join(dir,'stage/workspace');mkdirSync(workspace,{recursive:true});
    const afterCss=':root{--fixture:1}.disabled{opacity:'+afterValue+'}';writeFileSync(path.join(workspace,'output.css'),afterCss);
    const stage={version:1,qualification:'unverified-staged-source',sourceRoot:root,workspace,originalFiles:reference.files,
      source:{file:sourceFile,beforeSha256:candidate.beforeSha256,afterSha256:candidate.afterSha256,edit:candidate.edit},
      css:{file:cssFile,beforeSha256:sha(readFileSync(cssFile)),afterSha256:sha(afterCss)},limitations:[]} as Awaited<ReturnType<typeof stageReactUtilitySourceEdit>>;
    writeFileSync(path.join(dir,'stage/stage.json'),bytes(stage));
    writeFileSync(path.join(dir,'started.json'),bytes({signature:reactSourceRepairInputRevision(input)}));
    const result={phase:'reviewable',selected:0,planRevision:plan.revision,candidates:[{index:0,status:'verified',module:candidate.source.module,
      before:candidate.edit.before,after:candidate.edit.after,css:{...stage.css,file:'output.css'}}],
      cohort:verifyRepairCallerFrames(['toggle'],[before],[after],recorded,variants,plan,0)};
    writeFileSync(path.join(dir,'result.json'),bytes(result));
    for(const [side,frame,png] of [['original',before,'before'],['candidate',after,'after']] as const){
      const folder=path.join(dir,'callers/toggle',side);mkdirSync(path.join(folder,'instance-0'),{recursive:true});
      writeFileSync(path.join(folder,'frame.json'),bytes(frame));writeFileSync(path.join(folder,'initial.png'),png);
      writeFileSync(path.join(folder,'instance-0/0.png'),png);
    }
    const resultRevision=revisionOf(result),prepare=()=>store().prepare(input,stage,dir,resultRevision);
    const link=()=>{
      const selection=prepare(),transactions=createSourceFileTransactions(repo),transaction=transactions.prepare({sourceRoot:root,selectionRevision:selection.revision,
        inputs:selection.inputs,edits:selection.edits.map(e=>({file:e.file,beforeSha256:e.beforeSha256,after:Buffer.from(e.file===sourceFile?candidate.result:afterCss)}))});
      store().link(selection.id,transaction.id);return {selection,transactions,transaction};
    };
    return {reference,input,stage,dir,prepare,link,before,after,result};
  }
  return {repo,root,base,store,preview,sourceFile,cssFile};
}

test('only a completed exact transaction installs revised witnesses, including after restart',async t=>{
  const f=await fixture(t),p=await f.preview(),original=structuredClone(f.base.profile('toggle'));
  const {selection,transactions,transaction}=p.link();
  assert.equal(f.store().load(f.root,f.base),f.base,'preparation is not permission or successful application');
  transactions.run(transaction.id,'apply',()=>{});
  const current=f.store().load(f.root,f.base);
  assert.equal(current.witnessSuccession?.revision,selection.revision);
  assert.equal(current.profile('toggle').requiredStyles?.opacity,'0.6');assert.deepEqual(f.base.profile('toggle'),original);
  assert.deepEqual({...current.profile('toggle'),requiredStyles:original.requiredStyles},original);
  const reference=await buildReactReference(f.root,current);assert.equal(reactWitnessesMatch(reference),true);
  assert.equal(reactWitnessesMatch(await buildReactReference(f.root,f.base)),false);
  assert.notEqual(reference.id,(await buildReactReference(f.root,{...current,witnessSuccession:undefined})).id,'witness provenance enters reference identity');
  assert.equal(reference.id,(await buildReactReference(f.root,f.store().load(f.root,f.base))).id);
  const history=transactions.history(transaction.id);history.transaction.edits[0].afterSha256='tampered';
  assert.notEqual(transactions.history(transaction.id).transaction.edits[0].afterSha256,'tampered');
  const events=readdirSync(path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events'));
  assert.equal(transactions.run(transaction.id,'apply',()=>{}).wrote,false);
  assert.deepEqual(readdirSync(path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events')),events);
});

test('rollback restores the frozen witnesses without rewriting either witness record',async t=>{
  const f=await fixture(t),p=await f.preview(),{selection,transactions,transaction}=p.link();
  const record=path.join(f.repo,'private/react-source-witness-successions/selections',selection.id+'.json'),before=readFileSync(record);
  transactions.run(transaction.id,'apply',()=>{});transactions.run(transaction.id,'rollback',()=>{});
  assert.equal(f.store().load(f.root,f.base),f.base);assert.deepEqual(readFileSync(record),before);
  assert.equal((await buildReactReference(f.root,f.base)).id,p.reference.id,'historical identity remains exact');
});

test('a reviewed reverse edit creates an authenticated chain and repeated values select its descendant',async t=>{
  const f=await fixture(t),p=await f.preview(),first=p.link();first.transactions.run(first.transaction.id,'apply',()=>{});
  const forward=f.store().load(f.root,f.base),reverse=await f.preview(forward,.6,.5),second=reverse.link();second.transactions.run(second.transaction.id,'apply',()=>{});
  const restored=f.store().load(f.root,f.base);assert.equal(restored.profile('toggle').requiredStyles?.opacity,'0.5');
  assert.equal(restored.witnessSuccession?.revision,second.selection.revision);
  const again=await f.preview(restored,.5,.6),third=again.link();third.transactions.run(third.transaction.id,'apply',()=>{});
  assert.equal(f.store().load(f.root,f.base).witnessSuccession?.revision,third.selection.revision);
  assert.notEqual(first.selection.id,third.selection.id);
});

test('all interrupted transaction boundaries refuse witnesses until resumed or rolled back',async t=>{
  for(const [point,index] of [['journal-apply',undefined],['moved',0],['installed',0],['installed',1]] as const){
    const f=await fixture(t),p=await f.preview(),{transaction}=p.link();
    const interrupted=createSourceFileTransactions(f.repo,{checkpoint:(at,i)=>{if(at===point&&i===index)throw Error('lost process');}});
    assert.throws(()=>interrupted.run(transaction.id,'apply',()=>{}),/lost process/);
    assert.throws(()=>f.store().load(f.root,f.base),/transaction-recovery-required/);
    createSourceFileTransactions(f.repo).run(transaction.id,'apply',()=>{});
    assert.equal(f.store().load(f.root,f.base).profile('toggle').requiredStyles?.opacity,'0.6');
  }
});

test('altered observations, styles, pixels, stages, witnesses and transaction selection cannot be admitted',async t=>{
  for(const mutate of ['caller','pixel','finite-pixel','stage','stage-pins','consistent-tree','profile','source','signature','transaction'] as const){
    const f=await fixture(t),p=await f.preview();
    if(mutate==='transaction'){
      const selected=p.prepare(),wrong=createSourceFileTransactions(f.repo).prepare({sourceRoot:f.root,selectionRevision:revisionOf('wrong'),inputs:selected.inputs,
        edits:[{file:f.sourceFile,beforeSha256:sha(readFileSync(f.sourceFile)),after:Buffer.from('different output')}]});
      assert.throws(()=>f.store().link(selected.id,wrong.id),/transaction-mismatch/);continue;
    }
    if(mutate==='caller'){p.after.captured.tree!.style.width='17px';writeFileSync(path.join(p.dir,'callers/toggle/candidate/frame.json'),bytes(p.after));}
    if(mutate==='pixel')writeFileSync(path.join(p.dir,'callers/toggle/candidate/initial.png'),'wrong pixels');
    if(mutate==='finite-pixel')writeFileSync(path.join(p.dir,'callers/toggle/candidate/instance-0/0.png'),'wrong pixels');
    if(mutate==='stage')writeFileSync(path.join(p.dir,'stage/stage.json'),'{}');
    if(mutate==='stage-pins'){p.stage.css.afterSha256=sha('unobserved CSS');writeFileSync(path.join(p.dir,'stage/stage.json'),bytes(p.stage));}
    if(mutate==='consistent-tree'){
      for(const [side,frame] of [['original',p.before],['candidate',p.after]] as const){frame.captured.tree!.style.width='17px';
        writeFileSync(path.join(p.dir,'callers/toggle',side,'frame.json'),bytes(frame));}
    }
    if(mutate==='profile')f.base.profile=()=>({id:'toggle',provenance:'changed',path:['button'],fontFamily:'different font',requiredTokens:{},requiredStyles:{opacity:'0.5'}});
    if(mutate==='source')writeFileSync(f.sourceFile,'owner edit');
    if(mutate==='signature')writeFileSync(path.join(p.dir,'started.json'),bytes({signature:revisionOf('different plan')}));
    assert.throws(p.prepare,/react-source-/);
  }
});

test('tampered retained proof or journal invalidates restart and already built references',async t=>{
  for(const target of ['frame','image','selection','journal','witness'] as const){
    const f=await fixture(t),p=await f.preview(),{selection,transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
    const current=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,current);
    if(target==='witness'){
      const old=f.base.profile;f.base.profile=id=>({...old(id),fontFamily:'different font'});
      assert.throws(()=>f.store().load(f.root,f.base),/original-witness-changed/);continue;
    }
    const files={frame:path.join(p.dir,'callers/toggle/original/frame.json'),image:path.join(p.dir,'callers/toggle/candidate/instance-0/0.png'),
      selection:path.join(f.repo,'private/react-source-witness-successions/selections',selection.id+'.json'),
      journal:path.join(f.repo,'private/react-source-file-transactions',transaction.id,'events/00000000.json')};
    writeFileSync(files[target],'{}');assert.equal(reactReferenceUnchanged(reference),false);assert.throws(()=>f.store().load(f.root,f.base));
  }
});

test('new source input inventory and unrelated file drift cannot inherit the approved witness',async t=>{
  const f=await fixture(t),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const current=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,current);
  writeFileSync(path.join(f.root,'capture-input.css'),'changed input');
  assert.equal(reactReferenceUnchanged(reference),false);assert.equal(f.store().load(f.root,f.base),f.base);
  await assert.rejects(buildReactReference(f.root,current),/react-reference-source-changed/);
});

test('the normal source-loading HTTP action reopens a completed successor and names damaged evidence',async t=>{
  const f=await fixture(t,true),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const expected=await buildReactReference(f.root,f.store().load(f.root));
  const handle=createReactReferenceService(f.repo,f.root),server=createServer((req,res)=>{void handle(req,res,(req.url??'').slice(1));});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const url='http://127.0.0.1:'+(server.address() as {port:number}).port+'/react';
  const response=await fetch(url,{method:'POST'});assert.equal(response.status,200);
  assert.equal((await response.json()).id,expected.id);
  const persisted=JSON.parse(readFileSync(path.join(f.repo,'private/react-source-references',expected.id,'provenance.json'),'utf8'));
  assert.equal(persisted.witnessSuccession,expected.cohort.witnessSuccession!.revision);
  writeFileSync(path.join(p.dir,'callers/toggle/candidate/initial.png'),'changed');
  const refused=await fetch(url,{method:'POST'});assert.equal(refused.status,409);
  assert.equal((await refused.json()).reason,'react-source-witness-proof-changed');
});

test('changing a loaded successor profile invalidates its reference without changing source files',async t=>{
  const f=await fixture(t),p=await f.preview(),{transactions,transaction}=p.link();transactions.run(transaction.id,'apply',()=>{});
  const cohort=f.store().load(f.root,f.base),reference=await buildReactReference(f.root,cohort),original=cohort.profile;
  cohort.profile=id=>({...original(id),fontFamily:'different font'});
  assert.equal(reactReferenceUnchanged(reference),false);
});

test('matching bytes from unrelated completed histories refuse instead of selecting the newest record',async t=>{
  const f=await fixture(t),source=readFileSync(f.sourceFile),css=readFileSync(f.cssFile);
  const first=(await f.preview()).link();first.transactions.run(first.transaction.id,'apply',()=>{});
  // An external editor restores the old bytes without using transaction rollback.
  writeFileSync(f.sourceFile,source);writeFileSync(f.cssFile,css);
  const second=(await f.preview()).link();second.transactions.run(second.transaction.id,'apply',()=>{});
  assert.throws(()=>f.store().load(f.root,f.base),/ambiguous-current-witness/);
});
