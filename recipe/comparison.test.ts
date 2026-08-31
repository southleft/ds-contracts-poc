import assert from "node:assert/strict";
import test from "node:test";

import {
  scoreBlindComparison,
  scoreMatchedComparison,
  type BlindGradeBatch,
  type ComparisonSide,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
} from "./comparison.js";

const completeSide = (): ComparisonSide => ({
  sets: [true, false],
  cells: [true, true, false],
  axesCovered: ["Variant", "State"],
  requiredAxes: ["Variant", "State"],
  statesCovered: ["default", "hover", "disabled"],
  requiredStates: ["default", "hover", "disabled"],
  rolesCovered: ["root", "label"],
  requiredRoles: ["root", "label"],
  sampleComplete: true,
  usabilityAssertions: {
    reflow: true,
    variantSwitching: true,
    tokenBinding: true,
    noFakeLayout: true,
  },
});

test("matched comparison reports separate set and cell weighted scores", () => {
  const scores = scoreMatchedComparison({
    legacy: completeSide(),
    recipe: {
      ...completeSide(),
      sets: [true, true],
      cells: [true, true, true],
    },
  });
  assert.deepEqual(scores.legacy.setWeighted, {
    numerator: 1,
    denominator: 2,
    ratio: 0.5,
  });
  assert.deepEqual(scores.recipe.cellWeighted, {
    numerator: 3,
    denominator: 3,
    ratio: 1,
  });
  assert.equal(scores.cellsComparedPerPath, 3);
});

test("anti-flattery refuses zero axes, cells, missing roles/states and incomplete samples", () => {
  const assertRed = (
    mutate: (side: ComparisonSide) => void,
    expected: RegExp,
  ): void => {
    const legacy = completeSide();
    mutate(legacy);
    assert.throws(
      () => scoreMatchedComparison({ legacy, recipe: completeSide() }),
      expected,
    );
  };

  assertRed((side) => {
    side.axesCovered = [];
  }, /zero axes/);
  assertRed((side) => {
    side.cells = [];
  }, /cell denominators differ|denominator is zero/);
  assertRed((side) => {
    side.statesCovered = ["default"];
  }, /misses states hover, disabled/);
  assertRed((side) => {
    side.rolesCovered = ["root"];
  }, /misses roles label/);
  assertRed((side) => {
    side.sampleComplete = false;
  }, /sample coverage is incomplete/);
});

const protocol = {
  version: "blind-paired-v1",
  rubricHash: "rubric-sha256",
  environmentHash: "environment-sha256",
  crop: "content-box+8px",
  scale: 2,
  browser: "chromium-149",
  fontsHash: "fonts-sha256",
  passThreshold: "recognisable=true under identical rubric",
};

const pin: PinnedComparisonFixture = {
  sourceCommit: "source-commit",
  fixtureHash: "fixture-sha256",
  sampleMatrixHash: "matrix-sha256",
  cellKeys: ["default", "hover"],
  referenceHashes: {
    default: "reference-default",
    hover: "reference-hover",
  },
  referenceProvenance: Object.fromEntries(
    ["default", "hover"].map((cellKey) => [
      cellKey,
      {
        sourceKind: "external-library-package" as const,
        externalOwner: "Example Library maintainers",
        sourceId: "example-library",
        sourceVersionOrRevision: "1.2.3",
        sourceHash: "package-tarball-sha256",
        packageLockHash: "package-lock-sha256",
        packageIntegrity: "sha512-registry-integrity",
        componentOrNodeId: "Button",
        sourceAdapterHash: "adapter-sha256",
        renderHarnessHash: "harness-sha256",
        captureInputHash: `capture-input-${cellKey}`,
        browser: protocol.browser,
        browserRevision: "1228",
        browserExecutableHash: "browser-executable-sha256",
        viewport: { width: 600, height: 800 },
        deviceScaleFactor: 2,
        fontsHash: protocol.fontsHash,
        environmentHash: protocol.environmentHash,
        cellKey,
        screenshotHash: `reference-${cellKey}`,
        captureCommand: `capture-real-library --cell ${cellKey}`,
        producedBy: "independent-real-library-harness",
        independentHarness: true as const,
      },
    ]),
  ),
  protocol,
};

const output = (path: "legacy" | "recipe"): ComparisonOutputManifest => ({
  fixtureHash: pin.fixtureHash,
  sampleMatrixHash: pin.sampleMatrixHash,
  cells: pin.cellKeys.map((cellKey) => ({
    cellKey,
    outputHash: `${path}-${cellKey}`,
    referenceHash: pin.referenceHashes[cellKey]!,
    comparedPixels: 4096,
  })),
});

const blindBatch = (): BlindGradeBatch => ({
  authoredByRole: "independent-grader",
  graderIdentity: "blind-panel-1",
  builderIdentity: "recipe-builder",
  protocol,
  randomizedBatchHash: "random-order-sha256",
  grades: [
    {
      cellKey: "default",
      outputHash: "legacy-default",
      referenceHash: "reference-default",
      anonymousLabel: "specimen-z",
      recognisable: true,
      defects: [],
      confidence: "high",
    },
    {
      cellKey: "hover",
      outputHash: "legacy-hover",
      referenceHash: "reference-hover",
      anonymousLabel: "specimen-a",
      recognisable: false,
      defects: ["missing hover ink"],
      confidence: "high",
    },
    {
      cellKey: "default",
      outputHash: "recipe-default",
      referenceHash: "reference-default",
      anonymousLabel: "specimen-q",
      recognisable: true,
      defects: [],
      confidence: "high",
    },
    {
      cellKey: "hover",
      outputHash: "recipe-hover",
      referenceHash: "reference-hover",
      anonymousLabel: "specimen-b",
      recognisable: true,
      defects: [],
      confidence: "high",
    },
  ],
});

