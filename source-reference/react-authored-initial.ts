/** Original factory provenance for each independently observed initial input.
 * Caller entries are derived in memory; workspace sources and witnesses stay
 * unchanged. Every capture must equal the existing full tree and full PNG. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import type {Browser} from 'playwright-core';
import {canonicalJson} from '../core/contract-provenance.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import {reactInitialCaseEntry} from './react-cohort.js';
import {buildReactReference,reactReferenceHtml,type ReactReference} from './react-reference.js';
import {buildReactOwnershipReference,reactOwnershipEntry,reactOwnershipHook,reactOwnershipRead,reactOwnershipStructure,type ReactOwnership} from './react-ownership.js';
import {createReactElementCreationObserver} from './react-element-creation.js';
import {reactJsxSubjects,reactOwnershipEngine} from './react-ownership-run.js';
import {readReactJsxEffects} from './react-jsx-effects.js';
import {observeReactJsxHelpers,type ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import {readReactAuthoredContent,verifiedReactAuthoredContent,type ReactAuthoredContent} from './react-authored-content.js';
import {captureMatchedInitialTree} from './react-initial-capture.js';
import {planReactInitialStates,type observeReactInitialStates} from './react-initial-state.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactPropertySnapshot} from './react-root-variants.js';
import {evidenceSha} from './react-validation-evidence.js';
import {watchSourceFailures} from './observe.js';

type Observation=Awaited<ReturnType<typeof observeReactInitialStates>>;
type Row=Observation['rows'][number];
export interface ReactAuthoredInitialOrigins {
 version:1;qualification:'matched-initial-render-origins';acceptedContract:null;
 rows:Array<{id:string;status:'observed'|'refused';problem?:string;contentRevision?:string;referenceId?:string}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(reason:string):never=>{throw Error('react-authored-initial-'+reason);};
function resolvedMounts(reference:ReactReference){
 const imports=reference.cohort.mountedModules??[],files=reference.mountedSourceFiles??[];
 if(imports.length!==files.length)fail('mount-resolution-unavailable');
 return new Map(imports.map((module,i)=>[module,path.relative(reference.sourceRoot,files[i]).split(path.sep).join('/')]));
}
function assertPair(row:Row,snapshot:ReactPropertySnapshot){
 if(!/^\d+$/.test(row.id)||row.status!=='observed'||!row.restored||!snapshot||row.treeSha256!==snapshot.treeSha256||row.image!==snapshot.image||
    evidenceSha(JSON.stringify(snapshot.tree))!==row.treeSha256)fail('state-pair-mismatch');
}
export function reactAuthoredInitialDomain(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode,observation:Observation){
 const expected=planReactInitialStates(program,ownership,tree,observation.instanceId);
 if(observation.version!==1||observation.qualification!=='finite-initial-mounts-only'||!expected.plan.length||observation.problems.length||observation.planned!==expected.plan.length||observation.rows.length!==expected.plan.length||
    !same(expected.source,observation.source)||!same(expected.heldProps,observation.heldProps)||!same(expected.axes,observation.axes)||
    observation.rows.some((r,i)=>r.id!==String(i)||!same(r.changes,expected.plan[i].changes)))fail('domain-mismatch');
 return expected;
}

export async function observeReactAuthoredInitials(options:{browser:Browser;reference:ReactReference;program:ReactSourceProgram;
 ownership:ReactOwnership;tree:CapturedNode;observation:Observation;snapshots:Record<string,ReactPropertySnapshot>;caseId:string;dir:string;assertCurrent():void
}):Promise<ReactAuthoredInitialOrigins>{
 const {browser,reference,program,ownership,tree,observation,snapshots,caseId,dir,assertCurrent}=options;
 const result:ReactAuthoredInitialOrigins={version:1,qualification:'matched-initial-render-origins',acceptedContract:null,rows:[]};
 reactAuthoredInitialDomain(program,ownership,tree,observation);
 const engine=reactOwnershipEngine();
 for(const row of observation.rows){
  const state:ReactAuthoredInitialOrigins['rows'][number]={id:row.id,status:'refused'};result.rows.push(state);
  const rowDir=path.join(dir,row.id);mkdirSync(rowDir,{recursive:true});
  const save=(file:string,value:unknown)=>writeFileSync(path.join(rowDir,file),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  try{
   assertCurrent();const snapshot=snapshots[row.id];assertPair(row,snapshot);
   const derivation=reactInitialCaseEntry(reference.cohort,caseId,observation.source,row.changes,resolvedMounts(reference));
   const derived=await buildReactReference(reference.sourceRoot,{...reference.cohort,entry:derivation.entry});
   if(!same(derived.files,reference.files)||derived.css!==reference.css)fail('source-inputs-changed');
   save('derivation.json',{...derivation.receipt,baseReferenceId:reference.id,derivedReferenceId:derived.id,javascriptSha256:evidenceSha(derived.javascript)});
   writeFileSync(path.join(rowDir,'caller.tsx'),derivation.entry,{flag:'wx'});
   writeFileSync(path.join(rowDir,'reference.js'),derived.javascript,{flag:'wx'});
   const capture=async(ref:ReactReference,hook:string)=>{
    const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
    try{
     if(hook)await context.addInitScript(hook);
     const url='http://localhost/react-authored-initial?case='+encodeURIComponent(caseId);
     await context.route('**/*',route=>route.request().url()===url?route.fulfill({status:200,contentType:'text/html',
      headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},body:reactReferenceHtml(ref)}):route.abort());
     const page=await context.newPage(),failures=watchSourceFailures(page),profile=reference.cohort.profile(caseId);
     try{
      await page.goto(url);await page.locator(profile.path[0]).waitFor({timeout:15000});
      await captureMatchedInitialTree(page,profile.path,snapshot,failures);
      return hook?await page.evaluate<ReactOwnership>(reactOwnershipRead(profile.path[0])):undefined;
     }finally{failures.dispose();}
    }finally{await context.close();}
   };
   // Bare source must match too: an observer cannot manufacture equivalence.
   await capture(derived,'');
   const creation=createReactElementCreationObserver(derived,reactOwnershipEntry(reference.sourceRoot,derived,program),program.components);
   const observed=await buildReactOwnershipReference(reference.sourceRoot,derived,program,creation);creation.complete();
   if(observed.css!==reference.css)fail('observer-css-changed');
   const actual=(await capture(observed,reactOwnershipHook+'\n'+creation.hook))!;
   if(!same(reactOwnershipStructure(actual),reactOwnershipStructure(snapshot.ownership)))fail('ownership-mismatch');
   save('ownership.json',actual);
   const models=reactJsxSubjects(actual).filter(s=>s.site.module===observation.source.module&&s.site.sourceSha256===observation.source.sourceSha256)
    .map(s=>readReactJsxEffects(derived,s.site,s.invocation));
   if(models.length!==1)fail('root-render-ambiguous');
   const helperDir=path.join(rowDir,'helper'),helper=await observeReactJsxHelpers({browser,reference:derived,program,ownership:actual,model:models[0],caseId,
    treeSha256:snapshot.treeSha256,pngSha256:snapshot.image,initialState:snapshot,dir:helperDir,engine,assertCurrent});
   if(helper.status!=='observed')throw Error(helper.reason??'react-authored-initial-helper-unavailable');
   const content=readReactAuthoredContent({referenceId:derived.id,sourceRoot:reference.sourceRoot,program,ownership:actual,tree:snapshot.tree,helper,
    read:name=>readFileSync(path.join(helperDir,name))});
   const fact=verifiedReactAuthoredContent(content,program,actual,snapshot.tree);
   if(fact.instanceId!==observation.instanceId)fail('root-instance-mismatch');
   assertCurrent();state.status='observed';state.contentRevision=content.revision;state.referenceId=derived.id;
  }catch(error){state.problem=error instanceof Error?error.message:String(error);}
  save('report.json',state);
 }
 writeFileSync(path.join(dir,'report.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}

/** Reopen only from a host-authenticated immutable observation archive. */
export function readReactAuthoredInitial(options:{reference:ReactReference;program:ReactSourceProgram;caseId:string;source:Observation['source'];
 row:Row;snapshot:ReactPropertySnapshot;origin:ReactAuthoredInitialOrigins['rows'][number];read(name:string):Buffer
}):{content:ReactAuthoredContent;ownership:ReactOwnership}{
 const {reference,program,caseId,source,row,snapshot,origin,read}=options;assertPair(row,snapshot);
 if(origin.id!==row.id||origin.status!=='observed')fail('origin-unavailable');
 const derivation=reactInitialCaseEntry(reference.cohort,caseId,source,row.changes,resolvedMounts(reference)),record=JSON.parse(read('derivation.json').toString());
 const javascript=read('reference.js'),derivedId=evidenceSha(JSON.stringify({version:1,entry:evidenceSha(derivation.entry),
  files:Object.entries(reference.files).map(([file,hash])=>[path.relative(reference.sourceRoot,file),hash]).sort(),javascript:evidenceSha(javascript),css:evidenceSha(reference.css)}));
 if(!same(record,{...derivation.receipt,baseReferenceId:reference.id,derivedReferenceId:derivedId,javascriptSha256:evidenceSha(javascript)})||
    read('caller.tsx').toString()!==derivation.entry||origin.referenceId!==derivedId||!same(JSON.parse(read('report.json').toString()),origin))fail('derivation-mismatch');
 const ownership=JSON.parse(read('ownership.json').toString()) as ReactOwnership;
 if(!same(reactOwnershipStructure(ownership),reactOwnershipStructure(snapshot.ownership)))fail('ownership-mismatch');
 const helper=JSON.parse(read('helper/report.json').toString()) as ReactJsxHelperObservation;
 const content=readReactAuthoredContent({referenceId:derivedId,sourceRoot:reference.sourceRoot,program,ownership,tree:snapshot.tree,helper,read:name=>read('helper/'+name)});
 if(content.revision!==origin.contentRevision||verifiedReactAuthoredContent(content,program,ownership,snapshot.tree).instanceId!==snapshot.ownership.components.find(c=>same(c.source,source))?.id)
  fail('origin-mismatch');
 return {content,ownership};
}
