import assert from "node:assert/strict";
import {
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import {
  acceptInputLiveV15Response,
  createInputLiveV15FakeDynamicResponse,
  createInputLiveV15Transaction,
  INPUT_LIVE_V15_DYNAMIC_TOOL,
  INPUT_LIVE_V15_SIGNED_WRITER_TIMEOUT_MS,
  INPUT_LIVE_V15_TARGET,
  inputLiveV15ReceiptPath,
  inputLiveV15RequestPath,
  inputLiveV15ResponsePath,
  inputLiveV15Sha256,
  issueInputLiveV15Request,
  listInputLiveV15PersistedRequests,
  persistInputLiveV15RawResponse,
  persistInputLiveV15TechnicalGates,
  validateInputLiveV15Receipt,
  validateInputLiveV15Request,
  type InputLiveV15RemotePhase,
  type InputLiveV15Request,
  type InputLiveV15TransactionAuthorization,
} from "./input-field-live-v15-broker.js";
import {
  assertInputLiveV15CaptureResponses,
  assertInputLiveV15RootProofs,
  evaluateInputLiveV15Objective,
  inputLiveV15CaptureManifestSha256,
  validateInputLiveV15CaptureManifest,
  validateInputLiveV15CapturePayload,
  validateInputLiveV15CleanupPayload,
  validateInputLiveV15ExtractPayload,
  validateInputLiveV15ProbePayload,
  validateInputLiveV15RestorePayload,
  validateInputLiveV15WriterPayload,
  type InputLiveV15CaptureCell,
  type InputLiveV15CapturePayload,
  type InputLiveV15ExtractPayload,
  type InputLiveV15ProbePayload,
  type InputLiveV15RestorePayload,
  type InputLiveV15RootProof,
  type InputLiveV15WriterOwnership,
} from "./input-field-live-v15-contract.js";
import {
  InputLiveV15Orchestrator,
  simulatedInputLiveV15Authorization,
} from "./run-input-field-live-v15.js";

const simulatedAuthorization = (
  privateKey: KeyObject,
): InputLiveV15TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: inputLiveV15Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      {
        type: "spki",
        format: "der",
      },
    ),
  ),
});

const captures: InputLiveV15CaptureCell[] = Array.from(
  { length: 128 },
  (_, index) => {
    const source = index < 64 ? ("mui" as const) : ("polaris" as const);
    const state = ["default", "focus-visible", "error", "disabled"][index % 4]!;
    const adornment = ["none", "leading", "trailing", "both"][index % 4]!;
    return {
      index,
      cellKey: `${source}/cell-${String(index).padStart(3, "0")}`,
      source,
      adapterIdentity:
        source === "mui"
          ? "material-text-field-reviewed-v1"
          : "commerce-text-field-reviewed-v1",
      axes: {
        size: index % 2 ? "medium" : "small",
        state,
        content: index % 2 ? "value" : "placeholder",
        required: index % 2 ? "true" : "false",
        adornments: adornment,
      },
      strata: { source, state, adornment },
      reference: {
        path: `recipe/evidence/input-field-comparison-v3/source-reference/${index}.png`,
        sha256: inputLiveV15Sha256(`reference-${index}`),
        width: 486,
        height: 240,
        contentBox: { width: 240, height: 64 },
      },
      legacy: { geometry: 0.2, perceptual: 0.2, pixelInk: 0.2 },
    };
  },
);
validateInputLiveV15CaptureManifest(captures);

const fixture = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-live-v15-"));
  const { privateKey } = generateKeyPairSync("ed25519");
  createInputLiveV15Transaction(directory, privateKey, {
    authorization: simulatedAuthorization(privateKey),
    proofPlanSha256: "9".repeat(64),
    captureManifestSha256: inputLiveV15CaptureManifestSha256(captures),
    transactionId: "00000000-0000-4000-8000-000000000006",
    now: "2026-08-27T12:00:00.000Z",
  });
  return { directory, privateKey };
};

