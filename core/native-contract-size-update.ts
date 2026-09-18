/** Fixed dimensions on an empty editable flex root. The complete old inventory
 * remains the baseline; only declared dimensions, sizing modes and the empty
 * slot's resulting alignment offsets may change. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeSourceReadback } from './native-source-observation.js';
import type { NativeContractUpdateInput, NativeOpacityUpdatePlan } from './native-contract-update.js';

type Values = Record<string, unknown>;
interface Transition { nodeId: string; before: Values; after: Values; slotId: string; slotBefore: Values; slotAfter: Values }
export interface NativeRootSizeUpdatePlan extends Omit<NativeOpacityUpdatePlan, 'version' | 'kind' | 'changes'> {
  version: 2; kind: 'native-contract-root-size-update';
  changes: Array<{ nodeId: string; variant: string; part: string; channel: 'width' | 'height'; before: number; after: number }>;
  transitions: Transition[];
}
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const clean = (receipt: NativeSourceReadback) => { const copy = structuredClone(receipt); delete copy.images; return copy; };
function normalize(plan: NativeRootSizeUpdatePlan, receipt: unknown, complete: boolean) {
  const result = clean(receipt as NativeSourceReadback);
  const has = (values: Values, expected: Values) => Object.entries(expected).every(([k, v]) => equal(values[k], v));
  for (const t of plan.transitions) {
    const root = result.nodes?.find(n => n.id === t.nodeId), slot = result.nodes?.find(n => n.id === t.slotId);
    if (!root || !slot || !((has(root.values, t.after) && has(slot.values, t.slotAfter)) ||
        (!complete && has(root.values, t.before) && has(slot.values, t.slotBefore)))) throw Error('native-update-size-conflict');
    Object.assign(root.values, t.before); Object.assign(slot.values, t.slotBefore);
  }
  return result;
}
export function nativeRootSizeUpdateMatches(plan: NativeRootSizeUpdatePlan, receipt: unknown, complete = false) {
  try { const normalized = normalize(plan, receipt, complete);
    return equal(normalized, plan.baseline) && verifyNativeContractReadback(plan.before, normalized).status === 'supported-structure-observed';
  } catch { return false; }
}

export function prepareNativeRootSizeUpdate(input: NativeContractUpdateInput,
  prepareBase: (input: NativeContractUpdateInput) => { plan: NativeOpacityUpdatePlan; revision: string }) {
  const sanitized = structuredClone(input), dimensions: Array<{ index: number; channel: 'width' | 'height'; value: number }> = [];
  input.before.component.variants.forEach((variant, index) => {
    const desired = input.desired.component.variants[index]?.spec;
    if (!desired) return;
    for (const channel of ['width', 'height'] as const) {
      if (equal(variant.spec.lits?.[channel], desired.lits?.[channel])) continue;
      if (!positive(desired.lits?.[channel])) throw Error('native-update-size-target-unqualified');
      dimensions.push({ index, channel, value: desired.lits![channel] as number });
      const next = sanitized.desired.component.variants[index].spec;
      if (variant.spec.lits) next.lits = { ...next.lits, [channel]: variant.spec.lits[channel] };
      else { delete next.lits![channel]; if (!Object.keys(next.lits!).length) delete next.lits; }
    }
  });
  if (!dimensions.length) return null;
  const base = prepareBase(sanitized).plan;
  if (base.changes.length) throw Error('native-update-size-mixed-channels-unqualified');
  const plan: NativeRootSizeUpdatePlan = { ...base, version: 2, kind: 'native-contract-root-size-update', changes: [], transitions: [] };
  for (const index of new Set(dimensions.map(d => d.index))) {
    const spec = base.before.component.variants[index].spec;
    const desired = input.desired.component.variants[index].spec;
    const slotSpec = spec.children?.[0];
    if (!base.before.component.rootSlot || !['HORIZONTAL', 'VERTICAL'].includes(spec.layout?.mode ?? '') ||
        spec.children?.length !== 1 || slotSpec?.type !== 'slot' || !slotSpec.rootSlotContent ||
        slotSpec.children?.length || slotSpec.slotDefault?.length || spec.layout?.wrap || spec.rootFillWidth)
      throw Error('native-update-size-empty-flex-root-required');
    const rootId = base.before.creation.variants[index].id;
    const root = base.baseline.nodes!.find(n => n.id === rootId);
    const slot = base.baseline.nodes!.find(n => n.id === root?.childIds[0]);
    if (!root || !slot || root.childIds.length !== 1 || slot.childIds.length || root.type !== 'COMPONENT' || slot.type !== 'SLOT')
      throw Error('native-update-size-root-identity-invalid');
    // resize touches both dimensions, even when only one is changing. Never
    // risk detaching an untouched binding or relying on rotated slot bounds.
    const transform = slot.values.relativeTransform;
    if (root.values.boundVariables?.width || root.values.boundVariables?.height ||
        (root.values.layoutWrap && root.values.layoutWrap !== 'NO_WRAP') ||
        !Array.isArray(transform) || transform[0]?.[0] !== 1 || transform[0]?.[1] !== 0 ||
        transform[1]?.[0] !== 0 || transform[1]?.[1] !== 1)
      throw Error('native-update-size-layout-unqualified');
    const parent = base.baseline.nodes!.find(n => n.id === root.parentId);
    if (parent?.values.layoutMode && parent.values.layoutMode !== 'NONE') throw Error('native-update-size-parent-layout-unqualified');
    const t: Transition = { nodeId: root.id, slotId: slot.id, before: {}, after: {}, slotBefore: {}, slotAfter: {} };
    for (const d of dimensions.filter(d => d.index === index)) {
      const axis = d.channel === 'width' ? 'Horizontal' : 'Vertical', position = d.channel === 'width' ? 'x' : 'y';
      const primary = (d.channel === 'width') === (root.values.layoutMode === 'HORIZONTAL');
      const mode = primary ? 'primaryAxisSizingMode' : 'counterAxisSizingMode';
      const alignment = root.values[primary ? 'primaryAxisAlignItems' : 'counterAxisAlignItems'];
      const binding = d.channel === 'width' ? spec.fixedWidth : spec.fixedHeight;
      if (binding || root.values.boundVariables?.[d.channel] ||
          !['HUG', 'FIXED'].includes(root.values['layoutSizing' + axis]) ||
          !['AUTO', 'FIXED'].includes(root.values[mode]) || slot.values['layoutSizing' + axis] === 'FILL' ||
          !['MIN', 'MAX', 'CENTER'].includes(alignment) || !positive(root.values[d.channel]) || !positive(slot.values[d.channel]) ||
          !Number.isFinite(slot.values[position]) || !Array.isArray(slot.values.relativeTransform))
        throw Error('native-update-size-layout-unqualified');
      const sides = d.channel === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
      const min = root.values[d.channel === 'width' ? 'minWidth' : 'minHeight'];
      const max = root.values[d.channel === 'width' ? 'maxWidth' : 'maxHeight'];
      if ((typeof min === 'number' && d.value < min) || (typeof max === 'number' && d.value > max))
        throw Error('native-update-size-constraint-conflict');
      const minimum = slot.values[d.channel] + sides.reduce((sum, side) =>
        sum + (root.values['padding' + side] ?? 0) + (root.values['stroke' + side + 'Weight'] ?? 0), 0);
      if (d.value < minimum) throw Error('native-update-size-content-overflow');
      for (const key of [d.channel, 'layoutSizing' + axis, mode]) t.before[key] = root.values[key];
      Object.assign(t.after, { [d.channel]: d.value, ['layoutSizing' + axis]: 'FIXED', [mode]: 'FIXED' });
      t.slotBefore[position] = slot.values[position];
      t.slotAfter[position] = slot.values[position] + (d.value - root.values[d.channel]) * (alignment === 'CENTER' ? 0.5 : alignment === 'MAX' ? 1 : 0);
      t.slotBefore.relativeTransform = structuredClone(slot.values.relativeTransform);
      const transform = (t.slotAfter.relativeTransform ?? structuredClone(slot.values.relativeTransform)) as number[][];
      transform[d.channel === 'width' ? 0 : 1][2] = t.slotAfter[position] as number;
      t.slotAfter.relativeTransform = transform;
      plan.changes.push({ nodeId: root.id, variant: base.before.component.variants[index].name, part: 'Component',
        channel: d.channel, before: root.values[d.channel], after: d.value });
    }
    plan.after.component.variants[index].spec.lits = structuredClone(desired.lits);
    plan.transitions.push(t);
  }
  return { plan, revision: revisionOf(plan) };
}

export function emitNativeRootSizeUpdateScript(plan: NativeRootSizeUpdatePlan, direction: 'apply' | 'rollback', readOnly: boolean) {
  const expected = direction === 'apply' ? plan.after : plan.before;
  return `const plan = ${JSON.stringify(plan)}, direction = ${JSON.stringify(direction)}, readOnly = ${readOnly};
const out = { version: 1, kind: 'native-contract-update-result', direction, status: 'refused', changes: [], problems: [], acceptedContract: null, nativeQualification: 'unqualified' };
const canonical = value => JSON.stringify((function sort(v) { if (Array.isArray(v)) return v.map(sort); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, sort(v[k])])); return v; })(value));
const clean = value => { const copy = JSON.parse(JSON.stringify(value)); delete copy.images; return copy; };
const has = (node, values) => Object.entries(values).every(([k,v]) => canonical(node[k]) === canonical(v));
const attempted = [];
function assign(node, values) {
  node.resize(values.width === undefined ? node.width : values.width, values.height === undefined ? node.height : values.height);
  for (const key of ['primaryAxisSizingMode','counterAxisSizingMode']) if(values[key]!==undefined)node[key]=values[key];
  for (const axis of ['Horizontal','Vertical']) if (values['layoutSizing'+axis] !== undefined) node['layoutSizing'+axis] = values['layoutSizing'+axis];
  // resize may fix the untouched axis too; restore its original sizing mode.
}
try {
  if (figma.fileKey !== plan.before.operation.fileKey) throw Error('native-update-file-mismatch');
  const nodes = new Map();
  for (const t of plan.transitions) { const node = await figma.getNodeByIdAsync(t.nodeId); if (!node) throw Error('native-update-node-missing'); nodes.set(t.nodeId,node); }
  const current = await (async () => { ${emitNativeContractReadbackScript(plan.before)} })();
  const normalized = clean(current);
  for (const t of plan.transitions) {
    const row = normalized.nodes?.find(n=>n.id===t.nodeId), slot = normalized.nodes?.find(n=>n.id===t.slotId);
    if (!row || !slot || !((has(row.values,t.before)&&has(slot.values,t.slotBefore)) || (has(row.values,t.after)&&has(slot.values,t.slotAfter)))) throw Error('native-update-size-conflict');
    Object.assign(row.values,t.before); Object.assign(slot.values,t.slotBefore);
  }
  if (canonical(normalized)!==canonical(clean(plan.baseline))) throw Error('native-update-baseline-conflict');
  if (readOnly) {out.status='preflight-observed';out.observation=current;return out;}
  // All asynchronous reads are complete. Verify live fields again before any write.
  for (const t of plan.transitions) { const row=current.nodes.find(n=>n.id===t.nodeId); if (!has(nodes.get(t.nodeId),Object.fromEntries(Object.keys(t.before).map(k=>[k,row.values[k]])))) throw Error('native-update-size-conflict'); }
  for (const t of plan.transitions) {
    const node=nodes.get(t.nodeId),target=direction==='apply'?t.after:t.before;
    if (has(node,target)) continue;
    const previous=Object.fromEntries(Object.keys(t.before).map(k=>[k,node[k]]));
    for (const key of ['layoutSizingHorizontal','layoutSizingVertical','primaryAxisSizingMode','counterAxisSizingMode']) if(target[key]===undefined)previous[key]=node[key];
    const next={...previous,...target}; attempted.push({node,previous,next}); assign(node,next);out.changes.push(t.nodeId);
  }
  out.observation = await (async () => { ${emitNativeContractReadbackScript(expected)} })();
  const expectedReceipt=clean(plan.baseline);
  if(direction==='apply')for(const t of plan.transitions){Object.assign(expectedReceipt.nodes.find(n=>n.id===t.nodeId).values,t.after);Object.assign(expectedReceipt.nodes.find(n=>n.id===t.slotId).values,t.slotAfter);}
  if(canonical(clean(out.observation))!==canonical(expectedReceipt))throw Error('native-update-postcondition-conflict');
  out.status=out.changes.length?'updated':'no-op';
} catch(error) {
  out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
  for(const a of attempted.reverse())try {
    // Do not overwrite an independent edit made after application.
    if(Object.keys(a.previous).every(k=>canonical(a.node[k])===canonical(a.previous[k])||canonical(a.node[k])===canonical(a.next[k])))assign(a.node,a.previous);
    if(!has(a.node,a.previous))unrestored.push(a.node.id);
  }catch{unrestored.push(a.node.id);}
  out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
