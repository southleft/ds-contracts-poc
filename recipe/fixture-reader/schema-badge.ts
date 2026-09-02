/**
 * badge@1 READER SCHEMA — an anchored overlay badge (a host with a count pip
 * docked at its top-right) as ledger reads over ROLES, the shape of
 * schema-checkbox.ts. One cell: badge@1 has a single default variant.
 *
 * Two lowerings are read, not reviewed: the pip's offset from the docked
 * corner is its transform translation MINUS the inset the library anchors it
 * at (MUI's circular overlap anchors 14% inside the host, so tx − right and
 * ty + top; AntD's inset is 0 and the same read gives the transform alone),
 * and a ring drawn as a zero-offset, zero-blur OUTSET box-shadow (AntD's
 * white ring) is the pip's border with the stroke outside.
 */
import type { FactMapping } from "./reader.js";
import { hex8, matrix, num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";

export interface BadgeRoles {
  /** The host the pip is anchored on (size, radius, fill). */
  host: string;
  /** The pip: height, min-width, padding, radius, border/ring, fill, opacity, transform. */
  indicator: string;
  /** The part carrying the count text, when it is not the pip itself. */
  label?: string;
}

export interface BadgeSchemaOptions {
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

/** A zero-offset, zero-blur, positive-spread outset shadow: `<color> 0px 0px 0px <spread>px` → the ring. */
export const outsetRing = (shadow: string): { color: string; spread: number } | null => {
  if (!shadow || shadow.trim() === "none" || /inset/.test(shadow)) return null;
  const m = /^(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-z]+)\s+0px\s+0px\s+0px\s+(-?[\d.]+)px\s*$/.exec(shadow.trim());
  if (!m || Number(m[2]) <= 0) return null;
  return { color: m[1]!, spread: Number(m[2]) };
};

export const BADGE_SPELLINGS: Record<string, Spelling> = {};

export function badgeSchemaMappings(roles: BadgeRoles, opts: BadgeSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const label = roles.label ?? roles.indicator;
  const pip = roles.indicator;
  return [
    R("host.size", () => one("host.size", "px", { combo, part: roles.host, channel: "height" })),
    R("host.radius", () => ({
      path: "host.radius",
      kind: "px",
      reads: { r: { combo, part: roles.host, channel: "border-top-left-radius" }, h: { combo, part: roles.host, channel: "height" } },
      formula: "border-top-left-radius; a percentage is of the host's size (50% of 40 = 20)",
      combine: (raw) => Number(radiusOf(raw.r!, px(raw.h!)).toFixed(3)),
    })),
    R("host.fill", () => one("host.fill", "color", { combo, part: roles.host, channel: "background-color" })),
    R("indicator.height", () => one("indicator.height", "px", { combo, part: pip, channel: "height" })),
    R("indicator.minWidth", () => one("indicator.minWidth", "px", { combo, part: pip, channel: "min-width" })),
    R("indicator.paddingX", () => one("indicator.paddingX", "px", { combo, part: pip, channel: "padding-left" })),
    R("indicator.radius", () => ({
      path: "indicator.radius",
      kind: "px",
      reads: { r: { combo, part: pip, channel: "border-top-left-radius" }, h: { combo, part: pip, channel: "height" } },
      formula: "border-top-left-radius; a percentage is of the pip's height; clamped to half the height as CSS clamps it",
      combine: (raw) => Number(Math.min(radiusOf(raw.r!, px(raw.h!)), px(raw.h!) / 2).toFixed(3)),
    })),
    R("indicator.borderWidth", () => ({
      path: "indicator.borderWidth",
      kind: "px",
      reads: { bw: { combo, part: pip, channel: "border-top-width" }, sh: { combo, part: pip, channel: "box-shadow" } },
      formula: "the pip's border-top-width, or the spread of a zero-offset zero-blur outset box-shadow ring when there is no border (AntD's white ring)",
      combine: (raw) => {
        const bw = pxOr0(raw.bw);
        if (bw > 0) return bw;
        const ring = outsetRing(raw.sh ?? "none");
        return ring ? ring.spread : 0;
      },
    })),
    R("indicator.translateX", () => ({
      path: "indicator.translateX",
      kind: "px",
      reads: { t: { combo, part: pip, channel: "transform" }, right: { combo, part: pip, channel: "right" } },
      formula: "the pip's transform tx minus its `right` inset — the offset from the docked top-right corner (MUI's circular overlap anchors 14% inside the host; an inset of 0 leaves the transform alone)",
      combine: (raw) => Number(((/^matrix/.test(raw.t!) ? matrix(raw.t!).tx : 0) - pxOr0(raw.right)).toFixed(3)),
    })),
    R("indicator.translateY", () => ({
      path: "indicator.translateY",
      kind: "px",
      reads: { t: { combo, part: pip, channel: "transform" }, top: { combo, part: pip, channel: "top" } },
      formula: "the pip's transform ty plus its `top` inset — the offset from the docked top-right corner",
      combine: (raw) => Number(((/^matrix/.test(raw.t!) ? matrix(raw.t!).ty : 0) + pxOr0(raw.top)).toFixed(3)),
    })),
    R("indicator.fill", () => one("indicator.fill", "color", { combo, part: pip, channel: "background-color" })),
    R("indicator.border", () => ({
      path: "indicator.border",
      kind: "color",
      reads: { bw: { combo, part: pip, channel: "border-top-width" }, bc: { combo, part: pip, channel: "border-top-color" }, sh: { combo, part: pip, channel: "box-shadow" } },
      formula: "the border colour when the pip has a border; the ring colour when it draws a zero-offset outset shadow ring; transparent when neither (the recipe's spelling of no ring)",
      combine: (raw) => {
        if (pxOr0(raw.bw) > 0) return hex8(raw.bc!);
        const ring = outsetRing(raw.sh ?? "none");
        return ring ? hex8(ring.color) : "#00000000";
      },
    })),
    R("indicator.opacity", () => one("indicator.opacity", "number", { combo, part: pip, channel: "opacity" })),
    R("labelFontSize", () => one("labelFontSize", "px", { combo, part: label, channel: "font-size" })),
    R("labelLineHeight", () => one("labelLineHeight", "px", { combo, part: label, channel: "line-height" })),
    R("label", () => one("label", "color", { combo, part: label, channel: "color" })),
    R("strokeAlign", () => ({
      path: "strokeAlign",
      kind: "string",
      reads: { bw: { combo, part: pip, channel: "border-top-width" }, sh: { combo, part: pip, channel: "box-shadow" } },
      formula: "outside when the ring is a box-shadow (it paints outside the pip's box); inside otherwise — recipe anatomy",
      combine: (raw) => (pxOr0(raw.bw) === 0 && outsetRing(raw.sh ?? "none") ? "outside" : "inside"),
    })),
    R("typography.label.family", () => one("typography.label.family", "string", { combo, part: label, channel: "font-family" }, { formula: "first family of the count's computed stack", combine: firstFam })),
    R("typography.label.style", () => one("typography.label.style", "string", { combo, part: label, channel: "font-weight" }, { formula: "count font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) })),
  ];
}
