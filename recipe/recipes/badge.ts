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

export const BADGE_RECIPE_REF = {
  id: "badge",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Anchored overlay badge. MUI Badge standard/default/rectangular/top-right
 * and AntD Badge count (colorError when color unset). Astryx Badge is an
 * inline label — overlay is a named refusal; do not invent an Astryx pip
 * and do not remint Token. Color, dot, status, and Ribbon are not axes.
 * IR forbids a one-value variant axis — compile a lone component.
 */
export const BADGE_DEFAULT = ["true"] as const;
export type BadgeDefault = (typeof BADGE_DEFAULT)[number];

export interface BadgeNumberParameter {
  variable: string;
  fallback: number;
}
export interface BadgeColorParameter {
  variable: string;
  fallback: string;
}
export interface BadgeFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

export interface BadgeRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "badge"; host: "host"; indicator: "indicator"; label: "label" };
  axes: {
    default: {
      name: "Default";
      values: BadgeDefault[];
      default: BadgeDefault;
    };
  };
  content: { count: string };
  tokens: {
    host: {
      size: BadgeNumberParameter;
      radius: BadgeNumberParameter;
      fill: BadgeColorParameter;
    };
    indicator: {
      height: BadgeNumberParameter;
      minWidth: BadgeNumberParameter;
      paddingX: BadgeNumberParameter;
      radius: BadgeNumberParameter;
      borderWidth: BadgeNumberParameter;
      translateX: BadgeNumberParameter;
      translateY: BadgeNumberParameter;
      fill: BadgeColorParameter;
      border: BadgeColorParameter;
      opacity: BadgeNumberParameter;
    };
    labelFontSize: BadgeNumberParameter;
    labelLineHeight: BadgeNumberParameter;
    strokeAlign: "inside" | "outside";
    label: BadgeColorParameter;
    typography: { label: BadgeFontSpec };
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

export const BadgeRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("badge"),
    host: z.literal("host"),
    indicator: z.literal("indicator"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(BADGE_DEFAULT)).min(1),
      default: z.enum(BADGE_DEFAULT),
    }),
  }),
  content: z.strictObject({ count: z.string().min(1) }),
  tokens: z.strictObject({
    host: z.strictObject({
      size: NumberParameterSchema,
      radius: NumberParameterSchema,
      fill: ColorParameterSchema,
    }),
    indicator: z.strictObject({
      height: NumberParameterSchema,
      minWidth: NumberParameterSchema,
      paddingX: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
      translateX: NumberParameterSchema,
      translateY: NumberParameterSchema,
      fill: ColorParameterSchema,
      border: ColorParameterSchema,
      opacity: NumberParameterSchema,
    }),
    labelFontSize: NumberParameterSchema,
    labelLineHeight: NumberParameterSchema,
    strokeAlign: z.enum(["inside", "outside"]),
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

export function normalizeBadgeRecipeInstance(
  input: unknown,
): BadgeRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    BADGE_RECIPE_REF,
  );
  const instance = BadgeRecipeInstanceSchema.parse(input) as BadgeRecipeInstance;
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
  parameter: BadgeNumberParameter | BadgeColorParameter,
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

export function compileBadgeIr(instance: BadgeRecipeInstance): ComponentNode {
  const hostSize = instance.tokens.host.size.fallback;
  const label: TextNode = {
    kind: "text",
    role: "badge/label",
    label: "badge/label",
    characters: instance.content.count,
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
    align: "center",
    verticalAlign: "center",
    fills: [solid(instance.tokens.label.fallback)],
    width: hug,
    height: hug,
    bindings: [
      bind("type.fontSize", instance.tokens.labelFontSize),
      bind("type.lineHeight.value", instance.tokens.labelLineHeight),
      bind("fills.0.color", instance.tokens.label),
    ],
  };
  const indicator: FrameNode = {
    kind: "frame",
    role: "badge/indicator",
    label: "badge/indicator",
    opacity: instance.tokens.indicator.opacity.fallback,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: {
        top: 0,
        right: instance.tokens.indicator.paddingX.fallback,
        bottom: 0,
        left: instance.tokens.indicator.paddingX.fallback,
      },
      width: hug,
      height: fixed(instance.tokens.indicator.height.fallback),
      minWidth: instance.tokens.indicator.minWidth.fallback,
      positioning: "absolute",
      offset: {
        x: instance.tokens.indicator.translateX.fallback,
        y: instance.tokens.indicator.translateY.fallback,
      },
      constraints: { horizontal: "right", vertical: "top" },
    },
    fills: [solid(instance.tokens.indicator.fill.fallback)],
    strokes: [
      {
        weight: instance.tokens.indicator.borderWidth.fallback,
        align: instance.tokens.strokeAlign,
        paint: solid(instance.tokens.indicator.border.fallback),
      },
    ],
    cornerRadius: corners(instance.tokens.indicator.radius.fallback),
    bindings: [
      bind("layout.height.value", instance.tokens.indicator.height),
      bind("layout.minWidth", instance.tokens.indicator.minWidth),
      bind("layout.padding.right", instance.tokens.indicator.paddingX),
      bind("layout.padding.left", instance.tokens.indicator.paddingX),
      bind("fills.0.color", instance.tokens.indicator.fill),
      bind("strokes.0.weight", instance.tokens.indicator.borderWidth),
      bind("strokes.0.paint.color", instance.tokens.indicator.border),
      bind("cornerRadius.topLeft", instance.tokens.indicator.radius),
      bind("cornerRadius.topRight", instance.tokens.indicator.radius),
      bind("cornerRadius.bottomRight", instance.tokens.indicator.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.indicator.radius),
    ],
    children: [label],
  };
  const host: FrameNode = {
    kind: "frame",
    role: "badge/host",
    label: "badge/host",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "center",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(hostSize),
      height: fixed(hostSize),
    },
    fills: [solid(instance.tokens.host.fill.fallback)],
    cornerRadius: corners(instance.tokens.host.radius.fallback),
    bindings: [
      bind("layout.width.value", instance.tokens.host.size),
      bind("layout.height.value", instance.tokens.host.size),
      bind("fills.0.color", instance.tokens.host.fill),
      bind("cornerRadius.topLeft", instance.tokens.host.radius),
      bind("cornerRadius.topRight", instance.tokens.host.radius),
      bind("cornerRadius.bottomRight", instance.tokens.host.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.host.radius),
    ],
    children: [],
  };
  return {
    kind: "component",
    role: "badge/variant/default",
    label: instance.identity.name,
    variantProperties: { Default: "true" },
    clipsContent: false,
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [],
    children: [host, indicator],
  };
}

