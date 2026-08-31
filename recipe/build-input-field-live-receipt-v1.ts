import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = "recipe/evidence/input-field-live-pivot-v1";
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
const attempts = [1, 2, 3].map((attempt) => {
  const result = json(`${ROOT}/live-attempt-${attempt}.json`);
  const cleanup = json(`${ROOT}/cleanup-attempt-${attempt}.json`);
  const writerPath =
    attempt === 1 || attempt === 2
      ? `${ROOT}/writer-attempt-${attempt}.js`
      : `${ROOT}/writer.js`;
  return {
    attempt,
    result:
      attempt === 1
        ? "failed-plugin-data-entry-limit"
        : attempt === 2
          ? "minted-then-failed-live-validation"
          : "minted-then-failed-final-live-validation",
    writer: artifact(writerPath),
    wrapper: artifact(`${ROOT}/writer-wrapper-attempt-${attempt}.txt`),
    bridgeResult: artifact(`${ROOT}/live-attempt-${attempt}.json`),
    decodedBytes: result.decodedBytes ?? null,
    decodedSha256: result.decodedSha256 ?? null,
    exactTransport:
      result.decodedBytes === readFileSync(writerPath).byteLength &&
      result.decodedSha256 === sha256(readFileSync(writerPath)),
    cleanup: {
      ...artifact(`${ROOT}/cleanup-attempt-${attempt}.json`),
      removedPageIds: cleanup.removedPageIds,
      removedCollectionIds: cleanup.removedCollectionIds,
      complete:
        cleanup.remainingPages === 0 && cleanup.remainingCollections === 0,
    },
  };
});

const packet = {
  version: "input-field-live-human-review-v1",
  status: "prepared-not-requested-engineering-failed",
  instructions: [
    "Review each source/live pair without consulting implementation identity.",
    "Judge only whether the live specimen is recognisably the same Input/Field design and state as its source.",
    "Record recognisable true/false, confidence low/medium/high, and concise visible defects.",
    "Do not infer implementation quality, do not use automated or AI grading, and do not sign off while engineering status is failed.",
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
  version: 1,
  kind: "input-field-live-proof-receipt",
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
    cleanupReason: "failed-live-criteria-after-capped-third-attempt",
  },
  status: {
    objectiveV2Offline: "pass-128-of-128",
    writerConformance: "pass",
    exactByteTransport: "pass-attempts-2-and-3",
    liveMint: "failed-proof-cleaned",
    usability: "failed-7-of-8-required-source-assertions",
    variantSwitching: "pass-256-of-256",
    tokenBindings: "pass-2-of-2",
    noFakeLayout: "pass-2-of-2",
    exactProbeRestoration: "pass-2-of-2",
    liveCellValidation: "failed-material-bounds-24-of-128-commerce-128-of-128",
    fixedPoint: "pass-2-of-2-two-stable-cycles",
    zeroSilentAccounting: "pass-nonzero-denominator",
    pairedCapture: "pass-128-of-128",
    objectiveCanvas:
      "failed-geometry-112-of-128-pixel-ink-85-of-128-versus-legacy",
    humanRecognisability: "pending-not-requested-not-ai-graded",
    overallInputSuccess: false,
  },
  plan: artifact(`${ROOT}/writer-plan.json`),
  conformance: artifact(`${ROOT}/conformance-report.json`),
  transportEnvelope: artifact(`${ROOT}/transport-envelope.json`),
  attempts,
  finalLiveMeasurements: {
    verification: artifact(`${ROOT}/live-verification.json`),
    normalizedReadback: artifact(`${ROOT}/normalized-live-readback.json`),
    objectiveCanvas: artifact(`${ROOT}/objective-canvas-result.json`),
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
    attemptsCappedAtThree: attempts.length === 3,
    allInputArtifactsCleaned: attempts.every(
      (attempt) => attempt.cleanup.complete,
    ),
    overallInputRemainsFalse: true,
  },
  docs32Status:
    "live Input attempted three times; objective canvas and final live validation failed; all Input canvas artifacts cleaned; Button proof preserved; human signoff still pending",
  nextTask:
    "repair generic floating-field fill/bounds behavior and Figma raster fidelity under a new version before any further live attempt",
};
writeFileSync(`${ROOT}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
const index = {
  version: 1,
  status: "failed-live-proof-cleaned",
  receipt: artifact(`${ROOT}/receipt.json`),
  artifacts: [
    receipt.plan,
    receipt.conformance,
    receipt.transportEnvelope,
    receipt.finalLiveMeasurements.verification,
    receipt.finalLiveMeasurements.normalizedReadback,
    receipt.finalLiveMeasurements.objectiveCanvas,
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
