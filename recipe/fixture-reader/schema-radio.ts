/**
 * radio@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * ROLES, the same shape as checkbox@1's (schema-checkbox.ts).
 *
 * radio@1 is list-shaped (two items, Selected = a | b) but a capture mounts
 * ONE radio, so the list leaves (list.gap, listMode) are archetype spellings
 * the fidelity gate never sees (it scores the control child only), and every
 * control leaf is a read: the painted ring (circle), the inner disc (dot — a
 * real part or the ring's pseudo-element, scaled or not), the label, the row
 * that lays them out, and the hit area.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";
import type { Spelling } from "./schema-checkbox.js";

export interface RadioRoles {
  /** The hit area / wrapper (wrapper.size). Often the circle's parent. */
  hit: string;
  /** The painted ring: border, fill, radius, padding. */
  circle: string;
  /**
   * The inner disc, present in the selected combo: a part, or the ring's
   * pseudo-element (`::after`). `paint` names the channel its colour lives in.
   */
  dot?: { part: string; pseudo?: string; paint?: "background-color" | "fill" | "color" };
  /** The label text element. radio@1 has NO bare cell: a mount without one refuses. */
  label: string;
  /** The row that lays out circle + label (gap, align-items). */
  row?: string;
  /** Where the control's opacity is expressed when disabled (default: the circle). */
  opacityOn?: string;
}

/** Fixture state key → captured combo key (without the __interaction suffix). */
export type RadioComboMap = Record<"selected.enabled" | "selected.disabled" | "unselected.enabled" | "unselected.disabled", string>;

