/**
 * Contract anatomy facts — the analysis layer every emitter reads.
 *
 * Moved verbatim from the reference repo's core/emit-react.ts (the top half
 * of the React emitter, which is NOT React-specific): the semantic-role
 * lint table, the shared `{token.ref}` helpers, the part-state channel set,
 * the UA-margin / UA-painted element tables, multi-root anatomy
 * (rootElementsOf / topRoots / isMultiRoot), the prop classifiers
 * (enumProps / boolProps / …) and holderDeclaresPosition. Pure: contract in,
 * facts out; imports @ds-contracts/schema only.
 *
 * The lower-case helpers (stripBraces, cssVar, placeholdersIn, enumCombos,
 * STATE_SELECTORS, OVERLAY_CSS, ALIGN_CSS, JUSTIFY_CSS, isStructural,
 * layoutOverrideDecls) are exported for the sibling validate/css/grid modules
 * and are deliberately NOT re-exported from the package index.
 */
import { DEFAULT_FONT_STACK, slotsOf, walkAnatomy, type Contract, type Part, type Prop } from '@ds-contracts/schema';
import { flattenTokens, makeResolveLiteral, type TokenTreeInput } from './tokens.js';


/** v11 SEMANTIC LINT — roles that RE-CREATE a control the platform already
 *  ships. A contract claiming one of these roles (semantics.role, a
 *  roleByProp value, or a part's attrs.role) on an element outside the
 *  allowed native hosts REFUSES at validation time, on every surface, unless
 *  it declares the exception (semantics.roleException for root-level claims,
 *  part.roleException for part-level ones) — a one-sentence reason that
 *  renders on the spec sheet so it is reviewable, never silent. Bounded by
 *  design: exactly the roles with a native equivalent; APG composites
 *  (tablist, option, toolbar, …) are not in the table. */
export const NATIVE_ROLE_HOSTS: Record<string, { hosts: string[]; native: string }> = {
  checkbox: { hosts: ['input'], native: '<input type="checkbox">' },
  radio: { hosts: ['input'], native: '<input type="radio">' },
  switch: { hosts: ['input'], native: '<input type="checkbox"> (role="switch" on it is the modern switch pattern)' },
  button: { hosts: ['button'], native: '<button>' },
  link: { hosts: ['a'], native: '<a href>' },
  textbox: { hosts: ['input', 'textarea'], native: '<input> / <textarea>' },
  slider: { hosts: ['input'], native: '<input type="range">' },
  progressbar: { hosts: ['progress'], native: '<progress>' },
  spinbutton: { hosts: ['input'], native: '<input type="number">' },
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export const stripBraces = (ref: string) => ref.slice(1, -1);
export const cssVar = (tokenPath: string) => `var(--${tokenPath.split('.').join('-')})`;

export function placeholdersIn(refPath: string): string[] {
  return [...refPath.matchAll(/\{([a-z][\w-]*)\}/g)].map((m) => m[1]);
}

/** Round 10 — the cartesian of a substituted ref's placeholder values, in
 *  DECLARED placeholder order and then declared enum-value order, so the
 *  emitted rule order is a function of the contract and nothing else. Every
 *  combination is one compound ancestor selector; the caller decides what to
 *  do with a combination whose leaf does not exist. */
export function enumCombos(
  phs: string[],
  enums: Map<string, string[]>,
): Array<Array<[prop: string, value: string]>> {
  let out: Array<Array<[string, string]>> = [[]];
  for (const ph of phs) {
    const next: Array<Array<[string, string]>> = [];
    for (const prefix of out) for (const value of enums.get(ph) ?? []) next.push([...prefix, [ph, value]]);
    out = next;
  }
  return out;
}

export const STATE_SELECTORS: Record<string, string> = {
  hover: ':hover:not(:disabled)',
  active: ':active:not(:disabled)',
  'focus-visible': ':focus-visible',
  disabled: ':disabled',
};

/** v13 (P18 second half): the channels a NON-root part's `states` may carry —
 *  color-kind only, bounded by the field evidence (the CBDS disabled label
 *  drew #556275 on the #dfe3eb root; extend only when fixtures demand more).
 *  The root keeps its full state vocabulary (outline-*, opacity, radius, …). */
/** v13 was color-kind only. FC-DUMP-PROPOSE-PART-STATE-CHANNELS: a Hover-only
 *  DROP_SHADOW / stroke weight / corner radius / node opacity on a drawn child
 *  used to propose with ZERO notes (the channel had nowhere to land), so the
 *  proposer now carries them here — box-shadow, border-width, border-radius,
 *  opacity. The rule body below is channel-generic (`<prop>: var(...)`) and the
 *  canvas leg merges part states into tokens, which applyTokens already lowers
 *  for all four. */
export const PART_STATE_CHANNELS = new Set([
  'color',
  'background-color',
  'border-color',
  'box-shadow',
  'border-width',
  'border-radius',
  'opacity',
]);

/** Elements the UA stylesheet gives default MARGINS. A component's box is
 *  contract-governed — spacing between components belongs to the composing
 *  layout, never to a UA default leaking through (field failure: Heading's
 *  h1-h6 carried the UA's 0.67em block margins into every composition). The
 *  emitters neutralize margin on the root class when the root can render as
 *  one of these (semantics.element or any elementByProp value). */
export const UA_MARGIN_ELEMENTS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'blockquote', 'figure', 'hr', 'ul', 'ol', 'dl', 'dd', 'pre', 'fieldset',
]);

/** GAP-CLOSING ROUND 6 — elements the UA stylesheet gives a default PAINT
 *  (Chrome's `buttonface` ground plus the native control chrome behind
 *  `appearance: auto`). Same reasoning as UA_MARGIN_ELEMENTS one block up:
 *  the component's box is contract-governed, and a Figma frame with no fill
 *  is transparent — so a root whose contract states NO background channel at
 *  all must render with none, not with the user agent's. Deliberately just
 *  `button`: the emitters' own nested-part chrome resets exactly this
 *  element (see the `part.element === 'button'` branch), and the reset is
 *  the paint half of that same spelling. Inputs/selects are NOT listed —
 *  `appearance: none` on a checkbox erases the glyph, a different fact. */
