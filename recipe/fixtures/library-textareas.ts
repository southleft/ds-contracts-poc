import type {
  ReviewedTextareaAdapterConfig,
  ReviewedTextareaSource,
  ReviewedTextareaSourceFact,
  TextareaFactCategory,
} from "../adapters/textarea.js";
import { canonicalTextareaRecipeInstance } from "./textarea.js";
import { bareLabelFont, type TextareaRecipeInstance } from "../recipes/textarea.js";

export const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): TextareaRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalTextareaRecipeInstance.tokens,
  ) as TextareaRecipeInstance["tokens"];
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      record.variable = `${prefix}.${path.replaceAll(".", "-")}`;
      record.fallback = mutate(path, record.fallback);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  return tokens;
};

const ASTRYX_BODY_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const astryxLabelFont = (): TextareaRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  requestSource:
    "@astryxdesign/core/src/Field/FieldLabel.tsx styles.label fontFamily --font-family-body, fontWeight --font-weight-medium",
  fallbackChain: [
    { family: "-apple-system", style: "Medium" },
    { family: "SF Pro", style: "Medium" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Medium",
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK}; Figma cannot load a CSS stack; first named host font is SF Pro Medium`,
});

const astryxValueFont = (): TextareaRecipeInstance["tokens"]["typography"]["value"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "@astryxdesign/core/src/TextArea/TextArea.tsx styles.textarea fontFamily --font-family-body, --text-body-size",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK}; Figma cannot load a CSS stack; first named host font is SF Pro Regular`,
});

const muiFont = (): TextareaRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body1 fontFamily Roboto, fontWeightRegular 400, size 16",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdFont = (): TextareaRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica Neue", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  degradation:
    "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular",
});

/**
 * Astryx TextArea.tsx rows=3; inputWrapperStyles.base paddingBlock --spacing-1 4,
 * paddingInline --spacing-2 8, border --border-width 1, radius --radius-element 8.
 * --text-body-size 14 / --text-body-leading 1.4286 → 20. Height 3*20+4*2+1*2 = 70.
 */
const astryxTokens = cloneTokens("astryx.textarea", (path, fallback) => {
  if (path === "box.height") return 70;
  if (path === "box.paddingX") return 8;
  if (path === "box.paddingY") return 4;
  if (path === "box.radius") return 8;
  if (path === "box.borderWidth") return 1;
  if (path === "box.rows") return 3;
  if (path === "box.lineHeight") return 20;
  if (path === "labelGap") return 4;
  if (path === "labelFontSize") return 14;
  // FieldLabel.tsx line-height 20 (--line-height-body-sm); the v10 remint carries it (the mint was 2px short of the render before)
  if (path === "labelLineHeight") return 20;
  if (path === "valueFontSize") return 14;
  if (path === "labelInsetX") return 0;
  if (path === "labelInactiveOffsetY") return 0;
  if (path === "labelFloatingOffsetY") return 0;
  if (path === "floatingLabelFontSize") return 14;
  if (path === "notchFill") return "#00000000";
  if (path === "states.empty.enabled.boxFill") return "#ffffffff";
  if (path === "states.empty.enabled.boxBorder") return "#ccd3dbff";
  if (path === "states.empty.enabled.boxOpacity") return 1;
  if (path === "states.empty.enabled.label") return "#4e606fff";
  if (path === "states.empty.enabled.value") return "#4e606fff";
  if (path === "states.empty.disabled.boxFill") return "#ffffffff";
  if (path === "states.empty.disabled.boxBorder") return "#ccd3dbff";
  if (path === "states.empty.disabled.boxOpacity") return 0.5;
  if (path === "states.empty.disabled.label") return "#a4b0bcff";
  if (path === "states.empty.disabled.value") return "#4e606fff";
  if (path === "states.value.enabled.boxFill") return "#ffffffff";
  if (path === "states.value.enabled.boxBorder") return "#ccd3dbff";
  if (path === "states.value.enabled.boxOpacity") return 1;
  if (path === "states.value.enabled.label") return "#4e606fff";
  if (path === "states.value.enabled.value") return "#0a1317ff";
  if (path === "states.value.disabled.boxFill") return "#ffffffff";
  if (path === "states.value.disabled.boxBorder") return "#ccd3dbff";
  if (path === "states.value.disabled.boxOpacity") return 0.5;
  if (path === "states.value.disabled.label") return "#a4b0bcff";
  if (path === "states.value.disabled.value") return "#0a1317ff";
  return fallback;
});
astryxTokens.strokeAlign = "inside";
astryxTokens.boxClips = true;
astryxTokens.labelPlacement = "stacked";
astryxTokens.labelLineHeightUnit = "px";
astryxTokens.outlineTreatment = "plain";
astryxTokens.typography = { label: astryxLabelFont(), value: astryxValueFont() };

