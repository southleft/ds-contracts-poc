import { canonicalJson } from "./normalize.js";
import { hashRecipeEnvelope } from "./hash.js";
import type { RecipeEnvelope } from "./envelope.js";
import {
  IRNodeSchema,
  type ComponentNode,
  type ComponentSetNode,
  type Effect,
  type FrameLayout,
  type IRNode,
  type Paint,
  type Sizing,
  type VariableBinding,
} from "./figma-ir.js";

/**
 * Calendar live v1 scene-readback. Table-shaped host-normalize: table/row/cell
 * ownership, recipe componentRefs, name-before-`#` properties, empty-payload
 * omit, binding compile-order / extras-drop, width/height layout aliases,
 * occupancy opacity 0, omit TEXT extras calendar@1 does not carry, fold
 * uniform per-side stroke-weight binds into `strokes.0.weight` on table
 * and cell variants, omit Figma-copied bindings on
 * `table/header-cell-instance` and `table/cell-instance` because compile
 * cell instances carry none, omit Figma-copied bindings on
 * `table/row-instance` because compile row-instances carry none, omit
 * `clipsContent` on `table/header` and
 * `table/body` because compile header/body frames omit `clipsContent`,
 * omit `clipsContent` on `table/variant` because compile variants omit
 * `clipsContent`, omit `clipsContent` on `table/row` variants because
 * compile row variants omit `clipsContent`, omit `cornerRadius` on
 * `table/row` variants because compile row variants omit
 * `cornerRadius`, omit `cornerRadius` on `table/header` and `table/body`
 * because compile header/body frames omit `cornerRadius`, omit `effects`
 * on `table/header` and `table/body` because compile header/body frames
 * omit `effects`, omit `effects` on `table/variant` because compile
 * variants omit `effects`, omit `effects` on `table/row` variants
 * because compile row variants omit `effects`, omit `strokes` on
 * `table/row` variants because compile row variants omit `strokes`,
 * omit `strokes` on `table/header` and
 * `table/body` because compile header/body frames omit `strokes`, and
 * omit empty `dashPattern` on `table/variant` strokes because compile
 * variant strokes omit `dashPattern`, omit `cornerRadius` on
 * `table/set`, `table/row-set`, and `table/cell-set` because compile
 * component-sets omit `cornerRadius`, omit `effects` on
 * `table/set`, `table/row-set`, and `table/cell-set` because compile
 * component-sets omit `effects`, and omit `strokes` on
 * `table/set`, `table/row-set`, and `table/cell-set` because compile
 * component-sets omit `strokes`, and emit compile-carried label
 * `Table row` on `table/row-set` instead of the live display name after
 * `::`. Host copies the Figma
 * file-default `5/5/5/5` onto those sets and emits extract
 * `effects` `[]` and extract `strokes` `[]`; drop those keys. Reuses the
 * extras-drop path and the Combobox listbox / set / option clipsContent
 * omit path plus `SET_ROLES`, `HEADER_BODY_ROLES`,
 * `TABLE_VARIANT_ROLE`, and `ROW_COMPONENT_ROLE`. Row components still
 * compile-carry `fills.0.color`. Does not omit `table/variant`
 * cornerRadius or `table/variant` strokes. Does not omit cell-variant
 * `clipsContent`, `cornerRadius`, or empty `strokes`. Does not invent
 * `clipsContent`, `cornerRadius`, `effects`, or `strokes` onto compile
 * row variants. Does not invent `cornerRadius`, `effects`, or `strokes`
 * onto compile sets. Does not invent `dashPattern` onto compile. Does
 * not invent a different row-set label. Does not change cell-set or
 * table/set labels in this teaching. Does not copy Combobox
 * overlay/option/listbox roles. Calendar live v4 refused
 * `$.children[0].bindings` because compile set nodes carry `bindings: []`
 * and host omitted the key; emit those empty arrays. Do not invent
 * bindings the compile does not carry.
 */
export const SCENE_READBACK_VERSION = 1;
export const CALENDAR_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER =
  "CALENDAR-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY";
export const CALENDAR_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER =
  "CALENDAR-HOST-RECOVER-RECIPE-COMPONENT-REF";
export const CALENDAR_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER =
  "CALENDAR-HOST-RECOVER-COMPONENT-PROPERTY-NAME";
export const CALENDAR_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER =
  "CALENDAR-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD";
export const CALENDAR_LIVE_V1_OBSERVE_OMIT_INSTANCE_PAYLOAD_MARKER =
  "CALENDAR-HOST-OBSERVE-OMIT-INSTANCE-PAYLOAD";
export const CALENDAR_LIVE_V1_BINDING_COMPILE_ORDER_MARKER =
  "CALENDAR-HOST-BINDING-COMPILE-ORDER";
export const CALENDAR_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER =
  "CALENDAR-HOST-WIDTH-HEIGHT-LAYOUT-ALIAS";
export const CALENDAR_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER =
  "CALENDAR-HOST-OMIT-TEXT-EXTRAS-UNLESS-SOURCE";
export const CALENDAR_LIVE_V1_OCCUPANCY_OPACITY_MARKER =
  "CALENDAR-HOST-HIDDEN-FILL-OCCUPANCY-OPACITY-0";
export const CALENDAR_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER =
  "CALENDAR-HOST-COLLAPSE-OMIT-INVENTED-CONTENT-TEXT-OPACITY";
export const CALENDAR_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER =
  "CALENDAR-HOST-SET-LAYOUT-COMPILE-CARRY";
export const CALENDAR_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-SET-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_SET_EMPTY_BINDINGS_MARKER =
  "CALENDAR-HOST-SET-EMPTY-BINDINGS";
export const CALENDAR_LIVE_V1_CAPTION_BINDING_COMPILE_ORDER_MARKER =
  "CALENDAR-HOST-CAPTION-BINDING-COMPILE-ORDER";
export const CALENDAR_LIVE_V1_WEEKDAY_BINDING_COMPILE_ORDER_MARKER =
  "CALENDAR-HOST-WEEKDAY-BINDING-COMPILE-ORDER";
export const CALENDAR_LIVE_V1_WEEK_FRAME_ITEM_SPACING_MARKER =
  "CALENDAR-HOST-WEEK-FRAME-ITEM-SPACING";
export const CALENDAR_LIVE_V1_WEEK_NUMBER_BINDING_COMPILE_ORDER_MARKER =
  "CALENDAR-HOST-WEEK-NUMBER-BINDING-COMPILE-ORDER";
export const CALENDAR_LIVE_V1_WEEK_SET_NUMBER_BINDING_COMPILE_ORDER_MARKER =
  "CALENDAR-HOST-WEEK-SET-NUMBER-BINDING-COMPILE-ORDER";
export const CALENDAR_LIVE_V1_WEEK_FRAME_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-WEEK-FRAME-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_WEEK_FRAME_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-WEEK-FRAME-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_WEEK_FRAME_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-WEEK-FRAME-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_WEEK_FRAME_STROKES_OMITTED_MARKER =
  "CALENDAR-HOST-WEEK-FRAME-STROKES-OMITTED";
export const CALENDAR_LIVE_V1_UNIFORM_PER_SIDE_STROKE_WEIGHT_MARKER =
  "CALENDAR-HOST-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT";
export const CALENDAR_LIVE_V1_CELL_INSTANCE_BINDING_EXTRAS_MARKER =
  "CALENDAR-HOST-CELL-INSTANCE-BINDING-EXTRAS-DROPPED";
export const CALENDAR_LIVE_V1_ROW_INSTANCE_BINDING_EXTRAS_MARKER =
  "CALENDAR-HOST-ROW-INSTANCE-BINDING-EXTRAS-DROPPED";
export const CALENDAR_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-HEADER-BODY-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_VARIANT_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-VARIANT-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_ROW_VARIANT_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-ROW-VARIANT-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-HEADER-BODY-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_VARIANT_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-VARIANT-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_ROW_VARIANT_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-ROW-VARIANT-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_HEADER_BODY_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-HEADER-BODY-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_VARIANT_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-VARIANT-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_ROW_VARIANT_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-ROW-VARIANT-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_HEADER_BODY_STROKES_OMITTED_MARKER =
  "CALENDAR-HOST-HEADER-BODY-STROKES-OMITTED";
