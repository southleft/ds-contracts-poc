/**
 * PROVISIONAL TOKEN MINTING — the fallback for imports whose variable NAMES
 * are unrecoverable (the Figma variables endpoint is Enterprise-only, so a
 * REST import usually degrades every bound fact to its resolved literal).
 *
 * Without minting, those literals surface as UNBOUND report entries and the
 * proposal carries no style bindings at all — a naked preview. With minting
 * (proposeFromDump's `mintUnbound: true`), every observed literal becomes a
 * leaf in a provisional DTCG tree and the proposal binds to it, so styles
 * survive at LITERAL fidelity. Names are mechanical and obviously
 * provisional — semantics are NEVER guessed:
 *
 *   NAMING     by usage site: `imported.<component>.<part>.<css-property>`
 *              (e.g. imported.tooltip.body.background-color → { $value:
 *              '#1f2937', $type: 'color' }). <part> is the sanitized anatomy
 *              path below the root joined with '-' ('root' for the root).
 *
 *   DEDUPE     an identical literal used at ≥ MINT_SHARE_THRESHOLD usage
 *              sites collapses into ONE shared leaf —
 *              `imported.shared.color-1f2937` / `imported.shared.size-4` —
 *              and every site binds it directly (no per-usage aliases; the
 *              rename pass decides the real vocabulary).
 *
 *   VARIANTS   when the same site resolves DIFFERENT values across variants
 *              and the difference is a function of exactly one enum axis
 *              (every axis value covered, one value per axis value), a leaf
 *              is minted per axis value —
 *              `imported.<component>.<part>.<css-property>.<axisValue>` —
 *              and the binding is the substituted ref
 *              `{imported.<component>.<part>.<css-property>.{<axisProp>}}`
 *              (the existing enum-substitution machinery renders it). When no
 *              single axis fits but a PAIR of enum axes does (field case:
 *              Eventz Button background = f(variant, state); every value
 *              combination covered, one value per combination), a leaf is
 *              minted per combination —
 *              `….<css-property>.<axisAValue>.<axisBValue>` — and the binding
 *              substitutes both axes:
 *              `{….<css-property>.{<axisA>}.{<axisB>}}` (root tokens only in
 *              the emitters). When no pair fits but a TRIPLE of enum axes
 *              does (live-gauntlet class ① field case: CBDS Chip's root fill
 *              = f(type, style, state)), a leaf is minted per combination and
 *              the binding substitutes all three axes (root tokens only;
 *              three placeholders max). A difference that does NOT correlate
 *              with an axis, pair, or triple mints nothing: the binding
 *              stays null with a named reason.
 *
 *   UNITS      colors are '#rrggbb' — or 8-digit '#rrggbbaa' when the paint
 *              carried alpha (dump v1.1; a legal DTCG color $value AND a CSS
 *              color, see core/propose-figma.ts paintCssHex) — ($type color);
 *              numbers from px-like canvas fields (padding / radius /
 *              spacing / size / fontSize) are '<n>px' ($type dimension);
 *              UNITLESS numbers (node opacity, dump v1.2) are '<n>'
 *              ($type number — a Figma FLOAT variable and a CSS opacity
 *              value in one spelling).
 *
 * Pure module (no node:* imports) — part of the browser-importable core.
 */
import { aliasTarget, flattenTokens } from './tokens.js';

/** Every minted path lives under this namespace — the receipt's invariant
 *  that no minted name can be mistaken for a semantic token. */
export const MINT_NAMESPACE = 'imported';

/** A literal repeated at this many usage sites dedupes into a shared leaf. */
export const MINT_SHARE_THRESHOLD = 3;

export interface MintOccurrence {
  /** Figma variant name ("Variant=Info", "Tone=Neutral, Size=Sm"). */
  variant: string;
  /** axis propName → canonical (camelCase) value for this variant. Enum
   *  axes always; two-value True/False (boolean-prop) axes ride along as
   *  'true'/'false' and condition ROOT observations only (MintAxis.bool). */
  axisValues: Record<string, string>;
  value: string | number;
  /** Per-variant text-style identity when styles DIFFER across the axis
   *  (Avatar Size=xs → "Text xs/Medium", Size=2xl → "Display xs/Medium").
   *  Obs-level styleName stays for the uniform-style / imported.text.* path;
   *  this field carries identity onto each axis leaf so emit can recreate
   *  the exact Figma style name (or refuse by name) instead of sanitizing
   *  it away. */
  styleName?: string;
  styleKey?: string;
}

