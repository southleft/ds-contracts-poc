import type {
  ReviewedBadgeAdapterConfig,
  ReviewedBadgeSource,
  ReviewedBadgeSourceFact,
  BadgeFactCategory,
} from "../adapters/badge.js";
import { canonicalBadgeRecipeInstance } from "./badge.js";
import type { BadgeRecipeInstance } from "../recipes/badge.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): BadgeRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalBadgeRecipeInstance.tokens,
  ) as BadgeRecipeInstance["tokens"];
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

const muiLabelFont = (): BadgeRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Medium",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Badge/Badge.js BadgeBadge fontSize pxToRem(12), fontWeightMedium, lineHeight 1",
  fallbackChain: [
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Medium",
  resolution: "requested",
});

const antdLabelFont = (): BadgeRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/badge/style/index.js textFontSize fontSizeSM 12; textFontWeight normal",
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

const muiTokens = cloneTokens("mui.badge", (path, fallback) => {
  if (path === "host.size") return 40;
  if (path === "host.radius") return 20;
  if (path === "host.fill") return "#bdbdbdff";
  if (path === "indicator.height") return 20;
  if (path === "indicator.minWidth") return 20;
  if (path === "indicator.paddingX") return 6;
  if (path === "indicator.radius") return 10;
  if (path === "indicator.borderWidth") return 0;
  // overlap="circular" — the mount the capture records (configs/mui.json
  // Badge fixedProps.overlap). Badge.js circular anchorOrigin top-right:
  // top 14%, right 14%, then translate(50%, -50%). On the 40px Avatar host
  // that is a 5.6px inset from the corner, so the indicator's box sits at
  // ±(10 − 5.6) = ±4.4 from the docked top-right position — not ±10, which
  // is the rectangular overlap and measured 50x50 against a 44x44 render.
  if (path === "indicator.translateX") return 4.40625; // 10 − 5.59375 (captured right)
  if (path === "indicator.translateY") return -4.40625; // −10 + 5.59375 (captured top)
  if (path === "indicator.fill") return "#d32f2fff";
  if (path === "indicator.border") return "#00000000";
  if (path === "indicator.opacity") return 1;
  if (path === "labelFontSize") return 12;
  if (path === "labelLineHeight") return 12;
  if (path === "label") return "#ffffffff";
  return fallback;
});
muiTokens.strokeAlign = "inside";
muiTokens.typography = { label: muiLabelFont() };

const antdTokens = cloneTokens("antd.badge", (path, fallback) => {
  if (path === "host.size") return 32;
  // The capture's child is <Avatar shape="square"> (configs/antd.json Badge
  // childrenSpec): antd Avatar square border-radius = borderRadius token 6,
  // not the 16 of a circle. The child is the consumer's; its box is what the
  // indicator anchors to, so it must be the box the capture rendered.
  if (path === "host.radius") return 6;
  if (path === "host.fill") return "#00000040";
  if (path === "indicator.height") return 20;
  if (path === "indicator.minWidth") return 20;
  if (path === "indicator.paddingX") return 0;
  if (path === "indicator.radius") return 10;
  if (path === "indicator.borderWidth") return 1;
  if (path === "indicator.translateX") return 10;
  if (path === "indicator.translateY") return -10;
  if (path === "indicator.fill") return "#ff4d4fff";
  if (path === "indicator.border") return "#ffffffff";
  if (path === "indicator.opacity") return 1;
  if (path === "labelFontSize") return 12;
  if (path === "labelLineHeight") return 20;
  if (path === "label") return "#ffffffff";
  return fallback;
});
antdTokens.strokeAlign = "outside";
antdTokens.typography = { label: antdLabelFont() };

export const muiBadgeSource: ReviewedBadgeSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Badge",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Badge",
  anatomy: {
    root: "Badge.js BadgeRoot relative inline-flex. BadgeBadge absolute.",
    host: "Avatar.js default circular 40 — the child Badge proofs mount. Avatar stay compiles the real Avatar.",
    indicator:
      "RADIUS_STANDARD 10 → height/minWidth 20, radius 10, padding 0 6. Docs Color demo people see is color=error (palette.error.main #d32f2f / contrast #fff). color=default has no palette.main — receipted, not the proof cell. translate 50%,-50% = ±10.",
    label:
      "pxToRem(12) Medium lineHeight 1. Visible content 5 — AntD seed; both hide when count is null.",
  },
  api: {
    variant: "standard default; dot receipted",
    color: "docs Color demo error; color=default has no palette fill and is receipted",
    extras: "max 99, invisible, showZero receipted; overlap circular is the compiled proof cell (the capture mounts it)",
  },
  styleSources: [
    "Badge/Badge.js RADIUS_STANDARD 10, anchor top-right rectangular, color error from the documented Color demo (palette.error.main). color=default has no backgroundColor.",
    "Avatar/Avatar.js width/height 40 circular grey[400]",
  ],
  fontSources: ["Badge.js pxToRem(12) Roboto Medium"],
};