export const CALENDAR_LIVE_V1_VARIANT_STROKES_OMITTED_MARKER =
  "CALENDAR-HOST-VARIANT-STROKES-OMITTED";
export const CALENDAR_LIVE_V1_ROW_VARIANT_STROKES_OMITTED_MARKER =
  "CALENDAR-HOST-ROW-VARIANT-STROKES-OMITTED";
export const CALENDAR_LIVE_V1_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER =
  "CALENDAR-HOST-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED";
export const CALENDAR_LIVE_V1_SET_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-SET-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_SET_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-SET-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_SET_STROKES_OMITTED_MARKER =
  "CALENDAR-HOST-SET-STROKES-OMITTED";
export const CALENDAR_LIVE_V1_ROW_SET_COMPILE_CARRY_LABEL_MARKER =
  "CALENDAR-HOST-ROW-SET-COMPILE-CARRY-LABEL";
export const CALENDAR_LIVE_V1_ROW_SET_COMPILE_CARRY_LABEL = "Calendar week";
export const CALENDAR_LIVE_V1_CELL_SET_COMPILE_CARRY_LABEL_MARKER =
  "CALENDAR-HOST-CELL-SET-COMPILE-CARRY-LABEL";
export const CALENDAR_LIVE_V1_CELL_SET_COMPILE_CARRY_LABEL = "Calendar day";
export const CALENDAR_LIVE_V1_FONT_PROVENANCE_LABEL_MARKER =
  "CALENDAR-HOST-FONT-PROVENANCE-SUFFIX-IS-NOT-THE-LABEL";
const FONT_PROVENANCE_SUFFIX = "font-provenance=";
export const CALENDAR_LIVE_V1_CELL_VARIANT_CLIPS_CONTENT_OMITTED_MARKER =
  "CALENDAR-HOST-CELL-VARIANT-CLIPS-CONTENT-OMITTED";
export const CALENDAR_LIVE_V1_CELL_VARIANT_CORNER_RADIUS_OMITTED_MARKER =
  "CALENDAR-HOST-CELL-VARIANT-CORNER-RADIUS-OMITTED";
export const CALENDAR_LIVE_V1_CELL_VARIANT_EFFECTS_OMITTED_MARKER =
  "CALENDAR-HOST-CELL-VARIANT-EFFECTS-OMITTED";
export const CALENDAR_LIVE_V1_CELL_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER =
  "CALENDAR-HOST-CELL-VARIANT-EMPTY-STROKE-DASH-PATTERN-OMITTED";
export const CALENDAR_LIVE_V1_CONTENT_ROLES = ["calendar/day/label"] as const;

export type SceneNodeType =
  | "FRAME"
  | "TEXT"
  | "RECTANGLE"
  | "ELLIPSE"
  | "VECTOR"
  | "INSTANCE"
  | "COMPONENT"
  | "COMPONENT_SET";

export interface SceneVariableBinding {
  field: string;
  variableName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
}

export interface ScenePaint {
  type:
    | "SOLID"
    | "GRADIENT_LINEAR"
    | "GRADIENT_RADIAL"
    | "IMAGE"
    | "VARIABLE_ALIAS"
    | "boundVariablesOnly";
  kind?: string;
  color?: string;
  opacity?: number;
  gradientStops?: Array<{ position: number; color: string }>;
  angle?: number;
  assetRef?: string;
  scaleMode?: "FILL" | "FIT" | "TILE" | "STRETCH";
  id?: string;
  variable?: string;
  boundVariables?: Record<string, { id?: string } | undefined>;
  fields?: string[];
}

export interface SceneEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  color?: string;
  visible: boolean;
}

type IRInstancePayload = NonNullable<
  Extract<IRNode, { kind: "instance" }>["payload"]
>;

export interface SceneNodeSnapshot {
  ownershipKey: string;
  type: SceneNodeType;
  name: string;
  semanticRole?: string;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  minWidth?: number | null;
  minHeight?: number | null;
  layoutPositioning?: "AUTO" | "ABSOLUTE";
  x?: number;
  y?: number;
  constraints?: {
    horizontal: "MIN" | "MAX" | "CENTER" | "SCALE" | "STRETCH";
    vertical: "MIN" | "MAX" | "CENTER" | "SCALE" | "STRETCH";
  };
  clipsContent?: boolean;
  fills?: ScenePaint[];
  strokes?: ScenePaint[];
  strokeWeight?: number;
  strokeAlign?: "INSIDE" | "OUTSIDE" | "CENTER";
  dashPattern?: number[];
  effects?: SceneEffect[];
  cornerRadius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  characters?: string;
  fontName?: { family: string; style: string };
  fontProvenance?: Extract<IRNode, { kind: "text" }>["type"]["fontProvenance"];
  fontSize?: number;
  lineHeight?: { unit: "PIXELS" | "PERCENT" | "AUTO"; value?: number };
  letterSpacing?: { unit: "PIXELS" | "PERCENT"; value: number };
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  variantProperties?: Record<string, string>;
  variantGroupProperties?: Record<string, { values: string[] }>;
  componentProperties?: Record<string, string | number | boolean>;
  componentRef?: string;
  instancePayload?: {
    text: string[];
    assets: string[];
    content?: IRInstancePayload["content"];
    typography?: IRInstancePayload["typography"];
    fills?: Paint[];
    opacity?: number;
    intrinsicSize?: { width: number; height: number };
    padding?: { top: number; right: number; bottom: number; left: number };
    alignment?: {
      horizontal: "start" | "center" | "end";
      vertical: "start" | "center" | "end";
    };
    accessibility?: IRInstancePayload["accessibility"];
    source?: string;
  };
  boundVariables: SceneVariableBinding[];
  children: SceneNodeSnapshot[];
  pluginData?: Record<string, string>;
}

export type TypedFactReceipt = {
  id: string;
  disposition: "code-only" | "refused";
  reason: string;
};

export interface SceneFact {
  id: string;
  baseId: string;
  nodeOwnershipKey: string;
  channel: string;
  occurrence: number;
  value: unknown;
  observedProperty: string;
}

export interface SceneGeneratedIdentitySegment {
  type: SceneNodeType;
  childIndex: number;
  occurrence: number;
  mainComponentRef?: string;
}

export interface SceneGeneratedDescendantIdentity {
  ownershipKey: string;
  ownedAncestorKey: string;
  ownedAncestorMainComponentRef: string;
  lineage: SceneGeneratedIdentitySegment[];
}

export interface ExpectedScenePlan {
  version: typeof SCENE_READBACK_VERSION;
  rootOwnershipKey: string;
  facts: SceneFact[];
  typedReceipts: TypedFactReceipt[];
  generatedDescendants: SceneGeneratedDescendantIdentity[];
}

export interface SceneComparison {
  ok: boolean;
  denominator: number;
  matched: number;
  codeOnly: number;
  refused: number;
  silent: number;
  missing: SceneFact[];
  extra: SceneFact[];
  mismatched: Array<{ expected: SceneFact; observed: SceneFact }>;
  duplicateCollapsed: SceneFact[];
  unobserved: SceneFact[];
  failures: string[];
}

type FactSeed = Omit<SceneFact, "id" | "baseId" | "occurrence">;

const CELL_INSTANCE_ROLE = /^calendar\/(?:week\/\d+\/day\/\d+|day-instance\/\d+)$/;
const ROW_INSTANCE_ROLE = /^calendar\/week\/\d+$/;
const CELL_COMPONENT_ROLE =
  /^calendar\/day\/(?:default|today|selected|outside)$/;
const ROW_COMPONENT_ROLE =
  /^calendar\/week\/(?:on|off)$/;
const TABLE_VARIANT_ROLE = /^calendar\/variant\/(?:on|off)$/;
const SET_ROLES = new Set(["calendar/set", "calendar/week-set", "calendar/day-set"]);
const HEADER_BODY_ROLES = new Set(["calendar/weekday-row", "calendar/grid"]);

