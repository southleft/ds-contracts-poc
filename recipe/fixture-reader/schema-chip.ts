/**
 * chip@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * the BOX (the painted pill) and the LABEL (the text part, when not the box).
 */
import type { FactMapping } from "./reader.js";
import { hex8, num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";

export interface ChipRoles {
  /** The painted tip: padding, radius, border, fill, text. */
  box: string;
  /** The part carrying the text when it is not the box itself. */
  label?: string;
}

export interface ChipSchemaOptions {
  combo: string;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
export const CHIP_SPELLINGS: Record<string, Spelling> = {
  strokeAlign: "inside",
};

/** A box-shadow list containing exactly one zero-offset, zero-blur INSET layer → {spread, color}; else null. */
export const insetRing = (v: string): { spread: number; color: string } | null => {
  if (!v || v === "none") return null;
  const layers = v.split(/,(?![^(]*\))/).map((l) => l.trim()).filter(Boolean);
  if (layers.length !== 1) return null;
  const l = layers[0]!;
  if (!/(^|\s)inset(\s|$)/.test(l)) return null;
  const colour = /rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/i.exec(l);
  if (!colour) return null;
  const lengths = l.replace(colour[0], " ").replace(/(^|\s)inset(\s|$)/, " ").trim().split(/\s+/).map(px);
  if (lengths.length < 4 || lengths[0] !== 0 || lengths[1] !== 0 || lengths[2] !== 0 || lengths[3]! <= 0) return null;
  return { spread: lengths[3]!, color: hex8(colour[0]) };
};

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;
const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

export function chipSchemaMappings(roles: ChipRoles, opts: ChipSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const label = roles.label ?? roles.box;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  return [
    R("box.height", () => one("box.height", "px", { combo, part: roles.box, channel: "height" })),
    // The label's inset from the box edge: the box's own padding plus the
    // padding of a label part inside it (MUI's Chip pads the label span).
    // The label's inset from the box edge: the box's own padding plus the
    // padding of a label part inside it (MUI's Chip pads the label span),
    // MINUS the spread of an inset ring lowered to the border (a box-shadow
    // takes no layout space; the recipe's border does, so the ring's width
    // comes out of the padding it sits in).
    R("box.paddingX", () => ({ path: "box.paddingX", kind: "px", reads: { b: { combo, part: roles.box, channel: "padding-left" }, bw: { combo, part: roles.box, channel: "border-top-width" }, s: { combo, part: roles.box, channel: "box-shadow" }, ...(roles.label ? { l: { combo, part: roles.label, channel: "padding-left" } } : {}) }, formula: "box padding-left + label padding-left − an inset ring's spread when the ring is the border", combine: (raw) => Math.max(0, px(raw.b) + (raw.l !== undefined ? px(raw.l) : 0) - (px(raw.bw) > 0 ? 0 : (insetRing(raw.s)?.spread ?? 0))) })),
    R("box.paddingY", () => ({ path: "box.paddingY", kind: "px", reads: { b: { combo, part: roles.box, channel: "padding-top" }, bw: { combo, part: roles.box, channel: "border-top-width" }, s: { combo, part: roles.box, channel: "box-shadow" }, ...(roles.label ? { l: { combo, part: roles.label, channel: "padding-top" } } : {}) }, formula: "box padding-top + label padding-top − an inset ring's spread when the ring is the border", combine: (raw) => Math.max(0, px(raw.b) + (raw.l !== undefined ? px(raw.l) : 0) - (px(raw.bw) > 0 ? 0 : (insetRing(raw.s)?.spread ?? 0))) })),
    R("box.radius", () => one("box.radius", "px", { combo, part: roles.box, channel: "border-top-left-radius" })),
    // A zero-offset, zero-blur INSET box-shadow is an inside border in every
    // respect CSS paints (Chakra's Tag: `0 0 0 1px inset`); when the CSS border
    // is 0 and such a ring exists, the ring's spread is the border width and its
    // colour the border colour.
    R("box.borderWidth", () => ({ path: "box.borderWidth", kind: "px", reads: { b: { combo, part: roles.box, channel: "border-top-width" }, s: { combo, part: roles.box, channel: "box-shadow" } }, formula: "border-top-width, or the spread of a zero-offset zero-blur inset ring when the border is 0", combine: (raw) => { const b = px(raw.b); const ring = insetRing(raw.s); return b > 0 || !ring ? b : ring.spread; } })),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: label, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: label, channel: "line-height" })),
    R("rest.boxFill", () => one("rest.boxFill", "color", { combo, part: roles.box, channel: "background-color" })),
    R("rest.boxBorder", () => ({ path: "rest.boxBorder", kind: "color", reads: { b: { combo, part: roles.box, channel: "border-top-width" }, c: { combo, part: roles.box, channel: "border-top-color" }, s: { combo, part: roles.box, channel: "box-shadow" } }, formula: "border-top-color, or the inset ring's colour when the border is 0", combine: (raw) => { const ring = insetRing(raw.s); return px(raw.b) > 0 || !ring ? hex8(raw.c) : ring.color; } })),
    R("rest.boxOpacity", () => one("rest.boxOpacity", "number", { combo, part: roles.box, channel: "opacity" })),
    R("rest.label", () => one("rest.label", "color", { combo, part: label, channel: "color" })),
    receipt("strokeAlign", "a CSS border lies inside the box — recipe spelling", "reviewed inside"),
    R("typography.label.family", () => one("typography.label.family", "string", { combo, part: label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam })),
    R("typography.label.style", () => one("typography.label.style", "string", { combo, part: label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v)) })),
  ];
}
