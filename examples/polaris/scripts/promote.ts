/**
 * PROMOTION: extractor proposals + curated review → committed contracts.
 *
 *   npx tsx examples/polaris/scripts/promote.ts
 *
 * Requires the mechanical extraction to have run first:
 *   npm run extract:code -- examples/polaris/extract.config.json
 *
 * For each curated component this script:
 *   1. takes the mechanical proposal's API surface VERBATIM (props, events,
 *      defaults — nothing re-added, every dropped prop stays a named note)
 *   2. re-reads the component's REAL module.css from the pinned clone and
 *      mechanically inverts it under the curated class map (lib-css.ts):
 *      single-token var() chains become bindings; literals, calc(), mixins,
 *      shorthands, combinators, @media and multi-axis conditions are
 *      REFUSED BY NAME into the promotion ledger
 *   3. merges curated extra bindings (each with a REQUIRED source citation
 *      — e.g. Banner's tone palette from bannerAttributes)
 *   4. validates against ContractSchema AND the code generator's own
 *      validateContract (an invalid promotion refuses, never lands)
 *   5. writes contracts/*.contract.json (deterministic) and
 *      extraction/PROMOTION.md — the complete decision ledger
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  LITERAL_CHANNELS,
  type Contract,
} from '../../../scripts/contract-schema.js';
import { emitHtml, emitReact } from '../../../core/index.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import {
  customPropDefs,
  effectiveDecls,
  parseModuleCss,
  resolveToRef,
  splitPaddingShorthand,
  varDefinitionContexts,
  type FlatRule,
  type StateName,
  type TokenLookup,
} from './lib-css.js';
import {
  CURATION,
  type ComponentCuration,
  type CompositionTypographyCuration,
  type PartCuration,
} from './curation.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const EXAMPLE = path.dirname(HERE);
const COMPONENTS_ROOT = path.join(EXAMPLE, '.polaris-clone', 'polaris-react', 'src', 'components');
const OUT_CONTRACTS = path.join(EXAMPLE, 'contracts');
const PROPOSALS = path.join(EXAMPLE, 'out', 'contracts');

const PINNED_SHA = '2b1ea88625e0613853ca8577c9acd1980a90f382';
const POLARIS_REACT_VERSION = '13.10.1';
const EXTRACTION_DATE = '2026-07-18';

/** Styled channels the promotion attempts — the comparison vocabulary. */
const CHANNELS = [
  'background', 'background-color', 'color', 'fill',
  'border-radius', 'border-color', 'border-width', 'border',
  'padding', 'padding-block', 'padding-inline',
  'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'gap', 'min-height', 'min-width', 'height', 'width', 'box-shadow',
] as const;

/** Part-level interaction states may carry COLOR-KIND channels only
 *  (schema v13 / emit-react PART_STATE_CHANNELS). */
const PART_STATE_CHANNELS = new Set(['color', 'background-color', 'border-color']);
const STATES: StateName[] = ['hover', 'active', 'focus-visible', 'disabled'];

// Layout literals the contract schema carries natively.
const LAYOUT_DISPLAY = new Set(['flex', 'inline-flex']);
const LAYOUT_ALIGN: Record<string, string> = {
  'flex-start': 'start', start: 'start', center: 'center', 'flex-end': 'end', end: 'end', stretch: 'stretch',
};
const LAYOUT_JUSTIFY: Record<string, string> = {
  'flex-start': 'start', start: 'start', center: 'center', 'flex-end': 'end', end: 'end', 'space-between': 'space-between',
};

interface Ledger {
  carried: string[];
  refused: string[];
  curated: string[];
}

const tokensDoc = JSON.parse(
  readFileSync(path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'), 'utf8'),
) as { p: Record<string, unknown> };
const tokenNames = new Set(Object.keys(tokensDoc.p));
const lookup: TokenLookup = {
  pathOfVar: (v) => (v.startsWith('p-') && tokenNames.has(v.slice(2)) ? `p.${v.slice(2)}` : undefined),
};

const sortDeep = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(sortDeep);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, sortDeep(v)]),
  );
};

function classesExist(cur: ComponentCuration, rules: FlatRule[]): void {
  const classText = rules.map((r) => r.selector).join('\n');
  const requireClass = (cls: string, what: string) => {
    if (!new RegExp(`\\.${cls}(?![A-Za-z0-9_-])`).test(classText)) {
      throw new Error(`${cur.name}: curated ${what} class ".${cls}" does not exist in ${cur.cssFile} — refusing to promote an invented mapping`);
    }
  };
  requireClass(cur.rootClass, 'root');
  for (const axis of cur.axes) for (const cls of Object.values(axis.classOf)) requireClass(cls, `axis ${axis.prop}`);
  for (const p of walkCuration(cur.parts)) if (p.cssClass) requireClass(p.cssClass.slice(1), `part ${p.name}`);
}

function* walkCuration(parts: PartCuration[] | undefined): Generator<PartCuration> {
  for (const p of parts ?? []) {
    yield p;
    yield* walkCuration(p.parts);
  }
}

/** Literal values the promotion CARRIES when a var() chain resolves to one:
 *  px/rem/em/unitless numbers, hex and rgb()/rgba() colors, and
 *  `transparent`. Inheritance keywords (inherit/currentColor) resolve
 *  deterministically too but carry no standalone fact — refused by name. */
