/** Create-only experimental graph transport. It is deliberately separate from
 * the admitted single-collection operation protocol. No host may infer repair,
 * replay adoption or update authority from a graph name or a creation result. */
import { canonicalJson } from './contract-provenance.js';
import { verifyNativeTokenContextReceipt, type NativeTokenIdentity, type NativeTokenContextReceipt } from './native-token-context.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { planNativeRootTextTemplateGraph, nativeRootTextTemplateGraphScopes, nativeRootTextTemplateGraphSourceScopes,
  type NativeRootTextTemplateGraphInput, type NativeRootTextTemplateGraph } from './native-root-text-template-graph.js';

type SelectorIdentity = { selector: string; id: string; key: string; name: string; modes: Array<{ modeId: string; name: string }> };
export interface NativeTemplateGraphIdentity {
  version: 1;
  graphRevision: string;
  fileKey: string;
  source: NativeTokenIdentity;
  selectors: SelectorIdentity[];
  routes: Array<{ name: string; id: string; key: string }>;
}
type SelectorReceipt = SelectorIdentity & { remote: boolean; defaultModeId: string; variableIds: string[]; ownership: unknown };
type RouteReceipt = { id: string; key: string; name: string; variableCollectionId: string; resolvedType: string;
  remote: boolean; scopes: string[]; valuesByMode: Record<string, unknown>; ownership: unknown };
