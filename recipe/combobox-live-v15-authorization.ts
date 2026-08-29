import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  COMBOBOX_LIVE_V15_DYNAMIC_TOOL,
  COMBOBOX_LIVE_V15_TARGET,
  type ComboboxLiveV15TransactionAuthorization,
} from "./combobox-live-v15-broker.js";
import {
  COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
  COMBOBOX_LIVE_V15_INDEX_PATH,
} from "./build-combobox-live-proof-v15.js";
import {
  COMBOBOX_LIVE_V15_CAPTURE_COUNT,
  COMBOBOX_LIVE_V15_HOST_PHASES,
  COMBOBOX_LIVE_V15_REMOTE_REQUESTS,
  COMBOBOX_LIVE_V15_SOURCE_ROOTS,
} from "./combobox-live-v15-contract.js";
import { canonicalJson } from "./normalize.js";

export type ComboboxLiveV15HistoryExpectation = "pending" | "authorized";

export interface ComboboxLiveV15AuthorizationArtifact {
  artifactVersion: "combobox-live-v15-capture-authorization-v1";
  authorizationId: "combobox-live-v15";
  status: "authorization declared; runtime security prerequisites still mandatory";
  authorizationIntent: true;
  antecedent: {
    commit: string;
    indexPath: typeof COMBOBOX_LIVE_V15_INDEX_PATH;
    indexSha256: string;
    hashSetSha256: string;
  };
  signingPublicKey: {
    algorithm: "Ed25519";
    encoding: "SPKI-PEM";
    publicKeyPem: string;
    spkiSha256: string;
    privateKeyStoredInRepository: false;
  };
  operatorBoundary: {
    target: typeof COMBOBOX_LIVE_V15_TARGET;
    expectedDynamicTool: typeof COMBOBOX_LIVE_V15_DYNAMIC_TOOL;
    externalOperatorOnly: true;
    oneMcpCallPerSignedRequest: true;
  };
  denominator: {
    remoteRequests: 77;
    hostPhases: 3;
    captures: 72;
    sourceRoots: 2;
    expectedFacts: number;
  };
  execution: {
    maximumAttempts: 3;
    attemptsExecuted: 0;
    captureBeforeHashBoundTechnicalGates: false;
    durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true;
    cleanupMustRemainExecutableAfterHostFailure: true;
    cleanupMustNotExecuteOnMainComplete: true;
    taughtCleanupOnFailureOnly: true;
    v7AuthorizationReusable: false;
    v8AuthorizationReusable: false;
    v9AuthorizationReusable: false;
    v10AuthorizationReusable: false;
    v11AuthorizationReusable: false;
    v12AuthorizationReusable: false;
    v13AuthorizationReusable: false;
    v14AuthorizationReusable: false;
    v15AuthorizationReusable: false;
    v16AuthorizationReusable: false;
    v17AuthorizationReusable: false;
    v18AuthorizationReusable: false;
    v19AuthorizationReusable: false;
    v20AuthorizationReusable: false;
    v21AuthorizationReusable: false;
    v22AuthorizationReusable: false;
    v23AuthorizationReusable: false;
    v24AuthorizationReusable: false;
    v25AuthorizationReusable: false;
    v26AuthorizationReusable: false;
    v27AuthorizationReusable: false;
    v28AuthorizationReusable: false;
    v29AuthorizationReusable: false;
    v30AuthorizationReusable: false;
    v31AuthorizationReusable: false;
    v32AuthorizationReusable: false;
    v33AuthorizationReusable: false;
    v34AuthorizationReusable: false;
    v35AuthorizationReusable: false;
    v36AuthorizationReusable: false;
    v85AuthorizationReusable: false;
    inputV85AuthorizationReusable: false;
    comboboxLiveV1AuthorizationReusable: false;
    comboboxLiveV2AuthorizationReusable: false;
    comboboxLiveV3AuthorizationReusable: false;
    comboboxLiveV4AuthorizationReusable: false;
    comboboxLiveV5AuthorizationReusable: false;
    comboboxLiveV6AuthorizationReusable: false;
    comboboxLiveV7AuthorizationReusable: false;
    comboboxLiveV8AuthorizationReusable: false;
    comboboxLiveV9AuthorizationReusable: false;
    comboboxLiveV10AuthorizationReusable: false;
    comboboxLiveV11AuthorizationReusable: false;
    comboboxLiveV12AuthorizationReusable: false;
    comboboxLiveV13AuthorizationReusable: false;
    comboboxLiveV14AuthorizationReusable: false;
  };
  securityPrerequisite: {
    figmaPatRevokedOrReplacedRequired: true;
    mcpRestartAfterRotationRequired: true;
    ownerOnlyEnvironmentFileMode0600Required: true;
    repositorySecretScanZeroRequired: true;
    exactScratchReadOnlyProbeRequired: true;
    tokenValuesForbidden: true;
  };
  humanSignoff: { mandatory: true; status: "pending" };
}

