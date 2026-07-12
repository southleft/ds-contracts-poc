/**
 * REST → dump v1: map a Figma REST API nodes response onto the Plugin-API
 * dump format (extract/figma/types.ts) that extract/figma/propose.ts consumes.
 *
 * This is the no-plugin path: a browser playground fetches
 * GET /v1/files/:key/nodes?ids=… with a user token and gets the same DumpFile
 * the plugin dump script (extract/figma/dump.plugin.js) would have produced —
 * so the SAME proposer, roundtrip comparator, and refusal discipline apply.
 *
 * Pure module: no node builtins, no fetch — browser-safe. Shapes are typed
 * against figma/rest-api-spec (dist/api_types.ts); every consumed field is
 * cited below. Where REST and the Plugin API spell the same canvas fact
 * differently, the mapping is explicit:
 *
 *   REST field                                      dump v1 field
 *   ─────────────────────────────────────────────   ──────────────────────────
 *   layoutMode HORIZONTAL|VERTICAL                  layout.mode (NONE/GRID → no layout block; GRID is a named degradation)
 *   primaryAxisAlignItems (omitted at default)      layout.primary, default MIN
 *   counterAxisAlignItems (omitted at default)      layout.counter, default MIN
 *   itemSpacing (omitted at 0)                      layout.spacing, default 0
 *   paddingTop/Right/Bottom/Left (omitted at 0)     layout.padding [top,right,bottom,left]
 *   primary/counterAxisSizingMode (omitted)         layout.primarySizing/counterSizing, default AUTO
 *   cornerRadius | rectangleCornerRadii[TL,TR,BR,BL] cornerRadius (uniform, nonzero only — dump v1 scope)
 *   fills[].boundVariables.color (VARIABLE_ALIAS)   fill { var: name } via the variables response, else { hex } + degradation;
 *                                                   effective opacity (color.a × paint opacity) rides { alpha } when < 1 (dump v1.1)
 *   strokes[…] (same shape)                         stroke, strokeWeight (literal, only when a stroke is emitted)
 *   boundVariables.size.x / .y                      bound.width / bound.height
 *   boundVariables.individualStrokeWeights.top…     bound.strokeTopWeight / …Right / …Bottom / …Left
 *   boundVariables.rectangleCornerRadii
 *     .RECTANGLE_TOP_LEFT_CORNER_RADIUS…            bound.topLeftRadius / … (spec lists both spellings; both accepted)
 *   boundVariables.paddingLeft/itemSpacing/…        bound.<same name> (plugin spelling ≡ REST spelling here)
 *   layoutSizingHorizontal === 'FILL'               fillWidth: true
 *   visible === false                               hidden: true (dump v1.1 — visibility-bound parts recover boolean defaults from it)
 *   opacity (omitted at 1)                          opacity (dump v1.2 — NODE opacity, distinct from paint alpha)
 *   effects[] (visible)                             effects (dump v1.2 — shadows with geometry+color; blur types by name)
 *   characters + style{fontSize,fontWeight}         text.characters / .fontSize / .fontStyle
 *     (fontWeight → Inter style name via the generator's FONT_STYLE_BY_WEIGHT)
 *   node.styles.text → styles metadata map          text.style (name), else omitted + degradation
 *   componentPropertyReferences ("Label#1:0")       propRefs { kind: name-without-#suffix }
 *   componentId → components/componentSets maps     instanceOf (owning set name, else component name)
 *   componentProperties (non-INSTANCE_SWAP)         componentProperties (dump v1.1, additive)
 *   REGULAR_POLYGON | ELLIPSE | rotated RECTANGLE   shape (dump v1.3, #42 — kind, intrinsic size, CSS-degrees rotation,
 *     + absoluteBoundingBox/rotation/constraints      ABSOLUTE placement offsets vs the parent box); VECTOR/STAR/LINE/
 *                                                     BOOLEAN_OPERATION stay named receipts (arbitrary paths)
 *   style.lineHeightPx (lineHeightUnit PIXELS)      text.lineHeight (dump v1.3; non-pixel units stay receipts)
 *   INSTANCE children                               NOT recursed — instance internals belong to the child contract
 *   components[componentId].key /                   instanceKey / instanceSetKey (dump v1.5 — rename-safe identity
 *     componentSets[setId].key                        the session-linking resolver matches against contract anchors)
 *   INSTANCE absoluteBoundingBox                    bbox { width, height } (dump v1.5 — observed geometry for child stubs)
 *   componentPropertyDefinitions INSTANCE_SWAP      set.swapPreferredValues (dump v1.5 — keys → slot `accepts` downstream)
 *     .preferredValues
 *   componentPropertyDefinitions BOOLEAN            set.boolDefaults (dump v1.5 — visibility-bound boolean prop defaults)
 *     .defaultValue
 *   SLOT documents (native slots, Schema 2025)      carried verbatim (type 'SLOT') — propose maps them to slot parts
 *
 * Refusals are receipts, not silence: every place the REST surface cannot
 * yield the dump fact lands in MapReport.degradations with a named code and
 * the exact reason (e.g. a variable id that cannot be resolved because the
 * variables endpoint is Enterprise-only). Nothing is invented.
 */
