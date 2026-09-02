/**
 * dialog@1 READER SCHEMA — a paper with a title over a body as ledger reads
 * over ROLES (the shape of schema-checkbox.ts). One cell.
 *
 * The paper's inset is asymmetric in the libraries (MUI: DialogTitle pads
 * 16/24, DialogContent 20/24) and the recipe carries one paddingX, one
 * paddingY and one itemSpacing, so the reads are sums along the edges the
 * recipe draws: paddingX = paper padding-left + the title block's
 * padding-left; paddingY = paper padding-top + the title block's
 * padding-top; itemSpacing = the space between the two texts = title
 * block's padding-bottom + body block's padding-top + the paper's row-gap.
 * Every term is a read; the formula is on the line.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";

export interface DialogRoles {
  /** The paper that paints: radius, fill, min-width. */
  paper: string;
  /** The block that holds the title text (its padding is the top inset). Default: the title. */
  titleBlock?: string;
  /** The title text element. */
  title: string;
  /** The block that holds the body text (its padding-top is the gap's lower half). Default: the body. */
  bodyBlock?: string;
  /** The body text element. */
  body: string;
}

export interface DialogSchemaOptions {
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

export const DIALOG_SPELLINGS: Record<string, Spelling> = {};

export function dialogSchemaMappings(roles: DialogRoles, opts: DialogSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const tb = roles.titleBlock ?? roles.title;
  const bb = roles.bodyBlock ?? roles.body;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  return [
    R("paper.paddingX", () => ({
      path: "paper.paddingX",
      kind: "px",
      reads: { pp: { combo, part: roles.paper, channel: "padding-left" }, tp: { combo, part: tb, channel: "padding-left" } },
      formula: "the paper's padding-left plus the title block's (MUI: 0 + 24)",
      combine: (raw) => pxOr0(raw.pp) + (roles.titleBlock ? pxOr0(raw.tp) : 0),
    })),
    R("paper.paddingY", () => ({
      path: "paper.paddingY",
      kind: "px",
      reads: { pp: { combo, part: roles.paper, channel: "padding-top" }, tp: { combo, part: tb, channel: "padding-top" } },
      formula: "the paper's padding-top plus the title block's (MUI: 0 + 16)",
      combine: (raw) => pxOr0(raw.pp) + (roles.titleBlock ? pxOr0(raw.tp) : 0),
    })),
    R("paper.radius", () => ({
      path: "paper.radius",
      kind: "px",
      reads: { r: { combo, part: roles.paper, channel: "border-top-left-radius" }, h: { combo, part: roles.paper, channel: "height" } },
      formula: "border-top-left-radius; a percentage is of the paper's height; clamped to half the height as CSS clamps it",
      combine: (raw) => Number(Math.min(radiusOf(raw.r!, px(raw.h!)), px(raw.h!) / 2).toFixed(3)),
    })),
    R("paper.itemSpacing", () => ({
      path: "paper.itemSpacing",
      kind: "px",
      reads: { rg: { combo, part: roles.paper, channel: "row-gap" }, tb: { combo, part: tb, channel: "padding-bottom" }, bt: { combo, part: bb, channel: "padding-top" }, tm: { combo, part: tb, channel: "margin-bottom" }, bm: { combo, part: bb, channel: "margin-top" } },
      formula: "the space between the title and the body: paper row-gap + title block padding-bottom + margin-bottom + body block padding-top + margin-top (keywords read 0)",
      combine: (raw) => pxOr0(raw.rg) + (roles.titleBlock ? pxOr0(raw.tb) : 0) + pxOr0(raw.tm) + (roles.bodyBlock ? pxOr0(raw.bt) : 0) + pxOr0(raw.bm),
    })),
    R("paper.minWidth", () => one("paper.minWidth", "px", { combo, part: roles.paper, channel: "min-width" }, { formula: "the paper's min-width as a length; `auto`/0 means the paper hugs", combine: (raw) => pxOr0(raw.v) })),
    R("paper.fill", () => one("paper.fill", "color", { combo, part: roles.paper, channel: "background-color" })),
    R("titleFontSize", () => one("titleFontSize", "px", { combo, part: roles.title, channel: "font-size" })),
    R("titleLineHeight", () => one("titleLineHeight", "px", { combo, part: roles.title, channel: "line-height" }, { formula: "the title's line-height as a px length; `normal` is 0 with unit auto", combine: (raw) => pxOr0(raw.v) })),
    R("bodyFontSize", () => one("bodyFontSize", "px", { combo, part: roles.body, channel: "font-size" })),
    R("bodyLineHeight", () => one("bodyLineHeight", "px", { combo, part: roles.body, channel: "line-height" }, { formula: "the body's line-height as a px length; `normal` is 0 with unit auto", combine: (raw) => pxOr0(raw.v) })),
    R("lineHeightUnit", () => one("lineHeightUnit", "string", { combo, part: roles.body, channel: "line-height" }, { formula: "`normal` → auto; a length → px (one unit for both texts, the recipe's shape)", combine: (raw) => (/^-?\d/.test(raw.v!) ? "px" : "auto") })),
    R("title", () => one("title", "color", { combo, part: roles.title, channel: "color" })),
    R("body", () => one("body", "color", { combo, part: roles.body, channel: "color" })),
    R("typography.title.family", () => one("typography.title.family", "string", { combo, part: roles.title, channel: "font-family" }, { formula: "first family of the title's computed stack", combine: firstFam })),
    R("typography.title.style", () => one("typography.title.style", "string", { combo, part: roles.title, channel: "font-weight" }, { formula: "title font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
    R("typography.body.family", () => one("typography.body.family", "string", { combo, part: roles.body, channel: "font-family" }, { formula: "first family of the body's computed stack", combine: firstFam })),
    R("typography.body.style", () => one("typography.body.style", "string", { combo, part: roles.body, channel: "font-weight" }, { formula: "body font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
  ];
}
