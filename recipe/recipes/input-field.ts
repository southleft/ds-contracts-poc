import * as z from "zod";

import {
  CodeOnlyExtensionSchema,
  ENVELOPE_VERSION,
  FactRefSchema,
  LossReceiptSchema,
  RecipeEnvelopeSchema,
  checkTotality,
  factId,
  isTotal,
  totalityLines,
  type FactRef,
  type RecipeEnvelope,
} from "../envelope.js";
import {
  ColorSchema,
  type ComponentNode,
  type ComponentSetNode,
  type Effect,
  type FrameNode,
  type IRNode,
  type TextNode,
  type VariableBinding,
} from "../figma-ir.js";
import { deriveRecipeIntegrity, hashRecipeEnvelope } from "../hash.js";
import { canonicalJson } from "../normalize.js";
import {
  RecipeRefusal,
  RecipeSelectionSchema,
  requireExactRecipeSelection,
  type Recipe,
  type RecipeRef,
} from "../recipe.js";

export const INPUT_FIELD_RECIPE_REF = {
  id: "input-field",
  version: 1,
} as const satisfies RecipeRef;

export const INPUT_FIELD_SIZES = ["small", "medium"] as const;
export const INPUT_FIELD_STATES = [
  "default",
  "focus-visible",
  "error",
  "disabled",
] as const;
export const INPUT_FIELD_CONTENT = ["placeholder", "value"] as const;
export const INPUT_FIELD_REQUIRED = ["false", "true"] as const;
export const INPUT_FIELD_ADORNMENTS = [
  "none",
  "leading",
  "trailing",
  "both",
] as const;

type InputFieldSize = (typeof INPUT_FIELD_SIZES)[number];
type InputFieldState = (typeof INPUT_FIELD_STATES)[number];
type InputFieldContent = (typeof INPUT_FIELD_CONTENT)[number];
type InputFieldRequired = (typeof INPUT_FIELD_REQUIRED)[number];
type InputFieldAdornments = (typeof INPUT_FIELD_ADORNMENTS)[number];

const NumberParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.number().finite().nonnegative(),
});
const SignedNumberParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: z.number().finite(),
});
const ColorParameterSchema = z.strictObject({
  variable: z.string().min(1),
  fallback: ColorSchema,
});
const ShadowSchema = z.strictObject({
  kind: z.enum(["drop-shadow", "inner-shadow"]),
  offsetX: z.number().finite(),
  offsetY: z.number().finite(),
  blur: z.number().finite().nonnegative(),
  spread: z.number().finite(),
  color: ColorParameterSchema,
});
const StateTokensSchema = z.strictObject({
  background: ColorParameterSchema,
  border: ColorParameterSchema,
  borderWidth: NumberParameterSchema,
  inputText: ColorParameterSchema,
  placeholderText: ColorParameterSchema,
  labelText: ColorParameterSchema,
  messageText: ColorParameterSchema,
  adornmentText: ColorParameterSchema,
  requiredIndicatorText: ColorParameterSchema,
  effects: z.array(ShadowSchema),
});
const FontSpecSchema = z
  .strictObject({
    requestedFamily: z.string().trim().min(1),
    requestedStyle: z.string().trim().min(1),
    requestSource: z.string().trim().min(1),
    fallbackChain: z
      .array(
        z.strictObject({
          family: z.string().trim().min(1),
          style: z.string().trim().min(1),
        }),
      )
      .min(1),
    resolvedFamily: z.string().trim().min(1),
    resolvedStyle: z.string().trim().min(1),
    resolution: z.enum(["requested", "fallback"]),
    degradation: z.string().trim().min(1).optional(),
  })
  .superRefine((font, context) => {
    if (
      font.resolution === "requested" &&
      (font.resolvedFamily !== font.requestedFamily ||
        font.resolvedStyle !== font.requestedStyle ||
        font.degradation !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "requested font must resolve exactly without a degradation receipt",
      });
    }
    if (font.resolution === "fallback" && font.degradation === undefined) {
      context.addIssue({
        code: "custom",
        message: "font fallback requires a named degradation receipt",
      });
    }
    if (
      !font.fallbackChain.some(
        (candidate) =>
          candidate.family === font.resolvedFamily &&
          candidate.style === font.resolvedStyle,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "resolved font is absent from the declared fallback chain",
      });
    }
  });
const AdornmentPayloadSchema = z.strictObject({
  content: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("text"), text: z.string().min(1) }),
    z.strictObject({
      kind: z.literal("glyph"),
      text: z.string().min(1),
      assetRef: z.string().min(1),
    }),
    z.strictObject({
      kind: z.literal("instance"),
      componentRef: z.string().min(1),
      properties: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()]),
      ),
    }),
  ]),
  font: FontSpecSchema.optional(),
  fontSize: z.number().finite().positive().optional(),
  lineHeight: z.number().finite().positive().optional(),
  fill: ColorParameterSchema,
  opacity: z.number().finite().min(0).max(1),
  intrinsicSize: z.strictObject({
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
  }),
  padding: z.strictObject({
    top: z.number().finite().nonnegative(),
    right: z.number().finite().nonnegative(),
    bottom: z.number().finite().nonnegative(),
    left: z.number().finite().nonnegative(),
  }),
  alignment: z.strictObject({
    horizontal: z.enum(["start", "center", "end"]),
    vertical: z.enum(["start", "center", "end"]),
  }),
  accessibility: z.strictObject({
    relation: z.enum(["none", "labelledby-control"]),
    decorative: z.boolean(),
    label: z.string().trim().min(1).optional(),
  }),
  source: z.string().trim().min(1),
});
const SizeTokensSchema = z.strictObject({
  width: NumberParameterSchema,
  minWidth: NumberParameterSchema,
  leadingAdornmentExtent: NumberParameterSchema,
  trailingAdornmentExtent: NumberParameterSchema,
  surfaceHeight: NumberParameterSchema,
  paddingX: NumberParameterSchema,
  surfaceGap: NumberParameterSchema,
  stackGap: NumberParameterSchema,
  labelGap: NumberParameterSchema,
  labelInsetX: NumberParameterSchema,
  labelInactiveOffsetY: SignedNumberParameterSchema,
  labelFloatingOffsetY: SignedNumberParameterSchema,
  helperInsetX: NumberParameterSchema,
  inputFontSize: NumberParameterSchema,
  inputLineHeight: NumberParameterSchema,
  inactiveLabelFontSize: NumberParameterSchema,
  inactiveLabelLineHeight: NumberParameterSchema,
  labelFontSize: NumberParameterSchema,
  labelLineHeight: NumberParameterSchema,
  messageFontSize: NumberParameterSchema,
  messageLineHeight: NumberParameterSchema,
  adornmentSize: NumberParameterSchema,
});

