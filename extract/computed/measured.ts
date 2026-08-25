/**
 * THIS RUN'S MEASURED TRUTH, addressed by (part, channel, combo).
 *
 * WHY THIS EXISTS (RC6 — the stale token alias). A human-acked decision in
 * `out/<component>/decisions.json` names a TARGET token and is re-applied to
 * every fresh fusion by `decisions.ts applyDecisions`. The only gate on that
 * target used to be an EXISTENCE check ("is `{color-accent}` a token this
 * library ships?"). It is, so it passed — while the DS moved
 * `color-accent` from `#0064e0` to `#262626` and astryx Badge's five semantic
 * variants silently repainted charcoal-on-charcoal. Nothing in the pipeline
 * ever compared the alias to what the browser actually measured.
 *
 * A value check needs a referee, and the referee CANNOT be the ledger's own
 * `observed` field: that string is the measurement of the run that recorded
 * the decision, and it goes stale exactly like the token does (astryx Card
 * records `rgba(0, 0, 0, 1)` where today's capture measures
 * `rgba(23, 23, 23, 1)` — refereeing against it refuses three CORRECT rows).
 *
 * The referee is the COMMITTED CAPTURED TRUTH — `captured-truth.json`, the
 * artifact the enriched contract itself is fused from. It is re-read here the
 * same way `replay.ts reconstructCaptures` reads it (base style + per-part
 * delta, `repStyle` for off-base parts, the same pure `decomposeTranslate` /
 * `foldTextFillColor` read-boundary folds), but addressed BY PART NAME rather
 * than by tree path — an off-base capture renumbers paths when a part is
 * absent, and a decision names a part, never a path.
 *
 * Nothing here reaches the network, a browser, or an npm sandbox: the same
 * bytes that produced the contract referee the ledger that edits it.
 */
import {
  CHANNEL_TO_COMPUTED,
  decomposeTranslate,
  flatten,
  foldTextFillColor,
  normalizeValue,
  type CapturedNode,
  type StyleMap,
} from './lib.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';

/** One measured value: the computed longhand `computedProp` of `part` in
 *  `combo`, at the DEFAULT interaction. */
export interface MeasuredSite {
  combo: string;
  part: string;
  computedProp: string;
  /** The raw computed string, normalized exactly as the capture reader
   *  normalizes it (rgb → rgba, translate decomposed, painted ink folded). */
  value: string;
}

export interface MeasuredTruth {
  /** Every measurement this run made of (part, channel) across `combos`.
   *  EMPTY means the run measured nothing there — never "it agrees". */
  at(part: string, channel: string, combos: readonly string[]): MeasuredSite[];
  /** Combo keys the truth file actually carries a DEFAULT capture for. */
  readonly combos: ReadonlySet<string>;
}

/** The default interaction — a decision scope names axis VALUES, never a
 *  state plane, so hover/active/focus captures are not sites for it. */
const DEFAULT_INTERACTION = 'default';

const splitKey = (key: string): { combo: string; interaction: string } => {
  const i = key.lastIndexOf('__');
  return i < 0 ? { combo: key, interaction: DEFAULT_INTERACTION } : { combo: key.slice(0, i), interaction: key.slice(i + 2) };
};

