/**
 * CSS-Module anatomy adapter — reads a component's STRUCTURE, not just its API.
 * PURE core (no node:* imports): the file-reading shim lives in
 * extract/adapters/css-module.ts; a browser playground imports this module.
 *
 * Where react-tsx.ts reads the props surface, this module reads the two
 * artifacts a code-only org actually has — the JSX tree and the co-located
 * *.module.css — and inverts the generator's emission model (see
 * scripts/generate-components.ts) back into contract anatomy:
 *
 *   · JSX elements with className={styles.x}        → parts (nesting from JSX)
 *   · `property: var(--a-b-c)` declarations          → token bindings {a.b.c}
 *   · `.variant-primary { … var(--…-primary-…) }`    → substituted refs
 *                                                      {color.action.{variant}.background}
 *   · flex declarations                              → layout blocks
 *   · :hover / :active / :focus-visible / :disabled
 *     rules                                          → states
 *   · {children} / ReactNode props in named parts    → slots
 *   · <Avatar …/> instances                          → component refs
 *   · onClick={handleX} + the uncontrolled-toggle
 *     pattern                                        → event trigger/toggles
 *
 * Honesty rules (the point of the module):
 *   · HYPHEN→DOT tokenization is resolved against the REAL token tree.
 *     var(--space-inset-x-sm) matches the unique inventory path whose
 *     hyphen-join equals the var name (space.inset-x.sm). Zero matches or
 *     multiple matches are REPORTED by name — never guessed.
 *   · RAW CSS VALUES (literal colors, px) never become invented tokens.
 *     Each is a named RawValueFinding with nearest-token candidates BY VALUE
 *     from the token tree — a review list, not a decision.
 *   · Anything the parser can see but not read (media queries, shorthand
 *     var() usage, string classNames, inline styles, icon glyphs) lands in
 *     `notes` — the SkippedComponent discipline, applied per declaration.
 */
import ts from 'typescript';
import type {
  ExtractedAnatomy,
  ExtractedEventWiring,
  ExtractedPart,
  ExtractedProp,
  RawValueFinding,
} from '../extract/types.js';
import type { CodeMintFinding } from './mint-code.js';

/** Capture sink for unbindable styled declarations (raw literals + foreign
 *  var()s) — already bound to the selector/part/state/axis context of the
 *  rule being read. Feeds opt-in provisional minting (core/mint-code.ts);
 *  the report channels (rawValues, notes) are unchanged. */
type MintSink = (cssProperty: string, raw: string) => void;

// ---------------------------------------------------------------------------
// Token index — the referee for every hyphen→dot decision
// ---------------------------------------------------------------------------

export interface TokenIndex {
  /** hyphen-joined var name (no leading --) → all dot paths that join to it */
  byVar: Map<string, string[]>;
  /** dot path → resolved literal $value (aliases followed) */
  valueOf: Map<string, string>;
}

export function tokenIndexFromJson(trees: unknown[]): TokenIndex {
  const raw = new Map<string, string>(); // path → raw $value (may be an alias)
  const collect = (node: unknown, prefix: string[]) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (value && typeof value === 'object') {
        if ('$value' in value) raw.set([...prefix, key].join('.'), String((value as { $value: unknown }).$value));
        else collect(value, [...prefix, key]);
      }
    }
  };
  for (const tree of trees) collect(tree, []);

  const byVar = new Map<string, string[]>();
  for (const p of raw.keys()) {
    const v = p.split('.').join('-');
    byVar.set(v, [...(byVar.get(v) ?? []), p]);
  }
  const valueOf = new Map<string, string>();
  const resolve = (p: string, depth = 0): string | undefined => {
    if (depth > 8) return undefined;
    const v = raw.get(p);
    if (v === undefined) return undefined;
    const alias = v.match(/^\{([^{}]+)\}$/);
    return alias ? resolve(alias[1], depth + 1) : v;
  };
  for (const p of raw.keys()) {
    const v = resolve(p);
    if (v !== undefined) valueOf.set(p, v);
  }
  return { byVar, valueOf };
}