const CARRIABLE_LITERAL = /^(-?\d+(\.\d+)?(px|rem|em)?|transparent|#[0-9a-fA-F]{3,8}|rgba?\([\d ,./%]+\))$/;

interface ResolvedChannels {
  tokens: Record<string, string>;
  /** COVERAGE ROUND: channel → literal value chain-resolved from the same
   *  package's CSS (schema v14 `literals`), each with provenance in lines. */
  literals: Record<string, string>;
  layout: Record<string, unknown>;
  /** channel → the would-be ledger line; the CALLER pushes lines only for
   *  bindings actually attached to the contract (a "carried" line must mean
   *  exactly that). Literal lines are keyed `lit:${channel}`. */
  lines: Record<string, string>;
}

/** Line number of a custom-property definition in the raw CSS (provenance
 *  for carried literals); undefined when not uniquely locatable. */
function defLineOf(raw: string, varName: string): number | undefined {
  const lines = raw.split('\n');
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`--${varName}:`)) hits.push(i + 1);
  }
  return hits.length === 1 ? hits[0] : undefined;
}

/** Resolve the whitelisted channels for one (context, target) query. */
function resolveChannels(
  rules: FlatRule[],
  rootClasses: Set<string>,
  partSelector: string | undefined,
  state: StateName | undefined,
  ledger: Ledger,
  where: string,
  usedOrders?: Set<number>,
  cssFile?: string,
  rawCss?: string,
): ResolvedChannels {
  const defs = customPropDefs(rules, rootClasses);
  const { winners, refusals } = effectiveDecls(rules, { rootClasses, partSelector, state }, usedOrders);
  for (const r of refusals) ledger.refused.push(`${where}: ${r}`);
  const tokens: Record<string, string> = {};
  const literals: Record<string, string> = {};
  const layout: Record<string, unknown> = {};
  const lines: Record<string, string> = {};

  // NARROWED refusal for an unresolvable var: name WHERE the file defines it
  // (@media-only → media-dependent; other class contexts → axis-scoped;
  // nowhere → runtime-set) instead of the generic no-definition message.
  const narrowUnresolvable = (reason: string): string => {
    const m = reason.match(/^var\(--([A-Za-z0-9_-]+)\) resolves to NO token and has no reachable definition in this class context$/);
    if (!m) return reason;
    const varName = m[1];
    const ctxs = varDefinitionContexts(rules, varName);
    const file = cssFile ?? 'this file';
    if (ctxs.selectors.length === 0 && ctxs.media.length === 0) {
      return `var(--${varName}) is RUNTIME-SET — no definition anywhere in ${file} (Polaris supplies it at runtime: inline style, global stylesheet, or wrapper component); refused by name`;
    }
    if (ctxs.selectors.length === 0) {
      return `var(--${varName}) is MEDIA-DEPENDENT — defined only under \`${ctxs.media.join('`, `')}\` in ${file}; breakpoint-conditional styling is not a contract channel`;
    }
    return `var(--${varName}) is defined only in other class contexts (\`${ctxs.selectors.join('`, `')}\`) in ${file} — carried where those contexts are promoted axes, refused in this one`;
  };

  const tryCarry = (channel: string, value: string, selector: string) => {
    const res = resolveToRef(value, defs, lookup);
    if (res.kind === 'ref') {
      tokens[channel] = res.ref;
      lines[channel] =
        `${where}: ${channel} → \`${res.ref}\` (from \`${selector} { ${channel === value ? value : `${channel}: ${value}`} }\`${res.via.length > 0 ? ` via ${res.via.join(' → ')}` : ''})`;
      return;
    }
    // COVERAGE ROUND: a var() chain landing on a same-package literal
    // definition carries as a LITERAL (schema v14) with full provenance —
    // chain, defining selector, file and (when unique) line.
    if (res.kind === 'literal') {
      if (LITERAL_CHANNELS.has(channel) && CARRIABLE_LITERAL.test(res.value)) {
        const lastVar = [...res.via].reverse().find((x) => x.startsWith('--'))?.replace(/ .*$/, '');
        const line = rawCss && lastVar ? defLineOf(rawCss, lastVar.slice(2)) : undefined;
        literals[channel] = res.value;
        lines[`lit:${channel}`] =
          `${where}: ${channel} → literal \`${res.value}\` (resolved through ${res.via.join(' → ')}; defined by \`${res.defSelector}\`${cssFile ? ` in ${cssFile}${line ? `:${line}` : ''}` : ''})`;
        return;
      }
      const why = /^(inherit|currentColor)$/.test(res.value)
        ? `inheritance keyword \`${res.value}\` carries no standalone fact`
        : !LITERAL_CHANNELS.has(channel)
          ? `channel "${channel}" is outside the bounded literal-channel set`
          : `literal \`${res.value}\` is outside the bounded literal grammar`;
      ledger.refused.push(
        `${where}: ${channel} — chain-resolved literal \`${res.value}\` (via ${res.via.join(' → ')}) NOT carried: ${why} (\`${selector}\`)`,
      );
      return;
    }
    // CSS's own shorthand semantics for a multi-layer background: the LAST
    // layer is the background-color, preceding layers are background-image
    // (Polaris's primary button: `gradient-token, bg-fill-brand`). The color
    // layer carries as background-color; every image layer is a NAMED
    // refusal — the receipt shows the missing sheen honestly.
    if (res.kind === 'layers' && channel === 'background') {
      const last = resolveToRef(res.layers[res.layers.length - 1], defs, lookup);
      if (last.kind === 'ref') {
        tokens['background-color'] = last.ref;
        lines['background-color'] =
          `${where}: background-color → \`${last.ref}\` (the COLOR layer of the multi-layer \`${selector} { background: ${value} }\` — CSS shorthand semantics)`;
        for (const layer of res.layers.slice(0, -1)) {
          ledger.refused.push(
            `${where}: background image layer \`${layer}\` — a gradient/image overlay is not a single token binding; not carried (\`${selector}\`)`,
          );
        }
        return;
      }
    }
    const reason =
      res.kind === 'refused' ? narrowUnresolvable(res.reason) : `multi-layer value "${value}" is not a single binding`;
    ledger.refused.push(`${where}: ${channel} — ${reason} (\`${selector}\`)`);
  };

  for (const channel of CHANNELS) {
    const w = winners.get(channel);
    if (!w) continue;
    if (channel === 'border') {
      if (winners.has('border-width') || winners.has('border-color')) continue;
      // `border: <width> solid <color>` — the CSS shorthand's own longhands;
      // any other style keyword (or term count) refuses by name. The
      // emitters add `border-style: solid` themselves whenever a
      // border-width/border-color binding is present.
      const terms = w.value.trim().split(/\s+(?![^(]*\))/);
      if (terms.length === 3 && terms[1] === 'solid') {
        tryCarry('border-width', terms[0], w.selector);
        tryCarry('border-color', terms[2], w.selector);
      } else {
        ledger.refused.push(`${where}: border — shorthand "${w.value}" is not \`<width> solid <color>\`; no per-part contract channel (\`${w.selector}\`)`);
      }
      continue;
    }
    if (channel === 'padding') {
      if (winners.has('padding-block') || winners.has('padding-inline')) continue;
      const split = splitPaddingShorthand(w.value);
      if (!split) {
        ledger.refused.push(`${where}: padding — 3/4-term shorthand "${w.value}" has no per-side contract channel (\`${w.selector}\`)`);
        continue;
      }
      tryCarry('padding-block', split.block, w.selector);
      tryCarry('padding-inline', split.inline, w.selector);
      continue;
    }
    tryCarry(channel, w.value, w.selector);
  }

  if (state === undefined) {
    const disp = winners.get('display')?.value;
    if (disp && LAYOUT_DISPLAY.has(disp)) layout.display = disp;
    const align = winners.get('align-items')?.value;
    if (align && LAYOUT_ALIGN[align]) layout.align = LAYOUT_ALIGN[align];
    const justify = winners.get('justify-content')?.value;
    if (justify && LAYOUT_JUSTIFY[justify]) layout.justify = LAYOUT_JUSTIFY[justify];
    const dir = winners.get('flex-direction')?.value;
    if (dir === 'row' || dir === 'column') layout.direction = dir;
  }
  return { tokens, literals, layout, lines };
}

