/**
 * CSS/DOM CONFORMANCE FIXTURE — THE GATE.
 *
 *   npm run conformance                 measure + compare against BASELINE.json
 *   npm run conformance -- --write      re-record BASELINE.json (explicit act)
 *   npm run conformance:report          write EXPECTATIONS.md
 *
 * WHY THIS EXISTS. Every other instrument in this pipeline derives its
 * denominator from the same filter that decides carriage: the fidelity gate
 * scores channels that passed `isFusable`, so a channel the filter never opened
 * is not in the denominator and scores 100%; promotion removes refused parts
 * from scoring, so refusing a part cannot lower a score; the canvas checker
 * verifies a hardcoded channel table. The result is an instrument that cannot
 * be surprised.
 *
 * THE MANIFEST IS THE DENOMINATOR HERE. conformance/MANIFEST.json is
 * hand-authored per case and derived from NOTHING in the engine — not
 * `isFusable`, not `styled`, not DECLARED_CHANNELS, not CHANNEL_TO_COMPUTED,
 * not TOKEN_CHANNELS, not `carriedParts`. A construct that is neither carried
 * nor named-refused is therefore a hard failure rather than an absence.
 *
 * THE FOUR RED CONDITIONS, each with a different remedy:
 *
 *   SILENT-LOSS      observable in captured-truth.json, absent from the
 *                    contract, and named by NO string in the union of
 *                    LEDGER.md, enriched.extension.json (receipt/refusal
 *                    arrays, recursively — mintedTokens EXCLUDED, a channel
 *                    name inside a minted token PATH is not a receipt),
 *                    review-queue.json, source-bindings.json.skips,
 *                    scorecard.json namedLosses, and the run's stdout.
 *                    NEVER waivable. This is the class the fixture exists for.
 *   UNDECLARED-CARRY a case declared REFUSED/UNSUPPORTED that the engine
 *                    actually carried. Good news, wrong manifest — the remedy
 *                    is to UPDATE THE MANIFEST, which is how the capability
 *                    matrix stays true.
 *   WRONG-NAME       named, but not by `expectName`. Catches receipt drift and
 *                    catches two constructs collapsing into one indistinguishable
 *                    message.
 *   UNMEASURED       never appeared in captured-truth.json at all — the reader
 *                    never looked. RED for CARRIED/LOWERED; a COUNTED YELLOW
 *                    for UNSUPPORTED, because "we never read ::marker" and "we
 *                    read it and refused it" are different facts.
 *
 * Plus one measured disposition the four conditions do not cover:
 *
 *   RUN-ABORTED      the production runner THREW on this case and wrote no
 *                    artifacts. The refusal is loud and named — but it is a
 *                    WHOLE-ROUND stop, not a per-construct receipt, so a real
 *                    library carrying the construct cannot be onboarded at all.
 *                    RED, and reported separately.
 *
 * The gate never launches a browser. It reads the artifacts
 * `npm run conformance:capture` wrote.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DISPOSITIONS, exportNameFor, HERE, loadCases, outDirFor, REPO, type CaseEntry, type Disposition } from './build.js';

export const OUT_ROOT = path.join(REPO, 'extract', 'computed', 'out', 'conformance');
export const BASELINE = path.join(HERE, 'BASELINE.json');

export type Verdict =
  | 'PASS'
  | 'SILENT-LOSS'
  | 'UNDECLARED-CARRY'
  | 'WRONG-NAME'
  | 'UNMEASURED'
  | 'UNMEASURED-YELLOW'
  | 'RUN-ABORTED';

export const RED_VERDICTS: readonly Verdict[] = [
  'SILENT-LOSS', 'UNDECLARED-CARRY', 'WRONG-NAME', 'UNMEASURED', 'RUN-ABORTED',
];

export interface Measured {
  id: string;
  feature: string;
  construct: string;
  expect: Disposition;
  expectName: string;
  channel: string;
  /** captured-truth.json: did the READER ever see this channel? */
  measured: boolean;
  /** where it was seen, and with what value(s) */
  observedOn: string[];
  observedValues: string[];
  /** the manifest's PREDICTED captured value, and whether the browser agreed */
  predicted: string;
  predictionHeld: boolean;
  /** enriched.contract.json: is the construct in the contract, with that value? */
  carried: boolean;
  carriedAs: string[];
  /** the naming union */
  namedByExpectName: boolean;
  namedAtAll: boolean;
  namingQuote: string;
  aborted: boolean;
  verdict: Verdict;
  note: string;
  /** An UNDECLARED-CARRY whose manifest entry says the construct has NO canvas
   *  spelling. The doctrine calls UNDECLARED-CARRY "good news, wrong manifest"
   *  — and it usually is. It is NOT, when the thing carried cannot be drawn:
   *  then the carriage is the defect and the manifest was right. The two are
   *  reported separately; only the first is fixed by editing the manifest. */
  harmful: boolean;
  canvas: 'PRESENT' | 'ABSENT';
}

