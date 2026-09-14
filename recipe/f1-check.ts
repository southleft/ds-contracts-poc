/**
 * F1 — the code→canvas held-out exam, both rows through ONE gate.
 *
 * docs/26 (amendment) names F1 as one of the two exams `overallSuccess` waits
 * on. Until now its two rows were held by two different instruments: the
 * calendar row by `recipe:f1-held-out:check` (which pins the compile, not the
 * score — the score was taken out of band on 2026-09-05) and the Radix rows by
 * the fidelity gate's ratchet (which cannot tell an F1 row from a boilerplate
 * stay). This gate re-derives both rows from committed bytes and refuses by
 * name when either moves.
 *
 * Row 1 — calendar (react-day-picker@10.0.1). The canvas shot committed under
 *   recipe/evidence/f1-held-out-v1/score/ is RE-SCORED here against the real
 *   render (`extract/computed/out/day-picker/calendar/orig-shots/…`) with the
 *   same scorer the fidelity gate uses. Red if the hash of either PNG differs
 *   from the pins in scorecard.json, if the number moves, or if the bar is
 *   missed. The ink-box caveat (thresholdSweep never agrees; 16px on the first
 *   mint, 2px after the 2026-09-13 re-mint) is RECORDED, not required — the
 *   residual is named in F1-COMPILE-ROUND.md, and naming is not fixing.
 *
 * Row 2 — Radix Themes (@radix-ui/themes@3.3.0) through `recipe:point`, the
 *   five selected archetypes from the library. Each is in exactly one state:
 *     scored             manifest rows carry heldOut:"radix-themes"; re-scored
 *                        by the fidelity scorer; must PASS, or be a KNOWN row of
 *                        a font class whose glyph-masked pass is green.
 *     refused-at-roles   the drafter refuses from the committed ledger; its
 *                        unresolved lines are reproduced HERE and pinned
 *                        verbatim — a drafter that later learns the shape flips
 *                        this row and the receipt must be regenerated.
 *     mint-refused       pointed and compiled (proposal.json committed), no
 *                        manifest row, and a committed mint-refusal.json names
 *                        the Figma message. The one outcome this gate cannot
 *                        re-run offline; it is carried as a quoted claim, and
 *                        removed the moment the archetype mints.
 *   An archetype in none of these states is UNACCOUNTED → red.
 *
 * Offline by construction. No grade is minted: `overallSuccess` stays false
 * and `humanGrade` stays "not-run" until the owner signs (docs/26 amendment).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runFidelity, type Subject } from "./fidelity-check.js";
import { FIDELITY_BAR, scoreFidelity } from "./fidelity-score.js";
import { assertF1Score } from "./f1-row-policy.js";
import {
  draftAvatarRoles,
  draftBadgeRoles,
  draftCheckboxRoles,
  draftSwitchRoles,
  draftTabsRoles,
} from "./fixture-reader/draft-roles.js";
import { Ledger } from "./fixture-reader/ledger.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE = path.join(REPO, "recipe/evidence/f1-v1");
const MANIFEST = path.join(REPO, "recipe/fidelity-manifest.json");

/** Row 1 pins. */
const CALENDAR = {
  library: "day-picker",
  subject: "react-day-picker@10.0.1 DayPicker (calendar@1)",
  scorecard: "recipe/evidence/f1-held-out-v1/score/scorecard.json",
  canvas: "recipe/evidence/f1-held-out-v1/score/canvas.png",
  reference: "extract/computed/out/day-picker/calendar/orig-shots/label.1__default.png",
  mintedOn: "Scratch (byMp6lt0Ij9b2QbkDGFwBh): 2026-09-05, re-minted 2026-09-13 (page Recipe Pivot / Calendar / 8d74efd3-calendar-v50, calendar/set 270:2663)",
  receipt: "parity/receipts/v1/F1-COMPILE-ROUND.md",
} as const;

