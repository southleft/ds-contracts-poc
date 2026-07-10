/**
 * DESIGN → CONTRACT — the PURE core of extract/figma/propose.ts.
 *
 * proposeFromDump inverts a node-tree dump of a drawn component set into a
 * full proposed contract (API + anatomy + token bindings). All inversion
 * rules live here, moved verbatim from the extractor; the CLI shell
 * (extract/figma/propose.ts) owns file IO and re-exports this module, so
 * the round-trip receipt (extract/figma/roundtrip.ts) referees the same
 * code a browser playground imports. No node:* imports.
 *
 * See the original module doc in extract/figma/propose.ts for the complete
 * inversion-rule catalogue (LAYOUT / TOKENS / ENUM SUBST / TEXT / PROPS /
 * SLOTS / INSTANCES / STATES).
 *
 * MINTING (opt-in, `mintUnbound: true`): when an import cannot resolve
 * variable names (the variables endpoint is Enterprise-only) every bound
 * fact degrades to a resolved literal and the classic pass only REPORTS it.
 * With minting on, those same observations become bindings to provisional
 * `imported.*` tokens (core/mint-tokens.ts) returned on the result as
 * `mintedTokens` — styles survive at literal fidelity, names stay mechanical
 * and reviewable, semantics are never guessed.
 */
import { ContractSchema, pascal, STATE_PREVIEW_PROPERTY, statePreviewLabel } from '../scripts/contract-schema.js';
import { kebab } from '../extract/types.js';
import type { DumpEffect, DumpNode, DumpSet } from '../extract/figma/types.js';
import type { TokenCorpus } from './token-corpus.js';
import { mintTokens, type MintAxis, type MintObservation, type MintedEntry } from './mint-tokens.js';

// ---------------------------------------------------------------------------
// Shared spellings
// ---------------------------------------------------------------------------

/** Inverse of extract/types.ts titleCase: "Show Actions" → "showActions". */
export const camel = (s: string): string =>
  s
    .trim()
    .split(/[\s_-]+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

const dotPath = (slashName: string) => slashName.split('/').join('.');
const ref = (slashName: string) => `{${dotPath(slashName)}}`;

/** Canonical prop-name spelling for a Figma property name. A property that is
 *  ALREADY a legal camelCase identifier is kept verbatim — foreign kits ship
 *  "hasEndIcon" / "isDisabled", and camel() (which lowercases whole words)
 *  would mangle them into spellings nobody owns ("hasendicon"). Everything
 *  else ("Show Actions", "Variant", "Label") goes through camel() as before.
 *  Characters outside a legal identifier are STRIPPED first — foreign kits
 *  ship emoji-prefixed properties ("✏️text", "↪️icon-left"; field case:
 *  CBDS Button) and the honest move is to sanitize AT PROPOSAL, keeping the
 *  original spelling as the design binding (bindings.figma.property), not to
 *  refuse at emit. The "#id" suffix non-variant properties carry is never
 *  part of the name. */
export const canonicalPropName = (property: string): string => {
  const bare = property.split('#')[0].trim();
  if (/^[a-z][A-Za-z0-9]*$/.test(bare)) return bare;
  return camel(bare.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim());
};

/** True when canonicalPropName had to strip characters — the note trigger. */
export const propNameSanitized = (property: string): boolean =>
  /[^A-Za-z0-9 _-]/.test(property.split('#')[0].trim());

/** Contract name for a drawn set: PascalCase over the alphanumeric words.
 *  "Button-Brand Primary" → "ButtonBrandPrimary", "Button group" →
 *  "ButtonGroup" — the emitters make the name an exported component and its
 *  file names, so an unsanitized set name is a guaranteed emit refusal. The
 *  canvas set keeps its own name; identity anchors are componentSetKey/nodeId. */
export const pascalComponentName = (setName: string): string =>
  setName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

/** The slice of a child contract canonicalization needs — kept minimal so the
 * playground can pass its bundled contracts without importing the zod types. */
export interface MinimalChildContract {
  id: string;
  props: Array<{ name: string; bindings: { figma: { property?: string; values?: Record<string, string> } } }>;
}

// ---------------------------------------------------------------------------
// Variant axes
// ---------------------------------------------------------------------------

interface Axis {
  property: string;
  propName: string;
  /** Figma option values, first = the set's default (the generator emits the
   *  all-defaults combo first and Figma's default variant is positional). */
  values: string[];
}

const axisValuesOf = (variantName: string): Record<string, string> => {
  if (!variantName.includes('=')) return {};
  const out: Record<string, string> = {};
  for (const pair of variantName.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v !== undefined) out[k] = v;
  }
  return out;
};

function parseAxes(variantNames: string[]): Axis[] {
  const axes: Axis[] = [];
  for (const name of variantNames) {
    for (const [property, value] of Object.entries(axisValuesOf(name))) {
      let axis = axes.find((a) => a.property === property);
      if (!axis) {
        axis = { property, propName: canonicalPropName(property), values: [] };
        axes.push(axis);
      }
      if (!axis.values.includes(value)) axis.values.push(value);
    }
  }
  return axes;
}

/** Mirror of extract/reconcile.ts isBoolAxis: only a literal true/false axis
 *  is a boolean modeled the canvas way. Off/On, Yes/No etc. stay enums. */
const isBoolAxis = (options: string[]): boolean => {
  const set = new Set(options.map((o) => o.trim().toLowerCase()));
  return set.size === 2 && set.has('true') && set.has('false');
};

// ---------------------------------------------------------------------------
// Interaction-state axis promotion (field case: CBDS "Button-Brand Primary",
// axes size × state where state = default|hover|focus|pressed|disabled).
//
// A drawn "state" enum axis is NOT API — those states are what the platform
// RUNS (:hover / :active / :focus-visible / native disabled). Shipping the
// axis as a code prop is the drift pattern applied forward; this promotes it
// backward into the vocabulary the code side already owns:
//
//   value → contract state   hover → hover · pressed/active → active ·
//                            focus/focus-visible → focus-visible
//   default                  the BASE: anatomy and base facts are built from
//                            the default-state variants only
//   disabled                 a `disabled` BOOLEAN prop (native attribute on
//                            interactive elements) + a `disabled` state block
//
// Root-level channel diffs against the matching default-state variant become
// anatomy.root.states overrides — bound facts as (substituted) refs, raw
// literals through the SAME mint pass as base facts, so an override that
// varies with a remaining enum axis takes the substituted-ref shape the code
// extractor already produces. Round trip: figmaStatePreviews is set when the
// promoted states carry overrides, so the canvas regeneration draws a State
// preview axis — a RENAME relative to the import (property "State", values
// Default/Hover/Active/Focus Visible per statePreviewLabel; disabled becomes
// BOOLEAN property "Disabled"): the vocabulary carries no custom state-axis
// spellings, and the rename is DOCUMENTED in a note, never silent.
// ---------------------------------------------------------------------------

const INTERACTION_STATE_BY_VALUE: Record<string, 'default' | 'hover' | 'active' | 'focus-visible' | 'disabled'> = {
  default: 'default',
  hover: 'hover',
  active: 'active',
  pressed: 'active',
  focus: 'focus-visible',
  'focus-visible': 'focus-visible',
  disabled: 'disabled',
};
const normStateValue = (v: string) => v.trim().toLowerCase().replace(/[\s_]+/g, '-');

type PromotedState = 'hover' | 'active' | 'focus-visible';

export interface StatePromotion {
  axis: Axis;
  /** Figma value spelling of the base state. */
  defaultValue: string;
  /** Figma value → contract state (base and disabled excluded). */
  promoted: Array<{ value: string; state: PromotedState }>;
  /** Figma value that maps to the disabled state, when present. */
  disabledValue?: string;
}

/** Detect an enum axis that IS interaction states. Rules (documented table):
 *  every value maps into the interaction-state vocabulary above, a "default"
 *  value exists (the base to diff against), and there is at least one
 *  promotable non-default value — with ≥2 non-default values required when
 *  the axis is NOT named `state`/`states` (an unnamed single-state axis is
 *  weak evidence). Near-misses on a NAMED axis are noted, never guessed. */
function detectStateAxis(axes: Axis[], notes: string[]): StatePromotion | null {
  for (const axis of axes) {
    if (isBoolAxis(axis.values)) continue;
    const named = /^states?$/i.test(axis.property.trim());
    const unmapped = axis.values.filter((v) => INTERACTION_STATE_BY_VALUE[normStateValue(v)] === undefined);
    if (unmapped.length > 0) {
      if (named) {
        notes.push(
          `variant axis "${axis.property}": named like an interaction-state axis but value(s) ${unmapped.join(', ')} are outside the interaction-state vocabulary (default|hover|focus|focus-visible|active|pressed|disabled) — kept as an enum prop, review`,
        );
      }
      continue;
    }
    const mapped = axis.values.map((value) => ({ value, state: INTERACTION_STATE_BY_VALUE[normStateValue(value)]! }));
    const defaultValue = mapped.find((m) => m.state === 'default')?.value;
    const nonDefault = mapped.filter((m) => m.state !== 'default');
    if (defaultValue === undefined || nonDefault.length === 0) {
      if (named) {
        notes.push(
          `variant axis "${axis.property}": carries interaction-state values but no default/non-default split to promote — kept as an enum prop, review`,
        );
      }
      continue;
    }
    if (!named && nonDefault.length < 2) continue;
    const promoted: StatePromotion['promoted'] = [];
    let disabledValue: string | undefined;
    for (const m of nonDefault) {
      if (m.state === 'disabled') {
        disabledValue = m.value;
        continue;
      }
      const prior = promoted.find((p) => p.state === m.state);
      if (prior) {
        notes.push(
          `variant axis "${axis.property}": values "${prior.value}" and "${m.value}" both map to contract state "${m.state}" — "${m.value}" is not promoted, review`,
        );
        continue;
      }
      promoted.push({ value: m.value, state: m.state as PromotedState });
    }
    return { axis, defaultValue, promoted, disabledValue };
  }
  return null;
}

/** "size=large, state=default" minus the state axis → "size=large"; a name
 *  left with no pairs falls back (standalone-component semantics). */
function stripAxisFromName(name: string, property: string, fallback: string): string {
  if (!name.includes('=')) return name;
  const pairs = name
    .split(',')
    .map((s) => s.trim())
    .filter((pair) => pair.split('=')[0].trim() !== property);
  return pairs.length > 0 ? pairs.join(', ') : fallback;
}

// ---------------------------------------------------------------------------
// Semantics inference — deterministic, bounded, NOTED. The canvas draws no
// element/role, but a component-set NAME plus structure carries signal a
// reviewer should not have to re-derive ("this is a freaking button"). The
// full table, checked in order (every hit is a named note; no hit → the
// existing "div" hedge). Zero AI involvement — a pure string/axis table.
//
//   name contains…            → element (all in the emitters' vocabulary)
//   group                     → NO match (containers of the named element)
//   button | btn              → button
//   link                      → a
//   tooltip                   → div + role "tooltip"
//   heading | title + a level axis (values 1–6 / h1–h6)
//                             → h<default> + elementByProp over the axis
//   switch | toggle           → input + role "switch"
//   checkbox                  → input (type attr not canvas-recoverable)
//   textarea                  → textarea
//   select | dropdown         → select
//   input | textfield         → input
//   (no name signal) + a detected interaction-state axis
//                             → button (state axes imply interactivity)
// ---------------------------------------------------------------------------

export interface InferredSemantics {
  element: string;
  role?: string;
  elementByProp?: { prop: string; map: Record<string, string> };
  note: string;
}

