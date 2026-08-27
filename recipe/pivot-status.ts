import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V3_ATTEMPT_1_CODE_COMMIT,
  readInputLiveV3Attempt1HardFailure,
  readInputLiveV3Attempt2HardFailure,
  readInputLiveV3Attempt3HardFailure,
} from "./input-field-live-v3-evidence.js";
import {
  INPUT_LIVE_V4_ANTECEDENT_COMMIT,
  INPUT_LIVE_V4_AUTHORIZATION_PATH,
} from "./input-field-live-v4-authorization.js";
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
  "Input live v3 exhausted; v4 non-executable; v5 and v6 retired; v7 replacement authorization prepared and post-commit attestation pending; Button/Input false; human signoff pending";
const V4_PENDING_STATUS =
  "authorization artifact prepared; pending parent commit and upstream publication; capture forbidden";
const V4_FAILURE_STATUS =
  "authorization and preflight passed; committed entrypoint refused before phase 1 and writer; lineage invalid for execution";
const V4_FAILURE_PATH =
  "recipe/evidence/input-field-live-pivot-v4-failure.json";
const V4_FAILURE_SHA256 =
  "43161312f76b50cb1bd392b0ca55d8892f3af4f5bfd809ec94b944ed0e7a48ee";
const V5_ROOT = "recipe/evidence/input-field-live-pivot-v5";
const V5_STATUS =
  "authorization lineage published; execution blocked by reviewed transaction-contract defects; capture forbidden";
const V5_INDEX_STATUS = "authorization prepared uncommitted; capture forbidden";
const V5_ANTECEDENT_COMMIT = "a29d034b746d0831ce93f88f1aeb5630ad4b0453";
const V5_AUTHORIZATION_COMMIT = "7c240e7862ee4b97d9da5002c7f2a02827477413";
const V5_PROTOCOL_FIRST_ADD_COMMIT = "e9f9712a55147a4329f51cfd4bf024866dfd489f";
const V5_PROTOCOL_SHA256 =
  "6fdc4b99923aed0990a1f46fe1bdce620e2f63f0b38263983cd2da5443d9b6cf";
const V5_PLAN_SHA256 =
  "09fbdda142727a0238bb0f30721e30015cdfb714c24314d0b33d6b7b53081b10";
const V5_AUTHORIZATION_SHA256 =
  "acb54eda9a4994c9f1d7502b79d21adcaf28cca06b0566f344a9647219ff39e6";
const V6_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v6/protocol.json";
const V6_PROTOCOL_SHA256 =
  "0d79c50a4a21763eae067ff18f2ad65bc071f2fca5af7cfd4335f775c9d5e296";
const V6_BROKER_PATH = "recipe/input-field-live-v6-broker.ts";
const V6_BROKER_SHA256 =
  "d4bdd418ac56658954fbc0ed1e3d9c4ab152d016a35740cf6c34b5ce96d26e79";
const V6_CONTRACT_PATH = "recipe/input-field-live-v6-contract.ts";
const V6_CONTRACT_SHA256 =
  "11741375907f0dd69678a6ba652a9a1b00b685ae47994ee88ae34e753e52144a";
const V6_RUNNER_PATH = "recipe/run-input-field-live-v6.ts";
const V6_RUNNER_SHA256 =
  "3c2ae18d2a346eb299549244322cbbfcb97667649ae6719bf2b703a8b9285673";
const V6_TEST_PATH = "recipe/input-field-live-v6-broker.test.ts";
const V6_TEST_SHA256 =
  "c0a9504f0b03ae80b942c6acb1133b40bd8e9ff9cde35bae2e0bfe0dfa3d9cbc";
const V6_INDEX_PATH = "recipe/evidence/input-field-live-pivot-v6/index.json";
const V6_INDEX_SHA256 =
  "5f57d9425a722e23e627e66de6b6b1e73e937cae946707fffe62ffb17d24f103";
const V6_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v6/capture-authorization.json";
const V6_AUTHORIZATION_SHA256 =
  "82f7cfadd7161419b091c632c45f1f746fa1434af03b3e154ec6ca3fc288e17c";
const V6_AUTHORIZATION_LAYER_PATH =
  "recipe/input-field-live-v6-authorization.ts";
const V6_AUTHORIZATION_LAYER_SHA256 =
  "ea3ff5871ad499fbd676e9deb89f3fa22c1a2c565236de5cb8d6a04a4986c336";
const V6_PREFLIGHT_PATH = "recipe/input-field-live-v6-preflight.ts";
const V6_PREFLIGHT_SHA256 =
  "14bc407c60adf67d69ee10c63e5dfe7d06a59638d29754536428372f844224c3";
const V6_AUTHORIZATION_TEST_PATH =
  "recipe/input-field-live-v6-authorization.test.ts";
const V6_AUTHORIZATION_TEST_SHA256 =
  "640eb5af45dc184d49233fd03bf0f6b50d1a56f3b3e899ee35995e1003eaa524";
const V6_SECURITY_ATTESTATION_TEMPLATE_PATH =
  "recipe/evidence/input-field-live-pivot-v6/operator-security-attestation-template.json";
const V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 =
  "7d7f1360aa5eb37788cb74063cadab247b101ee61321a4880b95d2edaf3deec1";
const V6_PLAN_SHA256 =
  "28c22a4b86fe98e558c48278c624a229da6417b5abcbdd6587cb533197fdf199";
const V6_CAPTURE_MANIFEST_SHA256 =
  "b58506dd5bc238cafc7b346ddad6fa5d1c1178e5ec6e566f0cc799e4c43e9571";
