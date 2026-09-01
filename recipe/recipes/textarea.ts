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
  type ComponentSetNode,
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

export const TEXTAREA_RECIPE_REF = {
  id: "textarea",
  version: 1,
} as const satisfies RecipeRef;

/**
 * All three Phase 1 libraries ship a multi-line text control.
 * Astryx TextArea. AntD Input.TextArea. MUI has no Textarea export —
 * compile TextField multiline / InputBase / TextareaAutosize.
 * Do not remint Input. Do not invent minRows or padding.
 *
 * Shared axes: Disabled × Content.
 * Content `empty` is rest (not focused, no value). Content `focus` is the
 * named focused-empty column from MUI InputLabel shrink =
 * filled || focused (InputLabel.js:197-199). Content `value` is filled.
 * rows / size / status / variant / allowClear / showCount are not axes.
 * Focus chrome (2px primary ring) is not a token on this recipe.
 */
export const TEXTAREA_DISABLED = ["false", "true"] as const;
export const TEXTAREA_CONTENT = ["empty", "focus", "value"] as const;

export type TextareaDisabled = (typeof TEXTAREA_DISABLED)[number];
export type TextareaContent = (typeof TEXTAREA_CONTENT)[number];

export interface TextareaNumberParameter {
  variable: string;
  fallback: number;
}
export interface TextareaColorParameter {
  variable: string;
  fallback: string;
}
export interface TextareaFontSpec {
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
  boxFill: TextareaColorParameter;
  boxBorder: TextareaColorParameter;
  boxOpacity: TextareaNumberParameter;
  label: TextareaColorParameter;
  value: TextareaColorParameter;
}

export interface TextareaRecipeInstance {
  identity: { id: string; name: string };
  semantic: {
    root: "textarea";
    control: "textarea";
    label: "label";
  };
  axes: {
    disabled: {
      name: "Disabled";
      values: TextareaDisabled[];
      default: TextareaDisabled;
    };
    content: {
      name: "Content";
      values: TextareaContent[];
      default: TextareaContent;
    };
  };
  content: {
    /** Astryx TextArea.tsx example label. */
    label: string;
    /** Shared fixture copy for the empty cell — not a library default string. */
    placeholder: string;
    /** Shared fixture copy for the filled cell. */
    value: string;
  };
  tokens: {
    box: {
      height: TextareaNumberParameter;
      paddingX: TextareaNumberParameter;
      paddingY: TextareaNumberParameter;
      radius: TextareaNumberParameter;
      borderWidth: TextareaNumberParameter;
      rows: TextareaNumberParameter;
      lineHeight: TextareaNumberParameter;
    };
    labelGap: TextareaNumberParameter;
    labelFontSize: TextareaNumberParameter;
    valueFontSize: TextareaNumberParameter;
    /**
     * Astryx/AntD Field label is stacked. Official MUI outlined
     * TextField uses InputLabel floating + NotchedOutline.
     */
    labelPlacement: "stacked" | "floating";
    outlineTreatment: "plain" | "notched";
    labelInsetX: TextareaNumberParameter;
    labelInactiveOffsetY: TextareaNumberParameter;
    labelFloatingOffsetY: TextareaNumberParameter;
    floatingLabelFontSize: TextareaNumberParameter;
    notchFill: TextareaColorParameter;
    /**
     * Astryx/AntD border-box → inside. MUI NotchedOutline is an overlay
     * on the padding box → outside so the 56-tall root keeps a 23px row.
     */
    strokeAlign: "inside" | "outside";
    boxClips: boolean;
    states: Record<
      TextareaContent,
      Record<"enabled" | "disabled", StateCell>
    >;
    typography: {
      label: TextareaFontSpec;
      value: TextareaFontSpec;
    };
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
  value: ColorParameterSchema,
});