export interface NativeTemplateGraphReceipt {
  fileKey: string;
  graphRevision: string;
  source: NativeTokenContextReceipt;
  sourceScopes: Record<string, string[]>;
  selectors: SelectorReceipt[];
  routes: RouteReceipt[];
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(why: string): never { throw Error(`native-template-graph-${why}`); }
const allocationRevision = (graph: NativeRootTextTemplateGraph) => graph.allocationRevision ?? graph.revision;
const owner = (graph: NativeRootTextTemplateGraph) => ({ scopeId: graph.sourceTokens.scopeId, graphRevision: allocationRevision(graph) });
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;
function unique(values: string[]) { if (values.some(v => !nonempty(v)) || new Set(values).size !== values.length) fail('identity-ambiguous'); }

function checkIdentity(input: NativeRootTextTemplateGraphInput, graph: NativeRootTextTemplateGraph, id: NativeTemplateGraphIdentity) {
  if (!id || id.version !== 1 || id.graphRevision !== allocationRevision(graph) || id.fileKey !== graph.sourceTokens.fileKey ||
      !Array.isArray(id.selectors) || id.selectors.length !== graph.selectors.length ||
      !Array.isArray(id.routes) || id.routes.length !== graph.routes.length) fail('identity-shape');
  // Reuse the existing complete source-identity validator. Emitting this
  // read-only program does not observe or validate a native source collection.
  emitNativeTokenContextReadbackScript(input.tokens, id.source);
  unique([id.source.collection.id, ...id.selectors.map(s => s.id)]);
  unique([id.source.collection.key, ...id.selectors.map(s => s.key)]);
  unique([...id.source.variables.map(v => v.id), ...id.routes.map(v => v.id)]);
  unique([...id.source.variables.map(v => v.key), ...id.routes.map(v => v.key)]);
  for (let i = 0; i < graph.selectors.length; i++) {
    const planned = graph.selectors[i], actual = id.selectors[i];
    if (actual.selector !== planned.key || actual.name !== planned.collectionName || !Array.isArray(actual.modes) ||
        actual.modes.length !== 2 || !same(actual.modes.map(m => m.name), planned.modes)) fail('selector-identity');
  }
  unique([...id.source.modes.map(m => m.modeId), ...id.selectors.flatMap(s => s.modes.map(m => m.modeId))]);
  if (!same(id.routes.map(r => r.name), graph.routes.map(r => r.name))) fail('route-identity');
}

/** Original variables are checked by their existing verifier. Every routing
 * value must point at the recorded source/route ID, including equal-valued
 * leaves. Collection membership and ownership are exact, not name discovery. */
export function verifyNativeTemplateGraphReceipt(input: NativeRootTextTemplateGraphInput, id: NativeTemplateGraphIdentity, receipt: NativeTemplateGraphReceipt): void {
  const graph = planNativeRootTextTemplateGraph(input); checkIdentity(input, graph, id);
  if (!receipt || receipt.fileKey !== id.fileKey || receipt.graphRevision !== allocationRevision(graph) ||
      !Array.isArray(receipt.selectors) || !Array.isArray(receipt.routes) ||
      receipt.selectors.length !== id.selectors.length || receipt.routes.length !== id.routes.length) fail('receipt-shape');
  const source = verifyNativeTokenContextReceipt({ input: input.tokens, expectedIdentity: id.source, receipt: receipt.source });
  if (source.status !== 'native-token-context-observed') fail('source-readback');
  const expectedSourceScopes = nativeRootTextTemplateGraphSourceScopes(graph);
  if (!same(receipt.sourceScopes, Object.fromEntries(id.source.variables.map(v => [v.id, expectedSourceScopes[v.tokenPath]])))) fail('source-scopes');
  const selectors = new Map(id.selectors.map(s => [s.selector, s])), routes = new Map(id.routes.map(r => [r.name, r]));
  const sourceIds = new Map(id.source.variables.map(v => [v.tokenPath, v.id])), scopes = nativeRootTextTemplateGraphScopes(graph);
  for (let i = 0; i < id.selectors.length; i++) {
    const expected = id.selectors[i], actual = receipt.selectors[i];
    const variableIds = graph.routes.filter(r => r.selector === expected.selector).map(r => routes.get(r.name)!.id).sort();
    const wanted = { ...expected, remote: false, defaultModeId: expected.modes[0].modeId, variableIds,
      ownership: { ...owner(graph), selector: expected.selector } };
    if (!same(actual, wanted)) fail('selector-readback');
  }
  for (let i = 0; i < graph.routes.length; i++) {
    const route = graph.routes[i], expected = id.routes[i], collection = selectors.get(route.selector)!;
    const valuesByMode = Object.fromEntries(route.targets.map((target, bit) => [collection.modes[bit].modeId,
      { type: 'VARIABLE_ALIAS', id: 'route' in target ? routes.get(target.route)!.id : sourceIds.get(target.sourcePath)! }]));
    const wanted = { ...expected, variableCollectionId: collection.id, resolvedType: route.resolvedType, remote: false,
      scopes: scopes[route.name], valuesByMode, ownership: { ...owner(graph), routeName: route.name, collectionId: collection.id, collectionKey: collection.key } };
    if (!same(receipt.routes[i], wanted)) fail('route-readback');
  }
}

function runtime(graph: NativeRootTextTemplateGraph) {
  return `const GRAPH = ${JSON.stringify(graph)}, SCOPES = ${JSON.stringify(nativeRootTextTemplateGraphScopes(graph))}, SOURCE_SCOPES = ${JSON.stringify(nativeRootTextTemplateGraphSourceScopes(graph))};
const NS = 'ds_contracts', KEY = 'nativeTextTemplateGraph';
const OWNER = ${JSON.stringify(owner(graph))};
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => {
  const sorted = v => Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
};
const text = v => typeof v === 'string' && v.length > 0 ? v : null;
const refuse = code => { throw Error('native-template-graph-' + code); };
const problem = e => /^native-template-graph-[a-z-]+$/.test(e?.message) ? e.message : 'native-template-graph-native-operation-failed';
const guard = () => { if (figma.fileKey !== GRAPH.sourceTokens.fileKey) refuse('file-mismatch'); };
const readOwner = v => { const raw = v.getSharedPluginData(NS, KEY); if (!raw) return null; try { return JSON.parse(raw); } catch { refuse('ownership-unreadable'); } };
const selectorReceipt = (selector, c) => ({ selector, id: c.id, key: c.key, name: c.name, modes: copy(c.modes), remote: c.remote,
  defaultModeId: c.defaultModeId, variableIds: [...c.variableIds].sort(), ownership: readOwner(c) });
const routeReceipt = v => ({ id: v.id, key: v.key, name: v.name, variableCollectionId: v.variableCollectionId,
  resolvedType: v.resolvedType, remote: v.remote, scopes: [...v.scopes].sort(), valuesByMode: copy(v.valuesByMode), ownership: readOwner(v) });
`;
}

export function emitNativeTemplateGraphScript(input: NativeRootTextTemplateGraphInput): { graph: NativeRootTextTemplateGraph; script: string } {
  const graph = planNativeRootTextTemplateGraph(input), source = emitNativeTokenContextScript(input.tokens);
  const script = `// GENERATED candidate-only create; no component or canvas node is changed.
${runtime(graph)}
const result = { version: 1, status: 'refused', graphRevision: GRAPH.revision, receiptKind: 'creation-objects-only',
  acceptedContract: null, nativeQualification: 'unqualified', allocationAttempted: false,
  allocation: { source: null, selectors: [], routes: [] }, problems: [] };
try {
  guard();
  const inventory = async () => {
    const [collections, variables] = await Promise.all([figma.variables.getLocalVariableCollectionsAsync(), figma.variables.getLocalVariablesAsync()]);
    guard();
    const labels = new Set(GRAPH.selectors.map(s => s.collectionName));
    for (const c of collections) if (labels.has(c.name) || readOwner(c)?.scopeId === OWNER.scopeId) refuse('scope-collision');
    // Compiler alias names may repeat across independent owned collections.
    // They never authorize adoption; every edge uses a freshly allocated ID.
    for (const v of variables) if (readOwner(v)?.scopeId === OWNER.scopeId) refuse('scope-collision');
    return { collections, variables };
  };
  await inventory();
  const createdSource = await (async () => { ${source.script}\n })();
  result.allocation.source = createdSource;
  result.allocationAttempted = !!createdSource.allocation.collection;
  if (createdSource.status !== 'created-candidate') { result.problems = createdSource.problems; refuse('source-creation'); }
  const sourceVars = await Promise.all(createdSource.creationIdentity.variables.map(v => figma.variables.getVariableByIdAsync(v.id)));
  const state = await inventory();
  guard();
  const bySourcePath = new Map();
  sourceVars.forEach((v, index) => {
    const identity = createdSource.creationIdentity.variables[index], observed = createdSource.receipt.variables.find(r => r.id === identity.id);
    if (!v || v.id !== identity.id || v.key !== identity.key || v.variableCollectionId !== createdSource.creationIdentity.collection.id ||
        v.name !== observed.name || v.resolvedType !== observed.resolvedType || v.remote !== false || !same(v.valuesByMode, observed.valuesByMode)) refuse('source-changed');
    bySourcePath.set(identity.tokenPath, v);
  });
  // No await after the final live inventory check and before allocation/value
  // writes. Existing source objects are read, never modified by the graph layer.
  for (const c of state.collections) if (GRAPH.selectors.some(s => s.collectionName === c.name) || readOwner(c)?.scopeId === OWNER.scopeId) refuse('scope-collision');
  for (const v of state.variables) if (readOwner(v)?.scopeId === OWNER.scopeId) refuse('scope-collision');
  const collectionIds = new Set(state.collections.map(c => c.id)), collectionKeys = new Set(state.collections.map(c => c.key));
  const variableIds = new Set(state.variables.map(v => v.id)), variableKeys = new Set(state.variables.map(v => v.key));
  const modeIds = new Set(state.collections.flatMap(c => c.modes.map(m => m.modeId)));
  const selectors = new Map(), routes = new Map();
  for (const [path, v] of bySourcePath) { guard(); v.scopes = SOURCE_SCOPES[path]; }
  for (const planned of GRAPH.selectors) {
    guard(); result.allocationAttempted = true;
    const c = figma.variables.createVariableCollection(planned.collectionName);
    const allocation = { selector: planned.key, id: text(c?.id), key: text(c?.key), name: text(c?.name), modes: copy(c?.modes ?? []) };
    result.allocation.selectors.push(allocation);
    guard();
    if (!text(c?.id) || !text(c?.key) || c.name !== planned.collectionName || c.remote !== false ||
        collectionIds.has(c.id) || collectionKeys.has(c.key) || c.modes.length !== 1 || c.defaultModeId !== c.modes[0].modeId ||
        !text(c.modes[0].modeId) || modeIds.has(c.modes[0].modeId)) refuse('created-selector-identity');
    modeIds.add(c.modes[0].modeId);
    collectionIds.add(c.id); collectionKeys.add(c.key); selectors.set(planned.key, c);
    c.setSharedPluginData(NS, KEY, JSON.stringify({ ...OWNER, selector: planned.key }));
    guard();
    c.renameMode(c.modes[0].modeId, '0');
    guard(); let addedMode;
    try { addedMode = c.addMode('1'); } finally { allocation.modes = copy(c.modes); }
    guard();
    if (c.modes.length !== 2 || !same(c.modes.map(m => m.name), ['0', '1']) ||
        !text(addedMode) || c.modes[1].modeId !== addedMode || modeIds.has(addedMode)) refuse('created-selector-modes');
    modeIds.add(addedMode);
  }
  for (const planned of GRAPH.routes) {
    guard(); const c = selectors.get(planned.selector);
    const v = figma.variables.createVariable(planned.name, c, planned.resolvedType);
    result.allocation.routes.push({ name: planned.name, id: text(v?.id), key: text(v?.key) });
    guard();
    if (!text(v?.id) || !text(v?.key) || v.name !== planned.name || v.remote !== false || v.variableCollectionId !== c.id ||
        v.resolvedType !== planned.resolvedType || variableIds.has(v.id) || variableKeys.has(v.key)) refuse('created-route-identity');
    variableIds.add(v.id); variableKeys.add(v.key); routes.set(planned.name, v);
    v.setSharedPluginData(NS, KEY, JSON.stringify({ ...OWNER, routeName: planned.name, collectionId: c.id, collectionKey: c.key }));
    guard();
    v.scopes = SCOPES[planned.name];
  }
  for (const planned of GRAPH.routes) {
    const v = routes.get(planned.name), c = selectors.get(planned.selector);
    for (let bit = 0; bit < 2; bit++) {
      guard(); const edge = planned.targets[bit], target = 'route' in edge ? routes.get(edge.route) : bySourcePath.get(edge.sourcePath);
      if (!target || target.resolvedType !== v.resolvedType) refuse('alias-target');
      v.setValueForMode(c.modes[bit].modeId, figma.variables.createVariableAlias(target));
    }
  }
  guard();
  result.identity = { version: 1, graphRevision: GRAPH.revision, fileKey: figma.fileKey, source: createdSource.creationIdentity,
    selectors: copy(result.allocation.selectors), routes: copy(result.allocation.routes) };
  result.receipt = { graphRevision: GRAPH.revision, fileKey: figma.fileKey, source: createdSource.receipt,
    sourceScopes: Object.fromEntries([...bySourcePath].map(([path, v]) => [v.id, [...v.scopes].sort()])),
    selectors: GRAPH.selectors.map(s => selectorReceipt(s.key, selectors.get(s.key))), routes: GRAPH.routes.map(r => routeReceipt(routes.get(r.name))) };
  result.status = 'created-candidate';
} catch (e) {
  result.status = result.allocationAttempted ? 'partial-allocation' : 'refused';
  result.problems.push(problem(e));
}
return result;
`;
  return { graph, script };
}

export function emitNativeTemplateGraphReadbackScript(input: NativeRootTextTemplateGraphInput, identity: NativeTemplateGraphIdentity, synchronous = false): string {
  const graph = planNativeRootTextTemplateGraph(input); checkIdentity(input, graph, identity);
  return `// GENERATED independent read-only graph observation, pinned by allocated IDs.
${runtime(graph)}
const EXPECTED = ${JSON.stringify(identity)};
const result = { version: 1, status: 'refused', graphRevision: GRAPH.revision, receiptKind: 'independent-native-readback', problems: [] };
try {
  guard();
  const collections = ${synchronous ? 'EXPECTED.selectors.map(s => figma.variables.getVariableCollectionById(s.id))' : 'await Promise.all(EXPECTED.selectors.map(s => figma.variables.getVariableCollectionByIdAsync(s.id)))'};
  const variables = ${synchronous ? 'EXPECTED.routes.map(r => figma.variables.getVariableById(r.id))' : 'await Promise.all(EXPECTED.routes.map(r => figma.variables.getVariableByIdAsync(r.id)))'};
  const sourceVariables = ${synchronous ? 'EXPECTED.source.variables.map(v => figma.variables.getVariableById(v.id))' : 'await Promise.all(EXPECTED.source.variables.map(v => figma.variables.getVariableByIdAsync(v.id)))'};
  const source = ${synchronous ? '(()' : 'await (async ()'} => { ${emitNativeTokenContextReadbackScript(input.tokens, identity.source, synchronous)}\n })();
  if (source.status !== 'readback-collected') refuse('source-readback');
  guard();
  if (collections.some((c, i) => !c || c.id !== EXPECTED.selectors[i].id || c.key !== EXPECTED.selectors[i].key) ||
      variables.some((v, i) => !v || v.id !== EXPECTED.routes[i].id || v.key !== EXPECTED.routes[i].key)) refuse('readback-identity');
  result.receipt = { graphRevision: ${graph.allocationRevision ? 'GRAPH.allocationRevision' : 'GRAPH.revision'}, fileKey: figma.fileKey, source: source.receipt,
    sourceScopes: Object.fromEntries(sourceVariables.map((v, i) => {
      if (!v || v.id !== EXPECTED.source.variables[i].id || v.key !== EXPECTED.source.variables[i].key) refuse('source-readback');
      return [v.id, [...v.scopes].sort()];
    })),
    selectors: collections.map((c, i) => selectorReceipt(EXPECTED.selectors[i].selector, c)), routes: variables.map(routeReceipt) };
  result.status = 'readback-collected';
} catch (e) { result.problems.push(problem(e)); }
return result;
`;
}
