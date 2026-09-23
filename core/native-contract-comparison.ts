import { materializeFlowRows } from './grid-flow-rows.js';
import { planNativeRootTextCaller, type NativeRootTextCallerEvidence, type NativeRootTextCaller } from './native-root-text-caller.js';
/** Comparison content belongs to an instance of an independently observed main.
 * No source-template identity is invented and the main is never rewritten. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import type { Contract } from '../scripts/contract-schema.js';
import type { ComponentData, NodeSpec, GridTrackSpec } from './emit-figma-script.js';
import type { NativeContractDraftProjection, NativeContractDraftSource } from './native-contract-draft.js';
import { verifyNativeContractReadback, type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';

export interface NativeContractSampleIdentity {
  caseId: string;
  contentRevision: string;
  /** Compiler path in the observed content; not a reusable anatomy claim. */
  specPath: number[];
  /** Index into the host-verified nested-main list, never a canvas name. */
  instance?: number;
}
export interface NativeContractComparisonReference {
  specPath: number[];
  parent: NativeContractObservationInput;
  receipt: NativeSourceReadback;
  variantName: string;
  slotSpecPath: number[];
  /** Preserve the complete observed main; no caller slot is populated. */
  contentMode?: 'source-owned';
}
export interface NativeContractComparisonInput {
  parent: NativeContractObservationInput;
  receipt: NativeSourceReadback;
  /** Host-authenticated current source after a verified root correction.
   * The retained main keeps its historical source projection. This proof is
   * re-derived by the host; it is never accepted from a caller HTTP payload. */
  sourceSuccession?: {
    proposalId: string;
    observationRevision: string;
    source: NativeContractDraftSource;
  };
  caseId: string;
  variantName: string;
  slotSpecPath: number[];
  /** Re-derived by the host from authenticated direct DOM text, never inferred from equal paint. */
  rootText?: NativeRootTextCallerEvidence;
  /** Authenticated width of this caller usage, never a reusable main size. */
  instanceWidth?: number;
  /** Observed content width of the containing block a fill-width root took in
   * the original render. It sizes the app-owned frame (the caller's place);
   * the instance stays FILL and neither the main nor its contract learns it. */
  containerWidth?: number;
  /** Host-selected source ownership mappings; never inferred by component name or paint. */
  instances?: NativeContractComparisonReference[];
}
export function comparisonContentGrid(spec: NodeSpec, children: NodeSpec[]): NodeSpec {
  const result = structuredClone(spec);
  result.children = children;
  const grid = result.layout?.grid;
  if (grid?.flowRows) grid.rows = materializeFlowRows(grid.flowRows, grid.columns.length, children.length);
  return result;
}

