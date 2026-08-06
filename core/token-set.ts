/**
 * Foreign token sets — the CONTRACTS-BUNDLE `tokenSet` section.
 *
 * The generalization of examples/mui/scripts/build-figma-tokens.mjs (and the
 * tailwind variant) INTO the engine, so a foreign library round is ONE JSON
 * paste — contracts + tokens in a single CONTRACTS-BUNDLE — never a compiled
 * .figma.js script. THE CONTRACT JSON IS THE ONLY THING A USER EVER PASTES.
 *
 * Everything here is pure (payload in, deterministic Plugin-API script text
 * out; zero node:* imports — this module rides the browser core barrel).
 *
 * The tokenSet shape (documented verbatim in parse refusals):
 *
 *   {
 *     "name":   "MUI",                       // Figma variable-collection name
 *     "base":   { "<token>": { "$type": "…", "$value": "…" } },   // flat DTCG
 *     "modes":  { "light": { "<token>": { "$value": "…" } },      // optional
 *                 "dark":  { … } },          // per-mode overrides of base
 *     "minted": { …nested DTCG tree… }       // optional; "{alias}" leaves
 *   }                                        // alias base tokens BY NAME
 *
 * Value policy (deterministic, named classes — never guessed), the exact
 * policy the example scripts established:
 *   color hex/#rgba/rgb()/oklch() → COLOR (per-mode when mode-varying)
 *   dimension px → FLOAT px; rem/em → FLOAT px (×16); number → FLOAT
 *   {alias} (minted layer) → VARIABLE_ALIAS to the named base variable
 *   everything else (font stacks, shadow strings) → STRING
 */
import type { TokenTreeInput } from './tokens.js';

// ---------------------------------------------------------------------------
// Payload shape + referee
// ---------------------------------------------------------------------------

export interface TokenSetPayload {
  /** Figma variable-collection name ("MUI", "Tailwind"). */
  name: string;
  /** Flat DTCG: token name → { $type, $value }. */
  base: Record<string, unknown>;
  /** Optional per-mode value overrides of base (same flat names). */
  modes?: { light?: Record<string, unknown>; dark?: Record<string, unknown> };
  /** Optional minted layer — a NESTED DTCG tree (the `imported.*` spelling);
   *  leaves whose $value is "{alias}" become REAL Figma variable aliases. */
  minted?: Record<string, unknown>;
}

const SHAPE =
  'a tokenSet is { "name": "<collection>", "base": { "<token>": { "$type", "$value" } }, ' +
  '"modes"?: { "light"?, "dark"? }, "minted"?: <nested DTCG tree> } — ds-contracts figma bundle builds one';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Shape referee for a bundle's tokenSet section — refusals name the exact
 *  field AND restate the expected shape (the parse-error documentation). */
