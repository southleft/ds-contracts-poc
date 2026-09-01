/**
 * DRAFT THE ROLE MAP for checkbox@1 from a capture ledger — the one human
 * review the proposer still needs, drafted with evidence so the review is
 * a diff, not a transcription.
 *
 * Every role is decided by what the captured parts DO across combos, never by
 * class names: the box is the square part whose paint changes between
 * unchecked and checked; the glyph is the svg inside it; the glyph path is
 * the drawn element that appears in the checked combo; the label is the part
 * carrying text; the row is the nearest ancestor of box and label that lays
 * out with flex; the hit is the box's parent when that parent is a larger
 * square; the dash is the drawn element that exists only in the indeterminate
 * combo; opacity is read from whichever of box/hit dims when disabled.
 *
 * Each role carries its evidence and a confidence; a role the ledger does not
 * settle is left null with the reason, and the proposer will refuse until a
 * person fills it. Nothing here guesses silently.
 */
import path from "node:path";

import { Ledger, type LedgerPart } from "./ledger.js";
import type { CheckboxRoles } from "./schema-checkbox.js";

export interface RoleDraft {
  roles: Partial<CheckboxRoles> & { dash?: { part: string; pseudo?: string } };
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

const sel = (p: LedgerPart): string => (p.idxPath === "" ? "root" : `idx:${p.idxPath}`);
const num = (v: string | undefined): number => (v ? parseFloat(v) || 0 : 0);
const isSquare = (p: LedgerPart): boolean => {
  const w = num(p.style.width), h = num(p.style.height);
  return w > 0 && Math.abs(w - h) <= 1;
};
const parentPath = (idx: string): string | null => (idx === "" ? null : idx.includes(".") ? idx.slice(0, idx.lastIndexOf(".")) : "");

export function draftCheckboxRoles(ledger: Ledger): RoleDraft {
  const base = ledger.capture("unchecked.enabled__default");
  const checked = ledger.capture("checked.enabled__default");
  const indeterminate = (() => { try { return ledger.capture("indeterminate.enabled__default"); } catch { return null; } })();
  const disabled = (() => { try { return ledger.capture("unchecked.disabled__default"); } catch { return null; } })();
  const byPath = (cap: { parts: LedgerPart[] }) => new Map(cap.parts.map((p) => [p.idxPath, p] as const));
  const baseBy = byPath(base), checkedBy = byPath(checked);
  const evidence: RoleDraft["evidence"] = {};
  const unresolved: string[] = [];
  const roles: RoleDraft["roles"] = {};

  // BOX: a square part whose background or border colour differs between the
  // unchecked and checked combos (the control paints its state).
  const boxCandidates = base.parts.filter((p) => {
    const c = checkedBy.get(p.idxPath);
    if (!c || !isSquare(p) || p.tag === "svg" || p.tag === "path" || p.tag === "input") return false;
    return p.style["background-color"] !== c.style["background-color"] || p.style["border-top-color"] !== c.style["border-top-color"];
  });
  const box = boxCandidates.sort((a, b) => num(a.style.width) - num(b.style.width))[0] ?? null;
  if (box) {
    roles.box = sel(box);
    evidence.box = { selector: roles.box, why: `square ${box.style.width} ${box.tag}${box.classes.length ? "." + box.classes[0] : ""} whose paint changes unchecked → checked (bg ${base.parts.find((p) => p.idxPath === box.idxPath)!.style["background-color"]} → ${checkedBy.get(box.idxPath)!.style["background-color"]})`, confidence: boxCandidates.length === 1 ? "high" : "medium" };
  } else {
    unresolved.push("box: no square part changes paint between unchecked and checked");
    evidence.box = { selector: null, why: "no candidate", confidence: "low" };
  }

  // GLYPH: an svg in the checked combo (inside the box when there is one).
  const svg = checked.parts.find((p) => p.tag === "svg" && (!box || p.idxPath.startsWith(box.idxPath === "" ? "" : box.idxPath + ".")));
  if (svg) {
    roles.glyph = "tag:svg";
    evidence.glyph = { selector: "tag:svg", why: `svg ${svg.style.width}×${svg.style.height} present in the checked combo`, confidence: "high" };
    const drawn = checked.parts.find((p) => (p.tag === "path" || p.tag === "polyline") && p.idxPath.startsWith(svg.idxPath + "."));
    if (drawn) {
      roles.glyphPath = `tag:${drawn.tag}`;
      evidence.glyphPath = { selector: roles.glyphPath, why: `${drawn.tag} inside the svg, stroke ${drawn.style.stroke} ${drawn.style["stroke-width"]}, d=${(drawn.style.d ?? "n/a").slice(0, 40)}${drawn.tag === "polyline" ? " — a polyline's points are not a computed channel: cite the glyph from the package with --glyph" : ""}`, confidence: "high" };
    } else unresolved.push("glyphPath: the checked svg has no path/polyline child");
  } else unresolved.push("glyph: no svg in the checked combo");

  // LABEL: the part carrying text.
  const label = base.parts.find((p) => p.text && p.text.length > 0 && p.tag !== "input");
  if (label) {
    roles.label = sel(label);
    evidence.label = { selector: roles.label, why: `${label.tag}${label.classes.length ? "." + label.classes[0] : ""} carries text ${JSON.stringify(label.text[0])}`, confidence: "high" };
  } else {
    unresolved.push("label: no part carries text — this library mounts a bare control; checkbox@1 needs a label (or a label-less cell the grammar does not have yet)");
    evidence.label = { selector: null, why: "no text part", confidence: "low" };
  }

  // ROW: nearest common ancestor of box and label that lays out with flex.
  if (box && label) {
    let a: string | null = box.idxPath, ancestors = new Set<string>();
    while (a !== null) { ancestors.add(a); a = parentPath(a); }
    let b: string | null = label.idxPath, common: string | null = null;
    while (b !== null) { if (ancestors.has(b)) { common = b; break; } b = parentPath(b); }
    const row = common !== null ? baseBy.get(common) : undefined;
    if (row) {
      roles.row = sel(row);
      evidence.row = { selector: roles.row, why: `nearest common ancestor of box and label: ${row.tag} display ${row.style.display}, column-gap ${row.style["column-gap"]}, align-items ${row.style["align-items"]}`, confidence: /flex/.test(row.style.display ?? "") ? "high" : "medium" };
    }
  } else if (box) { roles.row = "root"; evidence.row = { selector: "root", why: "no label; the root is the row", confidence: "low" }; }

  // HIT: the box's parent when it is a larger square; else the box.
  if (box) {
    const pp = parentPath(box.idxPath);
    const parent = pp !== null ? baseBy.get(pp) : undefined;
    if (parent && isSquare(parent) && num(parent.style.width) > num(box.style.width)) {
      roles.hit = sel(parent);
      evidence.hit = { selector: roles.hit, why: `the box's parent is a larger square (${parent.style.width}) — the hit area`, confidence: "high" };
    } else {
      roles.hit = roles.box!;
      evidence.hit = { selector: roles.hit, why: "no larger square parent; the box is its own hit area", confidence: "medium" };
    }
  }

  // DASH: a drawn element present only in the indeterminate combo, or a
  // non-svg square child of the box that appears there.
  if (indeterminate) {
    const indBy = byPath(indeterminate);
    const onlyInd = indeterminate.parts.filter((p) => !checkedBy.has(p.idxPath) && !baseBy.has(p.idxPath) && p.tag !== "input");
    const drawn = indeterminate.parts.find((p) => (p.tag === "path" || p.tag === "polyline") && (p.style.d ?? "") !== (checkedBy.get(p.idxPath)?.style.d ?? ""));
    const pick = onlyInd[0] ?? drawn;
    if (pick) {
      roles.dash = { part: pick.tag === "path" || pick.tag === "polyline" ? `tag:${pick.tag}` : sel(pick) };
      evidence.dash = { selector: roles.dash.part, why: pick.tag === "path" ? `path in the indeterminate combo draws d=${(pick.style.d ?? "").slice(0, 40)} — a stroked line: its width/height/radius are not channels, give --set with the lowering` : `${pick.tag} present only in the indeterminate combo (${pick.style.width}×${pick.style.height})`, confidence: onlyInd[0] ? "high" : "medium" };
    } else {
      evidence.dash = { selector: null, why: "no distinct indeterminate mark part; dash leaves will be receipts", confidence: "medium" };
    }
    void indBy;
  }

  // OPACITY: whichever of box / hit dims when disabled.
  if (disabled && box) {
    const disBy = byPath(disabled);
    const dimmed = [box, roles.hit && roles.hit !== roles.box ? baseBy.get(roles.hit.replace(/^idx:/, "").replace(/^root$/, "")) : undefined]
      .filter((p): p is LedgerPart => !!p)
      .find((p) => num(disBy.get(p.idxPath)?.style.opacity ?? "1") < num(p.style.opacity ?? "1"));
    roles.opacityOn = dimmed ? sel(dimmed) : roles.box;
    evidence.opacityOn = { selector: roles.opacityOn!, why: dimmed ? `${dimmed.tag} opacity ${baseBy.get(dimmed.idxPath)!.style.opacity} → ${disBy.get(dimmed.idxPath)!.style.opacity} when disabled` : "nothing dims by opacity when disabled; the box carries opacity 1 (colours change instead)", confidence: dimmed ? "high" : "medium" };
  }

  return { roles, evidence, unresolved };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const i = process.argv.indexOf("--ledger");
  const rel = i > -1 ? process.argv[i + 1] : undefined;
  if (!rel) throw new Error("usage: --ledger extract/computed/out/<lib>/checkbox/captured-truth.json");
  const repo = new URL("../..", import.meta.url).pathname;
  const draft = draftCheckboxRoles(new Ledger(repo, rel));
  console.log(JSON.stringify(draft, null, 2));
  if (draft.unresolved.length > 0) process.exitCode = 2;
}
