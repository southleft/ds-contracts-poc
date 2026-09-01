/**
 * checkbox@1 READER SCHEMA — the archetype's fixture leaves expressed as
 * ledger reads over ROLES, not over one library's class names.
 *
 * The three hand-written mapping tables (mappings-checkbox.ts) read the same
 * facts from three different DOMs: MUI's box is an SVG path, AntD's is
 * `.ant-checkbox-inner`, Astryx's is `.astryx-checkbox`. What differs per
 * library is WHICH PART plays which role, and that is a small, reviewable
 * table (`CheckboxRoles`). Everything else — which channel of the box is the
 * radius, which combo carries the checked fill — is the archetype's, and is
 * written once here.
 *
 * `checkboxSchemaMappings(roles)` yields a FactMapping[] the existing reader
 * runs unchanged, and the proposer (propose-fixture.ts) evaluates the same
 * list to WRITE a fixture instead of only checking one.
 */
import type { FactMapping } from "./reader.js";
import { num, px } from "./ledger.js";
import { firstFam, styleForWeight } from "./mappings-util.js";

export interface CheckboxRoles {
  /** The hit area / wrapper (wrapper.size). Often the root. */
  hit: string;
  /** The painted square: border, fill, radius, padding. */
  box: string;
  /** The check glyph's SVG element (check.width/height). */
  glyph: string;
  /** The glyph's drawn element (path/polyline): stroke, stroke-width. */
  glyphPath: string;
  /** The indeterminate mark element, when it is a distinct part. */
  dash?: { part: string; pseudo?: string };
  /** The label text element. */
  label: string;
  /** The row that lays out box + label (gap, align-items). */
  row: string;
  /** Where the box's opacity is expressed when disabled (default: the box). */
  opacityOn?: string;
}

/** Fixture state key → captured combo key (without the __interaction suffix). */
export type CheckboxComboMap = Record<
  | "unchecked.enabled"
  | "unchecked.disabled"
  | "checked.enabled"
  | "checked.disabled"
  | "indeterminate.enabled"
  | "indeterminate.disabled",
  string
>;

export const IDENTITY_COMBOS: CheckboxComboMap = {
  "unchecked.enabled": "unchecked.enabled",
  "unchecked.disabled": "unchecked.disabled",
  "checked.enabled": "checked.enabled",
  "checked.disabled": "checked.disabled",
  "indeterminate.enabled": "indeterminate.enabled",
  "indeterminate.disabled": "indeterminate.disabled",
};

export interface CheckboxSchemaOptions {
  combos?: CheckboxComboMap;
  /** How the glyph paints: a stroked path reads stroke-width; a filled path reads 0. */
  glyphPaint?: "stroke" | "fill";
  /**
   * The glyph's viewBox side in the package's units. An SVG stroke-width is
   * a user-space length, so the rendered stroke is stroke-width × (rendered
   * width / viewBox). Without it the raw number is taken as px (MUI's 24 = 24).
   */
  glyphViewBox?: number;
  /**
   * Leaves the ledger cannot carry for this library, with the reviewed
   * evidence that stands in. The proposer refuses to invent a value for a
   * leaf that is neither readable nor listed here.
   */
  receipts?: Partial<Record<string, { why: string; evidence: string }>>;
}

const one = (
  path: string,
  kind: "px" | "number" | "color" | "string",
  read: { combo: string; part: string; pseudo?: string; channel: string },
  extra?: Partial<FactMapping>,
): FactMapping => ({ path, kind, reads: { v: read }, ...extra }) as FactMapping;

const receipt = (path: string, why: string, evidence: string): FactMapping => ({ path, receipt: why, evidence });

/**
 * ARCHETYPE SPELLINGS — values that are the recipe's own convention rather
 * than a library fact, so the proposer may write them without a per-library
 * review: an absent indeterminate mark is transparent; an absent check glyph
 * carries the checked state's glyph colour in its slot; a flex-centred glyph
 * has offset 0. Each is named here once instead of being typed 4×3 times.
 */
