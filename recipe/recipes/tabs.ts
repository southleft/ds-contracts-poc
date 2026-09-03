import * as z from "zod";

import {
  CodeOnlyExtensionSchema,
  ENVELOPE_VERSION,
  LossReceiptSchema,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type CodeOnlyExtension,
  type FactRef,
  type LossReceipt,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  type ComponentNode,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
  type RecipeSelection,
} from "../recipe.js";

export const TABS_RECIPE_REF = {
  id: "tabs",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Two-item horizontal TabList / Tabs / Tabs. Indicator is a child of the
 * selected tab — not an overlay ink bar. Astryx has no Tabs export;
 * compile TabList. One named default cell.
 */
export const TABS_DEFAULT = ["true"] as const;
export type TabsDefault = (typeof TABS_DEFAULT)[number];

export interface TabsNumberParameter {
  variable: string;
  fallback: number;
}
export interface TabsColorParameter {
  variable: string;
  fallback: string;
}
export interface TabsFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

export interface TabsRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "tabs"; control: "tabs"; label: "label" };
  axes: {
    default: {
      name: "Default";
      values: TabsDefault[];
      default: TabsDefault;
    };
  };
  content: { selected: string; rest: string };
  tokens: {
    list: { itemSpacing: TabsNumberParameter };
    tab: {
      paddingX: TabsNumberParameter;
      paddingY: TabsNumberParameter;
      radius: TabsNumberParameter;
      minWidth: TabsNumberParameter;
      minHeight: TabsNumberParameter;
      fill: TabsColorParameter;
      /** How the label sits in the tab box: MUI/AntD centre it (flex, justify/align center); a "start" tab stacks from the top padding. */
      contentAlign: "start" | "center";
      /** How the label sits on the tab's cross axis: `center` when the library centres it (flex align-items, or a <button> whose content the UA centres). */
      verticalAlign: "start" | "center";
    };
    indicator: {
      height: TabsNumberParameter;
      radius: TabsNumberParameter;
      opacity: TabsNumberParameter;
      fill: TabsColorParameter;
      /** The REST tab's underline, drawn like the indicator; transparent when the library paints none (MUI, AntD), Carbon's 2px #e0e0e0 border-block-end otherwise. */
      restFill: TabsColorParameter;
      /** Horizontal inset from each edge of the selected tab (MUI 0: width 100%; Astryx 12: left/right --spacing-3). */
      insetX: TabsNumberParameter;
      /** Distance of the indicator's bottom edge from the tab's bottom edge; negative hangs below (Astryx bottom -1). */
      offsetY: TabsNumberParameter;
    };
    labelFontSize: TabsNumberParameter;
    labelLineHeight: TabsNumberParameter;
    /** px; MUI button typography letterSpacing 0.02857em = 0.4px at 14px (ledger 0.39998px). */
    labelLetterSpacing: TabsNumberParameter;
    lineHeightUnit: "px" | "auto" | "percent";
    textCase: "original" | "upper";
    rest: { label: TabsColorParameter };
    selected: { label: TabsColorParameter };
    typography: { rest: TabsFontSpec; selected: TabsFontSpec };
  };
  inputFacts: FactRef[];
  accounting: { carried: FactRef[] };
  extensions: CodeOnlyExtension[];
  receipts: LossReceipt[];
  provenance: {
    source: string;
    tool: string;
    generatedAt: string;
    selection: RecipeSelection;
    [key: string]: unknown;
  };
}

const FactRefSchema = z.strictObject({
  path: z.string().min(1),
  channel: z.string().min(1),
});
const NumberParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.number().finite(),
});
const ColorParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.string().min(1),
});
const FontSpecSchema = z.strictObject({
  requestedFamily: z.string().min(1),
  requestedStyle: z.string().min(1),
  requestSource: z.string().min(1),
  fallbackChain: z
    .array(
      z.strictObject({ family: z.string().min(1), style: z.string().min(1) }),
    )
    .min(1),
  resolvedFamily: z.string().min(1),
  resolvedStyle: z.string().min(1),
  resolution: z.enum(["requested", "fallback"]),
  degradation: z.string().min(1).optional(),
});

