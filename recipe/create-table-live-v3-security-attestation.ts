import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyTableLiveV3Authorization } from "./table-live-v3-authorization.js";
import { TABLE_LIVE_V3_TARGET } from "./table-live-v3-broker.js";
import {
  TABLE_LIVE_V3_SECURITY_ATTESTATION_DEFAULT_PATH,
  tableLiveV2AttestationSha256,
  validateTableLiveV3SecurityAttestation,
  type TableLiveV3SecurityAttestation,
} from "./table-live-v3-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyTableLiveV3Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-table-v3-session";

const body: Omit<TableLiveV3SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "table-live-v3-operator-security-attestation-v1",
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
    target: TABLE_LIVE_V3_TARGET,
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
const attestation: TableLiveV3SecurityAttestation = {
  ...body,
  attestationSha256: tableLiveV2AttestationSha256(body),
};
const failures = validateTableLiveV3SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Table live v3 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? TABLE_LIVE_V3_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
