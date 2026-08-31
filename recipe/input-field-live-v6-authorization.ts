import { execFileSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  INPUT_LIVE_V6_DYNAMIC_TOOL,
  INPUT_LIVE_V6_TARGET,
  type InputLiveV6TransactionAuthorization,
} from "./input-field-live-v6-broker.js";

export const INPUT_LIVE_V6_ANTECEDENT_COMMIT =
  "8737fab9f35aeae43b25734e8f9709a4247c379b";
export const INPUT_LIVE_V6_ANTECEDENT_TREE =
  "1065a502feddd59ce8d11985e3f6e14365d65bfd";
export const INPUT_LIVE_V6_ANTECEDENT_TREE_SHA256 =
  "7c93434bd6e742be7f8137af68239976b1ac226ff4d27346f52c3b86d5d5de68";
export const INPUT_LIVE_V6_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v6/capture-authorization.json";
export const INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH =
  "recipe/evidence/input-field-live-pivot-v6/operator-security-attestation-template.json";
export const INPUT_LIVE_V6_SECURITY_ATTESTATION_DEFAULT_PATH =
  "private/input-live-v6-security-attestation.json";
export const INPUT_LIVE_V6_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v6/protocol.json";
export const INPUT_LIVE_V6_PROTOCOL_SHA256 =
  "0d79c50a4a21763eae067ff18f2ad65bc071f2fca5af7cfd4335f775c9d5e296";
export const INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256 =
  "c5d04bf950dea3e1b62a2a274031677546e9c24bbee4cabb64773d0f1a7b3ac4";

export const INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256 = Object.freeze({
  "recipe/evidence/input-field-live-pivot-v6/authorization-template.json":
    "e89b614b101872c0c8edafebdf66afafa38aeddfbc58f921186c5f52a0db58ac",
  "recipe/evidence/input-field-live-pivot-v6/proof-plan.json":
    "28c22a4b86fe98e558c48278c624a229da6417b5abcbdd6587cb533197fdf199",
  "recipe/evidence/input-field-live-pivot-v6/request-manifest.json":
    "03126813dfe8a9e7fa9c18db8f906d3e65c33e162bbdc768341802cddeb634b2",
  "recipe/evidence/input-field-live-pivot-v6/capture-manifest.json":
    "b58506dd5bc238cafc7b346ddad6fa5d1c1178e5ec6e566f0cc799e4c43e9571",
  "recipe/evidence/input-field-live-pivot-v6/programs/writer.txt":
    "a839d5bd2304fa18b449692676345486606bca6a79dd8bd84e8b9b307b9f7826",
  "recipe/evidence/input-field-live-pivot-v6/programs/writer-payload.js":
    "aedb679f27be7b8159f4822f5cfb61aeef7f85e7ea824af884f14ad2f3c5e1a2",
  "recipe/evidence/input-field-live-pivot-v6/programs/extract-blueprint.js":
    "36b8611fee7ba257256e986e73361ba2c7e0b0d1cce49d55879b2914447a8ef3",
  "recipe/evidence/input-field-live-pivot-v6/programs/probe-blueprint.js":
    "471e08c9be8c83e3457867e1f04d0fed55137eb99cec0ce858e92efd933ddba9",
  "recipe/evidence/input-field-live-pivot-v6/programs/capture-blueprint.js":
    "179b87be2f81567c16874c5039bfc7bba9e01dbd48f4ec55f9e74cb173592a0e",
  "recipe/evidence/input-field-live-pivot-v6/expected-scene-plan-mui.json.gz":
    "96e8d543b259066268af2d871f1a0258bdd3173b5c4402ed3f4d57296cfddfa3",
  "recipe/evidence/input-field-live-pivot-v6/expected-scene-plan-polaris.json.gz":
    "6e6517f9a819ce6cffff9e6bda913f3c9c8bdd6d0da95bcebffcdb972bbcd41d",
  "recipe/input-field-live-v6-broker.ts":
    "3c8cf2b50ba055a86fc1118723c091f21748541b4a76bde01d1e653012457f1a",
  "recipe/input-field-live-v6-contract.ts":
    "11741375907f0dd69678a6ba652a9a1b00b685ae47994ee88ae34e753e52144a",
  "recipe/run-input-field-live-v6.ts":
    "0d9871ef268a2253045b13f637b4a71a0853a0d124a13484c25a4e6d5f4bfcf3",
  "recipe/build-input-field-live-proof-v6.ts":
    "2e988bb848efb2ea384112495eb53604323cb31ff307d7600eaea187dea013a1",
  "recipe/input-field-live-v6-broker.test.ts":
    "4ac6123d06aba5356f1d48789c05a25c51db147cd2e2b21cf1894ec243b6f67d",
  "recipe/input-field-live-v3-cleanup.ts":
    "e28c7b8500720899a01fbbb9bdb47e498c7abf1b5798ee14ca4e8cbebd6c7950",
  [INPUT_LIVE_V6_PROTOCOL_PATH]: INPUT_LIVE_V6_PROTOCOL_SHA256,
});