export const antdBadgeSource: ReviewedBadgeSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Badge",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/badge",
  anatomy: {
    root: "badge/index.js count default null (hidden). Overlay when children present.",
    host: "Avatar containerSize = controlHeight 32 circular. colorTextPlaceholder host fill. Avatar stay compiles the real Avatar.",
    indicator:
      "prepareComponentToken indicatorHeight Math.round(14*1.5714)-2 = 20. badgeColor colorError #ff4d4f. shadow lineWidth 1 colorBorderBg #fff. translate(50%,-50%).",
    label:
      "textFontSize fontSizeSM 12; lineHeight indicatorHeight 20; colorTextLightSolid #fff. Count 5 is the seed visible cell.",
  },
  api: {
    count: "null default — hidden. Visible seed 5.",
    extras: "dot, status/text, Ribbon, size small, offset, presets receipted",
  },
  styleSources: [
    "antd/es/badge/style/index.js prepareToken + prepareComponentToken",
    "antd/es/avatar/style/index.js containerSize controlHeight 32",
  ],
  fontSources: ["fontSizeSM 12 Regular"],
};

export const astryxBadgeOverlayRefusal = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Badge",
  reason:
    "Astryx Badge is an inline status label (height 20, padX 8, radius-full, variant neutral). It is not an anchored overlay. Do not invent an Astryx pip. Do not remint Token.",
  source:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Badge/Badge.tsx",
} as const;

const categoryForToken = (path: string): BadgeFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("opacity")) return "state";
  if (
    path.includes(".fill") ||
    path.includes(".border") ||
    path.endsWith(".label") ||
    path.includes("Fill") ||
    path.includes("Border")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedBadgeSourceFact[] = [],
): ReviewedBadgeSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (path.startsWith("tokens.typography") || path === "tokens.strokeAlign") {
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
): ReviewedBadgeSourceFact[] =>
  rows.map((row) => ({
    occurrenceId: `${slug}-${row.id}`,
    category: "refusal" as const,
    source: { kind: "review" as const, evidence: row.evidence },
    disposition: "refusal" as const,
    target: row.target,
    receiptReason: row.reason,
  }));

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-astryx-overlay",
    evidence: astryxBadgeOverlayRefusal.reason,
    target: "Astryx anchored overlay",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color-default",
    evidence:
      "Badge.js styles backgroundColor only when color !== 'default'. color=default is unfilled — that is why the prior stay looked like a bare 5. Proof cell is the documented Color demo color=error (#d32f2f / #fff). Do not paint a fake pill on color=default.",
    target: "MUI color=default unfilled badge",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dot",
    evidence: "variant dot 8×8 — not the named standard default",
    target: "MUI Badge variant=dot",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color-axis",
    evidence: "color palettes are not a shared 3-way axis",
    target: "shared Color axis",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-astryx-overlay",
    evidence: astryxBadgeOverlayRefusal.reason,
    target: "Astryx anchored overlay",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dot",
    evidence: "dot default false — not the named count cell",
    target: "AntD Badge dot",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-status",
    evidence: "status/text standalone is a different root composition",
    target: "AntD Badge status",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-ribbon",
    evidence: "Ribbon is a different export composition",
    target: "AntD Badge.Ribbon",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedBadgeSource,
  tokens: BadgeRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedBadgeSourceFact[],
  extraIr: ReviewedBadgeSourceFact[],
  unsupported: string[],
): ReviewedBadgeAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-badges.ts#${slug}BadgeAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "badge", version: 1 }],
      selectedBy: "recipe-pivot-badge-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-badges.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    // mui: the capture mounts badgeContent 4 (configs/mui.json Badge fixedProps).
    content: { count: slug === "mui" ? "4" : "5" },
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} overlay default cell`,
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
  source: ReviewedBadgeSource,
): ReviewedBadgeSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-label`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.count",
  },
];

export const muiBadgeAdapterConfig = buildConfig(
  "mui",
  muiBadgeSource,
  muiTokens,
  { id: "mui.badge", name: "MUI Badge" },
  muiRefusals,
  anatomyFacts("mui", muiBadgeSource),
  ["color-error-as-default", "dot", "max", "invisible"],
);

export const antdBadgeAdapterConfig = buildConfig(
  "antd",
  antdBadgeSource,
  antdTokens,
  { id: "antd.badge", name: "Ant Design Badge" },
  antdRefusals,
  anatomyFacts("antd", antdBadgeSource),
  ["dot", "status", "Ribbon", "size-small", "preset-color", "offset"],
);

export const BADGE_OVERLAY_PROOF_PROTOCOL = {
  artifactVersion: "badge-overlay-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  overlaySources: 2,
  namedRefusals: 1,
  totalCells: 2,
  sources: ["@mui/material@9.2.0#Badge", "antd@5.29.3#Badge"],
  refused: ["@astryxdesign/core@0.1.6#Badge overlay"],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
