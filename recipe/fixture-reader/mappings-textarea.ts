/**
 * FIXTURE READER — Textarea mapping tables (docs/35 Phase 1).
 *
 * Ledgers (Phase-1 captures, this round):
 *   MUI    extract/computed/out/mui/textarea/captured-truth.json
 *          (TextField multiline pinned true — label + OutlinedInput +
 *          TextareaAutosize; content axis empty|value; disabled stateProp)
 *   AntD   extract/computed/out/antd/textarea/captured-truth.json
 *          (Input.TextArea — ONE bare <textarea class='ant-input'> root;
 *          the recipe's label row is a reviewed pairing, so label facts are
 *          receipts)
 *   Astryx extract/computed/out/astryx-core/textarea/captured-truth.json
 *          (TextArea under the documented Theme neutralTheme mount — Field +
 *          FieldLabel + wrapper + inner textarea)
 *
 * Same receipt discipline as mappings-checkbox.ts: receipts ONLY for facts
 * the ledger cannot express; deliberate recipe respellings are MAPPED and
 * their drift carried by name in reviewed-drift.json.
 */
import { hex8, px, num, matrix } from "./ledger.js";
import type { FactMapping } from "./reader.js";

const styleForWeight = (w: number): string =>
  ({ 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold" })[w] ?? `W${w}`;

type Read = { combo: string; interaction?: string; part: string; pseudo?: string; channel: string };
const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: Read,
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

const receipt = (path: string, why: string, evidence: string): FactMapping => ({
  path,
  receipt: why,
  evidence,
});

const firstFam = (raw: Record<string, string>): string =>
  raw.v.split(",")[0].trim().replace(/^["']|["']$/g, "");

/** rgba color whose alpha is further scaled by an opacity channel → #rrggbbaa. */
const inkTimesOpacity = (raw: Record<string, string>): string => {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(raw.c);
  if (!m) throw new Error(`not rgb()/rgba(): ${raw.c}`);
  const a = (m[4] === undefined ? 1 : Number(m[4])) * Number(raw.o);
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${h(Number(m[1]))}${h(Number(m[2]))}${h(Number(m[3]))}${h(Math.round(a * 255))}`;
};

// ---------------------------------------------------------------------------
// MUI — TextField multiline
// ---------------------------------------------------------------------------

export const MUI_TEXTAREA_LEDGER = "extract/computed/out/mui/textarea/captured-truth.json";

const mBase = "empty.enabled";
const mInput = "cls:MuiInputBase-root";
const mTextarea = "cls:MuiInputBase-input";
const mOutline = "cls:MuiOutlinedInput-notchedOutline";
const mLabel = "cls:MuiInputLabel-root";
const mStates: Array<[string, string]> = [
  ["empty.enabled", "empty.enabled"],
  ["empty.disabled", "empty.disabled"],
  ["value.enabled", "value.enabled"],
  ["value.disabled", "value.disabled"],
];

export const muiTextareaMappings: FactMapping[] = [
  one("box.height", "px", { combo: mBase, part: mInput, channel: "height" }),
  one("box.paddingX", "px", { combo: mBase, part: mInput, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: mBase, part: mInput, channel: "padding-top" }),
  one("box.radius", "px", { combo: mBase, part: mInput, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: mBase, part: mOutline, channel: "border-top-width" }),
  {
    path: "box.rows",
    kind: "number",
    reads: {
      h: { combo: mBase, part: mTextarea, channel: "height" },
      lh: { combo: mBase, part: mTextarea, channel: "line-height" },
    },
    formula: "rendered rows = textarea height / line-height (TextareaAutosize minRows default 1 — NOT invented as 3)",
    combine: (raw) => px(raw.h) / px(raw.lh),
  },
  one("box.lineHeight", "px", { combo: mBase, part: mTextarea, channel: "line-height" }),
  receipt(
    "labelGap",
    "the floating label overlays the outline — there is no stacked label→box gap channel; 0 is the recipe's spelling of the floating plane",
    "InputLabel absolute over OutlinedInput — reviewed 0",
  ),
  one("labelFontSize", "px", { combo: mBase, part: mLabel, channel: "font-size" }),
  one("valueFontSize", "px", { combo: mBase, part: mTextarea, channel: "font-size" }),
  one("labelInsetX", "px", { combo: mBase, part: mLabel, channel: "transform" }, {
    formula: "rest label transform matrix tx",
    combine: (raw) => matrix(raw.v).tx,
  }),
  one("labelInactiveOffsetY", "px", { combo: mBase, part: mLabel, channel: "transform" }, {
    formula: "rest label transform matrix ty",
    combine: (raw) => matrix(raw.v).ty,
  }),
  one("labelFloatingOffsetY", "px", { combo: "value.enabled", part: mLabel, channel: "transform" }, {
    formula: "shrunk label transform matrix ty (Content=value floats the label — the v3 named shrink column)",
    combine: (raw) => matrix(raw.v).ty,
  }),
  {
    path: "floatingLabelFontSize",
    kind: "px",
    reads: {
      fs: { combo: "value.enabled", part: mLabel, channel: "font-size" },
      t: { combo: "value.enabled", part: mLabel, channel: "transform" },
    },
    formula: "shrunk label rendered size = font-size × matrix scale a (16 × 0.75)",
    combine: (raw) => px(raw.fs) * matrix(raw.t).a,
  },
  receipt(
    "notchFill",
    "the notch knockout is the paper surface showing through the fieldset legend gap — no computed channel carries it (legend background is transparent)",
    "--palette-background-paper #ffffff — the fixture's citation; fixture refusal mui-refusal-fieldset-legend names the legend lowering",
  ),
  ...mStates.flatMap(([fix, combo]): FactMapping[] => {
    const rows: FactMapping[] = [
      one(`states.${fix}.boxFill`, "color", { combo, part: mInput, channel: "background-color" }),
      one(`states.${fix}.boxBorder`, "color", { combo, part: mOutline, channel: "border-top-color" }),
      one(`states.${fix}.boxOpacity`, "number", { combo, part: mInput, channel: "opacity" }),
      one(`states.${fix}.label`, "color", { combo, part: mLabel, channel: "color" }),
    ];
    if (fix === "empty.enabled") {
      rows.push({
        path: `states.${fix}.value`,
        kind: "color",
        reads: {
          c: { combo, interaction: "focus-visible", part: mTextarea, pseudo: "::placeholder", channel: "color" },
          o: { combo, interaction: "focus-visible", part: mTextarea, pseudo: "::placeholder", channel: "opacity" },
        },
        formula:
          "placeholder ink = ::placeholder color alpha × ::placeholder opacity, read at FOCUS — at rest MUI hides the placeholder under the overlaying label (::placeholder opacity 0 at default: the v3 named rest-empty teaching)",
        combine: inkTimesOpacity,
      });
    } else if (fix === "empty.disabled") {
      rows.push(
        receipt(
          `states.${fix}.value`,
          "a disabled field cannot take focus and MUI's rest-empty rule hides the placeholder (::placeholder opacity 0 at default) — the disabled placeholder ink is unobservable in the ledger",
          "palette.text.disabled #00000061 — the fixture's citation",
        ),
      );
    } else {
      rows.push(
        one(`states.${fix}.value`, "color", { combo, part: mTextarea, channel: "-webkit-text-fill-color" }, {
          formula: "MUI paints disabled/value ink via -webkit-text-fill-color (falls back to color when equal)",
        }),
      );
    }
    return rows;
  }),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: mBase, part: mLabel, channel: "font-family" } },
    formula: "first family of the label's computed stack",
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: mBase, part: mLabel, channel: "font-weight" } },
    combine: (raw) => styleForWeight(num(raw.v)),
  },
  {
    path: "typography.value.family",
    kind: "string",
    reads: { v: { combo: mBase, part: mTextarea, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.value.style",
    kind: "string",
    reads: { v: { combo: mBase, part: mTextarea, channel: "font-weight" } },
    combine: (raw) => styleForWeight(num(raw.v)),
  },
];

// ---------------------------------------------------------------------------
// AntD — Input.TextArea (bare <textarea class='ant-input'> root)
// ---------------------------------------------------------------------------

export const ANTD_TEXTAREA_LEDGER = "extract/computed/out/antd/textarea/captured-truth.json";

const NO_LABEL_ANTD =
  "Input.TextArea renders ONE bare <textarea> — the recipe's label row is a reviewed pairing (like the Checkbox label precedent), never a captured part";

const aBase = "empty.enabled";
const aStates = mStates;

export const antdTextareaMappings: FactMapping[] = [
  one("box.height", "px", { combo: aBase, part: "root", channel: "height" }),
  one("box.paddingX", "px", { combo: aBase, part: "root", channel: "padding-left" }),
  one("box.paddingY", "px", { combo: aBase, part: "root", channel: "padding-top" }),
  one("box.radius", "px", { combo: aBase, part: "root", channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: aBase, part: "root", channel: "border-top-width" }),
  {
    path: "box.rows",
    kind: "number",
    reads: {
      h: { combo: aBase, part: "root", channel: "height" },
      py: { combo: aBase, part: "root", channel: "padding-top" },
      bw: { combo: aBase, part: "root", channel: "border-top-width" },
      lh: { combo: aBase, part: "root", channel: "line-height" },
    },
    formula: "rendered rows = (height − 2·paddingY − 2·borderWidth) / line-height (HTML rows default 2 — the WHATWG default the antd wrapper leaves in place)",
    combine: (raw) => (px(raw.h) - 2 * px(raw.py) - 2 * px(raw.bw)) / px(raw.lh),
  },
  one("box.lineHeight", "px", { combo: aBase, part: "root", channel: "line-height" }),
  receipt("labelGap", NO_LABEL_ANTD, "--padding-xs 8px — the fixture's citation"),
  receipt("labelFontSize", NO_LABEL_ANTD, "--font-size 14px — the fixture's citation"),
  one("valueFontSize", "px", { combo: aBase, part: "root", channel: "font-size" }),
  receipt("labelInsetX", NO_LABEL_ANTD + "; the stacked label has no floating plane", "reviewed 0"),
  receipt("labelInactiveOffsetY", NO_LABEL_ANTD + "; the stacked label has no floating plane", "reviewed 0"),
  receipt("labelFloatingOffsetY", NO_LABEL_ANTD + "; the stacked label has no floating plane", "reviewed 0"),
  receipt("floatingLabelFontSize", NO_LABEL_ANTD + "; no shrink plane — the stacked size is the label size", "reviewed 14"),
  receipt("notchFill", "plain outline — antd has no notched-outline anatomy; transparent is the recipe's spelling of no knockout", "reviewed #00000000"),
  ...aStates.flatMap(([fix, combo]): FactMapping[] => {
    const rows: FactMapping[] = [
      one(`states.${fix}.boxFill`, "color", { combo, part: "root", channel: "background-color" }),
      one(`states.${fix}.boxBorder`, "color", { combo, part: "root", channel: "border-top-color" }),
      one(`states.${fix}.boxOpacity`, "number", { combo, part: "root", channel: "opacity" }),
      receipt(`states.${fix}.label`, NO_LABEL_ANTD, "--color-text / --color-text-disabled — the fixture's citation"),
    ];
    if (fix.startsWith("empty")) {
      rows.push(
        one(`states.${fix}.value`, "color", { combo, part: "root", pseudo: "::placeholder", channel: "color" }, {
          formula: "placeholder ink (antd shows the placeholder at rest — no hide rule)",
        }),
      );
    } else {
      rows.push(one(`states.${fix}.value`, "color", { combo, part: "root", channel: "color" }));
    }
    return rows;
  }),
  receipt(
    "typography.label.family",
    NO_LABEL_ANTD +
      "; additionally the capture PINS token.fontFamily to the Roboto stack (FC-FONT-SUBSTRATE closure), so even the control's own family channel is the mount pin, not the library's declared '-apple-system, …' stack the fixture cites",
    "theme.getDesignToken().fontFamily starts -apple-system — the fixture's requestedFamily",
  ),
  receipt("typography.label.style", NO_LABEL_ANTD, "reviewed Regular"),
  receipt(
    "typography.value.family",
    "the capture PINS token.fontFamily to the Roboto stack (FC-FONT-SUBSTRATE closure, extract/computed/configs/antd.json fonts.__note) — the ledger's font-family is the mount pin, not the library declaration",
    "theme.getDesignToken().fontFamily starts -apple-system — the fixture's requestedFamily",
  ),
  {
    path: "typography.value.style",
    kind: "string",
    reads: { v: { combo: aBase, part: "root", channel: "font-weight" } },
    combine: (raw) => styleForWeight(num(raw.v)),
  },
];

// ---------------------------------------------------------------------------
// Astryx — TextArea (Theme neutralTheme mount)
// ---------------------------------------------------------------------------

export const ASTRYX_TEXTAREA_LEDGER = "extract/computed/out/astryx-core/textarea/captured-truth.json";

const xBase = "empty.no-isDisabled";
const xWrap = "cls:astryx-textarea";
const xLabel = "cls:astryx-field-label";
const xInner = "idx:1.0.0"; // the real <textarea> inside the wrapper
const xStates: Array<[string, string]> = [
  ["empty.enabled", "empty.no-isDisabled"],
  ["empty.disabled", "empty.isDisabled"],
  ["value.enabled", "value.no-isDisabled"],
  ["value.disabled", "value.isDisabled"],
];

export const astryxTextareaMappings: FactMapping[] = [
  one("box.height", "px", { combo: xBase, part: xWrap, channel: "height" }),
  one("box.paddingX", "px", { combo: xBase, part: xWrap, channel: "padding-left" }),
  one("box.paddingY", "px", { combo: xBase, part: xWrap, channel: "padding-top" }),
  one("box.radius", "px", { combo: xBase, part: xWrap, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: xBase, part: xWrap, channel: "border-top-width" }),
  {
    path: "box.rows",
    kind: "number",
    reads: {
      h: { combo: xBase, part: xInner, channel: "height" },
      lh: { combo: xBase, part: xInner, channel: "line-height" },
    },
    formula: "rendered rows = inner textarea height / line-height (TextArea.tsx rows default 3)",
    combine: (raw) => px(raw.h) / px(raw.lh),
  },
  one("box.lineHeight", "px", { combo: xBase, part: xInner, channel: "line-height" }),
  one("labelGap", "px", { combo: xBase, part: "root", channel: "row-gap" }, {
    formula: "Field container row-gap between label and control",
  }),
  one("labelFontSize", "px", { combo: xBase, part: xLabel, channel: "font-size" }),
  one("valueFontSize", "px", { combo: xBase, part: xInner, channel: "font-size" }),
  receipt("labelInsetX", "stacked label — no floating plane exists; 0 is the recipe's spelling", "reviewed 0"),
  receipt("labelInactiveOffsetY", "stacked label — no floating plane exists; 0 is the recipe's spelling", "reviewed 0"),
  receipt("labelFloatingOffsetY", "stacked label — no floating plane exists; 0 is the recipe's spelling", "reviewed 0"),
  receipt("floatingLabelFontSize", "stacked label — no shrink plane; the stacked size is the label size", "reviewed 14"),
  receipt("notchFill", "plain outline — no notched-outline anatomy; transparent is the recipe's spelling of no knockout", "reviewed #00000000"),
  ...xStates.flatMap(([fix, combo]): FactMapping[] => {
    const rows: FactMapping[] = [
      one(`states.${fix}.boxFill`, "color", { combo, part: xWrap, channel: "background-color" }),
      one(`states.${fix}.boxBorder`, "color", { combo, part: xWrap, channel: "border-top-color" }),
      one(`states.${fix}.boxOpacity`, "number", { combo, part: xWrap, channel: "opacity" }),
      one(`states.${fix}.label`, "color", { combo, part: xLabel, channel: "color" }),
    ];
    if (fix.startsWith("empty")) {
      rows.push(
        one(`states.${fix}.value`, "color", { combo, part: xInner, pseudo: "::placeholder", channel: "color" }, {
          formula: "placeholder ink (Astryx shows the placeholder at rest)",
        }),
      );
    } else {
      rows.push(one(`states.${fix}.value`, "color", { combo, part: xInner, channel: "color" }));
    }
    return rows;
  }),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: xBase, part: xLabel, channel: "font-family" } },
    formula: "first family of the label's computed stack under the library's documented Theme mount",
    combine: firstFam,
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: xBase, part: xLabel, channel: "font-weight" } },
    combine: (raw) => styleForWeight(num(raw.v)),
  },
  {
    path: "typography.value.family",
    kind: "string",
    reads: { v: { combo: xBase, part: xInner, channel: "font-family" } },
    combine: firstFam,
  },
  {
    path: "typography.value.style",
    kind: "string",
    reads: { v: { combo: xBase, part: xInner, channel: "font-weight" } },
    combine: (raw) => styleForWeight(num(raw.v)),
  },
];

export const textareaColorNormalize = hex8;
