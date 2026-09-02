/**
 * tabs@1 READER SCHEMA — leaves as ledger reads over ROLES: the selected tab,
 * a rest tab, their label parts, the list, and the INDICATOR — which is
 * either a part of its own (MUI's absolute bar) or the selected tab's own
 * bottom border (Carbon). A library with neither refuses by name.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";

export interface TabsRoles {
  list: string;
  selectedTab: string;
  restTab: string;
  /** The text part inside the selected tab when it is not the tab itself. */
  selectedLabel?: string;
  restLabel?: string;
  /** A distinct indicator part (MUI's MuiTabs-indicator). */
  indicator?: string;
  /** No part: the indicator is the selected tab's bottom border (Carbon). */
  indicatorIsBorder?: boolean;
}

export interface TabsSchemaOptions {
  combo: string;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
// Spellings used only when the indicator is the selected tab's bottom border
// (the mappings above are receipts then; with an indicator part they are reads).
export const TABS_SPELLINGS: Record<string, Spelling> = {
  "indicator.radius": 0,
  "indicator.opacity": 1,
  "indicator.insetX": 0,
  "indicator.offsetY": 0,
};

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;
const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });
/** A length channel that may be a keyword: auto/normal/none → 0. */
const pxOrZero = (v: string): number => (/^(auto|normal|none)$/.test(v.trim()) ? 0 : px(v));

export function tabsSchemaMappings(roles: TabsRoles, opts: TabsSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const sel = roles.selectedTab, rest = roles.restTab;
  const selLabel = roles.selectedLabel ?? sel, restLabel = roles.restLabel ?? rest;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const ind = (path: string, kind: "px" | "number" | "color", channel: string, borderChannel: string | number | null, formula: string): FactMapping =>
    R(path, () =>
      roles.indicator
        ? one(path, kind, { combo, part: roles.indicator, channel })
        : typeof borderChannel === "string"
          ? one(path, kind, { combo, part: sel, channel: borderChannel }, { formula })
          : receipt(path, formula, `reviewed ${borderChannel}`),
    );
  return [
    R("list.itemSpacing", () => one("list.itemSpacing", "px", { combo, part: roles.list, channel: "column-gap" }, { formula: "the list's column-gap; normal → 0", combine: (raw) => pxOrZero(raw.v) })),
    R("tab.paddingX", () => one("tab.paddingX", "px", { combo, part: sel, channel: "padding-left" })),
    R("tab.paddingY", () => one("tab.paddingY", "px", { combo, part: sel, channel: "padding-top" })),
    R("tab.radius", () => one("tab.radius", "px", { combo, part: sel, channel: "border-top-left-radius" })),
    R("tab.minWidth", () => one("tab.minWidth", "px", { combo, part: sel, channel: "min-width" }, { formula: "min-width; auto → 0", combine: (raw) => pxOrZero(raw.v) })),
    // A tab's fixed CSS height is its minimum height too (Carbon sets height:
    // 40px and no min-height; MUI sets both to 48): the larger of the two.
    R("tab.minHeight", () => ({ path: "tab.minHeight", kind: "px", reads: { m: { combo, part: sel, channel: "min-height" }, h: { combo, part: sel, channel: "height" } }, formula: "max(min-height, a fixed height); auto → 0", combine: (raw) => Math.max(pxOrZero(raw.m), pxOrZero(raw.h)) })),
    R("tab.fill", () => one("tab.fill", "color", { combo, part: sel, channel: "background-color" })),
    R("tab.contentAlign", () => one("tab.contentAlign", "string", { combo, part: sel, channel: "justify-content" }, { formula: "justify-content center → center, else start", combine: (raw) => (raw.v === "center" ? "center" : "start") })),
    ind("indicator.height", "px", "height", "border-bottom-width", "the indicator is the selected tab's bottom border: its width is the indicator height"),
    ind("indicator.radius", "px", "border-top-left-radius", 0, "a border has no radius of its own — 0"),
    ind("indicator.opacity", "number", "opacity", 1, "a border paints at the tab's opacity — 1"),
    ind("indicator.fill", "color", "background-color", "border-bottom-color", "the selected tab's bottom border colour is the indicator fill"),
    ind("indicator.insetX", "px", "left", 0, "a border spans the tab — inset 0"),
    ind("indicator.offsetY", "px", "bottom", 0, "a border sits on the tab's bottom edge — offset 0"),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: selLabel, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: selLabel, channel: "line-height" }, { formula: "CSS normal → 0 with lineHeightUnit auto; a length → px", combine: (raw) => (raw.v === "normal" ? 0 : px(raw.v)) })),
    R("lineHeightUnit", () => one("lineHeightUnit", "string", { combo, part: selLabel, channel: "line-height" }, { formula: "CSS normal → auto; a length → px", combine: (raw) => (raw.v === "normal" ? "auto" : "px") })),
    R("labelLetterSpacing", () => one("labelLetterSpacing", "px", { combo, part: selLabel, channel: "letter-spacing" }, { formula: "letter-spacing; normal → 0", combine: (raw) => pxOrZero(raw.v) })),
    R("textCase", () => one("textCase", "string", { combo, part: selLabel, channel: "text-transform" }, { formula: "text-transform uppercase → upper, else original", combine: (raw) => (raw.v === "uppercase" ? "upper" : "original") })),
    R("rest.label", () => one("rest.label", "color", { combo, part: restLabel, channel: "color" })),
    R("selected.label", () => one("selected.label", "color", { combo, part: selLabel, channel: "color" })),
    R("typography.rest.family", () => one("typography.rest.family", "string", { combo, part: restLabel, channel: "font-family" }, { combine: firstFam })),
    R("typography.rest.style", () => one("typography.rest.style", "string", { combo, part: restLabel, channel: "font-weight" }, { combine: (raw) => styleForWeight(num(raw.v)) })),
    R("typography.selected.family", () => one("typography.selected.family", "string", { combo, part: selLabel, channel: "font-family" }, { combine: firstFam })),
    R("typography.selected.style", () => one("typography.selected.style", "string", { combo, part: selLabel, channel: "font-weight" }, { combine: (raw) => styleForWeight(num(raw.v)) })),
  ];
}
