/** Restore a compiler-qualified root shadow stack without reallocating a main.
 * All other properties, tokens and topology must retain their verified values. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, nativeShadowStackMatches, verifyNativeContractReadback, type NativeSourceReadback } from './native-source-observation.js';
import type { NativeContractUpdateInput, NativeOpacityUpdatePlan } from './native-contract-update.js';

type Effect = { type: 'INNER_SHADOW' | 'DROP_SHADOW'; color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number }; radius: number; spread: number; visible: true; blendMode: 'NORMAL' };
export interface NativeShadowUpdatePlan extends Omit<NativeOpacityUpdatePlan, 'version' | 'kind' | 'changes'> {
  version: 3; kind: 'native-contract-shadow-update';
  changes: Array<{ nodeId: string; variant: string; part: string; channel: 'effects'; before: Effect[]; after: Effect[] }>;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clean = (r: NativeSourceReadback) => { const copy = structuredClone(r); delete copy.images; return copy; };

// One implementation for host checks and generated code. Native color numbers
// are float32 and may include empty optional binding/default fields.
const MATCH_EFFECTS = `(actual, expected) => {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
  const clean = layers => layers.map(layer => {
    const copy = JSON.parse(JSON.stringify(layer));
    if (copy.showShadowBehindNode === true) delete copy.showShadowBehindNode;
    if (copy.boundVariables && Object.keys(copy.boundVariables).length === 0) delete copy.boundVariables;
    return copy;
  });
  const equal = (a,b) => {
    if (typeof a === 'number' && typeof b === 'number') return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= 0.000001;
    if (Array.isArray(a) && Array.isArray(b)) return a.length===b.length && a.every((v,i)=>equal(v,b[i]));
    if (a && b && typeof a==='object' && typeof b==='object') return Object.keys(a).sort().join(',')===Object.keys(b).sort().join(',') && Object.keys(a).every(k=>equal(a[k],b[k]));
    return a===b;
  };
  return equal(clean(actual),clean(expected));
}`;
const matches = new Function('return '+MATCH_EFFECTS)() as (a: unknown, b: unknown) => boolean;

export function prepareNativeShadowUpdate(input: NativeContractUpdateInput,
  prepareBase: (input: NativeContractUpdateInput) => { plan: NativeOpacityUpdatePlan; revision: string }) {
  const sanitized = structuredClone(input), changed: number[] = [];
  input.before.component.variants.forEach((variant, i) => {
    const next = input.desired.component.variants[i]?.spec;
    if (!next || same(variant.spec.effectStack, next.effectStack)) return;
    if (variant.spec.dropShadow || next.dropShadow || !Array.isArray(next.effectStack)) throw Error('native-update-shadow-stack-required');
    changed.push(i);
    if (variant.spec.effectStack === undefined) delete sanitized.desired.component.variants[i].spec.effectStack;
    else sanitized.desired.component.variants[i].spec.effectStack = structuredClone(variant.spec.effectStack);
  });
  if (!changed.length) return null;
  const oldFacts = input.before.component.codeOnlyFacts ?? [], nextFacts = input.desired.component.codeOnlyFacts ?? [];
  if (!same(oldFacts, nextFacts)) {
    if (!same(oldFacts.filter(f => f.kind !== 'shadow'), nextFacts) || oldFacts.some(f => f.kind === 'shadow' &&
        (f.part !== 'root' || f.channel !== 'box-shadow' || f.variants.count !== changed.length || f.variants.of !== input.before.component.variants.length)))
      throw Error('native-update-shadow-refusal-change-unqualified');
    if (input.before.component.codeOnlyFacts === undefined) delete sanitized.desired.component.codeOnlyFacts;
    else sanitized.desired.component.codeOnlyFacts = structuredClone(oldFacts);
    // The compiler includes the refusal count in its generated description.
    // Preserve that historical native metadata; only accept the exact count
    // change caused by the shadow facts being restored here.
    const oldDescription = input.before.component.description;
    const updatedDescription = oldDescription?.replace(` † (${oldFacts.length} code-only facts — see plugin report)`,
      nextFacts.length ? ` † (${nextFacts.length} code-only facts — see plugin report)` : '');
    if (!same(input.desired.component.description, oldDescription) &&
        !same(input.desired.component.description, updatedDescription)) throw Error('native-update-shadow-description-change');
    sanitized.desired.component.description = oldDescription;
  }
  const base = prepareBase(sanitized).plan;
  if (base.changes.length) throw Error('native-update-shadow-mixed-channels-unqualified');
  const plan: NativeShadowUpdatePlan = { ...base, version: 3, kind: 'native-contract-shadow-update', changes: [] };
  for (const i of changed) {
    const spec = input.desired.component.variants[i].spec;
    const nodeId = base.before.creation.variants[i].id, row = base.baseline.nodes!.find(n => n.id === nodeId);
    if (!row || row.type !== 'COMPONENT' || !Array.isArray(row.values.effects)) throw Error('native-update-shadow-root-required');
    const after: Effect[] = spec.effectStack!.map(e => ({ type: e.inner ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: { ...e.color, a: e.color.a ?? 1 }, offset: { x: e.x, y: e.y }, radius: e.radius,
      spread: e.spread ?? 0, visible: true, blendMode: 'NORMAL' }));
    if (!nativeShadowStackMatches(spec, after)) throw Error('native-update-shadow-values-invalid');
    if (after.some(e => ![e.offset.x,e.offset.y,e.radius,e.spread,...Object.values(e.color)].every(Number.isFinite) ||
        e.radius < 0 || Object.values(e.color).some(n => n < 0 || n > 1))) throw Error('native-update-shadow-values-invalid');
    plan.after.component.variants[i].spec.effectStack = structuredClone(spec.effectStack);
    plan.changes.push({ nodeId, variant: input.before.component.variants[i].name, part: 'Component', channel: 'effects',
      before: structuredClone(row.values.effects), after });
  }
  if (input.desired.component.codeOnlyFacts === undefined) delete plan.after.component.codeOnlyFacts;
  else plan.after.component.codeOnlyFacts = structuredClone(input.desired.component.codeOnlyFacts);
  return { plan, revision: revisionOf(plan) };
}

export function nativeShadowUpdateMatches(plan: NativeShadowUpdatePlan, receipt: unknown, complete = false) {
  try {
    const normalized = clean(receipt as NativeSourceReadback);
    for (const change of plan.changes) {
      const row = normalized.nodes?.find(n => n.id === change.nodeId);
      if (!row || !(matches(row.values.effects, change.after) || !complete && matches(row.values.effects, change.before))) return false;
      row.values.effects = structuredClone(change.before);
    }
    return same(normalized, plan.baseline) && verifyNativeContractReadback(plan.before, normalized).status === 'supported-structure-observed';
  } catch { return false; }
}

export function emitNativeShadowUpdateScript(plan: NativeShadowUpdatePlan, direction: 'apply' | 'rollback', readOnly: boolean) {
  const expected = direction === 'apply' ? plan.after : plan.before;
  return `const plan=${JSON.stringify(plan)}, direction=${JSON.stringify(direction)}, readOnly=${readOnly};
const matches=${MATCH_EFFECTS};
const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const copy=value=>JSON.parse(JSON.stringify(value));
const clean=value=>{const r=copy(value);delete r.images;return r;};
const out={version:1,kind:'native-contract-update-result',direction,status:'refused',changes:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'},attempted=[];
try {
  if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
  const nodes=new Map();
  for(const c of plan.changes){const node=await figma.getNodeByIdAsync(c.nodeId);if(!node)throw Error('native-update-node-missing');nodes.set(c.nodeId,node);}
  const current=await(async()=>{${emitNativeContractReadbackScript(plan.before)}})(),normalized=clean(current);
  for(const c of plan.changes){const row=normalized.nodes?.find(n=>n.id===c.nodeId);
    if(!row||!(matches(row.values.effects,c.before)||matches(row.values.effects,c.after))||!matches(nodes.get(c.nodeId).effects,row.values.effects))throw Error('native-update-shadow-conflict');
    row.values.effects=copy(c.before);}
  if(canonical(normalized)!==canonical(clean(plan.baseline)))throw Error('native-update-baseline-conflict');
  if(readOnly){out.status='preflight-observed';out.observation=current;return out;}
  for(const c of plan.changes){const node=nodes.get(c.nodeId),target=direction==='apply'?c.after:c.before;
    if(matches(node.effects,target))continue;
    attempted.push({node,previous:copy(node.effects),target});node.effects=copy(target);out.changes.push(c.nodeId);}
  out.observation=await(async()=>{${emitNativeContractReadbackScript(expected)}})();
  const after=clean(out.observation);
  for(const c of plan.changes){const row=after.nodes?.find(n=>n.id===c.nodeId);if(!row||!matches(row.values.effects,direction==='apply'?c.after:c.before))throw Error('native-update-shadow-postcondition');row.values.effects=copy(c.before);}
  if(canonical(after)!==canonical(clean(plan.baseline)))throw Error('native-update-postcondition-conflict');
  out.status=out.changes.length?'updated':'no-op';
} catch(error) {
  out.problems.push(error&&error.message?error.message:String(error));const unrestored=[];
  for(const a of attempted.reverse())try{if(matches(a.node.effects,a.target))a.node.effects=copy(a.previous);if(!matches(a.node.effects,a.previous))unrestored.push(a.node.id);}catch{unrestored.push(a.node.id);}
  out.status=unrestored.length?'recovery-required':attempted.length?'rolled-back':'refused';out.unrestored=unrestored;
}
return out;`;
}
