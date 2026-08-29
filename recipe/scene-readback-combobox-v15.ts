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
import { normalizeFigmaUnit } from "./figma-property-normalizer.js";

/**
 * Carried Combobox live v15 scene-readback. Keeps v1 host-normalize,
 * v2–v4 extract teachings, v5 empty-payload omit, v6 live-root
 * observeSceneFacts, v7 recipe componentRef recovery, v8 writer
 * ARIA stamps, v9 name-before-`#` property recovery, v10 trigger
 * binding compile-order, v11 leading-slot binding compile-order,
 * v12 leading-slot compile-carry visible, v13 trailing-slot
 * binding compile-order, and v14 trailing-slot compile-carry
 * visible. Teaches host to omit empty `effects` on
 * `combobox/trigger` that compile never emits. Same class as Input
 * variant effects omit / surface dashPattern omit. Reuses that
 * omit-empty path on trigger only. Does not invent an effects
 * value. Does not omit overlay compile-carried drop-shadow. Does
 * not also teach listbox empty effects. Does not invent a
 * Combobox-only `if (combobox)`. Does not patch hashed v1–v14
 * lineage bytes. Writer bytes stay frozen.
 */
export const SCENE_READBACK_VERSION = 1;
export const SCENE_READBACK_V15_TAUGHT_FILL_KINDS = [
  "VARIABLE_ALIAS",
  "boundVariablesOnly",
] as const;
export const COMBOBOX_LIVE_V15_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER =
  "COMBOBOX-HOST-OMIT-EMPTY-INSTANCE-PAYLOAD";
export const COMBOBOX_LIVE_V15_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER =
  "COMBOBOX-HOST-PROJECT-LIVE-ROOT-OWNERSHIP-KEY";
export const COMBOBOX_LIVE_V15_RECOVER_RECIPE_COMPONENT_REF_MARKER =
  "COMBOBOX-HOST-RECOVER-RECIPE-COMPONENT-REF";
export const COMBOBOX_LIVE_V15_RECOVER_COMPONENT_PROPERTY_NAME_MARKER =
  "COMBOBOX-HOST-RECOVER-COMPONENT-PROPERTY-NAME-BEFORE-HASH";
export const COMBOBOX_LIVE_V15_TRIGGER_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-TRIGGER-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V15_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL";
export const COMBOBOX_LIVE_V15_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER =
  "COMBOBOX-LEADING-SLOT-COMPILE-CARRY-VISIBLE-TRUE";
export const COMBOBOX_LIVE_V15_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER-WIDTH-HEIGHT-FILL";
export const COMBOBOX_LIVE_V15_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER =
  "COMBOBOX-TRAILING-SLOT-COMPILE-CARRY-VISIBLE-TRUE";
export const COMBOBOX_LIVE_V15_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-TRIGGER-EMPTY-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_SLOT_FILL_MARKER = "COMBOBOX-SLOT-FILL-FROM-PAYLOAD";
export const COMBOBOX_LIVE_V1_SLOT_COLOR_BINDING_MARKER =
  "COMBOBOX-SLOT-COLOR-BINDING-FROM-CHILD";
export const COMBOBOX_LIVE_V1_SURFACE_STROKE_WEIGHT_MARKER =
  "COMBOBOX-SURFACE-STROKE-WEIGHT-FROM-PER-SIDE";
export const COMBOBOX_LIVE_V1_VARIANT_LAYOUT_WIDTH_MARKER =
  "COMBOBOX-VARIANT-LAYOUT-WIDTH-FROM-WIDTH";
export const COMBOBOX_LIVE_V1_SURFACE_LAYOUT_HEIGHT_MARKER =
  "COMBOBOX-SURFACE-LAYOUT-HEIGHT-FROM-HEIGHT";
export const COMBOBOX_LIVE_V1_VARIANT_LAYOUT_WIDTH_ALIAS_MARKER =
  "COMBOBOX-VARIANT-LAYOUT-WIDTH-ALIAS-NO-DUPLICATE-WIDTH-VALUE";
export const COMBOBOX_LIVE_V1_VARIANT_LAYOUT_WIDTH_COMPILE_INDEX_MARKER =
  "COMBOBOX-VARIANT-LAYOUT-WIDTH-ALIAS-COMPILE-INDEX";
export const COMBOBOX_LIVE_V1_SURFACE_BINDING_EXTRAS_MARKER =
  "INPUT-SURFACE-BINDING-EXTRAS-DROPPED";
export const COMBOBOX_LIVE_V1_SURFACE_BINDING_COMPILE_ORDER_MARKER =
  "INPUT-SURFACE-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_CONTENT_BINDING_EXTRAS_MARKER =
  "COMBOBOX-CONTENT-BINDING-EXTRAS-DROPPED";
export const COMBOBOX_LIVE_V1_CONTENT_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-CONTENT-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_CONTENT_HIDDEN_HEIGHT_HUG_MARKER =
  "COMBOBOX-CONTENT-HIDDEN-FIXED-HEIGHT-AS-HUG";
export const COMBOBOX_LIVE_V1_CONTENT_LETTER_SPACING_OMITTED_MARKER =
  "COMBOBOX-CONTENT-LETTER-SPACING-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_TEXT_CASE_OMITTED_MARKER =
  "COMBOBOX-CONTENT-TEXT-CASE-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_TEXT_DECORATION_OMITTED_MARKER =
  "COMBOBOX-CONTENT-TEXT-DECORATION-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_OPACITY_OMITTED_MARKER =
  "COMBOBOX-CONTENT-OPACITY-OMITTED";
export const COMBOBOX_LIVE_V1_COMPILE_CARRY_LIVE_VISIBLE_MARKER =
  "COMBOBOX-COMPILE-CARRY-LIVE-VISIBLE";
export const COMBOBOX_LIVE_V1_COMPILE_CARRY_LIVE_OPACITY_MARKER =
  "COMBOBOX-COMPILE-CARRY-LIVE-OPACITY";
export const COMBOBOX_LIVE_V1_COLLAPSE_OMIT_INVENTED_CONTENT_TEXT_OPACITY_MARKER =
  "COMBOBOX-COLLAPSE-OMIT-INVENTED-CONTENT-TEXT-OPACITY";
export const COMBOBOX_LIVE_V1_CONTENT_ROW_CLIPS_CONTENT_OMITTED_MARKER =
  "COMBOBOX-CONTENT-ROW-CLIPS-CONTENT-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_ROW_CORNER_RADIUS_OMITTED_MARKER =
  "COMBOBOX-CONTENT-ROW-CORNER-RADIUS-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_ROW_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-CONTENT-ROW-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_CONTENT_ROW_STROKES_OMITTED_MARKER =
  "COMBOBOX-CONTENT-ROW-STROKES-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_BINDING_EXTRAS_MARKER =
  "COMBOBOX-LABEL-BINDING-EXTRAS-DROPPED";
