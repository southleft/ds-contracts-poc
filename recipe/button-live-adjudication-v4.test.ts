import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateButtonLiveV4,
  BUTTON_LIVE_V4_ADJUDICATION_PATH,
  readButtonLiveV4AdjudicationSources,
  validateCommittedButtonLiveV4Adjudication,
  type ButtonLiveV4Adjudication,
} from "./button-live-adjudication-v4.js";
import { readRepositoryJson } from "./evidence-path.js";

const artifact = (): ButtonLiveV4Adjudication =>
  JSON.parse(
    readFileSync(BUTTON_LIVE_V4_ADJUDICATION_PATH, "utf8"),
  ) as ButtonLiveV4Adjudication;

test("historical v4 adjudication bytes are preserved but current Button success is false", () => {
  const historical = artifact();
  assert.deepEqual(historical.aggregates.overall, {
    numerator: 12,
    denominator: 12,
    ratio: 1,
  });
  assert.deepEqual(historical.aggregates.bySourceLibrary, {
    altitude: { numerator: 6, denominator: 6, ratio: 1 },
    fluent: { numerator: 6, denominator: 6, ratio: 1 },
  });
  assert.deepEqual(historical.aggregates.byVariant, {
    primary: { numerator: 6, denominator: 6, ratio: 1 },
    secondary: { numerator: 6, denominator: 6, ratio: 1 },
  });
  assert.deepEqual(historical.aggregates.byState, {
    default: { numerator: 4, denominator: 4, ratio: 1 },
    hover: { numerator: 4, denominator: 4, ratio: 1 },
    "focus-visible": { numerator: 4, denominator: 4, ratio: 1 },
  });
  assert.deepEqual(historical.aggregates.confidence.overall, {
    low: 0,
    medium: 0,
    high: 12,
    total: 12,
  });
  assert.equal(historical.verdict.buttonSuccess, true);
  assert.throws(
    () => validateCommittedButtonLiveV4Adjudication(historical),
    /final adjudication is stale/,
  );
  const current = readRepositoryJson<Record<string, any>>(
    "recipe/evidence/status-index.json",
  );
  assert.equal(current.button.overallSuccess, false);
  assert.equal(current.button.status, "pending");
});

test("historical reader refuses current-source drift and planted tampering", () => {
  const changedGrades = readButtonLiveV4AdjudicationSources();
  changedGrades.grades += " ";
  assert.throws(
    () => validateCommittedButtonLiveV4Adjudication(artifact(), changedGrades),
    /final adjudication is stale/,
  );

  const impossible = structuredClone(artifact());
  impossible.aggregates.overall.numerator = 11;
  assert.throws(
    () => validateCommittedButtonLiveV4Adjudication(impossible),
    /final adjudication is stale/,
  );
});

test("historical reader refuses a planted missing evidence column as stale", () => {
  const missing = structuredClone(artifact()) as unknown as {
    evidenceColumns: Record<string, unknown>;
  };
  delete missing.evidenceColumns.exactProbeRestoration;
  assert.throws(
    () =>
      validateCommittedButtonLiveV4Adjudication(
        missing as unknown as ButtonLiveV4Adjudication,
      ),
    /final adjudication is stale/,
  );
});

test("adjudicator refuses planted grade, mapping, and provenance tampering", () => {
  const guessed = readButtonLiveV4AdjudicationSources();
  const guessedGrades = JSON.parse(guessed.grades) as {
    grades: Array<{ defects: string[] }>;
  };
  guessedGrades.grades[0]!.defects.push(
    "This is probably the recipe implementation.",
  );
  guessed.grades = `${JSON.stringify(guessedGrades, null, 2)}\n`;
  assert.throws(() => adjudicateButtonLiveV4(guessed), /implementation guess/);

  const duplicate = readButtonLiveV4AdjudicationSources();
  const duplicateKey = JSON.parse(duplicate.key) as {
    mappings: Array<Record<string, unknown>>;
  };
  duplicateKey.mappings[1] = structuredClone(duplicateKey.mappings[0]!);
  duplicate.key = `${JSON.stringify(duplicateKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonLiveV4(duplicate),
    /packet\/key\/receipt hashes differ|not bijective|cardinality\/order/,
  );

  const selfReference = readButtonLiveV4AdjudicationSources();
  const selfReferenceKey = JSON.parse(selfReference.key) as {
    mappings: Array<{
      sourceReferencePath: string;
      liveEvidencePath: string;
    }>;
  };
  selfReferenceKey.mappings[0]!.sourceReferencePath =
    selfReferenceKey.mappings[0]!.liveEvidencePath;
  selfReference.key = `${JSON.stringify(selfReferenceKey, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonLiveV4(selfReference),
    /packet\/key\/receipt hashes differ|copied evidence bytes differ|self-referential/,
  );
});

test("adjudicator refuses planted grade arithmetic and required-field failures", () => {
  const arithmetic = readButtonLiveV4AdjudicationSources();
  const arithmeticGrades = JSON.parse(arithmetic.grades) as {
    counts: { recognisable: number };
  };
  arithmeticGrades.counts.recognisable = 11;
  arithmetic.grades = `${JSON.stringify(arithmeticGrades, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonLiveV4(arithmetic),
    /grade count arithmetic is impossible/,
  );

  const missing = readButtonLiveV4AdjudicationSources();
  const missingGrades = JSON.parse(missing.grades) as {
    grades: Array<Record<string, unknown>>;
  };
  delete missingGrades.grades[0]!.confidence;
  missing.grades = `${JSON.stringify(missingGrades, null, 2)}\n`;
  assert.throws(
    () => adjudicateButtonLiveV4(missing),
    /required fields differ/,
  );
});
