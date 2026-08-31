import type {
  ReviewedDialogAdapterConfig,
  ReviewedDialogSource,
  ReviewedDialogSourceFact,
  DialogFactCategory,
} from "../adapters/dialog.js";
import { canonicalDialogRecipeInstance } from "./dialog.js";
import type { DialogRecipeInstance } from "../recipes/dialog.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): DialogRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalDialogRecipeInstance.tokens,
  ) as DialogRecipeInstance["tokens"];
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

const astryxTitleFont =
  (): DialogRecipeInstance["tokens"]["typography"]["title"] => ({
    requestedFamily: "-apple-system",
    requestedStyle: "Semibold",
    requestSource:
      "DialogHeader Heading level 2 --text-heading-2-size 20 / --text-heading-2-leading 1.4 → 28 Semibold",
    fallbackChain: [
      { family: "-apple-system", style: "Semibold" },
      { family: "SF Pro", style: "Semibold" },
      { family: "Roboto", style: "Medium" },
      { family: "Helvetica", style: "Bold" },
      { family: "Arial", style: "Bold" },
    ],
    resolvedFamily: "SF Pro",
    resolvedStyle: "Semibold",
    resolution: "fallback",
    degradation: `source ${ASTRYX_BODY_STACK} Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold`,
  });

const astryxBodyFont =
  (): DialogRecipeInstance["tokens"]["typography"]["body"] => ({
    requestedFamily: "-apple-system",
    requestedStyle: "Regular",
    requestSource:
      "Dialog children Layout content; Text body --text-label-size 14 / 20 Regular --color-text-primary",
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

const muiTitleFont =
  (): DialogRecipeInstance["tokens"]["typography"]["title"] => ({
    requestedFamily: "Roboto",
    requestedStyle: "Medium",
    requestSource:
      "DialogTitle variant h6; createTypography h6 fontWeightMedium 20 lineHeight 1.6 → 32",
    fallbackChain: [
      { family: "Roboto", style: "Medium" },
      { family: "Helvetica", style: "Bold" },
      { family: "Arial", style: "Bold" },
    ],
    resolvedFamily: "Roboto",
    resolvedStyle: "Medium",
    resolution: "requested",
  });

const muiBodyFont =
  (): DialogRecipeInstance["tokens"]["typography"]["body"] => ({
    requestedFamily: "Roboto",
    requestedStyle: "Regular",
    requestSource:
      "DialogContent inherits theme.typography.body1 16 Regular lineHeight 1.5 → 24",
    fallbackChain: [
      { family: "Roboto", style: "Regular" },
      { family: "Helvetica", style: "Regular" },
      { family: "Arial", style: "Regular" },
    ],
    resolvedFamily: "Roboto",
    resolvedStyle: "Regular",
    resolution: "requested",
  });

const antdTitleFont =
  (): DialogRecipeInstance["tokens"]["typography"]["title"] => ({
    requestedFamily: "-apple-system",
    requestedStyle: "Semibold",
    requestSource:
      "antd Modal titleFontSize fontSizeHeading5 16; titleLineHeight lineHeightHeading5 1.5 → 24; fontWeightStrong",
    fallbackChain: [
      { family: "-apple-system", style: "Semibold" },
      { family: "SF Pro", style: "Semibold" },
      { family: "Roboto", style: "Medium" },
      { family: "Helvetica Neue", style: "Bold" },
      { family: "Arial", style: "Bold" },
    ],
    resolvedFamily: "SF Pro",
    resolvedStyle: "Semibold",
    resolution: "fallback",
    degradation:
      "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Semibold",
  });

const antdBodyFont =
  (): DialogRecipeInstance["tokens"]["typography"]["body"] => ({
    requestedFamily: "-apple-system",
    requestedStyle: "Regular",
    requestSource:
      "antd/es/modal/style body fontSize 14; resetComponent lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.dialog", (path, fallback) => {
  if (path === "paper.paddingX") return 16;
  if (path === "paper.paddingY") return 16;
  if (path === "paper.radius") return 12;
  if (path === "paper.itemSpacing") return 0;
  if (path === "paper.minWidth") return 400;
  if (path === "paper.fill") return "#ffffffff";
  if (path === "titleFontSize") return 20;
  if (path === "titleLineHeight") return 28;
  if (path === "bodyFontSize") return 14;
  if (path === "bodyLineHeight") return 20;
  if (path === "title") return "#0a1317ff";
  if (path === "body") return "#0a1317ff";
  return fallback;
});
astryxTokens.lineHeightUnit = "px";
astryxTokens.typography = { title: astryxTitleFont(), body: astryxBodyFont() };

const muiTokens = cloneTokens("mui.dialog", (path, fallback) => {
  if (path === "paper.paddingX") return 24;
  if (path === "paper.paddingY") return 16;
  if (path === "paper.radius") return 4;
  if (path === "paper.itemSpacing") return 0;
  if (path === "paper.minWidth") return 600;
  if (path === "paper.fill") return "#ffffffff";
  if (path === "titleFontSize") return 20;
  if (path === "titleLineHeight") return 32;
  if (path === "bodyFontSize") return 16;
  if (path === "bodyLineHeight") return 24;
  if (path === "title") return "#000000de";
  if (path === "body") return "#000000de";
  return fallback;
});
muiTokens.lineHeightUnit = "px";
muiTokens.typography = { title: muiTitleFont(), body: muiBodyFont() };

const antdTokens = cloneTokens("antd.dialog", (path, fallback) => {
  if (path === "paper.paddingX") return 24;
  if (path === "paper.paddingY") return 20;
  if (path === "paper.radius") return 8;
  if (path === "paper.itemSpacing") return 8;
  if (path === "paper.minWidth") return 520;
  if (path === "paper.fill") return "#ffffffff";
  if (path === "titleFontSize") return 16;
  if (path === "titleLineHeight") return 24;
  if (path === "bodyFontSize") return 14;
  if (path === "bodyLineHeight") return 22;
  if (path === "title") return "#000000e0";
  if (path === "body") return "#000000e0";
  return fallback;
});
antdTokens.lineHeightUnit = "px";
antdTokens.typography = { title: antdTitleFont(), body: antdBodyFont() };

export const astryxDialogSource: ReviewedDialogSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Dialog",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Dialog",
  anatomy: {
    root: "Dialog.tsx standard variant. ::backdrop Polar viewport receipted. Paper hugs; named width default 400.",
    control:
      "background --color-background-surface #FFFFFF; --radius-container 12; theme dialog padding --astryx-dialog-padding fallback --spacing-4 16. Heading 2 20/28 Semibold --color-text-primary.",
    title: "Dialog title / Dialog body",
  },
  api: {
    export: "Dialog — not AlertDialog",
    extras: "fullscreen, position, shadow-high, close, animation receipted",
  },
  styleSources: [
    "Dialog/Dialog.tsx styles.dialog + styles.backdrop + default width 400",
    "Layout/container.stylex.ts dialogShorthand --astryx-dialog-padding / --spacing-4",
    "theme/tokens.stylex.ts --color-background-surface --color-overlay --radius-container --text-heading-2",
    "Dialog/DialogHeader.tsx Heading level 2",
  ],
  fontSources: ["Heading level 2 20 Semibold; Text body 14 Regular"],
};

export const muiDialogSource: ReviewedDialogSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Dialog",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Dialog",
  anatomy: {
    root: "Dialog.js maxWidth sm default. Backdrop Polar inset 0 receipted. Paper named maxWidth 600.",
    control:
      "Paper background.paper #fff; shape.borderRadius 4; elevation 24 receipted. DialogTitle pad 16 24 h6 20/32 Medium. DialogContent pad 20 24 receipted vs title 16.",
    title: "Dialog title / Dialog body",
  },
  api: {
    maxWidth: "sm default",
    extras: "centering, Fade, fullScreen, DialogActions receipted",
  },
  styleSources: [
    "Dialog/Dialog.js DialogPaper maxWidth sm 600 elevation 24",
    "DialogTitle/DialogTitle.js padding 16px 24px variant h6",
    "DialogContent/DialogContent.js padding 20px 24px",
    "Backdrop/Backdrop.js rgba(0,0,0,0.5)",
    "@mui/system createBreakpoints sm 600",
    "createTypography h6 fontWeightMedium 20 1.6",
  ],
  fontSources: ["DialogTitle h6 Roboto Medium 20; body1 Roboto Regular 16"],
};

export const antdDialogSource: ReviewedDialogSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Modal",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/modal",
  anatomy: {
    root: "antd/es/modal Modal — compile Modal, not Dialog. Mask Polar inset 0 and top 100 receipted. Named width default 520.",
    control:
      "contentBg colorBgElevated #fff; borderRadiusLG 8; contentPadding paddingMD 20 / paddingContentHorizontalLG 24; headerMarginBottom marginXS 8.",
    title: "Dialog title / Dialog body",
  },
  api: {
    export: "Modal",
    extras: "centered, close, footer, zoom, colorBgMask Polar size receipted",
  },
  styleSources: [
    "antd/es/modal/Modal.js width default 520",
    "antd/es/modal/style/index.js genModalStyle + prepareComponentToken + genModalMaskStyle",
    "antd/es/theme seed + genSizeMapToken + genFontMapToken + genRadius + genColorMapToken colorBgMask",
  ],
  fontSources: [
    "title fontSizeHeading5 16 / lineHeightHeading5 1.5 → 24; body 14/22",
  ],
};