export interface RadioSchemaOptions {
  combos: RadioComboMap;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

/** A length that may be a keyword (`normal`, `auto`, `none`) — read as 0. */
const pxOr0 = (v: string): number => (/^-?\d/.test(v) ? px(v) : 0);
/** The uniform scale of a `transform` value: matrix(a,…) → a; none → 1. */
export const scaleOf = (t: string): number => {
  const m = /^matrix\(([-0-9.e]+),/.exec(t);
  return m ? Number(m[1]) : 1;
};
/** The independent CSS `scale` property (Chakra's `.dot` uses it): "0.4" | "0.4 0.4" → 0.4; none → 1. */
export const scalePropOf = (sc: string | undefined): number => {
  if (!sc || sc.trim() === "none") return 1;
  const n = parseFloat(sc);
  return Number.isFinite(n) ? n : 1;
};
/** transform × scale — the two compose (Chromium applies both). */
const totalScale = (raw: Record<string, string | undefined>): number => scaleOf(raw.t ?? "none") * scalePropOf(raw.sc);
/** A radius that may be a percentage of the box: `50%` of 16 → 8. */
const radiusOf = (r: string, size: number): number => (r.trim().endsWith("%") ? (size * parseFloat(r)) / 100 : px(r));

/**
 * ARCHETYPE SPELLINGS — the recipe's own conventions, written without a
 * per-library review: a capture mounts one radio, so the two-item list's gap
 * and direction are the recipe's defaults (a `--set list.gap=… --why` or
 * `--set listMode=… --why` overrides them with evidence); the dot does not
 * render in the unselected states, and transparent is the recipe's spelling
 * of absent.
 */
export const RADIO_SPELLINGS: Record<string, Spelling> = {
  "list.gap": 0,
  listMode: "vertical",
  "states.unselected.enabled.dotFill": "#00000000",
  "states.unselected.disabled.dotFill": "#00000000",
};

const ONE_RADIO = "the capture mounts one radio; the two-item list is the recipe's shape, not a captured part";

export function radioSchemaMappings(roles: RadioRoles, opts: RadioSchemaOptions): FactMapping[] {
  const c = opts.combos;
  const base = c["unselected.enabled"];
  const selected = c["selected.enabled"];
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const dotRead = (combo: string, channel: string) =>
    roles.dot ? { combo, part: roles.dot.part, pseudo: roles.dot.pseudo, channel } : { combo, part: roles.circle, channel };
  const rows: FactMapping[] = [
    receipt("list.gap", ONE_RADIO, "recipe spelling 0 unless reviewed"),
    receipt("listMode", ONE_RADIO, "recipe spelling vertical unless reviewed"),
    R("item.gap", () =>
      roles.row
        ? {
            path: "item.gap",
            kind: "px",
            reads: {
              gap: { combo: base, part: roles.row, channel: "column-gap" },
              pl: { combo: base, part: roles.label, channel: "padding-left" },
              ml: { combo: base, part: roles.label, channel: "margin-left" },
              mr: { combo: base, part: roles.hit, channel: "margin-right" },
            },
            formula: "the space between the control and the label: row column-gap + label padding-left + label margin-left + hit margin-right (keywords read 0)",
            combine: (raw) => pxOr0(raw.gap!) + pxOr0(raw.pl!) + pxOr0(raw.ml!) + pxOr0(raw.mr!),
          }
        : receipt("item.gap", "no row lays out the circle and the label", "reviewed"),
    ),
    R("wrapper.size", () => one("wrapper.size", "px", { combo: base, part: roles.hit, channel: "width" })),
    R("circle.size", () => one("circle.size", "px", { combo: base, part: roles.circle, channel: "width" })),
    R("circle.radius", () => ({
      path: "circle.radius",
      kind: "px",
      reads: { r: { combo: base, part: roles.circle, channel: "border-top-left-radius" }, w: { combo: base, part: roles.circle, channel: "width" } },
      formula: "border-top-left-radius; a percentage is of the circle's width (50% of 16 = 8); clamped to half the width as CSS clamps it (9999px on a 20px ring paints 10)",
      combine: (raw) => Number(Math.min(radiusOf(raw.r!, px(raw.w!)), px(raw.w!) / 2).toFixed(3)),
    })),
    R("circle.borderWidth", () => one("circle.borderWidth", "px", { combo: base, part: roles.circle, channel: "border-top-width" })),
    R("circle.padding", () => one("circle.padding", "px", { combo: base, part: roles.circle, channel: "padding-top" })),
    R("dot.size", () =>
      roles.dot
        ? {
            path: "dot.size",
            kind: "px",
            reads: { w: dotRead(selected, "width"), t: dotRead(selected, "transform"), sc: dotRead(selected, "scale") },
            formula: "the dot's width × its transform scale × its `scale` property (a disc is often sized full and scaled down: matrix(s,0,0,s,…) → s; scale: 0.4 → 0.4)",
            combine: (raw) => Number((px(raw.w!) * totalScale(raw)).toFixed(3)),
          }
        : receipt("dot.size", "no inner disc part or pseudo-element renders in the selected combo", "reviewed"),
    ),
    R("dot.radius", () =>
      roles.dot
        ? {
            path: "dot.radius",
            kind: "px",
            reads: { r: dotRead(selected, "border-top-left-radius"), w: dotRead(selected, "width"), t: dotRead(selected, "transform"), sc: dotRead(selected, "scale") },
            formula: "the dot's radius (a percentage is of its painted width) × its transform and `scale` scales, clamped to half the painted size as CSS clamps it (a 16px radius on a 6px disc paints a 3px one)",
            combine: (raw) => {
              const s = totalScale(raw);
              const painted = px(raw.w!) * s;
              const r = raw.r!.trim().endsWith("%") ? radiusOf(raw.r!, painted) : px(raw.r!) * s;
              return Number(Math.min(r, painted / 2).toFixed(3));
            },
          }
        : receipt("dot.radius", "no inner disc part or pseudo-element renders in the selected combo", "reviewed"),
    ),
    R("labelFontSize", () => one("labelFontSize", "px", { combo: base, part: roles.label, channel: "font-size" })),
    R("labelLineHeight", () =>
      one("labelLineHeight", "px", { combo: base, part: roles.label, channel: "line-height" }, {
        formula: "the label's line-height as a px length; `normal` is 0 with unit auto",
        combine: (raw) => pxOr0(raw.v!),
      }),
    ),
    R("labelLineHeightUnit", () =>
      one("labelLineHeightUnit", "string", { combo: base, part: roles.label, channel: "line-height" }, {
        formula: "`normal` → auto (hug the face); a length → px",
        combine: (raw) => (/^-?\d/.test(raw.v!) ? "px" : "auto"),
      }),
    ),
    R("itemAlign", () =>
      roles.row
        ? one("itemAlign", "string", { combo: base, part: roles.row, channel: "align-items" }, {
            formula: "the row's align-items: center → center; baseline → center (Figma's BASELINE aligns to the circle frame's bottom edge, not the text baseline — the recipe's named lowering); normal/stretch → center (the label box fills the row and its text sits on its own line box)",
            combine: (raw) => {
              const v = raw.v!.trim();
              if (v === "center" || v === "baseline" || v === "normal" || v === "stretch") return "center";
              throw new Error(`align-items ${JSON.stringify(v)} has no radio@1 itemAlign lowering`);
            },
          })
        : receipt("itemAlign", "no row lays out the circle and the label", "reviewed"),
    ),
  ];
  for (const fix of Object.keys(c) as Array<keyof RadioComboMap>) {
    const combo = c[fix];
    const opacityPart = roles.opacityOn ?? roles.circle;
    rows.push(
      R(`states.${fix}.circleFill`, () => one(`states.${fix}.circleFill`, "color", { combo, part: roles.circle, channel: "background-color" })),
      R(`states.${fix}.circleBorder`, () => one(`states.${fix}.circleBorder`, "color", { combo, part: roles.circle, channel: "border-top-color" })),
      R(`states.${fix}.circleOpacity`, () => one(`states.${fix}.circleOpacity`, "number", { combo, part: opacityPart, channel: "opacity" })),
      R(`states.${fix}.label`, () => one(`states.${fix}.label`, "color", { combo, part: roles.label, channel: "color" })),
    );
    if (fix.startsWith("selected")) {
      rows.push(
        R(`states.${fix}.dotFill`, () =>
          roles.dot
            ? one(`states.${fix}.dotFill`, "color", dotRead(combo, roles.dot.paint ?? "background-color"), { formula: `the dot's paint (${roles.dot.paint ?? "background-color"})` })
            : receipt(`states.${fix}.dotFill`, "no inner disc part or pseudo-element renders in the selected combo", "reviewed"),
        ),
      );
    } else {
      rows.push(receipt(`states.${fix}.dotFill`, "the dot does not render in the unselected state; transparent is the recipe's spelling of absent", `no dot at combo ${combo} — reviewed #00000000`));
    }
  }
  rows.push(
    R("typography.label.family", () =>
      one("typography.label.family", "string", { combo: base, part: roles.label, channel: "font-family" }, { formula: "first family of the label's computed stack", combine: firstFam }),
    ),
    R("typography.label.style", () =>
      one("typography.label.style", "string", { combo: base, part: roles.label, channel: "font-weight" }, { formula: "label font-weight → style word", combine: (raw) => styleForWeight(num(raw.v!)) }),
    ),
  );
  return rows;
}
