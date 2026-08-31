import type {
  MenuColorParameter,
  MenuFontSpec,
  MenuNumberParameter,
  MenuRecipeInstance,
} from "../recipes/menu.js";

const number = (
  variable: string,
  fallback: number,
): MenuNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): MenuColorParameter => ({ variable, fallback });
const font = (family: string, style: string): MenuFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/menu.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

export const canonicalMenuRecipeInstance = {
  identity: { id: "ds.menu", name: "Menu" },
  semantic: { root: "menu", control: "menu", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { first: "Item One", second: "Item Two" },
  tokens: {
    panel: {
      padding: number("ds.menu.panel-padding", 4),
      radius: number("ds.menu.panel-radius", 4),
      itemSpacing: number("ds.menu.panel-itemSpacing", 0),
      fill: color("ds.menu.panel-fill", "#ffffffff"),
    },
    item: {
      paddingX: number("ds.menu.item-paddingX", 16),
      paddingY: number("ds.menu.item-paddingY", 6),
      minHeight: number("ds.menu.item-minHeight", 0),
      fill: color("ds.menu.item-fill", "#00000000"),
    },
    labelFontSize: number("ds.menu.labelFontSize", 14),
    labelLineHeight: number("ds.menu.labelLineHeight", 20),
    lineHeightUnit: "px",
    label: color("ds.menu.label", "#0a1317ff"),
    typography: { label: font("Roboto", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/menu.ts",
    tool: "menu@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "menu", version: 1 }],
      selectedBy: "recipe-pivot-menu-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/menu.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies MenuRecipeInstance;