const V6_REQUEST_MANIFEST_SHA256 =
  "03126813dfe8a9e7fa9c18db8f906d3e65c33e162bbdc768341802cddeb634b2";
const V5_SUPERSEDING_PATH =
  "recipe/evidence/input-field-live-pivot-v5-superseding-status.json";
const V5_SUPERSEDING_SHA256 =
  "df74b9d8971e1fab57c96926ccb0a65b9254861fa20b0d53107edd3a8589e8ba";
const V6_STATUS =
  "retired before live use; authorization history valid; comprehensive check phase-dependent and red";
const V6_PROTOCOL_STATUS =
  "draft uncommitted; pending separate authorization; live write and capture forbidden";
const V6_SUPERSEDING_PATH =
  "recipe/evidence/input-field-live-pivot-v6-superseding-status.json";
const V6_SUPERSEDING_SHA256 =
  "6cf34dbe952aa6163162fb85d3194743467a278c568dfc2d9bbcf8aa3ed04742";
const V7_ROOT = "recipe/evidence/input-field-live-pivot-v7";
const V7_PROTOCOL_SHA256 =
  "9d61904d916563ed50a4c1d4cefc3c6303a6586eb2d5a00a03be9b492d69b757";
const V7_PLAN_SHA256 =
  "da5e1eddf71989c6462bbf3ed14065059f9dbc10c60df08014dda6757bdc6ef7";
const V7_CAPTURE_MANIFEST_SHA256 =
  "28e0a47dcfb065c5406f2882f8d3662afee050dc84364e7f2fe04ba3f0d6b7ef";
const V7_REQUEST_MANIFEST_SHA256 =
  "3e34d59b783a98cb8b081febaafb380bf45898981f96b285e11783cca1b63397";
const V7_INDEX_SHA256 =
  "3fa459844440098aae47432ba58108eff51edc332086b2d93de795d5f192f069";
const V7_HASH_SET_SHA256 =
  "09437c70458cda74a774dfa056cd91d0ac836d73d2e1d6a8567e6fe631df5be7";
const V7_AUTHORIZATION_TEMPLATE_SHA256 =
  "b7ceb531e84d5a4002e9a4240925a15837841cc922dda4cac492e903ba07978b";
const V7_ANTECEDENT_COMMIT = "117f1cddce797393b1b705da62323615e584d54b";
const V7_FIRST_AUTHORIZATION_PATH = `${V7_ROOT}/capture-authorization.json`;
const V7_FIRST_AUTHORIZATION_SHA256 =
  "43277ff2f422c9117e2f4f1b5c0fea241cc967977666529d91e0f14fd7489fda";
const V7_AUTHORIZATION_PATH = `${V7_ROOT}/capture-authorization-v2.json`;
const V7_AUTHORIZATION_SHA256 =
  "de501693a52b0d050fc1b7048a355ca9195c3ca2ab982a28fd1b9509c397e76d";
const V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "8eb7c6f6fcd2bd497997028f8e026abc30d8af8507bc2b903347da892403dbcf";
const V7_STATUS_PATH = "recipe/evidence/input-field-live-pivot-v7-status.json";
const V4_AUTHORIZATION_COMMIT = "bd343680b446a828190f176e525e5616752f9e5f";
const V4_AUTHORIZATION_SHA256 =
  "6c0c4d772280af24b9387193a5b7723ebfff73eff9e66a89eec9d22ebd4f258b";
