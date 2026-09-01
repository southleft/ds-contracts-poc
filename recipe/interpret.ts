import { canonicalJson } from "./normalize.js";
import {
  BUTTON_ICON_PRESENCE,
  BUTTON_SIZES,
  BUTTON_STATES,
  BUTTON_VARIANTS,
} from "./recipes/button.js";
import type {
  ComponentNode,
  ComponentSetNode,
  Effect,
  IRNode,
  VariableBinding,
} from "./figma-ir.js";
import { factId, type RecipeEnvelope } from "./envelope.js";
import {
  compileExpectedScenePlan,
  type ExpectedScenePlan,
} from "./scene-readback.js";

export const RECIPE_FIGMA_NAMESPACE = "ds.contracts.recipe.v4";
export const RECIPE_FIGMA_WRITER_VERSION = 4;
export const RECIPE_FIGMA_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const RECIPE_FIGMA_FILE_NAME = "Scratch Project";
export const RECIPE_FIGMA_SHARED_DATA_KEY_PATTERN = /^[A-Za-z0-9_.-]+$/;
export const RECIPE_FIGMA_VARIABLE_NAME_PATTERN =
  /^token\/(?:color|float)\/[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
export const RECIPE_FIGMA_ASSIGNMENTS = {
  align: "TextNode.textAlignHorizontal",
  assetRef: "ComponentNode.createInstance / helper component reference",
  bindings:
    "SceneNode.setBoundVariable / VariablesAPI.setBoundVariableForPaint / VariablesAPI.setBoundVariableForEffect",
  characters: "TextNode.characters",
  children: "ChildrenMixin.appendChild / PluginAPI.combineAsVariants",
  clipsContent: "FrameNode.clipsContent / ComponentNode.clipsContent",
  componentRef: "ComponentNode.createInstance + sharedPluginData componentRef",
  cornerRadius:
    "SceneNode topLeftRadius/topRightRadius/bottomRightRadius/bottomLeftRadius",
  effects: "BlendMixin.effects",
  // Vector paint attributes. Presented by the vector node schema since
  // 3b2c3fb84 added VECTOR glyphs, but never declared here or in
  // IR_DRAWABLE_FIELDS, so the closed-field guard has been red ever since.
  windingRule: "VectorNode.vectorPaths[].windingRule",
  strokeCap: "MinimalStrokesMixin.strokeCap",
  strokeJoin: "MinimalStrokesMixin.strokeJoin",
  rotation: "LayoutMixin.rotation",
  fills: "GeometryMixin.fills",
  height: "LayoutMixin.resize + layoutSizingVertical",
  kind: "PluginAPI createComponent/createText/createInstance/combineAsVariants",
  label: "BaseNodeMixin.name",
  layout:
    "AutoLayoutMixin layoutMode/alignment/itemSpacing/padding/sizing/minWidth/minHeight",
  opacity: "SceneNode.opacity",
  payload:
    "Instance main-component descendants: TextNode/VectorNode content, typography, paints, intrinsic geometry, auto-layout padding/alignment, opacity and description accessibility/source metadata",
  properties: "InstanceNode.setProperties / componentPropertyReferences",
  role: "PluginDataMixin.setSharedPluginData(role)",
  shape: "PluginAPI.createRectangle/createEllipse",
  strokes: "GeometryMixin.strokes/strokeWeight/strokeAlign/dashPattern",
  type: "TextNode fontName/fontSize/lineHeight/letterSpacing/textCase/textDecoration",
  verticalAlign: "TextNode.textAlignVertical",
  visible: "SceneNode.visible",
  variantAxes:
    "PluginAPI.combineAsVariants + ComponentSetNode.variantGroupProperties",
  variantProperties: "ComponentNode.name Property=Value pairs",
  width: "LayoutMixin.resize + layoutSizingHorizontal",
} as const;

type AxisName = "Variant" | "Size" | "State" | "Icons";
type Cell = [number, number, number, number];

interface BoundValue<Value> {
  value: Value;
  variable?: string;
}

interface AppearancePlan {
  background: BoundValue<string>;
  foreground: BoundValue<string>;
  border: BoundValue<string>;
  effects: Array<Effect & { variable?: string }>;
}

interface SizePlan {
  minWidth: BoundValue<number> | null;
  paddingX: BoundValue<number>;
  paddingY: BoundValue<number>;
  gap: BoundValue<number>;
  fontFamily: string;
  fontStyle: string;
  fontSize: BoundValue<number>;
  lineHeight: BoundValue<number>;
  iconSize: BoundValue<number>;
}

export interface ButtonFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  axes: Record<AxisName, string[]>;
  iteration: Record<AxisName, string[]>;
  cells: Cell[];
  label: string;
  refs: {
    leading: string;
    trailing: string;
    loading: string;
  };
  labels: {
    root: string;
    label: string;
    leading: string;
    trailing: string;
    loading: string;
  };
  appearance: Record<string, AppearancePlan>;
  sizes: Record<string, SizePlan>;
  radius: BoundValue<number>;
  borderWidth: BoundValue<number>;
  comparedIrFacts: number;
  expectedScenePlan: ExpectedScenePlan;
}

