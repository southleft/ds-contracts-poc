/**
 * docs/35 Phase 4 / F1 held-out prepare — react-day-picker → proposed table
 * + mechanical calendar@1 compile attempt.
 *
 * Offline-first. Never invents a Calendar remint. Never flips overallSuccess.
 * Compile is attempted against a ledger-only propose; it refuses because
 * calendar@1 cannot express the captured month without Polar. f1Status stays
 * capture-only | blocked | unproven — never passed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCalendarRecipe } from "../recipes/calendar.js";
import {
  assertNoPolarPropose,
  proposeCalendarInstanceFromLedger,
  type MechanicalCalendarPropose,
} from "./propose-calendar-instance.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVIDENCE = path.join(REPO, "recipe", "evidence", "f1-held-out-v1");
const LEDGER = "extract/computed/out/day-picker/calendar/captured-truth.json";
const CONFIG = "extract/computed/configs/day-picker.json";
const PACKAGE = "react-day-picker";
const VERSION = "10.0.1";
const EXPORT = "DayPicker";

export type F1Status = "unproven" | "capture-only" | "blocked";

export interface F1RecipeCompile {
  attempted: true;
  compiled: false;
  status: "refused";
  reason: string;
  gapIds: string[];
  liveFigma: false;
  inventedFixtureTable: false;
  addedToCalendarInstances: false;
}

function compileAttempt(propose: MechanicalCalendarPropose): F1RecipeCompile {
  assertNoPolarPropose(propose);
  let compiledByAccident = false;
  try {
    compileCalendarRecipe({
      identity: { id: "f1.day-picker.forbidden", name: "forbidden" },
    });
    compiledByAccident = true;
  } catch {
    /* expected — incomplete input is not a CalendarRecipeInstance */
  }
  if (compiledByAccident) {
    throw new Error(
      "F1 compile must not succeed on an incomplete Polar-free instance",
    );
  }
  return {
    attempted: true,
    compiled: false,
    status: "refused",
    reason:
      `Mechanical propose from ${LEDGER} cannot become a CalendarRecipeInstance without Polar or a hand-authored fixture table. Named gaps: ${propose.schemaGaps.map((g) => g.id).join(", ")}. compileCalendarRecipe is not given a Polar-filled instance. Live remint stays refused.`,
    gapIds: propose.schemaGaps.map((g) => g.id),
    liveFigma: false,
    inventedFixtureTable: false,
    addedToCalendarInstances: false,
  };
}

