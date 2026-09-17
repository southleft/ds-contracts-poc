/** Bounded corrections to an existing unaccepted native draft. Creation
 * identities remain immutable; the update journal supplies the new revision. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import type { ComponentData, NodeSpec } from './emit-figma-script.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback,
  type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';
import type { NativeTokenContextInput } from './native-token-context.js';
import { flattenTokens } from './tokens.js';

export interface NativeContractUpdateInput {
  before: NativeContractObservationInput;
  baseline: NativeSourceReadback;
  desired: { component: ComponentData; revision: string; tokenInput: NativeTokenContextInput };
}
export interface NativeContractUpdatePlan {
  version: 1; kind: 'native-contract-opacity-update';
  acceptedContract: null; nativeQualification: 'unqualified';
  before: NativeContractObservationInput; baseline: NativeSourceReadback;
  desiredRevision: string;
  changes: Array<{ nodeId: string; variant: string; part: string; before: number; after: number }>;
  after: NativeContractObservationInput;
}
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const scalar = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const part = (node: Record<string, any>) => {
  try { return JSON.parse(node.metadata.nativeContractPart); } catch { return null; }
};
export function prepareNativeContractUpdate(input: NativeContractUpdateInput) {
  if (!/^sha256:[a-f0-9]{64}$/.test(input.desired.revision) ||
      verifyNativeContractReadback(input.before, input.baseline).status !== 'supported-structure-observed')
    throw Error('native-update-verified-baseline-required');
  // Existing variable values and identities must remain unchanged. Additional
  // unbound scalar tokens need no native allocation for this literal channel.
  if (input.before.tokenInput.modes.length !== input.desired.tokenInput.modes.length)
    throw Error('native-update-token-modes-unsupported');
  for (const mode of input.before.tokenInput.modes) {
    const desired = input.desired.tokenInput.modes.find(m => m.sourceMode === mode.sourceMode && m.brand === mode.brand && m.nativeModeName === mode.nativeModeName);
    if (!desired) throw Error('native-update-token-mode-unsupported');
    const oldTokens = flattenTokens(mode.tokens), newTokens = flattenTokens(desired.tokens);
    for (const [name, value] of oldTokens) if (!equal(value, newTokens.get(name))) throw Error('native-update-bound-token-change-unsupported');
  }
  const before = structuredClone(input.before); delete before.allocationAnchor;
  const after = structuredClone(before), desired = structuredClone(input.desired.component);
  const baseline = structuredClone(input.baseline); delete baseline.images;
  const changes: NativeContractUpdatePlan['changes'] = [];
  function visit(old: NodeSpec, next: NodeSpec, updated: NodeSpec) {
    if (!old.nativeContractPart || !next.nativeContractPart || old.children?.length !== next.children?.length)
      throw Error('native-update-topology-change-unsupported');
    const left = { ...old, children: undefined, nativeContractPart: undefined, opacity: undefined };
    const right = { ...next, children: undefined, nativeContractPart: undefined, opacity: undefined };
    if (!equal(left, right)) throw Error('native-update-channel-change-unsupported');
    if (!equal(old.nativeContractPart.specPath, next.nativeContractPart.specPath) || old.nativeContractPart.variant !== next.nativeContractPart.variant)
      throw Error('native-update-part-identity-changed');
    const matching = baseline.nodes!.filter(n => equal(part(n), old.nativeContractPart));
    // Imported SVG descendants share their owning spec identity. Only the
    // imported root receives the node opacity; descendants inherit it.
    const rows = old.type === 'svg' ? matching.filter(n => !matching.some(parent => parent.id === n.parentId)) : matching;
    if (rows.length !== 1 || !scalar(rows[0].values.opacity) || rows[0].values.boundVariables?.opacity)
      throw Error('native-update-owned-opacity-unavailable');
    const target = next.opacity ?? 1;
    if (!scalar(target)) throw Error('native-update-opacity-invalid');
    updated.opacity = target;
    if (rows[0].values.opacity !== target) changes.push({ nodeId: rows[0].id, variant: old.nativeContractPart.variant,
      part: old.nativeContractPart.specPath.length ? old.name : 'Component', before: rows[0].values.opacity, after: target });
    old.children?.forEach((child, i) => visit(child, next.children![i], updated.children![i]));
  }
  const oldHeader = { ...before.component, variants: undefined, nativeContractDraft: undefined };
  const newHeader = { ...desired, variants: undefined, nativeContractDraft: undefined };
  if (!equal(oldHeader, newHeader) || before.component.variants.length !== desired.variants.length)
    throw Error('native-update-component-change-unsupported');
  before.component.variants.forEach((v, i) => {
    const next = desired.variants[i];
    if (!equal({ ...v, spec: undefined }, { ...next, spec: undefined })) throw Error('native-update-variant-change-unsupported');
    visit(v.spec, next.spec, after.component.variants[i].spec);
  });
  const plan: NativeContractUpdatePlan = { version: 1, kind: 'native-contract-opacity-update', acceptedContract: null,
    nativeQualification: 'unqualified', before, baseline, desiredRevision: input.desired.revision, changes, after };
  const revision = revisionOf(plan);
  return { plan, revision };
}

/** Host verification uses the same independent reader as creation, with the
 * old immutable allocation identities and explicitly updated expected values. */
