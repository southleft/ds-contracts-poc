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

export const MENU_RECIPE_REF = {
  id: "menu",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Open menu panel chrome plus two items. Astryx has no Menu export;
 * compile DropdownMenu. AntD compiles Dropdown. Placement is a refusal.
 * One named default hug cell.
 */
export const MENU_DEFAULT = ["true"] as const;
export type MenuDefault = (typeof MENU_DEFAULT)[number];

export interface MenuNumberParameter {
  variable: string;
  fallback: number;
}
export interface MenuColorParameter {
  variable: string;
  fallback: string;
}
export interface MenuFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

export interface MenuRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "menu"; control: "menu"; label: "label" };
  axes: {
    default: {
      name: "Default";
      values: MenuDefault[];
      default: MenuDefault;
    };
  };
  content: { first: string; second: string };
  tokens: {
    panel: {
      padding: MenuNumberParameter;
      radius: MenuNumberParameter;
      itemSpacing: MenuNumberParameter;
      fill: MenuColorParameter;
    };
    item: {
      paddingX: MenuNumberParameter;
      paddingY: MenuNumberParameter;
      minHeight: MenuNumberParameter;
      fill: MenuColorParameter;
    };
    labelFontSize: MenuNumberParameter;
    labelLineHeight: MenuNumberParameter;
    lineHeightUnit: "px" | "auto";
    label: MenuColorParameter;
    typography: { label: MenuFontSpec };
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

export const MenuRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("menu"),
    control: z.literal("menu"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(MENU_DEFAULT)).min(1),
      default: z.enum(MENU_DEFAULT),
    }),
  }),
  content: z.strictObject({
    first: z.string().min(1),
    second: z.string().min(1),
  }),
  tokens: z.strictObject({
    panel: z.strictObject({
      padding: NumberParameterSchema,
      radius: NumberParameterSchema,
      itemSpacing: NumberParameterSchema,
      fill: ColorParameterSchema,
    }),
    item: z.strictObject({
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      minHeight: NumberParameterSchema,
      fill: ColorParameterSchema,
    }),
    labelFontSize: NumberParameterSchema,
    labelLineHeight: NumberParameterSchema,
    lineHeightUnit: z.enum(["px", "auto"]),
    label: ColorParameterSchema,
    typography: z.strictObject({ label: FontSpecSchema }),
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

export function normalizeMenuRecipeInstance(input: unknown): MenuRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    MENU_RECIPE_REF,
  );
  const instance = MenuRecipeInstanceSchema.parse(input) as MenuRecipeInstance;
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
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: MenuNumberParameter | MenuColorParameter,
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

const labelNode = (instance: MenuRecipeInstance, characters: string): TextNode => ({
  kind: "text",
  role: "menu/label",
  label: "menu/label",
  characters,
  type: {
    fontFamily: instance.tokens.typography.label.resolvedFamily,
    fontStyle: instance.tokens.typography.label.resolvedStyle,
    fontProvenance: instance.tokens.typography.label,
    fontSize: instance.tokens.labelFontSize.fallback,
    lineHeight:
      instance.tokens.lineHeightUnit === "auto"
        ? { unit: "auto" as const }
        : {
            unit: "px" as const,
            value: instance.tokens.labelLineHeight.fallback,
          },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(instance.tokens.label.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", instance.tokens.labelFontSize),
    ...(instance.tokens.lineHeightUnit === "px"
      ? [bind("type.lineHeight.value", instance.tokens.labelLineHeight)]
      : []),
    bind("fills.0.color", instance.tokens.label),
  ],
});

const itemNode = (instance: MenuRecipeInstance, characters: string): FrameNode => ({
  kind: "frame",
  role: "menu/item",
  label: "menu/item",
  layout: {
    mode: "horizontal",
    primaryAxisAlign: "min",
    counterAxisAlign: "center",
    itemSpacing: 0,
    padding: {
      top: instance.tokens.item.paddingY.fallback,
      right: instance.tokens.item.paddingX.fallback,
      bottom: instance.tokens.item.paddingY.fallback,
      left: instance.tokens.item.paddingX.fallback,
    },
    width: hug,
    height: hug,
    ...(instance.tokens.item.minHeight.fallback > 0
      ? { minHeight: instance.tokens.item.minHeight.fallback }
      : {}),
  },
  fills: [solid(instance.tokens.item.fill.fallback)],
  bindings: [
    bind("layout.padding.top", instance.tokens.item.paddingY),
    bind("layout.padding.right", instance.tokens.item.paddingX),
    bind("layout.padding.bottom", instance.tokens.item.paddingY),
    bind("layout.padding.left", instance.tokens.item.paddingX),
    bind("fills.0.color", instance.tokens.item.fill),
    ...(instance.tokens.item.minHeight.fallback > 0
      ? [bind("layout.minHeight", instance.tokens.item.minHeight)]
      : []),
  ],
  children: [labelNode(instance, characters)],
});

export function compileMenuIr(instance: MenuRecipeInstance): ComponentNode {
  return {
    kind: "component",
    role: "menu/variant/default",
    label: instance.identity.name,
    variantProperties: { Default: "true" },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: instance.tokens.panel.itemSpacing.fallback,
      padding: {
        top: instance.tokens.panel.padding.fallback,
        right: instance.tokens.panel.padding.fallback,
        bottom: instance.tokens.panel.padding.fallback,
        left: instance.tokens.panel.padding.fallback,
      },
      width: hug,
      height: hug,
    },
    fills: [solid(instance.tokens.panel.fill.fallback)],
    cornerRadius: corners(instance.tokens.panel.radius.fallback),
    bindings: [
      bind("layout.itemSpacing", instance.tokens.panel.itemSpacing),
      bind("layout.padding.top", instance.tokens.panel.padding),
      bind("layout.padding.right", instance.tokens.panel.padding),
      bind("layout.padding.bottom", instance.tokens.panel.padding),
      bind("layout.padding.left", instance.tokens.panel.padding),
      bind("fills.0.color", instance.tokens.panel.fill),
      bind("cornerRadius.topLeft", instance.tokens.panel.radius),
      bind("cornerRadius.topRight", instance.tokens.panel.radius),
      bind("cornerRadius.bottomRight", instance.tokens.panel.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.panel.radius),
    ],
    children: [
      itemNode(instance, instance.content.first),
      itemNode(instance, instance.content.second),
    ],
  };
}

export function compileMenuRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeMenuRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      MENU_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "menu / dropdown",
    recipe: MENU_RECIPE_REF,
    ir: compileMenuIr(instance),
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
  if (root.kind !== "component" || root.role !== "menu/variant/default")
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      "menu@1 IR is one named default component — no invented Size/Placement set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      "menu/variant/default Default=true names the default cell; it is not a matrix axis",
    ]);
  return root;
};
const itemsOf = (parent: { children?: IRNode[] }): FrameNode[] => {
  const found = (parent.children ?? []).filter(
    (child) => child.role === "menu/item" && child.kind === "frame",
  );
  if (found.length !== 2)
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      "expected exactly two menu/item frames",
    ]);
  return found as FrameNode[];
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
    throw new RecipeRefusal(MENU_RECIPE_REF, [
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
    throw new RecipeRefusal(MENU_RECIPE_REF, [
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
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      `binding ${field} must appear at most once`,
    ]);
  return found[0]?.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): MenuNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): MenuColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(MENU_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): MenuFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as MenuFontSpec;
};

