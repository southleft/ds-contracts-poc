import {nativeLiteralTextBox} from './native-text-box.js';
import {nativeScalarFaceWeight} from './native-text-appearance.js';
import {nativeFontNameExact,nativeFontDefaultProfileRequired} from './native-font-profile.js';
import {nativeTextAppearanceMatches,nativeTextAppearanceDefaultProfileRequired} from './native-text-appearance-observation.js';
import {nativeImageOverrideMatches} from './native-image-observation.js';
import {nativeLineNodeMatches} from './native-line-observation.js';
import {nativeStrokedPathNodeMatches,nativeStrokedPathPaintMatches} from './native-stroked-path.js';
import {packNativeReadback} from './native-readback-transport.js';
import {nativeBoundNumber} from './native-bound-number.js';
import {resolveNativeAbsoluteGeometry} from '@ds-contracts/schema';
import {nativePaintStackMatches,nativeBoundPaintColor} from './native-paint-observation.js';
import {boundFillInventory} from './bound-fill-inventory.js';
import {nativeFilledPathMatches, nativeFilledPathResizeMatches} from './native-filled-path.js';
import {nativeGraphVariants, nativeLibraryReactionsMatch, type NativePreparedLibraryProjection} from './native-prepared-library.js';
/** Independent native observation. Creation acknowledgements supply IDs only;
 * expected semantics come from the saved host-authenticated source plan. */
import { verifyRootTextTemplateTokenContext, applyRootTextTemplateAliases } from './native-root-text-template-plan.js';
import { planNativeRootTextTemplateGraph, nativeRootTextTemplateGraphSelection, type NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt, type NativeTemplateGraphIdentity } from './native-root-text-template-graph-native.js';
import { resolveNativeSlotIdentities, resolveNativeGraphSlotIdentities } from "./native-slot-identity.js";
import { positionedAs, emptySlotWidth } from './native-float32.js';
import { NATIVE_GRID_FIELDS, NATIVE_GRID_CHILD_FIELDS, nativeGridProblems } from './native-grid-observation.js';
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import type { ComponentData, NodeSpec } from "./emit-figma-script.js";
import type { NativeSourceCandidateProjection } from "./native-source-projection.js";
import type { NativeContractDraftProjection } from "./native-contract-draft.js";
import type { NativeSourceComparisonInput } from "./native-source-comparisons.js";
import { emitNativeTokenContextReadbackScript } from "./token-set.js";
import { emitNativeTokenExtensionContextReadbackScript } from './native-token-extension.js';
import {backgroundPaintIdentities} from './figma-background-clip.js';
import {validNativeGraphCreation} from './native-graph-creation.js';
import {
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
  type NativeTokenIdentity,
} from "./native-token-context.js";

export interface NativeSourceObservationInput {
  operation: { id: string; fileKey: string };
  planRevision: string;
  component: ComponentData;
  projection: NativeSourceCandidateProjection;
  samples: NativeSourceComparisonInput["samples"];
  tokenInput: NativeTokenContextInput;
  tokenIdentity: NativeTokenIdentity;
  /** Independently persisted allocation acknowledgement, never a readback's
   * own suggestion of which native IDs should have been written. */
  creation: Record<string, any>;
  /** Host-retained first observation, never supplied by the current readback. */
  allocationAnchor?: NativeSourceReadback;
}
export interface NativeSourceReadback {
  version: 1;
  status: "native-readback-collected" | "refused";
  receiptKind: "independent-native-component-readback";
  operationId: string;
  fileKey: string;
  planRevision: string;
  acceptedContract: null;
  nativeQualification: "unqualified";
  nodes?: Array<Record<string, any>>;
  tokens?: Record<string, any>;
  templateGraph?: Record<string, any>;
  images?: Array<{ caseId: string; nodeId: string; pngBase64: string }>;
  problems: string[];
}
export interface NativeContractObservationInput extends Omit<NativeSourceObservationInput, 'projection' | 'samples'> {
  projection: NativeContractDraftProjection;
  /** Closed operation-scoped graph, in dependency order with component last. */
  graphComponents?: ComponentData[];
  /** Versioned full dependency semantics with independently retained creation IDs. */
  graphVerification?: 1;
  /** Host-derived provenance for an independently verified allocation extension. */
  backgroundMigration?: {desiredRevision:string;allocationRevision:string};
  /** A pending additive token correction uses a complete collection inventory.
   * Its IDs are adopted only after the separate extension verifier succeeds. */
  tokenExtensionReadback?: import('./native-token-extension.js').NativeTokenExtensionPlan;
  /** New geometry corrections require fresh constraint evidence. Absent on
   * historical inputs, so their pinned readback programs remain byte-identical. */
  absoluteShapeReadback?: {version:1|2|3;nodeIds:string[]};
  /** Explicit layout evidence for a future bounded cross-axis update. Absent
   * from historical inputs and programs; this readback grants no write. */
  fixedCrossSizeReadback?: {version:1;nodeIds:string[]};
  /** Engine-derived original specs and persisted variable allocation IDs. */
  templateGraph?: { input: NativeRootTextTemplateGraphInput; identity: NativeTemplateGraphIdentity };
}
export interface NativePreparedLibraryObservationInput extends Omit<NativeContractObservationInput, 'projection' | 'graphVerification'> {
  projection: NativePreparedLibraryProjection;
  graphVerification: 2;
  graphComponents: ComponentData[];
}
export type NativeInspectionInput = NativeSourceObservationInput | NativeContractObservationInput | NativePreparedLibraryObservationInput;
function isContractDraft(input: NativeInspectionInput): input is NativeContractObservationInput | NativePreparedLibraryObservationInput {
  return 'kind' in input.projection && ['contract-draft','prepared-contract-library'].includes(input.projection.kind);
}
/** Exports are diagnostic mains for a Contract draft; source comparisons remain
 * separate instances. Neither image kind is a visual-fidelity result. */
