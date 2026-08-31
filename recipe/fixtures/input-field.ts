import type { InputFieldRecipeInstance } from "../recipes/input-field.js";

const number = (variable: string, fallback: number) => ({
  variable,
  fallback,
});
const color = (variable: string, fallback: `#${string}`) => ({
  variable,
  fallback,
});
const font = (style: string) => ({
  requestedFamily: "Inter",
  requestedStyle: style,
  requestSource: "recipe/fixtures/input-field.ts#canonical-font",
  fallbackChain: [
    { family: "Inter", style },
    { family: "Arial", style: style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: "Inter",
  resolvedStyle: style,
  resolution: "requested" as const,
});
const adornment = (text: string, width: number) => ({
  content: { kind: "text" as const, text },
  font: font("Regular"),
  fontSize: 14,
  lineHeight: 20,
  fill: color("input-field.default.adornment-text", "#202020ff"),
  opacity: 1,
  intrinsicSize: { width, height: 20 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  accessibility: { relation: "none" as const, decorative: true },
  source: "recipe/fixtures/input-field.ts#canonical-adornment",
});
const appearance = (
  state: string,
  values: {
    background: `#${string}`;
    border: `#${string}`;
    input: `#${string}`;
    placeholder: `#${string}`;
    label: `#${string}`;
    message: `#${string}`;
    adornment?: `#${string}`;
    requiredIndicator?: `#${string}`;
    borderWidth?: number;
    focus?: `#${string}`;
  },
) => ({
  background: color(`input-field.${state}.background`, values.background),
  border: color(`input-field.${state}.border`, values.border),
  borderWidth: number(
    `input-field.${state}.border-width`,
    values.borderWidth ?? 1,
  ),
  inputText: color(`input-field.${state}.input-text`, values.input),
  placeholderText: color(
    `input-field.${state}.placeholder-text`,
    values.placeholder,
  ),
  labelText: color(`input-field.${state}.label-text`, values.label),
  messageText: color(`input-field.${state}.message-text`, values.message),
  adornmentText: color(
    `input-field.${state}.adornment-text`,
    values.adornment ?? values.input,
  ),
  requiredIndicatorText: color(
    `input-field.${state}.required-indicator-text`,
    values.requiredIndicator ?? "#c62828ff",
  ),
  effects: values.focus
    ? [
        {
          kind: "drop-shadow" as const,
          offsetX: 0,
          offsetY: 0,
          blur: 0,
          spread: 2,
          color: color(`input-field.${state}.focus-ring`, values.focus),
        },
      ]
    : [],
});
const size = (
  name: "small" | "medium",
  values: {
    width: number;
    minWidth: number;
    leadingAdornmentExtent: number;
    trailingAdornmentExtent: number;
    surfaceHeight: number;
    paddingX: number;
    surfaceGap: number;
    stackGap: number;
    labelGap: number;
    labelInsetX: number;
    labelInactiveOffsetY: number;
    labelFloatingOffsetY: number;
    helperInsetX: number;
    inputFontSize: number;
    inputLineHeight: number;
    inactiveLabelFontSize: number;
    inactiveLabelLineHeight: number;
    labelFontSize: number;
    labelLineHeight: number;
    messageFontSize: number;
    messageLineHeight: number;
    adornmentSize: number;
  },
) => ({
  width: number(`input-field.${name}.width`, values.width),
  minWidth: number(`input-field.${name}.min-width`, values.minWidth),
  leadingAdornmentExtent: number(
    `input-field.${name}.leading-adornment-extent`,
    values.leadingAdornmentExtent,
  ),
  trailingAdornmentExtent: number(
    `input-field.${name}.trailing-adornment-extent`,
    values.trailingAdornmentExtent,
  ),
  surfaceHeight: number(
    `input-field.${name}.surface-height`,
    values.surfaceHeight,
  ),
  paddingX: number(`input-field.${name}.padding-x`, values.paddingX),
  surfaceGap: number(`input-field.${name}.surface-gap`, values.surfaceGap),
  stackGap: number(`input-field.${name}.stack-gap`, values.stackGap),
  labelGap: number(`input-field.${name}.label-gap`, values.labelGap),
  labelInsetX: number(`input-field.${name}.label-inset-x`, values.labelInsetX),
  labelInactiveOffsetY: number(
    `input-field.${name}.label-inactive-offset-y`,
    values.labelInactiveOffsetY,
  ),
  labelFloatingOffsetY: number(
    `input-field.${name}.${values.labelFloatingOffsetY === values.labelInactiveOffsetY ? "label-inactive-offset-y" : "label-floating-offset-y"}`,
    values.labelFloatingOffsetY,
  ),
  helperInsetX: number(
    `input-field.${name}.helper-inset-x`,
    values.helperInsetX,
  ),
  inputFontSize: number(
    `input-field.${name}.input-font-size`,
    values.inputFontSize,
  ),
  inputLineHeight: number(
    `input-field.${name}.input-line-height`,
    values.inputLineHeight,
  ),
  inactiveLabelFontSize: number(
    `input-field.${name}.${values.inactiveLabelFontSize === values.labelFontSize ? "label-font-size" : "inactive-label-font-size"}`,
    values.inactiveLabelFontSize,
  ),
  inactiveLabelLineHeight: number(
    `input-field.${name}.${values.inactiveLabelLineHeight === values.labelLineHeight ? "label-line-height" : "inactive-label-line-height"}`,
    values.inactiveLabelLineHeight,
  ),
  labelFontSize: number(
    `input-field.${name}.label-font-size`,
    values.labelFontSize,
  ),
  labelLineHeight: number(
    `input-field.${name}.label-line-height`,
    values.labelLineHeight,
  ),
  messageFontSize: number(
    `input-field.${name}.message-font-size`,
    values.messageFontSize,
  ),
  messageLineHeight: number(
    `input-field.${name}.message-line-height`,
    values.messageLineHeight,
  ),
  adornmentSize: number(
    `input-field.${name}.adornment-size`,
    values.adornmentSize,
  ),
});

export const canonicalInputFieldRecipeInstance = {
  identity: { id: "ds.input-field", name: "Input / Field" },
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
      values: ["small", "medium"],
      default: "medium",
      exposure: "public",
    },
    state: {
      name: "State",
      values: ["default", "focus-visible", "error", "disabled"],
      default: "default",
      exposure: "design-state",
    },
    content: {
      name: "Content",
      values: ["placeholder", "value"],
      default: "placeholder",
      exposure: "public",
    },
    required: {
      name: "Required",
      values: ["false", "true"],
      default: "false",
      exposure: "public",
    },
    adornments: {
      name: "Adornments",
      values: ["none", "leading", "trailing", "both"],
      default: "none",
      exposure: "presence",
    },
  },
  content: {
    label: { property: "Label", default: "Account name" },
    placeholder: { property: "Placeholder", default: "Enter a value" },
    value: { property: "Value", default: "Jaded Pixel" },
    helper: { property: "Helper text", default: "Use a memorable name." },
    error: { property: "Error text", default: "Enter a valid name." },
    visiblePolicy: "value-else-placeholder",
  },
  slots: {
    leading: {
      property: "Leading adornment",
      optional: true,
      accepts: "instance",
      componentRef: "input-adornment@1",
      payload: adornment("$", 8),
    },
    trailing: {
      property: "Trailing adornment",
      optional: true,
      accepts: "instance",
      componentRef: "input-adornment@1",
      payload: adornment("USD", 28),
    },
  },
  structure: {
    labelPlacement: "stacked",
    floatingActivation: "never",
    outlineTreatment: "plain",
    helperPlacement: "field-edge",
    sizingPolicy: "fixed",
    adornmentSizing: "fixed",
    contentAlignment: "center",
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
      default: appearance("default", {
        background: "#ffffffff",
        border: "#8a8a8aff",
        input: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#202020ff",
        message: "#5f6368ff",
      }),
      focusVisible: appearance("focus-visible", {
        background: "#ffffffff",
        border: "#2563ebff",
        input: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#202020ff",
        message: "#5f6368ff",
        focus: "#93c5fdff",
      }),
      error: appearance("error", {
        background: "#ffffffff",
        border: "#c62828ff",
        input: "#202020ff",
        placeholder: "#6b7280ff",
        label: "#c62828ff",
        message: "#c62828ff",
      }),
      disabled: appearance("disabled", {
        background: "#f3f4f6ff",
        border: "#d1d5dbff",
        input: "#9ca3afff",
        placeholder: "#9ca3afff",
        label: "#9ca3afff",
        message: "#9ca3afff",
      }),
    },
    sizes: {
      small: size("small", {
        width: 280,
        minWidth: 160,
        leadingAdornmentExtent: 16,
        trailingAdornmentExtent: 16,
        surfaceHeight: 36,
        paddingX: 10,
        surfaceGap: 6,
        stackGap: 4,
        labelGap: 3,
        labelInsetX: 0,
        labelInactiveOffsetY: 0,
        labelFloatingOffsetY: 0,
        helperInsetX: 0,
        inputFontSize: 14,
        inputLineHeight: 20,
        inactiveLabelFontSize: 12,
        inactiveLabelLineHeight: 16,
        labelFontSize: 12,
        labelLineHeight: 16,
        messageFontSize: 12,
        messageLineHeight: 16,
        adornmentSize: 16,
      }),
      medium: size("medium", {
        width: 320,
        minWidth: 200,
        leadingAdornmentExtent: 20,
        trailingAdornmentExtent: 20,
        surfaceHeight: 44,
        paddingX: 12,
        surfaceGap: 8,
        stackGap: 6,
        labelGap: 4,
        labelInsetX: 0,
        labelInactiveOffsetY: 0,
        labelFloatingOffsetY: 0,
        helperInsetX: 0,
        inputFontSize: 16,
        inputLineHeight: 24,
        inactiveLabelFontSize: 14,
        inactiveLabelLineHeight: 20,
        labelFontSize: 14,
        labelLineHeight: 20,
        messageFontSize: 12,
        messageLineHeight: 16,
        adornmentSize: 20,
      }),
    },
    radius: number("input-field.radius", 4),
    typography: {
      input: font("Regular"),
      label: font("Medium"),
      message: font("Regular"),
    },
  },
  inputFacts: [
    { path: "root", channel: "adornment-payload" },
    { path: "root", channel: "axes" },
    { path: "root", channel: "designer-edit-surface" },
    { path: "root", channel: "input-content" },
    { path: "root", channel: "font-provenance" },
    { path: "root", channel: "label" },
    { path: "root", channel: "messages" },
    { path: "root", channel: "required-indicator" },
    { path: "root", channel: "slots" },
    { path: "root", channel: "tokens" },
    { path: "root", channel: "aria-describedby" },
    { path: "root", channel: "aria-invalid" },
    { path: "root", channel: "input-events" },
    { path: "root", channel: "label-input-association" },
    { path: "root", channel: "native-required-disabled" },
    { path: "root", channel: "recipe-selection" },
    { path: "root", channel: "transition-timing-function" },
  ],
  accounting: {
    carried: [
      { path: "root", channel: "adornment-payload" },
      { path: "root", channel: "axes" },
      { path: "root", channel: "designer-edit-surface" },
      { path: "root", channel: "input-content" },
      { path: "root", channel: "font-provenance" },
      { path: "root", channel: "label" },
      { path: "root", channel: "messages" },
      { path: "root", channel: "required-indicator" },
      { path: "root", channel: "slots" },
      { path: "root", channel: "tokens" },
    ],
  },
  extensions: [
    {
      id: "input-field/aria-describedby",
      kind: "a11y",
      stated: "associates helper or error text with the input",
      why: "runtime ARIA relationships are not drawable canvas properties",
      absorbs: [{ path: "root", channel: "aria-describedby" }],
    },
    {
      id: "input-field/aria-invalid",
      kind: "a11y",
      stated: "exposes the error state to assistive technology",
      why: "runtime ARIA state is not a static Figma primitive",
      absorbs: [{ path: "root", channel: "aria-invalid" }],
    },
    {
      id: "input-field/events",
      kind: "behaviour",
      stated: "dispatches input, change, focus, and blur events",
      why: "event dispatch belongs to executable code",
      absorbs: [{ path: "root", channel: "input-events" }],
    },
    {
      id: "input-field/label-input-association",
      kind: "a11y",
      stated: "binds one explicit label id reference to one input id",
      why: "the canvas can compose label and surface but cannot expose htmlFor",
      absorbs: [{ path: "root", channel: "label-input-association" }],
    },
    {
      id: "input-field/native-required-disabled",
      kind: "a11y",
      stated: "uses native required and disabled input semantics",
      why: "native form behavior belongs to executable code",
      absorbs: [{ path: "root", channel: "native-required-disabled" }],
    },
    {
      id: "input-field/recipe-selection",
      kind: "data",
      stated: "records the reviewed human/config choice of input-field@1",
      why: "selection provenance is review data, not canvas structure",
      absorbs: [{ path: "root", channel: "recipe-selection" }],
    },
  ],
  receipts: [
    {
      fact: { path: "root", channel: "transition-timing-function" },
      value: "cubic-bezier(0.2, 0, 0, 1)",
      reason: "no-figma-primitive",
      evidence:
        "docs/32-recipe-ir-pivot.md §3 (constructs absent from primitive IR)",
    },
  ],
  provenance: {
    source: "recipe/fixtures/input-field.ts",
    tool: "input-field@1",
    generatedAt: "2026-08-26T00:00:00.000Z",
    selection: {
      candidates: [{ id: "input-field", version: 1 }],
      selectedBy: "recipe-pivot-input-field-review",
      mechanism: "human-review",
      source: "docs/32-recipe-ir-pivot.md §7",
      reviewedAt: "2026-08-26T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit input / field to input-field@1 selection",
      },
    },
  },
} as const satisfies InputFieldRecipeInstance;