export function parseTokenSet(
  raw: unknown,
): { ok: true; tokenSet: TokenSetPayload } | { ok: false; error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `the bundle's "tokenSet" is not an object — ${SHAPE}.` };
  }
  const name = raw.name;
  if (typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: `the tokenSet has no collection "name" (a non-empty string) — ${SHAPE}.` };
  }
  if (!isPlainObject(raw.base)) {
    return { ok: false, error: `the tokenSet "base" must be a flat DTCG object — ${SHAPE}.` };
  }
  // A tokenSet must carry SOME tokens — but they do not all have to be in
  // `base`. A kit that publishes ZERO Figma variables mints every styled fact
  // instead, so its base is legitimately `{}` and its whole vocabulary is the
  // `minted` tree. Requiring a non-empty base refused that shape outright, and
  // it is not a hypothetical: it is Untitled UI, a real Figma Community kit,
  // whose 989 minted leaves are all LITERALS with zero aliases into base — a
  // complete, self-sufficient token set that the plugin can build a collection
  // from. LEDGER §3.4 recorded the resulting refusal as "the largest single
  // refusal for an adopter". Refuse only when there is nothing to sync AT ALL.
  const mintedEmpty =
    raw.minted === undefined || raw.minted === null || (isPlainObject(raw.minted) && Object.keys(raw.minted).length === 0);
  if (Object.keys(raw.base).length === 0 && mintedEmpty) {
    return {
      ok: false,
      error:
        `the tokenSet carries no tokens — "base" is empty and there is no "minted" tree, so there is nothing to sync. ` +
        `A kit with no published Figma variables may ship an empty "base" as long as "minted" holds its vocabulary; ${SHAPE}.`,
    };
  }
  let modes: TokenSetPayload['modes'];
  if (raw.modes !== undefined) {
    if (!isPlainObject(raw.modes)) {
      return { ok: false, error: `the tokenSet "modes" must be an object with "light" and/or "dark" — ${SHAPE}.` };
    }
    const unknown = Object.keys(raw.modes).filter((k) => k !== 'light' && k !== 'dark');
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `the tokenSet "modes" carries unknown mode(s) ${unknown.map((k) => `"${k}"`).join(', ')} — only "light" and "dark" are supported; ${SHAPE}.`,
      };
    }
    for (const m of ['light', 'dark'] as const) {
      const v = (raw.modes as Record<string, unknown>)[m];
      if (v !== undefined && !isPlainObject(v)) {
        return { ok: false, error: `the tokenSet "modes.${m}" must be a flat DTCG object — ${SHAPE}.` };
      }
      // FLAT means flat, and this used to go unchecked. `base` is flattened to
      // dot-path names; a mode object that is still a NESTED tree has no key
      // matching any of them, so every lookup misses and every variable
      // silently keeps its base value — a two-mode collection whose dark mode
      // equals its light mode, reported as a success the whole way down. The
      // shape was documented and unenforced, so the only thing standing
      // between an adopter and a wrong dark mode was the accident that this
      // repo's own mode files happen to be flat. Refuse it by name instead,
      // and name the offending key so the fix is obvious.
      if (isPlainObject(v)) {
        const nested = Object.entries(v).find(
          ([, leaf]) => isPlainObject(leaf) && !('$value' in leaf),
        );
        if (nested !== undefined) {
          return {
            ok: false,
            error:
              `the tokenSet "modes.${m}" is a NESTED DTCG tree — its entry "${nested[0]}" holds a group, not a ` +
              `{ "$value" } leaf. Mode objects must be FLAT and use the SAME dot-path names as "base" ` +
              `(e.g. "color.background.brand"), or every lookup misses and the mode silently renders as base — ` +
              `${SHAPE}.`,
          };
        }
      }
    }
    modes = raw.modes as TokenSetPayload['modes'];
  }
  if (raw.minted !== undefined && !isPlainObject(raw.minted)) {
    return { ok: false, error: `the tokenSet "minted" must be a nested DTCG tree object — ${SHAPE}.` };
  }
  return {
    ok: true,
    tokenSet: {
      name,
      base: raw.base as Record<string, unknown>,
      ...(modes !== undefined ? { modes } : {}),
      ...(raw.minted !== undefined ? { minted: raw.minted as Record<string, unknown> } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Token trees for the emit engine — the CLI's exact layout
// ---------------------------------------------------------------------------

/** The same deep-merge the CLI applies to `--tokens base,minted`
 *  (packages/cli/src/lib.ts): both files land in the `primitives` slot, so
 *  the component emitter resolves refs against base + minted and NOTHING
 *  else — a contract ref outside both keeps the emitter's own named
 *  "Cannot resolve token" refusal. */
const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) {
      deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      a[k] = v;
    }
  }
  return a;
};

/** TokenTreeInput for createFigmaEngine, byte-equivalent to what the CLI
 *  builds for `figma <contracts> --tokens base.dtcg.json,minted.dtcg.json`. */
