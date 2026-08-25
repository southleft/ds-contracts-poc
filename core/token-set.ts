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
  /** Optional LAYERED form (additive, 2026-08-22): the repo's own tokens/
   *  layout — primitives + brand.<name> + semantic + light/dark modes — as
   *  the nested DTCG trees `figma bundle --tokens <dir|slot=file,…>` routed
   *  them. When present, the compile engine resolves contract refs through
   *  primitives → brand.default → semantic → light (the same order
   *  core/emit-tokens-css.ts layers `:root`), and the plugin's tokens step
   *  upserts the Primitives / Brand / Semantic collections (Light/Dark,
   *  one Brand mode per brand) instead of one flat named collection.
   *  Absent → the flat base+minted path, byte-identical to before. */
  layers?: TokenTreeInput;
}

const SHAPE =
  'a tokenSet is { "name": "<collection>", "base": { "<token>": { "$type", "$value" } }, ' +
  '"modes"?: { "light"?, "dark"? }, "minted"?: <nested DTCG tree>, ' +
  '"layers"?: { "primitives", "semantic", "light", "dark", "brands": { "default", … } } (nested DTCG trees) } — ds-contracts figma bundle builds one';

const LAYER_SLOTS = ['primitives', 'semantic', 'light', 'dark'] as const;

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
  // A LAYERED set may keep `base` empty too — its vocabulary is the layers.
  const layersEmpty =
    !isPlainObject(raw.layers) ||
    Object.values(raw.layers).every(
      (v) => !isPlainObject(v) || Object.values(v).every((t) => !isPlainObject(t) || Object.keys(t).length === 0),
    );
  if (Object.keys(raw.base).length === 0 && mintedEmpty && layersEmpty) {
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
  // The LAYERED form. Every slot is a nested DTCG tree (an absent slot is
  // `{}`); `brands` is a map of brand name → tree and must carry "default"
  // when any brand does — the compile resolves through brand.default, so a
  // brand map without it would silently resolve nothing.
  let layers: TokenTreeInput | undefined;
  if (raw.layers !== undefined && raw.layers !== null) {
    if (!isPlainObject(raw.layers)) {
      return { ok: false, error: `the tokenSet "layers" must be an object of nested DTCG trees — ${SHAPE}.` };
    }
    const L = raw.layers;
    for (const slot of LAYER_SLOTS) {
      if (L[slot] !== undefined && !isPlainObject(L[slot])) {
        return { ok: false, error: `the tokenSet "layers.${slot}" must be a nested DTCG tree object — ${SHAPE}.` };
      }
    }
    const brands: Record<string, Record<string, unknown>> = {};
    if (L.brands !== undefined) {
      if (!isPlainObject(L.brands)) {
        return { ok: false, error: `the tokenSet "layers.brands" must be an object of brand name → nested DTCG tree — ${SHAPE}.` };
      }
      for (const [brand, tree] of Object.entries(L.brands)) {
        if (!isPlainObject(tree)) {
          return { ok: false, error: `the tokenSet "layers.brands.${brand}" must be a nested DTCG tree object — ${SHAPE}.` };
        }
        brands[brand] = tree;
      }
      if (Object.keys(brands).length > 0 && !('default' in brands)) {
        return {
          ok: false,
          error:
            `the tokenSet "layers.brands" carries ${Object.keys(brands).map((b) => `"${b}"`).join(', ')} but no "default" — ` +
            `contracts resolve through brand.default, so a brand map must name it; ${SHAPE}.`,
        };
      }
    }
    layers = {
      primitives: (L.primitives as Record<string, unknown> | undefined) ?? {},
      semantic: (L.semantic as Record<string, unknown> | undefined) ?? {},
      light: (L.light as Record<string, unknown> | undefined) ?? {},
      dark: (L.dark as Record<string, unknown> | undefined) ?? {},
      brands: 'default' in brands ? brands : { default: {}, ...brands },
    };
  }
  return {
    ok: true,
    tokenSet: {
      name,
      base: raw.base as Record<string, unknown>,
      ...(modes !== undefined ? { modes } : {}),
      ...(raw.minted !== undefined ? { minted: raw.minted as Record<string, unknown> } : {}),
      ...(layers !== undefined ? { layers } : {}),
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

/** True when the tokenSet carries the LAYERED form (primitives / brand /
 *  semantic / modes) rather than one flat base. */
export const isLayeredTokenSet = (tokenSet: TokenSetPayload): boolean => tokenSet.layers !== undefined;

/** TokenTreeInput for createFigmaEngine, byte-equivalent to what the CLI
 *  builds for `figma <contracts> --tokens base.dtcg.json,minted.dtcg.json` —
 *  or, for a LAYERED tokenSet, the routed slots exactly as `--tokens <dir>`
 *  loads them, so a `{brand.*}` ref and a mode-only `{color.action.*}` ref
 *  resolve the way the repo's own CSS build resolves them. */
export function tokenSetTokenTrees(tokenSet: TokenSetPayload): TokenTreeInput {
  if (tokenSet.layers) {
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
    const brands = clone(tokenSet.layers.brands ?? {});
    if (!brands.default) brands.default = {};
    return {
      primitives: clone(tokenSet.layers.primitives ?? {}),
      semantic: clone(tokenSet.layers.semantic ?? {}),
      light: clone(tokenSet.layers.light ?? {}),
      dark: clone(tokenSet.layers.dark ?? {}),
      brands,
    };
  }
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

/** hex (#rgb/#rgba/#rrggbb/#rrggbbaa) / rgb() / rgba() / oklch() / oklab() /
 *  hsl() / hsla() → 0–1 RGBA, or null when the value is not a parseable color
 *  (→ STRING).
 *
 *  RC3 (burn-down round 2): EXPORTED as `cssColorToRgba01`, because
 *  core/emit-figma-script.ts carried a SECOND, NARROWER reader of the same
 *  thing (`parseLitColor`: hex + rgb() only) and `parseShadowStack`'s layer
 *  matcher was narrower still. An unreadable LAYER refuses the WHOLE stack by
 *  design, so `oklab(0.708 0 0 / 0.5) 0 0 0 3px` — shadcn's focus ring, and
 *  the spelling every Tailwind v4 adopter computes to — deleted the elevation
 *  layers beside it and the focus preview minted byte-identical to the resting
 *  cell. One entry point, so a new colour spelling is accepted everywhere at
 *  once instead of in whichever module happened to be edited. */
export function cssColorToRgba01(v: unknown): Rgba01 | null {
  return colorOf(v);
}

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
  /** Tokens whose `$value` is not a string or number (DTCG object-form
   *  shadow/typography/border composites, arrays, booleans, null) — NOT
   *  compiled into a row. `String()` on these yields "[object Object]", which
   *  used to ship as a STRING variable that draws nothing. Each entry is
   *  `<variable name>: <shape>`. */
  unsupportedValues: string[];
}

/** The shape of a `$value` no Figma variable can hold, or null when it is a
 *  string/number (the only two shapes the converters below read). Named so a
 *  refusal says what was there, not just that something was. */
function unsupportedValueShape(v: unknown): string | null {
  if (typeof v === 'string' || typeof v === 'number') return null;
  if (v === undefined) return 'no $value';
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}]` + (v.length > 0 && isPlainObject(v[0]) ? ` of {${Object.keys(v[0]).join(', ')}}` : '');
  if (typeof v === 'object') return `object-form {${Object.keys(v as object).join(', ')}}`;
  return typeof v;
}

/** Every token in a tokenSet whose `$value` (base, light, dark or minted) is
 *  not a string/number, as `<variable name>: <shape>` — the bundle-time
 *  (CLI) refusal list. Empty means every value is a shape a variable holds. */
export function unsupportedTokenValues(tokenSet: TokenSetPayload): string[] {
  return compileTokenSetRows(tokenSet).unsupportedValues;
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
  const unsupportedValues: string[] = [];
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
    // A composite (DTCG shadow/typography object, an array of layers, a
    // boolean, null) has no Figma variable shape. `String()` turned it into
    // "[object Object]" / "[object Object],[object Object]" and that text
    // shipped as a STRING variable — a token that draws nothing and is
    // reported as synced. Refuse BY NAME (and by shape) and compile no row.
    const rawL = light[dotName]?.$value ?? entry.$value;
    const rawD = dark[dotName]?.$value ?? entry.$value;
    const badShape = unsupportedValueShape(rawL) ?? unsupportedValueShape(rawD);
    if (badShape !== null) {
      unsupportedValues.push(`${name}: ${badShape}`);
      continue;
    }
    const lv = String(rawL);
    const dv = String(rawD);
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
    const mintedShape = unsupportedValueShape(mintedFlat[name].$value);
    if (mintedShape !== null) {
      unsupportedValues.push(`${name}: ${mintedShape}`);
      continue;
    }
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
  return { rows, counts, aliasCount, unparsedColors, unparsedDimensions, orphanModes, unsupportedValues };
}

/** Plugin-API runtime shared by bundle tokenSet apply and first-party
 *  Primitives/Brand/Semantic apply. Caller must bind `owned` to a
 *  `Map<collectionId, Set<variableName>>` of collections this script owns.
 *  Declares `pruned` (number), `leftovers` (string[] of names) and
 *  `pruneSkipped` (string | null). OPT-IN: nothing is removed unless
 *  `globalThis.DS_PRUNE_TOKENS === true` — by default the leftovers are
 *  counted and NAMED, not deleted. `FC-APPLY-TOKENS-NOT-PRUNED`. */
export function ownedCollectionPruneRuntime(): string {
  return `// FC-APPLY-TOKENS-NOT-PRUNED — leftover variables in owned collections
// only; other collections are untouched (FC-THEME-ISO).
// OPT-IN. Set globalThis.DS_PRUNE_TOKENS = true before running this script
// to DELETE leftovers. Without it nothing is removed: the leftovers are
// counted and named in the result (leftovers; pruned stays 0) so the loss is visible,
// not silent. With the flag on, a leftover a scene node still binds, a local
// paint/text/effect/grid STYLE still binds, or any local variable still
// aliases, stays. The Plugin API cannot see consumers in OTHER files (a
// published library's instances), so those are NOT protected — which is why
// the door is closed by default (docs/23-known-limitations.md §B.23).
const DS_PRUNE_TOKENS = typeof globalThis !== 'undefined' && globalThis.DS_PRUNE_TOKENS === true;
await figma.loadAllPagesAsync();
const referenced = new Set();
const collectAlias = (x) => {
  if (!x) return;
  if (Array.isArray(x)) { for (const y of x) collectAlias(y); return; }
  if (typeof x === 'object') {
    if (typeof x.id === 'string' && (x.type === 'VARIABLE_ALIAS' || x.type === 'VARIABLE')) referenced.add(x.id);
    else for (const k in x) collectAlias(x[k]);
  }
};
for (const page of figma.root.children) {
  for (const n of page.findAll(() => true)) {
    collectAlias(n.boundVariables);
    if (Array.isArray(n.fills)) for (const p of n.fills) collectAlias(p && p.boundVariables);
    if (Array.isArray(n.strokes)) for (const p of n.strokes) collectAlias(p && p.boundVariables);
  }
}
// Style-bound variables: paints[].boundVariables, style.boundVariables,
// effects[].boundVariables, layoutGrids[].boundVariables. Every reader the
// runtime has is walked (so the named leftovers are accurate either way); a
// runtime missing any of the four cannot protect them, so with the flag on
// it does not prune at all and says why.
const STYLE_READERS = ['getLocalPaintStylesAsync', 'getLocalTextStylesAsync', 'getLocalEffectStylesAsync', 'getLocalGridStylesAsync'];
const missingStyleReaders = STYLE_READERS.filter((k) => typeof figma[k] !== 'function');
for (const k of STYLE_READERS) {
  if (missingStyleReaders.includes(k)) continue;
  for (const s of await figma[k]()) {
    collectAlias(s.boundVariables);
    if (Array.isArray(s.paints)) for (const p of s.paints) collectAlias(p && p.boundVariables);
    if (Array.isArray(s.effects)) for (const e of s.effects) collectAlias(e && e.boundVariables);
    if (Array.isArray(s.layoutGrids)) for (const g of s.layoutGrids) collectAlias(g && g.boundVariables);
  }
}
let pruneSkipped = null;
if (DS_PRUNE_TOKENS && missingStyleReaders.length > 0) {
  pruneSkipped = 'prune skipped: this runtime lacks figma.' + missingStyleReaders.join(', figma.') + ' so style-bound variables could not be protected';
}
const willPrune = DS_PRUNE_TOKENS && !pruneSkipped;
const leftovers = [];
const dropped = new Set(); // dry run: ids treated as gone so alias chains unwind the same way
for (let pass = 0; pass < 8; pass++) {
  const locals = (await figma.variables.getLocalVariablesAsync()).filter((v) => !dropped.has(v.id));
  const aliasTargets = new Set();
  for (const v of locals) {
    const modes = v.valuesByMode || {};
    for (const modeId in modes) {
      const val = modes[modeId];
      if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS' && val.id) aliasTargets.add(val.id);
    }
  }
  let droppedThisPass = 0;
  for (const v of locals) {
    const keep = owned.get(v.variableCollectionId);
    if (!keep) continue;
    if (keep.has(v.name)) continue;
    if (referenced.has(v.id)) continue;
    if (aliasTargets.has(v.id)) continue;
    leftovers.push(v.name);
    dropped.add(v.id);
    droppedThisPass++;
    if (willPrune) v.remove();
  }
  if (droppedThisPass === 0) break;
}
const pruned = willPrune ? leftovers.length : 0;
if (!willPrune && leftovers.length > 0) {
  const why = pruneSkipped || 'prune is opt-in: set globalThis.DS_PRUNE_TOKENS = true to remove them';
  console.warn('[ds-contracts] ' + leftovers.length + ' leftover variable(s) kept in owned collection(s) — ' + why + ': ' + leftovers.join(', '));
  figma.notify(leftovers.length + ' leftover variable(s) kept (' + why + '): ' + leftovers.slice(0, 5).join(', ') + (leftovers.length > 5 ? ', …' : ''), { timeout: 6000 });
}
`;
}

/** Plugin-API runtime shared by bundle tokenSet apply and first-party
 *  Primitives/Brand/Semantic apply: the VALUE door. Declares
 *  `DS_OVERWRITE_TOKENS`, `variableDrift` (array of
 *  `{name, mode, canvas, bundle, applied}`), `valueKey` and
 *  `applyValue(variable, modeId, modeName, value, created)` → boolean
 *  (whether the value was written). Every apply records what it wrote per
 *  mode in the variable's shared plugin data (`ds_contracts/appliedValues`,
 *  keyed by mode NAME so a file with different mode ids still compares).
 *  A re-paste then distinguishes THREE canvas states:
 *    canvas == bundle            → nothing to write
 *    canvas == last applied      → ours; the bundle moved → overwrite
 *    canvas != last applied, or no record → a designer (or another tool)
 *                                  edited it → NAMED in `variableDrift` and
 *                                  KEPT unless `globalThis.DS_OVERWRITE_TOKENS === true`
 *  `FC-APPLY-TOKENS-KEEP-EDITS`. Same door style as DS_CREATE_ONLY and
 *  DS_PRUNE_TOKENS: closed by default, never a silent revert. */
export function guardedValueUpsertRuntime(): string {
  return `// FC-APPLY-TOKENS-KEEP-EDITS — a re-paste never silently reverts a designer's
// edit to a variable VALUE. Each apply records what it wrote per mode
// (shared plugin data ds_contracts/appliedValues); a canvas value that is
// neither the bundle's nor the last applied one is a designer edit: it is
// NAMED in variableDrift and KEPT. Set globalThis.DS_OVERWRITE_TOKENS = true
// before running this script to let the bundle win (the drift is still named).
const DS_OVERWRITE_TOKENS = typeof globalThis !== 'undefined' && globalThis.DS_OVERWRITE_TOKENS === true;
const variableDrift = [];
const nameById = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) nameById.set(v.id, v.name);
const round4 = (n) => Math.round(n * 10000) / 10000;
// One comparable spelling per value shape — alias by TARGET NAME (ids differ
// per file), colour by rounded channels (Figma stores floats), number
// rounded, string verbatim. Two values compare equal iff their keys do.
const valueKey = (x) => {
  if (x === undefined || x === null) return 'unset';
  if (typeof x === 'number') return 'n:' + round4(x);
  if (typeof x === 'string') return 's:' + JSON.stringify(x);
  if (typeof x === 'boolean') return 'b:' + x;
  if (typeof x === 'object' && x.type === 'VARIABLE_ALIAS') return 'alias:' + (nameById.get(x.id) || x.id);
  if (typeof x === 'object' && typeof x.r === 'number') return 'rgba(' + [x.r, x.g, x.b, x.a === undefined ? 1 : x.a].map(round4).join(',') + ')';
  return 'unknown:' + String(x);
};
const APPLIED_NS = 'ds_contracts', APPLIED_KEY = 'appliedValues';
const readApplied = (v) => {
  try {
    const raw = typeof v.getSharedPluginData === 'function' ? v.getSharedPluginData(APPLIED_NS, APPLIED_KEY) : '';
    const rec = raw ? JSON.parse(raw) : null;
    return rec && typeof rec === 'object' ? rec : null;
  } catch (e) { return null; }
};
const writeApplied = (v, rec) => {
  if (typeof v.setSharedPluginData === 'function') v.setSharedPluginData(APPLIED_NS, APPLIED_KEY, JSON.stringify(rec));
};
const applyValue = (v, modeId, modeName, value, created) => {
  const bundleKey = valueKey(value);
  const canvasKey = created ? null : valueKey(v.valuesByMode ? v.valuesByMode[modeId] : undefined);
  const applied = created ? null : readApplied(v);
  const prevKey = applied ? applied[modeName] : undefined;
  const ours = created || canvasKey === bundleKey || (prevKey !== undefined && prevKey === canvasKey);
  if (!ours) {
    variableDrift.push({ name: v.name, mode: modeName, canvas: canvasKey, bundle: bundleKey, applied: prevKey === undefined ? null : prevKey });
    if (!DS_OVERWRITE_TOKENS) return false;
  }
  if (created || canvasKey !== bundleKey) v.setValueForMode(modeId, value);
  if (created) nameById.set(v.id, v.name);
  const rec = applied || {};
  rec[modeName] = bundleKey;
  writeApplied(v, rec);
  return true;
};
const reportVariableDrift = (collectionName) => {
  if (variableDrift.length === 0) return;
  const verb = DS_OVERWRITE_TOKENS ? 'OVERWRITTEN (DS_OVERWRITE_TOKENS)' : 'kept — set globalThis.DS_OVERWRITE_TOKENS = true to let the bundle win';
  const lines = variableDrift.map((d) => d.name + ' [' + d.mode + '] canvas ' + d.canvas + ' vs bundle ' + d.bundle);
  console.warn('[ds-contracts] ' + variableDrift.length + ' designer-edited variable value(s) in ' + collectionName + ' ' + verb + ': ' + lines.join('; '));
  figma.notify(variableDrift.length + ' edited variable value(s) ' + (DS_OVERWRITE_TOKENS ? 'overwritten' : 'kept') + ': ' + variableDrift.slice(0, 4).map((d) => d.name).join(', ') + (variableDrift.length > 4 ? ', …' : ''), { timeout: 6000 });
};
`;
}

// ---------------------------------------------------------------------------
// The sync script (the example scripts' runtime, parameterized)
// ---------------------------------------------------------------------------

/** tokenSet → deterministic Figma Plugin-API script text: one collection
 *  named tokenSet.name, a Dark mode ONLY when the set carries dark values
 *  (an addMode the plan refuses is named in `modeSkipped`, not thrown),
 *  TWO-PASS guarded upsert (concrete values, then Figma-NATIVE VARIABLE
 *  ALIASES for the minted {alias} leaves; designer-edited values are named in
 *  `variableDrift` and kept unless `globalThis.DS_OVERWRITE_TOKENS === true`;
 *  composite $values are named in `skippedValues`, never stringified), then
 *  an OPT-IN prune (`globalThis.DS_PRUNE_TOKENS === true`) of unreferenced
 *  leftovers in THAT collection only — by default leftovers are named in the
 *  result, never removed (`FC-APPLY-TOKENS-NOT-PRUNED`). Re-run safe. Run
 *  BEFORE the component scripts; they bind by name. */
export function emitTokenSetScript(tokenSet: TokenSetPayload, fileKey: string | null): string {
  const { rows, aliasCount, unparsedColors, unparsedDimensions, orphanModes, unsupportedValues } = compileTokenSetRows(tokenSet);
  const textStyles = tokenSetTextStyles(tokenSet, rows);
  const col = tokenSet.name;
  // MODES ARE A FACT OF THE TOKEN SET, NOT A DEFAULT. A tokenSet with no
  // `modes.dark` used to get a cloned "Dark" mode whose every value equalled
  // Light — misleading on Pro files, and a hard throw on Starter files (one
  // mode per collection). Add Dark only when the set carries dark values;
  // name the lone mode "Value" (the Primitives spelling) when it carries none.
  const hasLight = Object.keys(tokenSet.modes?.light ?? {}).length > 0;
  const wantsDark = Object.keys(tokenSet.modes?.dark ?? {}).length > 0;
  const mode0Name = hasLight || wantsDark ? 'Light' : 'Value';
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
    unsupportedValues.length > 0
      ? `// ⚠ ${unsupportedValues.length} token(s) carry a $value no Figma variable can hold (object-form composite, array,\n` +
        `//   boolean, null) — SKIPPED by name, never stringified: ${unsupportedValues.slice(0, 6).join('; ')}${unsupportedValues.length > 6 ? '; …' : ''}`
      : '',
  ].filter(Boolean).join('\n');
  return `// GENERATED by the ds-contracts engine from a CONTRACTS-BUNDLE tokenSet — DO NOT EDIT.
// Deterministic variable UPSERT; leftovers in this collection are NAMED, and
// removed only when globalThis.DS_PRUNE_TOKENS === true (opt-in,
// FC-APPLY-TOKENS-NOT-PRUNED); designer-edited values are NAMED and kept
// unless globalThis.DS_OVERWRITE_TOKENS === true (FC-APPLY-TOKENS-KEEP-EDITS).
// One ${JSON.stringify(col)} collection, modes ${wantsDark ? 'Light/Dark' : mode0Name}, ${rows.length} variables (${aliasCount} Figma-native aliases from
// the library's own token references). Runs BEFORE the component scripts.
${caveats ? `${caveats}\n` : ''}
const TOKENS = ${JSON.stringify(rows)};
const TEXT_STYLES = ${JSON.stringify(textStyles)};
// Tokens compiled out by name: their $value has no variable shape (see the
// caveat above). Returned as skippedValues so the loss is never silent.
const SKIPPED_VALUES = ${JSON.stringify(unsupportedValues)};
const WANTS_DARK = ${JSON.stringify(wantsDark)};
const MODE0_NAME = ${JSON.stringify(mode0Name)};

// File guard: multi-file bridge routing has been observed to hit the wrong
// file — never write without verifying the target.
const EXPECTED_FILE_KEY = ${JSON.stringify(fileKey)};
if (EXPECTED_FILE_KEY && figma.fileKey && figma.fileKey !== EXPECTED_FILE_KEY) {
  throw new Error('WRONG FILE: expected ' + EXPECTED_FILE_KEY + ', got ' + figma.fileKey);
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();
let col = collections.find((c) => c.name === ${JSON.stringify(col)});
const createdCollection = !col;
if (!col) col = figma.variables.createVariableCollection(${JSON.stringify(col)});
let lightId = col.modes[0].modeId;
// Name the first mode only while it still wears Figma's default — a designer's
// own mode name on an existing collection is theirs to keep.
if (createdCollection || col.modes[0].name === 'Mode 1') col.renameMode(lightId, MODE0_NAME);
const lightName = col.modes[0].name;
// Dark: reuse one that exists; add one only when the set carries dark values;
// and a plan that refuses a second mode (Starter: one mode per collection) is
// NAMED in the result, not thrown — the Light values still land.
let darkMode = col.modes.find((m) => m.name === 'Dark');
let darkId = darkMode ? darkMode.modeId : null;
let modeSkipped = null;
if (!darkId && WANTS_DARK) {
  try {
    darkId = col.addMode('Dark');
  } catch (e) {
    modeSkipped = 'Dark mode not added to ' + ${JSON.stringify(col)} + ': ' + (e && e.message ? e.message : String(e)) + ' — the file plan refused a second mode (Figma Starter allows one per collection); the dark values were NOT written';
  }
}
${guardedValueUpsertRuntime()}
const existing = new Map();
for (const v of await figma.variables.getLocalVariablesAsync()) {
  if (v.variableCollectionId === col.id) existing.set(v.name, v);
}
let created = 0, updated = 0;
const skippedValues = SKIPPED_VALUES.slice();
// pass 1: create/refresh every variable with concrete values
for (const t of TOKENS) {
  if (t.type === 'ALIAS') continue;
  // Runtime door: a payload row that is not a string/number/colour (a composite
  // that escaped the compiler) is skipped BY NAME, never stringified.
  const shapeOk = (x) => typeof x === 'string' || typeof x === 'number' || (x && typeof x === 'object' && typeof x.r === 'number');
  if (!shapeOk(t.light) || !shapeOk(t.dark)) { skippedValues.push(t.name + ': ' + (Array.isArray(t.light) ? 'array' : typeof t.light)); continue; }
  let v = existing.get(t.name);
  const isNew = !v;
  if (!v) { v = figma.variables.createVariable(t.name, col, t.type); existing.set(t.name, v); created++; } else { updated++; }
  applyValue(v, lightId, lightName, t.light, isNew);
  if (darkId) applyValue(v, darkId, 'Dark', t.dark, isNew);
}
// pass 2: minted aliases — REAL variable aliases to the base tokens the
// library's own source named (they inherit the target's Light/Dark values)
let aliased = 0;
for (const t of TOKENS) {
  if (t.type !== 'ALIAS') continue;
  const target = existing.get(t.target);
  if (!target) throw new Error('token sync: alias target missing: ' + t.target + ' (for ' + t.name + ')');
  let v = existing.get(t.name);
  const isNew = !v;
  const resolvedType = target.resolvedType;
  if (!v) { v = figma.variables.createVariable(t.name, col, resolvedType); existing.set(t.name, v); created++; } else { updated++; }
  const alias = figma.variables.createVariableAlias(target);
  applyValue(v, lightId, lightName, alias, isNew);
  if (darkId) applyValue(v, darkId, 'Dark', alias, isNew);
  aliased++;
}
reportVariableDrift(${JSON.stringify(col)});
if (skippedValues.length > 0) {
  console.warn('[ds-contracts] ' + skippedValues.length + ' token(s) skipped — their $value has no Figma variable shape: ' + skippedValues.join('; '));
  figma.notify(skippedValues.length + ' token(s) skipped (composite $value): ' + skippedValues.slice(0, 4).map((x) => x.split(':')[0]).join(', ') + (skippedValues.length > 4 ? ', …' : ''), { timeout: 6000 });
}
if (modeSkipped) { console.warn('[ds-contracts] ' + modeSkipped); figma.notify(modeSkipped, { timeout: 6000 }); }
const owned = new Map();
owned.set(col.id, new Set(TOKENS.map((t) => t.name)));
${ownedCollectionPruneRuntime()}
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
const modeNames = col.modes.map((m) => m.name).join('/');
figma.notify(${JSON.stringify(col)} + ' tokens: ' + created + ' created, ' + updated + ' updated, ' + pruned + ' pruned, ' + leftovers.length + ' leftover(s), ' + variableDrift.length + ' edited value(s) ' + (DS_OVERWRITE_TOKENS ? 'overwritten' : 'kept') + ', ' + skippedValues.length + ' skipped (' + TOKENS.length + ' total, ' + aliased + ' aliases, modes ' + modeNames + '; ' + createdStyles + ' text styles created)');
return { created, updated, aliased, pruned, leftovers, pruneSkipped, variableDrift, driftOverwritten: DS_OVERWRITE_TOKENS, skippedValues, modeSkipped, modes: col.modes.map((m) => m.name), total: TOKENS.length, textStyles: TEXT_STYLES.length, createdStyles };
`;
}
