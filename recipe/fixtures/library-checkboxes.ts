import type {
  ReviewedCheckboxAdapterConfig,
  ReviewedCheckboxSource,
  ReviewedCheckboxSourceFact,
  CheckboxFactCategory,
} from "../adapters/checkbox.js";
import { canonicalCheckboxRecipeInstance } from "./checkbox.js";
import type { CheckboxRecipeInstance } from "../recipes/checkbox.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): CheckboxRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalCheckboxRecipeInstance.tokens,
  ) as CheckboxRecipeInstance["tokens"];
  const visit = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (
      typeof record.variable === "string" &&
      (typeof record.fallback === "string" ||
        typeof record.fallback === "number")
    ) {
      record.variable = `${prefix}.${path.replaceAll(".", "-")}`;
      record.fallback = mutate(path, record.fallback);
      return;
    }
    for (const [key, child] of Object.entries(record))
      visit(child, path ? `${path}.${key}` : key);
  };
  visit(tokens, "");
  return tokens;
};

const ASTRYX_BODY_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const astryxFont = (): CheckboxRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  requestSource:
    "@astryxdesign/core/src/Field/FieldLabel.tsx styles.label fontFamily --font-family-body, fontWeight --font-weight-medium",
  fallbackChain: [
    { family: "-apple-system", style: "Medium" },
    { family: "SF Pro", style: "Medium" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Medium",
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK}; Figma cannot load a CSS stack; first named host font is SF Pro Medium`,
});

const muiFont = (): CheckboxRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body1 fontFamily Roboto, fontWeightRegular 400, size 16",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdFont = (): CheckboxRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica Neue", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  degradation:
    "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular",
});

/**
 * Values read from CheckboxInput.tsx + dist/astryx.css light half.
 * Default size is md (wrapper 24, box 22). sm is receipted, not an axis.
 */
const astryxTokens = cloneTokens("astryx.checkbox", (path, fallback) => {
  if (path === "wrapper.size") return 24;
  if (path === "box.size") return 22;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 1;
  if (path === "box.padding") return 0;
  if (path === "row.gap") return 8;
  if (path === "dash.width") return 12;
  if (path === "dash.height") return 2;
  if (path === "dash.radius") return 1;
  if (path === "check.width") return 14;
  if (path === "check.height") return 14;
  if (path === "check.strokeWidth") return 2.1;
  if (path === "check.offsetX") return 0;
  if (path === "check.offsetY") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "states.unchecked.enabled.boxFill") return "#ffffffff";
  if (path === "states.unchecked.enabled.boxBorder") return "#ccd3dbff";
  if (path === "states.unchecked.enabled.boxOpacity") return 1;
  if (path === "states.unchecked.enabled.label") return "#4e606fff";
  if (path === "states.unchecked.enabled.dashFill") return "#00000000";
  if (path === "states.unchecked.enabled.checkFill") return "#ffffffff";
  if (path === "states.unchecked.disabled.boxFill") return "#0536590c";
  if (path === "states.unchecked.disabled.boxBorder") return "#05365919";
  if (path === "states.unchecked.disabled.boxOpacity") return 0.5;
  if (path === "states.unchecked.disabled.label") return "#a4b0bcff";
  if (path === "states.unchecked.disabled.dashFill") return "#00000000";
  if (path === "states.unchecked.disabled.checkFill") return "#ffffffff";
  if (path === "states.checked.enabled.boxFill") return "#0064e0ff";
  if (path === "states.checked.enabled.boxBorder") return "#0064e0ff";
  if (path === "states.checked.enabled.boxOpacity") return 1;
  if (path === "states.checked.enabled.label") return "#4e606fff";
  if (path === "states.checked.enabled.dashFill") return "#00000000";
  if (path === "states.checked.enabled.checkFill") return "#ffffffff";
  if (path === "states.checked.disabled.boxFill") return "#0064e0ff";
  if (path === "states.checked.disabled.boxBorder") return "#05365919";
  if (path === "states.checked.disabled.boxOpacity") return 0.5;
  if (path === "states.checked.disabled.label") return "#a4b0bcff";
  if (path === "states.checked.disabled.dashFill") return "#00000000";
  if (path === "states.checked.disabled.checkFill") return "#ffffffff";
  if (path === "states.indeterminate.enabled.boxFill") return "#0064e0ff";
  if (path === "states.indeterminate.enabled.boxBorder") return "#0064e0ff";
  if (path === "states.indeterminate.enabled.boxOpacity") return 1;
  if (path === "states.indeterminate.enabled.label") return "#4e606fff";
  if (path === "states.indeterminate.enabled.dashFill") return "#ffffffff";
  if (path === "states.indeterminate.enabled.checkFill") return "#ffffffff";
  if (path === "states.indeterminate.disabled.boxFill") return "#0064e0ff";
  if (path === "states.indeterminate.disabled.boxBorder") return "#05365919";
  if (path === "states.indeterminate.disabled.boxOpacity") return 0.5;
  if (path === "states.indeterminate.disabled.label") return "#a4b0bcff";
  if (path === "states.indeterminate.disabled.dashFill") return "#ffffffff";
  if (path === "states.indeterminate.disabled.checkFill") return "#ffffffff";
  return fallback;
});
astryxTokens.rowAlign = "center";
astryxTokens.check = {
  ...astryxTokens.check,
  path: "M11.9 3.5 L5.6 10.5 L2.1 7",
  winding: "nonzero",
  paint: "stroke",
  strokeCap: "round",
  strokeJoin: "round",
  rotation: 0,
  placement: "center",
};
astryxTokens.typography = { label: astryxFont() };

/**
 * MUI Checkbox is an SvgIcon inside SwitchBase (padding 9). Default size
 * medium, color primary. Label is FormControlLabel — reviewed pairing with
 * the official docs page, not a silent Checkbox invention.
 */
const muiTokens = cloneTokens("mui.checkbox", (path, fallback) => {
  if (path === "wrapper.size") return 42;
  // box.size is the PAINTED square, not the SvgIcon viewport.
  //
  // This read 24 — the MuiSvgIcon-root width — and both the fixture and the
  // capture agreed on 24, so every accounting gate passed. MUI does not paint
  // that container. checkbox-icon-unchecked.svg draws an outlined square whose
  // outer subpath runs 3 -> 21 in a 24 viewBox: an 18x18 rect with a 2px
  // stroke (the inner hole runs 5 -> 19). The mint drew the viewport where MUI
  // draws the path, and recipe/evidence/fidelity-v1 caught it at 49.31% AA
  // against the real render — 24x24 of ink against 18x18.
  //
  // 18 and the 12 below are read from the committed glyph asset
  // extract/computed/out/mui/checkbox/assets/checkbox-icon-unchecked.svg, the
  // same way the Astryx viewBox is read (mappings-checkbox.ts). SVG path extent
  // is not a computed channel, so this is a receipt, not a capture match.
  // 18 + 12*2 = 42 keeps the wrapper arithmetic intact.
  if (path === "box.size") return 18;
  if (path === "box.radius") return 2;
  if (path === "box.borderWidth") return 2;
  if (path === "box.padding") return 12;
  if (path === "row.gap") return 0;
  if (path === "dash.width") return 10;
  if (path === "dash.height") return 2;
  if (path === "dash.radius") return 0;
  if (path === "check.width") return 24;
  if (path === "check.height") return 24;
  if (path === "check.strokeWidth") return 0;
  if (path === "check.offsetX") return 0;
  if (path === "check.offsetY") return 0;
  if (path === "labelFontSize") return 16;
  if (path === "states.unchecked.enabled.boxFill") return "#00000000";
  if (path === "states.unchecked.enabled.boxBorder") return "#00000099";
  if (path === "states.unchecked.enabled.boxOpacity") return 1;
  if (path === "states.unchecked.enabled.label") return "#000000de";
  if (path === "states.unchecked.enabled.dashFill") return "#00000000";
  if (path === "states.unchecked.enabled.checkFill") return "#ffffffff";
  if (path === "states.unchecked.disabled.boxFill") return "#00000000";
  if (path === "states.unchecked.disabled.boxBorder") return "#00000042";
  if (path === "states.unchecked.disabled.boxOpacity") return 1;
  if (path === "states.unchecked.disabled.label") return "#00000061";
  if (path === "states.unchecked.disabled.dashFill") return "#00000000";
  if (path === "states.unchecked.disabled.checkFill") return "#ffffffff";
  if (path === "states.checked.enabled.boxFill") return "#ffffffff";
  if (path === "states.checked.enabled.boxBorder") return "#00000000";
  if (path === "states.checked.enabled.boxOpacity") return 1;
  if (path === "states.checked.enabled.label") return "#000000de";
  if (path === "states.checked.enabled.dashFill") return "#00000000";
  if (path === "states.checked.enabled.checkFill") return "#1976d2ff";
  if (path === "states.checked.disabled.boxFill") return "#ffffffff";
  if (path === "states.checked.disabled.boxBorder") return "#00000000";
  if (path === "states.checked.disabled.boxOpacity") return 1;
  if (path === "states.checked.disabled.label") return "#00000061";
  if (path === "states.checked.disabled.dashFill") return "#00000000";
  if (path === "states.checked.disabled.checkFill") return "#00000042";
  if (path === "states.indeterminate.enabled.boxFill") return "#1976d2ff";
  if (path === "states.indeterminate.enabled.boxBorder") return "#1976d2ff";
  if (path === "states.indeterminate.enabled.boxOpacity") return 1;
  if (path === "states.indeterminate.enabled.label") return "#000000de";
  if (path === "states.indeterminate.enabled.dashFill") return "#ffffffff";
  if (path === "states.indeterminate.enabled.checkFill") return "#ffffffff";
  if (path === "states.indeterminate.disabled.boxFill") return "#00000042";
  if (path === "states.indeterminate.disabled.boxBorder") return "#00000042";
  if (path === "states.indeterminate.disabled.boxOpacity") return 1;
  if (path === "states.indeterminate.disabled.label") return "#00000061";
  if (path === "states.indeterminate.disabled.dashFill") return "#ffffffff";
  if (path === "states.indeterminate.disabled.checkFill") return "#ffffffff";
  return fallback;
});
muiTokens.rowAlign = "center";
muiTokens.check = {
  ...muiTokens.check,
  // MUI's shipped icon path, verbatim from CheckBox.js — compact, relative, and
  // exactly what the package contains. Figma's vectorPaths parser accepts only
  // absolute M/L/C/Q/Z, so this is LOWERED at compile time by
  // recipe/figma-vector-path.ts rather than rewritten here. The fixture stays a
  // citation of the library; the adaptation to Figma's grammar lives in the
  // compile, where every other lowering lives.
  path: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  winding: "evenodd",
  paint: "fill",
  strokeCap: "none",
  strokeJoin: "miter",
  rotation: 0,
  placement: "center",
};
muiTokens.typography = { label: muiFont() };

/**
 * AntD Checkbox inner is controlInteractiveSize 16. Tick is inner::after
 * L-stroke (checkboxSize/14*5 × checkboxSize/14*8, lineWidthBold 2,
 * rotate(45deg)). v2 minted that L as a rotated path and it read as `>`.
 * This remint bakes the 45° CW into the path (rotation 0) so the stroke
 * is a check. Indeterminate ::after box is fontSizeLG/2 (index.js:163-164);
 * the named bar is that width × lineWidthBold — a dash, not an 8×8 fill.
 */
const ANTD_LINE_BOLD = 2;
const ANTD_CHECK_W = 7.677;
const ANTD_CHECK_H = 5.051;
const ANTD_CHECK_PATH = "M7.677 0.000 L2.626 5.051 L0.000 2.424";
const antdTokens = cloneTokens("antd.checkbox", (path, fallback) => {
  if (path === "wrapper.size") return 16;
  if (path === "box.size") return 16;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 1;
  if (path === "box.padding") return 0;
  if (path === "row.gap") return 8;
  if (path === "dash.width") return 8;
  if (path === "dash.height") return 2;
  if (path === "dash.radius") return 0;
  if (path === "check.width") return ANTD_CHECK_W;
  if (path === "check.height") return ANTD_CHECK_H;
  if (path === "check.strokeWidth") return ANTD_LINE_BOLD;
  if (path === "check.offsetX") return 0;
  if (path === "check.offsetY") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "states.unchecked.enabled.boxFill") return "#ffffffff";
  if (path === "states.unchecked.enabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.unchecked.enabled.boxOpacity") return 1;
  if (path === "states.unchecked.enabled.label") return "#000000e0";
  if (path === "states.unchecked.enabled.dashFill") return "#00000000";
  if (path === "states.unchecked.enabled.checkFill") return "#ffffffff";
  if (path === "states.unchecked.disabled.boxFill") return "#0000000a";
  if (path === "states.unchecked.disabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.unchecked.disabled.boxOpacity") return 1;
  if (path === "states.unchecked.disabled.label") return "#00000040";
  if (path === "states.unchecked.disabled.dashFill") return "#00000000";
  if (path === "states.unchecked.disabled.checkFill") return "#00000040";
  if (path === "states.checked.enabled.boxFill") return "#1677ffff";
  if (path === "states.checked.enabled.boxBorder") return "#1677ffff";
  if (path === "states.checked.enabled.boxOpacity") return 1;
  if (path === "states.checked.enabled.label") return "#000000e0";
  if (path === "states.checked.enabled.dashFill") return "#00000000";
  if (path === "states.checked.enabled.checkFill") return "#ffffffff";
  if (path === "states.checked.disabled.boxFill") return "#0000000a";
  if (path === "states.checked.disabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.checked.disabled.boxOpacity") return 1;
  if (path === "states.checked.disabled.label") return "#00000040";
  if (path === "states.checked.disabled.dashFill") return "#00000000";
  if (path === "states.checked.disabled.checkFill") return "#00000040";
  if (path === "states.indeterminate.enabled.boxFill") return "#ffffffff";
  if (path === "states.indeterminate.enabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.indeterminate.enabled.boxOpacity") return 1;
  if (path === "states.indeterminate.enabled.label") return "#000000e0";
  if (path === "states.indeterminate.enabled.dashFill") return "#1677ffff";
  if (path === "states.indeterminate.enabled.checkFill") return "#ffffffff";
  if (path === "states.indeterminate.disabled.boxFill") return "#0000000a";
  if (path === "states.indeterminate.disabled.boxBorder") return "#d9d9d9ff";
  if (path === "states.indeterminate.disabled.boxOpacity") return 1;
  if (path === "states.indeterminate.disabled.label") return "#00000040";
  if (path === "states.indeterminate.disabled.dashFill") return "#00000040";
  if (path === "states.indeterminate.disabled.checkFill") return "#00000040";
  return fallback;
});
antdTokens.rowAlign = "baseline";
antdTokens.check = {
  ...antdTokens.check,
  path: ANTD_CHECK_PATH,
  winding: "nonzero",
  paint: "stroke",
  strokeCap: "square",
  strokeJoin: "miter",
  rotation: 0,
  placement: "center",
};
antdTokens.typography = { label: antdFont() };

export const astryxCheckboxSource: ReviewedCheckboxSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "CheckboxInput",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/CheckboxInput",
  anatomy: {
    root: "CheckboxInput.tsx container + row (flex, align center, gap --spacing-2)",
    control:
      "wrapperSizeStyles.md 24 + checkboxSizeStyles.md 22; border --border-width 1; radius --radius-inner 4",
    glyph:
      "SVG check path M8.5 2.5L4 7.5L1.5 5 in viewBox 0 0 10 10, stroke 1.5 currentColor round, checkmarkSizeStyles.md 14×14 (path × 1.4 → stroke 2.1); indeterminateMark 12×2 radius 1 --color-on-accent",
    label:
      "FieldLabel required; --text-label-size 14 / --font-weight-medium / --color-text-secondary",
  },
  api: {
    value: "boolean | 'indeterminate' — one Checked axis",
    isDisabled: "boolean",
    size: "sm | md; default md; sm receipted, not an axis",
    extras: "isLoading, description, status, isLabelHidden receipted",
  },
  styleSources: [
    "CheckboxInput.tsx styles.checkbox / checkboxUnchecked / checkboxChecked / checkboxDisabled / indeterminateSizeStyles.md",
    "dist/astryx.css light half of --color-accent #0064E0, --color-on-accent #FFFFFF, --color-border-emphasized #CCD3DB, --color-background-surface #FFFFFF, --color-background-muted #0536590C, --color-border #05365919, --color-text-secondary #4E606F, --color-text-disabled #A4B0BC, --radius-inner 4px, --border-width 1px, --spacing-2 8px",
  ],
  fontSources: [
    "FieldLabel.tsx --font-family-body system stack; --text-label-size 14; --font-weight-medium",
  ],
};

export const muiCheckboxSource: ReviewedCheckboxSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Checkbox",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Checkbox",
  anatomy: {
    root: "Checkbox.js SwitchBase root; FormControlLabel is a reviewed pairing (official docs), not a Checkbox child",
    control:
      "SvgIcon medium 24×24 inside SwitchBase.js padding 9; hit 42; icon corner from CheckBoxOutlineBlank path c-1.1 → 2",
    glyph:
      "CheckBox.js even-odd hole lowered to a white filled check overlay (M10 17 L5 12 L6.41 10.59 L10 14.17 L17.59 6.58 L19 8 Z in 24 viewBox). IndeterminateCheckBox hole is the 10×2 bar at (7,11) — dashFill --white",
    label:
      "FormControlLabel.js + Typography body1 16 / Roboto Regular / palette.text.primary",
  },
  api: {
    checked: "boolean",
    indeterminate: "boolean — one Checked axis with checked",
    disabled: "boolean",
    size: "small | medium; default medium; small receipted",
    color: "default primary; other palette colors receipted",
  },
  styleSources: [
    "Checkbox.js color primary → palette.primary.main #1976d2; unchecked palette.text.secondary; disabled palette.action.disabled",
    "SwitchBase.js padding 9",
    "SvgIcon.js fontSize medium 24",
    "FormControlLabel.js inline-flex align center; marginLeft -11 receipted as row-presentation, not this mint",
    "examples/mui/tokens/mui.vars.css palette-primary-main, palette-text-secondary, palette-text-primary, palette-text-disabled, palette-action-disabled",
  ],
  fontSources: [
    "createTypography.js body1 Roboto Regular 16",
  ],
};

export const antdCheckboxSource: ReviewedCheckboxSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Checkbox",
  framework: "react",
  sourceRoot:
    "examples/antd/.antd-sandbox/node_modules/antd/es/checkbox",
  anatomy: {
    root: "Checkbox.js label.ant-checkbox-wrapper inline-flex alignItems baseline",
    control:
      "style/index.js checkboxSize token.controlInteractiveSize 16; border token.lineWidth + colorBorder; radius borderRadiusSM 4",
    glyph:
      "inner::after L-stroke width checkboxSize/14*5 height checkboxSize/14*8, lineWidthBold 2, rotate(45deg) baked into path M7.677 0 L2.626 5.051 L0 2.424; indeterminate bar fontSizeLG/2 × lineWidthBold colorPrimary",
    label: "& + span paddingInlineStart/End paddingXS 8; colorText 14",
  },
  api: {
    checked: "boolean",
    indeterminate: "boolean — one Checked axis with checked",
    disabled: "boolean",
    extras: "Checkbox.Group receipted; no size prop on standalone Checkbox",
  },
  styleSources: [
    "antd/es/checkbox/style/index.js genCheckboxStyle; checkboxSize: token.controlInteractiveSize",
    "examples/antd/tokens/antd.vars.css --control-interactive-size 16px, --color-primary #1677ff, --color-border #d9d9d9, --border-radius-sm 4px, --line-width 1px, --color-bg-container #ffffff, --color-bg-container-disabled rgba(0,0,0,0.04), --color-text-disabled rgba(0,0,0,0.25), --color-text rgba(0,0,0,0.88), --padding-xs 8px, --font-size-lg 16px, --font-size 14px",
  ],
  fontSources: [
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  ],
};

const categoryForToken = (path: string): CheckboxFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("boxOpacity")) return "state";
  if (
    path.includes("boxFill") ||
    path.includes("boxBorder") ||
    path.includes("dashFill") ||
    path.includes("checkFill") ||
    path.endsWith(".label") ||
    path.includes("states")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedCheckboxSourceFact[] = [],
): ReviewedCheckboxSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.rowAlign" ||
      path.startsWith("tokens.check.")
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category:
          path === "tokens.rowAlign" || path.startsWith("tokens.check.")
            ? "anatomy"
            : "typography",
        source: {
          kind: "review",
          evidence: `${evidence}; reviewed ${path}=${String(value)}`,
        },
        disposition: "ir",
        target: path,
      });
    }
    return facts;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.variable === "string" &&
    (typeof record.fallback === "string" || typeof record.fallback === "number")
  ) {
    facts.push({
      occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
      category: categoryForToken(path),
      source: {
        kind: "review",
        evidence: `${evidence}; reviewed ${record.variable}=${record.fallback}`,
      },
      disposition: "ir",
      target: path,
    });
    return facts;
  }
  for (const [key, child] of Object.entries(record))
    tokenFacts(sourceSlug, evidence, child, `${path}.${key}`, facts);
  return facts;
};

const sharedContent = { label: "Accept terms" } as const;

const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedCheckboxSourceFact[] =>
  rows.map((row) => ({
    occurrenceId: `${slug}-${row.id}`,
    category: "refusal" as const,
    source: { kind: "review" as const, evidence: row.evidence },
    disposition: "refusal" as const,
    target: row.target,
    receiptReason: row.reason,
  }));

const astryxRefusals = makeRefusals("astryx", [
  {
    id: "refusal-hover-mix",
    evidence:
      "CheckboxInput.tsx checkboxUnchecked/Checked hover color-mix — not this teaching",
    target: "Astryx hover color-mix",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-focus-ring",
    evidence:
      "CheckboxInput.tsx checkboxFocus 2px solid --color-accent offset 2 — Button already taught rings; not this teaching",
    target: "Astryx focus-visible ring",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-loading",
    evidence: "CheckboxInput.tsx isLoading Spinner — Astryx-only",
    target: "Astryx isLoading spinner",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-sm",
    evidence:
      "CheckboxInput.tsx size sm|md; AntD has no size. Size is not a shared axis; sm receipted",
    target: "Astryx size sm",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dark",
    evidence: "astryx.css light-dark pairs; checkbox@1 carries the light half",
    target: "dark half of every light-dark() colour pair",
    reason: "lowered",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-indeterminate-icon",
    evidence:
      "IndeterminateCheckBox.js even-odd hole is the 10×2 bar; compile paints that bar as a dash rect on the named box, not a second even-odd icon",
    target: "MUI IndeterminateCheckBox even-odd as a second icon",
    reason: "lowered",
  },
  {
    id: "refusal-ripple",
    evidence: "Checkbox.js disableRipple default false; ripple is code-only motion",
    target: "MUI TouchRipple",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-fcl-margin",
    evidence:
      "FormControlLabel.js marginLeft -11 is row-presentation alignment, not this mint's box",
    target: "FormControlLabel marginLeft -11",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color-axis",
    evidence: "Checkbox.js color default primary; other palette colors receipted",
    target: "MUI color secondary/error/info/success/warning",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-small",
    evidence:
      "Checkbox.js size small|medium; AntD has no size. Size is not a shared axis",
    target: "MUI size small",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-group",
    evidence: "Checkbox.Group is a list, not the standalone control",
    target: "AntD Checkbox.Group",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover",
    evidence: "genCheckboxStyle hover borderColor colorPrimary — not this teaching",
    target: "AntD hover border",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-indeterminate-square",
    evidence:
      "index.js:163-164 indeterminate ::after is fontSizeLG/2 × fontSizeLG/2 colorPrimary. v2 minted that square and it read as a filled tile. Compile paints width fontSizeLG/2 × lineWidthBold — a named dash, not an invented Polar bar",
    target: "AntD indeterminate 8×8 square fill",
    reason: "lowered",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedCheckboxSource,
  tokens: CheckboxRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedCheckboxSourceFact[],
  extraIr: ReviewedCheckboxSourceFact[],
  unsupported: string[],
): ReviewedCheckboxAdapterConfig => {
  const facts = [
    ...tokenFacts(slug, `${source.packageName} ${source.exportName} source review`, tokens),
    ...extraIr,
    ...refusals,
  ];
  const manualMappings = facts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath: `recipe/fixtures/library-checkboxes.ts#${slug}CheckboxAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "checkbox", version: 1 }],
      selectedBy: "recipe-pivot-checkbox-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-checkboxes.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: structuredClone(sharedContent),
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} control + label`,
      setupSeconds: 12,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: 6,
      unsupportedCells: unsupported,
      captureCommand:
        "deferred: source references must be rendered in a separately authorized matched-benchmark task",
      renderedReferences: false,
      graded: false,
    },
  };
};

const anatomyFacts = (
  slug: string,
  source: ReviewedCheckboxSource,
): ReviewedCheckboxSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-label`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.label",
  },
];