export const InputFieldRecipeInstanceSchema = z.strictObject({
  identity: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  semantic: z.strictObject({
    control: z.literal("input"),
    inputType: z.literal("text"),
    association: z.literal("explicit-id"),
    description: z.literal("aria-describedby"),
    invalid: z.literal("aria-invalid"),
    required: z.literal("native-required"),
    disabled: z.literal("native-disabled"),
  }),
  axes: z.strictObject({
    size: z.strictObject({
      name: z.literal("Size"),
      values: z.tuple([z.literal("small"), z.literal("medium")]),
      default: z.enum(INPUT_FIELD_SIZES),
      exposure: z.literal("public"),
    }),
    state: z.strictObject({
      name: z.literal("State"),
      values: z.tuple([
        z.literal("default"),
        z.literal("focus-visible"),
        z.literal("error"),
        z.literal("disabled"),
      ]),
      default: z.literal("default"),
      exposure: z.literal("design-state"),
    }),
    content: z.strictObject({
      name: z.literal("Content"),
      values: z.tuple([z.literal("placeholder"), z.literal("value")]),
      default: z.enum(INPUT_FIELD_CONTENT),
      exposure: z.literal("public"),
    }),
    required: z.strictObject({
      name: z.literal("Required"),
      values: z.tuple([z.literal("false"), z.literal("true")]),
      default: z.enum(INPUT_FIELD_REQUIRED),
      exposure: z.literal("public"),
    }),
    adornments: z.strictObject({
      name: z.literal("Adornments"),
      values: z.tuple([
        z.literal("none"),
        z.literal("leading"),
        z.literal("trailing"),
        z.literal("both"),
      ]),
      default: z.literal("none"),
      exposure: z.literal("presence"),
    }),
  }),
  content: z.strictObject({
    label: z.strictObject({
      property: z.literal("Label"),
      default: z.string().trim().min(1),
    }),
    placeholder: z.strictObject({
      property: z.literal("Placeholder"),
      default: z.string().trim().min(1),
    }),
    value: z.strictObject({
      property: z.literal("Value"),
      default: z.string().trim().min(1),
    }),
    helper: z.strictObject({
      property: z.literal("Helper text"),
      default: z.string().trim().min(1),
    }),
    error: z.strictObject({
      property: z.literal("Error text"),
      default: z.string().trim().min(1),
    }),
    visiblePolicy: z.literal("value-else-placeholder"),
  }),
  slots: z.strictObject({
    leading: z.strictObject({
      property: z.literal("Leading adornment"),
      optional: z.literal(true),
      accepts: z.literal("instance"),
      componentRef: z.string().min(1),
      payload: AdornmentPayloadSchema,
    }),
    trailing: z.strictObject({
      property: z.literal("Trailing adornment"),
      optional: z.literal(true),
      accepts: z.literal("instance"),
      componentRef: z.string().min(1),
      payload: AdornmentPayloadSchema,
    }),
  }),
  structure: z.strictObject({
    labelPlacement: z.enum(["stacked", "floating"]),
    floatingActivation: z.enum(["never", "focus-value-or-leading-adornment"]),
    outlineTreatment: z.enum(["plain", "notched"]),
    helperPlacement: z.enum(["field-edge", "content-inset"]),
    sizingPolicy: z.enum(["fixed", "adornment-additive"]),
    adornmentSizing: z.enum(["fixed", "intrinsic-extent"]),
    contentAlignment: z.enum(["start", "center"]),
  }),
  designerEditSurface: z.strictObject({
    textProperties: z.tuple([
      z.literal("Label"),
      z.literal("Placeholder"),
      z.literal("Value"),
      z.literal("Helper text"),
      z.literal("Error text"),
    ]),
    variantProperties: z.tuple([
      z.literal("Size"),
      z.literal("State"),
      z.literal("Content"),
      z.literal("Required"),
      z.literal("Adornments"),
    ]),
    instanceSwapProperties: z.tuple([
      z.literal("Leading adornment"),
      z.literal("Trailing adornment"),
    ]),
    resize: z.strictObject({
      root: z.literal("fixed-width"),
      descendants: z.literal("fill-container"),
      vertical: z.literal("hug-contents"),
    }),
  }),
  tokens: z.strictObject({
    states: z.strictObject({
      default: StateTokensSchema,
      focusVisible: StateTokensSchema,
      error: StateTokensSchema,
      disabled: StateTokensSchema,
    }),
    sizes: z.strictObject({
      small: SizeTokensSchema,
      medium: SizeTokensSchema,
    }),
    radius: NumberParameterSchema,
    typography: z.strictObject({
      input: FontSpecSchema,
      label: FontSpecSchema,
      message: FontSpecSchema,
    }),
  }),
  inputFacts: z.array(FactRefSchema),
  accounting: z.strictObject({ carried: z.array(FactRefSchema) }),
  extensions: z.array(CodeOnlyExtensionSchema),
  receipts: z.array(LossReceiptSchema),
  provenance: z.strictObject({
    source: z.string().min(1),
    tool: z.literal("input-field@1"),
    generatedAt: z.string().min(1),
    selection: RecipeSelectionSchema,
  }),
});

export type InputFieldRecipeInstance = z.infer<
  typeof InputFieldRecipeInstanceSchema
>;
export type InputFieldNumberParameter = z.infer<typeof NumberParameterSchema>;
export type InputFieldColorParameter = z.infer<typeof ColorParameterSchema>;
export type InputFieldFontSpec = z.infer<typeof FontSpecSchema>;
export type InputFieldAdornmentPayload = z.infer<typeof AdornmentPayloadSchema>;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const sortFacts = (facts: readonly FactRef[]): FactRef[] =>
  [...facts].sort((left, right) => compareText(factId(left), factId(right)));

const validateStructurePolicy = (
  structure: InputFieldRecipeInstance["structure"],
): void => {
  if (
    structure.labelPlacement === "floating" &&
    (structure.outlineTreatment !== "notched" ||
      structure.floatingActivation === "never")
  ) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      "inconsistent generic field structure: floating label requires named notched outline treatment and floating activation support",
    ]);
  }
  if (
    structure.labelPlacement === "stacked" &&
    (structure.outlineTreatment !== "plain" ||
      structure.floatingActivation !== "never")
  ) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      "inconsistent generic field structure: stacked label requires plain outline treatment and floatingActivation=never",
    ]);
  }
};

export function normalizeInputFieldRecipeInstance(
  input: unknown,
): InputFieldRecipeInstance {
  const selection =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as { provenance?: { selection?: unknown } }).provenance
          ?.selection
      : undefined;
  requireExactRecipeSelection(selection, INPUT_FIELD_RECIPE_REF);
  const parsed = InputFieldRecipeInstanceSchema.parse(input);
  validateStructurePolicy(parsed.structure);
  return {
    ...parsed,
    inputFacts: sortFacts(parsed.inputFacts),
    accounting: { carried: sortFacts(parsed.accounting.carried) },
    extensions: [...parsed.extensions]
      .map((extension) => ({
        ...extension,
        absorbs: sortFacts(extension.absorbs),
      }))
      .sort((left, right) => compareText(left.id, right.id)),
    receipts: [...parsed.receipts].sort((left, right) =>
      compareText(factId(left.fact), factId(right.fact)),
    ),
  };
}

const hug = { mode: "hug" } as const;
const fill = { mode: "fill" } as const;
const fixed = (value: number) => ({ mode: "fixed", value }) as const;
const solid = (color: string) => ({ kind: "solid", color }) as const;
const bind = (field: string, variable: string): VariableBinding => ({
  field,
  type: field.endsWith(".color") ? "COLOR" : "FLOAT",
  variable,
});
const valueOf = (
  parameter: InputFieldNumberParameter | InputFieldColorParameter,
): number | string => parameter.fallback;
const numberOf = (parameter: InputFieldNumberParameter): number =>
  valueOf(parameter) as number;
const colorOf = (parameter: InputFieldColorParameter): string =>
  valueOf(parameter) as string;

const stateTokens = (
  instance: InputFieldRecipeInstance,
  state: InputFieldState,
) => {
  if (state === "focus-visible") return instance.tokens.states.focusVisible;
  return instance.tokens.states[state];
};

const axisOrder = <Value extends string>(
  values: readonly Value[],
  defaultValue: Value,
): Value[] => [
  defaultValue,
  ...values.filter((value) => value !== defaultValue),
];

const roleForVariant = (
  size: InputFieldSize,
  state: InputFieldState,
  content: InputFieldContent,
  required: InputFieldRequired,
  adornments: InputFieldAdornments,
): string =>
  `input-field/variant/${size}/${state}/${content}/${required}/${adornments}`;

const textNode = (
  role: string,
  characters: string,
  font: InputFieldFontSpec,
  fontSize: InputFieldNumberParameter,
  lineHeight: InputFieldNumberParameter,
  color: InputFieldColorParameter,
  width: typeof hug | typeof fill = hug,
  visible = true,
): TextNode => ({
  kind: "text",
  role,
  label: role,
  characters,
  type: {
    fontFamily: font.resolvedFamily,
    fontStyle: font.resolvedStyle,
    fontProvenance: font,
    fontSize: numberOf(fontSize),
    lineHeight: { unit: "px", value: numberOf(lineHeight) },
  },
  align: "left",
  verticalAlign: "center",
  fills: [solid(colorOf(color))],
  width,
  height: hug,
  ...(visible ? {} : { visible: false }),
  bindings: [
    bind("type.fontSize", fontSize.variable),
    bind("type.lineHeight.value", lineHeight.variable),
    bind("fills.0.color", color.variable),
  ],
});

