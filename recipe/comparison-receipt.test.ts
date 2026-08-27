import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { ManifestRow } from "../extract/figma/census/corpus.js";
import { judgeRow, USABLE_DIR } from "../extract/figma/census/usable.js";
import {
  readCommittedButtonAdjudication,
  readCommittedButtonV2Adjudication,
} from "./comparison-adjudication.js";

interface PivotComparisonReceipt {
  legacyCi: {
    status: string;
    passed: number;
    total: number;
    failing: string[];
  };
  corpus: {
    contracts: number;
    referenceRenders: number;
    recognisableSets: number;
    usableSets: number;
    unwalledNotRecognisableSets: number;
  };
  legacyContext: Record<
    string,
    {
      sets?: number;
      recognisableSets?: number;
      totalVariants?: number;
      variantWeightedSetVerdict?: {
        recognisableVariants: number;
        variants: number;
      };
      legacyComparison?: string;
    }
  >;
  buttonMatchedSlice: {
    sourceReferenceAudit: {
      "altitude.button": {
        package: string;
        version: string;
        status: string;
        missing: string[];
      };
      "fluent.button": {
        package: string;
        version: string;
        status: string;
        missing: string[];
      };
      gradingValidity: string;
      regenerationRequired: boolean;
    };
    matchedComparison: {
      status: string;
      adjudicationArtifact: string;
      cellsComparedPerPath: number;
      sampleComplete: boolean;
      setWeighted: unknown;
      cellWeighted: unknown;
      legacyUsabilityAssertionsExecuted: number;
      recipeUsabilityAssertionsExecuted: number;
      reason: string;
      comparisonFixturePin: unknown;
      legacyRecognisability: string;
      recipeRecognisability: string;
    };
    v2Comparison: {
      status: string;
      adjudicationArtifact: string;
      sourceReferences: number;
      legacyOutputs: number;
      correctedRecipeReactOutputs: number;
      recipeWebComponentParityOutputs: number;
      blindSpecimens: number;
      sampleMatrixHashUnchangedFromV1: boolean;
      sourceReferenceHashesUnchangedFromV1: boolean;
      legacyOutputHashesUnchangedFromV1: boolean;
      reactWebComponentPixelsEquivalent: boolean;
      setWeighted: { legacy: string; recipeReact: string };
      cellWeighted: { legacy: string; recipeReact: string };
      pairedOutcomes: {
        recipeBeatLegacy: number;
        tiedPass: number;
        tiedFail: number;
        legacyBeatRecipe: number;
      };
      immutableV1RecipeResult: string;
      buttonSuccess: boolean;
    };
    v4FinalAdjudication: {
      status: string;
      preGradeReceipt: string;
      grades: string;
      finalAdjudication: string;
      liveCanvasRecognisability: string;
      confidence: { high: number; medium: number; low: number };
      liveMint: {
        componentSets: number;
        variants: number;
        variables: number;
        bindings: number;
      };
      usability: {
        reflow: string;
        variantSwitching: string;
        tokenBinding: string;
        noFakeLayout: string;
        exactRestoration: string;
      };
      readback: {
        canonicalCycles: number;
        observedFacts: number;
        accountedFacts: number;
        silentFacts: number;
      };
      proofBoundary: string;
      buttonSuccess: boolean;
    };
    evidenceColumns: {
      offlineImplementation: string;
      pairedRecognisability: string;
      webComponentParity: string;
      liveFigma: string;
      usability: string;
      twoCycleLiveFixedPoint: string;
      overallSuccess: boolean;
    };
  };
  completion: {
    buttonSuccess: boolean;
    independentBlindGrade: string;
    liveFigma: string;
    fullUsability: string;
    fullFixedPoint: string;
    nextTask: string;
  };
}

const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;

const countFiles = (directory: string, pattern: RegExp): number =>
  readdirSync(directory, { withFileTypes: true }).reduce(
    (total, entry) =>
      total +
      (entry.isDirectory()
        ? countFiles(path.join(directory, entry.name), pattern)
        : pattern.test(entry.name)
          ? 1
          : 0),
    0,
  );

