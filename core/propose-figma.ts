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
import { isDumpSet, type DumpEffect, type DumpNode, type DumpPaint, type DumpPreferredValue, type DumpSet } from '../extract/figma/types.js';
import type { TokenCorpus } from './token-corpus.js';
import { capturedTokensFromDump } from './captured-tokens.js';
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
 *  part of the name. A digit-led spelling gets the componentIdSlug digit-led
 *  discipline (rule 4 below) applied to prop code bindings: a code identifier
 *  cannot start with a digit, so the deterministic prefix "p" is applied —
 *  the kit's "2nd paragraph" TEXT property becomes prop \`p2ndParagraph\`
 *  ("2ndParagraph" is not a legal camelCase identifier and emit refuses it);
 *  an all-illegal name becomes "p". Every rename is a NAMED note at the call
 *  sites (propNameDigitLed is the trigger); the figma binding keeps the
 *  original spelling. */
export const canonicalPropName = (property: string): string => {
  const bare = property.split('#')[0].trim();
  if (/^[a-z][A-Za-z0-9]*$/.test(bare)) return bare;
  const name = camel(bare.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim());
  return /^[a-z]/.test(name) ? name : `p${name}`;
};

/** True when canonicalPropName had to strip characters — the note trigger. */
export const propNameSanitized = (property: string): boolean =>
  /[^A-Za-z0-9 _-]/.test(property.split('#')[0].trim());

/** True when canonicalPropName had to apply the digit-led "p" prefix — the
 *  rename-note trigger (mirrors idSlugSanitized for contract ids). */
export const propNameDigitLed = (property: string): boolean => {
  const bare = property.split('#')[0].trim();
  if (/^[a-z][A-Za-z0-9]*$/.test(bare)) return false;
  return !/^[a-z]/.test(camel(bare.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim()));
};

/** Contract-id slug for a drawn component/set name — the SAME discipline as
 *  canonicalPropName: sanitize AT PROPOSAL, never refuse at emit. The schema's
 *  id segment is `[a-z][a-z0-9-]*`, and real UI kits ship names that plain
 *  kebab() cannot make legal ("Button / Primary / Medium",
 *  "Type=Text, Variant=Error", digit-led "01 Icons", emoji prefixes). Rule,
 *  in order and deterministic:
 *    1. kebab() (camelCase split, whitespace/underscores → hyphens, lowercase)
 *    2. every remaining illegal character (slashes, '=', ',', emoji, …) → '-'
 *    3. hyphen runs collapse to one; leading/trailing hyphens strip
 *    4. a digit-led or empty result gets the deterministic prefix "c" —
 *       "01 Icons" → "c-01-icons"; an all-illegal name → "c"
 *  Every call site that changes a spelling writes a NAMED note carrying the
 *  original; the design binding (set name / anchors) keeps the original. */
export const componentIdSlug = (name: string): string => {
  const cleaned = kebab(name)
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(cleaned) ? cleaned : `c${cleaned ? `-${cleaned}` : ''}`;
};

/** True when componentIdSlug had to do more than plain kebab() — the trigger
 *  for the sanitize note (kebab-clean names like "Button-Brand Primary" pass
 *  through silently, exactly as before). */
export const idSlugSanitized = (name: string): boolean => componentIdSlug(name) !== kebab(name);

/** Contract name for a drawn set: PascalCase over the alphanumeric words.
 *  "Button-Brand Primary" → "ButtonBrandPrimary", "Button group" →
 *  "ButtonGroup" — the emitters make the name an exported component and its
 *  file names, so an unsanitized set name is a guaranteed emit refusal. The
 *  canvas set keeps its own name; identity anchors are componentSetKey/nodeId. */
export const pascalComponentName = (setName: string): string => {
  const pascal = setName
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  // A digit-led or all-illegal name cannot be an exported identifier — the
  // deterministic "C" prefix mirrors componentIdSlug's "c" (documented there).
  return /^[A-Za-z]/.test(pascal) ? pascal : `C${pascal || 'omponent'}`;
};

/** True when a dump's PRODUCER captures node visibility (`hidden`, dump
 *  v1.1+) — the provenance names its dump revision (`dumpVersion` since
 *  v1.5; the note string names v1.1–v1.4). With a capturing producer,
 *  a visibility-bound node NOT hidden in the default variant is POSITIVE
 *  evidence its boolean prop defaults to true; without one, absence stays
 *  "not captured" and no default is invented. */
export const dumpCapturesHidden = (prov?: { note?: string; dumpVersion?: string } | null): boolean => {
  if (!prov) return false;
  if (typeof prov.dumpVersion === 'string') return true;
  return /dump v1\.[1-9]/.test(prov.note ?? '');
};

/** The slice of a child contract canonicalization needs — kept minimal so the
 * playground can pass its bundled contracts without importing the zod types.
 * `anchors` (dump v1.5) lets the resolver refuse a NAME-coincidence link when
 * key evidence contradicts it (a "Button" drawn in a foreign kit must not
 * link to the repo's ds.button just because the names collide). */