export const UA_PAINTED_ROOT_ELEMENTS = new Set(['button']);

/** Channels that count as "this root states its own paint" — any one of them
 *  means the UA default is already overridden and the reset is a no-op that
 *  would only move bytes. */
export const UA_PAINT_CHANNELS = ['background', 'background-color', 'background-image'] as const;

/** Elements the UA stylesheet gives default PADDING. MEASURED, not recalled:
 *  `getComputedStyle` on each bare element in the repo's Chromium
 *  (playwright-core, Chromium 149.0.7827.55, 2026-09-19), top/right/bottom/left:
 *    button 1 6 1 6 · input 1 2 1 2 · textarea 2 2 2 2 · option 0 2 1 2 ·
 *    fieldset 5.6 12 10 12 · legend 0 2 0 2 · ul/ol/menu 0 0 0 40 (inline
 *    start) · dialog[open] 16 16 16 16 · td/th 1 1 1 1.
 *  Every other element the emitters can render (div, span, a, label, p,
 *  h1-h6, li, select, section, …) measured 0 on all four sides. `select` is 0
 *  in Chromium; Safari and Firefox were NOT measured and may pad it, so it is
 *  not listed (named in docs/23 §D.44).
 *
 *  READ BY THE PROPOSER, NOT THE EMITTERS (review of §D.44, H2): a Figma
 *  frame's padding side is a DRAWN fact, so core/propose-figma.ts writes an
 *  explicit `padding-<side>: 0px` literal where the canvas drew 0 on a set it
 *  proposes as one of these elements. An emitter-side "undeclared means 0"
 *  reset was wrong whenever the proposer REFUSED a side (Eventz Atoms/Tag
 *  draws 6/12 and its inline padding is refused): undeclared is not zero. */
export const UA_PADDING_ELEMENTS = new Set([
  'button', 'input', 'textarea', 'option', 'fieldset', 'legend', 'ul', 'ol', 'menu', 'dialog', 'td', 'th',
]);

/** Every element the contract's root can render as. */
export function rootElementsOf(contract: Contract): string[] {
  const ebp = contract.semantics.elementByProp;
  return [contract.semantics.element, ...(ebp ? Object.values(ebp.map) : [])];
}

// ---------------------------------------------------------------------------
// Multi-root anatomy (advanced composition). The schema has ALWAYS modeled
// anatomy as Record<string, Part> (a map of top-level roots); the single-root
// case — one entry named "root" — is the N=1 special case, not a different
// shape. A captured composite (a Modal = {dialog, backdrop}) carries >1
// top-level entry. These helpers name the general case so the emitters and
// validator stop hardcoding `contract.anatomy.root`.
//
// INVARIANT: for every single-root contract these are byte-for-byte the old
// behavior — `topRoots` yields exactly [["root", root]] and `isMultiRoot`
// is false, so the untouched single-root code paths run verbatim.
// ---------------------------------------------------------------------------

/** Every top-level anatomy entry (root), in declaration order. */
export const topRoots = (contract: Contract): Array<[string, Part]> =>
  Object.entries(contract.anatomy);

/** The names of the top-level roots — the set a single-root contract reduces
 *  to `{ "root" }`. */
export const topRootNames = (contract: Contract): Set<string> =>
  new Set(topRoots(contract).map(([n]) => n));

/** True when the contract declares MORE THAN ONE top-level root (a captured
 *  composite). A single-root contract is false. */
export const isMultiRoot = (contract: Contract): boolean => topRoots(contract).length > 1;

/** v7 overlay: placement → inset declarations. The overlay part is
 *  position:absolute against the root (which becomes position:relative). */
export const OVERLAY_CSS: Record<string, string[]> = {
  top: ['bottom: 100%', 'left: 0'],
  bottom: ['top: 100%', 'left: 0'],
  start: ['right: 100%', 'top: 0'],
  end: ['left: 100%', 'top: 0'],
};

export const ALIGN_CSS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
};
export const JUSTIFY_CSS: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

export const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

/** VARIANT-bound boolean — a true variant axis (subst keys 'true'|'false').
 *  literalsByProp / tokensByProp may drive it the same way as an enum. */
export const isVariantBool = (p: Prop): boolean =>
  p.type === 'boolean' && p.bindings.figma.kind === 'VARIANT';

/** v7: structured/array prop — code-only (bindings.figma.kind 'NONE'). */
export const isArrayType = (
  p: Prop,
): p is Prop & { type: { arrayOf: Record<string, 'text' | 'number' | 'boolean'> } } =>
  typeof p.type === 'object' && 'arrayOf' in p.type;

export function enumProps(contract: Contract) {
  return contract.props.filter(isEnum);
}
export function boolProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'boolean');
}
export function numberProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'number');
}
export function arrayProps(contract: Contract) {
  return contract.props.filter(isArrayType);
}
export function textProps(contract: Contract) {
  return contract.props.filter((p) => p.type === 'text');
}
export function namedTextProps(contract: Contract) {
  return textProps(contract).filter((p) => p.bindings.code.prop !== 'children');
}
export function namedSlots(contract: Contract) {
  return slotsOf(contract).filter((s) => s.slot.name !== 'children');
}
export function textDefault(contract: Contract): string {
  const text = textProps(contract).find((p) => p.bindings.code.prop === 'children');
  return typeof text?.default === 'string' ? text.default : contract.name;
}

/** NO DECLARED FAMILY = THE PIPELINE DEFAULT FAMILY, on every code surface.
 *  The proposer never carries Inter (door propose.font-family-inter-is-default:
 *  "absence already renders it") and the Figma writer honours that, but the
 *  code emitters declared nothing, so the text inherited the HOST page's font
 *  — the browser's serif in a clean consumer (CBDS Badge 2026-09-18: 0 of 72
 *  variants inside 5 %). These are the parts that must say the default
 *  themselves: a part that DRAWS text (content / text / the root's children
 *  text prop / a text-entry control) where neither it nor an ancestor part
 *  names `font-family` in ANY holder — a family stated anywhere, even per
 *  variant or per state, is the contract speaking and is left alone. Slots
 *  and instances are other people's text and gain nothing; a textless
 *  contract yields the empty set and keeps its bytes. */
