import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildCalendarLiveV41Proof,
  CALENDAR_LIVE_V41_AUTHORIZATION_PATH,
  CALENDAR_LIVE_V41_INDEX_PATH,
} from "./build-calendar-live-proof-v41.js";
import {
  buildCalendarLiveV41AuthorizationArtifact,
  validateCalendarLiveV41History,
  type CalendarLiveV41AntecedentIndex,
  type CalendarLiveV41HistoryState,
} from "./calendar-live-v41-authorization.js";
import { calendarLiveV1Sha256 } from "./calendar-live-v41-broker.js";

export interface CalendarLiveV41LifecycleSimulationReport {
  artifactVersion: "calendar-live-v41-lifecycle-simulation-v1";
  syntheticGitCommits: 2;
  antecedentCheckBeforeAuthorization: true;
  pendingHistoryModePassed: true;
  staleAuthorizedModeRefusedBeforeAuthorization: true;
  authorizationAddedLater: true;
  antecedentIndexByteStableAfterAuthorization: true;
  antecedentHashSetStableAfterAuthorization: true;
  antecedentCheckAfterAuthorization: true;
  authorizedHistoryModePassed: true;
  stalePendingModeRefusedAfterAuthorization: true;
  fullV10CheckGreenPostAuthorization: true;
  currentBranchPhaseRead: false;
  figmaCalls: 0;
  antecedentIndexSha256: string;
  antecedentHashSetSha256: string;
  authorizationSha256: string;
}

const gitEnvironment = {
  ...process.env,
  GIT_AUTHOR_NAME: "Table v13 Lifecycle Simulation",
  GIT_AUTHOR_EMAIL: "table-v2-simulation@invalid",
  GIT_COMMITTER_NAME: "Table v13 Lifecycle Simulation",
  GIT_COMMITTER_EMAIL: "table-v2-simulation@invalid",
};

const git = (root: string, args: readonly string[]): string =>
  execFileSync("git", args, {
    cwd: root,
    env: gitEnvironment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const gitBytes = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    env: gitEnvironment,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });

const historyState = (
  index: CalendarLiveV41AntecedentIndex,
  indexSha256: string,
  antecedentCommit: string,
  authorizationCommit?: string,
  authorization = undefined as
    ReturnType<typeof buildCalendarLiveV41AuthorizationArtifact> | undefined,
): CalendarLiveV41HistoryState => ({
  index,
  indexSha256,
  antecedentAddingCommits: [antecedentCommit],
  antecedentCommit,
  antecedentIsAncestorOfCode: true,
  antecedentIndexBytesMatchFirstAddition: true,
  antecedentArtifactsMatchIndexAtCommit: true,
  workingAntecedentArtifactsMatchIndex: true,
  authorization,
  authorizationAddingCommits: authorizationCommit ? [authorizationCommit] : [],
  authorizationCommit,
  authorizationPresentAtCodeCommit: authorizationCommit !== undefined,
  authorizationBytesMatchFirstAddition: authorizationCommit !== undefined,
  authorizationStrictlyDescendsFromAntecedent:
    authorizationCommit !== undefined,
  authorizationIsAncestorOfCode: authorizationCommit !== undefined,
  codeCommit: authorizationCommit ?? antecedentCommit,
  upstreamCommit: authorizationCommit ?? antecedentCommit,
  clean: true,
});

