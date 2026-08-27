import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256,
  INPUT_LIVE_V6_AUTHORIZATION_PATH,
  INPUT_LIVE_V6_SECURITY_ATTESTATION_DEFAULT_PATH,
  INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH,
  INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256,
  inputLiveV6PrivateMaterialPaths,
  verifyInputLiveV6Authorization,
  type InputLiveV6AuthorizationProof,
} from "./input-field-live-v6-authorization.js";
import {
  INPUT_LIVE_V6_DYNAMIC_TOOL,
  INPUT_LIVE_V6_TARGET,
} from "./input-field-live-v6-broker.js";
import { canonicalJson } from "./normalize.js";

const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const time = (value: unknown): number =>
  typeof value === "string" ? Date.parse(value) : Number.NaN;

export interface InputLiveV6SecurityAttestation {
  artifactVersion: "input-live-v6-operator-security-attestation-v1";
  status: "complete";
  createdAt: string;
  rotation: {
    completedAt: string;
    completedByUserAssertion: true;
    credentialType: "Figma personal access token";
    exposedCredentialRevokedOrReplaced: true;
    tokenValueStored: false;
  };
  mcpRestart: {
    completedAt: string;
    completedAfterRotation: true;
    sessionIdentity: string;
    sessionIdentityContainsSecrets: false;
    ownerOnlyEnvironmentFileConfigured: true;
    environmentFileMode: "0600";
    tokenValueStored: false;
  };
  scratchReadOnlyProbe: {
    completedAt: string;
    completedAfterMcpRestart: true;
    target: typeof INPUT_LIVE_V6_TARGET;
    readOnly: true;
    probe: "exact file key, file name, and editor type";
    result: "passed";
    figmaWrites: 0;
    figmaCaptures: 0;
  };
  plaintextHelpers: {
    pathsPresent: false;
    paths: [];
    confirmedAbsent: true;
  };
  repositorySecretScan: {
    completedAt: string;
    codeCommit: string;
    scope: "tracked and untracked repository files";
    scanner: "input-live-v6-preflight-v1";
    matches: 0;
    zero: true;
  };
  tokenValuesStored: false;
  attestationSha256: string;
}

export const inputLiveV6AttestationSha256 = (
  value: Omit<InputLiveV6SecurityAttestation, "attestationSha256">,
): string => sha256(canonicalJson(value));