const namesFamily = (v: unknown): boolean =>
  typeof v === 'object' && v !== null &&
  Object.entries(v).some(([k, x]) => k === 'font-family' || namesFamily(x));
const TEXT_ENTRY_ELEMENTS = new Set(['input', 'textarea', 'select']);
const TEXTLESS_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'color', 'hidden']);
export function defaultFontFamilyParts(contract: Contract): Set<Part> {
  const out = new Set<Part>();
  const single = !isMultiRoot(contract);
  const childrenText = textProps(contract).some((p) => p.bindings.code.prop === 'children');
  const visit = (part: Part, elements: Array<string | undefined>, top: boolean, inherited: boolean): void => {
    if (part.component) return; // an instance styles itself from its own contract
    const { parts, ...own } = part;
    const entry = !TEXTLESS_INPUT_TYPES.has(part.attrs?.type ?? '') && elements.some((e) => e !== undefined && TEXT_ENTRY_ELEMENTS.has(e));
    const rootChildren = top && single && !parts && !part.slot && childrenText;
    // `text: ""` is intentional emptiness (a skeleton block) — no glyph, no family.
    const staticText = [part.text, ...Object.values(part.textByProp?.map ?? {})].some((t) => typeof t === 'string' && t !== '');
    const draws = part.content !== undefined || staticText || entry || rootChildren;
    const spoken = inherited || namesFamily(own);
    if (draws && !spoken) out.add(part);
    for (const child of Object.values(parts ?? {})) visit(child, [child.element], false, spoken || out.has(part));
  };
  for (const [, root] of topRoots(contract)) visit(root, single ? rootElementsOf(contract) : [root.element], true, false);
  return out;
}
export const DEFAULT_FONT_FAMILY_DECL = `font-family: ${DEFAULT_FONT_STACK}`;

/** A STROKE THAT TAKES NO LAYOUT SPACE — `Part.strokesIncludedInLayout: false`
 *  (dump v1.35), on every STYLESHEET surface.
 *
 *  A designer's Figma stroke paints over the padding and leaves the box at
 *  content + padding; a CSS `border` grows the box. Measured on the 72-variant
 *  CBDS Badge: all 24 outline variants 4px too wide, and the 16px-high small
 *  one 20px high (8+8 padding plus a 2px border cannot fit a 16px border box
 *  at all — which is also why "padding minus border" was never an option, on
 *  top of destroying the padding's variable binding).
 *
 *  CSS has no property that says "border, but take no space". What it has is
 *  an INSET `box-shadow` with zero blur: painted inside the border box, over
 *  the background and under the content, following `border-radius`, taking no
 *  space. (`outline` + a negative offset draws the same ring and is NOT used:
 *  it is the focus ring's property, and a `:focus-visible` rule would erase
 *  the border.) So for a flagged part the SAME `border-width` / `border-color`
 *  channels are drawn as that ring.
 *
 *  HOW, AND WHY IT IS A CONTRACT REWRITE AND NOT A GUARD AT EACH PUSH SITE.
 *  Width, colour and a real shadow each vary on their OWN axis — width by
 *  size, colour by type × style, shadow by state — and `box-shadow` is one
 *  property, so no rule can state the ring without knowing the other two.
 *  Custom properties are the CSS spelling of exactly that: every holder keeps
 *  saying what it said, under a private name (`border-width: X` →
 *  `--_stroke-width: X`, wherever it sits: tokens, tokensByProp, literals,
 *  literalsByProp, states, statesByProp), and the part's BASE rule composes
 *  them once. The emitters write `<channel>: <value>` generically at some
 *  forty sites across two files; renaming the channel before they run reaches
 *  every one of them, and none can route around it (the finishStylesheet
 *  reasoning, one step earlier). With the width gone from the maps, nothing
 *  synthesises `border-style: solid` for the part, and a root falls to its
 *  ordinary `border: 0` reset — which a `<button>` root needs.
 *
 *  · The names carry an UNDERSCORE, which TokenRefSchema refuses in a token
 *    path, so no token's `var(--…)` can ever collide with them.
 *  · Custom properties INHERIT. The base rule therefore always states every
 *    variable the ring reads (`0px` / `currentColor` — CSS's own completion of
 *    a colourless border — / a no-op shadow) unless the part's own base
 *    channel already does, so a flagged part nested in another flagged part,
 *    or a flagged component inside one, never draws its ancestor's stroke.
 *  · A real `box-shadow` on the part rides `--_stroke-shadow` and is composed
 *    AFTER the ring, so both survive in every state. `none` is not a list
 *    item — `box-shadow: <ring>, none` is INVALID and voids the ring with it —
 *    so a literal `none` becomes the no-op layer `0 0 #0000` here, and a
 *    shadow TOKEN that resolves to `none` (60+ of them in this repo's own
 *    corpora, concentrated on outlined variants) is settled on the finished
 *    sheet by settleStrokeShadows, where the token VALUES are known.
 *  · Per-side weights (`border-<side>-width`, dump v1.34) draw one layer per
 *    side; a uniform width on such a part feeds all four. Layers overlap at
 *    the corners, which a translucent colour would double (NAMED LIMIT). A
 *    literal unitless `0` becomes `0px`: `calc(-1 * 0)` is a NUMBER, not a
 *    length, and voided the whole declaration (a TOKEN resolving to a
 *    unitless 0 cannot be seen here — NAMED LIMIT).
 *  · EVERY ring part resets its own `border` (the single root already does):
 *    a nested `<button>` / `<fieldset>` part otherwise shows the user agent's
 *    2px outset / groove border again the moment the width leaves the maps.
 *  · FORCED COLORS erases `box-shadow` (a border survives), so an outlined
 *    control would have no boundary in Windows High Contrast; the finished
 *    sheet restores one without layout (css.ts lowerStrokeRingForcedColors).
 *
 *  `outline-*` channels are untouched: an outline never takes layout space.
 *  Returns the SAME object when no part is flagged — every other contract
 *  keeps its bytes. validateContract refuses what has no ring spelling
 *  (per-side colours, a declared or conditional border style). */
