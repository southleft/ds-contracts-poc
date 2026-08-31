import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export const INPUT_LIVE_V4_ANTECEDENT_COMMIT =
  "25b820868104be65194f83e154f59b70aacf2bae";
export const INPUT_LIVE_V4_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v4/capture-authorization.json";
export const INPUT_LIVE_V4_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v4/protocol.json";
export const INPUT_LIVE_V4_PROTOCOL_SHA256 =
  "e65584d1d52178cd80dddbe42458a58b0a1ade4f24e41fb53fa4b9cdb97105d6";
export const INPUT_LIVE_V4_PROTOCOL_VERSION = "input-live-v4-protocol-draft-v1";
export const INPUT_LIVE_V4_FIGMA_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const INPUT_LIVE_V4_EVIDENCE_ROOT =
  "recipe/evidence/input-field-live-pivot-v4";
export const INPUT_LIVE_V3_EVIDENCE_TREE =
  "705fbd0c5be0f66a8945bd9a7bde89b99d02b106";
export const INPUT_LIVE_V4_PHASES = [
  "preflight",
  "writer-result",
  "raw-scene-and-variable-table",
  "host-normalization",
  "accounting-and-fixed-point",
  "usability-and-restoration",
  "captures-and-objective",
  "retention-and-cleanup",
] as const;

export const INPUT_LIVE_V4_DEPENDENCY_SHA256 = Object.freeze({
  "recipe/run-input-field-live-v4.ts":
    "5ac591fd39b0d83e773f9ae4b0c348d7334c6357fb0ce12f53da61e21bb7ddd6",
  "recipe/figma-property-normalizer.ts":
    "7a92fab6779d9b3243b397a4e6ed8c8622a52a244933fb2b2a0a1e2e8ebce54b",
  "recipe/input-field-live-v4-journal.ts":
    "7b93314068eb3b99212725db2e62d19834ba8305f576020264e300eef383aa7a",
  "recipe/input-field-live-v4-verifier.ts":
    "417d849f40edf39b5073bd26e938212888476cbabc89a4c09e4cf305b5811cd1",
  "recipe/input-field-live-v4-writer.ts":
    "d993131980f0ab3cf00791614e6ffb74fe0ed35203eb812e86f459df7221b713",
  "recipe/input-field-live-v4-evidence.ts":
    "0e72e9ba6cb6a81b44c76083278715a7bdc2aef072e4451260dfe729ecbf4631",
  "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json":
    "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13",
});

const AUTHORIZATION_VERSION = "input-live-v4-capture-authorization-v1";
const AUTHORIZATION_STATUS =
  "prepared; pending unique first-add commit and upstream publication; capture forbidden";
const CAPTURE_STATUS =
  "capture may occur only after authorization and preflight verifiers pass from a clean published codeCommit";
const AUTHORIZATION_DISCOVERY_COMMAND = `git log --reverse --diff-filter=A --format=%H <codeCommit> -- ${INPUT_LIVE_V4_AUTHORIZATION_PATH}`;
const SHA_PATTERN = /^[a-f0-9]{40}$/;

type JsonRecord = Record<string, any>;