export function measuredTruth(truth: CapturedTruthFile): MeasuredTruth {
  const anatomyByPart = new Map(truth.anatomy.map((a) => [a.part, a] as const));
  const baseByPath = new Map(flatten(truth.base.root).map((e) => [e.path, e.node] as const));

  /** The part's style in the BASE capture — its own tree node when it is in
   *  the base tree, the anatomy's representative style when it is not (the
   *  v2 `repStyle` reference an off-base delta is taken against). */
  const baseStyleOf = (part: string): StyleMap | undefined => {
    const a = anatomyByPart.get(part);
    if (!a) return undefined;
    if (a.inBase === false) return a.repStyle;
    return baseByPath.get(a.path)?.style;
  };

  /** Read the read-boundary folds the replay path applies, so an offline
   *  referee and a live capture agree byte-for-byte. Both are pure and
   *  idempotent (see replay.ts). */
  const folded = (style: StyleMap): StyleMap => {
    const out: StyleMap = { ...style };
    decomposeTranslate(out);
    foldTextFillColor(out);
    return out;
  };

  // combo → part → folded style, DEFAULT interaction only.
  const byCombo = new Map<string, Map<string, StyleMap>>();
  const record = (combo: string, part: string, style: StyleMap): void => {
    let m = byCombo.get(combo);
    if (!m) byCombo.set(combo, (m = new Map()));
    m.set(part, folded(style));
  };

  {
    const { combo, interaction } = splitKey(truth.base.key);
    if (interaction === DEFAULT_INTERACTION) {
      for (const a of truth.anatomy) {
        const st = baseStyleOf(a.part);
        if (st) record(combo, a.part, st);
      }
    }
  }

  for (const cap of truth.captures) {
    const { combo, interaction } = splitKey(cap.key);
    if (interaction !== DEFAULT_INTERACTION) continue;
    if (cap.fullRoot) {
      // A capture the template encoding could not reproduce carries its whole
      // tree; part names ride the anatomy PATH there, which is sound because
      // a fullRoot capture is stored precisely so its shape is authoritative.
      const byPath = new Map(flatten(cap.fullRoot as CapturedNode).map((e) => [e.path, e.node] as const));
      for (const a of truth.anatomy) {
        const node = byPath.get(a.path);
        if (node) record(combo, a.part, node.style);
      }
      continue;
    }
    for (const el of cap.elements ?? []) {
      if (el.delta === null || el.delta === undefined) continue; // absent part — not a site
      const base = baseStyleOf(el.part);
      if (!base) continue;
      record(combo, el.part, { ...base, ...el.delta });
    }
  }

  return {
    combos: new Set(byCombo.keys()),
    at(part, channel, combos) {
      const props = CHANNEL_TO_COMPUTED[channel] ?? [channel];
      const out: MeasuredSite[] = [];
      for (const combo of combos) {
        const style = byCombo.get(combo)?.get(part);
        if (!style) continue;
        for (const computedProp of props) {
          const raw = style[computedProp];
          // A longhand the sweep never enumerated is NOT a measurement of
          // zero — it is silence, and silence must not referee anything.
          if (raw === undefined) continue;
          out.push({ combo, part, computedProp, value: normalizeValue(raw) });
        }
      }
      return out;
    },
  };
}

/**
 * THE READER IS PINNED AGAINST THE CANONICAL ONE.
 *
 * `measuredTruth` re-reads the truth file BY PART NAME because a decision names
 * a part and an off-base capture renumbers tree paths. That is a SECOND reader
 * of the same bytes, and a second reader is a second thing that can be wrong —
 * a referee nobody checks is how RC6 happened in the first place.
 *
 * So: for every capture the canonical `reconstructCaptures` can address by
 * path without ambiguity (rides the base tree; no off-base rebuild, no
 * `fullRoot`), every computed longhand this module reports must equal what the
 * canonical reconstruction holds at the same part. Returns the disagreements;
 * the caller refuses on a non-empty list.
 *
 * NAMED BLIND SPOT: a part with `inBase === false`, an `offBase` capture and a
 * `fullRoot` capture are all SKIPPED, because there the canonical reader is not
 * an independent second opinion — it rebuilds the very tree this module reads
 * by part name, so agreeing would prove nothing and disagreeing would only
 * measure the rebuild. Those sites are refereed by the value check alone.
 *
 * `reader` is injectable for one reason only: so a pin can prove this check is
 * not vacuous by handing it a reader that really does disagree. Production
 * callers pass nothing.
 */
export function refereeReaderDisagreements(
  truth: CapturedTruthFile,
  reader: (t: CapturedTruthFile) => MeasuredTruth = measuredTruth,
): string[] {
  const out: string[] = [];
  const byPath = new Map(truth.anatomy.map((a) => [a.part, a.path] as const));
  const canonical = new Map<string, CapturedNode>();
  const shapeSafe = new Set<string>();
  for (const cap of reconstructCaptures(truth)) {
    if (cap.interaction !== DEFAULT_INTERACTION) continue;
    const rec = truth.captures.find((c) => c.key === `${cap.combo}__${cap.interaction}`);
    // The base capture is always shape-safe; a recorded capture is safe only
    // when it rides the base tree unchanged.
    if (rec && (rec.offBase || rec.fullRoot)) continue;
    shapeSafe.add(cap.combo);
    for (const el of flatten(cap.root)) canonical.set(`${cap.combo} ${el.path}`, el.node);
  }
  const mine = reader(truth);
  for (const combo of shapeSafe) {
    for (const a of truth.anatomy) {
      if (a.inBase === false) continue;
      const node = canonical.get(`${combo} ${byPath.get(a.part)}`);
      if (!node) continue;
      for (const [prop, value] of Object.entries(node.style)) {
        const sites = mine.at(a.part, prop, [combo]).filter((st) => st.computedProp === prop);
        if (sites.length === 0) {
          out.push(`${combo}/${a.part}.${prop}: the canonical reconstruction holds "${value}" and this reader reports NOTHING`);
        } else if (sites[0].value !== normalizeValue(value)) {
          out.push(`${combo}/${a.part}.${prop}: canonical "${value}" vs this reader "${sites[0].value}"`);
        }
      }
    }
  }
  return out;
}
