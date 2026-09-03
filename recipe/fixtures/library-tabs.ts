import type {
  ReviewedTabsAdapterConfig,
  ReviewedTabsSource,
  ReviewedTabsSourceFact,
  TabsFactCategory,
} from "../adapters/tabs.js";
import { canonicalTabsRecipeInstance } from "./tabs.js";
import type { TabsRecipeInstance } from "../recipes/tabs.js";

export const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): TabsRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalTabsRecipeInstance.tokens,
  ) as TabsRecipeInstance["tokens"];
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

const astryxRestFont = (): TabsRecipeInstance["tokens"]["typography"]["rest"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "@astryxdesign/core/src/TabList/Tab.tsx styles.base fontWeight --font-weight-normal; --text-label-size 14 / --text-label-leading 1.4286 → 20",
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

const astryxSelectedFont = (): TabsRecipeInstance["tokens"]["typography"]["selected"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Semibold",
  requestSource:
    "@astryxdesign/core/src/TabList/Tab.tsx styles.selected fontWeight --font-weight-semibold 600",
  fallbackChain: [
    { family: "-apple-system", style: "Semibold" },
    { family: "SF Pro", style: "Semibold" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Semibold",
  resolution: "fallback",
  degradation: `source ${ASTRYX_BODY_STACK} Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold`,
});

const muiLabelFont = (): TabsRecipeInstance["tokens"]["typography"]["rest"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Medium",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Tab/Tab.js spreads theme.typography.button 14 Medium; caseAllCaps; lineHeight 1.25",
  fallbackChain: [
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Medium",
  resolution: "requested",
});

const antdLabelFont = (): TabsRecipeInstance["tokens"]["typography"]["rest"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/tabs/style/index.js titleFontSize token.fontSize 14; resetComponent lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.tabs", (path, fallback) => {
  if (path === "list.itemSpacing") return 2;
  if (path === "tab.paddingX") return 12;
  if (path === "tab.paddingY") return 0;
  if (path === "tab.radius") return 8;
  if (path === "tab.minWidth") return 0;
  if (path === "tab.minHeight") return 0;
  if (path === "tab.fill") return "#00000000";
  if (path === "indicator.height") return 2;
  if (path === "indicator.radius") return 9999;
  if (path === "indicator.opacity") return 1;
  if (path === "indicator.fill") return "#0064e0ff";
  // Tab.tsx styles.indicator: position absolute; bottom -1px; left/right --spacing-3 12
  if (path === "indicator.insetX") return 12;
  if (path === "indicator.offsetY") return -1;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 20;
  if (path === "rest.label") return "#4e606fff";
  if (path === "selected.label") return "#0a1317ff";
  return fallback;
});
astryxTokens.lineHeightUnit = "px";
astryxTokens.tab.contentAlign = "start"; // no alignment fact read for TabList (no capture lane); keeps the stacked start
astryxTokens.tab.verticalAlign = "start"; // no alignment fact read (no capture lane); keeps the stacked start
astryxTokens.textCase = "original";
astryxTokens.typography = {
  rest: astryxRestFont(),
  selected: astryxSelectedFont(),
};

const muiTokens = cloneTokens("mui.tabs", (path, fallback) => {
  if (path === "list.itemSpacing") return 0;
  if (path === "tab.paddingX") return 16;
  if (path === "tab.paddingY") return 12;
  if (path === "tab.radius") return 0;
  if (path === "tab.minWidth") return 90;
  if (path === "tab.minHeight") return 48;
  if (path === "tab.fill") return "#00000000";
  if (path === "indicator.height") return 2;
  if (path === "indicator.radius") return 0;
  if (path === "indicator.opacity") return 1;
  if (path === "indicator.fill") return "#1976d2ff";
  // ledger MuiTabs-indicator: position absolute, left 0px, bottom 0px, width = tab width
  if (path === "indicator.insetX") return 0;
  if (path === "indicator.offsetY") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 125;
  if (path === "labelLetterSpacing") return 0.4; // ledger MuiTab-root letter-spacing 0.39998px (theme.typography.button 0.02857em)
  if (path === "rest.label") return "#00000099";
  if (path === "selected.label") return "#1976d2ff";
  return fallback;
});
muiTokens.lineHeightUnit = "percent";
muiTokens.tab.contentAlign = "center"; // ledger MuiTab-root display flex, flex-direction column, justify-content center, align-items center
muiTokens.tab.verticalAlign = "center"; // the same flex centring: MuiTab-root align-items center
muiTokens.textCase = "upper";
muiTokens.typography = { rest: muiLabelFont(), selected: muiLabelFont() };

const antdTokens = cloneTokens("antd.tabs", (path, fallback) => {
  if (path === "list.itemSpacing") return 32;
  if (path === "tab.paddingX") return 0;
  if (path === "tab.paddingY") return 12;
  if (path === "tab.radius") return 0;
  if (path === "tab.minWidth") return 0;
  if (path === "tab.minHeight") return 0;
  if (path === "tab.fill") return "#00000000";
  if (path === "indicator.height") return 2;
  if (path === "indicator.radius") return 0;
  if (path === "indicator.opacity") return 1;
  if (path === "indicator.fill") return "#1677ffff";
  // antd/es/tabs/style ink-bar: position absolute; bottom 0; left/width follow the active tab
  if (path === "indicator.insetX") return 0;
  if (path === "indicator.offsetY") return 0;
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "rest.label") return "#000000e0";
  if (path === "selected.label") return "#1677ffff";
  return fallback;
});
antdTokens.lineHeightUnit = "px";
antdTokens.tab.contentAlign = "center"; // antd/es/tabs/style/index.js .ant-tabs-tab alignItems center
antdTokens.tab.verticalAlign = "center"; // antd/es/tabs/style/index.js .ant-tabs-tab alignItems center
antdTokens.textCase = "original";
antdTokens.typography = { rest: antdLabelFont(), selected: antdLabelFont() };

