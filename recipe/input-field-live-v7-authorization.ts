import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V7_DYNAMIC_TOOL,
  INPUT_LIVE_V7_TARGET,
  type InputLiveV7TransactionAuthorization,
} from "./input-field-live-v7-broker.js";
import {
  INPUT_LIVE_V7_AUTHORIZATION_PATH,
  INPUT_LIVE_V7_INDEX_PATH,
} from "./build-input-field-live-proof-v7.js";
import { canonicalJson } from "./normalize.js";

export const INPUT_LIVE_V7_FIRST_AUTHORIZATION_PATH =
  INPUT_LIVE_V7_AUTHORIZATION_PATH;
export const INPUT_LIVE_V7_AUTHORIZATION_V2_PATH =
  "recipe/evidence/input-field-live-pivot-v7/capture-authorization-v2.json";
export const INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV =
  "INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_PATH";
export const INPUT_LIVE_V7_FIRST_AUTHORIZATION_SHA256 =
  "43277ff2f422c9117e2f4f1b5c0fea241cc967977666529d91e0f14fd7489fda";

export type InputLiveV7HistoryExpectation =
  "pending" | "authorized" | "pending-v2" | "authorized-v2";

export interface InputLiveV7AuthorizationArtifact {
  artifactVersion: "input-live-v7-capture-authorization-v1";
  authorizationId: "input-live-v7";
  status: "authorization declared; runtime security prerequisites still mandatory";
  authorizationIntent: true;
  antecedent: {
    commit: string;
    indexPath: typeof INPUT_LIVE_V7_INDEX_PATH;
    indexSha256: string;
    hashSetSha256: string;
    artifacts: Record<string, { bytes: number; sha256: string }>;
  };
  signingPublicKey: {
    algorithm: "Ed25519";
    encoding: "SPKI-PEM";
    publicKeyPem: string;
    spkiSha256: string;
    privateKeyStoredInRepository: false;
  };
  operatorBoundary: {
    target: typeof INPUT_LIVE_V7_TARGET;
    expectedDynamicTool: typeof INPUT_LIVE_V7_DYNAMIC_TOOL;
    externalOperatorOnly: true;
    oneMcpCallPerSignedRequest: true;
  };
  denominator: {
    remoteRequests: 132;
    hostPhases: 3;
    captures: 128;
    sourceRoots: 2;
    expectedFacts: 43726;
  };
  execution: {
    phaseOrder: [
      "writer",
      "persist signed cleanup recovery request",
      "extract",
      "host normalize and account both roots",
      "probe",
      "host bind technical gates",
      "capture-000 through capture-127",
      "cleanup",
    ];
    maximumAttempts: 3;
    attemptsExecuted: 0;
    cleanWorktreeRequired: true;
    upstreamEqualityRequired: true;
    codeCommitMustStrictlyDescendFromAntecedent: true;
    authorizationArtifactMustBeCommittedUnchanged: true;
    captureBeforeHashBoundTechnicalGates: false;
    durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true;
    cleanupMustRemainExecutableAfterHostFailure: true;
    v6AuthorizationReusable: false;
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

export interface InputLiveV7ReplacementAuthorizationArtifact extends Omit<
  InputLiveV7AuthorizationArtifact,
  "artifactVersion" | "status"
> {
  artifactVersion: "input-live-v7-capture-authorization-v2";
  status: "replacement authorization declared; runtime security prerequisites still mandatory";
  supersession: {
    supersedesPath: typeof INPUT_LIVE_V7_FIRST_AUTHORIZATION_PATH;
    supersedesSha256: typeof INPUT_LIVE_V7_FIRST_AUTHORIZATION_SHA256;
    reason: "first authorization signer private key unavailable";
    firstAuthorizationBytesPreserved: true;
    firstAuthorizationUsableForExecution: false;
    criteriaChanged: false;
  };
  runtimeSigning: {
    privateKeyPathEnvironmentVariable: typeof INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV;
    explicitOwnerOnlyPathRequired: true;
    pkcs8PemRequired: true;
    mode0600Required: true;
    trackedKeyRefused: true;
    publicPrivateIdentityMatchRequired: true;
  };
}

export interface InputLiveV7AntecedentIndex {
  artifactVersion: "input-live-v7-antecedent-index-v1";
  status: string;
  artifacts: Record<string, { bytes: number; sha256: string }>;
  hashSetSha256: string;
  authorizationLifecycleExcluded: string[];
  authorizationCanBeAddedWithoutAntecedentRebuild: true;
}

export interface InputLiveV7HistoryState {
  index?: InputLiveV7AntecedentIndex;
  indexSha256: string;
  antecedentAddingCommits: string[];
  antecedentCommit?: string;
  antecedentIsAncestorOfCode: boolean;
  antecedentIndexBytesMatchFirstAddition: boolean;
  antecedentArtifactsMatchIndexAtCommit: boolean;
  workingAntecedentArtifactsMatchIndex: boolean;
  authorization?: InputLiveV7AuthorizationArtifact;
  authorizationAddingCommits: string[];
  authorizationCommit?: string;
  authorizationPresentAtCodeCommit: boolean;
  authorizationBytesMatchFirstAddition: boolean;
  firstAuthorizationSha256?: string;
  authorizationStrictlyDescendsFromAntecedent: boolean;
  authorizationIsAncestorOfCode: boolean;
  replacementAuthorization?: InputLiveV7ReplacementAuthorizationArtifact;
  replacementAuthorizationAddingCommits?: string[];
  replacementAuthorizationCommit?: string;
  replacementAuthorizationPresentAtCodeCommit?: boolean;
  replacementAuthorizationBytesMatchFirstAddition?: boolean;
  replacementAuthorizationStrictlyDescendsFromAntecedent?: boolean;
  replacementAuthorizationDescendsFromFirstAuthorization?: boolean;
  replacementAuthorizationIsAncestorOfCode?: boolean;
  codeCommit: string;
  upstreamCommit?: string;
  clean: boolean;
  pendingChangesOnlyAuthorizationLifecycle?: boolean;
}

export interface InputLiveV7AuthorizationProof extends InputLiveV7TransactionAuthorization {
  upstreamCommit: string;
  antecedentIndexSha256: string;
  antecedentHashSetSha256: string;
  target: typeof INPUT_LIVE_V7_TARGET;
  expectedDynamicTool: typeof INPUT_LIVE_V7_DYNAMIC_TOOL;
  authorizationPath: typeof INPUT_LIVE_V7_AUTHORIZATION_V2_PATH;
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
  artifactPath === INPUT_LIVE_V7_AUTHORIZATION_PATH ||
  artifactPath === INPUT_LIVE_V7_AUTHORIZATION_V2_PATH ||
  artifactPath.endsWith("/authorization-template.json") ||
  artifactPath.endsWith("/operator-security-attestation-template.json") ||
  artifactPath.includes("create-input-field-live-v7-security-attestation") ||
  artifactPath.includes("input-field-live-v7-authorization") ||
  artifactPath.includes("input-field-live-v7-preflight") ||
  artifactPath.includes("input-field-live-v7-authorized") ||
  artifactPath.includes("input-field-live-pivot-v7-status") ||
  artifactPath === "package.json" ||
  artifactPath === "recipe/pivot-status.ts" ||
  artifactPath === "recipe/pivot-status.test.ts" ||
  artifactPath === "docs/32-recipe-ir-pivot.md" ||
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

export function validateInputLiveV7AntecedentIndex(
  index: InputLiveV7AntecedentIndex | undefined,
): string[] {
  const failures: string[] = [];
  if (
    index?.artifactVersion !== "input-live-v7-antecedent-index-v1" ||
    index.authorizationCanBeAddedWithoutAntecedentRebuild !== true
  )
    failures.push("v7 antecedent index missing or malformed");
  const artifactEntries = Object.entries(index?.artifacts ?? {});
  if (artifactEntries.length === 0)
    failures.push("v7 antecedent hash denominator is empty");
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
      failures.push(`malformed v7 antecedent hash: ${artifactPath}`);
  }
  const expectedHashSet = sha256(
    JSON.stringify(
      artifactEntries.sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  if (index?.hashSetSha256 !== expectedHashSet)
    failures.push("v7 antecedent hash-set digest mismatch");
  for (const required of [
    INPUT_LIVE_V7_AUTHORIZATION_PATH,
    "recipe/input-field-live-v7-authorization.ts",
    "recipe/input-field-live-v7-authorization.test.ts",
    "recipe/input-field-live-v7-preflight.ts",
    "recipe/evidence/input-field-live-pivot-v7/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ])
    if (!index?.authorizationLifecycleExcluded?.includes(required))
      failures.push(`v7 lifecycle exclusion missing: ${required}`);
  const leaks = forbiddenAntecedentFieldPaths(index);
  if (leaks.length)
    failures.push(`v7 antecedent result leakage: ${leaks.join(",")}`);
  return failures;
}

export function validateInputLiveV7UnitTestSource(source: string): string[] {
  const failures: string[] = [];
  if (
    /assert\.throws\([\s\S]{0,300}verifyInputLiveV\d+Authorization\(\)/.test(
      source,
    ) ||
    /verifyInputLiveV7History\(\s*["']/.test(source) ||
    /readInputLiveV7HistoryState\(/.test(source)
  )
    failures.push(
      "phase-sensitive unit test invokes current repository history",
    );
  return failures;
}

export function buildInputLiveV7AuthorizationArtifact(options: {
  antecedentCommit: string;
  antecedentIndexBytes: Uint8Array;
  signingPublicKey: KeyObject | string | Buffer;
}): InputLiveV7AuthorizationArtifact {
  if (!SHA40.test(options.antecedentCommit))
    throw new TypeError("v7 antecedent commit must be a full SHA");
  const index = JSON.parse(
    Buffer.from(options.antecedentIndexBytes).toString("utf8"),
  ) as InputLiveV7AntecedentIndex;
  const indexFailures = validateInputLiveV7AntecedentIndex(index);
  if (indexFailures.length)
    throw new TypeError(
      `v7 antecedent index refused:\n${indexFailures.join("\n")}`,
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
    artifactVersion: "input-live-v7-capture-authorization-v1",
    authorizationId: "input-live-v7",
    status:
      "authorization declared; runtime security prerequisites still mandatory",
    authorizationIntent: true,
    antecedent: {
      commit: options.antecedentCommit,
      indexPath: INPUT_LIVE_V7_INDEX_PATH,
      indexSha256: sha256(options.antecedentIndexBytes),
      hashSetSha256: index.hashSetSha256,
      artifacts: structuredClone(index.artifacts),
    },
    signingPublicKey: {
      algorithm: "Ed25519",
      encoding: "SPKI-PEM",
      publicKeyPem,
      spkiSha256,
      privateKeyStoredInRepository: false,
    },
    operatorBoundary: {
      target: INPUT_LIVE_V7_TARGET,
      expectedDynamicTool: INPUT_LIVE_V7_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: 132,
      hostPhases: 3,
      captures: 128,
      sourceRoots: 2,
      expectedFacts: 43_726,
    },
    execution: {
      phaseOrder: [
        "writer",
        "persist signed cleanup recovery request",
        "extract",
        "host normalize and account both roots",
        "probe",
        "host bind technical gates",
        "capture-000 through capture-127",
        "cleanup",
      ],
      maximumAttempts: 3,
      attemptsExecuted: 0,
      cleanWorktreeRequired: true,
      upstreamEqualityRequired: true,
      codeCommitMustStrictlyDescendFromAntecedent: true,
      authorizationArtifactMustBeCommittedUnchanged: true,
      captureBeforeHashBoundTechnicalGates: false,
      durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true,
      cleanupMustRemainExecutableAfterHostFailure: true,
      v6AuthorizationReusable: false,
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

export function buildInputLiveV7ReplacementAuthorizationArtifact(options: {
  antecedentCommit: string;
  antecedentIndexBytes: Uint8Array;
  signingPublicKey: KeyObject | string | Buffer;
}): InputLiveV7ReplacementAuthorizationArtifact {
  const first = buildInputLiveV7AuthorizationArtifact(options);
  return {
    ...first,
    artifactVersion: "input-live-v7-capture-authorization-v2",
    status:
      "replacement authorization declared; runtime security prerequisites still mandatory",
    supersession: {
      supersedesPath: INPUT_LIVE_V7_FIRST_AUTHORIZATION_PATH,
      supersedesSha256: INPUT_LIVE_V7_FIRST_AUTHORIZATION_SHA256,
      reason: "first authorization signer private key unavailable",
      firstAuthorizationBytesPreserved: true,
      firstAuthorizationUsableForExecution: false,
      criteriaChanged: false,
    },
    runtimeSigning: {
      privateKeyPathEnvironmentVariable: INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV,
      explicitOwnerOnlyPathRequired: true,
      pkcs8PemRequired: true,
      mode0600Required: true,
      trackedKeyRefused: true,
      publicPrivateIdentityMatchRequired: true,
    },
  };
}

export function validateInputLiveV7AuthorizationArtifact(
  artifact: InputLiveV7AuthorizationArtifact | undefined,
  index: InputLiveV7AntecedentIndex | undefined,
  indexSha256: string,
): string[] {
  const failures: string[] = [];
  if (
    artifact?.artifactVersion !== "input-live-v7-capture-authorization-v1" ||
    artifact.authorizationId !== "input-live-v7" ||
    artifact.authorizationIntent !== true
  )
    failures.push("v7 authorization declaration missing or malformed");
  const resultLeaks = forbiddenAntecedentFieldPaths(artifact);
  if (resultLeaks.length)
    failures.push(`v7 authorization result leakage: ${resultLeaks.join(",")}`);
  if (
    artifact?.antecedent?.indexPath !== INPUT_LIVE_V7_INDEX_PATH ||
    artifact?.antecedent?.indexSha256 !== indexSha256 ||
    artifact?.antecedent?.hashSetSha256 !== index?.hashSetSha256 ||
    !equalJson(artifact?.antecedent?.artifacts, index?.artifacts)
  )
    failures.push("v7 authorization pins wrong antecedent index");
  if (privateMaterialPaths(artifact).length)
    failures.push("v7 authorization contains private key or token material");
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
      failures.push("v7 Ed25519 public-key identity mismatch");
  } catch {
    failures.push("v7 Ed25519 public key is invalid");
  }
  if (
    !equalJson(artifact?.operatorBoundary?.target, INPUT_LIVE_V7_TARGET) ||
    !equalJson(
      artifact?.operatorBoundary?.expectedDynamicTool,
      INPUT_LIVE_V7_DYNAMIC_TOOL,
    ) ||
    artifact?.operatorBoundary?.externalOperatorOnly !== true ||
    artifact?.operatorBoundary?.oneMcpCallPerSignedRequest !== true
  )
    failures.push("wrong v7 target or dynamic tool");
  if (
    artifact?.denominator?.remoteRequests !== 132 ||
    artifact?.denominator?.hostPhases !== 3 ||
    artifact?.denominator?.captures !== 128 ||
    artifact?.denominator?.sourceRoots !== 2 ||
    artifact?.denominator?.expectedFacts !== 43_726
  )
    failures.push("v7 two-root or capture denominator changed");
  if (
    !equalJson(artifact?.execution?.phaseOrder, [
      "writer",
      "persist signed cleanup recovery request",
      "extract",
      "host normalize and account both roots",
      "probe",
      "host bind technical gates",
      "capture-000 through capture-127",
      "cleanup",
    ]) ||
    artifact?.execution?.maximumAttempts !== 3 ||
    artifact?.execution?.attemptsExecuted !== 0 ||
    artifact?.execution?.cleanWorktreeRequired !== true ||
    artifact?.execution?.upstreamEqualityRequired !== true ||
    artifact?.execution?.codeCommitMustStrictlyDescendFromAntecedent !== true ||
    artifact?.execution?.authorizationArtifactMustBeCommittedUnchanged !==
      true ||
    artifact?.execution?.captureBeforeHashBoundTechnicalGates !== false ||
    artifact?.execution
      ?.durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance !==
      true ||
    artifact?.execution?.cleanupMustRemainExecutableAfterHostFailure !== true ||
    artifact?.execution?.v6AuthorizationReusable !== false
  )
    failures.push(
      "v7 phase order, lineage, execution, capture, cleanup, or v6-reuse policy weakened",
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
    failures.push("v7 security prerequisites weakened");
  if (
    artifact?.humanSignoff?.mandatory !== true ||
    artifact?.humanSignoff?.status !== "pending"
  )
    failures.push("v7 human signoff overclaim");
  return failures;
}

export function validateInputLiveV7ReplacementAuthorizationArtifact(
  artifact: InputLiveV7ReplacementAuthorizationArtifact | undefined,
  index: InputLiveV7AntecedentIndex | undefined,
  indexSha256: string,
): string[] {
  if (!artifact)
    return ["v7 replacement authorization declaration missing or malformed"];
  const {
    supersession,
    runtimeSigning,
    artifactVersion: _artifactVersion,
    status: _status,
    ...shared
  } = artifact;
  const failures = validateInputLiveV7AuthorizationArtifact(
    {
      ...shared,
      artifactVersion: "input-live-v7-capture-authorization-v1",
      status:
        "authorization declared; runtime security prerequisites still mandatory",
    },
    index,
    indexSha256,
  ).map((failure) =>
    failure.replace("v7 authorization", "v7 replacement authorization"),
  );
  if (
    artifact.artifactVersion !== "input-live-v7-capture-authorization-v2" ||
    artifact.status !==
      "replacement authorization declared; runtime security prerequisites still mandatory"
  )
    failures.push(
      "v7 replacement authorization declaration missing or malformed",
    );
  if (
    supersession?.supersedesPath !== INPUT_LIVE_V7_FIRST_AUTHORIZATION_PATH ||
    supersession?.supersedesSha256 !==
      INPUT_LIVE_V7_FIRST_AUTHORIZATION_SHA256 ||
    supersession?.reason !==
      "first authorization signer private key unavailable" ||
    supersession?.firstAuthorizationBytesPreserved !== true ||
    supersession?.firstAuthorizationUsableForExecution !== false ||
    supersession?.criteriaChanged !== false
  )
    failures.push(
      "v7 replacement must supersede the unusable first signer without changing criteria",
    );
  if (
    runtimeSigning?.privateKeyPathEnvironmentVariable !==
      INPUT_LIVE_V7_OPERATOR_PRIVATE_KEY_ENV ||
    runtimeSigning?.explicitOwnerOnlyPathRequired !== true ||
    runtimeSigning?.pkcs8PemRequired !== true ||
    runtimeSigning?.mode0600Required !== true ||
    runtimeSigning?.trackedKeyRefused !== true ||
    runtimeSigning?.publicPrivateIdentityMatchRequired !== true
  )
    failures.push("v7 replacement runtime signing policy weakened");
  return failures;
}

export function validateInputLiveV7History(
  state: InputLiveV7HistoryState,
  expected: InputLiveV7HistoryExpectation,
): string[] {
  const failures = validateInputLiveV7AntecedentIndex(state.index);
  if (!SHA40.test(state.codeCommit))
    failures.push("v7 code commit is not a full SHA");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("code commit is unpushed or differs from upstream");
  if (
    state.antecedentAddingCommits.length !== 1 ||
    state.antecedentCommit !== state.antecedentAddingCommits[0]
  )
    failures.push("v7 antecedent first-add commit is not unique");
  if (!state.antecedentIsAncestorOfCode)
    failures.push("code commit does not descend from v7 antecedent");
  if (!state.antecedentIndexBytesMatchFirstAddition)
    failures.push("v7 antecedent index changed after first addition");
  if (!state.antecedentArtifactsMatchIndexAtCommit)
    failures.push("v7 antecedent commit artifacts do not match index");
  if (!state.workingAntecedentArtifactsMatchIndex)
    failures.push("v7 antecedent working bytes drifted");

  if (expected === "pending-v2" || expected === "authorized-v2") {
    failures.push(
      ...validateInputLiveV7AuthorizationArtifact(
        state.authorization,
        state.index,
        state.indexSha256,
      ),
    );
    if (
      state.authorizationAddingCommits.length !== 1 ||
      state.authorizationCommit !== state.authorizationAddingCommits[0] ||
      !state.authorizationPresentAtCodeCommit ||
      !state.authorizationBytesMatchFirstAddition ||
      state.firstAuthorizationSha256 !==
        INPUT_LIVE_V7_FIRST_AUTHORIZATION_SHA256 ||
      !state.authorizationStrictlyDescendsFromAntecedent ||
      !state.authorizationIsAncestorOfCode
    )
      failures.push(
        "v7 first authorization history changed or is not preserved",
      );
    if (
      state.replacementAuthorization &&
      state.authorization?.signingPublicKey.spkiSha256 ===
        state.replacementAuthorization.signingPublicKey.spkiSha256
    )
      failures.push("v7 replacement reused the unavailable first signer");

    const replacementExists =
      (state.replacementAuthorizationAddingCommits?.length ?? 0) > 0 ||
      state.replacementAuthorizationCommit !== undefined ||
      state.replacementAuthorizationPresentAtCodeCommit ||
      state.replacementAuthorization !== undefined;
    if (expected === "pending-v2") {
      const committedReplacementExists =
        (state.replacementAuthorizationAddingCommits?.length ?? 0) > 0 ||
        state.replacementAuthorizationCommit !== undefined ||
        state.replacementAuthorizationPresentAtCodeCommit;
      if (committedReplacementExists)
        failures.push(
          "stale history mode: expected pending-v2 but committed replacement authorization exists",
        );
      if (!state.clean && !state.pendingChangesOnlyAuthorizationLifecycle)
        failures.push(
          "pending-v2 history contains non-lifecycle worktree changes",
        );
      if (state.replacementAuthorization !== undefined) {
        failures.push(
          ...validateInputLiveV7ReplacementAuthorizationArtifact(
            state.replacementAuthorization,
            state.index,
            state.indexSha256,
          ),
        );
        if (
          state.replacementAuthorization.antecedent.commit !==
          state.antecedentCommit
        )
          failures.push(
            "pending v7 replacement authorization pins wrong antecedent commit",
          );
      }
      return failures;
    }

    if (!state.clean) failures.push("dirty worktree");
    if (!replacementExists) {
      failures.push(
        "stale history mode: expected authorized-v2 but replacement authorization is pending",
      );
      return failures;
    }
    if (
      state.replacementAuthorization !== undefined &&
      (state.replacementAuthorizationAddingCommits?.length ?? 0) === 0
    ) {
      failures.push("pending-uncommitted-replacement-authorization");
      return failures;
    }
    failures.push(
      ...validateInputLiveV7ReplacementAuthorizationArtifact(
        state.replacementAuthorization,
        state.index,
        state.indexSha256,
      ),
    );
    if (
      state.replacementAuthorization?.antecedent.commit !==
        state.antecedentCommit ||
      state.replacementAuthorizationAddingCommits?.length !== 1 ||
      state.replacementAuthorizationCommit !==
        state.replacementAuthorizationAddingCommits?.[0]
    )
      failures.push("v7 replacement authorization first-add lineage mismatch");
    if (!state.replacementAuthorizationPresentAtCodeCommit)
      failures.push("v7 replacement authorization missing from code commit");
    if (!state.replacementAuthorizationBytesMatchFirstAddition)
      failures.push(
        "v7 replacement authorization bytes changed after first addition",
      );
    if (!state.replacementAuthorizationStrictlyDescendsFromAntecedent)
      failures.push(
        "v7 replacement authorization does not strictly descend from antecedent",
      );
    if (!state.replacementAuthorizationDescendsFromFirstAuthorization)
      failures.push(
        "v7 replacement authorization does not descend from first authorization",
      );
    if (!state.replacementAuthorizationIsAncestorOfCode)
      failures.push("code commit predates v7 replacement authorization");
    return failures;
  }

  const authorizationExists =
    state.authorizationAddingCommits.length > 0 ||
    state.authorizationCommit !== undefined ||
    state.authorizationPresentAtCodeCommit ||
    state.authorization !== undefined;
  if (expected === "pending") {
    const committedAuthorizationExists =
      state.authorizationAddingCommits.length > 0 ||
      state.authorizationCommit !== undefined ||
      state.authorizationPresentAtCodeCommit;
    if (committedAuthorizationExists)
      failures.push(
        "stale history mode: expected pending but committed authorization exists",
      );
    if (!state.clean && !state.pendingChangesOnlyAuthorizationLifecycle)
      failures.push("pending history contains non-lifecycle worktree changes");
    if (state.authorization !== undefined) {
      failures.push(
        ...validateInputLiveV7AuthorizationArtifact(
          state.authorization,
          state.index,
          state.indexSha256,
        ),
      );
      if (state.authorization.antecedent.commit !== state.antecedentCommit)
        failures.push("pending v7 authorization pins wrong antecedent commit");
    }
    return failures;
  }
  if (!state.clean) failures.push("dirty worktree");
  if (!authorizationExists) {
    failures.push(
      "stale history mode: expected authorized but authorization is pending",
    );
    return failures;
  }
  if (
    state.authorization !== undefined &&
    state.authorizationAddingCommits.length === 0
  ) {
    failures.push("pending-uncommitted-authorization");
    return failures;
  }
  failures.push(
    ...validateInputLiveV7AuthorizationArtifact(
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
    failures.push("v7 authorization first-add lineage mismatch");
  if (!state.authorizationPresentAtCodeCommit)
    failures.push("v7 authorization missing from code commit");
  if (!state.authorizationBytesMatchFirstAddition)
    failures.push("v7 authorization bytes changed after first addition");
  if (!state.authorizationStrictlyDescendsFromAntecedent)
    failures.push("v7 authorization does not strictly descend from antecedent");
  if (!state.authorizationIsAncestorOfCode)
    failures.push("code commit predates v7 authorization");
  return failures;
}

const artifactSetMatches = (
  root: string,
  index: InputLiveV7AntecedentIndex,
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

export function readInputLiveV7HistoryState(
  root = process.cwd(),
): InputLiveV7HistoryState {
  const repositoryRoot = gitText(root, ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(repositoryRoot, ["rev-parse", "HEAD^{commit}"]);
  const upstreamCommit = tryGitText(repositoryRoot, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const indexFile = path.join(repositoryRoot, INPUT_LIVE_V7_INDEX_PATH);
  const indexBytes = readFileSync(indexFile);
  const index = JSON.parse(
    indexBytes.toString("utf8"),
  ) as InputLiveV7AntecedentIndex;
  const antecedentAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    INPUT_LIVE_V7_INDEX_PATH,
  );
  const antecedentCommit = antecedentAddingCommits[0];
  const authorizationAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    INPUT_LIVE_V7_AUTHORIZATION_PATH,
  );
  const authorizationCommit = authorizationAddingCommits[0];
  const authorizationAtCode = objectExists(
    repositoryRoot,
    codeCommit,
    INPUT_LIVE_V7_AUTHORIZATION_PATH,
  );
  const authorizationFile = path.join(
    repositoryRoot,
    INPUT_LIVE_V7_AUTHORIZATION_PATH,
  );
  const authorization = existsSync(authorizationFile)
    ? (JSON.parse(
        readFileSync(authorizationFile, "utf8"),
      ) as InputLiveV7AuthorizationArtifact)
    : undefined;
  const replacementAuthorizationAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  );
  const replacementAuthorizationCommit =
    replacementAuthorizationAddingCommits[0];
  const replacementAuthorizationAtCode = objectExists(
    repositoryRoot,
    codeCommit,
    INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  );
  const replacementAuthorizationFile = path.join(
    repositoryRoot,
    INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  );
  const replacementAuthorization = existsSync(replacementAuthorizationFile)
    ? (JSON.parse(
        readFileSync(replacementAuthorizationFile, "utf8"),
      ) as InputLiveV7ReplacementAuthorizationArtifact)
    : undefined;
  const firstIndexBytes = antecedentCommit
    ? git(repositoryRoot, [
        "show",
        `${antecedentCommit}:${INPUT_LIVE_V7_INDEX_PATH}`,
      ])
    : Buffer.alloc(0);
  const firstAuthorizationBytes = authorizationCommit
    ? git(repositoryRoot, [
        "show",
        `${authorizationCommit}:${INPUT_LIVE_V7_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const currentAuthorizationBytes = authorizationAtCode
    ? git(repositoryRoot, [
        "show",
        `${codeCommit}:${INPUT_LIVE_V7_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const firstReplacementAuthorizationBytes = replacementAuthorizationCommit
    ? git(repositoryRoot, [
        "show",
        `${replacementAuthorizationCommit}:${INPUT_LIVE_V7_AUTHORIZATION_V2_PATH}`,
      ])
    : Buffer.alloc(0);
  const currentReplacementAuthorizationBytes = replacementAuthorizationAtCode
    ? git(repositoryRoot, [
        "show",
        `${codeCommit}:${INPUT_LIVE_V7_AUTHORIZATION_V2_PATH}`,
      ])
    : Buffer.alloc(0);
  const statusEntries = git(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ])
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .filter(Boolean);
  const pendingPaths = statusEntries.map((entry) => {
    const value = entry.slice(3);
    const rename = value.lastIndexOf(" -> ");
    return rename >= 0 ? value.slice(rename + 4) : value;
  });
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
    firstAuthorizationSha256:
      firstAuthorizationBytes.byteLength > 0
        ? sha256(firstAuthorizationBytes)
        : undefined,
    authorizationStrictlyDescendsFromAntecedent:
      authorizationCommit !== undefined &&
      authorizationCommit !== antecedentCommit &&
      isAncestor(repositoryRoot, antecedentCommit, authorizationCommit),
    authorizationIsAncestorOfCode: isAncestor(
      repositoryRoot,
      authorizationCommit,
      codeCommit,
    ),
    replacementAuthorization,
    replacementAuthorizationAddingCommits,
    replacementAuthorizationCommit,
    replacementAuthorizationPresentAtCodeCommit: replacementAuthorizationAtCode,
    replacementAuthorizationBytesMatchFirstAddition:
      firstReplacementAuthorizationBytes.byteLength > 0 &&
      firstReplacementAuthorizationBytes.equals(
        currentReplacementAuthorizationBytes,
      ) &&
      firstReplacementAuthorizationBytes.equals(
        readFileSync(replacementAuthorizationFile),
      ),
    replacementAuthorizationStrictlyDescendsFromAntecedent:
      replacementAuthorizationCommit !== undefined &&
      replacementAuthorizationCommit !== antecedentCommit &&
      isAncestor(
        repositoryRoot,
        antecedentCommit,
        replacementAuthorizationCommit,
      ),
    replacementAuthorizationDescendsFromFirstAuthorization:
      replacementAuthorizationCommit !== undefined &&
      isAncestor(
        repositoryRoot,
        authorizationCommit,
        replacementAuthorizationCommit,
      ),
    replacementAuthorizationIsAncestorOfCode: isAncestor(
      repositoryRoot,
      replacementAuthorizationCommit,
      codeCommit,
    ),
    codeCommit,
    upstreamCommit,
    clean: statusEntries.length === 0,
    pendingChangesOnlyAuthorizationLifecycle:
      pendingPaths.length > 0 && pendingPaths.every(lifecyclePath),
  };
}

export function verifyInputLiveV7History(
  expected: InputLiveV7HistoryExpectation,
  root = process.cwd(),
): InputLiveV7HistoryState {
  const state = readInputLiveV7HistoryState(root);
  const failures = validateInputLiveV7History(state, expected);
  if (failures.length)
    throw new Error(
      `Input live v7 ${expected} history refused:\n${failures.join("\n")}`,
    );
  return state;
}

export function verifyInputLiveV7Authorization(
  root = process.cwd(),
): InputLiveV7AuthorizationProof {
  const state = verifyInputLiveV7History("authorized-v2", root);
  const artifact = state.replacementAuthorization!;
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
    authorizationCommit: state.replacementAuthorizationCommit!,
    codeCommit: state.codeCommit,
    upstreamCommit: state.upstreamCommit!,
    authorizationSha256: sha256(
      readFileSync(
        path.join(repositoryRoot, INPUT_LIVE_V7_AUTHORIZATION_V2_PATH),
      ),
    ),
    protocolSha256:
      state.index!.artifacts[
        "recipe/evidence/input-field-live-pivot-v7/protocol.json"
      ]!.sha256,
    runnerSha256:
      state.index!.artifacts["recipe/run-input-field-live-v7.ts"]!.sha256,
    codeTreeSha256: sha256(currentTreeBytes),
    signingPublicKeySha256: artifact.signingPublicKey.spkiSha256,
    antecedentIndexSha256: state.indexSha256,
    antecedentHashSetSha256: state.index!.hashSetSha256,
    target: INPUT_LIVE_V7_TARGET,
    expectedDynamicTool: INPUT_LIVE_V7_DYNAMIC_TOOL,
    authorizationPath: INPUT_LIVE_V7_AUTHORIZATION_V2_PATH,
  };
}

const expectedMode = (): InputLiveV7HistoryExpectation => {
  const pending = process.argv.includes("--expect-pending-v2");
  const authorized = process.argv.includes("--expect-authorized-v2");
  if (pending === authorized)
    throw new Error(
      "Choose exactly one v7 history mode: --expect-pending-v2 or --expect-authorized-v2",
    );
  return pending ? "pending-v2" : "authorized-v2";
};

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const expected = expectedMode();
  const state = verifyInputLiveV7History(expected);
  process.stdout.write(
    `Input live v7 history ${expected}: antecedent=${state.antecedentCommit} firstAuthorization=${state.authorizationCommit ?? "missing"} replacementAuthorization=${state.replacementAuthorizationCommit ?? (state.replacementAuthorization ? "pending-uncommitted" : "pending")} code=${state.codeCommit}\n`,
  );
}