/** Token paths whose RESOLVED value equals the literal (case-insensitive). */
function candidatesByValue(index: TokenIndex, literal: string): string[] {
  const norm = literal.trim().toLowerCase();
  const out: string[] = [];
  for (const [p, v] of index.valueOf) {
    if (v.trim().toLowerCase() === norm) out.push(p);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Minimal CSS parsing (enough for modules; @-rules are skipped by name)
// ---------------------------------------------------------------------------

interface CssDecl {
  prop: string;
  value: string;
}
interface CssRule {
  selector: string;
  decls: CssDecl[];
}

/** Split a selector list on top-level commas only — `:not(:a, :b)` keeps its
 *  inner comma. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter((s) => s.length > 0);
}

function parseCss(css: string, notes: string[]): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  let i = 0;
  const skipBlock = () => {
    // assumes src[i] === '{'
    let depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        i++;
        return;
      }
    }
  };
  /** Parse one block body (or the top level when `parents` is null),
   *  flattening NESTED rules the standard CSS-nesting way: `&:hover` appends
   *  to every parent selector, anything else nests as a descendant. Rules
   *  land in document order; a rule's decls object is shared across its
   *  comma-split selectors and keeps accepting declarations found after
   *  nested blocks. */
  const parseBody = (parents: string[] | null, decls: CssDecl[] | null) => {
    let buf = '';
    const flushDecl = () => {
      const colon = buf.indexOf(':');
      if (colon !== -1 && decls) {
        const prop = buf.slice(0, colon).trim();
        const value = buf.slice(colon + 1).trim().replace(/\s+/g, ' ');
        if (prop) decls.push({ prop, value });
      }
      buf = '';
    };
    while (i < src.length) {
      const ch = src[i];
      if (ch === ';') {
        flushDecl();
        i++;
        continue;
      }
      if (ch === '}') {
        flushDecl();
        i++;
        return;
      }
      if (ch === '{') {
        const header = buf.trim();
        buf = '';
        if (header.startsWith('@')) {
          if (!header.startsWith('@keyframes ds-')) {
            notes.push(`css: at-rule \`${header}\` skipped — not extractable into anatomy`);
          }
          skipBlock();
          continue;
        }
        const own = splitSelectors(header);
        const combined =
          parents === null
            ? own
            : parents.flatMap((p) => own.map((s) => (s.startsWith('&') ? `${p}${s.slice(1)}` : `${p} ${s}`)));
        const childDecls: CssDecl[] = [];
        for (const sel of combined) rules.push({ selector: sel, decls: childDecls });
        i++; // past '{'
        parseBody(combined, childDecls);
        continue;
      }
      buf += ch;
      i++;
    }
    flushDecl();
  };
  parseBody(null, null);
  return rules;
}

// ---------------------------------------------------------------------------
// Declaration inversion — the generator's emission model, run backwards
// ---------------------------------------------------------------------------

const ALIGN_INV: Record<string, 'start' | 'center' | 'end' | 'stretch'> = {
  'flex-start': 'start',
  center: 'center',
  'flex-end': 'end',
  stretch: 'stretch',
};
const JUSTIFY_INV: Record<string, 'start' | 'center' | 'end' | 'space-between'> = {
  'flex-start': 'start',
  center: 'center',
  'flex-end': 'end',
  'space-between': 'space-between',
};

/** Generator artifacts with no anatomy meaning — implied by other fields
 *  (border tokens imply border-style, event-trigger buttons are neutralized,
 *  focus-visible gets outline boilerplate). Exact prop:value pairs only. */
const GENERATOR_ARTIFACTS = new Set([
  'border:0',
  'border-style:solid',
  'cursor:pointer',
  'cursor:not-allowed',
  'min-width:0',
  'min-width:fit-content',
  'appearance:none',
  'background:none',
  'border:none',
  'margin:0',
  'padding:0',
  'font:inherit',
  'color:inherit',
  'text-align:inherit',
  'outline-style:solid',
  'outline-offset:2px',
  'position:relative',
]);

/** Properties whose literal values belong in the token vocabulary — a raw
 *  literal here is a RawValueFinding, not a silent skip. */
const TOKEN_TYPICAL = new Set([
  'color', 'background', 'background-color', 'border-color', 'outline-color',
  'border-radius', 'border-width', 'gap', 'padding', 'padding-inline',
  'padding-block', 'margin', 'font-size', 'font-family', 'font-weight',
  'width', 'height', 'max-width', 'min-height', 'line-height', 'box-shadow',
]);

const VAR_RE = /^var\(--([A-Za-z0-9-]+)\)$/;

/** Is this literal the kind of value the token vocabulary usually owns? */
const isTokenizableLiteral = (prop: string, value: string): boolean =>
  /^#[0-9a-fA-F]{3,8}$/.test(value) ||
  /^(rgb|rgba|hsl|hsla)\(/.test(value) ||
  /^-?\d*\.?\d+(px|rem|em|%)$/.test(value) ||
  TOKEN_TYPICAL.has(prop);

/** Split a CSS value on top-level whitespace (function args stay together). */
function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Expand the invertible shorthands into the generator's longhand vocabulary:
 *  `padding: A` / `padding: A B` → padding-block/padding-inline, and
 *  `border: W solid C` → border-width + border-color (border-style: solid is
 *  implied by the emitters whenever border tokens bind). Anything else passes
 *  through untouched — 3/4-value padding and non-solid borders keep their
 *  existing named degradation. `padding: 0` stays whole so the generator-
 *  artifact filter still recognizes it. */
function expandShorthands(decls: CssDecl[]): CssDecl[] {
  const out: CssDecl[] = [];
  for (const d of decls) {
    if (d.prop === 'padding' && d.value !== '0') {
      const parts = splitTopLevel(d.value);
      if (parts.length === 1) {
        out.push({ prop: 'padding-block', value: parts[0] }, { prop: 'padding-inline', value: parts[0] });
        continue;
      }
      if (parts.length === 2) {
        out.push({ prop: 'padding-block', value: parts[0] }, { prop: 'padding-inline', value: parts[1] });
        continue;
      }
    }
    if (d.prop === 'border') {
      const parts = splitTopLevel(d.value);
      if (parts.length === 3 && parts[1] === 'solid') {
        out.push({ prop: 'border-width', value: parts[0] }, { prop: 'border-color', value: parts[2] });
        continue;
      }
    }
    if (d.prop === 'outline') {
      // The generator's focus ring is `outline-style: solid; outline-offset:
      // 2px` boilerplate + an `outline-color` state token — so `outline: W
      // solid C` (the focus-visible idiom; field case: CBDS Button) inverts
      // to outline-width + outline-color the same way `border` does.
      // `outline: none` and other shapes keep their named degradation.
      const parts = splitTopLevel(d.value);
      if (parts.length === 3 && parts[1] === 'solid') {
        out.push({ prop: 'outline-width', value: parts[0] }, { prop: 'outline-color', value: parts[2] });
        continue;
      }
    }
    out.push(d);
  }
  return out;
}

interface PartStyle {
  layout?: NonNullable<ExtractedPart['layout']>;
  overlay?: ExtractedPart['overlay'];
  tokens: Record<string, string>;
  animation?: 'spin' | 'pulse';
}

/** Resolve one var(--x) against the token tree. Returns the dot path, or
 *  null after pushing the named refusal. A FOREIGN var (zero tokenizations —
 *  another system's custom property) additionally fires `onForeign` so the
 *  mint capture can keep it; an AMBIGUOUS var (the name exists in the tree
 *  more than once) is a tree problem, never a mint candidate. */
function resolveVar(
  varName: string,
  context: string,
  index: TokenIndex,
  notes: string[],
  onForeign?: () => void,
): string | null {
  const paths = index.byVar.get(varName) ?? [];
  if (paths.length === 1) return paths[0];
  if (paths.length === 0) {
    notes.push(`css: ${context} uses var(--${varName}) which resolves to NO token in the token tree — binding not proposed`);
    onForeign?.();
  } else {
    notes.push(
      `css: ${context} var(--${varName}) has ${paths.length} tokenizations in the token tree (${paths.join(', ')}) — ambiguous, not proposed (report, don't guess)`,
    );
  }
  return null;
}

function invertDecls(
  selector: string,
  rawDecls: CssDecl[],
  index: TokenIndex,
  notes: string[],
  rawValues: RawValueFinding[],
  mint: MintSink,
): PartStyle {
  const out: PartStyle = { tokens: {} };
  const layout: NonNullable<ExtractedPart['layout']> = {};
  const decls = expandShorthands(rawDecls);
  const hasMaxWidthVar = decls.some((d) => d.prop === 'max-width' && VAR_RE.test(d.value));
  const insets = new Map<string, string>();
  let absolute = false;

  for (const { prop, value } of decls) {
    if (GENERATOR_ARTIFACTS.has(`${prop}:${value}`)) continue;
    if (prop === 'width' && value === '100%' && hasMaxWidthVar) continue; // fluid-root artifact of the max-width binding
    if (prop === 'display' && (value === 'flex' || value === 'inline-flex')) {
      layout.display = value;
      continue;
    }
    if (prop === 'flex-direction') {
      if (value === 'row' || value === 'column') {
        layout.direction = value;
      } else {
        notes.push(`css: ${selector} flex-direction: ${value} — reversed directions are per-variant overrides (layoutByProp), not extracted`);
      }
      continue;
    }
    if (prop === 'align-items' && ALIGN_INV[value]) {
      layout.align = ALIGN_INV[value];
      continue;
    }
    if (prop === 'justify-content' && JUSTIFY_INV[value]) {
      layout.justify = JUSTIFY_INV[value];
      continue;
    }
    if (prop === 'flex' && value === '1 1 auto') {
      layout.grow = true;
      continue;
    }
    if (prop === 'position' && value === 'absolute') {
      absolute = true;
      continue;
    }
    if (prop === 'animation') {
      if (value.startsWith('ds-spin')) out.animation = 'spin';
      else if (value.startsWith('ds-pulse')) out.animation = 'pulse';
      else notes.push(`css: ${selector} animation "${value}" — not a generator animation, not extracted`);
      continue;
    }
    if (absolute && ['top', 'bottom', 'left', 'right'].includes(prop)) {
      insets.set(prop, value);
      continue;
    }
    const varMatch = value.match(VAR_RE);
    if (varMatch) {
      const path = resolveVar(varMatch[1], `${selector} { ${prop} }`, index, notes, () => mint(prop, value));
      if (path) out.tokens[prop] = `{${path}}`;
      continue;
    }
    if (value.includes('var(')) {
      // A single var() WITH a fallback is still one bindable site — the token
      // index cannot spell it, but the mint pass can value it.
      if (splitTopLevel(value).length === 1 && value.startsWith('var(')) mint(prop, value);
      notes.push(`css: ${selector} { ${prop}: ${value} } — var() inside a shorthand is not invertible to a single binding, not extracted`);
      continue;
    }
    if (isTokenizableLiteral(prop, value)) {
      rawValues.push({ selector, property: prop, value, candidates: candidatesByValue(index, value) });
      mint(prop, value);
    } else {
      notes.push(`css: ${selector} { ${prop}: ${value} } — no inversion rule, not extracted`);
    }
  }

  if (absolute) {
    const key = ['top', 'bottom', 'left', 'right'].map((k) => `${k}:${insets.get(k) ?? ''}`).join(';');
    const PLACEMENTS: Record<string, 'top' | 'bottom' | 'start' | 'end'> = {
      'top:;bottom:100%;left:0;right:': 'top',
      'top:100%;bottom:;left:0;right:': 'bottom',
      'top:0;bottom:;left:;right:100%': 'start',
      'top:0;bottom:;left:100%;right:': 'end',
    };
    if (PLACEMENTS[key]) out.overlay = { placement: PLACEMENTS[key] };
    else notes.push(`css: ${selector} position:absolute with insets (${key}) — not a generator overlay placement, not extracted`);
  }
  if (Object.keys(layout).length > 0) out.layout = layout;
  return out;
}

// ---------------------------------------------------------------------------
// Substitution template inference (.variant-primary → {…{variant}…})
// ---------------------------------------------------------------------------

/** Given per-enum-value token paths for one css property, find the unique
 *  template T with T.replaceAll('{axis}', v) === path(v) for every value.
 *  Prefers a template whose placeholder occupies a whole dot segment. */
function inferTemplate(
  axis: string,
  values: string[],
  pathByValue: Map<string, string>,
): string | null {
  const v0 = values[0];
  const p0 = pathByValue.get(v0)!;
  const candidates: string[] = [];
  for (let i = p0.indexOf(v0); i !== -1; i = p0.indexOf(v0, i + 1)) {
    const pre = p0.slice(0, i);
    const suf = p0.slice(i + v0.length);
    if (values.every((v) => pathByValue.get(v) === pre + v + suf)) {
      candidates.push(`${pre}{${axis}}${suf}`);
    }
  }
  const uniq = [...new Set(candidates)];
  if (uniq.length === 0) return null;
  if (uniq.length === 1) return uniq[0];
  const segmental = uniq.filter((t) => {
    const idx = t.indexOf(`{${axis}}`);
    const before = t.slice(0, idx);
    const after = t.slice(idx + axis.length + 2);
    return (before === '' || before.endsWith('.')) && (after === '' || after.startsWith('.') || after.startsWith('-'));
  });
  return segmental.length >= 1 ? segmental[0] : null;
}

// ---------------------------------------------------------------------------
// CSS → per-part styles, root states, substituted refs
// ---------------------------------------------------------------------------

const STATE_SELECTOR_INV: Record<string, string> = {
  ':hover:not(:disabled)': 'hover',
  ':hover': 'hover',
  ':active': 'active',
  ':focus-visible': 'focus-visible',
  ':disabled': 'disabled',
};
/** `:not(…)` guards that only exclude other interaction states are cascade
 *  bookkeeping, not meaning — `:hover:not(:active, :disabled)` IS the hover
 *  state. Stripped before the state lookup; anything else stays unmatched. */
const STATE_GUARD_RE = /:not\(\s*(?::(?:active|disabled|hover)\s*,?\s*)+\)/g;
const stateOfPseudo = (pseudo: string): string | undefined =>
  STATE_SELECTOR_INV[pseudo.replace(STATE_GUARD_RE, '')];
/** A pseudo suffix is "simple" when it is only chained pseudo-classes (with
 *  optional parenthesized arguments) — no descendants, no extra classes. */
const SIMPLE_PSEUDO_RE = /^(?::[\w-]+(?:\([^)]*\))?)*$/;
const STATE_ORDER = ['hover', 'active', 'focus-visible', 'disabled'];

/** How the JSX spells its CSS classes — the referee for BEM-style modules
 *  where class names do NOT equal part/axis names (block__element,
 *  block--modifier). Built by the JSX walk, consumed by analyzeCss. The
 *  generator's own spelling (class = part name, `axis-value` modifiers)
 *  needs none of this and keeps working unchanged. */
export interface ClassMap {
  /** The root element's CSS-module class ('root' in generator output). */
  rootClass: string | null;
  /** css class → enum axis value, from root className modifier templates
   *  (`styles[\`block--${variant}\`]` × the axis's declared values). */
  axisValueByClass: Map<string, { axis: string; value: string }>;
  /** css class → boolean prop, from `flag && styles['block--x']`. */
  boolPropByClass: Map<string, string>;
  /** css class → canonical extracted part name (`block__icon-left` → iconLeft). */
  partNameByClass: Map<string, string>;
}

const emptyClassMap = (): ClassMap => ({
  rootClass: null,
  axisValueByClass: new Map(),
  boolPropByClass: new Map(),
  partNameByClass: new Map(),
});

interface CssModel {
  partStyles: Map<string, PartStyle>;
  /** root substituted tokens merged in partStyles.get('root').tokens */
  rootStates: Record<string, Record<string, string>>;
  statesSeen: Set<string>;
  /** part → overlap gap ref (from `.x > * + * { margin-left: var(…) }`) */
  overlapGap: Map<string, string>;
  cssPartNames: Set<string>;
}

function analyzeCss(
  css: string,
  enumProps: Map<string, string[]>,
  index: TokenIndex,
  notes: string[],
  rawValues: RawValueFinding[],
  classes: ClassMap,
  mintables: CodeMintFinding[],
): CssModel {
  const rules = parseCss(css, notes);
  const partStyles = new Map<string, PartStyle>();
  const rootStates: Record<string, Record<string, string>> = {};
  const statesSeen = new Set<string>();
  const overlapGap = new Map<string, string>();
  const cssPartNames = new Set<string>();

  // axis-value class detection: the generator's "variant-primary" spelling,
  // or a JSX-discovered BEM modifier ("cbds-c-button--primary").
  const axisValueOf = (cls: string): { axis: string; value: string } | null => {
    for (const [axis, values] of enumProps) {
      for (const v of values) {
        if (cls === `${axis}-${v}`) return { axis, value: v };
      }
    }
    return classes.axisValueByClass.get(cls) ?? null;
  };
  /** Canonical part name for a css class — 'root' for the root class. */
  const partNameOf = (cls: string): string =>
    cls === 'root' || cls === classes.rootClass ? 'root' : (classes.partNameByClass.get(cls) ?? cls);

  // buckets for substituted-ref inference
  // key: `${target} ${state} ${axis} ${cssProp}` → value → path
  const subst = new Map<string, Map<string, string>>();
  const substMeta = new Map<string, { target: string; state: string; axis: string; cssProp: string; selector: string }>();
  const bucket = (target: string, state: string, axis: string, cssProp: string, selector: string) => {
    const key = [target, state, axis, cssProp].join(' ');
    if (!subst.has(key)) {
      subst.set(key, new Map());
      substMeta.set(key, { target, state, axis, cssProp, selector });
    }
    return subst.get(key)!;
  };

  const ensure = (name: string): PartStyle => {
    if (!partStyles.has(name)) partStyles.set(name, { tokens: {} });
    return partStyles.get(name)!;
  };

  /** Mint-capture sink bound to one rule's part/state/axis context. */
  const mintSink = (
    selector: string,
    part: string,
    state?: string,
    axis?: { prop: string; value: string },
  ): MintSink => (cssProperty, raw) =>
    mintables.push({
      selector,
      part,
      cssProperty,
      ...(state ? { state } : {}),
      ...(axis ? { axis } : {}),
      raw,
    });

  const LAYOUT_PROPS = new Set(['display', 'flex-direction', 'align-items', 'justify-content']);
  const collectVarDecls = (
    rule: CssRule,
    onPath: (cssProp: string, path: string) => void,
    mint: MintSink,
  ) => {
    for (const { prop, value } of expandShorthands(rule.decls)) {
      if (GENERATOR_ARTIFACTS.has(`${prop}:${value}`)) continue;
      const m = value.match(VAR_RE);
      if (m) {
        const path = resolveVar(m[1], `${rule.selector} { ${prop} }`, index, notes, () => mint(prop, value));
        if (path) onPath(prop, path);
      } else if (value.includes('var(')) {
        if (splitTopLevel(value).length === 1 && value.startsWith('var(')) mint(prop, value);
        notes.push(`css: ${rule.selector} { ${prop}: ${value} } — var() inside a shorthand is not invertible to a single binding, not extracted`);
      } else if (LAYOUT_PROPS.has(prop)) {
        notes.push(
          `css: ${rule.selector} { ${prop}: ${value} } — a per-variant layout override (contract layoutByProp); not extracted, author it against design intent`,
        );
      } else {
        rawValues.push({ selector: rule.selector, property: prop, value, candidates: candidatesByValue(index, value) });
        if (isTokenizableLiteral(prop, value)) mint(prop, value);
      }
    }
  };

  for (const rule of rules) {
    const sel = rule.selector;
    let m: RegExpMatchArray | null;

    // `.x > * + *` — overlap gap emitted as negative-margin sibling rule
    if ((m = sel.match(/^\.([\w-]+)\s*>\s*\*\s*\+\s*\*$/))) {
      const gapDecl = rule.decls.find((d) => d.prop === 'margin-left' && VAR_RE.test(d.value));
      if (gapDecl) {
        const path = resolveVar(gapDecl.value.match(VAR_RE)![1], `${sel} { margin-left }`, index, notes);
        if (path) overlapGap.set(m[1], `{${path}}`);
      } else {
        notes.push(`css: selector \`${sel}\` — sibling rule without a var() margin, not extracted`);
      }
      continue;
    }

    // `.x svg { width/height }` — icon sizing, reported not modeled
    if (/^\.[\w-]+\s+svg$/.test(sel)) {
      notes.push(`css: selector \`${sel}\` — icon glyph sizing, not extracted (icon parts are review items)`);
      continue;
    }

    // single class, optionally with a state pseudo suffix
    if ((m = sel.match(/^\.([\w-]+)((?::.*)?)$/)) && SIMPLE_PSEUDO_RE.test(m[2])) {
      const cls = m[1];
      const pseudo = m[2];
      const av = axisValueOf(cls);
      const boolProp = classes.boolPropByClass.get(cls);
      if (boolProp !== undefined) {
        // Boolean-modifier styling has no extractable contract channel
        // (stylesWhen is authored against design intent, not inverted).
        notes.push(
          `css: .${cls}${pseudo} — styles behind boolean prop "${boolProp}" (${rule.decls.length} declaration(s)); boolean-conditional styling is not extractable into anatomy, review by name`,
        );
        continue;
      }
      if (!pseudo) {
        if (av) {
          collectVarDecls(rule, (cssProp, path) => {
            bucket('root', '', av.axis, cssProp, sel).set(av.value, path);
          }, mintSink(sel, 'root', undefined, { prop: av.axis, value: av.value }));
        } else {
          const partName = partNameOf(cls);
          cssPartNames.add(partName);
          const style = invertDecls(sel, rule.decls, index, notes, rawValues, mintSink(sel, partName));
          const existing = ensure(partName);
          Object.assign(existing.tokens, style.tokens);
          if (style.layout) existing.layout = { ...existing.layout, ...style.layout };
          if (style.overlay) existing.overlay = style.overlay;
          if (style.animation) existing.animation = style.animation;
        }
        continue;
      }
      const state = stateOfPseudo(pseudo);
      if (!state) {
        notes.push(`css: selector \`${sel}\` — pseudo "${pseudo}" is not a contract state, not extracted`);
        continue;
      }
      statesSeen.add(state);
      if (partNameOf(cls) === 'root' && !av) {
        collectVarDecls(rule, (cssProp, path) => {
          (rootStates[state] ??= {})[cssProp] = `{${path}}`;
        }, mintSink(sel, 'root', state));
      } else if (av) {
        collectVarDecls(rule, (cssProp, path) => {
          bucket('root', state, av.axis, cssProp, sel).set(av.value, path);
        }, mintSink(sel, 'root', state, { prop: av.axis, value: av.value }));
      } else {
        notes.push(`css: selector \`${sel}\` — part-scoped state pseudo; the contract vocabulary carries part-level states (Part.states, v13 — as \`.root${pseudo} .part\` descendant rules) but CSS inversion of this shape is not implemented; declare it on the contract directly, review`);
      }
      continue;
    }

    // descendant with a state pseudo: `.root:disabled .label` — the shape
    // the v13 Part.states vocabulary EMITS (generateCss part-state rules).
    // Inversion (CSS → contract) is not implemented; the skip is a PRECISE
    // named note now that authored contracts can carry the channel — the
    // narrow remainder of STYLE-FIDELITY B7 (the design-side proposer DOES
    // propose part-level state overrides from drawn state variants).
    if ((m = sel.match(/^\.([\w-]+)(:[^\s]+)\s+\.([\w-]+)$/))) {
      notes.push(
        `css: selector \`${sel}\` — part-level state rule; the contract vocabulary carries it (Part.states, v13 — color-kind channels) but CSS inversion of part-state rules is not implemented; declare it on the contract directly, review`,
      );
      continue;
    }

    // descendant: `.axis-value .part` (nested substituted ref)
    if ((m = sel.match(/^\.([\w-]+)\s+\.([\w-]+)$/))) {
      const av = axisValueOf(m[1]);
      const partName = partNameOf(m[2]);
      if (av) {
        cssPartNames.add(partName);
        collectVarDecls(rule, (cssProp, path) => {
          bucket(partName, '', av.axis, cssProp, sel).set(av.value, path);
        }, mintSink(sel, partName, undefined, { prop: av.axis, value: av.value }));
      } else {
        notes.push(`css: selector \`${sel}\` — descendant rule not under an enum class, not extracted`);
      }
      continue;
    }

    notes.push(`css: selector \`${sel}\` — not extractable into anatomy, skipped by name`);
  }

  // resolve substitution buckets into templates
  for (const [key, byValue] of subst) {
    const { target, state, axis, cssProp, selector } = substMeta.get(key)!;
    const values = enumProps.get(axis)!;
    let covered = values.filter((v) => byValue.has(v));
    if (covered.length < values.length) {
      // BEM modules often emit NO class for the default value (`variant !==
      // "primary" && …`) — the base rule carries that value's declaration.
      // Fill the gap from the base binding (the cascade's own semantics)
      // when one exists; anything still missing stays a named refusal.
      const missing = values.filter((v) => !byValue.has(v));
      const baseRef = state
        ? rootStates[state]?.[cssProp]
        : partStyles.get(target)?.tokens[cssProp];
      const basePath = baseRef?.match(/^\{([a-z0-9.-]+)\}$/i)?.[1];
      if (basePath !== undefined) {
        for (const v of missing) byValue.set(v, basePath);
        notes.push(
          `css: ${selector} — "${axis}" classes cover ${covered.length}/${values.length} values for "${cssProp}"; ${missing.join(', ')} filled from the base rule (the cascade's default)`,
        );
        covered = values;
      }
    }
    if (covered.length < values.length) {
      notes.push(
        `css: ${selector} — enum class rules for "${axis}" cover ${covered.length}/${values.length} values for "${cssProp}"; substituted binding not proposed (partial coverage)`,
      );
      continue;
    }
    const template = inferTemplate(axis, values, byValue);
    if (!template) {
      notes.push(
        `css: "${cssProp}" across .${axis}-* classes has no consistent substitution template (${values.map((v) => byValue.get(v)).join(', ')}) — not proposed`,
      );
      continue;
    }
    const ref = `{${template}}`;
    if (state) {
      if (target === 'root') (rootStates[state] ??= {})[cssProp] = ref;
    } else if (target === 'root') {
      ensure('root').tokens[cssProp] = ref;
    } else {
      ensure(target).tokens[cssProp] = ref;
    }
  }

  return { partStyles, rootStates, statesSeen, overlapGap, cssPartNames };
}

// ---------------------------------------------------------------------------
// JSX → part tree
// ---------------------------------------------------------------------------

/** Phase B: fragments joined the walkable set — a fragment root is the code
 *  spelling of MULTI-ROOT anatomy (DropdownMenu returns <> trigger + overlay). */
type JsxEl = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;

const EMPTY_JSX_ATTRS = { properties: [] as unknown } as ts.JsxAttributes;

function tagNameOf(el: JsxEl): string {
  if (ts.isJsxFragment(el)) return '<>';
  const tag = ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName;
  return tag.getText();
}
function attributesOf(el: JsxEl): ts.JsxAttributes {
  if (ts.isJsxFragment(el)) return EMPTY_JSX_ATTRS;
  return ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const camelize = (s: string) => lowerFirst(s.replace(/[-_]+(\w)/g, (_, c: string) => c.toUpperCase()));

interface JsxContext {
  sf: ts.SourceFile;
  propKind: Map<string, ExtractedProp['kind']>;
  rootClassVars: Set<string>;
  notes: string[];
  /** part name → handler name, from onClick={handleX} */
  clickHandlers: Map<string, string>;
  /** part name → aria state attr present as an expression (checked/…) */
  ariaOnPart: Map<string, string>;
  /** JSX → CSS class spelling (BEM-aware); shared with analyzeCss. */
  bem: ClassMap;
  /** StyleX mode (Phase B): identifiers bound by `stylex.create({...})` in
   *  this file — part identity reads `{...stylex.props(styles.x)}` spreads
   *  instead of className. null = CSS-module mode. */
  stylexTables: Map<string, Map<string, ts.ObjectLiteralExpression>> | null;
  /** Phase B: render-helper functions resolvable by name — same-file
   *  declarations plus co-located sibling sources the adapter supplies.
   *  A `{renderX(items)}` call inlines the helper's component JSX as a
   *  repeat template (union branches reported by name, never merged). */
  helperFns: Map<string, ts.FunctionLikeDeclaration>;
  /** Phase B: top-level `const x = …` initializers in the component body —
   *  ONE resolution hop for render indirection (`const menuContent = items
   *  ? renderItems(items) : children; … {menuContent}`). */
  localInits: Map<string, ts.Expression>;
}

/** Collect named function declarations + arrow consts across source files —
 *  the resolvable render-helper universe (same file + co-located siblings). */
function collectHelperFns(sfs: ts.SourceFile[]): Map<string, ts.FunctionLikeDeclaration> {
  const out = new Map<string, ts.FunctionLikeDeclaration>();
  for (const sf of sfs) {
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name && !out.has(node.name.text)) {
        out.set(node.name.text, node);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
        !out.has(node.name.text)
      ) {
        out.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

/** The distinct top-level component JSX elements inside a helper body —
 *  occurrences counted without descending into a recorded element (a nested
 *  <Icon> inside a recorded <DropdownMenuItem> belongs to the template, not
 *  the union). */
function helperComponentJsx(fn: ts.FunctionLikeDeclaration): Map<string, { el: JsxEl; count: number }> {
  const found = new Map<string, { el: JsxEl; count: number }>();
  const visit = (node: ts.Node) => {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && /^[A-Z]/.test(tagNameOf(node))) {
      const tag = tagNameOf(node);
      const cur = found.get(tag);
      if (cur) cur.count++;
      else found.set(tag, { el: node, count: 1 });
      return; // don't descend — children belong to this template
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return found;
}

/** StyleX (Phase B, Astryx composition tier): components style via
 *  `{...stylex.props(styles.x, cond && styles.y, dynamicStyles.z(...))}`
 *  SPREADS — there is no className attribute and no CSS Module. Part
 *  identity comes from the FIRST plain rule reference off any identifier
 *  bound by `stylex.create({...})` in the file. Astryx additionally wraps
 *  the spread in `mergeProps(themeProps(...), stylex.props(...), ...)`;
 *  the reader unwraps one mergeProps level. Conditional/dynamic rule
 *  references are modifiers — reported, never guessed. */
function collectStylexTables(sf: ts.SourceFile): Map<string, Map<string, ts.ObjectLiteralExpression>> {
  const tables = new Map<string, Map<string, ts.ObjectLiteralExpression>>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const callee = node.initializer.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.expression.getText() === 'stylex' &&
        callee.name.text === 'create'
      ) {
        const rules = new Map<string, ts.ObjectLiteralExpression>();
        const arg = node.initializer.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const p of arg.properties) {
            if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name))) {
              const ruleName = ts.isIdentifier(p.name) ? p.name.text : p.name.text;
              const init = unparen(p.initializer);
              if (ts.isObjectLiteralExpression(init)) rules.set(ruleName, init);
              // dynamic rules ((w, h) => ({...})) stay name-only: identity
              // works, styling is a review item.
              else if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init))) rules.set(ruleName, undefined as unknown as ts.ObjectLiteralExpression);
            }
          }
        }
        tables.set(node.name.text, rules);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return tables;
}