export function compileBadgeRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeBadgeRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      BADGE_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "badge / tag / chip",
    recipe: BADGE_RECIPE_REF,
    ir: compileBadgeIr(instance),
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
  if (root.kind !== "component" || root.role !== "badge/variant/default")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      "badge@1 IR is one named default overlay component — no invented Color/dot/Ribbon set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      "badge/variant/default Default=true names the default cell; it is not a matrix axis",
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
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
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
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): BadgeNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): BadgeColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [`${role}: expected a solid fill`]);
  return candidate.color;
};
const fontFrom = (node: TextNode): BadgeFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as BadgeFontSpec;
};

export function validateBadgeStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.clipsContent !== false)
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${variant.role}: overlay indicator must paint outside the host`,
    ]);
  if (variant.children.length !== 2)
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${variant.role}: default cell is host + indicator; Avatar wait, icon/dot/Ribbon wait`,
    ]);
  const host = direct(variant, "badge/host", "frame");
  const indicator = direct(variant, "badge/indicator", "frame");
  if (host.layout.width.mode !== "fixed" || host.layout.height.mode !== "fixed")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${host.role}: host size is the named Avatar default the Badge proofs mount`,
    ]);
  if (indicator.layout.positioning !== "absolute")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${indicator.role}: indicator is the anchored overlay`,
    ]);
  if (
    indicator.layout.constraints?.horizontal !== "right" ||
    indicator.layout.constraints?.vertical !== "top"
  )
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `${indicator.role}: named default is top-right`,
    ]);
  direct(indicator, "badge/label", "text");
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

