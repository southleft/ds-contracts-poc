/** Check a source edit in every configured caller context. The original
 * witnesses stay immutable; candidate expectations come from the design plan. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {flatten} from '../extract/computed/lib.js';
import {reactReferenceHtml,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {reactSourceProgramUnchanged,type ReactSourceProgram} from './react-source-program.js';
import {buildReactOwnershipReference,reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {captureValidatedTree} from './capture.js';
import {watchSourceFailures} from './observe.js';
import {evidenceSha} from './react-validation-evidence.js';
import {observeTextFonts,withPaintedTextFonts} from './text-fonts.js';
import {observeReactInitialStates} from './react-initial-state.js';
import {verifyReactSourceRepairStates,type RepairStateObservation} from './react-source-repair-observation.js';
import {observeCheckboxBehavior,checkedToggleRole} from './control-behavior.js';
import type {SourceProfile} from './check.js';
import type {ReactSourceRepairInput} from './react-source-repair-preview.js';

type Plan=ReactSourceRepairInput['plan'];
type Candidate=Plan['candidates'][number];
type Owner=ReactOwnership['components'][number];
type Capture=Extract<Awaited<ReturnType<typeof captureValidatedTree>>,{status:'captured'}>;
export interface RepairCallerFrame {
  caseId:string;captured:Capture;ownership:ReactOwnership;
  fonts:Awaited<ReturnType<typeof observeTextFonts>>;
  finite:Array<RepairStateObservation&{instanceId:string}>;
  behavior:Array<{instanceId:string;observation:Awaited<ReturnType<typeof observeCheckboxBehavior>>}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const exact=(a:number,b:number)=>a===b||Math.fround(a)===Math.fround(b);
const fail=(reason:string):never=>{throw Error('react-source-repair-cohort-'+reason);};
const target=(owner:Owner,candidate:Candidate)=>owner.source.module===candidate.source.module&&owner.source.exportName===candidate.source.exportName;

function effectTable(recorded:RepairStateObservation,variants:ReactSourceRepairInput['variants'],plan:Plan) {
  if(new Set(plan.changes.map(c=>c.variant)).size!==plan.changes.length||
      recorded.observation.rows.length!==variants.length||new Set(variants.map(v=>v.observation)).size!==variants.length||
      new Set(variants.map(v=>v.variant)).size!==variants.length)fail('native-domain-incomplete');
  const table=variants.map(v=>{
    const row=recorded.observation.rows.find(r=>r.id===v.observation);
    if(!row||row.status!=='observed'||!row.restored)fail('native-state-unavailable');
    return {changes:row!.changes,variant:v.variant,effect:plan.changes.find(c=>c.variant===v.variant)};
  });
  if(new Set(table.map(r=>canonicalJson(r.changes))).size!==table.length||
      plan.changes.some(c=>!table.some(r=>r.variant===c.variant)))fail('native-domain-ambiguous');
  return table;
}
function callerEffect(owner:Owner,table:ReturnType<typeof effectTable>) {
  const rows=table.filter(row=>Object.entries(row.changes).every(([prop,requested])=>
    requested.kind==='omit'?!Object.hasOwn(owner.props,prop):Object.hasOwn(owner.props,prop)&&same(owner.props[prop],requested.value)));
  if(rows.length!==1)fail('caller-state-unmapped');
  return rows[0].effect;
}
function utilityValue(candidate:Candidate,plan:Plan) {
  const match=/opacity-(\d+(?:\.\d+)?|\[(?:\d*\.)?\d+\])$/.exec(candidate.edit.after);
  if(!match)fail('utility-value-unavailable');
  const value=match![1].startsWith('[')?Number(match![1].slice(1,-1)):Number(match![1])/100;
  if(!Number.isFinite(value)||value<0||value>1||!plan.changes.length||!plan.changes.every(c=>exact(c.after,value)))fail('native-effect-mismatch');
  return value;
}

/** Derive a candidate's root-opacity witness from the independently read design
 * edit. No other witness field changes, and no original profile is mutated. */