export function verifyNativeContractUpdate(plan: NativeContractUpdatePlan, receipt: unknown, direction: 'apply' | 'rollback' = 'apply') {
  return verifyNativeContractReadback(direction === 'apply' ? plan.after : plan.before, receipt);
}

/** Independently check a preflight or completed update against the complete
 * saved observation, allowing only the pinned scalar transitions. */
export function nativeContractUpdateMatches(plan: NativeContractUpdatePlan, receipt: unknown, complete = false): boolean {
  try {
    const normalized = structuredClone(receipt) as NativeSourceReadback;
    delete normalized.images;
    for (const change of plan.changes) {
      const row = normalized.nodes?.find(n => n.id === change.nodeId);
      if (!row || !(complete ? [change.after] : [change.before, change.after]).includes(row.values.opacity)) return false;
      row.values.opacity = change.before;
    }
    return equal(normalized, plan.baseline) && verifyNativeContractReadback(plan.before, normalized).status === 'supported-structure-observed';
  } catch { return false; }
}

/** No allocation, deletion or metadata rewriting. A fresh complete readback
 * must match the saved baseline except for this operation's exact before/after
 * values. The same program can finish a partial application or make no writes.
 * Transport must still resolve an unknown delivery before explicitly resuming. */
export function emitNativeContractUpdateScript(plan: NativeContractUpdatePlan, direction: 'apply' | 'rollback' = 'apply', readOnly = false) {
  if (plan.kind !== 'native-contract-opacity-update' || plan.acceptedContract !== null || plan.nativeQualification !== 'unqualified')
    throw Error('native-update-plan-invalid');
  const expected = direction === 'apply' ? plan.after : plan.before;
  return `const plan = ${JSON.stringify(plan)};
const direction = ${JSON.stringify(direction)}, readOnly = ${readOnly};
const out = { version: 1, kind: 'native-contract-update-result', direction, status: 'refused', changes: [], problems: [], acceptedContract: null, nativeQualification: 'unqualified' };
const canonical = value => JSON.stringify((function sort(v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])); return v; })(value));
const clean = value => { const copy = JSON.parse(JSON.stringify(value)); delete copy.images; return copy; };
const attempted = [];
try {
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  const nodes = new Map();
  for (const change of plan.changes) {
    const node = await figma.getNodeByIdAsync(change.nodeId);
    if (!node) throw Error('native-update-node-missing:' + change.nodeId);
    nodes.set(change.nodeId, node);
  }
  const current = await (async () => { ${emitNativeContractReadbackScript(plan.before)} })();
  const normalized = clean(current);
  const states = [];
  for (const change of plan.changes) {
    const row = normalized.nodes?.find(n => n.id === change.nodeId), node = nodes.get(change.nodeId);
    if (!row || ![change.before, change.after].includes(row.values.opacity) || node.opacity !== row.values.opacity || node.boundVariables?.opacity)
      throw Error('native-update-opacity-conflict:' + change.nodeId);
    states.push({ nodeId: change.nodeId, value: row.values.opacity });
    row.values.opacity = change.before;
  }
  if (canonical(normalized) !== canonical(clean(plan.baseline))) throw Error('native-update-baseline-conflict');
  out.states = states;
  if (readOnly) { out.status = 'preflight-observed'; out.observation = current; return out; }
  // After the complete async read, there is no await between final scalar
  // precondition checks and writes. Every attempt is recorded before assignment.
  for (const change of plan.changes) {
    const node = nodes.get(change.nodeId), target = direction === 'apply' ? change.after : change.before;
    if (node.opacity === target) continue;
    attempted.push({ node, change, previous: node.opacity });
    node.opacity = target;
    out.changes.push(change.nodeId);
  }
  out.observation = await (async () => { ${emitNativeContractReadbackScript(expected)} })();
  const expectedAfter = clean(plan.baseline);
  for (const change of plan.changes) expectedAfter.nodes.find(n => n.id === change.nodeId).values.opacity = direction === 'apply' ? change.after : change.before;
  if (canonical(clean(out.observation)) !== canonical(expectedAfter)) throw Error('native-update-postcondition-conflict');
  out.status = out.changes.length ? 'updated' : 'no-op';
} catch (error) {
  out.problems.push(error && error.message ? error.message : String(error));
  const unrestored = [];
  for (const attempt of attempted.reverse()) {
    try {
      const target = direction === 'apply' ? attempt.change.after : attempt.change.before;
      if (attempt.node.opacity === target) attempt.node.opacity = attempt.previous;
      if (attempt.node.opacity !== attempt.previous) unrestored.push(attempt.change.nodeId);
    } catch { unrestored.push(attempt.change.nodeId); }
  }
  out.status = unrestored.length ? 'recovery-required' : attempted.length ? 'rolled-back' : 'refused';
  out.unrestored = unrestored;
}
return out;`;
}