const CELL_COMPILE_BINDING_FIELDS = [
  "layout.width.value",
  "layout.height.value",
  "layout.padding.left",
  "layout.padding.right",
  "layout.padding.top",
  "layout.padding.bottom",
  "cornerRadius.topLeft",
  "fills.0.color",
  "strokes.0.paint.color",
  "strokes.0.weight",
] as const;
const CELL_INSTANCE_COMPILE_BINDING_FIELDS = [] as const;
const CELL_LABEL_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "fills.0.color",
] as const;
const CAPTION_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "fills.0.color",
] as const;
const WEEKDAY_TEXT_ROLE = /^calendar\/weekday\//;
const WEEKDAY_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "fills.0.color",
  "width.value",
] as const;
const WEEK_NUMBER_TEXT_ROLE = /^calendar\/week\/\d+\/number$/;
const WEEK_NUMBER_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "fills.0.color",
  "width.value",
] as const;
const ROW_INSTANCE_COMPILE_BINDING_FIELDS = [] as const;
const ROW_COMPILE_BINDING_FIELDS = ["layout.itemSpacing"] as const;
const TABLE_VARIANT_COMPILE_BINDING_FIELDS = [
  "layout.itemSpacing",
  "layout.padding.left",
  "layout.padding.right",
  "layout.padding.top",
  "layout.padding.bottom",
  "fills.0.color",
] as const;
const HEADER_COMPILE_BINDING_FIELDS = ["layout.itemSpacing"] as const;

const withStableOccurrences = (seeds: readonly FactSeed[]): SceneFact[] => {
  const counts = new Map<string, number>();
  return seeds.map((seed) => {
    const baseId = `${seed.nodeOwnershipKey}#${seed.channel}`;
    const occurrence = counts.get(baseId) ?? 0;
    counts.set(baseId, occurrence + 1);
    return {
      ...seed,
      baseId,
      occurrence,
      id: `${baseId}@${String(occurrence).padStart(4, "0")}`,
    };
  });
};

const emit = (
  out: FactSeed[],
  nodeOwnershipKey: string,
  channel: string,
  value: unknown,
  observedProperty: string,
): void => {
  out.push({
    nodeOwnershipKey,
    channel,
    value: structuredClone(value),
    observedProperty,
  });
};

const figmaType = (node: IRNode): SceneNodeType => {
  if (node.kind === "shape")
    return node.shape === "rectangle" ? "RECTANGLE" : "ELLIPSE";
  return {
    frame: "FRAME",
    text: "TEXT",
    vector: "VECTOR",
    instance: "INSTANCE",
    component: "COMPONENT",
    "component-set": "COMPONENT_SET",
  }[node.kind] as SceneNodeType;
};

const figmaName = (node: IRNode): string => {
  if (node.kind === "component") {
    return Object.entries(node.variantProperties)
      .map(([name, value]) => `${name}=${value}`)
      .join(", ");
  }
  const base =
    node.role !== undefined &&
    node.label !== undefined &&
    node.role !== node.label
      ? `${node.role} :: ${node.label}`
      : (node.label ?? node.role ?? node.kind);
  if (node.kind === "text" && node.type.fontProvenance !== undefined) {
    return `${base} :: font-provenance=${encodeURIComponent(
      canonicalJson(node.type.fontProvenance),
    )}`;
  }
  return base;
};

const expectedBinding = (binding: VariableBinding): unknown => ({
  field: binding.field,
  variableName: binding.variable,
  resolvedType: binding.type,
});

const addExpectedPaints = (
  out: FactSeed[],
  key: string,
  node: IRNode,
): void => {
  if ("fills" in node && node.fills !== undefined) {
    for (const paint of node.fills) emit(out, key, "fill", paint, "fills[]");
  }
  if ("strokes" in node && node.strokes !== undefined) {
    for (const stroke of node.strokes)
      emit(out, key, "stroke", stroke, "strokes[] + stroke properties");
  }
  if ("effects" in node && node.effects !== undefined) {
    for (const effect of node.effects)
      emit(out, key, "effect", effect, "effects[]");
  }
  if ("cornerRadius" in node && node.cornerRadius !== undefined) {
    emit(out, key, "cornerRadius", node.cornerRadius, "four corner radii");
  }
};

const addExpectedLayout = (
  out: FactSeed[],
  key: string,
  layout: FrameLayout,
): void => {
  emit(out, key, "layout.mode", layout.mode, "layoutMode");
  emit(
    out,
    key,
    "layout.primaryAxisAlign",
    layout.primaryAxisAlign,
    "primaryAxisAlignItems",
  );
  emit(
    out,
    key,
    "layout.counterAxisAlign",
    layout.counterAxisAlign,
    "counterAxisAlignItems",
  );
  emit(out, key, "layout.itemSpacing", layout.itemSpacing, "itemSpacing");
  emit(out, key, "layout.padding", layout.padding, "four padding properties");
  emit(out, key, "width.mode", layout.width.mode, "layoutSizingHorizontal");
  emit(out, key, "height.mode", layout.height.mode, "layoutSizingVertical");
  if (layout.width.mode === "fixed")
    emit(out, key, "width.value", layout.width.value, "width");
  if (layout.height.mode === "fixed")
    emit(out, key, "height.value", layout.height.value, "height");
  if (layout.minWidth !== undefined)
    emit(out, key, "layout.minWidth", layout.minWidth, "minWidth");
  if (layout.minHeight !== undefined)
    emit(out, key, "layout.minHeight", layout.minHeight, "minHeight");
  emit(
    out,
    key,
    "layout.positioning",
    layout.positioning ?? "auto",
    "layoutPositioning",
  );
  if (layout.positioning === "absolute") {
    emit(out, key, "layout.offset", layout.offset, "x/y");
    emit(out, key, "layout.constraints", layout.constraints, "constraints");
  }
};

export function compileExpectedScenePlan(
  root: IRNode,
  options: {
    rootOwnershipKey?: string;
    typedReceipts?: TypedFactReceipt[];
    instancePayload?: (
      node: Extract<IRNode, { kind: "instance" }>,
      ownershipKey: string,
    ) => SceneNodeSnapshot["instancePayload"] | undefined;
    generatedDescendantLineages?: (
      node: Extract<IRNode, { kind: "instance" }>,
      ownershipKey: string,
    ) => SceneGeneratedIdentitySegment[][];
  } = {},
): ExpectedScenePlan {
  const seeds: FactSeed[] = [];
  const generatedDescendants: SceneGeneratedDescendantIdentity[] = [];
  const visit = (node: IRNode, key: string): void => {
    emit(seeds, key, "kind", figmaType(node), "type");
    emit(seeds, key, "name", figmaName(node), "name");
    if (node.role !== undefined)
      emit(seeds, key, "role", node.role, "name/description-derived role");
    emit(seeds, key, "visible", node.visible ?? true, "visible");
    emit(seeds, key, "opacity", node.opacity ?? 1, "opacity");
    for (const binding of node.bindings ?? []) {
      emit(
        seeds,
        key,
        "binding",
        expectedBinding(binding),
        "boundVariables + variable name/type",
      );
    }
    addExpectedPaints(seeds, key, node);
    if (
      node.kind === "frame" ||
      node.kind === "component" ||
      node.kind === "component-set"
    ) {
      addExpectedLayout(seeds, key, node.layout);
      emit(
        seeds,
        key,
        "clipsContent",
        node.clipsContent ?? false,
        "clipsContent",
      );
      for (const [index, child] of node.children.entries()) {
        const childKey = `${key}/children/${index}`;
        emit(
          seeds,
          key,
          "child",
          { ownershipKey: childKey, type: figmaType(child) },
          "children[]",
        );
        visit(child, childKey);
      }
    } else {
      emit(seeds, key, "width.mode", node.width.mode, "layoutSizingHorizontal");
      emit(seeds, key, "height.mode", node.height.mode, "layoutSizingVertical");
      if (node.width.mode === "fixed")
        emit(seeds, key, "width.value", node.width.value, "width");
      if (node.height.mode === "fixed")
        emit(seeds, key, "height.value", node.height.value, "height");
    }
    if (node.kind === "text") {
      emit(seeds, key, "characters", node.characters, "characters");
      emit(seeds, key, "type", node.type, "font/text metric properties");
      emit(seeds, key, "align", node.align, "textAlignHorizontal");
      emit(
        seeds,
        key,
        "verticalAlign",
        node.verticalAlign,
        "textAlignVertical",
      );
    } else if (node.kind === "component") {
      emit(
        seeds,
        key,
        "variantProperties",
        node.variantProperties,
        "component name/variantProperties",
      );
    } else if (node.kind === "component-set") {
      for (const axis of node.variantAxes)
        emit(seeds, key, "variantAxis", axis, "variantGroupProperties");
    } else if (node.kind === "instance") {
      emit(seeds, key, "componentRef", node.componentRef, "main component");
      emit(seeds, key, "properties", node.properties, "componentProperties");
      const payload =
        options.instancePayload?.(node, key) ??
        (node.payload === undefined
          ? undefined
          : ({
              text:
                node.payload.content.kind === "text" ||
                node.payload.content.kind === "glyph"
                  ? [node.payload.content.text]
                  : [],
              assets:
                node.payload.content.kind === "glyph"
                  ? [node.payload.content.assetRef]
                  : [],
              content: node.payload.content,
              typography: node.payload.typography,
              fills: node.payload.fills,
              opacity: node.payload.opacity,
              intrinsicSize: node.payload.intrinsicSize,
              padding: node.payload.padding,
              alignment: node.payload.alignment,
              accessibility: node.payload.accessibility,
              source: node.payload.source,
            } satisfies SceneNodeSnapshot["instancePayload"]));
      if (payload !== undefined)
        emit(
          seeds,
          key,
          "instancePayload",
          payload,
          "instance descendant text/assets",
        );
    }
  };
  const rootKey = options.rootOwnershipKey ?? "root";
  visit(root, rootKey);
  return {
    version: SCENE_READBACK_VERSION,
    rootOwnershipKey: rootKey,
    facts: withStableOccurrences(seeds),
    typedReceipts: options.typedReceipts ?? [],
    generatedDescendants,
  };
}