/** Kebab-case a StyleX camelCase property. */
const kebabProp = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** CSS props whose numeric values are unitless (everything else gets px —
 *  the CSS-in-JS number convention StyleX follows). */
const UNITLESS = new Set(['line-height', 'opacity', 'z-index', 'flex-grow', 'flex-shrink', 'order', 'font-weight', 'aspect-ratio', 'flex']);

/** One StyleX rule object → CssDecl[] — the seam that makes invertDecls
 *  (layout channels, resolveVar token refereeing, raw-value receipts,
 *  shorthand expansion) reusable verbatim for StyleX. Token-var member
 *  accesses (`colorVars['--color-accent']`) re-spell as `var(--color-accent)`
 *  so the SAME TokenIndex referee decides every binding; `--_private` local
 *  vars resolve one hop; pseudo/conditional value maps take their 'default'
 *  branch and report the state branches by name (the state round's work). */
function stylexRuleToDecls(
  rule: ts.ObjectLiteralExpression,
  selector: string,
  notes: string[],
): CssDecl[] {
  const localVars = new Map<string, string>();
  const decls: CssDecl[] = [];
  const cssTextOf = (e0: ts.Expression, prop: string): string | null => {
    const e = unparen(e0);
    if (ts.isStringLiteralLike(e)) return e.text;
    if (ts.isNumericLiteral(e)) return UNITLESS.has(prop) || e.text === '0' ? e.text : `${e.text}px`;
    if (ts.isPrefixUnaryExpression(e) && ts.isNumericLiteral(e.operand)) return `-${e.operand.text}${UNITLESS.has(prop) ? '' : 'px'}`;
    if (e.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isElementAccessExpression(e) && ts.isStringLiteralLike(e.argumentExpression)) {
      const key = e.argumentExpression.text;
      if (key.startsWith('--')) return `var(${key})`;
    }
    if (ts.isTemplateExpression(e)) {
      let out2 = e.head.text;
      for (const span of e.templateSpans) {
        const inner = cssTextOf(span.expression, prop);
        if (inner === null) return null;
        out2 += inner + span.literal.text;
      }
      return out2;
    }
    if (ts.isObjectLiteralExpression(e)) {
      // pseudo/conditional map: { default: x, ':hover': y, '::backdrop': z }
      let dflt: string | null = null;
      const stateKeys: string[] = [];
      for (const p of e.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const key = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteralLike(p.name) ? p.name.text : '';
        if (key === 'default') dflt = cssTextOf(p.initializer, prop);
        else if (key) stateKeys.push(key);
      }
      if (stateKeys.length > 0) {
        notes.push(`stylex: ${selector} ${prop} carries state branch(es) [${stateKeys.join(', ')}] — default extracted; states are a named review item this round`);
      }
      return dflt;
    }
    return null;
  };
  for (const p of rule.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const rawName = ts.isIdentifier(p.name) ? p.name.text : ts.isStringLiteralLike(p.name) ? p.name.text : null;
    if (rawName === null) continue;
    const prop = rawName.startsWith('--') ? rawName : kebabProp(rawName);
    const text = cssTextOf(p.initializer, prop);
    if (text === null) {
      if (!rawName.startsWith(':') && !rawName.startsWith('::')) {
        notes.push(`stylex: ${selector} ${prop} — value not extractable (${unparen(p.initializer).getText().slice(0, 50)}), reported not guessed`);
      }
      continue;
    }
    if (prop.startsWith('--')) {
      localVars.set(prop, text);
      continue;
    }
    decls.push({ prop, value: text });
  }
  // One-hop local var resolution: borderRadius: 'var(--_dialog-radius)'.
  return decls.map((d) => {
    const m = d.value.match(/^var\((--_[a-z0-9-]+)\)$/i);
    const local = m ? localVars.get(m[1]) : undefined;
    return local ? { prop: d.prop, value: local } : d;
  });
}

