import type {
  CheckboxColorParameter,
  CheckboxFontSpec,
  CheckboxNumberParameter,
  CheckboxRecipeInstance,
} from "../recipes/checkbox.js";

const number = (
  variable: string,
  fallback: number,
): CheckboxNumberParameter => ({ variable, fallback });
const color = (
  variable: string,
  fallback: `#${string}`,
): CheckboxColorParameter => ({ variable, fallback });
const font = (
  family: string,
  style: string,
): CheckboxFontSpec => ({
  requestedFamily: family,
  requestedStyle: style,
  requestSource: "recipe/fixtures/checkbox.ts#label",
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
  boxFill: `#${string}`,
  boxBorder: `#${string}`,
  boxOpacity: number,
  label: `#${string}`,
  dashFill: `#${string}`,
  checkFill: `#${string}`,
) => ({
  boxFill: color(`${prefix}.states-${checked}-${arm}-boxFill`, boxFill),
  boxBorder: color(`${prefix}.states-${checked}-${arm}-boxBorder`, boxBorder),
  boxOpacity: number(`${prefix}.states-${checked}-${arm}-boxOpacity`, boxOpacity),
  label: color(`${prefix}.states-${checked}-${arm}-label`, label),
  dashFill: color(`${prefix}.states-${checked}-${arm}-dashFill`, dashFill),
  checkFill: color(`${prefix}.states-${checked}-${arm}-checkFill`, checkFill),
});

/**
 * Recipe skeleton only. Library proofs overwrite every fallback from named
 * package facts. These numbers are the clone source, not a fourth library.
 */
export const canonicalCheckboxRecipeInstance = {
  identity: { id: "ds.checkbox", name: "Checkbox" },
  semantic: { root: "checkbox", control: "checkbox", label: "label" },
  axes: {
    checked: {
      name: "Checked",
      values: ["unchecked", "checked", "indeterminate"],
      default: "unchecked",
    },
    disabled: {
      name: "Disabled",
      values: ["false", "true"],
      default: "false",
    },
  },
  content: { label: "Accept terms" },
  tokens: {
    wrapper: { size: number("ds.checkbox.wrapper-size", 24) },
    box: {
      size: number("ds.checkbox.box-size", 22),
      radius: number("ds.checkbox.box-radius", 4),
      borderWidth: number("ds.checkbox.box-borderWidth", 1),
      padding: number("ds.checkbox.box-padding", 0),
    },
    row: { gap: number("ds.checkbox.row-gap", 8) },
    rowAlign: "center",
    dash: {
      width: number("ds.checkbox.dash-width", 12),
      height: number("ds.checkbox.dash-height", 2),
      radius: number("ds.checkbox.dash-radius", 1),
    },
    check: {
      path: "M11.9 3.5 L5.6 10.5 L2.1 7",
      width: number("ds.checkbox.check-width", 14),
      height: number("ds.checkbox.check-height", 14),
      strokeWidth: number("ds.checkbox.check-strokeWidth", 2.1),
      winding: "nonzero",
      paint: "stroke",
      strokeCap: "round",
      strokeJoin: "round",
      rotation: 0,
      offsetX: number("ds.checkbox.check-offsetX", 0),
      offsetY: number("ds.checkbox.check-offsetY", 0),
      placement: "center",
    },
    states: {
      unchecked: {
        enabled: cell(
          "ds.checkbox",
          "unchecked",
          "enabled",
          "#ffffffff",
          "#ccd3dbff",
          1,
          "#4e606fff",
          "#00000000",
          "#ffffffff",
        ),
        disabled: cell(
          "ds.checkbox",
          "unchecked",
          "disabled",
          "#0536590c",
          "#05365919",
          0.5,
          "#a4b0bcff",
          "#00000000",
          "#ffffffff",
        ),
      },
      checked: {
        enabled: cell(
          "ds.checkbox",
          "checked",
          "enabled",
          "#0064e0ff",
          "#0064e0ff",
          1,
          "#4e606fff",
          "#00000000",
          "#ffffffff",
        ),
        disabled: cell(
          "ds.checkbox",
          "checked",
          "disabled",
          "#0064e0ff",
          "#05365919",
          0.5,
          "#a4b0bcff",
          "#00000000",
          "#ffffffff",
        ),
      },
      indeterminate: {
        enabled: cell(
          "ds.checkbox",
          "indeterminate",
          "enabled",
          "#0064e0ff",
          "#0064e0ff",
          1,
          "#4e606fff",
          "#ffffffff",
          "#ffffffff",
        ),
        disabled: cell(
          "ds.checkbox",
          "indeterminate",
          "disabled",
          "#0064e0ff",
          "#05365919",
          0.5,
          "#a4b0bcff",
          "#ffffffff",
          "#ffffffff",
        ),
      },
    },
    labelFontSize: number("ds.checkbox.labelFontSize", 14),
    boxShadow: "none",
    typography: { label: font("Arial", "Regular") },
  },
  inputFacts: [],
  accounting: { carried: [] },
  extensions: [],
  receipts: [],
  provenance: {
    source: "recipe/fixtures/checkbox.ts",
    tool: "checkbox@1",
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "checkbox", version: 1 }],
      selectedBy: "recipe-pivot-checkbox-review",
      mechanism: "human-review",
      source: "docs/34-boilerplate-v1-plan.md Phase 1",
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: 1,
        unit: "reviewed-mapping",
        note: "one explicit checkbox / radio to checkbox@1 selection",
      },
    },
  },
} as unknown as CheckboxRecipeInstance;
