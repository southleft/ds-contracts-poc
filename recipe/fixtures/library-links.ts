import type {
  ReviewedLinkAdapterConfig,
  ReviewedLinkSource,
  ReviewedLinkSourceFact,
  LinkFactCategory,
} from "../adapters/link.js";
import { canonicalLinkRecipeInstance } from "./link.js";
import type { LinkRecipeInstance } from "../recipes/link.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): LinkRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalLinkRecipeInstance.tokens,
  ) as LinkRecipeInstance["tokens"];
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

const astryxLabelFont = (): LinkRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "@astryxdesign/core/src/Link/Link.tsx Text type=body → --text-body-size 14 / --text-body-weight normal / --font-family-body",
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

const muiLabelFont = (): LinkRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Link/Link.js variant inherit; theme.typography.fontSize 14 is the named theme root, not body1 16",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdLabelFont = (): LinkRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/theme/themes/seed.js fontSize 14; Typography resetComponent lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.link", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 0;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.boxFill") return "#00000000";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#0064e0ff";
  return fallback;
});
astryxTokens.strokeAlign = "inside";
astryxTokens.lineHeightUnit = "px";
astryxTokens.decoration = "none";
astryxTokens.typography = { label: astryxLabelFont() };

const muiTokens = cloneTokens("mui.link", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 0;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 0;
  if (path === "rest.boxFill") return "#00000000";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#1976d2ff";
  return fallback;
});
muiTokens.strokeAlign = "inside";
muiTokens.lineHeightUnit = "auto";
muiTokens.decoration = "underline";
muiTokens.typography = { label: muiLabelFont() };

const antdTokens = cloneTokens("antd.link", (path, fallback) => {
  if (path === "box.height") return 0;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 0;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "rest.boxFill") return "#00000000";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#1677ffff";
  return fallback;
});
antdTokens.strokeAlign = "inside";
antdTokens.lineHeightUnit = "px";
antdTokens.decoration = "none";
antdTokens.typography = { label: antdLabelFont() };

export const astryxLinkSource: ReviewedLinkSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Link",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Link",
  anatomy: {
    root: "Link.tsx wraps Text type=body color=accent. hasUnderline default false → rest decoration none. isStandalone default false; Text still supplies body metrics.",
    control:
      "inline-flex; gap --spacing-0-5 2 only when an icon is present. No box chrome. Do not compile hover underline or the external icon.",
    label:
      "example children Link. --text-body-size 14 / --text-body-leading 1.4286 → 20 / --text-body-weight normal. --color-accent light #0064E0",
  },
  api: {
    hasUnderline: "default false — rest none; not a shared axis",
    color: "default accent — not a shared axis",
    extras: "isExternalLink, isDisabled, isStandalone, type inherit, href-less button receipted",
  },
  styleSources: [
    "Link/Link.tsx styles.base textDecoration default none + :hover underline",
    "Link/Link.tsx linkColorStyles.accent → --color-accent",
    "src/theme/tokens.stylex.ts --text-body-size 14, --text-body-leading 1.4286, --color-accent light-dark(#0064E0)",
  ],
  fontSources: ["Link.tsx Text type=body Regular 14/20"],
};

export const muiLinkSource: ReviewedLinkSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Link",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Link",
  anatomy: {
    root: "Link.js LinkRoot component a, variant inherit, underline always, color primary",
    control:
      "underline=always → textDecoration underline at rest. Do not compile hover/none or color palettes.",
    label:
      "variant inherit has no intrinsic scale. Canvas uses theme.typography.fontSize 14 (createTypography.js), not body1 16. palette.primary.main blue[700] #1976d2",
  },
  api: {
    underline: "always default; hover/none receipted",
    color: "primary default; secondary…warning receipted",
    extras: "component=button, focusVisible receipted",
  },
  styleSources: [
    "Link/Link.js underlineAlways textDecoration underline",
    "styles/createPalette.js getDefaultPrimary light blue[700] #1976d2",
    "styles/createTypography.js fontSize 14; inherit variant fontSize inherit",
  ],
  fontSources: [
    "theme.typography.fontSize 14 Roboto Regular; inherit lineHeight is inherit → IR auto",
  ],
};

