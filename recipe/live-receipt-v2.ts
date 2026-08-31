import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type Json = Record<string, any>;

const RECEIPT_PATH = "recipe/evidence/button-live-pivot-v2/receipt.json";
const hash = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export function validateLiveButtonReceiptV2(receipt: Json): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  if (receipt.version !== 2) fail("version must be 2");
  if (receipt.target?.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") {
    fail("target must be Scratch Project only");
  }
  if (
    receipt.target?.fileName !== "Scratch Project" ||
    receipt.target?.editorType !== "figma"
  ) {
    fail("target name/editor must be Scratch Project/Figma");
  }
  if (
    receipt.status?.offlineConformance !== "pass" ||
    receipt.artifacts?.conformance?.plannedVariants !== 288
  ) {
    fail("offline conformance must cover all 288 variants");
  }
  for (const field of [
    "apiCalls",
    "propertyNames",
    "variables",
    "pluginDataWrites",
    "propertyWrites",
    "bindings",
  ]) {
    if ((receipt.artifacts?.conformance?.[field] ?? 0) <= 0) {
      fail(`conformance ${field} count must be nonzero`);
    }
  }
  const artifacts = [
    receipt.immutableV1?.receiptPath
      ? [
          receipt.immutableV1.receiptPath,
          receipt.immutableV1.receiptSha256,
          "v1 receipt",
        ]
      : null,
    receipt.immutableV1?.planPath
      ? [
          receipt.immutableV1.planPath,
          receipt.immutableV1.planSha256,
          "v1 plan",
        ]
      : null,
    receipt.immutableV1?.writerPath
      ? [
          receipt.immutableV1.writerPath,
          receipt.immutableV1.writerSha256,
          "v1 writer",
        ]
      : null,
    [receipt.artifacts?.plan?.path, receipt.artifacts?.plan?.sha256, "v2 plan"],
    [
      receipt.artifacts?.writer?.path,
      receipt.artifacts?.writer?.sha256,
      "v2 writer",
    ],
    [
      receipt.artifacts?.transport?.path,
      receipt.artifacts?.transport?.sha256,
      "v2 transport",
    ],
    [
      receipt.artifacts?.transport?.chunksPath,
      receipt.artifacts?.transport?.chunksSha256,
      "v2 transport chunks",
    ],
    [
      receipt.artifacts?.conformance?.path,
      receipt.artifacts?.conformance?.sha256,
      "v2 conformance",
    ],
  ].filter(Boolean) as string[][];
  for (const [path, expected, label] of artifacts) {
    try {
      if (hash(path!) !== expected) fail(`${label} bytes changed`);
    } catch {
      fail(`${label} artifact is absent`);
    }
  }
  if (
    receipt.artifacts?.writer?.deterministicRegeneration !== "pass" ||
    receipt.artifacts?.writer?.executed !== false
  ) {
    fail("v2 writer must be deterministic and explicitly unexecuted");
  }
  const before = receipt.before;
  const after = receipt.after;
  for (const field of [
    "pageCount",
    "totalTopLevelNodes",
    "proofPageMatches",
    "collectionCount",
    "totalLocalVariables",
    "matchingCollections",
  ]) {
    if (before?.[field] !== after?.[field]) {
      fail(`before/after ${field} changed`);
    }
  }
  if (
    receipt.status?.writerAttemptsExecuted !== 0 ||
    receipt.liveProof?.pages?.length !== 0 ||
    receipt.liveProof?.componentSets?.length !== 0 ||
    receipt.liveProof?.variables?.length !== 0
  ) {
    fail("pre-execution block cannot claim live artifacts or writer attempts");
  }
  if (
    receipt.liveProof?.normalizedIrFacts !== 0 ||
    receipt.liveProof?.canonicalCycles !== 0 ||
    receipt.liveProof?.silentAccountingDenominator !== 0 ||
    receipt.liveProof?.twoCycleStable !== false
  ) {
    fail("zero-denominator live proof must remain a hard failure");
  }
  if (
    receipt.status?.buttonSuccess !== false ||
    receipt.status?.independentCanvasGrade !== "pending"
  ) {
    fail("Button success and independent grade are forged");
  }
  return failures;
}

export function selfTestLiveButtonReceiptV2(receipt: Json): string[] {
  const failures: string[] = [];
  for (const [name, mutate, expected] of [
    [
      "wrong file",
      (copy: Json) => {
        copy.target.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV";
      },
      /Scratch Project only/,
    ],
    [
      "forged execution",
      (copy: Json) => {
        copy.artifacts.writer.executed = true;
      },
      /explicitly unexecuted/,
    ],
    [
      "forged artifact",
      (copy: Json) => {
        copy.liveProof.componentSets = ["1:2"];
      },
      /cannot claim live artifacts/,
    ],
    [
      "changed after state",
      (copy: Json) => {
        copy.after.totalTopLevelNodes += 1;
      },
      /before\/after totalTopLevelNodes changed/,
    ],
    [
      "forged success",
      (copy: Json) => {
        copy.status.buttonSuccess = true;
      },
      /forged/,
    ],
  ] as const) {
    const copy = structuredClone(receipt);
    mutate(copy);
    if (!expected.test(validateLiveButtonReceiptV2(copy).join("\n"))) {
      failures.push(`${name} did not go red`);
    }
  }
  return failures;
}

if (process.argv[1]?.endsWith("live-receipt-v2.ts")) {
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, "utf8")) as Json;
  const failures = process.argv.includes("--self-test")
    ? selfTestLiveButtonReceiptV2(receipt)
    : validateLiveButtonReceiptV2(receipt);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(
    process.argv.includes("--self-test")
      ? "✔ v2 live receipt self-test"
      : "✔ v2 live receipt is fail-closed and tamper-evident",
  );
}