/** Row 2: the held-out library and the selected exam archetypes. */
const RADIX = {
  library: "radix-themes",
  package: "@radix-ui/themes@3.3.0",
  receipt: "parity/receipts/v1/F1-RADIX-ROUND.md",
  /** Five selected `recipe:point` archetypes, not the library's full inventory. */
  archetypes: ["avatar", "switch", "checkbox", "badge", "tabs"] as const,
} as const;
type RadixArchetype = (typeof RADIX.archetypes)[number];

const DRAFTERS: Record<RadixArchetype, (ledger: Ledger) => { unresolved: string[] }> = {
  avatar: draftAvatarRoles,
  switch: draftSwitchRoles,
  checkbox: draftCheckboxRoles,
  badge: draftBadgeRoles,
  tabs: draftTabsRoles,
};

const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");
const round = (n: number): number => Math.round(n * 1000) / 1000;

export interface CalendarRow {
  library: string;
  subject: string;
  mintedOn: string;
  canvas: { path: string; sha256: string };
  reference: { path: string; sha256: string };
  status: "pass" | "fail";
  pctAAMasked: number;
  canvasPx: string;
  realPx: string;
  /** false today: the named ink-box gap (16px → 2px on 2026-09-13; F1-COMPILE-ROUND.md). Recorded, not required. */
  thresholdSweepAgrees: boolean;
  receipt: string;
}

export type RadixOutcome =
  | { archetype: RadixArchetype; outcome: "scored"; rows: Array<{ label: string; status: "pass" | "fail" | "fringe"; pctAAMasked: number; glyphMasked?: number | null; known?: string }> }
  | { archetype: RadixArchetype; outcome: "refused-at-roles"; combo: string | null; unresolved: string[] }
  | { archetype: RadixArchetype; outcome: "mint-refused"; pointed: string; mintRefusal: { recordedAt: string; message: string; cause: string; fix: string; figmaWrites: number } };

export interface F1Receipt {
  artifactVersion: "f1-v1";
  overallSuccess: false;
  humanGrade: string;
  bar: typeof FIDELITY_BAR;
  rows: { calendar: CalendarRow; radix: { library: string; package: string; receipt: string; archetypes: RadixOutcome[] } };
  summary: { calendar: string; radix: { scored: number; scoredRows: number; refusedAtRoles: number; mintRefused: number } };
  notClaimed: string[];
}

function scoreCalendar(): CalendarRow {
  for (const p of [CALENDAR.scorecard, CALENDAR.canvas, CALENDAR.reference]) {
    if (!existsSync(path.join(REPO, p))) throw new Error(`F1 calendar: missing ${p}`);
  }
  const pinned = JSON.parse(readFileSync(path.join(REPO, CALENDAR.scorecard), "utf8")) as {
    status: string;
    metrics: { pctAAMasked: number; canvasPx: string; realPx: string };
    canvas: { sha256: string };
    reference: { path: string; sha256: string };
    referenceCroppedToControl: boolean;
    canvasCroppedToControl: boolean;
  };
  if (pinned.reference.path !== CALENDAR.reference) throw new Error(`F1 calendar: scorecard pins reference ${pinned.reference.path}, gate expects ${CALENDAR.reference}`);
  const canvasSha = sha256(path.join(REPO, CALENDAR.canvas));
  const refSha = sha256(path.join(REPO, CALENDAR.reference));
  if (canvasSha !== pinned.canvas.sha256) throw new Error(`F1 calendar: canvas.png sha ${canvasSha.slice(0, 12)}… ≠ scorecard pin ${pinned.canvas.sha256.slice(0, 12)}… — the shot moved`);
  if (refSha !== pinned.reference.sha256) throw new Error(`F1 calendar: reference sha ${refSha.slice(0, 12)}… ≠ scorecard pin ${pinned.reference.sha256.slice(0, 12)}… — the real render moved`);
  const card = scoreFidelity(
    path.join(REPO, CALENDAR.canvas),
    path.join(REPO, CALENDAR.reference),
    "calendar/day-picker",
    path.join(os.tmpdir(), "f1-calendar.diff.png"),
    pinned.referenceCroppedToControl,
    pinned.canvasCroppedToControl,
  );
  const pct = card.metrics.pctAAMasked ?? card.metrics.pctAAUnmasked;
  if (round(pct) !== round(pinned.metrics.pctAAMasked)) {
    throw new Error(`F1 calendar: re-score ${round(pct)}% ≠ pinned ${round(pinned.metrics.pctAAMasked)}% — same bytes, different number: the scorer moved`);
  }
  if (card.status !== "pass") throw new Error(`F1 calendar: ${round(pct)}% misses the ${FIDELITY_BAR.pctAAMaskedMax}% bar`);
  return {
    library: CALENDAR.library,
    subject: CALENDAR.subject,
    mintedOn: CALENDAR.mintedOn,
    canvas: { path: CALENDAR.canvas, sha256: canvasSha },
    reference: { path: CALENDAR.reference, sha256: refSha },
    status: card.status,
    pctAAMasked: round(pct),
    canvasPx: card.metrics.canvasPx,
    realPx: card.metrics.realPx,
    thresholdSweepAgrees: card.thresholdSweep.some((r) => r.agree),
    receipt: CALENDAR.receipt,
  };
}

