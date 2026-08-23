/**
 * Polaris CSS-module inversion for the showcase PROMOTION step.
 *
 * The repo's extractor (core/extract-css-module.ts) reads Polaris's
 * *.module.css but cannot ATTACH most of it: Polaris builds every root
 * className through the `classNames(styles.X, …)` helper (opaque to the
 * JSX reader) and routes almost all styling through component-private
 * `--pc-*` custom-property indirection that the extractor refuses by name
 * ("resolves to NO token"). Every one of those refusals is a NAMED line in
 * extraction/proposals.md — this module is the REVIEW step that promotes
 * exactly those named lines into contract bindings, mechanically:
 *
 *   · parse the module.css (postcss-nesting composed selectors, @media
 *     recorded as context and refused as bindings — breakpoint-conditional
 *     styling has no contract channel)
 *   · resolve `--pc-*` chains through the class context's own definitions
 *     (base class + ONE axis class at a time — a value conditioned on more
 *     than one axis is refused by name, the mint-code discipline)
 *   · a chain that lands on exactly one `var(--p-*)` whose hyphen-join
 *     resolves in the wrapped Polaris token tree becomes a `{p.*}` ref;
 *     anything else (literals, gradient pairs, calc(), shorthands,
 *     unresolved vars) is refused BY NAME into the promotion ledger
 *
 * Nothing here invents a value: every carried binding cites the selector
 * and declaration it came from, and every refusal is a ledger entry.
 * Pure module (no node:* imports); the promote.ts shell does the reading.
 */

// ---------------------------------------------------------------------------
// Parse: nested CSS → flat rules with composed selectors
// ---------------------------------------------------------------------------

export interface FlatDecl {
  prop: string;
  value: string;
}

export interface FlatRule {
  /** Fully composed selector (postcss-nesting semantics). */
  selector: string;
  /** Enclosing at-rule preludes, outermost first (e.g. ["@media print"]). */
  atRules: string[];
  decls: FlatDecl[];
  /** Source order of the rule body (for cascade ties). */
  order: number;
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Compose a nested selector list with its parent selectors. */
function composeSelectors(parents: string[], head: string): string[] {
  const heads = splitTopLevel(head, ',').map((s) => s.trim()).filter(Boolean);
  if (parents.length === 0) return heads;
  const out: string[] = [];
  for (const parent of parents) {
    for (const h of heads) {
      out.push(h.includes('&') ? h.replaceAll('&', parent) : `${parent} ${h}`);
    }
  }
  return out;
}

/** Split on a separator at paren/bracket depth 0. */
function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

export function parseModuleCss(cssText: string): FlatRule[] {
  const src = stripComments(cssText);
  const rules: FlatRule[] = [];
  let order = 0;

  const walk = (text: string, parents: string[], atRules: string[]): void => {
    let i = 0;
    let currentDecls: FlatDecl[] | null = null;
    const flushDecl = (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      const colon = t.indexOf(':');
      if (colon < 0) return;
      const prop = t.slice(0, colon).trim();
      const value = t.slice(colon + 1).trim();
      if (!prop) return;
      if (!currentDecls) {
        currentDecls = [];
        rules.push({ selector: parents.join(', ') || '(top level)', atRules, decls: currentDecls, order: order++ });
      }
      currentDecls.push({ prop, value });
    };

    while (i < text.length) {
      // read until one of { ; } at depth 0
      let depth = 0;
      let j = i;
      let boundary = -1;
      let boundaryCh = '';
      while (j < text.length) {
        const ch = text[j];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (depth === 0 && (ch === '{' || ch === ';' || ch === '}')) {
          boundary = j;
          boundaryCh = ch;
          break;
        }
        j++;
      }
      if (boundary < 0) {
        flushDecl(text.slice(i));
        return;
      }
      const chunk = text.slice(i, boundary);
      if (boundaryCh === ';') {
        flushDecl(chunk);
        i = boundary + 1;
        continue;
      }
      if (boundaryCh === '}') {
        flushDecl(chunk);
        i = boundary + 1;
        continue; // caller slices exactly one block, so this closes it
      }
      // '{' — find the matching close brace
      let braceDepth = 1;
      let k = boundary + 1;
      while (k < text.length && braceDepth > 0) {
        if (text[k] === '{') braceDepth++;
        else if (text[k] === '}') braceDepth--;
        k++;
      }
      const head = chunk.trim();
      const body = text.slice(boundary + 1, k - 1);
      if (head.startsWith('@')) {
        // at-rule: keep prelude as context; selectors pass through unchanged
        // (postcss-nesting: a nested @media keeps the parent selector).
        walk(body, parents, [...atRules, head]);
      } else {
        walk(body, composeSelectors(parents, head), atRules);
      }
      currentDecls = null; // declarations after a nested block start a new rule entry
      i = k;
    }
  };

  walk(src, [], []);
  return rules;
}

// ---------------------------------------------------------------------------
// Match: does a composed selector apply to (root class context, part, state)?
// ---------------------------------------------------------------------------

export type StateName = 'hover' | 'active' | 'focus-visible' | 'disabled';

export interface MatchQuery {
  /** Classes active on the ROOT element (root class + axis classes). */
  rootClasses: Set<string>;
  /** Trailing simple selector naming a nested part ('svg', '.Icon'). Absent
   *  = the root itself. */
  partSelector?: string;
  /** Interaction state under query; absent = base. */
  state?: StateName;
}

export interface MatchResult {
  matches: boolean;
  /** Classes the selector requires that are NOT in the context — the
   *  multi-axis / unknown-class evidence for ledger lines. */
  missingClasses: string[];
  /** Selector uses syntax this matcher refuses (named). */
  refused?: string;
  specificity: number;
}

const STATE_PSEUDOS: Record<string, StateName> = {
  ':hover': 'hover',
  ':active': 'active',
  ':focus-visible': 'focus-visible',
  ':disabled': 'disabled',
};

/** Parse one compound selector (no combinators) into pieces. */
function compoundPieces(compound: string): string[] {
  const pieces: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of compound) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && (ch === '.' || ch === ':' || ch === '[') && cur) {
      pieces.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) pieces.push(cur);
  return pieces;
}

