export interface ComparisonSide {
  sets: boolean[];
  cells: boolean[];
  axesCovered: string[];
  requiredAxes: string[];
  statesCovered: string[];
  requiredStates: string[];
  rolesCovered: string[];
  requiredRoles: string[];
  sampleComplete: boolean;
  usabilityAssertions: Record<
    "reflow" | "variantSwitching" | "tokenBinding" | "noFakeLayout",
    boolean
  >;
}

export interface MatchedComparison {
  legacy: ComparisonSide;
  recipe: ComparisonSide;
}

export interface WeightedScore {
  numerator: number;
  denominator: number;
  ratio: number;
}

export interface ComparableScores {
  legacy: {
    setWeighted: WeightedScore;
    cellWeighted: WeightedScore;
  };
  recipe: {
    setWeighted: WeightedScore;
    cellWeighted: WeightedScore;
  };
  cellsComparedPerPath: number;
}

export interface BlindGradeProtocol {
  version: string;
  rubricHash: string;
  environmentHash: string;
  crop: string;
  scale: number;
  browser: string;
  fontsHash: string;
  passThreshold: string;
}

export interface PinnedComparisonFixture {
  sourceCommit: string;
  fixtureHash: string;
  sampleMatrixHash: string;
  cellKeys: string[];
  referenceHashes: Record<string, string>;
  referenceProvenance: Record<string, SourceReferenceProvenance>;
  protocol: BlindGradeProtocol;
}

export interface SourceReferenceProvenance {
  sourceKind: "external-library-package" | "figma-source-node";
  externalOwner: string;
  sourceId: string;
  sourceVersionOrRevision: string;
  sourceHash: string;
  packageLockHash: string;
  packageIntegrity: string;
  componentOrNodeId: string;
  sourceAdapterHash: string;
  renderHarnessHash: string;
  captureInputHash: string;
  browser: string;
  browserRevision: string;
  browserExecutableHash: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  fontsHash: string;
  environmentHash: string;
  cellKey: string;
  screenshotHash: string;
  captureCommand: string;
  producedBy: string;
  independentHarness: true;
}

export interface ComparisonOutputManifest {
  fixtureHash: string;
  sampleMatrixHash: string;
  cells: Array<{
    cellKey: string;
    outputHash: string;
    referenceHash: string;
    comparedPixels: number;
  }>;
}

export interface BlindCellGrade {
  cellKey: string;
  outputHash: string;
  referenceHash: string;
  anonymousLabel: string;
  recognisable: boolean;
  defects: string[];
  confidence: "low" | "medium" | "high";
}

export interface BlindGradeBatch {
  authoredByRole: "independent-grader";
  graderIdentity: string;
  builderIdentity: string;
  protocol: BlindGradeProtocol;
  randomizedBatchHash: string;
  grades: BlindCellGrade[];
}

export interface BlindComparisonScores {
  legacy: WeightedScore;
  recipe: WeightedScore;
  cellsComparedPerPath: number;
}

const weighted = (values: boolean[], noun: string): WeightedScore => {
  if (values.length === 0) {
    throw new Error(`NOT-COMPARABLE: ${noun} denominator is zero`);
  }
  const numerator = values.filter(Boolean).length;
  return {
    numerator,
    denominator: values.length,
    ratio: numerator / values.length,
  };
};

const missing = (required: string[], covered: string[]): string[] => {
  const actual = new Set(covered);
  return required.filter((value) => !actual.has(value));
};

const assertSide = (name: "legacy" | "recipe", side: ComparisonSide): void => {
  if (side.requiredAxes.length > 0 && side.axesCovered.length === 0) {
    throw new Error(
      `NOT-COMPARABLE: ${name} has zero axes while the recipe declares axes`,
    );
  }
  const missingAxes = missing(side.requiredAxes, side.axesCovered);
  if (missingAxes.length > 0) {
    throw new Error(
      `NOT-COMPARABLE: ${name} misses axes ${missingAxes.join(", ")}`,
    );
  }
  const missingStates = missing(side.requiredStates, side.statesCovered);
  if (missingStates.length > 0) {
    throw new Error(
      `NOT-COMPARABLE: ${name} misses states ${missingStates.join(", ")}`,
    );
  }
  const missingRoles = missing(side.requiredRoles, side.rolesCovered);
  if (missingRoles.length > 0) {
    throw new Error(
      `NOT-COMPARABLE: ${name} misses roles ${missingRoles.join(", ")}`,
    );
  }
  if (!side.sampleComplete) {
    throw new Error(`NOT-COMPARABLE: ${name} sample coverage is incomplete`);
  }
  const usabilityCount = Object.keys(side.usabilityAssertions).length;
  if (usabilityCount !== 4) {
    throw new Error(
      `NOT-COMPARABLE: ${name} executed ${usabilityCount}/4 usability assertions`,
    );
  }
};

