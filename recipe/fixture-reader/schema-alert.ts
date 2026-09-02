/**
 * alert@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * ROLES (the shape of schema-checkbox.ts): the box, the status icon (an svg
 * and its one filled path), the title, and the four status combos.
 *
 * The glyph is read from the capture: the path's computed `d` (Chromium's
 * absolute normalisation of the package's path, in the package's own
 * coordinate units) and its fill-rule. The one thing no computed channel
 * carries is the package's viewBox — the asset the capture writes carries
 * the RENDERED size there (recipe/fixtures/capture-glyph.ts) — so
 * `icon.viewBox` is a reviewed leaf with a citation to the package, the same
 * discipline as the hand tables and checkbox@1's glyph file.
 */
import type { FactMapping } from "./reader.js";
import { hex8, num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";

export const ALERT_STATUSES = ["info", "success", "warning", "error"] as const;
export type AlertStatusKey = (typeof ALERT_STATUSES)[number];

export interface AlertRoles {
  /** The painted box: fill, border, radius, padding, height. */
  box: string;
  /** The status icon's svg (icon.size). */
  icon: string;
  /** The svg's one drawn path (glyph d, fill-rule, fill). */
  iconPath: string;
  /** The svg's wrapper when it is not the box (opacity, margin). */
  iconWrap?: string;
  /** The title text element. */
  title: string;
}

export type AlertComboMap = Record<AlertStatusKey, string>;

export interface AlertSchemaOptions {
  combos: AlertComboMap;
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
const isTransparent = (v: string | undefined): boolean => !v || v === "none" || v === "transparent" || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(v);

/** Chromium's computed `d` is `path("M 1 2 …")`; the recipe wants the bare data. */
export const pathData = (d: string): string => {
  const m = /^path\("([^"]*)"\)$/.exec(d.trim());
  if (!m) throw new Error(`the path's computed d is not path("…") (got ${JSON.stringify(d.slice(0, 40))})`);
  return m[1]!;
};

/** "24" → 0 0 24 24; "64 64 896 896" → x y w h. */
export const parseViewBox = (v: string): { x: number; y: number; width: number; height: number } => {
  const n = v.trim().split(/[\s,]+/).map(Number);
  if (n.length === 1 && Number.isFinite(n[0]) && n[0]! > 0) return { x: 0, y: 0, width: n[0]!, height: n[0]! };
  if (n.length === 4 && n.every(Number.isFinite) && n[2]! > 0 && n[3]! > 0) return { x: n[0]!, y: n[1]!, width: n[2]!, height: n[3]! };
  throw new Error(`icon.viewBox must be "<size>" or "<x> <y> <width> <height>" (got ${JSON.stringify(v)})`);
};

export const ALERT_SPELLINGS: Record<string, Spelling> = {
  strokeAlign: "inside",
};

export function alertSchemaMappings(roles: AlertRoles, opts: AlertSchemaOptions): FactMapping[] {
  const c = opts.combos;
  const base = c.info;
  const wrap = roles.iconWrap ?? roles.icon;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const rows: FactMapping[] = [
    R("box.height", () => ({
      path: "box.height",
      kind: "px",
      reads: {
        h: { combo: base, part: roles.box, channel: "height" },
        bs: { combo: base, part: roles.box, channel: "box-sizing" },
        pt: { combo: base, part: roles.box, channel: "padding-top" },
        pb: { combo: base, part: roles.box, channel: "padding-bottom" },
        bt: { combo: base, part: roles.box, channel: "border-top-width" },
        bb: { combo: base, part: roles.box, channel: "border-bottom-width" },
      },
      formula: "the box's border-box height as captured with the one-line title (a content-box height plus its padding and border)",
      combine: (raw) => Number((raw.bs === "border-box" ? px(raw.h!) : px(raw.h!) + pxOr0(raw.pt) + pxOr0(raw.pb) + pxOr0(raw.bt) + pxOr0(raw.bb)).toFixed(3)),
    })),
    R("box.paddingX", () => one("box.paddingX", "px", { combo: base, part: roles.box, channel: "padding-left" })),
    R("box.paddingY", () => one("box.paddingY", "px", { combo: base, part: roles.box, channel: "padding-top" })),
    R("box.radius", () => one("box.radius", "px", { combo: base, part: roles.box, channel: "border-top-left-radius" })),
    R("box.borderWidth", () => one("box.borderWidth", "px", { combo: base, part: roles.box, channel: "border-top-width" })),
    R("box.gap", () => ({
      path: "box.gap",
      kind: "px",
      reads: {
        gap: { combo: base, part: roles.box, channel: "column-gap" },
        mr: { combo: base, part: wrap, channel: "margin-right" },
        ml: { combo: base, part: roles.title, channel: "margin-left" },
      },
      formula: "the space between the icon and the title: box column-gap + icon (wrapper) margin-right + title margin-left (keywords read 0)",
      combine: (raw) => pxOr0(raw.gap) + pxOr0(raw.mr) + pxOr0(raw.ml),
    })),
    R("icon.size", () => one("icon.size", "px", { combo: base, part: roles.icon, channel: "width" })),
    receipt("icon.viewBox", "the package's viewBox is not a computed channel (the capture asset carries the RENDERED size there); give --set icon.viewBox=<size | x y w h> --why with the package citation", "reviewed"),
    R("titleFontSize", () => one("titleFontSize", "px", { combo: base, part: roles.title, channel: "font-size" })),
    R("titleLineHeight", () => one("titleLineHeight", "px", { combo: base, part: roles.title, channel: "line-height" })),
    receipt("strokeAlign", "recipe anatomy spelling — the box's border draws inside", "reviewed inside"),
  ];
  for (const status of ALERT_STATUSES) {
    const combo = c[status];
    rows.push(
      R(`states.${status}.boxFill`, () => one(`states.${status}.boxFill`, "color", { combo, part: roles.box, channel: "background-color" })),
      R(`states.${status}.boxBorder`, () => one(`states.${status}.boxBorder`, "color", { combo, part: roles.box, channel: "border-top-color" })),
      R(`states.${status}.title`, () => one(`states.${status}.title`, "color", { combo, part: roles.title, channel: "color" })),
      R(`states.${status}.iconFill`, () =>
        one(`states.${status}.iconFill`, "color", { combo, part: roles.iconPath, channel: "fill" }, {
          formula: "the glyph path's fill (a stroked-only glyph has no fill and refuses: alert@1 carries filled glyphs)",
          combine: (raw) => {
            if (isTransparent(raw.v)) throw new Error("the glyph path has no fill — a stroked glyph; alert@1 carries filled glyphs only");
            return hex8(raw.v!);
          },
        }),
      ),
      R(`states.${status}.iconOpacity`, () => ({
        path: `states.${status}.iconOpacity`,
        kind: "number",
        reads: { a: { combo, part: roles.icon, channel: "opacity" }, b: { combo, part: wrap, channel: "opacity" } },
        formula: roles.iconWrap ? "the svg's opacity × its wrapper's opacity (MUI dims the wrapper)" : "the svg's opacity",
        combine: (raw) => Number((num(raw.a!) * (roles.iconWrap ? num(raw.b!) : 1)).toFixed(3)),
      })),
      R(`icon.glyphs.${status}.path`, () =>
        one(`icon.glyphs.${status}.path`, "string", { combo, part: roles.iconPath, channel: "d" }, { formula: "the glyph path's computed d, in the package's coordinate units", combine: (raw) => pathData(raw.v!) }),
      ),
      R(`icon.glyphs.${status}.winding`, () =>
        one(`icon.glyphs.${status}.winding`, "string", { combo, part: roles.iconPath, channel: "fill-rule" }, { formula: "the path's fill-rule", combine: (raw) => (raw.v === "evenodd" ? "evenodd" : "nonzero") }),
      ),
    );
  }
  rows.push(
    R("typography.title.family", () => one("typography.title.family", "string", { combo: base, part: roles.title, channel: "font-family" }, { formula: "first family of the title's computed stack", combine: firstFam })),
    R("typography.title.style", () => one("typography.title.style", "string", { combo: base, part: roles.title, channel: "font-weight" }, { formula: "title font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
  );
  return rows;
}