export function tokenSetTokenTrees(tokenSet: TokenSetPayload): TokenTreeInput {
  const primitives: Record<string, unknown> = {};
  deepMerge(primitives, JSON.parse(JSON.stringify(tokenSet.base)) as Record<string, unknown>);
  if (tokenSet.minted) {
    deepMerge(primitives, JSON.parse(JSON.stringify(tokenSet.minted)) as Record<string, unknown>);
  }
  return { primitives, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
}

// ---------------------------------------------------------------------------
// Value converters (the example scripts' policy, verbatim + oklch)
// ---------------------------------------------------------------------------

/** THE SHARED STEP — OKLab (L, a, b) → sRGB 0–255. oklch IS oklab in polar
 *  form, so both spellings converge here and the reference matrices exist
 *  ONCE. Out-of-gamut clamps channel-wise (the browser's own fallback
 *  behavior for sRGB surfaces). Rounding is fixed (Math.round on 0–255) so
 *  the conversion is a pure function: same value every run. */
function oklabToSrgb255(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
  const lin = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  const gamma = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return { r: Math.round(gamma(lin[0]) * 255), g: Math.round(gamma(lin[1]) * 255), b: Math.round(gamma(lin[2]) * 255) };
}

/** `/ <alpha>` (percent or decimal); absent → 1. Shared by both spellings so
 *  an alpha-modified colour can never lose its alpha in one and keep it in
 *  the other — a scrim painted at FULL opacity is a worse wrong answer than
 *  a named refusal. */
const okAlpha = (raw: string | undefined): number =>
  raw === undefined ? 1 : raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);

/** ONE spelling of a CSS <number>, shared by both colour functions. It is the
 *  CSS grammar's number, not a loose character class: an optional sign, digits
 *  with an optional fraction (or a leading `.`), and an OPTIONAL EXPONENT.
 *  The exponent is not pedantry — `oklab(0.999 8.09e-11 3.72e-8)` is a legal
 *  and reachable value (near-neutral colours land there), and the first cut of
 *  this parser refused it, which is the same class of silent drop the round is
 *  closing. The previous `[\d.]+` also admitted nonsense like `1.2.3`; every
 *  oklch value in the committed corpora parses IDENTICALLY under both. */
const OK_NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const OKLCH_RE = new RegExp(String.raw`^oklch\(\s*(${OK_NUM}%?)\s+(${OK_NUM})\s+(${OK_NUM})(?:deg)?\s*(?:/\s*(${OK_NUM}%?)\s*)?\)$`);
const OKLAB_RE = new RegExp(String.raw`^oklab\(\s*(${OK_NUM}%?)\s+(${OK_NUM})\s+(${OK_NUM})\s*(?:/\s*(${OK_NUM}%?)\s*)?\)$`);

/** Deterministic oklch() → sRGB (the OKLab reference matrices, closed-form,
 *  fixed rounding) — MOVED here from extract/computed/lib.ts (which now
 *  re-exports it) so the browser core carries the one implementation.
 *  Accepts L as % or decimal, optional `/ alpha`. */
export function oklchToRgba(v: string): { r: number; g: number; b: number; a: number } | null {
  const m = OKLCH_RE.exec(v.trim());
  if (!m) return null;
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const H = (parseFloat(m[3]) * Math.PI) / 180;
  return { ...oklabToSrgb255(L, C * Math.cos(H), C * Math.sin(H)), a: okAlpha(m[4]) };
}

/** Deterministic oklab() → sRGB, the CARTESIAN spelling of the same space.
 *
 *  WHY THIS EXISTS: Tailwind v4 compiles every ALPHA-MODIFIED colour utility
 *  (`bg-gray-900/50`) to `color-mix(in oklab, …)`, and Chromium computes that
 *  to an `oklab(L a b / alpha)` value — NOT oklch. Flowbite's Modal scrim is
 *  exactly that shape, and with only the polar spelling accepted the parser
 *  returned null, kindOf() found no kind, and a real painted fact left the
 *  run as `code-only: part-0.background-color — value shape outside mintable
 *  kinds`. The scrim was DROPPED: the overlay rendered fully transparent.
 *
 *  a and b are SIGNED by construction (the two chroma axes straddle zero), so
 *  unlike oklch's C and H every numeric slot here accepts a leading sign. */
