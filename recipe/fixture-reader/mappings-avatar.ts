/**
 * FIXTURE READER — Avatar (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/avatar/captured-truth.json
 * AntD   extract/computed/out/antd/avatar/captured-truth.json
 * Astryx no Avatar capture-floor subject — named receipt (no config seed).
 */
import { px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const ASTRYX_WHY =
  "the capture floor has no Avatar subject — configs/astryx.json does not mount Avatar; the recipe table cites core Avatar.tsx without a Chromium ledger";

export const ASTRYX_AVATAR_LEDGER = null;
export const astryxAvatarMappings: FactMapping[] = receiptAll(
  [
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
    "typography.label.family",
    "typography.label.style",
  ],
  ASTRYX_WHY,
  "docs/34 Astryx Avatar — no extract/computed capture subject",
);

export const MUI_AVATAR_LEDGER = "extract/computed/out/mui/avatar/captured-truth.json";
const mCombo = "circular";
const mRoot = "cls:MuiAvatar-root";

export const muiAvatarMappings: FactMapping[] = [
  one("box.height", "px", { combo: mCombo, part: mRoot, channel: "height" }),
  one("box.paddingX", "px", { combo: mCombo, part: mRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: mCombo, part: mRoot, channel: "padding-top" }),
  {
    path: "box.radius",
    kind: "px",
    reads: {
      r: { combo: mCombo, part: mRoot, channel: "border-top-left-radius" },
      h: { combo: mCombo, part: mRoot, channel: "height" },
    },
    formula: "circular Avatar is 50% → size/2",
    combine: (raw) => (String(raw.r).trim() === "50%" ? px(raw.h) / 2 : px(raw.r)),
  },
  one("box.borderWidth", "px", { combo: mCombo, part: mRoot, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: mCombo, part: mRoot, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: mCombo, part: mRoot, channel: "line-height" }),
  one("rest.boxFill", "color", { combo: mCombo, part: mRoot, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "circular Avatar draws no painted border — transparent is the recipe spelling",
    "Avatar.js border none — reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: mCombo, part: mRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: mCombo, part: mRoot, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mRoot, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mRoot, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ANTD_AVATAR_LEDGER = "extract/computed/out/antd/avatar/captured-truth.json";
const aCombo = "default.circle";
const aRoot = "cls:ant-avatar";
const aLabel = "cls:ant-avatar-string";

export const antdAvatarMappings: FactMapping[] = [
  one("box.height", "px", { combo: aCombo, part: aRoot, channel: "height" }),
  one("box.paddingX", "px", { combo: aCombo, part: aRoot, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: aCombo, part: aRoot, channel: "padding-top" }),
  {
    path: "box.radius",
    kind: "px",
    reads: {
      r: { combo: aCombo, part: aRoot, channel: "border-top-left-radius" },
      h: { combo: aCombo, part: aRoot, channel: "height" },
    },
    formula: "circle Avatar is 50% → size/2",
    combine: (raw) => (String(raw.r).trim() === "50%" ? px(raw.h) / 2 : px(raw.r)),
  },
  one("box.borderWidth", "px", { combo: aCombo, part: aRoot, channel: "border-top-width" }),
  one("labelFontSize", "px", { combo: aCombo, part: aRoot, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: aCombo, part: aLabel, channel: "line-height" }),
  one("rest.boxFill", "color", { combo: aCombo, part: aRoot, channel: "background-color" }),
  receipt(
    "rest.boxBorder",
    "circle Avatar's border color is transparent — the recipe spells #00000000",
    "avatar border-color transparent — reviewed #00000000",
  ),
  one("rest.boxOpacity", "number", { combo: aCombo, part: aRoot, channel: "opacity" }),
  one("rest.label", "color", { combo: aCombo, part: aLabel, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  receipt("typography.label.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system"),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: aCombo, part: aRoot, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
