import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const INPUT_LIVE_V5_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v5/protocol.json";
export const INPUT_LIVE_V5_PROTOCOL_SHA256 =
  "6fdc4b99923aed0990a1f46fe1bdce620e2f63f0b38263983cd2da5443d9b6cf";
export const INPUT_LIVE_V5_PROTOCOL_VERSION =
  "input-live-v5-protocol-draft-v1";
export const INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT =
  "e9f9712a55147a4329f51cfd4bf024866dfd489f";
export const INPUT_LIVE_V5_ANTECEDENT_COMMIT =
  "a29d034b746d0831ce93f88f1aeb5630ad4b0453";
export const INPUT_LIVE_V5_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v5/capture-authorization.json";
export const INPUT_LIVE_V5_EVIDENCE_ROOT =
  "recipe/evidence/input-field-live-pivot-v5";
export const INPUT_LIVE_V5_TARGET = Object.freeze({
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
  fileName: "Scratch Project",
  editorType: "figma",
});
export const INPUT_LIVE_V5_PHASES = [
  "preflight",
  "writer-result",
  "raw-scene-and-variable-table",
  "host-normalization",
  "accounting-and-fixed-point",
  "usability-and-restoration",
  "captures-and-objective",
  "retention-and-cleanup",
] as const;
export const INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256 = Object.freeze({
  "recipe/build-input-field-live-proof-v5.ts":
    "d2f650125305b4c4e0b2402979d6456e5f4a0d7af315b25f38d587b6b1e780ef",
  "recipe/input-field-live-v5-authorization.ts":
    "fb1a550be331d3cc1d90e453180f8e63bc68772745e36aa834ed32eaafa4bd5d",
  "recipe/input-field-live-v5-journal.ts":
    "e521c21e68754188ebe166fccfc5160867610026477614395b750f4c08d695cf",
  "recipe/input-field-live-v5-preflight.ts":
    "21ce81a912ffa58ecd458cade70e65a2eea8f8ae6b142f5ca3b6f1bdec7eeaec",
  "recipe/run-input-field-live-v5.ts":
    "278c6c9a06dd9cf22c34b4ec55b9f8e64b2ccb3aa806ad7e3ca1fcbc2b64a313",
  "recipe/input-field-live-v5.test.ts":
    "4f1ea794d8fa68b7258d1a132d074b920975d123f0f75324733282681fe187a5",
  "recipe/input-field-live-v4-verifier.ts":
    "417d849f40edf39b5073bd26e938212888476cbabc89a4c09e4cf305b5811cd1",
  "recipe/figma-property-normalizer.ts":
    "7a92fab6779d9b3243b397a4e6ed8c8622a52a244933fb2b2a0a1e2e8ebce54b",
  "recipe/input-field-figma-writer-v2.ts":
    "a75c77c3c129cac56af7ed92fbe35eb08e50eede7d996e5e4ceb6757c4df11a3",
  "recipe/figma-runtime-portability.ts":
    "df0ada6caea5cf05c9f46552cbf675b76e029438f75a9805802b1446ab3a034f",
  "recipe/writer-transport.ts":
    "fa8456e57342b1fee339d4d3e53e4b6dda85e94f777277bcfaaf5ab06e09cc1d",
  "recipe/evidence/input-field-live-pivot-v5/writer.js":
    "aedb679f27be7b8159f4822f5cfb61aeef7f85e7ea824af884f14ad2f3c5e1a2",
  "recipe/evidence/input-field-live-pivot-v5/transport-envelope.json":
    "757aa01187827151a0a5a3fe6db6d0385f464a8a76eccc58cf1f6d43c8feb836",
  "recipe/evidence/input-field-live-pivot-v5/writer-wrapper.txt":
    "a839d5bd2304fa18b449692676345486606bca6a79dd8bd84e8b9b307b9f7826",
  "recipe/evidence/input-field-live-pivot-v5/writer-plan.json":
    "d6ff229c9187f814fdd97698a5302ec0b982947b4aef3732edaf943d6daaf848",
  "recipe/evidence/input-field-live-pivot-v5/conformance-report.json":
    "05e0d5fcf4f37c28774c2812fda0568616ef4b803488186fa097fa075a189755",
  "recipe/evidence/input-field-live-pivot-v5/expected-scene-plan-mui.json.gz":
    "96e8d543b259066268af2d871f1a0258bdd3173b5c4402ed3f4d57296cfddfa3",
  "recipe/evidence/input-field-live-pivot-v5/expected-scene-plan-polaris.json.gz":
    "6e6517f9a819ce6cffff9e6bda913f3c9c8bdd6d0da95bcebffcdb972bbcd41d",
});
export const INPUT_LIVE_V5_PRESERVED_EVIDENCE_TREES = Object.freeze({
  "recipe/evidence/input-field-live-pivot-v3":
    "705fbd0c5be0f66a8945bd9a7bde89b99d02b106",
  "recipe/evidence/input-field-live-pivot-v4":
    "85c3c9c69b4a2652cf043d693155015bf50011c8",
});

