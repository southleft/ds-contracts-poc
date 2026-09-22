import { cleanNativeTemplateCallerReadback } from '../core/native-template-caller-identity.js';
/** Application adapter. Legacy plans and generated programs retain their exact
 * representation; template updates require their complete caller inventory. */
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import * as legacy from '../core/native-contract-update.js';
import {emitNativeContractReadbackScript,type NativeSourceReadback} from '../core/native-source-observation.js';
import {prepareNativeTemplateComponentUpdate,emitNativeTemplateValueWriteScript,type NativeTemplateComponentUpdateInput} from '../core/native-template-value-writer.js';
import {prepareNativeTemplateUpdateProposal,restoreNativeTemplateUpdateProposal,type NativeTemplateUpdateProposal} from '../core/native-template-update-proposal.js';
import {emitNativeTemplateUpdateObservationScript,type NativeTemplateUpdateObservation} from '../core/native-template-update-observation.js';
import {matchNativeTemplateUpdateObservation} from '../core/native-template-update-match.js';
import {nativeDesignChanges} from '../core/native-design-changes.js';

export type NativeAppUpdateInput = legacy.NativeContractUpdateInput & {
  templateGraph?: NativeTemplateComponentUpdateInput['desired'];
  templateConsumers?: NativeTemplateComponentUpdateInput['consumers'];
  templateCallerIdentity?: NativeTemplateComponentUpdateInput['callerIdentity'];
};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const clean=(value:unknown)=>{const copy=structuredClone(value) as any;delete copy.images;return copy;};
// Memoize only a pure decode/compile, keyed by the COMPLETE proposal bytes.
// Files, source evidence and journals are still read and authenticated by every
// authorizing call. An unchanged digest with changed contents cannot hit this.
const templates=new Map<string,{bytes:string;input:NativeTemplateComponentUpdateInput;
  prepared:ReturnType<typeof prepareNativeTemplateComponentUpdate>;update:NativeTemplateAppUpdate}>();
// A displayed update repeatedly authenticates its source and journals. Reuse
// only deterministic program text, keyed by the COMPLETE template bytes and
// reader options. Neither a digest nor a historical authorization is cached.
const templatePrograms=new Map<string,string>();
function templateProgram(plan:NativeTemplateAppUpdatePlan,mode:string,
  emit:(input:NativeTemplateComponentUpdateInput)=>string) {
  const key=canonicalJson([mode,plan.template]),saved=templatePrograms.get(key);
  if(saved!==undefined)return saved;
  const script=emit(templateUpdateInput(plan));
  if(templatePrograms.size>=8)templatePrograms.delete(templatePrograms.keys().next().value!);
  templatePrograms.set(key,script);return script;
}
type NativeTemplateAppUpdate={plan:{version:1;kind:'native-contract-template-value-update';acceptedContract:null;nativeQualification:'unqualified';
  before:NativeTemplateComponentUpdateInput['before'];baseline:NativeSourceReadback;after:NativeTemplateComponentUpdateInput['before'];desiredRevision:string;
  changes:legacy.NativeOpacityUpdatePlan['changes'];template:NativeTemplateUpdateProposal;
  templateValueChanges:ReturnType<typeof prepareNativeTemplateComponentUpdate>['valuePlan']['changes']};revision:string};
export function prepareNativeTemplateAppUpdate(template:NativeTemplateUpdateProposal,desiredRevision:string) {
  if(!/^sha256:[a-f0-9]{64}$/.test(desiredRevision))throw Error('native-update-desired-revision-invalid');
  const key=desiredRevision+':'+template.revision,bytes=canonicalJson(template),saved=templates.get(key);
  if(saved?.bytes===bytes)return structuredClone(saved.update);
  const input=restoreNativeTemplateUpdateProposal(template),prepared=prepareNativeTemplateComponentUpdate(input);
  // The exact matcher deliberately refuses changed computed geometry. Do not
  // deliver a typography/dimension change and discover that boundary afterward.
  if(prepared.valuePlan.changes.some(change=>change.type!=='COLOR'))
    throw Error('native-update-template-geometry-change-unqualified');
  const plan={version:1 as const,kind:'native-contract-template-value-update' as const,
    acceptedContract:null,nativeQualification:'unqualified' as const,before:prepared.before,
    baseline:prepared.baseline,after:prepared.after,desiredRevision,
    changes:[] as legacy.NativeOpacityUpdatePlan['changes'],template:structuredClone(template),
    templateValueChanges:prepared.valuePlan.changes};
  const update={plan,revision:revisionOf(plan)};
  // Histories revisit several proposals in order. Keep a bounded working set
  // large enough for a forward/reverse/conflict/recovery sequence; four entries
  // made the fifth proposal evict every preceding decode on each traversal.
  if(templates.size>=16)templates.delete(templates.keys().next().value!);
  templates.set(key,{bytes,input:structuredClone(input),prepared:structuredClone(prepared),update:structuredClone(update)});
  return update;
}
/** Select source representations from a freshly authenticated compiler result.
 * The rendered native component has selector aliases and ownership stamps;
 * template value planning needs the unaliased graph input instead. */
