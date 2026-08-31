import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BUTTON_PERTURBATION_EXAM_RECEIPT_PATH,
  BUTTON_PERTURBATION_EXAM_VERSION,
  runButtonPerturbationExam,
  validateButtonPerturbationExam,
} from "./button-perturbation-exam.js";
import { BUTTON_V4_PAGE_ID } from "./button-scene-inversion.js";

test("Button perturbation exam names six designer-class edits on an observe duplicate", () => {
  const report = runButtonPerturbationExam();
  const failures = validateButtonPerturbationExam(report);
  assert.deepEqual(failures, []);
  assert.equal(report.artifactVersion, BUTTON_PERTURBATION_EXAM_VERSION);
  assert.equal(report.substrate.signedPageId, BUTTON_V4_PAGE_ID);
  assert.equal(report.substrate.signedPageWritten, false);
  assert.equal(report.substrate.figmaWrites, 0);
  assert.equal(report.humanGrade, "pending");
  assert.equal(report.gradeInvented, false);
  assert.equal(report.overallSuccess, false);
  assert.equal(report.appliedAnyProposal, false);
  assert.equal(report.cases.length, 6);
  const byId = Object.fromEntries(report.cases.map((row) => [row.id, row]));
  assert.equal(byId["bound-token"]?.disposition, "proposed-reviewed-input-diff");
  assert.equal(byId["bound-token"]?.silentlyAbsorbed, false);
  assert.ok(byId["bound-token"]?.namedChannels.includes("binding"));
  assert.equal(byId["literal-fill"]?.disposition, "proposed-reviewed-input-diff");
  assert.equal(byId["literal-fill"]?.silentlyAbsorbed, false);
  assert.ok(byId["literal-fill"]?.namedChannels.includes("fill"));
  assert.equal(byId["padding"]?.disposition, "proposed-reviewed-input-diff");
  assert.equal(byId["padding"]?.silentlyAbsorbed, false);
  assert.ok(byId["padding"]?.namedChannels.includes("layout.padding"));
  assert.equal(
    byId["variant-on-existing-axis"]?.disposition,
    "proposed-reviewed-input-diff",
  );
  assert.equal(byId["variant-on-existing-axis"]?.silentlyAbsorbed, false);
  assert.ok(
    byId["variant-on-existing-axis"]?.namedChannels.includes(
      "variantProperties",
    ),
  );
  assert.equal(byId["renamed-node"]?.disposition, "proposed-reviewed-input-diff");
  assert.equal(byId["renamed-node"]?.silentlyAbsorbed, false);
  assert.ok(byId["renamed-node"]?.namedChannels.includes("name"));
  assert.equal(
    byId["rotation-no-source-vocabulary"]?.disposition,
    "named-receipt",
  );
  assert.equal(byId["rotation-no-source-vocabulary"]?.silentlyAbsorbed, true);
  assert.equal(byId["rotation-no-source-vocabulary"]?.proposal, null);
  assert.match(
    byId["rotation-no-source-vocabulary"]?.receipt?.reason ?? "",
    /no rotation channel/,
  );
  for (const row of report.cases) {
    if (row.proposal) {
      assert.equal(row.proposal.reviewBeforeWrite, true);
      assert.equal(row.proposal.applied, false);
    }
  }
});

test("committed perturbation receipt matches a fresh exam run", () => {
  const fresh = runButtonPerturbationExam();
  const committed = JSON.parse(
    readFileSync(BUTTON_PERTURBATION_EXAM_RECEIPT_PATH, "utf8"),
  );
  assert.deepEqual(committed, JSON.parse(JSON.stringify(fresh)));
});
