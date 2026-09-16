import { materializeFlowRows } from './grid-flow-rows.js';
/** Comparison content belongs to an instance of an independently observed main.
 * No source-template identity is invented and the main is never rewritten. */
import { revisionOf } from './contract-provenance.js';
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
  caseId: string;
  variantName: string;
  slotSpecPath: number[];
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
  input: NativeContractComparisonInput) {
  const fail = (code: string): never => { throw Error('native-contract-comparison-' + code); };
  const revision = /^sha256:[a-f0-9]{64}$/;
  if (!revision.test(source.revision) || !revision.test(source.evidenceRevision) ||
      !/^[a-f0-9]{64}$/.test(source.programSha256) || !revision.test(tokenRevision) ||
      source.revision !== input.parent.projection.source.revision || source.programSha256 !== input.parent.projection.source.programSha256 ||
      context.mode !== input.parent.projection.context.mode || context.brand !== input.parent.projection.context.brand)
    fail('source-changed');
  if (!input.caseId || input.caseId.length > 160 || verifyNativeContractReadback(input.parent, input.receipt).status !== 'supported-structure-observed')
    fail('parent-observation-required');
  if (contract.status !== 'draft' || contract.props.length || contract.states.length || contract.bindings.code.runtime ||
      contract.bindings.figma.anchors.componentSetKey || component.variants.length !== 1 || component.stateVariants?.length ||
      component.boolProps.length || component.textProps.length || component.nativeSourceCandidate || component.nativeContractDraft)
    fail('snapshot-contract-required');
  const select = (input: Omit<NativeContractComparisonInput, 'caseId'> & { contentMode?: 'source-owned' }) => {
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
    if (slot.children?.length && (slot.children.length !== 1 || !slot.rootSlotContent ||
        !carrier?.rootSlotGridContent || carrier.type !== 'frame' || carrier.layout?.mode !== 'GRID' ||
        carrier.layout.grid?.flow !== 'ROW_AUTO_FLOW' || carrier.children?.length)) fail('empty-slot-required');
    return { mainId: mains[0].id as string,
      ...(variants[0].spec.rootFillWidth ? { fillWidth: true as const } : {}),
      ...(carrier ? { contentSpecPath: [...input.slotSpecPath, 0] } : {}) };

  };
  const selected = select(input);
  if (selected.fillWidth) fail('root-fill-width-needs-parent-context');
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
  const root = component.variants[0].spec;
  if (root.type !== 'root' || !root.children?.length) fail('content-missing');
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
    if (children.some(child => child.absolute || child.overlay || child.insetOverlay || child.cell) ||
        children.length > grid.rows.length * grid.columns.length) fail('grid-content-placement-unqualified');
    return grid.flowRows ? grid.rows : undefined;
  };
  const contentRows = checkCapacity({ ...input, ...selected }, root.children!);
  for (const reference of instances) {
    let spec = root;
    for (const index of reference.specPath) {
      if (!spec.children?.[index]) fail('nested-main-path-missing');
      spec = spec.children![index];
    }
    if (reference.contentMode !== 'source-owned') Object.assign(reference, { contentRows: checkCapacity(reference, spec.children ?? []) });
  }
  const specs = root.children!.map((spec, i) => annotate(spec, [i]));
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
      definite = fixedWidth(host) || Boolean(host.rootSlotContent && (hostRoot.rootFillWidth || fixedWidth(hostRoot)));
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
    caseId: input.caseId, ...selected, ...(contentRows ? { contentRows } : {}), variantName: input.variantName,
    slotSpecPath: [...input.slotSpecPath], ...(instances.length ? { instances } : {}), specs, fonts: [...fonts.values()], nodeTypes: [...nodeTypes].sort(),
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
  board.name = 'Observed caller content'; board.fills = []; board.layoutMode = 'VERTICAL';
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
  board.name = 'Observed caller content'; board.fills = []; board.layoutMode = 'VERTICAL';
  board.primaryAxisSizingMode = 'AUTO'; board.counterAxisSizingMode = 'AUTO';
  const inst = await nativeFillContractInstance(c, c.specs, board, c.caseId, record => { NATIVE_RESULT.comparisons = [record]; });
  inst.setSharedPluginData('ds_contracts', 'nativeContractCase', JSON.stringify({ id: c.caseId, revision: c.revision }));
  dsStampFingerprints(inst);
  return { comparisonInstanceId: inst.id, parentMainId: c.mainId, acceptedContract: null, nativeQualification: 'unqualified' };
}
`;

/** Preserve the existing receipt/script format when no verified grid carrier is
 * involved. Only compiler-owned content frames can become insertion targets. */
export function nativeContractComparisonRuntime(nested: boolean, gridContent: boolean, fillWidth = false, sourceOwned = false): string {
  let script = nested ? NATIVE_CONTRACT_NESTED_COMPARISON_RUNTIME : NATIVE_CONTRACT_COMPARISON_RUNTIME;
  if (sourceOwned) script = script.replace(
    '  const slot = parts.get(nativeCanonical(c.slotSpecPath));',
    "  if (c.contentMode === 'source-owned') { recorded.status = 'created-comparison'; return inst; }\n  const slot = parts.get(nativeCanonical(c.slotSpecPath));"
  ).replace("if (nativeCanonical(identity.specPath) !== nativeCanonical(path))", "if (c.contentMode !== 'source-owned' && nativeCanonical(identity.specPath) !== nativeCanonical(path))");
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
