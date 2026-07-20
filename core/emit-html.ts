/**
 * Contract → static HTML + CSS — a pure emitter over the SAME contract
 * semantics the React generator renders, for surfaces with no build step
 * at all (CMS embeds, style-guide pages, email-adjacent chrome).
 *
 * NOT wired into `npm run generate` — golden output is untouched. Receipts:
 * core/emitters-check.ts (npm run emitters:check) + core/samples/.
 *
 * What it emits:
 *   · css  — the contract's anatomy compiled to plain CSS. Same token
 *     custom-properties the CSS Modules use (var(--a-b-c)); class names are
 *     component-prefixed BEM ("badge", "badge--variant-success",
 *     "badge__label") so composed components never collide the way scoped
 *     CSS Modules never collide. Dependency components' CSS is included
 *     (deduped) so composition renders.
 *   · html — a static showcase: the all-defaults rendering, one rendering
 *     per enum value of every axis (other axes at their defaults), and one
 *     per boolean prop set true.
 *
 * Fidelity notes (deliberate, documented in the emitted header comment):
 *   · Token VALUES arrive via CSS custom properties — the page must include
 *     the token stylesheet (src/styles/tokens.css) or the custom properties
 *     resolve to nothing.
 *   · No events, no interactivity beyond CSS states (:hover /
 *     :focus-visible / :disabled render; toggles do not run).
 *   · Slots render their declared defaultContent; an empty slot renders its
 *     wrapper EMPTY (absent content is absent — a comment names it; painted
 *     placeholder text would be invented ink the pixels then judge).
 *   · Boolean-driven parts render per the showcased boolean value.
 */
import {
  isNativeCheckablePart,
  shapeCssDecls,
  slotsOf,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
} from '../scripts/contract-schema.js';
import { kebab } from '../extract/types.js';
import {
  boolProps,
  enumProps,
  isEnum,
  rootElementsOf,
  textProps,
  UA_MARGIN_ELEMENTS,
  validateContract,
  type EmitCtx,
} from './emit-react.js';

const stripBraces = (ref: string) => ref.slice(1, -1);
const cssVar = (tokenPath: string) => `var(--${tokenPath.split('.').join('-')})`;
const placeholdersIn = (refPath: string): string[] =>
  [...refPath.matchAll(/\{([a-z][\w-]*)\}/g)].map((m) => m[1]);

const STATE_SELECTORS: Record<string, string> = {
  hover: ':hover:not(:disabled)',
  active: ':active:not(:disabled)',
  'focus-visible': ':focus-visible',
  disabled: ':disabled',
};
const OVERLAY_CSS: Record<string, string[]> = {
  top: ['bottom: 100%', 'left: 0'],
  bottom: ['top: 100%', 'left: 0'],
  start: ['right: 100%', 'top: 0'],
  end: ['left: 100%', 'top: 0'],
};
const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};
const JUSTIFY_CSS: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between',
};

/** CSS declarations for a layoutByProp override (v7) — mirrors
 *  core/emit-react.ts layoutOverrideDecls (reversed directions are plain
 *  CSS here; the canvas resolves them by reversing compiled child order). */
function layoutOverrideDecls(o: {
  display?: string;
  direction?: string;
  align?: string;
  justify?: string;
}): string[] {
  const d: string[] = [];
  if (o.display) d.push(`display: ${o.display}`);
  if (o.direction) d.push(`flex-direction: ${o.direction}`);
  if (o.align) d.push(`align-items: ${ALIGN_CSS[o.align]}`);
  if (o.justify) d.push(`justify-content: ${JUSTIFY_CSS[o.justify]}`);
  return d;
}

const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content &&
  !part.component;

function layoutDecls(part: Part): string[] {
  const d: string[] = [];
  if (isStructural(part)) {
    d.push(`display: ${part.layout?.display ?? 'flex'}`);
    if (part.layout?.direction) d.push(`flex-direction: ${part.layout.direction}`);
    if (part.layout?.wrap) d.push('flex-wrap: wrap');
    if (part.layout?.align) d.push(`align-items: ${ALIGN_CSS[part.layout.align]}`);
    if (part.layout?.justify) d.push(`justify-content: ${JUSTIFY_CSS[part.layout.justify]}`);
  }
  if (part.layout?.grow) d.push('flex: 1 1 auto', 'min-width: 0');
  return d;
}

// ---------------------------------------------------------------------------
// CSS — the anatomy compiled to component-prefixed plain CSS
// ---------------------------------------------------------------------------

