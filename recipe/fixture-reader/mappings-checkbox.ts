/**
 * FIXTURE READER — Checkbox mapping tables (docs/35 Phase 1).
 *
 * For EVERY numeric/color/typography fact in
 * `recipe/fixtures/library-checkboxes.ts`, either the exact ledger read that
 * mechanically produces it from the Chromium capture of the real npm
 * package, or a NAMED receipt for why the ledger cannot express it.
 *
 * Ledgers:
 *   MUI    extract/computed/out/mui/checkbox/captured-truth.json
 *          (bare <Checkbox/>; SwitchBase root + SvgIcon; NO label mounted —
 *          FormControlLabel is a reviewed pairing, so every label fact is a
 *          receipt here)
 *   AntD   extract/computed/out/antd/checkbox/captured-truth.json
 *          (label.ant-checkbox-wrapper + inner + ::after glyph + label span)
 *   Astryx extract/computed/out/astryx-core/checkboxinput/captured-truth.json
 *          (Phase-1 recapture: checked×size×disabled under the library's
 *          documented <Theme theme={neutralTheme}> mount)
 *
 * RECEIPT DISCIPLINE: a receipt is ONLY for a fact the ledger cannot express
 * (no part, no channel, an SVG viewBox, a reviewed pairing the capture never
 * mounts, or a recipe-side spelling for a glyph that is absent/hidden in that
 * state). A fact the ledger CAN express but the recipe deliberately respells
 * (a lowering) is MAPPED and its drift is carried BY NAME in
 * recipe/fixture-reader/reviewed-drift.json — the drift report must show it.
 */
import { hex8, px, num, pathNumbers } from "./ledger.js";
import type { FactMapping } from "./reader.js";

const SUBPIXEL = {
  tolerance: 0.05,
  toleranceReason:
    "Chromium quantizes calc()-derived lengths to 1/64 CSS px (e.g. calc(16px/14*5) computes 5.70312, source-exact 5.71428); the fixture carries the source-exact rational",
};

/** Weight number → the Figma style word the fixture tables use. */
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

// ---------------------------------------------------------------------------
// MUI — @mui/material@9.2.0 Checkbox
// ---------------------------------------------------------------------------

export const MUI_CHECKBOX_LEDGER = "extract/computed/out/mui/checkbox/captured-truth.json";

const NO_LABEL_MUI =
  "the capture mounts the bare Checkbox (sampleText '' — FormControlLabel is a reviewed pairing with the official docs page, not a Checkbox child); no label part exists in the ledger";

const muiIcon = "cls:MuiSvgIcon-root";
const muiStates: Array<[string, string]> = [
  ["unchecked.enabled", "unchecked.enabled"],
  ["unchecked.disabled", "unchecked.disabled"],
  ["checked.enabled", "checked.enabled"],
  ["checked.disabled", "checked.disabled"],
  ["indeterminate.enabled", "indeterminate.enabled"],
  ["indeterminate.disabled", "indeterminate.disabled"],
];

