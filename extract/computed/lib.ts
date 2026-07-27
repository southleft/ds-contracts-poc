/**
 * COMPUTED-CAPTURE FLOOR — shared primitives.
 *
 * Productionized from extract/computed-spike/run.ts (the working prototype;
 * DESIGN.md in that directory is the design this module executes). Everything
 * here is pure (no browser, no fs) so the eval suite and the CLI share one
 * implementation of:
 *
 *   · the captured-truth data model + normalization (§3.2)
 *   · fusability exclusions: geometry / logical aliases / -webkit (§3.3)
 *   · DOM→anatomy: signatures, part naming, flatten/align (§4)
 *   · prop-space enumeration policy incl. the ≤512 cartesian / per-axis+
 *     pairwise switch and the ≥3-axis pairwise-inconsistency certificate
 *     (§1.4)
 *   · value kinds for minting and the contract-channel → computed-longhand
 *     map (the verify.ts channel map, shared verbatim)
 */
import type { MintObservation } from '../../core/mint-tokens.js';
import type { ContractState } from '../../scripts/contract-schema.js';

// ---------------------------------------------------------------------------
// Captured data model + normalization (§3.2)
// ---------------------------------------------------------------------------
export type StyleMap = Record<string, string>;

export interface CapturedNode {
  tag: string;
  classes: string[];
  /** child NODES in document order: text runs and elements interleaved. */
  nodes: Array<{ t: 'text'; v: string } | { t: 'el'; el: CapturedNode }>;
  style: StyleMap;
  /** CONFORMANCE FRONTIER (R7): the reader looks at `READ_PSEUDOS`. The DECOR
   *  grammar still promotes `DECOR_PSEUDOS` only — reading is not carrying. */
  pseudo: Partial<Record<ReadPseudo, StyleMap>>;
  /** DEPTH BUILD (Stage A/B, portal-aware capture only): the element's ARIA
   *  `role` / `aria-modal` attribute, read only on the portal-capture path so
   *  the root-descent (anatomy.realRootsOf) and multi-root naming can treat a
   *  `role="dialog"` node as a real root. The census sweep never sets these
   *  (its read carries no attributes), so they are undefined on every one of
   *  the committed 12 components — normalizeNode omits undefined keys, keeping
   *  the census captures byte-identical. */
  role?: string | null;
  ariaModal?: string | null;
  /** EMOTION/CSS-VARS READER (MUI round): channel → candidate [customPropertyName,
   *  resolvedRawValue, declaringRuleSelector] triples from ALL matching rules (specificity is not
   *  document order — verification against the computed value picks) for declarations in matching CSSOM rules that
   *  reference `var(--<varPrefix>…)`. SOURCE evidence — the library's own
   *  emitted CSS names the token it binds. Captured only when the config
   *  declares `library.varPrefix`; undefined (and omitted by normalizeNode)
   *  everywhere else, keeping committed captures byte-identical. */
  vrefs?: Record<string, Array<[string, string, string]>>;
  /** SILENT-LOSS ROUND (task #33, fix 1): property → var names for source
   *  declarations that are SHORTHANDS carrying a var(). Chromium stores such a
   *  declaration as a pending-substitution value and enumerates its longhands
   *  with the EMPTY STRING, so the reader used to drop them before anything
   *  could name the loss. Recorded here, never bound — the count is the size
   *  of the shorthand ceiling (task #27). */
  vshorthands?: Record<string, string[]>;
  /** CONFORMANCE FRONTIER (R5): property → [varNames, declarationText] pairs
   *  for source declarations whose value contains a `calc()` carrying a
   *  `var()`. The var names ALSO enter `vrefs` as ordinary candidates (the
   *  existing value verification confirms or rejects them); this record is
   *  what lets the skip say `calc` when the arithmetic makes verification
   *  impossible by construction. */
  vcalcs?: Record<string, Array<[string[], string]>>;
}

export interface Capture {
  combo: string;
  interaction: string;
  focusVisibleMatched?: boolean;
  root: CapturedNode;
}

/** Canonical rgba: Chromium serializes opaque colors rgb(r, g, b) — normalize
 *  every embedded occurrence to rgba(r, g, b, 1). Deterministic, lossless. */
export const normalizeValue = (v: string): string =>
  v.replace(/\brgb\((\d+), (\d+), (\d+)\)/g, 'rgba($1, $2, $3, 1)');

/** Absolute-position round: SYNTHETIC translate channels. An identity-
 *  translate matrix (matrix(1,0,0,1,tx,ty) — what Chromium computes for
 *  translate()/translate(-50%,-50%)) decomposes into two px channels so the
 *  standard mint machinery gives uniform/per-axis planes for free (MUI's
 *  thumb centers via -50% translates that VARY by the size axis — a uniform-
 *  only declared fact can't carry them). Excluded from replay application
 *  and the fidelity gate by name (SYNTHETIC_CHANNELS). */
export const SYNTHETIC_CHANNELS = new Set(['translate-x', 'translate-y']);

/** SILENT-LOSS ROUND (task #33, fix 1) — THE SHORTHAND CEILING (task #27).
 *
 *  The CSS-variables reader collects candidates from the rules that MATCH an
 *  element, keyed by the property each rule declares. A source declaration
 *  can be a SHORTHAND carrying a var():
 *
 *      background: var(--tok);   font: var(--x);
 *      border: 1px solid var(--y);   padding: var(--p);   transition: var(--t);
 *
 *  Chromium's CSSOM reports the shorthand as the declared property, and
 *  `getComputedStyle` enumerates LONGHANDS ONLY — a shorthand with a var() is
 *  a "pending-substitution value" whose longhands compute to the empty string.
 *  So the reader had a source fact naming a real token and NO computed value
 *  to verify it against, and the Node side did `continue` — dropping it with
 *  nothing pushed to `skips`. The artifact then said `skips: []` and the
 *  console printed `0 named skip(s)`: the receipt ASSERTED COMPLETENESS over
 *  a loss it had just taken.
 *
 *  This is the size of the shorthand ceiling. It is now counted, named per
 *  declaration, and printed. */
