/**
 * COMPUTED-CAPTURE FLOOR — fusion: computed floor × static semantic layer
 * (DESIGN §4–§5), productionized from the spike with three upgrades:
 *
 *   · DERIVED-CHANNEL FOLDING (spike risk #2): channels that provably track a
 *     source fact in EVERY capture — currentColor-initialized color channels
 *     tracking `color`, px channels tracking `font-size` at a constant em
 *     ratio — are folded into the source fact instead of minting independent
 *     leaves. Every fold is a named receipt; before→after leaf counts are
 *     quoted in numbers.json.
 *   · S2 — unset/defaultless enums are first-class mint-axis values: the
 *     unset pseudo-value's leaf becomes the part's BASE binding and the set
 *     values ride tokensByProp maps (single axis) or placeholder maps (pair
 *     with an unset axis — the reviewed emitter capability lift).
 *   · S3 — state×axis substituted-ref minting, hardened: per-axis state refs
 *     land in root `states` (the emitters expand single-placeholder state
 *     refs per enum class); unset-axis state refs carry their base plane and
 *     name the set-plane residue; pair state refs overflow BY NAME (root
 *     states carry ≤1 placeholder — nothing is dropped silently).
 *
 * Fusion precedence is the spike's, verbatim: BOUND (static layer confirmed
 * or contradicted by computed truth — contradictions are RECEIPTS, never
 * silent overrides), then MINTED via core/mint-tokens.ts UNCHANGED, then
 * CODE-ONLY extension block. The review queue (contradiction-resolution
 * workflow, extract/computed/resolve.ts) is a first-class output.
 */
import { mintTokens, type MintAxis, type MintObservation, type MintResult } from '../../core/mint-tokens.js';
import {
  DECLARED_CHANNELS,
  LITERAL_CHANNELS,
  LITERAL_VALUE_RE,
  resolveLiterals,
  resolveTokens,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
} from '../../scripts/contract-schema.js';
import { PRESENCE_OFF } from './capture.js';
import type { ComponentConfig, PropSpace, SweepResult, Interaction } from './capture.js';
import {
  CHANNEL_TO_COMPUTED,
  flatten,
  isFusable,
  kindOf,
  pairwiseCertificate,
  type Capture,
  type Combo,
  type FlatEl,
  type StyleMap,
} from './lib.js';
import { buildUnion, nameUnion, rejoinStaticParts } from './anatomy.js';

// ---------------------------------------------------------------------------
// Alignment across the sweep (§4)
// ---------------------------------------------------------------------------
export interface AlignedSweep {
  /** This component's captures, combo keys stripped of the component prefix. */
  captures: Capture[];
  byKey: Map<string, Capture>;
  base: Capture;
  /** Round 4: the UNION anatomy in DFS order — representative element per
   *  union part (base capture's element when present there). Parts created
   *  only under structure-creating props appear here with inBase=false. */
  baseFlat: FlatEl[];
  /** Parallel to baseFlat: whether the part exists in the base capture. */
  inBase: boolean[];
  partNames: string[];
  /** Round 4: the union tree itself (promotion input). */
  union: import('./anatomy.js').UnionResult;
  getAligned: (key: string) => (FlatEl | null)[];
  structureReceipts: string[];
  /** part-name → join vs the static anatomy: matched | computed-only;
   *  static-only parts are listed separately. */
  anatomyJoin: Array<{ part: string; join: 'matched' | 'computed-only' }>;
  staticOnlyParts: string[];
}

export function alignSweep(
  sweepResult: SweepResult,
  comp: ComponentConfig,
  space: PropSpace,
  classPrefix: string,
): AlignedSweep {
  const prefix = `${comp.name}:`;
  const captures = sweepResult.captures
    .filter((c) => c.combo.startsWith(prefix))
    .map((c) => ({ ...c, combo: c.combo.slice(prefix.length) }));
  const byKey = new Map<string, Capture>(captures.map((c) => [`${c.combo}__${c.interaction}`, c]));
  const base = byKey.get(`${space.baseComboKey}__default`);
  if (!base) throw new Error(`${comp.name}: base capture missing (${space.baseComboKey}__default)`);

  // Round 4: UNION alignment — hierarchical signature matching across ALL
  // captures (structure-creating props add union parts the base combo never
  // renders); replaces the base-tree path alignment.
  const union = buildUnion(captures, base, classPrefix);
  const structureReceipts = [...union.receipts];
  nameUnion(union.entries, comp.name, classPrefix);
  rejoinStaticParts(union.entries, space.contract, comp, structureReceipts);
  const baseFlat: FlatEl[] = union.entries.map((e) => ({
    path: e.repPath,
    sig: e.sig,
    partName: e.partName,
    node: e.rep,
  }));
  const inBase = union.entries.map((e) => e.inBase);
  const partNames = baseFlat.map((e) => e.partName);

  // per-capture part-missing receipts (presence is the normal case now —
  // receipted only for parts the BASE capture has)
  for (const [key, els] of union.alignedByKey) {
    els.forEach((el, i) => {
      if (!el && inBase[i]) structureReceipts.push(`part-missing: ${key} ${partNames[i]}`);
      if (el && el.sig !== baseFlat[i].sig) structureReceipts.push(`signature-drift: ${key} ${partNames[i]}: ${baseFlat[i].sig} → ${el.sig}`);
    });
  }

  const getAligned = (key: string): (FlatEl | null)[] => {
    const a = union.alignedByKey.get(key);
    if (!a) throw new Error(`${comp.name}: no capture for ${key}`);
    return a;
  };

  // Join vs the static anatomy: the static side wins NAMES and semantics;
  // the computed tree wins EXISTENCE (§4.5).
  const staticParts = new Set(walkAnatomy(space.contract).map((w) => w.name));
  const anatomyJoin = partNames.map((p) => ({
    part: p,
    join: staticParts.has(p) ? ('matched' as const) : ('computed-only' as const),
  }));
  const staticOnlyParts = [...staticParts].filter((p) => !partNames.includes(p));

  return {
    captures, byKey, base, baseFlat, inBase, partNames, union, getAligned,
    structureReceipts: [...new Set(structureReceipts)], anatomyJoin, staticOnlyParts,
  };
}

// ---------------------------------------------------------------------------
// Styled channels: differ from the control probe at base, or vary anywhere
// in the enabled default-interaction sweep.
// ---------------------------------------------------------------------------
const isEnabled = (combo: Combo): boolean => Object.values(combo.stateFlags).every((f) => !f);

