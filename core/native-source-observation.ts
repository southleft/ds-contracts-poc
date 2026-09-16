/** Independent native observation. Creation acknowledgements supply IDs only;
 * expected semantics come from the saved host-authenticated source plan. */
import { resolveNativeSlotIdentities } from "./native-slot-identity.js";
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import type { ComponentData, NodeSpec } from "./emit-figma-script.js";
import type { NativeSourceCandidateProjection } from "./native-source-projection.js";
import type { NativeContractDraftProjection } from "./native-contract-draft.js";
import type { NativeSourceComparisonInput } from "./native-source-comparisons.js";
import { emitNativeTokenContextReadbackScript } from "./token-set.js";
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
  images?: Array<{ caseId: string; nodeId: string; pngBase64: string }>;
  problems: string[];
}
export interface NativeContractObservationInput extends Omit<NativeSourceObservationInput, 'projection' | 'samples'> {
  projection: NativeContractDraftProjection;
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
function shadowsMatch(spec: NodeSpec, effects: unknown): boolean {
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
export function emitNativeContractReadbackScript(input: NativeContractObservationInput, captureImages = false): string {
  return emitNativeInspectionReadbackScript(input, captureImages);
}
export function emitNativeInspectionReadbackScript(input: NativeInspectionInput, captureImages = false): string {
  checkInput(input);
  const expected = {
    operation: input.operation,
    planRevision: input.planRevision,
    pageId: input.creation.pageId,
    nodes: input.creation.nodes,
    comparisons: nativeInspectionExports(input),
  };
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
async function tokenRead() { return await (async () => {
${emitNativeTokenContextReadbackScript(input.tokenInput, input.tokenIdentity)}
})(); }
async function read(page) {
  const nodes = [page, ...page.findAll(() => true)];
  if (nodes.length > 10000) throw Error('native-source-readback-scope-too-large');
  const out = [];
  for (const node of nodes) {
    const row = { id: node.id, type: node.type, name: node.name, parentId: node.parent ? node.parent.id : null,
      childIds: node.children ? node.children.map(c => c.id) : [], values: {}, metadata: {} };
    if (typeof node.key === 'string') row.key = node.key;
    for (const field of FIELDS) if (field in node) {
      const v = node[field];
      row.values[field] = typeof v === 'symbol' ? { mixed: true } : v === undefined ? null : copy(v);
    }
    if (node.type === 'COMPONENT_SET' || (node.type === 'COMPONENT' && node.parent.type !== 'COMPONENT_SET'))
      row.definitions = copy(node.componentPropertyDefinitions);
    if (node.type === 'COMPONENT' && node.parent.type === 'COMPONENT_SET') row.variantProperties = copy(node.variantProperties);
    if (node.type === 'INSTANCE') {
      const main = await node.getMainComponentAsync(); guard();
      row.mainId = main ? main.id : null;
      row.componentProperties = copy(node.componentProperties);
    }
    for (const key of ['nativeSourceOperation', 'nativeSourceAllocation', 'nativeSourcePart', 'nativeSourceSample', 'nativeSourceCase', 'contractId', 'specHash', 'canvasFingerprint'${isContractDraft(input) ? ", 'nativeContractPart', 'rootSlot', 'codeValueAxes', 'unsetVariantAxes', 'semantics', 'propNames'" : ''}])
      row.metadata[key] = node.getSharedPluginData('ds_contracts', key);
    out.push(row);
  }
  return out;
}
try {
  guard();
  await figma.loadAllPagesAsync(); guard();
  const page = await figma.getNodeByIdAsync(EXPECTED.pageId); guard();
  if (!page || page.type !== 'PAGE' || page.id !== EXPECTED.pageId) throw Error('native-source-readback-page-missing');
  const firstTokens = await tokenRead(), first = await read(page);
  const images = []; let imageBytes = 0;
  ${
    captureImages
      ? `for (const c of EXPECTED.comparisons) {
    const node = await figma.getNodeByIdAsync(c.instanceId); guard();
    if (!node || node.type !== c.type || typeof node.exportAsync !== 'function' || typeof figma.base64Encode !== 'function')
      throw Error('native-source-readback-export-unavailable');
    const png = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 1 } }); guard();
    if (!png || !png.length) throw Error('native-source-readback-export-invalid');
    imageBytes += png.length;
    if (imageBytes > 1024 * 1024) throw Error('native-source-readback-image-byte-limit');
    images.push({ caseId: c.id, nodeId: c.instanceId, pngBase64: figma.base64Encode(png) });
  }`
      : ""
  }
  // Async native reads and exports are not an atomic snapshot. Refuse changes
  // across the observation window instead of combining two different states.
  const second = await read(page), secondTokens = await tokenRead(); guard();
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
  // Empty draft mains have exact allocation IDs. Only recorded comparison
  // slot descendants may use the source workflow's clone-identity bridge.
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
  if (
    !same(rows.map((n) => n.id).sort(), c.nodes.map((n: any) => n.id).sort())
  ) {
    problems.push("native-source-observation-node-inventory");
    return report();
  }
  const nodes = new Map(rows.map((n) => [n.id, n]));
  const issue = (code: string, node?: Record<string, any>) =>
    problems.push(`${code}${node ? `:${node.id}` : ""}`);
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
    if (n.type !== born.type || (born.key && n.key !== born.key))
      issue("native-source-observation-node-identity", n);
    if (!same(meta(n, "nativeSourceOperation"), owner))
      issue("native-source-observation-ownership", n);
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
  if (
    page.type !== "PAGE" ||
    !same([...page.childIds].sort(), [target.id, ...(board ? [board.id] : [])].sort()) ||
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
  const defs = target.definitions ?? {},
    slotKeys = new Map<string, string>();
  for (const [key, def] of Object.entries(defs) as Array<[string, any]>) {
    if (def.type === "SLOT") {
      const display = key.slice(0, key.lastIndexOf("#"));
      if (!key.includes("#") || slotKeys.has(display))
        issue("native-source-observation-slot-property-ambiguous");
      slotKeys.set(display, key);
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
  const collect = (s: NodeSpec) => {
    if (s.type === "slot") expectedSlots.add(s.slotProperty!);
    (s.children ?? []).forEach(collect);
  };
  input.component.variants.forEach((v) => collect(v.spec));
  if (
    !same([...slotKeys.keys()].sort(), [...expectedSlots].sort()) ||
    Object.keys(defs).length !== expectedSlots.size + (isContractDraft(input) ? draftAxes.size : axes.length)
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
              } as Record<string, string>
            )[spec.type];
    if (!expectedType || n.type !== expectedType)
      issue("native-source-observation-node-type", n);
    if (!same(v.explicitVariableModes, mode))
      issue("native-source-observation-mode", n);
    if (!sample && !same(meta(n, isContractDraft(input) ? 'nativeContractPart' : 'nativeSourcePart'),
      isContractDraft(input) ? spec.nativeContractPart : spec.nativeSourcePart))
      issue("native-source-observation-source-part", n);
    if (sample && !same(meta(n, "nativeSourceSample"), sample))
      issue("native-source-observation-sample-identity", n);
    const wrapper = sourceCase?.wrappers?.find((w) =>
      same(w.partPath, spec.nativeSourcePart?.partPath),
    );
    if (
      v.visible !==
      (wrapper ? wrapper.visible : spec.nativeSourceVisible !== false)
    )
      issue("native-source-observation-visibility", n);
    if (
      spec.layout &&
      (v.layoutMode !== spec.layout.mode ||
        v.primaryAxisAlignItems !== spec.layout.primary ||
        v.counterAxisAlignItems !== spec.layout.counter)
    )
      issue("native-source-observation-layout", n);
    if (v.opacity !== undefined && v.opacity !== (spec.opacity ?? 1))
      issue("native-source-observation-opacity", n);
    const bindings = {
      ...spec.bindings,
      ...(spec.fixedWidth ? { width: spec.fixedWidth.varName } : {}),
      ...(spec.fixedHeight?.varName
        ? { height: spec.fixedHeight.varName }
        : {}),
    };
    if (
      Object.entries(v.boundVariables ?? {}).some(
        ([field, value]) =>
          !["fills", "strokes"].includes(field) &&
          (!object(value) || value.type !== "VARIABLE_ALIAS"),
      )
    )
      issue("native-source-observation-extra-bindings", n);
    const actualBindings = Object.fromEntries(
      Object.entries(v.boundVariables ?? {}).filter(
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
      } else if (spec.type !== "text" && paints.length)
        issue(`native-source-observation-extra-${field}`, n);
    }
    if (!shadowsMatch(spec, v.effects))
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
        !same(v.lineHeight, spec.lineHeight) ||
        (spec.textAlignH && v.textAlignHorizontal !== spec.textAlignH)
      )
        issue("native-source-observation-typography", n);
      if (
        v.fills?.length !== 1 ||
        !paint(v.fills[0].color, spec.textFillLit) ||
        (v.fills[0].opacity ?? 1) !== (spec.textFillLit?.a ?? 1) ||
        Object.keys(v.fills[0].boundVariables ?? {}).length
      )
        issue("native-source-observation-text-paint", n);
    }
    if (spec.type === "svg") {
      if (
        !numeric(v.width, spec.iconSize!) ||
        !numeric(v.height, spec.iconSize!)
      )
        issue("native-source-observation-svg-size", n);
      return; // SVG descendants are inventoried/owned; path equivalence requires visual/vector verification.
    }
    if (spec.type === "slot") {
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
      const specs = sourceSample?.specs ?? [];
      if (n.childIds.length !== specs.length)
        issue("native-source-observation-slot-content", n);
      specs.forEach((child, i) =>
        visit(child, nodes.get(n.childIds[i]), undefined, {
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
