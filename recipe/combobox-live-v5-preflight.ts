import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COMBOBOX_LIVE_V5_AUTHORIZATION_PATH,
  COMBOBOX_LIVE_V5_INDEX_PATH,
} from "./build-combobox-live-proof-v5.js";
import {
  COMBOBOX_LIVE_V5_DYNAMIC_TOOL,
  COMBOBOX_LIVE_V5_TARGET,
} from "./combobox-live-v5-broker.js";
import {
  COMBOBOX_LIVE_V5_CAPTURE_COUNT,
  COMBOBOX_LIVE_V5_HOST_PHASES,
  COMBOBOX_LIVE_V5_REMOTE_REQUESTS,
  COMBOBOX_LIVE_V5_SOURCE_ROOTS,
} from "./combobox-live-v5-contract.js";
import {
  validateComboboxLiveV5AntecedentIndex,
  verifyComboboxLiveV5Authorization,
  type ComboboxLiveV5AntecedentIndex,
  type ComboboxLiveV5AuthorizationProof,
} from "./combobox-live-v5-authorization.js";
import { canonicalJson } from "./normalize.js";

export const COMBOBOX_LIVE_V5_SECURITY_ATTESTATION_TEMPLATE_PATH =
  "recipe/evidence/combobox-live-pivot-v5/operator-security-attestation-template.json";
export const COMBOBOX_LIVE_V5_SECURITY_ATTESTATION_DEFAULT_PATH =
  "private/combobox-live-v5-security-attestation.json";

export interface ComboboxLiveV5SecurityAttestation {
  artifactVersion: "combobox-live-v5-operator-security-attestation-v1";
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
    target: typeof COMBOBOX_LIVE_V5_TARGET;
    readOnly: true;
    probe: "exact file key, file name, and editor type";
    passed: true;
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
  tokenValuesStored: false;
  attestationSha256: string;
}