export function styledChannels(
  a: AlignedSweep,
  space: PropSpace,
  controls: Record<string, StyleMap>,
  allProps: string[],
  receipts: string[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const set = new Set<string>();
    const tag = a.baseFlat[pi].node.tag;
    const ctrl = controls[tag] ?? controls['span'];
    if (!controls[tag]) receipts.push(`control-fallback: no control for <${tag}> — span control used (part ${a.partNames[pi]})`);
    for (const p of allProps) {
      if (!isFusable(p)) continue;
      if (a.baseFlat[pi].node.style[p] !== ctrl[p]) set.add(p);
    }
    for (const combo of space.enumeration.combos) {
      if (!isEnabled(combo)) continue;
      const el = a.getAligned(`${combo.key}__default`)[pi];
      if (!el) continue;
      for (const p of allProps) {
        if (!isFusable(p)) continue;
        if (el.node.style[p] !== a.baseFlat[pi].node.style[p]) set.add(p);
      }
    }
    // Round 5c — TEXT-PART TYPOGRAPHY IS ALWAYS A FACT: a text-bearing
    // part whose typography equals the mount context (the provider's 13px/
    // 20px/450 body) looked "unstyled" against the span control and was
    // never carried — but the GENERATED surfaces have no Polaris body to
    // inherit from, so the canvas drew its own 14px/500 defaults (the
    // named 13px-vs-14px config-triage class on Checkbox/Radio/Banner
    // labels). Context-inherited or not, the rendered typography of a text
    // part is captured truth; carry the three box-driving channels
    // explicitly (sr-only parts excluded — they draw nothing).
    // Round 5c — SVG-HOST COLOR IS ALWAYS A FACT: a part directly hosting
    // an <svg> child whose glyph rides currentColor (Spinner's context-gray
    // arc) draws BLACK on the generated surfaces when the color chain is
    // context-inherited and therefore looked unstyled. Carry `color` on
    // svg hosts unconditionally (same rationale as text-part typography).
    if (a.baseFlat[pi].node.nodes.some((n) => n.t === 'el' && n.el.tag === 'svg') && !set.has('color')) {
      set.add('color');
      receipts.push(`svg-host-color-carried: ${a.partNames[pi]} — color carried even though equal to the control baseline (the hosted glyph rides the color chain; generated surfaces have no Polaris body context — round 5c)`);
    }
    const hasText = a.baseFlat[pi].node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
    const srOnly = (a.baseFlat[pi].node.style['clip-path'] ?? '').startsWith('inset(50%');
    if (hasText && !srOnly) {
      const added: string[] = [];
      for (const ch of ['font-size', 'line-height', 'font-weight']) {
        if (!set.has(ch)) { set.add(ch); added.push(ch); }
      }
      if (added.length > 0) {
        receipts.push(`text-part-typography-carried: ${a.partNames[pi]} — ${added.join('/')} carried even though equal to the control baseline (context-inherited typography IS the rendered truth; the generated surfaces have no Polaris body context, and the canvas otherwise draws its own 14px/500 defaults — round 5c)`);
      }
    }
    out.set(a.partNames[pi], set);
  }
  return out;
}

// ---------------------------------------------------------------------------
// DERIVED-CHANNEL FOLDING (item 4 / spike risk #2)
// ---------------------------------------------------------------------------
/** Channels whose CSS initial value is currentColor (or resolves to the used
 *  color): candidates for folding into the `color` fact. Folding is still
 *  EMPIRICAL — a candidate folds only when it equals the element's `color`
 *  in EVERY capture (all combos × all interactions). */
export const CURRENTCOLOR_FOLD_CANDIDATES = new Set([
  'caret-color', 'text-decoration-color', 'text-emphasis-color', 'column-rule-color',
  'outline-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
]);

export interface FoldReceipt {
  part: string;
  channel: string;
  foldedInto: 'color' | 'font-size';
  /** em ratio for font-size folds. */
  ratio?: number;
  class: 'currentColor' | 'em-tracking';
}

/** Detect folds per part. A folded channel's base values AND state deltas are
 *  carried by its source fact — it mints nothing, receipted by name. */
export function detectFolds(a: AlignedSweep, styled: Map<string, Set<string>>): FoldReceipt[] {
  const folds: FoldReceipt[] = [];
  const pxOf = (v: string | undefined): number | null => {
    if (v === undefined) return null;
    const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
    return m ? Number(m[1]) : null;
  };
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const part = a.partNames[pi];
    const channels = styled.get(part);
    if (!channels) continue;
    for (const ch of [...channels].sort()) {
      if (CURRENTCOLOR_FOLD_CANDIDATES.has(ch)) {
        let holds = true;
        for (const c of a.captures) {
          const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
          if (!el) continue;
          if (el.node.style[ch] !== el.node.style['color']) { holds = false; break; }
        }
        if (holds) { folds.push({ part, channel: ch, foldedInto: 'color', class: 'currentColor' }); continue; }
      }
      if (ch === 'font-size') continue;
      // em-tracking: constant ratio to font-size across ALL captures, with
      // font-size actually varying (otherwise indistinguishable from a
      // uniform value — uniform minting is the honest classification).
      let ratio: number | null = null;
      let holds = true;
      const fontSizes = new Set<string>();
      for (const c of a.captures) {
        const el = a.getAligned(`${c.combo}__${c.interaction}`)[pi];
        if (!el) continue;
        const v = pxOf(el.node.style[ch]);
        const fs = pxOf(el.node.style['font-size']);
        if (v === null || fs === null || fs === 0) { holds = false; break; }
        fontSizes.add(el.node.style['font-size']);
        const r = Math.round((v / fs) * 10000) / 10000;
        if (ratio === null) ratio = r;
        else if (r !== ratio) { holds = false; break; }
      }
      if (holds && ratio !== null && ratio !== 0 && fontSizes.size >= 2) {
        folds.push({ part, channel: ch, foldedInto: 'font-size', ratio, class: 'em-tracking' });
      }
    }
  }
  return folds;
}

// ---------------------------------------------------------------------------
// LAYOUT enrichment: computed flex keywords → the contract's OWN layout
// vocabulary (Part.layout). These channels are keyword-valued, so they can
// never mint — but the schema already has slots for them. Uniform observed
// values enrich absent slots; a carried slot that CONTRADICTS the computed
// truth becomes a named receipt (never silently overridden — the reviewed
// static layer wins values, the floor wins truth).
// ---------------------------------------------------------------------------
const LAYOUT_CHANNEL_TO_FIELD: Record<string, { field: 'display' | 'direction' | 'align' | 'justify'; map: Record<string, string> }> = {
  display: { field: 'display', map: { flex: 'flex', 'inline-flex': 'inline-flex' } },
  'flex-direction': { field: 'direction', map: { row: 'row', column: 'column' } },
  'align-items': { field: 'align', map: { 'flex-start': 'start', center: 'center', 'flex-end': 'end', stretch: 'stretch' } },
  'justify-content': { field: 'justify', map: { 'flex-start': 'start', center: 'center', 'flex-end': 'end', 'space-between': 'space-between' } },
};

export interface LayoutEnrichment {
  /** per part: layout channels consumed here (excluded from minting). */
  handled: Map<string, Set<string>>;
  enriched: Array<{ part: string; field: string; value: string }>;
  contradictions: Array<{ part: string; field: string; carried: string; observed: string }>;
  receipts: string[];
}

/** DETECTION ONLY (pure): reads the STATIC contract's layout slots; the
 *  enrichments are applied to the enriched clone by applyMintToContract. */
