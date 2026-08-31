import type {
  ReviewedInputFieldAdapterConfig,
  ReviewedInputFieldSourceFact,
} from "../adapters/input-field.js";
import type { InputFieldRecipeInstance } from "../recipes/input-field.js";

type Tokens = InputFieldRecipeInstance["tokens"];

const number = (variable: string, fallback: number) => ({
  variable,
  fallback,
});
const color = (variable: string, fallback: `#${string}`) => ({
  variable,
  fallback,
});
const fontSpec = (
  requestedFamily: string,
  requestedStyle: string,
  requestSource: string,
  fallbacks: Array<{ family: string; style: string }>,
) => ({
  requestedFamily,
  requestedStyle,
  requestSource,
  fallbackChain: [
    { family: requestedFamily, style: requestedStyle },
    ...fallbacks,
  ],
  resolvedFamily: requestedFamily,
  resolvedStyle: requestedStyle,
  resolution: "requested" as const,
});
const textAdornment = (
  text: string,
  font: InputFieldRecipeInstance["tokens"]["typography"]["input"],
  source: string,
  colorValue: { variable: string; fallback: `#${string}` },
  intrinsicSize: { width: number; height: number },
  relation: "none" | "labelledby-control",
) => ({
  content: { kind: "text" as const, text },
  font,
  fontSize: font.requestedFamily === "Roboto" ? 16 : 14,
  lineHeight: font.requestedFamily === "Roboto" ? 24 : 20,
  fill: colorValue,
  opacity: 1,
  intrinsicSize,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  accessibility: {
    relation,
    decorative: relation === "none",
  },
  source,
});
const state = (
  namespace: string,
  values: {
    background: `#${string}`;
    border: `#${string}`;
    input: `#${string}`;
    placeholder: `#${string}`;
    label: `#${string}`;
    message: `#${string}`;
    adornment: `#${string}`;
    requiredIndicator: `#${string}`;
    borderWidth?: number;
    ring?: `#${string}`;
  },
) => ({
  background: color(`${namespace}.background`, values.background),
  border: color(`${namespace}.border`, values.border),
  borderWidth: number(`${namespace}.border-width`, values.borderWidth ?? 1),
  inputText: color(`${namespace}.input-text`, values.input),
  placeholderText: color(`${namespace}.placeholder-text`, values.placeholder),
  labelText: color(`${namespace}.label-text`, values.label),
  messageText: color(`${namespace}.message-text`, values.message),
  adornmentText: color(`${namespace}.adornment-text`, values.adornment),
  requiredIndicatorText: color(
    `${namespace}.required-indicator-text`,
    values.requiredIndicator,
  ),
  effects: values.ring
    ? [
        {
          kind: "drop-shadow" as const,
          offsetX: 0,
          offsetY: 0,
          blur: 0,
          spread: 1,
          color: color(`${namespace}.focus-gap`, values.background),
        },
        {
          kind: "drop-shadow" as const,
          offsetX: 0,
          offsetY: 0,
          blur: 0,
          spread: 3,
          color: color(`${namespace}.focus-ring`, values.ring),
        },
      ]
    : [],
});
const size = (
  namespace: string,
  values: {
    width: number;
    minWidth: number;
    leadingAdornmentExtent: number;
    trailingAdornmentExtent: number;
    height: number;
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
  width: number(`${namespace}.width`, values.width),
  minWidth: number(`${namespace}.min-width`, values.minWidth),
  leadingAdornmentExtent: number(
    `${namespace}.leading-adornment-extent`,
    values.leadingAdornmentExtent,
  ),
  trailingAdornmentExtent: number(
    `${namespace}.trailing-adornment-extent`,
    values.trailingAdornmentExtent,
  ),
  surfaceHeight: number(`${namespace}.surface-height`, values.height),
  paddingX: number(`${namespace}.padding-x`, values.paddingX),
  surfaceGap: number(`${namespace}.surface-gap`, values.surfaceGap),
  stackGap: number(`${namespace}.stack-gap`, values.stackGap),
  labelGap: number(`${namespace}.label-gap`, values.labelGap),
  labelInsetX: number(`${namespace}.label-inset-x`, values.labelInsetX),
  labelInactiveOffsetY: number(
    `${namespace}.label-inactive-offset-y`,
    values.labelInactiveOffsetY,
  ),
  labelFloatingOffsetY: number(
    `${namespace}.${values.labelFloatingOffsetY === values.labelInactiveOffsetY ? "label-inactive-offset-y" : "label-floating-offset-y"}`,
    values.labelFloatingOffsetY,
  ),
  helperInsetX: number(`${namespace}.helper-inset-x`, values.helperInsetX),
  inputFontSize: number(`${namespace}.input-font-size`, values.inputFontSize),
  inputLineHeight: number(
    `${namespace}.input-line-height`,
    values.inputLineHeight,
  ),
  inactiveLabelFontSize: number(
    `${namespace}.${values.inactiveLabelFontSize === values.labelFontSize ? "label-font-size" : "inactive-label-font-size"}`,
    values.inactiveLabelFontSize,
  ),
  inactiveLabelLineHeight: number(
    `${namespace}.${values.inactiveLabelLineHeight === values.labelLineHeight ? "label-line-height" : "inactive-label-line-height"}`,
    values.inactiveLabelLineHeight,
  ),
  labelFontSize: number(`${namespace}.label-font-size`, values.labelFontSize),
  labelLineHeight: number(
    `${namespace}.label-line-height`,
    values.labelLineHeight,
  ),
  messageFontSize: number(
    `${namespace}.message-font-size`,
    values.messageFontSize,
  ),
  messageLineHeight: number(
    `${namespace}.message-line-height`,
    values.messageLineHeight,
  ),
  adornmentSize: number(`${namespace}.adornment-size`, values.adornmentSize),
});

