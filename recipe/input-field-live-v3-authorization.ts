import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export const INPUT_LIVE_V3_ANTECEDENT_COMMIT =
  "be6b01300ad99d8a29ea4c11508d192dec84bbea";
export const INPUT_LIVE_V3_AUTHORIZATION_PATH =
  "recipe/evidence/input-field-live-pivot-v3/capture-authorization.json";
export const INPUT_LIVE_V3_PROTOCOL_PATH =
  "recipe/evidence/input-field-live-pivot-v3/protocol.json";
export const INPUT_LIVE_V3_PROTOCOL_SHA256 =
  "f4decf46da7cd3870e247d5304d632028356580e58ce68bedcb7acb7c0e31a23";
export const INPUT_LIVE_V3_PROTOCOL_VERSION = "input-live-v3-protocol-v1";
export const INPUT_LIVE_V3_FIGMA_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export const INPUT_LIVE_V3_RECEIPT_PATH =
  "recipe/evidence/input-field-live-pivot-v3/receipt.json";

const AUTHORIZATION_VERSION = "input-live-v3-capture-authorization-v1";
const AUTHORIZATION_STATUS =
  "capture may occur only from a clean descendant commit that contains this authorization artifact";
const AUTHORIZATION_DISCOVERY_COMMAND = `git log --reverse --diff-filter=A --format=%H -- ${INPUT_LIVE_V3_AUTHORIZATION_PATH}`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const SCENE_GATES = [
  {
    id: "expected-plan-multiset-occurrences-preserved",
    command: "npm run recipe:scene-readback:check",
  },
  {
    id: "zero-missing-extra-mismatched-duplicate-collapsed-unobserved-facts",
    command: "npm run recipe:scene-readback:check",
  },
  {
    id: "actual-scene-properties-only",
    command: "npm run recipe:scene-readback:check",
  },
  {
    id: "plugin-data-source-ir-forbidden",
    command: "npm run recipe:scene-readback:check",
  },
  {
    id: "silent-count-derived",
    command: "npm run recipe:scene-readback:check",
  },
  {
    id: "two-cycle-scene-derived-fixed-point",
    command: "npm run recipe:scene-readback:check",
  },
] as const;

const TASK2_GATES = [
  {
    id: "controlled-uncontrolled-behavior-and-stable-web-component-input",
    command: "npm run recipe:input-field:browser:check",
  },
  {
    id: "css-and-output-path-security",
    command: "node --import tsx --test recipe/input-field-proof.test.ts",
  },
  {
    id: "actual-adornment-content-payload-and-accessibility",
    command:
      "node --import tsx --test recipe/input-field-figma-writer.test.ts recipe/input-field-figma-writer-v2.test.ts recipe/scene-readback.test.ts",
  },
  {
    id: "font-resolution-provenance-and-named-refusals",
    command:
      "node --import tsx --test recipe/input-field-figma-writer-v2.test.ts",
  },
  {
    id: "typed-deterministic-writer-and-collision-refusals",
    command:
      "node --import tsx --test recipe/input-field-figma-writer.test.ts recipe/input-field-figma-writer-v2.test.ts",
  },
] as const;

const EXPECTED_AUTHORIZATION = {
  artifactVersion: AUTHORIZATION_VERSION,
  authorizationId: "input-live-v3",
  antecedent: {
    commit: INPUT_LIVE_V3_ANTECEDENT_COMMIT,
    criterion: {
      semanticVersion: INPUT_LIVE_V3_PROTOCOL_VERSION,
      path: INPUT_LIVE_V3_PROTOCOL_PATH,
      sha256: INPUT_LIVE_V3_PROTOCOL_SHA256,
    },
  },
  authorizationCommitDiscovery: {
    rule: "the authorization commit is the unique first commit that adds this artifact",
    command: AUTHORIZATION_DISCOVERY_COMMAND,
    mustStrictlyDescendFromAntecedent: true,
    artifactBytesMustRemainEqualToFirstAddition: true,
  },
  capture: {
    status: AUTHORIZATION_STATUS,
    codeCommitRule:
      "codeCommit must equal the discovered authorization commit or be its clean descendant",
    authorizedWritableFigmaFileKeys: [INPUT_LIVE_V3_FIGMA_FILE_KEY],
    receiptPath: INPUT_LIVE_V3_RECEIPT_PATH,
    receiptChronologyFields: [
      "antecedentCommit",
      "authorizationCommit",
      "codeCommit",
    ],
  },
  requiredGates: {
    sceneDerived: SCENE_GATES,
    task2: TASK2_GATES,
  },
} as const;

