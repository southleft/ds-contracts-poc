/**
 * LIVE GAUNTLET tiering — measured complexity per set, computed from the
 * v1.6 dump itself (no live calls). Pure module: gauntlet.ts, bank-pngs.ts
 * and visual-live.ts all read the same tier table.
 *
 * Tiers (first match wins, top down):
 *   T5  maximum — the NAMED subjects: Dialog-class multi-level composites,
 *       the Navigation-Header repeat collection (+ _Nav-item-menu), the slot
 *       sets (drawn _Slot-* placeholder instances / INSTANCE_SWAP refs; the
 *       kit draws ZERO native SLOT nodes — named limit), and the id-collision
 *       pair (RadioButton vs "Radio button").
 *   T4  composites WITH dependencies — ≥1 nested instance whose owning set
 *       exists in the dump beyond the ubiquitous Icon decor.
 *   T3  state-axis sets (state-like variant axis — promotion correctness).
 *   T2  multi-axis and/or boolean-visibility sets.
 *   T1  primitives — no nesting, ≤1 axis (plus the seeded single-variant
 *       COMPONENT sample the gauntlet draws separately).
 *
 * A set's EXERCISES are cumulative: a T4 set with a state axis also gets the
 * T3 promotion assertions; tier is the bucket it is REPORTED under.
 */

export interface DumpNodeJson {
  name?: string;
  type?: string;
  children?: DumpNodeJson[];
  instanceOf?: string;
  propRefs?: Record<string, string>;
  componentProperties?: Record<string, unknown>;
  bbox?: { width: number; height: number };
}

export interface DumpSetJson {
  setName: string;
  type: string;
  nodeId: string;
  key?: string;
  variants: DumpNodeJson[];
  boolDefaults?: Record<string, boolean>;
  swapPreferredValues?: Record<string, unknown>;
}

export type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export interface TierRecord {
  setName: string;
  nodeId: string;
  tier: Tier;
  variants: number;
  axes: Record<string, string[]>;
  stateAxes: string[];
  boolAxes: string[];
  depth: number;
  instances: number;
  /** Distinct owning-set names of nested instances that EXIST in the dump. */
  childSets: string[];
  /** childSets minus the ubiquitous Icon decor — the T4 dependency signal. */
  realDeps: string[];
  slotNamedInstances: number;
  swapRefs: number;
  nativeSlotNodes: number;
  boolVisibilityRefs: number;
  /** ≥3 adjacent same-set siblings anywhere (repeat-collection candidate). */
  adjacentRepeatRuns: number;
}

const STATE_AXIS = /^(state|status|interaction)$/i;
const STATE_VALUES = new Set([
  'default', 'hover', 'hovered', 'pressed', 'active', 'focus', 'focused',
  'focus visible', 'disabled', 'selected', 'checked', 'error', 'invalid',
]);
const BOOL_PAIR = new Set(['false,true', 'no,yes', 'off,on']);

/** The named T5 subjects (see header). Slot/swap membership is computed;
 *  these are the by-name anchors the mandate calls out. */
const T5_NAMED = new Set(['Dialog', 'Navigation-Header', '_Nav-item-menu', 'RadioButton', 'Radio button']);

export function isDumpSetRecord(name: string, value: unknown): value is DumpSetJson {
  return (
    !name.startsWith('_provenance') &&
    name !== '_degradations' &&
    name !== '_variables' &&
    !!value &&
    typeof value === 'object' &&
    typeof (value as { setName?: unknown }).setName === 'string' &&
    Array.isArray((value as { variants?: unknown }).variants)
  );
}

export function dumpSets(dump: Record<string, unknown>): Map<string, DumpSetJson> {
  const out = new Map<string, DumpSetJson>();
  for (const [name, value] of Object.entries(dump)) {
    if (isDumpSetRecord(name, value)) out.set(name, value);
  }
  return out;
}

