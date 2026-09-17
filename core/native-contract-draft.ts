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
  function visit(spec: NodeSpec, variant: string, specPath: number[], parent?:NodeSpec) {
    // Every allocation must pass nativeInit. Nested instances, styled text
    // wrappers, margin boxes and slot defaults need their own ownership mapping.
    if (!['root', 'frame', 'slot', 'svg', 'shape'].includes(spec.type) || spec.slotDefault?.length ||
        spec.visibleProp || spec.slotOptional || spec.margins || spec.insetOverlay ||
        spec.nativeSourcePart || spec.nativeSourceSample || spec.nativeSourceVisible !== undefined ||
        spec.nativeContractSample || spec.nativeContractPart)
      throw Error('NATIVE_CONTRACT_DRAFT_NODE_OWNERSHIP_UNQUALIFIED');
    if ((spec.type === 'svg' || spec.type === 'shape') && spec.children?.length)
      throw Error('NATIVE_CONTRACT_DRAFT_LEAF_CHILDREN_UNQUALIFIED');
    if (spec.type === 'svg' && (!spec.svg || !Number.isFinite(spec.iconSize) || spec.iconSize! <= 0 || spec.rotation))
      throw Error('NATIVE_CONTRACT_DRAFT_SVG_GEOMETRY_UNQUALIFIED');
    if(spec.backgroundPaint){
      const {inset,radius}=spec.backgroundPaint,a=spec.absolute;
      if(spec.type!=='shape'||spec.shape?.kind!=='rect'||spec.shape.width!==1||spec.shape.height!==1||
          parent?.backgroundClip!=='padding-box'||parent.children?.[0]!==spec||
          ![inset,radius].every(v=>Number.isFinite(v)&&v>=0)||
          !a||a.h!=='STRETCH'||a.v!=='STRETCH'||![a.left,a.right,a.top,a.bottom].every(v=>v===inset)||
          spec.lits?.radius!==radius||spec.stroke||spec.bindings||spec.effectStack||spec.dropShadow||
          Object.keys(spec.lits??{}).some(k=>!['radius','fillColor'].includes(k)))
        throw Error('NATIVE_CONTRACT_DRAFT_BACKGROUND_GEOMETRY_UNQUALIFIED');
    }
    if (spec.type === 'shape' && (!spec.shape || !['rect', 'ellipse'].includes(spec.shape.kind) || spec.svg ||
        spec.shape.arc || spec.shape.rotation || (spec.lits?.fillColor && !spec.backgroundPaint) ||
        !Number.isFinite(spec.shape.width) || !Number.isFinite(spec.shape.height) || spec.shape.width <= 0 || spec.shape.height <= 0 ||
        (spec.absolute && !spec.backgroundPaint && (spec.absolute.h !== 'MIN' || spec.absolute.v !== 'MIN' ||
          !Number.isFinite(spec.absolute.left) || !Number.isFinite(spec.absolute.top)))))
      throw Error('NATIVE_CONTRACT_DRAFT_SHAPE_GEOMETRY_UNQUALIFIED');
    spec.nativeContractPart = { contractRevision: projection.contractRevision, variant, specPath };
    for (const name of Object.values(spec.bindings ?? {})) boundNames.add(name);
    for (const name of [spec.fill, spec.stroke, spec.fixedWidth?.varName, spec.fixedHeight?.varName, spec.svgPaintVar])
      if (name) boundNames.add(name);
    (spec.children ?? []).forEach((child, i) => visit(child, variant, [...specPath, i],spec));
  }
  data.variants.forEach(v => visit(v.spec, v.name, []));
  data.nativeContractDraft = { revision: revisionOf(projection), acceptedContract: null };
  return { projection, component: data, boundNames: [...boundNames].sort() };
}