export interface MintObservation {
  /** propose-figma note path ("Tooltip:root/body"). */
  nodePath: string;
  /** RAW anatomy path below the root, '/'-joined ('' for the root itself).
   *  Sanitized here into the usage-site path segment. */
  part: string;
  /** Contract token key ("background-color", "padding-inline", …). */
  cssProperty: string;
  /** 'color' → '#rrggbb' / $type color; 'px' → '<n>px' / $type dimension;
   *  'number' → unitless '<n>' / $type number (node opacity, dump v1.2);
   *  'shadow' → a preformatted CSS box-shadow value / $type shadow (a full
   *  shadow stack incl. inset layers and 'none' since v15 — literal-fidelity
   *  stand-in; the canvas emitter parses the stack into native effects);
   *  'gradient' → a CSS background-image value or 'none' (v15/S4 — CSS
   *  surfaces render it verbatim, the canvas emitter parses linear-gradient
   *  stops into a native GRADIENT_LINEAR paint; dump v1.9 image-fill assets
   *  ride this channel as url('./assets/images/<hash>.png') refs — the
   *  canvas emitter ledgers those as gradientMiss BY NAME, never a throw). */
  kind: 'color' | 'px' | 'number' | 'shadow' | 'gradient' | 'size';
  /** v17 — the Figma TEXT STYLE this observation's node rides, when the style
   *  is NOT token-derived (the designer named a style but bound no variable to
   *  its typography). A text style is a design-system vocabulary word exactly
   *  like a variable name, and it is SHARED ACROSS COMPONENTS: Eventz draws
   *  `body/sm` on 52 nodes in five different sets. Minted under the usual
   *  `<component>.<part>` path that one style became FIVE unrelated token
   *  families (atoms-button.label.font-size, atoms-tag.label.font-size, …),
   *  each a machine path carrying none of the designer's vocabulary. An
   *  observation carrying a styleName mints under a COMPONENT-INDEPENDENT
   *  `imported.text.<style>` group instead, so every part riding the style
   *  binds the same leaf and the name is the designer's own. */
  styleName?: string;
  /** Published key when the source style has one. */
  styleKey?: string;
  /** One entry per variant the node occurs in. */
  occurrences: MintOccurrence[];
  /** OPT-IN sparse-coverage fill for PRESENCE-shaped channels (canvas→code
   *  round 2 iteration 5 — the `imageFill` placeholder): the vacuous value
   *  ('none' for background-image) an UNOBSERVED axis combination fills
   *  with when per-variant classification otherwise fits. Undrawn
   *  combinations draw NOTHING extra — the fill never fabricates ink, it
   *  only closes the dangling-ref hole full-coverage protects against
   *  (field case: Untitled UI Avatar's photo = f(placeholder=false,
   *  text=false); the placeholder=true×text=true combination is never
   *  drawn). Absent (every existing caller) — coverage rules unchanged. */
  sparse?: string;
}

export interface MintAxis {
  /** Canonical enum prop name ("placement"). */
  propName: string;
  /** Canonical (camelCase) values, in axis order — substitution expands over
   *  ALL of them, so a per-variant mint must cover every one. */
  values: string[];
  /** A two-value True/False axis minted as a BOOLEAN prop (values
   *  ['true','false']). Participates in classification for ROOT
   *  observations only — the emitters spell bool sides as root
   *  data-attribute selectors (`[data-x]` / `:not([data-x])`), a spelling
   *  nested parts do not have. */
  bool?: boolean;
}

export interface MintedEntry {
  /** Brace-wrapped ref of the minted LEAF, e.g.
   *  "{imported.tooltip.body.background-color}". */
  ref: string;
  /** The leaf's literal $value ("#1f2937", "8px"). */
  value: string;
  /** "nodePath cssProperty" per binding site (plus the axis value when the
   *  leaf is per-variant) — a shared leaf lists every site that binds it. */
  usageSites: string[];
  /** Exact design-side text-style identity carried into DTCG extensions. */
  textStyle?: { name: string; key?: string };
}

export interface MintedBinding {
  nodePath: string;
  cssProperty: string;
  /** The ref to bind — a leaf ref or an axis-substituted ref; null when the
   *  values do not correlate with any enum axis (nothing minted). */
  ref: string | null;
  /** Review-note text when ref is null. */
  reason?: string;
  /** Review-note text on a binding that IS carried but whose evidence is
   *  weaker than the ref's shape implies — today: a SATURATED axis pair,
   *  where every cell holds at most one observation so the correlation is
   *  unwitnessed. The values are all measured, so they are carried; the
   *  caveat says the PAIR may be drift rather than intent. Distinct from
   *  `reason` on purpose: this binding is bound, not refused. */
  caveat?: string;
}

export interface MintResult {
  /** The provisional DTCG tree (rooted at `imported`). */
  tree: Record<string, unknown>;
  /** Number of minted leaves. */
  count: number;
  entries: MintedEntry[];
  /** Aligned by index with the observations passed in. */
  bindings: MintedBinding[];
}

// ---------------------------------------------------------------------------
// Mechanical spellings
// ---------------------------------------------------------------------------

/** One token-path segment: lowercase, [a-z0-9-] only, never empty. */
const sanitizeSegment = (s: string): string => {
  const seg = s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return seg.length > 0 ? seg : 'part';
};

/** Anatomy path below the root ('a/b') → usage-site segment ('a-b');
 *  the root itself ('') → 'root'. */
const partSegment = (rawPath: string): string => {
  const segs = rawPath.split('/').filter((s) => s.length > 0).map(sanitizeSegment);
  return segs.length > 0 ? segs.join('-') : 'root';
};

type MintKind = MintObservation['kind'];

