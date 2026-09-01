/**
 * docs/35 Phase 4 / F1 held-out prepare — react-day-picker → proposed table.
 *
 * Offline-first. Never invents a Calendar remint. Never flips overallSuccess.
 * If the capture floor refuses, this module records the named blocker and
 * leaves f1Status as blocked | capture-only | unproven.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ProposedLeaf } from "./phase4-new-libraries.js";
import { Ledger } from "./ledger.js";
import { px, hex8 } from "./ledger.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVIDENCE = path.join(REPO, "recipe", "evidence", "f1-held-out-v1");
const LEDGER = "extract/computed/out/day-picker/calendar/captured-truth.json";
const CONFIG = "extract/computed/configs/day-picker.json";
const PACKAGE = "react-day-picker";
const VERSION = "10.0.1";
const EXPORT = "DayPicker";

export type F1Status = "unproven" | "capture-only" | "blocked";

function proposeCalendarFromLedger(ledgerFile: string): ProposedLeaf[] {
  const ledger = new Ledger(REPO, ledgerFile);
  const keys = ledger.keys();
  const def = keys.find((k) => k.endsWith("__default"));
  if (!def) throw new Error(`${ledgerFile}: no __default key`);
  const combo = def.replace(/__default$/, "");
  const out: ProposedLeaf[] = [];
  const tryRead = (pathName: string, part: string, channel: string, kind: "px" | "color" | "raw"): void => {
    try {
      const raw = ledger.raw(`${combo}__default`, part, channel);
      let value: number | string = raw;
      if (kind === "px") value = px(raw);
      else if (kind === "color") {
        try {
          value = hex8(raw);
        } catch {
          value = raw;
        }
      }
      out.push({
        path: pathName,
        value,
        ledgerKey: `${ledgerFile}#${combo}__default ${part}.${channel}`,
        formula: `ledger ${part}.${channel} @ ${combo}__default`,
      });
    } catch {
      /* skip */
    }
  };
  tryRead("root.width", "root", "width", "px");
  tryRead("root.height", "root", "height", "px");
  tryRead("dayButton.width", "cls:rdp-day_button", "width", "px");
  tryRead("dayButton.height", "cls:rdp-day_button", "height", "px");
  tryRead("dayButton.radius", "cls:rdp-day_button", "border-top-left-radius", "px");
  tryRead("selected.background", "cls:rdp-selected", "background-color", "color");
  return out;
}

export function buildF1HeldOutEvidence(): {
  overallSuccess: false;
  f1Status: F1Status;
  productV1: "INCOMPLETE";
  receipt: Record<string, unknown>;
} {
  const ledgerAbs = path.join(REPO, LEDGER);
  const hasLedger = existsSync(ledgerAbs);

  // Named blocker from the 2026-08-31 capture attempt (exact determinism refusal).
  const determinismBlocker = {
    status: "mount-blocked" as const,
    gate: "extract/computed/run.ts determinism self-check (double-run byte-identity)",
    blocker:
      "UNSTABLE channels across double-run: (signature), border-*-color, font-size, font-weight — day-cell SIGNATURE thrash: td|rdp-day vs td|rdp-day.rdp-selected moved between structural indices across two sweeps of the same combo (e.g. Calendar:label.1__default @0.1.1.1.1.3 vs @0.1.1.1.3.2). classAllow keeps rdp-selected as identity; the selected class is not stable under the interaction sweep on this floor.",
    configAxesEnumerated: ["captionLayout", "numberOfMonths"],
    configAxesPinnedAsFixed: ["showOutsideDays=false", "showWeekNumber=false"],
    pinNote:
      "Bare boolean axes refused by capture.ts §1.4 against the blind seed contract; pinning at library defaults avoids contaminating the held-out seed by rewriting booleans into string enums.",
    evidenceLog: "/tmp/day-picker-capture3.log (local run) + this receipt",
  };

  let f1Status: F1Status = "blocked";
  let proposed: ProposedLeaf[] | null = null;
  let proposeError: string | null = null;

  if (hasLedger) {
    try {
      proposed = proposeCalendarFromLedger(LEDGER);
      f1Status = "capture-only";
    } catch (e) {
      proposeError = e instanceof Error ? e.message : String(e);
      f1Status = "blocked";
    }
  } else {
    f1Status = "blocked";
    proposeError =
      "No captured-truth.json — capture refused before writing a ledger (determinism self-check). Reader cannot propose a table from nothing.";
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
    capture: determinismBlocker,
    proposedTable: proposed,
    proposeError,
    recipeCompile: {
      attempted: false,
      reason:
        "Stopped at proposed-table + named receipts. Calendar recipe teaching / writer / live remint is out of scope for this PREPARE (docs/35 §6; no Polar; no inventing a remint).",
    },
    note:
      "The docs/26 F1 bar is live zero-silent on an unseen library. This artifact prepares the exam mechanically. overallSuccess stays false. Product v1 remains INCOMPLETE.",
  };

  return { overallSuccess: false, f1Status, productV1: "INCOMPLETE", receipt };
}

function main(): void {
  const { receipt } = buildF1HeldOutEvidence();
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(path.join(EVIDENCE, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
  writeFileSync(
    path.join(EVIDENCE, "proposed-table.json"),
    JSON.stringify(
      {
        note: "PROPOSED only — empty when capture is blocked. Never a hand-authored fixture table.",
        proposed: receipt.proposedTable,
        proposeError: receipt.proposeError,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(EVIDENCE, "README.md"),
    [
      "# F1 held-out v1 — PREPARE (docs/35 Phase 4)",
      "",
      `**f1Status:** \`${receipt.f1Status}\` · **overallSuccess:** false · **product v1:** INCOMPLETE`,
      "",
      `Subject: \`${PACKAGE}@${VERSION}#${EXPORT}\`.`,
      "",
      "## Capture",
      "",
      receipt.capture.blocker,
      "",
      "## Stop line",
      "",
      "Proposed table + named receipts only. No live Figma. No invented pass.",
      "",
    ].join("\n"),
  );
  console.log(`f1Status=${receipt.f1Status} → ${path.relative(REPO, EVIDENCE)}/`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
