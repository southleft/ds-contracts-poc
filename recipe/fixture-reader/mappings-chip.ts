/**
 * FIXTURE READER — Chip / Tag / Token (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/chip/captured-truth.json
 * AntD   extract/computed/out/antd/tag/captured-truth.json  (Tag export)
 * Astryx extract/computed/out/astryx/token/captured-truth.json (Token export)
 */
import { px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, styleForWeight } from "./mappings-util.js";

export const MUI_CHIP_LEDGER = "extract/computed/out/mui/chip/captured-truth.json";
const mCombo = "filled.default.medium";
const mRoot = "cls:MuiChip-root";
const mLabel = "cls:MuiChip-label";

export const muiChipMappings: FactMapping[] = [
  one("box.height", "px", { combo: mCombo, part: mRoot, channel: "height" }),
  one("box.paddingX", "px", { combo: mCombo, part: mLabel, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: mCombo, part: mLabel, channel: "padding-top" }),
  one("box.radius", "px", { combo: mCombo, part: mRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: mCombo, part: mRoot, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: mCombo, part: mLabel, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: mCombo, part: mLabel, channel: "line-height" }),
  one("rest.boxFill", "color", { combo: mCombo, part: mRoot, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "filled Chip draws no visible border — transparent is the recipe's spelling (ledger border-top-color is the ink color, not a painted stroke)",
    "Chip.js filled border none — reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: mCombo, part: mRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: mCombo, part: mLabel, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mLabel, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mLabel, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ANTD_CHIP_LEDGER = "extract/computed/out/antd/tag/captured-truth.json";
const aCombo = "unset.bordered.off";
const aRoot = "cls:ant-tag";

export const antdChipMappings: FactMapping[] = [
  one("box.height", "px", { combo: aCombo, part: aRoot, channel: "height" }),
  one("box.paddingX", "px", { combo: aCombo, part: aRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: aCombo, part: aRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: aCombo, part: aRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: aCombo, part: aRoot, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: aCombo, part: aRoot, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: aCombo, part: aRoot, channel: "line-height" }),
  one("rest.boxFill", "color", { combo: aCombo, part: aRoot, channel: "background-color" }),
  one("rest.boxBorder", "color", { combo: aCombo, part: aRoot, channel: "border-top-color" }),
  one("rest.boxOpacity", "number", { combo: aCombo, part: aRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: aCombo, part: aRoot, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("typography.label.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system"),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: aCombo, part: aRoot, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ASTRYX_CHIP_LEDGER = "extract/computed/out/astryx/token/captured-truth.json";
const xCombo = "md.default";
const xRoot = "cls:astryx-token";

export const astryxChipMappings: FactMapping[] = [
  one("box.height", "px", { combo: xCombo, part: xRoot, channel: "height" }),
  one("box.paddingX", "px", { combo: xCombo, part: xRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: xCombo, part: xRoot, channel: "padding-top" }),
  one("box.radius", "px", { combo: xCombo, part: xRoot, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: xCombo, part: xRoot, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: xCombo, part: xRoot, channel: "font-size" }),
  {
    path: "labelLineHeight",
    kind: "px",
    reads: { v: { combo: xCombo, part: xRoot, channel: "line-height" } },
    formula: "sub-pixel line-height rounded",
    combine: (raw) => Math.round(px(raw.v)),
    tolerance: 0.001,
    toleranceReason: "captured line-height is 20.0004 from the theme leading token",
  },
  one("rest.boxFill", "color", { combo: xCombo, part: xRoot, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "Token draws no painted border — transparent is the recipe spelling (ledger border color is ink, not a stroke)",
    "Token.tsx border none — reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: xCombo, part: xRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: xCombo, part: xRoot, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: xCombo, part: xRoot, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: xCombo, part: xRoot, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