const formatValue = (kind: MintKind, value: string | number): string =>
  kind === 'color'
    ? `#${String(value).replace(/^#/, '').toLowerCase()}`
    : kind === 'px'
      ? `${value}px`
      : // GAP-CLOSING ROUND 6 — 'size' is 'px' that may also carry a SIZING
        // KEYWORD. A Figma axis is FIXED (a number) or HUG (content-sized);
        // one channel can be both across variants (UUI Tooltip: width FIXED
        // where Supporting text=True, HUG where False), so the observation
        // stream is mixed and a numeric-only formatter would spell the
        // keyword '<kw>px'. Numbers format exactly like 'px'.
        kind === 'size' && typeof value === 'number'
        ? `${value}px`
        : String(value);

/** DTCG $type for a claimed leaf — a FUNCTION of the value, not only the
 *  kind: a 'size' leaf holding a number is a dimension, one holding a sizing
 *  keyword (`fit-content`) is not a DTCG type at all, and the repo's
 *  standing rule (core/wrap-plain-tokens.ts) is that an unnameable shape gets
 *  NO invented `$type` rather than a wrong one. */
const dtcgType = (kind: MintKind, value: string | number): string | undefined =>
  kind === 'size' ? (typeof value === 'number' ? 'dimension' : undefined) : DTCG_TYPE[kind];

const DTCG_TYPE: Record<Exclude<MintKind, 'size'>, string> = {
  color: 'color',
  px: 'dimension',
  number: 'number',
  shadow: 'shadow',
  gradient: 'gradient',
};

/** Shared-leaf name for a deduped literal: color-1f2937 / size-4 / size-0-5 /
 *  num-0-4. */
const sharedName = (kind: MintKind, value: string | number): string =>
  kind === 'color'
    ? `color-${String(value).replace(/^#/, '').toLowerCase()}`
    : kind === 'shadow' || kind === 'gradient'
      ? `${kind}-${sanitizeSegment(String(value))}`
      : `${kind === 'number' ? 'num' : 'size'}-${String(value).replace(/^-/, 'neg-').replace(/\./g, '-')}`;

// ---------------------------------------------------------------------------
// Classification: uniform / axis-correlated / uncorrelated
// ---------------------------------------------------------------------------

type Classified =
  | { kind: 'uniform'; value: string | number }
  | { kind: 'variant'; axis: MintAxis; byValue: Map<string, string | number> }
  | {
      kind: 'variant2';
      axes: [MintAxis, MintAxis];
      byValue: Map<string, string | number>;
      unwitnessed?: boolean;
      /** Cells the VARIANT SET never realizes, filled from the base observation
       *  so the pair can carry at all (see the ragged-matrix branch below).
       *  Named on the binding — never silent. */
      undrawn?: string[];
    }
  | { kind: 'variant3'; axes: [MintAxis, MintAxis, MintAxis]; byValue: Map<string, string | number> }
  | { kind: 'none'; reason: string };

/** Key for a multi-axis value combination — '.'-joined because the leaf path
 *  appends it verbatim ('primary.hover' under the group base). */
const pairKey = (a: string, b: string) => `${a}.${b}`;
const comboKey = (values: string[]) => values.join('.');