test("pivot comparison receipt is independently recomputed from census inputs", () => {
  const receipt = json<PivotComparisonReceipt>(
    "recipe/evidence/pivot-comparison.json",
  );
  const manifest = json<{ rows: ManifestRow[] }>(
    "parity/receipts/v1/census-manifest.json",
  );
  assert.equal(manifest.rows.length, receipt.corpus.contracts);
  assert.equal(
    countFiles("parity/receipts/v1/census", /^ref-.*\.png$/),
    receipt.corpus.referenceRenders,
  );
  let recognisableSets = 0;
  let unwalledNotRecognisableSets = 0;
  for (const row of manifest.rows) {
    const verdict = json<{
      recognisable: boolean | "unscored";
      walls?: string[];
    }>(`parity/receipts/v1/census/${row.library}/${row.id}/verdict.json`);
    if (verdict.recognisable === true) recognisableSets += 1;
    if (verdict.recognisable === false && (verdict.walls ?? []).length === 0) {
      unwalledNotRecognisableSets += 1;
    }
  }
  assert.equal(recognisableSets, receipt.corpus.recognisableSets);
  assert.equal(
    unwalledNotRecognisableSets,
    receipt.corpus.unwalledNotRecognisableSets,
  );
  const usableSets = manifest.rows
    .map((row) => judgeRow(row, USABLE_DIR))
    .filter(
      (row) =>
        row.observation !== null &&
        row.structural.length === 0 &&
        [row.reflow, row.variants, row.binding, row.fakeLayout].every(
          (assertion) => assertion.verdict !== "fail",
        ),
    ).length;
  assert.equal(usableSets, receipt.corpus.usableSets);

  const evals = json<{
    passed: number;
    total: number;
    results: Array<{ id: string; pass: boolean }>;
  }>("evals/results.json");
  assert.equal(receipt.legacyCi.status, "failed");
  assert.equal(receipt.legacyCi.passed, evals.passed);
  assert.equal(receipt.legacyCi.total, evals.total);
  assert.deepEqual(
    receipt.legacyCi.failing,
    evals.results.filter((result) => !result.pass).map((result) => result.id),
  );

  const archetypes: Record<string, string> = {
    button: "button",
    inputField: "input / field",
    selectCombobox: "select / combobox",
    tableDataGrid: "table / data-grid",
  };
  for (const [receiptKey, archetype] of Object.entries(archetypes)) {
    const rows = manifest.rows.filter((row) => row.archetype === archetype);
    let recognisableSets = 0;
    let recognisableVariants = 0;
    let totalVariants = 0;
    for (const row of rows) {
      assert.equal(
        typeof row.variantCount,
        "number",
        `${row.library}/${row.id} has no variant denominator`,
      );
      const variantCount = row.variantCount as number;
      const verdict = json<{ recognisable: boolean | "unscored" }>(
        `parity/receipts/v1/census/${row.library}/${row.id}/verdict.json`,
      );
      totalVariants += variantCount;
      if (verdict.recognisable === true) {
        recognisableSets += 1;
        recognisableVariants += variantCount;
      }
    }
    const pinned = receipt.legacyContext[receiptKey];
    assert.equal(pinned.sets, rows.length);
    assert.equal(pinned.recognisableSets, recognisableSets);
    assert.equal(pinned.totalVariants, totalVariants);
    assert.deepEqual(pinned.variantWeightedSetVerdict, {
      recognisableVariants,
      variants: totalVariants,
    });
  }

  assert.equal(
    manifest.rows.filter((row) => row.archetype.includes("calendar")).length,
    0,
  );
  assert.equal(
    receipt.legacyContext.calendar.legacyComparison,
    "undefined (0 contracts)",
  );
});

test("Button comparison receipt consumes the tamper-checked adjudication", () => {
  const receipt = json<PivotComparisonReceipt>(
    "recipe/evidence/pivot-comparison.json",
  );
  const adjudication = readCommittedButtonAdjudication();
  const comparison = receipt.buttonMatchedSlice.matchedComparison;
  assert.equal(comparison.status, "adjudicated-failed");
  assert.equal(
    comparison.adjudicationArtifact,
    "recipe/evidence/button-comparison/comparison-result.json",
  );
  assert.equal(comparison.cellsComparedPerPath, 12);
  assert.equal(comparison.sampleComplete, true);
  assert.deepEqual(comparison.setWeighted, {
    definition:
      "a source-library set passes only when all 6 sampled cells are recognisable",
    legacy: "0/2",
    recipeReact: "0/2",
  });
  assert.deepEqual(comparison.cellWeighted, {
    definition: "each exact source-library×variant×state cell has equal weight",
    legacy: "9/12",
    recipeReact: "0/12",
  });
  assert.equal(comparison.legacyUsabilityAssertionsExecuted, 4);
  assert.equal(comparison.recipeUsabilityAssertionsExecuted, 4);
  assert.equal(
    comparison.comparisonFixturePin,
    "recipe/evidence/button-comparison/receipt.json#comparisonPin",
  );
  assert.equal(comparison.legacyRecognisability, "9/12");
  assert.equal(comparison.recipeRecognisability, "0/12");
  assert.equal(
    receipt.completion.independentBlindGrade,
    "v1-v2-and-live-v4-complete",
  );
  assert.equal(receipt.completion.buttonSuccess, true);
  assert.equal(
    adjudication.aggregates.byImplementation.legacy.cellWeighted.numerator,
    9,
  );
  assert.equal(
    adjudication.aggregates.byImplementation.recipeReact.cellWeighted.numerator,
    0,
  );
  assert.equal(adjudication.verdict.recipeMatchedOrBeatLegacy, false);
  assert.equal(adjudication.verdict.buttonSuccess, false);
  const referenceAudit = receipt.buttonMatchedSlice.sourceReferenceAudit;
  const altitude = json<{
    harness: { package: string; version: string };
  }>("parity/receipts/v1/census/altitude/altitude.button/ref-render.json");
  const fluent = json<{
    harness: { package: string; version: string };
  }>("parity/receipts/v1/census/fluent/fluent.button/ref-render.json");
  assert.equal(
    referenceAudit["altitude.button"].package,
    altitude.harness.package,
  );
  assert.equal(
    referenceAudit["altitude.button"].version,
    altitude.harness.version,
  );
  assert.equal(referenceAudit["fluent.button"].package, fluent.harness.package);
  assert.equal(referenceAudit["fluent.button"].version, fluent.harness.version);
  assert.equal(
    referenceAudit["altitude.button"].status,
    "complete-paired-provenance",
  );
  assert.equal(
    referenceAudit["fluent.button"].status,
    "complete-paired-provenance",
  );
  assert.deepEqual(referenceAudit["altitude.button"].missing, []);
  assert.deepEqual(referenceAudit["fluent.button"].missing, []);
  assert.equal(referenceAudit.gradingValidity, "adjudicated-integrity-passed");
  assert.equal(referenceAudit.regenerationRequired, false);
  assert.match(comparison.reason, /12-cell/);
  assert.match(comparison.reason, /legacy scored 9\/12/);
});