const expectedAuthorization = (): JsonRecord => ({
  artifactVersion: AUTHORIZATION_VERSION,
  authorizationId: "input-live-v4",
  status: AUTHORIZATION_STATUS,
  antecedent: {
    commit: INPUT_LIVE_V4_ANTECEDENT_COMMIT,
    protocol: {
      semanticVersion: INPUT_LIVE_V4_PROTOCOL_VERSION,
      path: INPUT_LIVE_V4_PROTOCOL_PATH,
      sha256: INPUT_LIVE_V4_PROTOCOL_SHA256,
    },
    dependencies: INPUT_LIVE_V4_DEPENDENCY_SHA256,
  },
  authorizationCommitDiscovery: {
    rule: "the authorization commit is the unique first commit that adds this artifact",
    command: AUTHORIZATION_DISCOVERY_COMMAND,
    commitNotEmbeddedInArtifact: true,
    mustStrictlyDescendFromAntecedent: true,
    artifactBytesMustRemainEqualToFirstAddition: true,
  },
  capture: {
    status: CAPTURE_STATUS,
    codeCommitRule:
      "codeCommit must equal the discovered authorization commit or descend from it and from the antecedent",
    cleanWorktreeRequired: true,
    upstreamEqualityRequired: true,
    authorizedWritableFigmaFileKeys: [INPUT_LIVE_V4_FIGMA_FILE_KEY],
    maximumAttempts: 3,
    attemptChronology: "attempt must equal completed v4 attempts plus one",
    evidenceRoot: INPUT_LIVE_V4_EVIDENCE_ROOT,
    v3EvidenceReuseForbidden: true,
  },
  requiredGates: {
    transactionalPhases: INPUT_LIVE_V4_PHASES,
    transactionalJournal: {
      hashChained: true,
      persistImmediatelyAfterPhaseReturn: true,
      cleanupUsesPersistedWriterOwnership: true,
      captureAfterAllTechnicalGatesOnly: true,
    },
    normalization: {
      fixturePath:
        "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json",
      fixtureSha256:
        "2b1fd08205b8049ad2b83ae7aa76009aa922d16ef4c01c52b52f312484964c13",
      localVariableTableRequired: true,
      bindingAliasesResolvedOnlyThroughCapturedTable: true,
      typedUnitsPreserved: true,
      namedRefusalsRequired: true,
    },
    sceneDerived: {
      occurrencePreservingMultisetAccounting: true,
      silentCountDerived: true,
      sourceIrReadbackForbidden: true,
      twoCycleFixedPointRequired: true,
    },
    beforeCapture: [
      "raw scene and local-variable table persisted",
      "host binding and unit normalization passed",
      "occurrence-preserving accounting passed",
      "two-cycle scene-derived fixed point passed",
      "all-axis usability and exact restoration passed",
      "clipping and overlap passed",
      "actual adornment content and accessibility payload passed",
      "state semantics and typed bindings passed",
      "font provenance or named refusal passed",
    ],
    cleanup: {
      freshOwnedPagePerAttempt: true,
      exactPersistedIdsRequired: true,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
    },
    objective: {
      strata: ["source", "state", "adornment"],
      recipeWinsMustExceedLegacyLosses: true,
      aggregateRecipeErrorsMustBeLower: true,
      catastrophicCellRuleInheritedOnlyFromPinnedProtocol: true,
      exactPixelDifferenceDiagnosticOnly: true,
    },
    humanSignoff: {
      mandatory: true,
      status: "pending",
      attributableReviewerRequired: true,
      builderOrAnonymousSignoffAccepted: false,
      overallSuccessBeforeSignoff: false,
    },
  },
  criterionPolicy: {
    onlyPinnedProtocolDefinesAcceptance: true,
    protocolCriteriaAltered: false,
    posthocFieldsForbidden: true,
    captureDataPresent: false,
  },
});

export interface InputLiveV4AuthorizationValidation {
  authorization: JsonRecord;
  antecedentProtocolSha256: string;
  codeProtocolSha256: string;
  antecedentDependencySha256: Readonly<Record<string, string>>;
  codeDependencySha256: Readonly<Record<string, string>>;
  antecedentV3EvidenceTree: string;
  codeV3EvidenceTree: string;
  clean: boolean;
  upstreamCommit?: string;
  upstreamEqualsCodeCommit: boolean;
  authorizationCommitted: boolean;
  authorizationAddingCommits: readonly string[];
  authorizationCommit?: string;
  authorizationBytesMatchFirstAddition: boolean;
  authorizationPresentAtCodeCommit: boolean;
  antecedentIsStrictAncestorOfAuthorization: boolean;
  antecedentIsAncestorOfCodeCommit: boolean;
  authorizationIsAncestorOfCodeCommit: boolean;
  codeCommit: string;
}

export interface InputLiveV4AuthorizationProof {
  root: string;
  codeCommit: string;
  authorizationCommit: string;
  upstreamCommit: string;
}

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const equalJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const forbiddenFieldPaths = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      forbiddenFieldPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as JsonRecord).flatMap(([key, child]) => {
    const field = prefix ? `${prefix}.${key}` : key;
    return [
      ...(/(?:outcome|result|measurement|observed|score|winner|threshold)/i.test(
        key,
      )
        ? [field]
        : []),
      ...forbiddenFieldPaths(child, field),
    ];
  });
};

const v3ReferencePaths = (value: unknown, prefix = ""): string[] => {
  if (typeof value === "string")
    return /input-field-live-pivot-v3|input-live-v3/i.test(value)
      ? [prefix]
      : [];
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      v3ReferencePaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as JsonRecord).flatMap(([key, child]) =>
    v3ReferencePaths(child, prefix ? `${prefix}.${key}` : key),
  );
};