export function nativeInspectionExports(input: NativeInspectionInput): Array<{id: string; instanceId: string; type: string}> {
  return isContractDraft(input)
    ? input.creation.variants.map((v: any) => ({ id: `variant:${v.name}`, instanceId: v.id, type: 'COMPONENT' }))
    : input.creation.comparisons.filter((c: any) => c.status === 'created-comparison')
      .map((c: any) => ({ id: c.id, instanceId: c.instanceId, type: 'INSTANCE' }));
}
function insetOverlayMatches(spec:NodeSpec,v:Record<string,any>,parent:Record<string,any>|undefined):boolean{
  const o=spec.insetOffsets??{top:0,right:0,bottom:0,left:0};
  const fw=spec.fixedWidth?.px??spec.lits?.width,fh=spec.fixedHeight?.px??spec.lits?.height;
  return !!parent&&v.layoutPositioning==='ABSOLUTE'&&
    (!spec.layout||(v.primaryAxisSizingMode==='FIXED'&&v.counterAxisSizingMode==='FIXED'))&&
    numeric(v.x,o.left)&&numeric(v.y,o.top)&&
    numeric(v.width,Math.max(1,fw??(parent.width-o.left-o.right)))&&
    numeric(v.height,Math.max(1,fh??(parent.height-o.top-o.bottom)))&&
    same(v.constraints,{horizontal:fw!==undefined?'MIN':'STRETCH',vertical:fh!==undefined?'MIN':'STRETCH'});
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const numeric = (actual: unknown, expected: number) =>
  actual === expected || actual === Math.fround(expected);
/** A SCALE-constrained child's inherited origin. Figma can retain the main's
 * own sub-float32-step offset instead of scaling it (live CBDS Checkbox,
 * 2026-09-25: 3.0959e-8 kept where 1.5480e-8 was expected). That is accepted
 * only when the retained value IS the source value verbatim and both land on
 * the same float32 position in the parent's frame; any other value refuses. */
export const scaledOrigin = (actual: unknown, source: number, scale: number, parentOffset: unknown) =>
  numeric(actual, source * scale) ||
  (actual === source && typeof parentOffset === 'number' &&
    Math.fround(parentOffset + source) === Math.fround(parentOffset + source * scale));
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Check the compiled shadow stack independently of the writer. Native numbers
 * may be float32; no broader colour/geometry tolerance is granted here. */
export function nativeShadowStackMatches(spec: NodeSpec, effects: unknown): boolean {
  let expected = spec.effectStack;
  if (!expected && spec.dropShadow) {
    const s = spec.dropShadow, hex = s.color.replace(/^#/, '');
    if (!/^(?:[a-f0-9]{6}|[a-f0-9]{8})$/i.test(hex)) return false;
    expected = [{ ...s, color: { r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255,
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 } }];
  }
  const layers = expected ?? [];
  if (!Array.isArray(effects)) return layers.length === 0 && effects === undefined;
  if (effects.length !== layers.length) return false;
  return layers.every((layer, index) => {
    const effect = effects[index];
    if (!object(effect) || effect.type !== (layer.inner ? 'INNER_SHADOW' : 'DROP_SHADOW') ||
        effect.visible !== true || effect.blendMode !== 'NORMAL' ||
        !object(effect.offset) || !object(effect.color) ||
        !numeric(effect.offset.x, layer.x) || !numeric(effect.offset.y, layer.y) ||
        !numeric(effect.radius, layer.radius) || !numeric(effect.spread, layer.spread ?? 0) ||
        (effect.boundVariables !== undefined && (!object(effect.boundVariables) || Object.keys(effect.boundVariables).length)) ||
        (effect.showShadowBehindNode !== undefined && effect.showShadowBehindNode !== true)) return false;
    return (['r', 'g', 'b', 'a'] as const).every(channel =>
      numeric(effect.color[channel], layer.color[channel] ?? 1));
  });
}

function checkInput(input: NativeInspectionInput) {
  const c = input.creation;
  if (isContractDraft(input) && input.projection.kind === 'prepared-contract-library' &&
      (input.graphVerification !== 2 || !same(input.projection.source,input.tokenInput.source) ||
       input.templateGraph || input.backgroundMigration || input.fixedCrossSizeReadback || input.absoluteShapeReadback || input.tokenExtensionReadback))
    throw Error('native-prepared-library-observation-context-invalid');
  if (('graphVerification' in input && input.graphVerification !== undefined) || c?.graphVerification !== undefined) {
    if (!isContractDraft(input) || input.graphVerification !== (input.projection.kind === 'prepared-contract-library' ? 2 : 1) ||
        c?.graphVerification !== input.graphVerification ||
         !validNativeGraphCreation(input.graphComponents, c, input.graphVerification))
      throw Error('native-graph-observation-creation-invalid');
  }
  if (isContractDraft(input) && input.projection.rootTextTemplate) {
    if (input.graphComponents) throw Error('native-text-template-graph-unqualified');
    if (input.templateGraph) {
      const { input: original, identity } = input.templateGraph, graph = planNativeRootTextTemplateGraph(original);
      if (original.renderScope !== 'component' || !same(original.tokens, input.tokenInput) || !same(identity.source, input.tokenIdentity) ||
          !same(graph.template, input.projection.rootTextTemplate)) throw Error('native-text-template-graph-context-changed');
      const expected = structuredClone(original.component);
      applyRootTextTemplateAliases(expected, graph.template);
      const visit = (spec: NodeSpec, variant: string, specPath: number[]) => {
        spec.nativeContractPart = { contractRevision: input.projection.contractRevision, variant, specPath };
        spec.children?.forEach((child, i) => visit(child, variant, [...specPath, i]));
      };
      expected.variants.forEach(v => visit(v.spec, v.name, []));
      expected.nativeContractDraft = { revision: revisionOf(input.projection), acceptedContract: null };
      if (!same(expected, input.component)) throw Error('native-text-template-graph-component-changed');
      emitNativeTemplateGraphReadbackScript(original, identity); // complete identity validation
    } else verifyRootTextTemplateTokenContext(input.tokenInput, input.projection.rootTextTemplate);
  }
  if (isContractDraft(input) && input.templateGraph && (!input.projection.rootTextTemplate || input.fixedCrossSizeReadback || input.backgroundMigration || input.absoluteShapeReadback))
    throw Error('native-text-template-graph-readback-unqualified');
  if (isContractDraft(input) && input.fixedCrossSizeReadback !== undefined) {
    const guard = input.fixedCrossSizeReadback;
    if (guard.version !== 1 || !Array.isArray(guard.nodeIds) || !guard.nodeIds.length ||
        new Set(guard.nodeIds).size !== guard.nodeIds.length ||
        guard.nodeIds.some(id => !c?.nodes?.some((n: any) => n.id === id && ['COMPONENT','FRAME','RECTANGLE','ELLIPSE'].includes(n.type))))
      throw Error('native-fixed-cross-size-readback-input-invalid');
  }
  if (isContractDraft(input) && input.absoluteShapeReadback !== undefined) {
    const guard = input.absoluteShapeReadback;
    if (![1,2,3].includes(guard.version) || !Array.isArray(guard.nodeIds) || !guard.nodeIds.length ||
        new Set(guard.nodeIds).size !== guard.nodeIds.length ||
        guard.nodeIds.some(id => !c?.nodes?.some((n: any) => n.id === id && ['RECTANGLE','ELLIPSE'].includes(n.type))))
      throw Error('native-absolute-shape-readback-input-invalid');
  }
  const graphValid = !isContractDraft(input) || input.graphComponents === undefined ||
    (Array.isArray(input.graphComponents) && input.graphComponents.length >= (input.projection.kind === 'prepared-contract-library' ? 1 : 2) &&
     same(input.graphComponents.at(-1), input.component) &&
     new Set(input.graphComponents.map(component => component.contractId)).size === input.graphComponents.length &&
     input.graphComponents.every(component => component.nativeContractDraft && !component.nativeSourceCandidate) &&
     Array.isArray(c?.graphTargets) && c.graphTargets.length === input.graphComponents.length);
  if (
    !c ||
    c.status !== "created-candidate" ||
    c.operationId !== input.operation.id ||
    c.fileKey !== input.operation.fileKey ||
    !Array.isArray(c.nodes) ||
    !c.nodes.length ||
    c.nodes.some((n: any) => !object(n) || typeof n.id !== "string" || !n.id) ||
    new Set(c.nodes.map((n: any) => n.id)).size !== c.nodes.length ||
    typeof c.pageId !== "string" ||
    !c.target ||
    !Array.isArray(c.variants) ||
    input.tokenInput.fileKey !== input.operation.fileKey ||
    input.tokenIdentity.fileKey !== input.operation.fileKey ||
    input.tokenInput.scopeId !== `source-${input.operation.id}` ||
    !graphValid ||
    !(isContractDraft(input) ?
      same(input.component.nativeContractDraft, { revision: revisionOf(input.projection), acceptedContract: null }) &&
      !input.component.nativeSourceCandidate && c.comparisons === undefined && c.comparisonBoardId === undefined :
      Array.isArray(c.comparisons) && same(input.component.nativeSourceCandidate, {
      revision: revisionOf(input.projection),
      purpose: "source-candidate-inspection",
      acceptedContract: null,
    }) &&
    same(
      input.samples.cases.map((row) => row.id),
      input.projection.cases.map((row) => row.id),
    )) ||
    !/^sha256:[a-f0-9]{64}$/.test(input.planRevision)
  )
    throw Error("native-source-observation-input-invalid");
}

/** A read-only script: no adoption, variable assignment, property update,
 * selection/current-page change, repair or allocation. Export is opt-in so
 * structural probes can run on hosts without a raster export implementation. */
export function emitNativeSourceReadbackScript(
  input: NativeSourceObservationInput,
  captureImages = false,
): string {
  return emitNativeInspectionReadbackScript(input, captureImages);
}
export function emitNativePreparedLibraryReadbackScript(input: NativePreparedLibraryObservationInput, captureImages = false): string {
  return emitNativeInspectionReadbackScript(input, captureImages);
}
/** Lossless bounded transport for a complete prepared-library observation.
 * Decode on the host, then run verifyNativePreparedLibraryReadback unchanged. */
export function emitNativePreparedLibraryPackedReadbackScript(input: NativePreparedLibraryObservationInput): string {
  return emitNativeInspectionReadbackScript(input, false, false, false, true);
}
export function emitNativeContractReadbackScript(input: NativeContractObservationInput, captureImages = false, captureExportBounds = false): string {
  return emitNativeInspectionReadbackScript(input, captureImages, captureExportBounds);
}
/** Read every recorded field without yielding after a caller has loaded all
 * pages and warmed the static registry APIs. No images or instances are allowed.
 * This is a final live recheck, not a replacement for independent observation. */
export function emitNativeFixedCrossSizeSyncReadback(input: NativeContractObservationInput): string {
  return emitNativeInspectionReadbackScript(input, false, false, true);
}
/** Final non-yielding template recheck after the complete document is loaded.
 * Includes allocated routing/source objects and every recorded component field. */
export function emitNativeTemplateSyncReadback(input: NativeContractObservationInput): string {
  if (!input.templateGraph || input.component.rootSlot?.textTemplate !== 1)
    throw Error('native-template-sync-input-invalid');
  return emitNativeInspectionReadbackScript(input, false, false, true);
}
export function emitNativeInspectionReadbackScript(input: NativeInspectionInput, captureImages = false, captureExportBounds = false, synchronous = false, packed = false): string {
  checkInput(input);
  if(packed && (!isContractDraft(input) || input.projection.kind !== 'prepared-contract-library' || input.templateGraph || captureImages || captureExportBounds || synchronous)) throw Error('native-packed-readback-input-invalid');
  if(synchronous && (!isContractDraft(input) || !input.fixedCrossSizeReadback && !input.templateGraph || captureImages || captureExportBounds))
    throw Error('native-fixed-cross-size-sync-input-invalid');
  const expected = {
    operation: input.operation,
    planRevision: input.planRevision,
    pageId: input.creation.pageId,
    nodes: input.creation.nodes,
    comparisons: nativeInspectionExports(input),
  };
  const observedComponents = isContractDraft(input) && input.graphVerification !== undefined
    ? input.graphComponents! : [input.component];
  const observedVariants = isContractDraft(input) && input.graphVerification !== undefined
    ? observedComponents.flatMap(c => [...c.variants, ...(c.stateVariants ?? [])]) : input.component.variants;
  const managedRows = (spec: NodeSpec): boolean => !!spec.layout?.grid?.flowRows || (spec.children ?? []).some(managedRows);
  const extra = observedVariants.some(v => managedRows(v.spec)) ? ['gridFlowRows'] : [];
  const hasImageControl=(spec:NodeSpec):boolean=>!!spec.imagePaint||!!spec.imageTarget||!!spec.instanceImages||!!spec.children?.some(hasImageControl);
  if(isContractDraft(input)&&observedVariants.some(v=>hasImageControl(v.spec)))extra.push('imageOverride');
  const hasTextAppearance=(spec:NodeSpec):boolean=>!!spec.textAppearanceTarget||!!spec.instanceTextAppearances||!!spec.children?.some(hasTextAppearance);
  if(isContractDraft(input)&&observedVariants.some(v=>hasTextAppearance(v.spec)))extra.push('textAppearanceOverride');
  const hasAuthoredTextAppearance=(spec:NodeSpec):boolean=>!!spec.authoredTextAppearance||!!spec.authoredTextAppearanceTarget||!!spec.instanceAuthoredTextAppearance||!!spec.slotDefault?.some(item=>item.instanceAuthoredTextAppearance)||!!spec.children?.some(hasAuthoredTextAppearance);
  if(isContractDraft(input)&&observedVariants.some(v=>hasAuthoredTextAppearance(v.spec)))extra.push('authoredTextAppearance','authoredTextInstance');
  const hasTextColor = (spec:NodeSpec):boolean=>!!spec.textColorTarget||!!spec.instanceTextColors||!!spec.children?.some(hasTextColor);
  if(isContractDraft(input)&&observedVariants.some(v=>hasTextColor(v.spec)))extra.push('textColorOverride');
  // Saved plans authenticate program bytes. New fields belong only to specs
  // that require them; the general inventory API still reads the full set.
  const hasArcCap = (spec: NodeSpec): boolean => spec.shape?.kind==='line' || !!spec.shape?.arc?.cap || !!spec.children?.some(hasArcCap);
  const hasText = (spec: NodeSpec): boolean => spec.type === 'text' || !!spec.children?.some(hasText);
  const hasWeightedText = (spec: NodeSpec): boolean => (spec.type === 'text' && !!spec.fontWeightVar) || !!spec.children?.some(hasWeightedText);
  if (isContractDraft(input) && observedVariants.some(v => hasText(v.spec))) extra.push('fontWeightVar', 'lineHeightVar');
  const hasCallerContent = (spec: NodeSpec): boolean => spec.callerContentProp !== undefined || !!spec.children?.some(hasCallerContent);
  const hasMask = (spec: NodeSpec): boolean => spec.shape?.kind==='line' || spec.shape?.kind === 'stroked-path' || !!spec.instanceInsideStroke || !!spec.mask || !!spec.children?.some(hasMask);
  const hasCapturedGeometry = (spec: NodeSpec): boolean => spec.shape?.kind==='line' || !!spec.capturedAbsoluteGeometry || !!spec.insetOverlay || !!spec.children?.some(hasCapturedGeometry);
  const hasStrokeLayout = (spec: NodeSpec): boolean => spec.insetRingStroke === true ||
    (['root','frame'].includes(spec.type) && !!spec.lits?.strokeColor && typeof spec.lits.strokeWeight === 'number') ||
    !!spec.children?.some(hasStrokeLayout);
  const hasPathInk = (spec: NodeSpec): boolean => spec.shape?.kind === 'stroked-path' || spec.nativePathInk === true || spec.nativeMaskPath === true || !!spec.children?.some(hasPathInk);
  const hasBoundPaint = (spec:NodeSpec):boolean=>!!spec.solidFillCompositionToken||!!spec.children?.some(hasBoundPaint);
  const hasAspectRatio = (spec: NodeSpec): boolean => spec.nativeAspectRatio !== undefined || !!spec.children?.some(hasAspectRatio);
  if (isContractDraft(input) && observedVariants.some(v => hasCallerContent(v.spec))) extra.push('callerContentProperty');
  if (isContractDraft(input) && input.graphVerification === 2) extra.push('statePreviewAxis');
  const extension=isContractDraft(input)?input.tokenExtensionReadback:undefined;
  if(extension && (synchronous || !same(extension.before,input.tokenInput) || !same(extension.identity,input.tokenIdentity)))
    throw Error('native-token-extension-reader-input-invalid');
  const inventory = emitNativeInventoryReadbackScript(expected, input.tokenInput, input.tokenIdentity,
    isContractDraft(input) ? ['nativeContractPart', 'rootSlot', 'codeValueAxes', 'unsetVariantAxes', 'semantics', 'propNames', ...extra] : extra, captureImages, captureExportBounds, observedComponents.flatMap(backgroundPaintIdentities),
    isContractDraft(input) ? input.absoluteShapeReadback?.nodeIds : undefined,
    isContractDraft(input) && input.absoluteShapeReadback?.version === 3 ? 'strict' : isContractDraft(input) && input.absoluteShapeReadback?.version === 2,
    isContractDraft(input) ? input.fixedCrossSizeReadback?.nodeIds : undefined, synchronous,
    isContractDraft(input) && input.component.rootSlot?.textTemplate === 1,
    extension ? emitNativeTokenExtensionContextReadbackScript(extension) : undefined, false,
    observedVariants.some(v => hasPathInk(v.spec)), observedVariants.some(v => hasCapturedGeometry(v.spec)), observedVariants.some(v => hasMask(v.spec)), packed, observedVariants.some(v => hasArcCap(v.spec)), undefined, observedVariants.some(v => hasStrokeLayout(v.spec)),observedVariants.some(v=>hasBoundPaint(v.spec)), observedVariants.some(v => hasAspectRatio(v.spec)), isContractDraft(input) && (input.graphVerification === 2 || observedVariants.some(v => hasWeightedText(v.spec)) || observedVariants.some(v => hasAuthoredTextAppearance(v.spec))));
  if (!isContractDraft(input) || !input.templateGraph) return inventory;
  if (synchronous) {
    const graphRead = emitNativeTemplateGraphReadbackScript(input.templateGraph.input, input.templateGraph.identity, true);
    return `// GENERATED synchronous component and selector-graph recheck.
const readGraph = () => { ${graphRead}\n };
const before = readGraph();
const observed = (() => { ${inventory}\n })();
const after = readGraph();
if (before.status !== 'readback-collected' || after.status !== 'readback-collected' || JSON.stringify(before) !== JSON.stringify(after)) {
  observed.status = 'refused'; observed.problems.push('native-text-template-graph-changed-during-read');
}
observed.templateGraph = after;
return observed;
`;
  }
  const graphRead = emitNativeTemplateGraphReadbackScript(input.templateGraph.input, input.templateGraph.identity);
  return `// GENERATED independent component and selector-graph observation.
const readGraph = async () => { ${graphRead}\n };
const before = await readGraph();
const observed = await (async () => { ${inventory}\n })();
const after = await readGraph();
if (before.status !== 'readback-collected' || after.status !== 'readback-collected' || JSON.stringify(before) !== JSON.stringify(after)) {
  observed.status = 'refused'; observed.problems.push('native-text-template-graph-changed-during-read');
}
observed.templateGraph = after;
return observed;
`;
}

/** Shared read-only inventory collector. Callers independently verify the
 * returned facts against their own authenticated operation plan. */
export function emitNativeInventoryReadbackScript(expected: {
  operation: { id: string; fileKey: string }; planRevision: string; pageId: string;
  nodes: Array<{ id: string; type: string }>;
  comparisons: Array<{ id: string; instanceId: string; type: string }>;
}, tokenInput: NativeTokenContextInput, tokenIdentity: NativeTokenIdentity, extraMetadata: string[], captureImages = false, captureExportBounds = false, backgroundParts:string[]=[], absoluteShapeNodeIds:string[]=[], absoluteShapeAspectRatio:boolean|'strict'=false, fixedCrossSizeNodeIds:string[]=[], synchronous=false, textTemplate=false, tokenReadback?:string, synchronousPartialInventory=false, filledPaths=false, capturedGeometry=false, masks=false, packed=false, arcCaps=true, pairedArcCapFields?: Record<string, string[]>, strokeLayout=false,boundPaint=false,aspectRatio=true, contractDraftText=false): string {
  const originalImages=extraMetadata.includes('imageOverride');
  if(synchronous&&originalImages)throw Error('native-image-original-readback-requires-async');
  if(synchronousPartialInventory && !synchronous) throw Error('native-partial-sync-inventory-required');
  if(synchronous && (!fixedCrossSizeNodeIds.length && !textTemplate && !synchronousPartialInventory || captureImages || captureExportBounds))
    throw Error('native-fixed-cross-size-sync-input-invalid');
  const fields = [
    ...(capturedGeometry?['rotation']:[]),
    ...(boundPaint?['rotation','cornerSmoothing','itemReverseZIndex','isMask','blendMode','constraints']:[]),
    "visible",
    "opacity",
    "x",
    "y",
    "width",
    "height",
    "relativeTransform",
    ...(aspectRatio ? ["targetAspectRatio"] : []),
    "layoutMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "layoutPositioning",
    ...(capturedGeometry ? ["constraints"] : []),
    "layoutWrap",
    "clipsContent",
    "itemSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "fills",
    "strokes",
    "strokeAlign",
    ...(arcCaps ? ["arcData", "strokeCap"] : []),
    "strokeWeight",
    ...(strokeLayout ? ["strokesIncludedInLayout", "dashPattern"] : []),
    "strokeTopWeight",
    "strokeRightWeight",
    "strokeBottomWeight",
    "strokeLeftWeight",
    "topLeftRadius",
    "topRightRadius",
    "bottomRightRadius",
    "bottomLeftRadius",
    "cornerRadius",
    "effects",
    "boundVariables",
    "explicitVariableModes",
    "resolvedVariableModes",
    "componentPropertyReferences",
    "characters",
    "fontName",
    "fontSize",
    "lineHeight",
    "textAlignHorizontal",
    "letterSpacing",
    "textCase",
    "textDecoration",
    "textStyleId",
    "vectorPaths",
    ...(filledPaths ? ['isMask', 'blendMode', 'constraints'] : []),
    ...(masks ? ['isMask', 'maskType', 'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'dashPattern'] : []),
    "reactions",
    ...((textTemplate || contractDraftText) ? ['textAutoResize', 'fontWeight'] : []),
  ];
  return `// GENERATED independent native source readback. READ ONLY.
const EXPECTED = ${JSON.stringify(expected)};
const FIELDS = ${JSON.stringify(fields)};${pairedArcCapFields && Object.keys(pairedArcCapFields).length ? `\nconst PAIRED_ARC_CAP_FIELDS = ${JSON.stringify(pairedArcCapFields)};` : ''}
const result = { version: 1, status: 'refused', receiptKind: 'independent-native-component-readback',
  operationId: EXPECTED.operation.id, fileKey: EXPECTED.operation.fileKey, planRevision: EXPECTED.planRevision,
  acceptedContract: null, nativeQualification: 'unqualified', problems: [] };
const copy = x => JSON.parse(JSON.stringify(x));
const stable = x => JSON.stringify((function order(v) {
  if (Array.isArray(v)) return v.map(order);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).sort().map(k => [k, order(v[k])]));
})(x));
function guard() { if (figma.fileKey !== EXPECTED.operation.fileKey) throw Error('native-source-readback-file-mismatch'); }
${synchronous ? 'function tokenRead() { return (() => {' : 'async function tokenRead() { return await (async () => {'}
${tokenReadback ?? emitNativeTokenContextReadbackScript(tokenInput, tokenIdentity, synchronous)}
})(); }
${synchronous ? '' : 'async '}function read(page) {
  const nodes = [page, ...page.findAll(() => true)];
  if (nodes.length > 10000) throw Error('native-source-readback-scope-too-large');
  const out = [];${originalImages ? '\n  const originalAssets = new Map(); let originalBytes = 0;' : ''}
  for (const node of nodes) {
    const row = { id: node.id, type: node.type, name: node.name, parentId: node.parent ? node.parent.id : null,
      childIds: node.children ? node.children.map(c => c.id) : [], values: {}, metadata: {} };
    if (typeof node.key === 'string') row.key = node.key;
    const fields = FIELDS.concat(node.layoutMode === 'GRID' ? ${JSON.stringify(NATIVE_GRID_FIELDS)} : [],
      node.parent && node.parent.layoutMode === 'GRID' ? ${JSON.stringify(NATIVE_GRID_CHILD_FIELDS)} : []);
    for (const field of fields) if (field in node${pairedArcCapFields && Object.keys(pairedArcCapFields).length ? ` && (!['arcData','strokeCap'].includes(field) || !Object.prototype.hasOwnProperty.call(PAIRED_ARC_CAP_FIELDS, node.id) || PAIRED_ARC_CAP_FIELDS[node.id].includes(field))` : ''}) {
      const v = node[field];
      row.values[field] = typeof v === 'symbol' ? { mixed: true } : v === undefined ? null : copy(v);
    }${extraMetadata.includes('authoredTextAppearance') ? `\n    if(node.type==='TEXT'&&(${extraMetadata.includes('textAppearanceOverride') ? "node.getSharedPluginData('ds_contracts','textAppearanceOverride')||" : ''}node.getSharedPluginData('ds_contracts','authoredTextAppearance')))row.values.textAppearanceRuns=copy(node.getStyledTextSegments(['fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','fills']));` : extraMetadata.includes('textAppearanceOverride') ? `\n    if(node.type==='TEXT'&&node.getSharedPluginData('ds_contracts','textAppearanceOverride'))row.values.textAppearanceRuns=copy(node.getStyledTextSegments(['fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration','fills']));` : ''}${originalImages ? `\n    if (Array.isArray(row.values.fills)) for (const paint of row.values.fills) if (paint.type === 'IMAGE') {
      const hash = paint.imageHash;
      if (typeof hash !== 'string' || !hash || typeof figma.getImageByHash !== 'function' || typeof figma.base64Encode !== 'function') throw Error('native-image-original-readback-unavailable');
      if (!originalAssets.has(hash)) {
        const asset = figma.getImageByHash(hash);
        if (!asset || typeof asset.getBytesAsync !== 'function') throw Error('native-image-original-readback-unavailable');
        const bytes = await asset.getBytesAsync(); guard();
        if (!bytes || !Number.isInteger(bytes.length) || bytes.length <= 0 || bytes.length > 8*1024*1024) throw Error('native-image-original-readback-asset-budget');
        originalBytes += bytes.length;
        if (originalBytes > 32*1024*1024) throw Error('native-image-original-readback-total-budget');
        originalAssets.set(hash,figma.base64Encode(bytes));
      }
      (row.imageAssets || (row.imageAssets = {}))[hash] = originalAssets.get(hash);
    }` : ''}
    if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent.type !== 'COMPONENT_SET'))
      row.definitions = copy(node.componentPropertyDefinitions);
    if (node.type === 'COMPONENT' && node.parent.type === 'COMPONENT_SET') row.variantProperties = copy(node.variantProperties);
    if (node.type === 'INSTANCE') {
      const main = ${synchronous ? textTemplate || synchronousPartialInventory ? 'node.mainComponent' : "(()=>{throw Error('native-fixed-cross-size-sync-instance-unsupported');})()" : 'await node.getMainComponentAsync()'}; guard();
      row.mainId = main ? main.id : null;
      row.componentProperties = copy(node.componentProperties);
    }
    for (const key of ['nativeSourceOperation', 'nativeSourceAllocation', 'nativeSourcePart', 'nativeSourceSample', 'nativeSourceCase', 'contractId', 'specHash', 'canvasFingerprint'${extraMetadata.map(key => ", " + JSON.stringify(key)).join('')}])
      row.metadata[key] = node.getSharedPluginData('ds_contracts', key);
    ${backgroundParts.length ? `if (node.type === 'RECTANGLE' && row.metadata.nativeContractPart && ${JSON.stringify(backgroundParts)}.includes(stable(JSON.parse(row.metadata.nativeContractPart)))) { row.values.constraints = copy(node.constraints); const migration = node.getSharedPluginData('ds_contracts', 'nativeBackgroundMigration'); if (migration) row.metadata.nativeBackgroundMigration = migration; }` : ''}
    ${absoluteShapeNodeIds.length ? `if (${JSON.stringify(absoluteShapeNodeIds)}.includes(node.id)) ${absoluteShapeAspectRatio === 'strict' ? `{row.values.constraints = copy(node.constraints);if(node.targetAspectRatio === undefined)throw Error('native-absolute-shape-aspect-ratio-unavailable');row.values.targetAspectRatio = copy(node.targetAspectRatio);}` : absoluteShapeAspectRatio ? `{row.values.constraints = copy(node.constraints);row.values.targetAspectRatio = node.targetAspectRatio ?? null;}` : `row.values.constraints = copy(node.constraints);`}` : ''}${fixedCrossSizeNodeIds.length ? `if (${JSON.stringify(fixedCrossSizeNodeIds)}.includes(node.id)) {
      for (const field of ['constraints','targetAspectRatio','layoutAlign','layoutGrow',...(['COMPONENT','FRAME'].includes(node.type)?['strokesIncludedInLayout']:[])]) {
        if (!(field in node) || node[field] === undefined) throw Error('native-fixed-cross-size-layout-unavailable:'+field);
        row.values[field] = typeof node[field] === 'symbol' ? {mixed:true} : copy(node[field]);
      }
    }` : ''}out.push(row);
  }
  return out;
}
try {
  guard();
  ${synchronous ? "if(typeof figma.getNodeById!=='function')throw Error('native-fixed-cross-size-sync-api-unavailable');" : 'await figma.loadAllPagesAsync();'} guard();
  const page = ${synchronous ? 'figma.getNodeById' : 'await figma.getNodeByIdAsync'}(EXPECTED.pageId); guard();
  if (!page || page.type !== 'PAGE' || page.id !== EXPECTED.pageId) throw Error('native-source-readback-page-missing');
  const firstTokens = ${synchronous ? '' : 'await '}tokenRead(), first = ${synchronous ? '' : 'await '}read(page);
  const images = []; let imageBytes = 0;
  ${
    captureImages
      ? `for (const c of EXPECTED.comparisons) {
    const node = await figma.getNodeByIdAsync(c.instanceId); guard();
    if (!node || node.type !== c.type || typeof node.exportAsync !== 'function' || typeof figma.base64Encode !== 'function')
      throw Error('native-source-readback-export-unavailable');
    ${captureExportBounds ? `const exportBounds = node.absoluteBoundingBox && node.absoluteRenderBounds
      ? JSON.parse(JSON.stringify({ layout: node.absoluteBoundingBox, render: node.absoluteRenderBounds })) : undefined;
    ` : ''}const png = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } }); guard();${captureExportBounds ? `
    if (exportBounds && stable(exportBounds) !== stable({ layout: node.absoluteBoundingBox, render: node.absoluteRenderBounds }))
      throw Error('native-source-readback-export-bounds-changed');` : ''}
    if (!png || !png.length) throw Error('native-source-readback-export-invalid');
    imageBytes += png.length;
    if (imageBytes > 1024 * 1024) throw Error('native-source-readback-image-byte-limit');
    images.push({ caseId: c.id, nodeId: c.instanceId, pngBase64: figma.base64Encode(png)${captureExportBounds ? ', ...(exportBounds ? { exportBounds } : {})' : ''} });
  }`
      : ""
  }
  // Async native reads and exports are not an atomic snapshot. Refuse changes
  // across the observation window instead of combining two different states.
  const second = ${synchronous ? '' : 'await '}read(page), secondTokens = ${synchronous ? '' : 'await '}tokenRead(); guard();
  if (stable(first) !== stable(second) || stable(firstTokens) !== stable(secondTokens)) throw Error('native-source-readback-changed-during-observation');
  result.nodes = second; result.tokens = secondTokens; result.images = images;
  result.status = 'native-readback-collected';
${packed ? '  const transport = (' + packNativeReadback.toString() + ')(result);\n' : ''}  // Bound the actual UTF-8 payload and leave room for envelope/journal fields.
  let resultBytes = 0;
  for (const char of JSON.stringify(${packed ? 'transport' : 'result'}, null, 2)) {
    const cp = char.codePointAt(0);
    resultBytes += cp <= 127 ? 1 : cp <= 2047 ? 2 : cp <= 65535 ? 3 : 4;
    // The host's pretty-printed envelope indents every nested result line.
    if (cp === 10) resultBytes += 2;
  }
  if (resultBytes > 3 * 1024 * 1024) {
    delete result.nodes; delete result.tokens; delete result.images;
    result.status = 'refused'; throw Error('native-source-readback-result-byte-limit');
  }
${packed ? '  return transport;\n' : ''}} catch (error) { ${packed ? "result.status = 'refused'; delete result.nodes; delete result.tokens; delete result.images; " : ''}result.problems = [error && error.message ? error.message : 'native-source-readback-api-failed']; }
return result;
`;
}

/** Verifies the supported authored structure and bindings, not screenshot
 * fidelity, SVG path equivalence, arbitrary responsive behavior or admission.
 * No expectation is taken from a canvas PASS/fingerprint or its metadata. */
export function verifyNativeSourceReadback(
  input: NativeSourceObservationInput,
  receipt: unknown,
) {
  try {
    return verifyReadback(input, receipt);
  } catch {
    return observationReport(["native-source-observation-malformed"]);
  }
}
export function verifyNativePreparedLibraryReadback(input: NativePreparedLibraryObservationInput, receipt: unknown) {
  return verifyNativeInspectionReadback(input, receipt);
}
export function verifyNativeContractReadback(input: NativeContractObservationInput, receipt: unknown) {
  return verifyNativeInspectionReadback(input, receipt);
}
export function verifyNativeInspectionReadback(input: NativeInspectionInput, receipt: unknown) {
  try { return verifyReadback(input, receipt); }
  catch { return observationReport(['native-source-observation-malformed']); }
}

function observationReport(problems: string[]) {
  return {
    version: 1 as const,
    status: problems.length
      ? ("refused" as const)
      : ("supported-structure-observed" as const),
    acceptedContract: null,
    nativeQualification: "unqualified" as const,
    problems: [...new Set(problems)],
    limitations: [
      "native-visual-fidelity-unverified",
      "native-svg-geometry-unverified",
      "native-computed-geometry-unverified",
      "native-resolved-paint-values-unverified",
      "native-automatic-wrapper-reevaluation-unqualified",
      "native-inherited-sample-token-bindings-unqualified",
    ],
  };
}

function verifyReadback(
  input: NativeInspectionInput,
  receipt: unknown,
  exactIds = false,
) {
  const problems: string[] = [];
  const report = () => observationReport(problems);
  try {
    checkInput(input);
  } catch {
    problems.push("native-source-observation-input-invalid");
    return report();
  }
  if (
    !object(receipt) ||
    receipt.version !== 1 ||
    receipt.status !== "native-readback-collected" ||
    receipt.receiptKind !== "independent-native-component-readback" ||
    receipt.operationId !== input.operation.id ||
    receipt.fileKey !== input.operation.fileKey ||
    receipt.planRevision !== input.planRevision ||
    receipt.acceptedContract !== null ||
    receipt.nativeQualification !== "unqualified" ||
    !Array.isArray(receipt.problems) ||
    receipt.problems.length ||
    !Array.isArray(receipt.nodes)
  ) {
    problems.push("native-source-observation-receipt-invalid");
    return report();
  }
  const c = input.creation;
  let rows = receipt.nodes as Record<string, any>[];
  if (
    rows.some(
      (n) =>
        !object(n) ||
        !object(n.values) ||
        !object(n.metadata) ||
        !Array.isArray(n.childIds),
    ) ||
    rows.some(
      (n) => typeof n.id !== "string" || !n.id || typeof n.type !== "string",
    ) ||
    new Set(rows.map((n) => n.id)).size !== rows.length
  ) {
    problems.push("native-source-observation-node-inventory");
    return report();
  }
  // Empty draft mains have exact allocation IDs. Recorded comparison slot
  // descendants use the source workflow's clone-identity bridge; caller content
  // inside a graph draft's nested instance slots resolves by allocation stamp.
  if (!exactIds && isContractDraft(input) && input.graphComponents) {
    const resolved = resolveNativeGraphSlotIdentities(c, rows);
    if (!resolved) {
      problems.push("native-source-observation-node-inventory");
      return report();
    }
    rows = resolved;
  }
  if (!exactIds && !isContractDraft(input)) {
    const anchor = input.allocationAnchor;
    if (
      anchor &&
      verifyReadback({ ...input, allocationAnchor: undefined }, anchor, true)
        .status !== "supported-structure-observed"
    ) {
      problems.push("native-source-observation-allocation-anchor-invalid");
      return report();
    }
    const resolved = resolveNativeSlotIdentities(c, rows, anchor?.nodes);
    if (!resolved) {
      problems.push("native-source-observation-node-inventory");
      return report();
    }
    rows = resolved;
  }
  const bornIds = new Set(c.nodes.map((n: any) => n.id));
  const rowById = new Map(rows.map((n) => [n.id, n]));
  const borrowedIds = new Set<string>();
  if (isContractDraft(input) && input.graphComponents) {
    const descendBorrowed = (row: Record<string, any>) => {
      for (const id of row.childIds) {
        const child = rowById.get(id);
        if (!child || bornIds.has(id) || borrowedIds.has(id)) continue;
        borrowedIds.add(id); descendBorrowed(child);
      }
    };
    for (const born of c.nodes) if (born.type === 'INSTANCE') {
      const row = rowById.get(born.id); if (row) descendBorrowed(row);
    }
  }
  if (c.nodes.some((n: any) => !rowById.has(n.id)) ||
      rows.some(n => !bornIds.has(n.id) && !borrowedIds.has(n.id))) {
    problems.push("native-source-observation-node-inventory");
    return report();
  }
  const nodes = rowById;
  const issue = (code: string, node?: Record<string, any>) =>
    problems.push(`${code}${node ? `:${node.id}` : ""}`);
  if (isContractDraft(input) && input.fixedCrossSizeReadback) {
    for (const id of input.fixedCrossSizeReadback.nodeIds) {
      const node = nodes.get(id), v = node?.values;
      const constraint = (value: unknown) => ['MIN','CENTER','MAX','STRETCH','SCALE'].includes(value as string);
      if (!node || !v || !object(v.constraints) || !constraint(v.constraints.horizontal) || !constraint(v.constraints.vertical) ||
          !(v.targetAspectRatio === null || typeof v.targetAspectRatio === 'number' && Number.isFinite(v.targetAspectRatio) && v.targetAspectRatio > 0) ||
          !['INHERIT','MIN','CENTER','MAX','STRETCH'].includes(v.layoutAlign) ||
          typeof v.layoutGrow !== 'number' || !Number.isFinite(v.layoutGrow) ||
          ['COMPONENT','FRAME'].includes(node.type) && typeof v.strokesIncludedInLayout !== 'boolean')
        issue('native-fixed-cross-size-layout-unavailable', node);
    }
  }
  const meta = (node: Record<string, any>, key: string) => {
    try {
      return JSON.parse(node.metadata[key]);
    } catch {
      issue(`native-source-observation-${key}-unreadable`, node);
      return null;
    }
  };
  const owner = {
    version: 1,
    operationId: input.operation.id,
    sourceContractId: input.projection.contractId,
    sourceContractRevision: input.projection.contractRevision,
    tokenPreparationRevision: input.tokenIdentity.preparationRevision,
    acceptedContract: null,
  };
  for (const n of rows) {
    const born = c.nodes.find((v: any) => v.id === n.id);
    if (born) {
      if (n.type !== born.type || (born.key && n.key !== born.key))
        issue("native-source-observation-node-identity", n);
      if (!same(meta(n, "nativeSourceOperation"), owner))
        issue("native-source-observation-ownership", n);
    }
    if (n.id !== c.pageId && !nodes.get(n.parentId)?.childIds.includes(n.id))
      issue("native-source-observation-parent", n);
    if (
      new Set(n.childIds).size !== n.childIds.length ||
      n.childIds.some((id: string) => nodes.get(id)?.parentId !== n.id)
    )
      issue("native-source-observation-children", n);
  }
  const tokens = receipt.tokens;
  if (
    !object(tokens) ||
    tokens.status !== "readback-collected" ||
    tokens.receiptKind !== "independent-native-readback" ||
    !tokens.receipt ||
    verifyNativeTokenContextReceipt({
      input: input.tokenInput,
      expectedIdentity: input.tokenIdentity,
      receipt: tokens.receipt,
    }).status !== "native-token-context-observed"
  )
    issue("native-source-observation-token-drift");
  if (problems.includes("native-source-observation-token-drift"))
    return report();
  const variableByName = new Map<string, string>(
    (tokens?.receipt?.variables ?? []).map((v: any) => [v.name, v.id]),
  );
  const templateGraph = isContractDraft(input) ? input.templateGraph : undefined;
  let graph: ReturnType<typeof planNativeRootTextTemplateGraph> | undefined;
  if (templateGraph) {
    try {
      const observed = receipt.templateGraph;
      if (!object(observed) || observed.status !== 'readback-collected' || observed.receiptKind !== 'independent-native-readback' ||
          !same(observed.receipt?.source, tokens.receipt)) throw Error('graph-source-drift');
      verifyNativeTemplateGraphReceipt(templateGraph.input, templateGraph.identity, observed.receipt);
      graph = planNativeRootTextTemplateGraph(templateGraph.input);
      for (const variable of observed.receipt.routes) {
        if (variableByName.has(variable.name)) throw Error('graph-name-ambiguous');
        variableByName.set(variable.name, variable.id);
      }
    } catch { issue('native-source-observation-template-graph-drift'); return report(); }
  } else if (receipt.templateGraph !== undefined) { issue('native-source-observation-template-graph-unexpected'); return report(); }
  const mode = {
    [input.tokenIdentity.collection.id]: input.tokenIdentity.modes[0].modeId,
  };
  const affineMatches=(spec:NodeSpec,n:any)=>{
    const a=spec.instanceAffineAllocation;if(!a)return false;
    const v=n.values,owner=nodes.get(n.parentId),m=v.relativeTransform;
    return !!owner && owner.type==='FRAME' && owner.values.layoutMode==='NONE' && owner.childIds.length===1 &&
      numeric(owner.values.width,a.allocation.width)&&numeric(owner.values.height,a.allocation.height)&&
      numeric(v.width,a.localSize.width)&&numeric(v.height,a.localSize.height)&&
      Array.isArray(m)&&m.length===2&&m.every((row:any,i:number)=>Array.isArray(row)&&row.length===3&&row.every((x:any,j:number)=>numeric(x,a.normalizedTransform[i][j])));
  };
  const pathSpecs = new Map<string, NodeSpec>();
  const authoredPathSpecs = new Map<string, NodeSpec | null>();
  const indexPath = (spec: NodeSpec) => {
    if ((spec.shape?.kind==='line' || spec.insetOverlay || spec.nativePathInk || spec.nativePathViewport || spec.shape?.kind==='stroked-path' || spec.instanceAffineAllocation || spec.textColorTarget || spec.textAppearanceTarget || spec.imageTarget) && spec.nativeContractPart)
      pathSpecs.set(canonicalJson(spec.nativeContractPart), spec);
    spec.children?.forEach(indexPath);
  };
  for (const component of isContractDraft(input) ? input.graphComponents ?? [input.component] : [])
    [...component.variants, ...(component.stateVariants ?? [])].forEach(variant => {
      indexPath(variant.spec);
      const indexAuthored = (spec: NodeSpec) => {
        if ((spec.authoredTextAppearance || spec.authoredTextAppearanceTarget) && spec.nativeContractPart) {
          const key = canonicalJson([variant.name, spec.nativeContractPart]);
          const previous = authoredPathSpecs.get(key);
          if (authoredPathSpecs.has(key) && (!previous ||
              !same(previous.authoredTextAppearance,spec.authoredTextAppearance) ||
              !same(previous.authoredTextScalar,spec.authoredTextScalar) ||
              previous.authoredTextAppearanceTarget !== spec.authoredTextAppearanceTarget))
            authoredPathSpecs.set(key,null);
          else authoredPathSpecs.set(key,spec);
        }
        spec.children?.forEach(indexAuthored);
      };
      indexAuthored(variant.spec);
    });
  const authoredSpecForSource = (source: Record<string, any>): NodeSpec | undefined => {
    let owner: Record<string, any> | undefined = source;
    const seen = new Set<string>();
    while (owner && owner.type !== 'COMPONENT') {
      if (seen.has(owner.id)) return undefined;
      seen.add(owner.id); owner = nodes.get(owner.parentId);
    }
    return owner ? authoredPathSpecs.get(canonicalJson([owner.name,meta(source,'nativeContractPart')])) ?? undefined : undefined;
  };
  const target = nodes.get(c.target.id),
    page = nodes.get(c.pageId),
    board = isContractDraft(input) ? undefined : nodes.get(c.comparisonBoardId);
  if (!target || !page || (!isContractDraft(input) && !board)) {
    issue("native-source-observation-roots-missing");
    return report();
  }
  const graphTargets = isContractDraft(input) && input.graphComponents
    ? c.graphTargets : [{ contractId: input.component.contractId, id: c.target.id, key: c.target.key }];
  if (isContractDraft(input) && input.graphComponents &&
      (!Array.isArray(graphTargets) || graphTargets.length !== input.graphComponents.length ||
       !same(graphTargets.map((row: any) => row.contractId), input.graphComponents.map(component => component.contractId)) ||
       graphTargets.at(-1)?.id !== c.target.id))
    issue('native-contract-observation-graph-targets');
  const graphTargetIds = Array.isArray(graphTargets) ? graphTargets.map((row: any) => row.id) : [target.id];
  if (
    page.type !== "PAGE" ||
    !same([...page.childIds].sort(), [...graphTargetIds, ...(board ? [board.id] : [])].sort()) ||
    (board && board.type !== "FRAME") ||
    target.parentId !== page.id ||
    (board && board.parentId !== page.id)
  )
    issue("native-source-observation-page-scope");
  if (
    target.type !== (input.component.isSet ? "COMPONENT_SET" : "COMPONENT") ||
    target.metadata.contractId !==
      `source-native:${input.operation.id}:${input.projection.contractId}` ||
    target.key !== c.target.key ||
    !same(target.definitions, c.propertyDefinitions)
  )
    issue("native-source-observation-component-identity");
  if (isContractDraft(input) && input.graphComponents && Array.isArray(graphTargets)) {
    for (const [index, component] of input.graphComponents.entries()) {
      const identity = graphTargets[index], graphTarget = identity && nodes.get(identity.id);
      if (!graphTarget || graphTarget.metadata.contractId !== component.contractId || graphTarget.key !== identity.key ||
          graphTarget.type !== (component.isSet ? 'COMPONENT_SET' : 'COMPONENT'))
        issue('native-contract-observation-graph-component', graphTarget);
    }
  }
  const verifyComponent = (component: ComponentData, target: Record<string, any>, created: Record<string, any>) => {
    const library = isContractDraft(input) && input.graphVerification === 2;
    const variants = nativeGraphVariants(component, library ? 2 : 1);
    const defs = target.definitions ?? {},
      boolKeys = new Map<string,string>(),
      slotKeys = new Map<string, string>(),
      textKeys = new Map<string, string>();
    for (const [key, def] of Object.entries(defs) as Array<[string, any]>) {
      if (library && def.type === 'BOOLEAN') {
        const display = key.slice(0,key.lastIndexOf('#'));
        if (!key.includes('#') || boolKeys.has(display)) issue('native-library-observation-boolean-property-ambiguous');
        boolKeys.set(display,key);
      }
      if (def.type === "SLOT") {
        const display = key.slice(0, key.lastIndexOf("#"));
        if (!key.includes("#") || slotKeys.has(display))
          issue("native-source-observation-slot-property-ambiguous");
        slotKeys.set(display, key);
      }
      if (isContractDraft(input) && def.type === 'TEXT') {
        const display = key.slice(0, key.lastIndexOf('#'));
        if (!key.includes('#') || textKeys.has(display))
          issue('native-contract-observation-text-property-ambiguous');
        textKeys.set(display, key);
      }
    }
    const axes = component.unsetVariantAxes?.axes ?? [];
    const draftAxes = new Map<string, Set<string>>();
    if (isContractDraft(input) && component.isSet) for (const variant of variants)
      for (const segment of variant.name.split(', ')) {
        const i = segment.indexOf('='), property = segment.slice(0, i), value = segment.slice(i + 1);
        if (i <= 0) throw Error('native-contract-observation-variant-name');
        if (!draftAxes.has(property)) draftAxes.set(property, new Set());
        draftAxes.get(property)!.add(value);
      }
    const expectedSlots = new Set<string>();
    const expectedTexts = new Map<string, string>(library ? component.textProps.map(p=>[p.property,p.default]) : []);
    const expectedBools = new Map<string, boolean>(library ? component.boolProps.map(p=>[p.property,p.default]) : []);
    const slotSpecs = new Map<string,NodeSpec>();
    const collect = (s: NodeSpec) => {
      if (s.type === "slot" && s.callerSlotProperty === undefined) {
        expectedSlots.add(s.slotProperty!); slotSpecs.set(s.slotProperty!,s);
        if (library && s.slotOptional) expectedBools.set('Show '+s.slotProperty,false);
      }
      if (isContractDraft(input) && s.contentProp !== undefined) {
        if (s.type !== 'text' || typeof s.characters !== 'string' ||
            (expectedTexts.has(s.contentProp) && expectedTexts.get(s.contentProp) !== s.characters))
          throw Error('native-contract-observation-text-mapping');
        expectedTexts.set(s.contentProp, s.characters!);
      }
      (s.children ?? []).forEach(collect);
    };
    variants.forEach((v) => collect(v.spec));
    if (
      !same([...slotKeys.keys()].sort(), [...expectedSlots].sort()) ||
      !same([...textKeys.keys()].sort(), [...expectedTexts.keys()].sort()) ||
      !same([...boolKeys.keys()].sort(), [...expectedBools.keys()].sort()) ||
      Object.keys(defs).length !== expectedSlots.size + expectedTexts.size + expectedBools.size + (isContractDraft(input) ? draftAxes.size : axes.length)
    )
      issue("native-source-observation-property-inventory");
    if (library) {
      for (const [name,value] of expectedBools) if (defs[boolKeys.get(name)!]?.defaultValue !== value)
        issue('native-library-observation-boolean-default');
      if (component.statePreviewAxis ? !same(meta(target,'statePreviewAxis'),component.statePreviewAxis) : !!target.metadata.statePreviewAxis)
        issue('native-library-observation-state-axis');
      for (const [name,spec] of slotSpecs) {
        const def = defs[slotKeys.get(name)!];
        const preferred = (spec.slotAccepts ?? []).map(ref => {
          const identity = c.graphTargets.find((row:any)=>row.contractId === ref.contractId);
          return identity && {type:identity.type,key:identity.key};
        });
        if (!def || !same(def.preferredValues ?? [],preferred) || (def.description ?? '') !== (spec.slotDescription ?? ''))
          issue('native-library-observation-slot-definition');
      }
    }
    for (const axis of axes) {
      const def = defs[axis.property];
      if (
        !def ||
        def.type !== "VARIANT" ||
        def.defaultValue !== axis.unsetValue ||
        !same(
          [...(def.variantOptions ?? [])].sort(),
          [axis.unsetValue, ...axis.values.map((v) => v.label)].sort(),
        )
      )
        issue("native-source-observation-variant-axis");
    }
    if (isContractDraft(input)) {
      for (const [property, defaultValue] of expectedTexts) {
        const key = textKeys.get(property), def = key && defs[key];
        if (!def || def.type !== 'TEXT' || def.defaultValue !== defaultValue)
          issue('native-contract-observation-text-property');
      }
      for (const [property, values] of draftAxes) {
        const def = defs[property];
        if (!def || def.type !== 'VARIANT' || def.defaultValue !== values.values().next().value ||
            !same([...(def.variantOptions ?? [])].sort(), [...values].sort()))
          issue('native-contract-observation-variant-axis');
      }
      for (const key of ['rootSlot', 'codeValueAxes', 'unsetVariantAxes', 'semantics', 'propNames'] as const) {
        if (component[key] ? !same(meta(target, key), component[key]) : !!target.metadata[key])
          issue(`native-contract-observation-${key}`);
      }
    }
    const checked = new Set<string>();
    const paint = (actual: any, expected: any) =>
      object(actual) &&
      object(expected) &&
      ["r", "g", "b"].every((k) => numeric(actual[k], expected[k]));
    // Replacement expectations come from the saved scalar compilation, never
    // from an arbitrary authored range or the inherited main's mixed values.
    const authoredScalarMatches = (sourceSpec: NodeSpec, child: Record<string, any>, source: Record<string, any>, scalarMode: Record<string, string>): boolean => {
      const scalar = sourceSpec.authoredTextScalar, actual = child.values;
      if (!scalar || scalar.textStyle || actual.textStyleId !== '' || typeof actual.characters !== 'string' ||
          scalar.nativeWeightBinding && !scalar.fontWeightVar) return false;
      const fonts=[...new Set([scalar.fontStyle,scalar.fontStyle.split(' ').join('')])].map(style=>({family:scalar.fontFamily??'Inter',style,
        ...(scalar.fontVariationSettings?{variationSettings:scalar.fontVariationSettings}:{})}));
      const fontMatches=(font:unknown)=>fonts.some(expected=>nativeFontNameExact(font,expected));
      if(fonts.some(expected=>nativeFontDefaultProfileRequired(actual.fontName,expected))) {
        issue('native-authored-font-default-profile-unverified',child);return false;
      }
      const variables = [...tokens.receipt.variables, ...(graph ? receipt.templateGraph!.receipt.routes : [])];
      let expectedSize=scalar.fontSize;
      let expectedWeight=scalar.nativeWeightBinding&&scalar.fontWeightVar?nativeBoundNumber(scalar.fontWeightVar,variables,scalarMode):nativeScalarFaceWeight(scalar.fontStyle);
      const lineHeight:{unit:'AUTO'}|{unit:'PIXELS'|'PERCENT';value:number} = sourceSpec.slotTextTemplate&&scalar.lineHeightVar?{unit:'PIXELS',value:nativeBoundNumber(scalar.lineHeightVar,variables,scalarMode)??NaN}:typeof scalar.lineHeight === 'number' ? {unit:'PIXELS',value:scalar.lineHeight} : scalar.lineHeight ?? {unit:'AUTO'};
      if(scalar.fontSizeVar){const size=nativeBoundNumber(scalar.fontSizeVar,variables,scalarMode);if(size===undefined)return false;expectedSize=size;}
      if(expectedWeight===undefined||!Number.isFinite(expectedWeight))return false;
      if (!fontMatches(actual.fontName) ||
          !numeric(actual.fontSize,expectedSize) || !numeric(actual.fontWeight,expectedWeight) ||
          actual.lineHeight?.unit !== lineHeight.unit ||
          ('value' in lineHeight && !numeric(actual.lineHeight?.value,lineHeight.value)) ||
          actual.letterSpacing?.unit !== 'PIXELS' || !numeric(actual.letterSpacing?.value,scalar.letterSpacing) ||
          actual.textCase !== scalar.textCase || actual.textDecoration !== scalar.textDecoration ||
          child.metadata.fontWeightVar !== (scalar.fontWeightVar ?? '') || child.metadata.lineHeightVar !== (scalar.lineHeightVar ?? '')) return false;
      const expectedBindings = {...source.values.boundVariables};
      for (const field of ['fontSize','fontWeight','lineHeight','fills']) delete expectedBindings[field];
      const actualBindings = {...actual.boundVariables};
      for (const field of ['fontSize','fontWeight','lineHeight']) {
        if (Array.isArray(actualBindings[field]) && actualBindings[field].length === 1) actualBindings[field] = actualBindings[field][0];
      }
      const typography = {
        ...(scalar.fontSizeVar ? {fontSize:scalar.fontSizeVar} : {}),
        ...(scalar.nativeWeightBinding && scalar.fontWeightVar ? {fontWeight:scalar.fontWeightVar} : {}),
        ...(sourceSpec.slotTextTemplate && scalar.lineHeightVar ? {lineHeight:scalar.lineHeightVar} : {}),
      };
      for (const [field,name] of Object.entries(typography)) {
        const value = nativeBoundNumber(name,variables,scalarMode), id = variableByName.get(name);
        if (!id || value === undefined || !numeric(field === 'lineHeight' ? actual.lineHeight?.value : actual[field],value)) return false;
        expectedBindings[field] = {type:'VARIABLE_ALIAS',id};
      }
      const literalFill = scalar.textFillLit ?? {r:0,g:0,b:0,a:1};
      const fillMatches = (fills: any): boolean => {
        if (scalar.textFill) {
          const bound = nativeBoundPaintColor(scalar.textFill,variables,scalarMode,input.tokenIdentity.collection.id);
          return nativePaintStackMatches({type:'text',name:'authored scalar',fill:scalar.textFill},fills,bound,actualBindings.fills);
        }
        return Array.isArray(fills) && fills.length === 1 && fills[0].type === 'SOLID' &&
          fills[0].visible !== false && (fills[0].blendMode ?? 'NORMAL') === 'NORMAL' &&
          paint(fills[0].color,literalFill) && numeric(fills[0].opacity ?? 1,literalFill.a ?? 1) &&
          Object.keys(fills[0].boundVariables ?? {}).length === 0;
      };
      if (!fillMatches(actual.fills) || !scalar.textFill &&
          actualBindings.fills !== undefined && (!Array.isArray(actualBindings.fills) || actualBindings.fills.length !== 0)) return false;
      // Uniform aggregate values alone cannot prove every inherited range was
      // reset. Require exact, contiguous readback coverage of the current text.
      const segments = actual.textAppearanceRuns;
      if (!Array.isArray(segments) || typeof actual.fontWeight !== 'number') return false;
      let end = 0;
      for (const segment of segments) {
        if (segment.start !== end || !Number.isInteger(segment.end) || segment.end <= segment.start ||
            segment.end > actual.characters.length || segment.characters !== actual.characters.slice(segment.start,segment.end) ||
            !fontMatches(segment.fontName) ||
            !numeric(segment.fontSize,expectedSize) || !numeric(segment.fontWeight,expectedWeight) ||
            segment.lineHeight?.unit !== lineHeight.unit || 'value' in lineHeight && !numeric(segment.lineHeight?.value,lineHeight.value) ||
            segment.letterSpacing?.unit !== 'PIXELS' || !numeric(segment.letterSpacing?.value,scalar.letterSpacing) ||
            segment.textCase !== scalar.textCase || segment.textDecoration !== scalar.textDecoration || !fillMatches(segment.fills)) return false;
        end = segment.end;
      }
      if (end !== actual.characters.length || actual.characters.length === 0 && segments.length !== 0) return false;
      delete actualBindings.fills;
      return same(actualBindings,expectedBindings);
    };
    const visit = (
      spec: NodeSpec,
      n: Record<string, any> | undefined,
      sourceCase?: NativeSourceCandidateProjection["cases"][number],
      sample?: any,
      root = false,
    ) => {
      if (!n || checked.has(n.id)) {
        issue("native-source-observation-node-pairing", n);
        return;
      }
      checked.add(n.id);
      if (spec.mask && (n.values.isMask !== true || n.values.maskType !== spec.mask.type) ||
          !spec.mask && n.values.isMask === true) issue('native-mask-observation-changed', n);
      if(spec.shape?.arc?.cap){
        const expected=spec.shape.arc,actual=n.values.arcData as Record<string,unknown>|undefined;
        if(n.values.strokeCap!==expected.cap || n.values.strokeAlign!==(expected.align ?? 'INSIDE') || !actual ||
          !(['startingAngle','endingAngle','innerRadius'] as const).every((key,i)=>{
            const value=[expected.start,expected.end,expected.innerRadius][i];
            return actual[key]===value || actual[key]===Math.fround(value);
          }))issue('native-ellipse-arc-observation-changed',n);
      }
      if (spec.insetRingStroke && (spec.strokesIncludedInLayout !== false || n.values.strokesIncludedInLayout !== false))
        issue('native-inset-ring-observation-layout-policy',n);
      const v = n.values,
        expectedType =
          root && sourceCase
            ? "INSTANCE"
            : (
                {
                  root: "COMPONENT",
                  frame: "FRAME",
                  slot: "SLOT",
                  text: "TEXT",
                  svg: "FRAME",
                  instance: "INSTANCE",
                } as Record<string, string>
              )[spec.type] ?? (spec.type === 'shape' ? spec.shape?.kind === 'line' ? 'LINE' : spec.shape?.kind === 'rect' ? 'RECTANGLE' : spec.shape?.kind === 'ellipse' ? 'ELLIPSE' : spec.nativePathInk || spec.nativeMaskPath || spec.shape?.kind === 'stroked-path' ? 'VECTOR' : undefined : undefined);
      if((n.metadata.imageOverride??'')!==(spec.imageTarget??''))issue('native-image-observation-marker',n);
      if((n.metadata.textAppearanceOverride??'')!==(spec.textAppearanceTarget??''))issue('native-text-appearance-observation-marker',n);
      if((n.metadata.authoredTextAppearance??'')!==(spec.authoredTextAppearanceTarget??''))issue('native-authored-text-appearance-observation-marker',n);
      if((n.metadata.authoredTextInstance??'')!==(spec.authoredTextInstanceTarget??''))issue('native-authored-text-instance-observation-marker',n);
      if((n.metadata.textColorOverride??'')!==(spec.textColorTarget??''))issue('native-text-color-observation-marker',n);
      if (!expectedType || n.type !== expectedType)
        issue("native-source-observation-node-type", n);
      let consumingMode = mode;
      const template = isContractDraft(input) ? input.projection.rootTextTemplate : undefined;
      if (graph && templateGraph && spec.nativeContractPart) {
        const selected = nativeRootTextTemplateGraphSelection(graph, spec.nativeContractPart.variant);
        consumingMode = Object.fromEntries([[input.tokenIdentity.collection.id, input.tokenIdentity.modes[0].modeId],
          ...templateGraph.identity.selectors.map(s => [s.id, s.modes[Number(selected[s.selector])].modeId])]);
        const inherits = spec.rootSlotContent || spec.slotTextTemplate;
        if (!same(v.explicitVariableModes, inherits ? {} : consumingMode) || !same(v.resolvedVariableModes, consumingMode))
          issue('native-source-observation-template-mode', n);
      } else if (template && spec.nativeContractPart) {
        const selected = template.variants.find(row => row.name === spec.nativeContractPart!.variant);
        const native = input.tokenIdentity.modes.find(row => row.nativeSelection?.planRevision === template.revision && row.nativeSelection?.modeKey === selected?.modeKey);
        consumingMode = native ? { [input.tokenIdentity.collection.id]: native.modeId } : {};
        const inherits = spec.rootSlotContent || spec.slotTextTemplate;
        if (!native || !same(v.explicitVariableModes, inherits ? {} : consumingMode) || !same(v.resolvedVariableModes, consumingMode))
          issue('native-source-observation-template-mode', n);
      } else if (!same(v.explicitVariableModes, mode))
        issue("native-source-observation-mode", n);
      if (!sample && !same(meta(n, isContractDraft(input) ? 'nativeContractPart' : 'nativeSourcePart'),
        isContractDraft(input) ? spec.nativeContractPart : spec.nativeSourcePart))
        issue("native-source-observation-source-part", n);
      if (isContractDraft(input)) {
        const references = spec.type === 'slot' ? { slotContentId: slotKeys.get(spec.slotProperty!) }
          : spec.contentProp !== undefined ? { characters: textKeys.get(spec.contentProp) } : {};
        if (library) {
          if (spec.visibleProp) Object.assign(references,{visible:boolKeys.get(spec.visibleProp)});
          else if (spec.slotOptional) Object.assign(references,{visible:boolKeys.get('Show '+spec.slotProperty)});
        }
        if (!same(v.componentPropertyReferences ?? {}, references))
          issue('native-contract-observation-property-references', n);
        if ((n.metadata.callerContentProperty ?? '') !== (spec.callerContentProp ?? ''))
          issue('native-contract-observation-caller-content-property', n);
      }
      let capturedGeometry: ReturnType<typeof resolveNativeAbsoluteGeometry> | undefined;
      if (spec.capturedAbsoluteGeometry) {
        const parent = nodes.get(n.parentId);
        try {
          const expected = capturedGeometry = resolveNativeAbsoluteGeometry(spec.capturedAbsoluteGeometry,
            {width:parent?.values.width,height:parent?.values.height},spec.shape?.rotation ?? 0);
          if (!['x','y','width','height'].every(key=>numeric(v[key],expected[key as 'x'|'y'|'width'|'height'])) ||
              !same(v.constraints,expected.constraints) ||
              spec.shape && !numeric(v.rotation,-(spec.shape.rotation ?? 0)) ||
              parent?.values.layoutMode !== 'NONE' && v.layoutPositioning !== 'ABSOLUTE')
            issue('native-contract-observation-captured-absolute-geometry',n);
        } catch { issue('native-contract-observation-captured-absolute-basis',n); }
      }
      if(spec.insetOverlay&&(!library||!insetOverlayMatches(spec,n.values,nodes.get(n.parentId)?.values)))
        issue('native-inset-overlay-observation-geometry',n);
      // A fixed width can match today's pixels while losing responsive Fill.
      // Check the compiled request before instances take their separate path.
      if (library && spec.fillW &&
          !(spec.type === 'text' && !spec.textTruncation && spec.fillText !== true) &&
          v.layoutSizingHorizontal !== 'FILL')
        issue('native-library-observation-fill-width', n);
      if (library && spec.fillH && v.layoutSizingVertical !== 'FILL')
        issue('native-library-observation-fill-height', n);
      if (isContractDraft(input) && spec.type === 'instance') {
        // A declared left/top offset is an observable contract fact even when
        // the instance's inherited layout remains outside geometry qualification.
        // Check it before the instance branch returns past ordinary leaf checks.
        if (!spec.instanceAffineAllocation && !spec.capturedAbsoluteGeometry && spec.absolute && (v.layoutPositioning !== 'ABSOLUTE' ||
            (spec.absolute.h === 'MIN' && !numeric(v.x, spec.absolute.left ?? 0)) ||
            (spec.absolute.v === 'MIN' && !numeric(v.y, spec.absolute.top ?? 0))))
          issue('native-contract-observation-instance-position', n);
        if(spec.instanceAffineAllocation && !affineMatches(spec,n)) issue('native-instance-affine-observation-geometry',n);
        const graphComponents = input.graphComponents ?? [];
        const dep = graphComponents.find(component => component.contractId === spec.depContractId);
        const identity = Array.isArray(c.graphTargets) && c.graphTargets.find((row: any) => row.contractId === spec.depContractId);
        const depTarget = identity && nodes.get(identity.id);
        const mainMatches = depTarget && (depTarget.type === 'COMPONENT'
          ? n.mainId === depTarget.id : depTarget.type === 'COMPONENT_SET' && depTarget.childIds.includes(n.mainId));
        if (!dep || !depTarget || !mainMatches) issue('native-contract-observation-instance-main', n);
        for (const [property, value] of Object.entries(spec.depProps ?? {})) {
          const matches = Object.entries(n.componentProperties ?? {}).filter(([key]) => key === property || key.startsWith(property + '#'));
          if (matches.length !== 1 || !same((matches[0][1] as any)?.value, value))
            issue('native-contract-observation-instance-property', n);
        }
        if (library && depTarget) {
          const main = nodes.get(n.mainId);
          if(spec.instanceRootFill) {
            const name=spec.instanceRootFill.varName;
            const bound=nativeBoundPaintColor(name,tokens.receipt.variables,consumingMode,input.tokenIdentity.collection.id);
            if(!nativePaintStackMatches({type:'frame',name:'instance root fill',fill:name},v.fills,bound,v.boundVariables?.fills))
              issue('native-instance-root-fill-observation',n);
          } else if(!same(v.fills,main?.values.fills)||!same(v.boundVariables?.fills,main?.values.boundVariables?.fills))
            issue('native-instance-root-fill-inherited',n);
          if (spec.instanceSize) {
            const alias = {type:'VARIABLE_ALIAS', id:variableByName.get(spec.instanceSize.varName)};
            if (!alias.id || !numeric(v.width,spec.instanceSize.px) || !numeric(v.height,spec.instanceSize.px) ||
                v.layoutMode !== 'NONE' || !same(v.boundVariables,{...main?.values.boundVariables,width:alias,height:alias}))
              issue('native-filled-path-observation-instance-size',n);
          }
          if (!same(n.values.reactions ?? [],main?.values.reactions ?? [])) issue('native-library-observation-instance-reactions',n);
          if (n.values.visible !== (spec.visibleProp ? spec.visibleDefault === true : true))
            issue('native-library-observation-instance-visibility',n);
          const definitions = depTarget.definitions ?? {}, properties = n.componentProperties ?? {};
          if (!same(Object.keys(properties).filter(key=>properties[key].type !== 'SLOT').sort(), Object.keys(definitions).filter(key=>definitions[key].type !== 'SLOT').sort()) ||
              Object.keys(properties).some(key=>properties[key].type === 'SLOT' &&
                (definitions[key]?.type !== 'SLOT' || properties[key].value !== undefined ||
                 !same(properties[key].preferredValues ?? [],definitions[key].preferredValues ?? []))))
            issue('native-library-observation-instance-property-inventory',n);
          for (const [key,definition] of Object.entries(definitions) as Array<[string,any]>) {
            if (definition.type === 'SLOT') continue;
            const display = key.includes('#') ? key.slice(0,key.lastIndexOf('#')) : key;
            const expected = spec.depProps && Object.hasOwn(spec.depProps,display) ? spec.depProps[display] : definition.defaultValue;
            if (properties[key]?.type !== definition.type || !same(properties[key]?.value,expected) ||
                Object.keys(properties[key]?.boundVariables ?? {}).length ||
                (definition.type === 'VARIANT' && main?.variantProperties?.[key] !== expected))
              issue('native-library-observation-instance-property-default',n);
          }
        }
        const imageMatches=new Map<string,number>();
        const textColorMatches=new Map<string,number>();
        const textAppearanceMatches=new Map<string,number>();
        const nestedAuthoredAuthority = new Map<string,{appearance:boolean;scalar:boolean}>();
        if (library && spec.instanceAuthoredTextAppearance) {
          const seenOwners = new Set<string>();
          // Saved graph NodeSpecs authenticate each nested boundary. Retained
          // writer recipe JSON grants no independent observation authority.
          const verifyAuthoredOwner = (owner: Record<string, any>, ownerSpec: NodeSpec, includeOwnText: boolean) => {
            if (seenOwners.has(owner.id)) { issue('native-authored-text-instance-observation-cycle',owner); return; }
            seenOwners.add(owner.id);
            const dependency = graphComponents.find(component=>component.contractId===ownerSpec.depContractId);
            const ownerIdentity = Array.isArray(c.graphTargets) && c.graphTargets.find((row:any)=>row.contractId===ownerSpec.depContractId);
            const ownerTarget = ownerIdentity && nodes.get(ownerIdentity.id), main = nodes.get(owner.mainId);
            if (!dependency || !ownerTarget || !main || owner.type !== 'INSTANCE' ||
                !(ownerTarget.type === 'COMPONENT' ? main.id === ownerTarget.id : ownerTarget.type === 'COMPONENT_SET' && ownerTarget.childIds.includes(main.id))) {
              issue('native-authored-text-instance-observation-main',owner); return;
            }
            const selected = nativeGraphVariants(dependency,2).filter(variant=>!dependency.isSet || variant.name===main.name);
            if (selected.length !== 1) { issue('native-authored-text-instance-observation-variant',owner); return; }
            const textSpecs: NodeSpec[] = [], instanceSpecs: NodeSpec[] = [];
            const collect = (sourceSpec: NodeSpec) => {
              if (sourceSpec.type === 'instance') {
                if (sourceSpec.instanceAuthoredTextAppearance) instanceSpecs.push(sourceSpec);
                return;
              }
              if (sourceSpec.type === 'text' && (sourceSpec.authoredTextAppearance || sourceSpec.textAppearanceTarget)) textSpecs.push(sourceSpec);
              for (const item of sourceSpec.slotDefault ?? []) if (item.instanceAuthoredTextAppearance)
                instanceSpecs.push({type:'instance',name:item.dep,dep:item.dep,depContractId:item.depContractId ?? item.contractId,
                  depProps:item.props,nativeContractPart:item.nativeContractPart,instanceAuthoredTextAppearance:item.instanceAuthoredTextAppearance,
                  instanceAuthoredTextRecipes:item.instanceAuthoredTextRecipes,instanceTextAppearances:item.instanceTextAppearances,
                  authoredTextInstanceTarget:item.authoredTextInstanceTarget});
              sourceSpec.children?.forEach(collect);
            };
            collect(selected[0].spec);
            const ownedNodes = (root: Record<string, any>, key: string, target: string): Record<string, any>[] => {
              const found: Record<string,any>[] = [], walked = new Set<string>();
              const walk = (row: Record<string, any>) => {
                if (walked.has(row.id)) { issue('native-authored-text-instance-observation-tree',row); return; }
                walked.add(row.id);
                if (row.metadata[key] === target) found.push(row);
                if (row.type === 'INSTANCE') return;
                for (const id of row.childIds) { const child=nodes.get(id); if(child)walk(child); }
              };
              for (const id of root.childIds) { const child=nodes.get(id); if(child)walk(child); }
              return found;
            };
            const explicitMatches = new Map<string,number>();
            if (includeOwnText) for (const textSpec of textSpecs) {
              const explicitKey=textSpec.textAppearanceTarget, appearance=explicitKey?ownerSpec.instanceTextAppearances?.[explicitKey]:undefined;
              const key=textSpec.authoredTextAppearanceTarget ?? explicitKey;
              if (!key) { issue('native-authored-text-instance-observation-text-authority',owner); continue; }
              const marker=textSpec.authoredTextAppearanceTarget?'authoredTextAppearance':'textAppearanceOverride';
              const actuals=ownedNodes(owner,marker,key), sources=ownedNodes(main,marker,key);
              if(actuals.length!==1||sources.length!==1||actuals[0].type!=='TEXT'||sources[0].type!=='TEXT') {
                issue('native-authored-text-instance-observation-text-target',owner); continue;
              }
              const actual=actuals[0], source=sources[0];
              if(!same(meta(actual,'nativeContractPart'),textSpec.nativeContractPart)||
                  !same(meta(source,'nativeContractPart'),textSpec.nativeContractPart)||
                  (actual.metadata.authoredTextAppearance??'')!==(textSpec.authoredTextAppearanceTarget??'')||
                  (actual.metadata.textAppearanceOverride??'')!==(explicitKey??''))
                issue('native-authored-text-instance-observation-text-authority',actual);
              let rangeAuthority=false,scalarAuthority=false;
              if(appearance){
                explicitMatches.set(explicitKey!,1+(explicitMatches.get(explicitKey!)??0));
                rangeAuthority=nativeTextAppearanceMatches(appearance,actual.values.characters,actual.values.textAppearanceRuns);
                if(!rangeAuthority){issue('native-text-appearance-observation-ranges',actual);if(nativeTextAppearanceDefaultProfileRequired(appearance,actual.values.textAppearanceRuns))issue('native-authored-font-default-profile-unverified',actual);}
              } else if(textSpec.authoredTextAppearance){
                if(actual.values.characters===textSpec.authoredTextAppearance.characters){
                  rangeAuthority=nativeTextAppearanceMatches(textSpec.authoredTextAppearance,actual.values.characters,actual.values.textAppearanceRuns,true);
                  if(!rangeAuthority){issue('native-authored-text-appearance-observation-ranges',actual);if(nativeTextAppearanceDefaultProfileRequired(textSpec.authoredTextAppearance,actual.values.textAppearanceRuns,true))issue('native-authored-font-default-profile-unverified',actual);}
                  if(!same(actual.values.textStyleId,source.values.textStyleId))issue('native-authored-text-appearance-observation-style',actual);
                } else if(textSpec.authoredTextScalar?.textStyle)issue('native-authored-text-scalar-style-unverified',actual);
                else {
                  scalarAuthority=authoredScalarMatches(textSpec,actual,source,consumingMode);
                  if(!scalarAuthority)issue('native-authored-text-scalar-observation',actual);
                }
              }
              if(rangeAuthority||scalarAuthority)nestedAuthoredAuthority.set(actual.id,{appearance:true,scalar:scalarAuthority});
            }
            if(includeOwnText)for(const key of Object.keys(ownerSpec.instanceTextAppearances??{}))
              if(explicitMatches.get(key)!==1)issue('native-text-appearance-observation-target',owner);
            for(const instanceSpec of instanceSpecs){
              const key=instanceSpec.authoredTextInstanceTarget;
              if(!key){issue('native-authored-text-instance-observation-authority',owner);continue;}
              const actuals=ownedNodes(owner,'authoredTextInstance',key),sources=ownedNodes(main,'authoredTextInstance',key);
              if(actuals.length!==1||sources.length!==1||actuals[0].type!=='INSTANCE'||sources[0].type!=='INSTANCE'||
                  !same(meta(actuals[0],'nativeContractPart'),instanceSpec.nativeContractPart)||
                  !same(meta(sources[0],'nativeContractPart'),instanceSpec.nativeContractPart)) {
                issue('native-authored-text-instance-observation-target',owner);continue;
              }
              verifyAuthoredOwner(actuals[0],instanceSpec,true);
            }
          };
          verifyAuthoredOwner(n,spec,false);
        }
        const descendants: Record<string, any>[] = [];
        const inheritedSeen = new Set<string>([n.id]);
        const descend = (row: Record<string, any>, main: Record<string, any> | undefined, inheritedProperties = n.componentProperties ?? {}, textOwner=true) => {
          const properties = row.type === 'INSTANCE' ? row.componentProperties ?? {} : inheritedProperties;
          if (!main || (row.type !== 'SLOT' && row.childIds.length !== main.childIds.length))
            issue('native-contract-observation-instance-tree', row);
          for (const [index,id] of row.childIds.entries()) { const child = nodes.get(id); if (child) {
            if (inheritedSeen.has(id)) { issue('native-contract-observation-instance-tree', child); continue; }
            inheritedSeen.add(id);
            descendants.push(child);
            // Main-owned wrappers also carry part metadata. Follow their
            // inherited layers; caller allocations are checked by visit below.
            if (borrowedIds.has(child.id)) {
              const source = main && nodes.get(main.childIds[index]);
              const allocation = source?.metadata.nativeSourceAllocation;
              if (!source || child.type !== source.type ||
                  typeof allocation !== 'string' || !bornIds.has(allocation) ||
                  nodes.get(allocation)?.type !== source.type ||
                  (bornIds.has(source.id) && allocation !== source.id) ||
                  child.metadata.nativeSourceAllocation !== allocation)
                issue('native-contract-observation-instance-tree', child);
              if (library && source) {
                const nestedAuthority=nestedAuthoredAuthority.get(child.id);
                if((child.metadata.authoredTextInstance??'')!==(source.metadata.authoredTextInstance??''))
                  issue('native-authored-text-instance-observation-marker',child);
                const pathSpec = pathSpecs.get(canonicalJson(meta(source, 'nativeContractPart')));
                const imageKey=pathSpec?.imageTarget;
                const imageOverride=textOwner&&imageKey?spec.instanceImages?.[imageKey]:undefined;
                if((child.metadata.imageOverride??'')!==(imageKey??''))issue('native-image-observation-marker',child);
                if(imageOverride){
                  imageMatches.set(imageKey!,1+(imageMatches.get(imageKey!)??0));
                  const paints=child.values.fills,sourcePaints=source.values.fills;
                  const images=Array.isArray(paints)?paints.filter((p:any)=>p.type==='IMAGE'):[];
                  if(!['FRAME','RECTANGLE','ELLIPSE'].includes(child.type)||images.length!==1||
                    !nativeImageOverrideMatches(imageOverride,images[0],child.imageAssets?.[images[0]?.imageHash])||
                    !Array.isArray(sourcePaints)||sourcePaints.filter((p:any)=>p.type==='IMAGE').length!==1||
                    !same(paints.map((p:any)=>p.type==='IMAGE'?{type:'IMAGE'}:p),sourcePaints.map((p:any)=>p.type==='IMAGE'?{type:'IMAGE'}:p))||
                    !same(child.values.boundVariables,source.values.boundVariables))issue('native-image-observation-paint',child);
                }
                const appearanceKey=pathSpec?.textAppearanceTarget;
                const appearance=textOwner&&appearanceKey?spec.instanceTextAppearances?.[appearanceKey]:undefined;
                if((child.metadata.textAppearanceOverride??'')!==(appearanceKey??''))issue('native-text-appearance-observation-marker',child);
                if(appearance){
                  textAppearanceMatches.set(appearanceKey!,1+(textAppearanceMatches.get(appearanceKey!)??0));
                  if(child.type!=='TEXT'||!nativeTextAppearanceMatches(appearance,child.values.characters,child.values.textAppearanceRuns)){issue('native-text-appearance-observation-ranges',child);if(nativeTextAppearanceDefaultProfileRequired(appearance,child.values.textAppearanceRuns))issue('native-authored-font-default-profile-unverified',child);}
                }
                const authoredSourceSpec = textOwner ? authoredSpecForSource(source) : undefined;
                const authoredKey = authoredSourceSpec?.authoredTextAppearanceTarget;
                if ((child.metadata.authoredTextAppearance ?? '') !== (source.metadata.authoredTextAppearance ?? ''))
                  issue('native-authored-text-appearance-observation-marker',child);
                let authoredOwnsAppearance = false, authoredScalarReplacement = false;
                if (textOwner && (authoredSourceSpec?.authoredTextAppearance || source.metadata.authoredTextAppearance)) {
                  if (!spec.instanceAuthoredTextAppearance || !authoredSourceSpec?.authoredTextAppearance || !authoredKey ||
                      source.metadata.authoredTextAppearance !== authoredKey)
                    issue('native-authored-text-appearance-observation-authority',child);
                  else if (!appearance) {
                    if (child.type !== 'TEXT') issue('native-authored-text-appearance-observation-target',child);
                    else if (child.values.characters === authoredSourceSpec.authoredTextAppearance.characters) {
                      authoredOwnsAppearance = nativeTextAppearanceMatches(authoredSourceSpec.authoredTextAppearance,child.values.characters,child.values.textAppearanceRuns,true);
                      if (!authoredOwnsAppearance){issue('native-authored-text-appearance-observation-ranges',child);if(nativeTextAppearanceDefaultProfileRequired(authoredSourceSpec.authoredTextAppearance,child.values.textAppearanceRuns,true))issue('native-authored-font-default-profile-unverified',child);}
                      if (!same(child.values.textStyleId,source.values.textStyleId)) issue('native-authored-text-appearance-observation-style',child);
                    } else if (authoredSourceSpec.authoredTextScalar?.textStyle) {
                      // The receipt has no authenticated text-style name/ID
                      // inventory. Writer-local style lookup is not readback proof.
                      issue('native-authored-text-scalar-style-unverified',child);
                    } else {
                      authoredScalarReplacement = authoredScalarMatches(authoredSourceSpec,child,source,consumingMode);
                      authoredOwnsAppearance = authoredScalarReplacement;
                      if (!authoredScalarReplacement) issue('native-authored-text-scalar-observation',child);
                    }
                  }
                }
                const textKey=pathSpec?.textColorTarget;
                const textColor=textOwner&&textKey?spec.instanceTextColors?.[textKey]:undefined;
                if((child.metadata.textColorOverride??'')!==(textKey??''))issue('native-text-color-observation-marker',child);
                if(textColor!==undefined){
                  textColorMatches.set(textKey!,1+(textColorMatches.get(textKey!)??0));
                  const hex=textColor.slice(1),expected={r:parseInt(hex.slice(0,2),16)/255,g:parseInt(hex.slice(2,4),16)/255,b:parseInt(hex.slice(4,6),16)/255};
                  const paints=child.values.fills,expectedBindings={...source.values.boundVariables};delete expectedBindings.fills;
                  if(child.type!=='TEXT'||!Array.isArray(paints)||paints.length!==1||paints[0].type!=='SOLID'||paints[0].visible===false||
                    paints[0].blendMode!==undefined&&paints[0].blendMode!=='NORMAL'||!paint(paints[0].color,expected)||
                    !numeric(paints[0].opacity??1,hex.length===8?parseInt(hex.slice(6,8),16)/255:1)||Object.keys(paints[0].boundVariables??{}).length||
                    !same(child.values.boundVariables??{},expectedBindings))issue('native-text-color-observation-paint',child);
                }
                const inkOverride = pathSpec?.nativePathInk && spec.instanceInk;
                const insideStroke=inkOverride && spec.instanceInsideStroke;
                if (inkOverride) {
                  const bound = nativeBoundPaintColor(inkOverride.varName,tokens.receipt.variables,consumingMode,input.tokenIdentity.collection.id);
                  const expectedBindings={...source.values.boundVariables,fills:[{type:'VARIABLE_ALIAS',id:bound?.id}]};
                  if(insideStroke){delete expectedBindings.strokeWeight;expectedBindings.strokes=[{type:'VARIABLE_ALIAS',id:bound?.id}];}
                  if (!nativePaintStackMatches({type:'shape',name:'caller ink',fill:inkOverride.varName},child.values.fills,bound,child.values.boundVariables?.fills) ||
                      !bound || !same(child.values.boundVariables,expectedBindings))
                    issue('native-filled-path-observation-caller-ink',child);
                  if(insideStroke && (!bound || (bound.color.a??1)!==1 ||
                    !nativePaintStackMatches({type:'shape',name:'caller stroke',fill:inkOverride.varName},child.values.strokes,bound,child.values.boundVariables?.strokes) ||
                    child.values.strokeAlign!=='INSIDE' || !numeric(child.values.strokeWeight,insideStroke.weight) ||
                    child.values.strokeCap!==insideStroke.cap || child.values.strokeJoin!==insideStroke.join ||
                    !numeric(child.values.strokeMiterLimit,insideStroke.miterLimit) || !same(child.values.dashPattern,[])))
                    issue('native-filled-path-observation-caller-inside-stroke',child);
                }
                if(pathSpec?.shape?.kind==='line'){
                  if(!same(meta(child,'nativeContractPart'),meta(source,'nativeContractPart'))||!nativeLineNodeMatches(pathSpec,child.values,nodes.get(child.parentId)?.values))issue('native-line-observation-inherited-geometry',child);
                } else if(pathSpec?.insetOverlay){
                  if(!same(meta(child,'nativeContractPart'),meta(source,'nativeContractPart'))||!insetOverlayMatches(pathSpec,child.values,nodes.get(child.parentId)?.values))issue('native-inset-overlay-observation-inherited-geometry',child);
                } else if(pathSpec?.instanceAffineAllocation){
                  if(!affineMatches(pathSpec,child))issue('native-instance-affine-observation-inherited-geometry',child);
                } else if(pathSpec?.shape?.kind==='stroked-path'){
                  const owner=nodes.get(child.parentId);
                  if(!owner || !nativeStrokedPathNodeMatches(pathSpec.shape,child.values,owner.values) || child.childIds.length)
                    issue('native-stroked-path-observation-inherited-geometry',child);
                } else if (pathSpec) {
                  const scalable = !!(pathSpec.nativePathScale || pathSpec.pathParentViewport);
                  const fields = pathSpec.nativePathInk ? ['isMask','blendMode','constraints'] : ['layoutMode','clipsContent','constraints'];
                  for (const field of fields) if (!same(child.values[field],source.values[field]))
                    issue('native-filled-path-observation-inherited-' + field,child);
                  if (scalable) {
                    const sx = row.values.width / main!.values.width, sy = row.values.height / main!.values.height;
                    const a = child.values, b = source.values;
                    if (![sx,sy].every(value=>Number.isFinite(value)&&value>0) ||
                        !numeric(a.width,b.width*sx) || !numeric(a.height,b.height*sy) ||
                        !scaledOrigin(a.x,b.x,sx,row.values.x) || !scaledOrigin(a.y,b.y,sy,row.values.y) ||
                        !same(a.relativeTransform,[[1,0,a.x],[0,1,a.y]]))
                      issue('native-filled-path-observation-inherited-scale',child);
                    if (pathSpec.nativePathInk && !nativeFilledPathResizeMatches(b.vectorPaths,a.vectorPaths,a.width/b.width,a.height/b.height))
                      issue('native-filled-path-observation-inherited-vectorPaths',child);
                  } else for (const field of ['relativeTransform','width','height',...(pathSpec.nativePathInk?['vectorPaths']:[])]) {
                    if (field==='width' && nativeTextOverrideOwnsWidth(pathSpec,child,source,properties)) continue;
                    if (!same(child.values[field],source.values[field]))
                      issue('native-filled-path-observation-inherited-' + field,child);
                  }
                }
                // Instance edits can override inherited content without changing
                // its main link or allocation stamp. Compare these independently
                // observed channels, allowing only the declared property value.
                if (child.type === 'INSTANCE' && (child.mainId !== source.mainId ||
                    !same(child.componentProperties,source.componentProperties) ||
                    !same(child.values.reactions ?? [],source.values.reactions ?? [])))
                  issue('native-library-observation-inherited-instance',child);
                for (const field of ['fills','strokes','effects','opacity','strokeWeight','cornerRadius','fontName','fontSize','fontWeight',
                  'textAutoResize','textAlignHorizontal','lineHeight','letterSpacing','boundVariables','characters','visible',
                  'strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern']) {
                  if((appearance||authoredOwnsAppearance||nestedAuthority?.appearance)&&['fills','fontName','fontSize','fontWeight','lineHeight','letterSpacing','textCase','textDecoration'].includes(field))continue;
                  if((authoredScalarReplacement||nestedAuthority?.scalar)&&field==='boundVariables')continue;
                  if ((inkOverride||textColor!==undefined||imageOverride) && (field === 'fills' || field === 'boundVariables')) continue;
                  if (insideStroke && ['strokes','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern'].includes(field))continue;
                  const key = source.values.componentPropertyReferences?.[field];
                  const expected = key && properties[key] ? properties[key].value : source.values[field];
                  if (!same(child.values[field],expected)) issue('native-library-observation-inherited-'+field,child);
                }
              }
              descend(child,source,properties,textOwner&&child.type!=='INSTANCE');
            }
          } }
        };
        descend(n,nodes.get(n.mainId));
        for(const key of Object.keys(spec.instanceTextAppearances??{}))if(textAppearanceMatches.get(key)!==1)issue('native-text-appearance-observation-target',n);
        for(const key of Object.keys(spec.instanceImages??{}))if(imageMatches.get(key)!==1)issue('native-image-observation-target',n);
        for(const key of Object.keys(spec.instanceTextColors??{}))if(textColorMatches.get(key)!==1)issue('native-text-color-observation-target',n);
        for (const row of descendants) if (borrowedIds.has(row.id)) checked.add(row.id);
        // Inherited slots the parent leaves unfilled are the only place a canvas
        // edit can add content inside an instance. They must mirror the main's
        // own slot children exactly (empty for reusable mains); every child is
        // paired by type and by the allocation stamp of the main's node.
        const filledKeys = new Set<string>();
        for (const slotSpec of spec.children ?? []) for (const [candidate, definition] of Object.entries(depTarget?.definitions ?? {}) as Array<[string, any]>)
          if (definition.type === 'SLOT' && (candidate === slotSpec.callerSlotProperty || candidate.startsWith(slotSpec.callerSlotProperty + '#'))) filledKeys.add(candidate);
        const slotsOf = (root: Record<string, any> | undefined, stopAt: Set<string>) => {
          const found = new Map<string, Record<string, any>>(); const seen = new Set<string>();
          // Property keys belong to an instance, not to the complete descendant
          // tree. Two instances of one main legitimately inherit the same key.
          const walk = (row: Record<string, any>, path: number[] = [], scope: number[] = []) => { for (const [index,id] of row.childIds.entries()) {
            const child = nodes.get(id); if (!child || seen.has(id)) continue; seen.add(id);
            const key = child.type === 'SLOT' ? child.values.componentPropertyReferences?.slotContentId : undefined;
            if (typeof key === 'string') {
              const scopedKey = library ? JSON.stringify([scope,key]) : key;
              if (found.has(scopedKey)) issue('native-contract-observation-inherited-slot', child);
              found.set(scopedKey, child);
              if ((!library || scope.length === 0) && stopAt.has(key)) continue;
            }
            const childPath = [...path,index];
            walk(child,childPath,child.type === 'INSTANCE' ? childPath : scope);
          } };
          if (root) walk(root);
          return found;
        };
        const mainRow = nodes.get(n.mainId), mainSlots = slotsOf(mainRow, new Set());
        const scopedFilledKeys = library ? new Set([...filledKeys].map(key=>JSON.stringify([[],key]))) : filledKeys;
        for (const [key, slot] of slotsOf(n, filledKeys)) {
          if (scopedFilledKeys.has(key)) continue;
          const mainSlot = mainSlots.get(key);
          if (!mainRow || !mainSlot) { issue('native-contract-observation-inherited-slot', slot); continue; }
          if (slot.childIds.length !== mainSlot.childIds.length || slot.childIds.some((id: string, index: number) => {
            const child = nodes.get(id), mainChild = nodes.get(mainSlot.childIds[index]);
            return !child || !mainChild || child.type !== mainChild.type || child.metadata.nativeSourceAllocation !==
              (library ? mainChild.metadata.nativeSourceAllocation : mainChild.id);
          })) issue('native-contract-observation-inherited-slot-content', slot);
        }
        for (const slotSpec of spec.children ?? []) {
          const key = depTarget && Object.entries(depTarget.definitions ?? {}).filter(([candidate, definition]: [string, any]) =>
            definition.type === 'SLOT' && (candidate === slotSpec.callerSlotProperty || candidate.startsWith(slotSpec.callerSlotProperty + '#'))).map(([candidate]) => candidate);
          const slots = key?.length === 1 ? library
            ? [...slotsOf(n,filledKeys)].filter(([scopedKey])=>scopedKey === JSON.stringify([[],key[0]])).map(([,slot])=>slot)
            : descendants.filter(row => row.type === 'SLOT' && row.values.componentPropertyReferences?.slotContentId === key[0]) : [];
          if (slots.length !== 1 || slots[0].childIds.length !== (slotSpec.children ?? []).length) {
            issue('native-contract-observation-instance-caller-slot', n); continue;
          }
          (slotSpec.children ?? []).forEach((child, index) => visit(child, nodes.get(slots[0].childIds[index])));
        }
        return;
      }
      if (sample && !same(meta(n, "nativeSourceSample"), sample))
        issue("native-source-observation-sample-identity", n);
      if (spec.layout?.grid?.flowRows && !same(meta(n, 'gridFlowRows'), spec.layout.grid.flowRows))
        issue('native-source-observation-grid-flow-recipe', n);
      const wrapper = sourceCase?.wrappers?.find((w) =>
        same(w.partPath, spec.nativeSourcePart?.partPath),
      );
      if (
        v.visible !==
        (wrapper ? wrapper.visible : library && spec.visibleProp ? spec.visibleDefault === true : library && spec.slotOptional ? false : !spec.slotTextTemplate && spec.nativeSourceVisible !== false)
      )
        issue("native-source-observation-visibility", n);
      if (
        spec.layout &&
        !spec.scalablePathParent && !spec.strokeViewport && (v.layoutMode !== spec.layout.mode ||
          (spec.layout.mode !== 'GRID' && (v.primaryAxisAlignItems !== spec.layout.primary ||
          v.counterAxisAlignItems !== spec.layout.counter)))
      )
        issue("native-source-observation-layout", n);
      if ((spec.scalablePathParent || spec.strokeViewport) && (v.layoutMode !== 'NONE' ||
          !numeric(v.width,spec.fixedWidth?.px ?? spec.lits?.width ?? NaN) ||
          !numeric(v.height,spec.fixedHeight?.px ?? spec.lits?.height ?? NaN)))
        issue('native-filled-path-observation-parent',n);
      if (spec.nativeAspectRatio !== undefined &&
          !(Number.isFinite(v.targetAspectRatio?.x) && Number.isFinite(v.targetAspectRatio?.y) &&
            v.targetAspectRatio.x > 0 && v.targetAspectRatio.y > 0 &&
            Math.abs(v.targetAspectRatio.x / v.targetAspectRatio.y - spec.nativeAspectRatio) <= 0.00001))
        issue('native-source-observation-aspect-ratio', n);
      for (const problem of nativeGridProblems(spec, v, n.childIds.map((id: string) => nodes.get(id)?.values)))
        issue('native-source-observation-grid-' + problem, n);
      if (spec.rootFillWidth && (v.layoutSizingHorizontal !== 'FIXED' ||
          (v.layoutMode === 'HORIZONTAL' ? v.primaryAxisSizingMode : v.counterAxisSizingMode) !== 'FIXED' ||
          nodes.get(n.childIds[(spec.children??[]).findIndex(child=>!child.backgroundPaint)])?.values.layoutSizingHorizontal !== 'FILL'))
        issue('native-source-observation-root-fill-width', n);
      if ((spec.opacity !== undefined || v.opacity !== undefined) && !numeric(v.opacity, spec.opacity ?? 1))
        issue("native-source-observation-opacity", n);
      const bindings: Record<string, string> = {
        ...spec.bindings,
        ...(isContractDraft(input) && spec.fontSizeVar ? { fontSize: spec.fontSizeVar } : {}),
        ...(isContractDraft(input) && spec.fontWeightVar ? { fontWeight: spec.fontWeightVar } : {}),
        ...(isContractDraft(input) && spec.slotTextTemplate && spec.lineHeightVar ? { lineHeight: spec.lineHeightVar } : {}),
        ...(spec.fixedWidth ? { width: spec.fixedWidth.varName } : {}),
        ...(spec.fixedHeight?.varName
          ? { height: spec.fixedHeight.varName }
          : {}),
      };
      const observedBindings = { ...v.boundVariables };
      // Figma exposes a uniform stroke binding through its four edge channels.
      // Accept that API representation only when every edge retains the exact
      // intended variable and the independently read weights are uniform.
      const strokeEdges = ['strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'];
      if (library && bindings.strokeWeight && !Object.hasOwn(observedBindings,'strokeWeight') &&
          strokeEdges.every(field => !Object.hasOwn(bindings,field) &&
            same(observedBindings[field],{type:'VARIABLE_ALIAS',id:variableByName.get(bindings.strokeWeight)}) &&
            typeof v.strokeWeight === 'number' && numeric(v[field],v.strokeWeight))) {
        observedBindings.strokeWeight = observedBindings.strokeTopWeight;
        for (const field of strokeEdges) delete observedBindings[field];
      }
      if (isContractDraft(input) && spec.type === 'text' && Array.isArray(observedBindings.fontSize) && observedBindings.fontSize.length === 1)
        observedBindings.fontSize = observedBindings.fontSize[0];
      if (isContractDraft(input) && spec.fontWeightVar && Array.isArray(observedBindings.fontWeight) && observedBindings.fontWeight.length === 1)
        observedBindings.fontWeight = observedBindings.fontWeight[0];
      if (isContractDraft(input) && spec.slotTextTemplate && Array.isArray(observedBindings.lineHeight) && observedBindings.lineHeight.length === 1)
        observedBindings.lineHeight = observedBindings.lineHeight[0];
      if (
        Object.entries(observedBindings).some(
          ([field, value]) =>
            !["fills", "strokes"].includes(field) &&
            (!object(value) || value.type !== "VARIABLE_ALIAS"),
        )
      )
        issue("native-source-observation-extra-bindings", n);
      const actualBindings = Object.fromEntries(
        Object.entries(observedBindings).filter(
          ([, value]) => object(value) && value.type === "VARIABLE_ALIAS",
        ),
      );
      if (!same(Object.keys(actualBindings).sort(), Object.keys(bindings).sort()))
        issue("native-source-observation-binding-fields", n);
      for (const [field, name] of Object.entries(bindings))
        if (
          !variableByName.has(name) ||
          !same(actualBindings[field], {
            type: "VARIABLE_ALIAS",
            id: variableByName.get(name),
          })
        )
          issue(`native-source-observation-binding-${field}`, n);
      if (bindings.minHeight) {
        const minimum = nativeBoundNumber(bindings.minHeight,
          [...tokens.receipt.variables, ...(graph ? receipt.templateGraph!.receipt.routes : [])], consumingMode);
        if (minimum === undefined || !numeric(v.minHeight, minimum))
          issue('native-source-observation-binding-minHeight-value', n);
      }
      const inspectPaintStack = isContractDraft(input) && ['root','frame','shape'].includes(spec.type) &&
        !!(spec.gradient || ((spec.type === 'shape' || spec.capturedAbsoluteGeometry) && spec.lits?.fillColor));
      for (const field of ["fill", "stroke"] as const) {
        const name = spec[field],
          paints = v[field === "fill" ? "fills" : "strokes"] ?? [];
        if ((spec.shape?.kind === 'stroked-path'||spec.shape?.kind==='line') && field === 'stroke') {
          const bound = name ? nativeBoundPaintColor(name,tokens.receipt.variables,consumingMode,input.tokenIdentity.collection.id) : undefined;
          const weight=bindings.strokeWeight?nativeBoundNumber(bindings.strokeWeight,tokens.receipt.variables,consumingMode):spec.lits?.strokeWeight;
          if(!nativeStrokedPathPaintMatches(spec,v,weight,bound))
            issue('native-stroked-path-observation-paint',n);
        } else if (spec.mask?.stroke) {
          if (field === 'fill' ? !Array.isArray(paints) || paints.length !== 0
              : !nativeMaskStrokeMatches(spec.mask.stroke, v))
            issue('native-mask-stroke-observation-changed', n);
        } else if (field === 'fill' && spec.imagePaint) {
          const images=Array.isArray(paints)?paints.filter((p:any)=>p.type==='IMAGE'):[];
          const bound=name?nativeBoundPaintColor(name,tokens.receipt.variables,consumingMode,input.tokenIdentity.collection.id):undefined;
          if(images.length!==1||paints[paints.length-1]!==images[0]||!nativeImageOverrideMatches(spec.imagePaint,images[0],n.imageAssets?.[images[0]?.imageHash])||
            !nativePaintStackMatches(spec,paints.filter((p:any)=>p.type!=='IMAGE'),bound,observedBindings.fills))issue('native-image-observation-original',n);
        } else if (field === 'fill' && inspectPaintStack) {
          const bound = name ? nativeBoundPaintColor(name,
            [...tokens.receipt.variables, ...(graph ? receipt.templateGraph!.receipt.routes : [])],
            consumingMode, input.tokenIdentity.collection.id) : undefined;
          if (!nativePaintStackMatches(spec,paints,bound,observedBindings.fills))
            issue('native-contract-observation-paint-stack',n);
        } else if (name) {
          if (
            paints.length !== 1 ||
            paints[0].type !== "SOLID" ||
            paints[0].visible === false ||
            !variableByName.has(name) ||
            !same(paints[0].boundVariables?.color, {
              type: "VARIABLE_ALIAS",
              id: variableByName.get(name),
            })
          )
            issue(`native-source-observation-${field}-binding`, n);
        } else if (field === 'stroke' && spec.insetRingStroke && spec.lits?.strokeColor) {
          const color=spec.lits.strokeColor,weight=spec.lits.strokeWeight;
          if (!['root','frame'].includes(spec.type) || typeof weight!=='number' || !Number.isFinite(weight) || weight<=0 ||
              !Array.isArray(paints) || paints.length!==1 || paints[0].type!=='SOLID' || paints[0].visible===false ||
              (paints[0].blendMode??'NORMAL')!=='NORMAL' || !paint(paints[0].color,color) ||
              !numeric(paints[0].opacity??1,color.a??1) || Object.keys(paints[0].boundVariables??{}).length ||
              (observedBindings.strokes!==undefined && (!Array.isArray(observedBindings.strokes)||observedBindings.strokes.length!==0)) ||
              v.strokeAlign!=='INSIDE' || !Array.isArray(v.dashPattern) || v.dashPattern.length!==0 ||
              !['strokeWeight','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'].every(field=>numeric(v[field],weight)))
            issue('native-inset-ring-observation-paint',n);
        } else if (field === 'stroke' && library && ['root','frame'].includes(spec.type) && spec.lits?.strokeColor &&
            typeof spec.lits.strokeWeight === 'number' && !spec.lits.strokeSides) {
          const color=spec.lits.strokeColor,weight=spec.lits.strokeWeight;
          if (!Number.isFinite(weight) || weight < 0 || !Array.isArray(paints) || paints.length!==1 ||
              paints[0].type!=='SOLID' || paints[0].visible===false || (paints[0].blendMode??'NORMAL')!=='NORMAL' ||
              !paint(paints[0].color,color) || !numeric(paints[0].opacity??1,color.a??1) ||
              Object.keys(paints[0].boundVariables??{}).length ||
              (observedBindings.strokes!==undefined && (!Array.isArray(observedBindings.strokes)||observedBindings.strokes.length!==0)) ||
              v.strokeAlign!==(spec.strokeOutside?'OUTSIDE':'INSIDE') || !same(v.dashPattern,spec.dashPattern??[]) ||
              !['strokeWeight','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'].every(field=>numeric(v[field],weight)))
            issue('native-library-observation-literal-stroke',n);
        } else if (field === 'fill' && library && ['root','frame'].includes(spec.type) && spec.lits?.fillColor) {
          // The prepared contract already declares this paint. A literal is
          // verified by its exact color and opacity, never by a canvas claim.
          if (!Array.isArray(paints) || paints.length !== 1 || paints[0].type !== 'SOLID' || paints[0].visible === false ||
              (paints[0].blendMode ?? 'NORMAL') !== 'NORMAL' || !paint(paints[0].color,spec.lits.fillColor) ||
              !numeric(paints[0].opacity ?? 1,spec.lits.fillColor.a ?? 1) ||
              Object.keys(paints[0].boundVariables ?? {}).length ||
              (observedBindings.fills !== undefined && (!Array.isArray(observedBindings.fills) || observedBindings.fills.length !== 0)))
            issue('native-library-observation-literal-fill',n);
        } else if (field==='fill'&&spec.backgroundPaint&&spec.lits?.fillColor) {
          if(paints.length!==1 || paints[0].type!=='SOLID' || !paint(paints[0].color,spec.lits.fillColor) ||
             !numeric(paints[0].opacity??1,spec.lits.fillColor.a??1) || Object.keys(paints[0].boundVariables??{}).length)
            issue('native-contract-observation-background-paint',n);
        } else if (spec.type !== "text" && paints.length)
          issue(`native-source-observation-extra-${field}`, n);
      }
      if (!nativeShadowStackMatches(spec, v.effects))
        issue("native-source-observation-effects", n);
      if (spec.gradient && !inspectPaintStack) issue("native-source-observation-gradient-unverified", n);
      for (const field of ["width", "height"] as const)
        if (
          spec.lits?.[field] !== undefined &&
          !numeric(v[field], capturedGeometry?.[field] ?? spec.lits[field]!)
        )
          issue(`native-source-observation-${field}`, n);
      if (library && spec.type === 'root') {
        const expected = (component.stateReactions ?? []).filter(w=>w.from === n.name).map(w=>({trigger:{type:w.trigger},
          actions:[{type:'NODE',destinationId:created.variants.find((v:any)=>v.name===w.to)?.id,navigation:'CHANGE_TO',transition:null}]}));
        if (!nativeLibraryReactionsMatch(v.reactions ?? [],expected)) issue('native-library-observation-reactions',n);
      } else if (spec.type !== "svg" && v.reactions?.length)
        issue("native-source-observation-reactions", n);
      if (spec.layout && v.clipsContent !== (spec.clipsContent === true))
        issue("native-source-observation-clipping", n);
      if (spec.type === "text") {
        const literalBox=nativeLiteralTextBox(spec);
        if(literalBox&&(!numeric(v.width,literalBox.width)||v.textAutoResize!==(literalBox.height===undefined?'HEIGHT':'NONE')||literalBox.height!==undefined&&!numeric(v.height,literalBox.height)))issue('native-literal-text-box-observation',n);
        const authoredRangeAuthority = !!spec.authoredTextAppearance && v.characters === spec.characters &&
          nativeTextAppearanceMatches(spec.authoredTextAppearance,v.characters,v.textAppearanceRuns,true);
        if (spec.authoredTextAppearance && !authoredRangeAuthority) {
          issue('native-authored-text-appearance-observation-ranges',n);
          if(nativeTextAppearanceDefaultProfileRequired(spec.authoredTextAppearance,v.textAppearanceRuns,true))issue('native-authored-font-default-profile-unverified',n);
        }
        if (!authoredRangeAuthority && (spec.slotTextTemplate || (isContractDraft(input) && spec.fontWeightVar))) {
          const variables = [...tokens.receipt.variables, ...(graph ? receipt.templateGraph!.receipt.routes : [])];
          let weight = variables.find((entry: any) => entry.name === spec.fontWeightVar);
          let modeId = consumingMode[weight?.variableCollectionId ?? input.tokenIdentity.collection.id];
          const seen = new Set<string>();
          while (weight && object(weight.valuesByMode[modeId]) && weight.valuesByMode[modeId].type === 'VARIABLE_ALIAS') {
            if (seen.has(weight.id)) { weight = undefined; break; }
            seen.add(weight.id);
            const id = weight.valuesByMode[modeId].id;
            weight = variables.find((entry: any) => entry.id === id);
            modeId = consumingMode[weight?.variableCollectionId ?? input.tokenIdentity.collection.id];
          }
          if (!weight || !numeric(v.fontWeight, weight.valuesByMode[modeId]))
            issue(spec.slotTextTemplate ? 'native-source-observation-text-template-weight' : 'native-source-observation-text-weight', n);
        }
        // Figma stores tracking as float32, just like the other native numbers.
        // Accept only the planned value or its exact stored representation.
        if (spec.slotTextTemplate && (v.textAutoResize !== 'WIDTH_AND_HEIGHT' ||
            !(same(v.letterSpacing, { unit: 'PIXELS', value: spec.letterSpacing ?? 0 }) ||
              same(v.letterSpacing, { unit: 'PIXELS', value: Math.fround(spec.letterSpacing ?? 0) }))))
          issue('native-source-observation-text-template-sizing', n);
        if (
          v.characters !== spec.characters ||
          !authoredRangeAuthority && (v.fontName?.family !== spec.fontFamily ||
          ![spec.fontStyle, spec.fontStyle?.split(" ").join("")].includes(
            v.fontName?.style,
          ) ||
          !numeric(v.fontSize, spec.fontSize!))
        )
          issue("native-source-observation-text", n);
        if (!authoredRangeAuthority && (
          v.textCase !== (spec.textCase ?? "ORIGINAL") ||
          v.textDecoration !== (spec.textDecoration ?? "NONE")
        ))
          issue("native-source-observation-text-decoration", n);
        if (
          !authoredRangeAuthority && !same(v.lineHeight, spec.lineHeight ?? (isContractDraft(input) ? { unit: 'AUTO' } : undefined)) ||
          (spec.textAlignH && v.textAlignHorizontal !== spec.textAlignH)
        )
          issue("native-source-observation-typography", n);
        if (!authoredRangeAuthority && isContractDraft(input) && spec.textFill) {
          if (!variableByName.has(spec.textFill) || v.fills?.length !== 1 || v.fills[0].type !== 'SOLID' ||
              v.fills[0].visible === false || !same(v.fills[0].boundVariables?.color,
                { type: 'VARIABLE_ALIAS', id: variableByName.get(spec.textFill) }))
            issue('native-source-observation-text-paint', n);
        } else if (!authoredRangeAuthority && (
          v.fills?.length !== 1 ||
          !paint(v.fills[0].color, spec.textFillLit) ||
          !numeric(v.fills[0].opacity ?? 1, spec.textFillLit?.a ?? 1) ||
          Object.keys(v.fills[0].boundVariables ?? {}).length
        ))
          issue("native-source-observation-text-paint", n);
        if (isContractDraft(input) && (n.metadata.fontWeightVar !== (spec.fontWeightVar ?? '') ||
            n.metadata.lineHeightVar !== (spec.lineHeightVar ?? '')))
          issue('native-source-observation-text-token-identity', n);
      }
      if (spec.type === "svg") {
        if (
          !numeric(v.width, spec.iconSize!) ||
          !numeric(v.height, spec.iconSize!)
        )
          issue("native-source-observation-svg-size", n);
        if (isContractDraft(input)) {
          const descend = (row: Record<string, any>) => {
            for (const id of row.childIds) {
              const child = nodes.get(id);
              if (!child || checked.has(id) || !same(meta(child, 'nativeContractPart'), spec.nativeContractPart)) {
                issue('native-contract-observation-svg-descendant', child); continue;
              }
              checked.add(id);
              if (spec.svgPaintVar) for (const field of ['fills', 'strokes']) for (const p of child.values[field] ?? [])
                if (p.visible !== false && p.type === 'SOLID' &&
                    !same(p.boundVariables?.color, { type: 'VARIABLE_ALIAS', id: variableByName.get(spec.svgPaintVar) }))
                  issue('native-contract-observation-svg-paint', child);
              if (child.values.reactions?.length) issue('native-contract-observation-svg-reactions', child);
              descend(child);
            }
          };
          descend(n);
        }
        return; // SVG descendants are inventoried/owned; path equivalence requires visual/vector verification.
      }
      if (spec.type === 'shape') {
        const parent=nodes.get(n.parentId),background=spec.backgroundPaint;
        if(spec.shape?.kind==='line'){
          if(!nativeLineNodeMatches(spec,v,parent?.values)||n.childIds.length)issue('native-line-observation-geometry',n);
          return;
        }
        if(spec.shape?.kind==='stroked-path'){
          if(!parent || !nativeStrokedPathNodeMatches(spec.shape,v,parent.values) || n.childIds.length)
            issue('native-stroked-path-observation-geometry',n);
          return;
        }
        if (spec.nativeMaskPath) {
          if (!spec.mask?.stroke || !spec.capturedAbsoluteGeometry ||
              !nativeFilledPathMatches(spec.shape, v.vectorPaths, v.x, v.y) ||
              v.blendMode !== 'PASS_THROUGH' || n.childIds.length)
            issue('native-mask-path-observation-geometry', n);
        }
        if (spec.nativePathInk) {
          if (!nativeFilledPathMatches(spec.shape, v.vectorPaths, v.x, v.y) || v.isMask !== Boolean(spec.mask) ||
              v.blendMode !== 'PASS_THROUGH' || !same(v.constraints, spec.nativePathScale
                ? {horizontal:'SCALE',vertical:'SCALE'} : {horizontal:'MIN',vertical:'MIN'}) ||
              !same(v.relativeTransform, [[1,0,v.x],[0,1,v.y]]) ||
              ![v.width,v.height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) ||
              v.layoutSizingHorizontal === 'FILL' || v.layoutSizingVertical === 'FILL')
            issue('native-filled-path-observation-geometry', n);
          if (n.childIds.length) issue('native-filled-path-observation-children', n);
          return;
        }
        if (isContractDraft(input) && input.absoluteShapeReadback?.nodeIds.includes(n.id) &&
            (!same(v.constraints,{horizontal:'MIN',vertical:'MIN'}) ||
             input.absoluteShapeReadback.version >= 2 && v.targetAspectRatio !== null ||
             v.layoutSizingHorizontal !== 'FIXED' || v.layoutSizingVertical !== 'FIXED' ||
             !['rect','ellipse'].includes(spec.shape!.kind) || spec.absolute?.h !== 'MIN' || spec.absolute?.v !== 'MIN'))
          issue('native-absolute-shape-observation-constraints',n);
        const width=background?Math.max(0.01,(parent?.values.width??NaN)-2*background.inset):capturedGeometry?.width ?? spec.shape!.width;
        const height=background?Math.max(0.01,(parent?.values.height??NaN)-2*background.inset):capturedGeometry?.height ?? spec.shape!.height;
        // A compiled Fill relation replaces the shape's intrinsic size on that
        // axis. Its native sizing mode is verified above; the other axis still
        // has to retain its exact declared geometry. This is structure evidence,
        // not a visual comparison or an inferred fixed allocation.
        // Old plans could carry an implicit shape stretch flag. Require the
        // declared relation as well; a historical compiler flag grants nothing.
        const fillsWidth = library && !background && spec.fillW === true &&
          (spec.widthFill === true || (spec.grow === true && parent?.values.layoutMode === 'HORIZONTAL'));
        const fillsHeight = library && !background && spec.fillH === true &&
          spec.grow === true && parent?.values.layoutMode === 'VERTICAL';
        const finiteSize = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;
        if (!(fillsWidth ? finiteSize(v.width) : numeric(v.width, width)) ||
            !(fillsHeight ? finiteSize(v.height) : numeric(v.height, height)) ||
            (library && !background && ((!fillsWidth && v.layoutSizingHorizontal === 'FILL') ||
              (!fillsHeight && v.layoutSizingVertical === 'FILL'))))
          issue('native-contract-observation-shape-size', n);
        if(background&&(!numeric(v.cornerRadius,background.radius)||
            !numeric(background.radius,Math.max(0,(parent?.values.cornerRadius??NaN)-background.inset))||
            !same(v.constraints,{horizontal:'STRETCH',vertical:'STRETCH'})||parent?.childIds[0]!==n.id))
          issue('native-contract-observation-background-geometry',n);
        if (!spec.capturedAbsoluteGeometry && spec.absolute && (v.layoutPositioning !== 'ABSOLUTE' || !positionedAs(v.x, spec.absolute.left!, parent?.values.width, v.width) ||
            !positionedAs(v.y, spec.absolute.top!, parent?.values.height, v.height)))
          issue('native-contract-observation-shape-position', n);
      }
      if(spec.affineViewport && (v.layoutMode!=='NONE'||n.childIds.length!==1||
          !numeric(v.width,spec.lits?.width??NaN)||!numeric(v.height,spec.lits?.height??NaN)))
        issue('native-instance-affine-observation-viewport',n);
      if (spec.nativePathViewport && (v.layoutMode !== 'NONE' || v.clipsContent !== (spec.clipsContent === true) ||
          !numeric(v.width, spec.lits!.width!) || !numeric(v.height, spec.lits!.height!) ||
          (spec.nativePaintedStrokeMask ? spec.children?.length !== 2 || spec.children[0].mask?.type !== 'VECTOR' || spec.children[0].nativePathInk !== true || spec.children[1].nativePathInk !== true || spec.children[1].mask !== undefined : spec.children?.length !== 1 || spec.children[0].nativePathInk !== true)))
        issue('native-filled-path-observation-viewport', n);
      if (spec.pathParentViewport && (!same(v.constraints,{horizontal:'SCALE',vertical:'SCALE'}) ||
          !numeric(v.x,spec.pathParentViewport.x) || !numeric(v.y,spec.pathParentViewport.y) ||
          !same(v.relativeTransform,[[1,0,v.x],[0,1,v.y]])))
        issue('native-filled-path-observation-viewport-position',n);
      if (spec.type === "slot") {
        // An empty text-template slot draws nothing. Its HUG width is the
        // root-content writer's seed: 0.01 px since D.175 (Figma stores the
        // float32), exact 0 in operations created before it. Height has no seed.
        if (spec.children?.some(child => child.slotTextTemplate) &&
            ((v.layoutSizingHorizontal === 'HUG' && !emptySlotWidth(v.width)) ||
             (v.layoutSizingVertical === 'HUG' && v.height !== 0)))
          issue('native-source-observation-text-template-empty-box', n);
        if (
          v.componentPropertyReferences?.slotContentId !==
          slotKeys.get(spec.slotProperty!)
        )
          issue("native-source-observation-slot-key", n);
        const sourceSample =
          isContractDraft(input) ? undefined : sourceCase &&
          input.samples.cases
            .find((c) => c.id === sourceCase.id)
            ?.slots.find(
              (s) =>
                s.identity.sourceNodeId === spec.nativeSourcePart?.sourceNodeId &&
                s.identity.templateId === spec.nativeSourcePart?.templateId,
            );
        const defaults:NodeSpec[] = library ? (spec.slotDefault ?? []).map(item=>({type:'instance',name:item.dep,
          dep:item.dep,depContractId:item.depContractId ?? item.contractId,depProps:item.props,nativeContractPart:item.nativeContractPart,
          instanceAuthoredTextAppearance:item.instanceAuthoredTextAppearance,instanceAuthoredTextRecipes:item.instanceAuthoredTextRecipes,
          instanceTextAppearances:item.instanceTextAppearances,authoredTextInstanceTarget:item.authoredTextInstanceTarget})) : [];
        const specs = isContractDraft(input) ? [...defaults,...(spec.children ?? [])] : sourceSample?.specs ?? [];
        if (n.childIds.length !== specs.length)
          issue("native-source-observation-slot-content", n);
        specs.forEach((child, i) =>
          visit(child, nodes.get(n.childIds[i]), undefined, isContractDraft(input) ? undefined : {
            caseId: sourceCase!.id,
            sourceName: sourceSample!.sourceName,
            partPath: spec.nativeSourcePart!.partPath,
            sampleIds: sourceSample!.sampleIds,
            sampleRevision: sourceSample!.sampleRevision,
            specRevision: sourceSample!.specRevision,
            specPath: [i],
          }),
        );
        return;
      }
      let contentIds=n.childIds;
      if(spec.solidFillCompositionToken){
        const bound=nativeBoundPaintColor(spec.solidFillCompositionToken.split('.').join('/'),tokens.receipt.variables,consumingMode,input.tokenIdentity.collection.id);
        const observed=boundFillInventory(spec,n as any,nodes as any,input.operation.fileKey,bound,consumingMode);
        if('refused'in observed){issue(observed.refused,n);return;}
        if(checked.has(observed.layerId)){issue('bound-fill-inventory-reused',n);return;}
        checked.add(observed.layerId);contentIds=observed.contentIds;
      }
      if (contentIds.length !== (spec.children ?? []).length)
        issue("native-source-observation-topology", n);
      (spec.children ?? []).forEach((child, i) =>
        visit(
          child,
          nodes.get(contentIds[i]),
          sourceCase,
          sample ? { ...sample, specPath: [...sample.specPath, i] } : undefined,
        ),
      );
    };
    if (
      created.variants.length !== variants.length ||
      (component.isSet && !same(
        target.childIds,
        created.variants.map((v: any) => v.id),
      ))
    )
      issue("native-source-observation-variant-inventory");
    const mainIds = new Map<string, string>();
    variants.forEach((variant, i) => {
      const born = created.variants[i],
        node = born && nodes.get(born.id);
      if (!node || (component.isSet && node.name !== variant.name) || node.key !== born.key ||
          (!component.isSet && (created.variants.length !== 1 || node.id !== target.id)))
        issue("native-source-observation-variant-identity", node);
      if (
        component.isSet && node &&
        !same(
          node.variantProperties,
          Object.fromEntries(
            variant.name.split(", ").map((part) => {
              const i = part.indexOf("=");
              return [part.slice(0, i), part.slice(i + 1)];
            }),
          ),
        )
      )
        issue("native-source-observation-variant-properties", node);
      if (node) {
        mainIds.set(variant.name, node.id);
        visit(variant.spec, node);
      }
    });
    const expectedInstances: string[] = [];
    if (isContractDraft(input)) return;
    for (const sourceCase of input.projection.cases) {
      const born = c.comparisons.find((v: any) => v.id === sourceCase.id);
      if (
        !born ||
        (sourceCase.status === "refused"
          ? born.status !== "refused"
          : born.status !== "created-comparison")
      ) {
        issue("native-source-observation-case-coverage");
        continue;
      }
      if (sourceCase.status === "refused") continue;
      const props = Object.fromEntries(
        axes.map((axis) => {
          const value = sourceCase.properties![axis.propName];
          return [
            axis.property,
            value.kind === "omitted"
              ? axis.unsetValue
              : axis.values.find((v) => v.value === String(value.value))?.label,
          ];
        }),
      );
      const name = Object.entries(props)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ");
      const variant = component.variants.find((v) => v.name === name),
        inst = nodes.get(born.instanceId);
      expectedInstances.push(born.instanceId);
      if (
        !variant ||
        !inst ||
        inst.mainId !== mainIds.get(name) ||
        inst.parentId !== board!.id
      ) {
        issue("native-source-observation-case-main", inst);
        continue;
      }
      if (
        !same(meta(inst, "nativeSourceCase"), {
          id: sourceCase.id,
          samplesRevision: revisionOf(input.samples),
        })
      )
        issue("native-source-observation-case-identity", inst);
      visit(variant.spec, inst, sourceCase, undefined, true);
    }
    if (!same(board!.childIds, expectedInstances))
      issue("native-source-observation-comparison-inventory");
  };
  if (isContractDraft(input) && input.graphVerification !== undefined) {
    for (const [index, component] of input.graphComponents!.entries()) {
      const identity = c.graphTargets[index], node = nodes.get(identity.id);
      if (!node || !same(node.definitions, identity.propertyDefinitions)) {
        issue('native-graph-observation-property-identity', node); continue;
      }
      verifyComponent(component, node, identity);
    }
  } else verifyComponent(input.component, target, c);
  return report();
}

/** A changed declared single-line TEXT value owns its native HUG width.
 * Other geometry and all content/font/paint channels remain independently checked. */
export function nativeTextOverrideOwnsWidth(spec: NodeSpec, child: Record<string, any>, source: Record<string, any>, properties: Record<string, any>): boolean {
  const a=child.values,b=source.values,key=b?.componentPropertyReferences?.characters;
  if(spec.type!=='text' || !spec.contentProp || spec.fixedWidth || spec.bindings?.width!==undefined ||
      child.type!=='TEXT' || source.type!=='TEXT' || typeof key!=='string' ||
      key.replace(/#[0-9]+:[0-9]+(?::[0-9]+)?$/,'')!==spec.contentProp ||
      a?.componentPropertyReferences?.characters!==key || properties[key]?.type!=='TEXT' ||
      typeof properties[key].value!=='string' || properties[key].value!==a.characters || a.characters===b.characters) return false;
  return [a,b].every(v=>v.textAutoResize==='WIDTH_AND_HEIGHT' && v.layoutSizingHorizontal==='HUG' &&
    v.layoutSizingVertical==='HUG' && typeof v.characters==='string' && !/[\r\n]/.test(v.characters) &&
    Number.isFinite(v.width) && v.width>0 && Number.isFinite(v.height) && v.height>0);
}

/** Literal opaque INSIDE stroke carrier; independently observed fields must all agree. */
export function nativeMaskStrokeMatches(expected: NonNullable<NonNullable<NodeSpec['mask']>['stroke']>, values: Record<string, any>): boolean {
  const strokes = values.strokes;
  if (!Array.isArray(strokes) || strokes.length !== 1 || !Array.isArray(values.dashPattern) || values.dashPattern.length ||
      values.strokeAlign !== expected.align || values.strokeWeight !== expected.weight || values.strokeCap !== expected.cap ||
      values.strokeJoin !== expected.join || values.strokeMiterLimit !== expected.miterLimit) return false;
  const p = strokes[0];
  return p?.type === 'SOLID' && p.visible !== false && (p.opacity ?? 1) === 1 && (p.blendMode ?? 'NORMAL') === 'NORMAL' &&
    Object.keys(p.boundVariables ?? {}).length === 0 && Object.keys(values.boundVariables ?? {}).length === 0 &&
    ['r','g','b'].every(k => p.color?.[k] === expected.color[k as keyof typeof expected.color] ||
      p.color?.[k] === Math.fround(expected.color[k as keyof typeof expected.color]));
}