export function matchSelector(selector: string, q: MatchQuery): MatchResult {
  const no = (refused: string): MatchResult => ({ matches: false, missingClasses: [], refused, specificity: 0 });
  const sel = selector.trim();
  if (/[>+~]/.test(sel)) return no(`combinator in "${sel}" — only descendant part selectors are promoted`);
  const compounds = sel.split(/\s+/).filter(Boolean);
  if (compounds.length > 2) return no(`selector "${sel}" nests deeper than root + one part`);

  // CSS modules scope classes per file, so part rules are usually TOP-LEVEL
  // (`.Input { … }`) with no root compound. A part query therefore accepts
  // either `<root> <part>` or a bare `<part>` compound.
  const bareParts =
    q.partSelector !== undefined &&
    compounds.length === 1 &&
    compoundPieces(compounds[0])[0] === q.partSelector;
  const rootCompound = bareParts ? undefined : compounds[0];
  const partCompound = bareParts ? compounds[0] : compounds.length === 2 ? compounds[1] : undefined;

  let specificity = 0;
  const missing: string[] = [];
  let stateSeen: StateName | undefined;

  if (q.partSelector) {
    if (partCompound === undefined) return { matches: false, missingClasses: [], specificity: 0 };
    // The part compound must START with the part's simple selector; trailing
    // pieces may be state pseudos (`.Backdrop:hover`) — anything else refuses.
    const pieces = compoundPieces(partCompound!);
    if (pieces[0] !== q.partSelector) return { matches: false, missingClasses: [], specificity: 0 };
    specificity += q.partSelector.startsWith('.') ? 10 : 1;
    for (const piece of pieces.slice(1)) {
      if (STATE_PSEUDOS[piece]) {
        specificity += 10;
        if (stateSeen && stateSeen !== STATE_PSEUDOS[piece]) return no(`two states in "${sel}"`);
        stateSeen = STATE_PSEUDOS[piece];
        continue;
      }
      if (piece === ':not(:disabled)' || piece === ':not([disabled])') {
        specificity += 10;
        if (q.state === 'disabled') return { matches: false, missingClasses: [], specificity: 0 };
        continue;
      }
      return no(`part selector piece "${piece}" in "${sel}" — not promotable`);
    }
  } else if (partCompound !== undefined) {
    return { matches: false, missingClasses: [], specificity: 0 };
  }

  for (const piece of rootCompound === undefined ? [] : compoundPieces(rootCompound)) {
    if (piece.startsWith('.')) {
      const cls = piece.slice(1);
      specificity += 10;
      if (!q.rootClasses.has(cls)) missing.push(cls);
      continue;
    }
    if (piece.startsWith(':is(') || piece.startsWith(':where(')) {
      const inner = piece.slice(piece.indexOf('(') + 1, -1);
      const options = splitTopLevel(inner, ',').map((s) => s.trim());
      if (!options.every((o) => /^\.[A-Za-z0-9_-]+$/.test(o))) {
        return no(`unsupported :is()/:where() contents in "${sel}"`);
      }
      if (!piece.startsWith(':where(')) specificity += 10;
      const hit = options.some((o) => q.rootClasses.has(o.slice(1)));
      if (!hit) missing.push(`one of ${options.join('|')}`);
      continue;
    }
    if (piece.startsWith(':not(')) {
      const inner = piece.slice(5, -1).trim();
      specificity += 10;
      if (inner === ':disabled' || inner === '[disabled]') {
        if (q.state === 'disabled') return { matches: false, missingClasses: [], specificity: 0 };
        continue;
      }
      if (/^\.[A-Za-z0-9_-]+$/.test(inner)) {
        if (q.rootClasses.has(inner.slice(1))) return { matches: false, missingClasses: [], specificity: 0 };
        continue;
      }
      return no(`unsupported :not() contents in "${sel}"`);
    }
    if (STATE_PSEUDOS[piece]) {
      specificity += 10;
      if (stateSeen && stateSeen !== STATE_PSEUDOS[piece]) return no(`two states in "${sel}"`);
      stateSeen = STATE_PSEUDOS[piece];
      continue;
    }
    if (piece === '[disabled]') {
      specificity += 10;
      stateSeen = 'disabled';
      continue;
    }
    if (piece.startsWith('::')) return no(`pseudo-element "${piece}" in "${sel}" — not a contract channel`);
    if (piece.startsWith(':') || piece.startsWith('[')) {
      return no(`pseudo/attribute "${piece}" in "${sel}" — not promotable`);
    }
    // bare element selector at root position (rare) — refuse
    return no(`element selector "${piece}" at root position in "${sel}"`);
  }

  if ((stateSeen ?? undefined) !== q.state) return { matches: false, missingClasses: [], specificity: 0 };
  if (missing.length > 0) return { matches: false, missingClasses: missing, specificity: 0 };
  return { matches: true, missingClasses: [], specificity };
}

