/** Bounded in-place correction of fixed absolute rectangle/ellipse leaves.
 * Owned allocation identities and every other observed fact remain unchanged. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback } from './native-source-observation.js';
import type { NativeContractUpdateInput, NativeOpacityUpdatePlan } from './native-contract-update.js';
import type { NodeSpec } from './emit-figma-script.js';
import type { NativeSourceReadback } from './native-source-observation.js';

interface Geometry { x:number; y:number; width:number; height:number; relativeTransform:number[][]; }
export interface NativeAbsoluteShapeUpdatePlan extends Omit<NativeOpacityUpdatePlan, 'version'|'kind'|'changes'> {
 version:7; kind:'native-contract-absolute-shape-update';
 /** Absent on historical plans, whose pinned programs must remain byte-identical. */
 resizeProtocol?:'without-constraints-v1'|'without-constraints-v2';
 changes:Array<{nodeId:string;variant:string;part:string;channel:'x'|'y'|'width'|'height';before:number;after:number}>;
 transitions:Array<{nodeId:string;before:Geometry;after:Geometry;constraints:{horizontal:'MIN';vertical:'MIN'}}>;
}

const same = (a:unknown,b:unknown) => canonicalJson(a) === canonicalJson(b);
const copy = <T>(v:T):T => structuredClone(v);
const finite = (v:unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e6;
const fail = (why:string):never => { throw Error('native-update-absolute-shape-' + why); };
const identity = (n:any) => { try { return JSON.parse(n.metadata.nativeContractPart); } catch { return null; } };
const clean = (r:any) => { const out=copy(r); delete out.images; return out; };
const constraints: {horizontal:"MIN";vertical:"MIN"} = { horizontal: 'MIN', vertical: 'MIN' };
const geometry = (v:any):Geometry => ({x:v.x,y:v.y,width:v.width,height:v.height,
  relativeTransform:copy(v.relativeTransform)});

function supported(spec:NodeSpec) {
  const a=spec.absolute,s=spec.shape;
  if(spec.type!=='shape'||!s||!['rect','ellipse'].includes(s.kind)||spec.children?.length||spec.rotation||s.rotation||s.arc||s.paths||
    spec.backgroundPaint||spec.insetOverlay||spec.fixedWidth||spec.fixedHeight||spec.bindings?.width||spec.bindings?.height||
    !a||a.h!=='MIN'||a.v!=='MIN'||a.right!==undefined||a.bottom!==undefined||
    ![a.left,a.top,s.width,s.height].every(finite)||s.width<0.01||s.height<0.01)
    fail('fixed-near-leaf-required');
}

export function prepareNativeAbsoluteShapeUpdate(input:NativeContractUpdateInput,
 prepareBase:(input:NativeContractUpdateInput)=>{plan:NativeOpacityUpdatePlan;revision:string}) {
  const sanitized=copy(input), changes:Array<{old:NodeSpec;next:NodeSpec;variant:number;path:number[]}>=[];
  const visit=(old:NodeSpec,next:NodeSpec|undefined,target:NodeSpec|undefined,variant:number,path:number[])=>{
    if(!next||!target)return;
    if(old.type==='shape' && (!same(old.shape,next.shape)||!same(old.absolute,next.absolute))) {
      supported(old);supported(next);
      if(!same({...old.shape,width:0,height:0},{...next.shape,width:0,height:0}) ||
        !same({...old.absolute,left:0,top:0},{...next.absolute,left:0,top:0}))fail('other-geometry-changed');
      changes.push({old,next,variant,path});target.shape=copy(old.shape);target.absolute=copy(old.absolute);
    }
    old.children?.forEach((c:any,i:number)=>visit(c,next.children?.[i],target.children?.[i],variant,[...path,i]));
  };
  input.before.component.variants.forEach((v:any,i:number)=>visit(v.spec,input.desired.component.variants[i]?.spec,sanitized.desired.component.variants[i]?.spec,i,[]));
  if(!changes.length)return null;
  const base=prepareBase(sanitized).plan;
  if(base.kind!=='native-contract-opacity-update'||base.changes.length||base.tokenChanges?.length)fail('mixed-channels');
  const plan:NativeAbsoluteShapeUpdatePlan={...base,version:7,kind:'native-contract-absolute-shape-update',resizeProtocol:'without-constraints-v2',changes:[],transitions:[]};
  for(const c of changes) {
    const rows=plan.baseline.nodes!.filter((n:any)=>same(identity(n),c.old.nativeContractPart));
    const row=rows[0],v=row?.values;
    if(rows.length!==1||row.type!==(c.old.shape!.kind==='rect'?'RECTANGLE':'ELLIPSE')||row.childIds.length||
      v.layoutPositioning!=='ABSOLUTE'||v.layoutSizingHorizontal!=='FIXED'||v.layoutSizingVertical!=='FIXED'||
      v.boundVariables?.width||v.boundVariables?.height||!['minWidth','maxWidth','minHeight','maxHeight'].every(k=>v[k]==null)||
      ![v.x,v.y,v.width,v.height].every(finite)||!same(v.relativeTransform,[[1,0,v.x],[0,1,v.y]]))fail('baseline-unqualified');
    if(v.targetAspectRatio!=null)fail('aspect-ratio-unqualified');
    if(v.constraints!==undefined&&!same(v.constraints,constraints))fail('constraint-baseline');
    const after={x:Math.fround(c.next.absolute!.left!),y:Math.fround(c.next.absolute!.top!),
      width:Math.fround(c.next.shape!.width),height:Math.fround(c.next.shape!.height),relativeTransform:[] as number[][]};
    after.relativeTransform=[[1,0,after.x],[0,1,after.y]];
    for(const k of ['cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])
      if(typeof v[k]==='number' && v[k]>Math.min(after.width,after.height)/2)fail('radius-resize-unqualified');
    const before=geometry(v);plan.transitions.push({nodeId:row.id,before,after,constraints});
    for(const channel of ['x','y','width','height'] as const) if(before[channel]!==after[channel])
      plan.changes.push({nodeId:row.id,variant:c.old.nativeContractPart!.variant,part:c.old.name,channel,before:before[channel],after:after[channel]});
    let spec=plan.after.component.variants[c.variant].spec;
    for(const i of c.path)spec=spec.children![i];
    spec.shape=copy(c.next.shape);spec.absolute=copy(c.next.absolute);
  }
  plan.after.absoluteShapeReadback={version:3,nodeIds:[...new Set([...(plan.before.absoluteShapeReadback?.nodeIds??[]),...plan.transitions.map((t:any)=>t.nodeId)])].sort()};
  return {plan,revision:revisionOf(plan)};
}

function normalized(plan:NativeAbsoluteShapeUpdatePlan,raw:unknown,complete:boolean,untouched=false) {
  const r=clean(raw as NativeSourceReadback);
  for(const id of plan.after.absoluteShapeReadback!.nodeIds) {
    const row=r.nodes?.find((n:any)=>n.id===id),baseline=plan.baseline.nodes!.find((n:any)=>n.id===id);
    if(!row||!baseline||!same(row.values.constraints,baseline.values.constraints??constraints))fail('constraints-conflict');
    if(baseline!.values.constraints===undefined)delete row.values.constraints;
    if(plan.after.absoluteShapeReadback!.version>=2){
      if(row.values.targetAspectRatio!==null)fail('aspect-ratio-conflict');
      if(baseline!.values.targetAspectRatio===undefined)delete row.values.targetAspectRatio;
    }
  }
  for(const t of plan.transitions) {
    const row=r.nodes?.find((n:any)=>n.id===t.nodeId);
    if(!row||!(untouched?same(geometry(row.values),t.before):complete?same(geometry(row.values),t.after):
      same(geometry(row.values),t.before)||same(geometry(row.values),t.after)))fail('geometry-conflict');
    Object.assign(row.values,t.before);
  }
  return r;
}
export function nativeAbsoluteShapeUpdateMatches(plan:NativeAbsoluteShapeUpdatePlan,r:unknown,complete=false,untouched=false) {
  try {const n=normalized(plan,r,complete,untouched);return same(n,plan.baseline)&&verifyNativeContractReadback(plan.before,n).status==='supported-structure-observed';}
  catch{return false;}
}

export function emitNativeAbsoluteShapeUpdateScript(plan:NativeAbsoluteShapeUpdatePlan,direction:'apply'|'rollback',readOnly:boolean) {
  const beforeRead={...plan.before,absoluteShapeReadback:plan.after.absoluteShapeReadback};
  const expected=direction==='apply'?plan.after:beforeRead;
  return `const plan=${JSON.stringify(plan)},direction=${JSON.stringify(direction)},readOnly=${readOnly};
const canonical=v=>JSON.stringify((function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,sort(x[k])]));return x;})(v));
const same=(a,b)=>canonical(a)===canonical(b),copy=v=>JSON.parse(JSON.stringify(v));
const clean=r=>{const n=copy(r);delete n.images;return n;};
const geometry=v=>({x:v.x,y:v.y,width:v.width,height:v.height,relativeTransform:copy(v.relativeTransform)});
const out={version:1,kind:'native-contract-update-result',direction,status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'},attempted=[];
const assign=(n,v)=>{n.${plan.resizeProtocol ? 'resizeWithoutConstraints' : 'resize'}(v.width,v.height);n.x=v.x;n.y=v.y;};
const normalize=(raw,complete)=>{
 const r=clean(raw);
 for(const id of plan.after.absoluteShapeReadback.nodeIds){const row=r.nodes?.find(n=>n.id===id),old=plan.baseline.nodes.find(n=>n.id===id);
  if(!row||!old||!same(row.values.constraints,old.values.constraints??{horizontal:'MIN',vertical:'MIN'}))throw Error('native-update-absolute-shape-constraints-conflict');
  if(old.values.constraints===undefined)delete row.values.constraints;${plan.resizeProtocol ? `
  if(row.values.targetAspectRatio!==null)throw Error('native-update-absolute-shape-aspect-ratio-conflict');
  if(old.values.targetAspectRatio===undefined)delete row.values.targetAspectRatio;` : ''}}
 for(const t of plan.transitions){const row=r.nodes?.find(n=>n.id===t.nodeId),g=geometry(row?.values??{});
  if(!row||!(same(g,t.after)||!complete&&same(g,t.before)))throw Error('native-update-absolute-shape-geometry-conflict');Object.assign(row.values,t.before);}
 return r;
};
try {
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const nodes=new Map();for(const t of plan.transitions){const n=await figma.getNodeByIdAsync(t.nodeId);if(!n)throw Error('native-update-node-missing');nodes.set(t.nodeId,n);}
 const current=await(async()=>{${emitNativeContractReadbackScript(beforeRead)}})();${plan.resizeProtocol === 'without-constraints-v2' ? `
 if(current.problems?.includes('native-absolute-shape-aspect-ratio-unavailable'))throw Error('native-update-absolute-shape-aspect-ratio-unavailable');` : ''}
 if(!same(normalize(current,false),plan.baseline))throw Error('native-update-baseline-conflict');
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 for(const t of plan.transitions){const n=nodes.get(t.nodeId),r=current.nodes.find(r=>r.id===t.nodeId);
  if(!same(geometry(n),geometry(r.values))||!same(n.constraints,t.constraints)||n.boundVariables?.width||n.boundVariables?.height${plan.resizeProtocol === 'without-constraints-v2' ? '||n.targetAspectRatio!==null' : plan.resizeProtocol ? '||n.targetAspectRatio!=null' : ''}||n.layoutPositioning!=='ABSOLUTE'||n.layoutSizingHorizontal!=='FIXED'||n.layoutSizingVertical!=='FIXED')throw Error('native-update-absolute-shape-live-conflict');}
 for(const t of plan.transitions){const n=nodes.get(t.nodeId),target=direction==='apply'?t.after:t.before;if(same(geometry(n),target))continue;
  attempted.push({node:n,previous:geometry(n),target,constraints:t.constraints});assign(n,target);out.changes.push(t.nodeId);}
 out.observation=await(async()=>{${emitNativeContractReadbackScript(expected)}})();
 const normalized=normalize(out.observation,direction==='apply');
 if(direction==='rollback'&&plan.transitions.some(t=>!same(geometry(out.observation.nodes.find(n=>n.id===t.nodeId).values),t.before)))throw Error('native-update-absolute-shape-rollback-conflict');
 if(!same(normalized,plan.baseline))throw Error('native-update-postcondition-conflict');
 out.status=out.changes.length?'updated':'no-op';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
 for(const a of attempted.reverse())try{
  if(same(a.node.constraints,a.constraints)&&!a.node.boundVariables?.width&&!a.node.boundVariables?.height&&${plan.resizeProtocol === 'without-constraints-v2' ? 'a.node.targetAspectRatio===null&&' : plan.resizeProtocol ? 'a.node.targetAspectRatio==null&&' : ''}
    ['x','y','width','height'].every(k=>a.node[k]===a.previous[k]||a.node[k]===a.target[k]))assign(a.node,a.previous);
  if(!same(geometry(a.node),a.previous))unrestored.push(a.node.id);
 }catch{unrestored.push(a.node.id);}
 out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