const rawResponse = (
  request: InputLiveV15Request,
  payload: unknown,
  overrides?: Parameters<typeof createInputLiveV15FakeDynamicResponse>[2],
): string =>
  JSON.stringify(
    createInputLiveV15FakeDynamicResponse(request, payload, overrides),
  );

const issueAndAccept = <T>(
  directory: string,
  privateKey: KeyObject,
  phase: InputLiveV15RemotePhase,
  payload: unknown,
  options: {
    captureIndex?: number;
    validate?: (payload: unknown, rawBytes: number) => T;
  } = {},
) => {
  const request = issueInputLiveV15Request(
    directory,
    privateKey,
    phase,
    `return ${JSON.stringify(payload)};`,
    { captureIndex: options.captureIndex },
  );
  assert.deepEqual(request.expectedDynamicTool, INPUT_LIVE_V15_DYNAMIC_TOOL);
  assert.deepEqual(request.target, INPUT_LIVE_V15_TARGET);
  persistInputLiveV15RawResponse(
    directory,
    phase,
    rawResponse(request, payload),
    options.captureIndex,
  );
  const accepted = acceptInputLiveV15Response<T>(directory, phase, {
    captureIndex: options.captureIndex,
    validate: options.validate,
  });
  validateInputLiveV15Receipt(directory, phase, options.captureIndex);
  return { request, accepted };
};

const writerPayload = () => ({
  pageId: "1:1",
  pageName: "Recipe Pivot / Input Field / v8",
  runIdentity: "input-live-v15",
  createdNodeIds: ["1:2", "1:3", "1:4"],
  sources: [
    {
      adapterIdentity: "material-text-field-reviewed-v1",
      setId: "1:10",
      sectionId: "1:11",
      collectionId: "VariableCollectionId:1:12",
      variableCount: 75,
      variantCount: 128,
      cellCount: 128,
      recipeHash: "a".repeat(64),
      envelopeHash: "b".repeat(64),
    },
    {
      adapterIdentity: "commerce-text-field-reviewed-v1",
      setId: "1:20",
      sectionId: "1:21",
      collectionId: "VariableCollectionId:1:22",
      variableCount: 77,
      variantCount: 128,
      cellCount: 128,
      recipeHash: "c".repeat(64),
      envelopeHash: "d".repeat(64),
    },
  ],
});

const rawRoot = (name: string) => ({
  ownershipKey: "root",
  type: "FRAME" as const,
  name,
  semanticRole: "input-field/root",
  width: 320,
  height: 96,
  visible: true,
  opacity: 1,
  layoutMode: "VERTICAL" as const,
  layoutSizingHorizontal: "FIXED" as const,
  layoutSizingVertical: "HUG" as const,
  rawBoundVariables: {},
  rawPaintBindings: { fills: [], strokes: [], effects: [] },
  children: [],
});

const restorePayload = (
  ownership: InputLiveV15WriterOwnership,
): InputLiveV15RestorePayload => ({
  pageId: ownership.pageId,
  setIds: [...ownership.setIds].sort(),
  restoredCount: 256,
  fixedBefore: 24,
  hiddenRevealedForFill: 24,
  retriedForFill: 0,
  contentFillAfter: true,
  marker: "INPUT-TEXT-FILL-MEASURE-VISIBLE",
});

const extractPayload = (
  ownership: InputLiveV15WriterOwnership,
): InputLiveV15ExtractPayload => ({
  pageId: ownership.pageId,
  roots: [
    {
      source: "mui",
      adapterIdentity: "material-text-field-reviewed-v1",
      setId: ownership.setIds[0],
      scene: rawRoot("MUI"),
      lineage: [
        {
          nodeId: ownership.setIds[0],
          parentNodeId: null,
          type: "COMPONENT_SET",
          explicitOwnershipKey: "root",
          mainComponentId: null,
          mainComponentRef: null,
        },
      ],
    },
    {
      source: "polaris",
      adapterIdentity: "commerce-text-field-reviewed-v1",
      setId: ownership.setIds[1],
      scene: rawRoot("Polaris"),
      lineage: [
        {
          nodeId: ownership.setIds[1],
          parentNodeId: null,
          type: "COMPONENT_SET",
          explicitOwnershipKey: "root",
          mainComponentId: null,
          mainComponentRef: null,
        },
      ],
    },
  ],
  variableTable: [
    {
      id: "VariableID:1",
      name: "token/float/id-73697a652e3136",
      resolvedType: "FLOAT",
      collectionId: ownership.collectionIds[0],
      collectionName: "Input v8",
      remote: false,
    },
  ],
});

