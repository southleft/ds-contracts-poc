import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateButtonComparison,
  adjudicateButtonV2Comparison,
  BUTTON_ADJUDICATION_PATH,
  BUTTON_V2_ADJUDICATION_PATH,
  readButtonAdjudicationSources,
  readButtonV2AdjudicationSources,
  validateCommittedButtonAdjudication,
  validateCommittedButtonV2Adjudication,
  type ButtonComparisonAdjudication,
} from "./comparison-adjudication.js";

const artifact = (): ButtonComparisonAdjudication =>
  JSON.parse(
    readFileSync(BUTTON_ADJUDICATION_PATH, "utf8"),
  ) as ButtonComparisonAdjudication;

const v2Artifact = (): ButtonComparisonAdjudication =>
  JSON.parse(
    readFileSync(BUTTON_V2_ADJUDICATION_PATH, "utf8"),
  ) as ButtonComparisonAdjudication;

test("committed Button adjudication re-derives exact unsealed arithmetic", () => {
  const result = validateCommittedButtonAdjudication(artifact());
  assert.deepEqual(result.aggregates.byImplementation, {
    legacy: {
      cellWeighted: { numerator: 9, denominator: 12, ratio: 0.75 },
      setWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
    recipeReact: {
      cellWeighted: { numerator: 0, denominator: 12, ratio: 0 },
      setWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
  });
  assert.deepEqual(result.aggregates.pairedCellOutcomes, {
    recipeBeatLegacy: 0,
    tiedPass: 0,
    tiedFail: 3,
    legacyBeatRecipe: 9,
    total: 12,
  });
  assert.equal(result.webComponentParity.includedInBlindBatch, false);
  assert.equal(result.verdict.buttonSuccess, false);
});

test("committed reader refuses changed grade bytes and changed key bytes", () => {
  const changedGrades = readButtonAdjudicationSources();
  changedGrades.grades += " ";
  assert.throws(
    () => validateCommittedButtonAdjudication(artifact(), changedGrades),
    /adjudication is stale/,
  );

  const changedKey = readButtonAdjudicationSources();
  changedKey.key = changedKey.key.replace(
    '"sealedFromBlindGrader": true',
    '"sealedFromBlindGrader": false',
  );
  assert.throws(
    () => validateCommittedButtonAdjudication(artifact(), changedKey),
    /adjudication is stale/,
  );
});

test("adjudicator refuses duplicate and missing answer mappings", () => {
  const duplicate = readButtonAdjudicationSources();
  const duplicateKey = JSON.parse(duplicate.key) as {
    answers: Array<Record<string, unknown>>;
  };
  duplicateKey.answers[1] = structuredClone(duplicateKey.answers[0]!);
  duplicate.key = `${JSON.stringify(duplicateKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonComparison(duplicate),
    /answer key has duplicate or missing mapping|cardinality\/order differs/,
  );

  const missing = readButtonAdjudicationSources();
  const missingKey = JSON.parse(missing.key) as {
    answers: Array<Record<string, unknown>>;
  };
  missingKey.answers.pop();
  missing.key = `${JSON.stringify(missingKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonComparison(missing),
    /answer key cardinality\/order differs/,
  );
});

test("committed reader refuses impossible aggregate arithmetic", () => {
  const impossible = structuredClone(artifact());
  impossible.aggregates.byImplementation.recipeReact.cellWeighted.numerator = 13;
  assert.throws(
    () => validateCommittedButtonAdjudication(impossible),
    /mapping or aggregate arithmetic differs/,
  );
});

test("adjudicator refuses grader implementation guesses", () => {
  const guessed = readButtonAdjudicationSources();
  const grades = JSON.parse(guessed.grades) as {
    grades: Array<{ defects: string[] }>;
  };
  grades.grades[0]!.defects.push("This is probably the recipe implementation.");
  guessed.grades = `${JSON.stringify(grades, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonComparison(guessed),
    /grader included an implementation guess/,
  );
});

test("committed Button v2 adjudication re-derives the exact paired win", () => {
  const result = validateCommittedButtonV2Adjudication(v2Artifact());
  assert.deepEqual(result.aggregates.byImplementation, {
    legacy: {
      cellWeighted: {
        numerator: 7,
        denominator: 12,
        ratio: 7 / 12,
      },
      setWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
    recipeReact: {
      cellWeighted: { numerator: 12, denominator: 12, ratio: 1 },
      setWeighted: { numerator: 2, denominator: 2, ratio: 1 },
    },
  });
  assert.deepEqual(result.aggregates.pairedCellOutcomes, {
    recipeBeatLegacy: 5,
    tiedPass: 7,
    tiedFail: 0,
    legacyBeatRecipe: 0,
    total: 12,
  });
  assert.deepEqual(result.defects.byImplementation.recipeReact, {
    failedSpecimens: 0,
    statements: 0,
    classes: {},
  });
  assert.deepEqual(result.comparisonHistory?.immutableV1, {
    adjudicationArtifact: BUTTON_ADJUDICATION_PATH,
    adjudicationHash:
      "46942e6814b766ecd9014df6c1f17acf40be4619171dcb08dc9bd3f41c43577d",
    referencesAndLegacyBytesRetained: true,
    legacyCellWeighted: { numerator: 9, denominator: 12, ratio: 0.75 },
    recipeReactCellWeighted: { numerator: 0, denominator: 12, ratio: 0 },
    recipeReactSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
  });
  assert.equal(result.verdict.offlineRecognisabilityCriterionMet, true);
  assert.equal(result.verdict.buttonSuccess, false);
});

test("v2 committed reader refuses changed grade, key, and result arithmetic", () => {
  const changedGrades = readButtonV2AdjudicationSources();
  changedGrades.grades += " ";
  assert.throws(
    () => validateCommittedButtonV2Adjudication(v2Artifact(), changedGrades),
    /adjudication is stale/,
  );

  const changedKey = readButtonV2AdjudicationSources();
  changedKey.key = changedKey.key.replace(
    '"sealedFromBlindGrader": true',
    '"sealedFromBlindGrader": false',
  );
  assert.throws(
    () => validateCommittedButtonV2Adjudication(v2Artifact(), changedKey),
    /adjudication is stale/,
  );

  const impossible = structuredClone(v2Artifact());
  impossible.aggregates.pairedCellOutcomes.recipeBeatLegacy = 12;
  assert.throws(
    () => validateCommittedButtonV2Adjudication(impossible),
    /mapping or aggregate arithmetic differs/,
  );
});

test("v2 adjudicator refuses planted blind-integrity failures", () => {
  const guess = readButtonV2AdjudicationSources();
  const guessedGrades = JSON.parse(guess.grades) as {
    grades: Array<{ defects: string[] }>;
  };
  guessedGrades.grades[0]!.defects.push("Likely the legacy implementation.");
  guess.grades = `${JSON.stringify(guessedGrades, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonV2Comparison(guess),
    /grader included an implementation guess/,
  );

  const missingDefect = readButtonV2AdjudicationSources();
  const invalidGrades = JSON.parse(missingDefect.grades) as {
    grades: Array<{ recognisable: boolean; defects: string[] }>;
  };
  const failed = invalidGrades.grades.find((grade) => !grade.recognisable)!;
  failed.defects = [];
  missingDefect.grades = `${JSON.stringify(invalidGrades, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonV2Comparison(missingDefect),
    /failure has no defects/,
  );

  const zeroMeasurement = readButtonV2AdjudicationSources();
  const zeroReceipt = JSON.parse(zeroMeasurement.receipt) as {
    manifests: {
      legacy: { cells: Array<{ comparedPixels: number }> };
    };
  };
  zeroReceipt.manifests.legacy.cells[0]!.comparedPixels = 0;
  zeroMeasurement.receipt = `${JSON.stringify(zeroReceipt, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonV2Comparison(zeroMeasurement),
    /ZERO-COMPARED-PIXELS|zero-count measurement/,
  );

  const separated = readButtonV2AdjudicationSources();
  const unsealedReceipt = JSON.parse(separated.receipt) as {
    blindPacket: { path: string; sealedAnswerKey: string };
  };
  unsealedReceipt.blindPacket.sealedAnswerKey =
    unsealedReceipt.blindPacket.path;
  separated.receipt = `${JSON.stringify(unsealedReceipt, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonV2Comparison(separated),
    /packet\/key separation/,
  );
});

test("v2 adjudicator refuses drift from immutable v1 references and legacy", () => {
  const drifted = readButtonV2AdjudicationSources();
  const receipt = JSON.parse(drifted.receipt) as {
    references: Array<{ hash: string }>;
  };
  receipt.references[0]!.hash = "0".repeat(64);
  drifted.receipt = `${JSON.stringify(receipt, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonV2Comparison(drifted),
    /bytes differ from its receipt hash|differ from immutable v1/,
  );
});