const muiTokens: Tokens = {
  states: {
    default: state("imported.text-field.default", {
      background: "#ffffffff",
      border: "#0000003b",
      input: "#000000de",
      placeholder: "#00000099",
      label: "#00000099",
      message: "#00000099",
      adornment: "#00000099",
      requiredIndicator: "#d32f2fff",
    }),
    focusVisible: state("imported.text-field.focus-visible", {
      background: "#ffffffff",
      border: "#1976d2ff",
      borderWidth: 2,
      input: "#000000de",
      placeholder: "#00000099",
      label: "#1976d2ff",
      message: "#00000099",
      adornment: "#00000099",
      requiredIndicator: "#d32f2fff",
    }),
    error: state("imported.text-field.error", {
      background: "#ffffffff",
      border: "#d32f2fff",
      input: "#000000de",
      placeholder: "#00000099",
      label: "#d32f2fff",
      message: "#d32f2fff",
      adornment: "#00000099",
      requiredIndicator: "#d32f2fff",
    }),
    disabled: state("imported.text-field.disabled", {
      background: "#ffffffff",
      border: "#00000042",
      input: "#00000061",
      placeholder: "#00000061",
      label: "#00000061",
      message: "#00000061",
      adornment: "#00000099",
      requiredIndicator: "#00000061",
    }),
  },
  sizes: {
    small: size("imported.text-field.small", {
      width: 195,
      minWidth: 160,
      leadingAdornmentExtent: 17,
      trailingAdornmentExtent: 39,
      height: 40,
      paddingX: 14,
      surfaceGap: 8,
      stackGap: 4,
      labelGap: 2,
      labelInsetX: 14,
      labelInactiveOffsetY: 9,
      labelFloatingOffsetY: -9,
      helperInsetX: 14,
      inputFontSize: 16,
      inputLineHeight: 23,
      inactiveLabelFontSize: 16,
      inactiveLabelLineHeight: 23,
      labelFontSize: 12,
      labelLineHeight: 17,
      messageFontSize: 12,
      messageLineHeight: 20,
      adornmentSize: 20,
    }),
    medium: size("imported.text-field.medium", {
      width: 195,
      minWidth: 160,
      leadingAdornmentExtent: 17,
      trailingAdornmentExtent: 39,
      height: 56,
      paddingX: 14,
      surfaceGap: 8,
      stackGap: 3,
      labelGap: 2,
      labelInsetX: 14,
      labelInactiveOffsetY: 16,
      labelFloatingOffsetY: -9,
      helperInsetX: 14,
      inputFontSize: 16,
      inputLineHeight: 23,
      inactiveLabelFontSize: 16,
      inactiveLabelLineHeight: 23,
      labelFontSize: 12,
      labelLineHeight: 17,
      messageFontSize: 12,
      messageLineHeight: 20,
      adornmentSize: 20,
    }),
  },
  radius: number("imported.shared.size-4", 4),
  typography: {
    input: fontSpec(
      "Roboto",
      "Regular",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputBase/InputBase.js",
      [
        { family: "Helvetica", style: "Regular" },
        { family: "Arial", style: "Regular" },
      ],
    ),
    label: fontSpec(
      "Roboto",
      "Regular",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputLabel/InputLabel.js",
      [
        { family: "Helvetica", style: "Regular" },
        { family: "Arial", style: "Regular" },
      ],
    ),
    message: fontSpec(
      "Roboto",
      "Regular",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/FormHelperText/FormHelperText.js",
      [
        { family: "Helvetica", style: "Regular" },
        { family: "Arial", style: "Regular" },
      ],
    ),
  },
};