export function enrichLayout(
  a: AlignedSweep,
  space: PropSpace,
  styled: Map<string, Set<string>>,
  contract: Contract = space.contract,
): LayoutEnrichment {
  const staticParts = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const out: LayoutEnrichment = { handled: new Map(), enriched: [], contradictions: [], receipts: [] };
  const enabled = space.enumeration.combos.filter(isEnabled);
  for (let pi = 0; pi < a.baseFlat.length; pi++) {
    const partName = a.partNames[pi];
    const target = staticParts.get(partName);
    const channels = styled.get(partName);
    if (!target || !channels) continue;
    // only flex containers speak the layout vocabulary
    const baseDisplay = a.baseFlat[pi].node.style['display'];
    if (baseDisplay !== 'flex' && baseDisplay !== 'inline-flex') continue;
    for (const [channel, spec] of Object.entries(LAYOUT_CHANNEL_TO_FIELD)) {
      if (!channels.has(channel)) continue;
      const values = new Set<string>();
      for (const combo of enabled) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (el) values.add(el.node.style[channel]);
      }
      if (values.size !== 1) {
        out.receipts.push(`layout-not-uniform: ${partName}.${channel} varies across combos — stays code-only`);
        continue;
      }
      const observed = [...values][0];
      const canonical = spec.map[observed];
      const handledSet = out.handled.get(partName) ?? new Set<string>();
      out.handled.set(partName, handledSet);
      const carried = target.layout?.[spec.field];
      if (carried !== undefined) {
        handledSet.add(channel);
        if (canonical !== carried) {
          out.contradictions.push({ part: partName, field: spec.field, carried: String(carried), observed });
        }
        continue;
      }
      if (canonical === undefined) {
        out.receipts.push(`layout-value-outside-vocabulary: ${partName}.${channel} = "${observed}" — stays code-only`);
        continue;
      }
      handledSet.add(channel);
      out.enriched.push({ part: partName, field: spec.field, value: canonical });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// BOUND (§5.1): the static layer's carried bindings, browser-probed to
// canonical values, confirmed or contradicted per combo.
// ---------------------------------------------------------------------------
export interface BoundRow {
  combo: string;
  part: string;
  channel: string;
  ref: string;
  computedProp: string;
  expected: string;
  observed: string;
  verdict: 'confirmed' | 'contradiction' | 'part-absent';
  cause?: string;
}

/** Substitution map for one combo: every enum prop at its default, overridden
 *  by the combo's axis values (unset pseudo-values contribute NOTHING — the
 *  defaultless-enum rule the schema resolver implements). */
export function substFor(space: PropSpace, combo: Combo): Record<string, string> {
  const subst: Record<string, string> = {};
  for (const p of space.contract.props) {
    if (typeof p.type === 'object' && 'enum' in p.type && p.default !== undefined) {
      subst[p.name] = String(p.default);
    }
  }
  for (const a of space.axes) {
    const v = combo.axisValues[a.prop];
    if (a.unset !== undefined && v === a.unset) continue;
    subst[a.prop] = v;
  }
  return subst;
}

export async function boundCheck(
  a: AlignedSweep,
  comp: ComponentConfig,
  space: PropSpace,
  probeToken: (ref: string, computedProp: string) => Promise<string>,
  contract: Contract = space.contract,
): Promise<{ rows: BoundRow[]; untriaged: BoundRow[] }> {
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const rows: BoundRow[] = [];
  for (const combo of space.enumeration.combos) {
    if (!isEnabled(combo)) continue; // state-prop planes are states, not bases
    const subst = substFor(space, combo);
    const alignedEls = a.getAligned(`${combo.key}__default`);
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      const cPart = partByName.get(a.partNames[pi]);
      if (!cPart) continue;
      const carried = resolveTokens(cPart, subst);
      const el = alignedEls[pi];
      for (const [channel, ref] of Object.entries(carried)) {
        const computedProps = CHANNEL_TO_COMPUTED[channel];
        if (!computedProps) continue;
        for (const cp of computedProps) {
          if (!el) {
            // Round 4: a presence-gated part legitimately absent in this
            // combo — the binding is untestable there, NOT contradicted.
            rows.push({ combo: combo.key, part: a.partNames[pi], channel, ref, computedProp: cp, expected: '', observed: '', verdict: 'part-absent' });
            continue;
          }
          const expected = await probeToken(ref, cp);
          const observed = el.node.style[cp];
          rows.push({
            combo: combo.key, part: a.partNames[pi], channel, ref, computedProp: cp,
            expected, observed,
            verdict: expected === observed ? 'confirmed' : 'contradiction',
          });
        }
      }
    }
  }
  // Named-cause triage from config (the verify.ts curation discipline).
  // part-absent rows are informational (presence-gated parts).
  const contradicted = rows.filter((r) => r.verdict === 'contradiction');
  for (const r of contradicted) {
    const axisValues: Record<string, string> = {};
    space.axes.forEach((ax, i) => { axisValues[ax.prop] = r.combo.split('.')[i]; });
    for (const rule of comp.triage ?? []) {
      if (rule.part !== r.part || !rule.channels.includes(r.channel)) continue;
      const when = rule.when ?? {};
      const ok = Object.entries(when).every(([axis, cond]) => {
        const v = axisValues[axis];
        if (cond.in && !cond.in.includes(v)) return false;
        if (cond.notIn && cond.notIn.includes(v)) return false;
        return true;
      });
      if (ok) { r.cause = rule.cause; break; }
    }
  }
  return { rows, untriaged: contradicted.filter((r) => !r.cause) };
}

/** Channels the contract carries for a part (any combo/state) — BOUND
 *  territory; the mint pass never re-mints them. */
export function carriedChannels(part: Part | undefined): Set<string> {
  const out = new Set<string>();
  if (!part) return out;
  const addAll = (rec?: Record<string, string>) => {
    for (const ch of Object.keys(rec ?? {})) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? []) out.add(cp);
  };
  addAll(part.tokens);
  for (const e of tokensByPropEntries(part)) for (const m of Object.values(e.map)) addAll(m);
  addAll(part.literals);
  for (const e of part.literalsByProp ?? []) for (const m of Object.values(e.map)) addAll(m);
  for (const m of Object.values(part.states ?? {})) addAll(m);
  addAll(resolveLiterals(part, {}));
  // v15 declared facts: declared channels ARE computed longhands — a part
  // already carrying one never re-detects it.
  for (const ch of Object.keys(part.declared ?? {})) {
    for (const cp of CHANNEL_TO_COMPUTED[ch] ?? [ch]) out.add(cp);
  }
  for (const m of Object.values(part.declaredStates ?? {})) {
    for (const ch of Object.keys(m)) for (const cp of CHANNEL_TO_COMPUTED[ch] ?? [ch]) out.add(cp);
  }
  return out;
}

// ---------------------------------------------------------------------------
// MINT observations (§5.2): base + state deltas
// ---------------------------------------------------------------------------
export interface CodeOnlyEntry {
  part: string;
  channel: string;
  reason: string;
  sample: string;
  distinctValues?: number;
  state?: string;
}

/** v15 declared facts detected by fusion: a uniform unmintable value on a
 *  registry channel is a FACT the schema now carries, not extension residue. */
export interface DeclaredEnrichment {
  part: string;
  channel: string;
  value: string;
}
export interface DeclaredStateEnrichment extends DeclaredEnrichment {
  state: string;
}

export interface MintPrep {
  axes: MintAxis[];
  baseObs: MintObservation[];
  stateObs: MintObservation[];
  codeOnly: CodeOnlyEntry[];
  stateCodeOnly: CodeOnlyEntry[];
  /** v15: uniform declared facts (base plane) → Part.declared. */
  declared: DeclaredEnrichment[];
  /** v15: full-coverage uniform declared state deltas → Part.declaredStates. */
  declaredStates: DeclaredStateEnrichment[];
  inertOnDisabled: string[];
  pairwiseRefusals: string[];
  /** leaf-count comparison: mint run WITHOUT the folding pass. */
  unfoldedLeafCount: number;
  foldedStateSkips: string[];
  /** Round 5c: carried channels re-minted because a DEFAULTLESS axis
   *  contests their values (the Button tone×variant paint class). */
  remintReceipts: string[];
  /** Round 5c: set-plane literals for UNMINTABLE-KIND geometry channels
   *  (min-height auto→24px) — the refused-mint set planes are computed in
   *  applyMintToContract from the observations themselves. */
  setPlaneLiterals: SetPlaneLiteral[];
}