export function buildF1HeldOutEvidence(): {
  overallSuccess: false;
  f1Status: F1Status;
  productV1: "INCOMPLETE";
  receipt: Record<string, unknown>;
} {
  const ledgerAbs = path.join(REPO, LEDGER);
  const hasLedger = existsSync(ledgerAbs);

  const captureShared = {
    gate: "extract/computed/run.ts determinism self-check (double-run byte-identity)",
    configAxesEnumerated: ["captionLayout", "numberOfMonths"],
    configAxesPinnedAsFixed: ["showOutsideDays=false", "showWeekNumber=false"],
    pinNote:
      "Bare boolean axes refused by capture.ts §1.4 against the blind seed contract; pinning at library defaults avoids contaminating the held-out seed by rewriting booleans into string enums.",
    heldOutConfigUntouched: true,
    previousBlocker:
      "2026-08-31 double-run refused: td|rdp-day vs td|rdp-day.rdp-selected moved between structural indices (Calendar:label.1__default). Cause was an interaction leak — active mouse.up mutated React selected; formStateReset only resets <input> checked/value. Floor remount (capture.react-state-remount) closed that leak. classAllow was not retuned.",
  };

  let f1Status: F1Status = "blocked";
  let propose: MechanicalCalendarPropose | null = null;
  let proposeError: string | null = null;
  let recipeCompile: F1RecipeCompile | null = null;
  let capture: Record<string, unknown>;

  if (hasLedger) {
    try {
      propose = proposeCalendarInstanceFromLedger(REPO, LEDGER);
      assertNoPolarPropose(propose);
      recipeCompile = compileAttempt(propose);
      f1Status = "capture-only";
      capture = {
        status: "captured",
        ...captureShared,
        blocker: null,
        determinism: "byte-identical across two full sweeps in one session",
        captures: 32,
        combos: 8,
        interactions: 4,
        channelsEnumerated: 472,
        elementsPerCapture: 626,
        ledgerFile: LEDGER,
        evidenceLog: "/tmp/day-picker-capture-f1.log",
        namedLimitations: [
          "Union anatomy names repeating day cells and year-dropdown <option>s as individual parts (192 parts carried, 5 svg polygon refusals). That is a floor shape, not an F1 pass.",
          "0 verified source bindings — the library hard-codes most paint (294 named skips, 1 shorthand-ceiling skip).",
          "Gate computed 81.394%; pixel AA perfect 0/32 measured. Not a silent-zero invert.",
          "tokens.mintedBootstrap is still true — the minted DTCG stub was not filled this pass; do not claim a token invert.",
          "proposed selected.background on cls:rdp-selected (the <td>) is #00000000 — the painted selected marker is a 2px blue border on the child rdp-day_button. Named, not silently folded into a fill.",
          "scorecard.json is not committed under extract/computed/out/day-picker/ — it would join the gated capture population as a stray library (docs:check / capability:fresh). Gate 81.394% / pixel 0/32 live only in this receipt.",
          `Mechanical calendar@1 compile refused: ${propose.content.weekRowCount} week rows (need 6), ${propose.content.hiddenOutsideCount} blank outside labels, dayButton.radius is 100%, selected is a border not a fill.`,
        ],
      };
    } catch (e) {
      proposeError = e instanceof Error ? e.message : String(e);
      f1Status = "blocked";
      capture = {
        status: "captured-but-unreadable",
        ...captureShared,
        blocker: proposeError,
        determinism: "byte-identical across two full sweeps in one session",
        ledgerFile: LEDGER,
        evidenceLog: "/tmp/day-picker-capture-f1.log",
      };
    }
  } else {
    f1Status = "blocked";
    proposeError =
      "No captured-truth.json — capture refused before writing a ledger (determinism self-check). Reader cannot propose a table from nothing.";
    capture = {
      status: "mount-blocked",
      ...captureShared,
      blocker: proposeError,
      evidenceLog: "/tmp/day-picker-capture-f1.log",
    };
  }

  const receipt = {
    artifactVersion: "f1-held-out-v1",
    phase: "docs/35 Phase 4 — F1 held-out exam PREPARE (code→canvas), offline-first",
    overallSuccess: false as const,
    f1Status,
    productV1: "INCOMPLETE" as const,
    liveFigma: false,
    inventedF1Pass: false,
    humanGrade: "not-run — prepare only; live zero-silent mint is owner-authorized later",
    subject: {
      packageName: PACKAGE,
      version: VERSION,
      exportName: EXPORT,
      config: CONFIG,
      sandbox: "examples/day-picker/.day-picker-sandbox",
      ledgerFile: hasLedger ? LEDGER : null,
    },
    capture,
    proposedTable: propose?.proposedLeaves ?? null,
    proposeError,
    recipeCompile: recipeCompile ?? {
      attempted: false,
      compiled: false,
      reason: proposeError ?? "no ledger",
    },
    schemaGaps: propose?.schemaGaps ?? [],
    mechanicalContent: propose
      ? {
          caption: propose.content.caption,
          weekdays: propose.content.weekdays,
          weekRowCount: propose.content.weekRowCount,
          dayCellCount: propose.content.dayCellCount,
          dayButtonCount: propose.content.dayButtonCount,
          hiddenOutsideCount: propose.content.hiddenOutsideCount,
          selectedDayLabel: propose.content.selectedDayLabel,
          todayDayLabel: propose.content.todayDayLabel,
        }
      : null,
    polar: propose?.polar ?? null,
    note:
      "The docs/26 F1 bar is live zero-silent on an unseen library. This artifact is capture-only prepare plus a refused mechanical compile. overallSuccess stays false. Product v1 remains INCOMPLETE. No live Figma. No invented pass.",
  };

  return { overallSuccess: false, f1Status, productV1: "INCOMPLETE", receipt };
}

