/** Join independently authenticated appearance and behavior without changing
 * either archive or treating a fresh-mount sweep as a behavior observation. */
import {revisionOf} from '../core/contract-provenance.js';
import type {NativeContractDraftSource} from '../core/native-contract-draft.js';
import type {ReactAuthoredSweepDraft} from './react-authored-sweep.js';
import type {ReactInitialInspection} from './react-initial-inspection.js';
import type {ReactStateApiInspection} from './react-state-api-inspection.js';
import type {ReactStateApiNativePin} from './react-state-api-native-request.js';
import {isReactAuthoredOperationRequest,type ReactAuthoredStateApiNativeRequest} from './react-authored-native-request.js';
import {projectReactStateApiContract} from './react-state-api-contract.js';

export interface ReactAuthoredStateApiDraft extends Omit<ReactAuthoredSweepDraft,'qualification'|'boundaries'> {
  qualification:'observed-authored-state-api-draft';
  nativeVariants:Array<{observation:string;variant:string}>;
}
export function projectReactAuthoredStateApiDraft(initial:ReactInitialInspection,report:ReactStateApiInspection):ReactAuthoredStateApiDraft {
  const appearance=initial.authoredDraft, behavior=projectReactStateApiContract(initial,report);
  if (!appearance || appearance.status!=='native-compiled' || appearance.problems.length ||
      behavior.status!=='generated-draft' || !behavior.contract || !behavior.dependencies?.length ||
      !appearance.nativeVariants.length || new Set(appearance.nativeVariants.map(v=>v.variant)).size!==appearance.nativeVariants.length)
    throw Error('react-authored-state-api-graph-unavailable');
  return {version:1,qualification:'observed-authored-state-api-draft',acceptedContract:null,status:'native-compiled',
    nativeQualification:'unqualified',inputRevision:revisionOf({initial,report}),
    contract:behavior.contract,contracts:[behavior.contract,...behavior.dependencies.map(d=>d.contract)],
    tokens:structuredClone(appearance.tokens!),assets:structuredClone(appearance.assets!),
    nativeVariants:structuredClone(appearance.nativeVariants),problems:[],
    limitations:[...new Set([...appearance.limitations,...behavior.limitations,'figma-variants-are-not-interactive',
      'stateful-native-return-unqualified','stateful-graph-updates-unqualified'])]};
}

/** The host must authenticate both arguments against the current source before
 * calling this join. No browser-supplied draft is accepted by the route. */
export function joinReactAuthoredStateApiEvidence<Frames>(request:ReactAuthoredStateApiNativeRequest,
  appearance:{draft:NonNullable<ReactInitialInspection['authoredDraft']>;frames:Frames;source:NativeContractDraftSource},
  state:{pin:ReactStateApiNativePin;initial:ReactInitialInspection;report:ReactStateApiInspection}) {
  if(!isReactAuthoredOperationRequest(request) || revisionOf(state.pin)!==revisionOf(request.stateApi) ||
    state.initial.id!==request.initial.id || state.report.plan.initialObservation!==request.initial.id ||
    state.initial.caseId!==request.caseId || state.report.caseId!==request.caseId ||
    state.initial.instanceId!==request.initial.instanceId || state.report.plan.instanceId!==request.initial.instanceId ||
    revisionOf(appearance.draft)!==request.initialDraftRevision ||
    revisionOf(state.initial.authoredDraft)!==request.initialDraftRevision)
    throw Error('react-authored-state-api-evidence-changed');
  const draft=projectReactAuthoredStateApiDraft(state.initial,state.report);
  if(revisionOf(draft)!==request.draftRevision)throw Error('react-authored-state-api-draft-changed');
  return {draft,frames:appearance.frames,source:{...appearance.source,evidenceRevision:revisionOf(request)}};
}