/** Box-geometry channels with no inheritance to lean on — the base-plane
 *  literal fallback set (round 4), module-scoped in round 5c so the
 *  SET-PLANE literal carriage shares it. */
export const BASE_FALLBACK_CHANNELS = new Set([
  'padding-left', 'padding-right', 'padding-top', 'padding-bottom',
  'padding-block', 'padding-inline', 'gap',
  'height', 'width', 'min-width', 'min-height',
  'border-radius', 'border-width',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
]);

/** Round 5c — SET-PLANE LITERALS: a geometry channel the mint refuses (or
 *  cannot kind — min-height auto→24px) still has EXACT per-plane truth on a
 *  DEFAULTLESS axis when, within one set value's presence-off slice, the
 *  captured value is uniform (Tag size=large: padding 8px, min-height 24px;
 *  the refusal came from presence-axis entanglement the boolean vocabulary
 *  cannot spell — those planes stay named residue). Carried as
 *  literalsByProp entries; the base plane keeps the round-4 base literal. */
export interface SetPlaneLiteral {
  part: string;
  channel: string;
  cands: Array<{ prop: string; value: string; lit: string }>;
}

export function setPlaneCandidates(
  rows: Array<{ axisValues: Record<string, string>; value: string }>,
  space: PropSpace,
): Array<{ prop: string; value: string; lit: string }> {
  const out: Array<{ prop: string; value: string; lit: string }> = [];
  const presenceOff = (r: { axisValues: Record<string, string> }) =>
    [...space.presence.keys()].every((pp) => (r.axisValues[pp] ?? PRESENCE_OFF) === PRESENCE_OFF);
  for (const ax of space.axes.filter((a) => a.unset !== undefined)) {
    const baseVals = new Set(
      rows.filter((r) => presenceOff(r) && r.axisValues[ax.prop] === ax.unset).map((r) => r.value),
    );
    for (const v of ax.values) {
      if (v === ax.unset) continue;
      const slice = rows.filter((r) => presenceOff(r) && r.axisValues[ax.prop] === v);
      if (slice.length === 0) continue;
      const vals = new Set(slice.map((r) => r.value));
      if (vals.size !== 1) continue;
      const lit = [...vals][0];
      if (!LITERAL_VALUE_RE.test(lit)) continue;
      if (baseVals.size === 1 && [...baseVals][0] === lit) continue; // redundant with the base plane
      out.push({ prop: ax.prop, value: v, lit });
    }
  }
  return out;
}

const STATE_SUFFIXES = ['hover', 'active', 'focus-visible', 'disabled'] as const;
export const stateOfMintProperty = (cssProperty: string): { channel: string; state: string } | null => {
  for (const s of STATE_SUFFIXES) {
    const suffix = `-state-${s}`;
    if (cssProperty.endsWith(suffix)) return { channel: cssProperty.slice(0, -suffix.length), state: s };
  }
  return null;
};

