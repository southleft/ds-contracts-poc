import type {
  ChipColorParameter,
  ChipFontSpec,
  ChipNumberParameter,
  ChipRecipeInstance,
} from "../recipes/chip.js";

const number = (
  variable: string,
  fallback: number,
): ChipNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): ChipColorParameter => ({ variable, fallback });
const font = (family: string, style: string): ChipFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/chip.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. Not a fourth library.
 */
export const canonicalChipRecipeInstance = {
  identity: { id: "ds.chip", name: "Chip" },
  semantic: { root: "chip", control: "chip", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { label: "Tag" },
  tokens: {
    box: {
      height: number("ds.chip.box-height", 24),
      paddingX: number("ds.chip.box-paddingX", 8),
      paddingY: number("ds.chip.box-paddingY", 0),
      radius: number("ds.chip.box-radius", 4),
      borderWidth: number("ds.chip.box-borderWidth", 0),
    },
    labelFontSize: number("ds.chip.labelFontSize", 12),
    labelLineHeight: number("ds.chip.labelLineHeight", 20),
    strokeAlign: "inside",
    rest: {
      boxFill: color("ds.chip.rest-boxFill", "#0536591a"),
      boxBorder: color("ds.chip.rest-boxBorder", "#00000000"),
      boxOpacity: number("ds.chip.rest-boxOpacity", 1),
      label: color("ds.chip.rest-label", "#0a1317ff"),
    },
    typography: { label: font("SF Pro", "Medium") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/chip.ts",
    tool: "chip@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "chip", version: 1 }],
      selectedBy: "recipe-pivot-chip-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/chip.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies ChipRecipeInstance;