export function prepareNativeContractComparison(contract: Contract, component: ComponentData,
  source: NativeContractDraftSource, tokenRevision: string, context: { mode: string; brand: string },
  input: NativeContractComparisonInput, sourceTokens?: Record<string, unknown>) {
  const fail = (code: string): never => { throw Error('native-contract-comparison-' + code); };
  const revision = /^sha256:[a-f0-9]{64}$/;
  const succession = input.sourceSuccession;
  if (succession !== undefined) {
    const receipt = structuredClone(input.receipt); delete receipt.images;
    if (!succession || Object.keys(succession).sort().join(',') !== 'observationRevision,proposalId,source' ||
        typeof succession.proposalId !== 'string' || !/^[a-f0-9]{64}$/.test(succession.proposalId) ||
        succession.observationRevision !== revisionOf({ input: input.parent, receipt }) ||
        canonicalJson(succession.source) !== canonicalJson(source) ||
        !input.parent.component.rootSlot ||
        (input.parent.templateGraph || input.parent.projection.rootTextTemplate
          ? !input.parent.templateGraph || !input.parent.projection.rootTextTemplate || !input.rootText || !!input.instances?.length
          : !!input.rootText))
      fail('source-succession-unverified');
  }
  if (!revision.test(source.revision) || !revision.test(source.evidenceRevision) ||
      !/^[a-f0-9]{64}$/.test(source.programSha256) || !revision.test(tokenRevision) ||
      (!succession && (source.revision !== input.parent.projection.source.revision || source.programSha256 !== input.parent.projection.source.programSha256)) ||
      context.mode !== input.parent.projection.context.mode || context.brand !== input.parent.projection.context.brand)
    fail('source-changed');
  if (!input.caseId || input.caseId.length > 160 || verifyNativeContractReadback(input.parent, input.receipt).status !== 'supported-structure-observed')
    fail('parent-observation-required');
  if (contract.status !== 'draft' || contract.props.length || contract.states.length || contract.bindings.code.runtime ||
      contract.bindings.figma.anchors.componentSetKey || component.variants.length !== 1 || component.stateVariants?.length ||
      component.boolProps.length || component.textProps.length || component.nativeSourceCandidate || component.nativeContractDraft)
    fail('snapshot-contract-required');
  const select = (input: Omit<NativeContractComparisonInput, 'caseId'> & { contentMode?: 'source-owned' }): {
    mainId: string; fillWidth?: true; contentSpecPath?: number[]; textTemplate?: NativeRootTextCaller;
  } => {
    const variants = input.parent.component.variants.filter(v => v.name === input.variantName);
    const mains = input.parent.creation.variants.filter((v: { name: string }) => v.name === input.variantName);
    if (variants.length !== 1 || mains.length !== 1) fail('main-ambiguous');
    if (input.contentMode === 'source-owned') {
      const hasSlot = (spec: NodeSpec): boolean => spec.type === 'slot' || !!spec.children?.some(hasSlot);
      if (input.slotSpecPath.length || input.parent.component.rootSlot || hasSlot(variants[0].spec) ||
          variants[0].spec.rootFillWidth) fail('source-owned-main-unqualified');
      return { mainId: mains[0].id as string };
    }
    let slot = variants[0].spec;
    if (!Array.isArray(input.slotSpecPath) || input.slotSpecPath.length > 32) fail('slot-path-invalid');
    for (const index of input.slotSpecPath) {
      if (!Number.isInteger(index) || index < 0 || !slot.children?.[index]) fail('slot-path-invalid');
      slot = slot.children![index];
    }
    if (slot.type !== 'slot' || slot.slotDefault?.length) fail('empty-slot-required');
    const carrier = slot.children?.[0];
    if (carrier?.slotTextTemplate) {
      if (!input.rootText || input.instances?.length || input.slotSpecPath.join(',') !== '0' ||
          slot.children?.length !== 1 || !slot.rootSlotContent) fail('text-template-caller-mode-projection-required');
      const children = component.variants[0].spec.children?.filter(child => !child.backgroundPaint) ?? [];
      return { mainId: mains[0].id as string, ...(variants[0].spec.rootFillWidth ? { fillWidth: true as const } : {}),
        textTemplate: planNativeRootTextCaller(input.parent, input.variantName, revisionOf(contract), tokenRevision,
          sourceTokens, input.rootText, children) };
    }
    if (input.rootText) fail('text-template-evidence-without-template');
    if (slot.children?.length && (slot.children.length !== 1 || !slot.rootSlotContent ||
        !carrier?.rootSlotGridContent || carrier.type !== 'frame' || carrier.layout?.mode !== 'GRID' ||
        carrier.layout.grid?.flow !== 'ROW_AUTO_FLOW' || carrier.children?.length)) fail('empty-slot-required');
    return { mainId: mains[0].id as string,
      ...(variants[0].spec.rootFillWidth ? { fillWidth: true as const } : {}),
      ...(carrier ? { contentSpecPath: [...input.slotSpecPath, 0] } : {}) };

  };
  const selected = select(input);
  // A fill-width root has no width of its own. `instanceWidth` would pin the
  // INSTANCE as FIXED, contradicting its main; only a parent can supply it.
  if (selected.fillWidth && input.containerWidth === undefined) fail('root-fill-width-needs-parent-context');
  if (input.containerWidth !== undefined) {
    const root = input.parent.component.variants.find(v => v.name === input.variantName)!.spec;
    // Figma's resize throws below 0.01, and it would throw AFTER allocation.
    // (A max-width has no literal spelling on a spec: only the binding and the
    // measured hug-ceiling fact below can carry one.)
    if (!selected.fillWidth || input.instanceWidth !== undefined || !Number.isFinite(input.containerWidth) ||
        input.containerWidth < 0.01 || input.containerWidth > 100000 || !['VERTICAL', 'GRID'].includes(root.layout?.mode ?? '') ||
        root.fixedWidth || root.hugCeiling || root.lits?.width !== undefined || root.lits?.minWidth !== undefined ||
        ['width','minWidth','maxWidth'].some(k => root.bindings?.[k])) fail('container-width-unqualified');
  }
  if (input.instanceWidth !== undefined) {
    const root = input.parent.component.variants.find(v => v.name === input.variantName)!.spec;
    let slot = root;
    for (const index of input.slotSpecPath) slot = slot.children![index];
    if (!Number.isFinite(input.instanceWidth) || input.instanceWidth <= 0 || input.instanceWidth > 100000 ||
        root.layout?.mode !== 'VERTICAL' || !root.layout.stretchChildren || root.fixedWidth ||
        root.lits?.width !== undefined || root.lits?.minWidth !== undefined ||
        ['width','minWidth','maxWidth'].some(k => root.bindings?.[k]) ||
        !slot.rootSlotContent || slot.layout?.mode !== 'VERTICAL' || !slot.layout.stretchChildren ||
        slot.fixedWidth || slot.lits?.width !== undefined || slot.lits?.minWidth !== undefined ||
        ['width','minWidth','maxWidth'].some(k=>slot.bindings?.[k]) ||
        input.slotSpecPath.length !== 1 || selected.contentSpecPath)
      fail('instance-width-unqualified');
  }
  if ((input.instances?.length ?? 0) > 128) fail('nested-main-limit');
  const instances = (input.instances ?? []).map(reference => {
    if (reference.parent.operation.fileKey !== input.parent.operation.fileKey ||
        reference.parent.projection.context.mode !== context.mode || reference.parent.projection.context.brand !== context.brand ||
        reference.parent.projection.source.revision !== source.revision ||
        reference.parent.projection.source.programSha256 !== source.programSha256 ||
        !Array.isArray(reference.specPath) || !reference.specPath.length || reference.specPath.length > 32 ||
        reference.specPath.some(i => !Number.isInteger(i) || i < 0) ||
        verifyNativeContractReadback(reference.parent, reference.receipt).status !== 'supported-structure-observed')
      fail('nested-main-observation-required');
    const receipt = structuredClone(reference.receipt); delete receipt.images;
    return { ...structuredClone(reference), receipt, ...select(reference), contentRows: undefined as GridTrackSpec[] | undefined };
  });
  if (new Set(instances.map(i => JSON.stringify(i.specPath))).size !== instances.length)
    fail('nested-main-path-ambiguous');
  const used = new Set<number>();
  const compiledRoot = component.variants[0].spec;
  if (compiledRoot.type !== 'root' || !compiledRoot.children?.length) fail('content-missing');
  // Linked roots inherit their paint from independently read mains. Remove
  // compiler paint layers from caller content at every linked boundary, and
  // translate descendant paths through those removals before joining them.
  // Unlinked frames retain their complete content and normal admission checks.
  const callerPaths = new Map<string, number[]>();
  let callerCount = 0;
  const callerTree = (spec: NodeSpec, sourcePath: number[], callerPath: number[]): NodeSpec => {
    if (++callerCount > 4096 || sourcePath.length > 32) fail('content-allocation-ownership-unqualified');
    callerPaths.set(JSON.stringify(sourcePath), callerPath);
    const reference = instances.find(ref => JSON.stringify(ref.specPath) === JSON.stringify(sourcePath));
    const inherited = !sourcePath.length || !!reference;
    const out = structuredClone(spec);
    const paint = inherited ? spec.children?.filter(child => child.backgroundPaint) ?? [] : [];
    if (reference && paint.length) {
      const main = reference.parent.component.variants.find(v => v.name === reference.variantName)!.spec;
      const mainPaint = main.children?.[0];
      if (paint.length !== 1 || paint[0] !== spec.children![0] || spec.backgroundClip !== 'padding-box' ||
          main.backgroundClip !== 'padding-box' || !mainPaint?.backgroundPaint ||
          canonicalJson(paint[0].backgroundPaint) !== canonicalJson(mainPaint.backgroundPaint))
        fail('nested-inherited-paint-unqualified');
      // Preserve the logical linked-root fields used by historical content
      // comparisons. Actual paint and bindings are verified on the main.
      delete out.backgroundClip;
      if (paint[0].fill) out.fill = paint[0].fill;
      if (paint[0].lits?.fillColor) out.lits = { ...out.lits, fillColor: paint[0].lits.fillColor };
    }
    if (spec.children) {
      out.children = [];
      spec.children.forEach((child, index) => {
        if (inherited && child.backgroundPaint) return;
        out.children!.push(callerTree(child, [...sourcePath, index], [...callerPath, out.children!.length]));
      });
    }
    return out;
  };
  const root = callerTree(compiledRoot, [], []);
  for (const reference of instances) {
    const callerPath = callerPaths.get(JSON.stringify(reference.specPath));
    if (!callerPath) fail('nested-main-path-missing');
    reference.specPath = [...callerPath!];
  }
  const rootContent = root.children!;
  if(!rootContent.length)fail('content-missing');
  const projection: NativeContractDraftProjection = { version: 1, kind: 'contract-draft', purpose: 'source-candidate-inspection',
    acceptedContract: null, nativeQualification: 'unqualified', contractId: contract.id, contractRevision: revisionOf(contract),
    tokenRevision, source: structuredClone(source), context: { ...context } };
  const boundNames = new Set<string>(), fonts = new Map<string, { family: string; styles: string[] }>();
  const nodeTypes = new Set<string>(); let count = 0;
  const annotate = (spec: NodeSpec, specPath: number[]): NodeSpec => {
    if (++count > 4096 || specPath.length > 32 || !['frame', 'text', 'svg'].includes(spec.type) ||
        spec.slotDefault?.length || spec.visibleProp || spec.slotOptional || spec.margins || spec.insetOverlay ||
        spec.nativeSourcePart || spec.nativeSourceSample || spec.nativeContractPart || spec.nativeContractSample ||
        spec.nativeSourceVisible !== undefined || spec.contentProp || spec.textStyle ||
        (spec.type !== 'frame' && spec.children?.length) ||
        (spec.type === 'text' && (spec.fill || spec.fixedWidth || spec.fixedHeight || spec.bindings)))
      fail('content-allocation-ownership-unqualified');
    if (spec.type === 'text') {
      if (typeof spec.characters !== 'string' || !spec.fontFamily || !spec.fontStyle || !Number.isFinite(spec.fontSize)) fail('text-expectation-missing');
      fonts.set('Inter/' + spec.fontStyle, { family: 'Inter', styles: [spec.fontStyle!] });
      fonts.set(spec.fontFamily + '/' + spec.fontStyle, { family: spec.fontFamily!, styles: [...new Set([spec.fontStyle!, spec.fontStyle!.replaceAll(' ', '')])] });
    }
    for (const name of Object.values(spec.bindings ?? {})) boundNames.add(name);
    for (const name of [spec.fill, spec.stroke, spec.fixedWidth?.varName, spec.fixedHeight?.varName,
      spec.textFill, spec.fontSizeVar, spec.fontWeightVar, spec.lineHeightVar, spec.svgPaintVar]) if (name) boundNames.add(name);
    nodeTypes.add(spec.type);
    const out = structuredClone(spec);
    const instance = instances.findIndex(ref => JSON.stringify(ref.specPath) === JSON.stringify(specPath));
    if (instance !== -1) {
      if (spec.type !== 'frame' || (!spec.children?.length && instances[instance].contentMode !== 'source-owned')) fail('nested-caller-content-required');
      used.add(instance);
    }
    out.nativeContractSample = { caseId: input.caseId, contentRevision: revisionOf(contract), specPath, ...(instance !== -1 ? { instance } : {}) };
    if (instance !== -1 && instances[instance].contentMode === 'source-owned') { delete out.children; return out; }
    if (spec.children) out.children = spec.children.map((child, i) => annotate(child, [...specPath, i]));
    return out;
  };
  const checkCapacity = (reference: { parent: NativeContractObservationInput; variantName: string; contentSpecPath?: number[] }, children: NodeSpec[]) => {
    // An observed text run has one native text node. Native vertical flow is
    // not CSS inline formatting: mixed inline/block children need a separate
    // lowering before they can enter a block root comparison.
    if (reference.parent.component.rootSlot?.display === 'block' &&
        (children.length !== 1 || children[0].type !== 'text' || children[0].absolute || children[0].overlay))
      fail('block-inline-content-unqualified');
    if (!reference.contentSpecPath) return;
    let target = reference.parent.component.variants.find(v => v.name === reference.variantName)!.spec;
    for (const index of reference.contentSpecPath) target = target.children![index];
    const grid = comparisonContentGrid(target, children).layout!.grid!;
    // Source grid lowering can retain explicit unit cells even when the
    // reusable carrier uses row flow. Admit only identical placements;
    // spans, alignment overrides and reordered cells need separate support.
    if (children.some((child, index) => child.absolute || child.overlay || child.insetOverlay ||
        (child.cell && (Object.keys(child.cell).sort().join(',') !== 'column,row' ||
          child.cell.row !== Math.floor(index / grid.columns.length) ||
          child.cell.column !== index % grid.columns.length))) ||
        children.length > grid.rows.length * grid.columns.length) fail('grid-content-placement-unqualified');
    return grid.flowRows ? grid.rows : undefined;
  };
  const contentRows = checkCapacity({ ...input, ...selected }, rootContent);
  for (const reference of instances) {
    let spec = root;
    for (const index of reference.specPath) {
      if (!spec.children?.[index]) fail('nested-main-path-missing');
      spec = spec.children![index];
    }
    if (reference.contentMode !== 'source-owned') Object.assign(reference, { contentRows: checkCapacity(reference, spec.children ?? []) });
  }
  const specs = rootContent.map((spec, i) => annotate(spec, [i]));
  if (used.size !== instances.length) fail('nested-main-path-missing');
  // A full-width child needs an independently known containing width. Do
  // not let Figma resolve a HUG/FILL cycle using the main's preview box.
  const fixedWidth = (spec: NodeSpec) => Boolean(spec.fixedWidth) ||
    (typeof spec.lits?.width === 'number' && Number.isFinite(spec.lits.width) && spec.lits.width > 0);
  for (const reference of instances.filter(ref => ref.fillWidth)) {
    const parentPath = reference.specPath.slice(0, -1);
    const hostReference = parentPath.length
      ? instances.find(ref => JSON.stringify(ref.specPath) === JSON.stringify(parentPath))
      : { ...input, ...selected };
    let host: NodeSpec, definite: boolean;
    if (hostReference) {
      const hostRoot = hostReference.parent.component.variants.find(v => v.name === hostReference.variantName)!.spec;
      host = hostRoot;
      for (const index of hostReference.contentSpecPath ?? hostReference.slotSpecPath) host = host.children![index];
      definite = fixedWidth(host) || Boolean(host.rootSlotContent && (hostRoot.rootFillWidth || fixedWidth(hostRoot) ||
        (!parentPath.length && input.instanceWidth !== undefined)));
    } else {
      host = root;
      for (const index of parentPath) host = host.children![index];
      definite = fixedWidth(host);
    }
    if (!definite || !['VERTICAL', 'GRID'].includes(host.layout?.mode ?? ''))
      fail('nested-fill-width-parent-unqualified');
  }
  const receipt = structuredClone(input.receipt); delete receipt.images;
  return { projection, boundNames: [...boundNames].sort(), parent: structuredClone(input.parent), receipt,
    ...(succession ? { sourceSuccession: structuredClone(succession) } : {}),
    caseId: input.caseId, ...selected, ...(contentRows ? { contentRows } : {}), variantName: input.variantName,
    slotSpecPath: [...input.slotSpecPath], ...(input.instanceWidth !== undefined ? {instanceWidth:input.instanceWidth} : {}),
    ...(input.containerWidth !== undefined ? {containerWidth:input.containerWidth} : {}),
    ...(instances.length ? { instances } : {}), specs, fonts: [...fonts.values()], nodeTypes: [...nodeTypes].sort(),
    revision: revisionOf({ contract, component, source, tokenRevision, context, input: { ...input, receipt } }) };
}
export type PreparedNativeContractComparison = ReturnType<typeof prepareNativeContractComparison>;