function classify(
  obs: MintObservation,
  allAxes: MintAxis[],
  nestedPairs: boolean,
  /** Every axis-value combination the component's variant set ACTUALLY
   *  realizes. Absent → the ragged-matrix branch stays off and full cartesian
   *  coverage is required, exactly as before. */
  realizedCombos?: Array<Record<string, string>>,
): Classified {
  if (obs.occurrences.length === 0) return { kind: 'none', reason: 'no occurrences observed — nothing minted' };
  const values = obs.occurrences.map((o) => o.value);
  if (values.every((v) => v === values[0])) return { kind: 'uniform', value: values[0] };
  // Bool conditioning is ROOT-ONLY (data-attribute selectors live on the
  // root element; nested parts and state-plane observations keep the
  // enum-only vocabulary — their refusals stay named).
  const axes = obs.part === '' ? allAxes : allAxes.filter((a) => !a.bool);
  for (const axis of axes) {
    const byValue = new Map<string, string | number>();
    let fits = true;
    for (const o of obs.occurrences) {
      const axisValue = o.axisValues[axis.propName];
      if (axisValue === undefined) { fits = false; break; }
      const seen = byValue.get(axisValue);
      if (seen !== undefined && seen !== o.value) { fits = false; break; }
      byValue.set(axisValue, o.value);
    }
    // Substituted refs expand over EVERY enum value in the emitters, so a
    // per-variant mint must supply a leaf for each — partial coverage would
    // fabricate a dangling reference. `sparse` observations (presence-shaped
    // channels) fill unobserved values with their declared vacuous value
    // instead — never inventing ink, only closing the dangling-ref hole.
    if (fits) {
      const missing = axis.values.filter((v) => !byValue.has(v));
      if (missing.length === 0) return { kind: 'variant', axis, byValue };
      if (obs.sparse !== undefined && missing.length < axis.values.length) {
        for (const v of missing) byValue.set(v, obs.sparse);
        return { kind: 'variant', axis, byValue };
      }
    }
  }
  // Two-axis correlation. Axis order = discovery order, deterministic; every
  // combination of the two axes' values must be observed with a single value.
  //
  // ROOT parts carry the pair as ONE two-placeholder ref (the emitters render
  // it as compound enum classes). NESTED parts carry it as a per-value
  // tokensByProp map on one axis whose refs keep the OTHER axis's
  // placeholder — the already-reviewed S2 capability lift (validateContract:
  // "a per-value map ref may carry AT MOST ONE placeholder naming a DIFFERENT
  // declared enum prop"), which the pair-with-unset branch of
  // applyMintToContract has used since the computed-capture floor.
  //
  // STATE-PLANE PROJECTION round: this classifier used to refuse EVERY
  // nested two-axis value outright. That refusal was invisible while
  // prop-selected renderings hid inside the state-suffix channel (MUI
  // Switch's checked track color was f(color, checked) smuggled through
  // `background-color-state-checked`); reclassifying `checked` to a real
  // axis surfaced it — and would have DROPPED the unchecked track colour the
  // canvas used to draw. The pair fit itself was always sound; only the
  // carriage was missing, and it already existed one layer down.
  //
  // OPT-IN, and deliberately so: a nested pair is returned ONLY to a caller
  // that declares `nestedPairs` — i.e. one whose binding placer can spell a
  // per-value map. `extract/computed`'s `applyMintToContract` can; the
  // DESIGN path (`core/propose-figma.ts`) binds `part.tokens` directly and
  // would emit a two-placeholder ref onto a nested part, which the referee
  // refuses by name. Handing a consumer a ref it cannot carry IS the bug
  // this round is about, so the classifier never offers one.
  //
  // GAP-CLOSING ROUND 10 — the design path now DOES declare it, because the
  // referee stopped refusing: a nested two-placeholder ref emits as the
  // compound ancestor selector `.social-facebook.theme-color .Text`, the
  // same expansion the root's own pair already took. The flag stays, and
  // stays honest — a caller that still cannot spell a pair must not ask for
  // one — but it is no longer a statement about the DESIGN path.
  const pairsAllowed = obs.part === '' || nestedPairs;
  if (!pairsAllowed) {
    return {
      kind: 'none',
      reason: 'resolved values differ across variants without correlating to any variant axis — nothing minted; bind manually',
    };
  }
  /** One pair's fit: the observed cells, or null when two observations
   *  contradict inside a cell (or an occurrence is missing an axis value). */
  const fitPair = (a: MintAxis, b: MintAxis): Map<string, string | number> | null => {
    const byValue = new Map<string, string | number>();
    for (const o of obs.occurrences) {
      const va = o.axisValues[a.propName];
      const vb = o.axisValues[b.propName];
      if (va === undefined || vb === undefined) return null;
      const key = pairKey(va, vb);
      const seen = byValue.get(key);
      if (seen !== undefined && seen !== o.value) return null;
      byValue.set(key, o.value);
    }
    return byValue;
  };
  const cellsMissing = (a: MintAxis, b: MintAxis, byValue: Map<string, string | number>): string[] => {
    const missing: string[] = [];
    for (const va of a.values) for (const vb of b.values) if (!byValue.has(pairKey(va, vb))) missing.push(pairKey(va, vb));
    return missing;
  };
  // PASS 1 — the FULLY COVERED pairs, exactly as before the ragged branch
  // existed. This pass must run over EVERY pair before the relaxed one is
  // tried: an adversarial fuzz found that letting a ragged fit return from
  // inside a single combined loop lets an earlier-sorting pair that needs a
  // FABRICATED cell pre-empt a later pair every one of whose cells is
  // MEASURED. Trading a measured binding for a supplied one on nothing but
  // axis order is a straight loss, and it silently dropped the saturation
  // caveat with it.
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const [a, b] = [axes[i], axes[j]];
      const byValue = fitPair(a, b);
      if (byValue !== null) {
        const missing = cellsMissing(a, b, byValue);
        // GAP-CLOSING ROUND 10 — THE SATURATION CAVEAT (revised, and the
        // revision is the point). A pair spans |a| x |b| cells; when the
        // observation count does not EXCEED that, every cell holds at most
        // one observation and the "fit" is vacuous — ANY values would fit, so
        // the pair proves no correlation. The first cut REFUSED that case.
        // Measured, it was worse than the disease: ButtonBase's padding is
        // Size(4) x Icon(5) = 20 cells over exactly 20 variants, so refusing
        // discarded twenty MEASURED paddings and rendered a 22px-tall button
        // where the canvas draws 40 — the same lose-a-measured-fact class as
        // border-color -> currentColor. Every cell's value here is an
        // observation, never an interpolation, so the honest act is to CARRY
        // it and NAME its epistemic status: the values are reproduced, and
        // the note says the pair is unwitnessed and may be drift rather than
        // intent. Refusing loses facts; carrying silently overclaims; naming
        // does neither.
        const cells = a.values.length * b.values.length;
        const unwitnessed = obs.occurrences.length <= cells;
        if (missing.length === 0) return { kind: 'variant2', axes: [a, b], byValue, unwitnessed };
        // Sparse fill (presence-shaped channels): unobserved combinations take
        // the declared vacuous value — see the single-axis case. It belongs in
        // THIS pass, not the ragged one: a vacuous value draws nothing, so it
        // fabricates no ink and is strictly more honest than a supplied
        // measurement.
        if (obs.sparse !== undefined && byValue.size > 0) {
          for (const key of missing) byValue.set(key, obs.sparse);
          return { kind: 'variant2', axes: [a, b], byValue, unwitnessed };
        }
      }
    }
  }
  // PASS 2 — THE RAGGED MATRIX. Full cartesian coverage is required because the
  // emitters expand a substituted ref over EVERY declared enum value and
  // `checkToken` (emit-react.ts) makes a missing leaf a hard error, so a hole
  // would refuse the whole contract. But a Figma variant set is frequently NOT
  // a rectangle: Untitled UI's Slider is a RANGE control, so only
  // `rightControl > leftControl` is drawn (10 of 16 cells), _Dropdown list item
  // never draws icon+checkbox together (3 of 4), and Avatar realizes 162 of 216
  // — 3 of the kit's 14 multi-axis sets. Those cells are not missing data; they
  // are combinations the design does not have.
  //
  // MEASURED COST OF REFUSING THEM (Slider `Progress`/`Progress line` width, 40
  // variants): the pair leftControl x rightControl fits all ten drawn cells
  // exactly, but six unrealized cells sank it — so the channel fell to the
  // one-axis base-slice projection, which pinned leftControl at 0 and asserted
  // width by rightControl alone. That drew 320px where the canvas draws 80px in
  // 24 of 40 variants, overrunning the 320px track by up to 248px of ink
  // OUTSIDE the component box. The projection's own note claimed off-slice
  // combinations "keep the refusal"; the emitted per-value map applied
  // unconditionally, so the receipt was false as well as the geometry.
  //
  // SECOND PASS, NOT A BRANCH INSIDE THE FIRST. An adversarial fuzz over
  // a(2) x b(2) x c(3) found that relaxing coverage inline lets an
  // earlier-sorting pair that needs a FABRICATED cell pre-empt a later pair
  // whose every cell is MEASURED — a straight loss decided by nothing but axis
  // order. Every fully-covered pair is therefore tried first, and this pass
  // runs only when none fits.
  //
  // Strict by default: without `realizedCombos` the caller keeps the old
  // full-coverage rule, and a single combination missing an axis value abandons
  // the pair rather than guessing the matrix.
  if (realizedCombos !== undefined) {
    for (let i = 0; i < axes.length; i++) {
      for (let j = i + 1; j < axes.length; j++) {
        const [a, b] = [axes[i], axes[j]];
        const byValue = fitPair(a, b);
        if (byValue === null || byValue.size === 0) continue;
        const missing = cellsMissing(a, b, byValue);
        if (missing.length === 0) continue; // pass 1 already returned it
        const realized = new Set<string>();
        let judgeable = true;
        for (const c of realizedCombos) {
          const va = c[a.propName];
          const vb = c[b.propName];
          if (va === undefined || vb === undefined) { judgeable = false; break; }
          realized.add(pairKey(va, vb));
        }
        // EVERY hole must be unrealized. One genuinely-drawn-but-unobserved
        // cell means the observation really is incomplete, and that keeps the
        // refusal — the dangling-ref protection is relaxed ONLY for cells the
        // variant set proves cannot occur.
        if (!judgeable || !missing.every((k) => !realized.has(k))) continue;
        // THE FILL VALUE IS THE BASE COMBINATION, NOT `occurrences[0]`. Those
        // differ: occurrences[0] is whichever variant the DUMP happened to list
        // first, so a designer reordering the variant set would silently
        // rewrite these token values — probed, and it moved Slider's supplied
        // width from 80px to 320px, which is the overrun this change exists to
        // remove. Ordering every occurrence by its axis values' DECLARED index
        // makes the choice a function of the contract's own vocabulary and
        // nothing else. (The all-first combination may itself be undrawn — a
        // ragged matrix is exactly where that happens — so this takes the
        // smallest combination actually OBSERVED, never a fabricated one.)
        const rank = (o: MintOccurrence): string =>
          allAxes
            .map((ax) => {
              const idx = ax.values.indexOf(o.axisValues[ax.propName] ?? '');
              return String(idx < 0 ? ax.values.length : idx).padStart(4, '0');
            })
            .join('.');
        const base = [...obs.occurrences].sort((x, y) => (rank(x) < rank(y) ? -1 : rank(x) > rank(y) ? 1 : 0))[0].value;
        for (const key of missing) byValue.set(key, base);
        const cells = a.values.length * b.values.length;
        // Saturation is judged against the cells that can actually HOLD an
        // observation. Counting the supplied cells in the denominator
        // under-reported saturation (a 4-observation/6-cell pair stopped
        // warning at all once two cells were filled).
        const drawnCells = cells - missing.length;
        return {
          kind: 'variant2',
          axes: [a, b],
          byValue,
          unwitnessed: obs.occurrences.length <= drawnCells,
          undrawn: missing,
        };
      }
    }
  }
  // Three-axis correlation (live-gauntlet class ① — CBDS Chip's root fill is
  // f(type, style, state), irreducible to any pair). ROOT ONLY, and it stays
  // root-only: a nested part's per-value map pins exactly ONE axis, leaving
  // TWO placeholders in the ref — past the one-placeholder map rule. A
  // nested triple is a named refusal.
  if (obs.part !== '') {
    return {
      kind: 'none',
      reason:
        'resolved values differ across variants without correlating to any variant axis or axis PAIR — a nested part carries at most a pair (one map axis + one placeholder); nothing minted, bind manually',
    };
  }
  // Otherwise: same rules as the pair case — discovery order, full cartesian
  // coverage with a single value per combination. The emitters expand a three-placeholder
  // root ref as compound enum classes (.type-brand.style-fill.state-hover);
  // the cartesian is bounded by the drawn variant count (every combination
  // must be OBSERVED), so no cap is invented. A contradiction on any third
  // axis fails the fit — an irrelevant axis can never ride along, because
  // its combinations would carry contradicting values.
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      for (let k = j + 1; k < axes.length; k++) {
        const triple = [axes[i], axes[j], axes[k]] as [MintAxis, MintAxis, MintAxis];
        const byValue = new Map<string, string | number>();
        let fits = true;
        for (const o of obs.occurrences) {
          const vals = triple.map((a) => o.axisValues[a.propName]);
          if (vals.some((v) => v === undefined)) { fits = false; break; }
          const key = comboKey(vals as string[]);
          const seen = byValue.get(key);
          if (seen !== undefined && seen !== o.value) { fits = false; break; }
          byValue.set(key, o.value);
        }
        if (fits) {
          const missing: string[] = [];
          for (const va of triple[0].values)
            for (const vb of triple[1].values)
              for (const vc of triple[2].values)
                if (!byValue.has(comboKey([va, vb, vc]))) missing.push(comboKey([va, vb, vc]));
          if (missing.length === 0) return { kind: 'variant3', axes: triple, byValue };
          // Sparse fill (presence-shaped channels) — see the pair case.
          if (obs.sparse !== undefined && byValue.size > 0) {
            for (const key of missing) byValue.set(key, obs.sparse);
            return { kind: 'variant3', axes: triple, byValue };
          }
        }
      }
    }
  }
  return {
    kind: 'none',
    reason: 'resolved values differ across variants without correlating to any variant axis (or axis pair/triple) — nothing minted; bind manually',
  };
}

