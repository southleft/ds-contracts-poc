import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateInputFieldV2Comparison,
  INPUT_FIELD_V2_ADJUDICATION_PATH,
  readInputFieldV2AdjudicationSources,
  validateCommittedInputFieldV2Adjudication,
  type InputFieldV2ComparisonAdjudication,
} from "./input-field-comparison-v2-adjudication.js";

const artifact = (): InputFieldV2ComparisonAdjudication =>
  JSON.parse(
    readFileSync(INPUT_FIELD_V2_ADJUDICATION_PATH, "utf8"),
  ) as InputFieldV2ComparisonAdjudication;
const hash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

test("committed Input/Field v2 result re-derives the exact unsealed comparison", () => {
  const result = validateCommittedInputFieldV2Adjudication(artifact());
  assert.deepEqual(result.aggregates.byImplementation, {
    legacy: {
      cellWeighted: { numerator: 0, denominator: 128, ratio: 0 },
      completeSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
    recipeReact: {
      cellWeighted: { numerator: 96, denominator: 128, ratio: 0.75 },
      completeSetWeighted: { numerator: 1, denominator: 2, ratio: 0.5 },
    },
  });
  assert.deepEqual(result.aggregates.bySource, {
    mui: {
      legacy: { numerator: 0, denominator: 64, ratio: 0 },
      recipeReact: { numerator: 64, denominator: 64, ratio: 1 },
    },
    polaris: {
      legacy: { numerator: 0, denominator: 64, ratio: 0 },
      recipeReact: { numerator: 32, denominator: 64, ratio: 0.5 },
    },
  });
  assert.deepEqual(result.aggregates.pairedOutcomes, {
    recipeBeatLegacy: 96,
    tiedPass: 0,
    tiedFail: 32,
    legacyBeatRecipe: 0,
    total: 128,
  });
  assert.equal(result.verdict.offlineDifficultControlCriterion, "passed");
  assert.equal(result.verdict.inputSuccess, false);
});

test("Input/Field v2 index pins inputs, separate columns, and overall false", () => {
  const index = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-comparison-v2/index.json",
      "utf8",
    ),
  ) as {
    overall: boolean;
    gradeWritten: boolean;
    receipt: string;
    receiptHash: string;
    packet: string;
    packetHash: string;
    grades: string;
    gradesHash: string;
    gradesRaterB: string;
    gradesRaterBHash: string;
    gradesRaterC: string;
    gradesRaterCHash: string;
    sealedAnswerKey: string;
    sealedAnswerKeyHash: string;
    comparisonResult: string;
    comparisonResultHash: string;
    multiRaterAdjudication: string;
    multiRaterAdjudicationHash: string;
    evidenceColumns: Record<string, string | boolean>;
  };
  assert.equal(index.overall, false);
  assert.equal(index.gradeWritten, true);
  for (const [file, expected] of [
    [index.receipt, index.receiptHash],
    [index.packet, index.packetHash],
    [index.grades, index.gradesHash],
    [index.gradesRaterB, index.gradesRaterBHash],
    [index.gradesRaterC, index.gradesRaterCHash],
    [index.sealedAnswerKey, index.sealedAnswerKeyHash],
    [index.comparisonResult, index.comparisonResultHash],
    [index.multiRaterAdjudication, index.multiRaterAdjudicationHash],
  ]) {
    assert.equal(hash(file), expected);
  }
  assert.equal(index.evidenceColumns.measurementReliability, "passed");
  assert.equal(
    index.evidenceColumns.pairedBlindRecognisability,
    "blocked-inter-batch-instability",
  );
  assert.equal(index.evidenceColumns.architecturePerformance, "blocked");
  assert.equal(index.evidenceColumns.liveFigma, "pending");
  assert.equal(index.evidenceColumns.overallInputSuccess, false);
});

test("committed v2 reader refuses stale grade, key, and result arithmetic", () => {
  const changedGrades = readInputFieldV2AdjudicationSources();
  changedGrades.grades += " ";
  assert.throws(
    () => validateCommittedInputFieldV2Adjudication(artifact(), changedGrades),
    /adjudication is stale/,
  );

  const changedKey = readInputFieldV2AdjudicationSources();
  changedKey.key += " ";
  assert.throws(
    () => validateCommittedInputFieldV2Adjudication(artifact(), changedKey),
    /adjudication is stale/,
  );

  const impossible = structuredClone(artifact());
  impossible.aggregates.byImplementation.recipeReact.cellWeighted.numerator = 129;
  assert.throws(
    () => validateCommittedInputFieldV2Adjudication(impossible),
    /mapping, aggregate arithmetic, or verdict differs/,
  );
});

test("v2 adjudicator refuses identity guesses and missing failure defects", () => {
  const guessed = readInputFieldV2AdjudicationSources();
  const guessedBatch = JSON.parse(guessed.grades) as {
    grades: Array<{ defects: string[] }>;
  };
  guessedBatch.grades[0]!.defects.push(
    "This is probably the legacy implementation.",
  );
  guessed.grades = `${JSON.stringify(guessedBatch, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(guessed),
    /implementation identity guess/,
  );

  const missingDefect = readInputFieldV2AdjudicationSources();
  const missingBatch = JSON.parse(missingDefect.grades) as {
    grades: Array<{ recognisable: boolean; defects: string[] }>;
  };
  missingBatch.grades.find((grade) => !grade.recognisable)!.defects = [];
  missingDefect.grades = `${JSON.stringify(missingBatch, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(missingDefect),
    /grade fields or failure defects are invalid/,
  );
});

test("v2 adjudicator refuses packet/key collapse and zero-pixel evidence", () => {
  const collapsed = readInputFieldV2AdjudicationSources();
  const collapsedReceipt = JSON.parse(collapsed.receipt) as {
    blindPacket: { path: string; sealedAnswerKey: string };
  };
  collapsedReceipt.blindPacket.sealedAnswerKey =
    collapsedReceipt.blindPacket.path;
  collapsed.receipt = `${JSON.stringify(collapsedReceipt, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(collapsed),
    /packet\/key separation/,
  );

  const zeroPixels = readInputFieldV2AdjudicationSources();
  const zeroReceipt = JSON.parse(zeroPixels.receipt) as {
    outputs: { recipeReact: Array<{ paintedPixels: number }> };
  };
  zeroReceipt.outputs.recipeReact[0]!.paintedPixels = 0;
  zeroPixels.receipt = `${JSON.stringify(zeroReceipt, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(zeroPixels),
    /empty geometry or pixels/,
  );
});

test("v2 adjudicator refuses duplicate key mappings and protocol drift", () => {
  const duplicate = readInputFieldV2AdjudicationSources();
  const duplicateKey = JSON.parse(duplicate.key) as {
    answers: Array<Record<string, unknown>>;
  };
  duplicateKey.answers[1] = structuredClone(duplicateKey.answers[0]!);
  duplicate.key = `${JSON.stringify(duplicateKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(duplicate),
    /duplicate, missing, or foreign mapping/,
  );

  const changedProtocol = readInputFieldV2AdjudicationSources();
  const protocolBatch = JSON.parse(changedProtocol.grades) as {
    packetProtocol: { crop: string };
  };
  protocolBatch.packetProtocol.crop = "changed";
  changedProtocol.grades = `${JSON.stringify(protocolBatch, null, 2)}\n`;
  assert.throws(
    () => adjudicateInputFieldV2Comparison(changedProtocol),
    /protocol differs/,
  );
});
