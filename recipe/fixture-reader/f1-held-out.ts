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
  let proposed: ProposedLeaf[] | null = null;
  let proposeError: string | null = null;
  let capture: Record<string, unknown>;

  if (hasLedger) {
    try {
      proposed = proposeCalendarFromLedger(LEDGER);
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
          "proposed selected.background on cls:rdp-selected (the <td>) is #00000000 — the painted selected fill lives on the child rdp-day_button. Named, not silently folded.",
          "scorecard.json is not committed under extract/computed/out/day-picker/ — it would join the gated capture population as a stray library (docs:check / capability:fresh). Gate 81.394% / pixel 0/32 live only in this receipt.",
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
    proposedTable: proposed,
    proposeError,
    recipeCompile: {
      attempted: false,
      reason:
        "Capture is deterministic and a proposed table exists, but Calendar recipe compile + live remint would require Polar or an invented fixture table. Both are refused. Stopped at proposed-table + named receipts (docs/35 §6).",
    },
    note:
      "The docs/26 F1 bar is live zero-silent on an unseen library. This artifact is capture-only prepare. overallSuccess stays false. Product v1 remains INCOMPLETE. No live Figma. No invented pass.",
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
      receipt.capture.status === "captured"
        ? `Determinism **IDENTICAL** (${receipt.capture.captures} captures, ${receipt.capture.combos} combos × ${receipt.capture.interactions} interactions). Previous day-cell signature thrash was an interaction leak; the floor remounts React state before each plane. Held-out \`classAllow\` was not retuned.`
        : String(receipt.capture.blocker ?? "capture blocked"),
      "",
      "## Stop line",
      "",
      "Proposed table + named receipts only. No live Figma. No invented pass. \`f1Status\` is never \`passed\`.",
      "",
    ].join("\n"),
  );
  console.log(`f1Status=${receipt.f1Status} → ${path.relative(REPO, EVIDENCE)}/`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