const EXPECTED_THRESHOLDS = {
  dimensionError: {
    absolutePixels: 4,
    relative: 0.08,
    failureRule: "absolute error exceeds 4px and relative error exceeds 8%",
  },
  spacingError: {
    absolutePixels: 4,
    relative: 0.2,
    failureRule: "absolute error exceeds 4px and relative error exceeds 20%",
  },
  roleScaleError: { relative: 0.1 },
  clipping: { maximumVisibleAreaLoss: 0.05 },
  overlap: { maximumPixels: 2 },
} as const;

type JsonRecord = Record<string, any>;

export interface AuthorizationValidation {
  authorization: JsonRecord;
  antecedentProtocol: JsonRecord;
  captureProtocol: JsonRecord;
  antecedentProtocolHash: string;
  captureProtocolHash: string;
  clean: boolean;
  authorizationCommitted: boolean;
  authorizationAddingCommits: readonly string[];
  authorizationCommit?: string;
  authorizationBytesMatchFirstAddition: boolean;
  authorizationPresentAtCodeCommit: boolean;
  antecedentIsStrictAncestor: boolean;
  authorizationIsAncestorOfCodeCommit: boolean;
  receipt?: {
    value: JsonRecord;
    addingCommits: readonly string[];
    authorizationIsAncestor: boolean;
  };
  codeCommit: string;
}

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const equalJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const findLeakedFields = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findLeakedFields(item, `${prefix}[${index}]`),
    );
  }
  if (value === null || typeof value !== "object") return [];
  const leaked: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (/(result|observed|metric|measurement|score|outcome)/i.test(key)) {
      leaked.push(field);
    }
    leaked.push(...findLeakedFields(child, field));
  }
  return leaked;
};

const validateProtocol = (
  protocol: JsonRecord,
  hash: string,
  label: string,
  failures: string[],
): void => {
  if (hash !== INPUT_LIVE_V3_PROTOCOL_SHA256 || !SHA256_PATTERN.test(hash)) {
    failures.push(`${label} protocol bytes/hash changed`);
  }
  if (
    protocol.artifactVersion !== INPUT_LIVE_V3_PROTOCOL_VERSION ||
    protocol.protocolId !== "input-live-v3"
  ) {
    failures.push(`${label} criterion semantic version changed`);
  }
  if (!equalJson(protocol.hardGates?.thresholds, EXPECTED_THRESHOLDS)) {
    failures.push(`${label} criterion thresholds changed`);
  }
};

