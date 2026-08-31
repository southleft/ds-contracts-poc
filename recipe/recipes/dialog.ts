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

export const DIALOG_RECIPE_REF = {
  id: "dialog",
  version: 1,
} as const satisfies RecipeRef;

/**
 * Open dialog paper chrome plus title and body. Astryx compiles Dialog.
 * AntD compiles Modal. Full-bleed scrim size and portal position are
 * refusals. One named default hug cell with a named minWidth.
 */
export const DIALOG_DEFAULT = ["true"] as const;
export type DialogDefault = (typeof DIALOG_DEFAULT)[number];

export interface DialogNumberParameter {
  variable: string;
  fallback: number;
}
export interface DialogColorParameter {
  variable: string;
  fallback: string;
}
export interface DialogFontSpec {
  requestedFamily: string;
  requestedStyle: string;
  requestSource: string;
  fallbackChain: Array<{ family: string; style: string }>;
  resolvedFamily: string;
  resolvedStyle: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

export interface DialogRecipeInstance {
  identity: { id: string; name: string };
  semantic: { root: "dialog"; control: "dialog"; title: "title"; body: "body" };
  axes: {
    default: {
      name: "Default";
      values: DialogDefault[];
      default: DialogDefault;
    };
  };
  content: { title: string; body: string };
  tokens: {
    paper: {
      paddingX: DialogNumberParameter;
      paddingY: DialogNumberParameter;
      radius: DialogNumberParameter;
      itemSpacing: DialogNumberParameter;
      minWidth: DialogNumberParameter;
      fill: DialogColorParameter;
    };
    titleFontSize: DialogNumberParameter;
    titleLineHeight: DialogNumberParameter;
    bodyFontSize: DialogNumberParameter;
    bodyLineHeight: DialogNumberParameter;
    lineHeightUnit: "px" | "auto";
    title: DialogColorParameter;
    body: DialogColorParameter;
    typography: { title: DialogFontSpec; body: DialogFontSpec };
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

export const DialogRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("dialog"),
    control: z.literal("dialog"),
    title: z.literal("title"),
    body: z.literal("body"),
  }),
  axes: z.strictObject({
    default: z.strictObject({
      name: z.literal("Default"),
      values: z.array(z.enum(DIALOG_DEFAULT)).min(1),
      default: z.enum(DIALOG_DEFAULT),
    }),
  }),
  content: z.strictObject({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  tokens: z.strictObject({
    paper: z.strictObject({
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      radius: NumberParameterSchema,
      itemSpacing: NumberParameterSchema,
      minWidth: NumberParameterSchema,
      fill: ColorParameterSchema,
    }),
    titleFontSize: NumberParameterSchema,
    titleLineHeight: NumberParameterSchema,
    bodyFontSize: NumberParameterSchema,
    bodyLineHeight: NumberParameterSchema,
    lineHeightUnit: z.enum(["px", "auto"]),
    title: ColorParameterSchema,
    body: ColorParameterSchema,
    typography: z.strictObject({
      title: FontSpecSchema,
      body: FontSpecSchema,
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

export function normalizeDialogRecipeInstance(
  input: unknown,
): DialogRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    DIALOG_RECIPE_REF,
  );
  const instance = DialogRecipeInstanceSchema.parse(
    input,
  ) as DialogRecipeInstance;
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
  parameter: DialogNumberParameter | DialogColorParameter,
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

const textNode = (
  instance: DialogRecipeInstance,
  role: "dialog/title" | "dialog/body",
  characters: string,
  font: DialogFontSpec,
  size: DialogNumberParameter,
  lineHeight: DialogNumberParameter,
  fill: DialogColorParameter,
): TextNode => ({
  kind: "text",
  role,
  label: role,
  characters,
  type: {
    fontFamily: font.resolvedFamily,
    fontStyle: font.resolvedStyle,
    fontProvenance: font,
    fontSize: size.fallback,
    lineHeight:
      instance.tokens.lineHeightUnit === "auto"
        ? { unit: "auto" as const }
        : {
            unit: "px" as const,
            value: lineHeight.fallback,
          },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(fill.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", size),
    ...(instance.tokens.lineHeightUnit === "px"
      ? [bind("type.lineHeight.value", lineHeight)]
      : []),
    bind("fills.0.color", fill),
  ],
});

export function compileDialogIr(instance: DialogRecipeInstance): ComponentNode {
  return {
    kind: "component",
    role: "dialog/variant/default",
    label: instance.identity.name,
    variantProperties: { Default: "true" },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: instance.tokens.paper.itemSpacing.fallback,
      padding: {
        top: instance.tokens.paper.paddingY.fallback,
        right: instance.tokens.paper.paddingX.fallback,
        bottom: instance.tokens.paper.paddingY.fallback,
        left: instance.tokens.paper.paddingX.fallback,
      },
      width: hug,
      height: hug,
      ...(instance.tokens.paper.minWidth.fallback > 0
        ? { minWidth: instance.tokens.paper.minWidth.fallback }
        : {}),
    },
    fills: [solid(instance.tokens.paper.fill.fallback)],
    cornerRadius: corners(instance.tokens.paper.radius.fallback),
    bindings: [
      bind("layout.itemSpacing", instance.tokens.paper.itemSpacing),
      bind("layout.padding.top", instance.tokens.paper.paddingY),
      bind("layout.padding.right", instance.tokens.paper.paddingX),
      bind("layout.padding.bottom", instance.tokens.paper.paddingY),
      bind("layout.padding.left", instance.tokens.paper.paddingX),
      bind("fills.0.color", instance.tokens.paper.fill),
      bind("cornerRadius.topLeft", instance.tokens.paper.radius),
      bind("cornerRadius.topRight", instance.tokens.paper.radius),
      bind("cornerRadius.bottomRight", instance.tokens.paper.radius),
      bind("cornerRadius.bottomLeft", instance.tokens.paper.radius),
      ...(instance.tokens.paper.minWidth.fallback > 0
        ? [bind("layout.minWidth", instance.tokens.paper.minWidth)]
        : []),
    ],
    children: [
      textNode(
        instance,
        "dialog/title",
        instance.content.title,
        instance.tokens.typography.title,
        instance.tokens.titleFontSize,
        instance.tokens.titleLineHeight,
        instance.tokens.title,
      ),
      textNode(
        instance,
        "dialog/body",
        instance.content.body,
        instance.tokens.typography.body,
        instance.tokens.bodyFontSize,
        instance.tokens.bodyLineHeight,
        instance.tokens.body,
      ),
    ],
  };
}

export function compileDialogRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeDialogRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      DIALOG_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "modal / dialog",
    recipe: DIALOG_RECIPE_REF,
    ir: compileDialogIr(instance),
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
  if (root.kind !== "component" || root.role !== "dialog/variant/default")
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      "dialog@1 IR is one named default component — no invented Size/Placement set",
    ]);
  if (root.variantProperties?.Default !== "true")
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      "dialog/variant/default Default=true names the default cell; it is not a matrix axis",
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
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
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
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
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
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `binding ${field} must appear at most once`,
    ]);
  return found[0]?.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): DialogNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): DialogColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): DialogFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as DialogFontSpec;
};

