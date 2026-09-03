import type {
  ReviewedMenuAdapterConfig,
  ReviewedMenuSource,
  ReviewedMenuSourceFact,
  MenuFactCategory,
} from "../adapters/menu.js";
import { canonicalMenuRecipeInstance } from "./menu.js";
import type { MenuRecipeInstance } from "../recipes/menu.js";

export const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): MenuRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalMenuRecipeInstance.tokens,
  ) as MenuRecipeInstance["tokens"];
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

const astryxFont = (): MenuRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "@astryxdesign/core/src/DropdownMenu/DropdownMenuItem.tsx --text-label-size 14 / --text-label-leading 1.4286 → 20 Regular",
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

const muiFont = (): MenuRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/MenuItem/MenuItem.js theme.typography.body1 16 Regular lineHeight 1.5 → 24",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdFont = (): MenuRecipeInstance["tokens"]["typography"]["label"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "antd/es/dropdown/style/index.js fontSize 14; resetComponent lineHeight 1.5714 → 22",
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

const astryxTokens = cloneTokens("astryx.menu", (path, fallback) => {
  if (path === "panel.padding") return 4;
  if (path === "panel.radius") return 12;
  if (path === "panel.itemSpacing") return 2;
  if (path === "panel.minWidth") return 0; // DropdownMenu.tsx:77 minWidth: 'anchor-size(width)' — the trigger's width, not a panel constant; receipted below, the panel hugs
  if (path === "panel.fill") return "#ffffffff";
  if (path === "item.paddingX") return 8;
  if (path === "item.paddingY") return 6;
  if (path === "item.minHeight") return 0;
  if (path === "item.fill") return "#00000000";
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 20;
  if (path === "label") return "#0a1317ff";
  return fallback;
});
astryxTokens.lineHeightUnit = "px";
astryxTokens.typography = { label: astryxFont() };

const muiTokens = cloneTokens("mui.menu", (path, fallback) => {
  // 8 (corrected 2026-09-02): Menu's paper pads 0 but its MenuList pads 8px 0
  // (List.js padding: `paddingTop: 8, paddingBottom: 8` unless disablePadding);
  // the recipe carries ONE panel inset, paper + list, which the capture reads as 8.
  // The hand table had spelled 0 and the row was a named content mismatch.
  if (path === "panel.padding") return 8;
  if (path === "panel.radius") return 4;
  if (path === "panel.itemSpacing") return 0;
  if (path === "panel.minWidth") return 16; // Popover.js:85 PopoverPaper minWidth: 16 (Menu's paper is a PopoverPaper); the capture reads 16px
  if (path === "panel.fill") return "#ffffffff";
  if (path === "item.paddingX") return 16;
  if (path === "item.paddingY") return 6;
  // 0 (corrected 2026-09-02): MenuItem.js sets minHeight 48 and, at
  // theme.breakpoints.up("sm"), minHeight "auto" (MenuItem.js:71, :141-142);
  // the capture's 900px viewport is above sm (600), so the item hugs — the
  // hand table had carried the below-sm value and the row was 12px too tall.
  if (path === "item.minHeight") return 0;
  if (path === "item.fill") return "#00000000";
  if (path === "labelFontSize") return 16;
  if (path === "labelLineHeight") return 24;
  if (path === "label") return "#000000de";
  return fallback;
});
muiTokens.lineHeightUnit = "px";
muiTokens.typography = { label: muiFont() };

const antdTokens = cloneTokens("antd.menu", (path, fallback) => {
  if (path === "panel.padding") return 4;
  if (path === "panel.radius") return 8;
  if (path === "panel.itemSpacing") return 0;
  if (path === "panel.minWidth") return 0; // antd/es/dropdown/style/index.js: no min-width on the menu panel (only -item-icon carries one); the panel hugs
  if (path === "panel.fill") return "#ffffffff";
  if (path === "item.paddingX") return 12;
  if (path === "item.paddingY") return 5;
  if (path === "item.minHeight") return 0;
  if (path === "item.fill") return "#00000000";
  if (path === "labelFontSize") return 14;
  if (path === "labelLineHeight") return 22;
  if (path === "label") return "#000000e0";
  return fallback;
});
antdTokens.lineHeightUnit = "px";
antdTokens.typography = { label: antdFont() };

