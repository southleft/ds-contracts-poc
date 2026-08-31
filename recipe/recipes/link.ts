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

export const LINK_RECIPE_REF = {
  id: "link",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Inline text decoration. Astryx Link (hasUnderline false → none at rest).
 * MUI Link (underline always). AntD Typography.Link (linkDecoration none).
 * Underline-at-rest is not a shared axis. Color, hover, external icon, and
 * ellipsis are refusals. Archetype is "none" — schema has no link row.
 * One named default cell. IR forbids a one-value variant axis.
 */
export const LINK_DEFAULT = ["true"] as const;
export type LinkDefault = (typeof LINK_DEFAULT)[number];

export interface LinkNumberParameter {
  variable: string;
  fallback: number;
}
export interface LinkColorParameter {
  variable: string;
  fallback: string;
}
export interface LinkFontSpec {
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
  boxFill: LinkColorParameter;
  boxBorder: LinkColorParameter;
  boxOpacity: LinkNumberParameter;
  label: LinkColorParameter;
}

export interface LinkRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "link"; control: "link"; label: "label" };
  axes: {
    default: {
      name: "Default";
      values: LinkDefault[];
      default: LinkDefault;
    };
  };
  content: { label: string };
  tokens: {
    box: {
      height: LinkNumberParameter;
      paddingX: LinkNumberParameter;
      paddingY: LinkNumberParameter;
      radius: LinkNumberParameter;
      borderWidth: LinkNumberParameter;
    };
    labelFontSize: LinkNumberParameter;
    labelLineHeight: LinkNumberParameter;
    lineHeightUnit: "px" | "auto";
    decoration: "none" | "underline";
    strokeAlign: "inside" | "outside";
    rest: StateCell;
    typography: { label: LinkFontSpec };
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

export const LinkRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("link"),
    control: z.literal("link"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(LINK_DEFAULT)).min(1),
      default: z.enum(LINK_DEFAULT),
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
    lineHeightUnit: z.enum(["px", "auto"]),
    decoration: z.enum(["none", "underline"]),
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

export function normalizeLinkRecipeInstance(input: unknown): LinkRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    LINK_RECIPE_REF,
  );
  const instance = LinkRecipeInstanceSchema.parse(input) as LinkRecipeInstance;
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
  parameter: LinkNumberParameter | LinkColorParameter,
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

export function compileLinkIr(instance: LinkRecipeInstance): ComponentNode {
  const cell = instance.tokens.rest;
  const label: TextNode = {
    kind: "text",
    role: "link/label",
    label: "link/label",
    characters: instance.content.label,
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
      textDecoration: instance.tokens.decoration,
    },
    align: "left",
    verticalAlign: "center",
    fills: [solid(cell.label.fallback)],
    width: hug,
    height: hug,
    bindings: [
      bind("type.fontSize", instance.tokens.labelFontSize),
      ...(instance.tokens.lineHeightUnit === "px"
        ? [bind("type.lineHeight.value", instance.tokens.labelLineHeight)]
        : []),
      bind("fills.0.color", cell.label),
    ],
  };
  const variant: ComponentNode = {
    kind: "component",
    role: "link/variant/default",
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
      height: hug,
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

export function compileLinkRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeLinkRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      LINK_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "none",
    recipe: LINK_RECIPE_REF,
    ir: compileLinkIr(instance),
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
  if (root.kind !== "component" || root.role !== "link/variant/default")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      "link@1 IR is one named default component — no invented Color/Size/Closable set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      "link/variant/default Default=true names the default cell; it is not a matrix axis",
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
    throw new RecipeRefusal(LINK_RECIPE_REF, [
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
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): LinkNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): LinkColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(LINK_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): LinkFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as LinkFontSpec;
};

export function validateLinkStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.layout.mode !== "horizontal")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${variant.role}: link root is a horizontal label cell`,
    ]);
  if (variant.layout.height.mode !== "hug")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${variant.role}: height hugs the inline label — no invented default px height`,
    ]);
  if (variant.layout.width.mode !== "hug")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${variant.role}: width hugs content — no invented default px width`,
    ]);
  if ((variant.strokes?.length ?? 0) !== 1)
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${variant.role}: every link carries a named stroke (weight may be 0)`,
    ]);
  if (variant.children.length !== 1)
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `${variant.role}: default cell is label-only; icon/close wait`,
    ]);
  direct(variant, "link/label", "text");
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

export function collapseLinkRecipe(
  envelopeInput: unknown,
  selection: unknown,
): LinkRecipeInstance {
  requireExactRecipeSelection(selection, LINK_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== LINK_RECIPE_REF.id)
    throw new RecipeRefusal(LINK_RECIPE_REF, ["envelope recipe mismatch"]);
  validateLinkStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const label = direct(variant, "link/label", "text");
  const strokeAlign = variant.strokes?.[0]?.align;
  if (strokeAlign !== "inside" && strokeAlign !== "outside")
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      "link stroke align must be inside or outside",
    ]);
  const instance = normalizeLinkRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "link", control: "link", label: "label" },
    axes: {
      default: {
        name: "Default",
        values: [...LINK_DEFAULT],
        default: "true",
      },
    },
    content: { label: label.characters },
    tokens: {
      box: {
        height: {
          variable: `${envelope.id}.box-height`,
          fallback: 0,
        },
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
      labelLineHeight:
        label.type.lineHeight.unit === "px"
          ? numberFrom(
              label,
              "type.lineHeight.value",
              label.type.lineHeight.value,
            )
          : {
              variable: `${envelope.id}.labelLineHeight`,
              fallback: 0,
            },
      lineHeightUnit: label.type.lineHeight.unit === "auto" ? "auto" : "px",
      decoration:
        label.type.textDecoration === "underline" ? "underline" : "none",
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
  const recompiled = compileLinkRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(LINK_RECIPE_REF, [
      `unsupported structural edit at ${difference}; link@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const linkRecipe: Recipe<LinkRecipeInstance> = {
  ref: LINK_RECIPE_REF,
  normalize: normalizeLinkRecipeInstance,
  compile: compileLinkRecipe,
  collapse: collapseLinkRecipe,
};
