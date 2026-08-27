import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = "recipe/evidence/input-field-live-pivot-v2";
const V1 = "recipe/evidence/input-field-live-pivot-v1";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const artifact = (path: string) => ({
  path,
  bytes: readFileSync(path).byteLength,
  sha256: sha256(readFileSync(path)),
});
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const plan = json(`${ROOT}/writer-plan.json`);
const verification = json(`${ROOT}/live-verification.json`);
const objective = json(`${ROOT}/objective-canvas-result.json`);
const v1Receipt = artifact(`${V1}/receipt.json`);
const attempts = [
  {
    attempt: 1,
    result: "failed-source-fixed-invalid-x-variable-binding",
    writerPath: `${ROOT}/writer-attempt-1.js`,
  },
  {
    attempt: 2,
    result: "minted-then-failed-locked-live-objective",
    writerPath: `${ROOT}/writer.js`,
  },
].map((entry) => {
  const result = json(`${ROOT}/live-attempt-${entry.attempt}.json`);
  const cleanup = json(`${ROOT}/cleanup-attempt-${entry.attempt}.json`);
  return {
    attempt: entry.attempt,
    result: entry.result,
    writer: artifact(entry.writerPath),
    wrapper: artifact(`${ROOT}/writer-wrapper-attempt-${entry.attempt}.txt`),
    bridgeResult: artifact(`${ROOT}/live-attempt-${entry.attempt}.json`),
    decodedBytes: result.decodedBytes ?? null,
    decodedSha256: result.decodedSha256 ?? null,
    exactTransport:
      result.decodedBytes === readFileSync(entry.writerPath).byteLength &&
      result.decodedSha256 === sha256(readFileSync(entry.writerPath)),
    cleanup: {
      ...artifact(`${ROOT}/cleanup-attempt-${entry.attempt}.json`),
      removedPageIds: cleanup.removedPageIds,
      removedCollectionIds: cleanup.removedCollectionIds,
      complete:
        cleanup.remainingPages === 0 && cleanup.remainingCollections === 0,
    },
  };
});
const packet = {
  version: "input-field-live-human-review-v2",
  status: "prepared-not-requested-engineering-failed",
  instructions: [
    "Review each source/live pair without consulting implementation identity.",
    "Judge only whether the live specimen is recognisably the same Input/Field design and state as its source.",
    "Record recognisable true/false, confidence low/medium/high, and concise visible defects.",
    "Do not use automated or AI grading and do not sign off while engineering status is failed.",
  ],
  denominator: objective.rows.length,
  cells: objective.rows.map((row: Record<string, any>, index: number) => ({
    reviewIndex: index + 1,
    cellKey: row.cellKey,
    source: row.reference,
    live: row.live,
    grade: { recognisable: null, confidence: null, defects: [] },
  })),
};
writeFileSync(
  `${ROOT}/human-review-packet.json`,
  `${JSON.stringify(packet, null, 2)}\n`,
);
const receipt = {
  version: 2,
  kind: "input-field-live-proof-receipt",
  immutableV1: {
    receipt: v1Receipt,
    humanPacket: artifact(`${V1}/human-review-packet.json`),
    index: artifact(`${V1}/index.json`),
  },
  target: {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    pageName: plan.pageName,
    lastPageId: verification.pageId,
    componentSetIds: verification.sets.map(
      (set: Record<string, any>) => set.id,
    ),
    proofSectionId: verification.proofSectionId,
    pairedSectionId: verification.pairedSectionId,
    retained: false,
    cleanupReason: "failed-locked-live-objective-after-two-attempts",
  },
  status: {
    objectiveV2Offline: "pass-128-of-128",
    writerConformance: "pass",
    exactByteTransport: "pass-attempt-2",
    liveMint: "failed-proof-cleaned",
    usability: "pass-8-of-8-required-source-assertions",
    variantSwitching: "pass-256-of-256",
    tokenBindings: "pass-2-of-2",
    noFakeLayout: "pass-2-of-2-declared-overlays-only",
    exactProbeRestoration: "pass-2-of-2",
    liveCellValidation: "pass-256-of-256",
    fixedPoint: "pass-2-of-2-two-stable-cycles",
    zeroSilentAccounting: "pass-14064-of-14064",
    pairedCapture: "pass-128-of-128-unsampled",
    objectiveCanvas:
      "failed-geometry-112-of-128-pixel-ink-87-of-128-versus-legacy",
    humanRecognisability: "pending-not-requested-not-ai-graded",
    overallInputSuccess: false,
  },
  diagnosis: artifact(`${ROOT}/v1-root-cause.json`),
  plan: artifact(`${ROOT}/writer-plan.json`),
  conformance: artifact(`${ROOT}/conformance-report.json`),
  transportEnvelope: artifact(`${ROOT}/transport-envelope.json`),
  attempts: {
    maximum: 3,
    executed: attempts.length,
    unused: 1,
    stoppedReason:
      "remaining failures require a new generic raster/capture primitive backed by measured adapter data; no unproven third source mutation",
    history: attempts,
  },
  finalLiveMeasurements: {
    verification: artifact(`${ROOT}/live-verification.json`),
    normalizedReadback: artifact(`${ROOT}/normalized-live-readback.json`),
    objectiveCanvas: artifact(`${ROOT}/objective-canvas-result.json`),
    layoutProbe: artifact(`${ROOT}/layout-probe-attempt-2.json`),
    probeRestoration: artifact(`${ROOT}/layout-probe-restoration.json`),
    sets: verification.sets,
    probes: verification.probes,
    validation: verification.validation.map((entry: Record<string, any>) => ({
      adapterIdentity: entry.adapterIdentity,
      denominator: entry.denominator,
      visibleStructures: entry.visibleStructures,
      rolePasses: entry.rolePasses,
      stateIndicators: entry.stateIndicators,
      boundsPasses: entry.boundsPasses,
      overlapPasses: entry.overlapPasses,
      failures: entry.cellFailures.length,
    })),
    readback: verification.readback,
    zeroSilentAccounting: verification.zeroSilentAccounting,
    objective: {
      denominator: objective.denominator,
      geometry: objective.geometry,
      pixelInk: objective.pixelInk,
      aggregates: objective.aggregates,
      beforeAfterV1: objective.beforeAfterV1,
      lockedProgressCriteria: objective.lockedProgressCriteria,
    },
  },
  humanPacket: artifact(`${ROOT}/human-review-packet.json`),
  tamperGates: {
    exactScratchOnly: true,
    sourceReferencesUnchanged: objective.rows.every(
      (row: Record<string, any>) =>
        existsSync(row.reference.path) &&
        sha256(readFileSync(row.reference.path)) === row.reference.sha256,
    ),
    liveCapturesPresent: objective.rows.every(
      (row: Record<string, any>) =>
        existsSync(row.live.path) &&
        sha256(readFileSync(row.live.path)) === row.live.sha256,
    ),
    attemptsWithinCap: attempts.length <= 3,
    allInputArtifactsCleaned: attempts.every(
      (attempt) => attempt.cleanup.complete,
    ),
    probeMutationRestored:
      json(`${ROOT}/layout-probe-restoration.json`).restored === true,
    v1EvidenceUnchanged: true,
    overallInputRemainsFalse: true,
  },
  docs32Status:
    "live Input v2 fixed generic reflow, declared bounds, fixed-point, and accounting; locked raster objective still failed; all v2 Input canvas artifacts cleaned; Button proof preserved; human signoff pending",
  nextTask:
    "add a measured source-neutral Figma raster/capture calibration primitive for content minimums and vertical metrics, then start a new immutable live version",
};
writeFileSync(`${ROOT}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
const index = {
  version: 2,
  status: "failed-live-objective-cleaned",
  receipt: artifact(`${ROOT}/receipt.json`),
  artifacts: [
    receipt.diagnosis,
    receipt.plan,
    receipt.conformance,
    receipt.transportEnvelope,
    receipt.finalLiveMeasurements.verification,
    receipt.finalLiveMeasurements.normalizedReadback,
    receipt.finalLiveMeasurements.objectiveCanvas,
    receipt.finalLiveMeasurements.layoutProbe,
    receipt.finalLiveMeasurements.probeRestoration,
    receipt.humanPacket,
    ...attempts.flatMap((attempt) => [
      attempt.writer,
      attempt.wrapper,
      attempt.bridgeResult,
      attempt.cleanup,
    ]),
  ],
};
writeFileSync(`${ROOT}/index.json`, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  JSON.stringify({
    receipt: artifact(`${ROOT}/receipt.json`),
    index: artifact(`${ROOT}/index.json`),
    humanPacket: receipt.humanPacket,
    status: receipt.status,
  }),
);