export function collapseBadgeRecipe(
  envelopeInput: unknown,
  selection: unknown,
): BadgeRecipeInstance {
  requireExactRecipeSelection(selection, BADGE_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== BADGE_RECIPE_REF.id)
    throw new RecipeRefusal(BADGE_RECIPE_REF, ["envelope recipe mismatch"]);
  validateBadgeStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const host = direct(variant, "badge/host", "frame");
  const indicator = direct(variant, "badge/indicator", "frame");
  const label = direct(indicator, "badge/label", "text");
  const strokeAlign = indicator.strokes?.[0]?.align;
  if (strokeAlign !== "inside" && strokeAlign !== "outside")
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      "badge stroke align must be inside or outside",
    ]);
  const hostSize =
    host.layout.width.mode === "fixed" ? host.layout.width.value : 0;
  const height =
    indicator.layout.height.mode === "fixed"
      ? indicator.layout.height.value
      : 0;
  const instance = normalizeBadgeRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "badge", host: "host", indicator: "indicator", label: "label" },
    axes: {
      default: {
        name: "Default",
        values: [...BADGE_DEFAULT],
        default: "true",
      },
    },
    content: { count: label.characters },
    tokens: {
      host: {
        size: numberFrom(host, "layout.width.value", hostSize),
        radius: numberFrom(
          host,
          "cornerRadius.topLeft",
          host.cornerRadius?.topLeft ?? 0,
        ),
        fill: colorFrom(host, "fills.0.color", solidColor(host.fills[0], host.role!)),
      },
      indicator: {
        height: numberFrom(indicator, "layout.height.value", height),
        minWidth: numberFrom(
          indicator,
          "layout.minWidth",
          indicator.layout.minWidth ?? 0,
        ),
        paddingX: numberFrom(
          indicator,
          "layout.padding.left",
          indicator.layout.padding.left,
        ),
        radius: numberFrom(
          indicator,
          "cornerRadius.topLeft",
          indicator.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(
          indicator,
          "strokes.0.weight",
          indicator.strokes?.[0]?.weight ?? 0,
        ),
        translateX: {
          variable: `${envelope.id}.indicator-translateX`,
          fallback: indicator.layout.offset?.x ?? 0,
        },
        translateY: {
          variable: `${envelope.id}.indicator-translateY`,
          fallback: indicator.layout.offset?.y ?? 0,
        },
        fill: colorFrom(
          indicator,
          "fills.0.color",
          solidColor(indicator.fills[0], indicator.role!),
        ),
        border: colorFrom(
          indicator,
          "strokes.0.paint.color",
          solidColor(indicator.strokes?.[0]?.paint, indicator.role!),
        ),
        opacity: {
          variable: `${envelope.id}.indicator-opacity`,
          fallback: indicator.opacity ?? 1,
        },
      },
      labelFontSize: numberFrom(label, "type.fontSize", label.type.fontSize),
      labelLineHeight: numberFrom(
        label,
        "type.lineHeight.value",
        label.type.lineHeight.unit === "px" ? label.type.lineHeight.value : 0,
      ),
      strokeAlign,
      label: colorFrom(
        label,
        "fills.0.color",
        solidColor(label.fills[0], label.role!),
      ),
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
  const recompiled = compileBadgeRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(BADGE_RECIPE_REF, [
      `unsupported structural edit at ${difference}; badge@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const badgeRecipe: Recipe<BadgeRecipeInstance> = {
  ref: BADGE_RECIPE_REF,
  normalize: normalizeBadgeRecipeInstance,
  compile: compileBadgeRecipe,
  collapse: collapseBadgeRecipe,
};
