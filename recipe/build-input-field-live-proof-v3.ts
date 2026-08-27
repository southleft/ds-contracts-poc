import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import { format } from "prettier";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  INPUT_LIVE_V3_AUTHORIZATION_PATH,
  INPUT_LIVE_V3_FIGMA_FILE_KEY,
  INPUT_LIVE_V3_PROTOCOL_PATH,
  INPUT_LIVE_V3_PROTOCOL_SHA256,
} from "./input-field-live-v3-authorization.js";
import { INPUT_LIVE_V3_ROOT } from "./input-field-live-v3-preflight.js";
import { INPUT_LIVE_V3_REQUIRED_GATE_IDS } from "./input-field-live-v3-verifier.js";
import { emitInputFieldFigmaWriterV2 } from "./input-field-figma-writer-v2.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import { FIGMA_RUNTIME_API_AUDIT } from "./figma-runtime-portability.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";
import { createWriterTransportArtifact } from "./writer-transport.js";

export const INPUT_LIVE_V3_PLAN_VERSION = "input-live-v3-writer-plan-v1";
const WRITER_PATH = `${INPUT_LIVE_V3_ROOT}/writer.js`;
const ENVELOPE_PATH = `${INPUT_LIVE_V3_ROOT}/transport-envelope.json`;
const WRAPPER_PATH = `${INPUT_LIVE_V3_ROOT}/writer-wrapper.txt`;
const PLAN_PATH = `${INPUT_LIVE_V3_ROOT}/writer-plan.json`;
const CONFORMANCE_PATH = `${INPUT_LIVE_V3_ROOT}/conformance-report.json`;

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const bytes = (file: string): Buffer => readFileSync(file);
const json = (file: string): Record<string, any> =>
  JSON.parse(readFileSync(file, "utf8"));

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

