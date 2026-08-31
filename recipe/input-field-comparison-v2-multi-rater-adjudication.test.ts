import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adjudicateInputFieldV2MultiRater,
  INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH,
  readInputFieldV2MultiRaterSources,
  validateCommittedInputFieldV2MultiRater,
  type InputFieldV2MultiRaterAdjudication,
} from "./input-field-comparison-v2-multi-rater-adjudication.js";

const artifact = (): InputFieldV2MultiRaterAdjudication =>
  JSON.parse(
    readFileSync(INPUT_FIELD_V2_MULTI_RATER_ADJUDICATION_PATH, "utf8"),
  ) as InputFieldV2MultiRaterAdjudication;

const jsonBytes = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

test("committed multi-rater adjudication re-derives reliability and consensus", () => {
  const result = validateCommittedInputFieldV2MultiRater(artifact());
  assert.equal(result.reliability.status, "passed");
  assert.equal(result.agreement.unanimousCount, 227);
  assert.equal(result.agreement.twoOfThreeCount, 29);
  assert.equal(result.agreement.fleissKappa, 0.8428006775832869);
  assert.deepEqual(
    result.agreement.pairwise.map((pair) => ({
      raters: pair.raters,
      agreement: pair.percentAgreement,
      kappa: pair.cohensKappa,
    })),
    [
      {
        raters: "A-B",
        agreement: 0.8984375,
        kappa: 0.7936507936507936,
      },
      {
        raters: "A-C",
        agreement: 0.984375,
        kappa: 0.9663865546218487,
      },
      {
        raters: "B-C",
        agreement: 0.890625,
        kappa: 0.7773359840954275,
      },
    ],
  );
  assert.deepEqual(result.consensus?.aggregates.byImplementation, {
    legacy: {
      cellWeighted: { numerator: 0, denominator: 128, ratio: 0 },
      completeSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
    recipeReact: {
      cellWeighted: {
        numerator: 95,
        denominator: 128,
        ratio: 0.7421875,
      },
      completeSetWeighted: { numerator: 0, denominator: 2, ratio: 0 },
    },
  });
  assert.equal(
    result.productVerdict.status,
    "blocked-inter-batch-measurement-instability",
  );
  assert.equal(result.productVerdict.liveInputMayProceed, false);
});

test("committed reader pins every rater and aggregate arithmetic", () => {
  const stale = readInputFieldV2MultiRaterSources();
  stale.raterB += " ";
  assert.throws(
    () => validateCommittedInputFieldV2MultiRater(artifact(), stale),
    /multi-rater adjudication is stale/,
  );

  const impossible = structuredClone(artifact());
  impossible.consensus!.aggregates.byImplementation.recipeReact.cellWeighted.numerator = 129;
  assert.throws(
    () => validateCommittedInputFieldV2MultiRater(impossible),
    /mapping, agreement, arithmetic, or verdict differs/,
  );
});

test("pre-unseal gate refuses a missing rater", () => {
  const sources = readInputFieldV2MultiRaterSources();
  const raterC = JSON.parse(sources.raterC) as Record<string, unknown>;
  delete raterC.cells;
  sources.raterC = jsonBytes(raterC);
  assert.throws(
    () => adjudicateInputFieldV2MultiRater(sources),
    /all three raters are required/,
  );
});

test("pre-unseal gate refuses reordered grades", () => {
  const sources = readInputFieldV2MultiRaterSources();
  const raterB = JSON.parse(sources.raterB) as {
    grades: unknown[];
  };
  [raterB.grades[0], raterB.grades[1]] = [raterB.grades[1], raterB.grades[0]];
  sources.raterB = jsonBytes(raterB);
  assert.throws(
    () => adjudicateInputFieldV2MultiRater(sources),
    /rater B grade cardinality, uniqueness, or packet order differs/,
  );
});

test("threshold failure blocks before attempting to parse the key", () => {
  const sources = readInputFieldV2MultiRaterSources();
  const raterB = JSON.parse(sources.raterB) as {
    grades: Array<{
      recognisable: boolean;
      defects: string[];
    }>;
  };
  for (const grade of raterB.grades) {
    grade.recognisable = !grade.recognisable;
    grade.defects = grade.recognisable
      ? []
      : [
          "Calibration control: visible field geometry and state treatment differ materially from the paired reference.",
        ];
  }
  sources.raterB = jsonBytes(raterB);
  sources.key = "the reliability blocker must prevent this invalid JSON";
  const result = adjudicateInputFieldV2MultiRater(sources);
  assert.equal(result.reliability.status, "failed");
  assert.equal(result.keyIntegrity, null);
  assert.equal(result.consensus, null);
  assert.equal(result.productVerdict.status, "blocked-pre-unseal-reliability");
});

test("pre-unseal gate refuses majority failure without concrete defects", () => {
  const sources = readInputFieldV2MultiRaterSources();
  const raterC = JSON.parse(sources.raterC) as {
    cells: Array<{
      specimens: Array<{
        grade: { recognisable: boolean; defects: string[] };
      }>;
    }>;
  };
  const target = raterC.cells
    .flatMap((cell) => cell.specimens)
    .find((specimen) => !specimen.grade.recognisable);
  assert.ok(target);
  target.grade.defects = [];
  sources.raterC = jsonBytes(raterC);
  assert.throws(
    () => adjudicateInputFieldV2MultiRater(sources),
    /rater C grade fields or failure defects are invalid/,
  );
});

test("post-reliability gate refuses answer-key tampering", () => {
  const sources = readInputFieldV2MultiRaterSources();
  const key = JSON.parse(sources.key) as {
    answers: Array<{ outputHash: string }>;
  };
  key.answers[0]!.outputHash = "0".repeat(64);
  sources.key = jsonBytes(key);
  assert.throws(
    () => adjudicateInputFieldV2MultiRater(sources),
    /differs across packet\/grade\/key\/receipt/,
  );
});