export const muiCheckboxMappings: FactMapping[] = [
  one("wrapper.size", "px", { combo: "unchecked.enabled", part: "root", channel: "width" }),
  // NOT a capture read. This read MuiSvgIcon-root's width (24) and matched the
  // fixture's 24 — and both were describing the icon VIEWPORT, which MUI never
  // paints. The painted square is the outer subpath of
  // checkbox-icon-unchecked.svg, 3 -> 21 in a 24 viewBox = 18x18 with a 2px
  // stroke. SVG path extent is not a computed channel, so this is a receipt,
  // the same way the Astryx viewBox is read from its committed glyph asset.
  receipt(
    "box.size",
    "the painted square is the SVG path's extent, not MuiSvgIcon-root's width; path extent is not a computed channel",
    "extract/computed/out/mui/checkbox/assets/checkbox-icon-unchecked.svg outer subpath 3→21 in viewBox 0 0 24 24 = 18×18",
  ),
  receipt(
    "box.radius",
    "the unchecked box corner is SVG path geometry inside CheckBoxOutlineBlank's 24-viewBox icon, not a CSS border-radius (the SvgIcon's computed border-radius is 0)",
    "CheckBoxOutlineBlank.js path corner c-1.1 → reviewed 2; committed glyph asset extract/computed/out/mui/checkbox/assets/checkbox-icon-unchecked.svg",
  ),
  receipt(
    "box.borderWidth",
    "the unchecked outline stroke is drawn by the SVG path ring (outer box minus inner hole), not a CSS border — no computed channel carries its 2px thickness",
    "CheckBoxOutlineBlank.js outer 19×19 at (3,3) minus inner 15×15 at (5,5) → reviewed 2",
  ),
  receipt(
    "box.padding",
    "SwitchBase's computed padding 9 is measured from the 24 viewport; from the painted 18 square the inset to the 42 wrapper is 12",
    "SwitchBase.js padding 9 + checkbox-icon-unchecked.svg 18×18 painted extent; 18 + 12×2 = 42",
  ),
  receipt("row.gap", NO_LABEL_MUI, "FormControlLabel.js gap 0 (label sits flush; spacing is the label's own padding) — reviewed 0"),
  receipt(
    "dash.width",
    "the indeterminate bar is the even-odd HOLE of IndeterminateCheckBox's single path — hole geometry is not a computed style channel",
    "IndeterminateCheckBox.js hole M7 11 h10 v2 → 10×2 at (7,11); committed glyph asset checkbox-icon-indeterminate.svg",
  ),
  receipt(
    "dash.height",
    "same even-odd hole geometry as dash.width — not a computed channel",
    "IndeterminateCheckBox.js hole v2 → reviewed 2",
  ),
  receipt(
    "dash.radius",
    "same even-odd hole geometry — the hole is a sharp rect",
    "IndeterminateCheckBox.js hole path has no arc segments → reviewed 0",
  ),
  one("check.width", "px", { combo: "checked.enabled", part: muiIcon, channel: "width" }),
  one("check.height", "px", { combo: "checked.enabled", part: muiIcon, channel: "height" }),
  one(
    "check.strokeWidth",
    "number",
    { combo: "checked.enabled", part: "tag:path", channel: "stroke" },
    {
      formula: "0 when the glyph paints by fill (captured stroke: none)",
      combine: (raw) => (raw.v === "none" ? 0 : num(raw.v)),
    },
  ),
  receipt(
    "check.offsetX",
    "glyph placement is the recipe's own spelling (placement: center); the capture centers the icon by flex, which has no per-glyph offset channel",
    "SwitchBase root display flex align center — reviewed 0",
  ),
  receipt(
    "check.offsetY",
    "same as check.offsetX",
    "SwitchBase root display flex align center — reviewed 0",
  ),
  receipt("labelFontSize", NO_LABEL_MUI, "createTypography.js body1 16 — reviewed 16"),
  // states — the icon is the ONLY painted element; the recipe splits it into
  // box + glyph parts, so per-state facts map where a 1:1 channel exists and
  // carry ANATOMY-LOWERING receipts where the recipe part has no captured
  // element (the solid checked icon's white box, the absent glyph's spelling).
  ...muiStates.flatMap(([fix, combo]): FactMapping[] => {
    const checkedish = fix.startsWith("checked") || fix.startsWith("indeterminate");
    const rows: FactMapping[] = [];
    // boxFill / boxBorder
    if (fix.startsWith("unchecked")) {
      rows.push(
        one(`states.${fix}.boxFill`, "color", { combo, part: muiIcon, channel: "background-color" }),
        one(`states.${fix}.boxBorder`, "color", { combo, part: muiIcon, channel: "color" }, {
          formula: "the outline icon draws its ring in currentColor",
        }),
      );
    } else if (fix.startsWith("indeterminate")) {
      rows.push(
        one(`states.${fix}.boxFill`, "color", { combo, part: muiIcon, channel: "color" }, {
          formula: "the filled IndeterminateCheckBox icon IS the box: box fill = icon currentColor",
        }),
        one(`states.${fix}.boxBorder`, "color", { combo, part: muiIcon, channel: "color" }, {
          formula: "solid icon: border = fill",
        }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.boxFill`,
          "ANATOMY LOWERING (named in the fixture): the checked CheckBox icon is one solid-primary path with an even-odd white hole; the recipe paints a white box behind a primary glyph. The white box has no captured element",
          "recipe/fixtures/library-checkboxes.ts mui glyph note 'even-odd hole lowered to a white filled check overlay' — reviewed #ffffffff",
        ),
        receipt(
          `states.${fix}.boxBorder`,
          "same anatomy lowering — the solid checked icon draws no separate border; transparent is the recipe's spelling",
          "reviewed #00000000",
        ),
      );
    }
    // boxOpacity
    rows.push(one(`states.${fix}.boxOpacity`, "number", { combo, part: "root", channel: "opacity" }));
    // label
    rows.push(
      receipt(
        `states.${fix}.label`,
        NO_LABEL_MUI,
        `palette.text.${fix.endsWith("disabled") ? "disabled #00000061" : "primary #000000de"} — reviewed`,
      ),
    );
    // dashFill
    if (fix.startsWith("indeterminate")) {
      rows.push(
        receipt(
          `states.${fix}.dashFill`,
          "ANATOMY LOWERING (named in the fixture refusal mui-refusal-indeterminate-icon): the bar is the icon's even-odd HOLE — the recipe paints it as a white dash rect; the hole itself has no fill channel",
          "IndeterminateCheckBox.js even-odd hole — reviewed #ffffffff",
        ),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.dashFill`,
          "the dash glyph does not render in this state; transparent is the recipe's spelling of absent",
          `no indeterminate bar at combo ${combo} — reviewed #00000000`,
        ),
      );
    }
    // checkFill
    if (fix.startsWith("checked")) {
      rows.push(
        one(`states.${fix}.checkFill`, "color", { combo, part: muiIcon, channel: "color" }, {
          formula: "the checked icon paints in currentColor; the recipe's glyph fill = icon color",
        }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.checkFill`,
          "the check glyph does not render in this state; the recipe carries a white spelling for the glyph slot",
          `no check glyph at combo ${combo} — reviewed #ffffffff${checkedish ? "" : " (unchecked)"}`,
        ),
      );
    }
    return rows;
  }),
  // extra facts (added to the leaves map by the artifact builder)
  one("rowAlign", "string", { combo: "unchecked.enabled", part: "root", channel: "align-items" }, {
    formula: "SwitchBase root align-items",
  }),
  receipt("typography.label.family", NO_LABEL_MUI, "createTypography.js fontFamily Roboto — reviewed Roboto"),
  receipt("typography.label.style", NO_LABEL_MUI, "createTypography.js fontWeightRegular 400 — reviewed Regular"),
  {
    path: "check.path",
    kind: "string",
    reads: { v: { combo: "checked.enabled", part: "tag:path", channel: "d" } },
    formula:
      "the captured path('…') data of the checked glyph, numerically compared against the fixture's check.path (same 24-viewBox coordinate space)",
    combine: (raw) => raw.v,
  },
];

