import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { format } from "prettier";

import { adaptReviewedButton } from "./adapters/button.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  emitButtonFigmaWriter,
  validateButtonFigmaSourcePlans,
} from "./interpret.js";
import { hashRecipeInstance } from "./recipe.js";
import { buttonRecipe, compileButtonRecipe } from "./recipes/button.js";
import { createWriterTransportArtifact } from "./writer-transport.js";

const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v4";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const artifactHash = (path: string): string => sha256(readFileSync(path));
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8"));
const attempt1Exists = existsSync(`${EVIDENCE_DIR}/live-attempt-1.json`);
const attempt1Wrapper = attempt1Exists
  ? readFileSync(
      existsSync(`${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`)
        ? `${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`
        : `${EVIDENCE_DIR}/writer-wrapper.txt`,
    )
  : undefined;
const attempt1EnvelopeMatch = attempt1Wrapper
  ?.toString("utf8")
  .match(/const envelope=(\{.*?\});\s*const pureSha256=/s);
const attempt1Writer =
  attempt1EnvelopeMatch == null
    ? undefined
    : Buffer.from(
        (
          JSON.parse(attempt1EnvelopeMatch[1]!) as {
            payload: string;
          }
        ).payload,
        "base64",
      );
if (
  attempt1Exists &&
  (!attempt1Writer ||
    sha256(attempt1Writer) !==
      (
        JSON.parse(attempt1EnvelopeMatch![1]!) as {
          payloadSha256: string;
        }
      ).payloadSha256)
) {
  throw new Error("cannot recover exact v4 attempt-1 writer from its wrapper");
}

const sources = [
  {
    adapterIdentity: "altitude-button-reviewed-v2",
    displayName: "Altitude",
    contractPath: "examples/altitude/contracts/button.contract.json",
    config: altitudeButtonAdapterConfig,
  },
  {
    adapterIdentity: "fluent-button-reviewed-v2",
    displayName: "Fluent",
    contractPath: "examples/fluent/contracts/button.contract.json",
    config: fluentButtonAdapterConfig,
  },
].map((source) => {
  const contractBytes = readFileSync(source.contractPath);
  const instance = adaptReviewedButton(
    JSON.parse(contractBytes.toString("utf8")),
    source.config,
  );
  const envelope = compileButtonRecipe(instance);
  return {
    ...source,
    contractHash: sha256(contractBytes),
    recipeHash: hashRecipeInstance(buttonRecipe, instance),
    envelope,
  };
});

