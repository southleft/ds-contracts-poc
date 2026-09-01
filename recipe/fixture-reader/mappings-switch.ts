/**
 * FIXTURE READER — Switch mapping tables (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/switch/captured-truth.json
 *        bare Switch; color×size×checked. Recipe compiles primary/medium.
 *        NO FormControlLabel — label facts are receipts.
 * AntD   extract/computed/out/antd/switch/captured-truth.json
 *        button.ant-switch + handle + inner. No label mounted.
 * Astryx extract/computed/out/astryx-core/switch/captured-truth.json
 *        labelPosition × isDisabled ONLY — value/checked is NOT an axis
 *        (configs/astryx.json Switch __note:valueAxis). ON-plane facts are receipts.
 */
import { matrix, px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, inkTimesOpacity, one, receipt, styleForWeight } from "./mappings-util.js";

export const ASTRYX_SWITCH_LEDGER = "extract/computed/out/astryx-core/switch/captured-truth.json";

const aTrack = "cls:astryx-switch";
const aThumb = "cls:astryx-switch-thumb";
const aLabel = "cls:astryx-field-label";
const aOff = "start.no-isDisabled";
const aOffDis = "start.isDisabled";
const NO_ON =
  "the committed Astryx Switch capture enumerates labelPosition × isDisabled only — value/checked is NOT an axis (configs/astryx.json Switch __note:valueAxis); the ON plane never rendered";

export const astryxSwitchMappings: FactMapping[] = [
  one("wrapper.width", "px", { combo: aOff, part: aTrack, channel: "width" }),
  one("wrapper.height", "px", { combo: aOff, part: aTrack, channel: "height" }),
  receipt("wrapper.padding", "the 40×24 wrapper has no extra padding outside the track — 0 is the recipe's spelling", "Switch.tsx switchWrapper 40×24 — reviewed 0"),
  one("track.width", "px", { combo: aOff, part: aTrack, channel: "width" }),
  one("track.height", "px", { combo: aOff, part: aTrack, channel: "height" }),
  one("track.radius", "px", { combo: aOff, part: aTrack, channel: "border-top-left-radius" }),
  one("track.padding", "px", { combo: aOff, part: aTrack, channel: "padding-left" }),
  one("thumb.offSize", "px", { combo: aOff, part: aThumb, channel: "width" }),
  receipt("thumb.onSize", NO_ON, "Switch.tsx THUMB_SIZE_ON 20 — reviewed 20"),
  receipt("thumb.travel", NO_ON, "Switch.tsx THUMB_TRAVEL_ON 14 — reviewed 14"),
  one("row.gap", "px", { combo: aOff, part: "idx:0", channel: "column-gap" }),
  one("states.false.enabled.trackFill", "color", { combo: aOff, part: aTrack, channel: "background-color" }),
  one("states.false.enabled.thumbFill", "color", { combo: aOff, part: aThumb, channel: "background-color" }),
  one("states.false.enabled.trackOpacity", "number", { combo: aOff, part: aTrack, channel: "opacity" }),
  one("states.false.enabled.label", "color", { combo: aOff, part: aLabel, channel: "color" }),
  one("states.false.disabled.trackFill", "color", { combo: aOffDis, part: aTrack, channel: "background-color" }),
  one("states.false.disabled.thumbFill", "color", { combo: aOffDis, part: aThumb, channel: "background-color" }),
  one("states.false.disabled.trackOpacity", "number", { combo: aOffDis, part: aTrack, channel: "opacity" }),
  one("states.false.disabled.label", "color", { combo: aOffDis, part: aLabel, channel: "color" }),
  receipt("states.true.enabled.trackFill", NO_ON, "astryx.css --color-accent #0064E0 — reviewed; do not adopt capture-theme #262626"),
  receipt("states.true.enabled.thumbFill", NO_ON, "thumb --color-background-surface — reviewed #ffffffff"),
  receipt("states.true.enabled.trackOpacity", NO_ON, "reviewed 1"),
  receipt("states.true.enabled.label", NO_ON, "FieldLabel --color-text-secondary — reviewed"),
  receipt("states.true.disabled.trackFill", NO_ON, "accent under disabled opacity — reviewed"),
  receipt("states.true.disabled.thumbFill", NO_ON, "reviewed #ffffffff"),
  receipt("states.true.disabled.trackOpacity", NO_ON, "disabled track opacity 0.5 — reviewed"),
  receipt("states.true.disabled.label", NO_ON, "FieldLabel disabled — reviewed"),
  one("labelFontSize", "px", { combo: aOff, part: aLabel, channel: "font-size" }),
  receipt("rowAlign", "flex align-items:center on the row — recipe spelling", "reviewed center"),
  receipt("hitClips", "recipe anatomy spelling (hit target does not clip)", "reviewed false"),
  receipt("trackClips", "recipe anatomy spelling (track does not clip the thumb)", "reviewed false"),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: aOff, part: aLabel, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: aOff, part: aLabel, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];

export const MUI_SWITCH_LEDGER = "extract/computed/out/mui/switch/captured-truth.json";