export function repairCallerProfile(profile:SourceProfile,before:RepairCallerFrame,
  recorded:RepairStateObservation,variants:ReactSourceRepairInput['variants'],plan:Plan,index:number):SourceProfile {
  const candidate=plan.candidates[index];if(!candidate)fail('candidate-unavailable');
  const result=structuredClone(profile),owners=before.ownership.components.filter(o=>target(o,candidate)&&o.roots.includes(''));
  if(owners.length>1)fail('profile-root-ambiguous');
  const effect=owners[0]&&callerEffect(owners[0],effectTable(recorded,variants,plan));
  if(effect&&result.requiredStyles?.opacity!==undefined){
    if(!exact(Number(result.requiredStyles.opacity),effect.before))fail('original-witness-mismatch');
    result.requiredStyles.opacity=String(utilityValue(candidate,plan));
  }
  return result;
}

/** Every configured case must remain represented, including those that do not
 * use the edited component. Missing callers and new side effects refuse. */
export function verifyRepairCallerFrames(caseIds:readonly string[],before:RepairCallerFrame[],after:RepairCallerFrame[],
  recorded:RepairStateObservation,variants:ReactSourceRepairInput['variants'],plan:Plan,index:number) {
  const candidate=plan.candidates[index];if(!candidate)fail('candidate-unavailable');
  if(!caseIds.length||caseIds.length>64||new Set(caseIds).size!==caseIds.length||
      !same(before.map(c=>c.caseId),caseIds)||!same(after.map(c=>c.caseId),caseIds))fail('case-inventory-changed');
  const table=effectTable(recorded,variants,plan),value=utilityValue(candidate,plan);
  let instances=0;
  const cases=before.map((old,caseIndex)=>{
    const now=after[caseIndex],tree=structuredClone(old.captured.tree),ownership=structuredClone(now.ownership);
    if(old.captured.status!=='captured'||now.captured.status!=='captured'||old.ownership.problems.length||now.ownership.problems.length)
      fail('caller-unverified');
    const targets=old.ownership.components.filter(o=>target(o,candidate));instances+=targets.length;
    let changedRoots=0;
    for(const owner of targets){
      if(owner.source.sourceSha256!==candidate.beforeSha256||owner.roots.length!==1)fail('source-root-unavailable');
      const node=flatten(tree!).find(r=>r.path===owner.roots[0])?.node;
      if(!node||node.classes.filter(c=>c===candidate.edit.before).length!==1)fail('root-class-unavailable');
      node!.classes=node!.classes.map(c=>c===candidate.edit.before?candidate.edit.after:c);
      const effect=callerEffect(owner,table);
      if(effect){if(!exact(Number(node!.style.opacity),effect.before))fail('baseline-effect-mismatch');node!.style.opacity=String(value);changedRoots++;}
    }
    if(!same(tree,now.captured.tree))fail('other-tree-facts-changed:'+old.caseId);
    for(const owner of ownership.components){
      const prior=old.ownership.components.find(o=>o.id===owner.id);
      if(prior&&owner.source.module===candidate.source.module&&prior.source.sourceSha256===candidate.beforeSha256&&
          owner.source.sourceSha256===candidate.afterSha256&&owner.source.exportName===prior.source.exportName)
        owner.source=structuredClone(prior.source);
    }
    if(!same(old.ownership,ownership))fail('ownership-changed:'+old.caseId);
    const fontFacts=(f:RepairCallerFrame['fonts'])=>{const {treeRevision:_revision,...facts}=f;return facts;};
    withPaintedTextFonts(old.captured.tree!,old.fonts);withPaintedTextFonts(now.captured.tree!,now.fonts);
    if(old.fonts.status!=='observed'||now.fonts.status!=='observed'||old.fonts.problems.length||now.fonts.problems.length||
        !same(fontFacts(old.fonts),fontFacts(now.fonts)))fail('fonts-changed:'+old.caseId);
    if(!changedRoots&&old.captured.sourcePngSha256!==now.captured.sourcePngSha256)fail('unchanged-image-changed:'+old.caseId);
    const ids=targets.map(o=>o.id);
    if(!same(old.finite.map(f=>f.instanceId),ids)||!same(now.finite.map(f=>f.instanceId),ids)||
        !same(old.behavior.map(b=>b.instanceId),ids)||!same(now.behavior.map(b=>b.instanceId),ids))fail('caller-coverage-incomplete');
    if(old.behavior.some(b=>b.observation.status!=='observed'||b.observation.problems.length||!checkedToggleRole(b.observation.role)||
        !same(b.observation.rows.map(r=>r.action),['associated-label','space'])||b.observation.rows.some(r=>!r.passed||r.after!==r.expected))||
        !same(old.behavior,now.behavior))fail('behavior-changed:'+old.caseId);
    const finite=old.finite.map((frame,i)=>{
      if(frame.observation.planned!==table.length||frame.observation.rows.length!==table.length)fail('caller-domain-incomplete');
      const mapping=frame.observation.rows.map(row=>{
        const matches=table.filter(r=>same(r.changes,row.changes));if(matches.length!==1)fail('caller-domain-unmapped');
        return {observation:row.id,variant:matches[0].variant};
      });
      return {instanceId:frame.instanceId,...verifyReactSourceRepairStates(frame,now.finite[i],mapping,plan,index)};
    });
    return {caseId:old.caseId,changedRoots,beforeImage:old.captured.sourcePngSha256!,afterImage:now.captured.sourcePngSha256!,finite,
      interactions:now.behavior.map(b=>({instanceId:b.instanceId,role:b.observation.role,rows:b.observation.rows}))};
  });
  if(!instances)fail('edited-source-unused');
  return {qualification:'configured-caller-effects-verified' as const,cases,
    observations:{before:revisionOf(before),after:revisionOf(after)},
    limitations:['configured-cases-only','finite-initial-states-and-checked-control-actions-only','source-write-not-authorized']};
}

