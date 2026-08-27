import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import {
  readRepositoryEvidence,
  readRepositoryJson,
  resolveRepositoryEvidencePath,
} from "./evidence-path.js";

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sameNumber = (left: unknown, right: unknown): boolean =>
  typeof left === "number" &&
  typeof right === "number" &&
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  Math.abs(left - right) <= Number.EPSILON * Math.max(1, Math.abs(right)) * 8;

export const HISTORICAL_INPUT_V2_LIMITATIONS = [
  "the uncommitted tree cannot prove criterion chronology or immutability",
  "the historical live readback used stamped source IR and cannot certify inversion",
  "the historical zero-silent denominator was assigned rather than scene-derived",
  "human recognisability was not performed",
] as const;

export function validateInputFieldLiveReceiptV2(
  receipt: Record<string, any>,
): string[] {
  const failures: string[] = [];
  const fail = (message: string) => failures.push(message);
  if (receipt.version !== 2) fail("version");
  if (receipt.target?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh")
    fail("Scratch target");
  if (receipt.target?.retained !== false) fail("failed page retained");
  if (receipt.status?.overallInputSuccess !== false) fail("false status");
  if (receipt.status?.usability !== "pass-8-of-8-required-source-assertions")
    fail("usability");
  if (receipt.status?.liveCellValidation !== "pass-256-of-256")
    fail("live cells");
  if (receipt.finalLiveMeasurements?.objective?.denominator !== 128)
    fail("objective denominator");
  if (
    receipt.finalLiveMeasurements?.objective?.geometry?.liveWins !== 112 ||
    receipt.finalLiveMeasurements?.objective?.pixelInk?.liveWins !== 87
  )
    fail("objective result");
  const accounting = receipt.finalLiveMeasurements?.zeroSilentAccounting;
  if (
    accounting?.denominator !== 14064 ||
    accounting.carried + accounting.codeOnly + accounting.refused !==
      accounting.denominator ||
    accounting.silent !== 0
  )
    fail("accounting");
  if (
    receipt.attempts?.maximum !== 3 ||
    receipt.attempts?.executed !== 2 ||
    receipt.attempts?.history?.length !== 2
  )
    fail("attempt cap");
  if (
    !receipt.attempts?.history?.every(
      (attempt: Record<string, any>) => attempt.cleanup?.complete === true,
    )
  )
    fail("cleanup");
  if (
    receipt.tamperGates?.allInputArtifactsCleaned !== true ||
    receipt.tamperGates?.sourceReferencesUnchanged !== true ||
    receipt.tamperGates?.probeMutationRestored !== true ||
    receipt.tamperGates?.v1EvidenceUnchanged !== true
  )
    fail("tamper gates");
  if (
    Object.values(receipt.tamperGates ?? {}).some((value) => value !== true)
  ) {
    fail("tamper gate false");
  }
  for (const artifact of [
    receipt.immutableV1?.receipt,
    receipt.immutableV1?.humanPacket,
    receipt.immutableV1?.index,
    receipt.diagnosis,
    receipt.plan,
    receipt.conformance,
    receipt.transportEnvelope,
    receipt.humanPacket,
    receipt.finalLiveMeasurements?.verification,
    receipt.finalLiveMeasurements?.normalizedReadback,
    receipt.finalLiveMeasurements?.objectiveCanvas,
    ...receipt.attempts.history.flatMap((attempt: Record<string, any>) => [
      attempt.writer,
      attempt.wrapper,
      attempt.bridgeResult,
      attempt.cleanup,
    ]),
  ]) {
    if (
      !artifact ||
      !existsSync(resolveRepositoryEvidencePath(artifact.path)) ||
      readRepositoryEvidence(artifact.path).byteLength !== artifact.bytes ||
      sha256(readRepositoryEvidence(artifact.path)) !== artifact.sha256
    )
      fail(`artifact ${artifact?.path ?? "absent"}`);
  }
  const objectiveArtifact = receipt.finalLiveMeasurements?.objectiveCanvas;
  if (objectiveArtifact?.path) {
    const objective = readRepositoryJson<Record<string, any>>(
      objectiveArtifact.path,
    );
    const rows = Array.isArray(objective.rows) ? objective.rows : [];
    const mean = (field: string): number =>
      rows.reduce(
        (sum: number, row: Record<string, any>) =>
          sum + Number(row.metrics?.[field]),
        0,
      ) / rows.length;
    const recomputed = {
      denominator: rows.length,
      geometry: {
        liveWins: rows.filter(
          (row: Record<string, any>) => row.geometryBeatsLegacy === true,
        ).length,
        legacyWins: rows.filter(
          (row: Record<string, any>) => row.geometryBeatsLegacy !== true,
        ).length,
      },
      pixelInk: {
        liveWins: rows.filter(
          (row: Record<string, any>) => row.pixelInkBeatsLegacy === true,
        ).length,
        legacyWins: rows.filter(
          (row: Record<string, any>) => row.pixelInkBeatsLegacy !== true,
        ).length,
      },
      aggregates: {
        meanGeometryError: mean("geometryError"),
        meanPixelInkCompositeError: mean("pixelInkCompositeError"),
        meanOverallWeightedError: mean("overallWeightedError"),
      },
    };
    const claimed = receipt.finalLiveMeasurements.objective;
    if (
      rows.length === 0 ||
      recomputed.denominator !== objective.denominator ||
      recomputed.denominator !== claimed.denominator ||
      JSON.stringify(recomputed.geometry) !==
        JSON.stringify(objective.geometry) ||
      JSON.stringify(recomputed.geometry) !==
        JSON.stringify(claimed.geometry) ||
      JSON.stringify(recomputed.pixelInk) !==
        JSON.stringify(objective.pixelInk) ||
      JSON.stringify(recomputed.pixelInk) !==
        JSON.stringify(claimed.pixelInk) ||
      !sameNumber(
        recomputed.aggregates.meanGeometryError,
        objective.aggregates?.meanGeometryError,
      ) ||
      !sameNumber(
        recomputed.aggregates.meanPixelInkCompositeError,
        objective.aggregates?.meanPixelInkCompositeError,
      ) ||
      !sameNumber(
        recomputed.aggregates.meanOverallWeightedError,
        objective.aggregates?.meanOverallWeightedError,
      ) ||
      !sameNumber(
        recomputed.aggregates.meanGeometryError,
        claimed.aggregates?.meanGeometryError,
      ) ||
      !sameNumber(
        recomputed.aggregates.meanPixelInkCompositeError,
        claimed.aggregates?.meanPixelInkCompositeError,
      ) ||
      !sameNumber(
        recomputed.aggregates.meanOverallWeightedError,
        claimed.aggregates?.meanOverallWeightedError,
      )
    ) {
      fail("objective arithmetic");
    }
    if (
      Object.values(recomputed.aggregates).some(
        (value) => !Number.isFinite(value) || value < 0 || value > 1,
      )
    ) {
      fail("extreme objective aggregate");
    }
    if (
      JSON.stringify(claimed.lockedProgressCriteria) !==
        JSON.stringify(objective.lockedProgressCriteria) ||
      /posthoc/i.test(
        String(claimed.lockedProgressCriteria?.declaredBeforeMeasurement),
      )
    ) {
      fail("posthoc criterion");
    }
    const protocol = objective.protocol;
    if (
      !protocol?.path ||
      sha256(readRepositoryEvidence(protocol.path)) !== protocol.sha256
    ) {
      fail("criterion hash");
    }
  } else {
    fail("objective artifact absent");
  }
  return failures;
}

if (process.argv[1]?.endsWith("input-field-live-receipt-v2.ts")) {
  const receipt = JSON.parse(
    readRepositoryEvidence(
      "recipe/evidence/input-field-live-pivot-v2/receipt.json",
    ).toString("utf8"),
  );
  const failures = validateInputFieldLiveReceiptV2(receipt);
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    "Input live v2 receipt: historical bytes/arithmetic valid; inversion and chronology not revalidated; false",
  );
}