export function validateButtonFigmaSourcePlans(
  plans: readonly ButtonFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  for (const source of plans) {
    if (source.label.trim().length === 0) {
      failures.push(`${source.adapterIdentity}: label text is empty`);
    }
    for (const [sizeName, size] of Object.entries(source.sizes)) {
      if (
        size.fontFamily.trim().length === 0 ||
        size.fontStyle.trim().length === 0 ||
        size.fontSize.value <= 0 ||
        size.lineHeight.value <= 0
      ) {
        failures.push(
          `${source.adapterIdentity}/${sizeName}: label font geometry is invalid`,
        );
      }
    }
    for (const [cell, appearance] of Object.entries(source.appearance)) {
      if (
        !/^#[0-9a-f]{8}$/i.test(appearance.foreground.value) ||
        Number.parseInt(appearance.foreground.value.slice(7, 9), 16) <= 0
      ) {
        failures.push(
          `${source.adapterIdentity}/${cell}: label fill is invisible`,
        );
      }
    }
  }
  return failures;
}

export function sanitizeFigmaVariableName(
  tokenIdentity: string,
  type: "COLOR" | "FLOAT",
): string {
  const segment = Buffer.from(tokenIdentity, "utf8").toString("hex");
  const name = `token/${type.toLowerCase()}/id-${segment}`;
  if (!RECIPE_FIGMA_VARIABLE_NAME_PATTERN.test(name)) {
    throw new TypeError(
      `invalid Figma variable name after sanitizing ${JSON.stringify(tokenIdentity)}: ${name}`,
    );
  }
  return name;
}

export function buildFigmaVariableNameMap(
  entries: readonly { tokenIdentity: string; type: "COLOR" | "FLOAT" }[],
): Map<string, string> {
  const tokenToName = new Map<string, string>();
  const nameToToken = new Map<string, string>();
  for (const { tokenIdentity, type } of entries) {
    const key = `${type}:${tokenIdentity}`;
    const name = sanitizeFigmaVariableName(tokenIdentity, type);
    const previousToken = nameToToken.get(name);
    if (previousToken !== undefined && previousToken !== key) {
      throw new TypeError(
        `Figma variable-name collision: ${previousToken} and ${key} both map to ${name}`,
      );
    }
    tokenToName.set(key, name);
    nameToToken.set(name, key);
  }
  return tokenToName;
}

export interface ButtonFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface ButtonFigmaWriter {
  pageName: string;
  runIdentity: string;
  sourcePlans: ButtonFigmaSourcePlan[];
  code: string;
}

const binding = (
  node: { bindings?: VariableBinding[] },
  field: string,
): string | undefined =>
  node.bindings?.find((candidate) => candidate.field === field)?.variable;

const solidColor = (
  paint: { kind: string; color?: string } | undefined,
  where: string,
): string => {
  if (paint?.kind !== "solid" || paint.color === undefined) {
    throw new TypeError(
      `${where}: the Button live writer requires solid paint`,
    );
  }
  return paint.color;
};

const fixed = (
  sizing: { mode: string; value?: number },
  where: string,
): number => {
  if (sizing.mode !== "fixed" || sizing.value === undefined) {
    throw new TypeError(`${where}: expected fixed primitive-IR sizing`);
  }
  return sizing.value;
};

const componentFor = (
  root: ComponentSetNode,
  variant: string,
  size: string,
  state: string,
  icons: string,
): ComponentNode => {
  const matches = root.children.filter(
    (component) =>
      component.variantProperties.Variant === variant &&
      component.variantProperties.Size === size &&
      component.variantProperties.State === state &&
      component.variantProperties.Icons === icons,
  );
  if (matches.length !== 1) {
    throw new TypeError(
      `Button live writer: expected one ${variant}/${size}/${state}/${icons} cell; found ${matches.length}`,
    );
  }
  return matches[0]!;
};

const childByRole = <Kind extends IRNode["kind"]>(
  component: ComponentNode,
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const matches = component.children.filter((child) => child.role === role);
  if (matches.length !== 1 || matches[0]!.kind !== kind) {
    throw new TypeError(
      `${component.role}: expected one ${kind} child with role ${role}`,
    );
  }
  return matches[0] as Extract<IRNode, { kind: Kind }>;
};

const countComparedFacts = (root: ComponentSetNode): number => {
  let count = 0;
  const visit = (node: IRNode): void => {
    count += Object.keys(node).filter(
      (key) => !["label", "children"].includes(key),
    ).length;
    if (
      node.kind === "frame" ||
      node.kind === "component" ||
      node.kind === "component-set"
    ) {
      for (const child of node.children) visit(child);
    }
  };
  visit(root);
  return count;
};