export const COMBOBOX_LIVE_V1_LABEL_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-LABEL-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_LABEL_LETTER_SPACING_OMITTED_MARKER =
  "COMBOBOX-LABEL-LETTER-SPACING-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_TEXT_CASE_OMITTED_MARKER =
  "COMBOBOX-LABEL-TEXT-CASE-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_TEXT_DECORATION_OMITTED_MARKER =
  "COMBOBOX-LABEL-TEXT-DECORATION-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_ROW_CLIPS_CONTENT_OMITTED_MARKER =
  "COMBOBOX-LABEL-ROW-CLIPS-CONTENT-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_ROW_CORNER_RADIUS_OMITTED_MARKER =
  "COMBOBOX-LABEL-ROW-CORNER-RADIUS-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_ROW_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-LABEL-ROW-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_ROW_STROKES_OMITTED_MARKER =
  "COMBOBOX-LABEL-ROW-STROKES-OMITTED";
export const COMBOBOX_LIVE_V1_SURFACE_STROKE_DASH_PATTERN_OMITTED_MARKER =
  "INPUT-SURFACE-STROKE-DASH-PATTERN-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-MESSAGE-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_MESSAGE_LETTER_SPACING_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-LETTER-SPACING-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_TEXT_CASE_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-TEXT-CASE-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_TEXT_DECORATION_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-TEXT-DECORATION-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_CONTAINER_CLIPS_CONTENT_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-CONTAINER-CLIPS-CONTENT-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_CONTAINER_CORNER_RADIUS_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-CONTAINER-CORNER-RADIUS-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_CONTAINER_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-CONTAINER-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_MESSAGE_CONTAINER_STROKES_OMITTED_MARKER =
  "COMBOBOX-MESSAGE-CONTAINER-STROKES-OMITTED";
export const COMBOBOX_LIVE_V1_VARIANT_CORNER_RADIUS_OMITTED_MARKER =
  "COMBOBOX-VARIANT-CORNER-RADIUS-OMITTED";
export const COMBOBOX_LIVE_V1_VARIANT_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-VARIANT-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_VARIANT_STROKES_OMITTED_MARKER =
  "COMBOBOX-VARIANT-STROKES-OMITTED";
export const COMBOBOX_LIVE_V1_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-LEADING-SLOT-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS = [
  "width.value",
  "height.value",
  "fills.0.color",
] as const;
export const COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES = [
  "combobox/control/leading",
] as const;
export const COMBOBOX_LIVE_V1_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-TRAILING-SLOT-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS = [
  "width.value",
  "height.value",
  "fills.0.color",
] as const;
export const COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES = [
  "combobox/control/clear",
  "combobox/control/popup",
] as const;
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_BINDING_EXTRAS_MARKER =
  "COMBOBOX-REQUIRED-INDICATOR-BINDING-EXTRAS-DROP";
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-REQUIRED-INDICATOR-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "type.lineHeight.value",
  "fills.0.color",
] as const;
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_ROLES = [
  "combobox/required-indicator-absent",
] as const;
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_LETTER_SPACING_OMITTED_MARKER =
  "COMBOBOX-REQUIRED-INDICATOR-LETTER-SPACING-OMITTED";
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_TEXT_CASE_OMITTED_MARKER =
  "COMBOBOX-REQUIRED-INDICATOR-TEXT-CASE-OMITTED";
export const COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_TEXT_DECORATION_OMITTED_MARKER =
  "COMBOBOX-REQUIRED-INDICATOR-TEXT-DECORATION-OMITTED";
export const COMBOBOX_LIVE_V1_SET_CORNER_RADIUS_OMITTED_MARKER =
  "COMBOBOX-SET-CORNER-RADIUS-OMITTED";
export const COMBOBOX_LIVE_V1_SET_EFFECTS_OMITTED_MARKER =
  "COMBOBOX-SET-EFFECTS-OMITTED";
export const COMBOBOX_LIVE_V1_SET_FILLS_OMITTED_MARKER =
  "COMBOBOX-SET-FILLS-OMITTED";
export const COMBOBOX_LIVE_V1_SET_STROKES_OMITTED_MARKER =
  "COMBOBOX-SET-STROKES-OMITTED";
export const COMBOBOX_LIVE_V1_LABEL_ROW_BINDING_COMPILE_ORDER_MARKER =
  "COMBOBOX-LABEL-ROW-BINDING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_LABEL_ROW_COMPILE_BINDING_FIELDS = [
  "layout.itemSpacing",
  "layout.padding.top",
  "layout.padding.left",
] as const;
export const COMBOBOX_LIVE_V1_LABEL_ROW_ROLES = [
  "combobox/label-row-absent",
] as const;
export const COMBOBOX_LIVE_V1_SURFACE_LAYOUT_HEIGHT_ALIAS_MARKER =
  "COMBOBOX-SURFACE-LAYOUT-HEIGHT-ALIAS-NO-DUPLICATE-HEIGHT-VALUE";
export const COMBOBOX_LIVE_V1_SURFACE_BINDING_ITEM_SPACING_COMPILE_ORDER_MARKER =
  "INPUT-SURFACE-BINDING-ITEM-SPACING-COMPILE-ORDER";
export const COMBOBOX_LIVE_V1_FONT_PROVENANCE_NAME_ORDER_MARKER =
  "COMBOBOX-FONT-PROVENANCE-NAME-KEY-ORDER-COMPILE";
export const COMBOBOX_LIVE_V1_INSTANCE_PAYLOAD_FILL_KIND_MARKER =
  "COMBOBOX-INSTANCE-PAYLOAD-FILL-KIND-COMPILE";
export const COMBOBOX_LIVE_V1_VARIANT_AXIS_SIZE_ORDER_MARKER =
  "COMBOBOX-VARIANT-AXIS-SIZE-ORDER-COMPILE";
export const COMBOBOX_LIVE_V1_UNNAMED_SOURCE_PX_CARRIED_MARKER =
  "COMBOBOX-UNNAMED-SOURCE-PX-CARRIED-NOT-REQUIRED-EQUALS";
export const COMBOBOX_LIVE_V1_SIZE_AXIS_COMPILE_VALUES = [
  "small",
  "medium",
] as const;
export const COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS = [
  "layout.itemSpacing",
  "layout.padding.left",
  "layout.padding.right",
  "layout.height.value",
  "layout.minWidth",
  "layout.minHeight",
  "fills.0.color",
  "strokes.0.weight",
  "strokes.0.paint.color",
  "cornerRadius.topLeft",
  "cornerRadius.topRight",
  "cornerRadius.bottomRight",
  "cornerRadius.bottomLeft",
] as const;
export const COMBOBOX_LIVE_V1_CONTENT_COMPILE_BINDING_FIELDS = [
  "type.fontSize",
  "type.lineHeight.value",
  "fills.0.color",
] as const;
export const COMBOBOX_LIVE_V1_SLOT_ROLES = [
  "combobox/control/leading",
  "combobox/control/clear",
  "combobox/control/popup",
  "combobox/option/selected-indicator",
] as const;
export const COMBOBOX_LIVE_V1_SURFACE_ROLES = ["combobox/trigger"] as const;
export const COMBOBOX_LIVE_V1_CONTENT_ROLES = [
  "combobox/input",
  "combobox/option/label",
  "combobox/listbox/empty",
  "combobox/listbox/loading",
] as const;
export const COMBOBOX_LIVE_V1_LABEL_ROLES = ["combobox/label"] as const;
export const COMBOBOX_LIVE_V1_MESSAGE_ROLES = [
  "combobox/message/helper",
  "combobox/message/error",
] as const;
export const COMBOBOX_LIVE_V1_VARIANT_ROLE_PREFIX = "combobox/variant/";
const isComboboxComponentVariantRole = (role: string | undefined): boolean =>
  role !== undefined &&
  (role.startsWith(COMBOBOX_LIVE_V1_VARIANT_ROLE_PREFIX) ||
    /^combobox\/option\/(?:small|medium)\//.test(role));
export const COMBOBOX_LIVE_V1_PER_SIDE_STROKE_WEIGHT_FIELDS = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

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
  fields?: string[];
  boundVariables?: Readonly<Record<string, unknown>>;
}

