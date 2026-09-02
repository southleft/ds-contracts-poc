/**
 * FIXTURE READER — ledger access (docs/35 Phase 1, "the reader").
 *
 * The capture ledger is `extract/computed/out/<lib>/<component>/
 * captured-truth.json` — the provenance-pinned Chromium computed-style
 * capture of the REAL npm package (the signed-Input precedent,
 * generalized). This module gives the reader ONE way to address a fact in
 * that ledger: a combo key (`checked.enabled`), an interaction
 * (`default` | `hover` | `focus-visible` | `active`), a part selector, an
 * optional pseudo element, and a CSS channel. Reconstruction reuses
 * `extract/computed/replay.ts` (`reconstructCaptures`) verbatim — the same
 * code path every offline instrument uses — so the reader can never see a
 * different truth than the replay gate does.
 *
 * Nothing here writes. Nothing here invents: a selector that matches no
 * part, a channel the capture did not enumerate, or a value the normalizer
 * cannot read all REFUSE BY NAME (LedgerReadError), and the drift gate
 * treats a refusal as a red, never as a pass.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  reconstructCaptures,
  type CapturedTruthFile,
} from "../../extract/computed/replay.js";
import type { CapturedNode } from "../../extract/computed/lib.js";

export class LedgerReadError extends Error {}

export interface LedgerPart {
  /** Structural index path from the root, e.g. "0.1" = root.nodes[0].nodes[1]. */
  idxPath: string;
  tag: string;
  classes: string[];
  style: Record<string, string>;
  pseudo: Record<string, Record<string, string>>;
  text: string[];
}

export interface LedgerCapture {
  key: string; // `${combo}__${interaction}`
  parts: LedgerPart[];
}

/** One loaded captured-truth ledger, addressable by combo×interaction. */
export class Ledger {
  readonly file: string;
  /** The capture's declared base combo key (the library's default cell), e.g. "primary.medium.unchecked.enabled__default". */
  readonly baseKey: string | null;
  private byKey = new Map<string, LedgerCapture>();

  constructor(repoRoot: string, relFile: string) {
    this.file = relFile;
    const truth = JSON.parse(
      readFileSync(path.join(repoRoot, relFile), "utf8"),
    ) as CapturedTruthFile;
    this.baseKey = typeof (truth as { base?: { key?: string } }).base?.key === "string" ? (truth as { base: { key: string } }).base.key : null;
    for (const cap of reconstructCaptures(truth)) {
      const key = `${cap.combo}__${cap.interaction}`;
      this.byKey.set(key, { key, parts: flattenParts(cap.root) });
    }
  }

  keys(): string[] {
    return [...this.byKey.keys()];
  }

  capture(key: string): LedgerCapture {
    const cap = this.byKey.get(key);
    if (!cap) {
      throw new LedgerReadError(
        `${this.file}: no capture "${key}" — captured keys: ${this.keys().join(", ")}`,
      );
    }
    return cap;
  }

  /**
   * Select ONE part. Selector grammar (all matches are depth-first order):
   *   `root`            — the root part
   *   `cls:<token>`     — first part whose class list contains <token>
   *   `cls:<token>#<n>` — the n-th (0-based) such part
   *   `idx:<i.j.k>`     — structural child-index path from the root
   *   `tag:<tag>#<n>`   — the n-th part with that tag
   */
  part(comboKey: string, selector: string): LedgerPart {
    const cap = this.capture(comboKey);
    const found = selectPart(cap.parts, selector);
    if (!found) {
      throw new LedgerReadError(
        `${this.file}#${comboKey}: selector "${selector}" matched no part — parts: ${cap.parts
          .map((p) => `${p.idxPath || "root"}<${p.tag}>${p.classes.length ? "." + p.classes.join(".") : ""}`)
          .join(" ")}`,
      );
    }
    return found;
  }

  /** Read one raw channel string (optionally from a pseudo element). */
  raw(comboKey: string, selector: string, channel: string, pseudo?: string): string {
    const part = this.part(comboKey, selector);
    const map = pseudo ? part.pseudo[pseudo] : part.style;
    if (!map) {
      throw new LedgerReadError(
        `${this.file}#${comboKey} ${selector}: pseudo "${pseudo}" not present (present: ${Object.keys(part.pseudo).join(", ") || "none"})`,
      );
    }
    const v = map[channel];
    if (v === undefined) {
      throw new LedgerReadError(
        `${this.file}#${comboKey} ${selector}${pseudo ?? ""}: channel "${channel}" not enumerated`,
      );
    }
    return v;
  }
}

function flattenParts(root: CapturedNode): LedgerPart[] {
  const out: LedgerPart[] = [];
  const walk = (n: CapturedNode, idxPath: string): void => {
    out.push({
      idxPath,
      tag: n.tag,
      classes: [...(n.classes ?? [])],
      style: (n.style ?? {}) as Record<string, string>,
      pseudo: (n.pseudo ?? {}) as Record<string, Record<string, string>>,
      text: (n.nodes ?? [])
        .filter((c): c is { t: "text"; v: string } => (c as { t?: string }).t === "text")
        .map((c) => c.v),
    });
    let i = 0;
    for (const child of n.nodes ?? []) {
      if ((child as { t?: string }).t === "text") {
        i++;
        continue;
      }
      walk((child as { el: CapturedNode }).el, idxPath ? `${idxPath}.${i}` : String(i));
      i++;
    }
  };
  walk(root, "");
  return out;
}