const slotNode = (
  role: "input-field/slot/leading" | "input-field/slot/trailing",
  componentRef: string,
  payload: InputFieldAdornmentPayload,
  width: InputFieldNumberParameter,
  height: InputFieldNumberParameter,
  color: InputFieldColorParameter,
): IRNode => ({
  kind: "instance",
  role,
  label: role,
  componentRef,
  properties: {},
  payload: {
    content: payload.content,
    ...(payload.font === undefined ||
    payload.fontSize === undefined ||
    payload.lineHeight === undefined
      ? {}
      : {
          typography: {
            fontFamily: payload.font.resolvedFamily,
            fontStyle: payload.font.resolvedStyle,
            fontProvenance: payload.font,
            fontSize: payload.fontSize,
            lineHeight: { unit: "px" as const, value: payload.lineHeight },
          },
        }),
    fills: [solid(colorOf(color))],
    opacity: payload.opacity,
    intrinsicSize: payload.intrinsicSize,
    padding: payload.padding,
    alignment: payload.alignment,
    accessibility: payload.accessibility,
    source: payload.source,
  },
  fills: [solid(colorOf(color))],
  width: fixed(numberOf(width)),
  height: fixed(numberOf(height)),
  bindings: [
    bind("fills.0.color", color.variable),
    bind("width.value", width.variable),
    bind("height.value", height.variable),
  ],
});

const variantComponent = (
  instance: InputFieldRecipeInstance,
  sizeName: InputFieldSize,
  state: InputFieldState,
  content: InputFieldContent,
  required: InputFieldRequired,
  adornments: InputFieldAdornments,
): ComponentNode => {
  const size = instance.tokens.sizes[sizeName];
  const appearance = stateTokens(instance, state);
  const floating =
    instance.structure.labelPlacement === "floating" &&
    (state === "focus-visible" ||
      content === "value" ||
      adornments === "leading" ||
      adornments === "both");
  const labelFontSize = floating
    ? size.labelFontSize
    : size.inactiveLabelFontSize;
  const labelLineHeight = floating
    ? size.labelLineHeight
    : size.inactiveLabelLineHeight;
  const labelChildren: IRNode[] = [
    textNode(
      "input-field/label",
      instance.content.label.default,
      instance.tokens.typography.label,
      labelFontSize,
      labelLineHeight,
      appearance.labelText,
    ),
  ];
  if (required === "true") {
    labelChildren.push(
      textNode(
        "input-field/required-indicator",
        "*",
        instance.tokens.typography.label,
        labelFontSize,
        labelLineHeight,
        appearance.requiredIndicatorText,
      ),
    );
  }
  const labelRow: FrameNode = {
    kind: "frame",
    role: "input-field/label-row",
    label: "Label",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "baseline",
      itemSpacing: numberOf(size.labelGap),
      padding: {
        top:
          instance.structure.labelPlacement === "stacked"
            ? numberOf(size.labelFloatingOffsetY)
            : 0,
        right: 0,
        bottom: 0,
        left:
          instance.structure.labelPlacement === "stacked"
            ? numberOf(size.labelInsetX)
            : 0,
      },
      width: instance.structure.labelPlacement === "stacked" ? fill : hug,
      height: hug,
      ...(instance.structure.labelPlacement === "floating"
        ? {
            positioning: "absolute" as const,
            offset: {
              x: numberOf(size.labelInsetX),
              y: numberOf(
                floating
                  ? size.labelFloatingOffsetY
                  : size.labelInactiveOffsetY,
              ),
            },
            constraints: {
              horizontal: "left" as const,
              vertical: "top" as const,
            },
          }
        : {}),
    },
    fills:
      floating && instance.structure.outlineTreatment === "notched"
        ? [solid(colorOf(appearance.background))]
        : [],
    bindings: [
      bind("layout.itemSpacing", size.labelGap.variable),
      ...(instance.structure.labelPlacement === "floating"
        ? []
        : [
            bind("layout.padding.top", size.labelFloatingOffsetY.variable),
            bind("layout.padding.left", size.labelInsetX.variable),
          ]),
    ],
    children: labelChildren,
  };

  const surfaceChildren: IRNode[] = [];
  const hasLeading = adornments === "leading" || adornments === "both";
  const hasTrailing = adornments === "trailing" || adornments === "both";
  if (hasLeading) {
    surfaceChildren.push(
      slotNode(
        "input-field/slot/leading",
        instance.slots.leading.componentRef,
        instance.slots.leading.payload,
        size.leadingAdornmentExtent,
        size.adornmentSize,
        appearance.adornmentText,
      ),
    );
  }
  surfaceChildren.push(
    textNode(
      content === "placeholder"
        ? "input-field/content/placeholder"
        : "input-field/content/value",
      content === "placeholder"
        ? instance.content.placeholder.default
        : instance.content.value.default,
      instance.tokens.typography.input,
      size.inputFontSize,
      size.inputLineHeight,
      content === "placeholder"
        ? appearance.placeholderText
        : appearance.inputText,
      fill,
    ),
  );
  if (hasTrailing) {
    surfaceChildren.push(
      slotNode(
        "input-field/slot/trailing",
        instance.slots.trailing.componentRef,
        instance.slots.trailing.payload,
        size.trailingAdornmentExtent,
        size.adornmentSize,
        appearance.adornmentText,
      ),
    );
  }
  const contentRow: FrameNode = {
    kind: "frame",
    role: "input-field/content-row",
    label: "Input content",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign:
        instance.structure.contentAlignment === "center" ? "center" : "min",
      itemSpacing: numberOf(size.surfaceGap),
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fill,
      height: fill,
    },
    fills: [],
    bindings: [bind("layout.itemSpacing", size.surfaceGap.variable)],
    children: surfaceChildren,
  };
  const surface: FrameNode = {
    kind: "frame",
    role: "input-field/surface",
    label: "Input surface",
    layout: {
      mode: "horizontal",
      primaryAxisAlign:
        instance.structure.contentAlignment === "center" ? "center" : "min",
      counterAxisAlign:
        instance.structure.contentAlignment === "center" ? "center" : "min",
      itemSpacing:
        instance.structure.labelPlacement === "floating"
          ? 0
          : numberOf(size.surfaceGap),
      padding: {
        top: 0,
        right: numberOf(size.paddingX),
        bottom: 0,
        left: numberOf(size.paddingX),
      },
      width: fill,
      height: fixed(numberOf(size.surfaceHeight)),
      minWidth: numberOf(size.minWidth),
      minHeight: numberOf(size.surfaceHeight),
    },
    fills: [solid(colorOf(appearance.background))],
    strokes: [
      {
        weight: numberOf(appearance.borderWidth),
        align: "inside",
        paint: solid(colorOf(appearance.border)),
      },
    ],
    effects: appearance.effects.map((effect): Effect => ({
      kind: effect.kind,
      offsetX: effect.offsetX,
      offsetY: effect.offsetY,
      blur: effect.blur,
      spread: effect.spread,
      color: colorOf(effect.color),
    })),
    cornerRadius: {
      topLeft: numberOf(instance.tokens.radius),
      topRight: numberOf(instance.tokens.radius),
      bottomRight: numberOf(instance.tokens.radius),
      bottomLeft: numberOf(instance.tokens.radius),
    },
    clipsContent: false,
    bindings: [
      ...(instance.structure.labelPlacement === "stacked"
        ? [bind("layout.itemSpacing", size.surfaceGap.variable)]
        : []),
      bind("layout.padding.right", size.paddingX.variable),
      bind("layout.padding.left", size.paddingX.variable),
      bind("layout.height.value", size.surfaceHeight.variable),
      bind("layout.minWidth", size.minWidth.variable),
      bind("layout.minHeight", size.surfaceHeight.variable),
      bind("fills.0.color", appearance.background.variable),
      bind("strokes.0.weight", appearance.borderWidth.variable),
      bind("strokes.0.paint.color", appearance.border.variable),
      bind("cornerRadius.topLeft", instance.tokens.radius.variable),
      bind("cornerRadius.topRight", instance.tokens.radius.variable),
      bind("cornerRadius.bottomRight", instance.tokens.radius.variable),
      bind("cornerRadius.bottomLeft", instance.tokens.radius.variable),
      ...appearance.effects.map((effect, index) =>
        bind(`effects.${index}.color`, effect.color.variable),
      ),
    ],
    children:
      instance.structure.labelPlacement === "floating"
        ? [contentRow, labelRow]
        : surfaceChildren,
  };
  const message = textNode(
    state === "error"
      ? "input-field/message/error"
      : "input-field/message/helper",
    state === "error"
      ? instance.content.error.default
      : instance.content.helper.default,
    instance.tokens.typography.message,
    size.messageFontSize,
    size.messageLineHeight,
    appearance.messageText,
    fill,
  );
  const messageContainer: FrameNode = {
    kind: "frame",
    role: "input-field/message-container",
    label: "Message",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 0,
      padding: {
        top: 0,
        right: numberOf(size.helperInsetX),
        bottom: 0,
        left: numberOf(size.helperInsetX),
      },
      width: fill,
      height: hug,
    },
    fills: [],
    bindings: [
      bind("layout.padding.left", size.helperInsetX.variable),
      bind("layout.padding.right", size.helperInsetX.variable),
    ],
    children: [message],
  };
  const componentWidth =
    numberOf(size.width) +
    (instance.structure.sizingPolicy === "adornment-additive" && hasLeading
      ? numberOf(size.leadingAdornmentExtent)
      : 0) +
    (instance.structure.sizingPolicy === "adornment-additive" && hasTrailing
      ? numberOf(size.trailingAdornmentExtent)
      : 0);

  return {
    kind: "component",
    role: roleForVariant(sizeName, state, content, required, adornments),
    label: [
      `Size=${sizeName}`,
      `State=${state}`,
      `Content=${content}`,
      `Required=${required}`,
      `Adornments=${adornments}`,
    ].join(", "),
    variantProperties: {
      Size: sizeName,
      State: state,
      Content: content,
      Required: required,
      Adornments: adornments,
    },
    layout: {
      mode: "vertical",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: numberOf(size.stackGap),
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: fixed(componentWidth),
      height: hug,
      minWidth: numberOf(size.minWidth),
    },
    fills: [],
    clipsContent: false,
    bindings: [
      bind("layout.itemSpacing", size.stackGap.variable),
      ...(adornments === "none" || instance.structure.sizingPolicy === "fixed"
        ? [bind("layout.width.value", size.width.variable)]
        : []),
      bind("layout.minWidth", size.minWidth.variable),
    ],
    children:
      instance.structure.labelPlacement === "floating"
        ? [surface, messageContainer]
        : [labelRow, surface, messageContainer],
  };
};