const AUTHORIZATION_PROTECTED_PATHS = [
  ...Object.keys(INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256),
  INPUT_LIVE_V6_AUTHORIZATION_PATH,
  INPUT_LIVE_V6_SECURITY_ATTESTATION_TEMPLATE_PATH,
  "recipe/input-field-live-v6-authorization.ts",
  "recipe/input-field-live-v6-preflight.ts",
  "recipe/input-field-live-v6-authorization.test.ts",
] as const;

const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const equalJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
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
const hashGitObjects = (
  root: string,
  commit: string,
  paths: readonly string[],
): Record<string, string> =>
  Object.fromEntries(
    paths.map((artifactPath) => [
      artifactPath,
      sha256(git(root, ["show", `${commit}:${artifactPath}`])),
    ]),
  );

const visit = (
  value: unknown,
  predicate: (key: string, value: unknown) => boolean,
  prefix = "$",
): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      visit(child, predicate, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(predicate(key, child) ? [`${prefix}.${key}`] : []),
      ...visit(child, predicate, `${prefix}.${key}`),
    ],
  );
};

export const inputLiveV6PrivateMaterialPaths = (value: unknown): string[] => {
  const fields = visit(value, (key) =>
    /^(?:privateKey|privateKeyPem|accessToken|apiKey|secret|cookie)$/i.test(
      key,
    ),
  );
  const strings: string[] = [];
  const inspect = (child: unknown, prefix = "$"): void => {
    if (typeof child === "string") {
      if (
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|figd_[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._~-]{12,}/i.test(
          child,
        )
      )
        strings.push(prefix);
      return;
    }
    if (Array.isArray(child))
      child.forEach((entry, index) => inspect(entry, `${prefix}[${index}]`));
    else if (child !== null && typeof child === "object")
      Object.entries(child as Record<string, unknown>).forEach(([key, entry]) =>
        inspect(entry, `${prefix}.${key}`),
      );
  };
  inspect(value);
  return [...new Set([...fields, ...strings])];
};

const resultLeakPaths = (value: unknown): string[] =>
  visit(
    value,
    (key, child) =>
      /^(?:outcome|outcomes|result|results|measurement|observed|score|winner)$/i.test(
        key,
      ) && child !== null,
  );

export interface InputLiveV6AuthorizationState {
  authorization?: Record<string, any>;
  authorizationAddingCommits: string[];
  authorizationCommit?: string;
  codeCommit: string;
  upstreamCommit?: string;
  clean: boolean;
  antecedentExists: boolean;
  antecedentIsAncestorOfCode: boolean;
  antecedentTreeMatches: boolean;
  antecedentArtifactSha256: Record<string, string>;
  authorizationPresentAtCodeCommit: boolean;
  authorizationBytesMatchFirstAddition: boolean;
  authorizationStrictlyDescendsFromAntecedent: boolean;
  authorizationIsAncestorOfCode: boolean;
  protectedPathsMatchAuthorizationCommit: boolean;
  target: Record<string, unknown>;
  expectedDynamicTool: Record<string, unknown>;
}

