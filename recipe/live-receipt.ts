import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const RECEIPT_PATH = "recipe/evidence/button-live-pivot/receipt.json";
const SCRATCH_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const SCRATCH_FILE_NAME = "Scratch Project";

type Json = Record<string, any>;

const readJson = (path: string): Json =>
  JSON.parse(readFileSync(path, "utf8")) as Json;
const sha256File = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

export function validateLiveButtonReceipt(
  receipt: Json,
  readArtifact: (path: string) => Buffer = (path) => readFileSync(path),
  readJsonArtifact: (path: string) => Json = readJson,
): string[] {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };

  if (receipt.version !== 1) fail("version must be 1");
  if (receipt.kind !== "button-recipe-live-figma-proof") {
    fail("kind must be button-recipe-live-figma-proof");
  }
  if (receipt.target?.fileKey !== SCRATCH_FILE_KEY) {
    fail("target.fileKey must be the Scratch Project file key");
  }
  if (receipt.target?.fileName !== SCRATCH_FILE_NAME) {
    fail("target.fileName must be Scratch Project");
  }
  if (receipt.target?.pageExistedBefore !== false) {
    fail("pre-write page state must prove the proof page was absent");
  }
  if (
    receipt.target?.pageExistsAfterCleanup !== false ||
    receipt.target?.matchingVariableCollectionsAfterCleanup !== 0
  ) {
    fail("failed live run must leave no proof page or matching collections");
  }

  const writerPath = receipt.provenance?.finalOfflineWriter;
  const planPath = receipt.provenance?.writerPlan;
  for (const [label, path, expected] of [
    ["writer", writerPath, receipt.provenance?.finalOfflineWriterSha256],
    ["writer plan", planPath, receipt.provenance?.writerPlanSha256],
  ] as const) {
    if (typeof path !== "string") {
      fail(`${label} path is absent`);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = readArtifact(path);
    } catch {
      fail(`${label} artifact is absent at ${path}`);
      continue;
    }
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) fail(`${label} bytes changed: ${actual}`);
  }
  if (receipt.provenance?.finalOfflineWriterExecuted !== false) {
    fail(
      "the post-blocker corrected writer must not be represented as executed",
    );
  }

  const attempts = receipt.attempts;
  if (!Array.isArray(attempts) || attempts.length !== 3) {
    fail("attempt log must contain exactly the capped three attempts");
  } else {
    attempts.forEach((attempt: Json, index: number) => {
      if (attempt.attempt !== index + 1 || attempt.result !== "failed") {
        fail(`attempt ${index + 1} must be ordered and failed`);
      }
      if (
        typeof attempt.generatedWriterSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(attempt.generatedWriterSha256)
      ) {
        fail(`attempt ${index + 1} generated writer hash is invalid`);
      }
      if (!attempt.cleanup || Object.keys(attempt.cleanup).length === 0) {
        fail(`attempt ${index + 1} cleanup evidence is absent`);
      }
    });
  }

  if (receipt.status?.buttonSuccess !== false) {
    fail("Button success must remain false before independent canvas grading");
  }
  if (
    receipt.status?.independentCanvasGrade !== "pending" ||
    receipt.blindPacket?.recognisabilityVerdictsAuthoredByBuilder !== false
  ) {
    fail("blind grading must remain pending and builder-ungraded");
  }
  if (
    receipt.blindPacket?.packetPath !== null ||
    receipt.blindPacket?.canvasPath !== null
  ) {
    fail("a blocked live run must not claim a blind packet or canvas");
  }

  const sources = receipt.sources;
  let plannedFacts = 0;
  if (!Array.isArray(sources) || sources.length !== 2) {
    fail("receipt must name exactly the two unrelated source adapters");
  } else {
    const adapters = new Set<string>();
    for (const source of sources) {
      adapters.add(source.adapterIdentity);
      plannedFacts += source.plannedPrimitiveIrFacts ?? 0;
      if (source.declaredVariants !== 144 || source.plannedVariants !== 144) {
        fail(`${source.adapterIdentity}: full 144-cell plan is required`);
      }
      if (source.mintedVariants !== 0 || source.liveComparedFacts !== 0) {
        fail(`${source.adapterIdentity}: blocked run cannot claim live output`);
      }
    }
    if (adapters.size !== 2) fail("source adapter identities must be distinct");
  }
  if (plannedFacts <= 0) fail("planned primitive-IR fact denominator is zero");

  const usability = receipt.usability;
  for (const assertion of [
    "reflow",
    "variantSwitching",
    "tokenBinding",
    "noFakeLayout",
  ]) {
    const row = usability?.[assertion];
    if (
      row?.denominator !== 0 ||
      row?.passed !== 0 ||
      row?.verdict !== "hard-fail"
    ) {
      fail(`${assertion}: zero live denominator must be a hard failure`);
    }
  }
  if (
    receipt.readback?.comparedFacts !== 0 ||
    receipt.readback?.twoCompleteCyclesStable !== false ||
    receipt.readback?.verdict !== "hard-fail"
  ) {
    fail("zero-fact live readback must hard-fail the two-cycle fixed point");
  }
  const exclusions = receipt.readback?.exclusions;
  if (
    JSON.stringify(exclusions) !==
    JSON.stringify(["node IDs", "page placement"])
  ) {
    fail("readback exclusions must be exactly node IDs and page placement");
  }

  const offline = receipt.accounting?.offlineSourceAndCompiledIr;
  if (!offline || Object.keys(offline).length !== 2) {
    fail("offline accounting must contain both source adapters");
  } else {
    for (const [adapter, report] of Object.entries<Json>(offline)) {
      const total =
        (report.carried ?? 0) +
        (report.codeOnly ?? 0) +
        (report.namedRefused ?? 0);
      if (
        report.factsCompared <= 0 ||
        report.measuredLandings !== report.factsCompared ||
        total !== report.factsCompared ||
        report.failures?.length !== 0
      ) {
        fail(`${adapter}: offline zero-silent accounting does not reconcile`);
      }
    }
  }
  if (
    receipt.accounting?.liveReadback?.factsCompared !== 0 ||
    receipt.accounting?.liveReadback?.verdict !== "hard-fail-zero-denominator"
  ) {
    fail("live accounting must hard-fail its zero denominator");
  }

  const sourceReceiptPath = receipt.blindPacket?.originalSourceReceipt;
  try {
    const sourceReceipt = readJsonArtifact(sourceReceiptPath);
    const expectedKeys = sourceReceipt.matrix.cells.map(
      (cell: { key: string }) => cell.key,
    );
    if (
      JSON.stringify(receipt.blindPacket?.sampleKeys) !==
      JSON.stringify(expectedKeys)
    ) {
      fail("blind packet sample keys drifted from the pinned original sources");
    }
  } catch {
    fail("pinned original-source receipt is absent or invalid");
  }
  if (
    typeof receipt.independentCanvasGradingTask !== "string" ||
    !receipt.independentCanvasGradingTask.includes("independent grader") ||
    !receipt.independentCanvasGradingTask.includes(
      "do not set Button success true",
    )
  ) {
    fail("exact independent canvas grading task is absent");
  }

  return failures;
}

