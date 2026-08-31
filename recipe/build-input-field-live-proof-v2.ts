import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { format } from "prettier";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import { validateInputFieldFigmaSourcePlans } from "./input-field-figma-writer.js";
import { emitInputFieldFigmaWriterV2 } from "./input-field-figma-writer-v2.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";
import { createWriterTransportArtifact } from "./writer-transport.js";

const ROOT = "recipe/evidence/input-field-live-pivot-v2";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const attempt1Exists = existsSync(`${ROOT}/live-attempt-1.json`);
const attempt1Writer = attempt1Exists
  ? readFileSync(
      existsSync(`${ROOT}/writer-attempt-1.js`)
        ? `${ROOT}/writer-attempt-1.js`
        : `${ROOT}/writer.js`,
    )
  : undefined;
const attempt2Exists = existsSync(`${ROOT}/live-attempt-2.json`);
const attempt2Writer = attempt2Exists
  ? readFileSync(`${ROOT}/writer.js`)
  : undefined;
const nextAttempt = attempt2Exists ? 3 : attempt1Exists ? 2 : 1;

const sources = [
  {
    adapterIdentity: "material-text-field-reviewed-v1",
    displayName: "Material source",
    contractPath: "examples/mui/contracts/text-field.contract.json",
    config: muiInputFieldAdapterConfig,
    slotCharacters: { leading: "$", trailing: "USD" },
  },
  {
    adapterIdentity: "commerce-text-field-reviewed-v1",
    displayName: "Commerce source",
    contractPath: "examples/polaris/contracts/text-field.contract.json",
    config: polarisInputFieldAdapterConfig,
    slotCharacters: { leading: "$", trailing: "USD" },
  },
].map((source) => {
  const contract = readFileSync(source.contractPath);
  const instance = adaptReviewedInputField(
    JSON.parse(contract.toString("utf8")),
    source.config,
  );
  const envelope = compileInputFieldRecipe(instance);
  return {
    ...source,
    instance,
    envelope,
    contractSha256: sha256(contract),
    recipeHash: hashRecipeInstance(inputFieldRecipe, instance),
  };
});