export function validateInputLiveV6Authorization(
  state: InputLiveV6AuthorizationState,
): string[] {
  const failures: string[] = [];
  const artifact = state.authorization;
  if (
    artifact?.artifactVersion !== "input-live-v6-capture-authorization-v1" ||
    artifact.authorizationId !== "input-live-v6" ||
    artifact.authorizationIntent !== true ||
    artifact.effectiveAuthorizationDerivedByHistoryAndPreflight !== true
  )
    failures.push("v6 authorization declaration missing or malformed");
  if (artifact?.antecedent?.commit !== INPUT_LIVE_V6_ANTECEDENT_COMMIT)
    failures.push("wrong v6 antecedent commit");
  if (
    artifact?.antecedent?.gitTreeObject !== INPUT_LIVE_V6_ANTECEDENT_TREE ||
    artifact?.antecedent?.gitTreeObjectSha256 !==
      INPUT_LIVE_V6_ANTECEDENT_TREE_SHA256 ||
    !state.antecedentTreeMatches
  )
    failures.push("v6 antecedent tree mismatch");
  if (
    artifact?.antecedent?.protocol?.path !== INPUT_LIVE_V6_PROTOCOL_PATH ||
    artifact?.antecedent?.protocol?.sha256 !== INPUT_LIVE_V6_PROTOCOL_SHA256
  )
    failures.push("wrong v6 protocol");
  const declaredHashes = artifact?.antecedent?.artifacts ?? {};
  for (const [artifactPath, expected] of Object.entries(
    INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256,
  )) {
    if (
      declaredHashes[artifactPath] !== expected ||
      state.antecedentArtifactSha256[artifactPath] !== expected
    )
      failures.push(`wrong v6 antecedent artifact: ${artifactPath}`);
  }
  const privateLeaks = inputLiveV6PrivateMaterialPaths(artifact);
  if (privateLeaks.length)
    failures.push(
      `private signing key or token leakage: ${privateLeaks.join(",")}`,
    );
  const resultLeaks = resultLeakPaths(artifact);
  if (resultLeaks.length)
    failures.push(`v6 authorization result leakage: ${resultLeaks.join(",")}`);
  if (
    JSON.stringify(artifact).includes(
      "input-field-live-pivot-v5/capture-authorization.json",
    ) ||
    artifact?.authorizationId === "input-live-v5" ||
    artifact?.execution?.v5AuthorizationReusable !== false
  )
    failures.push("v5 authorization reuse forbidden");
  if (
    artifact?.signingPublicKey?.algorithm !== "Ed25519" ||
    artifact?.signingPublicKey?.encoding !== "SPKI-PEM" ||
    artifact?.signingPublicKey?.spkiSha256 !==
      INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256 ||
    artifact?.signingPublicKey?.privateKeyStoredInRepository !== false
  )
    failures.push("v6 Ed25519 public-key identity mismatch");
  try {
    const der = createPublicKey(
      artifact?.signingPublicKey?.publicKeyPem,
    ).export({
      type: "spki",
      format: "der",
    });
    if (sha256(der) !== INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256)
      failures.push("v6 Ed25519 public-key bytes mismatch");
  } catch {
    failures.push("v6 Ed25519 public key is invalid");
  }
  if (
    !equalJson(artifact?.operatorBoundary?.target, INPUT_LIVE_V6_TARGET) ||
    !equalJson(
      artifact?.operatorBoundary?.expectedDynamicTool,
      INPUT_LIVE_V6_DYNAMIC_TOOL,
    ) ||
    !equalJson(state.target, INPUT_LIVE_V6_TARGET) ||
    !equalJson(state.expectedDynamicTool, INPUT_LIVE_V6_DYNAMIC_TOOL)
  )
    failures.push("wrong v6 target or dynamic tool");
  if (
    artifact?.denominator?.remoteRequests !== 132 ||
    artifact?.denominator?.hostPhases !== 3 ||
    artifact?.denominator?.captures !== 128 ||
    artifact?.denominator?.cellsPerCaptureRequest !== 1 ||
    artifact?.denominator?.sampleReduction !== false
  )
    failures.push("v6 request/capture denominator changed");
  if (
    artifact?.twoRootFacts?.roots !== 2 ||
    artifact?.twoRootFacts?.expectedFacts !== 43_726 ||
    artifact?.twoRootFacts?.sources?.mui?.expectedFacts !== 22_811 ||
    artifact?.twoRootFacts?.sources?.polaris?.expectedFacts !== 20_915
  )
    failures.push("v6 two-root fact denominator changed");
  if (
    artifact?.execution?.maximumAttempts !== 3 ||
    artifact?.execution?.cleanWorktreeRequired !== true ||
    artifact?.execution?.upstreamEqualityRequired !== true ||
    artifact?.execution?.captureBeforeHashBoundTechnicalGates !== false ||
    artifact?.execution
      ?.durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance !==
      true ||
    artifact?.execution?.cleanupMustRemainExecutableAfterHostFailure !== true
  )
    failures.push("v6 execution, capture gate, or cleanup policy weakened");
  if (
    artifact?.securityPrerequisite?.liveExecutionForbidden !== true ||
    artifact?.securityPrerequisite?.exposedFigmaPatMustBeRevokedOrReplaced !==
      true ||
    artifact?.securityPrerequisite?.rotationCompleted !== false ||
    artifact?.securityPrerequisite?.mcpProcessesMustRestartAfterRotation !==
      true ||
    artifact?.securityPrerequisite?.mcpRestartCompleted !== false ||
    artifact?.securityPrerequisite
      ?.ownerOnlyEnvironmentFileConfigurationRequired !== true ||
    artifact?.securityPrerequisite
      ?.safeAttestationCreatedAfterRotationRequired !== true
  )
    failures.push("v6 security prerequisite missing or falsely completed");
  if (
    artifact?.humanSignoff?.mandatory !== true ||
    artifact?.humanSignoff?.status !== "pending" ||
    artifact?.outcomes !== null
  )
    failures.push("v6 outcomes or human signoff overclaim");
  if (!state.clean) failures.push("dirty worktree");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("codeCommit is unpushed or differs from upstream");
  if (!SHA40.test(state.codeCommit))
    failures.push("codeCommit is not a full commit SHA");
  if (!state.antecedentExists || !state.antecedentIsAncestorOfCode)
    failures.push("codeCommit does not descend from v6 antecedent");
  if (
    state.authorizationAddingCommits.length === 0 ||
    state.authorizationCommit === undefined
  )
    failures.push("pending-uncommitted-authorization");
  else {
    if (
      state.authorizationAddingCommits.length !== 1 ||
      state.authorizationCommit !== state.authorizationAddingCommits[0]
    )
      failures.push("v6 authorization first-add commit is not unique");
    if (!state.authorizationBytesMatchFirstAddition)
      failures.push("v6 authorization bytes changed after first addition");
    if (!state.authorizationPresentAtCodeCommit)
      failures.push("v6 authorization missing from codeCommit");
    if (!state.authorizationStrictlyDescendsFromAntecedent)
      failures.push(
        "v6 authorization does not strictly descend from antecedent",
      );
    if (!state.authorizationIsAncestorOfCode)
      failures.push("codeCommit predates v6 authorization");
    if (!state.protectedPathsMatchAuthorizationCommit)
      failures.push(
        "v6 authorization/preflight live path drifted after authorization",
      );
  }
  return failures;
}

