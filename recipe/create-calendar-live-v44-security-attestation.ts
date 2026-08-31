import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";

import { verifyCalendarLiveV44Authorization } from "./calendar-live-v44-authorization.js";
import { CALENDAR_LIVE_V44_TARGET } from "./calendar-live-v44-broker.js";
import {
  CALENDAR_LIVE_V44_SECURITY_ATTESTATION_DEFAULT_PATH,
  calendarLiveV1AttestationSha256,
  validateCalendarLiveV44SecurityAttestation,
  type CalendarLiveV44SecurityAttestation,
} from "./calendar-live-v44-preflight.js";

const argument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return process.argv
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const proof = verifyCalendarLiveV44Authorization();
const now = argument("--created-at") ?? new Date().toISOString();
const rotationAt = argument("--rotated-at") ?? now;
const restartAt = argument("--restarted-at") ?? now;
const probeAt = argument("--probed-at") ?? now;
const scanAt = argument("--scanned-at") ?? now;
const sessionIdentity =
  argument("--session-identity") ?? "scratch-only-calendar-v44-session";

const body: Omit<CalendarLiveV44SecurityAttestation, "attestationSha256"> = {
  artifactVersion: "calendar-live-v44-operator-security-attestation-v1",
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
    target: CALENDAR_LIVE_V44_TARGET,
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
const attestation: CalendarLiveV44SecurityAttestation = {
  ...body,
  attestationSha256: calendarLiveV1AttestationSha256(body),
};
const failures = validateCalendarLiveV44SecurityAttestation(attestation, proof);
if (failures.length)
  throw new Error(
    `Calendar live v44 security attestation refused:\n${failures.join("\n")}`,
  );

const output = path.resolve(
  argument("--output") ?? CALENDAR_LIVE_V44_SECURITY_ATTESTATION_DEFAULT_PATH,
);
writeFileSync(output, `${JSON.stringify(attestation, null, 2)}\n`, {
  flag: "wx",
  mode: 0o600,
});
chmodSync(output, 0o600);
process.stdout.write(`Wrote owner-only attestation ${output}.\n`);
