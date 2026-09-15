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
}

export function prepareNativeSourceWrite(
  projection: NativeSourceCandidateProjection,
  context: NativeSourceWriteContext,
  boundNames: string[],
  comparisons?: ReturnType<typeof prepareNativeSourceComparisons>,
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
    input.modes[0].tokenTreeRevision !== projection.binding.tokenRevision ||
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
    pageName: `DS source candidate / ${operation.id}`,
    tokenPreparationRevision: preparation.revision,
    identity: tokens.identity,
    receipt: tokens.receipt,
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
    readbackScript: emitNativeTokenContextReadbackScript(
      input,
      tokens.identity,
    ),
    sampleSpecs: comparisons?.specs ?? [],
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
function nativeOwn(node) {
  // Retain returned identity BEFORE metadata/mode APIs that may throw.
  const identity = { id: node.id, type: node.type };
  NATIVE_RESULT.nodes.push(identity);
  if (node.key) identity.key = node.key;
  node.setSharedPluginData('ds_contracts', 'nativeSourceOperation', nativeOwner);
}
function nativeInit(node, spec) {
  nativeOwn(node);
  if (spec.type !== 'slot') NATIVE_PAGE.appendChild(node);
  node.setExplicitVariableModeForCollection(NATIVE_COLLECTION, NATIVE.identity.modes[0].modeId);
  if (spec.nativeSourcePart) node.setSharedPluginData('ds_contracts', 'nativeSourcePart', JSON.stringify(spec.nativeSourcePart));
  else if (spec.nativeSourceSample) {
    node.setSharedPluginData('ds_contracts', 'nativeSourceSample', JSON.stringify(spec.nativeSourceSample));
    // createNodeFromSvg allocates a subtree in one API call. Preserve and own
    // its returned descendants too; this does not claim vector equivalence.
    if (spec.type === 'svg') for (const child of node.findAll(() => true)) {
      nativeOwn(child);
      child.setSharedPluginData('ds_contracts', 'nativeSourceSample', JSON.stringify(spec.nativeSourceSample));
    }
  } else nativeRefuse('node-source-identity-missing');
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
try {
  nativeFileGuard();
  for (const name of ['loadAllPagesAsync', 'setCurrentPageAsync', 'createPage', 'createComponent', 'createFrame', 'combineAsVariants', 'loadFontAsync']) {
    if (typeof figma[name] !== 'function') nativeRefuse('api-unavailable');
  }
  if (NATIVE.comparisons) for (const type of NATIVE.comparisons.nodeTypes) {
    const api = { text: 'createText', svg: 'createNodeFromSvg', frame: 'createFrame' }[type];
    if (!api || typeof figma[api] !== 'function') nativeRefuse('comparison-api-unavailable');
  }
  await figma.loadAllPagesAsync();
  nativeFileGuard();
  NATIVE_COLLECTION = await figma.variables.getVariableCollectionByIdAsync(NATIVE.identity.collection.id);
  NATIVE_VARIABLES = await Promise.all(NATIVE.identity.variables.map(v => figma.variables.getVariableByIdAsync(v.id)));
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  for (const font of NATIVE.comparisons ? NATIVE.comparisons.fonts : []) {
    let loaded = false;
    for (const style of font.styles) {
      try { await figma.loadFontAsync({ family: font.family, style }); loaded = true; break; } catch (_) { /* same-family spelling retry */ }
    }
    if (!loaded) nativeRefuse('comparison-font-unavailable');
  }
  nativeCheckTokens(await nativeReadTokens());
  nativeFileGuard();
  for (const page of figma.root.children) {
    if (page.name === NATIVE.pageName) nativeRefuse('page-name-collision');
    for (const node of [page, ...page.findAll(() => true)]) {
      const raw = node.getSharedPluginData('ds_contracts', 'nativeSourceOperation');
      if (raw) {
        let owner;
        try { owner = JSON.parse(raw); } catch (_) { nativeRefuse('ownership-unreadable'); }
        if (!owner || typeof owner.operationId !== 'string') nativeRefuse('ownership-unreadable');
        if (owner.operationId === NATIVE.operation.id) nativeRefuse('scope-collision');
      }
      if (node.getSharedPluginData('ds_contracts', 'contractId') === NATIVE.machineId) nativeRefuse('scope-collision');
    }
  }
  NATIVE_RESULT.allocationAttempted = true;
  NATIVE_PAGE = figma.createPage();
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
  NATIVE_RESULT.applied = applied;
  NATIVE_RESULT.status = 'created-candidate';
} catch (error) {
  NATIVE_RESULT.status = NATIVE_RESULT.allocationAttempted ? 'partial-or-unknown-allocation' : 'refused';
  NATIVE_RESULT.problems = [error && typeof error.message === 'string' ? error.message : 'native-source-write-api-failed'];
}
return NATIVE_RESULT;
`;
}