const polarisTokens: Tokens = {
  states: {
    default: state("p.text-field.default", {
      background: "#fdfdfdff",
      border: "#8a8a8aff",
      input: "#303030ff",
      placeholder: "#616161ff",
      label: "#303030ff",
      message: "#616161ff",
      adornment: "#616161ff",
      requiredIndicator: "#8e1f0bff",
    }),
    focusVisible: state("p.text-field.focus-visible", {
      background: "#f7f7f7ff",
      border: "#1a1a1aff",
      input: "#303030ff",
      placeholder: "#616161ff",
      label: "#303030ff",
      message: "#616161ff",
      adornment: "#616161ff",
      requiredIndicator: "#8e1f0bff",
      ring: "#005bd3ff",
    }),
    error: state("p.text-field.error", {
      background: "#fee8ebff",
      border: "#8e1f0bff",
      input: "#303030ff",
      placeholder: "#616161ff",
      label: "#8e1f0bff",
      message: "#8e1f0bff",
      adornment: "#616161ff",
      requiredIndicator: "#8e1f0bff",
    }),
    disabled: state("p.text-field.disabled", {
      background: "#f2f2f2ff",
      border: "#00000000",
      borderWidth: 0,
      input: "#b5b5b5ff",
      placeholder: "#b5b5b5ff",
      label: "#b5b5b5ff",
      message: "#b5b5b5ff",
      adornment: "#616161ff",
      requiredIndicator: "#8e1f0bff",
    }),
  },
  sizes: {
    small: size("p.text-field.slim", {
      width: 211,
      minWidth: 160,
      leadingAdornmentExtent: 20,
      trailingAdornmentExtent: 25.78125,
      height: 28,
      paddingX: 12,
      surfaceGap: 4,
      stackGap: 4,
      labelGap: 4,
      labelInsetX: 0,
      labelInactiveOffsetY: 0,
      labelFloatingOffsetY: 0,
      helperInsetX: 0,
      inputFontSize: 16,
      inputLineHeight: 24,
      inactiveLabelFontSize: 13,
      inactiveLabelLineHeight: 20,
      labelFontSize: 13,
      labelLineHeight: 20,
      messageFontSize: 13,
      messageLineHeight: 20,
      adornmentSize: 16,
    }),
    medium: size("p.text-field.medium", {
      width: 211,
      minWidth: 160,
      leadingAdornmentExtent: 20,
      trailingAdornmentExtent: 25.78125,
      height: 36,
      paddingX: 12,
      surfaceGap: 4,
      stackGap: 4,
      labelGap: 4,
      labelInsetX: 0,
      labelInactiveOffsetY: 0,
      labelFloatingOffsetY: 0,
      helperInsetX: 0,
      inputFontSize: 16,
      inputLineHeight: 24,
      inactiveLabelFontSize: 13,
      inactiveLabelLineHeight: 20,
      labelFontSize: 13,
      labelLineHeight: 20,
      messageFontSize: 13,
      messageLineHeight: 20,
      adornmentSize: 20,
    }),
  },
  radius: number("p.border-radius-200", 8),
  typography: {
    input: fontSpec(
      "Inter",
      "Regular",
      "recipe/sandboxes/input-field-polaris/node_modules/@shopify/polaris/build/esm/components/TextField/TextField.out.css",
      [
        { family: "SF Pro", style: "Regular" },
        { family: "Segoe UI", style: "Regular" },
        { family: "Roboto", style: "Regular" },
        { family: "Helvetica Neue", style: "Regular" },
        { family: "Arial", style: "Regular" },
      ],
    ),
    label: fontSpec(
      "Inter",
      "Medium",
      "recipe/sandboxes/input-field-polaris/node_modules/@shopify/polaris/build/esm/components/Label/Label.js",
      [
        { family: "SF Pro", style: "Medium" },
        { family: "Segoe UI", style: "Semibold" },
        { family: "Arial", style: "Bold" },
      ],
    ),
    message: fontSpec(
      "Inter",
      "Regular",
      "recipe/sandboxes/input-field-polaris/node_modules/@shopify/polaris/build/esm/components/Labelled/Labelled.js",
      [
        { family: "SF Pro", style: "Regular" },
        { family: "Segoe UI", style: "Regular" },
        { family: "Arial", style: "Regular" },
      ],
    ),
  },
};