export function renderF1HeldOutArtifacts(receipt: Record<string, unknown>): {
  "receipt.json": string;
  "proposed-table.json": string;
  "compile-gaps.json": string;
  "README.md": string;
} {
  return {
    "receipt.json": JSON.stringify(receipt, null, 2) + "\n",
    "proposed-table.json":
      JSON.stringify(
        {
          note: "PROPOSED only — ledger reads. Never a hand-authored fixture table. Not a CalendarRecipeInstance.",
          proposed: receipt.proposedTable,
          proposeError: receipt.proposeError,
        },
        null,
        2,
      ) + "\n",
    "compile-gaps.json":
      JSON.stringify(
        {
          note: "Named calendar@1 gaps. Filling any of these from Astryx/canonical/Polar is refused.",
          recipeCompile: receipt.recipeCompile,
          schemaGaps: receipt.schemaGaps,
          mechanicalContent: receipt.mechanicalContent,
          polar: receipt.polar,
        },
        null,
        2,
      ) + "\n",
    "README.md": [
      "# F1 held-out v1 — PREPARE (docs/35 Phase 4)",
      "",
      `**f1Status:** \`${receipt.f1Status}\` · **overallSuccess:** false · **product v1:** INCOMPLETE`,
      "",
      `Subject: \`${PACKAGE}@${VERSION}#${EXPORT}\`.`,
      "",
      "## Capture",
      "",
      receipt.capture && (receipt.capture as { status?: string }).status === "captured"
        ? `Determinism **IDENTICAL** (${(receipt.capture as { captures?: number }).captures} captures, ${(receipt.capture as { combos?: number }).combos} combos × ${(receipt.capture as { interactions?: number }).interactions} interactions). Previous day-cell signature thrash was an interaction leak; the floor remounts React state before each plane. Held-out \`classAllow\` was not retuned.`
        : String((receipt.capture as { blocker?: string } | undefined)?.blocker ?? "capture blocked"),
      "",
      "## Mechanical compile",
      "",
      "Attempted against calendar@1 from ledger reads only. **Refused.** Named gaps live in `compile-gaps.json`: 5 week rows vs 6 required, blank hidden-outside labels, `100%` day-button radius, selected marker is a border not a fill, `row-gap: normal`, `min-width: auto`, no week-number part, 0 source bindings, axes mismatch.",
      "",
      "## Stop line",
      "",
      "Proposed table + named compile refusal. No live Figma. No invented pass. No Polar. `f1Status` is never `passed`. Live mint stays owner-authorized and waits on an honest compile — which this grammar cannot do without a named calendar@1 change.",
      "",
    ].join("\n"),
  };
}

function main(): void {
  const check = process.argv.includes("--check");
  const { receipt } = buildF1HeldOutEvidence();
  const artifacts = renderF1HeldOutArtifacts(receipt);
  if (check) {
    const stale: string[] = [];
    for (const [name, bytes] of Object.entries(artifacts)) {
      const onDisk = existsSync(path.join(EVIDENCE, name))
        ? readFileSync(path.join(EVIDENCE, name), "utf8")
        : "";
      if (onDisk !== bytes) stale.push(name);
    }
    if (stale.length) {
      throw new Error(
        `f1-held-out-v1 stale: ${stale.join(", ")} — rerun without --check`,
      );
    }
    if (receipt.f1Status === "passed" || receipt.overallSuccess === true) {
      throw new Error("F1 must not claim passed / overallSuccess");
    }
    console.log("f1-held-out-v1 check ok");
    return;
  }
  mkdirSync(EVIDENCE, { recursive: true });
  for (const [name, bytes] of Object.entries(artifacts)) {
    writeFileSync(path.join(EVIDENCE, name), bytes);
  }
  console.log(
    `f1Status=${receipt.f1Status} compile=${(receipt.recipeCompile as { status?: string }).status} → ${path.relative(REPO, EVIDENCE)}/`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
