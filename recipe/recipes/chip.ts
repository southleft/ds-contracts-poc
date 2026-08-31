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

export const CHIP_RECIPE_REF = {
  id: "chip",
  version: 1,
} as const satisfies RecipeRef;

/**
 * In-page chip/tag. Astryx Token (no Chip export). MUI Chip filled /
 * default / medium. AntD Tag bordered, not closable. Color, size, and
 * closable are not shared axes. One named default cell. IR forbids a
 * one-value variant axis — compile a lone component, do not invent a
 * Color/Size/Closable matrix just to form a set.
 */
export const CHIP_DEFAULT = ["true"] as const;
export type ChipDefault = (typeof CHIP_DEFAULT)[number];

export interface ChipNumberParameter {
  variable: string;
  fallback: number;
}
export interface ChipColorParameter {
  variable: string;
  fallback: string;
}
export interface ChipFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

interface StateCell {
  boxFill: ChipColorParameter;
  boxBorder: ChipColorParameter;
  boxOpacity: ChipNumberParameter;
  label: ChipColorParameter;
}

export interface ChipRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "chip"; control: "chip"; label: "label" };
  axes: {
    default: {
      name: "Default";
      values: ChipDefault[];
      default: ChipDefault;
    };
  };
  content: { label: string };
  tokens: {
    box: {
      height: ChipNumberParameter;
      paddingX: ChipNumberParameter;
      paddingY: ChipNumberParameter;
      radius: ChipNumberParameter;
      borderWidth: ChipNumberParameter;
    };
    labelFontSize: ChipNumberParameter;
    labelLineHeight: ChipNumberParameter;
    strokeAlign: "inside" | "outside";
    rest: StateCell;
    typography: { label: ChipFontSpec };
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
const StateCellSchema = z.strictObject({
  boxFill: ColorParameterSchema,
  boxBorder: ColorParameterSchema,
  boxOpacity: NumberParameterSchema,
  label: ColorParameterSchema,
});

export const ChipRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("chip"),
    control: z.literal("chip"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(CHIP_DEFAULT)).min(1),
      default: z.enum(CHIP_DEFAULT),
    }),
  }),
  content: z.strictObject({ label: z.string().min(1) }),
  tokens: z.strictObject({
    box: z.strictObject({
      height: NumberParameterSchema,
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
    }),
    labelFontSize: NumberParameterSchema,
    labelLineHeight: NumberParameterSchema,
    strokeAlign: z.enum(["inside", "outside"]),
    rest: StateCellSchema,
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

export function normalizeChipRecipeInstance(input: unknown): ChipRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    CHIP_RECIPE_REF,
  );
  const instance = ChipRecipeInstanceSchema.parse(input) as ChipRecipeInstance;
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
const fixed = (value: number) => ({ mode: "fixed" as const, value });
const solid = (color: string) => ({ kind: "solid" as const, color });
const bind = (
  field: string,
  parameter: ChipNumberParameter | ChipColorParameter,
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

export function compileChipIr(instance: ChipRecipeInstance): ComponentNode {
  const cell = instance.tokens.rest;
  const label: TextNode = {
    kind: "text",
    role: "chip/label",
    label: "chip/label",
    characters: instance.content.label,
    type: {
      fontFamily: instance.tokens.typography.label.resolvedFamily,
      fontStyle: instance.tokens.typography.label.resolvedStyle,
      fontProvenance: instance.tokens.typography.label,
      fontSize: instance.tokens.labelFontSize.fallback,
      lineHeight: {
        unit: "px",
        value: instance.tokens.labelLineHeight.fallback,
      },
    },
    align: "left",
    verticalAlign: "center",
    fills: [solid(cell.label.fallback)],
    width: hug,
    height: hug,
    bindings: [
      bind("type.fontSize", instance.tokens.labelFontSize),
      bind("type.lineHeight.value", instance.tokens.labelLineHeight),
      bind("fills.0.color", cell.label),
    ],
  };
  const variant: ComponentNode = {
    kind: "component",
    role: "chip/variant/default",
    label: instance.identity.name,
    variantProperties: { Default: "true" },
    opacity: cell.boxOpacity.fallback,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: {
        top: instance.tokens.box.paddingY.fallback,
        right: instance.tokens.box.paddingX.fallback,
        bottom: instance.tokens.box.paddingY.fallback,
        left: instance.tokens.box.paddingX.fallback,
      },
      width: hug,
      height: fixed(instance.tokens.box.height.fallback),
    },
    fills: [solid(cell.boxFill.fallback)],
    strokes: [
      {
        weight: instance.tokens.box.borderWidth.fallback,
        align: instance.tokens.strokeAlign,
        paint: solid(cell.boxBorder.fallback),
      },
    ],
    cornerRadius: corners(instance.tokens.box.radius.fallback),
    bindings: [
      bind("layout.height.value", instance.tokens.box.height),
      bind("layout.padding.top", instance.tokens.box.paddingY),
      bind("layout.padding.right", instance.tokens.box.paddingX),
      bind("layout.padding.bottom", instance.tokens.box.paddingY),
      bind("layout.padding.left", instance.tokens.box.paddingX),
      bind("fills.0.color", cell.boxFill),
      bind("strokes.0.weight", instance.tokens.box.borderWidth),
      bind("strokes.0.paint.color", cell.boxBorder),
      bind("cornerRadius.topLeft", instance.tokens.box.radius),
      bind("cornerRadius.topRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomRight", instance.tokens.box.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.box.radius),
    ],
    children: [label],
  };
  return variant;
}

export function compileChipRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeChipRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      CHIP_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "badge / tag / chip",
    recipe: CHIP_RECIPE_REF,
    ir: compileChipIr(instance),
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
  if (root.kind !== "component" || root.role !== "chip/variant/default")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      "chip@1 IR is one named default component — no invented Color/Size/Closable set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      "chip/variant/default Default=true names the default cell; it is not a matrix axis",
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
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
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
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): ChipNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): ChipColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): ChipFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as ChipFontSpec;
};