// ---------------------------------------------------------------------------
// mintTokens
// ---------------------------------------------------------------------------

/** Options for {@link mintTokens}. */
export interface MintOptions {
  /** Allow TWO-AXIS classification on NESTED parts (default false). Set it
   *  only when the caller's binding placer can spell a nested pair — a
   *  per-value `tokensByProp` map whose refs keep ONE placeholder naming the
   *  other axis. `extract/computed`'s `applyMintToContract` can; the design
   *  path's direct `part.tokens` write cannot. */
  nestedPairs?: boolean;
  /** Every axis-value combination the component's variant set REALIZES, one
   *  record per variant. Supplying it lets a two-axis fit survive holes that
   *  the variant set proves cannot occur (a RAGGED matrix — a range slider
   *  draws only `right > left`); the unrealized cells fill from the base
   *  observation and are named on the binding. Omit it and full cartesian
   *  coverage is required, exactly as before. */
  realizedCombos?: Array<Record<string, string>>;
}

export function mintTokens(
  component: string,
  observations: MintObservation[],
  axes: MintAxis[],
  opts?: MintOptions,
): MintResult {
  const comp = sanitizeSegment(component);
  const classified = observations.map((o) =>
    classify(o, axes, opts?.nestedPairs === true, opts?.realizedCombos),
  );

  // Dedupe count: identical (kind, value) across UNIFORM usage sites.
  const siteCount = new Map<string, number>();
  classified.forEach((c, i) => {
    if (c.kind !== 'uniform') return;
    const key = `${observations[i].kind}|${formatValue(observations[i].kind, c.value)}`;
    siteCount.set(key, (siteCount.get(key) ?? 0) + 1);
  });

  // Leaf ledger: path → { value, type, entry }. A path claim with the SAME
  // value merges usage sites; a different value takes a numeric suffix —
  // names stay mechanical, values are never overwritten.
  // ROUND 6: `type` is OPTIONAL — a leaf whose value shape has no DTCG type
  // (a sizing keyword) ships `{ $value }` alone rather than a wrong one.
  const leaves = new Map<string, MintedEntry & { type?: string }>();
  /** A leaf may not sit on another leaf's path (a group under a leaf, or a
   *  leaf on a group's prefix, would corrupt the DTCG tree). */
  const hasDescendants = (path: string) => [...leaves.keys()].some((k) => k.startsWith(`${path}.`));
  const claim = (
    wantedPath: string,
    kind: MintKind,
    value: string | number,
    usageSite: string,
    textStyle?: { name: string; key?: string },
  ): string => {
    const formatted = formatValue(kind, value);
    for (let n = 1; ; n++) {
      const path = n === 1 ? wantedPath : `${wantedPath}-${n}`;
      const existing = leaves.get(path);
      if (!existing) {
        if (hasDescendants(path)) continue;
        leaves.set(path, {
          ref: `{${path}}`,
          value: formatted,
          usageSites: [usageSite],
          type: dtcgType(kind, value),
          ...(textStyle ? { textStyle } : {}),
        });
        return path;
      }
      if (
        existing.value === formatted &&
        JSON.stringify(existing.textStyle ?? null) ===
          JSON.stringify(textStyle ?? null)
      ) {
        if (!existing.usageSites.includes(usageSite)) existing.usageSites.push(usageSite);
        return path;
      }
    }
  };

  const bindings: MintedBinding[] = classified.map((c, i) => {
    const obs = observations[i];
    if (c.kind === 'none') {
      return { nodePath: obs.nodePath, cssProperty: obs.cssProperty, ref: null, reason: c.reason };
    }
    // v17: a style-riding typography observation is named for the STYLE and
    // not for the component/part that happens to draw it (see styleName).
    const base =
      obs.styleName !== undefined
        ? `${MINT_NAMESPACE}.text.${sanitizeSegment(obs.styleName)}.${obs.cssProperty}`
        : `${MINT_NAMESPACE}.${comp}.${partSegment(obs.part)}.${obs.cssProperty}`;
    const site = `${obs.nodePath} ${obs.cssProperty}`;
    if (c.kind === 'uniform') {
      const key = `${obs.kind}|${formatValue(obs.kind, c.value)}`;
      const wanted =
        obs.styleName === undefined &&
        (siteCount.get(key) ?? 0) >= MINT_SHARE_THRESHOLD
          ? `${MINT_NAMESPACE}.shared.${sharedName(obs.kind, c.value)}`
          : base;
      const path = claim(
        wanted,
        obs.kind,
        c.value,
        site,
        obs.styleName
          ? {
              name: obs.styleName,
              ...(obs.styleKey ? { key: obs.styleKey } : {}),
            }
          : undefined,
      );
      return { nodePath: obs.nodePath, cssProperty: obs.cssProperty, ref: `{${path}}` };
    }
    // Per-variant (one, two, or three axes): one leaf per axis value (or
    // value combination) under a common base. The base must be free (or
    // value-compatible) for EVERY key — probe suffixes as a group so the
    // substituted ref stays a real tree prefix.
    const axisProps = c.kind === 'variant' ? [c.axis.propName] : c.axes.map((a) => a.propName);
    const siteSuffix = (key: string) =>
      key.split('.').map((v, i) => `${axisProps[i]}=${v}`).join(', ');
    for (let n = 1; ; n++) {
      const groupBase = n === 1 ? base : `${base}-${n}`;
      const compatible =
        !leaves.has(groupBase) &&
        [...c.byValue.entries()].every(([key, value]) => {
          const existing = leaves.get(`${groupBase}.${key}`);
          if (existing !== undefined) return existing.value === formatValue(obs.kind, value);
          return !hasDescendants(`${groupBase}.${key}`);
        });
      if (!compatible) continue;
      // A ragged-matrix fill is not a usage SITE — no variant renders it. Say
      // so on the leaf, so a reader renaming these tokens against a real
      // system can see which cells the design never drew.
      const undrawnKeys = new Set(c.kind === 'variant2' ? (c.undrawn ?? []) : []);
      const textStyleForKey = (
        key: string,
      ): { name: string; key?: string } | undefined => {
        const axisVals = key.split('.');
        const match = obs.occurrences.find((o) =>
          axisProps.every((prop, i) => o.axisValues[prop] === axisVals[i]),
        );
        if (match?.styleName !== undefined) {
          return {
            name: match.styleName,
            ...(match.styleKey ? { key: match.styleKey } : {}),
          };
        }
        if (obs.styleName !== undefined) {
          return {
            name: obs.styleName,
            ...(obs.styleKey ? { key: obs.styleKey } : {}),
          };
        }
        return undefined;
      };
      for (const [key, value] of c.byValue) {
        claim(
          `${groupBase}.${key}`,
          obs.kind,
          value,
          undrawnKeys.has(key)
            ? `${site} (${siteSuffix(key)} — NOT DRAWN in the variant set; base value supplied so the pair can carry)`
            : `${site} (${siteSuffix(key)})`,
          textStyleForKey(key),
        );
      }
      const cells2 =
        c.kind === 'variant2' ? c.axes[0].values.length * c.axes[1].values.length : 0;
      // Both caveats can apply to one binding; they are different facts, so
      // they are both said rather than one shadowing the other.
      const caveats: string[] = [];
      const undrawnCount = c.kind === 'variant2' ? (c.undrawn?.length ?? 0) : 0;
      if (c.kind === 'variant2' && c.undrawn !== undefined && undrawnCount > 0) {
        const drawn = cells2 - undrawnCount;
        const supplied = c.byValue.get(c.undrawn[0])!;
        caveats.push(
          `the pair "${axisProps[0]}" x "${axisProps[1]}" is RAGGED — the variant set draws ${drawn} of its ${cells2} cell(s), ` +
            `and each of those ${drawn} is a measured observation. The ${undrawnCount} cell(s) the set never draws ` +
            `(${c.undrawn.map((k) => siteSuffix(k)).join('; ')}) carry ${formatValue(obs.kind, supplied)} — the value of the ` +
            'lowest DECLARED axis combination that is drawn — so the substituted ref resolves at every combination the ' +
            'prop types allow. Those cells are SUPPLIED, not measured. NOTHING IN THE DESIGN DRAWS THEM, but the ' +
            'generated component still RENDERS them if it is called with that prop combination (the emitted prop types ' +
            'permit every combination; the Figma variant set does not have every combination). Give them a reviewed ' +
            'value or constrain the props — the drawn cells are the contract.',
        );
      }
      if (c.kind === 'variant2' && c.unwitnessed) {
        // Saturation is a statement about the DRAWN evidence, so its
        // denominator and its histogram both exclude the supplied cells — the
        // fill would otherwise manufacture the very repetition this sentence
        // offers the reader as a sign of structure.
        const drawnValues =
          c.undrawn === undefined || undrawnCount === 0
            ? [...c.byValue.values()]
            : [...c.byValue.entries()].filter(([k]) => !c.undrawn!.includes(k)).map(([, v]) => v);
        const denom = cells2 - undrawnCount;
        caveats.push(
          // "every value carried here is measured" would CONTRADICT the ragged
          // sentence above, which just said some are supplied. Say it only when
          // it is true.
          `${undrawnCount > 0 ? 'every DRAWN cell here is measured' : 'every value carried here is measured'}` +
            `, but the pair "${axisProps[0]}" x "${axisProps[1]}" is SATURATED ` +
            `(${obs.occurrences.length} observation(s) over ${denom} drawn cell(s) — at most one per cell, so ANY values would fit): ` +
            'the per-cell values reproduce the drawing exactly, but the CORRELATION is unwitnessed and may be drift rather than intent — review before treating it as a rule. ' +
            // The distinct-value count is the reviewer's shortcut. An
            // arbitrary assignment over N cells tends toward N distinct
            // values; heavy repetition is structure the fit did not have
            // to invent. It is a HINT, deliberately not a gate: the engine
            // does not get to decide intent from a histogram, it just
            // hands the reader the number it already computed.
            `Values are ${new Set(drawnValues.map((v) => formatValue(obs.kind, v))).size} distinct over ${denom} drawn cell(s)` +
            `${new Set(drawnValues).size < denom ? ' — the repetition across cells is structure, which an arbitrary assignment would not show' : ' — one distinct value per cell, which is what uncorrelated drift looks like'}`,
        );
      }
      return {
        nodePath: obs.nodePath,
        cssProperty: obs.cssProperty,
        ref: `{${groupBase}.${axisProps.map((p) => `{${p}}`).join('.')}}`,
        ...(caveats.length > 0 ? { caveat: caveats.join(' ALSO: ') } : {}),
      };
    }
  });

  // Leaves → nested DTCG tree (each leaf carries its claim's $type — omitted
  // where the value's shape has no DTCG type to name, see dtcgType).
  const tree: Record<string, unknown> = {};
  for (const [path, entry] of leaves) {
    const segs = path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) {
      node = (node[seg] ??= {}) as Record<string, unknown>;
    }
    node[segs[segs.length - 1]] = {
      $value: entry.value,
      ...(entry.type !== undefined ? { $type: entry.type } : {}),
      ...(entry.textStyle
        ? { $extensions: { dsContracts: { textStyle: entry.textStyle } } }
        : {}),
    };
  }

  return {
    tree,
    count: leaves.size,
    entries: [...leaves.values()].map(
      ({ ref, value, usageSites, textStyle }) => ({
        ref,
        value,
        usageSites,
        ...(textStyle ? { textStyle } : {}),
      }),
    ),
    bindings,
  };
}