export function oklabToRgba(v: string): { r: number; g: number; b: number; a: number } | null {
  const m = OKLAB_RE.exec(v.trim());
  if (!m) return null;
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  return { ...oklabToSrgb255(L, parseFloat(m[2]), parseFloat(m[3])), a: okAlpha(m[4]) };
}

/** Either OKLab spelling → sRGB, or null. The ONE entry point every colour
 *  call site uses, so a new spelling is accepted everywhere at once instead
 *  of in whichever module happened to be edited. Anything that is not one of
 *  these two spellings still returns null and is REFUSED BY NAME downstream —
 *  guessing a colour is the failure this function exists to prevent. */
export function okColorToRgba(v: string): { r: number; g: number; b: number; a: number } | null {
  return oklchToRgba(v) ?? oklabToRgba(v);
}

interface Rgba01 { r: number; g: number; b: number; a: number }

/** hex (#rgb/#rgba/#rrggbb/#rrggbbaa) / rgb() / rgba() / oklch() / oklab() →
 *  0–1 RGBA, or null when the value is not a parseable color (→ STRING). */
function colorOf(v: unknown): Rgba01 | null {
  let s = String(v).trim();
  const ok = okColorToRgba(s);
  if (ok) return { r: ok.r / 255, g: ok.g / 255, b: ok.b / 255, a: ok.a };
  const h3 = /^#([0-9a-f]{3,4})$/i.exec(s);
  if (h3) s = '#' + [...h3[1]].map((c) => c + c).join('');
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255,
      a: m[2] ? parseInt(m[2], 16) / 255 : 1,
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: (p[0] || 0) / 255, g: (p[1] || 0) / 255, b: (p[2] || 0) / 255, a: p[3] === undefined ? 1 : p[3] };
  }
  // hsl()/hsla() — NOT an exotic case. shadcn/ui and Tailwind v3 are hsl-native,
  // so an adopter on either published a `$type: "color"` token that failed every
  // branch above, fell through to null, and was emitted as a Figma STRING
  // variable holding the raw text. `counts` reported a STRING total and never
  // that these were DECLARED COLOURS THAT FAILED TO PARSE, so the adopter got an
  // unbindable STRING where a fill was expected, with nothing naming the cause.
  // Both comma and space syntax; `/ <alpha>` and a 4th comma argument.
  m = /^hsla?\(\s*([^)]+)\)$/i.exec(s);
  if (m) {
    const parts = m[1].split(/[,/]|\s+/).filter(Boolean).map((x) => x.trim());
    // ANGLE UNITS, because parseFloat('0.5turn') is 0.5 DEGREES and the first
    // version of this shipped that as a plausible wrong colour with no receipt
    // — a new instance of the very class this round exists to remove. CSS
    // allows deg (default), turn, rad and grad on the hue.
    const rawH = parts[0];
    const hNum = parseFloat(rawH);
    // `grad` BEFORE `rad` — "200grad" ends with "rad", so testing rad first
    // matched it and returned 11459deg. Suffix tests must run longest-first.
    const h = /turn$/i.test(rawH) ? hNum * 360
      : /grad$/i.test(rawH) ? hNum * 0.9
      : /rad$/i.test(rawH) ? (hNum * 180) / Math.PI
      : hNum;
    const sat = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    if (![h, sat, l].some(Number.isNaN)) {
      const a = parts[3] === undefined ? 1 : (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]));
      const c = (1 - Math.abs(2 * l - 1)) * sat;
      const hp = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      const [r1, g1, b1] =
        hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
      const mm = l - c / 2;
      return { r: r1 + mm, g: g1 + mm, b: b1 + mm, a: Number.isNaN(a) ? 1 : a };
    }
  }
  return null;
}

/** px → px; rem → px (×16); bare number → number; else null (→ STRING). */
function floatOf(v: unknown): number | null {
  let m = /^(-?[\d.]+)px$/.exec(String(v));
  if (m) return parseFloat(m[1]);
  m = /^(-?[\d.]+)rem$/.exec(String(v));
  if (m) return parseFloat(m[1]) * 16;
  m = /^(-?[\d.]+)$/.exec(String(v));
  if (m) return parseFloat(m[1]);
  return null;
}

