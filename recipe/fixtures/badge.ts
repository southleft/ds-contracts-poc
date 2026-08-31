import type {
  BadgeColorParameter,
  BadgeFontSpec,
  BadgeNumberParameter,
  BadgeRecipeInstance,
} from "../recipes/badge.js";

const number = (
  variable: string,
  fallback: number,
): BadgeNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): BadgeColorParameter => ({ variable, fallback });
const font = (family: string, style: string): BadgeFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/badge.ts",
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
 * package facts. Not a third overlay library.
 */
export const canonicalBadgeRecipeInstance = {
  identity: { id: "ds.badge", name: "Badge" },
  semantic: { root: "badge", host: "host", indicator: "indicator", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { count: "5" },
  tokens: {
    host: {
      size: number("ds.badge.host-size", 40),
      radius: number("ds.badge.host-radius", 20),
      fill: color("ds.badge.host-fill", "#bdbdbdff"),
    },
    indicator: {
      height: number("ds.badge.indicator-height", 20),
      minWidth: number("ds.badge.indicator-minWidth", 20),
      paddingX: number("ds.badge.indicator-paddingX", 6),
      radius: number("ds.badge.indicator-radius", 10),
      borderWidth: number("ds.badge.indicator-borderWidth", 0),
      translateX: number("ds.badge.indicator-translateX", 10),
      translateY: number("ds.badge.indicator-translateY", -10),
      fill: color("ds.badge.indicator-fill", "#00000000"),
      border: color("ds.badge.indicator-border", "#00000000"),
      opacity: number("ds.badge.indicator-opacity", 1),
    },
    labelFontSize: number("ds.badge.labelFontSize", 12),
    labelLineHeight: number("ds.badge.labelLineHeight", 12),
    strokeAlign: "inside",
    label: color("ds.badge.label", "#000000de"),
    typography: { label: font("Roboto", "Medium") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/badge.ts",
    tool: "badge@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "badge", version: 1 }],
      selectedBy: "recipe-pivot-badge-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/badge.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies BadgeRecipeInstance;
