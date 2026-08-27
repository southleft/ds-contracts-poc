/**
 * Carried Input live v12 host verifier. Uses scene-readback-v27 so live
 * extract normalize/account recovers text roles from the first name
 * segment when later segments contain font-provenance=.
 */
import { createHash } from "node:crypto";

import type { RecipeEnvelope } from "./envelope.js";
import { hashRecipeEnvelope } from "./hash.js";
import { canonicalJson } from "./normalize.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneNodeSnapshot,
} from "./scene-readback-v27.js";

export const INPUT_LIVE_V3_VERIFIER_VERSION = "input-live-v3-verifier-v1";
export const INPUT_LIVE_V3_REQUIRED_GATE_IDS = [
  "expected-plan-multiset-occurrences-preserved",
  "zero-missing-extra-mismatched-duplicate-collapsed-unobserved-facts",
  "actual-scene-properties-only",
  "plugin-data-source-ir-forbidden",
  "silent-count-derived",
  "two-cycle-scene-derived-fixed-point",
  "controlled-uncontrolled-behavior-and-stable-web-component-input",
  "css-and-output-path-security",
  "actual-adornment-content-payload-and-accessibility",
  "font-resolution-provenance-and-named-refusals",
  "typed-deterministic-writer-and-collision-refusals",
] as const;

export interface InputLiveV3Thresholds {
  dimensionError: { absolutePixels: number; relative: number };
  spacingError: { absolutePixels: number; relative: number };
  roleScaleError: { relative: number };
  clipping: { maximumVisibleAreaLoss: number };
  overlap: { maximumPixels: number };
}

export interface InputLiveV3MaterialRegression {
  aggregateRelativeIncrease: number;
  catastrophicCellRule: string;
}

export interface InputLiveV3CellValidation {
  cellKey: string;
  source: string;
  state: string;
  adornment: string;
  rolesExact: boolean;
  textExact: boolean;
  adornmentPayloadExact: boolean;
  fontExact: boolean;
  fillExact: boolean;
  geometryExact: boolean;
  stateSemanticsExact: boolean;
  labelSemanticsExact: boolean;
  helperSemanticsExact: boolean;
  bindingTypesCompatible: boolean;
  noFakeLayout: boolean;
  dimension: { absolutePixels: number; relative: number };
  spacing: { absolutePixels: number; relative: number };
  roleScaleRelativeError: number;
  visibleAreaLoss: number;
  overlapPixels: number;
}

export interface InputLiveV3SourceProbe {
  adapterIdentity: string;
  variants: number;
  visitedVariants: number;
  switchingRestored: boolean;
  textPropertiesRestored: boolean;
  reflowPassed: boolean;
  contentFillPassed: boolean;
  bindingCompatibilityPassed: boolean;
  noFakeLayoutPassed: boolean;
  exactSceneRestoration: boolean;
}

export interface InputLiveV3SceneProof {
  adapterIdentity: string;
  accounting: SceneComparison;
  fixedPoint: InputLiveV3FixedPoint;
}

export interface InputLiveV3VisualRow {
  cellKey: string;
  source: string;
  state: string;
  adornment: string;
  referenceSha256: string;
  liveSha256: string;
  geometry: { legacy: number; recipe: number };
  perceptual: { legacy: number; recipe: number };
  pixelInk: { legacy: number; recipe: number };
}

export interface InputLiveV3HardGateInput {
  thresholds: InputLiveV3Thresholds;
  materialRegression: InputLiveV3MaterialRegression;
  sourceProbes: InputLiveV3SourceProbe[];
  cells: InputLiveV3CellValidation[];
  sceneProofs: InputLiveV3SceneProof[];
  visualRows: InputLiveV3VisualRow[];
  safety: {
    exactAuthorizedFile: boolean;
    pageScopedOwnership: boolean;
    sourceReferencesUnchanged: boolean;
    historicalEvidenceUnchanged: boolean;
    repositoryPathsSafe: boolean;
    cleanupComplete: boolean;
    retentionDeclared: boolean;
  };
  humanSignoff: {
    status: "pending" | "passed" | "failed";
    reviewer?: string;
  };
}