export const TextareaRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({ id: z.string().min(1), name: z.string().min(1) }),
  semantic: z.strictObject({
    root: z.literal("textarea"),
    control: z.literal("textarea"),
    label: z.literal("label"),
  }),
  axes: z.strictObject({
    disabled: z.strictObject({
      name: z.literal("Disabled"),
      values: z.array(z.enum(TEXTAREA_DISABLED)).min(1),
      default: z.enum(TEXTAREA_DISABLED),
    }),
    content: z.strictObject({
      name: z.literal("Content"),
      values: z.array(z.enum(TEXTAREA_CONTENT)).min(1),
      default: z.enum(TEXTAREA_CONTENT),
    }),
  }),
  content: z.strictObject({
    label: z.string().min(1),
    placeholder: z.string().min(1),
    value: z.string().min(1),
  }),
  tokens: z.strictObject({
    box: z.strictObject({
      height: NumberParameterSchema,
      paddingX: NumberParameterSchema,
      paddingY: NumberParameterSchema,
      radius: NumberParameterSchema,
      borderWidth: NumberParameterSchema,
      rows: NumberParameterSchema,
      lineHeight: NumberParameterSchema,
    }),
    labelGap: NumberParameterSchema,
    labelFontSize: NumberParameterSchema,
    valueFontSize: NumberParameterSchema,
    labelPlacement: z.enum(["stacked", "floating"]),
    outlineTreatment: z.enum(["plain", "notched"]),
    labelInsetX: NumberParameterSchema,
    labelInactiveOffsetY: NumberParameterSchema,
    labelFloatingOffsetY: NumberParameterSchema,
    floatingLabelFontSize: NumberParameterSchema,
    notchFill: ColorParameterSchema,
    strokeAlign: z.enum(["inside", "outside"]),
    boxClips: z.boolean(),
    states: z.strictObject({
      empty: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
      value: z.strictObject({
        enabled: StateCellSchema,
        disabled: StateCellSchema,
      }),
    }),
    typography: z.strictObject({
      label: FontSpecSchema,
      value: FontSpecSchema,
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

export function normalizeTextareaRecipeInstance(
  input: unknown,
): TextareaRecipeInstance {
  requireExactRecipeSelection(
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined,
    TEXTAREA_RECIPE_REF,
  );
  const instance = TextareaRecipeInstanceSchema.parse(
    input,
  ) as TextareaRecipeInstance;
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
  parameter: TextareaNumberParameter | TextareaColorParameter,
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

const cellOf = (
  instance: TextareaRecipeInstance,
  content: TextareaContent,
  disabled: TextareaDisabled,
): StateCell =>
  instance.tokens.states[content === "value" ? "value" : "empty"][
    disabled === "true" ? "disabled" : "enabled"
  ];

const labelText = (
  instance: TextareaRecipeInstance,
  cell: StateCell,
  fontSize: TextareaNumberParameter,
): TextNode => ({
  kind: "text",
  role: "textarea/label",
  label: "textarea/label",
  characters: instance.content.label,
  type: {
    fontFamily: instance.tokens.typography.label.resolvedFamily,
    fontStyle: instance.tokens.typography.label.resolvedStyle,
    fontProvenance: instance.tokens.typography.label,
    fontSize: fontSize.fallback,
    lineHeight: { unit: "auto" },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(cell.label.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", fontSize),
    bind("fills.0.color", cell.label),
  ],
});

const valueText = (
  instance: TextareaRecipeInstance,
  content: TextareaContent,
  cell: StateCell,
  floating: boolean,
): TextNode => ({
  kind: "text",
  role: "textarea/value",
  label: "textarea/value",
  /**
   * InputBase.js:179-188 — when the label is unshrunk
   * (`label[data-shrink=false]`), placeholder opacity is 0 until :focus.
   * Stacked libraries keep the native placeholder visible on empty.
   */
  visible: !(floating && content === "empty"),
  characters:
    content === "value" ? instance.content.value : instance.content.placeholder,
  type: {
    fontFamily: instance.tokens.typography.value.resolvedFamily,
    fontStyle: instance.tokens.typography.value.resolvedStyle,
    fontProvenance: instance.tokens.typography.value,
    fontSize: instance.tokens.valueFontSize.fallback,
    lineHeight: {
      unit: "px",
      value: instance.tokens.box.lineHeight.fallback,
    },
  },
  align: "left",
  verticalAlign: "top",
  fills: [solid(cell.value.fallback)],
  width: hug,
  height: hug,
  bindings: [
    bind("type.fontSize", instance.tokens.valueFontSize),
    bind("type.lineHeight.value", instance.tokens.box.lineHeight),
    bind("fills.0.color", cell.value),
  ],
});

const boxNode = (
  instance: TextareaRecipeInstance,
  content: TextareaContent,
  cell: StateCell,
): FrameNode => ({
  kind: "frame",
  role: "textarea/box",
  label: "textarea/box",
  opacity: cell.boxOpacity.fallback,
  layout: {
    mode: "vertical",
    primaryAxisAlign: "min",
    counterAxisAlign: "min",
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
  clipsContent: instance.tokens.boxClips,
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
  children: [valueText(instance, content, cell, instance.tokens.labelPlacement === "floating")],
});

const variantComponent = (
  instance: TextareaRecipeInstance,
  disabled: TextareaDisabled,
  content: TextareaContent,
): ComponentNode => {
  const cell = cellOf(instance, content, disabled);
  const floating = instance.tokens.labelPlacement === "floating";
  const shrunk = floating && content !== "empty";
  const labelFont = shrunk
    ? instance.tokens.floatingLabelFontSize
    : instance.tokens.labelFontSize;
  const label = labelText(instance, cell, labelFont);
  const box = boxNode(instance, content, cell);
  const labelRow: FrameNode = {
    kind: "frame",
    role: "textarea/label-row",
    label: "textarea/label-row",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
      positioning: "absolute",
      offset: {
        x: instance.tokens.labelInsetX.fallback,
        y: shrunk
          ? instance.tokens.labelFloatingOffsetY.fallback
          : instance.tokens.labelInactiveOffsetY.fallback,
      },
      constraints: { horizontal: "left", vertical: "top" },
    },
    fills:
      shrunk && instance.tokens.outlineTreatment === "notched"
        ? [solid(instance.tokens.notchFill.fallback)]
        : [],
    bindings:
      shrunk && instance.tokens.outlineTreatment === "notched"
        ? [bind("fills.0.color", instance.tokens.notchFill)]
        : [],
    children: [label],
  };
  return {
    kind: "component",
    role: `textarea/variant/${disabled}/${content}`,
    label: `Disabled=${disabled}, Content=${content}`,
    variantProperties: {
      Disabled: disabled,
      Content: content,
    },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: instance.tokens.labelGap.fallback,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: hug,
      height: hug,
    },
    fills: [],
    ...(floating ? { clipsContent: false } : {}),
    bindings: [bind("layout.itemSpacing", instance.tokens.labelGap)],
    children: floating ? [box, labelRow] : [label, box],
  };
};

export function compileTextareaIr(
  instance: TextareaRecipeInstance,
): ComponentSetNode {
  const children = TEXTAREA_DISABLED.flatMap((disabled) =>
    TEXTAREA_CONTENT.map((content) =>
      variantComponent(instance, disabled, content),
    ),
  );
  return {
    kind: "component-set",
    role: "textarea/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Disabled", values: [...TEXTAREA_DISABLED] },
      { name: "Content", values: [...TEXTAREA_CONTENT] },
    ],
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 16,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      width: hug,
      height: hug,
    },
    fills: [],
    bindings: [],
    children,
  };
}

export function compileTextareaRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeTextareaRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, instance);
  if (!isTotal(totality))
    throw new RecipeRefusal(
      TEXTAREA_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "input / field",
    recipe: TEXTAREA_RECIPE_REF,
    ir: compileTextareaIr(instance),
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

const setByRole = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
    `missing required set ${role}`,
  ]);
};
const componentFor = (
  set: ComponentSetNode,
  properties: Record<string, string>,
): ComponentNode => {
  const found = set.children.filter(
    (child) =>
      child.kind === "component" &&
      Object.entries(properties).every(
        ([name, value]) => child.variantProperties?.[name] === value,
      ),
  );
  if (found.length !== 1)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      `${set.role}: expected exactly one component for ${JSON.stringify(properties)}`,
    ]);
  return found[0]!;
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
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
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
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      `${node.role ?? "node"}: required binding ${field} must appear exactly once`,
    ]);
  return found[0]!.variable;
};
const numberFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): TextareaNumberParameter => ({ variable: binding(node, field), fallback });
const colorFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): TextareaColorParameter => ({ variable: binding(node, field), fallback });
const solidColor = (paint: unknown, role: string): string => {
  const candidate = paint as { kind?: string; color?: string } | undefined;
  if (candidate?.kind !== "solid" || typeof candidate.color !== "string")
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      `${role}: expected a solid fill`,
    ]);
  return candidate.color;
};
const fontFrom = (node: TextNode): TextareaFontSpec => {
  const provenance = node.type.fontProvenance;
  if (!provenance)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      `${node.role ?? "text"}: font provenance is required`,
    ]);
  return provenance as TextareaFontSpec;
};

