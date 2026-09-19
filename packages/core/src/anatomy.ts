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
import { DEFAULT_FONT_STACK, slotsOf, type Contract, type Part, type Prop } from '@ds-contracts/schema';
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