const muiStructure: InputFieldRecipeInstance["structure"] = {
  labelPlacement: "floating",
  floatingActivation: "focus-value-or-leading-adornment",
  outlineTreatment: "notched",
  helperPlacement: "content-inset",
  sizingPolicy: "adornment-additive",
  adornmentSizing: "intrinsic-extent",
  contentAlignment: "center",
};

const polarisStructure: InputFieldRecipeInstance["structure"] = {
  labelPlacement: "stacked",
  floatingActivation: "never",
  outlineTreatment: "plain",
  helperPlacement: "field-edge",
  sizingPolicy: "adornment-additive",
  adornmentSizing: "intrinsic-extent",
  contentAlignment: "center",
};

const muiLeadingPayload = textAdornment(
  "$",
  muiTokens.typography.input,
  "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputAdornment/InputAdornment.js:51-85,132-140; string child wrapped by Typography, centered, textSecondary, 8px end gap; zero-width translation guard excluded from content",
  color("imported.text-field.default.adornment-text", "#00000099"),
  { width: 9, height: 24 },
  "none",
);
const muiTrailingPayload = textAdornment(
  "USD",
  muiTokens.typography.input,
  "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputAdornment/InputAdornment.js:51-85,132-140; string child wrapped by Typography, centered, textSecondary, 8px start gap",
  color("imported.text-field.default.adornment-text", "#00000099"),
  { width: 31, height: 24 },
  "none",
);
const polarisLeadingPayload = textAdornment(
  "$",
  polarisTokens.typography.input,
  "recipe/sandboxes/input-field-polaris/node_modules/@shopify/polaris/build/esm/components/TextField/TextField.js:112-128,241-247; prefix rendered as Text bodyMd and included in input aria-labelledby",
  color("p.text-field.default.adornment-text", "#616161ff"),
  { width: 8, height: 20 },
  "labelledby-control",
);
const polarisTrailingPayload = textAdornment(
  "USD",
  polarisTokens.typography.input,
  "recipe/sandboxes/input-field-polaris/node_modules/@shopify/polaris/build/esm/components/TextField/TextField.js:121-128,241-247; suffix rendered as Text bodyMd and included in input aria-labelledby",
  color("p.text-field.default.adornment-text", "#616161ff"),
  { width: 25.78125, height: 20 },
  "labelledby-control",
);