const writer = emitInputFieldFigmaWriterV2(
  sources.map((source) => ({
    adapterIdentity: source.adapterIdentity,
    displayName: source.displayName,
    recipeHash: source.recipeHash,
    envelope: source.envelope,
    slotCharacters: source.slotCharacters,
  })),
);
const failures = validateInputFieldFigmaSourcePlans(writer.sourcePlans);
if (failures.length > 0) throw new Error(failures.join("\n"));
const writerBytes = Buffer.from(`${writer.code}\n`, "utf8");
const writerAgain = Buffer.from(
  `${
    emitInputFieldFigmaWriterV2(
      sources.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelope: source.envelope,
        slotCharacters: source.slotCharacters,
      })),
    ).code
  }\n`,
  "utf8",
);
if (!writerBytes.equals(writerAgain)) {
  throw new Error("Input writer regeneration is nondeterministic");
}
const conformance = await validateFigmaWriterConformance(
  writerBytes.toString("utf8"),
  {
    variants: 256,
    writerVersion: 2,
    requiredMarkers: [
      "INPUT-TEXT-GEOMETRY",
      "INPUT-FAKE-LAYOUT",
      "INPUT-OVERLAY-DECLARATION-INCOMPLETE",
      "INPUT-TEXT-ZERO-WIDTH-AFTER-PROPERTY",
      "INPUT-FONT-METRICS-DRIFT",
    ],
  },
);
if (!conformance.ok) {
  throw new Error(
    `Input writer conformance failed:\n${conformance.failures.join("\n")}`,
  );
}
if (
  conformance.counts.variants !== 256 ||
  conformance.counts.variables <= 0 ||
  conformance.counts.bindings <= 0 ||
  conformance.counts.pluginDataWrites <= 0
) {
  throw new Error("Input writer conformance cardinalities are incomplete");
}
const transport = createWriterTransportArtifact(writerBytes);
const status = git("status", "--porcelain=v1");
const plan = {
  version: 2,
  kind: "input-field-recipe-live-writer-plan",
  target: {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
  },
  pageName: writer.pageName,
  runIdentity: writer.runIdentity,
  writer: {
    path: `${ROOT}/writer.js`,
    bytes: writerBytes.byteLength,
    sha256: sha256(writerBytes),
    deterministicRegeneration: "pass-two-complete-generations",
  },
  transport: {
    protocol: transport.envelope.protocol,
    encoding: transport.envelope.encoding,
    payloadBytes: transport.envelope.payloadBytes,
    payloadSha256: transport.envelope.payloadSha256,
    envelopePath: `${ROOT}/transport-envelope.json`,
    envelopeSha256: transport.envelopeSha256,
    wrapperPath: `${ROOT}/writer-wrapper-attempt-${nextAttempt}.txt`,
    wrapperBytes: transport.wrapperBytes,
    wrapperSha256: transport.wrapperSha256,
    preEvalChecks: [
      "exact Scratch file key/name/editor",
      "strict canonical base64",
      "decoded byte length",
      "decoded SHA-256",
      "fatal UTF-8 decode",
    ],
  },
  pluginApi: {
    typingsVersion: conformance.typingsVersion,
    conformanceReport: `${ROOT}/conformance-report.json`,
    counts: conformance.counts,
  },
  sources: sources.map((source, index) => ({
    adapterIdentity: source.adapterIdentity,
    displayName: source.displayName,
    contractPath: source.contractPath,
    contractSha256: source.contractSha256,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelope.integrity.canonicalHash,
    plannedVariants: writer.sourcePlans[index]!.cells.length,
    plannedVariables: writer.sourcePlans[index]!.variables.length,
    comparedIrFacts: writer.sourcePlans[index]!.comparedIrFacts,
    expectedScenePlan: writer.sourcePlans[index]!.expectedScenePlan,
  })),
  attempts: {
    maximum: 3,
    planned: nextAttempt,
    executed: nextAttempt - 1,
    history: attempt1Exists
      ? [
          {
            attempt: 1,
            result: "failed-source-fixed-invalid-x-variable-binding",
            writerPath: `${ROOT}/writer-attempt-1.js`,
            writerSha256: sha256(attempt1Writer!),
            wrapperPath: `${ROOT}/writer-wrapper-attempt-1.txt`,
            wrapperSha256: sha256(
              readFileSync(`${ROOT}/writer-wrapper-attempt-1.txt`),
            ),
            resultPath: `${ROOT}/live-attempt-1.json`,
            cleanupPath: `${ROOT}/cleanup-attempt-1.json`,
          },
          ...(attempt2Exists
            ? [
                {
                  attempt: 2,
                  result: "writer-executed-live-validation-failed-source-fixed",
                  writerPath: `${ROOT}/writer-attempt-2.js`,
                  writerSha256: sha256(attempt2Writer!),
                  wrapperPath: `${ROOT}/writer-wrapper-attempt-2.txt`,
                  wrapperSha256: sha256(
                    readFileSync(`${ROOT}/writer-wrapper-attempt-2.txt`),
                  ),
                  resultPath: `${ROOT}/live-attempt-2.json`,
                  cleanupPath: `${ROOT}/cleanup-attempt-2.json`,
                  verificationPath: `${ROOT}/live-verification.json`,
                  objectivePath: `${ROOT}/objective-canvas-result.json`,
                },
              ]
            : []),
        ]
      : [],
  },
  provenance: {
    commit: git("rev-parse", "HEAD"),
    branch: git("branch", "--show-current"),
    dirty: status.length > 0,
    dirtyStatusSha256: sha256(status),
  },
  status: {
    objectiveV2: "pass-locked-128-of-128",
    live: "pending",
    humanRecognisability: "pending-independent-designer-signoff",
    overallInputSuccess: false,
  },
};

mkdirSync(ROOT, { recursive: true });
if (attempt1Writer) {
  writeFileSync(`${ROOT}/writer-attempt-1.js`, attempt1Writer);
}
if (attempt2Writer) {
  writeFileSync(`${ROOT}/writer-attempt-2.js`, attempt2Writer);
}
writeFileSync(`${ROOT}/writer.js`, writerBytes);
writeFileSync(
  `${ROOT}/transport-envelope.json`,
  `${JSON.stringify(transport.envelope, null, 2)}\n`,
);
writeFileSync(
  `${ROOT}/writer-wrapper-attempt-${nextAttempt}.txt`,
  transport.wrapper,
);
writeFileSync(
  `${ROOT}/conformance-report.json`,
  await format(JSON.stringify(conformance), { parser: "json" }),
);
writeFileSync(`${ROOT}/writer-plan.json`, `${JSON.stringify(plan, null, 2)}\n`);
console.log(
  JSON.stringify({
    root: ROOT,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    writerBytes: writerBytes.length,
    writerSha256: sha256(writerBytes),
    wrapperBytes: transport.wrapperBytes,
    wrapperSha256: transport.wrapperSha256,
    counts: conformance.counts,
    sourceVariables: writer.sourcePlans.map(
      (source) => source.variables.length,
    ),
  }),
);
