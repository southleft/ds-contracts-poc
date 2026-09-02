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
import type { SwitchComboMap, SwitchRoles } from "./schema-switch.js";
import type { AvatarRoles } from "./schema-avatar.js";
import type { TooltipRoles } from "./schema-tooltip.js";

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
    // A BARE CONTROL: no part carries text. Not unresolved — the recipe has a
    // label-less cell, and every label leaf becomes the bare-cell spelling.
    evidence.label = { selector: null, why: "no part carries text — a bare control; the recipe compiles no label node and label leaves become bare-cell spellings", confidence: "medium" };
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
  } else if (box) { evidence.row = { selector: null, why: "no label, so no row is read (row.gap and rowAlign are bare-cell spellings)", confidence: "medium" }; }

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


export interface SwitchRoleDraft {
  roles: Partial<SwitchRoles>;
  combos: Partial<SwitchComboMap>;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/**
 * Draft the switch@1 combo map from the ledger's combo keys: the OFF/ON plane
 * is whichever axis spelling the capture uses (unchecked/checked, false/true,
 * off/on, start/end), the disabled plane the same way; a capture that never
 * rendered the ON plane says so instead of guessing.
 */
export function draftSwitchCombos(ledger: Ledger): { combos: Partial<SwitchComboMap>; evidence: string[]; unresolved: string[] } {
  const keys = ledger.keys().filter((k) => k.endsWith("__default")).map((k) => k.slice(0, -"__default".length));
  // start/end are label positions, not the value plane — a capture with no
  // checked axis (Astryx) must come out unresolved for the ON leaves.
  const OFF = /(^|\.)(unchecked|false|off)(\.|$)/, ON = /(^|\.)(checked|true|on)(\.|$)/;
  const DIS = /(^|\.)(disabled|isDisabled)(\.|$)/, EN = /(^|\.)(enabled|no-isDisabled)(\.|$)/;
  // Among the combos on a plane, prefer the library's default cell: the one
  // spelled "default", then "medium"/"primary"; never the smallest by accident.
  const rank = (k: string): number => (/(^|\.)default(\.|$)/.test(k) ? 3 : 0) + (/(^|\.)(medium|primary|md)(\.|$)/.test(k) ? 1 : 0) - (/(^|\.)(small|sm|large|lg|secondary|error|info|warning|success)(\.|$)/.test(k) ? 1 : 0);
  const pick = (a: RegExp, b: RegExp): string | undefined => keys.filter((k) => a.test(k) && b.test(k)).sort((x, y) => rank(y) - rank(x) || x.length - y.length)[0];
  const combos: Partial<SwitchComboMap> = {};
  const evidence: string[] = [], unresolved: string[] = [];
  // The capture DECLARES its base cell (the library's defaults for every other
  // axis). Derive the four combos from it by swapping only the value and the
  // disabled tokens, so "default.medium" vs "primary.medium" is never guessed.
  const base = ledger.baseKey?.replace(/__default$/, "");
  const swap = (k: string, from: RegExp, to: string): string => k.replace(from, (m, pre: string, _v: string, post: string) => `${pre}${to}${post}`);
  if (base && OFF.test(base) && EN.test(base)) {
    const offTok = base.match(OFF)![2]!, enTok = base.match(EN)![2]!;
    const onTok = { unchecked: "checked", false: "true", off: "on" }[offTok]!, disTok = { enabled: "disabled", "no-isDisabled": "isDisabled" }[enTok]!;
    const cand: Record<keyof SwitchComboMap, string> = {
      "false.enabled": base,
      "false.disabled": swap(base, EN, disTok),
      "true.enabled": swap(base, OFF, onTok),
      "true.disabled": swap(swap(base, OFF, onTok), EN, disTok),
    };
    for (const [fix, k] of Object.entries(cand) as Array<[keyof SwitchComboMap, string]>) {
      if (keys.includes(k)) { combos[fix] = k; evidence.push(`${fix} ← ${k} (from the declared base ${base})`); }
      else unresolved.push(`${fix}: ${k} was not captured (base ${base})`);
    }
    return { combos, evidence, unresolved };
  }
  for (const [fix, a, b] of [["false.enabled", OFF, EN], ["false.disabled", OFF, DIS], ["true.enabled", ON, EN], ["true.disabled", ON, DIS]] as const) {
    const k = pick(a, b);
    if (k) { combos[fix] = k; evidence.push(`${fix} ← ${k}`); }
    else unresolved.push(`${fix}: no captured combo matches ${a} × ${b} (captured: ${keys.slice(0, 8).join(" ")}${keys.length > 8 ? " …" : ""})`);
  }
  return { combos, evidence, unresolved };
}

export function draftSwitchRoles(ledger: Ledger): SwitchRoleDraft {
  const cd = draftSwitchCombos(ledger);
  const roles: Partial<SwitchRoles> = {};
  const evidence: SwitchRoleDraft["evidence"] = {};
  const unresolved = [...cd.unresolved];
  const offKey = cd.combos["false.enabled"], onKey = cd.combos["true.enabled"];
  if (!offKey) return { roles, combos: cd.combos, evidence, unresolved };
  const off = ledger.capture(`${offKey}__default`);
  const on = onKey ? ledger.capture(`${onKey}__default`) : null;
  const onBy = on ? new Map(on.parts.map((p) => [p.idxPath, p] as const)) : null;
  const isPill = (p: LedgerPart): boolean => { const w = num(p.style.width), h = num(p.style.height), r = num(p.style["border-top-left-radius"]); return w > h * 1.3 && h > 0 && (r >= h / 2 - 0.5 || /%/.test(p.style["border-top-left-radius"] ?? "")); };
  const isRound = (p: LedgerPart): boolean => { const w = num(p.style.width), h = num(p.style.height), r = p.style["border-top-left-radius"] ?? ""; return w > 0 && Math.abs(w - h) <= 1 && (num(r) >= w / 2 - 0.5 || /%/.test(r)); };
  // TRACK: a pill whose paint changes off → on (or, with no ON plane, the pill with a visible fill).
  const pills = off.parts.filter((p) => isPill(p) && p.tag !== "input");
  const track = pills.find((p) => onBy ? (onBy.get(p.idxPath)?.style["background-color"] !== p.style["background-color"]) : (p.style["background-color"] ?? "rgba(0, 0, 0, 0)") !== "rgba(0, 0, 0, 0)") ?? pills[0] ?? null;
  if (track) { roles.track = sel(track); evidence.track = { selector: roles.track, why: `pill ${track.style.width}×${track.style.height} r=${track.style["border-top-left-radius"]} ${track.tag}${track.classes.length ? "." + track.classes[0] : ""}${onBy ? ` paint ${track.style["background-color"]} → ${onBy.get(track.idxPath)?.style["background-color"]}` : ""}`, confidence: onBy ? "high" : "medium" }; }
  else unresolved.push("track: no pill-shaped part");
  // THUMB: a round part smaller than the track's height... (a knob), preferring one inside or beside the track.
  // The knob: a round filled part no wider than the track (MUI's 20px thumb
  // overhangs its 14px track, so the bound is the track's WIDTH), or a square
  // part whose ::before / ::after paints the round knob (AntD's handle).
  const filled = (st: Record<string, string> | undefined) => (st?.["background-color"] ?? "rgba(0, 0, 0, 0)") !== "rgba(0, 0, 0, 0)";
  const knobs = off.parts.filter((p) => p !== track && p.tag !== "input" && (!track || num(p.style.width) <= num(track.style.width)) && isRound(p) && filled(p.style));
  let thumb = knobs.sort((a, b) => num(b.style.width) - num(a.style.width))[0] ?? null;
  let thumbPseudo: string | undefined;
  if (!thumb) {
    for (const p of off.parts) {
      if (p === track || p.tag === "input") continue;
      for (const ps of ["::before", "::after"]) {
        const st = p.pseudo?.[ps];
        if (!st) continue;
        const w = num(st.width), h = num(st.height), r = st["border-top-left-radius"] ?? "";
        if (w > 0 && Math.abs(w - h) <= 1 && (num(r) >= w / 2 - 0.5 || /%/.test(r)) && filled(st)) { thumb = p; thumbPseudo = ps; break; }
      }
      if (thumb) break;
    }
  }
  if (thumb) { roles.thumb = sel(thumb); if (thumbPseudo) roles.thumbPseudo = thumbPseudo; roles.thumbInsideTrack = !!track && thumb.idxPath.startsWith(track.idxPath === "" ? "" : track.idxPath + "."); const st = thumbPseudo ? thumb.pseudo[thumbPseudo]! : thumb.style; evidence.thumb = { selector: roles.thumb + (thumbPseudo ?? ""), why: `round ${st.width} ${thumb.tag}${thumb.classes.length ? "." + thumb.classes[0] : ""}${thumbPseudo ?? ""} bg ${st["background-color"]} — ${roles.thumbInsideTrack ? "INSIDE the track (opacity carried on the track)" : "a SIBLING of the track (track opacity baked into its fill)"}`, confidence: "high" }; }
  else unresolved.push("thumb: no round filled part (or pseudo-element) no wider than the track");
  // TRAVEL: the part whose transform changes off → on.
  if (onBy) {
    const moved = (p: LedgerPart, ch: "transform" | "translate"): boolean => (p.style[ch] ?? "none") !== (onBy.get(p.idxPath)?.style[ch] ?? "none");
    const mover = off.parts.find((p) => moved(p, "transform")) ?? off.parts.find((p) => moved(p, "translate"));
    if (mover) { const ch = moved(mover, "transform") ? "transform" : "translate"; roles.travelOn = sel(mover); if (ch === "translate") roles.travelChannel = "translate"; evidence.travelOn = { selector: roles.travelOn, why: `${mover.tag}${mover.classes.length ? "." + mover.classes[0] : ""} ${ch} ${mover.style[ch]} → ${onBy.get(mover.idxPath)?.style[ch]}`, confidence: "high" }; }
    else if (thumb && ["left", "inset-inline-start"].some((ch) => (thumb!.style[ch] ?? "") !== (onBy.get(thumb!.idxPath)?.style[ch] ?? ""))) { const ch = ["left", "inset-inline-start"].find((c) => (thumb!.style[c] ?? "") !== (onBy.get(thumb!.idxPath)?.style[c] ?? ""))!; roles.travelInset = ch; evidence.travelOn = { selector: null, why: `no transform moves; the thumb's ${ch} changes ${thumb.style[ch]} → ${onBy.get(thumb.idxPath)?.style[ch]} (read as inset)`, confidence: "medium" }; }
    else unresolved.push("travelOn: nothing moves between off and on by transform or left — give thumb.travel with --set");
  } else evidence.travelOn = { selector: null, why: "no ON plane captured; thumb.travel and every true.* leaf need --set with evidence", confidence: "low" };
  // HIT: track's parent when larger; else the track.
  if (track) {
    const pp = parentPath(track.idxPath); const parent = pp !== null ? off.parts.find((p) => p.idxPath === pp) : undefined;
    if (parent && parent.tag !== "label" && num(parent.style.width) >= num(track.style.width) && num(parent.style.height) >= num(track.style.height) && !parent.text?.length && num(parent.style.width) < num(track.style.width) * 2) { roles.hit = sel(parent); evidence.hit = { selector: roles.hit, why: `the track's parent ${parent.tag} ${parent.style.width}×${parent.style.height} is the hit area`, confidence: "medium" }; }
    else { roles.hit = roles.track; evidence.hit = { selector: roles.hit, why: "the track is its own hit area", confidence: "medium" }; }
  }
  // LABEL + ROW
  const label = off.parts.find((p) => p.text && p.text.some((t) => t.trim().length > 0) && p.tag !== "input");
  if (label) {
    roles.label = sel(label); evidence.label = { selector: roles.label, why: `${label.tag}${label.classes.length ? "." + label.classes[0] : ""} carries text ${JSON.stringify(label.text.find((t) => t.trim())!)}`, confidence: "high" };
    if (track) { let a: string | null = track.idxPath; const anc = new Set<string>(); while (a !== null) { anc.add(a); a = parentPath(a); } let b: string | null = label.idxPath, common: string | null = null; while (b !== null) { if (anc.has(b)) { common = b; break; } b = parentPath(b); } const row = common !== null ? off.parts.find((p) => p.idxPath === common) : undefined; if (row) { roles.row = sel(row); evidence.row = { selector: roles.row, why: `nearest common ancestor of track and label: ${row.tag} display ${row.style.display} column-gap ${row.style["column-gap"]}`, confidence: /flex/.test(row.style.display ?? "") ? "high" : "medium" }; } }
  } else evidence.label = { selector: null, why: "no part carries text — a bare control; label leaves become receipts", confidence: "medium" };
  return { roles, combos: cd.combos, evidence, unresolved };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const i = process.argv.indexOf("--ledger");
  const rel = i > -1 ? process.argv[i + 1] : undefined;
  if (!rel) throw new Error("usage: --ledger extract/computed/out/<lib>/checkbox/captured-truth.json");
  const repo = new URL("../..", import.meta.url).pathname;
  const a = process.argv.indexOf("--archetype");
  const archetype = a > -1 ? process.argv[a + 1] : "checkbox";
  const draft = archetype === "switch" ? draftSwitchRoles(new Ledger(repo, rel)) : draftCheckboxRoles(new Ledger(repo, rel));
  console.log(JSON.stringify(draft, null, 2));
  if (draft.unresolved.length > 0) process.exitCode = 2;
}
export interface AvatarRoleDraft {
  roles: Partial<AvatarRoles>;
  combo: string | null;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/**
 * avatar@1 roles from a ledger. The BOX is the painted part: the outermost
 * part whose background is not transparent (MUI's root, AntD's root, shadcn's
 * fallback span, Fluent's initials span, Altitude's root). The LABEL is the
 * part carrying the initials text (the box itself when it carries text).
 * The COMBO is the capture that reads as the rest cell: a `__default`
 * interaction whose key names a default/circular/circle variant, else the
 * first `__default` key.
 */
export function draftAvatarRoles(ledger: Ledger): AvatarRoleDraft {
  const evidence: AvatarRoleDraft["evidence"] = {};
  const unresolved: string[] = [];
  const keys = ledger.keys().filter((k) => k.endsWith("__default"));
  const pick = keys.find((k) => /(^|\.)(default|circular|circle|unset)(\.|__)/.test(k)) ?? keys[0];
  if (!pick) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture in the ledger"] };
  const combo = pick.slice(0, -"__default".length);
  const c = ledger.capture(pick);
  const transparent = (v: string | undefined): boolean => !v || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(v) || v === "transparent";
  const roles: Partial<AvatarRoles> = {};
  const painted = c.parts.filter((p) => !transparent(p.style["background-color"]) && num(p.style.width) > 0);
  const box = painted[0];
  if (box) {
    roles.box = sel(box);
    evidence.box = { selector: roles.box, why: `${box.tag}${box.classes.length ? "." + box.classes[0] : ""} is the outermost painted part: ${box.style.width}×${box.style.height}, bg ${box.style["background-color"]}, radius ${box.style["border-top-left-radius"]}`, confidence: painted.length === 1 ? "high" : "medium" };
  } else unresolved.push("box: no part paints a background");
  const textPart = c.parts.find((p) => p.text && p.text.some((t) => t.trim().length > 0));
  if (textPart && box) {
    if (textPart.idxPath !== box.idxPath) roles.label = sel(textPart);
    evidence.label = { selector: roles.label ?? roles.box!, why: `${textPart.tag}${textPart.classes.length ? "." + textPart.classes[0] : ""} carries the initials ${JSON.stringify(textPart.text.find((t) => t.trim().length > 0))}${textPart.idxPath === box.idxPath ? " (the box itself)" : ""}`, confidence: "high" };
  } else unresolved.push("label: no part carries text — avatar@1 needs initials");
  return { roles, combo, evidence, unresolved };
}

export interface TooltipRoleDraft {
  roles: Partial<TooltipRoles>;
  combo: string | null;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/**
 * tooltip@1 roles: the BOX is the painted part that carries the text (or
 * whose descendant does) — popper wrappers and arrows are transparent. The
 * COMBO prefers an "on"/open capture, else the first `__default`.
 */
export function draftTooltipRoles(ledger: Ledger): TooltipRoleDraft {
  const evidence: TooltipRoleDraft["evidence"] = {};
  const keys = ledger.keys().filter((k) => k.endsWith("__default"));
  const pick = keys.find((k) => /(^|\.)(on|open|normal\.on)(__)/.test(k)) ?? keys[0];
  if (!pick) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture in the ledger"] };
  const combo = pick.slice(0, -"__default".length);
  const c = ledger.capture(pick);
  const transparent = (v: string | undefined): boolean => !v || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(v) || v === "transparent";
  const hasText = (p: LedgerPart): boolean => !!p.text && p.text.some((t) => t.trim().length > 0);
  const box = c.parts.find((p) => !transparent(p.style["background-color"]) && num(p.style.width) > 0 && (hasText(p) || c.parts.some((q) => q.idxPath.startsWith(p.idxPath === "" ? "" : p.idxPath + ".") && q.idxPath !== p.idxPath && hasText(q))));
  const roles: Partial<TooltipRoles> = {};
  const unresolved: string[] = [];
  if (box) {
    roles.box = sel(box);
    evidence.box = { selector: roles.box, why: `${box.tag}${box.classes.length ? "." + box.classes[0] : ""} is the painted part that carries (or contains) the text: bg ${box.style["background-color"]}, padding ${box.style["padding-top"]} ${box.style["padding-left"]}, radius ${box.style["border-top-left-radius"]}`, confidence: "high" };
    const textPart = hasText(box) ? box : c.parts.find((q) => q.idxPath.startsWith(box.idxPath === "" ? "" : box.idxPath + ".") && hasText(q));
    if (textPart && textPart.idxPath !== box.idxPath) { roles.label = sel(textPart); evidence.label = { selector: roles.label, why: `${textPart.tag} carries the text ${JSON.stringify(textPart.text!.find((t) => t.trim().length > 0))}`, confidence: "high" }; }
    else evidence.label = { selector: roles.box, why: "the box carries the text itself", confidence: "high" };
  } else unresolved.push("box: no painted part carries text");
  return { roles, combo, evidence, unresolved };
}