export const CSS_SHORTHANDS = new Set([
  'all', 'animation', 'background', 'border', 'border-block', 'border-block-end',
  'border-block-start', 'border-bottom', 'border-color', 'border-image',
  'border-inline', 'border-inline-end', 'border-inline-start', 'border-left',
  'border-radius', 'border-right', 'border-style', 'border-top', 'border-width',
  'column-rule', 'columns', 'container', 'flex', 'flex-flow', 'font', 'gap',
  'grid', 'grid-area', 'grid-column', 'grid-row', 'grid-template', 'inset',
  'inset-block', 'inset-inline', 'list-style', 'margin', 'margin-block',
  'margin-inline', 'mask', 'offset', 'outline', 'overflow', 'padding',
  'padding-block', 'padding-inline', 'place-content', 'place-items',
  'place-self', 'scroll-margin', 'scroll-padding', 'text-decoration',
  'text-emphasis', 'transition',
]);

/** The named skip for one dropped source declaration. Pure — shared by the
 *  capture runner (which writes it into source-bindings.json) and any
 *  instrument that wants to size the ceiling without re-fusing. */
export function shorthandVarSkip(part: string, channel: string, varNames: string[]): string {
  const vars = [...new Set(varNames)].sort().join(', ');
  return CSS_SHORTHANDS.has(channel)
    ? `${part}.${channel}: SHORTHAND carrying var(${vars}) — computed style enumerates LONGHANDS only, so a shorthand with a var() (a CSS pending-substitution value) has no computed value to verify against; the token this declaration names is NOT carried on any longhand it sets (the shorthand ceiling, task #27)`
    : `${part}.${channel}: source declares var(${vars}) on a property the computed sweep does not enumerate — no computed value to verify against, binding NOT carried`;
}
/** CONFORMANCE FRONTIER (R5) — THE CALC CEILING, named per declaration.
 *
 *  A `calc()` over a token is how every compact/density mode ships. The var
 *  references inside it are now ordinary candidates and the existing value
 *  verification confirms them when the arithmetic is an identity; when it is
 *  NOT (`calc(var(--space-2) * 2)` → 16px against a token worth 8px), no
 *  candidate can verify BY CONSTRUCTION and the name is lost. That loss is
 *  this message — the same shape as `shorthandVarSkip`, in the same artifact,
 *  instead of the silence that used to print `0 named skip(s)` over it. */
export function calcVarSkip(part: string, channel: string, varNames: string[], declaration: string): string {
  const vars = [...new Set(varNames)].sort().join(', ');
  return `${part}.${channel}: source declares \`${declaration}\` — a calc() over var(${vars}). The computed value is the RESULT of the arithmetic, not the token's own value, so no candidate can verify by value equality and the token NAME is not carried (the calc ceiling). The resolved pixel is correct; only the name is lost.`;
}

const IDENTITY_MATRIX = /^matrix\(1, 0, 0, 1, (-?[\d.]+), (-?[\d.]+)\)$/;

/** PSEUDO-DECOR v2 ROUND — the `translate` LONGHAND joins the decomposition.
 *  Tailwind v4's `translate-x-full` does NOT compile to `transform`: it sets
 *  the INDEPENDENT `translate` property, which Chromium computes as `none`,
 *  `<len|pct>`, or `<len|pct> <len|pct>` (the toggle knob's `100%`). Until
 *  now only `transform` was decomposed, so a knob that moves via `translate`
 *  looked motionless — "a checked toggle on canvas is a colored track with
 *  no knob".
 *
 *  BOUNDED GRAMMAR (everything else refuses by name downstream):
 *    · `none` — no contribution;
 *    · one or two components, each `<n>px` or `<n>%`;
 *    · a PERCENTAGE bakes against the element's OWN captured border box
 *      (width for x, height for y) — the same idiom as the %-radius bake in
 *      fuse.ts. A % with no px box to bake against contributes nothing and
 *      leaves the raw `translate` value for the named downstream refusal.
 *  `transform` AND `translate` both non-identity is OUTSIDE the grammar:
 *    NEITHER synthetic channel is written (the raw values stay visible so the
 *    consumer names `translate-and-transform-both-set`) — never silently
 *    picking one. */
const TRANSLATE_COMPONENT = /^(-?\d+(?:\.\d+)?)(px|%)$/;
export const TRANSLATE_LONGHAND = /^(none|-?\d+(?:\.\d+)?(px|%)( -?\d+(?:\.\d+)?(px|%))?)$/;

/** True when `transform` carries a real (non-identity-translate) matrix. */
export const hasNonTranslateTransform = (t: string | undefined): boolean =>
  t !== undefined && t !== 'none' && !IDENTITY_MATRIX.test(t);

/** Decompose `transform`/`translate` into the synthetic translate-x/y px
 *  channels, IN PLACE. Pure, deterministic, IDEMPOTENT (re-running on an
 *  already-decomposed map recomputes the identical values) — applied at BOTH
 *  read boundaries: capture (normalizeNode) and replay (reconstructCaptures),
 *  ONE implementation. */
