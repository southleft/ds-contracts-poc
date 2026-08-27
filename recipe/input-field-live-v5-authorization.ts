import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const INPUT_LIVE_V5_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v5/protocol.json";
export const INPUT_LIVE_V5_PROTOCOL_SHA256 =
  "6fdc4b99923aed0990a1f46fe1bdce620e2f63f0b38263983cd2da5443d9b6cf";
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

const SHA40 = /^[a-f0-9]{40}$/;
const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
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
export const createInputLiveV5AuthorizationArtifact = () => ({
  artifactVersion: "input-live-v5-capture-authorization-v1",
  authorizationId: "input-live-v5",
  status: "authorized by separate published descendant commit",
  antecedent: {
    protocolPath: INPUT_LIVE_V5_PROTOCOL_PATH,
    protocolSha256: INPUT_LIVE_V5_PROTOCOL_SHA256,
    discovery:
      "unique first commit adding protocol; authorization must strictly descend",
  },
  target: INPUT_LIVE_V5_TARGET,
  attempts: {
    maximum: 3,
    cleanPublishedDescendantsOnly: true,
    v4AuthorizationReusable: false,
  },
  evidenceRoot: INPUT_LIVE_V5_EVIDENCE_ROOT,
  requiredPhases: INPUT_LIVE_V5_PHASES,
  criterionPolicy: {
    protocolCriteriaAltered: false,
    outcomesPresent: false,
    humanSignoff: "pending",
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
  protocolBytesMatch: boolean;
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

export function validateInputLiveV5Authorization(
  state: InputLiveV5AuthorizationState,
): string[] {
  const failures: string[] = [];
  if (
    JSON.stringify(state.authorization) !==
    JSON.stringify(createInputLiveV5AuthorizationArtifact())
  )
    failures.push("v5 authorization declaration missing or drifted");
  if (
    state.protocolAddingCommits.length !== 1 ||
    state.protocolCommit !== state.protocolAddingCommits[0]
  )
    failures.push("v5 protocol first-add commit is not unique");
  if (
    state.authorizationAddingCommits.length !== 1 ||
    state.authorizationCommit !== state.authorizationAddingCommits[0]
  )
    failures.push(
      "v5 authorization absent, uncommitted, or first-add is not unique",
    );
  if (!state.clean) failures.push("dirty worktree");
  if (!state.upstreamCommit || state.upstreamCommit !== state.codeCommit)
    failures.push("codeCommit is unpushed or differs from upstream");
  if (!state.protocolBytesMatch) failures.push("v5 protocol bytes/hash drift");
  if (!state.authorizationBytesMatchFirstAddition)
    failures.push("v5 authorization bytes changed after first addition");
  if (!state.authorizationPresentAtCodeCommit)
    failures.push("v5 authorization missing from codeCommit");
  if (!state.protocolStrictlyPrecedesAuthorization)
    failures.push(
      "v5 authorization does not strictly descend from protocol antecedent",
    );
  if (!state.authorizationIsAncestorOfCode)
    failures.push("codeCommit predates v5 authorization");
  if (!SHA40.test(state.codeCommit))
    failures.push("codeCommit is not a full commit SHA");
  if (JSON.stringify(state.target) !== JSON.stringify(INPUT_LIVE_V5_TARGET))
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
  const workingAuthorizationBytes = existsSync(authorizationFile)
    ? readFileSync(authorizationFile)
    : Buffer.alloc(0);
  const protocolFile = path.join(root, INPUT_LIVE_V5_PROTOCOL_PATH);
  const protocolBytes = existsSync(protocolFile)
    ? readFileSync(protocolFile)
    : Buffer.alloc(0);
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
    protocolBytesMatch:
      sha256(protocolBytes) === INPUT_LIVE_V5_PROTOCOL_SHA256 &&
      protocolCommit !== undefined &&
      protocolBytes.equals(
        git(root, ["show", `${protocolCommit}:${INPUT_LIVE_V5_PROTOCOL_PATH}`]),
      ),
    authorizationBytesMatchFirstAddition:
      firstAuthorizationBytes.byteLength > 0 &&
      firstAuthorizationBytes.equals(workingAuthorizationBytes),
    authorizationPresentAtCodeCommit: authorizationAtCode,
    protocolStrictlyPrecedesAuthorization:
      protocolCommit !== undefined &&
      authorizationCommit !== undefined &&
      protocolCommit !== authorizationCommit &&
      isAncestor(root, protocolCommit, authorizationCommit),
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
