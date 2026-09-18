/** Correct viewBox-only SVG imports whose paths were resized but strokes were
 * not. No geometry, paint, bindings or allocation identities are rewritten. */
import {canonicalJson,revisionOf} from './contract-provenance.js';
import type {NodeSpec} from './emit-figma-script.js';
import {emitNativeContractReadbackScript,verifyNativeContractReadback,type NativeSourceReadback} from './native-source-observation.js';
import type {NativeContractUpdateInput,NativeOpacityUpdatePlan} from './native-contract-update.js';

export interface NativeSvgUpdatePlan extends Omit<NativeOpacityUpdatePlan,'version'|'kind'|'changes'> {
 version:4;kind:'native-contract-svg-update';
 changes:Array<{nodeId:string;variant:string;part:string;channel:'strokeWeight';before:number;after:number}>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const clean=(r:NativeSourceReadback)=>{const copy=structuredClone(r);delete copy.images;return copy;};
const identity=(n:Record<string,any>)=>{try{return JSON.parse(n.metadata.nativeContractPart);}catch{return null;}};

function viewportChange(old:NodeSpec,next:NodeSpec) {
 const svg=old.svg,tag=svg?.match(/^<svg\b[^>]*>/)?.[0],size=old.iconSize;
 if(!svg||!tag||!size||!Number.isFinite(size)||size<=0||next.iconSize!==size||/\s(?:width|height)\s*=/.test(tag))
  throw Error('native-update-svg-viewport-unqualified');
 const expected=svg.replace(/^<svg\b/,`<svg height="${size}" width="${size}"`);
 if(next.svg!==expected)throw Error('native-update-svg-markup-change-unqualified');
 const box=tag.match(/\sviewBox=(?:"([^"]*)"|'([^']*)')/);
 const values=(box?.[1]??box?.[2]??'').trim().split(/[\s,]+/).map(Number);
 if(values.length!==4||!values.every(Number.isFinite)||values[2]<=0||values[2]!==values[3])throw Error('native-update-svg-uniform-viewport-required');
 // Only simple paths with uniform authored stroke weights. Nested transforms,
 // CSS, dash patterns, markers and non-scaling strokes need distinct rules.
 const tags=svg.match(/<[^>]+>/g)??[];
 const paths=tags.filter(t=>/^<path\s/.test(t));
 if(!paths.length||tags.some(t=>!/^<(?:svg\s|path\s|\/svg\s*>|\/path\s*>)/.test(t))||
   /\s(?:style|class|transform|vector-effect|stroke-dasharray|stroke-dashoffset|marker[^\s=]*)\s*=/i.test(svg))
  throw Error('native-update-svg-paths-unqualified');
 const weights=paths.map(t=>{
  const match=t.match(/\sstroke-width=(?:"([^"]*)"|'([^']*)')/);
  const value=match?.[1]??match?.[2];
  if(!value||!/^\d+(?:\.\d+)?$/.test(value)||Number(value)<=0||!/\sstroke=(?:"(?!none")[^"]+"|'(?!none')[^']+')/.test(t))
   throw Error('native-update-svg-stroke-unqualified');
  return Number(value);
 });
 if(weights.some(w=>w!==weights[0]))throw Error('native-update-svg-mixed-strokes-unqualified');
 return {factor:size/values[2],weight:weights[0],paths:paths.length};
}

export function prepareNativeSvgUpdate(input:NativeContractUpdateInput,
 prepareBase:(input:NativeContractUpdateInput)=>{plan:NativeOpacityUpdatePlan;revision:string}) {
 const sanitized=structuredClone(input),changes:Array<{old:NodeSpec;next:NodeSpec;variant:number;path:number[]}>=[];
 function visit(old:NodeSpec,next:NodeSpec|undefined,target:NodeSpec|undefined,variant:number,path:number[]) {
  if(!next||!target)return; // The base planner reports topology differences.
  if(old.type==='svg'&&old.svg!==next.svg) {
   viewportChange(old,next);changes.push({old,next,variant,path});target.svg=old.svg;
  }
  old.children?.forEach((child,i)=>visit(child,next.children?.[i],target.children?.[i],variant,[...path,i]));
 }
 input.before.component.variants.forEach((v,i)=>visit(v.spec,input.desired.component.variants[i]?.spec,sanitized.desired.component.variants[i]?.spec,i,[]));
 if(!changes.length)return null;
 const base=prepareBase(sanitized).plan;
 if(base.changes.length)throw Error('native-update-svg-mixed-channels-unqualified');
 const plan:NativeSvgUpdatePlan={...base,version:4,kind:'native-contract-svg-update',changes:[]};
 for(const change of changes) {
  const {old,next}=change,{factor,weight,paths}=viewportChange(old,next);
  const rows=base.baseline.nodes!.filter(n=>same(identity(n),old.nativeContractPart));
  const roots=rows.filter(n=>!rows.some(p=>p.id===n.parentId)),vectors=rows.filter(n=>n.type==='VECTOR');
  if(roots.length!==1||roots[0].type!=='FRAME'||roots[0].values.width!==old.iconSize||roots[0].values.height!==old.iconSize||
    rows.length!==vectors.length+1||vectors.length!==paths)throw Error('native-update-svg-inventory-unqualified');
  for(const row of vectors) {
   const value=row.values.strokeWeight;
   if(value!==Math.fround(weight)||row.values.boundVariables?.strokeWeight||!row.values.strokes?.length||
     !Array.isArray(row.values.vectorPaths)||!row.values.vectorPaths.length)throw Error('native-update-svg-stroke-baseline-unqualified');
   const after=Math.fround(value*factor);
   if(!Number.isFinite(after)||after<=0)throw Error('native-update-svg-stroke-invalid');
   if(value!==after)plan.changes.push({nodeId:row.id,variant:old.nativeContractPart!.variant,part:old.name,channel:'strokeWeight',before:value,after});
  }
  let spec=plan.after.component.variants[change.variant].spec;
  for(const i of change.path)spec=spec.children![i];
  spec.svg=next.svg;
 }
 return {plan,revision:revisionOf(plan)};
}

export function nativeSvgUpdateMatches(plan:NativeSvgUpdatePlan,receipt:unknown,complete=false) {
 try {
  const normalized=clean(receipt as NativeSourceReadback);
  for(const c of plan.changes) {
   const row=normalized.nodes?.find(n=>n.id===c.nodeId);
   if(!row||!(complete?[c.after]:[c.before,c.after]).includes(row.values.strokeWeight))return false;
   row.values.strokeWeight=c.before;
  }
  return same(normalized,plan.baseline)&&verifyNativeContractReadback(plan.before,normalized).status==='supported-structure-observed';
 }catch{return false;}
}

export function emitNativeSvgUpdateScript(plan:NativeSvgUpdatePlan,direction:'apply'|'rollback',readOnly:boolean) {
 const expected=direction==='apply'?plan.after:plan.before;
 return `const plan=${JSON.stringify(plan)},direction=${JSON.stringify(direction)},readOnly=${readOnly};
const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const copy=value=>JSON.parse(JSON.stringify(value));
const clean=value=>{const r=copy(value);delete r.images;return r;};
const out={version:1,kind:'native-contract-update-result',direction,status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'},attempted=[];
try {
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const nodes=new Map();
 for(const c of plan.changes){const node=await figma.getNodeByIdAsync(c.nodeId);if(!node||node.type!=='VECTOR')throw Error('native-update-svg-node-missing');nodes.set(c.nodeId,node);}
 const current=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})(),normalized=clean(current);
 for(const c of plan.changes){const row=normalized.nodes?.find(n=>n.id===c.nodeId),node=nodes.get(c.nodeId);
  if(!row||![c.before,c.after].includes(row.values.strokeWeight)||node.strokeWeight!==row.values.strokeWeight||node.boundVariables?.strokeWeight)throw Error('native-update-svg-stroke-conflict');
  row.values.strokeWeight=c.before;}
 if(canonical(normalized)!==canonical(clean(plan.baseline)))throw Error('native-update-baseline-conflict');
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 for(const c of plan.changes){const node=nodes.get(c.nodeId),target=direction==='apply'?c.after:c.before;
  if(node.strokeWeight===target)continue;
  attempted.push({node,previous:node.strokeWeight,target});node.strokeWeight=target;out.changes.push(c.nodeId);}
 out.observation=await(async()=>{${emitNativeContractReadbackScript(expected)}})();
 const after=clean(out.observation);
 for(const c of plan.changes){const row=after.nodes?.find(n=>n.id===c.nodeId);if(!row||row.values.strokeWeight!==(direction==='apply'?c.after:c.before))throw Error('native-update-svg-postcondition');row.values.strokeWeight=c.before;}
 if(canonical(after)!==canonical(clean(plan.baseline)))throw Error('native-update-postcondition-conflict');
 out.status=out.changes.length?'updated':'no-op';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
 for(const a of attempted.reverse())try{if(a.node.strokeWeight===a.target)a.node.strokeWeight=a.previous;if(a.node.strokeWeight!==a.previous)unrestored.push(a.node.id);}catch{unrestored.push(a.node.id);}
 out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