const writer = emitButtonFigmaWriter(
  sources.map((source) => ({
    adapterIdentity: source.adapterIdentity,
    displayName: source.displayName,
    recipeHash: source.recipeHash,
    envelope: source.envelope,
  })),
);
const sourceFailures = validateButtonFigmaSourcePlans(writer.sourcePlans);
if (sourceFailures.length > 0) {
  throw new Error(`v4 source preflight failed:\n${sourceFailures.join("\n")}`);
}
const writerBytes = Buffer.from(`${writer.code}\n`, "utf8");
const writerHash = sha256(writerBytes);
const secondWriter = Buffer.from(
  `${
    emitButtonFigmaWriter(
      sources.map((source) => ({
        adapterIdentity: source.adapterIdentity,
        displayName: source.displayName,
        recipeHash: source.recipeHash,
        envelope: source.envelope,
      })),
    ).code
  }\n`,
  "utf8",
);
if (!writerBytes.equals(secondWriter)) {
  throw new Error("v4 writer regeneration is nondeterministic");
}
const conformance = await validateFigmaWriterConformance(
  writerBytes.toString("utf8"),
);
if (!conformance.ok) {
  throw new Error(
    `v4 writer failed conformance:\n${conformance.failures.join("\n")}`,
  );
}
if (
  conformance.counts.variants !== 288 ||
  conformance.counts.variables !== 57 ||
  conformance.counts.pluginDataWrites <= 0 ||
  conformance.counts.bindings <= 0
) {
  throw new Error("v4 writer conformance cardinality changed unexpectedly");
}
const conformanceBytes = await format(JSON.stringify(conformance), {
  parser: "json",
});
const transport = createWriterTransportArtifact(writerBytes);
const envelopeBytes = `${JSON.stringify(transport.envelope, null, 2)}\n`;
const status = git("status", "--porcelain=v1");
const planBytes = `${JSON.stringify(
  {
    version: 4,
    kind: "button-recipe-live-writer-plan",
    target: {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      fileName: "Scratch Project",
      editorType: "figma",
    },
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    writer: {
      path: `${EVIDENCE_DIR}/writer.js`,
      bytes: writerBytes.byteLength,
      sha256: writerHash,
      deterministicRegeneration: "pass-two-complete-generations",
    },
    transport: {
      protocol: transport.envelope.protocol,
      encoding: transport.envelope.encoding,
      payloadBytes: transport.envelope.payloadBytes,
      payloadSha256: transport.envelope.payloadSha256,
      envelopePath: `${EVIDENCE_DIR}/transport-envelope.json`,
      envelopeSha256: transport.envelopeSha256,
      wrapperPath: `${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`,
      wrapperBytes: transport.wrapperBytes,
      wrapperSha256: transport.wrapperSha256,
      preEvalChecks: [
        "exact Scratch file key/name/editor",
        "protocol and encoding",
        "strict canonical base64",
        "decoded byte length",
        "decoded SHA-256",
        "fatal UTF-8 decode",
      ],
    },
    attempts: attempt1Exists
      ? [
          {
            attempt: 1,
            result: "failed-source-fixed-label-zero-width",
            writerPath: `${EVIDENCE_DIR}/writer-attempt-1.js`,
            writerSha256: sha256(attempt1Writer!),
            wrapperPath: `${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`,
            wrapperSha256: sha256(attempt1Wrapper!),
            resultPath: `${EVIDENCE_DIR}/live-attempt-1.json`,
            resultSha256: artifactHash(`${EVIDENCE_DIR}/live-attempt-1.json`),
            diagnosticPath: `${EVIDENCE_DIR}/live-attempt-1-diagnostic.json`,
            diagnosticSha256: artifactHash(
              `${EVIDENCE_DIR}/live-attempt-1-diagnostic.json`,
            ),
            cleanupPath: `${EVIDENCE_DIR}/cleanup-attempt-1.json`,
            cleanupSha256: artifactHash(
              `${EVIDENCE_DIR}/cleanup-attempt-1.json`,
            ),
          },
        ]
      : [],
    pluginApi: {
      typingsVersion: conformance.typingsVersion,
      conformanceReport: `${EVIDENCE_DIR}/conformance-report.json`,
      conformanceReportSha256: sha256(conformanceBytes),
      counts: conformance.counts,
    },
    sources: sources.map((source, index) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      contractPath: source.contractPath,
      contractSha256: source.contractHash,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      plannedVariants: writer.sourcePlans[index]!.cells.length,
      comparedIrFacts: writer.sourcePlans[index]!.comparedIrFacts,
      expectedScenePlan: writer.sourcePlans[index]!.expectedScenePlan,
      responsiveness: {
        sourceSizing: "hug",
        designerResize: "fixed-width",
        childRole: "button/label",
        response: "recenter",
      },
    })),
    immutableHistory: {
      v1ReceiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot/receipt.json",
      ),
      v2ReceiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v2/receipt.json",
      ),
      v3ReceiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v3/receipt.json",
      ),
      v3VerificationSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v3/live-verification.json",
      ),
      v3ReadbackSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v3/normalized-live-readback.json",
      ),
      v3CleanupSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v3/cleanup.json",
      ),
    },
    provenance: {
      commit: git("rev-parse", "HEAD"),
      branch: git("branch", "--show-current"),
      dirty: status.length > 0,
      dirtyStatusSha256: sha256(status),
    },
    grading: {
      status: "ungraded",
      buttonSuccess: false,
      recognisabilityVerdictsAuthoredByBuilder: false,
    },
  },
  null,
  2,
)}\n`;

mkdirSync(EVIDENCE_DIR, { recursive: true });
if (attempt1Writer && attempt1Wrapper) {
  writeFileSync(`${EVIDENCE_DIR}/writer-attempt-1.js`, attempt1Writer);
  writeFileSync(
    `${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`,
    attempt1Wrapper,
  );
}
writeFileSync(`${EVIDENCE_DIR}/writer.js`, writerBytes);
writeFileSync(`${EVIDENCE_DIR}/transport-envelope.json`, envelopeBytes);
writeFileSync(
  `${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`,
  transport.wrapper,
);
writeFileSync(`${EVIDENCE_DIR}/conformance-report.json`, conformanceBytes);
writeFileSync(`${EVIDENCE_DIR}/writer-plan.json`, planBytes);
console.log(
  JSON.stringify({
    evidenceDir: EVIDENCE_DIR,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    writerBytes: writerBytes.byteLength,
    writerSha256: writerHash,
    wrapperBytes: transport.wrapperBytes,
    wrapperSha256: transport.wrapperSha256,
    counts: conformance.counts,
    sourcePlanFailures: sourceFailures.length,
  }),
);