function componentCss(contract: Contract): string[] {
  const k = kebab(contract.name);
  const rootCls = `.${k}`;
  const partCls = (name: string) => `.${k}__${name}`;
  const enumCls = (prop: string, value: string) => `.${k}--${prop}-${value}`;
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));
  const lines: string[] = [
    `/* ${contract.name} — from ${contract.id} v${contract.version} (core/emit-html.ts) */`,
    // Figma boxes are border-box (a bound 32px width IS 32px outside,
    // padding inside) — the canvas preview injects this same rule
    // (playground/src/engine/canvas-preview.ts) and the playground app
    // carries it globally (playground/src/styles.css). emit-html output is
    // self-sufficient, so the component scope declares its own box model;
    // without it every part binding width/height + padding inflated by the
    // padding (visual-parity receipt: Switch track 36×24 vs Figma's 32×20).
    '',
    `.${k}, .${k} *, .${k} *::before, .${k} *::after {`,
    '  box-sizing: border-box;',
    '}',
  ];

  const root = contract.anatomy.root;
  const rootDecls: string[] = [];
  if (root.layout) {
    rootDecls.push(`display: ${root.layout.display ?? 'flex'}`);
    if (root.layout.direction) rootDecls.push(`flex-direction: ${root.layout.direction}`);
    if (root.layout.wrap) rootDecls.push('flex-wrap: wrap');
    if (root.layout.align) rootDecls.push(`align-items: ${ALIGN_CSS[root.layout.align]}`);
    if (root.layout.justify) rootDecls.push(`justify-content: ${JUSTIFY_CSS[root.layout.justify]}`);
  } else {
    rootDecls.push('display: inline-flex', 'align-items: center', 'justify-content: center');
  }
  const rootTokens = root.tokens ?? {};
  // UA-margin neutralization (emit-react UA_MARGIN_ELEMENTS): the component's
  // box is contract-governed — h1-h6/p/hr/ul/… UA margins never leak.
  if (rootElementsOf(contract).some((el) => UA_MARGIN_ELEMENTS.has(el))) {
    rootDecls.push('margin: 0');
  }
  if ('border-width' in rootTokens || 'border-color' in rootTokens) rootDecls.push('border-style: solid');
  else rootDecls.push('border: 0');
  if ('max-width' in rootTokens) rootDecls.push('width: 100%', 'min-width: fit-content');
  // v15: a declared cursor fact is authoritative — the emitter's own button
  // chrome (cursor: pointer, :disabled not-allowed) yields to it (mirrors
  // core/emit-react.ts generateCss).
  const rootDeclaresCursor =
    Boolean(root.declared?.['cursor']) || Boolean(root.declaredStates?.['disabled']?.['cursor']);
  if (contract.semantics.element === 'button' && !rootDeclaresCursor) rootDecls.push('cursor: pointer');
  if (
    walkAnatomy(contract).some(
      (w) => w.part.overlay || (w.part.stylesWhen ?? []).some((sw) => sw.styles['position'] === 'absolute'),
    )
  ) {
    rootDecls.push('position: relative');
  }

  const enumRules = new Map<string, { prop: string; value: string; decls: string[] }>();
  /** Two-axis root tokens: compound modifier-class rules (the root carries
   *  every enum class, so `.k--variant-primary.k--state-hover` matches; its
   *  specificity outranks the single enum classes — the pair binding wins). */
  const pairRules: Array<{ selector: string; decls: string[] }> = [];
  const rootSubRules: Array<[string, string[]]> = [];
  for (const [cssProp, ref] of Object.entries(rootTokens)) {
    const refPath = stripBraces(ref);
    // overlap on the ROOT (P21): the gap token becomes a negative child
    // margin — mirrors core/emit-react.ts generateCss.
    if (cssProp === 'gap' && root.layout?.overlap) {
      const overlapPhs = placeholdersIn(refPath);
      if (overlapPhs.length === 1) {
        for (const value of enums.get(overlapPhs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${overlapPhs[0]}}`, value);
          rootSubRules.push([`${enumCls(overlapPhs[0], value)} > * + *`, [`margin-left: ${cssVar(resolved)}`]]);
        }
      } else {
        rootSubRules.push([`${rootCls} > * + *`, [`margin-left: ${cssVar(refPath)}`]]);
      }
      continue;
    }
    const phs = placeholdersIn(refPath);
    if (phs.length === 0) {
      rootDecls.push(`${cssProp}: ${cssVar(refPath)}`);
    } else if (phs.length === 1) {
      for (const value of enums.get(phs[0]) ?? []) {
        const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
        const key = `${phs[0]} ${value}`;
        const entry = enumRules.get(key) ?? { prop: phs[0], value, decls: [] };
        entry.decls.push(`${cssProp}: ${cssVar(resolved)}`);
        enumRules.set(key, entry);
      }
    } else if (phs.length === 2) {
      const [pa, pb] = phs;
      for (const a of enums.get(pa) ?? []) {
        for (const b of enums.get(pb) ?? []) {
          const resolved = refPath.replaceAll(`{${pa}}`, a).replaceAll(`{${pb}}`, b);
          pairRules.push({
            selector: `${enumCls(pa, a)}${enumCls(pb, b)}`,
            decls: [`${cssProp}: ${cssVar(resolved)}`],
          });
        }
      }
    } else if (phs.length === 3) {
      // Three-axis root token (live-gauntlet class ①: a minted background =
      // f(type, style, state) — CBDS Chip's root fill): one triple-compound
      // rule per value combination — mirrors emit-react generateCss.
      const [pa, pb, pc] = phs;
      for (const a of enums.get(pa) ?? []) {
        for (const b of enums.get(pb) ?? []) {
          for (const c of enums.get(pc) ?? []) {
            const resolved = refPath
              .replaceAll(`{${pa}}`, a)
              .replaceAll(`{${pb}}`, b)
              .replaceAll(`{${pc}}`, c);
            pairRules.push({
              selector: `${enumCls(pa, a)}${enumCls(pb, b)}${enumCls(pc, c)}`,
              decls: [`${cssProp}: ${cssVar(resolved)}`],
            });
          }
        }
      }
    }
  }

  // v10 tokensByProp on the root: per-enum-value overrides land in the SAME
  // enum-modifier rules substituted refs use — mirrors emit-react generateCss.
  // v14: multiple entries in order — a later entry's rules are emitted later,
  // so at equal specificity the later entry wins per channel.
  for (const { prop: tbpProp, map } of tokensByPropEntries(root)) {
    for (const [value, overrides] of Object.entries(map)) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        // S2 capability lift (computed-capture floor): a map ref carrying
        // ONE placeholder (a different declared enum prop — validated in
        // emit-react validateContract) expands as compound enum-class rules,
        // the two-placeholder root-token projection with one axis pinned by
        // the map. Compound rules land with pairRules (after enum rules).
        const phs = placeholdersIn(refPath);
        if (phs.length === 1) {
          for (const phValue of enums.get(phs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
            pairRules.push({
              selector: `${enumCls(tbpProp, value)}${enumCls(phs[0], phValue)}`,
              decls: [`${cssProp}: ${cssVar(resolved)}`],
            });
          }
          continue;
        }
        const key = `${tbpProp} ${value}`;
        const entry = enumRules.get(key) ?? { prop: tbpProp, value, decls: [] };
        entry.decls.push(`${cssProp}: ${cssVar(refPath)}`);
        enumRules.set(key, entry);
      }
    }
  }
  // v14 literals on the root: base decls + per-value enum-modifier rules.
  for (const [cssProp, lit] of Object.entries(root.literals ?? {})) {
    rootDecls.push(`${cssProp}: ${lit}`);
  }
  // v15 declared facts on the root: verbatim base decls (registry-validated
  // in validateContract). A declared `position` supersedes the emitter's own
  // overlay-driven push — mirrors core/emit-react.ts generateCss.
  for (const [cssProp, value] of Object.entries(root.declared ?? {})) {
    if (cssProp === 'position' && rootDecls.includes('position: relative')) {
      if (value === 'relative') continue;
      rootDecls.splice(rootDecls.indexOf('position: relative'), 1);
    }
    rootDecls.push(`${cssProp}: ${value}`);
  }
  for (const { prop: lbpProp, map } of root.literalsByProp ?? []) {
    for (const [value, overrides] of Object.entries(map)) {
      for (const [cssProp, lit] of Object.entries(overrides)) {
        const key = `${lbpProp} ${value}`;
        const entry = enumRules.get(key) ?? { prop: lbpProp, value, decls: [] };
        entry.decls.push(`${cssProp}: ${lit}`);
        enumRules.set(key, entry);
      }
    }
  }

  const rule = (selector: string, decls: string[]) => {
    if (decls.length === 0) return;
    lines.push('', `${selector} {`, ...decls.map((d) => `  ${d};`), '}');
  };

  // a11y.minHitArea: enforced hit-target floor — mirrors emit-react
  // generateCss (centered non-visual ::before at max(100%, floor) per axis).
  const minHitArea = contract.a11y?.minHitArea;
  if (typeof minHitArea === 'number' && !rootDecls.includes('position: relative')) {
    rootDecls.push('position: relative');
  }
  rule(rootCls, rootDecls);
  for (const [sel, d] of rootSubRules) rule(sel, d);
  if (typeof minHitArea === 'number') {
    rule(`${rootCls}::before`, [
      "content: ''",
      'position: absolute',
      'left: 50%',
      'top: 50%',
      `width: max(100%, ${minHitArea}px)`,
      `height: max(100%, ${minHitArea}px)`,
      'transform: translate(-50%, -50%)',
    ]);
  }
  if (contract.states.includes('focus-visible')) {
    rule(`${rootCls}:focus-visible`, ['outline-style: solid', 'outline-offset: 2px']);
  }
  if (contract.states.includes('disabled') && contract.semantics.element === 'button' && !rootDeclaresCursor) {
    rule(`${rootCls}:disabled`, ['cursor: not-allowed']);
  }
  for (const { prop, value, decls } of enumRules.values()) {
    rule(enumCls(prop, value), decls);
  }
  // v7 layoutByProp on the root: the enum class sits on the root element
  // itself (emitted after the enum rules so the override wins at equal
  // specificity) — mirrors core/emit-react.ts generateCss.
  if (root.layoutByProp) {
    for (const [value, override] of Object.entries(root.layoutByProp.map)) {
      rule(enumCls(root.layoutByProp.prop, value), layoutOverrideDecls(override));
    }
  }
  for (const { selector, decls } of pairRules) rule(selector, decls);
  for (const [state, decls] of Object.entries(root.states ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) continue;
    for (const [cssProp, ref] of Object.entries(decls)) {
      // The focus outline pair maps as authored; outline-* are literal here.
      const refPath = stripBraces(ref);
      const phs = placeholdersIn(refPath);
      if (phs.length === 0) {
        rule(`${rootCls}${sel}`, [`${cssProp}: ${cssVar(refPath)}`]);
      } else if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          rule(`${enumCls(phs[0], value)}${sel}`, [`${cssProp}: ${cssVar(resolved)}`]);
        }
      }
    }
  }
  // v15 declaredStates on the root: verbatim state-selector rules, emitted
  // after the token state rules (disjoint channels by the validateContract
  // ambiguity rule) — mirrors core/emit-react.ts generateCss.
  for (const [state, overrides] of Object.entries(root.declaredStates ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) continue; // refused by validateContract
    rule(`${rootCls}${sel}`, Object.entries(overrides).map(([cssProp, v]) => `${cssProp}: ${v}`));
  }
  // stylesWhen on the root (literal CSS behind a boolean data attribute or
  // an enum modifier class).
  const condBase = (propName: string): string | null => {
    const prop = contract.props.find((pr) => pr.name === propName);
    if (!prop) return null;
    if (isEnum(prop)) return null; // handled per-call with equals
    const dataName = propName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    return `${rootCls}[data-${dataName}]`;
  };
  const emitStylesWhen = (part: Part, partSelector: string, isRoot: boolean) => {
    for (const sw of part.stylesWhen ?? []) {
      const prop = contract.props.find((pr) => pr.name === sw.prop);
      if (!prop) continue;
      const base = isEnum(prop) ? enumCls(sw.prop, sw.equals ?? '') : condBase(sw.prop)!;
      const selector = isRoot ? base : `${base} ${partSelector}`;
      rule(selector, Object.entries(sw.styles).map(([kk, v]) => `${kk}: ${v}`));
    }
  };
  emitStylesWhen(root, rootCls, true);

  const usedAnimations = new Set<string>();
  for (const { name, part, path: p } of walkAnatomy(contract)) {
    if (p[0] === 'root' && p.length === 1) continue;
    if (part.component) continue; // instances style themselves via their own contract
    const decls: string[] = layoutDecls(part);
    // UA-margin neutralization on NESTED parts (round 4): a promoted h2/p/ul
    // part would leak UA margins the real component resets — same discipline
    // as the root rule; captured nonzero margins arrive as minted overrides.
    if (part.element && UA_MARGIN_ELEMENTS.has(part.element)) decls.push('margin: 0');
    if (part.overlay) decls.push('position: absolute', ...OVERLAY_CSS[part.overlay.placement]);
    // v9 shape: the shared projection (scripts/contract-schema.ts).
    if (part.shape) decls.push(...shapeCssDecls(part.shape));
    if (part.element === 'button' && (contract.events ?? []).some((e) => e.trigger === name)) {
      decls.push(
        'appearance: none', 'background: none', 'border: none', 'margin: 0', 'padding: 0',
        'font: inherit', 'color: inherit', 'text-align: inherit', 'cursor: pointer',
      );
    }
    // Round 4: a promoted TEXT-entry control (input/textarea/select part
    // that is not the checkable pattern) neutralizes UA chrome — the real
    // component resets it and the capture cannot see agreement-with-UA
    // channels (control-baseline blind spot); carried facts then apply.
    if (!isNativeCheckablePart(part) && (part.element === 'input' || part.element === 'textarea' || part.element === 'select')) {
      decls.push('appearance: none', 'border: none', 'background: transparent',
        'font: inherit', 'color: inherit', 'letter-spacing: inherit', 'margin: 0', 'padding: 0', 'outline: none');
    }
    // Native checkable inputs: the real control covers its presentational
    // box invisibly — mirrors core/emit-react.ts generateCss.
    if (isNativeCheckablePart(part)) {
      decls.push(
        'position: absolute', 'inset: 0', 'width: 100%', 'height: 100%',
        'margin: 0', 'padding: 0', 'opacity: 0', 'cursor: pointer',
      );
    }
    if (part.icon) {
      decls.push('display: inline-flex', 'flex-shrink: 0');
      // the glyph svg renders block — an inline svg's baseline gap would
      // inflate the icon box (round 4: promoted icon hosts carry their own
      // captured display, which may be block; the glyph must not add ~4px).
      rule(`${partCls(name)} svg`, [
        'display: block',
        ...(part.icon.size ? [`width: ${part.icon.size}px`, `height: ${part.icon.size}px`] : []),
      ]);
      if (part.element === 'button') {
        decls.push('align-items: center', 'justify-content: center', 'background: none',
          'border: none', 'padding: 0', 'color: inherit', 'cursor: pointer');
      }
    }
    if (part.animation) {
      decls.push(
        part.animation === 'spin'
          ? `animation: ${k}-spin 0.8s linear infinite`
          : `animation: ${k}-pulse 1.6s ease-in-out infinite`,
      );
      usedAnimations.add(part.animation);
    }
    const subRules: Array<[string, string[]]> = [];
    for (const [cssProp, ref] of Object.entries(part.tokens ?? {})) {
      const refPath = stripBraces(ref);
      if (cssProp === 'gap' && part.layout?.overlap) {
        const overlapPhs = placeholdersIn(refPath);
        if (overlapPhs.length === 1) {
          for (const value of enums.get(overlapPhs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${overlapPhs[0]}}`, value);
            subRules.push([`${enumCls(overlapPhs[0], value)} ${partCls(name)} > * + *`, [`margin-left: ${cssVar(resolved)}`]]);
          }
        } else {
          subRules.push([`${partCls(name)} > * + *`, [`margin-left: ${cssVar(refPath)}`]]);
        }
        continue;
      }
      const phs = placeholdersIn(refPath);
      if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          subRules.push([`${enumCls(phs[0], value)} ${partCls(name)}`, [`${cssProp}: ${cssVar(resolved)}`]]);
        }
        continue;
      }
      decls.push(`${cssProp}: ${cssVar(refPath)}`);
    }
    if (
      (part.tokens && ('border-width' in part.tokens || 'border-color' in part.tokens)) ||
      (part.literals && 'border-width' in part.literals)
    ) {
      decls.push('border-style: solid');
    }
    // v14 literals on a nested part: base decls + per-value descendant rules.
    for (const [cssProp, lit] of Object.entries(part.literals ?? {})) {
      decls.push(`${cssProp}: ${lit}`);
    }
    // v15 declared facts on a nested part: verbatim base decls + per-state
    // descendant rules under the root's state selector.
    for (const [cssProp, value] of Object.entries(part.declared ?? {})) {
      decls.push(`${cssProp}: ${value}`);
    }
    // Round 4: an absolutely-positioned REPLACED part (promoted Thumbnail
    // img) fills its inset box — for replaced elements, auto width under
    // inset-0 resolves to the intrinsic size, so the fill is emitter chrome.
    if (part.element === 'img' && part.declared?.['position'] === 'absolute') {
      decls.push('width: 100%', 'height: 100%');
    }
    for (const [state, overrides] of Object.entries(part.declaredStates ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      subRules.push([
        `${rootCls}${sel} ${partCls(name)}`,
        Object.entries(overrides).map(([cssProp, v]) => `${cssProp}: ${v}`),
      ]);
    }
    for (const entry of part.literalsByProp ?? []) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        subRules.push([
          `${enumCls(entry.prop, value)} ${partCls(name)}`,
          Object.entries(overrides).map(([cssProp, lit]) => `${cssProp}: ${lit}`),
        ]);
      }
    }
    // A box holding a visually-managed native input anchors it and carries
    // the focus ring — mirrors core/emit-react.ts generateCss.
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      if (!isNativeCheckablePart(child)) continue;
      decls.push('position: relative');
      subRules.push([
        `${partCls(name)}:has(> ${partCls(childName)}:focus-visible)`,
        ['outline-style: solid', 'outline-offset: 2px'],
      ]);
    }
    rule(partCls(name), decls);
    for (const [sel, d] of subRules) rule(sel, d);
    // v10 tokensByProp on a nested part: descendant rule under the root's
    // enum modifier class — the nested-token-substitution rule shape.
    // v14: multiple entries in order (later entries win per channel).
    for (const entry of tokensByPropEntries(part)) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        const plain: string[] = [];
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref);
          // S2 capability lift: one-placeholder map refs expand as compound
          // enum-class descendant rules (both classes ride the root).
          const phs = placeholdersIn(refPath);
          if (phs.length === 1) {
            for (const phValue of enums.get(phs[0]) ?? []) {
              const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
              rule(`${enumCls(entry.prop, value)}${enumCls(phs[0], phValue)} ${partCls(name)}`, [
                `${cssProp}: ${cssVar(resolved)}`,
              ]);
            }
            continue;
          }
          plain.push(`${cssProp}: ${cssVar(refPath)}`);
        }
        if (plain.length > 0) rule(`${enumCls(entry.prop, value)} ${partCls(name)}`, plain);
      }
    }
    // v13 part-level states (P18 second half): descendant rules under the
    // root's state selector — mirrors core/emit-react.ts generateCss
    // (.badge:disabled .badge__label { color: … }; native :disabled,
    // hover/active gated :not(:disabled), the STATE_SELECTORS discipline).
    for (const [state, overrides] of Object.entries(part.states ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        const phs = placeholdersIn(refPath);
        if (phs.length === 0) {
          rule(`${rootCls}${sel} ${partCls(name)}`, [`${cssProp}: ${cssVar(refPath)}`]);
        } else if (phs.length === 1) {
          for (const value of enums.get(phs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
            rule(`${enumCls(phs[0], value)}${sel} ${partCls(name)}`, [`${cssProp}: ${cssVar(resolved)}`]);
          }
        }
      }
    }
    // v7 layoutByProp on a nested part: descendant rule under the root's
    // enum modifier class.
    if (part.layoutByProp) {
      for (const [value, override] of Object.entries(part.layoutByProp.map)) {
        rule(`${enumCls(part.layoutByProp.prop, value)} ${partCls(name)}`, layoutOverrideDecls(override));
      }
    }
    emitStylesWhen(part, partCls(name), false);
    if (part.icon && part.element) rule(`${partCls(name)}-glyph`, ['display: inline-flex']);
  }

  if (usedAnimations.has('spin')) {
    lines.push('', `@keyframes ${k}-spin {`, '  to { transform: rotate(360deg); }', '}');
  }
  if (usedAnimations.has('pulse')) {
    lines.push('', `@keyframes ${k}-pulse {`, '  0%, 100% { opacity: 1; }', '  50% { opacity: 0.45; }', '}');
  }
  return lines;
}