export interface ComboboxLiveV5PreflightReport {
  artifactVersion: "combobox-live-v5-preflight-v1";
  authorizationMode: "live";
  authorizationCommit: string;
  codeCommit: string;
  securityAttestationSha256: string;
  signingPublicKeySha256: string;
  target: typeof COMBOBOX_LIVE_V5_TARGET;
  expectedDynamicTool: typeof COMBOBOX_LIVE_V5_DYNAMIC_TOOL;
  attempt: number;
  completedAttempts: number[];
  remoteRequests: 77;
  hostPhases: 3;
  sourceRoots: 2;
  expectedSceneFacts: number;
  captures: 72;
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

export const comboboxLiveV5AttestationSha256 = (
  value: Omit<ComboboxLiveV5SecurityAttestation, "attestationSha256">,
): string => sha256(canonicalJson(value));

export function validateComboboxLiveV5SecurityAttestation(
  value: unknown,
  proof: ComboboxLiveV5AuthorizationProof,
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
      "combobox-live-v5-operator-security-attestation-v1" ||
    artifact.status !== "complete"
  )
    failures.push("missing completed v8 security attestation");
  if (
    !Number.isFinite(rotationAt) ||
    artifact.rotation?.completedByUserAssertion !== true ||
    artifact.rotation?.credentialType !== "Figma personal access token" ||
    artifact.rotation?.exposedCredentialRevokedOrReplaced !== true ||
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
    !equalJson(artifact.scratchReadOnlyProbe?.target, COMBOBOX_LIVE_V5_TARGET) ||
    artifact.scratchReadOnlyProbe?.readOnly !== true ||
    artifact.scratchReadOnlyProbe?.probe !==
      "exact file key, file name, and editor type" ||
    artifact.scratchReadOnlyProbe?.passed !== true ||
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

export function validateComboboxLiveV5ControlFlowSource(
  source: string,
): string[] {
  const failures: string[] = [];
  const authorization = source.indexOf("verifyComboboxLiveV5Authorization");
  const preflight = source.indexOf("runComboboxLiveV5Preflight");
  const initialize = source.indexOf("ComboboxLiveV5Orchestrator.initialize");
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
  if (!source.includes("--private-key"))
    failures.push("authorized runner omits external private signing key");
  return failures;
}

export function runComboboxLiveV5Preflight(
  root: string,
  proof: ComboboxLiveV5AuthorizationProof,
  attestationPath = COMBOBOX_LIVE_V5_SECURITY_ATTESTATION_DEFAULT_PATH,
  attempt = 1,
  completedAttempts: readonly number[] = [],
): ComboboxLiveV5PreflightReport {
  const failures: string[] = [];
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > 3 ||
    attempt !== completedAttempts.length + 1 ||
    completedAttempts.some((value, index) => value !== index + 1)
  )
    failures.push("v8 attempt chronology invalid or exceeds maximum 3");
  if (
    proof.mode !== "live" ||
    !equalJson(proof.target, COMBOBOX_LIVE_V5_TARGET) ||
    !equalJson(proof.expectedDynamicTool, COMBOBOX_LIVE_V5_DYNAMIC_TOOL)
  )
    failures.push("v8 authorization proof target or tool mismatch");
  const indexPath = path.join(root, COMBOBOX_LIVE_V5_INDEX_PATH);
  const indexBytes = readFileSync(indexPath);
  const index = JSON.parse(
    indexBytes.toString("utf8"),
  ) as ComboboxLiveV5AntecedentIndex;
  failures.push(...validateComboboxLiveV5AntecedentIndex(index));
  if (
    sha256(indexBytes) !== proof.antecedentIndexSha256 ||
    index.hashSetSha256 !== proof.antecedentHashSetSha256
  )
    failures.push("v8 authorization proof antecedent index mismatch");
  for (const [relativePath, metadata] of Object.entries(index.artifacts)) {
    const absolutePath = path.join(root, relativePath);
    if (
      !existsSync(absolutePath) ||
      readFileSync(absolutePath).byteLength !== metadata.bytes ||
      sha256(readFileSync(absolutePath)) !== metadata.sha256
    )
      failures.push(
        `v8 pinned antecedent working bytes drift: ${relativePath}`,
      );
  }
  if (!existsSync(path.join(root, COMBOBOX_LIVE_V5_AUTHORIZATION_PATH)))
    failures.push("v8 authorization artifact is absent");
  const securityPath = path.resolve(root, attestationPath);
  if (!existsSync(securityPath))
    failures.push(
      `missing security attestation; create ${COMBOBOX_LIVE_V5_SECURITY_ATTESTATION_DEFAULT_PATH} only after PAT rotation, MCP restart, owner-only env, zero secret scan, and exact Scratch probe`,
    );
  else {
    try {
      failures.push(
        ...validateComboboxLiveV5SecurityAttestation(
          JSON.parse(readFileSync(securityPath, "utf8")),
          proof,
        ),
      );
    } catch {
      failures.push("security attestation is not valid JSON");
    }
  }
  const runnerSource = readFileSync(
    path.join(root, "recipe/combobox-live-v5-authorized.ts"),
    "utf8",
  );
  failures.push(...validateComboboxLiveV5ControlFlowSource(runnerSource));
  if (failures.length)
    throw new Error(
      `Combobox live v4 preflight refused:\n${failures.join("\n")}`,
    );
  const security = JSON.parse(
    readFileSync(securityPath, "utf8"),
  ) as ComboboxLiveV5SecurityAttestation;
  return {
    artifactVersion: "combobox-live-v5-preflight-v1",
    authorizationMode: "live",
    authorizationCommit: proof.authorizationCommit,
    codeCommit: proof.codeCommit,
    securityAttestationSha256: security.attestationSha256,
    signingPublicKeySha256: proof.signingPublicKeySha256,
    target: COMBOBOX_LIVE_V5_TARGET,
    expectedDynamicTool: COMBOBOX_LIVE_V5_DYNAMIC_TOOL,
    attempt,
    completedAttempts: [...completedAttempts],
    remoteRequests: COMBOBOX_LIVE_V5_REMOTE_REQUESTS,
    hostPhases: COMBOBOX_LIVE_V5_HOST_PHASES,
    sourceRoots: COMBOBOX_LIVE_V5_SOURCE_ROOTS,
    expectedSceneFacts: index.counts.expectedSceneFacts,
    captures: COMBOBOX_LIVE_V5_CAPTURE_COUNT,
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
      `--security-attestation is required; ${COMBOBOX_LIVE_V5_SECURITY_ATTESTATION_TEMPLATE_PATH} is a template only`,
    );
  const report = runComboboxLiveV5Preflight(
    process.cwd(),
    verifyComboboxLiveV5Authorization(),
    attestationPath,
    Number(argument("--attempt") ?? "1"),
    (argument("--completed-attempts") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number),
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
