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
  "indicator.insetX",
  "indicator.offsetY",
  "labelFontSize",
  "labelLineHeight",
  "rest.label",
  "selected.label",
  "lineHeightUnit",
  "textCase",
  "tab.contentAlign",
  "tab.verticalAlign",
  "indicator.restFill",
  "labelLetterSpacing",
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
  one("indicator.insetX", "px", { combo: mCombo, part: mInd, channel: "left" }),
  one("indicator.offsetY", "px", { combo: mCombo, part: mInd, channel: "bottom" }),
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
  receipt("tab.contentAlign", "MuiTab-root justify-content center / align-items center — recipe spelling of the flex centring", "reviewed center"),
  receipt("tab.verticalAlign", "MuiTab-root align-items center — recipe spelling of the flex centring on the cross axis", "reviewed center"),
  receipt("indicator.restFill", "MuiTab-root has no border; the ink bar is the selected tab's — transparent, no node", "reviewed #00000000"),
  {
    path: "labelLetterSpacing",
    kind: "px",
    reads: { v: { combo: mCombo, part: mTab, channel: "letter-spacing" } },
    formula: "letter-spacing px (theme.typography.button 0.02857em at 14px)",
    combine: (raw) => Math.round(parseFloat(String(raw.v)) * 10) / 10,
    tolerance: 0.001,
    toleranceReason: "ledger 0.39998px is the browser's rendering of 0.02857em; the fixture carries the design value 0.4",
  },
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
