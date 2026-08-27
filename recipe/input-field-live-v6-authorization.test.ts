import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256,
  INPUT_LIVE_V6_ANTECEDENT_COMMIT,
  INPUT_LIVE_V6_AUTHORIZATION_PATH,
  INPUT_LIVE_V6_PROTOCOL_SHA256,
  INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256,
  validateInputLiveV6Authorization,
  verifyInputLiveV6Authorization,
  type InputLiveV6AuthorizationProof,
  type InputLiveV6AuthorizationState,
} from "./input-field-live-v6-authorization.js";
import {
  INPUT_LIVE_V6_DYNAMIC_TOOL,
  INPUT_LIVE_V6_TARGET,
} from "./input-field-live-v6-broker.js";
import {
  inputLiveV6AttestationSha256,
  validateInputLiveV6ControlFlowSource,
  validateInputLiveV6SecurityAttestation,
  type InputLiveV6SecurityAttestation,
} from "./input-field-live-v6-preflight.js";

const authorization = (): Record<string, any> =>
  JSON.parse(readFileSync(INPUT_LIVE_V6_AUTHORIZATION_PATH, "utf8")) as Record<
    string,
    any
  >;

const validState = (): InputLiveV6AuthorizationState => ({
  authorization: authorization(),
  authorizationAddingCommits: ["a".repeat(40)],
  authorizationCommit: "a".repeat(40),
  codeCommit: "b".repeat(40),
  upstreamCommit: "b".repeat(40),
  clean: true,
  antecedentExists: true,
  antecedentIsAncestorOfCode: true,
  antecedentTreeMatches: true,
  antecedentArtifactSha256: {
    ...INPUT_LIVE_V6_ANTECEDENT_ARTIFACT_SHA256,
  },
  authorizationPresentAtCodeCommit: true,
  authorizationBytesMatchFirstAddition: true,
  authorizationStrictlyDescendsFromAntecedent: true,
  authorizationIsAncestorOfCode: true,
  protectedPathsMatchAuthorizationCommit: true,
  target: INPUT_LIVE_V6_TARGET,
  expectedDynamicTool: INPUT_LIVE_V6_DYNAMIC_TOOL,
});

const proof = (): InputLiveV6AuthorizationProof => ({
  mode: "live",
  protocolCommit: INPUT_LIVE_V6_ANTECEDENT_COMMIT,
  runnerCommit: INPUT_LIVE_V6_ANTECEDENT_COMMIT,
  authorizationCommit: "a".repeat(40),
  codeCommit: "b".repeat(40),
  upstreamCommit: "b".repeat(40),
  authorizationSha256: "1".repeat(64),
  protocolSha256: INPUT_LIVE_V6_PROTOCOL_SHA256,
  runnerSha256: "2".repeat(64),
  codeTreeSha256: "3".repeat(64),
  signingPublicKeySha256: INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256,
  target: INPUT_LIVE_V6_TARGET,
  expectedDynamicTool: INPUT_LIVE_V6_DYNAMIC_TOOL,
  authorizationPath: INPUT_LIVE_V6_AUTHORIZATION_PATH,
});

const completeAttestation = (): InputLiveV6SecurityAttestation => {
  const body: Omit<InputLiveV6SecurityAttestation, "attestationSha256"> = {
    artifactVersion: "input-live-v6-operator-security-attestation-v1",
    status: "complete",
    createdAt: "2026-08-27T14:05:00.000Z",
    rotation: {
      completedAt: "2026-08-27T14:00:00.000Z",
      completedByUserAssertion: true,
      credentialType: "Figma personal access token",
      exposedCredentialRevokedOrReplaced: true,
      tokenValueStored: false,
    },
    mcpRestart: {
      completedAt: "2026-08-27T14:01:00.000Z",
      completedAfterRotation: true,
      sessionIdentity: "mcp-session-after-rotation",
      sessionIdentityContainsSecrets: false,
      ownerOnlyEnvironmentFileConfigured: true,
      environmentFileMode: "0600",
      tokenValueStored: false,
    },
    scratchReadOnlyProbe: {
      completedAt: "2026-08-27T14:02:00.000Z",
      completedAfterMcpRestart: true,
      target: structuredClone(INPUT_LIVE_V6_TARGET),
      readOnly: true,
      probe: "exact file key, file name, and editor type",
      result: "passed",
      figmaWrites: 0,
      figmaCaptures: 0,
    },
    plaintextHelpers: {
      pathsPresent: false,
      paths: [],
      confirmedAbsent: true,
    },
    repositorySecretScan: {
      completedAt: "2026-08-27T14:03:00.000Z",
      codeCommit: "b".repeat(40),
      scope: "tracked and untracked repository files",
      scanner: "input-live-v6-preflight-v1",
      matches: 0,
      zero: true,
    },
    tokenValuesStored: false,
  };
  return {
    ...body,
    attestationSha256: inputLiveV6AttestationSha256(body),
  };
};

test("prepared v6 authorization pins exact antecedent, public key, and denominators", () => {
  assert.deepEqual(validateInputLiveV6Authorization(validState()), []);
  const artifact = authorization();
  assert.equal(artifact.antecedent.commit, INPUT_LIVE_V6_ANTECEDENT_COMMIT);
  assert.equal(
    artifact.antecedent.protocol.sha256,
    INPUT_LIVE_V6_PROTOCOL_SHA256,
  );
  assert.equal(
    artifact.signingPublicKey.spkiSha256,
    INPUT_LIVE_V6_SIGNING_PUBLIC_KEY_SPKI_SHA256,
  );
  assert.equal(artifact.denominator.remoteRequests, 132);
  assert.equal(artifact.denominator.hostPhases, 3);
  assert.equal(artifact.denominator.captures, 128);
  assert.equal(artifact.twoRootFacts.expectedFacts, 43_726);
  assert.equal(artifact.outcomes, null);
});