export const astryxTabsSource: ReviewedTabsSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "TabList",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/TabList",
  anatomy: {
    root: "No Tabs export — compile TabList. layout hug, hasDivider false, orientation horizontal, size md. Indicator is a child span of each Tab; selected child only.",
    control:
      "Tab.tsx styles.indicator Polar bottom -1 / left-right --spacing-3 12 receipted. Bind 2px --color-accent #0064E0 to the selected child. paddingInline --spacing-3 12. TabList gap --spacing-0-5 2.",
    label: "Item One / Item Two. rest Regular --color-text-secondary #4E606F; selected Semibold --color-text-primary #0A1317. --text-label-size 14 / leading 1.4286 → 20",
  },
  api: {
    export: "TabList — named absence of Tabs",
    extras: "TabMenu, fill layout, vertical, sizes besides md receipted",
  },
  styleSources: [
    "TabList/TabList.tsx styles.nav gap --spacing-0-5",
    "TabList/Tab.tsx styles.base + selected + indicator",
    "src/theme/tokens.stylex.ts --color-accent #0064E0, --spacing-3 12, --radius-element 8, --radius-full 9999",
  ],
  fontSources: ["Tab.tsx --text-label-size 14 Regular / selected Semibold"],
};

export const muiTabsSource: ReviewedTabsSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Tabs",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Tabs",
  anatomy: {
    root: "Tabs.js variant standard, indicatorColor primary, textColor primary, scrollButtons auto. Polar indicator width 100% receipted — bind height 2 + primary to the selected child.",
    control:
      "Tab.js minWidth 90, minHeight 48, padding 12px 16px. TabsIndicator height 2, palette.primary.main #1976d2.",
    label: "typography.button 14 Medium caseAllCaps; lineHeight 1.25 → percent 125. selected primary.main #1976d2; rest text.secondary #00000099",
  },
  api: {
    variant: "standard default",
    extras: "scrollable, fullWidth, secondary, scroll buttons receipted",
  },
  styleSources: [
    "Tab/Tab.js TabRoot minWidth 90 minHeight 48 padding 12 16 lineHeight 1.25",
    "Tabs/Tabs.js TabsIndicator height 2 primary.main",
  ],
  fontSources: ["Tab.js theme.typography.button Roboto Medium uppercase"],
};

export const antdTabsSource: ReviewedTabsSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Tabs",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/tabs",
  anatomy: {
    root: "antd/es/tabs/index.js type unnamed — rc-tabs line is the named default. ink-bar position absolute, bottom 0, active-tab width — carried as insetX 0 / offsetY 0 on the selected child; lineWidthBold 2 + inkBarColor.",
    control:
      "prepareComponentToken inkBarColor colorPrimary #1677ff; horizontalItemPadding paddingSM 12 0; horizontalItemGutter 32 (Fixed Value).",
    label: "titleFontSize fontSize 14 / lineHeight 22. itemColor colorText #000000e0; itemSelectedColor colorPrimary #1677ff",
  },
  api: {
    type: "line default — do not invent card/editable-card",
    extras: "editable-card, card, centered, destroyOnHidden receipted",
  },
  styleSources: [
    "antd/es/tabs/style/index.js prepareComponentToken + ink-bar",
    "antd/es/theme/themes/seed.js colorPrimary #1677ff fontSize 14 lineWidth 1 → lineWidthBold 2",
  ],
  fontSources: ["antd seed fontSize 14; resetComponent lineHeight 22"],
};

