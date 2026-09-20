/** Pure comparison of a bounded variable/geometry transition. No write or
 * ownership authority is granted here. The caller must establish every native
 * consumer and use independently observed layout facts to build the plan. */
import { canonicalJson } from './contract-provenance.js';
import type { NativeCrossSizeTransition } from './native-fixed-cross-size.js';
import type { NativeSourceReadback } from './native-source-observation.js';

export interface NativeBoundCrossSizeObservationPlan {
  baseline: NativeSourceReadback;
  variable: { id: string; modeId: string; before: number; after: number };
  /** All roots and dependent flow positions change together with the variable. */
  derived: NativeCrossSizeTransition[];
  /** Independent absolute leaf corrections may be unfinished individually. */
  absolute: NativeCrossSizeTransition[];
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clean = (value: NativeSourceReadback) => {
  const result = structuredClone(value); delete result.images; return result;
};
const has = (values: Record<string, unknown>, expected: Record<string, unknown>) =>
  Object.entries(expected).every(([key, value]) => same(values[key], value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function fail(): never { throw Error('native-bound-cross-size-observation-conflict'); }

/** A variable cannot be treated as an independent partial write: each root
 * size and every derived child position must agree with its current value.
 * Every other recorded fact, including other variables/modes, stays exact.
 * Images are compared separately by the caller, as with other native plans. */
export function nativeBoundCrossSizeObservationMatches(
  plan: NativeBoundCrossSizeObservationPlan,
  receipt: unknown,
  required: 'partial' | 'before' | 'after' = 'partial',
): boolean {
  try {
    if (!['partial', 'before', 'after'].includes(required) ||
        !finite(plan.variable.before) || !finite(plan.variable.after) ||
        Math.fround(plan.variable.before) === Math.fround(plan.variable.after) ||
        !plan.derived.length) fail();
    const baseline = clean(plan.baseline), current = clean(receipt as NativeSourceReadback);
    if (baseline.status !== 'native-readback-collected' || baseline.problems.length ||
        current.status !== 'native-readback-collected' || current.problems.length) fail();
    const oldRows = new Map(baseline.nodes?.map(row => [row.id, row]));
    const rows = new Map(current.nodes?.map(row => [row.id, row]));
    if (!oldRows.size || oldRows.size !== baseline.nodes?.length || rows.size !== current.nodes?.length) fail();
    const variables = (value: NativeSourceReadback) =>
      (value.tokens?.receipt?.variables ?? []).filter((v: any) => v.id === plan.variable.id);
    const oldVariables = variables(baseline), newVariables = variables(current);
    if (oldVariables.length !== 1 || newVariables.length !== 1 ||
        oldVariables[0].valuesByMode?.[plan.variable.modeId] !== plan.variable.before) fail();
    const actual = newVariables[0].valuesByMode?.[plan.variable.modeId];
    const side = actual === plan.variable.before ? 'before'
      : actual === plan.variable.after || actual === Math.fround(plan.variable.after) ? 'after' : fail();
    if (required !== 'partial' && side !== required) fail();
    const seen = new Set<string>();
    for (const [transitions, coupled] of [[plan.derived, true], [plan.absolute, false]] as const) {
      for (const t of transitions) {
        const row = rows.get(t.nodeId), old = oldRows.get(t.nodeId);
        if (seen.has(t.nodeId) || !row || !old || !Object.keys(t.before).length ||
            !same(Object.keys(t.before).sort(), Object.keys(t.after).sort()) ||
            !has(old.values, t.before)) fail();
        seen.add(t.nodeId);
        const matches = coupled || required !== 'partial'
          ? has(row.values, t[coupled ? side : required as 'before' | 'after'])
          : has(row.values, t.before) || has(row.values, t.after);
        if (!matches) fail();
        Object.assign(row.values, structuredClone(t.before));
      }
    }
    newVariables[0].valuesByMode[plan.variable.modeId] = plan.variable.before;
    return same(current, baseline);
  } catch { return false; }
}