// ---------------------------------------------------------------------------
// Row compilation (the literal payload the sync script upserts)
// ---------------------------------------------------------------------------

export type TokenSetRow =
  | { name: string; type: 'COLOR'; light: Rgba01; dark: Rgba01 }
  | { name: string; type: 'FLOAT'; light: number; dark: number }
  | { name: string; type: 'STRING'; light: string; dark: string }
  | { name: string; type: 'ALIAS'; target: string };

export interface CompiledTokenSet {
  rows: TokenSetRow[];
  /** Rows per type — the receipt numbers. */
  counts: Record<string, number>;
  aliasCount: number;
  /** `$type: "color"` values no colour syntax could read — emitted as STRING.
   *  A STRING total alone cannot tell these from tokens meant to be text. */
  unparsedColors: string[];
  /** `$type: "dimension"` values no numeric branch could read. */
  unparsedDimensions: string[];
  /** Mode keys matching no base key — their mode silently renders as base. */
  orphanModes: string[];
}

interface TokenSetTextStyle {
  name: string;
  tokenPath: string;
  fontSize: number;
  fontStyle: string;
  sourceStyleKey?: string;
}

const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black',
};

function tokenSetTextStyles(
  tokenSet: TokenSetPayload,
  rows: TokenSetRow[],
): TokenSetTextStyle[] {
  if (!tokenSet.minted) return [];
  const byName = new Map(rows.map((row) => [row.name, row]));
  const out: TokenSetTextStyle[] = [];
  const walk = (node: Record<string, unknown>, prefix: string[]) => {
    for (const [key, raw] of Object.entries(node)) {
      if (key.startsWith('$') || !raw || typeof raw !== 'object') continue;
      const value = raw as Record<string, unknown>;
      const next = [...prefix, key];
      if ('$value' in value) {
        const identity = (
          value.$extensions as
            | { dsContracts?: { textStyle?: { name?: unknown; key?: unknown } } }
            | undefined
        )?.dsContracts?.textStyle;
        if (typeof identity?.name !== 'string') continue;
        // font-size leaf, or an axis value under font-size
        // (imported/avatar/text/font-size/xl).
        const leaf = next[next.length - 1];
        const parent = next[next.length - 2];
        const isFontSizeLeaf = leaf === 'font-size';
        const isFontSizeAxisLeaf = parent === 'font-size';
        if (!isFontSizeLeaf && !isFontSizeAxisLeaf) continue;
        const slashPath = next.join('/');
        const sizeRow = byName.get(slashPath);
        if (!sizeRow || sizeRow.type !== 'FLOAT') continue;
        const groupPrefix = isFontSizeAxisLeaf
          ? next.slice(0, -2)
          : next.slice(0, -1);
        const weightRow = byName.get([...groupPrefix, 'font-weight'].join('/'));
        const weight =
          weightRow?.type === 'FLOAT' ? weightRow.light : 500;
        out.push({
          name: identity.name,
          tokenPath: next.join('.'),
          fontSize: sizeRow.light,
          fontStyle: FONT_STYLE_BY_WEIGHT[weight] ?? 'Medium',
          ...(typeof identity.key === 'string'
            ? { sourceStyleKey: identity.key }
            : {}),
        });
      } else {
        walk(value, next);
      }
    }
  };
  walk(tokenSet.minted, []);
  // One canvas style per name; prefer imported.text.* as the upsert marker.
  return prioritizeSharedTextStyles(out).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
}

/** Keep one TokenSetTextStyle per name, preferring imported.text.* tokenPath.
 *  Same name with conflicting size/weight fails closed — never silently win. */
