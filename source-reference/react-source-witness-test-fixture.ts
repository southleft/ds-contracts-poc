import type test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {revisionOf} from '../core/contract-provenance.js';
import {createReactSourceWitnessSuccessions} from './react-source-witness-succession.js';
import {createSourceFileTransactions} from './react-source-file-transaction.js';
import {buildReactReference} from './react-reference.js';
import {proposeReactOpacityUtilityEdits} from './react-utility-source-edit.js';
import {reactSourceRepairInputRevision,type ReactSourceRepairInput} from './react-source-repair-preview.js';
import {verifyRepairCallerFrames,type RepairCallerFrame} from './react-source-repair-cohort.js';
import {loadReactCohort,type ReactCohort} from './react-cohort.js';
import type {stageReactUtilitySourceEdit} from './react-source-repair-stage.js';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const bytes=(value:unknown)=>JSON.stringify(value)+'\n';

export async function sourceWitnessFixture(t:test.TestContext,declared=false){
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
    const afterCss=':root{--fixture:1}.disabled{opacity:'+afterValue+'}';writeFileSync(path.join(workspace,'output.css'),afterCss);writeFileSync(path.join(workspace,'toggle.tsx'),candidate.result);
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
