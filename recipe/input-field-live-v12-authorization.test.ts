import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INPUT_LIVE_V12_INDEX_PATH } from "./build-input-field-live-proof-v12.js";
import {
  INPUT_LIVE_V12_DYNAMIC_TOOL,
  INPUT_LIVE_V12_TARGET,
} from "./input-field-live-v12-broker.js";
import {
  buildInputLiveV12AuthorizationArtifact,
  validateInputLiveV12AntecedentIndex,
  validateInputLiveV12AuthorizationArtifact,
  validateInputLiveV12History,
  validateInputLiveV12UnitTestSource,
  type InputLiveV12AntecedentIndex,
  type InputLiveV12AuthorizationArtifact,
  type InputLiveV12AuthorizationProof,
  type InputLiveV12HistoryState,
} from "./input-field-live-v12-authorization.js";
import {
  inputLiveV12AttestationSha256,
  validateInputLiveV12ControlFlowSource,
  validateInputLiveV12SecurityAttestation,
  type InputLiveV12SecurityAttestation,
} from "./input-field-live-v12-preflight.js";
import { inputLiveV12Sha256 } from "./input-field-live-v12-broker.js";

const indexBytes = (): Buffer => readFileSync(INPUT_LIVE_V12_INDEX_PATH);
const index = (): InputLiveV12AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as InputLiveV12AntecedentIndex;

const artifact = (): InputLiveV12AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildInputLiveV12AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): InputLiveV12HistoryState => ({
  index: index(),
  indexSha256: inputLiveV12Sha256(indexBytes()),
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
});

const authorizedState = (): InputLiveV12HistoryState => ({
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
  value: InputLiveV12AuthorizationArtifact,
): InputLiveV12AuthorizationProof => ({
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
  antecedentIndexSha256: inputLiveV12Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: INPUT_LIVE_V12_TARGET,
  expectedDynamicTool: INPUT_LIVE_V12_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/input-field-live-pivot-v12/capture-authorization.json",
});

const attestation = (
  authorization: InputLiveV12AuthorizationArtifact,
): InputLiveV12SecurityAttestation => {
  const body: Omit<InputLiveV12SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "input-live-v12-operator-security-attestation-v1",
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
      target: structuredClone(INPUT_LIVE_V12_TARGET),
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
  return { ...body, attestationSha256: inputLiveV12AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateInputLiveV12History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateInputLiveV12History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateInputLiveV12History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateInputLiveV12History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateInputLiveV12History(authorizedState(), "pending").join("\n"),
    /stale history mode.*authorization exists/,
  );
});

test("the exact v6 phase-sensitive self-test defect is planted and v8 is hermetic", () => {
  const v6 = readFileSync(
    "recipe/input-field-live-v6-authorization.test.ts",
    "utf8",
  );
  assert.match(v6, /assert\.throws\([\s\S]*verifyInputLiveV6Authorization\(\)/);
  assert.match(
    validateInputLiveV12UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync(
    "recipe/input-field-live-v12-authorization.test.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV12UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateInputLiveV12AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/input-field-live-pivot-v12/capture-authorization.json",
    "recipe/input-field-live-v12-authorization.ts",
    "recipe/input-field-live-v12-authorization.test.ts",
    "recipe/input-field-live-v12-preflight.ts",
    "recipe/evidence/input-field-live-pivot-v12/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = inputLiveV12Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateInputLiveV12AntecedentIndex(planted).join("\n"),
      /authorization lifecycle entered antecedent hash/,
    );
  }
});

test("wrong target, tool, signing key, and private material are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
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
      validateInputLiveV12AuthorizationArtifact(
        planted as InputLiveV12AuthorizationArtifact,
        index(),
        inputLiveV12Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("two-root denominator, capture gate, cleanup, v6 reuse, and result leakage are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
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
      value.execution.v7AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.v8AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateInputLiveV12AuthorizationArtifact(
        planted as InputLiveV12AuthorizationArtifact,
        index(),
        inputLiveV12Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateInputLiveV12SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = inputLiveV12AttestationSha256(
      body as Omit<InputLiveV12SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateInputLiveV12SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync(
    "recipe/input-field-live-v12-authorized.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV12ControlFlowSource(source), []);
});