// ---------------------------------------------------------------------------
// Minted tree → CSS custom properties (the playground's preview stylesheet)
// ---------------------------------------------------------------------------

/** The minted tree as a `:root { --imported-…: value; }` block — the same
 *  custom-property spelling the emitters reference (var(--a-b-c)), so a page
 *  that includes this block renders the minted bindings at literal fidelity. */
export function mintedTokenCss(tree: Record<string, unknown>): string {
  const dashed = (p: string) => p.split('.').join('-');
  const lines = [':root {'];
  for (const [path, entry] of flattenTokens(tree)) {
    // DTCG ALIAS ({other.token}) — a fresh mint emits literals only, but a
    // SHIPPED minted tree can carry aliases (astryx's re-anchoring round
    // aliased 54 of 237 leaves; mui 73, tailwind 21). Printed raw they were
    // invalid CSS (`--imported-shared-color-0064e0: {color-accent};`), which
    // is a silent empty custom property wherever a shipped tree is rendered
    // — including the fidelity gate now that it carries one (task #21).
    // var() is the faithful spelling: it keeps the alias a REFERENCE, so the
    // library's own stylesheet (and its modes) still decide the value.
    const target = aliasTarget(entry.value);
    lines.push(`  --${dashed(path)}: ${target ? `var(--${dashed(target)})` : String(entry.value)};`);
  }
  lines.push('}');
  return lines.join('\n');
}