export function decomposeTranslate(out: StyleMap): void {
  const m = IDENTITY_MATRIX.exec(out['transform'] ?? '');
  const tr = out['translate'] ?? 'none';
  const trSet = tr !== 'none' && tr !== '';
  // Outside the grammar: both spellings carry motion. Write nothing.
  if (m && trSet) return;
  if (m) {
    out['translate-x'] = `${parseFloat(m[1])}px`;
    out['translate-y'] = `${parseFloat(m[2])}px`;
    return;
  }
  if (!trSet || !TRANSLATE_LONGHAND.test(tr)) return;
  // A non-identity `transform` alongside `translate` is outside the grammar.
  if (hasNonTranslateTransform(out['transform'])) return;
  const parts = tr.split(' ');
  const box = [out['width'], out['height']];
  const resolved: number[] = [];
  for (let i = 0; i < 2; i++) {
    const c = parts[i];
    if (c === undefined) { resolved.push(0); continue; }
    const cm = TRANSLATE_COMPONENT.exec(c);
    if (!cm) return;
    if (cm[2] === 'px') { resolved.push(parseFloat(cm[1])); continue; }
    // percentage: bake against this element's OWN captured border box
    const bm = /^(-?\d+(?:\.\d+)?)px$/.exec(box[i] ?? '');
    if (!bm) return; // no px box to bake against — leave undecomposed (named downstream)
    resolved.push(Math.round((parseFloat(cm[1]) / 100) * parseFloat(bm[1]) * 1000) / 1000);
  }
  out['translate-x'] = `${resolved[0]}px`;
  out['translate-y'] = `${resolved[1]}px`;
}

/**
 * CONFORMANCE FRONTIER (R1) — THE PAINTED-INK RULE.
 *
 * `-webkit-text-fill-color` IS the colour the browser paints text with.
 * `color` is only the FALLBACK: the fill defaults to `currentcolor`, and when
 * a rule sets the fill explicitly, `color` paints NOWHERE. Verified in the
 * subject browser rather than assumed — a 48px monospace run with
 * `color: rgb(17,17,17); -webkit-text-fill-color: rgb(153,153,153)` rasterises
 * its darkest pixel at rgb(153,153,153); the identical run without the fill
 * rasterises at rgb(17,17,17).
 *
 * This is exactly how every library styles disabled input text, and until this
 * fold the contract MINTED A COLOUR THAT IS NOT ON SCREEN: the conformance
 * case carried `tokens.color = #111111` for text the browser drew in #999999,
 * with no receipt anywhere. That is a correctness defect, not a missing
 * receipt — so it is fixed at the READ BOUNDARY, where this repo already
 * decided that what does not paint is not captured (the Carbon D1 SVG
 * `<title>` drop) and where the derived translate channels are minted.
 *
 * `color` becomes the fill (it is not a distinct channel): `TOKEN_CHANNELS`
 * defines `color` as "the text node fill", so the painted fill IS what that
 * channel means on both surfaces. Registering `-webkit-text-fill-color`
 * separately would put TWO fills on one text node and force every consumer to
 * re-decide precedence. The raw `-webkit-text-fill-color` channel stays in the
 * capture as the evidence.
 *
 * PURE, IDEMPOTENT, applied at BOTH read boundaries (normalizeNode + the
 * replay/regate reconstruction) exactly like `decomposeTranslate`, so an
 * offline re-fuse of a COMMITTED capture folds too. Returns the overridden
 * authored colour when it folded (the receipt), else null.
 *
 * MEASURED CORPUS IMPACT: across all six committed libraries — 706 captured
 * elements and 2,845 capture-delta cells that touch either channel — the fill
 * and `color` NEVER disagree. The fold is a byte-level no-op for every
 * library; the only subject that moves is the conformance case.
 */
export function foldTextFillColor(out: StyleMap): string | null {
  const fill = out['-webkit-text-fill-color'];
  const color = out['color'];
  if (fill === undefined || color === undefined) return null;
  if (fill === color) return null;
  // `currentcolor` is the initial value: it IS `color`, nothing to fold.
  if (/^currentcolor$/i.test(fill.trim())) return null;
  out['color'] = fill;
  return color;
}

/** PILL SENTINEL (shared — pseudo-decor v2 round). `rounded-full` compiles to
 *  `calc(infinity * 1px)`; Chromium clamps it to `3.35544e+07px`, scientific
 *  notation that NO px grammar in this repo matches. fuse.ts has always
 *  folded it to the 9999px pill sentinel for minted radii; the pseudo-decor
 *  fold used a local px() regex that silently produced 0 instead — which
 *  shipped a promoted pill thumb as a SQUARE. One implementation, both
 *  consumers. */