/**
 * No scalar "outperform legacy" score exists. This function only scores an
 * already-matched slice and refuses denominator or coverage asymmetry.
 */
export function scoreMatchedComparison(
  comparison: MatchedComparison,
): ComparableScores {
  assertSide("legacy", comparison.legacy);
  assertSide("recipe", comparison.recipe);
  if (comparison.legacy.cells.length !== comparison.recipe.cells.length) {
    throw new Error(
      `NOT-COMPARABLE: cell denominators differ (${comparison.legacy.cells.length} legacy vs ${comparison.recipe.cells.length} recipe)`,
    );
  }
  if (comparison.legacy.sets.length !== comparison.recipe.sets.length) {
    throw new Error(
      `NOT-COMPARABLE: set denominators differ (${comparison.legacy.sets.length} legacy vs ${comparison.recipe.sets.length} recipe)`,
    );
  }
  return {
    legacy: {
      setWeighted: weighted(comparison.legacy.sets, "legacy sets"),
      cellWeighted: weighted(comparison.legacy.cells, "legacy cells"),
    },
    recipe: {
      setWeighted: weighted(comparison.recipe.sets, "recipe sets"),
      cellWeighted: weighted(comparison.recipe.cells, "recipe cells"),
    },
    cellsComparedPerPath: comparison.legacy.cells.length,
  };
}

const stableProtocol = (protocol: BlindGradeProtocol): string =>
  JSON.stringify(protocol);

/**
 * The evidence-generation gate. It validates pins, source provenance,
 * denominator parity, copied-reference protection, and non-zero pixel
 * cardinality without authoring recognisability verdicts.
 */