export interface ComboboxLiveV15AntecedentIndex {
  artifactVersion: "combobox-live-v15-antecedent-index-v1";
  status: string;
  artifacts: Record<string, { bytes: number; sha256: string }>;
  hashSetSha256: string;
  counts: {
    sources: 2;
    variants: 144;
    expectedSceneFacts: number;
    captureCells: 72;
    remoteRequests: 77;
    hostPhases: 3;
  };
  authorizationLifecycleExcluded: string[];
  authorizationCanBeAddedWithoutAntecedentRebuild: true;
}

export interface ComboboxLiveV15HistoryState {
  index?: ComboboxLiveV15AntecedentIndex;
  indexSha256: string;
  antecedentAddingCommits: string[];
  antecedentCommit?: string;
  antecedentIsAncestorOfCode: boolean;
  antecedentIndexBytesMatchFirstAddition: boolean;
  antecedentArtifactsMatchIndexAtCommit: boolean;
  workingAntecedentArtifactsMatchIndex: boolean;
  authorization?: ComboboxLiveV15AuthorizationArtifact;
  authorizationAddingCommits: string[];
  authorizationCommit?: string;
  authorizationPresentAtCodeCommit: boolean;
  authorizationBytesMatchFirstAddition: boolean;
  authorizationStrictlyDescendsFromAntecedent: boolean;
  authorizationIsAncestorOfCode: boolean;
  codeCommit: string;
  upstreamCommit?: string;
  clean: boolean;
}

export interface ComboboxLiveV15AuthorizationProof extends ComboboxLiveV15TransactionAuthorization {
  upstreamCommit: string;
  antecedentIndexSha256: string;
  antecedentHashSetSha256: string;
  target: typeof COMBOBOX_LIVE_V15_TARGET;
  expectedDynamicTool: typeof COMBOBOX_LIVE_V15_DYNAMIC_TOOL;
  authorizationPath: typeof COMBOBOX_LIVE_V15_AUTHORIZATION_PATH;
}

const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
const gitText = (root: string, args: readonly string[]): string =>
  git(root, args).toString("utf8").trim();
const tryGitText = (
  root: string,
  args: readonly string[],
): string | undefined => {
  try {
    return gitText(root, args) || undefined;
  } catch {
    return undefined;
  }
};
const equalJson = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);
const addingCommits = (
  root: string,
  commit: string,
  artifactPath: string,
): string[] => {
  const output = gitText(root, [
    "log",
    "--reverse",
    "--diff-filter=A",
    "--format=%H",
    commit,
    "--",
    artifactPath,
  ]);
  return output ? output.split("\n") : [];
};
const objectExists = (
  root: string,
  commit: string,
  artifactPath: string,
): boolean => {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}:${artifactPath}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};
const isAncestor = (
  root: string,
  ancestor: string | undefined,
  descendant: string,
): boolean => {
  if (!ancestor) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const lifecyclePath = (artifactPath: string): boolean =>
  artifactPath === COMBOBOX_LIVE_V15_AUTHORIZATION_PATH ||
  artifactPath.endsWith("/authorization-template.json") ||
  artifactPath.endsWith("/operator-security-attestation-template.json") ||
  artifactPath.includes("combobox-live-v15-authorization") ||
  artifactPath.includes("combobox-live-v15-preflight") ||
  artifactPath.includes("combobox-live-v15-authorized") ||
  artifactPath.includes("create-combobox-live-v15-security-attestation") ||
  artifactPath.includes("combobox-live-pivot-v15-status") ||
  artifactPath.endsWith("/status-index.json");

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

const forbiddenAntecedentFieldPaths = (
  value: unknown,
  prefix = "$",
): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      forbiddenAntecedentFieldPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(/^(?:outcome|outcomes|result|results|measurement|observed|score|winner|securityAttestation)$/i.test(
        key,
      )
        ? [`${prefix}.${key}`]
        : []),
      ...forbiddenAntecedentFieldPaths(child, `${prefix}.${key}`),
    ],
  );
};