test("Button evidence index consumes v2 without erasing immutable v1", () => {
  const receipt = json<PivotComparisonReceipt>(
    "recipe/evidence/pivot-comparison.json",
  );
  const result = readCommittedButtonV2Adjudication();
  const comparison = receipt.buttonMatchedSlice.v2Comparison;
  assert.equal(comparison.status, "adjudicated-passed-offline-recognisability");
  assert.equal(
    comparison.adjudicationArtifact,
    "recipe/evidence/button-comparison-v2/comparison-result.json",
  );
  assert.deepEqual(comparison.setWeighted, {
    legacy: "0/2",
    recipeReact: "2/2",
  });
  assert.deepEqual(comparison.cellWeighted, {
    legacy: "7/12",
    recipeReact: "12/12",
  });
  assert.deepEqual(comparison.pairedOutcomes, {
    recipeBeatLegacy: 5,
    tiedPass: 7,
    tiedFail: 0,
    legacyBeatRecipe: 0,
  });
  assert.equal(comparison.immutableV1RecipeResult, "0/12");
  assert.equal(
    result.comparisonHistory?.immutableV1.recipeReactCellWeighted.numerator,
    0,
  );
  assert.deepEqual(receipt.buttonMatchedSlice.evidenceColumns, {
    offlineImplementation: "passed",
    pairedRecognisability: "passed",
    webComponentParity: "passed-ungraded-recognisability",
    liveFigma: "passed",
    usability: "passed",
    twoCycleLiveFixedPoint: "passed",
    overallSuccess: true,
  });
  assert.equal(comparison.buttonSuccess, false);
  assert.equal(result.verdict.offlineRecognisabilityCriterionMet, true);
});

test("pivot preserves historical v4 claims while current status revokes overall PASS", () => {
  const receipt = json<PivotComparisonReceipt>(
    "recipe/evidence/pivot-comparison.json",
  );
  const current = json<Record<string, any>>(
    "recipe/evidence/status-index.json",
  );
  const final = receipt.buttonMatchedSlice.v4FinalAdjudication;
  assert.equal(final.status, "adjudicated-passed-complete-button");
  assert.equal(
    final.finalAdjudication,
    "recipe/evidence/button-live-pivot-v4/final-adjudication.json",
  );
  assert.equal(final.liveCanvasRecognisability, "12/12");
  assert.deepEqual(final.confidence, { high: 12, medium: 0, low: 0 });
  assert.deepEqual(final.liveMint, {
    componentSets: 2,
    variants: 288,
    variables: 57,
    bindings: 4296,
  });
  assert.deepEqual(final.readback, {
    canonicalCycles: 2,
    observedFacts: 13248,
    accountedFacts: 13248,
    silentFacts: 0,
  });
  assert.match(final.proofBoundary, /one Button archetype/);
  assert.match(final.proofBoundary, /no Input\/Field/);
  assert.equal(final.buttonSuccess, true);
  assert.equal(current.button.overallSuccess, false);
  assert.equal(current.button.status, "pending");
  assert.equal(receipt.completion.liveFigma, "v4-complete-artifacts-retained");
  assert.equal(receipt.completion.fullUsability, "passed-both-sources");
  assert.equal(receipt.completion.fullFixedPoint, "passed-two-live-cycles");
  assert.match(receipt.completion.nextTask, /Input\/Field blind grade/);
});