/** A repeated child main needs one independent read, even when used many
 * times. Deduplicate by the complete pinned evidence, never by display name. */
export function nativeComparisonDependencies(comparison: PreparedNativeContractComparison) {
  const parents: Array<{ parent: NativeContractObservationInput; receipt: NativeSourceReadback }> = [];
  const keys = new Map<string, number>();
  const indices = (comparison.instances ?? []).map(ref => {
    const key = revisionOf({ parent: ref.parent, receipt: ref.receipt });
    let index = keys.get(key);
    if (index === undefined) { index = parents.length; keys.set(key, index); parents.push({ parent: ref.parent, receipt: ref.receipt }); }
    return index;
  });
  return { parents, indices };
}


/** Runs in the shared renderer, using exactly its buildNode/token resolution. */
export const NATIVE_CONTRACT_COMPARISON_RUNTIME = `
async function nativeBuildContractComparison() {
  const c = NATIVE.contractComparison;
  const main = await figma.getNodeByIdAsync(c.mainId); nativeFileGuard();
  if (!main || main.type !== 'COMPONENT') nativeRefuse('comparison-main-unavailable');
  const board = figma.createFrame(); nativeOwn(board); NATIVE_PAGE.appendChild(board);
  NATIVE_RESULT.comparisonBoardId = board.id;
  board.name = 'Observed caller content'; board.fills = []; board.layoutMode = 'VERTICAL'; board.clipsContent = false;
  board.primaryAxisSizingMode = 'AUTO'; board.counterAxisSizingMode = 'AUTO';
  const inst = main.createInstance(); nativeOwn(inst); board.appendChild(inst); inst.name = c.caseId;
  const recorded = { id: c.caseId, status: 'building', instanceId: inst.id, mainId: main.id, sourceParts: [], slots: [] };
  NATIVE_RESULT.comparisons = [recorded];
  const parentCollection = await figma.variables.getVariableCollectionByIdAsync(c.parent.tokenIdentity.collection.id); nativeFileGuard();
  inst.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);
  inst.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
  if ((await inst.getMainComponentAsync()).id !== main.id) nativeRefuse('comparison-main-mismatch');
  const parts = new Map();
  function pair(source, node, path) {
    if ((path.length ? node.type !== source.type : node.type !== 'INSTANCE') ||
        (source.children || []).length !== (node.children || []).length) nativeRefuse('comparison-tree-mismatch');
    if (path.length) {
      nativeOwn(node);
      node.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);
    }
    const identity = JSON.parse(source.getSharedPluginData('ds_contracts', 'nativeContractPart'));
    if (nativeCanonical(identity.specPath) !== nativeCanonical(path)) nativeRefuse('comparison-part-mismatch');
    node.setSharedPluginData('ds_contracts', 'nativeContractPart', JSON.stringify(identity));
    if (node.type === 'SLOT' && node.componentPropertyReferences.slotContentId !== source.componentPropertyReferences.slotContentId)
      nativeRefuse('comparison-slot-property-mismatch');
    parts.set(nativeCanonical(path), node); recorded.sourceParts.push({ specPath: path, nodeId: node.id });
    (source.children || []).forEach((child, i) => pair(child, node.children[i], path.concat(i)));
  }
  pair(main, inst, []);
  const slot = parts.get(nativeCanonical(c.slotSpecPath));
  if (!slot || slot.type !== 'SLOT' || slot.children.length) nativeRefuse('comparison-slot-not-empty');
  const saved = { specPath: c.slotSpecPath, nodeId: slot.id, propertyKey: slot.componentPropertyReferences.slotContentId, contentNodeIds: [] };
  recorded.slots.push(saved);
  for (const spec of c.specs) {
    const node = await buildNode(spec, { texts: [], slots: [], visibles: [] });
    saved.contentNodeIds.push(node.id); slot.appendChild(node);
  }
  inst.setSharedPluginData('ds_contracts', 'nativeContractCase', JSON.stringify({ id: c.caseId, revision: c.revision }));
  dsStampFingerprints(inst);
  recorded.status = 'created-comparison';
  return { comparisonInstanceId: inst.id, parentMainId: main.id, acceptedContract: null, nativeQualification: 'unqualified' };
}
`;