/**
 * MUI has no Textarea.js. Compile TextField outlined multiline + InputBase +
 * TextareaAutosize. minRows default 1. InputBase lineHeight 1.4375em = 23.
 * OutlinedInput multiline padding 16.5px 14px. Height 23+16.5*2 = 56.
 * shape.borderRadius 4. Do not invent minRows 3.
 */
const muiTokens = cloneTokens("mui.textarea", (path, fallback) => {
  if (path === "box.height") return 56;
  if (path === "box.paddingX") return 14;
  if (path === "box.paddingY") return 16.5;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 1;
  if (path === "box.rows") return 1;
  if (path === "box.lineHeight") return 23;
  if (path === "labelGap") return 0;
  if (path === "labelFontSize") return 16;
  // InputLabel lineHeight 1.4375em = 23px at 16 (createTypography body1); the floating offsets were reviewed against this line box
  if (path === "labelLineHeight") return 23;
  if (path === "valueFontSize") return 16;
  if (path === "labelInsetX") return 14;
  if (path === "labelInactiveOffsetY") return 16;
  if (path === "labelFloatingOffsetY") return -9;
  if (path === "floatingLabelFontSize") return 12;
  if (path === "notchFill") return "#ffffffff";
  if (path === "states.empty.enabled.boxFill") return "#00000000";
  if (path === "states.empty.enabled.boxBorder") return "#0000003b";
  if (path === "states.empty.enabled.boxOpacity") return 1;
  if (path === "states.empty.enabled.label") return "#00000099";
  if (path === "states.empty.enabled.value") return "#0000005d";
  if (path === "states.empty.disabled.boxFill") return "#00000000";
  if (path === "states.empty.disabled.boxBorder") return "#00000042";
  if (path === "states.empty.disabled.boxOpacity") return 1;
  if (path === "states.empty.disabled.label") return "#00000061";
  if (path === "states.empty.disabled.value") return "#00000061";
  if (path === "states.value.enabled.boxFill") return "#00000000";
  if (path === "states.value.enabled.boxBorder") return "#0000003b";
  if (path === "states.value.enabled.boxOpacity") return 1;
  if (path === "states.value.enabled.label") return "#00000099";
  if (path === "states.value.enabled.value") return "#000000de";
  if (path === "states.value.disabled.boxFill") return "#00000000";
  if (path === "states.value.disabled.boxBorder") return "#00000042";
  if (path === "states.value.disabled.boxOpacity") return 1;
  if (path === "states.value.disabled.label") return "#00000061";
  if (path === "states.value.disabled.value") return "#00000061";
  return fallback;
});
// INSIDE (corrected 2026-09-02): the notched-outline fieldset overlays the
// input root exactly — its border-box width equals the root's (188) and its
// top border runs through the legend's centre, at the root's top edge — so the
// visible outline lies inside the 56px box. Drawn outside, Figma rendered 58.
muiTokens.strokeAlign = "inside";
muiTokens.boxClips = true;
muiTokens.labelPlacement = "floating";
muiTokens.labelLineHeightUnit = "px";
muiTokens.outlineTreatment = "notched";
muiTokens.typography = { label: muiFont(), value: muiFont() };

