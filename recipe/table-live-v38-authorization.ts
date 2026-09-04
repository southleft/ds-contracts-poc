import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  TABLE_LIVE_V38_DYNAMIC_TOOL,
  TABLE_LIVE_V38_TARGET,
  type TableLiveV38TransactionAuthorization,
} from "./table-live-v38-broker.js";
import {
  TABLE_LIVE_V38_AUTHORIZATION_PATH,
  TABLE_LIVE_V38_INDEX_PATH,
} from "./build-table-live-proof-v38.js";
import {
  TABLE_LIVE_V38_CAPTURE_COUNT,
  TABLE_LIVE_V38_HOST_PHASES,
  TABLE_LIVE_V38_REMOTE_REQUESTS,
  TABLE_LIVE_V38_SOURCE_ROOTS,
} from "./table-live-v38-contract.js";
import { canonicalJson } from "./normalize.js";

export type TableLiveV38HistoryExpectation = "pending" | "authorized";

export interface TableLiveV38AuthorizationArtifact {
  artifactVersion: "table-live-v38-capture-authorization-v1";
  authorizationId: "table-live-v38";
  status: "authorization declared; runtime security prerequisites still mandatory";
  authorizationIntent: true;
  antecedent: {
    commit: string;
    indexPath: typeof TABLE_LIVE_V38_INDEX_PATH;
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
    target: typeof TABLE_LIVE_V38_TARGET;
    expectedDynamicTool: typeof TABLE_LIVE_V38_DYNAMIC_TOOL;
    externalOperatorOnly: true;
    oneMcpCallPerSignedRequest: true;
  };
  denominator: {
    remoteRequests: 25;
    hostPhases: 3;
    captures: 20;
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
    inputV85AuthorizationReusable: false;
    comboboxLiveV41AuthorizationReusable: false;
    comboboxLiveV1AuthorizationReusable: false;
    tableLiveV1AuthorizationReusable: false;
    tableLiveV2AuthorizationReusable: false;
    tableLiveV3AuthorizationReusable: false;
    tableLiveV4AuthorizationReusable: false;
    tableLiveV5AuthorizationReusable: false;
    tableLiveV6AuthorizationReusable: false;
    tableLiveV7AuthorizationReusable: false;
    tableLiveV8AuthorizationReusable: false;
    tableLiveV9AuthorizationReusable: false;
    tableLiveV10AuthorizationReusable: false;
    tableLiveV11AuthorizationReusable: false;
    tableLiveV12AuthorizationReusable: false;
    tableLiveV13AuthorizationReusable: false;
    tableLiveV14AuthorizationReusable: false;
    tableLiveV15AuthorizationReusable: false;
    tableLiveV16AuthorizationReusable: false;
    tableLiveV17AuthorizationReusable: false;
    tableLiveV18AuthorizationReusable: false;
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

export interface TableLiveV38AntecedentIndex {
  artifactVersion: "table-live-v38-antecedent-index-v1";
  status: string;
  artifacts: Record<string, { bytes: number; sha256: string }>;
  hashSetSha256: string;
  counts: {
    sources: 2;
    variants: 20;
    expectedSceneFacts: number;
    captureCells: 20;
    remoteRequests: 25;
    hostPhases: 3;
  };
  authorizationLifecycleExcluded: string[];
  authorizationCanBeAddedWithoutAntecedentRebuild: true;
}

export interface TableLiveV38HistoryState {
  index?: TableLiveV38AntecedentIndex;
  indexSha256: string;
  antecedentAddingCommits: string[];
  antecedentCommit?: string;
  antecedentIsAncestorOfCode: boolean;
  antecedentIndexBytesMatchFirstAddition: boolean;
  antecedentArtifactsMatchIndexAtCommit: boolean;
  workingAntecedentArtifactsMatchIndex: boolean;
  authorization?: TableLiveV38AuthorizationArtifact;
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

export interface TableLiveV38AuthorizationProof
  extends TableLiveV38TransactionAuthorization {
  upstreamCommit: string;
  antecedentIndexSha256: string;
  antecedentHashSetSha256: string;
  target: typeof TABLE_LIVE_V38_TARGET;
  expectedDynamicTool: typeof TABLE_LIVE_V38_DYNAMIC_TOOL;
  authorizationPath: typeof TABLE_LIVE_V38_AUTHORIZATION_PATH;
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
  artifactPath === TABLE_LIVE_V38_AUTHORIZATION_PATH ||
  artifactPath.endsWith("/authorization-template.json") ||
  artifactPath.endsWith("/operator-security-attestation-template.json") ||
  artifactPath.includes("table-live-v38-authorization") ||
  artifactPath.includes("table-live-v38-preflight") ||
  artifactPath.includes("table-live-v38-authorized") ||
  artifactPath.includes("create-table-live-v38-security-attestation") ||
  artifactPath.includes("table-live-pivot-v38-status") ||
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

export function validateTableLiveV38AntecedentIndex(
  index: TableLiveV38AntecedentIndex | undefined,
): string[] {
  const failures: string[] = [];
  if (
    index?.artifactVersion !== "table-live-v38-antecedent-index-v1" ||
    index.authorizationCanBeAddedWithoutAntecedentRebuild !== true
  )
    failures.push("table v15 antecedent index missing or malformed");
  const artifactEntries = Object.entries(index?.artifacts ?? {});
  if (artifactEntries.length === 0)
    failures.push("table v15 antecedent hash denominator is empty");
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
      failures.push(`malformed table v15 antecedent hash: ${artifactPath}`);
  }
  const expectedHashSet = sha256(
    JSON.stringify(
      artifactEntries.sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  if (index?.hashSetSha256 !== expectedHashSet)
    failures.push("table v15 antecedent hash-set digest mismatch");
  if (
    index?.counts?.sources !== 2 ||
    index.counts.variants !== 20 ||
    !Number.isInteger(index.counts.expectedSceneFacts) ||
    index.counts.expectedSceneFacts <= 0 ||
    index.counts.captureCells !== 20 ||
    index.counts.remoteRequests !== 25 ||
    index.counts.hostPhases !== 3
  )
    failures.push("table v15 antecedent counts missing or drifted");
  for (const required of [
    TABLE_LIVE_V38_AUTHORIZATION_PATH,
    "recipe/table-live-v38-authorization.ts",
    "recipe/table-live-v38-authorization.test.ts",
    "recipe/table-live-v38-preflight.ts",
    "recipe/evidence/table-live-pivot-v38/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ])
    if (!index?.authorizationLifecycleExcluded?.includes(required))
      failures.push(`table v15 lifecycle exclusion missing: ${required}`);
  const leaks = forbiddenAntecedentFieldPaths(index);
  if (leaks.length)
    failures.push(`table v15 antecedent result leakage: ${leaks.join(",")}`);
  return failures;
}

export function validateTableLiveV38UnitTestSource(source: string): string[] {
  const failures: string[] = [];
  if (
    /assert\.throws\([\s\S]{0,300}verifyInputLiveV\d+Authorization\(\)/.test(
      source,
    ) ||
    /verifyTableLiveV38History\(\s*["']/.test(source) ||
    /readTableLiveV38HistoryState\(/.test(source)
  )
    failures.push(
      "phase-sensitive unit test invokes current repository history",
    );
  return failures;
}

export function buildTableLiveV38AuthorizationArtifact(options: {
  antecedentCommit: string;
  antecedentIndexBytes: Uint8Array;
  signingPublicKey: KeyObject | string | Buffer;
}): TableLiveV38AuthorizationArtifact {
  if (!SHA40.test(options.antecedentCommit))
    throw new TypeError("table v15 antecedent commit must be a full SHA");
  const index = JSON.parse(
    Buffer.from(options.antecedentIndexBytes).toString("utf8"),
  ) as TableLiveV38AntecedentIndex;
  const indexFailures = validateTableLiveV38AntecedentIndex(index);
  if (indexFailures.length)
    throw new TypeError(
      `table v15 antecedent index refused:\n${indexFailures.join("\n")}`,
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
    artifactVersion: "table-live-v38-capture-authorization-v1",
    authorizationId: "table-live-v38",
    status:
      "authorization declared; runtime security prerequisites still mandatory",
    authorizationIntent: true,
    antecedent: {
      commit: options.antecedentCommit,
      indexPath: TABLE_LIVE_V38_INDEX_PATH,
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
      target: TABLE_LIVE_V38_TARGET,
      expectedDynamicTool: TABLE_LIVE_V38_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: TABLE_LIVE_V38_REMOTE_REQUESTS,
      hostPhases: TABLE_LIVE_V38_HOST_PHASES,
      captures: TABLE_LIVE_V38_CAPTURE_COUNT,
      sourceRoots: TABLE_LIVE_V38_SOURCE_ROOTS,
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
      inputV85AuthorizationReusable: false,
      comboboxLiveV41AuthorizationReusable: false,
      comboboxLiveV1AuthorizationReusable: false,
      tableLiveV1AuthorizationReusable: false,
      tableLiveV2AuthorizationReusable: false,
      tableLiveV3AuthorizationReusable: false,
      tableLiveV4AuthorizationReusable: false,
      tableLiveV5AuthorizationReusable: false,
      tableLiveV6AuthorizationReusable: false,
      tableLiveV7AuthorizationReusable: false,
      tableLiveV8AuthorizationReusable: false,
      tableLiveV9AuthorizationReusable: false,
      tableLiveV10AuthorizationReusable: false,
      tableLiveV11AuthorizationReusable: false,
      tableLiveV12AuthorizationReusable: false,
      tableLiveV13AuthorizationReusable: false,
      tableLiveV14AuthorizationReusable: false,
      tableLiveV15AuthorizationReusable: false,
      tableLiveV16AuthorizationReusable: false,
      tableLiveV17AuthorizationReusable: false,
      tableLiveV18AuthorizationReusable: false,
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

export function validateTableLiveV38AuthorizationArtifact(
  artifact: TableLiveV38AuthorizationArtifact | undefined,
  index: TableLiveV38AntecedentIndex | undefined,
  indexSha256: string,
): string[] {
  const failures: string[] = [];
  if (
    artifact?.artifactVersion !== "table-live-v38-capture-authorization-v1" ||
    artifact.authorizationId !== "table-live-v38" ||
    artifact.authorizationIntent !== true
  )
    failures.push("table v15 authorization declaration missing or malformed");
  const resultLeaks = forbiddenAntecedentFieldPaths(artifact);
  if (resultLeaks.length)
    failures.push(`table v15 authorization result leakage: ${resultLeaks.join(",")}`);
  if (
    artifact?.antecedent?.indexPath !== TABLE_LIVE_V38_INDEX_PATH ||
    artifact?.antecedent?.indexSha256 !== indexSha256 ||
    artifact?.antecedent?.hashSetSha256 !== index?.hashSetSha256
  )
    failures.push("table v15 authorization pins wrong antecedent index");
  if (privateMaterialPaths(artifact).length)
    failures.push("table v15 authorization contains private key or token material");
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
      failures.push("table v15 Ed25519 public-key identity mismatch");
  } catch {
    failures.push("table v15 Ed25519 public key is invalid");
  }
  if (
    !equalJson(artifact?.operatorBoundary?.target, TABLE_LIVE_V38_TARGET) ||
    !equalJson(
      artifact?.operatorBoundary?.expectedDynamicTool,
      TABLE_LIVE_V38_DYNAMIC_TOOL,
    ) ||
    artifact?.operatorBoundary?.externalOperatorOnly !== true ||
    artifact?.operatorBoundary?.oneMcpCallPerSignedRequest !== true
  )
    failures.push("wrong table v15 target or dynamic tool");
  if (
    artifact?.denominator?.remoteRequests !== TABLE_LIVE_V38_REMOTE_REQUESTS ||
    artifact?.denominator?.hostPhases !== TABLE_LIVE_V38_HOST_PHASES ||
    artifact?.denominator?.captures !== TABLE_LIVE_V38_CAPTURE_COUNT ||
    artifact?.denominator?.sourceRoots !== TABLE_LIVE_V38_SOURCE_ROOTS ||
    artifact?.denominator?.expectedFacts !== index?.counts.expectedSceneFacts
  )
    failures.push("table v15 two-root or capture denominator changed");
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
    artifact?.execution?.inputV85AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV41AuthorizationReusable !== false ||
    artifact?.execution?.comboboxLiveV1AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV1AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV2AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV3AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV4AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV5AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV6AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV7AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV8AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV9AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV10AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV11AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV12AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV13AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV14AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV15AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV16AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV17AuthorizationReusable !== false ||
    artifact?.execution?.tableLiveV18AuthorizationReusable !== false
  )
    failures.push(
      "table v16 execution, capture, cleanup, or prior-lineage reuse policy weakened",
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
    failures.push("table v15 security prerequisites weakened");
  if (
    artifact?.humanSignoff?.mandatory !== true ||
    artifact?.humanSignoff?.status !== "pending"
  )
    failures.push("table v15 human signoff overclaim");
  return failures;
}

export function validateTableLiveV38History(
  state: TableLiveV38HistoryState,
  expected: TableLiveV38HistoryExpectation,
): string[] {
  const failures = validateTableLiveV38AntecedentIndex(state.index);
  if (!SHA40.test(state.codeCommit))
    failures.push("table v15 code commit is not a full SHA");
  if (!state.clean) failures.push("dirty worktree");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("code commit is unpushed or differs from upstream");
  if (
    state.antecedentAddingCommits.length !== 1 ||
    state.antecedentCommit !== state.antecedentAddingCommits[0]
  )
    failures.push("table v15 antecedent first-add commit is not unique");
  if (!state.antecedentIsAncestorOfCode)
    failures.push("code commit does not descend from table v15 antecedent");
  if (!state.antecedentIndexBytesMatchFirstAddition)
    failures.push("table v15 antecedent index changed after first addition");
  if (!state.antecedentArtifactsMatchIndexAtCommit)
    failures.push("table v15 antecedent commit artifacts do not match index");
  if (!state.workingAntecedentArtifactsMatchIndex)
    failures.push("table v15 antecedent working bytes drifted");

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
    ...validateTableLiveV38AuthorizationArtifact(
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
    failures.push("table v15 authorization first-add lineage mismatch");
  if (!state.authorizationPresentAtCodeCommit)
    failures.push("table v15 authorization missing from code commit");
  if (!state.authorizationBytesMatchFirstAddition)
    failures.push("table v15 authorization bytes changed after first addition");
  if (!state.authorizationStrictlyDescendsFromAntecedent)
    failures.push("table v15 authorization does not strictly descend from antecedent");
  if (!state.authorizationIsAncestorOfCode)
    failures.push("code commit predates table v15 authorization");
  return failures;
}

const artifactSetMatches = (
  root: string,
  index: TableLiveV38AntecedentIndex,
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

export function readTableLiveV38HistoryState(
  root = process.cwd(),
): TableLiveV38HistoryState {
  const repositoryRoot = gitText(root, ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(repositoryRoot, ["rev-parse", "HEAD^{commit}"]);
  const upstreamCommit = tryGitText(repositoryRoot, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const indexFile = path.join(repositoryRoot, TABLE_LIVE_V38_INDEX_PATH);
  const indexBytes = readFileSync(indexFile);
  const index = JSON.parse(
    indexBytes.toString("utf8"),
  ) as TableLiveV38AntecedentIndex;
  const antecedentAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    TABLE_LIVE_V38_INDEX_PATH,
  );
  const antecedentCommit = antecedentAddingCommits[0];
  const authorizationAddingCommits = addingCommits(
    repositoryRoot,
    codeCommit,
    TABLE_LIVE_V38_AUTHORIZATION_PATH,
  );
  const authorizationCommit = authorizationAddingCommits[0];
  const authorizationAtCode = objectExists(
    repositoryRoot,
    codeCommit,
    TABLE_LIVE_V38_AUTHORIZATION_PATH,
  );
  const authorizationFile = path.join(
    repositoryRoot,
    TABLE_LIVE_V38_AUTHORIZATION_PATH,
  );
  const authorization = existsSync(authorizationFile)
    ? (JSON.parse(
        readFileSync(authorizationFile, "utf8"),
      ) as TableLiveV38AuthorizationArtifact)
    : undefined;
  const firstIndexBytes = antecedentCommit
    ? git(repositoryRoot, [
        "show",
        `${antecedentCommit}:${TABLE_LIVE_V38_INDEX_PATH}`,
      ])
    : Buffer.alloc(0);
  const firstAuthorizationBytes = authorizationCommit
    ? git(repositoryRoot, [
        "show",
        `${authorizationCommit}:${TABLE_LIVE_V38_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const currentAuthorizationBytes = authorizationAtCode
    ? git(repositoryRoot, [
        "show",
        `${codeCommit}:${TABLE_LIVE_V38_AUTHORIZATION_PATH}`,
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

export function verifyTableLiveV38History(
  expected: TableLiveV38HistoryExpectation,
  root = process.cwd(),
): TableLiveV38HistoryState {
  const state = readTableLiveV38HistoryState(root);
  const failures = validateTableLiveV38History(state, expected);
  if (failures.length)
    throw new Error(
      `Table live v38 ${expected} history refused:\n${failures.join("\n")}`,
    );
  return state;
}

export function verifyTableLiveV38Authorization(
  root = process.cwd(),
): TableLiveV38AuthorizationProof {
  const state = verifyTableLiveV38History("authorized", root);
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
        path.join(repositoryRoot, TABLE_LIVE_V38_AUTHORIZATION_PATH),
      ),
    ),
    protocolSha256:
      state.index!.artifacts[
        "recipe/evidence/table-live-pivot-v38/protocol.json"
      ]!.sha256,
    runnerSha256:
      state.index!.artifacts["recipe/run-table-live-v38.ts"]!.sha256,
    codeTreeSha256: sha256(currentTreeBytes),
    signingPublicKeySha256: artifact.signingPublicKey.spkiSha256,
    antecedentIndexSha256: state.indexSha256,
    antecedentHashSetSha256: state.index!.hashSetSha256,
    target: TABLE_LIVE_V38_TARGET,
    expectedDynamicTool: TABLE_LIVE_V38_DYNAMIC_TOOL,
    authorizationPath: TABLE_LIVE_V38_AUTHORIZATION_PATH,
  };
}

const expectedMode = (): TableLiveV38HistoryExpectation => {
  const pending = process.argv.includes("--expect-pending");
  const authorized = process.argv.includes("--expect-authorized");
  if (pending === authorized)
    throw new Error(
      "Choose exactly one table v15 history mode: --expect-pending or --expect-authorized",
    );
  return pending ? "pending" : "authorized";
};

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const expected = expectedMode();
  const state = verifyTableLiveV38History(expected);
  process.stdout.write(
    `Table live v38 history ${expected}: antecedent=${state.antecedentCommit} authorization=${state.authorizationCommit ?? "pending"} code=${state.codeCommit}\n`,
  );
}