function accountRadix(): RadixOutcome[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { subjects: Array<Subject & { _proposedWhy?: string; _heldOutWhy?: string }> };
  const heldOut = manifest.subjects.filter((s) => s.heldOut === RADIX.library);
  for (const s of heldOut) {
    if (s._proposedWhy !== undefined) throw new Error(`F1 radix: ${s.label} carries _proposedWhy — a held-out row is never a proposed stay (the plugin-target proof would sweep its page)`);
    if (typeof s._heldOutWhy !== "string" || s._heldOutWhy.length === 0) throw new Error(`F1 radix: ${s.label} has no _heldOutWhy`);
  }
  const { run, known } = heldOut.length > 0 ? runFidelity((s) => s.heldOut === RADIX.library) : { run: { rows: [] as Array<{ label: string; status: "pass" | "fail" | "fringe"; pctAAMasked: number; glyphMasked?: number | null }> }, known: {} as Record<string, { cause: string; class: string }> };

  const outcomes: RadixOutcome[] = [];
  for (const archetype of RADIX.archetypes) {
    const ledgerRel = `extract/computed/out/${RADIX.library}/${archetype}/captured-truth.json`;
    if (!existsSync(path.join(REPO, ledgerRel))) throw new Error(`F1 radix: ${archetype} has no committed capture ledger at ${ledgerRel}`);
    const rows = run.rows.filter((r) => r.label === `${archetype}/${RADIX.library}` || r.label.startsWith(`${archetype}/${RADIX.library}-`));
    if (rows.length > 0) {
      for (const r of rows) assertF1Score(r, known[r.label]);
      outcomes.push({
        archetype,
        outcome: "scored",
        rows: rows.map((r) => ({ label: r.label, status: r.status, pctAAMasked: r.pctAAMasked, ...(r.glyphMasked !== undefined ? { glyphMasked: r.glyphMasked } : {}), ...(known[r.label] ? { known: `${known[r.label]!.class}: ${known[r.label]!.cause}` } : {}) })),
      });
      continue;
    }
    const pointed = `recipe/evidence/pointed/${archetype}-${RADIX.library}`;
    const refusalFile = path.join(REPO, pointed, "mint-refusal.json");
    if (existsSync(path.join(REPO, pointed, "proposal.json"))) {
      if (!existsSync(refusalFile)) throw new Error(`F1 radix: ${archetype} is pointed and compiled (${pointed}/proposal.json) but has neither fidelity rows nor ${pointed}/mint-refusal.json — unaccounted`);
      const mr = JSON.parse(readFileSync(refusalFile, "utf8")) as { recordedAt: string; message: string; cause: string; fix: string; figmaWrites: number };
      for (const f of ["recordedAt", "message", "cause", "fix"] as const) if (typeof mr[f] !== "string" || mr[f].length === 0) throw new Error(`F1 radix: ${pointed}/mint-refusal.json has no ${f}`);
      if (mr.figmaWrites !== 0) throw new Error(`F1 radix: ${pointed}/mint-refusal.json claims figmaWrites ${String(mr.figmaWrites)} — a refused mint writes nothing`);
      outcomes.push({ archetype, outcome: "mint-refused", pointed, mintRefusal: { recordedAt: mr.recordedAt, message: mr.message, cause: mr.cause, fix: mr.fix, figmaWrites: 0 } });
      continue;
    }
    // Reproduce the role-step refusal from the committed ledger, offline.
    const draft = DRAFTERS[archetype](new Ledger(REPO, ledgerRel));
    if (draft.unresolved.length === 0) throw new Error(`F1 radix: ${archetype} drafts its roles from the ledger with nothing unresolved, yet has no pointed evidence and no fidelity rows — run recipe:point on it and account for the result`);
    outcomes.push({ archetype, outcome: "refused-at-roles", combo: (draft as { combo?: string | null }).combo ?? null, unresolved: draft.unresolved });
  }
  return outcomes;
}

