/**
 * CSS `box-shadow` → Figma drop/inner shadow effects.
 *
 * The same shape as `recipe/figma-vector-path.ts`: the fixture carries the
 * library's literal declaration, the reader verifies that declaration against
 * the capture's computed `box-shadow` channel, and the LOWERING to Figma's
 * grammar happens at compile. Nothing is retyped into a shape only Figma
 * understands, so the citation stays checkable.
 *
 * This exists because of a measured defect. MUI's Switch thumb is white with an
 * elevation-1 shadow; the recipe carried a named refusal for that shadow
 * (`refusal-thumb-shadow`, "not this teaching") and painted the thumb flat. A
 * white thumb with no shadow, on a white ground, is invisible — the control read
 * as a grey blob, and `recipe/evidence/fidelity-v1` scored it 35.04% AA against
 * the real render. The receipt made the loss honest; it did not make it free.
 *
 * Grammar handled (the CSS box-shadow shorthand):
 *   [inset] <offset-x> <offset-y> [<blur>] [<spread>] [<color>]
 * with the colour in any position, comma-separated layers, and CSS's paint
 * order (first layer on top).
 *
 * Refused by name rather than guessed at: `currentColor`, colours this parser
 * cannot resolve to rgba, and any length that is not px. A shadow whose colour
 * we cannot name is not a shadow we can put on a canvas.
 */

import { hex8 } from "./fixture-reader/ledger.js";

export class CssBoxShadowError extends Error {}

export interface ShadowEffectSpec {
  kind: "drop-shadow" | "inner-shadow";
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  /** #rrggbbaa, the spelling the recipe IR uses. */
  color: string;
}

const hex2 = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** rgb()/rgba()/#rgb/#rrggbb/#rrggbbaa → #rrggbbaa. */
export const cssColorToHex8 = (raw: string): string => {
  // Tailwind v4 declares shadow/ring colours in oklch(); the ledger's reader
  // converts by CSS Color 4 (pinned to the render's pixels).
  if (/^(oklch|color)\(/i.test(raw.trim())) return hex8(raw.trim());
  const v = raw.trim();
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/i.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined
      ? 1
      : rgb[4].endsWith("%")
        ? Number(rgb[4].slice(0, -1)) / 100
        : Number(rgb[4]);
    return `#${hex2(Number(rgb[1]))}${hex2(Number(rgb[2]))}${hex2(Number(rgb[3]))}${hex2(a * 255)}`;
  }
  const hex = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}ff`;
    if (h.length === 6) return `#${h.toLowerCase()}ff`;
    if (h.length === 8) return `#${h.toLowerCase()}`;
  }
  throw new CssBoxShadowError(`cannot resolve colour "${raw}" — name it rather than guess`);
};

/** Split on commas that are not inside parentheses. */
const splitLayers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
};

const px = (token: string): number => {
  const m = /^(-?[\d.]+)px$/.exec(token);
  if (!m) throw new CssBoxShadowError(`only px lengths are supported, got "${token}"`);
  return Number(m[1]);
};

/**
 * Parse a computed `box-shadow` into Figma effects, outermost-last.
 * Returns [] for "none".
 */
export function parseCssBoxShadow(value: string): ShadowEffectSpec[] {
  const v = value.trim();
  if (!v || v === "none") return [];
  if (/currentcolor/i.test(v)) {
    throw new CssBoxShadowError(
      "currentColor in a shadow depends on the inherited text colour; resolve it at capture time rather than guessing here",
    );
  }

  return splitLayers(v).map((layer) => {
    let rest = layer;
    let inset = false;
    if (/(^|\s)inset(\s|$)/.test(rest)) {
      inset = true;
      rest = rest.replace(/(^|\s)inset(\s|$)/, " ");
    }

    // Pull the colour out wherever it sits, then the lengths are what remain.
    const colourMatch = /rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b/i.exec(rest);
    if (!colourMatch) {
      throw new CssBoxShadowError(`no colour in shadow layer "${layer}" — refusing to assume black`);
    }
    const color = cssColorToHex8(colourMatch[0]);
    const lengths = rest.replace(colourMatch[0], " ").trim().split(/\s+/).filter(Boolean);
    if (lengths.length < 2) {
      throw new CssBoxShadowError(`shadow layer "${layer}" has no offset pair`);
    }
    return {
      kind: inset ? ("inner-shadow" as const) : ("drop-shadow" as const),
      offsetX: px(lengths[0]!),
      offsetY: px(lengths[1]!),
      blur: lengths[2] === undefined ? 0 : px(lengths[2]),
      spread: lengths[3] === undefined ? 0 : px(lengths[3]),
      color,
    };
  });
}

/**
 * The inverse of `parseCssBoxShadow`, back to the CSS spelling.
 *
 * Compile must be a fixed point: an instance lowered to a scene and read back
 * has to produce the same instance. The fixture carries the library's literal
 * `box-shadow`, so the inversion has to return that spelling rather than a
 * Figma-shaped structure, or the round trip diverges on a fact it actually
 * carried correctly.
 *
 * Emits the same normalised form the capture reports —
 * `rgba(r, g, b, a) Xpx Ypx Bpx Spx` — so a parse/serialise cycle is stable.
 */
export function cssBoxShadowFromEffects(
  effects: readonly ShadowEffectSpec[] | readonly { kind: string }[],
): string {
  const shadows = (effects as readonly ShadowEffectSpec[]).filter(
    (e) => e && (e.kind === "drop-shadow" || e.kind === "inner-shadow"),
  );
  if (shadows.length === 0) return "none";
  return shadows
    .map((e) => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(e.color);
      if (!m) throw new CssBoxShadowError(`effect colour is not #rrggbbaa: ${e.color}`);
      const [r, g, b, a] = [1, 2, 3, 4].map((i) => parseInt(m[i]!, 16));
      const alpha = Math.round((a! / 255) * 100) / 100;
      const inset = e.kind === "inner-shadow" ? "inset " : "";
      return `${inset}rgba(${r}, ${g}, ${b}, ${alpha}) ${e.offsetX}px ${e.offsetY}px ${e.blur}px ${e.spread}px`;
    })
    .join(", ");
}
