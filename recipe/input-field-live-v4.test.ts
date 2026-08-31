import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  normalizeFigmaBindings,
  normalizeFigmaUnit,
  SERIALIZED_FIGMA_MIXED,
  type LocalVariableRecord,
} from "./figma-property-normalizer.js";
import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";
import {
  INPUT_LIVE_V4_STATUS,
  readInputLiveV4Protocol,
  validateInputLiveV4Preflight,
  validateInputLiveV4Protocol,
  type InputLiveV4PreflightState,
} from "./input-field-live-v4-evidence.js";
import {
  createInputLiveV4JournalEntry,
  validateInputLiveV4Journal,
  type InputLiveV4WriterOwnership,
} from "./input-field-live-v4-journal.js";
import {
  executeInputLiveV4Pipeline,
  type InputLiveV4Pipeline,
} from "./run-input-field-live-v4.js";
import { buildInputLiveV4RawPropertyRuntime } from "./input-field-live-v4-verifier.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime.js";

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });
const variables: LocalVariableRecord[] = [
  {
    id: "color",
    name: "token/color/id-636f6c6f722e6272616e64",
    resolvedType: "COLOR",
    collectionId: "collection",
    collectionName: "Input v4",
    remote: false,
  },
  {
    id: "float",
    name: "token/float/id-73697a652e3136",
    resolvedType: "FLOAT",
    collectionId: "collection",
    collectionName: "Input v4",
    remote: false,
  },
  {
    id: "color-other",
    name: "token/color/id-636f6c6f722e6f74686572",
    resolvedType: "COLOR",
    collectionId: "collection",
    collectionName: "Input v4",
    remote: false,
  },
  {
    id: "string",
    name: "token/string/id-6c6162656c",
    resolvedType: "STRING",
    collectionId: "collection",
    collectionName: "Input v4",
    remote: false,
  },
  {
    id: "boolean",
    name: "token/boolean/id-76697369626c65",
    resolvedType: "BOOLEAN",
    collectionId: "collection",
    collectionName: "Input v4",
    remote: false,
  },
];

test("attempt-3 alias arrays and Figma unit objects normalize without losing units", () => {
  const fixture = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v4/normalization-fixtures.json",
      "utf8",
    ),
  );
  const observed = fixture.attempt3ObservedShapeClasses;
  const raw = structuredClone(observed.nodeBoundVariables);
  raw.fills[0].id = "color";
  raw.fontSize[0].id = "float";
  raw.lineHeight[0].id = "float";
  assert.deepEqual(
    normalizeFigmaBindings({
      nodeBoundVariables: raw,
      variableTable: variables,
    }).map((binding) => [
      binding.field,
      binding.variable.name,
      binding.variable.resolvedType,
    ]),
    [
      [
        "fills.0.color",
        "token/color/id-636f6c6f722e6272616e64",
        "COLOR",
      ],
      ["type.fontSize", "token/float/id-73697a652e3136", "FLOAT"],
      ["type.lineHeight.value", "token/float/id-73697a652e3136", "FLOAT"],
    ],
  );
  assert.deepEqual(
    normalizeFigmaUnit("letterSpacing", observed.letterSpacing, {
      allowAuto: false,
      allowPercent: true,
      allowPixels: true,
    }),
    { unit: "px", value: 0 },
  );
  assert.deepEqual(
    normalizeFigmaUnit("lineHeight", { unit: "PERCENT", value: 150 }, {
      allowAuto: true,
      allowPercent: true,
      allowPixels: true,
    }),
    { unit: "percent", value: 150 },
  );
  assert.deepEqual(
    normalizeFigmaUnit("lineHeight", { unit: "AUTO" }, {
      allowAuto: true,
      allowPercent: true,
      allowPixels: true,
    }),
    { unit: "auto" },
  );

  const scratch = fixture.provenance.readOnlyFigmaInspection;
  const scratchVariables: LocalVariableRecord[] = scratch.variables.map(
    (variable: Record<string, unknown>) => ({
      id: variable.id as string,
      name: variable.name as string,
      resolvedType: variable.resolvedType as "COLOR" | "FLOAT",
      collectionId: variable.variableCollectionId as string,
      collectionName: variable.variableCollectionName as string,
      remote: false,
    }),
  );
  assert.deepEqual(
    normalizeFigmaBindings({
      nodeBoundVariables: scratch.example.boundVariables,
      fills: scratch.example.paintBindings.map(
        (paint: { boundVariables: Record<string, unknown> }) => paint,
      ),
      variableTable: scratchVariables,
    }).map(({ field }) => field),
    ["fills.0.color", "type.fontSize"],
  );
  assert.deepEqual(
    normalizeFigmaUnit("letterSpacing", scratch.example.letterSpacing, {
      allowAuto: false,
      allowPercent: true,
      allowPixels: true,
    }),
    { unit: "percent", value: 0 },
  );
});

