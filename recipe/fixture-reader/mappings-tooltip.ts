/**
 * FIXTURE READER — Tooltip (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/tooltip/captured-truth.json (open=true plane)
 * AntD   extract/computed/out/antd/tooltip/captured-truth.json
 * Astryx no Tooltip capture-floor subject
 */
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const BOX_LEAVES = [
  "box.height",
  "box.paddingX",
  "box.paddingY",
  "box.radius",
  "box.borderWidth",
  "labelFontSize",
  "labelLineHeight",
  "rest.boxFill",
  "rest.boxBorder",
  "rest.boxOpacity",
  "rest.label",
  "strokeAlign",
  "lineHeightUnit",
  "decoration",
  "typography.label.family",
  "typography.label.style",
];

export const ASTRYX_TOOLTIP_LEDGER = null;
export const astryxTooltipMappings: FactMapping[] = receiptAll(
  BOX_LEAVES,
  "the capture floor has no Tooltip subject — configs/astryx.json does not mount Tooltip",
  "docs/34 Astryx Tooltip — no extract/computed capture subject",
);

export const MUI_TOOLTIP_LEDGER = "extract/computed/out/mui/tooltip/captured-truth.json";
const mCombo = "on";
const mTip = "cls:MuiTooltip-tooltip";

export const muiTooltipMappings: FactMapping[] = [
  receipt(
    "box.height",
    "Tooltip hug-contents height is content-dependent — the recipe spells 0 (auto hug); the capture's content-box height is not a fixed recipe fact",
    "reviewed 0",
  ),
  one("box.paddingX", "px", { combo: mCombo, part: mTip, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: mCombo, part: mTip, channel: "padding-top" }),
  one("box.radius", "px", { combo: mCombo, part: mTip, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: mCombo, part: mTip, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: mCombo, part: mTip, channel: "font-size" }),
  {
    path: "labelLineHeight",
    kind: "px",
    reads: { v: { combo: mCombo, part: mTip, channel: "line-height" } },
    formula: "CSS normal → recipe 0 with lineHeightUnit auto",
    combine: (raw) => (raw.v === "normal" ? 0 : Number.parseFloat(raw.v)),
  },
  one("rest.boxFill", "color", { combo: mCombo, part: mTip, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "Tooltip draws no painted border — transparent is the recipe spelling",
    "reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: mCombo, part: mTip, channel: "opacity" }),
  one("rest.label", "color", { combo: mCombo, part: mTip, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("lineHeightUnit", "recipe spelling of CSS normal", "reviewed auto"),
  receipt("decoration", "tooltip text has no text-decoration", "reviewed none"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mTip, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mTip, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ANTD_TOOLTIP_LEDGER = "extract/computed/out/antd/tooltip/captured-truth.json";
const aCombo = "";
const aInner = "cls:ant-tooltip-inner";

export const antdTooltipMappings: FactMapping[] = [
  receipt(
    "box.height",
    "Tooltip hug-contents height is content-dependent — the recipe spells 0",
    "reviewed 0",
  ),
  one("box.paddingX", "px", { combo: aCombo, part: aInner, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: aCombo, part: aInner, channel: "padding-top" }),
  one("box.radius", "px", { combo: aCombo, part: aInner, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: aCombo, part: aInner, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: aCombo, part: aInner, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: aCombo, part: aInner, channel: "line-height" }),
  one("rest.boxFill", "color", { combo: aCombo, part: aInner, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "Tooltip inner draws no painted border — transparent is the recipe spelling",
    "reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: aCombo, part: aInner, channel: "opacity" }),
  one("rest.label", "color", { combo: aCombo, part: aInner, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("lineHeightUnit", "recipe spelling of the line-height unit axis (px length from the token)", "reviewed px"),
  receipt("decoration", "tooltip text has no text-decoration", "reviewed none"),
  receipt("typography.label.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system"),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: aCombo, part: aInner, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
