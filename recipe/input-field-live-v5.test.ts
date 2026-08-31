import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createInputLiveV5AuthorizationArtifact,
  INPUT_LIVE_V5_ANTECEDENT_COMMIT,
  INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
  INPUT_LIVE_V5_EVIDENCE_ROOT,
  INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT,
  INPUT_LIVE_V5_PROTOCOL_SHA256,
  INPUT_LIVE_V5_TARGET,
  simulatedInputLiveV5Authorization,
  validateInputLiveV5Authorization,
  type InputLiveV5AuthorizationState,
} from "./input-field-live-v5-authorization.js";
import { validateInputLiveV5Journal } from "./input-field-live-v5-journal.js";
import {
  INPUT_LIVE_V5_REQUIRED_GENERATED_PATHS,
  runInputLiveV5Preflight,
  validateInputLiveV5ControlFlowSource,
} from "./input-field-live-v5-preflight.js";
import {
  runInputLiveV5,
  type InputLiveV5Bridge,
  type InputLiveV5RawScene,
  type InputLiveV5Usability,
} from "./run-input-field-live-v5.js";
import { validateFigmaWriterConformance } from "./figma-writer-conformance.js";
import {
  decodeWriterTransportEnvelope,
  type WriterTransportEnvelope,
} from "./writer-transport.js";

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });
const variables = [
  {
    id: "color",
    name: "token/color/id-636f6c6f722e6272616e64",
    resolvedType: "COLOR" as const,
    collectionId: "collection:1",
    collectionName: "Input v5",
    remote: false as const,
  },
  {
    id: "float",
    name: "token/float/id-73697a652e3136",
    resolvedType: "FLOAT" as const,
    collectionId: "collection:1",
    collectionName: "Input v5",
    remote: false as const,
  },
];

const rawScene = (): InputLiveV5RawScene => ({
  variableTable: variables,
  scene: {
    ownershipKey: "root",
    type: "FRAME",
    name: "input-field/root",
    semanticRole: "input-field/root",
    width: 320,
    height: 96,
    visible: true,
    opacity: 1,
    layoutMode: "VERTICAL",
    layoutSizingHorizontal: "FIXED",
    layoutSizingVertical: "HUG",
    itemSpacing: 8,
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 12,
    fills: [{ type: "SOLID", color: "#ffffffff", opacity: 1 }],
    rawBoundVariables: { fills: [alias("color")] },
    children: [
      {
        ownershipKey: "root/label",
        type: "TEXT",
        name: "input-field/label",
        semanticRole: "input-field/label",
        width: 120,
        height: 20,
        visible: true,
        opacity: 1,
        characters: "Account name",
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 16,
        lineHeight: { unit: "PERCENT", value: 150 },
        letterSpacing: { unit: "PIXELS", value: 0 },
        textAlignHorizontal: "LEFT",
        textAlignVertical: "CENTER",
        fills: [{ type: "SOLID", color: "#111111ff", opacity: 1 }],
        rawBoundVariables: {
          fontSize: [alias("float")],
          lineHeight: [alias("float")],
        },
        children: [],
      },
      {
        ownershipKey: "root/adornment",
        type: "INSTANCE",
        name: "input-field/slot/leading",
        semanticRole: "input-field/slot/leading",
        width: 16,
        height: 16,
        visible: true,
        opacity: 1,
        componentRef: "component:currency",
        componentProperties: { Visible: true },
        instancePayload: {
          text: ["$"],
          assets: [],
          content: { kind: "text", text: "$" },
          typography: {
            fontFamily: "Inter",
            fontStyle: "Regular",
            fontSize: 14,
            lineHeight: { unit: "px", value: 20 },
          },
          fills: [{ kind: "solid", color: "#111111ff" }],
          opacity: 1,
          intrinsicSize: { width: 16, height: 16 },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          alignment: { horizontal: "center", vertical: "center" },
          accessibility: {
            relation: "labelledby-control",
            label: "Currency",
            decorative: false,
          },
          source: "reviewed-source-contract",
        },
        children: [],
      },
    ],
  },
});

interface FakeCounters {
  bridge: number;
  evaluations: number;
  captures: number;
  cleanups: number;
  usabilityReturned: boolean;
}

