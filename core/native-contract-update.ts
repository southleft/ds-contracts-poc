import { emitNativeTokenBindingScope } from './native-token-binding-scope.js';
import {prepareNativeTokenAllocationUpdate,resolveNativeTokenAllocationUpdate,nativeTokenAllocationUpdateMatches,
  emitNativeTokenAllocationUpdateScript,type NativeTokenAllocationUpdatePlan} from './native-contract-token-allocation.js';
import {prepareNativeBoundCrossSizeUpdate,type NativeBoundCrossSizeUpdatePlan} from './native-contract-bound-cross-size-update.js';
import {emitNativeBoundCrossSizeUpdateScript} from './native-contract-bound-cross-size-writer.js';
import {nativeBoundCrossSizeObservationMatches} from './native-bound-cross-size-observation.js';
import {prepareNativeAbsoluteShapeUpdate,nativeAbsoluteShapeUpdateMatches,emitNativeAbsoluteShapeUpdateScript,type NativeAbsoluteShapeUpdatePlan} from './native-contract-absolute-shape-update.js';
import {prepareNativeDefaultFillUpdate, nativeDefaultFillUpdateMatches, emitNativeDefaultFillUpdateScript, type NativeDefaultFillUpdatePlan} from './native-contract-default-fill-update.js';
import {prepareNativeBackgroundUpdate, nativeBackgroundUpdateMatches, resolveNativeBackgroundUpdateInput, emitNativeBackgroundUpdateScript, type NativeBackgroundUpdatePlan} from './native-contract-background-update.js';
import {prepareNativeSvgUpdate,emitNativeSvgUpdateScript,nativeSvgUpdateMatches,type NativeSvgUpdatePlan} from './native-contract-svg-update.js';
import { prepareNativeRootSizeUpdate, emitNativeRootSizeUpdateScript, nativeRootSizeUpdateMatches, type NativeRootSizeUpdatePlan } from './native-contract-size-update.js';
import { prepareNativeShadowUpdate, emitNativeShadowUpdateScript, nativeShadowUpdateMatches, type NativeShadowUpdatePlan } from './native-contract-shadow-update.js';
/** Bounded corrections to an existing unaccepted native draft. Creation
 * identities remain immutable; the update journal supplies the new revision. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import type { ComponentData, NodeSpec } from './emit-figma-script.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback,
  type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';
import { prepareNativeTokenContext, setNativeTokenLeafValue, type NativeTokenContextInput, type NativeTokenPreparation } from './native-token-context.js';
import { aliasTarget, flattenTokens } from './tokens.js';

export interface NativeContractUpdateInput {
  before: NativeContractObservationInput;
  baseline: NativeSourceReadback;
  desired: { component: ComponentData; revision: string; tokenInput: NativeTokenContextInput };
}
export interface NativeOpacityUpdatePlan {
  version: 1; kind: 'native-contract-opacity-update';
  acceptedContract: null; nativeQualification: 'unqualified';
  before: NativeContractObservationInput; baseline: NativeSourceReadback;
  desiredRevision: string;
  changes: Array<{ nodeId: string; variant: string; part: string; before: number; after: number }>;
  after: NativeContractObservationInput;
  /** Absent unless a value of an owned, allocated, UNBOUND variable changed. A
   * plan without it is byte-identical to one prepared before this field existed. */
  tokenChanges?: NativeTokenValueChange[];
  /** New variable writes inspect the whole document. Absent on historical plans. */
  tokenBindingScope?: 'document-v1';
}
/** One variable value in one mode. The id and mode id come from the host-pinned
 * token identity, never from a name search. `before` is the value the verified
 * baseline stored; `after` is the compiled desired value. */
export interface NativeTokenValueChange {
  tokenPath: string; variableId: string; modeId: string; sourceMode: string; brand: string;
  before: number; after: number;
}
/** `$type`s whose compiled variable is one FLOAT the token reader verifies
 * exactly or as its float32 image. Anything else is refused by name. */
