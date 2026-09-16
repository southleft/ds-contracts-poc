/** Comparison content belongs to an instance of an independently observed main.
 * No source-template identity is invented and the main is never rewritten. */
import { revisionOf } from './contract-provenance.js';
import type { Contract } from '../scripts/contract-schema.js';
import type { ComponentData, NodeSpec } from './emit-figma-script.js';
import type { NativeContractDraftProjection, NativeContractDraftSource } from './native-contract-draft.js';
import { verifyNativeContractReadback, type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';

export interface NativeContractSampleIdentity {
  caseId: string;
  contentRevision: string;
  /** Compiler path in the observed content; not a reusable anatomy claim. */
  specPath: number[];
}
export interface NativeContractComparisonInput {
  parent: NativeContractObservationInput;
  receipt: NativeSourceReadback;
  caseId: string;
  variantName: string;
  slotSpecPath: number[];
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
  const variants = input.parent.component.variants.filter(v => v.name === input.variantName);
  const mains = input.parent.creation.variants.filter((v: { name: string }) => v.name === input.variantName);
  if (variants.length !== 1 || mains.length !== 1) fail('main-ambiguous');
  let slot = variants[0].spec;
  if (!Array.isArray(input.slotSpecPath) || input.slotSpecPath.length > 32) fail('slot-path-invalid');
  for (const index of input.slotSpecPath) {
    if (!Number.isInteger(index) || index < 0 || !slot.children?.[index]) fail('slot-path-invalid');
    slot = slot.children![index];
  }
  if (slot.type !== 'slot' || slot.children?.length || slot.slotDefault?.length) fail('empty-slot-required');
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
    out.nativeContractSample = { caseId: input.caseId, contentRevision: revisionOf(contract), specPath };
    if (spec.children) out.children = spec.children.map((child, i) => annotate(child, [...specPath, i]));
    return out;
  };
  const specs = root.children!.map((spec, i) => annotate(spec, [i]));
  const receipt = structuredClone(input.receipt); delete receipt.images;
  return { projection, boundNames: [...boundNames].sort(), parent: structuredClone(input.parent), receipt,
    caseId: input.caseId, mainId: mains[0].id as string, variantName: input.variantName,
    slotSpecPath: [...input.slotSpecPath], specs, fonts: [...fonts.values()], nodeTypes: [...nodeTypes].sort(),
    revision: revisionOf({ contract, component, source, tokenRevision, context, input: { ...input, receipt } }) };
}
export type PreparedNativeContractComparison = ReturnType<typeof prepareNativeContractComparison>;

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
    if (path.length) nativeOwn(node);
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