const probePayload = (
  ownership: InputLiveV15WriterOwnership,
): InputLiveV15ProbePayload => ({
  pageId: ownership.pageId,
  sources: ["mui", "polaris"].map((source) => ({
    source: source as "mui" | "polaris",
    adapterIdentity:
      source === "mui"
        ? "material-text-field-reviewed-v1"
        : "commerce-text-field-reviewed-v1",
    variants: 128 as const,
    visitedVariants: 128 as const,
    reflowPassed: true,
    contentFillPassed: true,
    bindingCompatibilityPassed: true,
    noFakeLayoutPassed: true,
    adornmentPayloadPassed: true,
    stateSemanticsPassed: true,
    switchingRestored: true,
    textPropertiesRestored: true,
    exactSceneRestoration: true,
  })),
  cells: Array.from({ length: 256 }, (_, index) => ({
    source: index < 128 ? ("mui" as const) : ("polaris" as const),
    adapterIdentity:
      index < 128
        ? "material-text-field-reviewed-v1"
        : "commerce-text-field-reviewed-v1",
    cellKey: `variant-${index}`,
    rolesExact: true,
    stateSemanticsExact: true,
    adornmentPayloadExact: true,
    noFakeLayout: true,
    visibleAreaLoss: 0,
    overlapPixels: 0,
  })),
});

const rootProofs = (): InputLiveV15RootProof[] =>
  ["mui", "polaris"].map((source) => {
    const comparison = {
      ok: true,
      denominator: 1,
      matched: 1,
      codeOnly: 0,
      refused: 0,
      silent: 0,
      missing: [],
      extra: [],
      mismatched: [],
      duplicateCollapsed: [],
      unobserved: [],
      failures: [],
    };
    return {
      source: source as "mui" | "polaris",
      adapterIdentity:
        source === "mui"
          ? "material-text-field-reviewed-v1"
          : "commerce-text-field-reviewed-v1",
      accounting: comparison,
      fixedPoint: {
        stable: true,
        sourceIrRead: false,
        cycle1SceneIrSha256: "a".repeat(64),
        cycle2SceneIrSha256: "a".repeat(64),
        cycle1CompiledIrSha256: "b".repeat(64),
        cycle2CompiledIrSha256: "b".repeat(64),
        cycle1Comparison: comparison,
        cycle2Comparison: comparison,
      },
    };
  });

const capturePayload = (
  cell: InputLiveV15CaptureCell,
): InputLiveV15CapturePayload => {
  const bytes = Buffer.from(`input-live-v15-${cell.index}`);
  return {
    index: cell.index,
    cellKey: cell.cellKey,
    source: cell.source,
    strata: cell.strata,
    referenceSha256: cell.reference.sha256,
    frameWidth: cell.reference.width / 2,
    frameHeight: cell.reference.height / 2,
    componentWidth: 240,
    componentHeight: 64,
    pngBytes: bytes.byteLength,
    pngSha256: inputLiveV15Sha256(bytes),
    pngBase64: bytes.toString("base64"),
    temporaryNodesRemaining: 0,
  };
};