const mRoot = "cls:MuiSwitch-root";
const mThumb = "cls:MuiSwitch-thumb";
const mTrack = "cls:MuiSwitch-track";
const mOff = "primary.medium.unchecked.enabled";
const mOn = "primary.medium.checked.enabled";
const mOffDis = "primary.medium.unchecked.disabled";
const mOnDis = "primary.medium.checked.disabled";
const NO_LBL =
  "the capture mounts the bare Switch (sampleText '' — FormControlLabel is a reviewed pairing); no label part exists in the ledger";

export const muiSwitchMappings: FactMapping[] = [
  one("wrapper.width", "px", { combo: mOff, part: mRoot, channel: "width" }),
  one("wrapper.height", "px", { combo: mOff, part: mRoot, channel: "height" }),
  one("wrapper.padding", "px", { combo: mOff, part: mRoot, channel: "padding-left" }),
  one("track.width", "px", { combo: mOff, part: mTrack, channel: "width" }),
  one("track.height", "px", { combo: mOff, part: mTrack, channel: "height" }),
  one("track.radius", "px", { combo: mOff, part: mTrack, channel: "border-top-left-radius" }),
  receipt("track.padding", "MUI track has no inset padding — 0 is the recipe's spelling", "Switch.js track 34×14 — reviewed 0"),
  one("thumb.offSize", "px", { combo: mOff, part: mThumb, channel: "width" }),
  one("thumb.onSize", "px", { combo: mOn, part: mThumb, channel: "width" }),
  {
    path: "thumb.travel",
    kind: "px",
    reads: { v: { combo: mOn, part: "cls:MuiSwitch-switchBase", channel: "transform" } },
    formula: "checked SwitchBase translateX is the travel",
    combine: (raw) => matrix(raw.v).tx,
  },
  receipt("row.gap", NO_LBL, "FormControlLabel gap 0 — reviewed 0"),
  {
    path: "states.false.enabled.trackFill",
    kind: "color",
    reads: {
      c: { combo: mOff, part: mTrack, channel: "background-color" },
      o: { combo: mOff, part: mTrack, channel: "opacity" },
    },
    formula: "track CSS opacity is baked into the fill so the nested thumb stays opaque",
    combine: inkTimesOpacity,
  },
  one("states.false.enabled.thumbFill", "color", { combo: mOff, part: mThumb, channel: "background-color" }),
  receipt(
    "states.false.enabled.trackOpacity",
    "recipe bakes the track's CSS opacity into trackFill; the spelled opacity is 1 so the thumb stays opaque",
    "Switch.js track opacity 0.38 baked into #00000061 — reviewed 1",
  ),
  receipt("states.false.enabled.label", NO_LBL, "palette.text.primary #000000de — reviewed"),
  {
    path: "states.false.disabled.trackFill",
    kind: "color",
    reads: {
      c: { combo: mOffDis, part: mTrack, channel: "background-color" },
      o: { combo: mOffDis, part: mTrack, channel: "opacity" },
    },
    formula: "disabled track opacity baked into the fill",
    combine: inkTimesOpacity,
  },
  one("states.false.disabled.thumbFill", "color", { combo: mOffDis, part: mThumb, channel: "background-color" }),
  receipt("states.false.disabled.trackOpacity", "baked into trackFill — spelled 1", "reviewed 1"),
  receipt("states.false.disabled.label", NO_LBL, "palette.text.disabled #00000061 — reviewed"),
  {
    path: "states.true.enabled.trackFill",
    kind: "color",
    reads: {
      c: { combo: mOn, part: mTrack, channel: "background-color" },
      o: { combo: mOn, part: mTrack, channel: "opacity" },
    },
    formula: "checked track opacity 0.5 baked into #1976d280",
    combine: inkTimesOpacity,
  },
  one("states.true.enabled.thumbFill", "color", { combo: mOn, part: mThumb, channel: "background-color" }),
  receipt("states.true.enabled.trackOpacity", "baked into trackFill — spelled 1", "reviewed 1"),
  receipt("states.true.enabled.label", NO_LBL, "palette.text.primary #000000de — reviewed"),
  {
    path: "states.true.disabled.trackFill",
    kind: "color",
    reads: {
      c: { combo: mOnDis, part: mTrack, channel: "background-color" },
      o: { combo: mOnDis, part: mTrack, channel: "opacity" },
    },
    formula: "disabled checked track opacity baked into the fill",
    combine: inkTimesOpacity,
  },
  one("states.true.disabled.thumbFill", "color", { combo: mOnDis, part: mThumb, channel: "background-color" }),
  receipt("states.true.disabled.trackOpacity", "baked into trackFill — spelled 1", "reviewed 1"),
  receipt("states.true.disabled.label", NO_LBL, "palette.text.disabled #00000061 — reviewed"),
  receipt("labelFontSize", NO_LBL, "createTypography.js body1 16 — reviewed 16"),
  receipt("rowAlign", "recipe spelling of the reviewed FormControlLabel pairing", "reviewed center"),
  receipt("hitClips", "Switch-root overflow hidden on the 38px hit — recipe spelling", "reviewed true"),
  receipt("trackClips", "track does not clip the thumb", "reviewed false"),
  receipt("typography.label.family", NO_LBL, "createTypography.js fontFamily Roboto — reviewed Roboto"),
  receipt("typography.label.style", NO_LBL, "createTypography.js fontWeightRegular 400 — reviewed Regular"),
];