export function prepareMint(
  a: AlignedSweep,
  comp: ComponentConfig,
  space: PropSpace,
  styled: Map<string, Set<string>>,
  folds: FoldReceipt[],
  layoutHandled?: Map<string, Set<string>>,
  contract: Contract = space.contract,
  /** Union part names whose channels are consumed by promoted svg assets. */
  svgConsumedParts?: Set<string>,
): MintPrep {
  const axes: MintAxis[] = space.axes.map((ax) => ({ propName: ax.prop, values: [...ax.values] }));
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const foldedSet = new Set(folds.map((f) => `${f.part}|${f.channel}`));
  const enabledCombos = space.enumeration.combos.filter(isEnabled);

  const declarablePart = (partName: string): Part | undefined => {
    const p = partByName.get(partName);
    if (!p || p.component || p.slot) return undefined; // ref/slot parts never carry declared facts
    return p;
  };

  // Round 5c — CARRIED-CHANNEL RE-MINT on a defaultless-axis contest (the
  // Button tone×variant paint refusal): a channel the reviewed static layer
  // carries (per-variant tokensByProp) is BOUND territory, so the mint pass
  // skipped it — but when the observed values ALSO vary along a DEFAULTLESS
  // axis (tone), the reviewed carriage explains only the unset plane; the
  // set planes were silently absent (40 Primary cells at ~91% on the canvas
  // gate). Such channels re-mint: the S2 pair-with-unset carriage lands the
  // tone maps as tokensByProp entries with the unset plane as base, and the
  // applyMintToContract conflict rule keeps every reviewed binding (reviewed
  // same-prop channels are never re-added). Receipted by name.
  const unsetAxisNames = space.axes.filter((ax) => ax.unset !== undefined).map((ax) => ax.prop);
  const remintReceipts: string[] = [];
  const setPlaneLiterals: SetPlaneLiteral[] = [];
  const contestedByUnsetAxis = (pi: number, channel: string): string | null => {
    for (const axName of unsetAxisNames) {
      const groups = new Map<string, Set<string>>();
      for (const combo of enabledCombos) {
        const el = a.getAligned(`${combo.key}__default`)[pi];
        if (!el) continue;
        const ctx = JSON.stringify({ ...combo.axisValues, [axName]: '' });
        (groups.get(ctx) ?? groups.set(ctx, new Set()).get(ctx)!).add(el.node.style[channel]);
      }
      if ([...groups.values()].some((s) => s.size > 1)) return axName;
    }
    return null;
  };

  const buildBaseObs = (skipFolds: boolean): { obs: MintObservation[]; codeOnly: CodeOnlyEntry[]; declared: DeclaredEnrichment[]; pairwiseRefusals: string[] } => {
    const obs: MintObservation[] = [];
    const codeOnly: CodeOnlyEntry[] = [];
    const declared: DeclaredEnrichment[] = [];
    const pairwiseRefusals: string[] = [];
    for (let pi = 0; pi < a.baseFlat.length; pi++) {
      const partName = a.partNames[pi];
      if (svgConsumedParts?.has(partName)) continue; // svg internals: carried by the promoted icon asset (round 4)
      const carried = carriedChannels(partByName.get(partName));
      for (const channel of [...(styled.get(partName) ?? [])].sort()) {
        if (carried.has(channel)) {
          const contestingAxis = contestedByUnsetAxis(pi, channel);
          if (contestingAxis === null) continue;
          if (skipFolds) {
            remintReceipts.push(
              `carried-channel-reminted: ${partName}.${channel} — observed values vary along the defaultless axis "${contestingAxis}" while the reviewed carriage has no ${contestingAxis} plane; re-minted so the set planes carry (round 5c — S2 ${contestingAxis} maps with the unset base; reviewed bindings win every collision)`,
            );
          }
        }
        if (layoutHandled?.get(partName)?.has(channel)) continue; // carried by Part.layout (enrichLayout)
        if (skipFolds && foldedSet.has(`${partName}|${channel}`)) continue;
        const occurrences: MintObservation['occurrences'] = [];
        const rows: Array<{ axisValues: Record<string, string>; value: string }> = [];
        const values = new Set<string>();
        let unk: string | null = null;
        for (const combo of enabledCombos) {
          const el = a.getAligned(`${combo.key}__default`)[pi];
          if (!el) continue;
          const v = el.node.style[channel];
          // MUI round: a channel can be ABSENT on this part in some combos
          // (union-aligned parts that exist only under certain states).
          // `unk ??= undefined` is a no-op, so absence used to slip past the
          // unmintable guard and crash at kindOf — name it instead.
          if (v === undefined) { unk ??= '<channel absent in this combo>'; continue; }
          values.add(v);
          rows.push({ axisValues: combo.axisValues, value: v });
          const k = kindOf(channel, v);
          if (!k) { unk ??= v; continue; } // no break: declared detection needs the full value set
          occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
        }
        if (values.size === 0) {
          // MUI round: interaction-only union parts (-active, -focusVisible
          // thumbs) have NO element in any __default alignment — zero
          // observations is a named refusal, not a mintable base fact.
          codeOnly.push({ part: partName, channel, reason: 'part absent in every default-state combo (interaction-only part) — state rounds own it', sample: '<no default-state observation>', distinctValues: 0 });
          continue;
        }
        if (unk !== null) {
          // Round 5c — set-plane literals for unmintable-kind geometry
          // channels (min-height 'auto' at base, '24px' on the set plane).
          if (skipFolds && BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)) {
            const cands = setPlaneCandidates(rows, space);
            if (cands.length > 0) {
              setPlaneLiterals.push({ part: partName, channel, cands });
              remintReceipts.push(
                `set-plane-literal-carried: ${partName}.${channel} — unmintable at base (${rows.find((r) => true)?.value ?? '?'} …) but uniform per defaultless-axis plane over the presence-off slice: ${cands.map((c) => `${c.prop}=${c.value} → ${c.lit}`).join(', ')} (presence planes stay named residue — round 5c)`,
              );
            }
          }
          // v15 declared facts: a registry channel whose observed value is
          // UNIFORM across combos and inside the channel's bounded grammar is
          // carried (Part.declared), not extension residue. Everything else
          // stays code-only with the refusal spelled out.
          const spec = DECLARED_CHANNELS[channel];
          const uniform = values.size === 1 ? [...values][0] : null;
          if (spec && uniform !== null && spec.value.test(uniform)) {
            if (declarablePart(partName)) {
              declared.push({ part: partName, channel, value: uniform });
            } else {
              codeOnly.push({ part: partName, channel, reason: 'declared channel on a computed-only (or ref/slot) part — adding parts is a curation decision, not a capture decision', sample: uniform, distinctValues: values.size });
            }
          } else if (spec && uniform !== null) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value outside the bounded grammar — named residue (v15)', sample: uniform, distinctValues: values.size });
          } else if (spec) {
            codeOnly.push({ part: partName, channel, reason: 'declared-channel value varies across combos — declared facts carry uniform values only (v15); named residue', sample: unk, distinctValues: values.size });
          } else {
            codeOnly.push({ part: partName, channel, reason: 'value shape outside mintable kinds (color/px/number/shadow/gradient) and outside the declared-channel registry — no schema channel today', sample: unk, distinctValues: values.size });
          }
          continue;
        }
        if (space.enumeration.policy === 'per-axis+pairwise') {
          const refusals = pairwiseCertificate(rows, space.axes);
          if (refusals.length > 0) {
            pairwiseRefusals.push(`${partName}.${channel}: ${refusals.join('; ')}`);
            continue;
          }
        }
        obs.push({ nodePath: `${comp.name}:${partName}`, part: partName === 'root' ? '' : partName, cssProperty: channel, kind: kindOf(channel, [...values][0])!.kind, occurrences });
      }
    }
    return { obs, codeOnly, declared, pairwiseRefusals };
  };

  const folded = buildBaseObs(true);
  const unfolded = buildBaseObs(false);

  // ---- state deltas (§2 / §5.2 state minting) ----
  interface StateDelta { state: string; part: string; channel: string; occurrences: MintObservation['occurrences']; kinds: Set<string>; samples: Set<string>; combosSeen: Set<string> }
  const stateDeltaChannels = new Map<string, StateDelta>();
  const stateCodeOnly: CodeOnlyEntry[] = [];
  const declaredStates: DeclaredStateEnrichment[] = [];
  const inertOnDisabled: string[] = [];
  const foldedStateSkips: string[] = [];

  const pushStateValue = (state: string, part: string, channel: string, combo: Combo, v: string) => {
    const key = `${state}|${part}|${channel}`;
    let d = stateDeltaChannels.get(key);
    if (!d) stateDeltaChannels.set(key, (d = { state, part, channel, occurrences: [], kinds: new Set(), samples: new Set(), combosSeen: new Set() }));
    const k = kindOf(channel, v);
    d.samples.add(v);
    d.combosSeen.add(combo.key);
    if (k) {
      d.kinds.add(k.kind);
      d.occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
    } else d.kinds.add('unmintable');
  };

  const allProps = Object.keys(a.baseFlat[0].node.style);
  for (const combo of space.enumeration.combos) {
    const defaults = a.getAligned(`${combo.key}__default`);
    for (const interaction of ['hover', 'focus-visible', 'active'] as Interaction[]) {
      const els = a.getAligned(`${combo.key}__${interaction}`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (svgConsumedParts?.has(a.partNames[pi])) continue;
        const d0 = defaults[pi];
        const d1 = els[pi];
        if (!d0 || !d1) continue;
        for (const p of allProps) {
          if (!isFusable(p)) continue;
          if (d0.node.style[p] === d1.node.style[p]) continue;
          if (!isEnabled(combo)) {
            const flagged = Object.entries(combo.stateFlags).filter(([, f]) => f).map(([n]) => n).join('+');
            inertOnDisabled.push(`interaction-on-${flagged}-changed: ${combo.key} ${interaction} ${a.partNames[pi]}.${p}`);
            continue;
          }
          pushStateValue(interaction, a.partNames[pi], p, combo, d1.node.style[p]);
        }
      }
    }
  }
  // state-props (disabled-like): diff each flagged combo against its unflagged twin
  for (const s of space.stateProps) {
    for (const combo of space.enumeration.combos) {
      if (!combo.stateFlags[s.prop]) continue;
      // twin = same axis values + same other flags, this flag false
      const twin = space.enumeration.combos.find(
        (c) =>
          space.axes.every((ax) => c.axisValues[ax.prop] === combo.axisValues[ax.prop]) &&
          space.stateProps.every((sp) => c.stateFlags[sp.prop] === (sp.prop === s.prop ? false : combo.stateFlags[sp.prop])),
      );
      if (!twin || !isEnabled(twin)) continue;
      const d0 = a.getAligned(`${twin.key}__default`);
      const d1 = a.getAligned(`${combo.key}__default`);
      for (let pi = 0; pi < a.baseFlat.length; pi++) {
        if (svgConsumedParts?.has(a.partNames[pi])) continue;
        if (!d0[pi] || !d1[pi]) continue;
        for (const p of allProps) {
          if (!isFusable(p)) continue;
          if (d0[pi]!.node.style[p] === d1[pi]!.node.style[p]) continue;
          pushStateValue(s.state, a.partNames[pi], p, twin, d1[pi]!.node.style[p]);
        }
      }
    }
  }

  // full-coverage state deltas → mint; partial deltas padded with defaults
  // (a partial delta is itself a per-axis fact); unmintable → extension.
  // Folded channels are excluded from the FOLDED observation set (their
  // deltas ride the source fact, receipted) but included in the unfolded
  // set — the before→after leaf-count receipt measures the folding pass
  // end to end.
  const stateObsAll: Array<{ obs: MintObservation; folded: boolean }> = [];
  const expectedEnabled = enabledCombos.length;
  for (const d of [...stateDeltaChannels.values()].sort((x, y) => `${x.state}|${x.part}|${x.channel}`.localeCompare(`${y.state}|${y.part}|${y.channel}`))) {
    const foldedChannel = foldedSet.has(`${d.part}|${d.channel}`);
    if (foldedChannel) foldedStateSkips.push(`fold-carries-state-delta: [${d.state}] ${d.part}.${d.channel} rides its source fact`);
    if (d.kinds.has('unmintable') || d.kinds.size !== 1) {
      if (!foldedChannel) {
        // v15 declared state facts: a registry channel whose delta is
        // UNIFORM and observed on EVERY enabled combo (a partial delta would
        // misapply to non-delta variants under a state selector) carries as
        // Part.declaredStates. Everything else stays named residue.
        const spec = DECLARED_CHANNELS[d.channel];
        const uniform = d.samples.size === 1 ? [...d.samples][0] : null;
        if (spec && uniform !== null && spec.value.test(uniform) && d.combosSeen.size === expectedEnabled && declarablePart(d.part)) {
          declaredStates.push({ state: d.state, part: d.part, channel: d.channel, value: uniform });
        } else if (spec && uniform !== null && spec.value.test(uniform) && d.combosSeen.size !== expectedEnabled) {
          stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: uniform, reason: `declared-channel state delta on ${d.combosSeen.size}/${expectedEnabled} combos — partial coverage cannot carry as a state selector (v15); named residue` });
        } else {
          stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: d.kinds.has('unmintable') ? 'value shape outside mintable kinds and outside the declared vocabulary' : 'mixed value kinds across combos' });
        }
      }
      continue;
    }
    if (d.occurrences.length < expectedEnabled) {
      const have = new Set(d.occurrences.map((o) => o.variant));
      let padded = true;
      for (const combo of enabledCombos) {
        if (have.has(combo.key)) continue;
        const pi = a.partNames.indexOf(d.part);
        const el = a.getAligned(`${combo.key}__default`)[pi];
        const v = el?.node.style[d.channel];
        const k = v !== undefined ? kindOf(d.channel, v) : null;
        if (!k || k.kind !== [...d.kinds][0]) { padded = false; break; }
        d.occurrences.push({ variant: combo.key, axisValues: combo.axisValues, value: k.value });
      }
      if (!padded) {
        if (!foldedChannel) stateCodeOnly.push({ state: d.state, part: d.part, channel: d.channel, sample: [...d.samples][0], reason: 'default-state values not kind-compatible for padding — cannot correlate' });
        continue;
      }
    }
    stateObsAll.push({
      folded: foldedChannel,
      obs: {
        nodePath: `${comp.name}:${d.part}:${d.state}`,
        part: d.part === 'root' ? '' : d.part,
        cssProperty: `${d.channel}-state-${d.state}`,
        kind: [...d.kinds][0] as MintObservation['kind'],
        occurrences: d.occurrences,
      },
    });
  }
  const stateObs = stateObsAll.filter((s) => !s.folded).map((s) => s.obs);

  // before→after: the unfolded mint (base + state observations, NO folding
  // pass) is the spike's leaf universe; the folded mint is what the
  // production module actually mints. Both counts are quoted.
  const unfoldedMint = mintTokens(comp.name, [...unfolded.obs, ...stateObsAll.map((s) => s.obs)], axes);

  return {
    axes,
    baseObs: folded.obs,
    stateObs,
    codeOnly: folded.codeOnly,
    stateCodeOnly,
    declared: folded.declared,
    declaredStates,
    inertOnDisabled,
    pairwiseRefusals: folded.pairwiseRefusals,
    unfoldedLeafCount: unfoldedMint.count,
    foldedStateSkips: [...new Set(foldedStateSkips)],
    remintReceipts: [...new Set(remintReceipts)],
    setPlaneLiterals,
  };
}

