/** Versioned witnesses for a reviewed original-source repair. Frozen source
 * witnesses remain unchanged. A successor is usable only after its exact
 * source transaction completed and its complete caller proof still replays.
 * This store is host-only; it does not authorize or perform source writes. */
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,linkSync,lstatSync,mkdirSync,openSync,readFileSync,
  readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {loadReactCohort,reactCohortWitnessSnapshot as snapshot,type ReactCohort} from './react-cohort.js';
import {reactReferenceUnchanged} from './react-reference.js';
import {reactWitnessesMatch} from './react-reference-profiles.js';
import {repairCallerProfile,verifyRepairCallerFrames,type RepairCallerFrame} from './react-source-repair-cohort.js';
import {reactSourceRepairInputRevision,type ReactSourceRepairInput,type ReactSourceRepairPreview} from './react-source-repair-preview.js';
import {createSourceFileTransactions,type SourceFileTransaction} from './react-source-file-transaction.js';
import type {stageReactUtilitySourceEdit} from './react-source-repair-stage.js';

type Stage=Awaited<ReturnType<typeof stageReactUtilitySourceEdit>>;
type Proof={recorded:ReactSourceRepairInput['recorded'];variants:ReactSourceRepairInput['variants'];
  plan:ReactSourceRepairInput['plan'];index:number;previewDirectory:string;resultRevision:string;stageFile:string;files:Record<string,string>};
