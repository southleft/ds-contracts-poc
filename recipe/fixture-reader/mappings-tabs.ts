/**
 * FIXTURE READER — Tabs (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/tabs/captured-truth.json
 * AntD   no Tabs capture-floor subject in configs/antd.json
 * Astryx no Tabs capture-floor subject
 */
import { px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const LEAVES = [
  "list.itemSpacing",
  "tab.paddingX",
  "tab.paddingY",
  "tab.radius",
  "tab.minWidth",
  "tab.minHeight",
  "tab.fill",
  "indicator.height",
  "indicator.radius",
  "indicator.opacity",
  "indicator.fill",
  "labelFontSize",
  "labelLineHeight",
  "rest.label",
  "selected.label",
  "lineHeightUnit",
  "textCase",
  "typography.rest.family",
  "typography.rest.style",
  "typography.selected.family",
  "typography.selected.style",
];

export const ASTRYX_TABS_LEDGER = null;
export const astryxTabsMappings: FactMapping[] = receiptAll(
  LEAVES,
  "the capture floor has no Tabs subject — configs/astryx.json does not mount Tabs",
  "docs/34 Astryx Tabs — no extract/computed capture subject",
);

export const ANTD_TABS_LEDGER = null;
export const antdTabsMappings: FactMapping[] = receiptAll(
  LEAVES,
  "configs/antd.json does not mount Tabs — no capture-floor ledger; named receipt not invention",
  "extract/computed/configs/antd.json components list has no Tabs",
);

export const MUI_TABS_LEDGER = "extract/computed/out/mui/tabs/captured-truth.json";
const mCombo = "primary.primary";
const mTab = "cls:MuiTab-root";
const mInd = "cls:MuiTabs-indicator";

export const muiTabsMappings: FactMapping[] = [
  receipt(
    "list.itemSpacing",
    "MUI Tabs flex list has no gap channel — 0 is the recipe spelling",
    "Tabs.js flex no gap — reviewed 0",
  ),
  one("tab.paddingX", "px", { combo: mCombo, part: mTab, channel: "padding-left" }),
  one("tab.paddingY", "px", { combo: mCombo, part: mTab, channel: "padding-top" }),
  one("tab.radius", "px", { combo: mCombo, part: mTab, channel: "border-top-left-radius" }),
  one("tab.minWidth", "px", { combo: mCombo, part: mTab, channel: "min-width" }),
  one("tab.minHeight", "px", { combo: mCombo, part: mTab, channel: "min-height" }),
  one("tab.fill", "color", { combo: mCombo, part: mTab, channel: "background-color" }),
  one("indicator.height", "px", { combo: mCombo, part: mInd, channel: "height" }),
  one("indicator.radius", "px", { combo: mCombo, part: mInd, channel: "border-top-left-radius" }),
  one("indicator.opacity", "number", { combo: mCombo, part: mInd, channel: "opacity" }),
  one("indicator.fill", "color", { combo: mCombo, part: mInd, channel: "background-color" }),
  one("labelFontSize", "px", { combo: mCombo, part: mTab, channel: "font-size" }),
  {
    path: "labelLineHeight",
    kind: "px",
    reads: {
      lh: { combo: mCombo, part: mTab, channel: "line-height" },
      fs: { combo: mCombo, part: mTab, channel: "font-size" },
    },
    formula: "recipe spells percent units (lineHeightUnit percent) — percent = round(px / fontSize * 100)",
    combine: (raw) => Math.round((px(raw.lh) / px(raw.fs)) * 100),
  },
  one("rest.label", "color", {
    combo: "primary.primary",
    part: "cls:MuiTab-root#1",
    channel: "color",
  }),
  one("selected.label", "color", { combo: mCombo, part: mTab, channel: "color" }),
  receipt("lineHeightUnit", "recipe spelling of percent line-height from button typography", "reviewed percent"),
  receipt("textCase", "Tab label text-transform uppercase — recipe spelling", "reviewed upper"),
  {
    path: "typography.rest.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: "cls:MuiTab-root#1", channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.rest.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: "cls:MuiTab-root#1", channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
  {
    path: "typography.selected.family",
    kind: "string",
    reads: { v: { combo: mCombo, part: mTab, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.selected.style",
    kind: "string",
    reads: { v: { combo: mCombo, part: mTab, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
