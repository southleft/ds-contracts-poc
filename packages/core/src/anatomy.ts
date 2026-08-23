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
import { slotsOf, type Contract, type Part, type Prop } from '@ds-contracts/schema';


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