import type { DumpEffect, DumpFile, DumpLayout, DumpNode, DumpPaint, DumpPreferredValue, DumpSet, DumpShape, DumpText } from '../types.js';

// ---------------------------------------------------------------------------
// REST shapes (trimmed to the consumed fields; figma/rest-api-spec names)
// ---------------------------------------------------------------------------

export interface RestVariableAlias {
  type: 'VARIABLE_ALIAS';
  id: string;
}

/** SolidPaint & BasePaint (api_types.ts): color channels are 0–1 floats. */
export interface RestPaint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a: number };
  boundVariables?: { color?: RestVariableAlias };
}

/** TypeStyle / BaseTypeStyle (api_types.ts). */
export interface RestTypeStyle {
  fontFamily?: string;
  fontPostScriptName?: string | null;
  fontWeight?: number;
  fontSize?: number;
  fontStyle?: string;
  italic?: boolean;
  // Read ONLY to name their loss (dump v1 has no projection for them):
  letterSpacing?: number;
  textCase?: string;
  textDecoration?: string;
  lineHeightUnit?: string;
  lineHeightPx?: number;
}

/** HasBoundVariablesTrait (api_types.ts) — the spellings that differ from the
 *  Plugin API are named; everything else is a flat field → alias map. */
export interface RestBoundVariables {
  size?: { x?: RestVariableAlias; y?: RestVariableAlias };
  individualStrokeWeights?: {
    top?: RestVariableAlias;
    bottom?: RestVariableAlias;
    left?: RestVariableAlias;
    right?: RestVariableAlias;
  };
  rectangleCornerRadii?: {
    RECTANGLE_TOP_LEFT_CORNER_RADIUS?: RestVariableAlias;
    RECTANGLE_TOP_RIGHT_CORNER_RADIUS?: RestVariableAlias;
    RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS?: RestVariableAlias;
    RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS?: RestVariableAlias;
  };
  [field: string]:
    | RestVariableAlias
    | RestVariableAlias[]
    | Record<string, RestVariableAlias | undefined>
    | undefined;
}

/** Effect (api_types.ts), trimmed to the consumed fields. */
export interface RestEffect {
  type: string;
  visible?: boolean;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

/** ComponentProperty (api_types.ts) — applied values on an INSTANCE. */
export interface RestComponentProperty {
  type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT' | 'VARIANT';
  value: boolean | string;
}

/** ComponentPropertyDefinition (api_types.ts) — set-level definitions; only
 *  INSTANCE_SWAP preferredValues are consumed (dump v1.5). */
export interface RestComponentPropertyDefinition {
  type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT' | 'VARIANT';
  defaultValue?: boolean | string;
  preferredValues?: Array<{ type: string; key: string }>;
}

export interface RestNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  /** NODE opacity 0–1 (omitted at 1) — dump v1.2 `opacity`. */
  opacity?: number;
  children?: RestNode[];
  // HasFramePropertiesTrait
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // CornerTrait
  cornerRadius?: number;
  /** [top-left, top-right, bottom-right, bottom-left] per api_types.ts. */
  rectangleCornerRadii?: number[];
  // MinimalFillsTrait / MinimalStrokesTrait
  fills?: RestPaint[];
  strokes?: RestPaint[];
  strokeWeight?: number;
  /** StyleType → style id; names live in the response's styles metadata map. */
  styles?: Record<string, string>;
  // HasEffectsTrait
  effects?: RestEffect[];
  // HasLayoutTrait
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  // TypePropertiesTrait
  characters?: string;
  style?: RestTypeStyle;
  // IsLayerTrait
  componentPropertyReferences?: Record<string, string>;
  boundVariables?: RestBoundVariables;
  // Decor-shape geometry (dump v1.3, #42): the post-rotation axis-aligned
  // box, radians rotation, out-of-flow marker + constraints.
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  layoutPositioning?: 'AUTO' | 'ABSOLUTE';
  constraints?: { vertical: string; horizontal: string };
  // Channels read ONLY to name their loss (STYLE-FIDELITY audit, dump v1.2):
  blendMode?: string;
  rotation?: number;
  strokeAlign?: string;
  strokeDashes?: number[];
  individualStrokeWeights?: { top?: number; right?: number; bottom?: number; left?: number };
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  // InstanceNode
  componentId?: string;
  componentProperties?: Record<string, RestComponentProperty>;
  // COMPONENT_SET / COMPONENT documents (dump v1.5): swap preferredValues.
  componentPropertyDefinitions?: Record<string, RestComponentPropertyDefinition>;
}

/** GetFileNodesResponse (api_types.ts), trimmed. */
export interface RestNodesResponse {
  name?: string;
  nodes: Record<
    string,
    {
      document: RestNode;
      components?: Record<string, { name: string; componentSetId?: string; key?: string }>;
      componentSets?: Record<string, { name: string; key?: string }>;
      styles?: Record<string, { name: string; styleType?: string }>;
    } | null
  >;
}

/** GetLocalVariablesResponse (api_types.ts), trimmed to id → name. */
export interface RestVariablesResponse {
  meta?: { variables?: Record<string, { id?: string; name: string }> };
}

// ---------------------------------------------------------------------------
// Map report — the receipt of everything the REST surface could not yield
// ---------------------------------------------------------------------------