export function buildF1Receipt(): F1Receipt {
  const calendar = scoreCalendar();
  const archetypes = accountRadix();
  const scored = archetypes.filter((a): a is Extract<RadixOutcome, { outcome: "scored" }> => a.outcome === "scored");
  return {
    artifactVersion: "f1-v1",
    overallSuccess: false,
    humanGrade: "not-run — the owner grades both rows together; this gate measures, it never grades (docs/26 amendment)",
    bar: FIDELITY_BAR,
    rows: {
      calendar,
      radix: { library: RADIX.library, package: RADIX.package, receipt: RADIX.receipt, archetypes },
    },
    summary: {
      calendar: `${calendar.status} ${calendar.pctAAMasked}% (bar ${FIDELITY_BAR.pctAAMaskedMax}%); ink boxes ${calendar.canvasPx} vs ${calendar.realPx}; threshold sweep agrees: ${String(calendar.thresholdSweepAgrees)}`,
      radix: {
        scored: scored.length,
        scoredRows: scored.reduce((n, a) => n + a.rows.length, 0),
        refusedAtRoles: archetypes.filter((a) => a.outcome === "refused-at-roles").length,
        mintRefused: archetypes.filter((a) => a.outcome === "mint-refused").length,
      },
    },
    notClaimed: [
      "No grade. overallSuccess is false until the owner signs; a green gate is a measurement, not a pass.",
      "The calendar row's threshold sweep never agrees — 2px on both axes after the 2026-09-13 re-mint (16px before): the caption glyph's placement in its line box, and a text-glyph chevron where the source draws an SVG path. Recorded above, required by nothing here; named in F1-COMPILE-ROUND.md.",
      "The calendar lineage is outside the thirteen archetypes recipe:point ships; a stranger reaches the Radix rows, not this one.",
      "Radix Themes was captured once before (2026-09-04, legacy chain): not a first-pass measurement.",
      "A mint-refused row is a quoted Figma message this gate cannot re-run; it is removed, not excused, when the archetype mints.",
    ],
  };
}