/**
 * antd Input.TextArea wraps rc-textarea with no rows default. HTML textarea
 * rows default is 2 (WHATWG). paddingBlock (32-22)/2-1 = 4; paddingInline
 * 12-1 = 11. lineHeight 14*1.5714285714285714 = 22. Height 2*22+4*2+1*2 = 54.
 * minHeight controlHeight 32 does not win.
 */
const antdTokens = cloneTokens("antd.textarea", (path, fallback) => {
  if (path === "box.height") return 54;
  if (path === "box.paddingX") return 11;
  if (path === "box.paddingY") return 4;
  if (path === "box.radius") return 6;
  if (path === "box.borderWidth") return 1;
  if (path === "box.rows") return 2;
  if (path === "box.lineHeight") return 22;
  // BARE CELL (2026-09-02): antd TextArea renders NO label (the hand table had
  // cited one, and the fidelity gate named the row for it) — every label leaf
  // is the recipe's bare spelling, as the proposed module from the capture reads.
  if (path === "labelGap") return 0;
  if (path === "labelFontSize") return 0;
  if (path === "valueFontSize") return 14;
  if (path === "labelInsetX") return 0;
  if (path === "labelInactiveOffsetY") return 0;
  if (path === "labelFloatingOffsetY") return 0;
  if (path === "floatingLabelFontSize") return 0;
  if (path === "notchFill") return "#00000000";
  if (path === "states.empty.enabled.boxFill") return "#ffffffff";
  if (path === "states.empty.enabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.empty.enabled.boxOpacity") return 1;
  if (path === "states.empty.enabled.label") return "#00000000";
  if (path === "states.empty.enabled.value") return "#00000040";
  if (path === "states.empty.disabled.boxFill") return "#0000000a";
  if (path === "states.empty.disabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.empty.disabled.boxOpacity") return 1;
  if (path === "states.empty.disabled.label") return "#00000000";
  if (path === "states.empty.disabled.value") return "#00000040";
  if (path === "states.value.enabled.boxFill") return "#ffffffff";
  if (path === "states.value.enabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.value.enabled.boxOpacity") return 1;
  if (path === "states.value.enabled.label") return "#00000000";
  if (path === "states.value.enabled.value") return "#000000e0";
  if (path === "states.value.disabled.boxFill") return "#0000000a";
  if (path === "states.value.disabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.value.disabled.boxOpacity") return 1;
  if (path === "states.value.disabled.label") return "#00000000";
  if (path === "states.value.disabled.value") return "#00000040";
  return fallback;
});
antdTokens.strokeAlign = "inside";
antdTokens.labelLineHeightUnit = "auto";
antdTokens.boxClips = true;
antdTokens.labelPlacement = "stacked";
antdTokens.outlineTreatment = "plain";
antdTokens.typography = { label: bareLabelFont(), value: antdFont() };

export const astryxTextareaSource: ReviewedTextareaSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "TextArea",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TextArea",
  anatomy: {
    root: "TextArea.tsx Field + inputWrapperStyles.base + styles.wrapper align flex-start paddingBlock --spacing-1; Field containerGap --spacing-1",
    control:
      "rows default 3; textarea padding 0; wrapper paddingBlock 4 paddingInline 8 border 1 radius --radius-element 8; height 3*20+8+2 = 70; box-sizing border-box",
    value:
      "styles.textarea --text-body-size 14 / --text-body-leading 1.4286 → 20; color --color-text-primary; ::placeholder --color-text-secondary; disabled wrapper opacity 0.5",
    label:
      "FieldLabel required; --text-label-size 14 / --font-weight-medium / --color-text-secondary; example label Notes",
  },
  api: {
    rows: "number; default 3",
    isDisabled: "boolean",
    extras: "counter, startIcon, status, isLoading, disabledMessage receipted",
  },
  styleSources: [
    "TextArea.tsx styles.wrapper / textarea / textareaSizeStyles.md empty",
    "Field/inputStyles.stylex.ts inputWrapperStyles.base + disabled",
    "src/theme/tokens.stylex.ts light half --color-background-surface #FFFFFF, --color-border-emphasized #CCD3DB, --color-text-primary #0A1317, --color-text-secondary #4E606F, --color-text-disabled #A4B0BC, --radius-element 8px, --spacing-1 4px, --spacing-2 8px, --border-width 1px, --text-body-leading 1.4286",
  ],
  fontSources: [
    "FieldLabel.tsx --font-family-body system stack Medium 14; TextArea.tsx body Regular 14",
  ],
};

