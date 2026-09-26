/** Use the shared native graph writer for one authenticated observed composition. */
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import type {NativeContractDraftSource} from '../core/native-contract-draft.js';
import type {NativeSourceWriteContext} from '../core/native-source-write.js';
import {prepareNativeTokenContext,type NativeTokenContextInput} from '../core/native-token-context.js';
import {flattenTokens} from '../core/tokens.js';
import type {ReactAuthoredTreeDraft} from './react-authored-tree.js';
import type {ReactAuthoredSweepDraft} from './react-authored-sweep.js';
import type {ReactAuthoredStateApiDraft} from './react-authored-state-api.js';

export interface ReactAuthoredNativePlanInput {
  operation: {id:string;fileKey:string};
  source: NativeContractDraftSource;
  draft: ReactAuthoredTreeDraft | ReactAuthoredSweepDraft | ReactAuthoredStateApiDraft;
}
function compile(input: ReactAuthoredNativePlanInput) {
  const {draft} = input;
  if (draft.status !== 'native-compiled' || draft.acceptedContract !== null || draft.problems.length ||
      !draft.contract || !draft.contracts?.length || !draft.tokens || !draft.assets) throw Error('react-authored-native-draft-unavailable');
  const contracts = new Map(draft.contracts.map(c=>[c.id,c])), parent = contracts.get(draft.contract.id);
  if (!parent || contracts.size !== draft.contracts.length || canonicalJson(parent) !== canonicalJson(draft.contract))
    throw Error('react-authored-native-graph-invalid');
  const engine = createFigmaEngine({tokens:{primitives:draft.tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(draft.assets)});
  const compiled = engine.compileNativeContractGraphDraft(parent,contracts,input.source,input.operation.id);
  if(draft.qualification==='observed-authored-state-api-draft' &&
    canonicalJson(draft.nativeVariants.map(v=>v.variant).sort())!==canonicalJson(compiled.component.variants.map(v=>v.name).sort()))
    throw Error('react-authored-state-api-variant-pairing-changed');
  return {parent,contracts,engine,compiled};
}
export function prepareReactAuthoredNativePlan(input: ReactAuthoredNativePlanInput) {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
      !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey)) throw Error('react-authored-native-operation-invalid');
  const {compiled} = compile(input), tokens = input.draft.tokens!;
  const tokenInput: NativeTokenContextInput = {
    fileKey:input.operation.fileKey,scopeId:'source-'+input.operation.id,
    source:{revision:input.source.revision,sourceProgramSha256:input.source.programSha256,tokensSha256:revisionOf(tokens).slice(7)},
    tokenPaths:[...flattenTokens(tokens).keys()].sort(),
    modes:[{sourceMode:'light',brand:'default',nativeModeName:'Light',tokens:structuredClone(tokens),tokenTreeRevision:compiled.projection.tokenRevision}],
  };
  const plan = {
    version:1 as const,kind:'react-authored-draft-inspection' as const,purpose:'source-candidate-inspection' as const,
    acceptedContract:null,nativeQualification:'unqualified' as const,operation:{...input.operation},
    draftRevision:revisionOf(input.draft),projection:compiled.projection,component:compiled.component,
    graphComponents:compiled.components,graphVerification:1 as const,
    componentRevision:revisionOf(compiled.component),componentRevisions:compiled.componentRevisions,
    tokenInput,tokenPreparation:prepareNativeTokenContext(tokenInput),
    limitations:[...input.draft.limitations,'native-visual-fidelity-unverified','native-graph-computed-geometry-unverified',
      'generated-consumer-not-installed','accepted-contract-unqualified'],
  };
  return {plan,revision:revisionOf(plan)};
}
export function buildReactAuthoredNativeWrite(input: ReactAuthoredNativePlanInput & {
  expectedPlanRevision:string;tokens:NativeSourceWriteContext['tokens'];
}) {
  const current = prepareReactAuthoredNativePlan(input);
  if (current.revision !== input.expectedPlanRevision || canonicalJson(current.plan.tokenInput) !== canonicalJson(input.tokens.input))
    throw Error('react-authored-native-plan-write-stale');
  const {parent,contracts,engine} = compile(input);
  return {planRevision:current.revision,script:engine.buildNativeContractGraphDraftScript(
    parent,contracts,input.source,{operation:input.operation,tokens:input.tokens},1)};
}