export const astryxCheckboxAdapterConfig = buildConfig(
  "astryx",
  astryxCheckboxSource,
  astryxTokens,
  { id: "astryx.checkbox", name: "Astryx CheckboxInput" },
  astryxRefusals,
  anatomyFacts("astryx", astryxCheckboxSource),
  ["size-sm", "isLoading", "description", "status", "hover", "focus-visible"],
);

export const muiCheckboxAdapterConfig = buildConfig(
  "mui",
  muiCheckboxSource,
  muiTokens,
  { id: "mui.checkbox", name: "MUI Checkbox" },
  muiRefusals,
  anatomyFacts("mui", muiCheckboxSource),
  ["size-small", "color-secondary", "ripple", "FormControlLabel-marginLeft"],
);

export const antdCheckboxAdapterConfig = buildConfig(
  "antd",
  antdCheckboxSource,
  antdTokens,
  { id: "antd.checkbox", name: "Ant Design Checkbox" },
  antdRefusals,
  anatomyFacts("antd", antdCheckboxSource),
  ["Checkbox.Group", "hover", "focus-visible"],
);

export const CHECKBOX_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "checkbox-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 6,
  totalCells: 18,
  sources: [
    "@astryxdesign/core@0.1.6#CheckboxInput",
    "@mui/material@9.2.0#Checkbox",
    "antd@5.29.3#Checkbox",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