/** The StyleX twin of analyzeCss: every stylex.create rule inverts through
 *  the SAME invertDecls engine into the SAME CssModel shape, so the part
 *  attachment path is shared verbatim. */
function analyzeStylex(
  tables: Map<string, Map<string, ts.ObjectLiteralExpression>>,
  ctx: JsxContext,
  index: TokenIndex,
  notes: string[],
  rawValues: RawValueFinding[],
): CssModel {
  const partStyles = new Map<string, PartStyle>();
  const cssPartNames = new Set<string>();
  const noMint: MintSink = () => {};
  for (const [tableName, rules] of tables) {
    for (const [ruleName, ruleObj] of rules) {
      if (!ruleObj) continue; // dynamic rule — identity only
      const partName = ruleName === 'root' || ruleName === ctx.bem.rootClass ? 'root' : partNameFromClass(ruleName, ctx);
      const selector = `${tableName}.${ruleName}`;
      const decls = stylexRuleToDecls(ruleObj, selector, notes);
      if (decls.length === 0) continue;
      const style = invertDecls(selector, decls, index, notes, rawValues, noMint);
      const existing = partStyles.get(partName);
      if (existing) {
        existing.tokens = { ...style.tokens, ...existing.tokens };
        existing.layout = { ...style.layout, ...existing.layout };
      } else {
        partStyles.set(partName, style);
      }
      cssPartNames.add(partName);
    }
  }
  return { partStyles, rootStates: {}, statesSeen: new Set(), overlapGap: new Map(), cssPartNames };
}

/** A rule reference off a stylex.create table: `styles.x`, `styles["x"]`,
 *  or a dynamic-rule call `dynamicStyles.x(...)`. Returns the rule name. */
