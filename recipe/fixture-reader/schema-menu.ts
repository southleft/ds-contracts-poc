/**
 * menu@1 READER SCHEMA — a popover panel of items as ledger reads over ROLES
 * (the shape of schema-checkbox.ts). One cell: menu@1 has a single default
 * variant and draws exactly two items, so the capture the person writes
 * mounts two.
 *
 * The panel's inset is read as the sum of the paper's padding and the
 * list's (MUI keeps 0 on the paper and 8 on the list; the recipe carries one
 * `panel.padding`); the item's minimum height as its `min-height` when it is a
 * length, else 0 (the item then hugs its label + padding as the recipe does).
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";

export interface MenuRoles {
  /** The panel that paints: radius, fill. */
  panel: string;
  /** The list that lays the items out (padding, row-gap). Default: the panel. */
  list?: string;
  /** The first item (the second is its next sibling in the drafted order). */
  item: string;
  /** The part carrying the item's text when it is not the item itself. */
  label?: string;
}

export interface MenuSchemaOptions {
  combo: string;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });
const pxOr0 = (v: string | undefined): number => (v && /^-?\d/.test(v) ? px(v) : 0);
const radiusOf = (r: string, size: number): number => (r.trim().endsWith("%") ? (size * parseFloat(r)) / 100 : px(r));

export const MENU_SPELLINGS: Record<string, Spelling> = {};

export function menuSchemaMappings(roles: MenuRoles, opts: MenuSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const list = roles.list ?? roles.panel;
  const label = roles.label ?? roles.item;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  return [
    R("panel.padding", () => ({
      path: "panel.padding",
      kind: "px",
      reads: { pp: { combo, part: roles.panel, channel: "padding-top" }, lp: { combo, part: list, channel: "padding-top" } },
      formula: roles.list ? "the panel's padding-top plus the list's (MUI: 0 on the paper, 8 on the list)" : "the panel's padding-top",
      combine: (raw) => pxOr0(raw.pp) + (roles.list ? pxOr0(raw.lp) : 0),
    })),
    R("panel.radius", () => ({
      path: "panel.radius",
      kind: "px",
      reads: { r: { combo, part: roles.panel, channel: "border-top-left-radius" }, h: { combo, part: roles.panel, channel: "height" } },
      formula: "border-top-left-radius; a percentage is of the panel's height; clamped to half the height as CSS clamps it",
      combine: (raw) => Number(Math.min(radiusOf(raw.r!, px(raw.h!)), px(raw.h!) / 2).toFixed(3)),
    })),
    R("panel.itemSpacing", () => one("panel.itemSpacing", "px", { combo, part: list, channel: "row-gap" }, { formula: "the list's row-gap (keywords read 0)", combine: (raw) => pxOr0(raw.v) })),
    R("panel.fill", () => one("panel.fill", "color", { combo, part: roles.panel, channel: "background-color" })),
    R("item.paddingX", () => one("item.paddingX", "px", { combo, part: roles.item, channel: "padding-left" })),
    R("item.paddingY", () => one("item.paddingY", "px", { combo, part: roles.item, channel: "padding-top" })),
    R("item.minHeight", () => one("item.minHeight", "px", { combo, part: roles.item, channel: "min-height" }, { formula: "the item's min-height as a length; `auto`/0 means the item hugs its label and padding", combine: (raw) => pxOr0(raw.v) })),
    R("item.fill", () => one("item.fill", "color", { combo, part: roles.item, channel: "background-color" })),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: label, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: label, channel: "line-height" }, { formula: "the label's line-height as a px length; `normal` is 0 with unit auto", combine: (raw) => pxOr0(raw.v) })),
    R("lineHeightUnit", () => one("lineHeightUnit", "string", { combo, part: label, channel: "line-height" }, { formula: "`normal` → auto; a length → px", combine: (raw) => (/^-?\d/.test(raw.v!) ? "px" : "auto") })),
    R("label", () => one("label", "color", { combo, part: label, channel: "color" })),
    R("typography.label.family", () => one("typography.label.family", "string", { combo, part: label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam })),
    R("typography.label.style", () => one("typography.label.style", "string", { combo, part: label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
  ];
}
