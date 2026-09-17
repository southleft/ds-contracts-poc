import { prepareNativeComparisonRecovery, emitNativeComparisonRecoveryReadbackScript, type PreparedNativeComparisonRecovery } from './native-comparison-recovery.js';
import { nativeComparisonDependencies } from './native-contract-comparison.js';
import type { PreparedNativeContractComparison } from './native-contract-comparison.js';
import { emitNativeContractReadbackScript } from './native-source-observation.js';
/** Host-owned, create-only source inspection writer context. This is not
 * Contract admission or native fidelity verification. The renderer remains
 * buildSyncScript in emit-figma-script; this module supplies its scope guard. */
import { canonicalJson } from "./contract-provenance.js";
import {
  prepareNativeTokenContext,
  verifyNativeTokenContextReceipt,
  type NativeTokenContextInput,
  type NativeTokenContextReceipt,
  type NativeTokenIdentity,
} from "./native-token-context.js";
import { emitNativeTokenContextReadbackScript } from "./token-set.js";
import type { NativeSourceCandidateProjection } from "./native-source-projection.js";
import type { NativeContractDraftProjection } from "./native-contract-draft.js";
import type {
  NativeSourceComparisonInput,
  prepareNativeSourceComparisons,
} from "./native-source-comparisons.js";

export interface NativeSourceWriteContext {
  /** Allocated once by the application journal, after file policy checks. */
  operation: { id: string; fileKey: string };
  /** Identity from the durable allocation acknowledgement; receipt from a
   * subsequent independent read. Never discovered from component names. */
  tokens: {
    input: NativeTokenContextInput;
    identity: NativeTokenIdentity;
    receipt: NativeTokenContextReceipt;
  };
  comparisons?: NativeSourceComparisonInput;
  /** Host-authenticated partial allocation plus independent empty-instance preflight. */
  comparisonRecovery?: PreparedNativeComparisonRecovery;
}

