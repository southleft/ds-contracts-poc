import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const V1 = "recipe/evidence/input-field-comparison";
const V2 = "recipe/evidence/input-field-comparison-v2";
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const hash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

interface Artifact {
  cellKey: string;
  file: string;
  hash: string;
  paintedPixels: number;
  contentBox: { width: number; height: number };
  dom: {
    inputFound: boolean;
    labelFound: boolean;
    labelForMatches: boolean;
    accessibleNameMatched: boolean;
  };
}

interface Receipt {
  status: { independentBlindGrade: string; inputFieldOverall: boolean };
  v1Failure: {
    immutable: boolean;
    score: { legacy: string; recipeReact: string };
    recipeFailures: number;
    defectStatements: number;
  };
  matrix: { cells: unknown[]; exactV1Matrix: boolean };
  references: Artifact[];
  outputs: {
    legacy: Artifact[];
    recipeReact: Artifact[];
    recipeWebComponent: Artifact[];
  };
  immutableInputs: {
    referencesByteIdenticalToV1: number;
    legacyByteIdenticalToV1: number;
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    acquisitionAccounting: Record<
      string,
      {
        parameterFields: number;
        byField: Record<string, number>;
        failures: string[];
      }
    >;
    twoCycleCanonicalFixedPoint: Record<string, boolean>;
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelComparisons: number;
      perceptualPixelEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
    };
    noLibraryBranchChecks: { controlFailed: boolean };
  };
  counts: Record<string, number>;
  blindPacket: {
    path: string;
    sealedAnswerKey: string;
    packetHash: string;
    randomizedBatchHash: string;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
    exactIndependentGradingPrompt: string;
  };
}

test("v2 preserves all v1 references and legacy outputs byte-for-byte", () => {
  const v1 = json<{
    references: Artifact[];
    outputs: { legacy: Artifact[] };
  }>(`${V1}/receipt.json`);
  const v2 = json<Receipt>(`${V2}/receipt.json`);
  assert.equal(v2.immutableInputs.referencesByteIdenticalToV1, 128);
  assert.equal(v2.immutableInputs.legacyByteIdenticalToV1, 128);
  for (const [left, right] of [
    [v1.references, v2.references],
    [v1.outputs.legacy, v2.outputs.legacy],
  ] as const) {
    assert.equal(left.length, 128);
    assert.equal(right.length, 128);
    for (let index = 0; index < left.length; index += 1) {
      assert.equal(left[index]!.cellKey, right[index]!.cellKey);
      assert.equal(left[index]!.hash, right[index]!.hash);
      assert.equal(hash(left[index]!.file), hash(right[index]!.file));
    }
  }
});

test("v2 preserves its separate opaque, sealed, complete pre-grade batch", () => {
  const receipt = json<Receipt>(`${V2}/receipt.json`);
  assert.equal(receipt.status.independentBlindGrade, "pending");
  assert.equal(receipt.status.inputFieldOverall, false);
  assert.equal(existsSync(`${V2}/blind-packet/grades.json`), true);
  assert.equal(existsSync(`${V2}/comparison-result.json`), true);
  assert.equal(hash(receipt.blindPacket.path), receipt.blindPacket.packetHash);
  assert.notEqual(
    path.dirname(receipt.blindPacket.path),
    path.dirname(receipt.blindPacket.sealedAnswerKey),
  );
  assert.equal(
    receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder,
    false,
  );
  const packetText = readFileSync(receipt.blindPacket.path, "utf8");
  assert.doesNotMatch(
    packetText,
    /\blegacy\b|\brecipe(?:[- /]?react)?\b|\bmui\b|\bpolaris\b|@shopify|@mui/i,
  );
  const packet = JSON.parse(packetText) as {
    status: string;
    randomizedBatchHash: string;
    counts: { references: number; specimens: number };
    cells: Array<{ specimens: Array<{ grade: Record<string, unknown> }> }>;
  };
  assert.equal(packet.status, "awaiting-independent-blind-grade");
  assert.equal(
    packet.randomizedBatchHash,
    receipt.blindPacket.randomizedBatchHash,
  );
  assert.deepEqual(packet.counts, {
    references: 128,
    specimens: 256,
    specimensPerReference: 2,
  });
  assert.equal(packet.cells.length, 128);
  assert.equal(packet.cells.flatMap((cell) => cell.specimens).length, 256);
  assert.equal(
    packet.cells.every((cell) =>
      cell.specimens.every(
        (specimen) =>
          specimen.grade.recognisable === null &&
          specimen.grade.confidence === null &&
          Array.isArray(specimen.grade.defects) &&
          specimen.grade.defects.length === 0,
      ),
    ),
    true,
  );
});

