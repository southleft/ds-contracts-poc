import type {
  ReviewedChipAdapterConfig,
  ReviewedChipSource,
  ReviewedChipSourceFact,
  ChipFactCategory,
} from "../adapters/chip.js";
import { canonicalChipRecipeInstance } from "./chip.js";
import type { ChipRecipeInstance } from "../recipes/chip.js";

export const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): ChipRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalChipRecipeInstance.tokens,
  ) as ChipRecipeInstance["tokens"];
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

const astryxLabelFont = (): ChipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  requestSource:
    "@astryxdesign/core/src/Token/Token.tsx styles.base fontFamily inherit / --font-family-body, --text-supporting-size 12, --font-weight-medium",
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
  degradation: `source ${ASTRYX_BODY_STACK} Medium; Figma cannot load a CSS stack; first named host font is SF Pro Medium`,
});

const muiLabelFont = (): ChipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Chip/Chip.js ChipRoot fontSize theme.typography.pxToRem(13), lineHeight 1.5",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdLabelFont = (): ChipRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/tag/style/index.js tagFontSize fontSizeSM 12; tagLineHeight lineHeightSM * 12 = 20",
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

const astryxTokens = cloneTokens("astryx.chip", (path, fallback) => {
  if (path === "box.height") return 24;
  if (path === "box.paddingX") return 8;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 12;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.boxFill") return "#0536591a";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#0a1317ff";
  return fallback;
});
astryxTokens.strokeAlign = "inside";
astryxTokens.typography = { label: astryxLabelFont() };

const muiTokens = cloneTokens("mui.chip", (path, fallback) => {
  if (path === "box.height") return 32;
  if (path === "box.paddingX") return 12;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 16;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 13;
  if (path === "labelLineHeight") return 19.5;
  if (path === "rest.boxFill") return "#00000014";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#000000de";
  return fallback;
});
muiTokens.strokeAlign = "inside";
muiTokens.typography = { label: muiLabelFont() };

const antdTokens = cloneTokens("antd.chip", (path, fallback) => {
  if (path === "box.height") return 22;
  if (path === "box.paddingX") return 7;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 1;
  if (path === "labelFontSize") return 12;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.boxFill") return "#fafafaff";
  if (path === "rest.boxBorder") return "#d9d9d9ff";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#000000e0";
  return fallback;
});
antdTokens.strokeAlign = "inside";
antdTokens.typography = { label: antdLabelFont() };

export const astryxChipSource: ReviewedChipSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Token",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Token",
  anatomy: {
    root: "Token.tsx — no Chip/Tag export. Do not invent an Astryx Chip. Tokenizer waits.",
    control:
      "size md default; height calc(--size-element-md 32 - 8) = 24; paddingInline --spacing-2 8; paddingBlock 0; --radius-inner 4; border 0",
    label:
      "--text-supporting-size 12 / --font-weight-medium / --text-supporting-leading 1.6667 → 20. Example label Tag. --color-text-primary #0A1317 on --color-neutral #0536591a",
  },
  api: {
    size: "sm | md | lg; default md — not a shared axis",
    color: "default | red…pink; default default — not a shared axis",
    extras: "onRemove, icon, href, onClick, Tokenizer receipted",
  },
  styleSources: [
    "Token/Token.tsx styles.base + sizeStyles.md + colorStyles.default",
    "src/theme/tokens.stylex.ts --size-element-md 32, --radius-inner 4, --spacing-2 8, --color-neutral rgba(5,54,89,0.1)",
  ],
  fontSources: ["Token.tsx --text-supporting-size 12 Medium"],
};

export const muiChipSource: ReviewedChipSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Chip",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Chip",
  anatomy: {
    root: "Chip.js ChipRoot height 32, borderRadius 16, padding 0, border 0, filled default",
    control:
      "variant filled default; color default; size medium. ChipLabel paddingLeft/Right 12. Do not compile outlined or small.",
    label:
      "fontSize pxToRem(13); lineHeight 1.5 → 19.5. palette.text.primary #000000de on palette.action.selected #00000014",
  },
  api: {
    variant: "filled default; outlined receipted",
    color: "default; primary/secondary/error/info/success/warning receipted",
    extras: "onDelete, avatar, icon, clickable, disabled opacity 0.38 receipted",
  },
  styleSources: [
    "Chip/Chip.js ChipRoot height 32 radius 16, ChipLabel padding 12, action.selected via createTheme light",
  ],
  fontSources: ["Chip.js pxToRem(13) Roboto Regular"],
};