const selfTest = (receipt: Json): string[] => {
  const failures: string[] = [];
  const mutations: Array<[string, (copy: Json) => void, RegExp]> = [
    [
      "wrong file",
      (copy) => {
        copy.target.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV";
      },
      /Scratch Project file key/,
    ],
    [
      "forged success",
      (copy) => {
        copy.status.buttonSuccess = true;
      },
      /Button success must remain false/,
    ],
    [
      "omitted source fact",
      (copy) => {
        copy.accounting.offlineSourceAndCompiledIr[
          "altitude-button-reviewed-v2"
        ].factsCompared -= 1;
      },
      /offline zero-silent accounting/,
    ],
    [
      "mislabelled source fact",
      (copy) => {
        const report =
          copy.accounting.offlineSourceAndCompiledIr[
            "fluent-button-reviewed-v2"
          ];
        report.carried -= 1;
        report.codeOnly += 2;
      },
      /offline zero-silent accounting/,
    ],
    [
      "forged nonzero live comparison",
      (copy) => {
        copy.readback.comparedFacts = 1;
      },
      /zero-fact live readback/,
    ],
  ];
  for (const [name, mutate, expected] of mutations) {
    const copy = structuredClone(receipt);
    mutate(copy);
    const observed = validateLiveButtonReceipt(copy).join("\n");
    if (!expected.test(observed)) failures.push(`${name} did not go red`);
  }
  return failures;
};

function main(): number {
  if (!existsSync(RECEIPT_PATH)) {
    console.error(`✘ recipe live receipt: missing ${RECEIPT_PATH}`);
    return 1;
  }
  const receipt = readJson(RECEIPT_PATH);
  const failures = process.argv.includes("--self-test")
    ? selfTest(receipt)
    : validateLiveButtonReceipt(receipt);
  if (failures.length > 0) {
    console.error(
      `✘ recipe live receipt: ${failures.length} failure(s)\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
    );
    return 1;
  }
  console.log(
    process.argv.includes("--self-test")
      ? "✔ recipe live receipt self-test: wrong-file, forged-success, omission, mislabel, and forged-live facts all went red"
      : `✔ recipe live receipt: capped failure is fail-closed, cleaned, source-accounted, and Button remains false (${sha256File(RECEIPT_PATH)})`,
  );
  return 0;
}

if (process.argv[1]?.endsWith("live-receipt.ts")) process.exit(main());
