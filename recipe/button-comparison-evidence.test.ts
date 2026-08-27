import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  validatePinnedComparisonEvidence,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
} from "./comparison.js";

const ROOT = "recipe/evidence/button-comparison";
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const sha256File = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

interface Receipt {
  status: {
    evidenceGeneration: string;
    independentBlindGrade: string;
    legacyRecognisability: string;
    recipeRecognisability: string;
    buttonSuccess: boolean;
  };
  historicalCorpusBaseline: {
    recognisable: string;
    usable: string;
    changed: boolean;
  };
  matrix: {
    frozenBeforeRender: boolean;
    axesCompared: string[];
    variants: string[];
    states: string[];
    sharedCellsPerLibrary: number;
    libraries: number;
    totalSourceCells: number;
    cells: Array<{ key: string }>;
    excludedByName: string[];
  };
  provenance: {
    harnessHash: string;
    packages: {
      altitude: { exactVersion: string; packageLockHash: string };
      fluent: { exactVersion: string; packageLockHash: string };
    };
    captureCommand: string;
  };
  references: Array<{ cellKey: string; file: string; hash: string }>;
  outputs: {
    legacy: Array<{ cellKey: string; file: string; hash: string }>;
    recipeReact: Array<{ cellKey: string; file: string; hash: string }>;
    recipeWebComponent: Array<{
      cellKey: string;
      file: string;
      hash: string;
    }>;
  };
  comparisonPin: PinnedComparisonFixture;
  manifests: {
    legacy: ComparisonOutputManifest;
    recipeReact: ComparisonOutputManifest;
    recipeWebComponentParity: ComparisonOutputManifest;
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
    provenanceFieldsComplete: boolean;
    apiDomAria: Record<
      string,
      Array<{
        buttonFound: boolean;
        buttonTag: string | null;
        role: string | null;
        text: string;
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

test("real-library Button evidence has complete non-zero matched denominators", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  assert.deepEqual(receipt.status, {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeRecognisability: "ungraded",
    buttonSuccess: false,
  });
  assert.deepEqual(receipt.historicalCorpusBaseline, {
    recognisable: "117/170",
    usable: "39/170",
    changed: false,
  });
  assert.equal(receipt.matrix.frozenBeforeRender, true);
  assert.deepEqual(receipt.matrix.axesCompared, ["Variant", "State"]);
  assert.deepEqual(receipt.matrix.variants, ["primary", "secondary"]);
  assert.deepEqual(receipt.matrix.states, [
    "default",
    "hover",
    "focus-visible",
  ]);
  assert.equal(receipt.matrix.sharedCellsPerLibrary, 6);
  assert.equal(receipt.matrix.libraries, 2);
  assert.equal(receipt.matrix.totalSourceCells, 12);
  assert.equal(new Set(receipt.matrix.cells.map((cell) => cell.key)).size, 12);
  assert.ok(receipt.matrix.excludedByName.includes("Size=small"));
  assert.ok(receipt.matrix.excludedByName.includes("State=disabled"));
  assert.ok(receipt.matrix.excludedByName.includes("Icons=leading"));

  assert.equal(receipt.provenance.packages.altitude.exactVersion, "1.0.2");
  assert.equal(receipt.provenance.packages.fluent.exactVersion, "9.74.5");
  assert.match(
    receipt.provenance.packages.altitude.packageLockHash,
    /^[a-f0-9]{64}$/,
  );
  assert.match(
    receipt.provenance.packages.fluent.packageLockHash,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(
    receipt.provenance.captureCommand,
    "npx tsx recipe/capture-button-comparison.ts",
  );
  assert.equal(
    receipt.provenance.harnessHash,
    "a355412c405df54472c9b768074bfc6b2f3b889842a2fe558b2e5efdef37fff5",
  );

  assert.deepEqual(receipt.counts, {
    sourceReferences: 12,
    legacyOutputs: 12,
    recipeReactOutputs: 12,
    recipeWebComponentOutputs: 12,
    blindSpecimens: 24,
  });
  assert.equal(receipt.nonvisualEvidence.zeroPixelComparisons, 0);
  assert.equal(receipt.nonvisualEvidence.provenanceFieldsComplete, true);
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
  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.legacy,
    receipt.manifests.recipeReact,
  );
  assert.equal(receipt.manifests.recipeWebComponentParity.cells.length, 12);

  for (const artifact of [
    ...receipt.references,
    ...receipt.outputs.legacy,
    ...receipt.outputs.recipeReact,
    ...receipt.outputs.recipeWebComponent,
  ]) {
    assert.equal(existsSync(artifact.file), true, `${artifact.file} is absent`);
    assert.equal(sha256File(artifact.file), artifact.hash);
  }
});

test("blind packet has opaque labels, no implementation identities, and no verdicts", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  const packetText = readFileSync(receipt.blindPacket.path, "utf8");
  assert.doesNotMatch(packetText, /\blegacy\b|recipe[- /]?react/i);
  assert.equal(
    sha256File(receipt.blindPacket.path),
    receipt.blindPacket.packetHash,
  );
  assert.equal(
    receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder,
    false,
  );
  assert.notEqual(
    receipt.blindPacket.path,
    receipt.blindPacket.sealedAnswerKey,
  );
  assert.equal(existsSync(receipt.blindPacket.sealedAnswerKey), true);

  const packet = JSON.parse(packetText) as {
    status: string;
    cells: Array<{
      anonymousCell: string;
      specimens: Array<{
        anonymousLabel: string;
        grade: {
          recognisable: null;
          defects: unknown[];
          confidence: null;
        };
      }>;
    }>;
  };
  assert.equal(packet.status, "awaiting-independent-blind-grade");
  assert.equal(packet.cells.length, 12);
  const labels = packet.cells.flatMap((cell) =>
    cell.specimens.map((specimen) => specimen.anonymousLabel),
  );
  assert.equal(new Set(labels).size, 24);
  assert.equal(
    packet.cells.every(
      (cell) =>
        /^cell-[a-f0-9]{12}$/.test(cell.anonymousCell) &&
        cell.specimens.length === 2 &&
        cell.specimens.every(
          (specimen) =>
            /^specimen-[a-f0-9]{12}$/.test(specimen.anonymousLabel) &&
            specimen.grade.recognisable === null &&
            specimen.grade.confidence === null &&
            specimen.grade.defects.length === 0,
        ),
    ),
    true,
  );
});