const strictFakeBridge = (
  counters: FakeCounters,
  usabilityOverride: Partial<InputLiveV5Usability> = {},
): InputLiveV5Bridge => ({
  kind: "fake",
  async invoke(operation) {
    counters.bridge += 1;
    assert.equal(counters.bridge, 1, "bridge invoked more than once");
    return operation({
      async evaluateGeneratedWriter({ wrapper, envelope, wrapperSha256 }) {
        counters.evaluations += 1;
        assert.equal(sha256(wrapper), wrapperSha256);
        assert.match(wrapper, /__recipeTransportV5/);
        const decoded = decodeWriterTransportEnvelope(
          envelope as WriterTransportEnvelope,
        );
        const source = Buffer.from(decoded).toString("utf8");
        const conformance = await validateFigmaWriterConformance(source, {
          variants: 256,
          writerVersion: 2,
          requiredMarkers: [
            "INPUT-TEXT-GEOMETRY",
            "INPUT-FAKE-LAYOUT",
            "readSceneDerivedTree",
          ],
        });
        assert.equal(conformance.ok, true, conformance.failures.join("\n"));
        const result = conformance.result!;
        return {
          pageId: result.pageId,
          setIds: result.sources.map(
            (source: Record<string, string>) => source.setId,
          ),
          sectionIds: result.sources.map(
            (source: Record<string, string>) => source.sectionId,
          ),
          collectionIds: result.sources.map(
            (source: Record<string, string>) => source.collectionId,
          ),
          createdNodeIds: result.createdNodeIds,
          counts: {
            sources: result.sources.length,
            variants: result.sources.reduce(
              (sum: number, source: Record<string, number>) =>
                sum + source.variantCount,
              0,
            ),
            collections: result.sources.length,
            nodes: result.createdNodeIds.length,
          },
        };
      },
      async extractRawScene() {
        return rawScene();
      },
      async probeUsability() {
        counters.usabilityReturned = true;
        return {
          usability: true,
          restoration: true,
          clipping: true,
          overlap: true,
          adornmentContent: true,
          stateSemantics: true,
          visitedVariants: 256,
          restoredVariants: 256,
          ...usabilityOverride,
        };
      },
      async capture() {
        assert.equal(
          counters.usabilityReturned,
          true,
          "capture reached before usability gates",
        );
        counters.captures += 1;
        return {
          captureMode: "offline-unreachable-artifact-simulation",
          captureCalls: counters.captures,
          objectiveRows: 128,
          artifactsWritten: 0,
        };
      },
      async cleanup(writer) {
        counters.cleanups += 1;
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
  },
});

test("offline smoke uses authorized live orchestration and every ordered journal phase", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-v5-smoke-"));
  const counters: FakeCounters = {
    bridge: 0,
    evaluations: 0,
    captures: 0,
    cleanups: 0,
    usabilityReturned: false,
  };
  try {
    const result = await runInputLiveV5({
      root: process.cwd(),
      mode: "offline",
      attempt: 1,
      completedAttempts: [],
      journalDirectory: directory,
      authorize: simulatedInputLiveV5Authorization,
      bridge: strictFakeBridge(counters),
    });
    assert.equal(result.completed, true);
    assert.equal(result.bridgeInvocations, 1);
    assert.deepEqual(counters, {
      bridge: 1,
      evaluations: 1,
      captures: 1,
      cleanups: 1,
      usabilityReturned: true,
    });
    assert.deepEqual(validateInputLiveV5Journal(result.journal.entries), []);
    assert.deepEqual(
      result.journal.entries.map((entry) => entry.phase),
      [
        "preflight",
        "writer-result",
        "raw-scene-and-variable-table",
        "host-normalization",
        "accounting-and-fixed-point",
        "usability-and-restoration",
        "captures-and-objective",
        "retention-and-cleanup",
      ],
    );
    const accounting = result.journal.entries[4]!.payload as Record<
      string,
      unknown
    >;
    assert.equal(accounting.accounting, true);
    assert.equal(accounting.fixedPoint, true);
    assert.equal(accounting.fixedPointCycles, 2);
    assert.ok(Number(accounting.sceneFacts) > 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("capture stays unreachable when any technical gate fails", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-v5-gate-"));
  const counters: FakeCounters = {
    bridge: 0,
    evaluations: 0,
    captures: 0,
    cleanups: 0,
    usabilityReturned: false,
  };
  try {
    const result = await runInputLiveV5({
      root: process.cwd(),
      mode: "offline",
      attempt: 1,
      completedAttempts: [],
      journalDirectory: directory,
      authorize: simulatedInputLiveV5Authorization,
      bridge: strictFakeBridge(counters, { overlap: false }),
    });
    assert.equal(result.completed, false);
    assert.match(result.error ?? "", /captures forbidden/);
    assert.equal(counters.captures, 0);
    assert.equal(counters.cleanups, 1);
    assert.equal(result.journal.entries.at(-1)?.phase, "retention-and-cleanup");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("preflight hard-fails missing, zero-byte, and stale generated artifacts", () => {
  const required = [
    "recipe/evidence/input-field-live-pivot-v5/protocol.json",
    "recipe/run-input-field-live-v5.ts",
    ...INPUT_LIVE_V5_REQUIRED_GENERATED_PATHS,
  ];
  for (const [label, corrupt] of [
    [
      "missing",
      (root: string) =>
        rmSync(
          path.join(
            root,
            "recipe/evidence/input-field-live-pivot-v5/writer.js",
          ),
        ),
    ],
    [
      "zero-byte",
      (root: string) =>
        writeFileSync(
          path.join(
            root,
            "recipe/evidence/input-field-live-pivot-v5/transport-envelope.json",
          ),
          "",
        ),
    ],
    [
      "stale",
      (root: string) =>
        writeFileSync(
          path.join(
            root,
            "recipe/evidence/input-field-live-pivot-v5/conformance-report.json",
          ),
          "{}\n",
        ),
    ],
  ] as Array<[string, (root: string) => void]>) {
    const root = mkdtempSync(path.join(os.tmpdir(), `input-v5-${label}-`));
    try {
      for (const relativePath of new Set(required)) {
        const target = path.join(root, relativePath);
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(relativePath, target);
      }
      assert.doesNotThrow(() =>
        runInputLiveV5Preflight(
          root,
          simulatedInputLiveV5Authorization(),
          1,
          [],
        ),
      );
      corrupt(root);
      assert.throws(
        () =>
          runInputLiveV5Preflight(
            root,
            simulatedInputLiveV5Authorization(),
            1,
            [],
          ),
        /generated artifact|Unexpected end of JSON input/,
        label,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("live mode cannot use simulated authorization or a fake bridge", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "input-v5-mode-"));
  const counters: FakeCounters = {
    bridge: 0,
    evaluations: 0,
    captures: 0,
    cleanups: 0,
    usabilityReturned: false,
  };
  try {
    await assert.rejects(
      runInputLiveV5({
        root: process.cwd(),
        mode: "live",
        attempt: 1,
        completedAttempts: [],
        journalDirectory: directory,
        authorize: simulatedInputLiveV5Authorization,
        bridge: strictFakeBridge(counters),
      }),
      /authorization\/bridge mode mismatch/,
    );
    assert.equal(counters.bridge, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const authorizationState = (): InputLiveV5AuthorizationState => ({
  authorization: createInputLiveV5AuthorizationArtifact(),
  protocolAddingCommits: [INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT],
  authorizationAddingCommits: ["2".repeat(40)],
  protocolCommit: INPUT_LIVE_V5_PROTOCOL_FIRST_ADD_COMMIT,
  authorizationCommit: "2".repeat(40),
  codeCommit: "3".repeat(40),
  upstreamCommit: "3".repeat(40),
  clean: true,
  antecedentExists: true,
  antecedentExecutable: true,
  antecedentIsAncestorOfCode: true,
  protocolBytesMatch: true,
  antecedentDependencyBytesMatch: true,
  preservedEvidenceTreesMatch: true,
  authorizationBytesMatchFirstAddition: true,
  authorizationPresentAtCodeCommit: true,
  protocolStrictlyPrecedesAuthorization: true,
  authorizationIsAncestorOfCode: true,
  target: INPUT_LIVE_V5_TARGET,
});

test("runtime authorization rejects absent, non-executable, dirty, unpushed, and wrong-target states", () => {
  assert.deepEqual(validateInputLiveV5Authorization(authorizationState()), []);
  for (const [pattern, mutate] of [
    [
      /authorization declaration missing|pending-uncommitted-authorization/,
      (value: InputLiveV5AuthorizationState) => {
        value.authorization = undefined;
        value.authorizationAddingCommits = [];
        value.authorizationCommit = undefined;
      },
    ],
    [
      /dirty worktree/,
      (value: InputLiveV5AuthorizationState) => {
        value.clean = false;
      },
    ],
    [
      /non-executable/,
      (value: InputLiveV5AuthorizationState) => {
        value.antecedentExecutable = false;
      },
    ],
    [
      /generated pin drift/,
      (value: InputLiveV5AuthorizationState) => {
        value.antecedentDependencyBytesMatch = false;
      },
    ],
    [
      /unpushed/,
      (value: InputLiveV5AuthorizationState) => {
        value.upstreamCommit = "4".repeat(40);
      },
    ],
    [
      /wrong v5 target/,
      (value: InputLiveV5AuthorizationState) => {
        value.target = { ...INPUT_LIVE_V5_TARGET, fileKey: "wrong" };
      },
    ],
  ] as Array<[RegExp, (value: InputLiveV5AuthorizationState) => void]>) {
    const value = authorizationState();
    mutate(value);
    assert.match(validateInputLiveV5Authorization(value).join("\n"), pattern);
  }
});

test("authorization rejects result leakage, changed thresholds, and prior authorization reuse", () => {
  for (const [pattern, mutate] of [
    [
      /result leakage or changed thresholds/,
      (value: InputLiveV5AuthorizationState) => {
        value.authorization!.result = "pass";
      },
    ],
    [
      /result leakage or changed thresholds/,
      (value: InputLiveV5AuthorizationState) => {
        value.authorization!.thresholds = { pixels: 5 };
      },
    ],
    [
      /v3\/v4 authorization or evidence reuse/,
      (value: InputLiveV5AuthorizationState) => {
        value.authorization!.capture = {
          evidenceRoot: "recipe/evidence/input-field-live-pivot-v4",
        };
      },
    ],
  ] as Array<[RegExp, (value: InputLiveV5AuthorizationState) => void]>) {
    const value = authorizationState();
    mutate(value);
    assert.match(validateInputLiveV5Authorization(value).join("\n"), pattern);
  }
});

test("published executable antecedent pins protocol and every declared dependency", () => {
  assert.equal(
    execFileSync("git", ["rev-parse", `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}^{commit}`], {
      encoding: "utf8",
    }).trim(),
    INPUT_LIVE_V5_ANTECEDENT_COMMIT,
  );
  const protocol = execFileSync(
    "git",
    [
      "show",
      `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}:recipe/evidence/input-field-live-pivot-v5/protocol.json`,
    ],
    { encoding: "buffer" },
  );
  assert.equal(sha256(protocol), INPUT_LIVE_V5_PROTOCOL_SHA256);
  for (const [filePath, expectedHash] of Object.entries(
    INPUT_LIVE_V5_ANTECEDENT_DEPENDENCY_SHA256,
  )) {
    const bytes = execFileSync(
      "git",
      ["show", `${INPUT_LIVE_V5_ANTECEDENT_COMMIT}:${filePath}`],
      { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
    );
    assert.equal(sha256(bytes), expectedHash, filePath);
  }
});

test("preflight refuses attempt greater than three", () => {
  assert.throws(
    () =>
      runInputLiveV5Preflight(
        process.cwd(),
        simulatedInputLiveV5Authorization(),
        4,
        [1, 2, 3],
      ),
    /exceeds maximum 3/,
  );
});

test("v5 control-flow gate passes runner and catches the exact v4 refusal defect", () => {
  const v5 = readFileSync("recipe/run-input-field-live-v5.ts", "utf8");
  assert.deepEqual(validateInputLiveV5ControlFlowSource(v5), []);
  const plantedV4 = readFileSync("recipe/run-input-field-live-v4.ts", "utf8");
  assert.match(
    validateInputLiveV5ControlFlowSource(plantedV4).join("\n"),
    /unconditional draft refusal/,
  );
});

test("v5 retains v4 product criteria byte-for-structure without outcomes", () => {
  const v4 = JSON.parse(
    readFileSync(
      "recipe/evidence/input-field-live-pivot-v4/protocol.json",
      "utf8",
    ),
  );
  const v5Bytes = readFileSync(
    "recipe/evidence/input-field-live-pivot-v5/protocol.json",
  );
  const v5 = JSON.parse(v5Bytes.toString("utf8"));
  assert.equal(sha256(v5Bytes), INPUT_LIVE_V5_PROTOCOL_SHA256);
  assert.deepEqual(v5.criteria, v4.criteria);
  assert.equal(v5.authorization.authorized, false);
  assert.equal(v5.attempts.executed, 0);
});