export interface InputLiveV3HardGateReport {
  verifierVersion: typeof INPUT_LIVE_V3_VERIFIER_VERSION;
  technicalPassed: boolean;
  overallInputSuccess: boolean;
  humanSignoffPending: boolean;
  failures: string[];
  counts: {
    sources: number;
    variants: number;
    switchedVariants: number;
    cells: number;
    objectiveCells: number;
    sceneFacts: number;
    matchedSceneFacts: number;
    silentSceneFacts: number;
  };
  objective: {
    wins: Record<"geometry" | "perceptual" | "pixelInk", number>;
    losses: Record<"geometry" | "perceptual" | "pixelInk", number>;
    means: Record<
      "geometry" | "perceptual" | "pixelInk",
      { legacy: number; recipe: number }
    >;
    stratumRegressions: string[];
    catastrophicCells: string[];
  };
}

export interface InputLiveV3FixedPoint {
  stable: boolean;
  sourceIrRead: false;
  cycle1SceneIrSha256: string;
  cycle2SceneIrSha256: string;
  cycle1CompiledIrSha256: string;
  cycle2CompiledIrSha256: string;
  cycle1Comparison: SceneComparison;
  cycle2Comparison: SceneComparison;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const finiteUnit = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const failsCompoundTolerance = (
  error: { absolutePixels: number; relative: number },
  threshold: { absolutePixels: number; relative: number },
): boolean =>
  error.absolutePixels > threshold.absolutePixels &&
  error.relative > threshold.relative;

const validateThresholds = (thresholds: InputLiveV3Thresholds): string[] => {
  const failures: string[] = [];
  if (
    thresholds.dimensionError.absolutePixels !== 4 ||
    thresholds.dimensionError.relative !== 0.08
  )
    failures.push("locked dimension threshold drift");
  if (
    thresholds.spacingError.absolutePixels !== 4 ||
    thresholds.spacingError.relative !== 0.2
  )
    failures.push("locked spacing threshold drift");
  if (thresholds.roleScaleError.relative !== 0.1)
    failures.push("locked role-scale threshold drift");
  if (thresholds.clipping.maximumVisibleAreaLoss !== 0.05)
    failures.push("locked clipping threshold drift");
  if (thresholds.overlap.maximumPixels !== 2)
    failures.push("locked overlap threshold drift");
  return failures;
};

const stratumKeys = (row: InputLiveV3VisualRow): Array<[string, string]> => [
  ["source", row.source],
  ["state", row.state],
  ["adornment", row.adornment],
];

export function verifyInputLiveV3HardGates(
  input: InputLiveV3HardGateInput,
): InputLiveV3HardGateReport {
  const failures = validateThresholds(input.thresholds);
  if (
    input.materialRegression.aggregateRelativeIncrease !== 0.1 ||
    input.materialRegression.catastrophicCellRule !==
      "recipe error exceeds legacy error * 1.5 + 0.02"
  ) {
    failures.push("locked material-regression rule drift");
  }

  if (
    input.sourceProbes.length !== 2 ||
    new Set(input.sourceProbes.map((source) => source.adapterIdentity)).size !==
      2
  ) {
    failures.push("expected exactly two distinct source probes");
  }
  for (const source of input.sourceProbes) {
    if (source.variants !== 128)
      failures.push(
        `${source.adapterIdentity}: variants ${source.variants}/128`,
      );
    if (source.visitedVariants !== 128)
      failures.push(
        `${source.adapterIdentity}: switching ${source.visitedVariants}/128`,
      );
    for (const [field, value] of Object.entries(source)) {
      if (
        typeof value === "boolean" &&
        value !== true &&
        field !== "adapterIdentity"
      )
        failures.push(`${source.adapterIdentity}: ${field}`);
    }
  }

  if (
    input.cells.length !== 256 ||
    new Set(input.cells.map((cell) => cell.cellKey)).size !== 256
  ) {
    failures.push("live cell denominator must be 256 unique cells");
  }
  const exactFields: Array<keyof InputLiveV3CellValidation> = [
    "rolesExact",
    "textExact",
    "adornmentPayloadExact",
    "fontExact",
    "fillExact",
    "geometryExact",
    "stateSemanticsExact",
    "labelSemanticsExact",
    "helperSemanticsExact",
    "bindingTypesCompatible",
    "noFakeLayout",
  ];
  for (const cell of input.cells) {
    for (const field of exactFields)
      if (cell[field] !== true) failures.push(`${cell.cellKey}: ${field}`);
    if (failsCompoundTolerance(cell.dimension, input.thresholds.dimensionError))
      failures.push(`${cell.cellKey}: dimension tolerance`);
    if (failsCompoundTolerance(cell.spacing, input.thresholds.spacingError))
      failures.push(`${cell.cellKey}: spacing tolerance`);
    if (cell.roleScaleRelativeError > input.thresholds.roleScaleError.relative)
      failures.push(`${cell.cellKey}: role-scale tolerance`);
    if (cell.visibleAreaLoss > input.thresholds.clipping.maximumVisibleAreaLoss)
      failures.push(`${cell.cellKey}: clipping tolerance`);
    if (cell.overlapPixels > input.thresholds.overlap.maximumPixels)
      failures.push(`${cell.cellKey}: overlap tolerance`);
  }

  if (
    input.sceneProofs.length !== 2 ||
    new Set(input.sceneProofs.map((proof) => proof.adapterIdentity)).size !== 2
  ) {
    failures.push("expected exactly two distinct scene proofs");
  }
  for (const proof of input.sceneProofs) {
    const accounting = proof.accounting;
    if (
      !accounting.ok ||
      accounting.denominator <= 0 ||
      accounting.missing.length > 0 ||
      accounting.extra.length > 0 ||
      accounting.mismatched.length > 0 ||
      accounting.duplicateCollapsed.length > 0 ||
      accounting.unobserved.length > 0 ||
      accounting.silent !== 0
    ) {
      failures.push(`${proof.adapterIdentity}: scene multiset accounting`);
    }
    if (!proof.fixedPoint.stable || proof.fixedPoint.sourceIrRead !== false)
      failures.push(`${proof.adapterIdentity}: scene-derived fixed point`);
  }

  if (
    input.visualRows.length !== 128 ||
    new Set(input.visualRows.map((row) => row.cellKey)).size !== 128
  ) {
    failures.push("objective denominator must be 128 unique cells");
  }
  const metrics = ["geometry", "perceptual", "pixelInk"] as const;
  const wins = { geometry: 0, perceptual: 0, pixelInk: 0 };
  const losses = { geometry: 0, perceptual: 0, pixelInk: 0 };
  const means = {
    geometry: { legacy: Number.NaN, recipe: Number.NaN },
    perceptual: { legacy: Number.NaN, recipe: Number.NaN },
    pixelInk: { legacy: Number.NaN, recipe: Number.NaN },
  };
  for (const metric of metrics) {
    const legacy = input.visualRows.map((row) => row[metric].legacy);
    const recipe = input.visualRows.map((row) => row[metric].recipe);
    if (
      legacy.some((value) => !finiteUnit(value)) ||
      recipe.some((value) => !finiteUnit(value))
    ) {
      failures.push(`${metric}: non-finite or out-of-range metric`);
    }
    wins[metric] = input.visualRows.filter(
      (row) => row[metric].recipe < row[metric].legacy,
    ).length;
    losses[metric] = input.visualRows.filter(
      (row) => row[metric].recipe > row[metric].legacy,
    ).length;
    means[metric] = {
      legacy: legacy.length === 0 ? Number.NaN : mean(legacy),
      recipe: recipe.length === 0 ? Number.NaN : mean(recipe),
    };
    if (wins[metric] <= losses[metric])
      failures.push(`${metric}: recipe wins do not exceed legacy losses`);
    if (!(means[metric].recipe < means[metric].legacy))
      failures.push(`${metric}: aggregate recipe error did not improve`);
  }

  const stratumRegressions: string[] = [];
  const strata = new Map<string, InputLiveV3VisualRow[]>();
  for (const row of input.visualRows) {
    for (const [kind, value] of stratumKeys(row)) {
      const key = `${kind}:${value}`;
      strata.set(key, [...(strata.get(key) ?? []), row]);
    }
  }
  for (const [stratum, rows] of strata) {
    for (const metric of metrics) {
      const legacy = mean(rows.map((row) => row[metric].legacy));
      const recipe = mean(rows.map((row) => row[metric].recipe));
      if (
        recipe >
        legacy * (1 + input.materialRegression.aggregateRelativeIncrease)
      ) {
        stratumRegressions.push(`${stratum}:${metric}`);
      }
    }
  }
  if (stratumRegressions.length > 0)
    failures.push(
      `material stratum regression: ${stratumRegressions.join(",")}`,
    );

  const catastrophicCells = input.visualRows.flatMap((row) =>
    metrics.some(
      (metric) => row[metric].recipe > row[metric].legacy * 1.5 + 0.02,
    )
      ? [row.cellKey]
      : [],
  );
  if (catastrophicCells.length > 0)
    failures.push(`catastrophic visual cells: ${catastrophicCells.join(",")}`);

  for (const [field, value] of Object.entries(input.safety))
    if (value !== true) failures.push(`safety: ${field}`);
  if (
    input.humanSignoff.status === "passed" &&
    !input.humanSignoff.reviewer?.trim()
  )
    failures.push("human signoff has no attributable reviewer");

  const technicalPassed = failures.length === 0;
  const humanSignoffPending = input.humanSignoff.status === "pending";
  return {
    verifierVersion: INPUT_LIVE_V3_VERIFIER_VERSION,
    technicalPassed,
    overallInputSuccess:
      technicalPassed &&
      input.humanSignoff.status === "passed" &&
      Boolean(input.humanSignoff.reviewer?.trim()),
    humanSignoffPending,
    failures,
    counts: {
      sources: input.sourceProbes.length,
      variants: input.sourceProbes.reduce(
        (sum, source) => sum + source.variants,
        0,
      ),
      switchedVariants: input.sourceProbes.reduce(
        (sum, source) => sum + source.visitedVariants,
        0,
      ),
      cells: input.cells.length,
      objectiveCells: input.visualRows.length,
      sceneFacts: input.sceneProofs.reduce(
        (sum, proof) => sum + proof.accounting.denominator,
        0,
      ),
      matchedSceneFacts: input.sceneProofs.reduce(
        (sum, proof) => sum + proof.accounting.matched,
        0,
      ),
      silentSceneFacts: input.sceneProofs.reduce(
        (sum, proof) => sum + proof.accounting.silent,
        0,
      ),
    },
    objective: { wins, losses, means, stratumRegressions, catastrophicCells },
  };
}

export function verifyInputLiveV3SceneFixedPoint<Instance>(
  scene: SceneNodeSnapshot,
  envelopeMetadata: RecipeEnvelope,
  selection: unknown,
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): InputLiveV3FixedPoint {
  const runCycle = (): {
    sceneIr: string;
    compiledIr: string;
    comparison: SceneComparison;
  } => {
    // Every cycle begins by extracting actual scene properties. Source IR is
    // replaced before collapse and is never accepted as an observed fact.
    const observedIr = sceneToNormalizedIr(scene);
    const observedEnvelope = structuredClone(envelopeMetadata);
    observedEnvelope.ir = observedIr;
    observedEnvelope.integrity.canonicalHash =
      hashRecipeEnvelope(observedEnvelope);
    const compiled = compile(collapse(observedEnvelope, selection));
    return {
      sceneIr: canonicalJson(observedIr),
      compiledIr: canonicalJson(compiled.ir),
      comparison: compareSceneToExpectedPlan(
        compileExpectedScenePlan(compiled.ir),
        scene,
      ),
    };
  };
  const cycle1 = runCycle();
  const cycle2 = runCycle();
  return {
    stable:
      cycle1.comparison.ok &&
      cycle2.comparison.ok &&
      cycle1.sceneIr === cycle2.sceneIr &&
      cycle1.compiledIr === cycle2.compiledIr,
    sourceIrRead: false,
    cycle1SceneIrSha256: sha256(cycle1.sceneIr),
    cycle2SceneIrSha256: sha256(cycle2.sceneIr),
    cycle1CompiledIrSha256: sha256(cycle1.compiledIr),
    cycle2CompiledIrSha256: sha256(cycle2.compiledIr),
    cycle1Comparison: cycle1.comparison,
    cycle2Comparison: cycle2.comparison,
  };
}

export function proveSceneMultiset(
  adapterIdentity: string,
  expected: ExpectedScenePlan,
  scene: SceneNodeSnapshot,
): Pick<InputLiveV3SceneProof, "adapterIdentity" | "accounting"> {
  return {
    adapterIdentity,
    accounting: compareSceneToExpectedPlan(expected, scene),
  };
}
