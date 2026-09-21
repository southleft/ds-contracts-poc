/** Host-selected source application and recovery. A preview is sealed before
 * requesting fresh native evidence. The synchronous file transaction owns the
 * write boundary; completion additionally requires normal source validation
 * and a second native read. No Figma write is issued by this controller. */
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,linkSync,lstatSync,mkdirSync,openSync,readFileSync,
  readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {createSourceFileTransactions,type SourceTransactionState} from './react-source-file-transaction.js';
import {createReactSourceWitnessSuccessions} from './react-source-witness-succession.js';
import type {createReactSourceRepairPreviews,ReactSourceRepairInput} from './react-source-repair-preview.js';
import type {createNativeUpdateJobs} from './native-update-jobs.js';
import type {NativeOperationCommand} from './native-operation-jobs.js';
import {buildReactReference,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {reactWitnessesMatch} from './react-reference-profiles.js';

type Selection=ReturnType<ReturnType<typeof createReactSourceRepairPreviews>['selection']>;
type Plan=ReactSourceRepairInput['plan'];
type NativeRead=NonNullable<ReturnType<ReturnType<typeof createNativeUpdateJobs>['sourceRepairReadEvidence']>>;
type Direction='apply'|'rollback';
export type SourceRepairValidation={referenceId:string;caseIds:string[];valid:number;files:Record<string,string>};
type Dependencies={
  requestRead:(plan:Plan)=>NativeOperationCommand;
  readNative:(plan:Plan,attemptId:string)=>NativeRead|null;
  validate:(reference:ReactReference,origin:string)=>Promise<SourceRepairValidation>;
  pause?:()=>Promise<void>;
};
type Manifest={version:1;transactionId:string;selectionId:string;referenceId:string;previewId:string;
  parentId:string;proposalId:string;operationId:string};
type Event={sequence:number;previous:string;direction:Direction;runId:string}&(
  {kind:'run'}|
  {kind:'native-request';stage:'before'|'after';attemptId:string;scriptSha256:string;fileKey:string}|
  {kind:'native-observed';stage:'before'|'after';receipt:NativeRead}|
  {kind:'source-written';wrote:boolean}|
  {kind:'validated';receipt:SourceRepairValidation}|
  {kind:'complete'}|{kind:'refused';reason:string});
type EventInput=Event extends infer E?E extends Event?Omit<E,'sequence'|'previous'>:never:never;
type RunInput=EventInput extends infer E?E extends EventInput?Omit<E,'runId'>:never:never;
export interface SourceRepairApplication {
  id:string;previewId:string;referenceId:string;operationId:string;
  phase:'prepared'|'reading-design'|'writing-source'|'validating-source'|'reading-result'|'applied'|'rolled-back'|'recovery-required'|'refused';
  running:boolean;direction?:Direction;problem?:string;transaction:SourceTransactionState['phase'];
  files:Array<{file:string;state:SourceTransactionState['files'][number]['state']}>;
  validation?:{referenceId:string;valid:number;total:number};
  canvasVerification:'not-recorded'|'recorded';
  /** Historical completion, distinct from whether current files still match. */
  recordedCompletion?:'applied'|'rolled-back';
}
const sha=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(reason:string):never=>{throw Error('react-source-apply-'+reason);};
const hash=/^[a-f0-9]{64}$/;
const allowedFiles=new Set(['T56aKuRnoay1L7CKAjSWRO','byMp6lt0Ij9b2QbkDGFwBh']);
const reason=(error:unknown)=>error instanceof Error&&/^[a-z][a-z0-9-]*(?::[A-Za-z0-9:;._-]+)?$/.test(error.message)?error.message:'react-source-apply-refused';
function bytes(file:string){if(!lstatSync(file).isFile()||realpathSync(file)!==file)fail('record-path-changed');return readFileSync(file);}
function write(file:string,value:unknown){
  const parent=path.dirname(file);mkdirSync(parent,{recursive:true,mode:0o700});
  if(realpathSync(parent)!==parent)fail('record-directory-changed');
  const text=JSON.stringify(value)+'\n';
  if(existsSync(file)){if(bytes(file).toString()!==text)fail('record-conflict');return;}
  const pending=path.join(parent,'.pending');mkdirSync(pending,{recursive:true,mode:0o700});
  if(realpathSync(pending)!==pending)fail('record-directory-changed');
  const temporary=path.join(pending,randomUUID()),fd=openSync(temporary,'wx',0o600);
  try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}
  const sync=(dir:string)=>{const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};sync(pending);
  try{linkSync(temporary,file);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST'||bytes(file).toString()!==text)throw error;}
  sync(parent);
}

export function createReactSourceRepairApplications(repo:string,sourceRoot:string,deps:Dependencies){
  repo=realpathSync(repo);
  // Source configuration can be unavailable before the user loads originals.
  const configuredRoot=()=>realpathSync(sourceRoot);
  const root=path.join(repo,'private/react-source-repair-applications');
  const transactions=createSourceFileTransactions(repo),witnesses=createReactSourceWitnessSuccessions(repo);
  const active=new Map<string,{state:SourceRepairApplication;promise:Promise<void>}>();
  let closed=false;
  const assertOpen=()=>{if(closed)fail('interrupted');};
  const directory=(id:string)=>{if(!hash.test(id))fail('identity-invalid');return path.join(root,id);};
  function load(id:string){
    const dir=directory(id),manifest=JSON.parse(bytes(path.join(dir,'application.json')).toString()) as Manifest;
    const reviewed=witnesses.review(id,configuredRoot()),selection=reviewed.selection,plan=selection.proof.plan;
    if(manifest.version!==1||manifest.transactionId!==id||manifest.selectionId!==reviewed.transaction.selectionRevision.slice(7)||
      manifest.referenceId!==selection.referenceId||manifest.parentId!==plan.parentId||manifest.proposalId!==plan.proposalId||
      manifest.operationId!==plan.operationId||manifest.previewId!==path.basename(selection.proof.previewDirectory))fail('manifest-changed');
    let previous=revisionOf(manifest),phase='prepared',direction:Direction|undefined,pending:Extract<Event,{kind:'native-request'}>|undefined;
    let validation:SourceRepairValidation|undefined,observed=false,runId:string|undefined;
    const events:Event[]=[];
    for(const [sequence,name] of readdirSync(path.join(dir,'events')).filter(n=>n!=='.pending').sort().entries()){
      if(name!==String(sequence).padStart(8,'0')+'.json')fail('journal-gap');
      const event=JSON.parse(bytes(path.join(dir,'events',name)).toString()) as Event;
      if(event.sequence!==sequence||event.previous!==previous||!['apply','rollback'].includes(event.direction)||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(event.runId))fail('journal-changed');
      if(event.kind==='run'){
        direction=event.direction;runId=event.runId;phase='started';pending=undefined;validation=undefined;observed=false;
      }else if(event.direction!==direction||event.runId!==runId)fail('journal-run-changed');
      else if(event.kind==='native-request'){
        if((event.stage==='before'?phase!=='started':phase!=='validated')||!allowedFiles.has(event.fileKey))fail('journal-order-invalid');
        pending=event;phase='reading-'+event.stage;
      }else if(event.kind==='native-observed'){
        const requested=pending??fail('journal-read-mismatch');
        if(requested.stage!==event.stage||event.receipt.attemptId!==requested.attemptId||event.receipt.scriptSha256!==requested.scriptSha256||
          event.receipt.fileKey!==requested.fileKey)fail('journal-read-mismatch');
        checkNative(plan,event.receipt,requested);phase=event.stage==='before'?'ready-to-write':'observed';observed=event.stage==='after';pending=undefined;
      }else if(event.kind==='source-written'){
        if(phase!=='ready-to-write')fail('journal-order-invalid');phase='written';
      }else if(event.kind==='validated'){
        if(phase!=='written')fail('journal-order-invalid');checkValidation(event.receipt,reviewed.after.cases.map(c=>c.id),false);
        validation=event.receipt;phase='validated';
      }else if(event.kind==='complete'){
        if(phase!=='observed'||!validation||!observed)fail('journal-order-invalid');phase='complete';
      }else if(event.kind==='refused')phase='refused';
      else fail('journal-event-invalid');
      previous=revisionOf(event);events.push(event);
    }
    const append=(event:EventInput)=>{
      const current=load(id);if(current.previous!==previous)fail('journal-moved');
      const full={...event,sequence:events.length,previous} as Event;
      write(path.join(dir,'events',String(events.length).padStart(8,'0')+'.json'),full);
      previous=revisionOf(full);events.push(full);
    };
    return {dir,manifest,reviewed,events,previous,phase,direction,validation,observed,runId,append};
  }
  function checkNative(plan:Plan,receipt:NativeRead,command:{attemptId:string;scriptSha256:string;fileKey:string}){
    if(receipt.operationId!==plan.operationId||receipt.parentId!==plan.parentId||receipt.proposalId!==plan.proposalId||
      receipt.attemptId!==command.attemptId||receipt.attemptId===plan.attemptId||receipt.scriptSha256!==command.scriptSha256||
      receipt.fileKey!==command.fileKey||!allowedFiles.has(receipt.fileKey)||receipt.baselineRevision!==plan.baselineRevision||
      revisionOf(receipt.observed)!==plan.observedRevision)fail('native-intent-changed');
  }
  function checkValidation(receipt:SourceRepairValidation,caseIds:readonly string[],current=true){
    if(!hash.test(receipt.referenceId)||!same(receipt.caseIds,caseIds)||receipt.valid!==caseIds.length||!caseIds.length||!Object.keys(receipt.files).length)fail('source-validation-incomplete');
    for(const [file,expected] of Object.entries(receipt.files))if(!file.startsWith(repo+path.sep)||!hash.test(expected)||
      (current&&sha(bytes(file))!==expected))fail('validation-evidence-changed');
  }
  const read=(id:string):SourceRepairApplication=>{
    const running=active.get(id);if(running)return structuredClone(running.state);
    const l=load(id),transaction=transactions.inspect(id);let complete=l.phase==='complete'&&
      transaction.phase===(l.direction==='apply'?'applied':'rolled-back');
    let validationProblem:string|undefined;
    if(complete&&l.validation)try{checkValidation(l.validation,l.reviewed.after.cases.map(c=>c.id));}
    catch{complete=false;validationProblem='react-source-apply-validation-evidence-changed';}
    const last=l.events.at(-1),problem=transaction.problems[0]??validationProblem??(last?.kind==='refused'?last.reason:undefined);
    return {id,previewId:l.manifest.previewId,referenceId:l.manifest.referenceId,operationId:l.manifest.operationId,
      phase:transaction.phase==='conflict'?'refused':complete?(l.direction==='apply'?'applied':'rolled-back'):
        l.phase==='prepared'&&transaction.phase==='prepared'?'prepared':last?.kind==='refused'?'refused':'recovery-required',running:false,direction:l.direction,problem,
      transaction:transaction.phase,files:transaction.files.map(f=>({...f,file:path.relative(configuredRoot(),f.file)})),
      ...(l.validation?{validation:{referenceId:l.validation.referenceId,valid:l.validation.valid,total:l.validation.caseIds.length}}:{}),
      ...(l.phase==='complete'?{recordedCompletion:l.direction==='apply'?'applied' as const:'rolled-back' as const}:{}),
      canvasVerification:l.observed?'recorded':'not-recorded'};
  };
  return {
    read,
    close(){closed=true;},
    list(){
      if(!existsSync(root))return [];
      if(realpathSync(root)!==root)fail('record-directory-changed');
      const ids=readdirSync(root).filter(n=>n!=='.pending');if(ids.length>128)fail('history-limit');
      return ids.sort().filter(id=>transactions.history(id).transaction.sourceRoot===configuredRoot()).map(read);
    },
    prepare(selected:Selection){
      assertOpen();
      if(selected.input.reference.sourceRoot!==configuredRoot())fail('source-root-mismatch');
      const sealed=witnesses.prepare(selected.input,selected.stage,selected.previewDirectory,selected.resultRevision);
      const transaction=transactions.prepare({sourceRoot:configuredRoot(),selectionRevision:sealed.revision,inputs:sealed.inputs,
        edits:sealed.edits.map(edit=>({file:edit.file,beforeSha256:edit.beforeSha256,
          after:readFileSync(path.join(selected.stage.workspace,path.relative(configuredRoot(),edit.file)))}))});
      witnesses.link(sealed.id,transaction.id);
      const plan=selected.input.plan,manifest:Manifest={version:1,transactionId:transaction.id,selectionId:sealed.id,
        referenceId:selected.input.reference.id,previewId:path.basename(selected.previewDirectory),parentId:plan.parentId,proposalId:plan.proposalId,operationId:plan.operationId};
      const dir=directory(transaction.id);mkdirSync(path.join(dir,'events'),{recursive:true,mode:0o700});write(path.join(dir,'application.json'),manifest);
      return read(transaction.id);
    },
    start(id:string,direction:Direction,origin:string){
      assertOpen();
      if(!['apply','rollback'].includes(direction))fail('direction-invalid');
      const running=active.get(id);if(running){
        if(running.state.direction!==direction)fail('another-direction-running');
        return running;
      }
      if(active.size)fail('another-application-running');
      const state=read(id),l=load(id),plan=l.reviewed.selection.proof.plan;
      if(state.transaction==='conflict')fail('source-conflict');
      if(state.phase===(direction==='apply'?'applied':'rolled-back'))return {state,promise:Promise.resolve()};
      if(direction==='apply'&&l.reviewed.transaction.selectionRevision!=='sha256:'+l.manifest.selectionId)fail('selection-mismatch');
      if(direction==='apply'&&state.transaction==='rolled-back')fail('new-review-required');
      if(direction==='rollback'&&state.transaction==='prepared')fail('nothing-to-restore');
      const runId=randomUUID();l.append({kind:'run',direction,runId});
      state.running=true;state.direction=direction;state.phase='reading-design';delete state.problem;
      delete state.recordedCompletion;
      const job={state,promise:Promise.resolve()};active.set(id,job);
      const append=(event:RunInput)=>{
        const current=load(id);if(current.runId!==runId)fail('run-replaced');current.append({...event,runId});
      };
      const observe=async(stage:'before'|'after')=>{
        assertOpen();
        const command=deps.requestRead(plan);
        if(!command.readOnly||command.phase!=='update-readback'||command.operationId!==plan.operationId||
          command.attemptId===plan.attemptId||!allowedFiles.has(command.fileKey))fail('native-command-invalid');
        append({kind:'native-request',direction,stage,attemptId:command.attemptId,scriptSha256:command.scriptSha256,fileKey:command.fileKey});
        let receipt:NativeRead|null=null;
        while(!(receipt=deps.readNative(plan,command.attemptId))){
          await (deps.pause?.()??new Promise(resolve=>setTimeout(resolve,2000)));assertOpen();
        }
        checkNative(plan,receipt,command);append({kind:'native-observed',direction,stage,receipt});return receipt;
      };
      job.promise=(async()=>{
        try{
          const native=await observe('before');
          assertOpen();
          state.phase='writing-source';
          const written=transactions.run(id,direction,transaction=>{
            const reviewed=witnesses.review(id,configuredRoot());
            if(!same(reviewed.transaction,transaction))fail('transaction-changed');
            const fresh=deps.readNative(plan,native.attemptId);
            if(!fresh||!same(fresh,native))fail('native-read-changed');
          });
          append({kind:'source-written',direction,wrote:written.wrote});state.transaction=written.phase;
          state.files=written.files.map(f=>({...f,file:path.relative(configuredRoot(),f.file)}));
          state.phase='validating-source';
          const current=await buildReactReference(configuredRoot(),witnesses.load(configuredRoot()));
          assertOpen();
          if(!reactWitnessesMatch(current))fail('source-witnesses-changed');
          const validation=await deps.validate(current,origin);
          assertOpen();
          if(validation.referenceId!==current.id)fail('validation-reference-mismatch');
          checkValidation(validation,l.reviewed.after.cases.map(c=>c.id));
          if(!reactReferenceUnchanged(current))fail('source-changed-after-validation');
          if(transactions.inspect(id).phase!==(direction==='apply'?'applied':'rolled-back'))fail('source-changed-after-write');
          append({kind:'validated',direction,receipt:validation});state.validation={referenceId:validation.referenceId,valid:validation.valid,total:validation.caseIds.length};
          state.phase='reading-result';await observe('after');
          checkValidation(validation,l.reviewed.after.cases.map(c=>c.id));
          if(!reactReferenceUnchanged(current))fail('source-changed-after-verification');
          if(transactions.inspect(id).phase!==(direction==='apply'?'applied':'rolled-back'))fail('source-changed-after-verification');
          append({kind:'complete',direction});
        }catch(error){if(load(id).runId===runId)append({kind:'refused',direction,reason:reason(error)});}
        finally{active.delete(id);}
      })();
      return job;
    },
  };
}
