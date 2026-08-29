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
  buildComboboxLiveV24Proof,
  COMBOBOX_LIVE_V24_AUTHORIZATION_PATH,
  COMBOBOX_LIVE_V24_INDEX_PATH,
} from "./build-combobox-live-proof-v24.js";
import {
  buildComboboxLiveV24AuthorizationArtifact,
  validateComboboxLiveV24History,
  type ComboboxLiveV24AntecedentIndex,
  type ComboboxLiveV24HistoryState,
} from "./combobox-live-v24-authorization.js";
import { comboboxLiveV5Sha256 } from "./combobox-live-v24-broker.js";

export interface ComboboxLiveV24LifecycleSimulationReport {
  artifactVersion: "combobox-live-v24-lifecycle-simulation-v1";
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
  GIT_AUTHOR_NAME: "Input v8 Lifecycle Simulation",
  GIT_AUTHOR_EMAIL: "input-v8-simulation@invalid",
  GIT_COMMITTER_NAME: "Input v8 Lifecycle Simulation",
  GIT_COMMITTER_EMAIL: "input-v8-simulation@invalid",
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
  index: ComboboxLiveV24AntecedentIndex,
  indexSha256: string,
  antecedentCommit: string,
  authorizationCommit?: string,
  authorization = undefined as
    ReturnType<typeof buildComboboxLiveV24AuthorizationArtifact> | undefined,
): ComboboxLiveV24HistoryState => ({
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

export async function simulateComboboxLiveV24Lifecycle(): Promise<ComboboxLiveV24LifecycleSimulationReport> {
  await buildComboboxLiveV24Proof(true);
  const indexBefore = readFileSync(COMBOBOX_LIVE_V24_INDEX_PATH);
  const index = JSON.parse(
    indexBefore.toString("utf8"),
  ) as ComboboxLiveV24AntecedentIndex;
  const indexSha256 = comboboxLiveV5Sha256(indexBefore);
  const temporary = mkdtempSync(path.join(os.tmpdir(), "combobox-live-v24-life-"));
  try {
    git(temporary, ["init", "-b", "main"]);
    const syntheticIndexPath = path.join(temporary, COMBOBOX_LIVE_V24_INDEX_PATH);
    mkdirSync(path.dirname(syntheticIndexPath), { recursive: true });
    writeFileSync(syntheticIndexPath, indexBefore);
    git(temporary, ["add", COMBOBOX_LIVE_V24_INDEX_PATH]);
    git(temporary, ["commit", "-m", "synthetic v1 antecedent"]);
    const antecedentCommit = git(temporary, ["rev-parse", "HEAD"]);
    const pending = historyState(index, indexSha256, antecedentCommit);
    const pendingFailures = validateComboboxLiveV24History(pending, "pending");
    if (pendingFailures.length)
      throw new Error(
        `v1 lifecycle pending phase failed:\n${pendingFailures.join("\n")}`,
      );
    const staleAuthorized = validateComboboxLiveV24History(pending, "authorized");
    if (
      !staleAuthorized.some((failure) => failure.includes("stale history mode"))
    )
      throw new Error("v1 lifecycle did not refuse stale authorized mode");

    const { publicKey } = generateKeyPairSync("ed25519");
    const authorization = buildComboboxLiveV24AuthorizationArtifact({
      antecedentCommit,
      antecedentIndexBytes: indexBefore,
      signingPublicKey: publicKey,
    });
    const authorizationBytes = Buffer.from(
      `${JSON.stringify(authorization, null, 2)}\n`,
    );
    const authorizationPath = path.join(
      temporary,
      COMBOBOX_LIVE_V24_AUTHORIZATION_PATH,
    );
    mkdirSync(path.dirname(authorizationPath), { recursive: true });
    writeFileSync(authorizationPath, authorizationBytes);
    git(temporary, ["add", COMBOBOX_LIVE_V24_AUTHORIZATION_PATH]);
    git(temporary, ["commit", "-m", "synthetic v8 authorization"]);
    const authorizationCommit = git(temporary, ["rev-parse", "HEAD"]);

    const committedAntecedentBefore = gitBytes(temporary, [
      "show",
      `${antecedentCommit}:${COMBOBOX_LIVE_V24_INDEX_PATH}`,
    ]);
    const committedAntecedentAfter = gitBytes(temporary, [
      "show",
      `${authorizationCommit}:${COMBOBOX_LIVE_V24_INDEX_PATH}`,
    ]);
    if (!committedAntecedentBefore.equals(committedAntecedentAfter))
      throw new Error(
        "v1 antecedent index changed across authorization commit",
      );
    const authorized = historyState(
      index,
      indexSha256,
      antecedentCommit,
      authorizationCommit,
      authorization,
    );
    const authorizedFailures = validateComboboxLiveV24History(
      authorized,
      "authorized",
    );
    if (authorizedFailures.length)
      throw new Error(
        `v1 lifecycle authorized phase failed:\n${authorizedFailures.join("\n")}`,
      );
    const stalePending = validateComboboxLiveV24History(authorized, "pending");
    if (!stalePending.some((failure) => failure.includes("stale history mode")))
      throw new Error("v1 lifecycle did not refuse stale pending mode");

    await buildComboboxLiveV24Proof(true);
    const indexAfter = readFileSync(COMBOBOX_LIVE_V24_INDEX_PATH);
    if (!indexBefore.equals(indexAfter))
      throw new Error(
        "v1 generated check changed after synthetic authorization",
      );
    const stableHashSet =
      index.hashSetSha256 ===
      (JSON.parse(indexAfter.toString("utf8")) as ComboboxLiveV24AntecedentIndex)
        .hashSetSha256;
    if (!stableHashSet)
      throw new Error("v1 antecedent hash set changed after authorization");
    return {
      artifactVersion: "combobox-live-v24-lifecycle-simulation-v1",
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
      authorizationSha256: comboboxLiveV5Sha256(authorizationBytes),
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await simulateComboboxLiveV24Lifecycle(), null, 2)}\n`,
  );
