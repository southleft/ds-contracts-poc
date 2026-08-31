import type {
  DialogColorParameter,
  DialogFontSpec,
  DialogNumberParameter,
  DialogRecipeInstance,
} from "../recipes/dialog.js";

const number = (
  variable: string,
  fallback: number,
): DialogNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): DialogColorParameter => ({ variable, fallback });
const font = (family: string, style: string): DialogFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/dialog.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

export const canonicalDialogRecipeInstance = {
  identity: { id: "ds.dialog", name: "Dialog" },
  semantic: {
    root: "dialog",
    control: "dialog",
    title: "title",
    body: "body",
  },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { title: "Dialog title", body: "Dialog body" },
  tokens: {
    paper: {
      paddingX: number("ds.dialog.paper-paddingX", 16),
      paddingY: number("ds.dialog.paper-paddingY", 16),
      radius: number("ds.dialog.paper-radius", 4),
      itemSpacing: number("ds.dialog.paper-itemSpacing", 0),
      minWidth: number("ds.dialog.paper-minWidth", 400),
      fill: color("ds.dialog.paper-fill", "#ffffffff"),
    },
    titleFontSize: number("ds.dialog.titleFontSize", 20),
    titleLineHeight: number("ds.dialog.titleLineHeight", 28),
    bodyFontSize: number("ds.dialog.bodyFontSize", 14),
    bodyLineHeight: number("ds.dialog.bodyLineHeight", 20),
    lineHeightUnit: "px",
    title: color("ds.dialog.title", "#0a1317ff"),
    body: color("ds.dialog.body", "#0a1317ff"),
    typography: {
      title: font("Roboto", "Medium"),
      body: font("Roboto", "Regular"),
    },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/dialog.ts",
    tool: "dialog@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "dialog", version: 1 }],
      selectedBy: "recipe-pivot-dialog-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/dialog.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies DialogRecipeInstance;
