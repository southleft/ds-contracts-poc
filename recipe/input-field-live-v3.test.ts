import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  readInputLiveV3Attempt1HardFailure,
  readInputLiveV3Attempt2HardFailure,
  readInputLiveV3Attempt3HardFailure,
  validateInputLiveV3Attempt1HardFailure,
  validateInputLiveV3Attempt2HardFailure,
  validateInputLiveV3Attempt3HardFailure,
  validateInputLiveV3Evidence,
} from "./input-field-live-v3-evidence.js";
import {
  buildInputLiveV3ScreenshotManifest,
  validateInputLiveV3ScreenshotManifest,
} from "./input-field-live-v3-screenshot-evidence.js";
import {
  validateInputLiveV3Preflight,
  type InputLiveV3PreflightState,
} from "./input-field-live-v3-preflight.js";
import {
  INPUT_LIVE_V3_REQUIRED_GATE_IDS,
  verifyInputLiveV3HardGates,
  type InputLiveV3CellValidation,
  type InputLiveV3HardGateInput,
  type InputLiveV3SceneProof,
  type InputLiveV3VisualRow,
} from "./input-field-live-v3-verifier.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  type SceneNodeSnapshot,
} from "./scene-readback.js";
import type { IRNode } from "./figma-ir.js";

const comparison = (): InputLiveV3SceneProof["accounting"] => ({
  ok: true,
  denominator: 10,
  matched: 10,
  codeOnly: 0,
  refused: 0,
  silent: 0,
  missing: [],
  extra: [],
  mismatched: [],
  duplicateCollapsed: [],
  unobserved: [],
  failures: [],
});

const sceneProof = (adapterIdentity: string): InputLiveV3SceneProof => ({
  adapterIdentity,
  accounting: comparison(),
  fixedPoint: {
    stable: true,
    sourceIrRead: false,
    cycle1SceneIrSha256: "a".repeat(64),
    cycle2SceneIrSha256: "a".repeat(64),
    cycle1CompiledIrSha256: "b".repeat(64),
    cycle2CompiledIrSha256: "b".repeat(64),
    cycle1Comparison: comparison(),
    cycle2Comparison: comparison(),
  },
});

const cell = (index: number): InputLiveV3CellValidation => ({
  cellKey: `${index < 128 ? "mui" : "polaris"}/cell=${index}`,
  source: index < 128 ? "mui" : "polaris",
  state: ["default", "focus-visible", "error", "disabled"][index % 4]!,
  adornment: ["none", "leading", "trailing", "both"][index % 4]!,
  rolesExact: true,
  textExact: true,
  adornmentPayloadExact: true,
  fontExact: true,
  fillExact: true,
  geometryExact: true,
  stateSemanticsExact: true,
  labelSemanticsExact: true,
  helperSemanticsExact: true,
  bindingTypesCompatible: true,
  noFakeLayout: true,
  dimension: { absolutePixels: 0, relative: 0 },
  spacing: { absolutePixels: 0, relative: 0 },
  roleScaleRelativeError: 0,
  visibleAreaLoss: 0,
  overlapPixels: 0,
});

const visual = (index: number): InputLiveV3VisualRow => ({
  cellKey: `objective-${index}`,
  source: index < 64 ? "mui" : "polaris",
  state: ["default", "focus-visible", "error", "disabled"][index % 4]!,
  adornment: ["none", "both"][index % 2]!,
  referenceSha256: "a".repeat(64),
  liveSha256: "b".repeat(64),
  geometry: { legacy: 0.4, recipe: 0.2 },
  perceptual: { legacy: 0.4, recipe: 0.2 },
  pixelInk: { legacy: 0.4, recipe: 0.2 },
});

