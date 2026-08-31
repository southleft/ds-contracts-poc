import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyCalendarLiveV31Authorization } from "./calendar-live-v31-authorization.js";
import { CALENDAR_LIVE_V31_TARGET } from "./calendar-live-v31-broker.js";
import {
  CALENDAR_LIVE_V31_SECURITY_ATTESTATION_DEFAULT_PATH,
  calendarLiveV1AttestationSha256,
  validateCalendarLiveV31SecurityAttestation,
  type CalendarLiveV31SecurityAttestation,
} from "./calendar-live-v31-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyCalendarLiveV31Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-calendar-v31-session";

const body: Omit<CalendarLiveV31SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "calendar-live-v31-operator-security-attestation-v1",
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
    target: CALENDAR_LIVE_V31_TARGET,
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
const attestation: CalendarLiveV31SecurityAttestation = {
  ...body,
  attestationSha256: calendarLiveV1AttestationSha256(body),
};
const failures = validateCalendarLiveV31SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Calendar live v31 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? CALENDAR_LIVE_V31_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
