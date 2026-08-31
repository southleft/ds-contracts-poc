import type {
  TabsColorParameter,
  TabsFontSpec,
  TabsNumberParameter,
  TabsRecipeInstance,
} from "../recipes/tabs.js";

const number = (
  variable: string,
  fallback: number,
): TabsNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): TabsColorParameter => ({ variable, fallback });
const font = (family: string, style: string): TabsFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/tabs.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: style === "Medium" || style === "Semibold" ? "Bold" : "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

export const canonicalTabsRecipeInstance = {
  identity: { id: "ds.tabs", name: "Tabs" },
  semantic: { root: "tabs", control: "tabs", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { selected: "Item One", rest: "Item Two" },
  tokens: {
    list: { itemSpacing: number("ds.tabs.list-itemSpacing", 0) },
    tab: {
      paddingX: number("ds.tabs.tab-paddingX", 16),
      paddingY: number("ds.tabs.tab-paddingY", 12),
      radius: number("ds.tabs.tab-radius", 0),
      minWidth: number("ds.tabs.tab-minWidth", 0),
      minHeight: number("ds.tabs.tab-minHeight", 0),
      fill: color("ds.tabs.tab-fill", "#00000000"),
    },
    indicator: {
      height: number("ds.tabs.indicator-height", 2),
      radius: number("ds.tabs.indicator-radius", 0),
      opacity: number("ds.tabs.indicator-opacity", 1),
      fill: color("ds.tabs.indicator-fill", "#1976d2ff"),
    },
    labelFontSize: number("ds.tabs.labelFontSize", 14),
    labelLineHeight: number("ds.tabs.labelLineHeight", 20),
    lineHeightUnit: "px",
    textCase: "original",
    rest: { label: color("ds.tabs.rest-label", "#00000099") },
    selected: { label: color("ds.tabs.selected-label", "#1976d2ff") },
    typography: {
      rest: font("Roboto", "Regular"),
      selected: font("Roboto", "Medium"),
    },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/tabs.ts",
    tool: "tabs@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "tabs", version: 1 }],
      selectedBy: "recipe-pivot-tabs-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/tabs.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies TabsRecipeInstance;