const V4_INDEX_PATH = "recipe/evidence/input-field-live-pivot-v4/index.json";
const V3_INDEX_STATUS = "attempt 3 hard failure; v3 permanently exhausted";
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
    status.combobox?.overallSuccess !== false ||
    status.combobox?.status !== "offline-technical-proof-ungraded" ||
    status.combobox?.recipe?.sourceReferencesRendered !== false ||
    status.combobox?.recipe?.aiGraded !== false ||
    status.combobox?.recipe?.liveFigma !== false ||
    status.combobox?.legacyContext?.variants !== 6 ||
    status.combobox?.offlineProof?.pairedCellsPlanned !== 24 ||
    status.combobox?.offlineProof?.comboboxVariants !== 64 ||
    status.combobox?.offlineProof?.optionVariants !== 8 ||
    status.combobox?.offlineProof?.components !== 72 ||
    status.combobox?.offlineProof?.instances !== 242 ||
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
    status.input?.liveV4?.status !== V4_FAILURE_STATUS ||
    status.input?.liveV4?.protocolStatus !== INPUT_LIVE_V4_STATUS ||
    status.input?.liveV4?.antecedentCommit !==
      INPUT_LIVE_V4_ANTECEDENT_COMMIT ||
    status.input?.liveV4?.protocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256 ||
    status.input?.liveV4?.normalizationFixturesSha256 !==
      "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13" ||
    status.input?.liveV4?.authorizationPath !==
      INPUT_LIVE_V4_AUTHORIZATION_PATH ||
    status.input?.liveV4?.authorizationSha256 !== V4_AUTHORIZATION_SHA256 ||
    status.input?.liveV4?.authorizationCommit !== V4_AUTHORIZATION_COMMIT ||
    status.input?.liveV4?.authorizationState !==
      "committed and published but non-executable entrypoint" ||
    status.input?.liveV4?.authorizationEstablishedOnlyByHistoryVerifier !==
      true ||
    status.input?.liveV4?.authorizationVerifierPassed !== true ||
    status.input?.liveV4?.preflightPassed !== true ||
    status.input?.liveV4?.entrypointRefusedBeforePhase1 !== true ||
    status.input?.liveV4?.writerReached !== false ||
    status.input?.liveV4?.bridgeInvocations !== 0 ||
    status.input?.liveV4?.generatedWriterPresent !== false ||
    status.input?.liveV4?.generatedTransportPresent !== false ||
    status.input?.liveV4?.phaseJournalsWritten !== 0 ||
    status.input?.liveV4?.captureArtifactsWritten !== 0 ||
    status.input?.liveV4?.figmaArtifactsCreated !== 0 ||
    status.input?.liveV4?.failureEvidencePath !== V4_FAILURE_PATH ||
    status.input?.liveV4?.failureEvidenceSha256 !== V4_FAILURE_SHA256 ||
    status.input?.liveV4?.authorizationReusableForV5 !== false ||
    status.input?.liveV4?.authorized !== false ||
    status.input?.liveV4?.liveExecutionOccurred !== false ||
    status.input?.liveV4?.attemptsExecuted !== 0 ||
    status.input?.liveV4?.nextAttempt !== null ||
    status.input?.liveV4?.humanSignoff !== "pending" ||
    status.input?.liveV5?.status !== V5_STATUS ||
    status.input?.liveV5?.antecedentCommit !== V5_ANTECEDENT_COMMIT ||
    status.input?.liveV5?.protocolFirstAddCommit !==
      V5_PROTOCOL_FIRST_ADD_COMMIT ||
    status.input?.liveV5?.protocolSha256 !== V5_PROTOCOL_SHA256 ||
    status.input?.liveV5?.writerPlanSha256 !== V5_PLAN_SHA256 ||
    status.input?.liveV5?.authorizationSha256 !== V5_AUTHORIZATION_SHA256 ||
    status.input?.liveV5?.authorizationPresent !== true ||
    status.input?.liveV5?.authorizationCommitted !== true ||
    status.input?.liveV5?.authorizationCommit !== V5_AUTHORIZATION_COMMIT ||
    status.input?.liveV5?.authorizationLineageValidAtCommit !== true ||
    status.input?.liveV5?.executionReady !== false ||
    status.input?.liveV5?.executionBlockers?.length !== 4 ||
    status.input?.liveV5?.v4AuthorizationReused !== false ||
    status.input?.liveV5?.attemptsExecuted !== 0 ||
    status.input?.liveV5?.nextAttempt !== null ||
    status.input?.liveV5?.maximumFutureAttempts !== 3 ||
    status.input?.liveV5?.liveExecutionOccurred !== false ||
    status.input?.liveV5?.captureArtifactsPresent !== false ||
    status.input?.liveV5?.outcomes !== null ||
    status.input?.liveV5?.humanSignoff !== "pending" ||
    status.input?.liveV5?.supersedingStatusPath !== V5_SUPERSEDING_PATH ||
    status.input?.liveV5?.supersedingStatusSha256 !== V5_SUPERSEDING_SHA256 ||
    status.input?.liveV5?.semanticallyRetired !== true ||
    status.input?.liveV5?.authorizationAuthorizesAttemptNow !== false ||
    status.input?.liveV6?.status !== V6_STATUS ||
    status.input?.liveV6?.antecedentCommit !==
      "8737fab9f35aeae43b25734e8f9709a4247c379b" ||
    status.input?.liveV6?.antecedentTree !==
      "1065a502feddd59ce8d11985e3f6e14365d65bfd" ||
    status.input?.liveV6?.antecedentTreeSha256 !==
      "7c93434bd6e742be7f8137af68239976b1ac226ff4d27346f52c3b86d5d5de68" ||
    status.input?.liveV6?.protocolPath !== V6_PROTOCOL_PATH ||
    status.input?.liveV6?.protocolSha256 !== V6_PROTOCOL_SHA256 ||
    status.input?.liveV6?.brokerPath !== V6_BROKER_PATH ||
    status.input?.liveV6?.brokerSha256 !== V6_BROKER_SHA256 ||
    status.input?.liveV6?.contractPath !== V6_CONTRACT_PATH ||
    status.input?.liveV6?.contractSha256 !== V6_CONTRACT_SHA256 ||
    status.input?.liveV6?.runnerPath !== V6_RUNNER_PATH ||
    status.input?.liveV6?.runnerSha256 !== V6_RUNNER_SHA256 ||
    status.input?.liveV6?.testPath !== V6_TEST_PATH ||
    status.input?.liveV6?.testSha256 !== V6_TEST_SHA256 ||
    status.input?.liveV6?.authorizationPath !== V6_AUTHORIZATION_PATH ||
    status.input?.liveV6?.authorizationSha256 !== V6_AUTHORIZATION_SHA256 ||
    status.input?.liveV6?.authorizationLayerPath !==
      V6_AUTHORIZATION_LAYER_PATH ||
    status.input?.liveV6?.authorizationLayerSha256 !==
      V6_AUTHORIZATION_LAYER_SHA256 ||
    status.input?.liveV6?.preflightPath !== V6_PREFLIGHT_PATH ||
    status.input?.liveV6?.preflightSha256 !== V6_PREFLIGHT_SHA256 ||
    status.input?.liveV6?.authorizationTestPath !==
      V6_AUTHORIZATION_TEST_PATH ||
    status.input?.liveV6?.authorizationTestSha256 !==
      V6_AUTHORIZATION_TEST_SHA256 ||
    status.input?.liveV6?.operatorSecurityAttestationTemplatePath !==
      V6_SECURITY_ATTESTATION_TEMPLATE_PATH ||
    status.input?.liveV6?.operatorSecurityAttestationTemplateSha256 !==
      V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 ||
    status.input?.liveV6?.signingPublicKeySpkiSha256 !==
      "c5d04bf950dea3e1b62a2a274031677546e9c24bbee4cabb64773d0f1a7b3ac4" ||
    status.input?.liveV6?.evidenceIndexPath !== V6_INDEX_PATH ||
    status.input?.liveV6?.evidenceIndexSha256 !== V6_INDEX_SHA256 ||
    status.input?.liveV6?.proofPlanSha256 !== V6_PLAN_SHA256 ||
    status.input?.liveV6?.captureManifestSha256 !==
      V6_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV6?.requestManifestSha256 !==
      V6_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV6?.supportedSeparateStdioMcpClientTransport !== true ||
    status.input?.liveV6?.cursorDynamicToolDirectlyCallableFromNode !== false ||
    status.input?.liveV6?.externalOperatorOnly !== true ||
    status.input?.liveV6?.sourceRoots !== 2 ||
    status.input?.liveV6?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV6?.variantProbes !== 256 ||
    status.input?.liveV6?.captureCells !== 128 ||
    status.input?.liveV6?.remoteRequests !== 132 ||
    status.input?.liveV6?.hostPhases !== 3 ||
    status.input?.liveV6?.cleanupRequestPersistedAfterWriter !== true ||
    status.input?.liveV6?.authorizationPresent !== true ||
    status.input?.liveV6?.authorizationCommitted !== true ||
    status.input?.liveV6?.authorizationEffective !== false ||
    status.input?.liveV6?.beforeCommitGate !==
      "historical antecedent phase only" ||
    status.input?.liveV6?.authorizationCommit !==
      "e5d6814982cbbe498ed630e7d988eae10bcb5d77" ||
    status.input?.liveV6?.authorizationHistoryValid !== true ||
    status.input?.liveV6?.comprehensiveCheckGreenPostAuthorization !== false ||
    status.input?.liveV6?.phaseSensitiveSelfTestDefect !== true ||
    status.input?.liveV6?.semanticallyRetired !== true ||
    status.input?.liveV6?.retiredBeforeLiveUse !== true ||
    status.input?.liveV6?.supersedingStatusPath !== V6_SUPERSEDING_PATH ||
    status.input?.liveV6?.supersedingStatusSha256 !== V6_SUPERSEDING_SHA256 ||
    status.input?.liveV6?.authorized !== false ||
    status.input?.liveV6?.security?.status !==
      "blocked-pending-user-account-action" ||
    status.input?.liveV6?.security?.exposedFigmaPatRevokedOrReplaced !==
      false ||
    status.input?.liveV6?.security?.rotationClaimed !== false ||
    status.input?.liveV6?.security?.mcpProcessesRestartedAfterRotation !==
      false ||
    status.input?.liveV6?.security
      ?.ownerOnlyEnvironmentFileConfigurationRequired !== true ||
    status.input?.liveV6?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV6?.security?.currentRepositorySecretScanMatches !== 0 ||
    status.input?.liveV6?.security
      ?.currentRepositorySecretScanEstablishesRotation !== false ||
    status.input?.liveV6?.security?.credentialDataStored !== false ||
    status.input?.liveV6?.attemptsExecuted !== 0 ||
    status.input?.liveV6?.nextAttempt !== null ||
    status.input?.liveV6?.maximumAttempts !== 3 ||
    status.input?.liveV6?.humanSignoff !== "pending" ||
    status.input?.liveV6?.liveExecutionOccurred !== false ||
    status.input?.liveV6?.figmaWrites !== 0 ||
    status.input?.liveV6?.figmaCaptures !== 0 ||
    status.input?.liveV6?.outcomes !== null ||
    status.input?.liveV6?.overallInputSuccess !== false ||
    status.input?.liveV7?.status !==
      "replacement authorization prepared; post-commit attestation pending; live execution forbidden" ||
    status.input?.liveV7?.baseCommit !==
      "41e34588ec78fa0b1cb5a75c3b77b96b82680576" ||
    status.input?.liveV7?.antecedentCommit !== V7_ANTECEDENT_COMMIT ||
    status.input?.liveV7?.protocolSha256 !== V7_PROTOCOL_SHA256 ||
    status.input?.liveV7?.proofPlanSha256 !== V7_PLAN_SHA256 ||
    status.input?.liveV7?.captureManifestSha256 !==
      V7_CAPTURE_MANIFEST_SHA256 ||
    status.input?.liveV7?.requestManifestSha256 !==
      V7_REQUEST_MANIFEST_SHA256 ||
    status.input?.liveV7?.antecedentIndexSha256 !== V7_INDEX_SHA256 ||
    status.input?.liveV7?.antecedentHashSetSha256 !== V7_HASH_SET_SHA256 ||
    status.input?.liveV7?.authorizationTemplateSha256 !==
      V7_AUTHORIZATION_TEMPLATE_SHA256 ||
    status.input?.liveV7?.authorizationPresent !== true ||
    status.input?.liveV7?.authorizationCommitStateDerivedByHistory !== true ||
    status.input?.liveV7?.authorizationEffective !== false ||
    status.input?.liveV7?.firstAuthorizationPath !==
      V7_FIRST_AUTHORIZATION_PATH ||
    status.input?.liveV7?.firstAuthorizationSha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    status.input?.liveV7?.firstAuthorizationBytesPreserved !== true ||
    status.input?.liveV7?.firstAuthorizationUsableForExecution !== false ||
    status.input?.liveV7?.firstAuthorizationSupersededReason !==
      "signer private key unavailable" ||
    status.input?.liveV7?.authorizationPath !== V7_AUTHORIZATION_PATH ||
    status.input?.liveV7?.authorizationSha256 !== V7_AUTHORIZATION_SHA256 ||
    status.input?.liveV7?.signingPublicKeySpkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    status.input?.liveV7?.precommitHistoryState !== "pending-v2" ||
    status.input?.liveV7?.historyExpectedModeAfterAuthorizationCommit !==
      "--expect-authorized-v2" ||
    status.input?.liveV7?.authorizationLifecycleExcludedFromAntecedentHash !==
      true ||
    status.input?.liveV7?.authorizationCanBeAddedWithoutAntecedentRebuild !==
      true ||
    status.input?.liveV7?.sourceRoots !== 2 ||
    status.input?.liveV7?.expectedSceneFacts !== 43_726 ||
    status.input?.liveV7?.captureCells !== 128 ||
    status.input?.liveV7?.remoteRequests !== 132 ||
    status.input?.liveV7?.hostPhases !== 3 ||
    status.input?.liveV7?.requestSignature !== "Ed25519" ||
    status.input?.liveV7?.captureBeforeTechnicalGates !== false ||
    status.input?.liveV7?.security?.figmaPatRevokedOrReplacedRequired !==
      true ||
    status.input?.liveV7?.security?.replacementPatActiveForProject !== true ||
    status.input?.liveV7?.security?.oldTokenRevoked !== false ||
    status.input?.liveV7?.security?.ownerRiskAcceptance !== true ||
    status.input?.liveV7?.security?.figmaPatRevokedOrReplaced !== true ||
    status.input?.liveV7?.security?.mcpRestartAfterRotationRequired !== true ||
    status.input?.liveV7?.security?.mcpRestartedAfterRotation !== true ||
    status.input?.liveV7?.security?.ownerOnlyEnvironmentFileMode0600Required !==
      true ||
    status.input?.liveV7?.security?.ownerOnlyEnvironmentFilesMode0600 !==
      true ||
    status.input?.liveV7?.security?.repositorySecretScanZeroRequired !== true ||
    status.input?.liveV7?.security?.repositorySecretScanZero !== true ||
    status.input?.liveV7?.security?.exactScratchReadOnlyProbeRequired !==
      true ||
    status.input?.liveV7?.security?.exactScratchBridgeProbePassed !== true ||
    status.input?.liveV7?.security?.exactScratchRestProbePassed !== true ||
    status.input?.liveV7?.security?.tokenValuesForbidden !== true ||
    status.input?.liveV7?.security?.liveExecutionForbidden !== true ||
    status.input?.liveV7?.attemptsExecuted !== 0 ||
    status.input?.liveV7?.nextAttempt !== 1 ||
    status.input?.liveV7?.maximumFutureAttempts !== 3 ||
    status.input?.liveV7?.liveExecutionOccurred !== false ||
    status.input?.liveV7?.figmaWrites !== 0 ||
    status.input?.liveV7?.figmaCaptures !== 0 ||
    status.input?.liveV7?.humanSignoff !== "pending" ||
    status.input?.liveV7?.overallInputSuccess !== false
  )
    fail("v3 exhausted/v4-v7 current status");
  const unexpected = v3Files.filter(
    (file) =>
      !V3_PREPARED_FILES.includes(file as (typeof V3_PREPARED_FILES)[number]),
  );
  if (unexpected.length > 0)
    fail(`capture forbidden; unexpected v3 artifacts: ${unexpected.join(",")}`);
  return failures;
}