const STROKE_SIDES = ['top', 'right', 'bottom', 'left'] as const;
const STROKE_WIDTH_VAR = '--_stroke-width';
const STROKE_COLOR_VAR = '--_stroke-color';
const STROKE_SHADOW_VAR = '--_stroke-shadow';
const strokeSideVar = (side: string) => `--_stroke-${side}-width`;
const NO_SHADOW = '0 0 #0000';
/** Every channel → value map a part can carry a stroke or shadow channel in. */
function strokeHolderMaps(part: Part): Array<Record<string, string>> {
  const tbp = part.tokensByProp ? (Array.isArray(part.tokensByProp) ? part.tokensByProp : [part.tokensByProp]) : [];
  return [
    part.tokens, part.literals, ...Object.values(part.states ?? {}),
    ...tbp.flatMap((e) => Object.values(e.map)),
    ...(part.literalsByProp ?? []).flatMap((e) => Object.values(e.map)),
    ...(part.statesByProp ?? []).flatMap((e) => Object.values(e.map)),
  ].filter((m): m is Record<string, string> => m !== undefined);
}
/** The `border-*` channels `strokesIncludedInLayout: false` redraws. */
export const isStrokeRingChannel = (channel: string): boolean =>
  channel === 'border-width' || channel === 'border-color' || STROKE_SIDES.some((s) => channel === `border-${s}-width`);
/** Does this part draw ANY stroke (border or outline vocabulary, any holder)?
 *  validateContract: the flag qualifies a stroke and nothing else. */
export const partCarriesStroke = (part: Part): boolean =>
  strokeHolderMaps(part).some((m) => Object.keys(m).some((c) => /^(border|outline)(-(top|right|bottom|left))?-(width|color)$/.test(c)));
/** Is this part's border REDRAWN as a ring? The flag, plus a `border-*`
 *  channel for it to qualify (an outline-only part has nothing to redraw). */
export const drawsStrokeRing = (part: Part): boolean =>
  part.strokesIncludedInLayout === false && strokeHolderMaps(part).some((m) => Object.keys(m).some(isStrokeRingChannel));
/** A literal width of unitless zero, as a LENGTH (see the per-side bullet). */
const zeroAsLength = (v: string): string => (/^[-+]?0*\.?0+$/.test(v.trim()) ? '0px' : v);
export function lowerStrokeRings(contract: Contract): Contract {
  let touched = false;
  const singleRoot = Object.keys(contract.anatomy).length === 1;
  const lower = (part: Part, top = false): Part => {
    const parts = part.parts && Object.fromEntries(Object.entries(part.parts).map(([n, p]) => [n, lower(p)]));
    const own: Part = parts ? { ...part, parts } : part;
    if (!drawsStrokeRing(part)) return own;
    const maps = strokeHolderMaps(part);
    touched = true;
    const perSide = maps.some((m) => STROKE_SIDES.some((s) => `border-${s}-width` in m));
    const hasShadow = maps.some((m) => 'box-shadow' in m);
    const rename = (m: Record<string, string>): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const [channel, value] of Object.entries(m)) {
        const side = STROKE_SIDES.find((s) => channel === `border-${s}-width`);
        if (channel === 'border-width' && perSide) for (const s of STROKE_SIDES) out[strokeSideVar(s)] = zeroAsLength(value);
        else if (channel === 'border-width') out[STROKE_WIDTH_VAR] = zeroAsLength(value);
        else if (side) out[strokeSideVar(side)] = zeroAsLength(value);
        else if (channel === 'border-color') out[STROKE_COLOR_VAR] = value;
        else if (channel === 'box-shadow') out[STROKE_SHADOW_VAR] = value.trim() === 'none' ? NO_SHADOW : value;
        else out[channel] = value;
      }
      return out;
    };
    const renameIn = <T extends { map: Record<string, Record<string, string>> }>(e: T): T =>
      ({ ...e, map: Object.fromEntries(Object.entries(e.map).map(([v, m]) => [v, rename(m)])) });
    const tokens = part.tokens && rename(part.tokens);
    // The single root's `border: 0` is the emitters' own reset; every other
    // ring part states it here, FIRST, so nothing after it is erased.
    const literals: Record<string, string> = { ...(top && singleRoot ? {} : { border: '0' }), ...rename(part.literals ?? {}) };
    // A base channel states its variable in the base rule only when it is a
    // literal or a placeholder-free token — a substituted ref lands in the
    // per-value rules, and the base rule still owes the default.
    const stated = (v: string) => v in literals || (tokens?.[v] !== undefined && placeholdersIn(stripBraces(tokens[v])).length === 0);
    const w = (v: string) => `var(${v})`;
    const c = w(STROKE_COLOR_VAR);
    for (const v of perSide ? STROKE_SIDES.map(strokeSideVar) : [STROKE_WIDTH_VAR]) if (!stated(v)) literals[v] = '0px';
    if (!stated(STROKE_COLOR_VAR)) literals[STROKE_COLOR_VAR] = 'currentColor';
    if (hasShadow && !stated(STROKE_SHADOW_VAR)) literals[STROKE_SHADOW_VAR] = NO_SHADOW;
    const layers = perSide
      ? [
          `inset 0 ${w(strokeSideVar('top'))} 0 0 ${c}`,
          `inset 0 calc(-1 * ${w(strokeSideVar('bottom'))}) 0 0 ${c}`,
          `inset ${w(strokeSideVar('left'))} 0 0 0 ${c}`,
          `inset calc(-1 * ${w(strokeSideVar('right'))}) 0 0 0 ${c}`,
        ]
      : [`inset 0 0 0 ${w(STROKE_WIDTH_VAR)} ${c}`];
    literals['box-shadow'] = [...layers, ...(hasShadow ? [w(STROKE_SHADOW_VAR)] : [])].join(', ');
    const tbp = part.tokensByProp;
    return {
      ...own,
      ...(tokens ? { tokens } : {}),
      literals,
      ...(tbp ? { tokensByProp: Array.isArray(tbp) ? tbp.map(renameIn) : renameIn(tbp) } : {}),
      ...(part.literalsByProp ? { literalsByProp: part.literalsByProp.map(renameIn) as Part['literalsByProp'] } : {}),
      ...(part.states ? { states: Object.fromEntries(Object.entries(part.states).map(([st, m]) => [st, rename(m)])) } : {}),
      ...(part.statesByProp ? { statesByProp: part.statesByProp.map(renameIn) as Part['statesByProp'] } : {}),
    };
  };
  const anatomy = Object.fromEntries(Object.entries(contract.anatomy).map(([n, p]) => [n, lower(p, true)]));
  return touched ? { ...contract, anatomy } : contract;
}