function stylexRuleOf(e: ts.Expression, tables: Map<string, Map<string, ts.ObjectLiteralExpression>>): string | null {
  const target = ts.isCallExpression(e) ? e.expression : e;
  if (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    tables.has(target.expression.text)
  ) {
    return target.name.text;
  }
  if (
    ts.isElementAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    tables.has(target.expression.text) &&
    ts.isStringLiteralLike(target.argumentExpression)
  ) {
    return target.argumentExpression.text;
  }
  return null;
}

function stylexClassOf(
  el: JsxEl,
  ctx: JsxContext,
): { kind: 'part'; name: string } | { kind: 'root' } | { kind: 'none' } {
  const tables = ctx.stylexTables;
  if (!tables || tables.size === 0) return { kind: 'none' };
  const propsCalls: ts.CallExpression[] = [];
  const collectPropsCalls = (e: ts.Expression) => {
    const u = unparen(e);
    if (ts.isCallExpression(u)) {
      const callee = u.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.expression.getText() === 'stylex' && callee.name.text === 'props') {
        propsCalls.push(u);
        return;
      }
      // mergeProps(themeProps(...), stylex.props(...), className, style)
      if (ts.isIdentifier(callee) && callee.text === 'mergeProps') {
        for (const arg of u.arguments) collectPropsCalls(arg as ts.Expression);
      }
    }
  };
  for (const attr of attributesOf(el).properties) {
    if (ts.isJsxSpreadAttribute(attr)) collectPropsCalls(attr.expression);
  }
  for (const call of propsCalls) {
    const modifiers: string[] = [];
    let name: string | null = null;
    for (const rawArg of call.arguments) {
      const arg = unparen(rawArg as ts.Expression);
      // conditional modifier: `cond && styles.x` / spread of container(...) etc.
      if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const rule = stylexRuleOf(unparen(arg.right), tables);
        if (rule !== null) modifiers.push(rule);
        continue;
      }
      const rule = stylexRuleOf(arg, tables);
      if (rule !== null && name === null) {
        name = rule;
        continue;
      }
      if (rule !== null) modifiers.push(rule);
    }
    if (name !== null) {
      if (modifiers.length > 0) {
        ctx.notes.push(
          `stylex: <${tagNameOf(el)}> rule "${name}" carries conditional/extra rule(s) [${modifiers.join(', ')}] — modifiers reported, not extracted`,
        );
      }
      return name === 'root' || name === ctx.bem.rootClass ? { kind: 'root' } : { kind: 'part', name: partNameFromClass(name, ctx) };
    }
  }
  return { kind: 'none' };
}

/** `styles.x` / `styles["x"]` → the class name; anything else null. */
function stylesClassOf(e: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(e) && e.expression.getText() === 'styles') return e.name.text;
  if (
    ts.isElementAccessExpression(e) &&
    e.expression.getText() === 'styles' &&
    ts.isStringLiteralLike(e.argumentExpression)
  ) {
    return e.argumentExpression.text;
  }
  return null;
}

/** `styles[\`head${ident}tail\`]` → the modifier template; else null. */
function stylesTemplateOf(e: ts.Expression): { head: string; ident: string; tail: string } | null {
  if (
    ts.isElementAccessExpression(e) &&
    e.expression.getText() === 'styles' &&
    ts.isTemplateExpression(e.argumentExpression) &&
    e.argumentExpression.templateSpans.length === 1 &&
    ts.isIdentifier(e.argumentExpression.templateSpans[0].expression)
  ) {
    const t = e.argumentExpression;
    return { head: t.head.text, ident: (t.templateSpans[0].expression as ts.Identifier).text, tail: t.templateSpans[0].literal.text };
  }
  return null;
}

/** A part's canonical name for a CSS-module class: BEM `block__icon-left`
 *  under the discovered root class camelizes its element segment; anything
 *  else camelizes the whole class (the generator's classes are already
 *  camelCase part names, so they pass through unchanged). Registered in the
 *  ClassMap so analyzeCss attaches the class's styles to the same name. */
function partNameFromClass(cls: string, ctx: JsxContext): string {
  const known = ctx.bem.partNameByClass.get(cls);
  if (known) return known;
  const root = ctx.bem.rootClass;
  const stem = root && cls.startsWith(`${root}__`) ? cls.slice(root.length + 2) : cls;
  const name = camelize(stem);
  ctx.bem.partNameByClass.set(cls, name);
  return name;
}

function classNameOf(el: JsxEl, ctx: JsxContext): { kind: 'part'; name: string } | { kind: 'root' } | { kind: 'none' } | { kind: 'opaque'; text: string } {
  for (const attr of attributesOf(el).properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== 'className') continue;
    const init = attr.initializer;
    if (!init) return { kind: 'opaque', text: '(bare className)' };
    if (ts.isStringLiteral(init)) return { kind: 'opaque', text: JSON.stringify(init.text) };
    if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression;
      if (ts.isPropertyAccessExpression(e) && e.expression.getText() === 'styles') {
        return e.name.text === 'root' || e.name.text === ctx.bem.rootClass
          ? { kind: 'root' }
          : { kind: 'part', name: partNameFromClass(e.name.text, ctx) };
      }
      const cls = stylesClassOf(e);
      if (cls !== null) {
        return cls === 'root' || cls === ctx.bem.rootClass
          ? { kind: 'root' }
          : { kind: 'part', name: partNameFromClass(cls, ctx) };
      }
      if (ts.isIdentifier(e) && ctx.rootClassVars.has(e.text)) return { kind: 'root' };
      // clsx/classnames on a nested part: the first plain styles ref names
      // the part; modifier arguments are reported, not guessed.
      if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && /^(clsx|classnames|classNames|cx)$/.test(e.expression.text)) {
        for (const arg of e.arguments) {
          const argCls = stylesClassOf(unparen(arg as ts.Expression));
          if (argCls !== null) {
            if (argCls === 'root' || argCls === ctx.bem.rootClass) return { kind: 'root' }; // readRootClasses already noted it
            if (e.arguments.length > 1) {
              ctx.notes.push(
                `jsx: <${tagNameOf(el)}> className ${e.expression.text}(…) — read as class "${argCls}"; the other ${e.arguments.length - 1} argument(s) are modifiers, not extracted`,
              );
            }
            return { kind: 'part', name: partNameFromClass(argCls, ctx) };
          }
        }
      }
      return { kind: 'opaque', text: e.getText().slice(0, 60) };
    }
    return { kind: 'opaque', text: init.getText().slice(0, 60) };
  }
  // No className attribute at all — in StyleX mode, part identity rides the
  // {...stylex.props(styles.x)} spread instead.
  if (ctx.stylexTables) return stylexClassOf(el, ctx);
  return { kind: 'none' };
}

/**
 * Read the ROOT element's className expression into the ClassMap — the step
 * that makes BEM modules legible. Handles the common spellings:
 *   · styles.root / styles["block"]            → the root class
 *   · clsx(styles["block"],
 *       cond && styles[`block--${axis}`],      → axis modifier classes
 *       flag && styles["block--x"],            → boolean modifier classes
 *       className)                             → passthrough plumbing, ignored
 * Anything else degrades to the existing opaque note. Returns true when a
 * root class was discovered.
 */
function readRootClasses(rootEl: JsxEl, ctx: JsxContext, enumProps: Map<string, string[]>): boolean {
  for (const attr of attributesOf(rootEl).properties) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText() !== 'className') continue;
    const init = attr.initializer;
    if (!init || !ts.isJsxExpression(init) || !init.expression) return false;
    const e = init.expression;
    const plain = stylesClassOf(e);
    if (plain !== null) {
      ctx.bem.rootClass = plain;
      return true;
    }
    if (!ts.isCallExpression(e) || !ts.isIdentifier(e.expression) || !/^(clsx|classnames|classNames|cx)$/.test(e.expression.text)) {
      return false;
    }
    const unread: string[] = [];
    const axisNotes: string[] = [];
    for (const rawArg of e.arguments) {
      const arg = unparen(rawArg as ts.Expression);
      const cls = stylesClassOf(arg);
      if (cls !== null) {
        if (ctx.bem.rootClass === null) ctx.bem.rootClass = cls;
        else unread.push(`styles ref "${cls}" beyond the first — role unclear`);
        continue;
      }
      if (ts.isIdentifier(arg) && arg.text === 'className') continue; // consumer passthrough — plumbing
      if (ts.isBinaryExpression(arg) && arg.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const right = unparen(arg.right);
        const template = stylesTemplateOf(right);
        if (template && enumProps.has(template.ident)) {
          for (const v of enumProps.get(template.ident)!) {
            ctx.bem.axisValueByClass.set(`${template.head}${v}${template.tail}`, { axis: template.ident, value: v });
          }
          axisNotes.push(`${template.head}\${${template.ident}}${template.tail} → "${template.ident}" axis`);
          continue;
        }
        const rightCls = right === undefined ? null : stylesClassOf(right);
        const cond = unparen(arg.left);
        if (rightCls !== null && ts.isIdentifier(cond) && ctx.propKind.get(cond.text) === 'boolean') {
          ctx.bem.boolPropByClass.set(rightCls, cond.text);
          continue;
        }
        unread.push(arg.getText().replace(/\s+/g, ' ').slice(0, 60));
        continue;
      }
      unread.push(arg.getText().replace(/\s+/g, ' ').slice(0, 60));
    }
    if (ctx.bem.rootClass !== null) {
      ctx.notes.push(
        `jsx: root className ${e.expression.text}(…) read — root class ".${ctx.bem.rootClass}"${
          axisNotes.length > 0 ? `; modifier classes: ${axisNotes.join(', ')}` : ''
        }${
          ctx.bem.boolPropByClass.size > 0
            ? `; boolean modifier class(es): ${[...ctx.bem.boolPropByClass.entries()].map(([c, p]) => `.${c} (${p})`).join(', ')}`
            : ''
        }`,
      );
      for (const u of unread) {
        ctx.notes.push(`jsx: root className argument \`${u}\` — not readable as a class binding, skipped by name`);
      }
      return true;
    }
    return false;
  }
  return false;
}