const categoryForToken = (path: string): DialogFactCategory => {
  if (
    path.includes("typography") ||
    path.includes("lineHeight") ||
    path.includes("FontSize")
  )
    return "typography";
  if (path.includes("minWidth")) return "state";
  if (path.includes("fill") || path === "tokens.title" || path === "tokens.body")
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedDialogSourceFact[] = [],
): ReviewedDialogSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (path.startsWith("tokens.typography") || path === "tokens.lineHeightUnit") {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: "typography",
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
): ReviewedDialogSourceFact[] =>
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
    id: "refusal-scrim",
    evidence:
      "::backdrop --color-overlay #01122866 is named; Polar viewport size is not invented",
    target: "Astryx Dialog ::backdrop Polar viewport",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-center",
    evidence: "margin auto / getDialogDirection centering is not invented",
    target: "Astryx Dialog Polar center",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-shadow",
    evidence: "--shadow-high is layered chrome — receipted",
    target: "Astryx Dialog shadow-high",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-scrim",
    evidence:
      "Backdrop rgba(0,0,0,0.5) is named; Polar inset 0 viewport is not invented",
    target: "MUI Dialog Backdrop Polar viewport",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-center",
    evidence: "DialogContainer flex center / Paper margin 32 is not invented",
    target: "MUI Dialog Polar center",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-elevation",
    evidence: "Paper elevation 24 shadow is not compiled as overlay chrome",
    target: "MUI Dialog elevation",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-scrim",
    evidence:
      "colorBgMask rgba(0,0,0,0.45) is named; Polar mask inset 0 is not invented",
    target: "AntD Modal mask Polar viewport",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-top",
    evidence: "Modal top: 100 default is Polar — not invented as a canvas Y",
    target: "AntD Modal Polar top 100",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-shadow",
    evidence: "boxShadow on content is not compiled as Polar chrome",
    target: "AntD Modal boxShadow",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedDialogSource,
  tokens: DialogRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedDialogSourceFact[],
  extraIr: ReviewedDialogSourceFact[],
  unsupported: string[],
): ReviewedDialogAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-dialogs.ts#${slug}DialogAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "dialog", version: 1 }],
      selectedBy: "recipe-pivot-dialog-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-dialogs.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: { title: "Dialog title", body: "Dialog body" },
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} open paper`,
      setupSeconds: 10,
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
  source: ReviewedDialogSource,
): ReviewedDialogSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-title`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/title",
      expected: source.anatomy.title,
    },
    disposition: "ir",
    target: "content.title",
  },
  {
    occurrenceId: `${slug}-anatomy-body`,
    category: "anatomy",
    source: {
      kind: "review",
      evidence: `${source.anatomy.root}; body is Dialog body`,
    },
    disposition: "ir",
    target: "content.body",
  },
];

export const astryxDialogAdapterConfig = buildConfig(
  "astryx",
  astryxDialogSource,
  astryxTokens,
  { id: "astryx.dialog", name: "Astryx Dialog" },
  astryxRefusals,
  anatomyFacts("astryx", astryxDialogSource),
  ["Polar-viewport-scrim", "Polar-center", "shadow-high"],
);

export const muiDialogAdapterConfig = buildConfig(
  "mui",
  muiDialogSource,
  muiTokens,
  { id: "mui.dialog", name: "MUI Dialog" },
  muiRefusals,
  anatomyFacts("mui", muiDialogSource),
  ["Polar-viewport-scrim", "Polar-center", "elevation"],
);

export const antdDialogAdapterConfig = buildConfig(
  "antd",
  antdDialogSource,
  antdTokens,
  { id: "antd.dialog", name: "Ant Design Modal" },
  antdRefusals,
  anatomyFacts("antd", antdDialogSource),
  ["Polar-viewport-scrim", "Polar-top-100", "boxShadow"],
);

export const DIALOG_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "dialog-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#Dialog",
    "@mui/material@9.2.0#Dialog",
    "antd@5.29.3#Modal",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