export type MapDegradationCode =
  | 'variable-unresolved'
  | 'text-style-unresolved'
  | 'instance-main-unresolved'
  // 'paint-alpha-dropped' retired in dump v1.1: solid-paint opacity is
  // CAPTURED ({ hex, alpha }) instead of degraded away.
  | 'paint-unsupported'
  | 'layout-grid-unsupported'
  | 'radii-nonuniform'
  // dump v1.2 (STYLE-FIDELITY audit): every channel the capture reads but
  // cannot carry is a RECEIPT now — the silent-loss census hit zero.
  | 'paint-stack-truncated'
  | 'stroke-weights-nonuniform'
  | 'stroke-style-unsupported'
  | 'blend-mode-unsupported'
  | 'rotation-unsupported'
  | 'vector-geometry-unsupported'
  // 'min-max-size-unsupported' retired in dump v1.4: literal min/max sizing
  // is CARRIED (minWidth/minHeight/maxWidth/maxHeight style facts) instead
  // of degraded away.
  | 'text-channel-unsupported';

export interface MapDegradation {
  code: MapDegradationCode;
  /** setName:variant/child/… — same spelling as propose.ts note paths. */
  nodePath: string;
  field?: string;
  message: string;
}

export interface MapReport {
  fileName?: string;
  sets: string[];
  degradations: MapDegradation[];
  notes: string[];
}

export interface MapOptions {
  /** GET /v1/files/:key/variables/local response (Enterprise-only). Absent →
   *  bound facts degrade to resolved literals, each named in the report. */
  variables?: RestVariablesResponse;
  /** Extra style-id → name map (e.g. from GET /v1/files/:key/styles). The
   *  nodes response's own styles metadata is always consulted first. */
  styles?: Record<string, { name: string } | string>;
  /** Only map the set/component with this name. */
  target?: string;
  /** File key for _provenance (it rides the URL, not the nodes response). */
  fileKey?: string | null;
}

/** dump v1.1 node as the REST mapper emits it (`hidden` lives on DumpNode
 *  itself since dump v1.1 — the alias survives for existing importers). */
export interface RestDumpNode extends DumpNode {
  children?: RestDumpNode[];
}

export interface MapResult {
  dump: DumpFile;
  report: MapReport;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Mirror of dump.plugin.js rgbToHex: 0–1 channels → lowercase rrggbb. */
const rgbToHex = (c: { r: number; g: number; b: number }): string => {
  const h = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return h(c.r) + h(c.g) + h(c.b);
};

/** The generator's weight → Inter style projection (scripts/generate-figma.ts
 *  FONT_STYLE_BY_WEIGHT, re-declared here to keep this module browser-pure —
 *  extract/figma/tokens.ts exports the same table but imports node:fs). */
const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
};

const isAlias = (v: unknown): v is RestVariableAlias =>
  typeof v === 'object' && v !== null && (v as RestVariableAlias).type === 'VARIABLE_ALIAS';

interface Ctx {
  varNameById: Map<string, string>;
  styleNameById: Map<string, string>;
  components: Map<string, { name: string; componentSetId?: string; key?: string }>;
  componentSets: Map<string, { name: string; key?: string }>;
  report: MapReport;
}

const variableUnresolvedMessage = (id: string): string =>
  `variable id ${id} unresolvable — variables endpoint unavailable (Enterprise) or not provided; resolved value used`;

function resolveVarName(ctx: Ctx, alias: RestVariableAlias, nodePath: string, field: string): string | undefined {
  const name = ctx.varNameById.get(alias.id);
  if (name !== undefined) return name;
  ctx.report.degradations.push({
    code: 'variable-unresolved',
    nodePath,
    field,
    message: variableUnresolvedMessage(alias.id),
  });
  return undefined;
}

// ---------------------------------------------------------------------------
// Paints
// ---------------------------------------------------------------------------

/** First visible solid paint → { var } | { hex } | undefined — the exact
 *  selection rule of dump.plugin.js dumpPaint. A bound paint whose variable
 *  cannot be named degrades to its resolved hex (named in the report). The
 *  paint's effective opacity (color alpha × paint opacity) rides `alpha`
 *  when < 1 (dump v1.1 — the Eventz 5%-black fills that dump v1 rendered
 *  opaque; no degradation entry, the fact is CAPTURED now). */