function compileInputFieldIr(
  instance: InputFieldRecipeInstance,
): ComponentSetNode {
  const components = axisOrder(
    INPUT_FIELD_SIZES,
    instance.axes.size.default,
  ).flatMap((size) =>
    INPUT_FIELD_STATES.flatMap((state) =>
      axisOrder(INPUT_FIELD_CONTENT, instance.axes.content.default).flatMap(
        (content) =>
          axisOrder(
            INPUT_FIELD_REQUIRED,
            instance.axes.required.default,
          ).flatMap((required) =>
            INPUT_FIELD_ADORNMENTS.map((adornments) =>
              variantComponent(
                instance,
                size,
                state,
                content,
                required,
                adornments,
              ),
            ),
          ),
      ),
    ),
  );
  return {
    kind: "component-set",
    role: "input-field/set",
    label: instance.identity.name,
    variantAxes: [
      { name: "Size", values: [...INPUT_FIELD_SIZES] },
      { name: "State", values: [...INPUT_FIELD_STATES] },
      { name: "Content", values: [...INPUT_FIELD_CONTENT] },
      { name: "Required", values: [...INPUT_FIELD_REQUIRED] },
      { name: "Adornments", values: [...INPUT_FIELD_ADORNMENTS] },
    ],
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "min",
      itemSpacing: 24,
      padding: { top: 32, right: 32, bottom: 32, left: 32 },
      width: hug,
      height: hug,
    },
    fills: [],
    clipsContent: false,
    children: components,
  };
}

export function compileInputFieldRecipe(input: unknown): RecipeEnvelope {
  const instance = normalizeInputFieldRecipeInstance(input);
  const totality = checkTotality(instance.inputFacts, {
    accounting: instance.accounting,
    extensions: instance.extensions,
    receipts: instance.receipts,
  });
  if (!isTotal(totality)) {
    throw new RecipeRefusal(
      INPUT_FIELD_RECIPE_REF,
      totalityLines(instance.identity.id, totality),
    );
  }
  const unsigned = {
    envelope: ENVELOPE_VERSION,
    id: instance.identity.id,
    name: instance.identity.name,
    archetype: "input / field",
    recipe: INPUT_FIELD_RECIPE_REF,
    ir: compileInputFieldIr(instance),
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

const expectedAxes = [
  ["Size", INPUT_FIELD_SIZES],
  ["State", INPUT_FIELD_STATES],
  ["Content", INPUT_FIELD_CONTENT],
  ["Required", INPUT_FIELD_REQUIRED],
  ["Adornments", INPUT_FIELD_ADORNMENTS],
] as const;

const bindingFor = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
): string => {
  const matches = (node.bindings ?? []).filter(
    (binding) => binding.field === field,
  );
  if (matches.length !== 1) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${node.role ?? "(unroled node)"}: required token binding ${field} must appear exactly once`,
    ]);
  }
  return matches[0]!.variable;
};
const numberParameterFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: number,
): InputFieldNumberParameter => ({
  variable: bindingFor(node, field),
  fallback,
});
const codeOnlyPositionParameterFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  suffix: string,
  fallback: number,
): InputFieldNumberParameter => {
  const anchor = bindingFor(node, "layout.itemSpacing");
  const separator = anchor.lastIndexOf(".");
  if (separator < 0) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${node.role ?? "(unroled node)"}: cannot recover code-only position variable namespace from ${anchor}`,
    ]);
  }
  return { variable: `${anchor.slice(0, separator)}.${suffix}`, fallback };
};
const colorParameterFrom = (
  node: { role?: string; bindings?: VariableBinding[] },
  field: string,
  fallback: string,
): InputFieldColorParameter => ({
  variable: bindingFor(node, field),
  fallback,
});

const childByRole = <Kind extends IRNode["kind"]>(
  parent: { role?: string; children: IRNode[] },
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const matches = parent.children.filter((child) => child.role === role);
  if (matches.length !== 1 || matches[0]!.kind !== kind) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${parent.role ?? "(unroled parent)"}: required role ${role} must appear exactly once as ${kind}`,
    ]);
  }
  return matches[0] as Extract<IRNode, { kind: Kind }>;
};

const descendantByRole = <Kind extends IRNode["kind"]>(
  parent: IRNode,
  role: string,
  kind: Kind,
): Extract<IRNode, { kind: Kind }> => {
  const matches: IRNode[] = [];
  walk(parent, (candidate) => {
    if (candidate !== parent && candidate.role === role)
      matches.push(candidate);
  });
  if (matches.length !== 1 || matches[0]!.kind !== kind) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${parent.role ?? "(unroled parent)"}: required descendant role ${role} must appear exactly once as ${kind}`,
    ]);
  }
  return matches[0] as Extract<IRNode, { kind: Kind }>;
};

const componentFor = (
  root: ComponentSetNode,
  size: InputFieldSize,
  state: InputFieldState,
  content: InputFieldContent,
  required: InputFieldRequired,
  adornments: InputFieldAdornments,
): ComponentNode => {
  const role = roleForVariant(size, state, content, required, adornments);
  const matches = root.children.filter((component) => component.role === role);
  if (matches.length !== 1) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `required role ${role} must appear exactly once`,
    ]);
  }
  return matches[0]!;
};