const hardInput = (): InputLiveV3HardGateInput => ({
  thresholds: {
    dimensionError: { absolutePixels: 4, relative: 0.08 },
    spacingError: { absolutePixels: 4, relative: 0.2 },
    roleScaleError: { relative: 0.1 },
    clipping: { maximumVisibleAreaLoss: 0.05 },
    overlap: { maximumPixels: 2 },
  },
  materialRegression: {
    aggregateRelativeIncrease: 0.1,
    catastrophicCellRule: "recipe error exceeds legacy error * 1.5 + 0.02",
  },
  sourceProbes: ["mui", "polaris"].map((adapterIdentity) => ({
    adapterIdentity,
    variants: 128,
    visitedVariants: 128,
    switchingRestored: true,
    textPropertiesRestored: true,
    reflowPassed: true,
    contentFillPassed: true,
    bindingCompatibilityPassed: true,
    noFakeLayoutPassed: true,
    exactSceneRestoration: true,
  })),
  cells: Array.from({ length: 256 }, (_, index) => cell(index)),
  sceneProofs: [sceneProof("mui"), sceneProof("polaris")],
  visualRows: Array.from({ length: 128 }, (_, index) => visual(index)),
  safety: {
    exactAuthorizedFile: true,
    pageScopedOwnership: true,
    sourceReferencesUnchanged: true,
    historicalEvidenceUnchanged: true,
    repositoryPathsSafe: true,
    cleanupComplete: true,
    retentionDeclared: true,
  },
  humanSignoff: { status: "pending" },
});

const preflight = (): InputLiveV3PreflightState => ({
  clean: true,
  codeCommit: "code",
  authorizationCommit: "authorization",
  authorizationIsAncestor: true,
  antecedentIsAncestor: true,
  protocolSha256:
    "f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23",
  expectedProtocolSha256:
    "f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23",
  authorizationSha256: "a".repeat(64),
  firstAuthorizationSha256: "a".repeat(64),
  target: {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
  },
  bridge: {
    connectedExactTargetCount: 1,
    requestedFileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  },
  attempts: {
    maximum: 3,
    requested: 3,
    recorded: [1, 2],
  },
  requiredGateIds: [...INPUT_LIVE_V3_REQUIRED_GATE_IDS],
  plan: {
    sourceCount: 2,
    plannedVariants: [128, 128],
    plannedVariables: [5, 5],
    plannedSceneFacts: [10, 10],
    plannedGeneratedDescendants: [2, 2],
    expectedScenePlansValid: [true, true],
    runtimeApiAuditValid: true,
    writerBytes: 100,
    writerSha256: "b".repeat(64),
    actualWriterBytes: 100,
    actualWriterSha256: "b".repeat(64),
    transportPayloadBytes: 100,
    transportPayloadSha256: "b".repeat(64),
    wrapperBytes: 200,
    wrapperSha256: "c".repeat(64),
    actualWrapperBytes: 200,
    actualWrapperSha256: "c".repeat(64),
  },
  resultFields: [],
});

test("v3 technical gates can pass while human signoff remains pending", () => {
  const report = verifyInputLiveV3HardGates(hardInput());
  assert.equal(report.technicalPassed, true);
  assert.equal(report.humanSignoffPending, true);
  assert.equal(report.overallInputSuccess, false);
  assert.equal(report.counts.variants, 256);
});

test("v3 verifier rejects payload, binding, overlap, clipping, and duplicate facts", () => {
  const plants: Array<[string, (value: InputLiveV3HardGateInput) => void]> = [
    [
      "adornmentPayloadExact",
      (value) => {
        value.cells[0]!.adornmentPayloadExact = false;
      },
    ],
    [
      "bindingTypesCompatible",
      (value) => {
        value.cells[0]!.bindingTypesCompatible = false;
      },
    ],
    [
      "overlap tolerance",
      (value) => {
        value.cells[0]!.overlapPixels = 3;
      },
    ],
    [
      "clipping tolerance",
      (value) => {
        value.cells[0]!.visibleAreaLoss = 0.06;
      },
    ],
    [
      "scene multiset accounting",
      (value) => {
        const proof = value.sceneProofs[0]!;
        proof.accounting.ok = false;
        proof.accounting.silent = 1;
        proof.accounting.duplicateCollapsed.push({
          id: "root#fill@0001",
          baseId: "root#fill",
          nodeOwnershipKey: "root",
          channel: "fill",
          occurrence: 1,
          value: { kind: "solid", color: "#ffffffff" },
          observedProperty: "fills[]",
        });
      },
    ],
  ];
  for (const [failure, plant] of plants) {
    const value = hardInput();
    plant(value);
    assert.match(
      verifyInputLiveV3HardGates(value).failures.join("\n"),
      new RegExp(failure),
    );
  }
});