export function validateTextareaStructure(root: IRNode): void {
  const set = setByRole(root, "textarea/set");
  if (set.children.length !== TEXTAREA_DISABLED.length * TEXTAREA_CONTENT.length)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      "textarea/set must carry every Disabled × Content variant",
    ]);
  const aligns = new Set<string>();
  const clips = new Set<string>();
  for (const disabled of TEXTAREA_DISABLED) {
    for (const content of TEXTAREA_CONTENT) {
      const variant = componentFor(set, {
        Disabled: disabled,
        Content: content,
      });
      if (variant.layout.mode !== "vertical")
        throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
          `${variant.role}: textarea root is a vertical label + box stack`,
        ]);
      const box = direct(variant, "textarea/box", "frame");
      aligns.add(box.strokes?.[0]?.align ?? "");
      clips.add(String(box.clipsContent === true));
      if (box.layout.height.mode !== "fixed")
        throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
          `${variant.role}: the box must carry a named height`,
        ]);
      if (box.layout.width.mode !== "hug")
        throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
          `${variant.role}: box width hugs content — no invented default px width`,
        ]);
      const labelRow = (variant.children ?? []).find(
        (child) => child.role === "textarea/label-row",
      );
      if (labelRow) {
        if (labelRow.kind !== "frame")
          throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
            `${variant.role}: label-row must be a frame`,
          ]);
        if (labelRow.layout.positioning !== "absolute")
          throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
            `${variant.role}: floating label-row must be absolute`,
          ]);
        direct(labelRow, "textarea/label", "text");
      } else {
        direct(variant, "textarea/label", "text");
      }
      const value = direct(box, "textarea/value", "text");
      if (labelRow && content === "empty" && value.visible !== false)
        throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
          `${variant.role}: floating rest empty must hide the placeholder (InputBase.js:179-188)`,
        ]);
      if (labelRow && content !== "empty" && value.visible === false)
        throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
          `${variant.role}: floating shrink/focus must show the field text`,
        ]);
    }
  }
  if (aligns.size !== 1)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      "strokeAlign must be one value for the whole instance",
    ]);
  if (clips.size !== 1)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      "boxClips is instance geometry, not per-variant cosmetics",
    ]);
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