/** Typography channels the composition carry is bounded to (workstream 2). */
const TYPO_CHANNELS = new Set(['font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-family']);

/** Parsed CSS of composition-typography CHILD components, by curation name. */
const childCssCache = new Map<string, { cur: ComponentCuration; rules: FlatRule[]; raw: string }>();
function childCss(name: string): { cur: ComponentCuration; rules: FlatRule[]; raw: string } {
  let c = childCssCache.get(name);
  if (!c) {
    const childCur = CURATION.find((x) => x.name === name);
    if (!childCur) throw new Error(`composition typography: no curation named "${name}"`);
    const raw = readFileSync(path.join(COMPONENTS_ROOT, childCur.cssFile), 'utf8');
    c = { cur: childCur, rules: parseModuleCss(raw), raw };
    childCssCache.set(name, c);
  }
  return c;
}

type TbpEntry = { prop: string; map: Record<string, Record<string, string>> };

/** COVERAGE ROUND: resolve one axis's per-value overrides against a base —
 *  tokens AND literals — with mixed-kind channels (token for one value,
 *  literal for another on the SAME axis) refused wholesale by name. Carried
 *  lines are pushed only for surviving channels. */
function promoteAxis(
  rules: FlatRule[],
  cur: ComponentCuration,
  axis: { prop: string; classOf: Record<string, string> },
  target: string | undefined,
  base: ResolvedChannels,
  ledger: Ledger,
  partLabel: string,
  usedOrders: Set<number>,
  rawCss: string,
): { tokenMap: Record<string, Record<string, string>>; literalMap: Record<string, Record<string, string>> } {
  interface Override { value: string; ch: string; kind: 'token' | 'literal'; val: string; line: string }
  const overrides: Override[] = [];
  for (const [value, cls] of Object.entries(axis.classOf)) {
    const ctx = new Set([cur.rootClass, cls]);
    const where = `${partLabel} [${axis.prop}=${value}]`;
    const scoped = resolveChannels(rules, ctx, target, undefined, ledger, where, usedOrders, cur.cssFile, rawCss);
    for (const [ch, ref] of Object.entries(scoped.tokens)) {
      if (base.tokens[ch] !== ref) overrides.push({ value, ch, kind: 'token', val: ref, line: scoped.lines[ch] });
    }
    for (const [ch, lit] of Object.entries(scoped.literals)) {
      if (base.literals[ch] !== lit) overrides.push({ value, ch, kind: 'literal', val: lit, line: scoped.lines[`lit:${ch}`] });
    }
  }
  // Mixed-kind channels across one axis's values — refused wholesale.
  const kindsByCh = new Map<string, Set<string>>();
  for (const o of overrides) (kindsByCh.get(o.ch) ?? kindsByCh.set(o.ch, new Set()).get(o.ch)!).add(o.kind);
  const mixed = new Set([...kindsByCh.entries()].filter(([, ks]) => ks.size > 1).map(([ch]) => ch));
  for (const ch of mixed) {
    const spelled = overrides
      .filter((o) => o.ch === ch)
      .map((o) => `${o.value}: ${o.kind} \`${o.val}\``)
      .join(' · ');
    ledger.refused.push(
      `${partLabel}: axis ${axis.prop} resolves channel "${ch}" to a TOKEN for some values and a LITERAL for others (${spelled}) — a mixed-kind axis channel is ambiguous; refused by name`,
    );
  }
  const tokenMap: Record<string, Record<string, string>> = {};
  const literalMap: Record<string, Record<string, string>> = {};
  for (const o of overrides) {
    if (mixed.has(o.ch)) continue;
    const bucket = o.kind === 'token' ? tokenMap : literalMap;
    (bucket[o.value] ??= {})[o.ch] = o.val;
    ledger.carried.push(o.line);
  }
  return { tokenMap, literalMap };
}

