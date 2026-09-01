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
  private byKey = new Map<string, LedgerCapture>();

  constructor(repoRoot: string, relFile: string) {
    this.file = relFile;
    const truth = JSON.parse(
      readFileSync(path.join(repoRoot, relFile), "utf8"),
    ) as CapturedTruthFile;
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
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
  if (!m) throw new LedgerReadError(`not a px length: "${v}"`);
  return Number(m[1]);
}

/** `"400"` → 400 (font-weight and other unitless numerics). */
export function num(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new LedgerReadError(`not a number: "${v}"`);
  return n;
}

/** rgb()/rgba() → the fixture tables' #rrggbbaa spelling (lowercase). */
export function hex8(v: string): string {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(v);
  if (!m) throw new LedgerReadError(`not an rgb()/rgba() color: "${v}"`);
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const h = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${h(Math.round(a * 255))}`;
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
