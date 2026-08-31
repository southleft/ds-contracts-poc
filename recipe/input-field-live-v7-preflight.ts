import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { INPUT_LIVE_V7_INDEX_PATH } from "./build-input-field-live-proof-v7.js";
import {
  INPUT_LIVE_V7_DYNAMIC_TOOL,
  INPUT_LIVE_V7_TARGET,
} from "./input-field-live-v7-broker.js";
import {
  validateInputLiveV7AntecedentIndex,
  verifyInputLiveV7Authorization,
  INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  type InputLiveV7AntecedentIndex,
  type InputLiveV7AuthorizationProof,
} from "./input-field-live-v7-authorization.js";
import { canonicalJson } from "./normalize.js";

export const INPUT_LIVE_V7_SECURITY_ATTESTATION_TEMPLATE_PATH =
  "recipe/evidence/input-field-live-pivot-v7/operator-security-attestation-template.json";
export const INPUT_LIVE_V7_SECURITY_ATTESTATION_DEFAULT_PATH =
  "private/input-live-v7-security-attestation.json";

export interface InputLiveV7SecurityAttestation {
  artifactVersion: "input-live-v7-operator-security-attestation-v2";
  status: "complete";
  createdAt: string;
  rotation: {
    completedAt: string;
    completedByUserAssertion: true;
    credentialType: "Figma personal access token";
    exposedCredentialRevokedOrReplaced: true;
    replacementPatActiveForProject: true;
    oldTokenRevoked: false;
    ownerRiskAcceptance: true;
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
    sessionIdentity: string;
    target: typeof INPUT_LIVE_V7_TARGET;
    readOnly: true;
    probe: "exact file key, file name, and editor type";
    passed: true;
    bridgeProbePassed: true;
    restProbePassed: true;
    figmaWrites: 0;
    figmaCaptures: 0;
  };
  repositorySecretScan: {
    completedAt: string;
    codeCommit: string;
    scope: "tracked and untracked repository files";
    matches: 0;
    zero: true;
  };
  binding: {
    authorizationPath: typeof INPUT_LIVE_V7_AUTHORIZATION_V2_PATH;
    authorizationSha256: string;
    authorizationCommit: string;
    codeCommit: string;
    signingPublicKeySha256: string;
  };
  tokenValuesStored: false;
  attestationSha256: string;
}

export interface InputLiveV7PreflightReport {
  artifactVersion: "input-live-v7-preflight-v1";
  authorizationMode: "live";
  authorizationCommit: string;
  codeCommit: string;
  securityAttestationSha256: string;
  signingPublicKeySha256: string;
  target: typeof INPUT_LIVE_V7_TARGET;
  expectedDynamicTool: typeof INPUT_LIVE_V7_DYNAMIC_TOOL;
  attempt: number;
  completedAttempts: number[];
  remoteRequests: 132;
  hostPhases: 3;
  sourceRoots: 2;
  expectedSceneFacts: 43726;
  captures: 128;
  capture: false;
}

const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const time = (value: unknown): number =>
  typeof value === "string" ? Date.parse(value) : Number.NaN;

const privateMaterialPaths = (value: unknown, prefix = "$"): string[] => {
  if (typeof value === "string")
    return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|figd_[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._~-]{12,}/i.test(
      value,
    )
      ? [prefix]
      : [];
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      privateMaterialPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(/^(?:privateKey|privateKeyPem|accessToken|apiKey|secret|cookie)$/i.test(
        key,
      )
        ? [`${prefix}.${key}`]
        : []),
      ...privateMaterialPaths(child, `${prefix}.${key}`),
    ],
  );
};

export const inputLiveV7AttestationSha256 = (
  value: Omit<InputLiveV7SecurityAttestation, "attestationSha256">,
): string => sha256(canonicalJson(value));

