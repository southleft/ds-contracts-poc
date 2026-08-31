import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const ROOT = "recipe/evidence/input-field-live-pivot-v1";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const hashPath = (path: string): string => sha256(readFileSync(path));

export function validateInputFieldLiveReceiptV1(
  receipt: Record<string, any>,
): string[] {
  const failures: string[] = [];
  const fail = (message: string) => failures.push(message);
  if (receipt.version !== 1) fail("version");
  if (
    receipt.target?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh" ||
    receipt.target?.fileName !== "Scratch Project"
  )
    fail("wrong target");
  if (
    receipt.status?.overallInputSuccess !== false ||
    receipt.status?.liveMint !== "failed-proof-cleaned" ||
    receipt.status?.humanRecognisability !==
      "pending-not-requested-not-ai-graded"
  )
    fail("fail-closed status");
  if (receipt.attempts?.length !== 3) fail("attempt cap");
  for (const attempt of receipt.attempts ?? []) {
    for (const artifact of [
      attempt.writer,
      attempt.wrapper,
      attempt.bridgeResult,
      attempt.cleanup,
    ]) {
      if (!artifact?.path || hashPath(artifact.path) !== artifact.sha256)
        fail(`artifact hash ${artifact?.path}`);
    }
    if (!attempt.cleanup?.complete) fail(`cleanup ${attempt.attempt}`);
  }
  const facts = receipt.finalLiveMeasurements?.zeroSilentAccounting;
  if (
    facts?.denominator <= 0 ||
    facts?.carried !== facts.denominator ||
    facts?.codeOnly !== 0 ||
    facts?.refused !== 0 ||
    facts?.silent !== 0
  )
    fail("zero-silent accounting");
  const objective = receipt.finalLiveMeasurements?.objective;
  if (
    objective?.denominator !== 128 ||
    objective?.geometry?.liveWins !== 112 ||
    objective?.geometry?.legacyWins !== 16 ||
    objective?.pixelInk?.liveWins !== 85 ||
    objective?.pixelInk?.legacyWins !== 43
  )
    fail("objective canvas result");
  if (
    receipt.finalLiveMeasurements?.sets?.length !== 2 ||
    receipt.finalLiveMeasurements.sets.reduce(
      (sum: number, set: Record<string, any>) => sum + set.variants,
      0,
    ) !== 256
  )
    fail("set cardinality");
  if (
    receipt.tamperGates?.sourceReferencesUnchanged !== true ||
    receipt.tamperGates?.liveCapturesPresent !== true ||
    receipt.tamperGates?.allInputArtifactsCleaned !== true ||
    receipt.tamperGates?.overallInputRemainsFalse !== true
  )
    fail("tamper gates");
  for (const artifact of [
    receipt.plan,
    receipt.conformance,
    receipt.transportEnvelope,
    receipt.finalLiveMeasurements?.verification,
    receipt.finalLiveMeasurements?.normalizedReadback,
    receipt.finalLiveMeasurements?.objectiveCanvas,
    receipt.humanPacket,
  ]) {
    if (!artifact?.path || hashPath(artifact.path) !== artifact.sha256)
      fail(`evidence hash ${artifact?.path}`);
  }
  return failures;
}

export function readAndValidateInputFieldLiveReceiptV1(): void {
  const receipt = JSON.parse(readFileSync(`${ROOT}/receipt.json`, "utf8"));
  const failures = validateInputFieldLiveReceiptV1(receipt);
  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(
    `✔ Input live v1 failure is complete, cleaned, and tamper-evident; Input remains false (${hashPath(`${ROOT}/receipt.json`)})`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readAndValidateInputFieldLiveReceiptV1();
}