export function validatePinnedComparisonEvidence(
  pin: PinnedComparisonFixture,
  legacy: ComparisonOutputManifest,
  recipe: ComparisonOutputManifest,
): void {
  if (
    !pin.sourceCommit ||
    !pin.fixtureHash ||
    !pin.sampleMatrixHash ||
    pin.cellKeys.length === 0
  ) {
    throw new Error(
      "NOT-COMPARABLE: source commit, fixture hash, sample matrix hash and non-zero cells must be pinned before generation",
    );
  }
  if (new Set(pin.cellKeys).size !== pin.cellKeys.length) {
    throw new Error(
      "NOT-COMPARABLE: duplicate cell key in the pinned sample matrix",
    );
  }
  const expectedCells = new Set(pin.cellKeys);
  const validateOutput = (
    name: "legacy" | "recipe",
    output: ComparisonOutputManifest,
  ): void => {
    if (
      output.fixtureHash !== pin.fixtureHash ||
      output.sampleMatrixHash !== pin.sampleMatrixHash
    ) {
      throw new Error(
        `NOT-COMPARABLE: ${name} fixture or sample matrix hash differs from the pre-generation pin`,
      );
    }
    const outputCellKeys = output.cells.map((cell) => cell.cellKey);
    if (new Set(outputCellKeys).size !== outputCellKeys.length) {
      throw new Error(
        `NOT-COMPARABLE: ${name} output contains a duplicate cell`,
      );
    }
    if (
      output.cells.length !== expectedCells.size ||
      output.cells.some((cell) => !expectedCells.has(cell.cellKey))
    ) {
      throw new Error(
        `NOT-COMPARABLE: ${name} output does not cover the complete pinned sample matrix`,
      );
    }
    for (const cell of output.cells) {
      const referenceHash = pin.referenceHashes[cell.cellKey];
      if (!referenceHash || cell.referenceHash !== referenceHash) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} reference hash is missing or differs`,
        );
      }
      const provenance = pin.referenceProvenance[cell.cellKey];
      if (
        !provenance ||
        provenance.cellKey !== cell.cellKey ||
        provenance.screenshotHash !== referenceHash ||
        !provenance.externalOwner ||
        !provenance.sourceId ||
        !provenance.sourceVersionOrRevision ||
        !provenance.sourceHash ||
        !provenance.packageLockHash ||
        !provenance.packageIntegrity ||
        !provenance.componentOrNodeId ||
        !provenance.sourceAdapterHash ||
        !provenance.renderHarnessHash ||
        !provenance.captureInputHash ||
        !provenance.browser ||
        !provenance.browserRevision ||
        !provenance.browserExecutableHash ||
        !provenance.viewport ||
        provenance.viewport.width <= 0 ||
        provenance.viewport.height <= 0 ||
        provenance.deviceScaleFactor <= 0 ||
        !provenance.fontsHash ||
        !provenance.environmentHash ||
        !provenance.captureCommand ||
        provenance.independentHarness !== true ||
        provenance.browser !== pin.protocol.browser ||
        provenance.fontsHash !== pin.protocol.fontsHash ||
        provenance.environmentHash !== pin.protocol.environmentHash
      ) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} SOURCE-REFERENCE-PROVENANCE is missing or incomplete`,
        );
      }
      if (
        /recipe|generated[- ]contract|emit-html|pivot[- ]output|legacy[- ]output|recipe[- ]output/i.test(
          provenance.producedBy,
        )
      ) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} SELF-REFERENCE from ${provenance.producedBy}; reference must be the original external source render`,
        );
      }
      if (!cell.outputHash) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} output hash is missing`,
        );
      }
      if (
        !Number.isSafeInteger(cell.comparedPixels) ||
        cell.comparedPixels <= 0
      ) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} ZERO-COMPARED-PIXELS`,
        );
      }
    }
  };
  validateOutput("legacy", legacy);
  validateOutput("recipe", recipe);
}

/**
 * Resolves blind grades by immutable output hash, never by the randomized
 * labels shown to the grader. Builder-authored or one-sided grades refuse.
 */
export function scoreBlindComparison(
  pin: PinnedComparisonFixture,
  legacy: ComparisonOutputManifest,
  recipe: ComparisonOutputManifest,
  batch: BlindGradeBatch,
): BlindComparisonScores {
  validatePinnedComparisonEvidence(pin, legacy, recipe);
  if (
    batch.authoredByRole !== "independent-grader" ||
    !batch.graderIdentity ||
    batch.graderIdentity === batch.builderIdentity
  ) {
    throw new Error(
      "NOT-COMPARABLE: final recognisability grades require an independent grader",
    );
  }
  if (
    stableProtocol(pin.protocol) !== stableProtocol(batch.protocol) ||
    !batch.randomizedBatchHash
  ) {
    throw new Error(
      "NOT-COMPARABLE: blind grading protocol or randomized batch differs from the pin",
    );
  }

  const gradeIndex = new Map<string, BlindCellGrade>();
  for (const grade of batch.grades) {
    const key = `${grade.cellKey}\0${grade.outputHash}`;
    if (gradeIndex.has(key)) {
      throw new Error(
        `NOT-COMPARABLE: duplicate blind grade for ${grade.cellKey}`,
      );
    }
    gradeIndex.set(key, grade);
  }
  const gradesFor = (
    name: "legacy" | "recipe",
    output: ComparisonOutputManifest,
  ): boolean[] =>
    output.cells.map((cell) => {
      const grade = gradeIndex.get(`${cell.cellKey}\0${cell.outputHash}`);
      if (!grade) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} has no blind grade`,
        );
      }
      if (
        grade.referenceHash !== cell.referenceHash ||
        (grade.defects.length === 0 && !grade.recognisable)
      ) {
        throw new Error(
          `NOT-COMPARABLE: ${name}/${cell.cellKey} grade reference differs or a failure has no defect`,
        );
      }
      return grade.recognisable;
    });

  const legacyGrades = gradesFor("legacy", legacy);
  const recipeGrades = gradesFor("recipe", recipe);
  return {
    legacy: weighted(legacyGrades, "legacy blind-graded cells"),
    recipe: weighted(recipeGrades, "recipe blind-graded cells"),
    cellsComparedPerPath: pin.cellKeys.length,
  };
}
