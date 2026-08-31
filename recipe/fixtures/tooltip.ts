import type {
  TooltipColorParameter,
  TooltipFontSpec,
  TooltipNumberParameter,
  TooltipRecipeInstance,
} from "../recipes/tooltip.js";

const number = (
  variable: string,
  fallback: number,
): TooltipNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): TooltipColorParameter => ({ variable, fallback });
const font = (family: string, style: string): TooltipFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/tooltip.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

export const canonicalTooltipRecipeInstance = {
  identity: { id: "ds.tooltip", name: "Tooltip" },
  semantic: { root: "tooltip", control: "tooltip", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { label: "Tooltip" },
  tokens: {
    box: {
      height: number("ds.tooltip.box-height", 0),
      paddingX: number("ds.tooltip.box-paddingX", 8),
      paddingY: number("ds.tooltip.box-paddingY", 4),
      radius: number("ds.tooltip.box-radius", 4),
      borderWidth: number("ds.tooltip.box-borderWidth", 0),
    },
    labelFontSize: number("ds.tooltip.labelFontSize", 14),
    labelLineHeight: number("ds.tooltip.labelLineHeight", 20),
    lineHeightUnit: "px",
    decoration: "none",
    strokeAlign: "inside",
    rest: {
      boxFill: color("ds.tooltip.rest-boxFill", "#0a1317ff"),
      boxBorder: color("ds.tooltip.rest-boxBorder", "#00000000"),
      boxOpacity: number("ds.tooltip.rest-boxOpacity", 1),
      label: color("ds.tooltip.rest-label", "#ffffffff"),
    },
    typography: { label: font("Roboto", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/tooltip.ts",
    tool: "tooltip@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "tooltip", version: 1 }],
      selectedBy: "recipe-pivot-tooltip-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/tooltip.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies TooltipRecipeInstance;