export function validateInputLiveV6SecurityAttestation(
  value: unknown,
  proof: InputLiveV6AuthorizationProof,
): string[] {
  const failures: string[] = [];
  const artifact =
    value !== null && typeof value === "object"
      ? (value as Record<string, any>)
      : {};
  const { attestationSha256, ...body } = artifact;
  const rotationAt = time(artifact.rotation?.completedAt);
  const restartAt = time(artifact.mcpRestart?.completedAt);
  const probeAt = time(artifact.scratchReadOnlyProbe?.completedAt);
  const scanAt = time(artifact.repositorySecretScan?.completedAt);
  const createdAt = time(artifact.createdAt);
  if (
    artifact.artifactVersion !==
      "input-live-v6-operator-security-attestation-v1" ||
    artifact.status !== "complete"
  )
    failures.push("missing completed v6 security attestation");
  if (
    !Number.isFinite(rotationAt) ||
    artifact.rotation?.completedByUserAssertion !== true ||
    artifact.rotation?.credentialType !== "Figma personal access token" ||
    artifact.rotation?.exposedCredentialRevokedOrReplaced !== true ||
    artifact.rotation?.tokenValueStored !== false
  )
    failures.push("Figma PAT rotation/revocation user assertion missing");
  if (
    !Number.isFinite(restartAt) ||
    restartAt < rotationAt ||
    artifact.mcpRestart?.completedAfterRotation !== true ||
    typeof artifact.mcpRestart?.sessionIdentity !== "string" ||
    artifact.mcpRestart.sessionIdentity.length < 8 ||
    artifact.mcpRestart?.sessionIdentityContainsSecrets !== false ||
    artifact.mcpRestart?.ownerOnlyEnvironmentFileConfigured !== true ||
    artifact.mcpRestart?.environmentFileMode !== "0600" ||
    artifact.mcpRestart?.tokenValueStored !== false
  )
    failures.push(
      "post-rotation MCP restart or owner-only env-file assertion missing",
    );
  if (
    !Number.isFinite(probeAt) ||
    probeAt < restartAt ||
    artifact.scratchReadOnlyProbe?.completedAfterMcpRestart !== true ||
    JSON.stringify(artifact.scratchReadOnlyProbe?.target) !==
      JSON.stringify(INPUT_LIVE_V6_TARGET) ||
    artifact.scratchReadOnlyProbe?.readOnly !== true ||
    artifact.scratchReadOnlyProbe?.probe !==
      "exact file key, file name, and editor type" ||
    artifact.scratchReadOnlyProbe?.result !== "passed" ||
    artifact.scratchReadOnlyProbe?.figmaWrites !== 0 ||
    artifact.scratchReadOnlyProbe?.figmaCaptures !== 0
  )
    failures.push(
      "exact Scratch read-only post-restart probe missing or unsafe",
    );
  if (
    artifact.plaintextHelpers?.pathsPresent !== false ||
    !Array.isArray(artifact.plaintextHelpers?.paths) ||
    artifact.plaintextHelpers.paths.length !== 0 ||
    artifact.plaintextHelpers?.confirmedAbsent !== true
  )
    failures.push("plaintext helper paths are present or not attested absent");
  if (
    !Number.isFinite(scanAt) ||
    scanAt < rotationAt ||
    artifact.repositorySecretScan?.codeCommit !== proof.codeCommit ||
    artifact.repositorySecretScan?.scope !==
      "tracked and untracked repository files" ||
    artifact.repositorySecretScan?.scanner !== "input-live-v6-preflight-v1" ||
    artifact.repositorySecretScan?.matches !== 0 ||
    artifact.repositorySecretScan?.zero !== true
  )
    failures.push(
      "current repository secret scan is missing, stale, or nonzero",
    );
  if (
    !Number.isFinite(createdAt) ||
    createdAt < Math.max(rotationAt, restartAt, probeAt, scanAt)
  )
    failures.push(
      "security attestation was not created after all rotation gates",
    );
  if (
    artifact.tokenValuesStored !== false ||
    inputLiveV6PrivateMaterialPaths(artifact).length > 0
  )
    failures.push(
      "security attestation contains private material or token values",
    );
  if (
    !SHA256.test(attestationSha256) ||
    attestationSha256 !== sha256(canonicalJson(body))
  )
    failures.push("security attestation hash mismatch");
  return failures;
}

export function validateInputLiveV6ControlFlowSource(source: string): string[] {
  const failures: string[] = [];
  const authorization = source.indexOf("verifyInputLiveV6Authorization");
  const preflight = source.indexOf("runInputLiveV6Preflight");
  const initialize = source.indexOf("InputLiveV6Orchestrator.initialize");
  if (
    authorization < 0 ||
    preflight < 0 ||
    initialize < 0 ||
    authorization > initialize ||
    preflight > initialize
  )
    failures.push(
      "live initialization is reachable before authorization/preflight",
    );
  if (!source.includes("--security-attestation"))
    failures.push("runner omits required security attestation argument");
  if (!source.includes("--private-key"))
    failures.push("runner omits external private signing key argument");
  return failures;
}

export interface InputLiveV6PreflightReport {
  artifactVersion: "input-live-v6-preflight-v1";
  authorizationMode: "live";
  authorizationCommit: string;
  codeCommit: string;
  securityAttestationSha256: string;
  signingPublicKeySha256: string;
  target: typeof INPUT_LIVE_V6_TARGET;
  expectedDynamicTool: typeof INPUT_LIVE_V6_DYNAMIC_TOOL;
  attempt: number;
  completedAttempts: number[];
  remoteRequests: 132;
  hostPhases: 3;
  sourceRoots: 2;
  expectedSceneFacts: 43726;
  captures: 128;
  capture: false;
}

const WORKING_ANTECEDENT_PATHS = Object.keys(
  INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256,
).filter(
  (artifactPath) =>
    ![
      "recipe/input-field-live-v6-broker.ts",
      "recipe/run-input-field-live-v6.ts",
      "recipe/build-input-field-live-proof-v6.ts",
    ].includes(artifactPath),
);
const ANTECEDENT_HASHES: Readonly<Record<string, string>> =
  INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256;