/** Nested instances use the same verified main/slot path as the outer instance.
 * All clones are operation-owned; referenced mains remain independently read. */
export const NATIVE_CONTRACT_NESTED_COMPARISON_RUNTIME = `
async function nativeFillContractInstance(c, specs, container, name, save) {
  const main = await figma.getNodeByIdAsync(c.mainId); nativeFileGuard();
  if (!main || main.type !== 'COMPONENT') nativeRefuse('comparison-main-unavailable');
  const inst = main.createInstance(); nativeOwn(inst); container.appendChild(inst); inst.name = name;
  const recorded = { id: name, status: 'building', instanceId: inst.id, mainId: main.id, sourceParts: [], slots: [] };
  save(recorded);
  const parentCollection = await figma.variables.getVariableCollectionByIdAsync(c.parent.tokenIdentity.collection.id); nativeFileGuard();
  inst.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);
  inst.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
  if ((await inst.getMainComponentAsync()).id !== main.id) nativeRefuse('comparison-main-mismatch');
  const parts = new Map();
  function pair(source, node, path) {
    if ((path.length ? node.type !== source.type : node.type !== 'INSTANCE') ||
        (source.children || []).length !== (node.children || []).length) nativeRefuse('comparison-tree-mismatch');
    if (path.length) {
      nativeOwn(node);
      node.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);
    }
    const identity = JSON.parse(source.getSharedPluginData('ds_contracts', 'nativeContractPart'));
    if (nativeCanonical(identity.specPath) !== nativeCanonical(path)) nativeRefuse('comparison-part-mismatch');
    node.setSharedPluginData('ds_contracts', 'nativeContractPart', JSON.stringify(identity));
    if (node.type === 'SLOT' && node.componentPropertyReferences.slotContentId !== source.componentPropertyReferences.slotContentId)
      nativeRefuse('comparison-slot-property-mismatch');
    parts.set(nativeCanonical(path), node); recorded.sourceParts.push({ specPath: path, nodeId: node.id });
    (source.children || []).forEach((child, i) => pair(child, node.children[i], path.concat(i)));
  }
  pair(main, inst, []);
  const slot = parts.get(nativeCanonical(c.slotSpecPath));
  if (!slot || slot.type !== 'SLOT' || slot.children.length) nativeRefuse('comparison-slot-not-empty');
  const saved = { specPath: c.slotSpecPath, nodeId: slot.id, propertyKey: slot.componentPropertyReferences.slotContentId, contentNodeIds: [] };
  recorded.slots.push(saved);
  for (const spec of specs) {
    const node = await buildNode(spec, { texts: [], slots: [], visibles: [] });
    saved.contentNodeIds.push(node.id); slot.appendChild(node);
  }

  recorded.status = 'created-comparison';
  return inst;
}
async function nativeBuildNestedContractComparison(spec) {
  const c = NATIVE.contractComparison, index = spec.nativeContractSample.instance;
  const reference = c.instances[index];
  if (!reference || nativeCanonical(reference.specPath) !== nativeCanonical(spec.nativeContractSample.specPath))
    nativeRefuse('nested-comparison-reference-missing');
  const node = await nativeFillContractInstance(reference, spec.children || [], NATIVE_PAGE, spec.name, record => {
    record.index = index;
    (NATIVE_RESULT.comparisons[0].nested || (NATIVE_RESULT.comparisons[0].nested = [])).push(record);
  });
  node.setSharedPluginData('ds_contracts', 'nativeContractSample', JSON.stringify(spec.nativeContractSample));
  return node;
}
async function nativeBuildContractComparison() {
  const c = NATIVE.contractComparison;
  const board = figma.createFrame(); nativeOwn(board); NATIVE_PAGE.appendChild(board);
  NATIVE_RESULT.comparisonBoardId = board.id;
  board.name = 'Observed caller content'; board.fills = []; board.layoutMode = 'VERTICAL'; board.clipsContent = false;
  board.primaryAxisSizingMode = 'AUTO'; board.counterAxisSizingMode = 'AUTO';
  const inst = await nativeFillContractInstance(c, c.specs, board, c.caseId, record => { NATIVE_RESULT.comparisons = [record]; });
  inst.setSharedPluginData('ds_contracts', 'nativeContractCase', JSON.stringify({ id: c.caseId, revision: c.revision }));
  dsStampFingerprints(inst);
  return { comparisonInstanceId: inst.id, parentMainId: c.mainId, acceptedContract: null, nativeQualification: 'unqualified' };
}
`;

