import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { TABLE_LIVE_V27_INDEX_PATH } from "./build-table-live-proof-v27.js";
import {
  TABLE_LIVE_V27_DYNAMIC_TOOL,
  TABLE_LIVE_V27_TARGET,
  tableLiveV2Sha256,
} from "./table-live-v27-broker.js";
import {
  buildTableLiveV27AuthorizationArtifact,
  validateTableLiveV27AntecedentIndex,
  validateTableLiveV27AuthorizationArtifact,
  validateTableLiveV27History,
  validateTableLiveV27UnitTestSource,
  type TableLiveV27AntecedentIndex,
  type TableLiveV27AuthorizationArtifact,
  type TableLiveV27AuthorizationProof,
  type TableLiveV27HistoryState,
} from "./table-live-v27-authorization.js";
import {
  tableLiveV2AttestationSha256,
  validateTableLiveV27ControlFlowSource,
  validateTableLiveV27SecurityAttestation,
  type TableLiveV27SecurityAttestation,
} from "./table-live-v27-preflight.js";

const indexBytes = (): Buffer => readFileSync(TABLE_LIVE_V27_INDEX_PATH);
const index = (): TableLiveV27AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as TableLiveV27AntecedentIndex;

const artifact = (): TableLiveV27AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildTableLiveV27AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): TableLiveV27HistoryState => ({
  index: index(),
  indexSha256: tableLiveV2Sha256(indexBytes()),
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

const authorizedState = (): TableLiveV27HistoryState => ({
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
  value: TableLiveV27AuthorizationArtifact,
): TableLiveV27AuthorizationProof => ({
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
  antecedentIndexSha256: tableLiveV2Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: TABLE_LIVE_V27_TARGET,
  expectedDynamicTool: TABLE_LIVE_V27_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/table-live-pivot-v27/capture-authorization.json",
});

const attestation = (
  authorization: TableLiveV27AuthorizationArtifact,
): TableLiveV27SecurityAttestation => {
  const body: Omit<TableLiveV27SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "table-live-v27-operator-security-attestation-v1",
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
      target: structuredClone(TABLE_LIVE_V27_TARGET),
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
  return { ...body, attestationSha256: tableLiveV2AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateTableLiveV27History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateTableLiveV27History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateTableLiveV27History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateTableLiveV27History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateTableLiveV27History(authorizedState(), "pending").join("\n"),
    /stale history mode.*authorization exists/,
  );
});

test("the exact v6 phase-sensitive self-test defect is planted and table v15 is hermetic", () => {
  const v6 = readFileSync(
    "recipe/input-field-live-v6-authorization.test.ts",
    "utf8",
  );
  assert.match(v6, /assert\.throws\([\s\S]*verifyInputLiveV6Authorization\(\)/);
  assert.match(
    validateTableLiveV27UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync("recipe/table-live-v27-authorization.test.ts", "utf8");
  assert.deepEqual(validateTableLiveV27UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateTableLiveV27AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/table-live-pivot-v27/capture-authorization.json",
    "recipe/table-live-v27-authorization.ts",
    "recipe/table-live-v27-authorization.test.ts",
    "recipe/table-live-v27-preflight.ts",
    "recipe/evidence/table-live-pivot-v27/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = tableLiveV2Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateTableLiveV27AntecedentIndex(planted).join("\n"),
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
      validateTableLiveV27AuthorizationArtifact(
        planted as TableLiveV27AuthorizationArtifact,
        index(),
        tableLiveV2Sha256(indexBytes()),
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
      value.execution.tableLiveV1AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV2AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV3AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV4AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV5AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV6AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV7AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV8AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV9AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.tableLiveV10AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.outcomes = { winner: "recipe" };
    },
  ]) {
    const planted = structuredClone(baseline) as unknown as Record<string, any>;
    mutate(planted);
    assert.ok(
      validateTableLiveV27AuthorizationArtifact(
        planted as TableLiveV27AuthorizationArtifact,
        index(),
        tableLiveV2Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateTableLiveV27SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = tableLiveV2AttestationSha256(
      body as Omit<TableLiveV27SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateTableLiveV27SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync("recipe/table-live-v27-authorized.ts", "utf8");
  assert.deepEqual(validateTableLiveV27ControlFlowSource(source), []);
});