test("source, state, and adornment material regressions fail", () => {
  for (const key of ["source", "state", "adornment"] as const) {
    const value = hardInput();
    const selected = value.visualRows.filter((row) =>
      key === "source"
        ? row.source === "mui"
        : key === "state"
          ? row.state === "default"
          : row.adornment === "none",
    );
    for (const row of selected) row.pixelInk.recipe = 0.5;
    assert.match(
      verifyInputLiveV3HardGates(value).failures.join("\n"),
      new RegExp(`material stratum regression:.*${key}`),
    );
  }
});

test("preflight rejects dirty/old commits, wrong key, bridge mismatch, and zero counts", () => {
  const plants: Array<[RegExp, (value: InputLiveV3PreflightState) => void]> = [
    [/dirty tree/, (value) => (value.clean = false)],
    [
      /not a clean descendant/,
      (value) => (value.authorizationIsAncestor = false),
    ],
    [/wrong Figma target/, (value) => (value.target.fileKey = "wrong")],
    [
      /bridge mismatch/,
      (value) => (value.bridge.connectedExactTargetCount = 0),
    ],
    [/protocol byte drift/, (value) => (value.protocolSha256 = "0".repeat(64))],
    [
      /authorization byte drift/,
      (value) => (value.authorizationSha256 = "0".repeat(64)),
    ],
    [/missing required gates/, (value) => value.requiredGateIds.pop()],
    [
      /zero or incomplete planned counts/,
      (value) => (value.plan.plannedSceneFacts[0] = 0),
    ],
    [/result fields present/, (value) => value.resultFields.push("result")],
    [
      /exact prior attempt history/,
      (value) => {
        value.attempts.recorded = [1];
      },
    ],
    [
      /refuses attempt 4/,
      (value) => {
        value.attempts.requested = 4;
      },
    ],
    [
      /runtime API\/portability audit/,
      (value) => {
        value.plan.runtimeApiAuditValid = false;
      },
    ],
  ];
  assert.deepEqual(validateInputLiveV3Preflight(preflight()), []);
  for (const [pattern, plant] of plants) {
    const value = preflight();
    plant(value);
    assert.match(validateInputLiveV3Preflight(value).join("\n"), pattern);
  }
});

test("forged source IR plugin data cannot hide an actual scene mutation", () => {
  const ir: IRNode = {
    kind: "frame",
    role: "test/root",
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: { mode: "fixed", value: 100 },
      height: { mode: "fixed", value: 40 },
    },
    fills: [],
    clipsContent: false,
    children: [],
  };
  const scene: SceneNodeSnapshot = {
    ownershipKey: "root",
    type: "FRAME",
    name: "test/root",
    semanticRole: "test/root",
    width: 100,
    height: 40,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    itemSpacing: 99,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutPositioning: "AUTO",
    clipsContent: false,
    fills: [],
    boundVariables: [],
    children: [],
    pluginData: { sourceIr: JSON.stringify(ir) },
  };
  const result = compareSceneToExpectedPlan(
    compileExpectedScenePlan(ir),
    scene,
  );
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /layout\.itemSpacing/);
});