export const TabsRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("tabs"),
    control: z.literal("tabs"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(TABS_DEFAULT)).min(1),
      default: z.enum(TABS_DEFAULT),
    }),
  }),
  content: z.strictObject({
    selected: z.string().min(1),
    rest: z.string().min(1),
  }),
  tokens: z.strictObject({
    list: z.strictObject({ itemSpacing: NumberParameterSchema }),
    tab: z.strictObject({
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      radius: NumberParameterSchema,
      minWidth: NumberParameterSchema,
      minHeight: NumberParameterSchema,
      fill: ColorParameterSchema,
      contentAlign: z.enum(["start", "center"]),
      verticalAlign: z.enum(["start", "center"]),
    }),
    indicator: z.strictObject({
      height: NumberParameterSchema,
      radius: NumberParameterSchema,
      opacity: NumberParameterSchema,
      fill: ColorParameterSchema,
      restFill: ColorParameterSchema,
      insetX: NumberParameterSchema,
      offsetY: NumberParameterSchema,
    }),
    labelFontSize: NumberParameterSchema,
    labelLineHeight: NumberParameterSchema,
    labelLetterSpacing: NumberParameterSchema,
    lineHeightUnit: z.enum(["px", "auto", "percent"]),
    textCase: z.enum(["original", "upper"]),
    rest: z.strictObject({ label: ColorParameterSchema }),
    selected: z.strictObject({ label: ColorParameterSchema }),
    typography: z.strictObject({
      rest: FontSpecSchema,
      selected: FontSpecSchema,
    }),
  }),
  inputFacts: z.array(FactRefSchema),
  accounting: z.strictObject({ carried: z.array(FactRefSchema) }),
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.looseObject({
    source: z.string().min(1),
    tool: z.string().min(1),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
});

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function normalizeTabsRecipeInstance(input: unknown): TabsRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    TABS_RECIPE_REF,
  );
  const instance = TabsRecipeInstanceSchema.parse(input) as TabsRecipeInstance;
  return {
    ...instance,
    inputFacts: [...instance.inputFacts].sort((left, right) =>
      compareText(factId(left), factId(right)),
    ),
    accounting: {
      carried: [...instance.accounting.carried].sort((left, right) =>
        compareText(factId(left), factId(right)),
      ),
    },
    extensions: [...instance.extensions].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    receipts: [...instance.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const fill = { mode: "fill" } as const;
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: TabsNumberParameter | TabsColorParameter,
): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable: parameter.variable,
});
const corners = (value: number) => ({
  topLeft: value,
  topRight: value,
  bottomRight: value,
  bottomLeft: value,
});
const lineHeightOf = (instance: TabsRecipeInstance) =>
  instance.tokens.lineHeightUnit === "auto"
    ? { unit: "auto" as const }
    : instance.tokens.lineHeightUnit === "percent"
      ? {
          unit: "percent" as const,
          value: instance.tokens.labelLineHeight.fallback,
        }
      : {
          unit: "px" as const,
          value: instance.tokens.labelLineHeight.fallback,
        };
const lineHeightBindings = (instance: TabsRecipeInstance) =>
  instance.tokens.lineHeightUnit === "auto"
    ? []
    : [bind("type.lineHeight.value", instance.tokens.labelLineHeight)];

