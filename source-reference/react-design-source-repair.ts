/** Bounded design-to-original-source planning. Nothing in this module writes
 * source, accepts a contract, or substitutes a generated React component. */
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {nativeDesignChanges} from '../core/native-design-changes.js';
import type {createNativeUpdateJobs} from './native-update-jobs.js';
import {proposeReactOpacityUtilityEdits,proposeReactShadowUtilityEdits,type NativeShadowEffect} from './react-utility-source-edit.js';

type Evidence=ReturnType<ReturnType<typeof createNativeUpdateJobs>['designEvidence']>;
const fail=(reason:string):never=>{throw Error('react-design-source-repair-'+reason);};
const equal=(a:number,b:number)=>a===b||Math.fround(a)===Math.fround(b);

/** Call only after designEvidence() reauthenticates the current correction
 * chain and the source identity is reopened from the same sealed React case.
 * Unsupported changes, including ones beyond the UI's display cap, refuse
 * the entire plan. A subsequent independent staged render must select the
 * unique source candidate and retain every other observed fact. */
export function planReactOpacitySourceRepair(evidence:Evidence,text:string,
  source:Parameters<typeof proposeReactOpacityUtilityEdits>[1]) {
  const difference=nativeDesignChanges(evidence.baseline,evidence.observed);
  if(canonicalJson(difference)!==canonicalJson(evidence.difference))fail('difference-changed');
  if(difference.added.length||difference.removed.length||!difference.changes.length)fail('root-opacity-edit-required');
  const roots=new Map<string,string>((evidence.input.creation.variants??[]).map((v:{id:string;name:string})=>[v.id,v.name]));
  const normalized=structuredClone(evidence.observed);
  const changes=difference.changes.map(change=>{
    const was=evidence.baseline.nodes?.find(n=>n.id===change.nodeId),now=normalized.nodes?.find(n=>n.id===change.nodeId);
    if(change.channel!=='opacity'||!roots.has(change.nodeId)||was?.type!=='COMPONENT'||now?.type!=='COMPONENT'||
        roots.get(change.nodeId)!==was.name||typeof change.recorded!=='number'||typeof change.observed!=='number'||
        ![change.recorded,change.observed].every(n=>Number.isFinite(n)&&n>=0&&n<=1))fail('unsupported-change');
    now!.values.opacity=change.recorded;
    return {nodeId:change.nodeId,variant:roots.get(change.nodeId)!,before:change.recorded as number,after:change.observed as number};
  });
  // The display comparison intentionally omits some envelope and node
  // identity fields. A repair cannot: refuse anything except the stated root
  // opacity values, including reparenting, type changes and token metadata.
  if(canonicalJson(normalized)!==canonicalJson(evidence.baseline))fail('other-native-facts-changed');
  const change=changes[0];
  if(changes.some(c=>!equal(c.before,change.before)||!equal(c.after,change.after)))fail('multiple-opacity-values');
  const candidates=proposeReactOpacityUtilityEdits(text,source,change);
  const plan={version:1 as const,qualification:'unverified-original-source-repair' as const,
    operationId:evidence.operationId,parentId:evidence.parentId,proposalId:evidence.proposalId,
    journalRevision:evidence.journalRevision,attemptId:evidence.attemptId,
    baselineRevision:revisionOf(evidence.baseline),observedRevision:revisionOf(evidence.observed),changes,candidates};
  return {...plan,revision:revisionOf(plan)};
}

/** Effects on every changed root, one shared before and after stack (§D.177).
 * The opacity plan above keeps its historical shape; this one names its channel. */
export function planReactShadowSourceRepair(evidence:Evidence,text:string,
  source:Parameters<typeof proposeReactShadowUtilityEdits>[1]) {
  const difference=nativeDesignChanges(evidence.baseline,evidence.observed);
  if(canonicalJson(difference)!==canonicalJson(evidence.difference))fail('difference-changed');
  if(difference.added.length||difference.removed.length||!difference.changes.length)fail('root-shadow-edit-required');
  const roots=new Map<string,string>((evidence.input.creation.variants??[]).map((v:{id:string;name:string})=>[v.id,v.name]));
  const normalized=structuredClone(evidence.observed);
  const stack=(value:unknown):value is NativeShadowEffect[]=>Array.isArray(value)&&value.length>0&&value.every(e=>e&&typeof e==='object'&&
    ['DROP_SHADOW','INNER_SHADOW'].includes((e as NativeShadowEffect).type)&&[(e as NativeShadowEffect).radius,(e as NativeShadowEffect).offset?.x,
      (e as NativeShadowEffect).offset?.y,...Object.values((e as NativeShadowEffect).color??{})].every(n=>typeof n==='number'&&Number.isFinite(n)));
  const changes=difference.changes.map(change=>{
    const was=evidence.baseline.nodes?.find(n=>n.id===change.nodeId),now=normalized.nodes?.find(n=>n.id===change.nodeId);
    if(change.channel!=='effects'||!roots.has(change.nodeId)||was?.type!=='COMPONENT'||now?.type!=='COMPONENT'||
        roots.get(change.nodeId)!==was.name||!stack(change.recorded)||!stack(change.observed))fail('unsupported-change');
    // CSS draws no shadow behind its own box; the compiled layers show behind
    // the node (§D.177). A layer that hides there has no utility to become.
    if((change.observed as Array<{showShadowBehindNode?:boolean}>).some(e=>e.showShadowBehindNode===false))fail('shadow-behind-node-unsupported');
    now!.values.effects=structuredClone(change.recorded);
    return {nodeId:change.nodeId,variant:roots.get(change.nodeId)!,before:change.recorded as NativeShadowEffect[],after:change.observed as NativeShadowEffect[]};
  });
  if(canonicalJson(normalized)!==canonicalJson(evidence.baseline))fail('other-native-facts-changed');
  const change=changes[0],same=(a:NativeShadowEffect[],b:NativeShadowEffect[])=>canonicalJson(a)===canonicalJson(b);
  if(changes.some(c=>!same(c.before,change.before)||!same(c.after,change.after)))fail('multiple-shadow-values');
  const candidates=proposeReactShadowUtilityEdits(text,source,change);
  const plan={version:1 as const,qualification:'unverified-original-source-repair' as const,channel:'effects' as const,
    operationId:evidence.operationId,parentId:evidence.parentId,proposalId:evidence.proposalId,
    journalRevision:evidence.journalRevision,attemptId:evidence.attemptId,
    baselineRevision:revisionOf(evidence.baseline),observedRevision:revisionOf(evidence.observed),changes,candidates};
  return {...plan,revision:revisionOf(plan)};
}

/** The shadow plan names its channel; an opacity plan predates the field. */
export const isShadowSourceRepair=(plan:ReactDesignSourceRepairPlan):plan is ReturnType<typeof planReactShadowSourceRepair>=>
  'channel' in plan&&plan.channel==='effects';
export type ReactDesignSourceRepairPlan=ReturnType<typeof planReactOpacitySourceRepair>|ReturnType<typeof planReactShadowSourceRepair>;
/** The one entry the host calls: the changed channel selects the plan. */
export function planReactDesignSourceRepair(evidence:Evidence,text:string,
  source:Parameters<typeof proposeReactOpacityUtilityEdits>[1]):ReactDesignSourceRepairPlan {
  const channels=new Set(evidence.difference.changes.map(c=>c.channel));
  return channels.size===1&&channels.has('effects')?planReactShadowSourceRepair(evidence,text,source):planReactOpacitySourceRepair(evidence,text,source);
}
