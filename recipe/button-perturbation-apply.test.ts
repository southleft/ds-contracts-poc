import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUTTON_V4_PAGE_ID } from "./button-scene-inversion.js";
import {
  APPLY_CLASS,
  APPLY_REFUSAL_UNAPPROVED,
  BUTTON_PERTURBATION_APPLY_APPROVAL_PATH,
  BUTTON_PERTURBATION_APPLY_RECEIPT_PATH,
  BUTTON_PERTURBATION_APPLY_VERSION,
  OVERLAY_PERTURBATION_BLOCKER,
  applyApprovedPaddingToObserve,
  approvalForProposal,
  assertApplyApproved,
  paddingProposalFromExam,
  validateButtonPerturbationApply,
  type ButtonPerturbationApplyReceipt,
} from "./button-perturbation-apply.js";

const paddingProposal = paddingProposalFromExam();

test("unapproved padding proposal refuses apply", () => {
  const unapproved = approvalForProposal(paddingProposal, false);
  assert.throws(
    () => assertApplyApproved(unapproved, paddingProposal),
    (error: unknown) =>
      error instanceof Error && error.message === APPLY_REFUSAL_UNAPPROVED,
  );
  assert.throws(
    () => applyApprovedPaddingToObserve(unapproved, paddingProposal),
    (error: unknown) =>
      error instanceof Error && error.message === APPLY_REFUSAL_UNAPPROVED,
  );
});

test("approval sha mismatch refuses apply", () => {
  const approval = approvalForProposal(paddingProposal, true);
  approval.proposalSha256 = "0".repeat(64);
  assert.throws(
    () => assertApplyApproved(approval, paddingProposal),
    /approval sha does not match/,
  );
});

test("approved padding apply is a fixed point on the observe duplicate", () => {
  const approval = approvalForProposal(paddingProposal, true);
  const scenes = applyApprovedPaddingToObserve(approval, paddingProposal);
  const first = scenes.applied.children.find(
    (child) => child.type === "COMPONENT",
  );
  assert.ok(first);
  assert.equal(first.paddingLeft, 24);
  assert.equal(first.paddingRight, 16);
  assert.equal(first.paddingTop, 8);
  assert.equal(first.paddingBottom, 8);
  assert.deepEqual(scenes.unboundFields, ["paddingLeft"]);
  assert.equal(
    (first.boundVariables ?? []).some((binding) => binding.field === "paddingLeft"),
    false,
  );
  assert.deepEqual(scenes.secondApply, scenes.applied);
  assert.notDeepEqual(scenes.applied, scenes.original);
});

test("committed apply receipt stays ungraded, offline, and zero-silent", () => {
  const receipt = JSON.parse(
    readFileSync(BUTTON_PERTURBATION_APPLY_RECEIPT_PATH, "utf8"),
  ) as ButtonPerturbationApplyReceipt;
  const approval = JSON.parse(
    readFileSync(BUTTON_PERTURBATION_APPLY_APPROVAL_PATH, "utf8"),
  );
  assert.deepEqual(validateButtonPerturbationApply(receipt), []);
  assert.equal(receipt.artifactVersion, BUTTON_PERTURBATION_APPLY_VERSION);
  assert.equal(receipt.class, APPLY_CLASS);
  assert.equal(receipt.approval.approved, true);
  assert.deepEqual(receipt.approval, approval);
  assert.equal(receipt.substrate.signedPageId, BUTTON_V4_PAGE_ID);
  assert.equal(receipt.substrate.signedPageWritten, false);
  assert.equal(receipt.substrate.figmaWrites, 0);
  assert.equal(receipt.humanGrade, "pending");
  assert.equal(receipt.gradeInvented, false);
  assert.equal(receipt.overallSuccess, false);
  assert.equal(receipt.render.silent, 0);
  assert.equal(receipt.render.unexplainedDeltas, 0);
  assert.equal(receipt.fixedPoint.secondApplyNoOp, true);
  assert.equal(receipt.overlay.status, "named-blocker");
  assert.equal(receipt.overlay.blocker, OVERLAY_PERTURBATION_BLOCKER);
  assert.equal(receipt.checkbox.status, "observe-committed");
});
