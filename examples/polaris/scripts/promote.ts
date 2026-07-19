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
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { emitHtml, emitReact } from '../../../core/index.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import {
  customPropDefs,
  effectiveDecls,
  parseModuleCss,
  resolveToRef,
  splitPaddingShorthand,
  type FlatRule,
  type StateName,
  type TokenLookup,
} from './lib-css.js';
import { CURATION, type ComponentCuration, type PartCuration } from './curation.js';

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

interface ResolvedChannels {
  tokens: Record<string, string>;
  layout: Record<string, unknown>;
  /** channel → the would-be ledger line; the CALLER pushes lines only for
   *  bindings actually attached to the contract (a "carried" line must mean
   *  exactly that). */
  lines: Record<string, string>;
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
): ResolvedChannels {
  const defs = customPropDefs(rules, rootClasses);
  const { winners, refusals } = effectiveDecls(rules, { rootClasses, partSelector, state }, usedOrders);
  for (const r of refusals) ledger.refused.push(`${where}: ${r}`);
  const tokens: Record<string, string> = {};
  const layout: Record<string, unknown> = {};
  const lines: Record<string, string> = {};

  const tryCarry = (channel: string, value: string, selector: string) => {
    const res = resolveToRef(value, defs, lookup);
    if (res.kind === 'ref') {
      tokens[channel] = res.ref;
      lines[channel] =
        `${where}: ${channel} → \`${res.ref}\` (from \`${selector} { ${channel === value ? value : `${channel}: ${value}`} }\`${res.via.length > 0 ? ` via ${res.via.join(' → ')}` : ''})`;
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
    const reason = res.kind === 'refused' ? res.reason : `multi-layer value "${value}" is not a single binding`;
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
  return { tokens, layout, lines };
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
    if (target) {
      const where = `part ${pc.name} (${target})`;
      const base = resolveChannels(rules, rootCtx, target, undefined, ledger, where, usedOrders);
      if (Object.keys(base.tokens).length > 0) {
        part.tokens = base.tokens;
        for (const ch of Object.keys(base.tokens)) ledger.carried.push(base.lines[ch]);
      }
      if (Object.keys(base.layout).length > 0) part.layout = base.layout;
      // Per-axis overrides (ONE tokensByProp per part — first axis with any
      // difference wins; further axes with differences are named).
      let tbp: { prop: string; map: Record<string, Record<string, string>> } | null = null;
      for (const axis of axes) {
        const map: Record<string, Record<string, string>> = {};
        const axisLines = new Map<string, string[]>();
        for (const [value, cls] of Object.entries(axis.classOf)) {
          const ctx = new Set([cur.rootClass, cls]);
          const scoped = resolveChannels(rules, ctx, target, undefined, ledger, `part ${pc.name} [${axis.prop}=${value}]`, usedOrders);
          const overrides: Record<string, string> = {};
          const overrideLines: string[] = [];
          for (const [ch, ref] of Object.entries(scoped.tokens)) {
            if (base.tokens[ch] !== ref) {
              overrides[ch] = ref;
              overrideLines.push(scoped.lines[ch]);
            }
          }
          if (Object.keys(overrides).length > 0) map[value] = overrides;
          axisLines.set(value, overrideLines);
        }
        if (Object.keys(map).length === 0) continue;
        if (tbp) {
          const lost = Object.entries(map)
            .map(([v, o]) => `${v}: ${Object.entries(o).map(([ch, ref]) => `${ch} → ${ref}`).join(', ')}`)
            .join(' · ');
          ledger.refused.push(
            `part ${pc.name}: axis ${axis.prop} also resolves per-value bindings (${lost}) but the schema carries ONE tokensByProp per part (axis "${tbp.prop}" won by curation order) — a NAMED SCHEMA LIMIT this showcase surfaces`,
          );
          continue;
        }
        tbp = { prop: axis.prop, map };
        for (const ls of axisLines.values()) for (const l of ls) ledger.carried.push(l);
      }
      if (tbp) part.tokensByProp = tbp;
      // Part-level states: color-kind channels only.
      const states: Record<string, Record<string, string>> = {};
      for (const st of STATES) {
        const scoped = resolveChannels(rules, rootCtx, target, st, ledger, `part ${pc.name} :${st}`, usedOrders);
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
    if (pc.parts && pc.parts.length > 0) {
      part.parts = Object.fromEntries(pc.parts.map((child) => [child.name, buildPart(child)]));
    }
    return part;
  };

  // ROOT
  const root: Record<string, unknown> = {};
  const rootWhere = `root (.${cur.rootClass})`;
  const rootBase = resolveChannels(rules, rootCtx, undefined, undefined, ledger, rootWhere, usedOrders);
  if (Object.keys(rootBase.tokens).length > 0) {
    root.tokens = rootBase.tokens;
    for (const ch of Object.keys(rootBase.tokens)) ledger.carried.push(rootBase.lines[ch]);
  }
  if (Object.keys(rootBase.layout).length > 0) root.layout = rootBase.layout;

  let rootTbp: { prop: string; map: Record<string, Record<string, string>> } | null = null;
  for (const axis of axes) {
    const map: Record<string, Record<string, string>> = {};
    const axisLines = new Map<string, string[]>();
    for (const [value, cls] of Object.entries(axis.classOf)) {
      const ctx = new Set([cur.rootClass, cls]);
      const scoped = resolveChannels(rules, ctx, undefined, undefined, ledger, `root [${axis.prop}=${value}]`, usedOrders);
      const overrides: Record<string, string> = {};
      const overrideLines: string[] = [];
      for (const [ch, ref] of Object.entries(scoped.tokens)) {
        if (rootBase.tokens[ch] !== ref) {
          overrides[ch] = ref;
          overrideLines.push(scoped.lines[ch]);
        }
      }
      if (Object.keys(overrides).length > 0) map[value] = overrides;
      axisLines.set(value, overrideLines);
    }
    if (Object.keys(map).length === 0) continue;
    if (rootTbp) {
      const lost = Object.entries(map)
        .map(([v, o]) => `${v}: ${Object.entries(o).map(([ch, ref]) => `${ch} → ${ref}`).join(', ')}`)
        .join(' · ');
      ledger.refused.push(
        `root: axis ${axis.prop} also resolves per-value bindings (${lost}) but the schema carries ONE tokensByProp per part (axis "${rootTbp.prop}" won by curation order) — a NAMED SCHEMA LIMIT this showcase surfaces`,
      );
      continue;
    }
    rootTbp = { prop: axis.prop, map };
    for (const ls of axisLines.values()) for (const l of ls) ledger.carried.push(l);
  }
  if (rootTbp) root.tokensByProp = rootTbp;

  const rootStates: Record<string, Record<string, string>> = {};
  for (const st of STATES) {
    const scoped = resolveChannels(rules, rootCtx, undefined, st, ledger, `root :${st}`, usedOrders);
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