test("blind comparison ignores swapped anonymous labels", () => {
  const baseline = scoreBlindComparison(
    pin,
    output("legacy"),
    output("recipe"),
    blindBatch(),
  );
  const swapped = blindBatch();
  swapped.grades.reverse();
  for (const [index, grade] of swapped.grades.entries()) {
    grade.anonymousLabel = `swapped-${index}`;
  }
  assert.deepEqual(
    scoreBlindComparison(pin, output("legacy"), output("recipe"), swapped),
    baseline,
  );
});

test("blind comparison refuses missing hashes, references and one-sided grades", () => {
  const missingReference = structuredClone(pin);
  delete missingReference.referenceHashes.hover;
  assert.throws(
    () =>
      scoreBlindComparison(
        missingReference,
        output("legacy"),
        output("recipe"),
        blindBatch(),
      ),
    /reference hash is missing or differs/,
  );

  const missingOutputHash = output("legacy");
  missingOutputHash.cells[0]!.outputHash = "";
  assert.throws(
    () =>
      scoreBlindComparison(
        pin,
        missingOutputHash,
        output("recipe"),
        blindBatch(),
      ),
    /output hash is missing/,
  );

  const missingCell = output("legacy");
  missingCell.cells.pop();
  assert.throws(
    () =>
      scoreBlindComparison(pin, missingCell, output("recipe"), blindBatch()),
    /complete pinned sample matrix/,
  );

  const unmatchedCell = output("legacy");
  unmatchedCell.cells[1]!.cellKey = "unmatched";
  assert.throws(
    () =>
      scoreBlindComparison(pin, unmatchedCell, output("recipe"), blindBatch()),
    /complete pinned sample matrix/,
  );

  const missingProvenance = structuredClone(pin);
  missingProvenance.referenceProvenance.default!.captureInputHash = "";
  assert.throws(
    () =>
      scoreBlindComparison(
        missingProvenance,
        output("legacy"),
        output("recipe"),
        blindBatch(),
      ),
    /SOURCE-REFERENCE-PROVENANCE/,
  );

  const oneSided = blindBatch();
  oneSided.grades = oneSided.grades.filter(
    (grade) => !grade.outputHash.startsWith("recipe-"),
  );
  assert.throws(
    () =>
      scoreBlindComparison(pin, output("legacy"), output("recipe"), oneSided),
    /recipe\/default has no blind grade/,
  );

  const zeroPixels = output("legacy");
  zeroPixels.cells[0]!.comparedPixels = 0;
  assert.throws(
    () => scoreBlindComparison(pin, zeroPixels, output("recipe"), blindBatch()),
    /ZERO-COMPARED-PIXELS/,
  );

  const duplicateCell = output("legacy");
  duplicateCell.cells[1]!.cellKey = "default";
  assert.throws(
    () =>
      scoreBlindComparison(pin, duplicateCell, output("recipe"), blindBatch()),
    /duplicate cell/,
  );
});

test("source reference guard refuses generated substitutions without misclassifying independently equal pixels", () => {
  const recipeReference = structuredClone(pin);
  recipeReference.referenceProvenance.default!.producedBy =
    "recipe/output/button.ts";
  assert.throws(
    () =>
      scoreBlindComparison(
        recipeReference,
        output("legacy"),
        output("recipe"),
        blindBatch(),
      ),
    /SELF-REFERENCE from recipe\/output\/button\.ts/,
  );

  const legacyEmitHtml = structuredClone(pin);
  legacyEmitHtml.referenceProvenance.default!.producedBy =
    "legacy emit-html generated contract";
  assert.throws(
    () =>
      scoreBlindComparison(
        legacyEmitHtml,
        output("legacy"),
        output("recipe"),
        blindBatch(),
      ),
    /SELF-REFERENCE from legacy emit-html generated contract/,
  );

  const copiedBytes = structuredClone(pin);
  copiedBytes.referenceHashes.default = "recipe-default";
  copiedBytes.referenceProvenance.default!.screenshotHash = "recipe-default";
  const copiedRecipeOutput = output("recipe");
  copiedRecipeOutput.cells[0]!.referenceHash = "recipe-default";
  const copiedLegacyOutput = output("legacy");
  copiedLegacyOutput.cells[0]!.referenceHash = "recipe-default";
  const copiedBatch = blindBatch();
  for (const grade of copiedBatch.grades.filter(
    (candidate) => candidate.cellKey === "default",
  )) {
    grade.referenceHash = "recipe-default";
  }
  assert.doesNotThrow(() =>
    scoreBlindComparison(
      copiedBytes,
      copiedLegacyOutput,
      copiedRecipeOutput,
      copiedBatch,
    ),
  );
});