export const sceneRole = (scene: SceneNodeSnapshot): string | undefined => {
  if (scene.semanticRole) return scene.semanticRole;
  const head = scene.name.split(" :: ", 1)[0] ?? "";
  return head.includes("/") && !head.includes("=") ? head : undefined;
};

const sceneLabel = (scene: SceneNodeSnapshot): string => {
  const separator = scene.name.indexOf(" :: ");
  const label = separator < 0 ? scene.name : scene.name.slice(separator + 4);
  return label.split(" :: font-provenance=", 1)[0]!;
};

const compileCarriedLabel = (scene: SceneNodeSnapshot): string => {
  // The row-set and cell-set label overrides that landed at v24 are GONE, and
  // deliberately so. They treated the symptom: the writer named every set
  // `<role> :: <source display name>`, so the after-`::` rule derived `Table`
  // where compile carried `Table row` / `Table cell`, and the override patched
  // the label back. Table live v25 showed that was not enough -- the IR diff
  // went to zero but independent root accounting still refused with 2 name
  // mismatches per root, because the live NODE NAME was still wrong. The writer
  // now carries the compile label into the set name
  // (`calendar-figma-writer.ts`, CALENDAR-WRITER-SET-NAME-CARRIES-COMPILE-LABEL), so
  // the generic after-`::` rule derives the right label with no special case.
  // Two host special cases removed in favour of one writer fix.
  void CALENDAR_LIVE_V1_ROW_SET_COMPILE_CARRY_LABEL_MARKER;
  void CALENDAR_LIVE_V1_CELL_SET_COMPILE_CARRY_LABEL_MARKER;
  // Font-provenance class. `sceneLabel` takes the segment AFTER the first
  // " :: ", which is right when that segment is a display name. On the cell
  // label TEXT the live name is `calendar/day/label :: font-provenance=%7B...`,
  // so that rule derives the provenance payload where compile carries the
  // segment BEFORE the separator. Measured on both roots at table live v24
  // (refusal $.children[2].children[0].children[0].label): compile carries
  // `calendar/day/label`, host derived `font-provenance=%7B...`.
  // Scoped to the provenance suffix only. Does not invent a label, does not
  // change row-set, cell-set, or table/set labels.
  void CALENDAR_LIVE_V1_FONT_PROVENANCE_LABEL_MARKER;
  const separator = scene.name.indexOf(" :: ");
  if (
    separator >= 0 &&
    scene.name.slice(separator + 4).startsWith(FONT_PROVENANCE_SUFFIX)
  )
    return scene.name.slice(0, separator);
  return sceneLabel(scene);
};

const isHiddenFillOccupancy = (scene: SceneNodeSnapshot): boolean => {
  void CALENDAR_LIVE_V1_OCCUPANCY_OPACITY_MARKER;
  return (
    scene.type === "TEXT" &&
    scene.visible === false &&
    scene.layoutSizingHorizontal === "FILL"
  );
};

export function canonicalizeObservedComponentProperties(
  properties: SceneNodeSnapshot["componentProperties"],
): Record<string, string | number | boolean> {
  void CALENDAR_LIVE_V1_RECOVER_COMPONENT_PROPERTY_NAME_MARKER;
  return Object.fromEntries(
    Object.entries(properties ?? {}).map(([key, value]) => [
      key.split("#")[0]!,
      value,
    ]),
  );
}

export function recoverRecipeComponentRef(
  componentRef: string,
  role: string | undefined,
  properties?: Record<string, string | number | boolean>,
): string {
  void CALENDAR_LIVE_V1_RECOVER_RECIPE_COMPONENT_REF_MARKER;
  if (role && CELL_INSTANCE_ROLE.test(role)) return "calendar@1/day";
  if (role && ROW_INSTANCE_ROLE.test(role)) return "calendar@1/week";
  if (properties && "State" in properties) return "calendar@1/day";
  if (properties && "WeekNumbers" in properties) return "calendar@1/week";
  if (componentRef === "calendar@1/day" || componentRef === "calendar@1/week")
    return componentRef;
  return componentRef;
}

export function shouldOmitEmptyInstancePayload(
  payload: SceneNodeSnapshot["instancePayload"],
): boolean {
  void CALENDAR_LIVE_V1_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER;
  if (!payload) return true;
  const text = payload.text ?? [];
  const assets = payload.assets ?? [];
  const contentText =
    payload.content && "text" in payload.content ? payload.content.text : "";
  return (
    assets.length === 0 &&
    text.every((entry) => !entry) &&
    (contentText === undefined || contentText === "")
  );
}

export function shouldOmitObservedInstancePayload(
  node: IRNode,
  payload: SceneNodeSnapshot["instancePayload"],
): boolean {
  void CALENDAR_LIVE_V1_OBSERVE_OMIT_INSTANCE_PAYLOAD_MARKER;
  if (node.kind !== "instance") return payload === undefined;
  if (
    node.componentRef === "calendar@1/day" ||
    node.componentRef === "calendar@1/week"
  )
    return true;
  return shouldOmitEmptyInstancePayload(payload);
}

const compileBindingFieldsFor = (
  role: string | undefined,
  scene: SceneNodeSnapshot,
): string[] | null => {
  void CALENDAR_LIVE_V1_BINDING_COMPILE_ORDER_MARKER;
  void CALENDAR_LIVE_V1_CELL_INSTANCE_BINDING_EXTRAS_MARKER;
  void CALENDAR_LIVE_V1_ROW_INSTANCE_BINDING_EXTRAS_MARKER;
  void CALENDAR_LIVE_V1_CAPTION_BINDING_COMPILE_ORDER_MARKER;
  void CALENDAR_LIVE_V1_WEEKDAY_BINDING_COMPILE_ORDER_MARKER;
  void CALENDAR_LIVE_V1_WEEK_FRAME_ITEM_SPACING_MARKER;
  void CALENDAR_LIVE_V1_WEEK_NUMBER_BINDING_COMPILE_ORDER_MARKER;
  void CALENDAR_LIVE_V1_WEEK_SET_NUMBER_BINDING_COMPILE_ORDER_MARKER;
  if (role === "calendar/caption") return [...CAPTION_COMPILE_BINDING_FIELDS];
  if (role && WEEKDAY_TEXT_ROLE.test(role))
    return [...WEEKDAY_COMPILE_BINDING_FIELDS];
  if (role === "calendar/week/number")
    return [...WEEK_NUMBER_COMPILE_BINDING_FIELDS];
  if (role && WEEK_NUMBER_TEXT_ROLE.test(role))
    return [...WEEK_NUMBER_COMPILE_BINDING_FIELDS];
  if (role === "calendar/day/label")
    return [...CELL_LABEL_COMPILE_BINDING_FIELDS];
  if (role && CELL_INSTANCE_ROLE.test(role))
    return [...CELL_INSTANCE_COMPILE_BINDING_FIELDS];
  if (role && CELL_COMPONENT_ROLE.test(role))
    return [...CELL_COMPILE_BINDING_FIELDS];
  if (role && ROW_INSTANCE_ROLE.test(role) && scene.type === "INSTANCE")
    return [...ROW_INSTANCE_COMPILE_BINDING_FIELDS];
  if (role && ROW_INSTANCE_ROLE.test(role))
    return [...ROW_COMPILE_BINDING_FIELDS];
  if (role && ROW_COMPONENT_ROLE.test(role))
    return [...ROW_COMPILE_BINDING_FIELDS];
  if (role && TABLE_VARIANT_ROLE.test(role))
    return [...TABLE_VARIANT_COMPILE_BINDING_FIELDS];
  if (role === "calendar/weekday-row" || role === "calendar/grid")
    return [...HEADER_COMPILE_BINDING_FIELDS];
  return null;
};

