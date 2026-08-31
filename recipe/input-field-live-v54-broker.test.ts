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
  acceptInputLiveV54Response,
  createInputLiveV54FakeDynamicResponse,
  createInputLiveV54Transaction,
  INPUT_LIVE_V54_DYNAMIC_TOOL,
  INPUT_LIVE_V54_SIGNED_WRITER_TIMEOUT_MS,
  INPUT_LIVE_V54_TARGET,
  inputLiveV54ReceiptPath,
  inputLiveV54RequestPath,
  inputLiveV54ResponsePath,
  inputLiveV54Sha256,
  issueInputLiveV54Request,
  listInputLiveV54PersistedRequests,
  persistInputLiveV54RawResponse,
  persistInputLiveV54TechnicalGates,
  validateInputLiveV54Receipt,
  validateInputLiveV54Request,
  type InputLiveV54RemotePhase,
  type InputLiveV54Request,
  type InputLiveV54TransactionAuthorization,
} from "./input-field-live-v54-broker.js";
import {
  assertInputLiveV54CaptureResponses,
  assertInputLiveV54RootProofs,
  evaluateInputLiveV54Objective,
  inputLiveV54CaptureManifestSha256,
  validateInputLiveV54CaptureManifest,
  validateInputLiveV54CapturePayload,
  validateInputLiveV54CleanupPayload,
  validateInputLiveV54ExtractPayload,
  validateInputLiveV54ProbePayload,
  validateInputLiveV54RestorePayload,
  validateInputLiveV54WriterPayload,
  type InputLiveV54CaptureCell,
  type InputLiveV54CapturePayload,
  type InputLiveV54ExtractPayload,
  type InputLiveV54ProbePayload,
  type InputLiveV54RestorePayload,
  type InputLiveV54RootProof,
  type InputLiveV54WriterOwnership,
} from "./input-field-live-v54-contract.js";
import {
  InputLiveV54Orchestrator,
  simulatedInputLiveV54Authorization,
} from "./run-input-field-live-v54.js";

const simulatedAuthorization = (
  privateKey: KeyObject,
): InputLiveV54TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: inputLiveV54Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      {
        type: "spki",
        format: "der",
      },
    ),
  ),
});

const captures: InputLiveV54CaptureCell[] = Array.from(
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
        sha256: inputLiveV54Sha256(`reference-${index}`),
        width: 486,
        height: 240,
        contentBox: { width: 240, height: 64 },
      },
      legacy: { geometry: 0.2, perceptual: 0.2, pixelInk: 0.2 },
    };
  },
);
validateInputLiveV54CaptureManifest(captures);

const fixture = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-live-v54-"));
  const { privateKey } = generateKeyPairSync("ed25519");
  createInputLiveV54Transaction(directory, privateKey, {
    authorization: simulatedAuthorization(privateKey),
    proofPlanSha256: "9".repeat(64),
    captureManifestSha256: inputLiveV54CaptureManifestSha256(captures),
    transactionId: "00000000-0000-4000-8000-000000000006",
    now: "2026-08-27T12:00:00.000Z",
  });
  return { directory, privateKey };
};

const rawResponse = (
  request: InputLiveV54Request,
  payload: unknown,
  overrides?: Parameters<typeof createInputLiveV54FakeDynamicResponse>[2],
): string =>
  JSON.stringify(
    createInputLiveV54FakeDynamicResponse(request, payload, overrides),
  );

const issueAndAccept = <T>(
  directory: string,
  privateKey: KeyObject,
  phase: InputLiveV54RemotePhase,
  payload: unknown,
  options: {
    captureIndex?: number;
    validate?: (payload: unknown, rawBytes: number) => T;
  } = {},
) => {
  const request = issueInputLiveV54Request(
    directory,
    privateKey,
    phase,
    `return ${JSON.stringify(payload)};`,
    { captureIndex: options.captureIndex },
  );
  assert.deepEqual(request.expectedDynamicTool, INPUT_LIVE_V54_DYNAMIC_TOOL);
  assert.deepEqual(request.target, INPUT_LIVE_V54_TARGET);
  persistInputLiveV54RawResponse(
    directory,
    phase,
    rawResponse(request, payload),
    options.captureIndex,
  );
  const accepted = acceptInputLiveV54Response<T>(directory, phase, {
    captureIndex: options.captureIndex,
    validate: options.validate,
  });
  validateInputLiveV54Receipt(directory, phase, options.captureIndex);
  return { request, accepted };
};

