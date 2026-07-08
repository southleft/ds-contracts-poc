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
 *   · :hover / :focus-visible / :disabled rules      → states
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
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open === -1) break;
    const selector = src.slice(i, open).trim();
    i = open;
    if (selector.startsWith('@')) {
      if (!selector.startsWith('@keyframes ds-')) {
        notes.push(`css: at-rule \`${selector}\` skipped — not extractable into anatomy`);
      }
      skipBlock();
      continue;
    }
    const close = src.indexOf('}', open);
    if (close === -1) break;
    const body = src.slice(open + 1, close);
    i = close + 1;
    const decls: CssDecl[] = [];
    for (const chunk of body.split(';')) {
      const colon = chunk.indexOf(':');
      if (colon === -1) continue;
      const prop = chunk.slice(0, colon).trim();
      const value = chunk.slice(colon + 1).trim().replace(/\s+/g, ' ');
      if (prop) decls.push({ prop, value });
    }
    for (const sel of selector.split(',').map((s) => s.trim())) {
      if (sel) rules.push({ selector: sel, decls });
    }
  }
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

interface PartStyle {
  layout?: NonNullable<ExtractedPart['layout']>;
  overlay?: ExtractedPart['overlay'];
  tokens: Record<string, string>;
  animation?: 'spin' | 'pulse';
}

/** Resolve one var(--x) against the token tree. Returns the dot path, or
 *  null after pushing the named refusal. */
function resolveVar(
  varName: string,
  context: string,
  index: TokenIndex,
  notes: string[],
): string | null {
  const paths = index.byVar.get(varName) ?? [];
  if (paths.length === 1) return paths[0];
  if (paths.length === 0) {
    notes.push(`css: ${context} uses var(--${varName}) which resolves to NO token in the token tree — binding not proposed`);
  } else {
    notes.push(
      `css: ${context} var(--${varName}) has ${paths.length} tokenizations in the token tree (${paths.join(', ')}) — ambiguous, not proposed (report, don't guess)`,
    );
  }
  return null;
}