test("direct, paint-level, string, boolean, and missing bindings normalize", () => {
  assert.deepEqual(
    normalizeFigmaBindings({
      nodeBoundVariables: {
        itemSpacing: alias("float"),
        characters: alias("string"),
        visible: alias("boolean"),
        fills: [alias("color")],
        missing: undefined,
      },
      fills: [{ boundVariables: { color: alias("color") } }],
      variableTable: variables,
    }).map(({ field }) => field),
    [
      "characters",
      "fills.0.color",
      "layout.itemSpacing",
      "visible",
    ],
  );
});

test("normalizer refuses unknown, mixed, stale, duplicate, incompatible, and partial shapes", () => {
  const plants: Array<[RegExp, () => unknown]> = [
    [
      /unknown binding shape/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: { fills: [{ ...alias("color"), extra: true }] },
          variableTable: variables,
        }),
    ],
    [
      /MIXED/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: { fills: SERIALIZED_FIGMA_MIXED },
          variableTable: variables,
        }),
    ],
    [
      /stale variable id/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: { fills: [alias("stale")] },
          variableTable: variables,
        }),
    ],
    [
      /duplicate alias/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: { fills: [alias("color")] },
          fills: [{ boundVariables: { color: alias("color-other") } }],
          variableTable: variables,
        }),
    ],
    [
      /requires COLOR, received FLOAT/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: { fills: [alias("float")] },
          variableTable: variables,
        }),
    ],
    [
      /partial mixed ranges/,
      () =>
        normalizeFigmaBindings({
          nodeBoundVariables: {
            fontSize: [alias("float"), alias("float")],
          },
          variableTable: variables,
        }),
    ],
    [
      /MIXED value/,
      () =>
        normalizeFigmaUnit("letterSpacing", SERIALIZED_FIGMA_MIXED, {
          allowAuto: false,
          allowPercent: true,
          allowPixels: true,
        }),
    ],
    [
      /unknown unit object/,
      () =>
        normalizeFigmaUnit("letterSpacing", { unit: "EM", value: 1 }, {
          allowAuto: false,
          allowPercent: true,
          allowPixels: true,
        }),
    ],
  ];
  for (const [pattern, run] of plants) assert.throws(run, pattern);
});

test("phase journal detects tampering, phase reorder, and broken hash chains", () => {
  const preflight = createInputLiveV4JournalEntry(1, "preflight", {
    target: "Scratch",
  });
  const writer = createInputLiveV4JournalEntry(
    1,
    "writer-result",
    { ids: ["1:2"] },
    preflight,
  );
  assert.deepEqual(validateInputLiveV4Journal([preflight, writer]), []);
  const tampered = structuredClone(writer);
  tampered.payload = { ids: ["forged"] };
  assert.match(
    validateInputLiveV4Journal([preflight, tampered]).join("\n"),
    /payload hash/,
  );
  assert.throws(
    () =>
      createInputLiveV4JournalEntry(
        1,
        "host-normalization",
        {},
        preflight,
      ),
    /phase reorder/,
  );
  const broken = structuredClone(writer);
  broken.previousEntrySha256 = "0".repeat(64);
  assert.match(
    validateInputLiveV4Journal([preflight, broken]).join("\n"),
    /broken previous hash/,
  );
});