export function nativeAppUpdateDesired(compiled:{revision:string;plan:{
  component:NativeAppUpdateInput['desired']['component'];
  tokenInput:NativeAppUpdateInput['desired']['tokenInput'];
  templateGraph?:{input:NativeTemplateComponentUpdateInput['desired']};
}}) {
  if(compiled.revision!==revisionOf(compiled.plan))throw Error('native-update-compiled-source-changed');
  const templateGraph=compiled.plan.templateGraph?.input;
  if(templateGraph&&!same(templateGraph.tokens,compiled.plan.tokenInput))throw Error('native-update-template-source-invalid');
  return structuredClone({desired:{component:templateGraph?.component??compiled.plan.component,
    revision:compiled.revision,tokenInput:compiled.plan.tokenInput},...(templateGraph?{templateGraph}:{})});
}
export type NativeTemplateAppUpdatePlan=ReturnType<typeof prepareNativeTemplateAppUpdate>['plan'];
export type NativeAppUpdatePlan=legacy.NativeContractUpdatePlan|NativeTemplateAppUpdatePlan;
export function prepareNativeAppUpdate(input:NativeAppUpdateInput):{plan:NativeAppUpdatePlan;revision:string} {
  if(!input.templateGraph)return legacy.prepareNativeContractUpdate(input);
  if(!Array.isArray(input.templateConsumers)||!same(input.templateGraph.component,input.desired.component)||
      !same(input.templateGraph.tokens,input.desired.tokenInput))throw Error('native-update-template-source-invalid');
  return prepareNativeTemplateAppUpdate(prepareNativeTemplateUpdateProposal({before:input.before,baseline:input.baseline,
    desired:input.templateGraph,consumers:input.templateConsumers,
    ...(input.templateCallerIdentity?{callerIdentity:input.templateCallerIdentity}:{})}),input.desired.revision);
}
export const templateUpdateInput=(plan:NativeTemplateAppUpdatePlan)=>{
  const saved=templates.get(plan.desiredRevision+':'+plan.template.revision);
  return saved?.bytes===canonicalJson(plan.template)?structuredClone(saved.input):restoreNativeTemplateUpdateProposal(plan.template);
};
const matches=new Map<string,ReturnType<typeof matchNativeTemplateUpdateObservation>>();
function templateMatch(plan:NativeTemplateAppUpdatePlan,raw:unknown) {
  // Replaying the journal revisits the same immutable observations. Cache the
  // pure comparison only; source, file bytes and journal context remain fresh.
  const key=canonicalJson([plan.template,raw]),saved=matches.get(key);
  if(saved)return structuredClone(saved);
  const result=matchNativeTemplateUpdateObservation(templateUpdateInput(plan),raw);
  if(matches.size>=4)matches.delete(matches.keys().next().value!);
  matches.set(key,structuredClone(result));return result;
}
export function nativeAppUpdateMatches(plan:NativeAppUpdatePlan,raw:unknown,complete=false) {
  if(plan.kind!=='native-contract-template-value-update')return legacy.nativeContractUpdateMatches(plan,raw,complete);
  const result=templateMatch(plan,raw);
  return complete?result.completed:result.completed||result.untouched;
}
export function nativeAppUpdateUntouched(plan:NativeAppUpdatePlan,raw:unknown) {
  return plan.kind==='native-contract-template-value-update'
    ?templateMatch(plan,raw).untouched:legacy.nativeContractUpdateUntouched(plan,raw);
}
export function nativeAppUpdatePreflight(plan:NativeAppUpdatePlan,raw:any,untouched=false) {
  if(plan.kind!=='native-contract-template-value-update')return raw?.status==='preflight-observed'&&
    (untouched?legacy.nativeContractUpdateUntouched(plan,raw.observation):legacy.nativeContractUpdateMatches(plan,raw.observation));
  try {
    // Reuse only the pure compiler result for these exact proposal bytes.
    // The caller still authenticates the current files, source and journal;
    // every observation below is compared anew. No write permission is cached.
    const saved=templates.get(plan.desiredRevision+':'+plan.template.revision);
    const prepared=saved?.bytes===canonicalJson(plan.template)?saved.prepared
      :prepareNativeTemplateComponentUpdate(templateUpdateInput(plan));
    return raw?.version===1&&raw.kind==='native-template-value-write-result'&&raw.planRevision===prepared.revision&&
      raw.status==='preflight-observed'&&raw.acceptedContract===null&&raw.nativeQualification==='unqualified'&&
      same(raw.problems,[])&&same(clean(raw.observation),plan.baseline)&&
      same((raw.consumerObservations??[]).map((r:NativeSourceReadback)=>cleanNativeTemplateCallerReadback(r,prepared.callerIdentity,true)),prepared.consumers.map(c=>c.baseline.content));
  }catch{return false;}
}
export function emitNativeAppUpdateScript(plan:NativeAppUpdatePlan,readOnly=false) {
  return plan.kind==='native-contract-template-value-update'?templateProgram(plan,'write:'+readOnly,input=>emitNativeTemplateValueWriteScript(input,readOnly))
    :legacy.emitNativeContractUpdateScript(plan,'apply',readOnly);
}
export function emitNativeAppUpdateReadback(plan:NativeAppUpdatePlan,reader=emitNativeContractReadbackScript,images=true,geometry=true) {
  return plan.kind==='native-contract-template-value-update'?templateProgram(plan,'read:'+images,input=>emitNativeTemplateUpdateObservationScript(input,images))
    :reader(plan.after,images,geometry);
}
/** Extraction for display only. Settlement always checks the combined envelope. */
export function nativeAppUpdateMainReadback(plan:NativeAppUpdatePlan,raw:unknown):NativeSourceReadback {
  return structuredClone(plan.kind==='native-contract-template-value-update'?(raw as NativeTemplateUpdateObservation)?.observation:raw) as NativeSourceReadback;
}
export function nativeAppUpdateAfter(plan:NativeAppUpdatePlan,raw:unknown) {
  return plan.kind==='native-contract-template-value-update'?structuredClone(plan.after):legacy.nativeContractUpdateAfter(plan,raw);
}
export function nativeAppUpdateConsumersAfter(plan:NativeTemplateAppUpdatePlan,raw:unknown) {
  const result=templateMatch(plan,raw);
  if(!result.completed)throw Error('native-update-template-consumers-unverified');
  return result.consumerStates;
}
export function nativeAppUpdateDesignChanges(plan:NativeAppUpdatePlan,before:unknown,after:unknown) {
  if(plan.kind!=='native-contract-template-value-update')return nativeDesignChanges(clean(before),clean(after));
  const a=before as NativeTemplateUpdateObservation,b=after as NativeTemplateUpdateObservation;
  if(a?.kind!=='independent-native-template-update-observation'||b?.kind!==a.kind||b.status!=='collected'||
      a.planRevision!==b.planRevision||!a.consumerObservations||!b.consumerObservations||
      a.consumerObservations.length!==b.consumerObservations.length)throw Error('native-update-template-design-observation-invalid');
  const reports=[nativeDesignChanges(a.observation!,b.observation!),...a.consumerObservations.map((r,i)=>nativeDesignChanges(r,b.consumerObservations![i]))];
  const changes=reports.flatMap(r=>r.changes),oldGraph=a.observation?.templateGraph?.receipt,newGraph=b.observation?.templateGraph?.receipt;
  if(!oldGraph||!newGraph)throw Error('native-update-template-design-graph-unavailable');
  const compare=(nodeId:string,node:string,channel:string,recorded:unknown,observed:unknown)=>{
    if(!same(recorded,observed))changes.push({nodeId,node,channel,recorded:recorded??null,observed:observed??null});
  };
  for(const field of ['selectors','routes'] as const) {
    const index=(rows:any)=>{
      if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.id!=='string'))throw Error('native-update-template-design-graph-invalid');
      return new Map<string,Record<string,unknown>>(rows.map(row=>[row.id,row]));
    };
    const was=index(oldGraph[field]),now=index(newGraph[field]);
    if(was.size!==oldGraph[field].length||now.size!==newGraph[field].length)throw Error('native-update-template-design-graph-duplicate');
    for(const id of [...new Set([...was.keys(),...now.keys()])].sort()) {
      const old=was.get(id) as Record<string,unknown>|undefined,next=now.get(id) as Record<string,unknown>|undefined;
      for(const key of [...new Set([...Object.keys(old??{}),...Object.keys(next??{})])].sort())
        compare(id,String(old?.name??next?.name??id),'template-'+field+':'+key,old?.[key],next?.[key]);
    }
  }
  for(const id of [...new Set([...Object.keys(oldGraph.sourceScopes),...Object.keys(newGraph.sourceScopes)])].sort())
    compare(id,id,'template-source:scopes',oldGraph.sourceScopes[id],newGraph.sourceScopes[id]);
  for(const key of [...new Set([...Object.keys(oldGraph),...Object.keys(newGraph)])].filter(k=>!['source','selectors','routes','sourceScopes'].includes(k)).sort())
    compare(plan.before.creation.pageId,'Template graph','template-graph:'+key,(oldGraph as any)[key],(newGraph as any)[key]);
  return {...reports[0],changes,added:reports.flatMap(r=>r.added),removed:reports.flatMap(r=>r.removed)};
}
