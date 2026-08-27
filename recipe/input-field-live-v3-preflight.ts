import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  INPUT_LIVE_V3_ANTECEDENT_COMMIT,
  INPUT_LIVE_V3_AUTHORIZATION_PATH,
  INPUT_LIVE_V3_FIGMA_FILE_KEY,
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_PROTOCOL_SHA256,
} from "./input-field-live-v3-authorization.js";
import { INPUT_LIVE_V3_REQUIRED_GATE_IDS } from "./input-field-live-v3-verifier.js";

export const INPUT_LIVE_V3_PREFLIGHT_VERSION = "input-live-v3-preflight-v1";
export const INPUT_LIVE_V3_ROOT = "recipe/evidence/input-field-live-pivot-v3";
export const INPUT_LIVE_V3_PLAN_PATH = `${INPUT_LIVE_V3_ROOT}/writer-plan.json`;

export interface InputLiveV3PreflightState {
  clean: boolean;
  codeCommit: string;
  authorizationCommit?: string;
  authorizationIsAncestor: boolean;
  antecedentIsAncestor: boolean;
  protocolSha256: string;
  expectedProtocolSha256: string;
  authorizationSha256: string;
  firstAuthorizationSha256: string;
  target: {
    fileKey: string;
    fileName: string;
    editorType: string;
  };
  bridge: {
    connectedExactTargetCount: number;
    requestedFileKey: string;
  };
  requiredGateIds: string[];
  plan: {
    sourceCount: number;
    plannedVariants: number[];
    plannedVariables: number[];
    plannedSceneFacts: number[];
    expectedScenePlansValid: boolean[];
    writerBytes: number;
    writerSha256: string;
    actualWriterBytes: number;
    actualWriterSha256: string;
    transportPayloadBytes: number;
    transportPayloadSha256: string;
    wrapperBytes: number;
    wrapperSha256: string;
    actualWrapperBytes: number;
    actualWrapperSha256: string;
  };
  resultFields: string[];
}

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const git = (root: string, args: readonly string[]): Buffer =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "buffer",
    stdio: ["ignore", "pipe", "pipe"],
  });

const gitText = (root: string, args: readonly string[]): string =>
  git(root, args).toString("utf8").trim();

