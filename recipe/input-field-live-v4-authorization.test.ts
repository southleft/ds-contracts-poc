import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V3_EVIDENCE_TREE,
  INPUT_LIVE_V4_ANTECEDENT_COMMIT,
  INPUT_LIVE_V4_AUTHORIZATION_PATH,
  INPUT_LIVE_V4_DEPENDENCY_SHA256,
  INPUT_LIVE_V4_EVIDENCE_ROOT,
  INPUT_LIVE_V4_PHASES,
  INPUT_LIVE_V4_PROTOCOL_PATH,
  INPUT_LIVE_V4_PROTOCOL_SHA256,
  validateInputLiveV4Authorization,
  type InputLiveV4AuthorizationValidation,
} from "./input-field-live-v4-authorization.js";
import {
  validateInputLiveV4CaptureRequest,
  type InputLiveV4CaptureRequest,
} from "./input-field-live-v4-preflight.js";

const readJson = (filePath: string): Record<string, any> =>
  JSON.parse(readFileSync(filePath, "utf8"));

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const authorizationFixture = (): InputLiveV4AuthorizationValidation => ({
  authorization: readJson(INPUT_LIVE_V4_AUTHORIZATION_PATH),
  antecedentProtocolSha256: INPUT_LIVE_V4_PROTOCOL_SHA256,
  codeProtocolSha256: INPUT_LIVE_V4_PROTOCOL_SHA256,
  antecedentDependencySha256: { ...INPUT_LIVE_V4_DEPENDENCY_SHA256 },
  codeDependencySha256: { ...INPUT_LIVE_V4_DEPENDENCY_SHA256 },
  antecedentV3EvidenceTree: INPUT_LIVE_V3_EVIDENCE_TREE,
  codeV3EvidenceTree: INPUT_LIVE_V3_EVIDENCE_TREE,
  clean: true,
  upstreamCommit: "b".repeat(40),
  upstreamEqualsCodeCommit: true,
  authorizationCommitted: true,
  authorizationAddingCommits: ["a".repeat(40)],
  authorizationCommit: "a".repeat(40),
  authorizationBytesMatchFirstAddition: true,
  authorizationPresentAtCodeCommit: true,
  antecedentIsStrictAncestorOfAuthorization: true,
  antecedentIsAncestorOfCodeCommit: true,
  authorizationIsAncestorOfCodeCommit: true,
  codeCommit: "b".repeat(40),
});

const requestFixture = (): InputLiveV4CaptureRequest => ({
  authorizationVerified: true,
  target: {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    connectedExactTargetCount: 1,
  },
  attempt: {
    requested: 1,
    completedV4Attempts: [],
    maximum: 3,
  },
  evidence: {
    root: INPUT_LIVE_V4_EVIDENCE_ROOT,
    captureArtifactPaths: [],
  },
  transactionalPhaseOrder: [...INPUT_LIVE_V4_PHASES],
});

test("committed antecedent fixes protocol, dependencies, and the full v3 evidence tree", () => {
  const full = execFileSync(
    "git",
    ["rev-parse", `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}^{commit}`],
    { encoding: "utf8" },
  ).trim();
  assert.equal(full, INPUT_LIVE_V4_ANTECEDENT_COMMIT);
  const protocol = execFileSync(
    "git",
    [
      "show",
      `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}:${INPUT_LIVE_V4_PROTOCOL_PATH}`,
    ],
    { encoding: "buffer" },
  );
  assert.equal(sha256(protocol), INPUT_LIVE_V4_PROTOCOL_SHA256);
  for (const [filePath, expectedHash] of Object.entries(
    INPUT_LIVE_V4_DEPENDENCY_SHA256,
  )) {
    const bytes = execFileSync(
      "git",
      ["show", `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}:${filePath}`],
      { encoding: "buffer" },
    );
    assert.equal(sha256(bytes), expectedHash, filePath);
  }
  assert.equal(
    execFileSync(
      "git",
      [
        "rev-parse",
        `${INPUT_LIVE_V4_ANTECEDENT_COMMIT}:recipe/evidence/input-field-live-pivot-v3`,
      ],
      { encoding: "utf8" },
    ).trim(),
    INPUT_LIVE_V3_EVIDENCE_TREE,
  );
});

test("authorization declaration has no self-reference, outcomes, or criteria changes", () => {
  const fixture = authorizationFixture();
  assert.deepEqual(validateInputLiveV4Authorization(fixture), []);
  assert.equal(
    fixture.authorization.authorizationCommitDiscovery
      .commitNotEmbeddedInArtifact,
    true,
  );
  assert.match(
    fixture.authorization.authorizationCommitDiscovery.command,
    /<codeCommit>/,
  );
  assert.equal(
    fixture.authorization.criterionPolicy.protocolCriteriaAltered,
    false,
  );
  assert.equal(fixture.authorization.criterionPolicy.captureDataPresent, false);
});