/** Order axes by the SOURCE ORDER of their first class rule in the module
 *  css — Polaris's own cascade ("font-weight must be below variant styles so
 *  it can override" — Text.module.css) becomes the entries' documented
 *  later-wins order. Ties keep curation order. */
function orderAxes<T extends { classOf: Record<string, string> }>(axes: T[], rules: FlatRule[]): T[] {
  const orderOf = (axis: T): number => {
    let min = Number.MAX_SAFE_INTEGER;
    for (const cls of Object.values(axis.classOf)) {
      const re = new RegExp(`\\.${cls}(?![A-Za-z0-9_-])`);
      for (const rule of rules) {
        if (rule.atRules.length === 0 && re.test(rule.selector)) {
          min = Math.min(min, rule.order);
          break;
        }
      }
    }
    return min;
  };
  return [...axes]
    .map((a, i) => ({ a, i, o: orderOf(a) }))
    .sort((x, y) => x.o - y.o || x.i - y.i)
    .map((x) => x.a);
}

/** Attach tokensByProp/literalsByProp entries to a built part/root object —
 *  single-object spelling when exactly one token entry (byte-friendly for
 *  unaffected contracts), ordered array beyond that. */
function attachEntries(
  target: Record<string, unknown>,
  tokenEntries: TbpEntry[],
  literalEntries: TbpEntry[],
): void {
  if (tokenEntries.length === 1) target.tokensByProp = tokenEntries[0];
  else if (tokenEntries.length > 1) target.tokensByProp = tokenEntries;
  if (literalEntries.length > 0) target.literalsByProp = literalEntries;
}