export async function buildInputLiveV3Proof(): Promise<Record<string, any>> {
  const protocolBytes = bytes(INPUT_LIVE_V3_PROTOCOL_PATH);
  if (sha256(protocolBytes) !== INPUT_LIVE_V3_PROTOCOL_SHA256)
    throw new Error("Input live v3 locked protocol byte drift");
  const authorizationBytes = bytes(INPUT_LIVE_V3_AUTHORIZATION_PATH);
  const sources = sourceInputs();
  const writer = emitInputFieldFigmaWriterV2(
    sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: source.recipeHash,
      envelope: source.envelope,
      slotCharacters: source.slotCharacters,
    })),
  );
  const second = emitInputFieldFigmaWriterV2(
    sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: source.recipeHash,
      envelope: source.envelope,
      slotCharacters: source.slotCharacters,
    })),
  );
  if (writer.code !== second.code)
    throw new Error("Input live v3 writer regeneration is nondeterministic");
  const writerBytes = Buffer.from(`${writer.code}\n`, "utf8");
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
  if (!conformance.ok) throw new Error(conformance.failures.join("\n"));
  if (
    conformance.counts.variants !== 256 ||
    conformance.counts.variables <= 0 ||
    conformance.counts.bindings <= 0
  )
    throw new Error("Input live v3 planned cardinality is incomplete");
  const transport = createWriterTransportArtifact(writerBytes);
  const comparisonReceipt = json(
    "recipe/evidence/input-field-comparison-v3/receipt.json",
  );
  const objective = json(
    "recipe/evidence/input-field-objective-comparison-v2/objective-result.json",
  );
  const references = new Map(
    comparisonReceipt.references.map((entry: Record<string, any>) => [
      entry.cellKey,
      entry,
    ]),
  );
  const baselines = new Map(
    objective.perCell.map((entry: Record<string, any>) => [
      entry.cellKey,
      entry,
    ]),
  );
  const objectiveCells = comparisonReceipt.matrix.cells.map(
    (cell: Record<string, string>) => {
      const reference = references.get(cell.key) as Record<string, any>;
      const baseline = baselines.get(cell.key) as Record<string, any>;
      if (!reference || !baseline)
        throw new Error(`Input live v3 objective source absent: ${cell.key}`);
      return {
        cell,
        adapterIdentity: sources.find(
          (source) => source.library === cell.library,
        )!.adapterIdentity,
        reference: {
          path: reference.file,
          sha256: reference.hash,
          width: reference.width,
          height: reference.height,
          contentBox: reference.contentBox,
        },
        legacy: {
          geometry: baseline.geometry.legacy,
          perceptual: baseline.pixelInk.legacy,
          pixelInk: baseline.pixelInk.legacy,
        },
      };
    },
  );
  if (
    objectiveCells.length !== 128 ||
    new Set(objectiveCells.map((entry: Record<string, any>) => entry.cell.key))
      .size !== 128
  )
    throw new Error(
      "Input live v3 objective denominator is not 128 unique cells",
    );

  const modulePaths = [
    "recipe/build-input-field-live-proof-v3.ts",
    "recipe/input-field-live-v3-preflight.ts",
    "recipe/input-field-live-v3-verifier.ts",
    "recipe/input-field-live-v3-evidence.ts",
    "recipe/input-field-live-v3-cleanup.ts",
    "recipe/figma-runtime-portability.ts",
    "recipe/scene-readback-runtime.ts",
    "recipe/writer-transport.ts",
    "recipe/run-input-field-live-v3.ts",
  ];
  const expectedPlanArtifacts = writer.sourcePlans.map((source, index) => {
    const uncompressed = Buffer.from(
      `${JSON.stringify(source.expectedScenePlan)}\n`,
    );
    const compressed = gzipSync(uncompressed, { level: 9 });
    return {
      path: `${INPUT_LIVE_V3_ROOT}/expected-scene-plan-${sources[index]!.library}.json.gz`,
      bytes: compressed.byteLength,
      sha256: sha256(compressed),
      uncompressedBytes: uncompressed.byteLength,
      uncompressedSha256: sha256(uncompressed),
      facts: source.expectedScenePlan.facts.length,
      compressed,
    };
  });
  const plan = {
    artifactVersion: INPUT_LIVE_V3_PLAN_VERSION,
    target: {
      fileKey: INPUT_LIVE_V3_FIGMA_FILE_KEY,
      fileName: "Scratch Project",
      editorType: "figma",
    },
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    locked: {
      protocolPath: INPUT_LIVE_V3_PROTOCOL_PATH,
      protocolSha256: sha256(protocolBytes),
      authorizationPath: INPUT_LIVE_V3_AUTHORIZATION_PATH,
      authorizationSha256: sha256(authorizationBytes),
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
      executionProtocolVersion: 3,
    },
    transport: {
      protocol: transport.envelope.protocol,
      envelopePath: ENVELOPE_PATH,
      envelopeSha256: transport.envelopeSha256,
      payloadBytes: transport.envelope.payloadBytes,
      payloadSha256: transport.envelope.payloadSha256,
      wrapperPath: WRAPPER_PATH,
      wrapperBytes: transport.wrapperBytes,
      wrapperSha256: transport.wrapperSha256,
    },
    conformance: {
      path: CONFORMANCE_PATH,
      counts: conformance.counts,
      runtimeApiAudit: FIGMA_RUNTIME_API_AUDIT,
    },
    requiredGateIds: [...INPUT_LIVE_V3_REQUIRED_GATE_IDS],
    sources: sources.map((source, index) => ({
      library: source.library,
      adapterIdentity: source.adapterIdentity,
      contractPath: source.contractPath,
      contractSha256: source.contractSha256,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      selection: source.instance.provenance.selection,
      plannedVariants: writer.sourcePlans[index]!.cells.length,
      plannedVariables: writer.sourcePlans[index]!.variables.length,
      plannedSceneFacts:
        writer.sourcePlans[index]!.expectedScenePlan.facts.length,
      expectedScenePlanArtifact: {
        path: expectedPlanArtifacts[index]!.path,
        bytes: expectedPlanArtifacts[index]!.bytes,
        sha256: expectedPlanArtifacts[index]!.sha256,
        uncompressedBytes: expectedPlanArtifacts[index]!.uncompressedBytes,
        uncompressedSha256: expectedPlanArtifacts[index]!.uncompressedSha256,
        facts: expectedPlanArtifacts[index]!.facts,
      },
    })),
    objective: {
      cells: objectiveCells,
      deterministicOrderSha256: sha256(
        Buffer.from(
          objectiveCells
            .map((entry: Record<string, any>) => entry.cell.key)
            .join("\n"),
        ),
      ),
    },
    moduleHashes: Object.fromEntries(
      modulePaths.map((modulePath) => [modulePath, sha256(bytes(modulePath))]),
    ),
    attempts: { maximum: 3 },
  };

  const outputs = new Map<string, Buffer>([
    [WRITER_PATH, writerBytes],
    [
      ENVELOPE_PATH,
      Buffer.from(`${JSON.stringify(transport.envelope, null, 2)}\n`),
    ],
    [WRAPPER_PATH, Buffer.from(transport.wrapper)],
    [
      CONFORMANCE_PATH,
      Buffer.from(
        await format(JSON.stringify(conformance), { parser: "json" }),
      ),
    ],
    [PLAN_PATH, Buffer.from(`${JSON.stringify(plan, null, 2)}\n`)],
    ...expectedPlanArtifacts.map(
      ({ path: outputPath, compressed }) =>
        [outputPath, compressed] as [string, Buffer],
    ),
  ]);
  if (process.argv.includes("--check")) {
    const drift = [...outputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length > 0)
      throw new Error(
        `Input live v3 generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    mkdirSync(INPUT_LIVE_V3_ROOT, { recursive: true });
    for (const [outputPath, value] of outputs) writeFileSync(outputPath, value);
  }
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`)
  console.log(JSON.stringify(await buildInputLiveV3Proof()));
