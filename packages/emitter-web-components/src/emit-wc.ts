/**
 * Contract → vanilla Custom Element — a pure emitter over the SAME contract
 * semantics the React/HTML generators render, for surfaces that want real
 * componentization with zero framework and zero runtime dependencies.
 *
 * What it emits, per contract (file base = the element tag, `ds.badge` →
 * `ds-badge`, so multi-contract emits into one package never collide):
 *   · <tag>.ts      — a class extending HTMLElement. observedAttributes come
 *     from the contract's props (enum/boolean/number/named-text; the
 *     `children` text prop rides the default <slot>, arrayOf props are a
 *     JS property — attributes cannot carry lists, a declared fidelity
 *     limit named in the file header). Enum/boolean/number/text props
 *     reflect property ⇄ attribute; defaults apply in the getters exactly
 *     like React's defaulted props. The module registers the element on
 *     import (guarded) and also exports `define()`.
 *   · <tag>.css.ts  — the contract's anatomy compiled to a constructable
 *     stylesheet. SAME css generation semantics as core/emit-html.ts's
 *     class rules, translated to shadow-scoped selectors: the internal
 *     root carries part="root" plus data-* modifier attributes mirrored
 *     from the host's prop attributes; every emit-html class selector maps
 *     to a [part=…]/:where() selector with the SAME specificity (the
 *     :where() wrapper zeroes the modifier condition; [part='root']
 *     repetition restores emit-html's class-count) so the cascade resolves
 *     rule-for-rule identically — receipted by the wc-emitter-css-parity
 *     eval (real Chromium, computed styles vs the html emitter).
 *   · <tag>.demo.html — the story-equivalent: the emit-html showcase grid
 *     (default + one item per enum value + one per boolean) using the
 *     element itself.
 *   · <tag>.custom-elements.json — a Custom Elements Manifest generated
 *     FROM the contract (deterministic, no analyzer): attributes with type
 *     text + defaults, events, slots, cssParts. The wc-emitter-roundtrip
 *     receipt feeds this back through the repo's own CEM extraction
 *     adapter and diffs the round-tripped proposal against the source
 *     contract.
 *
 * Vocabulary coverage (the emitters-check discipline — every branch EMITS
 * or refuses by name; validateContract gates emission exactly like
 * emit-react/emit-html, so every schema-level refusal is shared):
 *   EMITTED: props (boolean/text/number/enum), tokens (plain + 1- and
 *   2-placeholder substituted refs, overlap gap), tokensByProp (plain +
 *   S2 one-placeholder map refs, ordered v14 entries), literals,
 *   literalsByProp, declared, declaredStates, states (root full
 *   vocabulary + v13 part color channels), layout, layoutByProp,
 *   stylesWhen, overlay, shape, visibleWhen, slots (REAL <slot> elements
 *   with defaultContent as fallback), component refs (the child contract's
 *   own custom element — composition is native), repeat (live via the
 *   `items` property; the observed sample is the attribute-only default,
 *   the static-surface discipline), icon, attrs, content, text, meter
 *   (live from number props), animation, semantics element/role/
 *   roleByProp/elementByProp, events + toggles (CustomEvent dispatch,
 *   uncontrolled flip, ARIA state / native checked+indeterminate),
 *   a11y.minHitArea + focusVisible (delegatesFocus + the focus chrome).
 *   NAMED NO-OPS (canvas-only concepts — listed in each emitted header
 *   when present): figmaStatePreviews, modes, bindings.figma,
 *   anchors.figma, slot.figmaProperty, figmaRepresentation.
 *   a11y.contrast is a review gate, not a rendering fact (no emitter
 *   renders it) — named here, not silently dropped.
 */
import {
  isNativeCheckablePart,
  shapeCssDecls,
  slotsOf,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
  type Part,
  type Prop,
} from '../../schema/src/contract-schema.js';
import {
  boolProps,
  enumProps,
  isArrayType,
  isEnum,
  numberProps,
  rootElementsOf,
  textProps,
  UA_MARGIN_ELEMENTS,
  validateContract,
} from '../../../core/emit-react.js';
import { kebab } from '../../../extract/types.js';

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/** "ds.badge" → "ds-badge" — the contract id IS the tag (ids are
 *  `[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*`, so the dash-joined form is always a
 *  valid custom-element name, namespace collisions impossible). */
export const tagOf = (contract: Contract): string => contract.id.replace('.', '-');

/** "Badge" → "BadgeElement" (class + default export name). */
export const classNameOf = (contract: Contract): string =>
  `${contract.name.replace(/[^A-Za-z0-9]/g, '')}Element`;

/** Canonical prop name → DOM attribute ("toneAndProgress" → "tone-and-progress"). */
export const attrOf = (name: string): string => kebab(name);

/** DOM attribute → canonical prop name (the receipt's inverse mapping). */
export const propFromAttr = (attr: string): string =>
  attr.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const SUPPORTS_DISABLED = ['button', 'input', 'textarea', 'select', 'fieldset'];

export interface WcEmitCtx {
  /** Icon asset name → SVG markup. */
  icons: Map<string, string>;
  /** Every known contract by id — composition refs resolve through it. */
  contracts: Map<string, Contract>;
}

export interface EmitWcResult {
  /** <tag>.ts — the element class module (registers on import). */
  element: string;
  /** <tag>.css.ts — the constructable-stylesheet module. */
  stylesheet: string;
  /** <tag>.demo.html — the showcase grid. */
  demo: string;
  /** <tag>.custom-elements.json — the deterministic manifest. */
  manifest: string;
}

// ---------------------------------------------------------------------------
// CSS — emit-html's componentCss, selector-translated to the shadow scope.
//
// Mapping (specificity-preserving — see the file header):
//   .k                → [part='root']
//   .k--prop-value    → [part='root']:where([data-prop='value'])
//   .k--a-x.k--b-y    → [part='root'][part='root']:where([data-a='x'][data-b='y'])
//   .k[data-x]        → [part='root'][part='root']:where([data-x])
//   .k__part          → [part='part']
//   .k--a-x .k__part  → [part='root']:where([data-a='x']) [part='part']
//   pseudo-classes/elements ride through verbatim.
// ---------------------------------------------------------------------------

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

const ROOT_SEL = "[part='root']";
const partSel = (name: string) => `[part='${name}']`;
const enumCond = (prop: string, value: string) => `[data-${attrOf(prop)}='${value}']`;
const boolCond = (prop: string) => `[data-${attrOf(prop)}]`;
/** emit-html's `.k--prop-value` (one class) at the same 0,1,0 specificity. */
const rootWithEnum = (prop: string, value: string) => `${ROOT_SEL}:where(${enumCond(prop, value)})`;
/** emit-html's `.k--a-x.k--b-y` (two classes) at the same 0,2,0 specificity. */
const rootWithPair = (a: [string, string], b: [string, string]) =>
  `${ROOT_SEL}${ROOT_SEL}:where(${enumCond(a[0], a[1])}${enumCond(b[0], b[1])})`;