function prioritizeSharedTextStyles(
  styles: TokenSetTextStyle[],
): TokenSetTextStyle[] {
  const byName = new Map<string, TokenSetTextStyle>();
  const rank = (t: TokenSetTextStyle) =>
    t.tokenPath.startsWith('imported.text.') ? 0 : 1;
  for (const s of [...styles].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.tokenPath < b.tokenPath ? -1 : a.tokenPath > b.tokenPath ? 1 : 0),
  )) {
    const prev = byName.get(s.name);
    if (!prev) {
      byName.set(s.name, s);
      continue;
    }
    if (prev.fontSize !== s.fontSize || prev.fontStyle !== s.fontStyle) {
      throw new Error(
        `text-style-identity-refused: text style ${JSON.stringify(s.name)} has conflicting definitions ` +
          `(${prev.fontSize}px/${prev.fontStyle} via ${prev.tokenPath} vs ${s.fontSize}px/${s.fontStyle} via ${s.tokenPath})`,
      );
    }
    if (rank(s) < rank(prev)) byName.set(s.name, s);
    else if (!prev.sourceStyleKey && s.sourceStyleKey) {
      prev.sourceStyleKey = s.sourceStyleKey;
    }
  }
  return [...byName.values()];
}

/** Classify every base + minted token into the upsert payload — the exact
 *  two-block ordering (base sorted, then minted sorted) the example scripts
 *  emit, so a bundle-driven sync and a script-driven sync land the SAME
 *  variables. */
export function compileTokenSetRows(tokenSet: TokenSetPayload): CompiledTokenSet {
  const base = tokenSet.base as Record<string, { $type?: unknown; $value?: unknown }>;
  const light = (tokenSet.modes?.light ?? {}) as Record<string, { $value?: unknown }>;
  const dark = (tokenSet.modes?.dark ?? {}) as Record<string, { $value?: unknown }>;

  // minted layer → flat slash-paths (the emitters' Figma variable spelling)
  const mintedFlat: Record<string, { $value?: unknown }> = {};
  const walk = (node: Record<string, unknown>, prefix: string[]): void => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object' && '$value' in (v as Record<string, unknown>)) {
        mintedFlat[[...prefix, k].join('/')] = v as { $value?: unknown };
      } else if (v && typeof v === 'object') {
        walk(v as Record<string, unknown>, [...prefix, k]);
      }
    }
  };
  if (tokenSet.minted) walk(tokenSet.minted, []);

  const rows: TokenSetRow[] = [];
  const unparsedColors: string[] = [];
  const unparsedDimensions: string[] = [];
  // base first (alias targets must exist before minted alias rows apply —
  // the script does two passes, but ordering keeps the payload readable)
  for (const dotName of Object.keys(base).sort()) {
    const entry = base[dotName];
    // Figma variable names spell dot-paths with slashes (the emitters'
    // convention: the sync runtime binds `p.color-x` as `p/color-x`).
    // Dot-less names (MUI/Tailwind/Astryx wraps) pass through unchanged —
    // this fires only for nested-tree wraps like Polaris (live gate finding:
    // Missing variable p/color-avatar-one-bg-fill).
    const name = dotName.split('.').join('/');
    const lv = String(light[dotName]?.$value ?? entry.$value);
    const dv = String(dark[dotName]?.$value ?? entry.$value);
    const lc = colorOf(lv);
    const dc = colorOf(dv);
    if (entry.$type === 'color' && lc && dc) {
      rows.push({ name, type: 'COLOR', light: lc, dark: dc });
      continue;
    }
    const lf = floatOf(lv);
    const df = floatOf(dv);
    if (entry.$type !== 'color' && lf !== null && df !== null) {
      rows.push({ name, type: 'FLOAT', light: lf, dark: df });
      continue;
    }
    // A DECLARED COLOUR THAT REACHES HERE DID NOT PARSE. Downgrading it to a
    // STRING variable is not carriage — the adopter gets an unbindable STRING
    // where a fill was expected, and `counts` reports only a STRING total, so
    // nothing distinguishes it from a token that was always meant to be text.
    // Same for a `dimension` that no numeric branch could read. Count and name
    // them; STRING stays the payload so nothing is dropped, but the shape is
    // no longer reported as if it were intended.
    if (entry.$type === 'color') {
      unparsedColors.push(`${name} = ${lv}`);
    } else if (entry.$type === 'dimension') {
      unparsedDimensions.push(`${name} = ${lv}`);
    }
    rows.push({ name, type: 'STRING', light: lv, dark: dv });
  }
  // MODE KEYS THAT MATCH NO BASE KEY. The loop above walks `Object.keys(base)`
  // and looks each mode up by that name, so a mode entry whose key is spelled
  // differently (slash vs dot) or that exists ONLY in dark is never visited —
  // and the dark mode silently renders as light. parseTokenSet already refuses
  // a NESTED mode tree with exactly that reasoning ("every lookup misses and
  // the mode silently renders as base"); it never checked MEMBERSHIP, which
  // produces the identical outcome by a different route.
  const orphanModes = [
    ...Object.keys(light).filter((k) => !(k in base)).map((k) => `light:${k}`),
    ...Object.keys(dark).filter((k) => !(k in base)).map((k) => `dark:${k}`),
  ];
  let aliasCount = 0;
  for (const name of Object.keys(mintedFlat).sort()) {
    const v = String(mintedFlat[name].$value);
    const am = /^\{(.+)\}$/.exec(v);
    if (am) {
      // The alias TARGET follows the same spelling rule as the base rows
      // above: dot-paths become slashes, because the runtime resolves targets
      // through the `existing` map, which is keyed by VARIABLE NAME. Dot-less
      // targets (MUI/Tailwind flat wraps) pass through unchanged — this fires
      // only for nested-tree wraps (polaris `{p.color-icon-caution}`, the
      // task-#26 round's live gate finding, the exact sibling of 7b02b42's
      // base-name fix).
      rows.push({ name, type: 'ALIAS', target: am[1].split('.').join('/') });
      aliasCount++;
      continue;
    }
    const c = colorOf(v);
    if (c) {
      rows.push({ name, type: 'COLOR', light: c, dark: c });
      continue;
    }
    const f = floatOf(v);
    if (f !== null) {
      rows.push({ name, type: 'FLOAT', light: f, dark: f });
      continue;
    }
    rows.push({ name, type: 'STRING', light: v, dark: v });
  }
  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.type] = (a[r.type] ?? 0) + 1), a), {});
  return { rows, counts, aliasCount, unparsedColors, unparsedDimensions, orphanModes };
}

