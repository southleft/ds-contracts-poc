import type {
  AlertColorParameter,
  AlertGlyph,
  AlertFontSpec,
  AlertNumberParameter,
  AlertRecipeInstance,
} from "../recipes/alert.js";

const number = (
  variable: string,
  fallback: number,
): AlertNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): AlertColorParameter => ({ variable, fallback });
const font = (family: string, style: string): AlertFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/alert.ts",
  fallbackChain: [
    { family, style },
    { family: "Arial", style: style === "Semibold" || style === "Medium" ? "Bold" : "Regular" },
  ],
  resolvedFamily: family,
  resolvedStyle: style,
  resolution: "requested",
});

const ringGlyph = (): AlertGlyph => ({
  path:
    "M 22 12 C 22 17.5228 17.5228 22 12 22 C 6.4772 22 2 17.5228 2 12 C 2 6.4772 6.4772 2 12 2 C 17.5228 2 22 6.4772 22 12 Z",
  viewBox: { x: 0, y: 0, width: 24, height: 24 },
  winding: "nonzero",
});

const cell = (
  prefix: string,
  status: string,
  boxFill: `#${string}`,
  boxBorder: `#${string}`,
  title: `#${string}`,
  iconFill: `#${string}`,
  iconOpacity: number,
) => ({
  boxFill: color(`${prefix}.states-${status}-boxFill`, boxFill),
  boxBorder: color(`${prefix}.states-${status}-boxBorder`, boxBorder),
  title: color(`${prefix}.states-${status}-title`, title),
  iconFill: color(`${prefix}.states-${status}-iconFill`, iconFill),
  iconOpacity: number(`${prefix}.states-${status}-iconOpacity`, iconOpacity),
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. These numbers are the clone source, not a fourth library.
 * Do not treat this default as a shared Status default.
 */
export const canonicalAlertRecipeInstance = {
  identity: { id: "ds.alert", name: "Alert" },
  semantic: { root: "alert", control: "alert", title: "title" },
  axes: {
    status: {
      name: "Status",
      values: ["info", "success", "warning", "error"],
      default: "info",
    },
  },
  content: { title: "New update available" },
  tokens: {
    box: {
      height: number("ds.alert.box-height", 44),
      paddingX: number("ds.alert.box-paddingX", 16),
      paddingY: number("ds.alert.box-paddingY", 12),
      radius: number("ds.alert.box-radius", 12),
      borderWidth: number("ds.alert.box-borderWidth", 0),
      gap: number("ds.alert.box-gap", 8),
    },
    icon: {
      size: number("ds.alert.icon-size", 20),
      // The canonical archetype instance carries a plain ring glyph (four
      // cubic quadrants of a 24-space circle, no arcs) so the compile has a
      // real vector to lower; every library replaces it with its own SVG.
      glyphs: { info: ringGlyph(), success: ringGlyph(), warning: ringGlyph(), error: ringGlyph() },
    },
    titleFontSize: number("ds.alert.titleFontSize", 14),
    titleLineHeight: number("ds.alert.titleLineHeight", 20),
    strokeAlign: "inside",
    states: {
      info: cell(
        "ds.alert",
        "info",
        "#0082fb33",
        "#00000000",
        "#0a1317ff",
        "#0064e0ff",
        1,
      ),
      success: cell(
        "ds.alert",
        "success",
        "#0b991f33",
        "#00000000",
        "#0a1317ff",
        "#0d8626ff",
        1,
      ),
      warning: cell(
        "ds.alert",
        "warning",
        "#e2a40033",
        "#00000000",
        "#0a1317ff",
        "#e9af08ff",
        1,
      ),
      error: cell(
        "ds.alert",
        "error",
        "#e3193b33",
        "#00000000",
        "#0a1317ff",
        "#e3193bff",
        1,
      ),
    },
    typography: { title: font("SF Pro", "Medium") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/alert.ts",
    tool: "alert@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "alert", version: 1 }],
      selectedBy: "recipe-pivot-alert-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/alert.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies AlertRecipeInstance;