function promoteOne(cur: ComponentCuration): { contract: Contract; ledgerMd: string[]; counts: { carried: number; refused: number; curated: number } } {
  const cssPath = path.join(COMPONENTS_ROOT, cur.cssFile);
  const rules = parseModuleCss(readFileSync(cssPath, 'utf8'));
  classesExist(cur, rules);

  const proposal = JSON.parse(
    readFileSync(path.join(PROPOSALS, `${cur.idSuffix}.contract.json`), 'utf8'),
  ) as Record<string, unknown>;
  const props = proposal.props as { name: string; type: unknown }[];
  const enumValuesOf = (propName: string): string[] | null => {
    const p = props.find((x) => x.name === propName);
    if (!p || typeof p.type !== 'object' || p.type === null || !('enum' in p.type)) return null;
    return (p.type as { enum: string[] }).enum;
  };

  const ledger: Ledger = { carried: [], refused: [], curated: [] };
  const usedOrders = new Set<number>();
  const declaredStates = new Set<StateName>();
  for (const note of cur.notes) ledger.curated.push(`NOTE: ${note}`);

  // @media / at-rule declarations in promoted channels — named wholesale.
  for (const rule of rules) {
    if (rule.atRules.length === 0) continue;
    for (const d of rule.decls) {
      if ((CHANNELS as readonly string[]).includes(d.prop) || d.prop.startsWith('--')) {
        ledger.refused.push(
          `at-rule: \`${rule.atRules.join(' ')} { ${rule.selector} { ${d.prop}: ${d.value} } }\` — conditional styling is not a contract channel`,
        );
      }
    }
  }
  // Non-colon statements the parser saw (postcss @mixin lines) are invisible
  // to the rule model — name their presence from the raw text.
  const rawCss = readFileSync(cssPath, 'utf8');
  for (const m of rawCss.matchAll(/@mixin\s+([a-z0-9- ,()]+);/gi)) {
    ledger.refused.push(`mixin: \`@mixin ${m[1].trim()}\` — postcss mixin, expands outside the promoted rule model`);
  }

  // Validate axes against the EXTRACTED API (never invent an axis).
  const axes = cur.axes.filter((axis) => {
    const values = enumValuesOf(axis.prop);
    if (!values) {
      throw new Error(`${cur.name}: curated axis "${axis.prop}" is not an extracted enum prop — a dropped prop stays dropped`);
    }
    for (const v of Object.keys(axis.classOf)) {
      if (!values.includes(v)) throw new Error(`${cur.name}: axis ${axis.prop} curates unknown value "${v}"`);
    }
    return true;
  });

  const rootCtx = new Set([cur.rootClass]);
  const orderedAxes = orderAxes(axes, rules);

  const buildPart = (pc: PartCuration): Record<string, unknown> => {
    const part: Record<string, unknown> = {};
    if (pc.element) part.element = pc.element;
    if (pc.attrs) part.attrs = pc.attrs;
    if (pc.content) part.content = pc.content;
    if (pc.text !== undefined) part.text = pc.text;
    if (pc.icon) part.icon = pc.icon;
    if (pc.visibleWhen) part.visibleWhen = pc.visibleWhen;
    if (pc.optional) part.optional = true;
    if (pc.animation) part.animation = pc.animation;
    if (pc.shape) {
      part.shape = pc.shape;
      ledger.curated.push(`part ${pc.name}: literal geometry carried as shape (${pc.shape.width}×${pc.shape.height}) — ${pc.shapeCite ?? 'CITATION MISSING'}`);
    }
    const target = pc.cssClass ?? pc.nestedSelector;
    const tokenEntries: TbpEntry[] = [];
    const literalEntries: TbpEntry[] = [];
    if (target) {
      const where = `part ${pc.name} (${target})`;
      const base = resolveChannels(rules, rootCtx, target, undefined, ledger, where, usedOrders, cur.cssFile, rawCss);
      if (Object.keys(base.tokens).length > 0) {
        part.tokens = base.tokens;
        for (const ch of Object.keys(base.tokens)) ledger.carried.push(base.lines[ch]);
      }
      if (Object.keys(base.literals).length > 0) {
        part.literals = base.literals;
        for (const ch of Object.keys(base.literals)) ledger.carried.push(base.lines[`lit:${ch}`]);
      }
      if (Object.keys(base.layout).length > 0) part.layout = base.layout;
      // Per-axis overrides — EVERY axis with differences carries (schema v14
      // lifted the one-tokensByProp limit); entries in CSS source order so
      // the later-wins array semantics mirror the cascade they came from.
      for (const axis of orderedAxes) {
        const { tokenMap, literalMap } = promoteAxis(rules, cur, axis, target, base, ledger, `part ${pc.name}`, usedOrders, rawCss);
        if (Object.keys(tokenMap).length > 0) tokenEntries.push({ prop: axis.prop, map: tokenMap });
        if (Object.keys(literalMap).length > 0) literalEntries.push({ prop: axis.prop, map: literalMap });
      }
      // Part-level states: color-kind channels only.
      const states: Record<string, Record<string, string>> = {};
      for (const st of STATES) {
        const scoped = resolveChannels(rules, rootCtx, target, st, ledger, `part ${pc.name} :${st}`, usedOrders, cur.cssFile, rawCss);
        const overrides: Record<string, string> = {};
        for (const [ch, ref] of Object.entries(scoped.tokens)) {
          if (base.tokens[ch] === ref) continue;
          if (!PART_STATE_CHANNELS.has(ch)) {
            ledger.refused.push(`part ${pc.name} :${st}: ${ch} — part-level states carry color-kind channels only (schema v13); not carried`);
            continue;
          }
          overrides[ch] = ref;
          ledger.carried.push(scoped.lines[ch]);
        }
        if (Object.keys(overrides).length > 0) {
          states[st] = overrides;
          declaredStates.add(st);
        }
      }
      if (Object.keys(states).length > 0) part.states = states;
    }
    // COVERAGE ROUND workstream 2: composition-owned typography, resolved
    // mechanically from the CHILD component's own module.css.
    if (pc.typographyFrom) {
      const comp = applyCompositionTypography(pc, part);
      tokenEntries.push(...comp.tokenEntries);
      literalEntries.push(...comp.literalEntries);
    }
    attachEntries(part, tokenEntries, literalEntries);
    if (pc.parts && pc.parts.length > 0) {
      part.parts = Object.fromEntries(pc.parts.map((child) => [child.name, buildPart(child)]));
    }
    return part;
  };

  // COVERAGE ROUND workstream 2: resolve a child-typography query — child
  // root class + one class per (childProp, value) — against the CHILD's own
  // module.css, bounded to typography channels. The child's own refusals are
  // already named under the child's promotion section; this query's scratch
  // ledger is discarded (named in the curated note below).
  const resolveChildTypo = (
    tf: CompositionTypographyCuration,
    childProps: Record<string, string>,
    where: string,
  ): ResolvedChannels => {
    const child = childCss(tf.child);
    const ctx = new Set([child.cur.rootClass]);
    for (const [prop, value] of Object.entries(childProps)) {
      const axis = child.cur.axes.find((a) => a.prop === prop);
      if (!axis) throw new Error(`${cur.name}: composition typography — child "${tf.child}" has no curated axis "${prop}"`);
      const cls = axis.classOf[value];
      if (!cls) throw new Error(`${cur.name}: composition typography — child axis "${prop}" has no class for value "${value}"`);
      ctx.add(cls);
    }
    const scratch: Ledger = { carried: [], refused: [], curated: [] };
    const res = resolveChannels(child.rules, ctx, undefined, undefined, scratch, where, undefined, child.cur.cssFile, child.raw);
    const out: ResolvedChannels = { tokens: {}, literals: {}, layout: {}, lines: {} };
    for (const [ch, ref] of Object.entries(res.tokens)) {
      if (!TYPO_CHANNELS.has(ch)) continue;
      out.tokens[ch] = ref;
      out.lines[ch] = res.lines[ch];
    }
    for (const [ch, lit] of Object.entries(res.literals)) {
      if (!TYPO_CHANNELS.has(ch)) continue;
      out.literals[ch] = lit;
      out.lines[`lit:${ch}`] = res.lines[`lit:${ch}`];
    }
    return out;
  };

  const spellProps = (p: Record<string, string>) =>
    Object.entries(p).map(([k, v]) => `${k}=${v}`).join(' ');

  const applyCompositionTypography = (
    pc: PartCuration,
    part: Record<string, unknown>,
  ): { tokenEntries: TbpEntry[]; literalEntries: TbpEntry[] } => {
    const tf = pc.typographyFrom!;
    ledger.curated.push(
      `part ${pc.name}: composition-owned typography promoted THROUGH ${tf.child} (bounded to ${[...TYPO_CHANNELS].join('/')}) — ${tf.cite}. ` +
        `Every carried channel below resolved mechanically from ${childCss(tf.child).cur.cssFile} under ${tf.child}'s own reviewed class map; ` +
        `${tf.child}'s own refusals stay named under its promotion section`,
    );
    for (const r of tf.refusals ?? []) ledger.refused.push(`part ${pc.name} [composition]: ${r}`);
    const base = resolveChildTypo(tf, tf.base, `part ${pc.name} [composition ${tf.child} ${spellProps(tf.base)}]`);
    if (Object.keys(base.tokens).length > 0) {
      for (const [ch, ref] of Object.entries(base.tokens)) {
        const existing = (part.tokens as Record<string, string> | undefined)?.[ch];
        if (existing && existing !== ref) {
          throw new Error(`${cur.name}: part ${pc.name} composition typography channel "${ch}" collides with a CSS-derived binding`);
        }
        part.tokens = { ...(part.tokens as Record<string, string> | undefined), [ch]: ref };
        ledger.carried.push(base.lines[ch]);
      }
    }
    if (Object.keys(base.literals).length > 0) {
      for (const [ch, lit] of Object.entries(base.literals)) {
        part.literals = { ...(part.literals as Record<string, string> | undefined), [ch]: lit };
        ledger.carried.push(base.lines[`lit:${ch}`]);
      }
    }
    const tokenEntries: TbpEntry[] = [];
    const literalEntries: TbpEntry[] = [];
    for (const bp of tf.byParentProp ?? []) {
      const parentValues = enumValuesOf(bp.prop);
      if (!parentValues) {
        throw new Error(`${cur.name}: composition typography byParentProp "${bp.prop}" is not an extracted enum prop`);
      }
      const tMap: Record<string, Record<string, string>> = {};
      const lMap: Record<string, Record<string, string>> = {};
      for (const [pv, changes] of Object.entries(bp.map)) {
        if (!parentValues.includes(pv)) {
          throw new Error(`${cur.name}: composition typography byParentProp ${bp.prop} maps unknown value "${pv}"`);
        }
        const merged = { ...tf.base, ...changes };
        const scoped = resolveChildTypo(
          tf,
          merged,
          `part ${pc.name} [${bp.prop}=${pv} → ${tf.child} ${spellProps(merged)}]`,
        );
        for (const [ch, ref] of Object.entries(scoped.tokens)) {
          if (base.tokens[ch] !== ref) {
            (tMap[pv] ??= {})[ch] = ref;
            ledger.carried.push(scoped.lines[ch]);
          }
        }
        for (const [ch, lit] of Object.entries(scoped.literals)) {
          if (base.literals[ch] !== lit) {
            (lMap[pv] ??= {})[ch] = lit;
            ledger.carried.push(scoped.lines[`lit:${ch}`]);
          }
        }
      }
      if (Object.keys(tMap).length > 0) tokenEntries.push({ prop: bp.prop, map: tMap });
      if (Object.keys(lMap).length > 0) literalEntries.push({ prop: bp.prop, map: lMap });
    }
    return { tokenEntries, literalEntries };
  };

  // ROOT
  const root: Record<string, unknown> = {};
  const rootWhere = `root (.${cur.rootClass})`;
  const rootBase = resolveChannels(rules, rootCtx, undefined, undefined, ledger, rootWhere, usedOrders, cur.cssFile, rawCss);
  if (Object.keys(rootBase.tokens).length > 0) {
    root.tokens = rootBase.tokens;
    for (const ch of Object.keys(rootBase.tokens)) ledger.carried.push(rootBase.lines[ch]);
  }
  if (Object.keys(rootBase.literals).length > 0) {
    root.literals = rootBase.literals;
    for (const ch of Object.keys(rootBase.literals)) ledger.carried.push(rootBase.lines[`lit:${ch}`]);
  }
  if (Object.keys(rootBase.layout).length > 0) root.layout = rootBase.layout;

  // Per-axis overrides — every axis carries (schema v14); entries in CSS
  // source order (later entries win per channel, the cascade's own rule).
  {
    const rootTokenEntries: TbpEntry[] = [];
    const rootLiteralEntries: TbpEntry[] = [];
    for (const axis of orderedAxes) {
      const { tokenMap, literalMap } = promoteAxis(rules, cur, axis, undefined, rootBase, ledger, 'root', usedOrders, rawCss);
      if (Object.keys(tokenMap).length > 0) rootTokenEntries.push({ prop: axis.prop, map: tokenMap });
      if (Object.keys(literalMap).length > 0) rootLiteralEntries.push({ prop: axis.prop, map: literalMap });
    }
    attachEntries(root, rootTokenEntries, rootLiteralEntries);
  }

  const rootStates: Record<string, Record<string, string>> = {};
  for (const st of STATES) {
    const scoped = resolveChannels(rules, rootCtx, undefined, st, ledger, `root :${st}`, usedOrders, cur.cssFile, rawCss);
    const overrides: Record<string, string> = {};
    for (const [ch, ref] of Object.entries(scoped.tokens)) {
      if (rootBase.tokens[ch] !== ref) {
        overrides[ch] = ref;
        ledger.carried.push(scoped.lines[ch]);
      }
    }
    if (Object.keys(overrides).length > 0) {
      rootStates[st] = overrides;
      declaredStates.add(st);
    }
  }
  if (Object.keys(rootStates).length > 0) root.states = rootStates;

  // Curated extra bindings (cited source facts outside the CSS module).
  for (const extra of cur.extraBindings ?? []) {
    const target = extra.part === 'root' ? root : undefined;
    if (!target) throw new Error(`${cur.name}: extraBindings target "${extra.part}" — only root is supported`);
    if (extra.tokens) {
      // A cited binding may REPLACE a CSS-derived one (Avatar: the styleOne
      // default palette replaces the base avatar-bg pair Polaris itself
      // always overrides). The replaced channel's carried line is withdrawn
      // — a "carried" line must mean exactly what the contract carries —
      // and the replacement is named in the curated record.
      const prev = target.tokens as Record<string, string> | undefined;
      for (const ch of Object.keys(extra.tokens)) {
        if (prev?.[ch] && prev[ch] !== extra.tokens[ch]) {
          const prefix = `root (.${cur.rootClass}): ${ch} → `;
          ledger.carried = ledger.carried.filter((l) => !l.startsWith(prefix));
          ledger.curated.push(
            `cited binding REPLACES the CSS-derived root ${ch} binding \`${prev[ch]}\` (see the citation below) — the base line is withdrawn from the carried list`,
          );
        }
      }
      target.tokens = { ...(target.tokens as Record<string, string> | undefined), ...extra.tokens };
    }
    if (extra.tokensByProp) {
      if (target.tokensByProp) throw new Error(`${cur.name}: extraBindings tokensByProp collides with a CSS-derived one`);
      if (!enumValuesOf(extra.tokensByProp.prop)) {
        throw new Error(`${cur.name}: extraBindings tokensByProp prop "${extra.tokensByProp.prop}" is not an extracted enum prop`);
      }
      target.tokensByProp = extra.tokensByProp;
    }
    ledger.curated.push(`CITED PROMOTION (${extra.part}): ${extra.cite}`);
    for (const [ch, ref] of Object.entries(extra.tokens ?? {})) {
      ledger.carried.push(`root: ${ch} → \`${ref}\` (cited, see above)`);
    }
    for (const [value, m] of Object.entries(extra.tokensByProp?.map ?? {})) {
      for (const [ch, ref] of Object.entries(m)) {
        ledger.carried.push(`root [${extra.tokensByProp!.prop}=${value}]: ${ch} → \`${ref}\` (cited, see above)`);
      }
    }
  }

  // Parts + optional sample label.
  const partEntries: [string, Record<string, unknown>][] = cur.parts.map((p) => [p.name, buildPart(p)]);
  if (cur.sampleText && cur.sampleText !== cur.name) {
    partEntries.push(['label', { element: 'span', text: cur.sampleText }]);
    ledger.curated.push(
      `sample label "${cur.sampleText}" carried as a static text part — Polaris's children prop is platform API (named extraction skip); a static surface needs sample ink and both sides of the receipts render the same string`,
    );
  }
  if (partEntries.length > 0) root.parts = Object.fromEntries(partEntries);

  const states = STATES.filter((s) => declaredStates.has(s));

  // Rules the promotion never matched — foreign-class descendants,
  // multi-axis conditions, unmapped parts. Each with promoted channels is
  // named; nothing exits this file silently.
  for (const rule of rules) {
    if (rule.atRules.length > 0 || usedOrders.has(rule.order)) continue;
    const promotedDecls = rule.decls.filter(
      (d) => (CHANNELS as readonly string[]).includes(d.prop) || d.prop.startsWith('--'),
    );
    if (promotedDecls.length === 0) continue;
    ledger.refused.push(
      `unmatched rule \`${rule.selector}\` — outside the promoted class map (foreign class, multi-axis condition, combinator, or unmapped part); ${promotedDecls.length} declaration(s) not carried`,
    );
  }

  // Showcase sample defaults for required text props (generator needs a
  // canvas/story sample) — sample ink, named, never a Polaris-default claim.
  for (const [propName, sample] of Object.entries(cur.sampleDefaults ?? {})) {
    const p = props.find((x) => x.name === propName) as
      | { name: string; type: unknown; required?: boolean; default?: unknown }
      | undefined;
    if (!p || p.type !== 'text' || p.required !== true || p.default !== undefined) {
      throw new Error(`${cur.name}: sampleDefaults.${propName} — only a required, default-less text prop takes a sample default`);
    }
    p.default = sample;
    ledger.curated.push(
      `prop \`${propName}\`: showcase sample default '${sample}' added (required text prop; the generator needs a canvas/story sample) — Polaris itself declares NO default for it`,
    );
  }

  const semantics: Record<string, unknown> = { element: cur.element };
  if (cur.role) semantics.role = cur.role;
  if (cur.roleByProp) {
    semantics.roleByProp = { prop: cur.roleByProp.prop, map: cur.roleByProp.map };
    ledger.curated.push(`semantics.roleByProp promoted — ${cur.roleByProp.cite}`);
  }

  const sourcePath = (proposal.anchors as { code: { importPath: string } }).code.importPath.replace(
    /^examples\/polaris\/\.polaris-clone\//,
    '',
  );

  const contract = {
    $schema: '../../../contracts/contract.schema.json',
    id: proposal.id,
    name: proposal.name,
    version: '0.1.0',
    status: 'draft',
    description:
      `${(proposal.description as string).split(' PROPOSED contract')[0]} `.trimStart() +
      `PROMOTED showcase contract: API surface extracted mechanically from Shopify/polaris @ ${PINNED_SHA} ` +
      `(polaris-react ${POLARIS_REACT_VERSION}, MIT © Shopify, extracted ${EXTRACTION_DATE}); styling bindings promoted ` +
      `from the component's own module.css under the reviewed class map in examples/polaris/scripts/curation.ts — ` +
      `every carried binding and every named refusal is listed in examples/polaris/extraction/PROMOTION.md.`,
    semantics,
    props: proposal.props,
    ...(Array.isArray(proposal.events) && (proposal.events as unknown[]).length > 0 ? { events: proposal.events } : {}),
    states,
    anatomy: { root },
    anchors: {
      figma: { fileKey: null, componentSetKey: null },
      code: { importPath: sourcePath, export: proposal.name },
    },
  };

  const parsed = ContractSchema.parse(sortDeep(contract));

  const ledgerMd = [
    `## ${cur.name} (\`${parsed.id}\`)`,
    '',
    `- source: \`polaris-react/src/components/${cur.cssFile}\` + extracted API (\`out/contracts/${cur.idSuffix}.contract.json\`)`,
    `- carried: ${ledger.carried.length} binding(s) · refused by name: ${ledger.refused.length} · curated decisions: ${ledger.curated.length}`,
    '',
    '### Curated decisions',
    ...ledger.curated.map((l) => `- ${l}`),
    '',
    '### Carried bindings (each cites its CSS rule)',
    ...ledger.carried.map((l) => `- ${l}`),
    '',
    '### Refused by name',
    ...dedupe(ledger.refused).map((l) => `- ${l}`),
    '',
  ];
  return { contract: parsed, ledgerMd, counts: { carried: ledger.carried.length, refused: dedupe(ledger.refused).length, curated: ledger.curated.length } };
}