test("v2 validates corrected React and WC geometry, pixels, and semantics", () => {
  const receipt = json<Receipt>(`${V2}/receipt.json`);
  assert.equal(receipt.matrix.cells.length, 128);
  assert.equal(receipt.matrix.exactV1Matrix, true);
  assert.equal(receipt.nonvisualEvidence.zeroPixelComparisons, 0);
  assert.equal(
    receipt.nonvisualEvidence.noLibraryBranchChecks.controlFailed,
    false,
  );
  assert.equal(
    Object.values(receipt.nonvisualEvidence.twoCycleCanonicalFixedPoint).every(
      Boolean,
    ),
    true,
  );
  for (const report of Object.values(
    receipt.nonvisualEvidence.acquisitionAccounting,
  )) {
    assert.ok(report.parameterFields > 0);
    assert.ok(Object.values(report.byField).every((count) => count > 0));
    assert.deepEqual(report.failures, []);
  }
  assert.deepEqual(
    {
      cells: receipt.nonvisualEvidence.recipeWebComponentParity.cells,
      nonzeroCells:
        receipt.nonvisualEvidence.recipeWebComponentParity.nonzeroCells,
      pixelComparisons:
        receipt.nonvisualEvidence.recipeWebComponentParity.pixelComparisons,
      perceptualPixelEqualToReact:
        receipt.nonvisualEvidence.recipeWebComponentParity
          .perceptualPixelEqualToReact,
      geometryEqualToReact:
        receipt.nonvisualEvidence.recipeWebComponentParity.geometryEqualToReact,
      semanticProbeEqualToReact:
        receipt.nonvisualEvidence.recipeWebComponentParity
          .semanticProbeEqualToReact,
    },
    {
      cells: 128,
      nonzeroCells: 128,
      pixelComparisons: 128,
      perceptualPixelEqualToReact: 128,
      geometryEqualToReact: 128,
      semanticProbeEqualToReact: 128,
    },
  );
  for (const artifact of [
    ...receipt.outputs.recipeReact,
    ...receipt.outputs.recipeWebComponent,
  ]) {
    assert.equal(hash(artifact.file), artifact.hash);
    assert.ok(artifact.paintedPixels > 0);
    assert.ok(artifact.contentBox.width > 0 && artifact.contentBox.height > 0);
    assert.equal(
      artifact.dom.inputFound &&
        artifact.dom.labelFound &&
        artifact.dom.labelForMatches &&
        artifact.dom.accessibleNameMatched,
      true,
    );
  }
});

test("v1 failure diagnosis retains all 88 failures and 271 statements", () => {
  const receipt = json<Receipt>(`${V2}/receipt.json`);
  assert.deepEqual(receipt.v1Failure, {
    immutable: true,
    evidenceRoot: V1,
    score: { legacy: "88/128", recipeReact: "40/128" },
    recipeFailures: 88,
    defectStatements: 271,
    diagnosis: `${V2}/v1-root-cause.json`,
  });
  const diagnosis = json<{
    immutableFailure: {
      recipeFailures: number;
      defectStatements: number;
      defectClasses: Record<string, { statements: number }>;
    };
    allFailures: Array<{ defects: string[] }>;
  }>(`${V2}/v1-root-cause.json`);
  assert.equal(diagnosis.immutableFailure.recipeFailures, 88);
  assert.equal(diagnosis.immutableFailure.defectStatements, 271);
  assert.equal(diagnosis.allFailures.length, 88);
  assert.equal(
    diagnosis.allFailures.reduce(
      (total, failure) => total + failure.defects.length,
      0,
    ),
    271,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(diagnosis.immutableFailure.defectClasses).map(
        ([name, value]) => [name, value.statements],
      ),
    ),
    {
      "border-fill-or-state-treatment": 46,
      "field-proportions": 76,
      "input-outline-padding-or-alignment": 78,
      "label-helper-structure-or-spacing": 71,
    },
  );
});
