/**
 * FIXTURE READER — Dialog (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/dialog/captured-truth.json
 * AntD   no Dialog capture-floor subject
 * Astryx no Dialog capture-floor subject
 *
 * Note: the MUI capture's sm plane mounts DialogContent only (no DialogTitle) —
 * title facts and the title-padding plane are receipts citing DialogTitle.js.
 */
import type { FactMapping } from "./reader.js";
import { firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const LEAVES = [
  "paper.paddingX",
  "paper.paddingY",
  "paper.radius",
  "paper.itemSpacing",
  "paper.minWidth",
  "paper.fill",
  "titleFontSize",
  "titleLineHeight",
  "bodyFontSize",
  "bodyLineHeight",
  "title",
  "body",
  "typography.title.family",
  "typography.title.style",
  "typography.body.family",
  "typography.body.style",
];

export const ASTRYX_DIALOG_LEDGER = null;
export const astryxDialogMappings: FactMapping[] = receiptAll(
  LEAVES,
  "the capture floor has no Dialog subject — configs/astryx.json does not mount Dialog",
  "docs/34 Astryx Dialog — no extract/computed capture subject",
);

export const ANTD_DIALOG_LEDGER = null;
export const antdDialogMappings: FactMapping[] = receiptAll(
  LEAVES,
  "configs/antd.json does not mount Modal/Dialog — no capture-floor ledger",
  "extract/computed/configs/antd.json components list has no Dialog",
);

export const MUI_DIALOG_LEDGER = "extract/computed/out/mui/dialog/captured-truth.json";
/** Use md (or the first non-sm) if sm lacks title; configs enumerate maxWidth. */
const mCombo = "sm";
const mPaper = "cls:MuiDialog-paper";
const mContent = "cls:MuiDialogContent-root";

export const muiDialogMappings: FactMapping[] = [
  one("paper.paddingX", "px", { combo: mCombo, part: mContent, channel: "padding-left" }),
  receipt(
    "paper.paddingY",
    "the capture mounts DialogContent alone (paddingY 20); the recipe's 16 is DialogTitle's vertical padding — a reviewed title+content pairing, not the content-only plane",
    "DialogTitle.js padding 16px 24px — reviewed 16",
  ),
  one("paper.radius", "px", { combo: mCombo, part: mPaper, channel: "border-top-left-radius" }),
  receipt(
    "paper.itemSpacing",
    "Dialog paper has no gap channel — 0 is the recipe spelling",
    "reviewed 0",
  ),
  receipt(
    "paper.minWidth",
    "sm maxWidth collapses under the 320-wide capture stage (min-width auto); the recipe cites theme breakpoints sm minWidth 600 from Dialog.js",
    "Dialog.js paperWidthSm minWidth 600 — reviewed 600",
  ),
  one("paper.fill", "color", { combo: mCombo, part: mPaper, channel: "background-color" }),
  receipt(
    "titleFontSize",
    "no DialogTitle in the capture mount — recipe cites h6 1.25rem 20",
    "DialogTitle + typography h6 — reviewed 20",
  ),
  receipt(
    "titleLineHeight",
    "no DialogTitle in the capture mount — recipe cites h6 lineHeight 1.6 → 32",
    "reviewed 32",
  ),
  receipt(
    "bodyFontSize",
    "DialogContent text inherits — recipe cites body1 16",
    "createTypography body1 16 — reviewed 16",
  ),
  receipt(
    "bodyLineHeight",
    "DialogContent text inherits — recipe cites body1 lineHeight 1.5 → 24",
    "reviewed 24",
  ),
  receipt(
    "title",
    "no DialogTitle in the capture mount — recipe cites palette.text.primary",
    "palette.text.primary #000000de — reviewed",
  ),
  receipt(
    "body",
    "no DialogContent text color channel distinct from paper — recipe cites palette.text.primary",
    "palette.text.primary #000000de — reviewed",
  ),
  receipt("typography.title.family", "no DialogTitle mounted — Roboto from createTypography", "reviewed Roboto"),
  receipt("typography.title.style", "h6 fontWeight Medium 500 — reviewed Medium", "reviewed Medium"),
  receipt("typography.body.family", "body1 Roboto — reviewed Roboto", "reviewed Roboto"),
  receipt("typography.body.style", "body1 Regular — reviewed Regular", "reviewed Regular"),
];