export const astryxMenuSource: ReviewedMenuSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "DropdownMenu",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/DropdownMenu",
  anatomy: {
    root: "No Menu export — compile DropdownMenu. placement below Polar receipted. Open panel only.",
    control:
      "DropdownMenu.tsx padding --spacing-1 4; gap --spacing-0-5 2; radius --radius-container 12. usePopover surface --color-background-popover #FFFFFF.",
    label: "Item One / Item Two. DropdownMenuItem md padY --spacing-1-5 6 / padX --spacing-2 8; --text-label-size 14 / 20 Regular --color-text-primary #0A1317",
  },
  api: {
    export: "DropdownMenu — named absence of Menu",
    extras: "trigger button, chevron, icons, shadow-low receipted",
  },
  styleSources: [
    "DropdownMenu/DropdownMenu.tsx styles.dropdown",
    "DropdownMenu/DropdownMenuItem.tsx menuItemStyles + itemSizeStyles.md",
    "Popover/usePopover.tsx surface --color-background-popover",
  ],
  fontSources: ["DropdownMenuItem.tsx --text-label-size 14 Regular"],
};

export const muiMenuSource: ReviewedMenuSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Menu",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Menu",
  anatomy: {
    root: "Menu.js variant selectedMenu. Paper inherits Popover Paper. Polar placement receipted.",
    control:
      "Paper background paper #fff; shape.borderRadius 4. MenuItem minHeight 48 padding 6 16.",
    label: "typography.body1 16 Regular lineHeight 1.5 → 24. text.primary #000000de",
  },
  api: {
    variant: "selectedMenu default",
    extras: "dense, elevation shadow, selected fill receipted",
  },
  styleSources: [
    "Menu/Menu.js MenuPaper",
    "MenuItem/MenuItem.js body1 minHeight 48 padding 6 / gutters 16",
  ],
  fontSources: ["MenuItem.js theme.typography.body1 Roboto Regular 16"],
};

export const antdMenuSource: ReviewedMenuSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Dropdown",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/dropdown",
  anatomy: {
    root: "antd/es/dropdown — compile Dropdown, not Menu. Polar placement and arrow receipted.",
    control:
      "colorBgElevated #fff; borderRadiusLG 8; dropdownEdgeChildPadding paddingXXS 4.",
    label: "paddingBlock (controlHeight 32 - 14*1.5714)/2 = 5; controlPaddingHorizontal 12; fontSize 14 / 22; colorText #000000e0",
  },
  api: {
    export: "Dropdown",
    extras: "arrow, boxShadowSecondary, submenu receipted",
  },
  styleSources: [
    "antd/es/dropdown/style/index.js genBaseStyle + prepareComponentToken",
  ],
  fontSources: ["antd seed fontSize 14; lineHeight 22"],
};

const categoryForToken = (path: string): MenuFactCategory => {
  if (path.includes("typography") || path.includes("lineHeight"))
    return "typography";
  if (path.includes("minHeight")) return "state";
  if (path.includes("fill") || path.endsWith("label") || path.includes(".label"))
    return "fill";
  return "geometry";
};