test("actual scene binding resolved type must match the typed plan", () => {
  const ir: IRNode = {
    kind: "frame",
    role: "test/root",
    bindings: [
      {
        field: "layout.itemSpacing",
        type: "FLOAT",
        variable: "test.spacing",
      },
    ],
    layout: {
      mode: "horizontal",
      primaryAxisAlign: "min",
      counterAxisAlign: "center",
      itemSpacing: 8,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      width: { mode: "fixed", value: 100 },
      height: { mode: "fixed", value: 40 },
    },
    fills: [],
    clipsContent: false,
    children: [],
  };
  const scene: SceneNodeSnapshot = {
    ownershipKey: "root",
    type: "FRAME",
    name: "test/root",
    semanticRole: "test/root",
    width: 100,
    height: 40,
    visible: true,
    opacity: 1,
    layoutMode: "HORIZONTAL",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    itemSpacing: 8,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutPositioning: "AUTO",
    clipsContent: false,
    fills: [],
    boundVariables: [
      {
        field: "itemSpacing",
        variableName: "test.spacing",
        resolvedType: "STRING",
      },
    ],
    children: [],
  };
  assert.throws(
    () => compareSceneToExpectedPlan(compileExpectedScenePlan(ir), scene),
    /layout\.itemSpacing is not compatible with STRING/,
  );
});

test("evidence validation rejects partial cleanup", () => {
  const failures = validateInputLiveV3Evidence({
    chronology: {
      codeCommit: "a".repeat(40),
      authorizationCommit: "b".repeat(40),
    },
    hashes: {
      protocolSha256: "a".repeat(64),
      authorizationSha256: "a".repeat(64),
      writerSha256: "a".repeat(64),
      transportEnvelopeSha256: "a".repeat(64),
      transportWrapperSha256: "a".repeat(64),
      verifierSha256: "a".repeat(64),
      runnerSha256: "a".repeat(64),
    },
    target: {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      fileName: "Scratch Project",
      pageId: "1:2",
      pageName: "page",
      retained: false,
      retentionReason: "failed and cleaned",
    },
    attempts: [
      {
        attempt: 1,
        writerSha256: "a".repeat(64),
        wrapperSha256: "a".repeat(64),
        decodedBytes: 1,
        decodedSha256: "a".repeat(64),
        evalBegan: true,
        evalCompleted: true,
        createdNodeIds: ["1:2"],
        mutatedNodeIds: [],
        resultArtifact: {
          path: "missing-attempt.json",
          bytes: 1,
          sha256: "a".repeat(64),
        },
        cleanup: {
          requestedNodeIds: ["1:2"],
          removedNodeIds: [],
          requestedCollectionIds: [],
          removedCollectionIds: [],
          remainingOwnedNodes: 1,
          remainingOwnedCollections: 0,
          complete: false,
          artifact: {
            path: "missing-cleanup.json",
            bytes: 1,
            sha256: "a".repeat(64),
          },
        },
      },
    ],
    report: verifyInputLiveV3HardGates(hardInput()),
    sceneProofs: [sceneProof("mui"), sceneProof("polaris")],
    sceneFactsArtifact: {
      path: "missing-scene.json",
      bytes: 1,
      sha256: "a".repeat(64),
    },
    objectiveRows: Array.from({ length: 128 }, (_, index) => visual(index)),
    objectiveArtifact: {
      path: "missing-objective.json",
      bytes: 1,
      sha256: "a".repeat(64),
    },
    humanPacket: {
      status: "pending",
      artifact: {
        path: "missing-human.json",
        bytes: 1,
        sha256: "a".repeat(64),
      },
    },
    historicalEvidenceUnchanged: true,
  });
  assert.match(failures.join("\n"), /partial cleanup/);
});