const contractFact = (
  category: ReviewedInputFieldSourceFact["category"],
  channel: string,
  pointer: string,
  expected: unknown,
  landing: string,
): ReviewedInputFieldSourceFact => ({
  fact: { path: pointer, channel },
  category,
  source: { kind: "contract", pointer, expected },
  landing,
});
const reviewFact = (
  category: ReviewedInputFieldSourceFact["category"],
  channel: string,
  evidence: string,
  landing: string,
): ReviewedInputFieldSourceFact => ({
  fact: { path: evidence, channel },
  category,
  source: { kind: "review", evidence },
  landing,
});

const categoryForLanding = (
  landing: string,
): ReviewedInputFieldSourceFact["category"] => {
  if (landing.includes(".states.")) return "state";
  if (
    landing.includes("Font") ||
    landing.includes("LineHeight") ||
    landing.includes(".typography.")
  ) {
    return "typography";
  }
  if (
    landing.includes("background") ||
    landing.includes("border") ||
    landing.includes("Text") ||
    landing.includes("Indicator") ||
    landing.includes("effects")
  ) {
    return "fill";
  }
  return "geometry";
};

const exhaustiveReviewedFacts = (
  evidence: string,
  value: unknown,
  landing: string,
  facts: ReviewedInputFieldSourceFact[] = [],
): ReviewedInputFieldSourceFact[] => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    facts.push(
      reviewFact(
        categoryForLanding(landing),
        `reviewed-${landing}`,
        `${evidence}; measured field ${landing}`,
        landing,
      ),
    );
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push(
      reviewFact(
        categoryForLanding(landing),
        `reviewed-${landing}`,
        `${evidence}; measured token ${record.variable} at ${landing}`,
        landing,
      ),
    );
    return facts;
  }
  for (const [key, child] of Object.entries(record)) {
    exhaustiveReviewedFacts(evidence, child, `${landing}.${key}`, facts);
  }
  return facts;
};

const muiFacts = [
  contractFact(
    "geometry",
    "surface-width",
    "/anatomy/root/parts/inputbase-adornedend/tokens/width",
    "{imported.shared.size-252-969}",
    "tokens.sizes.medium.width",
  ),
  contractFact(
    "geometry",
    "surface-height",
    "/anatomy/root/parts/inputbase-adornedend/tokens/height",
    "{imported.text-field.inputbase-adornedend.height}",
    "tokens.sizes.medium.surfaceHeight",
  ),
  contractFact(
    "geometry",
    "padding-inline",
    "/anatomy/root/parts/inputbase-adornedend/tokens/padding-left",
    "{imported.shared.size-14}",
    "tokens.sizes.medium.paddingX",
  ),
  contractFact(
    "geometry",
    "radius",
    "/anatomy/root/parts/inputbase-adornedend/tokens/border-top-left-radius",
    "{imported.shared.size-4}",
    "tokens.radius",
  ),
  contractFact(
    "typography",
    "font-family",
    "/anatomy/root/parts/inputbase-adornedend/parts/inputbase-input/declared/font-family",
    "Roboto, Helvetica, Arial, sans-serif",
    "tokens.typography.input.requestedFamily",
  ),
  contractFact(
    "typography",
    "input-line-height",
    "/anatomy/root/parts/inputbase-adornedend/parts/inputbase-input/tokens/line-height",
    "{imported.shared.size-23}",
    "tokens.sizes.medium.inputLineHeight",
  ),
  contractFact(
    "fill",
    "input-text",
    "/anatomy/root/parts/inputbase-adornedend/parts/inputbase-input/tokens/color",
    "{imported.shared.color-000000de}",
    "tokens.states.default.inputText",
  ),
  contractFact(
    "fill",
    "error-border",
    "/anatomy/root/parts/inputbase-adornedend/parts/outlinedinput-notchedoutline/tokens/border-top-color",
    "{imported.shared.color-d32f2f}",
    "tokens.states.error.border",
  ),
  contractFact(
    "state",
    "error-label",
    "/anatomy/root/parts/label/tokens/color",
    "{imported.shared.color-d32f2f}",
    "tokens.states.error.labelText",
  ),
  reviewFact(
    "state",
    "focus-visible",
    "reviewed API mapping: focused=true on the pinned source component",
    "tokens.states.focusVisible.border",
  ),
  reviewFact(
    "state",
    "disabled-transparent-surface",
    "@mui/material@9.2.0 OutlinedInput.js disabled rule changes only the notched outline; independent disabled references retain a white surface",
    "tokens.states.disabled.background",
  ),
  reviewFact(
    "state",
    "disabled-adornment-text",
    "@mui/material@9.2.0 InputAdornment.js wraps string adornments in Typography color=textSecondary; independent references resolve RGB 102",
    "tokens.states.disabled.adornmentText",
  ),
  reviewFact(
    "state",
    "disabled-required-indicator",
    "@mui/material@9.2.0 FormLabel.js applies palette.text.disabled to the label and its inheriting asterisk",
    "tokens.states.disabled.requiredIndicatorText",
  ),
  reviewFact(
    "geometry",
    "inactive-floating-placeholder-visibility",
    "@mui/material@9.2.0 InputBase.js hides placeholder ink while InputLabel data-shrink=false, independent of error or disabled state",
    "structure.floatingActivation",
  ),
  contractFact(
    "semantics",
    "label-element",
    "/anatomy/root/parts/label/element",
    "label",
    "semantic.association",
  ),
  contractFact(
    "semantics",
    "input-element",
    "/anatomy/root/parts/inputbase-adornedend/parts/inputbase-input/element",
    "input",
    "semantic.control",
  ),
] as const;

