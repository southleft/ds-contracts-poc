import type {
  ReviewedAvatarAdapterConfig,
  ReviewedAvatarSource,
  ReviewedAvatarSourceFact,
  AvatarFactCategory,
} from "../adapters/avatar.js";
import { canonicalAvatarRecipeInstance } from "./avatar.js";
import type { AvatarRecipeInstance } from "../recipes/avatar.js";

export const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): AvatarRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalAvatarRecipeInstance.tokens,
  ) as AvatarRecipeInstance["tokens"];
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

const astryxLabelFont = (): AvatarRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  requestSource:
    "@astryxdesign/core/src/Avatar/Avatar.tsx fallback fontFamily --font-family-body, size*0.4, --font-weight-medium",
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

const muiLabelFont = (): AvatarRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Avatar/Avatar.js AvatarRoot fontSize theme.typography.pxToRem(20), lineHeight 1",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdLabelFont = (): AvatarRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/avatar/style/index.js textFontSize fontSize 14; resetComponent lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.avatar", (path, fallback) => {
  if (path === "box.height") return 36;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 9999;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 14.4;
  if (path === "labelLineHeight") return 14.4;
  if (path === "rest.boxFill") return "#0536591a";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#4e606fff";
  return fallback;
});
astryxTokens.strokeAlign = "inside";
astryxTokens.typography = { label: astryxLabelFont() };

const muiTokens = cloneTokens("mui.avatar", (path, fallback) => {
  if (path === "box.height") return 40;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 20;
  if (path === "box.borderWidth") return 0;
  if (path === "labelFontSize") return 20;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.boxFill") return "#bdbdbdff";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#ffffffff";
  return fallback;
});
muiTokens.strokeAlign = "inside";
muiTokens.typography = { label: muiLabelFont() };

const antdTokens = cloneTokens("antd.avatar", (path, fallback) => {
  if (path === "box.height") return 32;
  if (path === "box.paddingX") return 0;
  if (path === "box.paddingY") return 0;
  if (path === "box.radius") return 16;
  if (path === "box.borderWidth") return 1;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "rest.boxFill") return "#00000040";
  if (path === "rest.boxBorder") return "#00000000";
  if (path === "rest.boxOpacity") return 1;
  if (path === "rest.label") return "#ffffffff";
  return fallback;
});
antdTokens.strokeAlign = "inside";
antdTokens.typography = { label: antdLabelFont() };

export const astryxAvatarSource: ReviewedAvatarSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Avatar",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Avatar",
  anatomy: {
    root: "Avatar.tsx default size small → resolveSize 36; content overflow hidden; --radius-full 9999",
    control:
      "wrapper relative + content circle. Do not compile status overlay or AvatarGroup ring.",
    label:
      "getInitials('John Doe') → JD. font size*0.4=14.4 Medium. --color-text-secondary #4E606F on --color-neutral #0536591a",
  },
  api: {
    size: "tiny…large or numeric; default small 36 — not a shared axis",
    extras: "src, fallbackSrc, status, DefaultIcon, AvatarGroup receipted",
  },
  styleSources: [
    "Avatar/Avatar.tsx styles.content + fallback + resolveSize('small')",
    "src/theme/tokens.stylex.ts --radius-full 9999, --color-neutral rgba(5,54,89,0.1)",
  ],
  fontSources: ["Avatar.tsx INITIALS_FONT_SIZE_RATIO 0.4 Medium"],
};

export const muiAvatarSource: ReviewedAvatarSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Avatar",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Avatar",
  anatomy: {
    root: "Avatar.js AvatarRoot 40×40, borderRadius 50%, overflow hidden, variant circular default",
    control:
      "colorDefault when no surviving image. Do not compile rounded/square or Person 75% icon.",
    label:
      "children JD. fontSize pxToRem(20); lineHeight 1. palette.background.default #ffffff on palette.grey[400] #bdbdbd",
  },
  api: {
    variant: "circular default; rounded/square receipted",
    extras: "src/srcSet image, Person fallback, alt[0] receipted",
  },
  styleSources: [
    "Avatar/Avatar.js AvatarRoot width/height 40, grey[400], pxToRem(20)",
  ],
  fontSources: ["Avatar.js pxToRem(20) Roboto Regular"],
};