export const antdChipSource: ReviewedChipSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Tag",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/tag",
  anatomy: {
    root: "Tag.js bordered default true; closable default false. CheckableTag waits.",
    control:
      "prepareToken tagPaddingHorizontal 8 - lineWidth 1 = 7; borderRadiusSM 4; height auto = line 20 + inside stroke 2 = 22; defaultBg FastColor(colorFillQuaternary).onBackground(colorBgContainer) #fafafa",
    label:
      "tagFontSize fontSizeSM 12; tagLineHeight 20; colorText #000000e0; border --color-border #d9d9d9",
  },
  api: {
    bordered: "default true",
    closable: "default false — not a shared axis",
    extras: "CheckableTag, preset colors, icon, borderless receipted",
  },
  styleSources: [
    "antd/es/tag/index.js bordered true, closable false",
    "antd/es/tag/style/index.js prepareToken + prepareComponentToken",
  ],
  fontSources: ["antd.vars.css --font-size-sm 12; --line-height-sm"],
};

const categoryForToken = (path: string): ChipFactCategory => {
  if (path.includes("typography")) return "typography";
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
  facts: ReviewedChipSourceFact[] = [],
): ReviewedChipSourceFact[] => {
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

export const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedChipSourceFact[] =>
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
    id: "refusal-invented-chip",
    evidence: "Astryx has no Chip/Tag export; this compile is Token",
    target: "invented Astryx Chip export",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-tokenizer",
    evidence: "Tokenizer is a multi-token field — not this teaching",
    target: "Astryx Tokenizer",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-remove",
    evidence: "onRemove close control — not a shared axis",
    target: "Astryx Token onRemove",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color",
    evidence: "TokenColor red…pink — not a shared axis",
    target: "Astryx Token color variants",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size",
    evidence: "size sm/lg — not a shared axis",
    target: "Astryx Token size sm/lg",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-icon",
    evidence: "optional icon — not on the named default cell",
    target: "Astryx Token icon",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-outlined",
    evidence: "variant default filled; outlined is not the shared default",
    target: "MUI Chip outlined",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-small",
    evidence: "size default medium; small is not a shared axis",
    target: "MUI Chip size small",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-delete",
    evidence: "onDelete — not a shared axis",
    target: "MUI Chip onDelete",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-color",
    evidence: "color primary/secondary/error/info/success/warning — not shared",
    target: "MUI Chip color variants",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-avatar-icon",
    evidence: "avatar/icon slots — not the named default cell",
    target: "MUI Chip avatar/icon",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-closable",
    evidence: "closable default false — not a shared axis",
    target: "AntD Tag closable",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-checkable",
    evidence: "CheckableTag waits",
    target: "AntD CheckableTag",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-borderless",
    evidence: "bordered default true; borderless is not the shared default",
    target: "AntD Tag borderless",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-preset-color",
    evidence: "preset/status colors — not a shared axis",
    target: "AntD Tag preset colors",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-icon",
    evidence: "optional icon — not the named default cell",
    target: "AntD Tag icon",
    reason: "refused-by-recipe",
  },
]);

export const buildConfig = (
  slug: string,
  source: ReviewedChipSource,
  tokens: ChipRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedChipSourceFact[],
  extraIr: ReviewedChipSourceFact[],
  unsupported: string[],
  content: { label: string } = { label: slug === "mui" ? "Chip" : "Tag" },
): ReviewedChipAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-chips.ts#${slug}ChipAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "chip", version: 1 }],
      selectedBy: "recipe-pivot-chip-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-chips.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    // Label text from each capture's own sample so the fidelity pair is
    // like-for-like: mui Chip fixedProps.label "Chip"; antd Tag sampleText
    // "Tag"; astryx Token fixedProps.label "Tag" (extract/computed/configs).
    content: structuredClone(content),
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

export const anatomyFacts = (
  slug: string,
  source: ReviewedChipSource,
): ReviewedChipSourceFact[] => [
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

export const astryxChipAdapterConfig = buildConfig(
  "astryx",
  astryxChipSource,
  astryxTokens,
  { id: "astryx.chip", name: "Astryx Token" },
  astryxRefusals,
  anatomyFacts("astryx", astryxChipSource),
  ["invented-Chip", "Tokenizer", "onRemove", "color", "size-sm-lg", "icon"],
);

export const muiChipAdapterConfig = buildConfig(
  "mui",
  muiChipSource,
  muiTokens,
  { id: "mui.chip", name: "MUI Chip" },
  muiRefusals,
  anatomyFacts("mui", muiChipSource),
  ["outlined", "size-small", "onDelete", "color", "avatar", "icon"],
);

export const antdChipAdapterConfig = buildConfig(
  "antd",
  antdChipSource,
  antdTokens,
  { id: "antd.chip", name: "Ant Design Tag" },
  antdRefusals,
  anatomyFacts("antd", antdChipSource),
  ["closable", "CheckableTag", "borderless", "preset-color", "icon"],
);

export const CHIP_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "chip-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#Token",
    "@mui/material@9.2.0#Chip",
    "antd@5.29.3#Tag",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