const planSource = (input: ButtonFigmaWriterInput): ButtonFigmaSourcePlan => {
  if (input.envelope.ir.kind !== "component-set") {
    throw new TypeError("Button live writer requires component-set IR");
  }
  const root = input.envelope.ir;
  const axes = Object.fromEntries(
    root.variantAxes.map((axis) => [axis.name, [...axis.values]]),
  ) as Partial<Record<AxisName, string[]>>;
  for (const [name, expected] of [
    ["Variant", BUTTON_VARIANTS],
    ["Size", BUTTON_SIZES],
    ["State", BUTTON_STATES],
    ["Icons", BUTTON_ICON_PRESENCE],
  ] as const) {
    if (canonicalJson(axes[name]) !== canonicalJson(expected)) {
      throw new TypeError(
        `Button live writer: ${name} axis is not the full button@1 declaration`,
      );
    }
  }
  const completeAxes = axes as Record<AxisName, string[]>;
  const index = (axis: AxisName, value: string): number => {
    const found = completeAxes[axis].indexOf(value);
    if (found < 0) throw new TypeError(`unknown ${axis} value ${value}`);
    return found;
  };
  const cells = root.children.map((component): Cell => [
    index("Variant", component.variantProperties.Variant!),
    index("Size", component.variantProperties.Size!),
    index("State", component.variantProperties.State!),
    index("Icons", component.variantProperties.Icons!),
  ]);
  if (new Set(cells.map((cell) => cell.join("/"))).size !== 144) {
    throw new TypeError(
      `Button live writer requires all 144 cells; found ${cells.length}`,
    );
  }
  const iteration = Object.fromEntries(
    (["Variant", "Size", "State", "Icons"] as const).map((axis, axisIndex) => [
      axis,
      [
        ...new Set(
          cells.map((cell) => completeAxes[axis][cell[axisIndex]] as string),
        ),
      ],
    ]),
  ) as Record<AxisName, string[]>;

  const defaultSize = completeAxes.Size[0]!;
  const appearance: Record<string, AppearancePlan> = {};
  for (const variant of completeAxes.Variant) {
    for (const state of completeAxes.State) {
      const component = componentFor(root, variant, defaultSize, state, "none");
      const label = childByRole(component, "button/label", "text");
      appearance[`${variant}/${state}`] = {
        background: {
          value: solidColor(component.fills[0], `${component.role}.fills[0]`),
          variable: binding(component, "fills.0.color"),
        },
        foreground: {
          value: solidColor(label.fills[0], `${component.role}.label.fills[0]`),
          variable: binding(label, "fills.0.color"),
        },
        border: {
          value: solidColor(
            component.strokes?.[0]?.paint,
            `${component.role}.strokes[0]`,
          ),
          variable: binding(component, "strokes.0.paint.color"),
        },
        effects: (component.effects ?? []).map((effect, effectIndex) => ({
          ...effect,
          variable: binding(component, `effects.${effectIndex}.color`),
        })),
      };
    }
  }

  const sizes: Record<string, SizePlan> = {};
  for (const size of completeAxes.Size) {
    const component = componentFor(
      root,
      completeAxes.Variant[0]!,
      size,
      "default",
      "leading",
    );
    const label = childByRole(component, "button/label", "text");
    const icon = childByRole(component, "button/slot/leading", "instance");
    if (label.type.lineHeight.unit !== "px") {
      throw new TypeError(`${component.role}: line height must use px`);
    }
    sizes[size] = {
      minWidth:
        component.layout.minWidth === undefined
          ? null
          : {
              value: component.layout.minWidth,
              variable: binding(component, "layout.minWidth"),
            },
      paddingX: {
        value: component.layout.padding.left,
        variable: binding(component, "layout.padding.left"),
      },
      paddingY: {
        value: component.layout.padding.top,
        variable: binding(component, "layout.padding.top"),
      },
      gap: {
        value: component.layout.itemSpacing,
        variable: binding(component, "layout.itemSpacing"),
      },
      fontFamily: label.type.fontFamily,
      fontStyle: label.type.fontStyle,
      fontSize: {
        value: label.type.fontSize,
        variable: binding(label, "type.fontSize"),
      },
      lineHeight: {
        value: label.type.lineHeight.value,
        variable: binding(label, "type.lineHeight.value"),
      },
      iconSize: {
        value: fixed(icon.width, `${icon.role}.width`),
        variable: binding(icon, "width.value"),
      },
    };
  }

  const baseline = componentFor(
    root,
    completeAxes.Variant[0]!,
    completeAxes.Size[0]!,
    "default",
    "none",
  );
  const leading = childByRole(
    componentFor(
      root,
      completeAxes.Variant[0]!,
      completeAxes.Size[0]!,
      "default",
      "leading",
    ),
    "button/slot/leading",
    "instance",
  );
  const trailing = childByRole(
    componentFor(
      root,
      completeAxes.Variant[0]!,
      completeAxes.Size[0]!,
      "default",
      "trailing",
    ),
    "button/slot/trailing",
    "instance",
  );
  const loading = childByRole(
    componentFor(
      root,
      completeAxes.Variant[0]!,
      completeAxes.Size[0]!,
      "loading",
      "none",
    ),
    "button/loading-indicator",
    "instance",
  );
  const label = childByRole(baseline, "button/label", "text");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    axes: completeAxes,
    iteration,
    cells,
    label: label.characters,
    refs: {
      leading: leading.componentRef,
      trailing: trailing.componentRef,
      loading: loading.componentRef,
    },
    labels: {
      root: root.label ?? root.role ?? "button/set",
      label: label.label ?? label.role ?? "button/label",
      leading: leading.label ?? leading.role ?? "button/slot/leading",
      trailing: trailing.label ?? trailing.role ?? "button/slot/trailing",
      loading: loading.label ?? loading.role ?? "button/loading-indicator",
    },
    appearance,
    sizes,
    radius: {
      value: baseline.cornerRadius?.topLeft ?? 0,
      variable: binding(baseline, "cornerRadius.topLeft"),
    },
    borderWidth: {
      value: baseline.strokes?.[0]?.weight ?? 0,
      variable: binding(baseline, "strokes.0.weight"),
    },
    comparedIrFacts: countComparedFacts(root),
    expectedScenePlan: compileExpectedScenePlan(root, {
      typedReceipts: [
        ...input.envelope.extensions.flatMap((extension) =>
          extension.absorbs.map((fact) => ({
            id: factId(fact),
            disposition: "code-only" as const,
            reason: extension.why,
          })),
        ),
        ...input.envelope.receipts.map((receipt) => ({
          id: factId(receipt.fact),
          disposition: "refused" as const,
          reason: `${receipt.reason}: ${receipt.evidence}`,
        })),
      ],
      instancePayload: (node) => ({
        text: [],
        assets: [node.componentRef],
      }),
    }),
  };
};

