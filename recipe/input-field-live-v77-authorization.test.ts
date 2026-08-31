import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { INPUT_LIVE_V77_INDEX_PATH } from "./build-input-field-live-proof-v77.js";
import {
  INPUT_LIVE_V77_DYNAMIC_TOOL,
  INPUT_LIVE_V77_TARGET,
} from "./input-field-live-v77-broker.js";
import {
  buildInputLiveV77AuthorizationArtifact,
  validateInputLiveV77AntecedentIndex,
  validateInputLiveV77AuthorizationArtifact,
  validateInputLiveV77History,
  validateInputLiveV77UnitTestSource,
  type InputLiveV77AntecedentIndex,
  type InputLiveV77AuthorizationArtifact,
  type InputLiveV77AuthorizationProof,
  type InputLiveV77HistoryState,
} from "./input-field-live-v77-authorization.js";
import {
  inputLiveV77AttestationSha256,
  validateInputLiveV77ControlFlowSource,
  validateInputLiveV77SecurityAttestation,
  type InputLiveV77SecurityAttestation,
} from "./input-field-live-v77-preflight.js";
import { inputLiveV77Sha256 } from "./input-field-live-v77-broker.js";

const indexBytes = (): Buffer => readFileSync(INPUT_LIVE_V77_INDEX_PATH);
const index = (): InputLiveV77AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as InputLiveV77AntecedentIndex;

const artifact = (): InputLiveV77AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildInputLiveV77AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): InputLiveV77HistoryState => ({
  index: index(),
  indexSha256: inputLiveV77Sha256(indexBytes()),
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

const authorizedState = (): InputLiveV77HistoryState => ({
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
  value: InputLiveV77AuthorizationArtifact,
): InputLiveV77AuthorizationProof => ({
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
  antecedentIndexSha256: inputLiveV77Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: INPUT_LIVE_V77_TARGET,
  expectedDynamicTool: INPUT_LIVE_V77_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/input-field-live-pivot-v77/capture-authorization.json",
});

const attestation = (
  authorization: InputLiveV77AuthorizationArtifact,
): InputLiveV77SecurityAttestation => {
  const body: Omit<InputLiveV77SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "input-live-v77-operator-security-attestation-v1",
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
      target: structuredClone(INPUT_LIVE_V77_TARGET),
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
  return { ...body, attestationSha256: inputLiveV77AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateInputLiveV77History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateInputLiveV77History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateInputLiveV77History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateInputLiveV77History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateInputLiveV77History(authorizedState(), "pending").join("\n"),
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
    validateInputLiveV77UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync(
    "recipe/input-field-live-v77-authorization.test.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV77UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateInputLiveV77AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/input-field-live-pivot-v77/capture-authorization.json",
    "recipe/input-field-live-v77-authorization.ts",
    "recipe/input-field-live-v77-authorization.test.ts",
    "recipe/input-field-live-v77-preflight.ts",
    "recipe/evidence/input-field-live-pivot-v77/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = inputLiveV77Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateInputLiveV77AntecedentIndex(planted).join("\n"),
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
      validateInputLiveV77AuthorizationArtifact(
        planted as InputLiveV77AuthorizationArtifact,
        index(),
        inputLiveV77Sha256(indexBytes()),
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
      value.execution.v26AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.v27AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.v32AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v33AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v34AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v35AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v36AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateInputLiveV77AuthorizationArtifact(
        planted as InputLiveV77AuthorizationArtifact,
        index(),
        inputLiveV77Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateInputLiveV77SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = inputLiveV77AttestationSha256(
      body as Omit<InputLiveV77SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateInputLiveV77SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync(
    "recipe/input-field-live-v77-authorized.ts",
    "utf8",
  );
  assert.deepEqual(validateInputLiveV77ControlFlowSource(source), []);
});
