/**
 * FIXTURE READER — Link (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/link/captured-truth.json
 * AntD   named absence — no top-level Link; Typography.Link only
 * Astryx no Link capture-floor subject
 */
import type { FactMapping } from "./reader.js";
import { firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const NO_ASTRYX =
  "the capture floor has no Link subject — configs/astryx.json does not mount Link";
const NO_ANTD =
  "antd has no top-level Link export — Typography.Link is a named absence (docs/34); do not invent a capture mount";

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

export const ASTRYX_LINK_LEDGER = null;
export const astryxLinkMappings: FactMapping[] = receiptAll(
  BOX_LEAVES,
  NO_ASTRYX,
  "docs/34 Astryx Link — no extract/computed capture subject",
);

export const ANTD_LINK_LEDGER = null;
export const antdLinkMappings: FactMapping[] = receiptAll(
  BOX_LEAVES,
  NO_ANTD,
  "docs/34 AntD Link named absence — Typography.Link",
);

export const MUI_LINK_LEDGER = "extract/computed/out/mui/link/captured-truth.json";
const mCombo = "primary.hover";
const mRoot = "cls:MuiLink-root";

export const muiLinkMappings: FactMapping[] = [
  receipt(
    "box.height",
    "Link is inline text — the recipe spells height 0 (no box plane); the capture's content-box height is not the recipe anatomy",
    "reviewed 0",
  ),
  one("box.paddingX", "px", { combo: mCombo, part: mRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: mCombo, part: mRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: mCombo, part: mRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: mCombo, part: mRoot, channel: "border-top-width" }),
  receipt(
    "labelFontSize",
    "the capture mounts Typography variant=inherit (font-size 16 / Times on the unstyled host) — the recipe cites body2 14 from the reviewed Link docs pairing, not the inherit plane",
    "Link.js + Typography body2 14 — reviewed 14",
  ),
  receipt(
    "labelLineHeight",
    "recipe spells 0 (auto unit / CSS normal) — the inherit plane's line-height is not the recipe's spelling",
    "reviewed 0 with lineHeightUnit auto",
  ),
  one("rest.boxFill", "color", { combo: mCombo, part: mRoot, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "Link draws no painted border — transparent is the recipe spelling",
    "reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: mCombo, part: mRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: mCombo, part: mRoot, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("lineHeightUnit", "recipe spelling of CSS normal/auto line-height", "reviewed auto"),
  receipt(
    "decoration",
    "the capture mounts underline=hover (MuiLink-underlineHover — no underline at rest); the recipe cites underline=always as the reviewed rest decoration",
    "Link.js underlineAlways — reviewed underline",
  ),
  receipt(
    "typography.label.family",
    "inherit plane computes Times on the capture host — recipe cites Roboto from createTypography",
    "createTypography.js fontFamily Roboto — reviewed Roboto",
  ),
  receipt(
    "typography.label.style",
    "createTypography fontWeightRegular 400 — reviewed Regular",
    "reviewed Regular",
  ),
];