/** Literal/expression attributes → contract attrs, minus event/plumbing. */
function attrsOf(el: JsxEl, partName: string, isRoot: boolean, hasOnClick: boolean, ctx: JsxContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of attributesOf(el).properties) {
    if (ts.isJsxSpreadAttribute(attr)) continue; // {...rest}
    const name = attr.name.getText();
    if (['className', 'ref', 'key', 'style'].includes(name)) continue;
    if (name === 'dangerouslySetInnerHTML') continue; // icon glyph — reported by caller
    if (name === 'type' && hasOnClick) continue; // generator adds type="button" to triggers
    if (/^on[A-Z]/.test(name)) {
      // onChange on a native input is the checkable-control trigger wiring
      // (the generator's native checkbox/switch shape) — same channel as
      // onClick on a button trigger.
      const isTriggerHandler =
        name === 'onClick' || (name === 'onChange' && tagNameOf(el) === 'input');
      if (isTriggerHandler && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isIdentifier(attr.initializer.expression)) {
        ctx.clickHandlers.set(isRoot ? 'root' : partName, attr.initializer.expression.text);
      } else if (!isTriggerHandler) {
        ctx.notes.push(`jsx: <${tagNameOf(el)}> handler "${name}" — only onClick/onChange trigger wiring is extracted`);
      }
      continue;
    }
    const init = attr.initializer;
    if (init === undefined) continue; // bare boolean attr — plumbing
    if (ts.isStringLiteral(init)) {
      out[name] = init.text;
      continue;
    }
    if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression;
      const ariaState = name.match(/^aria-(checked|expanded|pressed|selected)$/);
      if (ariaState) {
        ctx.ariaOnPart.set(isRoot ? 'root' : partName, ariaState[1]);
        continue;
      }
      // Native checkable input: checked={x === 'y'} is the checked-state
      // binding — the DOM-property spelling of aria-checked on the old
      // button-trigger shape. Same channel, native carrier.
      if (name === 'checked' && tagNameOf(el) === 'input') {
        ctx.ariaOnPart.set(isRoot ? 'root' : partName, 'checked');
        continue;
      }
      if (name.startsWith('aria-') || name.startsWith('data-')) continue; // bool-prop plumbing
      // {String(x)} → "{x}" (contract attrs prop-reference form)
      if (ts.isCallExpression(e) && e.expression.getText() === 'String' && e.arguments.length === 1 && ts.isIdentifier(e.arguments[0])) {
        out[name] = `{${e.arguments[0].text}}`;
        continue;
      }
      if (ts.isNumericLiteral(e)) {
        out[name] = e.text;
        continue;
      }
      ctx.notes.push(`jsx: <${tagNameOf(el)}> attribute ${name}={…} — expression not extractable, skipped`);
    }
  }
  return out;
}

/** Meaningful children of a JSX element (or fragment). */
function jsxChildren(el: JsxEl): readonly ts.JsxChild[] {
  return ts.isJsxElement(el) || ts.isJsxFragment(el) ? el.children : [];
}

const unparen = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) ? unparen(e.expression) : e;

interface BuiltPart {
  name: string;
  part: ExtractedPart;
}

function buildPart(el: JsxEl, ctx: JsxContext, condition?: ExtractedPart['visibleWhen'] | 'optional'): BuiltPart | null {
  const tag = tagNameOf(el);
  // Nested fragment → an element-less group part (rare; children walk on).
  if (ts.isJsxFragment(el)) {
    const part: ExtractedPart = {};
    fillChildren(el, part, 'group', ctx);
    applyCondition(part, condition);
    ctx.notes.push('jsx: nested Fragment extracted as an element-less "group" part — review');
    return { name: 'group', part };
  }
  // Component instance (capitalized) → component ref part
  if (/^[A-Z]/.test(tag)) {
    const props: Record<string, string | boolean> = {};
    for (const attr of attributesOf(el).properties) {
      if (ts.isJsxSpreadAttribute(attr)) continue;
      const name = attr.name.getText();
      const init = attr.initializer;
      if (init === undefined) {
        props[name] = true;
      } else if (ts.isStringLiteral(init)) {
        props[name] = init.text;
      } else if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (e.kind === ts.SyntaxKind.TrueKeyword) props[name] = true;
        else if (e.kind === ts.SyntaxKind.FalseKeyword) props[name] = false;
        else if (ts.isIdentifier(e) && ctx.propKind.has(e.text)) props[name] = `{${e.text}}`;
        else ctx.notes.push(`jsx: <${tag}> prop ${name}={…} — expression not extractable on a component ref, skipped`);
      }
    }
    let text: string | undefined;
    const kids = jsxChildren(el).filter((c) => !(ts.isJsxText(c) && c.text.trim() === ''));
    const part: ExtractedPart = {
      component: { name: tag, ...(Object.keys(props).length > 0 ? { props } : {}) },
    };
    if (kids.length === 1 && ts.isJsxText(kids[0])) {
      text = kids[0].text.trim();
      part.component = { ...part.component!, text };
    } else if (kids.length > 0) {
      // Phase B (wrapper-ref descent — the Toast→MediaTheme class): element
      // children of a component instance are its SLOT CONTENT — real
      // structure, extracted as parts nested under the ref. How the wrapper
      // maps to a contract (pass-through vs instance) is a review decision;
      // the structure itself is not lost.
      fillChildren(el, part, lowerFirst(tag), ctx);
      ctx.notes.push(
        `jsx: <${tag}> has element children — extracted as parts INSIDE the component-ref boundary (the ref's slot content); review whether <${tag}> is a pass-through wrapper before adoption`,
      );
    }
    applyCondition(part, condition);
    return { name: lowerFirst(tag), part };
  }

  const cn = classNameOf(el, ctx);
  if (cn.kind === 'root') return null; // handled by caller
  if (cn.kind !== 'part') {
    const hasGlyph = attributesOf(el).properties.some(
      (a) => ts.isJsxAttribute(a) && a.name.getText() === 'dangerouslySetInnerHTML',
    );
    if (hasGlyph) return null; // inner glyph span of an icon part — parent notes it
    ctx.notes.push(
      cn.kind === 'opaque'
        ? `jsx: <${tag}> className ${cn.text} is not a CSS-module reference — element not extracted as a part (tailwind/plain classes are review items)`
        : `jsx: <${tag}> without a CSS-module className — not extracted as a part`,
    );
    return null;
  }

  const partName = cn.name;
  const hasOnClick = attributesOf(el).properties.some(
    (a) => ts.isJsxAttribute(a) && a.name.getText() === 'onClick',
  );
  const part: ExtractedPart = {};
  part.element = tag;
  const attrs = attrsOf(el, partName, false, hasOnClick, ctx);
  const hasGlyphAttr = attributesOf(el).properties.some(
    (a) => ts.isJsxAttribute(a) && a.name.getText() === 'dangerouslySetInnerHTML',
  );
  if (hasGlyphAttr) {
    delete attrs['aria-hidden'];
    ctx.notes.push(`jsx: part "${partName}" renders an inline SVG glyph — icon asset not extracted (review item)`);
  }
  if (Object.keys(attrs).length > 0) part.attrs = attrs;
  fillChildren(el, part, partName, ctx);
  applyCondition(part, condition);
  return { name: partName, part };
}

function applyCondition(part: ExtractedPart, condition?: ExtractedPart['visibleWhen'] | 'optional') {
  if (condition === 'optional') part.optional = true;
  else if (condition) part.visibleWhen = condition;
}