export function validateInputLiveV7SecurityAttestation(
  value: unknown,
  proof: InputLiveV7AuthorizationProof,
): string[] {
  const artifact =
    value !== null && typeof value === "object"
      ? (value as Record<string, any>)
      : {};
  const failures: string[] = [];
  const { attestationSha256, ...body } = artifact;
  const rotationAt = time(artifact.rotation?.completedAt);
  const restartAt = time(artifact.mcpRestart?.completedAt);
  const probeAt = time(artifact.scratchReadOnlyProbe?.completedAt);
  const scanAt = time(artifact.repositorySecretScan?.completedAt);
  const createdAt = time(artifact.createdAt);
  if (
    artifact.artifactVersion !==
      "input-live-v7-operator-security-attestation-v2" ||
    artifact.status !== "complete"
  )
    failures.push("missing completed v7 security attestation");
  if (
    !Number.isFinite(rotationAt) ||
    artifact.rotation?.completedByUserAssertion !== true ||
    artifact.rotation?.credentialType !== "Figma personal access token" ||
    artifact.rotation?.exposedCredentialRevokedOrReplaced !== true ||
    artifact.rotation?.replacementPatActiveForProject !== true ||
    artifact.rotation?.oldTokenRevoked !== false ||
    artifact.rotation?.ownerRiskAcceptance !== true ||
    artifact.rotation?.tokenValueStored !== false
  )
    failures.push("Figma PAT rotation/replacement assertion missing");
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
      "post-rotation MCP restart or owner-only env assertion missing",
    );
  if (
    !Number.isFinite(probeAt) ||
    probeAt < restartAt ||
    artifact.scratchReadOnlyProbe?.completedAfterMcpRestart !== true ||
    artifact.scratchReadOnlyProbe?.sessionIdentity !==
      artifact.mcpRestart?.sessionIdentity ||
    !equalJson(artifact.scratchReadOnlyProbe?.target, INPUT_LIVE_V7_TARGET) ||
    artifact.scratchReadOnlyProbe?.readOnly !== true ||
    artifact.scratchReadOnlyProbe?.probe !==
      "exact file key, file name, and editor type" ||
    artifact.scratchReadOnlyProbe?.passed !== true ||
    artifact.scratchReadOnlyProbe?.bridgeProbePassed !== true ||
    artifact.scratchReadOnlyProbe?.restProbePassed !== true ||
    artifact.scratchReadOnlyProbe?.figmaWrites !== 0 ||
    artifact.scratchReadOnlyProbe?.figmaCaptures !== 0
  )
    failures.push(
      "exact Scratch read-only post-restart probe missing or unsafe",
    );
  if (
    !Number.isFinite(scanAt) ||
    scanAt < rotationAt ||
    artifact.repositorySecretScan?.codeCommit !== proof.codeCommit ||
    artifact.repositorySecretScan?.scope !==
      "tracked and untracked repository files" ||
    artifact.repositorySecretScan?.matches !== 0 ||
    artifact.repositorySecretScan?.zero !== true
  )
    failures.push(
      "current repository secret scan is missing, stale, or nonzero",
    );
  if (
    artifact.binding?.authorizationPath !==
      INPUT_LIVE_V7_AUTHORIZATION_V2_PATH ||
    artifact.binding?.authorizationSha256 !== proof.authorizationSha256 ||
    artifact.binding?.authorizationCommit !== proof.authorizationCommit ||
    artifact.binding?.codeCommit !== proof.codeCommit ||
    artifact.binding?.signingPublicKeySha256 !== proof.signingPublicKeySha256
  )
    failures.push(
      "security attestation is stale for the replacement authorization or code commit",
    );
  if (
    !Number.isFinite(createdAt) ||
    createdAt < Math.max(rotationAt, restartAt, probeAt, scanAt)
  )
    failures.push("security attestation was not created after all gates");
  if (
    artifact.tokenValuesStored !== false ||
    privateMaterialPaths(artifact).length > 0
  )
    failures.push("security attestation contains private material");
  if (
    !SHA256.test(attestationSha256) ||
    attestationSha256 !== sha256(canonicalJson(body))
  )
    failures.push("security attestation hash mismatch");
  return failures;
}

const equalJson = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

export function validateInputLiveV7ControlFlowSource(source: string): string[] {
  const failures: string[] = [];
  const authorization = source.indexOf("verifyInputLiveV7Authorization");
  const preflight = source.indexOf("runInputLiveV7Preflight");
  const initialize = source.indexOf("InputLiveV7Orchestrator.initialize");
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
    failures.push("authorized runner omits required security attestation");
  if (!source.includes("INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV"))
    failures.push(
      "authorized runner omits explicit external private-key environment variable",
    );
  return failures;
}

