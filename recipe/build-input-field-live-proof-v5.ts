import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { format } from "prettier";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  INPUT_LIVE_V5_AUTHORIZATION_PATH,
  INPUT_LIVE_V5_EVIDENCE_ROOT,
  INPUT_LIVE_V5_PROTOCOL_PATH,
  INPUT_LIVE_V5_PROTOCOL_SHA256,
  INPUT_LIVE_V5_TARGET,
} from "./input-field-live-v5-authorization.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { FIGMA_RUNTIME_API_AUDIT } from "./figma-runtime-portability.js";
import { emitInputFieldFigmaWriterV2 } from "./input-field-figma-writer-v2.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";
import { createWriterTransportArtifact } from "./writer-transport.js";

const WRITER_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer.js`;
const ENVELOPE_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/transport-envelope.json`;
const WRAPPER_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-wrapper.txt`;
const PLAN_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/writer-plan.json`;
const CONFORMANCE_PATH = `${INPUT_LIVE_V5_EVIDENCE_ROOT}/conformance-report.json`;
const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const bytes = (file: string): Buffer => readFileSync(file);

const sourceInputs = () =>
  [
    {
      library: "mui",
      adapterIdentity: "material-text-field-reviewed-v1",
      displayName: "Material source",
      contractPath: "examples/mui/contracts/text-field.contract.json",
      config: muiInputFieldAdapterConfig,
      slotCharacters: { leading: "$", trailing: "USD" },
    },
    {
      library: "polaris",
      adapterIdentity: "commerce-text-field-reviewed-v1",
      displayName: "Commerce source",
      contractPath: "examples/polaris/contracts/text-field.contract.json",
      config: polarisInputFieldAdapterConfig,
      slotCharacters: { leading: "$", trailing: "USD" },
    },
  ].map((source) => {
    const contract = bytes(source.contractPath);
    const instance = adaptReviewedInputField(
      JSON.parse(contract.toString("utf8")),
      source.config,
    );
    const envelope = compileInputFieldRecipe(instance);
    return {
      ...source,
      contractSha256: sha256(contract),
      instance,
      envelope,
      recipeHash: hashRecipeInstance(inputFieldRecipe, instance),
    };
  });

