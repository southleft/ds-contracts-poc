import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateInputFieldCalibrationV3,
  FINAL_ADJUDICATION_PATH,
  readAdjudicationSources,
  validateCommittedInputFieldCalibrationV3Adjudication,
  type InputFieldCalibrationV3Adjudication,
} from "./input-field-comparison-calibration-v3-adjudication.js";

const artifact = (): InputFieldCalibrationV3Adjudication =>
  JSON.parse(
    readFileSync(FINAL_ADJUDICATION_PATH, "utf8"),
  ) as InputFieldCalibrationV3Adjudication;
const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

test("committed replacement adjudication re-derives the sealed refusal", () => {
  const result =
    validateCommittedInputFieldCalibrationV3Adjudication(artifact());

  assert.equal(result.instrumentValidity.status, "failed");
  assert.equal(result.sequence.sealedAnswerKeyParsed, false);
  assert.equal(result.sequence.performanceIdentityUnsealed, false);
  assert.equal(result.architecturePerformance, null);
  assert.equal(result.consensus, null);
  assert.equal(result.evidenceStatus.inputOverall, false);
  assert.equal(result.evidenceStatus.liveInputMayProceed, false);
});

test("opaque B/C/D reliability metrics match the locked calculation", () => {
  const result = artifact();

  assert.deepEqual(
    result.raterValidations.map((validation) => [
      validation.rater,
      validation.recognisable,
    ]),
    [
      ["RATER-CAL-V2-B", 4],
      ["RATER-CAL-V2-C", 14],
      ["RATER-CAL-V3-D", 26],
    ],
  );
  assert.deepEqual(result.opaqueReliability.unanimous, {
    count: 359,
    ratio: 359 / 384,
    unanimousPass: 2,
    unanimousFail: 357,
  });
  assert.deepEqual(result.opaqueReliability.split, {
    count: 25,
    ratio: 25 / 384,
  });
  assert.deepEqual(
    result.opaqueReliability.pairwise.map((metric) => ({
      raters: metric.raters,
      agreements: metric.agreements,
      ratio: metric.ratio,
      kappa: metric.cohensKappa,
    })),
    [
      {
        raters: "B-C",
        agreements: 370,
        ratio: 370 / 384,
        kappa: 0.20941176470588072,
      },
      {
        raters: "B-D",
        agreements: 360,
        ratio: 360 / 384,
        kappa: 0.18528995756718633,
      },
      {
        raters: "C-D",
        agreements: 372,
        ratio: 372 / 384,
        kappa: 0.6850738108255877,
      },
    ],
  );
  assert.equal(
    result.opaqueReliability.overallPairwiseAgreement,
    0.956597222222222,
  );
  assert.equal(result.opaqueReliability.fleissKappa, 0.40925500492287054);
  assert.equal(result.opaqueReliability.majorityFailureRows, 369);
  assert.equal(
    result.opaqueReliability.majorityFailuresWithTwoConcreteRaterDefectSets,
    369,
  );
});

test("hidden-copy integrity passes but cannot override Fleiss failure", () => {
  const result = artifact();

  for (const metric of Object.values(result.duplicateIntegrity.byRater)) {
    assert.equal(metric.agreements, 128);
    assert.equal(metric.ratio, 1);
    assert.equal(metric.opaqueFirstPasses, 0);
    assert.equal(metric.opaqueSecondPasses, 0);
    assert.equal(metric.passRateDelta, 0);
  }
  assert.equal(result.duplicateIntegrity.majorityConsensus.agreements, 128);
  assert.equal(result.duplicateIntegrity.majorityConsensus.passPairs, 0);
  assert.equal(result.thresholds.fleissKappa.passed, false);
  assert.equal(result.offlineDifficultControlCriterion.status, "not-evaluated");
  assert.equal(result.instability.resolvedByReplacementCohort, false);
});

test("reader refuses reordered, relabelled, or stale submission rows", () => {
  const reordered = readAdjudicationSources();
  const submission = JSON.parse(reordered.submissions["RATER-CAL-V2-B"]) as any;
  [submission.orderedGrades[0], submission.orderedGrades[1]] = [
    submission.orderedGrades[1],
    submission.orderedGrades[0],
  ];
  reordered.submissions["RATER-CAL-V2-B"] = jsonBytes(submission);
  assert.throws(
    () => adjudicateInputFieldCalibrationV3(reordered),
    /grade 0 order, IDs, verdict, or confidence differs/,
  );

  const relabelled = readAdjudicationSources();
  const dSubmission = JSON.parse(
    relabelled.submissions["RATER-CAL-V3-D"],
  ) as any;
  dSubmission.graderId = "RATER-CAL-V2-A";
  relabelled.submissions["RATER-CAL-V3-D"] = jsonBytes(dSubmission);
  assert.throws(
    () => adjudicateInputFieldCalibrationV3(relabelled),
    /grade envelope binding, counts, or required fields differ/,
  );
});

test("reader refuses template, key, and final-verdict tampering", () => {
  const changedTemplate = readAdjudicationSources();
  const template = JSON.parse(
    changedTemplate.templates["RATER-CAL-V2-C"],
  ) as any;
  template.counts.expected = 383;
  changedTemplate.templates["RATER-CAL-V2-C"] = jsonBytes(template);
  assert.throws(
    () => adjudicateInputFieldCalibrationV3(changedTemplate),
    /performance template hash or path differs/,
  );

  const changedKey = readAdjudicationSources();
  changedKey.sealedKeyBytes = Buffer.from(changedKey.sealedKeyBytes);
  changedKey.sealedKeyBytes[0] ^= 1;
  assert.throws(
    () => adjudicateInputFieldCalibrationV3(changedKey),
    /sealed performance key hash differs/,
  );

  const changedVerdict = structuredClone(artifact()) as any;
  changedVerdict.thresholds.fleissKappa.passed = true;
  assert.throws(
    () => validateCommittedInputFieldCalibrationV3Adjudication(changedVerdict),
    /hashes, reliability, seal, status, or verdict differ/,
  );
});
