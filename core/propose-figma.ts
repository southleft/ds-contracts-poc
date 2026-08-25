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
import { arcMaskCss, ContractSchema, GRID_REFUSALS, pascal, STATE_PREVIEW_PROPERTY, statePreviewLabel, VOID_ELEMENTS } from '../scripts/contract-schema.js';
import { kebab } from '../extract/types.js';
import { isDumpSet, type DumpEffect, type DumpNode, type DumpPaint, type DumpPreferredValue, type DumpPropertyDefinition, type DumpSet } from '../extract/figma/types.js';
import type { TokenCorpus } from './token-corpus.js';
import { capturedTokensFromDump, foldVariablePath, ONE_DOT_LEADER } from './captured-tokens.js';
import { mintTokens, type MintAxis, type MintObservation, type MintedEntry } from './mint-tokens.js';
import {
  validateExactVariantProjection,
  type ExactProjectionRefusalCode,
  type ExactProjectionResult,
  type ExactVariantRow,
} from './exact-projection.js';

// ---------------------------------------------------------------------------
// Shared spellings
// ---------------------------------------------------------------------------

/** Inverse of extract/types.ts titleCase: "Show Actions" → "showActions".
 *  Canonical spellings are IDENTIFIERS (enum values become CSS enum classes
 *  `.progress-40`, TSX union members, token-path map keys), so characters
 *  outside [A-Za-z0-9] are stripped after case-folding — the field case is
 *  Untitled UI's percentage axes ("Progress=40%"), whose '%' produced CSS
 *  selectors (`.progress-40% .Progress`) every browser silently drops.
 *  A value that sanitizes to NOTHING keeps its trimmed original (the emitters
 *  refuse it by name — never a silent empty spelling). */
export const camel = (s: string): string => {
  const spelled = s
    .trim()
    .split(/[\s_-]+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  const sanitized = spelled.replace(/[^A-Za-z0-9]/g, '');
  return sanitized.length > 0 ? sanitized : spelled;
};

/** Variable name → token path, through THE shared fold (captured-tokens.ts
 *  foldVariablePath): '/'→'.' plus U+2024 ONE DOT LEADER → '-' (dump v1.16).
 *  The captured-token layer registers under the SAME fold, so a folded ref
 *  resolves end to end; the rename is receipted once per variable per set
 *  (see noteFoldedVariableNames). */
const dotPath = (slashName: string) => foldVariablePath(slashName).path;
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

/** Emit appends ` (${contractId})` when a foreign same-name set already
 *  exists (core/emit-figma-script.ts displayName). Propose used to
 *  PascalCase the whole drawn name, reminting Alert → AlertFlowbiteAlert
 *  (FC-DUMP-PROPOSE-NAME-PARENTHETICAL). Strip only a suffix that matches
 *  the stamped id; an unstamped or mismatched parenthetical stays as drawn. */
export const drawnContractName = (
  setName: string,
  stampedContractId: string | null,
): { name: string; strippedSuffix: boolean } => {
  if (stampedContractId) {
    const suffix = ` (${stampedContractId})`;
    if (setName.endsWith(suffix) && setName.length > suffix.length) {
      return { name: pascalComponentName(setName.slice(0, -suffix.length)), strippedSuffix: true };
    }
  }
  return { name: pascalComponentName(setName), strippedSuffix: false };
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
  bindings?: { figma?: { anchors?: { componentSetKey?: string | null } } };
  /** Optional authored anatomy — hop-4 uses it to recover a stamped
   *  Disabled opacity token instead of minting a dump-slug
   *  (FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED), matching unbound
   *  padding literals instead of dump-slug mints
   *  (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED), and matching unbound
   *  DROP_SHADOW stacks instead of dump-slug mints
   *  (FC-DUMP-PROPOSE-SHADOW-MINTED). */
  anatomy?: {
    root?: MinimalAnatomyPart;
  };
}

/** Narrow a JSON-loaded or freshly proposed contract record to the
 *  MinimalChildContract slice the session registry keys on. Checks the two
 *  load-bearing fields (`id` string, `props` array) and refuses by name
 *  otherwise — a silent cast would let a malformed record reach the
 *  sibling-link path and surface as a mystery downstream. */
export function asMinimalChildContract(x: unknown): MinimalChildContract {
  const rec = x as { id?: unknown; props?: unknown } | null;
  if (!rec || typeof rec !== 'object') {
    throw new Error('asMinimalChildContract: expected a contract object');
  }
  if (typeof rec.id !== 'string') {
    throw new Error('asMinimalChildContract: contract is missing a string `id`');
  }
  if (!Array.isArray(rec.props)) {
    throw new Error(`asMinimalChildContract: contract ${rec.id} is missing a \`props\` array`);
  }
  return rec as MinimalChildContract;
}

/** Nested authored part slice used by stamped recoveries. */
export interface MinimalAnatomyPart {
  states?: Record<string, Record<string, string>>;
  tokens?: Record<string, string>;
  literals?: Record<string, string>;
  parts?: Record<string, MinimalAnatomyPart>;
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

/** PHASE 2 EXAM (axis-default-from-set): the set's DECLARED default for a
 *  VARIANT property (propertyDefinitions[...].defaultValue, dump v1.5) is the
 *  designer's default — the first variant in tree order is only the
 *  generator's convention (it emits the all-defaults combo first). Every
 *  reader of `axis.values[0]` (the prop default, the tokensByProp base
 *  plane, the mode-axis base, layoutByProp's default tuple) takes the
 *  declared default by MOVING it to the front; the remaining options keep
 *  tree order. A declared default that names no drawn variant is NAMED and
 *  the tree order stands. Sets without definitions (pre-v1.5 dumps, hand
 *  fixtures) are byte-identical. */
function applyDeclaredAxisDefaults(axes: Axis[], set: DumpSet, notes?: string[]): Axis[] {
  for (const axis of axes) {
    const def = set.propertyDefinitions?.[axis.property];
    if (!def || def.type !== 'VARIANT' || typeof def.defaultValue !== 'string') continue;
    const i = axis.values.indexOf(def.defaultValue);
    if (i === 0) continue;
    if (i < 0) {
      notes?.push(
        `prop \`${axis.propName}\`: the set's declared default for "${axis.property}" is "${def.defaultValue}" (propertyDefinitions, dump v1.5) but no variant draws that value (drawn: ${axis.values.join('|')}) — the declared default is NOT applied; the first drawn variant ("${axis.values[0]}") stands as the default, review`,
      );
      continue;
    }
    const first = axis.values[0];
    axis.values = [def.defaultValue, ...axis.values.filter((_, j) => j !== i)];
    notes?.push(
      `prop \`${axis.propName}\`: the set's DECLARED default for "${axis.property}" is "${def.defaultValue}" (propertyDefinitions.defaultValue, dump v1.5), not the first variant in tree order ("${first}") — the proposal's default follows the declared default, and the base plane every per-value carrier deviates from (tokens / tokensByProp / layoutByProp / textByProp) is the ${def.defaultValue} plane (Phase 2 exam: Badge Size, Chip Dismissible, Heading Tag/Variant defaulted to the first-drawn value with no receipt)`,
    );
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
// extractor already produces. Round trip: bindings.figma.statePreviews is set when the
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

/** Tally of HOW a corroborated mode axis's deltas would be carried — filled
 *  in by modeStructuralDiff while it walks counterpart pairs. `carriers`
 *  counts variable-bound channels (same variable name across the axis — the
 *  variable's per-mode values are the carrier); `rawDeltas` counts raw
 *  color-kind literals that DIFFER across the axis (nothing carries them —
 *  their per-mode values ride no variable). */
export interface ModeCarriage {
  carriers: number;
  rawDeltas: number;
}

/** First structural/binding difference between two variants that a token
 *  mode CANNOT explain — or null when the pair corroborates. Raw literals
 *  may differ ONLY on color-kind channels (fill/stroke/effect color); bound
 *  fields must bind the SAME variable names; everything else must be equal.
 *  When `carriage` is given, tallies bound carriers vs differing raw
 *  color literals (see ModeCarriage) so the caller can refuse a promotion
 *  whose deltas have no variable modes to ride. */
function modeStructuralDiff(a: DumpNode, b: DumpNode, path: string, carriage?: ModeCarriage): string | null {
  if (a.type !== b.type) return `${path}: node type ${a.type} vs ${b.type}`;
  const aBound = a.bound ?? {};
  const bBound = b.bound ?? {};
  for (const k of new Set([...Object.keys(aBound), ...Object.keys(bBound)])) {
    if (aBound[k] !== bBound[k]) {
      return `${path}: field "${k}" binds "${aBound[k] ?? '(unbound)'}" vs "${bBound[k] ?? '(unbound)'}"`;
    }
    if (carriage && aBound[k] !== undefined) carriage.carriers++;
  }
  const paintShape = (p?: DumpPaint): string => (p === undefined ? 'none' : p.var !== undefined ? `var:${p.var}` : 'raw');
  if (paintShape(a.fill) !== paintShape(b.fill)) return `${path}: fill ${paintShape(a.fill)} vs ${paintShape(b.fill)}`;
  if (paintShape(a.stroke) !== paintShape(b.stroke)) return `${path}: stroke ${paintShape(a.stroke)} vs ${paintShape(b.stroke)}`;
  if (carriage) {
    for (const [pa, pb] of [[a.fill, b.fill], [a.stroke, b.stroke]] as Array<[DumpPaint | undefined, DumpPaint | undefined]>) {
      if (pa === undefined || pb === undefined) continue; // both undefined (shape 'none' matched)
      if (pa.var !== undefined) carriage.carriers++;
      else if (pa.hex !== pb.hex || (pa.alpha ?? 1) !== (pb.alpha ?? 1)) carriage.rawDeltas++;
    }
  }
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
    if (carriage && at.fillVar !== undefined) carriage.carriers++;
  }
  const effectShape = (e?: DumpEffect[]): string =>
    JSON.stringify((e ?? []).map((x) => ({ t: x.type, o: x.offset ?? null, r: x.radius ?? null, s: x.spread ?? null })));
  if (effectShape(a.effects) !== effectShape(b.effects)) return `${path}: effects differ`;
  if (carriage) {
    const effectColors = (e?: DumpEffect[]): string => JSON.stringify((e ?? []).map((x) => x.color ?? null));
    if (effectColors(a.effects) !== effectColors(b.effects)) carriage.rawDeltas++;
  }
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
    const d = modeStructuralDiff(ak[i], bk[i], `${path}/${ak[i].name}`, carriage);
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
    const carriage: ModeCarriage = { carriers: 0, rawDeltas: 0 };
    for (const v of variants) {
      const value = axisValuesOf(v.name)[axis.property];
      if (value === defaultValue) continue;
      const counterpart = base.get(residual(v));
      if (!counterpart) {
        failure = `variant "${v.name}" has no ${axis.property}=${defaultValue} counterpart`;
        break;
      }
      // Root names differ by exactly the axis pair — neutralize before the diff.
      failure = modeStructuralDiff(counterpart, { ...v, name: counterpart.name }, residual(v), carriage);
      if (failure) break;
    }
    if (failure) {
      notes.push(
        `variant axis "${axis.property}" (${axis.values.join('|')}): named like a token mode but the variants differ beyond color across its values (${failure}) — NOT promoted; kept as an enum prop (if this is theming, unify the drawn structure), review`,
      );
      continue;
    }
    // §3 carriage gate: promotion is only honest when the axis's deltas can
    // actually RIDE variable modes. A kit with no bound variables anywhere
    // along the diff (carriers === 0) whose counterparts differ in raw
    // color literals (rawDeltas > 0) has nothing for the mode to switch —
    // promoting would drop the axis's styling entirely. The axis stays a
    // REAL enum prop and the standard mint machinery carries the per-axis-
    // value styles.
    if (carriage.rawDeltas > 0 && carriage.carriers === 0) {
      notes.push(
        `variant axis "${axis.property}" (${axis.values.join('|')}): named like a token mode and structurally corroborated, but its ${carriage.rawDeltas} differing color literal(s) are RAW — the set binds NO variables along the axis, so there are no variable modes for the deltas to ride and promotion would drop the axis's styling entirely — NOT promoted; kept as an enum prop with per-axis-value style carriage (bind the colors to mode-switched variables to make this a token mode), review`,
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

/** Wrapper-union identity fold (audit class duplicate-parts-from-wrapper-
 *  union): some variants nest children under a pass-through wrapper FRAME/
 *  GROUP while others draw the same nodes flat at the parent level (field
 *  cases: Tooltip's `Text and supporting text` vs flat `Text`; ProgressCircle
 *  `Group 3 → Label, Number` vs flat; DropdownListItem `Content` wrapping
 *  icon+text only in shortcut variants). A bare-name union mints the SAME
 *  canvas node twice (doubled text, stub soup) and every duplicate lands in a
 *  variant subset no axis predicts. Rule: when a container child W exists in
 *  a strict subset of variants and a flat sibling elsewhere matches one of
 *  W's members by name+type, synthesize W around the matched flats in those
 *  variants so the union folds them into ONE part. The synthetic wrapper
 *  clones the first REAL W occurrence's own channels (a pass-through
 *  wrapper's styling is invariant structure, not a new observation — the
 *  fold is ledgered per variant); its children are the variant's REAL flat
 *  nodes, so every leaf channel stays observed. No-op when every variant
 *  nests identically. Deterministic: candidates and folds walk in occurrence
 *  order. */
function foldWrapperUnion(
  occ: Occ[],
  childrenOf: Map<Occ, DumpNode[]>,
  notes: string[],
  where: string,
): void {
  const keyOf = (n: DumpNode): string => `${n.name} ${n.type}`;
  interface Candidate {
    type: string;
    firstNode: DumpNode;
    childKeys: Set<string>;
    present: Set<Occ>;
  }
  const candidates = new Map<string, Candidate>();
  for (const o of occ) {
    for (const c of childrenOf.get(o)!) {
      if ((c.type !== 'FRAME' && c.type !== 'GROUP') || (c.children ?? []).length === 0) continue;
      let e = candidates.get(c.name);
      if (!e) candidates.set(c.name, (e = { type: c.type, firstNode: c, childKeys: new Set(), present: new Set() }));
      e.present.add(o);
      for (const cc of c.children ?? []) e.childKeys.add(keyOf(cc));
    }
  }
  // Ambiguity taint, GLOBAL per level: a member key that some variant draws
  // flat at the parent level WHILE the owning wrapper is also present there
  // is not a clean identity split (flat and nested coexist — or the node
  // hops between wrappers per variant); such a key must not fold into ANY
  // candidate, or one candidate's pruning leaves the node for another to
  // grab and a phantom wrapper materializes around it (field case:
  // InputFieldBase Help icon/alert-circle sit beside `Content` in variants
  // where other variants nest them under `Text input` — grabbing them
  // synthesized an empty `Text input` in variants that never drew one).
  const tainted = new Set<string>();
  for (const [wName, w] of candidates) {
    for (const o of w.present) {
      for (const c of childrenOf.get(o)!) {
        if (c.name !== wName && w.childKeys.has(keyOf(c))) tainted.add(keyOf(c));
      }
    }
  }
  for (const [wName, w] of candidates) {
    if (w.present.size === occ.length || w.present.size === 0) continue;
    const foldableKeys = new Set([...w.childKeys].filter((k) => !tainted.has(k)));
    if (foldableKeys.size === 0) continue;
    for (const o of occ) {
      if (w.present.has(o)) continue;
      const kids = childrenOf.get(o)!;
      // A same-named non-container child here is a different node, not a
      // fold site — UNLESS it is itself a KNOWN MEMBER of the wrapper
      // (round 2 iteration 2 field case: Progress bar's floating variants
      // draw `Progress` FRAME wrapping [`Progress` RECT, Tooltip] while the
      // rest draw the `Progress` RECT flat; the rect IS the wrapper's own
      // member, and refusing the fold left a RECT/FRAME identity mix that
      // poisoned every channel of the part).
      if (kids.some((c) => c.name === wName && !w.childKeys.has(keyOf(c)))) continue;
      const matched = kids.filter((c) => foldableKeys.has(keyOf(c)));
      if (matched.length === 0) continue;
      const at = kids.indexOf(matched[0]);
      const synthetic = {
        ...w.firstNode,
        children: matched,
        __synthetic: true,
      } as DumpNode;
      const rest = kids.filter((c) => !matched.includes(c));
      rest.splice(Math.min(at, rest.length), 0, synthetic);
      childrenOf.set(o, rest);
      notes.push(
        `${where}: variant "${o.variant}" draws ${matched.map((c) => `"${c.name}"`).join(', ')} flat where other variants nest under wrapper "${wName}" — folded into the wrapper so the union keeps ONE part per canvas node (wrapper-union identity)`,
      );
    }
  }
}

function mergeOcc(name: string, occ: Occ[], notes: string[], where: string): Merged {
  const types = [...new Set(occ.map((o) => o.node.type))];
  if (types.length > 1) {
    notes.push(`${where}: node type differs across variants (${types.join(', ')}) — using ${types[0]}`);
  }
  const childrenOf = new Map<Occ, DumpNode[]>();
  for (const o of occ) childrenOf.set(o, o.node.children ?? []);
  if (occ.length > 1) foldWrapperUnion(occ, childrenOf, notes, where);
  const sequences = occ.map((o) => siblingKeys(childrenOf.get(o)!));
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
      const child = childrenOf.get(o)!.filter((c) => c.name === childName)[ord];
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
  | { kind: 'drift'; detail: string; boolFn?: BoolAxisFn };

/** FC-DUMP-PROPOSE-BOOL-AXIS-CORRELATION: refs that are a pure function of
 *  ONE boolean variant axis (both planes bound, one ref per plane). The
 *  vocabulary cannot bind it as a per-value map — tokensByProp is ENUM-keyed
 *  (emit-react refuses a boolean prop there) and stylesWhen is literal-only
 *  — so unifyRefs reports it as a NAMED drift that carries the axis; a
 *  channel with a literal boolean vocabulary (opacity → stylesWhen) resolves
 *  the refs and carries the value, naming the identity loss. */
interface BoolAxisFn {
  axis: Axis;
  byValue: { true: string; false: string };
}

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
  // BOOLEAN axes (FC-DUMP-PROPOSE-BOOL-AXIS-CORRELATION): a true/false axis
  // is a two-value enum for the purpose of correlation. Eventz field case:
  // Button roots bind opacity to theme/opacity/default on isDisabled=false
  // and theme/opacity/disabled on isDisabled=true, and the receipt read
  // "without correlating to any variant axis" — a FALSE note. The function
  // is detected here and NAMED with its axis; see BoolAxisFn for why the
  // per-value binding itself is not proposed.
  for (const axis of axes) {
    if (!isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, string>();
    let fits = true;
    for (const o of defined) {
      const value = axisValuesOf(o.variant)[axis.property]?.trim().toLowerCase();
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
    if (!fits || !byValue.has('true') || !byValue.has('false')) continue;
    const whenFalse = byValue.get('false')!;
    const whenTrue = byValue.get('true')!;
    return {
      kind: 'drift',
      detail: `bindings differ across variants as a pure function of the BOOLEAN axis "${axis.property}" (false→${whenFalse}, true→${whenTrue}) — tokensByProp is enum-keyed and stylesWhen is literal-only, so the per-value binding is NAMED, not proposed; promote the axis to an enum (or bind one variable) to carry it`,
      boolFn: { axis, byValue: { true: whenTrue, false: whenFalse } },
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

/** Unify dump-stamped slash names (fontSizeVar / fontWeightVar / lineHeightVar)
 *  the same way bound layout paints unify. One name → that ref; many names
 *  that spell one enum axis → a substituted ref. Anything else stays
 *  undefined so the numeric mint path can still run. */
function unifyStampedTextVar(
  occs: Array<{ variant: string; node: DumpNode }>,
  pick: (text: NonNullable<DumpNode['text']>) => string | undefined,
  axes: Axis[],
): string | undefined {
  const u = unifyRefs(
    occs.map((o) => {
      const raw = o.node.text ? pick(o.node.text) : undefined;
      return { variant: o.variant, path: raw ? dotPath(raw) : undefined };
    }),
    axes,
  );
  return u.kind === 'ref' ? u.ref : undefined;
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
  /** Evidence for the variant projection used by this proposal. Exact mode
   *  returns only `verified-exact`. Explicit reviewable inversion returns
   *  `legacy-unverified`, or `verified-exact` when the proposed VARIANT rows
   *  still prove the structured source matrix (never `source-matrix-verified`
   *  — that status is internal evidence and is rejected by parseProposal). */
  projection: ExactProjectionResult;
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
  /** The base contract id this proposal was suffixed PAST (a session-claimed
   *  holder with contradicting key evidence). Absent when the id is the
   *  plain stamped/name-derived one. proposeBatchFromDump names the
   *  collision at batch level when the holder is a sibling set. */
  idSuffixedFrom?: string;
}

export type ExactProposalRefusalCode =
  | ExactProjectionRefusalCode
  | 'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS';

/** Stable refusal code when named text-style identity cannot be preserved. */
export const TEXT_STYLE_IDENTITY_REFUSED = 'text-style-identity-refused' as const;
export type TextStyleIdentityRefusalCode = typeof TEXT_STYLE_IDENTITY_REFUSED;

/** Stable, browser-safe refusal raised when proposal cannot preserve the
 * authoritative structured Figma variant matrix exactly. */
export class ExactProjectionError extends Error {
  readonly code: ExactProposalRefusalCode;
  readonly projection: ExactProjectionResult;

  constructor(
    code: ExactProposalRefusalCode,
    message: string,
    projection: ExactProjectionResult,
  ) {
    super(message);
    this.name = 'ExactProjectionError';
    this.code = code;
    this.projection = projection;
  }
}

/** Exact mode fails closed when a named Figma text style cannot survive
 *  proposal with its semantic identity. Reviewable inversion notes instead. */
export class TextStyleIdentityError extends Error {
  readonly code: TextStyleIdentityRefusalCode = TEXT_STYLE_IDENTITY_REFUSED;

  constructor(message: string) {
    super(
      message.startsWith(`${TEXT_STYLE_IDENTITY_REFUSED}:`)
        ? message
        : `${TEXT_STYLE_IDENTITY_REFUSED}: ${message}`,
    );
    this.name = 'TextStyleIdentityError';
  }
}

type ExactVerifiedStatus = 'source-matrix-verified' | 'verified-exact';

/** Require a particular exact-projection proof, converting validator results
 *  into the stable proposal error surface. */
export function assertExactProjection<T extends ExactVerifiedStatus>(
  projection: ExactProjectionResult,
  expectedStatus: T,
): Extract<ExactProjectionResult, { status: T }> {
  if (projection.status === expectedStatus) {
    return projection as Extract<ExactProjectionResult, { status: T }>;
  }
  if (projection.status === 'refused') {
    const first = projection.refusals[0];
    throw new ExactProjectionError(
      projection.code,
      first?.message ?? `Exact variant projection refused (${projection.code}).`,
      projection,
    );
  }
  throw new ExactProjectionError(
    'EXACT_DEFINITIONS_MISSING',
    projection.status === 'legacy-unverified'
      ? 'Exact proposal requires structured propertyDefinitions and variantProperties evidence.'
      : `Exact proposal requires projection status ${expectedStatus}; received ${projection.status}.`,
    projection,
  );
}

/** The schema's contract-id grammar. A dump stamp that fails this is ignored
 *  — same as a malformed semantics stamp — so a bad id can only fall back to
 *  the name-derived slug, never assert a bogus identity. */
const CONTRACT_ID_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** dump v1.26 — the contract id this pipeline stamped. Shape-checked here;
 *  anything malformed reads as absent. */
function readStampedContractId(set: { contractId?: unknown }): string | null {
  const raw = (set as { contractId?: unknown }).contractId;
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return CONTRACT_ID_RE.test(id) ? id : null;
}

/** dump v1.28 — the emit specHash this pipeline stamped. Digits only; a
 *  malformed stamp reads as absent so a bad marker cannot invent a hash. */
function readStampedSpecHash(set: { specHash?: unknown }): string | null {
  const raw = (set as { specHash?: unknown }).specHash;
  if (typeof raw !== 'string') return null;
  const hash = raw.trim();
  return /^\d+$/.test(hash) ? hash : null;
}

/** dump v1.29 — the authored contract version this pipeline stamped.
 *  Semver-shaped only; a malformed stamp reads as absent so propose keeps
 *  inventing `0.1.0` rather than asserting junk. */
const CONTRACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
function readStampedVersion(set: { version?: unknown }): string | null {
  const raw = (set as { version?: unknown }).version;
  if (typeof raw !== 'string') return null;
  const version = raw.trim();
  return CONTRACT_VERSION_RE.test(version) ? version : null;
}

/** Read the set's declared sparse State-preview shape. Shape-checked here and
 *  re-validated against the real axes by core/exact-projection.ts; anything
 *  malformed reads as absent, so a bad marker can only make the pipeline
 *  STRICTER (back to demanding a full cartesian), never looser. */
function readDeclaredStatePreviewAxis(set: { statePreviewAxis?: unknown }): {
  axis: string;
  default: string;
  states: readonly string[];
  primary: string | null;
  pinned: Readonly<Record<string, string>>;
} | null {
  const v = (set as { statePreviewAxis?: unknown }).statePreviewAxis;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const pinned = r.pinned ?? {};
  if (typeof r.axis !== 'string' || !r.axis) return null;
  if (typeof r.default !== 'string' || !r.default) return null;
  if (!Array.isArray(r.states) || r.states.length === 0) return null;
  if (!r.states.every((s) => typeof s === 'string' && s)) return null;
  if (r.primary !== null && r.primary !== undefined && typeof r.primary !== 'string') return null;
  if (pinned === null || typeof pinned !== 'object' || Array.isArray(pinned)) return null;
  if (!Object.values(pinned as Record<string, unknown>).every((x) => typeof x === 'string')) return null;
  return {
    axis: r.axis,
    default: r.default,
    states: r.states as string[],
    primary: (r.primary as string | undefined) ?? null,
    pinned: pinned as Record<string, string>,
  };
}

const semanticProjectionRefusal = (
  projection: ExactProjectionResult,
  axis: Axis,
  semanticKind: 'interaction-state' | 'token-mode',
): never => {
  throw new ExactProjectionError(
    'EXACT_SEMANTIC_PROJECTION_AMBIGUOUS',
    `Exact proposal cannot promote variant axis ${JSON.stringify(axis.property)} to ${semanticKind} semantics because that changes the authoritative Figma variant projection.`,
    projection,
  );
};

/** Reconstruct the rows the proposed contract would emit using only its
 *  Figma VARIANT bindings. This deliberately does not inspect variant names. */
function exactRowsFromProposedContract(
  contract: Record<string, unknown>,
  descriptor?: {
    axis: string;
    default: string;
    states: readonly string[];
    primary: string | null;
    pinned: Readonly<Record<string, string>>;
  } | null,
): ExactVariantRow[] {
  const props = Array.isArray(contract.props) ? contract.props : [];
  const axes: Array<{ property: string; values: string[] }> = [];
  for (const raw of props) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const bindings = (raw as { bindings?: unknown }).bindings;
    if (bindings === null || typeof bindings !== 'object' || Array.isArray(bindings)) continue;
    const figma = (bindings as { figma?: unknown }).figma;
    if (figma === null || typeof figma !== 'object' || Array.isArray(figma)) continue;
    const binding = figma as { kind?: unknown; property?: unknown; values?: unknown };
    if (binding.kind !== 'VARIANT' || typeof binding.property !== 'string') continue;
    if (binding.values === null || typeof binding.values !== 'object' || Array.isArray(binding.values)) continue;
    const values = Object.values(binding.values).filter((value): value is string => typeof value === 'string');
    axes.push({ property: binding.property, values });
  }

  let tuples: Record<string, string>[] = [{}];
  for (const axis of axes) {
    tuples = tuples.flatMap((tuple) =>
      axis.values.map((value) => ({ ...tuple, [axis.property]: value })),
    );
  }

  // A promoted contract re-emits the STATE PREVIEW axis, so the rows it would
  // draw are NOT this bare cartesian — they are the sparse matrix
  // withStateAxis builds: this grid at State=Default, plus one row per state
  // per PRIMARY value with every other axis pinned. Modelling the cartesian
  // alone made a faithful promotion look like a 12-row answer to a 24-row
  // set, which is the second half of the emitter/inverter disagreement.
  //
  // The shape comes from the SET's own declaration. Reconstruct whenever the
  // proposed API VARIANT axes can host that matrix, and model the rows the
  // emitter WILL draw: bindings.figma.statePreviews on, one preview row per PROMOTED
  // state (contract.states through statePreviewLabel) per PRIMARY value, with
  // every other axis pinned. Modelling the DECLARED states instead made a
  // proposal that recovered none of the Hover / Active / Focus Visible cells
  // read verified-exact 45/45 while its re-emit drew 40 (or 25) rows
  // (FC-PROPOSE-SPARSE-STATE). A declared state the proposal did not recover
  // is an EXACT_ROWS_MISSING tuple naming those cells; inventing the preview
  // axis as a VARIANT prop, dropping a real API axis, or not opting back into
  // previews falls through to the bare cartesian and is refused.
  const sparse = descriptor;
  const contractStates = Array.isArray(contract.states)
    ? (contract.states as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const contractBindings = contract.bindings as { figma?: { statePreviews?: boolean } } | undefined;
  if (sparse && contractBindings?.figma?.statePreviews === true && contractStates.length > 0) {
    const inventedPreviewAxis = axes.some((a) => a.property === sparse.axis);
    const apiAxes = axes.filter((a) => a.property !== sparse.axis);
    const primaryAxis = apiAxes.find((a) => a.property === sparse.primary);
    const pinnedOk = Object.entries(sparse.pinned).every(([property, value]) => {
      const axis = apiAxes.find((a) => a.property === property);
      return axis ? axis.values.includes(value) : false;
    });
    if (!inventedPreviewAxis && pinnedOk && (sparse.primary === null || primaryAxis)) {
      const drawnStates = [...new Set(contractStates.map((s) => statePreviewLabel(s)))];
      let apiTuples: Record<string, string>[] = [{}];
      for (const axis of apiAxes) {
        apiTuples = apiTuples.flatMap((tuple) =>
          axis.values.map((value) => ({ ...tuple, [axis.property]: value })),
        );
      }
      const rows: Record<string, string>[] = apiTuples.map((t) => ({
        ...t,
        [sparse.axis]: sparse.default,
      }));
      const primaryValues = primaryAxis ? primaryAxis.values : [null];
      for (const state of drawnStates) {
        for (const value of primaryValues) {
          const row: Record<string, string> = { [sparse.axis]: state };
          for (const axis of apiAxes) {
            row[axis.property] =
              primaryAxis && axis.property === primaryAxis.property
                ? (value as string)
                : sparse.pinned[axis.property]!;
          }
          rows.push(row);
        }
      }
      return rows.map((variantProperties) => ({ variantProperties }));
    }
  }
  return tuples.map((variantProperties) => ({ variantProperties }));
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
  /** Overlay-flattened class (round 2 iteration 2): base-combo literal
   *  fallbacks for abs-placement channels whose per-variant values REFUSE
   *  classification — the round-4 padding precedent (the base plane is
   *  exact) applied to placement: when the mint pass leaves the channel
   *  unbound, the part carries the FIRST occurrence's px value as a literal
   *  and the fallback is NAMED. Round 2 iteration 6: plain-rect/fixedSize
   *  width/height and nested-part padding channels ride the same carrier.
   *  Empty when nothing refused. */
  absFallbacks: Array<{ part: Record<string, unknown>; tokens: Record<string, string>; chan: string; value: number; where: string }>;
  /** ROUND 2 ITERATION 9 — per-instance override targets: component-ref
   *  records whose observed per-occurrence facts PROVABLY diverge from the
   *  linked child's own minted values. Filled like every other mint target
   *  after classification; a target that stays empty (every channel
   *  refused, each refusal named) attaches nothing. */
  refOverrides: Array<{ component: Record<string, unknown>; target: Record<string, string> }>;
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
  /** Bound fields whose refs are a pure function of one BOOLEAN axis, keyed
   *  `${where}|${field}` (FC-DUMP-PROPOSE-BOOL-AXIS-CORRELATION) — written by
   *  unifyField, read by the channels that own a boolean literal vocabulary. */
  boolFnRefs?: Map<string, BoolAxisFn>;
  /** Set-level SLOT property descriptions (dump v1.18) — the words carrying
   *  what Figma refuses to enforce (min/max/required/restrict). */
  slotDescriptions?: Record<string, string>;
  /** The set's structured property definitions (dump v1.5), keyed by the
   *  producer's own spelling ("Icon#7:2", "Variant"). Read by the slot
   *  `accepts` door: a definition present with NO preferredValues is an
   *  EMPTY list — an unconstrained swap by declaration — and must not be
   *  reported as "not captured" (Phase 2 exam, rest-swap-preferred-values-
   *  empty); a SLOT definition's own preferredValues are read here when the
   *  producer did not fold them into swapPreferredValues (REST map.ts). */
  propertyDefinitions?: Record<string, DumpPropertyDefinition>;
  /** The interaction-state axis this proposal PROMOTED (its Figma property
   *  name), when one was — read by the prototype-reaction receipt so a
   *  CHANGE_TO into a hover variant is described as the state-preview
   *  wiring it is (dump v1.31). */
  stateAxisPromoted?: string;
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
  /** instanceKey → exported stub-glyph asset (iteration 8) — see the
   *  proposeFromDump option of the same name. */
  iconAssets?: ReadonlyMap<string, StubIconAsset>;
  /** ROUND 2 ITERATION 9 — the accumulated minted-value ledger (leaf
   *  dot-path → resolved literal) from EARLIER proposals in this session —
   *  see the proposeFromDump option of the same name. Presence opts the
   *  per-instance override machinery in. */
  instanceOverrides?: ReadonlyMap<string, string>;
  /** ROUND 3 — INSTANCE TEXT OVERRIDES (child side). Merged-tree node path
   *  (relative to `${setName}:root/`) → the text prop name to promote it to.
   *  Built by resolveTextOverrideDemand from the cross-set demand: a HOST
   *  observed itself setting characters on this set's node, which proves the
   *  characters are per-usage API even though the canvas models them with no
   *  TEXT component property. Empty/absent — byte-identical classic
   *  behavior (the node keeps its literal `text`). */
  textPromote?: ReadonlyMap<string, string>;
  /** ROUND 3 — every `${path} ${characters}` a built part actually reached
   *  (carried OR refused by name). The completeness check at the end of
   *  proposeFromDump names whatever the dump holds and this set does not. */
  textOverridesVisited?: Set<string>;
  prefix: string;
  /** The contract id THIS proposal claims — the name-derived slug, suffixed
   *  past session-claimed holders whose componentSetKey CONTRADICTS this
   *  set's key (live-gauntlet class ③, session-id-collision-false-cycle:
   *  "RadioButton" the COMPONENT and "Radio button" the set both sanitize
   *  to ds.radio-button; without the suffix the session's newest-wins
   *  registry rebinds the earlier import's child ref onto this proposal and
   *  the referee reports a cycle that is not drawn). Same-key holders keep
   *  the base id — that is the legitimate re-import/heal path. */
  selfId: string;
  notes: string[];
  unbound: UnboundValue[];
  textProps: Array<{ name: string; property: string; default: string; figmaless?: boolean }>;
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
  /** TRUE when the set carries this pipeline's own stamps (dump v1.21+) — i.e.
   *  we drew it. Drawn layer names are then OUR part names and are preserved
   *  verbatim; on a foreign set the drawn names are arbitrary and must be
   *  sanitised into identifiers. See partKey. */
  drawnByThisPipeline?: boolean;
  /** Figma property name → the CONTRACT's prop name, from the set's own stamp
   *  (dump v1.25). Read in preference to canonicalising the design spelling —
   *  see registerTextProp. Empty for a set this pipeline did not draw, which
   *  is exactly when canonicalising is the right answer. */
  propNames?: Record<string, string>;
  mint?: MintCapture;
  /** Exact fails closed on text-style identity gaps; reviewable notes. */
  projectionMode: 'exact' | 'reviewable-inversion';
}

/** Exact mode throws; reviewable-inversion records the stable refusal name. */
function refuseTextStyleIdentity(ctx: Ctx, detail: string): void {
  const message = detail.startsWith(`${TEXT_STYLE_IDENTITY_REFUSED}:`)
    ? detail
    : `${TEXT_STYLE_IDENTITY_REFUSED}: ${detail}`;
  if (ctx.projectionMode === 'exact') {
    throw new TextStyleIdentityError(message);
  }
  ctx.notes.push(message);
}

/** ITERATION 8 — one exported stub-glyph asset (see proposeFromDump's
 *  `iconAssets` option). `circleFill` marks an export whose entire drawn ink
 *  is ONE filled circle — a geometry WITNESS consumed by the solid-fill stub
 *  path (border-radius derives from the observed box) instead of displacing
 *  the OBSERVED per-usage ink with the export's baked color (field case:
 *  _Dot — the kit's main bakes #22C55E, but Badge draws it #9e77ed and the
 *  references agree with the observation, not the main). */
export interface StubIconAsset {
  asset: string;
  naturalWidth: number;
  naturalHeight: number;
  circleFill?: boolean;
}

/** Captured evidence for one auto-proposed child contract stub. */
interface StubCapture {
  id: string;
  instanceOf: string;
  /** The observed owning-set publish key (dump v1.5) — carried onto the
   *  stub's bindings.figma.anchors.componentSetKey so importing the real set later
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
    /** The occurrence's main-component publish key (dump v1.5) — the icon-
     *  asset manifest (iteration 8) is keyed by it, so a stub whose source
     *  glyph was SVG-exported can carry the real vector ink. */
    instanceKey?: string;
    bbox?: { width: number; height: number };
    fill?: DumpPaint;
    /** dump v1.7: first visible SOLID inside the instance's subtree — the
     *  stub-paint channel. The instance's OWN `fill` (when present) wins.
     *  Stroke-aware: `{ stroke: true, weight }` marks a stroke-observed
     *  paint (line icons) — rendered as a border, never a background;
     *  `ellipse: true` marks a CIRCULAR stroke source (radius derivable);
     *  `src`/`align` carry the centered source's own box + strokeAlign so
     *  the ring renders at the DRAWN radius. */
    instancePrimaryFill?: DumpPaint & { stroke?: boolean; weight?: number; ellipse?: boolean; src?: number; align?: string };
    stroke?: DumpPaint;
    strokeWeight?: number;
    cornerRadius?: number;
    /** dump v1.7: the node's first visible fill is an IMAGE paint — the stub
     *  renders the neutral placeholder gradient (bytes stay unexported).
     *  dump v1.9: the string form carries the image HASH — the exported
     *  asset's name; the stub renders the asset itself. */
    imageFill?: boolean | string;
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

/** dump v1.7 `imageFill` placeholder — the ONE deterministic spelling every
 *  surface that carries an unexported IMAGE fill renders (a neutral
 *  LIGHT-gray linear gradient; linear so the canvas emitter can parse it
 *  back into a native GRADIENT_LINEAR paint — radial/conic fall to
 *  gradientMiss). Light stops (gray-100 → gray-300) deliberately: photo
 *  subjects vary but their studio backgrounds skew light, and a dark
 *  placeholder reads as a hole. The image bytes themselves are NOT
 *  exported; the placeholder only keeps the surface from rendering blank. */
export const IMAGE_FILL_PLACEHOLDER_GRADIENT = 'linear-gradient(135deg, #f2f4f7 0%, #d0d5dd 100%)';

/** dump v1.9: `imageFill` may carry the image HASH — the name of the asset
 *  the bridge exported alongside the dump (raw figma.getImageByHash bytes,
 *  deduped by hash, saved as <hash>.png). A hash renders
 *  url('./assets/images/<hash>.png') — an asset-NAME reference the consuming
 *  pipeline resolves (the untitled-ui harness inlines the bytes as a data
 *  URI when materializing tokens.css; a bundler surface copies the file next
 *  to the emitted CSS). Boolean true (v1.7/v1.8 dumps, or a hashless paint)
 *  keeps the placeholder gradient — the documented fallback whenever the
 *  asset is absent. The hash is sanitized to the exporter's filename
 *  alphabet, never trusted raw. */
export const imageFillCss = (v: boolean | string | undefined): string =>
  typeof v === 'string' && v !== ''
    ? `url('./assets/images/${v.replace(/[^a-zA-Z0-9._-]+/g, '-')}.png')`
    : v === true
      ? IMAGE_FILL_PLACEHOLDER_GRADIENT
      : 'none';

/** A raster asset needs explicit sizing where a gradient stretched
 *  implicitly. `cover` is OBSERVED, not assumed: dump v1.9 captures the
 *  hash form ONLY for scaleMode FILL paints (Figma's FILL = CSS cover);
 *  FIT/CROP/TILE keep the boolean marker and the placeholder gradient.
 *  Declared facts (DECLARED_CHANNELS: background-size/position/repeat),
 *  merged non-destructively — an existing declaration wins. */
const declareImageFillCover = (holder: Record<string, unknown>): void => {
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['background-size'] === undefined) declared['background-size'] = 'cover';
  if (declared['background-position'] === undefined) declared['background-position'] = '50% 50%';
  if (declared['background-repeat'] === undefined) declared['background-repeat'] = 'no-repeat';
  holder.declared = declared;
};

function mintObservation(
  ctx: Ctx,
  target: Record<string, string>,
  where: string,
  cssProperty: string,
  kind: 'color' | 'px' | 'number' | 'shadow' | 'gradient' | 'size',
  occ: Array<{
    variant: string;
    value: string | number;
    /** Per-variant style identity when names differ across the axis. */
    styleName?: string;
    styleKey?: string;
  }>,
  source?: string,
  /** Presence-shaped channels only (mint-tokens MintObservation.sparse):
   *  the vacuous value unobserved axis combinations fill with. */
  sparse?: string,
  /** v17 — a non-token-derived Figma TEXT STYLE this node rides; mints under
   *  a component-independent `imported.text.<style>` group (see
   *  MintObservation.styleName). */
  styleName?: string,
  styleKey?: string,
) {
  if (!ctx.mint) return;
  ctx.mint.observations.push({
    nodePath: where,
    part: partPathOf(where),
    ...(styleName !== undefined ? { styleName } : {}),
    ...(styleKey !== undefined ? { styleKey } : {}),
    cssProperty,
    kind,
    occurrences: occ.map((o) => ({
      variant: o.variant,
      axisValues: ctx.mint!.axisValuesByVariant.get(o.variant) ?? {},
      value: o.value,
      ...(o.styleName !== undefined ? { styleName: o.styleName } : {}),
      ...(o.styleKey !== undefined ? { styleKey: o.styleKey } : {}),
    })),
    target,
    source,
    ...(sparse !== undefined ? { sparse } : {}),
  });
}

const numOccurrences = (m: Merged, valueOf: (n: DumpNode) => number | undefined) =>
  m.occ.map((o) => ({ variant: o.variant, value: valueOf(o.node) ?? 0 }));

/** GAP-CLOSING ROUND 2 (`axis-inert`) — BASE-SLICE PROJECTION of a refused
 *  literal channel onto ONE axis.
 *
 *  A channel whose captured values are a clean function of a PAIR of axes
 *  (ProgressBar's bar width = f(progress × label): 8.08px at 0%/Right,
 *  271px at 100%/Right, 320px at 100%/Bottom) refuses classification on a
 *  NESTED part — mintTokens offers pairs to ROOT observations only, because
 *  a two-placeholder ref has no nested spelling. Before this round the whole
 *  channel then collapsed to the FIRST occurrence's single number, which is
 *  what made the axis inert: eleven Progress values, one 8.08px bar.
 *
 *  The projection carries the base SLICE instead of the base POINT. Pin
 *  every other axis at the base combination (the first occurrence's variant)
 *  and read the channel along one axis; if two or more DISTINCT values
 *  survive, that slice is a per-value literal map. Deterministic by
 *  construction: axes are tried in declared order, the winner is the axis
 *  whose slice SPANS the most (max − min — the axis that explains the most
 *  of the channel's observed variation), ties broken by distinct count,
 *  then coverage, then declared order; the map is keyed in the axis's own
 *  value order. Span, not distinct count, decides: ProgressBar's track
 *  `width` reads 287→271px across `progress` (five near-identical numbers,
 *  hand-drawn jitter) and 287→320px across `label` (the real cause — the
 *  track shortens only to make room for the right-hand percentage). Counting
 *  distinct values picked the jitter; spanning picks the cause. Nothing is
 *  interpolated or derived — every number is a captured observation, and
 *  combinations off the base slice keep the refusal that was already named.
 *
 *  Returns null when no axis explains two distinct values on its slice (the
 *  channel really is one number — today's single-literal fallback stands),
 *  when the observation is missing, or when another `literalsByProp` entry
 *  already claims this channel for a different prop (the referee's
 *  channel+prop conflict rule; a second claimant would make the cascade
 *  order the meaning). BOOL axes are excluded: `literalsByProp` requires a
 *  declared ENUM prop. */
function projectRefusedOnAxis(
  ctx: Ctx,
  fb: { part: Record<string, unknown>; chan: string; where: string },
): { prop: string; byValue: Map<string, number>; baseCombo: string } | null {
  const mc = ctx.mint;
  if (!mc) return null;
  const obs = mc.observations.find((o) => o.nodePath === fb.where && o.cssProperty === fb.chan);
  if (!obs || obs.occurrences.length < 2) return null;
  const existing =
    (fb.part.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | undefined) ?? [];
  const claimedElsewhere = existing.filter((e) =>
    Object.values(e.map).some((o) => fb.chan in o),
  );
  const base = obs.occurrences[0].axisValues;
  interface Cand { prop: string; byValue: Map<string, number>; span: number; distinct: number; baseCombo: string }
  let best: Cand | null = null;
  for (const axis of mc.axes) {
    if (axis.bool) continue; // literalsByProp needs a declared enum prop
    if (claimedElsewhere.some((e) => e.prop !== axis.propName)) continue;
    const others = mc.axes.filter((a) => a.propName !== axis.propName);
    const slice = new Map<string, number>();
    for (const o of obs.occurrences) {
      if (others.some((a) => o.axisValues[a.propName] !== base[a.propName])) continue;
      const v = o.axisValues[axis.propName];
      if (v === undefined || slice.has(v) || typeof o.value !== 'number') continue;
      slice.set(v, o.value);
    }
    const values = [...slice.values()];
    const distinct = new Set(values).size;
    if (distinct < 2) continue;
    const span = Math.max(...values) - Math.min(...values);
    const ordered = new Map<string, number>();
    for (const v of axis.values) if (slice.has(v)) ordered.set(v, slice.get(v)!);
    for (const [v, n] of slice) if (!ordered.has(v)) ordered.set(v, n); // any value outside the declared list, stable
    const cand: Cand = { prop: axis.propName, byValue: ordered, span, distinct, baseCombo: others.map((a) => `${a.propName}=${base[a.propName] ?? '∅'}`).join(', ') };
    const beats =
      best === null ||
      cand.span > best.span ||
      (cand.span === best.span &&
        (cand.distinct > best.distinct ||
          (cand.distinct === best.distinct && cand.byValue.size > best.byValue.size)));
    if (beats) best = cand;
  }
  return best === null ? null : { prop: best.prop, byValue: best.byValue, baseCombo: best.baseCombo };
}

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
  if (u.kind === 'drift') {
    if (u.boolFn) (ctx.boolFnRefs ??= new Map()).set(`${where}|${field}`, u.boolFn);
    // opacity has a literal boolean vocabulary (stylesWhen) — invertNodeOpacity
    // writes that channel's receipt, carried or named; every other field is
    // named here with the axis.
    if (!(u.boolFn && field === 'opacity')) ctx.notes.push(`${where} ${field}: ${u.detail}`);
  }
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
  // The dump spells `hex` BARE (`rrggbb`, dump.plugin.js / rest/map.ts). A
  // producer that already prefixed `#` used to yield `##rrggbb` — a value the
  // token schema swallowed and the literal schema refuses (the whole set was
  // then skipped). One spelling in, one out.
  const hex = (p.hex ?? '').replace(/^#/, '');
  if (p.alpha === undefined || p.alpha >= 1) return `#${hex}`;
  const byte = Math.round(Math.max(0, Math.min(1, p.alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${hex}${byte}`;
};

function unifyPaint(
  m: Merged,
  pick: (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined,
  ctx: Ctx,
  where: string,
  paintName: string,
  mint?: {
    cssProperty: string;
    target: Record<string, string>;
    /** The literal an ABSENT paint means on this channel, when absence is
     *  itself a drawn fact rather than a missing observation. A node with no
     *  stroke is not a node whose stroke was not captured — it is a node
     *  drawn with a ZERO-WIDTH TRANSPARENT stroke, exactly the reading the
     *  companion border-width channel already takes (`numOccurrences` mints
     *  0 for the strokeless variants) and the one the child-stub geometry
     *  path has always taken (`o.stroke ? paintCssHex(o.stroke) : '#00000000'`
     *  paired with `o.stroke ? o.strokeWeight : 0`). Absent here → the two
     *  halves of ONE fact disagree: the width channel carries "there is a
     *  4px border" while the color channel refuses, and CSS resolves the
     *  unset `border-color` to `currentColor` — a partially drawn stroke
     *  renders as a ring of TEXT INK, strictly worse than not carrying the
     *  stroke at all. Only channels whose absence has a rendering-neutral
     *  literal may pass this; a FILL has no such literal (an unpainted frame
     *  is not a transparent frame — it inherits nothing but shows what is
     *  behind it, which is the same thing, but a partial fill is a genuine
     *  capture gap), so it stays the named refusal.
     *
     *  GAP-CLOSING ROUND 10 — A FUNCTION, so the reading can be made PER
     *  OCCURRENCE. The blanket refusal above is right about a fill whose
     *  absence is unexplained and wrong about one the SAME NODE explains:
     *  a node carrying an `imageFill` (dump v1.7/1.9) has a fully described
     *  paint stack — an image, and no solid under it that the capture saw —
     *  so "no solid" there is an observation, not a gap, and its
     *  rendering-neutral literal is fully transparent — `#00000000`, the same
     *  spelling the stroke channel already uses for its vacuous paint (the
     *  image is painted over
     *  it by the very same channel pair). Measured: Untitled UI's Avatar
     *  draws #f9f5ff on 108 of its 162 variants and a photo on the other 54;
     *  the mixed stack refused the whole channel, so the pale purple ground
     *  NEVER RENDERED on any variant (probe `av-bg`, +0.58 on the set).
     *  Everything else — a node with neither a solid nor an image — keeps
     *  the named refusal, because nothing on it says which of the two it is. */
    absentAs?: string | ((node: DumpNode) => string | undefined);
    /** Vacuous value for axis combinations no variant draws, when the channel
     *  is presence-shaped. Only meaningful together with `absentAs`: the same
     *  decision that makes an absent paint readable makes an UNOBSERVED one
     *  readable, and without it a pair/triple classification with a hole in
     *  its cartesian refuses and the whole channel drops again (Avatar draws
     *  3 of the 4 placeholder×text combinations). */
    sparse?: string;
  },
): UnifiedRef | undefined {
  const paints = m.occ.map((o) => ({ variant: o.variant, paint: pick(o.node), node: o.node }));
  /** The literal THIS occurrence's absence means, or undefined when its
   *  absence is a capture gap. */
  const absentFor = (p: { node: DumpNode }): string | undefined =>
    typeof mint?.absentAs === 'function' ? mint.absentAs(p.node) : mint?.absentAs;
  if (paints.every((p) => p.paint === undefined)) return undefined;
  const raw = paints.find((p) => p.paint?.hex !== undefined);
  if (raw) {
    reportUnbound(ctx, where, paintName, paintCssHex(raw.paint!));
    if (ctx.mint && mint) {
      // Mintable only when EVERY variant resolved to a raw hex — a paint
      // missing in some variants, or half-bound, stays a report entry.
      // EXCEPT on a channel that declares `absentAs`: there the missing
      // occurrences are not missing, they are the neutral literal, and the
      // channel mints complete (see the absentAs doc above).
      const allHex = paints.every((p) => p.paint?.hex !== undefined);
      const hexOrAbsent =
        mint.absentAs !== undefined &&
        paints.every((p) => (p.paint === undefined ? absentFor(p) !== undefined : p.paint.hex !== undefined));
      if (allHex || hexOrAbsent) {
        const absentLiterals = [...new Set(paints.filter((p) => p.paint === undefined).map((p) => absentFor(p)!))];
        mintObservation(
          ctx, mint.target, where, mint.cssProperty, 'color',
          paints.map((p) => ({
            variant: p.variant,
            value: p.paint === undefined ? absentFor(p)! : paintCssHex(p.paint),
          })),
          `${where}|${paintName}`,
          allHex ? undefined : mint.sparse,
        );
        if (!allHex) {
          ctx.notes.push(
            `${where} ${paintName}: drawn in ${paints.filter((p) => p.paint !== undefined).length}/${paints.length} variant(s) — the ABSENT variants mint ${absentLiterals.join('/')} (their absence is a DRAWN fact: a strokeless node is a zero-width transparent stroke, a node with no solid fill shows what is behind it — the capture receipts every other paint kind by name, so "no fill" is an observation, not a gap), so ${mint.cssProperty} carries for the whole axis instead of falling back to currentColor or dropping (Phase 2 exam: the Button/Badge background)`,
          );
        }
      } else {
        ctx.mint.partialSources.add(`${where}|${paintName}`);
      }
    }
    return undefined;
  }
  // PHASE 2 EXAM — BOUND paints on some variants, ABSENT on the rest, on a
  // channel whose absence is a drawn literal (absentAs): the bound refs
  // cannot unify (a hole in the axis is not a ref), and the drift note used
  // to be the whole story — the channel dropped. When every bound ref
  // resolves through the captured-variable layer, the observation routes
  // into the mint pass (captured literal where drawn, the neutral literal
  // where not) — the same door the all-bound drift case below takes.
  if (ctx.mint && mint && mint.absentAs !== undefined && paints.some((p) => p.paint === undefined)) {
    const values = paints.map((p) =>
      p.paint === undefined ? absentFor(p) : p.paint.var !== undefined ? ctx.capturedValues?.get(dotPath(p.paint.var)) : undefined,
    );
    if (values.every((v): v is string => v !== undefined)) {
      mintObservation(
        ctx, mint.target, where, mint.cssProperty, 'color',
        paints.map((p, i) => ({ variant: p.variant, value: values[i] as string })),
        `${where}|${paintName}`,
        mint.sparse,
      );
      ctx.notes.push(
        `${where} ${paintName}: bound in ${paints.filter((p) => p.paint !== undefined).length}/${paints.length} variant(s) and ABSENT in the rest — routed to the mint pass at captured-value literal fidelity (the absent variants mint ${[...new Set(paints.filter((p) => p.paint === undefined).map((p) => absentFor(p)!))].join('/')}: their absence is a DRAWN fact); the bound refs (${[...new Set(paints.filter((p) => p.paint?.var !== undefined).map((p) => p.paint!.var!))].join(', ')}) are the rename targets`,
      );
      return undefined;
    }
    ctx.notes.push(
      `${where} ${paintName}: bound in ${paints.filter((p) => p.paint !== undefined).length}/${paints.length} variant(s) and ABSENT in the rest — the bound refs do not resolve through a captured-variable layer (no \`_variables\` in this dump), so the channel cannot mint at literal fidelity; NAMED, not proposed (review)`,
    );
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

/** dump v1.11 — WHICH CSS VOCABULARY CARRIES A STROKE IS DECIDED BY WHERE THE
 *  CANVAS DRAWS IT, and until v1.11 nothing here could ask.
 *
 *  A Figma stroke is INSIDE (default), CENTER or OUTSIDE. Only INSIDE is a
 *  CSS `border`: under the emitted global `box-sizing: border-box` a border
 *  is drawn INWARD, eating the content box. An OUTSIDE stroke grows the
 *  drawing beyond the node box without moving anything, which is exactly
 *  `outline` (outside the border box, out of flow, no layout effect) — and
 *  NOT `border` on a grown box: growing the box moves the root the scorer
 *  anchors on, which was measured and FALSIFIED (probe avatar-ring-outside,
 *  -0.67).
 *
 *  Returns the vocabulary prefix. CENTER straddles the edge and has no exact
 *  CSS spelling; it is refused BY NAME here and renders as the INSIDE border
 *  it already rendered as — a named approximation, not a silent one. Mixed
 *  alignment across the variants of one node is likewise refused by name.
 *
 *  An ABSENT strokeAlign is NOT read as INSIDE-the-fact: it is read as
 *  not-captured (a pre-v1.11 dump), which lands on the same border spelling
 *  those dumps already produced. Same bytes for old dumps, new truth for new
 *  ones. */
function strokeVocabulary(m: Merged, ctx: Ctx, where: string): 'border' | 'outline' {
  const drawn = m.occ.filter((o) => o.node.stroke !== undefined);
  const aligns = new Set(
    drawn.map((o) => o.node.strokeAlign).filter((a): a is NonNullable<typeof a> => a !== undefined),
  );
  if (aligns.size === 0) return 'border'; // not captured, or nothing drawn
  if (aligns.size > 1) {
    ctx.notes.push(
      `${where}: stroke alignment differs across variants [${[...aligns].sort().join(', ')}] — one node lowers to ONE border/outline vocabulary, so the mixed case is REFUSED BY NAME and the stroke carries as an INSIDE border (review)`,
    );
    return 'border';
  }
  const [align] = aligns;
  if (align === 'OUTSIDE') return 'outline';
  if (align === 'CENTER') {
    ctx.notes.push(
      `${where}: strokeAlign CENTER — half the weight is drawn inside the box and half outside; CSS border draws wholly inward and outline wholly outward, so neither carries it exactly. REFUSED BY NAME (capture receipt stroke-align-unsupported); the stroke carries as an INSIDE border, off by half its weight per side (review)`,
    );
    return 'border';
  }
  return 'border';
}

// ---------------------------------------------------------------------------
// GRADIENT_LINEAR fills → background-image (dump v1.16)
// ---------------------------------------------------------------------------

/** One captured gradient → a CSS `linear-gradient()` literal, or a NAMED
 *  refusal. AXIS-ALIGNED ramps (horizontal / vertical handles) carry EXACTLY
 *  and size-independently: the handles are normalized object space, so the
 *  box edges sit at fixed ramp positions whatever the box's pixel size. The
 *  spelling is normalized to the VISIBLE SEGMENT — the emitted stops span
 *  0%–100% of the box with the edge colors interpolated ON the ramp and
 *  interior stops remapped — which is pixel-identical inside the box (a
 *  linear ramp restricted to a segment is the same linear ramp) and keeps
 *  every stop inside the grammar both parseCssGradient (contract→canvas) and
 *  the CSS surfaces already speak. Eventz field case: Badge accent/info/
 *  warning/featured grounds — handles run from x≈2.15 to x≈-0.006, so the
 *  box shows the 53%–100% segment of the ramp; the naive full-ramp spelling
 *  would repaint more than half the ground with colors the canvas never
 *  draws.
 *
 *  OBLIQUE ramps are REFUSED BY NAME: a CSS gradient angle is measured in
 *  pixel space while the handles live in normalized object space, so the
 *  equivalent angle (and the gradient line's % scale) is a function of the
 *  drawn box's aspect ratio — a size-independent exact carriage does not
 *  exist, and baking the default box's angle would silently skew every other
 *  size. (Eventz field case: the four Molecules/Alert grounds.) */
function gradientCss(g: NonNullable<DumpNode['gradient']>): { css: string } | { refuse: string } {
  const EPS = 1e-3;
  const dx = g.end.x - g.start.x;
  const dy = g.end.y - g.start.y;
  const horizontal = Math.abs(dy) <= EPS && Math.abs(dx) > EPS;
  const vertical = Math.abs(dx) <= EPS && Math.abs(dy) > EPS;
  if (!horizontal && !vertical) {
    return {
      refuse:
        Math.abs(dx) <= EPS && Math.abs(dy) <= EPS
          ? `degenerate GRADIENT_LINEAR (start ≈ end handle) — no axis to carry`
          : `OBLIQUE GRADIENT_LINEAR (handles (${g.start.x}, ${g.start.y}) → (${g.end.x}, ${g.end.y})) — the CSS angle and stop scale depend on the drawn box's aspect ratio, so no size-independent exact carriage exists`,
    };
  }
  // CSS coordinate s ∈ [0,1] runs along the gradient direction; pick the
  // angle whose s increases WITH the ramp so positions stay ordered.
  const angle = horizontal ? (dx > 0 ? 90 : 270) : dy > 0 ? 180 : 0;
  const rampAt = (obj: number) => (horizontal ? (obj - g.start.x) / dx : (obj - g.start.y) / dy);
  // Ramp positions of the box edges at CSS s=0 and s=1.
  const pA = rampAt(horizontal ? (dx > 0 ? 0 : 1) : dy > 0 ? 0 : 1);
  const pB = rampAt(horizontal ? (dx > 0 ? 1 : 0) : dy > 0 ? 1 : 0);
  if (!(pB > pA) || !isFinite(pA) || !isFinite(pB)) {
    return { refuse: `GRADIENT_LINEAR handles produce an empty visible segment (${pA}..${pB}) — not carried` };
  }
  const paintAlpha = g.alpha ?? 1;
  const sorted = [...g.stops].sort((a, b) => a.position - b.position);
  const rgba = (s: (typeof sorted)[number]) => {
    const hex = s.hex.length === 6 ? s.hex : s.hex.padEnd(6, '0');
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      (s.alpha ?? 1) * paintAlpha,
    ] as const;
  };
  const colorAt = (p: number): readonly [number, number, number, number] => {
    if (p <= sorted[0].position) return rgba(sorted[0]);
    if (p >= sorted[sorted.length - 1].position) return rgba(sorted[sorted.length - 1]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (p < a.position || p > b.position) continue;
      const t = b.position === a.position ? 0 : (p - a.position) / (b.position - a.position);
      const ca = rgba(a);
      const cb = rgba(b);
      return [0, 1, 2, 3].map((k) => ca[k] + (cb[k] - ca[k]) * t) as unknown as readonly [number, number, number, number];
    }
    return rgba(sorted[sorted.length - 1]);
  };
  const spell = ([r, gg, b, a]: readonly [number, number, number, number]): string =>
    paintCssHex({
      hex: [r, gg, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''),
      alpha: Math.round(a * 10000) / 10000,
    });
  const pct = (p: number) => `${Math.round(((p - pA) / (pB - pA)) * 10000) / 100}%`;
  const stops: string[] = [`${spell(colorAt(pA))} 0%`];
  for (const s of sorted) {
    if (s.position > pA && s.position < pB) stops.push(`${spell(rgba(s))} ${pct(s.position)}`);
  }
  stops.push(`${spell(colorAt(pB))} 100%`);
  return { css: `linear-gradient(${angle}deg, ${stops.join(', ')})` };
}

/** dump v1.16 — a node whose fill stack carries a GRADIENT_LINEAR mints the
 *  whole `background-image` axis (kind 'gradient', the imageFill precedent):
 *  gradient variants carry their normalized `linear-gradient()` spelling,
 *  gradient-less variants carry 'none' (their absence is a DRAWN fact — the
 *  solid ground rides background-color), and the standard mint machinery
 *  classifies uniform / per-axis shapes. One refused occurrence refuses the
 *  WHOLE channel by name: minting 'none' where the canvas draws an oblique
 *  ramp would assert an absence the canvas contradicts. Stop-level variable
 *  bindings are NAMED (a token ref has no spelling inside a gradient value —
 *  the ramp carries their resolved colors). */
function mintGradientBackground(m: Merged, ctx: Ctx, where: string, tokens: Record<string, string>): void {
  const withGradient = m.occ.filter((o) => o.node.gradient !== undefined);
  if (withGradient.length === 0) return;
  if (m.occ.some((o) => o.node.imageFill !== undefined)) {
    ctx.notes.push(
      `${where}: fill stack carries BOTH a GRADIENT_LINEAR and an IMAGE marker across the variants — background-image is claimed by the image channel; gradient NAMED, not carried (review)`,
    );
    return;
  }
  const boundStops = [
    ...new Set(withGradient.flatMap((o) => o.node.gradient!.stops.map((s) => s.var).filter((v) => v !== undefined))),
  ] as string[];
  if (!ctx.mint) {
    ctx.notes.push(
      `${where}: GRADIENT_LINEAR fill captured (dump v1.16) in ${withGradient.length}/${m.occ.length} variant(s) — background-image not proposed without minting (a gradient value has no token-ref spelling)`,
    );
    return;
  }
  const values: Array<{ variant: string; value: string }> = [];
  for (const o of m.occ) {
    if (o.node.gradient === undefined) {
      values.push({ variant: o.variant, value: 'none' });
      continue;
    }
    const spelled = gradientCss(o.node.gradient);
    if ('refuse' in spelled) {
      ctx.notes.push(
        `${where} fill (${o.variant}): ${spelled.refuse} — background-image REFUSED BY NAME for the whole node (carrying the other variants would mint 'none' here, an absence the canvas contradicts); the captured handles/stops stay in the dump for a later carriage, review`,
      );
      return;
    }
    values.push({ variant: o.variant, value: spelled.css });
  }
  if (boundStops.length > 0) {
    ctx.notes.push(
      `${where}: gradient stop(s) ride bound variable(s) ${boundStops.map((v) => `"${v}"`).join(', ')} — a token ref has no spelling inside a gradient value, so the ramp carries their RESOLVED colors (rename story: the variable names live here, review)`,
    );
  }
  ctx.notes.push(
    `${where}: GRADIENT_LINEAR fill (dump v1.16) carried as background-image — axis-aligned ramp normalized to the box's visible segment (pixel-exact inside the drawn box; stops respell against the box edges), 'none' minted where a variant draws no gradient (its ground rides background-color)`,
  );
  mintObservation(ctx, tokens, where, 'background-image', 'gradient', values, `${where}|gradient`, 'none');
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
  /** Owning part, when the caller has one (nested parts) — enables the
   *  base-combo literal fallback for padding channels whose per-variant
   *  values refuse classification (see mintPadding). Absent on the root. */
  part?: Record<string, unknown>,
  /** DECLARED keyword facts this inversion decides (dump v1.11: an
   *  OUTSIDE-aligned stroke lowers to the outline vocabulary, and a CSS
   *  outline paints nothing without `outline-style`). Written here and
   *  attached by the caller, because the keyword must be CARRIED — no
   *  emitter may infer it from outline-width, which is a resting
   *  focus-ring-reservation idiom in CSS-extracted contracts. */
  declaredOut?: Record<string, string>,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  const fields = new Set<string>();
  for (const o of m.occ) for (const f of Object.keys(o.node.bound ?? {})) fields.add(f);
  const f = (name: string) => (fields.has(name) ? unifyField(m, name, ctx, where) : undefined);
  const carry = (cssProp: string, u: UnifiedRef | undefined) => carryRef(tokens, byProp, cssProp, u, ctx, where);
  // dump v1.11: an OUTSIDE stroke is not a border. Decided once, used by
  // BOTH halves of the stroke fact (colour and width) so they can never
  // disagree about which box edge they are describing.
  const strokeVocab = strokeVocabulary(m, ctx, where);
  const strokeColorProp = `${strokeVocab}-color`;
  const strokeWidthProp = `${strokeVocab}-width`;
  // The keyword that makes the outline paint at all. Declared, never
  // inferred downstream — see strokeVocabulary's note.
  if (strokeVocab === 'outline' && declaredOut) declaredOut['outline-style'] = 'solid';

  carry(
    'background-color',
    unifyPaint(m, (n) => (n.type === 'TEXT' ? undefined : n.fill), ctx, where, 'fill', {
      cssProperty: 'background-color',
      target: tokens,
      // PHASE 2 EXAM (fill-absent-on-axis-value / fill-unset-by-state): an
      // ABSENT fill is a DRAWN fact, exactly as an absent stroke is. Both
      // readers (dump.plugin.js dumpPaint / rest map.ts mapFillStack) take
      // the first visible SOLID and receipt every other paint kind by name
      // (paint-unsupported / paint-stack-truncated / imageFill), so a node
      // with no `fill` field and no receipt was DRAWN with no solid — it
      // shows what is behind it, which IS the rendering of `#00000000`. The
      // old reading ("a partial fill is a genuine capture gap") refused the
      // whole channel for the variants that DO draw one: the Button (Ghost
      // has none) and the Badge (Size=sm is a bare dot) rendered with no
      // background at all. The variants that draw a fill mint their colour;
      // the variants that draw none mint transparent; nothing is invented.
      absentAs: '#00000000',
      sparse: '#00000000',
    }),
  );
  // dump v1.16: a GRADIENT_LINEAR in the fill stack rides background-image
  // beside (or instead of) the solid background-color above.
  mintGradientBackground(m, ctx, where, tokens);
  carry(
    strokeColorProp,
    unifyPaint(m, (n) => n.stroke, ctx, where, 'stroke', {
      cssProperty: strokeColorProp,
      target: tokens,
      // A strokeless variant is a ZERO-WIDTH stroke, not an uncaptured one —
      // the width channel below already mints 0 for exactly these nodes.
      absentAs: '#00000000',
    }),
  );

  // Paired fields → the contract's coarser vocabulary. Per-value functions
  // pair by identity (same axis, same per-value refs — see refKey).
  const pair = (a?: UnifiedRef, b?: UnifiedRef) =>
    a !== undefined && refKey(a) === refKey(b) ? a : undefined;
  // Asymmetric pairs (left binding ≠ right binding) carry as the per-side
  // longhand channels instead of refusing — the same general rule as the
  // literal path (mintPadding): every padding channel present on a node
  // either carries or is NAMED; it never silently vanishes (untitled-ui
  // round 2, style-channel-dropped).
  const PAD_PAIRS = [
    { shorthand: 'padding-inline', label: 'left/right', sides: [['padding-left', 'paddingLeft'], ['padding-right', 'paddingRight']] },
    { shorthand: 'padding-block', label: 'top/bottom', sides: [['padding-top', 'paddingTop'], ['padding-bottom', 'paddingBottom']] },
  ] as const;
  for (const { shorthand, label, sides } of PAD_PAIRS) {
    const refs = sides.map(([, field]) => f(field));
    const both = pair(refs[0], refs[1]);
    if (both) {
      carry(shorthand, both);
      continue;
    }
    if (!sides.some(([, field]) => fields.has(field))) continue;
    sides.forEach(([cssProp], i) => carry(cssProp, refs[i]));
    ctx.notes.push(
      `${where}: ${label} padding bindings differ — ${shorthand} is not representable; carried as separate ${sides.map(([p]) => p).join('/')} channels`,
    );
  }
  const radii = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
  if (radii.some((r) => fields.has(r))) {
    const rs = radii.map((r) => f(r));
    if (rs[0] !== undefined && rs.every((r) => refKey(r) === refKey(rs[0]))) carry('border-radius', rs[0]);
    else ctx.notes.push(`${where}: corner radii bindings are not uniform — border-radius not representable, review`);
  }
  const WEIGHT_SIDES = [
    ['border-top-width', 'strokeTopWeight'],
    ['border-right-width', 'strokeRightWeight'],
    ['border-bottom-width', 'strokeBottomWeight'],
    ['border-left-width', 'strokeLeftWeight'],
  ] as const;
  const weights = WEIGHT_SIDES.map(([, field]) => field);
  if (weights.some((w) => fields.has(w)) || fields.has('strokeWeight')) {
    const w = fields.has('strokeWeight')
      ? f('strokeWeight')
      : (() => {
          const ws = weights.map((x) => f(x));
          return ws[0] !== undefined && ws.every((x) => refKey(x) === refKey(ws[0])) ? ws[0] : undefined;
        })();
    if (w) carry(strokeWidthProp, w);
    else if (strokeVocab === 'border' && weights.some((field) => fields.has(field))) {
      // Twin of PAD_PAIRS: per-side names (border-top-width ≠ border-right-width)
      // are not one border-width, but they are still facts. Naming-and-dropping
      // them was FC-DUMP-PROPOSE-STROKE-WEIGHT-SIDES (Flowbite Button).
      for (const [cssProp, field] of WEIGHT_SIDES) carry(cssProp, f(field));
      ctx.notes.push(
        `${where}: stroke weight bindings differ per side — ${strokeWidthProp} is not representable; carried as separate ${WEIGHT_SIDES.map(([p]) => p).join('/')} channels`,
      );
    } else {
      ctx.notes.push(`${where}: stroke weight bindings are not uniform — ${strokeWidthProp} not representable, review`);
    }
  }
  carry('gap', f('itemSpacing'));
  // The root's bound width comes back as max-width (a component's outer
  // dimension is fluid-up-to in code; the canvas can only draw the max). The
  // TOKEN is unchanged, so nothing is lost — but the CHANNEL changed, and the
  // run said so nowhere. A reader diffing the proposal against the contract
  // then sees `width` missing and `max-width` invented, and counts a
  // translation as two losses. It cost exactly that once (TJ-TEST.md §A7
  // listed Label's width as a silent loss; it never was). Receipt it.
  if (isRoot && f('width') !== undefined) {
    ctx.notes.push(
      `${where}: root width binding ${f('width')} carries as **max-width**, not width — a component's outer size is fluid-up-to in code and the canvas draws the max. Same token, translated channel; nothing dropped`,
    );
  }
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
    // ANY variant with 2+ children makes the gap a rendered fact — gating on
    // the FIRST variant's child count let a set whose default variant has a
    // single child (Badge base Icon=False) drop every other variant's
    // itemSpacing with no receipt (untitled-ui round 2, style-channel-dropped).
    // r11: a native SLOT's itemSpacing is a rendered fact the moment the
    // consumer drops two children in — the drawn child count is not the
    // denominator there (canvas conformance slot-interior-auto-layout).
    (m.type === 'SLOT' || m.occ.some((o) => (o.node.children?.length ?? 0) > 1)) &&
    m.occ.some((o) => (o.node.layout?.spacing ?? 0) !== 0)
  ) {
    const spacings = m.occ.map((o) => o.node.layout?.spacing ?? 0);
    const negatives = spacings.filter((s) => s < 0).length;
    reportUnbound(ctx, where, 'itemSpacing', firstNode((n) => n.layout?.spacing, 0).layout!.spacing ?? 0);
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
    mintPadding(ctx, tokens, m, where, part);
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
    // width 0). Round 5: the COLOR channel now reads the same absence the
    // same way (`absentAs: '#00000000'` on the border-color carry above)
    // instead of refusing on partiality — the two halves of one stroke fact
    // must agree, or the width lands with `border-color: currentColor` and
    // the ring draws in text ink.
    mintObservation(ctx, tokens, where, strokeWidthProp, 'px', numOccurrences(m, (n) => n.strokeWeight), `${where}|strokeWeight`);
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
    // dump v1.30 / FC-DUMP-MINMAX-ZERO-INVENTED: Figma's default 0 is not a
    // tap-target fact. A pre-v1.30 dump that wrote 0 must not mint it.
    if (withVal.every((o) => pick(o.node) === 0)) continue;
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
  if (m.occ.some((o) => o.node.bound?.opacity)) {
    // One ref (or an enum per-value map) rides tokens.opacity; any other
    // drift was named by unifyField — EXCEPT a pure function of one BOOLEAN
    // axis (FC-DUMP-PROPOSE-BOOL-AXIS-CORRELATION), which lands here: the
    // refs resolve through the corpus and the literal-CSS boolean vocabulary
    // (stylesWhen, inversion 2 below) carries the VALUE; the token IDENTITY
    // of the true-side variable is the named loss.
    const fn = ctx.boolFnRefs?.get(`${where}|opacity`);
    if (!fn) return;
    // The VALUE is the canvas's own: dump v1.2 writes the rendered node
    // opacity (< 1) beside the binding, so the carried literal is what was
    // drawn — never a corpus number reinterpreted (Eventz spells its opacity
    // variables in Figma's PERCENT, 100/40, while the node renders 0.4). The
    // resolved variable rides the receipt as corroboration.
    const plane = (want: 'true' | 'false') =>
      new Set(
        m.occ
          .filter((o) => (axisValuesOf(o.variant)[fn.axis.property] ?? '').trim().toLowerCase() === want)
          .map((o) => o.node.opacity ?? 1),
      );
    const resolve = (path: string): string | undefined => {
      if (path.includes('{') || !ctx.corpus.has(path)) return undefined;
      try {
        return String(ctx.corpus.resolveLiteral(path));
      } catch {
        return undefined;
      }
    };
    const slash = (path: string) => path.split('.').join('/');
    const whenFalse = plane('false');
    const whenTrue = plane('true');
    const resolvedTrue = resolve(fn.byValue.true);
    const names = `"${slash(fn.byValue.false)}" when false, "${slash(fn.byValue.true)}" when true`;
    if (whenFalse.size === 1 && whenFalse.has(1) && whenTrue.size === 1 && !whenTrue.has(1)) {
      const value = [...whenTrue][0];
      const stylesWhen = (holder.stylesWhen as Array<Record<string, unknown>> | undefined) ?? [];
      stylesWhen.push({ prop: fn.axis.propName, styles: { opacity: String(value) } });
      holder.stylesWhen = stylesWhen;
      ctx.notes.push(
        `${where}: bound opacity is a pure function of the BOOLEAN axis "${fn.axis.property}" (${names}) — carried as stylesWhen { prop: ${fn.axis.propName}, styles: { opacity: ${value} } } from the RENDERED node opacity (dump v1.2${resolvedTrue !== undefined ? `; the variable resolves to ${resolvedTrue}${Number(resolvedTrue) === value * 100 ? ', Figma\'s percent spelling of the same value' : ''}` : ''}); tokensByProp is enum-keyed, so the token IDENTITY of "${slash(fn.byValue.true)}" is NOT carried, its value is (rename story lives here; review)`,
      );
      return;
    }
    const why =
      whenFalse.size === 1 && whenFalse.has(1) && whenTrue.size === 1
        ? 'both planes render opaque'
        : whenTrue.size === 1 && whenTrue.has(1) && whenFalse.size === 1
          ? 'the washed-out plane is the FALSE side and stylesWhen cannot express negation'
          : `the rendered opacity is not one value per plane (false: ${[...whenFalse].join('/')}; true: ${[...whenTrue].join('/')})`;
    ctx.notes.push(
      `${where}: bound opacity is a pure function of the BOOLEAN axis "${fn.axis.property}" (${names}) but ${why} — NAMED, not proposed (review)`,
    );
    return;
  }
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

const splitShadowLayers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const parseCssRgba = (
  raw: string,
): { r: number; g: number; b: number; a: number } | undefined => {
  const hex = raw.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    if (h.length === 4) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
    if (h.length !== 6 && h.length !== 8) return undefined;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const rgb = raw.match(/^rgba?\(([^)]*)\)$/i);
  if (!rgb) return undefined;
  const parts = rgb[1].split(',').map((s) => s.trim());
  if (parts.length < 3) return undefined;
  const [r, g, b] = parts.slice(0, 3).map((p) => parseFloat(p));
  const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return undefined;
  return { r, g, b, a };
};

const parseShadowLayer = (
  layer: string,
): { x: number; y: number; radius: number; spread: number; r: number; g: number; b: number; a: number } | undefined => {
  const colorMatch = layer.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/);
  if (!colorMatch) return undefined;
  const color = parseCssRgba(colorMatch[1]);
  if (!color) return undefined;
  const lengths = layer
    .replace(colorMatch[1], '')
    .replace(/(^| )inset( |$)/, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (lengths.length < 2 || lengths.length > 4) return undefined;
  const px = lengths.map((l) => {
    const m = l.match(/^(-?[\d.]+)(px)?$/);
    return m ? parseFloat(m[1]) : NaN;
  });
  if (px.some(Number.isNaN)) return undefined;
  return {
    x: px[0],
    y: px[1],
    radius: px[2] ?? 0,
    spread: px[3] ?? 0,
    ...color,
  };
};

/** Dump hex stacks and authored rgba stacks are the same DROP_SHADOW.
 *  Alpha 0.1 vs #..1a (26/255) is Figma's byte rounding — not a different token. */
const shadowStacksEqual = (a: string, b: string): boolean => {
  const la = splitShadowLayers(a);
  const lb = splitShadowLayers(b);
  if (la.length === 0 || la.length !== lb.length) return false;
  for (let i = 0; i < la.length; i++) {
    const pa = parseShadowLayer(la[i]);
    const pb = parseShadowLayer(lb[i]);
    if (!pa || !pb) return false;
    if (pa.x !== pb.x || pa.y !== pb.y || pa.radius !== pb.radius || pa.spread !== pb.spread) return false;
    if (Math.abs(pa.r - pb.r) > 1 || Math.abs(pa.g - pb.g) > 1 || Math.abs(pa.b - pb.b) > 1) return false;
    if (Math.abs(pa.a - pb.a) > 0.02) return false;
  }
  return true;
};

const expandAuthoredShadowPath = (ref: string, variant: string, ctx: Ctx): string | undefined => {
  if (!ref.startsWith('{') || !ref.endsWith('}')) return undefined;
  let path = ref.slice(1, -1);
  const av = axisValuesOf(variant);
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    const ph = match[1];
    const axis = ctx.axes.find((a) => a.propName === ph);
    const raw = axis ? av[axis.property] : av[ph];
    if (!raw) return undefined;
    path = path.replaceAll(`{${ph}}`, camel(raw));
  }
  return path.includes('{') ? undefined : path;
};

/** FC-DUMP-PROPOSE-SHADOW-MINTED: Figma cannot bind effect stacks; emit
 *  writes literals. Minting a dump-slug remints a token the canvas refused.
 *  When the stamped authored ref resolves (per variant, after axis
 *  substitution) to the drawn stack, recover THAT ref. */
const recoverAuthoredBoxShadow = (
  ctx: Ctx,
  target: Record<string, string>,
  where: string,
  authoredRef: string | undefined,
  drawn: Array<{ variant: string; value: string }>,
): boolean => {
  if (!authoredRef || !authoredRef.startsWith('{') || !authoredRef.endsWith('}') || drawn.length === 0) {
    return false;
  }
  for (const row of drawn) {
    const path = expandAuthoredShadowPath(authoredRef, row.variant, ctx);
    if (!path || !ctx.corpus.has(path)) return false;
    try {
      const resolved = ctx.corpus.resolveLiteral(path);
      if (typeof resolved !== 'string' || !shadowStacksEqual(resolved, row.value)) return false;
    } catch {
      return false;
    }
  }
  target['box-shadow'] = authoredRef;
  ctx.notes.push(
    `${where}: unbound DROP_SHADOW stack recovers the stamped contract's ${authoredRef} (same resolved layers), not a dump-slug mint (FC-DUMP-PROPOSE-SHADOW-MINTED)`,
  );
  return true;
};

/** VISIBLE effects (dump v1.2; MULTI-LAYER since gap round 4). DROP_SHADOW
 *  layers — one or many — present in EVERY variant become an unbound report +
 *  (with minting) a `box-shadow` shadow-kind mint whose value is the layers
 *  comma-joined in dump order (enum correlation handled by the classifier).
 *  CSS takes a comma-separated shadow list natively, and the canvas emitter's
 *  stack grammar (parseShadowStack, emit-figma-script) projects EVERY layer
 *  back as its own native DROP_SHADOW — so neither direction truncates.
 *  Field case: Untitled UI's Tooltip draws its only visible edge with a
 *  two-layer stack (0/4/6/-2 black 3% + 0/12/16/-4 black 8%); the old
 *  single-layer rule refused the pair, so the light-theme bubble rendered
 *  white-on-white with no edge at all — the correct value was NAMED and the
 *  drawing was wrong. Anything else — inner shadows, blurs, mixed kinds,
 *  partial presence across variants (a node shadowed in some variants and
 *  bare in others: "absent" would have to be read as `none`, which no
 *  observation states) — is still a NAMED note carrying the effect types: the
 *  channel never drops silently. The canvas preview has no box-shadow
 *  projection in v1; that limit is named here at proposal (the minted
 *  preamble also skips shadow-typed leaves). */
/** dump v1.31 — the two effect facts beside the effect GEOMETRY, named
 *  wherever effects are read (box parts, text parts, instances, the root):
 *    · the EFFECT STYLE identity (effectStyle / effectStyleKey) — the
 *      canvas's own name for the stack (the way text.style names a
 *      TextStyle). There is no effect-style token class to mint into, so the
 *      name carries as PROVENANCE in the note; the resolved layers still
 *      carry as box-shadow. Phase 2 exam: 53:3846 "shadow/md" on every hover
 *      root, silent.
 *    · per-channel VARIABLE BINDINGS on an effect (effects[].bound) — a
 *      box-shadow is ONE token in the contract grammar, so five bindings
 *      (radius/spread/color/offsetX/offsetY) have no carrier; the literal
 *      stack carries and the bindings are NAMED as the rename targets. */
function nameEffectProvenance(m: Merged, ctx: Ctx, where: string): void {
  const styles = new Map<string, { key?: string; variants: string[] }>();
  for (const o of m.occ) {
    const name = o.node.effectStyle;
    if (name === undefined) continue;
    const rec = styles.get(name) ?? { key: o.node.effectStyleKey, variants: [] };
    rec.variants.push(o.variant);
    styles.set(name, rec);
  }
  for (const [name, rec] of styles) {
    ctx.notes.push(
      `${where}: effects ride the EFFECT STYLE "${name}"${rec.key ? ` (key ${rec.key})` : ''} in ${rec.variants.length}/${m.occ.length} variant(s) (dump v1.31 effectStyle) — the style's resolved layers carry as box-shadow; the style IDENTITY has no token class in the contract grammar (text styles mint under imported.text.<style>, effect styles do not yet), so it is carried here as provenance — the rename target for the minted shadow`,
    );
  }
  const bindings = new Map<string, string[]>();
  for (const o of m.occ) {
    for (const e of o.node.effects ?? []) {
      for (const [channel, variable] of Object.entries(e.bound ?? {})) {
        const key = `${e.type} ${channel}={${variable}}`;
        bindings.set(key, [...(bindings.get(key) ?? []), o.variant]);
      }
    }
  }
  if (bindings.size > 0) {
    ctx.notes.push(
      `${where}: effect channel(s) bound to variables (dump v1.31 effects[].bound): ${[...bindings].map(([k, vs]) => `${k} (${vs.length}/${m.occ.length} variant(s))`).join('; ')} — a box-shadow is ONE token in the contract grammar, so per-channel effect bindings have no carrier; the resolved stack carries at literal fidelity and these variable names are the rename targets — NAMED, not bound`,
    );
  }
}

function invertNodeEffects(m: Merged, tokens: Record<string, string>, ctx: Ctx, where: string) {
  nameEffectProvenance(m, ctx, where); // dump v1.31 — style identity + channel bindings, never silent
  if (m.occ.every((o) => (o.node.effects?.length ?? 0) === 0)) return;
  const kinds = [...new Set(m.occ.flatMap((o) => (o.node.effects ?? []).map((e) => e.type)))];
  const dropShadowStackEverywhere = m.occ.every((o) => {
    const eff = o.node.effects ?? [];
    return eff.length >= 1 && eff.every((e) => e.type === 'DROP_SHADOW');
  });
  if (!dropShadowStackEverywhere) {
    // State-preview DROP_SHADOW (Button Active / Focus Visible) is a
    // default-bare / state-drawn stack — the same split hover fill uses.
    // invertNodeEffects used to NAME that as "not proposed" because
    // "absent would have to be none". The state-diff door now owns it
    // (FC-DUMP-PROPOSE-STATE-SHADOW). Uncorrelated partial presence still
    // names.
    const withFx = m.occ.filter((o) => (o.node.effects?.length ?? 0) > 0);
    const withoutFx = m.occ.filter((o) => (o.node.effects?.length ?? 0) === 0);
    const rawState = (variant: string): string | undefined => {
      const av = axisValuesOf(variant);
      return av.State ?? av.state ?? av.STATE;
    };
    const isDefaultState = (variant: string): boolean => {
      const raw = rawState(variant);
      return raw === undefined || INTERACTION_STATE_BY_VALUE[normStateValue(raw)] === 'default';
    };
    if (
      withFx.length > 0 &&
      withoutFx.length > 0 &&
      withFx.every((o) => !isDefaultState(o.variant)) &&
      withoutFx.every((o) => isDefaultState(o.variant))
    ) {
      return;
    }
    ctx.notes.push(
      `${where}: visible effect(s) [${kinds.join(', ')}] — only DROP_SHADOW layers present in every variant map to box-shadow (dump v1.2; a multi-layer stack carries comma-separated); channel NAMED, not proposed`,
    );
    return;
  }
  const occ = m.occ.map((o) => ({ variant: o.variant, value: o.node.effects!.map(shadowCss).join(', ') }));
  const depth = Math.max(...m.occ.map((o) => (o.node.effects ?? []).length));
  reportUnbound(ctx, where, 'effects', occ[0].value);
  const authoredShadow = authoredPartAt(ctx, partPathOf(where))?.tokens?.['box-shadow'];
  if (!recoverAuthoredBoxShadow(ctx, tokens, where, authoredShadow, occ)) {
    mintObservation(ctx, tokens, where, 'box-shadow', 'shadow', occ, `${where}|effects`);
  }
  ctx.notes.push(
    `${where}: ${depth > 1 ? `a DROP_SHADOW stack (up to ${depth} layers) proposed as a comma-separated box-shadow value` : 'DROP_SHADOW proposed as a box-shadow value'} (dump v1.2) — CSS surfaces render it; the canvas preview and the Figma sync script project it as a native DROP_SHADOW effect (dump v1.3)`,
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

/** Unbound hex/width on a dump v1.3 decor shape (ToggleSwitch thumb) belongs
 *  in the shape-part literals grammar — same as placement offsets — not a
 *  dump-slug mint. Bound paints stay tokens. Uncorrelated variance keeps
 *  the mint. FC-DUMP-PROPOSE-SHAPE-PAINT. */
function liftUnboundShapePaintsToLiterals(
  m: Merged,
  part: Record<string, unknown>,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
) {
  // A set this pipeline did NOT draw keeps the Path A contract: every raw
  // literal is MINTED by usage site (zero UNBOUND leftovers, the minted leaf
  // resolves to the dump's value). The literal recovery below is the
  // stamped-set door only (FC-DUMP-PROPOSE-SHAPE-PAINT was cut for the
  // ToggleSwitch thumb this pipeline drew); on a foreign dump it turned the
  // Tooltip pointer's minted fill into a literal and left the `fill`
  // UNBOUND entry behind.
  if (!ctx.drawnByThisPipeline) return;
  const unboundProperty: Record<string, string> = {
    'background-color': 'fill',
    'border-color': 'stroke',
    'border-width': 'strokeWeight',
  };
  const lift = (
    cssProp: string,
    pick: (n: DumpNode) => string | undefined,
    bound: (n: DumpNode) => boolean,
  ) => {
    if (m.occ.some((o) => bound(o.node) || pick(o.node) === undefined)) return;
    const queued = ctx.mint?.observations.some((o) => o.nodePath === where && o.cssProperty === cssProp);
    if (tokens[cssProp] === undefined && !queued) return;
    const values = m.occ.map((o) => ({ variant: o.variant, value: pick(o.node)! }));
    const distinct = [...new Set(values.map((v) => v.value))];
    const writeLiteral = (target: Record<string, string>) => {
      target[cssProp] = distinct[0]!;
    };
    if (distinct.length === 1) {
      const literals = (part.literals as Record<string, string> | undefined) ?? {};
      writeLiteral(literals);
      part.literals = literals;
    } else {
      let axisFit: { propName: string; map: Record<string, Record<string, string>> } | null = null;
      for (const axis of ctx.axes) {
        if (isBoolAxis(axis.values)) continue;
        const byValue = new Map<string, string>();
        let fits = true;
        for (const row of values) {
          const value = axisValuesOf(row.variant)[axis.property];
          if (value === undefined) {
            fits = false;
            break;
          }
          const seen = byValue.get(value);
          if (seen && seen !== row.value) {
            fits = false;
            break;
          }
          if (!seen) byValue.set(value, row.value);
        }
        if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
        if (new Set(byValue.values()).size < 2) continue;
        const map: Record<string, Record<string, string>> = {};
        for (const value of axis.values) map[camel(value)] = { [cssProp]: byValue.get(value)! };
        axisFit = { propName: axis.propName, map };
        break;
      }
      if (!axisFit) return;
      const lbp =
        (part.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | undefined) ?? [];
      let entry = lbp.find((e) => e.prop === axisFit.propName);
      if (!entry) {
        entry = { prop: axisFit.propName, map: {} };
        lbp.push(entry);
      }
      for (const [value, dims] of Object.entries(axisFit.map)) {
        entry.map[value] = { ...(entry.map[value] ?? {}), ...dims };
      }
      part.literalsByProp = lbp;
    }
    delete tokens[cssProp];
    if (ctx.mint) {
      ctx.mint.observations = ctx.mint.observations.filter(
        (o) => !(o.nodePath === where && o.cssProperty === cssProp),
      );
    }
    // Carried as a literal — no longer an UNBOUND leftover.
    ctx.unbound = ctx.unbound.filter((u) => !(u.nodePath === where && u.property === unboundProperty[cssProp]));
    ctx.notes.push(
      `${where}: unbound ${cssProp} on a dump v1.3 shape part carried as ${distinct.length === 1 ? 'literal' : 'literalsByProp'}, not a dump-slug mint`,
    );
  };
  lift(
    'background-color',
    (n) => (n.fill?.hex !== undefined && n.fill.var === undefined ? paintCssHex(n.fill) : undefined),
    (n) => n.fill?.var !== undefined,
  );
  lift(
    'border-color',
    (n) => (n.stroke?.hex !== undefined && n.stroke.var === undefined ? paintCssHex(n.stroke) : undefined),
    (n) => n.stroke?.var !== undefined,
  );
  lift(
    'border-width',
    (n) => (typeof n.strokeWeight === 'number' ? `${n.strokeWeight}px` : undefined),
    (n) => n.bound?.strokeWeight !== undefined,
  );
}

/** FC-DUMP-PROPOSE-TEXT-PAINT — unbound TEXT fill.hex (Card label-text
 *  `#000000`) used to mint a dump-slug. Same class as
 *  `liftUnboundShapePaintsToLiterals`: the canvas did not stamp a variable. */
function liftUnboundTextPaintsToLiterals(
  m: Merged,
  part: Record<string, unknown>,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
) {
  // Stamped-set door only — a foreign dump's unbound text fill is MINTED by
  // usage site (Path A: zero UNBOUND leftovers, `text color minted by usage
  // site`); see liftUnboundShapePaintsToLiterals.
  if (!ctx.drawnByThisPipeline) return;
  const pick = (n: DumpNode): string | undefined => {
    const paint = n.text?.fillVar ? { var: n.text.fillVar } : n.fill;
    if (paint?.hex !== undefined && paint.var === undefined) return paintCssHex(paint);
    return undefined;
  };
  if (m.occ.some((o) => pick(o.node) === undefined || o.node.text?.fillVar !== undefined || o.node.fill?.var !== undefined)) {
    return;
  }
  const queued = ctx.mint?.observations.some((o) => o.nodePath === where && o.cssProperty === 'color');
  if (tokens.color === undefined && !queued) return;
  const values = m.occ.map((o) => pick(o.node)!);
  const distinct = [...new Set(values)];
  if (distinct.length !== 1) return;
  const literals = (part.literals as Record<string, string> | undefined) ?? {};
  literals.color = distinct[0]!;
  part.literals = literals;
  delete tokens.color;
  if (ctx.mint) {
    ctx.mint.observations = ctx.mint.observations.filter(
      (o) => !(o.nodePath === where && o.cssProperty === 'color'),
    );
  }
  // Carried as a literal — no longer an UNBOUND leftover.
  ctx.unbound = ctx.unbound.filter((u) => !(u.nodePath === where && u.property === 'text fill'));
  ctx.notes.push(
    `${where}: unbound color on a TEXT node carried as literal, not a dump-slug mint`,
  );
}

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
    // Overlay-flattened class (round 2 iteration 2): a node that is a
    // parametric shape in SOME variants and an arbitrary-path node in others
    // (Progress circle's Background: ELLIPSE when Circle, VECTOR when Half
    // circle) used to refuse outright — and the part rendered as a naked
    // border box. The captured subset is real observation: carry it with the
    // SAME first-variant-freeze discipline the size mismatch already uses,
    // and NAME the approximation (the shapeless variants render the carried
    // shape — a declared limit, exact where the shape was drawn).
    ctx.notes.push(
      `${where}: shape geometry captured in ${withShape.length}/${m.occ.length} variants (the rest are arbitrary-path nodes) — the CAPTURED variants' shape is carried; the uncaptured variants render the same shape (declared approximation, review)`,
    );
    const sub: Merged = { ...m, occ: withShape };
    invertNodeShape(sub, part, ctx, where);
    return;
  }
  const shapes = m.occ.map((o) => ({ variant: o.variant, hidden: o.node.hidden === true, sh: o.node.shape! }));
  const kinds = [...new Set(shapes.map((s) => s.sh.kind))];
  if (kinds.length > 1) {
    ctx.notes.push(`${where}: shape kind differs across variants (${kinds.join(', ')}) — shape not carried; review`);
    return;
  }
  const first = shapes[0].sh;
  // dump v1.7 ellipse arc (round 2 iteration 4): the sweep IS carried.
  // Grammar (mirrors the rotation discipline below):
  //   full sweep (≥ 2π)          → dropped as redundant (the plain ellipse);
  //   constant partial sweep     → shape.arc (shapeCssDecls' conic-gradient
  //                                mask; the Figma generator sets arcData);
  //   axis-correlated sweep      → per-value stylesWhen `mask` (arcMaskCss,
  //                                the ONE spelling) via the placement
  //                                machinery below;
  //   anything else              → NAMED, never guessed. innerRadius < 1 (a
  //                                filled donut hole) is NAMED — the observed
  //                                class is 1, a pure stroked ring whose hole
  //                                the border-drawn ring already leaves.
  const TAU = Math.PI * 2;
  const arcOf = (sh: NonNullable<DumpNode['shape']>) =>
    sh.kind === 'ellipse' && sh.arc !== undefined && sh.arc.end - sh.arc.start > 0 && sh.arc.end - sh.arc.start < TAU - 0.01
      ? sh.arc
      : undefined;
  const anyArcCaptured = shapes.some((s) => s.sh.arc !== undefined);
  const partialArcs = shapes.map((s) => arcOf(s.sh));
  const anyArc = partialArcs.some((a) => a !== undefined);
  const arcVaries = anyArc && new Set(partialArcs.map((a) => (a ? `${a.start}|${a.end}` : 'none'))).size > 1;
  if (anyArcCaptured) {
    if (shapes.some((s) => s.sh.arc !== undefined && arcOf(s.sh) === undefined && s.sh.arc.end - s.sh.arc.start >= TAU - 0.01)) {
      ctx.notes.push(
        `${where}: ellipse arc with a FULL sweep (≥ 2π — dump v1.7 \`shape.arc\`) — redundant with the plain ellipse, dropped`,
      );
    }
    if (shapes.some((s) => s.sh.kind !== 'ellipse' && s.sh.arc !== undefined)) {
      ctx.notes.push(`${where}: arc captured on a non-ellipse shape — outside the arc grammar, NOT carried; review`);
    }
    if (shapes.some((s) => s.sh.arc !== undefined && s.sh.arc.end - s.sh.arc.start <= 0)) {
      ctx.notes.push(`${where}: arc with a non-positive sweep (end ≤ start) — outside the arc grammar, NOT carried; review`);
    }
    if (shapes.some((s) => arcOf(s.sh) !== undefined && arcOf(s.sh)!.innerRadius !== 1)) {
      ctx.notes.push(
        `${where}: arc innerRadius < 1 (a filled donut hole) — the hole fraction is NOT carried (code renders the sweep mask only; the observed ring class is border-drawn); review`,
      );
    }
    if (anyArc) {
      ctx.notes.push(
        `${where}: arc ends render square (CSS hard color stops) — stroke cap style is not on the dump surface; a canvas ROUND cap is a named residue`,
      );
    }
  }
  const shape: Record<string, unknown> = { kind: first.kind, width: first.width, height: first.height };
  if (anyArc && !arcVaries && partialArcs.every((a) => a !== undefined)) {
    const a = partialArcs[0]!;
    shape.arc = { start: a.start, end: a.end, innerRadius: a.innerRadius };
    ctx.notes.push(
      `${where}: constant ellipse arc sweep carried as shape.arc ({${a.start}, ${a.end}} rad — dump v1.7) — code surfaces render a conic-gradient mask; the Figma generator sets native arcData`,
    );
  }
  const sizes = [...new Set(shapes.map((s) => `${s.sh.width}×${s.sh.height}`))];
  // Size-varying parametric decor (ToggleSwitch thumb: 16/20/24 on Sizing)
  // used to freeze the first variant and NAME the rest. Placement already
  // classifies onto one enum axis (Checked left/right); size is a second
  // observed function of a different axis and belongs in the existing
  // literalsByProp vocabulary — same as fill-width / refused-channel
  // projection. Uncorrelated size still freezes + names.
  let sizeByAxis: { propName: string; map: Record<string, { width: string; height: string }> } | null = null;
  if (sizes.length > 1) {
    for (const axis of ctx.axes) {
      if (isBoolAxis(axis.values)) continue;
      const byValue = new Map<string, { width: number; height: number }>();
      let fits = true;
      for (const s of shapes) {
        const value = axisValuesOf(s.variant)[axis.property];
        if (value === undefined) {
          fits = false;
          break;
        }
        const seen = byValue.get(value);
        if (seen && (seen.width !== s.sh.width || seen.height !== s.sh.height)) {
          fits = false;
          break;
        }
        if (!seen) byValue.set(value, { width: s.sh.width, height: s.sh.height });
      }
      if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
      if (new Set([...byValue.values()].map((d) => `${d.width}×${d.height}`)).size < 2) continue;
      const map: Record<string, { width: string; height: string }> = {};
      for (const value of axis.values) {
        const d = byValue.get(value)!;
        map[camel(value)] = { width: `${d.width}px`, height: `${d.height}px` };
      }
      sizeByAxis = { propName: axis.propName, map };
      break;
    }
    if (!sizeByAxis) {
      ctx.notes.push(
        `${where}: shape size differs across variants (${sizes.join(', ')}) — the first variant's ${sizes[0]} carried; review`,
      );
    }
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
  if (sizeByAxis) {
    const lbp =
      (part.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | undefined) ?? [];
    let entry = lbp.find((e) => e.prop === sizeByAxis.propName);
    if (!entry) {
      entry = { prop: sizeByAxis.propName, map: {} };
      lbp.push(entry);
    }
    for (const [value, dims] of Object.entries(sizeByAxis.map)) {
      entry.map[value] = { ...(entry.map[value] ?? {}), ...dims };
    }
    part.literalsByProp = lbp;
    ctx.notes.push(
      `${where}: shape size varies with \`${sizeByAxis.propName}\` (${sizes.join(', ')}) — carried as literalsByProp, not first-variant freeze`,
    );
  }

  // Placement (+ varying rotation, + varying arc sweep): must be a function
  // of ONE enum axis with per-value consistency — or uniform (then it rides
  // the part's boolean visibleWhen condition). Axis values whose variants are
  // ALL hidden get no entry (nothing renders there).
  const maskOf = (s: (typeof shapes)[number]): string | null => {
    const a = arcOf(s.sh);
    return a ? arcMaskCss(a.start, a.end) : null;
  };
  const specOf = (s: (typeof shapes)[number]): string => {
    const p = shapePlacementOf(s.sh);
    return JSON.stringify({
      p: p?.styles ?? null,
      t: p?.translate ?? [],
      r: rotationVaries ? (s.sh.rotation ?? 0) : 0,
      a: arcVaries ? maskOf(s) : null,
    });
  };
  const anyPlacement = shapes.some((s) => shapePlacementOf(s.sh) !== null);
  if (!anyPlacement && !rotationVaries && !arcVaries) return; // in-flow, constant rotation/arc — done
  const buildStyles = (s: (typeof shapes)[number]): Record<string, string> | null => {
    const p = shapePlacementOf(s.sh);
    const transform: string[] = [...(p?.translate ?? [])];
    if (rotationVaries && (s.sh.rotation ?? 0) !== 0) transform.push(`rotate(${s.sh.rotation}deg)`);
    const styles: Record<string, string> = { ...(p?.styles ?? {}) };
    if (arcVaries) {
      const mask = maskOf(s);
      if (mask) styles.mask = mask; // full-sweep values carry no mask — the plain ring
    }
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
      `${where}: ${kinds[0]} decor carried as a shape part (${String(shape.width)}×${String(shape.height)}${shape.sides !== undefined ? `, ${String(shape.sides)} sides` : ''}) with per-variant absolute placement${rotationVaries ? ' + rotation' : ''}${arcVaries ? ' + arc sweep (conic-gradient mask)' : ''} as stylesWhen on \`${axis.propName}\` (${emitted} placement(s)${suppressed > 0 ? `; ${suppressed} value(s) where the shape is hidden in every drawn variant carry display: none` : ''}; offsets EXACT from the captured boxes — dump v1.3, #42)`,
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
      // Overlay-flattened class (round 2 iteration 2): UNCONDITIONAL uniform
      // placement — previously "NAMED, not proposed" because stylesWhen is
      // conditional vocabulary. Px-spelled offsets now carry as the standard
      // positioned-part spelling (declared position: absolute + literal
      // offsets — the Carbon decor-box precedent). CENTER's 50%+translate
      // spelling stays outside the literal grammar and keeps the named
      // refusal.
      const pxSafe = Object.entries(styles).every(
        ([k, v]) => k === 'position' || (['left', 'right', 'top', 'bottom'].includes(k) && /^-?\d+(\.\d+)?px$/.test(v)),
      );
      if (pxSafe) {
        const declared = (part.declared as Record<string, string> | undefined) ?? {};
        if (declared.position === undefined) declared.position = 'absolute';
        part.declared = declared;
        const literals = (part.literals as Record<string, string> | undefined) ?? {};
        for (const [k, v] of Object.entries(styles)) {
          if (k !== 'position' && literals[k] === undefined) literals[k] = v;
        }
        part.literals = literals;
        ctx.notes.push(
          `${where}: uniform unconditional absolute placement carried as position: absolute + literal offsets (${Object.entries(styles).filter(([k]) => k !== 'position').map(([k, v]) => `${k}: ${v}`).join(', ')}) — the overlay-flattened spelling (round 2 iteration 2)`,
        );
      } else {
        ctx.notes.push(
          `${where}: absolute placement is uniform across variants but rides spellings outside the literal grammar (50% + translate / rotation) — placement NAMED, not proposed (${JSON.stringify(styles)}); review`,
        );
      }
    }
    return;
  }
  ctx.notes.push(
    `${where}: shape placement/rotation${arcVaries ? '/arc' : ''} differs across variants without correlating to any enum axis — NAMED, not proposed; review`,
  );
}

/** dump v1.7 plain rect: an UNROTATED RECTANGLE captured because nothing else
 *  carries its size (parent not auto-layout, or ABSOLUTE). It is an ordinary
 *  box, not parametric decor — true only when EVERY occurrence agrees (a
 *  rotated or partially-captured rect keeps the decor-shape path's own
 *  refusal discipline). */
const isPlainRectShape = (m: Merged): boolean =>
  m.occ.every(
    (o) =>
      o.node.shape !== undefined &&
      o.node.shape.kind === 'rect' &&
      (o.node.shape.rotation === undefined || o.node.shape.rotation === 0),
  );

/** Carry dump v1.7 plain-rect geometry as ordinary width/height channels —
 *  mint observations exactly like every other literal channel, so a size
 *  that varies by variant classifies per axis value (or refuses BY NAME
 *  through the standard classifier). Fill/radius already ride the existing
 *  fill/cornerRadius channels; placement (x/y/right/bottom) is LEDGERED by
 *  name this round — absolute rendering is a later iteration. Field case:
 *  Untitled UI slider/progress tracks, which collapsed to 0×0. */
function mintPlainRectGeometry(m: Merged, part: Record<string, unknown>, tokens: Record<string, string>, ctx: Ctx, where: string) {
  const shapes = m.occ.map((o) => ({ variant: o.variant, sh: o.node.shape! }));
  const sizes = [...new Set(shapes.map((s) => `${s.sh.width}×${s.sh.height}`))];
  if (!ctx.mint) {
    ctx.notes.push(
      `${where}: plain-rect geometry captured (${sizes.join(', ')}px — dump v1.7) but minting is off — width/height not proposed; bind the drawn size manually`,
    );
  } else {
    for (const dim of ['width', 'height'] as const) {
      // A dimension already carried (bound variable, or an earlier channel)
      // is the design's own binding — the literal never overrides it.
      if (tokens[dim] !== undefined || m.occ.some((o) => o.node.bound?.[dim])) continue;
      mintObservation(
        ctx,
        tokens,
        where,
        dim,
        'px',
        m.occ.map((o) => ({ variant: o.variant, value: Math.round(o.node.shape![dim] * 100) / 100 })),
        undefined,
        // Presence-shaped coverage — same '0' fill as carryAbsPlacement: a
        // subset-present part never renders at the unobserved axis values
        // (visibleWhen) or is already a NAMED lesser error; 0 draws nothing.
        m.occ.length < ctx.totalVariants.length ? '0' : undefined,
      );
      // Base-combo literal fallback on classification refusal — the same
      // discipline as the abs-placement channels (applied + named in the
      // mint pass).
      ctx.mint.absFallbacks.push({
        part, tokens, chan: dim,
        value: Math.round(m.occ[0].node.shape![dim] * 100) / 100,
        where,
      });
    }
    ctx.notes.push(
      `${where}: plain-rect geometry (dump v1.7) carried as width/height mint observations (${sizes.join('; ')}px) — an in-flow fixed-size box; fill/radius ride the existing channels`,
    );
  }
  // Placement (shape.x/y/right/bottom on ABSOLUTE rects) rides the SAME
  // overlay carrier every abs-bearing node uses — carryAbsPlacement (round 2
  // iteration 2); the caller invokes it with the shared tokens record.
}

/** dump v1.8 `fixedSize` (round 2 iteration 6): the drawn box of an IN-FLOW
 *  non-auto-layout child of an AUTO-layout parent whose layoutSizing is
 *  FIXED — the one class NO other size channel touches (`layout` needs
 *  auto-layout on the node, `abs` needs ABSOLUTE or a non-auto parent,
 *  `shape` is parametric decor, `bbox` is roots/stubs). Field case: the UUI
 *  tooltip arrow strip (16×6, 6×16 when rotated for Left/Right) captured
 *  NOTHING, collapsed to a 0-size anchor, and the absolutely-placed arrow
 *  overlaid the bubble's text. Minted exactly like plain-rect geometry:
 *  per-variant width/height observations through the standard classifier,
 *  base-combo literal fallback on refusal, presence-shaped '0' fill for
 *  subset-present parts. A dimension already carried (bound variable or an
 *  earlier channel) is never overridden. Absent field — exact no-op. */
/** PHASE 2 EXAM (rest-child-frame-fixed-size; Button (contract) 20×20
 *  slot-before/slot-after/icon ×60, Card Inline Image 308px): an AUTO-LAYOUT
 *  child FRAME/SLOT drawn FIXED on an axis carries `layout.primarySizing /
 *  counterSizing: FIXED` (both readers) but NO box — `fixedSize` (dump v1.8)
 *  is captured for non-auto-layout children only, `bbox` rides roots and
 *  instances, `abs` rides out-of-flow nodes. The drawn px is environment-
 *  dependent child geometry this pipeline deliberately does not read back
 *  or mint — Option B, FC-GEOMETRY-EXCLUDED (parity/receipts/beta/
 *  KIT-CLIMB.md) — so the part sizes to content. That was SILENT; it is a
 *  receipt now, with the code. A FILL axis (fillWidth/fillHeight) is spelled
 *  FIXED by Figma too and is excluded (it is carried as grow/stretch). */
function nameFixedChildGeometry(m: Merged, ctx: Ctx, where: string): void {
  const dims: string[] = [];
  for (const dim of ['width', 'height'] as const) {
    // FIXED by the auto-layout sizing MODE, or a producer's `fixedSize` on an
    // auto-layout node (the plugin writes fixedSize for non-auto-layout
    // children only, where mintFixedSize mints it; on an auto-layout node it
    // is the same excluded geometry, and the drawn px joins the receipt).
    const fillField = dim === 'width' ? 'fillWidth' : 'fillHeight';
    const fixedIn = m.occ.filter((o) => {
      const l = o.node.layout;
      if (!l) return false;
      // PER-VARIANT accounting (canvas conformance slot-fixed-width-by-
      // variant, Phase 2 exam: Card:Variant=Inline/Container/Image). A FILL
      // axis is spelled FIXED by Figma's sizing mode too and is a different
      // fact (grow/stretch) on THAT occurrence — so the occurrence that
      // fills is excluded here, and an occurrence that is FIXED stays FIXED
      // however the same child sizes in the other variants. The old door
      // skipped the whole axis when ANY occurrence filled, so a 308px FIXED
      // Inline Image under a FILL Default Image got no receipt at all.
      if (o.node[fillField] === true) return false;
      if (o.node.fixedSize?.[dim] !== undefined) return true;
      const primaryIsWidth = l.mode !== 'VERTICAL'; // HORIZONTAL and GRID (GP1b)
      const mode = (dim === 'width') === primaryIsWidth ? l.primarySizing : l.counterSizing;
      return mode === 'FIXED';
    });
    if (fixedIn.length === 0) continue;
    if (
      m.occ.some(
        (o) =>
          o.node.bound?.[dim] !== undefined ||
          (o.node.layout === undefined && o.node.fixedSize?.[dim] !== undefined) ||
          o.node.abs !== undefined ||
          o.node.bbox !== undefined,
      )
    ) {
      continue; // a carrier exists — the size channels speak for it
    }
    const drawn = [...new Set(fixedIn.map((o) => o.node.fixedSize?.[dim]).filter((v): v is number => typeof v === 'number'))];
    // The variants where the same child FILLS instead are named beside the
    // FIXED ones, so the receipt says which variant it is about.
    const fillIn = m.occ.filter((o) => o.node[fillField] === true);
    const byVariant =
      fillIn.length > 0
        ? ` — FIXED on ${fixedIn.map((o) => o.variant).join(', ')}; FILL on ${fillIn.map((o) => o.variant).join(', ')} (a different fact on those variants)`
        : '';
    dims.push(`${dim} (FIXED in ${fixedIn.length}/${m.occ.length} variant occurrence(s)${byVariant}${drawn.length > 0 ? `; drawn ${drawn.join('/')}px` : ''})`);
  }
  if (dims.length === 0) return;
  ctx.notes.push(
    `${where}: auto-layout ${m.type} child drawn FIXED on ${dims.join(' and ')} with no bound size variable — FC-GEOMETRY-EXCLUDED (Option B): a child's drawn px is environment-dependent geometry this pipeline does not read back or mint, so the part sizes to its content and the drawn size is NOT carried; NAMED (bind the size to a variable, or declare width/height on this part in the contract, to carry it)`,
  );
}

function mintFixedSize(m: Merged, part: Record<string, unknown>, tokens: Record<string, string>, ctx: Ctx, where: string) {
  const withFixed = m.occ.filter((o) => o.node.fixedSize !== undefined);
  if (withFixed.length === 0) return;
  // A producer that writes `fixedSize` on an AUTO-LAYOUT node (the plugin
  // never does — dump v1.8 is non-auto-layout children only) is describing
  // exactly the geometry nameFixedChildGeometry excludes and receipts (every
  // branch that reaches here calls it); it is not minted.
  if (withFixed.some((o) => o.node.layout !== undefined)) return;
  const sparse = m.occ.length < ctx.totalVariants.length ? '0' : undefined;
  const carried: string[] = [];
  for (const dim of ['width', 'height'] as const) {
    const vals = m.occ.map((o) => o.node.fixedSize?.[dim]);
    if (vals.every((v) => v === undefined)) continue;
    if (tokens[dim] !== undefined || m.occ.some((o) => o.node.bound?.[dim])) continue;
    if (vals.some((v) => v === undefined)) {
      ctx.notes.push(
        `${where}: fixed in-flow ${dim} captured in ${vals.filter((v) => v !== undefined).length}/${m.occ.length} variant occurrence(s) only (mixed sizing modes across variants) — not carried; review`,
      );
      continue;
    }
    if (!ctx.mint) {
      ctx.notes.push(
        `${where}: fixed in-flow ${dim} captured (dump v1.8 \`fixedSize\`) but minting is off — not proposed; bind the drawn size manually`,
      );
      continue;
    }
    mintObservation(
      ctx, tokens, where, dim, 'px',
      m.occ.map((o) => ({ variant: o.variant, value: o.node.fixedSize![dim]! })),
      `${where}|fixed-${dim}`,
      sparse,
    );
    ctx.mint.absFallbacks.push({ part, tokens, chan: dim, value: m.occ[0].node.fixedSize![dim]!, where });
    carried.push(dim);
  }
  if (carried.length > 0) {
    ctx.notes.push(
      `${where}: fixed-size in-flow box (dump v1.8 \`fixedSize\`) carried as ${carried.join('/')} mint observation(s) — the drawn box of a non-auto-layout child inside auto-layout, which no other channel carries; per-variant values classify through the standard mint machinery`,
    );
  }
}

// ---------------------------------------------------------------------------
// Overlay-flattened class (round 2 iteration 2, dump v1.7 `abs`): absolute
// placement carried into the EXISTING vocabulary — no new schema fields.
// A positioned part declares `position: absolute` (DECLARED_CHANNELS) and its
// offsets/size ride the top/right/bottom/left/width/height TOKEN channels as
// minted px observations — per-axis-conditioned through the standard mint
// machinery exactly like every other captured literal. The parent side
// (`position: relative`) is declared by the caller only when at least one
// child actually carried.
//
// DETERMINISTIC OFFSET SPELLING (general rules, documented here):
//   horizontal  RIGHT → `right: <right>px`; LEFT/CENTER/absent → `left: <x>px`.
//               A CENTER whose drawn box is off-center (a value-tracking
//               tooltip) keeps the exact per-variant offset — center-tracking
//               under parent RESIZE is not carried (named).
//   vertical    BOTTOM → `bottom: <bottom>px`; TOP/CENTER/absent → `top: <y>px`.
//   size        width/height minted from the abs box (skipped when the channel
//               already carries a binding). TEXT parts never bake abs
//               width/height — text boxes hug. A HORIZONTALLY SYMMETRIC text
//               box (|x − right| ≤ 1px in every variant) pins BOTH edges and
//               declares `text-align: center` instead — the center-preserving
//               spelling: glyphs stay centered even when DOM text metrics
//               differ from the canvas measurement.
// REFUSALS (BY NAME, the part renders in flow): partial capture (abs on a
// strict subset of variants), mixed constraints across variants, constraints
// outside LEFT/RIGHT/CENTER × TOP/BOTTOM/CENTER (SCALE/stretch), and mint-off
// runs (the per-variant px offsets have no carrier without minting).
// ---------------------------------------------------------------------------

type AbsBox = NonNullable<DumpNode['abs']>;

/** The node's absolute box: dump v1.7 `abs` (all node types), else the
 *  DumpShape placement fields (ABSOLUTE decor/plain rects — same
 *  center-preserving spelling). */
const absBoxOf = (n: DumpNode): AbsBox | undefined => {
  if (n.abs) return n.abs;
  const sh = n.shape;
  if (sh && sh.x !== undefined && sh.y !== undefined && sh.right !== undefined && sh.bottom !== undefined) {
    return { x: sh.x, y: sh.y, right: sh.right, bottom: sh.bottom, width: sh.width, height: sh.height, constraints: sh.constraints };
  }
  return undefined;
};

function carryAbsPlacement(
  m: Merged,
  part: Record<string, unknown>,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
  opts: { text?: boolean; size?: boolean } = {},
): boolean {
  const boxes = m.occ.map((o) => ({ variant: o.variant, box: absBoxOf(o.node) }));
  if (boxes.every((b) => b.box === undefined)) return false;
  const ledger = (why: string): false => {
    ctx.notes.push(
      `${where}: absolute placement captured (dump v1.7 \`abs\`) but NOT carried — ${why}; the part renders in flow (ledgered by name)`,
    );
    return false;
  };
  const withBox = boxes.filter((b) => b.box !== undefined);
  if (withBox.length !== boxes.length) {
    return ledger(
      `captured on ${withBox.length}/${boxes.length} variant(s) only (a per-variant in-flow/absolute identity mix has no single spelling)`,
    );
  }
  // A wrapper-union SYNTHETIC clone is not an observation: its abs box was
  // copied from another variant's real wrapper, and its members' offsets mix
  // reference frames (root-frame where drawn flat, wrapper-frame where
  // nested). The clone-bearing part stays a plain pass-through box — its
  // children position against the nearest REAL positioned ancestor.
  if (m.occ.some((o) => (o.node as { __synthetic?: boolean }).__synthetic === true)) {
    return ledger(
      'the box rides a wrapper-union SYNTHETIC clone (a clone is not an observation) — the wrapper stays a pass-through in-flow box',
    );
  }
  if (!ctx.mint) return ledger('minting is off — the per-variant px offsets have no carrier');
  // THE ABSENT-CONSTRAINTS ASSUMPTION, NAMED. `?? 'LEFT'` / `?? 'TOP'` is a
  // guess, and until dump v1.13 it was a guess the capture MADE UNAVOIDABLE:
  // both dump sites mapped only MIN/MAX/CENTER, so a STRETCH or SCALE node had
  // its whole `constraints` field dropped and arrived here indistinguishable
  // from a genuine top-left pin. This does not lose a fact, it SUBSTITUTES one
  // — the part then bakes confident pinned-top-left geometry.
  //
  // MEASURED: of 811 absBoxOf-visible boxes across the committed dumps, 352
  // carry NO constraints field (354 including GROUP, which has no such property
  // at all). Untitled UI's `Progress circle/Ring` is the candidate that
  // surfaced it — 6 of its 16 occurrences are drawn with EQUAL insets on four
  // sides — but that is consistent with a stretch, NOT proof of one: STRETCH
  // permits any fixed insets, and the ring's other occurrences are unequal or
  // have negative bottoms. The claim here is only what can be shown: those 352
  // boxes are read as LEFT×TOP by assumption, and a STRETCH/SCALE node is
  // INDISTINGUISHABLE from a real top-left pin in a pre-v1.13 dump.
  //
  // The capture is fixed, but a dump ALREADY TAKEN cannot be repaired: the
  // field was destroyed at capture time, so every pre-v1.13 dump needs a
  // RE-CAPTURE. Until then the assumption stands — and now it is at least
  // stated instead of silent.
  // GROUP has NO `constraints` property in the Plugin API at all ("you must
  // iterate through the group's children"), so an absent field there is not a
  // dropped fact and a re-capture would not produce one. Blaming the capture
  // for it would be a false receipt in a round about false receipts.
  const NO_CONSTRAINTS_NODE = new Set(['GROUP']);
  const assumed = m.occ.filter(
    (o) => absBoxOf(o.node)?.constraints === undefined && !NO_CONSTRAINTS_NODE.has(o.node.type ?? ''),
  ).length;
  if (assumed > 0) {
    ctx.notes.push(
      `${where}: ${assumed} of ${boxes.length} occurrence(s) carry NO constraints field, so the placement is read as LEFT×TOP — an ASSUMPTION, not an observation. A pre-v1.13 dump also omitted the field for STRETCH/SCALE nodes (only MIN/MAX/CENTER had a spelling), so a box drawn pinned to all four edges is indistinguishable here from one pinned top-left; re-capture with dump v1.13+ to tell them apart`,
    );
  }
  const hs = [...new Set(boxes.map((b) => b.box!.constraints?.horizontal ?? 'LEFT'))];
  const vs = [...new Set(boxes.map((b) => b.box!.constraints?.vertical ?? 'TOP'))];
  if (hs.length > 1 || vs.length > 1) {
    return ledger(`constraints differ across variants (${hs.join('|')} × ${vs.join('|')})`);
  }
  // STRETCH IS EXACTLY REPRESENTABLE — SCALE IS NOT. A Figma STRETCH pins BOTH
  // edges on its axis, which is CSS `left + right` (or `top + bottom`) with no
  // size: the box grows with its parent. The both-edges spelling already exists
  // here for symmetric text, so carrying it costs no new vocabulary. SCALE
  // resizes PROPORTIONALLY with the parent — CSS has no such thing on a
  // positioned box — so it keeps the named refusal it always had.
  //
  // Before dump v1.12 neither could reach this line: the capture dropped the
  // field for both, so they arrived as an absent value read as LEFT×TOP and
  // were carried as a fixed top-left box. The refusal below was reachable ONLY
  // from a hand-authored fixture.
  // A STRETCH axis and an ALREADY-BOUND size on that axis CONTRADICT each
  // other: the constraint says "both edges, size follows the parent", the
  // binding says "this exact width". Skipping the size MINT is not enough —
  // a width already in `tokens` (the design's own bound variable) survives,
  // and then CSS resolves left+right+width by DROPPING one edge, so the box
  // freezes at its drawn size and which edge dies flips under `direction: rtl`.
  // The design's explicit binding wins (it is an observation, not an
  // inference); the stretch is NOT carried on that axis and the conflict is
  // named. Silently emitting all three was the first cut of this fix.
  const sizeBound = (dim: 'width' | 'height') =>
    tokens[dim] !== undefined || m.occ.some((o) => o.node.bound?.[dim]);
  const hStretchRaw = hs[0] === 'STRETCH';
  const vStretchRaw = vs[0] === 'STRETCH';
  const hStretch = hStretchRaw && !sizeBound('width');
  const vStretch = vStretchRaw && !sizeBound('height');
  if ((hStretchRaw && !hStretch) || (vStretchRaw && !vStretch)) {
    ctx.notes.push(
      `${where}: constraint ${hs[0]}×${vs[0]} STRETCHes an axis whose size is ALREADY BOUND (${[hStretchRaw && !hStretch ? 'width' : null, vStretchRaw && !vStretch ? 'height' : null].filter(Boolean).join(', ')}) — the two contradict (a stretch sizes from the parent, a bound size does not), so the design's own binding is kept and the stretch is NOT carried on that axis; the part pins ONE edge and holds its bound size`,
    );
  }
  if (hs[0] === 'SCALE' || vs[0] === 'SCALE') {
    return ledger(
      `constraint ${hs[0]}×${vs[0]} has no carried offset spelling — SCALE resizes the box PROPORTIONALLY with its parent and CSS has no equivalent on a positioned element (STRETCH is carried as both edges; SCALE is not)`,
    );
  }
  if (!['LEFT', 'RIGHT', 'CENTER', 'STRETCH'].includes(hs[0]) || !['TOP', 'BOTTOM', 'CENTER', 'STRETCH'].includes(vs[0])) {
    return ledger(`constraint ${hs[0]}×${vs[0]} has no carried offset spelling`);
  }
  const px2 = (n: number) => Math.round(n * 100) / 100;
  // Presence-shaped coverage (round 2 iteration 6): a node ABSENT from some
  // variants yields no observation there, so a placement channel that is a
  // clean function of one axis still failed full-coverage classification and
  // fell back to the base combo's offsets for EVERY axis value (field case:
  // the UUI tooltip arrow rendered bottom-center offsets in all 7 arrow
  // directions). By the time this runs buildPart has already resolved subset
  // presence: the part is either visibleWhen-gated (it never renders at the
  // unobserved axis values) or kept unconditional as a NAMED lesser error —
  // either way a '0' fill draws no new ink, it only closes the dangling-ref
  // hole full coverage protects against (mint-tokens `sparse`).
  const sparse = m.occ.length < ctx.totalVariants.length ? '0' : undefined;
  const channels: string[] = [];
  const mintChan = (chan: string, pick: (b: AbsBox) => number) => {
    mintObservation(
      ctx, tokens, where, chan, 'px',
      boxes.map((b) => ({ variant: b.variant, value: px2(pick(b.box!)) })),
      `${where}|abs-${chan}`,
      sparse,
    );
    // Base-combo literal fallback (the round-4 padding precedent): when the
    // per-variant values refuse classification in the mint pass, the FIRST
    // occurrence's value carries as a part literal — applied and NAMED there.
    ctx.mint!.absFallbacks.push({ part, tokens, chan, value: px2(pick(boxes[0].box!)), where });
    channels.push(chan);
  };
  const declared = (part.declared as Record<string, string> | undefined) ?? {};
  // TEXT, horizontally symmetric box: pin both edges + center the glyphs —
  // the center-preserving spelling (see the block comment above).
  const symmetricText = opts.text === true && boxes.every((b) => Math.abs(b.box!.x - b.box!.right) <= 1);
  if (symmetricText || hStretch) {
    // Both edges pinned: the box's width is the PARENT's, minus two fixed
    // insets. That is what Figma STRETCH means and what CSS left+right (with no
    // width) does — the one case where the canvas's resize behaviour survives
    // into code rather than being frozen at the drawn size.
    mintChan('left', (b) => b.x);
    mintChan('right', (b) => b.right);
    if (symmetricText && declared['text-align'] === undefined) declared['text-align'] = 'center';
  } else if (hs[0] === 'RIGHT') mintChan('right', (b) => b.right);
  else mintChan('left', (b) => b.x);
  if (vStretch) {
    mintChan('top', (b) => b.y);
    mintChan('bottom', (b) => b.bottom);
  } else if (vs[0] === 'BOTTOM') mintChan('bottom', (b) => b.bottom);
  else mintChan('top', (b) => b.y);
  if (opts.size === true && opts.text !== true) {
    for (const dim of ['width', 'height'] as const) {
      // A STRETCHED axis takes NO size: both edges already determine it, and a
      // baked width would freeze the very resize the constraint expresses.
      // (`hStretch` is false when a size is already BOUND on that axis — that
      // contradiction is resolved and named above, so this cannot leave
      // left+right+width all present, which CSS resolves by dropping an edge.)
      if (dim === 'width' && hStretch) continue;
      if (dim === 'height' && vStretch) continue;
      // A dimension already carried (bound variable or an earlier channel) is
      // the design's own binding — the abs box never overrides it.
      if (tokens[dim] !== undefined || m.occ.some((o) => o.node.bound?.[dim])) continue;
      mintChan(dim, (b) => b[dim]);
    }
  }
  if (hStretch || vStretch) {
    ctx.notes.push(
      `${where}: constraint ${hs[0]}×${vs[0]} — the ${[hStretch ? 'HORIZONTAL' : null, vStretch ? 'VERTICAL' : null].filter(Boolean).join(' and ')} axis is STRETCH, carried as BOTH edges with NO size on that axis (CSS left+right / top+bottom), so the box tracks its parent exactly as the canvas draws it; a baked width/height would have frozen it at the drawn size`,
    );
  }
  if (declared.position === undefined) declared.position = 'absolute';
  part.declared = declared;
  const centered = hs[0] === 'CENTER' || vs[0] === 'CENTER';
  ctx.notes.push(
    `${where}: absolute placement carried (dump v1.7 \`abs\`) — position: absolute with minted px channels [${channels.join(', ')}]${
      symmetricText ? ' + text-align: center (horizontally symmetric text box — the center-preserving spelling)' : ''
    }${centered && !symmetricText ? ' (CENTER constraint carried as the exact drawn offset — center-tracking under parent resize is not carried, a declared limit)' : ''}; per-variant values classify through the standard mint machinery`,
  );
  // WHAT THIS PLACEMENT COSTS, said out loud. The offsets above are read off
  // the DRAWN BOX, so whatever CSS produced that box — `margin-*` on the
  // child, or an inset quartet the contract bound to real tokens — arrives
  // here already lowered to geometry and cannot be told apart from any other
  // way of drawing the same rectangle. Those channels are NOT carried, and
  // geometry is not read back (Option B, FC-GEOMETRY-EXCLUDED), so nothing
  // below will recover them.
  //
  // The old note described only what WAS carried. A reader diffing the
  // proposal against the contract then found `margin-left`, `margin-top` and
  // `bottom` simply missing with no receipt anywhere — silent loss, and
  // exactly the rows TJ-TEST.md §A7 had to list by hand.
  ctx.notes.push(
    `${where}: the CSS that PRODUCED this box is not recoverable from it — a child's \`margin-*\` (which the emitter lowers into a "(margin box)" wrapper) and a bound inset quartet (\`left\`/\`right\`/\`top\`/\`bottom\`) both draw as the same absolute rectangle. Those channels are NAMED here and NOT carried; the offsets above are the drawn geometry, not the authored spacing (Option B — geometry is not read back, \`FC-GEOMETRY-EXCLUDED\`); review`,
  );
  return true;
}

/** Positioning for a part that CANNOT carry styling (component ref / slot —
 *  the child contract / consumer owns it): a component ref's placement rides
 *  a structural WRAPPER part (position:absolute box; the ref renders inside,
 *  unchanged; visibleWhen hoists onto the wrapper — the wrapper is what must
 *  not render when the part is off). A SLOT part's placement is refused BY
 *  NAME (slot chrome belongs to the consumer; not carried this round). */
function wrapPositionedRefPart(
  m: Merged,
  built: Record<string, unknown>,
  ctx: Ctx,
  where: string,
  /** The wrapper's claimed part key — the parent-derived-prefix context for
   *  the inner ref part's own (contract-wide unique) key. */
  selfKey: string,
): Record<string, unknown> {
  if (!built.component && !built.slot) return built;
  if (m.occ.every((o) => absBoxOf(o.node) === undefined)) return built;
  if (built.slot) {
    ctx.notes.push(
      `${where}: absolute placement captured (dump v1.7 \`abs\`) on a SLOT part — slot parts refuse styling (the consumer owns the content box) and a positioned slot wrapper is not carried this round; ledgered by name, the slot renders in flow`,
    );
    return built;
  }
  const wrapper: Record<string, unknown> = {};
  const wTokens: Record<string, string> = {};
  if (!carryAbsPlacement(m, wrapper, wTokens, ctx, where, { size: true })) return built;
  attachTokens(ctx, wrapper, wTokens);
  if (built.visibleWhen !== undefined) {
    wrapper.visibleWhen = built.visibleWhen;
    delete built.visibleWhen;
  }
  wrapper.parts = { [partKey('instance', ctx, where, selfKey)]: built };
  ctx.notes.push(
    `${where}: the positioned part is a component ref — placement rides a structural wrapper part (the child contract owns its own styling; the ref renders inside unchanged, visibility hoisted onto the wrapper)`,
  );
  return wrapper;
}

/** Declare `position: relative` on a holder whose DIRECT parts record carries
 *  at least one positioned child — unless the holder is itself positioned
 *  (an absolute box is already a positioning context), or the holder rides a
 *  wrapper-union SYNTHETIC clone in any variant (`m` provided): a synthetic
 *  wrapper has no drawn geometry of its own and its members' offsets mix
 *  reference frames (root-frame where drawn flat, wrapper-frame where
 *  nested), so it stays unpositioned and its children anchor to the nearest
 *  REAL positioned ancestor (the base-combo fallback offsets are the flat,
 *  root-frame drawing — consistent with that anchor). */
function declareRelativeIfPositionedChildren(
  holder: Record<string, unknown>,
  parts: Record<string, unknown>,
  m: Merged | null,
): void {
  // The positioned child's spelling is EITHER declared.position (the
  // overlay/abs door) OR stylesWhen[].styles.position (the shape-placement
  // door, #42: the ToggleSwitch thumb's per-checked left/right ride
  // stylesWhen). Reading only `declared` left the track (part-0) unpositioned,
  // emit-react's root fallback anchored `right: 2px` to the 100px root and the
  // recovered thumb drew OUTSIDE the 44px track
  // (FC-DUMP-PROPOSE-THUMB-HOLDER-RELATIVE).
  const positioned = Object.values(parts).some((p) => {
    const rec = p as {
      declared?: Record<string, string>;
      stylesWhen?: Array<{ styles?: Record<string, string> }>;
    };
    return (
      rec.declared?.position === 'absolute' ||
      (rec.stylesWhen ?? []).some((sw) => sw.styles?.['position'] === 'absolute')
    );
  });
  if (!positioned) return;
  if (m && m.occ.some((o) => (o.node as { __synthetic?: boolean }).__synthetic === true)) return;
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared.position === undefined) declared.position = 'relative';
  holder.declared = declared;
}

/** The contract's padding vocabulary prefers the symmetric shorthands
 *  (padding-inline/-block): a symmetric pair mints one observation; an
 *  ASYMMETRIC pair mints the two per-side longhand channels instead
 *  (padding-left/right, padding-top/bottom) — per-variant observations
 *  exactly like the shorthand path, so axis-correlated values classify into
 *  per-axis-value leaves the same way (untitled-ui round 2 exemplar: Badge
 *  base [2,8,2,6] used to refuse padding-inline here and the pill hugged its
 *  text). A side that is zero in every variant needs no token; an all-zero
 *  pair needs none at all. */
function authoredPartAt(ctx: Ctx, partPath: string): MinimalAnatomyPart | undefined {
  let cur: MinimalAnatomyPart | undefined = ctx.contractsById?.get(ctx.selfId)?.anatomy?.root;
  if (!cur) return undefined;
  if (!partPath) return cur;
  for (const seg of partPath.split('/').filter(Boolean)) {
    const next: MinimalAnatomyPart | undefined = cur.parts?.[seg];
    if (!next) return undefined;
    cur = next;
  }
  return cur;
}

const paddingLonghands: Record<string, readonly [string, string]> = {
  'padding-inline': ['padding-left', 'padding-right'],
  'padding-block': ['padding-top', 'padding-bottom'],
};

/** Stamped-contract recovery for unbound padding (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED).
 *  Dump has no padding bind; emit wrote literals. Minting a dump-slug remints
 *  a token the canvas never bound. When the authored part already spells the
 *  drawn px as a literal (or a token that resolves to it), recover that. */
function recoverAuthoredPadding(
  ctx: Ctx,
  part: Record<string, unknown> | undefined,
  where: string,
  cssProperty: string,
  drawn: number,
): boolean {
  if (!part) return false;
  const authored = authoredPartAt(ctx, partPathOf(where));
  if (!authored) return false;
  const want = `${drawn}px`;
  const matches = (value: string | undefined): 'literal' | 'token' | null => {
    if (typeof value !== 'string') return null;
    if (value === want) return 'literal';
    if (value.startsWith('{') && value.endsWith('}')) {
      const path = value.slice(1, -1);
      if (path.includes('{') || !ctx.corpus.has(path)) return null;
      try {
        const resolved = ctx.corpus.resolveLiteral(path);
        if (Number(resolved) === drawn || String(resolved) === want || String(resolved) === String(drawn)) {
          return 'token';
        }
      } catch {
        return null;
      }
    }
    return null;
  };
  const writeLiteral = (prop: string, value: string) => {
    const literals = (part.literals as Record<string, string> | undefined) ?? {};
    literals[prop] = value;
    part.literals = literals;
  };
  if (matches(authored.literals?.[cssProperty]) === 'literal') {
    writeLiteral(cssProperty, want);
    ctx.notes.push(
      `${where}: unbound ${cssProperty} ${want} recovers the stamped contract's literal, not a dump-slug mint (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED)`,
    );
    return true;
  }
  const pair = paddingLonghands[cssProperty];
  if (pair) {
    const a = authored.literals?.[pair[0]] ?? authored.tokens?.[pair[0]];
    const b = authored.literals?.[pair[1]] ?? authored.tokens?.[pair[1]];
    if (matches(a) === 'literal' && matches(b) === 'literal') {
      writeLiteral(pair[0], want);
      writeLiteral(pair[1], want);
      ctx.notes.push(
        `${where}: unbound ${cssProperty} ${want} recovers the stamped contract's ${pair[0]}/${pair[1]} literals, not a dump-slug mint (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED)`,
      );
      return true;
    }
  }
  return false;
}

function recoverAuthoredPaddingToken(
  ctx: Ctx,
  target: Record<string, string>,
  where: string,
  cssProperty: string,
  drawn: number,
): boolean {
  const authored = authoredPartAt(ctx, partPathOf(where));
  if (!authored) return false;
  const want = `${drawn}px`;
  const ref = authored.tokens?.[cssProperty];
  if (typeof ref !== 'string' || !ref.startsWith('{') || !ref.endsWith('}')) return false;
  const path = ref.slice(1, -1);
  if (path.includes('{') || !ctx.corpus.has(path)) return false;
  try {
    const resolved = ctx.corpus.resolveLiteral(path);
    if (Number(resolved) === drawn || String(resolved) === want || String(resolved) === String(drawn)) {
      target[cssProperty] = ref;
      ctx.notes.push(
        `${where}: unbound ${cssProperty} ${want} recovers the stamped contract's ${ref}, not a dump-slug mint (FC-DUMP-PROPOSE-PADDING-LITERAL-MINTED)`,
      );
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function mintPadding(
  ctx: Ctx,
  target: Record<string, string>,
  m: Merged,
  where: string,
  /** The owning PART (round 2 iteration 6): with it, a padding channel whose
   *  per-variant values refuse classification falls back to the base combo's
   *  literal — the round-4 padding precedent the CODE path already ships
   *  (LITERAL_CHANNELS: "the base plane is exact"). Field case: UUI Tooltip's
   *  padding-block is 12/8 as f(supportingText) — a BOOL axis, which nested
   *  parts cannot classify on (bool conditioning is root-only), so the bubble
   *  shipped with NO vertical padding at all. Absent (the root call site) —
   *  refusals stay named-only, exactly as before. */
  part?: Record<string, unknown>,
) {
  if (!ctx.mint) return;
  const source = `${where}|padding`;
  const fallback = (chan: string, value: number) => {
    if (part && value !== 0) ctx.mint!.absFallbacks.push({ part, tokens: target, chan, value, where });
  };
  const pad = (n: DumpNode): readonly number[] => n.layout?.padding ?? [0, 0, 0, 0];
  const uniformDrawn = (idx: number): number | undefined => {
    const values = m.occ.map((o) => pad(o.node)[idx]);
    const distinct = [...new Set(values)];
    return distinct.length === 1 ? distinct[0] : undefined;
  };
  const recoverOrMint = (cssProperty: string, idx: number, allowFallback: boolean) => {
    const drawn = uniformDrawn(idx);
    if (drawn !== undefined && drawn !== 0) {
      if (recoverAuthoredPadding(ctx, part, where, cssProperty, drawn)) return 'recovered';
      if (recoverAuthoredPaddingToken(ctx, target, where, cssProperty, drawn)) return 'recovered';
    }
    mintObservation(ctx, target, where, cssProperty, 'px', numOccurrences(m, (n) => pad(n)[idx]), source);
    if (allowFallback && drawn !== undefined) fallback(cssProperty, drawn);
    return 'minted';
  };
  const pairs = [
    // padding: [top, right, bottom, left]
    { cssProperty: 'padding-inline', a: 3, b: 1, label: 'left/right', sides: [['padding-left', 3], ['padding-right', 1]] },
    { cssProperty: 'padding-block', a: 0, b: 2, label: 'top/bottom', sides: [['padding-top', 0], ['padding-bottom', 2]] },
  ] as const;
  for (const { cssProperty, a, b, label, sides } of pairs) {
    if (!m.occ.every((o) => pad(o.node)[a] === pad(o.node)[b])) {
      const minted: string[] = [];
      for (const [sideProp, idx] of sides) {
        if (m.occ.every((o) => pad(o.node)[idx] === 0)) continue; // zero side needs no token
        // Per-side longhands take NO base-combo fallback (round 2 iteration 6,
        // measured): baking the base side onto IFB's Dropdown regressed its
        // dropdown variants — asymmetric sides interact with stub-geometry
        // compensating errors; their refusals stay named-only.
        if (recoverOrMint(sideProp, idx, false) === 'minted') minted.push(sideProp);
      }
      ctx.notes.push(
        `${where}: ${label} padding literals differ — ${cssProperty} is not representable; carried as per-side ${minted.join('/')} instead (asymmetric padding)`,
      );
      continue;
    }
    if (m.occ.every((o) => pad(o.node)[a] === 0)) continue; // zero padding needs no token
    recoverOrMint(cssProperty, a, true);
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

/** The stamped weight tokens across a merged part's text occurrences. One
 *  distinct value is the binding; none means nothing was stamped (a set this
 *  pipeline did not draw, or a contract that declares no weight); more than
 *  one is a contradiction a single binding cannot express. */
function textOccWeightVars(m: Merged): Array<string | undefined> {
  return m.occ
    .filter((o) => o.node.text !== undefined)
    .map((o) => o.node.text!.fontWeightVar);
}

/** The corpus token that SPELLS an observed font weight — when exactly one
 *  does. The weight-name table turns the canvas's Inter style name into a
 *  number; the corpus's value index turns that number into the token(s) that
 *  resolve to it, semantic layer first. ONE hit is the token the canvas is
 *  drawing and carries; anything else is ambiguous and stays NAMED, because
 *  picking among candidates is exactly the invention this inverter refuses.
 *  Restricted to paths with a `weight` segment so a bare number cannot match
 *  an unrelated spacing or size token that happens to share the literal. */
function weightTokenRef(ctx: Ctx, fontStyle: string): string | undefined {
  const { weight } = fontStyleWeight(fontStyle);
  if (weight === undefined) return undefined;
  const hits = ctx.corpus
    .suggestFor(weight)
    .filter((p) => p.split('.').includes('weight'));
  return hits.length === 1 ? `{${hits[0]}}` : undefined;
}

/** Mint the text channels that ride OUTSIDE a token-derived style identity:
 *  font-weight through the bounded weight-name table (dump fontStyle), and
 *  line-height when the dump captured a PIXEL value (dump v1.3). Uniformity
 *  rules mirror font-size: identical across variants → one mint; varying →
 *  per-variant substituted refs (the mint classifier owns the split).
 *  Unknown weight names are NAMED receipts; the slant is carryFontSlant's. */
function mintTextChannels(
  m: Merged,
  tokens: Record<string, string>,
  ctx: Ctx,
  where: string,
  opts: { weight: boolean },
  /** v17 — see mintObservation.styleName. */
  styleName?: string,
  styleKey?: string,
  /** When styles differ per variant, attach each occurrence's identity to
   *  weight/line-height leaves the same way font-size does. */
  perOccStyleSource?: Array<{ variant: string; node: DumpNode }>,
) {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  const styleFor = (variant: string): { styleName?: string; styleKey?: string } => {
    if (!perOccStyleSource) return {};
    const hit = perOccStyleSource.find((o) => o.variant === variant);
    const name = hit?.node.text?.style;
    const key = hit?.node.text?.styleKey;
    return {
      ...(name !== undefined ? { styleName: name } : {}),
      ...(key !== undefined ? { styleKey: key } : {}),
    };
  };
  // The stamped weight token outranks every inference below, in EVERY branch
  // that reaches here — a node riding a text style, a node riding a size
  // variable, a node riding neither. Reading it here rather than at one call
  // site is what stops the answer depending on which carrier the node happened
  // to use: Badge and Button recovered the weight's VALUE through the mint
  // path while Label recovered its IDENTITY, for no reason a reader could see.
  const stamped = unifyStampedTextVar(textOcc, (tx) => tx.fontWeightVar, ctx.axes);
  if (stamped !== undefined) {
    tokens['font-weight'] = stamped;
  }
  // >1 distinct stamp is a size-varying weight, not a contradiction — the
  // contract binds a substituted ref and the canvas resolves it per variant.
  // The mint machinery below rebuilds that substitution, so this falls through
  // silently rather than reporting a healthy path as a problem.
  const weightAlreadyBound = tokens['font-weight'] !== undefined;
  if (opts.weight && !weightAlreadyBound) {
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
        parsed.map((p) => ({ variant: p.variant, value: p.weight!, ...styleFor(p.variant) })),
        `${where}|fontWeight`,
        undefined,
        styleName,
        styleKey,
      );
    }
    // The slant half of the face name is carryFontSlant's (declared
    // font-style) — it used to be receipted only on THIS branch, so a node
    // whose weight was stamped lost its italic in silence
    // (FC-DUMP-PROPOSE-ITALIC-DROPPED).
  }
  // line-height (dump v1.3, PIXELS only — other units were receipted at capture).
  // The STAMPED token wins, for the same reason it does for weight: 20px is not
  // a unique fact, so minting from the number invented a SECOND name
  // (`imported.label.label.line-height`) for a token the corpus already carried
  // (`imported.label.root.line-height`). Value was never the problem; identity
  // was. One distinct stamp binds; disagreeing stamps are NAMED, not picked
  // between; no stamp falls through to the mint below, unchanged.
  const stampedLh = unifyStampedTextVar(textOcc, (tx) => tx.lineHeightVar, ctx.axes);
  if (stampedLh !== undefined) {
    tokens['line-height'] = stampedLh;
    return;
  }
  // MORE THAN ONE distinct stamp is the NORMAL case for a size-varying
  // channel (Button carries five, one per size), not a contradiction: the
  // contract binds a SUBSTITUTED ref and the canvas resolves it per variant.
  // Falling through to the mint machinery is right — it already rebuilds the
  // substitution, and measurement confirms Badge and Button were never among
  // the reminted rows. No note: a receipt that fires on the healthy path is
  // noise, and noise is how a report stops being read.
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
    withLh.map((o) => ({
      variant: o.variant,
      value: o.node.text!.lineHeight!,
      ...styleFor(o.variant),
    })),
    `${where}|lineHeight`,
    undefined,
    styleName,
    styleKey,
  );
}

/** dump v1.16 — textCase UPPER/LOWER/TITLE → the declared `text-transform`
 *  channel (uppercase/lowercase/capitalize): a canvas-DRAWN keyword fact
 *  (DECLARED_CHANNELS verdict 'draw'; the return leg writes Figma textCase —
 *  core/emit-figma-script.ts). Carried only when every text occurrence
 *  agrees; a mixed axis is NAMED, never sampled (the CBDS uniformity rule).
 *  Field case: Eventz Badge labels ride textCase UPPER and rendered "Label"
 *  for "LABEL" (dump ≤ v1.15 receipted the channel away). */
const TEXT_TRANSFORM_BY_CASE: Record<string, string> = {
  UPPER: 'uppercase',
  LOWER: 'lowercase',
  TITLE: 'capitalize',
};
function carryTextCase(m: Merged, holder: Record<string, unknown>, ctx: Ctx, where: string): void {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  const cases = [...new Set(textOcc.map((o) => o.node.text!.textCase))];
  const drawn = cases.filter((c): c is 'UPPER' | 'LOWER' | 'TITLE' => c !== undefined);
  if (drawn.length === 0) return; // as-typed, or a pre-v1.16 dump (receipted at capture)
  if (cases.length > 1) {
    ctx.notes.push(
      `${where}: textCase differs across variants (${cases.map((c) => c ?? 'ORIGINAL/not captured').join(', ')}) — text-transform is a declared literal with no per-variant vocabulary; NAMED, not proposed (review)`,
    );
    return;
  }
  const value = TEXT_TRANSFORM_BY_CASE[drawn[0]];
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['text-transform'] === undefined) declared['text-transform'] = value;
  holder.declared = declared;
  ctx.notes.push(
    `${where}: textCase ${drawn[0]} drawn in every variant — carried as declared text-transform: ${value} (dump v1.16; a canvas-drawable channel, the return leg writes Figma textCase)`,
  );
}

/** dump v1.31 — the text node's font FAMILY (fontName.family / REST
 *  style.fontFamily) → the declared `font-family` channel (DECLARED_CHANNELS,
 *  canvas: draw — the emitter sets fontName.family from the first stack
 *  entry). Inter is the pipeline's own default (every emitter renders Inter
 *  when nothing is declared), so Inter is not a fact to carry; any other
 *  family drawn in every variant carries, a mixed axis is NAMED (no
 *  per-variant declared vocabulary). Phase 2 exam: 44 Manrope nodes rendered
 *  Inter with no receipt (rest-text-font-family). */
const DEFAULT_FONT_FAMILY = 'Inter';
function carryFontFamily(m: Merged, holder: Record<string, unknown>, ctx: Ctx, where: string): void {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  const families = [...new Set(textOcc.map((o) => o.node.text!.fontFamily))];
  const captured = families.filter((f): f is string => typeof f === 'string' && f.trim() !== '');
  if (captured.length === 0) return; // not captured (pre-v1.31) — nothing to say
  if (families.length > 1) {
    ctx.notes.push(
      `${where}: font family differs across variants (${families.map((f) => f ?? 'not captured').join(', ')}) — font-family is a declared literal with no per-variant vocabulary; NAMED, not proposed (the emitter renders ${DEFAULT_FONT_FAMILY}; review)`,
    );
    return;
  }
  const family = captured[0];
  if (family === DEFAULT_FONT_FAMILY) return; // the pipeline's own default — absence already renders it
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['font-family'] === undefined) declared['font-family'] = family;
  holder.declared = declared;
  ctx.notes.push(
    `${where}: font family "${family}" drawn in every variant (dump v1.31) — carried as declared font-family: ${family} (a canvas-drawable channel; the return leg sets fontName.family — the face must be available to the renderer, else it falls back to ${DEFAULT_FONT_FAMILY} — FC-FONT-SUBSTRATE, named limit)`,
  );
}

/** dump v1.31 — textAlignHorizontal → the declared `text-align` channel
 *  (DECLARED_CHANNELS, canvas: draw — the emitter writes textAlignHorizontal
 *  back). LEFT is the CSS default and is not a fact to carry; CENTER / RIGHT
 *  / JUSTIFIED drawn in every variant carry, a mixed axis is NAMED. Phase 2
 *  exam: 8 centred labels rendered start-aligned with no receipt
 *  (rest-text-align-center). */
const TEXT_ALIGN_BY_CANVAS: Record<string, string> = {
  CENTER: 'center',
  RIGHT: 'right',
  JUSTIFIED: 'justify',
};
function carryTextAlign(m: Merged, holder: Record<string, unknown>, ctx: Ctx, where: string): void {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  const aligns = [...new Set(textOcc.map((o) => o.node.text!.textAlign))];
  const drawn = aligns.filter((a): a is 'CENTER' | 'RIGHT' | 'JUSTIFIED' => a !== undefined && a in TEXT_ALIGN_BY_CANVAS);
  if (drawn.length === 0) return; // LEFT / not captured — CSS's own default
  if (aligns.length > 1) {
    ctx.notes.push(
      `${where}: textAlignHorizontal differs across variants (${aligns.map((a) => a ?? 'LEFT/not captured').join(', ')}) — text-align is a declared literal with no per-variant vocabulary; NAMED, not proposed (review)`,
    );
    return;
  }
  const value = TEXT_ALIGN_BY_CANVAS[drawn[0]];
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['text-align'] === undefined) declared['text-align'] = value;
  holder.declared = declared;
  ctx.notes.push(
    `${where}: textAlignHorizontal ${drawn[0]} drawn in every variant (dump v1.31) — carried as declared text-align: ${value} (a canvas-drawable channel; the return leg writes textAlignHorizontal)`,
  );
}

/** FC-DUMP-PROPOSE-ITALIC-DROPPED. The slant is part of the face NAME
 *  (fontName.style "Italic" / "Medium Italic"), and the weight reader was
 *  the only place that looked at it — so a node whose weight was STAMPED
 *  (dump v1.22 fontWeightVar) returned before the italic receipt ran, and
 *  "Medium Italic" proposed as an upright Medium with no note. font-style is
 *  a DECLARED channel (DECLARED_CHANNELS, canvas: draw — the return leg
 *  selects the italic face), read here beside textCase, regardless of how
 *  the weight half of the name was recovered. */
function carryFontSlant(m: Merged, holder: Record<string, unknown>, ctx: Ctx, where: string): void {
  const textOcc = m.occ.filter((o) => o.node.text !== undefined);
  if (textOcc.length === 0) return;
  const faces = textOcc.map((o) => o.node.text!.fontStyle ?? 'Medium');
  const italic = faces.map((f) => fontStyleWeight(f).italic);
  if (!italic.some(Boolean)) return; // upright everywhere: CSS's own default, not a fact
  if (!italic.every(Boolean)) {
    ctx.notes.push(
      `${where}: italic face differs across variants (${[...new Set(faces)].map((f) => `"${f}"`).join(', ')}) — font-style is a declared literal with no per-variant vocabulary; italic NAMED, not proposed (review)`,
    );
    return;
  }
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['font-style'] === undefined) declared['font-style'] = 'italic';
  holder.declared = declared;
  ctx.notes.push(
    `${where}: italic face ("${faces[0]}") drawn in every variant — carried as declared font-style: italic (the slant rides the face name; the weight half carries through font-weight as before; the return leg selects the italic face)`,
  );
}

/** FC-DUMP-PROPOSE-CLIP-UNREAD. The dump reads clipsContent (v1.20) and the
 *  proposer never looked at it. Two honest dispositions, decided by
 *  provenance:
 *    · a set THIS pipeline drew: the emitter writes clipsContent on every
 *      frame explicitly (`node.clipsContent = spec.clipsContent === true`),
 *      true ONLY from a declared overflow hidden|clip — so the flag is an
 *      authored fact and carries as declared overflow-x/overflow-y: hidden
 *      (the FC-OVERFLOW-CLIP-LOST read leg);
 *    · a foreign set: Figma's own FrameNode default is ALSO true, so an
 *      authored clip and an untouched default are byte-identical — carrying
 *      it would mint a fact nobody wrote (types.ts DumpNode.clipsContent), so
 *      it is NAMED per node instead.
 *  `carry: false` callers (slot / component-ref parts) own no `declared`
 *  block — the child contract or the slot content owns the clip — so the
 *  fact is named there whatever the provenance. */
function carryClip(
  m: Merged,
  holder: Record<string, unknown>,
  ctx: Ctx,
  where: string,
  opts: { carry: boolean; owner?: string },
): void {
  const clipping = m.occ.filter((o) => o.node.clipsContent === true);
  if (clipping.length === 0) return; // absence is CSS's own default (visible)
  const span = `${clipping.length}/${m.occ.length} variant(s)`;
  if (!opts.carry) {
    ctx.notes.push(
      `${where}: clipsContent is true in ${span} (dump v1.20) on a ${opts.owner ?? 'part'} that owns no declared block — ${opts.owner === 'component-ref part' ? 'the child contract owns its overflow' : 'the slot content owns its overflow'}; NAMED, not inverted (review)`,
    );
    return;
  }
  if (!ctx.drawnByThisPipeline) {
    ctx.notes.push(
      `${where}: clipsContent is true in ${span} (dump v1.20) on a set this pipeline did not draw — Figma's own frame default is ALSO true, so an authored clip and an untouched default are byte-identical here; overflow NOT inverted (a blanket carry would mint a fact nobody wrote) — NAMED; declare overflow: hidden on this part if the clip is intended (review)`,
    );
    return;
  }
  if (clipping.length !== m.occ.length) {
    ctx.notes.push(
      `${where}: clipsContent differs across variants (true in ${span}, dump v1.20) — overflow is a declared literal with no per-variant vocabulary; NAMED, not proposed (review)`,
    );
    return;
  }
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['overflow-x'] === undefined) declared['overflow-x'] = 'hidden';
  if (declared['overflow-y'] === undefined) declared['overflow-y'] = 'hidden';
  holder.declared = declared;
  ctx.notes.push(
    `${where}: clipsContent drawn in every variant on a set this pipeline drew (the emitter writes the flag explicitly, true only from a declared overflow) — carried as declared overflow-x: hidden; overflow-y: hidden (dump v1.20; FC-OVERFLOW-CLIP-LOST read leg)`,
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
  // Stamped size identity outranks the numeric uniformity guard. A Size
  // axis with five fontSizeVar names (md/xs/sm/lg/xl) is the healthy
  // substituted-ref case — minting from the px values remints a dump-slug
  // path (`imported.<set-slug>.label.font-size.{size}`) over the canvas
  // names (`imported/button/root/font-size/{size}`). FC-DUMP-PROPOSE-TYPE-UNPINNED.
  const stampedSize = unifyStampedTextVar(textOcc, (tx) => tx.fontSizeVar, ctx.axes);
  const stampedWeight = stampedSize !== undefined ? unifyStampedTextVar(textOcc, (tx) => tx.fontWeightVar, ctx.axes) : undefined;
  const sizeVarsVary = new Set(textOcc.map((o) => o.node.text!.fontSizeVar)).size > 1;
  // ONE size stamp and NO weight stamp (the repo's own pre-v1.22 dumps:
  // Switch descriptionText) keeps the uniform-sizeVar branch below, whose
  // fontStyle→corpus inference carries {font.weight.regular}; returning here
  // minted a dump-slug weight the corpus already spells (design-roundtrip
  // Switch MISMATCH 1).
  if (stampedSize !== undefined && (stampedWeight !== undefined || sizeVarsVary)) {
    tokens['font-size'] = stampedSize;
    if (stampedWeight !== undefined) tokens['font-weight'] = stampedWeight;
    mintTextChannels(m, tokens, ctx, where, { weight: tokens['font-weight'] === undefined });
    return tokens;
  }
  const distinctSizes = [...new Set(textOcc.map((o) => o.node.text!.fontSize))];
  const distinctWeights = [...new Set(textOcc.map((o) => o.node.text!.fontStyle ?? 'Medium'))];
  if (distinctSizes.length > 1 || distinctWeights.length > 1) {
    const varyingStyleNames = [
      ...new Set(
        textOcc
          .map((o) => o.node.text!.style)
          .filter((name) => name !== undefined),
      ),
    ];
    const varyingStyleKeys = [
      ...new Set(
        textOcc
          .map((o) => o.node.text!.styleKey)
          .filter((key) => key !== undefined),
      ),
    ];
    // One shared style name → mint under imported.text.<style> (v17).
    // Multiple names (Avatar Size=xs/xl/2xl) → keep the component path and
    // attach EACH occurrence's exact style name/key to its axis leaf so emit
    // recreates semantic identity instead of sanitizing it away.
    const varyingStyle =
      varyingStyleNames.length === 1 ? varyingStyleNames[0] : undefined;
    const varyingStyleKey =
      varyingStyle && varyingStyleKeys.length === 1
        ? varyingStyleKeys[0]
        : undefined;
    const perOccStyles = varyingStyle === undefined && varyingStyleNames.length > 1;
    if (perOccStyles) {
      ctx.notes.push(
        `${where}: typography varies across variants (fontSize ${distinctSizes.join('/')}, weight ${distinctWeights.join('/')}) with distinct text styles (${varyingStyleNames.join(', ')}) — font-size ${ctx.mint ? 'minted per variant with per-leaf text-style identity (exact Figma style name/key)' : 'not proposed without minting'}${distinctWeights.length > 1 ? '; font-weight minted per variant through the weight-name table where every name maps (unknown names stay NAMED)' : ''}`,
      );
    } else {
      ctx.notes.push(
        `${where}: typography varies across variants (fontSize ${distinctSizes.join('/')}, weight ${distinctWeights.join('/')}) — ${varyingStyle ? `shared text style "${varyingStyle}" kept as identity; ` : ''}font-size ${ctx.mint ? 'minted per variant where axis-correlated' : 'not proposed without minting'}${distinctWeights.length > 1 ? '; font-weight minted per variant through the weight-name table where every name maps (unknown names stay NAMED)' : ''} (review)`,
      );
    }
    if (!ctx.mint && varyingStyleNames.length > 0) {
      refuseTextStyleIdentity(
        ctx,
        `${where}: named text style(s) ${varyingStyleNames.map((n) => JSON.stringify(n)).join(', ')} observed but minting is off — exact style identity cannot be proposed`,
      );
    }
    reportUnbound(ctx, where, 'fontSize', t.fontSize);
    const sizeOcc = textOcc.map((o) => ({
      variant: o.variant,
      value: o.node.text!.fontSize,
      ...(perOccStyles && o.node.text!.style !== undefined
        ? {
            styleName: o.node.text!.style,
            ...(o.node.text!.styleKey !== undefined
              ? { styleKey: o.node.text!.styleKey }
              : {}),
          }
        : {}),
    }));
    mintObservation(
      ctx,
      tokens,
      where,
      'font-size',
      'px',
      sizeOcc,
      `${where}|fontSize`,
      undefined,
      varyingStyle,
      varyingStyleKey,
    );
    mintTextChannels(
      m,
      tokens,
      ctx,
      where,
      { weight: true },
      varyingStyle,
      varyingStyleKey,
      perOccStyles ? textOcc : undefined,
    );
    return tokens;
  }
  // dump v1.19 — FC-WEIGHT-IDENTITY. A bound fontSize VARIABLE names the size
  // token OUTRIGHT, so it is read before any value match. It is the carrier
  // the writer falls back to when a node cannot ride a named text style —
  // the contract binds a style group's size and overrides that group's
  // weight, and Figma clears textStyleId on any fontName write, so the style
  // cannot hold both facts. Reading the variable back is what lets such a
  // node round-trip at all: a value match provably cannot, because 14px is
  // BOTH font.control.size.sm and font.avatar.size.md and the reader must
  // never pick between them.
  const sizeVars = [...new Set(textOcc.map((o) => o.node.text!.fontSizeVar))];
  const sizeVar = sizeVars.length === 1 ? sizeVars[0] : undefined;
  if (sizeVar !== undefined) {
    tokens['font-size'] = ref(sizeVar);
    // The weight rode no style either, so it is the node's own fontStyle.
    // 'Medium' is the runtime text default and stays canvas-indistinguishable
    // from carrying no weight token — the SAME rule the style path applies,
    // so a node that merely happens to bind its size proposes exactly what it
    // used to. A non-default weight is a real canvas fact and carries as the
    // corpus token that spells it, or mints when the corpus cannot name it.
    const observed = t.fontStyle ?? 'Medium';
    let weightRef: string | undefined;
    // The STAMPED weight token (dump v1.22) is read before any inference, for
    // the same reason the size variable is: it names WHICH token was drawn,
    // where the face name only names a shape. It also settles the case this
    // branch used to drop in silence — 'Medium' is drawn both by a contract
    // declaring 500 and by one declaring nothing, and only the stamp tells
    // them apart. Recovering the original ref (not a fresh mint) is the whole
    // point: the value survived either way, the IDENTITY only survives here.
    const stampedWeight = [...new Set(textOccWeightVars(m))];
    if (stampedWeight.length === 1 && stampedWeight[0] !== undefined) {
      tokens['font-weight'] = ref(stampedWeight[0]);
      mintTextChannels(m, tokens, ctx, where, { weight: false });
      return tokens;
    }
    if (stampedWeight.length > 1) {
      ctx.notes.push(
        `${where}: the weight token differs across variants (${stampedWeight.map((w) => `"${w}"`).join(', ')}) — one text node carries one font-weight binding, so it is NAMED, not proposed; review`,
      );
    }
    if (observed !== 'Medium') {
      weightRef = weightTokenRef(ctx, observed);
      if (weightRef) tokens['font-weight'] = weightRef;
      else {
        ctx.notes.push(
          `${where}: font weight "${observed}" is drawn on a node riding no text style and the corpus does not spell it with exactly one weight token — minted rather than bound to a guess (review)`,
        );
      }
    }
    mintTextChannels(m, tokens, ctx, where, {
      weight: observed !== 'Medium' && weightRef === undefined,
    });
    return tokens;
  }
  const styleNames = [...new Set(m.occ.map((o) => o.node.text?.style).filter((s) => s !== undefined))];
  const styleKeys = [
    ...new Set(
      m.occ
        .map((o) => o.node.text?.styleKey)
        .filter((key) => key !== undefined),
    ),
  ];
  // Uniform size/weight with DIFFERENT named styles is contradictory identity
  // for one binding — never pick styleNames[0]. Exact fails closed; reviewable
  // notes and continues without inventing a winner.
  if (styleNames.length > 1) {
    refuseTextStyleIdentity(
      ctx,
      `${where}: text style names differ across variants (${styleNames.join(', ')}) while fontSize/weight are uniform — cannot pick one identity`,
    );
  }
  const soleStyleName = styleNames.length === 1 ? styleNames[0] : undefined;
  let style = soleStyleName ? ctx.corpus.textStyleByName.get(soleStyleName) : undefined;
  // v17 — a NAMED Figma text style with no token-derived counterpart. This
  // used to end the road ("typography not proposed") and the size/weight/
  // line-height then minted under the component/part path, so ONE style became
  // as many unrelated token families as there were parts drawing it: Eventz
  // draws `body/sm` on 52 nodes across five sets and got five copies of
  // 14px/500/20px under names like `atoms-tag.label.font-size`. A text style
  // IS design-system vocabulary — the designer named it — so the typography
  // now mints under `imported.text.<style>`, shared across every component
  // that rides it. The style still is not TOKEN-derived, and that stays named.
  const unresolvedStyle = soleStyleName && !style ? soleStyleName : undefined;
  const unresolvedStyleKey =
    unresolvedStyle && styleKeys.length === 1 ? styleKeys[0] : undefined;
  if (unresolvedStyle) {
    ctx.notes.push(
      `${where}: rides text style "${unresolvedStyle}" which is not a token-derived style (the kit binds no variable to its typography) — minted under the STYLE's own name as \`imported.text.${unresolvedStyle.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase()}\`, shared by every part riding it; rename against your real type tokens (provisional)`,
    );
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
    // No token-derived style identity — mint the literal size, under the
    // style's name when the node rides one (v17).
    mintObservation(
      ctx, tokens, where, 'font-size', 'px', numOccurrences(m, (n) => n.text?.fontSize),
      undefined, undefined, unresolvedStyle, unresolvedStyleKey,
    );
  } else if (soleStyleName) {
    // Named style observed, no corpus identity, minting off — exact cannot
    // preserve semantic identity; reviewable names the gap and continues.
    refuseTextStyleIdentity(
      ctx,
      `${where}: named text style ${JSON.stringify(soleStyleName)} observed but minting is off — exact style identity cannot be proposed`,
    );
  }
  // Channels OUTSIDE the style identity: font-weight through the bounded
  // weight-name table when no derived style matched (the identity path stays
  // the PREFERRED route — a matched style already carries its weight token);
  // PIXEL line-height always (a text style's definition does not carry it).
  // Field case: the CBDS Tooltip title drawn "Semi Bold" at 12/16 rendered
  // un-bold and mis-proportioned when both channels were note-only.
  mintTextChannels(
    m,
    tokens,
    ctx,
    where,
    { weight: !style },
    unresolvedStyle,
    unresolvedStyleKey,
  );
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
  // BASELINE is the fourth documented DumpLayout.counter value (extract/figma/
  // types.ts) and Figma sets it natively on HORIZONTAL auto-layout. Its CSS
  // twin is `align-items: baseline` — a fact both surfaces express, so it
  // CARRIES like the other three rather than dropping. It used to fall
  // through this map to `undefined` and land nowhere: no `align` in the
  // layout block and no note in the naming union — the SILENT-LOSS class.
  // (Canvas conformance: layout-align-baseline.)
  BASELINE: 'baseline',
};

/** align:stretch evidence — the exact artifact the generator leaves: a column
 *  parent whose eligible children (FRAME/TEXT, no bound width; instances are
 *  excluded from the generator's stretch path) ALL carry fill-width. */
function stretchEvidence(m: Merged): boolean {
  const l = m.occ[0].node.layout;
  if (!l || (l.mode !== 'VERTICAL' && l.mode !== 'HORIZONTAL')) return false;
  // A COLUMN stretches its children's WIDTH (fillWidth); a ROW stretches
  // their HEIGHT (dump v1.31 fillHeight — the vertical twin, Phase 2 exam).
  const dim = l.mode === 'VERTICAL' ? 'width' : 'height';
  const fillField = l.mode === 'VERTICAL' ? 'fillWidth' : 'fillHeight';
  const eligible = m.children.filter((c) => {
    const n = c.occ[0].node;
    return (n.type === 'FRAME' || n.type === 'TEXT') && !n.bound?.[dim];
  });
  if (eligible.length === 0) return false;
  return eligible.every((c) => c.occ.every((o) => o.node[fillField] === true));
}

/** dump v1.31 — the CROSS-AXIS half of a FILL that the parent's `align:
 *  stretch` did NOT absorb (stretchEvidence needs EVERY eligible sibling to
 *  fill; here only this part does). Under a parent whose cross axis is
 *  DEFINITE (FIXED sizing mode, a bound size, or a captured box) the exact
 *  CSS spelling is the part's own `100%` literal on that axis — the same
 *  carrier crossAxisFillByProp already uses for the COLUMN planes. Under a
 *  HUG parent no grammar spelling is exact (`100%` of an auto height is
 *  auto; `align-self` is not in the schema), so the fact is NAMED. The
 *  vertical case (fillHeight under a ROW) is the Phase 2 exam construct; the
 *  horizontal twin (fillWidth under a COLUMN, partial siblings) was silent
 *  for the same reason and is named here without changing its bytes. */
function carryCrossAxisFill(
  m: Merged,
  parentModes: ParentModes | null,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
): void {
  if (!parentModes || parentModes.stretchCross) return; // the parent's align: stretch owns it
  const base = parentModes.base;
  if (base !== 'HORIZONTAL' && base !== 'VERTICAL') return;
  const dim = base === 'HORIZONTAL' ? 'height' : 'width';
  const fillField = base === 'HORIZONTAL' ? 'fillHeight' : 'fillWidth';
  const filling = m.occ.filter((o) => o.node[fillField] === true).length;
  if (filling === 0) return;
  if (parentModes.byVariant.size > 0 && [...parentModes.byVariant.values()].some((mode) => mode !== base)) {
    // Mixed parent modes — crossAxisFillByProp's door for a FILL drawn on
    // the same axis in EVERY occurrence; whatever that door did not take
    // (a fill on one axis in one variant and the other axis in the next) is
    // accounted PER VARIANT here, never dropped at the door.
    nameCrossAxisFillByVariant(m, parentModes, part, ctx, where);
    return;
  }
  if (m.occ.some((o) => o.node.bound?.[dim] !== undefined) || (part.tokens as Record<string, string> | undefined)?.[dim] !== undefined) return;
  if (filling !== m.occ.length) {
    ctx.notes.push(
      `${where}: drawn FILL-${dim} under a ${base === 'HORIZONTAL' ? 'ROW' : 'COLUMN'} parent in ${filling}/${m.occ.length} variant occurrence(s) only — the cross-axis stretch has no per-variant spelling; NAMED, not carried (review)`,
    );
    return;
  }
  if (dim === 'width') {
    // The horizontal twin keeps its bytes (no existing fixture changes): named.
    ctx.notes.push(
      `${where}: drawn FILL-width under a COLUMN parent whose other children do not all fill — the parent cannot carry \`align: stretch\` for this part alone and the contract has no per-part align-self; the cross-axis stretch is NAMED, not carried (review)`,
    );
    return;
  }
  if (!parentModes.crossDefinite) {
    ctx.notes.push(
      `${where}: drawn FILL-height under a ROW parent that HUGS its height (dump v1.31 fillHeight) — the parent cannot carry \`align: stretch\` for this part alone (its other children hug) and \`height: 100%\` of an auto height is auto, so no grammar spelling is exact; the cross-axis stretch is NAMED, not carried (review)`,
    );
    return;
  }
  const literals = (part.literals as Record<string, string> | undefined) ?? {};
  if (literals.height !== undefined) return;
  literals.height = '100%';
  part.literals = literals;
  ctx.notes.push(
    `${where}: drawn FILL-height under a ROW parent with a DEFINITE height (dump v1.31 fillHeight; the parent's other children hug, so the parent's \`align: stretch\` cannot carry it) — carried as the part literal \`height: 100%\` (the cross-axis stretch against the parent's definite box, the same carrier crossAxisFillByProp uses for width)`,
  );
}

/** PER-VARIANT accounting for the cross-axis FILL under a parent whose
 *  direction differs by variant (canvas conformance layout-fill-height-
 *  parent-mode-by-variant; Phase 2 exam: Card:Variant=Inline/Container/Image
 *  — the Container is a COLUMN in Default and a ROW in Inline, and the Image
 *  draws FILL-width under the one and FILL-height under the other). Each
 *  occurrence is read against ITS OWN parent mode: the cross axis of that
 *  variant, whether the FILL is drawn on it, and whether that variant's
 *  parent is definite there. A plane crossAxisFillByProp owns (the FILL
 *  drawn on the same axis in every occurrence) is skipped — it carried or
 *  named it already. The rest has no exact per-variant spelling
 *  (`align-self` is not in the schema, the parent's `align: stretch` would
 *  stretch its other children, and a `100%` literal resolves against a
 *  definite box only), so it is NAMED per variant. It used to return at
 *  the mixed-modes door with no note — the SILENT-LOSS class. */
function nameCrossAxisFillByVariant(
  m: Merged,
  parentModes: ParentModes,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
): void {
  const everyWidth = m.occ.every((o) => o.node.fillWidth === true);
  const everyHeight = m.occ.every((o) => o.node.fillHeight === true);
  const tokens = part.tokens as Record<string, string> | undefined;
  const facts: string[] = [];
  for (const o of m.occ) {
    const mode = parentModes.byVariant.get(o.variant) ?? parentModes.base;
    if (mode !== 'HORIZONTAL' && mode !== 'VERTICAL') continue;
    const dim = mode === 'HORIZONTAL' ? 'height' : 'width';
    const fillField = mode === 'HORIZONTAL' ? 'fillHeight' : 'fillWidth';
    if (o.node[fillField] !== true) continue;
    if (dim === 'width' ? everyWidth : everyHeight) continue; // crossAxisFillByProp's plane
    if (o.node.bound?.[dim] !== undefined || tokens?.[dim] !== undefined) continue; // a carrier exists
    const definite = parentModes.crossDefiniteByVariant?.get(o.variant) === true;
    facts.push(
      `${o.variant}: FILL-${dim} under a ${mode === 'HORIZONTAL' ? 'ROW' : 'COLUMN'} parent that ${definite ? `has a DEFINITE ${dim}` : `HUGS its ${dim}`}`,
    );
  }
  if (facts.length === 0) return;
  ctx.notes.push(
    `${where}: drawn ${facts.join('; ')} — the parent's auto-layout mode differs by variant, so the cross-axis stretch is a per-variant fact on a per-variant axis with no exact grammar spelling (\`align-self\` is not in the schema, the parent's \`align: stretch\` would stretch its other children, and a per-variant \`100%\` literal resolves against a definite box only); NAMED per variant, not carried (review)`,
  );
}

/** GAP-CLOSING ROUND 6 — the parent's auto-layout MODE is not one scalar when
 *  the parent's own direction is a FUNCTION of an axis. Figma's FILL is one
 *  flag with two meanings: along the parent's PRIMARY axis it grows, ACROSS
 *  that axis it stretches. `buildChildParts`/`buildPart` used to hand every
 *  child ONE mode — the default variant's — so a child drawn fillWidth under
 *  a parent that is a ROW in the default variant and a COLUMN in others got
 *  the row meaning everywhere and filled the wrong dimension. (Field case:
 *  UUI ProgressBar — root HORIZONTAL for label=right|false, VERTICAL for
 *  bottom|topFloating|bottomFloating; the 320px track shrink-wrapped to
 *  112px and `align-items: flex-end` pushed it 208px right.)
 *
 *  `base` is the DEFAULT variant's mode — every pre-existing rule reads it
 *  and its meaning is unchanged, so a parent with ONE mode across every
 *  variant proposes exactly the bytes it always did. */
interface ParentModes {
  base: 'HORIZONTAL' | 'VERTICAL' | 'GRID' | null;
  /** variant name → that variant's parent auto-layout mode. */
  byVariant: Map<string, 'HORIZONTAL' | 'VERTICAL' | 'GRID' | null>;
  /** dump v1.31 — the parent carries `align: stretch` (stretchEvidence): every
   *  eligible child fills the cross axis, so no child needs its own carrier. */
  stretchCross?: boolean;
  /** dump v1.31 — the parent's CROSS axis is definite in every variant (FIXED
   *  sizing mode, a bound size, or a captured box), so a child's `100%` on
   *  that axis resolves against a real length. */
  crossDefinite?: boolean;
  /** PER-VARIANT twin of crossDefinite (canvas conformance layout-fill-
   *  height-parent-mode-by-variant): variant name → whether THAT variant's
   *  parent is definite on its OWN cross axis (the axis a child's FILL
   *  stretches across in that variant). A parent whose direction is a
   *  function of the axis has a different cross axis per variant, so one
   *  scalar cannot answer for it. */
  crossDefiniteByVariant?: Map<string, boolean>;
  /** A2 grid (dump v1.17): the parent's grid-carriage decision — a PURE
   *  function of the dump (gridCarriageOf), computed once here so the parent
   *  layout (invertGridLayout) and the children's placement attach
   *  (attachGridPlacement) can never disagree. Set exactly when base is
   *  'GRID'. */
  grid?: GridCarriage;
}

/** The per-variant parent-mode witness for a parent's children. */
function parentModesOf(m: Merged, mint: boolean): ParentModes {
  const byVariant = new Map<string, 'HORIZONTAL' | 'VERTICAL' | 'GRID' | null>();
  for (const o of m.occ) byVariant.set(o.variant, o.node.layout?.mode ?? null);
  const base = m.occ[0]?.node.layout?.mode ?? null;
  const grid = gridCarriageOf(m, mint); // undefined unless the base layout is GRID
  const crossDim = base === 'HORIZONTAL' ? 'height' : base === 'VERTICAL' ? 'width' : null;
  const crossDefinite =
    crossDim !== null &&
    m.occ.every(
      (o) =>
        o.node.layout?.counterSizing === 'FIXED' ||
        o.node.bound?.[crossDim] !== undefined ||
        o.node.bbox?.[crossDim] !== undefined ||
        o.node.fixedSize?.[crossDim] !== undefined ||
        o.node.abs !== undefined,
    );
  const crossDefiniteByVariant = new Map<string, boolean>();
  for (const o of m.occ) {
    const mode = o.node.layout?.mode ?? null;
    const dim = mode === 'HORIZONTAL' ? 'height' : mode === 'VERTICAL' ? 'width' : null;
    crossDefiniteByVariant.set(
      o.variant,
      dim !== null &&
        (o.node.layout?.counterSizing === 'FIXED' ||
          o.node.bound?.[dim] !== undefined ||
          o.node.bbox?.[dim] !== undefined ||
          o.node.fixedSize?.[dim] !== undefined ||
          o.node.abs !== undefined),
    );
  }
  return { base, byVariant, stretchCross: stretchEvidence(m), crossDefinite, crossDefiniteByVariant, ...(grid ? { grid } : {}) };
}

// ---------------------------------------------------------------------------
// A2 grid inversion (dump v1.17 → layout.display: "grid" — the G6 propose row)
// ---------------------------------------------------------------------------

/** Canvas align enum → contract vocabulary (P3/P4: exactly these three plus
 *  AUTO, which the dump omits — STRETCH/BASELINE do not exist on the API). */
const GRID_ALIGN_INV: Record<string, 'start' | 'center' | 'end'> = {
  MIN: 'start',
  CENTER: 'center',
  MAX: 'end',
};

interface GridCarriage {
  carried: boolean;
  /** ROW_AUTO_FLOW (G5) — placement fact is CHILD ORDER; children carry no
   *  placement and repeat runs stay legal. */
  flow: boolean;
  /** Set when carried is false — the NAMED refusal invertGridLayout notes.
   *  Silence is never an option: every uncarried grid states its construct. */
  reason?: string;
}

/** The PURE grid-carriage decision for a parent Merged whose default variant
 *  draws layoutMode GRID. Writes nothing — invertGridLayout turns the reason
 *  into the proposal note; parentModesOf caches the result for the children.
 *  Rules (refuse-dont-guess, each refusal names its probe):
 *   · no `grid` facts → pre-v1.17 producer, refuse (not an empty grid);
 *   · track outside {px>0}|{fr>0}|{fit:true} → refuse (P2b fence);
 *   · flow: declared rows must be EXACTLY the emitter's derivation —
 *     ceil(children/columns) × {fr:1} (stampGridCells) — or the round trip
 *     would silently redraw the tracks (P9);
 *   · manual: every child must carry a captured cell (an ABSOLUTE overlay
 *     child has no grid-part spelling contract-side — validateGridPart counts
 *     any non-overlay child as in-flow, and Part.overlay is the edge-attached
 *     v7 grammar, a different fact), cells must sit inside the declared
 *     tracks (grid-implicit-tracks, P9) and must not overlap (P3's occupancy
 *     throw, refused contract-side). */
function gridCarriageOf(m: Merged, mint: boolean): GridCarriage | undefined {
  // The BASE layout is the first occurrence that has one — the same rule
  // invertLayout's `layouts[0]` applies to the flex path.
  const l = m.occ.map((o) => o.node.layout).find((x) => x !== undefined);
  if (!l || l.mode !== 'GRID') return undefined;
  const g = l.grid;
  if (!g) {
    return {
      carried: false,
      flow: false,
      reason:
        'layoutMode GRID captured WITHOUT grid facts (pre-v1.17 producer) — no layout block proposed; anatomy under it is order-only',
    };
  }
  const flow = g.flow === 'row';
  const badTrack = [...g.rows, ...g.columns].find(
    (t) => !(t.fit === true || (typeof t.px === 'number' && t.px > 0) || (typeof t.fr === 'number' && t.fr > 0)),
  );
  if (badTrack) {
    return {
      carried: false,
      flow,
      reason: `captured track ${JSON.stringify(badTrack)} is outside the carriable vocabulary ({px>0} | {fr>0} | {fit:true} — the grid-track-zero/grid-track-percent fence, P2b)`,
    };
  }
  if (g.columns.length === 0 || (!flow && g.rows.length === 0)) {
    return { carried: false, flow, reason: 'empty declared track list — a grid contract requires declared tracks (G1)' };
  }
  if (flow) {
    // G5′ (2026-08-08) — declared rows under flow are CARRIED. GP6/GP6b measured
    // gridItemsPositioning='ROW_AUTO_FLOW' and declared gridRowSizes coexisting
    // natively, in either write order, with anchors still computed row-major
    // from child order (P5). The old gate admitted flow ONLY when the drawn rows
    // already equalled the emitter's derivation, and refused every other flow
    // grid rather than silently redraw its tracks — a restriction inferred from
    // P9 (which is about OVERFLOW) and over-applied. What survives from it is
    // the OVERFLOW bound: GP10 measured 5 children over 2 columns with 2
    // declared rows reaching anchor row 2 while gridRowCount stayed 2 and
    // gridRowSizes stayed two entries — P9's lossy readback, reproduced under
    // declared rows.
    const needed = Math.max(1, Math.ceil(m.children.length / g.columns.length));
    if (g.rows.length < needed) {
      return {
        carried: false,
        flow,
        reason:
          `ROW_AUTO_FLOW grid whose ${g.rows.length} declared row track(s) do not cover the flow — ` +
          `${m.children.length} child(ren) over ${g.columns.length} column(s) occupy ${needed} row(s), so children ` +
          'flow PAST the declared list while gridRowCount stays put (GP10; the grid-implicit-tracks refusal, P9)',
      };
    }
    return { carried: true, flow };
  }
  // G9.2 (2026-08-08) — an ABSOLUTE child no longer takes the whole grid down.
  // `abs` (dump v1.7) is POSITIVE evidence the child is layoutPositioning
  // ABSOLUTE: the dump gates `cell` capture on exactly that (P13 — absolute
  // children still REPORT anchors 0,0), so the missing cell is the gate working,
  // not a capture gap. What is genuinely missing is only the abs→Part.overlay
  // EDGE inversion, and that is refused PERMANENTLY on arity
  // (`grid-overlay-edge-inversion`, G9.1): the enum is four values with no
  // offset channel while the canvas fact is a point in R². But the overlay
  // spelling was never the only out-of-flow door — carryAbsPlacement inverts
  // `abs` into position:absolute + minted insets, losing no coordinate, and it
  // is how absolute children are carried under every OTHER parent kind. So the
  // child rides that door and the grid, its tracks and every sibling placement
  // are carried whole. The grid still refuses when THAT door is shut, and the
  // refusal names which condition shut it — carryAbsPlacement's own three:
  // partial capture, a wrapper-union synthetic clone, or minting off.
  const outOfFlow = new Set<string>();
  for (const c of m.children) {
    if (c.occ.some((o) => o.node.cell !== undefined)) continue;
    const absOcc = c.occ.filter((o) => o.node.abs !== undefined);
    if (absOcc.length === 0) {
      return {
        carried: false,
        flow,
        reason:
          `child "${c.name}" carries no grid cell and no \`abs\` — a pre-v1.17 capture (the producer predates the cell ` +
          'channel), which is NOT the same fact as "cell 0,0": a manual grid contract must place every in-flow child (G2), ' +
          'and inventing anchors for an unmeasured child is exactly what this refusal exists to prevent; grid not carried',
      };
    }
    const shut =
      absOcc.length !== c.occ.length
        ? `its \`abs\` box is captured on ${absOcc.length}/${c.occ.length} variant(s) only`
        : c.occ.some((o) => (o.node as { __synthetic?: boolean }).__synthetic === true)
          ? 'its box rides a wrapper-union SYNTHETIC clone (a clone is not an observation)'
          : !mint
            ? 'minting is off, so the per-variant px offsets have no carrier'
            : null;
    if (shut) {
      return {
        carried: false,
        flow,
        reason:
          `child "${c.name}" is an ABSOLUTE overlay inside the grid (dump \`abs\` present, no \`cell\` — P13's gate ` +
          `working as designed) and the out-of-flow door is shut: ${shut}. It would therefore render IN FLOW, in a grid ` +
          'that must place every in-flow child (G2), so the grid is not carried. The edge spelling is not the blocker — ' +
          'that is refused permanently and separately (grid-overlay-edge-inversion, G9.1)',
      };
    }
    outOfFlow.add(c.name);
  }
  const rects = m.children
    .filter((c) => !outOfFlow.has(c.name))
    .map((c) => {
      const cell = c.occ.find((o) => o.node.cell !== undefined)!.node.cell!;
      return { name: c.name, r: cell.row, c: cell.column, rs: cell.rowSpan ?? 1, cs: cell.columnSpan ?? 1 };
    });
  for (const x of rects) {
    if (x.r + x.rs > g.rows.length || x.c + x.cs > g.columns.length) {
      return {
        carried: false,
        flow,
        reason:
          `child "${x.name}" occupies beyond the declared tracks (anchor ${x.r},${x.c} span ${x.rs}×${x.cs} vs ` +
          `${g.rows.length}×${g.columns.length} declared) — implicit tracks are refused BY NAME (grid-implicit-tracks, P9)`,
      };
    }
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.r < b.r + b.rs && b.r < a.r + a.rs && a.c < b.c + b.cs && b.c < a.c + a.cs) {
        return {
          carried: false,
          flow,
          reason:
            `children "${a.name}" and "${b.name}" overlap on the grid — placements+spans may not occupy the same cell ` +
            "(P3's occupancy throw, refused contract-side)",
        };
      }
    }
  }
  return { carried: true, flow };
}

/** GRID layout inversion (the G6 propose obligation): tracks verbatim
 *  ({px}|{fr}|{fit:true} — the dump already speaks the normalized spelling),
 *  the independent gap pair (bound gap variables become token refs — P2:
 *  gridRowGap/gridColumnGap are separate facts), flow 'row' with rows OMITTED
 *  (the schema derives them, G5). Every uncarried grid is a NAMED note. */
function invertGridLayout(
  m: Merged,
  carriage: GridCarriage | undefined,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | undefined {
  const c = carriage ?? gridCarriageOf(m, ctx.mint !== undefined);
  if (!c) return undefined;
  // Per-variant grid variance has NO carrier: layoutByProp is refused on grid
  // parts (P10 — a mode switch physically destroys tracks) — the DEFAULT
  // variant's grid stands, and the collapse is named (the invertLayout
  // uncorrelated-spread precedent).
  const spellings = new Set(
    m.occ
      .filter((o) => o.node.layout !== undefined)
      .map((o) => JSON.stringify([o.node.layout!.mode, o.node.layout!.grid ?? null])),
  );
  if (spellings.size > 1) {
    ctx.notes.push(
      `${where}: GRID layout differs across variants (mode or grid facts) — a grid part has no per-variant layout vocabulary (layoutByProp is refused on grid parts; P10: a mode switch destroys tracks), so the DEFAULT variant's grid is carried for every variant; review`,
    );
  }
  if (!c.carried) {
    ctx.notes.push(`${where}: GRID drawn but NOT carried — ${c.reason}`);
    return undefined;
  }
  const l = m.occ.map((o) => o.node.layout).find((x) => x !== undefined)!;
  const g = l.grid!;
  const toTrack = (t: NonNullable<typeof g.rows>[number]): Record<string, unknown> =>
    t.fit === true ? { fit: true } : t.px !== undefined ? { px: t.px } : { fr: t.fr as number };
  const out: Record<string, unknown> = { display: 'grid' };
  // G5′: declared rows under flow ARE a contract fact now — but the emitter's
  // OWN derivation (ceil(children/columns) × {fr:1}) is not. Carrying that back
  // would turn a derived track list into a declared one and the round trip
  // would stop being identity, so it stays omitted; anything else is the
  // author's and is carried verbatim.
  const derivedRows = Math.max(1, Math.ceil(m.children.length / Math.max(1, g.columns.length)));
  const rowsAreTheDerivation =
    g.rows.length === derivedRows && g.rows.every((t) => t.fr === 1);
  if (!c.flow || !rowsAreTheDerivation) out.rows = g.rows.map(toTrack);
  // G9.1 — the permanent refusal, receipted on every grid that carries an
  // absolute child through the abs door instead of Part.overlay.
  for (const ch of m.children) {
    if (ch.occ.some((o) => o.node.cell !== undefined)) continue;
    if (!ch.occ.some((o) => o.node.abs !== undefined)) continue;
    ctx.notes.push(
      `${where}/${ch.name}: ABSOLUTE child inside the grid carried OUT OF FLOW through the abs door (position: absolute + minted insets), NOT as Part.overlay — ${GRID_REFUSALS['grid-overlay-edge-inversion']}`,
    );
  }
  out.columns = g.columns.map(toTrack);
  const bound = m.occ[0].node.bound ?? {};
  const rowGap = bound['gridRowGap'] ? ref(bound['gridRowGap']) : g.rowGap;
  const columnGap = bound['gridColumnGap'] ? ref(bound['gridColumnGap']) : g.columnGap;
  if (rowGap !== 0 || columnGap !== 0) out.gap = { row: rowGap, column: columnGap };
  if (c.flow) out.flow = 'row';
  return out;
}

/** G8 (2026-08-08) — THE PROPOSER'S DEFINITE-AXIS OBLIGATION.
 *
 *  A grid part must make each axis definite (`grid-axis-indefinite`): the two
 *  surfaces resolve silence differently, because primary/counterAxisSizingMode
 *  are INERT on a GRID frame (GP1b/GP8) so the canvas keeps createFrame's FIXED
 *  100 while CSS takes content height. The canvas has the answer for every grid
 *  it drew — a sizing mode per axis — so the reader states it instead of
 *  leaving the schema to guess:
 *
 *    · AUTO (hug)  -> literals[axis] = "fit-content" (the CSS twin, the same
 *                     keyword invertRootFixedSize already mints for an all-HUG
 *                     root — ONE spelling, not two).
 *    · FIXED       -> literals[axis] = "<drawn>px" from fixedSize ?? bbox ?? abs.
 *
 *  Idempotent: an axis another door already made definite (mintFixedSize,
 *  carryAbsPlacement, a width token, layout.grow) is left alone. When an axis
 *  reads FIXED and NO box was captured, nothing is invented — the caller is
 *  told, by name, that the grid cannot be carried on that evidence.
 *
 *  NOTE the axis mapping: on a GRID frame the PRIMARY axis is HORIZONTAL
 *  (GP1b: primaryAxisSizingMode='AUTO' reads back as layoutSizingHorizontal
 *  'HUG'), like a HORIZONTAL auto-layout frame — not vertical. */
function carryGridAxisSizing(
  m: Merged,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
  /** The part's token record as it stands BEFORE attachTokens (the root
   *  attaches after this door) — with minting on, a size the mint pass will
   *  land there is already spoken for (a queued observation), and writing
   *  the G8 literal beside it is the one-channel-two-spellings contradiction
   *  the emitter refuses whole (grid-root-hug-height-fixed-conflict). */
  tokensRecord?: Record<string, string>,
): void {
  const layout = part.layout as Record<string, unknown> | undefined;
  if (layout?.display !== 'grid') return;
  const l = m.occ.map((o) => o.node.layout).find((x) => x !== undefined);
  if (!l) return;
  const tokens = { ...(tokensRecord ?? {}), ...((part.tokens ?? {}) as Record<string, string>) };
  for (const o of ctx.mint?.observations ?? []) {
    if (tokensRecord !== undefined && o.target === tokensRecord && (o.cssProperty === 'width' || o.cssProperty === 'height')) {
      tokens[o.cssProperty] ??= `(minted ${o.kind})`;
    }
  }
  const lits = (part.literals ?? {}) as Record<string, string>;
  const hasFr = (tracks: unknown): boolean =>
    Array.isArray(tracks) && tracks.some((t) => t !== null && typeof t === 'object' && 'fr' in (t as object));
  const missing: string[] = [];
  for (const axis of ['width', 'height'] as const) {
    // THE BOUND, mirrored from the schema referee (checkGridAxesDefinite): only
    // an axis whose declared tracks carry NO {fr} is at stake. A fraction
    // resolves against a size supplied from OUTSIDE the part on both surfaces,
    // so an fr-bearing axis is not a silence to close — and `fit-content` is
    // refused on it anyway (G8.2, `grid-hug-flex-axis`).
    const rowsDerived = layout.flow === 'row' && layout.rows === undefined;
    const axisHasFr =
      axis === 'width' ? hasFr(layout.columns) : rowsDerived || hasFr(layout.rows);
    if (axisHasFr) continue;
    if (lits[axis] !== undefined || tokens[axis] !== undefined) continue;
    if (axis === 'width' && layout.grow === true) continue;
    // GRID: primary = horizontal (GP1b).
    const mode = axis === 'width' ? l.primarySizing : l.counterSizing;
    if (mode === 'AUTO') {
      lits[axis] = 'fit-content';
      ctx.notes.push(
        `${where}: grid ${axis} axis drawn HUG — carried as literals.${axis} "fit-content" (G8: the CSS twin of Figma HUG; absence would resolve as FIXED 100 on canvas and content-size in CSS — FC-GRID-ROOT-VSIZE)`,
      );
      continue;
    }
    const box = m.occ.map((o) => o.node.fixedSize?.[axis] ?? o.node.bbox?.[axis] ?? o.node.abs?.[axis]).find((v) => typeof v === 'number');
    if (typeof box === 'number') {
      lits[axis] = `${Math.round(box)}px`;
      ctx.notes.push(
        `${where}: grid ${axis} axis drawn FIXED — carried as literals.${axis} ${lits[axis]} (G8: a grid axis must be definite; the drawn box is the evidence)`,
      );
      continue;
    }
    missing.push(`${axis}: drawn ${String(mode ?? 'UNKNOWN')} with no captured box (fixedSize/bbox/abs all absent)`);
  }
  if (missing.length > 0) {
    ctx.notes.push(
      `${where}: GRID drawn but NOT carried — ${GRID_REFUSALS['grid-axis-indefinite']}; unresolved: ${missing.join('; ')}`,
    );
    delete part.layout;
    // A dropped grid takes its children's cells with it: `placement` is a
    // grid-cell fact and is schema-invalid without a grid parent (G2).
    for (const child of Object.values((part.parts ?? {}) as Record<string, Record<string, unknown>>)) {
      delete child.placement;
    }
    return;
  }
  if (Object.keys(lits).length > 0) part.literals = lits;
}

/** G2 placement attach — runs where the part was built (buildChildParts), so
 *  every part class (text, spacer, slot wrapper, instance ref, frame) takes
 *  its cell through ONE door. No-op unless the parent's grid carried in
 *  MANUAL mode (under flow the placement fact is child order, P5). Spans of 1
 *  and AUTO aligns are omitted (the emitter's own minimal-spec rule). */
function attachGridPlacement(
  m: Merged,
  parentModes: ParentModes | null,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
): void {
  const g = parentModes?.grid;
  const drawnCells = m.occ.filter((o) => o.node.cell !== undefined);
  if (!g || !g.carried || g.flow) {
    // Design→code census (2026-08-23): a MANUALLY placed cell drawn in SOME
    // variant of a grid whose carried projection auto-flows (or whose grid
    // did not carry) used to drop with no receipt — Section Header's Center
    // variant anchors its Container at column 2, span 8, MAX while the
    // Default variant auto-flows, and the placement vanished in silence.
    // There is still no per-variant placement vocabulary (P10), so the fact
    // is NAMED, never carried and never silent.
    if (drawnCells.length > 0) {
      ctx.notes.push(
        `${where}: grid cell placement ${drawnCells
          .map((o) => `${JSON.stringify(o.node.cell)} [${o.variant}]`)
          .join('; ')} drawn in ${drawnCells.length}/${m.occ.length} variant(s) — the parent's grid ${!g ? 'did not carry' : g.flow ? 'auto-flows (placement under flow is child order, P5)' : !g.carried ? 'did not carry' : 'projection is the DEFAULT variant'} and placement has no per-variant vocabulary (layoutByProp is refused on grid parts, P10), so the manual cell is NAMED, not carried (review)`,
      );
    }
    return;
  }
  const cells = m.occ.map((o) => o.node.cell).filter((cell) => cell !== undefined);
  const cell = cells[0];
  if (!cell) return; // carriage refused grids with un-celled children — unreachable, kept safe
  if (new Set(cells.map((x) => JSON.stringify(x))).size > 1) {
    ctx.notes.push(
      `${where}: grid cell differs across variants — placement is a per-part invariant (layoutByProp is refused on grid parts, P10), so the DEFAULT variant's cell is carried; review`,
    );
  }
  const placement: Record<string, unknown> = { row: cell.row, column: cell.column };
  if (cell.rowSpan && cell.rowSpan > 1) placement.rowSpan = cell.rowSpan;
  if (cell.columnSpan && cell.columnSpan > 1) placement.columnSpan = cell.columnSpan;
  if (cell.alignX && GRID_ALIGN_INV[cell.alignX]) placement.alignX = GRID_ALIGN_INV[cell.alignX];
  if (cell.alignY && GRID_ALIGN_INV[cell.alignY]) placement.alignY = GRID_ALIGN_INV[cell.alignY];
  part.placement = placement;
}

/** G4 area→slot reconstruction: area NAMES cannot be read from the canvas
 *  (Figma has no native area names — the CONTRACT owns them), so the
 *  proposer re-enters them through the one place a name already exists: a
 *  SLOT part under a grid parent. Its placement rect hoists to
 *  layout.areas[<part key>] — the area name IS the slot anchor (G4) — and
 *  the explicit placement is removed (one source of truth; declaring both is
 *  schema-invalid). A slot whose cell carries non-AUTO aligns keeps explicit
 *  placement instead: GridAreaSchema has no alignment fields, and dropping
 *  an observed align would be silent loss. */
function hoistGridAreas(holder: Record<string, unknown>, ctx: Ctx, where: string): void {
  const layout = holder.layout as Record<string, unknown> | undefined;
  if (!layout || layout.display !== 'grid' || layout.flow === 'row') return;
  const parts = holder.parts as Record<string, Record<string, unknown>> | undefined;
  if (!parts) return;
  const areas: Record<string, Record<string, unknown>> = {};
  for (const [key, child] of Object.entries(parts)) {
    const placement = child.placement as Record<string, unknown> | undefined;
    if (!child.slot || !placement) continue;
    if (placement.alignX !== undefined || placement.alignY !== undefined) {
      ctx.notes.push(
        `${where}/${key}: slot part under a grid parent keeps EXPLICIT placement — its cell carries alignment, which an area rect cannot spell (GridAreaSchema is row/column/spans only); not hoisted to layout.areas`,
      );
      continue;
    }
    areas[key] = { ...placement };
    delete child.placement;
    ctx.notes.push(
      `${where}/${key}: slot part's grid cell hoisted to layout.areas["${key}"] — the area name IS the slot anchor (G4); the canvas cannot carry area names, the contract owns them`,
    );
  }
  if (Object.keys(areas).length > 0) layout.areas = areas;
  // G4's OTHER half, previously silent. Area NAMES are contract-owned — the
  // canvas holds rects only — so every non-slot child of a carried manual
  // grid comes back as an explicit `placement` longhand instead of an area.
  // That is the named LOWERED disposition `grid-area-nonrectangular` on the
  // code side (grid-template-areas cannot spell gapped or unnamed occupancy),
  // and until now the read side dropped the area spelling with no receipt at
  // all: a contract that went out with `layout.areas` came back with
  // placements and nothing said so. One note per grid, naming the parts.
  const placed = Object.entries(parts)
    .filter(([, child]) => child.placement !== undefined)
    .map(([key]) => key);
  if (placed.length > 0) {
    const hoisted = Object.keys(areas);
    ctx.notes.push(
      `${where}: ${placed.length} grid child(ren) (${placed.join(', ')}) carry EXPLICIT placement rects, not named areas — ` +
        'Figma has no native area names (G4: the CONTRACT owns them, the canvas carries only the rect), so an area name ' +
        'survives the round trip ONLY through a part that already has a name on the canvas: a SLOT node' +
        (hoisted.length > 0
          ? ` (${hoisted.length} did — ${hoisted.join(', ')})`
          : ' (none here did)') +
        '. The code side emits these as grid-row/grid-column LONGHANDS rather than grid-template-areas + grid-area — the ' +
        'named LOWERED disposition `grid-area-nonrectangular`. Nothing is lost geometrically; the NAMES are, and they are ' +
        're-authored contract-side, never invented from the canvas',
    );
  }
}

/** The CROSS-AXIS half of a per-variant FILL, carried inside the EXISTING
 *  `literalsByProp` vocabulary.
 *
 *  Fires ONLY when the parent's mode is MIXED across this part's own
 *  occurrences and the part draws fillWidth in every one of them. The
 *  variants whose parent is a COLUMN are a cross-axis stretch — `width:
 *  100%` — while the ROW variants keep the `layout.grow` the base plane
 *  already carries. The split must be a pure function of ONE declared ENUM
 *  axis with full value coverage (the layoutByProp discipline); anything
 *  less correlated is a NAMED refusal, never a silent guess.
 *
 *  Not re-spelled in the emitter on purpose: `layout.grow` has TWO
 *  provenances — Figma FILL on the design leg and an OBSERVED `flex: 1 1
 *  auto` on the code leg (examples/astryx dialog `inner`) — so changing what
 *  grow emits would drift a leg that never saw a Figma parent at all. The
 *  fact splits HERE, at the only place that knows the parent's mode per
 *  variant. Uniform parents are untouched: an all-ROW parent already carries
 *  grow, an all-COLUMN parent already carries the parent-side
 *  `align: stretch` (stretchEvidence / conformance layout-fill-width-column). */
function crossAxisFillByProp(
  m: Merged,
  parentModes: ParentModes | null,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
): void {
  if (!parentModes) return;
  const modes = m.occ.map((o) => ({
    variant: o.variant,
    mode: parentModes.byVariant.get(o.variant) ?? parentModes.base,
  }));
  const columns = modes.filter((x) => x.mode === 'VERTICAL');
  const rows = modes.filter((x) => x.mode === 'HORIZONTAL');
  if (columns.length === 0 || rows.length === 0) return; // uniform — the existing rules own it
  // The width plane (FILL-width: a stretch under the COLUMN variants) and its
  // twin, the height plane (FILL-height: a stretch under the ROW variants —
  // canvas conformance layout-fill-height-parent-mode-by-variant). Each fires
  // only when the part draws that FILL in EVERY occurrence.
  for (const dim of ['width', 'height'] as const) {
    if (!m.occ.every((o) => o.node[dim === 'width' ? 'fillWidth' : 'fillHeight'] === true)) continue;
    crossAxisFillByPropOn(dim, m, parentModes, modes, part, ctx, where);
  }
}

function crossAxisFillByPropOn(
  dim: 'width' | 'height',
  m: Merged,
  parentModes: ParentModes,
  modes: Array<{ variant: string; mode: 'HORIZONTAL' | 'VERTICAL' | 'GRID' | null }>,
  part: Record<string, unknown>,
  ctx: Ctx,
  where: string,
): void {
  const columns = modes.filter((x) => x.mode === 'VERTICAL');
  const rows = modes.filter((x) => x.mode === 'HORIZONTAL');
  // The planes where this FILL is the cross-axis STRETCH (carried as `100%`)
  // vs the planes where it is the primary-axis GROW (`layout.grow`).
  const stretchMode = dim === 'width' ? 'VERTICAL' : 'HORIZONTAL';
  const stretchPlane = dim === 'width' ? 'COLUMN' : 'ROW';
  const growPlane = dim === 'width' ? 'ROW' : 'COLUMN';
  if (dim === 'height') {
    // `height: 100%` of an auto height is auto: the ROW variants' parent must
    // be definite on its height, or the fact is NAMED (the same rule
    // carryCrossAxisFill applies to a uniform ROW parent).
    const hugging = modes.filter((x) => x.mode === 'HORIZONTAL' && parentModes.crossDefiniteByVariant?.get(x.variant) !== true);
    if (hugging.length > 0) {
      ctx.notes.push(
        `${where}: drawn FILL-height under a parent whose auto-layout mode CHANGES across variants (${rows.length} row, ${columns.length} column) and that HUGS its height on ${hugging.map((x) => x.variant).join(', ')} — the ROW plane(s)' cross-axis stretch has no exact spelling (\`height: 100%\` of an auto height is auto; the parent's \`align: stretch\` would stretch its other children); NAMED, not carried (review)`,
      );
      return;
    }
  }
  for (const axis of ctx.axes) {
    if (isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, 'HORIZONTAL' | 'VERTICAL' | 'GRID' | null>();
    let fits = true;
    for (const x of modes) {
      const value = axisValuesOf(x.variant)[axis.property];
      if (value === undefined) {
        fits = false;
        break;
      }
      const seen = byValue.get(value);
      if (seen !== undefined && seen !== x.mode) {
        fits = false;
        break;
      }
      byValue.set(value, x.mode);
    }
    if (!fits || !axis.values.every((v) => byValue.has(v))) continue;
    const lbp =
      (part.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | undefined) ?? [];
    // The referee's channel+prop rule: a second claimant on the axis would
    // make the cascade order the meaning.
    if (lbp.some((e) => e.prop !== axis.propName && Object.values(e.map).some((o) => dim in o))) break;
    let entry = lbp.find((e) => e.prop === axis.propName);
    if (!entry) {
      entry = { prop: axis.propName, map: {} };
      lbp.push(entry);
    }
    const stretched: string[] = [];
    for (const [value, mode] of byValue) {
      if (mode !== stretchMode) continue;
      const key = camel(value);
      if ((entry.map[key] ??= {})[dim] !== undefined) continue; // an observed size already claims it
      entry.map[key][dim] = '100%';
      stretched.push(key);
    }
    if (stretched.length === 0) return;
    part.literalsByProp = lbp;
    ctx.notes.push(
      `${where}: drawn FILL-${dim} under a parent whose auto-layout mode is a function of axis "${axis.property}" — a Figma FILL is a GROW along the parent's primary axis and a cross-axis STRETCH across it, so the two meanings split by variant: \`layout.grow\` carries the ${growPlane} plane(s) and the ${stretchPlane} plane(s) (${stretched.join(', ')}) carry ${dim}: 100% through literalsByProp on \`${axis.propName}\` (the cross-axis stretch). Carrying the default variant's meaning everywhere filled the wrong dimension`,
    );
    return;
  }
  ctx.notes.push(
    `${where}: drawn FILL-${dim} under a parent whose auto-layout mode CHANGES across variants (${rows.length} row, ${columns.length} column) without correlating to any variant axis — the cross-axis stretch is NOT carried (the ${growPlane.toLowerCase()} meaning, \`layout.grow\`, stands for every variant); review`,
  );
}

/** The PRIMARY-axis half of a Figma FILL — `layout.grow`. `base` is the
 *  DEFAULT variant's parent mode (the ROW meaning of FILL-width); where the
 *  parent's mode is MIXED the other planes' cross-axis stretch rides
 *  crossAxisFillByProp on top of this. dump v1.31 fillHeight is the vertical
 *  twin — a FILL along a COLUMN parent's primary axis is the same
 *  `layout.grow` (Phase 2 exam, rest-layout-sizing-vertical-fill).
 *
 *  ONE rule with ONE implementation: invertLayout (FRAME / spacer / swap-
 *  convention slot-wrapper parts) and the native SLOT branch of buildPart
 *  both read it here. The SLOT branch used to reach no grow rule at all
 *  (it never called invertLayout), so a native slot's primary-axis FILL —
 *  the Phase 2 exam's Card:Variant=Default/Image under its FIXED-width
 *  ROW — was silent on every variant (canvas conformance
 *  slot-primary-axis-fill + its REST twin, r10 2026-08-23). */
function primaryAxisGrow(m: Merged, parentModes: ParentModes | null): true | undefined {
  const parentMode = parentModes?.base ?? null;
  return (parentMode === 'HORIZONTAL' && m.occ.every((o) => o.node.fillWidth === true)) ||
    (parentMode === 'VERTICAL' && m.occ.every((o) => o.node.fillHeight === true))
    ? true
    : undefined;
}

function invertLayout(
  m: Merged,
  isRoot: boolean,
  parentModes: ParentModes | null,
  ctx: Ctx,
  where: string,
): Record<string, unknown> | undefined {
  const layouts = m.occ.map((o) => o.node.layout).filter((l) => l !== undefined);
  const l = layouts[0];
  // Per-variant layout differences are handled by invertLayoutByProp (which
  // notes an uncorrelated spread); the base layout is the default variant's.
  // The primary-axis FILL is primaryAxisGrow's rule (shared with the native
  // SLOT branch) — the cross-axis half rides crossAxisFillByProp /
  // carryCrossAxisFill, called next to every invertLayout site that owns a
  // stylable part.
  const grow = primaryAxisGrow(m, parentModes);
  if (!l) return grow ? { grow } : undefined;

  // A2 grid (dump v1.17): a GRID base layout inverts through its own door —
  // tracks/gaps/flow, refusals named. The grid part itself still composes as
  // an ordinary child of a flex parent (P11), so a computed `grow` rides the
  // grid block (grow is NOT in the schema's flex-only fence — G3/P11).
  if (l.mode === 'GRID') {
    // Carriage is recomputed here for THIS node (parentModes describes the
    // node's PARENT); gridCarriageOf is pure, so this and the children's
    // parentModesOf(m).grid can never disagree.
    const gridOut = invertGridLayout(m, undefined, ctx, where);
    if (!gridOut) return grow ? { grow } : undefined;
    if (grow) gridOut.grow = grow;
    return gridOut;
  }

  // r11: a native SLOT is a container BY DEFINITION — its children are the
  // consumer's, so its interior justify/align are facts even when no
  // design-time content is drawn (the exam's empty Card Content slot). Read
  // through the node class, not the drawn child count.
  const hasChildren = m.children.length > 0 || m.type === 'SLOT';
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
  // `?? 'MIN'` — primary/counter are OMITTED on GRID captures (dump v1.17);
  // this path is flex-only (the GRID delegate returned above), so an absent
  // field can only be a hand-authored fixture and MIN is the API default.
  const justify = JUSTIFY_INV[l.primary ?? 'MIN'];
  const align = ALIGN_INV[l.counter ?? 'MIN'] ?? (stretchEvidence(m) ? 'stretch' : undefined);
  // WRAPPING (dump v1.12) — COUNTED BEFORE THE isRoot EARLY RETURN, and that
  // ordering is the whole point. The emitter has written `node.layoutWrap =
  // 'WRAP'` from `layout.wrap` since v15 while the dump never read it back, so
  // a wrapping chip row returned as one overflowing line. The first cut of this
  // fix appended the carry BELOW the early return — where an adversarial probe
  // caught it doing nothing at all for a CENTERED wrapping root, which is the
  // motivating case: layoutWrap is HORIZONTAL-only in Figma, so every wrapping
  // root is `row` by construction and needs only centered justify+align to hit
  // the return. The guard already listed `!overlap` for exactly this reason —
  // a per-part invariant must not be swallowed by the "drawn at the default"
  // shortcut — and `wrap` simply had to join it.
  const wrapping = m.occ.filter((o) => o.node.layout?.wrap === true).length;
  const wrapsEverywhere = wrapping > 0 && wrapping === m.occ.filter((o) => o.node.layout !== undefined).length;
  if (isRoot) {
    // The generator's root default is row/center/center — a root drawn
    // exactly there proposes no layout block.
    if (direction === 'row' && justify === 'center' && align === 'center' && !grow && !overlap && wrapping === 0) {
      return undefined;
    }
    out.display = 'flex';
  }
  if (hasChildren || direction === 'column') out.direction = direction;
  if (justify && hasChildren) out.justify = justify;
  if (align && hasChildren) out.align = align;
  if (grow) out.grow = grow;
  if (overlap) out.overlap = overlap;
  // `wrap` is a per-part invariant like `overlap`: carried when every
  // AUTO-LAYOUT occurrence wraps, refused BY NAME when only some do
  // (layoutByProp's tuple is direction/justify/align and cannot spell it).
  // The denominator counts occurrences that HAVE auto-layout — counting all of
  // them blamed `wrap` for a variant whose layoutMode is NONE. It is NOT gated
  // on hasChildren: a childless wrapping stack is a strange drawing, but
  // dropping an observed fact because the drawing is strange is the silence
  // this round exists to remove.
  if (wrapping > 0) {
    if (wrapsEverywhere) {
      out.wrap = true;
      // A DISTINCT row gap has no layout spelling — `gap` is one value on both
      // axes in the schema, as it is in Figma when counterAxisSpacing follows.
      const rowSpacings = new Set(m.occ.map((o) => o.node.layout?.rowSpacing).filter((v) => v !== undefined));
      if (rowSpacings.size > 0) {
        ctx.notes.push(
          `${where}: wrapping stack whose ROW gap (${[...rowSpacings].join(', ')}px) differs from its column gap — carried as layout.wrap with the single \`gap\` channel holding the COLUMN spacing; the distinct row spacing is not carried (the schema's gap is one value on both axes, and CSS row-gap would need its own channel). The wrapped LINES sit at the column gap`,
        );
      }
    } else {
      ctx.notes.push(
        `${where}: auto-layout WRAPS in ${wrapping} of ${m.occ.filter((o) => o.node.layout !== undefined).length} auto-layout variant(s) — wrap is a per-part invariant here (layoutByProp carries direction/justify/align only), so it is NOT carried and every variant renders as a single line; split the part or make the wrap uniform`,
      );
    }
  }
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
 *  Anything less correlated keeps the named collapse note.
 *
 *  GAP-CLOSING ROUND 6 — THE BOOLEAN HALF. `layoutByProp` is an ENUM-keyed
 *  map (the emitters' referee says so by name: "layoutByProp prop must be an
 *  enum prop"), so this search has always skipped boolean axes — and a
 *  layout that is a pure function of a BOOLEAN was collapsing to the default
 *  variant's with only a note. Field case: UUI DropdownListItem draws its
 *  root `SPACE_BETWEEN` where Shortcut=True and `MIN` where False; the ⌘C
 *  glyph rendered 135px left of where the canvas puts it in 6 of 12 scored
 *  variants (masked until this round by a UA grey ground that made the
 *  render's trimmed box the full 240px either way).
 *
 *  The fact has an EXISTING boolean carrier — `stylesWhen`, whose literal
 *  whitelist already holds exactly the three channels this tuple carries
 *  (flex-direction / justify-content / align-items) and whose boolean form
 *  emits `.root[data-<prop>] { … }`. Nothing new is invented: the enum axis
 *  keeps layoutByProp, the boolean axis takes stylesWhen. The one shape a
 *  boolean cannot spell is a deviation on its FALSE value (stylesWhen's
 *  boolean form is truthy-only, `equals` is enum-only) — that stays a NAMED
 *  refusal. */
type LayoutSplit =
  | { kind: 'byProp'; byProp: Record<string, unknown> }
  | { kind: 'stylesWhen'; stylesWhen: Array<{ prop: string; styles: Record<string, string> }> };

const JUSTIFY_LITERAL: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between',
};
const ALIGN_LITERAL: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline',
};

/** Attach whichever spelling the split resolved to (absent = no-op). */
function applyLayoutSplit(holder: Record<string, unknown>, split: LayoutSplit | undefined): void {
  if (!split) return;
  if (split.kind === 'byProp') { holder.layoutByProp = split.byProp; return; }
  const existing = (holder.stylesWhen as Array<{ prop: string; styles: Record<string, string> }> | undefined) ?? [];
  holder.stylesWhen = [...existing, ...split.stylesWhen];
}

function invertLayoutByProp(
  m: Merged,
  ctx: Ctx,
  where: string,
): LayoutSplit | undefined {
  // A2 grid: a GRID occurrence has no (direction, justify, align) tuple —
  // its facts are tracks/gaps/placements, and a per-variant grid difference
  // has NO carrier (layoutByProp is refused on grid parts; P10: a mode
  // switch physically destroys tracks). invertGridLayout already names the
  // collapse to the default variant's grid — nothing to split here.
  if (m.occ.some((o) => o.node.layout?.mode === 'GRID')) return undefined;
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
      justify: JUSTIFY_INV[l.primary ?? 'MIN'] ?? 'start',
      align: ALIGN_INV[l.counter ?? 'MIN'] ?? 'start',
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
    return { kind: 'byProp', byProp: { prop: axis.propName, map } };
  }
  // ROUND 6 — the BOOLEAN axis, carried through stylesWhen (see the header).
  for (const axis of ctx.axes) {
    if (!isBoolAxis(axis.values)) continue;
    const byValue = new Map<string, Tuple>();
    let fits = true;
    for (const t of tuples) {
      const value = axisValuesOf(t.variant)[axis.property];
      if (value === undefined) { fits = false; break; }
      const seen = byValue.get(value);
      if (seen && key(seen) !== key(t.tuple!)) { fits = false; break; }
      byValue.set(value, t.tuple!);
    }
    if (!fits || byValue.size !== 2) continue;
    // Which drawn value spells TRUE? isBoolAxis guarantees a literal
    // true/false pair; the variant-name spelling is the axis's own casing.
    const trueValue = [...byValue.keys()].find((v) => /^true$/i.test(v));
    if (trueValue === undefined) continue;
    const onTrue = byValue.get(trueValue)!;
    if (key(onTrue) === key(base)) {
      // The deviation sits on the FALSE plane and stylesWhen's boolean form
      // is truthy-only — no spelling exists, so it is named, not guessed.
      ctx.notes.push(
        `${where}: auto-layout differs across variants as a function of the BOOLEAN axis "${axis.property}", but the deviating plane is its FALSE value — stylesWhen's boolean condition is truthy-only (\`equals\` is enum-only) and layoutByProp needs an enum prop, so the difference is NOT carried; the default variant's layout stands for both planes. Re-draw the axis with the deviating plane as TRUE, or promote it to an enum, to carry it`,
      );
      break;
    }
    const styles: Record<string, string> = {};
    if (onTrue.direction !== base.direction) styles['flex-direction'] = onTrue.direction;
    if (onTrue.justify !== base.justify) styles['justify-content'] = JUSTIFY_LITERAL[onTrue.justify] ?? onTrue.justify;
    if (onTrue.align !== base.align) styles['align-items'] = ALIGN_LITERAL[onTrue.align] ?? onTrue.align;
    if (Object.keys(styles).length === 0) break;
    ctx.notes.push(
      `${where}: auto-layout differs across variants as a function of the BOOLEAN axis "${axis.property}" — layoutByProp is an ENUM-keyed map, so the same fact carries through \`stylesWhen\` on \`${axis.propName}\` (${Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ')}), the existing boolean-conditioned literal-CSS vocabulary; the code leg emits \`.root[data-${axis.propName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}]\`, the canvas leg does not represent conditional restyling (standing documented limit)`,
    );
    return { kind: 'stylesWhen', stylesWhen: [{ prop: axis.propName, styles }] };
  }
  ctx.notes.push(
    `${where}: auto-layout differs across variants without correlating to any variant axis — using the default variant's`,
  );
  return undefined;
}

// ---------------------------------------------------------------------------
// Presence → visibleWhen
// ---------------------------------------------------------------------------

/** First-variant-freeze fix, TEXT half: when a static text part's DRAWN
 *  characters vary as a pure function of ONE enum axis across every
 *  observed occurrence (ProgressBar's Percentage '0%'…'100%' tracking the
 *  progress axis, InputFieldBase's label/'US'/'USD' tracking type), the part
 *  binds `text` to the axis's default value with `textByProp` carrying the
 *  deviations — the tokensByProp discipline applied to characters. Values
 *  that vary WITHOUT a single-axis function keep the first observation with
 *  a NAMED note (previously this freeze was silent). No-op for uniform
 *  text. */
function bindTextByAxis(m: Merged, part: Record<string, unknown>, ctx: Ctx, where: string): void {
  const obs = m.occ
    .filter((o) => o.node.text?.characters !== undefined)
    .map((o) => ({ variant: o.variant, chars: o.node.text!.characters! }));
  if (obs.length < 2 || new Set(obs.map((o) => o.chars)).size <= 1) return;
  for (const axis of ctx.axes.filter((a) => !isBoolAxis(a.values))) {
    const byValue = new Map<string, string>();
    let pure = true;
    for (const o of obs) {
      const v = axisValuesOf(o.variant)[axis.property];
      if (v === undefined) {
        pure = false;
        break;
      }
      const prev = byValue.get(v);
      if (prev === undefined) byValue.set(v, o.chars);
      else if (prev !== o.chars) {
        pure = false;
        break;
      }
    }
    if (!pure || byValue.size <= 1) continue;
    // Base = the axis's first OBSERVED value (axis declaration order); the
    // other values ride textByProp as deviations.
    const observedValues = axis.values.filter((v) => byValue.has(v));
    const baseValue = observedValues[0];
    const map: Record<string, string> = {};
    for (const v of observedValues) {
      const chars = byValue.get(v)!;
      if (v !== baseValue && chars !== byValue.get(baseValue)) map[camel(v)] = chars;
    }
    part.text = byValue.get(baseValue)!;
    if (Object.keys(map).length > 0) part.textByProp = { prop: axis.propName, map };
    ctx.notes.push(
      `${where}: drawn characters are a pure function of the "${axis.property}" axis (${observedValues
        .map((v) => `${camel(v)}→${JSON.stringify(byValue.get(v))}`)
        .join(', ')}) — bound as text + textByProp instead of pinning the first variant's value`,
    );
    return;
  }
  ctx.notes.push(
    `${where}: drawn characters vary across variants (${[...new Set(obs.map((o) => JSON.stringify(o.chars)))].slice(0, 6).join(', ')}) without tracking any enum axis — first value pinned, review`,
  );
}

/** Sentinel: strict-subset presence that no axis predicts — the caller drops
 *  the part entirely (named degradation) instead of emitting it
 *  unconditionally. Identity-compared. */
const OMIT_PART: Record<string, unknown> = { OMIT: true };

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
  // No single value predicts presence — try a value SUBSET of one enum axis
  // (audit class unconditional-parts; field cases: ButtonBase circle drawn
  // for Icon leading/only/trailing, InputFieldBase Dropdown drawn for Type
  // leadingDropdown/trailingDropdown). Membership carries as the array form
  // of visibleWhen.equals. Subset values keep the axis's declared order.
  for (const axis of ctx.axes) {
    if (isBoolAxis(axis.values)) continue;
    const presentValues = axis.values.filter((value) =>
      ctx.totalVariants.some((v) => present.has(v) && axisValuesOf(v)[axis.property] === value),
    );
    if (presentValues.length < 2 || presentValues.length === axis.values.length) continue;
    const matches = ctx.totalVariants.every(
      (v) => presentValues.includes(axisValuesOf(v)[axis.property] ?? '') === present.has(v),
    );
    if (!matches) continue;
    ctx.notes.push(
      `${where}: present exactly where "${axis.property}" is one of ${presentValues.map((v) => `"${v}"`).join(', ')} — proposed as visibleWhen { prop: ${axis.propName}, equals: [${presentValues.map((v) => camel(v)).join(', ')}] } (value-subset form)`,
    );
    return { prop: axis.propName, equals: presentValues.map((v) => camel(v)) };
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
  // Strict-subset presence with NO predictor: neither spelling is fully
  // honest, so the proposal takes the lesser error and NAMES it either way.
  // MAJORITY presence (CBDS field case: _Avatar Indicator in 32/36 variants,
  // absent only where a sibling ELLIPSE substitutes for it) keeps the part
  // unconditional — omission would be wrong in more variants than emission.
  // MINORITY presence (the audit's "everything-at-once" blocker: ProgressBar
  // floating tooltips in 20/55) OMITS the part as a NAMED degradation —
  // unconditional emission would draw it in variants that never carried it.
  if (m.occ.length * 2 > ctx.totalVariants.length) {
    ctx.notes.push(
      `${where}: present in ${m.occ.length}/${ctx.totalVariants.length} variants without correlating to any axis value — MAJORITY presence, kept unconditional (the lesser error; named, review)`,
    );
    return undefined;
  }
  ctx.notes.push(
    `${where}: DEGRADATION part omitted — present in only ${m.occ.length}/${ctx.totalVariants.length} variants and no single axis (value, subset, or boolean) predicts presence; emitting it unconditionally would render it in the majority of variants that never carried it. Review the set's variant structure or gate it manually.`,
  );
  return OMIT_PART;
}

// ---------------------------------------------------------------------------
// Part construction
// ---------------------------------------------------------------------------

/** The contract id this proposal will claim for itself — resolved once at
 *  context build (ctx.selfId; session cross-population collisions suffix,
 *  see the Ctx field doc). */
const selfContractId = (ctx: Ctx): string => ctx.selfId;

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
    const regKey = ctx.contractsById?.get(id)?.bindings?.figma?.anchors?.componentSetKey ?? null;
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
  const contractKey = ctx.contractsById?.get(named)?.bindings?.figma?.anchors?.componentSetKey ?? null;
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
    // Setless components carry only instanceKey — the component key IS the
    // identity for a plain COMPONENT, exactly the fallback the session-
    // linking index uses ("componentSetKey (or setless component key)").
    // Without it the stub's anchors carry null and a session cross-
    // population collision (class ③) is invisible to the key discipline.
    const setKey = first(m.occ, (n) => n.instanceSetKey) ?? first(m.occ, (n) => n.instanceKey);
    if (setKey !== undefined) capture.setKey = setKey;
  }
  for (const o of m.occ) {
    if (o.node.componentProperties) capture.applied.push(o.node.componentProperties);
    if (o.node.bbox) {
      capture.observed.push({
        variant: o.variant,
        ...(o.node.componentProperties ? { applied: o.node.componentProperties } : {}),
        ...(o.node.instanceKey ? { instanceKey: o.node.instanceKey } : {}),
        bbox: o.node.bbox,
        ...(o.node.fill ? { fill: o.node.fill } : {}),
        ...(o.node.instancePrimaryFill ? { instancePrimaryFill: o.node.instancePrimaryFill } : {}),
        ...(o.node.stroke ? { stroke: o.node.stroke } : {}),
        ...(o.node.strokeWeight !== undefined ? { strokeWeight: o.node.strokeWeight } : {}),
        ...(o.node.cornerRadius !== undefined ? { cornerRadius: o.node.cornerRadius } : {}),
        ...(o.node.imageFill !== undefined ? { imageFill: o.node.imageFill } : {}),
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
  base: Record<string, string | boolean | { prop: string; map: Record<string, string> }>,
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
      continue;
    }
    // Not an identity of any axis — a pure FUNCTION of one axis still binds,
    // as a per-value LOOKUP (first-variant-freeze fix; field case:
    // SocialButton's icon platform "x(twitter)" under the parent value "x").
    // String values only (the PropByProp map vocabulary is string→string).
    let lookup: { axis: Axis; map: Record<string, string> } | undefined;
    for (const a of enumAxes) {
      const byValue = new Map<string, string>();
      let pure = values.length > 0;
      for (const v of values) {
        const axisValue = axisValuesOf(v.variant)[a.property];
        if (axisValue === undefined || typeof v.value !== 'string') {
          pure = false;
          break;
        }
        const prev = byValue.get(axisValue);
        if (prev === undefined) byValue.set(axisValue, v.value);
        else if (prev !== v.value) {
          pure = false;
          break;
        }
      }
      if (!pure || byValue.size <= 1) continue;
      const map: Record<string, string> = {};
      for (const value of a.values) {
        const hit = byValue.get(value);
        if (hit !== undefined) map[camel(value)] = hit;
      }
      lookup = { axis: a, map };
      break;
    }
    if (lookup) {
      base[propName] = { prop: lookup.axis.propName, map: lookup.map };
      ctx.notes.push(
        `${where}: applied prop "${propName}" of the nested "${instanceOf}" is a pure function of the "${lookup.axis.propName}" axis (${Object.entries(
          lookup.map,
        )
          .map(([k, v]) => `${k}→${v}`)
          .join(', ')}) — bound as a per-value lookup instead of pinning the first variant's value`,
      );
    } else {
      // FC-DUMP-PROPOSE-BOOL-AXIS-CORRELATION: a pure function of one BOOLEAN
      // axis (Eventz Checkbox: Icons/Checkbox state=unselected/selected as
      // isChecked flips). The PropByProp lookup compares the parent's value
      // as a STRING on every surface (emit-react `prop === 'true'`, emit-wc
      // likewise), so a boolean parent prop would silently miss — the map is
      // NAMED with its axis instead of the false "without tracking any enum
      // axis" receipt, and the first value stays carried.
      let boolFn: { axis: Axis; whenFalse: string; whenTrue: string } | undefined;
      for (const a of ctx.axes.filter((ax) => isBoolAxis(ax.values))) {
        const byValue = new Map<string, string>();
        let pure = values.length > 0;
        for (const v of values) {
          const axisValue = axisValuesOf(v.variant)[a.property]?.trim().toLowerCase();
          if (axisValue === undefined || typeof v.value !== 'string') {
            pure = false;
            break;
          }
          const prev = byValue.get(axisValue);
          if (prev === undefined) byValue.set(axisValue, v.value);
          else if (prev !== v.value) {
            pure = false;
            break;
          }
        }
        if (!pure || !byValue.has('true') || !byValue.has('false')) continue;
        boolFn = { axis: a, whenFalse: byValue.get('false')!, whenTrue: byValue.get('true')! };
        break;
      }
      if (boolFn) {
        ctx.notes.push(
          `${where}: applied prop "${propName}" of the nested "${instanceOf}" is a pure function of the BOOLEAN axis "${boolFn.axis.property}" (false→${boolFn.whenFalse}, true→${boolFn.whenTrue}) — the PropByProp lookup compares the parent's value as a string and a boolean parent prop would silently miss on every surface, so the per-value lookup is NOT proposed; first value "${String(base[propName])}" carried, NAMED (promote the axis to an enum to carry it; review)`,
        );
      } else {
        ctx.notes.push(
          `${where}: applied prop "${propName}" of the nested "${instanceOf}" varies across variants (${distinct.join(', ')}) without tracking any variant axis (enum or boolean) — first value "${String(base[propName])}" carried, review`,
        );
      }
    }
  }
}

/** ROUND 3 — instance TEXT overrides, HOST half. The characters this host
 *  set on the nested child's text nodes (dump v1.10) become applied values
 *  on the component ref, through the child's OWN text prop:
 *    · every occurrence agrees        → a fixed string
 *    · a pure function of one enum axis → a PropByProp lookup (the slider's
 *      two tooltips track Left/Right control; the progress bar's tracks
 *      Progress) — the same vocabulary applied props already use
 *    · anything else                  → a NAMED refusal; the child renders
 *      its own default characters and the loss is on the record.
 *  Pairing is deliberately narrow: exactly one overridden path against
 *  exactly one host-settable text prop on the child. Anything ambiguous
 *  refuses rather than guessing which label the host meant. */
function carryTextOverrides(
  m: Merged,
  component: Record<string, unknown>,
  id: string | null,
  instanceOf: string,
  ctx: Ctx,
  where: string,
): void {
  const occWithText = m.occ.filter((o) => o.node.textOverrides !== undefined);
  if (occWithText.length === 0) return;
  const visited = (ctx.textOverridesVisited ??= new Set<string>());
  for (const o of occWithText) {
    for (const [p, chars] of Object.entries(o.node.textOverrides!)) visited.add(`${p} ${chars}`);
  }
  const paths = [...new Set(occWithText.flatMap((o) => Object.keys(o.node.textOverrides!)))].sort();
  const observed = paths
    .map((p) => `"${p}" = ${[...new Set(occWithText.map((o) => o.node.textOverrides![p]).filter((v) => v !== undefined))].map((v) => JSON.stringify(v)).join('/')}`)
    .join('; ');
  if (!id) {
    ctx.notes.push(
      `${where}: this host overrides the characters of the nested "${instanceOf}" (${observed}, dump v1.10) but the child is an auto-proposed STUB with no anatomy — the override is NOT carried (import the real child set); named, never invented`,
    );
    return;
  }
  const child = ctx.contractsById?.get(id) as
    | (MinimalChildContract & { props: Array<{ name: string; type?: unknown; default?: unknown; bindings: { figma: { kind?: string; property?: string }; code?: { prop?: string } } }> })
    | undefined;
  const textProps = (child?.props ?? []).filter((p) => p.type === 'text') as Array<{
    name: string;
    default?: unknown;
  }>;
  if (paths.length !== 1 || textProps.length !== 1) {
    ctx.notes.push(
      `${where}: this host overrides the characters of the nested "${instanceOf}" (${observed}, dump v1.10) but the pairing is not unambiguous — ${paths.length} overridden path(s) against ${textProps.length} text prop(s) on ${id}; NOT carried (a wrong pairing would put the host's label on the wrong node)`,
    );
    return;
  }
  const propName = textProps[0].name;
  const path = paths[0];
  const values = m.occ
    .map((o) => ({ variant: o.variant, value: o.node.textOverrides?.[path] }))
    .filter((v): v is { variant: string; value: string } => typeof v.value === 'string');
  const distinct = [...new Set(values.map((v) => v.value))];
  const applied = (component.props ?? {}) as Record<string, string | boolean | { prop: string; map: Record<string, string> }>;
  if (applied[propName] !== undefined) {
    ctx.notes.push(
      `${where}: character override "${path}" of the nested "${instanceOf}" collides with an applied "${propName}" the drawn properties already set — the DRAWN property wins, the override is not carried (named)`,
    );
    return;
  }
  if (distinct.length === 1) {
    applied[propName] = distinct[0];
    component.props = applied;
    ctx.notes.push(
      `${where}: the nested "${instanceOf}" carries a HOST character override (dump v1.10) — "${path}" reads ${JSON.stringify(distinct[0])} in all ${values.length} occurrence(s), carried as component.props.${propName} (the child's own default ${JSON.stringify(String(textProps[0].default ?? ''))} would otherwise render)`,
    );
    return;
  }
  // Varying: a pure function of one enum axis binds as a per-value lookup —
  // the same classification threadInstanceProps applies to applied props.
  for (const axis of ctx.axes.filter((a) => !isBoolAxis(a.values))) {
    const byValue = new Map<string, string>();
    let pure = true;
    for (const v of values) {
      const axisValue = axisValuesOf(v.variant)[axis.property];
      if (axisValue === undefined) { pure = false; break; }
      const prev = byValue.get(axisValue);
      if (prev === undefined) byValue.set(axisValue, v.value);
      else if (prev !== v.value) { pure = false; break; }
    }
    if (!pure || byValue.size <= 1) continue;
    const map: Record<string, string> = {};
    for (const value of axis.values) {
      const hit = byValue.get(value);
      if (hit !== undefined) map[camel(value)] = hit;
    }
    applied[propName] = { prop: axis.propName, map };
    component.props = applied;
    ctx.notes.push(
      `${where}: the nested "${instanceOf}" carries a HOST character override that VARIES (dump v1.10) — "${path}" is a pure function of the "${axis.propName}" axis (${Object.entries(map).map(([k, v]) => `${k}→${JSON.stringify(v)}`).join(', ')}), carried as a per-value lookup on component.props.${propName}`,
    );
    return;
  }
  ctx.notes.push(
    `${where}: the nested "${instanceOf}" carries a HOST character override that varies across variants (${distinct.map((d) => JSON.stringify(d)).join(', ')}, dump v1.10) without tracking any enum axis — NOT carried (pinning one variant's label would be wrong everywhere else); the child renders its own default`,
  );
}

/** Slot `accepts` from captured INSTANCE_SWAP preferredValues (dump v1.5):
 *  keys that resolve through the session-linking index become accepts ids
 *  (acceptsMode 'prefer' — Figma's own preferredValues tier); unresolved
 *  keys stay a NAMED note carrying the keys verbatim. Pre-v1.5 dumps keep
 *  the classic "author `accepts` manually" note. */
function applySlotAccepts(
  slot: Record<string, unknown>,
  property: string,
  ctx: Ctx,
  where: string,
  native = false,
  /** A native SLOT's bound property name (propRefs.slotContentId) when it
   *  differs from the layer name the slot part is keyed by — the definition
   *  is keyed by the PROPERTY (dump v1.31). */
  propertyAlias?: string,
) {
  // The definition, by suffix-stripped name (dump v1.5 keys keep "#id").
  const names = propertyAlias !== undefined && propertyAlias !== property ? [property, propertyAlias] : [property];
  const definition = Object.entries(ctx.propertyDefinitions ?? {}).find(([k]) => names.includes(k.split('#')[0]))?.[1];
  const spelled = names.length > 1 ? `"${property}" / slotContentId "${propertyAlias}"` : `"${property}"`;
  const definedPrefs =
    definition && (definition.type === 'INSTANCE_SWAP' || definition.type === 'SLOT') ? definition.preferredValues : undefined;
  // `carried` is the set-level list (dump swapPreferredValues — the REST
  // mapper emits it AS RETURNED since fix round 1, `[]` included; the plugin
  // since v1.18); `undefined` means the producer did not carry it, which is
  // NOT the same fact as an empty list.
  const carried = names.map((n) => ctx.swapPreferredValues?.[n]).find((v) => v !== undefined);
  const prefs = carried ?? definedPrefs;
  if (!prefs || prefs.length === 0) {
    // PHASE 2 EXAM (rest-swap-preferred-values-empty, rest-slot-property-
    // definition — the WRONG-NAME class). Three different facts used to share
    // one sentence, and the sentence was false for two of them:
    //   · the list IS captured (set-level `[]`, or a definition whose
    //     preferredValues is empty/absent) — an UNCONSTRAINED swap by the
    //     designer's own declaration (REST returns `preferredValues: []`; the
    //     plugin omits an empty list but carries the definition);
    //   · the list is not in the dump at all — no definition and no
    //     set-level entry: a plugin dump before v1.18, or a REST dump mapped
    //     before fix round 1 (map.ts dropped a SLOT definition whose
    //     defaultValue is a {guid}; it keeps it now — the guid is a node
    //     reference, not a value, and preferredValues ride as returned);
    //   · (retired) "REST returns componentPropertyDefinitions EMPTY for SLOT
    //     properties" — the live response contradicts it (2026-08-22 probe).
    const definedType = definition && (definition.type === 'INSTANCE_SWAP' || definition.type === 'SLOT') ? definition.type : undefined;
    if (definedType !== undefined || carried !== undefined) {
      const kind = definedType ?? (native ? 'SLOT' : 'INSTANCE_SWAP');
      const via = definedType !== undefined ? 'dump v1.5 propertyDefinitions' : 'set-level swapPreferredValues, carried as the reader returned it';
      ctx.notes.push(
        `${where}: slot "${property}" ${kind} preferredValues is EMPTY ([]) — an UNCONSTRAINED swap by the designer's own declaration (any component may fill it; ${via}); no \`accepts\` proposed and acceptsMode is left open — declare \`accepts\` in the contract if the code side should constrain it`,
      );
      return;
    }
    ctx.notes.push(
      native
        ? `${where}: slot "${property}" accepts (SLOT preferredValues) is not in this dump — no propertyDefinitions entry for ${spelled} and no set-level list: the producer did not carry the SLOT definition (a plugin dump before v1.18, or a REST dump mapped before the Phase 2 fix round — the mapper now keeps SLOT definitions with a {guid} default and their preferredValues as returned); never "this slot accepts anything" — author \`accepts\` manually or re-dump`
        : `${where}: slot "${property}" accepts (INSTANCE_SWAP preferredValues) is not in this dump — no propertyDefinitions entry for ${spelled} and no set-level list (a pre-v1.5 dump, or the reader dropped the definition); author \`accepts\` manually`,
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
  // dump v1.31 — host facts on the drawn content instance (it never passes
  // through buildPart's INSTANCE branch).
  nameHostOverrides(contentInstance, ctx, `${where}/${contentInstance.name}`);
  nameFixedSwaps(contentInstance, ctx, `${where}/${contentInstance.name}`);
  // Design→code census (2026-08-23): the elided slot-content instance can
  // ALSO carry an aspect-ratio lock (Toast's Icon slot content, 20:20). The
  // other two host-facing facts were named here; the lock dropped in
  // silence on the REST route. Same rule as everywhere: an instance owns no
  // declared block, so the lock is NAMED, never carried and never silent.
  carryAspectRatio(contentInstance, null, ctx, `${where}/${contentInstance.name}`);
  nameReactions(contentInstance, ctx, `${where}/${contentInstance.name}`);
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

/** A SPACER is a childless FRAME that draws NOTHING — its whole job is
 *  in-flow growth, so the spacer branch below carries layout only and returns
 *  early. The predicate must therefore be exhaustive over "draws something":
 *  a node it claims wrongly loses every channel the early return skips.
 *
 *  `imageFill` (dump v1.7 boolean marker / v1.9 hash) and `fixedSize` (dump
 *  v1.8, the drawn box of a non-auto-layout child inside auto-layout) are
 *  drawn facts that fill/stroke/bound/text do not cover — an image FRAME
 *  carries its paint in NEITHER `fill` NOR `stroke`. Before this guard a
 *  childless, paint-less image frame was eaten here: the part landed `{}`,
 *  its 32px box was lost, and buildPart's own note (top of the function)
 *  still announced "IMAGE fill carried BY HASH" — named-as-carried and
 *  actually dropped, the WRONG-NAME class. (Canvas conformance:
 *  fill-image-hash, fill-image-bool.) Absent fields are an exact no-op, so a
 *  real spacer classifies exactly as before. */
const isSpacer = (m: Merged): boolean =>
  m.type === 'FRAME' &&
  m.children.length === 0 &&
  m.occ.every(
    (o) =>
      !o.node.fill &&
      !o.node.stroke &&
      !o.node.bound &&
      !o.node.text &&
      o.node.imageFill === undefined &&
      o.node.fixedSize === undefined,
  );

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
  // HYPHENS KEEP THEIR SPELLING. The old test demanded a JS identifier, so
  // every kebab part name the canvas carries — and this repo's own contracts
  // are written in kebab (`part-0`, `alert-icon`, `alert-icon-info`) — was
  // cameled to `part0` / `alertIcon` on the way back. The names were never
  // lost: the emitter writes them onto the nodes verbatim and the dump reads
  // them verbatim. Only this line renamed them, so a contract round-tripped
  // to a diff full of renames it never made.
  //
  // A hyphen is safe everywhere a part key lands: CSS class names take it
  // natively, and emit-react already spells a non-identifier class as
  // `styles["alert-icon"]` rather than dot access. Punctuation that is NOT
  // safe (the owner's lorem-ipsum Dialog body, commas and periods included)
  // still falls through to camelSafe exactly as before.
  //
  // AND ONLY FOR A SET WE DREW. A hyphen is safe in a CSS class and in
  // `styles["alert-icon"]`, but a part key also becomes a SLOT/property name,
  // and those must be identifiers. On a FOREIGN set the drawn names are
  // arbitrary layer labels ("swap-slot-item-1", a lorem-ipsum sentence) and
  // sanitising them is the whole point — the CBDS Dialog send pins exactly
  // that. Widening the rule for everyone broke it. The stamp is the
  // discriminator the rest of this wave already uses: our set keeps its own
  // names, a foreign one is sanitised exactly as before.
  const keepDrawnSpelling = ctx.drawnByThisPipeline === true
    ? /^[A-Za-z][A-Za-z0-9-]*$/.test(name)
    : /^[A-Za-z][A-Za-z0-9]*$/.test(name);
  let base = keepDrawnSpelling
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

/** The prop name for a drawn Figma property: the CONTRACT's own name when the
 *  set stamped one (dump v1.25), else the canonicalised design spelling. ONE
 *  owner, because the name is used twice — to declare the prop and to bind a
 *  part's content to it — and the two drifting apart emits a contract whose
 *  own anatomy references a prop that does not exist. */
function textPropName(ctx: Ctx, property: string): string {
  return ctx.propNames?.[property] ?? canonicalPropName(property);
}

function registerTextProp(
  ctx: Ctx,
  property: string,
  characters: string,
  name = textPropName(ctx, property),
) {
  if (ctx.textProps.some((p) => p.property === property)) return;
  ctx.textProps.push({ name, property, default: characters });
}

// ---------------------------------------------------------------------------
// ROUND 3 — INSTANCE TEXT OVERRIDES (dump v1.10 `textOverrides`)
//
// The gap this closes: a child component with NO Figma TEXT property still
// gets its characters changed per usage — hosts override the text node
// directly. Untitled UI's Tooltip and Avatar are exactly this shape, so a
// slider's "0%", a progress bar's "40%" and an avatar group's "+5" chip all
// rendered the child's OWN default characters ("This is a tooltip", "OR").
//
// The carriage is two-sided and each side stays inside existing vocabulary:
//   CHILD  the overridden text node stops being a literal `text` part and
//          becomes a `content` part bound to a text prop (code prop
//          "children"), default = the characters the child itself draws. The
//          prop binds figma kind NONE — the canvas has no property here, and
//          claiming one would invent a design API nobody drew.
//   HOST   the observed characters ride `component.props` on the nested
//          part — a constant when every occurrence agrees, a PropByProp
//          lookup when they are a pure function of one enum axis. Both
//          shapes already exist for applied props; nothing new is emitted.
// Anything else (varies without tracking an axis, child has no such prop,
// path unresolvable) is a NAMED refusal — never invented text.
// ---------------------------------------------------------------------------

/** Cross-set text-override demand: child set identity (componentSetKey AND
 *  set name, both registered) → the node NAME PATHS hosts were observed
 *  overriding inside it. Build it ONCE over every dump in scope (the merged
 *  corpus), before any set is proposed — a child is proposed before its
 *  hosts, so the demand cannot be discovered during the child's own pass. */
export type TextOverrideDemand = ReadonlyMap<string, ReadonlySet<string>>;

/** Collect the demand from a merged multi-set dump (or any object holding
 *  DumpSets). Read-only; unknown shapes are skipped, never thrown on. */
export function textOverrideDemandFromDumps(dumps: Record<string, unknown>): Map<string, Set<string>> {
  const demand = new Map<string, Set<string>>();
  const add = (key: string | undefined, path: string): void => {
    if (!key) return;
    const set = demand.get(key) ?? new Set<string>();
    set.add(path);
    demand.set(key, set);
  };
  const walk = (node: DumpNode): void => {
    if (node.type === 'INSTANCE' && node.textOverrides) {
      for (const path of Object.keys(node.textOverrides)) {
        add(node.instanceSetKey, path);
        add(node.instanceKey, path);
        add(node.instanceOf, path);
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  for (const value of Object.values(dumps)) {
    if (!isDumpSet(value)) continue;
    for (const variant of value.variants) walk(variant);
  }
  return demand;
}

/** Resolve the demand against THIS set's merged tree: demanded node path →
 *  the text prop name the node's part will bind. The host's path is the RAW
 *  drawn path inside its instance; the child's merged tree may spell the
 *  same node differently (a wrapper union folds a flat variant under the
 *  wrapper other variants nest in — the Tooltip field case: hosts see
 *  "Content/Text", the merged tree carries
 *  "Content/Text and supporting text/Text"). So: exact path first, then a
 *  UNIQUE node-name match. Ambiguous or absent → a named refusal. */
function resolveTextOverrideDemand(
  merged: Merged,
  demanded: ReadonlySet<string>,
  ctx: Ctx,
): Map<string, string> {
  const texts: Array<{ path: string; name: string }> = [];
  const collect = (m: Merged, path: string[]): void => {
    if (m.type === 'TEXT') texts.push({ path: path.join('/'), name: m.name });
    for (const c of m.children) collect(c, [...path, c.name]);
  };
  for (const c of merged.children) collect(c, [c.name]);

  const promote = new Map<string, string>();
  // Names the DRAWN API will claim later in the walk — axes, and every real
  // TEXT-property binding anywhere in the tree. Collected up front because
  // promotion decides its names before a single part is built, and two props
  // called "children" would be a silent API collision.
  const taken = new Set<string>([...ctx.axes.map((a) => a.propName), ...ctx.textProps.map((t) => t.name)]);
  const collectDrawn = (m: Merged): void => {
    for (const o of m.occ) {
      const p = o.node.propRefs?.characters;
      if (p) taken.add(canonicalPropName(p));
    }
    for (const c of m.children) collectDrawn(c);
  };
  collectDrawn(merged);
  for (const wanted of [...demanded].sort()) {
    const leaf = wanted.split('/').pop()!;
    const exact = texts.filter((t) => t.path === wanted);
    const byName = exact.length > 0 ? exact : texts.filter((t) => t.name === leaf);
    if (byName.length === 0) {
      ctx.notes.push(
        `${ctx.setName}: a host was observed overriding the characters of "${wanted}" inside an instance of this set (dump v1.10 \`textOverrides\`), but no TEXT node in this set's merged tree matches that path or the node name "${leaf}" — the override is REFUSED, not invented; this set's own characters stand`,
      );
      continue;
    }
    if (byName.length > 1) {
      ctx.notes.push(
        `${ctx.setName}: a host overrides the characters of "${wanted}" inside an instance of this set, but ${byName.length} TEXT nodes here answer to the name "${leaf}" (${byName.map((t) => `"${t.path}"`).join(', ')}) — ambiguous, so NO text prop is promoted (a wrong node would silently take the host's label)`,
      );
      continue;
    }
    const target = byName[0];
    if (promote.has(target.path)) continue;
    // The main-content convention: the FIRST promoted node takes "children"
    // (ds.button convention, the one hasChildrenText recognizes); a second
    // takes its own node name, and a name already claimed by an axis or a
    // real TEXT-property prop yields (the drawn API always wins).
    const preferred = promote.size === 0 && !taken.has('children') ? 'children' : canonicalPropName(target.name);
    if (taken.has(preferred)) {
      ctx.notes.push(
        `${ctx.setName}: the host-overridden text node "${target.path}" would need prop name "${preferred}", which this set's drawn API already claims — no promotion (the drawn property wins; rename the node or the axis to carry the override)`,
      );
      continue;
    }
    taken.add(preferred);
    promote.set(target.path, preferred);
    ctx.notes.push(
      `${ctx.setName}: text node "${target.path}"${target.path === wanted ? '' : ` (matched by node name from the host's drawn path "${wanted}" — a wrapper union folds this node differently in this set's own tree)`} is OVERRIDDEN by at least one host instance (dump v1.10 \`textOverrides\`) — promoted from a literal to text prop \`${preferred}\` with the drawn characters as its default; bindings.figma.kind is NONE because this set exposes NO TEXT component property for it (the canvas carries the override as a raw instance override, which the contract vocabulary does not model — declared limit, named here)`,
    );
  }
  return promote;
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
/** dump v1.31 — prototype reactions (REST interactions[] / Plugin
 *  reactions[]) NAMED with their target: the CHANGE_TO state-preview wiring
 *  the dump v1.27 plugin receipt already names, now on the REST route too.
 *  Never inverted to onClick/onHover (the State axis + statePreviewAxis
 *  recover the state matrix; events are not drawn). */
function nameReactions(m: Merged, ctx: Ctx, where: string): void {
  const rows = new Map<string, string[]>();
  for (const o of m.occ) {
    for (const r of o.node.reactions ?? []) {
      const target = r.destinationName !== undefined ? `"${r.destinationName}"${r.destination ? ` (${r.destination})` : ''}` : r.destination ?? '(no destination)';
      const key = `${r.trigger} → ${r.action ?? 'ACTION'} ${target}${r.transition ? `; ${r.transition}${typeof r.duration === 'number' ? ` ${r.duration}ms` : ''}` : ''}`;
      rows.set(key, [...(rows.get(key) ?? []), o.variant]);
    }
  }
  if (rows.size === 0) return;
  const hasStateAxis = ctx.stateAxisPromoted !== undefined || ctx.axes.some((a) => /^state$/i.test(a.property));
  ctx.notes.push(
    `${where}: prototype reaction(s) ${[...rows].map(([k, vs]) => `${k} [${vs.join(', ')}]`).join('; ')} — prototype-reactions-unsupported: ${hasStateAxis ? 'the State axis carries the hover/active/focus matrix as promoted state overrides, which is what this CHANGE_TO wiring previews' : 'no State axis is drawn, so the reaction previews a variant swap the contract models as a prop'}; the dump does not invent onClick/onHover from it — NAMED, not carried (dump v1.31 reactions)`,
  );
}

/** dump v1.31 — the promoted STATE groups never pass through buildPart (the
 *  base anatomy is built from the default-state variants only; the state
 *  diff reads channels), so the facts named above would be SILENT on a
 *  hover/active/focus plane — exactly where the Phase 2 exam found them
 *  (effect style + effect bindings on the 5 Button Hover roots, the icon
 *  colour overrides per state). Named here per state, root and depth-1. */
function nameStateGroupFacts(ctx: Ctx, state: string, occs: Array<{ variant: string; node: DumpNode }>): void {
  const where = `${ctx.setName}:root (state ${state})`;
  const rootM: Merged = { name: 'root', type: 'COMPONENT', occ: occs.map((o) => ({ variant: o.variant, node: o.node })), children: [] };
  nameEffectProvenance(rootM, ctx, where);
  nameReactions(rootM, ctx, where);
  nameItemReverseZIndex(rootM, ctx, where);
  const byChild = new Map<string, Occ[]>();
  for (const o of occs) {
    for (const c of o.node.children ?? []) byChild.set(c.name, [...(byChild.get(c.name) ?? []), { variant: o.variant, node: c }]);
  }
  for (const [name, occ] of byChild) {
    const m: Merged = { name, type: occ[0].node.type, occ, children: [] };
    const at = `${where}/${name}`;
    nameEffectProvenance(m, ctx, at);
    nameReactions(m, ctx, at);
    if (m.type === 'INSTANCE') {
      nameHostOverrides(m, ctx, at);
      nameFixedSwaps(m, ctx, at);
    }
  }
}

/** dump v1.31 — HOST overrides of a nested instance's internals. */
function nameHostOverrides(m: Merged, ctx: Ctx, where: string): void {
  const rows = new Map<string, string[]>();
  for (const o of m.occ) {
    for (const h of o.node.hostOverrides ?? []) {
      const key = `"${h.path}" ${h.fields.join('/')}${h.fill ? ` = ${paintCssHex(h.fill)}${h.fill.var ? ` ({${dotPath(h.fill.var)}})` : ''}` : ''}`;
      rows.set(key, [...(rows.get(key) ?? []), o.variant]);
    }
  }
  if (rows.size === 0) return;
  const instanceOf = first(m.occ, (n) => n.instanceOf) ?? m.name;
  ctx.notes.push(
    `${where}: host override(s) on nested "${instanceOf}" internals — ${[...rows].map(([k, vs]) => `${k} in ${vs.length}/${m.occ.length} variant(s) [${vs.join(', ')}]`).join('; ')} — a HOST fact (the icon colour per variant) on a child-owned node: instance internals are elided by rule and the child contract declares no overridable channel for it, so the override is NAMED, not carried (declare \`overridable\` on the child's root part and the component.overrides machinery can carry it as a minted per-variant ref)`,
  );
}

/** dump v1.31 — FIXED INSTANCE_SWAP values on a nested instance. */
function nameFixedSwaps(m: Merged, ctx: Ctx, where: string): void {
  const rows = new Map<string, string[]>();
  for (const o of m.occ) {
    for (const [prop, swap] of Object.entries(o.node.fixedSwaps ?? {})) {
      const key = `"${prop}" = ${swap.name !== undefined ? `"${swap.name}" (${swap.id}${swap.key ? `, key ${swap.key}` : ''})` : swap.id}`;
      rows.set(key, [...(rows.get(key) ?? []), o.variant]);
    }
  }
  if (rows.size === 0) return;
  const instanceOf = first(m.occ, (n) => n.instanceOf) ?? m.name;
  ctx.notes.push(
    `${where}: nested "${instanceOf}" fixes INSTANCE_SWAP ${[...rows].map(([k, vs]) => `${k} in ${vs.length}/${m.occ.length} variant(s) [${vs.join(', ')}]`).join('; ')} (dump v1.31 fixedSwaps) — a component ref carries props only; nested slot CONTENT is not expressible in the composition grammar, so the fixed swap is NAMED, not carried (author the child's slot defaultContent, or expose the swap as a host property, to carry it)`,
  );
}

/** dump v1.31 — itemReverseZIndex: paint order reversed. Render-inert unless
 *  children overlap; the contract's z-index is declared-but-inert (paint
 *  order on canvas is child order), so there is nothing to carry — NAMED. */
function nameItemReverseZIndex(m: Merged, ctx: Ctx, where: string): void {
  const on = m.occ.filter((o) => o.node.itemReverseZIndex === true);
  if (on.length === 0) return;
  ctx.notes.push(
    `${where}: itemReverseZIndex is true in ${on.length}/${m.occ.length} variant(s) (dump v1.31) — auto-layout paint order reversed (the first child paints on top); render-inert unless children overlap, and the contract's z-index channel is declared-but-inert (canvas paint order IS child order), so the fact is NAMED, not carried`,
  );
}

/** dump v1.31 — targetAspectRatio: a FRAME part carries it as the declared
 *  `aspect-ratio` channel (DECLARED_CHANNELS, canvas: draw); an INSTANCE /
 *  slot part owns no declared block (the child owns its box) — NAMED. */
function carryAspectRatio(m: Merged, holder: Record<string, unknown> | null, ctx: Ctx, where: string): void {
  const ratios = [...new Set(m.occ.map((o) => (o.node.targetAspectRatio ? `${o.node.targetAspectRatio.x} / ${o.node.targetAspectRatio.y}` : undefined)))];
  const drawn = ratios.filter((r): r is string => r !== undefined);
  if (drawn.length === 0) return;
  if (holder === null) {
    ctx.notes.push(
      `${where}: aspect-ratio lock ${drawn.join(' / ')} (dump v1.31 targetAspectRatio) on a ${m.type === 'INSTANCE' ? 'nested instance' : m.type} — the declared aspect-ratio channel lives on a part's declared block and this part owns none (the child contract / slot content owns its box); the lock acts on resize only and the observed box already carries; NAMED, not carried`,
    );
    return;
  }
  if (ratios.length > 1) {
    ctx.notes.push(
      `${where}: aspect-ratio lock differs across variants (${ratios.map((r) => r ?? 'none').join(', ')}; dump v1.31) — aspect-ratio is a declared literal with no per-variant vocabulary; NAMED, not proposed (review)`,
    );
    return;
  }
  const declared = (holder.declared as Record<string, string> | undefined) ?? {};
  if (declared['aspect-ratio'] === undefined) declared['aspect-ratio'] = drawn[0];
  holder.declared = declared;
  ctx.notes.push(
    `${where}: aspect-ratio lock ${drawn[0]} drawn in every variant (dump v1.31 targetAspectRatio) — carried as declared aspect-ratio: ${drawn[0]} (canvas: the emitter resolves height from the bound width)`,
  );
}

function buildChildParts(
  children: Merged[],
  mode: ParentModes | null,
  ctx: Ctx,
  where: string,
  selfKey: string,
  /** v13 (P18): drawn child NAME → claimed part key, collected for the
   *  DEPTH-1 call only — proposeStateDiffs maps state-variant children back
   *  onto their built anatomy parts through it. */
  keyByName?: Map<string, string>,
): Record<string, unknown> {
  const parts: Record<string, unknown> = {};
  // A2 grid: under a CARRIED manual grid every sibling is an individually
  // PLACED cell — a repeat template collapses siblings into one part and
  // cannot carry per-sibling placements (G2), so run detection is bypassed
  // and each sibling builds as its own placed part. Under flow: "row" the
  // placement fact is child order (G5) and repeat runs stay legal.
  const manualGrid = mode?.grid?.carried === true && !mode.grid.flow;
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    const run = manualGrid ? undefined : repeatRunAt(children, i, ctx);
    if (run) {
      // Claim the key BEFORE building (pre-order, the partKey discipline).
      const key = partKey(child.name, ctx, `${where}/${child.name}`, selfKey);
      if (keyByName && !keyByName.has(child.name)) keyByName.set(child.name, key);
      const repeatPart = buildRepeatPart(run, ctx, `${where}/${child.name}`, key);
      if (repeatPart) {
        if (run.some((sib) => sib.occ.some((o) => absBoxOf(o.node) !== undefined))) {
          ctx.notes.push(
            `${where}/${child.name}: absolute placement captured (dump v1.7 \`abs\`) on a repeated-collection sibling — a repeat template renders its items in flow; placement not carried (ledgered by name)`,
          );
        }
        parts[key] = repeatPart;
        i += run.length;
        continue;
      }
      // No carriable field (named above) — the first sibling builds under the
      // already-claimed key; the rest walk as before.
      const built = buildPart(child, mode, ctx, `${where}/${child.name}`, key);
      if (built) parts[key] = wrapPositionedRefPart(child, built, ctx, `${where}/${child.name}`, key);
      i++;
      continue;
    }
    const key = partKey(child.name, ctx, `${where}/${child.name}`, selfKey);
    if (keyByName && !keyByName.has(child.name)) keyByName.set(child.name, key);
    const built = buildPart(child, mode, ctx, `${where}/${child.name}`, key);
    if (built) {
      // A2 grid (G2): the ONE placement door — every part class takes its
      // captured cell here (no-op unless the parent's grid carried, manual).
      attachGridPlacement(child, mode, built, ctx, `${where}/${child.name}`);
      parts[key] = wrapPositionedRefPart(child, built, ctx, `${where}/${child.name}`, key);
    }
    i++;
  }
  return parts;
}

function buildPart(
  m: Merged,
  parentMode: ParentModes | null,
  ctx: Ctx,
  where: string,
  /** This part's own claimed key — the parent-derived-prefix context for its
   *  children's dedup (see partKey). */
  selfKey: string,
): Record<string, unknown> | null {
  const part: Record<string, unknown> = {};
  const visibleWhen = visibilityFromPresence(m, ctx, where);
  // Unpredictable strict-subset presence: the part is omitted as a NAMED
  // degradation (see OMIT_PART) — an unconditional emission would draw it in
  // variants that never carried it.
  if (visibleWhen === OMIT_PART) return null;
  // dump v1.31 canvas facts with no carrier on ANY part class — named once
  // here so no branch below can return past them.
  nameReactions(m, ctx, where);
  nameItemReverseZIndex(m, ctx, where);
  if (m.type !== 'FRAME' && m.type !== 'COMPONENT') carryAspectRatio(m, null, ctx, where);

  // dump v1.7 tolerance ledger — additive capture channels the proposer does
  // not carry yet are NAMED once per part, never a throw and never silent.
  // (`abs` is CARRIED since round 2 iteration 2 — carryAbsPlacement per
  // branch below; refusals stay named inside it.)
  if (m.occ.some((o) => o.node.imageFill !== undefined)) {
    ctx.notes.push(
      m.occ.some((o) => typeof o.node.imageFill === 'string')
        ? `${where}: IMAGE fill carried BY HASH (dump v1.9 \`imageFill\`) — a FRAME part renders the exported asset (url('./assets/images/<hash>.png')); a nested-instance part renders through the child contract's own carriage (a per-instance photo override is NOT carried — named limit); the placeholder gradient remains the fallback when the asset is absent`
        : `${where}: IMAGE fill captured BY NAME only (dump v1.7 \`imageFill\`) — the image itself is NOT exported (a later round exports the asset); a FRAME part renders the neutral placeholder gradient in its place (stub instances via their stub geometry; other node classes render without the image)`,
    );
  }

  if (m.type === 'TEXT') {
    const byProp: ByPropCollector = { map: {} };
    const tokens = invertTextTokens(m, ctx, where, byProp);
    attachByProp(part, byProp);
    carryTextCase(m, part, ctx, where); // dump v1.16 — declared text-transform
    carryFontSlant(m, part, ctx, where); // FC-DUMP-PROPOSE-ITALIC-DROPPED — declared font-style
    carryFontFamily(m, part, ctx, where); // dump v1.31 — declared font-family
    carryTextAlign(m, part, ctx, where); // dump v1.31 — declared text-align
    invertNodeOpacity(m, part, tokens, ctx, where);
    liftUnboundTextPaintsToLiterals(m, part, tokens, ctx, where);
    nameEffectProvenance(m, ctx, where); // dump v1.31
    if (m.occ.some((o) => (o.node.effects?.length ?? 0) > 0)) {
      ctx.notes.push(
        `${where}: visible effect(s) on a TEXT node — a text shadow has no contract vocabulary (box-shadow is a box channel); channel NAMED, not proposed (dump v1.2)`,
      );
    }
    const property = unifiedPropRef(m, 'characters', ctx, where);
    const characters = first(m.occ, (n) => n.text?.characters) ?? '';
    // ROUND 3 — a node a HOST overrides is per-usage API even with no drawn
    // TEXT property (see resolveTextOverrideDemand). A real drawn property
    // always wins: promotion only fires where `property` is absent.
    const promoted = property ? undefined : ctx.textPromote?.get(where.slice(`${ctx.setName}:root/`.length));
    if (property) {
      registerTextProp(ctx, property, characters);
      // THE SAME name registerTextProp used — via the same function, not a
      // second copy of the rule. This line used to re-derive it with
      // canonicalPropName, so the moment the stamp renamed the prop to
      // `children` the binding still said `content` and the emitter refused
      // the contract by name: part "label" binds content to unknown text prop
      // "content". A naming rule with two implementations has two answers.
      part.content = { prop: textPropName(ctx, property) };
    } else if (promoted) {
      // The synthetic `property` is the node path: unique within the set (so
      // registerTextProp's dedup holds) and never emitted — a figmaless prop
      // binds kind NONE, which the schema requires to carry no property.
      registerTextProp(ctx, ` textOverride:${where}`, characters, promoted);
      const entry = ctx.textProps.find((t) => t.name === promoted);
      if (entry) entry.figmaless = true;
      part.content = { prop: promoted };
    } else {
      part.text = characters;
      bindTextByAxis(m, part, ctx, where);
    }
    // Overlay-flattened class: a TEXT node with a captured abs box positions
    // absolutely (never baking abs width/height — text boxes hug; the
    // symmetric-box case pins both edges + centers, see carryAbsPlacement).
    carryAbsPlacement(m, part, tokens, ctx, where, { text: true });
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (m.type === 'SLOT') {
    // NATIVE Figma slot node (Schema 2025) — the spelling the emitter writes
    // since the native-slots round. Its LAYER NAME is its SLOT property's
    // display name (renaming the layer renames the property, live probe 2b),
    // so `m.name` is the property and the part's slot name canonicalizes from
    // it exactly as the INSTANCE_SWAP path canonicalizes its property.
    const nativeSlot: Record<string, unknown> = { name: canonicalPropName(m.name) };
    applySlotAccepts(nativeSlot, m.name, ctx, where, true, first(m.occ, (n) => n.propRefs?.slotContentId));
    // The slot's DRAWN CHILDREN are its design-time content (instances
    // inherit them; resetSlot returns to them) — the native spelling of what
    // the swap convention held as one swapped instance.
    const drawn = m.children.filter((c) => c.type === 'INSTANCE');
    // PHASE 2 EXAM (slot-frame-child-default-content): drawn content that is
    // NOT a bare instance — a FRAME (with whatever it holds), a TEXT, a
    // shape — is design-time content too, and it vanished with no receipt
    // (the Card's Content slot lost Title[Kicker, Heading] and Footer[Chip,
    // Button Group]; only the bare Dek instance survived). defaultContent
    // holds component refs only, so a FRAME has no carrier: NAMED, with its
    // whole subtree spelled out, never silent.
    const undrawn = m.children.filter((c) => c.type !== 'INSTANCE');
    if (undrawn.length > 0) {
      const describe = (c: Merged): string => {
        const kids = c.children.map(describe);
        const n = c.occ[0].node;
        const what = c.type === 'INSTANCE' ? `INSTANCE "${c.name}" of "${n.instanceOf ?? c.name}"` : `${c.type} "${c.name}"${c.type === 'TEXT' && n.text ? ` ${JSON.stringify(n.text.characters)}` : ''}`;
        return kids.length > 0 ? `${what} [${kids.join(', ')}]` : what;
      };
      ctx.notes.push(
        `${where}: native slot "${m.name}" drawn content includes ${undrawn.map(describe).join('; ')} — design-time content that is not a bare INSTANCE; slot defaultContent carries component refs only, so a FRAME child (and everything under it) has no carrier and is NAMED, not carried (Phase 2 exam: the Card Content slot's Title/Footer frames; make the frame a component, or author the slot's defaultContent, to carry it)`,
      );
    }
    if (drawn.length === 1) {
      applySlotDefaultContent(nativeSlot, m.name, drawn[0], ctx, where);
    } else if (drawn.length > 1) {
      ctx.notes.push(
        `${where}: native slot "${m.name}" holds ${drawn.length} drawn instances as design-time content — defaultContent not proposed (a multi-child default is carriable, but which children are DEFAULT content and which are a designer's fill is not readable from the canvas), review`,
      );
    }
    // What the canvas cannot enforce, the emitter wrote in words on the SLOT
    // property. Read it back BY NAME rather than re-deriving (or losing) it:
    // an `accepts` that says "restrict" on the code surface is invisible in
    // preferredValues, and inventing `restrict` from a soft hint would be a
    // guess. The description is carried as a note, never as a constraint.
    const described = ctx.slotDescriptions?.[m.name];
    if (described && described.includes('REFUSED BY FIGMA')) {
      ctx.notes.push(
        `${where}: native slot "${m.name}" carries a SLOT description naming a constraint the canvas cannot enforce — "${described}". The contract-side constraint (min/max/required/acceptsMode "restrict") is NOT proposed from it: the canvas holds the words, not the rule; re-declare it in the contract if it still applies`,
      );
    }
    part.slot = nativeSlot;
    // r11 (canvas conformance slot-interior-auto-layout + rest-slot-
    // interior-auto-layout; docs/23 §B.24 → §D.31): a SLOT node IS a frame with
    // auto-layout, and its interior layout is the layout the consumer's
    // content renders in. It inverts through the SAME doors every FRAME and
    // swap-convention slot-wrapper part walks — invertNodeTokens (gap /
    // padding and the box channels, minted or bound), invertLayout
    // (direction / justify / align / wrap, with r10's primary-axis `grow`
    // computed inside it by primaryAxisGrow — one rule, one implementation)
    // and invertLayoutByProp (the per-variant split) — never a second copy
    // of any rule. Until r11 this branch computed the grow alone and
    // returned, so the exam's Card Content slot (a padded COLUMN with item
    // spacing) reached neither the contract nor a note. A slot with no
    // drawn children is still a container (its children are the consumer's):
    // invertLayout's justify/align and the gap mint read that through
    // m.type, not the drawn child count.
    const slotByProp: ByPropCollector = { map: {} };
    const slotDeclared: Record<string, string> = {};
    const slotTokens = invertNodeTokens(m, false, ctx, where, slotByProp, part, slotDeclared);
    if (Object.keys(slotDeclared).length > 0) {
      part.declared = { ...(part.declared as Record<string, string> | undefined), ...slotDeclared };
    }
    attachByProp(part, slotByProp);
    const slotLayout = invertLayout(m, false, parentMode, ctx, where);
    if (slotLayout) part.layout = slotLayout;
    applyLayoutSplit(part, invertLayoutByProp(m, ctx, where));
    // dump v1.31 — a native SLOT's cross-axis FILL had NO door on this branch
    // (the FRAME branch walks both; this one returned first), so the Card
    // Inline Image's FILL-height under its ROW-variant Container was silent
    // (canvas conformance layout-fill-height-parent-mode-by-variant). Same
    // two doors, same order as the FRAME branch (r9); the grow they assume
    // is carried by invertLayout above (r10).
    crossAxisFillByProp(m, parentMode, part, ctx, where);
    carryCrossAxisFill(m, parentMode, part, ctx, where);
    invertNodeOpacity(m, part, slotTokens, ctx, where);
    invertNodeEffects(m, slotTokens, ctx, where);
    nameFixedChildGeometry(m, ctx, where); // FC-GEOMETRY-EXCLUDED receipt (Phase 2 exam: Card Inline Image SLOT 308px)
    attachTokens(ctx, part, slotTokens);
    // Same visibility conventions as every other slot path: the "Show X"
    // convention marks the part optional; any other BOOLEAN visibility
    // binding is a real boolean prop driving the part.
    const slotVisibleRef = unifiedPropRef(m, 'visible', ctx, where);
    const slotOptional = slotVisibleRef === `Show ${m.name}`;
    if (slotOptional) part.optional = true;
    else if (slotVisibleRef) applyVisibleBinding(part, slotVisibleRef, ctx, where, m);
    ctx.notes.push(
      `${where}: NATIVE Figma slot node "${m.name}" (Schema 2025) — proposed as slot part; regeneration reproduces a native slot, never an INSTANCE_SWAP placeholder`,
    );
    ctx.slots.push({ part, property: m.name, optional: slotOptional || slotVisibleRef !== undefined });
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
    nameEffectProvenance(m, ctx, where); // dump v1.31
    if (m.occ.some((o) => (o.node.effects?.length ?? 0) > 0)) {
      ctx.notes.push(
        `${where}: visible effect(s) on a nested instance — not representable on a component ref (dump v1.2); review`,
      );
    }
    // dump v1.31 — HOST facts on a nested instance, named before any branch
    // returns: overrides of the child's internals (the icon colour per
    // variant) and FIXED swap values (a configured nested Icon). Both are
    // host facts the child contract cannot know; neither has a carrier in
    // the composition grammar (a component ref carries props only).
    nameHostOverrides(m, ctx, where);
    nameFixedSwaps(m, ctx, where);
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
      if (m.occ.some((o) => absBoxOf(o.node) !== undefined)) {
        ctx.notes.push(
          `${where}: absolute placement captured (dump v1.7 \`abs\`) on the refused self-instance — not carried (nothing renders here); ledgered by name`,
        );
      }
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
    // ROUND 3 — instance TEXT overrides, HOST half. The characters THIS host
    // set on the child's text nodes (dump v1.10) become applied prop values
    // on the component ref, through the child's own promoted text prop.
    carryTextOverrides(m, component, id, instanceOf, ctx, where);
    // The instance's own geometry/paints belong to the child contract — elided.
    // ROUND 2 ITERATION 9 — PER-INSTANCE OVERRIDES (component-ref level).
    // A Figma instance can carry its own image fill, its own box, its own
    // solid paint; the linked child renders ITS OWN minted facts everywhere.
    // With the accumulated minted-value ledger in hand (instanceOverrides),
    // each observed per-occurrence fact is compared against what the child
    // renders for the occurrence's applied props; a PROVEN divergence mints
    // an override ref (standard per-variant classification) carried as
    // component.overrides — but only through channels the child DECLARES
    // overridable. No ledger / no divergence / undeclared channel → the
    // classic behavior, byte-identical.
    let paintOverrideCarried = false;
    if (ctx.instanceOverrides && ctx.mint && id) {
      const child = ctx.contractsById?.get(id) as
        | (MinimalChildContract & { anatomy?: { root?: { tokens?: Record<string, string>; overridable?: string[] } } })
        | undefined;
      const childRoot = child?.anatomy?.root;
      const childOv = new Set(childRoot?.overridable ?? []);
      const childTokens = childRoot?.tokens ?? {};
      if (childOv.size > 0) {
        // An occurrence with NO applied props still resolves placeholder-less
        // child bindings (a setless glyph stub has no props to apply) — the
        // empty record only fails resolution when a placeholder NEEDS a value.
        const canonByOcc: Array<Record<string, string | boolean>> = m.occ.map((o) =>
          o.node.componentProperties
            ? canonicalizeInstanceProps(instanceOf, o.node.componentProperties, id, ctx, where, true, keys)
            : {},
        );
        /** The child's own resolved value for one occurrence: the root
         *  binding's placeholders substituted with the occurrence's
         *  canonicalized applied props, looked up in the minted-value
         *  ledger. undefined = divergence not provable for this channel. */
        const resolveChildValue = (cssProp: string, canon: Record<string, string | boolean>): string | undefined => {
          const refStr = childTokens[cssProp];
          if (typeof refStr !== 'string') return undefined;
          let path = refStr.replace(/^\{|\}$/g, '');
          for (const ph of [...path.matchAll(/\{([a-z][\w-]*)\}/g)]) {
            const v = canon[ph[1]];
            if (v === undefined) return undefined;
            path = path.replaceAll(ph[0], String(v));
          }
          return ctx.instanceOverrides!.get(path);
        };
        const ovTarget: Record<string, string> = {};
        let ovQueued = false;
        // GAP-CLOSING ROUND 7 — PER-INSTANCE RING (the stub glyph's own ink
        // AND its box). A stroke-drawn glyph stub renders the ring witness
        // its FIRST claimant observed; every other host observes its own
        // (`instancePrimaryFill` with stroke/ellipse/src, dump v1.7) and, when
        // the two differ, mints the ring RECOMPUTED FROM ITS OWN observation
        // through the same ringGradientCss the stub minted with — so equal
        // paints produce equal bytes and only a real divergence overrides.
        // The ring and the box are one fact: the baked radii come from the
        // same paint as the measured box, so they carry together or not at
        // all (a box override alone would tear the ring off its radius).
        let ringOverrideCarried = false;
        if (childOv.has('background-image')) {
          const rings = m.occ.map((o) => (isRingPaint(o.node.instancePrimaryFill) ? ringGradientCss(o.node.instancePrimaryFill) : undefined));
          if (rings.length > 0 && rings.every((r) => r !== undefined)) {
            let proven = false;
            let unresolved = false;
            m.occ.forEach((o, i) => {
              const expected = resolveChildValue('background-image', canonByOcc[i]);
              if (expected === undefined) unresolved = true;
              else if (expected !== rings[i]) proven = true;
            });
            if (proven && !childOv.has('size')) {
              ctx.notes.push(
                `${where}: the nested "${instanceOf}" draws a DIFFERENT ring than ${id} mints (dump v1.7 stroke/ellipse witness) but the child declares no size channel — ring and box carry together or not at all; per-usage ring NOT carried, review`,
              );
            } else if (proven) {
              mintObservation(
                ctx,
                ovTarget,
                where,
                'background-image',
                'gradient',
                m.occ.map((o, i) => ({ variant: o.variant, value: rings[i]! })),
              );
              ovQueued = true;
              ringOverrideCarried = true;
              ctx.notes.push(
                `${where}: PER-INSTANCE RING OVERRIDE proposed (round 7) — this host's observed stroke ring (${[...new Set(m.occ.map((o) => (isRingPaint(o.node.instancePrimaryFill) ? `#${o.node.instancePrimaryFill.hex} @ ${o.node.instancePrimaryFill.src}px` : '')))].join(', ')}) diverges from the ring ${id} minted for its first claimant; carried as component.overrides['background-image'], recomputed at THIS host's drawn radius`,
              );
            } else if (unresolved) {
              ctx.notes.push(
                `${where}: per-instance ring observed on the LINKED instance but ${id}'s own value could not be resolved from the minted ledger — divergence unproven, ring override NOT carried (the instance renders the child's default), review`,
              );
            }
          }
        }
        // background-image — per-instance IMAGE identity (dump v1.9).
        if (childOv.has('background-image') && !ringOverrideCarried) {
          const withHash = m.occ.filter((o) => typeof o.node.imageFill === 'string');
          if (withHash.length > 0) {
            let proven = false;
            let unresolved = false;
            m.occ.forEach((o, i) => {
              if (typeof o.node.imageFill !== 'string') return;
              const expected = resolveChildValue('background-image', canonByOcc[i]);
              if (expected === undefined) unresolved = true;
              else if (expected !== imageFillCss(o.node.imageFill)) proven = true;
            });
            if (proven) {
              mintObservation(
                ctx,
                ovTarget,
                where,
                'background-image',
                'gradient',
                withHash.map((o) => ({ variant: o.variant, value: imageFillCss(o.node.imageFill) })),
                undefined,
                'none',
              );
              ovQueued = true;
              ctx.notes.push(
                `${where}: PER-INSTANCE IMAGE OVERRIDE proposed (iteration 9) — the instance's own imageFill hash (dump v1.9) diverges from what ${id} renders for the applied props; carried as component.overrides['background-image'] (the child's declared overridable channel)`,
              );
            } else if (unresolved) {
              ctx.notes.push(
                `${where}: per-instance image observed on the LINKED instance but ${id}'s own value could not be resolved from the minted ledger — divergence unproven, override NOT carried (the instance renders the child's default), review`,
              );
            }
          }
        }
        // size — per-instance BOX (Figma instances are freely resizable).
        if (childOv.has('size')) {
          const withBox = m.occ.filter((o) => o.node.bbox !== undefined);
          if (withBox.length === m.occ.length && withBox.length > 0) {
            if (withBox.some((o) => Math.abs(o.node.bbox!.width - o.node.bbox!.height) > 0.5)) {
              ctx.notes.push(
                `${where}: observed instance box is NOT square — the size override channel carries ONE square custom property (glyph-box vocabulary); override not carried, review`,
              );
            } else {
              let proven = false;
              m.occ.forEach((o, i) => {
                const expW = resolveChildValue('width', canonByOcc[i]);
                const expH = resolveChildValue('height', canonByOcc[i]);
                if (expW === undefined || expH === undefined) return;
                if (
                  Math.abs(o.node.bbox!.width - parseFloat(expW)) > 0.5 ||
                  Math.abs(o.node.bbox!.height - parseFloat(expH)) > 0.5
                ) {
                  proven = true;
                }
              });
              // GAP-CLOSING ROUND 7 — the ring/box PAIR rule, host side. When
              // the child's own background-image IS a ring (baked radii), a
              // box override without the matching ring override would stretch
              // the box off its own radius. Refused BY NAME rather than
              // shipped half.
              const childRing = canonByOcc.some((c) => (resolveChildValue('background-image', c) ?? '').startsWith('radial-gradient('));
              if (proven && childRing && !ringOverrideCarried) {
                ctx.notes.push(
                  `${where}: the observed box of the nested "${instanceOf}" diverges from ${id}'s minted box, but ${id} paints the RING WITNESS (baked radii) and this host's ring could not be recomputed from its own observation — box and ring carry together or not at all; size override NOT carried, review`,
                );
              } else if (proven) {
                mintObservation(
                  ctx,
                  ovTarget,
                  where,
                  'size',
                  'px',
                  m.occ.map((o) => ({ variant: o.variant, value: o.node.bbox!.width })),
                );
                ovQueued = true;
                ctx.notes.push(
                  `${where}: PER-INSTANCE SIZE OVERRIDE proposed (iteration 9) — the observed box diverges from what ${id} renders for the applied props; carried as component.overrides['size'] (one square custom property driving the child root's width/height and any part bound to the same refs)`,
                );
              }
            }
          }
        }
        // background-color — per-instance solid paint (dump v1.7, stub roots).
        if (childOv.has('background-color')) {
          const paints = m.occ.map((o) => {
            const f = o.node.instancePrimaryFill;
            return f && f.stroke !== true && f.hex !== undefined && f.var === undefined ? `#${f.hex}` : undefined;
          });
          if (paints.length > 0 && paints.every((p) => p !== undefined)) {
            let proven = false;
            m.occ.forEach((o, i) => {
              const expected = resolveChildValue('background-color', canonByOcc[i]);
              if (expected !== undefined && expected.toLowerCase() !== paints[i]!.toLowerCase()) proven = true;
            });
            if (proven) {
              mintObservation(
                ctx,
                ovTarget,
                where,
                'background-color',
                'color',
                m.occ.map((o, i) => ({ variant: o.variant, value: paints[i]! })),
              );
              ovQueued = true;
              paintOverrideCarried = true;
              ctx.notes.push(
                `${where}: PER-INSTANCE PAINT OVERRIDE proposed (iteration 9) — the observed instance paint (dump v1.7 instancePrimaryFill) diverges from ${id}'s own minted paint; carried as component.overrides['background-color']`,
              );
            }
          }
        }
        // A carried ring IS a carried per-usage paint — the trailing ledger
        // note below must not claim the divergence went unrepresented.
        if (ringOverrideCarried) paintOverrideCarried = true;
        if (ovQueued) ctx.mint.refOverrides.push({ component, target: ovTarget });
      }
    }
    if (ctx.mint && id === null && ctx.stubs.has(String(component.id))) {
        // GAP-CLOSING ROUND 10 — A SET CANNOT SEE THE STUB IT CLAIMS ITSELF.
        //
        // Child stubs are built at the END of a proposal (they need every
        // occurrence first), so while the anatomy is being walked a
        // SELF-CLAIMED stub is not in `contractsById` and the whole
        // per-instance override pass above is skipped. Every worked example
        // of a carried size override in this kit is a stub claimed by an
        // EARLIER set in the import order; the sole-host case — Avatar's
        // `user` glyph, drawn at 16/20/24/28/32/32px across the six sizes —
        // fell through silently and the glyph drew at ONE size everywhere.
        //
        // The ledger cannot referee it (the child's value does not exist
        // yet), but it does not have to: a stub carries exactly ONE
        // provisional box, so a host that drew MORE THAN ONE has PROVEN the
        // divergence by construction, whichever box the stub ends up with.
        // That is the only claim made here — the observed per-usage boxes
        // are minted exactly as the ledger path mints them. If the stub then
        // declines to declare `size` overridable, validateContract refuses
        // this override BY NAME at generate time; it is never a silent no-op.
        // …and only where the stub could not have explained the box ITSELF.
        // A stub's only axes are the props the instances apply, so a box that
        // is already a function of THOSE is one the stub will carry per value
        // and the host must not restate (measured: Avatar's online-indicator
        // and company-icon children apply Size, their boxes track it exactly,
        // and an override there would be a redundant second spelling of the
        // same observation — plus a wrapper element in the DOM). The `user`
        // glyph applies NOTHING, so all six of its boxes share one empty
        // combination and only the host can tell them apart.
        const boxes = m.occ.map((o) => o.node.bbox);
        const square = boxes.every((b) => b !== undefined && Math.abs(b.width - b.height) <= 0.5);
        const distinct = new Set(boxes.map((b) => b?.width)).size;
        const byApplied = new Map<string, Set<number>>();
        for (const o of m.occ) {
          const key = JSON.stringify(o.node.componentProperties ?? {});
          (byApplied.get(key) ?? byApplied.set(key, new Set()).get(key)!).add(o.node.bbox?.width ?? -1);
        }
        const stubCanExplain = [...byApplied.values()].every((w) => w.size === 1);
        if (square && distinct > 1 && !stubCanExplain) {
          const ovTarget: Record<string, string> = {};
          mintObservation(
            ctx, ovTarget, where, 'size', 'px',
            m.occ.map((o) => ({ variant: o.variant, value: o.node.bbox!.width })),
          );
          ctx.mint.refOverrides.push({ component, target: ovTarget });
          ctx.notes.push(
            `${where}: PER-INSTANCE SIZE OVERRIDE proposed (round 10, SELF-CLAIMED stub) — this set is the claimant of "${instanceOf}"'s stub, so the stub does not exist yet and its minted box cannot be consulted; it carries ONE provisional box and this host drew ${distinct} (${[...new Set(boxes.map((b) => `${b!.width}×${b!.height}`))].join(', ')}), which proves the divergence without the ledger. Carried as component.overrides['size']`,
          );
        }
    }
    // dump v1.7: an observed subtree paint on a LINKED instance is ledgered —
    // the child contract owns its paint, and a per-usage paint override is
    // representable ONLY through a channel the child declares overridable
    // (iteration 9, carried above when proven); otherwise it stays this
    // named note (field case: Untitled UI's _Dot is purple inside Badge and
    // white inside Button; whichever proposal claimed the stub fixed its
    // paint — and a glyph-carried stub BAKES its exported ink).
    if (id && !paintOverrideCarried) {
      const observedPaint = first(m.occ, (n) => n.instancePrimaryFill);
      if (observedPaint) {
        ctx.notes.push(
          `${where}: observed subtree paint (${observedPaint.var !== undefined ? `var ${observedPaint.var}` : `hex ${observedPaint.hex}`}, dump v1.7 instancePrimaryFill) on an instance LINKED to ${id} — the child contract owns its paint; a per-usage paint override is not representable on a component ref (ledgered, review if the linked contract's paint differs)`,
        );
      }
    }
    part.component = component;
    carryClip(m, part, ctx, where, { carry: false, owner: 'component-ref part' }); // FC-DUMP-PROPOSE-CLIP-UNREAD
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
  // G9.2: an ABSOLUTELY placed child of a CARRIED grid is never a spacer. A
  // spacer's whole job is in-flow growth, and the spacer branch therefore
  // ledgers `abs` away without carrying it — a standing choice under flex
  // parents, and a wrong one under a grid: the grid's all-or-none placement
  // rule (G2) then counts the child IN FLOW with no cell and the whole grid is
  // lost. Scoped to carried grid parents, so no flex spacer anywhere moves.
  const absUnderGrid =
    parentMode?.grid?.carried === true &&
    !parentMode.grid.flow &&
    m.occ.some((o) => o.node.abs !== undefined);
  if (isSpacer(m) && !absUnderGrid) {
    const layout = invertLayout(m, false, parentMode, ctx, where);
    if (layout) part.layout = layout;
    applyLayoutSplit(part, invertLayoutByProp(m, ctx, where));
    nameFixedChildGeometry(m, ctx, where); // FC-GEOMETRY-EXCLUDED receipt
    if (m.occ.some((o) => absBoxOf(o.node) !== undefined)) {
      ctx.notes.push(
        `${where}: absolute placement captured (dump v1.7 \`abs\`) on a SPACER part — a spacer's job is in-flow growth; placement not carried (ledgered by name)`,
      );
    }
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const partByProp: ByPropCollector = { map: {} };
  const partDeclared: Record<string, string> = {};
  const tokens = invertNodeTokens(m, false, ctx, where, partByProp, part, partDeclared);
  if (Object.keys(partDeclared).length > 0) {
    part.declared = { ...(part.declared as Record<string, string> | undefined), ...partDeclared };
  }
  attachByProp(part, partByProp);

  // dump v1.7 `imageFill` on a FRAME part — the exported asset (dump v1.9
  // hash) or the neutral placeholder gradient (boolean marker) renders where
  // the image is drawn ('none' elsewhere), same carriage as the root site;
  // no-op when the field is absent.
  if (m.occ.some((o) => o.node.imageFill !== undefined)) {
    mintObservation(
      ctx,
      tokens,
      where,
      'background-image',
      'gradient',
      m.occ.map((o) => ({
        variant: o.variant,
        value: imageFillCss(o.node.imageFill),
      })),
      undefined,
      'none', // presence-shaped: undrawn axis combinations draw no image
    );
    if (m.occ.some((o) => typeof o.node.imageFill === 'string')) declareImageFillCover(part);
  }

  // v9 shape (#42, dump v1.3): parametric leaf decor — the part carries the
  // captured geometry, hidden-pattern visibility, and per-variant placement.
  // dump v1.7 plain rects (unrotated, outside auto-layout — slider/progress
  // tracks) are NOT decor shapes: their geometry mints as ordinary
  // width/height channels (per-axis-conditioned like every other minted
  // channel) and fill/radius ride the existing token channels.
  if (m.occ.some((o) => o.node.shape !== undefined)) {
    if (visibleWhen) part.visibleWhen = visibleWhen;
    invertHiddenVisibility(m, part, ctx, where);
    if (isPlainRectShape(m)) {
      mintPlainRectGeometry(m, part, tokens, ctx, where);
      // Overlay-flattened class: an ABSOLUTE plain rect's placement (DumpShape
      // x/y/right/bottom) rides the shared carrier; width/height were minted
      // just above, so only the offsets join here.
      carryAbsPlacement(m, part, tokens, ctx, where, { size: false });
    } else {
      invertNodeShape(m, part, ctx, where);
      liftUnboundShapePaintsToLiterals(m, part, tokens, ctx, where);
    }
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
    applyLayoutSplit(part, invertLayoutByProp(m, ctx, where));
    invertNodeOpacity(m, part, tokens, ctx, where);
    invertNodeEffects(m, tokens, ctx, where);
    attachTokens(ctx, part, tokens);
    carryGridAxisSizing(m, part, ctx, where, tokens); // G8
    nameFixedChildGeometry(m, ctx, where); // FC-GEOMETRY-EXCLUDED receipt
    const slot: Record<string, unknown> = { name: canonicalPropName(soleSwap) };
    applySlotAccepts(slot, soleSwap, ctx, where);
    applySlotDefaultContent(slot, soleSwap, soleChild, ctx, where);
    const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
    const optional = visibleRef === `Show ${soleSwap}`;
    if (optional) part.optional = true;
    else if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
    part.slot = slot;
    ctx.slots.push({ part, property: soleSwap, optional });
    carryClip(m, part, ctx, where, { carry: false, owner: 'slot part' }); // FC-DUMP-PROPOSE-CLIP-UNREAD
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  if (isWrapArtifact(m)) {
    invertNodeOpacity(m, part, tokens, ctx, where);
    carryClip(m, part, ctx, where, { carry: true }); // FC-DUMP-PROPOSE-CLIP-UNREAD
    invertNodeEffects(m, tokens, ctx, where);
    carryAbsPlacement(m, part, tokens, ctx, where, { size: true });
    carryCrossAxisFill(m, parentMode, part, ctx, where); // dump v1.31
    carryAspectRatio(m, part, ctx, where); // dump v1.31
    nameFixedChildGeometry(m, ctx, where); // FC-GEOMETRY-EXCLUDED receipt
    attachTokens(ctx, part, tokens);
    if (visibleWhen) part.visibleWhen = visibleWhen;
    return part;
  }

  const layout = invertLayout(m, false, parentMode, ctx, where);
  if (layout) part.layout = layout;
  applyLayoutSplit(part, invertLayoutByProp(m, ctx, where));
  // The COLUMN half of a per-variant FILL (round 6) — no-op unless the
  // parent's mode is a function of an axis and this part draws fillWidth.
  crossAxisFillByProp(m, parentMode, part, ctx, where);
  // dump v1.31: the cross-axis FILL the parent's align: stretch did not absorb.
  carryCrossAxisFill(m, parentMode, part, ctx, where);
  carryAspectRatio(m, part, ctx, where); // dump v1.31 targetAspectRatio → declared aspect-ratio
  invertNodeOpacity(m, part, tokens, ctx, where);
  carryClip(m, part, ctx, where, { carry: true }); // FC-DUMP-PROPOSE-CLIP-UNREAD
  invertNodeEffects(m, tokens, ctx, where);
  // Overlay-flattened class: a FRAME/GROUP with a captured abs box becomes a
  // positioned box (position: absolute + minted offsets/size).
  carryAbsPlacement(m, part, tokens, ctx, where, { size: true });
  // dump v1.8 `fixedSize`: the in-flow fixed-size box (mutually exclusive
  // with `abs` by dump construction — exact no-op on older dumps).
  mintFixedSize(m, part, tokens, ctx, where);
  nameFixedChildGeometry(m, ctx, where); // FC-GEOMETRY-EXCLUDED receipt (Phase 2 exam: Button (contract) 20×20 slot frames)
  attachTokens(ctx, part, tokens);
  carryGridAxisSizing(m, part, ctx, where, tokens); // G8
  const visibleRef = unifiedPropRef(m, 'visible', ctx, where);
  if (visibleRef) applyVisibleBinding(part, visibleRef, ctx, where, m);
  const mode = parentModesOf(m, ctx.mint !== undefined);
  // Pre-order key claiming + P9 run detection — see buildChildParts.
  const parts = buildChildParts(m.children, mode, ctx, where, selfKey);
  if (Object.keys(parts).length > 0) part.parts = parts;
  // A2 grid (G4): slot parts' cells hoist to layout.areas — the area name IS
  // the slot anchor; no-op unless this part carried a manual grid.
  hoistGridAreas(part, ctx, where);
  // A parent that owns positioned children is their positioning context.
  declareRelativeIfPositionedChildren(part, parts, m);
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
        // Coerce to the child contract's minted type at the composition
        // boundary: a bool-axis child spells its values "True"/"False" and
        // canonicalizes to the STRINGS 'true'/'false' — truthy against the
        // child's boolean prop ("false" renders the part; audit class
        // string-boolean-coercion). The applied value must land as the type
        // the child minted.
        out[childProp.name] = childProp.type === 'boolean' ? canonical === 'true' : canonical;
        mapped++;
        continue;
      }
      if (childProp.type === 'boolean') {
        const spelled = value.trim().toLowerCase();
        if (spelled === 'true' || spelled === 'false') {
          out[childProp.name] = spelled === 'true';
          mapped++;
          continue;
        }
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

/** THE RING WITNESS, IN ONE SPELLING (iteration 5 minted it; GAP-CLOSING
 *  ROUND 7 lets a HOST override it per usage). A stroke-drawn subtree paint
 *  whose source is a centered circle with an observed box renders as an exact
 *  radial-gradient band at the DRAWN radius, align-aware. The stub mints it
 *  from the FIRST claimant's observation and every other host recomputes it
 *  from its OWN — same function, same bytes for the same paint, so a host's
 *  override is provably a divergence and never a re-spelling. */
type RingPaint = DumpPaint & { stroke: true; ellipse: true; src: number; weight?: number; align?: string };
const isRingPaint = (p: unknown): p is RingPaint =>
  typeof p === 'object' && p !== null &&
  (p as { stroke?: unknown }).stroke === true &&
  (p as { ellipse?: unknown }).ellipse === true &&
  typeof (p as { src?: unknown }).src === 'number' &&
  (p as { hex?: unknown }).hex !== undefined;
function ringGradientCss(p: RingPaint): string {
  const f = (x: number) => Math.round(x * 100) / 100;
  const w = p.weight ?? 1;
  const r = p.src / 2;
  const rin = p.align === 'INSIDE' ? r - w : p.align === 'OUTSIDE' ? r : r - w / 2;
  const rout = p.align === 'INSIDE' ? r : p.align === 'OUTSIDE' ? r + w : r + w / 2;
  const c = paintCssHex(p);
  return `radial-gradient(circle, transparent ${f(rin)}px, ${c} ${f(rin)}px, ${c} ${f(rout)}px, transparent ${f(rout)}px)`;
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
  iconRes: StubIconResolution | null = null,
): { tokens: Record<string, string>; tree: Record<string, unknown>; count: number; entries: MintedEntry[]; circleRadius50?: boolean; ringWitness?: boolean } | null {
  if (!ctx.mint) return null;
  // ITERATION 8 — when the stub carries its exported glyph (fixed/byProp),
  // the SVG bakes the drawn ink: every witness-paint channel (solid fill,
  // ring gradient, border, radius) would double-draw under it, so only the
  // observed BOX mints. The suppression is named by the caller's glyph note.
  const glyphCarried = iconRes !== null && iconRes.kind !== 'circleFill';
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
    !glyphCarried &&
    geo.every((o) => o.stroke?.hex !== undefined && typeof o.strokeWeight === 'number') &&
    new Set(geo.map((o) => o.strokeWeight)).size === 1;
  if (!glyphCarried && !strokesCarriable && geo.some((o) => o.stroke !== undefined)) {
    ctx.notes.push(
      `stub ${capture.id}: stroke drawn on ${geo.filter((o) => o.stroke).length}/${geo.length} observed occurrence(s) (or var-bound/non-uniform) — border not carried on the stub geometry (presence is not a function of the stub's axes), review`,
    );
  }
  const observations: MintObservation[] = [];
  const push = (cssProperty: string, kind: MintObservation['kind'], value: (o: StubCapture['observed'][number]) => string | number | null, sparse?: string) => {
    const occ = geo.map((o) => ({ variant: o.variant, axisValues: axisValuesFor(o), value: value(o) }));
    if (occ.some((x) => x.value === null)) return;
    observations.push({
      nodePath: `stub ${capture.id}`,
      part: '',
      cssProperty,
      kind,
      occurrences: occ as Array<{ variant: string; axisValues: Record<string, string>; value: string | number }>,
      ...(sparse !== undefined ? { sparse } : {}),
    });
  };
  push('width', 'px', (o) => Math.round(o.bbox!.width * 100) / 100);
  push('height', 'px', (o) => Math.round(o.bbox!.height * 100) / 100);
  // Stub paint: the instance's OWN fill first; else the first visible SOLID
  // observed inside its subtree (dump v1.7 instancePrimaryFill) — the paint
  // the drawn box actually shows (field case: Untitled UI Badge's _Dot,
  // observed 6×6 but rendered invisible without its 9e77ed dot paint).
  // Stroke-aware: a `{ stroke: true, weight }`-flagged subtree paint (line
  // icons — the subtree draws with strokes only) renders as a BORDER on the
  // stub root (weight px solid color), never a background (field case:
  // Untitled UI Button's leading circle icon — invisible when its stroke
  // paint minted nothing).
  const paintOf = (o: StubCapture['observed'][number]): (DumpPaint & { stroke?: boolean; weight?: number; ellipse?: boolean; src?: number; align?: string }) | undefined =>
    o.fill ?? o.instancePrimaryFill;
  const isStrokeObserved = (o: StubCapture['observed'][number]): boolean =>
    o.fill === undefined && o.instancePrimaryFill?.stroke === true;
  // ITERATION 8 — glyph-carried stubs mint no paint channels (see above).
  const fills = glyphCarried ? [] : geo.filter((o) => paintOf(o) !== undefined);
  const strokeObserved = fills.filter(isStrokeObserved);
  let backgroundVarRef: string | null = null;
  // GAP-CLOSING ROUND 7 — the ring witness and the parametric circular radius
  // are decided in two places (stroke-ring path, circle-fill path) and read by
  // the caller, so both flags live here.
  let ringWitness = false;
  let circleRadius50 = false;
  if (strokeObserved.length > 0 && strokeObserved.length < fills.length) {
    ctx.notes.push(
      `stub ${capture.id}: observed subtree paint is a STROKE on ${strokeObserved.length}/${fills.length} painted occurrence(s) and a FILL on the rest — one channel is not a function of the stub's axes; neither carried, review`,
    );
  } else if (strokeObserved.length > 0) {
    // DRAWN-RADIUS RING (dump v1.7 stroke-aware walk, refined twice on
    // measurement): a stroke-observed subtree paint renders ONLY when its
    // drawn geometry is derivable — every occurrence carrying the CIRCULAR
    // witness (`ellipse`) AND the centered source's own box (`src`). The
    // ring then renders at the DRAWN radius as an exact radial-gradient
    // band on the stub root (align-aware: INSIDE [r-w, r], OUTSIDE
    // [r, r+w], else CENTER [r±w/2]) in the observed literal hex. One stub
    // is CLAIMED once but instanced across sets with different ink and
    // size (field case: the kit's circle icon strokes WHITE at 16.67px
    // inside Button and GRAY at 13.33px inside Dropdown list item) — the
    // first claimant's observation wins and every LINKED usage carries the
    // existing per-usage-override note (the _Dot ledger class; currentColor
    // was tried and measured WORSE — generated components bind text color
    // on text PARTS, so inheritance delivers the page default, not the
    // sibling label's ink). A stroke source whose geometry is NOT
    // derivable (x/plus/arrow line vectors) renders NOTHING and is refused
    // by name — a box border around a glyph is invented geometry, and it
    // measured WORSE than absence on every affected variant.
    const ringable =
      !strokesCarriable &&
      strokeObserved.every((o) => {
        const p = paintOf(o)!;
        return p.ellipse === true && typeof p.src === 'number' && p.hex !== undefined;
      });
    if (strokesCarriable) {
      ctx.notes.push(
        `stub ${capture.id}: subtree stroke paint observed but the instance draws its OWN stroke (already carried as the border) — subtree stroke paint not carried, review`,
      );
    } else if (ringable) {
      ringWitness = true;
      push(
        'background-image',
        'gradient',
        (o) => {
          const p = paintOf(o);
          if (p === undefined || !isStrokeObserved(o) || !isRingPaint(p)) return 'none';
          return ringGradientCss(p);
        },
        'none',
      );
      ctx.notes.push(
        `stub ${capture.id}: stroke source is a centered CIRCLE with an observed box (dump v1.7 \`ellipse\`/\`src\`) — the ring renders at the DRAWN radius as an exact radial-gradient band on the stub root (align-aware), not a border at the instance edge`,
      );
    } else {
      ctx.notes.push(
        `stub ${capture.id}: stroke-observed subtree paint (dump v1.7) but the drawn geometry is not derivable (stroke source is not a centered circle with an observed box) — nothing rendered for it; a box border around a glyph is invented geometry (refused by name, review)`,
      );
    }
    // Circle-ish stroke-drawn stub (equal width/height — Untitled UI's
    // circle icon): a circular border-radius is DERIVED only when the
    // captured stroke source carries the circular witness on every
    // stroke-observed occurrence (`ellipse: true`, stroke-aware walk) —
    // the drawn ink IS circular, so half the observed box is the observed
    // radius. A non-circular stroke source has no derivable radius; its
    // refusal is named above (nothing renders for it anyway).
    const circleIsh =
      geo.every((o) => Math.abs(o.bbox!.width - o.bbox!.height) < 0.5) &&
      !geo.some((o) => (o.cornerRadius ?? 0) !== 0);
    if (circleIsh && strokeObserved.every((o) => paintOf(o)!.ellipse === true)) {
      // GAP-CLOSING ROUND 7 — with per-instance overrides live the witnessed
      // "radius = half the box" spells as the parametric 50% literal, exactly
      // as the circle-fill witness already does below: value-identical at the
      // witnessed box, and still a circle when a host overrides the box (a px
      // radius baked at 20px would square a 16px usage).
      if (ctx.instanceOverrides) circleRadius50 = true;
      else push('border-radius', 'px', (o) => Math.round((o.bbox!.width / 2) * 100) / 100);
      ctx.notes.push(
        `stub ${capture.id}: circular stroke source on every observed occurrence (dump v1.7 stroke-aware walk) — circular border-radius derived from the observed box (${ctx.instanceOverrides ? 'spelled as the parametric 50% literal, correct under a host size override' : 'width/2'}), the stub box renders round`,
      );
    }
  } else if (fills.length > 0 && fills.every((o) => paintOf(o)!.hex !== undefined)) {
    // Occurrences without a fill are honestly TRANSPARENT (#00000000 — a
    // legal DTCG color and a CSS color), so a per-variant fill mints per
    // axis instead of dropping the channel.
    push('background-color', 'color', (o) => {
      const p = paintOf(o);
      return p ? paintCssHex(p) : '#00000000';
    });
  } else if (fills.length > 0) {
    // Var-bound observed paint (dump v1.7): when ONE variable serves every
    // observed occurrence, the stub's background binds the variable's ref
    // directly — it resolves through the captured-token layer, no literal
    // minted. Mixed vars / partial presence stays a NAMED limit.
    const vars = [...new Set(fills.map((o) => paintOf(o)!.var).filter((v): v is string => v !== undefined))];
    if (vars.length === 1 && fills.length === geo.length && fills.every((o) => paintOf(o)!.var !== undefined)) {
      backgroundVarRef = ref(vars[0]);
      ctx.notes.push(
        `stub ${capture.id}: observed primary paint is bound to variable "${vars[0]}" on every occurrence — background-color carried as ${backgroundVarRef} (resolves through the captured-token layer; dump v1.7 instancePrimaryFill)`,
      );
    } else {
      ctx.notes.push(
        `stub ${capture.id}: observed paint var-bound on some occurrence(s) but not one variable across all — background not carried on the stub geometry, review`,
      );
    }
  }
  if (strokesCarriable) {
    push('border-color', 'color', (o) => (o.stroke ? paintCssHex(o.stroke) : '#00000000'));
    push('border-width', 'px', (o) => (o.stroke ? o.strokeWeight! : 0));
  }
  if (!glyphCarried && geo.some((o) => (o.cornerRadius ?? 0) !== 0)) {
    push('border-radius', 'px', (o) => o.cornerRadius ?? 0);
  }
  // ITERATION 8 — circle-fill glyph WITNESS (StubIconAsset.circleFill): the
  // exported SVG's entire drawn ink is one filled circle, so the observed
  // solid-fill path keeps the per-usage ink (the export's baked color
  // contradicts the observations — field case _Dot) and the box renders
  // ROUND: the witnessed radius is half the observed square box. Derived
  // from the export's own geometry, nothing guessed.
  if (
    iconRes?.kind === 'circleFill' &&
    geo.every((o) => Math.abs(o.bbox!.width - o.bbox!.height) < 0.5) &&
    !geo.some((o) => (o.cornerRadius ?? 0) !== 0)
  ) {
    if (ctx.instanceOverrides) {
      // ROUND 2 ITERATION 9 — with per-instance size overrides live, the
      // witnessed "radius = half the box" spells as the parametric 50%
      // literal: value-identical at the witnessed box, and still a circle
      // when a host overrides the box (a px radius would square the dot).
      circleRadius50 = true;
      ctx.notes.push(
        `stub ${capture.id}: exported glyph is a PURE CIRCLE FILL (iteration 8 witness) — the observed solid-fill path stays (the export bakes its source component's ink, which the observed per-usage paints contradict); the circular radius is spelled as the parametric border-radius: 50% literal (iteration 9 — value-identical to the witnessed width/2, and correct under a host's per-instance size override); the baked SVG is committed as the export receipt, not rendered`,
      );
    } else {
      push('border-radius', 'px', (o) => Math.round((o.bbox!.width / 2) * 100) / 100);
      ctx.notes.push(
        `stub ${capture.id}: exported glyph is a PURE CIRCLE FILL (iteration 8 witness) — the observed solid-fill path stays (the export bakes its source component's ink, which the observed per-usage paints contradict) and the circular border-radius derives from the observed box (width/2); the baked SVG is committed as the export receipt, not rendered`,
      );
    }
  }
  // dump v1.7 `imageFill` on the stub instance — the exported asset (dump
  // v1.9 hash) or the neutral placeholder gradient (boolean marker) renders
  // where the image is drawn ('none' elsewhere); no-op when the field is
  // absent (older dumps).
  if (!glyphCarried && geo.some((o) => o.imageFill !== undefined)) {
    push('background-image', 'gradient', (o) => imageFillCss(o.imageFill), 'none');
    ctx.notes.push(
      geo.some((o) => typeof o.imageFill === 'string')
        ? `stub ${capture.id}: IMAGE fill carried BY HASH (dump v1.9 \`imageFill\`) — the stub renders the exported asset (url('./assets/images/<hash>.png')); the placeholder gradient remains the fallback when the asset is absent`
        : `stub ${capture.id}: IMAGE fill captured BY NAME only (dump v1.7 \`imageFill\`) — the image itself is NOT exported; the stub renders the neutral placeholder gradient (${IMAGE_FILL_PLACEHOLDER_GRADIENT}) in its place`,
    );
  }
  if (observations.length === 0) return null;
  const stubName = `stub-${capture.id.split('.').slice(1).join('-')}`;
  let minted = mintTokens(stubName, observations, axes);
  // GAP-CLOSING ROUND 10 — A STUB WHOSE BOX REFUSES HAS NOWHERE TO PUT ITS
  // HOST'S BOX EITHER, AND THE GLYPH THEN DRAWS AT ITS EXPORT SIZE FOREVER.
  //
  // A stub's box is a function of the HOST's axes, not its own: Untitled UI's
  // `user` glyph is drawn 16/20/24/28/32/32px across Avatar's six sizes and
  // the stub has no `size` prop of its own to explain that, so both box
  // channels refuse classification, no width/height binds, `size` is never
  // declared overridable — and the host's per-instance size machinery
  // (which exists, and which the Social icon stub uses) has no channel to
  // ride. The glyph then draws at the export's natural 24px inside every one
  // of those boxes; only md is right, by coincidence.
  //
  // The rule: A STUB'S BOX IS PROVISIONAL BY CONSTRUCTION — it is the box
  // ONE observation was drawn at, and the contract says so in prose already.
  // When it refuses to be a function of the stub's OWN axes, it falls back
  // to the BASE occurrence's box (the same base-slice fallback the design
  // path already takes for a refused padding channel, and the same
  // "first claimant's observation wins" rule the ring witness takes), so the
  // channel exists, `size` becomes overridable, and every host's OWN
  // observed box carries per usage. Nothing is invented: the provisional
  // value is an observation, and a host whose box differs overrides it.
  //
  // The pair rule holds — width and height are ONE square channel — so the
  // fallback applies only when BOTH refuse, never to half a box.
  const boxIdx = ['width', 'height'].map((c) => observations.findIndex((o) => o.cssProperty === c));
  if (boxIdx.every((i) => i >= 0 && !minted.bindings[i].ref)) {
    for (const i of boxIdx) observations[i] = { ...observations[i], occurrences: [observations[i].occurrences[0]] };
    minted = mintTokens(stubName, observations, axes);
    ctx.notes.push(
      `stub ${capture.id}: the observed box is not a function of the stub's own axes (${[...new Set(geo.map((o) => `${o.bbox!.width}×${o.bbox!.height}`))].join(', ')} across ${geo.length} occurrence(s)) — the PROVISIONAL box falls back to the base occurrence (${observations[boxIdx[0]].occurrences[0].value}×${observations[boxIdx[1]].occurrences[0].value}px), which is what makes the box overridable: a host whose own observation diverges carries it per usage through component.overrides['size']. Without the fallback the channel drops and the glyph draws at its export size in every box`,
    );
  }
  const tokens: Record<string, string> = {};
  minted.bindings.forEach((binding, i) => {
    if (binding.ref) tokens[observations[i].cssProperty] = binding.ref;
    else if (binding.reason) ctx.notes.push(`stub ${capture.id} ${observations[i].cssProperty}: ${binding.reason}`);
  });
  // Uniform var-bound observed paint (dump v1.7) — a captured-token ref, not
  // a minted leaf; joins the minted geometry bindings on the stub root.
  if (backgroundVarRef !== null) tokens['background-color'] = backgroundVarRef;
  if (Object.keys(tokens).length === 0 && !circleRadius50) return null;
  return { tokens, tree: minted.tree, count: minted.count, entries: minted.entries, circleRadius50, ringWitness };
}

/** ITERATION 8 — how a stub renders its exported glyph (or why not). */
type StubIconResolution =
  | { kind: 'fixed'; asset: string; natural: { width: number; height: number } }
  | { kind: 'byProp'; prop: string; natural: { width: number; height: number } }
  | { kind: 'circleFill' };

/** ITERATION 8 — resolve a stub's exported glyph asset(s) against the
 *  iconAssets manifest (instanceKey → asset). Carried ONLY when the evidence
 *  is total and the choice is prop-determined:
 *    · every observed occurrence maps (partial coverage is a named refusal);
 *    · one distinct asset → a fixed icon part;
 *    · several assets → carried only when the choice tracks exactly ONE of
 *      the stub's own variant axes and every asset is named exactly the
 *      axis's canonical value — the repo's `{prop}` enum-expansion icon
 *      convention (contracts/banner.contract.json statusIcon), so the
 *      emitters key ICONS by the live prop value;
 *    · a manifest entry flagged `circleFill` is a geometry WITNESS, not a
 *      carriage — the caller keeps the observed solid-fill path and derives
 *      the circular radius (the baked export ink contradicts the observed
 *      per-usage paints; see StubIconAsset). */
function resolveStubIcon(
  capture: StubCapture,
  props: Array<Record<string, unknown>>,
  ctx: Ctx,
): StubIconResolution | null {
  if (!ctx.iconAssets || capture.observed.length === 0) return null;
  const entries: StubIconAsset[] = [];
  let mapped = 0;
  for (const o of capture.observed) {
    const e = o.instanceKey !== undefined ? ctx.iconAssets.get(o.instanceKey) : undefined;
    if (e) mapped++;
    entries.push(e as StubIconAsset);
  }
  if (mapped === 0) return null;
  if (mapped < capture.observed.length) {
    ctx.notes.push(
      `stub ${capture.id}: exported glyph assets cover ${mapped}/${capture.observed.length} observed occurrence(s) — glyph not carried (partial evidence), witness geometry stands; review`,
    );
    return null;
  }
  if (entries.every((e) => e.circleFill === true)) return { kind: 'circleFill' };
  const natural = { width: entries[0].naturalWidth, height: entries[0].naturalHeight };
  const distinct = [...new Set(entries.map((e) => e.asset))];
  if (distinct.length === 1) return { kind: 'fixed', asset: distinct[0], natural };
  const enumProps = props.filter(
    (p): p is Record<string, unknown> & { name: string; type: { enum: string[] }; bindings: { figma: { property: string } } } =>
      typeof p.type === 'object' && p.type !== null && 'enum' in (p.type as object),
  );
  const candidates: string[] = [];
  for (const p of enumProps) {
    const property = p.bindings.figma.property;
    let ok = true;
    for (let i = 0; i < capture.observed.length; i++) {
      const applied = capture.observed[i].applied ?? {};
      let value: string | undefined;
      for (const [key, v] of Object.entries(applied)) {
        if (key.split('#')[0] === property && typeof v === 'string') value = camel(v);
      }
      if (value === undefined || value !== entries[i].asset) {
        ok = false;
        break;
      }
    }
    if (ok) candidates.push(String(p.name));
  }
  if (candidates.length === 1) return { kind: 'byProp', prop: candidates[0], natural };
  ctx.notes.push(
    `stub ${capture.id}: ${distinct.length} exported glyph assets across occurrences but the choice is not a function of exactly one variant axis with value-named assets${candidates.length > 1 ? ` (ambiguous axes: ${candidates.join(', ')})` : ''} — glyph not carried, witness geometry stands; review`,
  );
  return null;
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
      const keys = [...byCanonical.keys()];
      // A BOOLEAN Figma property often arrives as the strings "true"/"false"
      // (REST). One observed spelling is still a boolean, not an enum of
      // `["false"]` that then refuses a boolean applied value (CBDS Table-Data).
      if (keys.length > 0 && keys.every((k) => k === 'true' || k === 'false')) {
        props.push({
          name,
          type: 'boolean',
          default: keys.includes('true') ? keys[0] === 'true' : false,
          bindings: { figma: { kind: 'BOOLEAN', property }, code: { prop: name } },
        });
      } else {
        props.push({
          name,
          type: { enum: keys },
          default: camel(String(v0)),
          bindings: {
            figma: { kind: 'VARIANT', property, values: Object.fromEntries(byCanonical) },
            code: { prop: name },
          },
        });
      }
    }
  }
  const name = pascalComponentName(capture.instanceOf);
  // ITERATION 8 — exported stub glyph (SVG) resolution; null keeps the
  // classic witness-geometry behavior byte-identical.
  const iconRes = resolveStubIcon(capture, props, ctx);
  // dump v1.5: stub geometry — the observed box binds the root's tokens to
  // minted provisional leaves; a text prop observed on the instances renders
  // as the box's content (the drawn label is real observed content).
  const geometry = stubGeometry(capture, props, ctx, iconRes);
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
  // ITERATION 8 — the stub renders its EXPORTED VECTOR GLYPH: an icon part
  // per the repo's existing convention (assets/icons/<asset>.svg inlined by
  // the emitters; `{prop}` = enum expansion). With a minted box the glyph
  // part binds the SAME minted width/height refs as the root, and the
  // exported svg's root width/height attrs were rewritten to 100% at export
  // time (paths and viewBox verbatim) — the glyph fills the observed box,
  // per-variant refs included. Without a minted box it draws at the
  // export's own 1x size (icon.size). Ink is BAKED at the source
  // component — per-usage ink divergence stays a named note.
  if (iconRes && iconRes.kind !== 'circleFill') {
    const hasBox = geometry !== null && geometry.tokens.width !== undefined && geometry.tokens.height !== undefined;
    const icon: Record<string, unknown> = {
      asset: iconRes.kind === 'byProp' ? `{${iconRes.prop}}` : iconRes.asset,
      ...(hasBox ? {} : { size: iconRes.natural.width }),
    };
    (root.parts as Record<string, unknown>).glyph = {
      icon,
      ...(hasBox ? { tokens: { width: geometry!.tokens.width, height: geometry!.tokens.height } } : {}),
    };
    ctx.notes.push(
      `stub ${capture.id}: renders the EXPORTED VECTOR GLYPH (iteration 8 — SVG exported at 1x from the stub source's main component, assets/icons/${
        iconRes.kind === 'byProp' ? `<${iconRes.prop}>` : iconRes.asset
      }.svg${iconRes.kind === 'byProp' ? `, selected by the stub's "${iconRes.prop}" prop via the {prop} enum-expansion convention` : ''}) ${
        hasBox ? 'scaled to the minted observed box' : `at the export's own ${iconRes.natural.width}×${iconRes.natural.height}px (no minted box)`
      }; witness paint channels are NOT minted (the svg bakes the drawn ink) and per-usage ink divergence, if any, stays with the export's baked colors — import the real child set to replace the stub`,
    );
  }
  if (geometry) {
    if (Object.keys(geometry.tokens).length > 0) root.tokens = geometry.tokens;
    if (geometry.circleRadius50) root.literals = { 'border-radius': '50%' };
    // dump v1.9: a hash-form image fill on the stub renders the exported
    // asset — cover is the observed scaleMode FILL equivalence (the hash
    // form is captured only for FILL paints).
    if (geometry.tokens['background-image'] && capture.observed.some((o) => typeof o.imageFill === 'string')) {
      declareImageFillCover(root);
    }
    // ROUND 2 ITERATION 9 — a stub's every channel IS an observation of its
    // usage sites, so later hosts whose own observations diverge may
    // override: size (the observed box), background-color (the observed
    // instance paint), background-image (the observed image identity).
    // NOT declared when a minted value bakes drawn-geometry px inside a
    // gradient string (the iteration-5 ring witness — scaling its box would
    // tear the baked radii): that divergence stays a named note.
    if (ctx.instanceOverrides) {
      // GAP-CLOSING ROUND 7 — THE RING WITNESS BECOMES OVERRIDABLE.
      //
      // Iteration 9 refused it: a minted `radial-gradient` bakes drawn-radius
      // px, so overriding the BOX alone would tear the ring off its own
      // radii. That refusal cost the kit its most visible stub defect — the
      // shared `circle` stub is claimed by _Button base (20px box, WHITE ring
      // at src 16.67) and instanced by _Dropdown list item (16px box, gray
      // ring at src 13.33) and _Button group base (20px box, three state
      // inks), so the dropdown drew a white ring on white paper: an icon that
      // is not there, plus 4px of extra box shoving its label sideways.
      //
      // The tear is only possible when the two channels move APART. Both are
      // functions of the SAME observation (ringGradientCss reads the paint the
      // box was measured with), so the ring stub declares them as a PAIR and
      // the host side mints them as a pair — the geometry inside the gradient
      // is then the overriding host's own, not the claimant's stretched.
      const gradientBaked = geometry.entries.some(
        (e) => e.ref.includes('.background-image') && !/^(url\(|none$)/.test(String(e.value)),
      );
      const ringPair = Boolean(geometry.ringWitness) && geometry.tokens['background-image'] !== undefined;
      const declaredOv: string[] = [];
      if (geometry.tokens.width !== undefined && geometry.tokens.height !== undefined && (!gradientBaked || ringPair)) declaredOv.push('size');
      if (geometry.tokens['background-image'] !== undefined && (!gradientBaked || ringPair)) declaredOv.push('background-image');
      if (geometry.tokens['background-color'] !== undefined) declaredOv.push('background-color');
      if (declaredOv.length > 0) {
        root.overridable = declaredOv;
        ctx.notes.push(
          ringPair
            ? `stub ${capture.id}: overridable [${declaredOv.join(', ')}] declared (round 7) — the minted background-image is the RING WITNESS, whose baked radii are a function of the same observation as the box, so a host overrides the ring and the box TOGETHER (either alone is refused by name on the host side); absent an override the stub renders its own minted values unchanged`
            : `stub ${capture.id}: overridable [${declaredOv.join(', ')}] declared (iteration 9) — a host whose OBSERVED per-instance facts diverge from this stub's minted ones may override them per usage; absent an override the stub renders its own minted values unchanged`,
        );
      } else if (gradientBaked) {
        ctx.notes.push(
          `stub ${capture.id}: overridable NOT declared — the minted background-image bakes drawn-geometry px and is NOT the ring witness (whose radii are recomputable per usage); a per-instance size/image override would tear the baked geometry, so host divergence stays a named note`,
        );
      }
    }
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
      description: `STUB contract auto-proposed for the nested "${capture.instanceOf}" instances of ${ctx.setName} — the child set was not imported. Props are the observed applied values ONLY; anatomy and styling are NOT captured (dump v1 stops at instance boundaries)${geometry ? '; the root renders the OBSERVED bounding box and primary paint (dump v1.5) as honest provisional geometry' : ''}${iconRes && iconRes.kind !== 'circleFill' ? "; the root renders the source component's exported vector glyph (SVG, iteration 8) in place of witness paints" : ''}. Import the child set to replace this stub.`,
      semantics: { element: 'span' },
      props,
      states: [],
      anatomy: { root },
      bindings: {
        figma: { anchors: { fileKey, componentSetKey: capture.setKey ?? null } },
        code: { anchors: { importPath: `src/components/${name}`, export: name } },
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
function invertRootFixedSize(merged: Merged, root: Record<string, unknown>, rootTokens: Record<string, string>, ctx: Ctx, where: string) {
  if (!ctx.mint) return;
  // Overlay-flattened class (round 2 iteration 2): a root WITHOUT auto-layout
  // is a canvas-positioned frame — it cannot hug, so BOTH axes are drawn
  // fixed by construction and the bbox is the size witness. (Previously such
  // roots were skipped entirely; with their children now carried as absolute
  // overlays the root would collapse to 0×0 without its own box.)
  const withBox = merged.occ.filter((o) => o.node.bbox !== undefined);
  if (withBox.length === 0) return;
  if (withBox.length !== merged.occ.length) {
    ctx.notes.push(
      `${where}: root bbox captured on ${withBox.length}/${merged.occ.length} variant(s) only — fixed root size not proposed (partial evidence), review`,
    );
    return;
  }
  const fixedAxis = (o: Occ, dim: 'width' | 'height'): boolean => {
    const l = o.node.layout;
    if (!l) return true; // non-auto-layout root: fixed by construction (see above)
    // GRID: primary = horizontal (GP1b) — the same axis rule carryGridAxisSizing
    // reads. Reading a GRID root as a column put its HUG height on the FIXED
    // plane and minted the drawn 95px beside G8's `fit-content` — the double
    // spelling the emitter refuses by name (Phase 2 exam: Section Header /
    // Footer blocked the whole generate batch; grid-root-hug-height-fixed-conflict).
    const alongPrimary = l.mode === 'GRID' ? dim === 'width' : (l.mode === 'HORIZONTAL') === (dim === 'width');
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
    const fixedIn = withBox.filter((o) => fixedAxis(o, dim));
    if (rootTokens[dim] !== undefined || merged.occ.some((o) => o.node.bound?.[dim])) continue;
    // A FILL root (layoutSizingHorizontal/Vertical FILL — dump fillWidth /
    // fillHeight) is spelled FIXED by Figma's sizing MODE, but the drawn box
    // is the container's width, not a design value: minting it would pin a
    // fluid root (Phase 2 exam: the 1296px Section Header/Footer grid roots
    // fill their page column; max-width already carries the drawn cap).
    const fillField = dim === 'width' ? 'fillWidth' : 'fillHeight';
    if (withBox.every((o) => o.node[fillField] === true)) {
      ctx.notes.push(
        `${where}: root ${dim} is FILL in every variant (the sizing mode spells it FIXED; the drawn ${[...new Set(withBox.map((o) => o.node.bbox![dim]))].join('/')}px is the CONTAINER's measure) — fluid, NOT minted as a root ${dim}; the component fills its host${dim === 'width' && (rootTokens['max-width'] !== undefined || merged.occ.some((o) => typeof o.node.maxWidth === 'number')) ? ' up to the carried max-width' : ''}`,
      );
      continue;
    }
    // GAP-CLOSING ROUND 6 — A HUG AXIS IS A FACT, NOT A NUMBER.
    //
    // A hugging axis has no design-authored measure: its drawn box is a
    // MEASUREMENT OF THE DEFAULT CONTENT. Two carriage bugs came out of
    // treating it as a number (or as nothing at all), and both are the same
    // mistake with different blast radii:
    //
    //  · ALL-HUG (this branch) used to propose NOTHING, so the emitted root
    //    got the CSS default `auto`. `auto` is not HUG: as a flex child it
    //    CROSS-STRETCHES. The UUI Tooltip hugs on both axes, and inside
    //    ProgressBar's 8px-tall track its root stretched to 8px tall — the
    //    box-shadow that is the light bubble's ONLY edge drew a 112×8 sliver
    //    and no bubble appeared at all.
    //  · MIXED fixed/hug pinned the hug planes at their drawn box. The same
    //    Tooltip's hug plane pinned 112px, measured from "This is a
    //    tooltip"; the host overrides the text to "40%", so a 52px bubble
    //    sat in a 112px root.
    //
    // Both now carry `fit-content` — the exact CSS twin of Figma HUG, and
    // one the canvas leg reads BACK as HUG (emit-figma-script: a
    // fit-content width/height sets no fixedWidth/fixedHeight, which leaves
    // primary/counterAxisSizingMode at their AUTO default, and NEVER bakes a
    // NaN literal). The carriers differ because the FACTS differ: a uniform
    // hug is one literal, a mixed axis is a per-variant channel and rides
    // the mint's `size` kind (px on the fixed planes, the keyword on the hug
    // planes) so the whole channel keeps ONE spelling.
    if (fixedIn.length === 0) {
      const literals = (root.literals as Record<string, string> | undefined) ?? {};
      if (literals[dim] !== undefined) continue;
      // G8.2: fit-content on an fr-bearing grid axis is schema-invalid
      // (`grid-hug-flex-axis`). Silence is legal on that axis — the fraction
      // resolves against a host-supplied size. Do not write the hug and lose
      // the whole set (Figma DS Section Header / Footer).
      const grid = root.layout as { display?: string; columns?: unknown; rows?: unknown; flow?: string } | undefined;
      const hasFr = (tracks: unknown): boolean =>
        Array.isArray(tracks) && tracks.some((t) => t !== null && typeof t === 'object' && 'fr' in (t as object));
      const axisHasFr =
        grid?.display === 'grid' &&
        (dim === 'width'
          ? hasFr(grid.columns)
          : (grid.flow === 'row' && grid.rows === undefined) || hasFr(grid.rows));
      if (axisHasFr) {
        ctx.notes.push(
          `${where}: root ${dim} HUGS on a grid whose ${dim === 'width' ? 'columns' : 'rows'} contain {fr} — hug NOT carried (grid-hug-flex-axis); the fraction stands and the host supplies the definite size`,
        );
        continue;
      }
      literals[dim] = 'fit-content';
      root.literals = literals;
      ctx.notes.push(
        `${where}: root ${dim} HUGS in every variant — carried as the literal \`${dim}: fit-content\` (v16 grammar), the CSS twin of Figma HUG. The drawn ${[...new Set(withBox.map((o) => o.node.bbox![dim]))].join('/')}px is a measurement of the DEFAULT content, not a design value, so it is NOT minted; the emitted box is content-sized and no longer cross-stretches when this component is nested inside another`,
      );
      continue;
    }
    if (fixedIn.length !== withBox.length) {
      // MIXED FIXED/HUG axis (round 2 iteration 6 — UUI Tooltip: width drawn
      // FIXED 328/320 where Supporting text=True, HUG where False; the
      // supporting-text bubble rendered at container width). Every variant's
      // observed bbox carries on the FIXED planes — EXACT, the same rigid
      // spelling the all-FIXED case already ships (CBDS Dialog: minted root
      // `width`). Round 6: the HUG planes carry `fit-content` instead of the
      // pinned drawn box, so the channel states the sizing MODE it actually
      // observed on every plane. max-width is still NOT the spelling here:
      // the emitters' fluid discipline pairs it with a fit-content floor,
      // which a long single-line text raises past the cap and the drawn wrap
      // never happens. A mixed HEIGHT axis now carries too — the old refusal
      // ("a pinned hug height would clip when DOM text runs taller than the
      // canvas") was a refusal of the PIN, and `fit-content` is exactly the
      // spelling that cannot clip.
      mintObservation(
        ctx,
        rootTokens,
        where,
        dim,
        'size',
        withBox.map((o) => ({
          variant: o.variant,
          value: fixedAxis(o, dim) ? Math.round(o.node.bbox![dim] * 100) / 100 : 'fit-content',
        })),
      );
      ctx.notes.push(
        `${where}: root ${dim} is DRAWN FIXED in ${fixedIn.length}/${withBox.length} variants and HUG in the rest — minted as root ${dim} with the fixed planes' observed bbox and \`fit-content\` on the hug planes (the sizing MODE each plane actually draws; a pinned hug measure would freeze a box sized for the DEFAULT content and clip or float whatever a host puts in it)`,
      );
      continue;
    }
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

/** PHASE 2 EXAM (fill-unset-by-state): the literal an ABSENT fill on a
 *  non-TEXT node IS — `#00000000` — as a paint, so the state-diff channels
 *  read "no fill" as the drawn transparent box exactly as the base channel
 *  does (invertNodeTokens absentAs). A state override that "unsets" a fill
 *  is an override TO transparent; naming-and-dropping it cost the Button its
 *  whole hover plane AND (through UNBOUND) its base background. TEXT fills
 *  keep the undefined reading (an ink-less text node is a capture gap). */
const TRANSPARENT_FILL: { hex: string; alpha: number } = { hex: '000000', alpha: 0 };
const boxFillOf = (n: DumpNode): { var?: string; hex?: string; alpha?: number } | undefined =>
  n.type === 'TEXT' ? undefined : (n.fill ?? TRANSPARENT_FILL);

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
  kind: 'color' | 'px' | 'number' | 'shadow',
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
  /** v17 — the per-enum-value half of this (part, state) override. A state
   *  block holds ONE ref per channel, so a binding that is a FUNCTION of a
   *  variant axis had nowhere to go and was refused by name; it lands here and
   *  becomes `statesByProp`. Keyed prop → value → channel → ref. */
  byProp: StateByPropCollector;
}

/** v17: prop → value → (CSS channel → token ref), the shape both the root and
 *  the part collectors fill before `statesByProp` entries are built from it.
 *  Unlike tokensByProp there is no default-value elision: a state override has
 *  no per-state base to deviate FROM, so every observed value is carried. */
type StateByPropCollector = Record<string, Record<string, Record<string, string>>>;

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
   *  and the cross-state collector. A hoisted auto-label (sole TEXT `label`)
   *  has no part — its state ink rides root `states.<state>.color`. */
  rootParts?: Record<string, unknown>,
  keyByChildName?: Map<string, string>,
  partStates?: PartStateTarget[],
  /** v17 — the root's per-enum-value collector for THIS state. */
  rootByProp?: StateByPropCollector,
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
  nameStateGroupFacts(ctx, state, occs); // dump v1.31 — effect style/bindings, reactions, host overrides on the state plane

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
        // v17 — this used to be a flat refusal, and it cost Eventz's Button
        // its whole hover plane: the per-variant hover colours are UNRELATED
        // names (comp/button/primary/…/hover vs …/knockout-hover), so no
        // substituted ref can reach them and `states` holds one ref per
        // channel. They are carried as `statesByProp` now — every value, no
        // default elision, because a state override has no per-state base to
        // deviate from.
        if (rootByProp) {
          for (const [value, ref] of Object.entries(u.perValue.byValue)) {
            ((rootByProp[u.perValue.propName] ??= {})[value] ??= {})[cssProp] = ref;
          }
          ctx.notes.push(
            `${where} ${paintName} (state ${state}): bindings are a function of variant axis "${u.perValue.propName}" by VALUE (${Object.entries(u.perValue.byValue).map(([v, r]) => `${v}=${r}`).join(', ')}) — carried as statesByProp (v17; the token names do not spell the axis values, so neither a substituted ref nor a single state ref can carry them)`,
          );
        } else {
          ctx.notes.push(
            `${where} ${paintName} (state ${state}): bindings are a function of an enum axis by value and no statesByProp collector was supplied — NAMED, not proposed (review)`,
          );
        }
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
    // FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED: emit writes node.opacity as an
    // unbound 0–1 literal (unbind then write) so Disabled does not wash to
    // 0.5%. Minting a dump-slug remints a token the canvas refused to bind;
    // nearest-corpus match is also wrong (0.5 hits radius-lg). When this
    // set is a stamped pipeline contract whose authored disabled opacity
    // resolves to the drawn value, recover THAT ref.
    if (cssProp === 'opacity') {
      const values = occs.map((o) => value(o.node));
      const distinct = [...new Set(values)];
      if (distinct.length === 1) {
        const authoredRef = ctx.contractsById?.get(ctx.selfId)?.anatomy?.root?.states?.[state]?.opacity;
        if (typeof authoredRef === 'string' && authoredRef.startsWith('{') && authoredRef.endsWith('}')) {
          const path = authoredRef.slice(1, -1);
          if (!path.includes('{') && ctx.corpus.has(path)) {
            try {
              const resolved = Number(ctx.corpus.resolveLiteral(path));
              if (resolved === distinct[0]) {
                target[cssProp] = authoredRef;
                ctx.notes.push(
                  `${where} (state ${state}): unbound node opacity ${distinct[0]} recovers the stamped contract's ${authoredRef} (same resolved value), not a dump-slug mint (FC-DUMP-PROPOSE-DISABLED-OPACITY-MINTED)`,
                );
                return;
              }
            } catch {
              /* corpus miss — fall through to mint */
            }
          }
        }
      }
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

  paintChannel('background-color', 'fill', boxFillOf);
  paintChannel('border-color', 'stroke', (n) => n.stroke);
  numberChannel('border-width', 'strokeWeight', 'px', (n) => n.strokeWeight, 0, ['strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight']);
  numberChannel('border-radius', 'cornerRadius', 'px', (n) => n.cornerRadius, 0, ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']);
  numberChannel('opacity', 'opacity', 'number', (n) => n.opacity, 1, ['opacity']);

  // State-only DROP_SHADOW (FC-DUMP-PROPOSE-STATE-SHADOW). invertNodeEffects
  // requires the stack in EVERY variant and named the default-bare /
  // Active-drawn split. Default having no effects is the base plane; the
  // stack is a state override, same as hover fill. Canvas did not bind a
  // variable — mint the observed CSS stack, never invent a corpus name.
  {
    const stackOf = (n: DumpNode): string | undefined => {
      const eff = n.effects ?? [];
      if (eff.length === 0) return undefined;
      if (!eff.every((e) => e.type === 'DROP_SHADOW')) return undefined;
      return eff.map(shadowCss).join(', ');
    };
    if (occs.some((o) => stackOf(o.node) !== stackOf(o.base))) {
      const stacks = occs.map((o) => ({ variant: o.variant, value: stackOf(o.node) }));
      if (stacks.some((s) => s.value === undefined)) {
        ctx.notes.push(
          `${where}: effects differ in state "${state}" but are absent or mixed-kind in some of its variant(s) — a state override cannot unset a channel; NAMED, not proposed (review)`,
        );
      } else {
        reportUnbound(ctx, `${where} (state ${state})`, 'effects', stacks[0].value!);
        const authoredStateShadow =
          ctx.contractsById?.get(ctx.selfId)?.anatomy?.root?.states?.[state]?.['box-shadow'];
        if (
          !recoverAuthoredBoxShadow(
            ctx,
            target,
            `${where} (state ${state})`,
            authoredStateShadow,
            stacks.map((s) => ({ variant: s.variant, value: s.value! })),
          )
        ) {
          mintStateObservation(
            ctx, target, state, 'box-shadow', 'shadow',
            stacks.map((s) => ({ variant: s.variant, value: s.value! })),
            `${where} (state ${state})|effects`,
          );
        }
        if (!ctx.mint) {
          ctx.notes.push(
            `${where}: DROP_SHADOW stack changes in state "${state}" — a literal state override needs minting (mintUnbound); NAMED, not proposed`,
          );
        }
      }
    }
  }

  // Bound stroke-weight state inversion (FC-DUMP-PROPOSE-FOCUS-OUTLINE).
  // numberChannel bails when any bound field is present, and it also no-ops
  // when the LITERAL strokeWeight is 0 on both sides — Flowbite Button Focus
  // Visible stamps outline-width on all four sides while the default cell
  // stamps border-*-width. Without this door the width token never lands.
  {
    const weightFields = ['strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'] as const;
    const boundChanged = occs.some((o) =>
      weightFields.some((f) => (o.node.bound?.[f] ?? '') !== (o.base.bound?.[f] ?? '')),
    );
    const uniformPath = (n: DumpNode): string | undefined => {
      const b = n.bound ?? {};
      if (b.strokeWeight) return dotPath(b.strokeWeight);
      const sides = [b.strokeTopWeight, b.strokeRightWeight, b.strokeBottomWeight, b.strokeLeftWeight];
      if (sides.every((s) => s && s === sides[0])) return dotPath(sides[0]!);
      return undefined;
    };
    if (boundChanged) {
      const paths = occs.map((o) => ({ variant: o.variant, path: uniformPath(o.node) }));
      if (paths.some((p) => p.path === undefined)) {
        ctx.notes.push(
          `${where}: stroke weight bindings differ in state "${state}" but are not one uniform width per variant — NAMED, not proposed (review)`,
        );
      } else {
        const u = unifyRefs(paths, ctx.axes);
        if (u.kind === 'ref') {
          if (u.ref !== baseRootTokens['border-width'] && u.ref !== baseRootTokens['outline-width']) {
            target['border-width'] = u.ref;
          }
        } else if (u.kind === 'per-value' && rootByProp) {
          for (const [value, ref] of Object.entries(u.perValue.byValue)) {
            ((rootByProp[u.perValue.propName] ??= {})[value] ??= {})['border-width'] = ref;
          }
        } else if (u.kind === 'drift') {
          ctx.notes.push(`${where} strokeWeight (state ${state}): ${u.detail}`);
        }
      }
    }
  }

  // A state-only border cannot render honestly outside focus-visible: the
  // base element draws `border: 0` (no border-style to inherit). The
  // focus-visible pair remaps to the outline vocabulary the generators
  // already ship (outline-style/offset ride the focus boilerplate).
  //
  // An OUTSIDE stroke on focus-visible is the same outline even when the
  // base already has an INSIDE border (Flowbite Button). The old guard
  // required "base has no border" and left outline-color on border-color
  // and dropped outline-width (FC-DUMP-PROPOSE-FOCUS-OUTLINE).
  const focusOutside =
    state === 'focus-visible' && occs.every((o) => o.node.strokeAlign === 'OUTSIDE');
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
  } else if (focusOutside) {
    for (const [from, to] of [['border-color', 'outline-color'], ['border-width', 'outline-width']] as const) {
      if (target[from] !== undefined) {
        target[to] = target[from];
        delete target[from];
      }
    }
    remapStateMintTargets(ctx, target, state);
    ctx.notes.push(
      `${where}: state "${state}" draws an OUTSIDE stroke beside a resting border — proposed as the focus OUTLINE pair (outline-color/outline-width)`,
    );
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
  /** Resolve a drawn child (by name) to its built anatomy part + path key.
   *  Depth-1 children go through the drawn-name → key map; when that misses
   *  (a wrapper-union fold nested it) and for deeper descendants, walk the
   *  anatomy for a UNIQUELY named part. */
  const resolveChildPart = (
    childName: string,
    depth: number,
  ): { partRec?: Record<string, unknown>; resolvedKey?: string } => {
    const key = depth === 1 ? keyByChildName?.get(childName) : undefined;
    let partRec = key !== undefined && rootParts ? (rootParts[key] as Record<string, unknown> | undefined) : undefined;
    // THE FLAT MAP CANNOT SPELL A NESTED PART, and that is the whole defect.
    // `keyByChildName` is Map<drawnName, depth1Key>, built from the POST-FOLD
    // anatomy; this loop reads the PRE-FOLD dump. When foldWrapperUnion
    // synthesizes a wrapper — Untitled UI's dropdown-list-item draws `Text`
    // flat in 16 of 24 variants and nested under a real `Content` frame in
    // the other 8, so the union folds it to `Content.parts.Text` — the lookup
    // misses and the state override is never proposed. The sibling
    // `Shortcut` survives only because it is genuinely depth-1 on both sides.
    //
    // Measured: the disabled render was BYTE-IDENTICAL to default (same sha1)
    // while the dump carried the fact exactly (fill 404040 → e5e5e5).
    //
    // Resolve by walking the anatomy for a UNIQUELY named part. Uniqueness is
    // the safety condition: two parts sharing a name would make the match a
    // guess, and a wrong state override is worse than a named refusal, so an
    // ambiguous name falls through to the refusal below.
    let resolvedKey = key;
    if (!partRec && rootParts) {
      const hits: Array<{ rec: Record<string, unknown>; path: string }> = [];
      const findNamed = (parts: Record<string, unknown> | undefined, trail: string[]): void => {
        for (const [k, v] of Object.entries(parts ?? {})) {
          const rec = v as Record<string, unknown>;
          if (k === childName) hits.push({ rec, path: [...trail, k].join('/') });
          findNamed(rec?.parts as Record<string, unknown> | undefined, [...trail, k]);
        }
      };
      findNamed(rootParts as Record<string, unknown>, []);
      if (hits.length === 1) {
        partRec = hits[0].rec;
        // The PATH, not just the record — `mintStateObservation` names the
        // minted token `<partKey>-state-<state>`, and an undefined partKey
        // falls back to the ROOT spelling `state-<state>`. Passing the record
        // without its path carried the fact and then minted it under a name
        // that collides with the root's own state tokens: the first pass of
        // this fix produced `imported.dropdown-list-item.state-disabled.color`
        // beside the correctly-named `shortcut-state-disabled`. Depth has to
        // travel with the record.
        resolvedKey = hits[0].path;
      }
    }
    return { partRec, resolvedKey };
  };
  for (const [childName, childOccs] of childOccByName) {
    type Pick = (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined;
    const channels: Array<{ cssProp: string; paintName: string; pick: Pick }> =
      childOccs.every((x) => x.node.type === 'TEXT')
        ? [{ cssProp: 'color', paintName: 'fill', pick: (n) => n.fill }]
        : [
            { cssProp: 'background-color', paintName: 'fill', pick: boxFillOf },
            { cssProp: 'border-color', paintName: 'stroke', pick: (n) => n.stroke },
          ];
    for (const ch of channels) {
      if (!childOccs.some((x) => paintKey(ch.pick(x.node)) !== paintKey(ch.pick(x.base)))) continue;
      const at = `${where}/${childName}`;
      const { partRec, resolvedKey } = resolveChildPart(childName, 1);
      if (!partRec || !partStates) {
        // Generator hoist: the sole root TEXT named `label` is not a part —
        // its tokens already live on the root (`color`). State-varying ink
        // must ride `states.<state>.color` the same way; naming-and-dropping
        // it was FC-DUMP-PROPOSE-STATE-TEXT (Flowbite Button hover/active).
        const hoistedInk =
          childName === 'label' &&
          ch.cssProp === 'color' &&
          childOccs.every((x) => x.node.type === 'TEXT') &&
          baseRootTokens['color'] !== undefined;
        if (hoistedInk) {
          const paints = childOccs.map((x) => ({ variant: x.variant, paint: ch.pick(x.node) }));
          if (paints.some((p) => p.paint === undefined)) {
            ctx.notes.push(
              `${at}: ${ch.paintName} differs in state "${state}" on the hoisted children label but is absent in some variant(s) — a state override cannot unset a channel; NAMED, not proposed (review)`,
            );
            continue;
          }
          if (paints.every((p) => p.paint!.var !== undefined)) {
            const u = unifyRefs(
              paints.map((p) => ({ variant: p.variant, path: dotPath(p.paint!.var!) })),
              ctx.axes,
            );
            if (u.kind === 'ref') {
              if (u.ref !== baseRootTokens['color']) target[ch.cssProp] = u.ref;
              ctx.notes.push(
                `${at}: hoisted children label ${ch.paintName} in state "${state}" rides root states.${state}.color (${u.ref})`,
              );
            } else if (u.kind === 'per-value' && rootByProp) {
              for (const [value, ref] of Object.entries(u.perValue.byValue)) {
                ((rootByProp[u.perValue.propName] ??= {})[value] ??= {})[ch.cssProp] = ref;
              }
              ctx.notes.push(
                `${at} ${ch.paintName} (state ${state}): hoisted children label bindings are a function of variant axis "${u.perValue.propName}" by VALUE — carried as root statesByProp (FC-DUMP-PROPOSE-STATE-TEXT)`,
              );
            } else if (u.kind === 'drift') {
              ctx.notes.push(`${at} ${ch.paintName} (state ${state}): ${u.detail}`);
            } else {
              ctx.notes.push(
                `${at}: ${ch.paintName} differs in state "${state}" on the hoisted children label — NAMED, not proposed (review)`,
              );
            }
            continue;
          }
          if (paints.every((p) => p.paint!.hex !== undefined)) {
            reportUnbound(ctx, `${at} (state ${state})`, ch.paintName, paintCssHex(paints[0].paint!));
            mintStateObservation(
              ctx, target, state, ch.cssProp, 'color',
              paints.map((p) => ({ variant: p.variant, value: paintCssHex(p.paint!) })),
              `${at} (state ${state})|${ch.paintName}`,
            );
            ctx.notes.push(
              `${at}: hoisted children label ${ch.paintName} in state "${state}" rides root states.${state}.color (minted literal)`,
            );
            continue;
          }
        }
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
        rec = { part: partRec, state, target: {}, byProp: {} };
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
          // v17 — the part-level twin of the root carry above.
          for (const [value, ref] of Object.entries(u.perValue.byValue)) {
            ((rec.byProp[u.perValue.propName] ??= {})[value] ??= {})[ch.cssProp] = ref;
          }
          ctx.notes.push(
            `${at} ${ch.paintName} (state ${state}): bindings are a function of variant axis "${u.perValue.propName}" by VALUE (${Object.entries(u.perValue.byValue).map(([v, r]) => `${v}=${r}`).join(', ')}) — carried as statesByProp (v17)`,
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
          resolvedKey,
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

  // FC-DUMP-PROPOSE-PART-STATE-CHANNELS — everything ELSE a drawn descendant
  // changes in this state. The color-kind loop above carried fill/stroke at
  // depth 1 and nothing else: a Hover-only DROP_SHADOW on an icon FRAME (the
  // merged part is built from DEFAULT-state variants, so invertNodeEffects
  // returned at its first line) proposed with ZERO notes at verified-exact —
  // a silent loss. Each channel below either CARRIES as a part-level state
  // override (box-shadow / border-width / border-radius / opacity —
  // PART_STATE_CHANNELS grew to match; bound refs unify, raw values mint) or
  // is NAMED per part+state+channel where the vocabulary stops (TEXT
  // effects/stroke/type facts, visibility, geometry, layout). Depth ≥ 2
  // descendants resolve by unique part name, color-kind channels included.
  {
    type DescOcc = { variant: string; node: DumpNode; base: DumpNode };
    const descByPath = new Map<string, { depth: number; occs: DescOcc[] }>();
    const collect = (pairs: DescOcc[], prefix: string, depth: number): void => {
      const byName = new Map<string, DescOcc[]>();
      for (const o of pairs) {
        for (const c of o.node.children ?? []) {
          const bc = (o.base.children ?? []).find((x) => x.name === c.name);
          if (!bc) continue;
          const list = byName.get(c.name) ?? [];
          list.push({ variant: o.variant, node: c, base: bc });
          byName.set(c.name, list);
        }
      }
      for (const [name, list] of byName) {
        const p = prefix ? `${prefix}/${name}` : name;
        descByPath.set(p, { depth, occs: list });
        collect(list, p, depth + 1);
      }
    };
    collect(occs.map((o) => ({ variant: o.variant, node: o.node, base: o.base })), '', 1);

    type Obs = { variant: string; ref?: string; value?: string | number };
    const stackOf = (n: DumpNode): string | undefined => {
      const eff = n.effects ?? [];
      if (eff.length === 0) return undefined;
      if (!eff.every((e) => e.type === 'DROP_SHADOW')) return undefined;
      return eff.map(shadowCss).join(', ');
    };
    const effectKinds = (n: DumpNode): string => (n.effects ?? []).map((e) => e.type).join('+') || 'none';
    const uniformBound = (n: DumpNode, fields: string[]): string | undefined => {
      const b = n.bound ?? {};
      const vals = fields.map((f) => b[f]);
      if (vals.every((v) => v === undefined)) return undefined;
      if (vals.every((v) => v !== undefined && v === vals[0])) return dotPath(vals[0]!);
      if (vals[0] !== undefined && vals.slice(1).every((v) => v === undefined)) return dotPath(vals[0]);
      return 'mixed';
    };

    for (const [path, { depth, occs: d }] of descByPath) {
      const childName = path.split('/').pop()!;
      const at = `${where}/${path}`;
      const isText = d.every((x) => x.node.type === 'TEXT');
      const differs = (pick: (n: DumpNode) => unknown): boolean =>
        d.some((x) => JSON.stringify(pick(x.node) ?? null) !== JSON.stringify(pick(x.base) ?? null));
      const nameOnly = (channel: string, why: string): void => {
        ctx.notes.push(`${at}: ${channel} differs in state "${state}" — ${why}; NAMED, not proposed (review)`);
      };
      let resolved: { partRec?: Record<string, unknown>; resolvedKey?: string } | undefined;
      const holder = (): { rec: PartStateTarget; key?: string; part: Record<string, unknown> } | 'none' | 'ref' => {
        resolved ??= resolveChildPart(childName, depth);
        if (!resolved.partRec || !partStates) return 'none';
        const pr = resolved.partRec;
        if (pr.component !== undefined || pr.slot !== undefined || pr.repeat !== undefined) return 'ref';
        let rec = partStates.find((r) => r.part === pr && r.state === state);
        if (!rec) {
          rec = { part: pr, state, target: {}, byProp: {} };
          partStates.push(rec);
        }
        return { rec, key: resolved.resolvedKey, part: pr };
      };
      const carry = (
        cssProp: string,
        fieldName: string,
        kind: 'color' | 'px' | 'number' | 'shadow',
        obs: Obs[],
      ): void => {
        const h = holder();
        if (h === 'none') {
          nameOnly(fieldName, 'no anatomy part maps to this drawn child (or its name is not unique in the anatomy)');
          return;
        }
        if (h === 'ref') {
          nameOnly(fieldName, 'the child contract owns its styling on a component-ref/slot/repeat part');
          return;
        }
        const baseTokens = (h.part.tokens ?? {}) as Record<string, string>;
        // The base plane is read from the DUMP (unbound base paints mint
        // AFTER this pass, so part.tokens is not yet the base truth).
        if (
          cssProp === 'border-width' &&
          !d.every((x) => x.base.stroke !== undefined && (x.base.strokeWeight ?? 0) > 0)
        ) {
          nameOnly(fieldName, 'the part draws no border in the base plane (border: 0, no border-style for a state override to widen)');
          return;
        }
        if (obs.every((o) => o.ref !== undefined)) {
          const u = unifyRefs(obs.map((o) => ({ variant: o.variant, path: o.ref })), ctx.axes);
          if (u.kind === 'ref') {
            if (u.ref !== baseTokens[cssProp]) h.rec.target[cssProp] = u.ref;
          } else if (u.kind === 'per-value') {
            for (const [value, ref] of Object.entries(u.perValue.byValue)) {
              ((h.rec.byProp[u.perValue.propName] ??= {})[value] ??= {})[cssProp] = ref;
            }
            ctx.notes.push(
              `${at} ${fieldName} (state ${state}): bindings are a function of variant axis "${u.perValue.propName}" by VALUE — carried as part statesByProp (FC-DUMP-PROPOSE-PART-STATE-CHANNELS)`,
            );
          } else if (u.kind === 'drift') {
            ctx.notes.push(`${at} ${fieldName} (state ${state}): ${u.detail}`);
          }
          return;
        }
        if (obs.every((o) => o.value !== undefined)) {
          reportUnbound(ctx, `${at} (state ${state})`, fieldName, obs[0].value!);
          const drawn = obs.map((o) => ({ variant: o.variant, value: o.value! }));
          if (cssProp === 'box-shadow') {
            const authored = authoredPartAt(ctx, h.key ?? '')?.states?.[state]?.['box-shadow'];
            if (
              recoverAuthoredBoxShadow(
                ctx,
                h.rec.target,
                `${at} (state ${state})`,
                authored,
                drawn.map((r) => ({ variant: r.variant, value: String(r.value) })),
              )
            ) {
              return;
            }
          }
          mintStateObservation(ctx, h.rec.target, state, cssProp, kind, drawn, `${at} (state ${state})|${fieldName}`, h.key);
          if (!ctx.mint) {
            ctx.notes.push(
              `${at}: ${fieldName} changes in state "${state}" — a literal part-state override needs minting (mintUnbound); NAMED, not proposed`,
            );
          }
          return;
        }
        nameOnly(fieldName, 'mixes bound and raw values across variants');
      };
      const paintObs = (pick: (n: DumpNode) => { var?: string; hex?: string; alpha?: number } | undefined): Obs[] | null => {
        const paints = d.map((x) => ({ variant: x.variant, paint: pick(x.node) }));
        if (paints.some((p) => p.paint === undefined)) return null;
        return paints.map((p) => ({
          variant: p.variant,
          ...(p.paint!.var !== undefined ? { ref: dotPath(p.paint!.var) } : {}),
          ...(p.paint!.var === undefined && p.paint!.hex !== undefined ? { value: paintCssHex(p.paint!) } : {}),
        }));
      };
      const numberObs = (
        pick: (n: DumpNode) => number | undefined,
        fallback: number,
        boundFields: string[],
      ): Obs[] | 'mixed' => {
        const out: Obs[] = [];
        for (const x of d) {
          const ref = uniformBound(x.node, boundFields);
          if (ref === 'mixed') return 'mixed';
          out.push(ref !== undefined ? { variant: x.variant, ref } : { variant: x.variant, value: pick(x.node) ?? fallback });
        }
        return out;
      };

      // Color-kind channels at depth ≥ 2 (depth 1 is the loop above).
      if (depth >= 2) {
        const paintChannels = isText
          ? [{ cssProp: 'color', fieldName: 'fill', pick: (n: DumpNode) => n.fill }]
          : [
              { cssProp: 'background-color', fieldName: 'fill', pick: boxFillOf },
              { cssProp: 'border-color', fieldName: 'stroke', pick: (n: DumpNode) => n.stroke },
            ];
        for (const ch of paintChannels) {
          if (!d.some((x) => paintKey(ch.pick(x.node)) !== paintKey(ch.pick(x.base)))) continue;
          const obs = paintObs(ch.pick);
          if (obs === null) nameOnly(ch.fieldName, 'absent in some of its variant(s) — a state override cannot unset a channel');
          else carry(ch.cssProp, ch.fieldName, 'color', obs);
        }
      }
      // Node opacity — any node type.
      if (differs((n) => n.opacity ?? 1) || differs((n) => n.bound?.opacity)) {
        const obs = numberObs((n) => n.opacity, 1, ['opacity']);
        if (obs === 'mixed') nameOnly('opacity', 'mixed bound sides');
        else carry('opacity', 'opacity', 'number', obs);
      }
      if (isText) {
        // TEXT: no text-shadow / text-stroke / per-state type vocabulary.
        if (differs((n) => n.effects ?? [])) nameOnly('effects', `TEXT effects (${[...new Set(d.map((x) => effectKinds(x.node)))].join(', ')}) have no text-shadow vocabulary`);
        if (differs((n) => n.stroke) || differs((n) => n.strokeWeight)) nameOnly('stroke', 'a TEXT stroke has no contract vocabulary');
        for (const field of ['characters', 'fontSize', 'fontStyle', 'lineHeight', 'textCase', 'style', 'fontSizeVar', 'fontWeightVar', 'lineHeightVar'] as const) {
          if (differs((n) => n.text?.[field])) nameOnly(`text.${field}`, 'part-level states carry color-kind, shadow, border and opacity channels only (no per-state type vocabulary)');
        }
      } else {
        // Effects → box-shadow (DROP_SHADOW-only stacks; the root's own rule).
        if (d.some((x) => stackOf(x.node) !== stackOf(x.base) || effectKinds(x.node) !== effectKinds(x.base))) {
          if (d.some((x) => stackOf(x.node) === undefined)) {
            nameOnly('effects', `absent or not a pure DROP_SHADOW stack (${[...new Set(d.map((x) => effectKinds(x.node)))].join(', ')}) in some of its variant(s) — a state override cannot unset a channel and only DROP_SHADOW layers map to box-shadow`);
          } else {
            carry('box-shadow', 'effects', 'shadow', d.map((x) => ({ variant: x.variant, value: stackOf(x.node)! })));
          }
        }
        const weightFields = ['strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'];
        if (differs((n) => n.strokeWeight ?? 0) || differs((n) => weightFields.map((f) => n.bound?.[f]))) {
          const obs = numberObs((n) => n.strokeWeight, 0, weightFields);
          if (obs === 'mixed') nameOnly('strokeWeight', 'per-side stroke weight bindings are not one uniform width');
          else carry('border-width', 'strokeWeight', 'px', obs);
        }
        const radiusFields = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
        if (differs((n) => n.cornerRadius ?? 0) || differs((n) => radiusFields.map((f) => n.bound?.[f]))) {
          const obs = numberObs((n) => n.cornerRadius, 0, radiusFields);
          if (obs === 'mixed') nameOnly('cornerRadius', 'per-corner radius bindings are not one uniform radius');
          else carry('border-radius', 'cornerRadius', 'px', obs);
        }
      }
      // Facts with no per-state vocabulary at all — named so nothing is silent.
      if (differs((n) => n.hidden === true)) nameOnly('visibility (hidden)', 'per-state visibility has no contract vocabulary');
      const geo = (n: DumpNode) => {
        const g = n as { width?: number; height?: number };
        return [g.width, g.height, n.fixedSize, n.abs];
      };
      if (differs(geo)) nameOnly('geometry (width/height/abs)', 'per-state geometry has no contract vocabulary');
      if (differs((n) => n.layout)) nameOnly('layout', 'per-state auto-layout has no contract vocabulary');
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

/** Drop every applied componentProperties value that is not a string or a
 *  boolean (the carriable grammar — extract/figma/types.ts DumpNode) from a
 *  PRIVATE clone of the set, one receipt per (variant, node, property). The
 *  only producer of such values today is the REST mapper copying a
 *  SLOT-typed value through as `{ guid }`. Sets without one are returned
 *  as-is (same object, zero receipts — byte-identical). */
function stripNonScalarAppliedProps(set: DumpSet, receipts: string[]): DumpSet {
  const offenders: Array<{ variant: string; path: string; node: DumpNode; keys: string[] }> = [];
  const scan = (n: DumpNode, variant: string, path: string): void => {
    const bad = Object.entries(n.componentProperties ?? {})
      .filter(([, v]) => typeof v !== 'string' && typeof v !== 'boolean')
      .map(([k]) => k);
    if (bad.length > 0) offenders.push({ variant, path, node: n, keys: bad });
    for (const c of n.children ?? []) scan(c, variant, `${path}/${c.name}`);
  };
  for (const v of set.variants) scan(v, v.name, `${set.setName}:${v.name}`);
  if (offenders.length === 0) return set;
  const clone = JSON.parse(JSON.stringify(set)) as DumpSet;
  const strip = (n: DumpNode): void => {
    if (n.componentProperties) {
      for (const [k, v] of Object.entries(n.componentProperties)) {
        if (typeof v !== 'string' && typeof v !== 'boolean') delete n.componentProperties[k];
      }
      if (Object.keys(n.componentProperties).length === 0) delete n.componentProperties;
    }
    for (const c of n.children ?? []) strip(c);
  };
  for (const v of clone.variants) strip(v);
  for (const o of offenders) {
    for (const key of o.keys) {
      const raw = (o.node.componentProperties as Record<string, unknown>)[key];
      const kind = raw !== null && typeof raw === 'object' && 'guid' in (raw as object) ? 'a SLOT-typed value ({guid} — a slot-content node reference)' : `a non-scalar value (${JSON.stringify(raw)})`;
      receipts.push(
        `${o.path}: applied prop "${key.split('#')[0]}" on nested "${o.node.instanceOf ?? o.node.name}" is ${kind}, not a prop value the contract grammar holds — dropped BY NAME (the slot's drawn content is the child component's own; this value used to refuse the whole set at the contract schema — Phase 2 exam, Card Grid)`,
      );
    }
  }
  return clone;
}

export function proposeFromDump(
  set: DumpSet,
  opts: {
    corpus: TokenCorpus;
    contractIdByName: Map<string, string>;
    contractsById?: Map<string, MinimalChildContract>;
    /** componentSetKey (or setless component key) → contract id (dump v1.5)
     *  — the SESSION-LINKING index, checked BEFORE the name lookup; build it
     *  from every in-scope contract's bindings.figma.anchors.componentSetKey
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
    /** ITERATION 8 — stub glyph carriage: instanceKey → exported SVG asset
     *  (assets/icons/<asset>.svg, exported at 1x from the stub source's MAIN
     *  component; the caller loads the export manifest). When every observed
     *  occurrence of a stub maps here, the stub's root carries an icon part
     *  rendering the REAL vector glyph instead of witness geometry. Absent →
     *  the classic geometry-stub behavior, byte-identical. */
    iconAssets?: ReadonlyMap<string, StubIconAsset>;
    /** ROUND 2 ITERATION 9 — per-instance overrides: the accumulated
     *  minted-value ledger from EARLIER proposals in this session (leaf
     *  dot-path → resolved literal, e.g. "imported.avatar.root.width.xs" →
     *  "24px"; build it from each proposal's mintedTokens tree). Presence
     *  opts the machinery in: child roots declare `overridable` channels,
     *  and a component ref whose OBSERVED per-occurrence facts (imageFill /
     *  bbox / instancePrimaryFill) PROVABLY diverge from the linked child's
     *  own values carries `component.overrides` minted from those
     *  observations. Absent (every existing caller) — byte-identical
     *  classic behavior; unprovable divergences stay named notes. */
    instanceOverrides?: ReadonlyMap<string, string>;
    /** ROUND 3 — instance TEXT overrides (dump v1.10 `textOverrides`), the
     *  CHILD half. Cross-set demand built ONCE over every dump in scope with
     *  textOverrideDemandFromDumps: child set key / name → the node paths
     *  hosts were observed overriding. A demanded node in THIS set stops
     *  being a literal and becomes a text prop the hosts can set (see
     *  resolveTextOverrideDemand). Absent — byte-identical classic
     *  behavior. The HOST half needs no option: an instance's own
     *  `textOverrides` plus the linked child's props are enough. */
    textOverrideDemand?: TextOverrideDemand;
    /** Contract ids claimed by THIS session's earlier imports — real
     *  contracts AND their child stubs (live-gauntlet class ③). When the
     *  name-derived self id lands on one of these whose componentSetKey
     *  CONTRADICTS this set's key (both non-null), the proposal takes a
     *  deterministic numeric suffix (arrival order) and the collision is
     *  NAMED — the stubIdFor contradicting-key discipline applied at
     *  proposal-registration time. Same-key holders keep the base id (the
     *  legitimate re-import / stub-heal path). Repo contracts NEVER join
     *  this set: a repo-name landing stays the workspace re-import rule. */
    sessionClaimedIds?: ReadonlySet<string>;
    /** Exact (default) requires structured source evidence and proves the
     *  proposed contract emits the identical variant tuple set. The explicit
     *  reviewable mode preserves legacy name-based inversion while still
     *  refusing any structured evidence that is invalid or ragged. */
    projectionMode?: 'exact' | 'reviewable-inversion';
  },
): FigmaProposalResult {
  const projectionMode = opts.projectionMode ?? 'exact';
  // PHASE 2 EXAM (rest-instance-slot-prop-value): a nested instance's
  // SLOT-typed property value arrives from the REST route as the API's own
  // `{ guid: … }` OBJECT — a slot-content node reference, not a prop value.
  // It used to ride componentProperties into the component ref and crash
  // the whole set on ContractSchema ("Unrecognized key: guid" — Card Grid in
  // exact mode). Stripped here, on a private clone, BY NAME per node.
  const slotValueReceipts: string[] = [];
  set = stripNonScalarAppliedProps(set, slotValueReceipts);
  const sourceProjection = validateExactVariantProjection(set);
  /** The emitter's DECLARED sparse State matrix, carried by the dump (v1.21).
   *  Present only for sets this pipeline drew with bindings.figma.statePreviews on, and
   *  only trusted where it agrees with the axes — see
   *  core/exact-projection.ts. It is what makes promoting the State axis an
   *  inversion of a declared rule instead of a guess about someone's API. */
  const declaredSparseAxis = readDeclaredStatePreviewAxis(set);
  // Exact mode fails closed on unstructured/ragged variant matrices.
  // Reviewable-inversion may continue without structured definitions
  // (legacy name-based path) — but MUST still refuse when structured
  // evidence is present and invalid/ragged (never invent a matrix).
  if (projectionMode === 'exact') {
    assertExactProjection(sourceProjection, 'source-matrix-verified');
  } else if (
    sourceProjection.status === 'refused' &&
    sourceProjection.code !== 'EXACT_DEFINITIONS_MISSING'
  ) {
    assertExactProjection(sourceProjection, 'source-matrix-verified');
  }

  const prefix = opts.prefix ?? 'ds';
  const preNotes: string[] = [...slotValueReceipts];

  // dump v1.16 — U+2024 fold receipts, ONE per distinct variable per set:
  // every binding site below spells refs through dotPath, which folds ONE DOT
  // LEADER to '-' (see captured-tokens.ts foldVariablePath). The fold is a
  // RENAME relative to the canvas variable, so it is named up front rather
  // than at each of its binding sites (Eventz: "spacing/1․5" binds 16 times).
  {
    const foldedNames = new Set<string>();
    const scanNode = (n: DumpNode): void => {
      const names = [
        ...Object.values(n.bound ?? {}),
        n.fill?.var,
        n.stroke?.var,
        n.text?.fillVar,
        n.instancePrimaryFill?.var,
        ...(n.gradient?.stops.map((s) => s.var) ?? []),
      ];
      for (const name of names) if (name !== undefined && name.includes(ONE_DOT_LEADER)) foldedNames.add(name);
      for (const c of n.children ?? []) scanNode(c);
    };
    for (const v of set.variants) scanNode(v);
    for (const name of [...foldedNames].sort()) {
      preNotes.push(
        `variable name "${name}" contains U+2024 ONE DOT LEADER — folded to '-' and carried as {${foldVariablePath(name).path}} everywhere it binds (dump v1.16 fold rule; a RENAME relative to the canvas variable, which keeps its own spelling): rename the variable to match, or remap manually. A fold target another variable already owns refuses registration at the captured-token layer by name`,
      );
    }
  }

  // Theme/mode-axis promotion (§3 — see the section doc above): runs FIRST,
  // over the full drawn set. A corroborated mode axis is excluded from the
  // API; the whole pipeline (state promotion included) then runs on the
  // DEFAULT mode's variants only — the other modes never feed anatomy,
  // facts, or the mint pass (their resolved literals are receipts, not a
  // second palette).
  const modePromo = detectModeAxis(applyDeclaredAxisDefaults(parseAxes(set.variants.map((v) => v.name)), set), set.variants, set.setName, preNotes);
  if (projectionMode === 'exact' && modePromo) {
    semanticProjectionRefusal(sourceProjection, modePromo.axis, 'token-mode');
  }
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
  let statePromo = detectStateAxis(applyDeclaredAxisDefaults(parseAxes(sourceVariants.map((v) => v.name)), set), preNotes);
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
      // Exact normally refuses to promote a variant axis to interaction-state
      // semantics: it cannot tell a generator-emitted preview axis from a real
      // API enum, and guessing changes the authoritative projection. When the
      // SET declares this axis as its state-preview axis, that ambiguity is
      // gone — the promotion is reading back a rule this pipeline wrote, and
      // the returned rows are re-checked against the declared matrix below.
      // An absent, malformed, or disagreeing marker leaves the refusal armed.
      const declaredThisAxis =
        declaredSparseAxis !== null && declaredSparseAxis.axis === promo.axis.property;
      if (projectionMode === 'exact' && !declaredThisAxis) {
        semanticProjectionRefusal(sourceProjection, promo.axis, 'interaction-state');
      }
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
      const previewDisabled =
        declaredThisAxis &&
        promo.disabledValue !== undefined &&
        declaredSparseAxis!.states.some((s) => normStateValue(s) === 'disabled');
      preNotes.push(
        `variant axis "${promo.axis.property}" (${promo.axis.values.join('|')}) IS the platform's interaction states, not API — promoted: the axis is NOT a prop; anatomy and base facts come from the ${baseVariants.length} default-state variant(s); ${promo.promoted
          .map((p) => `${p.value}→${p.state}`)
          .join(', ')} propose root state overrides${
          promo.disabledValue !== undefined
            ? previewDisabled
              ? `; ${promo.disabledValue}→ disabled state block (State=Disabled is a preview cell this pipeline drew, not a Disabled BOOLEAN)`
              : `; ${promo.disabledValue}→ a \`disabled\` BOOLEAN prop + disabled state block`
            : ''
        }`,
      );
    }
  }

  const variantNames = (baseVariants ?? sourceVariants).map((v) => v.name);
  const axes = applyDeclaredAxisDefaults(parseAxes(variantNames), set, preNotes);
  const enumAxes = axes.filter((a) => !isBoolAxis(a.values));

  // Self contract id — the STAMPED id outranks the name-derived slug
  // (FC-DUMP-PROPOSE-CONTRACT-ID-DROPPED). A set this pipeline drew already
  // carries `ds_contracts/contractId`; slugging "Alert (flowbite.alert)"
  // invented `ds.alert-flowbite-alert`. Unstamped / malformed stamps keep
  // the classic name-derived id, so a set this pipeline did not draw is
  // unchanged. Suffixed past SESSION-claimed holders with contradicting
  // key evidence (class ③). Resolved BEFORE part construction so
  // stubIdFor's self-guard protects the id actually claimed.
  const stampedContractId = readStampedContractId(set);
  const rawStampedContractId =
    typeof (set as { contractId?: unknown }).contractId === 'string'
      ? ((set as { contractId: string }).contractId).trim()
      : '';
  if (rawStampedContractId && !stampedContractId) {
    preNotes.push(
      `contract id: the set's \`ds_contracts/contractId\` stamp "${rawStampedContractId}" is not a legal contract id — ignored, id proposed from the drawn set name`,
    );
  }
  const baseSelfId = stampedContractId ?? `${prefix}.${componentIdSlug(set.setName)}`;
  let selfId = baseSelfId;
  const ownKey = set.key ?? null;
  if (opts.sessionClaimedIds && ownKey !== null) {
    const contradicts = (id: string): boolean => {
      if (!opts.sessionClaimedIds!.has(id)) return false;
      const holderKey = opts.contractsById?.get(id)?.bindings?.figma?.anchors?.componentSetKey ?? null;
      return holderKey !== null && holderKey !== ownKey;
    };
    for (let n = 2; contradicts(selfId); n += 1) selfId = `${baseSelfId}-${n}`;
    if (selfId !== baseSelfId) {
      preNotes.push(
        `contract id: "${baseSelfId}" is already claimed in this session by a DIFFERENT drawn component (its componentSetKey contradicts this set's key ${ownKey}) — proposed as "${selfId}" (deterministic arrival-order suffix, the stubIdFor contradicting-key discipline at proposal time; without it the session registry would rebind the earlier import's child refs onto this contract and the referee reports a cycle that is not drawn). Rename either component to reclaim the base id`,
      );
    }
  }

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
    slotDescriptions: set.slotDescriptions,
    propertyDefinitions: set.propertyDefinitions,
    ...(statePromo ? { stateAxisPromoted: statePromo.axis.property } : {}),
    hiddenCaptured: opts.hiddenCaptured,
    capturedValues: opts.capturedValues,
    iconAssets: opts.iconAssets,
    instanceOverrides: opts.instanceOverrides,
    prefix,
    selfId,
    notes: [],
    unbound: [],
    textProps: [],
    boolProps: [],
    arrayProps: [],
    slots: [],
    flattenedVariants: new Set(),
    stubs: new Map(),
    partNames: new Set(['root']),
    // The set's declared prop names, shape-checked: only string→string pairs
    // survive, so a malformed stamp reads as absent and the canonicaliser runs
    // exactly as before.
    // A set this pipeline drew carries at least one of the v1.21+ stamps.
    drawnByThisPipeline: Boolean(
      (set as { propNames?: unknown }).propNames ||
        (set as { semantics?: unknown }).semantics ||
        (set as { statePreviewAxis?: unknown }).statePreviewAxis ||
        stampedContractId,
    ),
    ...(() => {
      const raw = (set as { propNames?: unknown }).propNames;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof k === 'string' && typeof v === 'string' && k && v) map[k] = v;
      }
      return Object.keys(map).length > 0 ? { propNames: map } : {};
    })(),
    projectionMode,
    mint: opts.mintUnbound
      ? {
          // Enum axes substitute anywhere; two-value True/False axes (minted
          // as BOOLEAN props) join as flagged conditioning axes so a ROOT
          // channel that is f(bool) or f(bool × enum) still carries — the
          // axis-inert fix extended to the bool plane (field case: Toggle
          // root fill = f(pressed, theme); with pressed excluded the channel
          // refused classification and the track never painted). The
          // emitters render bool sides as data-attribute selectors on the
          // root (`[data-pressed]` / `:not([data-pressed])`), so bool
          // conditioning stays ROOT-ONLY (enforced in mintTokens classify).
          axes: [
            ...enumAxes.map((a) => ({ propName: a.propName, values: a.values.map(camel) })),
            ...axes
              .filter((a) => isBoolAxis(a.values))
              .map((a) => ({ propName: a.propName, values: ['true', 'false'], bool: true as const })),
          ],
          axisValuesByVariant: new Map(
            variantNames.map((v) => {
              const record: Record<string, string> = {};
              for (const [property, value] of Object.entries(axisValuesOf(v))) {
                const axis = axes.find((a) => a.property === property);
                if (axis) record[axis.propName] = isBoolAxis(axis.values) ? value.trim().toLowerCase() : camel(value);
              }
              return [v, record];
            }),
          ),
          observations: [],
          partialSources: new Set(),
          attach: [],
          absFallbacks: [],
          refOverrides: [],
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

  // ROUND 3 — instance TEXT overrides, child half: resolve the cross-set
  // demand against the tree that actually merged (a wrapper union can fold
  // the host's drawn path). Runs BEFORE any part is built so the TEXT branch
  // finds its promotion already decided.
  if (opts.textOverrideDemand) {
    const demanded = new Set<string>([
      ...(set.key ? (opts.textOverrideDemand.get(set.key) ?? []) : []),
      ...(opts.textOverrideDemand.get(set.setName) ?? []),
    ]);
    if (demanded.size > 0) ctx.textPromote = resolveTextOverrideDemand(merged, demanded, ctx);
  }

  const root: Record<string, unknown> = {};
  const rootKeyByChildName = new Map<string, string>();
  const rootLayout = invertLayout(merged, true, null, ctx, where);
  if (rootLayout) root.layout = rootLayout;
  applyLayoutSplit(root, invertLayoutByProp(merged, ctx, where));
  const rootTokensByProp: ByPropCollector = { map: {} };
  const rootDeclared: Record<string, string> = {};
  const rootTokens = invertNodeTokens(merged, true, ctx, where, rootTokensByProp, undefined, rootDeclared);
  if (Object.keys(rootDeclared).length > 0) {
    root.declared = { ...(root.declared as Record<string, string> | undefined), ...rootDeclared };
  }
  carryClip(merged, root, ctx, where, { carry: true }); // FC-DUMP-PROPOSE-CLIP-UNREAD — the variant root clips too
  nameReactions(merged, ctx, where); // dump v1.31 — Button ON_HOVER → CHANGE_TO wiring, named with its target
  nameItemReverseZIndex(merged, ctx, where); // dump v1.31
  carryAspectRatio(merged, root, ctx, where); // dump v1.31
  // dump v1.7 tolerance ledger (root): an IMAGE fill on the variant root
  // (photo avatars) is captured by name only — the image stays unexported;
  // with minting on, the root renders the neutral placeholder gradient
  // (per-variant: 'none' where no image is drawn) instead of nothing.
  if (merged.occ.some((o) => o.node.imageFill !== undefined)) {
    ctx.notes.push(
      merged.occ.some((o) => typeof o.node.imageFill === 'string')
        ? `${where}: IMAGE fill carried BY HASH (dump v1.9 \`imageFill\`) — the root renders the exported asset (url('./assets/images/<hash>.png')) where the image is drawn; the placeholder gradient remains the fallback when the asset is absent`
        : `${where}: IMAGE fill captured BY NAME only (dump v1.7 \`imageFill\`) — the image itself is NOT exported (a later round exports the asset); the root renders the neutral placeholder gradient (${IMAGE_FILL_PLACEHOLDER_GRADIENT}) where the image is drawn`,
    );
    mintObservation(
      ctx,
      rootTokens,
      where,
      'background-image',
      'gradient',
      merged.occ.map((o) => ({
        variant: o.variant,
        value: imageFillCss(o.node.imageFill),
      })),
      undefined,
      'none', // presence-shaped: undrawn axis combinations draw no image
    );
    if (merged.occ.some((o) => typeof o.node.imageFill === 'string')) declareImageFillCover(root);
  }

  // Generator artifact: a root whose only child is the auto-injected `label`
  // text node (contracts with a `children` text prop and no parts). The node
  // is not a part — its text tokens hoist to the root.
  const only = merged.children.length === 1 ? merged.children[0] : undefined;
  const soleLabel = only !== undefined && only.type === 'TEXT' && only.name === 'label';
  const autoLabel = soleLabel && unifiedPropRef(only!, 'characters', ctx, `${where}/label`);
  // R7 (2026-08-22, core/root-text-check.ts): the UNBOUND sole `label` TEXT
  // child is what the emitter draws for `anatomy.root.text` (rootTextSpecs:
  // the root IS the text node, and a COMPONENT cannot be a TEXT node, so it
  // hosts one TEXT child named `label`). Until this round the hoist required
  // a BOUND text property, so a root text came back as `parts.label.text` +
  // `parts.label.tokens.color` — a different spelling from the one that was
  // sent, and the round trip never closed on it. The hoist rule is now:
  //   sole child + TEXT + named `label` + (bound text property OR no host-
  //   demanded text override) → the node is the root's own text.
  // Bound: characters become the `children` prop (unchanged). Unbound:
  // characters become anatomy.root.text (per-axis variation rides
  // textByProp through bindTextByAxis, exactly as a child text part's does).
  // Either way the text tokens / literal ink / case / slant hoist to root.
  // A host-demanded text override (textPromote) is per-usage API and keeps
  // the part path so the promotion can bind it.
  const promotedLabel =
    soleLabel && !autoLabel ? ctx.textPromote?.get(`${where}/label`.slice(`${ctx.setName}:root/`.length)) : undefined;
  const unboundRootText = soleLabel && !autoLabel && promotedLabel === undefined;
  if (only && (autoLabel || unboundRootText)) {
    // The label's tokens hoist to the root — its per-value correlations ride
    // the SAME root collector, so a hoisted function lands on root.tokensByProp.
    const textTokens = invertTextTokens(only, ctx, `${where}/label`, rootTokensByProp);
    Object.assign(rootTokens, textTokens);
    liftUnboundTextPaintsToLiterals(only, root, rootTokens, ctx, `${where}/label`);
    carryTextCase(only, root, ctx, `${where}/label`); // dump v1.16 — hoists with the label
    carryFontSlant(only, root, ctx, `${where}/label`); // FC-DUMP-PROPOSE-ITALIC-DROPPED — hoists with the label
    carryFontFamily(only, root, ctx, `${where}/label`); // dump v1.31 — hoists with the label
    carryTextAlign(only, root, ctx, `${where}/label`); // dump v1.31 — hoists with the label

    // The label's tokens hoisted — retarget its captured mint observations
    // to the record that actually ships (rootTokens).
    if (ctx.mint) {
      for (const o of ctx.mint.observations) if (o.target === textTokens) o.target = rootTokens;
    }
    const characters = first(only.occ, (n) => n.text?.characters) ?? '';
    if (autoLabel) {
      registerTextProp(ctx, autoLabel, characters, 'children');
      ctx.notes.push(
        `${where}/label: sole root text node named "label" is the generator's auto-injected children label — hoisted to root tokens, bound prop proposed as \`children\``,
      );
    } else {
      root.text = characters;
      bindTextByAxis(only, root, ctx, `${where}/label`);
      ctx.notes.push(
        `${where}/label: sole root text node named "label" with no bound text property is the root's own text (the emitter draws anatomy.root.text as exactly this node) — hoisted to anatomy.root.text, its text tokens to root tokens`,
      );
    }
  } else {
    const mode = parentModesOf(merged, ctx.mint !== undefined);
    // Pre-order key claiming + P9 run detection — see buildChildParts.
    // rootKeyByChildName maps drawn depth-1 names onto their claimed keys —
    // the part-level state diff (v13) resolves parts through it.
    const parts = buildChildParts(merged.children, mode, ctx, where, 'root', rootKeyByChildName);
    if (Object.keys(parts).length > 0) root.parts = parts;
    // A2 grid (G4): slot parts' cells hoist to layout.areas — the area name
    // IS the slot anchor; no-op unless the root carried a manual grid.
    hoistGridAreas(root, ctx, where);
    // Overlay-flattened class: a root that owns positioned children is their
    // positioning context (position: relative — emit-react folds it into its
    // own overlay chrome when both apply).
    declareRelativeIfPositionedChildren(root, parts, null);
  }
  invertNodeOpacity(merged, root, rootTokens, ctx, where);
  invertNodeEffects(merged, rootTokens, ctx, where);
  invertRootFixedSize(merged, root, rootTokens, ctx, where);
  // G8: a grid ROOT states each axis too. Runs AFTER invertRootFixedSize so an
  // axis that door already made definite (px mint, or its own 'fit-content'
  // all-HUG branch) is left exactly as it found it.
  carryGridAxisSizing(merged, root, ctx, where, rootTokens);
  attachByProp(root, rootTokensByProp);
  attachTokens(ctx, root, rootTokens);

  // ROUND 3 — instance TEXT overrides, the completeness check. Every
  // character override in the DUMP that no built part ever reached is named
  // here. Without it the loud losses (a part dropped by state promotion, a
  // variant filtered out upstream) would look exactly like "there was
  // nothing to carry" — the silence this whole channel exists to end.
  {
    const seen = ctx.textOverridesVisited;
    const unreached = new Map<string, Set<string>>();
    const scan = (node: DumpNode): void => {
      for (const [path, chars] of Object.entries(node.textOverrides ?? {})) {
        if (seen?.has(`${path} ${chars}`)) continue;
        (unreached.get(path) ?? unreached.set(path, new Set()).get(path)!).add(chars);
      }
      for (const c of node.children ?? []) scan(c);
    };
    for (const v of set.variants) scan(v);
    if (unreached.size > 0) {
      ctx.notes.push(
        `${set.setName}: ${[...unreached.values()].reduce((n, s) => n + s.size, 0)} observed character override(s) in this set's dump were NOT carried because no proposed part reaches the instance that holds them (${[...unreached].map(([p, vs]) => `"${p}" = ${[...vs].sort().map((v) => JSON.stringify(v)).join('/')}`).join('; ')}) — the usual cause is a part that lives only in variants the proposal excludes (an interaction-state group, a filtered mode); named here so the absence is never read as "nothing was drawn"`,
      );
    }
  }

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
  /** v17 — state → prop → value → channel → ref, the root's per-enum-value
   *  state bindings (see StateByPropCollector). */
  const stateByProp: Record<string, StateByPropCollector> = {};
  const partStateTargets: PartStateTarget[] = [];
  if (statePromo) {
    const baseByName = new Map(variants.map((v) => [v.name, v]));
    const baseChildNames = new Set<string>();
    for (const v of variants) for (const c of v.children ?? []) baseChildNames.add(c.name);
    const groups: Array<[string, DumpNode[]]> = [...stateGroups.entries()];
    if (disabledGroup.length > 0) groups.push(['disabled', disabledGroup]);
    for (const [state, group] of groups) {
      const target = (stateOverrides[state] ??= {});
      const byProp = (stateByProp[state] ??= {});
      proposeStateDiffs(
        ctx, state, group, baseByName, baseChildNames, rootTokens, target,
        (root.parts as Record<string, unknown> | undefined) ?? {},
        rootKeyByChildName,
        partStateTargets,
        byProp,
      );
    }
    // The disabled axis value → a REAL boolean prop (native attribute on
    // interactive elements), bound the forward generator's way — EXCEPT
    // when this pipeline already declared Disabled as a State-preview cell
    // (FC-DUMP-PROPOSE-DISABLED-INVENTED). Emit with bindings.figma.statePreviews
    // draws State=Disabled, not a Disabled BOOLEAN; inventing the BOOLEAN
    // remints API the canvas never had.
    if (statePromo.disabledValue !== undefined) {
      const declaredPreviewDisabled =
        declaredSparseAxis !== null &&
        declaredSparseAxis.axis === statePromo.axis.property &&
        declaredSparseAxis.states.some((s) => normStateValue(s) === 'disabled');
      if (declaredPreviewDisabled) {
        ctx.notes.push(
          `prop \`disabled\`: not invented from axis value "${statePromo.axis.property}=${statePromo.disabledValue}" — the set's statePreviewAxis already declares Disabled as a preview cell; the disabled STATE block still carries (FC-DUMP-PROPOSE-DISABLED-INVENTED)`,
        );
      } else if (ctx.boolProps.some((b) => b.name === 'disabled')) {
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
    if (pascal(name) !== s.property) slot.bindings = { figma: { property: s.property } };
    if (propNameSanitized(s.property)) {
      ctx.notes.push(
        `slot \`${name}\`: Figma property "${s.property}" contains characters outside a legal identifier — name sanitized at proposal; the original spelling stays the design binding (slot.bindings.figma.property)`,
      );
    }
    if (s !== defaultSlot && propNameDigitLed(s.property)) {
      ctx.notes.push(
        `slot \`${name}\`: Figma property "${s.property}" is digit-led — a code identifier cannot start with a digit, so the name gets the deterministic "p" prefix (the componentIdSlug digit-led discipline); the original spelling stays the design binding (slot.bindings.figma.property)`,
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
        // ROUND 3: a prop promoted from a HOST's raw character override has
        // no drawn TEXT property to bind — kind NONE (code-only), the same
        // honesty the arrayOf props use. Claiming a TEXT property here would
        // invent a design API the set does not have.
        figma: t.figmaless ? { kind: 'NONE' } : { kind: 'TEXT', property: t.property },
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
  // FC-DUMP-PROPOSE-UNBOUND-BOOLEAN. A BOOLEAN component property that no
  // layer visibility or instance swap references (Eventz Button isFullWidth,
  // a `Pressed` toggle wired to nothing yet) vanished from the proposed API
  // with no receipt — the definition is CAPTURED evidence (dump v1.5
  // boolDefaults / v1.14 propertyDefinitions) of a design API the set
  // exposes, so it carries as a boolean prop bound to the Figma BOOLEAN
  // (the forward emitter mints exactly such a property from boolProps), with
  // the fact that it binds nothing named. Axis properties (flattened to a
  // variant axis) and the slot "Show <Property>" convention are NOT API
  // props and stay excluded, as before.
  {
    const boolDefs: Record<string, boolean> = { ...(set.boolDefaults ?? {}) };
    for (const [rawName, def] of Object.entries(set.propertyDefinitions ?? {})) {
      if (def.type === 'BOOLEAN' && typeof def.defaultValue === 'boolean') boolDefs[rawName.split('#')[0]] ??= def.defaultValue;
    }
    const referenced = new Set<string>();
    const walkRefs = (n: DumpNode): void => {
      for (const v of Object.values(n.propRefs ?? {})) if (typeof v === 'string') referenced.add(v);
      for (const c of n.children ?? []) walkRefs(c);
    };
    for (const v of set.variants) walkRefs(v);
    for (const [property, defaultValue] of Object.entries(boolDefs)) {
      if (ctx.boolProps.some((b) => b.property === property)) continue;
      if (referenced.has(property)) continue; // bound somewhere the passes above already judged (slot "Show", visibility)
      if (axes.some((a) => a.property === property)) continue; // a variant axis, already a prop
      const name = textPropName(ctx, property);
      if (props.some((p) => p.name === name)) {
        ctx.notes.push(
          `prop \`${name}\`: BOOLEAN property "${property}" (default ${defaultValue}) binds nothing on the canvas AND its name collides with an existing prop — NAMED, not proposed (rename the property to carry it)`,
        );
        continue;
      }
      props.push({
        name,
        type: 'boolean',
        default: defaultValue,
        bindings: {
          figma: { kind: 'BOOLEAN', property },
          code: { prop: name },
        },
      });
      ctx.notes.push(
        `prop \`${name}\`: BOOLEAN property "${property}" (default ${defaultValue}, the property definition's defaultValue) binds nothing on the canvas — no layer visibility or instance swap references it — carried as a boolean prop so the design API survives the proposal; it restyles nothing until a binding is drawn (review)`,
      );
    }
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
  // FC-DUMP-PROPOSE-NAME-PARENTHETICAL: strip emit's collision suffix
  // ` (${stampedId})` before PascalCase so "Alert (flowbite.alert)"
  // recovers Alert, not AlertFlowbiteAlert.
  const drawnName = drawnContractName(set.setName, stampedContractId);
  const componentName = drawnName.name;
  if (drawnName.strippedSuffix) {
    ctx.notes.push(
      `contract name: drawn set name "${set.setName}" carries the emit collision suffix " (${stampedContractId})" — proposed as "${componentName}" (FC-DUMP-PROPOSE-NAME-PARENTHETICAL)`,
    );
  } else if (componentName !== set.setName) {
    ctx.notes.push(
      `contract name: drawn set name "${set.setName}" is not a PascalCase component name — proposed as "${componentName}" (the canvas set keeps its own name; the componentSetKey/nodeId anchors carry identity)`,
    );
  }
  if (stampedContractId) {
    ctx.notes.unshift(
      `contract id: read from the set's own \`ds_contracts/contractId\` stamp ("${stampedContractId}") — the contract this pipeline drew, not a name-derived \`${prefix}.*\` slug`,
    );
  } else if (idSlugSanitized(set.setName)) {
    // Field case (CBDS kit, first live plugin send): "_variable-list-item",
    // "Button / Primary / Medium", "Type=Text, Variant=Error" all derive ids
    // the schema's ^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$ refuses — sanitize AT
    // PROPOSAL (the prop-identifier discipline), never refuse at receive.
    ctx.notes.push(
      `contract id: drawn set name "${set.setName}" contains characters a contract id cannot carry — id proposed as "${selfId}" (rule: lowercase kebab, illegal characters → hyphens, runs collapsed, edge hyphens stripped, digit-led/empty gets "c"); the canvas set keeps its own name and the componentSetKey/nodeId anchors carry identity`,
    );
  }
  const stampedSpecHash = readStampedSpecHash(set);
  if (stampedSpecHash) {
    ctx.notes.unshift(
      `specHash: read from the set's own \`ds_contracts/specHash\` stamp (${stampedSpecHash}) — the emit fingerprint this pipeline drew; compare to the current engine before amend`,
    );
  }
  const stampedVersion = readStampedVersion(set);
  if (stampedVersion) {
    ctx.notes.unshift(
      `version: read from the set's own \`ds_contracts/version\` stamp (${stampedVersion}) — the authored contract version this pipeline drew, not the invented 0.1.0 default`,
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

  /** The contract's own semantics, stamped on the set (dump v1.24). Shape-
   *  checked here; anything malformed reads as absent, so a bad stamp can only
   *  fall back to the inference, never assert a bogus element. */
  const stampedSemantics = (() => {
    const raw = (set as { semantics?: unknown }).semantics;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    const element = typeof r.element === 'string' && r.element ? r.element : undefined;
    const role = typeof r.role === 'string' && r.role ? r.role : undefined;
    // dump v1.32: the AUTHORED exception sentence rides the stamp when the
    // emit carried it. A stamped role WITHOUT one still needs the contract to
    // stay emittable (the WC emitter refuses a native-twin role with no
    // declared exception — flowbite.toggleswitch's <button role="switch">),
    // so the exception is the stamp's own provenance, stated as exactly that
    // — never an invented author rationale.
    const roleException =
      typeof r.roleException === 'string' && r.roleException
        ? r.roleException
        : role
          ? `Declared by the design-side ds_contracts/semantics stamp (role "${role}" on <${element ?? 'div'}>); the authored exception sentence is not canvas-recoverable — re-declare it in review.`
          : undefined;
    if (!element && !role) return null;
    return { element, role, roleException };
  })();
  const stampNote = stampedSemantics
    ? `semantics: read from the set's own \`ds_contracts/semantics\` stamp (element "${stampedSemantics.element ?? 'div'}"${stampedSemantics.role ? `, role "${stampedSemantics.role}"` : ''}) — the contract's declared host element, not the name/axis inference`
    : null;

  // Deterministic semantics inference (name/axis table — zero AI, see
  // inferSemantics). A detected interaction-state axis is the structural
  // corroboration that the component is interactive.
  //
  // VOID-ELEMENT RE-ROOT (Eventz field case): the table proposes "input" for
  // checkbox/switch/input-named sets, but a VOID element cannot mount
  // children and validateContract now refuses that shape BY NAME on every
  // emit surface — a proposal must never produce a contract the emitter
  // refuses. When the inferred element is void AND the drawn anatomy mounts
  // child parts, the proposal keeps the drawn children under a CONTAINER
  // root ("div", the existing hedge) and flags the re-root as a REVIEW item
  // instead; an inferred role is NOT carried onto the container (role
  // "switch" on a div would trip the native-semantics lint — the role
  // belongs on the native control the reviewer mounts as a child part).
  // Deliberately NOT a synthetic <input> child part: the canvas did not draw
  // one, and inventing structure is the plausible-substitution failure mode
  // this pipeline refuses everywhere else.
  const inferredRaw = inferSemantics(set.setName, axes, statePromo !== null);
  const rootPartCount = Object.keys((root.parts as Record<string, unknown> | undefined) ?? {}).length;
  const inferred: InferredSemantics | null =
    inferredRaw && VOID_ELEMENTS.has(inferredRaw.element) && rootPartCount > 0
      ? {
          element: 'div',
          note:
            `semantics: element "${inferredRaw.element}" matched the name/axis table for set "${set.setName}", but the drawn anatomy mounts ${rootPartCount} child part(s) and <${inferredRaw.element}> is a VOID element — children cannot mount inside it (React refuses the shape at runtime and renders NOTHING; the emitters refuse it by name). ` +
            `Proposed as container element "div" instead${inferredRaw.role ? `; the inferred role "${inferredRaw.role}" is NOT carried (it belongs on the native control, not the container)` : ''} — REVIEW: re-root before adoption by mounting the native <${inferredRaw.element}> control as a child part inside this container`,
        }
      : inferredRaw;
  // dump v1.32 — the set's own description + documentation links. An
  // UNSTAMPED set's description is the DESIGNER'S words and carries
  // VERBATIM; a STAMPED set's description is this pipeline's own emit
  // caption ("<Name> — generated from contract <id> v<v> †"), which is NOT
  // the authored contract description (that is not canvas-recoverable), so
  // the provenance boilerplate stands and the caption is named. Links carry
  // either way — they are the designer's pointer, not an emit artifact.
  const PROPOSED_BOILERPLATE = `PROPOSED contract extracted from the design canvas (extract/figma dump v1) — API, anatomy, and token bindings inverted from the drawn structure. Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable; review before adoption.`;
  const setDescriptionRaw = (set as { description?: unknown }).description;
  const setDescription =
    typeof setDescriptionRaw === 'string' && setDescriptionRaw.trim() !== '' ? setDescriptionRaw : null;
  const setDocumentationLinks = (
    Array.isArray((set as { documentationLinks?: unknown }).documentationLinks)
      ? ((set as { documentationLinks: Array<{ uri?: unknown }> }).documentationLinks)
      : []
  ).filter((l): l is { uri: string } => typeof l?.uri === 'string' && l.uri !== '');
  const setIsStamped = typeof (set as { contractId?: unknown }).contractId === 'string';
  const proposedDescription = setDescription && !setIsStamped ? setDescription : PROPOSED_BOILERPLATE;
  if (setDescription && !setIsStamped) {
    ctx.notes.push(
      `description: carried VERBATIM from the set's own Figma description (${setDescription.length} chars, dump v1.32) — the proposal-provenance sentence rides this note instead of overwriting the designer's words: "${PROPOSED_BOILERPLATE}"`,
    );
  } else if (setDescription && setIsStamped) {
    ctx.notes.push(
      `description: the set's Figma description is this pipeline's own emit caption ("${setDescription}") — not the authored contract description (which is not canvas-recoverable); the PROPOSED provenance text stands`,
    );
  }
  if (setDocumentationLinks.length > 0) {
    ctx.notes.push(
      `documentationLinks: ${setDocumentationLinks.length} Figma documentation link(s) carried onto the contract (${setDocumentationLinks.map((l) => l.uri).join(', ')}) — code emitters surface them as JSDoc @see / Storybook docs links`,
    );
  }
  const contract: Record<string, unknown> = {
    $schema: './contract.schema.json',
    id: selfId,
    name: componentName,
    version: readStampedVersion(set) ?? '0.1.0',
    status: 'draft',
    description: proposedDescription,
    ...(setDocumentationLinks.length > 0
      ? { documentationLinks: setDocumentationLinks.map((l) => ({ uri: l.uri })) }
      : {}),
    // THE STAMP OUTRANKS THE INFERENCE. Everything below it is a guess from a
    // name/axis table, and a guess about the host element is not a small
    // thing: it decides what the generated component IS. Unstamped, Label
    // came back a `div` and Badge — a `span` that merely carries hover and
    // active variants — came back a `button`, because an interaction-state
    // axis reads as "interactive". Wrong is worse than missing.
    //
    // Read only what the contract actually declared (element, role). No stamp
    // → the table runs exactly as before, so a set this pipeline did not draw
    // is unaffected and nothing is invented for it.
    semantics: stampedSemantics
      ? {
          element: stampedSemantics.element ?? 'div',
          ...(stampedSemantics.role ? { role: stampedSemantics.role } : {}),
          ...(stampedSemantics.role && stampedSemantics.roleException
            ? { roleException: stampedSemantics.roleException }
            : {}),
        }
      : inferred
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
    bindings: {
      figma: {
        anchors: {
          fileKey: opts.fileKey ?? null,
          componentSetKey: set.key ?? null,
          ...(set.nodeId ? { nodeId: set.nodeId } : {}),
        },
      },
      code: { anchors: { importPath: `src/components/${componentName}`, export: componentName } },
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
    // ROUND 10 — `nestedPairs`: a nested part's two-axis channel is now
    // spellable (a two-placeholder ref on part.tokens, emitted as the
    // compound ancestor selector). Before this the classifier refused every
    // nested pair and the channel DROPPED — Social button's label ink is
    // f(social × theme) and never reached the contract at all.
    // `realizedCombos` — THE RAGGED MATRIX (see mint-tokens `classify`). A
    // Figma variant set is often not a rectangle: Slider is a RANGE control, so
    // only `rightControl > leftControl` is drawn (10 of 16 cells) and Avatar
    // realizes 162 of 216. Handing the classifier the combinations that ACTUALLY
    // exist lets a two-axis fit survive the cells the design never drew, instead
    // of collapsing to the one-axis base-slice projection below — which asserted
    // Slider's progress width by rightControl alone and drew 320px where the
    // canvas draws 80px in 24 of 40 variants.
    const realizedCombos = [...ctx.mint.axisValuesByVariant.values()];
    const minted = mintTokens(componentIdSlug(set.setName), observations, ctx.mint.axes, {
      nestedPairs: true,
      realizedCombos,
      // THE DUMP-ROUNDING RECONCILIATION (docs/23 §D.33). Both dump producers
      // round canvas geometry to two decimals, so a width the code→canvas
      // mint spelled 39.9219px from computed style comes back 39.92px — one
      // measurement, two spellings, and `generate` rightly refused the slot
      // that then held both. The minter asks the corpus what it already
      // spells at each claimed path and carries THAT when the observation is
      // it re-rounded; a real disagreement is untouched and still surfaces.
      corpusValueAt: (tokenPath) => {
        if (tokenPath.includes('{') || !ctx.corpus.has(tokenPath)) return undefined;
        try {
          const resolved = ctx.corpus.resolveLiteral(tokenPath);
          return typeof resolved === 'string' ? resolved : undefined;
        } catch {
          return undefined;
        }
      },
    });
    for (const row of minted.reconciled) {
      ctx.notes.push(`${set.setName}: minted ${row}`);
    }
    const bySource = new Map<string, { total: number; bound: number }>();
    minted.bindings.forEach((binding, i) => {
      const obs = observations[i];
      if (binding.ref) obs.target[obs.cssProperty] = binding.ref;
      else if (binding.reason) ctx.notes.push(`${obs.nodePath} ${obs.cssProperty}: ${binding.reason}`);
      // A carried-but-unwitnessed pair is BOUND, so it takes the ref above —
      // and its caveat is named here rather than swallowed. Bound and named
      // are not mutually exclusive; only refusals use `reason`.
      if (binding.ref && binding.caveat) ctx.notes.push(`${obs.nodePath} ${obs.cssProperty}: ${binding.caveat}`);
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
    // ROUND 2 ITERATION 9 — per-instance override targets whose refs
    // classified attach as component.overrides; an all-refused target
    // attaches nothing (each refusal already named above).
    for (const ro of ctx.mint.refOverrides) {
      if (Object.keys(ro.target).length > 0) ro.component.overrides = ro.target;
    }
    // Overlay-flattened class: abs-placement channels whose values refused
    // classification fall back to the base combo's captured value as a part
    // LITERAL (the round-4 padding precedent — the base plane is exact) so
    // the positioned part never ships position:absolute with a dangling
    // offset. The per-variant refusal above stays named; the fallback is too.
    for (const fb of ctx.mint.absFallbacks) {
      if (fb.tokens[fb.chan] !== undefined) continue; // minted — no fallback needed
      const literals = (fb.part.literals as Record<string, string> | undefined) ?? {};
      if (literals[fb.chan] !== undefined) continue;
      literals[fb.chan] = `${fb.value}px`;
      fb.part.literals = literals;
      // GAP-CLOSING ROUND 2 (axis-inert) — the base-combo literal is ONE
      // number for a channel the canvas drew differently at every value of
      // an axis, which is exactly the flat-row symptom: ProgressBar's bar
      // was 8.08px wide in all eleven Progress stories. When the refused
      // channel IS a clean function of one axis along the base slice (every
      // other axis pinned at the base combination), the whole slice carries
      // as a per-value literal map instead of its first element. Every
      // number is an OBSERVED capture — the projection chooses which
      // observations to carry, it never derives one. Combinations off the
      // base slice keep the refusal named above.
      const proj = projectRefusedOnAxis(ctx, fb);
      if (!proj) {
        ctx.notes.push(
          `${fb.where} ${fb.chan}: per-variant captured values refused classification (named above) — the FIRST occurrence's ${fb.value}px carried as a base-combo literal fallback (exact for the default rendering; other variants keep the refusal)`,
        );
        continue;
      }
      const lbp =
        (fb.part.literalsByProp as Array<{ prop: string; map: Record<string, Record<string, string>> }> | undefined) ??
        [];
      let entry = lbp.find((e) => e.prop === proj.prop);
      if (!entry) {
        entry = { prop: proj.prop, map: {} };
        lbp.push(entry);
      }
      for (const [value, px] of proj.byValue) {
        (entry.map[value] ??= {})[fb.chan] = `${px}px`;
      }
      fb.part.literalsByProp = lbp;
      ctx.notes.push(
        `${fb.where} ${fb.chan}: per-variant captured values refused classification (named above) — PROJECTED onto the "${proj.prop}" axis and carried as a per-value literal map (${proj.byValue.size} observed value(s): ${[...proj.byValue].map(([v, px]) => `${v}=${px}px`).join(', ')}), each one measured at the base combination of every OTHER axis (${proj.baseCombo || 'no other axis'}); the base combo's ${fb.value}px stays the part literal for axis values the capture never drew. The channel also varies with the other axes at combinations off that slice — those keep the refusal named above`,
      );
    }
    // A fully minted usage site is bound now — no longer an UNBOUND entry.
    // BUT its nearest-real-token candidates must not vanish with it: dropping
    // the entry silently also dropped the rename hint the human uses to
    // replace the provisional name (caught by the eval that pins "named,
    // never invented" when the CLI door turned minting on, 2026-08-03). The
    // hint survives as a note tied to the minted carriage. Only entries that
    // HAD suggestions gain a note, so an empty-corpus proposal (untitled-ui:
    // captured.dtcg.json is {}) emits nothing new and stays byte-identical.
    const partial = ctx.mint.partialSources;
    ctx.unbound = ctx.unbound.filter((u) => {
      const s = bySource.get(`${u.nodePath}|${u.property}`);
      const fullyMinted = !!(s && s.bound === s.total && !partial.has(`${u.nodePath}|${u.property}`));
      if (fullyMinted && u.suggestions.length > 0) {
        ctx.notes.push(
          `${u.nodePath} ${u.property}: observed ${u.value} carried as a PROVISIONAL minted token (rename against your real system) — nearest real tokens by value: ${u.suggestions.map((t) => `{${t}}`).join(', ')}; the proposal binds the provisional name, never a real token the canvas did not use`,
        );
      }
      return !fullyMinted;
    });
    for (const e of minted.entries) {
      // ROUND 6: a `size`-kind leaf may hold the CONTENT-SIZED keyword rather
      // than a measure. "Rename it against your real tokens" would be a
      // wrong-name — there is no design token for HUG — so a keyword leaf
      // says what it actually is.
      ctx.notes.push(
        e.value === 'fit-content'
          ? `MINTED ${e.ref} = fit-content — a SIZING MODE, not a measure: this plane HUGS its content on the canvas, so the leaf states the mode instead of freezing a measurement of the default content. Nothing to rename (no design token names HUG); the canvas leg reads it back as Figma HUG sizing and upserts no variable for it; bound at: ${e.usageSites.join(', ')}`
          : `MINTED ${e.ref} = ${e.value} — machine-named from a resolved value — rename against your real tokens (provisional); bound at: ${e.usageSites.join(', ')}`,
      );
    }
    mintedTokens = { tree: minted.tree, count: minted.count, entries: minted.entries };
  }

  // ROUND 2 ITERATION 9 — override CONSUMPTION declaration (root part),
  // AFTER the mint pass so the root's token record is final. Declared from
  // the same observed evidence that minted the channels: an image fill is
  // per-instance identity in Figma (any instance can carry its own), and a
  // minted root box is the observed box (any instance can be resized).
  // Opt-in with the instance-override ledger — the option-less path is
  // byte-identical.
  if (ctx.instanceOverrides) {
    const rt = (root.tokens ?? {}) as Record<string, string>;
    const declaredOv: string[] = [];
    if (typeof rt['background-image'] === 'string' && merged.occ.some((o) => typeof o.node.imageFill === 'string')) {
      declaredOv.push('background-image');
    }
    if (typeof rt['width'] === 'string' && typeof rt['height'] === 'string') declaredOv.push('size');
    if (declaredOv.length > 0) {
      root.overridable = declaredOv;
      ctx.notes.push(
        `root: overridable [${declaredOv.join(', ')}] declared (iteration 9) — hosts may carry PROVEN per-instance overrides for these channels; the root's own bindings are the var() fallback, so instances without overrides render identically`,
      );
    }
  }

  // State-axis promotion, final attach — AFTER the mint pass so minted state
  // refs have landed in their records. States whose overrides all refused
  // are dropped BY NAME; the survivors become the contract's `states` + root
  // overrides, and bindings.figma.statePreviews opts in when its own refusal rules
  // hold (every declared state has overrides — guaranteed here; overrides
  // substitute ≤1 enum prop; the "State" design property is free).
  if (statePromo) {
    const ORDER = ['hover', 'active', 'focus-visible', 'disabled'];
    const declared = ORDER.filter((s) => stateOverrides[s] !== undefined);
    // v13: part-level overrides (attached below) DECLARE a state exactly
    // like root ones — the disabled label color alone is a real state.
    const partPresent = new Set<string>();
    for (const rec of partStateTargets) {
      // v17: a per-value-only override DECLARES the state exactly like a
      // single-ref one. Before, a state whose every channel was a function of
      // a variant axis counted as "nothing recoverable" and was dropped —
      // which is precisely how Button's hover plane disappeared.
      if (Object.keys(rec.target).length > 0 || Object.keys(rec.byProp).length > 0) partPresent.add(rec.state);
    }
    const present = declared.filter(
      (s) =>
        Object.keys(stateOverrides[s]).length > 0 ||
        Object.keys(stateByProp[s] ?? {}).length > 0 ||
        partPresent.has(s),
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
      if (!present.includes(rec.state)) continue;
      // v17: the per-enum-value half lands as statesByProp entries, one per
      // driving prop, and can be the ONLY thing this record carries.
      for (const [prop, map] of Object.entries(rec.byProp)) {
        const list = (rec.part.statesByProp ?? []) as Array<{ prop: string; state: string; map: unknown }>;
        list.push({ prop, state: rec.state, map });
        rec.part.statesByProp = list;
      }
      if (Object.keys(rec.target).length === 0) continue;
      const states = (rec.part.states ?? {}) as Record<string, Record<string, string>>;
      states[rec.state] = { ...(states[rec.state] ?? {}), ...rec.target };
      rec.part.states = states;
      // THE SAME FLAT LOOKUP, one layer on. The ATTACHMENT above is fine — it
      // holds the part object by reference, so a nested part gets its `states`
      // correctly — but naming it by scanning only `root.parts` printed the
      // literal placeholder "(part)" for every nested one, so the carry receipt
      // could not say WHAT it had carried. Walk for the object instead, and
      // spell the path so a nested part is distinguishable from a depth-1 one.
      const findPartPath = (parts: Record<string, unknown> | undefined, trail: string[]): string | undefined => {
        for (const [k, v] of Object.entries(parts ?? {})) {
          const cand = v as Record<string, unknown>;
          if (cand === rec.part) return [...trail, k].join('/');
          const deeper = findPartPath(cand?.parts as Record<string, unknown> | undefined, [...trail, k]);
          if (deeper !== undefined) return deeper;
        }
        return undefined;
      };
      const partKeyName = findPartPath((root.parts as Record<string, unknown>) ?? {}, []) ?? '(part)';
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
      // v17 — the root's per-enum-value state bindings, in declared state
      // order so the emitted sheet is a function of the contract alone.
      const rootByPropEntries: Array<{ prop: string; state: string; map: unknown }> = [];
      for (const st of present) {
        for (const [prop, map] of Object.entries(stateByProp[st] ?? {})) {
          rootByPropEntries.push({ prop, state: st, map });
        }
      }
      if (rootByPropEntries.length > 0) root.statesByProp = rootByPropEntries;
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
        // Spelled BEFORE anchors — the schema's (and the codemod's) key order.
        const cb = contract.bindings as { figma: Record<string, unknown> };
        cb.figma = { statePreviews: true, ...cb.figma };
        ctx.notes.push(
          `bindings.figma.statePreviews: true — regenerating the canvas draws the promoted states as a "${STATE_PREVIEW_PROPERTY}" preview axis (values ${['Default', ...present.filter((s) => s !== 'disabled').map(statePreviewLabel)].join('|')}, the shared spelling rules) — a RENAME relative to the imported axis "${statePromo.axis.property}" (${statePromo.axis.values.join('|')}); the contract vocabulary carries no custom state-axis spellings, so the original spelling lives in this note and in the anchors' set`,
        );
      } else {
        ctx.notes.push(
          `bindings.figma.statePreviews NOT set: ${statePropertyTaken ? `a prop already binds the reserved design property "${STATE_PREVIEW_PROPERTY}"` : `state overrides substitute ${substProps.size} enum props (${[...substProps].join(', ')}) — previews multiply exactly ONE primary axis`} — canvas state previews refused by name, review`,
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
  if (stampNote) {
    ctx.notes.unshift(stampNote);
  } else if (inferred) {
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
  // Envelope consumers (parseProposal) accept only verified-exact |
  // legacy-unverified. Exact always proves returned VARIANT rows.
  // Reviewable structured success upgrades to verified-exact when the
  // proposed rows still match; semantic promotions that change the tuple
  // set fall back to an explicit legacy receipt rather than emitting the
  // internal source-matrix-verified status (which receive rejects).
  let projection: ExactProjectionResult;
  if (projectionMode === 'exact') {
    projection = assertExactProjection(
      validateExactVariantProjection(set, exactRowsFromProposedContract(contract, declaredSparseAxis)),
      'verified-exact',
    );
  } else if (sourceProjection.status === 'source-matrix-verified') {
    const returned = validateExactVariantProjection(
      set,
      exactRowsFromProposedContract(contract, declaredSparseAxis),
    );
    projection =
      returned.status === 'verified-exact'
        ? returned
        : {
            status: 'legacy-unverified',
            reason: 'structured-exact-evidence-absent',
          };
  } else {
    projection = sourceProjection;
  }
  return {
    contract,
    notes: ctx.notes,
    unbound: ctx.unbound,
    projection,
    ...(mintedTokens ? { mintedTokens } : {}),
    ...(childStubs.length > 0 ? { childStubs } : {}),
    ...(selfId !== baseSelfId ? { idSuffixedFrom: baseSelfId } : {}),
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
  // Session-link siblings in THIS dump: a later Card-Image sees Avatar
  // proposed earlier. Without this, Path A batches mint string "true"/"false"
  // against a child that is BOOLEAN and generateTsx refuses (Eventz/CBDS).
  const contractIdByName = new Map(opts.contractIdByName);
  const contractsById = new Map(opts.contractsById ?? []);
  const contractIdByKey = new Map(opts.contractIdByKey ?? []);
  const sessionClaimedIds = new Set(opts.sessionClaimedIds ?? []);
  // STUBS a sibling set auto-proposed earlier in this batch, with the minted
  // geometry leaves they reference. A later set whose instance LINKS to one
  // (componentSetKey/name, via contractsById below) would otherwise ship an
  // envelope that references a contract only the SIBLING's envelope carries
  // — the plugin exports one envelope per set and `figma receive` lands them
  // one at a time, so `generate` on that set alone refuses "no contract in
  // scope" by name (fill-matrix Badge→Chip, ds.icon). Every envelope stands
  // alone: the stub and its leaves ride each proposal that references it.
  type SessionStub = {
    stub: Record<string, unknown>;
    fromSet: string;
    tree: Record<string, unknown>;
    entries: MintedEntry[];
  };
  const sessionStubs = new Map<string, SessionStub>();
  const importedRefsOf = (c: unknown): string[] => [
    ...new Set(JSON.stringify(c).match(/\{imported\.[^}"]+\}/g) ?? []),
  ];
  const mintSliceFor = (
    refs: string[],
    minted: FigmaProposalResult['mintedTokens'],
  ): { tree: Record<string, unknown>; entries: MintedEntry[] } => {
    const tree: Record<string, unknown> = {};
    if (!minted) return { tree, entries: [] };
    const wanted = new Set(refs);
    for (const ref of refs) {
      const path = ref.slice(1, -1).split('.');
      let leaf: unknown = minted.tree;
      for (const seg of path) leaf = leaf && typeof leaf === 'object' ? (leaf as Record<string, unknown>)[seg] : undefined;
      if (leaf === undefined) continue;
      let cur = tree;
      for (const seg of path.slice(0, -1)) {
        cur = (cur[seg] as Record<string, unknown> | undefined) ?? (cur[seg] = {});
      }
      cur[path[path.length - 1]] = leaf;
    }
    return { tree, entries: minted.entries.filter((e) => wanted.has(e.ref)) };
  };
  const componentRefIds = (contract: Record<string, unknown>): string[] => {
    const ids: string[] = [];
    const walk = (part: unknown) => {
      if (!part || typeof part !== 'object') return;
      const p = part as { component?: { id?: unknown }; parts?: Record<string, unknown> };
      if (typeof p.component?.id === 'string') ids.push(p.component.id);
      for (const child of Object.values(p.parts ?? {})) walk(child);
    };
    walk((contract.anatomy as { root?: unknown } | undefined)?.root);
    return [...new Set(ids)];
  };
  const attachSiblingStubs = (proposal: DumpBatchResult['proposals'][number]) => {
    const own = new Set((proposal.childStubs ?? []).map((s) => s.id));
    for (const id of componentRefIds(proposal.contract)) {
      if (own.has(id)) continue;
      const sib = sessionStubs.get(id);
      if (!sib) continue;
      proposal.childStubs = [...(proposal.childStubs ?? []), sib.stub];
      own.add(id);
      let carried = 0;
      if (sib.entries.length > 0) {
        if (!proposal.mintedTokens) proposal.mintedTokens = { tree: {}, count: 0, entries: [] };
        mergeMintTree(proposal.mintedTokens.tree, JSON.parse(JSON.stringify(sib.tree)) as Record<string, unknown>);
        const have = new Set(proposal.mintedTokens.entries.map((e) => e.ref));
        for (const e of sib.entries) {
          if (have.has(e.ref)) continue;
          proposal.mintedTokens.entries.push(e);
          proposal.mintedTokens.count += 1;
          carried += 1;
        }
      }
      proposal.notes.push(
        `${proposal.setName}: component ref "${id}" resolved to the STUB sibling set "${sib.fromSet}" auto-proposed earlier in this dump — the stub${
          carried > 0 ? ` and its ${carried} minted geometry leaves` : ''
        } ride this proposal's childStubs/mintedTokens too, so the envelope stands alone (identical copies; importing the real "${id}" set replaces both)`,
      );
    }
  };
  const registerSession = (c: Record<string, unknown>, dumpName?: string, isStub = false) => {
    if (typeof c.id !== 'string') return;
    if (isStub && contractsById.has(c.id)) return;
    sessionClaimedIds.add(c.id);
    contractsById.set(c.id, asMinimalChildContract(c));
    if (typeof c.name === 'string') contractIdByName.set(c.name, c.id);
    if (dumpName) contractIdByName.set(dumpName, c.id);
    const key = (c.bindings as { figma?: { anchors?: { componentSetKey?: string | null } } } | undefined)?.figma
      ?.anchors?.componentSetKey;
    if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
  };
  const setOpts = {
    ...opts,
    capturedValues,
    contractIdByName,
    contractsById,
    contractIdByKey,
    sessionClaimedIds,
  };
  // READ-LIMIT NOTE (dump `_provenance.captureGaps` — REST-route honesty):
  // the REST mapper (extract/figma/rest/map.ts) stamps one entry per dump
  // channel its surface cannot read (v1.6–v1.13). Surfaced here as ONE note
  // per proposed set, so the absence of those facts reads as a limit of the
  // import route, never as evidence about the design. Plugin dumps and
  // hand-authored fixtures carry no captureGaps → no note, byte-identical
  // output. Deliberately NOT keyed on dumpVersion: the mapper that knows
  // what it cannot read is the only authority.
  const rawGaps = (dump as { _provenance?: { captureGaps?: unknown } })._provenance?.captureGaps;
  const captureGaps = Array.isArray(rawGaps) ? rawGaps.filter((g): g is string => typeof g === 'string') : [];
  const captureGapNote =
    captureGaps.length > 0
      ? `this dump's reader could not see: ${captureGaps.join('; ')} — absence of these facts is a READ limit of the import route, not evidence about the design; re-import via the plugin dump (extract/figma/dump.plugin.js, dump v1.13) to capture them`
      : null;
  // dump v1.2 `_degradations` — capture named a channel it could not carry
  // (Alert VECTOR paths, letter-spacing, …). The batch used to drop the
  // array, so a live plugin dump's receipts vanished on propose
  // (FC-DUMP-PROPOSE-DEGRADATIONS-DROPPED). Attach each receipt to the set
  // its nodePath names (`setName:variant/…`); unmatched rows stay on the
  // batch notes, never silent.
  const rawDegradations = (dump as { _degradations?: unknown })._degradations;
  const degradations = Array.isArray(rawDegradations)
    ? rawDegradations.filter((d): d is { code: string; nodePath: string; message: string } =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as { code?: unknown }).code === 'string' &&
        typeof (d as { nodePath?: unknown }).nodePath === 'string' &&
        typeof (d as { message?: unknown }).message === 'string',
      )
    : [];
  const degradationNote = (d: { code: string; nodePath: string; message: string }): string =>
    `dump ${d.code}: ${d.nodePath} — ${d.message}`;
  for (const [name, value] of Object.entries(dump)) {
    if (name === '_provenance' || !isDumpSet(value)) continue;
    try {
      const proposal = { setName: name, ...proposeFromDump(value, setOpts) };
      attachSiblingStubs(proposal);
      registerSession(proposal.contract as Record<string, unknown>, name);
      for (const stub of proposal.childStubs ?? []) {
        const id = stub.id;
        const fresh = typeof id === 'string' && !contractsById.has(id);
        registerSession(stub as Record<string, unknown>, undefined, true);
        if (fresh && typeof id === 'string') {
          sessionStubs.set(id, { stub, fromSet: name, ...mintSliceFor(importedRefsOf(stub), proposal.mintedTokens) });
        }
      }
      if (captureGapNote) proposal.notes.unshift(captureGapNote);
      const setDegradations = degradations.filter(
        (d) => d.nodePath === name || d.nodePath.startsWith(`${name}:`),
      );
      if (setDegradations.length > 0) {
        proposal.notes.unshift(...setDegradations.map(degradationNote));
      }
      const id = (proposal.contract as { id?: unknown }).id;
      // A set suffixed PAST a sibling of this dump (session-claimed, keys
      // contradict) is the SAME collision the un-suffixed path names below —
      // the batch must say so, not just the suffixed proposal's own notes
      // (CBDS: Phosphor "RadioButton" vs the kit's "Radio button").
      if (typeof id === 'string' && proposal.idSuffixedFrom !== undefined) {
        const holder = claimedIds.get(proposal.idSuffixedFrom);
        if (holder !== undefined) {
          notes.push(
            `contract id "${proposal.idSuffixedFrom}" is claimed by two sets in this dump ("${holder}" and "${name}") — their names sanitize to the same id; "${name}" is proposed as "${id}" (deterministic arrival-order suffix, so neither import rebinds the other's child refs); rename one set (or edit one id) before adopting both`,
          );
        }
      }
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
  const unmatched = degradations.filter(
    (d) =>
      !proposals.some(
        (p) => d.nodePath === p.setName || d.nodePath.startsWith(`${p.setName}:`),
      ),
  );
  if (unmatched.length > 0) notes.push(...unmatched.map(degradationNote));
  return { proposals, skipped, notes };
}
