import type {
  LinkColorParameter,
  LinkFontSpec,
  LinkNumberParameter,
  LinkRecipeInstance,
} from "../recipes/link.js";

const number = (
  variable: string,
  fallback: number,
): LinkNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): LinkColorParameter => ({ variable, fallback });
const font = (family: string, style: string): LinkFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/link.ts",
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
export const canonicalLinkRecipeInstance = {
  identity: { id: "ds.link", name: "Link" },
  semantic: { root: "link", control: "link", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { label: "Link" },
  tokens: {
    box: {
      height: number("ds.link.box-height", 0),
      paddingX: number("ds.link.box-paddingX", 0),
      paddingY: number("ds.link.box-paddingY", 0),
      radius: number("ds.link.box-radius", 0),
      borderWidth: number("ds.link.box-borderWidth", 0),
    },
    labelFontSize: number("ds.link.labelFontSize", 14),
    labelLineHeight: number("ds.link.labelLineHeight", 20),
    lineHeightUnit: "px",
    decoration: "none",
    strokeAlign: "inside",
    rest: {
      boxFill: color("ds.link.rest-boxFill", "#00000000"),
      boxBorder: color("ds.link.rest-boxBorder", "#00000000"),
      boxOpacity: number("ds.link.rest-boxOpacity", 1),
      label: color("ds.link.rest-label", "#0064e0ff"),
    },
    typography: { label: font("Roboto", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/link.ts",
    tool: "link@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "link", version: 1 }],
      selectedBy: "recipe-pivot-link-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/link.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies LinkRecipeInstance;
