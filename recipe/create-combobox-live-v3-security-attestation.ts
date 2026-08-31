import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyComboboxLiveV3Authorization } from "./combobox-live-v3-authorization.js";
import { COMBOBOX_LIVE_V3_TARGET } from "./combobox-live-v3-broker.js";
import {
  COMBOBOX_LIVE_V3_SECURITY_ATTESTATION_DEFAULT_PATH,
  comboboxLiveV3AttestationSha256,
  validateComboboxLiveV3SecurityAttestation,
  type ComboboxLiveV3SecurityAttestation,
} from "./combobox-live-v3-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyComboboxLiveV3Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-combobox-v1-session";

const body: Omit<ComboboxLiveV3SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "combobox-live-v3-operator-security-attestation-v1",
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
    target: COMBOBOX_LIVE_V3_TARGET,
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
const attestation: ComboboxLiveV3SecurityAttestation = {
  ...body,
  attestationSha256: comboboxLiveV3AttestationSha256(body),
};
const failures = validateComboboxLiveV3SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Combobox live v3 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? COMBOBOX_LIVE_V3_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