const labelNode = (
  instance: TabsRecipeInstance,
  which: "selected" | "rest",
  characters: string,
): TextNode => {
  const font = instance.tokens.typography[which];
  const color = instance.tokens[which].label;
  return {
    kind: "text",
    role: "tabs/label",
    label: "tabs/label",
    characters,
    type: {
      fontFamily: font.resolvedFamily,
      fontStyle: font.resolvedStyle,
      fontProvenance: font,
      fontSize: instance.tokens.labelFontSize.fallback,
      lineHeight: lineHeightOf(instance),
      letterSpacing: { unit: "px", value: instance.tokens.labelLetterSpacing.fallback },
      textCase: instance.tokens.textCase,
    },
    align: "center",
    verticalAlign: "center",
    fills: [solid(color.fallback)],
    width: hug,
    height: hug,
    bindings: [
      bind("type.fontSize", instance.tokens.labelFontSize),
      bind("type.letterSpacing.value", instance.tokens.labelLetterSpacing),
      ...lineHeightBindings(instance),
      bind("fills.0.color", color),
    ],
  };
};

const paintsInk = (hex8: string): boolean => !/00$/i.test(hex8);

const indicatorNode = (instance: TabsRecipeInstance, which: "selected" | "rest" = "selected"): FrameNode => ({
  kind: "frame",
  role: "tabs/indicator",
  label: "tabs/indicator",
  opacity: instance.tokens.indicator.opacity.fallback,
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "min",
    counterAxisAlign: "min",
    itemSpacing: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    width: fill,
    height: {
      mode: "fixed",
      value: instance.tokens.indicator.height.fallback,
    },
    // The indicator is an ABSOLUTE overlay pinned to the bottom of the
    // selected tab and stretched between insetX from each edge — the named
    // library facts (MUI: position absolute, left 0, bottom 0, width 100%;
    // Astryx: bottom -1, left/right 12). Until 2026-09-01 it sat in the
    // vertical flow under the label at label width, an invented placement
    // that measured 18% against the real render.
    positioning: "absolute",
    constraints: { horizontal: "stretch", vertical: "bottom" },
    // Carried as literals: the IR does not variable-bind an offset (the same
    // as the badge indicator translate), so insetX/offsetY are named facts
    // without a Figma variable behind them.
    offset: {
      x: instance.tokens.indicator.insetX.fallback,
      y: instance.tokens.indicator.offsetY.fallback,
    },
  },
  fills: [solid((which === "selected" ? instance.tokens.indicator.fill : instance.tokens.indicator.restFill).fallback)],
  cornerRadius: corners(instance.tokens.indicator.radius.fallback),
  bindings: [
    bind("layout.height.value", instance.tokens.indicator.height),
    bind("fills.0.color", which === "selected" ? instance.tokens.indicator.fill : instance.tokens.indicator.restFill),
    bind("cornerRadius.topLeft", instance.tokens.indicator.radius),
    bind("cornerRadius.topRight", instance.tokens.indicator.radius),
    bind("cornerRadius.bottomRight", instance.tokens.indicator.radius),
    bind("cornerRadius.bottomLeft", instance.tokens.indicator.radius),
  ],
  children: [],
});