export type Spelling = number | string | ((leaves: Record<string, number | string>) => number | string);
export const CHECKBOX_SPELLINGS: Record<string, Spelling> = {
  "check.offsetX": 0,
  "check.offsetY": 0,
};
for (const fix of ["unchecked.enabled", "unchecked.disabled", "checked.enabled", "checked.disabled"]) {
  CHECKBOX_SPELLINGS[`states.${fix}.dashFill`] = "#00000000";
}
for (const fix of ["unchecked.enabled", "unchecked.disabled", "indeterminate.enabled", "indeterminate.disabled"]) {
  CHECKBOX_SPELLINGS[`states.${fix}.checkFill`] = (leaves) => {
    const carried = leaves["states.checked.enabled.checkFill"];
    if (carried === undefined) throw new Error("checkFill spelling needs states.checked.enabled.checkFill first");
    return carried;
  };
}

export function checkboxSchemaMappings(roles: CheckboxRoles, opts: CheckboxSchemaOptions = {}): FactMapping[] {
  const combos = opts.combos ?? IDENTITY_COMBOS;
  const base = combos["unchecked.enabled"];
  const checked = combos["checked.enabled"];
  const indeterminate = combos["indeterminate.enabled"];
  const paint = opts.glyphPaint ?? "stroke";
  const R = (path: string, fallback: () => FactMapping): FactMapping => {
    const r = opts.receipts?.[path];
    return r ? receipt(path, r.why, r.evidence) : fallback();
  };
  const rows: FactMapping[] = [
    R("wrapper.size", () => one("wrapper.size", "px", { combo: base, part: roles.hit, channel: "width" })),
    R("box.size", () => one("box.size", "px", { combo: base, part: roles.box, channel: "width" })),
    R("box.radius", () => one("box.radius", "px", { combo: base, part: roles.box, channel: "border-top-left-radius" })),
    R("box.borderWidth", () => one("box.borderWidth", "px", { combo: base, part: roles.box, channel: "border-top-width" })),
    R("box.padding", () => one("box.padding", "px", { combo: base, part: roles.box, channel: "padding-top" })),
    R("row.gap", () => one("row.gap", "px", { combo: base, part: roles.row, channel: "column-gap" })),
    R("dash.width", () =>
      roles.dash
        ? one("dash.width", "px", { combo: indeterminate, part: roles.dash.part, pseudo: roles.dash.pseudo, channel: "width" })
        : receipt("dash.width", "no distinct indeterminate mark part in this library's DOM", "reviewed"),
    ),
    R("dash.height", () =>
      roles.dash
        ? one("dash.height", "px", { combo: indeterminate, part: roles.dash.part, pseudo: roles.dash.pseudo, channel: "height" })
        : receipt("dash.height", "no distinct indeterminate mark part", "reviewed"),
    ),
    R("dash.radius", () =>
      roles.dash
        ? one("dash.radius", "px", { combo: indeterminate, part: roles.dash.part, pseudo: roles.dash.pseudo, channel: "border-top-left-radius" })
        : receipt("dash.radius", "no distinct indeterminate mark part", "reviewed"),
    ),
    R("check.width", () => one("check.width", "px", { combo: checked, part: roles.glyph, channel: "width" })),
    R("check.height", () => one("check.height", "px", { combo: checked, part: roles.glyph, channel: "height" })),
    R("check.strokeWidth", () =>
      paint === "stroke"
        ? {
            path: "check.strokeWidth",
            kind: "number",
            reads: {
              s: { combo: checked, part: roles.glyphPath, channel: "stroke-width" },
              w: { combo: checked, part: roles.glyph, channel: "width" },
            },
            formula: opts.glyphViewBox
              ? `path stroke-width × (rendered svg width / viewBox ${opts.glyphViewBox}) — an SVG stroke is a user-space length`
              : "path stroke-width, taken as rendered px (no viewBox given)",
            combine: (raw) => (opts.glyphViewBox ? px(raw.s) * (px(raw.w) / opts.glyphViewBox) : px(raw.s)),
          }
        : one("check.strokeWidth", "number", { combo: checked, part: roles.glyphPath, channel: "stroke" }, {
            formula: "0 when the glyph paints by fill (captured stroke: none)",
            combine: (raw) => (raw.v === "none" ? 0 : num(raw.v)),
          }),
    ),
    receipt("check.offsetX", "glyph placement is the recipe's spelling (placement: center); a flex-centred glyph has no per-glyph offset channel", "reviewed 0"),
    receipt("check.offsetY", "same as check.offsetX", "reviewed 0"),
    R("labelFontSize", () => one("labelFontSize", "px", { combo: base, part: roles.label, channel: "font-size" })),
  ];
  for (const fix of Object.keys(combos) as Array<keyof CheckboxComboMap>) {
    const combo = combos[fix];
    const opacityPart = roles.opacityOn ?? roles.box;
    rows.push(
      R(`states.${fix}.boxFill`, () => one(`states.${fix}.boxFill`, "color", { combo, part: roles.box, channel: "background-color" })),
      R(`states.${fix}.boxBorder`, () => one(`states.${fix}.boxBorder`, "color", { combo, part: roles.box, channel: "border-top-color" })),
      R(`states.${fix}.boxOpacity`, () => one(`states.${fix}.boxOpacity`, "number", { combo, part: opacityPart, channel: "opacity" })),
      R(`states.${fix}.label`, () => one(`states.${fix}.label`, "color", { combo, part: roles.label, channel: "color" })),
    );
    if (fix.startsWith("indeterminate")) {
      rows.push(
        R(`states.${fix}.dashFill`, () =>
          roles.dash
            ? one(`states.${fix}.dashFill`, "color", { combo, part: roles.dash.part, pseudo: roles.dash.pseudo, channel: roles.dash.pseudo ? "background-color" : "stroke" }, {
                formula: "the indeterminate mark's paint (a stroked line reads stroke; a box reads background-color)",
              })
            : receipt(`states.${fix}.dashFill`, "no distinct indeterminate mark part", "reviewed"),
        ),
      );
    } else {
      rows.push(
        receipt(`states.${fix}.dashFill`, "the indeterminate mark does not render in this state; transparent is the recipe's spelling of absent", `no mark at combo ${combo} — reviewed #00000000`),
      );
    }
    if (fix.startsWith("checked")) {
      rows.push(
        R(`states.${fix}.checkFill`, () =>
          one(`states.${fix}.checkFill`, "color", { combo, part: roles.glyphPath, channel: paint === "stroke" ? "stroke" : "fill" }, {
            formula: paint === "stroke" ? "the glyph strokes in this colour" : "the glyph fills in this colour",
          }),
        ),
      );
    } else {
      rows.push(
        receipt(`states.${fix}.checkFill`, "the check glyph does not render in this state; the recipe carries a glyph-slot spelling", `no check at combo ${combo} — reviewed (fixture value carried)`),
      );
    }
  }
  rows.push(
    R("rowAlign", () => one("rowAlign", "string", { combo: base, part: roles.row, channel: "align-items" })),
    R("typography.label.family", () =>
      one("typography.label.family", "string", { combo: base, part: roles.label, channel: "font-family" }, {
        formula: "first family of the label's computed stack",
        combine: firstFam,
      }),
    ),
    R("typography.label.style", () =>
      one("typography.label.style", "string", { combo: base, part: roles.label, channel: "font-weight" }, {
        formula: "label font-weight → style word",
        combine: (raw) => styleForWeight(num(raw.v)),
      }),
    ),
    R("check.path", () =>
      one("check.path", "string", { combo: checked, part: roles.glyphPath, channel: "d" }, {
        formula: "the captured path() data of the checked glyph",
        combine: (raw) => raw.v,
      }),
    ),
  );
  return rows;
}
