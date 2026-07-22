/**
 * Brownfield extraction — shared shapes (docs/11, roadmap Phase 2).
 *
 * Every adapter (React/TS, Custom Elements Manifest, future Vue/Svelte/…)
 * normalizes a pre-existing component library into ExtractedComponent[].
 * From there the pipeline is adapter-agnostic: propose.ts turns extractions
 * into ContractSchema-valid PROPOSED contracts, and reconcile.ts joins a
 * code-side extraction with a design-side extraction into the disagreement
 * report — the first artifact a brownfield org gets, before any contract
 * is adopted.
 *
 * Scope discipline (docs/11): extraction targets the differ's scope — the
 * API surface (props, variants, defaults, booleans, text, events) — PLUS,
 * where the source is legible (co-located CSS Module + a JSX tree the
 * adapter can read), a proposed ANATOMY: part tree, token bindings, layout,
 * states. Anatomy stays human-REVIEWED — the proposal carries it so a
 * code-only org gets a contract that can generate a faithful canvas, and
 * every place extraction could not read is reported by name, never guessed
 * (raw CSS values never become invented tokens).
 */

export type PropKind = 'enum' | 'boolean' | 'string' | 'number' | 'node' | 'event' | 'other';

export interface ExtractedProp {
  name: string;
  kind: PropKind;
  /** enum members, for kind 'enum' */
  values?: string[];
  default?: string | number | boolean;
  optional: boolean;
  description?: string;
  /** 'declared' — read directly from source syntax. 'inferred' — a heuristic
   *  filled a gap (e.g. one-hop type-alias resolution). Reconciliation and
   *  the proposal report surface anything below 'declared' for human review. */
  confidence: 'declared' | 'inferred';
}

export interface ExtractedComponent {
  name: string;
  /** file (React) or manifest path (CEM) this was read from */
  source: string;
  adapter: string;
  description?: string;
  /** Named extraction receipts at the component level — e.g. the hollow-
   *  extraction receipt (a props type that resolved with zero members says
   *  WHY) and partial-composition receipts (named refs whose members are
   *  outside module scope). propose.ts carries them into proposal notes. */
  notes?: string[];
  props: ExtractedProp[];
  /** CSS custom properties consumed, when the adapter can see a stylesheet */
  cssVars?: string[];
  /** Proposed anatomy, when the adapter could read structure + styling
   *  (react-tsx with a co-located *.module.css). Absent = stub as before. */
  anatomy?: ExtractedAnatomy;
}

// ---------------------------------------------------------------------------
// Anatomy extraction IR (css-module adapter → propose.ts)
// ---------------------------------------------------------------------------

/** A part in the extracted anatomy tree — the contract Part shape, except
 *  component refs carry the CODE component name (propose.ts maps it to a
 *  contract id under the configured prefix). Token refs are already in
 *  canonical dot form ("{space.inset-x.sm}", "{color.feedback.{variant}.background}"),
 *  resolved against the REAL token tree — never a guessed tokenization. */
export interface ExtractedPart {
  element?: string;
  layout?: {
    display?: 'flex' | 'inline-flex';
    direction?: 'row' | 'column';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'space-between';
    grow?: boolean;
    overlap?: boolean;
  };
  overlay?: { placement: 'top' | 'bottom' | 'start' | 'end' };
  tokens?: Record<string, string>;
  /** Root-level interaction states: state → (css prop → token ref). */
  states?: Record<string, Record<string, string>>;
  content?: { prop: string };
  text?: string;
  animation?: 'spin' | 'pulse';
  slot?: { name: string };
  /** Code component name (e.g. "Avatar") — id-mapped by propose.ts. */
  component?: { name: string; props?: Record<string, string | boolean>; text?: string };
  /** Phase B (Astryx composition tier): the part is a template mapped over an
   *  array prop (`items.map(item => <X/>)`) — the code-side spelling of the
   *  contract's repeat channel. The design-time `sample` is NOT decidable
   *  from code; propose.ts synthesizes a placeholder and says so. */
  repeat?: { itemsProp: string };
  attrs?: Record<string, string>;
  visibleWhen?: { prop: string; equals?: string };
  optional?: boolean;
  parts?: Record<string, ExtractedPart>;
}

