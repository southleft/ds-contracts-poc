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
import type { ChipRoles } from "./schema-chip.js";
import type { LinkRoles } from "./schema-link.js";
import type { TabsRoles } from "./schema-tabs.js";
import type { RadioComboMap, RadioRoles } from "./schema-radio.js";
import type { TextareaComboMap, TextareaRoles } from "./schema-textarea.js";
import { ALERT_STATUSES, type AlertComboMap, type AlertRoles } from "./schema-alert.js";
import type { BadgeRoles } from "./schema-badge.js";

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
  if (pick === undefined) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture in the ledger"] };
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
  if (pick === undefined) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture in the ledger"] };
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

export interface SimpleRoleDraft<R> {
  roles: Partial<R>;
  combo: string | null;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

const pickCombo = (ledger: Ledger, prefer: RegExp): string | null => {
  const keys = ledger.keys().filter((k) => k.endsWith("__default"));
  const pick = keys.find((k) => prefer.test(k)) ?? keys[0];
  // A capture with no axes is keyed "__default": its combo is the EMPTY string, which is a combo.
  return pick === undefined ? null : pick.slice(0, -"__default".length);
};
const hasTextPart = (p: LedgerPart): boolean => !!p.text && p.text.some((t) => t.trim().length > 0);
const isTransparent = (v: string | undefined): boolean => !v || /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\)$/.test(v) || v === "transparent";

/** chip@1: the BOX is the outermost painted part (or bordered part) containing the text; the LABEL is the text part when it is a child. */
export function draftChipRoles(ledger: Ledger): SimpleRoleDraft<ChipRoles> {
  const evidence: SimpleRoleDraft<ChipRoles>["evidence"] = {};
  const combo = pickCombo(ledger, /(^|\.)(unset|default|filled\.default|md)(\.|__)/);
  if (combo === null) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture"] };
  const c = ledger.capture(`${combo}__default`);
  const painted = c.parts.filter((p) => (!isTransparent(p.style["background-color"]) || num(p.style["border-top-width"]) > 0) && num(p.style.width) > 0);
  const box = painted[0];
  const roles: Partial<ChipRoles> = {};
  const unresolved: string[] = [];
  if (!box) unresolved.push("box: no painted or bordered part");
  else {
    roles.box = sel(box);
    evidence.box = { selector: roles.box, why: `${box.tag}${box.classes[0] ? "." + box.classes[0] : ""} is the outermost painted part: ${box.style.width}×${box.style.height}, bg ${box.style["background-color"]}, radius ${box.style["border-top-left-radius"]}`, confidence: "high" };
    const textPart = hasTextPart(box) ? box : c.parts.find((q) => q.idxPath.startsWith(box.idxPath === "" ? "" : box.idxPath + ".") && q.idxPath !== box.idxPath && hasTextPart(q));
    if (!textPart) unresolved.push("label: no part carries text");
    else if (textPart.idxPath !== box.idxPath) { roles.label = sel(textPart); evidence.label = { selector: roles.label, why: `${textPart.tag}${textPart.classes[0] ? "." + textPart.classes[0] : ""} carries the text ${JSON.stringify(textPart.text!.find((t) => t.trim()))}; its padding ${textPart.style["padding-left"]} is part of the inset`, confidence: "high" }; }
    else evidence.label = { selector: roles.box, why: "the box carries the text itself", confidence: "high" };
  }
  return { roles, combo, evidence, unresolved };
}

/** link@1: the BOX is the anchor — the outermost part carrying the text (usually transparent). */
export function draftLinkRoles(ledger: Ledger): SimpleRoleDraft<LinkRoles> {
  const evidence: SimpleRoleDraft<LinkRoles>["evidence"] = {};
  const combo = pickCombo(ledger, /(^|\.)(always|unset|default)(\.|__)/);
  if (combo === null) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture"] };
  const c = ledger.capture(`${combo}__default`);
  const box = c.parts.find((p) => p.tag === "a") ?? c.parts.find(hasTextPart);
  const roles: Partial<LinkRoles> = {};
  const unresolved: string[] = [];
  if (!box) unresolved.push("box: no anchor or text part");
  else {
    roles.box = sel(box);
    evidence.box = { selector: roles.box, why: `${box.tag}${box.classes[0] ? "." + box.classes[0] : ""} is the anchor: text ${JSON.stringify((box.text ?? []).find((t) => t.trim()))}, ${box.style.color}, decoration ${box.style["text-decoration-line"]}`, confidence: box.tag === "a" ? "high" : "medium" };
    if (!hasTextPart(box)) { const t = c.parts.find((q) => q.idxPath.startsWith(box.idxPath === "" ? "" : box.idxPath + ".") && hasTextPart(q)); if (t) { roles.label = sel(t); evidence.label = { selector: roles.label, why: `${t.tag} carries the text`, confidence: "high" }; } else unresolved.push("label: no text"); }
  }
  return { roles, combo, evidence, unresolved };
}

/**
 * tabs@1 roles. TABS are the text-carrying parts (or their nearest ancestor
 * with role/class "tab" or a button) that are siblings under one LIST. The
 * SELECTED tab is the one whose text colour differs from the others'. The
 * INDICATOR is a painted absolute part no taller than 4px (MUI), else the
 * selected tab's bottom border when it has one whose colour differs from a
 * rest tab's (Carbon); a library with neither refuses by name.
 */
