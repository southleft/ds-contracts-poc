import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import {
  INPUT_LIVE_V5_EVIDENCE_ROOT,
  INPUT_LIVE_V5_PHASES,
  INPUT_LIVE_V5_PROTOCOL_PATH,
  INPUT_LIVE_V5_PROTOCOL_SHA256,
  INPUT_LIVE_V5_TARGET,
  type InputLiveV5AuthorizationProof,
} from "./input-field-live-v5-authorization.js";

export const INPUT_LIVE_V5_PLAN_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-plan.json`;
export const INPUT_LIVE_V5_REQUIRED_GENERATED_PATHS = [
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer.js`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/transport-envelope.json`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-wrapper.txt`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-plan.json`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/conformance-report.json`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/expected-scene-plan-mui.json.gz`,
  `${INPUT_LIVE_V5_EVIDENCE_ROOT}/expected-scene-plan-polaris.json.gz`,
] as const;

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export function validateInputLiveV5ControlFlowSource(source: string): string[] {
  const failures: string[] = [];
  if (source.includes("refuseDraftExecution"))
    failures.push("unconditional draft refusal is reachable from entrypoint");
  if ((source.match(/bridge\.invoke\s*\(/g) ?? []).length !== 1)
    failures.push("runner must invoke bridge exactly once per attempt");
  for (const reference of [
    "writer-wrapper.txt",
    "transport-envelope.json",
    "writer-plan.json",
  ]) {
    if (!source.includes(reference))
      failures.push(`runner does not reference generated ${reference}`);
  }
  const gate = source.indexOf("assertInputLiveV5PreCaptureGates");
  const capture = source.indexOf("transaction.capture");
  if (gate < 0 || capture < 0 || capture < gate)
    failures.push("capture is reachable before technical gates");
  if (/sourceIr|sourceIR|source_ir/.test(source))
    failures.push("source IR stamp shortcut is forbidden");
  for (const phase of INPUT_LIVE_V5_PHASES)
    if (!source.includes(`"${phase}"`))
      failures.push(`runner omits phase journal ${phase}`);
  return failures;
}

export interface InputLiveV5PreflightReport {
  artifactVersion: "input-live-v5-preflight-v1";
  authorizationMode: "live" | "simulated";
  target: typeof INPUT_LIVE_V5_TARGET;
  attempt: number;
  completedAttempts: number[];
  generatedArtifactCount: number;
  writerBytes: number;
  writerSha256: string;
  wrapperBytes: number;
  wrapperSha256: string;
  plannedSources: number;
  plannedVariants: number;
  plannedSceneFacts: number;
  capture: false;
}

export function runInputLiveV5Preflight(
  root: string,
  proof: InputLiveV5AuthorizationProof,
  attempt: number,
  completedAttempts: readonly number[],
): InputLiveV5PreflightReport {
  const failures: string[] = [];
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > 3 ||
    attempt !== completedAttempts.length + 1 ||
    completedAttempts.some((value, index) => value !== index + 1)
  )
    failures.push("v5 attempt chronology invalid or exceeds maximum 3");
  if (JSON.stringify(proof.target) !== JSON.stringify(INPUT_LIVE_V5_TARGET))
    failures.push("v5 authorization target mismatch");
  const protocol = readFileSync(path.join(root, INPUT_LIVE_V5_PROTOCOL_PATH));
  if (sha256(protocol) !== INPUT_LIVE_V5_PROTOCOL_SHA256)
    failures.push("v5 protocol byte hash drift");
  const planPath = path.join(root, INPUT_LIVE_V5_PLAN_PATH);
  const plan = existsSync(planPath)
    ? (JSON.parse(readFileSync(planPath, "utf8")) as Record<string, any>)
    : {};
  const artifactHashes = plan.artifacts?.sha256 ?? {};
  for (const relativePath of INPUT_LIVE_V5_REQUIRED_GENERATED_PATHS) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      failures.push(`missing generated artifact ${relativePath}`);
      continue;
    }
    const bytes = readFileSync(absolutePath);
    if (bytes.byteLength === 0)
      failures.push(`zero-byte generated artifact ${relativePath}`);
    if (
      relativePath !== INPUT_LIVE_V5_PLAN_PATH &&
      artifactHashes[relativePath] !== sha256(bytes)
    )
      failures.push(`stale generated artifact ${relativePath}`);
  }
  const writerPath = path.join(
    root,
    `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer.js`,
  );
  const wrapperPath = path.join(
    root,
    `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-wrapper.txt`,
  );
  const writer = existsSync(writerPath)
    ? readFileSync(writerPath)
    : Buffer.alloc(0);
  const wrapper = existsSync(wrapperPath)
    ? readFileSync(wrapperPath)
    : Buffer.alloc(0);
  if (
    plan.writer?.bytes !== writer.byteLength ||
    plan.writer?.sha256 !== sha256(writer)
  )
    failures.push("writer plan bytes/hash mismatch");
  if (
    plan.transport?.wrapperBytes !== wrapper.byteLength ||
    plan.transport?.wrapperSha256 !== sha256(wrapper)
  )
    failures.push("transport wrapper bytes/hash mismatch");
  const envelopePath = path.join(
    root,
    `${INPUT_LIVE_V5_EVIDENCE_ROOT}/transport-envelope.json`,
  );
  const envelope = existsSync(envelopePath)
    ? JSON.parse(readFileSync(envelopePath, "utf8"))
    : {};
  if (
    envelope.payloadBytes !== writer.byteLength ||
    envelope.payloadSha256 !== sha256(writer)
  )
    failures.push("transport envelope does not bind exact writer bytes");
  let plannedSceneFacts = 0;
  for (const source of plan.sources ?? []) {
    try {
      const artifact = source.expectedScenePlanArtifact;
      const compressed = readFileSync(path.join(root, artifact.path));
      const uncompressed = gunzipSync(compressed);
      const scenePlan = JSON.parse(uncompressed.toString("utf8"));
      if (
        compressed.byteLength !== artifact.bytes ||
        sha256(compressed) !== artifact.sha256 ||
        uncompressed.byteLength !== artifact.uncompressedBytes ||
        sha256(uncompressed) !== artifact.uncompressedSha256 ||
        scenePlan.facts.length !== artifact.facts ||
        artifact.facts <= 0
      )
        failures.push(`stale expected scene plan ${artifact.path}`);
      plannedSceneFacts += artifact.facts;
    } catch {
      failures.push(
        `missing or invalid expected scene plan for ${source.library}`,
      );
    }
  }
  const runnerSource = readFileSync(
    path.join(root, "recipe/run-input-field-live-v5.ts"),
    "utf8",
  );
  failures.push(...validateInputLiveV5ControlFlowSource(runnerSource));
  const variants = (plan.sources ?? []).reduce(
    (sum: number, source: Record<string, number>) =>
      sum + Number(source.plannedVariants ?? 0),
    0,
  );
  if (
    plan.artifactVersion !== "input-live-v5-writer-plan-v1" ||
    plan.sources?.length !== 2 ||
    variants !== 256 ||
    plannedSceneFacts <= 0 ||
    plan.conformance?.ok !== true
  )
    failures.push("v5 writer plan/conformance has incomplete counts");
  if (failures.length)
    throw new Error(`Input live v5 preflight refused:\n${failures.join("\n")}`);
  return {
    artifactVersion: "input-live-v5-preflight-v1",
    authorizationMode: proof.mode,
    target: INPUT_LIVE_V5_TARGET,
    attempt,
    completedAttempts: [...completedAttempts],
    generatedArtifactCount: INPUT_LIVE_V5_REQUIRED_GENERATED_PATHS.length,
    writerBytes: writer.byteLength,
    writerSha256: sha256(writer),
    wrapperBytes: wrapper.byteLength,
    wrapperSha256: sha256(wrapper),
    plannedSources: 2,
    plannedVariants: variants,
    plannedSceneFacts,
    capture: false,
  };
}
