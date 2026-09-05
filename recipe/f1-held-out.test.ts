/**
 * F1 held-out mechanical compile.
 *
 * The compile now SUCCEEDS: the ledger assembles into a calendar@1 instance
 * with nothing hand-authored. These tests hold the line that matters -- that
 * the success came from measurement and not from invention -- so every
 * anti-Polar assertion below is kept and several are tightened. A compile that
 * passes because someone supplied Astryx's content would fail here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildF1HeldOutEvidence } from "./fixture-reader/f1-held-out.js";
import {
  assertNoPolarPropose,
  proposeCalendarInstanceFromLedger,
} from "./fixture-reader/propose-calendar-instance.js";

const receiptOnDisk = JSON.parse(
  readFileSync("recipe/evidence/f1-held-out-v1/receipt.json", "utf8"),
) as {
  overallSuccess: boolean;
  f1Status: string;
  inventedF1Pass: boolean;
  liveFigma: boolean;
  productV1: string;
  recipeCompile: {
    attempted: boolean;
    compiled: boolean;
    status?: string;
    gapIds?: string[];
    inventedFixtureTable?: boolean;
    addedToCalendarInstances?: boolean;
  };
  mechanicalContent: {
    caption: string;
    weekRowCount: number;
    hiddenOutsideCount: number;
    selectedDayLabel: string;
    todayDayLabel: string;
  };
  polar: { inventedInstance: boolean };
};

test("F1 compiles mechanically, and compiling is not passing", () => {
  const { receipt, overallSuccess, f1Status } = buildF1HeldOutEvidence();
  // A compile is not an exam pass. The docs/26 bar needs a live mint and a
  // scored render, neither of which this gate performs, so overallSuccess
  // stays false and productV1 stays INCOMPLETE.
  assert.equal(overallSuccess, false);
  assert.equal(f1Status, "compiled");
  assert.equal(receipt.f1Status, "compiled");
  assert.equal(receipt.overallSuccess, false);
  assert.equal(receipt.inventedF1Pass, false);
  assert.equal(receipt.liveFigma, false);
  assert.equal(receipt.productV1, "INCOMPLETE");
  const compile = receipt.recipeCompile as {
    attempted: boolean;
    compiled: boolean;
    status: string;
    canonicalHash: string | null;
    carriedFacts: number | null;
    receipts: number | null;
    inventedFixtureTable: boolean;
    addedToCalendarInstances: boolean;
  };
  assert.equal(compile.attempted, true);
  assert.equal(compile.compiled, true);
  assert.equal(compile.status, "compiled");
  // The envelope is real: it hashed, it carries facts, and it discloses
  // losses. A "compiled" that carried nothing would satisfy the flag alone.
  assert.match(compile.canonicalHash ?? "", /^[0-9a-f]{64}$/);
  assert.ok((compile.carriedFacts ?? 0) > 20, "envelope carries facts");
  assert.ok((compile.receipts ?? 0) > 0, "envelope discloses losses");
  // Still no hand-authored fixture, still not added to the curated table.
  assert.equal(compile.inventedFixtureTable, false);
  assert.equal(compile.addedToCalendarInstances, false);
});

test("mechanical propose is January 2026, five weeks, no Polar", () => {
  const propose = proposeCalendarInstanceFromLedger();
  assertNoPolarPropose(propose);
  assert.equal(propose.content.caption, "January 2026");
  assert.deepEqual(propose.content.weekdays, [
    "Su",
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
  ]);
  assert.equal(propose.content.weekRowCount, 5);
  assert.equal(propose.content.selectedDayLabel, "20");
  assert.equal(propose.content.todayDayLabel, "15");
  assert.equal(propose.content.hiddenOutsideCount, 4);
  assert.equal(propose.polar.inventedInstance, false);
  const selectedBtn = propose.proposedLeaves.find(
    (l) => l.path === "selected.button.background",
  );
  assert.equal(selectedBtn?.value, "#00000000");
  // The eleven originally-named gaps are still enumerated -- closing a gap
  // means recording HOW it closed, never deleting the record that it existed.
  const gapIds = propose.schemaGaps.map((g) => g.id);
  for (const id of [
    "week-count-not-six",
    "blank-outside-labels",
    "day-button-radius-percent",
    "selected-is-border-not-fill",
    "grid-gap-normal",
    "root-min-width-auto",
    "week-number-text-absent",
    "weekday-fontsize-not-day",
    "zero-source-bindings",
    "axes-mismatch",
    "outside-cell-has-no-label",
  ]) {
    const gap = propose.schemaGaps.find((g) => g.id === id);
    assert.ok(gap, `missing gap ${id}`);
    assert.equal(gap.status, "closed", `${id} should be closed`);
    assert.ok(
      (gap.closedBy ?? "").length > 40,
      `${id} must name the change that closed it`,
    );
  }
  // And the half of axes-mismatch that is NOT closed stays named, with its
  // reason, rather than disappearing into the closure above.
  const residue = propose.schemaGaps.find(
    (g) => g.id === "capture-axes-outside-calendar-grammar",
  );
  assert.ok(residue, "the un-closed axes residue must stay named");
  assert.equal(residue.status, "named");
  assert.ok((residue.whyNamed ?? "").length > 40);

  // The instance that compiled must carry zero minted variable names: this
  // subject has no verified DTCG bindings, and inventing one is the failure
  // this whole exam is designed to catch.
  const bound = JSON.stringify(propose.instance).match(/"variable":"[^"]+"/g);
  assert.equal(bound, null, "no token may claim a source binding");
});

test("committed receipt matches the live builder", () => {
  assert.equal(receiptOnDisk.f1Status, "compiled");
  assert.equal(receiptOnDisk.overallSuccess, false);
  assert.equal(receiptOnDisk.inventedF1Pass, false);
  assert.equal(receiptOnDisk.liveFigma, false);
  assert.equal(receiptOnDisk.recipeCompile.attempted, true);
  assert.equal(receiptOnDisk.recipeCompile.compiled, true);
  assert.equal(receiptOnDisk.recipeCompile.status, "compiled");
  assert.equal(receiptOnDisk.recipeCompile.inventedFixtureTable, false);
  assert.equal(receiptOnDisk.recipeCompile.addedToCalendarInstances, false);
  assert.equal(receiptOnDisk.mechanicalContent.caption, "January 2026");
  assert.equal(receiptOnDisk.mechanicalContent.weekRowCount, 5);
  assert.equal(receiptOnDisk.polar.inventedInstance, false);
});
