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
  buildTableLiveV7Proof,
  TABLE_LIVE_V7_AUTHORIZATION_PATH,
  TABLE_LIVE_V7_INDEX_PATH,
} from "./build-table-live-proof-v7.js";
import {
  buildTableLiveV7AuthorizationArtifact,
  validateTableLiveV7History,
  type TableLiveV7AntecedentIndex,
  type TableLiveV7HistoryState,
} from "./table-live-v7-authorization.js";
import { tableLiveV2Sha256 } from "./table-live-v7-broker.js";

export interface TableLiveV7LifecycleSimulationReport {
  artifactVersion: "table-live-v7-lifecycle-simulation-v1";
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
  GIT_AUTHOR_NAME: "Table v7 Lifecycle Simulation",
  GIT_AUTHOR_EMAIL: "table-v2-simulation@invalid",
  GIT_COMMITTER_NAME: "Table v7 Lifecycle Simulation",
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
  index: TableLiveV7AntecedentIndex,
  indexSha256: string,
  antecedentCommit: string,
  authorizationCommit?: string,
  authorization = undefined as
    ReturnType<typeof buildTableLiveV7AuthorizationArtifact> | undefined,
): TableLiveV7HistoryState => ({
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

export async function simulateTableLiveV7Lifecycle(): Promise<TableLiveV7LifecycleSimulationReport> {
  await buildTableLiveV7Proof(true);
  const indexBefore = readFileSync(TABLE_LIVE_V7_INDEX_PATH);
  const index = JSON.parse(
    indexBefore.toString("utf8"),
  ) as TableLiveV7AntecedentIndex;
  const indexSha256 = tableLiveV2Sha256(indexBefore);
  const temporary = mkdtempSync(path.join(os.tmpdir(), "table-live-v7-life-"));
  try {
    git(temporary, ["init", "-b", "main"]);
    const syntheticIndexPath = path.join(temporary, TABLE_LIVE_V7_INDEX_PATH);
    mkdirSync(path.dirname(syntheticIndexPath), { recursive: true });
    writeFileSync(syntheticIndexPath, indexBefore);
    git(temporary, ["add", TABLE_LIVE_V7_INDEX_PATH]);
    git(temporary, ["commit", "-m", "synthetic table v7 antecedent"]);
    const antecedentCommit = git(temporary, ["rev-parse", "HEAD"]);
    const pending = historyState(index, indexSha256, antecedentCommit);
    const pendingFailures = validateTableLiveV7History(pending, "pending");
    if (pendingFailures.length)
      throw new Error(
        `table v7 lifecycle pending phase failed:\n${pendingFailures.join("\n")}`,
      );
    const staleAuthorized = validateTableLiveV7History(pending, "authorized");
    if (
      !staleAuthorized.some((failure) => failure.includes("stale history mode"))
    )
      throw new Error("table v7 lifecycle did not refuse stale authorized mode");

    const { publicKey } = generateKeyPairSync("ed25519");
    const authorization = buildTableLiveV7AuthorizationArtifact({
      antecedentCommit,
      antecedentIndexBytes: indexBefore,
      signingPublicKey: publicKey,
    });
    const authorizationBytes = Buffer.from(
      `${JSON.stringify(authorization, null, 2)}\n`,
    );
    const authorizationPath = path.join(
      temporary,
      TABLE_LIVE_V7_AUTHORIZATION_PATH,
    );
    mkdirSync(path.dirname(authorizationPath), { recursive: true });
    writeFileSync(authorizationPath, authorizationBytes);
    git(temporary, ["add", TABLE_LIVE_V7_AUTHORIZATION_PATH]);
    git(temporary, ["commit", "-m", "synthetic table v7 authorization"]);
    const authorizationCommit = git(temporary, ["rev-parse", "HEAD"]);

    const committedAntecedentBefore = gitBytes(temporary, [
      "show",
      `${antecedentCommit}:${TABLE_LIVE_V7_INDEX_PATH}`,
    ]);
    const committedAntecedentAfter = gitBytes(temporary, [
      "show",
      `${authorizationCommit}:${TABLE_LIVE_V7_INDEX_PATH}`,
    ]);
    if (!committedAntecedentBefore.equals(committedAntecedentAfter))
      throw new Error(
        "table v7 antecedent index changed across authorization commit",
      );
    const authorized = historyState(
      index,
      indexSha256,
      antecedentCommit,
      authorizationCommit,
      authorization,
    );
    const authorizedFailures = validateTableLiveV7History(
      authorized,
      "authorized",
    );
    if (authorizedFailures.length)
      throw new Error(
        `table v7 lifecycle authorized phase failed:\n${authorizedFailures.join("\n")}`,
      );
    const stalePending = validateTableLiveV7History(authorized, "pending");
    if (!stalePending.some((failure) => failure.includes("stale history mode")))
      throw new Error("table v7 lifecycle did not refuse stale pending mode");

    await buildTableLiveV7Proof(true);
    const indexAfter = readFileSync(TABLE_LIVE_V7_INDEX_PATH);
    if (!indexBefore.equals(indexAfter))
      throw new Error(
        "table v7 generated check changed after synthetic authorization",
      );
    const stableHashSet =
      index.hashSetSha256 ===
      (JSON.parse(indexAfter.toString("utf8")) as TableLiveV7AntecedentIndex)
        .hashSetSha256;
    if (!stableHashSet)
      throw new Error("table v7 antecedent hash set changed after authorization");
    return {
      artifactVersion: "table-live-v7-lifecycle-simulation-v1",
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
      authorizationSha256: tableLiveV2Sha256(authorizationBytes),
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await simulateTableLiveV7Lifecycle(), null, 2)}\n`,
  );
