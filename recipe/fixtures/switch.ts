import type {
  SwitchColorParameter,
  SwitchFontSpec,
  SwitchNumberParameter,
  SwitchRecipeInstance,
} from "../recipes/switch.js";

const number = (
  variable: string,
  fallback: number,
): SwitchNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): SwitchColorParameter => ({ variable, fallback });
const font = (family: string, style: string): SwitchFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/switch.ts#label",
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
  checked: string,
  arm: string,
  trackFill: `#${string}`,
  thumbFill: `#${string}`,
  trackOpacity: number,
  label: `#${string}`,
) => ({
  trackFill: color(`${prefix}.states-${checked}-${arm}-trackFill`, trackFill),
  thumbFill: color(`${prefix}.states-${checked}-${arm}-thumbFill`, thumbFill),
  trackOpacity: number(
    `${prefix}.states-${checked}-${arm}-trackOpacity`,
    trackOpacity,
  ),
  label: color(`${prefix}.states-${checked}-${arm}-label`, label),
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. These numbers are the clone source, not a fourth library.
 */
export const canonicalSwitchRecipeInstance = {
  identity: { id: "ds.switch", name: "Switch" },
  semantic: { root: "switch", control: "switch", label: "label" },
  axes: {
    checked: {
      name: "Checked",
      values: ["false", "true"],
      default: "false",
    },
    disabled: {
      name: "Disabled",
      values: ["false", "true"],
      default: "false",
    },
  },
  content: { label: "Enable notifications" },
  tokens: {
    wrapper: {
      width: number("ds.switch.wrapper-width", 40),
      height: number("ds.switch.wrapper-height", 24),
      padding: number("ds.switch.wrapper-padding", 0),
    },
    track: {
      width: number("ds.switch.track-width", 40),
      height: number("ds.switch.track-height", 24),
      radius: number("ds.switch.track-radius", 9999),
      padding: number("ds.switch.track-padding", 4),
    },
    thumb: {
      offSize: number("ds.switch.thumb-offSize", 16),
      onSize: number("ds.switch.thumb-onSize", 20),
      travel: number("ds.switch.thumb-travel", 14),
    },
    row: { gap: number("ds.switch.row-gap", 8) },
    rowAlign: "center",
    hitClips: false,
    trackClips: false,
    states: {
      false: {
        enabled: cell(
          "ds.switch",
          "false",
          "enabled",
          "#0a131733",
          "#ffffffff",
          1,
          "#4e606fff",
        ),
        disabled: cell(
          "ds.switch",
          "false",
          "disabled",
          "#0a131733",
          "#ffffffff",
          0.5,
          "#a4b0bcff",
        ),
      },
      true: {
        enabled: cell(
          "ds.switch",
          "true",
          "enabled",
          "#0064e0ff",
          "#ffffffff",
          1,
          "#4e606fff",
        ),
        disabled: cell(
          "ds.switch",
          "true",
          "disabled",
          "#0064e0ff",
          "#ffffffff",
          0.5,
          "#a4b0bcff",
        ),
      },
    },
    labelFontSize: number("ds.switch.labelFontSize", 14),
    typography: { label: font("Arial", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/switch.ts",
    tool: "switch@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "switch", version: 1 }],
      selectedBy: "recipe-pivot-switch-skeleton",
      mechanism: "reviewed-config",
      source: "recipe/fixtures/switch.ts",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "canonical skeleton; library proofs overwrite tokens",
      },
    },
  },
} as const satisfies SwitchRecipeInstance;