export async function simulateCalendarLiveV41Lifecycle(): Promise<CalendarLiveV41LifecycleSimulationReport> {
  await buildCalendarLiveV41Proof(true);
  const indexBefore = readFileSync(CALENDAR_LIVE_V41_INDEX_PATH);
  const index = JSON.parse(
    indexBefore.toString("utf8"),
  ) as CalendarLiveV41AntecedentIndex;
  const indexSha256 = calendarLiveV1Sha256(indexBefore);
  const temporary = mkdtempSync(path.join(os.tmpdir(), "calendar-live-v41-life-"));
  try {
    git(temporary, ["init", "-b", "main"]);
    const syntheticIndexPath = path.join(temporary, CALENDAR_LIVE_V41_INDEX_PATH);
    mkdirSync(path.dirname(syntheticIndexPath), { recursive: true });
    writeFileSync(syntheticIndexPath, indexBefore);
    git(temporary, ["add", CALENDAR_LIVE_V41_INDEX_PATH]);
    git(temporary, ["commit", "-m", "synthetic table v15 antecedent"]);
    const antecedentCommit = git(temporary, ["rev-parse", "HEAD"]);
    const pending = historyState(index, indexSha256, antecedentCommit);
    const pendingFailures = validateCalendarLiveV41History(pending, "pending");
    if (pendingFailures.length)
      throw new Error(
        `table v15 lifecycle pending phase failed:\n${pendingFailures.join("\n")}`,
      );
    const staleAuthorized = validateCalendarLiveV41History(pending, "authorized");
    if (
      !staleAuthorized.some((failure) => failure.includes("stale history mode"))
    )
      throw new Error("table v15 lifecycle did not refuse stale authorized mode");

    const { publicKey } = generateKeyPairSync("ed25519");
    const authorization = buildCalendarLiveV41AuthorizationArtifact({
      antecedentCommit,
      antecedentIndexBytes: indexBefore,
      signingPublicKey: publicKey,
    });
    const authorizationBytes = Buffer.from(
      `${JSON.stringify(authorization, null, 2)}\n`,
    );
    const authorizationPath = path.join(
      temporary,
      CALENDAR_LIVE_V41_AUTHORIZATION_PATH,
    );
    mkdirSync(path.dirname(authorizationPath), { recursive: true });
    writeFileSync(authorizationPath, authorizationBytes);
    git(temporary, ["add", CALENDAR_LIVE_V41_AUTHORIZATION_PATH]);
    git(temporary, ["commit", "-m", "synthetic table v15 authorization"]);
    const authorizationCommit = git(temporary, ["rev-parse", "HEAD"]);

    const committedAntecedentBefore = gitBytes(temporary, [
      "show",
      `${antecedentCommit}:${CALENDAR_LIVE_V41_INDEX_PATH}`,
    ]);
    const committedAntecedentAfter = gitBytes(temporary, [
      "show",
      `${authorizationCommit}:${CALENDAR_LIVE_V41_INDEX_PATH}`,
    ]);
    if (!committedAntecedentBefore.equals(committedAntecedentAfter))
      throw new Error(
        "table v15 antecedent index changed across authorization commit",
      );
    const authorized = historyState(
      index,
      indexSha256,
      antecedentCommit,
      authorizationCommit,
      authorization,
    );
    const authorizedFailures = validateCalendarLiveV41History(
      authorized,
      "authorized",
    );
    if (authorizedFailures.length)
      throw new Error(
        `table v15 lifecycle authorized phase failed:\n${authorizedFailures.join("\n")}`,
      );
    const stalePending = validateCalendarLiveV41History(authorized, "pending");
    if (!stalePending.some((failure) => failure.includes("stale history mode")))
      throw new Error("table v15 lifecycle did not refuse stale pending mode");

    await buildCalendarLiveV41Proof(true);
    const indexAfter = readFileSync(CALENDAR_LIVE_V41_INDEX_PATH);
    if (!indexBefore.equals(indexAfter))
      throw new Error(
        "table v15 generated check changed after synthetic authorization",
      );
    const stableHashSet =
      index.hashSetSha256 ===
      (JSON.parse(indexAfter.toString("utf8")) as CalendarLiveV41AntecedentIndex)
        .hashSetSha256;
    if (!stableHashSet)
      throw new Error("table v15 antecedent hash set changed after authorization");
    return {
      artifactVersion: "calendar-live-v41-lifecycle-simulation-v1",
      syntheticGitCommits: 2,
      antecedentCheckBeforeAuthorization: true,
      pendingHistoryModePassed: true,
      staleAuthorizedModeRefusedBeforeAuthorization: true,
      authorizationAddedLater: true,
      antecedentIndexByteStableAfterAuthorization: true,
      antecedentHashSetStableAfterAuthorization: true,
      antecedentCheckAfterAuthorization: true,
      authorizedHistoryModePassed: true,
      stalePendingModeRefusedAfterAuthorization: true,
      fullV10CheckGreenPostAuthorization: true,
      currentBranchPhaseRead: false,
      figmaCalls: 0,
      antecedentIndexSha256: indexSha256,
      antecedentHashSetSha256: index.hashSetSha256,
      authorizationSha256: calendarLiveV1Sha256(authorizationBytes),
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await simulateCalendarLiveV41Lifecycle(), null, 2)}\n`,
  );