export const muiTextareaSource: ReviewedTextareaSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "TextField",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/TextField",
  anatomy: {
    root: "No Textarea.js. TextField.js variant outlined default, multiline forwarded to OutlinedInput. InputLabel outlined rest translate(14px, 16px) scale(1); shrink translate(14px, -9px) scale(0.75). NotchedOutline knockout is --palette-background-paper.",
    control:
      "OutlinedInput.js multiline root padding 16.5px 14px; input padding 0. TextareaAutosize.js minRows=1. InputBase.js lineHeight 1.4375em 23px. Height 23+33=56. shape.borderRadius 4 from @mui/system/createTheme/shape.js",
    value:
      "palette.text.primary #000000de; placeholder currentColor opacity 0.42 → #0000005d; disabled palette.text.disabled #00000061. Outline rgba(0,0,0,0.23) / action.disabled",
    label:
      "InputLabel.js outlined rest 16 / shrink 12 (16×0.75); palette.text.secondary #00000099; notch fill --palette-background-paper #fff",
  },
  api: {
    multiline: "true for this compile",
    disabled: "boolean",
    extras: "minRows/rows/maxRows forwarded; TextareaAutosize default minRows 1; do not invent 3",
  },
  styleSources: [
    "TextField.js default variant outlined, multiline false until this path",
    "InputBase.js lineHeight 1.4375em, placeholder opacity 0.42 light, multiline input height auto padding 0",
    "TextareaAutosize.js minRows = 1",
    "OutlinedInput.js multiline padding 16.5px 14px",
    "@mui/system/createTheme/shape.js borderRadius 4",
  ],
  fontSources: ["createTypography.js body1 Roboto Regular 16"],
};

export const antdTextareaSource: ReviewedTextareaSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Input.TextArea",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/input",
  anatomy: {
    root: "TextArea.js wraps rc-textarea; no rows in the AntD wrapper. HTML textarea rows default 2",
    control:
      "style/textarea.js minHeight controlHeight 32, height auto, resize vertical. initComponentToken paddingBlock 4 paddingInline 11. Height 2*22+8+2 = 54. --border-radius 6",
    value:
      "--color-text rgba(0,0,0,0.88); --color-text-placeholder rgba(0,0,0,0.25); disabled --color-text-disabled + --color-bg-container-disabled",
    label:
      "no required label on TextArea; reviewed pairing like Checkbox uses --padding-xs 8 and --color-text",
  },
  api: {
    disabled: "boolean",
    extras: "showCount, allowClear, autoSize, status, resize, SM/LG receipted",
  },
  styleSources: [
    "antd/es/input/TextArea.js",
    "antd/es/input/style/textarea.js minHeight token.controlHeight",
    "antd/es/input/style/token.js initComponentToken paddingBlock / paddingInline",
    "examples/antd/tokens/antd.vars.css --control-height 32px, --padding-sm 12px, --line-width 1px, --border-radius 6px, --color-border #d9d9d9, --color-bg-container #ffffff, --color-text rgba(0,0,0,0.88), --color-text-placeholder rgba(0,0,0,0.25), --color-bg-container-disabled rgba(0,0,0,0.04), --padding-xs 8px",
  ],
  fontSources: [
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  ],
};

