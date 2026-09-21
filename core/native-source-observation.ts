/** Independent native observation. Creation acknowledgements supply IDs only;
 * expected semantics come from the saved host-authenticated source plan. */
import { verifyRootTextTemplateTokenContext, applyRootTextTemplateAliases } from './native-root-text-template-plan.js';
import { planNativeRootTextTemplateGraph, nativeRootTextTemplateGraphSelection, type NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { emitNativeTemplateGraphReadbackScript, verifyNativeTemplateGraphReceipt, type NativeTemplateGraphIdentity } from './native-root-text-template-graph-native.js';
import { resolveNativeSlotIdentities, resolveNativeGraphSlotIdentities } from "./native-slot-identity.js";
import { positionedAs } from './native-float32.js';
import { NATIVE_GRID_FIELDS, NATIVE_GRID_CHILD_FIELDS, nativeGridProblems } from './native-grid-observation.js';
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import type { ComponentData, NodeSpec } from "./emit-figma-script.js";
import type { NativeSourceCandidateProjection } from "./native-source-projection.js";
import type { NativeContractDraftProjection } from "./native-contract-draft.js";
import type { NativeSourceComparisonInput } from "./native-source-comparisons.js";
import { emitNativeTokenContextReadbackScript } from "./token-set.js";
import { emitNativeTokenExtensionContextReadbackScript } from './native-token-extension.js';
import {backgroundPaintIdentities} from './figma-background-clip.js';
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
export type NativeInspectionInput = NativeSourceObservationInput | NativeContractObservationInput;
function isContractDraft(input: NativeInspectionInput): input is NativeContractObservationInput {
  return 'kind' in input.projection && input.projection.kind === 'contract-draft';
}
/** Exports are diagnostic mains for a Contract draft; source comparisons remain
 * separate instances. Neither image kind is a visual-fidelity result. */
export function nativeInspectionExports(input: NativeInspectionInput): Array<{id: string; instanceId: string; type: string}> {
  return isContractDraft(input)
    ? input.creation.variants.map((v: any) => ({ id: `variant:${v.name}`, instanceId: v.id, type: 'COMPONENT' }))
    : input.creation.comparisons.filter((c: any) => c.status === 'created-comparison')
      .map((c: any) => ({ id: c.id, instanceId: c.instanceId, type: 'INSTANCE' }));
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const numeric = (actual: unknown, expected: number) =>
  actual === expected || actual === Math.fround(expected);
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
    (Array.isArray(input.graphComponents) && input.graphComponents.length > 1 &&
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
export function emitNativeContractReadbackScript(input: NativeContractObservationInput, captureImages = false, captureExportBounds = false): string {
  return emitNativeInspectionReadbackScript(input, captureImages, captureExportBounds);
}
/** Read every recorded field without yielding after a caller has loaded all
 * pages and warmed the static registry APIs. No images or instances are allowed.
 * This is a final live recheck, not a replacement for independent observation. */
export function emitNativeFixedCrossSizeSyncReadback(input: NativeContractObservationInput): string {
  return emitNativeInspectionReadbackScript(input, false, false, true);
}
export function emitNativeInspectionReadbackScript(input: NativeInspectionInput, captureImages = false, captureExportBounds = false, synchronous = false): string {
  checkInput(input);
  if(synchronous && (!isContractDraft(input) || !input.fixedCrossSizeReadback || captureImages || captureExportBounds))
    throw Error('native-fixed-cross-size-sync-input-invalid');
  const expected = {
    operation: input.operation,
    planRevision: input.planRevision,
    pageId: input.creation.pageId,
    nodes: input.creation.nodes,
    comparisons: nativeInspectionExports(input),
  };
  const managedRows = (spec: NodeSpec): boolean => !!spec.layout?.grid?.flowRows || (spec.children ?? []).some(managedRows);
  const extra = input.component.variants.some(v => managedRows(v.spec)) ? ['gridFlowRows'] : [];
  const hasText = (spec: NodeSpec): boolean => spec.type === 'text' || !!spec.children?.some(hasText);
  if (isContractDraft(input) && input.component.variants.some(v => hasText(v.spec))) extra.push('fontWeightVar', 'lineHeightVar');
  const hasCallerContent = (spec: NodeSpec): boolean => spec.callerContentProp !== undefined || !!spec.children?.some(hasCallerContent);
  if (isContractDraft(input) && input.component.variants.some(v => hasCallerContent(v.spec))) extra.push('callerContentProperty');
  const extension=isContractDraft(input)?input.tokenExtensionReadback:undefined;
  if(extension && (synchronous || !same(extension.before,input.tokenInput) || !same(extension.identity,input.tokenIdentity)))
    throw Error('native-token-extension-reader-input-invalid');
  const inventory = emitNativeInventoryReadbackScript(expected, input.tokenInput, input.tokenIdentity,
    isContractDraft(input) ? ['nativeContractPart', 'rootSlot', 'codeValueAxes', 'unsetVariantAxes', 'semantics', 'propNames', ...extra] : extra, captureImages, captureExportBounds, backgroundPaintIdentities(input.component),
    isContractDraft(input) ? input.absoluteShapeReadback?.nodeIds : undefined,
    isContractDraft(input) && input.absoluteShapeReadback?.version === 3 ? 'strict' : isContractDraft(input) && input.absoluteShapeReadback?.version === 2,
    isContractDraft(input) ? input.fixedCrossSizeReadback?.nodeIds : undefined, synchronous,
    isContractDraft(input) && input.component.rootSlot?.textTemplate === 1,
    extension ? emitNativeTokenExtensionContextReadbackScript(extension) : undefined);
  if (!isContractDraft(input) || !input.templateGraph) return inventory;
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
}, tokenInput: NativeTokenContextInput, tokenIdentity: NativeTokenIdentity, extraMetadata: string[], captureImages = false, captureExportBounds = false, backgroundParts:string[]=[], absoluteShapeNodeIds:string[]=[], absoluteShapeAspectRatio:boolean|'strict'=false, fixedCrossSizeNodeIds:string[]=[], synchronous=false, textTemplate=false, tokenReadback?:string): string {
  if(synchronous && (!fixedCrossSizeNodeIds.length || captureImages || captureExportBounds))
    throw Error('native-fixed-cross-size-sync-input-invalid');
  const fields = [
    "visible",
    "opacity",
    "x",
    "y",
    "width",
    "height",
    "relativeTransform",
    "layoutMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "layoutSizingHorizontal",
    "layoutSizingVertical",
    "layoutPositioning",
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
    "strokeWeight",
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
    "reactions",
    ...(textTemplate ? ['textAutoResize', 'fontWeight'] : []),
  ];
  return `// GENERATED independent native source readback. READ ONLY.
const EXPECTED = ${JSON.stringify(expected)};
const FIELDS = ${JSON.stringify(fields)};
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
  const out = [];
  for (const node of nodes) {
    const row = { id: node.id, type: node.type, name: node.name, parentId: node.parent ? node.parent.id : null,
      childIds: node.children ? node.children.map(c => c.id) : [], values: {}, metadata: {} };
    if (typeof node.key === 'string') row.key = node.key;
    const fields = FIELDS.concat(node.layoutMode === 'GRID' ? ${JSON.stringify(NATIVE_GRID_FIELDS)} : [],
      node.parent && node.parent.layoutMode === 'GRID' ? ${JSON.stringify(NATIVE_GRID_CHILD_FIELDS)} : []);
    for (const field of fields) if (field in node) {
      const v = node[field];
      row.values[field] = typeof v === 'symbol' ? { mixed: true } : v === undefined ? null : copy(v);
    }
    if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent.type !== 'COMPONENT_SET'))
      row.definitions = copy(node.componentPropertyDefinitions);
    if (node.type === 'COMPONENT' && node.parent.type === 'COMPONENT_SET') row.variantProperties = copy(node.variantProperties);
    if (node.type === 'INSTANCE') {
      const main = ${synchronous ? "(()=>{throw Error('native-fixed-cross-size-sync-instance-unsupported');})()" : 'await node.getMainComponentAsync()'}; guard();
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
  // Bound the actual UTF-8 payload and leave room for envelope/journal fields.
  let resultBytes = 0;
  for (const char of JSON.stringify(result, null, 2)) {
    const cp = char.codePointAt(0);
    resultBytes += cp <= 127 ? 1 : cp <= 2047 ? 2 : cp <= 65535 ? 3 : 4;
    // The host's pretty-printed envelope indents every nested result line.
    if (cp === 10) resultBytes += 2;
  }
  if (resultBytes > 3 * 1024 * 1024) {
    delete result.nodes; delete result.tokens; delete result.images;
    result.status = 'refused'; throw Error('native-source-readback-result-byte-limit');
  }
} catch (error) { result.problems = [error && error.message ? error.message : 'native-source-readback-api-failed']; }
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
  const defs = target.definitions ?? {},
    slotKeys = new Map<string, string>(),
    textKeys = new Map<string, string>();
  for (const [key, def] of Object.entries(defs) as Array<[string, any]>) {
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
  const axes = input.component.unsetVariantAxes?.axes ?? [];
  const draftAxes = new Map<string, Set<string>>();
  if (isContractDraft(input) && input.component.isSet) for (const variant of input.component.variants)
    for (const segment of variant.name.split(', ')) {
      const i = segment.indexOf('='), property = segment.slice(0, i), value = segment.slice(i + 1);
      if (i <= 0) throw Error('native-contract-observation-variant-name');
      if (!draftAxes.has(property)) draftAxes.set(property, new Set());
      draftAxes.get(property)!.add(value);
    }
  const expectedSlots = new Set<string>();
  const expectedTexts = new Map<string, string>();
  const collect = (s: NodeSpec) => {
    if (s.type === "slot" && s.callerSlotProperty === undefined) expectedSlots.add(s.slotProperty!);
    if (isContractDraft(input) && s.contentProp !== undefined) {
      if (s.type !== 'text' || typeof s.characters !== 'string' ||
          (expectedTexts.has(s.contentProp) && expectedTexts.get(s.contentProp) !== s.characters))
        throw Error('native-contract-observation-text-mapping');
      expectedTexts.set(s.contentProp, s.characters!);
    }
    (s.children ?? []).forEach(collect);
  };
  input.component.variants.forEach((v) => collect(v.spec));
  if (
    !same([...slotKeys.keys()].sort(), [...expectedSlots].sort()) ||
    !same([...textKeys.keys()].sort(), [...expectedTexts.keys()].sort()) ||
    Object.keys(defs).length !== expectedSlots.size + expectedTexts.size + (isContractDraft(input) ? draftAxes.size : axes.length)
  )
    issue("native-source-observation-property-inventory");
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
      if (input.component[key] ? !same(meta(target, key), input.component[key]) : !!target.metadata[key])
        issue(`native-contract-observation-${key}`);
    }
  }
  const checked = new Set<string>();
  const paint = (actual: any, expected: any) =>
    object(actual) &&
    object(expected) &&
    ["r", "g", "b"].every((k) => numeric(actual[k], expected[k]));
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
            )[spec.type] ?? (spec.type === 'shape' ? spec.shape?.kind === 'rect' ? 'RECTANGLE' : spec.shape?.kind === 'ellipse' ? 'ELLIPSE' : undefined : undefined);
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
      if (!same(v.componentPropertyReferences ?? {}, references))
        issue('native-contract-observation-property-references', n);
      if ((n.metadata.callerContentProperty ?? '') !== (spec.callerContentProp ?? ''))
        issue('native-contract-observation-caller-content-property', n);
    }
    if (isContractDraft(input) && spec.type === 'instance') {
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
      const descendants: Record<string, any>[] = [];
      const descend = (row: Record<string, any>) => {
        for (const id of row.childIds) { const child = nodes.get(id); if (child) {
          descendants.push(child);
          if (!child.metadata.nativeContractPart) descend(child);
        } }
      };
      descend(n);
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
        const walk = (row: Record<string, any>) => { for (const id of row.childIds) {
          const child = nodes.get(id); if (!child || seen.has(id)) continue; seen.add(id);
          const key = child.type === 'SLOT' ? child.values.componentPropertyReferences?.slotContentId : undefined;
          if (typeof key === 'string') { if (found.has(key)) issue('native-contract-observation-inherited-slot', child); found.set(key, child); if (stopAt.has(key)) continue; }
          walk(child);
        } };
        if (root) walk(root);
        return found;
      };
      const mainRow = nodes.get(n.mainId), mainSlots = slotsOf(mainRow, new Set());
      for (const [key, slot] of slotsOf(n, filledKeys)) {
        if (filledKeys.has(key)) continue;
        const mainSlot = mainSlots.get(key);
        if (!mainRow || !mainSlot) { issue('native-contract-observation-inherited-slot', slot); continue; }
        if (slot.childIds.length !== mainSlot.childIds.length || slot.childIds.some((id: string, index: number) => {
          const child = nodes.get(id), mainChild = nodes.get(mainSlot.childIds[index]);
          return !child || !mainChild || child.type !== mainChild.type || child.metadata.nativeSourceAllocation !== mainChild.id;
        })) issue('native-contract-observation-inherited-slot-content', slot);
      }
      for (const slotSpec of spec.children ?? []) {
        const key = depTarget && Object.entries(depTarget.definitions ?? {}).filter(([candidate, definition]: [string, any]) =>
          definition.type === 'SLOT' && (candidate === slotSpec.callerSlotProperty || candidate.startsWith(slotSpec.callerSlotProperty + '#'))).map(([candidate]) => candidate);
        const slots = key?.length === 1 ? descendants.filter(row => row.type === 'SLOT' && row.values.componentPropertyReferences?.slotContentId === key[0]) : [];
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
      (wrapper ? wrapper.visible : !spec.slotTextTemplate && spec.nativeSourceVisible !== false)
    )
      issue("native-source-observation-visibility", n);
    if (
      spec.layout &&
      (v.layoutMode !== spec.layout.mode ||
        (spec.layout.mode !== 'GRID' && (v.primaryAxisAlignItems !== spec.layout.primary ||
        v.counterAxisAlignItems !== spec.layout.counter)))
    )
      issue("native-source-observation-layout", n);
    for (const problem of nativeGridProblems(spec, v, n.childIds.map((id: string) => nodes.get(id)?.values)))
      issue('native-source-observation-grid-' + problem, n);
    if (spec.rootFillWidth && (v.layoutSizingHorizontal !== 'FIXED' ||
        (v.layoutMode === 'HORIZONTAL' ? v.primaryAxisSizingMode : v.counterAxisSizingMode) !== 'FIXED' ||
        nodes.get(n.childIds[(spec.children??[]).findIndex(child=>!child.backgroundPaint)])?.values.layoutSizingHorizontal !== 'FILL'))
      issue('native-source-observation-root-fill-width', n);
    if ((spec.opacity !== undefined || v.opacity !== undefined) && !numeric(v.opacity, spec.opacity ?? 1))
      issue("native-source-observation-opacity", n);
    const bindings = {
      ...spec.bindings,
      ...(isContractDraft(input) && spec.fontSizeVar ? { fontSize: spec.fontSizeVar } : {}),
      ...(isContractDraft(input) && spec.slotTextTemplate && spec.fontWeightVar ? { fontWeight: spec.fontWeightVar } : {}),
      ...(isContractDraft(input) && spec.slotTextTemplate && spec.lineHeightVar ? { lineHeight: spec.lineHeightVar } : {}),
      ...(spec.fixedWidth ? { width: spec.fixedWidth.varName } : {}),
      ...(spec.fixedHeight?.varName
        ? { height: spec.fixedHeight.varName }
        : {}),
    };
    const observedBindings = { ...v.boundVariables };
    if (isContractDraft(input) && spec.type === 'text' && Array.isArray(observedBindings.fontSize) && observedBindings.fontSize.length === 1)
      observedBindings.fontSize = observedBindings.fontSize[0];
    if (isContractDraft(input) && spec.slotTextTemplate && Array.isArray(observedBindings.fontWeight) && observedBindings.fontWeight.length === 1)
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
    for (const field of ["fill", "stroke"] as const) {
      const name = spec[field],
        paints = v[field === "fill" ? "fills" : "strokes"] ?? [];
      if (name) {
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
      } else if (field==='fill'&&spec.backgroundPaint&&spec.lits?.fillColor) {
        if(paints.length!==1 || paints[0].type!=='SOLID' || !paint(paints[0].color,spec.lits.fillColor) ||
           !numeric(paints[0].opacity??1,spec.lits.fillColor.a??1) || Object.keys(paints[0].boundVariables??{}).length)
          issue('native-contract-observation-background-paint',n);
      } else if (spec.type !== "text" && paints.length)
        issue(`native-source-observation-extra-${field}`, n);
    }
    if (!nativeShadowStackMatches(spec, v.effects))
      issue("native-source-observation-effects", n);
    if (spec.gradient) issue("native-source-observation-gradient-unverified", n);
    for (const field of ["width", "height"] as const)
      if (
        spec.lits?.[field] !== undefined &&
        !numeric(v[field], spec.lits[field]!)
      )
        issue(`native-source-observation-${field}`, n);
    if (spec.type !== "svg" && v.reactions?.length)
      issue("native-source-observation-reactions", n);
    if (spec.layout && v.clipsContent !== (spec.clipsContent === true))
      issue("native-source-observation-clipping", n);
    if (spec.type === "text") {
      if (spec.slotTextTemplate) {
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
          issue('native-source-observation-text-template-weight', n);
      }
      if (spec.slotTextTemplate && (v.textAutoResize !== 'WIDTH_AND_HEIGHT' ||
          !same(v.letterSpacing, { unit: 'PIXELS', value: spec.letterSpacing ?? 0 })))
        issue('native-source-observation-text-template-sizing', n);
      if (
        v.characters !== spec.characters ||
        v.fontName?.family !== spec.fontFamily ||
        ![spec.fontStyle, spec.fontStyle?.split(" ").join("")].includes(
          v.fontName?.style,
        ) ||
        !numeric(v.fontSize, spec.fontSize!)
      )
        issue("native-source-observation-text", n);
      if (
        v.textCase !== (spec.textCase ?? "ORIGINAL") ||
        v.textDecoration !== (spec.textDecoration ?? "NONE")
      )
        issue("native-source-observation-text-decoration", n);
      if (
        !same(v.lineHeight, spec.lineHeight ?? (isContractDraft(input) ? { unit: 'AUTO' } : undefined)) ||
        (spec.textAlignH && v.textAlignHorizontal !== spec.textAlignH)
      )
        issue("native-source-observation-typography", n);
      if (isContractDraft(input) && spec.textFill) {
        if (!variableByName.has(spec.textFill) || v.fills?.length !== 1 || v.fills[0].type !== 'SOLID' ||
            v.fills[0].visible === false || !same(v.fills[0].boundVariables?.color,
              { type: 'VARIABLE_ALIAS', id: variableByName.get(spec.textFill) }))
          issue('native-source-observation-text-paint', n);
      } else if (
        v.fills?.length !== 1 ||
        !paint(v.fills[0].color, spec.textFillLit) ||
        !numeric(v.fills[0].opacity ?? 1, spec.textFillLit?.a ?? 1) ||
        Object.keys(v.fills[0].boundVariables ?? {}).length
      )
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
      if (isContractDraft(input) && input.absoluteShapeReadback?.nodeIds.includes(n.id) &&
          (!same(v.constraints,{horizontal:'MIN',vertical:'MIN'}) ||
           input.absoluteShapeReadback.version >= 2 && v.targetAspectRatio !== null ||
           v.layoutSizingHorizontal !== 'FIXED' || v.layoutSizingVertical !== 'FIXED' ||
           !['rect','ellipse'].includes(spec.shape!.kind) || spec.absolute?.h !== 'MIN' || spec.absolute?.v !== 'MIN'))
        issue('native-absolute-shape-observation-constraints',n);
      const width=background?Math.max(0.01,(parent?.values.width??NaN)-2*background.inset):spec.shape!.width;
      const height=background?Math.max(0.01,(parent?.values.height??NaN)-2*background.inset):spec.shape!.height;
      if (!numeric(v.width, width) || !numeric(v.height, height))
        issue('native-contract-observation-shape-size', n);
      if(background&&(!numeric(v.cornerRadius,background.radius)||
          !numeric(background.radius,Math.max(0,(parent?.values.cornerRadius??NaN)-background.inset))||
          !same(v.constraints,{horizontal:'STRETCH',vertical:'STRETCH'})||parent?.childIds[0]!==n.id))
        issue('native-contract-observation-background-geometry',n);
      if (spec.absolute && (v.layoutPositioning !== 'ABSOLUTE' || !positionedAs(v.x, spec.absolute.left!, parent?.values.width, v.width) ||
          !positionedAs(v.y, spec.absolute.top!, parent?.values.height, v.height)))
        issue('native-contract-observation-shape-position', n);
    }
    if (spec.type === "slot") {
      if (spec.children?.some(child => child.slotTextTemplate) &&
          ((v.layoutSizingHorizontal === 'HUG' && v.width !== 0) ||
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
      const specs = isContractDraft(input) ? spec.children ?? [] : sourceSample?.specs ?? [];
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
    if (n.childIds.length !== (spec.children ?? []).length)
      issue("native-source-observation-topology", n);
    (spec.children ?? []).forEach((child, i) =>
      visit(
        child,
        nodes.get(n.childIds[i]),
        sourceCase,
        sample ? { ...sample, specPath: [...sample.specPath, i] } : undefined,
      ),
    );
  };
  if (
    c.variants.length !== input.component.variants.length ||
    (input.component.isSet && !same(
      target.childIds,
      c.variants.map((v: any) => v.id),
    ))
  )
    issue("native-source-observation-variant-inventory");
  const mainIds = new Map<string, string>();
  input.component.variants.forEach((variant, i) => {
    const born = c.variants[i],
      node = born && nodes.get(born.id);
    if (!node || (input.component.isSet && node.name !== variant.name) || node.key !== born.key ||
        (!input.component.isSet && (c.variants.length !== 1 || node.id !== target.id)))
      issue("native-source-observation-variant-identity", node);
    if (
      input.component.isSet && node &&
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
  if (isContractDraft(input)) return report();
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
    const variant = input.component.variants.find((v) => v.name === name),
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
  return report();
}