/** A RING'S REAL SHADOW WHOSE TOKEN RESOLVES TO `none` — settled on the
 *  finished sheet, because that is the first place the fact is visible.
 *
 *  `box-shadow: <ring>, none` is not a value: `none` is the whole property or
 *  nothing, so a `--_stroke-shadow: var(--shadow-x)` whose token is `none`
 *  invalidates the composed declaration at computed-value time and the STROKE
 *  vanishes with the shadow. CSS cannot test a variable's value, and the
 *  lowering above sees token PATHS (often still carrying `{placeholders}`),
 *  never values. The emitters that are handed the token trees therefore pass
 *  them here: every `--_stroke-shadow: var(--x)` whose token resolves to
 *  `none` is respelled as the no-op layer, inside the ring's private variable
 *  ONLY — tokens.css and every ordinary `box-shadow: var(--x)` keep their
 *  bytes. A token that is `none` in one mode and a real shadow in the other
 *  has no single spelling and is REFUSED BY NAME rather than silently losing
 *  the stroke in one mode or the shadow in the other. And a caller that hands
 *  over NO trees while a ring binds its shadow to a token is refused by name
 *  too: the one fact that decides whether the stroke survives cannot be
 *  checked, and "probably not none" is a guess (every registered emitter
 *  passes the trees; a bare generateCss / emitReact call is the case this
 *  catches). The inline surface resolves values itself and drops `none` at
 *  render time. */
/** A TEXT BOX THAT SIZES ITSELF TO ITS TEXT IS A WHOLE NUMBER OF PIXELS WIDE —
 *  `Part.textAutoResize: 'WIDTH_AND_HEIGHT'` (dump v1.36), on every code
 *  surface.
 *
 *  Figma's auto-width text box is the glyph advance rounded UP, with no
 *  letter spacing after the last glyph: `Label` in Inter Semi Bold 14 reports
 *  absoluteBoundingBox.width 32 where Chromium lays the same run out at
 *  31.40625. The hug root around it therefore rendered 47.40625 px against
 *  Figma's 48 and its right edge antialiased across two columns — measured by
 *  the design-led consumer check on the 72-variant CBDS Badge: 26 of the
 *  48 × 16 px small variants missed the 5 % limit at 4.4–7.3 % with every
 *  content size equal.
 *
 *  The lowering gives the text element the same box:
 *
 *      inline-size: calc-size(fit-content, round(up, size[ - <letter-spacing>], 1px));
 *      max-inline-size: 100%;           (unless the part carries its own max-width)
 *      align-self: flex-start;          (only under a stretching flex column)
 *
 *  · FIT-CONTENT, NOT MAX-CONTENT (review, PR 132). `max-content` gave the
 *    element a definite, NON-WRAPPING box: the shipped `flowbite.card` label
 *    carries the fact on a runtime `children` string, and a long one grew the
 *    card to 596 px inside a 240 px container (a fixed-width column or grid
 *    stopped wrapping the same way), while Safari and Firefox — which drop
 *    the declaration — wrapped. `fit-content` is `min(max-content,
 *    max(min-content, available))`: a label that fits is its max-content box
 *    rounded up (the badge is unchanged, 34 px), a label that does not fit
 *    wraps at the available width exactly as it does without the fact.
 *  · MAX-INLINE-SIZE: 100%. Rounding a WRAPPED box rounds the available width
 *    up, so a fractional container (120.5 px) overflowed by 0.5 px; the clamp
 *    returns it to 120.5 (measured in column-flex, row-flex, grid and a
 *    fit-content card) and changes nothing for a label that fits. A part that
 *    carries its own `max-width` / `max-inline-size` keeps it, and the clamp is
 *    not written (it would override the author's value in the same rule) —
 *    there the sub-pixel overflow in a fractional container is a NAMED limit.
 *    (`min(…, 100%)` inside `calc-size()` collapsed the badge to 0: rejected.)
 *  · ALIGN-SELF: FLEX-START — an AGENT decision, recorded with its inverse in
 *    docs/23 §D.42. A text box that sizes itself to its text is a HUG box in
 *    Figma, so under a vertical auto-layout frame drawn MIN it sits at the
 *    start edge; CSS's default `align-items: normal` STRETCHES it. With
 *    calc-size() the explicit inline-size already stops the stretch; without
 *    it (Safari, Firefox) the box stretched, and a centred label moved (x=84
 *    against x=0 in a 200 px column). Emitted only when the parent is a flex
 *    COLUMN whose cross-axis alignment is absent or `stretch` and carries no
 *    `layoutByProp` (a per-variant alignment would be overridden), and the part
 *    is not absolutely placed and declares no `align-self` of its own; every
 *    engine then draws the Figma box's position. INVERSE: the proposer never
 *    reads it back — it is chrome of the flag, like the ring's `border: 0`.
 *  · The trailing tracking is MEASURED, not assumed: CSS `letter-spacing` is
 *    added after every character including the last. On the committed REST
 *    fixtures rendered in Chromium with the fonts loaded: Eventz Kicker,
 *    Manrope 700 18 / 16 px, UPPER, 6 px tracking — Figma 95 / 87, ceil(all
 *    six spacings) 101 / 93, ceil(less the last) 95 / 87; Altitude Badge label,
 *    Public Sans 600 12 px, 1 px tracking — Figma 41, 42, 41. Only a px / em /
 *    rem LENGTH is subtracted: a `%` subtracts against the containing block
 *    (a -0.5 % token gave a box wider than Figma's), and a unitless value or
 *    `normal` makes `size - x` invalid at computed-value time, a silent no-op.
 *    Those are REFUSED by name (textBoxStaticRefusals for literals,
 *    textBoxTokenRefusals for a token, whose VALUE decides). So is tracking
 *    the part INHERITS from an ancestor holder while stating none of its own:
 *    a root's per-variant 2 px gave a 42 px box where Figma's is 40.
 *  · `calc-size()` is the only CSS that can round an INTRINSIC size. A
 *    browser without it drops the `inline-size` declaration at parse (or
 *    ignores the CSSOM assignment, the inline surface) and keeps today's
 *    fractional box: under 1 px narrower than Figma's. That is NOT "no
 *    different layout" in every context — see align-self above, which is why
 *    that declaration exists — but it is never wider and never a wrap change.
 *  · Logical properties, so vertical and RTL writing round and clamp the axis
 *    the text runs along.
 *  · The element must be BLOCK-LEVEL for `inline-size` to apply: every emitter
 *    blockifies a text part inside a flex / grid parent or an absolutely
 *    placed one. A parent declared `display: block` / `inline` / `contents`
 *    (or a non-structural text parent), and a part declared `display: inline`
 *    or `contents`, make the rule a silent no-op there — REFUSED by name.
 *
 *  Emitted only when a part carries the fact — every other contract keeps
 *  its bytes. TO REVERSE: delete the three wholePixelTextBoxDecls pushes
 *  (css.ts ×2, emit-wc.ts) and the inline assignment (emit-react-inline.ts). */
