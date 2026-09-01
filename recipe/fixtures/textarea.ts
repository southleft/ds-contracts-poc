import type {
  TextareaColorParameter,
  TextareaFontSpec,
  TextareaNumberParameter,
  TextareaRecipeInstance,
} from "../recipes/textarea.js";

const number = (
  variable: string,
  fallback: number,
): TextareaNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): TextareaColorParameter => ({ variable, fallback });
const font = (family: string, style: string): TextareaFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/textarea.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

const cell = (
  prefix: string,
  content: string,
  arm: string,
  boxFill: `#${string}`,
  boxBorder: `#${string}`,
  boxOpacity: number,
  label: `#${string}`,
  value: `#${string}`,
) => ({
  boxFill: color(`${prefix}.states-${content}-${arm}-boxFill`, boxFill),
  boxBorder: color(`${prefix}.states-${content}-${arm}-boxBorder`, boxBorder),
  boxOpacity: number(
    `${prefix}.states-${content}-${arm}-boxOpacity`,
    boxOpacity,
  ),
  label: color(`${prefix}.states-${content}-${arm}-label`, label),
  value: color(`${prefix}.states-${content}-${arm}-value`, value),
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. These numbers are the clone source, not a fourth library.
 */
export const canonicalTextareaRecipeInstance = {
  identity: { id: "ds.textarea", name: "Textarea" },
  semantic: { root: "textarea", control: "textarea", label: "label" },
  axes: {
    disabled: {
      name: "Disabled",
      values: ["false", "true"],
      default: "false",
    },
    content: {
      name: "Content",
      values: ["empty", "focus", "value"],
      default: "empty",
    },
  },
  content: {
    label: "Notes",
    placeholder: "Add a note",
    value: "Meeting notes for Tuesday.",
  },
  tokens: {
    box: {
      height: number("ds.textarea.box-height", 70),
      paddingX: number("ds.textarea.box-paddingX", 8),
      paddingY: number("ds.textarea.box-paddingY", 4),
      radius: number("ds.textarea.box-radius", 8),
      borderWidth: number("ds.textarea.box-borderWidth", 1),
      rows: number("ds.textarea.box-rows", 3),
      lineHeight: number("ds.textarea.box-lineHeight", 20),
    },
    labelGap: number("ds.textarea.labelGap", 4),
    labelFontSize: number("ds.textarea.labelFontSize", 14),
    valueFontSize: number("ds.textarea.valueFontSize", 14),
    labelPlacement: "stacked",
    outlineTreatment: "plain",
    labelInsetX: number("ds.textarea.labelInsetX", 0),
    labelInactiveOffsetY: number("ds.textarea.labelInactiveOffsetY", 0),
    labelFloatingOffsetY: number("ds.textarea.labelFloatingOffsetY", 0),
    floatingLabelFontSize: number("ds.textarea.floatingLabelFontSize", 14),
    notchFill: color("ds.textarea.notchFill", "#00000000"),
    strokeAlign: "inside",
    boxClips: true,
    states: {
      empty: {
        enabled: cell(
          "ds.textarea",
          "empty",
          "enabled",
          "#ffffffff",
          "#ccd3dbff",
          1,
          "#4e606fff",
          "#4e606fff",
        ),
        disabled: cell(
          "ds.textarea",
          "empty",
          "disabled",
          "#ffffffff",
          "#ccd3dbff",
          0.5,
          "#a4b0bcff",
          "#4e606fff",
        ),
      },
      value: {
        enabled: cell(
          "ds.textarea",
          "value",
          "enabled",
          "#ffffffff",
          "#ccd3dbff",
          1,
          "#4e606fff",
          "#0a1317ff",
        ),
        disabled: cell(
          "ds.textarea",
          "value",
          "disabled",
          "#ffffffff",
          "#ccd3dbff",
          0.5,
          "#a4b0bcff",
          "#0a1317ff",
        ),
      },
    },
    typography: {
      label: font("Arial", "Regular"),
      value: font("Arial", "Regular"),
    },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/textarea.ts",
    tool: "textarea@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "textarea", version: 1 }],
      selectedBy: "recipe-pivot-textarea-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/textarea.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "canonical skeleton; library proofs overwrite tokens",
      },
    },
  },
} as const satisfies TextareaRecipeInstance;