test("authorization self-test rejects chronology, object drift, posthoc data, and v3 reuse", () => {
  const plants: Array<{
    name: string;
    pattern: RegExp;
    mutate: (value: InputLiveV4AuthorizationValidation) => void;
  }> = [
    {
      name: "antecedent protocol drift",
      pattern: /protocol bytes\/hash drift/,
      mutate: (value) => {
        value.antecedentProtocolSha256 = "0".repeat(64);
      },
    },
    {
      name: "capture protocol drift",
      pattern: /protocol bytes\/hash drift/,
      mutate: (value) => {
        value.codeProtocolSha256 = "0".repeat(64);
      },
    },
    {
      name: "runner dependency drift",
      pattern: /dependency bytes\/hash drift/,
      mutate: (value) => {
        value.codeDependencySha256 = {
          ...value.codeDependencySha256,
          "recipe/run-input-field-live-v4.ts": "0".repeat(64),
        };
      },
    },
    {
      name: "wrong binding fixture",
      pattern: /dependency bytes\/hash drift/,
      mutate: (value) => {
        value.codeDependencySha256 = {
          ...value.codeDependencySha256,
          "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json":
            "0".repeat(64),
        };
      },
    },
    {
      name: "v3 evidence changed",
      pattern: /v3 evidence Git tree changed/,
      mutate: (value) => {
        value.codeV3EvidenceTree = "0".repeat(40);
      },
    },
    {
      name: "missing transactional phase",
      pattern: /authorization declaration drift/,
      mutate: (value) => {
        value.authorization.requiredGates.transactionalPhases.pop();
      },
    },
    {
      name: "posthoc outcome",
      pattern: /posthoc outcomes\/thresholds forbidden/,
      mutate: (value) => {
        value.authorization.outcome = "pass";
      },
    },
    {
      name: "posthoc threshold",
      pattern: /posthoc outcomes\/thresholds forbidden/,
      mutate: (value) => {
        value.authorization.requiredGates.thresholds = { pixels: 5 };
      },
    },
    {
      name: "v3 artifact reuse",
      pattern: /v3 evidence reuse forbidden/,
      mutate: (value) => {
        value.authorization.capture.evidenceRoot =
          "recipe/evidence/input-field-live-pivot-v3";
      },
    },
    {
      name: "dirty worktree",
      pattern: /dirty worktree/,
      mutate: (value) => {
        value.clean = false;
      },
    },
    {
      name: "unpushed commit",
      pattern: /unpushed or differs from upstream/,
      mutate: (value) => {
        value.upstreamEqualsCodeCommit = false;
      },
    },
    {
      name: "uncommitted authorization",
      pattern: /pending-uncommitted-authorization/,
      mutate: (value) => {
        value.authorizationCommitted = false;
        value.authorizationAddingCommits = [];
        value.authorizationCommit = undefined;
      },
    },
    {
      name: "non-unique first add",
      pattern: /first-add commit is not unique/,
      mutate: (value) => {
        value.authorizationAddingCommits = ["a".repeat(40), "c".repeat(40)];
      },
    },
    {
      name: "changed after first add",
      pattern: /bytes changed after first-add commit/,
      mutate: (value) => {
        value.authorizationBytesMatchFirstAddition = false;
      },
    },
    {
      name: "old code commit",
      pattern: /old or does not descend from antecedent/,
      mutate: (value) => {
        value.antecedentIsAncestorOfCodeCommit = false;
      },
    },
    {
      name: "capture predates authorization",
      pattern: /codeCommit predates authorization/,
      mutate: (value) => {
        value.authorizationIsAncestorOfCodeCommit = false;
      },
    },
  ];
  for (const plant of plants) {
    const value = authorizationFixture();
    plant.mutate(value);
    assert.match(
      validateInputLiveV4Authorization(value).join("\n"),
      plant.pattern,
      plant.name,
    );
  }
});

test("preflight rejects wrong target, attempt four, v3 reuse, and phase bypass", () => {
  const plants: Array<{
    name: string;
    pattern: RegExp;
    mutate: (value: InputLiveV4CaptureRequest) => void;
  }> = [
    {
      name: "authorization bypass",
      pattern: /authorization verification did not pass/,
      mutate: (value) => {
        value.authorizationVerified = false;
      },
    },
    {
      name: "wrong file",
      pattern: /wrong file/,
      mutate: (value) => {
        value.target.fileKey = "wrong";
      },
    },
    {
      name: "attempt four",
      pattern: /exceeds 3/,
      mutate: (value) => {
        value.attempt.requested = 4;
        value.attempt.completedV4Attempts = [1, 2, 3];
      },
    },
    {
      name: "attempt gap",
      pattern: /attempt chronology/,
      mutate: (value) => {
        value.attempt.requested = 2;
        value.attempt.completedV4Attempts = [];
      },
    },
    {
      name: "v3 reuse",
      pattern: /v3 reuse/,
      mutate: (value) => {
        value.evidence.captureArtifactPaths = [
          "recipe/evidence/input-field-live-pivot-v3/live-attempt-3.json",
        ];
      },
    },
    {
      name: "capture phase moved before gates",
      pattern: /missing or reordered transactional phases/,
      mutate: (value) => {
        value.transactionalPhaseOrder = [
          "preflight",
          "captures-and-objective",
          ...INPUT_LIVE_V4_PHASES.slice(1, -2),
          "retention-and-cleanup",
        ];
      },
    },
  ];
  assert.deepEqual(validateInputLiveV4CaptureRequest(requestFixture()), []);
  for (const plant of plants) {
    const value = requestFixture();
    plant.mutate(value);
    assert.match(
      validateInputLiveV4CaptureRequest(value).join("\n"),
      plant.pattern,
      plant.name,
    );
  }
});
