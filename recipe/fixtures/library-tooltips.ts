import type {
  ReviewedTooltipAdapterConfig,
  ReviewedTooltipSource,
  ReviewedTooltipSourceFact,
  TooltipFactCategory,
} from "../adapters/tooltip.js";
import { canonicalTooltipRecipeInstance } from "./tooltip.js";
import type { TooltipRecipeInstance } from "../recipes/tooltip.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): TooltipRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalTooltipRecipeInstance.tokens,
  ) as TooltipRecipeInstance["tokens"];
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

const astryxLabelFont = (): TooltipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "@astryxdesign/core/src/Tooltip/useTooltip.tsx styles.container --text-body-size 14 / --text-body-leading 1.4286 → 20",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK} Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular`,
});

const muiLabelFont = (): TooltipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Medium",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Tooltip/Tooltip.js fontSize pxToRem(11), fontWeightMedium 500",
  fallbackChain: [
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Medium",
  resolution: "requested",
});

const antdLabelFont = (): TooltipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/tooltip/style/index.js resetComponent; seed fontSize 14; lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.tooltip", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 8;
  if (path === "box.paddingY") return 4;
  if (path === "box.radius") return 12;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.boxFill") return "#0a1317ff";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#ffffffff";
  return fallback;
});
astryxTokens.strokeAlign = "inside";
astryxTokens.lineHeightUnit = "px";
astryxTokens.decoration = "none";
astryxTokens.typography = { label: astryxLabelFont() };

const muiTokens = cloneTokens("mui.tooltip", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 8;
  if (path === "box.paddingY") return 4;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 11;
  if (path === "labelLineHeight") return 0;
  if (path === "rest.boxFill") return "#616161eb";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#ffffffff";
  return fallback;
});
muiTokens.strokeAlign = "inside";
muiTokens.lineHeightUnit = "auto";
muiTokens.decoration = "none";
muiTokens.typography = { label: muiLabelFont() };

const antdTokens = cloneTokens("antd.tooltip", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 8;
  if (path === "box.paddingY") return 6;
  if (path === "box.radius") return 6;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "rest.boxFill") return "#000000d9";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#ffffffff";
  return fallback;
});
antdTokens.strokeAlign = "inside";
antdTokens.lineHeightUnit = "px";
antdTokens.decoration = "none";
antdTokens.typography = { label: antdLabelFont() };

export const astryxTooltipSource: ReviewedTooltipSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Tooltip",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Tooltip",
  anatomy: {
    root: "useTooltip.tsx inverted bubble. placement default above. No named arrow. Do not invent Polar attachment.",
    control:
      "styles.container --color-text-primary #0A1317 on --color-background-surface #FFFFFF; --radius-container 12; content padding --spacing-1 4 / --spacing-2 8",
    label: "example content Tooltip. --text-body-size 14 / leading 1.4286 → 20 Regular",
  },
  api: {
    placement: "above default — not a shared axis; Polar receipted",
    extras: "alignment, delay 200, hover indication, isOpen receipted",
  },
  styleSources: [
    "Tooltip/useTooltip.tsx styles.container + styles.content",
    "src/theme/tokens.stylex.ts --radius-container 12, --spacing-1 4, --spacing-2 8, --color-text-primary #0A1317",
  ],
  fontSources: ["useTooltip.tsx --text-body-size 14 Regular"],
};

export const muiTooltipSource: ReviewedTooltipSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Tooltip",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Tooltip",
  anatomy: {
    root: "Tooltip.js TooltipTooltip padding 4 8, radius 4, arrow default false, placement default bottom",
    control:
      "background alpha(grey[700], 0.92) #616161eb; color common.white. Do not compile the arrow or Polar 14px margin.",
    label: "fontSize pxToRem(11) Medium. lineHeight inherit → IR auto",
  },
  api: {
    placement: "bottom default — not a shared axis",
    extras: "arrow false default, touch, followCursor receipted",
  },
  styleSources: [
    "Tooltip/Tooltip.js TooltipTooltip padding 4px 8px, grey[700] 0.92, shape.borderRadius 4",
  ],
  fontSources: ["Tooltip.js pxToRem(11) Roboto Medium"],
};

export const antdTooltipSource: ReviewedTooltipSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Tooltip",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/tooltip",
  anatomy: {
    root: "tooltip/index.js placement top, arrow true. Compile the inner bubble, not the Polar arrow.",
    control:
      "inner padding paddingSM/2=6 × paddingXS=8; borderRadius 6; colorBgSpotlight #000000d9; colorTextLightSolid #fff",
    label: "resetComponent fontSize 14 / lineHeight 22. minHeight controlHeight 32 is satisfied by hug 6+22+6",
  },
  api: {
    placement: "top default — not a shared axis",
    extras: "arrow true default Polar receipted, color presets receipted",
  },
  styleSources: [
    "antd/es/tooltip/style/index.js genTooltipStyle inner + prepareComponentToken",
    "antd/es/theme/themes/default/colors.js colorBgSpotlight getAlphaColor(colorTextBase, 0.85)",
  ],
  fontSources: ["antd seed fontSize 14; resetComponent lineHeight 22"],
};

const categoryForToken = (path: string): TooltipFactCategory => {
  if (path.includes("typography") || path.includes("decoration") || path.includes("lineHeight"))
    return "typography";
  if (path.includes("boxOpacity")) return "state";
  if (
    path.includes("boxFill") ||
    path.includes("boxBorder") ||
    path.endsWith(".label") ||
    path.includes("rest")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedTooltipSourceFact[] = [],
): ReviewedTooltipSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.strokeAlign" ||
      path === "tokens.decoration" ||
      path === "tokens.lineHeightUnit"
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: path === "tokens.strokeAlign" ? "anatomy" : "typography",
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

const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedTooltipSourceFact[] =>
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
    id: "refusal-polar",
    evidence: "placement above + CSS anchor — Polar attachment is not invented",
    target: "Astryx Tooltip Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-hover-indication",
    evidence: "hasHoverIndication dashed underline on the trigger — not the bubble",
    target: "Astryx Tooltip hover indication",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-delay",
    evidence: "delay 200 / HOVER_BRIDGE_DELAY 100 — not a rest cell",
    target: "Astryx Tooltip delay",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-polar",
    evidence: "placement bottom + 14px popper margin — Polar attachment is not invented",
    target: "MUI Tooltip Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-arrow",
    evidence: "arrow default false — do not invent an arrow cell",
    target: "MUI Tooltip arrow",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-touch",
    evidence: "touch padding 8/16 and font 14 — not the named rest cell",
    target: "MUI Tooltip touch",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-polar",
    evidence: "placement top — Polar attachment is not invented",
    target: "AntD Tooltip Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-arrow",
    evidence: "arrow default true — Polar arrow position is not invented",
    target: "AntD Tooltip arrow",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-shadow",
    evidence: "boxShadowSecondary — not compiled as Polar chrome",
    target: "AntD Tooltip boxShadowSecondary",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedTooltipSource,
  tokens: TooltipRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedTooltipSourceFact[],
  extraIr: ReviewedTooltipSourceFact[],
  unsupported: string[],
): ReviewedTooltipAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-tooltips.ts#${slug}TooltipAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "tooltip", version: 1 }],
      selectedBy: "recipe-pivot-tooltip-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-tooltips.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: { label: "Tooltip" },
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} open bubble`,
      setupSeconds: 8,
      sourceHarness: source.sourceRoot,
      sourceMatrixCells: 1,
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
  source: ReviewedTooltipSource,
): ReviewedTooltipSourceFact[] => [
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

export const astryxTooltipAdapterConfig = buildConfig(
  "astryx",
  astryxTooltipSource,
  astryxTokens,
  { id: "astryx.tooltip", name: "Astryx Tooltip" },
  astryxRefusals,
  anatomyFacts("astryx", astryxTooltipSource),
  ["Polar-placement", "hover-indication", "delay"],
);

export const muiTooltipAdapterConfig = buildConfig(
  "mui",
  muiTooltipSource,
  muiTokens,
  { id: "mui.tooltip", name: "MUI Tooltip" },
  muiRefusals,
  anatomyFacts("mui", muiTooltipSource),
  ["Polar-placement", "arrow", "touch"],
);

export const antdTooltipAdapterConfig = buildConfig(
  "antd",
  antdTooltipSource,
  antdTokens,
  { id: "antd.tooltip", name: "Ant Design Tooltip" },
  antdRefusals,
  anatomyFacts("antd", antdTooltipSource),
  ["Polar-placement", "arrow", "boxShadowSecondary"],
);

export const TOOLTIP_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "tooltip-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#Tooltip",
    "@mui/material@9.2.0#Tooltip",
    "antd@5.29.3#Tooltip",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
