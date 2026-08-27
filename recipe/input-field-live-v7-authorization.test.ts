import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INPUT_LIVE_V7_INDEX_PATH } from "./build-input-field-live-proof-v7.js";
import {
  INPUT_LIVE_V7_DYNAMIC_TOOL,
  INPUT_LIVE_V7_TARGET,
} from "./input-field-live-v7-broker.js";
import {
  buildInputLiveV7AuthorizationArtifact,
  validateInputLiveV7AntecedentIndex,
  validateInputLiveV7AuthorizationArtifact,
  validateInputLiveV7History,
  validateInputLiveV7UnitTestSource,
  type InputLiveV7AntecedentIndex,
  type InputLiveV7AuthorizationArtifact,
  type InputLiveV7AuthorizationProof,
  type InputLiveV7HistoryState,
} from "./input-field-live-v7-authorization.js";
import {
  inputLiveV7AttestationSha256,
  validateInputLiveV7ControlFlowSource,
  validateInputLiveV7SecurityAttestation,
  type InputLiveV7SecurityAttestation,
} from "./input-field-live-v7-preflight.js";
import { inputLiveV7Sha256 } from "./input-field-live-v7-broker.js";

const indexBytes = (): Buffer => readFileSync(INPUT_LIVE_V7_INDEX_PATH);
const index = (): InputLiveV7AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as InputLiveV7AntecedentIndex;

const artifact = (): InputLiveV7AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildInputLiveV7AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const preparedArtifact = (): InputLiveV7AuthorizationArtifact =>
  JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v7/capture-authorization.json",
      "utf8",
    ),
  ) as InputLiveV7AuthorizationArtifact;

const pendingState = (): InputLiveV7HistoryState => ({
  index: index(),
  indexSha256: inputLiveV7Sha256(indexBytes()),
  antecedentAddingCommits: ["a".repeat(40)],
  antecedentCommit: "a".repeat(40),
  antecedentIsAncestorOfCode: true,
  antecedentIndexBytesMatchFirstAddition: true,
  antecedentArtifactsMatchIndexAtCommit: true,
  workingAntecedentArtifactsMatchIndex: true,
  authorizationAddingCommits: [],
  authorizationPresentAtCodeCommit: false,
  authorizationBytesMatchFirstAddition: false,
  authorizationStrictlyDescendsFromAntecedent: false,
  authorizationIsAncestorOfCode: false,
  codeCommit: "a".repeat(40),
  upstreamCommit: "a".repeat(40),
  clean: true,
  pendingChangesOnlyAuthorizationLifecycle: false,
});

const authorizedState = (): InputLiveV7HistoryState => ({
  ...pendingState(),
  authorization: artifact(),
  authorizationAddingCommits: ["b".repeat(40)],
  authorizationCommit: "b".repeat(40),
  authorizationPresentAtCodeCommit: true,
  authorizationBytesMatchFirstAddition: true,
  authorizationStrictlyDescendsFromAntecedent: true,
  authorizationIsAncestorOfCode: true,
  codeCommit: "c".repeat(40),
  upstreamCommit: "c".repeat(40),
});

const proof = (
  value: InputLiveV7AuthorizationArtifact,
): InputLiveV7AuthorizationProof => ({
  mode: "live",
  protocolCommit: "a".repeat(40),
  runnerCommit: "a".repeat(40),
  authorizationCommit: "b".repeat(40),
  codeCommit: "c".repeat(40),
  upstreamCommit: "c".repeat(40),
  authorizationSha256: "1".repeat(64),
  protocolSha256: "2".repeat(64),
  runnerSha256: "3".repeat(64),
  codeTreeSha256: "4".repeat(64),
  signingPublicKeySha256: value.signingPublicKey.spkiSha256,
  antecedentIndexSha256: inputLiveV7Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: INPUT_LIVE_V7_TARGET,
  expectedDynamicTool: INPUT_LIVE_V7_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/input-field-live-pivot-v7/capture-authorization.json",
});