function mapPaint(
  paints: RestPaint[] | undefined,
  ctx: Ctx,
  nodePath: string,
  paintField: 'fill' | 'stroke',
): DumpPaint | undefined {
  if (!Array.isArray(paints)) return undefined;
  const visibles = paints.filter((x) => x.visible !== false);
  const p = visibles.find((x) => x.type === 'SOLID');
  if (!p) {
    const visible = visibles[0];
    if (visible) {
      ctx.report.degradations.push({
        code: 'paint-unsupported',
        nodePath,
        field: paintField,
        message: `first visible paint is ${visible.type}, not SOLID — dump v1 carries solid paints only; paint omitted`,
      });
    }
    return undefined;
  }
  // dump v1.2: a paint STACK (or a non-solid layer alongside the captured
  // solid) is truncated to the first solid — named, never silent.
  const extra = visibles.filter((x) => x !== p);
  if (extra.length > 0) {
    ctx.report.degradations.push({
      code: 'paint-stack-truncated',
      nodePath,
      field: paintField,
      message: `${visibles.length} visible ${paintField} paints (${visibles.map((x) => x.type).join(', ')}) — dump v1 carries the first SOLID only; ${extra.length} paint(s) dropped`,
    });
  }
  const effectiveAlpha = (p.color?.a ?? 1) * (p.opacity ?? 1);
  const withAlpha = (paint: DumpPaint): DumpPaint =>
    effectiveAlpha < 1 ? { ...paint, alpha: Math.round(effectiveAlpha * 10000) / 10000 } : paint;
  const alias = p.boundVariables?.color;
  if (alias && isAlias(alias)) {
    const name = resolveVarName(ctx, alias, nodePath, paintField);
    if (name) return withAlpha({ var: name });
    // fall through: resolved value, already named as a degradation
  }
  if (!p.color) return undefined;
  return withAlpha({ hex: rgbToHex(p.color) });
}

// ---------------------------------------------------------------------------
// Bound variables: REST spellings → Plugin-API spellings
// ---------------------------------------------------------------------------

/** Nested REST boundVariables groups → the flat Plugin-API field names the
 *  dump (and propose.ts) speak. */
const NESTED_BOUND_FIELDS: Record<string, Record<string, string>> = {
  size: { x: 'width', y: 'height' },
  individualStrokeWeights: {
    top: 'strokeTopWeight',
    right: 'strokeRightWeight',
    bottom: 'strokeBottomWeight',
    left: 'strokeLeftWeight',
  },
  rectangleCornerRadii: {
    RECTANGLE_TOP_LEFT_CORNER_RADIUS: 'topLeftRadius',
    RECTANGLE_TOP_RIGHT_CORNER_RADIUS: 'topRightRadius',
    RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS: 'bottomLeftRadius',
    RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS: 'bottomRightRadius',
  },
};

/** Paint/text bindings ride fill/stroke/text in dump v1, not `bound`. */
const BOUND_FIELDS_SKIPPED = new Set(['fills', 'strokes', 'characters', 'textRangeFills', 'componentProperties', 'effects', 'layoutGrids']);

function mapBound(node: RestNode, ctx: Ctx, nodePath: string): Record<string, string> | undefined {
  const bound: Record<string, string> = {};
  for (const [field, value] of Object.entries(node.boundVariables ?? {})) {
    if (value === undefined || BOUND_FIELDS_SKIPPED.has(field)) continue;
    const nested = NESTED_BOUND_FIELDS[field];
    if (nested) {
      for (const [key, dumpField] of Object.entries(nested)) {
        const alias = (value as Record<string, RestVariableAlias | undefined>)[key];
        if (!alias || !isAlias(alias)) continue;
        const name = resolveVarName(ctx, alias, nodePath, dumpField);
        if (name) bound[dumpField] = name;
      }
      continue;
    }
    if (Array.isArray(value) || !isAlias(value)) continue; // multi-alias fields ride their own dump channels
    const name = resolveVarName(ctx, value, nodePath, field);
    if (name) bound[field] = name;
  }
  return Object.keys(bound).length > 0 ? bound : undefined;
}

// ---------------------------------------------------------------------------
// Node mapping
// ---------------------------------------------------------------------------

function mapLayout(node: RestNode, ctx: Ctx, nodePath: string): DumpLayout | undefined {
  const mode = node.layoutMode;
  if (mode === undefined || mode === 'NONE') return undefined;
  if (mode === 'GRID') {
    ctx.report.degradations.push({
      code: 'layout-grid-unsupported',
      nodePath,
      message: 'layoutMode GRID has no dump v1 projection — no layout block emitted; anatomy under it is order-only',
    });
    return undefined;
  }
  // REST omits fields at their defaults; the defaults below are the spec's.
  return {
    mode,
    primary: node.primaryAxisAlignItems ?? 'MIN',
    counter: node.counterAxisAlignItems ?? 'MIN',
    spacing: node.itemSpacing ?? 0,
    padding: [node.paddingTop ?? 0, node.paddingRight ?? 0, node.paddingBottom ?? 0, node.paddingLeft ?? 0],
    primarySizing: node.primaryAxisSizingMode ?? 'AUTO',
    counterSizing: node.counterAxisSizingMode ?? 'AUTO',
  };
}

/** Uniform nonzero radius or nothing — dump v1's corner vocabulary.
 *  rectangleCornerRadii order per spec: [top-left, top-right, bottom-right,
 *  bottom-left]. */
function mapCornerRadius(node: RestNode, ctx: Ctx, nodePath: string): number | undefined {
  const radii = node.rectangleCornerRadii;
  if (Array.isArray(radii) && radii.length === 4) {
    if (radii.every((r) => r === radii[0])) return radii[0] !== 0 ? radii[0] : undefined;
    ctx.report.degradations.push({
      code: 'radii-nonuniform',
      nodePath,
      message: `rectangleCornerRadii [${radii.join(', ')}] are not uniform — dump v1 carries a uniform radius only; omitted`,
    });
    return undefined;
  }
  if (typeof node.cornerRadius === 'number' && node.cornerRadius !== 0) return node.cornerRadius;
  return undefined;
}

