/** Observe a staged candidate through the same finite-state mechanism used to
 * create native variants. All source execution stays in an isolated browser. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {canonicalJson} from '../core/contract-provenance.js';
import {flatten} from '../extract/computed/lib.js';
import {buildReactOwnershipReference,reactOwnershipHook,reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {reactReferenceHtml,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {reactSourceProgramUnchanged,type ReactSourceProgram} from './react-source-program.js';
import {captureValidatedTree} from './capture.js';
import {watchSourceFailures} from './observe.js';
import {observeReactInitialStates,planReactInitialStates} from './react-initial-state.js';
import type {ReactPropertySnapshot} from './react-root-variants.js';
import {isShadowSourceRepair,type ReactDesignSourceRepairPlan} from './react-design-source-repair.js';
import {repairShadowShows} from './react-repair-shadow.js';
import {withPaintedTextFonts} from './text-fonts.js';
import {verifiedSvgViewports,type SvgViewportEvidence} from './svg-viewports.js';
import {hasUnpaintedPseudoBoxes,verifiedPseudoBoxes,type PseudoBoxEvidence} from './pseudo-boxes.js';
import {hasGridContainer,verifiedGridConstraints} from './grid-constraints.js';

type Observation=Awaited<ReturnType<typeof observeReactInitialStates>>;
type RepairSnapshot=ReactPropertySnapshot&{svg:SvgViewportEvidence;pseudoBoxes?:PseudoBoxEvidence};
export type RepairStateObservation={observation:Observation;snapshots:Record<string,RepairSnapshot>};
type RepairPlan=ReactDesignSourceRepairPlan;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(reason:string):never=>{throw Error('react-source-repair-observation-'+reason);};

/** Each auxiliary reader authenticates its own input tree before comparing
 * measured facts. A precise class/opacity edit changes those input hashes;
 * it must not erase font identity, coverage or actual pseudo geometry. */
function comparableFacts(snapshot:RepairSnapshot) {
  try {
  if(!snapshot.fonts||!snapshot.svg||!snapshot.bounds||!snapshot.descendantSizes)fail('supporting-evidence-unavailable');
  withPaintedTextFonts(snapshot.tree,snapshot.fonts!);
  const svg=verifiedSvgViewports(snapshot.tree,snapshot.svg);
  if(hasGridContainer(snapshot.tree)&&!snapshot.gridConstraints)fail('grid-evidence-unavailable');
  const grids=snapshot.gridConstraints?verifiedGridConstraints(snapshot.tree,snapshot.gridConstraints):undefined;
  if(hasUnpaintedPseudoBoxes(snapshot.tree)&&!snapshot.pseudoBoxes)fail('pseudo-evidence-unavailable');
  const pseudo=snapshot.pseudoBoxes?verifiedPseudoBoxes(snapshot.tree,snapshot.pseudoBoxes).map(({styleRevision:_revision,...row})=>row):undefined;
  const {treeRevision:_revision,...fonts}=snapshot.fonts!;
  return {fonts,svg,grids,pseudo};
  } catch(error) { return fail('supporting-evidence-invalid:'+(error instanceof Error?error.message:String(error))); }
}

export function verifyReactSourceRepairBaseline(recorded:RepairStateObservation,fresh:RepairStateObservation) {
  if(!same(recorded.observation.source,fresh.observation.source)||!same(recorded.observation.axes,fresh.observation.axes)||
      !same(recorded.observation.heldProps,fresh.observation.heldProps)||recorded.observation.planned!==fresh.observation.planned||
      recorded.observation.rows.length!==fresh.observation.rows.length||recorded.observation.problems.length||fresh.observation.problems.length)
    fail('recorded-domain-changed');
  for(const row of recorded.observation.rows) {
    const now=fresh.observation.rows.find(r=>r.id===row.id),old=recorded.snapshots[row.id],snapshot=fresh.snapshots[row.id];
    if(!now||row.status!=='observed'||now.status!=='observed'||!row.restored||!now.restored||!same(row.changes,now.changes)||!old||!snapshot)
      fail('recorded-state-unavailable');
    for(const key of ['tree','ownership','image','styleOrigin','fonts','bounds','gridConstraints','descendantSizes','svg','pseudoBoxes'] as const)
      if(!same((old as any)[key],(snapshot as any)[key]))fail('recorded-'+key+'-changed:'+row.id);
  }
}