export const ANTD_SWITCH_LEDGER = "extract/computed/out/antd/switch/captured-truth.json";

const sRoot = "cls:ant-switch";
const sHandle = "cls:ant-switch-handle";
const sOff = "default.unchecked.enabled";
const sOn = "default.checked.enabled";
const sOffDis = "default.unchecked.disabled";
const sOnDis = "default.checked.disabled";
const NO_ANTD_LBL = "antd Switch mounts no label — the recipe's label row is a reviewed pairing, never a captured part";

export const antdSwitchMappings: FactMapping[] = [
  one("wrapper.width", "px", { combo: sOff, part: sRoot, channel: "width" }),
  one("wrapper.height", "px", { combo: sOff, part: sRoot, channel: "height" }),
  receipt("wrapper.padding", "the 44×22 root has no extra padding — 0 is the recipe's spelling", "prepareComponentToken padding 2 is INSIDE the track — reviewed 0 on the wrapper"),
  one("track.width", "px", { combo: sOff, part: sRoot, channel: "width" }),
  one("track.height", "px", { combo: sOff, part: sRoot, channel: "height" }),
  one("track.radius", "px", { combo: sOff, part: sRoot, channel: "border-top-left-radius" }),
  receipt("track.padding", "handle inset is 2px (padding token) — not a CSS padding on the root", "prepareComponentToken padding 2 — reviewed 2"),
  one("thumb.offSize", "px", { combo: sOff, part: sHandle, channel: "width" }),
  one("thumb.onSize", "px", { combo: sOn, part: sHandle, channel: "width" }),
  receipt(
    "thumb.travel",
    "travel = trackMinWidth − handleSize − 2×padding = 44 − 18 − 4 = 22; the handle inset is not a single computed channel",
    "v2 stay accuracyLoop travel 22 = 44-18-2*2 — reviewed 22",
  ),
  receipt("row.gap", NO_ANTD_LBL, "--margin-xs 8 — the fixture's citation"),
  one("states.false.enabled.trackFill", "color", { combo: sOff, part: sRoot, channel: "background-color" }),
  one("states.false.enabled.thumbFill", "color", {
    combo: sOff,
    part: sHandle,
    pseudo: "::before",
    channel: "background-color",
  }),
  one("states.false.enabled.trackOpacity", "number", { combo: sOff, part: sRoot, channel: "opacity" }),
  receipt("states.false.enabled.label", NO_ANTD_LBL, "--color-text — the fixture's citation"),
  one("states.false.disabled.trackFill", "color", { combo: sOffDis, part: sRoot, channel: "background-color" }),
  one("states.false.disabled.thumbFill", "color", {
    combo: sOffDis,
    part: sHandle,
    pseudo: "::before",
    channel: "background-color",
  }),
  one("states.false.disabled.trackOpacity", "number", { combo: sOffDis, part: sRoot, channel: "opacity" }),
  receipt("states.false.disabled.label", NO_ANTD_LBL, "--color-text-disabled — the fixture's citation"),
  one("states.true.enabled.trackFill", "color", { combo: sOn, part: sRoot, channel: "background-color" }),
  one("states.true.enabled.thumbFill", "color", {
    combo: sOn,
    part: sHandle,
    pseudo: "::before",
    channel: "background-color",
  }),
  one("states.true.enabled.trackOpacity", "number", { combo: sOn, part: sRoot, channel: "opacity" }),
  receipt("states.true.enabled.label", NO_ANTD_LBL, "--color-text — the fixture's citation"),
  one("states.true.disabled.trackFill", "color", { combo: sOnDis, part: sRoot, channel: "background-color" }),
  one("states.true.disabled.thumbFill", "color", {
    combo: sOnDis,
    part: sHandle,
    pseudo: "::before",
    channel: "background-color",
  }),
  one("states.true.disabled.trackOpacity", "number", { combo: sOnDis, part: sRoot, channel: "opacity" }),
  receipt("states.true.disabled.label", NO_ANTD_LBL, "--color-text-disabled — the fixture's citation"),
  one("labelFontSize", "px", { combo: sOff, part: sRoot, channel: "font-size" }),
  receipt("rowAlign", "recipe spelling of the reviewed label pairing", "reviewed center"),
  receipt("hitClips", "antd switch does not clip the handle", "reviewed false"),
  receipt("trackClips", "antd switch does not clip the handle", "reviewed false"),
  receipt("typography.label.family", FONT_PIN + "; additionally no label part is mounted", "theme.getDesignToken().fontFamily starts -apple-system"),
  receipt("typography.label.style", NO_ANTD_LBL, "reviewed Regular"),
];