const hashMapsEqual = (
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
): boolean =>
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([file, hash]) => actual[file] === hash);

export function validateInputLiveV4Authorization(
  value: InputLiveV4AuthorizationValidation,
): string[] {
  const failures: string[] = [];
  if (!equalJson(value.authorization, expectedAuthorization()))
    failures.push("authorization declaration drift");
  const forbidden = forbiddenFieldPaths(value.authorization);
  if (forbidden.length > 0)
    failures.push(
      `authorization posthoc outcomes/thresholds forbidden: ${forbidden.join(",")}`,
    );
  const v3References = v3ReferencePaths(value.authorization);
  if (v3References.length > 0)
    failures.push(`v3 evidence reuse forbidden: ${v3References.join(",")}`);
  if (
    value.antecedentProtocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256 ||
    value.codeProtocolSha256 !== INPUT_LIVE_V4_PROTOCOL_SHA256
  )
    failures.push("committed v4 protocol bytes/hash drift");
  if (
    !hashMapsEqual(
      value.antecedentDependencySha256,
      INPUT_LIVE_V4_DEPENDENCY_SHA256,
    ) ||
    !hashMapsEqual(value.codeDependencySha256, INPUT_LIVE_V4_DEPENDENCY_SHA256)
  )
    failures.push("committed v4 dependency bytes/hash drift");
  if (
    value.antecedentV3EvidenceTree !== INPUT_LIVE_V3_EVIDENCE_TREE ||
    value.codeV3EvidenceTree !== INPUT_LIVE_V3_EVIDENCE_TREE
  )
    failures.push("v3 evidence Git tree changed");
  if (!value.clean) failures.push("dirty worktree");
  if (!value.upstreamCommit || !value.upstreamEqualsCodeCommit)
    failures.push("codeCommit is unpushed or differs from upstream");
  if (
    !value.authorizationCommitted ||
    value.authorizationAddingCommits.length === 0
  )
    failures.push("pending-uncommitted-authorization");
  else if (
    value.authorizationAddingCommits.length !== 1 ||
    value.authorizationCommit !== value.authorizationAddingCommits[0]
  )
    failures.push("authorization first-add commit is not unique");
  if (!value.authorizationBytesMatchFirstAddition)
    failures.push("authorization bytes changed after first-add commit");
  if (!value.authorizationPresentAtCodeCommit)
    failures.push("authorization artifact missing from codeCommit");
  if (!value.antecedentIsStrictAncestorOfAuthorization)
    failures.push(
      "authorization commit does not strictly descend from antecedent",
    );
  if (!value.antecedentIsAncestorOfCodeCommit)
    failures.push("codeCommit is old or does not descend from antecedent");
  if (!value.authorizationIsAncestorOfCodeCommit)
    failures.push("codeCommit predates authorization");
  if (!SHA_PATTERN.test(value.codeCommit))
    failures.push("codeCommit is not a full commit SHA");
  return failures;
}

const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });

const gitText = (root: string, args: readonly string[]): string =>
  git(root, args).toString("utf8").trim();

const tryGitText = (
  root: string,
  args: readonly string[],
): string | undefined => {
  try {
    const result = gitText(root, args);
    return result === "" ? undefined : result;
  } catch {
    return undefined;
  }
};

const gitObjectExists = (
  root: string,
  commit: string,
  objectPath: string,
): boolean => {
  try {
    git(root, ["cat-file", "-e", `${commit}:${objectPath}`]);
    return true;
  } catch {
    return false;
  }
};

