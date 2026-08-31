import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const V1 = "recipe/evidence/button-comparison";
const V2 = "recipe/evidence/button-comparison-v2";
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const fileHash = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

interface Artifact {
  cellKey: string;
  file: string;
  hash: string;
}

interface Receipt {
  status: {
    evidenceGeneration: string;
    independentBlindGrade: string;
    legacyRecognisability: string;
    recipeRecognisability: string;
    buttonSuccess: boolean;
  };
  matrix: {
    sampleMatrixHash: string;
    totalSourceCells: number;
    cells: Array<{ key: string }>;
  };
  references: Artifact[];
  outputs: {
    legacy: Artifact[];
    recipeReact: Artifact[];
    recipeWebComponent: Artifact[];
  };
  counts: {
    sourceReferences: number;
    legacyOutputs: number;
    recipeReactOutputs: number;
    recipeWebComponentOutputs: number;
    blindSpecimens: number;
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    acquisitionAccounting: Record<
      string,
      {
        factsSelected: number;
        byCategory: Record<string, number>;
        failures: string[];
      }
    >;
    deterministicEmission: Record<
      string,
      {
        byteIdenticalTwoRun: boolean;
        reactHash: string;
        webComponentHash: string;
      }
    >;
    apiDomAria: Record<
      string,
      Array<{
        buttonFound: boolean;
        buttonTag: string | null;
        role: string | null;
        accessibleNameMatched: boolean;
      }>
    >;
  };
  blindPacket: {
    path: string;
    sealedAnswerKey: string;
    packetHash: string;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
  };
}

test("v2 preserves sealed references and legacy bytes while replacing recipe output", () => {
  const v1 = json<Receipt>(`${V1}/receipt.json`);
  const v2 = json<Receipt>(`${V2}/receipt.json`);
  assert.deepEqual(v2.status, {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeRecognisability: "ungraded",
    buttonSuccess: false,
  });
  assert.equal(v2.matrix.sampleMatrixHash, v1.matrix.sampleMatrixHash);
  assert.equal(v2.matrix.totalSourceCells, 12);
  assert.deepEqual(
    v2.matrix.cells.map((cell) => cell.key),
    v1.matrix.cells.map((cell) => cell.key),
  );
  for (const field of ["references", "legacy"] as const) {
    const before = field === "references" ? v1.references : v1.outputs.legacy;
    const after = field === "references" ? v2.references : v2.outputs.legacy;
    assert.deepEqual(
      after.map(({ cellKey, hash }) => ({ cellKey, hash })),
      before.map(({ cellKey, hash }) => ({ cellKey, hash })),
    );
  }
  assert.equal(
    v2.outputs.recipeReact.some(
      (artifact, index) =>
        artifact.hash !== v1.outputs.recipeReact[index]?.hash,
    ),
    true,
  );
  assert.deepEqual(v2.counts, {
    sourceReferences: 12,
    legacyOutputs: 12,
    recipeReactOutputs: 12,
    recipeWebComponentOutputs: 12,
    blindSpecimens: 24,
  });
  assert.equal(v2.nonvisualEvidence.zeroPixelComparisons, 0);
  for (const artifact of [
    ...v2.references,
    ...v2.outputs.legacy,
    ...v2.outputs.recipeReact,
    ...v2.outputs.recipeWebComponent,
  ]) {
    assert.equal(existsSync(artifact.file), true, `${artifact.file} is absent`);
    assert.equal(fileHash(artifact.file), artifact.hash);
  }
});

test("v2 acquisition, emission, DOM/ARIA, and React/WC parity gates are non-zero", () => {
  const receipt = json<Receipt>(`${V2}/receipt.json`);
  for (const report of Object.values(
    receipt.nonvisualEvidence.acquisitionAccounting,
  )) {
    assert.ok(report.factsSelected > 0);
    assert.equal(
      ["geometry", "typography", "fill", "state"].every(
        (category) => (report.byCategory[category] ?? 0) > 0,
      ),
      true,
    );
    assert.deepEqual(report.failures, []);
  }
  for (const evidence of Object.values(
    receipt.nonvisualEvidence.deterministicEmission,
  )) {
    assert.equal(evidence.byteIdenticalTwoRun, true);
    assert.match(evidence.reactHash, /^[a-f0-9]{64}$/);
    assert.match(evidence.webComponentHash, /^[a-f0-9]{64}$/);
  }
  assert.equal(
    Object.values(receipt.nonvisualEvidence.apiDomAria)
      .flat()
      .every(
        (probe) =>
          probe.buttonFound &&
          probe.buttonTag === "button" &&
          probe.role === "button" &&
          probe.accessibleNameMatched,
      ),
    true,
  );
  assert.deepEqual(
    receipt.outputs.recipeWebComponent.map(({ cellKey, hash }) => ({
      cellKey,
      hash,
    })),
    receipt.outputs.recipeReact.map(({ cellKey, hash }) => ({ cellKey, hash })),
  );
});

test("v2 packet remains fresh, opaque, sealed separately, and builder-ungraded", () => {
  const receipt = json<Receipt>(`${V2}/receipt.json`);
  const packetText = readFileSync(receipt.blindPacket.path, "utf8");
  assert.equal(
    fileHash(receipt.blindPacket.path),
    receipt.blindPacket.packetHash,
  );
  assert.doesNotMatch(packetText, /\blegacy\b|recipe[- /]?react/i);
  assert.equal(
    receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder,
    false,
  );
  assert.notEqual(
    receipt.blindPacket.path,
    receipt.blindPacket.sealedAnswerKey,
  );
  assert.equal(existsSync(receipt.blindPacket.sealedAnswerKey), true);
  assert.equal(existsSync(`${V2}/blind-packet/grades.json`), true);

  const packet = JSON.parse(packetText) as {
    version: string;
    status: string;
    cells: Array<{
      anonymousCell: string;
      specimens: Array<{
        anonymousLabel: string;
        image: string;
        grade: {
          recognisable: null;
          defects: unknown[];
          confidence: null;
        };
      }>;
    }>;
  };
  assert.equal(packet.version, "button-paired-source-v2");
  assert.equal(packet.status, "awaiting-independent-blind-grade");
  assert.equal(packet.cells.length, 12);
  const labels = packet.cells.flatMap((cell) =>
    cell.specimens.map((specimen) => specimen.anonymousLabel),
  );
  assert.equal(new Set(labels).size, 24);
  assert.equal(
    packet.cells.every(
      (cell) =>
        cell.specimens.length === 2 &&
        cell.specimens.every(
          (specimen) =>
            specimen.image.startsWith("specimens/specimen-") &&
            specimen.grade.recognisable === null &&
            specimen.grade.confidence === null &&
            specimen.grade.defects.length === 0,
        ),
    ),
    true,
  );

  const v1Packet = json<{
    cells: Array<{
      anonymousCell: string;
      specimens: Array<{ anonymousLabel: string }>;
    }>;
  }>(`${V1}/blind-packet/packet.json`);
  const v1Ids = new Set([
    ...v1Packet.cells.map((cell) => cell.anonymousCell),
    ...v1Packet.cells.flatMap((cell) =>
      cell.specimens.map((specimen) => specimen.anonymousLabel),
    ),
  ]);
  assert.equal(
    packet.cells
      .flatMap((cell) => [
        cell.anonymousCell,
        ...cell.specimens.map((specimen) => specimen.anonymousLabel),
      ])
      .some((id) => v1Ids.has(id)),
    false,
  );
});