/**
 * ABSOLUTIZE an SVG path: the fixture carries the source's relative spelling
 * (`c-1.11 0-2 .9-2 2`), the browser's computed `d` is normalized to absolute
 * commands (`C 3.89 3 3 3.9 3 5`). Emits `[command, ...coords]` tokens with
 * every coordinate absolute, so the two spellings compare mechanically.
 * Supports M/L/H/V/C/Z (upper+lower, implicit repeats) — the full command set
 * MUI's icon paths use; an unknown command refuses by name.
 */
export function absolutizePath(d: string): Array<string | number> {
  const tokens = d.match(/[A-Za-z]|-?\.\d+|-?\d+(?:\.\d+)?/g) ?? [];
  const out: Array<string | number> = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  let cmd = "";
  const nextNum = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(String(t))) {
      cmd = String(t);
      i++;
    }
    // implicit repeat: M→L / m→l after the first pair
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "Z") {
      out.push("Z");
      cx = sx;
      cy = sy;
      continue;
    }
    if (C === "M" || C === "L") {
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      out.push(C === "M" ? "M" : "L", x, y);
      cx = x;
      cy = y;
      if (C === "M") {
        sx = x;
        sy = y;
        cmd = rel ? "l" : "L";
      }
      continue;
    }
    if (C === "H") {
      const x = nextNum() + (rel ? cx : 0);
      out.push("H", x);
      cx = x;
      continue;
    }
    if (C === "V") {
      const y = nextNum() + (rel ? cy : 0);
      out.push("V", y);
      cy = y;
      continue;
    }
    if (C === "C") {
      const x1 = nextNum() + (rel ? cx : 0);
      const y1 = nextNum() + (rel ? cy : 0);
      const x2 = nextNum() + (rel ? cx : 0);
      const y2 = nextNum() + (rel ? cy : 0);
      const x = nextNum() + (rel ? cx : 0);
      const y = nextNum() + (rel ? cy : 0);
      out.push("C", x1, y1, x2, y2, x, y);
      cx = x;
      cy = y;
      continue;
    }
    throw new Error(`absolutizePath: unsupported command "${cmd}" in "${d}"`);
  }
  return out;
}

