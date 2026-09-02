/**
 * avatar@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * ROLES (box, label). The box is the painted circle/square; the label is the
 * part carrying the initials (often the box itself: MUI, Altitude; a child
 * for AntD's `.ant-avatar-string`, shadcn's fallback span, Fluent's initials).
 *
 * Radius: a `50%` radius is half the box; a clamped huge length (Tailwind's
 * rounded-full, Fluent's 10000px) is carried as read — Figma clamps a corner
 * radius to half the side exactly as CSS does.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";

export interface AvatarRoles {
  /** The painted box (size, radius, border, fill, opacity). */
  box: string;
  /** The part carrying the initials (colour, font, line-height); defaults to the box. */
  label?: string;
}

export interface AvatarSchemaOptions {
  /** The captured combo the fixture's single rest cell is read from (e.g. "circular", "default.circle"). */
  combo: string;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
export const AVATAR_SPELLINGS: Record<string, Spelling> = {
  strokeAlign: "inside",
};

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;
const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

export function avatarSchemaMappings(roles: AvatarRoles, opts: AvatarSchemaOptions): FactMapping[] {
  const combo = opts.combo;
  const label = roles.label ?? roles.box;
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  return [
    R("box.height", () => one("box.height", "px", { combo, part: roles.box, channel: "height" })),
    R("box.paddingX", () => one("box.paddingX", "px", { combo, part: roles.box, channel: "padding-left" })),
    R("box.paddingY", () => one("box.paddingY", "px", { combo, part: roles.box, channel: "padding-top" })),
    R("box.radius", () => ({
      path: "box.radius",
      kind: "px",
      reads: { r: { combo, part: roles.box, channel: "border-top-left-radius" }, h: { combo, part: roles.box, channel: "height" } },
      formula: "50% → half the box height; a length (including Chromium's clamped exponent form) as read",
      combine: (raw) => (String(raw.r).trim() === "50%" ? px(raw.h) / 2 : px(raw.r)),
    })),
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