// ---------------------------------------------------------------------------
// HTML — a static rendering of one prop combination
// ---------------------------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

interface RenderState {
  subst: Record<string, string>;          // enum prop → showcased value
  bools: Record<string, boolean>;         // boolean prop → showcased value
}

function renderComponentHtml(
  contract: Contract,
  ctx: EmitCtx,
  state: RenderState,
  indent: string,
  extraText?: string,
): string {
  const k = kebab(contract.name);
  const root = contract.anatomy.root;
  const textDefaultOf = (c: Contract): string => {
    const t = textProps(c).find((p) => p.bindings.code.prop === 'children');
    return typeof t?.default === 'string' ? t.default : c.name;
  };
  const propValue = (name: string): string | undefined => state.subst[name];
  const textValue = (propName: string): string => {
    const prop = contract.props.find((p) => p.type === 'text' && p.bindings.code.prop === propName);
    // A component-ref parent may have set this text prop's value (fixed or
    // "{parentProp}"-threaded) — it rides state.subst keyed by prop NAME,
    // exactly like enum substitutions; the contract default is the fallback.
    if (prop && state.subst[prop.name] !== undefined) return state.subst[prop.name];
    return typeof prop?.default === 'string' ? prop.default : contract.name;
  };
  const visible = (part: Part): boolean => {
    if (!part.visibleWhen) return true;
    const vw = part.visibleWhen;
    if (vw.equals !== undefined) return (propValue(vw.prop) ?? '') === vw.equals;
    return state.bools[vw.prop] === true;
  };

  const attrString = (part: Part): string =>
    Object.entries(part.attrs ?? {})
      .map(([attr, value]) => {
        const ref = value.match(/^\{([a-z][\w-]*)\}$/);
        if (!ref) return ` ${attr}="${escapeHtml(value)}"`;
        const prop = contract.props.find((p) => p.name === ref[1]);
        const v = propValue(ref[1]) ?? (prop?.default !== undefined ? String(prop.default) : '');
        return ` ${attr}="${escapeHtml(v)}"`;
      })
      .join('');

  const renderPart = (name: string, part: Part, pad: string, parentEl = 'div'): string => {
    if (!visible(part)) return '';
    const cls = `${k}__${name}`;
    // Content-model honesty: HTML parsers drop anything but <option>/<optgroup>
    // inside a <select>, so a content/text part with NO authored element
    // defaults to "option" there instead of "span" (an authored element is
    // respected — the author owns that call).
    const textEl = part.element ?? (parentEl === 'select' ? 'option' : 'span');
    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const asset = ref ? (propValue(ref[1]) ?? String(contract.props.find((p) => p.name === ref[1])?.default ?? '')) : part.icon.asset;
      const svg = ctx.icons.get(asset) ?? '';
      if (part.element) {
        return `${pad}<${part.element} class="${cls}"${attrString(part)}><span class="${cls}-glyph" aria-hidden="true">${svg}</span></${part.element}>`;
      }
      return `${pad}<span class="${cls}" aria-hidden="true">${svg}</span>`;
    }
    if (part.repeat && part.component) {
      // v12 repeat (P9): the static surface renders the contract's OBSERVED
      // sample — one child instance per drawn sibling (the meter discipline:
      // the honest static state; the React surface maps the live array).
      const dep = ctx.contracts.get(part.component.id)!;
      return part.repeat.sample
        .map((rec) => {
          const depState: RenderState = { subst: {}, bools: {} };
          for (const p of enumProps(dep)) depState.subst[p.name] = String(p.default ?? p.type.enum[0]);
          for (const p of boolProps(dep)) depState.bools[p.name] = p.default === true;
          for (const [pn, v] of Object.entries(part.component!.props ?? {})) {
            if (typeof v === 'boolean') { depState.bools[pn] = v; continue; }
            const parentRef = v.match(/^\{([a-z][\w-]*)\}$/);
            depState.subst[pn] = parentRef ? (propValue(parentRef[1]) ?? v) : v;
          }
          let itemText: string | undefined;
          for (const [field, v] of Object.entries(rec)) {
            const depProp = dep.props.find((p) => p.name === field);
            if (typeof v === 'boolean') { depState.bools[field] = v; continue; }
            if (depProp?.bindings.code.prop === 'children') { itemText = String(v); continue; }
            depState.subst[field] = String(v);
          }
          return renderComponentHtml(dep, ctx, depState, pad, itemText);
        })
        .join('\n');
    }
    if (part.component) {
      const dep = ctx.contracts.get(part.component.id)!;
      const depState: RenderState = { subst: {}, bools: {} };
      for (const p of enumProps(dep)) depState.subst[p.name] = String(p.default ?? p.type.enum[0]);
      for (const p of boolProps(dep)) depState.bools[p.name] = p.default === true;
      for (const [pn, v] of Object.entries(part.component.props ?? {})) {
        if (typeof v === 'boolean') { depState.bools[pn] = v; continue; }
        const parentRef = v.match(/^\{([a-z][\w-]*)\}$/);
        depState.subst[pn] = parentRef ? (propValue(parentRef[1]) ?? v) : v;
      }
      return renderComponentHtml(dep, ctx, depState, pad, part.component.text ?? undefined);
    }
    if (part.slot) {
      const el = part.element ?? 'div';
      const items = part.slot.defaultContent ?? [];
      // Empty slot = ABSENT content: the wrapper renders empty, exactly as
      // the React surface renders `{slotName}` when the consumer passes
      // nothing. Placeholder text would be invented ink inside the component
      // box (field failure: Eventz "[startIcon slot]" placeholders inflated
      // every visual-parity row 55-97%). The absence is named in the emitted
      // header comment, never painted.
      if (items.length === 0) {
        return `${pad}<${el} class="${cls}"${attrString(part)}><!-- ${part.slot.name} slot: no content --></${el}>`;
      }
      const inner = items
        .map((item) => {
          const dep = ctx.contracts.get(item.id)!;
          const depState: RenderState = { subst: {}, bools: {} };
          for (const p of enumProps(dep)) depState.subst[p.name] = String(p.default ?? p.type.enum[0]);
          for (const p of boolProps(dep)) depState.bools[p.name] = p.default === true;
          for (const [pn, v] of Object.entries(item.props ?? {})) {
            if (typeof v === 'boolean') depState.bools[pn] = v;
            else depState.subst[pn] = v;
          }
          return renderComponentHtml(dep, ctx, depState, pad + '  ', item.text);
        })
        .join('\n');
      return `${pad}<${el} class="${cls}"${attrString(part)}>\n${inner}\n${pad}</${el}>`;
    }
    if (part.content) {
      const value = part.content.prop === 'children' && extraText !== undefined ? extraText : textValue(part.content.prop);
      return `${pad}<${textEl} class="${cls}"${attrString(part)}>${escapeHtml(value)}</${textEl}>`;
    }
    if (part.text !== undefined) {
      return `${pad}<${textEl} class="${cls}"${attrString(part)}>${escapeHtml(part.text)}</${textEl}>`;
    }
    if (part.meter) {
      const num = (propName: string, fallback: number) => {
        const pr = contract.props.find((p) => p.name === propName);
        return typeof pr?.default === 'number' ? pr.default : fallback;
      };
      const pct = Math.min(100, Math.max(0, (num(part.meter.valueProp, 0) / (num(part.meter.maxProp, 100) || 100)) * 100));
      return `${pad}<div class="${cls}" style="width: ${pct}%"></div>`;
    }
    // Native checkable input: a REAL void <input> — focusable and keyboard-
    // togglable even in a script-less page. `checked` renders as the HTML
    // attribute when the showcased toggle value is the on value; an
    // out-of-pair value (Checkbox "indeterminate") is a DOM property that
    // static HTML cannot express — named in a comment, never faked as an
    // attribute (the box glyph still shows the visual state).
    if (isNativeCheckablePart(part)) {
      const ev = (contract.events ?? []).find((e) => e.trigger === name && e.toggles);
      let checked = '';
      let note = '';
      if (ev?.toggles) {
        const [off, on] = ev.toggles.between;
        const v = propValue(ev.toggles.prop);
        if (v === on) checked = ' checked';
        else if (v !== undefined && v !== off) {
          note = `\n${pad}<!-- value "${v}" is a DOM property (el.indeterminate = true), not an attribute — static HTML shows it via the glyph only. AT reads this input as unchecked here: a script-less surface cannot set the property (declared fidelity limit); the React surface sets it via callback ref -->`;
        }
      }
      return `${pad}<input class="${cls}"${attrString(part)}${checked}>${note}`;
    }
    const el = part.element ?? 'div';
    const inner = Object.entries(part.parts ?? {})
      .map(([childName, child]) => renderPart(childName, child, pad + '  ', el))
      .filter(Boolean)
      .join('\n');
    return inner
      ? `${pad}<${el} class="${cls}"${attrString(part)}>\n${inner}\n${pad}</${el}>`
      : `${pad}<${el} class="${cls}"${attrString(part)}></${el}>`;
  };

  // Root element + classes
  const elementByProp = contract.semantics.elementByProp;
  const el = elementByProp
    ? (elementByProp.map[propValue(elementByProp.prop) ?? ''] ?? contract.semantics.element)
    : contract.semantics.element;
  // A defaultless enum prop left unset applies NO modifier class — exactly
  // what the React surface renders at runtime (styles[`prop-undefined`] is
  // undefined and cx skips it). Polaris's optional styling axes (Text
  // fontWeight/tone) depend on this: unset means "the other axes' classes
  // decide", never "the first enum value".
  const classes = [
    k,
    ...enumProps(contract)
      .filter((p) => state.subst[p.name] !== undefined)
      .map((p) => `${k}--${p.name}-${state.subst[p.name]}`),
  ];
  const attrs: string[] = [`class="${classes.join(' ')}"`];
  const supportsDisabled = ['button', 'input', 'textarea', 'select', 'fieldset'].includes(el);
  for (const p of boolProps(contract)) {
    if (!state.bools[p.name]) continue;
    if (p.name === 'disabled' && supportsDisabled) { attrs.push('disabled'); continue; }
    const dataName = p.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    attrs.push(`data-${dataName}="true"`);
  }
  const roleByProp = contract.semantics.roleByProp;
  if (roleByProp) {
    const role = roleByProp.map[propValue(roleByProp.prop) ?? ''];
    if (role) attrs.push(`role="${role}"`);
  } else if (contract.semantics.role && contract.semantics.role !== contract.semantics.element) {
    attrs.push(`role="${contract.semantics.role}"`);
  }

  // Bare text directly inside a <select> is DROPPED by HTML parsers — the
  // <option> wrapper is the only faithful rendering of a select's default
  // content. (Authored anatomies should carry explicit element:"option"
  // parts; this covers the part-less text fallback.)
  const rootText = escapeHtml(extraText ?? textDefaultOf(contract));
  const rootInner = root.parts
    ? Object.entries(root.parts)
        .map(([childName, child]) => renderPart(childName, child, indent + '  ', el))
        .filter(Boolean)
        .join('\n')
    : el === 'select'
      ? `${indent}  <option>${rootText}</option>`
      : `${indent}  ${rootText}`;
  return `${indent}<${el} ${attrs.join(' ')}>\n${rootInner}\n${indent}</${el}>`;
}