export function validateMenuStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.layout.mode !== "vertical")
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      `${variant.role}: menu panel is a vertical list`,
    ]);
  if (variant.layout.width.mode !== "hug" || variant.layout.height.mode !== "hug")
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      `${variant.role}: panel hugs the two items — no invented default px panel`,
    ]);
  const items = itemsOf(variant);
  for (const item of items) {
    if (item.layout.mode !== "horizontal")
      throw new RecipeRefusal(MENU_RECIPE_REF, [
        "menu items are horizontal label rows",
      ]);
    direct(item, "menu/label", "text");
  }
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

export function collapseMenuRecipe(
  envelopeInput: unknown,
  selection: unknown,
): MenuRecipeInstance {
  requireExactRecipeSelection(selection, MENU_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== MENU_RECIPE_REF.id)
    throw new RecipeRefusal(MENU_RECIPE_REF, ["envelope recipe mismatch"]);
  validateMenuStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const [firstItem, secondItem] = itemsOf(variant);
  const firstLabel = direct(firstItem!, "menu/label", "text");
  const secondLabel = direct(secondItem!, "menu/label", "text");
  const instance = normalizeMenuRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "menu", control: "menu", label: "label" },
    axes: {
      default: {
        name: "Default",
        values: [...MENU_DEFAULT],
        default: "true",
      },
    },
    content: {
      first: firstLabel.characters,
      second: secondLabel.characters,
    },
    tokens: {
      panel: {
        padding: numberFrom(
          variant,
          "layout.padding.left",
          variant.layout.padding.left,
        ),
        radius: numberFrom(
          variant,
          "cornerRadius.topLeft",
          variant.cornerRadius?.topLeft ?? 0,
        ),
        itemSpacing: numberFrom(
          variant,
          "layout.itemSpacing",
          variant.layout.itemSpacing,
        ),
        fill: colorFrom(
          variant,
          "fills.0.color",
          solidColor(variant.fills[0], variant.role!),
        ),
      },
      item: {
        paddingX: numberFrom(
          firstItem!,
          "layout.padding.left",
          firstItem!.layout.padding.left,
        ),
        paddingY: numberFrom(
          firstItem!,
          "layout.padding.top",
          firstItem!.layout.padding.top,
        ),
        minHeight: {
          variable:
            optionalBinding(firstItem!, "layout.minHeight") ??
            `${envelope.id}.item-minHeight`,
          fallback: firstItem!.layout.minHeight ?? 0,
        },
        fill: colorFrom(
          firstItem!,
          "fills.0.color",
          solidColor(firstItem!.fills[0], firstItem!.role!),
        ),
      },
      labelFontSize: numberFrom(
        firstLabel,
        "type.fontSize",
        firstLabel.type.fontSize,
      ),
      labelLineHeight:
        firstLabel.type.lineHeight.unit === "px"
          ? numberFrom(
              firstLabel,
              "type.lineHeight.value",
              firstLabel.type.lineHeight.value,
            )
          : {
              variable: `${envelope.id}.labelLineHeight`,
              fallback: 0,
            },
      lineHeightUnit: firstLabel.type.lineHeight.unit === "auto" ? "auto" : "px",
      label: colorFrom(
        firstLabel,
        "fills.0.color",
        solidColor(firstLabel.fills[0], firstLabel.role!),
      ),
      typography: { label: fontFrom(firstLabel) },
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
  const recompiled = compileMenuRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(MENU_RECIPE_REF, [
      `unsupported structural edit at ${difference}; menu@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const menuRecipe: Recipe<MenuRecipeInstance> = {
  ref: MENU_RECIPE_REF,
  normalize: normalizeMenuRecipeInstance,
  compile: compileMenuRecipe,
  collapse: collapseMenuRecipe,
};