export function tierSets(dump: Record<string, unknown>): TierRecord[] {
  const sets = dumpSets(dump);
  const records: TierRecord[] = [];
  for (const [name, set] of sets) {
    if (set.type !== 'COMPONENT_SET') continue;

    const axisValues = new Map<string, Set<string>>();
    for (const v of set.variants) {
      for (const pair of (v.name ?? '').split(',')) {
        const [axis, value] = pair.split('=').map((s) => s.trim());
        if (!axis || value === undefined) continue;
        (axisValues.get(axis) ?? axisValues.set(axis, new Set()).get(axis)!).add(value);
      }
    }
    const axes = Object.fromEntries([...axisValues].map(([a, vals]) => [a, [...vals].sort()]));
    const stateAxes = Object.keys(axes).filter((a) => {
      if (STATE_AXIS.test(a)) return true;
      const values = axes[a].map((v) => v.toLowerCase());
      return values.length >= 2 && values.filter((v) => STATE_VALUES.has(v)).length >= 2;
    });
    const boolAxes = Object.keys(axes).filter((a) =>
      BOOL_PAIR.has(axes[a].map((v) => v.toLowerCase()).sort().join(',')),
    );

    let depth = 0;
    let instances = 0;
    let slotNamed = 0;
    let swapRefs = 0;
    let nativeSlots = 0;
    let boolVis = 0;
    let repeatRuns = 0;
    const childSets = new Set<string>();
    const walk = (node: DumpNodeJson, d: number): void => {
      depth = Math.max(depth, d);
      if (node.type === 'INSTANCE') {
        instances += 1;
        if (node.instanceOf && sets.has(node.instanceOf)) childSets.add(node.instanceOf);
        if (/^_?Slot/i.test(node.name ?? '')) slotNamed += 1;
      }
      if (node.type === 'SLOT') nativeSlots += 1;
      if (node.propRefs?.mainComponent) swapRefs += 1;
      if (node.propRefs?.visible) boolVis += 1;
      const children = node.children ?? [];
      let run = 1;
      for (let i = 1; i <= children.length; i++) {
        const prev = children[i - 1];
        const cur = children[i];
        const same =
          cur !== undefined &&
          prev.type === 'INSTANCE' &&
          cur.type === 'INSTANCE' &&
          prev.instanceOf !== undefined &&
          prev.instanceOf === cur.instanceOf;
        if (same) run += 1;
        else {
          if (run >= 3) repeatRuns += 1;
          run = 1;
        }
      }
      for (const c of children) walk(c, d + 1);
    };
    for (const v of set.variants) walk(v, 1);

    const realDeps = [...childSets].filter((c) => c !== 'Icon');
    const isSlotSet = slotNamed > 0 || nativeSlots > 0 || swapRefs > 0;
    const tier: Tier = T5_NAMED.has(name) || isSlotSet
      ? 'T5'
      : realDeps.length >= 1
        ? 'T4'
        : stateAxes.length >= 1
          ? 'T3'
          : Object.keys(axes).length >= 2 || boolAxes.length >= 1 || boolVis > 0
            ? 'T2'
            : 'T1';

    records.push({
      setName: name,
      nodeId: set.nodeId,
      tier,
      variants: set.variants.length,
      axes,
      stateAxes,
      boolAxes,
      depth,
      instances,
      childSets: [...childSets].sort(),
      realDeps: realDeps.sort(),
      slotNamedInstances: slotNamed,
      swapRefs,
      nativeSlotNodes: nativeSlots,
      boolVisibilityRefs: boolVis,
      adjacentRepeatRuns: repeatRuns,
    });
  }
  return records.sort((a, b) => a.setName.localeCompare(b.setName));
}

/** The T1/T2 sets that ALSO join the visual stage (a deterministic sample —
 *  the T3–T5 population is diffed in full). */
export const T12_VISUAL_SAMPLE = new Set(['Badge', 'Tooltip', 'Progress bar', '_Avatar Indicator']);

/** Deterministic 50-set sample of the single-variant COMPONENTs (seeded
 *  mulberry32 over the sorted name list — reproducible offline). */
export function sampleSingles(dump: Record<string, unknown>, n = 50, seed = 42): string[] {
  const names = [...dumpSets(dump)]
    .filter(([, s]) => s.type !== 'COMPONENT_SET')
    .map(([name]) => name)
    .sort();
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...names];
  const out: string[] = [];
  while (out.length < Math.min(n, pool.length)) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out.sort();
}
