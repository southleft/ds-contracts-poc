/**
 * tokens.css — the custom-property sheet every code target's CSS references.
 *
 * THE DEFECT THIS CLOSES (2026-08-22, adopter-facing P1): `ds-contracts
 * generate --target react|html|web-components` emitted components whose CSS
 * referenced `var(--color-…)` (261 distinct names for the eight Flowbite
 * stems) that NO emitted file defined and NO CLI verb built from the DTCG
 * inputs. The React a stranger generates from docs/BETA.md was unstyled until
 * they hand-wrote a vars file, and the dark slot (`--tokens light=,dark=`)
 * never reached code at all.
 *
 * This is the DTCG → custom-property step scripts/build-tokens.mjs performs
 * for the repo's own tokens, lifted into the pure core so every generate
 * shell emits it beside the components. It flattens through core/tokens.ts
 * (flattenTokens) — there is no second DTCG flattener — and keeps the
 * first-party builder's conventions byte-for-byte where they matter:
 *
 *   · naming        `--a-b-c` for token path `a.b.c` — the emitters' cssVar()
 *                   spelling (core/emit-react.ts, emit-wc.ts), so the set of
 *                   referenced names is a subset of the defined names by
 *                   construction (scripts/generate-components.ts gates it).
 *   · aliases       `{a.b}` stays `var(--a-b)` so the sheet reads like the
 *                   token architecture; a target outside the supplied trees
 *                   is COUNTED and NAMED (danglingAliases), never silent.
 *   · modes         the repo convention from scripts/build-tokens.mjs and
 *                   .storybook/preview.tsx — `:root` carries primitives +
 *                   brand.default + semantic + light (the default/light
 *                   slot); `[data-theme="dark"]` carries the dark slot;
 *                   `[data-brand="<name>"]` every other brand. A single
 *                   unnamed (flat) tree is `:root` only.
 *   · refusal       two slots that disagree on a token's $type refuse BY
 *                   NAME — one path cannot be a colour in light and a length
 *                   in dark; the merge would pick whichever was parsed last.
 *
 * Composite $values (DTCG shadow objects, arrays of them) are serialised to
 * their CSS form; a composite this module cannot express as ONE custom
 * property (typography objects, arbitrary objects) is skipped and named in
 * `skippedComposite` — and the generate shells refuse when a component
 * references a skipped name, because a reference to nothing renders as
 * nothing, silently.
 *
 * Zero node:* imports — browser-importable like the rest of core/.
 */
import { aliasTarget, flattenTokens, type TokenEntry, type TokenTreeInput } from './tokens.js';

/** The emitters' cssVar() spelling, minus the `var()` wrapper. */
export const cssVarName = (tokenPath: string): string => `--${tokenPath.split('.').join('-')}`;

export const ROOT_SELECTOR = ':root';
export const DARK_MODE_SELECTOR = '[data-theme="dark"]';
export const brandModeSelector = (name: string): string => `[data-brand="${name}"]`;

export interface TokensCssPart {
  /** Slot label for diagnostics ("primitives", "light", "brand.aurora", …). */
  slot: string;
  tree: Record<string, unknown>;
}

export interface TokensCssLayer {
  /** Mode label ("default", "dark", "brand.aurora"). */
  name: string;
  /** CSS selector of the block (`:root`, `[data-theme="dark"]`, …). */
  selector: string;
  /** Trees merged into this block, in order — later parts win a path. */
  parts: TokensCssPart[];
}

export interface TokensCssOptions {
  /** Source lines for the header (file basenames / slot layout). */
  sources?: string[];
  /** The command that regenerates the sheet (header line). */
  regenerate?: string;
}

export interface TokensCssReport {
  css: string;
  /** Custom-property names defined in `:root` (sorted, with the `--`). */
  defined: string[];
  /** Every non-root block that was emitted (empty layers are dropped). */
  modes: Array<{ name: string; selector: string; count: number }>;
  /** `token.path -> {alias.target}` aliases whose target is in no supplied tree. */
  danglingAliases: string[];
  /** Token paths whose composite $value has no single-custom-property form. */
  skippedComposite: string[];
}

/** The repo's layering (scripts/build-tokens.mjs): `:root` = primitives →
 *  brand.default → semantic → light; dark and each other brand are modes. */