export function validateInputLiveV4PendingStatus(
  index: Record<string, any>,
  authorizationHash: string,
): string[] {
  const failures: string[] = [];
  if (
    index.artifactVersion !== "input-live-v4-index-v1" ||
    index.status !== V4_PENDING_STATUS ||
    index.antecedent?.commit !== INPUT_LIVE_V4_ANTECEDENT_COMMIT ||
    index.antecedent?.protocolPath !==
      "recipe/evidence/input-field-live-pivot-v4/protocol.json" ||
    index.antecedent?.protocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256
  )
    failures.push("v4 pending index identity/antecedent");
  if (
    authorizationHash !== V4_AUTHORIZATION_SHA256 ||
    index.authorization?.path !== INPUT_LIVE_V4_AUTHORIZATION_PATH ||
    index.authorization?.sha256 !== authorizationHash ||
    index.authorization?.firstAddCommit !== null ||
    index.authorization?.committed !== false ||
    index.authorization?.upstreamPublished !== false ||
    index.authorization?.authorized !== false ||
    index.authorization?.discoveredAfterCommit !== true
  )
    failures.push("v4 pending-uncommitted authorization status");
  if (
    index.attempts?.executed !== 0 ||
    index.attempts?.next !== 1 ||
    index.attempts?.maximum !== 3 ||
    index.attempts?.v3AttemptsDoNotCarryForward !== true ||
    index.liveExecutionOccurred !== false ||
    index.captureArtifactsPresent !== false ||
    index.protocolCriteriaAltered !== false ||
    index.humanSignoff !== "pending" ||
    index.overallInputSuccess !== false
  )
    failures.push("v4 pending attempts/results/signoff status");
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
  const v4Index = readRepositoryJson<Record<string, any>>(V4_INDEX_PATH);
  const v5Index = readRepositoryJson<Record<string, any>>(
    `${V5_ROOT}/index.json`,
  );
  const v6Protocol = readRepositoryJson<Record<string, any>>(V6_PROTOCOL_PATH);
  const v6Index = readRepositoryJson<Record<string, any>>(V6_INDEX_PATH);
  const v6Superseding =
    readRepositoryJson<Record<string, any>>(V6_SUPERSEDING_PATH);
  const v7Protocol = readRepositoryJson<Record<string, any>>(
    `${V7_ROOT}/protocol.json`,
  );
  const v7Index = readRepositoryJson<Record<string, any>>(
    `${V7_ROOT}/antecedent-index.json`,
  );
  const v7Status = readRepositoryJson<Record<string, any>>(V7_STATUS_PATH);
  const v5Superseding =
    readRepositoryJson<Record<string, any>>(V5_SUPERSEDING_PATH);
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
  failures.push(
    ...validateInputLiveV4PendingStatus(
      v4Index,
      sha256(readRepositoryEvidence(INPUT_LIVE_V4_AUTHORIZATION_PATH)),
    ),
  );
  if (
    sha256(readRepositoryEvidence(V4_FAILURE_PATH)) !== V4_FAILURE_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/protocol.json`)) !==
      V5_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/writer-plan.json`)) !==
      V5_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V5_ROOT}/capture-authorization.json`)) !==
      V5_AUTHORIZATION_SHA256
  )
    failures.push("v4 failure or v5 draft evidence hash mismatch");
  if (
    sha256(readRepositoryEvidence(V6_PROTOCOL_PATH)) !== V6_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(V6_BROKER_PATH)) !== V6_BROKER_SHA256 ||
    sha256(readRepositoryEvidence(V6_TEST_PATH)) !== V6_TEST_SHA256 ||
    sha256(readRepositoryEvidence(V6_CONTRACT_PATH)) !== V6_CONTRACT_SHA256 ||
    sha256(readRepositoryEvidence(V6_RUNNER_PATH)) !== V6_RUNNER_SHA256 ||
    sha256(readRepositoryEvidence(V6_INDEX_PATH)) !== V6_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_PATH)) !==
      V6_AUTHORIZATION_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_LAYER_PATH)) !==
      V6_AUTHORIZATION_LAYER_SHA256 ||
    sha256(readRepositoryEvidence(V6_PREFLIGHT_PATH)) !== V6_PREFLIGHT_SHA256 ||
    sha256(readRepositoryEvidence(V6_AUTHORIZATION_TEST_PATH)) !==
      V6_AUTHORIZATION_TEST_SHA256 ||
    sha256(readRepositoryEvidence(V6_SECURITY_ATTESTATION_TEMPLATE_PATH)) !==
      V6_SECURITY_ATTESTATION_TEMPLATE_SHA256 ||
    sha256(readRepositoryEvidence(V5_SUPERSEDING_PATH)) !==
      V5_SUPERSEDING_SHA256 ||
    sha256(readRepositoryEvidence(V6_SUPERSEDING_PATH)) !==
      V6_SUPERSEDING_SHA256 ||
    v6Protocol.artifactVersion !==
      "input-live-v6-external-operator-protocol-draft-v1" ||
    v6Protocol.status !== V6_PROTOCOL_STATUS ||
    v6Protocol.authorization?.authorized !== false ||
    v6Protocol.authorization?.liveExecutionPermitted !== false ||
    v6Protocol.authorization?.maximumAttempts !== 3 ||
    v6Protocol.operatorBoundary?.expectedDynamicTool?.namespace !==
      "user-Figma Console" ||
    v6Protocol.operatorBoundary?.expectedDynamicTool?.tool !==
      "figma_execute" ||
    v6Protocol.authorization?.exactScratchOnly?.fileKey !==
      "byMp6lt0Ij9b2QbkDGFwBh" ||
    v6Protocol.execution?.remoteRequests !== 132 ||
    v6Protocol.execution?.hostPhases !== 3 ||
    v6Protocol.hostNormalizationAndAccounting?.perSource !== true ||
    v6Protocol.captureObjective?.plannedCells !== 128 ||
    v6Protocol.captureObjective?.capturesPerformedByThisAntecedentTask !== 0 ||
    v6Protocol.offlineSimulation?.figmaCalls !== 0 ||
    v6Protocol.outcomes !== null ||
    v6Protocol.overallInputSuccess !== false ||
    v6Index.artifactVersion !== "input-live-v6-evidence-index-v1" ||
    v6Index.counts?.sources !== 2 ||
    v6Index.counts?.expectedSceneFacts !== 43_726 ||
    v6Index.counts?.captureCells !== 128 ||
    v6Index.counts?.remoteRequests !== 132 ||
    v6Index.counts?.hostPhases !== 3 ||
    v6Index.status !==
      "authorization-prepared-uncommitted; security-blocked; live execution forbidden; no live outcomes" ||
    v6Index.authorizationPresent !== true ||
    v6Index.authorizationCommitted !== false ||
    v6Index.authorizationEffective !== false ||
    v6Index.authorizationPath !== V6_AUTHORIZATION_PATH ||
    v6Index.authorizationSha256 !== V6_AUTHORIZATION_SHA256 ||
    v6Index.security?.rotationCompleted !== false ||
    v6Index.security?.mcpRestartCompleted !== false ||
    v6Index.security?.liveExecutionForbidden !== true ||
    v6Index.security?.currentRepositorySecretScanMatches !== 0 ||
    v6Index.security?.tokenValuesStored !== false ||
    v6Index.outcomes !== null ||
    v5Superseding.artifactVersion !== "input-live-v5-superseding-status-v1" ||
    v5Superseding.authorization?.bytesChanged !== false ||
    v5Superseding.authorization?.authorizesAttemptNow !== false ||
    v5Superseding.blockers?.length !== 4 ||
    v5Superseding.attemptsExecuted !== 0 ||
    v5Superseding.outcomes !== null ||
    v6Superseding.artifactVersion !== "input-live-v6-superseding-status-v1" ||
    v6Superseding.retiredBeforeLiveUse !== true ||
    v6Superseding.authorizationHistory?.authorizationCommit !==
      "e5d6814982cbbe498ed630e7d988eae10bcb5d77" ||
    v6Superseding.authorizationHistory?.valid !== true ||
    v6Superseding.preserved?.protocol?.sha256 !== V6_PROTOCOL_SHA256 ||
    v6Superseding.preserved?.authorization?.sha256 !==
      V6_AUTHORIZATION_SHA256 ||
    v6Superseding.preserved?.index?.sha256 !== V6_INDEX_SHA256 ||
    v6Superseding.retirementReason?.defectClass !==
      "non-hermetic phase-sensitive self-test" ||
    v6Superseding.attemptsExecuted !== 0 ||
    v6Superseding.liveAttemptAuthorized !== false
  )
    failures.push("v6 broker protocol/status overclaim or hash mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v6Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v6 indexed artifact hash mismatch: ${artifactPath}`);
  }
  const v7AuthorizationPath = resolveRepositoryEvidencePath(
    V7_AUTHORIZATION_PATH,
  );
  const v7FirstAuthorizationPath = resolveRepositoryEvidencePath(
    V7_FIRST_AUTHORIZATION_PATH,
  );
  const v7Authorization = readRepositoryJson<Record<string, any>>(
    V7_AUTHORIZATION_PATH,
  );
  const v7Serialized = JSON.stringify([v7Protocol, v7Index, v7Status]);
  if (
    sha256(readRepositoryEvidence(`${V7_ROOT}/protocol.json`)) !==
      V7_PROTOCOL_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/proof-plan.json`)) !==
      V7_PLAN_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/capture-manifest.json`)) !==
      V7_CAPTURE_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/request-manifest.json`)) !==
      V7_REQUEST_MANIFEST_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/antecedent-index.json`)) !==
      V7_INDEX_SHA256 ||
    sha256(readRepositoryEvidence(`${V7_ROOT}/authorization-template.json`)) !==
      V7_AUTHORIZATION_TEMPLATE_SHA256 ||
    v7Protocol.artifactVersion !==
      "input-live-v7-external-operator-protocol-v1" ||
    v7Protocol.lifecycle?.authorizationExcludedFromAntecedentFreshness !==
      true ||
    v7Protocol.lifecycle?.laterAuthorizationDoesNotRecomputeAntecedent !==
      true ||
    v7Protocol.lifecycle?.v6AuthorizationReusable !== false ||
    v7Protocol.execution?.remoteRequests !== 132 ||
    v7Protocol.execution?.attemptsExecuted !== 0 ||
    v7Protocol.proof?.roots !== 2 ||
    v7Protocol.proof?.expectedFacts !== 43_726 ||
    v7Protocol.proof?.captures !== 128 ||
    v7Protocol.proof?.captureBeforeHashBoundTechnicalGates !== false ||
    v7Protocol.proof?.humanSignoffMandatory !== true ||
    v7Protocol.futureAuthorizationPrerequisites?.figmaPatRevokedOrReplaced !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.mcpRestartedAfterRotation !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites
      ?.ownerOnlyEnvironmentFileMode0600 !== true ||
    v7Protocol.futureAuthorizationPrerequisites?.repositorySecretScanZero !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.exactScratchReadOnlyProbe !==
      true ||
    v7Protocol.futureAuthorizationPrerequisites?.tokenValuesForbidden !==
      true ||
    v7Index.artifactVersion !== "input-live-v7-antecedent-index-v1" ||
    v7Index.hashSetSha256 !== V7_HASH_SET_SHA256 ||
    v7Index.counts?.expectedSceneFacts !== 43_726 ||
    v7Index.counts?.remoteRequests !== 132 ||
    v7Index.authorizationCanBeAddedWithoutAntecedentRebuild !== true ||
    v7Status.artifactVersion !== "input-live-v7-status-v2" ||
    v7Status.status !==
      "replacement authorization prepared; post-commit attestation pending; live execution forbidden" ||
    v7Status.antecedent?.commit !== V7_ANTECEDENT_COMMIT ||
    v7Status.authorization?.present !== true ||
    v7Status.authorization?.commitStateDerivedByHistory !== true ||
    v7Status.authorization?.effective !== false ||
    v7Status.authorization?.firstAuthorization?.path !==
      V7_FIRST_AUTHORIZATION_PATH ||
    v7Status.authorization?.firstAuthorization?.sha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    v7Status.authorization?.firstAuthorization?.bytesPreserved !== true ||
    v7Status.authorization?.firstAuthorization?.usableForExecution !== false ||
    v7Status.authorization?.replacementPath !== V7_AUTHORIZATION_PATH ||
    v7Status.authorization?.replacementSha256 !== V7_AUTHORIZATION_SHA256 ||
    v7Status.authorization?.replacementSigningPublicKeySpkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v7Status.authorization?.precommitHistoryState !== "pending-v2" ||
    v7Status.securityPrerequisites?.status !==
      "current read-only facts verified; post-commit attestation pending" ||
    v7Status.securityPrerequisites?.replacementPatActiveForProject !== true ||
    v7Status.securityPrerequisites?.oldTokenRevoked !== false ||
    v7Status.securityPrerequisites?.ownerRiskAcceptance !== true ||
    v7Status.securityPrerequisites?.figmaPatRevokedOrReplaced !== true ||
    v7Status.securityPrerequisites?.mcpRestartedAfterRotation !== true ||
    v7Status.securityPrerequisites?.ownerOnlyEnvironmentFilesMode0600 !==
      true ||
    v7Status.securityPrerequisites?.repositorySecretScanZero !== true ||
    v7Status.securityPrerequisites?.exactScratchBridgeProbePassed !== true ||
    v7Status.securityPrerequisites?.exactScratchRestProbePassed !== true ||
    v7Status.attemptsExecuted !== 0 ||
    v7Status.maximumFutureAttempts !== 3 ||
    v7Status.liveExecutionOccurred !== false ||
    /"(?:outcome|outcomes|result|results|measurement|observed|score|winner)"\s*:/.test(
      v7Serialized,
    ) ||
    !existsSync(v7AuthorizationPath) ||
    !existsSync(v7FirstAuthorizationPath) ||
    sha256(readRepositoryEvidence(V7_FIRST_AUTHORIZATION_PATH)) !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    sha256(readRepositoryEvidence(V7_AUTHORIZATION_PATH)) !==
      V7_AUTHORIZATION_SHA256 ||
    v7Authorization.artifactVersion !==
      "input-live-v7-capture-authorization-v2" ||
    v7Authorization.authorizationId !== "input-live-v7" ||
    v7Authorization.antecedent?.commit !== V7_ANTECEDENT_COMMIT ||
    v7Authorization.antecedent?.indexSha256 !== V7_INDEX_SHA256 ||
    v7Authorization.antecedent?.hashSetSha256 !== V7_HASH_SET_SHA256 ||
    v7Authorization.signingPublicKey?.spkiSha256 !==
      V7_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    v7Authorization.supersession?.supersedesPath !==
      V7_FIRST_AUTHORIZATION_PATH ||
    v7Authorization.supersession?.supersedesSha256 !==
      V7_FIRST_AUTHORIZATION_SHA256 ||
    v7Authorization.supersession?.firstAuthorizationUsableForExecution !==
      false ||
    v7Authorization.supersession?.criteriaChanged !== false ||
    v7Authorization.execution?.v6AuthorizationReusable !== false ||
    v7Authorization.humanSignoff?.status !== "pending"
  )
    failures.push("v7 antecedent/status lifecycle or hash mismatch");
  for (const [artifactPath, metadata] of Object.entries(
    v7Index.artifacts ?? {},
  ) as Array<[string, { bytes: number; sha256: string }]>) {
    const artifact = readRepositoryEvidence(artifactPath);
    if (
      artifact.byteLength !== metadata.bytes ||
      sha256(artifact) !== metadata.sha256
    )
      failures.push(`v7 indexed artifact hash mismatch: ${artifactPath}`);
    if (
      artifactPath.includes("input-field-live-v7-authorization") ||
      artifactPath.includes("input-field-live-v7-preflight") ||
      artifactPath.includes("input-field-live-v7-authorized") ||
      artifactPath.endsWith("capture-authorization.json") ||
      artifactPath.endsWith("status-index.json")
    )
      failures.push(`v7 authorization lifecycle indexed: ${artifactPath}`);
  }
  if (
    v5Index.artifactVersion !== "input-live-v5-index-v1" ||
    v5Index.status !== V5_INDEX_STATUS ||
    v5Index.antecedent?.executableCommit !== V5_ANTECEDENT_COMMIT ||
    v5Index.antecedent?.protocolFirstAddCommit !==
      V5_PROTOCOL_FIRST_ADD_COMMIT ||
    v5Index.protocol?.sha256 !== V5_PROTOCOL_SHA256 ||
    v5Index.authorization?.sha256 !== V5_AUTHORIZATION_SHA256 ||
    v5Index.authorization?.present !== true ||
    v5Index.authorization?.committed !== false ||
    v5Index.authorization?.authorized !== false ||
    v5Index.authorization?.v4AuthorizationReusable !== false ||
    v5Index.attempts?.executed !== 0 ||
    v5Index.attempts?.next !== 1 ||
    v5Index.attempts?.maximum !== 3 ||
    v5Index.liveExecutionOccurred !== false ||
    v5Index.captureArtifactsPresent !== false ||
    v5Index.outcomes !== null ||
    v5Index.humanSignoff !== "pending" ||
    v5Index.overallInputSuccess !== false
  )
    failures.push("v5 draft authorization/attempt/status overclaim");
  for (const artifact of [
    v5Index.authorization,
    v5Index.generated?.writer,
    v5Index.generated?.transportEnvelope,
    v5Index.generated?.transportWrapper,
    v5Index.generated?.writerPlan,
    v5Index.generated?.conformance,
    ...(v5Index.generated?.expectedScenePlans ?? []),
  ] as Array<{ path: string; sha256: string }>) {
    if (
      !artifact?.path ||
      !artifact.sha256 ||
      sha256(readRepositoryEvidence(artifact.path)) !== artifact.sha256
    )
      failures.push(`v5 generated artifact hash mismatch: ${artifact?.path}`);
  }
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
    ) !== "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13"
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
  process.stdout.write(`Recipe pivot status: ${STATUS_INDEX_STATUS}\n`);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  verifyPivotStatus();
}