const asFixed = (
  sizing: { mode: string; value?: number },
  role: string,
  field: string,
): number => {
  if (sizing.mode !== "fixed" || sizing.value === undefined) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${role}: ${field} must use fixed Figma sizing`,
    ]);
  }
  return sizing.value;
};
const fontSpecFrom = (node: TextNode): InputFieldFontSpec => {
  const provenance = node.type.fontProvenance;
  if (provenance === undefined) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${node.role ?? "text"}: explicit font provenance is required`,
    ]);
  }
  return provenance;
};
const solidColor = (
  paint: { kind: string; color?: string } | undefined,
  role: string,
  field: string,
): string => {
  if (paint?.kind !== "solid" || paint.color === undefined) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `${role}: ${field} must be a solid paint`,
    ]);
  }
  return paint.color;
};

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walk(child, visit);
  }
};

const renderFingerprint = (component: ComponentNode): string => {
  const clone = structuredClone(component) as unknown as Record<
    string,
    unknown
  >;
  delete clone.role;
  delete clone.label;
  delete clone.variantProperties;
  const stripLabels = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) stripLabels(child);
      return;
    }
    const record = value as Record<string, unknown>;
    delete record.label;
    delete record.role;
    for (const child of Object.values(record)) stripLabels(child);
  };
  stripLabels(clone);
  return canonicalJson(clone);
};

const requireSemanticExtensions = (envelope: RecipeEnvelope): void => {
  const expected = new Map([
    ["input-field/label-input-association", "label-input-association"],
    ["input-field/aria-describedby", "aria-describedby"],
    ["input-field/aria-invalid", "aria-invalid"],
    ["input-field/native-required-disabled", "native-required-disabled"],
    ["input-field/events", "input-events"],
    ["input-field/recipe-selection", "recipe-selection"],
  ]);
  for (const [id, channel] of expected) {
    const matches = envelope.extensions.filter(
      (extension) => extension.id === id,
    );
    if (
      matches.length !== 1 ||
      matches[0]!.absorbs.length !== 1 ||
      matches[0]!.absorbs[0]!.path !== "root" ||
      matches[0]!.absorbs[0]!.channel !== channel
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `broken label/input association or code contract: extension ${id} must appear exactly once and absorb root#${channel}`,
      ]);
    }
  }
};

