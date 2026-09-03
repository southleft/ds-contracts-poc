/**
 * FIXTURE READER — Menu (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/menu/captured-truth.json
 * AntD   no Menu capture-floor subject
 * Astryx no Menu capture-floor subject
 */
import type { FactMapping } from "./reader.js";
import { firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const LEAVES = [
  "panel.padding",
  "panel.radius",
  "panel.itemSpacing",
  "panel.fill",
  "panel.minWidth",
  "item.paddingX",
  "item.paddingY",
  "item.minHeight",
  "item.fill",
  "labelFontSize",
  "labelLineHeight",
  "label",
  "lineHeightUnit",
  "typography.label.family",
  "typography.label.style",
];

export const ASTRYX_MENU_LEDGER = null;
export const astryxMenuMappings: FactMapping[] = receiptAll(
  LEAVES,
  "the capture floor has no Menu subject — configs/astryx.json does not mount Menu",
  "docs/34 Astryx Menu — no extract/computed capture subject",
);

export const ANTD_MENU_LEDGER = null;
export const antdMenuMappings: FactMapping[] = receiptAll(
  LEAVES,
  "configs/antd.json does not mount Menu — no capture-floor ledger",
  "extract/computed/configs/antd.json components list has no Menu",
);

export const MUI_MENU_LEDGER = "extract/computed/out/mui/menu/captured-truth.json";
const mCombo = "";
const mPaper = "cls:MuiMenu-paper";
const mList = "cls:MuiMenu-list";
const mItem = "cls:MuiMenuItem-root";

export const muiMenuMappings: FactMapping[] = [
  {
    path: "panel.padding",
    kind: "px",
    reads: { pp: { combo: mCombo, part: mPaper, channel: "padding-top" }, lp: { combo: mCombo, part: mList, channel: "padding-top" } },
    formula: "the paper's padding-top plus the list's (MUI: 0 + 8) — the recipe's one panel inset",
    combine: (raw) => parseFloat(raw.pp!) + parseFloat(raw.lp!),
  },
  one("panel.radius", "px", { combo: mCombo, part: mPaper, channel: "border-top-left-radius" }),
  receipt(
    "panel.itemSpacing",
    "Menu list has no gap — 0 is the recipe spelling",
    "reviewed 0",
  ),
  one("panel.fill", "color", { combo: mCombo, part: mPaper, channel: "background-color" }),
  one("panel.minWidth", "px", { combo: mCombo, part: mPaper, channel: "min-width" }, {
    formula: "the paper's min-width as a length (Popover paper minWidth 16); `auto`/0 means the paper hugs",
    combine: (raw) => (raw.v && /^-?\d/.test(raw.v) ? parseFloat(raw.v) : 0),
  }),
  one("item.paddingX", "px", { combo: mCombo, part: mItem, channel: "padding-left" }),
  one("item.paddingY", "px", { combo: mCombo, part: mItem, channel: "padding-top" }),
  one("item.minHeight", "px", { combo: mCombo, part: mItem, channel: "min-height" }, {
    formula: "the item's min-height as a length; `auto`/0 means the item hugs (MenuItem.js: 48 below sm, auto above — the capture is above)",
    combine: (raw) => (raw.v && /^-?\d/.test(raw.v) ? parseFloat(raw.v) : 0),
  }),
  one("item.fill", "color", { combo: mCombo, part: mItem, channel: "background-color" }),
  one("labelFontSize", "px", { combo: mCombo, part: mItem, channel: "font-size" }),
  one("labelLineHeight", "px", { combo: mCombo, part: mItem, channel: "line-height" }),
  one("label", "color", { combo: mCombo, part: mItem, channel: "color" }),
  receipt("lineHeightUnit", "recipe spelling of the MenuItem line-height unit axis (px length)", "reviewed px"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mItem, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mItem, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
