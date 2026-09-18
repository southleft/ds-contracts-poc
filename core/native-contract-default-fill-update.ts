/** Recover an unaccepted draft with the exact invisible paint supplied by
 * createComponent. This does not relax structural verification or accept other
 * paints: removing only this field must make the whole observation valid. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';
import type { NativeContractUpdateInput, NativeOpacityUpdatePlan } from './native-contract-update.js';

export const NATIVE_DEFAULT_FILL = [{ type: 'SOLID', visible: false, opacity: 1, blendMode: 'NORMAL',
  color: { r: 1, g: 1, b: 1 }, boundVariables: {} }];
export interface NativeDefaultFillUpdatePlan extends Omit<NativeOpacityUpdatePlan, 'version' | 'kind' | 'changes'> {
  version: 6; kind: 'native-contract-default-fill-update';
  changes: Array<{ nodeId: string; variant: string; part: string; channel: 'unrequested-fill'; before: 'Invisible default white paint'; after: 'No paint' }>;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clean = (raw: NativeSourceReadback) => { const value = structuredClone(raw); delete value.images; return value; };
export function nativeDefaultFillRepairBaseline(before: NativeContractObservationInput, raw: NativeSourceReadback) {
  const baseline = clean(raw), changes: NativeDefaultFillUpdatePlan['changes'] = [];
  for (const variant of before.component.variants) {
    const spec = variant.spec;
    if (spec.type !== 'root' || !spec.nativeContractPart || spec.fill || spec.lits?.fillColor || spec.gradient) continue;
    const rows = baseline.nodes?.filter(n => n.metadata.nativeContractPart === JSON.stringify(spec.nativeContractPart));
    if (rows?.length !== 1 || rows[0].type !== 'COMPONENT') continue;
    const row = rows[0];
    if (!same(row.values.fills, NATIVE_DEFAULT_FILL) || (row.values.boundVariables?.fills && !same(row.values.boundVariables.fills, []))) continue;
    row.values.fills = [];
    changes.push({ nodeId: row.id, variant: variant.name, part: 'Component', channel: 'unrequested-fill', before: 'Invisible default white paint', after: 'No paint' });
  }
  if (!changes.length || verifyNativeContractReadback(before, baseline).status !== 'supported-structure-observed') return null;
  return { baseline, changes };
}
export function prepareNativeDefaultFillUpdate(input: NativeContractUpdateInput,
  prepareBase: (input: NativeContractUpdateInput) => { plan: NativeOpacityUpdatePlan; revision: string }) {
  const repair = nativeDefaultFillRepairBaseline(input.before, input.baseline);
  if (!repair) return null;
  const base = prepareBase({ ...input, baseline: repair.baseline }).plan;
  if (base.changes.length) throw Error('native-update-default-fill-mixed-channels');
  const plan: NativeDefaultFillUpdatePlan = { ...base, version: 6, kind: 'native-contract-default-fill-update',
    baseline: clean(input.baseline), changes: repair.changes };
  return { plan, revision: revisionOf(plan) };
}

const INSPECT = `(plan,raw,complete) => {
 const copy=v=>JSON.parse(JSON.stringify(v));
 const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
 const same=(a,b)=>canonical(a)===canonical(b);
 const r=copy(raw);delete r.images;
 for(const c of plan.changes){
  const row=r.nodes?.find(n=>n.id===c.nodeId),old=plan.baseline.nodes.find(n=>n.id===c.nodeId);
  if(!row||!old||!(same(row.values.fills,[])||!complete&&same(row.values.fills,old.values.fills)))throw Error('native-update-default-fill-conflict');
  row.values.fills=copy(old.values.fills);
 }
 if(!same(r,plan.baseline))throw Error('native-update-baseline-conflict');
 return true;
}`;
const inspect = new Function('return ' + INSPECT)() as (plan: NativeDefaultFillUpdatePlan, raw: unknown, complete: boolean) => boolean;
export function nativeDefaultFillUpdateMatches(plan: NativeDefaultFillUpdatePlan, raw: unknown, complete = false) {
  try {
    if (!nativeDefaultFillRepairBaseline(plan.before, plan.baseline) || !inspect(plan, raw, complete)) return false;
    return !complete || verifyNativeContractReadback(plan.after, raw).status === 'supported-structure-observed';
  } catch { return false; }
}
export function emitNativeDefaultFillUpdateScript(plan: NativeDefaultFillUpdatePlan, direction: 'apply' | 'rollback', readOnly: boolean) {
  return `const plan=${JSON.stringify(plan)},direction=${JSON.stringify(direction)},readOnly=${readOnly};
const inspect=${INSPECT},copy=v=>JSON.parse(JSON.stringify(v));
const stable=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const same=(a,b)=>stable(a)===stable(b);
const out={version:1,kind:'native-contract-update-result',direction,status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const attempted=[];
try {
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const nodes=new Map();
 for(const row of plan.baseline.nodes){const n=await figma.getNodeByIdAsync(row.id);if(!n)throw Error('native-update-node-missing');nodes.set(row.id,n);}
 const current=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})();
 inspect(plan,current,false);
 if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
 // No await between the final complete field check and the assignments.
 for(const row of current.nodes){
  const node=nodes.get(row.id);
  if(!node||node.removed||node.type!==row.type||node.name!==row.name||node.parent?.id!==row.parentId||!same(node.children?node.children.map(n=>n.id):[],row.childIds))throw Error('native-update-final-conflict');
  for(const [key,value] of Object.entries(row.values)){const live=node[key];if(!same(typeof live==='symbol'?{mixed:true}:live===undefined?null:live,value))throw Error('native-update-final-field-conflict:'+key);}
  for(const [key,value] of Object.entries(row.metadata))if(node.getSharedPluginData('ds_contracts',key)!==value)throw Error('native-update-final-metadata-conflict');
 }
 for(const c of plan.changes){
  const node=nodes.get(c.nodeId),target=direction==='apply'?[]:plan.baseline.nodes.find(n=>n.id===c.nodeId).values.fills;
  if(same(node.fills,target))continue;
  attempted.push({node,previous:copy(node.fills),target:copy(target)});node.fills=copy(target);out.changes.push(node.id);
 }
 out.observation=await(async()=>{${emitNativeContractReadbackScript(plan.after)}})();
 inspect(plan,out.observation,direction==='apply');
 if(direction==='rollback'&&plan.changes.some(c=>!same(out.observation.nodes.find(n=>n.id===c.nodeId).values.fills,plan.baseline.nodes.find(n=>n.id===c.nodeId).values.fills)))throw Error('native-update-rollback-conflict');
 out.status=out.changes.length?'updated':'no-op';
}catch(error){
 out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
 for(const a of attempted.reverse())try{if(same(a.node.fills,a.target))a.node.fills=copy(a.previous);if(!same(a.node.fills,a.previous))unrestored.push(a.node.id);}catch{unrestored.push(a.node.id);}
 out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