const attestation = (
  authorization: InputLiveV7AuthorizationArtifact,
): InputLiveV7SecurityAttestation => {
  const body: Omit<InputLiveV7SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "input-live-v7-operator-security-attestation-v1",
    status: "complete",
    createdAt: "2026-08-27T15:05:00.000Z",
    rotation: {
      completedAt: "2026-08-27T15:00:00.000Z",
      completedByUserAssertion: true,
      credentialType: "Figma personal access token",
      exposedCredentialRevokedOrReplaced: true,
      tokenValueStored: false,
    },
    mcpRestart: {
      completedAt: "2026-08-27T15:01:00.000Z",
      completedAfterRotation: true,
      sessionIdentity: "post-rotation-session",
      sessionIdentityContainsSecrets: false,
      ownerOnlyEnvironmentFileConfigured: true,
      environmentFileMode: "0600",
      tokenValueStored: false,
    },
    scratchReadOnlyProbe: {
      completedAt: "2026-08-27T15:02:00.000Z",
      completedAfterMcpRestart: true,
      target: structuredClone(INPUT_LIVE_V7_TARGET),
      readOnly: true,
      probe: "exact file key, file name, and editor type",
      passed: true,
      figmaWrites: 0,
      figmaCaptures: 0,
    },
    repositorySecretScan: {
      completedAt: "2026-08-27T15:03:00.000Z",
      codeCommit: "c".repeat(40),
      scope: "tracked and untracked repository files",
      matches: 0,
      zero: true,
    },
    tokenValuesStored: false,
  };
  assert.equal(
    createPublicKey(authorization.signingPublicKey.publicKeyPem).export({
      type: "spki",
      format: "der",
    }).byteLength,
    44,
  );
  return { ...body, attestationSha256: inputLiveV7AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateInputLiveV7History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateInputLiveV7History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateInputLiveV7History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("prepared authorization pins the published antecedent and a non-v6 identity", () => {
  const prepared = preparedArtifact();
  assert.deepEqual(
    validateInputLiveV7AuthorizationArtifact(
      prepared,
      index(),
      inputLiveV7Sha256(indexBytes()),
    ),
    [],
  );
  assert.equal(
    prepared.antecedent.commit,
    "117f1cddce797393b1b705da62323615e584d54b",
  );
  assert.notEqual(
    prepared.signingPublicKey.spkiSha256,
    "c5d04bf950dea3e1b62a2a274031677546e9c24bbee4cabb64773d0f1a7b3ac4",
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateInputLiveV7History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateInputLiveV7History(authorizedState(), "pending").join("\n"),
    /stale history mode.*authorization exists/,
  );
  const uncommitted = pendingState();
  uncommitted.authorization = artifact();
  uncommitted.clean = false;
  uncommitted.pendingChangesOnlyAuthorizationLifecycle = true;
  assert.deepEqual(validateInputLiveV7History(uncommitted, "pending"), []);
  assert.match(
    validateInputLiveV7History(uncommitted, "authorized").join("\n"),
    /pending-uncommitted-authorization/,
  );
});

test("authorized history requires clean published strict descendants", () => {
  const dirty = authorizedState();
  dirty.clean = false;
  assert.match(
    validateInputLiveV7History(dirty, "authorized").join("\n"),
    /dirty worktree/,
  );
  const unpublished = authorizedState();
  unpublished.upstreamCommit = "d".repeat(40);
  assert.match(
    validateInputLiveV7History(unpublished, "authorized").join("\n"),
    /unpushed or differs from upstream/,
  );
  const nonDescendant = authorizedState();
  nonDescendant.authorizationStrictlyDescendsFromAntecedent = false;
  assert.match(
    validateInputLiveV7History(nonDescendant, "authorized").join("\n"),
    /does not strictly descend/,
  );
});

test("the exact v6 phase-sensitive self-test defect is planted and v7 is hermetic", () => {
  const v6 = readFileSync(
    "recipe/input-field-live-v6-authorization.test.ts",
    "utf8",
  );
  assert.match(v6, /assert\.throws\([\s\S]*verifyInputLiveV6Authorization\(\)/);
  assert.match(
    validateInputLiveV7UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync(
    "recipe/input-field-live-v7-authorization.test.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV7UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateInputLiveV7AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/input-field-live-pivot-v7/capture-authorization.json",
    "recipe/input-field-live-v7-authorization.ts",
    "recipe/input-field-live-v7-authorization.test.ts",
    "recipe/input-field-live-v7-preflight.ts",
    "recipe/evidence/input-field-live-pivot-v7/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = inputLiveV7Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateInputLiveV7AntecedentIndex(planted).join("\n"),
      /authorization lifecycle entered antecedent hash/,
    );
  }
});

test("wrong antecedent, target, tool, signing key, and private material are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
    (value: Record<string, any>) => {
      value.antecedent.artifacts[
        "recipe/evidence/input-field-live-pivot-v7/protocol.json"
      ].sha256 = "0".repeat(64);
    },
    (value: Record<string, any>) => {
      value.operatorBoundary.target.fileKey = "wrong";
    },
    (value: Record<string, any>) => {
      value.operatorBoundary.expectedDynamicTool.tool = "wrong";
    },
    (value: Record<string, any>) => {
      value.signingPublicKey.spkiSha256 = "0".repeat(64);
    },
    (value: Record<string, any>) => {
      value.signingPublicKey.privateKeyPem =
        "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----";
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateInputLiveV7AuthorizationArtifact(
        planted as InputLiveV7AuthorizationArtifact,
        index(),
        inputLiveV7Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("phase order, denominator, capture gate, cleanup, v6 reuse, and result leakage are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
    (value: Record<string, any>) => {
      value.execution.phaseOrder[3] = "capture";
    },
    (value: Record<string, any>) => {
      value.denominator.sourceRoots = 1;
    },
    (value: Record<string, any>) => {
      value.denominator.captures = 127;
    },
    (value: Record<string, any>) => {
      value.execution.captureBeforeHashBoundTechnicalGates = true;
    },
    (value: Record<string, any>) => {
      value.execution.cleanupMustRemainExecutableAfterHostFailure = false;
    },
    (value: Record<string, any>) => {
      value.execution.v6AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateInputLiveV7AuthorizationArtifact(
        planted as InputLiveV7AuthorizationArtifact,
        index(),
        inputLiveV7Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateInputLiveV7SecurityAttestation(valid, proof(authorization)),
    [],
  );
  for (const mutate of [
    (value: Record<string, any>) => {
      value.rotation.exposedCredentialRevokedOrReplaced = false;
    },
    (value: Record<string, any>) => {
      value.mcpRestart.completedAfterRotation = false;
    },
    (value: Record<string, any>) => {
      value.mcpRestart.environmentFileMode = "0644";
    },
    (value: Record<string, any>) => {
      value.repositorySecretScan.matches = 1;
      value.repositorySecretScan.zero = false;
    },
    (value: Record<string, any>) => {
      value.scratchReadOnlyProbe.target.fileKey = "wrong";
    },
    (value: Record<string, any>) => {
      value.mcpRestart.accessToken = "redacted";
    },
  ]) {
    const planted = structuredClone(valid) as unknown as Record<string, any>;
    mutate(planted);
    const { attestationSha256: _, ...body } = planted;
    planted.attestationSha256 = inputLiveV7AttestationSha256(
      body as Omit<InputLiveV7SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateInputLiveV7SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync(
    "recipe/input-field-live-v7-authorized.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV7ControlFlowSource(source), []);
});
