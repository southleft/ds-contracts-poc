import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateInputFieldCalibrated,
  CALIBRATED_ADJUDICATION_PATH,
  readInputFieldCalibratedAdjudicationSources,
  validateCommittedInputFieldCalibratedAdjudication,
  type InputFieldCalibratedAdjudication,
} from "./input-field-comparison-calibrated-adjudication.js";

const artifact = (): InputFieldCalibratedAdjudication =>
  JSON.parse(
    readFileSync(CALIBRATED_ADJUDICATION_PATH, "utf8"),
  ) as InputFieldCalibratedAdjudication;

const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

test("committed calibrated adjudication re-derives the refusal", () => {
  const result = validateCommittedInputFieldCalibratedAdjudication(artifact());

  assert.equal(result.reliability.status, "failed");
  assert.equal(result.thresholds.allThreeRatersValidAndComplete.actual, 0);
  assert.equal(result.opaqueAgreement.unanimous.count, 354);
  assert.equal(result.opaqueAgreement.split.count, 30);
  assert.equal(result.opaqueAgreement.fleissKappa, 0.4725274725274698);
  assert.deepEqual(
    result.opaqueAgreement.pairwise.map((pair) => ({
      raters: pair.raters,
      agreements: pair.agreements,
      ratio: pair.ratio,
      kappa: pair.cohensKappa,
    })),
    [
      {
        raters: "BATCH-CAL-A/BATCH-CAL-B",
        agreements: 368,
        ratio: 0.9583333333333334,
        kappa: 0.6712328767123292,
      },
      {
        raters: "BATCH-CAL-A/BATCH-CAL-C",
        agreements: 360,
        ratio: 0.9375,
        kappa: 0.3793103448275861,
      },
      {
        raters: "BATCH-CAL-B/BATCH-CAL-C",
        agreements: 364,
        ratio: 0.9479166666666666,
        kappa: 0.26380368098159585,
      },
    ],
  );
  assert.equal(result.opaqueAgreement.majorityFailureRows, 362);
  assert.equal(
    result.opaqueAgreement.majorityFailuresWithTwoConcreteRaterDefectSets,
    362,
  );
});

test("hidden duplicate phase passes without permitting unseal", () => {
  const result = artifact();
  for (const metric of Object.values(result.duplicateIntegrity.byRater)) {
    assert.equal(metric.agreements, 128);
    assert.equal(metric.copyAPasses, 0);
    assert.equal(metric.copyBPasses, 0);
    assert.equal(metric.percentagePointDifference, 0);
  }
  assert.equal(result.duplicateIntegrity.majorityConsensus.agreements, 128);
  assert.equal(result.answerKey.unsealingAllowed, false);
  assert.equal(result.answerKey.parsed, false);
  assert.equal(result.consensus, null);
  assert.equal(result.performance, null);
  assert.equal(result.instability.resolvedByCalibratedRound, false);
});

test("all submitted batches remain invalid rather than repaired", () => {
  const result = artifact();
  assert.equal(result.gradeValidations.length, 3);
  for (const validation of result.gradeValidations) {
    assert.equal(validation.declaredEnvelope.valid, false);
    assert.equal(validation.validAndCompleteRater, false);
    assert.ok(validation.declaredEnvelope.missingFields.includes("packetHash"));
    assert.ok(validation.declaredEnvelope.missingFields.includes("rubricHash"));
    assert.equal(validation.exactPacketOrderAndIds, true);
    assert.equal(validation.failureDefectsComplete, true);
    assert.equal(validation.implementationOrDuplicateGuessesAbsent, true);
  }
});

test("reader refuses a changed grade before producing metrics", () => {
  const sources = readInputFieldCalibratedAdjudicationSources();
  const batch = JSON.parse(sources.grades["BATCH-CAL-B"]) as {
    grades: Array<{ taskId: string }>;
  };
  [batch.grades[0]!.taskId, batch.grades[1]!.taskId] = [
    batch.grades[1]!.taskId,
    batch.grades[0]!.taskId,
  ];
  sources.grades["BATCH-CAL-B"] = jsonBytes(batch);
  assert.throws(
    () => adjudicateInputFieldCalibrated(sources),
    /BATCH-CAL-B grade order or identifiers differ/,
  );
});

test("committed reader refuses threshold and arithmetic tampering", () => {
  const changedThreshold = structuredClone(artifact());
  changedThreshold.thresholds.fleissKappaMinimum.passed = true;
  assert.throws(
    () => validateCommittedInputFieldCalibratedAdjudication(changedThreshold),
    /hashes, thresholds, arithmetic, or verdict differ/,
  );

  const changedSupport = structuredClone(artifact());
  changedSupport.opaqueAgreement.majorityFailureRows = 361;
  assert.throws(
    () => validateCommittedInputFieldCalibratedAdjudication(changedSupport),
    /hashes, thresholds, arithmetic, or verdict differ/,
  );
});

test("receipt or duplicate-proof tampering is refused", () => {
  const sources = readInputFieldCalibratedAdjudicationSources();
  const receipt = JSON.parse(sources.receipt) as {
    calibratedBatch: {
      duplicateProof: Array<{ byteIdentical: boolean }>;
    };
  };
  receipt.calibratedBatch.duplicateProof[0]!.byteIdentical = false;
  sources.receipt = jsonBytes(receipt);
  assert.throws(
    () => adjudicateInputFieldCalibrated(sources),
    /index path or hash pins differ/,
  );
});