export function prepareNativeSourceWrite(
  projection: NativeSourceCandidateProjection | NativeContractDraftProjection,
  context: NativeSourceWriteContext,
  boundNames: string[],
  comparisons?: ReturnType<typeof prepareNativeSourceComparisons>,
  contractComparison?: PreparedNativeContractComparison,
) {
  const fail = (code: string): never => {
    throw Error(`native-source-write-${code}`);
  };
  if (
    !context?.operation ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(
      context.operation.id,
    ) ||
    !/^[A-Za-z0-9]{10,80}$/.test(context.operation.fileKey)
  )
    fail("operation-identity");
  const { operation, tokens } = context;
  if (!tokens?.input || !tokens.identity || !tokens.receipt)
    fail("token-observation-required");
  const input = tokens.input;
  if (
    input.fileKey !== operation.fileKey ||
    input.scopeId !== `source-${operation.id}` ||
    input.source.revision !== projection.source.revision ||
    input.source.sourceProgramSha256 !== projection.source.programSha256 ||
    input.modes.length !== 1 ||
    input.modes[0].sourceMode !== projection.context.mode ||
    input.modes[0].brand !== projection.context.brand ||
    input.modes[0].tokenTreeRevision !== ('kind' in projection
      ? projection.tokenRevision : projection.binding.tokenRevision) ||
    tokens.identity.origin !== "created"
  )
    fail("token-source-context");
  const checked = verifyNativeTokenContextReceipt({
    input,
    expectedIdentity: tokens.identity,
    receipt: tokens.receipt,
  });
  if (checked.status !== "native-token-context-observed")
    fail("token-observation-refused");
  const preparation = prepareNativeTokenContext(input);
  const names = new Set(preparation.variables.map((v) => v.name));
  if (boundNames.some((name) => !names.has(name)))
    fail("token-binding-outside-scope");
  const dependencies = contractComparison ? nativeComparisonDependencies(contractComparison) : undefined;
  const recovery = context.comparisonRecovery;
  if (recovery) {
    const checked = prepareNativeComparisonRecovery(recovery.input, recovery.observation);
    if (!contractComparison || canonicalJson(checked) !== canonicalJson(recovery) ||
        canonicalJson(recovery.input.comparison) !== canonicalJson(contractComparison) ||
        canonicalJson(recovery.input.operation) !== canonicalJson(operation) ||
        canonicalJson(recovery.input.tokenInput) !== canonicalJson(input) ||
        canonicalJson(recovery.input.tokenIdentity) !== canonicalJson(tokens.identity) ||
        canonicalJson((recovery.observation as any).content.tokens.receipt) !== canonicalJson(tokens.receipt))
      fail('recovery-context-changed');
  }
  const descriptor = {
    version: 1,
    purpose: "source-candidate-inspection",
    acceptedContract: null,
    nativeQualification: "unqualified",
    operation,
    sourceContractId: projection.contractId,
    sourceContractRevision: projection.contractRevision,
    projection,
    machineId: `source-native:${operation.id}:${projection.contractId}`,
    pageName: `${'kind' in projection ? 'DS contract draft' : 'DS source candidate'} / ${operation.id}`,
    tokenPreparationRevision: preparation.revision,
    ...(recovery ? { recovery: { revision: recovery.revision, creation: recovery.input.creation, observation: recovery.observation } } : {}),
    identity: tokens.identity,
    receipt: tokens.receipt,
    ...(contractComparison ? { contractComparison: {
      caseId: contractComparison.caseId, mainId: contractComparison.mainId,
      variantName: contractComparison.variantName, slotSpecPath: contractComparison.slotSpecPath,
      ...(contractComparison.instanceWidth !== undefined ? {instanceWidth:contractComparison.instanceWidth} : {}),
      ...(contractComparison.contentSpecPath ? { contentSpecPath: contractComparison.contentSpecPath } : {}),
      ...(contractComparison.contentRows ? { contentRows: contractComparison.contentRows } : {}),
      specs: contractComparison.specs, fonts: contractComparison.fonts, nodeTypes: contractComparison.nodeTypes,
      revision: contractComparison.revision, receipt: contractComparison.receipt,
      parent: { tokenIdentity: contractComparison.parent.tokenIdentity },
      ...(contractComparison.instances?.length ? { instances: contractComparison.instances.map(ref => ({
        specPath: ref.specPath, mainId: ref.mainId, slotSpecPath: ref.slotSpecPath,
        ...(ref.contentMode ? { contentMode: ref.contentMode } : {}),
        ...(ref.contentSpecPath ? { contentSpecPath: ref.contentSpecPath } : {}),
        ...(ref.contentRows ? { contentRows: ref.contentRows } : {}),
        ...(ref.fillWidth ? { fillWidth: true } : {}),
        parent: { tokenIdentity: ref.parent.tokenIdentity },
      })), dependencyReceipts: dependencies!.parents.map(ref => ref.receipt) } : {}),
    } } : {}),
    ...(comparisons
      ? {
          comparisons: {
            revision: comparisons.revision,
            cases: comparisons.cases,
            fonts: comparisons.fonts,
            nodeTypes: comparisons.nodeTypes,
          },
        }
      : {}),
  };
  // A copy at emission time prevents a caller mutating the descriptor while
  // retaining an earlier successful validation.
  return {
    descriptor: JSON.parse(canonicalJson(descriptor)) as typeof descriptor,
    recoveryReadbackScript: recovery ? emitNativeComparisonRecoveryReadbackScript(recovery.input) : undefined,
    readbackScript: emitNativeTokenContextReadbackScript(
      input,
      tokens.identity,
    ),
    sampleSpecs: comparisons?.specs ?? contractComparison?.specs ?? [],
    comparisonNestedReadbackScripts: dependencies?.parents.map(ref => emitNativeContractReadbackScript(ref.parent)),
    comparisonParentReadbackScript: contractComparison ? emitNativeContractReadbackScript(contractComparison.parent) : undefined,
  };
}

export type PreparedNativeSourceWrite = ReturnType<
  typeof prepareNativeSourceWrite
>;

/** Wrap the shared renderer. No node is allocated until exact live token
 * identity/value/mode and scope checks pass. A generic create API exception is
 * an unknown outcome even when it returned no ID; callers must not retry it. */