test("attempt 1 exact artifacts validate only as a hard failure", () => {
  const evidence = readInputLiveV3Attempt1HardFailure();
  assert.equal(
    evidence.attemptArtifact.sha256,
    "28100f55a183c6dd346c9c0d4adb394eb33705881e1ad302d5a3dd174653a698",
  );
  assert.equal(
    evidence.cleanupArtifact.sha256,
    "5aa381b9c7d82431d8a5861a678e2e6949b0977adaa66a17e1f4c73eeb4df2b3",
  );
  assert.equal(evidence.attempt.verification.measuredSceneFacts, 0);
  assert.equal(evidence.attempt.writerResult.sources[0].variantCount, 128);
  assert.equal(evidence.attempt.writerResult.sources[1].variantCount, 128);
  assert.equal(
    evidence.cleanup.manualCleanup.unrelatedScratchFingerprint.before,
    evidence.cleanup.manualCleanup.unrelatedScratchFingerprint.after,
  );
  assert.equal(evidence.cleanup.runnerCleanup.complete, false);
  assert.equal(evidence.cleanup.manualCleanup.complete, true);
  assert.equal(
    existsSync("recipe/evidence/input-field-live-pivot-v3/receipt.json"),
    false,
  );
});

test("attempt 1 missing result fields, success claims, and fingerprint tampering refuse", () => {
  const evidence = readInputLiveV3Attempt1HardFailure();
  const plants: Array<{
    pattern: RegExp;
    mutate: (
      attempt: Record<string, any>,
      cleanup: Record<string, any>,
    ) => void;
  }> = [
    {
      pattern: /verifier hard failure\/zero measurements/,
      mutate: (attempt) => {
        delete attempt.verification.measuredSceneFacts;
      },
    },
    {
      pattern: /absent success\/result artifacts/,
      mutate: (attempt) => {
        attempt.artifacts.successReceipt = { path: "forged" };
      },
    },
    {
      pattern: /manual cleanup fingerprint/,
      mutate: (_attempt, cleanup) => {
        cleanup.manualCleanup.unrelatedScratchFingerprint.after = "forged";
      },
    },
    {
      pattern: /hard-failure identity/,
      mutate: (attempt) => {
        attempt.outcome = "passed";
      },
    },
  ];
  for (const plant of plants) {
    const attempt = structuredClone(evidence.attempt);
    const cleanup = structuredClone(evidence.cleanup);
    plant.mutate(attempt, cleanup);
    assert.match(
      validateInputLiveV3Attempt1HardFailure(attempt, cleanup).join("\n"),
      plant.pattern,
    );
  }
});

test("attempt 2 exact artifacts validate only as a hard failure", () => {
  const evidence = readInputLiveV3Attempt2HardFailure();
  assert.equal(
    evidence.attemptArtifact.sha256,
    "f1de7c8bcb8785522a022c5c6354add31214b40653c27ee27721156bed238256",
  );
  assert.equal(
    evidence.cleanupArtifact.sha256,
    "c0f52d8fb45bdcc048f570384898e2f6d0465a2da88c2551f3d75f428f34d19d",
  );
  assert.equal(evidence.attempt.verification.measuredSceneFacts, 0);
  assert.equal(evidence.attempt.verification.measuredObjectiveRows, 0);
  assert.equal(evidence.attempt.writerResult.sources[0].variantCount, 128);
  assert.equal(evidence.attempt.writerResult.sources[1].variantCount, 128);
  assert.equal(evidence.cleanup.runnerCleanup.complete, false);
  assert.equal(evidence.cleanup.manualCleanup.complete, true);
  assert.equal(
    evidence.cleanup.manualCleanup.unrelatedScratchFingerprint.before,
    evidence.cleanup.manualCleanup.unrelatedScratchFingerprint.after,
  );
  assert.equal(
    existsSync("recipe/evidence/input-field-live-pivot-v3/receipt.json"),
    false,
  );
});