export function tokensCssLayers(t: TokenTreeInput): TokensCssLayer[] {
  const brandNames = Object.keys(t.brands).sort();
  const layers: TokensCssLayer[] = [
    {
      name: 'default',
      selector: ROOT_SELECTOR,
      parts: [
        { slot: 'primitives', tree: t.primitives },
        { slot: 'brand.default', tree: t.brands.default ?? {} },
        { slot: 'semantic', tree: t.semantic },
        { slot: 'light', tree: t.light },
      ],
    },
    { name: 'dark', selector: DARK_MODE_SELECTOR, parts: [{ slot: 'dark', tree: t.dark }] },
  ];
  for (const name of brandNames) {
    if (name === 'default') continue;
    layers.push({
      name: `brand.${name}`,
      selector: brandModeSelector(name),
      parts: [{ slot: `brand.${name}`, tree: t.brands[name] }],
    });
  }
  return layers;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** DTCG shadow object → `x y blur spread color` (+ `inset`). */
function shadowCss(v: Record<string, unknown>): string | null {
  const dim = (x: unknown) => (typeof x === 'number' ? `${x}px` : typeof x === 'string' ? x : null);
  const parts = [dim(v.offsetX ?? 0), dim(v.offsetY ?? 0), dim(v.blur ?? 0), dim(v.spread ?? 0)];
  if (parts.some((p) => p === null)) return null;
  if (typeof v.color !== 'string') return null;
  return `${v.inset === true ? 'inset ' : ''}${parts.join(' ')} ${v.color}`;
}

/** One token's $value as a CSS custom-property value, or null when the
 *  value has no single-property form (the caller names the skip). */
export function cssValueOf(value: unknown): string | null {
  if (typeof value === 'string') {
    const target = aliasTarget(value);
    // One declaration per line: a $value captured with a hard wrap (the
    // Tailwind font stacks carry "\n      ") would otherwise span lines —
    // valid CSS, but every line-oriented reader of the sheet misparses it.
    // Whitespace inside a value list is not significant.
    return target ? `var(${cssVarName(target)})` : value.replace(/\s*\n\s*/g, ' ');
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => (isRecord(item) ? shadowCss(item) : cssValueOf(item)));
    return items.every((i): i is string => typeof i === 'string') ? items.join(', ') : null;
  }
  if (isRecord(value)) return shadowCss(value);
  return null;
}

/** Emit the sheet. Throws (refuses by name) on a $type disagreement between
 *  slots; every other imperfection is reported, never swallowed. */