function mapText(node: RestNode, ctx: Ctx, nodePath: string): DumpText {
  const s = node.style ?? {};
  let fontStyle: string | undefined =
    s.fontWeight !== undefined ? FONT_STYLE_BY_WEIGHT[s.fontWeight] : undefined;
  if (fontStyle === undefined) {
    // Outside the generator's four weights: fall back to REST's own style
    // string — propose.ts will report the non-derived typography, not guess.
    fontStyle = s.fontStyle ?? 'Regular';
    ctx.report.notes.push(
      `${nodePath}: fontWeight ${s.fontWeight ?? '(absent)'} is outside the generator's weight table — fontStyle "${fontStyle}" passed through`,
    );
  }
  const text: DumpText = {
    characters: node.characters ?? '',
    fontSize: s.fontSize ?? 0,
    fontStyle,
  };
  // dump v1.3: PIXEL line heights are CAPTURED (text.lineHeight); other
  // explicit units stay receipts below.
  if (s.lineHeightUnit === 'PIXELS' && typeof s.lineHeightPx === 'number') {
    text.lineHeight = s.lineHeightPx;
  }
  // dump v1.2: text channels with no dump projection are NAMED per node.
  const channels: string[] = [];
  if (typeof s.letterSpacing === 'number' && s.letterSpacing !== 0) channels.push(`letterSpacing ${s.letterSpacing}`);
  if (s.textCase !== undefined && s.textCase !== 'ORIGINAL') channels.push(`textCase ${s.textCase}`);
  if (s.textDecoration !== undefined && s.textDecoration !== 'NONE') channels.push(`textDecoration ${s.textDecoration}`);
  if (s.lineHeightUnit !== undefined && s.lineHeightUnit !== 'INTRINSIC_%' && s.lineHeightUnit !== 'PIXELS') {
    channels.push(`lineHeight ${s.lineHeightPx ?? '?'}px (${s.lineHeightUnit} — only PIXELS carries, dump v1.3)`);
  }
  if (channels.length > 0) {
    ctx.report.degradations.push({
      code: 'text-channel-unsupported',
      nodePath,
      field: 'text',
      message: `text channel(s) with no dump v1 projection: ${channels.join('; ')} — typography carries (fontSize, fontStyle, style identity) only`,
    });
  }
  const styleId = node.styles?.text ?? node.styles?.TEXT;
  if (styleId) {
    const name = ctx.styleNameById.get(styleId);
    if (name) text.style = name;
    else {
      ctx.report.degradations.push({
        code: 'text-style-unresolved',
        nodePath,
        field: 'text.style',
        message: `text style id ${styleId} has no name in the styles map — style identity omitted; typography falls back to (fontSize, fontStyle) matching`,
      });
    }
  }
  return text;
}

function mapPropRefs(node: RestNode): Record<string, string> | undefined {
  const propRefs: Record<string, string> = {};
  for (const [kind, key] of Object.entries(node.componentPropertyReferences ?? {})) {
    if (key) propRefs[kind] = key.split('#')[0];
  }
  return Object.keys(propRefs).length > 0 ? propRefs : undefined;
}

/** Arbitrary-path vector types with NO parametric projection — still #42
 *  receipts. REGULAR_POLYGON / ELLIPSE / rotated RECTANGLE are CARRIED since
 *  dump v1.3 (see mapShape) and are deliberately not in this set. */
const VECTOR_TYPES = new Set(['VECTOR', 'STAR', 'POLYGON', 'LINE', 'BOOLEAN_OPERATION']);

/** Node types whose geometry is parametric — carried as DumpShape (dump
 *  v1.3, #42). A RECTANGLE joins only when rotated (an unrotated rectangle
 *  is an ordinary box; the existing box channels speak for it). */
