import assert from "node:assert/strict";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import {
  acceptInputLiveV6Response,
  createInputLiveV6FakeDynamicResponse,
  createInputLiveV6Transaction,
  INPUT_LIVE_V6_DYNAMIC_TOOL,
  INPUT_LIVE_V6_TARGET,
  inputLiveV6ReceiptPath,
  inputLiveV6RequestPath,
  inputLiveV6ResponsePath,
  inputLiveV6Sha256,
  issueInputLiveV6Request,
  listInputLiveV6PersistedRequests,
  persistInputLiveV6RawResponse,
  persistInputLiveV6TechnicalGates,
  validateInputLiveV6Receipt,
  validateInputLiveV6Request,
  type InputLiveV6RemotePhase,
  type InputLiveV6Request,
  type InputLiveV6TransactionAuthorization,
} from "./input-field-live-v6-broker.js";
import {
  assertInputLiveV6CaptureResponses,
  assertInputLiveV6RootProofs,
  evaluateInputLiveV6Objective,
  inputLiveV6CaptureManifestSha256,
  validateInputLiveV6CaptureManifest,
  validateInputLiveV6CapturePayload,
  validateInputLiveV6CleanupPayload,
  validateInputLiveV6ExtractPayload,
  validateInputLiveV6ProbePayload,
  validateInputLiveV6WriterPayload,
  type InputLiveV6CaptureCell,
  type InputLiveV6CapturePayload,
  type InputLiveV6ExtractPayload,
  type InputLiveV6ProbePayload,
  type InputLiveV6RootProof,
  type InputLiveV6WriterOwnership,
} from "./input-field-live-v6-contract.js";
import {
  InputLiveV6Orchestrator,
  simulatedInputLiveV6Authorization,
} from "./run-input-field-live-v6.js";

const simulatedAuthorization = (): InputLiveV6TransactionAuthorization => ({
  mode: "simulated",
  protocolCommit: "1".repeat(40),
  runnerCommit: "2".repeat(40),
  authorizationCommit: "3".repeat(40),
  codeCommit: "4".repeat(40),
  authorizationSha256: "5".repeat(64),
  protocolSha256: "6".repeat(64),
  runnerSha256: "7".repeat(64),
  codeTreeSha256: "8".repeat(64),
});

const captures: InputLiveV6CaptureCell[] = Array.from(
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
        sha256: inputLiveV6Sha256(`reference-${index}`),
        width: 486,
        height: 240,
        contentBox: { width: 240, height: 64 },
      },
      legacy: { geometry: 0.2, perceptual: 0.2, pixelInk: 0.2 },
    };
  },
);
validateInputLiveV6CaptureManifest(captures);

const fixture = () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-live-v6-"));
  const { privateKey } = generateKeyPairSync("ed25519");
  createInputLiveV6Transaction(directory, privateKey, {
    authorization: simulatedAuthorization(),
    proofPlanSha256: "9".repeat(64),
    captureManifestSha256: inputLiveV6CaptureManifestSha256(captures),
    transactionId: "00000000-0000-4000-8000-000000000006",
    now: "2026-08-27T12:00:00.000Z",
  });
  return { directory, privateKey };
};

const rawResponse = (
  request: InputLiveV6Request,
  payload: unknown,
  overrides?: Parameters<typeof createInputLiveV6FakeDynamicResponse>[2],
): string =>
  JSON.stringify(
    createInputLiveV6FakeDynamicResponse(request, payload, overrides),
  );