test("same signed fake-operator path completes two roots and 128 ordered captures", () => {
  const { directory, privateKey } = fixture();
  try {
    const writer = issueAndAccept(
      directory,
      privateKey,
      "writer",
      writerPayload(),
      { validate: validateInputLiveV15WriterPayload },
    ).accepted.payload;
    const cleanupRequest = issueInputLiveV15Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    assert.equal(cleanupRequest.sequence, 2);
    assert.equal(cleanupRequest.previousAcceptedReceiptSha256?.length, 64);
    assert.ok(readFileSync(inputLiveV15RequestPath(directory, "cleanup")));

    issueAndAccept(directory, privateKey, "restore", restorePayload(writer), {
      validate: (payload) =>
        validateInputLiveV15RestorePayload(payload, writer),
    });
    issueAndAccept(directory, privateKey, "extract", extractPayload(writer), {
      validate: (payload) =>
        validateInputLiveV15ExtractPayload(payload, writer),
    });
    const probe = issueAndAccept(
      directory,
      privateKey,
      "probe",
      probePayload(writer),
      {
        validate: (payload) =>
          validateInputLiveV15ProbePayload(payload, writer),
      },
    );
    const proofs = rootProofs();
    assertInputLiveV15RootProofs(proofs);
    persistInputLiveV15TechnicalGates(
      directory,
      proofs,
      probe.accepted.receipt.payloadSha256,
    );

    const acceptedCaptures: InputLiveV15CapturePayload[] = [];
    for (const cell of captures) {
      const payload = capturePayload(cell);
      acceptedCaptures.push(
        issueAndAccept(directory, privateKey, "capture", payload, {
          captureIndex: cell.index,
          validate: (value, rawBytes) =>
            validateInputLiveV15CapturePayload(value, cell, rawBytes),
        }).accepted.payload,
      );
    }
    assertInputLiveV15CaptureResponses(captures, acceptedCaptures);

    const cleanupPayload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV15RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanupRequest, cleanupPayload),
    );
    acceptInputLiveV15Response(directory, "cleanup", {
      validate: (payload) =>
        validateInputLiveV15CleanupPayload(payload, writer),
    });
    assert.equal(listInputLiveV15PersistedRequests(directory).length, 133);
    assert.ok(inputLiveV15ReceiptPath(directory, "capture", 127));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("offline objective evaluates every locked cell without sample reduction", () => {
  const png = new PNG({ width: 4, height: 4 });
  png.data.fill(255);
  png.data[0] = 0;
  png.data[1] = 0;
  png.data[2] = 0;
  const bytes = PNG.sync.write(png);
  const manifest = captures.map((cell) => ({
    ...cell,
    reference: {
      ...cell.reference,
      sha256: inputLiveV15Sha256(bytes),
      width: 4,
      height: 4,
      contentBox: { width: 1, height: 1 },
    },
  }));
  const responses = manifest.map((cell) => ({
    ...capturePayload(cell),
    componentWidth: 1,
    componentHeight: 1,
    pngBytes: bytes.byteLength,
    pngSha256: inputLiveV15Sha256(bytes),
    pngBase64: bytes.toString("base64"),
  }));
  const report = evaluateInputLiveV15Objective(
    manifest,
    responses,
    () => bytes,
    () => bytes,
  );
  assert.equal(report.denominator, 128);
  assert.equal(report.rows.length, 128);
  assert.equal(report.technicalPassed, true);
  assert.deepEqual(report.stratumRegressions, []);
  assert.deepEqual(report.catastrophicCells, []);
});

test("replay, wrong sequence, target, and dynamic tool fail closed", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV15Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV15Request(directory, {
          ...request,
          sequence: 9,
        }),
      /signature\/sequence\/target mismatch/,
    );
    assert.throws(
      () =>
        validateInputLiveV15Request(directory, {
          ...request,
          expectedDynamicTool: {
            namespace: "wrong",
            tool: "wrong",
          } as unknown as typeof INPUT_LIVE_V15_DYNAMIC_TOOL,
        }),
      /signature\/sequence\/target mismatch/,
    );
    persistInputLiveV15RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: { ...INPUT_LIVE_V15_TARGET, fileKey: "wrong" },
      }),
    );
    assert.throws(
      () => acceptInputLiveV15Response(directory, "writer"),
      /binding\/target mismatch/,
    );
    assert.throws(
      () =>
        persistInputLiveV15RawResponse(
          directory,
          "writer",
          rawResponse(request, writerPayload()),
        ),
      /replay refused/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("request tamper, response tamper, and signing-key substitution are rejected", () => {
  const first = fixture();
  try {
    const request = issueInputLiveV15Request(
      first.directory,
      first.privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV15Request(first.directory, {
          ...request,
          arguments: {
            ...request.arguments,
            code: `${request.arguments.code} `,
          },
        }),
      /hash\/signature/,
    );
  } finally {
    rmSync(first.directory, { recursive: true, force: true });
  }

  const second = fixture();
  try {
    const replacement = generateKeyPairSync("ed25519").privateKey;
    assert.throws(
      () =>
        issueInputLiveV15Request(
          second.directory,
          replacement,
          "writer",
          "return {};",
        ),
      /hash\/signature/,
    );
  } finally {
    rmSync(second.directory, { recursive: true, force: true });
  }

  const third = fixture();
  try {
    issueAndAccept(
      third.directory,
      third.privateKey,
      "writer",
      writerPayload(),
      { validate: validateInputLiveV15WriterPayload },
    );
    const responseFile = inputLiveV15ResponsePath(third.directory, "writer");
    const response = JSON.parse(readFileSync(responseFile, "utf8"));
    response.result.payload.pageId = "tampered";
    writeFileSync(responseFile, JSON.stringify(response));
    assert.throws(
      () => validateInputLiveV15Receipt(third.directory, "writer"),
      /invalid Input live v12 accepted receipt/,
    );
  } finally {
    rmSync(third.directory, { recursive: true, force: true });
  }
});

test("bounded transport rejects truncation and capture remains premature before gates", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV15Request(
      directory,
      privateKey,
      "writer",
      "return {};",
      {
        expectedResponse: {
          schema: "test",
          cardinality: { objects: 1 },
          maximumRawResponseBytes: 10,
        },
      },
    );
    assert.throws(
      () =>
        persistInputLiveV15RawResponse(
          directory,
          "writer",
          rawResponse(request, {}),
        ),
      /exceeds bounded transport/,
    );
    assert.throws(
      () =>
        issueInputLiveV15Request(
          directory,
          privateKey,
          "capture",
          "return {};",
          { captureIndex: 0 },
        ),
      /technical gates|ENOENT/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("one-root omission and expected-plan accounting mismatch are rejected", () => {
  const ownership = validateInputLiveV15WriterPayload(writerPayload());
  const extract = extractPayload(ownership);
  assert.throws(
    () =>
      validateInputLiveV15ExtractPayload(
        { ...extract, roots: extract.roots.slice(0, 1) },
        ownership,
      ),
    /two-root mismatch/,
  );
  const proofs = rootProofs();
  proofs[0] = {
    ...proofs[0]!,
    accounting: {
      ...proofs[0]!.accounting,
      ok: false,
      matched: 0,
      silent: 1,
      missing: [
        {
          id: "root#width@0000",
          baseId: "root#width",
          nodeOwnershipKey: "root",
          channel: "width",
          occurrence: 0,
          value: 320,
          observedProperty: "width",
        },
      ],
    },
  };
  assert.throws(
    () => assertInputLiveV15RootProofs(proofs),
    /mui:missing=1.*silent=1/,
  );
});

test("persisted cleanup remains executable after phase crash and restart", () => {
  const { directory, privateKey } = fixture();
  try {
    const writer = issueAndAccept(
      directory,
      privateKey,
      "writer",
      writerPayload(),
      { validate: validateInputLiveV15WriterPayload },
    ).accepted.payload;
    const cleanup = issueInputLiveV15Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    // Simulate the host dying before extraction. Only persisted broker files survive.
    const persisted = JSON.parse(
      readFileSync(inputLiveV15RequestPath(directory, "cleanup"), "utf8"),
    ) as InputLiveV15Request;
    validateInputLiveV15Request(directory, persisted);
    const payload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV15RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanup, payload),
    );
    assert.doesNotThrow(() =>
      acceptInputLiveV15Response(directory, "cleanup", {
        validate: (value) => validateInputLiveV15CleanupPayload(value, writer),
      }),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable orchestrator resumes with active restore and surfaced cleanup", () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "input-live-v15-state-"),
  );
  const privateKey = generateKeyPairSync("ed25519").privateKey;
  try {
    const orchestrator = InputLiveV15Orchestrator.initialize({
      root: process.cwd(),
      transactionDirectory: directory,
      privateKey,
      authorization: simulatedInputLiveV15Authorization(privateKey),
      attempt: 1,
      transactionId: "00000000-0000-4000-8000-000000000066",
      now: "2026-08-27T12:00:00.000Z",
    });
    const writerRequest = requestFrom(
      orchestrator.nextAction().activeRequestPath!,
    );
    const afterWriter = orchestrator.ingestAndAdvance(
      rawResponse(writerRequest, writerPayload()),
    );
    assert.match(afterWriter.activeRequestPath ?? "", /restore/);
    assert.match(afterWriter.cleanupRequestPath ?? "", /cleanup/);

    const resumed = InputLiveV15Orchestrator.resume({
      root: process.cwd(),
      transactionDirectory: directory,
      privateKey,
    }).nextAction();
    assert.equal(resumed.status, "awaiting-external-response");
    assert.equal(resumed.activeRequestPath, afterWriter.activeRequestPath);
    assert.equal(resumed.cleanupRequestPath, afterWriter.cleanupRequestPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("antecedent result leakage is rejected without inventing outcomes", () => {
  const { directory } = fixture();
  try {
    const manifestPath = path.join(directory, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.outcome = "pass";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    assert.throws(
      () =>
        validateInputLiveV15Request(
          directory,
          JSON.parse(
            JSON.stringify({
              artifactVersion: "input-live-v15-broker-request-v2",
            }),
          ),
        ),
      /result leakage/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("signed writer timeout is 300000 and empty code is refused", () => {
  const timeoutFixture = fixture();
  try {
    const request = issueInputLiveV15Request(
      timeoutFixture.directory,
      timeoutFixture.privateKey,
      "writer",
      "return {};",
    );
    assert.equal(
      request.arguments.timeout,
      INPUT_LIVE_V15_SIGNED_WRITER_TIMEOUT_MS,
    );
    assert.equal(INPUT_LIVE_V15_SIGNED_WRITER_TIMEOUT_MS, 300_000);
  } finally {
    rmSync(timeoutFixture.directory, { recursive: true, force: true });
  }
  const empty = fixture();
  try {
    assert.throws(
      () =>
        issueInputLiveV15Request(
          empty.directory,
          empty.privateKey,
          "writer",
          "",
        ),
      /empty code envelope refused/,
    );
  } finally {
    rmSync(empty.directory, { recursive: true, force: true });
  }
});

test("fileContext may omit editorType when Scratch fileKey and fileName match", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV15Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    persistInputLiveV15RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: {
          fileKey: INPUT_LIVE_V15_TARGET.fileKey,
          fileName: INPUT_LIVE_V15_TARGET.fileName,
        },
      }),
    );
    const accepted = acceptInputLiveV15Response(directory, "writer");
    assert.equal(accepted.request.target.editorType, "figma");

    const second = fixture();
    try {
      const other = issueInputLiveV15Request(
        second.directory,
        second.privateKey,
        "writer",
        "return {};",
      );
      persistInputLiveV15RawResponse(
        second.directory,
        "writer",
        rawResponse(other, writerPayload(), {
          fileContext: { ...INPUT_LIVE_V15_TARGET, editorType: "figjam" },
        }),
      );
      assert.throws(
        () => acceptInputLiveV15Response(second.directory, "writer"),
        /binding\/target mismatch/,
      );
    } finally {
      rmSync(second.directory, { recursive: true, force: true });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const requestFrom = (file: string): InputLiveV15Request =>
  JSON.parse(readFileSync(file, "utf8")) as InputLiveV15Request;