const categoryForToken = (path: string): TabsFactCategory => {
  if (
    path.includes("typography") ||
    path.includes("lineHeight") ||
    path.includes("textCase")
  )
    return "typography";
  if (path.includes("indicator.opacity")) return "state";
  if (
    path.includes("fill") ||
    path.endsWith(".label") ||
    path.includes("rest") ||
    path.includes("selected.label")
  )
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedTabsSourceFact[] = [],
): ReviewedTabsSourceFact[] => {
  if (value === null || typeof value !== "object") {
    if (
      path.startsWith("tokens.typography") ||
      path === "tokens.textCase" ||
      path === "tokens.lineHeightUnit" ||
      path === "tokens.tab.contentAlign" ||
      path === "tokens.tab.verticalAlign"
    ) {
      facts.push({
        occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
        category: path === "tokens.tab.contentAlign" || path === "tokens.tab.verticalAlign" ? "geometry" : "typography",
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
): ReviewedTabsSourceFact[] =>
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
    id: "refusal-tabmenu",
    evidence: "TabMenu overflow is not a shared axis",
    target: "Astryx TabMenu",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-fill-layout",
    evidence: "layout fill is not the named hug default",
    target: "Astryx TabList fill layout",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-scrollable",
    evidence: "scrollable / scrollButtons auto are not a shared axis",
    target: "MUI Tabs scrollable",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-fullwidth",
    evidence: "fullWidth is not the named standard default",
    target: "MUI Tabs fullWidth",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-card",
    evidence: "card / editable-card are not the named line default",
    target: "AntD Tabs card type",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-nav-divider",
    evidence:
      "top/bottom nav ::before divider is not shared — Astryx hasDivider default false",
    target: "AntD Tabs nav divider",
    reason: "refused-by-recipe",
  },
]);

export const buildConfig = (
  slug: string,
  source: ReviewedTabsSource,
  tokens: TabsRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedTabsSourceFact[],
  extraIr: ReviewedTabsSourceFact[],
  unsupported: string[],
  content: { selected: string; rest: string } = slug === "mui" ? { selected: "Overview", rest: "Activity" } : { selected: "Item One", rest: "Item Two" },
): ReviewedTabsAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-tabs.ts#${slug}TabsAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "tabs", version: 1 }],
      selectedBy: "recipe-pivot-tabs-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-tabs.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    // mui: labels from the capture mount (configs/mui.json Tabs childrenSpec
    // Overview / Activity — re-captured two-item on 2026-09-01 to match the
    // recipe's declared two-item cell). Astryx keeps the seed labels.
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
      wrapper: `${source.exportName} two-item selected-child indicator`,
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

export const anatomyFacts = (
  slug: string,
  source: ReviewedTabsSource,
): ReviewedTabsSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-selected`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.selected",
  },
  {
    occurrenceId: `${slug}-anatomy-rest`,
    category: "anatomy",
    source: {
      kind: "review",
      evidence: `${source.anatomy.root}; rest item is Item Two`,
    },
    disposition: "ir",
    target: "content.rest",
  },
];

export const astryxTabsAdapterConfig = buildConfig(
  "astryx",
  astryxTabsSource,
  astryxTokens,
  { id: "astryx.tabs", name: "Astryx TabList" },
  astryxRefusals,
  anatomyFacts("astryx", astryxTabsSource),
  ["Polar-indicator-inset", "TabMenu", "fill-layout"],
);

export const muiTabsAdapterConfig = buildConfig(
  "mui",
  muiTabsSource,
  muiTokens,
  { id: "mui.tabs", name: "MUI Tabs" },
  muiRefusals,
  anatomyFacts("mui", muiTabsSource),
  ["Polar-indicator", "scrollable", "fullWidth"],
);

export const antdTabsAdapterConfig = buildConfig(
  "antd",
  antdTabsSource,
  antdTokens,
  { id: "antd.tabs", name: "Ant Design Tabs" },
  antdRefusals,
  anatomyFacts("antd", antdTabsSource),
  ["Polar-ink-bar", "card", "nav-divider"],
);

export const TABS_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "tabs-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#TabList",
    "@mui/material@9.2.0#Tabs",
    "antd@5.29.3#Tabs",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