export function draftTabsRoles(ledger: Ledger): SimpleRoleDraft<TabsRoles> {
  const evidence: SimpleRoleDraft<TabsRoles>["evidence"] = {};
  const unresolved: string[] = [];
  const combo = pickCombo(ledger, /(^|\.)(primary\.primary|default|unset)(\.|__)/);
  if (combo === null) return { roles: {}, combo: null, evidence, unresolved: ["combo: no __default capture"] };
  const c = ledger.capture(`${combo}__default`);
  const byPath = new Map(c.parts.map((p) => [p.idxPath, p]));
  const visible = (p: LedgerPart): boolean => p.style.display !== "none" && num(p.style.width) > 0;
  // a tab: the nearest ancestor of a text part that is a button / role=tab / class containing "tab" (not the list)
  const tabOf = (t: LedgerPart): LedgerPart | null => {
    let cur: LedgerPart | null = t;
    while (cur) {
      if (cur.tag === "button" || cur.classes.some((k) => /(^|__|-)tab(s__nav-item|$|-root|-trigger)?$/i.test(k) && !/tabs$|list/i.test(k)) || (cur as { role?: string }).role === "tab") return cur;
      const parent = parentPath(cur.idxPath); cur = parent === null ? null : (byPath.get(parent) ?? null);
    }
    return null;
  };
  const texts = c.parts.filter((p) => visible(p) && hasTextPart(p));
  const tabs: LedgerPart[] = []; const labels = new Map<string, LedgerPart>();
  for (const t of texts) { const tab = tabOf(t); if (tab && visible(tab) && !tabs.some((x) => x.idxPath === tab.idxPath)) { tabs.push(tab); labels.set(tab.idxPath, t); } }
  if (tabs.length < 2) return { roles: {}, combo, evidence, unresolved: [`tabs: found ${tabs.length} tab part(s) carrying text; tabs@1 needs a selected and a rest tab`] };
  const colourOf = (tab: LedgerPart): string => (labels.get(tab.idxPath) ?? tab).style.color ?? "";
  const counts = new Map<string, number>(); for (const t of tabs) counts.set(colourOf(t), (counts.get(colourOf(t)) ?? 0) + 1);
  const selected = tabs.find((t) => counts.get(colourOf(t)) === 1 && tabs.length > 1 && counts.size > 1) ?? tabs[0]!;
  const rest = tabs.find((t) => t.idxPath !== selected.idxPath)!;
  const listPath = parentPath(selected.idxPath) ?? ""; const list = byPath.get(listPath) ?? c.parts[0]!;
  const roles: Partial<TabsRoles> = { list: sel(list), selectedTab: sel(selected), restTab: sel(rest) };
  const sl = labels.get(selected.idxPath)!, rl = labels.get(rest.idxPath)!;
  if (sl.idxPath !== selected.idxPath) roles.selectedLabel = sel(sl);
  if (rl.idxPath !== rest.idxPath) roles.restLabel = sel(rl);
  evidence.selectedTab = { selector: roles.selectedTab, why: `${selected.tag}${selected.classes[0] ? "." + selected.classes[0] : ""} "${sl.text!.find((t) => t.trim())}" — the one tab whose text colour (${colourOf(selected)}) differs from the others'`, confidence: counts.size > 1 ? "high" : "low" };
  evidence.restTab = { selector: roles.restTab, why: `${rest.tag} "${rl.text!.find((t) => t.trim())}" colour ${colourOf(rest)}`, confidence: "high" };
  evidence.list = { selector: roles.list, why: `parent of the tabs: ${list.tag}${list.classes[0] ? "." + list.classes[0] : ""}, display ${list.style.display}`, confidence: "high" };
  // An indicator is a painted absolute bar no taller than 4px and at least
  // as wide as a tab — never a 1×1 visually-hidden control (Carbon's hidden
  // close buttons are absolute, painted and 1px).
  const indicator = c.parts.find((p) => p.style.position === "absolute" && visible(p) && num(p.style.height) > 0 && num(p.style.height) <= 4 && num(p.style.width) >= Math.min(num(selected.style.width), num(rest.style.width)) * 0.5 && !isTransparent(p.style["background-color"]) && p.tag !== "button");
  if (indicator) { roles.indicator = sel(indicator); evidence.indicator = { selector: roles.indicator, why: `${indicator.tag}${indicator.classes[0] ? "." + indicator.classes[0] : ""} is an absolute painted bar ${indicator.style.width}×${indicator.style.height}, bg ${indicator.style["background-color"]}`, confidence: "high" }; }
  else if (num(selected.style["border-bottom-width"]) > 0 && selected.style["border-bottom-color"] !== rest.style["border-bottom-color"]) { roles.indicatorIsBorder = true; evidence.indicator = { selector: roles.selectedTab, why: `no indicator part; the selected tab's bottom border (${selected.style["border-bottom-width"]} ${selected.style["border-bottom-color"]}) differs from a rest tab's (${rest.style["border-bottom-color"]}) — the indicator is that border`, confidence: "medium" }; }
  else unresolved.push(`indicator: no absolute painted bar and no distinct bottom border on the selected tab (selected bg ${selected.style["background-color"]}, rest bg ${rest.style["background-color"]}) — tabs@1 draws an indicator, not a selected-tab fill`);
  return { roles, combo, evidence, unresolved };
}


