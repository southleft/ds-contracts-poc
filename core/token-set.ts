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
  if (!isPlainObject(raw.base) || Object.keys(raw.base).length === 0) {
    return { ok: false, error: `the tokenSet "base" must be a non-empty flat DTCG object — ${SHAPE}.` };
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

/** Deterministic oklch() → sRGB (the OKLab reference matrices, closed-form,
 *  fixed rounding) — MOVED here from extract/computed/lib.ts (which now
 *  re-exports it) so the browser core carries the one implementation.
 *  Accepts L as % or decimal, optional `/ alpha`. Out-of-gamut clamps
 *  channel-wise (the browser's own fallback behavior for sRGB surfaces). */
export function oklchToRgba(v: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/.exec(v.trim());
  if (!m) return null;
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = parseFloat(m[2]);
  const H = (parseFloat(m[3]) * Math.PI) / 180;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
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
  return { r: Math.round(gamma(lin[0]) * 255), g: Math.round(gamma(lin[1]) * 255), b: Math.round(gamma(lin[2]) * 255), a: alpha };
}

interface Rgba01 { r: number; g: number; b: number; a: number }

/** hex (#rgb/#rgba/#rrggbb/#rrggbbaa) / rgb() / rgba() / oklch() → 0–1 RGBA,
 *  or null when the value is not a parseable color (→ STRING). */
function colorOf(v: unknown): Rgba01 | null {
  let s = String(v).trim();
  const ok = oklchToRgba(s);
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
    rows.push({ name, type: 'STRING', light: lv, dark: dv });
  }
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
  return { rows, counts, aliasCount };
}

// ---------------------------------------------------------------------------
// The sync script (the example scripts' runtime, parameterized)
// ---------------------------------------------------------------------------

/** tokenSet → deterministic Figma Plugin-API script text: one collection
 *  named tokenSet.name, Light/Dark modes, TWO-PASS upsert (concrete values,
 *  then Figma-NATIVE VARIABLE ALIASES for the minted {alias} leaves) —
 *  re-run safe. Run BEFORE the component scripts; they bind by name. */
export function emitTokenSetScript(tokenSet: TokenSetPayload, fileKey: string | null): string {
  const { rows, aliasCount } = compileTokenSetRows(tokenSet);
  const col = tokenSet.name;
  return `// GENERATED by the ds-contracts engine from a CONTRACTS-BUNDLE tokenSet — DO NOT EDIT.
// Deterministic variable UPSERT (re-run safe): one ${JSON.stringify(col)} collection,
// Light/Dark modes, ${rows.length} variables (${aliasCount} Figma-native aliases from
// the library's own token references). Runs BEFORE the component scripts.
const TOKENS = ${JSON.stringify(rows)};

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
figma.notify(${JSON.stringify(col)} + ' tokens: ' + created + ' created, ' + updated + ' updated (' + TOKENS.length + ' total, ' + aliased + ' aliases, Light/Dark)');
return { created, updated, aliased, total: TOKENS.length };
`;
}