export function runInputLiveV7Preflight(
  root: string,
  proof: InputLiveV7AuthorizationProof,
  attestationPath = INPUT_LIVE_V7_SECURITY_ATTESTATION_DEFAULT_PATH,
  attempt = 1,
  completedAttempts: readonly number[] = [],
): InputLiveV7PreflightReport {
  const failures: string[] = [];
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > 3 ||
    attempt !== completedAttempts.length + 1 ||
    completedAttempts.some((value, index) => value !== index + 1)
  )
    failures.push("v7 attempt chronology invalid or exceeds maximum 3");
  if (
    proof.mode !== "live" ||
    !equalJson(proof.target, INPUT_LIVE_V7_TARGET) ||
    !equalJson(proof.expectedDynamicTool, INPUT_LIVE_V7_DYNAMIC_TOOL)
  )
    failures.push("v7 authorization proof target or tool mismatch");
  const indexPath = path.join(root, INPUT_LIVE_V7_INDEX_PATH);
  const indexBytes = readFileSync(indexPath);
  const index = JSON.parse(
    indexBytes.toString("utf8"),
  ) as InputLiveV7AntecedentIndex;
  failures.push(...validateInputLiveV7AntecedentIndex(index));
  if (
    sha256(indexBytes) !== proof.antecedentIndexSha256 ||
    index.hashSetSha256 !== proof.antecedentHashSetSha256
  )
    failures.push("v7 authorization proof antecedent index mismatch");
  for (const [relativePath, metadata] of Object.entries(index.artifacts)) {
    const absolutePath = path.join(root, relativePath);
    if (
      !existsSync(absolutePath) ||
      readFileSync(absolutePath).byteLength !== metadata.bytes ||
      sha256(readFileSync(absolutePath)) !== metadata.sha256
    )
      failures.push(
        `v7 pinned antecedent working bytes drift: ${relativePath}`,
      );
  }
  if (!existsSync(path.join(root, INPUT_LIVE_V7_AUTHORIZATION_V2_PATH)))
    failures.push("v7 replacement authorization artifact is absent");
  const securityPath = path.resolve(root, attestationPath);
  if (!existsSync(securityPath))
    failures.push(
      `missing security attestation; create ${INPUT_LIVE_V7_SECURITY_ATTESTATION_DEFAULT_PATH} only after PAT rotation, MCP restart, owner-only env, zero secret scan, and exact Scratch probe`,
    );
  else {
    try {
      failures.push(
        ...validateInputLiveV7SecurityAttestation(
          JSON.parse(readFileSync(securityPath, "utf8")),
          proof,
        ),
      );
    } catch {
      failures.push("security attestation is not valid JSON");
    }
  }
  const runnerSource = readFileSync(
    path.join(root, "recipe/input-field-live-v7-authorized.ts"),
    "utf8",
  );
  failures.push(...validateInputLiveV7ControlFlowSource(runnerSource));
  if (failures.length)
    throw new Error(`Input live v7 preflight refused:\n${failures.join("\n")}`);
  const security = JSON.parse(
    readFileSync(securityPath, "utf8"),
  ) as InputLiveV7SecurityAttestation;
  return {
    artifactVersion: "input-live-v7-preflight-v1",
    authorizationMode: "live",
    authorizationCommit: proof.authorizationCommit,
    codeCommit: proof.codeCommit,
    securityAttestationSha256: security.attestationSha256,
    signingPublicKeySha256: proof.signingPublicKeySha256,
    target: INPUT_LIVE_V7_TARGET,
    expectedDynamicTool: INPUT_LIVE_V7_DYNAMIC_TOOL,
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
  const attestationPath = argument("--security-attestation");
  if (!attestationPath)
    throw new Error(
      `--security-attestation is required; ${INPUT_LIVE_V7_SECURITY_ATTESTATION_TEMPLATE_PATH} is a template only`,
    );
  const report = runInputLiveV7Preflight(
    process.cwd(),
    verifyInputLiveV7Authorization(),
    attestationPath,
    Number(argument("--attempt") ?? "1"),
    (argument("--completed-attempts") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