export function validateDialogStructure(root: IRNode): void {
  const variant = defaultCell(root);
  if (variant.layout.mode !== "vertical")
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `${variant.role}: dialog paper is a vertical stack`,
    ]);
  if (variant.layout.width.mode !== "hug" || variant.layout.height.mode !== "hug")
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `${variant.role}: paper hugs title and body — no invented viewport`,
    ]);
  direct(variant, "dialog/title", "text");
  direct(variant, "dialog/body", "text");
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

export function collapseDialogRecipe(
  envelopeInput: unknown,
  selection: unknown,
): DialogRecipeInstance {
  requireExactRecipeSelection(selection, DIALOG_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== DIALOG_RECIPE_REF.id)
    throw new RecipeRefusal(DIALOG_RECIPE_REF, ["envelope recipe mismatch"]);
  validateDialogStructure(envelope.ir);
  const variant = defaultCell(envelope.ir);
  const title = direct(variant, "dialog/title", "text");
  const body = direct(variant, "dialog/body", "text");
  const instance = normalizeDialogRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: {
      root: "dialog",
      control: "dialog",
      title: "title",
      body: "body",
    },
    axes: {
      default: {
        name: "Default",
        values: [...DIALOG_DEFAULT],
        default: "true",
      },
    },
    content: {
      title: title.characters,
      body: body.characters,
    },
    tokens: {
      paper: {
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
        itemSpacing: numberFrom(
          variant,
          "layout.itemSpacing",
          variant.layout.itemSpacing,
        ),
        minWidth: {
          variable:
            optionalBinding(variant, "layout.minWidth") ??
            `${envelope.id}.paper-minWidth`,
          fallback: variant.layout.minWidth ?? 0,
        },
        fill: colorFrom(
          variant,
          "fills.0.color",
          solidColor(variant.fills[0], variant.role!),
        ),
      },
      titleFontSize: numberFrom(title, "type.fontSize", title.type.fontSize),
      titleLineHeight:
        title.type.lineHeight.unit === "px"
          ? numberFrom(
              title,
              "type.lineHeight.value",
              title.type.lineHeight.value,
            )
          : {
              variable: `${envelope.id}.titleLineHeight`,
              fallback: 0,
            },
      bodyFontSize: numberFrom(body, "type.fontSize", body.type.fontSize),
      bodyLineHeight:
        body.type.lineHeight.unit === "px"
          ? numberFrom(body, "type.lineHeight.value", body.type.lineHeight.value)
          : {
              variable: `${envelope.id}.bodyLineHeight`,
              fallback: 0,
            },
      lineHeightUnit: title.type.lineHeight.unit === "auto" ? "auto" : "px",
      title: colorFrom(
        title,
        "fills.0.color",
        solidColor(title.fills[0], title.role!),
      ),
      body: colorFrom(
        body,
        "fills.0.color",
        solidColor(body.fills[0], body.role!),
      ),
      typography: { title: fontFrom(title), body: fontFrom(body) },
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
  const recompiled = compileDialogRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(DIALOG_RECIPE_REF, [
      `unsupported structural edit at ${difference}; dialog@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const dialogRecipe: Recipe<DialogRecipeInstance> = {
  ref: DIALOG_RECIPE_REF,
  normalize: normalizeDialogRecipeInstance,
  compile: compileDialogRecipe,
  collapse: collapseDialogRecipe,
};