export async function observeReactSourceRepairStates(args:{reference:ReactReference;program:ReactSourceProgram;
  caseId:string;instanceId:string;expected:Observation;dir:string;assertCurrent:()=>void}) {
  const {reference,program}=args;
  const assertCurrent=()=>{
    args.assertCurrent();if(!reactReferenceUnchanged(reference)||!reactSourceProgramUnchanged(program))fail('source-changed');
  };
  assertCurrent();
  const observed=await buildReactOwnershipReference(reference.sourceRoot,reference,program);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({viewport:{width:900,height:600},deviceScaleFactor:1,colorScheme:'light'});
    await context.addInitScript(reactOwnershipHook);
    const url='http://127.0.0.1/react-ownership?case='+args.caseId;
    await context.route('**/*',r=>r.request().url()===url?r.fulfill({status:200,contentType:'text/html',
      headers:{'Content-Security-Policy':"sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'"},
      body:reactReferenceHtml(observed)}):r.abort());
    const page=await context.newPage(),failures=watchSourceFailures(page),profile=reference.cohort.profile(args.caseId);
    try {
      await page.goto(url);await page.locator(profile.path[0]).waitFor({state:'attached',timeout:15000});
      const captured=await captureValidatedTree(page,profile,failures,'#root','--');
      if(captured.status!=='captured')fail('capture-refused');
      const ownership=await page.evaluate(reactOwnershipRead(profile.path[0])) as ReactOwnership;
      const domain=planReactInitialStates(program,ownership,captured.tree!,args.instanceId);
      if(domain.source.module!==args.expected.source.module||domain.source.exportName!==args.expected.source.exportName||
          !same(domain.axes,args.expected.axes)||!same(domain.heldProps,args.expected.heldProps)||
          !same(domain.plan.map(p=>p.changes),args.expected.rows.map(r=>r.changes)))fail('domain-changed');
      mkdirSync(args.dir,{recursive:true});
      const observation=await observeReactInitialStates({page,program,ownership,tree:captured.tree!,image:captured.sourcePngSha256!,
        instanceId:args.instanceId,selector:profile.path[0],dir:path.join(args.dir,'states'),failures,assertCurrent});
      if(!observation.planned||observation.problems.length||observation.rows.some(r=>r.status!=='observed'||!r.restored))
        fail('states-incomplete:'+observation.rows.find(r=>r.problem)?.problem);
      const snapshots=Object.fromEntries(observation.rows.map(row=>[row.id,JSON.parse(readFileSync(path.join(args.dir,'states',row.id+'.json'),'utf8')) as RepairSnapshot]));
      writeFileSync(path.join(args.dir,'original.json'),JSON.stringify({captured,ownership},null,2)+'\n',{flag:'wx'});
      assertCurrent();return {observation,snapshots};
    }finally{failures.dispose();}
  }finally{await browser.close();}
}

type RepairCandidate={source:{module:string};beforeSha256:string;afterSha256:string;edit:{before:string;after:string}};
type RepairOwnership={components:Array<{id:string;parent?:string|null;roots:string[];props?:unknown;source:{module:string;exportName:string;sourceSha256:string}}>};
/** The only ownership differences a class-token edit may make, mapped back so
 * that any other difference still compares unequal: the edited module's
 * source hash, and the same token in the className that a dependency the
 * edited owner renders at its root receives from it (the shadcn Switch
 * passes className to Radix's Switch.Root; docs/23 §D.173). Owners
 * themselves, and components that are not their descendants, never qualify. */
export function restoreRepairedOwnership<T extends RepairOwnership>(before:T,after:T,candidate:RepairCandidate,
  owners:Array<{id:string;root:string}>):T {
  const restored=structuredClone(after),byId=new Map(restored.components.map(c=>[c.id,c]));
  const renderedBy=(component:RepairOwnership['components'][number],ownerId:string)=>{
    const seen=new Set<string>();
    for(let parent=component.parent;parent&&!seen.has(parent);parent=byId.get(parent)?.parent){if(parent===ownerId)return true;seen.add(parent);}
    return false;
  };
  for(const component of restored.components) {
    const prior=before.components.find(c=>c.id===component.id);
    if(!prior)continue;
    if(component.source.module===candidate.source.module&&component.source.exportName===prior.source.exportName&&
        component.source.sourceSha256===candidate.afterSha256&&prior.source.sourceSha256===candidate.beforeSha256)
      component.source=structuredClone(prior.source);
    const props=component.props as Record<string,unknown>|undefined,priorProps=prior.props as Record<string,unknown>|undefined;
    if(!owners.some(o=>o.id===component.id)&&owners.some(o=>component.roots.includes(o.root)&&renderedBy(component,o.id))&&
        typeof props?.className==='string'&&typeof priorProps?.className==='string'&&
        props.className.split(' ').map(t=>t===candidate.edit.after?candidate.edit.before:t).join(' ')===priorProps.className)
      props.className=priorProps.className;
  }
  return restored;
}

/** Compare the entire mapped domain. The only tree differences permitted are
 * the precise root class token edit and the requested native root opacity.
 * Other recorded style/content/geometry facts and source ownership must match. */
