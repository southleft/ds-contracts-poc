import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CALENDAR_LIVE_V8_INDEX_PATH } from "./build-calendar-live-proof-v8.js";
import {
  CALENDAR_LIVE_V8_DYNAMIC_TOOL,
  CALENDAR_LIVE_V8_TARGET,
  calendarLiveV1Sha256,
} from "./calendar-live-v8-broker.js";
import {
  buildCalendarLiveV8AuthorizationArtifact,
  validateCalendarLiveV8AntecedentIndex,
  validateCalendarLiveV8AuthorizationArtifact,
  validateCalendarLiveV8History,
  validateCalendarLiveV8UnitTestSource,
  type CalendarLiveV8AntecedentIndex,
  type CalendarLiveV8AuthorizationArtifact,
  type CalendarLiveV8AuthorizationProof,
  type CalendarLiveV8HistoryState,
} from "./calendar-live-v8-authorization.js";
import {
  calendarLiveV1AttestationSha256,
  validateCalendarLiveV8ControlFlowSource,
  validateCalendarLiveV8SecurityAttestation,
  type CalendarLiveV8SecurityAttestation,
} from "./calendar-live-v8-preflight.js";

const indexBytes = (): Buffer => readFileSync(CALENDAR_LIVE_V8_INDEX_PATH);
const index = (): CalendarLiveV8AntecedentIndex =>
  JSON.parse(indexBytes().toString("utf8")) as CalendarLiveV8AntecedentIndex;

const artifact = (): CalendarLiveV8AuthorizationArtifact => {
  const { publicKey } = generateKeyPairSync("ed25519");
  return buildCalendarLiveV8AuthorizationArtifact({
    antecedentCommit: "a".repeat(40),
    antecedentIndexBytes: indexBytes(),
    signingPublicKey: publicKey,
  });
};

const pendingState = (): CalendarLiveV8HistoryState => ({
  index: index(),
  indexSha256: calendarLiveV1Sha256(indexBytes()),
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

const authorizedState = (): CalendarLiveV8HistoryState => ({
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
  value: CalendarLiveV8AuthorizationArtifact,
): CalendarLiveV8AuthorizationProof => ({
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
  antecedentIndexSha256: calendarLiveV1Sha256(indexBytes()),
  antecedentHashSetSha256: index().hashSetSha256,
  target: CALENDAR_LIVE_V8_TARGET,
  expectedDynamicTool: CALENDAR_LIVE_V8_DYNAMIC_TOOL,
  authorizationPath:
    "recipe/evidence/calendar-live-pivot-v8/capture-authorization.json",
});

const attestation = (
  authorization: CalendarLiveV8AuthorizationArtifact,
): CalendarLiveV8SecurityAttestation => {
  const body: Omit<CalendarLiveV8SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "calendar-live-v8-operator-security-attestation-v1",
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
      target: structuredClone(CALENDAR_LIVE_V8_TARGET),
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
  return { ...body, attestationSha256: calendarLiveV1AttestationSha256(body) };
};

test("pending, changed, and committed authorization states are pure fixtures", () => {
  assert.deepEqual(validateCalendarLiveV8History(pendingState(), "pending"), []);
  assert.deepEqual(
    validateCalendarLiveV8History(authorizedState(), "authorized"),
    [],
  );

  const changed = authorizedState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateCalendarLiveV8History(changed, "authorized").join("\n"),
    /bytes changed/,
  );
});

test("stale expected history modes fail closed", () => {
  assert.match(
    validateCalendarLiveV8History(pendingState(), "authorized").join("\n"),
    /stale history mode.*pending/,
  );
  assert.match(
    validateCalendarLiveV8History(authorizedState(), "pending").join("\n"),
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
    validateCalendarLiveV8UnitTestSource(v6).join("\n"),
    /phase-sensitive unit test/,
  );
  const own = readFileSync("recipe/calendar-live-v8-authorization.test.ts", "utf8");
  assert.deepEqual(validateCalendarLiveV8UnitTestSource(own), []);
});

test("authorization lifecycle files cannot enter the antecedent hash set", () => {
  assert.deepEqual(validateCalendarLiveV8AntecedentIndex(index()), []);
  for (const plantedPath of [
    "recipe/evidence/calendar-live-pivot-v8/capture-authorization.json",
    "recipe/calendar-live-v8-authorization.ts",
    "recipe/calendar-live-v8-authorization.test.ts",
    "recipe/calendar-live-v8-preflight.ts",
    "recipe/evidence/calendar-live-pivot-v8/operator-security-attestation-template.json",
    "recipe/evidence/status-index.json",
  ]) {
    const planted = structuredClone(index());
    planted.artifacts[plantedPath] = {
      bytes: 1,
      sha256: "0".repeat(64),
    };
    planted.hashSetSha256 = calendarLiveV1Sha256(
      JSON.stringify(
        Object.entries(planted.artifacts).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    );
    assert.match(
      validateCalendarLiveV8AntecedentIndex(planted).join("\n"),
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
      validateCalendarLiveV8AuthorizationArtifact(
        planted as CalendarLiveV8AuthorizationArtifact,
        index(),
        calendarLiveV1Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("one-root denominator, capture gate, cleanup, and prior-lineage reuse are rejected", () => {
  const baseline = artifact();
  for (const mutate of [
    (value: Record<string, any>) => {
      value.denominator.sourceRoots = 2;
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
      value.execution.calendarLiveV1AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.calendarLiveV2AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.calendarLiveV3AuthorizationReusable = true;
    },
    (value: Record<string, any>) => {
      value.execution.calendarLiveV7AuthorizationReusable = true;
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
      validateCalendarLiveV8AuthorizationArtifact(
        planted as CalendarLiveV8AuthorizationArtifact,
        index(),
        calendarLiveV1Sha256(indexBytes()),
      ).length > 0,
    );
  }
});

test("security remains mandatory: rotation, restart, owner-only env, scan, and exact Scratch", () => {
  const authorization = artifact();
  const valid = attestation(authorization);
  assert.deepEqual(
    validateCalendarLiveV8SecurityAttestation(valid, proof(authorization)),
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
    planted.attestationSha256 = calendarLiveV1AttestationSha256(
      body as Omit<CalendarLiveV8SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateCalendarLiveV8SecurityAttestation(planted, proof(authorization))
        .length > 0,
    );
  }
});

test("authorized entrypoint gates initialization behind history and preflight", () => {
  const source = readFileSync("recipe/calendar-live-v8-authorized.ts", "utf8");
  assert.deepEqual(validateCalendarLiveV8ControlFlowSource(source), []);
});