const isAncestor = (
  root: string,
  ancestor: string,
  descendant: string,
): boolean => {
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

const addingCommits = (
  root: string,
  commit: string,
  objectPath: string,
): string[] => {
  const output = gitText(root, [
    "log",
    "--reverse",
    "--diff-filter=A",
    "--format=%H",
    commit,
    "--",
    objectPath,
  ]);
  return output === "" ? [] : output.split("\n");
};

const hashGitObjects = (
  root: string,
  commit: string,
  expected: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.keys(expected).map((file) => [
      file,
      sha256(git(root, ["show", `${commit}:${file}`])),
    ]),
  );

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

export function verifyInputLiveV4Authorization(): InputLiveV4AuthorizationProof {
  const root = gitText(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(root, [
    "rev-parse",
    "--verify",
    `${argumentValue("--capture-code-commit") ?? "HEAD"}^{commit}`,
  ]);
  const authorization = JSON.parse(
    readFileSync(path.join(root, INPUT_LIVE_V4_AUTHORIZATION_PATH), "utf8"),
  ) as JsonRecord;
  const commits = addingCommits(
    root,
    codeCommit,
    INPUT_LIVE_V4_AUTHORIZATION_PATH,
  );
  const authorizationCommit = commits[0];
  const authorizationPresentAtCodeCommit = gitObjectExists(
    root,
    codeCommit,
    INPUT_LIVE_V4_AUTHORIZATION_PATH,
  );
  const firstAuthorizationBytes =
    authorizationCommit === undefined
      ? undefined
      : git(root, [
          "show",
          `${authorizationCommit}:${INPUT_LIVE_V4_AUTHORIZATION_PATH}`,
        ]);
  const codeAuthorizationBytes = authorizationPresentAtCodeCommit
    ? git(root, ["show", `${codeCommit}:${INPUT_LIVE_V4_AUTHORIZATION_PATH}`])
    : undefined;
  const workingAuthorizationBytes = readFileSync(
    path.join(root, INPUT_LIVE_V4_AUTHORIZATION_PATH),
  );
  const upstreamCommit = tryGitText(root, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const failures = validateInputLiveV4Authorization({
    authorization,
    antecedentProtocolSha256: sha256(
      git(root, [
        "show",
        `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}:${INPUT_LIVE_V4_PROTOCOL_PATH}`,
      ]),
    ),
    codeProtocolSha256: sha256(
      git(root, ["show", `${codeCommit}:${INPUT_LIVE_V4_PROTOCOL_PATH}`]),
    ),
    antecedentDependencySha256: hashGitObjects(
      root,
      INPUT_LIVE_V4_ANTECEDENT_COMMIT,
      INPUT_LIVE_V4_DEPENDENCY_SHA256,
    ),
    codeDependencySha256: hashGitObjects(
      root,
      codeCommit,
      INPUT_LIVE_V4_DEPENDENCY_SHA256,
    ),
    antecedentV3EvidenceTree: gitText(root, [
      "rev-parse",
      `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}:recipe/evidence/input-field-live-pivot-v3`,
    ]),
    codeV3EvidenceTree: gitText(root, [
      "rev-parse",
      `${codeCommit}:recipe/evidence/input-field-live-pivot-v3`,
    ]),
    clean:
      gitText(root, ["status", "--porcelain", "--untracked-files=all"]) === "",
    upstreamCommit,
    upstreamEqualsCodeCommit: upstreamCommit === codeCommit,
    authorizationCommitted: authorizationCommit !== undefined,
    authorizationAddingCommits: commits,
    authorizationCommit,
    authorizationBytesMatchFirstAddition:
      firstAuthorizationBytes !== undefined &&
      codeAuthorizationBytes !== undefined &&
      firstAuthorizationBytes.equals(codeAuthorizationBytes) &&
      firstAuthorizationBytes.equals(workingAuthorizationBytes),
    authorizationPresentAtCodeCommit,
    antecedentIsStrictAncestorOfAuthorization:
      authorizationCommit !== undefined &&
      authorizationCommit !== INPUT_LIVE_V4_ANTECEDENT_COMMIT &&
      isAncestor(root, INPUT_LIVE_V4_ANTECEDENT_COMMIT, authorizationCommit),
    antecedentIsAncestorOfCodeCommit: isAncestor(
      root,
      INPUT_LIVE_V4_ANTECEDENT_COMMIT,
      codeCommit,
    ),
    authorizationIsAncestorOfCodeCommit:
      authorizationCommit !== undefined &&
      isAncestor(root, authorizationCommit, codeCommit),
    codeCommit,
  });
  if (failures.length > 0)
    throw new Error(
      `Input live v4 capture authorization invalid:\n${failures.join("\n")}`,
    );
  if (authorizationCommit === undefined || upstreamCommit === undefined)
    throw new Error("Input live v4 authorization proof incomplete");
  return { root, codeCommit, authorizationCommit, upstreamCommit };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const proof = verifyInputLiveV4Authorization();
  process.stdout.write(
    `Input live v4 capture authorized: antecedent=${INPUT_LIVE_V4_ANTECEDENT_COMMIT} authorization=${proof.authorizationCommit} codeCommit=${proof.codeCommit} upstream=${proof.upstreamCommit} clean=true\n`,
  );
}
