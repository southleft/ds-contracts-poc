import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHECKBOX_PAGE_ID,
  CHECKBOX_PERTURBATION_EXAM_RECEIPT_PATH,
  CHECKBOX_PERTURBATION_EXAM_VERSION,
  OVERLAY_PERTURBATION_BLOCKER,
  runCheckboxPerturbationExam,
  validateCheckboxPerturbationExam,
} from "./checkbox-perturbation-exam.js";

test("Checkbox padding class is named on the committed Astryx observe", () => {
  const report = runCheckboxPerturbationExam();
  assert.deepEqual(validateCheckboxPerturbationExam(report), []);
  assert.equal(report.artifactVersion, CHECKBOX_PERTURBATION_EXAM_VERSION);
  assert.equal(report.class, "padding");
  assert.equal(report.silentlyAbsorbed, false);
  assert.ok(report.namedChannels.includes("layout.padding"));
  assert.equal(report.proposal.applied, false);
  assert.equal(report.proposal.reviewBeforeWrite, true);
  assert.equal(report.substrate.pageId, CHECKBOX_PAGE_ID);
  assert.equal(report.substrate.figmaWrites, 0);
  assert.equal(report.humanGrade, "pending");
  assert.equal(report.gradeInvented, false);
  assert.equal(report.overallSuccess, false);
  assert.equal(report.overlay.status, "named-blocker");
  assert.equal(report.overlay.blocker, OVERLAY_PERTURBATION_BLOCKER);
});

test("committed checkbox perturbation receipt matches a fresh exam run", () => {
  const fresh = runCheckboxPerturbationExam();
  const committed = JSON.parse(
    readFileSync(CHECKBOX_PERTURBATION_EXAM_RECEIPT_PATH, "utf8"),
  );
  assert.deepEqual(committed, JSON.parse(JSON.stringify(fresh)));
});