// ---------------------------------------------------------------------------
// Enriched-contract application (S2/S3-hardened; §5.4)
// ---------------------------------------------------------------------------
export interface OverflowBinding {
  part: string;
  channel: string;
  state?: string;
  ref?: string;
  refusal: string;
}

export interface ApplyResult {
  enriched: Contract & Record<string, unknown>;
  overflowBindings: OverflowBinding[];
  enrichmentNotes: string[];
}

const placeholdersOf = (ref: string): string[] => [...ref.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).slice(0);

export function applyMintToContract(
  contract: Contract,
  space: PropSpace,
  mintBase: MintResult,
  baseObs: MintObservation[],
  mintStates: MintResult,
  stateObs: MintObservation[],
  layoutEnrichments: LayoutEnrichment['enriched'] = [],
  declaredEnrichments: DeclaredEnrichment[] = [],
  declaredStateEnrichments: DeclaredStateEnrichment[] = [],
  setPlaneLiterals: SetPlaneLiteral[] = [],
): ApplyResult {
  const enriched = structuredClone(contract) as Contract & Record<string, unknown>;
  const overflowBindings: OverflowBinding[] = [];
  const enrichmentNotes: string[] = [];
  const partByName = new Map(walkAnatomy(enriched).map((w) => [w.name, w.part] as const));
  for (const le of layoutEnrichments) {
    const target = partByName.get(le.part);
    if (!target) continue;
    target.layout ??= {};
    (target.layout as Record<string, string>)[le.field] = le.value;
    enrichmentNotes.push(`layout enriched: ${le.part}.layout.${le.field} = ${le.value} (uniform computed keyword — the schema's own vocabulary)`);
  }
  // v15 declared facts (S4): uniform registry-channel values → Part.declared;
  // full-coverage uniform state deltas → Part.declaredStates. The reviewed
  // static layer wins on collision (??=), like every other enrichment.
  for (const de of declaredEnrichments) {
    const target = partByName.get(de.part);
    if (!target || target.component || target.slot) continue; // guarded upstream; belt and braces
    target.declared ??= {};
    if (!(de.channel in target.declared)) {
      target.declared[de.channel] = de.value;
      enrichmentNotes.push(`declared fact carried: ${de.part}.${de.channel} = ${de.value} (v15 declared vocabulary — ${DECLARED_CHANNELS[de.channel]?.canvas === 'draw' ? 'canvas-drawable' : 'declared-not-drawn on canvas'})`);
    }
  }
  for (const de of declaredStateEnrichments) {
    const target = partByName.get(de.part);
    if (!target || target.component || target.slot) continue;
    target.declaredStates ??= {};
    target.declaredStates[de.state] ??= {};
    if (!(de.channel in target.declaredStates[de.state])) {
      target.declaredStates[de.state][de.channel] = de.value;
      if (!(enriched.states as string[]).includes(de.state)) (enriched.states as string[]).push(de.state as never);
      enrichmentNotes.push(`declared state fact carried: [${de.state}] ${de.part}.${de.channel} = ${de.value} (v15 declared vocabulary)`);
    }
  }
  const unsetAxes = new Map(space.axes.filter((ax) => ax.unset !== undefined).map((ax) => [ax.prop, ax.unset!] as const));
  const refusedSetPlaneLits: SetPlaneLiteral[] = [];

  const perAxisAdditions = new Map<string, Map<string, Record<string, Record<string, string>>>>(); // part → prop → value → channel → ref

  const addPerAxis = (partName: string, prop: string, value: string, channel: string, ref: string) => {
    const byProp = perAxisAdditions.get(partName) ?? new Map();
    perAxisAdditions.set(partName, byProp);
    const map = byProp.get(prop) ?? {};
    byProp.set(prop, map);
    (map[value] ??= {})[channel] = ref;
  };

  const apply = (result: MintResult, obsList: MintObservation[], isState: boolean) => {
    result.bindings.forEach((b, i) => {
      const obs = obsList[i];
      const partName = obs.part === '' ? 'root' : obs.part;
      const parsed = isState ? stateOfMintProperty(obs.cssProperty) : null;
      const channel = parsed ? parsed.channel : obs.cssProperty;
      const state = parsed?.state;
      if (b.ref === null) {
        // Round 4 base-plane literal fallback: an UNCORRELATED base channel
        // still has one exact truth at the BASE combo — carried as a literal
        // (bounded LITERAL_CHANNELS grammar) so the default plane renders
        // right on every surface; the set planes stay NAMED residue.
        if (!state) {
          // NON-INHERITED box geometry only: inherited channels (color,
          // typography) are usually RIGHT via CSS inheritance when absent —
          // a base literal would break that (Button's primary label went
          // dark). Paddings/sizes/radii/borders have no inheritance to lean
          // on; absence there is a raw UA default.
          const target0 = partByName.get(partName);
          const baseOcc = obs.occurrences.find((o) => o.variant === space.baseComboKey);
          if (target0 && baseOcc !== undefined && BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)) {
            const lit = obs.kind === 'px' ? `${baseOcc.value}px` : obs.kind === 'color' ? `#${baseOcc.value}` : obs.kind === 'number' ? String(baseOcc.value) : null;
            if (lit !== null && LITERAL_VALUE_RE.test(lit)) {
              target0.literals ??= {};
              if (!(channel in target0.literals)) {
                target0.literals[channel] = lit;
                enrichmentNotes.push(`base-plane literal carried: ${partName}.${channel} = ${lit} (uncorrelated across planes — the base combo's exact value; set planes remain named residue)`);
              }
            }
            // Round 5c — SET-PLANE literals: the refused channel's exact
            // per-plane truth on defaultless axes (presence-off slice
            // uniform), carried as literalsByProp (Tag size=large 8px).
            const rows = obs.occurrences
              .map((o) => ({
                axisValues: o.axisValues,
                value: obs.kind === 'px' ? `${o.value}px` : obs.kind === 'number' ? String(o.value) : '',
              }))
              .filter((r) => r.value !== '');
            const cands = setPlaneCandidates(rows, space);
            if (cands.length > 0) refusedSetPlaneLits.push({ part: partName, channel, cands });
          }
        }
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), refusal: b.reason ?? 'uncorrelated' });
        return;
      }
      const target = partByName.get(partName);
      if (!target) {
        overflowBindings.push({ part: partName, channel, ...(state ? { state } : {}), ref: b.ref, refusal: 'computed-only part not present in the committed anatomy — adding parts is a curation decision, not a capture decision' });
        return;
      }
      const inner = b.ref.slice(1, -1);
      const phs = placeholdersOf(inner);

      if (state) {
        if (!STATE_SUFFIXES.includes(state as (typeof STATE_SUFFIXES)[number])) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state outside the schema state vocabulary' });
          return;
        }
        const declareState = () => {
          if (!(enriched.states as string[]).includes(state)) (enriched.states as string[]).push(state as never);
        };
        if (phs.some((p) => space.presence.has(p))) {
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'presence-prop state ref — boolean substitution has no spelling (round 4 residue)' });
          return;
        }
        if (partName !== 'root') {
          // v13 Part.states: color-kind channels, plain refs only
          if (!['color', 'background-color', 'border-color'].includes(channel) || phs.length > 0) {
            overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'v13 Part.states carries plain color-kind refs only on non-root parts' });
            return;
          }
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        // root states: the emitters expand ≤1 placeholder (S3)
        if (phs.length === 0) {
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        const unsetPh = phs.find((p) => unsetAxes.has(p));
        if (phs.length === 1 && !unsetPh) {
          // substituted state ref — expands per enum class (defaulted axis:
          // the class is always present, every plane carried)
          target.states ??= {};
          target.states[state] ??= {};
          if (!(channel in target.states[state])) { target.states[state][channel] = b.ref; declareState(); }
          return;
        }
        if (unsetPh) {
          // unset-axis state ref: carry the BASE (unset) plane — after
          // pinning the unset slot the ref has ≤1 remaining placeholder,
          // which root states DO carry (the emitters expand it per enum
          // class). The set planes are S3 residue, named — root states
          // cannot spell "axis value AND state" beyond one substitution.
          const reduced = `{${inner.replaceAll(`{${unsetPh}}`, unsetAxes.get(unsetPh)!)}}`;
          const remaining = placeholdersOf(reduced.slice(1, -1));
          if (remaining.length <= 1) {
            target.states ??= {};
            target.states[state] ??= {};
            if (!(channel in target.states[state])) { target.states[state][channel] = reduced; declareState(); }
            overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: `state×${unsetPh} set-planes beyond the carried unset plane (S3 residue — leaves exist in the minted tree)` });
            return;
          }
          overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state ref with >1 placeholder after unset pinning — beyond root-state vocabulary (S3 residue)' });
          return;
        }
        overflowBindings.push({ part: partName, channel, state, ref: b.ref, refusal: 'state pair ref — root states carry ≤1 placeholder (S3 residue)' });
        return;
      }

      // ---- base bindings ----
      if (phs.length === 0) {
        target.tokens ??= {};
        if (!(channel in target.tokens)) target.tokens[channel] = b.ref;
        return;
      }
      if (phs.length === 1) {
        const axisProp = phs[0];
        const axis = space.axes.find((ax) => ax.prop === axisProp);
        if (!axis) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `substituted axis "${axisProp}" not an enumerated axis` });
          return;
        }
        if (space.presence.has(axisProp)) {
          // Round 4: presence axes are BOOLEAN contract props — tokensByProp
          // has no boolean spelling; presence-driven styling is named residue
          // (the created SUBTREE itself is carried via visibleWhen instead).
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `presence-prop-driven styling (${axisProp}) — boolean tokensByProp has no spelling (round 4 residue)` });
          return;
        }
        const groupBase = inner.replace(`.{${axisProp}}`, '');
        if (axis.unset !== undefined) {
          // S2: the unset value's leaf is the BASE binding; set values ride
          // the tokensByProp map (plain refs — emitter-supported everywhere).
          target.tokens ??= {};
          if (!(channel in target.tokens)) target.tokens[channel] = `{${groupBase}.${axis.unset}}`;
          for (const v of axis.values) {
            if (v === axis.unset) continue;
            addPerAxis(partName, axisProp, v, channel, `{${groupBase}.${v}}`);
          }
        } else {
          for (const v of axis.values) addPerAxis(partName, axisProp, v, channel, `{${groupBase}.${v}}`);
        }
        return;
      }
      if (phs.length === 2) {
        if (partName !== 'root') {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'pair ref on a nested part — root-only in the emitters (mint refuses these upstream; guarded here too)' });
          return;
        }
        const [pa, pb] = phs; // leaf-path order (mint axis discovery order)
        if (space.presence.has(pa) || space.presence.has(pb)) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'presence-prop pair ref — boolean tokensByProp has no spelling (round 4 residue)' });
          return;
        }
        const ua = unsetAxes.get(pa);
        const ub = unsetAxes.get(pb);
        if (ua !== undefined && ub !== undefined) {
          overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: 'pair ref over TWO unset axes — no carried spelling; named residue' });
          return;
        }
        if (ua === undefined && ub === undefined) {
          // both axes defaulted → their enum classes are always present; the
          // two-placeholder root ref expands as compound modifier rules.
          target.tokens ??= {};
          if (!(channel in target.tokens)) target.tokens[channel] = b.ref;
          return;
        }
        // ONE unset axis (S2 pair carriage): base plane = per-OTHER-axis map
        // of fully resolved refs (unset slot pinned); set planes = per-UNSET-
        // value map whose refs keep the other placeholder — the reviewed
        // emitter capability lift expands them as compound rules.
        const unsetProp = ua !== undefined ? pa : pb;
        const unsetLabel = (ua ?? ub)!;
        const otherProp = ua !== undefined ? pb : pa;
        const otherAxis = space.axes.find((ax) => ax.prop === otherProp)!;
        const unsetAxis = space.axes.find((ax) => ax.prop === unsetProp)!;
        for (const ov of otherAxis.values) {
          const resolved = `{${inner.replaceAll(`{${unsetProp}}`, unsetLabel).replaceAll(`{${otherProp}}`, ov)}}`;
          addPerAxis(partName, otherProp, ov, channel, resolved);
        }
        for (const uv of unsetAxis.values) {
          if (uv === unsetLabel) continue;
          const partial = `{${inner.replaceAll(`{${unsetProp}}`, uv)}}`;
          addPerAxis(partName, unsetProp, uv, channel, partial);
        }
        enrichmentNotes.push(`pair-with-unset carried: ${partName}.${channel} = base plane per ${otherProp} + placeholder maps per ${unsetProp} (emitter capability lift)`);
        return;
      }
      overflowBindings.push({ part: partName, channel, ref: b.ref, refusal: `${phs.length} placeholders — beyond the two-axis vocabulary` });
    });
  };

  apply(mintBase, baseObs, false);
  apply(mintStates, stateObs, true);

  // Round 5c — attach SET-PLANE literals (refused-mint geometry planes +
  // prepareMint's unmintable-kind planes) as literalsByProp entries; a
  // reviewed same-prop entry's channels are never re-added (the v14 rule,
  // mirrored from the tokensByProp merge below).
  {
    const byPart = new Map<string, Map<string, Record<string, Record<string, string>>>>();
    for (const spl of [...refusedSetPlaneLits, ...setPlaneLiterals]) {
      const target = partByName.get(spl.part);
      if (!target) continue;
      if (BASE_FALLBACK_CHANNELS.has(spl.channel) === false) continue;
      const byProp = byPart.get(spl.part) ?? new Map<string, Record<string, Record<string, string>>>();
      byPart.set(spl.part, byProp);
      for (const c of spl.cands) {
        const map = byProp.get(c.prop) ?? {};
        byProp.set(c.prop, map);
        (map[c.value] ??= {})[spl.channel] = c.lit;
      }
    }
    for (const [partName, byProp] of byPart) {
      const target = partByName.get(partName)!;
      const existing = (target.literalsByProp ?? []).map((e) => structuredClone(e));
      for (const [prop, map] of [...byProp.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        for (const e of existing) {
          if (e.prop !== prop) continue;
          const reviewedChannels = new Set(Object.values(e.map).flatMap((m) => Object.keys(m)));
          for (const val of Object.keys(map)) {
            for (const chn of Object.keys(map[val])) {
              if (reviewedChannels.has(chn)) {
                delete map[val][chn];
                enrichmentNotes.push(`literalsByProp conflict avoided: ${partName}.${chn} on prop ${prop} already reviewed — set-plane literal not re-added`);
              }
            }
            if (Object.keys(map[val]).length === 0) delete map[val];
          }
        }
        if (Object.keys(map).length > 0) {
          const ordered: Record<string, Record<string, string>> = {};
          for (const k of Object.keys(map).sort()) {
            ordered[k] = Object.fromEntries(Object.entries(map[k]).sort(([x], [y]) => x.localeCompare(y)));
          }
          existing.push({ prop, map: ordered });
          enrichmentNotes.push(`set-plane literals carried: ${partName} per ${prop} → ${Object.entries(ordered).map(([v, m]) => `${v}:{${Object.entries(m).map(([chn, lv]) => `${chn}=${lv}`).join(', ')}}`).join(' ')} (round 5c — refused/unmintable geometry planes; presence planes stay named residue)`);
        }
      }
      if (existing.length > 0) target.literalsByProp = existing as never;
    }
  }

  // merge per-axis additions as v14 multi-entry tokensByProp — appended AFTER
  // existing entries (computed enrichment must not shadow reviewed bindings);
  // the v14 refusal rule (no two entries sharing BOTH prop and channel) is
  // honored by stripping channels a reviewed same-prop entry already maps.
  for (const [partName, byProp] of perAxisAdditions) {
    const target = partByName.get(partName);
    if (!target) continue;
    const existing = tokensByPropEntries(target).map((e) => structuredClone(e));
    for (const [prop, map] of [...byProp.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      for (const e of existing) {
        if (e.prop !== prop) continue;
        const reviewedChannels = new Set(Object.values(e.map).flatMap((m) => Object.keys(m)));
        for (const val of Object.keys(map)) {
          for (const ch of Object.keys(map[val])) {
            if (reviewedChannels.has(ch)) {
              delete map[val][ch];
              enrichmentNotes.push(`tokensByProp conflict avoided: ${partName}.${ch} on prop ${prop} already reviewed — computed value not re-added`);
            }
          }
          if (Object.keys(map[val]).length === 0) delete map[val];
        }
      }
      if (Object.keys(map).length > 0) {
        const ordered: Record<string, Record<string, string>> = {};
        for (const k of Object.keys(map).sort()) {
          ordered[k] = Object.fromEntries(Object.entries(map[k]).sort(([x], [y]) => x.localeCompare(y)));
        }
        existing.push({ prop, map: ordered });
      }
    }
    if (existing.length > 0) target.tokensByProp = existing as never;
  }

  return { enriched, overflowBindings, enrichmentNotes };
}

// ---------------------------------------------------------------------------
// Pseudo-element findings (§3.1 / S5)
// ---------------------------------------------------------------------------
export interface PseudoFinding {
  combo: string;
  interaction: string;
  part: string;
  pseudo: string;
  deltaVsDefault: StyleMap;
}

export function pseudoFindings(a: AlignedSweep, classPrefix: string): PseudoFinding[] {
  const findings: PseudoFinding[] = [];
  for (const c of a.captures) {
    const flatC = flatten(c.root, classPrefix);
    const def = a.byKey.get(`${c.combo}__default`);
    if (!def) continue;
    const flatD = flatten(def.root, classPrefix);
    for (let i = 0; i < flatC.length; i++) {
      for (const pe of ['::before', '::after'] as const) {
        const now = flatC[i]?.node.pseudo[pe];
        if (!now) continue;
        const before = flatD[i]?.node.pseudo[pe];
        const delta: StyleMap = {};
        for (const [k, v] of Object.entries(now)) {
          if (!before || before[k] !== v) delta[k] = v;
        }
        if (c.interaction === 'default' || Object.keys(delta).length > 0) {
          findings.push({
            combo: c.combo,
            interaction: c.interaction,
            part: a.partNames[i] ?? `el@${flatC[i].path}`,
            pseudo: pe,
            deltaVsDefault: c.interaction === 'default' ? { content: now.content } : delta,
          });
        }
      }
    }
  }
  return findings;
}
