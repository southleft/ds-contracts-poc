import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TABLE_LIVE_V1_INDEX_PATH } from "./build-table-live-proof-v1.js";
import {
  TABLE_LIVE_V1_DYNAMIC_TOOL,
  TABLE_LIVE_V1_TARGET,
  tableLiveV1Sha256,
} from "./table-live-v1-broker.js";
import {
  buildTableLiveV1AuthorizationArtifact,
  validateTableLiveV1AntecedentIndex,
  validateTableLiveV1AuthorizationArtifact,
  validateTableLiveV1History,
  validateTableLiveV1UnitTestSource,
  type TableLiveV1AntecedentIndex,
  type TableLiveV1AuthorizationArtifact,
  type TableLiveV1AuthorizationProof,
  type TableLiveV1HistoryState,
} from "./table-live-v1-authorization.js";
import {
  tableLiveV1AttestationSha256,
  validateTableLiveV1ControlFlowSource,
  validateTableLiveV1SecurityAttestation,
  type TableLiveV1SecurityAttestation,
} from "./table-live-v1-preflight.js";

const indexBytes = (): Buffer => readFileSync(TABLE_LIVE_V1_INDEX_PATH);
const index = (): TableLiveV1AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as TableLiveV1AntecedentIndex;

const artifact = (): TableLiveV1AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildTableLiveV1AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): TableLiveV1HistoryState => ({
  index: index(),
  indexSha256: tableLiveV1Sha256(indexBytes()),
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

const authorizedState = (): TableLiveV1HistoryState => ({
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
  value: TableLiveV1AuthorizationArtifact,
): TableLiveV1AuthorizationProof => ({
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
  antecedentIndexSha256: tableLiveV1Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: TABLE_LIVE_V1_TARGET,
  expectedDynamicTool: TABLE_LIVE_V1_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/table-live-pivot-v1/capture-authorization.json",
});

const attestation = (
  authorization: TableLiveV1AuthorizationArtifact,
): TableLiveV1SecurityAttestation => {
  const body: Omit<TableLiveV1SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "table-live-v1-operator-security-attestation-v1",
    status: "complete",
    createdAt: "2026-08-29T16:05:00.000Z",
    rotation: {
      completedAt: "2026-08-29T16:00:00.000Z",
      completedByUserAssertion: true,
      credentialType: "Figma personal access token",
      exposedCredentialRevokedOrReplaced: true,
      tokenValueStored: false,
    },
    mcpRestart: {
      completedAt: "2026-08-29T16:01:00.000Z",
      completedAfterRotation: true,
      sessionIdentity: "post-rotation-session",
      sessionIdentityContainsSecrets: false,
      ownerOnlyEnvironmentFileConfigured: true,
      environmentFileMode: "0600",
      tokenValueStored: false,
    },
    scratchReadOnlyProbe: {
      completedAt: "2026-08-29T16:02:00.000Z",
      completedAfterMcpRestart: true,
      target: structuredClone(TABLE_LIVE_V1_TARGET),
      readOnly: true,
      probe: "exact file key, file name, and editor type",
      passed: true,
      figmaWrites: 0,
      figmaCaptures: 0,
    },
    repositorySecretScan: {
      completedAt: "2026-08-29T16:03:00.000Z",
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
  return { ...body, attestationSha256: tableLiveV1AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateTableLiveV1History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateTableLiveV1History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateTableLiveV1History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateTableLiveV1History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateTableLiveV1History(authorizedState(), "pending").join("\n"),
    /stale history mode.*authorization exists/,
  );
});

test("the exact v6 phase-sensitive self-test defect is planted and table v1 is hermetic", () => {
  const v6 = readFileSync(
    "recipe/input-field-live-v6-authorization.test.ts",
    "utf8",
  );
  assert.match(v6, /assert\.throws\([\s\S]*verifyInputLiveV6Authorization\(\)/);
  assert.match(
    validateTableLiveV1UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync("recipe/table-live-v1-authorization.test.ts", "utf8");
  assert.deepEqual(validateTableLiveV1UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateTableLiveV1AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/table-live-pivot-v1/capture-authorization.json",
    "recipe/table-live-v1-authorization.ts",
    "recipe/table-live-v1-authorization.test.ts",
    "recipe/table-live-v1-preflight.ts",
    "recipe/evidence/table-live-pivot-v1/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = tableLiveV1Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateTableLiveV1AntecedentIndex(planted).join("\n"),
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
      validateTableLiveV1AuthorizationArtifact(
        planted as TableLiveV1AuthorizationArtifact,
        index(),
        tableLiveV1Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("two-root denominator, capture gate, cleanup, and prior-lineage reuse are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
    (value: Record<string, any>) => {
      value.denominator.sourceRoots = 1;
    },
    (value: Record<string, any>) => {
      value.denominator.captures = 144;
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
      value.execution.inputV85AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.comboboxLiveV41AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.comboboxLiveV1AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateTableLiveV1AuthorizationArtifact(
        planted as TableLiveV1AuthorizationArtifact,
        index(),
        tableLiveV1Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateTableLiveV1SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = tableLiveV1AttestationSha256(
      body as Omit<TableLiveV1SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateTableLiveV1SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync("recipe/table-live-v1-authorized.ts", "utf8");
  assert.deepEqual(validateTableLiveV1ControlFlowSource(source), []);
});