/**
 * CONFORMANCE FRONTIER (R7) — THE PSEUDO-ELEMENT READER'S FRONTIER, DECLARED.
 *
 * The reader looked at `::before`/`::after` and NOTHING ELSE, in both the
 * census and the portal path — so `::placeholder` (every text input in every
 * library) and `::marker` (every list) were not refused, they were NEVER
 * MEASURED. "We never read ::marker" and "we read it and refused it" are
 * different facts and the fixture counts them differently.
 *
 * MEASURED in the subject browser before choosing: all four candidate pseudos
 * read back real values through `getComputedStyle(el, pe)` —
 * `::placeholder{color}` → rgb(150,150,150), `::marker{color,font-size}` →
 * rgb(200,60,60)/20px, `::selection{background-color}` → rgb(255,214,0), and
 * `::backdrop{background-color}` → rgb(10,20,30) but ONLY after `showModal()`.
 *
 * WHAT THE READER NOW LOOKS AT, and why the line is here:
 *   · `::placeholder` — real ink a designer notices (placeholder text colour
 *     is a reviewed token in every design system's input).
 *   · `::marker`      — real ink (the bullet/number of every list).
 *   · `::selection`   — NOT read. Transient user state; it paints only while
 *     a pointer drag exists, and the capture drives no selection. REFUSED BY
 *     NAME with a count instead of measured.
 *   · `::backdrop`    — NOT read. It paints only for a dialog in the top
 *     layer, which requires the capture to call `showModal()`; the sweep
 *     drives prop combos and pseudo-class states, not top-layer promotion.
 *     REFUSED BY NAME with a count instead of measured.
 *
 * Reading a pseudo is NOT carrying it: the bounded decor grammar in anatomy.ts
 * still promotes `::before`/`::after` only, and every newly-read pseudo is
 * refused by name in the ledger with its measured values quoted.
 */
export const READ_PSEUDOS = ['::before', '::after', '::marker', '::placeholder'] as const;
export type ReadPseudo = (typeof READ_PSEUDOS)[number];
/** The two the reader deliberately does NOT look at, each with the measured
 *  reason it is out of reach. Counted and named in every run's ledger. */
export const REFUSED_PSEUDOS: ReadonlyArray<readonly [string, string]> = [
  ['::selection', 'transient user state — it paints only while a selection exists, and the capture drives prop combos and pseudo-class states, never a pointer drag; there is also no canvas spelling for a selection highlight'],
  ['::backdrop', 'paints only for an element promoted to the TOP LAYER (dialog.showModal() / popover), which the sweep never calls — measured: getComputedStyle(dialog, "::backdrop") reads the authored scrim ONLY after showModal(). The canvas DOES have a spelling (a scrim rectangle), so this is a reader gap worth closing, not a canvas limit'],
];
/** The pseudos the DECOR grammar may promote — deliberately narrower than
 *  READ_PSEUDOS, so extending the reader can never widen promotion. */
export const DECOR_PSEUDOS = ['::before', '::after'] as const;
/** Splits a `${part}${pseudo}` capture key. Kept in ONE place so the reader,
 *  the reconstruction and the replay page can never disagree about which
 *  pseudo keys survive a round-trip (they disagreed by construction before:
 *  reconstruction hardcoded `/(::before|::after)$/`, so any newly-read pseudo
 *  would have silently forced every capture to the `fullRoot` fallback). */
export const PSEUDO_KEY_RE = new RegExp(`^(.*)(${READ_PSEUDOS.join('|')})$`);

export const PILL_RADIUS_SENTINEL = '9999px';
export const isAbsurdRadius = (v: string | undefined): boolean => /^[\d.]+e\+?\d+px$/.test(v ?? '');