const dedupe = (xs: string[]) => [...new Set(xs)];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

mkdirSync(OUT_CONTRACTS, { recursive: true });
const all: Contract[] = [];
const summary: Record<string, { carried: number; refused: number; curated: number }> = {};
const md: string[] = [
  '# Polaris showcase — promotion ledger',
  '',
  `Extraction: Shopify/polaris @ \`${PINNED_SHA}\` (polaris-react ${POLARIS_REACT_VERSION}, MIT), ${EXTRACTION_DATE}.`,
  '',
  'Every committed contract in `examples/polaris/contracts/` is the mechanical extraction proposal',
  '(API surface verbatim — no dropped prop was re-added) plus the styling promotion recorded here.',
  'A "carried" line is a binding whose value was mechanically resolved from the component\'s own',
  'module.css (or a cited source map) to a single published Polaris token; a "refused" line is a',
  'styling fact the contract does NOT carry, with the reason. Nothing is silent.',
  '',
];
for (const cur of CURATION) {
  const { contract, ledgerMd, counts } = promoteOne(cur);
  summary[contract.id] = counts;
  all.push(contract);
  md.push(...ledgerMd);
  writeFileSync(
    path.join(OUT_CONTRACTS, `${cur.idSuffix}.contract.json`),
    JSON.stringify(contract, null, 2) + '\n',
  );
}

