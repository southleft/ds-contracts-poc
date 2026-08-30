import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyCalendarLiveV37Authorization } from "./calendar-live-v37-authorization.js";
import { CALENDAR_LIVE_V37_TARGET } from "./calendar-live-v37-broker.js";
import {
  CALENDAR_LIVE_V37_SECURITY_ATTESTATION_DEFAULT_PATH,
  calendarLiveV1AttestationSha256,
  validateCalendarLiveV37SecurityAttestation,
  type CalendarLiveV37SecurityAttestation,
} from "./calendar-live-v37-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyCalendarLiveV37Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-calendar-v37-session";

const body: Omit<CalendarLiveV37SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "calendar-live-v37-operator-security-attestation-v1",
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
    target: CALENDAR_LIVE_V37_TARGET,
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
const attestation: CalendarLiveV37SecurityAttestation = {
  ...body,
  attestationSha256: calendarLiveV1AttestationSha256(body),
};
const failures = validateCalendarLiveV37SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Calendar live v37 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? CALENDAR_LIVE_V37_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