const SHAPE_KIND_BY_TYPE: Record<string, DumpShape['kind']> = {
  REGULAR_POLYGON: 'polygon',
  ELLIPSE: 'ellipse',
  RECTANGLE: 'rect',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** REST `rotation` rides RADIANS whose sign matches CSS clockwise rotation
 *  (verified against absoluteRenderBounds on the CBDS Tooltip pointers:
 *  -π/2 points the triangle apex WEST, +π/2 EAST, π SOUTH). */
const restRotationToCssDeg = (rad: number | undefined): number =>
  round2(((rad ?? 0) * 180) / Math.PI);

/**
 * Decor-shape capture (dump v1.3, #42): REGULAR_POLYGON / ELLIPSE / rotated
 * RECTANGLE → { kind, width, height, rotation, placement }. REST gives only
 * the POST-rotation bounding box; quarter-turn rotations derive the intrinsic
 * size exactly (±90° swaps the axes), anything else approximates by the box
 * and is RECEIPTED. Placement (x/y/right/bottom + constraints) is captured
 * only for out-of-flow nodes (layoutPositioning ABSOLUTE) with a known
 * parent box. The polygon side count is not on the REST surface — absent
 * means not captured (the plugin dump carries pointCount).
 */
function mapShape(
  node: RestNode,
  ctx: Ctx,
  nodePath: string,
  parentBox: { x: number; y: number; width: number; height: number } | null,
): DumpShape | undefined {
  const kind = SHAPE_KIND_BY_TYPE[node.type];
  if (kind === undefined) return undefined;
  const rotation = restRotationToCssDeg(node.rotation);
  if (kind === 'rect' && rotation === 0) return undefined; // ordinary box — existing channels
  const box = node.absoluteBoundingBox;
  if (!box) {
    ctx.report.degradations.push({
      code: 'vector-geometry-unsupported',
      nodePath,
      message: `${node.type} carries no absoluteBoundingBox — shape geometry not capturable (#42); the node carries paints only and renders as a box`,
    });
    return undefined;
  }
  const nearestQuarter = Math.round(rotation / 90);
  const quarter = Math.abs(rotation - nearestQuarter * 90) < 0.05;
  const swapped = quarter && nearestQuarter % 2 !== 0;
  if (!quarter) {
    ctx.report.degradations.push({
      code: 'rotation-unsupported',
      nodePath,
      message: `rotation ${rotation}° is not a quarter turn — the intrinsic size is not derivable from the REST bounding box; shape size approximated by the post-rotation box (#42 residue)`,
    });
  }
  const width = round2(swapped ? box.height : box.width);
  const height = round2(swapped ? box.width : box.height);
  const shape: DumpShape = { kind, width, height };
  if (rotation !== 0) shape.rotation = rotation;
  if (node.layoutPositioning === 'ABSOLUTE' && parentBox) {
    // Center-preserving intrinsic top-left: rotating the intrinsic box about
    // its center reproduces the captured bounding box exactly.
    const cx = box.x - parentBox.x + box.width / 2;
    const cy = box.y - parentBox.y + box.height / 2;
    shape.x = round2(cx - width / 2);
    shape.y = round2(cy - height / 2);
    shape.right = round2(parentBox.width - cx - width / 2);
    shape.bottom = round2(parentBox.height - cy - height / 2);
    if (node.constraints) {
      shape.constraints = { horizontal: node.constraints.horizontal, vertical: node.constraints.vertical };
    }
  }
  return shape;
}

/** Channels a node can carry that dump v1.2 still has NO projection for —
 *  each becomes a degradation receipt (STYLE-FIDELITY audit: zero silence). */
function nameUnsupportedChannels(node: RestNode, ctx: Ctx, nodePath: string, strokeEmitted: boolean, shapeCarried: boolean) {
  if (node.blendMode !== undefined && node.blendMode !== 'NORMAL' && node.blendMode !== 'PASS_THROUGH') {
    ctx.report.degradations.push({
      code: 'blend-mode-unsupported',
      nodePath,
      message: `blendMode ${node.blendMode} has no dump v1 projection — node renders as NORMAL`,
    });
  }
  // Rotation RIDES the shape channel since dump v1.3 (quarter turns exactly;
  // non-quarter turns receipt inside mapShape) — only a rotated node OUTSIDE
  // the shape vocabulary is still a receipt.
  if (!shapeCarried && typeof node.rotation === 'number' && Math.abs(node.rotation) > 1e-6) {
    ctx.report.degradations.push({
      code: 'rotation-unsupported',
      nodePath,
      message: `rotation ${node.rotation} on a ${node.type} has no dump projection (rotation is carried only on shape decor — dump v1.3) — node renders unrotated (#42 residue)`,
    });
  }
  if (VECTOR_TYPES.has(node.type)) {
    ctx.report.degradations.push({
      code: 'vector-geometry-unsupported',
      nodePath,
      message: `${node.type} geometry (arbitrary paths) is not captured — parametric decor (REGULAR_POLYGON/ELLIPSE/rotated RECTANGLE) IS carried since dump v1.3; this node carries paints only and renders as a box (#42 residue)`,
    });
  }
  // Stroke DETAIL on an INSTANCE is elided by design downstream (instance
  // styling belongs to the child contract; the Slot utility's dashed border
  // is the utility's own) — no receipt needed for a channel that is
  // deliberately not consumed.
  const strokeDetail = strokeEmitted && node.type !== 'INSTANCE';
  const w = node.individualStrokeWeights;
  if (w && node.type !== 'INSTANCE') {
    const values = [w.top ?? 0, w.right ?? 0, w.bottom ?? 0, w.left ?? 0];
    if (new Set(values).size > 1) {
      ctx.report.degradations.push({
        code: 'stroke-weights-nonuniform',
        nodePath,
        message: `per-side stroke weights [${values.join(', ')}] — dump v1 carries a uniform strokeWeight only; per-side weights dropped`,
      });
    }
  }
  if (strokeDetail && Array.isArray(node.strokeDashes) && node.strokeDashes.length > 0) {
    ctx.report.degradations.push({
      code: 'stroke-style-unsupported',
      nodePath,
      message: `strokeDashes [${node.strokeDashes.join(', ')}] — dashed strokes have no dump v1 projection; stroke renders solid`,
    });
  }
  if (strokeDetail && node.strokeAlign !== undefined && node.strokeAlign !== 'INSIDE') {
    ctx.report.degradations.push({
      code: 'stroke-style-unsupported',
      nodePath,
      message: `strokeAlign ${node.strokeAlign} — dump consumers render INSIDE strokes (CSS borders); alignment dropped`,
    });
  }
  // Literal min/max sizing is CARRIED since dump v1.4 (mapNode) — no receipt.
}

function mapNode(
  node: RestNode,
  ctx: Ctx,
  nodePath: string,
  parentBox: { x: number; y: number; width: number; height: number } | null = null,
): RestDumpNode {
  const out: RestDumpNode = { name: node.name, type: node.type };

  // dump v1.5: variant-ROOT observed bounding box — the drawn dimension of a
  // FIXED root axis is otherwise unrecoverable (CBDS Dialog field case).
  if (node.type === 'COMPONENT' && node.absoluteBoundingBox) {
    out.bbox = { width: round2(node.absoluteBoundingBox.width), height: round2(node.absoluteBoundingBox.height) };
  }

  const layout = mapLayout(node, ctx, nodePath);
  if (layout) out.layout = layout;
  const cornerRadius = mapCornerRadius(node, ctx, nodePath);
  if (cornerRadius !== undefined) out.cornerRadius = cornerRadius;
  const bound = mapBound(node, ctx, nodePath);
  if (bound) out.bound = bound;

  const fill = mapPaint(node.fills, ctx, nodePath, 'fill');
  if (fill && node.type !== 'TEXT') out.fill = fill;
  const stroke = mapPaint(node.strokes, ctx, nodePath, 'stroke');
  if (stroke) {
    out.stroke = stroke;
    if (typeof node.strokeWeight === 'number') out.strokeWeight = node.strokeWeight;
  }
  const shape = mapShape(node, ctx, nodePath, parentBox);
  if (shape) out.shape = shape;
  nameUnsupportedChannels(node, ctx, nodePath, stroke !== undefined, shape !== undefined);
  // dump v1.4: literal min/max sizing carries as style facts (a drawn
  // minHeight 44 is a tap-target fact) — previously a named degradation.
  if (typeof node.minWidth === 'number') out.minWidth = node.minWidth;
  if (typeof node.minHeight === 'number') out.minHeight = node.minHeight;
  if (typeof node.maxWidth === 'number') out.maxWidth = node.maxWidth;
  if (typeof node.maxHeight === 'number') out.maxHeight = node.maxHeight;
  if (node.layoutSizingHorizontal === 'FILL') out.fillWidth = true;
  if (node.visible === false) out.hidden = true;
  // dump v1.2: NODE opacity (distinct from paint alpha) — the disabled-variant
  // wash-out channel (Eventz roots at opacity 0.4). Omitted when 1.
  if (typeof node.opacity === 'number' && node.opacity < 1) {
    out.opacity = Math.round(node.opacity * 10000) / 10000;
  }
  // dump v1.2: VISIBLE effects — shadows with geometry + color; blur types
  // by name only (propose.ts names the gap; nothing is lost silently).
  const effects: DumpEffect[] = [];
  for (const e of node.effects ?? []) {
    if (e.visible === false) continue;
    if ((e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && e.color && e.offset) {
      const alpha = e.color.a ?? 1;
      const eff: DumpEffect = {
        type: e.type,
        color: alpha < 1 ? { hex: rgbToHex(e.color), alpha: Math.round(alpha * 10000) / 10000 } : { hex: rgbToHex(e.color) },
        offset: { x: e.offset.x, y: e.offset.y },
        radius: e.radius ?? 0,
      };
      if (typeof e.spread === 'number' && e.spread !== 0) eff.spread = e.spread;
      effects.push(eff);
    } else {
      effects.push(typeof e.radius === 'number' ? { type: e.type, radius: e.radius } : { type: e.type });
    }
  }
  if (effects.length > 0) out.effects = effects;

  if (node.type === 'TEXT') {
    out.text = mapText(node, ctx, nodePath);
    if (fill) {
      out.fill = fill;
      if (fill.var) out.text.fillVar = fill.var;
    }
  }

  const propRefs = mapPropRefs(node);
  if (propRefs) out.propRefs = propRefs;

  if (node.type === 'INSTANCE') {
    const componentId = node.componentId;
    const component = componentId ? ctx.components.get(componentId) : undefined;
    if (component) {
      const owningSet = component.componentSetId ? ctx.componentSets.get(component.componentSetId) : undefined;
      out.instanceOf = owningSet?.name ?? component.name;
      // dump v1.5: rename-safe identity — the main component's publish key
      // and its owning set's key, straight off the response metadata maps.
      if (component.key) out.instanceKey = component.key;
      if (owningSet?.key) out.instanceSetKey = owningSet.key;
    } else {
      ctx.report.degradations.push({
        code: 'instance-main-unresolved',
        nodePath,
        field: 'instanceOf',
        message: `componentId ${componentId ?? '(absent)'} has no entry in the response's components map — instanceOf omitted; propose.ts falls back to the node name`,
      });
    }
    const props: Record<string, string | boolean> = {};
    for (const [key, def] of Object.entries(node.componentProperties ?? {})) {
      if (def.type === 'INSTANCE_SWAP') continue; // slots ride propRefs instead
      // dump v1.5: keys keep their "#id" suffix (the Plugin API's own
      // spelling). A suffixed string key is a TEXT property WITH CERTAINTY —
      // stripping it (dump v1.1) collapsed TEXT and VARIANT properties into
      // one ambiguous shape and every stub modeled its label as an enum.
      props[key] = def.value;
    }
    if (Object.keys(props).length > 0) out.componentProperties = props;
    // dump v1.5: the OBSERVED bounding box — the honest geometry a child STUB
    // renders when the child contract is out of scope (dump v1 still never
    // recurses into instance internals).
    const box = node.absoluteBoundingBox;
    if (box) out.bbox = { width: round2(box.width), height: round2(box.height) };
    return out; // instance internals belong to the child contract — no children
  }

  if (Array.isArray(node.children)) {
    out.children = node.children.map((child) =>
      mapNode(child, ctx, `${nodePath}/${child.name}`, node.absoluteBoundingBox ?? null),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Whole-response mapping
// ---------------------------------------------------------------------------

export function mapRestToDump(nodesResponse: RestNodesResponse, options: MapOptions = {}): MapResult {
  const report: MapReport = { fileName: nodesResponse.name, sets: [], degradations: [], notes: [] };

  const varNameById = new Map<string, string>();
  for (const [id, v] of Object.entries(options.variables?.meta?.variables ?? {})) {
    varNameById.set(v.id ?? id, v.name);
  }

  const dump: DumpFile = {
    _provenance: {
      fileKey: options.fileKey ?? null,
      extractedAt: new Date().toISOString().slice(0, 10),
      note: 'Node-tree dump mapped from the Figma REST API (extract/figma/rest/map.ts, dump v1.5) for design→contract proposal.',
      dumpVersion: '1.5',
    },
  };

  for (const entry of Object.values(nodesResponse.nodes ?? {})) {
    if (!entry) continue; // REST returns null for ids not in the file
    const doc = entry.document;
    if (doc.type !== 'COMPONENT_SET' && doc.type !== 'COMPONENT') {
      report.notes.push(
        `node ${doc.id} "${doc.name}" is a ${doc.type}, not a COMPONENT_SET or COMPONENT — skipped (target a set or component node-id)`,
      );
      continue;
    }
    if (doc.name === 'Slot') continue; // utility, never a contract component (dump.plugin.js rule)
    if (options.target && doc.name !== options.target) continue;

    const styleNameById = new Map<string, string>();
    for (const [id, s] of Object.entries(entry.styles ?? {})) styleNameById.set(id, s.name);
    for (const [id, s] of Object.entries(options.styles ?? {})) {
      styleNameById.set(id, typeof s === 'string' ? s : s.name);
    }
    const ctx: Ctx = {
      varNameById,
      styleNameById,
      components: new Map(Object.entries(entry.components ?? {})),
      componentSets: new Map(Object.entries(entry.componentSets ?? {})),
      report,
    };

    const variants: RestDumpNode[] =
      doc.type === 'COMPONENT_SET'
        ? (doc.children ?? []).map((variant) => mapNode(variant, ctx, `${doc.name}:${variant.name}`))
        : [mapNode(doc, ctx, `${doc.name}:${doc.name}`)];

    // The set's own publish key rides the response metadata when the set is
    // referenced there; absent is a null anchor, never a guess.
    const key =
      (entry.componentSets?.[doc.id] as { key?: string } | undefined)?.key ??
      (entry.components?.[doc.id] as { key?: string } | undefined)?.key;
    // dump v1.5: INSTANCE_SWAP preferredValues, keyed by suffix-stripped
    // property name — the component keys resolve downstream into slot
    // `accepts` (unresolvable keys stay named notes, never guessed ids).
    const swapPreferredValues: Record<string, DumpPreferredValue[]> = {};
    const boolDefaults: Record<string, boolean> = {};
    for (const [propName, def] of Object.entries(doc.componentPropertyDefinitions ?? {})) {
      if (def.type === 'INSTANCE_SWAP' && Array.isArray(def.preferredValues) && def.preferredValues.length > 0) {
        swapPreferredValues[propName.split('#')[0]] = def.preferredValues.map((v) => ({ type: v.type, key: v.key }));
      }
      // dump v1.5: BOOLEAN defaults — the one property default variants alone
      // cannot recover (visibility-bound parts' boolean prop defaults).
      if (def.type === 'BOOLEAN' && typeof def.defaultValue === 'boolean') {
        boolDefaults[propName.split('#')[0]] = def.defaultValue;
      }
    }
    const set: DumpSet = {
      setName: doc.name,
      type: doc.type,
      nodeId: doc.id,
      ...(key ? { key } : {}),
      ...(Object.keys(swapPreferredValues).length > 0 ? { swapPreferredValues } : {}),
      ...(Object.keys(boolDefaults).length > 0 ? { boolDefaults } : {}),
      variants,
    };
    dump[doc.name] = set;
    report.sets.push(doc.name);
  }

  if (report.sets.length === 0) {
    report.notes.push(
      options.target
        ? `no COMPONENT_SET or COMPONENT named "${options.target}" in the response — nothing mapped`
        : 'no COMPONENT_SET or COMPONENT documents in the response — nothing mapped',
    );
  }
  if (!options.variables) {
    report.notes.push(
      'variables response not provided — every bound fact degrades to its resolved literal; see variable-unresolved entries',
    );
  }
  return { dump, report };
}