const itemNode = (
  instance: TabsRecipeInstance,
  which: "selected" | "rest",
): FrameNode => {
  const constraints = {
    ...(instance.tokens.tab.minWidth.fallback > 0
      ? { minWidth: instance.tokens.tab.minWidth.fallback }
      : {}),
    ...(instance.tokens.tab.minHeight.fallback > 0
      ? { minHeight: instance.tokens.tab.minHeight.fallback }
      : {}),
  };
  return {
    kind: "frame",
    role: `tabs/item/${which}`,
    label: `tabs/item/${which}`,
    layout: {
      mode: "vertical",
      // MUI Tab: display flex column, justify-content center, align-items
      // center (ledger); AntD .ant-tabs-tab align-items center. The label
      // sits centred inside the minHeight box, not at the top padding.
      // The layout is VERTICAL, so its primary axis is the cross axis of the
      // label: verticalAlign drives it; contentAlign (justify-content) drives
      // the counter axis, the label's own axis.
      primaryAxisAlign: instance.tokens.tab.verticalAlign === "center" ? "center" : "min",
      counterAxisAlign: instance.tokens.tab.contentAlign === "center" ? "center" : "min",
      itemSpacing: 0,
      padding: {
        top: instance.tokens.tab.paddingY.fallback,
        right: instance.tokens.tab.paddingX.fallback,
        bottom: instance.tokens.tab.paddingY.fallback,
        left: instance.tokens.tab.paddingX.fallback,
      },
      width: hug,
      height: hug,
      ...constraints,
    },
    fills: [solid(instance.tokens.tab.fill.fallback)],
    cornerRadius: corners(instance.tokens.tab.radius.fallback),
    bindings: [
      bind("layout.padding.top", instance.tokens.tab.paddingY),
      bind("layout.padding.right", instance.tokens.tab.paddingX),
      bind("layout.padding.bottom", instance.tokens.tab.paddingY),
      bind("layout.padding.left", instance.tokens.tab.paddingX),
      bind("fills.0.color", instance.tokens.tab.fill),
      bind("cornerRadius.topLeft", instance.tokens.tab.radius),
      bind("cornerRadius.topRight", instance.tokens.tab.radius),
      bind("cornerRadius.bottomRight", instance.tokens.tab.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.tab.radius),
      ...(instance.tokens.tab.minWidth.fallback > 0
        ? [bind("layout.minWidth", instance.tokens.tab.minWidth)]
        : []),
      ...(instance.tokens.tab.minHeight.fallback > 0
        ? [bind("layout.minHeight", instance.tokens.tab.minHeight)]
        : []),
    ],
    children:
      which === "selected"
        ? [
            labelNode(instance, "selected", instance.content.selected),
            indicatorNode(instance),
          ]
        : [
            labelNode(instance, "rest", instance.content.rest),
            // The rest tab's underline only when the library paints one
            // (a transparent restFill compiles no node — MUI, AntD, Astryx).
            ...(paintsInk(instance.tokens.indicator.restFill.fallback) ? [indicatorNode(instance, "rest")] : []),
          ],
  };
};

export function compileTabsIr(instance: TabsRecipeInstance): ComponentNode {
  return {
    kind: "component",
    role: "tabs/variant/default",
    label: instance.identity.name,
    variantProperties: { Default: "true" },
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "max",
      itemSpacing: instance.tokens.list.itemSpacing.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [bind("layout.itemSpacing", instance.tokens.list.itemSpacing)],
    children: [itemNode(instance, "selected"), itemNode(instance, "rest")],
  };
}

export function compileTabsRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeTabsRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      TABS_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "tabs",
    recipe: TABS_RECIPE_REF,
    ir: compileTabsIr(instance),
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
    provenance: instance.provenance,
  } as const;
  return RecipeEnvelopeSchema.parse({
    ...unsigned,
    integrity: deriveRecipeIntegrity(unsigned),
  });
}

const defaultCell = (root: IRNode): ComponentNode => {
  if (root.kind !== "component" || root.role !== "tabs/variant/default")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "tabs@1 IR is one named default component — no invented Type/Size set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "tabs/variant/default Default=true names the default cell; it is not a matrix axis",
    ]);
  return root;
};
const direct = <Kind extends IRNode["kind"]>(
  parent: { children?: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const found = (parent.children ?? []).filter(
    (child) => child.role === role && child.kind === kind,
  );
  if (found.length !== 1)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `expected exactly one ${role} of kind ${kind}`,
    ]);
  return found[0] as Extract<IRNode, { kind: Kind }>;
};
const binding = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length !== 1)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const optionalBinding = (
  node: { bindings?: VariableBinding[] },
  field: string,
): string | undefined => {
  const found = (node.bindings ?? []).filter((entry) => entry.field === field);
  if (found.length > 1)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `binding ${field} must appear at most once`,
    ]);
  return found[0]?.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): TabsNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): TabsColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(TABS_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): TabsFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as TabsFontSpec;
};

