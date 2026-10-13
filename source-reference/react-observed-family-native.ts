import {createHash} from 'node:crypto';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {isObservedFamilyPin,observedFamilyAuthority,assembleObservedFamily,type ObservedFamilyPin,type VerifiedObservedFamily} from './react-observed-family.js';
import {prepareReactNativeFreshPlan,buildReactNativeFreshComponentWrite,type ReactNativePlanInput} from './react-native-plan.js';
import type {NativeSourceWriteContext} from '../core/native-source-write.js';

export type ReactObservedFamilyNativeRequest = {
  kind:'react-observed-family-draft';referenceId:string;family:ObservedFamilyPin;compilation:'current';
} & ({version:1} | {version:2;draftRevision:string});
export function isReactObservedFamilyNativeRequest(value:unknown):value is ReactObservedFamilyNativeRequest {
  const r=value as ReactObservedFamilyNativeRequest;
  return !!r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).sort().join(',')===(r.version===1?'compilation,family,kind,referenceId,version':'compilation,draftRevision,family,kind,referenceId,version')&&
    (r.version===1||r.version===2&&typeof r.draftRevision==='string'&&/^sha256:[a-f0-9]{64}$/.test(r.draftRevision))&&r.kind==='react-observed-family-draft'&&typeof r.referenceId==='string'&&/^[a-f0-9]{64}$/.test(r.referenceId)&&
    isObservedFamilyPin(r.family)&&r.compilation==='current';
}
export function reactObservedFamilyReservation(request:ReactObservedFamilyNativeRequest):string {
  if(!isReactObservedFamilyNativeRequest(request))throw Error('react-family-request-invalid');
  const h=createHash('sha256').update(canonicalJson([request.version===1?'react-observed-family-v1':'react-observed-family-v2',request])).digest('hex').slice(0,32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
/** Only compiled content participates: retrying the same draft reuses its
 * reservation, while a compiler correction receives a distinct immutable one.
 * The caller never supplies this revision to the family-selection route. */
function draftRevision(matrix:ReturnType<typeof assembleObservedFamily>['matrix']):string {
  const draft=matrix.draft;
  if(draft.status!=='native-compiled'||!draft.contract||!draft.tokens||!draft.native||draft.problems.length)
    throw Error('react-family-draft-unavailable');
  return revisionOf({contract:draft.contract,tokens:draft.tokens,native:draft.native});
}
export function createReactObservedFamilyNativeRequest(family:VerifiedObservedFamily):ReactObservedFamilyNativeRequest&{version:2} {
  const {record,pin}=observedFamilyAuthority(family),evidence=assembleObservedFamily(family);
  return {version:2,kind:'react-observed-family-draft',referenceId:record.referenceId,
    family:pin,compilation:'current',draftRevision:draftRevision(evidence.matrix)};
}
function assertDraftRevision(matrix:ReturnType<typeof assembleObservedFamily>['matrix'],request:ReactObservedFamilyNativeRequest):void {
  if(request.version===2&&request.draftRevision!==draftRevision(matrix))throw Error('react-family-draft-changed');
}
export function observedFamilyNativeEvidence(family:VerifiedObservedFamily,request:ReactObservedFamilyNativeRequest) {
  const {record,pin}=observedFamilyAuthority(family);
  if(!isReactObservedFamilyNativeRequest(request)||request.referenceId!==record.referenceId||canonicalJson(request.family)!==canonicalJson(pin))
    throw Error('react-family-request-changed');
  const evidence=assembleObservedFamily(family);
  assertDraftRevision(evidence.matrix,request);
  return {...evidence,source:{...evidence.source,evidenceRevision:revisionOf(request)},record,request:structuredClone(request)};
}
type Input=ReturnType<typeof observedFamilyNativeEvidence>&{operation:ReactNativePlanInput['operation']};
export function prepareReactObservedFamilyNativePlan(input:Input) {
  assertDraftRevision(input.matrix,input.request);
  const base=prepareReactNativeFreshPlan(input);
  if(!base.plan.templateGraph||input.record.members.length!==base.plan.component.variants.length||
    canonicalJson(input.record.members.map(m=>m.variantName).sort())!==canonicalJson(base.plan.component.variants.map(v=>v.name).sort()))
    throw Error('react-family-plan-membership-changed');
  const plan={...base.plan,kind:'react-observed-family-draft-inspection' as const,
    family:structuredClone(input.request.family),referenceId:input.request.referenceId,
    ownership:structuredClone(input.record.ownership),baseCaseId:input.record.selection.baseCaseId,
    axis:structuredClone(input.record.axis),members:structuredClone(input.record.members)};
  return {plan,revision:revisionOf(plan)};
}
export function buildReactObservedFamilyNativeWrite(input:Input&{
  expectedPlanRevision:string;tokens:NativeSourceWriteContext['tokens'];templateGraph?:NativeSourceWriteContext['templateGraph'];
}) {
  const plan=prepareReactObservedFamilyNativePlan(input);
  if(plan.revision!==input.expectedPlanRevision)throw Error('react-family-plan-write-stale');
  const base=prepareReactNativeFreshPlan(input);
  const built=buildReactNativeFreshComponentWrite({...input,expectedPlanRevision:base.revision});
  return {...built,planRevision:plan.revision};
}
