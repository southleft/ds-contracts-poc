/** Host-selected, isolated previews. This store has no original-source writer
 * and never receives executable commands or filesystem paths from a request. */
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {revisionOf} from '../core/contract-provenance.js';
import {buildReactReference,reactReferenceSourceModules,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {readReactSourceProgram,reactSourceProgramUnchanged,type ReactSourceProgram} from './react-source-program.js';
import {stageReactUtilitySourceEdit} from './react-source-repair-stage.js';
import {observeReactSourceRepairStates,verifyReactSourceRepairBaseline,verifyReactSourceRepairStates,type RepairStateObservation} from './react-source-repair-observation.js';
import type {planReactOpacitySourceRepair} from './react-design-source-repair.js';

type Plan=ReturnType<typeof planReactOpacitySourceRepair>;
type Comparison=ReturnType<typeof verifyReactSourceRepairStates>;
export type ReactSourceRepairInput={reference:ReactReference;program:ReactSourceProgram;recorded:RepairStateObservation;
  caseId:string;variants:Array<{observation:string;variant:string}>;plan:Plan;
  /** Host configuration; never inferred by running the source's build script. */
  recipe:{input:string;output:string}};
export interface ReactSourceRepairPreview {
  id:string;phase:'running'|'reviewable'|'refused';step:string;current:boolean;
  parentId:string;proposalId:string;planRevision:string;problems:string[];
  candidates:Array<{index:number;status:'verified'|'refused';before:string;after:string;problem?:string;
    module:string;css?:{file:string;beforeSha256:string;afterSha256:string;removed:string;added:string};comparison?:Comparison}>;
  selected?:number;
  limitations:string[];
}
type Dependencies={stage:typeof stageReactUtilitySourceEdit;observe:typeof observeReactSourceRepairStates;
  build:typeof buildReactReference;program:typeof readReactSourceProgram};
const dependencies:Dependencies={stage:stageReactUtilitySourceEdit,observe:observeReactSourceRepairStates,build:buildReactReference,program:readReactSourceProgram};
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const reason=(error:unknown)=>{
  const message=error instanceof Error?error.message:'';
  return /^[a-z][a-z0-9-]*(?::[A-Za-z0-9:;._-]+)?$/.test(message)?message:'react-source-repair-preview-refused';
};
const signature=(value:ReactSourceRepairInput)=>revisionOf({reference:value.reference.id,files:value.reference.files,
  program:value.program,recorded:value.recorded,caseId:value.caseId,variants:value.variants,plan:value.plan,recipe:value.recipe});
function changedText(before:string,after:string) {
  let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let end=0;while(end<before.length-start&&end<after.length-start&&before[before.length-1-end]===after[after.length-1-end])end++;
  return {removed:before.slice(start,before.length-end),added:after.slice(start,after.length-end)};
}

export function createReactSourceRepairPreviews(repo:string,
  derive:(referenceId:string,parentId:string,proposalId:string)=>ReactSourceRepairInput,deps:Dependencies=dependencies) {
  type Job={state:ReactSourceRepairPreview;signature:string;referenceId:string;dir:string;promise:Promise<void>};
  const jobs=new Map<string,Job>();
  let running:Job|undefined;
  const key=(referenceId:string,parentId:string,proposalId:string)=>{
    if(!/^[a-f0-9]{64}$/.test(referenceId)||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(parentId)||! /^[a-f0-9]{64}$/.test(proposalId))
      throw Error('react-source-repair-preview-identity-invalid');
    return referenceId+':'+parentId+':'+proposalId;
  };
  const read=(referenceId:string,parentId:string,proposalId:string)=>{
    const job=jobs.get(key(referenceId,parentId,proposalId));if(!job)return null;
    let current=false;
    try{current=signature(derive(referenceId,parentId,proposalId))===job.signature;}catch{/* Historical previews cannot become write authority. */}
    return {...structuredClone(job.state),current};
  };
  return {
    read,
    start(referenceId:string,parentId:string,proposalId:string) {
      const name=key(referenceId,parentId,proposalId),input=derive(referenceId,parentId,proposalId),pinned=signature(input);
      const prior=jobs.get(name);
      if(prior?.signature===pinned&&(prior.state.phase==='running'||prior.state.phase==='reviewable'))return prior;
      if(running)throw Error('react-source-repair-preview-already-running');
      const id=randomUUID(),dir=path.join(repo,'private/react-source-repair-previews',id);mkdirSync(dir,{recursive:true,mode:0o700});
      const state:ReactSourceRepairPreview={id,phase:'running',step:'Checking unchanged source states',current:true,parentId,proposalId,
        planRevision:input.plan.revision,problems:[],candidates:[],limitations:['preview-only-original-source-unchanged',
          'recorded-caller-context-and-finite-domain-only','other-callers-not-yet-qualified','canvas-is-the-last-recorded-read',
          'restart-requires-a-new-preview']};
      writeFileSync(path.join(dir,'started.json'),JSON.stringify({signature:pinned,referenceId,plan:input.plan,recipe:input.recipe},null,2)+'\n',{flag:'wx'});
      const job:Job={state,signature:pinned,referenceId,dir,promise:Promise.resolve()};jobs.set(name,job);running=job;
      const assertSource=()=>{if(!reactReferenceUnchanged(input.reference)||!reactSourceProgramUnchanged(input.program))throw Error('react-source-repair-preview-source-changed');};
      const assertInput=()=>{assertSource();if(signature(derive(referenceId,parentId,proposalId))!==pinned)throw Error('react-source-repair-preview-evidence-changed');};
      job.promise=(async()=>{
        try {
          assertInput();
          const before=await deps.observe({reference:input.reference,program:input.program,caseId:input.caseId,
            instanceId:input.recorded.observation.instanceId,expected:input.recorded.observation,dir:path.join(dir,'original'),assertCurrent:assertSource});
          verifyReactSourceRepairBaseline(input.recorded,before);
          for(const [index,candidate] of input.plan.candidates.entries()) {
            assertInput();state.step=`Checking source candidate ${index+1} of ${input.plan.candidates.length}`;
            const row:ReactSourceRepairPreview['candidates'][number]={index,status:'refused',module:candidate.source.module,before:candidate.edit.before,after:candidate.edit.after};
            state.candidates.push(row);
            try {
              const stage=await deps.stage(repo,input.reference.sourceRoot,input.reference.files,candidate,input.recipe);
              const reference=await deps.build(stage.workspace),program=deps.program(stage.workspace,reactReferenceSourceModules(reference));
              const after=await deps.observe({reference,program,caseId:input.caseId,instanceId:before.observation.instanceId,
                expected:before.observation,dir:path.join(dir,'candidate-'+index),assertCurrent:assertSource});
              row.comparison=verifyReactSourceRepairStates(before,after,input.variants,input.plan,index);
              const originalCss=readFileSync(stage.css.file),stagedCss=readFileSync(path.join(stage.workspace,input.recipe.output));
              if(sha(originalCss)!==stage.css.beforeSha256||sha(stagedCss)!==stage.css.afterSha256)throw Error('react-source-repair-preview-css-changed');
              row.css={file:input.recipe.output,beforeSha256:stage.css.beforeSha256,afterSha256:stage.css.afterSha256,
                ...changedText(originalCss.toString(),stagedCss.toString())};
              row.status='verified';
            }catch(error){row.problem=reason(error);}
          }
          assertInput();const selected=state.candidates.filter(c=>c.status==='verified');
          if(selected.length!==1)throw Error(selected.length?'react-source-repair-preview-ambiguous-effect':'react-source-repair-preview-no-matching-effect');
          state.selected=selected[0].index;state.phase='reviewable';state.step='One candidate matches every recorded state';
        } catch(error) {state.phase='refused';state.step='Preview refused';state.problems.push(reason(error));}
        finally {
          try{writeFileSync(path.join(dir,'result.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});}
          finally{if(running===job)running=undefined;}
        }
      })();
      return job;
    },
    image(referenceId:string,parentId:string,proposalId:string,id:string,index:string,rowId:string,hash:string) {
      // These are immutable evidence bytes, not a current-source verdict or
      // write permit. Re-deriving the native correction chain for each of the
      // comparison's images serializes expensive history reads. The metadata
      // read/start paths still reauthenticate that chain; image identity stays
      // pinned to this exact reviewed preview, selected row and content hash.
      const job=jobs.get(key(referenceId,parentId,proposalId)),state=job?.state;
      if(!job||state?.id!==id||state.phase!=='reviewable'||! /^\d+$/.test(rowId)||! /^[a-f0-9]{64}$/.test(hash))
        throw Error('react-source-repair-preview-image-unavailable');
      const candidate=state.candidates.find(c=>c.index===state.selected),row=candidate?.comparison?.rows.find(r=>r.observation===rowId);
      const before=index==='original';
      if(!row||(!before&&index!=='candidate-'+state.selected)||hash!==(before?row.beforeImage:row.afterImage))
        throw Error('react-source-repair-preview-image-mismatch');
      const bytes=readFileSync(path.join(job.dir,index,'states',rowId+'.png'));
      if(sha(bytes)!==hash)throw Error('react-source-repair-preview-image-changed');return bytes;
    },
  };
}