test("history gate refuses an uncommitted or changed authorization artifact", () => {
  const uncommitted = validState();
  uncommitted.authorizationAddingCommits = [];
  uncommitted.authorizationCommit = undefined;
  assert.match(
    validateInputLiveV6Authorization(uncommitted).join("\n"),
    /pending-uncommitted-authorization/,
  );
  const changed = validState();
  changed.authorizationBytesMatchFirstAddition = false;
  assert.match(
    validateInputLiveV6Authorization(changed).join("\n"),
    /bytes changed/,
  );
  assert.throws(
    () => verifyInputLiveV6Authorization(),
    /pending-uncommitted-authorization/,
  );
});

test("authorization rejects wrong antecedent, protocol, and phase program pins", () => {
  for (const mutate of [
    (state: InputLiveV6AuthorizationState) => {
      state.authorization!.antecedent.commit = "0".repeat(40);
    },
    (state: InputLiveV6AuthorizationState) => {
      state.authorization!.antecedent.protocol.sha256 = "0".repeat(64);
    },
    (state: InputLiveV6AuthorizationState) => {
      state.authorization!.antecedent.artifacts[
        "recipe/evidence/input-field-live-pivot-v6/programs/probe-blueprint.js"
      ] = "0".repeat(64);
    },
  ]) {
    const state = validState();
    mutate(state);
    assert.ok(validateInputLiveV6Authorization(state).length > 0);
  }
});

test("authorization rejects private signing material and v5 authorization reuse", () => {
  const privateLeak = validState();
  privateLeak.authorization!.signingPublicKey.privateKeyPem =
    "-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----";
  assert.match(
    validateInputLiveV6Authorization(privateLeak).join("\n"),
    /private signing key/,
  );
  const reused = validState();
  reused.authorization!.authorizationId = "input-live-v5";
  reused.authorization!.execution.v5AuthorizationReusable = true;
  assert.match(
    validateInputLiveV6Authorization(reused).join("\n"),
    /v5 authorization reuse forbidden/,
  );
});

test("authorization rejects wrong target or tool and dirty or unpushed code", () => {
  const wrongBoundary = validState();
  wrongBoundary.authorization!.operatorBoundary.target.fileKey = "wrong";
  wrongBoundary.authorization!.operatorBoundary.expectedDynamicTool.tool =
    "wrong";
  assert.match(
    validateInputLiveV6Authorization(wrongBoundary).join("\n"),
    /wrong v6 target or dynamic tool/,
  );
  const unpublished = validState();
  unpublished.clean = false;
  unpublished.upstreamCommit = "c".repeat(40);
  assert.match(
    validateInputLiveV6Authorization(unpublished).join("\n"),
    /dirty worktree.*unpushed/s,
  );
});

test("authorization rejects denominator, capture order, cleanup, and result leakage", () => {
  const denominator = validState();
  denominator.authorization!.denominator.remoteRequests = 131;
  assert.match(
    validateInputLiveV6Authorization(denominator).join("\n"),
    /denominator changed/,
  );
  const capture = validState();
  capture.authorization!.execution.captureBeforeHashBoundTechnicalGates = true;
  assert.match(
    validateInputLiveV6Authorization(capture).join("\n"),
    /capture gate/,
  );
  const cleanup = validState();
  cleanup.authorization!.execution.cleanupMustRemainExecutableAfterHostFailure = false;
  assert.match(
    validateInputLiveV6Authorization(cleanup).join("\n"),
    /cleanup policy weakened/,
  );
  const result = validState();
  result.authorization!.outcomes = { winner: "recipe" };
  assert.match(
    validateInputLiveV6Authorization(result).join("\n"),
    /result leakage|outcomes/,
  );
});

test("security attestation remains mandatory and cannot claim pre-rotation evidence", () => {
  assert.match(
    validateInputLiveV6SecurityAttestation({}, proof()).join("\n"),
    /missing completed v6 security attestation/,
  );
  const stale = completeAttestation();
  stale.createdAt = "2026-08-27T13:59:00.000Z";
  stale.attestationSha256 = "0".repeat(64);
  assert.match(
    validateInputLiveV6SecurityAttestation(stale, proof()).join("\n"),
    /not created after|hash mismatch/,
  );
});

test("security attestation rejects helper paths, stale scans, secrets, and wrong Scratch", () => {
  for (const mutate of [
    (value: Record<string, any>) => {
      value.plaintextHelpers.pathsPresent = true;
      value.plaintextHelpers.paths = ["/tmp/token-helper"];
    },
    (value: Record<string, any>) => {
      value.repositorySecretScan.codeCommit = "c".repeat(40);
    },
    (value: Record<string, any>) => {
      value.mcpRestart.accessToken = "redacted";
    },
    (value: Record<string, any>) => {
      value.scratchReadOnlyProbe.target.fileKey = "wrong";
    },
  ]) {
    const value = completeAttestation() as unknown as Record<string, any>;
    mutate(value);
    const { attestationSha256: _, ...body } = value;
    value.attestationSha256 = inputLiveV6AttestationSha256(
      body as Omit<InputLiveV6SecurityAttestation, "attestationSha256">,
    );
    assert.ok(
      validateInputLiveV6SecurityAttestation(value, proof()).length > 0,
    );
  }
});

test("complete post-rotation attestation and runner control-flow gates pass offline", () => {
  assert.deepEqual(
    validateInputLiveV6SecurityAttestation(completeAttestation(), proof()),
    [],
  );
  const source = readFileSync("recipe/run-input-field-live-v6.ts", "utf8");
  assert.deepEqual(validateInputLiveV6ControlFlowSource(source), []);
});