export function inferSemantics(setName: string, axes: Axis[], interactive: boolean): InferredSemantics | null {
  const review = (what: string): string =>
    `semantics: ${what} inferred from the set name "${setName}" — inference is mechanical (name/axis table), review`;
  // "Button Group" / "Link Group" are CONTAINERS of the named element, not
  // the element (a root <button> holding buttons is invalid HTML) — no match.
  if (/\bgroup\b/i.test(setName)) return null;
  if (/\b(button|btn)\b/i.test(setName)) {
    return { element: 'button', note: review('element "button"') };
  }
  if (/\blink\b/i.test(setName)) {
    return { element: 'a', note: review('element "a" ("link")') };
  }
  if (/\btooltip\b/i.test(setName)) {
    return { element: 'div', role: 'tooltip', note: review('element "div" + role "tooltip"') };
  }
  if (/\b(heading|title)\b/i.test(setName)) {
    const level = axes.find(
      (a) => /^levels?$/i.test(a.property.trim()) && !isBoolAxis(a.values) && a.values.every((v) => /^h?[1-6]$/i.test(v.trim())),
    );
    if (level) {
      const heading = (v: string) => `h${v.trim().replace(/^h/i, '')}`;
      return {
        element: heading(level.values[0]),
        elementByProp: {
          prop: level.propName,
          map: Object.fromEntries(level.values.map((v) => [camel(v), heading(v)])),
        },
        note: review(`heading semantics (element "${heading(level.values[0])}" + elementByProp over the "${level.property}" axis)`),
      };
    }
    return null; // "title"/"heading" without a level axis is too ambiguous
  }
  if (/\b(switch|toggle)\b/i.test(setName)) {
    return { element: 'input', role: 'switch', note: review('element "input" + role "switch"') };
  }
  if (/\bcheckbox\b/i.test(setName)) {
    return {
      element: 'input',
      note: review('element "input" ("checkbox"; the type="checkbox" attribute is not canvas-recoverable — author it)'),
    };
  }
  if (/\btext\s?area\b/i.test(setName)) {
    return { element: 'textarea', note: review('element "textarea"') };
  }
  if (/\b(select|dropdown)\b/i.test(setName)) {
    return { element: 'select', note: review('element "select"') };
  }
  if (/\b(input|text\s?field)\b/i.test(setName)) {
    return { element: 'input', note: review('element "input"') };
  }
  if (interactive) {
    return {
      element: 'button',
      note: `semantics: element "button" inferred STRUCTURALLY — the set carries an interaction-state variant axis (hover/pressed/… are platform states of an interactive element) and the name gave no signal; review`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cross-variant merge
// ---------------------------------------------------------------------------

interface Occ {
  variant: string;
  node: DumpNode;
}

interface Merged {
  name: string;
  type: string;
  occ: Occ[];
  children: Merged[];
}

/** Order-preserving union of per-variant child-name sequences: Off's
 *  [thumb, spacerEnd] and On's [spacerStart, thumb] merge to
 *  [spacerStart, thumb, spacerEnd]. */
export function mergeOrders(sequences: string[][]): string[] {
  const result: string[] = [];
  for (const seq of sequences) {
    let insertAt = 0;
    for (const name of seq) {
      const idx = result.indexOf(name);
      if (idx >= 0) {
        insertAt = idx + 1;
        continue;
      }
      result.splice(insertAt, 0, name);
      insertAt++;
    }
  }
  return result;
}

/** Sibling merge keys: same-named siblings get ordinal-tagged keys, so a
 *  start icon and an end icon both drawn as "Icon" merge as TWO children —
 *  merging by bare name would silently collapse them into one (field case:
 *  Eventz Button, whose startIcon/endIcon instances share the name "Icon"). */
const siblingKeys = (children: DumpNode[]): string[] => {
  const counts = new Map<string, number>();
  return children.map((c) => {
    const n = counts.get(c.name) ?? 0;
    counts.set(c.name, n + 1);
    return n === 0 ? c.name : `${c.name}\u0000${n}`;
  });
};

function mergeOcc(name: string, occ: Occ[], notes: string[], where: string): Merged {
  const types = [...new Set(occ.map((o) => o.node.type))];
  if (types.length > 1) {
    notes.push(`${where}: node type differs across variants (${types.join(', ')}) — using ${types[0]}`);
  }
  const sequences = occ.map((o) => siblingKeys(o.node.children ?? []));
  const order = mergeOrders(sequences);
  const nameCount = new Map<string, number>();
  for (const key of order) {
    const childName = key.split('\u0000')[0];
    nameCount.set(childName, (nameCount.get(childName) ?? 0) + 1);
  }
  const children = order.map((childKey) => {
    const [childName, ordStr] = childKey.split('\u0000');
    const ord = ordStr ? Number(ordStr) : 0;
    const childOcc: Occ[] = [];
    for (const o of occ) {
      const child = (o.node.children ?? []).filter((c) => c.name === childName)[ord];
      if (child) childOcc.push({ variant: o.variant, node: child });
    }
    // Duplicated sibling names need distinct merged names (they become note
    // paths and part keys): a swap-bound duplicate takes its INSTANCE_SWAP
    // property name ("Icon" → "startIcon"); anything else takes an ordinal.
    let display = childName;
    if ((nameCount.get(childName) ?? 0) > 1) {
      const swap = [...new Set(childOcc.map((o) => o.node.propRefs?.mainComponent).filter((v) => v !== undefined))];
      display = swap.length === 1 ? swap[0]! : ord === 0 ? childName : `${childName} ${ord + 1}`;
    }
    return mergeOcc(display, childOcc, notes, `${where}/${display}`);
  });
  return { name, type: types[0], occ, children };
}

// ---------------------------------------------------------------------------
// Token-ref unification (literal / enum-substituted / drift)
// ---------------------------------------------------------------------------

type Unified =
  | { kind: 'none' }
  | { kind: 'ref'; ref: string }
  | { kind: 'drift'; detail: string };

function unifyRefs(
  obs: Array<{ variant: string; path?: string }>,
  axes: Axis[],
): Unified {
  const defined = obs.filter((o): o is { variant: string; path: string } => o.path !== undefined);
  if (defined.length === 0) return { kind: 'none' };
  // A variable name must survive as a legal token ref. Foreign vocabularies
  // hold surprises — Eventz ships a variable named "spacing/0․5" whose middle
  // character is U+2024 ONE DOT LEADER, not a dot — and an illegal ref must be
  // refused by name here, not crash schema validation downstream.
  const illegal = defined.find((o) => !/^[a-z0-9.-]+$/i.test(o.path));
  if (illegal) {
    return {
      kind: 'drift',
      detail: `variable name "${illegal.path.split('.').join('/')}" contains characters outside the token-ref grammar ([a-z0-9.-]) — binding not proposed; rename the variable or map it manually`,
    };
  }
  if (defined.length !== obs.length) {
    return {
      kind: 'drift',
      detail: `bound in ${defined.length}/${obs.length} variants (${defined.map((o) => o.variant).join(', ')}) — inconsistent, not proposed`,
    };
  }
  const distinct = [...new Set(defined.map((o) => o.path))];
  if (distinct.length === 1) return { kind: 'ref', ref: `{${distinct[0]}}` };

  const segs = defined.map((o) => o.path.split('.'));
  const len = segs[0].length;
  if (segs.some((s) => s.length !== len)) {
    return { kind: 'drift', detail: `token paths differ in depth: ${distinct.join(' vs ')}` };
  }
  const diffIdx: number[] = [];
  for (let i = 0; i < len; i++) {
    if (new Set(segs.map((s) => s[i])).size > 1) diffIdx.push(i);
  }
  if (diffIdx.length === 1) {
    const i = diffIdx[0];
    for (const axis of axes) {
      const fits = defined.every((o, k) => {
        const value = axisValuesOf(o.variant)[axis.property];
        return value !== undefined && segs[k][i] === camel(value);
      });
      if (fits) {
        const parts = [...segs[0]];
        parts[i] = `{${axis.propName}}`;
        return { kind: 'ref', ref: `{${parts.join('.')}}` };
      }
    }
  }
  return {
    kind: 'drift',
    detail: `bindings differ across variants without correlating to any variant axis: ${distinct.join(' vs ')}`,
  };
}

// ---------------------------------------------------------------------------
// Proposal state
// ---------------------------------------------------------------------------

export interface UnboundValue {
  nodePath: string;
  property: string;
  value: string | number;
  suggestions: string[];
}

export interface FigmaProposalResult {
  contract: Record<string, unknown>;
  notes: string[];
  unbound: UnboundValue[];
  /** Present only when proposeFromDump ran with `mintUnbound: true` and at
   *  least one leaf was minted: the provisional DTCG tree the proposal's
   *  minted refs resolve through (register it as an ADDITIONAL token source —
   *  tokenInventoryFromJson accepts multiple trees), plus one entry per leaf.
   *  Every name is machine-derived and provisional — see core/mint-tokens.ts. */
  mintedTokens?: { tree: Record<string, unknown>; count: number; entries: MintedEntry[] };
  /** Auto-proposed STUB contracts for nested instances whose child contract
   *  is not in scope (field case: CBDS Button's ds.icon). Each parses against
   *  the contract schema; its API is the observed applied values ONLY and its
   *  anatomy is empty (dump v1 stops at instance boundaries — nothing about
   *  the child is guessed). Register them alongside the proposal so the
   *  emitters resolve the refs; replace each by importing the real child set. */
  childStubs?: Array<Record<string, unknown>>;
}

/** Minting capture (mintUnbound: true) — the observations the classic
 *  unbound pass would otherwise only REPORT, kept with per-variant values and
 *  a live reference to the tokens record they would have bound, so the
 *  post-build mint pass can turn them into bindings. */
interface MintCapture {
  /** Non-boolean enum axes, canonical spellings (substitution is enum-only). */
  axes: MintAxis[];
  axisValuesByVariant: Map<string, Record<string, string>>;
  observations: Array<MintObservation & { target: Record<string, string>; source?: string }>;
  /** Classic-unbound source keys (`nodePath|property`) NOT fully covered by
   *  observations (asymmetric padding, mixed var/raw paints) — their unbound
   *  entries survive minting. */
  partialSources: Set<string>;
  /** tokens records and their holders, so a record whose FIRST key arrives
   *  via minting still lands on the part. */
  attach: Array<{ holder: Record<string, unknown>; tokens: Record<string, string> }>;
}

interface Ctx {
  setName: string;
  axes: Axis[];
  totalVariants: string[];
  corpus: TokenCorpus;
  contractIdByName: Map<string, string>;
  contractsById?: Map<string, MinimalChildContract>;
  prefix: string;
  notes: string[];
  unbound: UnboundValue[];
  textProps: Array<{ name: string; property: string; default: string }>;
  boolProps: Array<{ name: string; property: string; default?: boolean }>;
  /** Slot parts in tree order, for the default-slot ("children") judgment. */
  slots: Array<{ part: Record<string, unknown>; property: string; optional: boolean }>;
  /** Variant names whose base instance was flattened into the variant root —
   *  a child absent ONLY there is a fidelity limit, not drift. */
  flattenedVariants: Set<string>;
  /** Nested instances whose child contract is not in scope, keyed by the
   *  stub contract id they will claim — turned into childStubs post-build. */
  stubs: Map<string, StubCapture>;
  mint?: MintCapture;
}

/** Captured evidence for one auto-proposed child contract stub. */
interface StubCapture {
  id: string;
  instanceOf: string;
  /** Every occurrence's applied componentProperties, across variants. */
  applied: Array<Record<string, string | boolean>>;
}

const first = <T>(occ: Occ[], pick: (n: DumpNode) => T | undefined): T | undefined => {
  for (const o of occ) {
    const v = pick(o.node);
    if (v !== undefined) return v;
  }
  return undefined;
};

function reportUnbound(ctx: Ctx, nodePath: string, property: string, value: string | number) {
  ctx.unbound.push({
    nodePath,
    property,
    value,
    suggestions: ctx.corpus.suggestFor(value).slice(0, 5),
  });
}

// ---------------------------------------------------------------------------
// Mint capture (mintUnbound) — record what the unbound pass observed
// ---------------------------------------------------------------------------

/** "Tooltip:root/body/label" → "body/label"; the root itself → "". */
const partPathOf = (where: string): string => {
  const i = where.indexOf(':root');
  return i >= 0 ? where.slice(i + ':root'.length).replace(/^\//, '') : '';
};

function mintObservation(
  ctx: Ctx,
  target: Record<string, string>,
  where: string,
  cssProperty: string,
  kind: 'color' | 'px' | 'number' | 'shadow',
  occ: Array<{ variant: string; value: string | number }>,
  source?: string,
) {
  if (!ctx.mint) return;
  ctx.mint.observations.push({
    nodePath: where,
    part: partPathOf(where),
    cssProperty,
    kind,
    occurrences: occ.map((o) => ({
      variant: o.variant,
      axisValues: ctx.mint!.axisValuesByVariant.get(o.variant) ?? {},
      value: o.value,
    })),
    target,
    source,
  });
}

const numOccurrences = (m: Merged, valueOf: (n: DumpNode) => number | undefined) =>
  m.occ.map((o) => ({ variant: o.variant, value: valueOf(o.node) ?? 0 }));

// ---------------------------------------------------------------------------
// Bindings → tokens
// ---------------------------------------------------------------------------

function unifyField(m: Merged, field: string, ctx: Ctx, where: string): string | undefined {
  const u = unifyRefs(
    m.occ.map((o) => ({ variant: o.variant, path: o.node.bound?.[field] ? dotPath(o.node.bound[field]) : undefined })),
    ctx.axes,
  );
  if (u.kind === 'ref') return u.ref;
  if (u.kind === 'drift') ctx.notes.push(`${where} ${field}: ${u.detail}`);
  return undefined;
}

/** Canvas paint → CSS color literal: '#rrggbb', or 8-digit '#rrggbbaa' when
 *  the paint carries alpha (dump v1.1). 8-digit hex is the ONE spelling that
 *  is simultaneously a legal DTCG color $value, a CSS color everywhere the
 *  pipeline speaks CSS (custom properties, inline styles, canvas fillStyle),
 *  and mechanically invertible to Figma's RGBA — rgba() would satisfy only
 *  the CSS surfaces and break the minted tree's DTCG typing. */
export const paintCssHex = (p: { hex?: string; alpha?: number }): string => {
  if (p.alpha === undefined || p.alpha >= 1) return `#${p.hex}`;
  const byte = Math.round(Math.max(0, Math.min(1, p.alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${p.hex}${byte}`;
};

function unifyPaint(
  m: Merged,
  pick: (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined,
  ctx: Ctx,
  where: string,
  paintName: string,
  mint?: { cssProperty: string; target: Record<string, string> },
): string | undefined {
  const paints = m.occ.map((o) => ({ variant: o.variant, paint: pick(o.node) }));
  if (paints.every((p) => p.paint === undefined)) return undefined;
  const raw = paints.find((p) => p.paint?.hex !== undefined);
  if (raw) {
    reportUnbound(ctx, where, paintName, paintCssHex(raw.paint!));
    if (ctx.mint && mint) {
      // Mintable only when EVERY variant resolved to a raw hex — a paint
      // missing in some variants, or half-bound, stays a report entry.
      if (paints.every((p) => p.paint?.hex !== undefined)) {
        mintObservation(
          ctx, mint.target, where, mint.cssProperty, 'color',
          paints.map((p) => ({ variant: p.variant, value: paintCssHex(p.paint!) })),
          `${where}|${paintName}`,
        );
      } else {
        ctx.mint.partialSources.add(`${where}|${paintName}`);
      }
    }
    return undefined;
  }
  const u = unifyRefs(
    paints.map((p) => ({ variant: p.variant, path: p.paint?.var ? dotPath(p.paint.var) : undefined })),
    ctx.axes,
  );
  if (u.kind === 'ref') {
    // A BOUND paint whose alpha < 1: the token ref carries the color, not
    // the paint's opacity — no place in the contract vocabulary for it, so
    // the loss is NAMED (dump v1.1 captures it; the ref stays proposed).
    const alphaBound = paints.find((p) => p.paint?.var !== undefined && (p.paint.alpha ?? 1) < 1);
    if (alphaBound) {
      ctx.notes.push(
        `${where} ${paintName}: paint opacity ${alphaBound.paint!.alpha} rides the bound variable "${alphaBound.paint!.var}" — alpha is not representable on a token ref; binding proposed at full opacity, review`,
      );
    }
    return u.ref;
  }
  if (u.kind === 'drift') ctx.notes.push(`${where} ${paintName}: ${u.detail}`);
  return undefined;
}

/** Invert a node's variable bindings + paints into contract token refs. */
function invertNodeTokens(m: Merged, isRoot: boolean, ctx: Ctx, where: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const fields = new Set<string>();
  for (const o of m.occ) for (const f of Object.keys(o.node.bound ?? {})) fields.add(f);
  const f = (name: string) => (fields.has(name) ? unifyField(m, name, ctx, where) : undefined);

  const bg = unifyPaint(m, (n) => (n.type === 'TEXT' ? undefined : n.fill), ctx, where, 'fill', {
    cssProperty: 'background-color',
    target: tokens,
  });
  if (bg) tokens['background-color'] = bg;
  const strokeRef = unifyPaint(m, (n) => n.stroke, ctx, where, 'stroke', {
    cssProperty: 'border-color',
    target: tokens,
  });
  if (strokeRef) tokens['border-color'] = strokeRef;

  // Paired fields → the contract's coarser vocabulary.
  const pair = (a?: string, b?: string) => (a !== undefined && a === b ? a : undefined);
  const inline = pair(f('paddingLeft'), f('paddingRight'));
  if (inline) tokens['padding-inline'] = inline;
  else if (fields.has('paddingLeft') || fields.has('paddingRight')) {
    ctx.notes.push(`${where}: left/right padding bindings differ — padding-inline not representable, review`);
  }
  const block = pair(f('paddingTop'), f('paddingBottom'));
  if (block) tokens['padding-block'] = block;
  else if (fields.has('paddingTop') || fields.has('paddingBottom')) {
    ctx.notes.push(`${where}: top/bottom padding bindings differ — padding-block not representable, review`);
  }
  const radii = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
  if (radii.some((r) => fields.has(r))) {
    const rs = radii.map((r) => f(r));
    if (rs[0] !== undefined && rs.every((r) => r === rs[0])) tokens['border-radius'] = rs[0];
    else ctx.notes.push(`${where}: corner radii bindings are not uniform — border-radius not representable, review`);
  }
  const weights = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'];
  if (weights.some((w) => fields.has(w)) || fields.has('strokeWeight')) {
    const w = fields.has('strokeWeight')
      ? f('strokeWeight')
      : (() => {
          const ws = weights.map((x) => f(x));
          return ws[0] !== undefined && ws.every((x) => x === ws[0]) ? ws[0] : undefined;
        })();
    if (w) tokens['border-width'] = w;
    else ctx.notes.push(`${where}: stroke weight bindings are not uniform — border-width not representable, review`);
  }
  const gap = f('itemSpacing');
  if (gap) tokens.gap = gap;
  const width = f('width');
  if (width) tokens[isRoot ? 'max-width' : 'width'] = width;
  const height = f('height');
  if (height) tokens.height = height;
  const minWidth = f('minWidth');
  if (minWidth) tokens['min-width'] = minWidth;
  const opacity = f('opacity');
  if (opacity) tokens.opacity = opacity;

  // Bound variables on fields OUTSIDE the contract vocabulary (maxWidth,
  // minHeight, counterAxisSpacing, …) are NAMED per field — a captured
  // binding must never vanish without a receipt (STYLE-FIDELITY audit A19).
  const CONSUMED_BOUND_FIELDS = new Set([
    'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
    'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
    'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight',
    'strokeWeight', 'itemSpacing', 'width', 'height', 'minWidth', 'opacity',
  ]);
  for (const field of fields) {
    if (!CONSUMED_BOUND_FIELDS.has(field)) {
      ctx.notes.push(
        `${where}: bound variable on "${field}" has no contract vocabulary — binding NAMED, not proposed (review)`,
      );
    }
  }

  // Unbound literals on a non-utility node: named, suggested, never invented.
  // With minting on, each report is ALSO captured with its per-variant values.
  // Triggers scan EVERY variant — a value that is zero/absent in the DEFAULT
  // variant but set elsewhere (field case: Tooltip Arrow Wrapper 16px inline
  // padding on 6 of 8 placements; the default `left` carries none) previously
  // fired nothing and the 6 variants' padding vanished without a receipt.
  const n0 = m.occ[0].node;
  const firstNode = <T>(pick: (n: DumpNode) => T | undefined, bad: T): DumpNode =>
    m.occ.find((o) => {
      const v = pick(o.node);
      return v !== undefined && v !== bad;
    })?.node ?? n0;
  if (
    !fields.has('itemSpacing') &&
    (n0.children?.length ?? 0) > 1 &&
    m.occ.some((o) => (o.node.layout?.spacing ?? 0) !== 0)
  ) {
    reportUnbound(ctx, where, 'itemSpacing', firstNode((n) => n.layout?.spacing, 0).layout!.spacing);
    mintObservation(ctx, tokens, where, 'gap', 'px', numOccurrences(m, (n) => n.layout?.spacing), `${where}|itemSpacing`);
  }
  if (
    !fields.has('paddingLeft') &&
    !fields.has('paddingTop') &&
    m.occ.some((o) => (o.node.layout?.padding ?? [0, 0, 0, 0]).some((pd) => pd !== 0))
  ) {
    const padded = m.occ.find((o) => (o.node.layout?.padding ?? [0, 0, 0, 0]).some((pd) => pd !== 0))!;
    reportUnbound(ctx, where, 'padding', padded.node.layout!.padding.join(' '));
    mintPadding(ctx, tokens, m, where);
  }
  if (!radii.some((r) => fields.has(r)) && m.occ.some((o) => o.node.cornerRadius !== undefined)) {
    reportUnbound(ctx, where, 'cornerRadius', firstNode((n) => n.cornerRadius, undefined).cornerRadius ?? 0);
    mintObservation(ctx, tokens, where, 'border-radius', 'px', numOccurrences(m, (n) => n.cornerRadius), `${where}|cornerRadius`);
  }
  if (
    !weights.some((w) => fields.has(w)) &&
    !fields.has('strokeWeight') &&
    m.occ.some((o) => o.node.strokeWeight !== undefined && o.node.stroke !== undefined)
  ) {
    const stroked = m.occ.find((o) => o.node.strokeWeight !== undefined && o.node.stroke !== undefined)!;
    reportUnbound(ctx, where, 'strokeWeight', stroked.node.strokeWeight!);
    // Variants without a stroke mint width 0 — faithful (nothing renders at
    // width 0); a PARTIAL stroke's COLOR stays the named refusal
    // (base-instance-check pins exactly this split).
    mintObservation(ctx, tokens, where, 'border-width', 'px', numOccurrences(m, (n) => n.strokeWeight), `${where}|strokeWeight`);
  }
  return tokens;
}

/** NODE opacity (dump v1.2) — distinct from paint alpha. A bound opacity
 *  variable already rides `tokens.opacity` (invertNodeTokens). A LITERAL
 *  opacity < 1 has three honest inversions, tried in order:
 *    1. constant across variants, or varying with an ENUM axis → an unbound
 *       report + (with minting) a unitless `number` mint on tokens.opacity;
 *    2. a function of ONE boolean variant axis, opaque on the false side →
 *       `stylesWhen { prop, styles: { opacity } }` (the literal-CSS
 *       conditional vocabulary — field case: Eventz `isDisabled` variant
 *       roots at opacity 0.4, the disabled wash-out dump v1.1 lost);
 *    3. anything else → a named note, nothing invented. */
function invertNodeOpacity(
  m: Merged,
  holder: Record<string, unknown>,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
) {
  if (m.occ.some((o) => o.node.bound?.opacity)) return; // rides tokens.opacity
  const occ = m.occ.map((o) => ({ variant: o.variant, value: o.node.opacity ?? 1 }));
  if (occ.every((o) => o.value === 1)) return;
  const distinct = [...new Set(occ.map((o) => o.value))];
  if (distinct.length > 1) {
    // One boolean axis, opaque on the false side → stylesWhen.
    for (const axis of ctx.axes) {
      if (!isBoolAxis(axis.values)) continue;
      const side = (want: string) =>
        new Set(
          occ
            .filter((o) => (axisValuesOf(o.variant)[axis.property] ?? '').trim().toLowerCase() === want)
            .map((o) => o.value),
        );
      const whenTrue = side('true');
      const whenFalse = side('false');
      if (whenFalse.size === 1 && whenFalse.has(1) && whenTrue.size === 1 && !whenTrue.has(1)) {
        const value = [...whenTrue][0];
        const stylesWhen = (holder.stylesWhen as Array<Record<string, unknown>> | undefined) ?? [];
        stylesWhen.push({ prop: axis.propName, styles: { opacity: String(value) } });
        holder.stylesWhen = stylesWhen;
        ctx.notes.push(
          `${where}: node opacity ${value} rides boolean axis "${axis.property}" (opaque when false) — proposed as stylesWhen { prop: ${axis.propName}, styles: { opacity } } (dump v1.2)`,
        );
        return;
      }
      if (whenTrue.size === 1 && whenTrue.has(1) && whenFalse.size === 1 && !whenFalse.has(1)) {
        ctx.notes.push(
          `${where}: node opacity ${[...whenFalse][0]} rides the FALSE side of boolean axis "${axis.property}" — stylesWhen cannot express negation; not proposed, review`,
        );
        return;
      }
    }
  }
  // Constant, or enum-axis-correlated — the mint classifier owns the split;
  // an uncorrelated spread stays a named refusal from the mint pass (or the
  // note below when minting is off).
  reportUnbound(ctx, where, 'opacity', occ[0].value);
  mintObservation(ctx, tokens, where, 'opacity', 'number', occ, `${where}|opacity`);
  if (!ctx.mint && distinct.length > 1) {
    ctx.notes.push(
      `${where}: node opacity differs across variants (${distinct.join(', ')}) without a boolean-axis correlation — not representable without minting; review`,
    );
  }
}

/** One DROP_SHADOW as a CSS box-shadow value: "0px 4px 8px [2px] #0000001a"
 *  — the same literal-fidelity single-string discipline as 8-digit hex. */
const shadowCss = (e: DumpEffect): string => {
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  const spread = e.spread !== undefined && e.spread !== 0 ? ` ${px(e.spread)}` : '';
  return `${px(e.offset?.x ?? 0)} ${px(e.offset?.y ?? 0)} ${px(e.radius ?? 0)}${spread} ${paintCssHex(e.color ?? { hex: '000000' })}`;
};

/** VISIBLE effects (dump v1.2). Exactly ONE DROP_SHADOW in EVERY variant →
 *  an unbound report + (with minting) a `box-shadow` shadow-kind mint (enum
 *  correlation handled by the classifier). Anything else — inner shadows,
 *  blurs, effect stacks, partial presence across variants — is a NAMED note
 *  carrying the effect types: the channel never drops silently. The canvas
 *  preview has no box-shadow projection in v1; that limit is named here at
 *  proposal (the minted preamble also skips shadow-typed leaves). */
function invertNodeEffects(m: Merged, tokens: Record<string, string>, ctx: Ctx, where: string) {
  if (m.occ.every((o) => (o.node.effects?.length ?? 0) === 0)) return;
  const kinds = [...new Set(m.occ.flatMap((o) => (o.node.effects ?? []).map((e) => e.type)))];
  const singleDropShadowEverywhere = m.occ.every((o) => {
    const eff = o.node.effects ?? [];
    return eff.length === 1 && eff[0].type === 'DROP_SHADOW';
  });
  if (!singleDropShadowEverywhere) {
    ctx.notes.push(
      `${where}: visible effect(s) [${kinds.join(', ')}] — only a single DROP_SHADOW present in every variant maps to box-shadow (dump v1.2); channel NAMED, not proposed`,
    );
    return;
  }
  const occ = m.occ.map((o) => ({ variant: o.variant, value: shadowCss(o.node.effects![0]) }));
  reportUnbound(ctx, where, 'effects', occ[0].value);
  mintObservation(ctx, tokens, where, 'box-shadow', 'shadow', occ, `${where}|effects`);
  ctx.notes.push(
    `${where}: DROP_SHADOW proposed as a box-shadow value (dump v1.2) — CSS surfaces render it; the canvas preview and the Figma sync script project it as a native DROP_SHADOW effect (dump v1.3)`,
  );
}

// ---------------------------------------------------------------------------
// Shape decor (#42, dump v1.3) — field case: the CBDS Tooltip pointer.
// A captured DumpShape becomes a REAL part: part.shape carries kind + exact
// intrinsic size (+ rotation when constant); per-variant placement and
// axis-correlated rotation ride the EXISTING stylesWhen vocabulary
// (position/top/right/bottom/left/transform are already whitelisted), spelled
// from the captured constraints so the placement generalizes with content:
//   LEFT/TOP     → left/top: <x>px      (exact captured offset)
//   RIGHT/BOTTOM → right/bottom: <px>   (exact captured edge distance)
//   CENTER       → 50% + translate(-50%) (a snap residue vs the drawn pixel
//                  is NAMED when the canvas pixel-grid rounded the center)
// Anything the rules cannot carry is a NAMED note, never a guess.
// ---------------------------------------------------------------------------

/** Hidden-pattern visibility (dump v1.1 `hidden`, inverted for shape parts):
 *  a node drawn in EVERY variant but hidden exactly where one boolean axis
 *  is false (Tooltip pointer=false), or visible for exactly one enum value,
 *  becomes visibleWhen. Anything else is a NAMED note. */
function invertHiddenVisibility(m: Merged, part: Record<string, unknown>, ctx: Ctx, where: string) {
  if (part.visibleWhen !== undefined) return;
  if (m.occ.every((o) => o.node.hidden !== true)) return;
  if (m.occ.every((o) => o.node.hidden === true)) {
    ctx.notes.push(`${where}: hidden in every variant — drawn as a design-time helper; proposed anyway, review`);
    return;
  }
  for (const axis of ctx.axes) {
    if (isBoolAxis(axis.values)) {
      const fits = m.occ.every((o) => {
        const v = (axisValuesOf(o.variant)[axis.property] ?? '').trim().toLowerCase();
        return (o.node.hidden === true) === (v === 'false');
      });
      if (fits) {
        part.visibleWhen = { prop: axis.propName };
        ctx.notes.push(
          `${where}: hidden exactly where "${axis.property}" is false — proposed as visibleWhen { prop: ${axis.propName} } (dump v1.1 hidden channel)`,
        );
        return;
      }
    } else {
      const visibleValues = new Set(
        m.occ.filter((o) => o.node.hidden !== true).map((o) => axisValuesOf(o.variant)[axis.property]),
      );
      const hiddenValues = new Set(
        m.occ.filter((o) => o.node.hidden === true).map((o) => axisValuesOf(o.variant)[axis.property]),
      );
      const only = visibleValues.size === 1 ? [...visibleValues][0] : undefined;
      if (only !== undefined && !hiddenValues.has(only)) {
        part.visibleWhen = { prop: axis.propName, equals: camel(only) };
        ctx.notes.push(
          `${where}: visible only where "${axis.property}" = "${only}" — proposed as visibleWhen { prop: ${axis.propName}, equals: ${camel(only)} }`,
        );
        return;
      }
    }
  }
  ctx.notes.push(
    `${where}: hidden in ${m.occ.filter((o) => o.node.hidden === true).length}/${m.occ.length} variants without correlating to any axis — kept unconditional, review`,
  );
}

interface ShapePlacement {
  /** stylesWhen-vocabulary styles, transform EXCLUDED (built by the caller
   *  so per-value rotation can join the same transform). */
  styles: Record<string, string>;
  translate: string[];
  /** |drawn − exact-center| px, when a CENTER constraint pixel-snapped. */
  centerResidue?: number;
}

function shapePlacementOf(sh: NonNullable<DumpNode['shape']>): ShapePlacement | null {
  if (sh.x === undefined || sh.y === undefined) return null;
  const styles: Record<string, string> = { position: 'absolute' };
  const translate: string[] = [];
  let centerResidue: number | undefined;
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  const h = sh.constraints?.horizontal ?? 'LEFT';
  if (h === 'RIGHT' && sh.right !== undefined) styles.right = px(sh.right);
  else if (h === 'CENTER' && sh.right !== undefined) {
    styles.left = '50%';
    translate.push('translateX(-50%)');
    const residue = Math.round(Math.abs(sh.x - sh.right) * 50) / 100;
    if (residue > 0.01) centerResidue = Math.max(centerResidue ?? 0, residue);
  } else styles.left = px(sh.x);
  const v = sh.constraints?.vertical ?? 'TOP';
  if (v === 'BOTTOM' && sh.bottom !== undefined) styles.bottom = px(sh.bottom);
  else if (v === 'CENTER' && sh.bottom !== undefined) {
    styles.top = '50%';
    translate.push('translateY(-50%)');
    const residue = Math.round(Math.abs(sh.y - sh.bottom) * 50) / 100;
    if (residue > 0.01) centerResidue = Math.max(centerResidue ?? 0, residue);
  } else styles.top = px(sh.y);
  return { styles, translate, centerResidue };
}

/** Invert captured DumpShape geometry into part.shape (+ per-variant
 *  placement/rotation stylesWhen). Values are EXACT from the dump. */
function invertNodeShape(m: Merged, part: Record<string, unknown>, ctx: Ctx, where: string) {
  const withShape = m.occ.filter((o) => o.node.shape !== undefined);
  if (withShape.length === 0) return;
  if (withShape.length !== m.occ.length) {
    ctx.notes.push(
      `${where}: shape geometry captured in ${withShape.length}/${m.occ.length} variants — inconsistent capture, shape not carried; review`,
    );
    return;
  }
  const shapes = m.occ.map((o) => ({ variant: o.variant, hidden: o.node.hidden === true, sh: o.node.shape! }));
  const kinds = [...new Set(shapes.map((s) => s.sh.kind))];
  if (kinds.length > 1) {
    ctx.notes.push(`${where}: shape kind differs across variants (${kinds.join(', ')}) — shape not carried; review`);
    return;
  }
  const first = shapes[0].sh;
  const shape: Record<string, unknown> = { kind: first.kind, width: first.width, height: first.height };
  const sizes = [...new Set(shapes.map((s) => `${s.sh.width}×${s.sh.height}`))];
  if (sizes.length > 1) {
    ctx.notes.push(
      `${where}: shape size differs across variants (${sizes.join(', ')}) — the first variant's ${sizes[0]} carried; review`,
    );
  }
  if (first.kind === 'polygon') {
    const sides = [...new Set(shapes.map((s) => s.sh.sides).filter((v): v is number => v !== undefined))];
    if (sides.length >= 1) {
      shape.sides = sides[0];
      if (sides.length > 1) {
        ctx.notes.push(`${where}: polygon side count differs across variants (${sides.join(', ')}) — ${sides[0]} carried; review`);
      }
    } else {
      shape.sides = 3;
      ctx.notes.push(
        `${where}: polygon point count is not on the REST surface — sides: 3 (the Figma default, a triangle) ASSUMED; verify against the canvas`,
      );
    }
  }

  // Rotation: constant → shape.rotation; varying → per-axis-value transform
  // (joined with placement below); uncorrelated → NAMED.
  const rotations = shapes.map((s) => s.sh.rotation ?? 0);
  const distinctRot = [...new Set(rotations)];
  const rotationVaries = distinctRot.length > 1;
  if (!rotationVaries && distinctRot[0] !== 0) shape.rotation = distinctRot[0];
  part.shape = shape;

  // Placement (+ varying rotation): must be a function of ONE enum axis with
  // per-value consistency — or uniform (then it rides the part's boolean
  // visibleWhen condition). Axis values whose variants are ALL hidden get no
  // entry (nothing renders there).
  const specOf = (s: (typeof shapes)[number]): string => {
    const p = shapePlacementOf(s.sh);
    return JSON.stringify({ p: p?.styles ?? null, t: p?.translate ?? [], r: rotationVaries ? (s.sh.rotation ?? 0) : 0 });
  };
  const anyPlacement = shapes.some((s) => shapePlacementOf(s.sh) !== null);
  if (!anyPlacement && !rotationVaries) return; // in-flow, constant rotation — done
  const buildStyles = (s: (typeof shapes)[number]): Record<string, string> | null => {
    const p = shapePlacementOf(s.sh);
    const transform: string[] = [...(p?.translate ?? [])];
    if (rotationVaries && (s.sh.rotation ?? 0) !== 0) transform.push(`rotate(${s.sh.rotation}deg)`);
    const styles: Record<string, string> = { ...(p?.styles ?? {}) };
    if (transform.length > 0) styles.transform = transform.join(' ');
    if (p?.centerResidue !== undefined) {
      ctx.notes.push(
        `${where}: CENTER-constrained placement carried as 50% + translate — the drawn offset differs from the exact center by ${p.centerResidue}px (canvas pixel snap); review`,
      );
    }
    return Object.keys(styles).length > 0 ? styles : null;
  };

  for (const axis of ctx.axes) {
    if (isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, (typeof shapes)[number]>();
    let fits = true;
    for (const s of shapes) {
      const value = axisValuesOf(s.variant)[axis.property];
      if (value === undefined) {
        fits = false;
        break;
      }
      const seen = byValue.get(value);
      if (seen && specOf(seen) !== specOf(s)) {
        fits = false;
        break;
      }
      if (!seen) byValue.set(value, s);
    }
    if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
    const stylesWhen = (part.stylesWhen as Array<Record<string, unknown>> | undefined) ?? [];
    let emitted = 0;
    let suppressed = 0;
    for (const value of axis.values) {
      const variantsOfValue = shapes.filter((s) => axisValuesOf(s.variant)[axis.property] === value);
      if (variantsOfValue.every((s) => s.hidden)) {
        // The shape NEVER renders at this axis value in the drawn set — the
        // honest completion for combos the design never drew (pointer=true
        // at pointer-position=none) is an explicit display: none.
        stylesWhen.push({ prop: axis.propName, equals: camel(value), styles: { display: 'none' } });
        suppressed++;
        continue;
      }
      const styles = buildStyles(byValue.get(value)!);
      if (!styles) continue;
      stylesWhen.push({ prop: axis.propName, equals: camel(value), styles });
      emitted++;
    }
    if (emitted + suppressed > 0) part.stylesWhen = stylesWhen;
    ctx.notes.push(
      `${where}: ${kinds[0]} decor carried as a shape part (${String(shape.width)}×${String(shape.height)}${shape.sides !== undefined ? `, ${String(shape.sides)} sides` : ''}) with per-variant absolute placement${rotationVaries ? ' + rotation' : ''} as stylesWhen on \`${axis.propName}\` (${emitted} placement(s)${suppressed > 0 ? `; ${suppressed} value(s) where the shape is hidden in every drawn variant carry display: none` : ''}; offsets EXACT from the captured boxes — dump v1.3, #42)`,
    );
    return;
  }
  // Uniform placement/rotation across every variant?
  const specs = [...new Set(shapes.map(specOf))];
  if (specs.length === 1) {
    const styles = buildStyles(shapes[0]);
    const vw = part.visibleWhen as { prop: string; equals?: string } | undefined;
    if (styles && vw && vw.equals === undefined) {
      const stylesWhen = (part.stylesWhen as Array<Record<string, unknown>> | undefined) ?? [];
      stylesWhen.push({ prop: vw.prop, styles });
      part.stylesWhen = stylesWhen;
      ctx.notes.push(
        `${where}: uniform absolute placement carried as stylesWhen on the part's own visibility boolean \`${vw.prop}\` (the part only renders when it holds) — dump v1.3, #42`,
      );
    } else if (styles) {
      ctx.notes.push(
        `${where}: absolute placement is uniform across variants but the stylesWhen vocabulary is conditional — placement NAMED, not proposed (${JSON.stringify(styles)}); review`,
      );
    }
    return;
  }
  ctx.notes.push(
    `${where}: shape placement/rotation differs across variants without correlating to any enum axis — NAMED, not proposed; review`,
  );
}

/** The contract's padding vocabulary is symmetric (padding-inline/-block):
 *  each symmetric pair mints its own observation; an asymmetric pair mints
 *  nothing (named, the classic unbound entry survives), and an all-zero pair
 *  needs no token at all. */
function mintPadding(ctx: Ctx, target: Record<string, string>, m: Merged, where: string) {
  if (!ctx.mint) return;
  const source = `${where}|padding`;
  const pairs = [
    { cssProperty: 'padding-inline', a: 3, b: 1, label: 'left/right' }, // padding: [top, right, bottom, left]
    { cssProperty: 'padding-block', a: 0, b: 2, label: 'top/bottom' },
  ] as const;
  for (const { cssProperty, a, b, label } of pairs) {
    const pad = (n: DumpNode): readonly number[] => n.layout?.padding ?? [0, 0, 0, 0];
    if (!m.occ.every((o) => pad(o.node)[a] === pad(o.node)[b])) {
      ctx.mint.partialSources.add(source);
      ctx.notes.push(`${where}: ${label} padding literals differ — ${cssProperty} is not representable, not minted; review`);
      continue;
    }
    if (m.occ.every((o) => pad(o.node)[a] === 0)) continue; // zero padding needs no token
    mintObservation(ctx, target, where, cssProperty, 'px', numOccurrences(m, (n) => pad(n)[a]), source);
  }
}

// ---------------------------------------------------------------------------
// Text → typography tokens
// ---------------------------------------------------------------------------

/** BOUNDED font-style-name → numeric weight table (owner field case: CBDS
 *  Tooltip title drawn "Semi Bold" — imports with no token-derived style
 *  identity previously NAMED the weight and dropped it; the title rendered
 *  un-bold). Names normalize by lowercasing and stripping spaces/hyphens;
 *  a trailing "Italic" is NOT weight — it is receipted separately as an
 *  uncarried channel. Unknown names stay NAMED receipts, never guessed. */
const FONT_WEIGHT_BY_STYLE_NAME: Record<string, number> = {
  thin: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

export function fontStyleWeight(fontStyle: string): { weight?: number; italic: boolean } {
  let key = fontStyle.toLowerCase().replace(/[\s_-]+/g, '');
  let italic = false;
  if (key.endsWith('italic')) {
    italic = true;
    key = key.slice(0, -'italic'.length);
  }
  if (key === '') return { weight: italic ? 400 : undefined, italic }; // bare "Italic" = Regular Italic
  return { weight: FONT_WEIGHT_BY_STYLE_NAME[key], italic };
}

/** Mint the text channels that ride OUTSIDE a token-derived style identity:
 *  font-weight through the bounded weight-name table (dump fontStyle), and
 *  line-height when the dump captured a PIXEL value (dump v1.3). Uniformity
 *  rules mirror font-size: identical across variants → one mint; varying →
 *  per-variant substituted refs (the mint classifier owns the split).
 *  Unknown weight names and italic styles are NAMED receipts. */
function mintTextChannels(
  m: Merged,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
  opts: { weight: boolean },
) {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  if (opts.weight) {
    const parsed = textOcc.map((o) => ({
      variant: o.variant,
      fontStyle: o.node.text!.fontStyle ?? 'Medium',
      ...fontStyleWeight(o.node.text!.fontStyle ?? 'Medium'),
    }));
    const unknown = [...new Set(parsed.filter((p) => p.weight === undefined).map((p) => p.fontStyle))];
    if (unknown.length > 0) {
      ctx.notes.push(
        `${where}: font style name(s) ${unknown.map((u) => `"${u}"`).join(', ')} are outside the weight-name table (Thin…Black) — font-weight NAMED, not proposed; review`,
      );
    } else {
      reportUnbound(ctx, where, 'fontWeight', parsed[0].weight!);
      mintObservation(
        ctx, tokens, where, 'font-weight', 'number',
        parsed.map((p) => ({ variant: p.variant, value: p.weight! })),
        `${where}|fontWeight`,
      );
    }
    const italics = parsed.filter((p) => p.italic);
    if (italics.length > 0) {
      ctx.notes.push(
        `${where}: italic font style ("${italics[0].fontStyle}") — font-style has no contract vocabulary; italic NAMED, not carried (review)`,
      );
    }
  }
  // line-height (dump v1.3, PIXELS only — other units were receipted at capture).
  const withLh = textOcc.filter((o) => typeof o.node.text!.lineHeight === 'number');
  if (withLh.length === 0) return;
  if (withLh.length !== textOcc.length) {
    ctx.notes.push(
      `${where}: line-height captured in ${withLh.length}/${textOcc.length} variants (absent means AUTO or an older dump) — inconsistent, NAMED, not proposed; review`,
    );
    return;
  }
  reportUnbound(ctx, where, 'lineHeight', withLh[0].node.text!.lineHeight!);
  mintObservation(
    ctx, tokens, where, 'line-height', 'px',
    withLh.map((o) => ({ variant: o.variant, value: o.node.text!.lineHeight! })),
    `${where}|lineHeight`,
  );
}

function invertTextTokens(m: Merged, ctx: Ctx, where: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const color = unifyPaint(
    m,
    (n) => (n.text?.fillVar ? { var: n.text.fillVar } : n.fill),
    ctx,
    where,
    'text fill',
    { cssProperty: 'color', target: tokens },
  );
  if (color) tokens.color = color;

  const t = first(m.occ, (n) => n.text);
  if (!t) return tokens;
  // UNIFORMITY GUARD (owner field case: CBDS Button, 16px large/medium vs
  // 14px small). Style identity — named-style adoption AND the style-less
  // (fontSize, fontStyle) definition match below — is only honest when the
  // typography is the SAME in every variant: sampling the first variant would
  // ship a plausible-but-WRONG constant for the others, the worst outcome.
  // Varying typography mints per variant instead (axis-correlated values take
  // the substituted-ref shape), and the variance is NAMED.
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  const distinctSizes = [...new Set(textOcc.map((o) => o.node.text!.fontSize))];
  const distinctWeights = [...new Set(textOcc.map((o) => o.node.text!.fontStyle ?? 'Medium'))];
  if (distinctSizes.length > 1 || distinctWeights.length > 1) {
    ctx.notes.push(
      `${where}: typography varies across variants (fontSize ${distinctSizes.join('/')}, weight ${distinctWeights.join('/')}) — no single text-style identity adopted (the first variant's value would be wrong for the others); font-size ${ctx.mint ? 'minted per variant where axis-correlated' : 'not proposed without minting'}${distinctWeights.length > 1 ? '; font-weight minted per variant through the weight-name table where every name maps (unknown names stay NAMED)' : ''} (review)`,
    );
    reportUnbound(ctx, where, 'fontSize', t.fontSize);
    mintObservation(ctx, tokens, where, 'font-size', 'px', numOccurrences(m, (n) => n.text?.fontSize), `${where}|fontSize`);
    mintTextChannels(m, tokens, ctx, where, { weight: true });
    return tokens;
  }
  const styleNames = [...new Set(m.occ.map((o) => o.node.text?.style).filter((s) => s !== undefined))];
  if (styleNames.length > 1) {
    ctx.notes.push(`${where}: text style differs across variants (${styleNames.join(', ')}) — using ${styleNames[0]}`);
  }
  let style = styleNames[0] ? ctx.corpus.textStyleByName.get(styleNames[0]) : undefined;
  if (styleNames[0] && !style) {
    ctx.notes.push(`${where}: rides text style "${styleNames[0]}" which is not a token-derived style — typography not proposed`);
  }
  if (!style) {
    // Style-less text: adopt a derived style's identity only on a UNIQUE
    // (fontSize, fontStyle) definition match — anything else is reported.
    const hits = ctx.corpus.textStyles.filter(
      (s) => s.fontSize === t.fontSize && s.fontStyle === (t.fontStyle ?? 'Medium'),
    );
    if (hits.length === 1) style = hits[0];
    else if (styleNames.length === 0) {
      ctx.notes.push(
        `${where}: typography (${t.fontSize}px ${t.fontStyle}) matches ${hits.length} derived text styles — font tokens not proposed, review`,
      );
    }
  }
  if (style) {
    tokens['font-size'] = `{${style.tokenPath}}`;
    // Medium is the runtimes' text default: a weight token resolving to it is
    // canvas-indistinguishable from no weight token (declared fidelity limit).
    if (style.weightPath && style.fontStyle !== 'Medium') {
      tokens['font-weight'] = `{${style.weightPath}}`;
    }
    if ((t.fontStyle ?? 'Medium') !== style.fontStyle) {
      ctx.notes.push(`${where}: node weight "${t.fontStyle}" overrides style "${style.name}" — override not token-recoverable, review`);
    }
  } else if (ctx.mint && t.fontSize > 0) {
    // No token-derived style identity — mint the literal size.
    mintObservation(ctx, tokens, where, 'font-size', 'px', numOccurrences(m, (n) => n.text?.fontSize));
  }
  // Channels OUTSIDE the style identity: font-weight through the bounded
  // weight-name table when no derived style matched (the identity path stays
  // the PREFERRED route — a matched style already carries its weight token);
  // PIXEL line-height always (a text style's definition does not carry it).
  // Field case: the CBDS Tooltip title drawn "Semi Bold" at 12/16 rendered
  // un-bold and mis-proportioned when both channels were note-only.
  mintTextChannels(m, tokens, ctx, where, { weight: !style });
  return tokens;
}

// ---------------------------------------------------------------------------
// Layout inversion
// ---------------------------------------------------------------------------

const JUSTIFY_INV: Record<string, string | undefined> = {
  MIN: undefined,
  CENTER: 'center',
  MAX: 'end',
  SPACE_BETWEEN: 'space-between',
};
const ALIGN_INV: Record<string, string | undefined> = {
  MIN: undefined,
  CENTER: 'center',
  MAX: 'end',
};

/** align:stretch evidence — the exact artifact the generator leaves: a column
 *  parent whose eligible children (FRAME/TEXT, no bound width; instances are
 *  excluded from the generator's stretch path) ALL carry fill-width. */
function stretchEvidence(m: Merged): boolean {
  const l = m.occ[0].node.layout;
  if (!l || l.mode !== 'VERTICAL') return false;
  const eligible = m.children.filter((c) => {
    const n = c.occ[0].node;
    return (n.type === 'FRAME' || n.type === 'TEXT') && !n.bound?.width;
  });
  if (eligible.length === 0) return false;
  return eligible.every((c) => c.occ.every((o) => o.node.fillWidth === true));
}

function invertLayout(
  m: Merged,
  isRoot: boolean,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | undefined {
  const layouts = m.occ.map((o) => o.node.layout).filter((l) => l !== undefined);
  const l = layouts[0];
  // Per-variant layout differences are handled by invertLayoutByProp (which
  // notes an uncorrelated spread); the base layout is the default variant's.
  const grow =
    parentMode === 'HORIZONTAL' && m.occ.every((o) => o.node.fillWidth === true) ? true : undefined;
  if (!l) return grow ? { grow } : undefined;

  const hasChildren = m.children.length > 0;
  const out: Record<string, unknown> = {};
  const direction = l.mode === 'VERTICAL' ? 'column' : 'row';
  const justify = JUSTIFY_INV[l.primary];
  const align = ALIGN_INV[l.counter] ?? (stretchEvidence(m) ? 'stretch' : undefined);
  if (isRoot) {
    // The generator's root default is row/center/center — a root drawn
    // exactly there proposes no layout block.
    if (direction === 'row' && justify === 'center' && align === 'center' && !grow) return undefined;
    out.display = 'flex';
  }
  if (hasChildren || direction === 'column') out.direction = direction;
  if (justify && hasChildren) out.justify = justify;
  if (align && hasChildren) out.align = align;
  if (grow) out.grow = grow;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Per-variant AUTO-LAYOUT differences → layoutByProp (the v7 vocabulary the
 *  schema already ships). Field case: Shoelace Tooltip — the root's
 *  direction/counter-align AND child order (Body vs Arrow first) are a pure
 *  function of the `placement` axis; dump v1.1 proposals collapsed all 8 to
 *  the default variant's layout and placement rendered inert.
 *
 *  Rules: each variant's (direction, justify, align) tuple is computed with
 *  MIN spelled EXPLICITLY as 'start' (an override merges over the base — an
 *  absent key would not override); a variant whose child sequence is the
 *  REVERSE of the merged order inverts to a `-reverse` direction (the code
 *  side emits flex-direction, the canvas reverses compiled child order —
 *  both already implemented for layoutByProp). Differences must be a
 *  function of exactly ONE enum axis with full value coverage; only the
 *  values that deviate from the default variant's tuple appear in the map.
 *  Anything less correlated keeps the named collapse note. */
function invertLayoutByProp(
  m: Merged,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | undefined {
  interface Tuple {
    direction: string;
    justify: string;
    align: string;
  }
  const mergedOrder = m.children.map((c) => c.name);
  const tupleOf = (o: Occ): Tuple | null => {
    const l = o.node.layout;
    if (!l) return null;
    let direction = l.mode === 'VERTICAL' ? 'column' : 'row';
    const seq = (o.node.children ?? []).map((n) => n.name);
    const expected = mergedOrder.filter((n) => seq.includes(n));
    if (
      seq.length >= 2 &&
      seq.join('\u0000') !== expected.join('\u0000') &&
      seq.join('\u0000') === [...expected].reverse().join('\u0000')
    ) {
      direction += '-reverse';
    }
    return {
      direction,
      justify: JUSTIFY_INV[l.primary] ?? 'start',
      align: ALIGN_INV[l.counter] ?? 'start',
    };
  };
  const tuples = m.occ.map((o) => ({ variant: o.variant, tuple: tupleOf(o) }));
  if (tuples.some((t) => t.tuple === null)) return undefined; // layout absent somewhere — other channels report
  const key = (t: Tuple) => `${t.direction}|${t.justify}|${t.align}`;
  const base = tuples[0].tuple!;
  if (tuples.every((t) => key(t.tuple!) === key(base))) return undefined;
  for (const axis of ctx.axes) {
    if (isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, Tuple>();
    let fits = true;
    for (const t of tuples) {
      const value = axisValuesOf(t.variant)[axis.property];
      if (value === undefined) {
        fits = false;
        break;
      }
      const seen = byValue.get(value);
      if (seen && key(seen) !== key(t.tuple!)) {
        fits = false;
        break;
      }
      byValue.set(value, t.tuple!);
    }
    if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
    const map: Record<string, Record<string, string>> = {};
    for (const value of axis.values) {
      const t = byValue.get(value)!;
      const override: Record<string, string> = {};
      if (t.direction !== base.direction) override.direction = t.direction;
      if (t.justify !== base.justify) override.justify = t.justify;
      if (t.align !== base.align) override.align = t.align;
      if (Object.keys(override).length > 0) map[camel(value)] = override;
    }
    if (Object.keys(map).length === 0) return undefined;
    ctx.notes.push(
      `${where}: auto-layout differs across variants as a function of axis "${axis.property}" — proposed layoutByProp on \`${axis.propName}\` (${Object.keys(map).length} override(s); reversed child order spelled as -reverse directions)`,
    );
    return { prop: axis.propName, map };
  }
  ctx.notes.push(
    `${where}: auto-layout differs across variants without correlating to any variant axis — using the default variant's`,
  );
  return undefined;
}

// ---------------------------------------------------------------------------
// Presence → visibleWhen
// ---------------------------------------------------------------------------

function visibilityFromPresence(m: Merged, ctx: Ctx, where: string): Record<string, unknown> | undefined {
  if (m.occ.length === ctx.totalVariants.length) return undefined;
  const present = new Set(m.occ.map((o) => o.variant));
  for (const axis of ctx.axes) {
    for (const value of axis.values) {
      const matches = ctx.totalVariants.every((v) => {
        const is = axisValuesOf(v)[axis.property] === value;
        return is === present.has(v);
      });
      if (matches) return { prop: axis.propName, equals: camel(value) };
    }
  }
  // Absences fully explained by base-instance-flattened variants are a
  // declared fidelity limit (the base component's internals are not captured
  // in those variants), not structural drift — named, but not alarmed.
  if (ctx.totalVariants.every((v) => present.has(v) || ctx.flattenedVariants.has(v))) {
    ctx.notes.push(
      `${where}: absent only in base-instance-flattened variant(s), where the base component's internals are not captured — kept unconditional`,
    );
    return undefined;
  }
  ctx.notes.push(
    `${where}: present in ${m.occ.length}/${ctx.totalVariants.length} variants without correlating to any axis value — kept unconditional, review`,
  );
  return undefined;
}

// ---------------------------------------------------------------------------
// Part construction
// ---------------------------------------------------------------------------

/** The contract id this proposal will claim for itself. */
const selfContractId = (ctx: Ctx): string => `${ctx.prefix}.${kebab(ctx.setName)}`;

/** True when a nested instance resolves to the set's own contract — either
 *  through the contract index (name → id lands on the proposal's own id) or
 *  by the name-match fallback the id would be derived from. */
function isSelfInstance(instanceOf: string, ctx: Ctx): boolean {
  const resolved = ctx.contractIdByName.get(instanceOf) ?? `${ctx.prefix}.${kebab(instanceOf)}`;
  return resolved === selfContractId(ctx) || kebab(instanceOf) === kebab(ctx.setName);
}

const isSpacer = (m: Merged): boolean =>
  m.type === 'FRAME' &&
  m.children.length === 0 &&
  m.occ.every((o) => !o.node.fill && !o.node.stroke && !o.node.bound && !o.node.text);

/** The generator wraps styled static text in a row/center/center frame with
 *  zero spacing/padding (empty text → the frame alone). Recognize the wrap
 *  and elide its layout — the part is a styled leaf. */
const isWrapArtifact = (m: Merged): boolean => {
  const n = m.occ[0].node;
  const l = n.layout;
  return (
    m.type === 'FRAME' &&
    m.children.length === 0 &&
    l !== undefined &&
    l.mode === 'HORIZONTAL' &&
    l.primary === 'CENTER' &&
    l.counter === 'CENTER' &&
    l.spacing === 0 &&
    l.padding.every((p) => p === 0) &&
    (n.fill !== undefined || n.bound !== undefined)
  );
};

/** Anatomy part key for a merged child: identifier-safe (the React emitter
 *  writes `styles.<key>` and `<div className={styles.<key>}>`, so a drawn
 *  name like "Focus ring" must not leak into the key) and unique among
 *  siblings. A name that is already a legal identifier keeps its spelling. */
function partKey(name: string, taken: Set<string>): string {
  const base = /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : camel(name) || 'part';
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
  taken.add(key);
  return key;
}

/** Attach a part's tokens record — and remember it when minting, so a record
 *  whose FIRST binding arrives from the mint pass still lands on the part. */
function attachTokens(ctx: Ctx, holder: Record<string, unknown>, tokens: Record<string, string>) {
  ctx.mint?.attach.push({ holder, tokens });
  if (Object.keys(tokens).length > 0) holder.tokens = tokens;
}

function registerTextProp(ctx: Ctx, property: string, characters: string, name = canonicalPropName(property)) {
  if (ctx.textProps.some((p) => p.property === property)) return;
  ctx.textProps.push({ name, property, default: characters });
}

function unifiedPropRef(m: Merged, kind: string, ctx: Ctx, where: string): string | undefined {
  const values = [...new Set(m.occ.map((o) => o.node.propRefs?.[kind]).filter((v) => v !== undefined))];
  if (values.length > 1) {
    ctx.notes.push(`${where}: ${kind} property reference differs across variants (${values.join(', ')}) — using ${values[0]}`);
  }
  return values[0];
}

function buildPart(
  m: Merged,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | null {
  const part: Record<string, unknown> = {};
  const visibleWhen = visibilityFromPresence(m, ctx, where);

  if (m.type === 'TEXT') {
    const tokens = invertTextTokens(m, ctx, where);
    invertNodeOpacity(m, part, tokens, ctx, where);
    if (m.occ.some((o) => (o.node.effects?.length ?? 0) > 0)) {
      ctx.notes.push(
        `${where}: visible effect(s) on a TEXT node — a text shadow has no contract vocabulary (box-shadow is a box channel); channel NAMED, not proposed (dump v1.2)`,
      );
    }
    const property = unifiedPropRef(m, 'characters', ctx, where);
    const characters = first(m.occ, (n) => n.text?.characters) ?? '';
    if (property) {
      registerTextProp(ctx, property, characters);
      // The SAME canonical spelling registerTextProp names the prop with —
      // camel() alone would leak illegal characters ("✏️text") into the
      // content binding and break the prop↔content pairing.
      part.content = { prop: canonicalPropName(property) };
    } else {
      part.text = characters;
    }
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (m.type === 'INSTANCE') {
    // Node opacity/effects on an instance are PARENT-context visual facts,
    // but the part elides styling (the child contract owns it) and
    // stylesWhen/tokens are refused on component refs — named, never
    // silently dropped.
    const instOpacity = m.occ.find((o) => (o.node.opacity ?? 1) < 1);
    if (instOpacity) {
      ctx.notes.push(
        `${where}: node opacity ${instOpacity.node.opacity} on a nested instance — parent-context opacity is not representable on a component ref (dump v1.2); review`,
      );
    }
    if (m.occ.some((o) => (o.node.effects?.length ?? 0) > 0)) {
      ctx.notes.push(
        `${where}: visible effect(s) on a nested instance — not representable on a component ref (dump v1.2); review`,
      );
    }
    const swapProperty = unifiedPropRef(m, 'mainComponent', ctx, where);
    if (swapProperty) {
      // A swap-bound instance outside a dedicated wrapper: still a slot part,
      // just without wrapper geometry (not the generator's shape — note it).
      ctx.notes.push(`${where}: INSTANCE_SWAP-bound instance without a dedicated wrapper frame — slot proposed without layout, review`);
      part.slot = { name: canonicalPropName(swapProperty) };
      const instanceOf = first(m.occ, (n) => n.instanceOf);
      if (instanceOf && instanceOf !== 'Slot') {
        ctx.notes.push(
          `${where}: slot "${swapProperty}" holds a "${instanceOf}" instance as design-time content — defaultContent not proposed (dump v1 does not carry its configuration), review`,
        );
      }
      // Same visibility conventions as the wrapper-frame slot path: the
      // "Show <Property>" convention marks the slot optional; any other
      // BOOLEAN visibility binding becomes a real boolean prop driving the
      // part (field case: Eventz Button icons, visible → hasStartIcon /
      // hasEndIcon). Either way the slot is conditional content, so it is
      // never judged the DEFAULT slot.
      const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
      const optional = visibleRef === `Show ${swapProperty}`;
      if (optional) part.optional = true;
      else if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
      ctx.slots.push({ part, property: swapProperty, optional: optional || visibleRef !== undefined });
      if (visibleWhen && !part.visibleWhen) part.visibleWhen = visibleWhen;
      return part;
    }
    const instanceOf = first(m.occ, (n) => n.instanceOf) ?? m.name;
    if (isSelfInstance(instanceOf, ctx)) {
      // SELF-REFERENCE GUARD (field case: Eventz DS Button, node 2313-42).
      // A nested instance that resolves to the set's own contract id must
      // NEVER become a component ref — the generator refuses a contract that
      // sets its own (unknown) props, and a contract cannot contain itself.
      // Reaching here means the per-variant base-instance flattening did not
      // absorb it (no componentProperties captured, or the variant carried
      // more than one self-instance), so the part ships without a component
      // ref and the skip is NAMED.
      const applied = first(m.occ, (n) => n.componentProperties);
      const propNames = applied ? Object.keys(applied).map((k) => k.split('#')[0]) : [];
      const reason = applied
        ? 'flattening heuristic not met — the variant carries more than one instance of the set itself'
        : 'componentProperties not captured — dump v1 stops at instances';
      ctx.notes.push(
        `${where}: nested instance of the set's own base component "${instanceOf}" — no component ref proposed (a contract cannot reference itself); props ${
          propNames.length > 0 ? propNames.join(', ') : '(unknown)'
        } not extracted (${reason})`,
      );
      if (visibleWhen) part.visibleWhen = visibleWhen;
      return part;
    }
    const id = ctx.contractIdByName.get(instanceOf);
    if (!id) {
      // AUTO-PROPOSED CHILD STUB (field case: CBDS Button → ds.icon). A
      // component ref to a contract nobody has is a guaranteed emit refusal
      // ("no contract in scope") — so the proposal ships a STUB child
      // contract alongside itself (childStubs), built from the observed
      // applied values ONLY. Nothing about the child's real API or anatomy
      // is guessed; the stub names its own provisionality.
      const stubId = `${ctx.prefix}.${kebab(instanceOf)}`;
      const capture = ctx.stubs.get(stubId) ?? { id: stubId, instanceOf, applied: [] };
      for (const o of m.occ) {
        if (o.node.componentProperties) capture.applied.push(o.node.componentProperties);
      }
      ctx.stubs.set(stubId, capture);
      ctx.notes.push(
        `${where}: nested instance of "${instanceOf}" has no known contract — component ref proposed as "${stubId}" with a STUB child contract auto-proposed alongside (childStubs; API from observed applied values only, anatomy not captured — import the real child set to replace it)`,
      );
    }
    const component: Record<string, unknown> = { id: id ?? `${ctx.prefix}.${kebab(instanceOf)}` };
    const applied = first(m.occ, (n) => n.componentProperties);
    if (applied) {
      component.props = canonicalizeInstanceProps(instanceOf, applied, ctx, where);
    } else {
      ctx.notes.push(
        `${where}: fixed prop values of the nested "${instanceOf}" instance are not captured in dump v1 — declared fidelity limit, author them if the instance is configured`,
      );
    }
    // The instance's own geometry/paints belong to the child contract — elided.
    part.component = component;
    // A visibility binding on a component-ref part is a boolean prop +
    // visibleWhen, exactly like slot/swap/frame parts (field case: CBDS icon
    // toggles ↪️icon-left / ↪️icon-right — captured by the dump, previously
    // dropped here).
    const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
    if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
    if (visibleWhen && !part.visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  // FRAME (or COMPONENT root)
  if (isSpacer(m)) {
    const layout = invertLayout(m, false, parentMode, ctx, where);
    if (layout) part.layout = layout;
    const byProp = invertLayoutByProp(m, ctx, where);
    if (byProp) part.layoutByProp = byProp;
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const tokens = invertNodeTokens(m, false, ctx, where);

  // v9 shape (#42, dump v1.3): parametric leaf decor — the part carries the
  // captured geometry, hidden-pattern visibility, and per-variant placement.
  if (m.occ.some((o) => o.node.shape !== undefined)) {
    if (visibleWhen) part.visibleWhen = visibleWhen;
    invertHiddenVisibility(m, part, ctx, where);
    invertNodeShape(m, part, ctx, where);
    invertNodeOpacity(m, part, tokens, ctx, where);
    invertNodeEffects(m, tokens, ctx, where);
    attachTokens(ctx, part, tokens);
    return part;
  }

  // Slot wrapper: a frame whose sole child is a swap-bound instance.
  const soleChild = m.children.length === 1 ? m.children[0] : undefined;
  const soleSwap = soleChild?.type === 'INSTANCE' ? unifiedPropRef(soleChild, 'mainComponent', ctx, `${where}/${soleChild.name}`) : undefined;
  if (soleChild && soleSwap) {
    const layout = invertLayout(m, false, parentMode, ctx, where);
    if (layout) part.layout = layout;
    const byProp = invertLayoutByProp(m, ctx, where);
    if (byProp) part.layoutByProp = byProp;
    invertNodeOpacity(m, part, tokens, ctx, where);
    invertNodeEffects(m, tokens, ctx, where);
    attachTokens(ctx, part, tokens);
    const slot: Record<string, unknown> = { name: canonicalPropName(soleSwap) };
    const instanceOf = first(soleChild.occ, (n) => n.instanceOf);
    if (instanceOf && instanceOf !== 'Slot') {
      ctx.notes.push(
        `${where}: slot "${soleSwap}" holds a "${instanceOf}" instance as design-time content — defaultContent not proposed (dump v1 does not carry its configuration), review`,
      );
    } else {
      ctx.notes.push(`${where}: Slot-utility instance styling is the utility's own — elided`);
    }
    ctx.notes.push(
      `${where}: slot "${soleSwap}" accepts (INSTANCE_SWAP preferredValues) is not captured in dump v1 — author \`accepts\` manually`,
    );
    const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
    const optional = visibleRef === `Show ${soleSwap}`;
    if (optional) part.optional = true;
    else if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
    part.slot = slot;
    ctx.slots.push({ part, property: soleSwap, optional });
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (isWrapArtifact(m)) {
    invertNodeOpacity(m, part, tokens, ctx, where);
    invertNodeEffects(m, tokens, ctx, where);
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const layout = invertLayout(m, false, parentMode, ctx, where);
  if (layout) part.layout = layout;
  const byProp = invertLayoutByProp(m, ctx, where);
  if (byProp) part.layoutByProp = byProp;
  invertNodeOpacity(m, part, tokens, ctx, where);
  invertNodeEffects(m, tokens, ctx, where);
  attachTokens(ctx, part, tokens);
  const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
  if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
  const mode = m.occ[0].node.layout?.mode ?? null;
  const parts: Record<string, unknown> = {};
  const taken = new Set<string>();
  for (const child of m.children) {
    const built = buildPart(child, mode, ctx, `${where}/${child.name}`);
    if (built) parts[partKey(child.name, taken)] = built;
  }
  if (Object.keys(parts).length > 0) part.parts = parts;
  if (visibleWhen) part.visibleWhen = visibleWhen;
  return part;
}

/** A visibility binding that is not a slot's "Show <Property>" convention:
 *  a real BOOLEAN prop drives the part. Default recovery (dump v1.1) uses
 *  POSITIVE evidence only: the node hidden in the DEFAULT (first) variant
 *  recovers `false`; absence of the `hidden` field is ambiguous (visible, or
 *  a pre-v1.1 dump) and recovers nothing — the base-instance promotion pass
 *  may still hand a default over later. */
function applyVisibleBinding(part: Record<string, unknown>, property: string, ctx: Ctx, where: string, m?: Merged) {
  const name = canonicalPropName(property);
  if (!ctx.boolProps.some((b) => b.property === property)) {
    const hiddenInDefault =
      m?.occ.find((o) => o.variant === ctx.totalVariants[0])?.node.hidden === true;
    ctx.boolProps.push({ name, property, ...(hiddenInDefault ? { default: false } : {}) });
    ctx.notes.push(
      hiddenInDefault
        ? `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default false: the node is hidden in the default variant, dump v1.1)`
        : `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default not recoverable from dump v1, review)`,
    );
  }
  part.visibleWhen = { prop: name };
}

function canonicalizeInstanceProps(
  instanceOf: string,
  applied: Record<string, string | boolean>,
  ctx: Ctx,
  where: string,
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const childId = ctx.contractIdByName.get(instanceOf);
  const child = childId ? ctx.contractsById?.get(childId) : undefined;
  let mapped = 0;
  for (const [property, value] of Object.entries(applied)) {
    // Preferred: canonicalize through the child contract's own bindings —
    // the figma property name and value spelling map back to the canonical
    // prop name and enum value (Size/"Small" → size/"sm"), never by guessing.
    const childProp = child?.props.find((p) => p.bindings.figma.property === property.split('#')[0]);
    if (childProp && typeof value === 'string') {
      const values = (childProp.bindings.figma as { values?: Record<string, string> }).values;
      const canonical = values ? Object.entries(values).find(([, spelled]) => spelled === value)?.[0] : undefined;
      if (canonical !== undefined) {
        out[childProp.name] = canonical;
        mapped++;
        continue;
      }
    }
    if (childProp && typeof value === 'string' && !(childProp.bindings.figma as { values?: unknown }).values) {
      // TEXT props have no values map — the string passes through verbatim.
      out[childProp.name] = value;
      mapped++;
      continue;
    }
    if (childProp && typeof value === 'boolean') {
      out[childProp.name] = value;
      mapped++;
      continue;
    }
    // Fallback without the child contract in scope: canonical spelling.
    out[canonicalPropName(property)] = typeof value === 'string' ? camel(value) : value;
  }
  if (child && mapped === Object.keys(applied).length) {
    ctx.notes.push(`${where}: fixed props of "${instanceOf}" canonicalized through ${child.id}'s bindings`);
  } else {
    ctx.notes.push(`${where}: fixed props of "${instanceOf}" canonicalized by spelling (dump v1.1)${child ? ' — some values missing from ' + child.id + "'s bindings, verify" : " — verify against the child contract's bindings"}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base-instance flattening (field case: Eventz DS Button, node 2313-42)
// ---------------------------------------------------------------------------

/** One flattened variant's captured base-instance facts. */
interface BaseInstanceCapture {
  variant: string;
  instanceOf: string;
  properties: Record<string, string | boolean>;
}

/** PER-VARIANT flattening, pre-merge: a variant whose children include ONE
 *  instance of the set's own shared base component ("Button" wrapping a
 *  "Button" instance — with or without siblings such as a focus ring) is a
 *  wrapper artifact. The INSTANCE is the styled node: its layout and paints
 *  replace the wrapper's, its captured componentProperties are captured for
 *  promotion, and the instance node dissolves in place (dump v1 does not
 *  recurse into instances, so it contributes no children). Confidence
 *  requires the instance NOT be swap-bound (that is a slot) and
 *  componentProperties be captured (dump v1.1) — anything less falls back to
 *  the NAMED self-reference skip in buildPart. Mutates the (caller-cloned)
 *  variant nodes. */
function flattenBaseInstances(variants: DumpNode[], ctx: Ctx): BaseInstanceCapture[] {
  const captures: BaseInstanceCapture[] = [];
  for (const variant of variants) {
    const kids = variant.children ?? [];
    const selfKids = kids
      .map((node, index) => ({ node, index }))
      .filter(
        ({ node }) =>
          node.type === 'INSTANCE' &&
          !node.propRefs?.mainComponent &&
          isSelfInstance(node.instanceOf ?? node.name, ctx) &&
          node.componentProperties !== undefined,
      );
    if (selfKids.length !== 1) {
      // Zero: nothing to flatten. More than one: ambiguous — buildPart's
      // self-reference guard names the skip per instance.
      continue;
    }
    const { node: inst, index } = selfKids[0];
    // The instance's own styling speaks for the variant; wrapper fields
    // survive only where the instance carries nothing.
    if (inst.layout) variant.layout = inst.layout;
    if (inst.cornerRadius !== undefined) variant.cornerRadius = inst.cornerRadius;
    if (inst.fill) variant.fill = inst.fill;
    if (inst.stroke) {
      variant.stroke = inst.stroke;
      if (inst.strokeWeight !== undefined) variant.strokeWeight = inst.strokeWeight;
    }
    if (inst.bound) variant.bound = { ...(variant.bound ?? {}), ...inst.bound };
    if (inst.fillWidth !== undefined) variant.fillWidth = inst.fillWidth;
    if (inst.opacity !== undefined) variant.opacity = inst.opacity; // dump v1.2
    variant.children = [...kids.slice(0, index), ...(inst.children ?? []), ...kids.slice(index + 1)];
    captures.push({
      variant: variant.name,
      instanceOf: inst.instanceOf ?? inst.name,
      properties: inst.componentProperties!,
    });
    ctx.flattenedVariants.add(variant.name);
  }
  if (captures.length > 0) {
    const instanceOf = captures[0].instanceOf;
    ctx.notes.push(
      `${ctx.setName}:root: ${captures.length}/${ctx.totalVariants.length} variant(s) wrap an instance of the set's own base component "${instanceOf}" — flattened: the instance's styling and captured componentProperties speak for those variants (no self-referencing component ref; base component internals not captured — dump v1 stops at instances; anatomy reflects the wrapper)`,
    );
  }
  return captures;
}

/** PROMOTE the flattened base instance's captured componentProperties to the
 *  CONTRACT'S props: booleans become boolean props bound to the base's
 *  property names (or hand an observed default to a boolean the anatomy
 *  already discovered through a visibility binding), TEXT properties (the
 *  "#id"-suffixed string keys) become text props. Runs AFTER the anatomy is
 *  built so discovery through drawn structure wins and promotion only fills
 *  the gaps. */
function promoteBaseInstanceCaptures(captures: BaseInstanceCapture[], ctx: Ctx, opts?: { fillOnly?: boolean }) {
  if (captures.length === 0) return;
  const instanceOf = captures[0].instanceOf;
  const keys: string[] = [];
  for (const c of captures) {
    for (const key of Object.keys(c.properties)) if (!keys.includes(key)) keys.push(key);
  }
  for (const key of keys) {
    const property = key.split('#')[0];
    const name = canonicalPropName(property);
    const values = captures.map((c) => c.properties[key]).filter((v) => v !== undefined);
    const value = values[0];
    const distinct = [...new Set(values.map((v) => String(v)))];
    if (ctx.axes.some((a) => a.property === property || a.propName === name)) {
      // The wrapper's own axis: the pinned value names the base state the
      // flattened variant(s) delegate to — API stays the set's axes.
      ctx.notes.push(
        `base instance "${instanceOf}": property "${property}" is one of the set's own variant axes (pinned to ${distinct.join(', ')} in the flattened variant(s)) — not promoted`,
      );
      continue;
    }
    if (distinct.length > 1) {
      ctx.notes.push(
        `base instance "${instanceOf}": property "${property}" varies across the flattened variants (${distinct.join(', ')}) — default taken from the first`,
      );
    }
    if (typeof value === 'boolean') {
      const existing = ctx.boolProps.find((b) => b.property === property);
      if (existing) {
        if (existing.default === undefined) {
          existing.default = value;
          ctx.notes.push(
            `prop \`${existing.name}\`: default ${value} adopted from the base instance "${instanceOf}" (BOOLEAN property "${property}")`,
          );
        }
        continue;
      }
      if (opts?.fillOnly) continue; // state-group captures never invent API
      ctx.boolProps.push({ name, property, default: value });
      ctx.notes.push(
        `prop \`${name}\`: promoted from the base instance "${instanceOf}" (BOOLEAN property "${property}", default ${value})`,
      );
    } else if (key.includes('#')) {
      // Non-variant properties carry "#id" suffixes — a suffixed string key
      // is a TEXT property with certainty.
      if (ctx.textProps.some((t) => t.property === property)) continue;
      if (opts?.fillOnly) continue; // state-group captures never invent API
      registerTextProp(ctx, property, value, name);
      ctx.notes.push(
        `prop \`${name}\`: promoted from the base instance "${instanceOf}" (TEXT property "${property}", default "${value}")`,
      );
    } else if (ctx.textProps.some((t) => t.property === property)) {
      // Already a text prop discovered through a bound text node — the
      // capture confirms it, nothing to add.
      continue;
    } else if (!opts?.fillOnly) {
      ctx.notes.push(
        `base instance "${instanceOf}": string property "${property}" = "${value}" not promoted — without a "#id" suffix it is indistinguishable from the base component's own VARIANT property; model it as an axis on the set if it belongs in the API`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Child contract stubs (field case: CBDS Button → ds.icon)
// ---------------------------------------------------------------------------

/** One auto-proposed STUB contract for a nested instance whose child contract
 *  is not in scope. Mechanical and provisional by construction: props are the
 *  OBSERVED applied values only (a "#id"-suffixed key is a TEXT property with
 *  certainty — promoteBaseInstanceCaptures' rule; a bare string key is
 *  VARIANT/TEXT-ambiguous at an instance boundary and is modeled as an enum
 *  over the distinct observed spellings), the anatomy is an empty root (dump
 *  v1 stops at instances — the child's structure is simply not captured), and
 *  the description says so. The stub exists so the parent's component ref can
 *  EMIT instead of refusing; importing the real child set replaces it. */
function buildChildStub(capture: StubCapture, ctx: Ctx, fileKey: string | null): Record<string, unknown> {
  const observed = new Map<string, { suffixed: boolean; values: Array<string | boolean> }>();
  for (const applied of capture.applied) {
    for (const [key, value] of Object.entries(applied)) {
      const property = key.split('#')[0];
      const entry = observed.get(property) ?? { suffixed: key.includes('#'), values: [] };
      entry.values.push(value);
      observed.set(property, entry);
    }
  }
  const props: Array<Record<string, unknown>> = [];
  for (const [property, { suffixed, values }] of observed) {
    const name = canonicalPropName(property);
    const v0 = values[0];
    if (typeof v0 === 'boolean') {
      props.push({
        name,
        type: 'boolean',
        default: v0,
        bindings: { figma: { kind: 'BOOLEAN', property }, code: { prop: name } },
      });
    } else if (suffixed) {
      props.push({
        name,
        type: 'text',
        default: v0,
        bindings: { figma: { kind: 'TEXT', property }, code: { prop: name } },
      });
    } else {
      // Distinct observed spellings, deduped by canonical value — the same
      // canonicalization the parent's component.props go through.
      const byCanonical = new Map<string, string>();
      for (const v of values) {
        if (typeof v === 'string' && !byCanonical.has(camel(v))) byCanonical.set(camel(v), v);
      }
      props.push({
        name,
        type: { enum: [...byCanonical.keys()] },
        default: camel(String(v0)),
        bindings: {
          figma: { kind: 'VARIANT', property, values: Object.fromEntries(byCanonical) },
          code: { prop: name },
        },
      });
    }
  }
  const name = pascalComponentName(capture.instanceOf);
  return {
    $schema: './contract.schema.json',
    id: capture.id,
    name,
    version: '0.1.0',
    status: 'draft',
    description: `STUB contract auto-proposed for the nested "${capture.instanceOf}" instances of ${ctx.setName} — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries). Import the child set to replace this stub.`,
    semantics: { element: 'span' },
    props,
    states: [],
    anatomy: { root: {} },
    anchors: {
      figma: { fileKey, componentSetKey: null },
      code: { importPath: `src/components/${name}`, export: name },
    },
  };
}

// ---------------------------------------------------------------------------
// State-axis promotion: root diffs → anatomy.root.states overrides
// ---------------------------------------------------------------------------

const paintKey = (p?: { var?: string; hex?: string; alpha?: number }): string =>
  p === undefined ? 'none' : p.var !== undefined ? `var:${p.var}` : `hex:${paintCssHex(p)}`;

/** Push a mint observation for a STATE override — same machinery as base
 *  observations (ONE mintTokens call dedupes/claims across both), with the
 *  part spelled `state-<state>` so minted paths read
 *  `imported.<component>.state-hover.background-color` and never collide
 *  with a base usage site. */
function mintStateObservation(
  ctx: Ctx,
  target: Record<string, string>,
  state: string,
  cssProperty: string,
  kind: 'color' | 'px' | 'number',
  occ: Array<{ variant: string; value: string | number }>,
  source: string,
) {
  if (!ctx.mint) return;
  ctx.mint.observations.push({
    nodePath: `${ctx.setName}:root (state ${state})`,
    part: `state-${state}`,
    cssProperty,
    kind,
    occurrences: occ.map((o) => ({
      variant: o.variant,
      axisValues: ctx.mint!.axisValuesByVariant.get(o.variant) ?? {},
      value: o.value,
    })),
    target,
    source,
  });
}

/** Diff ONE promoted state's (flattened) variants against the matching
 *  default-state variants and propose root `states` overrides: bound facts as
 *  (substituted) refs, raw literals as mint observations, everything the
 *  vocabulary cannot carry as a NAMED note. Channels are the root box facts
 *  the dump carries: fill, stroke (+weight), corner radius, node opacity.
 *  Depth-1 part fills that change are RECEIPTED (part-level state overrides
 *  are outside the vocabulary — STYLE-FIDELITY B7); a child drawn ONLY in
 *  the focus state carrying a stroke inverts to the focus-visible outline
 *  pair (the ds.button focus-ring convention). */
function proposeStateDiffs(
  ctx: Ctx,
  state: string,
  group: DumpNode[],
  baseByName: Map<string, DumpNode>,
  baseChildNames: Set<string>,
  baseRootTokens: Record<string, string>,
  target: Record<string, string>,
) {
  const where = `${ctx.setName}:root`;
  const missing = group.filter((v) => !baseByName.get(v.name));
  if (missing.length > 0) {
    ctx.notes.push(
      `${where}: state "${state}" variant(s) ${missing.map((v) => v.name).join(', ')} have no matching default-state variant — state diffs skipped for them, review`,
    );
  }
  const occs = group
    .filter((v) => baseByName.has(v.name))
    .map((v) => ({ variant: v.name, node: v, base: baseByName.get(v.name)! }));
  if (occs.length === 0) return;

  const paintChannel = (
    cssProp: string,
    paintName: string,
    pick: (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined,
  ) => {
    if (!occs.some((o) => paintKey(pick(o.node)) !== paintKey(pick(o.base)))) return;
    const paints = occs.map((o) => ({ variant: o.variant, paint: pick(o.node) }));
    if (paints.some((p) => p.paint === undefined)) {
      ctx.notes.push(
        `${where}: ${paintName} differs in state "${state}" but is absent in some of its variant(s) — a state override cannot unset a channel; NAMED, not proposed (review)`,
      );
      return;
    }
    if (paints.every((p) => p.paint!.var !== undefined)) {
      const u = unifyRefs(
        paints.map((p) => ({ variant: p.variant, path: dotPath(p.paint!.var!) })),
        ctx.axes,
      );
      if (u.kind === 'ref') {
        if (u.ref !== baseRootTokens[cssProp]) target[cssProp] = u.ref;
      } else if (u.kind === 'drift') {
        ctx.notes.push(`${where} ${paintName} (state ${state}): ${u.detail}`);
      }
      return;
    }
    if (paints.every((p) => p.paint!.hex !== undefined)) {
      reportUnbound(ctx, `${where} (state ${state})`, paintName, paintCssHex(paints[0].paint!));
      mintStateObservation(
        ctx, target, state, cssProp, 'color',
        paints.map((p) => ({ variant: p.variant, value: paintCssHex(p.paint!) })),
        `${where} (state ${state})|${paintName}`,
      );
      if (!ctx.mint) {
        ctx.notes.push(
          `${where}: ${paintName} changes in state "${state}" (${paintCssHex(paints[0].paint!)}) — a literal state override needs minting (mintUnbound); NAMED, not proposed`,
        );
      }
      return;
    }
    ctx.notes.push(
      `${where}: ${paintName} in state "${state}" mixes bound and raw paints across variants — not proposed, review`,
    );
  };

  const numberChannel = (
    cssProp: string,
    fieldName: string,
    kind: 'px' | 'number',
    pick: (n: DumpNode) => number | undefined,
    fallback: number,
    boundFields: string[],
  ) => {
    const value = (n: DumpNode) => pick(n) ?? fallback;
    if (!occs.some((o) => value(o.node) !== value(o.base))) return;
    if (occs.some((o) => boundFields.some((f) => o.node.bound?.[f] !== undefined || o.base.bound?.[f] !== undefined))) {
      ctx.notes.push(
        `${where}: ${fieldName} differs in state "${state}" with bound variables in play — bound number-channel state inversion is not implemented; NAMED, review`,
      );
      return;
    }
    reportUnbound(ctx, `${where} (state ${state})`, fieldName, value(occs[0].node));
    mintStateObservation(
      ctx, target, state, cssProp, kind,
      occs.map((o) => ({ variant: o.variant, value: value(o.node) })),
      `${where} (state ${state})|${fieldName}`,
    );
    if (!ctx.mint) {
      ctx.notes.push(
        `${where}: ${fieldName} changes in state "${state}" — a literal state override needs minting (mintUnbound); NAMED, not proposed`,
      );
    }
  };

  paintChannel('background-color', 'fill', (n) => (n.type === 'TEXT' ? undefined : n.fill));
  paintChannel('border-color', 'stroke', (n) => n.stroke);
  numberChannel('border-width', 'strokeWeight', 'px', (n) => n.strokeWeight, 0, ['strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight']);
  numberChannel('border-radius', 'cornerRadius', 'px', (n) => n.cornerRadius, 0, ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']);
  numberChannel('opacity', 'opacity', 'number', (n) => n.opacity, 1, ['opacity']);

  // A state-only border cannot render honestly outside focus-visible: the
  // base element draws `border: 0` (no border-style to inherit). The
  // focus-visible pair remaps to the outline vocabulary the generators
  // already ship (outline-style/offset ride the focus boilerplate).
  if (baseRootTokens['border-color'] === undefined && baseRootTokens['border-width'] === undefined) {
    const hasBorder = target['border-color'] !== undefined || target['border-width'] !== undefined;
    if (hasBorder && state === 'focus-visible') {
      for (const [from, to] of [['border-color', 'outline-color'], ['border-width', 'outline-width']] as const) {
        if (target[from] !== undefined) {
          target[to] = target[from];
          delete target[from];
        }
      }
      remapStateMintTargets(ctx, target, state);
      ctx.notes.push(
        `${where}: state "${state}" adds a border the base does not draw — proposed as the focus OUTLINE pair (outline-color/outline-width; the generators' focus boilerplate carries outline-style + offset), review`,
      );
    } else if (hasBorder) {
      delete target['border-color'];
      delete target['border-width'];
      dropStateMintTargets(ctx, target, state, ['border-color', 'border-width']);
      ctx.notes.push(
        `${where}: state "${state}" adds a border the base does not draw — the base rule sets border: 0 and a state override cannot add border-style; NAMED, not proposed (review)`,
      );
    }
  }

  // Children drawn ONLY in this state's variants (kept with their variant).
  const extras = new Map<string, Array<{ variant: string; node: DumpNode }>>();
  for (const o of occs) {
    for (const c of o.node.children ?? []) {
      if (baseChildNames.has(c.name)) continue;
      const list = extras.get(c.name) ?? [];
      list.push({ variant: o.variant, node: c });
      extras.set(c.name, list);
    }
  }
  for (const [childName, found] of extras) {
    const at = `${where}/${childName}`;
    const nodes = found.map((f) => f.node);
    if (nodes.every((n) => n.hidden === true)) {
      ctx.notes.push(
        `${at}: drawn only in state "${state}" variants and hidden — design-time helper, not proposed (review)`,
      );
      continue;
    }
    const strokeOnly =
      nodes.every((n) => n.stroke !== undefined && (n.children ?? []).length === 0 && n.text === undefined);
    if (state === 'focus-visible' && strokeOnly) {
      // The drawn focus ring → the outline pair (the ds.button convention).
      if (nodes.every((n) => n.stroke!.var !== undefined)) {
        const distinct = [...new Set(nodes.map((n) => dotPath(n.stroke!.var!)))];
        if (distinct.length === 1) target['outline-color'] = `{${distinct[0]}}`;
        else ctx.notes.push(`${at}: focus-ring stroke binds differently across variants (${distinct.join(' vs ')}) — not proposed, review`);
      } else if (nodes.every((n) => n.stroke!.hex !== undefined)) {
        mintStateObservation(
          ctx, target, state, 'outline-color', 'color',
          found.map((f) => ({ variant: f.variant, value: paintCssHex(f.node.stroke!) })),
          `${at} (state ${state})|stroke`,
        );
        reportUnbound(ctx, `${at} (state ${state})`, 'stroke', paintCssHex(nodes[0].stroke!));
      }
      if (nodes.some((n) => n.strokeWeight !== undefined)) {
        mintStateObservation(
          ctx, target, state, 'outline-width', 'px',
          found.map((f) => ({ variant: f.variant, value: f.node.strokeWeight ?? 0 })),
          `${at} (state ${state})|strokeWeight`,
        );
        reportUnbound(ctx, `${at} (state ${state})`, 'strokeWeight', nodes[0].strokeWeight ?? 0);
      }
      ctx.notes.push(
        `${at}: drawn only in the focus state and carries a stroke — inverted to focus-visible outline overrides (outline-color/outline-width); its own corner radius is not carried (the outline follows the root's shape + offset), review`,
      );
      continue;
    }
    ctx.notes.push(
      `${at}: present only in state "${state}" variants — per-state anatomy has no contract vocabulary; NAMED, not proposed (review)`,
    );
  }

  // Depth-1 part fills that change with the state: receipted, not proposed.
  const partDiffs = new Set<string>();
  for (const o of occs) {
    for (const c of o.node.children ?? []) {
      const bc = (o.base.children ?? []).find((x) => x.name === c.name);
      if (bc && paintKey(c.fill) !== paintKey(bc.fill)) partDiffs.add(c.name);
    }
  }
  for (const name of partDiffs) {
    ctx.notes.push(
      `${where}/${name}: fill differs in state "${state}" — part-level state overrides are outside the contract vocabulary (root states only, STYLE-FIDELITY B7); NAMED, not proposed (review)`,
    );
  }
}

/** After a border→outline remap the already-queued mint observations still
 *  point at the old cssProperty — retarget them so the minted ref lands on
 *  the outline key. */
function remapStateMintTargets(ctx: Ctx, target: Record<string, string>, state: string) {
  if (!ctx.mint) return;
  for (const o of ctx.mint.observations) {
    if (o.target !== target || o.part !== `state-${state}`) continue;
    if (o.cssProperty === 'border-color') o.cssProperty = 'outline-color';
    if (o.cssProperty === 'border-width') o.cssProperty = 'outline-width';
  }
}

/** Drop queued mint observations for state channels judged unrepresentable. */
function dropStateMintTargets(ctx: Ctx, target: Record<string, string>, state: string, cssProps: string[]) {
  if (!ctx.mint) return;
  ctx.mint.observations = ctx.mint.observations.filter(
    (o) => !(o.target === target && o.part === `state-${state}` && cssProps.includes(o.cssProperty)),
  );
}

// ---------------------------------------------------------------------------
// Whole-set proposal
// ---------------------------------------------------------------------------

export function proposeFromDump(
  set: DumpSet,
  opts: {
    corpus: TokenCorpus;
    contractIdByName: Map<string, string>;
    contractsById?: Map<string, MinimalChildContract>;
    prefix?: string;
    fileKey?: string | null;
    /** Mint provisional tokens (core/mint-tokens.ts) from the unbound-value
     *  observations and BIND the proposal to them, instead of dropping every
     *  degraded style. Default false — the classic report-only behavior. */
    mintUnbound?: boolean;
  },
): FigmaProposalResult {
  const prefix = opts.prefix ?? 'ds';
  const preNotes: string[] = [];

  // Interaction-state axis promotion (see the section doc above): detect the
  // axis over the FULL variant set, then partition — default-state variants
  // are the base the whole pipeline runs on; each promoted state's variants
  // (and the disabled group) are kept aside, names stripped of the state
  // pair, for the root-diff pass after the anatomy is built.
  let statePromo = detectStateAxis(parseAxes(set.variants.map((v) => v.name)), preNotes);
  let baseVariants: DumpNode[] | null = null;
  const stateGroups = new Map<PromotedState, DumpNode[]>();
  let disabledGroup: DumpNode[] = [];
  if (statePromo) {
    const promo = statePromo;
    const valueOf = (v: DumpNode) => axisValuesOf(v.name)[promo.axis.property];
    if (set.variants.some((v) => valueOf(v) === undefined)) {
      preNotes.push(
        `variant axis "${promo.axis.property}": interaction-state axis detected but some variant names omit the pair — promotion unsafe, axis kept as an enum prop; review`,
      );
      statePromo = null;
    } else {
      const strip = (v: DumpNode): DumpNode => ({
        ...(JSON.parse(JSON.stringify(v)) as DumpNode),
        name: stripAxisFromName(v.name, promo.axis.property, set.setName),
      });
      baseVariants = set.variants.filter((v) => valueOf(v) === promo.defaultValue).map(strip);
      for (const p of promo.promoted) {
        stateGroups.set(p.state, set.variants.filter((v) => valueOf(v) === p.value).map(strip));
      }
      if (promo.disabledValue !== undefined) {
        disabledGroup = set.variants.filter((v) => valueOf(v) === promo.disabledValue).map(strip);
      }
      preNotes.push(
        `variant axis "${promo.axis.property}" (${promo.axis.values.join('|')}) IS the platform's interaction states, not API — promoted: the axis is NOT a prop; anatomy and base facts come from the ${baseVariants.length} default-state variant(s); ${promo.promoted
          .map((p) => `${p.value}→${p.state}`)
          .join(', ')} propose root state overrides${promo.disabledValue !== undefined ? `; ${promo.disabledValue}→ a \`disabled\` BOOLEAN prop + disabled state block` : ''}`,
      );
    }
  }

  const variantNames = (baseVariants ?? set.variants).map((v) => v.name);
  const axes = parseAxes(variantNames);
  const enumAxes = axes.filter((a) => !isBoolAxis(a.values));
  const ctx: Ctx = {
    setName: set.setName,
    axes,
    totalVariants: variantNames,
    corpus: opts.corpus,
    contractIdByName: opts.contractIdByName,
    contractsById: opts.contractsById,
    prefix,
    notes: [],
    unbound: [],
    textProps: [],
    boolProps: [],
    slots: [],
    flattenedVariants: new Set(),
    stubs: new Map(),
    mint: opts.mintUnbound
      ? {
          axes: enumAxes.map((a) => ({ propName: a.propName, values: a.values.map(camel) })),
          axisValuesByVariant: new Map(
            variantNames.map((v) => {
              const record: Record<string, string> = {};
              for (const [property, value] of Object.entries(axisValuesOf(v))) {
                const axis = enumAxes.find((a) => a.property === property);
                if (axis) record[axis.propName] = camel(value);
              }
              return [v, record];
            }),
          ),
          observations: [],
          partialSources: new Set(),
          attach: [],
        }
      : undefined,
  };

  ctx.notes.push(...preNotes);

  // Base-instance flattening runs PRE-merge, per variant, on a private clone
  // (a caller's dump is never mutated): each variant wrapping an instance of
  // the set's own base component dissolves the instance in place — its
  // styling speaks for the variant, its captured componentProperties are
  // promoted after the anatomy is built. (With state promotion the base
  // variants were already cloned + name-stripped above.)
  const variants = baseVariants ?? (JSON.parse(JSON.stringify(set.variants)) as DumpNode[]);
  const captures = flattenBaseInstances(variants, ctx);
  const stateGroupCaptures: BaseInstanceCapture[] = [];
  if (statePromo) {
    // The state groups get the SAME flattening before diffing — their styled
    // facts may live on a wrapped base instance too (Eventz focus variants).
    // Their captures do NOT promote (the base group owns promotion) and
    // their names must not pollute ctx.flattenedVariants (same stripped
    // names as base variants), so a scratch context absorbs both.
    const scratch: Ctx = { ...ctx, notes: [], flattenedVariants: new Set() };
    for (const group of [...stateGroups.values(), disabledGroup]) {
      stateGroupCaptures.push(...flattenBaseInstances(group, scratch));
    }
    if (stateGroupCaptures.length > 0) {
      ctx.notes.push(
        `${set.setName}: ${stateGroupCaptures.length} state-axis variant(s) wrapped an instance of the set's own base component — flattened before state diffing (same rule as the default variants); their captured componentProperties only FILL defaults of props the base anatomy already discovered`,
      );
    }
  }

  const merged = mergeOcc(
    'root',
    variants.map((v) => ({ variant: v.name, node: v })),
    ctx.notes,
    `${set.setName}:root`,
  );
  const where = `${set.setName}:root`;

  const root: Record<string, unknown> = {};
  const rootLayout = invertLayout(merged, true, null, ctx, where);
  if (rootLayout) root.layout = rootLayout;
  const rootByProp = invertLayoutByProp(merged, ctx, where);
  if (rootByProp) root.layoutByProp = rootByProp;
  const rootTokens = invertNodeTokens(merged, true, ctx, where);

  // Generator artifact: a root whose only child is the auto-injected `label`
  // text node (contracts with a `children` text prop and no parts). The node
  // is not a part — its text tokens hoist to the root.
  const only = merged.children.length === 1 ? merged.children[0] : undefined;
  const autoLabel =
    only && only.type === 'TEXT' && only.name === 'label' && unifiedPropRef(only, 'characters', ctx, `${where}/label`);
  if (only && autoLabel) {
    const textTokens = invertTextTokens(only, ctx, `${where}/label`);
    Object.assign(rootTokens, textTokens);
    // The label's tokens hoisted — retarget its captured mint observations
    // to the record that actually ships (rootTokens).
    if (ctx.mint) {
      for (const o of ctx.mint.observations) if (o.target === textTokens) o.target = rootTokens;
    }
    registerTextProp(ctx, autoLabel, first(only.occ, (n) => n.text?.characters) ?? '', 'children');
    ctx.notes.push(
      `${where}/label: sole root text node named "label" is the generator's auto-injected children label — hoisted to root tokens, bound prop proposed as \`children\``,
    );
  } else {
    const mode = merged.occ[0].node.layout?.mode ?? null;
    const parts: Record<string, unknown> = {};
    const taken = new Set<string>();
    for (const child of merged.children) {
      const built = buildPart(child, mode, ctx, `${where}/${child.name}`);
      if (built) parts[partKey(child.name, taken)] = built;
    }
    if (Object.keys(parts).length > 0) root.parts = parts;
  }
  invertNodeOpacity(merged, root, rootTokens, ctx, where);
  invertNodeEffects(merged, rootTokens, ctx, where);
  attachTokens(ctx, root, rootTokens);

  // Promotion from the flattened base instance(s) — after the anatomy, so
  // structure discovered from drawn nodes wins and promotion fills the gaps.
  // State-group captures only FILL defaults of already-discovered props
  // (fillOnly) — a property observed only in state variants is design-time
  // state, never invented API.
  promoteBaseInstanceCaptures(captures, ctx);
  promoteBaseInstanceCaptures(stateGroupCaptures, ctx, { fillOnly: true });

  // State-axis promotion: diff each promoted state's variants against the
  // base and collect root `states` overrides (bound → refs now; raw → mint
  // observations resolved in the mint pass below, writing straight into
  // these records). Attached to the contract AFTER the mint pass.
  const stateOverrides: Record<string, Record<string, string>> = {};
  if (statePromo) {
    const baseByName = new Map(variants.map((v) => [v.name, v]));
    const baseChildNames = new Set<string>();
    for (const v of variants) for (const c of v.children ?? []) baseChildNames.add(c.name);
    const groups: Array<[string, DumpNode[]]> = [...stateGroups.entries()];
    if (disabledGroup.length > 0) groups.push(['disabled', disabledGroup]);
    for (const [state, group] of groups) {
      const target = (stateOverrides[state] ??= {});
      proposeStateDiffs(ctx, state, group, baseByName, baseChildNames, rootTokens, target);
    }
    // The disabled axis value → a REAL boolean prop (native attribute on
    // interactive elements), bound the forward generator's way.
    if (statePromo.disabledValue !== undefined) {
      if (ctx.boolProps.some((b) => b.name === 'disabled')) {
        ctx.notes.push(
          `prop \`disabled\`: axis value "${statePromo.axis.property}=${statePromo.disabledValue}" maps to the disabled state but a \`disabled\` boolean already exists — not re-promoted, review`,
        );
      } else {
        ctx.boolProps.push({ name: 'disabled', property: 'Disabled', default: false });
        ctx.notes.push(
          `prop \`disabled\`: promoted from axis value "${statePromo.axis.property}=${statePromo.disabledValue}" — a BOOLEAN prop (native disabled attribute on interactive elements), bound to design property "Disabled" (the forward generator's spelling; the imported set spelled it as an axis value — rename consequence documented here)`,
        );
      }
    }
  }

  // Default-slot judgment: the first non-optional slot in tree order is the
  // component's main content — name `children` (the code-side default slot).
  const defaultSlot = ctx.slots.find((s) => !s.optional);
  for (const s of ctx.slots) {
    const name = s === defaultSlot ? 'children' : canonicalPropName(s.property);
    const slot = s.part.slot as Record<string, unknown>;
    slot.name = name;
    if (pascal(name) !== s.property) slot.figmaProperty = s.property;
    if (propNameSanitized(s.property)) {
      ctx.notes.push(
        `slot \`${name}\`: Figma property "${s.property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (slot.figmaProperty)`,
      );
    }
    if (s === defaultSlot) {
      ctx.notes.push(
        `slot "${s.property}": first non-optional slot in tree order — judged the DEFAULT slot (name \`children\`); rename if it is not the main content`,
      );
    }
  }

  // Props: variant axes first (in axis order), then text props in tree
  // discovery order, then visibility booleans — mirroring the API a contract
  // author would write and extract/propose.ts conventions.
  const props: Array<Record<string, unknown>> = [];
  for (const axis of axes) {
    if (isBoolAxis(axis.values)) {
      props.push({
        name: axis.propName,
        type: 'boolean',
        default: camel(axis.values[0]) === 'true',
        bindings: {
          figma: {
            kind: 'VARIANT',
            property: axis.property,
            values: Object.fromEntries(axis.values.map((v) => [camel(v), v])),
          },
          code: { prop: axis.propName },
        },
      });
      ctx.notes.push(
        `prop \`${axis.propName}\`: true/false variant axis proposed as a boolean (extract/reconcile.ts bool⇄axis rule)`,
      );
      continue;
    }
    props.push({
      name: axis.propName,
      type: { enum: axis.values.map(camel) },
      default: camel(axis.values[0]),
      bindings: {
        figma: {
          kind: 'VARIANT',
          property: axis.property,
          values: Object.fromEntries(axis.values.map((v) => [camel(v), v])),
        },
        code: { prop: axis.propName },
      },
    });
    if (axis.values.length === 2) {
      ctx.notes.push(
        `prop \`${axis.propName}\`: two-value axis [${axis.values.join(', ')}] kept as an ENUM (both states render truthfully on both surfaces); a code boolean is a compatible code-side binding — see extract/reconcile.ts bool⇄axis treatment`,
      );
    }
  }
  for (const t of ctx.textProps) {
    props.push({
      name: t.name,
      type: 'text',
      default: t.default,
      bindings: {
        figma: { kind: 'TEXT', property: t.property },
        code: { prop: t.name },
      },
    });
  }
  for (const b of ctx.boolProps) {
    props.push({
      name: b.name,
      type: 'boolean',
      // Promoted base-instance booleans carry the observed default; visibility
      // booleans have none (not recoverable from dump v1 — noted at discovery).
      ...(b.default !== undefined ? { default: b.default } : {}),
      bindings: {
        figma: { kind: 'BOOLEAN', property: b.property },
        code: { prop: b.name },
      },
    });
  }

  // Text-prop convention (NOTE-ONLY, extract/reconcile keeps prop-name
  // fidelity to the design property): repo contracts bind a component's main
  // label to the code prop "children" (ds.button). Renaming mechanically
  // would break the design-property round trip, so the convention is named
  // for the reviewer instead.
  if (ctx.textProps.length === 1 && ctx.textProps[0].name !== 'children') {
    ctx.notes.push(
      `prop \`${ctx.textProps[0].name}\`: the single text prop carries the component's main content — repo contracts bind main content to code prop "children" (ds.button convention); adopt by setting bindings.code.prop to "children" when this is the label (note-only, nothing renamed mechanically)`,
    );
  }

  // Identifier sanitization at PROPOSAL, not refusal at emit: the component
  // name must be PascalCase (it becomes the export and its file names) and
  // every prop/slot name a legal identifier. Original spellings survive in
  // the figma bindings; every sanitization is a named note.
  const componentName = pascalComponentName(set.setName);
  if (componentName !== set.setName) {
    ctx.notes.push(
      `contract name: drawn set name "${set.setName}" is not a PascalCase component name — proposed as "${componentName}" (the canvas set keeps its own name; the componentSetKey/nodeId anchors carry identity)`,
    );
  }
  for (const p of props) {
    const property = (p.bindings as { figma?: { property?: string } }).figma?.property;
    if (property && propNameSanitized(property)) {
      ctx.notes.push(
        `prop \`${String(p.name)}\`: Figma property "${property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)`,
      );
    }
  }

  // Deterministic semantics inference (name/axis table — zero AI, see
  // inferSemantics). A detected interaction-state axis is the structural
  // corroboration that the component is interactive.
  const inferred = inferSemantics(set.setName, axes, statePromo !== null);
  const contract: Record<string, unknown> = {
    $schema: './contract.schema.json',
    id: `${prefix}.${kebab(set.setName)}`,
    name: componentName,
    version: '0.1.0',
    status: 'draft',
    description: `PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.`,
    semantics: inferred
      ? {
          element: inferred.element,
          ...(inferred.role ? { role: inferred.role } : {}),
          ...(inferred.elementByProp ? { elementByProp: inferred.elementByProp } : {}),
        }
      : { element: 'div' },
    props,
    states: [],
    anatomy: { root },
    anchors: {
      figma: {
        fileKey: opts.fileKey ?? null,
        componentSetKey: set.key ?? null,
        ...(set.nodeId ? { nodeId: set.nodeId } : {}),
      },
      code: { importPath: `src/components/${componentName}`, export: componentName },
    },
  };

  // Mint pass (mintUnbound): every captured observation becomes a binding to
  // a provisional `imported.*` leaf where the values allow it — the proposal
  // keeps its styling at literal fidelity instead of shipping naked. Runs
  // BEFORE schema validation so a bad minted ref is refused, not returned.
  let mintedTokens: FigmaProposalResult['mintedTokens'];
  if (ctx.mint && ctx.mint.observations.length > 0) {
    const observations = ctx.mint.observations;
    const minted = mintTokens(kebab(set.setName), observations, ctx.mint.axes);
    const bySource = new Map<string, { total: number; bound: number }>();
    minted.bindings.forEach((binding, i) => {
      const obs = observations[i];
      if (binding.ref) obs.target[obs.cssProperty] = binding.ref;
      else if (binding.reason) ctx.notes.push(`${obs.nodePath} ${obs.cssProperty}: ${binding.reason}`);
      if (obs.source) {
        const s = bySource.get(obs.source) ?? { total: 0, bound: 0 };
        s.total++;
        if (binding.ref) s.bound++;
        bySource.set(obs.source, s);
      }
    });
    // Token records whose first binding arrived from the mint pass.
    for (const { holder, tokens } of ctx.mint.attach) {
      if (Object.keys(tokens).length > 0 && holder.tokens === undefined) holder.tokens = tokens;
    }
    // A fully minted usage site is bound now — no longer an UNBOUND entry.
    const partial = ctx.mint.partialSources;
    ctx.unbound = ctx.unbound.filter((u) => {
      const s = bySource.get(`${u.nodePath}|${u.property}`);
      return !(s && s.bound === s.total && !partial.has(`${u.nodePath}|${u.property}`));
    });
    for (const e of minted.entries) {
      ctx.notes.push(
        `MINTED ${e.ref} = ${e.value} — machine-named from a resolved value — rename against your real tokens (provisional); bound at: ${e.usageSites.join(', ')}`,
      );
    }
    mintedTokens = { tree: minted.tree, count: minted.count, entries: minted.entries };
  }

  // State-axis promotion, final attach — AFTER the mint pass so minted state
  // refs have landed in their records. States whose overrides all refused
  // are dropped BY NAME; the survivors become the contract's `states` + root
  // overrides, and figmaStatePreviews opts in when its own refusal rules
  // hold (every declared state has overrides — guaranteed here; overrides
  // substitute ≤1 enum prop; the "State" design property is free).
  if (statePromo) {
    const ORDER = ['hover', 'active', 'focus-visible', 'disabled'];
    const declared = ORDER.filter((s) => stateOverrides[s] !== undefined);
    const present = declared.filter((s) => Object.keys(stateOverrides[s]).length > 0);
    for (const s of declared) {
      if (!present.includes(s)) {
        ctx.notes.push(
          `state "${s}": promoted from the axis but no root override was recoverable — state not declared (its variants render identically to default at the root, or every channel refused by name above)`,
        );
      }
    }
    if (present.length > 0) {
      root.states = Object.fromEntries(present.map((s) => [s, stateOverrides[s]]));
      contract.states = present;
      const enumNames = new Set(
        props.filter((p) => typeof p.type === 'object' && 'enum' in (p.type as object)).map((p) => p.name as string),
      );
      const substProps = new Set<string>();
      for (const s of present) {
        for (const ref of Object.values(stateOverrides[s])) {
          for (const m of ref.matchAll(/\{([a-z][\w-]*)\}/g)) {
            if (enumNames.has(m[1])) substProps.add(m[1]);
          }
        }
      }
      const statePropertyTaken = props.some(
        (p) => (p.bindings as { figma?: { property?: string } }).figma?.property === STATE_PREVIEW_PROPERTY,
      );
      if (substProps.size <= 1 && !statePropertyTaken) {
        contract.figmaStatePreviews = true;
        ctx.notes.push(
          `figmaStatePreviews: true — regenerating the canvas draws the promoted states as a "${STATE_PREVIEW_PROPERTY}" preview axis (values ${['Default', ...present.filter((s) => s !== 'disabled').map(statePreviewLabel)].join('|')}, the shared spelling rules) — a RENAME relative to the imported axis "${statePromo.axis.property}" (${statePromo.axis.values.join('|')}); the contract vocabulary carries no custom state-axis spellings, so the original spelling lives in this note and in the anchors' set`,
        );
      } else {
        ctx.notes.push(
          `figmaStatePreviews NOT set: ${statePropertyTaken ? `a prop already binds the reserved design property "${STATE_PREVIEW_PROPERTY}"` : `state overrides substitute ${substProps.size} enum props (${[...substProps].join(', ')}) — previews multiply exactly ONE primary axis`} — canvas state previews refused by name, review`,
        );
      }
    } else {
      ctx.notes.push(
        `state axis promoted but NO state overrides were recoverable — the contract declares no states; the axis still does not become a prop (its values are platform states), review the notes above`,
      );
    }
  }

  // Auto-proposed child stubs (see buildChildStub) — each must parse too.
  const childStubs = [...ctx.stubs.values()].map((capture) =>
    buildChildStub(capture, ctx, opts.fileKey ?? null),
  );

  // Refuse to emit an unusable proposal.
  ContractSchema.parse(contract);
  for (const stub of childStubs) ContractSchema.parse(stub);
  if (inferred) {
    ctx.notes.unshift(inferred.note);
  } else {
    ctx.notes.unshift(`semantics.element defaulted to "div" — element/role/ARIA are not drawn on the canvas and the name/axis inference table matched nothing; set the real host element`);
  }
  for (const u of ctx.unbound) {
    ctx.notes.push(
      `UNBOUND ${u.nodePath} ${u.property} = ${u.value} — no token invented; nearest tokens by value: ${
        u.suggestions.length > 0 ? u.suggestions.map((s) => `{${s}}`).join(', ') : '(none found)'
      }`,
    );
  }
  return {
    contract,
    notes: ctx.notes,
    unbound: ctx.unbound,
    ...(mintedTokens ? { mintedTokens } : {}),
    ...(childStubs.length > 0 ? { childStubs } : {}),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function figmaProposalsReport(
  results: Array<{ setName: string; proposal: FigmaProposalResult }>,
): string {
  const lines = [
    '# Proposed contracts — design-side extraction report',
    '',
    `${results.length} component set(s) extracted from the canvas dump. Every proposal parses against the contract schema. A proposal is a STARTING POINT: unbound values are NAMED below (never silently tokenized), and each note is a review line item.`,
    '',
  ];
  for (const { setName, proposal } of results) {
    const c = proposal.contract as { props: unknown[] };
    lines.push(`## ${setName}`, '', `- proposed: ${c.props.length} props`);
    for (const n of proposal.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}