// ---------------------------------------------------------------------------
// Resolve: value → single {p.*} token ref, or a named refusal
// ---------------------------------------------------------------------------

export interface TokenLookup {
  /** hyphen-joined var name without leading -- (e.g. "p-space-100") → dot path. */
  pathOfVar: (varName: string) => string | undefined;
}

/** A custom-property definition with its defining selector (provenance). */
export interface PropDef {
  value: string;
  selector: string;
}

export type Resolution =
  | { kind: 'ref'; ref: string; via: string[] }
  /** COVERAGE ROUND: a var() chain that lands on a same-package LITERAL
   *  definition (Polaris `--pc-*` pixel geometry, `transparent` bases) —
   *  the resolved value is deterministic and carried WITH provenance:
   *  the chain (`via`) and the selector that defined the final value.
   *  Only chain-resolved literals surface this way; a RAW literal
   *  declaration still refuses (a raw value is reported, never invented
   *  into a carry). */
  | { kind: 'literal'; value: string; via: string[]; defSelector: string }
  | { kind: 'layers'; layers: string[]; via: string[] }
  | { kind: 'refused'; reason: string };

/** Depth cap for var() chains — beyond this, refuse by name. */
const CHAIN_DEPTH_CAP = 12;

/** Evaluate a bounded calc() expression AFTER every inner var() resolved to
 *  a px/number literal: + - * / with parentheses, px units and unitless
 *  factors (ProgressBar: `calc(var(--pc-progress-bar-height-base) * 0.5)`
 *  → 8px). Anything else returns undefined (the caller refuses by name).
 *  Deterministic arithmetic — never a guess. */
