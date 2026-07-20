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
import { flattenTokens } from './tokens.js';

/** Every minted path lives under this namespace — the receipt's invariant
 *  that no minted name can be mistaken for a semantic token. */
export const MINT_NAMESPACE = 'imported';

/** A literal repeated at this many usage sites dedupes into a shared leaf. */
export const MINT_SHARE_THRESHOLD = 3;

export interface MintOccurrence {
  /** Figma variant name ("Variant=Info", "Tone=Neutral, Size=Sm"). */
  variant: string;
  /** enum-axis propName → canonical (camelCase) value for this variant.
   *  Boolean axes are excluded — token substitution is enum-only. */
  axisValues: Record<string, string>;
  value: string | number;
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
   *  'gradient' → a CSS gradient value or 'none' (v15/S4 — background-image
   *  carriage; CSS surfaces render it verbatim, the canvas emitter parses
   *  linear-gradient stops into a native GRADIENT_LINEAR paint). */
  kind: 'color' | 'px' | 'number' | 'shadow' | 'gradient';
  /** One entry per variant the node occurs in. */
  occurrences: MintOccurrence[];
}

export interface MintAxis {
  /** Canonical enum prop name ("placement"). */
  propName: string;
  /** Canonical (camelCase) values, in axis order — substitution expands over
   *  ALL of them, so a per-variant mint must cover every one. */
  values: string[];
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
}

export interface MintedBinding {
  nodePath: string;
  cssProperty: string;
  /** The ref to bind — a leaf ref or an axis-substituted ref; null when the
   *  values do not correlate with any enum axis (nothing minted). */
  ref: string | null;
  /** Review-note text when ref is null. */
  reason?: string;
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
      : String(value);

const DTCG_TYPE: Record<MintKind, string> = {
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
  | { kind: 'variant2'; axes: [MintAxis, MintAxis]; byValue: Map<string, string | number> }
  | { kind: 'variant3'; axes: [MintAxis, MintAxis, MintAxis]; byValue: Map<string, string | number> }
  | { kind: 'none'; reason: string };

/** Key for a multi-axis value combination — '.'-joined because the leaf path
 *  appends it verbatim ('primary.hover' under the group base). */
const pairKey = (a: string, b: string) => `${a}.${b}`;
const comboKey = (values: string[]) => values.join('.');

function classify(obs: MintObservation, axes: MintAxis[]): Classified {
  if (obs.occurrences.length === 0) return { kind: 'none', reason: 'no occurrences observed — nothing minted' };
  const values = obs.occurrences.map((o) => o.value);
  if (values.every((v) => v === values[0])) return { kind: 'uniform', value: values[0] };
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
    // fabricate a dangling reference.
    if (fits && axis.values.every((v) => byValue.has(v))) {
      return { kind: 'variant', axis, byValue };
    }
  }
  // Two-axis correlation — ROOT tokens only (the emitters render a
  // two-placeholder ref as compound enum classes on the root; nested parts
  // support a single substitution, so a nested two-axis value stays a named
  // refusal). Axis order = discovery order, deterministic; every combination
  // of the two axes' values must be observed with a single value — the
  // emitters expand a two-placeholder root ref over the full cartesian.
  if (obs.part !== '') {
    return {
      kind: 'none',
      reason: 'resolved values differ across variants without correlating to any variant axis — nothing minted; bind manually',
    };
  }
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const [a, b] = [axes[i], axes[j]];
      const byValue = new Map<string, string | number>();
      let fits = true;
      for (const o of obs.occurrences) {
        const va = o.axisValues[a.propName];
        const vb = o.axisValues[b.propName];
        if (va === undefined || vb === undefined) { fits = false; break; }
        const key = pairKey(va, vb);
        const seen = byValue.get(key);
        if (seen !== undefined && seen !== o.value) { fits = false; break; }
        byValue.set(key, o.value);
      }
      if (fits && a.values.every((va) => b.values.every((vb) => byValue.has(pairKey(va, vb))))) {
        return { kind: 'variant2', axes: [a, b], byValue };
      }
    }
  }
  // Three-axis correlation (live-gauntlet class ① — CBDS Chip's root fill is
  // f(type, style, state), irreducible to any pair): same rules as the pair
  // case — ROOT tokens only, discovery order, full cartesian coverage with a
  // single value per combination. The emitters expand a three-placeholder
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
        if (
          fits &&
          triple[0].values.every((va) =>
            triple[1].values.every((vb) =>
              triple[2].values.every((vc) => byValue.has(comboKey([va, vb, vc]))),
            ),
          )
        ) {
          return { kind: 'variant3', axes: triple, byValue };
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

export function mintTokens(
  component: string,
  observations: MintObservation[],
  axes: MintAxis[],
): MintResult {
  const comp = sanitizeSegment(component);
  const classified = observations.map((o) => classify(o, axes));

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
  const leaves = new Map<string, MintedEntry & { type: string }>();
  /** A leaf may not sit on another leaf's path (a group under a leaf, or a
   *  leaf on a group's prefix, would corrupt the DTCG tree). */
  const hasDescendants = (path: string) => [...leaves.keys()].some((k) => k.startsWith(`${path}.`));
  const claim = (
    wantedPath: string,
    kind: MintKind,
    value: string | number,
    usageSite: string,
  ): string => {
    const formatted = formatValue(kind, value);
    for (let n = 1; ; n++) {
      const path = n === 1 ? wantedPath : `${wantedPath}-${n}`;
      const existing = leaves.get(path);
      if (!existing) {
        if (hasDescendants(path)) continue;
        leaves.set(path, { ref: `{${path}}`, value: formatted, usageSites: [usageSite], type: DTCG_TYPE[kind] });
        return path;
      }
      if (existing.value === formatted) {
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
    const base = `${MINT_NAMESPACE}.${comp}.${partSegment(obs.part)}.${obs.cssProperty}`;
    const site = `${obs.nodePath} ${obs.cssProperty}`;
    if (c.kind === 'uniform') {
      const key = `${obs.kind}|${formatValue(obs.kind, c.value)}`;
      const wanted =
        (siteCount.get(key) ?? 0) >= MINT_SHARE_THRESHOLD
          ? `${MINT_NAMESPACE}.shared.${sharedName(obs.kind, c.value)}`
          : base;
      const path = claim(wanted, obs.kind, c.value, site);
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
      for (const [key, value] of c.byValue) {
        claim(`${groupBase}.${key}`, obs.kind, value, `${site} (${siteSuffix(key)})`);
      }
      return {
        nodePath: obs.nodePath,
        cssProperty: obs.cssProperty,
        ref: `{${groupBase}.${axisProps.map((p) => `{${p}}`).join('.')}}`,
      };
    }
  });

  // Leaves → nested DTCG tree (each leaf carries its claim's $type).
  const tree: Record<string, unknown> = {};
  for (const [path, entry] of leaves) {
    const segs = path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) {
      node = (node[seg] ??= {}) as Record<string, unknown>;
    }
    node[segs[segs.length - 1]] = { $value: entry.value, $type: entry.type };
  }

  return {
    tree,
    count: leaves.size,
    entries: [...leaves.values()].map(({ ref, value, usageSites }) => ({ ref, value, usageSites })),
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
  const lines = [':root {'];
  for (const [path, entry] of flattenTokens(tree)) {
    lines.push(`  --${path.split('.').join('-')}: ${String(entry.value)};`);
  }
  lines.push('}');
  return lines.join('\n');
}
