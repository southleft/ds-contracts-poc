/** Owned, unbound variable values written beside one node channel.
 * The opacity program in native-contract-update.ts is frozen: saved journals
 * authenticate its bytes. This is the same discipline with the node field and
 * the variable type as parameters. Every async read first, then the final
 * checks and all assignments with no await between them; each attempt is
 * recorded before it is made; a partial application is finished and a complete
 * one is a no-op; failure restores in reverse and names what it cannot restore.
 * The whole document is always scanned for bindings (document-v1). */
import { emitNativeContractReadbackScript, type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';
import { emitNativeTokenBindingScope } from './native-token-binding-scope.js';

/** One variable value in one mode, pinned by id. FLOAT values compare exactly
 * or as their float32 image; STRING values compare exactly. */
export interface NativeTypedTokenValueChange {
  tokenPath: string; variableId: string; modeId: string; sourceMode: string; brand: string;
  resolvedType?: 'STRING'; before: number | string; after: number | string;
}
/** The node side of the update: one readback field, compared by a named
 * program-level function, copied on every read and write. */
export interface NativeUpdateNodeChannel {
  field: 'effects';
  /** Program text defining `same(actual, expected)`. */
  same: string;
  conflict: string;
}
export interface NativeTokenValueChannelPlan {
  acceptedContract: null; nativeQualification: 'unqualified';
  before: NativeContractObservationInput; baseline: NativeSourceReadback; after: NativeContractObservationInput;
  changes: Array<{ nodeId: string; before: unknown; after: unknown }>;
  tokenChanges?: NativeTypedTokenValueChange[]; tokenBindingScope?: 'document-v1';
}

export function nativeTokenValueStored(actual: unknown, change: NativeTypedTokenValueChange, value: number | string) {
  return change.resolvedType === 'STRING' ? typeof actual === 'string' && actual === value
    : typeof value === 'number' && (actual === value || actual === Math.fround(value));
}

export function assertNativeTypedTokenChanges(plan: NativeTokenValueChannelPlan) {
  const changes = plan.tokenChanges;
  if (plan.tokenBindingScope !== 'document-v1' || !Array.isArray(changes) || !changes.length ||
      new Set(changes.map(c => c.variableId + '\n' + c.modeId)).size !== changes.length ||
      changes.some(c => !c || typeof c.variableId !== 'string' || !c.variableId || typeof c.modeId !== 'string' || !c.modeId ||
        (c.resolvedType !== undefined && c.resolvedType !== 'STRING') ||
        ![c.before, c.after].every(v => c.resolvedType === 'STRING' ? typeof v === 'string' : typeof v === 'number' && Number.isFinite(v)) ||
        !plan.before.tokenIdentity.variables.some(v => v.id === c.variableId && v.tokenPath === c.tokenPath) ||
        !plan.before.tokenIdentity.modes.some(m => m.modeId === c.modeId && m.sourceMode === c.sourceMode && m.brand === c.brand)))
    throw Error('native-update-plan-invalid');
}

export function emitNativeTokenValueChannelScript(plan: NativeTokenValueChannelPlan, channel: NativeUpdateNodeChannel,
  direction: 'apply' | 'rollback', readOnly: boolean) {
  assertNativeTypedTokenChanges(plan);
  const expected = direction === 'apply' ? plan.after : plan.before, F = JSON.stringify(channel.field);
  return `const plan = ${JSON.stringify(plan)};
const direction = ${JSON.stringify(direction)}, readOnly = ${readOnly}, field = ${F};
const out = { version: 1, kind: 'native-contract-update-result', direction, status: 'refused', changes: [], tokenChanges: [], problems: [], acceptedContract: null, nativeQualification: 'unqualified' };
const canonical = value => JSON.stringify((function sort(v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])); return v; })(value));
const clean = value => { const copy = JSON.parse(JSON.stringify(value)); delete copy.images; return copy; };
const copy = value => JSON.parse(JSON.stringify(value));
const attempted = [];
const same = ${channel.same};
const typeOf = change => change.resolvedType === 'STRING' ? 'STRING' : 'FLOAT';
const stored = (actual, expected, change) => typeOf(change) === 'STRING' ? typeof actual === 'string' && actual === expected : typeof expected === 'number' && (actual === expected || actual === Math.fround(expected));
const references = (value, id) => Array.isArray(value) ? value.some(v => references(v, id)) : !!value && typeof value === 'object' && ((value.type === 'VARIABLE_ALIAS' && value.id === id) || Object.values(value).some(v => references(v, id)));
const collectionId = plan.before.tokenIdentity.collection.id;
// Live, synchronous facts of one variable. Never found by name.
const owned = (variable, change) => variable.id === change.variableId && variable.variableCollectionId === collectionId && variable.resolvedType === typeOf(change) && variable.remote === false && !!variable.valuesByMode && typeof variable.valuesByMode[change.modeId] === (typeOf(change) === 'STRING' ? 'string' : 'number');
try {
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  if (!figma.variables || typeof figma.variables.getVariableByIdAsync !== 'function' || typeof figma.variables.getLocalVariablesAsync !== 'function') throw Error('native-update-token-api-unavailable');
  if (typeof figma.loadAllPagesAsync !== 'function') throw Error('native-update-document-scope-unavailable');
  await figma.loadAllPagesAsync();
  const nodes = new Map(), variables = new Map();
  for (const change of plan.changes) {
    const node = await figma.getNodeByIdAsync(change.nodeId);
    if (!node) throw Error('native-update-node-missing:' + change.nodeId);
    nodes.set(change.nodeId, node);
  }
  for (const change of plan.tokenChanges) {
    const variable = await figma.variables.getVariableByIdAsync(change.variableId);
    if (!variable || typeof variable.setValueForMode !== 'function') throw Error('native-update-token-variable-missing:' + change.variableId);
    variables.set(change.variableId, variable);
  }
  const current = await (async () => { ${emitNativeContractReadbackScript(plan.before)} })();
  // The last await before the writes. Re-read live bindings afterward: the
  // page or this collection may change while local variables are loading.
${emitNativeTokenBindingScope()}
  const normalized = clean(current);
  const recordedNodes = new Map((normalized.nodes || []).map(n => [n.id, n]));
  const states = [], tokenStates = [];
  for (const change of plan.tokenChanges) {
    const variable = variables.get(change.variableId);
    const row = normalized.tokens && normalized.tokens.receipt && Array.isArray(normalized.tokens.receipt.variables) ? normalized.tokens.receipt.variables.find(v => v.id === change.variableId) : undefined;
    if (!row || !owned(variable, change) || row.variableCollectionId !== collectionId || row.resolvedType !== typeOf(change) || row.remote !== false)
      throw Error('native-update-token-variable-identity:' + change.variableId);
    const value = row.valuesByMode ? row.valuesByMode[change.modeId] : undefined;
    if (![change.before, change.after].some(side => stored(value, side, change)) || variable.valuesByMode[change.modeId] !== value)
      throw Error('native-update-token-value-conflict:' + change.variableId);
    if ((normalized.nodes || []).some(n => references(n, change.variableId)) || normalized.tokens.receipt.variables.some(v => v.id !== change.variableId && references(v.valuesByMode, change.variableId)))
      throw Error('native-update-token-bound:' + change.variableId);
    // Check every local variable, including aliases introduced in our own
    // collection during the final await. Use them only to refuse, never to select a target.
    if (locals.some(v => v && references(v.valuesByMode, change.variableId)))
      throw Error('native-update-token-aliased:' + change.variableId);
    if (references(styleBindings, change.variableId)) throw Error('native-update-token-style-bound:' + change.variableId);
    if (references(bindingValues, change.variableId)) throw Error('native-update-token-bound:' + change.variableId);
    // Include newly inserted nodes and newly added binding fields. The snapshot
    // alone cannot prove a variable stayed unbound across the final await.
    for (const node of liveNodes) {
      const recorded = recordedNodes.get(node.id);
      const fields = new Set([...(Object.keys(recorded?.values || {})), 'boundVariables', 'fills', 'strokes', 'effects', ...(node.type === 'INSTANCE' ? ['componentProperties'] : [])]);
      if ([...fields].some(f => f in node && references(node[f], change.variableId)) ||
          Object.keys(recorded?.metadata || {}).some(key => node.getSharedPluginData('ds_contracts', key) === variable.name))
        throw Error('native-update-token-bound:' + change.variableId);
    }
    tokenStates.push({ variableId: change.variableId, modeId: change.modeId, value });
    row.valuesByMode[change.modeId] = change.before;
  }
  for (const change of plan.changes) {
    const row = normalized.nodes?.find(n => n.id === change.nodeId), node = nodes.get(change.nodeId);
    if (!row || ![change.before, change.after].some(value => same(row.values[field], value)) || !same(node[field], row.values[field]))
      throw Error(${JSON.stringify(channel.conflict)} + ':' + change.nodeId);
    states.push({ nodeId: change.nodeId, value: copy(row.values[field]) });
    row.values[field] = copy(change.before);
  }
  if (canonical(normalized) !== canonical(clean(plan.baseline))) throw Error('native-update-baseline-conflict');
  out.states = states; out.tokenStates = tokenStates;
  if (readOnly) { out.status = 'preflight-observed'; out.observation = current; return out; }
  // After the complete async read, there is no await between the final
  // precondition checks above and these writes. Every attempt is recorded
  // before assignment. Variable values first, then the node values that show them.
  for (const change of plan.tokenChanges) {
    const variable = variables.get(change.variableId), target = direction === 'apply' ? change.after : change.before;
    if (stored(variable.valuesByMode[change.modeId], target, change)) continue;
    attempted.push({ variable, change, previous: variable.valuesByMode[change.modeId] });
    variable.setValueForMode(change.modeId, target);
    out.tokenChanges.push(change.variableId);
  }
  for (const change of plan.changes) {
    const node = nodes.get(change.nodeId), target = direction === 'apply' ? change.after : change.before;
    if (same(node[field], target)) continue;
    attempted.push({ node, change, previous: copy(node[field]) });
    node[field] = copy(target);
    out.changes.push(change.nodeId);
  }
  out.observation = await (async () => { ${emitNativeContractReadbackScript(expected)} })();
  const side = change => direction === 'apply' ? change.after : change.before;
  const expectedAfter = clean(plan.baseline);
  for (const change of plan.changes) expectedAfter.nodes.find(n => n.id === change.nodeId).values[field] = copy(side(change));
  for (const change of plan.tokenChanges) expectedAfter.tokens.receipt.variables.find(v => v.id === change.variableId).valuesByMode[change.modeId] = side(change);
  const observedAfter = clean(out.observation);
  for (const change of plan.changes) {
    const row = observedAfter.nodes?.find(n => n.id === change.nodeId);
    if (row && same(row.values[field], side(change))) row.values[field] = copy(side(change));
  }
  for (const change of plan.tokenChanges) {
    const row = observedAfter.tokens && observedAfter.tokens.receipt && Array.isArray(observedAfter.tokens.receipt.variables) ? observedAfter.tokens.receipt.variables.find(v => v.id === change.variableId) : undefined;
    if (row && row.valuesByMode && stored(row.valuesByMode[change.modeId], side(change), change)) row.valuesByMode[change.modeId] = side(change);
  }
  if (canonical(observedAfter) !== canonical(expectedAfter)) throw Error('native-update-postcondition-conflict');
  out.status = out.changes.length || out.tokenChanges.length ? 'updated' : 'no-op';
} catch (error) {
  out.problems.push(error && error.message ? error.message : String(error));
  const unrestored = [];
  for (const attempt of attempted.reverse()) {
    const id = attempt.variable ? attempt.change.variableId : attempt.change.nodeId;
    try {
      const target = direction === 'apply' ? attempt.change.after : attempt.change.before;
      if (attempt.variable) {
        // Do not overwrite an independent edit made after this assignment.
        if (stored(attempt.variable.valuesByMode[attempt.change.modeId], target, attempt.change)) attempt.variable.setValueForMode(attempt.change.modeId, attempt.previous);
        if (!stored(attempt.variable.valuesByMode[attempt.change.modeId], attempt.previous, attempt.change)) unrestored.push(id);
      } else {
        if (same(attempt.node[field], target)) attempt.node[field] = copy(attempt.previous);
        if (!same(attempt.node[field], attempt.previous)) unrestored.push(id);
      }
    } catch { unrestored.push(id); }
  }
  out.status = unrestored.length ? 'recovery-required' : attempted.length ? 'rolled-back' : 'refused';
  out.unrestored = unrestored;
}
return out;`;
}