/** Preserve the existing receipt/script format when no verified grid carrier is
 * involved. Only compiler-owned content frames can become insertion targets. */
export function nativeContractComparisonRuntime(nested: boolean, gridContent: boolean, fillWidth = false, sourceOwned = false, instanceWidth = false, recovery = false, containerWidth = false, textTemplate = false): string {
  let script = nested ? NATIVE_CONTRACT_NESTED_COMPARISON_RUNTIME : NATIVE_CONTRACT_COMPARISON_RUNTIME;
  if (textTemplate) {
    if (nested || gridContent || sourceOwned || recovery) throw Error('native-contract-comparison-text-template-runtime-unqualified');
    const replace = (from: string, to: string) => {
      if (script.split(from).length !== 2) throw Error('native-contract-comparison-text-template-runtime-changed');
      script = script.replace(from, to);
    };
    // The instance inherits the main's selected parent-collection mode. An
    // explicit set on the instance or its children would pin the old variant.
    replace('  inst.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);',
      `  const templateModes = c.textTemplate.modeVector || { [parentCollection.id]: c.textTemplate.modeId };
  if (nativeCanonical(inst.explicitVariableModes) !== nativeCanonical(templateModes) ||
      Object.entries(templateModes).some(([id, mode]) => inst.resolvedVariableModes[id] !== mode))
    nativeRefuse('comparison-template-mode');`);
    replace('      node.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);',
      "      if (Object.keys(node.explicitVariableModes).length) nativeRefuse('comparison-template-child-mode');");
    replace('  pair(main, inst, []);', `  const templateNode = () => c.textTemplate.specPath.reduce((node, index) => node.children[index], inst);
  const emptyText = templateNode();
  if (!emptyText || emptyText.type !== 'TEXT' || emptyText.characters !== '' || emptyText.visible !== false)
    nativeRefuse('comparison-template-not-empty');
  // Editing native SLOT content can replace instance-derived descendant IDs.
  // Reacquire after each edit, and only then assign allocation identities.
  emptyText.characters = c.textTemplate.characters;
  templateNode().visible = true;
  if (templateNode().characters !== c.textTemplate.characters || templateNode().visible !== true)
    nativeRefuse('comparison-template-text-refused');
  pair(main, inst, []);`);
    replace("  if (!slot || slot.type !== 'SLOT' || slot.children.length) nativeRefuse('comparison-slot-not-empty');",
      "  if (!slot || slot.type !== 'SLOT' || slot.children.length !== 1) nativeRefuse('comparison-slot-not-empty');");
    replace(`  for (const spec of c.specs) {
    const node = await buildNode(spec, { texts: [], slots: [], visibles: [] });
    saved.contentNodeIds.push(node.id); slot.appendChild(node);
  }`, `  const text = parts.get(nativeCanonical(c.textTemplate.specPath));
  if (!text || text !== slot.children[0] || c.specs.length !== 1 || c.specs[0].type !== 'text')
    nativeRefuse('comparison-template-content-mismatch');
  text.setSharedPluginData('ds_contracts', 'nativeContractSample', JSON.stringify(c.specs[0].nativeContractSample));
  saved.contentNodeIds.push(text.id);`);
  }
  if (recovery) {
    script = script.replace("  const board = figma.createFrame(); nativeOwn(board); NATIVE_PAGE.appendChild(board);",
      "  const board = await figma.getNodeByIdAsync(NATIVE.recovery.creation.comparisonBoardId); nativeFileGuard(); nativeOwn(board);");
    script = script.replace("const inst = main.createInstance(); nativeOwn(inst);",
      "const inst = c === NATIVE.contractComparison ? await figma.getNodeByIdAsync(NATIVE.recovery.creation.comparisons[0].instanceId) : main.createInstance(); nativeFileGuard(); nativeOwn(inst);");
  }
  if (instanceWidth) script = script.replace('  pair(main, inst, []);', `  pair(main, inst, []);
  if (c.instanceWidth !== undefined) {
    if (inst.layoutMode !== 'VERTICAL') nativeRefuse('comparison-instance-width-layout');
    const primarySizing = inst.primaryAxisSizingMode, verticalSizing = inst.layoutSizingVertical;
    // Use the standard resize operation used by guarded root-size repair.
    // Native resizeWithoutConstraints can leave a hugging instance at its
    // intrinsic width before the later FIXED assignment (live Card evidence).
    inst.resize(c.instanceWidth, inst.height);
    inst.counterAxisSizingMode = 'FIXED';
    inst.layoutSizingHorizontal = 'FIXED';
    inst.primaryAxisSizingMode = primarySizing;
    inst.layoutSizingVertical = verticalSizing;
    if (Math.abs(inst.width - c.instanceWidth) > 0.001 || inst.layoutSizingHorizontal !== 'FIXED')
      nativeRefuse('comparison-instance-width-refused');
  }`).replace('  const slot = parts.get(nativeCanonical(c.slotSpecPath));', `  const slot = parts.get(nativeCanonical(c.slotSpecPath));
  if (c.instanceWidth !== undefined) {
    if (!slot || slot.type !== 'SLOT' || slot.parent !== inst) nativeRefuse('comparison-instance-width-slot');
    slot.counterAxisSizingMode = 'FIXED';
    slot.layoutSizingHorizontal = 'FILL';
    if (slot.layoutSizingHorizontal !== 'FILL') nativeRefuse('comparison-instance-width-slot-refused');
  }`);
  if (sourceOwned) script = script.replace(
    '  const slot = parts.get(nativeCanonical(c.slotSpecPath));',
    "  if (c.contentMode === 'source-owned') { recorded.status = 'created-comparison'; return inst; }\n  const slot = parts.get(nativeCanonical(c.slotSpecPath));"
  ).replace("if (nativeCanonical(identity.specPath) !== nativeCanonical(path))", "if (c.contentMode !== 'source-owned' && nativeCanonical(identity.specPath) !== nativeCanonical(path))")
    .replace("node.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);",
      "if (c.contentMode !== 'source-owned' || Object.hasOwn(source.explicitVariableModes || {}, parentCollection.id)) node.setExplicitVariableModeForCollection(parentCollection, c.parent.tokenIdentity.modes[0].modeId);");
  // The app-owned frame plays the caller's containing block: FIXED at the
  // observed width, the root instance FILL inside it. Set before any nested
  // FILL below, which needs its outer parents definite first.
  if (containerWidth) script = script.replace('  dsStampFingerprints(inst);', `
  if (c.containerWidth !== undefined) {
    if (inst.parent !== board || board.layoutMode !== 'VERTICAL') nativeRefuse('comparison-container-width-frame');
    board.resize(c.containerWidth, board.height);
    board.counterAxisSizingMode = 'FIXED';
    board.primaryAxisSizingMode = 'AUTO';
    inst.layoutSizingHorizontal = 'FILL';
    if (Math.abs(board.width - c.containerWidth) > 0.001 || board.counterAxisSizingMode !== 'FIXED' ||
        inst.layoutSizingHorizontal !== 'FILL' || Math.abs(inst.width - c.containerWidth) > 0.001)
      nativeRefuse('comparison-container-width-refused');
  }
  dsStampFingerprints(inst);`);
  if (fillWidth) script = script.replace('  dsStampFingerprints(inst);', `
  // Construction uses a temporary page parent. Set FILL only after every
  // nested instance is attached, from outer parents toward inner children.
  const records = NATIVE_RESULT.comparisons[0].nested || [];
  const refs = c.instances.map((ref, index) => ({ ...ref, index }))
    .filter(ref => ref.fillWidth).sort((a, b) => a.specPath.length - b.specPath.length);
  for (const ref of refs) {
    const record = records.find(row => row.index === ref.index);
    const node = record && await figma.getNodeByIdAsync(record.instanceId); nativeFileGuard();
    const parent = node && node.parent;
    if (!node || !parent || !['VERTICAL', 'GRID'].includes(parent.layoutMode) ||
        (parent.layoutSizingHorizontal !== 'FILL' &&
          (parent.layoutMode === 'GRID' ? parent.primaryAxisSizingMode : parent.counterAxisSizingMode) !== 'FIXED'))
      nativeRefuse('nested-fill-width-parent-unqualified');
    node.layoutSizingHorizontal = 'FILL';
    if (node.layoutSizingHorizontal !== 'FILL') nativeRefuse('nested-fill-width-refused');
  }
  dsStampFingerprints(inst);`);
  if (!gridContent) return script;
  return script.replace(
    "  if (!slot || slot.type !== 'SLOT' || slot.children.length) nativeRefuse('comparison-slot-not-empty');",
    `  const target = c.contentSpecPath ? parts.get(nativeCanonical(c.contentSpecPath)) : slot;
  if (!slot || slot.type !== 'SLOT' || !target || target.children.length ||
      (c.contentSpecPath && (target.type !== 'FRAME' || target.layoutMode !== 'GRID' ||
        target.parent !== slot || slot.children.length !== 1))) nativeRefuse('comparison-slot-not-empty');
  if (c.contentRows) {
    if (!c.contentSpecPath) nativeRefuse('comparison-grid-rows-without-carrier');
    target.gridRowCount = c.contentRows.length;
    target.gridRowSizes = c.contentRows.map(t => t.type === 'HUG' ? { type: 'HUG' } : { type: t.type, value: t.value });
  }`,
  ).replace("node.setSharedPluginData('ds_contracts', 'nativeContractPart', JSON.stringify(identity));",
    `node.setSharedPluginData('ds_contracts', 'nativeContractPart', JSON.stringify(identity));
    const rowRecipe = source.getSharedPluginData('ds_contracts', 'gridFlowRows');
    if (rowRecipe) node.setSharedPluginData('ds_contracts', 'gridFlowRows', rowRecipe);`
  ).replace('saved.contentNodeIds.push(node.id); slot.appendChild(node);',
    'saved.contentNodeIds.push(node.id); target.appendChild(node);');
}