const polarisInputPath =
  "/anatomy/root/parts/connected/parts/connected__item/parts/textfield/parts/input";
const polarisBackdropPath =
  "/anatomy/root/parts/connected/parts/connected__item/parts/textfield/parts/backdrop";
const polarisLabelPath =
  "/anatomy/root/parts/labelled__labelwrapper/parts/label/parts/label__text";
const polarisFacts = [
  contractFact(
    "geometry",
    "surface-height-medium",
    `${polarisInputPath}/tokensByProp/2/map/medium/height`,
    "{imported.text-field.input.height.medium}",
    "tokens.sizes.medium.surfaceHeight",
  ),
  contractFact(
    "geometry",
    "surface-height-slim",
    `${polarisInputPath}/tokensByProp/2/map/slim/height`,
    "{imported.text-field.input.height.slim}",
    "tokens.sizes.small.surfaceHeight",
  ),
  contractFact(
    "geometry",
    "padding-inline",
    `${polarisInputPath}/tokens/padding-inline`,
    "{p.space-300}",
    "tokens.sizes.medium.paddingX",
  ),
  contractFact(
    "geometry",
    "radius",
    `${polarisBackdropPath}/tokens/border-radius`,
    "{p.border-radius-200}",
    "tokens.radius",
  ),
  contractFact(
    "typography",
    "input-font-size",
    `${polarisInputPath}/tokens/font-size`,
    "{p.font-size-400}",
    "tokens.sizes.medium.inputFontSize",
  ),
  contractFact(
    "typography",
    "input-line-height",
    `${polarisInputPath}/tokens/line-height`,
    "{p.font-line-height-600}",
    "tokens.sizes.medium.inputLineHeight",
  ),
  contractFact(
    "fill",
    "input-text",
    `${polarisInputPath}/tokens/color`,
    "{p.color-text}",
    "tokens.states.default.inputText",
  ),
  contractFact(
    "fill",
    "surface-background",
    `${polarisBackdropPath}/tokens/background-color`,
    "{p.color-input-bg-surface}",
    "tokens.states.default.background",
  ),
  contractFact(
    "state",
    "disabled-text",
    `${polarisInputPath}/states/disabled/color`,
    "{p.color-text-disabled}",
    "tokens.states.disabled.inputText",
  ),
  contractFact(
    "state",
    "focus-surface",
    `${polarisBackdropPath}/states/focus-visible/background-color`,
    "{imported.text-field.backdrop.background-color-state-focus-visible}",
    "tokens.states.focusVisible.background",
  ),
  contractFact(
    "semantics",
    "label-element",
    `${polarisLabelPath}/element`,
    "label",
    "semantic.association",
  ),
  contractFact(
    "semantics",
    "input-element",
    `${polarisInputPath}/element`,
    "input",
    "semantic.control",
  ),
] as const;