export function validateInputLiveV3Authorization(
  value: AuthorizationValidation,
): string[] {
  const failures: string[] = [];
  const authorization = value.authorization;

  validateProtocol(
    value.antecedentProtocol,
    value.antecedentProtocolHash,
    "antecedent",
    failures,
  );
  validateProtocol(
    value.captureProtocol,
    value.captureProtocolHash,
    "capture",
    failures,
  );

  if (
    authorization.artifactVersion !== AUTHORIZATION_VERSION ||
    authorization.authorizationId !== "input-live-v3"
  ) {
    failures.push("authorization identity/version");
  }
  if (
    authorization.antecedent?.commit !== INPUT_LIVE_V3_ANTECEDENT_COMMIT ||
    authorization.antecedent?.criterion?.semanticVersion !==
      INPUT_LIVE_V3_PROTOCOL_VERSION ||
    authorization.antecedent?.criterion?.path !== INPUT_LIVE_V3_PROTOCOL_PATH ||
    authorization.antecedent?.criterion?.sha256 !==
      INPUT_LIVE_V3_PROTOCOL_SHA256
  ) {
    failures.push("antecedent commit/path/criterion hash");
  }
  if (
    authorization.authorizationCommitDiscovery?.rule !==
      "the authorization commit is the unique first commit that adds this artifact" ||
    authorization.authorizationCommitDiscovery?.command !==
      AUTHORIZATION_DISCOVERY_COMMAND ||
    authorization.authorizationCommitDiscovery
      ?.mustStrictlyDescendFromAntecedent !== true ||
    authorization.authorizationCommitDiscovery
      ?.artifactBytesMustRemainEqualToFirstAddition !== true
  ) {
    failures.push("authorization commit discovery rule");
  }
  if (
    authorization.capture?.status !== AUTHORIZATION_STATUS ||
    authorization.capture?.codeCommitRule !==
      "codeCommit must equal the discovered authorization commit or be its clean descendant"
  ) {
    failures.push("clean descendant capture policy");
  }
  if (
    !equalJson(authorization.capture?.authorizedWritableFigmaFileKeys, [
      INPUT_LIVE_V3_FIGMA_FILE_KEY,
    ])
  ) {
    failures.push("wrong authorized writable Figma key");
  }
  if (
    authorization.capture?.receiptPath !== INPUT_LIVE_V3_RECEIPT_PATH ||
    !equalJson(authorization.capture?.receiptChronologyFields, [
      "antecedentCommit",
      "authorizationCommit",
      "codeCommit",
    ])
  ) {
    failures.push("capture receipt chronology contract");
  }
  if (!equalJson(authorization.requiredGates?.sceneDerived, SCENE_GATES)) {
    failures.push("missing required scene-derived gates");
  }
  if (!equalJson(authorization.requiredGates?.task2, TASK2_GATES)) {
    failures.push("missing required Task 2 gates");
  }
  if (!equalJson(authorization, EXPECTED_AUTHORIZATION)) {
    failures.push(
      "authorization declaration drift/result leakage/posthoc metrics",
    );
  }
  const leakedFields = findLeakedFields(authorization);
  if (leakedFields.length > 0) {
    failures.push(
      `authorization result leakage/posthoc metrics: ${leakedFields.join(",")}`,
    );
  }
  if (!value.clean) failures.push("dirty-start capture");
  if (
    !value.authorizationCommitted ||
    value.authorizationAddingCommits.length === 0
  ) {
    failures.push("pending-uncommitted-authorization");
  } else if (
    value.authorizationAddingCommits.length !== 1 ||
    value.authorizationCommit !== value.authorizationAddingCommits[0]
  ) {
    failures.push("authorization first-add commit is not unique");
  }
  if (!value.authorizationBytesMatchFirstAddition) {
    failures.push("authorization bytes changed after first-add commit");
  }
  if (!value.authorizationPresentAtCodeCommit) {
    failures.push("authorization artifact missing from codeCommit");
  }
  if (!value.antecedentIsStrictAncestor) {
    failures.push("authorization commit does not descend from antecedent");
  }
  if (!value.authorizationIsAncestorOfCodeCommit) {
    failures.push("codeCommit predates authorization");
  }

  if (value.receipt) {
    const chronology = value.receipt.value.chronology ?? value.receipt.value;
    if (
      chronology.antecedentCommit !== INPUT_LIVE_V3_ANTECEDENT_COMMIT ||
      chronology.authorizationCommit !== value.authorizationCommit ||
      chronology.codeCommit !== value.codeCommit
    ) {
      failures.push("capture receipt chronology fields");
    }
    if (
      value.receipt.addingCommits.length !== 1 ||
      !value.receipt.authorizationIsAncestor
    ) {
      failures.push("capture receipt predates authorization");
    }
  }

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

const readGitJson = (
  root: string,
  commit: string,
  objectPath: string,
): JsonRecord =>
  JSON.parse(git(root, ["show", `${commit}:${objectPath}`]).toString("utf8"));

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

export function verifyInputLiveV3Authorization(): void {
  const root = gitText(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const codeCommit = gitText(root, [
    "rev-parse",
    "--verify",
    `${argumentValue("--capture-code-commit") ?? "HEAD"}^{commit}`,
  ]);
  const authorization = JSON.parse(
    readFileSync(path.join(root, INPUT_LIVE_V3_AUTHORIZATION_PATH), "utf8"),
  );
  const antecedentProtocolBytes = git(root, [
    "show",
    `${INPUT_LIVE_V3_ANTECEDENT_COMMIT}:${INPUT_LIVE_V3_PROTOCOL_PATH}`,
  ]);
  const captureProtocolBytes = git(root, [
    "show",
    `${codeCommit}:${INPUT_LIVE_V3_PROTOCOL_PATH}`,
  ]);
  const commits = addingCommits(
    root,
    codeCommit,
    INPUT_LIVE_V3_AUTHORIZATION_PATH,
  );
  const authorizationCommit = commits[0];
  const authorizationPresentAtCodeCommit = gitObjectExists(
    root,
    codeCommit,
    INPUT_LIVE_V3_AUTHORIZATION_PATH,
  );
  const committedAuthorizationBytes =
    authorizationCommit === undefined
      ? undefined
      : git(root, [
          "show",
          `${authorizationCommit}:${INPUT_LIVE_V3_AUTHORIZATION_PATH}`,
        ]);
  const codeAuthorizationBytes = authorizationPresentAtCodeCommit
    ? git(root, ["show", `${codeCommit}:${INPUT_LIVE_V3_AUTHORIZATION_PATH}`])
    : undefined;
  const workingAuthorizationBytes = readFileSync(
    path.join(root, INPUT_LIVE_V3_AUTHORIZATION_PATH),
  );

  let receipt: AuthorizationValidation["receipt"];
  if (gitObjectExists(root, "HEAD", INPUT_LIVE_V3_RECEIPT_PATH)) {
    const receiptCommits = addingCommits(
      root,
      "HEAD",
      INPUT_LIVE_V3_RECEIPT_PATH,
    );
    receipt = {
      value: readGitJson(root, "HEAD", INPUT_LIVE_V3_RECEIPT_PATH),
      addingCommits: receiptCommits,
      authorizationIsAncestor:
        authorizationCommit !== undefined &&
        receiptCommits[0] !== undefined &&
        isAncestor(root, authorizationCommit, receiptCommits[0]),
    };
  }

  const failures = validateInputLiveV3Authorization({
    authorization,
    antecedentProtocol: JSON.parse(antecedentProtocolBytes.toString("utf8")),
    captureProtocol: JSON.parse(captureProtocolBytes.toString("utf8")),
    antecedentProtocolHash: sha256(antecedentProtocolBytes),
    captureProtocolHash: sha256(captureProtocolBytes),
    clean:
      gitText(root, ["status", "--porcelain", "--untracked-files=all"]) === "",
    authorizationCommitted: authorizationCommit !== undefined,
    authorizationAddingCommits: commits,
    authorizationCommit,
    authorizationBytesMatchFirstAddition:
      committedAuthorizationBytes !== undefined &&
      codeAuthorizationBytes !== undefined &&
      committedAuthorizationBytes.equals(codeAuthorizationBytes) &&
      committedAuthorizationBytes.equals(workingAuthorizationBytes),
    authorizationPresentAtCodeCommit,
    antecedentIsStrictAncestor:
      authorizationCommit !== undefined &&
      authorizationCommit !== INPUT_LIVE_V3_ANTECEDENT_COMMIT &&
      isAncestor(root, INPUT_LIVE_V3_ANTECEDENT_COMMIT, authorizationCommit),
    authorizationIsAncestorOfCodeCommit:
      authorizationCommit !== undefined &&
      isAncestor(root, authorizationCommit, codeCommit),
    receipt,
    codeCommit,
  });

  if (failures.length > 0) {
    throw new Error(
      `Input live v3 capture authorization invalid:\n${failures.join("\n")}`,
    );
  }
  process.stdout.write(
    `Input live v3 capture authorized: antecedent=${INPUT_LIVE_V3_ANTECEDENT_COMMIT} authorization=${authorizationCommit} codeCommit=${codeCommit} clean=true\n`,
  );
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`) {
  verifyInputLiveV3Authorization();
}
