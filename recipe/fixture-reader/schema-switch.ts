/**
 * switch@1 READER SCHEMA — the archetype's fixture leaves as ledger reads over
 * ROLES (hit, track, thumb, travelOn, label, row).
 *
 * The three hand-written switch tables disagree on one point in a way that is
 * actually structural: MUI's track is a SIBLING of the thumb, so its CSS
 * opacity must be baked into the fill or the thumb would dim on the canvas;
 * Astryx's thumb is a CHILD of the track, so the track's opacity dims both in
 * CSS and should be carried as trackOpacity. That is decided here from the
 * roles (is the thumb inside the track?), not per library.
 *
 * Travel: the thumb's translation between off and on. Read from the transform
 * of `travelOn` (MUI: the SwitchBase moves; Astryx: the thumb moves). When no
 * transform carries it (AntD positions the handle by inset), it is the
 * difference of the thumb's `left` between on and off, and when that is not a
 * channel either it refuses and asks for the arithmetic.
 */
import type { FactMapping } from "./reader.js";
import { matrix, num, px } from "./ledger.js";
import { firstFam, inkTimesOpacity, styleForWeight } from "./mappings-util.js";
import { BARE_LABEL_COLOR, BARE_LABEL_FONT_SIZE, bareLabelFont } from "../recipes/switch.js";

export interface SwitchRoles {
  /** The wrapper / hit area (wrapper.*). */
  hit: string;
  /** The pill (track.*, trackFill). */
  track: string;
  /** The knob (thumb sizes, thumbFill, thumbShadow). */
  thumb: string;
  /** When the knob is painted by a pseudo-element of `thumb` (AntD's handle::before). */
  thumbPseudo?: string;
  /** When no transform moves, the inset channel whose on−off difference is the travel. */
  travelInset?: "left" | "inset-inline-start";
  /** The element whose transform carries the on-state travel (often the thumb, MUI: the switch base). */
  travelOn?: string;
  /** "transform" (matrix tx, default) or "translate" (the CSS translate property, Tailwind's translate-x-*). */
  travelChannel?: "transform" | "translate";
  /** Whether `thumb` is a descendant of `track` — decides where opacity lives. */
  thumbInsideTrack: boolean;
  label?: string;
  row?: string;
}

export type SwitchComboMap = Record<"false.enabled" | "false.disabled" | "true.enabled" | "true.disabled", string>;

