import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COMBOBOX_LIVE_V40_INDEX_PATH } from "./build-combobox-live-proof-v40.js";
import {
  COMBOBOX_LIVE_V40_DYNAMIC_TOOL,
  COMBOBOX_LIVE_V40_TARGET,
} from "./combobox-live-v40-broker.js";
import {
  buildComboboxLiveV40AuthorizationArtifact,
  validateComboboxLiveV40AntecedentIndex,
  validateComboboxLiveV40AuthorizationArtifact,
  validateComboboxLiveV40History,
  validateComboboxLiveV40UnitTestSource,
  type ComboboxLiveV40AntecedentIndex,
  type ComboboxLiveV40AuthorizationArtifact,
  type ComboboxLiveV40AuthorizationProof,
  type ComboboxLiveV40HistoryState,
} from "./combobox-live-v40-authorization.js";
import {
  comboboxLiveV5AttestationSha256,
  validateComboboxLiveV40ControlFlowSource,
  validateComboboxLiveV40SecurityAttestation,
  type ComboboxLiveV40SecurityAttestation,
} from "./combobox-live-v40-preflight.js";
import { comboboxLiveV5Sha256 } from "./combobox-live-v40-broker.js";

const indexBytes = (): Buffer => readFileSync(COMBOBOX_LIVE_V40_INDEX_PATH);
const index = (): ComboboxLiveV40AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as ComboboxLiveV40AntecedentIndex;

const artifact = (): ComboboxLiveV40AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildComboboxLiveV40AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): ComboboxLiveV40HistoryState => ({
  index: index(),
  indexSha256: comboboxLiveV5Sha256(indexBytes()),
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

const authorizedState = (): ComboboxLiveV40HistoryState => ({
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
  value: ComboboxLiveV40AuthorizationArtifact,
): ComboboxLiveV40AuthorizationProof => ({
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
  antecedentIndexSha256: comboboxLiveV5Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: COMBOBOX_LIVE_V40_TARGET,
  expectedDynamicTool: COMBOBOX_LIVE_V40_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/combobox-live-pivot-v40/capture-authorization.json",
});

const attestation = (
  authorization: ComboboxLiveV40AuthorizationArtifact,
): ComboboxLiveV40SecurityAttestation => {
  const body: Omit<ComboboxLiveV40SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "combobox-live-v40-operator-security-attestation-v1",
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
      target: structuredClone(COMBOBOX_LIVE_V40_TARGET),
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
  return { ...body, attestationSha256: comboboxLiveV5AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateComboboxLiveV40History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateComboboxLiveV40History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateComboboxLiveV40History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateComboboxLiveV40History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateComboboxLiveV40History(authorizedState(), "pending").join("\n"),
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
    validateComboboxLiveV40UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync(
    "recipe/combobox-live-v40-authorization.test.ts",
    "utf8",
  );
  assert.deepEqual(validateComboboxLiveV40UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateComboboxLiveV40AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/combobox-live-pivot-v40/capture-authorization.json",
    "recipe/combobox-live-v40-authorization.ts",
    "recipe/combobox-live-v40-authorization.test.ts",
    "recipe/combobox-live-v40-preflight.ts",
    "recipe/evidence/combobox-live-pivot-v40/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = comboboxLiveV5Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateComboboxLiveV40AntecedentIndex(planted).join("\n"),
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
      validateComboboxLiveV40AuthorizationArtifact(
        planted as ComboboxLiveV40AuthorizationArtifact,
        index(),
        comboboxLiveV5Sha256(indexBytes()),
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
      value.execution.cleanupMustNotExecuteOnMainComplete = false;
    },
    (value: Record<string, any>) => {
      value.execution.taughtCleanupOnFailureOnly = false;
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
      value.execution.v35AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v36AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v37AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v38AuthorizationReusable = true;
    },
    (value) => {
      value.execution.v40AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV2AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV3AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV4AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV5AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV6AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV7AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV8AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV9AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV10AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV11AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV12AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV13AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV16AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV17AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV18AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV19AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV20AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV21AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV22AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV23AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV24AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV25AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV26AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV27AuthorizationReusable = true;
    },
    (value) => {
      value.execution.comboboxLiveV28AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateComboboxLiveV40AuthorizationArtifact(
        planted as ComboboxLiveV40AuthorizationArtifact,
        index(),
        comboboxLiveV5Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateComboboxLiveV40SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = comboboxLiveV5AttestationSha256(
      body as Omit<ComboboxLiveV40SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateComboboxLiveV40SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync(
    "recipe/combobox-live-v40-authorized.ts",
    "utf8",
  );
  assert.deepEqual(validateComboboxLiveV40ControlFlowSource(source), []);
});