export const antdAvatarSource: ReviewedAvatarSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Avatar",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/avatar",
  anatomy: {
    root: "Avatar.js size default → containerSize controlHeight 32; shape circle; overflow hidden",
    control:
      "prepareComponentToken containerSize=32. Do not compile square, lg/sm, src, or icon.",
    label:
      "children JD. textFontSize fontSize 14; lineHeight 22; avatarColor #fff on avatarBg #00000040; border 1 transparent",
  },
  api: {
    shape: "circle default; square receipted",
    extras: "src image, icon, Group overlap, gap scale, numeric size receipted",
  },
  styleSources: [
    "antd/es/avatar/Avatar.js size default, shape circle",
    "antd/es/avatar/style/index.js prepareComponentToken + avatarBg colorTextPlaceholder",
  ],
  fontSources: ["antd fontSize 14; resetComponent lineHeight 1.5714 → 22"],
};

const categoryForToken = (path: string): AvatarFactCategory => {
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
  facts: ReviewedAvatarSourceFact[] = [],
): ReviewedAvatarSourceFact[] => {
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
): ReviewedAvatarSourceFact[] =>
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
    id: "refusal-status",
    evidence: "status overlay — Badge already taught overlay; not this teaching",
    target: "Astryx Avatar status",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-group",
    evidence: "AvatarGroup ring/overlap — not a shared axis",
    target: "Astryx AvatarGroup",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-src",
    evidence: "src / fallbackSrc image — compile the initials fallback",
    target: "Astryx Avatar src",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-icon",
    evidence: "DefaultIcon when name is absent — not the initials cell",
    target: "Astryx Avatar DefaultIcon",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size",
    evidence: "named/numeric sizes besides small 36 — not a shared axis",
    target: "Astryx Avatar sizes besides small",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-rounded",
    evidence: "variant default circular; rounded/square are not a shared axis",
    target: "MUI Avatar rounded/square",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-person",
    evidence: "Person fallback 75% when no children/alt — compile initials JD",
    target: "MUI Avatar Person fallback",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-src",
    evidence: "src / srcSet image — compile the initials fallback",
    target: "MUI Avatar src",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dark",
    evidence: "dark-mode grey[600] — light grey[400] is the named default",
    target: "MUI Avatar dark grey[600]",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-square",
    evidence: "shape default circle; square is not a shared axis",
    target: "AntD Avatar square",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-size",
    evidence: "size large/small and numeric — not a shared axis",
    target: "AntD Avatar size lg/sm",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-src",
    evidence: "src image — compile the initials fallback",
    target: "AntD Avatar src",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-icon",
    evidence: "icon slot — not the initials cell",
    target: "AntD Avatar icon",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-group",
    evidence: "Avatar.Group overlap — not a shared axis",
    target: "AntD Avatar.Group",
    reason: "refused-by-recipe",
  },
]);

export const buildConfig = (
  slug: string,
  source: ReviewedAvatarSource,
  tokens: AvatarRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedAvatarSourceFact[],
  extraIr: ReviewedAvatarSourceFact[],
  unsupported: string[],
  content: { label: string } = { label: "JD" },
): ReviewedAvatarAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-avatars.ts#${slug}AvatarAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "avatar", version: 1 }],
      selectedBy: "recipe-pivot-avatar-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-avatars.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
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
  source: ReviewedAvatarSource,
): ReviewedAvatarSourceFact[] => [
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

export const astryxAvatarAdapterConfig = buildConfig(
  "astryx",
  astryxAvatarSource,
  astryxTokens,
  { id: "astryx.avatar", name: "Astryx Avatar" },
  astryxRefusals,
  anatomyFacts("astryx", astryxAvatarSource),
  ["status", "AvatarGroup", "src", "DefaultIcon", "sizes-besides-small"],
);

export const muiAvatarAdapterConfig = buildConfig(
  "mui",
  muiAvatarSource,
  muiTokens,
  { id: "mui.avatar", name: "MUI Avatar" },
  muiRefusals,
  anatomyFacts("mui", muiAvatarSource),
  ["rounded", "square", "Person-fallback", "src", "dark-grey-600"],
);

export const antdAvatarAdapterConfig = buildConfig(
  "antd",
  antdAvatarSource,
  antdTokens,
  { id: "antd.avatar", name: "Ant Design Avatar" },
  antdRefusals,
  anatomyFacts("antd", antdAvatarSource),
  ["square", "size-lg-sm", "src", "icon", "Avatar.Group"],
);

export const AVATAR_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "avatar-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#Avatar",
    "@mui/material@9.2.0#Avatar",
    "antd@5.29.3#Avatar",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