const issueAndAccept = <T>(
  directory: string,
  privateKey: KeyObject,
  phase: InputLiveV6RemotePhase,
  payload: unknown,
  options: {
    captureIndex?: number;
    validate?: (payload: unknown, rawBytes: number) => T;
  } = {},
) => {
  const request = issueInputLiveV6Request(
    directory,
    privateKey,
    phase,
    `return ${JSON.stringify(payload)};`,
    { captureIndex: options.captureIndex },
  );
  assert.deepEqual(request.expectedDynamicTool, INPUT_LIVE_V6_DYNAMIC_TOOL);
  assert.deepEqual(request.target, INPUT_LIVE_V6_TARGET);
  persistInputLiveV6RawResponse(
    directory,
    phase,
    rawResponse(request, payload),
    options.captureIndex,
  );
  const accepted = acceptInputLiveV6Response<T>(directory, phase, {
    captureIndex: options.captureIndex,
    validate: options.validate,
  });
  validateInputLiveV6Receipt(directory, phase, options.captureIndex);
  return { request, accepted };
};

const writerPayload = () => ({
  pageId: "1:1",
  pageName: "Recipe Pivot / Input Field / v6",
  runIdentity: "v6-run",
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

const extractPayload = (
  ownership: InputLiveV6WriterOwnership,
): InputLiveV6ExtractPayload => ({
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
      collectionName: "Input v6",
      remote: false,
    },
  ],
});