/** emit-html's `.k[data-x]` (class + attribute, 0,2,0). */
const rootWithBool = (prop: string) => `${ROOT_SEL}${ROOT_SEL}:where(${boolCond(prop)})`;

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

export function shadowCss(contract: Contract): string {
  const k = kebab(contract.name);
  const enums = new Map(enumProps(contract).map((p) => [p.name, p.type.enum]));
  const lines: string[] = [
    `/* ${contract.name} — shadow stylesheet from ${contract.id} v${contract.version} (@ds-contracts/emitter-web-components) */`,
    '',
    // The host box vanishes — the internal [part='root'] element IS the
    // component box, exactly the element emit-html renders.
    ':host {',
    '  display: contents;',
    '}',
    '',
    // Border-box everywhere in the shadow scope (emit-html scopes the same
    // rule under the component class; the shadow boundary scopes it here).
    '*, *::before, *::after {',
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
  if (rootElementsOf(contract).some((el) => UA_MARGIN_ELEMENTS.has(el))) {
    rootDecls.push('margin: 0');
  }
  if ('border-width' in rootTokens || 'border-color' in rootTokens) rootDecls.push('border-style: solid');
  else rootDecls.push('border: 0');
  if ('max-width' in rootTokens) rootDecls.push('width: 100%', 'min-width: fit-content');
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
  const pairRules: Array<{ selector: string; decls: string[] }> = [];
  const rootSubRules: Array<[string, string[]]> = [];
  for (const [cssProp, ref] of Object.entries(rootTokens)) {
    const refPath = stripBraces(ref);
    if (cssProp === 'gap' && root.layout?.overlap) {
      const overlapPhs = placeholdersIn(refPath);
      if (overlapPhs.length === 1) {
        for (const value of enums.get(overlapPhs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${overlapPhs[0]}}`, value);
          rootSubRules.push([`${rootWithEnum(overlapPhs[0], value)} > * + *`, [`margin-left: ${cssVar(resolved)}`]]);
        }
      } else {
        rootSubRules.push([`${ROOT_SEL} > * + *`, [`margin-left: ${cssVar(refPath)}`]]);
      }
      continue;
    }
    const phs = placeholdersIn(refPath);
    if (phs.length === 0) {
      rootDecls.push(`${cssProp}: ${cssVar(refPath)}`);
    } else if (phs.length === 1) {
      for (const value of enums.get(phs[0]) ?? []) {
        const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
        const key = `${phs[0]} ${value}`;
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
            selector: rootWithPair([pa, a], [pb, b]),
            decls: [`${cssProp}: ${cssVar(resolved)}`],
          });
        }
      }
    }
  }

  // v10/v14 tokensByProp on the root (S2 one-placeholder lift included).
  for (const { prop: tbpProp, map } of tokensByPropEntries(root)) {
    for (const [value, overrides] of Object.entries(map)) {
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        const phs = placeholdersIn(refPath);
        if (phs.length === 1) {
          for (const phValue of enums.get(phs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
            pairRules.push({
              selector: rootWithPair([tbpProp, value], [phs[0], phValue]),
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
  // v14 literals on the root.
  for (const [cssProp, lit] of Object.entries(root.literals ?? {})) {
    rootDecls.push(`${cssProp}: ${lit}`);
  }
  // v15 declared facts on the root (verbatim; declared position supersedes
  // the emitter's own overlay-driven push — mirrors emit-html).
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

  const minHitArea = contract.a11y?.minHitArea;
  if (typeof minHitArea === 'number' && !rootDecls.includes('position: relative')) {
    rootDecls.push('position: relative');
  }
  rule(ROOT_SEL, rootDecls);
  for (const [sel, d] of rootSubRules) rule(sel, d);
  if (typeof minHitArea === 'number') {
    rule(`${ROOT_SEL}::before`, [
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
    rule(`${ROOT_SEL}:focus-visible`, ['outline-style: solid', 'outline-offset: 2px']);
  }
  if (contract.states.includes('disabled') && contract.semantics.element === 'button' && !rootDeclaresCursor) {
    rule(`${ROOT_SEL}:disabled`, ['cursor: not-allowed']);
  }
  for (const { prop, value, decls } of enumRules.values()) {
    rule(rootWithEnum(prop, value), decls);
  }
  // v7 layoutByProp on the root (after the enum rules — the override wins at
  // equal specificity, source order, exactly like emit-html).
  if (root.layoutByProp) {
    for (const [value, override] of Object.entries(root.layoutByProp.map)) {
      rule(rootWithEnum(root.layoutByProp.prop, value), layoutOverrideDecls(override));
    }
  }
  for (const { selector, decls } of pairRules) rule(selector, decls);
  for (const [state, decls] of Object.entries(root.states ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) continue;
    for (const [cssProp, ref] of Object.entries(decls)) {
      const refPath = stripBraces(ref);
      const phs = placeholdersIn(refPath);
      if (phs.length === 0) {
        rule(`${ROOT_SEL}${sel}`, [`${cssProp}: ${cssVar(refPath)}`]);
      } else if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          rule(`${rootWithEnum(phs[0], value)}${sel}`, [`${cssProp}: ${cssVar(resolved)}`]);
        }
      }
    }
  }
  // v15 declaredStates on the root.
  for (const [state, overrides] of Object.entries(root.declaredStates ?? {})) {
    const sel = STATE_SELECTORS[state];
    if (!sel) continue; // refused by validateContract
    rule(`${ROOT_SEL}${sel}`, Object.entries(overrides).map(([cssProp, v]) => `${cssProp}: ${v}`));
  }
  // stylesWhen on the root / nested parts (boolean condition rides the
  // mirrored data attribute on the internal root; enum condition the enum
  // modifier — emit-html's condBase, shadow-translated).
  const emitStylesWhen = (part: Part, partSelector: string, isRoot: boolean) => {
    for (const sw of part.stylesWhen ?? []) {
      const prop = contract.props.find((pr) => pr.name === sw.prop);
      if (!prop) continue;
      const base = isEnum(prop) ? rootWithEnum(sw.prop, sw.equals ?? '') : rootWithBool(sw.prop);
      const selector = isRoot ? base : `${base} ${partSelector}`;
      rule(selector, Object.entries(sw.styles).map(([kk, v]) => `${kk}: ${v}`));
    }
  };
  emitStylesWhen(root, ROOT_SEL, true);

  const usedAnimations = new Set<string>();
  for (const { name, part, path: p } of walkAnatomy(contract)) {
    if (p[0] === 'root' && p.length === 1) continue;
    if (part.component) continue; // instances style themselves in their own shadow root
    const decls: string[] = layoutDecls(part);
    if (part.element && UA_MARGIN_ELEMENTS.has(part.element)) decls.push('margin: 0');
    if (part.overlay) decls.push('position: absolute', ...OVERLAY_CSS[part.overlay.placement]);
    if (part.shape) decls.push(...shapeCssDecls(part.shape));
    if (part.element === 'button' && (contract.events ?? []).some((e) => e.trigger === name)) {
      decls.push(
        'appearance: none', 'background: none', 'border: none', 'margin: 0', 'padding: 0',
        'font: inherit', 'color: inherit', 'text-align: inherit', 'cursor: pointer',
      );
    }
    if (!isNativeCheckablePart(part) && (part.element === 'input' || part.element === 'textarea' || part.element === 'select')) {
      decls.push('appearance: none', 'border: none', 'background: transparent',
        'font: inherit', 'color: inherit', 'letter-spacing: inherit', 'margin: 0', 'padding: 0', 'outline: none');
    }
    if (isNativeCheckablePart(part)) {
      decls.push(
        'position: absolute', 'inset: 0', 'width: 100%', 'height: 100%',
        'margin: 0', 'padding: 0', 'opacity: 0', 'cursor: pointer',
      );
    }
    if (part.icon) {
      decls.push('display: inline-flex', 'flex-shrink: 0');
      rule(`${partSel(name)} svg`, [
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
            subRules.push([`${rootWithEnum(overlapPhs[0], value)} ${partSel(name)} > * + *`, [`margin-left: ${cssVar(resolved)}`]]);
          }
        } else {
          subRules.push([`${partSel(name)} > * + *`, [`margin-left: ${cssVar(refPath)}`]]);
        }
        continue;
      }
      const phs = placeholdersIn(refPath);
      if (phs.length === 1) {
        for (const value of enums.get(phs[0]) ?? []) {
          const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
          subRules.push([`${rootWithEnum(phs[0], value)} ${partSel(name)}`, [`${cssProp}: ${cssVar(resolved)}`]]);
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
    for (const [cssProp, lit] of Object.entries(part.literals ?? {})) {
      decls.push(`${cssProp}: ${lit}`);
    }
    for (const [cssProp, value] of Object.entries(part.declared ?? {})) {
      decls.push(`${cssProp}: ${value}`);
    }
    if (part.element === 'img' && part.declared?.['position'] === 'absolute') {
      decls.push('width: 100%', 'height: 100%');
    }
    for (const [state, overrides] of Object.entries(part.declaredStates ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      subRules.push([
        `${ROOT_SEL}${sel} ${partSel(name)}`,
        Object.entries(overrides).map(([cssProp, v]) => `${cssProp}: ${v}`),
      ]);
    }
    for (const entry of part.literalsByProp ?? []) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        subRules.push([
          `${rootWithEnum(entry.prop, value)} ${partSel(name)}`,
          Object.entries(overrides).map(([cssProp, lit]) => `${cssProp}: ${lit}`),
        ]);
      }
    }
    for (const [childName, child] of Object.entries(part.parts ?? {})) {
      if (!isNativeCheckablePart(child)) continue;
      decls.push('position: relative');
      subRules.push([
        `${partSel(name)}:has(> ${partSel(childName)}:focus-visible)`,
        ['outline-style: solid', 'outline-offset: 2px'],
      ]);
    }
    rule(partSel(name), decls);
    for (const [sel, d] of subRules) rule(sel, d);
    for (const entry of tokensByPropEntries(part)) {
      for (const [value, overrides] of Object.entries(entry.map)) {
        const plain: string[] = [];
        for (const [cssProp, ref] of Object.entries(overrides)) {
          const refPath = stripBraces(ref);
          const phs = placeholdersIn(refPath);
          if (phs.length === 1) {
            for (const phValue of enums.get(phs[0]) ?? []) {
              const resolved = refPath.replaceAll(`{${phs[0]}}`, phValue);
              rule(`${rootWithPair([entry.prop, value], [phs[0], phValue])} ${partSel(name)}`, [
                `${cssProp}: ${cssVar(resolved)}`,
              ]);
            }
            continue;
          }
          plain.push(`${cssProp}: ${cssVar(refPath)}`);
        }
        if (plain.length > 0) rule(`${rootWithEnum(entry.prop, value)} ${partSel(name)}`, plain);
      }
    }
    // v13 part-level states — descendant rules under the root's state selector.
    for (const [state, overrides] of Object.entries(part.states ?? {})) {
      const sel = STATE_SELECTORS[state];
      if (!sel) continue; // refused by validateContract
      for (const [cssProp, ref] of Object.entries(overrides)) {
        const refPath = stripBraces(ref);
        const phs = placeholdersIn(refPath);
        if (phs.length === 0) {
          rule(`${ROOT_SEL}${sel} ${partSel(name)}`, [`${cssProp}: ${cssVar(refPath)}`]);
        } else if (phs.length === 1) {
          for (const value of enums.get(phs[0]) ?? []) {
            const resolved = refPath.replaceAll(`{${phs[0]}}`, value);
            rule(`${rootWithEnum(phs[0], value)}${sel} ${partSel(name)}`, [`${cssProp}: ${cssVar(resolved)}`]);
          }
        }
      }
    }
    if (part.layoutByProp) {
      for (const [value, override] of Object.entries(part.layoutByProp.map)) {
        rule(`${rootWithEnum(part.layoutByProp.prop, value)} ${partSel(name)}`, layoutOverrideDecls(override));
      }
    }
    emitStylesWhen(part, partSel(name), false);
    if (part.icon && part.element) rule(partSel(`${name}-glyph`), ['display: inline-flex']);
  }

  if (usedAnimations.has('spin')) {
    lines.push('', `@keyframes ${k}-spin {`, '  to { transform: rotate(360deg); }', '}');
  }
  if (usedAnimations.has('pulse')) {
    lines.push('', `@keyframes ${k}-pulse {`, '  0%, 100% { opacity: 1; }', '  50% { opacity: 0.45; }', '}');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Element class — generated TypeScript (mirrors emit-html's
// renderComponentHtml, but LIVE: attributes re-render, slots project light
// DOM, composition renders the child contract's own custom element).
// ---------------------------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Escape a literal string for embedding inside a GENERATED template literal. */
const tpl = (s: string) => s.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');

const isIdent = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s);
/** Prop access expression inside #view (`p.variant` / `p['weird-name']`). */
const acc = (name: string) => (isIdent(name) ? `p.${name}` : `p[${JSON.stringify(name)}]`);

const enumUnion = (values: string[]) => values.map((v) => JSON.stringify(v).replace(/"/g, "'")).join(' | ');

function textDefaultOf(contract: Contract): string {
  const t = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  return typeof t?.default === 'string' ? t.default : contract.name;
}

/** Props that manifest as DOM attributes (everything except the `children`
 *  text prop, which rides the default <slot>, and arrayOf props, which are
 *  JS properties — attributes cannot carry lists; both named in the header). */
function attributeProps(contract: Contract): Prop[] {
  return contract.props.filter(
    (p) => !isArrayType(p) && !(p.type === 'text' && p.bindings.code.prop === 'children'),
  );
}

function generateElement(contract: Contract, ctx: WcEmitCtx): string {
  const tag = tagOf(contract);
  const className = classNameOf(contract);
  const events = contract.events ?? [];
  const walked = walkAnatomy(contract);
  const rootPart = contract.anatomy.root;

  // ---- deps: composed contracts rendered in the shadow tree -------------
  const depIds = new Set<string>();
  for (const w of walked) {
    if (w.part.component) depIds.add(w.part.component.id);
    for (const item of w.part.slot?.defaultContent ?? []) depIds.add(item.id);
  }
  depIds.delete(contract.id);
  const depImports = [...depIds]
    .sort()
    .map((id) => `import './${tagOf(ctx.contracts.get(id)!)}.js';`);

  // ---- icons actually rendered ------------------------------------------
  const neededIcons = new Map<string, string>();
  for (const w of walked) {
    if (!w.part.icon) continue;
    const ref = w.part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
    if (ref) {
      const prop = contract.props.find((p) => p.name === ref[1]);
      if (prop && isEnum(prop)) {
        for (const v of prop.type.enum) neededIcons.set(v, ctx.icons.get(v) ?? '');
      }
    } else {
      neededIcons.set(w.part.icon.asset, ctx.icons.get(w.part.icon.asset) ?? '');
    }
  }

  // ---- named no-ops (canvas-only concepts present on THIS contract) ------
  const noOps: string[] = [];
  if (contract.figmaStatePreviews) noOps.push('figmaStatePreviews (canvas State-preview axis — CSS pseudo-classes render these states live here)');
  if (contract.modes) noOps.push(`modes [${contract.modes.join(', ')}] (theming lives in the token collection's modes, never the component API)`);
  if (contract.figmaRepresentation) noOps.push(`figmaRepresentation "${contract.figmaRepresentation}" (canvas manifestation only)`);
  if (contract.a11y?.contrast) noOps.push(`a11y.contrast ${contract.a11y.contrast} (a review gate, not a rendering fact — no emitter renders it)`);
  noOps.push('bindings.figma / anchors.figma / slot.figmaProperty (design-side identity, no DOM manifestation)');

  const enums = enumProps(contract);
  const bools = boolProps(contract);
  const numbers = numberProps(contract);
  const namedTexts = textProps(contract).filter((p) => p.bindings.code.prop !== 'children');
  const arrays = contract.props.filter(isArrayType);
  const attrProps = attributeProps(contract);
  const observed = attrProps.map((p) => attrOf(p.name));

  const interactive =
    events.length > 0 ||
    ['button', 'a', 'input', 'textarea', 'select'].includes(contract.semantics.element) ||
    contract.states.includes('focus-visible') ||
    walked.some((w) => isNativeCheckablePart(w.part));
  const formAssociated =
    rootElementsOf(contract).some((el) => ['input', 'textarea', 'select'].includes(el)) ||
    walked.some((w) => isNativeCheckablePart(w.part));

  // ---- accessors ---------------------------------------------------------
  const accessors: string[] = [];
  const accessorName = (name: string) => (isIdent(name) ? name : `[${JSON.stringify(name)}]`);
  for (const p of enums) {
    const a = attrOf(p.name);
    const union = enumUnion(p.type.enum);
    const hasDefault = p.default !== undefined;
    const retType = hasDefault ? union : `${union} | null`;
    accessors.push(
      `  /** ${p.description ?? `Enum prop "${p.name}".`} */`,
      `  get ${accessorName(p.name)}(): ${retType} {`,
      hasDefault
        ? `    return (this.getAttribute('${a}') as ${union} | null) ?? ${JSON.stringify(p.default).replace(/"/g, "'")};`
        : `    return this.getAttribute('${a}') as ${union} | null;`,
      `  }`,
      `  set ${accessorName(p.name)}(v: ${union} | null) {`,
      `    if (v == null) this.removeAttribute('${a}');`,
      `    else this.setAttribute('${a}', v);`,
      `  }`,
    );
  }
  for (const p of bools) {
    const a = attrOf(p.name);
    accessors.push(
      `  /** ${p.description ?? `Boolean prop "${p.name}".`} */`,
      `  get ${accessorName(p.name)}(): boolean {`,
      `    return this.hasAttribute('${a}');`,
      `  }`,
      `  set ${accessorName(p.name)}(v: boolean) {`,
      `    this.toggleAttribute('${a}', v);`,
      `  }`,
    );
  }
  for (const p of numbers) {
    const a = attrOf(p.name);
    const fallback = typeof p.default === 'number' ? String(p.default) : 'null';
    accessors.push(
      `  /** ${p.description ?? `Number prop "${p.name}".`} */`,
      `  get ${accessorName(p.name)}(): number | null {`,
      `    const v = this.getAttribute('${a}');`,
      `    if (v === null || v === '') return ${fallback};`,
      `    const n = Number(v);`,
      `    return Number.isNaN(n) ? ${fallback} : n;`,
      `  }`,
      `  set ${accessorName(p.name)}(v: number | null) {`,
      `    if (v == null) this.removeAttribute('${a}');`,
      `    else this.setAttribute('${a}', String(v));`,
      `  }`,
    );
  }
  for (const p of namedTexts) {
    const a = attrOf(p.name);
    const fallback = typeof p.default === 'string' ? JSON.stringify(p.default) : 'null';
    accessors.push(
      `  /** ${p.description ?? `Text prop "${p.name}".`} */`,
      `  get ${accessorName(p.name)}(): string | null {`,
      `    return this.getAttribute('${a}') ?? ${fallback};`,
      `  }`,
      `  set ${accessorName(p.name)}(v: string | null) {`,
      `    if (v == null) this.removeAttribute('${a}');`,
      `    else this.setAttribute('${a}', v);`,
      `  }`,
    );
  }
  for (const p of arrays) {
    const fields = p.type.arrayOf;
    const recType = `{ ${Object.entries(fields)
      .map(([f, t]) => `${isIdent(f) ? f : JSON.stringify(f)}?: ${t === 'text' ? 'string' : t}`)
      .join('; ')} }`;
    const priv = `#${isIdent(p.name) ? p.name : 'arrayProp_' + attrOf(p.name).replace(/-/g, '_')}`;
    accessors.push(
      `  /** ${p.description ?? `Array prop "${p.name}".`} JS property only — attributes cannot carry lists (declared fidelity limit; unset renders the contract's observed sample). */`,
      `  ${priv}?: Array<${recType}>;`,
      `  get ${accessorName(p.name)}(): Array<${recType}> | undefined {`,
      `    return this.${priv};`,
      `  }`,
      `  set ${accessorName(p.name)}(v: Array<${recType}> | undefined) {`,
      `    this.${priv} = v;`,
      `    this.#render();`,
      `  }`,
    );
  }

  // ---- toggles: ARIA expressions per trigger part ------------------------
  // A toggle on a NATIVE checkable trigger rides checked/indeterminate (DOM
  // truth, no ARIA re-creation); any other trigger carries aria-<state>.
  const ariaByTrigger = new Map<string, string>();
  for (const ev of events) {
    if (!ev.toggles?.aria) continue;
    const trigger = walked.find((w) => w.name === ev.trigger)?.part;
    if (trigger && isNativeCheckablePart(trigger)) continue;
    const [off, on] = ev.toggles.between;
    const e = acc(ev.toggles.prop);
    ariaByTrigger.set(
      ev.trigger,
      `\${${e} === ${JSON.stringify(on)} ? 'true' : ${e} === ${JSON.stringify(off)} || ${e} == null ? 'false' : 'mixed'}`,
    );
  }

  // ---- markup codegen ----------------------------------------------------
  const extraConsts: string[] = [];

  const attrFragment = (part: Part): string =>
    Object.entries(part.attrs ?? {})
      .map(([attr, value]) => {
        const ref = value.match(/^\{([a-z][\w-]*)\}$/);
        if (!ref) return ` ${attr}="${tpl(escapeHtml(value))}"`;
        return ` ${attr}="\${__esc(String(${acc(ref[1])} ?? ''))}"`;
      })
      .join('');

  const visibleWrap = (part: Part, inner: string): string => {
    if (!part.visibleWhen) return inner;
    const vw = part.visibleWhen;
    const cond =
      vw.equals !== undefined
        ? `(${acc(vw.prop)} ?? '') === ${JSON.stringify(vw.equals)}`
        : `${acc(vw.prop)} === true`;
    return `\${${cond} ? \`${inner}\` : ''}`;
  };

  /** Attribute fragment for a fixed/threaded prop set on a composed child. */
  const childAttrFragment = (dep: Contract, fixedProps: Record<string, string | boolean>): string => {
    let out = '';
    for (const [propName, value] of Object.entries(fixedProps)) {
      const depProp = dep.props.find((pr) => pr.name === propName);
      const a = attrOf(depProp?.name ?? propName);
      if (typeof value === 'boolean') {
        if (value) out += ` ${a}=""`;
        continue;
      }
      const parentRef = value.match(/^\{([a-z][\w-]*)\}$/);
      if (parentRef && contract.props.some((pr) => pr.name === parentRef[1])) {
        // Parent→child threading: the child sees the parent's LIVE value; an
        // unset defaultless parent prop applies no attribute (child default).
        const e = acc(parentRef[1]);
        out += `\${${e} == null ? '' : \` ${a}="\${__esc(String(${e}))}"\`}`;
      } else {
        out += ` ${a}="${tpl(escapeHtml(value))}"`;
      }
    }
    return out;
  };

  const genPart = (name: string, part: Part, parentEl: string): string => {
    const partAttr = ` part="${name}"`;
    const textEl = part.element ?? (parentEl === 'select' ? 'option' : 'span');

    if (part.icon) {
      const ref = part.icon.asset.match(/^\{([a-z][\w-]*)\}$/);
      const svgExpr = ref
        ? `\${ICONS[String(${acc(ref[1])} ?? '')] ?? ''}`
        : `\${ICONS[${JSON.stringify(part.icon.asset)}] ?? ''}`;
      const inner = part.element
        ? `<${part.element}${partAttr}${attrFragment(part)}><span part="${name}-glyph" aria-hidden="true">${svgExpr}</span></${part.element}>`
        : `<span${partAttr} aria-hidden="true">${svgExpr}</span>`;
      return visibleWrap(part, inner);
    }

    if (part.repeat && part.component) {
      // v12 repeat (P9): LIVE over the `items` property; the observed sample
      // is the property-less default (the static-surface discipline — the
      // demo page and the canvas render the same drawn siblings).
      const dep = ctx.contracts.get(part.component.id)!;
      const depTag = tagOf(dep);
      const fixed = childAttrFragment(dep, part.component.props ?? {});
      let fieldAttrs = '';
      let childText = '';
      for (const [field, fieldType] of Object.entries(
        (contract.props.find((pr) => pr.name === part.repeat!.itemsProp) as Prop & {
          type: { arrayOf: Record<string, string> };
        })?.type.arrayOf ?? {},
      )) {
        const depProp = dep.props.find((pr) => pr.name === field);
        const f = `__rec[${JSON.stringify(field)}]`;
        if (depProp?.bindings.code.prop === 'children') {
          childText = `\${${f} == null ? '' : __esc(String(${f}))}`;
          continue;
        }
        const a = attrOf(field);
        if (fieldType === 'boolean') fieldAttrs += `\${${f} ? \` ${a}=""\` : ''}`;
        else fieldAttrs += `\${${f} == null ? '' : \` ${a}="\${__esc(String(${f}))}"\`}`;
      }
      const sample = JSON.stringify(part.repeat.sample);
      const inner =
        `\${((${acc(part.repeat.itemsProp)} ?? ${sample}) as Array<Record<string, unknown>>)` +
        `.map((__rec) => \`<${depTag}${fixed}${fieldAttrs}>${childText}</${depTag}>\`).join('')}`;
      return visibleWrap(part, inner);
    }

    if (part.component) {
      const dep = ctx.contracts.get(part.component.id)!;
      const depTag = tagOf(dep);
      const text = part.component.text !== undefined ? tpl(escapeHtml(part.component.text)) : '';
      const inner = `<${depTag}${partAttr}${childAttrFragment(dep, part.component.props ?? {})}>${text}</${depTag}>`;
      return visibleWrap(part, inner);
    }

    if (part.slot) {
      const el = part.element ?? 'div';
      const slotName = part.slot.name === 'children' ? '' : ` name="${part.slot.name}"`;
      // defaultContent renders as the slot's FALLBACK — light DOM replaces
      // it, absence renders it, an empty defaultContent renders nothing
      // (absent content is absent; no invented placeholder ink).
      const fallback = (part.slot.defaultContent ?? [])
        .map((item) => {
          const dep = ctx.contracts.get(item.id)!;
          const text = item.text !== undefined ? tpl(escapeHtml(item.text)) : '';
          return `<${tagOf(dep)}${childAttrFragment(dep, item.props ?? {})}>${text}</${tagOf(dep)}>`;
        })
        .join('');
      const inner = `<${el}${partAttr}${attrFragment(part)}><slot${slotName}>${fallback}</slot></${el}>`;
      return visibleWrap(part, inner);
    }

    if (part.content) {
      const prop = contract.props.find(
        (pr) => pr.type === 'text' && pr.bindings.code.prop === part.content!.prop,
      );
      if (part.content.prop === 'children') {
        // The children text prop IS the default slot; the contract default is
        // the slot fallback (light DOM replaces it — React's children exactly).
        const fallback = tpl(escapeHtml(textDefaultOf(contract)));
        const inner = `<${textEl}${partAttr}${attrFragment(part)}><slot>${fallback}</slot></${textEl}>`;
        return visibleWrap(part, inner);
      }
      const fallback = typeof prop?.default === 'string' ? prop.default : contract.name;
      const valueExpr = prop
        ? `\${__esc(String(${acc(prop.name)} ?? ${JSON.stringify(fallback)}))}`
        : tpl(escapeHtml(fallback));
      const inner = `<${textEl}${partAttr}${attrFragment(part)}>${valueExpr}</${textEl}>`;
      return visibleWrap(part, inner);
    }

    if (part.text !== undefined) {
      return visibleWrap(part, `<${textEl}${partAttr}${attrFragment(part)}>${tpl(escapeHtml(part.text))}</${textEl}>`);
    }

    if (part.meter) {
      const id = `__meter_${name.replace(/[^\w]/g, '_')}`;
      extraConsts.push(
        `    const ${id} = Math.min(100, Math.max(0, ((${acc(part.meter.valueProp)} ?? 0) / ((${acc(part.meter.maxProp)} ?? 100) || 100)) * 100));`,
      );
      return visibleWrap(part, `<div${partAttr} style="width: \${${id}}%"></div>`);
    }

    if (isNativeCheckablePart(part)) {
      // A REAL void <input> — focusable, checkable, form-participating.
      // `checked` reflects the toggled prop's on value; an out-of-pair value
      // (indeterminate) is set as the DOM PROPERTY after render — the WC
      // surface CAN express what static HTML cannot (named improvement over
      // emit-html's comment-only limit).
      const ev = events.find((e) => e.trigger === name && e.toggles);
      let checked = '';
      if (ev?.toggles) {
        checked = `\${${acc(ev.toggles.prop)} === ${JSON.stringify(ev.toggles.between[1])} ? ' checked' : ''}`;
      }
      return visibleWrap(part, `<input${partAttr}${attrFragment(part)}${checked}>`);
    }

    const el = part.element ?? 'div';
    const aria = ariaByTrigger.get(name) ?? '';
    const ariaFrag = aria && events.some((e) => e.trigger === name && e.toggles?.aria)
      ? ` aria-${events.find((e) => e.trigger === name && e.toggles?.aria)!.toggles!.aria}="${aria}"`
      : '';
    const inner = Object.entries(part.parts ?? {})
      .map(([childName, child]) => genPart(childName, child, el))
      .join('');
    return visibleWrap(part, `<${el}${partAttr}${ariaFrag}${attrFragment(part)}>${inner}</${el}>`);
  };

  // ---- root open/close ---------------------------------------------------
  const elementByProp = contract.semantics.elementByProp;
  let tagExpr = JSON.stringify(contract.semantics.element);
  if (elementByProp) {
    extraConsts.unshift(
      `    const __tag = (${JSON.stringify(elementByProp.map)} as Record<string, string>)[String(${acc(elementByProp.prop)} ?? '')] ?? ${JSON.stringify(contract.semantics.element)};`,
    );
    tagExpr = '__tag';
  }
  const openTag = elementByProp ? '${__tag}' : contract.semantics.element;
  const closeTag = openTag;

  let rootAttrs = ` part="root"`;
  // Modifier attributes mirrored onto the internal root — the CSS's enum/
  // boolean conditions (see shadowCss). A defaultless enum left unset
  // applies NO modifier, exactly the React/emit-html semantics.
  for (const p of enums) {
    const e = acc(p.name);
    const a = attrOf(p.name);
    rootAttrs +=
      p.default !== undefined
        ? ` data-${a}="\${__esc(String(${e}))}"`
        : `\${${e} == null ? '' : \` data-${a}="\${__esc(String(${e}))}"\`}`;
  }
  const supportsDisabledExpr = elementByProp
    ? `${JSON.stringify(SUPPORTS_DISABLED)}.includes(__tag)`
    : String(SUPPORTS_DISABLED.includes(contract.semantics.element));
  for (const p of bools) {
    const e = acc(p.name);
    const a = attrOf(p.name);
    if (p.name === 'disabled') {
      if (supportsDisabledExpr === 'true') rootAttrs += `\${${e} ? ' disabled' : ''}`;
      else if (supportsDisabledExpr === 'false') rootAttrs += `\${${e} ? ' data-${a}=""' : ''}`;
      else rootAttrs += `\${${e} ? (${supportsDisabledExpr} ? ' disabled' : ' data-${a}=""') : ''}`;
    } else {
      rootAttrs += `\${${e} ? ' data-${a}=""' : ''}`;
    }
  }
  const roleByProp = contract.semantics.roleByProp;
  if (roleByProp) {
    extraConsts.push(
      `    const __role = (${JSON.stringify(roleByProp.map)} as Record<string, string>)[String(${acc(roleByProp.prop)} ?? '')];`,
    );
    rootAttrs += `\${__role ? \` role="\${__role}"\` : ''}`;
  } else if (contract.semantics.role && contract.semantics.role !== contract.semantics.element) {
    rootAttrs += ` role="${contract.semantics.role}"`;
  }
  if (ariaByTrigger.has('root')) {
    const ev = events.find((e) => e.trigger === 'root' && e.toggles?.aria)!;
    rootAttrs += ` aria-${ev.toggles!.aria}="${ariaByTrigger.get('root')}"`;
  }

  let rootInner: string;
  if (rootPart.parts) {
    rootInner = Object.entries(rootPart.parts)
      .map(([childName, child]) => genPart(childName, child, contract.semantics.element))
      .join('');
  } else if (contract.semantics.element === 'select') {
    // Content-model honesty: a shadow <select> drops non-option children at
    // parse time, and light DOM cannot project into it — the default text
    // renders as a real <option> (declared fidelity limit, named here).
    rootInner = `<option>${tpl(escapeHtml(textDefaultOf(contract)))}</option>`;
  } else {
    rootInner = `<slot>${tpl(escapeHtml(textDefaultOf(contract)))}</slot>`;
  }

  // Props with generated accessors: attribute-manifesting props + arrayOf
  // properties. The `children` text prop has NO accessor — it is the default
  // <slot> (`this.children` is the DOM's own light-children collection).
  const viewProps = [...attrProps, ...arrays];
  const viewBody = [
    `    const p = {`,
    ...viewProps.map((p) => `      ${isIdent(p.name) ? p.name : JSON.stringify(p.name)}: this.${isIdent(p.name) ? p.name : `[${JSON.stringify(p.name)}]`},`),
    `    };`,
    ...(viewProps.length === 0 ? ['    void p;'] : []),
    ...extraConsts,
    `    return \`<${openTag}${rootAttrs}>${rootInner}</${closeTag}>\`;`,
  ];

  // ---- event wiring ------------------------------------------------------
  const wiring: string[] = [];
  for (const [i, ev] of events.entries()) {
    const triggerPart = ev.trigger === 'root' ? rootPart : walked.find((w) => w.name === ev.trigger)?.part;
    const domEvent = triggerPart && isNativeCheckablePart(triggerPart) ? 'change' : 'click';
    const sel = ev.trigger === 'root' ? "[part='root']" : `[part='${ev.trigger}']`;
    const lines = [
      `    const __t${i} = sr.querySelector(${JSON.stringify(sel)});`,
      `    if (__t${i}) __t${i}.addEventListener('${domEvent}', () => {`,
    ];
    if (ev.toggles) {
      const [off, on] = ev.toggles.between;
      const a = attrOf(ev.toggles.prop);
      lines.push(
        `      // Uncontrolled toggle (contract event "${ev.name}"): flips ${JSON.stringify(ev.toggles.prop)} between ${JSON.stringify(off)}/${JSON.stringify(on)}; any out-of-pair value flips to ${JSON.stringify(on)}.`,
        `      const next = this.${isIdent(ev.toggles.prop) ? ev.toggles.prop : `[${JSON.stringify(ev.toggles.prop)}]`} === ${JSON.stringify(on)} ? ${JSON.stringify(off)} : ${JSON.stringify(on)};`,
        `      this.setAttribute('${a}', next);`,
        ...(formAssociated ? [`      this.#internals.setFormValue(next);`] : []),
        `      this.dispatchEvent(new CustomEvent('${ev.name}', { bubbles: true, composed: true, detail: { ${isIdent(ev.toggles.prop) ? ev.toggles.prop : JSON.stringify(ev.toggles.prop)}: next } }));`,
      );
    } else {
      lines.push(
        `      this.dispatchEvent(new CustomEvent('${ev.name}', { bubbles: true, composed: true }));`,
      );
    }
    lines.push(`    });`);
    wiring.push(...lines);
  }
  // Out-of-pair toggle values land as the indeterminate DOM property.
  for (const w of walked) {
    if (!isNativeCheckablePart(w.part)) continue;
    const ev = events.find((e) => e.trigger === w.name && e.toggles);
    if (!ev?.toggles) continue;
    const [off, on] = ev.toggles.between;
    const propAcc = `this.${isIdent(ev.toggles.prop) ? ev.toggles.prop : `[${JSON.stringify(ev.toggles.prop)}]`}`;
    wiring.push(
      `    const __chk_${w.name.replace(/[^\w]/g, '_')} = sr.querySelector<HTMLInputElement>("[part='${w.name}']");`,
      `    if (__chk_${w.name.replace(/[^\w]/g, '_')}) {`,
      `      const v = ${propAcc};`,
      `      __chk_${w.name.replace(/[^\w]/g, '_')}.indeterminate = v != null && v !== ${JSON.stringify(off)} && v !== ${JSON.stringify(on)};`,
      `    }`,
    );
  }

  // ---- assemble ----------------------------------------------------------
  const header = `/**
 * ${contract.name} — vanilla Custom Element <${tag}> emitted from contract
 * ${contract.id} v${contract.version} by @ds-contracts/emitter-web-components. Do not edit.
 *
 * Token values arrive via CSS custom properties (custom properties inherit
 * through the shadow boundary) — include the token stylesheet on the page
 * or nothing resolves.
 *
 * Named no-ops on this contract (canvas-only concepts, deliberately not
 * re-created here):
${noOps.map((n) => ` *   · ${n}`).join('\n')}
 */`;

  const defaultTrueBools = bools.filter((p) => p.default === true);

  return [
    header,
    `import sheet from './${tag}.css.js';`,
    ...depImports,
    ``,
    `const __esc = (s: string): string =>`,
    `  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');`,
    ``,
    ...(neededIcons.size > 0
      ? [
          `const ICONS: Record<string, string> = {`,
          ...[...neededIcons.entries()].map(([n, svg]) => `  ${JSON.stringify(n)}: ${JSON.stringify(svg)},`),
          `};`,
          ``,
        ]
      : []),
    `export class ${className} extends HTMLElement {`,
    `  static observedAttributes = ${JSON.stringify(observed)};`,
    ...(formAssociated
      ? [
          `  /** The contract's root is input-like (or hosts a native checkable`,
          `   *  control) — the element participates in forms. */`,
          `  static formAssociated = true;`,
          `  #internals: ElementInternals = this.attachInternals();`,
        ]
      : []),
    ``,
    `  constructor() {`,
    `    super();`,
    `    const shadow = this.attachShadow({ mode: 'open'${interactive ? ', delegatesFocus: true' : ''} });`,
    `    shadow.adoptedStyleSheets = [sheet];`,
    `  }`,
    ``,
    ...accessors,
    ``,
    `  connectedCallback(): void {`,
    ...defaultTrueBools.map(
      (p) => `    if (!this.hasAttribute('${attrOf(p.name)}')) this.setAttribute('${attrOf(p.name)}', '');`,
    ),
    `    this.#render();`,
    `  }`,
    ``,
    `  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {`,
    `    if (oldValue !== newValue) this.#render();`,
    `  }`,
    ``,
    `  #view(): string {`,
    ...viewBody,
    `  }`,
    ``,
    `  #render(): void {`,
    `    const sr = this.shadowRoot;`,
    `    if (!sr) return;`,
    `    sr.innerHTML = this.#view();`,
    ...wiring,
    ...(wiring.length === 0 ? ['    void sr;'] : []),
    `  }`,
    `}`,
    ``,
    `/** Register <${tag}> (idempotent). Runs on import; exported for explicit use. */`,
    `export function define(): void {`,
    `  if (!customElements.get('${tag}')) customElements.define('${tag}', ${className});`,
    `}`,
    `define();`,
    ``,
    `export default ${className};`,
    ``,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Stylesheet module — the shadow CSS as a constructable sheet.
// ---------------------------------------------------------------------------

function generateStylesheetModule(contract: Contract): string {
  const css = shadowCss(contract);
  return [
    `/**`,
    ` * ${contract.name} — constructable shadow stylesheet from contract`,
    ` * ${contract.id} v${contract.version} (@ds-contracts/emitter-web-components). Do not edit.`,
    ` * Composed dependencies style themselves in their own shadow roots —`,
    ` * this sheet carries ONLY this contract's anatomy.`,
    ` */`,
    `export const css = ${JSON.stringify(css)};`,
    ``,
    `const sheet = new CSSStyleSheet();`,
    `sheet.replaceSync(css);`,
    ``,
    `export default sheet;`,
    ``,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Demo — the emit-html showcase grid, spelled with the element itself.
// ---------------------------------------------------------------------------

function generateDemo(contract: Contract): string {
  const tag = tagOf(contract);

  interface DemoItem {
    label: string;
    attrs: string; // attribute fragment on the element
  }
  const items: DemoItem[] = [{ label: 'default', attrs: '' }];
  for (const p of enumProps(contract)) {
    for (const v of p.type.enum) {
      if (v === String(p.default ?? '')) continue;
      items.push({ label: `${p.name}=${v}`, attrs: ` ${attrOf(p.name)}="${escapeHtml(v)}"` });
    }
  }
  for (const p of boolProps(contract)) {
    if (p.default === true) continue;
    items.push({ label: `${p.name}=true`, attrs: ` ${attrOf(p.name)}=""` });
  }

  const body = items
    .map(
      (it) =>
        `  <div class="showcase__item">\n    <p class="showcase__label">${escapeHtml(it.label)}</p>\n    <${tag}${it.attrs}></${tag}>\n  </div>`,
    )
    .join('\n');

  return `<!--
  ${contract.name} — Custom Element showcase emitted from contract ${contract.id} v${contract.version}
  by @ds-contracts/emitter-web-components. The story-equivalent grid: the all-defaults rendering,
  one rendering per enum value of every axis (other axes at their defaults), and one per boolean
  prop set true — the exact enumeration core/emit-html.ts showcases, spelled with <${tag}>.
  Token values arrive via CSS custom properties (they inherit through the shadow boundary) —
  include the token stylesheet on the page or nothing resolves. Text content is the default-slot
  fallback; pass light DOM children to replace it.
  Serve next to the COMPILED element module (${tag}.ts → ${tag}.js).
-->
<script type="module" src="./${tag}.js"></script>
<style>
  .showcase { display: flex; flex-direction: column; gap: 24px; align-items: flex-start; font-family: sans-serif; }
  .showcase__label { margin: 0 0 8px; font: 12px/1 monospace; opacity: 0.6; }
</style>
<section class="showcase showcase--${tag}">
${body}
</section>
`;
}

// ---------------------------------------------------------------------------
// Custom Elements Manifest — generated FROM the contract (deterministic; no
// analyzer, no drift: the manifest is another pure projection).
// ---------------------------------------------------------------------------

function generateManifest(contract: Contract): string {
  const tag = tagOf(contract);
  const className = classNameOf(contract);

  const attributes: Array<Record<string, unknown>> = [];
  for (const p of attributeProps(contract)) {
    const typeText = isEnum(p)
      ? p.type.enum.map((v) => `'${v}'`).join(' | ')
      : p.type === 'boolean'
        ? 'boolean'
        : p.type === 'number'
          ? 'number'
          : 'string';
    const def =
      p.default === undefined
        ? undefined
        : typeof p.default === 'string'
          ? `'${p.default}'`
          : String(p.default);
    attributes.push({
      name: attrOf(p.name),
      fieldName: p.name,
      type: { text: typeText },
      ...(def !== undefined ? { default: def } : {}),
      ...(p.description ? { description: p.description } : {}),
    });
  }

  const members: Array<Record<string, unknown>> = contract.props.filter(isArrayType).map((p) => ({
    kind: 'field',
    name: p.name,
    privacy: 'public',
    type: {
      text: `Array<{ ${Object.entries(p.type.arrayOf)
        .map(([f, t]) => `${f}?: ${t === 'text' ? 'string' : t}`)
        .join('; ')} }>`,
    },
    description: `${p.description ?? ''}${p.description ? ' ' : ''}(JS property only — attributes cannot carry lists; unset renders the contract's observed sample)`.trim(),
  }));

  const cemEvents: Array<Record<string, unknown>> = (contract.events ?? []).map((ev) => ({
    name: ev.name,
    type: { text: ev.toggles ? `CustomEvent<{ ${ev.toggles.prop}: string }>` : 'CustomEvent' },
    ...(ev.description ? { description: ev.description } : {}),
  }));

  const slots: Array<Record<string, unknown>> = [];
  const seenSlots = new Set<string>();
  for (const { slot } of slotsOf(contract)) {
    const name = slot.name === 'children' ? '' : slot.name;
    if (seenSlots.has(name)) continue;
    seenSlots.add(name);
    slots.push({
      name,
      ...(slot.accepts ? { description: `Accepts: ${slot.accepts.join(', ')} (${slot.acceptsMode ?? 'prefer'})` } : {}),
    });
  }
  const childrenText = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  if (childrenText && !seenSlots.has('')) {
    slots.push({ name: '', description: childrenText.description ?? `${contract.name} text content.` });
  }

  const cssParts: Array<Record<string, unknown>> = [{ name: 'root' }];
  for (const { name, part, path } of walkAnatomy(contract)) {
    if (path[0] === 'root' && path.length === 1) continue;
    cssParts.push({ name });
    if (part.icon && part.element) cssParts.push({ name: `${name}-glyph` });
  }

  const manifest = {
    schemaVersion: '1.0.0',
    readme: '',
    modules: [
      {
        kind: 'javascript-module',
        path: `${tag}.ts`,
        description: `Generated from contract ${contract.id} v${contract.version} by @ds-contracts/emitter-web-components.`,
        declarations: [
          {
            kind: 'class',
            customElement: true,
            name: className,
            tagName: tag,
            description: contract.description,
            attributes,
            members,
            events: cemEvents,
            slots,
            cssParts,
          },
        ],
        exports: [
          { kind: 'js', name: className, declaration: { name: className, module: `${tag}.ts` } },
          { kind: 'custom-element-definition', name: tag, declaration: { name: className, module: `${tag}.ts` } },
        ],
      },
    ],
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// emitWebComponent
// ---------------------------------------------------------------------------

export function emitWebComponent(contract: Contract, ctx: WcEmitCtx): EmitWcResult {
  const errors: string[] = [];
  validateContract(contract, ctx.contracts, errors, ctx.icons);
  if (errors.length > 0) {
    throw new Error(
      `Refused — ${errors.length} contract violation(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }
  return {
    element: generateElement(contract, ctx),
    stylesheet: generateStylesheetModule(contract),
    demo: generateDemo(contract),
    manifest: generateManifest(contract),
  };
}