/** A literal CSS value extraction refuses to tokenize — reported by name
 *  with nearest-token candidates from the real token tree (by value). */
export interface RawValueFinding {
  selector: string;
  property: string;
  value: string;
  /** Token paths whose resolved $value equals this literal. NEVER applied —
   *  a candidate list for the human, not a decision. */
  candidates: string[];
}

/** Behavior surface read from the code (onClick wiring + toggle pattern),
 *  keyed by event name ("toggle" for onToggle). */
export interface ExtractedEventWiring {
  trigger: string;
  toggles?: { prop: string; between: [string, string]; aria?: string };
  /** Uncontrolled useState default for the toggled prop, when present. */
  uncontrolledDefault?: string;
}

export interface ExtractedAnatomy {
  root: ExtractedPart;
  /** Root host element (→ semantics.element) and ARIA role, when literal. */
  element: string;
  role?: string;
  /** Contract-level states list, from CSS state selectors on the root. */
  states: string[];
  events?: Record<string, ExtractedEventWiring>;
  rawValues: RawValueFinding[];
  /** Named degradation notes — everything seen but not extracted. */
  notes: string[];
  /** Structural capture of every unbindable styled declaration (raw literals
   *  + foreign var()s, each with part/state/axis context) — the input for
   *  OPT-IN provisional minting (core/mint-code.ts). The report channels
   *  above are unchanged; nothing here binds unless a proposer mints. */
  mintables?: import('../core/mint-code.js').CodeMintFinding[];
}

/** A design-side component set, from extract/figma-dump.js or the parity
 *  snapshot. Property names/options are as the design tool spells them. */
export interface DesignComponent {
  name: string;
  variantProps: Record<string, string[]>;
  boolProps: string[];
  textProps: string[];
  swapProps: string[];
}

export interface ExtractConfig {
  code: {
    adapter: 'react-tsx' | 'cem';
    /** react-tsx: directory to scan recursively for components */
    root?: string;
    /** cem: path to custom-elements.json */
    manifest?: string;
  };
  design?: {
    /** Path to a JSON dump produced by extract/figma-dump.js, or the string
     *  "parity-snapshot" to reconcile against parity/snapshots/figma-components.json */
    source: string;
  };
  /** DTCG token files used to referee css var(--x) → token-path bindings
   *  during anatomy extraction (default: this repo's tokens/ layout).
   *  Brownfield orgs point this at THEIR token set — bindings must resolve
   *  against the real tree, never a guessed hyphen→dot split. */
  tokens?: string[];
  /** Contract id prefix for proposals (default "ds") */
  idPrefix?: string;
  /** Output directory (default "extract/out") */
  out?: string;
  diagnose?: {
    /** Directory of adopted/proposed contracts to referee against
     *  (default: "<out>/contracts") */
    contracts?: string;
  };
}

/** THE one rule for function-valued props, shared by the proposer
 *  (extract/propose.ts) and the referee (parity/diagnose.ts): only
 *  `/^on[A-Z]/` callbacks are contract EVENTS. Any other function-valued
 *  prop (render prop, formatter, imperative setter — `formatLabel`,
 *  `renderValue`, `setRef`) is outside the contracted API surface: propose
 *  receipts it ("function-typed but not on* — skipped, review manually")
 *  and diagnose treats it as outside declared scope — NOT [code AHEAD]
 *  drift. Two sides, one classification; the referee never flags the
 *  pipeline's own documented skip. */
export const isEventCallbackName = (name: string): boolean => /^on[A-Z]/.test(name);

export const normalizeName = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const titleCase = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
