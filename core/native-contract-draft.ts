/** Framework-neutral provenance for a host-verified, unaccepted Contract draft.
 * This is neither a retained runtime binding nor permission to write a file.
 * The host must pin and re-open its source evidence before dispatching a write.
 */
import { revisionOf } from './contract-provenance.js';
import type { Contract } from '../scripts/contract-schema.js';
import type { ComponentData, NodeSpec } from './emit-figma-script.js';

export interface NativeContractDraftSource {
  revision: string;
  programSha256: string;
  evidenceRevision: string;
}
export interface NativeContractPartIdentity {
  contractRevision: string;
  variant: string;
  /** Path in the compiler output, not a claimed source DOM/template identity. */
  specPath: number[];
}
export interface NativeContractDraftProjection {
  version: 1;
  kind: 'contract-draft';
  purpose: 'source-candidate-inspection';
  acceptedContract: null;
  nativeQualification: 'unqualified';
  contractId: string;
  contractRevision: string;
  tokenRevision: string;
  source: NativeContractDraftSource;
  context: { mode: string; brand: string };
}

/** Annotate only freshly compiled data. The engine authenticates that data
 * before calling this helper; serialized ComponentData is never write input. */
export function prepareNativeContractDraft(
  contract: Contract,
  component: ComponentData,
  source: NativeContractDraftSource,
  tokenRevision: string,
  context: NativeContractDraftProjection['context'],
) {
  const revision = /^sha256:[a-f0-9]{64}$/;
  if (!source || !revision.test(source.revision) ||
      !/^[a-f0-9]{64}$/.test(source.programSha256) ||
      !revision.test(source.evidenceRevision) || !revision.test(tokenRevision))
    throw Error('NATIVE_CONTRACT_DRAFT_SOURCE_IDENTITY_REQUIRED');
  if (contract.status !== 'draft' || contract.bindings.code.runtime ||
      contract.bindings.figma.anchors.componentSetKey || component.nativeSourceCandidate)
    throw Error('NATIVE_CONTRACT_DRAFT_UNACCEPTED_INPUT_REQUIRED');
  if (component.stateVariants?.length || component.boolProps.length || component.textProps.length)
    throw Error('NATIVE_CONTRACT_DRAFT_STATE_OR_TEXT_MAPPING_UNQUALIFIED');
  const projection: NativeContractDraftProjection = {
    version: 1, kind: 'contract-draft', purpose: 'source-candidate-inspection',
    acceptedContract: null, nativeQualification: 'unqualified',
    contractId: contract.id, contractRevision: revisionOf(contract), tokenRevision,
    source: structuredClone(source), context: { ...context },
  };
  const data = structuredClone(component);
  const boundNames = new Set<string>();
  function visit(spec: NodeSpec, variant: string, specPath: number[]) {
    // Every allocation must pass nativeInit. Nested instances, styled text
    // wrappers, margin boxes and slot defaults need their own ownership mapping.
    if (!['root', 'frame', 'slot'].includes(spec.type) || spec.slotDefault?.length ||
        spec.visibleProp || spec.slotOptional || spec.margins || spec.insetOverlay ||
        spec.nativeSourcePart || spec.nativeSourceSample || spec.nativeSourceVisible !== undefined)
      throw Error('NATIVE_CONTRACT_DRAFT_NODE_OWNERSHIP_UNQUALIFIED');
    spec.nativeContractPart = { contractRevision: projection.contractRevision, variant, specPath };
    for (const name of Object.values(spec.bindings ?? {})) boundNames.add(name);
    for (const name of [spec.fill, spec.stroke, spec.fixedWidth?.varName, spec.fixedHeight?.varName])
      if (name) boundNames.add(name);
    (spec.children ?? []).forEach((child, i) => visit(child, variant, [...specPath, i]));
  }
  data.variants.forEach(v => visit(v.spec, v.name, []));
  data.nativeContractDraft = { revision: revisionOf(projection), acceptedContract: null };
  return { projection, component: data, boundNames: [...boundNames].sort() };
}
