/**
 * link@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * ONE role, the anchor (the text-carrying element, usually transparent). The height is
 * the recipe's hug spelling (0); a CSS `line-height: normal` is the recipe's
 * `auto` unit with 0; a length is the px unit.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";

export interface LinkRoles {
  /** The painted tip: padding, radius, border, fill, text. */
  box: string;
  /** The part carrying the text when it is not the box itself. */
  label?: string;
}

export interface LinkSchemaOptions {
  combo: string;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
export const LINK_SPELLINGS: Record<string, Spelling> = {
  "box.height": 0,
  strokeAlign: "inside",
};

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;
const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

export function linkSchemaMappings(roles: LinkRoles, opts: LinkSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const label = roles.label ?? roles.box;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  return [
    receipt("box.height", "the link hugs its text — recipe spelling 0 (hug)", "reviewed 0"),
    R("box.paddingX", () => one("box.paddingX", "px", { combo, part: roles.box, channel: "padding-left" })),
    R("box.paddingY", () => one("box.paddingY", "px", { combo, part: roles.box, channel: "padding-top" })),
    R("box.radius", () => one("box.radius", "px", { combo, part: roles.box, channel: "border-top-left-radius" })),
    R("box.borderWidth", () => one("box.borderWidth", "px", { combo, part: roles.box, channel: "border-top-width" })),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: label, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: label, channel: "line-height" }, { formula: "CSS normal → 0 with lineHeightUnit auto; a length → px", combine: (raw) => (raw.v === "normal" ? 0 : px(raw.v)) })),
    R("lineHeightUnit", () => one("lineHeightUnit", "string", { combo, part: label, channel: "line-height" }, { formula: "CSS normal → auto; a length → px", combine: (raw) => (raw.v === "normal" ? "auto" : "px") })),
    R("decoration", () => one("decoration", "string", { combo, part: label, channel: "text-decoration-line" }, { formula: "text-decoration-line underline → underline, else none", combine: (raw) => (/underline/.test(raw.v) ? "underline" : "none") })),
    R("rest.boxFill", () => one("rest.boxFill", "color", { combo, part: roles.box, channel: "background-color" })),
    R("rest.boxBorder", () => one("rest.boxBorder", "color", { combo, part: roles.box, channel: "border-top-color" })),
    R("rest.boxOpacity", () => one("rest.boxOpacity", "number", { combo, part: roles.box, channel: "opacity" })),
    R("rest.label", () => one("rest.label", "color", { combo, part: label, channel: "color" })),
    receipt("strokeAlign", "a CSS border lies inside the box — recipe spelling", "reviewed inside"),
    R("typography.label.family", () => one("typography.label.family", "string", { combo, part: label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam })),
    R("typography.label.style", () => one("typography.label.style", "string", { combo, part: label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v)) })),
  ];
}