const muiExhaustiveFacts = [
  ...exhaustiveReviewedFacts(
    "reviewed @mui/material@9.2.0 source anatomy plus immutable v1 original-source captures",
    muiTokens,
    "tokens",
  ),
  ...exhaustiveReviewedFacts(
    "reviewed MUI outlined label, notch, helper, sizing, and adornment anatomy",
    muiStructure,
    "structure",
  ),
  ...exhaustiveReviewedFacts(
    "reviewed @mui/material@9.2.0 InputAdornment and Typography source fixture",
    {
      leading: { payload: muiLeadingPayload },
      trailing: { payload: muiTrailingPayload },
    },
    "slots",
  ),
];
const polarisExhaustiveFacts = [
  ...exhaustiveReviewedFacts(
    "reviewed @shopify/polaris@13.9.5 source anatomy plus immutable v1 original-source captures at the pinned 600px viewport",
    polarisTokens,
    "tokens",
  ),
  ...exhaustiveReviewedFacts(
    "reviewed Polaris Labelled, TextField, Backdrop, helper, sizing, and adornment anatomy",
    polarisStructure,
    "structure",
  ),
  ...exhaustiveReviewedFacts(
    "reviewed @shopify/polaris@13.9.5 TextField prefix/suffix and Text bodyMd source fixture",
    {
      leading: { payload: polarisLeadingPayload },
      trailing: { payload: polarisTrailingPayload },
    },
    "slots",
  ),
];

const selection = (source: string, mappings: number) => ({
  candidates: [{ id: "input-field", version: 1 }],
  selectedBy: "recipe-pivot-input-field-review",
  mechanism: "reviewed-config" as const,
  source,
  reviewedAt: "2026-08-26T00:00:00.000Z",
  manualCost: {
    value: mappings,
    unit: "reviewed-mapping" as const,
    note: `${mappings} explicit source-to-input-field@1 mappings; no name inference`,
  },
});

const commonMappings = [
  "source archetype→input-field@1",
  "small source size→Size=small",
  "medium source size→Size=medium",
  "default/focus-visible/error/disabled→State",
  "empty/value presentation→Content",
  "required indicator→Required",
  "leading/trailing source composition→Adornments",
  "label/placeholder/value/helper/error→text edit properties",
] as const;

const muiMappings = [
  ...commonMappings,
  ...muiFacts.map((fact) => `${fact.fact.channel}→${fact.landing}`),
  ...muiExhaustiveFacts.map((fact) => `${fact.fact.channel}→${fact.landing}`),
];
const polarisMappings = [
  ...commonMappings,
  ...polarisFacts.map((fact) => `${fact.fact.channel}→${fact.landing}`),
  ...polarisExhaustiveFacts.map(
    (fact) => `${fact.fact.channel}→${fact.landing}`,
  ),
];