test("attempt 2 tamper and success claims refuse", () => {
  const evidence = readInputLiveV3Attempt2HardFailure();
  const plants: Array<{
    pattern: RegExp;
    mutate: (
      attempt: Record<string, any>,
      cleanup: Record<string, any>,
    ) => void;
  }> = [
    {
      pattern: /verifier hard failure\/zero measurements/,
      mutate: (attempt) => {
        attempt.verification.measuredSceneFacts = 1;
      },
    },
    {
      pattern: /absent success\/result artifacts/,
      mutate: (attempt) => {
        attempt.artifacts.successReceipt = { path: "forged" };
      },
    },
    {
      pattern: /manual cleanup fingerprint/,
      mutate: (_attempt, cleanup) => {
        cleanup.manualCleanup.unrelatedScratchFingerprint.after = "forged";
      },
    },
    {
      pattern: /separate runner cleanup/,
      mutate: (_attempt, cleanup) => {
        cleanup.runnerFailureEvidence.exactError = "invented";
      },
    },
  ];
  for (const plant of plants) {
    const attempt = structuredClone(evidence.attempt);
    const cleanup = structuredClone(evidence.cleanup);
    plant.mutate(attempt, cleanup);
    assert.match(
      validateInputLiveV3Attempt2HardFailure(attempt, cleanup).join("\n"),
      plant.pattern,
    );
  }
});

test("attempt 3 exact failure and all 128 unscored captures validate", () => {
  const evidence = readInputLiveV3Attempt3HardFailure();
  assert.equal(evidence.attempt.verification.sceneFactsMeasured, null);
  assert.equal(evidence.attempt.verification.fixedPointCyclesMeasured, null);
  assert.equal(evidence.attempt.verification.usability, null);
  assert.equal(evidence.attempt.verification.objectiveRowsMeasured, null);
  assert.equal(evidence.attempt.verification.capturedCells, 128);
  assert.equal(evidence.attempt.writerResult.exactPageId, null);
  assert.equal(evidence.cleanup.postCleanupVerification.complete, true);
  assert.equal(
    evidence.cleanup.postCleanupVerification.unrelatedScratchFingerprint.before,
    evidence.cleanup.postCleanupVerification.unrelatedScratchFingerprint.after,
  );
  const manifest = buildInputLiveV3ScreenshotManifest();
  assert.deepEqual(validateInputLiveV3ScreenshotManifest(manifest), []);
  assert.equal(manifest.count, 128);
  assert.equal(manifest.totalBytes, 1_065_965);
  assert.equal(
    manifest.orderedBundleSha256,
    "f75fbbdf6e28c0d265f44de758128fc707e76da331345b4eb603638bbfbd528d",
  );
});

test("attempt 3 rejects inferred outcomes, recovered IDs, and cleanup drift", () => {
  const evidence = readInputLiveV3Attempt3HardFailure();
  const plants: Array<{
    pattern: RegExp;
    mutate: (
      attempt: Record<string, any>,
      cleanup: Record<string, any>,
    ) => void;
  }> = [
    {
      pattern: /unavailable gates/,
      mutate: (attempt) => {
        attempt.verification.sceneFactsMeasured = 0;
      },
    },
    {
      pattern: /nontransactional writer result/,
      mutate: (attempt) => {
        attempt.writerResult.exactPageId = "invented";
      },
    },
    {
      pattern: /capture denominator/,
      mutate: (attempt) => {
        attempt.artifacts.captures.scored = true;
      },
    },
    {
      pattern: /exact cleanup restoration/,
      mutate: (_attempt, cleanup) => {
        cleanup.postCleanupVerification.remainingOwnedNodes = 1;
      },
    },
  ];
  for (const plant of plants) {
    const attempt = structuredClone(evidence.attempt);
    const cleanup = structuredClone(evidence.cleanup);
    plant.mutate(attempt, cleanup);
    assert.match(
      validateInputLiveV3Attempt3HardFailure(attempt, cleanup).join("\n"),
      plant.pattern,
    );
  }
});

test("runner contains no posthoc threshold constants or source rewriting", () => {
  const runner = readFileSync("recipe/run-input-field-live-v3.ts", "utf8");
  assert.doesNotMatch(runner, /absolutePixels:\s*4/);
  assert.doesNotMatch(runner, /maximumVisibleAreaLoss:\s*0\.05/);
  assert.doesNotMatch(runner, /\.replaceAll?\(/);
  assert.match(runner, /protocol\.hardGates\.thresholds/);
});
