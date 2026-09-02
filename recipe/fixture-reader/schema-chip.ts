/**
 * chip@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * the BOX (the painted pill) and the LABEL (the text part, when not the box).
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
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
    R("box.paddingX", () => roles.label
      ? { path: "box.paddingX", kind: "px", reads: { b: { combo, part: roles.box, channel: "padding-left" }, l: { combo, part: roles.label, channel: "padding-left" } }, formula: "box padding-left + label padding-left (the label's own padding is part of the inset)", combine: (raw) => px(raw.b) + px(raw.l) }
      : one("box.paddingX", "px", { combo, part: roles.box, channel: "padding-left" })),
    R("box.paddingY", () => roles.label
      ? { path: "box.paddingY", kind: "px", reads: { b: { combo, part: roles.box, channel: "padding-top" }, l: { combo, part: roles.label, channel: "padding-top" } }, formula: "box padding-top + label padding-top", combine: (raw) => px(raw.b) + px(raw.l) }
      : one("box.paddingY", "px", { combo, part: roles.box, channel: "padding-top" })),
    R("box.radius", () => one("box.radius", "px", { combo, part: roles.box, channel: "border-top-left-radius" })),
    R("box.borderWidth", () => one("box.borderWidth", "px", { combo, part: roles.box, channel: "border-top-width" })),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: label, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: label, channel: "line-height" })),
    R("rest.boxFill", () => one("rest.boxFill", "color", { combo, part: roles.box, channel: "background-color" })),
    R("rest.boxBorder", () => one("rest.boxBorder", "color", { combo, part: roles.box, channel: "border-top-color" })),
    R("rest.boxOpacity", () => one("rest.boxOpacity", "number", { combo, part: roles.box, channel: "opacity" })),
    R("rest.label", () => one("rest.label", "color", { combo, part: label, channel: "color" })),
    receipt("strokeAlign", "a CSS border lies inside the box — recipe spelling", "reviewed inside"),
    R("typography.label.family", () => one("typography.label.family", "string", { combo, part: label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam })),
    R("typography.label.style", () => one("typography.label.style", "string", { combo, part: label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v)) })),
  ];
}