const isAncestor = (
  root: string,
  ancestor: string | undefined,
  descendant: string,
): boolean => {
  if (!ancestor) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const resultFields = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      resultFields(item, `${prefix}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const field = prefix ? `${prefix}.${key}` : key;
    return [
      ...(/^(result|results|observed|outcome|measurements?|metrics?|score)$/i.test(
        key,
      )
        ? [field]
        : []),
      ...resultFields(child, field),
    ];
  });
};

export function validateInputLiveV3Preflight(
  state: InputLiveV3PreflightState,
): string[] {
  const failures: string[] = [];
  if (!state.clean) failures.push("dirty tree");
  if (!state.authorizationCommit || !state.authorizationIsAncestor)
    failures.push("code commit is not a clean descendant of authorization");
  if (!state.antecedentIsAncestor)
    failures.push("code commit does not descend from antecedent");
  if (
    state.protocolSha256 !== state.expectedProtocolSha256 ||
    state.protocolSha256 !== INPUT_LIVE_V3_PROTOCOL_SHA256
  )
    failures.push("protocol byte drift");
  if (
    state.authorizationSha256 !== state.firstAuthorizationSha256 ||
    !/^[a-f0-9]{64}$/.test(state.authorizationSha256)
  )
    failures.push("authorization byte drift");
  if (
    state.target.fileKey !== INPUT_LIVE_V3_FIGMA_FILE_KEY ||
    state.target.fileName !== "Scratch Project" ||
    state.target.editorType !== "figma"
  )
    failures.push("wrong Figma target");
  if (
    state.bridge.connectedExactTargetCount !== 1 ||
    state.bridge.requestedFileKey !== INPUT_LIVE_V3_FIGMA_FILE_KEY
  )
    failures.push("bridge mismatch");
  if (
    INPUT_LIVE_V3_REQUIRED_GATE_IDS.some(
      (id) => !state.requiredGateIds.includes(id),
    ) ||
    new Set(state.requiredGateIds).size !== state.requiredGateIds.length
  )
    failures.push("missing required gates");
  if (
    state.plan.sourceCount !== 2 ||
    state.plan.plannedVariants.length !== 2 ||
    state.plan.plannedVariants.some((count) => count !== 128) ||
    state.plan.plannedVariables.length !== 2 ||
    state.plan.plannedVariables.some((count) => count <= 0) ||
    state.plan.plannedSceneFacts.length !== 2 ||
    state.plan.plannedSceneFacts.some((count) => count <= 0) ||
    state.plan.expectedScenePlansValid.length !== 2 ||
    state.plan.expectedScenePlansValid.some((valid) => !valid)
  )
    failures.push("zero or incomplete planned counts");
  if (
    state.plan.writerBytes <= 0 ||
    state.plan.writerBytes !== state.plan.actualWriterBytes ||
    state.plan.writerSha256 !== state.plan.actualWriterSha256
  )
    failures.push("writer bytes/hash mismatch");
  if (
    state.plan.transportPayloadBytes !== state.plan.writerBytes ||
    state.plan.transportPayloadSha256 !== state.plan.writerSha256
  )
    failures.push("transport payload mismatch");
  if (
    state.plan.wrapperBytes <= 0 ||
    state.plan.wrapperBytes !== state.plan.actualWrapperBytes ||
    state.plan.wrapperSha256 !== state.plan.actualWrapperSha256
  )
    failures.push("transport wrapper mismatch");
  if (state.resultFields.length > 0)
    failures.push(
      `result fields present before execution: ${state.resultFields.join(",")}`,
    );
  return failures;
}

const argumentValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};

export function readInputLiveV3PreflightState(
  root: string,
  options: {
    bridgeExactTargetCount: number;
    requestedFileKey: string;
  },
): InputLiveV3PreflightState {
  const plan = JSON.parse(
    readFileSync(path.join(root, INPUT_LIVE_V3_PLAN_PATH), "utf8"),
  ) as Record<string, any>;
  const codeCommit = gitText(root, ["rev-parse", "HEAD"]);
  const adding = gitText(root, [
    "log",
    "--reverse",
    "--diff-filter=A",
    "--format=%H",
    codeCommit,
    "--",
    INPUT_LIVE_V3_AUTHORIZATION_PATH,
  ]);
  const authorizationCommit = adding.split("\n").filter(Boolean)[0];
  const authorizationBytes = readFileSync(
    path.join(root, INPUT_LIVE_V3_AUTHORIZATION_PATH),
  );
  const firstAuthorizationBytes = authorizationCommit
    ? git(root, [
        "show",
        `${authorizationCommit}:${INPUT_LIVE_V3_AUTHORIZATION_PATH}`,
      ])
    : Buffer.alloc(0);
  const protocolBytes = readFileSync(
    path.join(root, INPUT_LIVE_V3_PROTOCOL_PATH),
  );
  const writerBytes = readFileSync(path.join(root, plan.writer.path));
  const wrapperBytes = readFileSync(
    path.join(root, plan.transport.wrapperPath),
  );
  const expectedScenePlansValid = plan.sources.map(
    (source: Record<string, any>) => {
      try {
        const artifact = source.expectedScenePlanArtifact;
        const compressed = readFileSync(path.join(root, artifact.path));
        const uncompressed = gunzipSync(compressed);
        const parsed = JSON.parse(uncompressed.toString("utf8"));
        return (
          compressed.byteLength === artifact.bytes &&
          sha256(compressed) === artifact.sha256 &&
          uncompressed.byteLength === artifact.uncompressedBytes &&
          sha256(uncompressed) === artifact.uncompressedSha256 &&
          parsed.facts?.length === artifact.facts &&
          artifact.facts === source.plannedSceneFacts
        );
      } catch {
        return false;
      }
    },
  );
  return {
    clean:
      gitText(root, ["status", "--porcelain", "--untracked-files=all"]) === "",
    codeCommit,
    authorizationCommit,
    authorizationIsAncestor: isAncestor(root, authorizationCommit, codeCommit),
    antecedentIsAncestor: isAncestor(
      root,
      INPUT_LIVE_V3_ANTECEDENT_COMMIT,
      codeCommit,
    ),
    protocolSha256: sha256(protocolBytes),
    expectedProtocolSha256: plan.locked.protocolSha256,
    authorizationSha256: sha256(authorizationBytes),
    firstAuthorizationSha256: sha256(firstAuthorizationBytes),
    target: plan.target,
    bridge: {
      connectedExactTargetCount: options.bridgeExactTargetCount,
      requestedFileKey: options.requestedFileKey,
    },
    requiredGateIds: plan.requiredGateIds,
    plan: {
      sourceCount: plan.sources.length,
      plannedVariants: plan.sources.map(
        (source: Record<string, number>) => source.plannedVariants,
      ),
      plannedVariables: plan.sources.map(
        (source: Record<string, number>) => source.plannedVariables,
      ),
      plannedSceneFacts: plan.sources.map(
        (source: Record<string, number>) => source.plannedSceneFacts,
      ),
      expectedScenePlansValid,
      writerBytes: plan.writer.bytes,
      writerSha256: plan.writer.sha256,
      actualWriterBytes: writerBytes.byteLength,
      actualWriterSha256: sha256(writerBytes),
      transportPayloadBytes: plan.transport.payloadBytes,
      transportPayloadSha256: plan.transport.payloadSha256,
      wrapperBytes: plan.transport.wrapperBytes,
      wrapperSha256: plan.transport.wrapperSha256,
      actualWrapperBytes: wrapperBytes.byteLength,
      actualWrapperSha256: sha256(wrapperBytes),
    },
    resultFields: resultFields(plan),
  };
}

export function runInputLiveV3OfflinePreflight(): void {
  const root = gitText(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const fileKey =
    argumentValue("--file-key") ?? process.env.RECIPE_FIGMA_FILE_KEY ?? "";
  const bridgeCount = Number(argumentValue("--bridge-exact-count") ?? "1");
  const state = readInputLiveV3PreflightState(root, {
    bridgeExactTargetCount: bridgeCount,
    requestedFileKey: fileKey,
  });
  const failures = validateInputLiveV3Preflight(state);
  if (failures.length > 0)
    throw new Error(`Input live v3 preflight refused:\n${failures.join("\n")}`);
  process.stdout.write(
    `Input live v3 preflight passed: codeCommit=${state.codeCommit} authorization=${state.authorizationCommit} target=${fileKey} planned=128+128\n`,
  );
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  runInputLiveV3OfflinePreflight();
