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
  acceptInputLiveV46Response,
  createInputLiveV46FakeDynamicResponse,
  createInputLiveV46Transaction,
  INPUT_LIVE_V46_DYNAMIC_TOOL,
  INPUT_LIVE_V46_SIGNED_WRITER_TIMEOUT_MS,
  INPUT_LIVE_V46_TARGET,
  inputLiveV46ReceiptPath,
  inputLiveV46RequestPath,
  inputLiveV46ResponsePath,
  inputLiveV46Sha256,
  issueInputLiveV46Request,
  listInputLiveV46PersistedRequests,
  persistInputLiveV46RawResponse,
  persistInputLiveV46TechnicalGates,
  validateInputLiveV46Receipt,
  validateInputLiveV46Request,
  type InputLiveV46RemotePhase,
  type InputLiveV46Request,
  type InputLiveV46TransactionAuthorization,
} from "./input-field-live-v46-broker.js";
import {
  assertInputLiveV46CaptureResponses,
  assertInputLiveV46RootProofs,
  evaluateInputLiveV46Objective,
  inputLiveV46CaptureManifestSha256,
  validateInputLiveV46CaptureManifest,
  validateInputLiveV46CapturePayload,
  validateInputLiveV46CleanupPayload,
  validateInputLiveV46ExtractPayload,
  validateInputLiveV46ProbePayload,
  validateInputLiveV46RestorePayload,
  validateInputLiveV46WriterPayload,
  type InputLiveV46CaptureCell,
  type InputLiveV46CapturePayload,
  type InputLiveV46ExtractPayload,
  type InputLiveV46ProbePayload,
  type InputLiveV46RestorePayload,
  type InputLiveV46RootProof,
  type InputLiveV46WriterOwnership,
} from "./input-field-live-v46-contract.js";
import {
  InputLiveV46Orchestrator,
  simulatedInputLiveV46Authorization,
} from "./run-input-field-live-v46.js";

const simulatedAuthorization = (
  privateKey: KeyObject,
): InputLiveV46TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
  signingPublicKeySha256: inputLiveV46Sha256(
    createPublicKey(privateKey.export({ type: "pkcs8", format: "pem" })).export(
      {
        type: "spki",
        format: "der",
      },
    ),
  ),
});

const captures: InputLiveV46CaptureCell[] = Array.from(
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
        sha256: inputLiveV46Sha256(`reference-${index}`),
        width: 486,
        height: 240,
        contentBox: { width: 240, height: 64 },
      },
      legacy: { geometry: 0.2, perceptual: 0.2, pixelInk: 0.2 },
    };
  },
);
validateInputLiveV46CaptureManifest(captures);

const fixture = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-live-v46-"));
  const { privateKey } = generateKeyPairSync("ed25519");
  createInputLiveV46Transaction(directory, privateKey, {
    authorization: simulatedAuthorization(privateKey),
    proofPlanSha256: "9".repeat(64),
    captureManifestSha256: inputLiveV46CaptureManifestSha256(captures),
    transactionId: "00000000-0000-4000-8000-000000000006",
    now: "2026-08-27T12:00:00.000Z",
  });
  return { directory, privateKey };
};

const rawResponse = (
  request: InputLiveV46Request,
  payload: unknown,
  overrides?: Parameters<typeof createInputLiveV46FakeDynamicResponse>[2],
): string =>
  JSON.stringify(
    createInputLiveV46FakeDynamicResponse(request, payload, overrides),
  );

const issueAndAccept = <T>(
  directory: string,
  privateKey: KeyObject,
  phase: InputLiveV46RemotePhase,
  payload: unknown,
  options: {
    captureIndex?: number;
    validate?: (payload: unknown, rawBytes: number) => T;
  } = {},
) => {
  const request = issueInputLiveV46Request(
    directory,
    privateKey,
    phase,
    `return ${JSON.stringify(payload)};`,
    { captureIndex: options.captureIndex },
  );
  assert.deepEqual(request.expectedDynamicTool, INPUT_LIVE_V46_DYNAMIC_TOOL);
  assert.deepEqual(request.target, INPUT_LIVE_V46_TARGET);
  persistInputLiveV46RawResponse(
    directory,
    phase,
    rawResponse(request, payload),
    options.captureIndex,
  );
  const accepted = acceptInputLiveV46Response<T>(directory, phase, {
    captureIndex: options.captureIndex,
    validate: options.validate,
  });
  validateInputLiveV46Receipt(directory, phase, options.captureIndex);
  return { request, accepted };
};