const irFieldForSceneBinding = (
  field: string,
  scene: SceneNodeSnapshot,
): string => {
  void CALENDAR_LIVE_V1_WIDTH_HEIGHT_LAYOUT_ALIAS_MARKER;
  const standard: Record<string, string> = {
    paddingTop: "layout.padding.top",
    paddingRight: "layout.padding.right",
    paddingBottom: "layout.padding.bottom",
    paddingLeft: "layout.padding.left",
    itemSpacing: "layout.itemSpacing",
    minWidth: "layout.minWidth",
    minHeight: "layout.minHeight",
    topLeftRadius: "cornerRadius.topLeft",
    topRightRadius: "cornerRadius.topRight",
    bottomRightRadius: "cornerRadius.bottomRight",
    bottomLeftRadius: "cornerRadius.bottomLeft",
    strokeWeight: "strokes.0.weight",
    strokeTopWeight: "strokes.0.weight.top",
    strokeRightWeight: "strokes.0.weight.right",
    strokeBottomWeight: "strokes.0.weight.bottom",
    strokeLeftWeight: "strokes.0.weight.left",
    fontSize: "type.fontSize",
    "fontSize.0": "type.fontSize",
    lineHeight: "type.lineHeight.value",
    "lineHeight.0": "type.lineHeight.value",
  };
  if (field === "width" || field === "width.value")
    return scene.type === "TEXT" ? "width.value" : "layout.width.value";
  if (field === "height" || field === "height.value")
    return scene.type === "TEXT" ? "height.value" : "layout.height.value";
  if (standard[field]) return standard[field]!;
  if (/^fills\.\d+$/.test(field)) return `${field}.color`;
  if (/^strokes\.\d+$/.test(field)) return `${field}.paint.color`;
  if (/^effects\.\d+$/.test(field)) return `${field}.color`;
  return field;
};

const PER_SIDE_STROKE_WEIGHT_FIELDS = new Set([
  "strokes.0.weight.top",
  "strokes.0.weight.right",
  "strokes.0.weight.bottom",
  "strokes.0.weight.left",
]);

const isTableOrCellVariantRole = (role: string | undefined): boolean =>
  role !== undefined &&
  (TABLE_VARIANT_ROLE.test(role) || CELL_COMPONENT_ROLE.test(role));

const foldUniformPerSideStrokeWeight = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  void CALENDAR_LIVE_V1_UNIFORM_PER_SIDE_STROKE_WEIGHT_MARKER;
  if (!isTableOrCellVariantRole(sceneRole(scene))) return own;
  if (own.some((binding) => binding.field === "strokes.0.weight"))
    return own.filter(
      (binding) => !PER_SIDE_STROKE_WEIGHT_FIELDS.has(binding.field),
    );
  const perSide = (
    [
      "strokes.0.weight.top",
      "strokes.0.weight.right",
      "strokes.0.weight.bottom",
      "strokes.0.weight.left",
    ] as const
  ).map((field) =>
    own.find((binding) => binding.field === field && binding.type === "FLOAT"),
  );
  if (perSide.some((binding) => binding === undefined)) return own;
  const variable = perSide[0]!.variable;
  if (
    variable.length === 0 ||
    perSide.some((binding) => binding!.variable !== variable)
  )
    return own;
  return [
    ...own.filter(
      (binding) => !PER_SIDE_STROKE_WEIGHT_FIELDS.has(binding.field),
    ),
    { field: "strokes.0.weight", type: "FLOAT", variable },
  ];
};

const sceneBindings = (scene: SceneNodeSnapshot): VariableBinding[] => {
  const raw = foldUniformPerSideStrokeWeight(
    scene,
    scene.boundVariables.map((binding) => ({
      field: irFieldForSceneBinding(binding.field, scene),
      type: binding.resolvedType,
      variable: binding.variableName,
    })),
  );
  const fields = compileBindingFieldsFor(sceneRole(scene), scene);
  if (!fields) return raw;
  const byField = new Map(raw.map((binding) => [binding.field, binding]));
  return fields
    .filter((field) => byField.has(field))
    .map((field) => byField.get(field)!);
};

const irSizing = (
  mode: SceneNodeSnapshot["layoutSizingHorizontal"],
  value: number,
): Sizing => {
  if (mode === "HUG") return { mode: "hug" };
  if (mode === "FILL") return { mode: "fill" };
  return { mode: "fixed", value };
};

const sceneLayout = (scene: SceneNodeSnapshot): FrameLayout => {
  void CALENDAR_LIVE_V1_SET_LAYOUT_COMPILE_CARRY_MARKER;
  let width = irSizing(scene.layoutSizingHorizontal, scene.width);
  let height = irSizing(scene.layoutSizingVertical, scene.height);
  const role = sceneRole(scene);
  if (
    scene.type === "COMPONENT_SET" &&
    role !== undefined &&
    SET_ROLES.has(role)
  ) {
    const bound = (scene.boundVariables ?? []).map((binding) => binding.field);
    if (
      width.mode === "fixed" &&
      !bound.some((field) => field.includes("width"))
    )
      width = { mode: "hug" };
    if (
      height.mode === "fixed" &&
      !bound.some((field) => field.includes("height"))
    )
      height = { mode: "hug" };
  }
  return {
    mode:
      scene.layoutMode === "HORIZONTAL"
        ? "horizontal"
        : scene.layoutMode === "VERTICAL"
          ? "vertical"
          : "none",
    primaryAxisAlign: (
      {
        MIN: "min",
        CENTER: "center",
        MAX: "max",
        SPACE_BETWEEN: "space-between",
      } as const
    )[scene.primaryAxisAlignItems ?? "MIN"],
    counterAxisAlign: (
      {
        MIN: "min",
        CENTER: "center",
        MAX: "max",
        BASELINE: "baseline",
      } as const
    )[scene.counterAxisAlignItems ?? "MIN"],
    itemSpacing: scene.itemSpacing ?? 0,
    padding: {
      top: scene.paddingTop ?? 0,
      right: scene.paddingRight ?? 0,
      bottom: scene.paddingBottom ?? 0,
      left: scene.paddingLeft ?? 0,
    },
    width,
    height,
    ...(scene.minWidth === undefined || scene.minWidth === null
      ? {}
      : { minWidth: scene.minWidth }),
    ...(scene.minHeight === undefined || scene.minHeight === null
      ? {}
      : { minHeight: scene.minHeight }),
    ...(scene.layoutPositioning === "ABSOLUTE"
      ? {
          positioning: "absolute" as const,
          offset: { x: scene.x ?? 0, y: scene.y ?? 0 },
          constraints: {
            horizontal: (
              {
                MIN: "left",
                MAX: "right",
                CENTER: "center",
                SCALE: "scale",
                STRETCH: "stretch",
              } as const
            )[scene.constraints?.horizontal ?? "MIN"],
            vertical: (
              {
                MIN: "top",
                MAX: "bottom",
                CENTER: "center",
                SCALE: "scale",
                STRETCH: "stretch",
              } as const
            )[scene.constraints?.vertical ?? "MIN"],
          },
        }
      : {}),
  };
};

