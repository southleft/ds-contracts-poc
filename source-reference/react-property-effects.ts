/** Finite source-property observations. One property varies at a time; this is
 * input to assembly, not a claim about interactions or arbitrary behavior. */
import type {Page} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {captureJs} from '../extract/computed/capture.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactSourceProgram} from './react-source-program.js';
import {reactOwnershipRead,type ReactOwnership} from './react-ownership.js';
import {linkReactSourceAnatomy,nestedReactHostPaths} from './react-source-anatomy.js';
import {probeReactPropertyBaseline,probeReactProperties,probeReactInitialProperties,type ReactPropertyValue,type ReactPropertyChanges} from './react-property-probe.js';
import {observeTextFonts} from './text-fonts.js';
import {observeSvgViewports} from './svg-viewports.js';
import {hasUnpaintedPseudoBoxes,observePseudoBoxes} from './pseudo-boxes.js';
import {sourceBounds} from './source-framing.js';
import {readReactDescendantSizes,readReactStyleOrigin} from './react-style-origin.js';
import {observeGridConstraints,hasGridContainer} from './grid-constraints.js';
import {projectReactRootVisual} from './react-root-visual.js';
import {evidenceSha} from './react-validation-evidence.js';

export interface ReactPropertyEffects {
 version:1;
 qualification:'one-property-at-a-time';
 instanceId:string;
 source:ReactOwnership['components'][number]['source'];
 heldProps:ReactOwnership['components'][number]['props'];
 planned:number;
 skipped:Array<{property:string;reason:string}>;
 rows:Array<{id:string;property:string;requested:ReactPropertyValue;status:'observed'|'refused';
  propertyCaptureVersion?:2;image?:string;treeSha256?:string;fontsSha256?:string;boundsSha256?:string;visibleChange?:boolean;treeChange?:boolean;restored?:boolean;restoredAfterLayoutRebuild?:boolean;
  changedInstances?:Array<{instanceId:string;name:string;channels:string[]}>;problem?:string}>;
 problems:string[];
}
const reserved=new Set(['children','className','style','ref','key','id','__proto__','constructor','prototype']);
export function planReactPropertyEffects(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode,instanceId:string){
 const anatomy=linkReactSourceAnatomy(program,ownership,tree);
 const instance=ownership.components.find(c=>c.id===instanceId),linked=anatomy.instances.find(i=>i.instanceId===instanceId);
 if(anatomy.status!=='linked'||!instance||!linked)throw Error('react-property-effects-source-unqualified');
 const source=program.components.find(c=>c.module===instance.source.module&&c.exportName===instance.source.exportName&&c.sourceSha256===instance.source.sourceSha256&&c.span.start===instance.source.span.start&&c.span.end===instance.source.span.end)!;
 const plan:Array<{property:string;requested:ReactPropertyValue}>=[],skipped:ReactPropertyEffects['skipped']=[];
 for(const prop of source.props){
  if(reserved.has(prop.name))continue;
  // Forwarded HTML APIs are not a new variant axis on every source component.
  if(prop.declaredIn.length&&prop.declaredIn.every(d=>/(?:^|\/)node_modules\/@types\/react\//.test(d.file)))continue;
  const members=(prop.type.kind==='union'?prop.type.members:[prop.type]).filter(m=>m.kind!=='undefined');
  const reason=linked.content!=='caller-slot'||linked.roots.length!==1||linked.roots[0].correspondence==='runtime-dependent'
   ?'source-content-needs-mapping'
   :!members.length||!members.every(m=>m.kind==='null'||m.kind==='literal'&&typeof m.value==='string')
    ?'not-a-finite-string-style-axis':undefined;
  if(reason){skipped.push({property:prop.name,reason});continue;}
  for(const m of members)plan.push({property:prop.name,requested:{kind:'set',value:m.kind==='literal'?m.value:null}});
  if(prop.optional)plan.push({property:prop.name,requested:{kind:'omit'}});
 }
 if(plan.length>64)throw Error('react-property-effects-observation-limit');
 return {plan,skipped,source:instance.source,heldProps:instance.props};
}

/** Called only inside the host's isolated, resource-locked source context,
 * after its untouched and observed source renders have matched. */
export interface ReactPropertyObservationArgs {
 page:Page;program:ReactSourceProgram;ownership:ReactOwnership;tree:CapturedNode;image:string;
 instanceId:string;selector:string;stageSelector?:string;dir:string;assertCurrent:()=>void;
 failures:{runtimeErrors:string[];failedResources:string[]};
 observationMode?:'live-update'|'initial-mount';
}
export type ReactPropertyObservation=Omit<ReactPropertyEffects['rows'][number],'property'|'requested'>;

/** Both single-axis and joint observations use the same capture/restoration boundary. */
export async function observeReactPropertyPlan<P extends {changes:ReactPropertyChanges;baseline?:true}>(args:ReactPropertyObservationArgs,plan:P[]){
 const {page,program,ownership,tree,instanceId,selector,dir}=args;
 const result:{rows:Array<P&ReactPropertyObservation>;problems:string[]}={rows:[],problems:[]};
 if(!plan.length)return result;
 mkdirSync(dir,{recursive:true});
 const originalTree=evidenceSha(JSON.stringify(tree));
 const observe=async()=>{
  args.assertCurrent();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState==='finished'||a.playState==='idle'),null,{timeout:5000});
  const read=()=>page.evaluate(captureJs(args.stageSelector??'#root',undefined,'--',[selector])) as Promise<CapturedNode>;
  const current=await read(),png=await page.screenshot({fullPage:true,caret:'initial'});
  const own=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  const styles=await readReactStyleOrigin(page,selector,own,args.stageSelector??'#root',nestedReactHostPaths(program,own,current));
  // Declared tracks exist only before layout; a plane without a grid container records nothing.
  const grids=current&&hasGridContainer(current)?{gridConstraints:await observeGridConstraints(page,[selector],current)}:{};
  const fonts=await observeTextFonts(page,[selector],current),fontsSha256=evidenceSha(JSON.stringify(fonts));
  // Preserve the full-page image's actual origin and box, including fractional
  // coordinates. Old archives remain unmeasured; no origin is inferred for them.
  const bounds=await sourceBounds(page,{path:[selector]}),boundsSha256=evidenceSha(JSON.stringify(bounds));
  const contentEvidence=args.observationMode==='initial-mount'?{
   svg:await observeSvgViewports(page,[selector],current),
   ...(hasUnpaintedPseudoBoxes(current)?{pseudoBoxes:await observePseudoBoxes(page,[selector],current)}:{}),
   // Where a part BELOW the root declares its own size. Initial mounts only: their contract assembles descendants.
   descendantSizes:await readReactDescendantSizes(page,selector,own,args.stageSelector??'#root'),
  }:{};
  let initialSelection;
  if(args.observationMode==='initial-mount'){
   const target=own.components.find(c=>c.id===instanceId);
   if(!target||target.roots.length!==1)throw Error('react-initial-selection-unavailable');
   const selectedPath=target.roots[0];
   if(selectedPath){
    if(!/^\d+(?:\.\d+)*$/.test(selectedPath))throw Error('react-initial-selection-invalid');
    const selected=selector+selectedPath.split('.').map(i=>' > :nth-child('+(Number(i)+1)+')').join('');
    initialSelection={instanceId,path:selectedPath,bounds:await sourceBounds(page,{path:[selected]})};
   }
  }
  if(!current||JSON.stringify(current)!==JSON.stringify(await read())||evidenceSha(png)!==evidenceSha(await page.screenshot({fullPage:true,caret:'initial'}))||
   boundsSha256!==evidenceSha(JSON.stringify(await sourceBounds(page,{path:[selector]}))))throw Error('react-property-effects-render-unstable');
  if(args.failures.runtimeErrors.length||args.failures.failedResources.length)throw Error('react-property-effects-source-failed');
  if(own.problems.length)throw Error('react-property-effects-ownership-unqualified');
  args.assertCurrent();
  return {propertyCaptureVersion:2 as const,tree:current,treeSha256:evidenceSha(JSON.stringify(current)),image:evidenceSha(png),png,ownership:own,styleOrigin:styles,fonts,fontsSha256,bounds,boundsSha256,...grids,...contentEvidence,...(initialSelection?{initialSelection}:{})};
 };
 let usable=true;
 let originalFontsSha256:string|undefined;
 let originalBoundsSha256:string|undefined;
 for(const [index,entry] of plan.entries()){
  const row:P&ReactPropertyObservation={id:String(index),...entry,status:'refused'};result.rows.push(row);
  if(!usable){row.problem='prior-observation-invalidated-context';continue;}
  try{
   if(entry.baseline && (Object.keys(entry.changes).length || args.observationMode==='initial-mount'))throw Error('react-property-baseline-plan-invalid');
   const probe=entry.baseline
    ?await probeReactPropertyBaseline(page,selector,program,instanceId,observe)
    :await (args.observationMode==='initial-mount'?probeReactInitialProperties:probeReactProperties)(page,selector,program,instanceId,entry.changes,observe);
   if(entry.baseline && (JSON.stringify(probe.before)!==JSON.stringify(probe.changed)||JSON.stringify(probe.before)!==JSON.stringify(probe.restored)))
    throw Error('react-property-baseline-render-changed');
   // After any style change Chromium can rasterize an unchanged rounded edge
   // one 8-bit level apart from its first paint, and keeps doing so; rebuilding
   // the document's layout tree returns the first-paint raster exactly. When
   // the restored TREE already equals the original, capture once more after
   // that rebuild. The comparison stays exact and the row records the rebuild.
   let restored=probe.restored,layoutRebuilt=false;
   if(probe.ownershipRestored&&restored.treeSha256===originalTree&&restored.image!==args.image){
    await page.evaluate(()=>new Promise<void>(done=>{const html=document.documentElement,display=html.style.display;html.style.display='none';void html.offsetHeight;
     requestAnimationFrame(()=>{html.style.display=display;requestAnimationFrame(()=>done());});}));
    restored=await observe();layoutRebuilt=true;
   }
   // Name WHICH witness disagreed: a probe page that never matched the sealed
   // original is a different defect from a render that did not come back.
   originalFontsSha256??=probe.before.fontsSha256;
   originalBoundsSha256??=probe.before.boundsSha256;
   const unrestored=[!probe.ownershipRestored&&'ownership',probe.before.treeSha256!==originalTree&&'before-tree',probe.before.image!==args.image&&'before-image',
    probe.before.fontsSha256!==originalFontsSha256&&'before-fonts',restored.fontsSha256!==originalFontsSha256&&'restored-fonts',
    probe.before.boundsSha256!==originalBoundsSha256&&'before-bounds',restored.boundsSha256!==originalBoundsSha256&&'restored-bounds',
    restored.treeSha256!==originalTree&&'restored-tree',restored.image!==args.image&&'restored-image'].filter(Boolean);
   if(unrestored.length)throw Error('react-property-effects-original-not-restored:'+unrestored.join(';'));
   const before=linkReactSourceAnatomy(program,probe.before.ownership,probe.before.tree);
   const changed=linkReactSourceAnatomy(program,probe.changed.ownership,probe.changed.tree);
   if(before.status!=='linked'||changed.status!=='linked')throw Error('react-property-effects-anatomy-unqualified');
   const projection=projectReactRootVisual(program,probe.changed.ownership,probe.changed.tree,probe.changed.styleOrigin,undefined,undefined,probe.changed.gridConstraints);
   const changedInstances=changed.instances.map(i=>{
    const prior=before.instances.find(b=>b.instanceId===i.instanceId);
    if(!prior||JSON.stringify(prior.source)!==JSON.stringify(i.source))throw Error('react-property-effects-instance-changed');
    const channels=new Set<string>();
    for(const [n,root] of i.roots.entries()){
     const old=prior.roots[n];if(!old||old.path!==root.path||old.tag!==root.tag)throw Error('react-property-effects-root-changed');
     for(const key of new Set([...Object.keys(old.observation.style),...Object.keys(root.observation.style)]))
      if(old.observation.style[key]!==root.observation.style[key])channels.add(key);
    }
    return {instanceId:i.instanceId,name:i.source.exportName,channels:[...channels].sort()};
   }).filter(i=>i.channels.length);
   const snapshot={...probe.changed,png:undefined,projection};
   writeFileSync(path.join(dir,row.id+'.json'),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
   writeFileSync(path.join(dir,row.id+'.png'),probe.changed.png,{flag:'wx'});
   Object.assign(row,{propertyCaptureVersion:probe.changed.propertyCaptureVersion,status:'observed',image:probe.changed.image,treeSha256:probe.changed.treeSha256,fontsSha256:probe.changed.fontsSha256,boundsSha256:probe.changed.boundsSha256,
    visibleChange:probe.changed.image!==args.image,treeChange:probe.changed.treeSha256!==originalTree,restored:true,...(layoutRebuilt?{restoredAfterLayoutRebuild:true}:{}),changedInstances});
  }catch(error){
   row.problem=error instanceof Error?error.message:String(error);
   // Do not carry a failed or unrestored page into another measurement.
   usable=false;result.problems.push('property-observation-context-invalidated');
  }
 }
 return result;
}

export async function observeReactPropertyEffects(args:ReactPropertyObservationArgs):Promise<ReactPropertyEffects>{
 const {plan,...facts}=planReactPropertyEffects(args.program,args.ownership,args.tree,args.instanceId);
 const observed=await observeReactPropertyPlan(args,plan.map(p=>({...p,changes:{[p.property]:p.requested}})));
 const result:ReactPropertyEffects={version:1,qualification:'one-property-at-a-time',instanceId:args.instanceId,...facts,planned:plan.length,
  ...observed,rows:observed.rows.map(({changes:_,...row})=>row)};
 mkdirSync(args.dir,{recursive:true});writeFileSync(path.join(args.dir,'report.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