const writerPayload = () => ({
  pageId: "1:1",
  pageName: "Recipe Pivot / Input Field / v8",
  runIdentity: "input-live-v46",
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
  ownership: InputLiveV46WriterOwnership,
): InputLiveV46RestorePayload => ({
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
  ownership: InputLiveV46WriterOwnership,
): InputLiveV46ExtractPayload => ({
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
  ownership: InputLiveV46WriterOwnership,
): InputLiveV46ProbePayload => ({
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

const rootProofs = (): InputLiveV46RootProof[] =>
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
  cell: InputLiveV46CaptureCell,
): InputLiveV46CapturePayload => {
  const bytes = Buffer.from(`input-live-v46-${cell.index}`);
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
    pngSha256: inputLiveV46Sha256(bytes),
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
      { validate: validateInputLiveV46WriterPayload },
    ).accepted.payload;
    const cleanupRequest = issueInputLiveV46Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    assert.equal(cleanupRequest.sequence, 2);
    assert.equal(cleanupRequest.previousAcceptedReceiptSha256?.length, 64);
    assert.ok(readFileSync(inputLiveV46RequestPath(directory, "cleanup")));

    issueAndAccept(directory, privateKey, "restore", restorePayload(writer), {
      validate: (payload) =>
        validateInputLiveV46RestorePayload(payload, writer),
    });
    issueAndAccept(directory, privateKey, "extract", extractPayload(writer), {
      validate: (payload) =>
        validateInputLiveV46ExtractPayload(payload, writer),
    });
    const probe = issueAndAccept(
      directory,
      privateKey,
      "probe",
      probePayload(writer),
      {
        validate: (payload) =>
          validateInputLiveV46ProbePayload(payload, writer),
      },
    );
    const proofs = rootProofs();
    assertInputLiveV46RootProofs(proofs);
    persistInputLiveV46TechnicalGates(
      directory,
      proofs,
      probe.accepted.receipt.payloadSha256,
    );

    const acceptedCaptures: InputLiveV46CapturePayload[] = [];
    for (const cell of captures) {
      const payload = capturePayload(cell);
      acceptedCaptures.push(
        issueAndAccept(directory, privateKey, "capture", payload, {
          captureIndex: cell.index,
          validate: (value, rawBytes) =>
            validateInputLiveV46CapturePayload(value, cell, rawBytes),
        }).accepted.payload,
      );
    }
    assertInputLiveV46CaptureResponses(captures, acceptedCaptures);

    const cleanupPayload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV46RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanupRequest, cleanupPayload),
    );
    acceptInputLiveV46Response(directory, "cleanup", {
      validate: (payload) =>
        validateInputLiveV46CleanupPayload(payload, writer),
    });
    assert.equal(listInputLiveV46PersistedRequests(directory).length, 133);
    assert.ok(inputLiveV46ReceiptPath(directory, "capture", 127));
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
      sha256: inputLiveV46Sha256(bytes),
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
    pngSha256: inputLiveV46Sha256(bytes),
    pngBase64: bytes.toString("base64"),
  }));
  const report = evaluateInputLiveV46Objective(
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
    const request = issueInputLiveV46Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV46Request(directory, {
          ...request,
          sequence: 9,
        }),
      /signature\/sequence\/target mismatch/,
    );
    assert.throws(
      () =>
        validateInputLiveV46Request(directory, {
          ...request,
          expectedDynamicTool: {
            namespace: "wrong",
            tool: "wrong",
          } as unknown as typeof INPUT_LIVE_V46_DYNAMIC_TOOL,
        }),
      /signature\/sequence\/target mismatch/,
    );
    persistInputLiveV46RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: { ...INPUT_LIVE_V46_TARGET, fileKey: "wrong" },
      }),
    );
    assert.throws(
      () => acceptInputLiveV46Response(directory, "writer"),
      /binding\/target mismatch/,
    );
    assert.throws(
      () =>
        persistInputLiveV46RawResponse(
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
    const request = issueInputLiveV46Request(
      first.directory,
      first.privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV46Request(first.directory, {
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
        issueInputLiveV46Request(
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
      { validate: validateInputLiveV46WriterPayload },
    );
    const responseFile = inputLiveV46ResponsePath(third.directory, "writer");
    const response = JSON.parse(readFileSync(responseFile, "utf8"));
    response.result.payload.pageId = "tampered";
    writeFileSync(responseFile, JSON.stringify(response));
    assert.throws(
      () => validateInputLiveV46Receipt(third.directory, "writer"),
      /invalid Input live v12 accepted receipt/,
    );
  } finally {
    rmSync(third.directory, { recursive: true, force: true });
  }
});

test("bounded transport rejects truncation and capture remains premature before gates", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV46Request(
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
        persistInputLiveV46RawResponse(
          directory,
          "writer",
          rawResponse(request, {}),
        ),
      /exceeds bounded transport/,
    );
    assert.throws(
      () =>
        issueInputLiveV46Request(
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
  const ownership = validateInputLiveV46WriterPayload(writerPayload());
  const extract = extractPayload(ownership);
  assert.throws(
    () =>
      validateInputLiveV46ExtractPayload(
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
    () => assertInputLiveV46RootProofs(proofs),
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
      { validate: validateInputLiveV46WriterPayload },
    ).accepted.payload;
    const cleanup = issueInputLiveV46Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    // Simulate the host dying before extraction. Only persisted broker files survive.
    const persisted = JSON.parse(
      readFileSync(inputLiveV46RequestPath(directory, "cleanup"), "utf8"),
    ) as InputLiveV46Request;
    validateInputLiveV46Request(directory, persisted);
    const payload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV46RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanup, payload),
    );
    assert.doesNotThrow(() =>
      acceptInputLiveV46Response(directory, "cleanup", {
        validate: (value) => validateInputLiveV46CleanupPayload(value, writer),
      }),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable orchestrator resumes with active restore and surfaced cleanup", () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "input-live-v46-state-"),
  );
  const privateKey = generateKeyPairSync("ed25519").privateKey;
  try {
    const orchestrator = InputLiveV46Orchestrator.initialize({
      root: process.cwd(),
      transactionDirectory: directory,
      privateKey,
      authorization: simulatedInputLiveV46Authorization(privateKey),
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

    const resumed = InputLiveV46Orchestrator.resume({
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
        validateInputLiveV46Request(
          directory,
          JSON.parse(
            JSON.stringify({
              artifactVersion: "input-live-v46-broker-request-v2",
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
    const request = issueInputLiveV46Request(
      timeoutFixture.directory,
      timeoutFixture.privateKey,
      "writer",
      "return {};",
    );
    assert.equal(
      request.arguments.timeout,
      INPUT_LIVE_V46_SIGNED_WRITER_TIMEOUT_MS,
    );
    assert.equal(INPUT_LIVE_V46_SIGNED_WRITER_TIMEOUT_MS, 300_000);
  } finally {
    rmSync(timeoutFixture.directory, { recursive: true, force: true });
  }
  const empty = fixture();
  try {
    assert.throws(
      () =>
        issueInputLiveV46Request(
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
    const request = issueInputLiveV46Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    persistInputLiveV46RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: {
          fileKey: INPUT_LIVE_V46_TARGET.fileKey,
          fileName: INPUT_LIVE_V46_TARGET.fileName,
        },
      }),
    );
    const accepted = acceptInputLiveV46Response(directory, "writer");
    assert.equal(accepted.request.target.editorType, "figma");

    const second = fixture();
    try {
      const other = issueInputLiveV46Request(
        second.directory,
        second.privateKey,
        "writer",
        "return {};",
      );
      persistInputLiveV46RawResponse(
        second.directory,
        "writer",
        rawResponse(other, writerPayload(), {
          fileContext: { ...INPUT_LIVE_V46_TARGET, editorType: "figjam" },
        }),
      );
      assert.throws(
        () => acceptInputLiveV46Response(second.directory, "writer"),
        /binding\/target mismatch/,
      );
    } finally {
      rmSync(second.directory, { recursive: true, force: true });
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const requestFrom = (file: string): InputLiveV46Request =>
  JSON.parse(readFileSync(file, "utf8")) as InputLiveV46Request;