export interface RadioRoleDraft {
  roles: Partial<RadioRoles>;
  combos: Partial<RadioComboMap>;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/** The radio@1 combo map is the switch's plane (OFF/ON × enabled/disabled) under the archetype's own names. */
export function draftRadioCombos(ledger: Ledger): { combos: Partial<RadioComboMap>; evidence: string[]; unresolved: string[] } {
  const sw = draftSwitchCombos(ledger);
  const rename: Record<keyof SwitchComboMap, keyof RadioComboMap> = { "false.enabled": "unselected.enabled", "false.disabled": "unselected.disabled", "true.enabled": "selected.enabled", "true.disabled": "selected.disabled" };
  const combos: Partial<RadioComboMap> = {};
  for (const [k, v] of Object.entries(sw.combos) as Array<[keyof SwitchComboMap, string]>) combos[rename[k]] = v;
  const re = (t: string): string => t.replace(/\b(false|true)\.(enabled|disabled)\b/g, (_, a: string, b: string) => `${a === "false" ? "unselected" : "selected"}.${b}`);
  return { combos, evidence: sw.evidence.map(re), unresolved: sw.unresolved.map(re) };
}

const isRound = (p: LedgerPart): boolean => {
  const r = (p.style["border-top-left-radius"] ?? "0").trim();
  const w = num(p.style.width);
  return r.endsWith("%") ? parseFloat(r) >= 50 : w > 0 && num(r) >= w / 2 - 1;
};
const isVisibleDisc = (style: Record<string, string> | undefined): boolean => {
  if (!style) return false;
  const t = style.transform ?? "none";
  const m = /^matrix\(([-0-9.e]+),/.exec(t);
  const sc = style.scale && style.scale.trim() !== "none" ? parseFloat(style.scale) : 1;
  const scale = (m ? Number(m[1]) : 1) * (Number.isFinite(sc) ? sc : 1);
  return num(style.width) * scale > 0.5 && num(style.opacity ?? "1") > 0 && !isTransparent(style["background-color"]) && style.display !== "none";
};

/**
 * Draft the radio@1 role map from a capture ledger, by what the parts DO:
 * the circle is the smallest round square whose paint changes unselected →
 * selected; the dot is what renders inside it only when selected — a part or
 * the circle's own pseudo-element; the label is the part carrying text (no
 * bare cell in radio@1: a mount without one is unresolved); the row is their
 * nearest common ancestor; the hit is the circle's parent when it is a larger
 * square; opacity is read from whichever of circle/hit/row dims when disabled.
 */
export function draftRadioRoles(ledger: Ledger): RadioRoleDraft {
  const { combos, evidence: comboEvidence, unresolved: comboUnresolved } = draftRadioCombos(ledger);
  const evidence: RadioRoleDraft["evidence"] = {};
  const unresolved: string[] = [...comboUnresolved];
  const roles: RadioRoleDraft["roles"] = {};
  evidence.combos = { selector: null, why: comboEvidence.join("; ") || "no combo resolved", confidence: comboUnresolved.length ? "low" : "high" };
  if (!combos["unselected.enabled"] || !combos["selected.enabled"]) return { roles, combos, evidence, unresolved };
  const base = ledger.capture(`${combos["unselected.enabled"]}__default`);
  const selected = ledger.capture(`${combos["selected.enabled"]}__default`);
  const disabled = combos["unselected.disabled"] ? ledger.capture(`${combos["unselected.disabled"]}__default`) : null;
  const byPath = (cap: { parts: LedgerPart[] }) => new Map(cap.parts.map((p) => [p.idxPath, p] as const));
  const baseBy = byPath(base), selBy = byPath(selected);

  // CIRCLE: the smallest round square (not svg/path/input) whose paint changes.
  const paintChanges = (p: LedgerPart): boolean => {
    const c = selBy.get(p.idxPath);
    return !!c && (p.style["background-color"] !== c.style["background-color"] || p.style["border-top-color"] !== c.style["border-top-color"]);
  };
  const squares = base.parts.filter((p) => isSquare(p) && !["svg", "path", "input", "circle"].includes(p.tag));
  const round = squares.filter((p) => isRound(p) && paintChanges(p)).sort((a, b) => num(a.style.width) - num(b.style.width));
  const anyChange = squares.filter(paintChanges).sort((a, b) => num(a.style.width) - num(b.style.width));
  const circle = round[0] ?? anyChange[0] ?? null;
  if (circle) {
    roles.circle = sel(circle);
    evidence.circle = { selector: roles.circle, why: `${round[0] ? "round" : "NOT round —"} square ${circle.style.width} ${circle.tag}${circle.classes.length ? "." + circle.classes[0] : ""} radius ${circle.style["border-top-left-radius"]} whose paint changes unselected → selected`, confidence: round[0] ? "high" : "low" };
  } else {
    unresolved.push("circle: no square part changes paint between unselected and selected");
    evidence.circle = { selector: null, why: "no candidate", confidence: "low" };
  }

  // DOT: inside the circle, visible only when selected — a descendant part, or a pseudo-element of the circle / a descendant.
  if (circle) {
    const inside = (idx: string): boolean => circle.idxPath === "" ? idx !== "" : idx.startsWith(circle.idxPath + ".");
    const cands: Array<{ part: LedgerPart; pseudo?: string; paint: "background-color" | "fill" | "color" }> = [];
    for (const p of selected.parts) {
      if (!inside(p.idxPath) && p.idxPath !== circle.idxPath) continue;
      const b = baseBy.get(p.idxPath);
      if (p.idxPath !== circle.idxPath && p.tag !== "input") {
        if (p.tag === "path" || p.tag === "circle") { if (!b || (b.style.fill ?? "") !== (p.style.fill ?? "") || !b) cands.push({ part: p, paint: "fill" }); }
        else if (isVisibleDisc(p.style) && !isVisibleDisc(b?.style)) cands.push({ part: p, paint: "background-color" });
      }
      for (const ps of Object.keys(p.pseudo)) {
        if (isVisibleDisc(p.pseudo[ps]) && !isVisibleDisc(b?.pseudo[ps])) cands.push({ part: p, pseudo: ps, paint: "background-color" });
      }
    }
    const dot = cands[0];
    if (dot) {
      roles.dot = { part: dot.part.tag === "path" || dot.part.tag === "circle" ? `tag:${dot.part.tag}` : sel(dot.part), ...(dot.pseudo ? { pseudo: dot.pseudo } : {}), paint: dot.paint };
      const st = dot.pseudo ? dot.part.pseudo[dot.pseudo]! : dot.part.style;
      evidence.dot = { selector: `${roles.dot.part}${dot.pseudo ?? ""}`, why: `${dot.pseudo ? `pseudo ${dot.pseudo} of ${dot.part.tag}` : dot.part.tag} ${st.width} transform ${st.transform ?? "none"} ${dot.paint} ${st[dot.paint]} renders only in the selected combo`, confidence: cands.length === 1 ? "high" : "medium" };
    } else {
      evidence.dot = { selector: null, why: "nothing inside the circle renders only when selected; dot leaves will be receipts", confidence: "medium" };
    }
  }

  // LABEL: the part carrying text. radio@1 has no bare cell.
  const label = base.parts.find((p) => p.text && p.text.some((t) => t.trim().length > 0) && p.tag !== "input");
  if (label) {
    roles.label = sel(label);
    evidence.label = { selector: roles.label, why: `${label.tag}${label.classes.length ? "." + label.classes[0] : ""} carries text ${JSON.stringify(label.text[0])}`, confidence: "high" };
  } else {
    unresolved.push("label: no part carries text — radio@1 has no bare cell; capture a mount with a label");
    evidence.label = { selector: null, why: "no part carries text", confidence: "low" };
  }

  // ROW: nearest common ancestor of circle and label.
  if (circle && label) {
    let a: string | null = circle.idxPath; const ancestors = new Set<string>();
    while (a !== null) { ancestors.add(a); a = parentPath(a); }
    let b: string | null = label.idxPath, common: string | null = null;
    while (b !== null) { if (ancestors.has(b)) { common = b; break; } b = parentPath(b); }
    const row = common !== null ? baseBy.get(common) : undefined;
    if (row) {
      roles.row = sel(row);
      evidence.row = { selector: roles.row, why: `nearest common ancestor of circle and label: ${row.tag} display ${row.style.display}, align-items ${row.style["align-items"]}, column-gap ${row.style["column-gap"]}; label padding-left ${label.style["padding-left"]}`, confidence: "high" };
    }
  }

  // HIT: the circle's parent when it is a larger square; else the circle.
  if (circle) {
    const pp = parentPath(circle.idxPath);
    const parent = pp !== null ? baseBy.get(pp) : undefined;
    if (parent && isSquare(parent) && num(parent.style.width) > num(circle.style.width)) {
      roles.hit = sel(parent);
      evidence.hit = { selector: roles.hit, why: `the circle's parent is a larger square (${parent.style.width}) — the hit area`, confidence: "high" };
    } else {
      roles.hit = roles.circle!;
      evidence.hit = { selector: roles.hit, why: "no larger square parent; the circle is its own hit area", confidence: "medium" };
    }
  }

  // OPACITY: whichever of circle / hit / row dims when disabled.
  if (disabled && circle) {
    const disBy = byPath(disabled);
    const cands = [circle, roles.hit !== roles.circle ? baseBy.get(roles.hit!.replace(/^idx:/, "").replace(/^root$/, "")) : undefined, roles.row ? baseBy.get(roles.row.replace(/^idx:/, "").replace(/^root$/, "")) : undefined].filter((p): p is LedgerPart => !!p);
    const dimmed = cands.find((p) => num(disBy.get(p.idxPath)?.style.opacity ?? "1") < num(p.style.opacity ?? "1"));
    roles.opacityOn = dimmed ? sel(dimmed) : roles.circle;
    evidence.opacityOn = { selector: roles.opacityOn!, why: dimmed ? `${dimmed.tag} opacity ${dimmed.style.opacity} → ${disBy.get(dimmed.idxPath)!.style.opacity} when disabled` : "nothing dims when disabled; the circle carries opacity 1", confidence: "high" };
  }

  return { roles, combos, evidence, unresolved };
}


export interface TextareaRoleDraft {
  roles: Partial<TextareaRoles>;
  combos: Partial<TextareaComboMap>;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/** textarea@1 combos: the CONTENT plane (empty/value) × the disabled plane, from the declared base cell. */
export function draftTextareaCombos(ledger: Ledger): { combos: Partial<TextareaComboMap>; evidence: string[]; unresolved: string[] } {
  const keys = ledger.keys().filter((k) => k.endsWith("__default")).map((k) => k.slice(0, -"__default".length));
  const EMPTY = /(^|\.)(empty)(\.|$)/, VALUE = /(^|\.)(value|filled)(\.|$)/;
  const DIS = /(^|\.)(disabled|isDisabled)(\.|$)/, EN = /(^|\.)(enabled|no-isDisabled)(\.|$)/;
  const combos: Partial<TextareaComboMap> = {};
  const evidence: string[] = [], unresolved: string[] = [];
  const base = ledger.baseKey?.replace(/__default$/, "");
  const swap = (k: string, from: RegExp, to: string): string => k.replace(from, (_m, pre: string, _v: string, post: string) => `${pre}${to}${post}`);
  const pick = (a: RegExp, b: RegExp): string | undefined => keys.filter((k) => a.test(k) && b.test(k)).sort((x, y) => x.length - y.length)[0];
  const cand: Record<keyof TextareaComboMap, string | undefined> =
    base && EMPTY.test(base) && EN.test(base)
      ? (() => {
          const enTok = base.match(EN)![2]!, disTok = { enabled: "disabled", "no-isDisabled": "isDisabled" }[enTok]!;
          const valueKey = keys.find((k) => k === swap(base, EMPTY, "value")) ?? keys.find((k) => k === swap(base, EMPTY, "filled"));
          const valueTok = valueKey ? valueKey.match(VALUE)![2]! : "value";
          return { "empty.enabled": base, "empty.disabled": swap(base, EN, disTok), "value.enabled": swap(base, EMPTY, valueTok), "value.disabled": swap(swap(base, EMPTY, valueTok), EN, disTok) };
        })()
      : { "empty.enabled": pick(EMPTY, EN), "empty.disabled": pick(EMPTY, DIS), "value.enabled": pick(VALUE, EN), "value.disabled": pick(VALUE, DIS) };
  for (const [fix, k] of Object.entries(cand) as Array<[keyof TextareaComboMap, string | undefined]>) {
    if (k && keys.includes(k)) { combos[fix] = k; evidence.push(`${fix} ← ${k}${base ? ` (from the declared base ${base})` : ""}`); }
    else unresolved.push(`${fix}: ${k ?? "no match"} was not captured (captured: ${keys.slice(0, 8).join(" ")}${keys.length > 8 ? " …" : ""})`);
  }
  return { combos, evidence, unresolved };
}

/**
 * Draft the textarea@1 role map by what the parts DO: the inner is the
 * <textarea> that carries the value; the box is the nearest ancestor-or-self
 * that paints (border, fill or padding) or hosts a distinct absolutely
 * positioned outline; the outline is that bordered absolute child and the
 * legend the <legend> inside it; the label is the <label> (or the text part
 * outside the box); the container their nearest common ancestor; opacity is
 * read from whichever of box/container/inner dims when disabled. No label
 * part is NOT unresolved: textarea@1 has a bare cell.
 */
export function draftTextareaRoles(ledger: Ledger): TextareaRoleDraft {
  const { combos, evidence: comboEvidence, unresolved: comboUnresolved } = draftTextareaCombos(ledger);
  const evidence: TextareaRoleDraft["evidence"] = {};
  const unresolved: string[] = [...comboUnresolved];
  const roles: TextareaRoleDraft["roles"] = {};
  evidence.combos = { selector: null, why: comboEvidence.join("; ") || "no combo resolved", confidence: comboUnresolved.length ? "low" : "high" };
  if (!combos["empty.enabled"] || !combos["value.enabled"]) return { roles, combos, evidence, unresolved };
  const base = ledger.capture(`${combos["empty.enabled"]}__default`);
  const filled = ledger.capture(`${combos["value.enabled"]}__default`);
  const disabled = combos["empty.disabled"] ? ledger.capture(`${combos["empty.disabled"]}__default`) : null;
  const byPath = (cap: { parts: LedgerPart[] }) => new Map(cap.parts.map((p) => [p.idxPath, p] as const));
  const baseBy = byPath(base), filledBy = byPath(filled);
  const paints = (p: LedgerPart): boolean => num(p.style["border-top-width"]) > 0 || !isTransparent(p.style["background-color"]) || num(p.style["padding-top"]) > 0 || num(p.style["padding-left"]) > 0;
  const childrenOf = (idx: string): LedgerPart[] => base.parts.filter((p) => parentPath(p.idxPath) === idx);
  const outlineChild = (idx: string): LedgerPart | undefined => childrenOf(idx).find((p) => p.tag !== "textarea" && p.style.position === "absolute" && num(p.style["border-top-width"]) > 0);

  // INNER: the <textarea> with a rendered height, preferring the one that carries the value.
  const textareas = filled.parts.filter((p) => p.tag === "textarea" && num(p.style.height) > 0);
  const inner = textareas.find(hasTextPart) ?? textareas[0] ?? null;
  if (inner) {
    roles.inner = sel(inner);
    evidence.inner = { selector: roles.inner, why: `textarea ${inner.style.width}×${inner.style.height}${hasTextPart(inner) ? ` carrying ${JSON.stringify(inner.text[0])} in the value combo` : ""}`, confidence: hasTextPart(inner) ? "high" : "medium" };
  } else {
    unresolved.push("inner: no <textarea> part with a rendered height");
    evidence.inner = { selector: null, why: "no candidate", confidence: "low" };
  }

  // BOX: nearest ancestor-or-self of the inner that paints or hosts an outline.
  let box: LedgerPart | null = null;
  if (inner) {
    let idx: string | null = inner.idxPath;
    while (idx !== null) {
      const p = baseBy.get(idx);
      if (p && (paints(p) || outlineChild(idx))) { box = p; break; }
      idx = parentPath(idx);
    }
    if (box) {
      roles.box = sel(box);
      const outline = outlineChild(box.idxPath);
      evidence.box = { selector: roles.box, why: `${box.tag}${box.classes.length ? "." + box.classes[0] : ""} ${box.style.width}×${box.style.height} border ${box.style["border-top-width"]} bg ${box.style["background-color"]} padding ${box.style["padding-top"]}/${box.style["padding-left"]}${outline ? ` hosting an absolute outline ${outline.tag}` : ""}`, confidence: "high" };
      if (outline) {
        roles.outline = sel(outline);
        evidence.outline = { selector: roles.outline, why: `absolute ${outline.tag} child with border ${outline.style["border-top-width"]} ${outline.style["border-top-color"]} — the outline is a distinct part`, confidence: "high" };
        const legend = base.parts.find((p) => p.tag === "legend" && p.idxPath.startsWith(outline.idxPath + "."));
        if (legend) { roles.legend = sel(legend); evidence.legend = { selector: roles.legend, why: `legend inside the outline (${legend.style.width}×${legend.style.height}) — the notched treatment`, confidence: "high" }; }
      }
    } else {
      unresolved.push("box: no ancestor-or-self of the inner textarea paints a border, fill or padding");
      evidence.box = { selector: null, why: "no candidate", confidence: "low" };
    }
  }

  // LABEL: a <label>, else a text part outside the box (never the inner). Absent = the bare cell.
  const insideBox = (idx: string): boolean => !!box && (box.idxPath === "" ? true : idx === box.idxPath || idx.startsWith(box.idxPath + "."));
  const label = base.parts.find((p) => p.tag === "label" && hasTextPart(p)) ?? base.parts.find((p) => hasTextPart(p) && p.tag !== "textarea" && p.tag !== "input" && !insideBox(p.idxPath));
  if (label) {
    roles.label = sel(label);
    evidence.label = { selector: roles.label, why: `${label.tag}${label.classes.length ? "." + label.classes[0] : ""} carries text ${JSON.stringify(label.text.find((t) => t.trim()))} — position ${label.style.position}, transform ${label.style.transform} → ${filledBy.get(label.idxPath)?.style.transform} in the value combo`, confidence: "high" };
  } else {
    evidence.label = { selector: null, why: "no label part — the bare cell; the recipe compiles no label node and every label leaf is the bare-cell spelling", confidence: "high" };
  }

  // CONTAINER: nearest common ancestor of label and box.
  if (box && label) {
    let a: string | null = box.idxPath; const ancestors = new Set<string>();
    while (a !== null) { ancestors.add(a); a = parentPath(a); }
    let b: string | null = parentPath(label.idxPath), common: string | null = null;
    while (b !== null) { if (ancestors.has(b) && b !== box.idxPath) { common = b; break; } b = parentPath(b); }
    const container = common !== null ? baseBy.get(common) : undefined;
    if (container) {
      roles.container = sel(container);
      evidence.container = { selector: roles.container, why: `nearest common ancestor of label and box: ${container.tag} display ${container.style.display}, row-gap ${container.style["row-gap"]}`, confidence: "high" };
    }
  }

  // OPACITY: whichever of box / container / inner dims when disabled.
  if (disabled && box) {
    const disBy = byPath(disabled);
    const cands = [box, roles.container ? baseBy.get(roles.container.replace(/^idx:/, "").replace(/^root$/, "")) : undefined, inner].filter((p): p is LedgerPart => !!p);
    const dimmed = cands.find((p) => num(disBy.get(p.idxPath)?.style.opacity ?? "1") < num(p.style.opacity ?? "1"));
    roles.opacityOn = dimmed ? sel(dimmed) : roles.box;
    evidence.opacityOn = { selector: roles.opacityOn!, why: dimmed ? `${dimmed.tag} opacity ${dimmed.style.opacity} → ${disBy.get(dimmed.idxPath)!.style.opacity} when disabled` : "nothing dims when disabled; the box carries opacity 1", confidence: "high" };
  }

  return { roles, combos, evidence, unresolved };
}


export interface AlertRoleDraft {
  roles: Partial<AlertRoles>;
  combos: Partial<AlertComboMap>;
  evidence: Record<string, { selector: string | null; why: string; confidence: "high" | "medium" | "low" }>;
  unresolved: string[];
}

/**
 * alert@1 combos: one captured combo per status. The declared base cell may
 * lack the status icon (AntD's base is showIcon=false), so among the cells
 * that share the base's other tokens the drafter takes the NEAREST pattern
 * (fewest tokens changed) whose svg paint changes across the four statuses
 * — the status icon, not a close button.
 */
export function draftAlertCombos(ledger: Ledger): { combos: Partial<AlertComboMap>; evidence: string[]; unresolved: string[] } {
  const keys = ledger.keys().filter((k) => k.endsWith("__default")).map((k) => k.slice(0, -"__default".length));
  const STATUS = /(^|\.)(info|success|warning|error)(\.|$)/;
  const combos: Partial<AlertComboMap> = {};
  const evidence: string[] = [], unresolved: string[] = [];
  const base = ledger.baseKey?.replace(/__default$/, "");
  const withStatus = (pattern: string, status: string): string => pattern.replace("{status}", status);
  const patterns = new Map<string, number>(); // pattern → token distance from the base pattern
  const basePattern = base && STATUS.test(base) ? base.replace(STATUS, (_m, pre: string, _v: string, post: string) => `${pre}{status}${post}`) : null;
  for (const k of keys) {
    if (!STATUS.test(k)) continue;
    const pat = k.replace(STATUS, (_m, pre: string, _v: string, post: string) => `${pre}{status}${post}`);
    if (patterns.has(pat)) continue;
    const dist = basePattern ? pat.split(".").filter((t, i) => t !== basePattern.split(".")[i]).length + Math.abs(pat.split(".").length - basePattern.split(".").length) : pat.length;
    patterns.set(pat, dist);
  }
  const svgPaintChanges = (pat: string): boolean => {
    const caps = ALERT_STATUSES.map((st) => withStatus(pat, st)).filter((k) => keys.includes(k)).map((k) => ledger.capture(`${k}__default`));
    if (caps.length !== ALERT_STATUSES.length) return false;
    const svgs = caps[0]!.parts.filter((p) => p.tag === "svg");
    return svgs.some((svg) => caps.slice(1).some((c) => { const o = c.parts.find((p) => p.idxPath === svg.idxPath); return !!o && ((o.style.fill ?? "") !== (svg.style.fill ?? "") || (o.style.color ?? "") !== (svg.style.color ?? "")); }));
  };
  const ordered = [...patterns.entries()].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).map(([pat]) => pat);
  const chosen = ordered.find(svgPaintChanges) ?? ordered.find((pat) => ALERT_STATUSES.every((st) => keys.includes(withStatus(pat, st))));
  if (!chosen) {
    unresolved.push(`no captured cell pattern carries all four statuses (captured: ${keys.slice(0, 8).join(" ")}${keys.length > 8 ? " …" : ""})`);
    return { combos, evidence, unresolved };
  }
  const why = chosen === basePattern ? `the declared base cell ${base}` : `the nearest cell to the declared base ${base ?? "(none)"} whose svg paint changes across statuses (${patterns.get(chosen)} token(s) changed)${svgPaintChanges(chosen) ? "" : " — NOTE: no svg paint changes across statuses in any pattern; the first complete pattern was taken"}`;
  for (const status of ALERT_STATUSES) {
    const k = withStatus(chosen, status);
    if (keys.includes(k)) { combos[status] = k; evidence.push(`${status} ← ${k} (${why})`); }
    else unresolved.push(`${status}: ${k} was not captured`);
  }
  return { combos, evidence, unresolved };
}

/**
 * Draft the alert@1 role map by what the parts DO: the icon is the first svg
 * whose paint changes across statuses, its path the svg's one drawn path
 * (two or more is unresolved — alert@1 carries one filled glyph), the wrapper
 * the svg's parent when it is not the box; the title is the text part; the
 * box is the nearest common ancestor of icon and title that paints.
 */
export function draftAlertRoles(ledger: Ledger): AlertRoleDraft {
  const { combos, evidence: comboEvidence, unresolved: comboUnresolved } = draftAlertCombos(ledger);
  const evidence: AlertRoleDraft["evidence"] = {};
  const unresolved: string[] = [...comboUnresolved];
  const roles: AlertRoleDraft["roles"] = {};
  evidence.combos = { selector: null, why: comboEvidence.join("; ") || "no combo resolved", confidence: comboUnresolved.length ? "low" : "high" };
  if (!combos.info) return { roles, combos, evidence, unresolved };
  const base = ledger.capture(`${combos.info}__default`);
  const other = ALERT_STATUSES.filter((s) => s !== "info" && combos[s]).map((s) => ledger.capture(`${combos[s]}__default`));
  const byPath = (cap: { parts: LedgerPart[] }) => new Map(cap.parts.map((p) => [p.idxPath, p] as const));
  const baseBy = byPath(base);
  const otherBy = other.map(byPath);
  const paintChanges = (p: LedgerPart, channels: string[]): boolean => otherBy.some((m) => { const o = m.get(p.idxPath); return !!o && channels.some((ch) => (o.style[ch] ?? "") !== (p.style[ch] ?? "")); });

  // TITLE: the text part.
  const title = base.parts.find(hasTextPart);
  if (title) { roles.title = sel(title); evidence.title = { selector: roles.title, why: `${title.tag}${title.classes.length ? "." + title.classes[0] : ""} carries text ${JSON.stringify(title.text.find((t) => t.trim()))}`, confidence: "high" }; }
  else { unresolved.push("title: no part carries text"); evidence.title = { selector: null, why: "no candidate", confidence: "low" }; }

  // ICON: an svg whose fill/color changes across statuses (else the first svg).
  const svgs = base.parts.filter((p) => p.tag === "svg");
  const icon = svgs.find((p) => paintChanges(p, ["fill", "color"])) ?? svgs[0] ?? null;
  if (icon) {
    roles.icon = sel(icon);
    evidence.icon = { selector: roles.icon, why: `svg ${icon.style.width}×${icon.style.height} fill ${icon.style.fill}${paintChanges(icon, ["fill", "color"]) ? " — its paint changes across statuses" : " (the only svg; paint does not change across statuses)"}`, confidence: paintChanges(icon, ["fill", "color"]) ? "high" : "medium" };
    const paths = base.parts.filter((p) => p.tag === "path" && p.idxPath.startsWith(icon.idxPath + "."));
    if (paths.length === 1) { roles.iconPath = sel(paths[0]!); evidence.iconPath = { selector: roles.iconPath, why: `the svg's one path, fill ${paths[0]!.style.fill}, fill-rule ${paths[0]!.style["fill-rule"]}, d=${(paths[0]!.style.d ?? "").slice(0, 40)}…`, confidence: "high" }; }
    else unresolved.push(`iconPath: the icon svg has ${paths.length} path children — alert@1 carries one filled glyph per status`);
    const pp = parentPath(icon.idxPath);
    const parent = pp !== null ? baseBy.get(pp) : undefined;
    if (parent && parent.idxPath !== "" && !hasTextPart(parent)) {
      roles.iconWrap = sel(parent);
      evidence.iconWrap = { selector: roles.iconWrap, why: `the svg's parent ${parent.tag} (opacity ${parent.style.opacity}, margin-right ${parent.style["margin-right"]})`, confidence: "high" };
    }
  } else { unresolved.push("icon: no svg part"); evidence.icon = { selector: null, why: "no candidate", confidence: "low" }; }

  // BOX: nearest common ancestor of icon and title that paints (fill or border), else the root.
  if (icon && title) {
    let a: string | null = icon.idxPath; const ancestors = new Set<string>();
    while (a !== null) { ancestors.add(a); a = parentPath(a); }
    let b: string | null = title.idxPath, common: string | null = null;
    while (b !== null) { if (ancestors.has(b) && b !== icon.idxPath && b !== title.idxPath) { common = b; break; } b = parentPath(b); }
    let idx: string | null = common;
    let box: LedgerPart | undefined;
    while (idx !== null) { const p = baseBy.get(idx); if (p && (!isTransparent(p.style["background-color"]) || num(p.style["border-top-width"]) > 0)) { box = p; break; } idx = parentPath(idx); }
    box = box ?? baseBy.get("");
    if (box) {
      roles.box = sel(box);
      if (roles.iconWrap === roles.box) delete roles.iconWrap;
      evidence.box = { selector: roles.box, why: `${box.tag}${box.classes.length ? "." + box.classes[0] : ""} bg ${box.style["background-color"]} border ${box.style["border-top-width"]} padding ${box.style["padding-top"]}/${box.style["padding-left"]} gap ${box.style["column-gap"]} — the painted ancestor of icon and title`, confidence: "high" };
    }
  }
  return { roles, combos, evidence, unresolved };
}


/**
 * Draft the badge@1 role map by what the parts DO: the pip is the absolutely
 * positioned part with a transform translation that carries text (itself or
 * a descendant); the host is the largest square sibling-or-ancestor part that
 * paints; the label is the innermost descendant of the pip that carries the
 * count when the pip itself does not. The cell is the declared base, else the
 * one whose tokens say default/standard/unset.
 */
export function draftBadgeRoles(ledger: Ledger): SimpleRoleDraft<BadgeRoles> {
  const evidence: SimpleRoleDraft<BadgeRoles>["evidence"] = {};
  const unresolved: string[] = [];
  const roles: Partial<BadgeRoles> = {};
  const combo = pickCombo(ledger, /(^|\.)(default|standard|unset|count)(\.|$)/);
  if (combo === null) { unresolved.push("combo: no captured cell"); return { roles, combo: null, evidence, unresolved }; }
  const cap = ledger.capture(`${combo}__default`);
  const byPath = new Map(cap.parts.map((p) => [p.idxPath, p] as const));
  const carriesText = (p: LedgerPart): boolean => hasTextPart(p) || cap.parts.some((c) => c.idxPath.startsWith(p.idxPath + ".") && hasTextPart(c));
  const pip = cap.parts.find((p) => p.style.position === "absolute" && /^matrix/.test(p.style.transform ?? "") && carriesText(p) && p.tag !== "input");
  if (pip) {
    roles.indicator = sel(pip);
    evidence.indicator = { selector: roles.indicator, why: `absolute ${pip.tag}${pip.classes.length ? "." + pip.classes[0] : ""} ${pip.style.width}×${pip.style.height} transform ${pip.style.transform}, top ${pip.style.top} right ${pip.style.right}, carrying the count`, confidence: "high" };
    if (!hasTextPart(pip)) {
      const inner = cap.parts.filter((p) => p.idxPath.startsWith(pip.idxPath + ".") && hasTextPart(p)).sort((a, b) => b.idxPath.length - a.idxPath.length)[0];
      if (inner) { roles.label = sel(inner); evidence.label = { selector: roles.label, why: `${inner.tag} inside the pip carries the count ${JSON.stringify(inner.text.find((t) => t.trim()))}`, confidence: "high" }; }
    }
  } else unresolved.push("indicator: no absolutely positioned, translated part carries the count");
  const host = cap.parts.filter((p) => p !== pip && !(pip && p.idxPath.startsWith(pip.idxPath + ".")) && isSquare(p) && (!isTransparent(p.style["background-color"]) || num(p.style["border-top-width"]) > 0) && p.tag !== "input").sort((a, b) => num(b.style.width) - num(a.style.width))[0];
  if (host) { roles.host = sel(host); evidence.host = { selector: roles.host, why: `square ${host.style.width} ${host.tag}${host.classes.length ? "." + host.classes[0] : ""} bg ${host.style["background-color"]} — the anchored host`, confidence: "high" }; }
  else unresolved.push("host: no painted square part besides the pip");
  void byPath;
  return { roles, combo, evidence, unresolved };
}