export const WHOLE_PIXEL_TEXT_BOX_BASIS = 'fit-content';
/** The part owns text of its own — the only kind of part the fact qualifies. */
export function partOwnsText(part: Part): boolean {
  return part.text !== undefined || part.content !== undefined || part.textByProp !== undefined;
}
/** The part carries the whole-pixel text-box fact. */
export function drawsWholePixelTextBox(part: Part): boolean {
  return part.textAutoResize === 'WIDTH_AND_HEIGHT';
}
type Holder = Record<string, unknown> | undefined;
/** Every channel → value map a part can carry, split into the BASE holders
 *  and the per-variant / per-state ones. */
function textHolders(part: Part): { base: Holder[]; perValue: Holder[] } {
  return {
    base: [part.tokens, part.literals, part.declared],
    perValue: [
      ...Object.values(part.states ?? {}), ...Object.values(part.declaredStates ?? {}),
      ...(Array.isArray(part.tokensByProp) ? part.tokensByProp : part.tokensByProp ? [part.tokensByProp] : []).flatMap((e) => Object.values(e.map)),
      ...(part.literalsByProp ?? []).flatMap((e) => Object.values(e.map)),
      ...(part.statesByProp ?? []).flatMap((e) => Object.values(e.map)),
      ...(part.stylesWhen ?? []).map((sw) => sw.styles),
    ],
  };
}
const holds = (hs: Holder[], channel: string | RegExp) =>
  hs.some((h) => h !== undefined && Object.keys(h).some((k) => (typeof channel === 'string' ? k === channel : channel.test(k))));
/** A tracking value that is only a zero adds nothing after the last glyph. */
const ZERO_LENGTH = /^[-+]?(0+\.?0*|\.0+)(px|em|rem|%)?$/;
/** A tracking LENGTH `size - x` can subtract: px / em / rem. */
const TRACKING_LENGTH = /^[-+]?(\d+\.?\d*|\.\d+)(px|em|rem)$/;
/** The part's own uniform letter spacing as the base holders spell it: a
 *  literal verbatim, a token as its `{ref}` (letter-spacing is a literal /
 *  token channel, never a declared one). A zero literal reads as none. */
export function textBoxLetterSpacing(part: Part): { kind: 'literal'; value: string } | { kind: 'token'; ref: string } | undefined {
  const literal = part.literals?.['letter-spacing'];
  if (literal !== undefined) {
    const v = String(literal).trim();
    return ZERO_LENGTH.test(v) ? undefined : { kind: 'literal', value: v };
  }
  const token = part.tokens?.['letter-spacing'];
  return token !== undefined ? { kind: 'token', ref: stripBraces(token) } : undefined;
}
/** Channels that size, fill or truncate the box instead of letting the text
 *  size it — a box carrying one of these is not `WIDTH_AND_HEIGHT`. `min-*`
 *  and `max-*` are not listed: Figma's auto-width text can carry a min/max
 *  and CSS clamps `inline-size` by them the same way. */
const TEXT_BOX_CONFLICT_CHANNEL = /^(width|inline-size|flex|flex-grow|flex-basis|text-overflow|-webkit-line-clamp|line-clamp)$/;
/** Every channel (and `layout.grow`) on the part that contradicts the fact,
 *  sorted — empty when the box is sized by its text alone. A `letter-spacing`
 *  that varies by variant or state, or rides a placeholder token, is listed
 *  too: the trailing tracking the box must shed has no single spelling then. */