/** MUI check.path is compared STRUCTURALLY: fixture (relative source
 *  spelling) absolutized vs the browser's normalized absolute path(). */
export const muiCheckPathEqual = (fixturePath: string, capturedPathFn: string): boolean => {
  const m = /^path\("([^"]+)"\)$/.exec(capturedPathFn);
  if (!m) return false;
  const a = absolutizePath(fixturePath);
  const b = absolutizePath(m[1]);
  return (
    a.length === b.length &&
    a.every((v, i) =>
      typeof v === "number" && typeof b[i] === "number"
        ? Math.abs(v - (b[i] as number)) <= 0.01
        : v === b[i],
    )
  );
};

// ---------------------------------------------------------------------------
// AntD — antd@5.29.3 Checkbox
// ---------------------------------------------------------------------------

export const ANTD_CHECKBOX_LEDGER = "extract/computed/out/antd/checkbox/captured-truth.json";

const inner = "cls:ant-checkbox-inner";
const antdLabel = "cls:ant-checkbox-label";
const antdStates = muiStates; // same combo spelling

export const antdCheckboxMappings: FactMapping[] = [
  one("wrapper.size", "px", { combo: "unchecked.enabled", part: "cls:ant-checkbox", channel: "width" }),
  one("box.size", "px", { combo: "unchecked.enabled", part: inner, channel: "width" }),
  one("box.radius", "px", { combo: "unchecked.enabled", part: inner, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: "unchecked.enabled", part: inner, channel: "border-top-width" }),
  one("box.padding", "px", { combo: "unchecked.enabled", part: inner, channel: "padding-top" }),
  one("row.gap", "px", { combo: "unchecked.enabled", part: antdLabel, channel: "padding-left" }, {
    formula: "'& + span' paddingInlineStart — the label span's own padding is the row gap",
  }),
  one("dash.width", "px", { combo: "indeterminate.enabled", part: inner, pseudo: "::after", channel: "width" }),
  // dash.height is a NAMED LOWERING: the library paints an 8×8 colorPrimary
  // square; v2 minted that square and it read as a filled tile, so v3 carries
  // an 8×2 dash (fixture refusal antd-refusal-indeterminate-square). MAPPED so
  // the drift report shows it; carried in reviewed-drift.json.
  one("dash.height", "px", { combo: "indeterminate.enabled", part: inner, pseudo: "::after", channel: "height" }),
  one("dash.radius", "px", { combo: "indeterminate.enabled", part: inner, pseudo: "::after", channel: "border-top-left-radius" }),
  {
    path: "check.width",
    kind: "px",
    reads: {
      w: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "width" },
      h: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "height" },
      s: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "border-bottom-width" },
    },
    formula:
      "the ::after L-stroke (legs w×h, stroke s) rotated 45° with the rotation BAKED into the path (the v3 teaching): bbox width = ((w−s)+(h−s))/√2",
    combine: (raw) => (px(raw.w) - px(raw.s) + (px(raw.h) - px(raw.s))) / Math.SQRT2,
    ...SUBPIXEL,
  },
  {
    path: "check.height",
    kind: "px",
    reads: {
      h: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "height" },
      s: { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "border-bottom-width" },
    },
    formula: "baked-rotation bbox height = (h−s)/√2",
    combine: (raw) => (px(raw.h) - px(raw.s)) / Math.SQRT2,
    ...SUBPIXEL,
  },
  one("check.strokeWidth", "px", { combo: "checked.enabled", part: inner, pseudo: "::after", channel: "border-bottom-width" }),
  receipt(
    "check.offsetX",
    "glyph placement is the recipe's spelling (placement: center); the ::after centers by translate(-50%,-50%), which the baked path already absorbs",
    "genCheckboxStyle inner::after translate(-50%,-50%) — reviewed 0",
  ),
  receipt("check.offsetY", "same as check.offsetX", "reviewed 0"),
  one("labelFontSize", "px", { combo: "unchecked.enabled", part: antdLabel, channel: "font-size" }),
  ...antdStates.flatMap(([fix, combo]): FactMapping[] => {
    const rows: FactMapping[] = [
      one(`states.${fix}.boxFill`, "color", { combo, part: inner, channel: "background-color" }),
      one(`states.${fix}.boxBorder`, "color", { combo, part: inner, channel: "border-top-color" }),
      one(`states.${fix}.boxOpacity`, "number", { combo, part: inner, channel: "opacity" }),
      one(`states.${fix}.label`, "color", { combo, part: antdLabel, channel: "color" }),
    ];
    // dashFill: painted (background) only at indeterminate; absent otherwise.
    if (fix.startsWith("indeterminate")) {
      rows.push(
        one(`states.${fix}.dashFill`, "color", { combo, part: inner, pseudo: "::after", channel: "background-color" }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.dashFill`,
          "the indeterminate bar does not render in this state (::after transform scale(0) / no background); transparent is the recipe's spelling of absent",
          `inner::after hidden at combo ${combo} — reviewed #00000000`,
        ),
      );
    }
    // checkFill: the ::after border color when the tick renders.
    if (fix.startsWith("checked")) {
      rows.push(
        one(`states.${fix}.checkFill`, "color", { combo, part: inner, pseudo: "::after", channel: "border-bottom-color" }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.checkFill`,
          "the tick does not render in this state; the recipe carries a glyph-slot spelling",
          `inner::after scale(0) at combo ${combo} — reviewed (fixture value carried)`,
        ),
      );
    }
    return rows;
  }),
  one("rowAlign", "string", { combo: "unchecked.enabled", part: "root", channel: "align-items" }, {
    formula: "wrapper label align-items",
  }),
  receipt(
    "typography.label.family",
    "the capture PINS token.fontFamily to the Roboto stack (FC-FONT-SUBSTRATE closure, extract/computed/configs/antd.json fonts.__note) — the ledger's font-family is the mount pin, not the library's declared '-apple-system, …' stack the fixture cites",
    "theme.getDesignToken().fontFamily starts -apple-system — the fixture's requestedFamily",
  ),
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: "unchecked.enabled", part: antdLabel, channel: "font-weight" } },
    formula: "label font-weight → style word (400 Regular / 500 Medium / 600 Semibold / 700 Bold)",
    combine: (raw) => styleForWeight(num(raw.v)),
  },
  receipt(
    "check.path",
    "the tick is a border-drawn ::after L-stroke, not an SVG — there is no path data channel. The baked-rotation path's ENDPOINT GEOMETRY is mechanically held by the check.width / check.height derivations above (legs (w−s, h−s) rotated 45°)",
    "genCheckboxStyle inner::after border-right+border-bottom rotate(45deg) — fixture path M7.677 0 L2.626 5.051 L0 2.424 bakes the rotation (the v3 teaching)",
  ),
];

// ---------------------------------------------------------------------------
// Astryx — @astryxdesign/core@0.1.6 CheckboxInput (Theme neutralTheme mount)
// ---------------------------------------------------------------------------

export const ASTRYX_CHECKBOX_LEDGER =
  "extract/computed/out/astryx-core/checkboxinput/captured-truth.json";

const abox = "cls:astryx-checkbox";
const alabel = "cls:astryx-field-label";
/** fixture state key → captured combo (md size; sm is receipted, not an axis). */
const astryxStates: Array<[string, string]> = [
  ["unchecked.enabled", "unchecked.md.no-isDisabled"],
  ["unchecked.disabled", "unchecked.md.isDisabled"],
  ["checked.enabled", "checked.md.no-isDisabled"],
  ["checked.disabled", "checked.md.isDisabled"],
  ["indeterminate.enabled", "indeterminate.md.no-isDisabled"],
  ["indeterminate.disabled", "indeterminate.md.isDisabled"],
];
const A_BASE = "unchecked.md.no-isDisabled";

export const astryxCheckboxMappings: FactMapping[] = [
  one("wrapper.size", "px", { combo: A_BASE, part: "idx:0.0", channel: "width" }, {
    formula: "the 24×24 wrapper div around input+box",
  }),
  one("box.size", "px", { combo: A_BASE, part: abox, channel: "width" }),
  one("box.radius", "px", { combo: A_BASE, part: abox, channel: "border-top-left-radius" }),
  one("box.borderWidth", "px", { combo: A_BASE, part: abox, channel: "border-top-width" }),
  one("box.padding", "px", { combo: A_BASE, part: abox, channel: "padding-top" }),
  one("row.gap", "px", { combo: A_BASE, part: "idx:0", channel: "column-gap" }),
  one("dash.width", "px", { combo: "indeterminate.md.no-isDisabled", part: "idx:0.0.1.1", channel: "width" }, {
    formula: "the indeterminate mark div inside the box",
  }),
  one("dash.height", "px", { combo: "indeterminate.md.no-isDisabled", part: "idx:0.0.1.1", channel: "height" }),
  one("dash.radius", "px", { combo: "indeterminate.md.no-isDisabled", part: "idx:0.0.1.1", channel: "border-top-left-radius" }),
  one("check.width", "px", { combo: "checked.md.no-isDisabled", part: "tag:svg", channel: "width" }),
  one("check.height", "px", { combo: "checked.md.no-isDisabled", part: "tag:svg", channel: "height" }),
  {
    path: "check.strokeWidth",
    kind: "number",
    reads: {
      s: { combo: "checked.md.no-isDisabled", part: "tag:path", channel: "stroke-width" },
      w: { combo: "checked.md.no-isDisabled", part: "tag:svg", channel: "width" },
    },
    formula:
      "path stroke-width × (rendered svg width / viewBox 10) — the viewBox is not a computed channel; 10 is read from the committed glyph asset extract/computed/out/astryx-core/checkboxinput/assets/checkbox-input-icon-md.svg",
    combine: (raw) => px(raw.s) * (px(raw.w) / 10),
  },
  receipt("check.offsetX", "flex-centered glyph; placement: center is the recipe's spelling", "reviewed 0"),
  receipt("check.offsetY", "same as check.offsetX", "reviewed 0"),
  one("labelFontSize", "px", { combo: A_BASE, part: alabel, channel: "font-size" }),
  ...astryxStates.flatMap(([fix, combo]): FactMapping[] => {
    const rows: FactMapping[] = [
      one(`states.${fix}.boxFill`, "color", { combo, part: abox, channel: "background-color" }),
      one(`states.${fix}.boxBorder`, "color", { combo, part: abox, channel: "border-top-color" }),
      one(`states.${fix}.boxOpacity`, "number", { combo, part: abox, channel: "opacity" }),
      one(`states.${fix}.label`, "color", { combo, part: alabel, channel: "color" }),
    ];
    if (fix.startsWith("indeterminate")) {
      rows.push(
        one(`states.${fix}.dashFill`, "color", { combo, part: "idx:0.0.1.1", channel: "background-color" }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.dashFill`,
          "the indeterminate mark does not render in this state; transparent is the recipe's spelling of absent",
          `no mark at combo ${combo} — reviewed #00000000`,
        ),
      );
    }
    if (fix.startsWith("checked")) {
      rows.push(
        one(`states.${fix}.checkFill`, "color", { combo, part: "tag:path", channel: "stroke" }, {
          formula: "the check strokes in --color-on-accent",
        }),
      );
    } else {
      rows.push(
        receipt(
          `states.${fix}.checkFill`,
          "the check does not render in this state; the recipe carries a glyph-slot spelling",
          `no check at combo ${combo} — reviewed (fixture value carried)`,
        ),
      );
    }
    return rows;
  }),
  one("rowAlign", "string", { combo: A_BASE, part: "idx:0", channel: "align-items" }),
  {
    path: "typography.label.family",
    kind: "string",
    reads: { v: { combo: A_BASE, part: alabel, channel: "font-family" } },
    formula: "first family of the label's computed stack under the library's documented Theme mount",
    combine: (raw) => raw.v.split(",")[0].trim().replace(/^["']|["']$/g, ""),
  },
  {
    path: "typography.label.style",
    kind: "string",
    reads: { v: { combo: A_BASE, part: alabel, channel: "font-weight" } },
    formula: "label font-weight → style word",
    combine: (raw) => styleForWeight(num(raw.v)),
  },
  {
    path: "check.path",
    kind: "string",
    reads: { v: { combo: "checked.md.no-isDisabled", part: "tag:path", channel: "d" } },
    formula:
      "captured path() coordinates × (rendered 14 / viewBox 10) numerically equal the fixture's scaled path",
    combine: (raw) => raw.v,
  },
];

/** Astryx check.path: fixture coordinates are the captured path × 1.4. */
export const astryxCheckPathEqual = (fixturePath: string, capturedPathFn: string): boolean => {
  const a = (fixturePath.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const b = pathNumbers(capturedPathFn).map((n) => n * 1.4);
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 0.01);
};

export const checkboxColorNormalize = hex8;
