import type {
  ReviewedSwitchAdapterConfig,
  ReviewedSwitchSource,
  ReviewedSwitchSourceFact,
  SwitchFactCategory,
} from "../adapters/switch.js";
import { canonicalSwitchRecipeInstance } from "./switch.js";
import type { SwitchRecipeInstance } from "../recipes/switch.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): SwitchRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalSwitchRecipeInstance.tokens,
  ) as SwitchRecipeInstance["tokens"];
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
const astryxFont = (): SwitchRecipeInstance["tokens"]["typography"]["label"] => ({
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

const muiFont = (): SwitchRecipeInstance["tokens"]["typography"]["label"] => ({
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

const antdFont = (): SwitchRecipeInstance["tokens"]["typography"]["label"] => ({
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
 * Values from Switch.tsx constants + tokens.stylex.ts light half.
 * Geometry is fixed (not an axis). Thumb on/off size is named travel, not a picker.
 */
const astryxTokens = cloneTokens("astryx.switch", (path, fallback) => {
  if (path === "wrapper.width") return 40;
  if (path === "wrapper.height") return 24;
  if (path === "wrapper.padding") return 0;
  if (path === "track.width") return 40;
  if (path === "track.height") return 24;
  if (path === "track.radius") return 9999;
  if (path === "track.padding") return 4;
  if (path === "thumb.offSize") return 16;
  if (path === "thumb.onSize") return 20;
  if (path === "thumb.travel") return 14;
  if (path === "row.gap") return 8;
  if (path === "labelFontSize") return 14;
  if (path === "states.false.enabled.trackFill") return "#0a131733";
  if (path === "states.false.enabled.thumbFill") return "#ffffffff";
  if (path === "states.false.enabled.trackOpacity") return 1;
  if (path === "states.false.enabled.label") return "#4e606fff";
  if (path === "states.false.disabled.trackFill") return "#0a131733";
  if (path === "states.false.disabled.thumbFill") return "#ffffffff";
  if (path === "states.false.disabled.trackOpacity") return 0.5;
  if (path === "states.false.disabled.label") return "#a4b0bcff";
  if (path === "states.true.enabled.trackFill") return "#0064e0ff";
  if (path === "states.true.enabled.thumbFill") return "#ffffffff";
  if (path === "states.true.enabled.trackOpacity") return 1;
  if (path === "states.true.enabled.label") return "#4e606fff";
  if (path === "states.true.disabled.trackFill") return "#0064e0ff";
  if (path === "states.true.disabled.thumbFill") return "#ffffffff";
  if (path === "states.true.disabled.trackOpacity") return 0.5;
  if (path === "states.true.disabled.label") return "#a4b0bcff";
  return fallback;
});
astryxTokens.rowAlign = "center";
astryxTokens.hitClips = false;
// Astryx paints no thumb elevation — verified against the core-only capture,
// where .astryx-switch handle reports box-shadow: none.
astryxTokens.thumbShadow = "none";
astryxTokens.trackClips = false;
astryxTokens.typography = { label: astryxFont() };

/**
 * MUI Switch.js @ 9.2.0 medium default. Root 34+12*2 × 14+12*2, padding 12.
 * Track fills the content box 34×14, radius 7. Thumb 20×20. translateX(20).
 * Track CSS opacity is baked into the fill so the nested thumb stays opaque
 * (MUI thumb is a SwitchBase sibling, not a track child).
 */
const muiTokens = cloneTokens("mui.switch", (path, fallback) => {
  if (path === "wrapper.width") return 58;
  if (path === "wrapper.height") return 38;
  if (path === "wrapper.padding") return 12;
  if (path === "track.width") return 34;
  if (path === "track.height") return 14;
  if (path === "track.radius") return 7;
  if (path === "track.padding") return 0;
  if (path === "thumb.offSize") return 20;
  if (path === "thumb.onSize") return 20;
  if (path === "thumb.travel") return 20;
  if (path === "row.gap") return 0;
  if (path === "labelFontSize") return 16;
  if (path === "states.false.enabled.trackFill") return "#00000061";
  if (path === "states.false.enabled.thumbFill") return "#ffffffff";
  if (path === "states.false.enabled.trackOpacity") return 1;
  if (path === "states.false.enabled.label") return "#000000de";
  if (path === "states.false.disabled.trackFill") return "#0000001f";
  if (path === "states.false.disabled.thumbFill") return "#f5f5f5ff";
  if (path === "states.false.disabled.trackOpacity") return 1;
  if (path === "states.false.disabled.label") return "#00000061";
  if (path === "states.true.enabled.trackFill") return "#1976d280";
  if (path === "states.true.enabled.thumbFill") return "#1976d2ff";
  if (path === "states.true.enabled.trackOpacity") return 1;
  if (path === "states.true.enabled.label") return "#000000de";
  if (path === "states.true.disabled.trackFill") return "#1976d21f";
  if (path === "states.true.disabled.thumbFill") return "#a7caedff";
  if (path === "states.true.disabled.trackOpacity") return 1;
  if (path === "states.true.disabled.label") return "#00000061";
  return fallback;
});
muiTokens.rowAlign = "center";
muiTokens.hitClips = true;
// MUI elevation 1, verbatim from the capture's computed .MuiSwitch-thumb
// box-shadow. Carried as the library's own declaration and lowered to Figma
// effects at compile (recipe/css-box-shadow.ts). Previously refused as
// `refusal-thumb-shadow`; the refusal was honest and the loss was expensive —
// a white thumb with no elevation is invisible on a white ground.
muiTokens.thumbShadow =
  "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px";
muiTokens.trackClips = false;
muiTokens.typography = { label: muiFont() };

/**
 * antd@5.29.3 prepareComponentToken: height = fontSize * lineHeight = 22,
 * padding 2, handleSize 18, trackMinWidth 44. switchDisabledOpacity =
 * opacityLoading 0.65. Inner ON/OFF text receipted.
 */
const antdTokens = cloneTokens("antd.switch", (path, fallback) => {
  if (path === "wrapper.width") return 44;
  if (path === "wrapper.height") return 22;
  if (path === "wrapper.padding") return 0;
  if (path === "track.width") return 44;
  if (path === "track.height") return 22;
  if (path === "track.radius") return 100;
  if (path === "track.padding") return 2;
  if (path === "thumb.offSize") return 18;
  if (path === "thumb.onSize") return 18;
  if (path === "thumb.travel") return 22;
  if (path === "row.gap") return 8;
  if (path === "labelFontSize") return 14;
  if (path === "states.false.enabled.trackFill") return "#00000040";
  if (path === "states.false.enabled.thumbFill") return "#ffffffff";
  if (path === "states.false.enabled.trackOpacity") return 1;
  if (path === "states.false.enabled.label") return "#000000e0";
  if (path === "states.false.disabled.trackFill") return "#00000040";
  if (path === "states.false.disabled.thumbFill") return "#ffffffff";
  if (path === "states.false.disabled.trackOpacity") return 0.65;
  if (path === "states.false.disabled.label") return "#00000040";
  if (path === "states.true.enabled.trackFill") return "#1677ffff";
  if (path === "states.true.enabled.thumbFill") return "#ffffffff";
  if (path === "states.true.enabled.trackOpacity") return 1;
  if (path === "states.true.enabled.label") return "#000000e0";
  if (path === "states.true.disabled.trackFill") return "#1677ffff";
  if (path === "states.true.disabled.thumbFill") return "#ffffffff";
  if (path === "states.true.disabled.trackOpacity") return 0.65;
  if (path === "states.true.disabled.label") return "#00000040";
  return fallback;
});
antdTokens.rowAlign = "center";
antdTokens.hitClips = false;
// AntD paints no thumb elevation in the captured default theme.
// The handle knob (ant-switch-handle::before) carries handleShadow
// `0 2px 4px 0 rgba(0, 35, 11, 0.2)` (antd/es/switch/style/index.js
// prepareComponentToken). The hand table said "none" and the fidelity gate
// excused the resulting 44x22-vs-44x24 as AA fringe; the role schema read the
// ledger's ::before box-shadow on 2026-09-01 and found the shadow.
antdTokens.thumbShadow = "rgba(0, 35, 11, 0.2) 0px 2px 4px 0px";
antdTokens.trackClips = false;
antdTokens.typography = { label: antdFont() };

export const astryxSwitchSource: ReviewedSwitchSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Switch",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Switch",
  anatomy: {
    root: "Switch.tsx container flex align center gap --spacing-2; switchWrapper 40×24",
    control:
      "SWITCH_WIDTH 40 SWITCH_HEIGHT 24 TRACK_PADDING 4 THUMB_SIZE_OFF 16 THUMB_SIZE_ON 20 ON_RIGHT_PADDING 2 THUMB_TRAVEL_ON 14; radius --radius-full 9999",
    glyph:
      "thumb is a filled circle --color-background-surface; on/off size change is named geometry, not an axis",
    label:
      "FieldLabel required; --text-label-size 14 / --font-weight-medium / --color-text-secondary; example label Enable notifications",
  },
  api: {
    value: "boolean",
    isDisabled: "boolean",
    extras: "isLoading, description, isLabelHidden, labelPosition, disabledMessage receipted",
  },
  styleSources: [
    "Switch.tsx styles.track / trackOff / trackOn / trackDisabled / thumbOff / thumbOn",
    "src/theme/tokens.stylex.ts light half of --color-background-gray #0A131733, --color-accent #0064E0, --color-background-surface #FFFFFF, --color-text-secondary #4E606F, --color-text-disabled #A4B0BC, --radius-full 9999px, --spacing-2 8px",
  ],
  fontSources: [
    "FieldLabel.tsx --font-family-body system stack; --text-label-size 14; --font-weight-medium",
  ],
};

export const muiSwitchSource: ReviewedSwitchSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Switch",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Switch",
  anatomy: {
    root: "Switch.js SwitchRoot inline-flex width 34+12*2 height 14+12*2 padding 12 overflow hidden; FormControlLabel is a reviewed pairing (official docs), not a Switch child",
    control:
      "SwitchTrack 100% of content box 34×14 borderRadius 7; SwitchThumb 20×20; SwitchBase padding 9 translateX(20px) when checked",
    glyph:
      "thumb currentColor; unchecked white / grey[100] disabled; checked primary.main / lighten(primary.main, 0.62) disabled",
    label:
      "FormControlLabel.js + Typography body1 16 / Roboto Regular / palette.text.primary",
  },
  api: {
    checked: "boolean",
    disabled: "boolean",
    size: "small | medium; default medium; small receipted",
    color: "default primary; other palette colors receipted",
  },
  styleSources: [
    "Switch.js SwitchRoot / SwitchSwitchBase / SwitchTrack / SwitchThumb",
    "internal/SwitchBase.js padding 9",
    "FormControlLabel.js inline-flex align center; marginLeft -11 receipted as row-presentation, not this mint",
  ],
  fontSources: ["createTypography.js body1 Roboto Regular 16"],
};

export const antdSwitchSource: ReviewedSwitchSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Switch",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/switch",
  anatomy: {
    root: "style/index.js genSwitchStyle inline-block minWidth trackMinWidth 44 height 22 borderRadius 100 verticalAlign middle",
    control:
      "prepareComponentToken height fontSize*lineHeight 22; padding 2; handleSize 18; trackMinWidth handleSize*2+padding*4 44",
    glyph:
      "handle absolute top/insetInlineStart trackPadding 2; handleBg colorWhite; checked insetInlineStart calc(100% - handleSize - trackPadding) = 24. Compile travel is the delta 24-2 = 22 (trackWidth - handleSize - 2*padding)",
    label:
      "no required children; reviewed pairing like Checkbox uses --padding-xs 8 and --color-text; inner ON/OFF text receipted",
  },
  api: {
    checked: "boolean",
    disabled: "boolean",
    size: "default | small; small is heightSM 16 receipted, not an axis",
    extras: "loading, checkedChildren, unCheckedChildren receipted",
  },
  styleSources: [
    "antd/es/switch/style/index.js prepareComponentToken + genSwitchStyle + genSwitchHandleStyle",
    "examples/antd/tokens/antd.vars.css --color-primary #1677ff, --color-text-quaternary rgba(0,0,0,0.25), --color-text rgba(0,0,0,0.88), --color-text-disabled rgba(0,0,0,0.25), --opacity-loading 0.65, --padding-xs 8px, --font-size 14px",
  ],
  fontSources: [
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  ],
};

const categoryForToken = (path: string): SwitchFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("trackOpacity")) return "state";
  if (
    path.includes("trackFill") ||
    path.includes("thumbFill") ||
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
  facts: ReviewedSwitchSourceFact[] = [],
): ReviewedSwitchSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.rowAlign" ||
      path === "tokens.thumbShadow" ||
      path === "tokens.hitClips" ||
      path === "tokens.trackClips"
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category:
          path === "tokens.rowAlign" ||
          path === "tokens.hitClips" ||
          path === "tokens.trackClips"
            ? "anatomy"
            : // adapters/switch.ts expectedCategory falls through to "geometry"
              // for any tokens.* it does not name earlier, and thumbShadow is
              // one of those. The fixture must agree with that rule or the
              // acquisition audit refuses the source.
              path === "tokens.thumbShadow"
              ? "geometry"
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

const sharedContent = { label: "Enable notifications" } as const;

const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedSwitchSourceFact[] =>
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
      "Switch.tsx trackOff/trackOn hover color-mix — not this teaching",
    target: "Astryx hover color-mix",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-focus-ring",
    evidence:
      "Switch.tsx trackFocus 2px solid --color-accent offset 2 — Button already taught rings; not this teaching",
    target: "Astryx focus-visible ring",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-loading",
    evidence: "Switch.tsx isLoading Spinner — Astryx-only",
    target: "Astryx isLoading spinner",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-thumb-size-axis",
    evidence:
      "THUMB_SIZE_OFF 16 / THUMB_SIZE_ON 20 is named geometry compiled per Checked, not a picker axis",
    target: "Astryx thumb on/off size as an axis",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dark",
    evidence: "tokens.stylex.ts light-dark pairs; switch@1 carries the light half",
    target: "dark half of every light-dark() colour pair",
    reason: "lowered",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-sibling-overlay",
    evidence:
      "Switch.js SwitchBase+Thumb are siblings of SwitchTrack; nested-thumb IR plus 3px SwitchBase padding-9 vs root padding-12 overhang is a named lowering",
    target: "MUI SwitchBase/track sibling overlay + 3px thumb overhang",
    reason: "lowered",
  },
  {
    id: "refusal-track-opacity-bake",
    evidence:
      "Switch.js track opacity 0.38/0.5/0.12 is baked into the fill so the nested thumb stays opaque (source thumb is not a track child)",
    target: "MUI track opacity as a separate node opacity",
    reason: "lowered",
  },
  {
    id: "refusal-ripple",
    evidence: "SwitchBase/ButtonBase ripple is code-only motion",
    target: "MUI TouchRipple",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-fcl-margin",
    evidence:
      "FormControlLabel.js marginLeft -11 is row-presentation alignment, not this mint's track",
    target: "FormControlLabel marginLeft -11",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color-axis",
    evidence: "Switch.js color default primary; other palette colors receipted",
    target: "MUI color secondary/error/info/success/warning",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-small",
    evidence:
      "Switch.js size small is width 40 height 24 padding 7 thumb 16 translateX 16; AntD SM and Astryx have no shared size axis",
    target: "MUI size small",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-inner-text",
    evidence:
      "genSwitchInnerStyle checkedChildren / unCheckedChildren ON/OFF text — optional, not the shared fixture label",
    target: "AntD inner ON/OFF children",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-loading",
    evidence: "genSwitchLoadingStyle loading icon — AntD-only",
    target: "AntD loading icon",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size-sm",
    evidence:
      "prepareComponentToken heightSM controlHeight/2 16; size is not a shared axis",
    target: "AntD size small",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover",
    evidence:
      "genSwitchStyle hover background colorTextTertiary / colorPrimaryHover — not this teaching",
    target: "AntD hover track",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-handle-shadow",
    evidence:
      "prepareComponentToken handleShadow 0 2px 4px FastColor #00230b 0.2 — not this teaching",
    target: "AntD handle shadow",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedSwitchSource,
  tokens: SwitchRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedSwitchSourceFact[],
  extraIr: ReviewedSwitchSourceFact[],
  unsupported: string[],
): ReviewedSwitchAdapterConfig => {
  const facts = [
    ...tokenFacts(
      slug,
      `${source.packageName} ${source.exportName} source review`,
      tokens,
    ),
    ...extraIr,
    ...refusals,
  ];
  const manualMappings = facts.map(
    (fact) => `${fact.occurrenceId}→${fact.disposition}:${fact.target}`,
  );
  return {
    sourcePath: `recipe/fixtures/library-switches.ts#${slug}SwitchAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "switch", version: 1 }],
      selectedBy: "recipe-pivot-switch-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-switches.ts#${slug}`,
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
  source: ReviewedSwitchSource,
): ReviewedSwitchSourceFact[] => [
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

export const astryxSwitchAdapterConfig = buildConfig(
  "astryx",
  astryxSwitchSource,
  astryxTokens,
  { id: "astryx.switch", name: "Astryx Switch" },
  astryxRefusals,
  anatomyFacts("astryx", astryxSwitchSource),
  ["isLoading", "description", "hover", "focus-visible", "labelPosition"],
);

export const muiSwitchAdapterConfig = buildConfig(
  "mui",
  muiSwitchSource,
  muiTokens,
  { id: "mui.switch", name: "MUI Switch" },
  muiRefusals,
  anatomyFacts("mui", muiSwitchSource),
  [
    "size-small",
    "color-secondary",
    "ripple",
    "FormControlLabel-marginLeft",
    "thumb-shadow",
  ],
);

export const antdSwitchAdapterConfig = buildConfig(
  "antd",
  antdSwitchSource,
  antdTokens,
  { id: "antd.switch", name: "Ant Design Switch" },
  antdRefusals,
  anatomyFacts("antd", antdSwitchSource),
  ["size-small", "loading", "checkedChildren", "hover", "handle-shadow"],
);

export const SWITCH_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "switch-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 4,
  totalCells: 12,
  sources: [
    "@astryxdesign/core@0.1.6#Switch",
    "@mui/material@9.2.0#Switch",
    "antd@5.29.3#Switch",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