export function textBoxConflicts(part: Part): string[] {
  const { base, perValue } = textHolders(part);
  const channels = new Set([...base, ...perValue].flatMap((h) => Object.keys(h ?? {})).filter((c) => TEXT_BOX_CONFLICT_CHANNEL.test(c)));
  if (part.layout?.grow) channels.add('layout.grow');
  if (holds(perValue, 'letter-spacing')) channels.add('letter-spacing (per variant or state)');
  const ls = textBoxLetterSpacing(part);
  if (ls?.kind === 'token' && placeholdersIn(ls.ref).length > 0) channels.add('letter-spacing (placeholder token)');
  return [...channels].sort();
}
const FLEX_OR_GRID = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);
const BLOCK_LEVEL = new Set(['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'flow-root', 'list-item', 'table']);
const partAt = (contract: Contract, path: string[]): Part | undefined => {
  let part: Part | undefined = contract.anatomy[path[0]!];
  for (const name of path.slice(1)) part = part?.parts?.[name];
  return part;
};
const absolutelyPlaced = (part: Part) =>
  part.overlay !== undefined || ['absolute', 'fixed'].includes(String(part.declared?.['position'] ?? ''));
/** The display the emitters give a PARENT part (css.ts / emit-wc.ts): a
 *  declared display wins; a single root with no layout is inline-flex; a
 *  structural part is its layout's display, flex by default; a text-bearing
 *  or leaf parent gets none (its element's own, inline for a span). */
function parentDisplay(contract: Contract, path: string[], parent: Part): string | undefined {
  const declared = parent.declared?.['display'];
  if (declared !== undefined) return String(declared);
  const singleRoot = path.length === 1 && Object.keys(contract.anatomy).length === 1;
  if (singleRoot) return parent.layout ? parent.layout.display ?? 'flex' : 'inline-flex';
  return isStructural(parent) ? parent.layout?.display ?? 'flex' : undefined;
}
/** Everything that makes the fact wrong or inert on this part, decidable
 *  from the contract alone (no token VALUES) — validateContract refuses each
 *  by name, and the proposer withdraws a flag that would draw one. */
export function textBoxStaticRefusals(contract: Contract, part: Part, path: string[]): string[] {
  const out: string[] = [];
  if (path.length === 1) {
    out.push("is a top-level root — the whole-pixel text box qualifies a text part's own element; a root's box is its padding plus its content");
    return out;
  }
  if (!partOwnsText(part)) out.push('owns no text (no text / content / textByProp) — the fact qualifies a text box and qualifies nothing here');
  const conflicts = textBoxConflicts(part);
  if (conflicts.length > 0) out.push(`carries ${conflicts.join(', ')} — a box that is sized, filled or truncated by a channel is not sized by its text; remove the flag or the channel`);
  const ls = textBoxLetterSpacing(part);
  if (ls?.kind === 'literal' && !TRACKING_LENGTH.test(ls.value)) {
    out.push(`carries letter-spacing ${JSON.stringify(ls.value)}, which is not a px / em / rem length — the trailing tracking the box must shed cannot be subtracted from its size (a % resolves against the containing block, a unitless value invalidates the declaration)`);
  }
  // Inherited tracking: an ancestor that states letter-spacing anywhere, and
  // a part that states none of its own in its base holders, inherits it —
  // and the box would round the glyph run PLUS a trailing spacing nobody
  // subtracts.
  const own = textHolders(part);
  if (!holds(own.base, 'letter-spacing')) {
    const from: string[] = [];
    for (let i = path.length - 1; i >= 1; i--) {
      const ancestor = partAt(contract, path.slice(0, i));
      if (!ancestor) continue;
      const { base, perValue } = textHolders(ancestor);
      if (holds([...base, ...perValue], 'letter-spacing')) from.push(path[i - 1]!);
    }
    if (from.length > 0) out.push(`inherits letter-spacing from ${from.map((n) => `"${n}"`).join(', ')} and states none of its own — the trailing tracking the box must shed is not the part's to subtract; state the tracking on the text part or remove the flag`);
  }
  // Inline-level: `inline-size` does nothing on an inline box.
  const ownDisplay = part.declared?.['display'] === undefined ? undefined : String(part.declared['display']);
  if (ownDisplay === 'inline' || ownDisplay === 'contents') {
    out.push(`declares display: ${ownDisplay} — inline-size does not apply to that box, so the whole-pixel box would silently do nothing`);
  } else if (!absolutelyPlaced(part) && !(ownDisplay !== undefined && BLOCK_LEVEL.has(ownDisplay))) {
    const parentPath = path.slice(0, -1);
    const parent = partAt(contract, parentPath);
    const display = parent ? parentDisplay(contract, parentPath, parent) : undefined;
    if (display === undefined || !FLEX_OR_GRID.has(display)) {
      out.push(`sits in a parent laid out as ${display === undefined ? 'no flex or grid box' : `display: ${display}`} — the text element is inline-level there and inline-size does not apply, so the whole-pixel box would silently do nothing; give the parent a flex / grid layout or the part a block-level display`);
    }
  }
  return out;
}
/** Resolve a token path to its VALUE in every mode the DTCG trees carry
 *  (light and dark over primitives + brand + semantic), as CSS text. */
function tokenModeValues(tokens: unknown, path: string): Array<string | undefined> {
  const t = tokens as Partial<TokenTreeInput> | undefined;
  if (!t || typeof t !== 'object' || !t.primitives) return [];
  const flat = (tree: Record<string, unknown> | undefined) => (tree ? flattenTokens(tree) : new Map());
  const base = [...flat(t.primitives), ...flat(t.brands?.default), ...flat(t.semantic)];
  return [new Map([...base, ...flat(t.light)]), new Map([...base, ...flat(t.dark)])].map((m) => {
    try { return trackingText(makeResolveLiteral(m)(path)); } catch { return undefined; }
  });
}
/** A resolved DTCG value as CSS text: a number stays unitless (and is then
 *  refused), a `{ value, unit }` dimension is joined. */
function trackingText(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && 'value' in v && 'unit' in v) return `${(v as { value: unknown }).value}${(v as { unit: unknown }).unit}`;
  return undefined;
}
/** A flagged part's letter-spacing TOKEN is spelled into the calc as its
 *  var(), so its VALUE decides whether `size - var(--x)` is valid: every mode
 *  must resolve to a px / em / rem length (`0px` included; a unitless `0`
 *  is a number, not a length). No values → refused, the
 *  settleStrokeShadows precedent: the deciding fact cannot be read from a
 *  path. One message per offending part. */
export function textBoxTokenRefusals(contract: Contract, tokens: unknown): string[] {
  const out: string[] = [];
  for (const { name, part } of walkAnatomy(contract)) {
    if (!drawsWholePixelTextBox(part)) continue;
    const ls = textBoxLetterSpacing(part);
    if (ls?.kind !== 'token' || placeholdersIn(ls.ref).length > 0) continue;
    if (tokens === undefined || tokens === null) {
      out.push(`${contract.id}: part "${name}" carries textAutoResize and binds letter-spacing to {${ls.ref}}, and no token VALUES were supplied — whether \`size - var(…)\` is valid depends on the token's unit, which cannot be checked from the path; pass the DTCG trees`);
      continue;
    }
    const values = tokenModeValues(tokens, ls.ref);
    // `0px` is a length and subtracts nothing; a unitless `0` is a number and
    // invalidates `size - var(…)` — so the unit decides, not the magnitude.
    if (values.length === 0 || values.some((v) => v === undefined || !TRACKING_LENGTH.test(v))) {
      out.push(`${contract.id}: part "${name}" carries textAutoResize and binds letter-spacing to {${ls.ref}}, which resolves to ${[...new Set(values.map((v) => v ?? 'nothing'))].join(' / ')} — only a px / em / rem length can be subtracted before rounding (a % resolves against the containing block, a unitless value or \`normal\` invalidates the declaration: a silent no-op); state the tracking as a length or remove the flag`);
    }
  }
  return out;
}
/** The declarations a flagged part's base rule carries. `tokenCss` spells a
 *  token path the way the surface reads tokens (`var(--x)` on a stylesheet,
 *  the resolved literal on the inline surface). Refusals are decided by
 *  validateContract / textBoxTokenRefusals before any rule is written. */
export function wholePixelTextBoxDecls(contract: Contract, part: Part, path: string[], tokenCss: (tokenPath: string) => string): string[] {
  const ls = textBoxLetterSpacing(part);
  const trim = ls === undefined ? '' : ` - ${ls.kind === 'token' ? tokenCss(ls.ref) : ls.value}`;
  const decls = [`inline-size: calc-size(${WHOLE_PIXEL_TEXT_BOX_BASIS}, round(up, size${trim}, 1px))`];
  const { base, perValue } = textHolders(part);
  if (!holds([...base, ...perValue], /^max-(width|inline-size)$/)) decls.push('max-inline-size: 100%');
  const parent = partAt(contract, path.slice(0, -1));
  if (
    parent && !absolutelyPlaced(part) && part.declared?.['align-self'] === undefined &&
    parent.layout !== undefined && parent.layout.display !== 'grid' && parent.declared?.['display'] === undefined &&
    /^column/.test(parent.layout.direction ?? '') &&
    (parent.layout.align === undefined || parent.layout.align === 'stretch') &&
    parent.layoutByProp === undefined
  ) decls.push('align-self: flex-start');
  return decls;
}
/** The same declarations, looked up by part object — for emitters whose part
 *  loop does not carry the anatomy path. */
export function wholePixelTextBoxPlan(contract: Contract, tokenCss: (tokenPath: string) => string): Map<Part, string[]> {
  const plan = new Map<Part, string[]>();
  for (const { part, path } of walkAnatomy(contract)) {
    if (drawsWholePixelTextBox(part) && path.length > 1) plan.set(part, wholePixelTextBoxDecls(contract, part, path, tokenCss));
  }
  return plan;
}

export function noneShadowVars(tokens: unknown): { none: Set<string>; mixed: Set<string> } {
  const out = { none: new Set<string>(), mixed: new Set<string>() };
  const t = tokens as Partial<TokenTreeInput> | undefined;
  if (!t || typeof t !== 'object' || !t.primitives) return out;
  const flat = (tree: Record<string, unknown> | undefined) => (tree ? flattenTokens(tree) : new Map());
  const base = [...flat(t.primitives), ...flat(t.brands?.default), ...flat(t.semantic)];
  const modes = [new Map([...base, ...flat(t.light)]), new Map([...base, ...flat(t.dark)])];
  for (const path of new Set(modes.flatMap((m) => [...m.keys()]))) {
    const seen = modes.filter((m) => m.has(path)).map((m) => {
      try { const v = makeResolveLiteral(m)(path); return typeof v === 'string' && v.trim() === 'none'; } catch { return false; }
    });
    if (!seen.some(Boolean)) continue;
    (seen.every(Boolean) ? out.none : out.mixed).add(cssVar(path).slice(4, -1));
  }
  return out;
}
export function settleStrokeShadows(css: string, tokens: unknown, errors: string[], contractId: string): string {
  if (!css.includes(`${STROKE_SHADOW_VAR}:`)) return css;
  const bound = [...new Set(Array.from(css.matchAll(new RegExp(`${STROKE_SHADOW_VAR}:\\s*var\\((--[\\w-]+)\\)`, 'g')), (m) => m[1]))];
  if (bound.length > 0 && (tokens === undefined || tokens === null)) {
    errors.push(`${contractId}: a part with strokesIncludedInLayout: false binds box-shadow to ${bound.join(', ')}, and no token VALUES were supplied — if one resolves to \`none\` the composed \`<ring>, none\` is invalid CSS and the stroke vanishes with the shadow, which cannot be checked from token paths alone; pass the DTCG trees (EmitCtx.tokenValues / WcEmitCtx.tokenValues / generateCss's fourth argument)`);
    return css;
  }
  const { none, mixed } = noneShadowVars(tokens);
  return css.replace(new RegExp(`(${STROKE_SHADOW_VAR}:\\s*)var\\((--[\\w-]+)\\)`, 'g'), (whole, lead: string, name: string) => {
    if (mixed.has(name)) {
      errors.push(`${contractId}: a part with strokesIncludedInLayout: false binds box-shadow to ${name}, which resolves to \`none\` in one mode and to a shadow in the other — the inset ring and the shadow share ONE box-shadow value and \`<ring>, none\` is invalid CSS, so this token has no single spelling there; give the token a zero shadow instead of \`none\`, or remove the flag`);
      return whole;
    }
    return none.has(name) ? `${lead}${NO_SHADOW}` : whole;
  });
}

export const isStructural = (part: Part) =>
  Boolean(part.parts || part.slot || part.layout || part.layoutByProp) &&
  !part.content &&
  !part.component;

/** CSS declarations for a layoutByProp override (v7). Reversed directions
 *  are plain CSS here; the canvas resolves them by reversing child order. */
export function layoutOverrideDecls(o: {
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


/** The DIRECT holder of the part at `path` declares `position` (so it is the
 *  positioning context for an out-of-flow child). Root-level parts (holder =
 *  the root itself) return false so the root keeps its own anchor push. */
export function holderDeclaresPosition(contract: Contract, path: string[]): boolean {
  if (path.length < 3) return false;
  let cur: Part | undefined = contract.anatomy[path[0]];
  for (const seg of path.slice(1, -1)) cur = cur?.parts?.[seg];
  return cur?.declared?.['position'] !== undefined;
}
