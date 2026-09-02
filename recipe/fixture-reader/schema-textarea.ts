/**
 * textarea@1 READER SCHEMA — the archetype's fixture leaves as ledger reads
 * over ROLES (the shape of schema-checkbox.ts).
 *
 * textarea@1 has two label planes — STACKED (a label above the box: Astryx,
 * Chakra's Field) and FLOATING (a label that overlays the outline and shrinks
 * when the field has a value: MUI) — and a BARE cell (no label part: AntD's
 * Input.TextArea, Chakra's Textarea). The plane is decided by what the label
 * DOES between the empty and value combos, never by class names: an
 * absolutely-positioned label whose transform changes is floating. Every
 * floating leaf is read from the label's transform matrix; on a stacked label
 * the same reads come out 0 / the label size, which is what the recipe
 * spells for that plane.
 */
import type { FactMapping } from "./reader.js";
import { hex8, matrix, num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";
import { BARE_LABEL_COLOR, BARE_LABEL_FONT_SIZE, bareLabelFont } from "../recipes/textarea.js";

export interface TextareaRoles {
  /** The painted box: fill, radius, padding, height (and the border unless `outline` carries it). */
  box: string;
  /** A distinct part that carries the border (MUI's notched-outline fieldset). Default: the box. */
  outline?: string;
  /** The real <textarea>: line-height, font, rows, placeholder. May be the box itself. */
  inner: string;
  /** The label text element. Absent for a BARE cell. */
  label?: string;
  /** The ancestor that lays out label + box (row-gap). */
  container?: string;
  /** The legend inside a notched outline (MUI). Its presence is the notched treatment. */
  legend?: string;
  /** Where the field's opacity is expressed when disabled (default: the box). */
  opacityOn?: string;
}

export type TextareaComboMap = Record<"empty.enabled" | "empty.disabled" | "value.enabled" | "value.disabled", string>;

export interface TextareaSchemaOptions {
  combos: TextareaComboMap;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; interaction?: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

const pxOr0 = (v: string | undefined): number => (v && /^-?\d/.test(v) ? px(v) : 0);
const tx = (t: string): number => (/^matrix/.test(t) ? matrix(t).tx : 0);
const ty = (t: string): number => (/^matrix/.test(t) ? matrix(t).ty : 0);
const sa = (t: string): number => (/^matrix/.test(t) ? matrix(t).a : 1);
const isTransparent = (v: string | undefined): boolean => !v || v === "transparent" || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(v);
/** Placeholder ink: the ::placeholder colour's alpha × its opacity, as hex8. */
const ink = (color: string, opacity: string): string => {
  const h = hex8(color);
  const a = Math.round(parseInt(h.slice(7, 9), 16) * num(opacity));
  return `${h.slice(0, 7)}${a.toString(16).padStart(2, "0")}`;
};

const BARE = "no label part in the mount — a bare cell; the recipe compiles no label node and this leaf is the bare-cell spelling";
const BARE_FONT = bareLabelFont();

/**
 * ARCHETYPE SPELLINGS, per role map: the outline treatment and stroke
 * alignment follow from the anatomy (a legend inside a distinct outline is
 * the notched treatment; a distinct outline part sits outside the box), the
 * box clips its text, and a bare cell's label leaves are the recipe's inert
 * constants. A leaf's value never comes from anywhere else.
 */
export const textareaSpellingsFor = (roles: Pick<TextareaRoles, "label" | "outline" | "legend">): Record<string, Spelling> => {
  const s: Record<string, Spelling> = {
    outlineTreatment: roles.legend ? "notched" : "plain",
    strokeAlign: roles.outline ? "outside" : "inside",
    boxClips: "true",
  };
  if (!roles.legend) s.notchFill = "#00000000";
  if (!roles.label) {
    Object.assign(s, {
      labelPlacement: "stacked",
      labelGap: 0,
      labelFontSize: BARE_LABEL_FONT_SIZE,
      labelLineHeightUnit: "auto",
      labelLineHeight: 0,
      labelInsetX: 0,
      labelInactiveOffsetY: 0,
      labelFloatingOffsetY: 0,
      floatingLabelFontSize: BARE_LABEL_FONT_SIZE,
      "typography.label.family": BARE_FONT.requestedFamily,
      "typography.label.style": BARE_FONT.requestedStyle,
    });
    for (const fix of ["empty.enabled", "empty.disabled", "value.enabled", "value.disabled"]) s[`states.${fix}.label`] = BARE_LABEL_COLOR;
  }
  return s;
};

export function textareaSchemaMappings(roles: TextareaRoles, opts: TextareaSchemaOptions): FactMapping[] {
  const c = opts.combos;
  const base = c["empty.enabled"];
  const filled = c["value.enabled"];
  const border = roles.outline ?? roles.box;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const L = (path: string, fallback: () => FactMapping): FactMapping => (roles.label ? R(path, fallback) : receipt(path, BARE, "reviewed (bare-cell spelling)"));
  const label = roles.label ?? roles.box;
  const rows: FactMapping[] = [
    R("box.height", () => one("box.height", "px", { combo: base, part: roles.box, channel: "height" })),
    R("box.paddingX", () => one("box.paddingX", "px", { combo: base, part: roles.box, channel: "padding-left" })),
    R("box.paddingY", () => one("box.paddingY", "px", { combo: base, part: roles.box, channel: "padding-top" })),
    R("box.radius", () => one("box.radius", "px", { combo: base, part: roles.box, channel: "border-top-left-radius" })),
    R("box.borderWidth", () => one("box.borderWidth", "px", { combo: base, part: border, channel: "border-top-width" }, { formula: roles.outline ? "the distinct outline part's border" : "the box's own border" })),
    R("box.rows", () => ({
      path: "box.rows",
      kind: "number",
      reads: {
        h: { combo: base, part: roles.inner, channel: "height" },
        lh: { combo: base, part: roles.inner, channel: "line-height" },
        bs: { combo: base, part: roles.inner, channel: "box-sizing" },
        pt: { combo: base, part: roles.inner, channel: "padding-top" },
        pb: { combo: base, part: roles.inner, channel: "padding-bottom" },
        bt: { combo: base, part: roles.inner, channel: "border-top-width" },
        bb: { combo: base, part: roles.inner, channel: "border-bottom-width" },
      },
      formula: "rendered rows = the inner textarea's content height / its line-height (a border-box height minus its padding and border; a content-box height as is)",
      combine: (raw) => {
        const inner = raw.bs === "border-box" ? px(raw.h!) - pxOr0(raw.pt) - pxOr0(raw.pb) - pxOr0(raw.bt) - pxOr0(raw.bb) : px(raw.h!);
        return Number((inner / px(raw.lh!)).toFixed(3));
      },
    })),
    R("box.lineHeight", () => one("box.lineHeight", "px", { combo: base, part: roles.inner, channel: "line-height" })),
    L("labelGap", () => ({
      path: "labelGap",
      kind: "px",
      reads: {
        ...(roles.container ? { rg: { combo: base, part: roles.container, channel: "row-gap" } } : {}),
        mb: { combo: base, part: label, channel: "margin-bottom" },
        mt: { combo: base, part: roles.box, channel: "margin-top" },
      },
      formula: "the space between the label and the box: container row-gap + label margin-bottom + box margin-top (keywords read 0; a floating label overlays the box and reads 0)",
      combine: (raw) => pxOr0(raw.rg) + pxOr0(raw.mb) + pxOr0(raw.mt),
    })),
    L("labelFontSize", () => one("labelFontSize", "px", { combo: base, part: label, channel: "font-size" })),
    L("labelLineHeight", () => one("labelLineHeight", "px", { combo: base, part: label, channel: "line-height" }, { formula: "the label's line-height as a px length; `normal` is 0 with unit auto", combine: (raw) => pxOr0(raw.v) })),
    L("labelLineHeightUnit", () => one("labelLineHeightUnit", "string", { combo: base, part: label, channel: "line-height" }, { formula: "`normal` → auto (hug the face); a length → px", combine: (raw) => (/^-?\d/.test(raw.v!) ? "px" : "auto") })),
    R("valueFontSize", () => one("valueFontSize", "px", { combo: base, part: roles.inner, channel: "font-size" })),
    L("labelPlacement", () => ({
      path: "labelPlacement",
      kind: "string",
      reads: {
        pos: { combo: base, part: label, channel: "position" },
        t0: { combo: base, part: label, channel: "transform" },
        t1: { combo: filled, part: label, channel: "transform" },
      },
      formula: "floating when the label is absolutely positioned or its transform changes between the empty and value combos; otherwise stacked",
      combine: (raw) => (raw.pos === "absolute" || raw.t0 !== raw.t1 ? "floating" : "stacked"),
    })),
    L("labelInsetX", () => one("labelInsetX", "px", { combo: base, part: label, channel: "transform" }, { formula: "rest label transform matrix tx (none → 0)", combine: (raw) => tx(raw.v!) })),
    L("labelInactiveOffsetY", () => one("labelInactiveOffsetY", "px", { combo: base, part: label, channel: "transform" }, { formula: "rest label transform matrix ty (none → 0)", combine: (raw) => ty(raw.v!) })),
    L("labelFloatingOffsetY", () => one("labelFloatingOffsetY", "px", { combo: filled, part: label, channel: "transform" }, { formula: "the value combo's label transform matrix ty (a stacked label: 0)", combine: (raw) => ty(raw.v!) })),
    L("floatingLabelFontSize", () => ({
      path: "floatingLabelFontSize",
      kind: "px",
      reads: { fs: { combo: filled, part: label, channel: "font-size" }, t: { combo: filled, part: label, channel: "transform" } },
      formula: "the value combo's label font-size × its transform scale a (a stacked label: the label size)",
      combine: (raw) => Number((px(raw.fs!) * sa(raw.t!)).toFixed(3)),
    })),
    R("notchFill", () =>
      roles.legend
        ? receipt("notchFill", "the notch knockout is the surface showing through the legend gap — no computed channel carries it (the legend's background is transparent)", "reviewed")
        : receipt("notchFill", "plain outline — no notched anatomy; transparent is the recipe's spelling of no knockout", "reviewed #00000000"),
    ),
    receipt("outlineTreatment", "follows from the anatomy: a legend inside a distinct outline is the notched treatment", roles.legend ? "reviewed notched" : "reviewed plain"),
    receipt("strokeAlign", "follows from the anatomy: a distinct outline part draws outside the box; the box's own border draws inside", roles.outline ? "reviewed outside" : "reviewed inside"),
    receipt("boxClips", "the box clips its text — recipe geometry", "reviewed true"),
  ];
  for (const fix of Object.keys(c) as Array<keyof TextareaComboMap>) {
    const combo = c[fix];
    rows.push(
      R(`states.${fix}.boxFill`, () => one(`states.${fix}.boxFill`, "color", { combo, part: roles.box, channel: "background-color" })),
      R(`states.${fix}.boxBorder`, () => one(`states.${fix}.boxBorder`, "color", { combo, part: border, channel: "border-top-color" })),
      R(`states.${fix}.boxOpacity`, () => one(`states.${fix}.boxOpacity`, "number", { combo, part: roles.opacityOn ?? roles.box, channel: "opacity" })),
      L(`states.${fix}.label`, () => one(`states.${fix}.label`, "color", { combo, part: label, channel: "color" })),
    );
    if (fix.startsWith("empty")) {
      rows.push(
        R(`states.${fix}.value`, () => ({
          path: `states.${fix}.value`,
          kind: "color",
          reads: {
            c0: { combo, part: roles.inner, pseudo: "::placeholder", channel: "color" },
            o0: { combo, part: roles.inner, pseudo: "::placeholder", channel: "opacity" },
            c1: { combo, interaction: "focus-visible", part: roles.inner, pseudo: "::placeholder", channel: "color" },
            o1: { combo, interaction: "focus-visible", part: roles.inner, pseudo: "::placeholder", channel: "opacity" },
          },
          formula: "placeholder ink = ::placeholder colour alpha × opacity at rest; when rest hides it (opacity 0 under an overlaying label) the focus-visible interaction's; hidden in both refuses",
          combine: (raw) => {
            if (num(raw.o0!) > 0) return ink(raw.c0!, raw.o0!);
            if (num(raw.o1!) > 0) return ink(raw.c1!, raw.o1!);
            throw new Error("the placeholder is hidden (opacity 0) at rest and at focus — its ink is unobservable in this capture");
          },
        })),
      );
    } else {
      rows.push(
        R(`states.${fix}.value`, () => ({
          path: `states.${fix}.value`,
          kind: "color",
          reads: { col: { combo, part: roles.inner, channel: "color" }, tfc: { combo, part: roles.inner, channel: "-webkit-text-fill-color" } },
          formula: "the field text's ink: -webkit-text-fill-color when it paints (MUI's disabled ink), else color",
          combine: (raw) => hex8(!isTransparent(raw.tfc) ? raw.tfc! : raw.col!),
        })),
      );
    }
  }
  rows.push(
    L("typography.label.family", () => one("typography.label.family", "string", { combo: base, part: label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam })),
    L("typography.label.style", () => one("typography.label.style", "string", { combo: base, part: label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
    R("typography.value.family", () => one("typography.value.family", "string", { combo: base, part: roles.inner, channel: "font-family" }, { formula: "first family of the field text's computed stack", combine: firstFam })),
    R("typography.value.style", () => one("typography.value.style", "string", { combo: base, part: roles.inner, channel: "font-weight" }, { formula: "field font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
  );
  return rows;
}
