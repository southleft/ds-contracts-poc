/**
 * Token corpus utilities for the design→contract extractor.
 *
 * Self-contained re-derivation of the pieces of scripts/generate-figma.ts the
 * inverter needs (that module is a CLI with write side effects, so it cannot
 * be imported): DTCG flattening, literal resolution through the default brand
 * mode, the derived-text-style table, and a value→token index for
 * nearest-token SUGGESTIONS (suggestions are reported, never emitted — an
 * unbound canvas value never silently becomes a token).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

interface TokenEntry {
  value: unknown;
  type: string;
}

function flatten(
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
        flatten(v, [...prefix, key], ownType, out);
      }
    }
  }
  return out;
}

const ALIAS = /^\{([^}]+)\}$/;
const aliasTarget = (v: unknown): string | null =>
  typeof v === 'string' ? (v.match(ALIAS)?.[1] ?? null) : null;

export const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
};

export interface DerivedTextStyle {
  /** Style name as it appears on the canvas ("badge", "control/sm"). */
  name: string;
  /** The semantic size-token dot-path — the style's identity. */
  tokenPath: string;
  /** The group's weight-token dot-path, when the group declares one. */
  weightPath?: string;
  fontSize: number;
  fontStyle: string;
}

export interface TokenCorpus {
  /** Semantic layer (aliases) — the layer contracts bind. */
  semantic: Map<string, TokenEntry>;
  /** Resolve a dot-path to its literal (default brand, light mode). */
  resolveLiteral(dotPath: string): unknown;
  has(dotPath: string): boolean;
  /** Named text styles derived from font.<group>.size tokens — recomputed
   *  exactly as the generator derives them. */
  textStyles: DerivedTextStyle[];
  textStyleByName: Map<string, DerivedTextStyle>;
  /** Nearest-token suggestions for a raw canvas value (hex color or number),
   *  semantic paths first. For the unbound-value report only. */
  suggestFor(raw: string | number): string[];
}

const px = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  if (Number.isNaN(n)) throw new Error(`Not a numeric token value: ${v}`);
  return n;
};

export function loadTokenCorpus(root: string): TokenCorpus {
  const read = (p: string) =>
    JSON.parse(readFileSync(path.join(root, p), 'utf8')) as Record<string, unknown>;
  const primitives = flatten(read('tokens/primitives.tokens.json'));
  const semantic = flatten(read('tokens/semantic.tokens.json'));
  const light = flatten(read('tokens/modes/semantic.light.tokens.json'));
  const brandDefault = flatten(read('tokens/modes/brand.default.tokens.json'));
  void readdirSync(path.join(root, 'tokens', 'modes')); // fail fast if the layout moved

  const all = new Map([...primitives, ...brandDefault, ...semantic, ...light]);

  const resolveLiteral = (dotPath: string): unknown => {
    let entry = all.get(dotPath);
    let guard = 0;
    while (entry && guard++ < 10) {
      const target = aliasTarget(entry.value);
      if (target === null) return entry.value;
      entry = all.get(target);
    }
    throw new Error(`Cannot resolve token "${dotPath}"`);
  };

  const textStyles: DerivedTextStyle[] = [];
  for (const [p] of semantic) {
    const m = p.match(/^font\.(.+?)\.size(?:\.([^.]+))?$/);
    if (!m) continue;
    const group = m[1];
    const name = [group, ...(m[2] ? [m[2]] : [])].join('/').split('.').join('/');
    const weightPath = `font.${group}.weight`;
    const hasWeight = semantic.has(weightPath);
    const fontStyle = hasWeight
      ? (FONT_STYLE_BY_WEIGHT[px(resolveLiteral(weightPath))] ?? 'Medium')
      : 'Medium';
    textStyles.push({
      name,
      tokenPath: p,
      ...(hasWeight ? { weightPath } : {}),
      fontSize: px(resolveLiteral(p)),
      fontStyle,
    });
  }
  textStyles.sort((a, b) => a.name.localeCompare(b.name));

  // Value index: literal → candidate token paths (semantic + mode layers
  // first — those are what a contract would bind — then primitives).
  const byValue = new Map<string, string[]>();
  const norm = (v: unknown): string | null => {
    if (typeof v === 'number') return String(v);
    if (typeof v !== 'string') return null;
    const hex = v.replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    const n = parseFloat(v);
    return Number.isNaN(n) ? v : String(n);
  };
  const index = (paths: Map<string, TokenEntry>) => {
    for (const [p] of paths) {
      let key: string | null = null;
      try {
        key = norm(resolveLiteral(p));
      } catch {
        continue; // e.g. brand aliases into other files — skip unresolvables
      }
      if (key === null) continue;
      const list = byValue.get(key) ?? [];
      if (!list.includes(p)) list.push(p);
      byValue.set(key, list);
    }
  };
  index(semantic);
  index(light);
  index(primitives);

  return {
    semantic,
    resolveLiteral,
    has: (p) => all.has(p),
    textStyles,
    textStyleByName: new Map(textStyles.map((t) => [t.name, t])),
    suggestFor: (raw) => byValue.get(norm(raw) ?? '') ?? [],
  };
}