const labelFromVariant = (variant: ComponentNode): TextNode => {
  const labelRow = (variant.children ?? []).find(
    (child) => child.role === "textarea/label-row" && child.kind === "frame",
  );
  if (labelRow && labelRow.kind === "frame")
    return direct(labelRow, "textarea/label", "text");
  return direct(variant, "textarea/label", "text");
};

const cellFromVariant = (variant: ComponentNode): StateCell => {
  const label = labelFromVariant(variant);
  const box = direct(variant, "textarea/box", "frame");
  const value = direct(box, "textarea/value", "text");
  return {
    boxFill: colorFrom(
      box,
      "fills.0.color",
      solidColor(box.fills[0], box.role!),
    ),
    boxBorder: colorFrom(
      box,
      "strokes.0.paint.color",
      solidColor(box.strokes?.[0]?.paint, box.role!),
    ),
    boxOpacity: {
      variable: "textarea.boxOpacity",
      fallback: box.opacity ?? 1,
    },
    label: colorFrom(
      label,
      "fills.0.color",
      solidColor(label.fills[0], label.role!),
    ),
    value: colorFrom(
      value,
      "fills.0.color",
      solidColor(value.fills[0], value.role!),
    ),
  };
};

export function collapseTextareaRecipe(
  envelopeInput: unknown,
  selection: unknown,
): TextareaRecipeInstance {
  requireExactRecipeSelection(selection, TEXTAREA_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (envelope.recipe.id !== TEXTAREA_RECIPE_REF.id)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, ["envelope recipe mismatch"]);
  validateTextareaStructure(envelope.ir);
  const set = setByRole(envelope.ir, "textarea/set");
  const empty = componentFor(set, { Disabled: "false", Content: "empty" });
  const filled = componentFor(set, { Disabled: "false", Content: "value" });
  const box = direct(empty, "textarea/box", "frame");
  const label = labelFromVariant(empty);
  const filledLabel = labelFromVariant(filled);
  const emptyRow = (empty.children ?? []).find(
    (child) => child.role === "textarea/label-row" && child.kind === "frame",
  );
  const filledRow = (filled.children ?? []).find(
    (child) => child.role === "textarea/label-row" && child.kind === "frame",
  );
  const floating = Boolean(emptyRow && emptyRow.kind === "frame");
  const notched =
    Boolean(filledRow && filledRow.kind === "frame" && filledRow.fills[0]);
  const value = direct(box, "textarea/value", "text");
  const strokeAlign = box.strokes?.[0]?.align;
  if (strokeAlign !== "inside" && strokeAlign !== "outside")
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      "textarea/box stroke align must be inside or outside",
    ]);
  const height =
    box.layout.height.mode === "fixed" ? box.layout.height.value : 0;
  const paddingY = box.layout.padding.top;
  const borderWidth = box.strokes?.[0]?.weight ?? 0;
  const lineHeight =
    value.type.lineHeight.unit === "px" ? value.type.lineHeight.value : 0;
  const inset = strokeAlign === "inside" ? borderWidth * 2 : 0;
  const rows = lineHeight > 0 ? (height - paddingY * 2 - inset) / lineHeight : 0;
  const instance = normalizeTextareaRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: { root: "textarea", control: "textarea", label: "label" },
    axes: {
      disabled: {
        name: "Disabled",
        values: [...TEXTAREA_DISABLED],
        default: "false",
      },
      content: {
        name: "Content",
        values: [...TEXTAREA_CONTENT],
        default: "empty",
      },
    },
    content: {
      label: label.characters,
      placeholder: value.characters,
      value: direct(direct(filled, "textarea/box", "frame"), "textarea/value", "text")
        .characters,
    },
    tokens: {
      box: {
        height: numberFrom(box, "layout.height.value", height),
        paddingX: numberFrom(
          box,
          "layout.padding.left",
          box.layout.padding.left,
        ),
        paddingY: numberFrom(box, "layout.padding.top", paddingY),
        radius: numberFrom(
          box,
          "cornerRadius.topLeft",
          box.cornerRadius?.topLeft ?? 0,
        ),
        borderWidth: numberFrom(box, "strokes.0.weight", borderWidth),
        rows: {
          variable: `${envelope.id}.box-rows`,
          fallback: rows,
        },
        lineHeight: numberFrom(value, "type.lineHeight.value", lineHeight),
      },
      labelGap: numberFrom(
        empty,
        "layout.itemSpacing",
        empty.layout.itemSpacing,
      ),
      labelFontSize: numberFrom(label, "type.fontSize", label.type.fontSize),
      valueFontSize: numberFrom(value, "type.fontSize", value.type.fontSize),
      labelPlacement: floating ? "floating" : "stacked",
      outlineTreatment: notched ? "notched" : "plain",
      labelInsetX:
        emptyRow && emptyRow.kind === "frame" && emptyRow.layout.offset
          ? {
              variable: `${envelope.id}.labelInsetX`,
              fallback: emptyRow.layout.offset.x,
            }
          : {
              variable: `${envelope.id}.labelInsetX`,
              fallback: 0,
            },
      labelInactiveOffsetY:
        emptyRow && emptyRow.kind === "frame" && emptyRow.layout.offset
          ? {
              variable: `${envelope.id}.labelInactiveOffsetY`,
              fallback: emptyRow.layout.offset.y,
            }
          : {
              variable: `${envelope.id}.labelInactiveOffsetY`,
              fallback: 0,
            },
      labelFloatingOffsetY:
        filledRow && filledRow.kind === "frame" && filledRow.layout.offset
          ? {
              variable: `${envelope.id}.labelFloatingOffsetY`,
              fallback: filledRow.layout.offset.y,
            }
          : {
              variable: `${envelope.id}.labelFloatingOffsetY`,
              fallback: 0,
            },
      floatingLabelFontSize: numberFrom(
        filledLabel,
        "type.fontSize",
        filledLabel.type.fontSize,
      ),
      notchFill:
        filledRow && filledRow.kind === "frame" && filledRow.fills[0]
          ? colorFrom(
              filledRow,
              "fills.0.color",
              solidColor(filledRow.fills[0], filledRow.role!),
            )
          : {
              variable: `${envelope.id}.notchFill`,
              fallback: "#00000000",
            },
      strokeAlign,
      boxClips: box.clipsContent === true,
      states: {
        empty: {
          enabled: cellFromVariant(empty),
          disabled: cellFromVariant(
            componentFor(set, { Disabled: "true", Content: "empty" }),
          ),
        },
        value: {
          enabled: cellFromVariant(filled),
          disabled: cellFromVariant(
            componentFor(set, { Disabled: "true", Content: "value" }),
          ),
        },
      },
      typography: {
        label: fontFrom(label),
        value: fontFrom(value),
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
  for (const content of ["empty", "value"] as const) {
    for (const arm of ["enabled", "disabled"] as const)
      instance.tokens.states[content][arm].boxOpacity = {
        variable: `${instance.identity.id}.states-${content}-${arm}-boxOpacity`,
        fallback: instance.tokens.states[content][arm].boxOpacity.fallback,
      };
  }
  const recompiled = compileTextareaRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference)
    throw new RecipeRefusal(TEXTAREA_RECIPE_REF, [
      `unsupported structural edit at ${difference}; textarea@1 accepts only the declared designer edit surface`,
    ]);
  return instance;
}

export const textareaRecipe: Recipe<TextareaRecipeInstance> = {
  ref: TEXTAREA_RECIPE_REF,
  normalize: normalizeTextareaRecipeInstance,
  compile: compileTextareaRecipe,
  collapse: collapseTextareaRecipe,
};