// ---------------------------------------------------------------------------
// emitHtml
// ---------------------------------------------------------------------------

export interface EmitHtmlResult {
  html: string;
  css: string;
}

export function emitHtml(contract: Contract, ctx: EmitCtx): EmitHtmlResult {
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  if (errors.length > 0) {
    throw new Error(`Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  const k = kebab(contract.name);

  // CSS: this component + every composed dependency (deduped, dependency-first).
  const cssBlocks: string[] = [];
  const seen = new Set<string>();
  const collectCss = (c: Contract) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    for (const w of walkAnatomy(c)) {
      if (w.part.component) collectCss(ctx.contracts.get(w.part.component.id)!);
      for (const item of w.part.slot?.defaultContent ?? []) collectCss(ctx.contracts.get(item.id)!);
    }
    cssBlocks.push(componentCss(c).join('\n'));
  };
  collectCss(contract);

  const defaultsState = (): RenderState => {
    const s: RenderState = { subst: {}, bools: {} };
    // Defaultless enum props stay UNSET (no modifier class, no override) —
    // the React runtime's semantics; showcase items that exercise a value
    // set it explicitly below.
    for (const p of enumProps(contract)) {
      if (p.default !== undefined) s.subst[p.name] = String(p.default);
    }
    for (const p of boolProps(contract)) s.bools[p.name] = p.default === true;
    return s;
  };

  const items: string[] = [];
  const item = (label: string, state: RenderState) => {
    items.push(
      `  <div class="showcase__item">\n    <p class="showcase__label">${escapeHtml(label)}</p>\n${renderComponentHtml(contract, ctx, state, '    ')}\n  </div>`,
    );
  };
  item('default', defaultsState());
  for (const p of enumProps(contract)) {
    for (const v of p.type.enum) {
      if (v === String(p.default ?? '')) continue;
      const s = defaultsState();
      s.subst[p.name] = v;
      item(`${p.name}=${v}`, s);
    }
  }
  for (const p of boolProps(contract)) {
    if (p.default === true) continue;
    const s = defaultsState();
    s.bools[p.name] = true;
    item(`${p.name}=true`, s);
  }

  const header = `<!--
  ${contract.name} — static HTML+CSS emitted from contract ${contract.id} v${contract.version} by core/emit-html.ts.
  Token values arrive via CSS custom properties (the same custom-property names the CSS Modules
  bind) — include the token stylesheet (src/styles/tokens.css) on the page or nothing resolves.
  Fidelity: no events, no interactivity beyond CSS states (:hover/:focus-visible/:disabled).
  Slots render their declared defaultContent; an empty slot renders its wrapper empty (absent content
  is absent — named in an inline comment, never painted as placeholder text). Booleans render per showcase item.
-->`;

  const showcaseCss = [
    `.showcase { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; font-family: sans-serif; }`,
    `.showcase__label { margin: 0 0 8px; font: 12px/1 monospace; opacity: 0.6; }`,
  ].join('\n');

  return {
    html: `${header}\n<section class="showcase showcase--${k}">\n${items.join('\n')}\n</section>\n`,
    css: `${cssBlocks.join('\n\n')}\n\n/* showcase chrome */\n${showcaseCss}\n`,
  };
}
