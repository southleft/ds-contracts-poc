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

export const px = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  if (Number.isNaN(n)) throw new Error(`Not a numeric token value: ${v}`);
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