export async function buildInputLiveV5Proof(
  check = process.argv.includes("--check"),
): Promise<Record<string, any>> {
  const protocolBytes = bytes(INPUT_LIVE_V5_PROTOCOL_PATH);
  if (sha256(protocolBytes) !== INPUT_LIVE_V5_PROTOCOL_SHA256)
    throw new Error("Input live v5 protocol byte drift");
  const sources = sourceInputs();
  const writerInput = sources.map((source) => ({
    adapterIdentity: source.adapterIdentity,
    displayName: source.displayName,
    recipeHash: source.recipeHash,
    envelope: source.envelope,
    slotCharacters: source.slotCharacters,
  }));
  const writer = emitInputFieldFigmaWriterV2(writerInput, {
    namespace: "ds.contracts.input.recipe.v5",
    runSuffix: "input-v5",
  });
  const second = emitInputFieldFigmaWriterV2(writerInput, {
    namespace: "ds.contracts.input.recipe.v5",
    runSuffix: "input-v5",
  });
  if (writer.code !== second.code)
    throw new Error("Input live v5 writer generation is nondeterministic");
  const writerSource = writer.code.endsWith("\n")
    ? writer.code
    : `${writer.code}\n`;
  const writerBytes = Buffer.from(writerSource, "utf8");
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
        "readSceneDerivedTree",
      ],
    },
  );
  if (
    !conformance.ok ||
    conformance.counts.variants !== 256 ||
    conformance.counts.variables <= 0 ||
    conformance.counts.bindings <= 0
  )
    throw new Error(
      `Input live v5 writer conformance failed:\n${conformance.failures.join("\n")}`,
    );
  const transport = createWriterTransportArtifact(
    writerBytes,
    "__recipeTransportV5",
  );
  const envelopeBytes = Buffer.from(
    `${JSON.stringify(transport.envelope, null, 2)}\n`,
  );
  const wrapperBytes = Buffer.from(transport.wrapper);
  const conformanceBytes = Buffer.from(
    await format(JSON.stringify(conformance), { parser: "json" }),
  );
  const expectedPlans = writer.sourcePlans.map((sourcePlan, index) => {
    const uncompressed = Buffer.from(
      `${JSON.stringify(sourcePlan.expectedScenePlan)}\n`,
    );
    const compressed = gzipSync(uncompressed, { level: 9 });
    return {
      path: `${INPUT_LIVE_V5_EVIDENCE_ROOT}/expected-scene-plan-${sources[index]!.library}.json.gz`,
      bytes: compressed.byteLength,
      sha256: sha256(compressed),
      uncompressedBytes: uncompressed.byteLength,
      uncompressedSha256: sha256(uncompressed),
      facts: sourcePlan.expectedScenePlan.facts.length,
      generatedDescendants:
        sourcePlan.expectedScenePlan.generatedDescendants.length,
      compressed,
    };
  });
  const generatedWithoutPlan = new Map<string, Buffer>([
    [WRITER_PATH, writerBytes],
    [ENVELOPE_PATH, envelopeBytes],
    [WRAPPER_PATH, wrapperBytes],
    [CONFORMANCE_PATH, conformanceBytes],
    ...expectedPlans.map(
      (artifact) => [artifact.path, artifact.compressed] as [string, Buffer],
    ),
  ]);
  const modulePaths = [
    "recipe/build-input-field-live-proof-v5.ts",
    "recipe/input-field-live-v5-authorization.ts",
    "recipe/input-field-live-v5-journal.ts",
    "recipe/input-field-live-v5-preflight.ts",
    "recipe/run-input-field-live-v5.ts",
    "recipe/input-field-live-v4-verifier.ts",
    "recipe/figma-property-normalizer.ts",
    "recipe/input-field-figma-writer-v2.ts",
    "recipe/figma-runtime-portability.ts",
    "recipe/writer-transport.ts",
  ];
  const plan = {
    artifactVersion: "input-live-v5-writer-plan-v1",
    status:
      "draft antecedent uncommitted; no v5 authorization or live attempt exists",
    target: INPUT_LIVE_V5_TARGET,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    locked: {
      protocolPath: INPUT_LIVE_V5_PROTOCOL_PATH,
      protocolSha256: INPUT_LIVE_V5_PROTOCOL_SHA256,
      authorizationPath: INPUT_LIVE_V5_AUTHORIZATION_PATH,
      authorizationPresent: false,
      v4AuthorizationReusable: false,
    },
    typedLowering: {
      module: "recipe/input-field-figma-writer-v2.ts",
      moduleSha256: sha256(bytes("recipe/input-field-figma-writer-v2.ts")),
      sourceStringRewriting: false,
      targetSpecificAdjustment: false,
      measuredOutcomeEmbedded: false,
    },
    writer: {
      path: WRITER_PATH,
      bytes: writerBytes.byteLength,
      sha256: sha256(writerBytes),
      deterministicGenerations: 2,
      writerProgramVersion: 2,
      executionProtocolVersion: 5,
    },
    transport: {
      protocol: transport.envelope.protocol,
      envelopePath: ENVELOPE_PATH,
      envelopeSha256: sha256(envelopeBytes),
      payloadBytes: transport.envelope.payloadBytes,
      payloadSha256: transport.envelope.payloadSha256,
      wrapperPath: WRAPPER_PATH,
      wrapperBytes: wrapperBytes.byteLength,
      wrapperSha256: sha256(wrapperBytes),
      stateKey: "__recipeTransportV5",
    },
    conformance: {
      path: CONFORMANCE_PATH,
      ok: conformance.ok,
      sha256: sha256(conformanceBytes),
      counts: conformance.counts,
      runtimeApiAudit: FIGMA_RUNTIME_API_AUDIT,
    },
    sources: sources.map((source, index) => ({
      library: source.library,
      adapterIdentity: source.adapterIdentity,
      contractPath: source.contractPath,
      contractSha256: source.contractSha256,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      plannedVariants: writer.sourcePlans[index]!.cells.length,
      plannedVariables: writer.sourcePlans[index]!.variables.length,
      plannedSceneFacts:
        writer.sourcePlans[index]!.expectedScenePlan.facts.length,
      plannedGeneratedDescendants:
        writer.sourcePlans[index]!.expectedScenePlan.generatedDescendants
          .length,
      expectedScenePlanArtifact: {
        path: expectedPlans[index]!.path,
        bytes: expectedPlans[index]!.bytes,
        sha256: expectedPlans[index]!.sha256,
        uncompressedBytes: expectedPlans[index]!.uncompressedBytes,
        uncompressedSha256: expectedPlans[index]!.uncompressedSha256,
        facts: expectedPlans[index]!.facts,
        generatedDescendants: expectedPlans[index]!.generatedDescendants,
      },
    })),
    artifacts: {
      sha256: Object.fromEntries(
        [...generatedWithoutPlan].map(([artifactPath, value]) => [
          artifactPath,
          sha256(value),
        ]),
      ),
    },
    moduleHashes: Object.fromEntries(
      modulePaths.map((modulePath) => [modulePath, sha256(bytes(modulePath))]),
    ),
    attempts: {
      executed: 0,
      next: 1,
      maximum: 3,
      cleanPublishedDescendantsOnly: true,
    },
    outcomes: null,
    humanSignoff: "pending",
    overallInputSuccess: false,
  };
  const planBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`);
  const outputs = new Map(generatedWithoutPlan);
  outputs.set(PLAN_PATH, planBytes);
  if (check) {
    const drift = [...outputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Input live v5 generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    mkdirSync(INPUT_LIVE_V5_EVIDENCE_ROOT, { recursive: true });
    for (const [outputPath, value] of outputs) writeFileSync(outputPath, value);
  }
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`)
  process.stdout.write(
    `${JSON.stringify(await buildInputLiveV5Proof(), null, 2)}\n`,
  );