function invertDecls(
  selector: string,
  decls: CssDecl[],
  index: TokenIndex,
  notes: string[],
  rawValues: RawValueFinding[],
): PartStyle {
  const out: PartStyle = { tokens: {} };
  const layout: NonNullable<ExtractedPart['layout']> = {};
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
      const path = resolveVar(varMatch[1], `${selector} { ${prop} }`, index, notes);
      if (path) out.tokens[prop] = `{${path}}`;
      continue;
    }
    if (value.includes('var(')) {
      notes.push(`css: ${selector} { ${prop}: ${value} } — var() inside a shorthand is not invertible to a single binding, not extracted`);
      continue;
    }
    const looksTokenizable =
      /^#[0-9a-fA-F]{3,8}$/.test(value) ||
      /^(rgb|rgba|hsl|hsla)\(/.test(value) ||
      /^-?\d*\.?\d+(px|rem|em|%)$/.test(value) ||
      TOKEN_TYPICAL.has(prop);
    if (looksTokenizable) {
      rawValues.push({ selector, property: prop, value, candidates: candidatesByValue(index, value) });
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
  ':focus-visible': 'focus-visible',
  ':disabled': 'disabled',
};
const STATE_ORDER = ['hover', 'focus-visible', 'disabled'];

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
): CssModel {
  const rules = parseCss(css, notes);
  const partStyles = new Map<string, PartStyle>();
  const rootStates: Record<string, Record<string, string>> = {};
  const statesSeen = new Set<string>();
  const overlapGap = new Map<string, string>();
  const cssPartNames = new Set<string>();

  // axis-value class detection: "variant-primary" → [variant, primary]
  const axisValueOf = (cls: string): { axis: string; value: string } | null => {
    for (const [axis, values] of enumProps) {
      for (const v of values) {
        if (cls === `${axis}-${v}`) return { axis, value: v };
      }
    }
    return null;
  };

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

  const LAYOUT_PROPS = new Set(['display', 'flex-direction', 'align-items', 'justify-content']);
  const collectVarDecls = (
    rule: CssRule,
    onPath: (cssProp: string, path: string) => void,
  ) => {
    for (const { prop, value } of rule.decls) {
      if (GENERATOR_ARTIFACTS.has(`${prop}:${value}`)) continue;
      const m = value.match(VAR_RE);
      if (m) {
        const path = resolveVar(m[1], `${rule.selector} { ${prop} }`, index, notes);
        if (path) onPath(prop, path);
      } else if (LAYOUT_PROPS.has(prop)) {
        notes.push(
          `css: ${rule.selector} { ${prop}: ${value} } — a per-variant layout override (contract layoutByProp); not extracted, author it against design intent`,
        );
      } else {
        rawValues.push({ selector: rule.selector, property: prop, value, candidates: candidatesByValue(index, value) });
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
    if ((m = sel.match(/^\.([\w-]+)((?::[\w()-]+)*)$/))) {
      const cls = m[1];
      const pseudo = m[2];
      const av = axisValueOf(cls);
      if (!pseudo) {
        if (av) {
          collectVarDecls(rule, (cssProp, path) => {
            bucket('root', '', av.axis, cssProp, sel).set(av.value, path);
          });
        } else {
          cssPartNames.add(cls);
          const style = invertDecls(sel, rule.decls, index, notes, rawValues);
          const existing = ensure(cls);
          Object.assign(existing.tokens, style.tokens);
          if (style.layout) existing.layout = { ...existing.layout, ...style.layout };
          if (style.overlay) existing.overlay = style.overlay;
          if (style.animation) existing.animation = style.animation;
        }
        continue;
      }
      const state = STATE_SELECTOR_INV[pseudo];
      if (!state) {
        notes.push(`css: selector \`${sel}\` — pseudo "${pseudo}" is not a contract state, not extracted`);
        continue;
      }
      statesSeen.add(state);
      if (cls === 'root') {
        collectVarDecls(rule, (cssProp, path) => {
          (rootStates[state] ??= {})[cssProp] = `{${path}}`;
        });
      } else if (av) {
        collectVarDecls(rule, (cssProp, path) => {
          bucket('root', state, av.axis, cssProp, sel).set(av.value, path);
        });
      } else {
        notes.push(`css: selector \`${sel}\` — state rules on nested parts are outside the contract's root-level states, not extracted`);
      }
      continue;
    }

    // descendant: `.axis-value .part` (nested substituted ref)
    if ((m = sel.match(/^\.([\w-]+)\s+\.([\w-]+)$/))) {
      const av = axisValueOf(m[1]);
      const partName = m[2];
      if (av) {
        cssPartNames.add(partName);
        collectVarDecls(rule, (cssProp, path) => {
          bucket(partName, '', av.axis, cssProp, sel).set(av.value, path);
        });
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
    const covered = values.filter((v) => byValue.has(v));
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

type JsxEl = ts.JsxElement | ts.JsxSelfClosingElement;

function tagNameOf(el: JsxEl): string {
  const tag = ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName;
  return tag.getText();
}
function attributesOf(el: JsxEl): ts.JsxAttributes {
  return ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

interface JsxContext {
  sf: ts.SourceFile;
  propKind: Map<string, ExtractedProp['kind']>;
  rootClassVars: Set<string>;
  notes: string[];
  /** part name → handler name, from onClick={handleX} */
  clickHandlers: Map<string, string>;
  /** part name → aria state attr present as an expression (checked/…) */
  ariaOnPart: Map<string, string>;
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
        return e.name.text === 'root' ? { kind: 'root' } : { kind: 'part', name: e.name.text };
      }
      if (ts.isIdentifier(e) && ctx.rootClassVars.has(e.text)) return { kind: 'root' };
      return { kind: 'opaque', text: e.getText().slice(0, 60) };
    }
    return { kind: 'opaque', text: init.getText().slice(0, 60) };
  }
  return { kind: 'none' };
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
      if (name === 'onClick' && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression && ts.isIdentifier(attr.initializer.expression)) {
        ctx.clickHandlers.set(isRoot ? 'root' : partName, attr.initializer.expression.text);
      } else if (name !== 'onClick') {
        ctx.notes.push(`jsx: <${tagNameOf(el)}> handler "${name}" — only onClick trigger wiring is extracted`);
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

/** Meaningful children of a JSX element. */
function jsxChildren(el: JsxEl): readonly ts.JsxChild[] {
  return ts.isJsxElement(el) ? el.children : [];
}

const unparen = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) ? unparen(e.expression) : e;

interface BuiltPart {
  name: string;
  part: ExtractedPart;
}

function buildPart(el: JsxEl, ctx: JsxContext, condition?: ExtractedPart['visibleWhen'] | 'optional'): BuiltPart | null {
  const tag = tagNameOf(el);
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
    if (kids.length === 1 && ts.isJsxText(kids[0])) text = kids[0].text.trim();
    else if (kids.length > 0) ctx.notes.push(`jsx: <${tag}> has non-text children — component-ref content not extracted`);
    const part: ExtractedPart = {
      component: { name: tag, ...(Object.keys(props).length > 0 ? { props } : {}), ...(text !== undefined ? { text } : {}) },
    };
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
          part.slot = { name: e.text };
        } else if (kind === 'string') {
          part.content = { prop: e.text };
        } else {
          ctx.notes.push(`jsx: part "${partName}" renders {${e.text}} — not a known text/node prop, not extracted`);
        }
        continue;
      }
      if (ts.isConditionalExpression(e)) {
        const whenTrue = unparen(e.whenTrue);
        const whenFalse = unparen(e.whenFalse);
        const isNullElse = whenFalse.kind === ts.SyntaxKind.NullKeyword;
        if (isNullElse && (ts.isJsxElement(whenTrue) || ts.isJsxSelfClosingElement(whenTrue))) {
          const cond = unparen(e.condition);
          let condition: ExtractedPart['visibleWhen'] | 'optional' | undefined;
          if (ts.isBinaryExpression(cond) && ts.isIdentifier(cond.left)) {
            const op = cond.operatorToken.kind;
            if (op === ts.SyntaxKind.ExclamationEqualsToken && cond.right.kind === ts.SyntaxKind.NullKeyword) {
              condition = 'optional';
            } else if (
              (op === ts.SyntaxKind.EqualsEqualsEqualsToken) &&
              ts.isStringLiteral(cond.right)
            ) {
              condition = { prop: cond.left.text, equals: cond.right.text };
            }
          } else if (ts.isIdentifier(cond)) {
            condition = { prop: cond.text };
          }
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
      notes.push('jsx: component returns a Fragment — contract anatomy needs a single root element, anatomy not extracted');
      return null;
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
}

export function extractAnatomy(input: AnatomyInput): ExtractedAnatomy | null {
  const notes: string[] = [];
  const rawValues: RawValueFinding[] = [];
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
  };

  const rootTag = tagNameOf(rootEl);
  if (/^[A-Z]/.test(rootTag)) {
    notes.push(`jsx: root element <${rootTag}> is a component — anatomy not extracted (wrapper components are review items)`);
    return { root: {}, element: 'div', states: [], rawValues, notes };
  }

  const cn = classNameOf(rootEl, ctx);
  if (cn.kind === 'opaque') {
    notes.push(`jsx: root className ${cn.text} is not a CSS-module reference — parts under it are still read where legible`);
  } else if (cn.kind === 'part') {
    notes.push(`jsx: root class ".${cn.name}" extracted as the contract root part (contract roots are named "root")`);
  }

  // Root attrs: role → semantics.role, the rest are root-part attrs.
  const hasRootOnClick = attributesOf(rootEl).properties.some(
    (a) => ts.isJsxAttribute(a) && a.name.getText() === 'onClick',
  );
  const rootAttrs = attrsOf(rootEl, 'root', true, hasRootOnClick, ctx);
  const role = rootAttrs.role;
  delete rootAttrs.role;

  const root: ExtractedPart = {};
  if (Object.keys(rootAttrs).length > 0) root.attrs = rootAttrs;
  fillChildren(rootEl, root, 'root', ctx);
  if (root.slot?.name === 'children' && !root.parts) {
    // A part-less root renders {children} unconditionally in generated code —
    // it carries no information about slot vs children-bound text prop.
    delete root.slot;
    notes.push('jsx: root renders {children} directly — children channel (text prop vs default slot) is not decidable from code');
  }

  // CSS side
  const model = analyzeCss(input.css, enumProps, input.tokens, notes, rawValues);

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
    element: rootTag,
    ...(role ? { role } : {}),
    states: STATE_ORDER.filter((s) => model.statesSeen.has(s)),
    ...(Object.keys(events).length > 0 ? { events } : {}),
    rawValues,
    notes,
  };
}