const writerPayload = () => ({
  pageId: "1:1",
  pageName: "Recipe Pivot / Input Field / v8",
  runIdentity: "input-live-v54",
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
  ownership: InputLiveV54WriterOwnership,
): InputLiveV54RestorePayload => ({
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
  ownership: InputLiveV54WriterOwnership,
): InputLiveV54ExtractPayload => ({
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
  ownership: InputLiveV54WriterOwnership,
): InputLiveV54ProbePayload => ({
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

const rootProofs = (): InputLiveV54RootProof[] =>
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
  cell: InputLiveV54CaptureCell,
): InputLiveV54CapturePayload => {
  const bytes = Buffer.from(`input-live-v54-${cell.index}`);
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
    pngSha256: inputLiveV54Sha256(bytes),
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
      { validate: validateInputLiveV54WriterPayload },
    ).accepted.payload;
    const cleanupRequest = issueInputLiveV54Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    assert.equal(cleanupRequest.sequence, 2);
    assert.equal(cleanupRequest.previousAcceptedReceiptSha256?.length, 64);
    assert.ok(readFileSync(inputLiveV54RequestPath(directory, "cleanup")));

    issueAndAccept(directory, privateKey, "restore", restorePayload(writer), {
      validate: (payload) =>
        validateInputLiveV54RestorePayload(payload, writer),
    });
    issueAndAccept(directory, privateKey, "extract", extractPayload(writer), {
      validate: (payload) =>
        validateInputLiveV54ExtractPayload(payload, writer),
    });
    const probe = issueAndAccept(
      directory,
      privateKey,
      "probe",
      probePayload(writer),
      {
        validate: (payload) =>
          validateInputLiveV54ProbePayload(payload, writer),
      },
    );
    const proofs = rootProofs();
    assertInputLiveV54RootProofs(proofs);
    persistInputLiveV54TechnicalGates(
      directory,
      proofs,
      probe.accepted.receipt.payloadSha256,
    );

    const acceptedCaptures: InputLiveV54CapturePayload[] = [];
    for (const cell of captures) {
      const payload = capturePayload(cell);
      acceptedCaptures.push(
        issueAndAccept(directory, privateKey, "capture", payload, {
          captureIndex: cell.index,
          validate: (value, rawBytes) =>
            validateInputLiveV54CapturePayload(value, cell, rawBytes),
        }).accepted.payload,
      );
    }
    assertInputLiveV54CaptureResponses(captures, acceptedCaptures);

    const cleanupPayload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV54RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanupRequest, cleanupPayload),
    );
    acceptInputLiveV54Response(directory, "cleanup", {
      validate: (payload) =>
        validateInputLiveV54CleanupPayload(payload, writer),
    });
    assert.equal(listInputLiveV54PersistedRequests(directory).length, 133);
    assert.ok(inputLiveV54ReceiptPath(directory, "capture", 127));
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
      sha256: inputLiveV54Sha256(bytes),
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
    pngSha256: inputLiveV54Sha256(bytes),
    pngBase64: bytes.toString("base64"),
  }));
  const report = evaluateInputLiveV54Objective(
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
    const request = issueInputLiveV54Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV54Request(directory, {
          ...request,
          sequence: 9,
        }),
      /signature\/sequence\/target mismatch/,
    );
    assert.throws(
      () =>
        validateInputLiveV54Request(directory, {
          ...request,
          expectedDynamicTool: {
            namespace: "wrong",
            tool: "wrong",
          } as unknown as typeof INPUT_LIVE_V54_DYNAMIC_TOOL,
        }),
      /signature\/sequence\/target mismatch/,
    );
    persistInputLiveV54RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: { ...INPUT_LIVE_V54_TARGET, fileKey: "wrong" },
      }),
    );
    assert.throws(
      () => acceptInputLiveV54Response(directory, "writer"),
      /binding\/target mismatch/,
    );
    assert.throws(
      () =>
        persistInputLiveV54RawResponse(
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
    const request = issueInputLiveV54Request(
      first.directory,
      first.privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV54Request(first.directory, {
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
        issueInputLiveV54Request(
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
      { validate: validateInputLiveV54WriterPayload },
    );
    const responseFile = inputLiveV54ResponsePath(third.directory, "writer");
    const response = JSON.parse(readFileSync(responseFile, "utf8"));
    response.result.payload.pageId = "tampered";
    writeFileSync(responseFile, JSON.stringify(response));
    assert.throws(
      () => validateInputLiveV54Receipt(third.directory, "writer"),
      /invalid Input live v12 accepted receipt/,
    );
  } finally {
    rmSync(third.directory, { recursive: true, force: true });
  }
});

test("bounded transport rejects truncation and capture remains premature before gates", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV54Request(
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
        persistInputLiveV54RawResponse(
          directory,
          "writer",
          rawResponse(request, {}),
        ),
      /exceeds bounded transport/,
    );
    assert.throws(
      () =>
        issueInputLiveV54Request(
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
  const ownership = validateInputLiveV54WriterPayload(writerPayload());
  const extract = extractPayload(ownership);
  assert.throws(
    () =>
      validateInputLiveV54ExtractPayload(
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
    () => assertInputLiveV54RootProofs(proofs),
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
      { validate: validateInputLiveV54WriterPayload },
    ).accepted.payload;
    const cleanup = issueInputLiveV54Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    // Simulate the host dying before extraction. Only persisted broker files survive.
    const persisted = JSON.parse(
      readFileSync(inputLiveV54RequestPath(directory, "cleanup"), "utf8"),
    ) as InputLiveV54Request;
    validateInputLiveV54Request(directory, persisted);
    const payload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV54RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanup, payload),
    );
    assert.doesNotThrow(() =>
      acceptInputLiveV54Response(directory, "cleanup", {
        validate: (value) => validateInputLiveV54CleanupPayload(value, writer),
      }),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable orchestrator resumes with active restore and surfaced cleanup", () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "input-live-v54-state-"),
  );
  const privateKey = generateKeyPairSync("ed25519").privateKey;
  try {
    const orchestrator = InputLiveV54Orchestrator.initialize({
      root: process.cwd(),
      transactionDirectory: directory,
      privateKey,
      authorization: simulatedInputLiveV54Authorization(privateKey),
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

    const resumed = InputLiveV54Orchestrator.resume({
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
        validateInputLiveV54Request(
          directory,
          JSON.parse(
            JSON.stringify({
              artifactVersion: "input-live-v54-broker-request-v2",
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
    const request = issueInputLiveV54Request(
      timeoutFixture.directory,
      timeoutFixture.privateKey,
      "writer",
      "return {};",
    );
    assert.equal(
      request.arguments.timeout,
      INPUT_LIVE_V54_SIGNED_WRITER_TIMEOUT_MS,
    );
    assert.equal(INPUT_LIVE_V54_SIGNED_WRITER_TIMEOUT_MS, 300_000);
  } finally {
    rmSync(timeoutFixture.directory, { recursive: true, force: true });
  }
  const empty = fixture();
  try {
    assert.throws(
      () =>
        issueInputLiveV54Request(
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
    const request = issueInputLiveV54Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    persistInputLiveV54RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: {
          fileKey: INPUT_LIVE_V54_TARGET.fileKey,
          fileName: INPUT_LIVE_V54_TARGET.fileName,
        },
      }),
    );
    const accepted = acceptInputLiveV54Response(directory, "writer");
    assert.equal(accepted.request.target.editorType, "figma");

    const second = fixture();
    try {
      const other = issueInputLiveV54Request(
        second.directory,
        second.privateKey,
        "writer",
        "return {};",
      );
      persistInputLiveV54RawResponse(
        second.directory,
        "writer",
        rawResponse(other, writerPayload(), {
          fileContext: { ...INPUT_LIVE_V54_TARGET, editorType: "figjam" },
        }),
      );
      assert.throws(
        () => acceptInputLiveV54Response(second.directory, "writer"),
        /binding\/target mismatch/,
      );
    } finally {
      rmSync(second.directory, { recursive: true, force: true });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const requestFrom = (file: string): InputLiveV54Request =>
  JSON.parse(readFileSync(file, "utf8")) as InputLiveV54Request;
