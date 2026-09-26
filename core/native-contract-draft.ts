import {nativePaintSpecSupported} from './native-paint-observation.js';
import {lowerNativeFilledPath} from './native-filled-path.js';
/** Framework-neutral provenance for a host-verified, unaccepted Contract draft.
 * This is neither a retained runtime binding nor permission to write a file.
 * The host must pin and re-open its source evidence before dispatching a write.
 */
import { planNativeRootTextTemplate, applyRootTextTemplateAliases, type NativeRootTextTemplatePlan } from './native-root-text-template-plan.js';
import type { NativePreparedLibraryProjection } from './native-prepared-library.js';
import { revisionOf } from './contract-provenance.js';
import { DEFAULT_FONT_FAMILY, type Contract } from '../scripts/contract-schema.js';
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
  /** Allocation within this spec's default slot content, not a child spec. */
  defaultSlotIndex?: number;
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
  rootTextTemplate?: NativeRootTextTemplatePlan;
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
  return annotateNativeContractProjection(contract, component, projection);
}

/** Shared ownership annotation for freshly compiled data. Broader library
 * admission is explicit and never changes historical source-draft programs. */
export function annotateNativeContractProjection<P extends NativeContractDraftProjection | NativePreparedLibraryProjection>(
  contract: Contract, component: ComponentData, projection: P,
) {
  const library = projection.kind === 'prepared-contract-library';
  const namesFamily = (value: unknown): boolean => typeof value === 'object' && value !== null &&
    Object.entries(value).some(([key, child]) => key === 'font-family' || namesFamily(child));
  // A family mentioned in any holder can leave another state inheriting from
  // the consumer. Do not reinterpret that unresolved context as a default.
  const libraryDefaultFamily = library && !namesFamily(contract.anatomy);
  const data = structuredClone(component);
  const boundNames = new Set<string>();
  const fonts = new Map<string, { family: string; styles: string[] }>();
  const textProperties = new Map<string, string>();
  for (const prop of contract.props.filter(p => p.bindings.figma.kind === 'TEXT')) {
    const name = prop.bindings.figma.property;
    // A property must drive actual text, with a source-declared default. A
    // compiler placeholder or an inert property is not an editable mapping.
    if (prop.type !== 'text' || !name || typeof prop.default !== 'string' || textProperties.has(name))
      throw Error('NATIVE_CONTRACT_DRAFT_TEXT_MAPPING_UNQUALIFIED');
    textProperties.set(name, prop.default);
  }
  const boundTextProperties = new Set<string>();
  function visit(spec: NodeSpec, variant: string, specPath: number[], parent?:NodeSpec, insideCallerSlot = false) {
    if (spec.shape?.kind === 'path' && !spec.nativePathInk) lowerNativeFilledPath(spec);
    if (spec.nativePathInk && (!parent?.nativePathViewport || spec.type !== 'shape' || spec.shape?.kind !== 'path'))
      throw Error('NATIVE_FILLED_PATH_OWNERSHIP_UNQUALIFIED');
    // A caller-slot spec points at a SLOT already owned by the dependency
    // instance. It is a navigation carrier, not an allocation in this draft.
    // Its children are caller-owned allocations and are qualified below.
    if (spec.callerSlotProperty !== undefined) {
      if (spec.type !== 'slot' || !spec.callerSlotProperty || !spec.slotProperty ||
          spec.callerSlotProperty !== spec.slotProperty || spec.nativeContractPart ||
          spec.nativeContractSample || spec.nativeSourcePart || spec.nativeSourceSample)
        throw Error('NATIVE_CONTRACT_DRAFT_CALLER_SLOT_OWNERSHIP_UNQUALIFIED');
      (spec.children ?? []).forEach((child, i) => visit(child, variant, [...specPath, i], spec, true));
      return;
    }
    // Every allocation must pass nativeInit. Nested instances, styled text
    // wrappers, margin boxes and slot defaults need their own ownership mapping.
    if (!['root', 'frame', 'slot', 'svg', 'shape', 'text', 'instance'].includes(spec.type) || (!library && (spec.slotDefault?.length || spec.visibleProp || spec.slotOptional)) || spec.margins || spec.insetOverlay ||
        spec.nativeSourcePart || spec.nativeSourceSample || spec.nativeSourceVisible !== undefined ||
        spec.nativeContractSample || spec.nativeContractPart)
      throw Error('NATIVE_CONTRACT_DRAFT_NODE_OWNERSHIP_UNQUALIFIED');
    if (spec.type === 'instance' && (!spec.dep || !spec.depContractId || (!library && spec.depAnchorKey) ||
        (spec.children ?? []).some(child => child.callerSlotProperty === undefined)))
      throw Error('NATIVE_CONTRACT_DRAFT_INSTANCE_OWNERSHIP_UNQUALIFIED');
    // The library contract's absent family means the shared pipeline default,
    // just as on the React surface. Pin that exact family before font preflight
    // and readback; never substitute for an explicit or malformed family.
    if (libraryDefaultFamily && spec.type === 'text' && spec.fontFamily === undefined)
      spec.fontFamily = DEFAULT_FONT_FAMILY;
    if (spec.type === 'text' && (spec.children?.length || spec.textStyle ||
        spec.fill || spec.fixedWidth || spec.fixedHeight || spec.bindings || spec.absolute || spec.overlay ||
        spec.pct !== undefined || spec.rotation || spec.layout || spec.lits ||
        typeof spec.characters !== 'string' || !spec.fontFamily || !spec.fontStyle || !Number.isFinite(spec.fontSize)))
      throw Error('NATIVE_CONTRACT_DRAFT_TEXT_OWNERSHIP_UNQUALIFIED');
    if (spec.slotTextTemplate && (spec.type !== 'text' || !parent?.rootSlotContent || parent.type !== 'slot' ||
        parent.children?.length !== 1 || specPath.length !== 2 || component.rootSlot?.textTemplate !== 1 ||
        spec.characters !== '' || spec.name !== 'Content text template' || spec.contentProp || spec.callerContentProp ||
        spec.textAutoResize !== 'WIDTH_AND_HEIGHT' || !spec.fontSizeVar || !spec.lineHeightVar || !spec.fontWeightVar || !spec.textFill))
      throw Error('NATIVE_CONTRACT_DRAFT_TEXT_TEMPLATE_UNQUALIFIED');
    if (spec.contentProp !== undefined) {
      if (insideCallerSlot || spec.type !== 'text' || !textProperties.has(spec.contentProp) ||
          spec.characters !== textProperties.get(spec.contentProp))
        throw Error('NATIVE_CONTRACT_DRAFT_TEXT_MAPPING_UNQUALIFIED');
      boundTextProperties.add(spec.contentProp);
    }
    if (spec.callerContentProp !== undefined) {
      if (!insideCallerSlot || spec.type !== 'text' || !textProperties.has(spec.callerContentProp) ||
          spec.characters !== textProperties.get(spec.callerContentProp))
        throw Error('NATIVE_CONTRACT_DRAFT_CALLER_TEXT_MAPPING_UNQUALIFIED');
      boundTextProperties.add(spec.callerContentProp);
    }
    if (spec.type === 'text') {
      fonts.set('Inter/' + spec.fontStyle, { family: 'Inter', styles: [spec.fontStyle!] });
      fonts.set(spec.fontFamily + '/' + spec.fontStyle, { family: spec.fontFamily!,
        styles: [...new Set([spec.fontStyle!, spec.fontStyle!.replaceAll(' ', '')])] });
    }
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
    if (spec.type === 'shape' && (!spec.shape || !['rect', 'ellipse', ...(spec.nativePathInk ? ['path'] : [])].includes(spec.shape.kind) || spec.svg ||
        spec.shape.arc || spec.shape.rotation ||
        !Number.isFinite(spec.shape.width) || !Number.isFinite(spec.shape.height) || spec.shape.width <= 0 || spec.shape.height <= 0 ||
        (spec.absolute && !spec.backgroundPaint && (spec.absolute.h !== 'MIN' || spec.absolute.v !== 'MIN' ||
          !Number.isFinite(spec.absolute.left) || !Number.isFinite(spec.absolute.top)))))
      throw Error('NATIVE_CONTRACT_DRAFT_SHAPE_GEOMETRY_UNQUALIFIED');
    if ((spec.gradient || (spec.type === 'shape' && spec.lits?.fillColor)) && !nativePaintSpecSupported(spec))
      throw Error('NATIVE_CONTRACT_DRAFT_PAINT_UNQUALIFIED');
    spec.nativeContractPart = { contractRevision: projection.contractRevision, variant, specPath };
    if (library) {
      if (spec.visibleProp && !component.boolProps.some(p => p.property === spec.visibleProp && p.default === spec.visibleDefault))
        throw Error('NATIVE_PREPARED_LIBRARY_VISIBILITY_MAPPING_UNQUALIFIED');
      for (const [index, item] of (spec.slotDefault ?? []).entries()) {
        if (spec.type !== 'slot' || !item.contractId || !item.dep || item.nativeContractPart)
          throw Error('NATIVE_PREPARED_LIBRARY_DEFAULT_SLOT_UNQUALIFIED');
        item.nativeContractPart = {...spec.nativeContractPart, defaultSlotIndex:index};
      }
    }
    for (const name of Object.values(spec.bindings ?? {})) boundNames.add(name);
    for (const name of [spec.fill, spec.stroke, spec.fixedWidth?.varName, spec.fixedHeight?.varName, spec.instanceSize?.varName, spec.instanceInk?.varName, spec.svgPaintVar,
      spec.textFill, spec.fontSizeVar, spec.fontWeightVar, spec.lineHeightVar])
      if (name) boundNames.add(name);
    (spec.children ?? []).forEach((child, i) => visit(child, variant, [...specPath, i], spec, insideCallerSlot));
  }
  data.variants.forEach(v => visit(v.spec, v.name, []));
  if (library) {
    data.stateVariants?.forEach(v => visit(v.spec, v.name, []));
    for (const prop of component.textProps) {
      if (textProperties.get(prop.property) !== prop.default) throw Error('NATIVE_PREPARED_LIBRARY_TEXT_MAPPING_UNQUALIFIED');
      boundTextProperties.add(prop.property);
    }
  }
  if (boundTextProperties.size !== textProperties.size)
    throw Error('NATIVE_CONTRACT_DRAFT_TEXT_MAPPING_UNQUALIFIED');
  const templatePlan = library ? undefined : planNativeRootTextTemplate(data, { contractRevision: projection.contractRevision, tokenRevision: projection.tokenRevision });
  if (templatePlan) {
    projection.rootTextTemplate = templatePlan;
    applyRootTextTemplateAliases(data, templatePlan);
    for (const name of Object.values(templatePlan.aliases)) boundNames.add(name);
  }
  data.nativeContractDraft = { revision: revisionOf(projection), acceptedContract: null };
  return { projection, component: data, boundNames: [...boundNames].sort(), fonts: [...fonts.values()] };
}
