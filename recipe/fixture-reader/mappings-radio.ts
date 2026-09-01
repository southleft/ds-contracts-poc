/**
 * FIXTURE READER — Radio mapping tables (docs/35 Phase 2).
 *
 * MUI    extract/computed/out/mui/radio/captured-truth.json
 *        bare <Radio/>; SwitchBase + SvgIcon; NO RadioGroup, NO label.
 * AntD   extract/computed/out/antd/radio/captured-truth.json
 *        label.ant-radio-wrapper + inner + ::after scaled dot + label span.
 *        Bare Radio — no Radio.Group, so list.gap is a receipt.
 * Astryx no RadioList capture-floor subject (no seed, no config). Named receipt.
 */
import { px } from "./ledger.js";
import type { FactMapping } from "./reader.js";
import { FONT_PIN, firstFam, one, receipt, receiptAll, styleForWeight } from "./mappings-util.js";

const ASTRYX_WHY =
  "the capture floor has no RadioList subject — Astryx ships RadioList + RadioListItem (no standalone Radio) and extract/computed/configs/astryx.json does not mount it; a single-radio capture would invent a shape the recipe does not compile";

export const ASTRYX_RADIO_LEDGER = null;
export const astryxRadioMappings: FactMapping[] = receiptAll(
  [
    "list.gap",
    "item.gap",
    "labelLineHeight",
    "wrapper.size",
    "circle.size",
    "circle.radius",
    "circle.borderWidth",
    "circle.padding",
    "dot.size",
    "dot.radius",
    "states.selected.enabled.circleFill",
    "states.selected.enabled.circleBorder",
    "states.selected.enabled.circleOpacity",
    "states.selected.enabled.label",
    "states.selected.enabled.dotFill",
    "states.selected.disabled.circleFill",
    "states.selected.disabled.circleBorder",
    "states.selected.disabled.circleOpacity",
    "states.selected.disabled.label",
    "states.selected.disabled.dotFill",
    "states.unselected.enabled.circleFill",
    "states.unselected.enabled.circleBorder",
    "states.unselected.enabled.circleOpacity",
    "states.unselected.enabled.label",
    "states.unselected.enabled.dotFill",
    "states.unselected.disabled.circleFill",
    "states.unselected.disabled.circleBorder",
    "states.unselected.disabled.circleOpacity",
    "states.unselected.disabled.label",
    "states.unselected.disabled.dotFill",
    "labelFontSize",
    "listMode",
    "itemAlign",
    "labelLineHeightUnit",
    "typography.label.family",
    "typography.label.style",
  ],
  ASTRYX_WHY,
  "docs/34 §3 Astryx has no standalone Radio; configs/astryx.json components list has no RadioList",
);

export const MUI_RADIO_LEDGER = "extract/computed/out/mui/radio/captured-truth.json";

const mIcon = "cls:MuiSvgIcon-root";
const NO_GROUP =
  "the capture mounts the bare Radio (no RadioGroup, sampleText '' — FormControlLabel is a reviewed pairing); no list or label part exists in the ledger";