export interface MinimalChildContract {
  id: string;
  /** `type` (P9): the repeat field classifier reads it to tell TEXT-certain
   *  props from enums — optional so pre-P9 callers keep passing slices. */
  props: Array<{ name: string; type?: unknown; bindings: { figma: { property?: string; values?: Record<string, string> } } }>;
  anchors?: { figma?: { componentSetKey?: string | null } };
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
// Theme/mode-axis promotion (§3, P17 — the mirror image of interaction-state
// promotion). Some drawn axes are NOT API: `Theme=Light|Dark` is a token
// MODE (DTCG modes / Figma variable-collection modes). Shipping
// `theme: 'light' | 'dark'` as a component prop is the same category error
// as shipping `state: 'hover'` — Carbon, Material, and Fluent all model
// theme as token layers, never per-component props (enterprise-gauntlet
// corroboration: Carbon's four themes are identical 306-key token sets).
//
// Detection is TWO independent signals, both required (name alone is never
// enough — D4):
//   1. NAME TABLE (the detectStateAxis discipline): axis property named
//      theme|mode|color-scheme|scheme|appearance with values ⊆
//      {light, dark, high-contrast, dim, black, white}. Near-misses on a
//      named axis are NOTED, never guessed.
//   2. STRUCTURAL CORROBORATION (what makes promotion SAFE): partition the
//      variants by the candidate axis holding all other axes fixed; every
//      pair must have (a) an IDENTICAL merged anatomy (same children, order,
//      types), (b) the same bound variable NAMES on every field (only
//      resolved values differ — the variable itself is mode-switched), with
//      raw literals allowed to differ ONLY on color-kind channels
//      (fill/stroke/effect-color hex). ANY other difference → NOT a mode;
//      the axis stays an enum prop with a WARNING note.
//
// Promotion: the axis is EXCLUDED from props; anatomy and facts build from
// the axis's FIRST (default) value's variants only (the state-promotion
// base-variant discipline); mode-excluded variants never feed the mint pass
// (a dark-mode hex minting imported.* tokens would fabricate a second
// palette); per-mode captured-variable values ride the captured-token
// layer's `modes` channel (dump v1.6); the contract carries receipt-grade
// `modes` metadata; the rename story is a named note (regeneration draws
// the default mode only — the axis spelling lives in the note + source set).
// ---------------------------------------------------------------------------

const MODE_AXIS_NAME = /^(theme|mode|color[\s_-]?scheme|scheme|appearance)$/i;
const MODE_AXIS_VALUES = new Set(['light', 'dark', 'high-contrast', 'dim', 'black', 'white']);

export interface ModePromotion {
  axis: Axis;
  /** Figma value spelling of the default (base) mode — the axis's first value. */
  defaultValue: string;
}

/** First structural/binding difference between two variants that a token
 *  mode CANNOT explain — or null when the pair corroborates. Raw literals
 *  may differ ONLY on color-kind channels (fill/stroke/effect color); bound
 *  fields must bind the SAME variable names; everything else must be equal. */
function modeStructuralDiff(a: DumpNode, b: DumpNode, path: string): string | null {
  if (a.type !== b.type) return `${path}: node type ${a.type} vs ${b.type}`;
  const aBound = a.bound ?? {};
  const bBound = b.bound ?? {};
  for (const k of new Set([...Object.keys(aBound), ...Object.keys(bBound)])) {
    if (aBound[k] !== bBound[k]) {
      return `${path}: field "${k}" binds "${aBound[k] ?? '(unbound)'}" vs "${bBound[k] ?? '(unbound)'}"`;
    }
  }
  const paintShape = (p?: DumpPaint): string => (p === undefined ? 'none' : p.var !== undefined ? `var:${p.var}` : 'raw');
  if (paintShape(a.fill) !== paintShape(b.fill)) return `${path}: fill ${paintShape(a.fill)} vs ${paintShape(b.fill)}`;
  if (paintShape(a.stroke) !== paintShape(b.stroke)) return `${path}: stroke ${paintShape(a.stroke)} vs ${paintShape(b.stroke)}`;
  if (JSON.stringify(a.layout ?? null) !== JSON.stringify(b.layout ?? null)) return `${path}: auto-layout differs`;
  if ((a.cornerRadius ?? null) !== (b.cornerRadius ?? null)) return `${path}: corner radius differs`;
  if ((a.strokeWeight ?? null) !== (b.strokeWeight ?? null)) return `${path}: stroke weight differs`;
  if ((a.opacity ?? 1) !== (b.opacity ?? 1)) return `${path}: node opacity differs`;
  if ((a.hidden ?? false) !== (b.hidden ?? false)) return `${path}: visibility differs`;
  for (const dim of ['minWidth', 'minHeight', 'maxWidth', 'maxHeight'] as const) {
    if ((a[dim] ?? null) !== (b[dim] ?? null)) return `${path}: ${dim} differs`;
  }
  if ((a.text === undefined) !== (b.text === undefined)) return `${path}: text presence differs`;
  if (a.text && b.text) {
    const at = a.text;
    const bt = b.text;
    if (
      at.characters !== bt.characters || at.fontSize !== bt.fontSize || at.fontStyle !== bt.fontStyle ||
      (at.lineHeight ?? null) !== (bt.lineHeight ?? null) || (at.style ?? null) !== (bt.style ?? null)
    ) {
      return `${path}: text/typography differs`;
    }
    if ((at.fillVar ?? null) !== (bt.fillVar ?? null)) return `${path}: text fill binds "${at.fillVar ?? '(raw)'}" vs "${bt.fillVar ?? '(raw)'}"`;
  }
  const effectShape = (e?: DumpEffect[]): string =>
    JSON.stringify((e ?? []).map((x) => ({ t: x.type, o: x.offset ?? null, r: x.radius ?? null, s: x.spread ?? null })));
  if (effectShape(a.effects) !== effectShape(b.effects)) return `${path}: effects differ`;
  if ((a.instanceOf ?? null) !== (b.instanceOf ?? null)) return `${path}: nested instance differs`;
  if (JSON.stringify(a.componentProperties ?? null) !== JSON.stringify(b.componentProperties ?? null)) {
    return `${path}: applied instance props differ`;
  }
  if (JSON.stringify(a.propRefs ?? null) !== JSON.stringify(b.propRefs ?? null)) return `${path}: property references differ`;
  const ak = a.children ?? [];
  const bk = b.children ?? [];
  if (ak.length !== bk.length) return `${path}: ${ak.length} vs ${bk.length} children`;
  for (let i = 0; i < ak.length; i++) {
    if (ak[i].name !== bk[i].name) return `${path}: child "${ak[i].name}" vs "${bk[i].name}"`;
    const d = modeStructuralDiff(ak[i], bk[i], `${path}/${ak[i].name}`);
    if (d) return d;
  }
  return null;
}

/** Detect a token-mode axis — name table AND structural corroboration, both
 *  note-gated. Returns the promotion, or null (every near-miss NAMED). */
function detectModeAxis(axes: Axis[], variants: DumpNode[], setName: string, notes: string[]): ModePromotion | null {
  for (const axis of axes) {
    if (!MODE_AXIS_NAME.test(axis.property.trim())) continue;
    if (isBoolAxis(axis.values)) continue;
    const unmapped = axis.values.filter((v) => !MODE_AXIS_VALUES.has(normStateValue(v)));
    if (unmapped.length > 0) {
      notes.push(
        `variant axis "${axis.property}": named like a token-mode axis but value(s) ${unmapped.join(', ')} are outside the mode vocabulary (light|dark|high-contrast|dim|black|white) — kept as an enum prop, review`,
      );
      continue;
    }
    if (variants.some((v) => axisValuesOf(v.name)[axis.property] === undefined)) {
      notes.push(
        `variant axis "${axis.property}": token-mode axis detected but some variant names omit the pair — promotion unsafe, axis kept as an enum prop; review`,
      );
      continue;
    }
    // Structural corroboration: hold all other axes fixed (the residual
    // variant name), compare each non-default-mode variant to its
    // default-mode counterpart.
    const defaultValue = axis.values[0];
    const residual = (v: DumpNode) => stripAxisFromName(v.name, axis.property, setName);
    const base = new Map<string, DumpNode>();
    for (const v of variants) {
      if (axisValuesOf(v.name)[axis.property] === defaultValue) base.set(residual(v), v);
    }
    let failure: string | null = null;
    for (const v of variants) {
      const value = axisValuesOf(v.name)[axis.property];
      if (value === defaultValue) continue;
      const counterpart = base.get(residual(v));
      if (!counterpart) {
        failure = `variant "${v.name}" has no ${axis.property}=${defaultValue} counterpart`;
        break;
      }
      // Root names differ by exactly the axis pair — neutralize before the diff.
      failure = modeStructuralDiff(counterpart, { ...v, name: counterpart.name }, residual(v));
      if (failure) break;
    }
    if (failure) {
      notes.push(
        `variant axis "${axis.property}" (${axis.values.join('|')}): named like a token mode but the variants differ beyond color across its values (${failure}) — NOT promoted; kept as an enum prop (if this is theming, unify the drawn structure), review`,
      );
      continue;
    }
    return { axis, defaultValue };
  }
  return null;
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

/** A binding that is a plain FUNCTION of one enum axis by VALUE (v10
 *  tokensByProp; owner field case: CBDS root paddingLeft {spacing.200} on
 *  large/medium vs {spacing.150} on small — the token names do not spell the
 *  axis values, so the substituted-ref shape cannot carry it). `byValue` is
 *  keyed by canonical (camel) axis value, full coverage; `defaultValue` is
 *  the axis's first (default) value — its ref becomes the part's base token,
 *  the deviating values become tokensByProp overrides. Correlation does NOT
 *  require injectivity: large/medium sharing a ref is still a function. */
export interface PerValueRef {
  propName: string;
  defaultValue: string;
  byValue: Record<string, string>;
}

type UnifiedRef = string | PerValueRef;

/** Identity key for unified refs — lets the padding/radius pairing rules
 *  compare per-value functions the way they compare plain ref strings. */
const refKey = (u: UnifiedRef | undefined): string | undefined =>
  u === undefined ? undefined : typeof u === 'string' ? u : `f(${u.propName}):${JSON.stringify(u.byValue)}`;

type Unified =
  | { kind: 'none' }
  | { kind: 'ref'; ref: string }
  | { kind: 'per-value'; perValue: PerValueRef }
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
  const sameDepth = segs.every((s) => s.length === len);
  if (sameDepth) {
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
  }
  // VALUE-level correlation (v10 tokensByProp): the refs are a consistent
  // function of exactly ONE enum axis with full value coverage. Injectivity
  // is NOT required — two axis values sharing a ref is still a function of
  // the axis (CBDS paddingLeft: spacing.200 for large AND medium). Name
  // substitution above stays the preferred shape (it generalizes to unseen
  // values); this is the fallback for vocabularies whose names spell scale
  // steps, not axis values.
  for (const axis of axes) {
    if (isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, string>();
    let fits = true;
    for (const o of defined) {
      const value = axisValuesOf(o.variant)[axis.property];
      if (value === undefined) {
        fits = false;
        break;
      }
      const seen = byValue.get(value);
      if (seen !== undefined && seen !== o.path) {
        fits = false;
        break;
      }
      byValue.set(value, o.path);
    }
    if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
    return {
      kind: 'per-value',
      perValue: {
        propName: axis.propName,
        defaultValue: camel(axis.values[0]),
        byValue: Object.fromEntries([...byValue].map(([v, p]) => [camel(v), `{${p}}`])),
      },
    };
  }
  if (!sameDepth) {
    return { kind: 'drift', detail: `token paths differ in depth: ${distinct.join(' vs ')}` };
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
  /** componentSetKey (or setless component key) → contract id (dump v1.5) —
   *  the session-linking index; checked BEFORE the name lookup. */
  contractIdByKey?: Map<string, string>;
  /** Set-level INSTANCE_SWAP preferredValues (dump v1.5), property → keys. */
  swapPreferredValues?: Record<string, DumpPreferredValue[]>;
  /** Set-level BOOLEAN property defaults (dump v1.5). */
  boolDefaults?: Record<string, boolean>;
  /** The dump's producer captures `hidden` (dump v1.1+) — see
   *  dumpCapturesHidden; callers derive it from the dump's _provenance. */
  hiddenCaptured?: boolean;
  /** Captured-variable resolved values (dump v1.4 `_variables`), dot-path →
   *  CSS value ("bg.brand.default" → "#0e61ba") — the default/consuming
   *  mode's values, exactly the captured-token layer's entries. Used ONLY to
   *  route bound-paint drift refusals into the mint pass (live-gauntlet
   *  class ①): when the bound refs cannot be carried as one binding, every
   *  variant's ref still resolves here, so the paint survives as per-variant
   *  minted literals instead of dropping entirely. */
  capturedValues?: Map<string, string>;
  prefix: string;
  notes: string[];
  unbound: UnboundValue[];
  textProps: Array<{ name: string; property: string; default: string }>;
  boolProps: Array<{ name: string; property: string; default?: boolean }>;
  /** P9 repeated-children collections: one arrayOf prop per repeat part,
   *  emitted after text/bool props (code-only, bindings.figma.kind NONE). */
  arrayProps: Array<{ name: string; fields: Record<string, 'text' | 'boolean'>; instanceOf: string }>;
  /** Slot parts in tree order, for the default-slot ("children") judgment. */
  slots: Array<{ part: Record<string, unknown>; property: string; optional: boolean }>;
  /** Variant names whose base instance was flattened into the variant root —
   *  a child absent ONLY there is a fidelity limit, not drift. */
  flattenedVariants: Set<string>;
  /** Nested instances whose child contract is not in scope, keyed by the
   *  stub contract id they will claim — turned into childStubs post-build. */
  stubs: Map<string, StubCapture>;
  /** GLOBAL part-name registry (one per proposal): part names are contract-
   *  wide identity (CSS classes, swap layers, note paths — emit-react refuses
   *  duplicates anywhere in the anatomy), so sibling-scope dedup is not
   *  enough. Owner field case: his Dialog drew Title[FRAME] > Title[TEXT]
   *  (wrapper and text at different depths) and two Icon instances under
   *  DIFFERENT parents — legal on the canvas, refused at emit. Seeded with
   *  'root' (the root is a walked part name too). */
  partNames: Set<string>;
  mint?: MintCapture;
}

/** Captured evidence for one auto-proposed child contract stub. */
interface StubCapture {
  id: string;
  instanceOf: string;
  /** The observed owning-set publish key (dump v1.5) — carried onto the
   *  stub's anchors.figma.componentSetKey so importing the real set later
   *  LINKS back to this identity by key. */
  setKey?: string;
  /** Every occurrence's applied componentProperties, across variants. */
  applied: Array<Record<string, string | boolean>>;
  /** dump v1.5 observed per-occurrence geometry facts — the honest box the
   *  stub renders (bbox + primary paints as drawn; anatomy stays uncaptured).
   *  Empty for pre-v1.5 dumps: the stub renders nothing, as before. */
  observed: Array<{
    variant: string;
    applied?: Record<string, string | boolean>;
    bbox?: { width: number; height: number };
    fill?: DumpPaint;
    stroke?: DumpPaint;
    strokeWeight?: number;
    cornerRadius?: number;
  }>;
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

function unifyField(m: Merged, field: string, ctx: Ctx, where: string): UnifiedRef | undefined {
  const u = unifyRefs(
    m.occ.map((o) => ({ variant: o.variant, path: o.node.bound?.[field] ? dotPath(o.node.bound[field]) : undefined })),
    ctx.axes,
  );
  if (u.kind === 'ref') return u.ref;
  if (u.kind === 'per-value') return u.perValue;
  if (u.kind === 'drift') ctx.notes.push(`${where} ${field}: ${u.detail}`);
  return undefined;
}

/** Per-part collector for value-level correlations: every per-value carry on
 *  one part must ride the SAME enum axis (tokensByProp holds one `prop`);
 *  a second axis is a NAMED refusal, never a silent merge. */
interface ByPropCollector {
  prop?: string;
  map: Record<string, Record<string, string>>;
}

/** Carry one unified ref into a part's tokens record: plain refs land as
 *  before; a per-value function lands as the DEFAULT value's ref in `tokens`
 *  plus tokensByProp overrides for the values whose ref deviates (the
 *  layoutByProp override discipline — only deviating values appear). */
function carryRef(
  tokens: Record<string, string>,
  byProp: ByPropCollector,
  cssProp: string,
  u: UnifiedRef | undefined,
  ctx: Ctx,
  where: string,
): void {
  if (u === undefined) return;
  if (typeof u === 'string') {
    tokens[cssProp] = u;
    return;
  }
  if (byProp.prop !== undefined && byProp.prop !== u.propName) {
    ctx.notes.push(
      `${where} ${cssProp}: bindings are a function of enum axis "${u.propName}" by value, but this part's per-value overrides already ride "${byProp.prop}" — tokensByProp carries ONE axis per part; NAMED, not proposed (review)`,
    );
    return;
  }
  byProp.prop = u.propName;
  const baseRef = u.byValue[u.defaultValue];
  tokens[cssProp] = baseRef;
  const deviating: string[] = [];
  for (const [value, ref] of Object.entries(u.byValue)) {
    if (value === u.defaultValue || ref === baseRef) continue;
    (byProp.map[value] ??= {})[cssProp] = ref;
    deviating.push(`${value}=${ref}`);
  }
  ctx.notes.push(
    `${where} ${cssProp}: bindings are a function of variant axis "${u.propName}" by VALUE (default ${u.defaultValue}=${baseRef}${deviating.length > 0 ? `; ${deviating.join(', ')}` : ''}) — carried as tokensByProp overrides (v10; the token names do not spell the axis values, so the substituted-ref shape cannot carry them)`,
  );
}

/** Attach a collected tokensByProp to its part — after every carry ran. */
function attachByProp(holder: Record<string, unknown>, byProp: ByPropCollector): void {
  if (byProp.prop !== undefined && Object.keys(byProp.map).length > 0) {
    holder.tokensByProp = { prop: byProp.prop, map: byProp.map };
  }
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
): UnifiedRef | undefined {
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
  if (u.kind === 'ref' || u.kind === 'per-value') {
    // A BOUND paint whose alpha < 1: the token ref carries the color, not
    // the paint's opacity — no place in the contract vocabulary for it, so
    // the loss is NAMED (dump v1.1 captures it; the ref stays proposed).
    const alphaBound = paints.find((p) => p.paint?.var !== undefined && (p.paint.alpha ?? 1) < 1);
    if (alphaBound) {
      ctx.notes.push(
        `${where} ${paintName}: paint opacity ${alphaBound.paint!.alpha} rides the bound variable "${alphaBound.paint!.var}" — alpha is not representable on a token ref; binding proposed at full opacity, review`,
      );
    }
    return u.kind === 'ref' ? u.ref : u.perValue;
  }
  if (u.kind === 'drift') {
    // Live-gauntlet class ① (fill-matrix-depth-drop): a BOUND paint whose
    // refs refuse unification (mixed segment depth, or a function of more
    // than one axis) used to drop entirely — honest in prose, catastrophic
    // in pixels (Badge/Chip rendered as bare text). When every variant's
    // paint is bound AND resolves through the captured-variable layer, the
    // observation routes into the mint pass instead: single-axis functions
    // mint per-value leaves, axis pairs/triples mint per-combination leaves
    // with substituted root refs (core/mint-tokens.ts). The observed refs
    // stay NAMED in the note for the rename/remap pass; a paint that still
    // fails mint classification lands as the mint pass's own named refusal.
    // Never a silent paint drop.
    if (
      ctx.mint &&
      mint &&
      paints.every((p) => p.paint?.var !== undefined)
    ) {
      const values = paints.map((p) => ctx.capturedValues?.get(dotPath(p.paint!.var!)));
      if (values.every((v): v is string => v !== undefined)) {
        mintObservation(
          ctx, mint.target, where, mint.cssProperty, 'color',
          paints.map((p, i) => ({ variant: p.variant, value: values[i] as string })),
          `${where}|${paintName}`,
        );
        ctx.notes.push(
          `${where} ${paintName}: ${u.detail} — routed to the mint pass at captured-value literal fidelity (per-variant leaves when it classifies: any single axis, or an axis pair/triple on the root; otherwise the mint pass refuses BY NAME below); the observed refs here are the rename targets`,
        );
        return undefined;
      }
    }
    ctx.notes.push(`${where} ${paintName}: ${u.detail}`);
  }
  return undefined;
}

/** Invert a node's variable bindings + paints into contract token refs.
 *  Value-level correlations (v10) collect into `byProp` — the caller
 *  attaches them to the part via attachByProp. */
function invertNodeTokens(
  m: Merged,
  isRoot: boolean,
  ctx: Ctx,
  where: string,
  byProp: ByPropCollector,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  const fields = new Set<string>();
  for (const o of m.occ) for (const f of Object.keys(o.node.bound ?? {})) fields.add(f);
  const f = (name: string) => (fields.has(name) ? unifyField(m, name, ctx, where) : undefined);
  const carry = (cssProp: string, u: UnifiedRef | undefined) => carryRef(tokens, byProp, cssProp, u, ctx, where);

  carry(
    'background-color',
    unifyPaint(m, (n) => (n.type === 'TEXT' ? undefined : n.fill), ctx, where, 'fill', {
      cssProperty: 'background-color',
      target: tokens,
    }),
  );
  carry(
    'border-color',
    unifyPaint(m, (n) => n.stroke, ctx, where, 'stroke', {
      cssProperty: 'border-color',
      target: tokens,
    }),
  );

  // Paired fields → the contract's coarser vocabulary. Per-value functions
  // pair by identity (same axis, same per-value refs — see refKey).
  const pair = (a?: UnifiedRef, b?: UnifiedRef) =>
    a !== undefined && refKey(a) === refKey(b) ? a : undefined;
  const inline = pair(f('paddingLeft'), f('paddingRight'));
  if (inline) carry('padding-inline', inline);
  else if (fields.has('paddingLeft') || fields.has('paddingRight')) {
    ctx.notes.push(`${where}: left/right padding bindings differ — padding-inline not representable, review`);
  }
  const block = pair(f('paddingTop'), f('paddingBottom'));
  if (block) carry('padding-block', block);
  else if (fields.has('paddingTop') || fields.has('paddingBottom')) {
    ctx.notes.push(`${where}: top/bottom padding bindings differ — padding-block not representable, review`);
  }
  const radii = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
  if (radii.some((r) => fields.has(r))) {
    const rs = radii.map((r) => f(r));
    if (rs[0] !== undefined && rs.every((r) => refKey(r) === refKey(rs[0]))) carry('border-radius', rs[0]);
    else ctx.notes.push(`${where}: corner radii bindings are not uniform — border-radius not representable, review`);
  }
  const weights = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'];
  if (weights.some((w) => fields.has(w)) || fields.has('strokeWeight')) {
    const w = fields.has('strokeWeight')
      ? f('strokeWeight')
      : (() => {
          const ws = weights.map((x) => f(x));
          return ws[0] !== undefined && ws.every((x) => refKey(x) === refKey(ws[0])) ? ws[0] : undefined;
        })();
    if (w) carry('border-width', w);
    else ctx.notes.push(`${where}: stroke weight bindings are not uniform — border-width not representable, review`);
  }
  carry('gap', f('itemSpacing'));
  carry(isRoot ? 'max-width' : 'width', f('width'));
  carry('height', f('height'));
  carry('min-width', f('minWidth'));
  carry('min-height', f('minHeight'));
  if (tokens['max-width'] === undefined) carry('max-width', f('maxWidth'));
  else if (fields.has('maxWidth')) {
    ctx.notes.push(`${where}: bound maxWidth collides with the root width→max-width convention — binding NAMED, not proposed (review)`);
  }
  carry('max-height', f('maxHeight'));
  carry('opacity', f('opacity'));

  // Bound variables on fields OUTSIDE the contract vocabulary
  // (counterAxisSpacing, …) are NAMED per field — a captured binding must
  // never vanish without a receipt (STYLE-FIDELITY audit A19). min/max
  // sizing joined the vocabulary in dump v1.4.
  const CONSUMED_BOUND_FIELDS = new Set([
    'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
    'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
    'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight',
    'strokeWeight', 'itemSpacing', 'width', 'height', 'opacity',
    'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
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
    const spacings = m.occ.map((o) => o.node.layout?.spacing ?? 0);
    const negatives = spacings.filter((s) => s < 0).length;
    reportUnbound(ctx, where, 'itemSpacing', firstNode((n) => n.layout?.spacing, 0).layout!.spacing);
    if (negatives > 0 && negatives < spacings.length) {
      // P21, mixed-sign spacing (owner field case: Avatar group's
      // type=space 4px vs type=overlap -8px): children overlap only in SOME
      // variants, but `layout.overlap` is a per-part invariant (the v7
      // VariantLayoutSchema deliberately excludes it — no per-variant form),
      // and a negative px value minted as a PLAIN gap token is an invalid
      // CSS fact (`gap: -8px` parses to nothing and the overlap silently
      // vanishes — the pre-P21 bug). NAMED, never minted; the unbound report
      // survives for review.
      ctx.mint?.partialSources.add(`${where}|itemSpacing`);
      ctx.notes.push(
        `${where}: itemSpacing is NEGATIVE in ${negatives}/${spacings.length} variant(s) (${[...new Set(spacings)].join('/')}) — children overlap only there, but layout.overlap is a per-part invariant with no per-variant form (P21); gap NOT minted (a mixed-sign spacing cannot carry, and a plain negative-px gap token is an invalid CSS fact), NAMED for review`,
      );
    } else {
      // Uniform sign: mint as before. A uniformly NEGATIVE spacing rides the
      // overlap projection (invertLayout set layout.overlap: true, so the
      // gap token's negative value renders as a negative child margin /
      // negative itemSpacing — never as an invalid CSS `gap`).
      mintObservation(ctx, tokens, where, 'gap', 'px', numOccurrences(m, (n) => n.layout?.spacing), `${where}|itemSpacing`);
    }
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
  // Literal min/max sizing (dump v1.4): bounded, exact px facts — a drawn
  // minHeight 44 is a tap-target fact that belongs in the render. Bound
  // variables on these fields already rode `bound` above; literals mint like
  // any other px channel (axis-correlated values take the substituted-ref
  // shape through the mint classifier). Partial presence stays NAMED.
  const MINMAX = [
    ['minWidth', 'min-width'],
    ['minHeight', 'min-height'],
    ['maxWidth', 'max-width'],
    ['maxHeight', 'max-height'],
  ] as const;
  for (const [field, cssProp] of MINMAX) {
    if (fields.has(field)) continue; // bound — carried above
    const pick = (n: DumpNode) => n[field];
    const withVal = m.occ.filter((o) => typeof pick(o.node) === 'number');
    if (withVal.length === 0) continue;
    if (tokens[cssProp] !== undefined) {
      ctx.notes.push(
        `${where}: literal ${field} also present where "${cssProp}" already carries a binding — literal NAMED, not minted (review)`,
      );
      continue;
    }
    reportUnbound(ctx, where, field, pick(withVal[0].node)!);
    if (withVal.length !== m.occ.length) {
      ctx.mint?.partialSources.add(`${where}|${field}`);
      ctx.notes.push(
        `${where}: literal ${field} present in ${withVal.length}/${m.occ.length} variants — inconsistent, NAMED, not minted; review`,
      );
      continue;
    }
    mintObservation(
      ctx, tokens, where, cssProp, 'px',
      m.occ.map((o) => ({ variant: o.variant, value: pick(o.node)! })),
      `${where}|${field}`,
    );
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

function invertTextTokens(m: Merged, ctx: Ctx, where: string, byProp: ByPropCollector): Record<string, string> {
  const tokens: Record<string, string> = {};
  const color = unifyPaint(
    m,
    (n) => (n.text?.fillVar ? { var: n.text.fillVar } : n.fill),
    ctx,
    where,
    'text fill',
    { cssProperty: 'color', target: tokens },
  );
  carryRef(tokens, byProp, 'color', color, ctx, where);

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
  // P21 overlap collections (AvatarGroup shape): negative itemSpacing in
  // EVERY variant means the children OVERLAP — the existing `layout.overlap`
  // vocabulary, whose shipped projection (ds.avatar-group owner-precedent:
  // {space.avatarGroup.overlap} → {space.overlap} = -8px) is a NEGATIVE-
  // valued gap token rendered as a negative child margin in CSS and as
  // negative itemSpacing on the canvas. Mixed-sign spacing across variants
  // stays a NAMED note in the gap channel (overlap is a per-part invariant).
  const overlap =
    hasChildren && m.occ.length > 0 && m.occ.every((o) => (o.node.layout?.spacing ?? 0) < 0)
      ? true
      : undefined;
  if (overlap) {
    ctx.notes.push(
      `${where}: negative itemSpacing in every variant — children OVERLAP (P21); proposed as layout.overlap: true, with the gap channel carrying the DRAWN (negative) magnitude — the schema's negative-margin projection (CSS: a negative child margin from the gap token, the ds.avatar-group owner-precedent where {space.overlap} = -8px; canvas: negative itemSpacing) — never an invalid CSS \`gap\``,
    );
  }
  const out: Record<string, unknown> = {};
  const direction = l.mode === 'VERTICAL' ? 'column' : 'row';
  const justify = JUSTIFY_INV[l.primary];
  const align = ALIGN_INV[l.counter] ?? (stretchEvidence(m) ? 'stretch' : undefined);
  if (isRoot) {
    // The generator's root default is row/center/center — a root drawn
    // exactly there proposes no layout block.
    if (direction === 'row' && justify === 'center' && align === 'center' && !grow && !overlap) {
      return undefined;
    }
    out.display = 'flex';
  }
  if (hasChildren || direction === 'column') out.direction = direction;
  if (justify && hasChildren) out.justify = justify;
  if (align && hasChildren) out.align = align;
  if (grow) out.grow = grow;
  if (overlap) out.overlap = overlap;
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
  let boolFalseSide: Axis | undefined;
  for (const axis of ctx.axes) {
    for (const value of axis.values) {
      const matches = ctx.totalVariants.every((v) => {
        const is = axisValuesOf(v)[axis.property] === value;
        return is === present.has(v);
      });
      if (!matches) continue;
      // A true/false axis promotes to a BOOLEAN prop (see the props pass) —
      // `equals: "true"` would refuse at the referee (visibleWhen.equals is
      // enum vocabulary). The truthy form `{ prop }` is the boolean spelling.
      if (isBoolAxis(axis.values)) {
        if (value.trim().toLowerCase() === 'true') {
          ctx.notes.push(
            `${where}: present exactly where "${axis.property}" is true — proposed as visibleWhen { prop: ${axis.propName} } (boolean axis, truthy form)`,
          );
          return { prop: axis.propName };
        }
        // Present exactly where the boolean is FALSE: the visibleWhen
        // vocabulary has no negated form (and stylesWhen cannot negate
        // either) — remember, keep scanning for an expressible axis, and
        // name the limit if none fits.
        boolFalseSide = axis;
        continue;
      }
      return { prop: axis.propName, equals: camel(value) };
    }
  }
  if (boolFalseSide) {
    ctx.notes.push(
      `${where}: present exactly where "${boolFalseSide.property}" is false — the visibleWhen vocabulary has no negated form, so the condition is inexpressible; kept unconditional (declared fidelity limit), review`,
    );
    return undefined;
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
const selfContractId = (ctx: Ctx): string => `${ctx.prefix}.${componentIdSlug(ctx.setName)}`;

/** True when a nested instance resolves to the set's own contract — either
 *  through the contract index (name → id lands on the proposal's own id) or
 *  by the name-match fallback the id would be derived from. */
function isSelfInstance(instanceOf: string, ctx: Ctx): boolean {
  const resolved = ctx.contractIdByName.get(instanceOf) ?? `${ctx.prefix}.${componentIdSlug(instanceOf)}`;
  return resolved === selfContractId(ctx) || componentIdSlug(instanceOf) === componentIdSlug(ctx.setName);
}

/** Stub contract id for a nested instance name — ONE function serves both the
 *  component ref and the stub contract, so the two can never drift apart.
 *  Distinct instance names that sanitize to the same slug (or collide with the
 *  proposal's own id) get a deterministic numeric suffix in arrival order —
 *  never a silent merge; the caller notes the collision by name.
 *
 *  KEY-AWARE (dump v1.5): when the instance carries a key, a derived id that
 *  lands on an IN-SCOPE contract whose componentSetKey CONTRADICTS it is
 *  suffixed past — otherwise the refused name-coincidence link would sneak
 *  back in through the stub id ("Button" in a foreign kit deriving ds.button
 *  while the repo's ds.button holds a different key). Without keys the
 *  landing stays deliberate (census field case: "ListItem" landing on the
 *  repo's ds.list-item is the wanted link). */
function stubIdFor(
  instanceOf: string,
  ctx: Ctx,
  keys?: { setKey?: string; key?: string },
): { id: string; collidedWith: string | null } {
  for (const capture of ctx.stubs.values()) {
    if (capture.instanceOf === instanceOf) return { id: capture.id, collidedWith: null };
  }
  const instKey = keys?.setKey ?? keys?.key;
  const registeredConflict = (id: string): boolean => {
    if (instKey === undefined) return false;
    const regKey = ctx.contractsById?.get(id)?.anchors?.figma?.componentSetKey ?? null;
    return regKey !== null && regKey !== instKey;
  };
  const base = `${ctx.prefix}.${componentIdSlug(instanceOf)}`;
  let id = base;
  for (let n = 2; ctx.stubs.has(id) || id === selfContractId(ctx) || registeredConflict(id); n += 1) {
    id = `${base}-${n}`;
  }
  return {
    id,
    collidedWith:
      id === base
        ? null
        : ctx.stubs.get(base)?.instanceOf ??
          (registeredConflict(base) ? `the in-scope contract ${base} (its componentSetKey contradicts this instance's key)` : ctx.setName),
  };
}

/** How (whether) a nested instance resolved to an in-scope contract. */
interface ChildResolution {
  id: string | null;
  /** 'key' — matched an in-scope contract's componentSetKey/component key
   *  (rename-safe); 'name' — the drawn name matched with no contradicting
   *  key evidence. */
  mechanism: 'key' | 'name' | null;
  /** Set when a NAME match was REFUSED: the instance carries a key, the
   *  named contract carries a different non-null componentSetKey — a
   *  name-coincidence, not the same component. */
  keyMismatch?: { contractId: string; contractKey: string; instanceKey: string };
}

/** SESSION-LINKING RESOLVER (dump v1.5): componentSetKey FIRST, name as the
 *  fallback — and a name match that key evidence CONTRADICTS is refused
 *  (field case: the Shoelace kit's "Button" name-collided with the repo's
 *  ds.button and rendered the wrong design system's button). */
function resolveChildContract(
  instanceOf: string,
  keys: { setKey?: string; key?: string },
  ctx: Ctx,
): ChildResolution {
  const byKey = ctx.contractIdByKey;
  if (byKey) {
    const keyHit =
      (keys.setKey !== undefined ? byKey.get(keys.setKey) : undefined) ??
      (keys.key !== undefined ? byKey.get(keys.key) : undefined);
    if (keyHit) return { id: keyHit, mechanism: 'key' };
  }
  const named = ctx.contractIdByName.get(instanceOf);
  if (!named) return { id: null, mechanism: null };
  const instKey = keys.setKey ?? keys.key;
  const contractKey = ctx.contractsById?.get(named)?.anchors?.figma?.componentSetKey ?? null;
  if (instKey !== undefined && contractKey !== null && contractKey !== instKey) {
    return { id: null, mechanism: null, keyMismatch: { contractId: named, contractKey, instanceKey: instKey } };
  }
  return { id: named, mechanism: 'name' };
}

/** First captured identity keys across a merged node's occurrences. */
const instanceKeysOf = (m: Merged): { setKey?: string; key?: string } => ({
  setKey: first(m.occ, (n) => n.instanceSetKey),
  key: first(m.occ, (n) => n.instanceKey),
});

/** Register (or extend) the STUB capture for an unresolved nested instance
 *  and return its claimed contract id. ONE registration path serves the
 *  component-ref branch and the slot design-time-content branch, so applied
 *  values AND the dump v1.5 observed geometry (bbox + primary paints) land
 *  on the same capture wherever the instance appears. */
function captureStub(instanceOf: string, m: Merged, ctx: Ctx, where: string): string {
  const resolved = stubIdFor(instanceOf, ctx, instanceKeysOf(m));
  const stubId = resolved.id;
  const isNew = !ctx.stubs.has(stubId);
  const capture = ctx.stubs.get(stubId) ?? { id: stubId, instanceOf, applied: [], observed: [] };
  if (capture.setKey === undefined) {
    const setKey = first(m.occ, (n) => n.instanceSetKey);
    if (setKey !== undefined) capture.setKey = setKey;
  }
  for (const o of m.occ) {
    if (o.node.componentProperties) capture.applied.push(o.node.componentProperties);
    if (o.node.bbox) {
      capture.observed.push({
        variant: o.variant,
        ...(o.node.componentProperties ? { applied: o.node.componentProperties } : {}),
        bbox: o.node.bbox,
        ...(o.node.fill ? { fill: o.node.fill } : {}),
        ...(o.node.stroke ? { stroke: o.node.stroke } : {}),
        ...(o.node.strokeWeight !== undefined ? { strokeWeight: o.node.strokeWeight } : {}),
        ...(o.node.cornerRadius !== undefined ? { cornerRadius: o.node.cornerRadius } : {}),
      });
    }
  }
  ctx.stubs.set(stubId, capture);
  if (isNew && idSlugSanitized(instanceOf)) {
    // Field case (CBDS kit): private-helper names ("_Avatar Indicator")
    // and template names ("Button / Primary / Medium") derive ids the
    // schema refuses — sanitized AT PROPOSAL, never refused at receive.
    ctx.notes.push(
      `${where}: nested instance name "${instanceOf}" contains characters a contract id cannot carry — stub id sanitized to "${stubId}" (rule: lowercase kebab, illegal characters → hyphens, runs collapsed, edge hyphens stripped, digit-led/empty gets "c"); the original spelling stays on the stub's name/description and in this note`,
    );
  }
  if (isNew && resolved.collidedWith) {
    ctx.notes.push(
      `${where}: sanitized stub id for "${instanceOf}" collides with the id already claimed for "${resolved.collidedWith}" — disambiguated deterministically to "${stubId}" (arrival order), never silently merged`,
    );
  }
  return stubId;
}

/** Named note for HOW a nested instance resolved (or why the name match was
 *  refused) — every link mechanism is a review line, never silent. */
function noteResolution(res: ChildResolution, instanceOf: string, keys: { setKey?: string; key?: string }, ctx: Ctx, where: string) {
  if (res.mechanism === 'key') {
    ctx.notes.push(
      `${where}: nested instance of "${instanceOf}" LINKED to ${res.id} by componentSetKey ${keys.setKey ?? keys.key} (dump v1.5 — rename-safe: the key matches the contract's anchors, whatever either side is named)`,
    );
  } else if (res.mechanism === 'name' && res.id) {
    ctx.notes.push(
      `${where}: nested instance of "${instanceOf}" linked to ${res.id} by NAME${
        keys.setKey ?? keys.key
          ? ' (the instance carries a key but the contract\'s componentSetKey anchor is null — key confirmation unavailable; verify the link)'
          : ' (no key captured — pre-v1.5 dump; verify the link)'
      }`,
    );
  } else if (res.keyMismatch) {
    ctx.notes.push(
      `${where}: nested instance of "${instanceOf}" name-matches ${res.keyMismatch.contractId} but the keys CONTRADICT (instance ${res.keyMismatch.instanceKey} vs contract anchor ${res.keyMismatch.contractKey}) — name-coincidence link REFUSED (dump v1.5); a stub carries the child instead`,
    );
  }
}

/** Thread applied props that track a parent enum axis 1:1 into
 *  "{parentProp}" refs (ComponentRefSchema: the child prop follows the
 *  parent's per variant). Detection is exact-correlation over EVERY
 *  occurrence: the canonical applied value equals the parent axis's
 *  canonical value in each variant. Anything that varies WITHOUT an exact
 *  axis match keeps the first value with a named note — never guessed. */
function threadInstanceProps(
  base: Record<string, string | boolean>,
  perOccurrence: Array<{ variant: string; canonical: Record<string, string | boolean> }>,
  ctx: Ctx,
  where: string,
  instanceOf: string,
) {
  if (perOccurrence.length < 2) return;
  const enumAxes = ctx.axes.filter((a) => !isBoolAxis(a.values));
  for (const propName of Object.keys(base)) {
    const values = perOccurrence
      .filter((o) => o.canonical[propName] !== undefined)
      .map((o) => ({ variant: o.variant, value: o.canonical[propName] }));
    const distinct = [...new Set(values.map((v) => String(v.value)))];
    if (distinct.length <= 1) continue;
    const axis = enumAxes.find((a) =>
      values.every((v) => {
        const axisValue = axisValuesOf(v.variant)[a.property];
        return axisValue !== undefined && typeof v.value === 'string' && camel(axisValue) === v.value;
      }),
    );
    if (axis) {
      base[propName] = `{${axis.propName}}`;
      ctx.notes.push(
        `${where}: applied prop "${propName}" of the nested "${instanceOf}" tracks the "${axis.propName}" axis exactly across all ${values.length} occurrence(s) — threaded as "{${axis.propName}}" (the child follows the parent per variant)`,
      );
    } else {
      ctx.notes.push(
        `${where}: applied prop "${propName}" of the nested "${instanceOf}" varies across variants (${distinct.join(', ')}) without tracking any enum axis — first value "${String(base[propName])}" carried, review`,
      );
    }
  }
}

/** Slot `accepts` from captured INSTANCE_SWAP preferredValues (dump v1.5):
 *  keys that resolve through the session-linking index become accepts ids
 *  (acceptsMode 'prefer' — Figma's own preferredValues tier); unresolved
 *  keys stay a NAMED note carrying the keys verbatim. Pre-v1.5 dumps keep
 *  the classic "author `accepts` manually" note. */
function applySlotAccepts(slot: Record<string, unknown>, property: string, ctx: Ctx, where: string) {
  const prefs = ctx.swapPreferredValues?.[property];
  if (!prefs || prefs.length === 0) {
    ctx.notes.push(
      `${where}: slot "${property}" accepts (INSTANCE_SWAP preferredValues) is not captured in dump v1 — author \`accepts\` manually`,
    );
    return;
  }
  const resolvedIds: string[] = [];
  const unresolved: string[] = [];
  for (const p of prefs) {
    const id = ctx.contractIdByKey?.get(p.key);
    if (id && !resolvedIds.includes(id)) resolvedIds.push(id);
    else if (!id) unresolved.push(p.key);
  }
  if (resolvedIds.length > 0) {
    slot.accepts = resolvedIds;
    slot.acceptsMode = 'prefer';
    ctx.notes.push(
      `${where}: slot "${property}" accepts proposed from INSTANCE_SWAP preferredValues (dump v1.5) — ${resolvedIds.join(', ')} resolved by component key; acceptsMode 'prefer' (Figma's preferredValues tier)`,
    );
  }
  if (unresolved.length > 0) {
    ctx.notes.push(
      `${where}: slot "${property}" preferredValues name ${unresolved.length} component key(s) with no in-scope contract (${unresolved.join(', ')}) — not carried into \`accepts\` (import the referenced set(s) to resolve them by key)`,
    );
  }
}

/** Design-time slot content (dump v1.5): the drawn instance inside a swap-
 *  bound slot becomes the slot's `defaultContent` — LINKED when the child
 *  resolves in scope, otherwise a STUB with the observed geometry. Skipped
 *  (named) when `accepts` is present and excludes the content id, and on
 *  pre-v1.5 dumps (no bbox, nothing honest to render for a stub). */
function applySlotDefaultContent(
  slot: Record<string, unknown>,
  property: string,
  contentInstance: Merged,
  ctx: Ctx,
  where: string,
) {
  const instanceOf = first(contentInstance.occ, (n) => n.instanceOf);
  if (!instanceOf || instanceOf === 'Slot') {
    ctx.notes.push(`${where}: Slot-utility instance styling is the utility's own — elided`);
    return;
  }
  const keys = instanceKeysOf(contentInstance);
  const res = resolveChildContract(instanceOf, keys, ctx);
  let contentId: string | null = res.id;
  let provisional = false;
  if (!contentId) {
    const hasBbox = contentInstance.occ.some((o) => o.node.bbox !== undefined);
    if (!hasBbox) {
      // Pre-v1.5 dump: neither a contract nor observed geometry — the classic
      // named limit stands.
      ctx.notes.push(
        `${where}: slot "${property}" holds a "${instanceOf}" instance as design-time content — defaultContent not proposed (${
          res.keyMismatch
            ? `name-matches ${res.keyMismatch.contractId} but the keys contradict, and no observed geometry is captured`
            : 'no contract in scope and no observed geometry captured (pre-v1.5 dump)'
        }), review`,
      );
      return;
    }
    noteResolution(res, instanceOf, keys, ctx, where);
    contentId = captureStub(instanceOf, contentInstance, ctx, where);
    provisional = true;
  } else {
    noteResolution(res, instanceOf, keys, ctx, where);
  }
  const accepts = slot.accepts as string[] | undefined;
  if (accepts && !accepts.includes(contentId)) {
    ctx.notes.push(
      `${where}: slot "${property}" design-time content "${instanceOf}" (${contentId}) is outside the slot's proposed accepts (${accepts.join(', ')}) — defaultContent not proposed (defaultContent must be drawn from accepts), review`,
    );
    return;
  }
  const item: Record<string, unknown> = { id: contentId };
  const applied = first(contentInstance.occ, (n) => n.componentProperties);
  if (applied && !provisional) {
    const canonical = canonicalizeInstanceProps(instanceOf, applied, res.id, ctx, where);
    if (Object.keys(canonical).length > 0) item.props = canonical;
  }
  slot.defaultContent = [item];
  ctx.notes.push(
    provisional
      ? `${where}: slot "${property}" design-time content "${instanceOf}" proposed as defaultContent [${contentId}] — a STUB rendering the OBSERVED geometry only (dump v1.5 bbox + primary paint; PROVISIONAL — import the real child set to replace it)`
      : `${where}: slot "${property}" design-time content "${instanceOf}" proposed as defaultContent [${contentId}] (linked contract in scope, dump v1.5)`,
  );
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
 *  name like "Focus ring" must not leak into the key) and unique across the
 *  WHOLE contract (ctx.partNames — part names are contract-wide identity;
 *  emit-react refuses duplicates anywhere in the anatomy, not just among
 *  siblings). A name that is already a legal identifier keeps its spelling.
 *
 *  THE DEDUP RULE (deterministic, documented): keys are claimed in anatomy
 *  order, parents before their children (pre-order) — the FIRST drawn part
 *  keeps its name. A later collision is disambiguated by PARENT-DERIVED
 *  PREFIX (parentKey + PascalName, e.g. the second "Icon", under "Frame 2",
 *  becomes "frame2Icon") when the parent's key adds information (it differs
 *  from the colliding name and the prefixed key is itself free); otherwise
 *  by ORDINAL SUFFIX ("Title" inside the "Title" wrapper becomes "Title2").
 *  Every rename is a NAMED note carrying the node path — never silent. */
/** Identifier-length cap for derived part keys (see partKey). */
const PART_KEY_MAX = 24;

function partKey(name: string, ctx: Ctx, where: string, parentKey: string): string {
  // camel() only folds space/underscore/hyphen word breaks — a drawn name
  // with other punctuation (the owner's Dialog body is the full lorem-ipsum
  // SENTENCE, commas and periods included) would leak an illegal identifier
  // into CSS selectors; strip everything outside [A-Za-z0-9] after cameling.
  const camelSafe = camel(name).replace(/[^A-Za-z0-9]/g, '');
  let base = /^[A-Za-z][A-Za-z0-9]*$/.test(name)
    ? name
    : /^[A-Za-z]/.test(camelSafe)
      ? camelSafe
      : 'part';
  // LENGTH CAP: content-derived names (Figma auto-names text layers with
  // their characters — the owner's Dialog body cameled to a 200-char
  // lorem-ipsum identifier) are bounded at 24 chars. Deterministic: the
  // first 24 characters, named note; the drawn text itself is untouched
  // (it rides the content/text channel, not the key).
  if (base.length > PART_KEY_MAX) {
    const capped = base.slice(0, PART_KEY_MAX);
    ctx.notes.push(
      `${where}: derived part name "${base.slice(0, 40)}${base.length > 40 ? '…' : ''}" (${base.length} chars) exceeds the ${PART_KEY_MAX}-char identifier cap — truncated to "${capped}" (deterministic: first ${PART_KEY_MAX} characters; the drawn text itself is untouched)`,
    );
    base = capped;
  }
  const taken = ctx.partNames;
  let key = base;
  if (taken.has(base)) {
    const contextual = parentKey && parentKey !== 'root' && parentKey !== base
      ? `${parentKey}${base.charAt(0).toUpperCase()}${base.slice(1)}`
      : '';
    if (contextual && !taken.has(contextual)) key = contextual;
    else for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
    ctx.notes.push(
      `${where}: part name "${base}" already names another part of this contract (part names are contract-wide: CSS classes, swap layers, and note paths key on them) — renamed to "${key}" (rule: first drawn part keeps the name; later collisions take the parent-derived prefix, else an ordinal suffix)`,
    );
  }
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

// ---------------------------------------------------------------------------
// P9: repeated-children collections (menu items, breadcrumb segments, tab
// items). ≥3 ADJACENT sibling instances of the SAME child component with a
// homogeneous applied-prop shape propose as ONE item-template part carrying
// `repeat` + a new arrayOf prop — instead of N hard-coded component-ref
// parts. Field rules (deterministic, every carry/skip NAMED):
//   · a VARYING boolean applied prop → a boolean field
//   · a TEXT-CERTAIN string prop (the resolved child contract models it as a
//     text prop, or the key carries the dump v1.5 "#id" suffix) → a text
//     field (varying or not — per-item content is per-item API)
//   · a VARYING enum/ambiguous string prop → a NAMED receipt (per-item
//     enum/state differences are P10, selected-item — no repeat vocabulary;
//     bare string keys in pre-v1.5 dumps are VARIANT/TEXT-ambiguous)
//   · constant props stay FIXED on component.props (canonicalized as today)
// No carriable field → the pattern is receipted and the siblings build as
// fixed parts, exactly as before. Per-sibling VISIBILITY bindings (the
// "Show item 3" count-control booleans the taxonomy names as P9's canvas
// count spelling) ride the run: they are NOT promoted to boolean props —
// the array prop owns the count in code — and the non-promotion is a named
// rename story (regeneration renders the sample's items).
// ---------------------------------------------------------------------------

/** The maximal P9 run starting at children[i], or null (< 3 members). */
function repeatRunAt(children: Merged[], i: number, ctx: Ctx): Merged[] | null {
  const eligible = (m: Merged): boolean =>
    m.type === 'INSTANCE' &&
    first(m.occ, (n) => n.propRefs?.mainComponent) === undefined &&
    first(m.occ, (n) => n.componentProperties) !== undefined &&
    !isSelfInstance(first(m.occ, (n) => n.instanceOf) ?? m.name, ctx);
  if (!eligible(children[i])) return null;
  const instanceOf = first(children[i].occ, (n) => n.instanceOf) ?? children[i].name;
  const shapeOf = (m: Merged): string =>
    Object.keys(first(m.occ, (n) => n.componentProperties) ?? {})
      .map((k) => k.split('#')[0])
      .sort()
      .join(' ');
  const shape = shapeOf(children[i]);
  const run: Merged[] = [];
  for (let j = i; j < children.length; j++) {
    const m = children[j];
    if (!eligible(m)) break;
    if ((first(m.occ, (n) => n.instanceOf) ?? m.name) !== instanceOf) break;
    if (shapeOf(m) !== shape) break;
    run.push(m);
  }
  return run.length >= 3 ? run : null;
}

/** Build the ONE repeat part for a P9 run — or null when no per-item field
 *  is carriable (the caller falls back to fixed parts; the skip is NAMED). */
function buildRepeatPart(run: Merged[], ctx: Ctx, where: string, selfKey: string): Record<string, unknown> | null {
  const head = run[0];
  const instanceOf = first(head.occ, (n) => n.instanceOf) ?? head.name;
  const keys = instanceKeysOf(head);
  const res = resolveChildContract(instanceOf, keys, ctx);
  // Field classification runs against the contract the emitted ref will BIND:
  // the resolved contract, or the contract the derived stub id lands on (a
  // stub never overrides a registered contract) — never a fresh name lookup.
  const refId = res.id ?? stubIdFor(instanceOf, ctx, keys).id;
  const mapping = ctx.contractsById?.get(refId);
  // Per-sibling applied record — the DEFAULT variant's occurrence preferred.
  const appliedOf = (sib: Merged): Record<string, string | boolean> =>
    (sib.occ.find((o) => o.variant === ctx.totalVariants[0]) ?? sib.occ[0]).node.componentProperties ?? {};
  const records = run.map(appliedOf);

  const fields: Record<string, 'text' | 'boolean'> = {};
  const fieldKeyByName: Record<string, string> = {};
  const constantKeys: string[] = [];
  const claimField = (name: string, type: 'text' | 'boolean', rawKey: string, bare: string): boolean => {
    if (fields[name] !== undefined) {
      ctx.notes.push(
        `${where}: per-item field name "${name}" (from applied prop "${bare}") collides with another field — not carried, review (P9)`,
      );
      return false;
    }
    fields[name] = type;
    fieldKeyByName[name] = rawKey;
    return true;
  };
  for (const rawKey of Object.keys(records[0])) {
    const bare = rawKey.split('#')[0];
    const values = records.map((r) => r[rawKey]);
    const varying = new Set(values.map((v) => String(v))).size > 1;
    const mappingProp = mapping?.props.find((p) => p.bindings.figma.property === bare);
    if (typeof values[0] === 'boolean') {
      if (!varying) {
        constantKeys.push(rawKey);
      } else if (mapping && (!mappingProp || mappingProp.type !== 'boolean')) {
        ctx.notes.push(
          `${where}: per-item boolean "${bare}" does not map through ${mapping.id}'s bindings as a boolean prop — not carried as a field; verify the child contract is current (P9)`,
        );
      } else {
        claimField(mappingProp?.name ?? canonicalPropName(bare), 'boolean', rawKey, bare);
      }
      continue;
    }
    const textCertain = mapping ? mappingProp?.type === 'text' : rawKey.includes('#');
    if (textCertain) {
      claimField(mappingProp?.name ?? canonicalPropName(bare), 'text', rawKey, bare);
    } else if (!varying) {
      constantKeys.push(rawKey);
    } else if (mapping && !mappingProp) {
      ctx.notes.push(
        `${where}: applied prop "${bare}" varies per sibling (${[...new Set(values.map(String))].join(', ')}) but does not map through ${mapping.id}'s bindings — not carried as a field; verify the child contract is current (P9)`,
      );
    } else if (mapping) {
      ctx.notes.push(
        `${where}: applied prop "${bare}" varies per sibling (${[...new Set(values.map(String))].join(', ')}) — per-item enum/state differences are P10 (selected-item) with no repeat vocabulary; receipted, the sample renders ${mapping.id}'s default (review)`,
      );
    } else {
      ctx.notes.push(
        `${where}: applied prop "${bare}" varies per sibling (${[...new Set(values.map(String))].join(', ')}) but a bare string key is VARIANT/TEXT-ambiguous (pre-v1.5 dump, no "#id" suffix) — not carried as a field; recapture with the v1.5 plugin to carry per-item text (review)`,
      );
    }
  }
  if (Object.keys(fields).length === 0) {
    ctx.notes.push(
      `${where}: ${run.length} adjacent sibling instances of "${instanceOf}" (repeated-children collection, P9) but no per-item field is carriable — kept as ${run.length} fixed parts, review`,
    );
    return null;
  }

  // The run proposes — register resolution notes / stubs ONCE, for the run.
  noteResolution(res, instanceOf, keys, ctx, where);
  if (!res.id) for (const sib of run) captureStub(instanceOf, sib, ctx, where);

  // Per-sibling visibility bindings ("Show item N") are the canvas's drawn
  // count controls — NOT promoted to boolean props (N "show item" booleans
  // would be absurd code API; the array prop owns the count). Named rename
  // story for the canvas round trip.
  const visibleRefs = [
    ...new Set(run.map((sib) => first(sib.occ, (n) => n.propRefs?.visible)).filter((v): v is string => v !== undefined)),
  ];
  if (visibleRefs.length > 0) {
    ctx.notes.push(
      `${where}: per-sibling visibility bindings (${visibleRefs.join(', ')}) are the canvas's drawn COUNT controls ("Show item N", the P9 canvas count spelling) — not promoted to boolean props (the array prop owns the count in code); regeneration renders repeat.sample's items, the drawn booleans stay on the source set (rename story, named here)`,
    );
  }

  // arrayOf prop name: `items` when free, else `<partKey>Items` — deterministic.
  const taken = new Set<string>([
    ...ctx.axes.map((a) => a.propName),
    ...ctx.textProps.map((t) => t.name),
    ...ctx.boolProps.map((b) => b.name),
    ...ctx.arrayProps.map((a) => a.name),
  ]);
  const propName = taken.has('items') ? `${selfKey}Items` : 'items';
  ctx.arrayProps.push({ name: propName, fields, instanceOf });
  ctx.notes.push(
    `prop \`${propName}\`: structured array prop proposed for the repeated "${instanceOf}" collection — code-only by declared fidelity limit (bindings.figma.kind NONE: the canvas has no list-of-records property type); the canvas renders repeat.sample instead`,
  );

  // The observed sample — one record per drawn sibling, field values only
  // (text verbatim, booleans as drawn).
  const sample = records.map((rec) => {
    const out: Record<string, string | boolean> = {};
    for (const [name, rawKey] of Object.entries(fieldKeyByName)) {
      const v = rec[rawKey];
      if (v !== undefined) out[name] = v;
    }
    return out;
  });

  // Constant applied props stay fixed — canonicalized through the child's
  // bindings exactly like a single instance, threading included.
  const part: Record<string, unknown> = {};
  const component: Record<string, unknown> = { id: refId };
  const constantApplied: Record<string, string | boolean> = {};
  for (const k of constantKeys) constantApplied[k] = records[0][k];
  if (Object.keys(constantApplied).length > 0) {
    const canonical = canonicalizeInstanceProps(instanceOf, constantApplied, res.id, ctx, where, false, keys);
    const perOccurrence = head.occ
      .filter((o) => o.node.componentProperties !== undefined)
      .map((o) => {
        const constOnly: Record<string, string | boolean> = {};
        for (const k of constantKeys) {
          const v = o.node.componentProperties![k];
          if (v !== undefined) constOnly[k] = v;
        }
        return { variant: o.variant, canonical: canonicalizeInstanceProps(instanceOf, constOnly, res.id, ctx, where, true, keys) };
      });
    threadInstanceProps(canonical, perOccurrence, ctx, where, instanceOf);
    if (Object.keys(canonical).length > 0) component.props = canonical;
  }
  part.component = component;
  part.repeat = { itemsProp: propName, sample };

  if (run.some((sib) => sib.occ.length !== ctx.totalVariants.length)) {
    const counts = ctx.totalVariants.map(
      (v) => run.filter((sib) => sib.occ.some((o) => o.variant === v)).length,
    );
    ctx.notes.push(
      `${where}: sibling count varies per variant (${[...new Set(counts)].join('/')}) — repeat.sample carries the UNION of drawn siblings; the live count is the array prop's (code side), review`,
    );
  }
  ctx.notes.push(
    `${where}: ${run.length} adjacent sibling instances of "${instanceOf}" with a homogeneous applied-prop shape — proposed as ONE item-template part with repeat over arrayOf prop \`${propName}\` (P9; fields: ${Object.entries(fields).map(([n, t]) => `${n}:${t}`).join(', ')}); the drawn siblings become the canvas's static sample (repeat.sample — the meter discipline: canvas and static surfaces render the OBSERVED sample; code maps the live array)`,
  );
  return part;
}

/** Children → parts record, with P9 run detection in front of the per-child
 *  walk (ONE walker serves buildPart's frame branch and the root). */
function buildChildParts(
  children: Merged[],
  mode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
  selfKey: string,
  /** v13 (P18): drawn child NAME → claimed part key, collected for the
   *  DEPTH-1 call only — proposeStateDiffs maps state-variant children back
   *  onto their built anatomy parts through it. */
  keyByName?: Map<string, string>,
): Record<string, unknown> {
  const parts: Record<string, unknown> = {};
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    const run = repeatRunAt(children, i, ctx);
    if (run) {
      // Claim the key BEFORE building (pre-order, the partKey discipline).
      const key = partKey(child.name, ctx, `${where}/${child.name}`, selfKey);
      if (keyByName && !keyByName.has(child.name)) keyByName.set(child.name, key);
      const repeatPart = buildRepeatPart(run, ctx, `${where}/${child.name}`, key);
      if (repeatPart) {
        parts[key] = repeatPart;
        i += run.length;
        continue;
      }
      // No carriable field (named above) — the first sibling builds under the
      // already-claimed key; the rest walk as before.
      const built = buildPart(child, mode, ctx, `${where}/${child.name}`, key);
      if (built) parts[key] = built;
      i++;
      continue;
    }
    const key = partKey(child.name, ctx, `${where}/${child.name}`, selfKey);
    if (keyByName && !keyByName.has(child.name)) keyByName.set(child.name, key);
    const built = buildPart(child, mode, ctx, `${where}/${child.name}`, key);
    if (built) parts[key] = built;
    i++;
  }
  return parts;
}

function buildPart(
  m: Merged,
  parentMode: 'HORIZONTAL' | 'VERTICAL' | null,
  ctx: Ctx,
  where: string,
  /** This part's own claimed key — the parent-derived-prefix context for its
   *  children's dedup (see partKey). */
  selfKey: string,
): Record<string, unknown> | null {
  const part: Record<string, unknown> = {};
  const visibleWhen = visibilityFromPresence(m, ctx, where);

  if (m.type === 'TEXT') {
    const byProp: ByPropCollector = { map: {} };
    const tokens = invertTextTokens(m, ctx, where, byProp);
    attachByProp(part, byProp);
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

  if (m.type === 'SLOT') {
    // NATIVE Figma slot node (Schema 2025, dump v1.5) — maps to the SAME
    // contract slot part the INSTANCE_SWAP spelling maps to; the drawn
    // spelling is provenance (regeneration should reproduce it).
    const nativeSlot: Record<string, unknown> = { name: canonicalPropName(m.name) };
    applySlotAccepts(nativeSlot, m.name, ctx, where);
    part.slot = nativeSlot;
    ctx.notes.push(
      `${where}: NATIVE Figma slot node "${m.name}" (Schema 2025) — proposed as slot part (native-slot spelling, dump v1.5; regeneration should reproduce a native slot, not an INSTANCE_SWAP)`,
    );
    ctx.slots.push({ part, property: m.name, optional: false });
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
      const bareSlot: Record<string, unknown> = { name: canonicalPropName(swapProperty) };
      applySlotAccepts(bareSlot, swapProperty, ctx, where);
      applySlotDefaultContent(bareSlot, swapProperty, m, ctx, where);
      part.slot = bareSlot;
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
    // SESSION-LINKING (dump v1.5): componentSetKey FIRST, name fallback, and
    // a name match the keys contradict is REFUSED — see resolveChildContract.
    const keys = instanceKeysOf(m);
    const resolution = resolveChildContract(instanceOf, keys, ctx);
    const id = resolution.id;
    noteResolution(resolution, instanceOf, keys, ctx, where);
    if (!id) {
      // AUTO-PROPOSED CHILD STUB (field case: CBDS Button → ds.icon). A
      // component ref to a contract nobody has is a guaranteed emit refusal
      // ("no contract in scope") — so the proposal ships a STUB child
      // contract alongside itself (childStubs), built from the observed
      // applied values (and, dump v1.5, the OBSERVED bounding box + primary
      // paint — honest geometry, never guessed anatomy). The stub names its
      // own provisionality.
      const stubId = captureStub(instanceOf, m, ctx, where);
      ctx.notes.push(
        `${where}: nested instance of "${instanceOf}" has no known contract — component ref proposed as "${stubId}" with a STUB child contract auto-proposed alongside (childStubs; API from observed applied values only, anatomy not captured — import the real child set to replace it)`,
      );
    }
    // The ref and the stub share stubIdFor — they can never drift apart.
    const component: Record<string, unknown> = { id: id ?? stubIdFor(instanceOf, ctx, keys).id };
    const appliedOcc = m.occ.filter((o) => o.node.componentProperties !== undefined);
    if (appliedOcc.length > 0) {
      const canonical = canonicalizeInstanceProps(instanceOf, appliedOcc[0].node.componentProperties!, id, ctx, where, false, keys);
      // Prop threading: an applied value that tracks a parent enum axis 1:1
      // becomes "{parentProp}" (per-variant fidelity); the per-occurrence
      // values are canonicalized QUIETLY (the first occurrence above already
      // carried the named notes).
      const perOccurrence = appliedOcc.map((o) => ({
        variant: o.variant,
        canonical: canonicalizeInstanceProps(instanceOf, o.node.componentProperties!, id, ctx, where, true, keys),
      }));
      threadInstanceProps(canonical, perOccurrence, ctx, where, instanceOf);
      // Every applied prop may have been dropped as unmappable (each is a
      // named note) — an empty props object carries nothing.
      if (Object.keys(canonical).length > 0) component.props = canonical;
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

  const partByProp: ByPropCollector = { map: {} };
  const tokens = invertNodeTokens(m, false, ctx, where, partByProp);
  attachByProp(part, partByProp);

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
    applySlotAccepts(slot, soleSwap, ctx, where);
    applySlotDefaultContent(slot, soleSwap, soleChild, ctx, where);
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
  // Pre-order key claiming + P9 run detection — see buildChildParts.
  const parts = buildChildParts(m.children, mode, ctx, where, selfKey);
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
    // dump v1.5: the BOOLEAN property definition's defaultValue is CAPTURED
    // evidence — it wins over the hidden-pattern inference (field case:
    // Eventz hasStartIcon/hasEndIcon default true; the icons are visible in
    // every drawn variant, so the hidden pattern could never recover it).
    const definitionDefault = ctx.boolDefaults?.[property];
    const inDefault = m?.occ.find((o) => o.variant === ctx.totalVariants[0]);
    const hiddenInDefault = inDefault?.node.hidden === true;
    if (definitionDefault !== undefined) {
      ctx.boolProps.push({ name, property, default: definitionDefault });
      ctx.notes.push(
        `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default ${definitionDefault}: the property definition's defaultValue, dump v1.5)`,
      );
    } else if (hiddenInDefault) {
      ctx.boolProps.push({ name, property, default: false });
      ctx.notes.push(
        `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default false: the node is hidden in the default variant, dump v1.1)`,
      );
    } else if (ctx.hiddenCaptured && inDefault) {
      // The producer CAPTURES `hidden` (dump v1.1+, named in _provenance) —
      // the node drawn VISIBLE in the default variant is positive evidence,
      // the exact mirror of the hidden→false rule above. Field case: the
      // CBDS Dialog's ↪️action-* buttons, drawn visible in every variant,
      // rendered nothing because their defaults were "not recoverable".
      ctx.boolProps.push({ name, property, default: true });
      ctx.notes.push(
        `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default true: the node is visible in the default variant and this dump's producer captures visibility — dump v1.1+ provenance)`,
      );
    } else {
      ctx.boolProps.push({ name, property });
      ctx.notes.push(
        `${where}: visibility bound to BOOLEAN "${property}" — proposed as prop \`${name}\` (default not recoverable from dump v1, review)`,
      );
    }
  }
  part.visibleWhen = { prop: name };
}

function canonicalizeInstanceProps(
  instanceOf: string,
  applied: Record<string, string | boolean>,
  /** The SESSION-LINKED contract id (resolveChildContract) — null when the
   *  instance did not resolve. Canonicalization must run against the SAME
   *  contract the emitted ref points at, never a fresh name lookup (a name-
   *  coincidence the resolver refused must not sneak back in here). */
  resolvedId: string | null,
  ctx: Ctx,
  where: string,
  /** Quiet mode (prop threading's per-occurrence pass): map without notes —
   *  the first occurrence already carried the named notes. */
  quiet = false,
  /** The instance's captured identity keys — stubIdFor is key-aware. */
  keys?: { setKey?: string; key?: string },
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const note = (text: string) => {
    if (!quiet) ctx.notes.push(text);
  };
  // The ref id and the stub share stubIdFor — when the resolver misses but
  // the derived id lands on a contract already in scope (live-kit census:
  // "ListItem"/"BreadcrumbItem"/"AvatarGroup" slugs collide with the repo's
  // ds.list-item / ds.breadcrumb-item / ds.avatar-group), the emitted ref
  // resolves to THAT contract (a stub never overrides a registered contract),
  // so canonicalization must run against it too.
  const child =
    (resolvedId ? ctx.contractsById?.get(resolvedId) : undefined) ??
    ctx.contractsById?.get(stubIdFor(instanceOf, ctx, keys).id);
  let mapped = 0;
  let dropped = 0;
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
    if (child) {
      // The child contract IS in scope but this applied prop does not map
      // through its bindings.figma — DROPPED with a named note, never
      // guessed (a guessed spelling is an unknown child prop the referee
      // refuses; the mismatch usually means the child contract is stale
      // against the live kit).
      dropped++;
      note(
        `${where}: applied prop "${property.split('#')[0]}" on nested "${instanceOf}" does not map through ${child.id}'s bindings — not carried; verify the child contract is current`,
      );
      continue;
    }
    // Fallback without the child contract in scope: canonical spelling.
    // The key may carry its "#id" suffix (dump v1.5) — the NAME is the part
    // before it, exactly as buildChildStub derives the stub's prop names,
    // and a suffixed string key is a TEXT property whose VALUE passes
    // through VERBATIM (camel-canonicalizing "Label" into "label" would
    // rewrite drawn content).
    const isTextKey = property.includes('#') && typeof value === 'string';
    out[canonicalPropName(property.split('#')[0])] =
      typeof value === 'string' && !isTextKey ? camel(value) : value;
  }
  if (child && mapped === Object.keys(applied).length) {
    note(`${where}: fixed props of "${instanceOf}" canonicalized through ${child.id}'s bindings`);
  } else if (child) {
    note(
      `${where}: fixed props of "${instanceOf}": ${mapped} canonicalized through ${child.id}'s bindings, ${dropped} dropped as unmappable (named per prop above)`,
    );
  } else {
    note(`${where}: fixed props of "${instanceOf}" canonicalized by spelling (dump v1.1) — verify against the child contract's bindings`);
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
    // dump v1.4: literal min/max sizing travels with the styled node.
    if (inst.minWidth !== undefined) variant.minWidth = inst.minWidth;
    if (inst.minHeight !== undefined) variant.minHeight = inst.minHeight;
    if (inst.maxWidth !== undefined) variant.maxWidth = inst.maxWidth;
    if (inst.maxHeight !== undefined) variant.maxHeight = inst.maxHeight;
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
/** Deep-merge one minted DTCG tree into another (namespaced sub-trees only —
 *  parent mints ride imported.<component>.*, stub geometry imported.stub-*.*,
 *  so leaves never collide; groups merge recursively). */
function mergeMintTree(into: Record<string, unknown>, from: Record<string, unknown>) {
  for (const [key, value] of Object.entries(from)) {
    const existing = into[key];
    if (existing && typeof existing === 'object' && value && typeof value === 'object' && !('$value' in (value as object))) {
      mergeMintTree(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      into[key] = value;
    }
  }
}

/** STUB GEOMETRY (dump v1.5): mint the stub's OBSERVED bounding box and
 *  primary paints into provisional `imported.stub-<id>.*` leaves and bind
 *  the stub's root tokens to them — a correctly-sized, correctly-colored
 *  box, so a composite whose child is out of scope renders honest geometry
 *  instead of nothing. Per-variant sizes correlate against the STUB'S OWN
 *  enum props (the observed applied values), the same axis machinery the
 *  parent's mint pass uses. Nothing about the child's internals is guessed.
 *  Minted width/height are the OBSERVED bbox VERBATIM — size tokens speak
 *  border-box, Figma's own box model (canvas-box parity rule; emit-html
 *  scopes `box-sizing: border-box`; the playground carries it globally), so
 *  an inside stroke draws inside the box exactly like Figma draws it. */
function stubGeometry(
  capture: StubCapture,
  props: Array<Record<string, unknown>>,
  ctx: Ctx,
): { tokens: Record<string, string>; tree: Record<string, unknown>; count: number; entries: MintedEntry[] } | null {
  if (!ctx.mint) return null;
  const geo = capture.observed.filter((o) => o.bbox !== undefined);
  if (geo.length === 0) return null;
  const enumProps = props.filter(
    (p): p is Record<string, unknown> & { name: string; type: { enum: string[] } } =>
      typeof p.type === 'object' && p.type !== null && 'enum' in (p.type as object),
  );
  const axes: MintAxis[] = enumProps.map((p) => ({ propName: p.name, values: p.type.enum }));
  const axisValuesFor = (o: StubCapture['observed'][number]): Record<string, string> => {
    const rec: Record<string, string> = {};
    for (const p of enumProps) {
      const property = (p.bindings as { figma: { property: string } }).figma.property;
      for (const [key, value] of Object.entries(o.applied ?? {})) {
        if (key.split('#')[0] === property && typeof value === 'string') rec[p.name] = camel(value);
      }
    }
    return rec;
  };
  // Border is carried only when EVERY observed occurrence draws a raw-hex
  // stroke with one shared weight. Anything less — partial presence (field
  // case: the Shoelace kit strokes SOME primary variants and not others,
  // so presence is not even a function of the axes), var-bound paints,
  // mixed weights — is a NAMED limit: a border that appears on some axis
  // values but not others is not a function of the axes and cannot mint.
  // (Sizes are unaffected either way: border-box, bbox verbatim.)
  const strokesCarriable =
    geo.every((o) => o.stroke?.hex !== undefined && typeof o.strokeWeight === 'number') &&
    new Set(geo.map((o) => o.strokeWeight)).size === 1;
  if (!strokesCarriable && geo.some((o) => o.stroke !== undefined)) {
    ctx.notes.push(
      `stub ${capture.id}: stroke drawn on ${geo.filter((o) => o.stroke).length}/${geo.length} observed occurrence(s) (or var-bound/non-uniform) — border not carried on the stub geometry (presence is not a function of the stub's axes), review`,
    );
  }
  const observations: MintObservation[] = [];
  const push = (cssProperty: string, kind: MintObservation['kind'], value: (o: StubCapture['observed'][number]) => string | number | null) => {
    const occ = geo.map((o) => ({ variant: o.variant, axisValues: axisValuesFor(o), value: value(o) }));
    if (occ.some((x) => x.value === null)) return;
    observations.push({
      nodePath: `stub ${capture.id}`,
      part: '',
      cssProperty,
      kind,
      occurrences: occ as Array<{ variant: string; axisValues: Record<string, string>; value: string | number }>,
    });
  };
  push('width', 'px', (o) => Math.round(o.bbox!.width * 100) / 100);
  push('height', 'px', (o) => Math.round(o.bbox!.height * 100) / 100);
  const fills = geo.filter((o) => o.fill !== undefined);
  if (fills.length > 0 && fills.every((o) => o.fill!.hex !== undefined)) {
    // Occurrences without a fill are honestly TRANSPARENT (#00000000 — a
    // legal DTCG color and a CSS color), so a per-variant fill mints per
    // axis instead of dropping the channel.
    push('background-color', 'color', (o) => (o.fill ? paintCssHex(o.fill) : '#00000000'));
  } else if (fills.length > 0) {
    ctx.notes.push(
      `stub ${capture.id}: fill var-bound on observed occurrence(s) — background not carried on the stub geometry, review`,
    );
  }
  if (strokesCarriable) {
    push('border-color', 'color', (o) => (o.stroke ? paintCssHex(o.stroke) : '#00000000'));
    push('border-width', 'px', (o) => (o.stroke ? o.strokeWeight! : 0));
  }
  if (geo.some((o) => (o.cornerRadius ?? 0) !== 0)) {
    push('border-radius', 'px', (o) => o.cornerRadius ?? 0);
  }
  if (observations.length === 0) return null;
  const minted = mintTokens(`stub-${capture.id.split('.').slice(1).join('-')}`, observations, axes);
  const tokens: Record<string, string> = {};
  minted.bindings.forEach((binding, i) => {
    if (binding.ref) tokens[observations[i].cssProperty] = binding.ref;
    else if (binding.reason) ctx.notes.push(`stub ${capture.id} ${observations[i].cssProperty}: ${binding.reason}`);
  });
  if (Object.keys(tokens).length === 0) return null;
  return { tokens, tree: minted.tree, count: minted.count, entries: minted.entries };
}

function buildChildStub(
  capture: StubCapture,
  ctx: Ctx,
  fileKey: string | null,
): { contract: Record<string, unknown>; geometry: ReturnType<typeof stubGeometry> } {
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
  // dump v1.5: stub geometry — the observed box binds the root's tokens to
  // minted provisional leaves; a text prop observed on the instances renders
  // as the box's content (the drawn label is real observed content).
  const geometry = stubGeometry(capture, props, ctx);
  const root: Record<string, unknown> = {};
  // Every stub renders its OBSERVED truth and nothing else: a captured TEXT
  // prop becomes the box's content (the drawn label is real observed
  // content); otherwise the root carries EXPLICIT empty parts — without
  // them the html surface falls back to rendering the contract NAME as
  // content, invented ink (field failures: the 20×20 icon stub rendered
  // the word "Play" and widened every eventz row's content crop; the CBDS
  // Dialog rendered "ButtonBrandSecondary" and "Icon" as literal strings).
  const textProp = props.find((p) => p.type === 'text');
  root.parts = textProp
    ? { [String(textProp.name)]: { content: { prop: String(textProp.name) } } }
    : {};
  if (geometry) {
    root.tokens = geometry.tokens;
    ctx.notes.push(
      `stub ${capture.id}: renders HONEST OBSERVED GEOMETRY (dump v1.5 bounding box${geometry.tokens['background-color'] ? ' + primary paint' : ''}${geometry.tokens['border-color'] ? ' + border' : ''}) via minted imported.stub-* tokens — a correctly-sized box, NOT the child's anatomy (still not captured); import the real child set to replace it`,
    );
  }
  return {
    contract: {
      $schema: './contract.schema.json',
      id: capture.id,
      name,
      version: '0.1.0',
      status: 'draft',
      description: `STUB contract auto-proposed for the nested "${capture.instanceOf}" instances of ${ctx.setName} — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries)${geometry ? '; the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry' : ''}. Import the child set to replace this stub.`,
      semantics: { element: 'span' },
      props,
      states: [],
      anatomy: { root },
      anchors: {
        figma: { fileKey, componentSetKey: capture.setKey ?? null },
        code: { importPath: `src/components/${name}`, export: name },
      },
    },
    geometry,
  };
}

/** ROOT FIXED-SIZE inversion (dump v1.5): a root axis DRAWN as FIXED
 *  (primary/counterAxisSizingMode) carries its dimension nowhere in the
 *  layout facts — the observed bbox is the only witness. When every variant
 *  declares the axis FIXED and carries a bbox, the dimension becomes a mint
 *  observation on the root tokens (uniform → one leaf; per-variant →
 *  axis-substituted, the standard machinery). A width/height already bound
 *  to a variable stays the variable's. Field case: the CBDS Dialog's
 *  per-size widths (320/496/800) — without them the body text never wraps
 *  and every variant renders hundreds of px too wide. */
function invertRootFixedSize(merged: Merged, rootTokens: Record<string, string>, ctx: Ctx, where: string) {
  if (!ctx.mint) return;
  const withBox = merged.occ.filter((o) => o.node.bbox !== undefined && o.node.layout !== undefined);
  if (withBox.length === 0) return;
  if (withBox.length !== merged.occ.length) {
    ctx.notes.push(
      `${where}: root bbox captured on ${withBox.length}/${merged.occ.length} variant(s) only — fixed root size not proposed (partial evidence), review`,
    );
    return;
  }
  const fixedAxis = (o: Occ, dim: 'width' | 'height'): boolean => {
    const l = o.node.layout!;
    const alongPrimary = (l.mode === 'HORIZONTAL') === (dim === 'width');
    return (alongPrimary ? l.primarySizing : l.counterSizing) === 'FIXED';
  };
  // The bbox is the BORDER box and size tokens SPEAK border-box — Figma's
  // own box model, the same convention captured size variables carry (a
  // bound 48px height IS the drawn 48px box; canvas-box parity rule). Every
  // rendering surface agrees: the canvas preview and the playground set
  // box-sizing: border-box globally, and emit-html scopes the same rule
  // into its emitted CSS. The bbox therefore mints VERBATIM — padding and
  // inside strokes draw INSIDE it, exactly like Figma draws them.
  // (Previously this inverted to content-box, which contradicted the
  // captured-variable convention on the same root — visual-parity receipt:
  // Dialog width minted 272 for a drawn 320 box.)
  for (const dim of ['width', 'height'] as const) {
    if (!withBox.every((o) => fixedAxis(o, dim))) continue;
    if (rootTokens[dim] !== undefined || merged.occ.some((o) => o.node.bound?.[dim])) continue;
    mintObservation(
      ctx,
      rootTokens,
      where,
      dim,
      'px',
      withBox.map((o) => ({ variant: o.variant, value: Math.round(o.node.bbox![dim] * 100) / 100 })),
    );
    ctx.notes.push(
      `${where}: root ${dim} is DRAWN FIXED in every variant — the observed dimension (${[...new Set(withBox.map((o) => o.node.bbox![dim]))].join('/')}px, dump v1.5 bbox) is proposed as a minted root token (the drawn value is the only witness; rename against your real tokens)`,
    );
  }
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
  /** v13: a PART-level override — the part's claimed key. Minted paths then
   *  read `imported.<component>.<key>-state-<state>.<channel>` (the root
   *  spelling with the part segment in front); root when absent. */
  partKey?: string,
) {
  if (!ctx.mint) return;
  ctx.mint.observations.push({
    nodePath: partKey
      ? `${ctx.setName}:root/${partKey} (state ${state})`
      : `${ctx.setName}:root (state ${state})`,
    part: partKey ? `${partKey}/state-${state}` : `state-${state}`,
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

/** One collected part-level state override record — written by
 *  proposeStateDiffs, attached to its part AFTER the mint pass (so minted
 *  refs have landed), exactly the root stateOverrides lifecycle. */
export interface PartStateTarget {
  /** The built anatomy part record (the same object stored in root.parts). */
  part: Record<string, unknown>;
  state: string;
  target: Record<string, string>;
}

/** Diff ONE promoted state's (flattened) variants against the matching
 *  default-state variants and propose root `states` overrides: bound facts as
 *  (substituted) refs, raw literals as mint observations, everything the
 *  vocabulary cannot carry as a NAMED note. Channels are the root box facts
 *  the dump carries: fill, stroke (+weight), corner radius, node opacity.
 *  v13 (P18 second half): depth-1 part color-kind diffs (text fill → color,
 *  frame fill → background-color, stroke → border-color) are PROPOSED as
 *  part-level `states` overrides through the same occurrence machinery —
 *  per-variant refs unify, raw literals mint (`imported.<component>.<part>-
 *  state-<state>.<channel>`); the old STYLE-FIDELITY B7 blanket receipt is
 *  retired where the channel now carries and stays NARROW elsewhere
 *  (component-ref/slot children — the child contract owns its styling — and
 *  channels outside the color-kind set). A child drawn ONLY in the focus
 *  state carrying a stroke inverts to the focus-visible outline pair (the
 *  ds.button focus-ring convention). */
function proposeStateDiffs(
  ctx: Ctx,
  state: string,
  group: DumpNode[],
  baseByName: Map<string, DumpNode>,
  baseChildNames: Set<string>,
  baseRootTokens: Record<string, string>,
  target: Record<string, string>,
  /** The built root anatomy parts + the drawn-name → part-key map (depth-1)
   *  and the cross-state collector. Absent parts (auto-label hoist) keep the
   *  named-note path. */
  rootParts?: Record<string, unknown>,
  keyByChildName?: Map<string, string>,
  partStates?: PartStateTarget[],
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
      } else if (u.kind === 'per-value') {
        ctx.notes.push(
          `${where} ${paintName} (state ${state}): bindings are a function of an enum axis by value — a state block holds ONE ref per channel (tokensByProp has no per-state form); NAMED, not proposed (review)`,
        );
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

  // Depth-1 part color-kind diffs (v13, P18 second half): PROPOSED as part-
  // level `states` overrides on text/icon/box parts through the same
  // occurrence machinery as the root channels (per-variant refs unify, raw
  // literals mint). The old STYLE-FIDELITY B7 blanket receipt is RETIRED
  // where the channel now carries; it stays NARROW where the vocabulary
  // deliberately stops: component-ref/slot/repeat children (the child
  // contract owns its styling) and channels outside the color-kind set.
  const childOccByName = new Map<string, Array<{ variant: string; node: DumpNode; base: DumpNode }>>();
  for (const o of occs) {
    for (const c of o.node.children ?? []) {
      const bc = (o.base.children ?? []).find((x) => x.name === c.name);
      if (!bc) continue;
      const list = childOccByName.get(c.name) ?? [];
      list.push({ variant: o.variant, node: c, base: bc });
      childOccByName.set(c.name, list);
    }
  }
  for (const [childName, childOccs] of childOccByName) {
    type Pick = (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined;
    const channels: Array<{ cssProp: string; paintName: string; pick: Pick }> =
      childOccs.every((x) => x.node.type === 'TEXT')
        ? [{ cssProp: 'color', paintName: 'fill', pick: (n) => n.fill }]
        : [
            { cssProp: 'background-color', paintName: 'fill', pick: (n) => n.fill },
            { cssProp: 'border-color', paintName: 'stroke', pick: (n) => n.stroke },
          ];
    for (const ch of channels) {
      if (!childOccs.some((x) => paintKey(ch.pick(x.node)) !== paintKey(ch.pick(x.base)))) continue;
      const at = `${where}/${childName}`;
      const key = keyByChildName?.get(childName);
      const partRec = key !== undefined && rootParts ? (rootParts[key] as Record<string, unknown> | undefined) : undefined;
      if (!partRec || !partStates) {
        ctx.notes.push(
          `${at}: ${ch.paintName} differs in state "${state}" but no anatomy part maps to this drawn child — NAMED, not proposed (review)`,
        );
        continue;
      }
      if (partRec.component !== undefined || partRec.slot !== undefined || partRec.repeat !== undefined) {
        ctx.notes.push(
          `${at}: ${ch.paintName} differs in state "${state}" on a ${partRec.slot !== undefined ? 'slot' : 'component-ref'} part — the child contract owns its styling (part-level state overrides carry on text/icon/box parts only, v13); NAMED, not proposed (review)`,
        );
        continue;
      }
      // One override record per (part, state) across channels — attached to
      // the part AFTER the mint pass, the root stateOverrides lifecycle.
      let rec = partStates.find((r) => r.part === partRec && r.state === state);
      if (!rec) {
        rec = { part: partRec, state, target: {} };
        partStates.push(rec);
      }
      const paints = childOccs.map((x) => ({ variant: x.variant, paint: ch.pick(x.node) }));
      if (paints.some((p) => p.paint === undefined)) {
        ctx.notes.push(
          `${at}: ${ch.paintName} differs in state "${state}" but is absent in some of its variant(s) — a state override cannot unset a channel; NAMED, not proposed (review)`,
        );
        continue;
      }
      const partBaseTokens = (partRec.tokens ?? {}) as Record<string, string>;
      if (paints.every((p) => p.paint!.var !== undefined)) {
        const u = unifyRefs(
          paints.map((p) => ({ variant: p.variant, path: dotPath(p.paint!.var!) })),
          ctx.axes,
        );
        if (u.kind === 'ref') {
          if (u.ref !== partBaseTokens[ch.cssProp]) rec.target[ch.cssProp] = u.ref;
        } else if (u.kind === 'per-value') {
          ctx.notes.push(
            `${at} ${ch.paintName} (state ${state}): bindings are a function of an enum axis by value — a state block holds ONE ref per channel; NAMED, not proposed (review)`,
          );
        } else if (u.kind === 'drift') {
          ctx.notes.push(`${at} ${ch.paintName} (state ${state}): ${u.detail}`);
        }
        continue;
      }
      if (paints.every((p) => p.paint!.hex !== undefined)) {
        reportUnbound(ctx, `${at} (state ${state})`, ch.paintName, paintCssHex(paints[0].paint!));
        mintStateObservation(
          ctx, rec.target, state, ch.cssProp, 'color',
          paints.map((p) => ({ variant: p.variant, value: paintCssHex(p.paint!) })),
          `${at} (state ${state})|${ch.paintName}`,
          key,
        );
        if (!ctx.mint) {
          ctx.notes.push(
            `${at}: ${ch.paintName} changes in state "${state}" (${paintCssHex(paints[0].paint!)}) — a literal part-state override needs minting (mintUnbound); NAMED, not proposed`,
          );
        }
        continue;
      }
      ctx.notes.push(
        `${at}: ${ch.paintName} in state "${state}" mixes bound and raw paints across variants — not proposed, review`,
      );
    }
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
    /** componentSetKey (or setless component key) → contract id (dump v1.5)
     *  — the SESSION-LINKING index, checked BEFORE the name lookup; build it
     *  from every in-scope contract's anchors.figma.componentSetKey
     *  (repo contracts AND previously imported ones). */
    contractIdByKey?: Map<string, string>;
    prefix?: string;
    fileKey?: string | null;
    /** Mint provisional tokens (core/mint-tokens.ts) from the unbound-value
     *  observations and BIND the proposal to them, instead of dropping every
     *  degraded style. Default false — the classic report-only behavior. */
    mintUnbound?: boolean;
    /** The dump's producer captures `hidden` (dump v1.1+) — derive from the
     *  dump's _provenance via dumpCapturesHidden. Unlocks the visible-in-
     *  default-variant → boolean default TRUE inference; default false
     *  (absence stays "not captured", nothing invented). */
    hiddenCaptured?: boolean;
    /** Captured-variable resolved values, dot-path → CSS value — build from
     *  the dump's `_variables` via capturedTokensFromDump (the batch entry
     *  does this automatically). Only consumed with `mintUnbound: true`: it
     *  lets a bound paint whose refs refuse unification survive as
     *  per-variant minted literals (live-gauntlet class ①) instead of
     *  dropping the channel. Absent → the classic drift note stands. */
    capturedValues?: Map<string, string>;
  },
): FigmaProposalResult {
  const prefix = opts.prefix ?? 'ds';
  const preNotes: string[] = [];

  // Theme/mode-axis promotion (§3 — see the section doc above): runs FIRST,
  // over the full drawn set. A corroborated mode axis is excluded from the
  // API; the whole pipeline (state promotion included) then runs on the
  // DEFAULT mode's variants only — the other modes never feed anatomy,
  // facts, or the mint pass (their resolved literals are receipts, not a
  // second palette).
  const modePromo = detectModeAxis(parseAxes(set.variants.map((v) => v.name)), set.variants, set.setName, preNotes);
  let sourceVariants = set.variants;
  if (modePromo) {
    sourceVariants = set.variants
      .filter((v) => axisValuesOf(v.name)[modePromo.axis.property] === modePromo.defaultValue)
      .map((v) => ({
        ...(JSON.parse(JSON.stringify(v)) as DumpNode),
        name: stripAxisFromName(v.name, modePromo.axis.property, set.setName),
      }));
    preNotes.push(
      `variant axis "${modePromo.axis.property}" (${modePromo.axis.values.join('|')}) IS a token-mode axis, not API (§3 — structurally corroborated: identical anatomy and bound variable NAMES across the axis; only color-kind literals/resolved values differ) — excluded from props; anatomy and facts build from the ${sourceVariants.length} "${modePromo.defaultValue}" (default-mode) variant(s) only; bindings resolve per mode through the variable collection (the captured-token layer carries per-mode values when the dump provides them — dump v1.6 \`modes\`); other modes' resolved literals are NOT minted (a dark-mode hex minting imported.* tokens would fabricate a second palette). Rename story: regeneration draws the default mode only — the axis spelling lives in this note and on the source set, and the contract's \`modes\` metadata names the modes`,
    );
  }

  // Interaction-state axis promotion (see the section doc above): detect the
  // axis over the FULL variant set, then partition — default-state variants
  // are the base the whole pipeline runs on; each promoted state's variants
  // (and the disabled group) are kept aside, names stripped of the state
  // pair, for the root-diff pass after the anatomy is built.
  let statePromo = detectStateAxis(parseAxes(sourceVariants.map((v) => v.name)), preNotes);
  let baseVariants: DumpNode[] | null = null;
  const stateGroups = new Map<PromotedState, DumpNode[]>();
  let disabledGroup: DumpNode[] = [];
  if (statePromo) {
    const promo = statePromo;
    const valueOf = (v: DumpNode) => axisValuesOf(v.name)[promo.axis.property];
    if (sourceVariants.some((v) => valueOf(v) === undefined)) {
      preNotes.push(
        `variant axis "${promo.axis.property}": interaction-state axis detected but some variant names omit the pair — promotion unsafe, axis kept as an enum prop; review`,
      );
      statePromo = null;
    } else {
      const strip = (v: DumpNode): DumpNode => ({
        ...(JSON.parse(JSON.stringify(v)) as DumpNode),
        name: stripAxisFromName(v.name, promo.axis.property, set.setName),
      });
      baseVariants = sourceVariants.filter((v) => valueOf(v) === promo.defaultValue).map(strip);
      for (const p of promo.promoted) {
        stateGroups.set(p.state, sourceVariants.filter((v) => valueOf(v) === p.value).map(strip));
      }
      if (promo.disabledValue !== undefined) {
        disabledGroup = sourceVariants.filter((v) => valueOf(v) === promo.disabledValue).map(strip);
      }
      preNotes.push(
        `variant axis "${promo.axis.property}" (${promo.axis.values.join('|')}) IS the platform's interaction states, not API — promoted: the axis is NOT a prop; anatomy and base facts come from the ${baseVariants.length} default-state variant(s); ${promo.promoted
          .map((p) => `${p.value}→${p.state}`)
          .join(', ')} propose root state overrides${promo.disabledValue !== undefined ? `; ${promo.disabledValue}→ a \`disabled\` BOOLEAN prop + disabled state block` : ''}`,
      );
    }
  }

  const variantNames = (baseVariants ?? sourceVariants).map((v) => v.name);
  const axes = parseAxes(variantNames);
  const enumAxes = axes.filter((a) => !isBoolAxis(a.values));
  const ctx: Ctx = {
    setName: set.setName,
    axes,
    totalVariants: variantNames,
    corpus: opts.corpus,
    contractIdByName: opts.contractIdByName,
    contractsById: opts.contractsById,
    contractIdByKey: opts.contractIdByKey,
    swapPreferredValues: set.swapPreferredValues,
    boolDefaults: set.boolDefaults,
    hiddenCaptured: opts.hiddenCaptured,
    capturedValues: opts.capturedValues,
    prefix,
    notes: [],
    unbound: [],
    textProps: [],
    boolProps: [],
    arrayProps: [],
    slots: [],
    flattenedVariants: new Set(),
    stubs: new Map(),
    partNames: new Set(['root']),
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
  const variants = baseVariants ?? (JSON.parse(JSON.stringify(sourceVariants)) as DumpNode[]);
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
  const rootKeyByChildName = new Map<string, string>();
  const rootLayout = invertLayout(merged, true, null, ctx, where);
  if (rootLayout) root.layout = rootLayout;
  const rootByProp = invertLayoutByProp(merged, ctx, where);
  if (rootByProp) root.layoutByProp = rootByProp;
  const rootTokensByProp: ByPropCollector = { map: {} };
  const rootTokens = invertNodeTokens(merged, true, ctx, where, rootTokensByProp);

  // Generator artifact: a root whose only child is the auto-injected `label`
  // text node (contracts with a `children` text prop and no parts). The node
  // is not a part — its text tokens hoist to the root.
  const only = merged.children.length === 1 ? merged.children[0] : undefined;
  const autoLabel =
    only && only.type === 'TEXT' && only.name === 'label' && unifiedPropRef(only, 'characters', ctx, `${where}/label`);
  if (only && autoLabel) {
    // The label's tokens hoist to the root — its per-value correlations ride
    // the SAME root collector, so a hoisted function lands on root.tokensByProp.
    const textTokens = invertTextTokens(only, ctx, `${where}/label`, rootTokensByProp);
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
    // Pre-order key claiming + P9 run detection — see buildChildParts.
    // rootKeyByChildName maps drawn depth-1 names onto their claimed keys —
    // the part-level state diff (v13) resolves parts through it.
    const parts = buildChildParts(merged.children, mode, ctx, where, 'root', rootKeyByChildName);
    if (Object.keys(parts).length > 0) root.parts = parts;
  }
  invertNodeOpacity(merged, root, rootTokens, ctx, where);
  invertNodeEffects(merged, rootTokens, ctx, where);
  invertRootFixedSize(merged, rootTokens, ctx, where);
  attachByProp(root, rootTokensByProp);
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
  const partStateTargets: PartStateTarget[] = [];
  if (statePromo) {
    const baseByName = new Map(variants.map((v) => [v.name, v]));
    const baseChildNames = new Set<string>();
    for (const v of variants) for (const c of v.children ?? []) baseChildNames.add(c.name);
    const groups: Array<[string, DumpNode[]]> = [...stateGroups.entries()];
    if (disabledGroup.length > 0) groups.push(['disabled', disabledGroup]);
    for (const [state, group] of groups) {
      const target = (stateOverrides[state] ??= {});
      proposeStateDiffs(
        ctx, state, group, baseByName, baseChildNames, rootTokens, target,
        (root.parts as Record<string, unknown> | undefined) ?? {},
        rootKeyByChildName,
        partStateTargets,
      );
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
    if (s !== defaultSlot && propNameDigitLed(s.property)) {
      ctx.notes.push(
        `slot \`${name}\`: Figma property "${s.property}" is digit-led — a code identifier cannot start with a digit, so the name gets the deterministic "p" prefix (the componentIdSlug digit-led discipline); the original spelling stays the design binding (slot.figmaProperty)`,
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
  // P9 repeated-children collections: the arrayOf prop each repeat part maps
  // over — code-only by declared fidelity limit (bindings.figma.kind NONE;
  // the canvas renders repeat.sample instead). No default: an optional array.
  for (const a of ctx.arrayProps) {
    props.push({
      name: a.name,
      type: { arrayOf: a.fields },
      bindings: {
        figma: { kind: 'NONE' },
        code: { prop: a.name },
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
  const selfId = `${prefix}.${componentIdSlug(set.setName)}`;
  if (idSlugSanitized(set.setName)) {
    // Field case (CBDS kit, first live plugin send): "_variable-list-item",
    // "Button / Primary / Medium", "Type=Text, Variant=Error" all derive ids
    // the schema's ^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$ refuses — sanitize AT
    // PROPOSAL (the prop-identifier discipline), never refuse at receive.
    ctx.notes.push(
      `contract id: drawn set name "${set.setName}" contains characters a contract id cannot carry — id proposed as "${selfId}" (rule: lowercase kebab, illegal characters → hyphens, runs collapsed, edge hyphens stripped, digit-led/empty gets "c"); the canvas set keeps its own name and the componentSetKey/nodeId anchors carry identity`,
    );
  }
  for (const p of props) {
    const property = (p.bindings as { figma?: { property?: string } }).figma?.property;
    if (property && propNameSanitized(property)) {
      ctx.notes.push(
        `prop \`${String(p.name)}\`: Figma property "${property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (bindings.figma.property)`,
      );
    }
    if (property && propNameDigitLed(property)) {
      ctx.notes.push(
        `prop \`${String(p.name)}\`: Figma property "${property}" is digit-led — a code identifier cannot start with a digit, so the name gets the deterministic "p" prefix (the componentIdSlug digit-led discipline applied to prop code bindings); the original spelling stays the design binding (bindings.figma.property)`,
      );
    }
  }

  // Deterministic semantics inference (name/axis table — zero AI, see
  // inferSemantics). A detected interaction-state axis is the structural
  // corroboration that the component is interactive.
  const inferred = inferSemantics(set.setName, axes, statePromo !== null);
  const contract: Record<string, unknown> = {
    $schema: './contract.schema.json',
    id: selfId,
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
    // §3: receipt-grade metadata — the promoted mode axis's values as mode
    // names (never a prop; changes no emitter output).
    ...(modePromo ? { modes: modePromo.axis.values.map(normStateValue) } : {}),
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
    // The minted-ref component segment must be a legal token-path segment —
    // the same slug the contract id uses (kebab alone lets "/" or "=" leak
    // into `imported.*` refs, which the token-ref grammar refuses).
    const minted = mintTokens(componentIdSlug(set.setName), observations, ctx.mint.axes);
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
    // v13: part-level overrides (attached below) DECLARE a state exactly
    // like root ones — the disabled label color alone is a real state.
    const partPresent = new Set<string>();
    for (const rec of partStateTargets) {
      if (Object.keys(rec.target).length > 0) partPresent.add(rec.state);
    }
    const present = declared.filter(
      (s) => Object.keys(stateOverrides[s]).length > 0 || partPresent.has(s),
    );
    for (const s of declared) {
      if (!present.includes(s)) {
        ctx.notes.push(
          `state "${s}": promoted from the axis but no root or part override was recoverable — state not declared (its variants render identically to default, or every channel refused by name above)`,
        );
      }
    }
    // Part-level attach (v13): surviving records land on their parts'
    // `states`, and each landing is a NAMED note (the B7 receipt's
    // replacement — the channel now CARRIES).
    for (const rec of partStateTargets) {
      if (!present.includes(rec.state) || Object.keys(rec.target).length === 0) continue;
      const states = (rec.part.states ?? {}) as Record<string, Record<string, string>>;
      states[rec.state] = { ...(states[rec.state] ?? {}), ...rec.target };
      rec.part.states = states;
      const partKeyName = Object.entries((root.parts as Record<string, unknown>) ?? {}).find(([, v]) => v === rec.part)?.[0] ?? '(part)';
      ctx.notes.push(
        `${set.setName}:root/${partKeyName}: state "${rec.state}" part-level override proposed — ${Object.entries(rec.target)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')} (P18 v13; formerly the STYLE-FIDELITY B7 named gap)`,
      );
    }
    if (present.length > 0) {
      const rootPresent = present.filter((s) => Object.keys(stateOverrides[s]).length > 0);
      if (rootPresent.length > 0) {
        root.states = Object.fromEntries(rootPresent.map((s) => [s, stateOverrides[s]]));
      }
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
        for (const rec of partStateTargets) {
          if (rec.state !== s) continue;
          for (const ref of Object.values(rec.target)) {
            for (const m of ref.matchAll(/\{([a-z][\w-]*)\}/g)) {
              if (enumNames.has(m[1])) substProps.add(m[1]);
            }
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
  // dump v1.5: a stub with observed geometry mints imported.stub-* leaves;
  // its tree merges into the proposal's mintedTokens (namespaced sub-trees,
  // no leaf collisions) so the stub's honest box renders wherever the
  // proposal's own minted styles render.
  const childStubs: Array<Record<string, unknown>> = [];
  for (const capture of ctx.stubs.values()) {
    const built = buildChildStub(capture, ctx, opts.fileKey ?? null);
    childStubs.push(built.contract);
    if (built.geometry) {
      if (!mintedTokens) mintedTokens = { tree: {}, count: 0, entries: [] };
      mergeMintTree(mintedTokens.tree, built.geometry.tree);
      mintedTokens.count += built.geometry.count;
      mintedTokens.entries.push(...built.geometry.entries);
      for (const e of built.geometry.entries) {
        ctx.notes.push(
          `MINTED ${e.ref} = ${e.value} — stub geometry (the "${capture.instanceOf}" instances' OBSERVED box/paint, dump v1.5; provisional) — bound at: ${e.usageSites.join(', ')}`,
        );
      }
    }
  }

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

// ---------------------------------------------------------------------------
// Batch proposal with per-set isolation (owner field case: the first live
// CBDS plugin send)
// ---------------------------------------------------------------------------

/** Plain-words rendering of a caught proposal error. Raw validator/exception
 *  JSON must NEVER be a headline anywhere downstream (the field failure: a
 *  zod issue array rendered verbatim in the playground rail); the verbatim
 *  technical text always survives as `detail`. */
export function plainWordsProposalError(e: unknown): { headline: string; detail?: string } {
  const issues = (e as { issues?: unknown } | null)?.issues;
  if (Array.isArray(issues) && issues.length > 0 && issues.every((i) => i && typeof i === 'object')) {
    const first = issues[0] as { path?: unknown[]; message?: unknown };
    const path = Array.isArray(first.path)
      ? first.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.')
      : '';
    const message = typeof first.message === 'string' ? first.message : 'invalid value';
    const rest = issues.length > 1 ? ` (and ${issues.length - 1} more issue${issues.length === 2 ? '' : 's'})` : '';
    return {
      headline: `the proposed contract did not fit the contract schema — field "${path || 'the contract root'}": ${message}${rest}.`,
      detail: e instanceof Error ? e.message : JSON.stringify(issues, null, 2),
    };
  }
  const message = e instanceof Error ? e.message : String(e);
  if (/^\s*[[{"]/.test(message) || message.length > 400) {
    return { headline: 'the proposal failed with a technical error (full text below).', detail: message };
  }
  return { headline: message };
}

/** One set a batch could not propose — a named, plain-words skip. */
export interface SkippedSet {
  setName: string;
  /** Plain words ("Set "X" could not be proposed: …"), headline-safe. */
  reason: string;
  /** The verbatim technical text (e.g. the validator's own output). */
  detail?: string;
}

export interface DumpBatchResult {
  proposals: Array<{ setName: string } & FigmaProposalResult>;
  skipped: SkippedSet[];
  /** Batch-level observations (e.g. two sets whose sanitized ids collide) —
   *  named notes, never silent. */
  notes: string[];
}

/** Every component set in a dump → a proposal, with PER-SET ISOLATION: one
 *  set failing to propose must not kill the batch (the CBDS field failure —
 *  a real UI kit ships template/private-helper sets alongside the one the
 *  designer meant). A failure becomes a plain-words named skip; sanitized
 *  contract ids that collide across sets are named, never silently merged.
 *  This is the SAME function the playground's receive paths run — receipts
 *  and evals referee the shipping code path. */
export function proposeBatchFromDump(
  dump: Record<string, unknown>,
  opts: Parameters<typeof proposeFromDump>[1],
): DumpBatchResult {
  const proposals: DumpBatchResult['proposals'] = [];
  const skipped: SkippedSet[] = [];
  const notes: string[] = [];
  const claimedIds = new Map<string, string>(); // contract id → set name
  // The batch has the whole dump, so the captured-variable value index
  // (dump v1.4 `_variables` — the class-① mint-routing input) is built here
  // once unless the caller supplied its own.
  const capturedValues =
    opts.capturedValues ??
    new Map((capturedTokensFromDump(dump)?.entries ?? []).map((e) => [e.path, e.value] as const));
  const setOpts = { ...opts, capturedValues };
  for (const [name, value] of Object.entries(dump)) {
    if (name === '_provenance' || !isDumpSet(value)) continue;
    try {
      const proposal = { setName: name, ...proposeFromDump(value, setOpts) };
      const id = (proposal.contract as { id?: unknown }).id;
      if (typeof id === 'string') {
        const holder = claimedIds.get(id);
        if (holder !== undefined) {
          notes.push(
            `contract id "${id}" is claimed by two sets in this dump ("${holder}" and "${name}") — their names sanitize to the same id; rename one set (or edit one id) before adopting both`,
          );
        } else {
          claimedIds.set(id, name);
        }
      }
      proposals.push(proposal);
    } catch (e) {
      const plain = plainWordsProposalError(e);
      skipped.push({
        setName: name,
        reason: `Set "${name}" could not be proposed: ${plain.headline}`,
        ...(plain.detail ? { detail: plain.detail } : {}),
      });
    }
  }
  return { proposals, skipped, notes };
}