function fillChildren(el: JsxEl, part: ExtractedPart, partName: string, ctx: JsxContext) {
  const kids = jsxChildren(el);
  const parts: Record<string, ExtractedPart> = {};
  const texts: string[] = [];
  let sawExpression = false;

  const addChild = (built: BuiltPart | null) => {
    if (!built) return;
    let key = built.name;
    if (parts[key]) {
      let n = 2;
      while (parts[`${key}${n}`]) n++;
      key = `${key}${n}`;
      ctx.notes.push(`jsx: duplicate part class "${built.name}" — second occurrence extracted as "${key}" (review: part names must be unique)`);
    }
    parts[key] = built.part;
  };

  // Loose {children}/{textProp} expressions BETWEEN element children need a
  // part of their own — the order-preserving spelling of "the label renders
  // between the icons". A part-less container keeps the existing channel
  // (slot/content on the container itself).
  const isElementish = (kid: ts.JsxChild): boolean => {
    if (ts.isJsxElement(kid) || ts.isJsxSelfClosingElement(kid)) return true;
    if (ts.isJsxExpression(kid) && kid.expression) {
      const e = unparen(kid.expression);
      if (ts.isConditionalExpression(e)) return true;
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return true;
    }
    return false;
  };
  const hasElementKids = kids.some(isElementish);

  /** `cond ? <el/> : null` and `cond && <el/>` share their condition
   *  vocabulary: presence (non-boolean prop) → optional, boolean prop →
   *  visibleWhen, `prop === "value"` → visibleWhen equals. */
  const conditionOf = (cond: ts.Expression): ExtractedPart['visibleWhen'] | 'optional' | undefined => {
    if (ts.isBinaryExpression(cond) && ts.isIdentifier(cond.left)) {
      const op = cond.operatorToken.kind;
      if (op === ts.SyntaxKind.ExclamationEqualsToken && cond.right.kind === ts.SyntaxKind.NullKeyword) {
        return 'optional';
      }
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isStringLiteral(cond.right)) {
        return { prop: cond.left.text, equals: cond.right.text };
      }
      return undefined;
    }
    if (ts.isIdentifier(cond)) {
      // A node/text prop used as its own guard ({icon && …}) is a
      // presence check — the part is optional, not boolean-driven.
      return ctx.propKind.get(cond.text) === 'boolean' ? { prop: cond.text } : 'optional';
    }
    return undefined;
  };

  /** Phase B: `popover.render(<jsx>, opts)` — a hook-rendered OVERLAY layer
   *  (Astryx usePopover/useLayer); the first JSX argument is the content. */
  const tryRenderCall = (e: ts.Expression): boolean => {
    if (!ts.isCallExpression(e) || !ts.isPropertyAccessExpression(e.expression) || e.expression.name.text !== 'render' || e.arguments.length === 0) {
      return false;
    }
    const layerArg = unparen(e.arguments[0] as ts.Expression);
    if (!ts.isJsxElement(layerArg) && !ts.isJsxSelfClosingElement(layerArg) && !ts.isJsxFragment(layerArg)) return false;
    const built = buildPart(layerArg, ctx);
    if (!built) return false;
    addChild(built);
    ctx.notes.push(
      `jsx: part "${partName}" renders {${e.expression.expression.getText().slice(0, 30)}.render(…)} — extracted as an OVERLAY-layer part "${built.name}" (popover/layer placement and dismissal are review items)`,
    );
    return true;
  };

  /** Phase B: `{renderX(items, …)}` — a render HELPER resolvable by name
   *  (same file or a co-located sibling). Its dominant component JSX becomes
   *  the template; an array-PROP first argument makes it a repeat part;
   *  other union branches are reported by name, never merged. */
  const tryHelperCall = (e: ts.Expression): boolean => {
    if (!ts.isCallExpression(e) || !ts.isIdentifier(e.expression) || !ctx.helperFns.has(e.expression.text)) return false;
    const helper = ctx.helperFns.get(e.expression.text)!;
    const jsxByTag = helperComponentJsx(helper);
    if (jsxByTag.size === 0) {
      ctx.notes.push(
        `jsx: part "${partName}" calls helper ${e.expression.text}(…) — helper resolved but renders no component JSX extraction can read`,
      );
      return true;
    }
    const ranked = [...jsxByTag.entries()].sort((a, b) => b[1].count - a[1].count);
    const [domTag, dom] = ranked[0];
    const firstArg = e.arguments.length > 0 ? unparen(e.arguments[0] as ts.Expression) : undefined;
    const itemsProp = firstArg && ts.isIdentifier(firstArg) && ctx.propKind.has(firstArg.text) ? firstArg.text : null;
    const built = buildPart(dom.el, ctx);
    if (!built) return false;
    if (itemsProp) built.part.repeat = { itemsProp };
    addChild(built);
    const others = ranked.slice(1).map(([t]) => `<${t}>`);
    ctx.notes.push(
      `jsx: part "${partName}" calls helper ${e.expression.text}(…) — ${
        itemsProp ? `extracted as a REPEAT part "${built.name}" over prop "${itemsProp}"` : `extracted its dominant component <${domTag}> as part "${built.name}"`
      }${others.length > 0 ? `; other branch(es) ${others.join(', ')} reported, NOT extracted (union rendering — review)` : ''}`,
    );
    return true;
  };

  for (const kid of kids) {
    if (ts.isJsxText(kid)) {
      if (kid.text.trim() !== '') texts.push(kid.text.trim());
      continue;
    }
    if (ts.isJsxElement(kid) || ts.isJsxSelfClosingElement(kid)) {
      addChild(buildPart(kid, ctx));
      continue;
    }
    if (ts.isJsxExpression(kid) && kid.expression) {
      sawExpression = true;
      const e = unparen(kid.expression);
      if (ts.isIdentifier(e)) {
        const kind = e.text === 'children' ? 'node' : ctx.propKind.get(e.text);
        if (e.text === 'children' || kind === 'node') {
          if (hasElementKids) {
            addChild({ name: e.text, part: { slot: { name: e.text } } });
            ctx.notes.push(`jsx: part "${partName}" renders {${e.text}} between elements — extracted as an ordered slot part "${e.text}"`);
          } else {
            part.slot = { name: e.text };
          }
        } else if (kind === 'string') {
          if (hasElementKids) {
            addChild({ name: e.text, part: { element: 'span', content: { prop: e.text } } });
            ctx.notes.push(`jsx: part "${partName}" renders {${e.text}} between elements — extracted as an ordered content part "${e.text}"`);
          } else {
            part.content = { prop: e.text };
          }
        } else {
          // Phase B: ONE resolution hop through a local const — the render
          // indirection Astryx uses (`const menuContent = items !== undefined
          // ? renderDropdownItems(items) : children`). A dual-mode
          // conditional extracts BOTH branches, mutual exclusivity noted.
          const init = ctx.localInits.get(e.text);
          const resolved = init ? unparen(init) : undefined;
          if (resolved) {
            const branches = ts.isConditionalExpression(resolved)
              ? [unparen(resolved.whenTrue), unparen(resolved.whenFalse)]
              : [resolved];
            let handled = 0;
            for (const b of branches) {
              if (ts.isIdentifier(b) && (b.text === 'children' || ctx.propKind.get(b.text) === 'node')) {
                addChild({ name: b.text, part: { slot: { name: b.text } } });
                handled++;
              } else if (tryHelperCall(b) || tryRenderCall(b)) {
                handled++;
              } else if (ts.isJsxElement(b) || ts.isJsxSelfClosingElement(b) || ts.isJsxFragment(b)) {
                addChild(buildPart(b, ctx, 'optional'));
                handled++;
              } else if (b.kind !== ts.SyntaxKind.NullKeyword) {
                ctx.notes.push(
                  `jsx: part "${partName}" local "${e.text}" branch \`${b.getText().slice(0, 50)}\` — not extractable after one hop`,
                );
              }
            }
            if (handled > 0) {
              if (branches.length > 1) {
                ctx.notes.push(
                  `jsx: part "${partName}" renders {${e.text}} — a DUAL-MODE conditional; both branches extracted, but they are mutually exclusive in code (review which mode the contract should carry)`,
                );
              }
              continue;
            }
          }
          ctx.notes.push(`jsx: part "${partName}" renders {${e.text}} — not a known text/node prop, not extracted`);
        }
        continue;
      }
      if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const right = unparen(e.right);
        if (ts.isJsxElement(right) || ts.isJsxSelfClosingElement(right)) {
          const cond = unparen(e.left);
          const condition = conditionOf(cond);
          if (condition === undefined) {
            ctx.notes.push(`jsx: part "${partName}" conditional \`${cond.getText().slice(0, 60)}\` — condition shape not extractable, part skipped by name`);
            continue;
          }
          addChild(buildPart(right, ctx, condition));
          continue;
        }
        ctx.notes.push(`jsx: part "${partName}" expression \`${e.getText().slice(0, 60)}\` — && without a JSX element, not extractable`);
        continue;
      }
      if (ts.isConditionalExpression(e)) {
        const whenTrue = unparen(e.whenTrue);
        const whenFalse = unparen(e.whenFalse);
        const isNullElse = whenFalse.kind === ts.SyntaxKind.NullKeyword;
        if (isNullElse && (ts.isJsxElement(whenTrue) || ts.isJsxSelfClosingElement(whenTrue))) {
          const cond = unparen(e.condition);
          const condition = conditionOf(cond);
          if (condition === undefined) {
            ctx.notes.push(`jsx: part "${partName}" conditional \`${cond.getText().slice(0, 60)}\` — condition shape not extractable, part skipped by name`);
            continue;
          }
          addChild(buildPart(whenTrue, ctx, condition));
          continue;
        }
        ctx.notes.push(`jsx: part "${partName}" conditional expression — not a \`cond ? <el/> : null\` shape, not extracted`);
        continue;
      }
      if (tryRenderCall(e)) continue;
      if (tryHelperCall(e)) continue;
      // Phase B (composition tier): `items.map(item => <X/>)` is the CODE
      // spelling of the contract's repeat channel — a template mapped over
      // an array prop. Only a PROP receiver becomes a repeat part; a local/
      // derived array (pageRange, visibleToasts) is reported by name, never
      // guessed into the API surface.
      if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'map') {
        const recv = unparen(e.expression.expression);
        const cb = e.arguments.length > 0 ? unparen(e.arguments[0] as ts.Expression) : undefined;
        let tpl: JsxEl | null = null;
        if (cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))) {
          let body: ts.Node = cb.body;
          if (ts.isBlock(body)) {
            const ret = body.statements.find(ts.isReturnStatement);
            body = ret?.expression ? unparen(ret.expression) : body;
          } else {
            body = unparen(body as ts.Expression);
          }
          if (ts.isJsxElement(body as ts.Node) || ts.isJsxSelfClosingElement(body as ts.Node)) tpl = body as JsxEl;
        }
        if (tpl && ts.isIdentifier(recv) && ctx.propKind.has(recv.text)) {
          const built = buildPart(tpl, ctx);
          if (built) {
            built.part.repeat = { itemsProp: recv.text };
            addChild(built);
            ctx.notes.push(
              `jsx: part "${partName}" maps {${recv.text}.map(…)} to <${tagNameOf(tpl)}> — extracted as a REPEAT part "${built.name}" over prop "${recv.text}" (the design-time sample is not decidable from code; populate it before adoption)`,
            );
            continue;
          }
        }
        if (tpl) {
          ctx.notes.push(
            `jsx: part "${partName}" maps {${recv.getText().slice(0, 40)}.map(…)} to <${tagNameOf(tpl)}> — receiver is not a component prop (local/derived array); repeated template reported, not extracted`,
          );
          continue;
        }
        ctx.notes.push(`jsx: part "${partName}" .map(…) whose callback does not return a JSX element — not extractable`);
        continue;
      }
      ctx.notes.push(`jsx: part "${partName}" expression \`${e.getText().slice(0, 60)}\` — not extractable, skipped by name`);
    }
  }

  if (Object.keys(parts).length > 0) {
    part.parts = parts;
    if (texts.length > 0) ctx.notes.push(`jsx: part "${partName}" mixes literal text with elements — text not extracted`);
  } else if (texts.length > 0 && !sawExpression) {
    part.text = texts.join(' ');
  } else if (texts.length > 0) {
    ctx.notes.push(`jsx: part "${partName}" mixes literal text with expressions — text not extracted`);
  }
}

// ---------------------------------------------------------------------------
// Component function discovery + event wiring
// ---------------------------------------------------------------------------

