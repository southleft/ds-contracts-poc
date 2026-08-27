import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateInputFieldComparison,
  INPUT_FIELD_ADJUDICATION_PATH,
  readInputFieldAdjudicationSources,
  validateCommittedInputFieldAdjudication,
  type InputFieldComparisonAdjudication,
} from "./input-field-comparison-adjudication.js";

const artifact = (): InputFieldComparisonAdjudication =>
  JSON.parse(
    readFileSync(INPUT_FIELD_ADJUDICATION_PATH, "utf8"),
  ) as InputFieldComparisonAdjudication;

const sha256File = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

test("committed Input/Field adjudication re-derives the exact unsealed result", () => {
  const result = validateCommittedInputFieldAdjudication(artifact());
  assert.deepEqual(result.aggregates.byImplementation, {
    legacy: {
      cellWeighted: { numerator: 88, denominator: 128, ratio: 0.6875 },
      completeSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
    recipeReact: {
      cellWeighted: { numerator: 40, denominator: 128, ratio: 0.3125 },
      completeSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
  });
  assert.deepEqual(result.aggregates.bySource, {
    mui: {
      legacy: { numerator: 62, denominator: 64, ratio: 0.96875 },
      recipeReact: { numerator: 2, denominator: 64, ratio: 0.03125 },
    },
    polaris: {
      legacy: { numerator: 26, denominator: 64, ratio: 0.40625 },
      recipeReact: { numerator: 38, denominator: 64, ratio: 0.59375 },
    },
  });
  assert.deepEqual(result.aggregates.pairedOutcomes, {
    recipeBeatLegacy: 40,
    tiedPass: 0,
    tiedFail: 0,
    legacyBeatRecipe: 88,
    total: 128,
  });
  assert.equal(result.verdict.offlineDifficultControlCriterion, "failed");
  assert.equal(result.verdict.inputSuccess, false);
});

test("Input/Field evidence index retains the failed offline verdict", () => {
  const index = JSON.parse(
    readFileSync("recipe/evidence/input-field-comparison/index.json", "utf8"),
  ) as {
    status: string;
    overall: boolean;
    gradeWritten: boolean;
    gradesHash: string;
    sealedAnswerKeyHash: string;
    comparisonResultHash: string;
    offlineResult: Record<string, string | number>;
    evidenceColumns: Record<string, string | boolean>;
  };
  assert.equal(index.status, "adjudicated-failed-offline-recognisability");
  assert.equal(index.overall, false);
  assert.equal(index.gradeWritten, true);
  assert.equal(
    index.gradesHash,
    sha256File(
      "recipe/evidence/input-field-comparison/blind-packet/grades.json",
    ),
  );
  assert.equal(
    index.sealedAnswerKeyHash,
    sha256File("recipe/evidence/input-field-comparison/sealed-answer-key.json"),
  );
  assert.equal(
    index.comparisonResultHash,
    sha256File(INPUT_FIELD_ADJUDICATION_PATH),
  );
  assert.deepEqual(index.offlineResult, {
    legacyCellWeighted: "88/128",
    recipeReactCellWeighted: "40/128",
    legacyCompleteSetWeighted: "0/2",
    recipeReactCompleteSetWeighted: "0/2",
    recipeBeatLegacy: 40,
    tiedPass: 0,
    tiedFail: 0,
    legacyBeatRecipe: 88,
    offlineDifficultControlCriterion: "failed",
  });
  assert.equal(index.evidenceColumns.pairedBlindRecognisability, "failed");
  assert.equal(index.evidenceColumns.overallInputSuccess, false);
});

test("committed reader refuses changed grade and key bytes", () => {
  const changedGrades = readInputFieldAdjudicationSources();
  changedGrades.grades += " ";
  assert.throws(
    () => validateCommittedInputFieldAdjudication(artifact(), changedGrades),
    /adjudication is stale/,
  );

  const changedKey = readInputFieldAdjudicationSources();
  changedKey.key += " ";
  assert.throws(
    () => validateCommittedInputFieldAdjudication(artifact(), changedKey),
    /adjudication is stale/,
  );
});

test("adjudicator refuses planted grade failures", () => {
  const missingDefect = readInputFieldAdjudicationSources();
  const gradeBatch = JSON.parse(missingDefect.grades) as {
    grades: Array<{
      recognisable: boolean;
      defects: string[];
    }>;
  };
  const failure = gradeBatch.grades.find((grade) => !grade.recognisable)!;
  failure.defects = [];
  missingDefect.grades = `${JSON.stringify(gradeBatch, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldComparison(missingDefect),
    /failure has no defects/,
  );

  const guessed = readInputFieldAdjudicationSources();
  const guessedBatch = JSON.parse(guessed.grades) as {
    grades: Array<{ defects: string[] }>;
  };
  guessedBatch.grades[0]!.defects.push(
    "This is likely the recipe implementation.",
  );
  guessed.grades = `${JSON.stringify(guessedBatch, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldComparison(guessed),
    /implementation guess/,
  );
});

test("adjudicator refuses planted key and mapping failures", () => {
  const unsealed = readInputFieldAdjudicationSources();
  const unsealedKey = JSON.parse(unsealed.key) as {
    sealedFromBlindGrader: boolean;
  };
  unsealedKey.sealedFromBlindGrader = false;
  unsealed.key = `${JSON.stringify(unsealedKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldComparison(unsealed),
    /not sealed from the blind grader/,
  );

  const duplicate = readInputFieldAdjudicationSources();
  const duplicateKey = JSON.parse(duplicate.key) as {
    answers: Array<Record<string, unknown>>;
  };
  duplicateKey.answers[1] = structuredClone(duplicateKey.answers[0]!);
  duplicate.key = `${JSON.stringify(duplicateKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldComparison(duplicate),
    /duplicate, missing, or foreign mapping/,
  );

  const wrongCell = readInputFieldAdjudicationSources();
  const wrongCellKey = JSON.parse(wrongCell.key) as {
    answers: Array<{ cellKey: string }>;
  };
  wrongCellKey.answers[0]!.cellKey = wrongCellKey.answers[2]!.cellKey;
  wrongCell.key = `${JSON.stringify(wrongCellKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldComparison(wrongCell),
    /differs across packet\/grade\/key\/receipt|unsealed mapping is incomplete/,
  );
});

test("committed reader refuses planted mapping and arithmetic failures", () => {
  const wrongMapping = structuredClone(artifact());
  wrongMapping.mapping[0]!.cellKey = wrongMapping.mapping[2]!.cellKey;
  assert.throws(
    () => validateCommittedInputFieldAdjudication(wrongMapping),
    /mapping or aggregate arithmetic differs/,
  );

  const impossible = structuredClone(artifact());
  impossible.aggregates.byImplementation.recipeReact.cellWeighted.numerator = 129;
  assert.throws(
    () => validateCommittedInputFieldAdjudication(impossible),
    /mapping or aggregate arithmetic differs/,
  );
});