export type ScenePayloadPaint = Paint | ScenePaint;

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

/**
 * Serializable output of a Figma scene walk. `ownershipKey` is the only
 * plugin-data-derived field: it joins a planned node to its minted node.
 * Every other value must come from a live SceneNode property.
 */
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
    fills?: ScenePayloadPaint[];
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
  /** Deliberately ignored. Tests plant forged source IR here. */
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

export interface ExpectedScenePlan {
  version: typeof SCENE_READBACK_VERSION;
  rootOwnershipKey: string;
  facts: SceneFact[];
  typedReceipts: TypedFactReceipt[];
  /**
   * Identity-only expectations for read-only descendants materialized by
   * Figma inside an owned instance. These records contain no scene facts.
   */
  generatedDescendants: SceneGeneratedDescendantIdentity[];
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

export interface SceneIdentityNode {
  type: SceneNodeType;
  ownershipKey?: string;
  runIdentity?: string;
  adapterIdentity?: string;
  recipeHash?: string;
  envelopeHash?: string;
  mainComponentRef?: string | null;
  children: SceneIdentityNode[];
}

const encodedIdentityPart = (value: string): string =>
  encodeURIComponent(value).replaceAll("%", "~");

/**
 * The key deliberately contains only ownership and structural identity.
 * Visual, layout, text, paint, and style values never participate.
 */
export function sceneGeneratedDescendantOwnershipKey(
  ownedAncestorKey: string,
  ownedAncestorMainComponentRef: string,
  lineage: readonly SceneGeneratedIdentitySegment[],
): string {
  const steps = lineage.map(
    ({ type, childIndex, occurrence, mainComponentRef }) =>
      `${childIndex}:${occurrence}:${type}:${
        mainComponentRef === undefined
          ? "-"
          : encodedIdentityPart(mainComponentRef)
      }`,
  );
  return `${ownedAncestorKey}/generated/${encodedIdentityPart(
    ownedAncestorMainComponentRef,
  )}/${steps.join("/")}`;
}

export function createSceneGeneratedDescendantIdentity(
  ownedAncestorKey: string,
  ownedAncestorMainComponentRef: string,
  lineage: readonly SceneGeneratedIdentitySegment[],
): SceneGeneratedDescendantIdentity {
  if (lineage.length === 0)
    throw new TypeError("generated scene lineage must not be empty");
  return {
    ownershipKey: sceneGeneratedDescendantOwnershipKey(
      ownedAncestorKey,
      ownedAncestorMainComponentRef,
      lineage,
    ),
    ownedAncestorKey,
    ownedAncestorMainComponentRef,
    lineage: lineage.map((segment) => ({ ...segment })),
  };
}

const identitySignature = (node: SceneIdentityNode): string =>
  `${node.type}\0${node.type === "INSTANCE" ? (node.mainComponentRef ?? "") : ""}`;

/**
 * Offline mirror of the Figma runtime ownership resolver. It proves that an
 * unowned node is accepted only as an exact planned descendant of one owned
 * instance; it does not project any scene property as a fact.
 */
export function resolveSceneOwnershipIdentities(
  root: SceneIdentityNode,
  expected: readonly SceneGeneratedDescendantIdentity[],
  owner: {
    ownershipKey: string;
    runIdentity: string;
    adapterIdentity: string;
    recipeHash: string;
    envelopeHash: string;
  },
): Map<SceneIdentityNode, string> {
  if (
    root.type !== "INSTANCE" ||
    root.ownershipKey !== owner.ownershipKey ||
    root.runIdentity !== owner.runIdentity ||
    root.adapterIdentity !== owner.adapterIdentity ||
    root.recipeHash !== owner.recipeHash ||
    root.envelopeHash !== owner.envelopeHash
  ) {
    throw new TypeError("SCENE-OWNED-INSTANCE-IDENTITY-MISMATCH");
  }
  if (!root.mainComponentRef)
    throw new TypeError("SCENE-OWNED-INSTANCE-MAIN-COMPONENT-ABSENT");
  const planned = new Map(
    expected.map((entry) => [entry.ownershipKey, entry] as const),
  );
  if (planned.size !== expected.length)
    throw new TypeError("SCENE-DERIVED-IDENTITY-PLAN-DUPLICATE");
  const resolved = new Map<SceneIdentityNode, string>([
    [root, root.ownershipKey],
  ]);
  const used = new Set<string>([root.ownershipKey]);
  const visit = (
    node: SceneIdentityNode,
    lineage: SceneGeneratedIdentitySegment[],
  ): void => {
    const counts = new Map<string, number>();
    node.children.forEach((child, childIndex) => {
      if (child.ownershipKey)
        throw new TypeError(
          `SCENE-GENERATED-DESCENDANT-DIRECT-KEY:${child.ownershipKey}`,
        );
      if (child.type === "COMPONENT" || child.type === "COMPONENT_SET")
        throw new TypeError(
          `SCENE-GENERATED-COMPONENT-DESCENDANT:${child.type}`,
        );
      if (child.type === "INSTANCE" && !child.mainComponentRef)
        throw new TypeError("SCENE-GENERATED-INSTANCE-MAIN-COMPONENT-ABSENT");
      const signature = identitySignature(child);
      const occurrence = counts.get(signature) ?? 0;
      counts.set(signature, occurrence + 1);
      const segment: SceneGeneratedIdentitySegment = {
        type: child.type,
        childIndex,
        occurrence,
        ...(child.type === "INSTANCE"
          ? { mainComponentRef: child.mainComponentRef! }
          : {}),
      };
      const childLineage = [...lineage, segment];
      const ownershipKey = sceneGeneratedDescendantOwnershipKey(
        root.ownershipKey!,
        root.mainComponentRef!,
        childLineage,
      );
      const expectedIdentity = planned.get(ownershipKey);
      if (
        expectedIdentity === undefined ||
        expectedIdentity.ownedAncestorKey !== root.ownershipKey ||
        expectedIdentity.ownedAncestorMainComponentRef !==
          root.mainComponentRef ||
        canonicalJson(expectedIdentity.lineage) !== canonicalJson(childLineage)
      ) {
        throw new TypeError(
          `SCENE-DERIVED-IDENTITY-UNEXPECTED:${ownershipKey}`,
        );
      }
      if (used.has(ownershipKey))
        throw new TypeError(`SCENE-OWNERSHIP-COLLISION:${ownershipKey}`);
      used.add(ownershipKey);
      resolved.set(child, ownershipKey);
      visit(child, childLineage);
    });
  };
  visit(root, []);
  const missing = expected
    .filter((entry) => entry.ownedAncestorKey === root.ownershipKey)
    .filter((entry) => !used.has(entry.ownershipKey));
  if (missing.length > 0)
    throw new TypeError(
      `SCENE-DERIVED-IDENTITY-MISSING:${missing
        .map((entry) => entry.ownershipKey)
        .join(",")}`,
    );
  return resolved;
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
  if (
    node.role !== undefined &&
    node.label !== undefined &&
    node.role !== node.label
  ) {
    return `${node.role} :: ${node.label}`;
  }
  return base;
};

const sizingMode = (sizing: Sizing): "FIXED" | "HUG" | "FILL" =>
  sizing.mode.toUpperCase() as "FIXED" | "HUG" | "FILL";

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
      for (const lineage of options.generatedDescendantLineages?.(node, key) ??
        []) {
        generatedDescendants.push(
          createSceneGeneratedDescendantIdentity(
            key,
            node.componentRef,
            lineage,
          ),
        );
      }
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
    } else if (node.kind === "vector") {
      emit(seeds, key, "assetRef", node.assetRef, "vector payload");
    }
  };
  const rootKey = options.rootOwnershipKey ?? "root";
  visit(root, rootKey);
  const typedReceipts = options.typedReceipts ?? [];
  if (
    new Set(typedReceipts.map((receipt) => receipt.id)).size !==
    typedReceipts.length
  ) {
    throw new TypeError("typed fact receipt IDs must be unique");
  }
  if (
    new Set(generatedDescendants.map((entry) => entry.ownershipKey)).size !==
    generatedDescendants.length
  ) {
    throw new TypeError("generated scene ownership keys must be unique");
  }
  return {
    version: SCENE_READBACK_VERSION,
    rootOwnershipKey: options.rootOwnershipKey ?? "root",
    facts: withStableOccurrences(seeds),
    typedReceipts,
    generatedDescendants,
  };
}