export function emitTokensCss(layers: TokensCssLayer[], opts: TokensCssOptions = {}): TokensCssReport {
  // Flatten every part once; remember which slot first typed each path so a
  // disagreement names both sides.
  const flat = new Map<TokensCssLayer, Map<string, TokenEntry>>();
  const typedBy = new Map<string, { slot: string; type: string }>();
  const disagreements: string[] = [];
  for (const layer of layers) {
    const merged = new Map<string, TokenEntry>();
    for (const part of layer.parts) {
      for (const [tokenPath, entry] of flattenTokens(part.tree)) {
        merged.set(tokenPath, entry);
        if (!entry.type) continue;
        const prev = typedBy.get(tokenPath);
        if (!prev) typedBy.set(tokenPath, { slot: part.slot, type: entry.type });
        else if (prev.type !== entry.type && prev.slot !== part.slot) {
          disagreements.push(
            `${tokenPath}: $type "${prev.type}" in slot ${prev.slot} but "${entry.type}" in slot ${part.slot}`,
          );
        }
      }
    }
    flat.set(layer, merged);
  }
  if (disagreements.length > 0) {
    throw new Error(
      `Refused — ${disagreements.length} token(s) typed differently by two slots; tokens.css would carry whichever parsed last:\n` +
        disagreements.map((d) => `  - ${d}`).join('\n'),
    );
  }

  const root = layers.find((l) => l.selector === ROOT_SELECTOR);
  const rootPaths = new Set(root ? flat.get(root)!.keys() : []);
  const danglingAliases: string[] = [];
  const skippedComposite: string[] = [];
  const modes: TokensCssReport['modes'] = [];

  const block = (layer: TokensCssLayer): string[] => {
    const entries = flat.get(layer)!;
    const resolvable = new Set([...rootPaths, ...entries.keys()]);
    const lines: string[] = [];
    for (const tokenPath of [...entries.keys()].sort()) {
      const entry = entries.get(tokenPath)!;
      const target = aliasTarget(entry.value);
      if (target && !resolvable.has(target)) danglingAliases.push(`${tokenPath} -> {${target}}`);
      const css = cssValueOf(entry.value);
      if (css === null) {
        skippedComposite.push(`${tokenPath} ($type ${entry.type || 'untyped'})`);
        continue;
      }
      lines.push(`  ${cssVarName(tokenPath)}: ${css};`);
    }
    return lines;
  };

  const out: string[] = [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT.',
    ` * Source of truth: ${opts.sources && opts.sources.length > 0 ? opts.sources.join(', ') : 'the DTCG token files passed to generate (--tokens)'}`,
    ` * Regenerate with: ${opts.regenerate ?? 'the same generate command that emitted the components'}`,
    ' *',
    ' * Import ONCE at the app root — the generated components only REFERENCE',
    ' * these custom properties. React / Vite: `import \'./tokens.css\'` (the',
    ' * emitted index.ts and *.stories.tsx already do). Static HTML and Web',
    ' * Components: `<link rel="stylesheet" href="tokens.css">` — custom',
    ' * properties inherit into shadow roots, so one document-level sheet',
    ' * styles every custom element.',
    ' *',
    ' * Modes: `:root` is the default (light) slot; `[data-theme="dark"]` the',
    ' * dark slot; `[data-brand="<name>"]` each other brand — set the attribute',
    ' * on <html> to switch.',
    ' */',
  ];
  let defined: string[] = [];
  for (const layer of layers) {
    const lines = block(layer);
    if (layer.selector === ROOT_SELECTOR) {
      defined = lines.map((l) => l.trim().slice(0, l.trim().indexOf(':')));
      out.push('', `${layer.selector} {`, ...lines, '}');
      continue;
    }
    if (lines.length === 0) continue;
    modes.push({ name: layer.name, selector: layer.selector, count: lines.length });
    out.push('', `${layer.selector} {`, ...lines, '}');
  }
  if (!root) out.push('', `${ROOT_SELECTOR} {`, '}');
  out.push('');
  return { css: out.join('\n'), defined, modes, danglingAliases, skippedComposite };
}

// A reference WITHOUT a fallback — `var(--x)` — renders as nothing when
// `--x` is undefined, so it must be defined in tokens.css. A reference WITH
// a fallback — `var(--x, <fallback>)` — is a per-instance override hook by
// design (the untitled-ui stub icons expose `--ds-arrow-right-size` this way
// over the minted `--imported-stub-…` value); `--x` is legitimately
// undefined until a consumer sets it, and the fallback's own `var(…)` names
// are matched by this same scan as separate references, so the chain's
// terminal is still held to the rule. (2026-08-22: the first cut matched
// every `var(--x` and refused the untitled-ui and astryx trees over 32 stub
// override hooks.)
const VAR_REF_REQUIRED = /var\(\s*(--[a-zA-Z0-9_-]+)\s*\)/g;
const VAR_REF_ANY = /var\(\s*(--[a-zA-Z0-9_-]+)/g;

/** Every `var(--x)` name the stylesheet REQUIRES — referenced with no fallback (sorted, unique). */
export function referencedCssVars(cssText: string): string[] {
  const names = new Set<string>();
  for (const m of cssText.matchAll(VAR_REF_REQUIRED)) names.add(m[1]!);
  return [...names].sort();
}

/** Every `var(--x…` name mentioned at all, fallback-carrying or not (sorted, unique). */
export function mentionedCssVars(cssText: string): string[] {
  const names = new Set<string>();
  for (const m of cssText.matchAll(VAR_REF_ANY)) names.add(m[1]!);
  return [...names].sort();
}

/** The gate both shells run: referenced ⊆ defined, missing names listed. */
export function undefinedCssVars(referenced: Iterable<string>, defined: Iterable<string>): string[] {
  const have = new Set(defined);
  return [...new Set(referenced)].filter((name) => !have.has(name)).sort();
}