export async function verifyReactSourceRepairCohort(args:{input:ReactSourceRepairInput;candidateIndex:number;
  proposed:ReactReference;program:ReactSourceProgram;dir:string;assertCurrent:()=>void}) {
  const {input,candidateIndex:index}=args,candidate=input.plan.candidates[index];if(!candidate)fail('candidate-unavailable');
  const references=[input.reference,args.proposed],programs=[input.program,args.program],caseIds=input.reference.cohort.cases.map(c=>c.id);
  if(!same(caseIds,args.proposed.cohort.cases.map(c=>c.id))||!caseIds.length||caseIds.length>64)fail('case-inventory-changed');
  const assertCurrent=()=>{args.assertCurrent();if(references.some(r=>!reactReferenceUnchanged(r))||programs.some(p=>!reactSourceProgramUnchanged(p)))fail('source-changed');};
  assertCurrent();mkdirSync(args.dir,{recursive:true});
  const observed=await Promise.all(references.map((r,i)=>buildReactOwnershipReference(r.sourceRoot,r,programs[i])));
  const frames:RepairCallerFrame[][]=[[],[]];let totalStates=0,totalInstances=0;
  const browser=await chromium.launch();
  try{
    for(const caseId of caseIds){
      const caseDir=path.join(args.dir,caseId);mkdirSync(caseDir);
      for(const side of [0,1]){
        assertCurrent();const reference=references[side],program=programs[side],sideDir=path.join(caseDir,side?'candidate':'original');mkdirSync(sideDir);
        const baseProfile=input.reference.cohort.profile(caseId),profile=side?repairCallerProfile(baseProfile,frames[0].at(-1)!,input.recorded,input.variants,input.plan,index):baseProfile;
        const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
        await context.addInitScript(reactOwnershipHook);
        const url='http://127.0.0.1/react-repair-caller?case='+caseId;
        let instrumented=false;
        await context.route('**/*',r=>r.request().url()===url?r.fulfill({status:200,contentType:'text/html',
          headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},
          body:reactReferenceHtml(instrumented?observed[side]:reference)}):r.abort());
        const page=await context.newPage(),failures=watchSourceFailures(page);
        const reset=async()=>{await page.goto(url);await page.locator(profile.path[0]).waitFor({state:'attached',timeout:15000});await page.evaluate(()=>document.fonts.ready);};
        try{
          await reset();const raw=await captureValidatedTree(page,profile,failures,'#root','--');
          if(raw.status!=='captured')fail('original-capture-refused:'+caseId);
          instrumented=true;await reset();const captured=await captureValidatedTree(page,profile,failures,'#root','--');
          if(captured.status!=='captured'||captured.treeSha256!==raw.treeSha256||captured.sourcePngSha256!==raw.sourcePngSha256)fail('instrumentation-changed:'+caseId);
          const ownership=await page.evaluate(reactOwnershipRead(profile.path[0])) as ReactOwnership;
          if(ownership.problems.length)fail('ownership-unavailable');
          const frame:RepairCallerFrame={caseId,captured:captured as Capture,ownership,fonts:await observeTextFonts(page,profile.path,captured.tree!),finite:[],behavior:[]};
          const png=await page.screenshot({fullPage:true,caret:'initial'});
          if(evidenceSha(png)!==captured.sourcePngSha256)fail('caller-image-changed:'+caseId);
          writeFileSync(path.join(sideDir,'initial.png'),png,{flag:'wx'});
          const targets=ownership.components.filter(o=>target(o,candidate));
          if(side===0){totalInstances+=targets.length;if(totalInstances>32)fail('instance-limit');}
          for(const owner of targets){
            if(owner.roots.length!==1)fail('owned-root-ambiguous');
            const finiteDir=path.join(sideDir,owner.id);
            const observation=await observeReactInitialStates({page,program,ownership,tree:captured.tree!,image:captured.sourcePngSha256!,
              instanceId:owner.id,selector:profile.path[0],dir:finiteDir,failures,assertCurrent});
            totalStates+=observation.planned;if(totalStates>512)fail('state-limit');
            if(!observation.planned||observation.problems.length||observation.rows.some(r=>r.status!=='observed'||!r.restored))fail('finite-context-refused:'+caseId);
            const snapshots=Object.fromEntries(observation.rows.map(r=>[r.id,JSON.parse(readFileSync(path.join(finiteDir,r.id+'.json'),'utf8'))]));
            frame.finite.push({instanceId:owner.id,observation,snapshots});
            const selector=profile.path[0]+(owner.roots[0]?owner.roots[0].split('.').map(i=>' > :nth-child('+(Number(i)+1)+')').join(''):'');
            const control=await page.locator(selector).evaluate(element=>({
              role:element.getAttribute('role')??(element instanceof HTMLInputElement&&element.type==='checkbox'?'checkbox':null),
              checked:element.getAttribute('aria-checked')??(element instanceof HTMLInputElement?element.indeterminate?'mixed':String(element.checked):null),
              disabled:element instanceof HTMLInputElement||element instanceof HTMLButtonElement?element.disabled:element.getAttribute('aria-disabled')==='true',
              labels:element instanceof HTMLInputElement||element instanceof HTMLButtonElement?Array.from(element.labels??[]).map(label=>label.textContent?.trim()):[],
            }));
            if(!checkedToggleRole(control.role)||!['false','true','mixed'].includes(control.checked??'')||control.labels.length!==1||!control.labels[0])fail('interaction-class-unavailable');
            const behavior=await observeCheckboxBehavior(page,{selector,checked:control.checked as 'false'|'true'|'mixed',disabled:control.disabled,label:control.labels[0]},reset);
            const restored=await captureValidatedTree(page,profile,failures,'#root','--');
            if(behavior.status!=='observed'||restored.status!=='captured'||restored.treeSha256!==captured.treeSha256||restored.sourcePngSha256!==captured.sourcePngSha256)fail('behavior-not-restored:'+caseId);
            frame.behavior.push({instanceId:owner.id,observation:behavior});
          }
          writeFileSync(path.join(sideDir,'frame.json'),JSON.stringify(frame,null,2)+'\n',{flag:'wx'});frames[side].push(frame);
        }finally{failures.dispose();await context.close();}
      }
    }
    assertCurrent();const result=verifyRepairCallerFrames(caseIds,frames[0],frames[1],input.recorded,input.variants,input.plan,index);
    writeFileSync(path.join(args.dir,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
  }finally{await browser.close();}
}