const boundVariableFields = (paint: ScenePayloadPaint): string[] => {
  if ("fields" in paint && Array.isArray(paint.fields) && paint.fields.length)
    return paint.fields.map((field) => String(field));
  if (
    "boundVariables" in paint &&
    paint.boundVariables &&
    typeof paint.boundVariables === "object"
  )
    return Object.keys(paint.boundVariables);
  return ["color"];
};

const aliasVariable = (paint: ScenePayloadPaint): string => {
  if (
    "variable" in paint &&
    typeof paint.variable === "string" &&
    paint.variable
  )
    return paint.variable;
  if ("id" in paint && typeof paint.id === "string" && paint.id)
    return paint.id;
  if (
    "boundVariables" in paint &&
    paint.boundVariables &&
    typeof paint.boundVariables === "object"
  ) {
    const color = paint.boundVariables.color;
    if (
      color &&
      typeof color === "object" &&
      "id" in color &&
      typeof color.id === "string"
    )
      return color.id;
  }
  throw new TypeError("scene variable-alias paint has no variable identity");
};

export const scenePaintToIr = (paint: ScenePayloadPaint): Paint => {
  const discriminator =
    "kind" in paint && typeof paint.kind === "string" && paint.kind.length > 0
      ? paint.kind
      : "type" in paint
        ? paint.type
        : undefined;
  if (discriminator === "solid" || discriminator === "SOLID") {
    if (paint.color === undefined) {
      if (
        discriminator === "SOLID" &&
        "boundVariables" in paint &&
        paint.boundVariables
      )
        return {
          kind: "bound-variable",
          fields: boundVariableFields(paint),
          ...(typeof paint.color === "string" ? { color: paint.color } : {}),
        };
      throw new TypeError("scene solid paint has no color");
    }
    return { kind: "solid", color: paint.color };
  }
  if (
    discriminator === "variable-alias" ||
    discriminator === "VARIABLE_ALIAS"
  ) {
    return {
      kind: "variable-alias",
      variable: aliasVariable(paint),
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
      fields: boundVariableFields(paint),
      ...(typeof paint.color === "string" ? { color: paint.color } : {}),
    };
  }
  if (
    discriminator === "linear-gradient" ||
    discriminator === "GRADIENT_LINEAR"
  ) {
    return {
      kind: "linear-gradient",
      angle:
        "angle" in paint && typeof paint.angle === "number" ? paint.angle : 0,
      stops:
        "stops" in paint && Array.isArray(paint.stops)
          ? paint.stops
          : (paint.gradientStops ?? []),
    };
  }
  if (
    discriminator === "radial-gradient" ||
    discriminator === "GRADIENT_RADIAL"
  ) {
    return {
      kind: "radial-gradient",
      stops:
        "stops" in paint && Array.isArray(paint.stops)
          ? paint.stops
          : (paint.gradientStops ?? []),
    };
  }
  if (discriminator === "image" || discriminator === "IMAGE") {
    const assetRef =
      "assetRef" in paint && typeof paint.assetRef === "string"
        ? paint.assetRef
        : undefined;
    const scaleMode =
      "scaleMode" in paint && typeof paint.scaleMode === "string"
        ? paint.scaleMode
        : undefined;
    if (assetRef === undefined || scaleMode === undefined)
      throw new TypeError("scene image paint has no asset payload");
    return {
      kind: "image",
      assetRef,
      scaleMode: scaleMode.toLowerCase() as "fill" | "fit" | "tile" | "stretch",
    };
  }
  if (
    !discriminator &&
    "boundVariables" in paint &&
    paint.boundVariables &&
    Object.keys(paint.boundVariables).length > 0
  ) {
    return {
      kind: "bound-variable",
      fields: boundVariableFields(paint),
      ...(typeof paint.color === "string" ? { color: paint.color } : {}),
    };
  }
  throw new TypeError(
    `scene paint kind ${String(discriminator)} is not a taught live fill`,
  );
};

const sceneEffectToIr = (effect: SceneEffect): Effect => {
  if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
    return {
      kind: effect.type === "LAYER_BLUR" ? "layer-blur" : "background-blur",
      blur: effect.radius,
    };
  }
  if (effect.color === undefined)
    throw new TypeError("scene shadow has no color");
  return {
    kind: effect.type === "DROP_SHADOW" ? "drop-shadow" : "inner-shadow",
    offsetX: effect.offset?.x ?? 0,
    offsetY: effect.offset?.y ?? 0,
    blur: effect.radius,
    spread: effect.spread ?? 0,
    color: effect.color,
  };
};

const irFieldForSceneBinding = (field: string): string =>
  ({
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
    letterSpacing: "type.letterSpacing.value",
    "letterSpacing.0": "type.letterSpacing.value",
    width: "width.value",
    height: "height.value",
  })[field] ??
  (field.match(/^fills\.(\d+)$/)
    ? `fills.${field.split(".")[1]}.color`
    : field.match(/^strokes\.(\d+)$/)
      ? `strokes.${field.split(".")[1]}.paint.color`
      : field.match(/^effects\.(\d+)$/)
        ? `effects.${field.split(".")[1]}.color`
        : field);