const categoryForToken = (path: string): TextareaFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("boxOpacity")) return "state";
  if (
    path.includes("boxFill") ||
    path.includes("boxBorder") ||
    path.includes("notchFill") ||
    path.endsWith(".label") ||
    path.endsWith(".value") ||
    path.includes("states")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedTextareaSourceFact[] = [],
): ReviewedTextareaSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.strokeAlign" ||
      path === "tokens.boxClips" ||
      path === "tokens.labelPlacement" ||
      path === "tokens.outlineTreatment" ||
      path === "tokens.labelLineHeightUnit"
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category:
          path === "tokens.strokeAlign" ||
          path === "tokens.boxClips" ||
          path === "tokens.labelPlacement" ||
          path === "tokens.outlineTreatment" ||
          path === "tokens.labelLineHeightUnit"
            ? "anatomy"
            : "typography",
        source: {
          kind: "review",
          evidence: `${evidence}; reviewed ${path}=${String(value)}`,
        },
        disposition: "ir",
        target: path,
      });
    }
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push({
      occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
      category: categoryForToken(path),
      source: {
        kind: "review",
        evidence: `${evidence}; reviewed ${record.variable}=${record.fallback}`,
      },
      disposition: "ir",
      target: path,
    });
    return facts;
  }
  for (const [key, child] of Object.entries(record))
    tokenFacts(sourceSlug, evidence, child, `${path}.${key}`, facts);
  return facts;
};

const sharedContent = {
  label: "Notes",
  placeholder: "Add a note",
  value: "Meeting notes for Tuesday.",
} as const;

export const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedTextareaSourceFact[] =>
  rows.map((row) => ({
    occurrenceId: `${slug}-${row.id}`,
    category: "refusal" as const,
    source: { kind: "review" as const, evidence: row.evidence },
    disposition: "refusal" as const,
    target: row.target,
    receiptReason: row.reason,
  }));

const astryxRefusals = makeRefusals("astryx", [
  {
    id: "refusal-counter",
    evidence: "TextArea.tsx character counter — Astryx-only, not a shared axis",
    target: "Astryx character counter",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-start-icon",
    evidence: "TextArea.tsx startIcon — Astryx-only",
    target: "Astryx startIcon",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-status",
    evidence: "inputStatusBorderStyles warning/error — not a shared axis",
    target: "Astryx status variants",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover-focus",
    evidence:
      "inputWrapperStyles hover inset color-mix and focus-within ring — Button already taught rings",
    target: "Astryx hover inset / focus ring",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-resize",
    evidence: "native textarea resize vertical — no Figma primitive",
    target: "Astryx resize handle",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-dark",
    evidence: "tokens.stylex.ts light-dark pairs; textarea@1 carries the light half",
    target: "dark half of every light-dark() colour pair",
    reason: "lowered",
  },
  {
    id: "refusal-size-lg",
    evidence:
      "textareaSizeStyles.lg adds paddingBlock --spacing-2; size is not a shared axis",
    target: "Astryx size lg",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-no-textarea-export",
    evidence:
      "@mui/material@9.2.0 has no Textarea.js; this compile is TextField multiline + OutlinedInput + InputBase + TextareaAutosize, not an invented Textarea export",
    target: "MUI standalone Textarea export",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-fieldset-legend",
    evidence:
      "OutlinedInput NotchedOutline is a fieldset/legend gap; compile uses the Input-stay label-row knockout (paper fill) rather than a fieldset primitive. Do not remint Input stay 115:295378",
    target: "MUI NotchedOutline fieldset/legend",
    reason: "lowered",
  },
  {
    id: "refusal-minrows-match",
    evidence:
      "TextareaAutosize minRows default 1; inventing minRows 3 to match Astryx is refused",
    target: "MUI minRows invented as 3",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-standard-filled",
    evidence: "TextField variant default outlined; standard/filled receipted",
    target: "MUI variant standard/filled",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-helper",
    evidence: "FormHelperText / error — not this teaching",
    target: "MUI helper text",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-focus-ring",
    evidence:
      "OutlinedInput focus is 2px palette.primary.main; Content=focus is the named shrink/placeholder column only (InputLabel.js:197-199). Do not invent a focus ring token",
    target: "MUI outlined 2px primary focus ring",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-show-count",
    evidence: "Input.TextArea showCount — AntD-only",
    target: "AntD showCount",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-allow-clear",
    evidence: "allowClear — AntD-only",
    target: "AntD allowClear",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-autosize",
    evidence: "autoSize / rc-textarea calculateNodeHeight — not this teaching",
    target: "AntD autoSize",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-status",
    evidence: "status error/warning — not a shared axis",
    target: "AntD status",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-resize",
    evidence: "style/textarea.js resize vertical — no Figma primitive",
    target: "AntD resize handle",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-size",
    evidence: "SM/LG padding tokens — size is not a shared axis",
    target: "AntD size SM/LG",
    reason: "refused-by-recipe",
  },
]);