export const muiRadioMappings: FactMapping[] = [
  receipt("list.gap", NO_GROUP, "RadioGroup is a reviewed pairing — reviewed 0"),
  receipt("item.gap", NO_GROUP, "FormControlLabel gap is a reviewed pairing — reviewed 0"),
  receipt("labelLineHeight", NO_GROUP, "no label part — reviewed 0 (auto unit)"),
  one("wrapper.size", "px", { combo: "primary.unchecked.enabled", part: "root", channel: "width" }),
  one("circle.size", "px", { combo: "primary.unchecked.enabled", part: mIcon, channel: "width" }),
  receipt(
    "circle.radius",
    "the radio ring is SVG path geometry inside RadioButtonUnchecked, not a CSS border-radius (SvgIcon computed radius is 0)",
    "RadioButtonUnchecked 24-viewBox — reviewed 12",
  ),
  receipt(
    "circle.borderWidth",
    "the ring stroke is SVG path geometry, not a CSS border",
    "RadioButtonUnchecked path ring — reviewed 2",
  ),
  receipt(
    "circle.padding",
    "hit-target padding lives on SwitchBase, not a captured circle-padding channel",
    "Radio.js padding 9 — reviewed 9",
  ),
  receipt(
    "dot.size",
    "the inner dot is RadioButtonChecked's even-odd hole / inner circle, not a computed box",
    "RadioButtonChecked inner circle — reviewed 10",
  ),
  receipt(
    "dot.radius",
    "same SVG inner-circle geometry — not a CSS radius channel",
    "reviewed 5",
  ),
  one("states.selected.enabled.circleFill", "color", {
    combo: "primary.checked.enabled",
    part: mIcon,
    channel: "background-color",
  }),
  one("states.selected.enabled.circleBorder", "color", {
    combo: "primary.checked.enabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.selected.enabled.circleOpacity", "number", {
    combo: "primary.checked.enabled",
    part: mIcon,
    channel: "opacity",
  }),
  receipt("states.selected.enabled.label", NO_GROUP, "palette.text.primary #000000de — reviewed"),
  one("states.selected.enabled.dotFill", "color", {
    combo: "primary.checked.enabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.selected.disabled.circleFill", "color", {
    combo: "primary.checked.disabled",
    part: mIcon,
    channel: "background-color",
  }),
  one("states.selected.disabled.circleBorder", "color", {
    combo: "primary.checked.disabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.selected.disabled.circleOpacity", "number", {
    combo: "primary.checked.disabled",
    part: mIcon,
    channel: "opacity",
  }),
  receipt("states.selected.disabled.label", NO_GROUP, "palette.text.disabled #00000061 — reviewed"),
  one("states.selected.disabled.dotFill", "color", {
    combo: "primary.checked.disabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.unselected.enabled.circleFill", "color", {
    combo: "primary.unchecked.enabled",
    part: mIcon,
    channel: "background-color",
  }),
  one("states.unselected.enabled.circleBorder", "color", {
    combo: "primary.unchecked.enabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.unselected.enabled.circleOpacity", "number", {
    combo: "primary.unchecked.enabled",
    part: mIcon,
    channel: "opacity",
  }),
  receipt("states.unselected.enabled.label", NO_GROUP, "palette.text.primary #000000de — reviewed"),
  receipt(
    "states.unselected.enabled.dotFill",
    "the inner dot does not render in the unchecked state; transparent is the recipe's spelling of absent",
    "no RadioButtonChecked at combo primary.unchecked.enabled — reviewed #00000000",
  ),
  one("states.unselected.disabled.circleFill", "color", {
    combo: "primary.unchecked.disabled",
    part: mIcon,
    channel: "background-color",
  }),
  one("states.unselected.disabled.circleBorder", "color", {
    combo: "primary.unchecked.disabled",
    part: mIcon,
    channel: "color",
  }),
  one("states.unselected.disabled.circleOpacity", "number", {
    combo: "primary.unchecked.disabled",
    part: mIcon,
    channel: "opacity",
  }),
  receipt("states.unselected.disabled.label", NO_GROUP, "palette.text.disabled #00000061 — reviewed"),
  receipt(
    "states.unselected.disabled.dotFill",
    "the inner dot does not render in the unchecked state; transparent is the recipe's spelling of absent",
    "no RadioButtonChecked at combo primary.unchecked.disabled — reviewed #00000000",
  ),
  receipt("labelFontSize", NO_GROUP, "createTypography.js body1 16 — reviewed 16"),
  receipt("listMode", "recipe spelling of RadioGroup direction; the capture mounts one Radio", "reviewed vertical"),
  receipt("itemAlign", "recipe spelling of the reviewed FormControlLabel pairing", "reviewed center"),
  receipt("labelLineHeightUnit", "no label part in the ledger", "reviewed auto"),
  receipt("typography.label.family", NO_GROUP, "createTypography.js fontFamily Roboto — reviewed Roboto"),
  receipt("typography.label.style", NO_GROUP, "createTypography.js fontWeightRegular 400 — reviewed Regular"),
];

export const ANTD_RADIO_LEDGER = "extract/computed/out/antd/radio/captured-truth.json";

const inner = "cls:ant-radio-inner";
const label = "cls:ant-radio-label";

export const antdRadioMappings: FactMapping[] = [
  receipt(
    "list.gap",
    "the capture mounts a bare Radio — Radio.Group (the recipe's two-item list) is a reviewed pairing, never a captured part",
    "Radio.Group gap --margin-xs 8 — the fixture's citation",
  ),
  one("item.gap", "px", { combo: "unchecked.enabled", part: label, channel: "padding-left" }),
  one("labelLineHeight", "px", { combo: "unchecked.enabled", part: label, channel: "line-height" }),
  one("wrapper.size", "px", { combo: "unchecked.enabled", part: inner, channel: "width" }),
  one("circle.size", "px", { combo: "unchecked.enabled", part: inner, channel: "width" }),
  {
    path: "circle.radius",
    kind: "px",
    reads: { v: { combo: "unchecked.enabled", part: inner, channel: "width" } },
    formula: "circle is a 50% pill — radius = size/2",
    combine: (raw) => px(raw.v) / 2,
  },
  one("circle.borderWidth", "px", { combo: "unchecked.enabled", part: inner, channel: "border-top-width" }),
  receipt(
    "circle.padding",
    "antd's radio inner has no inset padding channel — 0 is the recipe's spelling",
    "genRadioStyle inner padding 0 — reviewed 0",
  ),
  {
    path: "dot.size",
    kind: "px",
    reads: {
      w: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "width" },
      t: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "transform" },
    },
    formula: "inner::after is 16×16 scaled by matrix(s,0,0,s) — painted size = 16×s",
    combine: (raw) => {
      const w = px(raw.w);
      const m = /^matrix\(([-0-9.e]+),/.exec(raw.t);
      const s = m ? Number(m[1]) : 1;
      return Number((w * s).toFixed(3));
    },
  },
  {
    path: "dot.radius",
    kind: "px",
    reads: {
      w: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "width" },
      t: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "transform" },
    },
    formula: "scaled ::after is a circle — radius = painted size/2",
    combine: (raw) => {
      const w = px(raw.w);
      const m = /^matrix\(([-0-9.e]+),/.exec(raw.t);
      const s = m ? Number(m[1]) : 1;
      return Number(((w * s) / 2).toFixed(3));
    },
  },
  one("states.selected.enabled.circleFill", "color", { combo: "checked.enabled", part: inner, channel: "background-color" }),
  one("states.selected.enabled.circleBorder", "color", { combo: "checked.enabled", part: inner, channel: "border-top-color" }),
  one("states.selected.enabled.circleOpacity", "number", { combo: "checked.enabled", part: inner, channel: "opacity" }),
  one("states.selected.enabled.label", "color", { combo: "checked.enabled", part: label, channel: "color" }),
  one("states.selected.enabled.dotFill", "color", {
    combo: "checked.enabled",
    part: inner,
    pseudo: "::after",
    channel: "background-color",
  }),
  one("states.selected.disabled.circleFill", "color", { combo: "checked.disabled", part: inner, channel: "background-color" }),
  one("states.selected.disabled.circleBorder", "color", { combo: "checked.disabled", part: inner, channel: "border-top-color" }),
  one("states.selected.disabled.circleOpacity", "number", { combo: "checked.disabled", part: inner, channel: "opacity" }),
  one("states.selected.disabled.label", "color", { combo: "checked.disabled", part: label, channel: "color" }),
  one("states.selected.disabled.dotFill", "color", {
    combo: "checked.disabled",
    part: inner,
    pseudo: "::after",
    channel: "background-color",
  }),
  one("states.unselected.enabled.circleFill", "color", { combo: "unchecked.enabled", part: inner, channel: "background-color" }),
  one("states.unselected.enabled.circleBorder", "color", {
    combo: "unchecked.enabled",
    part: inner,
    channel: "border-top-color",
  }),
  one("states.unselected.enabled.circleOpacity", "number", { combo: "unchecked.enabled", part: inner, channel: "opacity" }),
  one("states.unselected.enabled.label", "color", { combo: "unchecked.enabled", part: label, channel: "color" }),
  receipt(
    "states.unselected.enabled.dotFill",
    "the ::after dot is scale(0) / opacity 0 in the unchecked state; transparent is the recipe's spelling of absent",
    "inner::after transform matrix(0,…) at combo unchecked.enabled — reviewed #00000000",
  ),
  one("states.unselected.disabled.circleFill", "color", { combo: "unchecked.disabled", part: inner, channel: "background-color" }),
  one("states.unselected.disabled.circleBorder", "color", {
    combo: "unchecked.disabled",
    part: inner,
    channel: "border-top-color",
  }),
  one("states.unselected.disabled.circleOpacity", "number", { combo: "unchecked.disabled", part: inner, channel: "opacity" }),
  one("states.unselected.disabled.label", "color", { combo: "unchecked.disabled", part: label, channel: "color" }),
  receipt(
    "states.unselected.disabled.dotFill",
    "the ::after dot is scale(0) / opacity 0 in the unchecked state; transparent is the recipe's spelling of absent",
    "inner::after hidden at combo unchecked.disabled — reviewed #00000000",
  ),
  one("labelFontSize", "px", { combo: "unchecked.enabled", part: label, channel: "font-size" }),
  receipt("listMode", "Radio.Group default is inline-block horizontal; the capture mounts one Radio", "reviewed horizontal"),
  receipt(
    "itemAlign",
    "the wrapper's align-items is baseline (antd's own) — the v2 stay respelled CENTER so the label optically centers on the 16px circle; that respelling is a recipe fact, not a ledger channel",
    "radio-live-pivot-v2 stay accuracyLoop — reviewed center",
  ),
  receipt("labelLineHeightUnit", "the label line-height is a px length (22)", "reviewed px"),
  receipt("typography.label.family", FONT_PIN, "theme.getDesignToken().fontFamily starts -apple-system — the fixture's requestedFamily"),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: "unchecked.enabled", part: label, channel: "font-weight" } },
    combine: (raw) => styleForWeight(Number(raw.v)),
  },
];