const SHA40 = /^[a-f0-9]{40}$/;
const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
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
const gitObjectExists = (
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
const hashGitObjects = (
  root: string,
  commit: string,
  expected: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.keys(expected).map((artifactPath) => [
      artifactPath,
      sha256(git(root, ["show", `${commit}:${artifactPath}`])),
    ]),
  );
const hashMapsEqual = (
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
): boolean =>
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([file, hash]) => actual[file] === hash);
const antecedentRunnerIsExecutable = (source: string): boolean => {
  const gate = source.indexOf("assertInputLiveV5PreCaptureGates");
  const capture = source.indexOf("transaction.capture");
  return (
    !source.includes("refuseDraftExecution") &&
    (source.match(/bridge\.invoke\s*\(/g) ?? []).length === 1 &&
    gate >= 0 &&
    capture > gate &&
    INPUT_LIVE_V5_PHASES.every((phase) => source.includes(`"${phase}"`))
  );
};

export const createInputLiveV5AuthorizationArtifact = () => ({
  artifactVersion: "input-live-v5-capture-authorization-v1",
  authorizationId: "input-live-v5",
  status: "prepared uncommitted; capture forbidden",
  antecedent: {
    executableCommit: INPUT_LIVE_V5_ANTECEDENT_COMMIT,
    protocolFirstAddCommit: INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT,
    protocol: {
      semanticVersion: INPUT_LIVE_V5_PROTOCOL_VERSION,
      path: INPUT_LIVE_V5_PROTOCOL_PATH,
      sha256: INPUT_LIVE_V5_PROTOCOL_SHA256,
    },
    dependencies: INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
    preservedEvidenceTrees: INPUT_LIVE_V5_PRESERVED_EVIDENCE_TREES,
  },
  authorizationCommitDiscovery: {
    rule: "the authorization commit is the unique first commit that adds this artifact",
    command: `git log --reverse --diff-filter=A --format=%H <codeCommit> -- ${INPUT_LIVE_V5_AUTHORIZATION_PATH}`,
    commitNotEmbeddedInArtifact: true,
    mustStrictlyDescendFromExecutableAntecedent: true,
    artifactBytesMustRemainEqualToFirstAddition: true,
  },
  target: INPUT_LIVE_V5_TARGET,
  capture: {
    status:
      "capture may occur only after authorization and every preflight gate pass from a clean upstream-equal descendant",
    codeCommitMustDescendFromExecutableAntecedentAndAuthorization: true,
    cleanWorktreeRequired: true,
    upstreamEqualityRequired: true,
    authorizedWritableFigmaFileKeys: [INPUT_LIVE_V5_TARGET.fileKey],
    maximumAttempts: 3,
    attemptChronology: "attempt must equal completed v5 attempts plus one",
    evidenceRoot: INPUT_LIVE_V5_EVIDENCE_ROOT,
    v3OrV4EvidenceReuseForbidden: true,
  },
  requiredGates: {
    sameEntrypointOfflineSmoke: {
      runnerPath: "recipe/run-input-field-live-v5.ts",
      testPath: "recipe/input-field-live-v5.test.ts",
      usesLiveEntrypointOrchestration: true,
      generatedWriterPayloadEvaluated: true,
      fakeBridgePermittedOnlyWithSimulatedOfflineAuthorization: true,
    },
    transactionalPhases: INPUT_LIVE_V5_PHASES,
    transactionalJournal: {
      hashChained: true,
      persistImmediatelyAfterPhaseReturn: true,
      cleanupUsesPersistedWriterOwnership: true,
      captureAfterAllTechnicalGatesOnly: true,
    },
    normalization: {
      rawSceneAndLocalVariableTableRequired: true,
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

export interface InputLiveV5AuthorizationState {
  authorization?: Record<string, unknown>;
  protocolAddingCommits: string[];
  authorizationAddingCommits: string[];
  protocolCommit?: string;
  authorizationCommit?: string;
  codeCommit: string;
  upstreamCommit?: string;
  clean: boolean;
  antecedentExists: boolean;
  antecedentExecutable: boolean;
  antecedentIsAncestorOfCode: boolean;
  protocolBytesMatch: boolean;
  antecedentDependencyBytesMatch: boolean;
  preservedEvidenceTreesMatch: boolean;
  authorizationBytesMatchFirstAddition: boolean;
  authorizationPresentAtCodeCommit: boolean;
  protocolStrictlyPrecedesAuthorization: boolean;
  authorizationIsAncestorOfCode: boolean;
  target: {
    fileKey: string;
    fileName: string;
    editorType: string;
  };
}

export interface InputLiveV5AuthorizationProof {
  mode: "live" | "simulated";
  protocolCommit: string;
  authorizationCommit: string;
  codeCommit: string;
  upstreamCommit: string;
  target: typeof INPUT_LIVE_V5_TARGET;
}

const equalJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const forbiddenFieldPaths = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      forbiddenFieldPaths(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => {
      const field = prefix ? `${prefix}.${key}` : key;
      return [
        ...(/(?:outcome|result|measurement|observed|score|winner|threshold)/i.test(
          key,
        )
          ? [field]
          : []),
        ...forbiddenFieldPaths(child, field),
      ];
    },
  );
};
const priorEvidenceReferences = (value: unknown, prefix = ""): string[] => {
  if (typeof value === "string")
    return /input-field-live-pivot-v[34]|input-live-v[34]/i.test(value)
      ? [prefix]
      : [];
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      priorEvidenceReferences(child, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) =>
      priorEvidenceReferences(child, prefix ? `${prefix}.${key}` : key),
  );
};

export function validateInputLiveV5Authorization(
  state: InputLiveV5AuthorizationState,
): string[] {
  const failures: string[] = [];
  if (!equalJson(state.authorization, createInputLiveV5AuthorizationArtifact()))
    failures.push("v5 authorization declaration missing or drifted");
  const forbidden = forbiddenFieldPaths(state.authorization);
  if (forbidden.length)
    failures.push(
      `v5 authorization result leakage or changed thresholds: ${forbidden.join(",")}`,
    );
  const reused = priorEvidenceReferences(state.authorization).filter(
    (field) => !field.startsWith("antecedent.preservedEvidenceTrees"),
  );
  if (reused.length)
    failures.push(`v3/v4 authorization or evidence reuse forbidden: ${reused.join(",")}`);
  if (
    state.protocolAddingCommits.length !== 1 ||
    state.protocolCommit !== state.protocolAddingCommits[0] ||
    state.protocolCommit !== INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT
  )
    failures.push("v5 protocol first-add commit is not unique");
  if (!state.clean) failures.push("dirty worktree");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("codeCommit is unpushed or differs from upstream");
  if (!state.antecedentExists || !state.antecedentExecutable)
    failures.push("v5 antecedent is missing or non-executable");
  if (!state.antecedentIsAncestorOfCode)
    failures.push("codeCommit does not descend from executable v5 antecedent");
  if (!state.protocolBytesMatch) failures.push("v5 protocol bytes/hash drift");
  if (!state.antecedentDependencyBytesMatch)
    failures.push("v5 antecedent dependency or generated pin drift");
  if (!state.preservedEvidenceTreesMatch)
    failures.push("v3/v4 evidence tree changed");
  if (
    state.authorizationAddingCommits.length === 0 ||
    state.authorizationCommit === undefined
  ) {
    failures.push("pending-uncommitted-authorization");
  } else {
    if (
      state.authorizationAddingCommits.length !== 1 ||
      state.authorizationCommit !== state.authorizationAddingCommits[0]
    )
      failures.push("v5 authorization first-add commit is not unique");
    if (!state.authorizationBytesMatchFirstAddition)
      failures.push("v5 authorization bytes changed after first addition");
    if (!state.authorizationPresentAtCodeCommit)
      failures.push("v5 authorization missing from codeCommit");
    if (!state.protocolStrictlyPrecedesAuthorization)
      failures.push(
        "v5 authorization does not strictly descend from executable antecedent",
      );
    if (!state.authorizationIsAncestorOfCode)
      failures.push("codeCommit predates v5 authorization");
  }
  if (!SHA40.test(state.codeCommit))
    failures.push("codeCommit is not a full commit SHA");
  if (!equalJson(state.target, INPUT_LIVE_V5_TARGET))
    failures.push("wrong v5 target");
  return failures;
}

export function simulatedInputLiveV5Authorization(): InputLiveV5AuthorizationProof {
  return {
    mode: "simulated",
    protocolCommit: "1".repeat(40),
    authorizationCommit: "2".repeat(40),
    codeCommit: "3".repeat(40),
    upstreamCommit: "3".repeat(40),
    target: INPUT_LIVE_V5_TARGET,
  };
}

export function verifyInputLiveV5Authorization(
  target = INPUT_LIVE_V5_TARGET,
): InputLiveV5AuthorizationProof {
  const root = gitText(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(root, ["rev-parse", "HEAD^{commit}"]);
  const upstreamCommit = tryGitText(root, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const protocolCommits = addingCommits(
    root,
    codeCommit,
    INPUT_LIVE_V5_PROTOCOL_PATH,
  );
  const authorizationCommits = addingCommits(
    root,
    codeCommit,
    INPUT_LIVE_V5_AUTHORIZATION_PATH,
  );
  const protocolCommit = protocolCommits[0];
  const authorizationCommit = authorizationCommits[0];
  const authorizationFile = path.join(root, INPUT_LIVE_V5_AUTHORIZATION_PATH);
  const authorization = existsSync(authorizationFile)
    ? (JSON.parse(readFileSync(authorizationFile, "utf8")) as Record<
        string,
        unknown
      >)
    : undefined;
  const authorizationAtCode = gitObjectExists(
    root,
    codeCommit,
    INPUT_LIVE_V5_AUTHORIZATION_PATH,
  );
  const firstAuthorizationBytes = authorizationCommit
    ? git(root, [
        "show",
        `${authorizationCommit}:${INPUT_LIVE_V5_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const codeAuthorizationBytes = authorizationAtCode
    ? git(root, ["show", `${codeCommit}:${INPUT_LIVE_V5_AUTHORIZATION_PATH}`])
    : Buffer.alloc(0);
  const workingAuthorizationBytes = existsSync(authorizationFile)
    ? readFileSync(authorizationFile)
    : Buffer.alloc(0);
  const antecedentExists = gitObjectExists(
    root,
    INPUT_LIVE_V5_ANTECEDENT_COMMIT,
    INPUT_LIVE_V5_PROTOCOL_PATH,
  );
  const antecedentProtocolBytes = antecedentExists
    ? git(root, [
        "show",
        `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}:${INPUT_LIVE_V5_PROTOCOL_PATH}`,
      ])
    : Buffer.alloc(0);
  const codeProtocolBytes = git(root, [
    "show",
    `${codeCommit}:${INPUT_LIVE_V5_PROTOCOL_PATH}`,
  ]);
  const antecedentDependencySha256 = antecedentExists
    ? hashGitObjects(
        root,
        INPUT_LIVE_V5_ANTECEDENT_COMMIT,
        INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
      )
    : {};
  const antecedentRunner = antecedentExists
    ? gitText(root, [
        "show",
        `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}:recipe/run-input-field-live-v5.ts`,
      ])
    : "";
  const preservedEvidenceTreesMatch = Object.entries(
    INPUT_LIVE_V5_PRESERVED_EVIDENCE_TREES,
  ).every(
    ([treePath, expected]) =>
      tryGitText(root, [
        "rev-parse",
        `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}:${treePath}`,
      ]) === expected &&
      tryGitText(root, ["rev-parse", `${codeCommit}:${treePath}`]) === expected,
  );
  const failures = validateInputLiveV5Authorization({
    authorization,
    protocolAddingCommits: protocolCommits,
    authorizationAddingCommits: authorizationCommits,
    protocolCommit,
    authorizationCommit,
    codeCommit,
    upstreamCommit,
    clean:
      gitText(root, ["status", "--porcelain", "--untracked-files=all"]) === "",
    antecedentExists,
    antecedentExecutable:
      antecedentExists &&
      hashMapsEqual(
        antecedentDependencySha256,
        INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
      ) &&
      antecedentRunnerIsExecutable(antecedentRunner),
    antecedentIsAncestorOfCode: isAncestor(
      root,
      INPUT_LIVE_V5_ANTECEDENT_COMMIT,
      codeCommit,
    ),
    protocolBytesMatch:
      sha256(antecedentProtocolBytes) === INPUT_LIVE_V5_PROTOCOL_SHA256 &&
      sha256(codeProtocolBytes) === INPUT_LIVE_V5_PROTOCOL_SHA256,
    antecedentDependencyBytesMatch: hashMapsEqual(
      antecedentDependencySha256,
      INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
    ),
    preservedEvidenceTreesMatch,
    authorizationBytesMatchFirstAddition:
      firstAuthorizationBytes.byteLength > 0 &&
      firstAuthorizationBytes.equals(codeAuthorizationBytes) &&
      firstAuthorizationBytes.equals(workingAuthorizationBytes),
    authorizationPresentAtCodeCommit: authorizationAtCode,
    protocolStrictlyPrecedesAuthorization:
      authorizationCommit !== undefined &&
      INPUT_LIVE_V5_ANTECEDENT_COMMIT !== authorizationCommit &&
      isAncestor(root, INPUT_LIVE_V5_ANTECEDENT_COMMIT, authorizationCommit),
    authorizationIsAncestorOfCode: isAncestor(
      root,
      authorizationCommit,
      codeCommit,
    ),
    target,
  });
  if (failures.length)
    throw new Error(
      `Input live v5 authorization refused:\n${failures.join("\n")}`,
    );
  return {
    mode: "live",
    protocolCommit: protocolCommit!,
    authorizationCommit: authorizationCommit!,
    codeCommit,
    upstreamCommit: upstreamCommit!,
    target,
  };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  if (process.argv.includes("--print-template"))
    process.stdout.write(
      `${JSON.stringify(createInputLiveV5AuthorizationArtifact(), null, 2)}\n`,
    );
  else {
    const proof = verifyInputLiveV5Authorization();
    process.stdout.write(
      `Input live v5 authorized: protocol=${proof.protocolCommit} authorization=${proof.authorizationCommit} code=${proof.codeCommit}\n`,
    );
  }
}
