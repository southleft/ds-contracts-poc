import type {
  RadioColorParameter,
  RadioFontSpec,
  RadioNumberParameter,
  RadioRecipeInstance,
} from "../recipes/radio.js";

const number = (
  variable: string,
  fallback: number,
): RadioNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): RadioColorParameter => ({ variable, fallback });
const font = (family: string, style: string): RadioFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/radio.ts#label",
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
  arm: string,
  state: string,
  circleFill: `#${string}`,
  circleBorder: `#${string}`,
  circleOpacity: number,
  label: `#${string}`,
  dotFill: `#${string}`,
) => ({
  circleFill: color(`${prefix}.states-${arm}-${state}-circleFill`, circleFill),
  circleBorder: color(
    `${prefix}.states-${arm}-${state}-circleBorder`,
    circleBorder,
  ),
  circleOpacity: number(
    `${prefix}.states-${arm}-${state}-circleOpacity`,
    circleOpacity,
  ),
  label: color(`${prefix}.states-${arm}-${state}-label`, label),
  dotFill: color(`${prefix}.states-${arm}-${state}-dotFill`, dotFill),
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. These numbers are the clone source, not a fourth library.
 */
export const canonicalRadioRecipeInstance = {
  identity: { id: "ds.radio", name: "Radio" },
  semantic: { root: "radio", control: "radio", label: "label" },
  axes: {
    selected: {
      name: "Selected",
      values: ["a", "b"],
      default: "a",
    },
    disabled: {
      name: "Disabled",
      values: ["false", "true"],
      default: "false",
    },
  },
  content: {
    items: [
      { id: "a", label: "Email" },
      { id: "b", label: "Phone" },
    ],
  },
  tokens: {
    listMode: "vertical",
    list: { gap: number("ds.radio.list-gap", 8) },
    item: { gap: number("ds.radio.item-gap", 8) },
    itemAlign: "center",
    wrapper: { size: number("ds.radio.wrapper-size", 24) },
    circle: {
      size: number("ds.radio.circle-size", 22),
      radius: number("ds.radio.circle-radius", 11),
      borderWidth: number("ds.radio.circle-borderWidth", 1),
      padding: number("ds.radio.circle-padding", 1),
    },
    dot: {
      size: number("ds.radio.dot-size", 10),
      radius: number("ds.radio.dot-radius", 5),
    },
    states: {
      selected: {
        enabled: cell(
          "ds.radio",
          "selected",
          "enabled",
          "#0064e0ff",
          "#0064e0ff",
          1,
          "#4e606fff",
          "#ffffffff",
        ),
        disabled: cell(
          "ds.radio",
          "selected",
          "disabled",
          "#0064e0ff",
          "#05365919",
          0.5,
          "#a4b0bcff",
          "#ffffffff",
        ),
      },
      unselected: {
        enabled: cell(
          "ds.radio",
          "unselected",
          "enabled",
          "#ffffffff",
          "#ccd3dbff",
          1,
          "#4e606fff",
          "#00000000",
        ),
        disabled: cell(
          "ds.radio",
          "unselected",
          "disabled",
          "#0536590c",
          "#05365919",
          0.5,
          "#a4b0bcff",
          "#00000000",
        ),
      },
    },
    labelFontSize: number("ds.radio.labelFontSize", 14),
    typography: { label: font("Arial", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/radio.ts",
    tool: "radio@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "radio", version: 1 }],
      selectedBy: "recipe-pivot-radio-review",
      mechanism: "human-review",
      source: "docs/34-boilerplate-v1-plan.md Phase 1",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit checkbox / radio to radio@1 list-shaped selection",
      },
    },
  },
} as unknown as RadioRecipeInstance;