function findComponentFn(sf: ts.SourceFile, name: string): ts.FunctionLikeDeclaration | null {
  let found: ts.FunctionLikeDeclaration | null = null;
  const fnFromCall = (init: ts.Expression): ts.FunctionLikeDeclaration | null => {
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return init;
    if (ts.isCallExpression(init)) {
      for (const arg of init.arguments) {
        const inner = fnFromCall(arg);
        if (inner) return inner;
      }
    }
    return null;
  };
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      found = fnFromCall(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function findReturnedJsx(fn: ts.FunctionLikeDeclaration, notes: string[]): JsxEl | null {
  const jsxOf = (e: ts.Expression): JsxEl | null => {
    const u = unparen(e);
    if (ts.isJsxElement(u) || ts.isJsxSelfClosingElement(u)) return u;
    if (ts.isJsxFragment(u)) {
      // Phase B: a fragment root is MULTI-ROOT anatomy in code clothing —
      // walk its children under a synthetic element-less root.
      notes.push('jsx: component returns a Fragment — children extracted under a synthetic root (multi-root anatomy; review the root split before adoption)');
      return u;
    }
    return null;
  };
  if (fn.body && !ts.isBlock(fn.body)) return jsxOf(fn.body);
  const returns: JsxEl[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      const j = jsxOf(node.expression);
      if (j) returns.push(j);
    }
    // don't descend into nested function declarations' returns
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return;
    ts.forEachChild(node, visit);
  };
  if (fn.body) ts.forEachChild(fn.body, visit);
  if (returns.length > 1) notes.push('jsx: multiple JSX returns — anatomy read from the first');
  return returns[0] ?? null;
}

/** The `const classes = [styles.root, …]` variable name(s) in the fn body. */
function findRootClassVars(fn: ts.FunctionLikeDeclaration): Set<string> {
  const out = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (/\bstyles\s*\.\s*root\b|\bstyles\s*\[\s*['"`]root/.test(node.initializer.getText())) {
        out.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  if (fn.body) visit(fn.body);
  return out;
}

/** Toggle wiring from the generator's uncontrolled pattern:
 *    const [xUncontrolled, setXUncontrolled] = useState<…>('def');
 *    const handleY = () => { setXUncontrolled(x === 'on' ? 'off' : 'on'); onY?.(); };
 */
function extractEventWiring(
  src: string,
  clickHandlers: Map<string, string>,
  ariaOnPart: Map<string, string>,
): Record<string, ExtractedEventWiring> {
  const out: Record<string, ExtractedEventWiring> = {};
  const uncontrolledDefaults = new Map<string, string>();
  for (const m of src.matchAll(/const \[(\w+)Uncontrolled,\s*set\w+Uncontrolled\]\s*=\s*useState[^(]*\(\s*'([^']*)'\s*\)/g)) {
    uncontrolledDefaults.set(m[1], m[2]);
  }
  for (const [partName, handler] of clickHandlers) {
    const hm = handler.match(/^handle([A-Z]\w*)$/);
    if (!hm) continue;
    const eventName = lowerFirst(hm[1]);
    const wiring: ExtractedEventWiring = { trigger: partName };
    const bodyMatch = src.match(new RegExp(`const ${handler} = \\(\\) => \\{([\\s\\S]*?)\\};`));
    if (bodyMatch) {
      const flip = bodyMatch[1].match(/set(\w+)Uncontrolled\(\s*(\w+) === '([^']+)' \? '([^']+)' : '([^']+)'/);
      if (flip && flip[3] === flip[5]) {
        const prop = flip[2];
        wiring.toggles = { prop, between: [flip[4], flip[3]] };
        const aria = ariaOnPart.get(partName);
        if (aria) wiring.toggles.aria = aria;
        if (uncontrolledDefaults.has(prop)) wiring.uncontrolledDefault = uncontrolledDefaults.get(prop);
      }
    }
    out[eventName] = wiring;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface AnatomyInput {
  sf: ts.SourceFile;
  src: string;
  componentName: string;
  props: ExtractedProp[];
  css: string;
  tokens: TokenIndex;
  /** StyleX mode (Phase B, Astryx): no CSS Module exists — part identity
   *  reads stylex.props spreads; `css` is '' and the CSS model is empty.
   *  Structure (parts, component refs, slots, repeats) extracts; StyleX
   *  rule styling is a named review item until the token round. */
  stylex?: boolean;
  /** Phase B: co-located sibling sources (same directory) — render helpers
   *  imported from them (`renderDropdownItems`) become resolvable. */
  helpers?: { sourcePath: string; source: string }[];
}

export function extractAnatomy(input: AnatomyInput): ExtractedAnatomy | null {
  const notes: string[] = [];
  const rawValues: RawValueFinding[] = [];
  const mintables: CodeMintFinding[] = [];
  const enumProps = new Map<string, string[]>(
    input.props.filter((p) => p.kind === 'enum' && p.values).map((p) => [p.name, p.values!]),
  );
  const propKind = new Map(input.props.map((p) => [p.name, p.kind]));

  const fn = findComponentFn(input.sf, input.componentName);
  if (!fn) return null;
  const rootEl = findReturnedJsx(fn, notes);
  if (!rootEl) {
    return notes.length > 0
      ? { root: {}, element: 'div', states: [], rawValues, notes }
      : null;
  }

  const ctx: JsxContext = {
    sf: input.sf,
    propKind,
    rootClassVars: findRootClassVars(fn),
    notes,
    clickHandlers: new Map(),
    ariaOnPart: new Map(),
    bem: emptyClassMap(),
    stylexTables: input.stylex ? collectStylexTables(input.sf) : null,
    helperFns: collectHelperFns([
      input.sf,
      ...(input.helpers ?? []).map((h) =>
        ts.createSourceFile(h.sourcePath.split(/[\\/]/).pop() ?? h.sourcePath, h.source, ts.ScriptTarget.Latest, true),
      ),
    ]),
    localInits: (() => {
      const inits = new Map<string, ts.Expression>();
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          if (!inits.has(node.name.text)) inits.set(node.name.text, node.initializer);
        }
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return;
        ts.forEachChild(node, visit);
      };
      if (fn.body) ts.forEachChild(fn.body, visit);
      return inits;
    })(),
  };
  if (input.stylex) {
    notes.push(
      `stylex: component styles via stylex.create (${ctx.stylexTables!.size} table(s)) — structure extracted from stylex.props spreads; rule styling (tokens/layout) is a named review item this round`,
    );
    // Seed the root rule name BEFORE walking so nested references to the
    // same rule resolve as 'root', mirroring the CSS-module rootClass.
    const sx = stylexClassOf(rootEl, ctx);
    if (sx.kind === 'part') ctx.bem.rootClass = sx.name;
  }

  const rootTag = tagNameOf(rootEl);
  let root: ExtractedPart = {};
  let role: string | undefined;
  if (ts.isJsxFragment(rootEl)) {
    // Phase B: fragment root = MULTI-ROOT anatomy — the top-level children
    // land under a synthetic element-less root (the COMPONENT-as-root
    // convention the design-side proposer already uses).
    fillChildren(rootEl, root, 'root', ctx);
  } else if (/^[A-Z]/.test(rootTag)) {
    // Phase B (the DialogHeader→<LayoutHeader> class): a component ROOT no
    // longer bails anatomy — it extracts as a component-ref root whose slot
    // content descends as parts. Whether the wrapper is a pass-through or a
    // real instance is a review decision; the structure is not lost.
    const built = buildPart(rootEl, ctx);
    if (built) root = built.part;
    notes.push(
      `jsx: root element <${rootTag}> is a component — extracted as a component-ref ROOT with its slot content as parts (wrapper mapping is a review item)`,
    );
  } else {
    // BEM/clsx legibility: read the root's class spelling FIRST so every later
    // class lookup (JSX parts and CSS selectors alike) resolves through it.
    readRootClasses(rootEl, ctx, enumProps);
    const cn = classNameOf(rootEl, ctx);
    if (cn.kind === 'opaque') {
      notes.push(`jsx: root className ${cn.text} is not a CSS-module reference — parts under it are still read where legible`);
    } else if (cn.kind === 'part') {
      notes.push(`jsx: root class ".${cn.name}" extracted as the contract root part (contract roots are named "root")`);
    } else if (cn.kind === 'root' && ctx.bem.rootClass !== null && ctx.bem.rootClass !== 'root') {
      notes.push(`jsx: root class ".${ctx.bem.rootClass}" extracted as the contract root part (contract roots are named "root")`);
    }

    // Root attrs: role → semantics.role, the rest are root-part attrs.
    const hasRootOnClick = attributesOf(rootEl).properties.some(
      (a) => ts.isJsxAttribute(a) && a.name.getText() === 'onClick',
    );
    const rootAttrs = attrsOf(rootEl, 'root', true, hasRootOnClick, ctx);
    role = rootAttrs.role;
    delete rootAttrs.role;

    if (Object.keys(rootAttrs).length > 0) root.attrs = rootAttrs;
    fillChildren(rootEl, root, 'root', ctx);
  }
  if (root.slot?.name === 'children' && !root.parts) {
    // A part-less root renders {children} unconditionally in generated code —
    // it carries no information about slot vs children-bound text prop.
    delete root.slot;
    notes.push('jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code');
  }

  // Style side — the CSS Module or its StyleX twin, same model shape.
  const model = input.stylex
    ? analyzeStylex(ctx.stylexTables!, ctx, input.tokens, notes, rawValues)
    : analyzeCss(input.css, enumProps, input.tokens, notes, rawValues, ctx.bem, mintables);

  // Attach styles per part name across the JSX tree.
  const jsxPartNames = new Set<string>(['root']);
  const attach = (name: string, part: ExtractedPart) => {
    jsxPartNames.add(name);
    const style = model.partStyles.get(name);
    if (style) {
      if (Object.keys(style.tokens).length > 0) part.tokens = { ...style.tokens, ...part.tokens };
      if (style.layout) part.layout = { ...style.layout, ...part.layout };
      if (style.overlay) part.overlay = style.overlay;
      if (style.animation) part.animation = style.animation;
    }
    const overlapRef = model.overlapGap.get(name);
    if (overlapRef) {
      part.layout = { ...part.layout, overlap: true };
      part.tokens = { ...part.tokens, gap: overlapRef };
    }
    for (const [childName, child] of Object.entries(part.parts ?? {})) attach(childName, child);
  };
  attach('root', root);
  if (Object.keys(model.rootStates).length > 0) root.states = model.rootStates;

  for (const cssName of model.cssPartNames) {
    if (!jsxPartNames.has(cssName)) {
      notes.push(`css: class ".${cssName}" has declarations but no matching extracted JSX part — styles not attached, review by name`);
    }
  }

  const events = extractEventWiring(input.src, ctx.clickHandlers, ctx.ariaOnPart);

  return {
    root,
    element: ts.isJsxFragment(rootEl) || /^[A-Z]/.test(rootTag) ? 'div' : rootTag,
    ...(role ? { role } : {}),
    states: STATE_ORDER.filter((s) => model.statesSeen.has(s)),
    ...(Object.keys(events).length > 0 ? { events } : {}),
    rawValues,
    notes,
    ...(mintables.length > 0 ? { mintables } : {}),
  };
}
