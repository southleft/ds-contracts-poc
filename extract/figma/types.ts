/**
 * Design-side node-tree dump format (dump v1) — the shapes produced by
 * extract/figma/dump.plugin.js and consumed by extract/figma/propose.ts.
 *
 * This is the ANATOMY-BEARING counterpart of extract/figma-dump.js (which
 * reads only the API surface). A dump is a per-component-set tree of the
 * canvas facts the extractor can invert: auto-layout geometry, variable
 * bindings, paints, text, and component-property references. Everything the
 * extractor cannot see is a declared fidelity limit, not a guess — see the
 * classification rules in roundtrip.ts.
 *
 * Fixture ground truth: extract/figma/fixtures/main-file-dumps.json (live
 * dumps of the contract-generated Badge / Switch / Card sets).
 */

/** Auto-layout facts, as the Plugin API spells them. */
export interface DumpLayout {
  mode: 'HORIZONTAL' | 'VERTICAL';
  primary: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counter: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  /** Literal itemSpacing (px). The bound variable, if any, is in `bound.itemSpacing`. */
  spacing: number;
  /** Literal padding in CSS order: [top, right, bottom, left]. */
  padding: [number, number, number, number];
  primarySizing: 'FIXED' | 'AUTO';
  counterSizing: 'FIXED' | 'AUTO';
}

/** A solid paint: bound to a variable (`var`, slash-form name) or raw (`hex`). */
export interface DumpPaint {
  var?: string;
  hex?: string;
  /** Effective paint opacity 0–1 (color alpha × paint opacity), dump v1.1,
   *  additive — OMITTED when 1. Field case: Eventz secondary/bare fills are
   *  black at 5% opacity; dump v1 dropped it and every consumer rendered
   *  opaque black. Absence in older dumps means opaque, a declared limit. */
  alpha?: number;
}

export interface DumpText {
  characters: string;
  fontSize: number;
  /** Inter style name ('Medium', 'Semi Bold', …) — the canvas projection of a
   *  font-weight token through FONT_STYLE_BY_WEIGHT. */
  fontStyle: string;
  /** Name of the named TextStyle the node rides, when it rides one — derived
   *  styles mirror semantic size-token paths ('badge' ← font.badge.size,
   *  'control/sm' ← font.control.size.sm), so this is a token identity. */
  style?: string;
  /** Variable behind the text fill (slash-form), when bound. */
  fillVar?: string;
}

/** One visible effect (dump v1.2, additive). Shadows carry their full
 *  geometry + color; blur types carry the type (and radius) only — enough
 *  for propose.ts to NAME the gap instead of losing the channel silently. */
export interface DumpEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR' | string;
  /** Shadow color (shadow types only) — same {hex, alpha} shape as paints. */
  color?: { hex: string; alpha?: number };
  offset?: { x: number; y: number };
  radius?: number;
  /** Omitted when 0. */
  spread?: number;
}

export interface DumpNode {
  name: string;
  type: 'COMPONENT' | 'FRAME' | 'TEXT' | 'INSTANCE' | string;
  layout?: DumpLayout;
  /** Literal corner radius when uniform and nonzero. Bound radii are in `bound`. */
  cornerRadius?: number;
  /** Bound variables: Plugin-API field name → variable name (slash-form),
   *  e.g. { paddingLeft: 'space/inset-x/sm', width: 'size/switch/width' }. */
  bound?: Record<string, string>;
  fill?: DumpPaint;
  stroke?: DumpPaint;
  strokeWeight?: number;
  /** layoutSizingHorizontal === 'FILL' — the canvas projection of both
   *  `layout.grow` (in a row parent) and `align: stretch` (on children of a
   *  column parent); propose.ts disambiguates by parent direction. */
  fillWidth?: boolean;
  /** visible === false on the node (dump v1.1, additive). Positive evidence
   *  only: a visibility-bound part hidden in the default variant recovers a
   *  boolean-prop default of false. Absence means visible (REST mapper) or
   *  not captured (dump v1 fixtures) — never inverted into `true`. */
  hidden?: boolean;
  /** NODE opacity 0–1 (dump v1.2, additive) — OMITTED when 1. Distinct from
   *  paint alpha: Eventz disables whole variants with `opacity: 0.4` on the
   *  variant ROOT while the paints stay byte-identical to enabled; dump v1.1
   *  dropped the channel and every surface rendered disabled at full ink.
   *  Absence in older dumps means opaque, a declared limit. */
  opacity?: number;
  /** VISIBLE effects (dump v1.2, additive) — omitted when none. A single
   *  DROP_SHADOW mints as a box-shadow value; everything else is a NAMED
   *  proposal note. Absence in older dumps means not captured. */
  effects?: DumpEffect[];
  text?: DumpText;
  /** componentPropertyReferences, property-id suffixes stripped:
   *  characters → TEXT property, mainComponent → INSTANCE_SWAP property,
   *  visible → BOOLEAN property (the "Show X" optional-part convention). */
  propRefs?: Record<string, string>;
  /** For INSTANCE nodes: the main component's owning set/component name. */
  instanceOf?: string;
  /** For INSTANCE nodes: applied component property values (dump v1.1,
   *  additive — the shipped fixtures predate it; propose.ts treats absence
   *  as a declared fidelity limit and never invents the values). */
  componentProperties?: Record<string, string | boolean>;
  children?: DumpNode[];
}

export interface DumpSet {
  setName: string;
  type: 'COMPONENT_SET' | 'COMPONENT';
  /** Set-level anchors (dump v1.1, additive). */
  nodeId?: string;
  key?: string;
  /** Each variant's node tree. Variant names carry the axes
   *  ("Variant=Info", "Value=Off, Size=Sm"); a standalone COMPONENT has a
   *  single entry named after the component. Order is the canvas order —
   *  the first variant is the set's default variant. */
  variants: DumpNode[];
}

/** One capture-side degradation receipt (dump v1.2) — the plugin dump's
 *  mirror of extract/figma/rest/map.ts MapDegradation: every channel the
 *  capture reads but cannot carry is NAMED, never dropped silently. */
export interface DumpDegradation {
  code: string;
  /** setName:variant/child/… — same spelling as propose.ts note paths. */
  nodePath: string;
  message: string;
}

export interface DumpFile {
  _provenance?: { fileKey?: string | null; extractedAt?: string | number; note?: string };
  /** dump v1.2, additive — absent in older dumps (their captures were run
   *  before the channel existed; absence means "not receipted", not clean). */
  _degradations?: DumpDegradation[];
  [setName: string]: DumpSet | DumpFile['_provenance'] | DumpDegradation[] | undefined;
}

export const isDumpSet = (v: unknown): v is DumpSet =>
  typeof v === 'object' && v !== null && 'variants' in (v as Record<string, unknown>);