interface Selection {
  version:1;sourceRoot:string;parent?:string;referenceId:string;cohortRevision:string;
  referenceFiles:Record<string,string>;inputs:Record<string,string>;
  edits:Array<{file:string;beforeSha256:string;afterSha256:string}>;proof:Proof;
}
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(reason:string):never=>{throw Error('react-source-witness-'+reason);};
const hash=/^[a-f0-9]{64}$/;
function fileBytes(file:string){
  if(!lstatSync(file).isFile()||realpathSync(file)!==file)fail('evidence-path-invalid');
  return readFileSync(file);
}
function matches(files:Readonly<Record<string,string>>){
  try{return Object.entries(files).every(([file,expected])=>sha(fileBytes(file))===expected);}catch{return false;}
}
function syncedWrite(file:string,bytes:string){
  const parent=path.dirname(file);mkdirSync(parent,{recursive:true,mode:0o700});
  if(realpathSync(parent)!==parent)fail('directory-invalid');
  if(existsSync(file)){if(fileBytes(file).toString()!==bytes)fail('record-conflict');return;}
  const pending=path.join(parent,'.pending');mkdirSync(pending,{recursive:true,mode:0o700});
  if(realpathSync(pending)!==pending)fail('directory-invalid');
  const temporary=path.join(pending,randomUUID()),fd=openSync(temporary,'wx',0o600);
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  const sync=(dir:string)=>{const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
  sync(pending);
  try{linkSync(temporary,file);}catch(error){
    if((error as NodeJS.ErrnoException).code!=='EEXIST'||fileBytes(file).toString()!==bytes)throw error;
  }
  sync(parent);
}

export function createReactSourceWitnessSuccessions(repo:string){
  repo=realpathSync(repo);
  const root=path.join(repo,'private/react-source-witness-successions'),transactions=createSourceFileTransactions(repo);
  const selectionPath=(id:string)=>{if(!hash.test(id))fail('identity-invalid');return path.join(root,'selections',id+'.json');};
  const registry=(sourceRoot:string)=>path.join(root,'roots',sha(sourceRoot));
  const privateFile=(file:string)=>{
    if(!file.startsWith(path.join(repo,'private')+path.sep)||realpathSync(file)!==file)fail('evidence-path-invalid');return file;
  };
  function read(id:string){
    const bytes=fileBytes(selectionPath(id)),selection=JSON.parse(bytes.toString()) as Selection;
    if(revisionOf(selection)!=='sha256:'+id||selection.version!==1)fail('selection-changed');
    return selection;
  }
  function proof(selection:Selection,cohort:ReactCohort){
    const p=selection.proof,caseIds=cohort.cases.map(c=>c.id),frames:RepairCallerFrame[][]=[[],[]];
    const {revision,...plan}=p.plan;if(revision!==revisionOf(plan))fail('plan-changed');
    if(!caseIds.length||caseIds.length>64||!same(caseIds,[...new Set(caseIds)])||
      caseIds.some(id=>! /^[a-z][a-z-]{0,79}$/.test(id)))fail('case-inventory-invalid');
    for(const [file,expected] of Object.entries(p.files)){
      privateFile(file);if(!hash.test(expected)||sha(fileBytes(file))!==expected)fail('proof-changed');
    }
    const readProof=(file:string)=>{
      if(!Object.hasOwn(p.files,file))fail('proof-incomplete');return JSON.parse(fileBytes(file).toString());
    };
    const preview=readProof(path.join(p.previewDirectory,'result.json')) as ReactSourceRepairPreview;
    if(revisionOf(preview)!==p.resultRevision||preview.phase!=='reviewable'||preview.selected!==p.index||preview.planRevision!==p.plan.revision||
      preview.candidates.filter(c=>c.status==='verified').length!==1||!preview.candidates.some(c=>c.index===p.index&&c.status==='verified'))fail('preview-unqualified');
    const row=preview.candidates.find(c=>c.index===p.index)!,candidate=p.plan.candidates[p.index],stage=readProof(p.stageFile) as Stage;
    if(!candidate||!row.css||row.module!==candidate.source.module||row.before!==candidate.edit.before||row.after!==candidate.edit.after||
      stage.sourceRoot!==selection.sourceRoot||!same(stage.originalFiles,selection.inputs)||
      Object.entries(selection.referenceFiles).some(([file,hash])=>selection.inputs[file]!==hash)||
      stage.source.file!==path.resolve(selection.sourceRoot,candidate.source.module)||
      stage.source.beforeSha256!==candidate.beforeSha256||stage.source.afterSha256!==candidate.afterSha256||!same(stage.source.edit,candidate.edit)||
      stage.css.file!==path.resolve(selection.sourceRoot,row.css.file)||stage.css.beforeSha256!==row.css.beforeSha256||stage.css.afterSha256!==row.css.afterSha256||
      !same(selection.edits,[stage.source,stage.css].map(({file,beforeSha256,afterSha256})=>({file,beforeSha256,afterSha256})).filter(e=>e.beforeSha256!==e.afterSha256)))fail('preview-stage-mismatch');
    for(const id of caseIds)for(const side of [0,1]){
      const dir=path.join(p.previewDirectory,'callers',id,side?'candidate':'original');
      const frame=readProof(path.join(dir,'frame.json')) as RepairCallerFrame;
      if(p.files[path.join(dir,'initial.png')]!==frame.captured.sourcePngSha256)fail('image-unpinned');
      // Every finite-state image must remain pinned, not only the initial image.
      for(const finite of frame.finite){
        if(!/^[A-Za-z0-9_-]+$/.test(finite.instanceId))fail('instance-invalid');
        for(const [id,snapshot] of Object.entries(finite.snapshots)){
          if(!/^\d+$/.test(id)||p.files[path.join(dir,finite.instanceId,id+'.png')]!==snapshot.image)fail('state-image-unpinned');
        }
      }
      frames[side].push(frame);
    }
    const checked=verifyRepairCallerFrames(caseIds,frames[0],frames[1],p.recorded,p.variants,p.plan,p.index);
    if(!same(checked,preview.cohort))fail('caller-result-changed');
    return cohort.cases.map((c,i)=>repairCallerProfile(cohort.profile(c.id),frames[0][i],p.recorded,p.variants,p.plan,p.index));
  }
  function derive(id:string,selection:Selection,cohort:ReactCohort,evidenceFiles:Record<string,string>):ReactCohort{
    if(revisionOf(snapshot(cohort))!==selection.cohortRevision||
      (cohort.witnessSuccession?.revision.slice(7))!==selection.parent)fail('original-witness-changed');
    const profiles=proof(selection,cohort),witnessFiles={...cohort.witnessFiles},referenceFiles={...selection.referenceFiles};
    const candidate=selection.proof.plan.candidates[selection.proof.index];
    if(!candidate||selection.edits.length<1||selection.edits.length>2||
      new Set(selection.edits.map(e=>e.file)).size!==selection.edits.length)fail('edit-inventory-invalid');
    const sourceFile=path.resolve(selection.sourceRoot,candidate.source.module);
    if(!selection.edits.some(e=>e.file===sourceFile&&e.beforeSha256===candidate.beforeSha256&&e.afterSha256===candidate.afterSha256))fail('source-transition-invalid');
    for(const edit of selection.edits){
      if(!edit.file.startsWith(selection.sourceRoot+path.sep)||
        path.relative(selection.sourceRoot,edit.file).split(path.sep).includes('node_modules')||
        (edit.file!==sourceFile&&!edit.file.endsWith('.css'))||
        !hash.test(edit.afterSha256)||edit.afterSha256===edit.beforeSha256||
        selection.inputs[edit.file]!==edit.beforeSha256||referenceFiles[edit.file]!==edit.beforeSha256)fail('edit-transition-invalid');
      const relative=path.relative(selection.sourceRoot,edit.file);
      if(witnessFiles[relative]!==edit.beforeSha256)fail('edited-file-unwitnessed');
      witnessFiles[relative]=edit.afterSha256;referenceFiles[edit.file]=edit.afterSha256;
    }
    const result:ReactCohort={...cohort,witnessFiles,profile(caseId){const index=cohort.cases.findIndex(c=>c.id===caseId);
      if(index<0)fail('case-unknown');return structuredClone(profiles[index]);}};
    result.witnessSuccession={revision:'sha256:'+id,cohortRevision:revisionOf(snapshot(result)),
      evidenceFiles:{...evidenceFiles,...selection.proof.files,[selectionPath(id)]:sha(fileBytes(selectionPath(id)))},referenceFiles};
    return result;
  }
  function checkTransaction(selection:Selection,id:string,transaction:SourceFileTransaction){
    if(transaction.sourceRoot!==selection.sourceRoot||transaction.selectionRevision!=='sha256:'+id||
      !same(transaction.inputs,selection.inputs)||!same(transaction.edits.map(({mode:_mode,...edit})=>edit),selection.edits))fail('transaction-mismatch');
  }
  return {
    prepare(input:ReactSourceRepairInput,stage:Stage,previewDirectory:string,resultRevision:string){
      if(!reactReferenceUnchanged(input.reference)||!reactWitnessesMatch(input.reference)||
        input.reference.sourceRoot!==stage.sourceRoot||!matches(stage.originalFiles))fail('original-source-changed');
      privateFile(path.join(previewDirectory,'result.json'));
      const state=JSON.parse(fileBytes(path.join(previewDirectory,'result.json')).toString()) as ReactSourceRepairPreview;
      const started=JSON.parse(fileBytes(path.join(previewDirectory,'started.json')).toString());
      const index=state.selected;
      if(started.signature!==reactSourceRepairInputRevision(input)||index===undefined||revisionOf(state)!==resultRevision)return fail('preview-input-changed');
      const candidate=input.plan.candidates[index];
      if(!candidate||stage.source.file!==path.resolve(stage.sourceRoot,candidate.source.module)||
        stage.css.file!==path.resolve(stage.sourceRoot,input.recipe.output)||
        stage.source.beforeSha256!==candidate.beforeSha256||stage.source.afterSha256!==candidate.afterSha256||
        !same(stage.source.edit,candidate.edit))fail('stage-mismatch');
      const files:Record<string,string>={};
      const pin=(file:string)=>{privateFile(file);files[file]=sha(fileBytes(file));};
      pin(path.join(previewDirectory,'started.json'));pin(path.join(previewDirectory,'result.json'));
      pin(path.join(path.dirname(stage.workspace),'stage.json'));
      if(!same(JSON.parse(fileBytes(path.join(path.dirname(stage.workspace),'stage.json')).toString()),stage))fail('stage-changed');
      for(const c of input.reference.cohort.cases)for(const side of ['original','candidate']){
        const dir=path.join(previewDirectory,'callers',c.id,side),frameFile=path.join(dir,'frame.json');pin(frameFile);pin(path.join(dir,'initial.png'));
        const frame=JSON.parse(fileBytes(frameFile).toString()) as RepairCallerFrame;
        for(const finite of frame.finite)for(const id of Object.keys(finite.snapshots)){
          if(!/^[A-Za-z0-9_-]+$/.test(finite.instanceId)||!/^\d+$/.test(id))fail('state-identity-invalid');
          pin(path.join(dir,finite.instanceId,id+'.png'));
        }
      }
      const edits=[stage.source,stage.css].map(({file,beforeSha256,afterSha256})=>({file,beforeSha256,afterSha256})).filter(e=>e.beforeSha256!==e.afterSha256);
      const selection:Selection={version:1,sourceRoot:stage.sourceRoot,
        ...(input.reference.cohort.witnessSuccession?{parent:input.reference.cohort.witnessSuccession.revision.slice(7)}:{}),
        referenceId:input.reference.id,cohortRevision:revisionOf(snapshot(input.reference.cohort)),
        referenceFiles:input.reference.files,inputs:stage.originalFiles,edits,
        proof:{recorded:input.recorded,variants:input.variants,plan:input.plan,index,previewDirectory,resultRevision,
          stageFile:path.join(path.dirname(stage.workspace),'stage.json'),files}};
      const id=revisionOf(selection).slice(7);
      // Replay before publishing. derive also needs the record's immutable bytes.
      proof(selection,input.reference.cohort);
      syncedWrite(selectionPath(id),JSON.stringify(selection)+'\n');
      derive(id,selection,input.reference.cohort,{});
      return {id,revision:'sha256:'+id,edits:structuredClone(edits),inputs:structuredClone(stage.originalFiles)};
    },
    link(id:string,transactionId:string){
      const selection=read(id),history=transactions.history(transactionId);checkTransaction(selection,id,history.transaction);
      syncedWrite(path.join(registry(selection.sourceRoot),transactionId+'.json'),JSON.stringify({version:1,selectionId:id,transactionId})+'\n');
    },
    load(sourceRoot:string,base?:ReactCohort):ReactCohort{
      sourceRoot=realpathSync(sourceRoot);base??=loadReactCohort(sourceRoot);const dir=registry(sourceRoot);
      if(!existsSync(dir))return base;
      if(realpathSync(dir)!==dir)fail('directory-invalid');
      const names=readdirSync(dir).filter(n=>n!=='.pending').sort();if(names.length>128)fail('history-limit');
      const records=new Map<string,{selection:Selection;active:boolean;files:Record<string,string>}>();
      for(const name of names){
        if(!/^[a-f0-9]{64}\.json$/.test(name))fail('registry-invalid');
        const file=path.join(dir,name),bytes=fileBytes(file),link=JSON.parse(bytes.toString());
        if(link.version!==1||link.transactionId+'.json'!==name)fail('registry-invalid');
        const selection=read(link.selectionId),history=transactions.history(link.transactionId);
        if(selection.sourceRoot!==sourceRoot)fail('root-mismatch');checkTransaction(selection,link.selectionId,history.transaction);
        const last=history.events.at(-1);
        if(last&&last.kind!=='complete')fail('transaction-recovery-required');
        if(records.has(link.selectionId))fail('ambiguous-transaction');
        const files:Record<string,string>={[file]:sha(bytes)};
        const transactionDir=path.join(repo,'private/react-source-file-transactions',link.transactionId);
        for(const relative of ['transaction.json',...history.events.map(e=>'events/'+String(e.sequence).padStart(8,'0')+'.json'),
          ...history.transaction.edits.flatMap((_e,i)=>['files/'+i+'/before','files/'+i+'/after'])]){
          const file=path.join(transactionDir,relative);files[file]=sha(fileBytes(file));
        }
        records.set(link.selectionId,{selection,active:last?.kind==='complete'&&last.direction==='apply',files});
      }
      const built=new Map<string,ReactCohort>(),building=new Set<string>();
      const build=(id:string):ReactCohort=>{
        if(built.has(id))return built.get(id)!;
        if(building.has(id))fail('history-cycle');const record=records.get(id);if(!record)return fail('parent-unavailable');
        building.add(id);const parent=record.selection.parent?build(record.selection.parent):base;
        const cohort=derive(id,record.selection,parent,{...parent.witnessSuccession?.evidenceFiles,...record.files});
        building.delete(id);built.set(id,cohort);return cohort;
      };
      const candidates:string[]=[];
      for(const [id,record] of records){
        build(id);
        const after={...record.selection.inputs};for(const edit of record.selection.edits)after[edit.file]=edit.afterSha256;
        if(record.active&&matches(after))candidates.push(id);
      }
      const ancestor=(older:string,newer:string):boolean=>{
        let current=records.get(newer)?.selection.parent;
        while(current){if(current===older)return true;current=records.get(current)?.selection.parent;}return false;
      };
      const tips=candidates.filter(id=>!candidates.some(other=>id!==other&&ancestor(id,other)));
      if(tips.length>1)fail('ambiguous-current-witness');
      if(!tips.length)return base;
      return built.get(tips[0])!;
    },
  };
}
