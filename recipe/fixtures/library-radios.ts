import type {
  ReviewedRadioAdapterConfig,
  ReviewedRadioSource,
  ReviewedRadioSourceFact,
  RadioFactCategory,
} from "../adapters/radio.js";
import { canonicalRadioRecipeInstance } from "./radio.js";
import type { RadioRecipeInstance } from "../recipes/radio.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): RadioRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalRadioRecipeInstance.tokens,
  ) as RadioRecipeInstance["tokens"];
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
const astryxFont = (): RadioRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  requestSource:
    "@astryxdesign/core/src/Field/FieldLabel.tsx styles.label fontFamily --font-family-body, fontWeight --font-weight-medium — item label inherits the Field body stack",
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

const muiFont = (): RadioRecipeInstance["tokens"]["typography"]["label"] => ({
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

const antdFont = (): RadioRecipeInstance["tokens"]["typography"]["label"] => ({
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
 * RadioList.tsx + RadioListItem.tsx. Default size md (wrapper 24,
 * circle 22, inner dot 10). sm receipted. No standalone Radio.
 */
const astryxTokens = cloneTokens("astryx.radio", (path, fallback) => {
  if (path === "list.gap") return 8;
  if (path === "item.gap") return 8;
  if (path === "wrapper.size") return 24;
  if (path === "circle.size") return 22;
  if (path === "circle.radius") return 11;
  if (path === "circle.borderWidth") return 1;
  if (path === "circle.padding") return 1;
  if (path === "dot.size") return 10;
  if (path === "dot.radius") return 5;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 0;
  if (path === "states.selected.enabled.circleFill") return "#0064e0ff";
  if (path === "states.selected.enabled.circleBorder") return "#0064e0ff";
  if (path === "states.selected.enabled.circleOpacity") return 1;
  if (path === "states.selected.enabled.label") return "#4e606fff";
  if (path === "states.selected.enabled.dotFill") return "#ffffffff";
  if (path === "states.selected.disabled.circleFill") return "#0064e0ff";
  if (path === "states.selected.disabled.circleBorder") return "#05365919";
  if (path === "states.selected.disabled.circleOpacity") return 0.5;
  if (path === "states.selected.disabled.label") return "#a4b0bcff";
  if (path === "states.selected.disabled.dotFill") return "#ffffffff";
  if (path === "states.unselected.enabled.circleFill") return "#ffffffff";
  if (path === "states.unselected.enabled.circleBorder") return "#ccd3dbff";
  if (path === "states.unselected.enabled.circleOpacity") return 1;
  if (path === "states.unselected.enabled.label") return "#4e606fff";
  if (path === "states.unselected.enabled.dotFill") return "#00000000";
  if (path === "states.unselected.disabled.circleFill") return "#0536590c";
  if (path === "states.unselected.disabled.circleBorder") return "#05365919";
  if (path === "states.unselected.disabled.circleOpacity") return 0.5;
  if (path === "states.unselected.disabled.label") return "#a4b0bcff";
  if (path === "states.unselected.disabled.dotFill") return "#00000000";
  return fallback;
});
astryxTokens.listMode = "vertical";
astryxTokens.itemAlign = "center";
astryxTokens.labelLineHeightUnit = "auto";
astryxTokens.typography = { label: astryxFont() };

/**
 * MUI Radio is SwitchBase + SvgIcon. Default size medium, color primary.
 * RadioGroup wraps FormGroup column. Label is FormControlLabel pairing.
 * Inner disc is SVG path M8.465… — lowered to a 10×10 circle.
 */
const muiTokens = cloneTokens("mui.radio", (path, fallback) => {
  if (path === "list.gap") return 0;
  if (path === "item.gap") return 0;
  if (path === "wrapper.size") return 42;
  // circle.size is the PAINTED ring, not the SvgIcon viewport.
  //
  // Same defect the fidelity gate found on checkbox/mui, in a second archetype:
  // this read 24 — MuiSvgIcon-root's width — and the capture agreed, so every
  // accounting gate passed. MUI does not paint that container.
  // radio-icon.svg draws a ring whose outer circle runs 2 -> 22 in a 24
  // viewBox (20x20, inner hole 4 -> 20), and radio-icon-2.svg draws the dot
  // 7 -> 17 (10x10, which dot.size already had right).
  // recipe/evidence/fidelity-v1 measured the mint at 41.49% AA against the real
  // render: 24x24 of ink against 20x20.
  //
  // Read from the committed glyph assets under
  // extract/computed/out/mui/radio/assets/. SVG path extent is not a computed
  // channel, so the reader mapping is a receipt, not a capture match.
  // 20 + 11*2 = 42 keeps the wrapper exact.
  if (path === "circle.size") return 20;
  if (path === "circle.radius") return 12;
  if (path === "circle.borderWidth") return 2;
  if (path === "circle.padding") return 11;
  if (path === "dot.size") return 10;
  if (path === "dot.radius") return 5;
  if (path === "labelFontSize") return 16;
  if (path === "labelLineHeight") return 0;
  if (path === "states.selected.enabled.circleFill") return "#00000000";
  if (path === "states.selected.enabled.circleBorder") return "#1976d2ff";
  if (path === "states.selected.enabled.circleOpacity") return 1;
  if (path === "states.selected.enabled.label") return "#000000de";
  if (path === "states.selected.enabled.dotFill") return "#1976d2ff";
  if (path === "states.selected.disabled.circleFill") return "#00000000";
  if (path === "states.selected.disabled.circleBorder") return "#00000042";
  if (path === "states.selected.disabled.circleOpacity") return 1;
  if (path === "states.selected.disabled.label") return "#00000061";
  if (path === "states.selected.disabled.dotFill") return "#00000042";
  if (path === "states.unselected.enabled.circleFill") return "#00000000";
  if (path === "states.unselected.enabled.circleBorder") return "#00000099";
  if (path === "states.unselected.enabled.circleOpacity") return 1;
  if (path === "states.unselected.enabled.label") return "#000000de";
  if (path === "states.unselected.enabled.dotFill") return "#00000000";
  if (path === "states.unselected.disabled.circleFill") return "#00000000";
  if (path === "states.unselected.disabled.circleBorder") return "#00000042";
  if (path === "states.unselected.disabled.circleOpacity") return 1;
  if (path === "states.unselected.disabled.label") return "#00000061";
  if (path === "states.unselected.disabled.dotFill") return "#00000000";
  return fallback;
});
muiTokens.listMode = "vertical";
muiTokens.itemAlign = "center";
muiTokens.labelLineHeightUnit = "auto";
muiTokens.typography = { label: muiFont() };

/**
 * AntD Radio.Group is inline-block (horizontal siblings). radioSize is
 * fontSizeLG 16. Non-wireframe: radioBgColor colorPrimary, radioColor
 * white, dotSize radioSize - (dotPadding + lineWidth)*2 = 6.
 */
const antdTokens = cloneTokens("antd.radio", (path, fallback) => {
  if (path === "list.gap") return 8;
  if (path === "item.gap") return 8;
  if (path === "wrapper.size") return 16;
  if (path === "circle.size") return 16;
  if (path === "circle.radius") return 8;
  if (path === "circle.borderWidth") return 1;
  if (path === "circle.padding") return 0;
  if (path === "dot.size") return 6;
  if (path === "dot.radius") return 3;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "states.selected.enabled.circleFill") return "#1677ffff";
  if (path === "states.selected.enabled.circleBorder") return "#1677ffff";
  if (path === "states.selected.enabled.circleOpacity") return 1;
  if (path === "states.selected.enabled.label") return "#000000e0";
  if (path === "states.selected.enabled.dotFill") return "#ffffffff";
  if (path === "states.selected.disabled.circleFill") return "#0000000a";
  if (path === "states.selected.disabled.circleBorder") return "#d9d9d9ff";
  if (path === "states.selected.disabled.circleOpacity") return 1;
  if (path === "states.selected.disabled.label") return "#00000040";
  if (path === "states.selected.disabled.dotFill") return "#00000040";
  if (path === "states.unselected.enabled.circleFill") return "#ffffffff";
  if (path === "states.unselected.enabled.circleBorder") return "#d9d9d9ff";
  if (path === "states.unselected.enabled.circleOpacity") return 1;
  if (path === "states.unselected.enabled.label") return "#000000e0";
  if (path === "states.unselected.enabled.dotFill") return "#00000000";
  if (path === "states.unselected.disabled.circleFill") return "#0000000a";
  if (path === "states.unselected.disabled.circleBorder") return "#d9d9d9ff";
  if (path === "states.unselected.disabled.circleOpacity") return 1;
  if (path === "states.unselected.disabled.label") return "#00000040";
  if (path === "states.unselected.disabled.dotFill") return "#00000000";
  return fallback;
});
antdTokens.listMode = "horizontal";
antdTokens.itemAlign = "center";
antdTokens.labelLineHeightUnit = "px";
antdTokens.typography = { label: antdFont() };

export const astryxRadioSource: ReviewedRadioSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "RadioList",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/RadioList",
  anatomy: {
    root: "RadioList.tsx Field + radiogroup flex column gap --spacing-2; RadioListItem must live inside RadioList",
    control:
      "wrapperSizeStyles.md 24 + radioSizeStyles.md 22; border --border-width 1; borderRadius 50% → radius 11",
    glyph:
      "innerDot real <div> 10×10 radius 50% --color-on-accent, only when checked",
    label:
      "RadioListItem.tsx label + Item; Field group label is Field chrome (receipted), not the radio control",
  },
  api: {
    value: "string — Selected axis a|b on a two-item list",
    isDisabled: "boolean on RadioList (whole group)",
    size: "sm | md; default md; sm receipted, not an axis",
    orientation: "vertical default; horizontal --spacing-5 receipted, not an axis",
    extras:
      "description, status, isLabelHidden, disabledMessage, startContent, endContent receipted",
  },
  styleSources: [
    "RadioList.tsx styles.vertical gap --spacing-2; RadioListItem.tsx styles.radio / radioUnchecked / radioChecked / radioDisabled / innerDot / wrapperSizeStyles.md / radioSizeStyles.md / dotSizeStyles.md",
    "dist/astryx.css light half of --color-accent #0064E0, --color-on-accent #FFFFFF, --color-border-emphasized #CCD3DB, --color-background-surface #FFFFFF, --color-background-muted #0536590C, --color-border #05365919, --color-text-secondary #4E606F, --color-text-disabled #A4B0BC, --border-width 1px, --spacing-2 8px",
  ],
  fontSources: [
    "FieldLabel.tsx --font-family-body system stack; --text-label-size 14; --font-weight-medium",
  ],
};

export const muiRadioSource: ReviewedRadioSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Radio",
  framework: "react",
  sourceRoot: "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Radio",
  anatomy: {
    root: "Radio.js SwitchBase root; RadioGroup wraps FormGroup column; FormControlLabel is a reviewed pairing",
    control:
      "SvgIcon medium 24×24 inside SwitchBase.js padding 9; hit 42; RadioButtonUnchecked ring lowered to circle+stroke 2",
    glyph:
      "RadioButtonChecked.js path M8.465… (~10×10 disc in 24 viewBox) — receipted SVG, painted as a 10×10 circle",
    label:
      "FormControlLabel.js + Typography body1 16 / Roboto Regular / palette.text.primary",
  },
  api: {
    checked: "boolean per Radio; group value is the Selected axis",
    disabled: "boolean",
    size: "small | medium; default medium; small receipted",
    color: "default primary; other palette colors receipted",
  },
  styleSources: [
    "Radio.js color primary → palette.primary.main #1976d2; unchecked palette.text.secondary; disabled palette.action.disabled",
    "SwitchBase.js padding 9; SvgIcon.js fontSize medium 24",
    "RadioGroup.js + FormGroup.js flexDirection column (row prop off)",
    "examples/mui/tokens/mui.vars.css palette-primary-main, palette-text-secondary, palette-text-primary, palette-text-disabled, palette-action-disabled",
  ],
  fontSources: ["createTypography.js body1 Roboto Regular 16"],
};

export const antdRadioSource: ReviewedRadioSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Radio",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/radio",
  anatomy: {
    root: "group.js Radio.Group display inline-block (horizontal siblings); wrapper inline-flex alignItems baseline with ::after \\a0 strut; radio control alignSelf center — Figma itemAlign compiles the control pairing (center)",
    control:
      "style/index.js radioSize token.fontSizeLG 16; border token.lineWidth + colorBorder; borderRadius 50% → radius 8",
    glyph:
      "inner::after scaled disc — lowered to a real 6×6 circle (dotSize = radioSize - (dotPadding + lineWidth)*2)",
    label: "& + * paddingInlineStart/End paddingXS 8; colorText 14",
  },
  api: {
    checked: "boolean per Radio; Radio.Group value is the Selected axis",
    disabled: "boolean",
    extras: "Radio.Button button style receipted; group block / optionType receipted",
  },
  styleSources: [
    "antd/es/radio/style/index.js prepareComponentToken radioSize fontSizeLG, wrapperMarginInlineEnd marginXS, radioBgColor colorPrimary, radioColor colorWhite, dotSize radioSize - (4 + lineWidth)*2",
    "examples/antd/tokens/antd.vars.css --font-size-lg 16px, --color-primary #1677ff, --color-border #d9d9d9, --line-width 1px, --color-bg-container #ffffff, --color-bg-container-disabled rgba(0,0,0,0.04), --color-text-disabled rgba(0,0,0,0.25), --color-text rgba(0,0,0,0.88), --margin-xs 8px, --padding-xs 8px, --font-size 14px",
  ],
  fontSources: [
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  ],
};