const tokenFacts = (
  sourceSlug: string,
  evidence: string,
  value: unknown,
  path = "tokens",
  facts: ReviewedMenuSourceFact[] = [],
): ReviewedMenuSourceFact[] => {
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

export const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedMenuSourceFact[] =>
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
    id: "refusal-panel-minWidth",
    evidence: "DropdownMenu.tsx:77 minWidth: 'anchor-size(width)' — the panel's minimum is the trigger's width, a runtime anchor, not a length",
    target: "Astryx DropdownMenu panel min-width",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-polar",
    evidence: "placement below + popover anchor — Polar attachment is not invented",
    target: "Astryx DropdownMenu Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-shadow",
    evidence: "--shadow-low is layered Polar chrome — receipted",
    target: "Astryx DropdownMenu shadow-low",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-trigger",
    evidence: "DEFAULT_BUTTON label Menu is the trigger, not the open panel",
    target: "Astryx DropdownMenu trigger",
    reason: "refused-by-recipe",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-polar",
    evidence: "Menu Popover placement is Polar — not invented",
    target: "MUI Menu Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-elevation",
    evidence: "Paper elevation shadow is not compiled as Polar chrome",
    target: "MUI Menu elevation",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-selected",
    evidence: "selectedMenu selected fill is not a shared rest-cell axis",
    target: "MUI MenuItem selected",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-polar",
    evidence: "Dropdown placement is Polar — not invented",
    target: "AntD Dropdown Polar placement",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-arrow",
    evidence: "arrow Polar position is not invented",
    target: "AntD Dropdown arrow",
    reason: "no-figma-primitive",
  },
  {
    id: "refusal-shadow",
    evidence: "boxShadowSecondary — not compiled as Polar chrome",
    target: "AntD Dropdown boxShadowSecondary",
    reason: "refused-by-recipe",
  },
]);

export const buildConfig = (
  slug: string,
  source: ReviewedMenuSource,
  tokens: MenuRecipeInstance["tokens"],
  identity: { id: string; name: string },
  refusals: ReviewedMenuSourceFact[],
  extraIr: ReviewedMenuSourceFact[],
  unsupported: string[],
  // A proposed fixture passes the two captured item texts; the hand tables keep Item One / Item Two.
  content: MenuRecipeInstance["content"] = { first: "Item One", second: "Item Two" },
): ReviewedMenuAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-menus.ts#${slug}MenuAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "menu", version: 1 }],
      selectedBy: "recipe-pivot-menu-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-menus.ts#${slug}`,
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
      wrapper: `${source.exportName} open panel`,
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
  source: ReviewedMenuSource,
): ReviewedMenuSourceFact[] => [
  {
    occurrenceId: `${slug}-anatomy-first`,
    category: "anatomy",
    source: {
      kind: "pointer",
      pointer: "/anatomy/label",
      expected: source.anatomy.label,
    },
    disposition: "ir",
    target: "content.first",
  },
  {
    occurrenceId: `${slug}-anatomy-second`,
    category: "anatomy",
    source: {
      kind: "review",
      evidence: `${source.anatomy.root}; second item is Item Two`,
    },
    disposition: "ir",
    target: "content.second",
  },
];

export const astryxMenuAdapterConfig = buildConfig(
  "astryx",
  astryxMenuSource,
  astryxTokens,
  { id: "astryx.menu", name: "Astryx DropdownMenu" },
  astryxRefusals,
  anatomyFacts("astryx", astryxMenuSource),
  ["Polar-placement", "shadow-low", "trigger"],
);

export const muiMenuAdapterConfig = buildConfig(
  "mui",
  muiMenuSource,
  muiTokens,
  { id: "mui.menu", name: "MUI Menu" },
  muiRefusals,
  anatomyFacts("mui", muiMenuSource),
  ["Polar-placement", "elevation", "selected"],
  // The capture's two item texts (extract/computed/configs/mui.json Menu:
  // Profile / My account), so the hand row and the proposed row draw the
  // same words; the other hand tables keep Item One / Item Two.
  { first: "Profile", second: "My account" },
);

export const antdMenuAdapterConfig = buildConfig(
  "antd",
  antdMenuSource,
  antdTokens,
  { id: "antd.menu", name: "Ant Design Dropdown" },
  antdRefusals,
  anatomyFacts("antd", antdMenuSource),
  ["Polar-placement", "arrow", "boxShadowSecondary"],
);

export const MENU_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "menu-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 1,
  totalCells: 3,
  sources: [
    "@astryxdesign/core@0.1.6#DropdownMenu",
    "@mui/material@9.2.0#Menu",
    "antd@5.29.3#Dropdown",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