// ---------------------------------------------------------------------------
// The sync script (the example scripts' runtime, parameterized)
// ---------------------------------------------------------------------------

/** tokenSet → deterministic Figma Plugin-API script text: one collection
 *  named tokenSet.name, Light/Dark modes, TWO-PASS upsert (concrete values,
 *  then Figma-NATIVE VARIABLE ALIASES for the minted {alias} leaves) —
 *  re-run safe. Run BEFORE the component scripts; they bind by name. */
export function emitTokenSetScript(tokenSet: TokenSetPayload, fileKey: string | null): string {
  const { rows, aliasCount, unparsedColors, unparsedDimensions, orphanModes } = compileTokenSetRows(tokenSet);
  const textStyles = tokenSetTextStyles(tokenSet, rows);
  const col = tokenSet.name;
  // THE RECEIPTS RIDE THE ARTIFACT. A count returned by compileTokenSetRows and
  // read by nobody is the same silent loss one layer up, so the three classes
  // that used to vanish are stamped into the script an adopter actually opens.
  const caveats = [
    unparsedColors.length > 0
      ? `// ⚠ ${unparsedColors.length} token(s) DECLARED $type "color" that no colour syntax could read — emitted as STRING\n` +
        `//   variables, which cannot bind to a fill: ${unparsedColors.slice(0, 6).join(', ')}${unparsedColors.length > 6 ? ', …' : ''}`
      : '',
    unparsedDimensions.length > 0
      ? `// ⚠ ${unparsedDimensions.length} token(s) DECLARED $type "dimension" that no numeric branch could read — emitted as\n` +
        `//   STRING: ${unparsedDimensions.slice(0, 6).join(', ')}${unparsedDimensions.length > 6 ? ', …' : ''}`
      : '',
    orphanModes.length > 0
      ? `// ⚠ ${orphanModes.length} MODE key(s) match no base token, so their override never applies and that mode\n` +
        `//   renders as base: ${orphanModes.slice(0, 6).join(', ')}${orphanModes.length > 6 ? ', …' : ''}`
      : '',
  ].filter(Boolean).join('\n');
  return `// GENERATED by the ds-contracts engine from a CONTRACTS-BUNDLE tokenSet — DO NOT EDIT.
// Deterministic variable UPSERT (re-run safe): one ${JSON.stringify(col)} collection,
// Light/Dark modes, ${rows.length} variables (${aliasCount} Figma-native aliases from
// the library's own token references). Runs BEFORE the component scripts.
${caveats ? `${caveats}\n` : ''}
const TOKENS = ${JSON.stringify(rows)};
const TEXT_STYLES = ${JSON.stringify(textStyles)};

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();
let col = collections.find((c) => c.name === ${JSON.stringify(col)});
if (!col) col = figma.variables.createVariableCollection(${JSON.stringify(col)});
let lightId = col.modes[0].modeId;
col.renameMode(lightId, 'Light');
let darkMode = col.modes.find((m) => m.name === 'Dark');
const darkId = darkMode ? darkMode.modeId : col.addMode('Dark');
const existing = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === col.id) existing.set(v.name, v);
}
let created = 0, updated = 0;
// pass 1: create/refresh every variable with concrete values
for (const t of TOKENS) {
  if (t.type === 'ALIAS') continue;
  let v = existing.get(t.name);
  if (!v) { v = figma.variables.createVariable(t.name, col, t.type); existing.set(t.name, v); created++; } else { updated++; }
  v.setValueForMode(lightId, t.light);
  v.setValueForMode(darkId, t.dark);
}
// pass 2: minted aliases — REAL variable aliases to the base tokens the
// library's own source named (they inherit the target's Light/Dark values)
let aliased = 0;
for (const t of TOKENS) {
  if (t.type !== 'ALIAS') continue;
  const target = existing.get(t.target);
  if (!target) throw new Error('token sync: alias target missing: ' + t.target + ' (for ' + t.name + ')');
  let v = existing.get(t.name);
  const resolvedType = target.resolvedType;
  if (!v) { v = figma.variables.createVariable(t.name, col, resolvedType); existing.set(t.name, v); created++; } else { updated++; }
  const alias = figma.variables.createVariableAlias(target);
  v.setValueForMode(lightId, alias);
  v.setValueForMode(darkId, alias);
  aliased++;
}
const localTextStyles = await figma.getLocalTextStylesAsync();
const styleByToken = {};
for (const s of localTextStyles) {
  const token = s.getSharedPluginData('ds_contracts', 'textStyleToken');
  if (token) styleByToken[token] = s;
}
let createdStyles = 0;
for (const t of TEXT_STYLES) {
  let s = styleByToken[t.tokenPath];
  if (!s) {
    s = figma.createTextStyle();
    s.setSharedPluginData('ds_contracts', 'textStyleToken', t.tokenPath);
    styleByToken[t.tokenPath] = s;
    createdStyles++;
  }
  if (t.sourceStyleKey) {
    s.setSharedPluginData('ds_contracts', 'sourceTextStyleKey', t.sourceStyleKey);
  }
  await figma.loadFontAsync({ family: 'Inter', style: t.fontStyle });
  s.name = t.name;
  s.fontName = { family: 'Inter', style: t.fontStyle };
  s.fontSize = t.fontSize;
}
figma.notify(${JSON.stringify(col)} + ' tokens: ' + created + ' created, ' + updated + ' updated (' + TOKENS.length + ' total, ' + aliased + ' aliases, Light/Dark; ' + createdStyles + ' text styles created)');
return { created, updated, aliased, total: TOKENS.length, textStyles: TEXT_STYLES.length, createdStyles };
`;
}
