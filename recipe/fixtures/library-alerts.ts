import type {
  ReviewedAlertAdapterConfig,
  ReviewedAlertSource,
  ReviewedAlertSourceFact,
  AlertFactCategory,
} from "../adapters/alert.js";
import { canonicalAlertRecipeInstance } from "./alert.js";
import { readCaptureGlyph } from "./capture-glyph.js";
import type { AlertRecipeInstance } from "../recipes/alert.js";

const cloneTokens = (
  prefix: string,
  mutate: (path: string, fallback: string | number) => string | number,
): AlertRecipeInstance["tokens"] => {
  const tokens = structuredClone(
    canonicalAlertRecipeInstance.tokens,
  ) as AlertRecipeInstance["tokens"];
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

const astryxTitleFont = (): AlertRecipeInstance["tokens"]["typography"]["title"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Semibold",
  requestSource:
    "@astryxdesign/core/src/Banner/Banner.tsx title --text-label-size 14, --font-weight-semibold 600, --text-label-leading 1.4286",
  fallbackChain: [
    { family: "-apple-system", style: "Semibold" },
    { family: "SF Pro", style: "Semibold" },
    { family: "SF Pro", style: "Medium" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  resolvedFamily: "SF Pro",
  resolvedStyle: "Semibold",
  resolution: "fallback",
  // 2026-09-01: the v1 record said SF Pro Medium because SF Pro Semibold was
  // not installed in Figma when v1 minted; it is now, the writer's tamper
  // check caught the stale record on the first v2 attempt, and the capture
  // confirms font-weight 600 on the title. Semibold is the truth.
  degradation: `source ${ASTRYX_BODY_STACK} Semibold 600; Figma cannot load a CSS stack; first named host font available is SF Pro Semibold`,
});

const muiTitleFont = (): AlertRecipeInstance["tokens"]["typography"]["title"] => ({
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  requestSource:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createTypography.js body2 fontFamily Roboto, fontWeightRegular 400, size 14, lineHeight 1.43",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
});

const antdTitleFont = (): AlertRecipeInstance["tokens"]["typography"]["title"] => ({
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  requestSource:
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px; --line-height 1.5714285714285714 → 22; message colorTextHeading",
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
 * Astryx Banner header (not AlertDialog). paddingBlock --spacing-3 12,
 * paddingInline --spacing-4 16, gap --spacing-2 8, --radius-container 12.
 * Title line 14*1.4286 = 20. Icon md 20. Height 12+12+20 = 44.
 * Status required; example uses info. Do not invent a shared default.
 */
const astryxTokens = cloneTokens("astryx.alert", (path, fallback) => {
  if (path === "box.height") return 44;
  if (path === "box.paddingX") return 16;
  if (path === "box.paddingY") return 12;
  if (path === "box.radius") return 12;
  if (path === "box.borderWidth") return 0;
  if (path === "box.gap") return 8;
  if (path === "icon.size") return 20;
  if (path === "titleFontSize") return 14;
  if (path === "titleLineHeight") return 20;
  if (path === "states.info.boxFill") return "#0082fb33";
  if (path === "states.info.boxBorder") return "#00000000";
  if (path === "states.info.title") return "#0a1317ff";
  if (path === "states.info.iconFill") return "#0064e0ff";
  if (path === "states.info.iconOpacity") return 1;
  if (path === "states.success.boxFill") return "#0b991f33";
  if (path === "states.success.boxBorder") return "#00000000";
  if (path === "states.success.title") return "#0a1317ff";
  if (path === "states.success.iconFill") return "#0d8626ff";
  if (path === "states.success.iconOpacity") return 1;
  if (path === "states.warning.boxFill") return "#e2a40033";
  if (path === "states.warning.boxBorder") return "#00000000";
  if (path === "states.warning.title") return "#0a1317ff";
  if (path === "states.warning.iconFill") return "#e9af08ff";
  if (path === "states.warning.iconOpacity") return 1;
  if (path === "states.error.boxFill") return "#e3193b33";
  if (path === "states.error.boxBorder") return "#00000000";
  if (path === "states.error.title") return "#0a1317ff";
  if (path === "states.error.iconFill") return "#e3193bff";
  if (path === "states.error.iconOpacity") return 1;
  return fallback;
});
astryxTokens.icon.glyphs = {
  info: readCaptureGlyph("extract/computed/out/astryx-core/banner/assets/banner-icon-info.svg", { x: 0, y: 0, width: 24, height: 24 }, "@astryxdesign/core dist/Icon/defaultIcons.js viewBox '0 0 24 24'"),
  success: readCaptureGlyph("extract/computed/out/astryx-core/banner/assets/banner-icon-success.svg", { x: 0, y: 0, width: 24, height: 24 }, "@astryxdesign/core dist/Icon/defaultIcons.js viewBox '0 0 24 24'"),
  warning: readCaptureGlyph("extract/computed/out/astryx-core/banner/assets/banner-icon-warning.svg", { x: 0, y: 0, width: 24, height: 24 }, "@astryxdesign/core dist/Icon/defaultIcons.js viewBox '0 0 24 24'"),
  error: readCaptureGlyph("extract/computed/out/astryx-core/banner/assets/banner-icon-error.svg", { x: 0, y: 0, width: 24, height: 24 }, "@astryxdesign/core dist/Icon/defaultIcons.js viewBox '0 0 24 24'"),
};
astryxTokens.strokeAlign = "inside";
astryxTokens.typography = { title: astryxTitleFont() };

/**
 * MUI Alert severity default success, variant standard. Root padding 6px 16px.
 * AlertIcon marginRight 12, padding 7px 0, fontSize 22, opacity 0.9.
 * AlertMessage padding 8px 0. body2 14 / 1.43 → 20. Icon column 22+14 = 36.
 * Height 6+36+6 = 48. shape.borderRadius 4. No border on standard.
 * Colors from createPalette + colorManipulator lighten(light, 0.9) /
 * darken(light, 0.6) via the installed @mui/material@9.2.0 CJS build.
 */
const muiTokens = cloneTokens("mui.alert", (path, fallback) => {
  if (path === "box.height") return 48;
  if (path === "box.paddingX") return 16;
  if (path === "box.paddingY") return 6;
  if (path === "box.radius") return 4;
  if (path === "box.borderWidth") return 0;
  if (path === "box.gap") return 12;
  if (path === "icon.size") return 22;
  if (path === "titleFontSize") return 14;
  if (path === "titleLineHeight") return 20;
  if (path === "states.info.boxFill") return "#e5f6fdff";
  if (path === "states.info.boxBorder") return "#00000000";
  if (path === "states.info.title") return "#014361ff";
  if (path === "states.info.iconFill") return "#0288d1ff";
  if (path === "states.info.iconOpacity") return 0.9;
  if (path === "states.success.boxFill") return "#edf7edff";
  if (path === "states.success.boxBorder") return "#00000000";
  if (path === "states.success.title") return "#1e4620ff";
  if (path === "states.success.iconFill") return "#2e7d32ff";
  if (path === "states.success.iconOpacity") return 0.9;
  if (path === "states.warning.boxFill") return "#fff4e5ff";
  if (path === "states.warning.boxBorder") return "#00000000";
  if (path === "states.warning.title") return "#663c00ff";
  if (path === "states.warning.iconFill") return "#ed6c02ff";
  if (path === "states.warning.iconOpacity") return 0.9;
  if (path === "states.error.boxFill") return "#fdededff";
  if (path === "states.error.boxBorder") return "#00000000";
  if (path === "states.error.title") return "#5f2120ff";
  if (path === "states.error.iconFill") return "#d32f2fff";
  if (path === "states.error.iconOpacity") return 0.9;
  return fallback;
});
muiTokens.icon.glyphs = {
  info: readCaptureGlyph("extract/computed/out/mui/alert/assets/alert-alert-icon-info.svg", { x: 0, y: 0, width: 24, height: 24 }, "@mui/material SvgIcon default viewBox '0 0 24 24' (icons-material CheckCircleOutline / InfoOutlined / ReportProblemOutlined / ErrorOutline)"),
  success: readCaptureGlyph("extract/computed/out/mui/alert/assets/alert-alert-icon-success.svg", { x: 0, y: 0, width: 24, height: 24 }, "@mui/material SvgIcon default viewBox '0 0 24 24' (icons-material CheckCircleOutline / InfoOutlined / ReportProblemOutlined / ErrorOutline)"),
  warning: readCaptureGlyph("extract/computed/out/mui/alert/assets/alert-alert-icon-warning.svg", { x: 0, y: 0, width: 24, height: 24 }, "@mui/material SvgIcon default viewBox '0 0 24 24' (icons-material CheckCircleOutline / InfoOutlined / ReportProblemOutlined / ErrorOutline)"),
  error: readCaptureGlyph("extract/computed/out/mui/alert/assets/alert-alert-icon-error.svg", { x: 0, y: 0, width: 24, height: 24 }, "@mui/material SvgIcon default viewBox '0 0 24 24' (icons-material CheckCircleOutline / InfoOutlined / ReportProblemOutlined / ErrorOutline)"),
};
muiTokens.strokeAlign = "inside";
muiTokens.typography = { title: muiTitleFont() };

/**
 * antd Alert type default info. prepareComponentToken paddingHorizontal 12,
 * defaultPadding paddingContentVerticalSM 8 + 12. borderRadiusLG 8.
 * Icon marginInlineEnd marginXS 8. Icon size 1em = --font-size 14.
 * Message line 14 * 1.5714285714285714 = 22. Height 8+8+22 = 38.
 * Colors from examples/antd/tokens/antd.vars.css status tokens.
 */
const antdTokens = cloneTokens("antd.alert", (path, fallback) => {
  // BORDER-BOX height: paddingBlock 8+8 + line 22 + border 1+1 = 40. The
  // hand-typed 38 omitted the 1px border the capture records
  // (extract/computed/out/antd/alert root.border-top-width 1px) and the real
  // render measures 40; the stroke is inside, so the frame height carries it.
  if (path === "box.height") return 40;
  if (path === "box.paddingX") return 12;
  if (path === "box.paddingY") return 8;
  if (path === "box.radius") return 8;
  if (path === "box.borderWidth") return 1;
  if (path === "box.gap") return 8;
  if (path === "icon.size") return 14;
  if (path === "titleFontSize") return 14;
  if (path === "titleLineHeight") return 22;
  if (path === "states.info.boxFill") return "#e6f4ffff";
  if (path === "states.info.boxBorder") return "#91caffff";
  if (path === "states.info.title") return "#000000e0";
  if (path === "states.info.iconFill") return "#1677ffff";
  if (path === "states.info.iconOpacity") return 1;
  if (path === "states.success.boxFill") return "#f6ffedff";
  if (path === "states.success.boxBorder") return "#b7eb8fff";
  if (path === "states.success.title") return "#000000e0";
  if (path === "states.success.iconFill") return "#52c41aff";
  if (path === "states.success.iconOpacity") return 1;
  if (path === "states.warning.boxFill") return "#fffbe6ff";
  if (path === "states.warning.boxBorder") return "#ffe58fff";
  if (path === "states.warning.title") return "#000000e0";
  if (path === "states.warning.iconFill") return "#faad14ff";
  if (path === "states.warning.iconOpacity") return 1;
  if (path === "states.error.boxFill") return "#fff2f0ff";
  if (path === "states.error.boxBorder") return "#ffccc7ff";
  if (path === "states.error.title") return "#000000e0";
  if (path === "states.error.iconFill") return "#ff4d4fff";
  if (path === "states.error.iconOpacity") return 1;
  return fallback;
});
antdTokens.icon.glyphs = {
  info: readCaptureGlyph("extract/computed/out/antd/alert/assets/alert-alert-icon-info.svg", { x: 64, y: 64, width: 896, height: 896 }, "@ant-design/icons-svg lib/asn/*Filled.js viewBox '64 64 896 896'"),
  success: readCaptureGlyph("extract/computed/out/antd/alert/assets/alert-alert-icon-success.svg", { x: 64, y: 64, width: 896, height: 896 }, "@ant-design/icons-svg lib/asn/*Filled.js viewBox '64 64 896 896'"),
  warning: readCaptureGlyph("extract/computed/out/antd/alert/assets/alert-alert-icon-warning.svg", { x: 64, y: 64, width: 896, height: 896 }, "@ant-design/icons-svg lib/asn/*Filled.js viewBox '64 64 896 896'"),
  error: readCaptureGlyph("extract/computed/out/antd/alert/assets/alert-alert-icon-error.svg", { x: 64, y: 64, width: 896, height: 896 }, "@ant-design/icons-svg lib/asn/*Filled.js viewBox '64 64 896 896'"),
};
antdTokens.strokeAlign = "inside";
antdTokens.typography = { title: antdTitleFont() };

export const astryxAlertSource: ReviewedAlertSource = {
  packageName: "@astryxdesign/core",
  version: "0.1.6",
  exportName: "Banner",
  framework: "react",
  sourceRoot:
    "examples/astryx/.astryx-sandbox/node_modules/@astryxdesign/core/src/Banner",
  anatomy: {
    root: "Banner.tsx header + optional Card children. Root is layout-only; colour is the full header background. No left accent bar. AlertDialog waits for Dialog last.",
    control:
      "header gap --spacing-2 8, paddingBlock --spacing-3 12, paddingInline --spacing-4 16, --radius-container 12. Icon size md 20. Height 12+12+20 = 44. status required.",
    title:
      "--text-label-size 14 / --font-weight-semibold 600 / --text-label-leading 1.4286 → 20 / --color-text-primary #0A1317. Example title New update available",
  },
  api: {
    status: "required info | warning | error | success; example uses info",
    extras: "isDismissable, collapsible children, container section, Toast overlay receipted",
  },
  styleSources: [
    "Banner/Banner.tsx header + title + defaultIcons",
    "Icon/Icon.tsx md 20×20",
    "src/theme/tokens.stylex.ts light half muted fills and semantic icon colours",
  ],
  fontSources: [
    "Banner.tsx title --font-family-body system stack Semibold 14",
  ],
};

export const muiAlertSource: ReviewedAlertSource = {
  packageName: "@mui/material",
  version: "9.2.0",
  exportName: "Alert",
  framework: "react",
  sourceRoot:
    "recipe/sandboxes/input-field-mui/node_modules/@mui/material/Alert",
  anatomy: {
    root: "Alert.js Paper elevation 0. severity default success. variant default standard. Do not compile outlined/filled.",
    control:
      "root padding 6px 16px; AlertIcon marginRight 12 padding 7px 0 fontSize 22 opacity 0.9; AlertMessage padding 8px 0; shape.borderRadius 4; height 6+36+6 = 48",
    title:
      "body2 14 / 1.43 → 20. standard colour = darken(palette[sev].light, 0.6); background = lighten(palette[sev].light, 0.9); icon palette[sev].main",
  },
  api: {
    severity: "default success; values error | info | success | warning",
    extras: "variant outlined/filled, action, onClose, Toast/Snackbar overlay receipted",
  },
  styleSources: [
    "Alert/Alert.js severity success, variant standard, padding 6px 16px",
    "styles/createPalette.js getDefaultSuccess/Info/Warning/Error light mode",
    "@mui/material/styles colorManipulator lighten/darken via CJS require",
    "@mui/system/createTheme/shape.js borderRadius 4",
  ],
  fontSources: ["createTypography.js body2 Roboto Regular 14 / 1.43"],
};

export const antdAlertSource: ReviewedAlertSource = {
  packageName: "antd",
  version: "5.29.3",
  exportName: "Alert",
  framework: "react",
  sourceRoot: "examples/antd/.antd-sandbox/node_modules/antd/es/alert",
  anatomy: {
    root: "Alert.js type default info. banner mode is not the shared axis (banner defaults type to warning and drops radius/border).",
    control:
      "prepareComponentToken paddingHorizontal 12; defaultPadding 8px 12px; borderRadiusLG 8; icon marginInlineEnd marginXS 8; icon 1em 14; border-box height 8+8+22+1+1 = 40 (lineWidth 1 border)",
    title:
      "message colorTextHeading rgba(0,0,0,0.88); --font-size 14; --line-height 1.5714285714285714 → 22. Title-only; description is optional.",
  },
  api: {
    type: "default info; values success | info | error | warning",
    extras: "banner, closable, showIcon, description, action receipted",
  },
  styleSources: [
    "antd/es/alert/Alert.js type default info",
    "antd/es/alert/style/index.js prepareComponentToken + genBaseStyle",
    "examples/antd/tokens/antd.vars.css status colour / bg / border tokens",
  ],
  fontSources: [
    "examples/antd/tokens/antd.vars.css --font-family system stack; --font-size 14px",
  ],
};

const categoryForToken = (path: string): AlertFactCategory => {
  if (path.includes("typography")) return "typography";
  if (path.includes("iconOpacity")) return "state";
  if (
    path.includes("boxFill") ||
    path.includes("boxBorder") ||
    path.endsWith(".title") ||
    path.includes("iconFill") ||
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
  facts: ReviewedAlertSourceFact[] = [],
): ReviewedAlertSourceFact[] => {
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
  // A status glyph is one CAPTURE-READ fact per leaf: the path and winding
  // come from the asset file at build time and the viewBox from the cited
  // package source, so every leaf names the file it was read from.
  if (/^tokens\.icon\.glyphs\.(info|success|warning|error)$/.test(path)) {
    const glyph = record as { source?: { asset: string; viewBoxCitation: string } };
    const where = glyph.source
      ? `read from ${glyph.source.asset}; viewBox per ${glyph.source.viewBoxCitation}`
      : "canonical ring glyph";
    const leaves = (v: unknown, at: string): void => {
      if (v === null || typeof v !== "object") {
        facts.push({
          occurrenceId: `${sourceSlug}-ir-${facts.length + 1}`,
          category: "geometry",
          source: { kind: "review", evidence: `${evidence}; ${where}; ${at}=${String(v).slice(0, 60)}` },
          disposition: "ir",
          target: at,
        });
        return;
      }
      for (const [k, c] of Object.entries(v as Record<string, unknown>)) leaves(c, `${at}.${k}`);
    };
    leaves(record, path);
    return facts;
  }
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

/**
 * Title text is taken from each capture's own sample, so the fidelity pair
 * (extract/computed/out/<lib>/<comp>/orig-shots) is like-for-like. It is
 * content, not a design fact; a shared string across libraries compared
 * three mints against three different renders.
 */
const captureContent = {
  astryx: { title: "A new software update is available." }, // configs/astryx-core.json Banner fixedProps.title
  mui: { title: "This is an alert — check it out!" }, // configs/mui.json Alert sampleText
  antd: { title: "Alert message" }, // configs/antd.json Alert fixedProps.message
} as const;

const makeRefusals = (
  slug: string,
  rows: Array<{
    id: string;
    evidence: string;
    target: string;
    reason: "lowered" | "no-figma-primitive" | "refused-by-recipe";
  }>,
): ReviewedAlertSourceFact[] =>
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
    id: "refusal-alert-dialog",
    evidence: "AlertDialog is a dialog — waits for Dialog last",
    target: "Astryx AlertDialog",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-toast",
    evidence: "Toast overlay is not the in-page banner",
    target: "Astryx Toast overlay",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dismiss",
    evidence: "isDismissable close control — not a shared axis",
    target: "Astryx isDismissable",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-children",
    evidence: "collapsible Card children / description — title-only compile",
    target: "Astryx Banner children",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-description",
    evidence: "Banner description prop — a second text line under the title; alert@1 compiles a title-only banner, and the fidelity reference is captured title-only to match (configs/astryx-core.json Banner)",
    target: "Astryx Banner description",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-section",
    evidence: "container=section radius 0 — not the shared Banner card",
    target: "Astryx container section",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-dark",
    evidence: "tokens.stylex.ts light-dark pairs; alert@1 carries the light half",
    target: "dark half of every light-dark() colour pair",
    reason: "lowered",
  },
]);

const muiRefusals = makeRefusals("mui", [
  {
    id: "refusal-outlined-filled",
    evidence: "variant default standard; outlined/filled are not a shared axis",
    target: "MUI Alert variant outlined/filled",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-close",
    evidence: "onClose / action — not a shared axis",
    target: "MUI Alert onClose",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-snackbar",
    evidence: "Snackbar/Toast overlay waits; compile the in-page Alert",
    target: "MUI Snackbar overlay",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-description",
    evidence: "optional children / description — title-only compile",
    target: "MUI Alert description",
    reason: "refused-by-recipe",
  },
]);

const antdRefusals = makeRefusals("antd", [
  {
    id: "refusal-banner-mode",
    evidence: "banner mode defaults type to warning and drops radius/border — not the shared axis",
    target: "AntD Alert banner mode",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-closable",
    evidence: "closable — not a shared axis",
    target: "AntD Alert closable",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-description",
    evidence: "withDescription padding — title-only compile",
    target: "AntD Alert description",
    reason: "refused-by-recipe",
  },
  {
    id: "refusal-action",
    evidence: "action slot — not a shared axis",
    target: "AntD Alert action",
    reason: "refused-by-recipe",
  },
]);

const buildConfig = (
  slug: string,
  source: ReviewedAlertSource,
  tokens: AlertRecipeInstance["tokens"],
  identity: { id: string; name: string },
  axes: AlertRecipeInstance["axes"],
  refusals: ReviewedAlertSourceFact[],
  extraIr: ReviewedAlertSourceFact[],
  unsupported: string[],
): ReviewedAlertAdapterConfig => {
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
    sourcePath: `recipe/fixtures/library-alerts.ts#${slug}AlertAdapterConfig`,
    generatedAt: "2026-08-31T00:00:00.000Z",
    selection: {
      candidates: [{ id: "alert", version: 1 }],
      selectedBy: "recipe-pivot-alert-review",
      mechanism: "reviewed-config",
      source: `recipe/fixtures/library-alerts.ts#${slug}`,
      reviewedAt: "2026-08-31T00:00:00.000Z",
      manualCost: {
        value: manualMappings.length,
        unit: "reviewed-mapping",
        note: `${manualMappings.length} explicit occurrence mappings; no source-name inference`,
      },
    },
    identity,
    content: structuredClone(captureContent[slug as keyof typeof captureContent]),
    tokens: structuredClone(tokens),
    axes: structuredClone(axes),
    sourceFacts: facts,
    manualMappings,
    receipts: [],
    benchmark: {
      packageName: source.packageName,
      version: source.version,
      exportName: source.exportName,
      importPath: source.packageName,
      wrapper: `${source.exportName} in-page banner`,
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
  source: ReviewedAlertSource,
): ReviewedAlertSourceFact[] => [
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
];

const statusAxis = (
  defaultStatus: "info" | "success" | "warning" | "error",
): AlertRecipeInstance["axes"] => ({
  status: {
    name: "Status",
    values: ["info", "success", "warning", "error"],
    default: defaultStatus,
  },
});

export const astryxAlertAdapterConfig = buildConfig(
  "astryx",
  astryxAlertSource,
  astryxTokens,
  { id: "astryx.alert", name: "Astryx Banner" },
  statusAxis("info"),
  astryxRefusals,
  anatomyFacts("astryx", astryxAlertSource),
  ["AlertDialog", "Toast", "isDismissable", "children", "container-section", "description"],
);

export const muiAlertAdapterConfig = buildConfig(
  "mui",
  muiAlertSource,
  muiTokens,
  { id: "mui.alert", name: "MUI Alert" },
  statusAxis("success"),
  muiRefusals,
  anatomyFacts("mui", muiAlertSource),
  ["variant-outlined", "variant-filled", "onClose", "Snackbar", "description"],
);

export const antdAlertAdapterConfig = buildConfig(
  "antd",
  antdAlertSource,
  antdTokens,
  { id: "antd.alert", name: "Ant Design Alert" },
  statusAxis("info"),
  antdRefusals,
  anatomyFacts("antd", antdAlertSource),
  ["banner-mode", "closable", "description", "action"],
);

export const ALERT_THREE_LIBRARY_PROOF_PROTOCOL = {
  artifactVersion: "alert-three-library-proof-protocol-v1",
  frozenBeforeResults: true,
  resultStatus: "not-run",
  cellsPerSource: 4,
  totalCells: 12,
  sources: [
    "@astryxdesign/core@0.1.6#Banner",
    "@mui/material@9.2.0#Alert",
    "antd@5.29.3#Alert",
  ],
  comparison: {
    sourceReferencesRendered: false,
    aiGrading: false,
    liveFigma: false,
    humanGrade: "queued-for-TJ",
  },
} as const;