export const muiInputFieldAdapterConfig: ReviewedInputFieldAdapterConfig = {
  sourcePath: "examples/mui/contracts/text-field.contract.json",
  generatedAt: "2026-08-26T00:00:00.000Z",
  selection: selection(
    "recipe/fixtures/library-input-fields.ts#muiInputFieldAdapterConfig",
    muiMappings.length,
  ),
  parameters: muiTokens,
  structure: muiStructure,
  size: {
    sourceProp: "size",
    sourceValues: { small: "small", medium: "medium" },
    default: "medium",
  },
  content: {
    label: "Amount",
    placeholder: "Enter an amount",
    value: "125.00",
    helper: "Enter a valid amount",
    error: "Amount is invalid",
  },
  slots: {
    leadingComponentRef: "source/input-adornment/start",
    trailingComponentRef: "source/input-adornment/end",
    leadingPayload: muiLeadingPayload,
    trailingPayload: muiTrailingPayload,
  },
  sourceFacts: [...muiFacts, ...muiExhaustiveFacts],
  manualMappings: muiMappings,
  benchmark: {
    packageName: "@mui/material",
    version: "9.2.0",
    exportName: "TextField",
    importPath: "@mui/material",
    wrapper: "ThemeProvider(createTheme({ cssVariables: true }))",
    setupSeconds: 780,
    sizeMap: { small: "small", medium: "medium" },
    stateMap: {
      default: {},
      "focus-visible": { focused: true },
      error: { error: true },
      disabled: { disabled: true },
    },
    contentMap: {
      placeholder: { value: "", placeholder: "Enter an amount" },
      value: { value: "125.00", placeholder: "Enter an amount" },
    },
    adornmentMap: {
      leading: {
        propPath: "slotProps.input.startAdornment",
        fixture: "InputAdornment(position=start, text=$)",
      },
      trailing: {
        propPath: "slotProps.input.endAdornment",
        fixture: "InputAdornment(position=end, text=USD)",
      },
    },
    requiredMap: { required: true },
    unsupportedCells: [
      "filled and standard source variants are outside input-field@1",
      "multiline, select, and native non-text input types are outside input-field@1",
      "hover and pressed are not recipe state values",
    ],
    captureCommand:
      "npx tsx extract/computed/run.ts extract/computed/configs/mui.json --keep-originals",
  },
};

export const polarisInputFieldAdapterConfig: ReviewedInputFieldAdapterConfig = {
  sourcePath: "examples/polaris/contracts/text-field.contract.json",
  generatedAt: "2026-08-26T00:00:00.000Z",
  selection: selection(
    "recipe/fixtures/library-input-fields.ts#polarisInputFieldAdapterConfig",
    polarisMappings.length,
  ),
  parameters: polarisTokens,
  structure: polarisStructure,
  size: {
    sourceProp: "size",
    sourceValues: { small: "slim", medium: "medium" },
    default: "medium",
  },
  content: {
    label: "Store name",
    placeholder: "Enter a store name",
    value: "Jaded Pixel",
    helper: "Shown to customers.",
    error: "Store name is required",
  },
  slots: {
    leadingComponentRef: "source/text-field/prefix",
    trailingComponentRef: "source/text-field/suffix",
    leadingPayload: polarisLeadingPayload,
    trailingPayload: polarisTrailingPayload,
  },
  sourceFacts: [...polarisFacts, ...polarisExhaustiveFacts],
  manualMappings: polarisMappings,
  benchmark: {
    packageName: "@shopify/polaris",
    version: "13.9.5",
    exportName: "TextField",
    importPath: "@shopify/polaris",
    wrapper: "AppProvider(i18n=en)",
    setupSeconds: 660,
    sizeMap: { small: "slim", medium: "medium" },
    stateMap: {
      default: {},
      "focus-visible": { focused: true },
      error: { error: "Store name is required" },
      disabled: { disabled: true },
    },
    contentMap: {
      placeholder: { value: "", placeholder: "Enter a store name" },
      value: { value: "Jaded Pixel", placeholder: "Enter a store name" },
    },
    adornmentMap: {
      leading: { propPath: "prefix", fixture: "$" },
      trailing: { propPath: "suffix", fixture: "USD" },
    },
    requiredMap: { requiredIndicator: true },
    unsupportedCells: [
      "borderless, multiline, suggestion, and autoSize are outside input-field@1",
      "clearButton and loading are outside the two adornment slots",
      "hover and active are not recipe state values",
    ],
    captureCommand:
      "npx tsx extract/computed/run.ts extract/computed/configs/polaris.json --keep-originals",
  },
};