const sceneBindings = (scene: SceneNodeSnapshot): VariableBinding[] =>
  scene.boundVariables.map((binding) => ({
    field: irFieldForSceneBinding(binding.field),
    type: binding.resolvedType,
    variable: binding.variableName,
  }));

const surfaceSlotColorBindings = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  if (own.some((binding) => binding.field === "fills.0.color")) return own;
  const role = sceneRole(scene);
  if (role === undefined || !SLOT_ROLES.has(role)) return own;
  for (const child of scene.children) {
    const color = sceneBindings(child).find(
      (binding) => binding.field === "fills.0.color" && binding.type === "COLOR",
    );
    if (color) return [...own, color];
  }
  return own;
};

const SURFACE_ROLES = new Set<string>(COMBOBOX_LIVE_V1_SURFACE_ROLES);
const PER_SIDE_STROKE_WEIGHT_FIELDS = new Set([
  "strokes.0.weight.top",
  "strokes.0.weight.right",
  "strokes.0.weight.bottom",
  "strokes.0.weight.left",
]);

const dropDuplicateSurfaceBindings = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !SURFACE_ROLES.has(role)) return own;
  const seen = new Set<string>();
  const out: VariableBinding[] = [];
  for (const binding of own) {
    const key = `${binding.field}\0${binding.type}\0${binding.variable}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(binding);
  }
  return out;
};

const surfaceUniformStrokeWeightBinding = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !SURFACE_ROLES.has(role)) return own;
  if (own.some((binding) => binding.field === "strokes.0.weight"))
    return own.filter((binding) => !PER_SIDE_STROKE_WEIGHT_FIELDS.has(binding.field));
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
    ...own.filter((binding) => !PER_SIDE_STROKE_WEIGHT_FIELDS.has(binding.field)),
    { field: "strokes.0.weight", type: "FLOAT", variable },
  ];
};

const surfaceVariantLayoutWidthBinding = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  if (own.some((binding) => binding.field === "layout.width.value")) return own;
  const role = sceneRole(scene);
  if (
    role === undefined ||
    !isComboboxComponentVariantRole(role)
  )
    return own;
  const width = own.find(
    (binding) => binding.field === "width.value" && binding.type === "FLOAT",
  );
  if (!width || width.variable.length === 0) return own;
  const withoutWidth = own.filter(
    (binding) => binding.field !== "width.value",
  );
  const aliased = {
    field: "layout.width.value",
    type: "FLOAT" as const,
    variable: width.variable,
  };
  const itemSpacingIndex = withoutWidth.findIndex(
    (binding) => binding.field === "layout.itemSpacing",
  );
  if (itemSpacingIndex >= 0)
    return [
      ...withoutWidth.slice(0, itemSpacingIndex + 1),
      aliased,
      ...withoutWidth.slice(itemSpacingIndex + 1),
    ];
  const minWidthIndex = withoutWidth.findIndex(
    (binding) => binding.field === "layout.minWidth",
  );
  if (minWidthIndex >= 0)
    return [
      ...withoutWidth.slice(0, minWidthIndex),
      aliased,
      ...withoutWidth.slice(minWidthIndex),
    ];
  return [...withoutWidth, aliased];
};

const surfaceLayoutHeightBinding = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  if (own.some((binding) => binding.field === "layout.height.value")) return own;
  const role = sceneRole(scene);
  if (role === undefined || !SURFACE_ROLES.has(role)) return own;
  const height = own.find(
    (binding) => binding.field === "height.value" && binding.type === "FLOAT",
  );
  if (!height || height.variable.length === 0) return own;
  return [
    ...own.filter((binding) => binding.field !== "height.value"),
    { field: "layout.height.value", type: "FLOAT", variable: height.variable },
  ];
};

const orderSurfaceBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !SURFACE_ROLES.has(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_SURFACE_COMPILE_BINDING_FIELDS.map((field, index) => [
      field,
      index,
    ]),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const CONTENT_ROLES = new Set<string>(COMBOBOX_LIVE_V1_CONTENT_ROLES);
const LABEL_ROLES = new Set<string>(COMBOBOX_LIVE_V1_LABEL_ROLES);
const MESSAGE_ROLES = new Set<string>(COMBOBOX_LIVE_V1_MESSAGE_ROLES);
const contentOrLabelRole = (role: string | undefined): boolean =>
  role !== undefined && (CONTENT_ROLES.has(role) || LABEL_ROLES.has(role));
const contentLabelOrMessageRole = (role: string | undefined): boolean =>
  contentOrLabelRole(role) ||
  (role !== undefined && MESSAGE_ROLES.has(role));

const dropDuplicateContentBindings = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (!contentOrLabelRole(role)) return own;
  const seen = new Set<string>();
  const out: VariableBinding[] = [];
  for (const binding of own) {
    const key = `${binding.field}\0${binding.type}\0${binding.variable}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(binding);
  }
  return out;
};

const orderContentBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (!contentLabelOrMessageRole(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_CONTENT_COMPILE_BINDING_FIELDS.map((field, index) => [
      field,
      index,
    ]),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const LEADING_SLOT_ROLES = new Set<string>(
  COMBOBOX_LIVE_V1_LEADING_SLOT_ROLES,
);
const TRAILING_SLOT_ROLES = new Set<string>(
  COMBOBOX_LIVE_V1_TRAILING_SLOT_ROLES,
);

const compileCarriedLeadingSlotVisible = (
  scene: SceneNodeSnapshot,
): { visible?: boolean } => {
  void COMBOBOX_LIVE_V15_LEADING_SLOT_COMPILE_CARRY_VISIBLE_MARKER;
  void COMBOBOX_LIVE_V15_TRAILING_SLOT_COMPILE_CARRY_VISIBLE_MARKER;
  void COMBOBOX_LIVE_V1_COMPILE_CARRY_LIVE_VISIBLE_MARKER;
  const role = sceneRole(scene);
  if (
    role !== undefined &&
    (LEADING_SLOT_ROLES.has(role) || TRAILING_SLOT_ROLES.has(role)) &&
    scene.visible !== false
  ) {
    return { visible: true };
  }
  return scene.visible ? {} : { visible: false };
};

const orderLeadingSlotBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  void COMBOBOX_LIVE_V15_LEADING_SLOT_BINDING_COMPILE_ORDER_MARKER;
  const role = sceneRole(scene);
  if (role === undefined || !LEADING_SLOT_ROLES.has(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_LEADING_SLOT_COMPILE_BINDING_FIELDS.map((field, index) => [
      field,
      index,
    ]),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const orderTrailingSlotBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  void COMBOBOX_LIVE_V15_TRAILING_SLOT_BINDING_COMPILE_ORDER_MARKER;
  const role = sceneRole(scene);
  if (role === undefined || !TRAILING_SLOT_ROLES.has(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_TRAILING_SLOT_COMPILE_BINDING_FIELDS.map((field, index) => [
      field,
      index,
    ]),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const REQUIRED_INDICATOR_ROLES = new Set<string>(
  COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_ROLES,
);

const dropDuplicateRequiredIndicatorBindings = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !REQUIRED_INDICATOR_ROLES.has(role)) return own;
  const seen = new Set<string>();
  const out: VariableBinding[] = [];
  for (const binding of own) {
    const key = `${binding.field}\0${binding.type}\0${binding.variable}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(binding);
  }
  return out;
};

const orderRequiredIndicatorBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !REQUIRED_INDICATOR_ROLES.has(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_REQUIRED_INDICATOR_COMPILE_BINDING_FIELDS.map(
      (field, index) => [field, index],
    ),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const LABEL_ROW_ROLES = new Set<string>(COMBOBOX_LIVE_V1_LABEL_ROW_ROLES);

const orderLabelRowBindingsToCompileFields = (
  scene: SceneNodeSnapshot,
  own: VariableBinding[],
): VariableBinding[] => {
  const role = sceneRole(scene);
  if (role === undefined || !LABEL_ROW_ROLES.has(role)) return own;
  const rank = new Map(
    COMBOBOX_LIVE_V1_LABEL_ROW_COMPILE_BINDING_FIELDS.map((field, index) => [
      field,
      index,
    ]),
  );
  const known: VariableBinding[] = [];
  const unknown: VariableBinding[] = [];
  for (const binding of own) {
    if (rank.has(binding.field)) known.push(binding);
    else unknown.push(binding);
  }
  known.sort(
    (left, right) => rank.get(left.field)! - rank.get(right.field)!,
  );
  return [...known, ...unknown];
};

const irSizing = (
  mode: SceneNodeSnapshot["layoutSizingHorizontal"],
  value: number,
): Sizing => {
  if (mode === "HUG") return { mode: "hug" };
  if (mode === "FILL") return { mode: "fill" };
  return { mode: "fixed", value };
};

const sceneLayout = (scene: SceneNodeSnapshot): FrameLayout => ({
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
    { MIN: "min", CENTER: "center", MAX: "max", BASELINE: "baseline" } as const
  )[scene.counterAxisAlignItems ?? "MIN"],
  itemSpacing: scene.itemSpacing ?? 0,
  padding: {
    top: scene.paddingTop ?? 0,
    right: scene.paddingRight ?? 0,
    bottom: scene.paddingBottom ?? 0,
    left: scene.paddingLeft ?? 0,
  },
  width: irSizing(scene.layoutSizingHorizontal, scene.width),
  height: irSizing(scene.layoutSizingVertical, scene.height),
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
});

const firstSegmentRole = (name: string): string | undefined => {
  const head = name.split(" :: ", 1)[0] ?? "";
  return head.includes("/") && !head.includes("=") ? head : undefined;
};

const sceneRole = (scene: SceneNodeSnapshot): string | undefined =>
  scene.semanticRole ?? firstSegmentRole(scene.name);

export function canonicalizeObservedComponentRef(
  liveRef: string,
  role?: string,
): string {
  void COMBOBOX_LIVE_V15_RECOVER_RECIPE_COMPONENT_REF_MARKER;
  const last = liveRef.split(" / ").at(-1) ?? liveRef;
  if (last.includes("@")) return last;
  const family = /^([^/]+)\/([^/]+)-instance(?:\/\d+)?$/.exec(role ?? "");
  if (family) return `${family[1]}@1/${family[2]}`;
  return last;
}

export function canonicalizeObservedComponentPropertyName(key: string): string {
  void COMBOBOX_LIVE_V15_RECOVER_COMPONENT_PROPERTY_NAME_MARKER;
  return key.split("#")[0] ?? key;
}

const canonicalizeObservedComponentProperties = (
  properties: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(properties ?? {}).map(([key, value]) => [
      canonicalizeObservedComponentPropertyName(key),
      value,
    ]),
  );

const SLOT_ROLES = new Set<string>(COMBOBOX_LIVE_V1_SLOT_ROLES);

const paintsFrom = (paints?: ScenePayloadPaint[]): Paint[] =>
  (paints ?? []).map(scenePaintToIr);

const instancePayloadText = (
  payload: SceneNodeSnapshot["instancePayload"] | undefined,
): string | undefined => {
  const content = payload?.content;
  if (content && "text" in content) return content.text;
  return payload?.text?.[0];
};

const shouldOmitEmptyInstancePayload = (
  payload: SceneNodeSnapshot["instancePayload"] | undefined,
): boolean => {
  void COMBOBOX_LIVE_V15_OMIT_EMPTY_INSTANCE_PAYLOAD_MARKER;
  if (payload?.content === undefined) return true;
  const text = instancePayloadText(payload);
  const emptyText = text === undefined || text === "";
  const emptyFills = (payload.fills ?? []).length === 0;
  return emptyText && emptyFills;
};

const surfaceSlotInstanceFills = (
  scene: SceneNodeSnapshot,
): Paint[] | undefined => {
  const own = paintsFrom(scene.fills);
  if (own.length > 0) return own;
  const role = sceneRole(scene);
  if (role === undefined || !SLOT_ROLES.has(role)) {
    return scene.fills === undefined ? undefined : own;
  }
  const fromPayload = paintsFrom(scene.instancePayload?.fills);
  if (fromPayload.length > 0) return fromPayload;
  for (const child of scene.children) {
    const childOwn = paintsFrom(child.fills);
    if (childOwn.length > 0) return childOwn;
    const childPayload = paintsFrom(child.instancePayload?.fills);
    if (childPayload.length > 0) return childPayload;
  }
  return scene.fills === undefined ? undefined : own;
};

const sceneLabel = (scene: SceneNodeSnapshot): string => {
  const separator = scene.name.indexOf(" :: ");
  if (separator < 0) return scene.name.split(" :: font-provenance=", 1)[0]!;
  const rest = scene.name.slice(separator + 4);
  if (rest.startsWith("font-provenance="))
    return scene.name.slice(0, separator);
  return rest.split(" :: font-provenance=", 1)[0]!;
};

const omitContentLetterSpacing = <T extends { letterSpacing?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (!contentLabelOrMessageRole(role)) return type;
  if (scene.type !== "TEXT") return type;
  if (type.letterSpacing === undefined) return type;
  const { letterSpacing: _omitted, ...rest } = type;
  return rest as T;
};

const omitContentTextCase = <T extends { textCase?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (!contentLabelOrMessageRole(role)) return type;
  if (scene.type !== "TEXT") return type;
  if (type.textCase === undefined) return type;
  const { textCase: _omitted, ...rest } = type;
  return rest as T;
};

const omitContentTextDecoration = <T extends { textDecoration?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (!contentLabelOrMessageRole(role)) return type;
  if (scene.type !== "TEXT") return type;
  if (type.textDecoration === undefined) return type;
  const { textDecoration: _omitted, ...rest } = type;
  return rest as T;
};

const omitContentOpacity = <T extends { opacity?: unknown }>(
  scene: SceneNodeSnapshot,
  node: T,
): T => {
  const role = sceneRole(scene);
  if (role === undefined || !CONTENT_ROLES.has(role)) return node;
  if (scene.type !== "TEXT") return node;
  if (node.opacity === undefined) return node;
  const { opacity: _omitted, ...rest } = node;
  return rest as T;
};

const omitRequiredIndicatorLetterSpacing = <T extends { letterSpacing?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/required-indicator-absent") return type;
  if (scene.type !== "TEXT") return type;
  if (type.letterSpacing === undefined) return type;
  const { letterSpacing: _omitted, ...rest } = type;
  return rest as T;
};

const omitRequiredIndicatorTextCase = <T extends { textCase?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/required-indicator-absent") return type;
  if (scene.type !== "TEXT") return type;
  if (type.textCase === undefined) return type;
  const { textCase: _omitted, ...rest } = type;
  return rest as T;
};

const omitRequiredIndicatorTextDecoration = <T extends { textDecoration?: unknown }>(
  scene: SceneNodeSnapshot,
  type: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/required-indicator-absent") return type;
  if (scene.type !== "TEXT") return type;
  if (type.textDecoration === undefined) return type;
  const { textDecoration: _omitted, ...rest } = type;
  return rest as T;
};

const omitContentRowClipsContent = <T extends { clipsContent?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role !== "combobox/trailing-controls" &&
    role !== "combobox/label-row-absent" &&
    role !== "combobox/message-container-absent"
  )
    return frame;
  if (scene.type !== "FRAME") return frame;
  if (frame.clipsContent === undefined) return frame;
  const { clipsContent: _omitted, ...rest } = frame;
  return rest as T;
};

const omitContentRowCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role !== "combobox/trailing-controls" &&
    role !== "combobox/label-row-absent" &&
    role !== "combobox/message-container-absent"
  )
    return frame;
  if (scene.type !== "FRAME") return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};

const omitContentRowEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role !== "combobox/trailing-controls" &&
    role !== "combobox/label-row-absent" &&
    role !== "combobox/message-container-absent"
  )
    return frame;
  if (scene.type !== "FRAME") return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitContentRowStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role !== "combobox/trailing-controls" &&
    role !== "combobox/label-row-absent" &&
    role !== "combobox/message-container-absent"
  )
    return frame;
  if (scene.type !== "FRAME") return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitVariantStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role === undefined ||
    !isComboboxComponentVariantRole(role)
  )
    return frame;
  if (scene.type !== "COMPONENT") return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitVariantEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role === undefined ||
    !isComboboxComponentVariantRole(role)
  )
    return frame;
  if (scene.type !== "COMPONENT") return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitVariantCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (
    role === undefined ||
    !isComboboxComponentVariantRole(role)
  )
    return frame;
  if (scene.type !== "COMPONENT") return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};



const omitSetStrokes = <T extends { strokes?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/set" && role !== "combobox/option-set") return frame;
  if (scene.type !== "COMPONENT_SET") return frame;
  if (frame.strokes === undefined) return frame;
  const { strokes: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSetFills = <T extends { fills?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/set" && role !== "combobox/option-set") return frame;
  if (scene.type !== "COMPONENT_SET") return frame;
  if (!Array.isArray(frame.fills) || frame.fills.length === 0) return frame;
  return { ...frame, fills: [] };
};

const omitSetEffects = <T extends { effects?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/set" && role !== "combobox/option-set") return frame;
  if (scene.type !== "COMPONENT_SET") return frame;
  if (frame.effects === undefined) return frame;
  const { effects: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSetCornerRadius = <T extends { cornerRadius?: unknown }>(
  scene: SceneNodeSnapshot,
  frame: T,
): T => {
  const role = sceneRole(scene);
  if (role !== "combobox/set" && role !== "combobox/option-set") return frame;
  if (scene.type !== "COMPONENT_SET") return frame;
  if (frame.cornerRadius === undefined) return frame;
  const { cornerRadius: _omitted, ...rest } = frame;
  return rest as T;
};

const omitSurfaceStrokeDashPattern = <T extends { dashPattern?: unknown }>(
  scene: SceneNodeSnapshot,
  strokes: T[] | undefined,
): T[] | undefined => {
  const role = sceneRole(scene);
  if (role !== "combobox/trigger") return strokes;
  if (strokes === undefined) return strokes;
  return strokes.map((stroke) => {
    if (
      !Array.isArray(stroke.dashPattern) ||
      stroke.dashPattern.length !== 0
    )
      return stroke;
    const { dashPattern: _omitted, ...rest } = stroke;
    return rest as T;
  });
};

const omitSurfaceEffects = (
  scene: SceneNodeSnapshot,
  effects: Effect[] | undefined,
): Effect[] | undefined => {
  void COMBOBOX_LIVE_V15_TRIGGER_EMPTY_EFFECTS_OMITTED_MARKER;
  const role = sceneRole(scene);
  if (role !== "combobox/trigger") return effects;
  if (effects === undefined || effects.length !== 0) return effects;
  return undefined;
};

const contentHiddenFixedHeightAsHug = (
  scene: SceneNodeSnapshot,
  height: Sizing,
): Sizing => {
  const role = sceneRole(scene);
  if (role === undefined || !CONTENT_ROLES.has(role)) return height;
  if (scene.type !== "TEXT") return height;
  if (scene.visible !== false) return height;
  if (scene.layoutSizingVertical !== "FIXED") return height;
  const fields = (scene.boundVariables ?? []).map((binding) => binding.field);
  if (
    fields.includes("height") ||
    fields.includes("height.value") ||
    fields.includes("layout.height.value")
  )
    return height;
  return { mode: "hug" };
};

export function sceneToNormalizedIr(scene: SceneNodeSnapshot): IRNode {
  const bindings = orderLabelRowBindingsToCompileFields(
    scene,
    orderRequiredIndicatorBindingsToCompileFields(
    scene,
    dropDuplicateRequiredIndicatorBindings(
      scene,
      orderTrailingSlotBindingsToCompileFields(
        scene,
        orderLeadingSlotBindingsToCompileFields(
        scene,
        orderContentBindingsToCompileFields(
        scene,
        dropDuplicateContentBindings(
          scene,
          orderSurfaceBindingsToCompileFields(
            scene,
            dropDuplicateSurfaceBindings(
              scene,
              surfaceLayoutHeightBinding(
                scene,
                surfaceVariantLayoutWidthBinding(
                  scene,
                  surfaceUniformStrokeWeightBinding(
                    scene,
                    surfaceSlotColorBindings(scene, sceneBindings(scene)),
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
    ),
  );
  const common = omitContentOpacity(scene, {
    label: sceneLabel(scene),
    ...(sceneRole(scene) === undefined ? {} : { role: sceneRole(scene) }),
    ...(bindings.length === 0 ? {} : { bindings }),
    ...compileCarriedLeadingSlotVisible(scene),
    ...(scene.opacity === 1 ? {} : { opacity: scene.opacity }),
  });
  const fills = (scene.fills ?? []).map(scenePaintToIr);
  const strokes = omitSurfaceStrokeDashPattern(
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
  const effects = omitSurfaceEffects(
    scene,
    scene.effects
      ?.filter((effect) => effect.visible)
      .map(sceneEffectToIr),
  );
  const children = scene.children.map(sceneToNormalizedIr);
  let result: IRNode;
  if (
    scene.type === "FRAME" ||
    scene.type === "COMPONENT" ||
    scene.type === "COMPONENT_SET"
  ) {
    const frame = omitSetStrokes(
      scene,
      omitSetFills(
      scene,
      omitSetEffects(
      scene,
      omitSetCornerRadius(
      scene,
      omitVariantStrokes(
      scene,
      omitVariantEffects(
      scene,
      omitVariantCornerRadius(
      scene,
      omitContentRowStrokes(
      scene,
      omitContentRowEffects(
      scene,
      omitContentRowCornerRadius(
      scene,
      omitContentRowClipsContent(scene, {
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
    const letterSpacing =
      scene.letterSpacing === undefined
        ? undefined
        : normalizeFigmaUnit("letterSpacing", scene.letterSpacing, {
            allowAuto: false,
            allowPercent: true,
            allowPixels: true,
          });
    if (letterSpacing?.unit === "auto")
      throw new TypeError("letterSpacing: AUTO unit unsupported");
    result = {
      kind: "text",
      ...common,
      characters: scene.characters ?? "",
      type: omitRequiredIndicatorTextDecoration(
        scene,
        omitRequiredIndicatorTextCase(
        scene,
        omitRequiredIndicatorLetterSpacing(
        scene,
        omitContentTextDecoration(
        scene,
        omitContentTextCase(
        scene,
        omitContentLetterSpacing(scene, {
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
        ...(letterSpacing === undefined ? {} : { letterSpacing }),
        ...(scene.textCase === undefined
          ? {}
          : { textCase: scene.textCase.toLowerCase() as "original" }),
        ...(scene.textDecoration === undefined
          ? {}
          : {
              textDecoration: scene.textDecoration
                .toLowerCase()
                .replace("strikethrough", "strikethrough") as "none",
            }),
      }),
      ),
      ),
      ),
      ),
      ),
      align: (scene.textAlignHorizontal ?? "LEFT").toLowerCase() as "left",
      verticalAlign: (scene.textAlignVertical ?? "TOP").toLowerCase() as "top",
      fills,
      width: irSizing(scene.layoutSizingHorizontal, scene.width),
      height: contentHiddenFixedHeightAsHug(
        scene,
        irSizing(scene.layoutSizingVertical, scene.height),
      ),
    };
  } else if (scene.type === "INSTANCE") {
    const instanceFills = surfaceSlotInstanceFills(scene);
    result = {
      kind: "instance",
      ...common,
      componentRef: canonicalizeObservedComponentRef(
        scene.componentRef ?? "",
        sceneRole(scene),
      ),
      properties: canonicalizeObservedComponentProperties(
        scene.componentProperties,
      ),
      ...(shouldOmitEmptyInstancePayload(scene.instancePayload)
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
      ...(instanceFills === undefined ? {} : { fills: instanceFills }),
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(encoded));
  } catch {
    return name;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return name;
  }
  return `${prefix}${encodeURIComponent(canonicalJson(parsed))}`;
}

const canonicalizeObservedSolidFillDiscriminator = (
  paint: unknown,
): unknown => {
  if (paint === null || typeof paint !== "object" || Array.isArray(paint)) {
    return paint;
  }
  const record = paint as Record<string, unknown>;
  if (record.type !== "SOLID") return paint;
  const { type: _type, ...rest } = record;
  return { kind: "solid", ...rest };
};

export function canonicalizeObservedInstancePayloadFillKind(
  payload: unknown,
): unknown {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.fills)) return payload;
  return {
    ...record,
    fills: record.fills.map((paint) =>
      canonicalizeObservedSolidFillDiscriminator(paint),
    ),
  };
}

export function canonicalizeObservedVariantAxisSizeOrder(
  axis: unknown,
): unknown {
  if (axis === null || typeof axis !== "object" || Array.isArray(axis)) {
    return axis;
  }
  const record = axis as Record<string, unknown>;
  if (record.name !== "Size" || !Array.isArray(record.values)) return axis;
  const observed = record.values.map((value) => String(value));
  const compile = [...COMBOBOX_LIVE_V1_SIZE_AXIS_COMPILE_VALUES];
  if ([...observed].sort().join("\0") !== [...compile].sort().join("\0")) {
    return axis;
  }
  return { ...record, values: compile };
}

const omitUnnamedSourceIntrinsicWidth = (payload: unknown): unknown => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  const size = record.intrinsicSize;
  if (size === null || typeof size !== "object" || Array.isArray(size)) {
    return payload;
  }
  const { width: _width, ...restSize } = size as Record<string, unknown>;
  return { ...record, intrinsicSize: restSize };
};

const omitUnnamedSourceEffectSpread = (effect: unknown): unknown => {
  if (effect === null || typeof effect !== "object" || Array.isArray(effect)) {
    return effect;
  }
  const record = effect as Record<string, unknown>;
  if (!("spread" in record)) return effect;
  const { spread: _spread, ...rest } = record;
  return rest;
};

export function requiredEqualsFactValue(
  channel: string,
  value: unknown,
): unknown {
  if (channel === "instancePayload")
    return omitUnnamedSourceIntrinsicWidth(value);
  if (channel === "effect") return omitUnnamedSourceEffectSpread(value);
  return value;
}

const observeSceneFacts = (root: SceneNodeSnapshot): SceneFact[] => {
  void COMBOBOX_LIVE_V15_PROJECT_LIVE_ROOT_OWNERSHIP_KEY_MARKER;
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
    instancePayload: (_node, ownershipKey) =>
      byOwnership.get(ownershipKey)?.instancePayload,
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
    if (fact.channel === "instancePayload")
      return {
        ...fact,
        value: canonicalizeObservedInstancePayloadFillKind(fact.value),
      };
    if (fact.channel === "variantAxis")
      return {
        ...fact,
        value: canonicalizeObservedVariantAxisSizeOrder(fact.value),
      };
    if (fact.channel === "role") return { ...fact, value: sceneRole(scene) };
    if (fact.channel === "visible") return { ...fact, value: scene.visible };
    if (fact.channel === "opacity") return { ...fact, value: scene.opacity };
    return fact;
  });
};

const valueKey = (value: unknown): string => canonicalJson(value);

const requiredEqualsKey = (fact: SceneFact): string =>
  canonicalJson(requiredEqualsFactValue(fact.channel, fact.value));

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
  const keys = new Set<string>();
  const visit = (node: IRNode, key: string): void => {
    if (
      node.kind === "text" &&
      node.role !== undefined &&
      CONTENT_ROLES.has(node.role) &&
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
          requiredEqualsKey(candidate) === requiredEqualsKey(fact),
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
    compileExpectedScenePlan(envelope1.ir),
    scene,
    {
      omitOpacityOwnershipKeys:
        contentTextOwnershipKeysWithoutCompileOpacity(envelope1.ir),
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