export function validateTabsStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.layout.mode !== "horizontal")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `${variant.role}: tabs root is a horizontal rail`,
    ]);
  if (variant.layout.width.mode !== "hug" || variant.layout.height.mode !== "hug")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `${variant.role}: rail hugs the two items — no invented default px rail`,
    ]);
  if (variant.children.length !== 2)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `${variant.role}: default cell is two items, first selected`,
    ]);
  const selected = direct(variant, "tabs/item/selected", "frame");
  const rest = direct(variant, "tabs/item/rest", "frame");
  if (selected.layout.mode !== "vertical" || rest.layout.mode !== "vertical")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "tab items stack the label and the selected-child indicator",
    ]);
  if (selected.children.length !== 2)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "selected item binds the indicator as its last child — overlay ink-bar offsets are not invented",
    ]);
  if (rest.children.length !== 1 && rest.children.length !== 2)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "rest item is the label, plus its underline only when the library paints one",
    ]);
  const indicator = direct(selected, "tabs/indicator", "frame");
  if (indicator.layout.width.mode !== "fill")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "indicator fills the selected child — that is the named bind, not an invented overlay width",
    ]);
  if (indicator.layout.height.mode !== "fixed")
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "indicator height is the named 2px host fact",
    ]);
  if (
    indicator.layout.positioning !== "absolute" ||
    indicator.layout.constraints?.horizontal !== "stretch" ||
    indicator.layout.constraints?.vertical !== "bottom" ||
    !indicator.layout.offset
  )
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      "indicator is an absolute bottom-stretched overlay with a named inset and bottom offset — never a flow child under the label",
    ]);
  direct(selected, "tabs/label", "text");
  direct(rest, "tabs/label", "text");
}

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (canonicalJson(left) === canonicalJson(right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  )
    return path;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const found = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (found) return found;
    }
    return path;
  }
  const l = left as Record<string, unknown>;
  const r = right as Record<string, unknown>;
  for (const key of [
    ...new Set([...Object.keys(l), ...Object.keys(r)]),
  ].sort()) {
    if (!(key in l) || !(key in r)) return `${path}.${key}`;
    const found = firstDifference(l[key], r[key], `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
};

export function collapseTabsRecipe(
  envelopeInput: unknown,
  selection: unknown,
): TabsRecipeInstance {
  requireExactRecipeSelection(selection, TABS_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== TABS_RECIPE_REF.id)
    throw new RecipeRefusal(TABS_RECIPE_REF, ["envelope recipe mismatch"]);
  validateTabsStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const selected = direct(variant, "tabs/item/selected", "frame");
  const rest = direct(variant, "tabs/item/rest", "frame");
  const restIndicator = rest.children.length === 2 ? direct(rest, "tabs/indicator", "frame") : null;
  const selectedLabel = direct(selected, "tabs/label", "text");
  const restLabel = direct(rest, "tabs/label", "text");
  const indicator = direct(selected, "tabs/indicator", "frame");
  const lineHeightUnit =
    selectedLabel.type.lineHeight.unit === "auto"
      ? "auto"
      : selectedLabel.type.lineHeight.unit === "percent"
        ? "percent"
        : "px";
  const instance = normalizeTabsRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "tabs", control: "tabs", label: "label" },
    axes: {
      default: {
        name: "Default",
        values: [...TABS_DEFAULT],
        default: "true",
      },
    },
    content: {
      selected: selectedLabel.characters,
      rest: restLabel.characters,
    },
    tokens: {
      list: {
        itemSpacing: numberFrom(
          variant,
          "layout.itemSpacing",
          variant.layout.itemSpacing,
        ),
      },
      tab: {
        paddingX: numberFrom(
          selected,
          "layout.padding.left",
          selected.layout.padding.left,
        ),
        paddingY: numberFrom(
          selected,
          "layout.padding.top",
          selected.layout.padding.top,
        ),
        radius: numberFrom(
          selected,
          "cornerRadius.topLeft",
          selected.cornerRadius?.topLeft ?? 0,
        ),
        minWidth: {
          variable:
            optionalBinding(selected, "layout.minWidth") ??
            `${envelope.id}.tab-minWidth`,
          fallback: selected.layout.minWidth ?? 0,
        },
        minHeight: {
          variable:
            optionalBinding(selected, "layout.minHeight") ??
            `${envelope.id}.tab-minHeight`,
          fallback: selected.layout.minHeight ?? 0,
        },
        fill: colorFrom(
          selected,
          "fills.0.color",
          solidColor(selected.fills[0], selected.role!),
        ),
        contentAlign: selected.layout.counterAxisAlign === "center" ? "center" : "start",
        verticalAlign: selected.layout.primaryAxisAlign === "center" ? "center" : "start",
      },
      indicator: {
        height: numberFrom(
          indicator,
          "layout.height.value",
          indicator.layout.height.mode === "fixed"
            ? indicator.layout.height.value
            : 0,
        ),
        radius: numberFrom(
          indicator,
          "cornerRadius.topLeft",
          indicator.cornerRadius?.topLeft ?? 0,
        ),
        opacity: {
          variable: `${envelope.id}.indicator-opacity`,
          fallback: indicator.opacity ?? 1,
        },
        fill: colorFrom(
          indicator,
          "fills.0.color",
          solidColor(indicator.fills[0], indicator.role!),
        ),
        restFill: restIndicator
          ? colorFrom(restIndicator, "fills.0.color", solidColor(restIndicator.fills[0], restIndicator.role!))
          : { variable: `${envelope.id}.indicator-restFill`, fallback: "#00000000" },
        // Literal facts (no variable binding on an offset — see indicatorNode).
        insetX: {
          variable: `${envelope.id}.indicator-insetX`,
          fallback: indicator.layout.offset?.x ?? 0,
        },
        offsetY: {
          variable: `${envelope.id}.indicator-offsetY`,
          fallback: indicator.layout.offset?.y ?? 0,
        },
      },
      labelFontSize: numberFrom(
        selectedLabel,
        "type.fontSize",
        selectedLabel.type.fontSize,
      ),
      labelLetterSpacing: numberFrom(
        selectedLabel,
        "type.letterSpacing.value",
        selectedLabel.type.letterSpacing?.value ?? 0,
      ),
      labelLineHeight:
        selectedLabel.type.lineHeight.unit === "auto"
          ? {
              variable: `${envelope.id}.labelLineHeight`,
              fallback: 0,
            }
          : numberFrom(
              selectedLabel,
              "type.lineHeight.value",
              selectedLabel.type.lineHeight.value,
            ),
      lineHeightUnit,
      textCase: selectedLabel.type.textCase === "upper" ? "upper" : "original",
      rest: {
        label: colorFrom(
          restLabel,
          "fills.0.color",
          solidColor(restLabel.fills[0], restLabel.role!),
        ),
      },
      selected: {
        label: colorFrom(
          selectedLabel,
          "fills.0.color",
          solidColor(selectedLabel.fills[0], selectedLabel.role!),
        ),
      },
      typography: {
        rest: fontFrom(restLabel),
        selected: fontFrom(selectedLabel),
      },
    },
    inputFacts: [
      ...envelope.accounting.carried,
      ...envelope.extensions.flatMap((extension) => extension.absorbs),
      ...envelope.receipts.map((receipt) => receipt.fact),
    ],
    accounting: envelope.accounting,
    extensions: envelope.extensions,
    receipts: envelope.receipts,
    provenance: envelope.provenance,
  });
  const recompiled = compileTabsRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(TABS_RECIPE_REF, [
      `unsupported structural edit at ${difference}; tabs@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const tabsRecipe: Recipe<TabsRecipeInstance> = {
  ref: TABS_RECIPE_REF,
  normalize: normalizeTabsRecipeInstance,
  compile: compileTabsRecipe,
  collapse: collapseTabsRecipe,
};