const probePayload = (
  ownership: InputLiveV6WriterOwnership,
): InputLiveV6ProbePayload => ({
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

const rootProofs = (): InputLiveV6RootProof[] =>
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
  cell: InputLiveV6CaptureCell,
): InputLiveV6CapturePayload => {
  const bytes = Buffer.from(`input-live-v6-${cell.index}`);
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
    pngSha256: inputLiveV6Sha256(bytes),
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
      { validate: validateInputLiveV6WriterPayload },
    ).accepted.payload;
    const cleanupRequest = issueInputLiveV6Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    assert.equal(cleanupRequest.sequence, 2);
    assert.equal(cleanupRequest.previousAcceptedReceiptSha256?.length, 64);
    assert.ok(readFileSync(inputLiveV6RequestPath(directory, "cleanup")));

    issueAndAccept(directory, privateKey, "extract", extractPayload(writer), {
      validate: (payload) => validateInputLiveV6ExtractPayload(payload, writer),
    });
    const probe = issueAndAccept(
      directory,
      privateKey,
      "probe",
      probePayload(writer),
      {
        validate: (payload) => validateInputLiveV6ProbePayload(payload, writer),
      },
    );
    const proofs = rootProofs();
    assertInputLiveV6RootProofs(proofs);
    persistInputLiveV6TechnicalGates(
      directory,
      proofs,
      probe.accepted.receipt.payloadSha256,
    );

    const acceptedCaptures: InputLiveV6CapturePayload[] = [];
    for (const cell of captures) {
      const payload = capturePayload(cell);
      acceptedCaptures.push(
        issueAndAccept(directory, privateKey, "capture", payload, {
          captureIndex: cell.index,
          validate: (value, rawBytes) =>
            validateInputLiveV6CapturePayload(value, cell, rawBytes),
        }).accepted.payload,
      );
    }
    assertInputLiveV6CaptureResponses(captures, acceptedCaptures);

    const cleanupPayload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV6RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanupRequest, cleanupPayload),
    );
    acceptInputLiveV6Response(directory, "cleanup", {
      validate: (payload) => validateInputLiveV6CleanupPayload(payload, writer),
    });
    assert.equal(listInputLiveV6PersistedRequests(directory).length, 132);
    assert.ok(inputLiveV6ReceiptPath(directory, "capture", 127));
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
      sha256: inputLiveV6Sha256(bytes),
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
    pngSha256: inputLiveV6Sha256(bytes),
    pngBase64: bytes.toString("base64"),
  }));
  const report = evaluateInputLiveV6Objective(
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
    const request = issueInputLiveV6Request(
      directory,
      privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV6Request(directory, {
          ...request,
          sequence: 9,
        }),
      /signature\/sequence\/target mismatch/,
    );
    assert.throws(
      () =>
        validateInputLiveV6Request(directory, {
          ...request,
          expectedDynamicTool: {
            namespace: "wrong",
            tool: "wrong",
          } as unknown as typeof INPUT_LIVE_V6_DYNAMIC_TOOL,
        }),
      /signature\/sequence\/target mismatch/,
    );
    persistInputLiveV6RawResponse(
      directory,
      "writer",
      rawResponse(request, writerPayload(), {
        fileContext: { ...INPUT_LIVE_V6_TARGET, fileKey: "wrong" },
      }),
    );
    assert.throws(
      () => acceptInputLiveV6Response(directory, "writer"),
      /binding\/target mismatch/,
    );
    assert.throws(
      () =>
        persistInputLiveV6RawResponse(
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
    const request = issueInputLiveV6Request(
      first.directory,
      first.privateKey,
      "writer",
      "return {};",
    );
    assert.throws(
      () =>
        validateInputLiveV6Request(first.directory, {
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
        issueInputLiveV6Request(
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
      { validate: validateInputLiveV6WriterPayload },
    );
    const responseFile = inputLiveV6ResponsePath(third.directory, "writer");
    const response = JSON.parse(readFileSync(responseFile, "utf8"));
    response.result.payload.pageId = "tampered";
    writeFileSync(responseFile, JSON.stringify(response));
    assert.throws(
      () => validateInputLiveV6Receipt(third.directory, "writer"),
      /invalid Input live v6 accepted receipt/,
    );
  } finally {
    rmSync(third.directory, { recursive: true, force: true });
  }
});

test("bounded transport rejects truncation and capture remains premature before gates", () => {
  const { directory, privateKey } = fixture();
  try {
    const request = issueInputLiveV6Request(
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
        persistInputLiveV6RawResponse(
          directory,
          "writer",
          rawResponse(request, {}),
        ),
      /exceeds bounded transport/,
    );
    assert.throws(
      () =>
        issueInputLiveV6Request(
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
  const ownership = validateInputLiveV6WriterPayload(writerPayload());
  const extract = extractPayload(ownership);
  assert.throws(
    () =>
      validateInputLiveV6ExtractPayload(
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
    () => assertInputLiveV6RootProofs(proofs),
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
      { validate: validateInputLiveV6WriterPayload },
    ).accepted.payload;
    const cleanup = issueInputLiveV6Request(
      directory,
      privateKey,
      "cleanup",
      "return {complete:true};",
    );
    // Simulate the host dying before extraction. Only persisted broker files survive.
    const persisted = JSON.parse(
      readFileSync(inputLiveV6RequestPath(directory, "cleanup"), "utf8"),
    ) as InputLiveV6Request;
    validateInputLiveV6Request(directory, persisted);
    const payload = {
      requestedNodeIds: [writer.pageId],
      removedNodeIds: [writer.pageId],
      requestedCollectionIds: writer.collectionIds,
      removedCollectionIds: writer.collectionIds,
      remainingOwnedNodes: 0,
      remainingOwnedCollections: 0,
      complete: true,
    };
    persistInputLiveV6RawResponse(
      directory,
      "cleanup",
      rawResponse(cleanup, payload),
    );
    assert.doesNotThrow(() =>
      acceptInputLiveV6Response(directory, "cleanup", {
        validate: (value) => validateInputLiveV6CleanupPayload(value, writer),
      }),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable orchestrator resumes with active extract and surfaced cleanup", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-live-v6-state-"));
  const privateKey = generateKeyPairSync("ed25519").privateKey;
  try {
    const orchestrator = InputLiveV6Orchestrator.initialize({
      root: process.cwd(),
      transactionDirectory: directory,
      privateKey,
      authorization: simulatedInputLiveV6Authorization(),
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
    assert.match(afterWriter.activeRequestPath ?? "", /extract/);
    assert.match(afterWriter.cleanupRequestPath ?? "", /cleanup/);

    const resumed = InputLiveV6Orchestrator.resume({
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
        validateInputLiveV6Request(
          directory,
          JSON.parse(
            JSON.stringify({
              artifactVersion: "input-live-v6-broker-request-v2",
            }),
          ),
        ),
      /result leakage/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const requestFrom = (file: string): InputLiveV6Request =>
  JSON.parse(readFileSync(file, "utf8")) as InputLiveV6Request;