const scenePaintToIr = (paint: ScenePaint): Paint => {
  const discriminator =
    "kind" in paint && typeof paint.kind === "string" && paint.kind.length > 0
      ? paint.kind
      : paint.type;
  if (discriminator === "solid" || discriminator === "SOLID") {
    if (paint.color === undefined)
      throw new TypeError("scene solid paint has no color");
    return { kind: "solid", color: paint.color };
  }
  if (
    discriminator === "variable-alias" ||
    discriminator === "VARIABLE_ALIAS"
  ) {
    return {
      kind: "variable-alias",
      variable: paint.variable ?? paint.id ?? "",
      resolvedType: "COLOR",
      ...(typeof paint.color === "string" ? { color: paint.color } : {}),
    };
  }
  if (
    discriminator === "bound-variable" ||
    discriminator === "boundVariablesOnly"
  ) {
    return {
      kind: "bound-variable",
      fields: paint.fields ?? ["color"],
      ...(typeof paint.color === "string" ? { color: paint.color } : {}),
    };
  }
  if (
    discriminator === "linear-gradient" ||
    discriminator === "GRADIENT_LINEAR"
  ) {
    return {
      kind: "linear-gradient",
      angle: paint.angle ?? 0,
      stops: paint.gradientStops ?? [],
    };
  }
  if (
    discriminator === "radial-gradient" ||
    discriminator === "GRADIENT_RADIAL"
  ) {
    return { kind: "radial-gradient", stops: paint.gradientStops ?? [] };
  }
  return {
    kind: "image",
    assetRef: paint.assetRef ?? "unresolved-image",
    scaleMode: (paint.scaleMode ?? "FILL").toLowerCase() as
      "fill" | "fit" | "tile" | "stretch",
  };
};

const sceneEffectToIr = (effect: SceneEffect): Effect => {
  if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
    return {
      kind: effect.type === "LAYER_BLUR" ? "layer-blur" : "background-blur",
      blur: effect.radius,
    };
  }
  return {
    kind: effect.type === "DROP_SHADOW" ? "drop-shadow" : "inner-shadow",
    offsetX: effect.offset?.x ?? 0,
    offsetY: effect.offset?.y ?? 0,
    blur: effect.radius,
    spread: effect.spread ?? 0,
    color: effect.color,
  };
};

const omitSetClipsContent = <T extends { clipsContent?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_SET_CLIPS_CONTENT_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !SET_ROLES.has(role) || scene.type !== "COMPONENT_SET")
    return frame;
  if (frame.clipsContent === undefined) return frame;
  const { clipsContent: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSetCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_SET_CORNER_RADIUS_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !SET_ROLES.has(role) || scene.type !== "COMPONENT_SET")
    return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSetEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_SET_EFFECTS_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !SET_ROLES.has(role) || scene.type !== "COMPONENT_SET")
    return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSetStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_SET_STROKES_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !SET_ROLES.has(role) || scene.type !== "COMPONENT_SET")
    return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitHeaderBodyClipsContent = <T extends { clipsContent?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_HEADER_BODY_CLIPS_CONTENT_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_VARIANT_CLIPS_CONTENT_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_ROW_VARIANT_CLIPS_CONTENT_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_CELL_VARIANT_CLIPS_CONTENT_OMITTED_MARKER;
  const role = sceneRole(scene);
  const headerBody =
    !!role && HEADER_BODY_ROLES.has(role) && scene.type === "FRAME";
  const tableVariant =
    !!role && TABLE_VARIANT_ROLE.test(role) && scene.type === "COMPONENT";
  const rowVariant =
    !!role && ROW_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  const cellVariant =
    !!role && CELL_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  if (!headerBody && !tableVariant && !rowVariant && !cellVariant) return frame;
  if (frame.clipsContent === undefined) return frame;
  const { clipsContent: _omitted, ...rest } = frame;
  return rest as T;
};

const omitWeekFrameClipsContent = <T extends { clipsContent?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_WEEK_FRAME_CLIPS_CONTENT_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !ROW_INSTANCE_ROLE.test(role) || scene.type !== "FRAME")
    return frame;
  if (frame.clipsContent === undefined) return frame;
  const { clipsContent: _omitted, ...rest } = frame;
  return rest as T;
};

const omitHeaderBodyCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_HEADER_BODY_CORNER_RADIUS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_VARIANT_CORNER_RADIUS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_ROW_VARIANT_CORNER_RADIUS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_CELL_VARIANT_CORNER_RADIUS_OMITTED_MARKER;
  const role = sceneRole(scene);
  const headerBody =
    !!role && HEADER_BODY_ROLES.has(role) && scene.type === "FRAME";
  const tableVariant =
    !!role && TABLE_VARIANT_ROLE.test(role) && scene.type === "COMPONENT";
  const rowVariant =
    !!role && ROW_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  const cellVariant =
    !!role && CELL_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  if (!headerBody && !tableVariant && !rowVariant && !cellVariant) return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};

const omitWeekFrameCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_WEEK_FRAME_CORNER_RADIUS_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !ROW_INSTANCE_ROLE.test(role) || scene.type !== "FRAME")
    return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};

const omitHeaderBodyEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_HEADER_BODY_EFFECTS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_VARIANT_EFFECTS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_ROW_VARIANT_EFFECTS_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_CELL_VARIANT_EFFECTS_OMITTED_MARKER;
  const role = sceneRole(scene);
  const headerBody =
    !!role && HEADER_BODY_ROLES.has(role) && scene.type === "FRAME";
  const tableVariant =
    !!role && TABLE_VARIANT_ROLE.test(role) && scene.type === "COMPONENT";
  const rowVariant =
    !!role && ROW_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  const cellVariant =
    !!role && CELL_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  if (!headerBody && !tableVariant && !rowVariant && !cellVariant) return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitWeekFrameEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_WEEK_FRAME_EFFECTS_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !ROW_INSTANCE_ROLE.test(role) || scene.type !== "FRAME")
    return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitWeekFrameStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_WEEK_FRAME_STROKES_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (!role || !ROW_INSTANCE_ROLE.test(role) || scene.type !== "FRAME")
    return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitHeaderBodyStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  void CALENDAR_LIVE_V1_HEADER_BODY_STROKES_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_VARIANT_STROKES_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_ROW_VARIANT_STROKES_OMITTED_MARKER;
  const role = sceneRole(scene);
  const headerBody =
    !!role && HEADER_BODY_ROLES.has(role) && scene.type === "FRAME";
  const tableVariant =
    !!role && TABLE_VARIANT_ROLE.test(role) && scene.type === "COMPONENT";
  const rowVariant =
    !!role && ROW_COMPONENT_ROLE.test(role) && scene.type === "COMPONENT";
  if (!headerBody && !tableVariant && !rowVariant) return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitVariantEmptyStrokeDashPattern = <T extends { dashPattern?: unknown }>(
  scene: SceneNodeSnapshot,
  strokes: T[] | undefined,
): T[] | undefined => {
  void CALENDAR_LIVE_V1_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER;
  void CALENDAR_LIVE_V1_CELL_VARIANT_EMPTY_STROKE_DASH_PATTERN_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (
    !role ||
    (!TABLE_VARIANT_ROLE.test(role) && !CELL_COMPONENT_ROLE.test(role)) ||
    scene.type !== "COMPONENT" ||
    strokes === undefined
  )
    return strokes;
  return strokes.map((stroke) => {
    if (!Array.isArray(stroke.dashPattern) || stroke.dashPattern.length !== 0)
      return stroke;
    const { dashPattern: _omitted, ...rest } = stroke;
    return rest as T;
  });
};

const omitTableTextExtras = <
  T extends {
    letterSpacing?: unknown;
    textCase?: unknown;
    textDecoration?: unknown;
  },
>(
  type: T,
): T => {
  void CALENDAR_LIVE_V1_OMIT_TEXT_EXTRAS_MARKER;
  const {
    letterSpacing: _letterSpacing,
    textCase: _textCase,
    textDecoration: _textDecoration,
    ...rest
  } = type;
  return rest as T;
};

