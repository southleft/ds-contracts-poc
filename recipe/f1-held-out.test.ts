/**
 * F1 held-out mechanical compile — capture-only, compile refused, no Polar.
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

test("F1 stays capture-only; compile attempted and refused", () => {
  const { receipt, overallSuccess, f1Status } = buildF1HeldOutEvidence();
  assert.equal(overallSuccess, false);
  assert.equal(f1Status, "capture-only");
  assert.equal(receipt.f1Status, "capture-only");
  assert.equal(receipt.overallSuccess, false);
  assert.equal(receipt.inventedF1Pass, false);
  assert.equal(receipt.liveFigma, false);
  assert.equal(receipt.productV1, "INCOMPLETE");
  const compile = receipt.recipeCompile as {
    attempted: boolean;
    compiled: boolean;
    status: string;
    inventedFixtureTable: boolean;
    addedToCalendarInstances: boolean;
  };
  assert.equal(compile.attempted, true);
  assert.equal(compile.compiled, false);
  assert.equal(compile.status, "refused");
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
  const gapIds = propose.schemaGaps.map((g) => g.id);
  for (const id of [
    "week-count-not-six",
    "blank-outside-labels",
    "day-button-radius-percent",
    "selected-is-border-not-fill",
    "zero-source-bindings",
    "axes-mismatch",
  ]) {
    assert.ok(gapIds.includes(id), `missing gap ${id}`);
  }
});

test("committed receipt matches the live builder and names the same refusal", () => {
  assert.equal(receiptOnDisk.f1Status, "capture-only");
  assert.equal(receiptOnDisk.overallSuccess, false);
  assert.equal(receiptOnDisk.inventedF1Pass, false);
  assert.equal(receiptOnDisk.liveFigma, false);
  assert.equal(receiptOnDisk.recipeCompile.attempted, true);
  assert.equal(receiptOnDisk.recipeCompile.compiled, false);
  assert.equal(receiptOnDisk.recipeCompile.status, "refused");
  assert.equal(receiptOnDisk.recipeCompile.inventedFixtureTable, false);
  assert.equal(receiptOnDisk.recipeCompile.addedToCalendarInstances, false);
  assert.equal(receiptOnDisk.mechanicalContent.caption, "January 2026");
  assert.equal(receiptOnDisk.mechanicalContent.weekRowCount, 5);
  assert.equal(receiptOnDisk.polar.inventedInstance, false);
});
