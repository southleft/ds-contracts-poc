import { createHash } from "node:crypto";

import { validateButtonResizeProbe } from "./button-usability.js";
import { readRepositoryEvidence, readRepositoryJson } from "./evidence-path.js";
import { validateLivePacketV4 } from "./live-packet-v4.js";
import { canonicalJson } from "./normalize.js";

const RECEIPT_PATH = "recipe/evidence/button-live-pivot-v4/receipt.json";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const hashPath = (path: string): string => sha256(readRepositoryEvidence(path));
export const HISTORICAL_BUTTON_V4_LIMITATIONS = [
  "the uncommitted tree cannot prove chronology or immutable history",
  "the historical readback canonicalized a self-selected projection, not complete scene-derived IR",
  "the historical zero-silent value was assigned, not derived from expected-plan reconciliation",
] as const;

export function validateLiveReceiptV4(receipt: Record<string, any>): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  if (receipt.version !== 4) fail("receipt version must be 4");
  if (receipt.target?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") {
    fail("receipt target is not Scratch");
  }
  if (
    receipt.status?.bridgeReadOnly !== "pass-exact-scratch" ||
    receipt.status?.offlineConformance !== "pass" ||
    receipt.status?.exactByteTransport !== "pass" ||
    receipt.status?.liveWrite !== "pass-artifacts-kept" ||
    receipt.status?.writerAttemptsExecuted !== 2 ||
    receipt.status?.usability !== "pass-both-sources-all-four-assertions" ||
    receipt.status?.labelValidation !== "pass-288-of-288" ||
    receipt.status?.liveReadback !== "pass" ||
    receipt.status?.fixedPoint !== "pass-two-cycles" ||
    receipt.status?.liveAccounting !== "pass-nonzero-denominator" ||
    receipt.status?.pairedScreenshots !==
      "pass-12-live-plus-12-source-references"
  ) {
    fail("live proof status is not complete");
  }
  if (
    receipt.status?.independentCanvasGrade !==
      "pending-ungraded-sealed-packet" ||
    receipt.status?.buttonSuccess !== false ||
    receipt.grading?.buttonSuccess !== false
  ) {
    fail("Button must remain false pending independent grading");
  }
  for (const item of [
    receipt.immutableHistory?.v1Receipt,
    receipt.immutableHistory?.v2Receipt,
    receipt.immutableHistory?.v3Receipt,
    receipt.immutableHistory?.v3Verification,
  ]) {
    if (!item?.path || hashPath(item.path) !== item.sha256) {
      fail(`immutable history mismatch: ${item?.path ?? "missing"}`);
    }
  }
  if (
    !Array.isArray(receipt.attempts) ||
    receipt.attempts.length !== 2 ||
    receipt.attempts[0]?.result !== "failed-source-fixed-then-cleaned" ||
    receipt.attempts[1]?.result !== "writer-executed" ||
    receipt.attempts[1]?.decodedBytes !== receipt.attempts[1]?.writerBytes ||
    receipt.attempts[1]?.decodedSha256 !== receipt.attempts[1]?.writerSha256
  ) {
    fail("writer attempt history is incomplete");
  }
  for (const attempt of receipt.attempts ?? []) {
    for (const [pathKey, hashKey] of [
      ["writerPath", "writerSha256"],
      ["wrapperPath", "wrapperSha256"],
      ["resultPath", "resultSha256"],
    ]) {
      if (
        !attempt[pathKey] ||
        hashPath(attempt[pathKey]) !== attempt[hashKey]
      ) {
        fail(`attempt ${attempt.attempt} ${pathKey} mismatch`);
      }
    }
    for (const [pathKey, hashKey] of [
      ["diagnosticPath", "diagnosticSha256"],
      ["cleanupPath", "cleanupSha256"],
    ]) {
      if (attempt[pathKey] && hashPath(attempt[pathKey]) !== attempt[hashKey]) {
        fail(`attempt ${attempt.attempt} ${pathKey} mismatch`);
      }
    }
  }
  for (const [pathKey, hashKey] of [
    ["planPath", "planSha256"],
    ["transportEnvelopePath", "transportEnvelopeSha256"],
    ["conformancePath", "conformanceSha256"],
  ]) {
    if (hashPath(receipt.writer[pathKey]) !== receipt.writer[hashKey]) {
      fail(`writer ${pathKey} mismatch`);
    }
  }
  const counts = receipt.writer?.counts;
  if (
    counts?.apiCalls !== 17 ||
    counts?.propertyNames !== 83 ||
    counts?.variants !== 288 ||
    counts?.variables !== 57 ||
    counts?.pluginDataWrites !== 7003 ||
    counts?.propertyWrites !== 15695 ||
    counts?.bindings !== 4296
  ) {
    fail("writer cardinality is incomplete");
  }
  const plan = readRepositoryJson<Record<string, any>>(receipt.writer.planPath);
  const envelope = readRepositoryJson<Record<string, any>>(
    receipt.writer.transportEnvelopePath,
  );
  const conformance = readRepositoryJson<Record<string, any>>(
    receipt.writer.conformancePath,
  );
  if (
    plan.target?.fileKey !== receipt.target.fileKey ||
    plan.pageName !== receipt.target.pageName ||
    plan.writer?.sha256 !== receipt.attempts[1]?.writerSha256 ||
    plan.transport?.payloadSha256 !== receipt.attempts[1]?.decodedSha256 ||
    envelope.payloadSha256 !== receipt.attempts[1]?.decodedSha256 ||
    envelope.payloadBytes !== receipt.attempts[1]?.decodedBytes ||
    conformance.ok !== true ||
    JSON.stringify(conformance.counts) !== JSON.stringify(counts)
  ) {
    fail("writer plan, transport, or conformance mismatch");
  }
  const verification = readRepositoryJson<Record<string, any>>(
    receipt.live.verificationPath,
  );
  if (
    hashPath(receipt.live.verificationPath) !== receipt.live.verificationSha256
  ) {
    fail("live verification hash mismatch");
  }
  if (
    hashPath(receipt.live.normalizedReadbackPath) !==
    receipt.live.normalizedReadbackSha256
  ) {
    fail("normalized readback hash mismatch");
  }
  if (
    verification.fileKey !== receipt.target.fileKey ||
    verification.pageId !== receipt.target.pageId ||
    verification.pageName !== receipt.target.pageName ||
    verification.proofSectionId !== receipt.target.proofSectionId ||
    verification.pairedSectionId !== receipt.target.pairedSectionId ||
    verification.mutatedPreExistingNodeIds.length !== 0
  ) {
    fail("live target or mutation census mismatch");
  }
  if (
    verification.sets?.length !== 2 ||
    verification.sets?.reduce(
      (total: number, set: Record<string, any>) => total + set.variants,
      0,
    ) !== 288 ||
    receipt.live.componentSets?.length !== 2 ||
    receipt.live.componentSets?.reduce(
      (total: number, set: Record<string, any>) => total + set.variants,
      0,
    ) !== 288 ||
    receipt.live.componentSets?.reduce(
      (total: number, set: Record<string, any>) => total + set.variables,
      0,
    ) !== 57 ||
    verification.cellRecords?.length !== 12
  ) {
    fail("live set or paired-cell cardinality mismatch");
  }
  if (!Array.isArray(verification.probes) || verification.probes.length !== 2) {
    fail("live proof must contain two source probes");
  } else {
    for (const probe of verification.probes) {
      if (
        validateButtonResizeProbe(probe.resize).length > 0 ||
        !probe.variantSwitching.passed ||
        !probe.tokenBinding.passed ||
        probe.tokenBinding.bindingFacts <= 0 ||
        !probe.noFakeLayout.passed ||
        probe.noFakeLayout.layoutChildren <= 0 ||
        probe.noFakeLayout.layoutChildren !==
          probe.noFakeLayout.nonAbsoluteChildren ||
        !probe.restored ||
        probe.resize.restorationBeforeSha256 !==
          probe.resize.restorationAfterSha256 ||
        sha256(
          JSON.stringify({
            width: probe.resize.before.width,
            label: probe.resize.before.label,
          }),
        ) !== probe.resize.restorationBeforeSha256 ||
        sha256(
          JSON.stringify({
            width: probe.resize.restored.width,
            label: probe.resize.restored.label,
          }),
        ) !== probe.resize.restorationAfterSha256 ||
        probe.labelValidation.denominator !== 144 ||
        probe.labelValidation.passed !== 144
      ) {
        fail(`${probe.adapterIdentity}: usability probe failed`);
      }
    }
  }
  const normalized = readRepositoryJson<Record<string, any>>(
    receipt.live.normalizedReadbackPath,
  );
  const canonicalCycle1 = canonicalJson(normalized);
  const canonicalCycle2 = canonicalJson(JSON.parse(canonicalCycle1));
  if (
    verification.readback.comparedFacts !== 7956 ||
    verification.readback.observedFacts !== 13248 ||
    !verification.readback.twoCompleteCyclesStable ||
    verification.readback.canonicalCycle1Sha256 !==
      verification.readback.canonicalCycle2Sha256 ||
    sha256(canonicalCycle1) !== verification.readback.canonicalCycle1Sha256 ||
    sha256(canonicalCycle2) !== verification.readback.canonicalCycle2Sha256 ||
    verification.zeroSilentAccounting.denominator !== 13248 ||
    verification.zeroSilentAccounting.carried !== 13248 ||
    verification.zeroSilentAccounting.codeOnly !== 0 ||
    verification.zeroSilentAccounting.namedRefused !== 0 ||
    verification.zeroSilentAccounting.silent !== 0
  ) {
    fail("fixed point or zero-silent accounting failed");
  }
  if (
    verification.images?.length !== 14 ||
    verification.images?.filter(
      (image: Record<string, any>) => image.kind === "paired-cell",
    ).length !== 12 ||
    verification.setImages?.length !== 2
  ) {
    fail("screenshot cardinality mismatch");
  }
  for (const image of [...verification.images, ...verification.setImages]) {
    if (image.bytes <= 0 || hashPath(image.path) !== image.sha256) {
      fail(`screenshot mismatch: ${image.path}`);
    }
  }
  const packet = readRepositoryJson<Record<string, any>>(
    receipt.grading.packetPath,
  );
  const key = readRepositoryJson<Record<string, any>>(
    receipt.grading.sealedAnswerKeyPath,
  );
  if (
    hashPath(receipt.grading.packetPath) !== receipt.grading.packetSha256 ||
    hashPath(receipt.grading.sealedAnswerKeyPath) !==
      receipt.grading.sealedAnswerKeySha256
  ) {
    fail("grading packet hashes mismatch");
  }
  failures.push(...validateLivePacketV4(packet, key));
  return failures;
}

export function readAndValidateLiveReceiptV4(): void {
  const receipt = readRepositoryJson<Record<string, any>>(RECEIPT_PATH);
  const failures = validateLiveReceiptV4(receipt);
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `✔ v4 historical bytes are internally consistent; inversion/chronology not re-certified; Button remains false (${hashPath(RECEIPT_PATH)})`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readAndValidateLiveReceiptV4();
}