export const buildConfig = (
  slug: string,
  source: ReviewedTextareaSource,
  tokens: TextareaRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedTextareaSourceFact[],
  extraIr: ReviewedTextareaSourceFact[],
  unsupported: string[],
  // A proposed fixture passes the captured label/value and the config's
  // placeholder; the hand tables keep the shared Notes/Add a note pairing.
  content: TextareaRecipeInstance["content"] = sharedContent,
): ReviewedTextareaAdapterConfig => {
  const facts = [
    ...tokenFacts(
      slug,
      `${source.packageName} ${source.exportName} source review`,
      tokens,
    ),
    ...extraIr,
    ...refusals,
  ];
  const manualMappings = facts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath: `recipe/fixtures/library-textareas.ts#${slug}TextareaAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "textarea", version: 1 }],
      selectedBy: "recipe-pivot-textarea-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-textareas.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: structuredClone(content),
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} control + label`,
      setupSeconds: 12,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: 6,
      unsupportedCells: unsupported,
      captureCommand:
        "deferred: source references must be rendered in a separately authorized matched-benchmark task",
      renderedReferences: false,
      graded: false,
    },
  };
};

export const anatomyFacts = (
  slug: string,
  source: ReviewedTextareaSource,
): ReviewedTextareaSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-label`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.label",
  },
];

export const astryxTextareaAdapterConfig = buildConfig(
  "astryx",
  astryxTextareaSource,
  astryxTokens,
  { id: "astryx.textarea", name: "Astryx TextArea" },
  astryxRefusals,
  anatomyFacts("astryx", astryxTextareaSource),
  ["counter", "startIcon", "status", "hover", "focus-visible", "size-lg", "resize"],
);

export const muiTextareaAdapterConfig = buildConfig(
  "mui",
  muiTextareaSource,
  muiTokens,
  { id: "mui.textarea", name: "MUI TextField multiline" },
  muiRefusals,
  anatomyFacts("mui", muiTextareaSource),
  [
    "standalone-Textarea",
    "floating-notch",
    "minRows-3",
    "variant-standard",
    "helper-text",
  ],
);

export const antdTextareaAdapterConfig = buildConfig(
  "antd",
  antdTextareaSource,
  antdTokens,
  { id: "antd.textarea", name: "Ant Design TextArea" },
  antdRefusals,
  anatomyFacts("antd", antdTextareaSource),
  ["showCount", "allowClear", "autoSize", "status", "resize", "size-sm-lg"],
  { ...sharedContent, label: null },
);

export const TEXTAREA_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "textarea-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 6,
  totalCells: 18,
  sources: [
    "@astryxdesign/core@0.1.6#TextArea",
    "@mui/material@9.2.0#TextField multiline",
    "antd@5.29.3#Input.TextArea",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
