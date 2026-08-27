import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT,
  readInputLiveV3Attempt1HardFailure,
  readInputLiveV3Attempt2HardFailure,
  readInputLiveV3Attempt3HardFailure,
} from "./input-field-live-v3-evidence.js";
import {
  INPUT_LIVE_V4_PROTOCOL_SHA256,
  INPUT_LIVE_V4_STATUS,
  readInputLiveV4Protocol,
} from "./input-field-live-v4-evidence.js";
import {
  readRepositoryEvidence,
  readRepositoryJson,
  resolveRepositoryEvidencePath,
} from "./evidence-path.js";

export const INPUT_LIVE_V3_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v3/protocol.json";
export const INPUT_LIVE_V3_PROTOCOL_SHA256 =
  "f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23";
export const PIVOT_STATUS_PATH = "recipe/evidence/status-index.json";
const V3_ROOT = "recipe/evidence/input-field-live-pivot-v3";
const DRAFT_STATUS =
  "draft-uncommitted; chronology unproven; capture forbidden";
const STATUS_INDEX_STATUS =
  "Input live v3 exhausted; v4 draft not authorized; Button false/pending; Input false";
const V3_INDEX_STATUS =
  "attempt 3 hard failure; v3 permanently exhausted";
const V3_PREPARED_FILES = [
  "capture-authorization.json",
  "conformance-report.json",
  "cleanup-attempt-1.json",
  "cleanup-attempt-2.json",
  "cleanup-attempt-3.json",
  "expected-scene-plan-mui.json.gz",
  "expected-scene-plan-polaris.json.gz",
  "index.json",
  "live-attempt-1.json",
  "live-attempt-2.json",
  "live-attempt-3.json",
  "protocol.json",
  "transport-envelope.json",
  "writer-plan.json",
  "writer-wrapper.txt",
  "writer.js",
  "screenshots",
] as const;
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export function validatePivotStatus(
  status: Record<string, any>,
  protocol: Record<string, any>,
  index: Record<string, any>,
  v3Files: readonly string[],
  protocolHash: string,
): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  if (
    status.status !== STATUS_INDEX_STATUS ||
    protocol.status !== DRAFT_STATUS ||
    index.status !== V3_INDEX_STATUS
  )
    fail("criterion/authorization chronology status");
  if (
    status.chronology?.externallyVerifiable !== true ||
    status.chronology?.antecedentCommit !==
      "be6b01300ad99d8a29ea4c11508d192dec84bbea" ||
    protocol.chronology?.externallyVerifiable !== false
  )
    fail("chronology overclaim");
  if (
    protocol.chronology?.captureAuthorized !== false ||
    index.captureAuthorized !== true ||
    status.input?.liveV3?.captureAuthorizationDerivedByGate !== true ||
    status.input?.liveV3?.captureOccurred !== true
  )
    fail("capture authorization/status");
  if (
    status.button?.overallSuccess !== false ||
    status.button?.status !== "pending" ||
    status.input?.overallSuccess !== false ||
    status.input?.status !== "blocked" ||
    status.input?.liveV2?.result !== "failed"
  )
    fail("corrected Button/Input status");
  if (
    protocol.historicalApplication?.inputLiveV2Status !== "failed" ||
    protocol.historicalApplication?.recertified !== false ||
    protocol.humanGate?.mandatory !== true ||
    protocol.visualRelativeProgression?.exactPixelDifference !==
      "diagnostic-only"
  )
    fail("v3 acceptance safeguards");
  if (
    protocol.denominator?.cellsPerSource !== 128 ||
    protocol.hardGates?.allCellsMustPass !== true ||
    protocol.readbackAndAccounting?.silentDerived !== true ||
    protocol.readbackAndAccounting?.multisetOccurrencesPreserved !== true
  )
    fail("v3 hard gate");
  if (
    protocolHash !== INPUT_LIVE_V3_PROTOCOL_SHA256 ||
    index.protocol?.sha256 !== protocolHash ||
    status.input?.liveV3?.protocolSha256 !== protocolHash
  )
    fail("protocol hash");
  if (
    index.result?.status !== "hard-failure" ||
    index.result?.attempt !== 3 ||
    index.result?.writerExecutionSucceeded !== true ||
    index.result?.mintedVariants !== null ||
    index.result?.verifierCompleted !== false ||
    index.result?.sceneFactsExpected !== 43_726 ||
    index.result?.sceneFactsMeasured !== null ||
    index.result?.sceneAccounting !== null ||
    index.result?.fixedPointCyclesMeasured !== null ||
    index.result?.usability !== null ||
    index.result?.restoration !== null ||
    index.result?.objectiveRowsMeasured !== null ||
    index.result?.capturedCells !== 128 ||
    index.result?.capturesScored !== false ||
    index.result?.successReceiptWritten !== false ||
    index.overallInputSuccess !== false ||
    !Array.isArray(index.captureArtifacts) ||
    index.captureArtifacts.length !== 7 ||
    status.input?.liveV3?.attemptsExecuted !== 3 ||
    status.input?.liveV3?.attempt2?.sceneFactsMeasured !== 0 ||
    status.input?.liveV3?.attempt2?.successReceiptWritten !== false ||
    status.input?.liveV3?.attempt3?.sceneFactsMeasured !== null ||
    status.input?.liveV3?.attempt3?.capturedCells !== 128 ||
    status.input?.liveV3?.attempt3?.capturesScored !== false ||
    status.input?.liveV3?.attempt3?.objectiveRowsMeasured !== null ||
    status.input?.liveV3?.attempt3?.exactFigmaIdsAvailable !== false ||
    status.input?.liveV3?.attempt3?.remainingOwnedNodes !== 0 ||
    status.input?.liveV3?.attempt3?.remainingOwnedCollections !== 0 ||
    status.input?.liveV4?.status !== INPUT_LIVE_V4_STATUS ||
    status.input?.liveV4?.protocolSha256 !==
      INPUT_LIVE_V4_PROTOCOL_SHA256 ||
    status.input?.liveV4?.normalizationFixturesSha256 !==
      "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13" ||
    status.input?.liveV4?.authorized !== false ||
    status.input?.liveV4?.liveExecutionOccurred !== false ||
    status.input?.liveV4?.humanSignoff !== "pending"
  )
    fail("v3 exhausted/v4 draft status");
  const unexpected = v3Files.filter(
    (file) =>
      !V3_PREPARED_FILES.includes(file as (typeof V3_PREPARED_FILES)[number]),
  );
  if (unexpected.length > 0)
    fail(`capture forbidden; unexpected v3 artifacts: ${unexpected.join(",")}`);
  return failures;
}