export interface InputLiveV6AuthorizationProof extends InputLiveV6TransactionAuthorization {
  upstreamCommit: string;
  target: typeof INPUT_LIVE_V6_TARGET;
  expectedDynamicTool: typeof INPUT_LIVE_V6_DYNAMIC_TOOL;
  authorizationPath: typeof INPUT_LIVE_V6_AUTHORIZATION_PATH;
}

export function verifyInputLiveV6Authorization(
  target: Record<string, unknown> = INPUT_LIVE_V6_TARGET,
  expectedDynamicTool: Record<string, unknown> = INPUT_LIVE_V6_DYNAMIC_TOOL,
): InputLiveV6AuthorizationProof {
  const root = gitText(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(root, ["rev-parse", "HEAD^{commit}"]);
  const upstreamCommit = tryGitText(root, [
    "rev-parse",
    "@{upstream}^{commit}",
  ]);
  const authorizationAddingCommits = addingCommits(
    root,
    codeCommit,
    INPUT_LIVE_V6_AUTHORIZATION_PATH,
  );
  const authorizationCommit = authorizationAddingCommits[0];
  const authorizationFile = path.join(root, INPUT_LIVE_V6_AUTHORIZATION_PATH);
  const authorization = existsSync(authorizationFile)
    ? (JSON.parse(readFileSync(authorizationFile, "utf8")) as Record<
        string,
        any
      >)
    : undefined;
  const authorizationAtCode = gitObjectExists(
    root,
    codeCommit,
    INPUT_LIVE_V6_AUTHORIZATION_PATH,
  );
  const firstAuthorizationBytes = authorizationCommit
    ? git(root, [
        "show",
        `${authorizationCommit}:${INPUT_LIVE_V6_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const codeAuthorizationBytes = authorizationAtCode
    ? git(root, ["show", `${codeCommit}:${INPUT_LIVE_V6_AUTHORIZATION_PATH}`])
    : Buffer.alloc(0);
  const workingAuthorizationBytes = existsSync(authorizationFile)
    ? readFileSync(authorizationFile)
    : Buffer.alloc(0);
  const antecedentExists = gitObjectExists(
    root,
    INPUT_LIVE_V6_ANTECEDENT_COMMIT,
    INPUT_LIVE_V6_PROTOCOL_PATH,
  );
  const expectedPaths = Object.keys(INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256);
  const antecedentArtifactSha256 = antecedentExists
    ? hashGitObjects(root, INPUT_LIVE_V6_ANTECEDENT_COMMIT, expectedPaths)
    : {};
  const antecedentTree = antecedentExists
    ? gitText(root, ["rev-parse", `${INPUT_LIVE_V6_ANTECEDENT_COMMIT}^{tree}`])
    : "";
  const antecedentTreeBytes = antecedentExists
    ? git(root, [
        "cat-file",
        "tree",
        `${INPUT_LIVE_V6_ANTECEDENT_COMMIT}^{tree}`,
      ])
    : Buffer.alloc(0);
  const protectedPathsMatchAuthorizationCommit =
    authorizationCommit !== undefined &&
    AUTHORIZATION_PROTECTED_PATHS.every(
      (protectedPath) =>
        gitObjectExists(root, authorizationCommit, protectedPath) &&
        gitObjectExists(root, codeCommit, protectedPath) &&
        git(root, ["show", `${authorizationCommit}:${protectedPath}`]).equals(
          git(root, ["show", `${codeCommit}:${protectedPath}`]),
        ),
    );
  const failures = validateInputLiveV6Authorization({
    authorization,
    authorizationAddingCommits,
    authorizationCommit,
    codeCommit,
    upstreamCommit,
    clean:
      gitText(root, ["status", "--porcelain", "--untracked-files=all"]) === "",
    antecedentExists,
    antecedentIsAncestorOfCode: isAncestor(
      root,
      INPUT_LIVE_V6_ANTECEDENT_COMMIT,
      codeCommit,
    ),
    antecedentTreeMatches:
      antecedentTree === INPUT_LIVE_V6_ANTECEDENT_TREE &&
      sha256(antecedentTreeBytes) === INPUT_LIVE_V6_ANTECEDENT_TREE_SHA256,
    antecedentArtifactSha256,
    authorizationPresentAtCodeCommit: authorizationAtCode,
    authorizationBytesMatchFirstAddition:
      firstAuthorizationBytes.byteLength > 0 &&
      firstAuthorizationBytes.equals(codeAuthorizationBytes) &&
      firstAuthorizationBytes.equals(workingAuthorizationBytes),
    authorizationStrictlyDescendsFromAntecedent:
      authorizationCommit !== undefined &&
      authorizationCommit !== INPUT_LIVE_V6_ANTECEDENT_COMMIT &&
      isAncestor(root, INPUT_LIVE_V6_ANTECEDENT_COMMIT, authorizationCommit),
    authorizationIsAncestorOfCode: isAncestor(
      root,
      authorizationCommit,
      codeCommit,
    ),
    protectedPathsMatchAuthorizationCommit,
    target,
    expectedDynamicTool,
  });
  if (failures.length)
    throw new Error(
      `Input live v6 authorization refused:\n${failures.join("\n")}`,
    );
  const currentTreeBytes = git(root, [
    "cat-file",
    "tree",
    `${codeCommit}^{tree}`,
  ]);
  return {
    mode: "live",
    protocolCommit: INPUT_LIVE_V6_ANTECEDENT_COMMIT,
    runnerCommit: INPUT_LIVE_V6_ANTECEDENT_COMMIT,
    authorizationCommit: authorizationCommit!,
    codeCommit,
    upstreamCommit: upstreamCommit!,
    authorizationSha256: sha256(workingAuthorizationBytes),
    protocolSha256: INPUT_LIVE_V6_PROTOCOL_SHA256,
    runnerSha256:
      INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256[
        "recipe/run-input-field-live-v6.ts"
      ],
    codeTreeSha256: sha256(currentTreeBytes),
    signingPublicKeySha256: INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256,
    target: INPUT_LIVE_V6_TARGET,
    expectedDynamicTool: INPUT_LIVE_V6_DYNAMIC_TOOL,
    authorizationPath: INPUT_LIVE_V6_AUTHORIZATION_PATH,
  };
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  const proof = verifyInputLiveV6Authorization();
  process.stdout.write(
    `Input live v6 authorized: antecedent=${proof.protocolCommit} authorization=${proof.authorizationCommit} code=${proof.codeCommit}\n`,
  );
}