function validateInputFieldStructure(root: ComponentSetNode): void {
  if (root.role !== "input-field/set") {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `missing required role input-field/set; found ${root.role ?? "(none)"}`,
    ]);
  }
  const axes = new Map(
    root.variantAxes.map((axis) => [axis.name, axis.values]),
  );
  for (const [name, values] of expectedAxes) {
    const actual = axes.get(name);
    if (!actual) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `missing required axis ${name}`,
      ]);
    }
    const sameMembers =
      actual.length === values.length &&
      values.every((value) => actual.includes(value)) &&
      actual.every((value) => (values as readonly string[]).includes(value));
    if (!sameMembers) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `axis ${name} has unsupported values; expected ${values.join(", ")}`,
      ]);
    }
    const dead = actual.filter((value) =>
      root.children.every(
        (component) => component.variantProperties[name] !== value,
      ),
    );
    if (dead.length > 0) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `dead axis ${name}: ${dead.join(", ")} has no component`,
      ]);
    }
  }
  for (const name of axes.keys()) {
    if (!expectedAxes.some(([expected]) => expected === name)) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `unexpected axis ${name}; input-field@1 never infers an edit surface`,
      ]);
    }
  }

  const combinations = new Set<string>();
  for (const component of root.children) {
    const properties = component.variantProperties;
    for (const [name, values] of expectedAxes) {
      if (
        !(name in properties) ||
        !(values as readonly string[]).includes(properties[name]!)
      ) {
        throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
          `${component.role ?? "(unroled component)"}: missing or unsupported axis property ${name}`,
        ]);
      }
    }
    for (const name of Object.keys(properties)) {
      if (!axes.has(name)) {
        throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
          `${component.role ?? "(unroled component)"}: unexpected axis property ${name}`,
        ]);
      }
    }
    const key = expectedAxes
      .map(([name]) => `${name}=${properties[name]}`)
      .join("\0");
    if (combinations.has(key)) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `duplicate variant combination ${key.replaceAll("\0", ", ")}`,
      ]);
    }
    combinations.add(key);

    const size = properties.Size as InputFieldSize;
    const state = properties.State as InputFieldState;
    const content = properties.Content as InputFieldContent;
    const required = properties.Required as InputFieldRequired;
    const adornments = properties.Adornments as InputFieldAdornments;
    const expectedRole = roleForVariant(
      size,
      state,
      content,
      required,
      adornments,
    );
    if (component.role !== expectedRole) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `missing required role ${expectedRole}; found ${component.role ?? "(none)"}`,
      ]);
    }
    if (
      component.layout.mode !== "vertical" ||
      component.layout.width.mode !== "fixed" ||
      component.layout.height.mode !== "hug"
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: field root must use vertical auto-layout, fixed width, and hug height`,
      ]);
    }
    const directRoles = component.children.map((child) => child.role);
    const stacked =
      directRoles[0] === "input-field/label-row" &&
      directRoles[1] === "input-field/surface";
    const floating =
      directRoles[0] === "input-field/surface" &&
      directRoles[1] === "input-field/message-container";
    if (
      (!stacked && !floating) ||
      directRoles.at(-1) !== "input-field/message-container"
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: unsupported field composition or broken label/input association`,
      ]);
    }
    const surface = childByRole(component, "input-field/surface", "frame");
    const labelRow = stacked
      ? childByRole(component, "input-field/label-row", "frame")
      : childByRole(surface, "input-field/label-row", "frame");
    const messageContainer = childByRole(
      component,
      "input-field/message-container",
      "frame",
    );
    childByRole(
      messageContainer,
      state === "error"
        ? "input-field/message/error"
        : "input-field/message/helper",
      "text",
    );
    childByRole(labelRow, "input-field/label", "text");
    if (
      labelRow.layout.mode !== "horizontal" ||
      (stacked
        ? labelRow.layout.width.mode !== "fill"
        : labelRow.layout.width.mode !== "hug") ||
      surface.layout.mode !== "horizontal" ||
      surface.layout.width.mode !== "fill" ||
      surface.layout.height.mode !== "fixed"
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: fake layout is unsupported; label and input surface must remain in-flow auto-layout and fill the field`,
      ]);
    }
    const requiredCount = labelRow.children.filter(
      (child) => child.role === "input-field/required-indicator",
    ).length;
    if (requiredCount !== (required === "true" ? 1 : 0)) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: Required axis disagrees with input-field/required-indicator`,
      ]);
    }
    const contentParent = floating
      ? childByRole(surface, "input-field/content-row", "frame")
      : surface;
    const placeholderCount = contentParent.children.filter(
      (child) => child.role === "input-field/content/placeholder",
    ).length;
    const valueCount = contentParent.children.filter(
      (child) => child.role === "input-field/content/value",
    ).length;
    if (
      placeholderCount + valueCount !== 1 ||
      placeholderCount !== (content === "placeholder" ? 1 : 0) ||
      valueCount !== (content === "value" ? 1 : 0)
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: unexpected role or invalid placeholder/value coexistence; exactly one visible content role must match Content`,
      ]);
    }
    const contentNode = childByRole(
      contentParent,
      content === "placeholder"
        ? "input-field/content/placeholder"
        : "input-field/content/value",
      "text",
    );
    if (contentNode.width.mode !== "fill") {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: input content must fill the horizontal surface`,
      ]);
    }
    const expectedSurfaceRoles = [
      ...(adornments === "leading" || adornments === "both"
        ? ["input-field/slot/leading"]
        : []),
      content === "placeholder"
        ? "input-field/content/placeholder"
        : "input-field/content/value",
      ...(adornments === "trailing" || adornments === "both"
        ? ["input-field/slot/trailing"]
        : []),
    ];
    if (
      canonicalJson(contentParent.children.map((child) => child.role)) !==
      canonicalJson(expectedSurfaceRoles)
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: unexpected or missing input surface role`,
      ]);
    }
    if (
      floating &&
      canonicalJson(surface.children.map((child) => child.role)) !==
        canonicalJson(["input-field/content-row", "input-field/label-row"])
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: floating label requires named content row and notched surface structure`,
      ]);
    }
    if (
      floating &&
      (labelRow.layout.positioning !== "absolute" ||
        labelRow.layout.offset === undefined ||
        labelRow.layout.constraints?.horizontal !== "left" ||
        labelRow.layout.constraints.vertical !== "top")
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: floating label overlay requires explicit absolute positioning, offsets, and constraints`,
      ]);
    }
    if (stacked && labelRow.layout.positioning === "absolute") {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${expectedRole}: stacked labels must remain in flow`,
      ]);
    }
  }
  const expectedCount =
    INPUT_FIELD_SIZES.length *
    INPUT_FIELD_STATES.length *
    INPUT_FIELD_CONTENT.length *
    INPUT_FIELD_REQUIRED.length *
    INPUT_FIELD_ADORNMENTS.length;
  if (combinations.size !== expectedCount) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `input-field@1 requires the complete ${expectedCount}-variant matrix; found ${combinations.size}`,
    ]);
  }

  for (const [axisName, values] of [
    ["Size", INPUT_FIELD_SIZES],
    ["State", INPUT_FIELD_STATES],
  ] as const) {
    const fingerprints = values.map((value) => {
      const component = componentFor(
        root,
        axisName === "Size" ? (value as InputFieldSize) : "medium",
        axisName === "State" ? (value as InputFieldState) : "default",
        "placeholder",
        "false",
        "none",
      );
      return renderFingerprint(component);
    });
    if (new Set(fingerprints).size !== values.length) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `dead ${axisName.toLowerCase()} axis: every declared value must produce a distinct canonical rendering`,
      ]);
    }
  }

  const allowedRoles = new Set([
    "input-field/set",
    "input-field/label-row",
    "input-field/label",
    "input-field/required-indicator",
    "input-field/surface",
    "input-field/content-row",
    "input-field/content/placeholder",
    "input-field/content/value",
    "input-field/message/helper",
    "input-field/message/error",
    "input-field/message-container",
    "input-field/slot/leading",
    "input-field/slot/trailing",
  ]);
  walk(root, (node) => {
    if (
      (node.kind === "frame" ||
        node.kind === "component" ||
        node.kind === "component-set") &&
      node.layout.mode === "none"
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${node.role ?? node.kind}: fake layout mode none is unsupported`,
      ]);
    }
    if (!node.role) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${node.label ?? node.kind}: missing recipe role`,
      ]);
    }
    if (
      node.kind === "instance" &&
      node.role.startsWith("input-field/slot/") &&
      (node.payload === undefined ||
        ((node.payload.content.kind === "text" ||
          node.payload.content.kind === "glyph") &&
          node.payload.content.text.trim().length === 0))
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${node.role}: adornment payload must contain visible typed content`,
      ]);
    }
    if (
      !allowedRoles.has(node.role) &&
      !node.role.startsWith("input-field/variant/")
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `unexpected role ${node.role}; input-field@1 does not infer structural edits`,
      ]);
    }
  });
}

const appearanceFrom = (
  component: ComponentNode,
): InputFieldRecipeInstance["tokens"]["states"]["default"] => {
  const surface = childByRole(component, "input-field/surface", "frame");
  const labelRow = descendantByRole(
    component,
    "input-field/label-row",
    "frame",
  );
  const label = childByRole(labelRow, "input-field/label", "text");
  const contentRole =
    component.variantProperties.Content === "placeholder"
      ? "input-field/content/placeholder"
      : "input-field/content/value";
  const content = descendantByRole(surface, contentRole, "text");
  const message = descendantByRole(
    component,
    component.variantProperties.State === "error"
      ? "input-field/message/error"
      : "input-field/message/helper",
    "text",
  );
  const background = solidColor(surface.fills[0], surface.role!, "fills[0]");
  const border = solidColor(
    surface.strokes?.[0]?.paint,
    surface.role!,
    "strokes[0].paint",
  );
  const contentColor = solidColor(content.fills[0], content.role!, "fills[0]");
  return {
    background: colorParameterFrom(surface, "fills.0.color", background),
    border: colorParameterFrom(surface, "strokes.0.paint.color", border),
    borderWidth: numberParameterFrom(
      surface,
      "strokes.0.weight",
      surface.strokes?.[0]?.weight ?? 0,
    ),
    inputText: colorParameterFrom(content, "fills.0.color", contentColor),
    placeholderText: colorParameterFrom(content, "fills.0.color", contentColor),
    labelText: colorParameterFrom(
      label,
      "fills.0.color",
      solidColor(label.fills[0], label.role!, "fills[0]"),
    ),
    messageText: colorParameterFrom(
      message,
      "fills.0.color",
      solidColor(message.fills[0], message.role!, "fills[0]"),
    ),
    adornmentText: colorParameterFrom(content, "fills.0.color", contentColor),
    requiredIndicatorText: colorParameterFrom(
      label,
      "fills.0.color",
      solidColor(label.fills[0], label.role!, "fills[0]"),
    ),
    effects: (surface.effects ?? []).map((effect, index) => {
      if (effect.kind !== "drop-shadow" && effect.kind !== "inner-shadow") {
        throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
          `${surface.role}: unsupported blur effect in field appearance`,
        ]);
      }
      return {
        ...effect,
        color: colorParameterFrom(
          surface,
          `effects.${index}.color`,
          effect.color,
        ),
      };
    }),
  };
};

const firstDifference = (
  left: unknown,
  right: unknown,
  path = "$",
): string | undefined => {
  if (Object.is(left, right)) return undefined;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return path;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return path;
    if (left.length !== right.length) return `${path}.length`;
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstDifference(
        left[index],
        right[index],
        `${path}[${index}]`,
      );
      if (difference) return difference;
    }
    return undefined;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  if (
    typeof leftRecord.name === "string" &&
    typeof rightRecord.name === "string" &&
    Array.isArray(leftRecord.values) &&
    Array.isArray(rightRecord.values) &&
    Object.keys(leftRecord).length === 2 &&
    Object.keys(rightRecord).length === 2
  ) {
    if (leftRecord.name !== rightRecord.name) return `${path}.name`;
    const leftValues = leftRecord.values.map(String);
    const rightValues = rightRecord.values.map(String);
    const sameMembers =
      leftValues.length === rightValues.length &&
      leftValues.every((value) => rightValues.includes(value));
    return sameMembers ? undefined : `${path}.values`;
  }
  const keys = [
    ...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]),
  ].sort(compareText);
  for (const key of keys) {
    if (!(key in leftRecord) || !(key in rightRecord)) return `${path}.${key}`;
    const difference = firstDifference(
      leftRecord[key],
      rightRecord[key],
      `${path}.${key}`,
    );
    if (difference) return difference;
  }
  return undefined;
};

export function collapseInputFieldRecipe(
  envelopeInput: unknown,
  selectionInput: unknown,
): InputFieldRecipeInstance {
  requireExactRecipeSelection(selectionInput, INPUT_FIELD_RECIPE_REF);
  const envelope = RecipeEnvelopeSchema.parse(envelopeInput);
  if (
    envelope.recipe.id !== INPUT_FIELD_RECIPE_REF.id ||
    envelope.recipe.version !== INPUT_FIELD_RECIPE_REF.version
  ) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `selected envelope is ${envelope.recipe.id}@${envelope.recipe.version}; explicit input-field@1 selection is required`,
    ]);
  }
  if (envelope.archetype !== "input / field") {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `selected envelope archetype is ${envelope.archetype}, expected input / field`,
    ]);
  }
  if (hashRecipeEnvelope(envelope) !== envelope.integrity.canonicalHash) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      "integrity.canonicalHash does not match the selected envelope",
    ]);
  }
  if (envelope.ir.kind !== "component-set") {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `missing required role input-field/set: root is ${envelope.ir.kind}, expected component-set`,
    ]);
  }
  requireSemanticExtensions(envelope);
  const root = envelope.ir;
  validateInputFieldStructure(root);
  const first = root.children[0]!;
  const defaultSize = first.variantProperties.Size as InputFieldSize;
  const defaultContent = first.variantProperties.Content as InputFieldContent;
  const defaultRequired = first.variantProperties
    .Required as InputFieldRequired;
  const baseline = componentFor(
    root,
    defaultSize,
    "default",
    defaultContent,
    defaultRequired,
    "none",
  );
  const isFloating = !baseline.children.some(
    (child) => child.role === "input-field/label-row",
  );
  const labelRow = descendantByRole(baseline, "input-field/label-row", "frame");
  const label = childByRole(labelRow, "input-field/label", "text");
  const placeholderSurface = childByRole(
    componentFor(
      root,
      defaultSize,
      "default",
      "placeholder",
      defaultRequired,
      "none",
    ),
    "input-field/surface",
    "frame",
  );
  const placeholder = descendantByRole(
    placeholderSurface,
    "input-field/content/placeholder",
    "text",
  );
  const valueSurface = childByRole(
    componentFor(
      root,
      defaultSize,
      "default",
      "value",
      defaultRequired,
      "none",
    ),
    "input-field/surface",
    "frame",
  );
  const value = descendantByRole(
    valueSurface,
    "input-field/content/value",
    "text",
  );
  const helper = descendantByRole(
    componentFor(
      root,
      defaultSize,
      "default",
      defaultContent,
      defaultRequired,
      "none",
    ),
    "input-field/message/helper",
    "text",
  );
  const error = descendantByRole(
    componentFor(
      root,
      defaultSize,
      "error",
      defaultContent,
      defaultRequired,
      "none",
    ),
    "input-field/message/error",
    "text",
  );
  const leading = descendantByRole(
    childByRole(
      componentFor(
        root,
        defaultSize,
        "default",
        defaultContent,
        defaultRequired,
        "leading",
      ),
      "input-field/surface",
      "frame",
    ),
    "input-field/slot/leading",
    "instance",
  );
  const trailing = descendantByRole(
    childByRole(
      componentFor(
        root,
        defaultSize,
        "default",
        defaultContent,
        defaultRequired,
        "trailing",
      ),
      "input-field/surface",
      "frame",
    ),
    "input-field/slot/trailing",
    "instance",
  );
  if (leading.payload === undefined || trailing.payload === undefined) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      "input adornment instances require explicit typed payloads",
    ]);
  }
  const leadingPayload = leading.payload;
  const trailingPayload = trailing.payload;

  const sizeFrom = (
    sizeName: InputFieldSize,
  ): InputFieldRecipeInstance["tokens"]["sizes"]["small"] => {
    const component = componentFor(
      root,
      sizeName,
      "default",
      "placeholder",
      "true",
      "none",
    );
    const activeComponent = componentFor(
      root,
      sizeName,
      "focus-visible",
      "placeholder",
      "true",
      "none",
    );
    const row = descendantByRole(
      activeComponent,
      "input-field/label-row",
      "frame",
    );
    const inactiveRow = descendantByRole(
      component,
      "input-field/label-row",
      "frame",
    );
    const surface = childByRole(component, "input-field/surface", "frame");
    const input = descendantByRole(
      surface,
      "input-field/content/placeholder",
      "text",
    );
    const labelNode = childByRole(row, "input-field/label", "text");
    const inactiveLabel = childByRole(inactiveRow, "input-field/label", "text");
    const message = descendantByRole(
      component,
      "input-field/message/helper",
      "text",
    );
    const messageContainer = childByRole(
      component,
      "input-field/message-container",
      "frame",
    );
    const leadingAdornment = descendantByRole(
      componentFor(
        root,
        sizeName,
        "default",
        "placeholder",
        "false",
        "leading",
      ),
      "input-field/slot/leading",
      "instance",
    );
    const trailingAdornment = descendantByRole(
      componentFor(
        root,
        sizeName,
        "default",
        "placeholder",
        "false",
        "trailing",
      ),
      "input-field/slot/trailing",
      "instance",
    );
    if (
      input.type.lineHeight.unit !== "px" ||
      labelNode.type.lineHeight.unit !== "px" ||
      inactiveLabel.type.lineHeight.unit !== "px" ||
      message.type.lineHeight.unit !== "px"
    ) {
      throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
        `${component.role}: field text line heights must use px`,
      ]);
    }
    return {
      width: numberParameterFrom(
        component,
        "layout.width.value",
        asFixed(component.layout.width, component.role!, "width"),
      ),
      minWidth: numberParameterFrom(
        component,
        "layout.minWidth",
        component.layout.minWidth ?? 0,
      ),
      leadingAdornmentExtent: numberParameterFrom(
        leadingAdornment,
        "width.value",
        asFixed(
          leadingAdornment.width,
          leadingAdornment.role!,
          "leading adornment extent",
        ),
      ),
      trailingAdornmentExtent: numberParameterFrom(
        trailingAdornment,
        "width.value",
        asFixed(
          trailingAdornment.width,
          trailingAdornment.role!,
          "trailing adornment extent",
        ),
      ),
      surfaceHeight: numberParameterFrom(
        surface,
        "layout.height.value",
        asFixed(surface.layout.height, surface.role!, "height"),
      ),
      paddingX: numberParameterFrom(
        surface,
        "layout.padding.left",
        surface.layout.padding.left,
      ),
      surfaceGap: numberParameterFrom(
        isFloating
          ? descendantByRole(
              activeComponent,
              "input-field/content-row",
              "frame",
            )
          : childByRole(activeComponent, "input-field/surface", "frame"),
        "layout.itemSpacing",
        isFloating
          ? descendantByRole(
              activeComponent,
              "input-field/content-row",
              "frame",
            ).layout.itemSpacing
          : childByRole(activeComponent, "input-field/surface", "frame").layout
              .itemSpacing,
      ),
      stackGap: numberParameterFrom(
        component,
        "layout.itemSpacing",
        component.layout.itemSpacing,
      ),
      labelGap: numberParameterFrom(
        row,
        "layout.itemSpacing",
        row.layout.itemSpacing,
      ),
      labelInsetX: isFloating
        ? codeOnlyPositionParameterFrom(
            row,
            "label-inset-x",
            row.layout.offset?.x ?? row.layout.padding.left,
          )
        : numberParameterFrom(
            row,
            "layout.padding.left",
            row.layout.padding.left,
          ),
      labelInactiveOffsetY: isFloating
        ? codeOnlyPositionParameterFrom(
            inactiveRow,
            "label-inactive-offset-y",
            inactiveRow.layout.offset?.y ?? inactiveRow.layout.padding.top,
          )
        : numberParameterFrom(
            inactiveRow,
            "layout.padding.top",
            inactiveRow.layout.padding.top,
          ),
      labelFloatingOffsetY: isFloating
        ? codeOnlyPositionParameterFrom(
            row,
            (row.layout.offset?.y ?? row.layout.padding.top) ===
              (inactiveRow.layout.offset?.y ?? inactiveRow.layout.padding.top)
              ? "label-inactive-offset-y"
              : "label-floating-offset-y",
            row.layout.offset?.y ?? row.layout.padding.top,
          )
        : numberParameterFrom(
            row,
            "layout.padding.top",
            row.layout.padding.top,
          ),
      helperInsetX: numberParameterFrom(
        messageContainer,
        "layout.padding.left",
        messageContainer.layout.padding.left,
      ),
      inputFontSize: numberParameterFrom(
        input,
        "type.fontSize",
        input.type.fontSize,
      ),
      inputLineHeight: numberParameterFrom(
        input,
        "type.lineHeight.value",
        input.type.lineHeight.value,
      ),
      inactiveLabelFontSize: numberParameterFrom(
        inactiveLabel,
        "type.fontSize",
        inactiveLabel.type.fontSize,
      ),
      inactiveLabelLineHeight: numberParameterFrom(
        inactiveLabel,
        "type.lineHeight.value",
        inactiveLabel.type.lineHeight.value,
      ),
      labelFontSize: numberParameterFrom(
        labelNode,
        "type.fontSize",
        labelNode.type.fontSize,
      ),
      labelLineHeight: numberParameterFrom(
        labelNode,
        "type.lineHeight.value",
        labelNode.type.lineHeight.value,
      ),
      messageFontSize: numberParameterFrom(
        message,
        "type.fontSize",
        message.type.fontSize,
      ),
      messageLineHeight: numberParameterFrom(
        message,
        "type.lineHeight.value",
        message.type.lineHeight.value,
      ),
      adornmentSize: numberParameterFrom(
        leadingAdornment,
        "height.value",
        asFixed(leadingAdornment.height, leadingAdornment.role!, "height"),
      ),
    };
  };

  const appearanceFor = (
    state: InputFieldState,
  ): InputFieldRecipeInstance["tokens"]["states"]["default"] => {
    const placeholderComponent = componentFor(
      root,
      defaultSize,
      state,
      "placeholder",
      "false",
      "none",
    );
    const valueComponent = componentFor(
      root,
      defaultSize,
      state,
      "value",
      "false",
      "none",
    );
    const appearance = appearanceFrom(placeholderComponent);
    const valueNode = descendantByRole(
      childByRole(valueComponent, "input-field/surface", "frame"),
      "input-field/content/value",
      "text",
    );
    appearance.inputText = colorParameterFrom(
      valueNode,
      "fills.0.color",
      solidColor(valueNode.fills[0], valueNode.role!, "fills[0]"),
    );
    const adornedComponent = componentFor(
      root,
      defaultSize,
      state,
      "placeholder",
      "false",
      "both",
    );
    const adornment = descendantByRole(
      adornedComponent,
      "input-field/slot/leading",
      "instance",
    );
    appearance.adornmentText = colorParameterFrom(
      adornment,
      "fills.0.color",
      solidColor(adornment.fills?.[0], adornment.role!, "fills[0]"),
    );
    const requiredIndicator = childByRole(
      descendantByRole(
        componentFor(root, defaultSize, state, "placeholder", "true", "none"),
        "input-field/label-row",
        "frame",
      ),
      "input-field/required-indicator",
      "text",
    );
    appearance.requiredIndicatorText = colorParameterFrom(
      requiredIndicator,
      "fills.0.color",
      solidColor(
        requiredIndicator.fills[0],
        requiredIndicator.role!,
        "fills[0]",
      ),
    );
    return appearance;
  };

  const baselineSurface = childByRole(baseline, "input-field/surface", "frame");
  const instance = normalizeInputFieldRecipeInstance({
    identity: { id: envelope.id, name: envelope.name },
    semantic: {
      control: "input",
      inputType: "text",
      association: "explicit-id",
      description: "aria-describedby",
      invalid: "aria-invalid",
      required: "native-required",
      disabled: "native-disabled",
    },
    axes: {
      size: {
        name: "Size",
        values: [...INPUT_FIELD_SIZES],
        default: defaultSize,
        exposure: "public",
      },
      state: {
        name: "State",
        values: [...INPUT_FIELD_STATES],
        default: "default",
        exposure: "design-state",
      },
      content: {
        name: "Content",
        values: [...INPUT_FIELD_CONTENT],
        default: defaultContent,
        exposure: "public",
      },
      required: {
        name: "Required",
        values: [...INPUT_FIELD_REQUIRED],
        default: defaultRequired,
        exposure: "public",
      },
      adornments: {
        name: "Adornments",
        values: [...INPUT_FIELD_ADORNMENTS],
        default: "none",
        exposure: "presence",
      },
    },
    content: {
      label: { property: "Label", default: label.characters },
      placeholder: {
        property: "Placeholder",
        default: placeholder.characters,
      },
      value: { property: "Value", default: value.characters },
      helper: { property: "Helper text", default: helper.characters },
      error: { property: "Error text", default: error.characters },
      visiblePolicy: "value-else-placeholder",
    },
    slots: {
      leading: {
        property: "Leading adornment",
        optional: true,
        accepts: "instance",
        componentRef: leading.componentRef,
        payload: {
          content: leadingPayload.content,
          font: leadingPayload.typography?.fontProvenance,
          fontSize: leadingPayload.typography?.fontSize,
          lineHeight:
            leadingPayload.typography?.lineHeight.unit === "px"
              ? leadingPayload.typography.lineHeight.value
              : undefined,
          fill: colorParameterFrom(
            leading,
            "fills.0.color",
            solidColor(leading.fills?.[0], leading.role!, "fills[0]"),
          ),
          opacity: leadingPayload.opacity,
          intrinsicSize: leadingPayload.intrinsicSize,
          padding: leadingPayload.padding,
          alignment: leadingPayload.alignment,
          accessibility: leadingPayload.accessibility,
          source: leadingPayload.source,
        },
      },
      trailing: {
        property: "Trailing adornment",
        optional: true,
        accepts: "instance",
        componentRef: trailing.componentRef,
        payload: {
          content: trailingPayload.content,
          font: trailingPayload.typography?.fontProvenance,
          fontSize: trailingPayload.typography?.fontSize,
          lineHeight:
            trailingPayload.typography?.lineHeight.unit === "px"
              ? trailingPayload.typography.lineHeight.value
              : undefined,
          fill: colorParameterFrom(
            trailing,
            "fills.0.color",
            solidColor(trailing.fills?.[0], trailing.role!, "fills[0]"),
          ),
          opacity: trailingPayload.opacity,
          intrinsicSize: trailingPayload.intrinsicSize,
          padding: trailingPayload.padding,
          alignment: trailingPayload.alignment,
          accessibility: trailingPayload.accessibility,
          source: trailingPayload.source,
        },
      },
    },
    structure: {
      labelPlacement: isFloating ? "floating" : "stacked",
      floatingActivation: isFloating
        ? "focus-value-or-leading-adornment"
        : "never",
      outlineTreatment: isFloating ? "notched" : "plain",
      helperPlacement:
        childByRole(baseline, "input-field/message-container", "frame").layout
          .padding.left > 0
          ? "content-inset"
          : "field-edge",
      sizingPolicy:
        asFixed(
          componentFor(
            root,
            defaultSize,
            "default",
            defaultContent,
            defaultRequired,
            "both",
          ).layout.width,
          baseline.role!,
          "width",
        ) > asFixed(baseline.layout.width, baseline.role!, "width")
          ? "adornment-additive"
          : "fixed",
      adornmentSizing:
        asFixed(leading.width, leading.role!, "width") !==
          asFixed(leading.height, leading.role!, "height") ||
        asFixed(trailing.width, trailing.role!, "width") !==
          asFixed(trailing.height, trailing.role!, "height")
          ? "intrinsic-extent"
          : "fixed",
      contentAlignment:
        baselineSurface.layout.counterAxisAlign === "center"
          ? "center"
          : "start",
    },
    designerEditSurface: {
      textProperties: [
        "Label",
        "Placeholder",
        "Value",
        "Helper text",
        "Error text",
      ],
      variantProperties: ["Size", "State", "Content", "Required", "Adornments"],
      instanceSwapProperties: ["Leading adornment", "Trailing adornment"],
      resize: {
        root: "fixed-width",
        descendants: "fill-container",
        vertical: "hug-contents",
      },
    },
    tokens: {
      states: {
        default: appearanceFor("default"),
        focusVisible: appearanceFor("focus-visible"),
        error: appearanceFor("error"),
        disabled: appearanceFor("disabled"),
      },
      sizes: {
        small: sizeFrom("small"),
        medium: sizeFrom("medium"),
      },
      radius: numberParameterFrom(
        baselineSurface,
        "cornerRadius.topLeft",
        baselineSurface.cornerRadius?.topLeft ?? 0,
      ),
      typography: {
        input: fontSpecFrom(placeholder),
        label: fontSpecFrom(label),
        message: fontSpecFrom(helper),
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
  const recompiled = compileInputFieldRecipe(instance);
  const difference = firstDifference(recompiled.ir, envelope.ir);
  if (difference) {
    throw new RecipeRefusal(INPUT_FIELD_RECIPE_REF, [
      `unsupported structural edit at ${difference}; input-field@1 accepts only its declared edit surface`,
    ]);
  }
  return instance;
}

export const inputFieldRecipe: Recipe<InputFieldRecipeInstance> = {
  ref: INPUT_FIELD_RECIPE_REF,
  normalize: normalizeInputFieldRecipeInstance,
  compile: compileInputFieldRecipe,
  collapse: collapseInputFieldRecipe,
};