export function validateComboboxLiveV15AntecedentIndex(
  index: ComboboxLiveV15AntecedentIndex | undefined,
): string[] {
  const failures: string[] = [];
  if (
    index?.artifactVersion !== "combobox-live-v15-antecedent-index-v1" ||
    index.authorizationCanBeAddedWithoutAntecedentRebuild !== true
  )
    failures.push("v1 antecedent index missing or malformed");
  const artifactEntries = Object.entries(index?.artifacts ?? {});
  if (artifactEntries.length === 0)
    failures.push("v1 antecedent hash denominator is empty");
  for (const [artifactPath, metadata] of artifactEntries) {
    if (lifecyclePath(artifactPath))
      failures.push(
        `authorization lifecycle entered antecedent hash: ${artifactPath}`,
      );
    if (
      !Number.isInteger(metadata.bytes) ||
      metadata.bytes <= 0 ||
      !SHA256.test(metadata.sha256)
    )
      failures.push(`malformed v1 antecedent hash: ${artifactPath}`);
  }
  const expectedHashSet = sha256(
    JSON.stringify(
      artifactEntries.sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  if (index?.hashSetSha256 !== expectedHashSet)
    failures.push("v1 antecedent hash-set digest mismatch");
  if (
    index?.counts?.sources !== 2 ||
    index.counts.variants !== 144 ||
    !Number.isInteger(index.counts.expectedSceneFacts) ||
    index.counts.expectedSceneFacts <= 0 ||
    index.counts.captureCells !== 72 ||
    index.counts.remoteRequests !== 77 ||
    index.counts.hostPhases !== 3
  )
    failures.push("v1 antecedent counts missing or drifted");
  for (const required of [
    COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
    "recipe/combobox-live-v15-authorization.ts",
    "recipe/combobox-live-v15-authorization.test.ts",
    "recipe/combobox-live-v15-preflight.ts",
    "recipe/evidence/combobox-live-pivot-v15/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ])
    if (!index?.authorizationLifecycleExcluded?.includes(required))
      failures.push(`v1 lifecycle exclusion missing: ${required}`);
  const leaks = forbiddenAntecedentFieldPaths(index);
  if (leaks.length)
    failures.push(`v1 antecedent result leakage: ${leaks.join(",")}`);
  return failures;
}

export function validateComboboxLiveV15UnitTestSource(source: string): string[] {
  const failures: string[] = [];
  if (
    /assert\.throws\([\s\S]{0,300}verifyInputLiveV\d+Authorization\(\)/.test(
      source,
    ) ||
    /verifyComboboxLiveV15History\(\s*["']/.test(source) ||
    /readComboboxLiveV15HistoryState\(/.test(source)
  )
    failures.push(
      "phase-sensitive unit test invokes current repository history",
    );
  return failures;
}

export function buildComboboxLiveV15AuthorizationArtifact(options: {
  antecedentCommit: string;
  antecedentIndexBytes: Uint8Array;
  signingPublicKey: KeyObject | string | Buffer;
}): ComboboxLiveV15AuthorizationArtifact {
  if (!SHA40.test(options.antecedentCommit))
    throw new TypeError("v1 antecedent commit must be a full SHA");
  const index = JSON.parse(
    Buffer.from(options.antecedentIndexBytes).toString("utf8"),
  ) as ComboboxLiveV15AntecedentIndex;
  const indexFailures = validateComboboxLiveV15AntecedentIndex(index);
  if (indexFailures.length)
    throw new TypeError(
      `v1 antecedent index refused:\n${indexFailures.join("\n")}`,
    );
  const publicKey =
    typeof options.signingPublicKey === "string" ||
    Buffer.isBuffer(options.signingPublicKey)
      ? createPublicKey(options.signingPublicKey)
      : createPublicKey(
          options.signingPublicKey.export({ type: "spki", format: "pem" }),
        );
  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const spkiSha256 = sha256(publicKey.export({ type: "spki", format: "der" }));
  return {
    artifactVersion: "combobox-live-v15-capture-authorization-v1",
    authorizationId: "combobox-live-v15",
    status:
      "authorization declared; runtime security prerequisites still mandatory",
    authorizationIntent: true,
    antecedent: {
      commit: options.antecedentCommit,
      indexPath: COMBOBOX_LIVE_V15_INDEX_PATH,
      indexSha256: sha256(options.antecedentIndexBytes),
      hashSetSha256: index.hashSetSha256,
    },
    signingPublicKey: {
      algorithm: "Ed25519",
      encoding: "SPKI-PEM",
      publicKeyPem,
      spkiSha256,
      privateKeyStoredInRepository: false,
    },
    operatorBoundary: {
      target: COMBOBOX_LIVE_V15_TARGET,
      expectedDynamicTool: COMBOBOX_LIVE_V15_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: COMBOBOX_LIVE_V15_REMOTE_REQUESTS,
      hostPhases: COMBOBOX_LIVE_V15_HOST_PHASES,
      captures: COMBOBOX_LIVE_V15_CAPTURE_COUNT,
      sourceRoots: COMBOBOX_LIVE_V15_SOURCE_ROOTS,
      expectedFacts: index.counts.expectedSceneFacts,
    },
    execution: {
      maximumAttempts: 3,
      attemptsExecuted: 0,
      captureBeforeHashBoundTechnicalGates: false,
      durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true,
      cleanupMustRemainExecutableAfterHostFailure: true,
      cleanupMustNotExecuteOnMainComplete: true,
      taughtCleanupOnFailureOnly: true,
      v7AuthorizationReusable: false,
      v8AuthorizationReusable: false,
      v9AuthorizationReusable: false,
      v10AuthorizationReusable: false,
      v11AuthorizationReusable: false,
      v12AuthorizationReusable: false,
      v13AuthorizationReusable: false,
      v14AuthorizationReusable: false,
      v15AuthorizationReusable: false,
      v16AuthorizationReusable: false,
      v17AuthorizationReusable: false,
      v18AuthorizationReusable: false,
      v19AuthorizationReusable: false,
      v20AuthorizationReusable: false,
      v21AuthorizationReusable: false,
      v22AuthorizationReusable: false,
      v23AuthorizationReusable: false,
      v24AuthorizationReusable: false,
      v25AuthorizationReusable: false,
      v26AuthorizationReusable: false,
      v27AuthorizationReusable: false,
      v28AuthorizationReusable: false,
      v29AuthorizationReusable: false,
      v30AuthorizationReusable: false,
      v31AuthorizationReusable: false,
      v32AuthorizationReusable: false,
      v33AuthorizationReusable: false,
      v34AuthorizationReusable: false,
      v35AuthorizationReusable: false,
      v36AuthorizationReusable: false,
      v85AuthorizationReusable: false,
      inputV85AuthorizationReusable: false,
      comboboxLiveV1AuthorizationReusable: false,
      comboboxLiveV2AuthorizationReusable: false,
      comboboxLiveV3AuthorizationReusable: false,
      comboboxLiveV4AuthorizationReusable: false,
      comboboxLiveV5AuthorizationReusable: false,
      comboboxLiveV6AuthorizationReusable: false,
      comboboxLiveV7AuthorizationReusable: false,
      comboboxLiveV8AuthorizationReusable: false,
      comboboxLiveV9AuthorizationReusable: false,
      comboboxLiveV10AuthorizationReusable: false,
      comboboxLiveV11AuthorizationReusable: false,
      comboboxLiveV12AuthorizationReusable: false,
      comboboxLiveV13AuthorizationReusable: false,
      comboboxLiveV14AuthorizationReusable: false,
    },
    securityPrerequisite: {
      figmaPatRevokedOrReplacedRequired: true,
      mcpRestartAfterRotationRequired: true,
      ownerOnlyEnvironmentFileMode0600Required: true,
      repositorySecretScanZeroRequired: true,
      exactScratchReadOnlyProbeRequired: true,
      tokenValuesForbidden: true,
    },
    humanSignoff: { mandatory: true, status: "pending" },
  };
}

export function validateComboboxLiveV15AuthorizationArtifact(
  artifact: ComboboxLiveV15AuthorizationArtifact | undefined,
  index: ComboboxLiveV15AntecedentIndex | undefined,
  indexSha256: string,
): string[] {
  const failures: string[] = [];
  if (
    artifact?.artifactVersion !== "combobox-live-v15-capture-authorization-v1" ||
    artifact.authorizationId !== "combobox-live-v15" ||
    artifact.authorizationIntent !== true
  )
    failures.push("v8 authorization declaration missing or malformed");
  const resultLeaks = forbiddenAntecedentFieldPaths(artifact);
  if (resultLeaks.length)
    failures.push(`v8 authorization result leakage: ${resultLeaks.join(",")}`);
  if (
    artifact?.antecedent?.indexPath !== COMBOBOX_LIVE_V15_INDEX_PATH ||
    artifact?.antecedent?.indexSha256 !== indexSha256 ||
    artifact?.antecedent?.hashSetSha256 !== index?.hashSetSha256
  )
    failures.push("v8 authorization pins wrong antecedent index");
  if (privateMaterialPaths(artifact).length)
    failures.push("v8 authorization contains private key or token material");
  try {
    const publicKeyPem = artifact?.signingPublicKey?.publicKeyPem;
    if (typeof publicKeyPem !== "string")
      throw new TypeError("missing public key");
    const publicKey = createPublicKey(publicKeyPem);
    const der = publicKey.export({ type: "spki", format: "der" });
    if (
      artifact?.signingPublicKey?.algorithm !== "Ed25519" ||
      artifact?.signingPublicKey?.encoding !== "SPKI-PEM" ||
      artifact?.signingPublicKey?.privateKeyStoredInRepository !== false ||
      artifact?.signingPublicKey?.spkiSha256 !== sha256(der) ||
      publicKey.asymmetricKeyType !== "ed25519"
    )
      failures.push("v8 Ed25519 public-key identity mismatch");
  } catch {
    failures.push("v8 Ed25519 public key is invalid");
  }
  if (
    !equalJson(artifact?.operatorBoundary?.target, COMBOBOX_LIVE_V15_TARGET) ||
    !equalJson(
      artifact?.operatorBoundary?.expectedDynamicTool,
      COMBOBOX_LIVE_V15_DYNAMIC_TOOL,
    ) ||
    artifact?.operatorBoundary?.externalOperatorOnly !== true ||
    artifact?.operatorBoundary?.oneMcpCallPerSignedRequest !== true
  )
    failures.push("wrong v8 target or dynamic tool");
  if (
    artifact?.denominator?.remoteRequests !== COMBOBOX_LIVE_V15_REMOTE_REQUESTS ||
    artifact?.denominator?.hostPhases !== COMBOBOX_LIVE_V15_HOST_PHASES ||
    artifact?.denominator?.captures !== COMBOBOX_LIVE_V15_CAPTURE_COUNT ||
    artifact?.denominator?.sourceRoots !== COMBOBOX_LIVE_V15_SOURCE_ROOTS ||
    artifact?.denominator?.expectedFacts !== index?.counts.expectedSceneFacts
  )
    failures.push("v1 two-root or capture denominator changed");
  if (
    artifact?.execution?.maximumAttempts !== 3 ||
    artifact?.execution?.attemptsExecuted !== 0 ||
    artifact?.execution?.captureBeforeHashBoundTechnicalGates !== false ||
    artifact?.execution
      ?.durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance !==
      true ||
    artifact?.execution?.cleanupMustRemainExecutableAfterHostFailure !== true ||
    artifact?.execution?.cleanupMustNotExecuteOnMainComplete !== true ||
    artifact?.execution?.taughtCleanupOnFailureOnly !== true ||
    artifact?.execution?.v7AuthorizationReusable !== false ||
    artifact?.execution?.v8AuthorizationReusable !== false ||
    artifact?.execution?.v9AuthorizationReusable !== false ||
    artifact?.execution?.v10AuthorizationReusable !== false ||
    artifact?.execution?.v11AuthorizationReusable !== false ||
    artifact?.execution?.v12AuthorizationReusable !== false ||
    artifact?.execution?.v13AuthorizationReusable !== false ||
    artifact?.execution?.v14AuthorizationReusable !== false ||
    artifact?.execution?.v15AuthorizationReusable !== false ||
    artifact?.execution?.v16AuthorizationReusable !== false ||
    artifact?.execution?.v17AuthorizationReusable !== false ||
    artifact?.execution?.v18AuthorizationReusable !== false ||
    artifact?.execution?.v19AuthorizationReusable !== false ||
    artifact?.execution?.v20AuthorizationReusable !== false ||
    artifact?.execution?.v21AuthorizationReusable !== false ||
    artifact?.execution?.v22AuthorizationReusable !== false ||
    artifact?.execution?.v23AuthorizationReusable !== false ||
    artifact?.execution?.v24AuthorizationReusable !== false ||
    artifact?.execution?.v25AuthorizationReusable !== false ||
    artifact?.execution?.v26AuthorizationReusable !== false ||
    artifact?.execution?.v27AuthorizationReusable !== false ||
    artifact?.execution?.v28AuthorizationReusable !== false ||
    artifact?.execution?.v29AuthorizationReusable !== false ||
    artifact?.execution?.v30AuthorizationReusable !== false ||
    artifact?.execution?.v31AuthorizationReusable !== false ||
    artifact?.execution?.v32AuthorizationReusable !== false ||
    artifact?.execution?.v33AuthorizationReusable !== false ||
    artifact?.execution?.v34AuthorizationReusable !== false ||
    artifact?.execution?.v35AuthorizationReusable !== false ||
    artifact?.execution?.v36AuthorizationReusable !== false ||
    artifact?.execution?.v85AuthorizationReusable !== false ||
    artifact?.execution?.inputV85AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV1AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV2AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV3AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV4AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV5AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV6AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV7AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV8AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV9AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV10AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV11AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV12AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV13AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV14AuthorizationReusable !== false
  )
    failures.push(
      "v15 execution, capture, cleanup, or prior-lineage reuse policy weakened",
    );
  if (
    artifact?.securityPrerequisite?.figmaPatRevokedOrReplacedRequired !==
      true ||
    artifact?.securityPrerequisite?.mcpRestartAfterRotationRequired !== true ||
    artifact?.securityPrerequisite?.ownerOnlyEnvironmentFileMode0600Required !==
      true ||
    artifact?.securityPrerequisite?.repositorySecretScanZeroRequired !== true ||
    artifact?.securityPrerequisite?.exactScratchReadOnlyProbeRequired !==
      true ||
    artifact?.securityPrerequisite?.tokenValuesForbidden !== true
  )
    failures.push("v8 security prerequisites weakened");
  if (
    artifact?.humanSignoff?.mandatory !== true ||
    artifact?.humanSignoff?.status !== "pending"
  )
    failures.push("v8 human signoff overclaim");
  return failures;
}

export function validateComboboxLiveV15History(
  state: ComboboxLiveV15HistoryState,
  expected: ComboboxLiveV15HistoryExpectation,
): string[] {
  const failures = validateComboboxLiveV15AntecedentIndex(state.index);
  if (!SHA40.test(state.codeCommit))
    failures.push("v8 code commit is not a full SHA");
  if (!state.clean) failures.push("dirty worktree");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("code commit is unpushed or differs from upstream");
  if (
    state.antecedentAddingCommits.length !== 1 ||
    state.antecedentCommit !== state.antecedentAddingCommits[0]
  )
    failures.push("v1 antecedent first-add commit is not unique");
  if (!state.antecedentIsAncestorOfCode)
    failures.push("code commit does not descend from v1 antecedent");
  if (!state.antecedentIndexBytesMatchFirstAddition)
    failures.push("v1 antecedent index changed after first addition");
  if (!state.antecedentArtifactsMatchIndexAtCommit)
    failures.push("v1 antecedent commit artifacts do not match index");
  if (!state.workingAntecedentArtifactsMatchIndex)
    failures.push("v1 antecedent working bytes drifted");

  const authorizationExists =
    state.authorizationAddingCommits.length > 0 ||
    state.authorizationCommit !== undefined ||
    state.authorizationPresentAtCodeCommit ||
    state.authorization !== undefined;
  if (expected === "pending") {
    if (authorizationExists)
      failures.push(
        "stale history mode: expected pending but authorization exists",
      );
    return failures;
  }
  if (!authorizationExists) {
    failures.push(
      "stale history mode: expected authorized but authorization is pending",
    );
    return failures;
  }
  failures.push(
    ...validateComboboxLiveV15AuthorizationArtifact(
      state.authorization,
      state.index,
      state.indexSha256,
    ),
  );
  if (
    state.authorization?.antecedent?.commit !== state.antecedentCommit ||
    state.authorizationAddingCommits.length !== 1 ||
    state.authorizationCommit !== state.authorizationAddingCommits[0]
  )
    failures.push("v8 authorization first-add lineage mismatch");
  if (!state.authorizationPresentAtCodeCommit)
    failures.push("v8 authorization missing from code commit");
  if (!state.authorizationBytesMatchFirstAddition)
    failures.push("v8 authorization bytes changed after first addition");
  if (!state.authorizationStrictlyDescendsFromAntecedent)
    failures.push("v8 authorization does not strictly descend from antecedent");
  if (!state.authorizationIsAncestorOfCode)
    failures.push("code commit predates v8 authorization");
  return failures;
}

const artifactSetMatches = (
  root: string,
  index: ComboboxLiveV15AntecedentIndex,
  commit?: string,
): boolean =>
  Object.entries(index.artifacts).every(([artifactPath, metadata]) => {
    try {
      const bytes = commit
        ? git(root, ["show", `${commit}:${artifactPath}`])
        : readFileSync(path.join(root, artifactPath));
      return (
        bytes.byteLength === metadata.bytes && sha256(bytes) === metadata.sha256
      );
    } catch {
      return false;
    }
  });

export function readComboboxLiveV15HistoryState(
  root = process.cwd(),
): ComboboxLiveV15HistoryState {
  const repositoryRoot = gitText(root, ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(repositoryRoot, ["rev-parse", "HEAD^{commit}"]);
  const upstreamCommit = tryGitText(repositoryRoot, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const indexFile = path.join(repositoryRoot, COMBOBOX_LIVE_V15_INDEX_PATH);
  const indexBytes = readFileSync(indexFile);
  const index = JSON.parse(
    indexBytes.toString("utf8"),
  ) as ComboboxLiveV15AntecedentIndex;
  const antecedentAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    COMBOBOX_LIVE_V15_INDEX_PATH,
  );
  const antecedentCommit = antecedentAddingCommits[0];
  const authorizationAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
  );
  const authorizationCommit = authorizationAddingCommits[0];
  const authorizationAtCode = objectExists(
    repositoryRoot,
    codeCommit,
    COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
  );
  const authorizationFile = path.join(
    repositoryRoot,
    COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
  );
  const authorization = existsSync(authorizationFile)
    ? (JSON.parse(
        readFileSync(authorizationFile, "utf8"),
      ) as ComboboxLiveV15AuthorizationArtifact)
    : undefined;
  const firstIndexBytes = antecedentCommit
    ? git(repositoryRoot, [
        "show",
        `${antecedentCommit}:${COMBOBOX_LIVE_V15_INDEX_PATH}`,
      ])
    : Buffer.alloc(0);
  const firstAuthorizationBytes = authorizationCommit
    ? git(repositoryRoot, [
        "show",
        `${authorizationCommit}:${COMBOBOX_LIVE_V15_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const currentAuthorizationBytes = authorizationAtCode
    ? git(repositoryRoot, [
        "show",
        `${codeCommit}:${COMBOBOX_LIVE_V15_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  return {
    index,
    indexSha256: sha256(indexBytes),
    antecedentAddingCommits,
    antecedentCommit,
    antecedentIsAncestorOfCode: isAncestor(
      repositoryRoot,
      antecedentCommit,
      codeCommit,
    ),
    antecedentIndexBytesMatchFirstAddition:
      firstIndexBytes.byteLength > 0 && firstIndexBytes.equals(indexBytes),
    antecedentArtifactsMatchIndexAtCommit:
      antecedentCommit !== undefined &&
      artifactSetMatches(repositoryRoot, index, antecedentCommit),
    workingAntecedentArtifactsMatchIndex: artifactSetMatches(
      repositoryRoot,
      index,
    ),
    authorization,
    authorizationAddingCommits,
    authorizationCommit,
    authorizationPresentAtCodeCommit: authorizationAtCode,
    authorizationBytesMatchFirstAddition:
      firstAuthorizationBytes.byteLength > 0 &&
      firstAuthorizationBytes.equals(currentAuthorizationBytes) &&
      firstAuthorizationBytes.equals(readFileSync(authorizationFile)),
    authorizationStrictlyDescendsFromAntecedent:
      authorizationCommit !== undefined &&
      authorizationCommit !== antecedentCommit &&
      isAncestor(repositoryRoot, antecedentCommit, authorizationCommit),
    authorizationIsAncestorOfCode: isAncestor(
      repositoryRoot,
      authorizationCommit,
      codeCommit,
    ),
    codeCommit,
    upstreamCommit,
    clean:
      gitText(repositoryRoot, [
        "status",
        "--porcelain",
        "--untracked-files=all",
      ]) === "",
  };
}

export function verifyComboboxLiveV15History(
  expected: ComboboxLiveV15HistoryExpectation,
  root = process.cwd(),
): ComboboxLiveV15HistoryState {
  const state = readComboboxLiveV15HistoryState(root);
  const failures = validateComboboxLiveV15History(state, expected);
  if (failures.length)
    throw new Error(
      `Combobox live v15 ${expected} history refused:\n${failures.join("\n")}`,
    );
  return state;
}

export function verifyComboboxLiveV15Authorization(
  root = process.cwd(),
): ComboboxLiveV15AuthorizationProof {
  const state = verifyComboboxLiveV15History("authorized", root);
  const artifact = state.authorization!;
  const repositoryRoot = gitText(root, ["rev-parse", "--show-toplevel"]);
  const currentTreeBytes = git(repositoryRoot, [
    "cat-file",
    "tree",
    `${state.codeCommit}^{tree}`,
  ]);
  return {
    mode: "live",
    protocolCommit: state.antecedentCommit!,
    runnerCommit: state.antecedentCommit!,
    authorizationCommit: state.authorizationCommit!,
    codeCommit: state.codeCommit,
    upstreamCommit: state.upstreamCommit!,
    authorizationSha256: sha256(
      readFileSync(
        path.join(repositoryRoot, COMBOBOX_LIVE_V15_AUTHORIZATION_PATH),
      ),
    ),
    protocolSha256:
      state.index!.artifacts[
        "recipe/evidence/combobox-live-pivot-v15/protocol.json"
      ]!.sha256,
    runnerSha256:
      state.index!.artifacts["recipe/run-combobox-live-v15.ts"]!.sha256,
    codeTreeSha256: sha256(currentTreeBytes),
    signingPublicKeySha256: artifact.signingPublicKey.spkiSha256,
    antecedentIndexSha256: state.indexSha256,
    antecedentHashSetSha256: state.index!.hashSetSha256,
    target: COMBOBOX_LIVE_V15_TARGET,
    expectedDynamicTool: COMBOBOX_LIVE_V15_DYNAMIC_TOOL,
    authorizationPath: COMBOBOX_LIVE_V15_AUTHORIZATION_PATH,
  };
}

const expectedMode = (): ComboboxLiveV15HistoryExpectation => {
  const pending = process.argv.includes("--expect-pending");
  const authorized = process.argv.includes("--expect-authorized");
  if (pending === authorized)
    throw new Error(
      "Choose exactly one v8 history mode: --expect-pending or --expect-authorized",
    );
  return pending ? "pending" : "authorized";
};

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const expected = expectedMode();
  const state = verifyComboboxLiveV15History(expected);
  process.stdout.write(
    `Combobox live v15 history ${expected}: antecedent=${state.antecedentCommit} authorization=${state.authorizationCommit ?? "pending"} code=${state.codeCommit}\n`,
  );
}
