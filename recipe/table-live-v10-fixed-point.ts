/**
 * Table live v10 host verifier. Table-shaped: table/row/cell ownership,
 * content HUG (not FILL), no overlay/option/listbox, no visual comparison.
 */
import { createHash } from "node:crypto";

import type { RecipeEnvelope } from "./envelope.js";
import { hashRecipeEnvelope } from "./hash.js";
import { canonicalJson } from "./normalize.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneNodeSnapshot,
} from "./scene-readback-table-v1.js";

export const TABLE_LIVE_V10_FIXED_VERIFIER_VERSION = "table-live-v10-fixed-point-v1";
export const TABLE_LIVE_V10_FIXED_REQUIRED_GATE_IDS = [
  "expected-plan-multiset-occurrences-preserved",
  "zero-missing-extra-mismatched-duplicate-collapsed-unobserved-facts",
  "actual-scene-properties-only",
  "plugin-data-source-ir-forbidden",
  "silent-count-derived",
  "two-cycle-scene-derived-fixed-point",
  "content-hug-not-fill",
  "css-and-output-path-security",
  "table-row-cell-roles-and-state-semantics",
  "font-resolution-provenance-and-named-refusals",
  "typed-deterministic-writer-and-collision-refusals",
] as const;

export interface TableLiveV10FixedThresholds {
  clipping: { maximumVisibleAreaLoss: number };
  overlap: { maximumPixels: number };
}

export interface TableLiveV10FixedCellValidation {
  cellKey: string;
  source: string;
  kind: "table" | "row" | "cell";
  rolesExact: boolean;
  stateSemanticsExact: boolean;
  noFakeLayout: boolean;
  visibleAreaLoss: number;
  overlapPixels: number;
}

export interface TableLiveV10FixedSourceProbe {
  adapterIdentity: string;
  variants: number;
  visitedVariants: number;
  switchingRestored: boolean;
  textPropertiesRestored: boolean;
  reflowPassed: boolean;
  contentHugPassed: boolean;
  bindingCompatibilityPassed: boolean;
  noFakeLayoutPassed: boolean;
  exactSceneRestoration: boolean;
}

export interface TableLiveV10FixedSceneProof {
  adapterIdentity: string;
  accounting: SceneComparison;
  fixedPoint: TableLiveV10FixedFixedPoint;
}

export interface TableLiveV10FixedHardGateInput {
  thresholds: TableLiveV10FixedThresholds;
  sourceProbes: TableLiveV10FixedSourceProbe[];
  cells: TableLiveV10FixedCellValidation[];
  sceneProofs: TableLiveV10FixedSceneProof[];
  visualRows: readonly unknown[];
  safety: {
    exactAuthorizedFile: boolean;
    pageScopedOwnership: boolean;
    sourceReferencesUnchanged: boolean;
    historicalEvidenceUnchanged: boolean;
    repositoryPathsSafe: boolean;
    cleanupComplete: boolean;
    retentionDeclared: boolean;
    inputPageUntouched: boolean;
    comboboxPageUntouched: boolean;
  };
  humanSignoff: {
    status: "pending" | "passed" | "failed";
    reviewer?: string;
  };
}

export interface TableLiveV10FixedHardGateReport {
  verifierVersion: typeof TABLE_LIVE_V10_FIXED_VERIFIER_VERSION;
  technicalPassed: boolean;
  overallInputSuccess: boolean;
  humanSignoffPending: boolean;
  failures: string[];
  counts: {
    sources: number;
    variants: number;
    switchedVariants: number;
    cells: number;
    objectiveCells: 0;
    sceneFacts: number;
    matchedSceneFacts: number;
    silentSceneFacts: number;
  };
}

export interface TableLiveV10FixedFixedPoint {
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

const validateThresholds = (
  thresholds: TableLiveV10FixedThresholds,
): string[] => {
  const failures: string[] = [];
  if (thresholds.clipping.maximumVisibleAreaLoss !== 0.05)
    failures.push("locked clipping threshold drift");
  if (thresholds.overlap.maximumPixels !== 2)
    failures.push("locked overlap threshold drift");
  return failures;
};

export function verifyTableLiveV10FixedHardGates(
  input: TableLiveV10FixedHardGateInput,
): TableLiveV10FixedHardGateReport {
  const failures = validateThresholds(input.thresholds);

  if (
    input.sourceProbes.length !== 2 ||
    new Set(input.sourceProbes.map((source) => source.adapterIdentity)).size !==
      2
  ) {
    failures.push("expected exactly two distinct source probes");
  }
  for (const source of input.sourceProbes) {
    if (source.variants !== 10)
      failures.push(`${source.adapterIdentity}: variants ${source.variants}/10`);
    if (source.visitedVariants !== 10)
      failures.push(
        `${source.adapterIdentity}: switching ${source.visitedVariants}/10`,
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
    input.cells.length !== 20 ||
    new Set(input.cells.map((cell) => cell.cellKey)).size !== 20
  ) {
    failures.push("live cell denominator must be 20 unique table/row/cell cells");
  }
  const exactFields: Array<keyof TableLiveV10FixedCellValidation> = [
    "rolesExact",
    "stateSemanticsExact",
    "noFakeLayout",
  ];
  for (const cell of input.cells) {
    if (
      cell.kind !== "table" &&
      cell.kind !== "row" &&
      cell.kind !== "cell"
    )
      failures.push(`${cell.cellKey}: kind is not table-shaped`);
    for (const field of exactFields)
      if (cell[field] !== true) failures.push(`${cell.cellKey}: ${field}`);
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

  if (input.visualRows.length !== 0)
    failures.push("table live v10 must not invent a visual comparison");

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
    verifierVersion: TABLE_LIVE_V10_FIXED_VERIFIER_VERSION,
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
      objectiveCells: 0,
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
  };
}

export function verifyTableLiveV10FixedSceneFixedPoint<Instance>(
  scene: SceneNodeSnapshot,
  envelopeMetadata: RecipeEnvelope,
  selection: unknown,
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): TableLiveV10FixedFixedPoint {
  const runCycle = (): {
    sceneIr: string;
    compiledIr: string;
    comparison: SceneComparison;
  } => {
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
        compileExpectedScenePlan(compiled.ir, {
          rootOwnershipKey: scene.ownershipKey,
        }),
        scene,
        {
          omitOpacityOwnershipKeys:
            contentTextOwnershipKeysWithoutCompileOpacity(
              compiled.ir,
              scene.ownershipKey,
            ),
        },
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
): Pick<TableLiveV10FixedSceneProof, "adapterIdentity" | "accounting"> {
  return {
    adapterIdentity,
    accounting: compareSceneToExpectedPlan(expected, scene),
  };
}