const CARRIED_TOKEN_TYPES = new Set(['number']);
const label = (text: string) => text.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
/** Every string anywhere inside a value. */
const strings = (value: unknown, out = new Set<string>()): Set<string> => {
  if (typeof value === 'string') out.add(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
};
/** Any `{ type: 'VARIABLE_ALIAS', id }` anywhere inside a recorded value. */
const references = (value: unknown, id: string): boolean => Array.isArray(value) ? value.some(v => references(v, id))
  : !!value && typeof value === 'object' && (((value as any).type === 'VARIABLE_ALIAS' && (value as any).id === id) ||
    Object.values(value as object).some(v => references(v, id)));
/** Bound means: an owned node references the variable in ANY recorded field
 * (node, paint, effect or text bindings), names it in its metadata, or another
 * allocated variable aliases it. No channel list. */
function variableBound(baseline: NativeSourceReadback, variableId: string, variableName: string): boolean {
  return (baseline.nodes ?? []).some(row => references(row, variableId) ||
      Object.values(row.metadata ?? {}).some(value => value === variableName)) ||
    (baseline.tokens?.receipt?.variables ?? []).some((v: any) => v.id !== variableId && references(v.valuesByMode, variableId));
}
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const scalar = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const part = (node: Record<string, any>) => {
  try { return JSON.parse(node.metadata.nativeContractPart); } catch { return null; }
};
export type NativeContractUpdatePlan = NativeTokenAllocationUpdatePlan | NativeDefaultFillUpdatePlan | NativeOpacityUpdatePlan | NativeRootSizeUpdatePlan | NativeShadowUpdatePlan | NativeSvgUpdatePlan | NativeBackgroundUpdatePlan | NativeAbsoluteShapeUpdatePlan | NativeBoundCrossSizeUpdatePlan;
export function prepareNativeContractUpdate(input: NativeContractUpdateInput): { plan: NativeContractUpdatePlan; revision: string } {
  if (input.before.projection.rootTextTemplate || input.before.component.rootSlot?.textTemplate || input.desired.component.rootSlot?.textTemplate)
    throw Error('native-update-root-text-template-unqualified');
  const allocation=prepareNativeTokenAllocationUpdate(input);
  if(allocation)return allocation;
  // Only the scalar plan carries variable values. A sibling kind's matcher and
  // program know nothing of them, so a mixed change is refused by name.
  const scalarOnly = (base: NativeContractUpdateInput) => prepareOpacityUpdate(base, false);
  return prepareNativeBoundCrossSizeUpdate(input, scalarOnly) ?? prepareNativeDefaultFillUpdate(input, scalarOnly) ?? prepareNativeBackgroundUpdate(input, scalarOnly) ?? prepareNativeSvgUpdate(input, scalarOnly) ?? prepareNativeShadowUpdate(input, scalarOnly) ?? prepareNativeRootSizeUpdate(input, scalarOnly) ?? prepareNativeAbsoluteShapeUpdate(input, scalarOnly) ?? prepareOpacityUpdate(input);
}
/** Figma stores opacity as IEEE-754 float32: writing 0.4 reads back as
 * 0.4000000059604645. Exact, or the float32 image of the intended value; no
 * wider tolerance. The same policy already governs colours, strokes and grids. */
const stored = (actual: unknown, expected: number) => actual === expected || actual === Math.fround(expected);
function prepareOpacityUpdate(input: NativeContractUpdateInput, carryTokenValues = true) {
  if (!/^sha256:[a-f0-9]{64}$/.test(input.desired.revision) ||
      verifyNativeContractReadback(input.before, input.baseline).status !== 'supported-structure-observed')
    throw Error('native-update-verified-baseline-required');
  // Variable identities, aliases, types and the allocated paths never change.
  // A VALUE of an owned, allocated, unbound variable is carried; additional
  // unbound scalar tokens need no native allocation for this literal channel.
  if (input.before.tokenInput.modes.length !== input.desired.tokenInput.modes.length)
    throw Error('native-update-token-modes-unsupported');
  const valueChanges: Array<{ modeIndex: number; tokenPath: string; value: unknown }> = [];
  input.before.tokenInput.modes.forEach((mode, modeIndex) => {
    const desired = input.desired.tokenInput.modes.find(m => m.sourceMode === mode.sourceMode && m.brand === mode.brand && m.nativeModeName === mode.nativeModeName);
    if (!desired) throw Error('native-update-token-mode-unsupported');
    const oldTokens = flattenTokens(mode.tokens), newTokens = flattenTokens(desired.tokens);
    // Name the token: an operator cannot resolve "a token changed".
    for (const [name, value] of oldTokens) {
      const next = newTokens.get(name);
      if (!next) throw Error('native-update-bound-token-change-unsupported:removed;' + label(name));
      if (!equal(value, next)) valueChanges.push({ modeIndex, tokenPath: name, value: next.value });
    }
    // A leaf new to the source is allocated by nothing here. Production requests
    // every leaf (so it refuses by the path check below). A new leaf the source
    // does NOT request stays additive only while the desired component never
    // names it: the shared fixture's `nextOpacity` feeds a literal opacity and
    // is named nowhere in the compiled component. A leaf the component names
    // (any string, no channel list; conservative on short names) would need a
    // variable this update cannot create.
    const named = strings(input.desired.component);
    for (const name of newTokens.keys())
      if (!oldTokens.has(name) && (named.has(name) || named.has(name.replaceAll('.', '/'))))
        throw Error('native-update-token-allocation-change-unsupported:requested;' + label(name));
  });
  // The allocation is the requested set. Adding or releasing a path would
  // allocate or orphan a variable; neither is an update.
  const wasRequested = new Set(input.before.tokenInput.tokenPaths), nowRequested = new Set(input.desired.tokenInput.tokenPaths);
  for (const path of [...nowRequested].sort()) if (!wasRequested.has(path))
    throw Error('native-update-token-allocation-change-unsupported:requested;' + label(path));
  for (const path of [...wasRequested].sort()) if (!nowRequested.has(path))
    throw Error('native-update-token-allocation-change-unsupported:released;' + label(path));
  const before = structuredClone(input.before); delete before.allocationAnchor;
  const tokenUpdate = valueChanges.length ? prepareTokenValueChanges(input, valueChanges, carryTokenValues) : undefined;
  const after = structuredClone(before), desired = structuredClone(input.desired.component);
  if (tokenUpdate) after.tokenInput = tokenUpdate.tokenInput;
  const baseline = structuredClone(input.baseline); delete baseline.images;
  const changes: NativeOpacityUpdatePlan['changes'] = [];
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
    if (!stored(rows[0].values.opacity, target)) changes.push({ nodeId: rows[0].id, variant: old.nativeContractPart.variant,
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
  const plan: NativeOpacityUpdatePlan = { version: 1, kind: 'native-contract-opacity-update', acceptedContract: null,
    nativeQualification: 'unqualified', before, baseline, desiredRevision: input.desired.revision, changes, after,
    ...(tokenUpdate?.tokenChanges.length ? { tokenChanges: tokenUpdate.tokenChanges, tokenBindingScope: 'document-v1' } : {}) };
  const revision = revisionOf(plan);
  return { plan, revision };
}

/** Eligibility of every changed token value, and the token input the update
 * leaves behind. Every refusal names the token path. */
function prepareTokenValueChanges(input: NativeContractUpdateInput,
  valueChanges: Array<{ modeIndex: number; tokenPath: string; value: unknown }>, carryTokenValues: boolean) {
  const tokenInput = input.before.tokenInput, identity = input.before.tokenIdentity;
  const prepared = prepareNativeTokenContext(tokenInput);
  const observed = new Map<string, any>((input.baseline.tokens?.receipt?.variables ?? []).map((v: any) => [v.id, v]));
  for (const change of valueChanges) {
    const name = label(change.tokenPath), mode = tokenInput.modes[change.modeIndex];
    const desiredMode = input.desired.tokenInput.modes.find(m => m.sourceMode === mode.sourceMode && m.brand === mode.brand && m.nativeModeName === mode.nativeModeName)!;
    const old = flattenTokens(mode.tokens).get(change.tokenPath)!, next = flattenTokens(desiredMode.tokens).get(change.tokenPath)!;
    if (!carryTokenValues) throw Error('native-update-token-value-mixed-channels-unqualified:' + name);
    const variable = prepared.variables.find(v => v.tokenPath === change.tokenPath);
    const pinned = identity.variables.find(v => v.tokenPath === change.tokenPath);
    if (!variable || !pinned || !observed.has(pinned.id)) throw Error('native-update-token-unallocated:' + name);
    // Truthful only here: something on the canvas resolves through this variable.
    if (variableBound(input.baseline, pinned.id, variable.name))
      throw Error('native-update-bound-token-change-unsupported:changed;' + name);
    if (aliasTarget(old.value) !== null || aliasTarget(next.value) !== null)
      throw Error('native-update-token-alias-change-unsupported:' + name);
    if (old.type !== next.type) throw Error('native-update-token-type-change-unsupported:' + name);
    if (!CARRIED_TOKEN_TYPES.has(old.type) || variable.resolvedType !== 'FLOAT' || observed.get(pinned.id).resolvedType !== 'FLOAT')
      throw Error('native-update-token-type-unsupported:' + label(old.type || 'untyped').slice(0, 16) + ';' + name); // host reasons cap at 80
    if (!equal({ ...old, value: null }, { ...next, value: null }))
      throw Error('native-update-token-extensions-change-unsupported:' + name);
  }
  // The trees carry the new raw values. The allocation is still re-derivable:
  // each leaf remembers the value it was allocated with, once, and forgets it
  // again when a later update returns to that value.
  const next: NativeTokenContextInput = structuredClone(tokenInput);
  const allocated = new Map((next.allocatedValues ?? []).map(row => [JSON.stringify([row.sourceMode, row.brand, row.tokenPath]), row]));
  for (const change of valueChanges) {
    const mode = next.modes[change.modeIndex], key = JSON.stringify([mode.sourceMode, mode.brand, change.tokenPath]);
    const previous = flattenTokens(mode.tokens).get(change.tokenPath)!.value;
    setNativeTokenLeafValue(mode.tokens, change.tokenPath, structuredClone(change.value));
    if (!allocated.has(key)) allocated.set(key, { sourceMode: mode.sourceMode, brand: mode.brand, tokenPath: change.tokenPath, value: structuredClone(previous) });
    if (equal(allocated.get(key)!.value, change.value)) allocated.delete(key);
    mode.tokenTreeRevision = revisionOf(mode.tokens);
  }
  delete next.allocatedValues;
  if (allocated.size) next.allocatedValues = [...allocated.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, row]) => row);
  let desired: NativeTokenPreparation;
  try { desired = prepareNativeTokenContext(next); }
  catch (error) { throw Error('native-update-token-values-unqualified:' + label(String((error as Error)?.message).replace(/^native-token-context-/, ''))); }
  if (desired.revision !== identity.preparationRevision) throw Error('native-update-token-allocation-identity-changed');
  const tokenChanges: NativeTokenValueChange[] = [];
  for (const change of valueChanges) {
    const pinned = identity.variables.find(v => v.tokenPath === change.tokenPath)!, mode = identity.modes[change.modeIndex];
    const planned = prepared.variables.find(v => v.tokenPath === change.tokenPath)!.values[change.modeIndex].value;
    const target = desired.variables.find(v => v.tokenPath === change.tokenPath)!.values[change.modeIndex].value;
    const stored_ = observed.get(pinned.id).valuesByMode?.[mode.modeId];
    if (typeof planned !== 'number' || typeof target !== 'number' || !Number.isFinite(target) || typeof stored_ !== 'number' || !stored(stored_, planned))
      throw Error('native-update-token-value-unavailable:' + label(change.tokenPath));
    // A different spelling of the same number changes the tree, not the canvas.
    if (stored(stored_, target)) continue;
    tokenChanges.push({ tokenPath: change.tokenPath, variableId: pinned.id, modeId: mode.modeId,
      sourceMode: mode.sourceMode, brand: mode.brand, before: stored_, after: target });
  }
  return { tokenInput: next, tokenChanges };
}

/** Host verification uses the same independent reader as creation, with the
 * old immutable allocation identities and explicitly updated expected values. */
export function verifyNativeContractUpdate(plan: NativeContractUpdatePlan, receipt: unknown, direction: 'apply' | 'rollback' = 'apply') {
  if(plan.kind==='native-contract-token-allocation-update') {
    try {if(direction!=='apply'||!nativeTokenAllocationUpdateMatches(plan,receipt as NativeSourceReadback,true))throw Error('mismatch');
      return verifyNativeContractReadback(resolveNativeTokenAllocationUpdate(plan,receipt as NativeSourceReadback),receipt);
    }catch {const result=verifyNativeContractReadback(plan.before,receipt);return {...result,status:'refused' as const,problems:[...result.problems,'native-update-token-allocation-observation-mismatch']};}
  }
  if(plan.kind==='native-contract-background-update') {
    try {return verifyNativeContractReadback(direction==='apply'?resolveNativeBackgroundUpdateInput(plan,receipt):plan.before,receipt);}
    catch {const result=verifyNativeContractReadback(plan.before,receipt);return {...result,status:'refused' as const,problems:[...result.problems,'native-update-background-observation-mismatch']};}
  }
  const result = verifyNativeContractReadback(direction === 'apply' ? plan.after : plan.before, receipt);
  if (plan.kind === 'native-contract-bound-cross-size-update' &&
      !nativeBoundCrossSizeObservationMatches(plan,receipt,direction === 'apply'?'after':'before'))
    return {...result,status:'refused' as const,problems:[...result.problems,'native-update-bound-cross-size-observation-mismatch']};
  if (plan.kind === 'native-contract-absolute-shape-update' &&
      !nativeAbsoluteShapeUpdateMatches(plan,receipt,direction === 'apply',direction === 'rollback'))
    return {...result,status:'refused' as const,problems:[...result.problems,'native-update-absolute-shape-observation-mismatch']};
  if (plan.kind === 'native-contract-default-fill-update' && !nativeDefaultFillUpdateMatches(plan, receipt, direction === 'apply'))
    return { ...result, status: 'refused' as const, problems: [...result.problems, 'native-update-default-fill-observation-mismatch'] };
  if (plan.kind === 'native-contract-svg-update' && (!nativeSvgUpdateMatches(plan, receipt, direction === 'apply') ||
      direction === 'rollback' && plan.changes.some(c => (receipt as NativeSourceReadback)?.nodes?.find(n => n.id === c.nodeId)?.values.strokeWeight !== c.before)))
    return { ...result, status: 'refused' as const, problems: [...result.problems, 'native-update-svg-observation-mismatch'] };
  return result;
}

/** True only when a fresh readback is the saved baseline itself: no part of the
 * update reached the canvas and nothing else moved. Conservative by design; a
 * readback that is neither this nor the completed update stays unresolved. */
export function nativeContractUpdateUntouched(plan: NativeContractUpdatePlan, receipt: unknown): boolean {
  if (plan.kind === 'native-contract-bound-cross-size-update') return nativeBoundCrossSizeObservationMatches(plan,receipt,'before');
  if (plan.kind === 'native-contract-absolute-shape-update') return nativeAbsoluteShapeUpdateMatches(plan,receipt,false,true);
  try {
    const normalized = structuredClone(receipt) as NativeSourceReadback;
    delete normalized.images;
    return equal(normalized, plan.baseline) && verifyNativeContractReadback(plan.before, normalized).status === 'supported-structure-observed';
  } catch { return false; }
}
/** Independently check a preflight or completed update against the complete
 * saved observation, allowing only the pinned scalar transitions. */
export function nativeContractUpdateMatches(plan: NativeContractUpdatePlan, receipt: unknown, complete = false): boolean {
  if(plan.kind==='native-contract-token-allocation-update')return nativeTokenAllocationUpdateMatches(plan,receipt as NativeSourceReadback,complete);
  if (plan.kind === 'native-contract-bound-cross-size-update') return nativeBoundCrossSizeObservationMatches(plan,receipt,complete?'after':'partial');
  if (plan.kind === 'native-contract-absolute-shape-update') return nativeAbsoluteShapeUpdateMatches(plan,receipt,complete);
  if (plan.kind === 'native-contract-default-fill-update') return nativeDefaultFillUpdateMatches(plan, receipt, complete);
  if (plan.kind === 'native-contract-background-update') return nativeBackgroundUpdateMatches(plan,receipt,complete);
  if (plan.kind === 'native-contract-svg-update') return nativeSvgUpdateMatches(plan, receipt, complete);
  if (plan.kind === 'native-contract-shadow-update') return nativeShadowUpdateMatches(plan, receipt, complete);
  if (plan.kind === 'native-contract-root-size-update') return nativeRootSizeUpdateMatches(plan, receipt, complete);
  try {
    const normalized = structuredClone(receipt) as NativeSourceReadback;
    delete normalized.images;
    for (const change of plan.changes) {
      const row = normalized.nodes?.find(n => n.id === change.nodeId);
      if (!row || !(complete ? [change.after] : [change.before, change.after]).some(value => stored(row.values.opacity, value))) return false;
      row.values.opacity = change.before;
    }
    // Variable values are pinned transitions like any node scalar: the value is
    // one side of the change (only the new side once complete), nothing else.
    for (const change of plan.tokenChanges ?? []) {
      const row = normalized.tokens?.receipt?.variables?.find((v: any) => v.id === change.variableId);
      if (!row || !row.valuesByMode || !(complete ? [change.after] : [change.before, change.after]).some(value => stored(row.valuesByMode[change.modeId], value))) return false;
      row.valuesByMode[change.modeId] = change.before;
    }
    // A completed value update must also satisfy the token input it leaves behind.
    if (complete && plan.tokenChanges?.length && verifyNativeContractReadback(plan.after, receipt).status !== 'supported-structure-observed') return false;
    return equal(normalized, plan.baseline) && verifyNativeContractReadback(plan.before, normalized).status === 'supported-structure-observed';
  } catch { return false; }
}

/** Dispatch the qualified migration writer or a scalar-only correction.
 * Scalar corrections allocate nothing and rewrite no metadata. A fresh readback
 * must match the saved baseline except for this operation's exact before/after
 * values. The same program can finish a partial application or make no writes.
 * Transport must still resolve an unknown delivery before explicitly resuming. */
export function emitNativeContractUpdateScript(plan: NativeContractUpdatePlan, direction: 'apply' | 'rollback' = 'apply', readOnly = false) {
  if(plan.kind==='native-contract-token-allocation-update')return emitNativeTokenAllocationUpdateScript(plan,direction,readOnly);
  if (plan.kind === 'native-contract-bound-cross-size-update') return emitNativeBoundCrossSizeUpdateScript(plan,direction,readOnly);
  if (plan.kind === 'native-contract-absolute-shape-update') return emitNativeAbsoluteShapeUpdateScript(plan,direction,readOnly);
  if (plan.kind === 'native-contract-default-fill-update') return emitNativeDefaultFillUpdateScript(plan, direction, readOnly);
  if (plan.kind === 'native-contract-background-update') return emitNativeBackgroundUpdateScript(plan,direction,readOnly);
  if (plan.kind === 'native-contract-svg-update') return emitNativeSvgUpdateScript(plan, direction, readOnly);
  if (plan.kind === 'native-contract-shadow-update') return emitNativeShadowUpdateScript(plan, direction, readOnly);
  if (plan.kind === 'native-contract-root-size-update') return emitNativeRootSizeUpdateScript(plan, direction, readOnly);
  if (plan.kind !== 'native-contract-opacity-update' || plan.acceptedContract !== null || plan.nativeQualification !== 'unqualified')
    throw Error('native-update-plan-invalid');
  const expected = direction === 'apply' ? plan.after : plan.before;
  // The program below is unchanged for every plan without variable values, so
  // saved journals keep authenticating their pinned scripts byte for byte.
  if (plan.tokenChanges !== undefined) return emitTokenValueUpdateScript(plan, direction, readOnly);
  return `const plan = ${JSON.stringify(plan)};
const direction = ${JSON.stringify(direction)}, readOnly = ${readOnly};
const out = { version: 1, kind: 'native-contract-update-result', direction, status: 'refused', changes: [], problems: [], acceptedContract: null, nativeQualification: 'unqualified' };
const canonical = value => JSON.stringify((function sort(v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])); return v; })(value));
const clean = value => { const copy = JSON.parse(JSON.stringify(value)); delete copy.images; return copy; };
const attempted = [];
const stored = (actual, expected) => actual === expected || actual === Math.fround(expected);
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
    if (!row || ![change.before, change.after].some(value => stored(row.values.opacity, value)) || node.opacity !== row.values.opacity || node.boundVariables?.opacity)
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
    if (stored(node.opacity, target)) continue;
    attempted.push({ node, change, previous: node.opacity });
    node.opacity = target;
    out.changes.push(change.nodeId);
  }
  out.observation = await (async () => { ${emitNativeContractReadbackScript(expected)} })();
  const expectedAfter = clean(plan.baseline);
  for (const change of plan.changes) expectedAfter.nodes.find(n => n.id === change.nodeId).values.opacity = direction === 'apply' ? change.after : change.before;
  const observedAfter = clean(out.observation);
  for (const change of plan.changes) {
    const row = observedAfter.nodes?.find(n => n.id === change.nodeId), value = direction === 'apply' ? change.after : change.before;
    if (row && stored(row.values.opacity, value)) row.values.opacity = value;
  }
  if (canonical(observedAfter) !== canonical(expectedAfter)) throw Error('native-update-postcondition-conflict');
  out.status = out.changes.length ? 'updated' : 'no-op';
} catch (error) {
  out.problems.push(error && error.message ? error.message : String(error));
  const unrestored = [];
  for (const attempt of attempted.reverse()) {
    try {
      const target = direction === 'apply' ? attempt.change.after : attempt.change.before;
      if (stored(attempt.node.opacity, target)) attempt.node.opacity = attempt.previous;
      if (attempt.node.opacity !== attempt.previous) unrestored.push(attempt.change.nodeId);
    } catch { unrestored.push(attempt.change.nodeId); }
  }
  out.status = unrestored.length ? 'recovery-required' : attempted.length ? 'rolled-back' : 'refused';
  out.unrestored = unrestored;
}
return out;`;
}

/** The scalar program extended with owned, unbound variable values. Same
 * discipline: every async read first, then final checks and assignments with
 * no await between them; each attempt recorded before it is made; a partial
 * application is finished, a complete one is a no-op; failure restores in
 * reverse and names what it could not restore. */
function emitTokenValueUpdateScript(plan: NativeOpacityUpdatePlan, direction: 'apply' | 'rollback', readOnly: boolean) {
  const changes = plan.tokenChanges;
  if (plan.tokenBindingScope !== undefined && plan.tokenBindingScope !== 'document-v1') throw Error('native-update-token-binding-scope-invalid');
  const documentScoped = plan.tokenBindingScope === 'document-v1';
  if (!Array.isArray(changes) || !changes.length || new Set(changes.map(c => c.variableId + '\n' + c.modeId)).size !== changes.length ||
      changes.some(c => !c || typeof c.variableId !== 'string' || !c.variableId || typeof c.modeId !== 'string' || !c.modeId ||
        ![c.before, c.after].every(n => typeof n === 'number' && Number.isFinite(n)) ||
        !plan.before.tokenIdentity.variables.some(v => v.id === c.variableId && v.tokenPath === c.tokenPath) ||
        !plan.before.tokenIdentity.modes.some(m => m.modeId === c.modeId && m.sourceMode === c.sourceMode && m.brand === c.brand)))
    throw Error('native-update-plan-invalid');
  const expected = direction === 'apply' ? plan.after : plan.before;
  return `const plan = ${JSON.stringify(plan)};
const direction = ${JSON.stringify(direction)}, readOnly = ${readOnly};
const out = { version: 1, kind: 'native-contract-update-result', direction, status: 'refused', changes: [], tokenChanges: [], problems: [], acceptedContract: null, nativeQualification: 'unqualified' };
const canonical = value => JSON.stringify((function sort(v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])); return v; })(value));
const clean = value => { const copy = JSON.parse(JSON.stringify(value)); delete copy.images; return copy; };
const attempted = [];
const stored = (actual, expected) => actual === expected || actual === Math.fround(expected);
const references = (value, id) => Array.isArray(value) ? value.some(v => references(v, id)) : !!value && typeof value === 'object' && ((value.type === 'VARIABLE_ALIAS' && value.id === id) || Object.values(value).some(v => references(v, id)));
const collectionId = plan.before.tokenIdentity.collection.id;
// Live, synchronous facts of one variable. Never found by name.
const owned = (variable, change) => variable.id === change.variableId && variable.variableCollectionId === collectionId && variable.resolvedType === 'FLOAT' && variable.remote === false && !!variable.valuesByMode && typeof variable.valuesByMode[change.modeId] === 'number';
try {
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  if (!figma.variables || typeof figma.variables.getVariableByIdAsync !== 'function' || typeof figma.variables.getLocalVariablesAsync !== 'function') throw Error('native-update-token-api-unavailable');${documentScoped ? `
  if (typeof figma.loadAllPagesAsync !== 'function') throw Error('native-update-document-scope-unavailable');
  await figma.loadAllPagesAsync();` : ''}
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
${documentScoped ? emitNativeTokenBindingScope() : `  const locals = await figma.variables.getLocalVariablesAsync();
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  if (!Array.isArray(locals)) throw Error('native-update-token-api-unavailable');
  const page = figma.root.children.find(n => n.id === plan.before.creation.pageId);
  if (!page || page.type !== 'PAGE') throw Error('native-update-page-missing');
  const liveNodes = [page, ...page.findAll(() => true)];
  if (liveNodes.length > 10000) throw Error('native-update-scope-too-large');`}
  const normalized = clean(current);
  const recordedNodes = new Map((normalized.nodes || []).map(n => [n.id, n]));
  const states = [], tokenStates = [];
  for (const change of plan.tokenChanges) {
    const variable = variables.get(change.variableId);
    const row = normalized.tokens && normalized.tokens.receipt && Array.isArray(normalized.tokens.receipt.variables) ? normalized.tokens.receipt.variables.find(v => v.id === change.variableId) : undefined;
    if (!row || !owned(variable, change) || row.variableCollectionId !== collectionId || row.resolvedType !== 'FLOAT' || row.remote !== false)
      throw Error('native-update-token-variable-identity:' + change.variableId);
    const value = row.valuesByMode ? row.valuesByMode[change.modeId] : undefined;
    if (![change.before, change.after].some(side => stored(value, side)) || variable.valuesByMode[change.modeId] !== value)
      throw Error('native-update-token-value-conflict:' + change.variableId);
    if ((normalized.nodes || []).some(n => references(n, change.variableId)) || normalized.tokens.receipt.variables.some(v => v.id !== change.variableId && references(v.valuesByMode, change.variableId)))
      throw Error('native-update-token-bound:' + change.variableId);
    // Check every local variable, including aliases introduced in our own
    // collection during the final await. Use them only to refuse, never to select a target.
    if (locals.some(v => v && references(v.valuesByMode, change.variableId)))
      throw Error('native-update-token-aliased:' + change.variableId);
${documentScoped ? `    if (references(styleBindings, change.variableId)) throw Error('native-update-token-style-bound:' + change.variableId);
    if (references(bindingValues, change.variableId)) throw Error('native-update-token-bound:' + change.variableId);
` : ''}    // Include newly inserted nodes and newly added binding fields. The snapshot
    // alone cannot prove a variable stayed unbound across the final await.
    for (const node of liveNodes) {
      const recorded = recordedNodes.get(node.id);
      const fields = new Set([...(Object.keys(recorded?.values || {})), 'boundVariables', 'fills', 'strokes', 'effects', ...(node.type === 'INSTANCE' ? ['componentProperties'] : [])]);
      if ([...fields].some(field => field in node && references(node[field], change.variableId)) ||
          Object.keys(recorded?.metadata || {}).some(key => node.getSharedPluginData('ds_contracts', key) === variable.name))
        throw Error('native-update-token-bound:' + change.variableId);
    }
    tokenStates.push({ variableId: change.variableId, modeId: change.modeId, value });
    row.valuesByMode[change.modeId] = change.before;
  }
  for (const change of plan.changes) {
    const row = normalized.nodes?.find(n => n.id === change.nodeId), node = nodes.get(change.nodeId);
    if (!row || ![change.before, change.after].some(value => stored(row.values.opacity, value)) || node.opacity !== row.values.opacity || node.boundVariables?.opacity)
      throw Error('native-update-opacity-conflict:' + change.nodeId);
    states.push({ nodeId: change.nodeId, value: row.values.opacity });
    row.values.opacity = change.before;
  }
  if (canonical(normalized) !== canonical(clean(plan.baseline))) throw Error('native-update-baseline-conflict');
  out.states = states; out.tokenStates = tokenStates;
  if (readOnly) { out.status = 'preflight-observed'; out.observation = current; return out; }
  // After the complete async read, there is no await between the final
  // precondition checks above and these writes. Every attempt is recorded
  // before assignment. Variable values first, then the literals that show them.
  for (const change of plan.tokenChanges) {
    const variable = variables.get(change.variableId), target = direction === 'apply' ? change.after : change.before;
    if (stored(variable.valuesByMode[change.modeId], target)) continue;
    attempted.push({ variable, change, previous: variable.valuesByMode[change.modeId] });
    variable.setValueForMode(change.modeId, target);
    out.tokenChanges.push(change.variableId);
  }
  for (const change of plan.changes) {
    const node = nodes.get(change.nodeId), target = direction === 'apply' ? change.after : change.before;
    if (stored(node.opacity, target)) continue;
    attempted.push({ node, change, previous: node.opacity });
    node.opacity = target;
    out.changes.push(change.nodeId);
  }
  out.observation = await (async () => { ${emitNativeContractReadbackScript(expected)} })();
  const side = change => direction === 'apply' ? change.after : change.before;
  const expectedAfter = clean(plan.baseline);
  for (const change of plan.changes) expectedAfter.nodes.find(n => n.id === change.nodeId).values.opacity = side(change);
  for (const change of plan.tokenChanges) expectedAfter.tokens.receipt.variables.find(v => v.id === change.variableId).valuesByMode[change.modeId] = side(change);
  const observedAfter = clean(out.observation);
  for (const change of plan.changes) {
    const row = observedAfter.nodes?.find(n => n.id === change.nodeId);
    if (row && stored(row.values.opacity, side(change))) row.values.opacity = side(change);
  }
  for (const change of plan.tokenChanges) {
    const row = observedAfter.tokens && observedAfter.tokens.receipt && Array.isArray(observedAfter.tokens.receipt.variables) ? observedAfter.tokens.receipt.variables.find(v => v.id === change.variableId) : undefined;
    if (row && row.valuesByMode && stored(row.valuesByMode[change.modeId], side(change))) row.valuesByMode[change.modeId] = side(change);
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
        if (stored(attempt.variable.valuesByMode[attempt.change.modeId], target)) attempt.variable.setValueForMode(attempt.change.modeId, attempt.previous);
        if (!stored(attempt.variable.valuesByMode[attempt.change.modeId], attempt.previous)) unrestored.push(id);
      } else {
        if (stored(attempt.node.opacity, target)) attempt.node.opacity = attempt.previous;
        if (attempt.node.opacity !== attempt.previous) unrestored.push(id);
      }
    } catch { unrestored.push(id); }
  }
  out.status = unrestored.length ? 'recovery-required' : attempted.length ? 'rolled-back' : 'refused';
  out.unrestored = unrestored;
}
return out;`;
}

/** Resolve newly observed allocations only after independent migration checks. */
export function nativeContractUpdateAfter(plan:NativeContractUpdatePlan,receipt:unknown) {
 if(plan.kind==='native-contract-token-allocation-update')return resolveNativeTokenAllocationUpdate(plan,receipt as NativeSourceReadback);
 return plan.kind==='native-contract-background-update'?resolveNativeBackgroundUpdateInput(plan,receipt):structuredClone(plan.after);
}