export function evalCalcExpr(expr: string): string | undefined {
  type Val = { n: number; px: boolean };
  const tokens = expr.match(/-?\d*\.?\d+(px)?|[()+\-*/]/g);
  if (!tokens || tokens.join('').replace(/\s+/g, '') !== expr.replace(/\s+/g, '')) return undefined;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const parsePrimary = (): Val | undefined => {
    const t = next();
    if (t === '(') {
      const v = parseAdd();
      if (next() !== ')') return undefined;
      return v;
    }
    if (t === undefined || /[()+\-*/]/.test(t)) return undefined;
    return { n: parseFloat(t), px: t.endsWith('px') };
  };
  const parseMul = (): Val | undefined => {
    let left = parsePrimary();
    while (left && (peek() === '*' || peek() === '/')) {
      const op = next();
      const right = parsePrimary();
      if (!right) return undefined;
      if (left.px && right.px) return undefined; // px·px has no CSS meaning
      left = {
        n: op === '*' ? left.n * right.n : left.n / right.n,
        px: left.px || right.px,
      };
    }
    return left;
  };
  const parseAdd = (): Val | undefined => {
    let left = parseMul();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = next();
      const right = parseMul();
      if (!right) return undefined;
      if (left.px !== right.px) return undefined; // px ± number is invalid CSS
      left = { n: op === '+' ? left.n + right.n : left.n - right.n, px: left.px };
    }
    return left;
  };
  const v = parseAdd();
  if (!v || i !== tokens.length) return undefined;
  const n = Math.round(v.n * 10000) / 10000;
  return `${n}${v.px ? 'px' : ''}`;
}

/** Resolve a CSS value to a single token ref — or, through a var() chain, to
 *  a same-package literal definition — via the given custom-prop
 *  definitions. Chains are followed depth-capped; CYCLES refuse by name;
 *  calc() over chain-resolved px literals evaluates deterministically.
 *  Anything else is refused with the reason. */
export function resolveToRef(
  value: string,
  defs: Map<string, PropDef>,
  tokens: TokenLookup,
  via: string[] = [],
  defSelector = '',
): Resolution {
  const v = value.trim();
  const m = v.match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (!m) {
    // calc() — evaluable ONLY when every inner var() chain-resolves to a
    // px/number literal (never across token refs: a token-valued calc is a
    // derived value, not a binding — stays a named refusal).
    const calc = v.match(/^calc\(([\s\S]+)\)$/);
    if (calc) {
      let inner = calc[1];
      let innerVia: string[] = [...via];
      let innerSel = defSelector;
      let failed: string | null = null;
      inner = inner.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*[^)]*)?\)/g, (whole) => {
        const res = resolveToRef(whole, defs, tokens, via, defSelector);
        if (res.kind === 'literal' && /^-?\d*\.?\d+(px)?$/.test(res.value)) {
          innerVia = [...innerVia, ...res.via.filter((x) => !innerVia.includes(x))];
          innerSel = res.defSelector || innerSel;
          return res.value;
        }
        failed =
          res.kind === 'ref'
            ? `calc() over token \`${res.ref}\` is a derived value, not a single binding`
            : res.kind === 'refused'
              ? res.reason
              : `calc() operand "${whole}" did not resolve to a px literal`;
        return whole;
      });
      if (failed) return { kind: 'refused', reason: failed };
      const evaluated = evalCalcExpr(inner);
      if (evaluated !== undefined) {
        return { kind: 'literal', value: evaluated, via: innerVia, defSelector: innerSel };
      }
      return { kind: 'refused', reason: `calc() expression "${v}" is outside the bounded arithmetic grammar` };
    }
    // Multi-layer value (comma at paren depth 0) — surfaced so the caller
    // can apply CSS's own shorthand semantics (background: image, color).
    const layers = splitTopLevel(v, ',').map((l) => l.trim());
    if (layers.length > 1) return { kind: 'layers', layers, via };
    if (v.includes('var(')) return { kind: 'refused', reason: `value "${v}" mixes var() with other content — not a single binding` };
    if (via.length > 0) {
      // The chain landed on a literal DEFINED in this package's CSS —
      // deterministic; carried by the caller with this provenance.
      return { kind: 'literal', value: v, via, defSelector };
    }
    return { kind: 'refused', reason: `literal value "${v}" — a raw value is reported, never turned into an invented token` };
  }
  const varName = m[1].slice(2);
  const fallback = m[2];
  if (via.includes(`--${varName}`)) {
    return { kind: 'refused', reason: `var() cycle: ${[...via, `--${varName}`].join(' → ')} — refused by name` };
  }
  if (via.length > CHAIN_DEPTH_CAP) {
    return { kind: 'refused', reason: `var() chain deeper than ${CHAIN_DEPTH_CAP} (${via.join(' → ')})` };
  }
  const def = defs.get(varName);
  if (def !== undefined) {
    return resolveToRef(def.value, defs, tokens, [...via, `--${varName}`], def.selector);
  }
  const path = tokens.pathOfVar(varName);
  if (path) return { kind: 'ref', ref: `{${path}}`, via };
  if (fallback !== undefined) {
    return resolveToRef(fallback, defs, tokens, [...via, `--${varName} (undefined → fallback)`], defSelector);
  }
  return { kind: 'refused', reason: `var(--${varName}) resolves to NO token and has no reachable definition in this class context` };
}