function selectPart(parts: LedgerPart[], selector: string): LedgerPart | null {
  if (selector === "root") return parts[0] ?? null;
  const m = /^(cls|idx|tag):([^#]+)(?:#(\d+))?$/.exec(selector);
  if (!m) throw new LedgerReadError(`bad part selector "${selector}"`);
  const [, kind, value, nth] = m;
  const n = nth ? Number(nth) : 0;
  if (kind === "idx") return parts.find((p) => p.idxPath === value) ?? null;
  const matches = parts.filter((p) =>
    kind === "cls" ? p.classes.includes(value) : p.tag === value,
  );
  return matches[n] ?? null;
}

// ---------------------------------------------------------------------------
// Value normalization — computed-CSS strings → the fixture tables' spellings
// ---------------------------------------------------------------------------

/** `"42px"` → 42; `"16.5px"` → 16.5. Anything else refuses by name. */
export function px(v: string): number {
  // Chromium reports a clamped huge length in exponent notation (Tailwind's
  // rounded-full → "3.35544e+07px"); that is still a px length.
  const m = /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)px$/i.exec(v);
  if (!m) throw new LedgerReadError(`not a px length: "${v}"`);
  return Number(m[1]);
}

/** `"400"` → 400 (font-weight and other unitless numerics). */
export function num(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new LedgerReadError(`not a number: "${v}"`);
  return n;
}

/**
 * rgb()/rgba() or oklch() → the fixture tables' #rrggbbaa spelling (lowercase).
 *
 * Chromium reports an oklch()-declared colour (Tailwind v4 / shadcn) verbatim
 * in computed style. The conversion is CSS Color 4's, exactly: oklch → oklab →
 * LMS (cube) → linear sRGB → sRGB transfer, then 8-bit rounding, and it is
 * pinned against the real render — oklch(0.205 0 0) paints (23,23,23) and
 * oklch(0.922 0 0) paints (229,229,229) in the shadcn orig-shots. A component
 * outside sRGB is clipped to [0,1] (Chromium's behaviour for these inputs is
 * also a clip); a colour whose clip moves any channel by more than 1/255 is
 * refused so a wide-gamut fact is never quietly reported as its clipped cousin.
 */
export function hex8(v: string): string {
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    const a = rgb[4] === undefined ? 1 : Number(rgb[4]);
    return `#${h(r)}${h(g)}${h(b)}${h(Math.round(a * 255))}`;
  }
  // CSS Color 4 color(srgb r g b / a): components in [0,1], already sRGB —
  // Chakra's shadow tokens arrive this way. Any other colour space (display-p3,
  // rec2020…) is refused by name rather than carried as its sRGB cousin.
  const fn = /^color\(\s*([a-z0-9-]+)\s+([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)\s*(?:\/\s*([\d.]+%?))?\s*\)$/i.exec(v);
  if (fn) {
    if (fn[1]!.toLowerCase() !== "srgb") throw new LedgerReadError(`color(${fn[1]} …) is not sRGB — not carried as its sRGB cousin: "${v}"`);
    const unit = (t: string): number => (t.endsWith("%") ? Number(t.slice(0, -1)) / 100 : Number(t));
    const ch = (t: string): number => Math.round(Math.min(1, Math.max(0, unit(t))) * 255);
    const fa = fn[5] === undefined ? 1 : unit(fn[5]);
    return `#${h(ch(fn[2]!))}${h(ch(fn[3]!))}${h(ch(fn[4]!))}${h(Math.round(fa * 255))}`;
  }
  const ok = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([-\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (!ok) throw new LedgerReadError(`not an rgb()/rgba()/oklch()/color(srgb) color: "${v}"`);
  const pct = (t: string, scale: number): number => (t.endsWith("%") ? (Number(t.slice(0, -1)) / 100) * scale : Number(t));
  const L = pct(ok[1]!, 1), C = pct(ok[2]!, 0.4), H = Number(ok[3]);
  const alpha = ok[4] === undefined ? 1 : pct(ok[4], 1);
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  // oklab → LMS' (Björn Ottosson's M2⁻¹), cube, → linear sRGB (M1⁻¹)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const transfer = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const out = lin.map((c) => {
    const clipped = Math.min(1, Math.max(0, c));
    const srgb = transfer(clipped);
    const unclipped = transfer(Math.max(0, c));
    if (Math.abs(unclipped - srgb) > 1 / 255 || c < -1 / 255) throw new LedgerReadError(`oklch colour outside sRGB by more than 1/255 — not carried as its clipped cousin: "${v}"`);
    return Math.round(srgb * 255);
  });
  return `#${h(out[0]!)}${h(out[1]!)}${h(out[2]!)}${h(Math.round(alpha * 255))}`;
}

/** `matrix(a, b, c, d, tx, ty)` → the six components. `none` → identity. */
export function matrix(v: string): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  if (v === "none") return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const m = /^matrix\(([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+),\s*([-\d.e]+)\)$/.exec(v);
  if (!m) throw new LedgerReadError(`not a 2D matrix: "${v}"`);
  const [a, b, c, d, tx, ty] = m.slice(1).map(Number);
  return { a, b, c, d, tx, ty };
}

/** `path("M 8.5 2.5 L 4 7.5")` → the numeric coordinates in order. */
export function pathNumbers(v: string): number[] {
  const m = /^path\("([^"]+)"\)$/.exec(v);
  if (!m) throw new LedgerReadError(`not a path(): "${v}"`);
  return (m[1].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** First family name of a computed font-family stack, unquoted. */
export function firstFamily(v: string): string {
  const first = v.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}
