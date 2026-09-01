/**
 * FIXTURE READER — Badge (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/badge/captured-truth.json  (proof color=error)
 * AntD   extract/computed/out/antd/badge/captured-truth.json
 * Astryx Badge is an INLINE status label, not an anchored overlay — named refusal
 *        (recipe/fixtures/library-badges.ts astryxBadgeOverlayRefusal). No overlay mapping.
 */
import { matrix, px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const ASTRYX_WHY =
  "Astryx Badge is an inline status label (height 20, padX 8, radius-full, variant neutral) — not an anchored overlay. Do not invent an Astryx pip. Named refusal astryxBadgeOverlayRefusal.";

export const ASTRYX_BADGE_LEDGER = null;
export const astryxBadgeMappings: FactMapping[] = receiptAll(
  [
    "host.size",
    "host.radius",
    "host.fill",
    "indicator.height",
    "indicator.minWidth",
    "indicator.paddingX",
    "indicator.radius",
    "indicator.borderWidth",
    "indicator.translateX",
    "indicator.translateY",
    "indicator.fill",
    "indicator.border",
    "indicator.opacity",
    "labelFontSize",
    "labelLineHeight",
    "label",
    "strokeAlign",
    "typography.label.family",
    "typography.label.style",
  ],
  ASTRYX_WHY,
  "recipe/fixtures/library-badges.ts astryxBadgeOverlayRefusal",
);

export const MUI_BADGE_LEDGER = "extract/computed/out/mui/badge/captured-truth.json";
const mCombo = "error.standard";
const mHost = "cls:MuiAvatar-root";
const mBadge = "cls:MuiBadge-badge";

export const muiBadgeMappings: FactMapping[] = [
  one("host.size", "px", { combo: mCombo, part: mHost, channel: "height" }),
  {
    path: "host.radius",
    kind: "px",
    reads: {
      r: { combo: mCombo, part: mHost, channel: "border-top-left-radius" },
      h: { combo: mCombo, part: mHost, channel: "height" },
    },
    formula: "circular host is 50% → size/2",
    combine: (raw) => (String(raw.r).trim() === "50%" ? px(raw.h) / 2 : px(raw.r)),
  },
  one("host.fill", "color", { combo: mCombo, part: mHost, channel: "background-color" }),
  one("indicator.height", "px", { combo: mCombo, part: mBadge, channel: "height" }),
  one("indicator.minWidth", "px", { combo: mCombo, part: mBadge, channel: "min-width" }),
  one("indicator.paddingX", "px", { combo: mCombo, part: mBadge, channel: "padding-left" }),
  one("indicator.radius", "px", { combo: mCombo, part: mBadge, channel: "border-top-left-radius" }),
  one("indicator.borderWidth", "px", { combo: mCombo, part: mBadge, channel: "border-top-width" }),
  // overlap="circular" (the mount the capture records): Badge.js anchors the
  // badge at top/right 14% of the host and THEN translates (50%, -50%). The
  // recipe's translateX/Y is the offset from the docked top-right position,
  // so it is transform.tx − right and transform.ty + top — reading the
  // transform alone gives the rectangular ±10 and misses the 5.6px inset,
  // which is exactly the 50x50-vs-44x44 the fidelity gate measured.
  {
    path: "indicator.translateX",
    kind: "px",
    reads: {
      v: { combo: mCombo, part: mBadge, channel: "transform" },
      right: { combo: mCombo, part: mBadge, channel: "right" },
    },
    formula: "matrix tx − right inset (circular overlap anchors 14% inside the host)",
    tolerance: 0.001,
    toleranceReason: "the ledger rounds to 3 decimals (4.406); the fixture carries the captured 5.59375 inset exactly (4.40625)",
    combine: (raw) => matrix(raw.v).tx - parseFloat(String(raw.right)),
  },
  {
    path: "indicator.translateY",
    kind: "px",
    reads: {
      v: { combo: mCombo, part: mBadge, channel: "transform" },
      top: { combo: mCombo, part: mBadge, channel: "top" },
    },
    formula: "matrix ty + top inset (circular overlap anchors 14% inside the host)",
    tolerance: 0.001,
    toleranceReason: "the ledger rounds to 3 decimals (4.406); the fixture carries the captured 5.59375 inset exactly (4.40625)",
    combine: (raw) => matrix(raw.v).ty + parseFloat(String(raw.top)),
  },
  one("indicator.fill", "color", { combo: mCombo, part: mBadge, channel: "background-color" }),
  receipt(
    "indicator.border",
    "standard BadgeBadge draws no painted border — transparent is the recipe spelling",
    "Badge.js border none — reviewed #00000000",
  ),
  one("indicator.opacity", "number", { combo: mCombo, part: mBadge, channel: "opacity" }),
  one("labelFontSize", "px", { combo: mCombo, part: mBadge, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: mCombo, part: mBadge, channel: "line-height" }),
  one("label", "color", { combo: mCombo, part: mBadge, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling", "reviewed inside"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mBadge, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mBadge, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const ANTD_BADGE_LEDGER = "extract/computed/out/antd/badge/captured-truth.json";
const aCombo = "count.unset";
const aHost = "cls:ant-avatar";
const aCount = "cls:ant-badge-count";

export const antdBadgeMappings: FactMapping[] = [
  one("host.size", "px", { combo: aCombo, part: aHost, channel: "height" }),
  receipt(
    "host.radius",
    "the capture mounts a default Avatar (borderRadiusLG 6) as the host child — the recipe spells a CIRCLE host (size/2 = 16); that circle host is a reviewed pairing, not the ledger's default Avatar",
    "Avatar circle size/2 — reviewed 16",
  ),
  one("host.fill", "color", { combo: aCombo, part: aHost, channel: "background-color" }),
  one("indicator.height", "px", { combo: aCombo, part: aCount, channel: "height" }),
  one("indicator.minWidth", "px", { combo: aCombo, part: aCount, channel: "min-width" }),
  one("indicator.paddingX", "px", { combo: aCombo, part: aCount, channel: "padding-left" }),
  one("indicator.radius", "px", { combo: aCombo, part: aCount, channel: "border-top-left-radius" }),
  receipt(
    "indicator.borderWidth",
    "antd count uses box-shadow as the white ring, not CSS border-width (ledger border-top-width is 0) — the recipe's 1px border is the reviewed box-shadow lowering",
    "Badge count box-shadow ring — reviewed 1",
  ),
  {
    path: "indicator.translateX",
    kind: "px",
    reads: { v: { combo: aCombo, part: aCount, channel: "transform" } },
    combine: (raw) => matrix(raw.v).tx,
  },
  {
    path: "indicator.translateY",
    kind: "px",
    reads: { v: { combo: aCombo, part: aCount, channel: "transform" } },
    combine: (raw) => matrix(raw.v).ty,
  },
  one("indicator.fill", "color", { combo: aCombo, part: aCount, channel: "background-color" }),
  receipt(
    "indicator.border",
    "the white ring is a box-shadow, not border-color — recipe spells #ffffffff from the shadow",
    "Badge count box-shadow #fff — reviewed #ffffffff",
  ),
  one("indicator.opacity", "number", { combo: aCombo, part: aCount, channel: "opacity" }),
  one("labelFontSize", "px", { combo: aCombo, part: aCount, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: aCombo, part: aCount, channel: "line-height" }),
  one("label", "color", { combo: aCombo, part: aCount, channel: "color" }),
  receipt("strokeAlign", "recipe anatomy spelling (outside for the shadow ring)", "reviewed outside"),
  receipt("typography.label.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system"),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: aCombo, part: aCount, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