const categoryForToken = (path: string): RadioFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("circleOpacity")) return "state";
  if (
    path.includes("circleFill") ||
    path.includes("circleBorder") ||
    path.includes("dotFill") ||
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
  facts: ReviewedRadioSourceFact[] = [],
): ReviewedRadioSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.listMode" ||
      path === "tokens.itemAlign" ||
      path === "tokens.labelLineHeightUnit"
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: path.startsWith("tokens.typography") ? "typography" : "anatomy",
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

const sharedContent = {
  items: [
    { id: "a" as const, label: "Email" },
    { id: "b" as const, label: "Phone" },
  ],
};

const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedRadioSourceFact[] =>
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
    id: "refusal-standalone",
    evidence:
      "RadioListItem.tsx throws unless inside RadioList — no standalone Astryx Radio; recipe is list-shaped",
    target: "Astryx standalone Radio",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-field-label",
    evidence:
      "RadioList.tsx Field label is always rendered group chrome — form-field pairing, not the radio control",
    target: "Astryx RadioList Field group label",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover-mix",
    evidence:
      "RadioListItem.tsx radioUnchecked/Checked hover color-mix — not this teaching",
    target: "Astryx hover color-mix",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-focus-ring",
    evidence:
      "RadioListItem.tsx radioWrapperFocus 2px solid --color-accent offset 2 — Button already taught rings",
    target: "Astryx focus-visible ring",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-sm",
    evidence:
      "RadioList.tsx size sm|md; sm wrapper 20 / circle 18 / dot 8. Size is not a shared axis",
    target: "Astryx size sm",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-horizontal",
    evidence:
      "RadioList.tsx orientation horizontal uses --spacing-5; default vertical is the named listMode",
    target: "Astryx orientation horizontal",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dark",
    evidence: "astryx.css light-dark pairs; radio@1 carries the light half",
    target: "dark half of every light-dark() colour pair",
    reason: "lowered",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-icon-path",
    evidence:
      "RadioButtonUnchecked.js ring path + RadioButtonChecked.js M8.465… disc — circle+stroke is a named lowering; the SVG paths are not IR vectors",
    target: "MUI SvgIcon path (ring + inner disc)",
    reason: "lowered",
  },
  {
    id: "refusal-ripple",
    evidence: "Radio.js disableRipple default false; ripple is code-only motion",
    target: "MUI TouchRipple",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-fcl-margin",
    evidence:
      "FormControlLabel.js marginLeft -11 is row-presentation alignment, not this mint's circle",
    target: "FormControlLabel marginLeft -11",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color-axis",
    evidence: "Radio.js color default primary; other palette colors receipted",
    target: "MUI color secondary/error/info/success/warning",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-small",
    evidence:
      "Radio.js size small|medium; AntD Radio has no size. Size is not a shared axis",
    target: "MUI size small",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-wrapper-baseline-strut",
    evidence:
      "antd/es/radio/style/index.js wrapper alignItems baseline + ::after \\a0 strut; the painted control has alignSelf center. Figma BASELINE uses the circle frame's bottom edge, so itemAlign compiles the control pairing (center). Label lineHeight is 14 × 1.5714285714 = 22 from resetComponent / --line-height.",
    target: "AntD wrapper baseline + nbsp strut",
    reason: "lowered",
  },
  {
    id: "refusal-after-dot",
    evidence:
      "antd/es/radio/style/index.js inner::after scale(dotSize/radioSize) disc — no IR path primitive; lowered to a real 6×6 circle",
    target: "AntD ::after scaled radio disc",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-disabled-dot-size",
    evidence:
      "prepareComponentToken / getRadioBasicStyle disabled checked after scale is (radioSize-8)/radioSize = 8px; radio@1 keeps enabled dotSize 6",
    target: "AntD disabled checked dot size 8",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-button",
    evidence: "Radio.Button / optionType button is a segmented control, not this teaching",
    target: "AntD Radio.Button",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover",
    evidence: "getRadioBasicStyle hover borderColor colorPrimary — not this teaching",
    target: "AntD hover border",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedRadioSource,
  tokens: RadioRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedRadioSourceFact[],
  extraIr: ReviewedRadioSourceFact[],
  unsupported: string[],
): ReviewedRadioAdapterConfig => {
  const facts = [
    ...tokenFacts(slug, `${source.packageName} ${source.exportName} source review`, tokens),
    ...extraIr,
    ...refusals,
  ];
  const manualMappings = facts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath: `recipe/fixtures/library-radios.ts#${slug}RadioAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "radio", version: 1 }],
      selectedBy: "recipe-pivot-radio-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-radios.ts#${slug}`,
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
      wrapper: `${source.exportName} list + items`,
      setupSeconds: 12,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: 4,
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
  source: ReviewedRadioSource,
): ReviewedRadioSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-items`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.items",
  },
];

export const astryxRadioAdapterConfig = buildConfig(
  "astryx",
  astryxRadioSource,
  astryxTokens,
  { id: "astryx.radio", name: "Astryx RadioList" },
  astryxRefusals,
  anatomyFacts("astryx", astryxRadioSource),
  [
    "size-sm",
    "orientation-horizontal",
    "Field-group-label",
    "description",
    "status",
    "hover",
    "focus-visible",
    "standalone-Radio",
  ],
);

export const muiRadioAdapterConfig = buildConfig(
  "mui",
  muiRadioSource,
  muiTokens,
  { id: "mui.radio", name: "MUI Radio + RadioGroup" },
  muiRefusals,
  anatomyFacts("mui", muiRadioSource),
  ["size-small", "color-secondary", "ripple", "FormControlLabel-marginLeft"],
);

export const antdRadioAdapterConfig = buildConfig(
  "antd",
  antdRadioSource,
  antdTokens,
  { id: "antd.radio", name: "Ant Design Radio.Group" },
  antdRefusals,
  anatomyFacts("antd", antdRadioSource),
  ["Radio.Button", "hover", "focus-visible", "disabled-dot-size-8", "::after-scale"],
);

export const RADIO_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "radio-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 4,
  totalCells: 12,
  sources: [
    "@astryxdesign/core@0.1.6#RadioList",
    "@mui/material@9.2.0#Radio",
    "antd@5.29.3#Radio",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
