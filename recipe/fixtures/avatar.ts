import type {
  AvatarColorParameter,
  AvatarFontSpec,
  AvatarNumberParameter,
  AvatarRecipeInstance,
} from "../recipes/avatar.js";

const number = (
  variable: string,
  fallback: number,
): AvatarNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): AvatarColorParameter => ({ variable, fallback });
const font = (family: string, style: string): AvatarFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/avatar.ts",
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
export const canonicalAvatarRecipeInstance = {
  identity: { id: "ds.avatar", name: "Chip" },
  semantic: { root: "avatar", control: "avatar", label: "label" },
  axes: {
    default: { name: "Default", values: ["true"], default: "true" },
  },
  content: { label: "JD" },
  tokens: {
    box: {
      height: number("ds.avatar.box-height", 40),
      paddingX: number("ds.avatar.box-paddingX", 0),
      paddingY: number("ds.avatar.box-paddingY", 0),
      radius: number("ds.avatar.box-radius", 20),
      borderWidth: number("ds.avatar.box-borderWidth", 0),
    },
    labelFontSize: number("ds.avatar.labelFontSize", 20),
    labelLineHeight: number("ds.avatar.labelLineHeight", 20),
    strokeAlign: "inside",
    rest: {
      boxFill: color("ds.avatar.rest-boxFill", "#0536591a"),
      boxBorder: color("ds.avatar.rest-boxBorder", "#00000000"),
      boxOpacity: number("ds.avatar.rest-boxOpacity", 1),
      label: color("ds.avatar.rest-label", "#0a1317ff"),
    },
    typography: { label: font("SF Pro", "Medium") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/avatar.ts",
    tool: "avatar@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "avatar", version: 1 }],
      selectedBy: "recipe-pivot-avatar-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/avatar.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "skeleton only; library proofs overwrite",
      },
    },
  },
} as const satisfies AvatarRecipeInstance;
