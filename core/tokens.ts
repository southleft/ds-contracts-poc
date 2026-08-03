/**
 * Token loading for the pure core — accepts token JSON OBJECTS, never paths.
 *
 * The CLI shells (scripts/*.ts) read tokens/*.tokens.json from disk and hand
 * the parsed trees to these functions; a browser playground hands the same
 * trees fetched over HTTP or pasted into an editor. Zero node:* imports —
 * this module is part of the browser-importable core (see core/index.ts).
 */

/** Collect every DTCG token path ("color.action.primary.background") in a
 *  token tree into `out`. $-prefixed keys are DTCG metadata, not path
 *  segments. */
export function collectTokenPaths(node: unknown, prefix: string[], out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.add([...prefix, key].join('.'));
      else collectTokenPaths(value, [...prefix, key], out);
    }
  }
}

/** The token INVENTORY — the set of paths a contract's `{token.ref}` may
 *  resolve to. Built from parsed DTCG trees (primitives + semantic + modes). */
export function tokenInventoryFromJson(trees: unknown[]): Set<string> {
  const paths = new Set<string>();
  for (const tree of trees) collectTokenPaths(tree, [], paths);
  return paths;
}

export interface TokenEntry {
  value: unknown;
  type: string;
}

/** Flatten a DTCG tree to dot-path → { value, type } entries, inheriting
 *  group-level $type. The exact shape scripts/generate-figma.ts always used. */
export function flattenTokens(
  tree: Record<string, unknown>,
  prefix: string[] = [],
  inheritedType = '',
  out = new Map<string, TokenEntry>(),
): Map<string, TokenEntry> {
  const ownType = typeof tree.$type === 'string' ? tree.$type : inheritedType;
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if ('$value' in v) {
        const type = typeof v.$type === 'string' ? v.$type : ownType;
        out.set([...prefix, key].join('.'), { value: v.$value, type });
      } else {
        flattenTokens(v, [...prefix, key], ownType, out);
      }
    }
  }
  return out;
}

const ALIAS = /^\{([^}]+)\}$/;
export const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' ? (v.match(ALIAS)?.[1] ?? null) : null;

/**
 * The non-throwing half of `px`: a canvas dimension, or null when the value is
 * not one. Callers that can carry the fact another way (a Figma STRING
 * variable holds "0ms" losslessly) should branch on this rather than let `px`
 * strip the unit — publishing `0ms` as the FLOAT 0 says "zero pixels", which is
 * a different and wrong fact.
 */
export const pxOrNull = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (/^-?[\d.]+(rem|em)$/.test(s)) return n * 16;
  return /^-?[\d.]+(px)?$/.test(s) ? n : null;
};

export const px = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) throw new Error(`Not a numeric token value: ${v}`);
  // LIVE-CANVAS FINDING (2026-07-22, Astryx genesis): parseFloat silently
  // dropped units — '0.875rem' became 0.875, and the real Figma canvas
  // refused fontSize < 1 (the repo's own tokens are px/unitless, so this
  // never fired before a rem-scaled foreign system). rem/em convert at the
  // CSS root ratio; px and unitless pass through unchanged.
  if (/^-?[\d.]+(rem|em)$/.test(s)) return n * 16;
  // THE SAME BUG, FOR EVERY OTHER UNIT. The rem/em branch above exists because
  // a live canvas caught '0.875rem' becoming 0.875 — and it was fixed for two
  // units and left silent for all the rest. parseFloat happily returns 100 for
  // '100%', 200 for '200ms', 12 for '12pt', 4 for '4px 8px' and 0 for '0 auto',
  // and figmaType() then publishes each as a Figma FLOAT variable that the
  // canvas reads as PIXELS. A '100%' token becomes a hard 100px.
  //
  // Reachable from core/wrap-plain-tokens.ts — the advertised bring-your-own
  // on-ramp, which copies scalar values verbatim — so this is an adopter-facing
  // path, not an internal one. Refuse BY NAME instead: a loud failure at build
  // time beats a plausible wrong number on somebody's canvas.
  if (!/^-?[\d.]+(px)?$/.test(s)) {
    throw new Error(
      `Token value "${s}" is not a canvas dimension — only unitless, px, rem and em lower to a Figma FLOAT. ` +
        'Percentages, times, angles, pt and multi-value shorthands have no numeric canvas twin; parseFloat would ' +
        'silently strip the unit and publish the bare number as PIXELS. Give the token a px value, or carry the ' +
        'fact on a channel that can express it.',
    );
  }
  return n;
};

/** Parsed DTCG trees the core needs, as objects (the CLI reads the repo's
 *  tokens/ layout; a playground supplies the same trees any way it likes). */
export interface TokenTreeInput {
  primitives: Record<string, unknown>;
  semantic: Record<string, unknown>;
  light: Record<string, unknown>;
  dark: Record<string, unknown>;
  /** brand name → tree. Must include "default" when brands participate. */
  brands: Record<string, Record<string, unknown>>;
}

/** Resolve a dot-path to its literal through the given layered maps
 *  (later maps win), following aliases up to 10 hops. */
export function makeResolveLiteral(all: Map<string, TokenEntry>): (dotPath: string) => unknown {
  return (dotPath: string): unknown => {
    let entry = all.get(dotPath);
    let guard = 0;
    while (entry && guard++ < 10) {
      const target = aliasTarget(entry.value);
      if (!target) return entry.value;
      entry = all.get(target);
    }
    throw new Error(`Cannot resolve token "${dotPath}"`);
  };
}