// Generator acceptance: every promoted contract must EMIT (react + html) —
// a contract the generators refuse is not a showcase artifact.
const byId = new Map(all.map((c) => [c.id, c]));
const inventory = tokenInventoryFromJson([tokensDoc]);
const icons = new Map<string, string>([
  ['polaris-spinner-large', readFileSync(path.join(EXAMPLE, 'assets', 'icons', 'polaris-spinner-large.svg'), 'utf8').trim()],
  ['polaris-spinner-small', readFileSync(path.join(EXAMPLE, 'assets', 'icons', 'polaris-spinner-small.svg'), 'utf8').trim()],
]);
for (const c of all) {
  emitReact(c, { tokens: inventory, icons, contracts: byId });
  emitHtml(c, { tokens: inventory, icons, contracts: byId });
}

mkdirSync(path.join(EXAMPLE, 'extraction'), { recursive: true });
writeFileSync(path.join(EXAMPLE, 'extraction', 'PROMOTION.md'), md.join('\n') + '\n');
writeFileSync(
  path.join(EXAMPLE, 'extraction', 'promotion-summary.json'),
  JSON.stringify(summary, null, 2) + '\n',
);
console.log(`✔ ${all.length} contract(s) promoted → examples/polaris/contracts/`);
console.log('✔ generator acceptance: emitReact + emitHtml accepted every promoted contract');
console.log('✔ decision ledger → examples/polaris/extraction/PROMOTION.md');