const writerResult = (): InputLiveV4WriterOwnership => ({
  pageId: "1:1",
  setIds: ["1:2", "1:3"],
  sectionIds: ["1:4"],
  collectionIds: ["VariableCollectionId:1:5", "VariableCollectionId:1:6"],
  createdNodeIds: ["1:1", "1:2", "1:3", "1:4"],
  counts: { sources: 2, variants: 256, collections: 2, nodes: 4 },
});

const passingPipeline = (
  hooks: {
    gate?: string;
    capture?: () => void;
    cleanup?: (writer: InputLiveV4WriterOwnership) => unknown;
  } = {},
): InputLiveV4Pipeline => ({
  preflight: async () => ({ exactTarget: true }),
  write: async () => writerResult(),
  extractRawScene: async () => ({ scene: { nodes: 1 }, variableTable: variables }),
  normalizeHost: async (raw) => ({ raw }),
  accountAndInvert: async () => ({
    accounting: hooks.gate === "accounting" ? false : true,
    fixedPoint: hooks.gate === "fixedPoint" ? false : true,
  }),
  probeUsability: async () =>
    Object.fromEntries(
      [
        "usability",
        "restoration",
        "clipping",
        "overlap",
        "adornmentContent",
        "stateSemantics",
      ].map((gate) => [gate, hooks.gate === gate ? false : true]),
    ),
  captureAndScore: async () => {
    hooks.capture?.();
    return { captures: 128, objectiveRows: 128 };
  },
  cleanup: async (writer) =>
    hooks.cleanup?.(writer) ?? {
      complete: true,
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
    },
});

test("capture/export cannot run before every technical gate", async () => {
  for (const gate of [
    "accounting",
    "fixedPoint",
    "usability",
    "restoration",
    "clipping",
    "overlap",
    "adornmentContent",
    "stateSemantics",
  ]) {
    const directory = mkdtempSync(path.join(os.tmpdir(), "input-v4-gate-"));
    let captures = 0;
    const result = await executeInputLiveV4Pipeline(
      1,
      directory,
      passingPipeline({ gate, capture: () => captures++ }),
    );
    assert.equal(captures, 0, gate);
    assert.match(result.error ?? "", /captures forbidden/, gate);
    assert.equal(result.journal.entries.at(-1)?.phase, "retention-and-cleanup");
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cleanup reads persisted writer IDs and incomplete cleanup fails closed", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-v4-cleanup-"));
  const inMemory = writerResult();
  let cleanedPage = "";
  const pipeline = passingPipeline({
    cleanup: (writer) => {
      cleanedPage = writer.pageId;
      return {
        complete: true,
        requestedNodeIds: [writer.pageId],
        removedNodeIds: [writer.pageId],
        requestedCollectionIds: writer.collectionIds,
        removedCollectionIds: writer.collectionIds,
        remainingOwnedNodes: 0,
        remainingOwnedCollections: 0,
      };
    },
  });
  pipeline.write = async () => inMemory;
  pipeline.normalizeHost = async (raw) => {
    inMemory.pageId = "forged-after-persist";
    return raw;
  };
  const result = await executeInputLiveV4Pipeline(1, directory, pipeline);
  assert.equal(result.completed, true);
  assert.equal(cleanedPage, "1:1");
  rmSync(directory, { recursive: true, force: true });

  const incomplete = mkdtempSync(path.join(os.tmpdir(), "input-v4-incomplete-"));
  const failed = await executeInputLiveV4Pipeline(
    1,
    incomplete,
    passingPipeline({
      cleanup: () => ({
        complete: false,
        requestedNodeIds: [],
        removedNodeIds: [],
        requestedCollectionIds: [],
        removedCollectionIds: [],
        remainingOwnedNodes: 1,
        remainingOwnedCollections: 0,
      }),
    }),
  );
  assert.match(failed.cleanupError ?? "", /cleanup incomplete/);
  rmSync(incomplete, { recursive: true, force: true });
});

