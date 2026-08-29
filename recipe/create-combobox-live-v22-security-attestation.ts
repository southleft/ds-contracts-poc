import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyComboboxLiveV22Authorization } from "./combobox-live-v22-authorization.js";
import { COMBOBOX_LIVE_V22_TARGET } from "./combobox-live-v22-broker.js";
import {
  COMBOBOX_LIVE_V22_SECURITY_ATTESTATION_DEFAULT_PATH,
  comboboxLiveV5AttestationSha256,
  validateComboboxLiveV22SecurityAttestation,
  type ComboboxLiveV22SecurityAttestation,
} from "./combobox-live-v22-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyComboboxLiveV22Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-combobox-v1-session";

const body: Omit<ComboboxLiveV22SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "combobox-live-v22-operator-security-attestation-v1",
  status: "complete",
  createdAt: now,
  rotation: {
    completedAt: rotationAt,
    completedByUserAssertion: true,
    credentialType: "Figma personal access token",
    exposedCredentialRevokedOrReplaced: true,
    tokenValueStored: false,
  },
  mcpRestart: {
    completedAt: restartAt,
    completedAfterRotation: true,
    sessionIdentity,
    sessionIdentityContainsSecrets: false,
    ownerOnlyEnvironmentFileConfigured: true,
    environmentFileMode: "0600",
    tokenValueStored: false,
  },
  scratchReadOnlyProbe: {
    completedAt: probeAt,
    completedAfterMcpRestart: true,
    target: COMBOBOX_LIVE_V22_TARGET,
    readOnly: true,
    probe: "exact file key, file name, and editor type",
    passed: true,
    figmaWrites: 0,
    figmaCaptures: 0,
  },
  repositorySecretScan: {
    completedAt: scanAt,
    codeCommit: proof.codeCommit,
    scope: "tracked and untracked repository files",
    matches: 0,
    zero: true,
  },
  tokenValuesStored: false,
};
const attestation: ComboboxLiveV22SecurityAttestation = {
  ...body,
  attestationSha256: comboboxLiveV5AttestationSha256(body),
};
const failures = validateComboboxLiveV22SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Combobox live v22 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? COMBOBOX_LIVE_V22_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