function renderReadme(r: F1Receipt): string {
  const radixLines = r.rows.radix.archetypes.map((a) => {
    if (a.outcome === "scored") return `| ${a.archetype} | scored | ${a.rows.map((row) => `${row.label.replace(`${a.archetype}/`, "")} **${row.status}** ${row.pctAAMasked}%${row.known ? ` (known: ${row.known})` : ""}`).join(" · ")} |`;
    if (a.outcome === "refused-at-roles") return `| ${a.archetype} | refused at the role step | ${a.unresolved.map((u) => `\`${u}\``).join("; ")} |`;
    return `| ${a.archetype} | compiled; mint refused by name | \`${a.mintRefusal.message}\` — ${a.mintRefusal.fix} |`;
  });
  return [
    "# F1 — both rows, one gate (`npm run recipe:f1:check`)",
    "",
    "Generated by `recipe/f1-check.ts`; `--check` refuses when any byte here would change.",
    `overallSuccess: **${String(r.overallSuccess)}** · humanGrade: ${r.humanGrade}`,
    "",
    "## Row 1 — calendar (react-day-picker)",
    "",
    `${r.summary.calendar}. Canvas \`${r.rows.calendar.canvas.path}\` (sha ${r.rows.calendar.canvas.sha256.slice(0, 12)}…) re-scored against \`${r.rows.calendar.reference.path}\`. Receipt: ${r.rows.calendar.receipt}.`,
    "",
    `## Row 2 — ${r.rows.radix.package} through recipe:point`,
    "",
    "| archetype | outcome | detail |",
    "| --- | --- | --- |",
    ...radixLines,
    "",
    `Scored ${r.summary.radix.scored} archetype(s) / ${r.summary.radix.scoredRows} row(s) · refused at roles ${r.summary.radix.refusedAtRoles} · mint refused ${r.summary.radix.mintRefused}. Receipt: ${r.rows.radix.receipt}.`,
    "",
    "## Not claimed",
    "",
    ...r.notClaimed.map((n) => `- ${n}`),
    "",
  ].join("\n");
}

function main(): void {
  const check = process.argv.includes("--check");
  const receipt = buildF1Receipt();
  const artifacts: Record<string, string> = {
    "receipt.json": `${JSON.stringify(receipt, null, 2)}\n`,
    "README.md": renderReadme(receipt),
  };
  if (check) {
    const stale: string[] = [];
    for (const [name, bytes] of Object.entries(artifacts)) {
      const onDisk = existsSync(path.join(EVIDENCE, name)) ? readFileSync(path.join(EVIDENCE, name), "utf8") : "";
      if (onDisk !== bytes) stale.push(name);
    }
    if (stale.length > 0) throw new Error(`f1-v1 stale: ${stale.join(", ")} — the measurement moved; rerun \`tsx recipe/f1-check.ts\` and commit what it says`);
    if ((receipt as { overallSuccess: boolean }).overallSuccess !== false) throw new Error("F1 must not claim overallSuccess");
  } else {
    mkdirSync(EVIDENCE, { recursive: true });
    for (const [name, bytes] of Object.entries(artifacts)) writeFileSync(path.join(EVIDENCE, name), bytes);
  }
  const c = receipt.rows.calendar;
  console.log(`F1 calendar   ${c.status.toUpperCase()} ${c.pctAAMasked}%  canvas ${c.canvasPx} real ${c.realPx}  sweep agrees: ${String(c.thresholdSweepAgrees)}`);
  for (const a of receipt.rows.radix.archetypes) {
    if (a.outcome === "scored") console.log(`F1 radix      ${a.archetype.padEnd(9)} scored   ${a.rows.map((r) => `${r.status} ${r.pctAAMasked}%`).join(" · ")}`);
    else if (a.outcome === "refused-at-roles") console.log(`F1 radix      ${a.archetype.padEnd(9)} refused at roles: ${a.unresolved[0]}${a.unresolved.length > 1 ? ` (+${a.unresolved.length - 1})` : ""}`);
    else console.log(`F1 radix      ${a.archetype.padEnd(9)} mint refused: ${a.mintRefusal.message}`);
  }
  console.log(check ? "✔ recipe:f1:check — measured, not graded (overallSuccess false)" : `→ ${path.relative(REPO, EVIDENCE)}/`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