export function validateChipStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.layout.mode !== "horizontal")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${variant.role}: chip root is a horizontal label cell`,
    ]);
  if (variant.layout.height.mode !== "fixed")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${variant.role}: the chip must carry a named height`,
    ]);
  if (variant.layout.width.mode !== "hug")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${variant.role}: width hugs content — no invented default px width`,
    ]);
  if ((variant.strokes?.length ?? 0) !== 1)
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${variant.role}: every chip carries a named stroke (weight may be 0)`,
    ]);
  if (variant.children.length !== 1)
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `${variant.role}: default cell is label-only; icon/close wait`,
    ]);
  direct(variant, "chip/label", "text");
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

export function collapseChipRecipe(
  envelopeInput: unknown,
  selection: unknown,
): ChipRecipeInstance {
  requireExactRecipeSelection(selection, CHIP_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== CHIP_RECIPE_REF.id)
    throw new RecipeRefusal(CHIP_RECIPE_REF, ["envelope recipe mismatch"]);
  validateChipStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const label = direct(variant, "chip/label", "text");
  const strokeAlign = variant.strokes?.[0]?.align;
  if (strokeAlign !== "inside" && strokeAlign !== "outside")
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      "chip stroke align must be inside or outside",
    ]);
  const height =
    variant.layout.height.mode === "fixed" ? variant.layout.height.value : 0;
  const instance = normalizeChipRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "chip", control: "chip", label: "label" },
    axes: {
      default: {
        name: "Default",
        values: [...CHIP_DEFAULT],
        default: "true",
      },
    },
    content: { label: label.characters },
    tokens: {
      box: {
        height: numberFrom(variant, "layout.height.value", height),
        paddingX: numberFrom(
          variant,
          "layout.padding.left",
          variant.layout.padding.left,
        ),
        paddingY: numberFrom(
          variant,
          "layout.padding.top",
          variant.layout.padding.top,
        ),
        radius: numberFrom(
          variant,
          "cornerRadius.topLeft",
          variant.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(
          variant,
          "strokes.0.weight",
          variant.strokes?.[0]?.weight ?? 0,
        ),
      },
      labelFontSize: numberFrom(label, "type.fontSize", label.type.fontSize),
      labelLineHeight: numberFrom(
        label,
        "type.lineHeight.value",
        label.type.lineHeight.unit === "px" ? label.type.lineHeight.value : 0,
      ),
      strokeAlign,
      rest: {
        boxFill: colorFrom(
          variant,
          "fills.0.color",
          solidColor(variant.fills[0], variant.role!),
        ),
        boxBorder: colorFrom(
          variant,
          "strokes.0.paint.color",
          solidColor(variant.strokes?.[0]?.paint, variant.role!),
        ),
        boxOpacity: {
          variable: `${envelope.id}.rest-boxOpacity`,
          fallback: variant.opacity ?? 1,
        },
        label: colorFrom(
          label,
          "fills.0.color",
          solidColor(label.fills[0], label.role!),
        ),
      },
      typography: { label: fontFrom(label) },
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
  const recompiled = compileChipRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(CHIP_RECIPE_REF, [
      `unsupported structural edit at ${difference}; chip@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const chipRecipe: Recipe<ChipRecipeInstance> = {
  ref: CHIP_RECIPE_REF,
  normalize: normalizeChipRecipeInstance,
  compile: compileChipRecipe,
  collapse: collapseChipRecipe,
};
