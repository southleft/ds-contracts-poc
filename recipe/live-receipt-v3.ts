import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type Json = Record<string, any>;
const RECEIPT_PATH = "recipe/evidence/button-live-pivot-v3/receipt.json";
const hash = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export function validateLiveButtonReceiptV3(receipt: Json): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  if (receipt.version !== 3) fail("version must be 3");
  if (
    receipt.target?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh" ||
    receipt.target?.fileName !== "Scratch Project" ||
    receipt.target?.editorType !== "figma"
  ) {
    fail("target must be Scratch Project only");
  }
  for (const immutable of ["immutableV1", "immutableV2"]) {
    for (const artifact of ["receipt", "plan", "writer"]) {
      const path = receipt[immutable]?.[`${artifact}Path`];
      const expected = receipt[immutable]?.[`${artifact}Sha256`];
      try {
        if (!path || hash(path) !== expected) {
          fail(`${immutable} ${artifact} bytes changed`);
        }
      } catch {
        fail(`${immutable} ${artifact} artifact is absent`);
      }
    }
  }
  for (const [name, artifact] of Object.entries(
    receipt.artifacts ?? {},
  ) as [string, Json][]) {
    try {
      if (!artifact.path || hash(artifact.path) !== artifact.sha256) {
        fail(`v3 ${name} bytes changed`);
      }
    } catch {
      fail(`v3 ${name} artifact is absent`);
    }
  }
  for (const attempt of receipt.attempts ?? []) {
    try {
      if (hash(attempt.artifactPath) !== attempt.artifactSha256) {
        fail(`attempt ${attempt.attempt} bytes changed`);
      }
    } catch {
      fail(`attempt ${attempt.attempt} artifact is absent`);
    }
  }
  for (const screenshot of receipt.transientLiveProof?.screenshots ?? []) {
    try {
      if (
        hash(screenshot.path) !== screenshot.sha256 ||
        readFileSync(screenshot.path).byteLength !== screenshot.bytes
      ) {
        fail("screenshot bytes changed");
      }
    } catch {
      fail("screenshot artifact is absent");
    }
  }
  const transport = receipt.transportDiagnosis;
  if (
    transport?.protocol !== "ds-contracts/figma-writer-utf8-base64/v1" ||
    transport?.payloadBytes <= 0 ||
    transport?.payloadBytes !== transport?.decodedBytes ||
    transport?.payloadSha256 !== transport?.decodedSha256 ||
    transport?.evalBegan !== true ||
    transport?.evalCompleted !== true
  ) {
    fail("exact-byte transport proof is invalid");
  }
  if (
    receipt.status?.writerAttemptsExecuted !== 2 ||
    receipt.attempts?.length !== 2 ||
    receipt.attempts?.[0]?.evalBegan !== false ||
    receipt.attempts?.[1]?.evalCompleted !== true
  ) {
    fail("v3 attempt budget or eval evidence is invalid");
  }
  for (const field of [
    "pageCount",
    "totalTopLevelNodes",
    "proofPageMatches",
    "collectionCount",
    "totalLocalVariables",
    "matchingCollections",
  ]) {
    if (receipt.before?.[field] !== receipt.after?.[field]) {
      fail(`before/after ${field} changed`);
    }
  }
  if (
    receipt.cleanup?.censusRestored !== true ||
    receipt.cleanup?.preExistingPagesOrNodesRemoved !== 0
  ) {
    fail("cleanup did not preserve the pre-existing census");
  }
  const proof = receipt.transientLiveProof;
  if (
    proof?.componentSets?.length !== 2 ||
    proof.componentSets.reduce(
      (sum: number, set: Json) => sum + set.variants,
      0,
    ) !== 288 ||
    proof.componentSets.reduce(
      (sum: number, set: Json) => sum + set.variables,
      0,
    ) !== 57
  ) {
    fail("live set, variant, or variable counts are invalid");
  }
  for (const probe of [
    "reflow",
    "variantSwitching",
    "tokenBinding",
    "noFakeLayout",
    "restored",
  ]) {
    if ((proof?.probes?.[probe]?.denominator ?? 0) <= 0) {
      fail(`${probe} denominator must be nonzero`);
    }
  }
  if (
    proof?.probes?.reflow?.passed !== 1 ||
    !proof?.probes?.reflow?.failedAdapter ||
    receipt.status?.usability !== "fail-fluent-reflow"
  ) {
    fail("Fluent reflow failure evidence was erased");
  }
  if (
    proof?.readback?.plannedComparedFacts !== 7956 ||
    proof?.readback?.observedFacts <= 0 ||
    proof?.readback?.canonicalCycles !== 2 ||
    proof?.readback?.twoCycleStable !== true ||
    proof?.readback?.canonicalCycle1Sha256 !==
      proof?.readback?.canonicalCycle2Sha256
  ) {
    fail("live readback or fixed-point evidence is invalid");
  }
  const accounting = proof?.zeroSilentAccounting;
  if (
    accounting?.denominator <= 0 ||
    accounting?.denominator !==
      accounting?.carried + accounting?.codeOnly + accounting?.namedRefused ||
    accounting?.silent !== 0
  ) {
    fail("zero-silent accounting is invalid");
  }
  if (
    receipt.status?.buttonSuccess !== false ||
    receipt.failure?.buttonSuccess !== false ||
    receipt.status?.independentCanvasGrade !==
      "not-requested-after-proof-failure"
  ) {
    fail("failed proof cannot claim Button success or a canvas grade");
  }
  return failures;
}

export function selfTestLiveButtonReceiptV3(receipt: Json): string[] {
  const failures: string[] = [];
  for (const [name, mutate, expected] of [
    [
      "wrong target",
      (copy: Json) => (copy.target.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV"),
      /Scratch Project only/,
    ],
    [
      "wrong decoded hash",
      (copy: Json) => (copy.transportDiagnosis.decodedSha256 = "0".repeat(64)),
      /exact-byte transport/,
    ],
    [
      "forged reflow",
      (copy: Json) => (copy.transientLiveProof.probes.reflow.passed = 2),
      /reflow failure evidence/,
    ],
    [
      "zero denominator",
      (copy: Json) =>
        (copy.transientLiveProof.zeroSilentAccounting.denominator = 0),
      /zero-silent/,
    ],
    [
      "changed cleanup",
      (copy: Json) => (copy.after.totalTopLevelNodes += 1),
      /before\/after totalTopLevelNodes/,
    ],
    [
      "forged success",
      (copy: Json) => (copy.status.buttonSuccess = true),
      /cannot claim Button success/,
    ],
  ] as const) {
    const copy = structuredClone(receipt);
    mutate(copy);
    if (!expected.test(validateLiveButtonReceiptV3(copy).join("\n"))) {
      failures.push(`${name} did not go red`);
    }
  }
  return failures;
}

if (process.argv[1]?.endsWith("live-receipt-v3.ts")) {
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8")) as Json;
  const failures = process.argv.includes("--self-test")
    ? selfTestLiveButtonReceiptV3(receipt)
    : validateLiveButtonReceiptV3(receipt);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(
    process.argv.includes("--self-test")
      ? "✔ v3 live receipt self-test"
      : "✔ v3 live receipt is fail-closed and tamper-evident",
  );
}