export interface SwitchSchemaOptions {
  combos: SwitchComboMap;
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
export const SWITCH_SPELLINGS: Record<string, Spelling> = {
  rowAlign: "center",
  trackClips: "false",
  hitClips: "false",
  // Sibling-thumb libraries bake the track's CSS opacity into trackFill, so
  // the carried opacity is the recipe's spelling 1 (never a library fact).
  "states.false.enabled.trackOpacity": 1,
  "states.false.disabled.trackOpacity": 1,
  "states.true.enabled.trackOpacity": 1,
  "states.true.disabled.trackOpacity": 1,
};

/**
 * BARE-CELL SPELLINGS — merged over SWITCH_SPELLINGS only when the role map has
 * no label (MUI's Switch, shadcn's): switch@1's label-less cell compiles no
 * label node, so every label leaf is the recipe's inert spelling. Kept apart
 * so a labelled library whose label read fails still refuses.
 */
const BARE_FONT = bareLabelFont();
export const BARE_SWITCH_SPELLINGS: Record<string, Spelling> = {
  labelFontSize: BARE_LABEL_FONT_SIZE,
  "row.gap": 0,
  "typography.label.family": BARE_FONT.requestedFamily,
  "typography.label.style": BARE_FONT.requestedStyle,
};
for (const fix of ["false.enabled", "false.disabled", "true.enabled", "true.disabled"]) BARE_SWITCH_SPELLINGS[`states.${fix}.label`] = BARE_LABEL_COLOR;
export const switchSpellingsFor = (roles: Pick<SwitchRoles, "label">): Record<string, Spelling> =>
  roles.label ? SWITCH_SPELLINGS : { ...SWITCH_SPELLINGS, ...BARE_SWITCH_SPELLINGS };

/**
 * x translation of a computed transform ("matrix(…)") or translate ("12px 0px",
 * or Tailwind's "calc(100% - 2px) 0px" — a percentage of the moving element's
 * OWN width, so `ref` is that width) value; none → 0.
 */
const txOf = (v: string, ref = 0): number => {
  if (v === "none" || !v) return 0;
  if (v.startsWith("matrix")) return matrix(v).tx;
  const t = v.trim();
  if (t.startsWith("calc(")) {
    const inner = t.slice(5, t.indexOf(")"));
    let sum = 0;
    for (const m of inner.matchAll(/([+-]?)\s*(-?\d+(?:\.\d+)?)(%|px)/g)) {
      const sign = m[1] === "-" ? -1 : 1;
      const n = Number(m[2]);
      sum += sign * (m[3] === "%" ? (n / 100) * ref : n);
    }
    return sum;
  }
  return px(t.split(/\s+/)[0]!);
};

/** A CSS `scale` channel ("0.8", "none", "1 1") → the uniform factor; none → 1. */
const scaleOf = (v: string | undefined): number => {
  if (!v || v === "none") return 1;
  const n = Number(v.trim().split(/\s+/)[0]);
  if (!Number.isFinite(n)) throw new Error(`not a scale: "${v}"`);
  return n;
};
/** Multiply every px length of a box-shadow list by `k` (a shadow on a scaled element scales with it). */
const scaleShadow = (v: string, k: number): string => (k === 1 || v === "none" ? v : v.replace(/(-?\d+(?:\.\d+)?)px/g, (_, n) => `${Math.round(Number(n) * k * 1e4) / 1e4}px`));

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;
const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

export function switchSchemaMappings(roles: SwitchRoles, opts: SwitchSchemaOptions): FactMapping[] {
  const c = opts.combos;
  const off = c["false.enabled"], on = c["true.enabled"];
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const NO_LABEL = "no label part in the mount";
  const rows: FactMapping[] = [
    R("wrapper.width", () => one("wrapper.width", "px", { combo: off, part: roles.hit, channel: "width" })),
    R("wrapper.height", () => one("wrapper.height", "px", { combo: off, part: roles.hit, channel: "height" })),
    R("wrapper.padding", () => one("wrapper.padding", "px", { combo: off, part: roles.hit, channel: "padding-left" })),
    R("track.width", () => one("track.width", "px", { combo: off, part: roles.track, channel: "width" })),
    R("track.height", () => one("track.height", "px", { combo: off, part: roles.track, channel: "height" })),
    R("track.radius", () => one("track.radius", "px", { combo: off, part: roles.track, channel: "border-top-left-radius" })),
    // The thumb's inset from the track edge. A track that positions its thumb
    // by inset (AntD: handle left 2px) carries it there, not as CSS padding.
    R("track.padding", () =>
      roles.thumbInsideTrack && roles.travelInset
        ? one("track.padding", "px", { combo: off, part: roles.thumb, channel: roles.travelInset }, { formula: "the thumb's inset from the track edge in the off state (positioned by inset, not padding)" })
        : ({
            // The thumb's inset from the track's OUTER edge: CSS lays the
            // content box out after the border, so a transparent border
            // (shadcn's `border border-transparent`) insets the thumb exactly
            // like padding does. padding-left + border-left-width.
            path: "track.padding",
            kind: "px",
            reads: { p: { combo: off, part: roles.track, channel: "padding-left" }, b: { combo: off, part: roles.track, channel: "border-left-width" }, w: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "width" }, s: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "scale" } },
            formula: "track padding-left + border-left-width (the content box starts after the border) + the margin a CSS-scaled thumb leaves: width × (1 − scale) / 2",
            combine: (raw) => px(raw.p) + px(raw.b) + (px(raw.w) * (1 - scaleOf(raw.s))) / 2,
          } as FactMapping),
    ),
    // A thumb drawn at `scale` (Chakra: 20px × 0.8) paints at width × scale.
    R("thumb.offSize", () => ({ path: "thumb.offSize", kind: "px", reads: { v: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "width" }, s: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "scale" } }, formula: "thumb width × its CSS scale (none → 1)", combine: (raw) => px(raw.v) * scaleOf(raw.s) })),
    R("thumb.onSize", () => ({ path: "thumb.onSize", kind: "px", reads: { v: { combo: on, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "width" }, s: { combo: on, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "scale" } }, formula: "thumb width × its CSS scale (none → 1)", combine: (raw) => px(raw.v) * scaleOf(raw.s) })),
    R("thumb.travel", () =>
      roles.travelOn
        ? ({
            path: "thumb.travel",
            kind: "px",
            reads: { on: { combo: on, part: roles.travelOn, channel: roles.travelChannel ?? "transform" }, off: { combo: off, part: roles.travelOn, channel: roles.travelChannel ?? "transform" }, w: { combo: on, part: roles.travelOn, channel: "width" } },
            formula: `${roles.travelChannel ?? "transform"} x of the moving element on minus off (a calc() percentage is of the moving element's own width)`,
            combine: (raw) => txOf(raw.on, px(raw.w)) - txOf(raw.off, px(raw.w)),
          } as FactMapping)
        : {
            path: "thumb.travel",
            kind: "px",
            reads: { on: { combo: on, part: roles.thumb, channel: roles.travelInset ?? "left" }, off: { combo: off, part: roles.thumb, channel: roles.travelInset ?? "left" } },
            formula: `thumb ${roles.travelInset ?? "left"} on minus off (no moving transform)`,
            combine: (raw) => px(raw.on) - px(raw.off),
          },
    ),
    R("row.gap", () => (roles.row ? one("row.gap", "px", { combo: off, part: roles.row, channel: "column-gap" }) : receipt("row.gap", NO_LABEL, "reviewed 0"))),
  ];
  for (const fix of Object.keys(c) as Array<keyof SwitchComboMap>) {
    const combo = c[fix];
    if (roles.thumbInsideTrack) {
      rows.push(
        R(`states.${fix}.trackFill`, () => one(`states.${fix}.trackFill`, "color", { combo, part: roles.track, channel: "background-color" })),
        R(`states.${fix}.trackOpacity`, () => one(`states.${fix}.trackOpacity`, "number", { combo, part: roles.track, channel: "opacity" }, { formula: "the thumb sits inside the track, so the track's CSS opacity dims both and is carried as-is" })),
      );
    } else {
      rows.push(
        R(`states.${fix}.trackFill`, () => ({
          path: `states.${fix}.trackFill`,
          kind: "color",
          reads: { c: { combo, part: roles.track, channel: "background-color" }, o: { combo, part: roles.track, channel: "opacity" } },
          formula: "the thumb is a sibling of the track, so the track's CSS opacity is baked into its fill (the thumb stays opaque)",
          combine: inkTimesOpacity,
        })),
        receipt(`states.${fix}.trackOpacity`, "baked into trackFill because the thumb is a sibling — spelled 1", "reviewed 1"),
      );
    }
    rows.push(
      R(`states.${fix}.thumbFill`, () => one(`states.${fix}.thumbFill`, "color", { combo, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "background-color" })),
      R(`states.${fix}.label`, () => (roles.label ? one(`states.${fix}.label`, "color", { combo, part: roles.label, channel: "color" }) : receipt(`states.${fix}.label`, NO_LABEL, "reviewed"))),
    );
  }
  rows.push(
    R("labelFontSize", () => (roles.label ? one("labelFontSize", "px", { combo: off, part: roles.label, channel: "font-size" }) : receipt("labelFontSize", NO_LABEL, "reviewed"))),
    receipt("rowAlign", "flex align-items:center on the row — recipe spelling", "reviewed center"),
    R("thumbShadow", () => ({ path: "thumbShadow", kind: "string", reads: { v: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "box-shadow" }, s: { combo: off, part: roles.thumb, pseudo: roles.thumbPseudo, channel: "scale" } }, formula: "the thumb's box-shadow with every length × its CSS scale (a shadow on a scaled element scales with it)", combine: (raw) => scaleShadow(raw.v, scaleOf(raw.s)) })),
    R("hitClips", () => one("hitClips", "string", { combo: off, part: roles.hit, channel: "overflow-x" }, { formula: "overflow hidden on the hit → clips", combine: (raw) => String(raw.v === "hidden" || raw.v === "clip") })),
    R("trackClips", () => one("trackClips", "string", { combo: off, part: roles.track, channel: "overflow-x" }, { formula: "overflow hidden on the track → clips", combine: (raw) => String(raw.v === "hidden" || raw.v === "clip") })),
    R("typography.label.family", () => (roles.label ? one("typography.label.family", "string", { combo: off, part: roles.label, channel: "font-family" }, { combine: firstFam }) : receipt("typography.label.family", NO_LABEL, "reviewed"))),
    R("typography.label.style", () => (roles.label ? one("typography.label.style", "string", { combo: off, part: roles.label, channel: "font-weight" }, { combine: (raw) => styleForWeight(num(raw.v)) }) : receipt("typography.label.style", NO_LABEL, "reviewed"))),
  );
  return rows;
}