export const antdLinkSource: ReviewedLinkSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Typography.Link",
  framework: "react",
  sourceRoot:
    "examples/antd/.antd-sandbox/node_modules/antd/es/typography",
  anatomy: {
    root: "antd/es/typography/Link.js → Base component a. There is no top-level antd/es/link — do not invent one.",
    control:
      "es/style/index.js operationUnit / genLinkStyle textDecoration token.linkDecoration. alias.js linkDecoration none.",
    label:
      "colorLink seed empty → colorInfo #1677ff; genColorMapToken colorLink = palette[6] #1677ff. fontSize 14; lineHeight 1.5714 → 22",
  },
  api: {
    namedAbsence: "no top-level Link export",
    extras: "ellipsis, copyable/editable Typography extras, target=_blank rel default receipted",
  },
  styleSources: [
    "antd/es/typography/Link.js Base component a",
    "antd/es/theme/util/alias.js linkDecoration none",
    "antd/es/theme/themes/seed.js colorInfo #1677ff colorLink ''",
    "antd/es/style/index.js textDecoration token.linkDecoration",
  ],
  fontSources: ["antd seed fontSize 14; Typography lineHeight 22"],
};

const categoryForToken = (path: string): LinkFactCategory => {
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
  facts: ReviewedLinkSourceFact[] = [],
): ReviewedLinkSourceFact[] => {
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
): ReviewedLinkSourceFact[] =>
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
    id: "refusal-hasUnderline",
    evidence: "hasUnderline default false; underline-at-rest is not a shared axis",
    target: "Astryx Link hasUnderline",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover",
    evidence: "hover underline + color-mix 15% tint — a state, not a rest cell",
    target: "Astryx Link hover",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-external",
    evidence: "isExternalLink icon + VisuallyHidden — not shared",
    target: "Astryx Link isExternalLink",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color",
    evidence: "color palettes besides default accent — not a shared axis",
    target: "Astryx Link color besides accent",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-disabled",
    evidence: "isDisabled opacity 0.5 — not a shared axis",
    target: "Astryx Link isDisabled",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-underline-hover",
    evidence: "underline hover/none — underline-at-rest is not a shared axis",
    target: "MUI Link underline hover/none",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color",
    evidence: "color secondary…warning — primary is the named default",
    target: "MUI Link color besides primary",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-button",
    evidence: "component=button — compile the named a",
    target: "MUI Link component=button",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-body1",
    evidence: "variant inherit has no intrinsic scale; do not invent body1 16 as the Link default",
    target: "MUI Link body1",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-toplevel",
    evidence: "antd has no top-level Link; compile Typography.Link — do not invent antd/es/link",
    target: "AntD top-level Link",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-ellipsis",
    evidence: "Typography ellipsis — not a shared axis",
    target: "AntD Typography.Link ellipsis",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-hover",
    evidence: "linkHoverDecoration none — hover is not a rest cell",
    target: "AntD Link hover",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-copyable",
    evidence: "copyable/editable Typography extras — not this teaching",
    target: "AntD Typography extras",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedLinkSource,
  tokens: LinkRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedLinkSourceFact[],
  extraIr: ReviewedLinkSourceFact[],
  unsupported: string[],
): ReviewedLinkAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-links.ts#${slug}LinkAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "link", version: 1 }],
      selectedBy: "recipe-pivot-link-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-links.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: { label: "Link" },
    tokens: structuredClone(tokens),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} default cell`,
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
  source: ReviewedLinkSource,
): ReviewedLinkSourceFact[] => [
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

export const astryxLinkAdapterConfig = buildConfig(
  "astryx",
  astryxLinkSource,
  astryxTokens,
  { id: "astryx.link", name: "Astryx Link" },
  astryxRefusals,
  anatomyFacts("astryx", astryxLinkSource),
  ["hasUnderline", "hover", "isExternalLink", "color-palettes", "isDisabled"],
);

export const muiLinkAdapterConfig = buildConfig(
  "mui",
  muiLinkSource,
  muiTokens,
  { id: "mui.link", name: "MUI Link" },
  muiRefusals,
  anatomyFacts("mui", muiLinkSource),
  ["underline-hover-none", "color-palettes", "component-button", "body1"],
);

export const antdLinkAdapterConfig = buildConfig(
  "antd",
  antdLinkSource,
  antdTokens,
  { id: "antd.link", name: "Ant Design Typography.Link" },
  antdRefusals,
  anatomyFacts("antd", antdLinkSource),
  ["top-level-Link", "ellipsis", "hover", "copyable-editable"],
);

export const LINK_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "link-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#Link",
    "@mui/material@9.2.0#Link",
    "antd@5.29.3#Typography.Link",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