export function runInputLiveV6Preflight(
  root: string,
  proof: InputLiveV6AuthorizationProof,
  attestationPath = INPUT_LIVE_V6_SECURITY_ATTESTATION_DEFAULT_PATH,
  attempt = 1,
  completedAttempts: readonly number[] = [],
): InputLiveV6PreflightReport {
  const failures: string[] = [];
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > 3 ||
    attempt !== completedAttempts.length + 1 ||
    completedAttempts.some((value, index) => value !== index + 1)
  )
    failures.push("v6 attempt chronology invalid or exceeds maximum 3");
  if (
    proof.mode !== "live" ||
    JSON.stringify(proof.target) !== JSON.stringify(INPUT_LIVE_V6_TARGET) ||
    JSON.stringify(proof.expectedDynamicTool) !==
      JSON.stringify(INPUT_LIVE_V6_DYNAMIC_TOOL) ||
    proof.signingPublicKeySha256 !==
      INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256
  )
    failures.push(
      "v6 authorization proof target, tool, or signing key mismatch",
    );
  for (const relativePath of WORKING_ANTECEDENT_PATHS) {
    const absolutePath = path.join(root, relativePath);
    if (
      !existsSync(absolutePath) ||
      sha256(readFileSync(absolutePath)) !== ANTECEDENT_HASHES[relativePath]
    )
      failures.push(
        `v6 pinned antecedent working bytes drift: ${relativePath}`,
      );
  }
  const authorization = JSON.parse(
    readFileSync(path.join(root, INPUT_LIVE_V6_AUTHORIZATION_PATH), "utf8"),
  ) as Record<string, any>;
  if (
    authorization.denominator?.remoteRequests !== 132 ||
    authorization.denominator?.hostPhases !== 3 ||
    authorization.denominator?.captures !== 128 ||
    authorization.twoRootFacts?.roots !== 2 ||
    authorization.twoRootFacts?.expectedFacts !== 43_726 ||
    authorization.execution?.captureBeforeHashBoundTechnicalGates !== false ||
    authorization.execution
      ?.durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance !== true
  )
    failures.push(
      "v6 authorization denominator or capture/cleanup gates drifted",
    );
  const securityPath = path.resolve(root, attestationPath);
  if (!existsSync(securityPath)) {
    failures.push(
      `missing security attestation; copy ${INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH} to ${INPUT_LIVE_V6_SECURITY_ATTESTATION_DEFAULT_PATH} only after PAT rotation and MCP restart`,
    );
  } else {
    const raw = readFileSync(securityPath);
    let security: unknown;
    try {
      security = JSON.parse(raw.toString("utf8"));
    } catch {
      failures.push("security attestation is not valid JSON");
    }
    if (security !== undefined)
      failures.push(...validateInputLiveV6SecurityAttestation(security, proof));
  }
  const runnerSource = readFileSync(
    path.join(root, "recipe/run-input-field-live-v6.ts"),
    "utf8",
  );
  failures.push(...validateInputLiveV6ControlFlowSource(runnerSource));
  if (failures.length)
    throw new Error(`Input live v6 preflight refused:\n${failures.join("\n")}`);
  const security = JSON.parse(readFileSync(securityPath, "utf8")) as Record<
    string,
    any
  >;
  return {
    artifactVersion: "input-live-v6-preflight-v1",
    authorizationMode: "live",
    authorizationCommit: proof.authorizationCommit,
    codeCommit: proof.codeCommit,
    securityAttestationSha256: security.attestationSha256,
    signingPublicKeySha256: proof.signingPublicKeySha256,
    target: INPUT_LIVE_V6_TARGET,
    expectedDynamicTool: INPUT_LIVE_V6_DYNAMIC_TOOL,
    attempt,
    completedAttempts: [...completedAttempts],
    remoteRequests: 132,
    hostPhases: 3,
    sourceRoots: 2,
    expectedSceneFacts: 43_726,
    captures: 128,
    capture: false,
  };
}

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const proof = verifyInputLiveV6Authorization();
  const attestationPath = argument("--security-attestation");
  if (!attestationPath)
    throw new Error(
      `--security-attestation is required; ${INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH} is a pending template only`,
    );
  const report = runInputLiveV6Preflight(
    process.cwd(),
    proof,
    attestationPath,
    Number(argument("--attempt") ?? "1"),
    (argument("--completed-attempts") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