// ---------------------------------------------------------------------------
// value normalisation — enough to compare a browser serialization against a
// contract value or a minted token value, and NO more (a clever normaliser
// would hide exactly the drift this gate exists to see)
// ---------------------------------------------------------------------------
const hex2 = (n: number): string => n.toString(16).padStart(2, '0');

export function normValue(raw: string): string {
  let v = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : Number(rgb[4]);
    const base = `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
    return a >= 1 ? base : `${base}${hex2(Math.round(a * 255))}`;
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{8}$/.test(v) && v.endsWith('ff')) return v.slice(0, 7);
  // trailing-zero px/number noise ("6px" vs "6.0px", "0.20s" vs "0.2s")
  v = v.replace(/(\d+)\.0+(?=\D|$)/g, '$1').replace(/(\.\d*[1-9])0+(?=\D|$)/g, '$1');
  return v;
}

/** A loose containment test: the CONTRACT value counts as carrying the
 *  captured value when they normalise equal, or when the captured value is a
 *  recognisable substring (shorthand-vs-longhand, `matrix(…)`, gradients). */
export const valueAgrees = (contractValue: string, capturedValue: string): boolean => {
  const a = normValue(contractValue);
  const b = normValue(capturedValue);
  return a === b || (b.length > 3 && a.includes(b)) || (a.length > 3 && b.includes(a));
};

// ---------------------------------------------------------------------------
// artifact readers
// ---------------------------------------------------------------------------
const readJson = <T>(p: string): T | null =>
  existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;

interface CapturedNodeLike {
  tag: string;
  classes: string[];
  nodes: Array<{ t: 'text'; v: string } | { t: 'el'; el: CapturedNodeLike }>;
  style: Record<string, string>;
  pseudo: Record<string, Record<string, string>>;
}

/** Every (partName, channel, value) the READER actually recorded — base trees
 *  (full styles), per-capture deltas, and the ::before/::after pseudo maps. */
export function readObservations(outDir: string): Map<string, Map<string, Set<string>>> {
  const truth = readJson<{
    anatomy?: Array<{ part: string; path: string }>;
    base?: { key: string; root: CapturedNodeLike } | Array<{ key: string; root: CapturedNodeLike }>;
    captures?: Array<{ elements?: Array<{ part: string; delta: Record<string, string> }>; pseudo?: Record<string, Record<string, string>> }>;
  }>(path.join(outDir, 'captured-truth.json'));
  const out = new Map<string, Map<string, Set<string>>>();
  if (!truth) return out;
  const add = (part: string, ch: string, v: string): void => {
    const byCh = out.get(ch) ?? out.set(ch, new Map()).get(ch)!;
    (byCh.get(part) ?? byCh.set(part, new Set()).get(part)!).add(v);
  };
  const partByPath = new Map((truth.anatomy ?? []).map((a) => [a.path, a.part]));
  const walk = (n: CapturedNodeLike, p: string): void => {
    const part = partByPath.get(p) ?? `@path:${p || 'root'}`;
    for (const [ch, v] of Object.entries(n.style ?? {})) add(part, ch, v);
    for (const [pe, map] of Object.entries(n.pseudo ?? {})) {
      for (const [ch, v] of Object.entries(map)) add(`${part}${pe}`, ch, v);
    }
    // `__text`: a synthetic channel for the TEXT NODES the reader recorded.
    // It exists because the general form of the SVG <title> defect is not a
    // CSS channel at all — it is "did non-painting text survive into the
    // capture, and from there into the contract as canvas ink".
    for (const c of n.nodes ?? []) if (c.t === 'text' && c.v.trim()) add(part, '__text', c.v.trim());
    n.nodes?.forEach((c, i) => { if (c.t === 'el') walk(c.el, p === '' ? String(i) : `${p}.${i}`); });
  };
  // `base` is a single {key, root} for a one-combo component and an array for
  // a multi-combo one — the fixture is always the former, but the gate must
  // not assume the shape the fixture happens to produce.
  const bases = Array.isArray(truth.base) ? truth.base : truth.base ? [truth.base] : [];
  for (const b of bases) walk(b.root, '');
  for (const c of truth.captures ?? []) {
    for (const e of c.elements ?? []) for (const [ch, v] of Object.entries(e.delta ?? {})) add(e.part, ch, v);
    for (const [pk, map] of Object.entries(c.pseudo ?? {})) for (const [ch, v] of Object.entries(map)) add(pk, ch, v);
  }
  return out;
}

/** Every (part, channel, value) the CONTRACT carries — tokens, declared,
 *  declaredStates, states, literals and layout, at every anatomy depth. Token
 *  refs are resolved against the run's own minted tree + the fixture DTCG. */
export function readCarriage(outDir: string): Map<string, Array<{ part: string; where: string; value: string }>> {
  const contract = readJson<Record<string, unknown>>(path.join(outDir, 'enriched.contract.json'));
  const ext = readJson<{ mintedTokens?: Record<string, unknown> }>(path.join(outDir, 'enriched.extension.json'));
  const dtcg = readJson<Record<string, unknown>>(path.join(REPO, 'conformance', 'tokens', 'conformance.dtcg.json')) ?? {};
  if (!contract) return new Map();
  return carriageOfContract(contract, [ext?.mintedTokens ?? {}, dtcg]);
}

export interface CarriageHit {
  part: string;
  where: string;
  /** The value with token refs RESOLVED through `trees` (first tree wins). */
  value: string;
  /** The value exactly as the contract spells it — a `{ref}` stays a ref. */
  raw: string;
}

/** The same walk as readCarriage, over an in-memory contract — shared with
 *  the canvas round-trip gate (conformance/canvas.ts), which compares a
 *  PROPOSED contract against the captured one on the same channel and must
 *  read both by one rule. `trees` are the DTCG trees token refs resolve
 *  through, in priority order. */
export function carriageOfContract(contract: Record<string, unknown>, trees: Record<string, unknown>[]): Map<string, CarriageHit[]> {
  const out = new Map<string, CarriageHit[]>();

  const resolveRef = (ref: string): string => {
    const m = /^\{(.+)\}$/.exec(ref.trim());
    if (!m) return ref;
    for (const tree of trees) {
      let node: unknown = tree;
      for (const seg of m[1].split('.')) {
        if (!node || typeof node !== 'object') { node = undefined; break; }
        node = (node as Record<string, unknown>)[seg];
      }
      if (node && typeof node === 'object' && '$value' in (node as object)) {
        return String((node as { $value: unknown }).$value);
      }
    }
    return ref;
  };
  const push = (ch: string, part: string, where: string, value: string): void => {
    (out.get(ch) ?? out.set(ch, []).get(ch)!).push({ part, where, value: resolveRef(value), raw: value });
    // REJECTED-SETS ROUND — the border-color SHORTHAND is the proposal's
    // canonical spelling for a uniform four-side stroke (one Figma strokes
    // paint serves all four sides), while the computed observable is a side
    // LONGHAND; the same mirrored-spelling rule the flex/grid facts follow.
    if (ch === 'border-color') {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        (out.get(`border-${side}-color`) ?? out.set(`border-${side}-color`, []).get(`border-${side}-color`)!).push({ part, where: `${where} (border-color shorthand)`, value: resolveRef(value), raw: value });
      }
    }
  };
  const eatMap = (part: string, where: string, m: unknown): void => {
    if (!m || typeof m !== 'object') return;
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') push(k, part, where, String(v));
      else if (v && typeof v === 'object') {
        // states / declaredStates: one nesting level keyed by state name
        for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
          if (typeof v2 === 'string' || typeof v2 === 'number') push(k2, part, `${where}.${k}`, String(v2));
        }
      }
    }
  };
  // A2 LAYOUT PROMOTION — the contract's STRUCTURED grid facts (layout.rows/
  // columns/gap/areas/flow, Part.placement), serialized into their pinned G6
  // CSS spellings so carriage is measurable value-for-value against the
  // browser's own channels. The spellings are MIRRORED here (px / fr /
  // fit-content(100%); 1-based grid-row/column lines with span-1 unspelled;
  // the areas matrix with `.` holes), never imported from the emitters — the
  // gate stays independent of the engine, the same rule as `outDirFor`.
  const gridTrack = (t: unknown): string => {
    if (t && typeof t === 'object') {
      const o = t as Record<string, unknown>;
      if (typeof o.px === 'number') return `${o.px}px`;
      if (typeof o.fr === 'number') return `${o.fr}fr`;
      if (o.fit === true) return 'fit-content(100%)';
    }
    return String(t);
  };
  const eatGrid = (name: string, part: Record<string, unknown>): void => {
    const lay = part.layout as Record<string, unknown> | null | undefined;
    if (lay && typeof lay === 'object') {
      if (Array.isArray(lay.rows)) push('grid-template-rows', name, 'layout.rows', (lay.rows as unknown[]).map(gridTrack).join(' '));
      if (Array.isArray(lay.columns)) push('grid-template-columns', name, 'layout.columns', (lay.columns as unknown[]).map(gridTrack).join(' '));
      const gap = lay.gap as Record<string, unknown> | null | undefined;
      if (gap && typeof gap === 'object') {
        for (const [axis, ch] of [['row', 'row-gap'], ['column', 'column-gap']] as const) {
          const v = gap[axis];
          if (typeof v === 'number') push(ch, name, `layout.gap.${axis}`, `${v}px`);
          else if (typeof v === 'string') push(ch, name, `layout.gap.${axis}`, v); // token refs resolve in push
        }
      }
      if (typeof lay.flow === 'string') push('grid-auto-flow', name, 'layout.flow', lay.flow);
      const areas = lay.areas as Record<string, { row: number; column: number; rowSpan?: number; columnSpan?: number }> | null | undefined;
      if (areas && typeof areas === 'object' && !Array.isArray(areas)) {
        const rects = Object.values(areas);
        const rc = Array.isArray(lay.rows) ? (lay.rows as unknown[]).length : Math.max(0, ...rects.map((a) => a.row + (a.rowSpan ?? 1)));
        const cc = Array.isArray(lay.columns) ? (lay.columns as unknown[]).length : Math.max(0, ...rects.map((a) => a.column + (a.columnSpan ?? 1)));
        if (rc > 0 && cc > 0) {
          const m = Array.from({ length: rc }, () => Array.from({ length: cc }, () => '.'));
          for (const [areaName, a] of Object.entries(areas)) {
            for (let r = a.row; r < Math.min(a.row + (a.rowSpan ?? 1), rc); r++) {
              for (let col = a.column; col < Math.min(a.column + (a.columnSpan ?? 1), cc); col++) m[r][col] = areaName;
            }
          }
          push('grid-template-areas', name, 'layout.areas', m.map((row) => `"${row.join(' ')}"`).join(' '));
        }
      }
    }
    const pl = part.placement as Record<string, unknown> | null | undefined;
    if (pl && typeof pl === 'object') {
      if (typeof pl.row === 'number') push('grid-row-start', name, 'placement.row', String(pl.row + 1));
      if (typeof pl.column === 'number') push('grid-column-start', name, 'placement.column', String(pl.column + 1));
      if (typeof pl.rowSpan === 'number' && pl.rowSpan > 1) push('grid-row-end', name, 'placement.rowSpan', `span ${pl.rowSpan}`);
      if (typeof pl.columnSpan === 'number' && pl.columnSpan > 1) push('grid-column-end', name, 'placement.columnSpan', `span ${pl.columnSpan}`);
      if (typeof pl.alignX === 'string') push('justify-self', name, 'placement.alignX', pl.alignX);
      if (typeof pl.alignY === 'string') push('align-self', name, 'placement.alignY', pl.alignY);
    }
  };
  const walkPart = (name: string, part: Record<string, unknown>): void => {
    eatMap(name, 'tokens', part.tokens);
    eatMap(name, 'declared', part.declared);
    eatMap(name, 'declaredStates', part.declaredStates);
    eatMap(name, 'states', part.states);
    eatMap(name, 'literals', part.literals);
    eatMap(name, 'layout', part.layout);
    // REJECTED-SETS ROUND — tokensByProp / stylesWhen carriage: a channel
    // whose value rides a per-axis map (or a conditional styles block) is
    // carried vocabulary exactly like a base token; the walk read neither,
    // so an axis-conditioned carriage was invisible to the gate.
    {
      const tbp = part.tokensByProp as unknown;
      const entries = Array.isArray(tbp) ? tbp : tbp ? [tbp] : [];
      for (const e of entries as Array<{ prop?: string; map?: Record<string, Record<string, unknown>> }>) {
        if (!e || typeof e !== 'object' || !e.map) continue;
        for (const [axisValue, chans] of Object.entries(e.map)) {
          if (chans && typeof chans === 'object') {
            for (const [chk, chv] of Object.entries(chans)) {
              if (typeof chv === 'string' || typeof chv === 'number') push(chk, name, `tokensByProp.${String(e.prop)}=${axisValue}`, String(chv));
            }
          }
        }
      }
      const sw = part.stylesWhen as unknown;
      if (Array.isArray(sw)) {
        for (const w of sw as Array<{ prop?: string; equals?: unknown; styles?: Record<string, unknown> }>) {
          for (const [chk, chv] of Object.entries(w?.styles ?? {})) {
            if (typeof chv === 'string' || typeof chv === 'number') push(chk, name, `stylesWhen.${String(w.prop)}=${String(w.equals)}`, String(chv));
          }
        }
      }
    }
    // REJECTED-SETS ROUND — the FLEX layout fields, serialized into their
    // browser channel spellings so carriage is measurable against the
    // computed channels the reader records (the same mirrored-spelling rule
    // eatGrid follows for the grid facts; mirrored, never imported).
    {
      const lay = part.layout as Record<string, unknown> | null | undefined;
      const FLEX_FIELD_TO_CHANNEL: Record<string, string> = {
        direction: 'flex-direction',
        align: 'align-items',
        justify: 'justify-content',
      };
      const pushLayoutFields = (m: unknown, where: string): void => {
        if (!m || typeof m !== 'object') return;
        for (const [f, ch] of Object.entries(FLEX_FIELD_TO_CHANNEL)) {
          const v = (m as Record<string, unknown>)[f];
          if (typeof v === 'string') push(ch, name, where, v);
        }
      };
      pushLayoutFields(lay, 'layout');
      const lbp = part.layoutByProp as { prop?: string; map?: Record<string, unknown> } | null | undefined;
      if (lbp && typeof lbp === 'object' && lbp.map && typeof lbp.map === 'object') {
        for (const [axisValue, over] of Object.entries(lbp.map)) {
          pushLayoutFields(over, `layoutByProp.${String(lbp.prop)}=${axisValue}`);
        }
      }
    }
    eatGrid(name, part);
    if (typeof part.text === 'string') push('__text', name, 'text', part.text);
    if (typeof part.element === 'string') push('__element', name, 'element', part.element);
    for (const [n, p] of Object.entries((part.parts ?? {}) as Record<string, Record<string, unknown>>)) walkPart(n, p);
  };
  const anatomy = (contract.anatomy ?? {}) as Record<string, Record<string, unknown>>;
  for (const [n, p] of Object.entries(anatomy)) walkPart(n, p);
  return out;
}

/** THE NAMING UNION. Six sources, each named. `mintedTokens` is deliberately
 *  EXCLUDED from the extension block: a channel name that appears only inside
 *  a minted token PATH (`imported.x.root.grid-auto-rows`) is carriage bookkeeping,
 *  not a receipt, and counting it would let the union launder a silent loss. */
/** IDENTITY TOKENS — compound strings that name THIS CASE and nothing else
 *  (the export name, the output directory, the contract id). They are removed
 *  from the union before it is searched, because the engine echoing a
 *  component's own name back is not a receipt: with a case id like
 *  `filter-blur`, `== CaseFilterBlur` would otherwise satisfy a search for
 *  "filter" and launder a silent loss into a PASS. This is the ONLY editing of
 *  the union, and it can never remove a genuine mention: no engine receipt
 *  about a CSS channel contains the substring "CaseFilterBlur". (The other
 *  half of the same problem — the class name reaching the anatomy signature —
 *  is closed in the FIXTURE instead: every case class is neutral, `cf-root` /
 *  `cf-a` / `cf-b`, and cases are scoped by a data attribute.) */
export const identityTokens = (id: string, exportName: string): string[] => [
  exportName, exportName.toLowerCase(), `conformance.${id}`,
  `conformance/seeds/${id}.contract.json`, `conformance/cases/${id}`,
];

export function namingUnion(outDir: string, log: string): string {
  const parts: string[] = [log];
  // Quarantined components intentionally have no enriched contract/ledger.
  // Their refusal survives as these two committed artifacts; excluding them
  // made clean CI report silent loss while a developer tree passed only
  // because an ignored capture log happened to name the channel.
  const refusalMd = path.join(outDir, 'REFUSAL.md');
  if (existsSync(refusalMd)) parts.push(readFileSync(refusalMd, 'utf8'));
  const refusalJson = readJson<unknown>(path.join(outDir, 'refusal.json'));
  if (refusalJson) parts.push(JSON.stringify(refusalJson));
  const ledger = path.join(outDir, 'LEDGER.md');
  if (existsSync(ledger)) parts.push(readFileSync(ledger, 'utf8'));
  const ext = readJson<Record<string, unknown>>(path.join(outDir, 'enriched.extension.json'));
  if (ext) {
    const { mintedTokens: _drop, ...rest } = ext;
    parts.push(JSON.stringify(rest));
  }
  const rq = readJson<unknown>(path.join(outDir, 'review-queue.json'));
  if (rq) parts.push(JSON.stringify(rq));
  const sb = readJson<{ skips?: unknown }>(path.join(outDir, 'source-bindings.json'));
  if (sb?.skips) parts.push(JSON.stringify(sb.skips));
  const sc = readJson<{ namedLosses?: unknown; topMismatchedChannels?: unknown; unresolvedTokenRefs?: unknown }>(
    path.join(outDir, 'scorecard.json'),
  );
  if (sc) parts.push(JSON.stringify({ namedLosses: sc.namedLosses, topMismatchedChannels: sc.topMismatchedChannels, unresolvedTokenRefs: sc.unresolvedTokenRefs }));
  return parts.join('\n');
}

const quoteAround = (hay: string, needle: string): string => {
  const i = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return '';
  return hay.slice(Math.max(0, i - 120), i + 200).replace(/\s+/g, ' ').trim();
};

// ---------------------------------------------------------------------------
// measurement
// ---------------------------------------------------------------------------
export function measure(c: CaseEntry): Measured {
  const outDir = path.join(OUT_ROOT, outDirFor(c.id));
  const logPath = path.join(OUT_ROOT, '_logs', `${c.id}.log`);
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const aborted = !existsSync(path.join(outDir, 'captured-truth.json'));
  const ch = c.observable.channel;
  const predicted = c.observable.capturedValue ?? '';

  const obs = readObservations(outDir);
  const byPart = obs.get(ch) ?? new Map<string, Set<string>>();

  // MEASUREMENT IS VALUE-SCOPED, not channel-scoped. `background-color` exists
  // on every element in every case; the CONSTRUCT is the channel carrying THIS
  // value. Scoping by value is also what makes the gate independent of the
  // engine's part NAMES, which are themselves a promotion output.
  const seenAnywhere = [...byPart.entries()].flatMap(([part, vs]) => [...vs].map((v) => ({ part, v })));
  const hitsObs = predicted === '' ? seenAnywhere : seenAnywhere.filter((o) => valueAgrees(o.v, predicted));
  const observedOn = [...new Set(hitsObs.map((o) => o.part))].sort();
  const observedValues = [...new Set(seenAnywhere.map((o) => o.v))].sort();
  const measured = hitsObs.length > 0;
  const predictionHeld = measured;

  const target = c.observable.carriedValue ?? predicted;
  const carriage = readCarriage(outDir).get(ch) ?? [];
  const hits = target === '' ? carriage : carriage.filter((h) => valueAgrees(h.value, target));
  const carried = hits.length > 0;
  const carriedAs = hits.map((h) => `${h.part}.${h.where} = ${h.value}`).sort();

  let union = namingUnion(outDir, log);
  for (const t of identityTokens(c.id, exportNameFor(c.id))) union = union.split(t).join('«self»');
  const namedByExpectName = !!c.expectName && union.toLowerCase().includes(c.expectName.toLowerCase());
  const namedAtAll = union.toLowerCase().includes(ch.toLowerCase());
  const namingQuote = quoteAround(union, c.expectName || ch);

  let verdict: Verdict;
  let note = '';
  if (aborted) {
    verdict = 'RUN-ABORTED';
    note = (/- (conformance\.[^\n]+)/.exec(log)?.[1] ?? 'the runner threw before writing artifacts').trim();
  } else if (c.expect === 'CARRIED' || c.expect === 'LOWERED') {
    if (!measured) { verdict = 'UNMEASURED'; note = `declared ${c.expect} but the reader never recorded "${ch}"`; }
    else if (carried && (c.expect === 'CARRIED' || namedByExpectName)) verdict = 'PASS';
    else if (carried && !namedAtAll) {
      // A LOWERED case whose VALUE survived but whose NAME did not, with
      // nothing anywhere referring to the construct, is a silent loss of the
      // name. The pixel being right is exactly what makes it dangerous.
      verdict = 'SILENT-LOSS';
      note = `the value is carried but the NAME is lowered away, and no artifact refers to "${ch}" at all — the receipt asserts completeness over a loss it just took`;
    }
    else if (carried) { verdict = 'WRONG-NAME'; note = `carried, but the declared lowering receipt "${c.expectName}" is in no artifact — the loss IS named, by a message that does not distinguish this construct from any other`; }
    else if (namedAtAll) { verdict = 'WRONG-NAME'; note = `declared ${c.expect} but NOT carried; the engine names "${ch}" somewhere — the manifest and the engine disagree about the disposition`; }
    else { verdict = 'SILENT-LOSS'; note = `declared ${c.expect}; observed but neither carried nor named anywhere`; }
  } else {
    // REFUSED / UNSUPPORTED
    if (carried) { verdict = 'UNDECLARED-CARRY'; note = `declared ${c.expect} but the engine CARRIED it — update the manifest`; }
    else if (namedByExpectName) verdict = 'PASS';
    else if (!measured && c.expect === 'UNSUPPORTED') { verdict = 'UNMEASURED-YELLOW'; note = `the reader never looked at "${ch}" — "never read" and "read and refused" are different facts`; }
    else if (!measured) { verdict = 'UNMEASURED'; note = `declared REFUSED by name, but "${ch}" never reached captured-truth.json — the refusal claim is unfounded`; }
    else if (namedAtAll) { verdict = 'WRONG-NAME'; note = `named, but not by "${c.expectName}"`; }
    else { verdict = 'SILENT-LOSS'; note = `observed in captured-truth.json, absent from the contract, named by NOTHING`; }
  }

  return {
    id: c.id, feature: c.feature, construct: c.construct, expect: c.expect, expectName: c.expectName,
    channel: ch, measured, observedOn, observedValues, predicted, predictionHeld,
    carried, carriedAs, namedByExpectName, namedAtAll, namingQuote, aborted, verdict, note,
    harmful: verdict === 'UNDECLARED-CARRY' && c.canvas.expect === 'ABSENT',
    canvas: c.canvas.expect,
  };
}

export function measureAll(): Measured[] {
  return loadCases().map(measure);
}

// ---------------------------------------------------------------------------
// the ratchet
// ---------------------------------------------------------------------------
export interface BaselineFile {
  _marker: string;
  measuredAt: string;
  counts: Record<string, number>;
  unsupportedDeclared: number;
  /** id → verdict. A finding that DISAPPEARS is drift too: a fixed defect must
   *  be recorded, never silently absorbed (the two-sided ratchet this repo
   *  already uses for child-wider). */
  verdicts: Record<string, Verdict>;
}

export function summarize(rows: Measured[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of ['PASS', ...RED_VERDICTS, 'UNMEASURED-YELLOW']) counts[v] = 0;
  for (const r of rows) counts[r.verdict]++;
  return counts;
}

export function compareToBaseline(rows: Measured[]): string[] {
  const base = readJson<BaselineFile>(BASELINE);
  if (!base) return ['no BASELINE.json — run `npm run conformance -- --write` to record the first measured frontier'];
  const drift: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(r.id);
    const was = base.verdicts[r.id];
    if (was === undefined) drift.push(`NEW CASE ${r.id}: ${r.verdict} — the manifest grew; re-record the baseline deliberately`);
    else if (was !== r.verdict) {
      drift.push(
        was === 'PASS'
          ? `REGRESSION ${r.id}: PASS → ${r.verdict} (${r.note})`
          : r.verdict === 'PASS'
            ? `IMPROVED ${r.id}: ${was} → PASS — record it (a fixed defect must never be absorbed silently)`
            : `RECLASSIFIED ${r.id}: ${was} → ${r.verdict} (${r.note})`,
      );
    }
  }
  for (const id of Object.keys(base.verdicts)) if (!seen.has(id)) drift.push(`REMOVED ${id}: the baseline names a case the manifest no longer has`);
  const declared = rows.filter((r) => r.expect === 'UNSUPPORTED').length;
  if (declared > base.unsupportedDeclared) {
    drift.push(
      `UNSUPPORTED RATCHET: ${base.unsupportedDeclared} → ${declared}. The committed count may only DECREASE without an explicit manifest edit — a construct moving INTO "never modelled" is a widening of the hole, and has to be argued for, not defaulted into.`,
    );
  }
  return drift;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(HERE, 'run.ts')) {
  const rows = measureAll();
  const counts = summarize(rows);
  const write = process.argv.includes('--write');

  const order: Verdict[] = ['SILENT-LOSS', 'RUN-ABORTED', 'UNDECLARED-CARRY', 'WRONG-NAME', 'UNMEASURED', 'UNMEASURED-YELLOW', 'PASS'];
  for (const v of order) {
    for (const harmful of v === 'UNDECLARED-CARRY' ? [true, false] : [false]) {
      const group = rows.filter((r) => r.verdict === v && (v !== 'UNDECLARED-CARRY' || r.harmful === harmful));
      if (group.length === 0) continue;
      console.log(`\n${v}${v === 'UNDECLARED-CARRY' ? (harmful ? ' (HARMFUL — the construct has NO canvas spelling; the carriage IS the defect)' : ' (the manifest was wrong; update it)') : ''} — ${group.length}`);
      for (const r of group) {
        console.log(`  ${r.id.padEnd(38)} ${r.channel.padEnd(26)} ${r.expect.padEnd(12)} ${r.note}`);
      }
    }
  }
  console.log(
    `\nconformance: ${rows.length} cases · ${counts.PASS} pass · ${RED_VERDICTS.reduce((n, v) => n + counts[v], 0)} red · ${counts['UNMEASURED-YELLOW']} yellow (unmeasured UNSUPPORTED)`,
  );

  if (write) {
    const file: BaselineFile = {
      _marker:
        'THE MEASURED FRONTIER — the committed result of the CSS/DOM conformance fixture. Every non-PASS entry is an OPEN DEFECT that has been measured and named, not an accepted one. The gate refuses any drift in EITHER direction: a new red is a regression, and a red that becomes PASS must be re-recorded here, so a fix can never be absorbed silently.',
      measuredAt: 'extract/computed/out/conformance (npm run conformance:capture)',
      counts,
      unsupportedDeclared: rows.filter((r) => r.expect === 'UNSUPPORTED').length,
      verdicts: Object.fromEntries(rows.map((r) => [r.id, r.verdict])),
    };
    writeFileSync(BASELINE, JSON.stringify(file, null, 2) + '\n');
    console.log(`\nBASELINE.json written (${Object.keys(file.verdicts).length} cases). This is an EXPLICIT act — review the diff.`);
    process.exit(0);
  }

  const drift = compareToBaseline(rows);
  if (drift.length) {
    console.log(`\n✖ CONFORMANCE DRIFT — ${drift.length}`);
    for (const d of drift) console.log(`  - ${d}`);
    process.exit(1);
  }
  console.log('✔ no drift against conformance/BASELINE.json');
  const dist = DISPOSITIONS.map((d) => `${d} ${rows.filter((r) => r.expect === d).length}`).join(' · ');
  console.log(`  declared: ${dist}`);
}