export function normalizeNode(n: CapturedNode): CapturedNode {
  const norm = (s: StyleMap): StyleMap => {
    const out: StyleMap = {};
    for (const k of Object.keys(s).sort()) out[k] = normalizeValue(s[k]);
    decomposeTranslate(out);
    foldTextFillColor(out);
    return out;
  };
  return {
    tag: n.tag,
    classes: n.classes,
    nodes: n.nodes.map((c) => (c.t === 'text' ? c : { t: 'el' as const, el: normalizeNode(c.el) })),
    style: norm(n.style),
    pseudo: Object.fromEntries(
      Object.entries(n.pseudo).map(([k, v]) => [k, norm(v as StyleMap)]),
    ) as CapturedNode['pseudo'],
    // Portal-capture-only attributes: preserved when present, OMITTED when
    // undefined (the census case) so committed captures stay byte-identical.
    ...(n.role !== undefined ? { role: n.role } : {}),
    ...(n.ariaModal !== undefined ? { ariaModal: n.ariaModal } : {}),
    ...(n.vrefs !== undefined
      ? { vrefs: Object.fromEntries(Object.keys(n.vrefs).sort().map((k) => [k, n.vrefs![k]])) }
      : {}),
    // DEFECT FOUND WHILE CLOSING R5 — `vshorthands` was NEVER preserved here.
    // normalizeNode builds a fresh object, and the task-#33 shorthand-ceiling
    // field was not on the list, so `el.node.vshorthands` was `undefined` on
    // every aligned element and `shorthandCeiling` was STRUCTURALLY 0 in every
    // artifact the instrument has ever written. The instrument existed, was
    // documented, and measured nothing. Preserved now — together with the new
    // `vcalcs` — so both receipts survive the read boundary.
    ...(n.vshorthands !== undefined
      ? { vshorthands: Object.fromEntries(Object.keys(n.vshorthands).sort().map((k) => [k, n.vshorthands![k]])) }
      : {}),
    ...(n.vcalcs !== undefined
      ? { vcalcs: Object.fromEntries(Object.keys(n.vcalcs).sort().map((k) => [k, n.vcalcs![k]])) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Fusability exclusions (§3.3) — captured and replayed, folded OUT of fusion
// by name; every exclusion is quoted in the ledger.
// ---------------------------------------------------------------------------
/** Geometry channels: captured, but environment-dependent (font metrics /
 *  layout-derived) — excluded from fusion, NAMED in the ledger. */
export const GEOMETRY_CHANNELS = new Set([
  'width', 'height', 'inline-size', 'block-size', 'perspective-origin', 'transform-origin',
  'webkit-logical-width', 'webkit-logical-height',
]);

/** Logical-property aliases of physical longhands under the PINNED writing
 *  mode (horizontal-tb + ltr, recorded in provenance). Chromium enumerates
 *  both spellings; fusing both would double-count every box channel. */
export const LOGICAL_ALIASES = new Set([
  'min-inline-size', 'min-block-size', 'max-inline-size', 'max-block-size',
  'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end',
  'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end',
  'padding-block-start', 'padding-block-end', 'padding-inline-start', 'padding-inline-end',
  'border-block-start-width', 'border-block-end-width', 'border-inline-start-width', 'border-inline-end-width',
  'border-block-start-style', 'border-block-end-style', 'border-inline-start-style', 'border-inline-end-style',
  'border-block-start-color', 'border-block-end-color', 'border-inline-start-color', 'border-inline-end-color',
  'border-start-start-radius', 'border-start-end-radius', 'border-end-start-radius', 'border-end-end-radius',
  'overflow-block', 'overflow-inline', 'overscroll-behavior-block', 'overscroll-behavior-inline',
  'contain-intrinsic-block-size', 'contain-intrinsic-inline-size',
]);

export const isFusable = (prop: string): boolean =>
  !prop.startsWith('-webkit-') && !GEOMETRY_CHANNELS.has(prop) && !LOGICAL_ALIASES.has(prop);

/** Channels the replay cannot apply/serialize faithfully via inline styles —
 *  named, excluded from BOTH replay application and the re-read equality
 *  metric (never silently): app-region is unsettable outside app contexts;
 *  text-decoration is a SHORTHAND Chromium enumerates whose re-serialization
 *  reorders (its longhands are captured, applied, and compared individually). */
export const REPLAY_APPLY_EXCLUDE = new Set(['app-region', 'text-decoration', 'translate-x', 'translate-y']);

// ---------------------------------------------------------------------------
// GATE INVENTORY — fresh mint over the SHIPPED minted tree (task #21)
// ---------------------------------------------------------------------------

/** The result of laying a library's SHIPPED minted tree under a run's FRESH
 *  mint. `added` are the shipped leaves the run no longer produces (the ones
 *  a frozen reviewed layer still binds); `divergent` are leaves BOTH trees
 *  carry with DIFFERENT values — fresh wins by rule, and each one is named
 *  because a divergence is a candidate real regression, never a detail. */
export interface MintedMerge {
  tree: Record<string, unknown>;
  added: string[];
  divergent: Array<{ token: string; fresh: string; shipped: string }>;
}

/** DTCG leaf count of a token tree (a node with `$value`). The ORDERING GUARD
 *  (task #28) uses it as the one honest test of "does this shipped minted tree
 *  exist yet": a stub written only to satisfy the task-#21 existence refusal
 *  counts ZERO, and a gate measured against it records `leavesAdded: 0` for a
 *  tree the promotion had not written. Pure, so `loadConfig`, the gate and the
 *  eval suite share one definition of the word "exists". */
export function mintedLeafCount(tree: Record<string, unknown>): number {
  let n = 0;
  const walk = (o: Record<string, unknown>): void => {
    if ('$value' in o) { n++; return; }
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('$') || !v || typeof v !== 'object') continue;
      walk(v as Record<string, unknown>);
    }
  };
  walk(tree);
  return n;
}

/**
 * PRECEDENCE, from first principles (docs/20-regate-drift.md):
 *
 *   FRESH FIRST, SHIPPED FALLBACK.
 *
 * The fresh mint is the run's own measured truth for every leaf it produces —
 * scoring against a stale shipped value would measure the library as it was,
 * not as it is. The shipped tree exists to fill the leaves the run NO LONGER
 * mints, which a shipped contract's REVIEWED layer may still bind (that is
 * the whole point of the static layer: fusion preserves reviewed bindings, so
 * a recapture re-mints AROUND them and never re-creates them). Anything else
 * would let a shipped value quietly overwrite a fresh measurement.
 *
 * The rule is only safe because collisions are REPORTED: a leaf whose fresh
 * value differs from its shipped value is a fact about the library or the
 * mint, and it rides `divergent` into the scorecard rather than being decided
 * in silence.
 *
 * Pure (no fs) so the gate, the harness and the eval suite share one
 * implementation. `fresh` is never mutated.
 */
export function mergeShippedMinted(
  fresh: Record<string, unknown>,
  shipped: Record<string, unknown>,
): MintedMerge {
  const tree = structuredClone(fresh);
  const added: string[] = [];
  const divergent: MintedMerge['divergent'] = [];
  const isLeaf = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && '$value' in (v as object);
  const walk = (dst: Record<string, unknown>, src: Record<string, unknown>, prefix: string, inherited: string): void => {
    const srcType = typeof src.$type === 'string' ? src.$type : inherited;
    for (const [key, value] of Object.entries(src)) {
      if (key.startsWith('$') || !value || typeof value !== 'object') continue;
      const node = value as Record<string, unknown>;
      const dotted = prefix ? `${prefix}.${key}` : key;
      const cur = dst[key];
      if (isLeaf(node)) {
        if (cur === undefined) {
          const leaf = structuredClone(node);
          if (typeof leaf.$type !== 'string' && srcType) leaf.$type = srcType;
          dst[key] = leaf;
          added.push(dotted);
        } else if (isLeaf(cur)) {
          if (String(cur.$value) !== String(node.$value)) {
            divergent.push({ token: dotted, fresh: String(cur.$value), shipped: String(node.$value) });
          }
        } else {
          // Shape divergence: shipped says leaf, fresh says group. Named, not
          // merged — a group cannot be a value.
          divergent.push({ token: dotted, fresh: '(group)', shipped: String(node.$value) });
        }
        continue;
      }
      if (cur === undefined) dst[key] = {};
      else if (isLeaf(cur)) {
        divergent.push({ token: dotted, fresh: String(cur.$value), shipped: '(group)' });
        continue;
      }
      walk(dst[key] as Record<string, unknown>, node, dotted, srcType);
    }
  };
  walk(tree, shipped, '', typeof shipped.$type === 'string' ? shipped.$type : '');
  added.sort();
  divergent.sort((a, b) => a.token.localeCompare(b.token));
  return { tree, added, divergent };
}

// ---------------------------------------------------------------------------
// Value kinds for minting (§5)
// ---------------------------------------------------------------------------
const rgbaRe = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/;

/** TAILWIND ROUND: deterministic oklch() → sRGB (the OKLab reference
 *  matrices, closed-form, fixed rounding). Tailwind v4 themes are oklch and
 *  Chromium KEEPS the space in computed values — without this, every
 *  Tailwind color is unmintable. MOVED to core/token-set.ts (the foreign-
 *  tokenSet bundle path classifies colors with the same math) — re-exported
 *  here so every existing importer keeps its path; ONE implementation. */
export { oklchToRgba } from '../../core/token-set.js';
import { oklchToRgba } from '../../core/token-set.js';
const pxRe = /^(-?\d+(?:\.\d+)?)px$/;
const numRe = /^\d*\.?\d+$/;

export type Kindled = { kind: MintObservation['kind']; value: string | number } | null;

export function kindOf(prop: string, value: string): Kindled {
  const m = rgbaRe.exec(value);
  if (m) {
    const hex = (x: number) => x.toString(16).padStart(2, '0');
    const a = Number(m[4]);
    const base = `${hex(+m[1])}${hex(+m[2])}${hex(+m[3])}`;
    return { kind: 'color', value: a >= 1 ? base : `${base}${hex(Math.round(a * 255))}` };
  }
  // Tailwind round: oklch computed colors mint as hex through the shared
  // deterministic conversion (same value every run — a pure function).
  const ok = oklchToRgba(value);
  if (ok) {
    const hex = (x: number) => x.toString(16).padStart(2, '0');
    const base = `${hex(ok.r)}${hex(ok.g)}${hex(ok.b)}`;
    return { kind: 'color', value: ok.a >= 1 ? base : `${base}${hex(Math.round(ok.a * 255))}` };
  }
  // v15 (S4): 'none' is a first-class shadow value — a disabled/active plane
  // that CLEARS the shadow is a fact, not an unmintable shape (it minted
  // nothing before, so state shadow-clears fell to the extension block).
  if (prop === 'box-shadow') return { kind: 'shadow', value };
  // v15 (S4/matrix a.3): gradient stacks ride background-image as a minted
  // 'gradient' kind — whole-value string identity, correlated by the same
  // uniform/per-axis/per-pair machinery ('none' is a first-class point: the
  // non-gradient variants of a gradient-bearing axis).
  if (prop === 'background-image' && (value === 'none' || /^(linear|radial|conic)-gradient\(/.test(value))) {
    return { kind: 'gradient', value };
  }
  const px = pxRe.exec(value);
  if (px) return { kind: 'px', value: Number(px[1]) };
  if (numRe.test(value)) return { kind: 'number', value: Number(value) };
  return null;
}

/** Contract channel → computed longhand(s) to check — the verify.ts channel
 *  map, shared verbatim (examples/polaris/scripts/verify.ts COMPUTED). */
export const CHANNEL_TO_COMPUTED: Record<string, string[]> = {
  background: ['background-color'],
  'background-color': ['background-color'],
  color: ['color'],
  fill: ['fill'],
  // Round 5d (owner finding: the canvas Badge radius inspected as a bare 8,
  // no variable): a carried SHORTHAND must cover EVERY constituent longhand.
  // The old single-longhand coverage ('border-radius' → top-left only) left
  // the other three corners UNLABELED, so the mint created sibling leaves
  // (imported.shared.size-8) that overrode the semantic token
  // ({p.border-radius-200}) on three of four corners — same class for
  // border-width, border-color and gap.
  'border-radius': [
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
  ],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'padding-block': ['padding-top', 'padding-bottom'],
  'padding-inline': ['padding-left', 'padding-right'],
  'font-size': ['font-size'],
  'font-weight': ['font-weight'],
  'line-height': ['line-height'],
  'letter-spacing': ['letter-spacing'],
  gap: ['column-gap', 'row-gap'],
  'min-height': ['min-height'],
  'min-width': ['min-width'],
  'box-shadow': ['box-shadow'],
  // v15 (S4 channel lifts): per-corner radii, per-side widths, gradient
  // carriage, and the text channels are carried longhands — identity map.
  'border-top-left-radius': ['border-top-left-radius'],
  'border-top-right-radius': ['border-top-right-radius'],
  'border-bottom-left-radius': ['border-bottom-left-radius'],
  'border-bottom-right-radius': ['border-bottom-right-radius'],
  'border-top-width': ['border-top-width'],
  'border-right-width': ['border-right-width'],
  'border-bottom-width': ['border-bottom-width'],
  'border-left-width': ['border-left-width'],
  'background-image': ['background-image'],
  'font-family': ['font-family'],
  'max-width': ['max-width'],
  'max-height': ['max-height'],
};

// ---------------------------------------------------------------------------
// DOM → anatomy (§4)
// ---------------------------------------------------------------------------
/** Class stems: strip the library's class prefix, THEN drop modifier classes
 *  (a `--` in what REMAINS). A BEM block-root class spelled `Block--root`
 *  (Polaris Text) keeps its block name as the stem — it identifies the
 *  element, unlike value modifiers. Signature = tag + stems (presence/absence
 *  discipline).
 *
 *  ORDER IS LOAD-BEARING — prefix-stripping MUST precede modifier-filtering.
 *  The `--` test encodes "BEM modifier", and that is only true of the part of
 *  the class name the LIBRARY wrote after its own prefix. CARBON is the
 *  library that discovered it: its `classPrefix` is `cds--`, so filtering
 *  first read the PREFIX's own separator as a modifier marker and discarded
 *  EVERY Carbon class — `cds--btn` and `cds--btn__icon` alike. The captured
 *  signature collapsed to `button|` (tag only) while `classes` still carried
 *  `["cds--btn"]`, so union alignment fell back to POSITION and every part
 *  named `part-<path>` instead of by class identity. `classAllow`
 *  (`^cds--(?!.*--)`) had already preserved exactly the right classes; the
 *  engine threw them away one step later, and no config key could override
 *  it. Stripping first, `cds--btn` → `btn` (KEPT) and `cds--btn--primary` →
 *  `btn--primary` (DROPPED, correctly a modifier).
 *
 *  Proven a no-op for every other committed library — MUI `MuiButton-root`,
 *  Polaris `Polaris-Text--root`, Astryx `astryx-*`, Altitude `al-c-button`,
 *  Tailwind (empty prefix) carry no `--` inside their prefixes, so the two
 *  orders agree on all 1,695 of their captured nodes (examples/carbon/
 *  PROVENANCE.md, "the class-stem prefix defect"). */
export const stems = (classes: string[], classPrefix: string): string[] =>
  classes
    .map((c) => (c.endsWith('--root') ? c.slice(0, -'--root'.length) : c))
    .map((c) => (classPrefix && c.startsWith(classPrefix) ? c.slice(classPrefix.length) : c))
    .filter((c) => c !== '' && !c.includes('--'))
    .sort();

export const signature = (n: CapturedNode, classPrefix: string): string =>
  `${n.tag}|${stems(n.classes, classPrefix).join('.')}`;

export interface FlatEl {
  /** DFS path of child-element indices from the root ('' = root). */
  path: string;
  sig: string;
  partName: string;
  node: CapturedNode;
}

export function flatten(root: CapturedNode, classPrefix = ''): FlatEl[] {
  const out: FlatEl[] = [];
  const visit = (n: CapturedNode, p: string) => {
    out.push({ path: p, sig: signature(n, classPrefix), partName: '', node: n });
    let i = 0;
    for (const c of n.nodes) if (c.t === 'el') visit(c.el, p === '' ? String(i++) : `${p}.${i++}`);
  };
  visit(root, '');
  return out;
}

/** Part naming (§4 role classification): root; svg → icon; direct text
 *  holder → label; else dominant class stem (component prefix stripped),
 *  fallback part-<path>. */
export function namePart(el: FlatEl, componentName: string, classPrefix: string): string {
  if (el.path === '') return 'root';
  if (el.node.tag === 'svg') return 'icon';
  const hasText = el.node.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
  if (hasText) return 'label';
  const stem = stems(el.node.classes, classPrefix)[0];
  if (!stem) return `part-${el.path}`;
  const cleaned = stem.replace(new RegExp(`^${componentName}__?`), '').toLowerCase();
  return cleaned || 'root';
}

/** Name every element of a base capture, deduping repeated names. */
export function nameParts(baseFlat: FlatEl[], componentName: string, classPrefix: string): void {
  const seen = new Map<string, number>();
  for (const el of baseFlat) {
    el.partName = namePart(el, componentName, classPrefix);
    const n = seen.get(el.partName) ?? 0;
    seen.set(el.partName, n + 1);
    if (n > 0) el.partName = `${el.partName}-${n + 1}`;
  }
}

// ---------------------------------------------------------------------------
// Prop-space enumeration policy (§1.4)
// ---------------------------------------------------------------------------
export interface EnumAxisSpec {
  /** Canonical prop name. */
  prop: string;
  /** Values in axis order. For a defaultless enum, `unset` names the pseudo-
   *  value that is PREPENDED (S2: unset as a first-class mint-axis value). */
  values: string[];
  unset?: string;
}

export interface StateAxisSpec {
  /** Boolean prop driven as a state (Button `disabled`). Participates as a
   *  2-value axis AND as a state guard (§2). */
  prop: string;
  /** MUST be a member of the closed CONTRACT_STATES vocabulary. The type
   *  alone never protected anything — configs are JSON, cast on read — so
   *  `loadConfig` refuses an out-of-vocabulary value BY NAME (state-plane
   *  projection round). */
  state: ContractState;
}

export interface Combo {
  key: string;
  /** enum-axis prop → value (unset pseudo-values included, e.g. tone 'none'). */
  axisValues: Record<string, string>;
  /** state-prop → boolean flag. */
  stateFlags: Record<string, boolean>;
}

export interface EnumerationResult {
  policy: 'full-cartesian' | 'per-axis+pairwise';
  cartesianSize: number;
  combos: Combo[];
  receipts: string[];
}

const stateSegment = (prop: string, flag: boolean): string =>
  flag ? prop : prop === 'disabled' ? 'enabled' : `no-${prop}`;

export function comboKey(axes: EnumAxisSpec[], stateProps: StateAxisSpec[], axisValues: Record<string, string>, stateFlags: Record<string, boolean>): string {
  return [
    ...axes.map((a) => axisValues[a.prop]),
    ...stateProps.map((s) => stateSegment(s.prop, stateFlags[s.prop])),
  ].join('.');
}

/** Enumerate the prop space per §1.4: full cartesian when ∏|Aᵢ| ≤ limit
 *  (state props count as 2-value axes); above that, per-axis + all pairwise
 *  combinations, with OTHER axes rotated (not pinned) so every pair is
 *  observed in ≥2 third-axis contexts when ≥3 axes exist — the certificate
 *  needs two contexts to prove a ≥3-axis interaction (see
 *  pairwiseCertificate). Deterministic order. */
export function enumerate(
  axes: EnumAxisSpec[],
  stateProps: StateAxisSpec[],
  limit: number,
  baseAxisValues: Record<string, string>,
): EnumerationResult {
  const allAxes: Array<{ prop: string; values: Array<string | boolean>; isState: boolean }> = [
    ...axes.map((a) => ({ prop: a.prop, values: a.values as Array<string | boolean>, isState: false })),
    ...stateProps.map((s) => ({ prop: s.prop, values: [false, true] as Array<string | boolean>, isState: true })),
  ];
  const cartesianSize = allAxes.reduce((n, a) => n * a.values.length, 1);
  const receipts: string[] = [];

  const mk = (assignment: Array<string | boolean>): Combo => {
    const axisValues: Record<string, string> = {};
    const stateFlags: Record<string, boolean> = {};
    allAxes.forEach((a, i) => {
      if (a.isState) stateFlags[a.prop] = assignment[i] as boolean;
      else axisValues[a.prop] = assignment[i] as string;
    });
    return { key: comboKey(axes, stateProps, axisValues, stateFlags), axisValues, stateFlags };
  };

  if (cartesianSize <= limit) {
    const combos: Combo[] = [];
    const rec = (i: number, acc: Array<string | boolean>) => {
      if (i === allAxes.length) { combos.push(mk(acc)); return; }
      for (const v of allAxes[i].values) rec(i + 1, [...acc, v]);
    };
    rec(0, []);
    receipts.push(`enumeration-policy: full cartesian (${cartesianSize} ≤ ${limit})`);
    return { policy: 'full-cartesian', cartesianSize, combos, receipts };
  }

  // per-axis + pairwise (2-covering with rotated third-axis contexts)
  const baseAssign: Array<string | boolean> = allAxes.map((a) =>
    a.isState ? false : (baseAxisValues[a.prop] ?? (a.values[0] as string)),
  );
  const seen = new Map<string, Combo>();
  const push = (assignment: Array<string | boolean>) => {
    const c = mk(assignment);
    if (!seen.has(c.key)) seen.set(c.key, c);
  };
  push(baseAssign);
  allAxes.forEach((a, i) => {
    for (const v of a.values) {
      const row = [...baseAssign];
      row[i] = v;
      push(row);
    }
  });
  for (let i = 0; i < allAxes.length; i++) {
    for (let j = i + 1; j < allAxes.length; j++) {
      let rot = 0;
      for (const vi of allAxes[i].values) {
        for (const vj of allAxes[j].values) {
          // two rotated contexts per pair point (base context + rotated) so
          // the ≥3-axis certificate has two observations of every pair.
          for (const ctx of [0, 1]) {
            const row = allAxes.map((a, k) => {
              if (k === i) return vi;
              if (k === j) return vj;
              if (ctx === 0) return baseAssign[k];
              const vals = a.values;
              const bi = vals.indexOf(baseAssign[k]);
              return vals[(bi + 1 + rot) % vals.length];
            });
            push(row);
          }
          rot++;
        }
      }
    }
  }
  receipts.push(
    `enumeration-policy: per-axis+pairwise (cartesian ${cartesianSize} > ${limit}; ${seen.size} rows; pair points observed in 2 rotated contexts — ≥3-axis interactions are DETECTED and refused by name, never silently valued)`,
  );
  return { policy: 'per-axis+pairwise', cartesianSize, combos: [...seen.values()], receipts };
}

/** The §1.4 certificate: under per-axis+pairwise enumeration, a channel is
 *  representable only if its value is decided by at most two axes. Any pair
 *  point observed in two contexts with DIFFERENT values proves a ≥3-axis
 *  interaction — the channel is refused BY NAME (the correct contract
 *  outcome; pairwise cannot value unvisited ≥3-axis points).
 *
 *  `rows` are (axisValues → observed value) for one part/channel. Returns
 *  refusal reasons ([] = certificate holds). */
export function pairwiseCertificate(
  rows: Array<{ axisValues: Record<string, string>; value: string }>,
  axes: EnumAxisSpec[],
): string[] {
  const refusals: string[] = [];
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const a = axes[i].prop;
      const b = axes[j].prop;
      const byPair = new Map<string, Set<string>>();
      for (const r of rows) {
        const key = `${r.axisValues[a]}|${r.axisValues[b]}`;
        (byPair.get(key) ?? byPair.set(key, new Set()).get(key)!).add(r.value);
      }
      // A pair (a,b) can only explain the channel if every (a,b) point is
      // single-valued across contexts. If NO pair explains it, the channel
      // depends on ≥3 axes jointly.
      if ([...byPair.values()].every((s) => s.size === 1)) return [];
    }
  }
  if (axes.length >= 2) {
    refusals.push(
      'pairwise-inconsistent: no axis pair single-values every observed point — a ≥3-axis interaction exists; channel refused by name (unrepresentable in the contract vocabulary)',
    );
  }
  return refusals;
}