// ---------------------------------------------------------------------------
// Effective declarations for a query, cascade-ordered
// ---------------------------------------------------------------------------

export interface EffectiveDecl {
  prop: string;
  value: string;
  selector: string;
  specificity: number;
  order: number;
}

export interface QueryOutcome {
  /** channel → winning declaration (cascade: specificity then source order). */
  winners: Map<string, EffectiveDecl>;
  /** Selector-level refusals seen while matching (named, deduped). */
  refusals: string[];
}

/** All custom-property definitions visible to a class context (base state),
 *  cascade-ordered so later/more specific definitions win. Each definition
 *  records its defining selector (literal-carry provenance). */
export function customPropDefs(rules: FlatRule[], rootClasses: Set<string>): Map<string, PropDef> {
  const defs = new Map<string, PropDef>();
  const applicable: { rule: FlatRule; spec: number }[] = [];
  for (const rule of rules) {
    if (rule.atRules.length > 0) continue; // @media-scoped defs never promote
    for (const sel of splitTopLevel(rule.selector, ',')) {
      const m = matchSelector(sel, { rootClasses });
      if (m.matches) {
        applicable.push({ rule, spec: m.specificity });
        break;
      }
    }
  }
  applicable.sort((a, b) => a.spec - b.spec || a.rule.order - b.rule.order);
  for (const { rule } of applicable) {
    for (const d of rule.decls) {
      if (d.prop.startsWith('--')) defs.set(d.prop.slice(2), { value: d.value, selector: rule.selector });
    }
  }
  return defs;
}

/** NARROWED refusal evidence for an unresolvable var: where (if anywhere)
 *  the file defines it — @media-only, other-class-context-only, or nowhere
 *  (runtime-set). The refusal message names the class, not just the miss. */
export function varDefinitionContexts(
  rules: FlatRule[],
  varName: string,
): { media: string[]; selectors: string[] } {
  const media = new Set<string>();
  const selectors = new Set<string>();
  for (const rule of rules) {
    for (const d of rule.decls) {
      if (d.prop === `--${varName}`) {
        if (rule.atRules.length > 0) media.add(rule.atRules.join(' '));
        else selectors.add(rule.selector);
      }
    }
  }
  return { media: [...media].sort(), selectors: [...selectors].sort() };
}

/** Mechanical shorthand split: `padding: A` / `padding: A B` where every
 *  term is a single var() becomes padding-block / padding-inline (the CSS
 *  shorthand's own semantics). 3- and 4-term shorthands are NOT split (their
 *  per-side longhands are not contract channels) — refused by the caller. */
export function splitPaddingShorthand(value: string): { block: string; inline: string } | null {
  const terms = value.trim().split(/\s+(?![^(]*\))/); // split on spaces outside parens
  if (terms.length === 1) return { block: terms[0], inline: terms[0] };
  if (terms.length === 2) return { block: terms[0], inline: terms[1] };
  return null;
}

export function effectiveDecls(rules: FlatRule[], q: MatchQuery, usedOrders?: Set<number>): QueryOutcome {
  const winners = new Map<string, EffectiveDecl>();
  const refusals = new Set<string>();
  const applicable: { rule: FlatRule; spec: number }[] = [];
  for (const rule of rules) {
    if (rule.atRules.length > 0) continue; // named elsewhere (ledger)
    let best: number | null = null;
    for (const sel of splitTopLevel(rule.selector, ',')) {
      const m = matchSelector(sel, q);
      if (m.refused) refusals.add(m.refused);
      if (m.matches) best = best === null ? m.specificity : Math.max(best, m.specificity);
    }
    if (best !== null) {
      applicable.push({ rule, spec: best });
      usedOrders?.add(rule.order);
    }
  }
  applicable.sort((a, b) => a.spec - b.spec || a.rule.order - b.rule.order);
  for (const { rule, spec } of applicable) {
    for (const d of rule.decls) {
      if (d.prop.startsWith('--')) continue;
      winners.set(d.prop, { prop: d.prop, value: d.value, selector: rule.selector, specificity: spec, order: rule.order });
    }
  }
  return { winners, refusals: [...refusals].sort() };
}