export function sceneToNormalizedIr(
  scene: SceneNodeSnapshot,
  inheritedVariantProperties?: Record<string, string>,
): IRNode {
  const occupancy = isHiddenFillOccupancy(scene);
  const bindings = sceneBindings(scene);
  const role = sceneRole(scene);
  void CALENDAR_LIVE_V1_SET_EMPTY_BINDINGS_MARKER;
  const common = {
    label: compileCarriedLabel(scene),
    ...(role === undefined ? {} : { role }),
    ...(SET_ROLES.has(role ?? "") || bindings.length > 0
      ? { bindings }
      : {}),
    ...(occupancy || scene.visible ? {} : { visible: false }),
    ...(occupancy
      ? { opacity: 0 }
      : scene.opacity === 1
        ? {}
        : { opacity: scene.opacity }),
  };
  const fills = (scene.fills ?? []).map(scenePaintToIr);
  const strokes = omitVariantEmptyStrokeDashPattern(
    scene,
    scene.strokes === undefined
      ? undefined
      : scene.strokes.map((paint) => ({
          weight: scene.strokeWeight ?? 0,
          align: (scene.strokeAlign ?? "INSIDE").toLowerCase() as
            "inside" | "outside" | "center",
          paint: scenePaintToIr(paint),
          ...(scene.dashPattern === undefined
            ? {}
            : { dashPattern: scene.dashPattern }),
        })),
  );
  const effects = scene.effects
    ?.filter((effect) => effect.visible)
    .map(sceneEffectToIr);
  const children = scene.children.map((child) =>
    sceneToNormalizedIr(child, inheritedVariantProperties),
  );
  let result: IRNode;
  if (
    scene.type === "FRAME" ||
    scene.type === "COMPONENT" ||
    scene.type === "COMPONENT_SET"
  ) {
    const frame = omitWeekFrameStrokes(
      scene,
      omitHeaderBodyStrokes(
        scene,
        omitWeekFrameEffects(
          scene,
          omitHeaderBodyEffects(
            scene,
            omitWeekFrameCornerRadius(
              scene,
              omitHeaderBodyCornerRadius(
                scene,
                omitWeekFrameClipsContent(
                  scene,
                  omitHeaderBodyClipsContent(
                    scene,
                    omitSetStrokes(
                      scene,
                      omitSetEffects(
                        scene,
                        omitSetCornerRadius(
                          scene,
                          omitSetClipsContent(scene, {
                            ...common,
                            layout: sceneLayout(scene),
                            fills,
                            ...(strokes === undefined ? {} : { strokes }),
                            ...(effects === undefined ? {} : { effects }),
                            ...(scene.cornerRadius === undefined
                              ? {}
                              : { cornerRadius: scene.cornerRadius }),
                            clipsContent: scene.clipsContent ?? false,
                            children,
                          }),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    if (scene.type === "FRAME") result = { kind: "frame", ...frame };
    else if (scene.type === "COMPONENT") {
      result = {
        kind: "component",
        ...frame,
        variantProperties: scene.variantProperties ?? {},
      } as ComponentNode;
    } else {
      result = {
        kind: "component-set",
        ...frame,
        variantAxes: Object.entries(scene.variantGroupProperties ?? {}).map(
          ([name, axis]) => ({ name, values: axis.values }),
        ),
        children: children as ComponentNode[],
      } as ComponentSetNode;
    }
  } else if (scene.type === "TEXT") {
    result = {
      kind: "text",
      ...common,
      characters: scene.characters ?? "",
      type: omitTableTextExtras({
        fontFamily: scene.fontName?.family ?? "",
        fontStyle: scene.fontName?.style ?? "",
        ...(scene.fontProvenance === undefined
          ? {}
          : { fontProvenance: scene.fontProvenance }),
        fontSize: scene.fontSize ?? 0,
        lineHeight:
          scene.lineHeight?.unit === "AUTO"
            ? { unit: "auto" }
            : scene.lineHeight?.unit === "PERCENT"
              ? { unit: "percent", value: scene.lineHeight.value ?? 0 }
              : { unit: "px", value: scene.lineHeight?.value ?? 0 },
      }),
      align: (scene.textAlignHorizontal ?? "LEFT").toLowerCase() as "left",
      verticalAlign: (scene.textAlignVertical ?? "TOP").toLowerCase() as "top",
      fills,
      width: irSizing(scene.layoutSizingHorizontal, scene.width),
      height: irSizing(scene.layoutSizingVertical, scene.height),
    };
  } else if (scene.type === "INSTANCE") {
    const properties = canonicalizeObservedComponentProperties(
      scene.componentProperties,
    );
    const componentRef = recoverRecipeComponentRef(
      scene.componentRef ?? "",
      sceneRole(scene),
      properties,
    );
    result = {
      kind: "instance",
      ...common,
      componentRef,
      properties,
      ...(shouldOmitEmptyInstancePayload(scene.instancePayload) ||
      componentRef === "calendar@1/day" ||
      componentRef === "calendar@1/week"
        ? {}
        : {
            payload: {
              content: scene.instancePayload!.content!,
              typography: scene.instancePayload!.typography,
              fills: (scene.instancePayload!.fills ?? []).map(scenePaintToIr),
              opacity: scene.instancePayload!.opacity ?? scene.opacity,
              intrinsicSize: scene.instancePayload!.intrinsicSize ?? {
                width: scene.width,
                height: scene.height,
              },
              padding: scene.instancePayload!.padding ?? {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
              alignment: scene.instancePayload!.alignment ?? {
                horizontal: "center" as const,
                vertical: "center" as const,
              },
              accessibility: scene.instancePayload!.accessibility ?? {
                relation: "none" as const,
                decorative: true,
              },
              source:
                scene.instancePayload!.source ?? "scene-description-missing",
            },
          }),
      width: irSizing(scene.layoutSizingHorizontal, scene.width),
      height: irSizing(scene.layoutSizingVertical, scene.height),
    };
  } else if (scene.type === "VECTOR") {
    result = {
      kind: "vector",
      ...common,
      assetRef: scene.instancePayload?.assets[0] ?? "",
      fills,
      width: irSizing(scene.layoutSizingHorizontal, scene.width),
      height: irSizing(scene.layoutSizingVertical, scene.height),
    };
  } else {
    result = {
      kind: "shape",
      ...common,
      shape: scene.type === "RECTANGLE" ? "rectangle" : "ellipse",
      width: irSizing(scene.layoutSizingHorizontal, scene.width),
      height: irSizing(scene.layoutSizingVertical, scene.height),
      fills,
      ...(strokes === undefined ? {} : { strokes }),
      ...(effects === undefined ? {} : { effects }),
      ...(scene.cornerRadius === undefined
        ? {}
        : { cornerRadius: scene.cornerRadius }),
    };
  }
  return IRNodeSchema.parse(result);
}

const FONT_PROVENANCE_NAME_MARKER = "font-provenance=";

export function canonicalizeObservedFontProvenanceName(name: string): string {
  const index = name.indexOf(FONT_PROVENANCE_NAME_MARKER);
  if (index < 0) return name;
  const prefix = name.slice(0, index + FONT_PROVENANCE_NAME_MARKER.length);
  const encoded = name.slice(index + FONT_PROVENANCE_NAME_MARKER.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return name;
    return `${prefix}${encodeURIComponent(canonicalJson(parsed))}`;
  } catch {
    return name;
  }
}

const observeSceneFacts = (root: SceneNodeSnapshot): SceneFact[] => {
  void CALENDAR_LIVE_V1_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER;
  const normalized = sceneToNormalizedIr(root);
  const byOwnership = new Map<string, SceneNodeSnapshot>();
  const index = (scene: SceneNodeSnapshot): void => {
    if (byOwnership.has(scene.ownershipKey))
      throw new TypeError(
        `duplicate scene ownership key ${scene.ownershipKey}`,
      );
    byOwnership.set(scene.ownershipKey, scene);
    for (const child of scene.children) index(child);
  };
  index(root);
  const projected = compileExpectedScenePlan(normalized, {
    rootOwnershipKey: root.ownershipKey,
    instancePayload: (node, ownershipKey) => {
      const payload = byOwnership.get(ownershipKey)?.instancePayload;
      return shouldOmitObservedInstancePayload(node, payload)
        ? undefined
        : payload;
    },
  });
  return projected.facts.map((fact) => {
    const scene = byOwnership.get(fact.nodeOwnershipKey);
    if (!scene)
      throw new TypeError(`scene projection lost ${fact.nodeOwnershipKey}`);
    if (fact.channel === "name")
      return {
        ...fact,
        value: canonicalizeObservedFontProvenanceName(scene.name),
      };
    if (fact.channel === "componentRef")
      return {
        ...fact,
        value: recoverRecipeComponentRef(
          String(fact.value),
          sceneRole(scene),
          canonicalizeObservedComponentProperties(scene.componentProperties),
        ),
      };
    if (fact.channel === "role") return { ...fact, value: sceneRole(scene) };
    if (fact.channel === "visible")
      return {
        ...fact,
        value: isHiddenFillOccupancy(scene) ? true : scene.visible,
      };
    if (fact.channel === "opacity")
      return {
        ...fact,
        value: isHiddenFillOccupancy(scene) ? 0 : scene.opacity,
      };
    return fact;
  });
};

const valueKey = (value: unknown): string => canonicalJson(value);

const groupFacts = (facts: readonly SceneFact[]): Map<string, SceneFact[]> => {
  const grouped = new Map<string, SceneFact[]>();
  for (const fact of facts) {
    grouped.set(fact.baseId, [...(grouped.get(fact.baseId) ?? []), fact]);
  }
  return grouped;
};

export function contentTextOwnershipKeysWithoutCompileOpacity(
  root: IRNode,
  rootOwnershipKey = "root",
): Set<string> {
  void CALENDAR_LIVE_V1_COLLAPSE_OMIT_INVENTED_OPACITY_MARKER;
  const keys = new Set<string>();
  const visit = (node: IRNode, key: string): void => {
    if (
      node.kind === "text" &&
      node.role !== undefined &&
      (CALENDAR_LIVE_V1_CONTENT_ROLES as readonly string[]).includes(node.role) &&
      node.opacity === undefined
    )
      keys.add(key);
    if (
      node.kind === "frame" ||
      node.kind === "component" ||
      node.kind === "component-set"
    ) {
      for (const [index, child] of node.children.entries())
        visit(child, `${key}/children/${index}`);
    }
  };
  visit(root, rootOwnershipKey);
  return keys;
}

export function omitInventedDefaultContentTextOpacityFacts(
  facts: readonly SceneFact[],
  omitKeys: ReadonlySet<string>,
): SceneFact[] {
  return facts.filter(
    (fact) =>
      !(fact.channel === "opacity" && omitKeys.has(fact.nodeOwnershipKey)),
  );
}

const OBSERVABLE_CHANNELS = new Set([
  "kind",
  "name",
  "role",
  "visible",
  "opacity",
  "binding",
  "fill",
  "stroke",
  "effect",
  "cornerRadius",
  "layout.mode",
  "layout.primaryAxisAlign",
  "layout.counterAxisAlign",
  "layout.itemSpacing",
  "layout.padding",
  "layout.minWidth",
  "layout.minHeight",
  "layout.positioning",
  "layout.offset",
  "layout.constraints",
  "width.mode",
  "width.value",
  "height.mode",
  "height.value",
  "clipsContent",
  "child",
  "characters",
  "type",
  "align",
  "verticalAlign",
  "variantProperties",
  "variantAxis",
  "componentRef",
  "properties",
  "instancePayload",
  "assetRef",
]);

export function compareSceneToExpectedPlan(
  expected: ExpectedScenePlan,
  scene: SceneNodeSnapshot,
  options?: { omitOpacityOwnershipKeys?: ReadonlySet<string> },
): SceneComparison {
  if (expected.version !== SCENE_READBACK_VERSION)
    throw new TypeError(`unsupported scene plan version ${expected.version}`);
  const omitKeys = options?.omitOpacityOwnershipKeys;
  const expectedFacts = omitKeys
    ? omitInventedDefaultContentTextOpacityFacts(expected.facts, omitKeys)
    : expected.facts;
  const observed = omitKeys
    ? omitInventedDefaultContentTextOpacityFacts(
        observeSceneFacts(scene),
        omitKeys,
      )
    : observeSceneFacts(scene);
  const unobserved = expectedFacts.filter(
    (fact) => !OBSERVABLE_CHANNELS.has(fact.channel),
  );
  const expectedByBase = groupFacts(
    expectedFacts.filter((fact) => OBSERVABLE_CHANNELS.has(fact.channel)),
  );
  const observedByBase = groupFacts(observed);
  const missing: SceneFact[] = [];
  const extra: SceneFact[] = [];
  const mismatched: Array<{ expected: SceneFact; observed: SceneFact }> = [];
  const duplicateCollapsed: SceneFact[] = [];
  let matched = 0;
  for (const baseId of new Set([
    ...expectedByBase.keys(),
    ...observedByBase.keys(),
  ])) {
    const wanted = [...(expectedByBase.get(baseId) ?? [])];
    const found = [...(observedByBase.get(baseId) ?? [])];
    const used = new Set<number>();
    const remainingExpected: SceneFact[] = [];
    for (const fact of wanted) {
      const match = found.findIndex(
        (candidate, index) =>
          !used.has(index) &&
          valueKey(candidate.value) === valueKey(fact.value),
      );
      if (match >= 0) {
        used.add(match);
        matched += 1;
      } else {
        remainingExpected.push(fact);
      }
    }
    const remainingObserved = found.filter((_, index) => !used.has(index));
    const paired = Math.min(remainingExpected.length, remainingObserved.length);
    for (let index = 0; index < paired; index += 1) {
      mismatched.push({
        expected: remainingExpected[index]!,
        observed: remainingObserved[index]!,
      });
    }
    const absent = remainingExpected.slice(paired);
    if (found.length === 0) missing.push(...absent);
    else {
      for (const fact of absent) {
        const duplicateCount = wanted.filter(
          (candidate) => valueKey(candidate.value) === valueKey(fact.value),
        ).length;
        const observedDuplicateCount = found.filter(
          (candidate) => valueKey(candidate.value) === valueKey(fact.value),
        ).length;
        if (duplicateCount > observedDuplicateCount)
          duplicateCollapsed.push(fact);
        else missing.push(fact);
      }
    }
    extra.push(...remainingObserved.slice(paired));
  }
  const silent = expectedFacts.length - matched;
  const failures = [
    ...missing.map((fact) => `missing ${fact.id}`),
    ...extra.map((fact) => `extra ${fact.id}`),
    ...mismatched.map(({ expected: fact }) => `mismatched ${fact.id}`),
    ...duplicateCollapsed.map((fact) => `duplicate-collapsed ${fact.id}`),
    ...unobserved.map((fact) => `unobserved ${fact.id}`),
  ];
  return {
    ok: failures.length === 0 && silent === 0,
    denominator: expectedFacts.length + expected.typedReceipts.length,
    matched,
    codeOnly: expected.typedReceipts.filter(
      (receipt) => receipt.disposition === "code-only",
    ).length,
    refused: expected.typedReceipts.filter(
      (receipt) => receipt.disposition === "refused",
    ).length,
    silent,
    missing,
    extra,
    mismatched,
    duplicateCollapsed,
    unobserved,
    failures,
  };
}

export interface SceneFixedPointReport {
  comparison: SceneComparison;
  cycle1: string;
  cycle2: string;
  stable: boolean;
}

export function verifySceneDerivedFixedPoint<Instance>(
  scene: SceneNodeSnapshot,
  baseEnvelope: RecipeEnvelope,
  selection: unknown,
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): SceneFixedPointReport {
  const observedIr = sceneToNormalizedIr(scene);
  const observedEnvelope = structuredClone(baseEnvelope);
  observedEnvelope.ir = observedIr;
  observedEnvelope.integrity.canonicalHash =
    hashRecipeEnvelope(observedEnvelope);
  const collapsed1 = collapse(observedEnvelope, selection);
  const envelope1 = compile(collapsed1);
  const comparison = compareSceneToExpectedPlan(
    compileExpectedScenePlan(envelope1.ir, {
      rootOwnershipKey: scene.ownershipKey,
    }),
    scene,
    {
      omitOpacityOwnershipKeys: contentTextOwnershipKeysWithoutCompileOpacity(
        envelope1.ir,
        scene.ownershipKey,
      ),
    },
  );
  const collapsed2 = collapse(envelope1, selection);
  const envelope2 = compile(collapsed2);
  const cycle1 = canonicalJson(envelope1.ir);
  const cycle2 = canonicalJson(envelope2.ir);
  return {
    comparison,
    cycle1,
    cycle2,
    stable: comparison.ok && cycle1 === cycle2,
  };
}