test("zero-count writer or raw scene can never become success", async () => {
  for (const phase of ["writer", "raw"] as const) {
    const directory = mkdtempSync(path.join(os.tmpdir(), "input-v4-zero-"));
    const pipeline = passingPipeline();
    if (phase === "writer")
      pipeline.write = async () => ({
        ...writerResult(),
        createdNodeIds: [],
        counts: { sources: 2, variants: 256, collections: 2, nodes: 0 },
      });
    else
      pipeline.extractRawScene = async () => ({ scene: {}, variableTable: [] });
    const result = await executeInputLiveV4Pipeline(1, directory, pipeline);
    assert.equal(result.completed, false);
    assert.match(
      `${result.error}\n${result.cleanupError}`,
      /zero|invalid IDs/,
    );
    rmSync(directory, { recursive: true, force: true });
  }
});

test("v4 keeps portable UTF-8 and generated readonly descendant recovery gates", () => {
  assert.match(FIGMA_PORTABLE_RUNTIME, /runtimeDecodeUtf8/);
  const runtime = buildFigmaSceneReadbackRuntime("ds.contracts.input.recipe.v4");
  assert.match(runtime, /SCENE-DERIVED-IDENTITY-UNEXPECTED/);
  assert.match(runtime, /generatedContext/);
  const raw = buildInputLiveV4RawPropertyRuntime();
  assert.match(raw, /getLocalVariablesAsync/);
  assert.match(raw, /getLocalVariableCollectionsAsync/);
  assert.match(raw, /rawBoundVariables/);
  assert.match(raw, /letterSpacing/);
});

const preflight = (): InputLiveV4PreflightState => ({
  clean: true,
  codeCommit: "code",
  antecedentCommit: "antecedent",
  antecedentCommitted: true,
  antecedentIsAncestor: true,
  publishedDescendant: true,
  authorizationArtifactExists: true,
  authorizationCommit: "authorization",
  authorizationIsAncestor: true,
  target: {
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    connectedExactTargetCount: 1,
  },
  attempt: { requested: 1, completed: [], maximum: 3 },
  plan: {
    sources: 2,
    variants: 256,
    sceneFacts: 43_726,
    variables: 10,
    objectiveCells: 128,
  },
});

test("preflight rejects dirty/old commits, wrong file key, and zero counts", () => {
  const plants: Array<[RegExp, (value: InputLiveV4PreflightState) => void]> = [
    [/dirty tree/, (value) => (value.clean = false)],
    [/old or not a clean published descendant/, (value) => (value.publishedDescendant = false)],
    [/wrong file key/, (value) => (value.target.fileKey = "wrong")],
    [/zero-count/, (value) => (value.plan.sceneFacts = 0)],
    [/authorization missing/, (value) => (value.authorizationArtifactExists = false)],
  ];
  assert.deepEqual(validateInputLiveV4Preflight(preflight()), []);
  for (const [pattern, plant] of plants) {
    const value = preflight();
    plant(value);
    assert.match(validateInputLiveV4Preflight(value).join("\n"), pattern);
  }
});

test("v4 protocol is a separate unauthorized draft with unchanged thresholds", () => {
  const { protocol } = readInputLiveV4Protocol();
  assert.equal(protocol.status, INPUT_LIVE_V4_STATUS);
  assert.equal(protocol.authorization.authorized, false);
  assert.equal(protocol.criteria.humanGate.status, "pending");
  assert.deepEqual(validateInputLiveV4Protocol(protocol), []);
});
