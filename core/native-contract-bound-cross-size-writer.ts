/** Version-9 writer for the measured, bounded native cross-size transition. */
import {emitNativeContractReadbackScript, emitNativeFixedCrossSizeSyncReadback} from './native-source-observation.js';
import {emitNativeBoundCrossSizeScope} from './native-bound-cross-size-scope.js';
import {nativeBoundCrossSizeObservationMatches} from './native-bound-cross-size-observation.js';
import type {NativeBoundCrossSizeUpdatePlan} from './native-contract-bound-cross-size-update.js';

/** The emitted comparison must agree with the pure host matcher. It compares
 * the complete inventory after normalizing only declared coupled transitions. */
export function emitNativeBoundCrossSizeMatcher(): string {
  return `const canonical=v=>JSON.stringify((function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,sort(x[k])]));return x;})(v));
const same=(a,b)=>canonical(a)===canonical(b),copy=v=>JSON.parse(JSON.stringify(v));
const clean=v=>{const r=copy(v);delete r.images;return r;};
const has=(v,w)=>Object.entries(w).every(([k,x])=>same(v[k],x));
const matches=(raw,required='partial')=>{try{
 if(!['partial','before','after'].includes(required)||!Number.isFinite(plan.variable.before)||!Number.isFinite(plan.variable.after)||Math.fround(plan.variable.before)===Math.fround(plan.variable.after)||!plan.derived.length)return false;
 const baseline=clean(plan.baseline),current=clean(raw);
 if(baseline.status!=='native-readback-collected'||baseline.problems.length||current.status!=='native-readback-collected'||current.problems.length)return false;
 const oldRows=new Map(baseline.nodes?.map(n=>[n.id,n])),rows=new Map(current.nodes?.map(n=>[n.id,n]));
 if(!oldRows.size||oldRows.size!==baseline.nodes?.length||rows.size!==current.nodes?.length)return false;
 const vars=r=>(r.tokens?.receipt?.variables??[]).filter(v=>v.id===plan.variable.id),oldVars=vars(baseline),newVars=vars(current);
 if(oldVars.length!==1||newVars.length!==1||oldVars[0].valuesByMode?.[plan.variable.modeId]!==plan.variable.before)return false;
 const actual=newVars[0].valuesByMode?.[plan.variable.modeId],side=actual===plan.variable.before?'before':actual===plan.variable.after||actual===Math.fround(plan.variable.after)?'after':null;
 if(!side||required!=='partial'&&side!==required)return false;
 const seen=new Set();
 for(const [transitions,coupled] of [[plan.derived,true],[plan.absolute,false]])for(const t of transitions){
  const row=rows.get(t.nodeId),old=oldRows.get(t.nodeId);
  if(seen.has(t.nodeId)||!row||!old||!Object.keys(t.before).length||!same(Object.keys(t.before).sort(),Object.keys(t.after).sort())||!has(old.values,t.before))return false;
  seen.add(t.nodeId);
  if(!(coupled||required!=='partial'?has(row.values,t[coupled?side:required]):has(row.values,t.before)||has(row.values,t.after)))return false;
  Object.assign(row.values,copy(t.before));
 }
 newVars[0].valuesByMode[plan.variable.modeId]=plan.variable.before;
 return same(current,baseline);
}catch{return false;}};`;
}

export function emitNativeBoundCrossSizeUpdateScript(plan:NativeBoundCrossSizeUpdatePlan,
  direction:'apply'|'rollback'='apply',readOnly=false):string {
  if(plan.version!==9||plan.kind!=='native-contract-bound-cross-size-update'||plan.acceptedContract!==null||
      plan.nativeQualification!=='unqualified'||!['apply','rollback'].includes(direction)||
      !nativeBoundCrossSizeObservationMatches(plan,plan.baseline,'before'))
    throw Error('native-update-bound-cross-size-plan-invalid');
  const expected=direction==='apply'?plan.after:plan.before;
  const sync=emitNativeFixedCrossSizeSyncReadback(plan.before),scope=emitNativeBoundCrossSizeScope(plan.scope);
  return `const plan=${JSON.stringify(plan)},direction=${JSON.stringify(direction)},readOnly=${readOnly};
${emitNativeBoundCrossSizeMatcher()}
const out={version:1,kind:'native-contract-update-result',direction,status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const geometry=v=>({x:v.x,y:v.y,width:v.width,height:v.height,relativeTransform:copy(v.relativeTransform)});
const assign=(n,v)=>{n.resizeWithoutConstraints(v.width,v.height);n.x=v.x;n.y=v.y;};
const attempted=[];let start;
try{
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const initial=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})();
 if(!matches(initial))throw Error('native-update-bound-cross-size-baseline-conflict');
 await figma.loadAllPagesAsync();await figma.variables.getLocalVariableCollectionsAsync();
 ${scope}
 // No yield from the final whole-document scan through every assignment.
 const current=(()=>{${sync}})();
 if(!matches(current))throw Error('native-update-bound-cross-size-live-conflict');
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 const variable=figma.variables.getVariableById(plan.variable.id),nodes=new Map();
 if(!variable||typeof variable.setValueForMode!=='function')throw Error('native-update-bound-cross-size-variable-api-unavailable');
 for(const t of plan.absolute){const n=figma.getNodeById(t.nodeId);if(!n||typeof n.resizeWithoutConstraints!=='function')throw Error('native-update-bound-cross-size-resize-api-unavailable');nodes.set(t.nodeId,n);}
 start=clean(current);const target=direction==='apply'?'after':'before';
 if(variable.valuesByMode[plan.variable.modeId]!==plan.variable[target]){
  attempted.push({kind:'variable',previous:variable.valuesByMode[plan.variable.modeId]});
  variable.setValueForMode(plan.variable.modeId,plan.variable[target]);
  out.changes.push(plan.variable.id,...plan.derived.map(t=>t.nodeId));
 }
 for(const t of plan.absolute){const node=nodes.get(t.nodeId);if(same(geometry(node),t[target]))continue;
  attempted.push({kind:'absolute',nodeId:t.nodeId,previous:geometry(node)});assign(node,t[target]);out.changes.push(t.nodeId);
 }
 out.observation=await(async()=>{${emitNativeContractReadbackScript(expected)}})();
 if(!matches(out.observation,target))throw Error('native-update-bound-cross-size-postcondition-conflict');
 out.status=attempted.length?'updated':'no-op';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));
 if(!attempted.length)return out;
 // Recovery starts with another full consumer scan and exact live comparison.
 // An independent edit, foreign consumer or unknown propagation state is kept.
 try{
  await figma.loadAllPagesAsync();await figma.variables.getLocalVariableCollectionsAsync();
  ${scope}
  const current=(()=>{${sync}})();
  if(!matches(current))throw Error('native-update-bound-cross-size-recovery-conflict');
  for(const attempt of [...attempted].reverse()){
   if(attempt.kind==='absolute')assign(figma.getNodeById(attempt.nodeId),attempt.previous);
   else figma.variables.getVariableById(plan.variable.id).setValueForMode(plan.variable.modeId,attempt.previous);
  }
  out.recoveryObservation=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})();
  if(!same(clean(out.recoveryObservation),start))throw Error('native-update-bound-cross-size-restoration-conflict');
  out.status='rolled-back';out.unrestored=[];
 }catch(recovery){
  out.status='recovery-required';out.problems.push(recovery&&recovery.message?recovery.message:String(recovery));
  out.unrestored=[...new Set(attempted.map(a=>a.kind==='variable'?plan.variable.id:a.nodeId))];
 }
}
return out;`;
}