export function verifyPivotStatus(): void {
  const status = readRepositoryJson<Record<string, any>>(PIVOT_STATUS_PATH);
  const protocol = readRepositoryJson<Record<string, any>>(
    INPUT_LIVE_V3_PROTOCOL_PATH,
  );
  const index = readRepositoryJson<Record<string, any>>(
    `${V3_ROOT}/index.json`,
  );
  const protocolHash = sha256(
    readRepositoryEvidence(INPUT_LIVE_V3_PROTOCOL_PATH),
  );
  const files = readdirSync(resolveRepositoryEvidencePath(V3_ROOT));
  const failures = validatePivotStatus(
    status,
    protocol,
    index,
    files,
    protocolHash,
  );
  for (const [dependencyPath, dependencyHash] of Object.entries(
    protocol.implementationDependencies?.sha256 ?? {},
  )) {
    if (
      typeof dependencyHash !== "string" ||
      sha256(
        execFileSync(
          "git",
          ["show", `${INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT}:${dependencyPath}`],
          { encoding: "buffer" },
        ),
      ) !== dependencyHash
    ) {
      failures.push(`v3 attempt-1 dependency hash mismatch: ${dependencyPath}`);
    }
  }
  if (
    Object.keys(protocol.implementationDependencies?.sha256 ?? {}).length === 0
  ) {
    failures.push("v3 implementation dependency denominator is zero");
  }
  for (const [dependencyPath, dependencyHash] of Object.entries(
    index.runtimeCorrection?.dependencies ?? {},
  )) {
    if (
      typeof dependencyHash !== "string" ||
      sha256(
        execFileSync(
          "git",
          [
            "show",
            `6903d31eb015933a6796722d25f6155fb13332ce:${dependencyPath}`,
          ],
          { encoding: "buffer" },
        ),
      ) !== dependencyHash
    )
      failures.push(
        `v3 correction dependency hash mismatch: ${dependencyPath}`,
      );
  }
  if (
    Object.keys(index.runtimeCorrection?.dependencies ?? {}).length === 0 ||
    index.runtimeCorrection?.nextAttempt !== null ||
    index.runtimeCorrection?.maximumAttempts !== 3 ||
    index.runtimeCorrection?.authorizationReusable !== false ||
    index.runtimeCorrection?.newAuthorizationArtifactRequired !== true
  )
    failures.push("v3 correction dependency/attempt status");
  try {
    readInputLiveV3Attempt1HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 1 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV3Attempt2HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 2 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV3Attempt3HardFailure();
  } catch (error) {
    failures.push(
      `v3 attempt 3 hard-failure evidence: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    readInputLiveV4Protocol();
  } catch (error) {
    failures.push(
      `v4 draft protocol: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    sha256(
      readRepositoryEvidence(
        "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json",
      ),
    ) !==
    "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13"
  )
    failures.push("v4 normalization fixture hash mismatch");
  for (const artifact of [
    ...status.button.supersededHistoricalArtifacts,
    ...status.input.liveV2.historicalArtifacts,
  ] as Array<{ path: string; sha256: string }>) {
    if (sha256(readRepositoryEvidence(artifact.path)) !== artifact.sha256) {
      failures.push(`historical artifact hash mismatch: ${artifact.path}`);
    }
  }
  if (failures.length > 0)
    throw new Error(`recipe pivot status invalid:\n${failures.join("\n")}`);
  process.stdout.write(
    `Recipe pivot status: ${STATUS_INDEX_STATUS}\n`,
  );
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  verifyPivotStatus();
}
