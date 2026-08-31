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

/**
 * v5 REMINT (B3a focus-ring carried token). The v4 mint painted the Altitude
 * focus ring from an invented literal (#000b29, a mid-transition capture
 * artifact — recipe/evidence/altitude-focus-ring-diagnosis/receipt.json).
 * The fixture now carries the captured contract token
 * {imported.button.root.outline-color-state-focus-visible} = #4375ff, which
 * changes the Altitude recipe hash and therefore the run identity and page.
 * The v4 page 85:6781 and its closed inversion evidence stay preserved as
 * committed history; this build mints the corrected proof with its own
 * lineage.
 */
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v5";
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const artifactHash = (path: string): string => sha256(readFileSync(path));
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

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
  throw new Error(`v5 source preflight failed:\n${sourceFailures.join("\n")}`);
}
if (writer.runIdentity === "e6a61d04-b04f4059-v4") {
  throw new Error(
    "v5 build produced the v4 run identity — the B3a fixture teaching is absent",
  );
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
  throw new Error("v5 writer regeneration is nondeterministic");
}
const conformance = await validateFigmaWriterConformance(
  writerBytes.toString("utf8"),
);
if (!conformance.ok) {
  throw new Error(
    `v5 writer failed conformance:\n${conformance.failures.join("\n")}`,
  );
}
if (
  conformance.counts.variants !== 288 ||
  conformance.counts.variables !== 58 ||
  conformance.counts.pluginDataWrites <= 0 ||
  conformance.counts.bindings <= 0
) {
  // 58 = the v4 count of 57 plus the B3a focus-ring token
  // imported.button.root.outline-color-state-focus-visible.
  throw new Error("v5 writer conformance cardinality changed unexpectedly");
}
const conformanceBytes = await format(JSON.stringify(conformance), {
  parser: "json",
});
const transport = createWriterTransportArtifact(writerBytes);
const envelopeBytes = `${JSON.stringify(transport.envelope, null, 2)}\n`;
const status = git("status", "--porcelain=v1");
const planBytes = `${JSON.stringify(
  {
    version: 5,
    kind: "button-recipe-live-writer-plan",
    target: {
      fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
      fileName: "Scratch Project",
      editorType: "figma",
    },
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    correction: {
      teaching: "B3a focus-ring carried token",
      diagnosis:
        "recipe/evidence/altitude-focus-ring-diagnosis/receipt.json",
      supersedes: {
        runIdentity: "e6a61d04-b04f4059-v4",
        pageId: "85:6781",
        note: "v4 page and its closed inversion evidence stay preserved; the v4 Altitude focus ring carried an invented literal",
      },
    },
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
      wrapperPath: `${EVIDENCE_DIR}/writer-wrapper.txt`,
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
    attempts: [
      ...(existsSync(`${EVIDENCE_DIR}/live-attempt-1.json`)
        ? [
            {
              attempt: 1,
              result:
                "failed-writer-runtime-textencoder-not-in-figma-sandbox (0 writes; thrown during variable-name mapping before any page/variable creation; interpret.ts sanitizeVariableName violated the figma-runtime-portability TextEncoder:not-used contract and was corrected to a strict portable UTF-8 byte emitter)",
              writerPath: `${EVIDENCE_DIR}/writer-attempt-1.js`,
              writerSha256: artifactHash(`${EVIDENCE_DIR}/writer-attempt-1.js`),
              wrapperPath: `${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`,
              wrapperSha256: artifactHash(
                `${EVIDENCE_DIR}/writer-wrapper-attempt-1.txt`,
              ),
              resultPath: `${EVIDENCE_DIR}/live-attempt-1.json`,
              resultSha256: artifactHash(`${EVIDENCE_DIR}/live-attempt-1.json`),
            },
          ]
        : []),
      ...[2, 3].flatMap((attemptNumber) =>
        existsSync(`${EVIDENCE_DIR}/live-attempt-${attemptNumber}.json`)
          ? [
              {
                attempt: attemptNumber,
                result:
                  "failed-timeout-ephemeral-bridge-large-eval-crawl (partial page cleaned; see cleanup record)",
                resultPath: `${EVIDENCE_DIR}/live-attempt-${attemptNumber}.json`,
                resultSha256: artifactHash(
                  `${EVIDENCE_DIR}/live-attempt-${attemptNumber}.json`,
                ),
                cleanupPath: `${EVIDENCE_DIR}/cleanup-attempt-${attemptNumber}.json`,
                cleanupSha256: artifactHash(
                  `${EVIDENCE_DIR}/cleanup-attempt-${attemptNumber}.json`,
                ),
              },
            ]
          : [],
      ),
      ...(existsSync(`${EVIDENCE_DIR}/live-attempt-4.json`)
        ? [
            {
              attempt: 4,
              result:
                "mint-completed-then-superseded: staged-chunk transport delivered exact bytes and the writer completed, but setBoundVariableForEffect RESET the focus-ring shadow spread to 0 (measured live; ring painted nothing while its color bound correctly). The writer now carries the compile-planned shadow geometry over the bound effect; attempt-4 artifacts were cleaned and attempt 5 reminted.",
              resultPath: `${EVIDENCE_DIR}/live-attempt-4.json`,
              resultSha256: artifactHash(`${EVIDENCE_DIR}/live-attempt-4.json`),
              ...(existsSync(`${EVIDENCE_DIR}/cleanup-attempt-4.json`)
                ? {
                    cleanupPath: `${EVIDENCE_DIR}/cleanup-attempt-4.json`,
                    cleanupSha256: artifactHash(
                      `${EVIDENCE_DIR}/cleanup-attempt-4.json`,
                    ),
                  }
                : {}),
            },
          ]
        : []),
      ...(existsSync(`${EVIDENCE_DIR}/live-attempt-5.json`)
        ? [
            {
              attempt: 5,
              runIdentity: "4063ba55-b04f4059-v4",
              result:
                "mint-completed-then-superseded: ring painted #4375ff spread 4 correctly and all probes were green, but Figma paints LATER effect entries ON TOP, so the white spread-2 offset-gap shadow (listed first since v4) was buried under the ring and the render showed a 4px ring hugging the button instead of the captured offset-2px + width-2px outline. The fixture's altitudeFocus effect order was corrected (ring first, gap last), which changed the Altitude recipe hash and run identity; attempt-5 artifacts were cleaned and attempt 6 reminted under the new identity.",
              resultPath: `${EVIDENCE_DIR}/live-attempt-5.json`,
              resultSha256: artifactHash(`${EVIDENCE_DIR}/live-attempt-5.json`),
              ...(existsSync(`${EVIDENCE_DIR}/cleanup-attempt-5.json`)
                ? {
                    cleanupPath: `${EVIDENCE_DIR}/cleanup-attempt-5.json`,
                    cleanupSha256: artifactHash(
                      `${EVIDENCE_DIR}/cleanup-attempt-5.json`,
                    ),
                  }
                : {}),
            },
          ]
        : []),
    ],
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
      v4ReceiptSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v4/receipt.json",
      ),
      v4VerificationSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v4/live-verification.json",
      ),
      v4ReadbackSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v4/normalized-live-readback.json",
      ),
      v4WriterPlanSha256: artifactHash(
        "recipe/evidence/button-live-pivot-v4/writer-plan.json",
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
writeFileSync(`${EVIDENCE_DIR}/writer.js`, writerBytes);
writeFileSync(`${EVIDENCE_DIR}/transport-envelope.json`, envelopeBytes);
writeFileSync(`${EVIDENCE_DIR}/writer-wrapper.txt`, transport.wrapper);
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