export function verifyReactSourceRepairStates(before:RepairStateObservation,after:RepairStateObservation,
  variants:Array<{observation:string;variant:string}>,plan:RepairPlan,candidateIndex:number) {
  const candidate=plan.candidates[candidateIndex];if(!candidate)fail('candidate-unavailable');
  if(before.observation.planned!==variants.length||after.observation.planned!==variants.length||
      before.observation.rows.length!==variants.length||after.observation.rows.length!==variants.length||
      new Set(variants.map(v=>v.observation)).size!==variants.length||new Set(variants.map(v=>v.variant)).size!==variants.length||
      !same(before.observation.axes,after.observation.axes)||!same(before.observation.heldProps,after.observation.heldProps)||
      before.observation.problems.length||after.observation.problems.length)fail('domain-incomplete');
  const expected=new Map(plan.changes.map(c=>[c.variant,c]));
  if([...expected.keys()].some(name=>!variants.some(v=>v.variant===name)))fail('native-variant-unmapped');
  const rows=[];
  for(const variant of variants) {
    const oldRow=before.observation.rows.find(r=>r.id===variant.observation),newRow=after.observation.rows.find(r=>r.id===variant.observation);
    const old=before.snapshots[variant.observation],now=after.snapshots[variant.observation];
    if(!oldRow||!newRow||oldRow.status!=='observed'||newRow.status!=='observed'||!oldRow.restored||!newRow.restored||
        !same(oldRow.changes,newRow.changes)||!old||!now)fail('state-unverified');
    const owner=old.ownership.components.find(c=>c.id===before.observation.instanceId);
    const changedOwner=now.ownership.components.find(c=>c.id===after.observation.instanceId);
    if(!owner||!changedOwner||owner.roots.length!==1||!same(owner.roots,changedOwner.roots)||
        owner.source.module!==candidate.source.module||owner.source.exportName!==candidate.source.exportName||
        owner.source.sourceSha256!==candidate.beforeSha256||changedOwner.source.sourceSha256!==candidate.afterSha256)
      fail('owner-changed');
    const expectedTree=structuredClone(old.tree),root=flatten(expectedTree).find(r=>r.path===owner!.roots[0])?.node;
    const actualRoot=flatten(now.tree).find(r=>r.path===owner!.roots[0])?.node;
    if(!root||!actualRoot)fail('root-unavailable');
    root!.classes=root!.classes.map(c=>c===candidate.edit.before?candidate.edit.after:c);
    const change=expected.get(variant.variant),beforeOpacity=Number(root!.style.opacity),afterOpacity=Number(actualRoot!.style.opacity);
    if(isShadowSourceRepair(plan)) {
      // Both renders are read by the parser that compiled the canvas (§D.177).
      if(change) {
        if(!repairShadowShows(root!.style['box-shadow'],change.before)||!repairShadowShows(actualRoot!.style['box-shadow'],change.after))
          fail('shadow-mismatch:'+variant.observation);
        root!.style['box-shadow']=actualRoot!.style['box-shadow'];
      }
    } else if(change) {
      const before=change.before as number,after=change.after as number;
      if(!Number.isFinite(beforeOpacity)||!Number.isFinite(afterOpacity)||
          !(beforeOpacity===before||Math.fround(beforeOpacity)===Math.fround(before))||
          !(afterOpacity===after||Math.fround(afterOpacity)===Math.fround(after)))fail('opacity-mismatch:'+variant.observation);
      root!.style.opacity=actualRoot!.style.opacity;
    }
    if(!same(expectedTree,now.tree))fail('other-tree-facts-changed:'+variant.observation);
    const normalizedOwnership=restoreRepairedOwnership(old.ownership,now.ownership,candidate,[{id:owner!.id,root:owner!.roots[0]}]);
    if(!same(old.ownership,normalizedOwnership))fail('ownership-facts-changed:'+variant.observation);
    if(!same(comparableFacts(old),comparableFacts(now)))fail('supporting-facts-changed:'+variant.observation);
    for(const key of ['styleOrigin','bounds','descendantSizes'] as const)
      if(!same((old as any)[key],(now as any)[key]))fail(key+'-changed:'+variant.observation);
    if(!change&&old.image!==now.image)fail('unchanged-state-image-changed:'+variant.observation);
    rows.push({observation:variant.observation,variant:variant.variant,changed:!!change,
      beforeImage:old.image,afterImage:now.image,beforeOpacity,afterOpacity,
      ...(isShadowSourceRepair(plan)?{beforeShadow:String(old.tree&&flatten(old.tree).find(r=>r.path===owner!.roots[0])?.node.style['box-shadow']),
        afterShadow:String(actualRoot!.style['box-shadow'])}:{})});
  }
  return {qualification:'finite-source-effect-verified' as const,rows,
    limitations:['recorded-caller-context-and-finite-domain-only','source-write-not-authorized']};
}