export function wrapNativeSourceWrite(
  prepared: PreparedNativeSourceWrite,
  render: string,
): string {
  return `// GENERATED scoped source-candidate inspection. Fresh objects only.
const NATIVE = ${JSON.stringify(prepared.descriptor)};
const NATIVE_RESULT = { version: 1, status: 'refused', acceptedContract: null,
  nativeQualification: 'unqualified', operationId: NATIVE.operation.id,
  fileKey: NATIVE.operation.fileKey, allocationAttempted: false,
  pageId: null, target: null, nodes: [], problems: [] };
let NATIVE_PAGE = null;
let NATIVE_VARIABLES = [];
let NATIVE_COLLECTION = null;
const nativeCanonical = (v) => JSON.stringify((function order(x) {
  if (Array.isArray(x)) return x.map(order);
  if (!x || typeof x !== 'object') return x;
  return Object.fromEntries(Object.keys(x).sort().map(k => [k, order(x[k])]));
})(v));
function nativeRefuse(code) { throw Error('native-source-write-' + code); }
function nativeFileGuard() {
  if (figma.fileKey !== NATIVE.operation.fileKey) nativeRefuse('file-mismatch');
}
const nativeOwner = JSON.stringify({ version: 1, operationId: NATIVE.operation.id,
  sourceContractId: NATIVE.sourceContractId, sourceContractRevision: NATIVE.sourceContractRevision,
  tokenPreparationRevision: NATIVE.tokenPreparationRevision, acceptedContract: null });
function nativeRetain(node) {
  // Retain returned identity BEFORE metadata/mode APIs that may throw.
  if (NATIVE_RESULT.nodes.some(entry => entry.id === node.id)) return;
  const identity = { id: node.id, type: node.type };
  NATIVE_RESULT.nodes.push(identity);
  if (node.key) identity.key = node.key;
}
function nativeOwn(node) {
  nativeRetain(node);
  node.setSharedPluginData('ds_contracts', 'nativeSourceOperation', nativeOwner);
  node.setSharedPluginData('ds_contracts', 'nativeSourceAllocation', node.id);
}
function nativeInit(node, spec) {
  // SVG import returns every descendant at once. Retain the entire allocation
  // before even the root's first metadata write, which may fail.
  const svgDescendants = spec.type === 'svg' ? node.findAll(() => true) : [];
  nativeRetain(node);
  for (const child of svgDescendants) nativeRetain(child);
  nativeOwn(node);
  if (spec.type !== 'slot') NATIVE_PAGE.appendChild(node);
  node.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
  ${'kind' in prepared.descriptor.projection
    ? "if (spec.nativeContractPart) node.setSharedPluginData('ds_contracts', 'nativeContractPart', JSON.stringify(spec.nativeContractPart));\n  else " : ''}if (spec.nativeSourcePart) node.setSharedPluginData('ds_contracts', 'nativeSourcePart', JSON.stringify(spec.nativeSourcePart));
  else if (spec.nativeSourceSample || spec.nativeContractSample) {
    node.setSharedPluginData('ds_contracts', spec.nativeContractSample ? 'nativeContractSample' : 'nativeSourceSample', JSON.stringify(spec.nativeContractSample || spec.nativeSourceSample));
  } else nativeRefuse('node-source-identity-missing');
  // createNodeFromSvg allocates a subtree in one API call. Preserve all
  // returned IDs and source-part ownership, including reusable draft icons.
  // Owning the subtree does not establish vector equivalence.
  for (const child of svgDescendants) {
    nativeOwn(child);
    const key = spec.nativeContractPart ? 'nativeContractPart' : spec.nativeSourcePart ? 'nativeSourcePart' : spec.nativeContractSample ? 'nativeContractSample' : 'nativeSourceSample';
    child.setSharedPluginData('ds_contracts', key, JSON.stringify(spec.nativeContractPart || spec.nativeSourcePart || spec.nativeContractSample || spec.nativeSourceSample));
  }
  if (spec.nativeSourceVisible === false) node.visible = false;
}
async function nativeReadTokens() {
  return await (async () => {
${prepared.readbackScript}
  })();
}
function nativeCheckTokens(observed) {
  // The host already applied the pure exact/float32 policy to this receipt.
  // Between independent readback and apply, ANY change to that native
  // snapshot refuses, including a same-name replacement or alias retarget.
  if (observed.status !== 'readback-collected' ||
      nativeCanonical(observed.receipt) !== nativeCanonical(NATIVE.receipt)) nativeRefuse('tokens-changed');
}
${prepared.descriptor.contractComparison ? `async function nativeCheckComparisonParent() {
  const observed = await (async () => {
${prepared.comparisonParentReadbackScript}
  })();
  delete observed.images;
  if (nativeCanonical(observed) !== nativeCanonical(NATIVE.contractComparison.receipt)) nativeRefuse('comparison-parent-changed');${(prepared.comparisonNestedReadbackScripts ?? []).map((script, index) => `
  {
    const nested = await (async () => { ${script} })();
    delete nested.images;
    if (nativeCanonical(nested) !== nativeCanonical(NATIVE.contractComparison.dependencyReceipts[${index}])) nativeRefuse('comparison-nested-main-changed');
  }`).join('\n')}
}
` : ''}try {
  nativeFileGuard();
  for (const name of ['loadAllPagesAsync', 'setCurrentPageAsync', 'createPage', 'createComponent', 'createFrame', 'combineAsVariants', 'loadFontAsync']) {
    if (typeof figma[name] !== 'function') nativeRefuse('api-unavailable');
  }
  const comparison = NATIVE.contractComparison || NATIVE.comparisons;
  if (comparison) for (const type of comparison.nodeTypes) {
    const api = { text: 'createText', svg: 'createNodeFromSvg', frame: 'createFrame' }[type];
    if (!api || typeof figma[api] !== 'function') nativeRefuse('comparison-api-unavailable');
  }
  await figma.loadAllPagesAsync();
  nativeFileGuard();
  NATIVE_COLLECTION = await figma.variables.getVariableCollectionByIdAsync(NATIVE.identity.collection.id);
  NATIVE_VARIABLES = await Promise.all(NATIVE.identity.variables.map(v => figma.variables.getVariableByIdAsync(v.id)));
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  for (const font of comparison ? comparison.fonts : []) {
    let loaded = false;
    for (const style of font.styles) {
      try { await figma.loadFontAsync({ family: font.family, style }); loaded = true; break; } catch (_) { /* same-family spelling retry */ }
    }
    if (!loaded) nativeRefuse('comparison-font-unavailable');
  }
  nativeCheckTokens(await nativeReadTokens());
  nativeFileGuard();
  for (const page of figma.root.children) {
    if (page.name === NATIVE.pageName${prepared.descriptor.recovery ? ' && page.id !== NATIVE.recovery.creation.pageId' : ''}) nativeRefuse('page-name-collision');
    for (const node of [page, ...page.findAll(() => true)]) {
      const raw = node.getSharedPluginData('ds_contracts', 'nativeSourceOperation');
      if (raw) {
        let owner;
        try { owner = JSON.parse(raw); } catch (_) { nativeRefuse('ownership-unreadable'); }
        if (!owner || typeof owner.operationId !== 'string') nativeRefuse('ownership-unreadable');
        if (owner.operationId === NATIVE.operation.id${prepared.descriptor.recovery ? ' && !NATIVE.recovery.creation.nodes.some(n => n.id === node.id)' : ''}) nativeRefuse('scope-collision');
      }
      if (node.getSharedPluginData('ds_contracts', 'contractId') === NATIVE.machineId) nativeRefuse('scope-collision');
    }
  }
  ${prepared.descriptor.contractComparison ? 'await nativeCheckComparisonParent(); nativeFileGuard();' : ''}
  ${prepared.descriptor.recovery ? `NATIVE_PAGE = await figma.getNodeByIdAsync(NATIVE.recovery.creation.pageId); nativeFileGuard();
  const recoveryObserved = await (async()=>{${prepared.recoveryReadbackScript}})();
  nativeFileGuard();
  if (nativeCanonical(recoveryObserved) !== nativeCanonical(NATIVE.recovery.observation)) nativeRefuse('recovery-preflight-changed');
  if (!NATIVE_PAGE || NATIVE_PAGE.getSharedPluginData('ds_contracts','nativeComparisonRecoveryClaim')) nativeRefuse('recovery-already-claimed');
  // Claim synchronously before the first mutation. A failed continuation remains
  // retained and cannot reuse this preflight or be automatically replayed.
  NATIVE_PAGE.setSharedPluginData('ds_contracts','nativeComparisonRecoveryClaim',NATIVE.recovery.revision);
  NATIVE_RESULT.allocationAttempted = true;
  for (const identity of NATIVE.recovery.creation.nodes) NATIVE_RESULT.nodes.push(identity);` : `NATIVE_RESULT.allocationAttempted = true;
  NATIVE_PAGE = figma.createPage();`}
  NATIVE_RESULT.pageId = NATIVE_PAGE.id;
  nativeOwn(NATIVE_PAGE);
  NATIVE_PAGE.name = NATIVE.pageName;
  await figma.setCurrentPageAsync(NATIVE_PAGE);
  nativeFileGuard();
  const applied = await (async () => {
${render}
  })();
  nativeFileGuard();
  nativeCheckTokens(await nativeReadTokens());
  ${prepared.descriptor.contractComparison ? 'await nativeCheckComparisonParent();' : ''}
  // Slot content can become instance-derived clones after this run. Preserve
  // both the allocation stamp and its exact role under a stable slot root.
  for (const c of (NATIVE_RESULT.comparisons || [])) if (c.status === 'created-comparison') {
    for (const saved of c.slots) {
      const slot = await figma.getNodeByIdAsync(saved.nodeId); nativeFileGuard();
      if (!slot || slot.type !== 'SLOT') nativeRefuse('slot-identity-unavailable');
      function record(node, path) {
        const allocation = node.getSharedPluginData('ds_contracts', 'nativeSourceAllocation');
        const identity = NATIVE_RESULT.nodes.find(n => n.id === allocation);
        if (!identity || identity.slotIdentity) nativeRefuse('slot-allocation-ambiguous');
        identity.slotIdentity = { slotId: slot.id, path };
        (node.children || []).forEach((child, i) => record(child, path.concat(i)));
      }
      slot.children.forEach((child, i) => record(child, [i]));
    }
  }
  NATIVE_RESULT.applied = applied;
  NATIVE_RESULT.status = 'created-candidate';
} catch (error) {
  NATIVE_RESULT.status = NATIVE_RESULT.allocationAttempted ? 'partial-or-unknown-allocation' : 'refused';
  NATIVE_RESULT.problems = [error && typeof error.message === 'string' ? error.message : 'native-source-write-api-failed'];
}
return NATIVE_RESULT;
`;
}