const runtime = String.raw`
const EXPECTED_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME = "Scratch Project";
const NS = "ds.contracts.recipe.v4";
const WRITER_VERSION = "4";
const SHARED_DATA_GRAMMAR = /^[A-Za-z0-9_.-]+$/;
const VARIABLE_NAME_GRAMMAR = /^token\/(?:color|float)\/[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const assertSharedDataName = (namespace, key) => {
  if (namespace.length < 3 || !/^[A-Za-z0-9_.]+$/.test(namespace)) {
    throw new Error("INVALID-SHARED-PLUGIN-DATA-NAMESPACE:" + namespace);
  }
  if (!SHARED_DATA_GRAMMAR.test(key)) {
    throw new Error("INVALID-SHARED-PLUGIN-DATA-KEY:" + key);
  }
};
const setSharedData = (target, key, value) => {
  assertSharedDataName(NS, key);
  target.setSharedPluginData(NS, key, value);
};
const getSharedData = (target, key) => {
  assertSharedDataName(NS, key);
  return target.getSharedPluginData(NS, key);
};
// PORTABILITY (measured live 2026-08-30, Button v5 attempt 1): Figma's
// plugin main thread has NO TextEncoder — "TextEncoder is not a constructor"
// killed the writer before its first write. figma-runtime-portability.ts has
// declared TextEncoder "not used" all along; this encoder restores that
// declared truth with a strict portable UTF-8 byte emitter (code-point
// iteration handles surrogate pairs; same byte layout Buffer.from(_, "utf8")
// produces, so decodeButtonHexTokenName round-trips unchanged).
const utf8Bytes = (value) => {
  const bytes = [];
  for (const character of value) {
    const point = character.codePointAt(0);
    if (point <= 0x7f) bytes.push(point);
    else if (point <= 0x7ff) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    else if (point <= 0xffff)
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f));
    else
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
  }
  return bytes;
};
const sanitizeVariableName = (tokenIdentity, type) => {
  const segment = utf8Bytes(tokenIdentity)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const name = "token/" + type.toLowerCase() + "/id-" + segment;
  if (!VARIABLE_NAME_GRAMMAR.test(name)) {
    throw new Error("INVALID-FIGMA-VARIABLE-NAME:" + tokenIdentity + ":" + name);
  }
  return name;
};
const collectVariableEntries = (source) => {
  const entries = [];
  const visit = (value, scope) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.variable === "string") {
      const type = scope === "background" || scope === "foreground" || scope === "border" || scope === "effects"
        ? "COLOR"
        : "FLOAT";
      entries.push({ tokenIdentity: value.variable, type });
    }
    if (Array.isArray(value)) {
      for (const child of value) visit(child, scope);
      return;
    }
    for (const [key, child] of Object.entries(value)) visit(child, key);
  };
  visit(source.appearance, "appearance");
  visit(source.sizes, "sizes");
  visit(source.radius, "radius");
  visit(source.borderWidth, "borderWidth");
  return entries;
};
const variableNameMaps = new Map();
for (const source of PLAN.sources) {
  const tokenToName = new Map();
  const nameToToken = new Map();
  for (const entry of collectVariableEntries(source)) {
    const key = entry.type + ":" + entry.tokenIdentity;
    const name = sanitizeVariableName(entry.tokenIdentity, entry.type);
    const previousToken = nameToToken.get(name);
    if (previousToken !== undefined && previousToken !== key) {
      throw new Error("FIGMA-VARIABLE-NAME-COLLISION:" + previousToken + ":" + key + ":" + name);
    }
    tokenToName.set(key, name);
    nameToToken.set(name, key);
  }
  variableNameMaps.set(source.adapterIdentity, tokenToName);
}
const pageName = PLAN.pageName;
if (figma.fileKey !== EXPECTED_FILE_KEY) throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== EXPECTED_FILE_NAME) throw new Error("WRONG-FILE-NAME:" + figma.root.name);
if (figma.editorType !== "figma") throw new Error("WRONG-EDITOR:" + figma.editorType);
await figma.loadAllPagesAsync();
let page = figma.root.children.find((candidate) => candidate.name === pageName);
const createdNodeIds = [];
const mutatedNodeIds = [];
if (!page) {
  page = figma.createPage();
  page.name = pageName;
  createdNodeIds.push(page.id);
}
await figma.setCurrentPageAsync(page);
setSharedData(page, "runIdentity", PLAN.runIdentity);
setSharedData(page, "writerVersion", WRITER_VERSION);
mutatedNodeIds.push(page.id);

const rgba = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
  a: parseInt(hex.slice(7, 9), 16) / 255,
});
const paint = (hex) => {
  const value = rgba(hex);
  return { type: "SOLID", color: { r: value.r, g: value.g, b: value.b }, opacity: value.a };
};
const scopesFor = (scope) => {
  if (scope === "fill") return ["FRAME_FILL", "SHAPE_FILL"];
  if (scope === "text") return ["TEXT_FILL"];
  if (scope === "stroke") return ["STROKE_COLOR"];
  if (scope === "effect") return ["EFFECT_COLOR"];
  if (scope === "radius") return ["CORNER_RADIUS"];
  if (scope === "size") return ["WIDTH_HEIGHT"];
  if (scope === "font") return ["FONT_SIZE"];
  if (scope === "strokeWidth") return ["STROKE_FLOAT"];
  return ["GAP"];
};
const cssVariableName = (name) => "--" + name.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
const normalizeFontStyle = (style) => {
  const compact = style.replace(/\s+/g, "").toLowerCase();
  if (compact === "semibold") return ["Semi Bold", "SemiBold", "Semibold"];
  return [style];
};
const parseFontFamilies = (stack) =>
  stack.split(",").map((part) => part.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
const allFonts = await figma.listAvailableFontsAsync();
const resolveFonts = (familyStack, style) => {
  const candidates = parseFontFamilies(familyStack);
  const styles = normalizeFontStyle(style);
  const resolved = [];
  for (const family of candidates) {
    const effective = family === "-apple-system" || family === "system-ui" ? "SF Pro" : family;
    for (const candidateStyle of styles) {
      const found = allFonts.find((font) => font.fontName.family === effective && font.fontName.style === candidateStyle);
      if (
        found &&
        !resolved.some(
          (font) =>
            font.family === found.fontName.family &&
            font.style === found.fontName.style
        )
      ) {
        resolved.push(found.fontName);
      }
    }
  }
  if (resolved.length === 0)
    throw new Error("FONT-UNAVAILABLE:" + familyStack + " " + style);
  return resolved;
};
const tag = (node, source, role, ownershipKey) => {
  setSharedData(node, "runIdentity", PLAN.runIdentity);
  setSharedData(node, "adapterIdentity", source.adapterIdentity);
  setSharedData(node, "recipeHash", source.recipeHash);
  setSharedData(node, "envelopeHash", source.envelopeHash);
  if (ownershipKey) setSharedData(node, "ownershipKey", ownershipKey);
};
const collectTreeIds = (node) => {
  createdNodeIds.push(node.id);
  if ("children" in node) for (const child of node.children) collectTreeIds(child);
};
const summaries = [];
let nextSectionX = 0;
for (const source of PLAN.sources) {
  const sourceCells = [];
  for (const variant of source.iteration.Variant)
    for (const size of source.iteration.Size)
      for (const state of source.iteration.State)
        for (const icons of source.iteration.Icons)
          sourceCells.push([
            source.axes.Variant.indexOf(variant),
            source.axes.Size.indexOf(size),
            source.axes.State.indexOf(state),
            source.axes.Icons.indexOf(icons),
          ]);
  const oldSections = page.children.filter(
    (node) =>
      node.type === "SECTION" &&
      getSharedData(node, "adapterIdentity") === source.adapterIdentity &&
      getSharedData(node, "recipeHash") === source.recipeHash
  );
  for (const old of oldSections) {
    const collectionId = getSharedData(old, "variableCollectionId");
    if (collectionId) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
      if (collection && !collection.remote) collection.remove();
    }
    old.remove();
  }

  const section = figma.createSection();
  section.name = "Recipe Pivot / " + source.displayName + " / " + source.recipeHash.slice(0, 8);
  tag(section, source, "button/source-section");
  section.x = nextSectionX;
  section.y = 0;
  page.appendChild(section);
  createdNodeIds.push(section.id);

  const collection = figma.variables.createVariableCollection(
    "Recipe Pivot / " + PLAN.runIdentity + " / " + source.adapterIdentity
  );
  collection.renameMode(collection.modes[0].modeId, "Default");
  collection.hiddenFromPublishing = true;
  setSharedData(section, "variableCollectionId", collection.id);
  const modeId = collection.modes[0].modeId;
  const variables = new Map();
  const variableNames = variableNameMaps.get(source.adapterIdentity);
  const ensureVariable = (bound, type, scope) => {
    if (!bound.variable) return null;
    const key = type + ":" + bound.variable;
    let variable = variables.get(key);
    if (!variable) {
      const variableName = variableNames.get(key);
      if (!variableName) throw new Error("MISSING-FIGMA-VARIABLE-MAPPING:" + key);
      variable = figma.variables.createVariable(variableName, collection, type);
      variable.scopes = scopesFor(scope);
      variable.setValueForMode(modeId, type === "COLOR" ? rgba(bound.value) : bound.value);
      variable.setVariableCodeSyntax("WEB", "var(" + cssVariableName(bound.variable) + ")");
      variables.set(key, variable);
    } else {
      variable.scopes = [...new Set([...variable.scopes, ...scopesFor(scope)])];
    }
    return variable;
  };
  const bindPaint = (bound, scope) => {
    const base = paint(bound.value);
    const variable = ensureVariable(bound, "COLOR", scope);
    return variable ? figma.variables.setBoundVariableForPaint(base, "color", variable) : base;
  };
  const bindFloat = (node, field, bound, scope) => {
    const variable = ensureVariable(bound, "FLOAT", scope);
    if (variable) node.setBoundVariable(field, variable);
  };

  const helpers = figma.createFrame();
  helpers.name = "__Recipe helpers / " + source.displayName;
  helpers.layoutMode = "HORIZONTAL";
  helpers.primaryAxisSizingMode = "AUTO";
  helpers.counterAxisSizingMode = "AUTO";
  helpers.itemSpacing = 24;
  helpers.fills = [];
  tag(helpers, source, "button/helpers");
  section.appendChild(helpers);
  helpers.x = 80;
  helpers.y = 48;
  createdNodeIds.push(helpers.id);
  const helperByRef = new Map();
  const makeHelper = (ref, role, loading) => {
    const helper = figma.createComponent();
    helper.name = "__" + role + " / " + ref;
    helper.layoutMode = "HORIZONTAL";
    helper.primaryAxisAlignItems = "CENTER";
    helper.counterAxisAlignItems = "CENTER";
    helper.resize(24, 24);
    helper.primaryAxisSizingMode = "FIXED";
    helper.counterAxisSizingMode = "FIXED";
    helper.fills = [];
    helper.clipsContent = false;
    tag(helper, source, role);
    const glyph = loading ? figma.createEllipse() : figma.createRectangle();
    glyph.name = ref;
    glyph.resize(12, 12);
    glyph.fills = loading ? [] : [paint("#000000ff")];
    glyph.strokes = loading ? [paint("#000000ff")] : [];
    glyph.strokeWeight = loading ? 2 : 0;
    if (!loading) glyph.cornerRadius = 2;
    helper.appendChild(glyph);
    helpers.appendChild(helper);
    createdNodeIds.push(helper.id, glyph.id);
    helperByRef.set(ref, helper);
    return helper;
  };
  const leadingHelper = makeHelper(source.refs.leading, "button/helper/leading", false);
  const trailingHelper =
    source.refs.trailing === source.refs.leading
      ? leadingHelper
      : makeHelper(source.refs.trailing, "button/helper/trailing", false);
  const loadingHelper = makeHelper(source.refs.loading, "button/helper/loading", true);

  const components = [];
  for (const cell of sourceCells) {
    const variant = source.axes.Variant[cell[0]];
    const sizeName = source.axes.Size[cell[1]];
    const state = source.axes.State[cell[2]];
    const icons = source.axes.Icons[cell[3]];
    const appearance = source.appearance[variant + "/" + state];
    const size = source.sizes[sizeName];
    const component = figma.createComponent();
    component.name =
      "Variant=" + variant + ", Size=" + sizeName + ", State=" + state + ", Icons=" + icons;
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisAlignItems = "CENTER";
    component.counterAxisAlignItems = "CENTER";
    component.itemSpacing = size.gap.value;
    component.paddingTop = size.paddingY.value;
    component.paddingRight = size.paddingX.value;
    component.paddingBottom = size.paddingY.value;
    component.paddingLeft = size.paddingX.value;
    component.fills = [bindPaint(appearance.background, "fill")];
    component.strokes = [bindPaint(appearance.border, "stroke")];
    component.strokeWeight = source.borderWidth.value;
    component.strokeAlign = "INSIDE";
    component.topLeftRadius = source.radius.value;
    component.topRightRadius = source.radius.value;
    component.bottomRightRadius = source.radius.value;
    component.bottomLeftRadius = source.radius.value;
    component.clipsContent = true;
    component.minWidth = size.minWidth ? size.minWidth.value : null;
    component.effects = appearance.effects.map((effect) => {
      const base = effect.kind === "drop-shadow" || effect.kind === "inner-shadow"
        ? {
            type: effect.kind === "drop-shadow" ? "DROP_SHADOW" : "INNER_SHADOW",
            color: rgba(effect.color),
            offset: { x: effect.offsetX, y: effect.offsetY },
            radius: effect.blur,
            spread: effect.spread,
            visible: true,
            blendMode: "NORMAL",
          }
        : {
            type: effect.kind === "layer-blur" ? "LAYER_BLUR" : "BACKGROUND_BLUR",
            radius: effect.blur,
            visible: true,
          };
      if (!effect.variable || !("color" in base)) return base;
      const variable = ensureVariable({ value: effect.color, variable: effect.variable }, "COLOR", "effect");
      // MEASURED LIVE 2026-08-30 (Button v5 attempt 4): Figma's
      // setBoundVariableForEffect returns an effect whose spread is RESET to
      // 0 — the minted focus ring painted nothing while its color bound
      // correctly. Carry the compile-planned shadow geometry back over the
      // bound effect; the binding survives, nothing is invented.
      const bound = figma.variables.setBoundVariableForEffect(base, "color", variable);
      return {
        ...bound,
        offset: { x: effect.offsetX, y: effect.offsetY },
        radius: effect.blur,
        spread: effect.spread,
      };
    });
    bindFloat(component, "itemSpacing", size.gap, "gap");
    bindFloat(component, "paddingTop", size.paddingY, "gap");
    bindFloat(component, "paddingRight", size.paddingX, "gap");
    bindFloat(component, "paddingBottom", size.paddingY, "gap");
    bindFloat(component, "paddingLeft", size.paddingX, "gap");
    if (size.minWidth) bindFloat(component, "minWidth", size.minWidth, "size");
    bindFloat(component, "strokeWeight", source.borderWidth, "strokeWidth");
    bindFloat(component, "topLeftRadius", source.radius, "radius");
    bindFloat(component, "topRightRadius", source.radius, "radius");
    bindFloat(component, "bottomRightRadius", source.radius, "radius");
    bindFloat(component, "bottomLeftRadius", source.radius, "radius");
    const componentOwnershipKey = "root/children/" + sourceCells.indexOf(cell);
    component.description =
      "recipe-role:button/variant/" + variant + "/" + sizeName + "/" + state + "/" + icons;
    tag(
      component,
      source,
      "button/variant/" + variant + "/" + sizeName + "/" + state + "/" + icons,
      componentOwnershipKey
    );

    let componentChildIndex = 0;
    const addIcon = (role, helper, ref) => {
      const instance = helper.createInstance();
      const label =
        role === "button/slot/leading"
          ? source.labels.leading
          : role === "button/slot/trailing"
            ? source.labels.trailing
            : source.labels.loading;
      instance.name = role === label ? role : role + " :: " + label;
      instance.resize(size.iconSize.value, size.iconSize.value);
      instance.layoutSizingHorizontal = "FIXED";
      instance.layoutSizingVertical = "FIXED";
      bindFloat(instance, "width", size.iconSize, "size");
      bindFloat(instance, "height", size.iconSize, "size");
      tag(
        instance,
        source,
        role,
        componentOwnershipKey + "/children/" + componentChildIndex++
      );
      component.appendChild(instance);
      createdNodeIds.push(instance.id);
      return instance;
    };
    const hasLeading = icons === "leading" || icons === "both";
    const hasTrailing = icons === "trailing" || icons === "both";
    if (state === "loading") {
      addIcon("button/loading-indicator", loadingHelper, source.refs.loading);
    } else if (hasLeading) {
      addIcon("button/slot/leading", leadingHelper, source.refs.leading);
    }

    const label = figma.createText();
    label.name =
      source.labels.label === "button/label"
        ? "button/label"
        : "button/label :: " + source.labels.label;
    let font = null;
    for (const candidateFont of resolveFonts(size.fontFamily, size.fontStyle)) {
      await figma.loadFontAsync(candidateFont);
      label.fontName = candidateFont;
      label.characters = source.label;
      if (label.width > 0 && label.height > 0) {
        font = candidateFont;
        break;
      }
    }
    if (!font) {
      label.remove();
      throw new Error(
        "FONT-FALLBACK-GEOMETRY:" +
          source.adapterIdentity +
          ":" +
          size.fontFamily +
          ":" +
          size.fontStyle
      );
    }
    label.fontSize = size.fontSize.value;
    label.lineHeight = { unit: "PIXELS", value: size.lineHeight.value };
    label.textAlignHorizontal = "CENTER";
    label.textAlignVertical = "CENTER";
    label.characters = source.label;
    label.fills = [bindPaint(appearance.foreground, "text")];
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    label.visible = true;
    label.opacity = 1;
    label.blendMode = "NORMAL";
    component.appendChild(label);
    label.layoutSizingHorizontal = "HUG";
    label.layoutSizingVertical = "HUG";
    if (
      label.characters.trim().length === 0 ||
      label.width <= 0 ||
      label.height <= 0 ||
      label.visible !== true ||
      label.opacity <= 0 ||
      !Array.isArray(label.fills) ||
      label.fills.length === 0
    ) {
      throw new Error("BUTTON-LABEL-GEOMETRY:" + source.adapterIdentity + ":" + component.name);
    }
    bindFloat(label, "fontSize", size.fontSize, "font");
    bindFloat(label, "lineHeight", size.lineHeight, "font");
    tag(
      label,
      source,
      "button/label",
      componentOwnershipKey + "/children/" + componentChildIndex++
    );
    createdNodeIds.push(label.id);

    if (hasTrailing) {
      addIcon("button/slot/trailing", trailingHelper, source.refs.trailing);
    }
    component.primaryAxisSizingMode = "AUTO";
    component.counterAxisSizingMode = "AUTO";
    component.layoutSizingHorizontal = "HUG";
    component.layoutSizingVertical = "HUG";
    components.push(component);
    createdNodeIds.push(component.id);
  }

  const set = figma.combineAsVariants(components, section);
  set.name =
    source.labels.root === "button/set"
      ? "button/set"
      : "button/set :: " + source.labels.root;
  set.description =
    "Experimental button@1 primitive-IR mint. Recipe " + source.recipeHash +
    "; source adapter " + source.adapterIdentity + ".\nrecipe-role:button/set";
  set.layoutMode = "HORIZONTAL";
  set.layoutWrap = "WRAP";
  set.itemSpacing = 24;
  set.counterAxisSpacing = 24;
  set.paddingTop = 32;
  set.paddingRight = 32;
  set.paddingBottom = 32;
  set.paddingLeft = 32;
  set.resizeWithoutConstraints(1800, Math.max(set.height, 200));
  set.primaryAxisSizingMode = "FIXED";
  set.counterAxisSizingMode = "AUTO";
  set.fills = [paint("#f7f7f8ff")];
  set.clipsContent = false;
  tag(set, source, "button/set", "root");
  setSharedData(set, "sourceId", source.sourceId);
  const labelProperty = set.addComponentProperty("Label", "TEXT", source.label);
  const leadingProperty = set.addComponentProperty(
    "Leading icon",
    "INSTANCE_SWAP",
    leadingHelper.id
  );
  const trailingProperty = set.addComponentProperty(
    "Trailing icon",
    "INSTANCE_SWAP",
    trailingHelper.id
  );
  for (const variantComponent of set.children) {
    const descendants = variantComponent.findAllWithCriteria({ types: ["TEXT", "INSTANCE"] });
    for (const descendant of descendants) {
      const role = getSharedData(descendant, "role");
      if (descendant.type === "TEXT" && role === "button/label") {
        descendant.componentPropertyReferences = { characters: labelProperty };
        descendant.visible = true;
        descendant.opacity = 1;
        descendant.blendMode = "NORMAL";
        descendant.textAutoResize = "WIDTH_AND_HEIGHT";
        descendant.layoutSizingHorizontal = "HUG";
        descendant.layoutSizingVertical = "HUG";
      } else if (descendant.type === "INSTANCE" && role === "button/slot/leading") {
        descendant.componentPropertyReferences = { mainComponent: leadingProperty };
      } else if (descendant.type === "INSTANCE" && role === "button/slot/trailing") {
        descendant.componentPropertyReferences = { mainComponent: trailingProperty };
      }
    }
    variantComponent.primaryAxisAlignItems = "CENTER";
    variantComponent.counterAxisAlignItems = "CENTER";
    variantComponent.layoutSizingHorizontal = "HUG";
    variantComponent.layoutSizingVertical = "HUG";
  }
  set.x = 80;
  set.y = 128;
  collectTreeIds(set);
  section.resizeWithoutConstraints(set.width + 160, set.height + 208);
  nextSectionX += section.width + 240;
  summaries.push({
    adapterIdentity: source.adapterIdentity,
    sectionId: section.id,
    setId: set.id,
    collectionId: collection.id,
    variableCount: variables.size,
    variantCount: set.children.length,
    cellCount: sourceCells.length,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelopeHash,
    comparedIrFacts: source.comparedIrFacts,
  });
}
return {
  writerVersion: Number(WRITER_VERSION),
  fileKey: figma.fileKey,
  fileName: figma.root.name,
  pageId: page.id,
  pageName: page.name,
  runIdentity: PLAN.runIdentity,
  createdNodeIds: [...new Set(createdNodeIds)],
  mutatedNodeIds: [...new Set(mutatedNodeIds)],
  sources: summaries,
};
`;

export function emitButtonFigmaWriter(
  inputs: readonly ButtonFigmaWriterInput[],
): ButtonFigmaWriter {
  if (inputs.length !== 2) {
    throw new TypeError(
      `Button live proof requires exactly two source plans; found ${inputs.length}`,
    );
  }
  const sourcePlans = inputs.map(planSource);
  const sourcePlanFailures = validateButtonFigmaSourcePlans(sourcePlans);
  if (sourcePlanFailures.length > 0) {
    throw new TypeError(sourcePlanFailures.join("; "));
  }
  const runIdentity =
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
    "-v4";
  const pageName = `Recipe Pivot / Button / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map(
      ({ cells: _cells, expectedScenePlan: _expectedScenePlan, ...source }) =>
        source,
    ),
  };
  return {
    pageName,
    runIdentity,
    sourcePlans,
    code: `const PLAN=${JSON.stringify(plan)};\n${runtime}`,
  };
}
