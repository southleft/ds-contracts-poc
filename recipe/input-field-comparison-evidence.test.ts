import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  INPUT_FIELD_COMPARISON_CELLS,
  INPUT_FIELD_COMPARISON_LIBRARIES,
  REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS,
  validateInputFieldComparisonMatrix,
  type InputFieldComparisonCell,
} from "./input-field-comparison-fixture.js";
import {
  validatePinnedComparisonEvidence,
  type ComparisonOutputManifest,
  type PinnedComparisonFixture,
} from "./comparison.js";

const ROOT = "recipe/evidence/input-field-comparison";
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(file, "utf8")) as T;
const sha256File = (file: string): string =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

interface Captured {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  paintedPixels: number;
  dom: {
    inputFound: boolean;
    labelFound: boolean;
    labelForMatches: boolean;
    accessibleNameMatched: boolean;
    required: boolean;
    disabled: boolean;
    ariaInvalid: string | null;
  };
}

interface Receipt {
  status: {
    evidenceGeneration: string;
    independentBlindGrade: string;
    legacyRecognisability: string;
    recipeReactRecognisability: string;
    recipeWebComponentRecognisability: string;
    inputFieldOverall: boolean;
  };
  historicalInputFieldContext: {
    sets: number;
    recognisableSets: number;
    totalVariants: number;
    variantWeightedSetVerdict: string;
    changed: boolean;
    whyNotPairedBaseline: string;
  };
  matrix: {
    frozenBeforeRender: boolean;
    sampleMatrixHash: string;
    axesCompared: string[];
    recipeVariantsPerSource: number;
    pairedCellsPerSource: number;
    libraries: number;
    totalSourceCells: number;
    cells: InputFieldComparisonCell[];
    everyAxisValueCovered: boolean;
    everyCellMapsExactlyOncePerSource: boolean;
  };
  reviewedMappings: Record<
    string,
    {
      setupSeconds: number;
      decisions: string[];
      unsupportedAgreedCells: string[];
      unsupportedMappingsOutsideMatrix: string[];
      legacyUnsupportedMappings: string[];
    }
  >;
  provenance: {
    harnessHash: string;
    captureCommand: string;
    captureCommandHash: string;
    sourceAdapterHashes: Record<string, string>;
    packages: Record<
      string,
      {
        exactVersion: string;
        sandboxPackageJsonHash: string;
        packageLockHash: string;
        packageIntegrity: string;
        installedSourceTreeHash: string;
      }
    >;
    environmentHash: string;
  };
  references: Captured[];
  outputs: {
    legacy: Captured[];
    recipeReact: Captured[];
    recipeWebComponent: Captured[];
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
    blindReferences: number;
    blindSpecimens: number;
  };
  comparisonCompleteness: {
    exactDenominatorParity: boolean;
    claimsRestrictedToFrozenMatrix: boolean;
    nonComparableBlockers: string[];
    legacyCellSupport: Array<{
      cellKey: string;
      outputPresent: boolean;
      unsupportedMappings: string[];
    }>;
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    sourceReferenceIndependence: boolean;
    sourceReferenceProvenanceComplete: boolean;
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelHashEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
      includedInBlindSpecimens: boolean;
    };
  };
  blindPacket: {
    path: string;
    sealedAnswerKey: string;
    packetHash: string;
    randomizedBatchHash: string;
    recognisabilityVerdictsAuthoredByBuilder: boolean;
    exactIndependentGradingPrompt: string;
  };
}

interface Packet {
  status: string;
  counts: {
    references: number;
    specimens: number;
    specimensPerReference: number;
  };
  randomizedBatchHash: string;
  cells: Array<{
    anonymousCell: string;
    reference: { image: string; screenshotHash: string };
    specimens: Array<{
      anonymousLabel: string;
      image: string;
      outputHash: string;
      grade: {
        recognisable: null;
        defects: unknown[];
        confidence: null;
      };
    }>;
  }>;
}

const validatePacketCardinality = (packet: Packet): void => {
  if (
    packet.cells.length !== 128 ||
    packet.cells.some((cell) => cell.specimens.length !== 2) ||
    packet.cells.flatMap((cell) => cell.specimens).length !== 256
  ) {
    throw new Error(
      "NOT-COMPARABLE: Input/Field blind packet requires exactly 128 references and 256 specimens",
    );
  }
};

test("Input/Field evidence freezes and renders the complete 128-cell denominator", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  assert.deepEqual(receipt.status, {
    evidenceGeneration: "complete",
    independentBlindGrade: "pending",
    legacyRecognisability: "ungraded",
    recipeReactRecognisability: "ungraded",
    recipeWebComponentRecognisability: "ungraded-parity-only",
    inputFieldOverall: false,
  });
  assert.equal(receipt.matrix.frozenBeforeRender, true);
  assert.deepEqual(receipt.matrix.axesCompared, [
    "Size",
    "State",
    "Content",
    "Required",
    "Adornments",
  ]);
  assert.equal(receipt.matrix.recipeVariantsPerSource, 128);
  assert.equal(receipt.matrix.pairedCellsPerSource, 64);
  assert.equal(receipt.matrix.libraries, 2);
  assert.equal(receipt.matrix.totalSourceCells, 128);
  assert.deepEqual(receipt.matrix.cells, INPUT_FIELD_COMPARISON_CELLS);
  validateInputFieldComparisonMatrix(receipt.matrix.cells);
  assert.equal(receipt.matrix.everyAxisValueCovered, true);
  assert.equal(receipt.matrix.everyCellMapsExactlyOncePerSource, true);
  assert.deepEqual(receipt.counts, {
    sourceReferences: 128,
    legacyOutputs: 128,
    recipeReactOutputs: 128,
    recipeWebComponentOutputs: 128,
    blindReferences: 128,
    blindSpecimens: 256,
  });
  assert.equal(receipt.comparisonCompleteness.exactDenominatorParity, true);
  assert.equal(
    receipt.comparisonCompleteness.claimsRestrictedToFrozenMatrix,
    true,
  );
  assert.deepEqual(receipt.comparisonCompleteness.nonComparableBlockers, []);
  assert.equal(
    receipt.comparisonCompleteness.legacyCellSupport.every(
      (cell) => cell.outputPresent,
    ),
    true,
  );
});

test("source references pin exact packages, lineage, environment, and nonzero images", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  assert.equal(receipt.provenance.packages.mui!.exactVersion, "9.2.0");
  assert.equal(receipt.provenance.packages.polaris!.exactVersion, "13.9.5");
  assert.equal(
    json<{ dependencies: Record<string, string> }>(
      "recipe/sandboxes/input-field-mui/package.json",
    ).dependencies["@mui/material"],
    "9.2.0",
  );
  assert.equal(
    json<{ dependencies: Record<string, string> }>(
      "recipe/sandboxes/input-field-polaris/package.json",
    ).dependencies["@shopify/polaris"],
    "13.9.5",
  );
  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    const pin = receipt.provenance.packages[library]!;
    for (const hash of [
      pin.sandboxPackageJsonHash,
      pin.packageLockHash,
      pin.installedSourceTreeHash,
    ]) {
      assert.match(hash, /^[a-f0-9]{64}$/);
    }
    assert.match(pin.packageIntegrity, /^sha512-/);
    const mapping = receipt.reviewedMappings[library]!;
    assert.ok(mapping.setupSeconds > 0);
    assert.ok(mapping.decisions.length > 0);
    assert.deepEqual(mapping.unsupportedAgreedCells, []);
    assert.ok(mapping.unsupportedMappingsOutsideMatrix.length > 0);
    assert.ok(mapping.legacyUnsupportedMappings.length > 0);
  }
  assert.equal(
    receipt.provenance.captureCommand,
    "npx tsx recipe/capture-input-field-comparison.ts",
  );
  assert.equal(
    receipt.provenance.harnessHash,
    sha256File("recipe/capture-input-field-comparison.ts"),
  );
  assert.equal(
    receipt.provenance.captureCommandHash,
    createHash("sha256")
      .update(receipt.provenance.captureCommand)
      .digest("hex"),
  );
  assert.equal(
    receipt.provenance.packages.mui!.sandboxPackageJsonHash,
    sha256File("recipe/sandboxes/input-field-mui/package.json"),
  );
  assert.equal(
    receipt.provenance.packages.mui!.packageLockHash,
    sha256File("recipe/sandboxes/input-field-mui/package-lock.json"),
  );
  assert.equal(
    receipt.provenance.packages.polaris!.sandboxPackageJsonHash,
    sha256File("recipe/sandboxes/input-field-polaris/package.json"),
  );
  assert.equal(
    receipt.provenance.packages.polaris!.packageLockHash,
    sha256File("recipe/sandboxes/input-field-polaris/package-lock.json"),
  );
  for (const library of INPUT_FIELD_COMPARISON_LIBRARIES) {
    assert.equal(
      receipt.provenance.sourceAdapterHashes[library],
      createHash("sha256")
        .update(JSON.stringify(REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS[library]))
        .digest("hex"),
    );
  }
  assert.match(receipt.provenance.captureCommandHash, /^[a-f0-9]{64}$/);
  assert.match(receipt.provenance.harnessHash, /^[a-f0-9]{64}$/);
  assert.match(receipt.provenance.environmentHash, /^[a-f0-9]{64}$/);
  for (const artifact of [
    ...receipt.references,
    ...receipt.outputs.legacy,
    ...receipt.outputs.recipeReact,
    ...receipt.outputs.recipeWebComponent,
  ]) {
    assert.equal(existsSync(artifact.file), true, `${artifact.file} is absent`);
    assert.equal(sha256File(artifact.file), artifact.hash);
    assert.ok(artifact.width > 0 && artifact.height > 0);
    assert.ok(artifact.paintedPixels > 0);
  }
  assert.equal(receipt.nonvisualEvidence.zeroPixelComparisons, 0);
  assert.equal(receipt.nonvisualEvidence.sourceReferenceIndependence, true);
  assert.equal(
    receipt.nonvisualEvidence.sourceReferenceProvenanceComplete,
    true,
  );
  for (const provenance of Object.values(
    receipt.comparisonPin.referenceProvenance,
  )) {
    assert.equal(provenance.independentHarness, true);
    assert.equal(
      provenance.producedBy,
      "independent-original-package-component-harness",
    );
    assert.doesNotMatch(provenance.producedBy, /recipe|legacy|generated/i);
    assert.equal(
      provenance.environmentHash,
      receipt.provenance.environmentHash,
    );
  }
  validatePinnedComparisonEvidence(
    receipt.comparisonPin,
    receipt.manifests.legacy,
    receipt.manifests.recipeReact,
  );
});

test("React and Web Component evidence is semantic, nonzero, and pixel identical", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  assert.deepEqual(receipt.nonvisualEvidence.recipeWebComponentParity, {
    cells: 128,
    nonzeroCells: 128,
    pixelHashEqualToReact: 128,
    geometryEqualToReact: 128,
    semanticProbeEqualToReact: 128,
    includedInBlindSpecimens: false,
  });
  const wcByCell = new Map(
    receipt.outputs.recipeWebComponent.map((cell) => [cell.cellKey, cell]),
  );
  for (const react of receipt.outputs.recipeReact) {
    const wc = wcByCell.get(react.cellKey);
    assert.ok(wc);
    assert.equal(wc.hash, react.hash);
    assert.deepEqual(wc.dom, react.dom);
    assert.equal(react.dom.inputFound, true);
    assert.equal(react.dom.labelFound, true);
    assert.equal(react.dom.labelForMatches, true);
    assert.equal(react.dom.accessibleNameMatched, true);
  }
});

test("blind packet is opaque, separated, ungraded, and exactly 256 specimens", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  const packetText = readFileSync(receipt.blindPacket.path, "utf8");
  assert.equal(
    sha256File(receipt.blindPacket.path),
    receipt.blindPacket.packetHash,
  );
  assert.doesNotMatch(
    packetText,
    /\blegacy\b|recipe[- /]?react|\bmui\b|\bpolaris\b|@shopify|@mui/i,
  );
  assert.notEqual(
    receipt.blindPacket.path,
    receipt.blindPacket.sealedAnswerKey,
  );
  assert.equal(existsSync(receipt.blindPacket.sealedAnswerKey), true);
  assert.equal(
    receipt.blindPacket.recognisabilityVerdictsAuthoredByBuilder,
    false,
  );
  const packet = JSON.parse(packetText) as Packet;
  validatePacketCardinality(packet);
  assert.deepEqual(packet.counts, {
    references: 128,
    specimens: 256,
    specimensPerReference: 2,
  });
  assert.equal(packet.status, "awaiting-independent-blind-grade");
  const labels = packet.cells.flatMap((cell) =>
    cell.specimens.map((specimen) => specimen.anonymousLabel),
  );
  assert.equal(new Set(labels).size, 256);
  assert.equal(
    packet.cells.every(
      (cell) =>
        /^cell-[a-f0-9]{12}$/.test(cell.anonymousCell) &&
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

  const missing = structuredClone(packet);
  missing.cells.pop();
  assert.throws(
    () => validatePacketCardinality(missing),
    /exactly 128 references and 256 specimens/,
  );
});

test("historical 3/11 over 1,415 stays context, not the paired baseline", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);
  assert.deepEqual(
    {
      sets: receipt.historicalInputFieldContext.sets,
      recognisableSets: receipt.historicalInputFieldContext.recognisableSets,
      totalVariants: receipt.historicalInputFieldContext.totalVariants,
      variantWeightedSetVerdict:
        receipt.historicalInputFieldContext.variantWeightedSetVerdict,
      changed: receipt.historicalInputFieldContext.changed,
    },
    {
      sets: 11,
      recognisableSets: 3,
      totalVariants: 1415,
      variantWeightedSetVerdict: "1349/1415",
      changed: false,
    },
  );
  assert.match(
    receipt.historicalInputFieldContext.whyNotPairedBaseline,
    /heterogeneous contracts.*not these two real packages/i,
  );
});

test("planted matrix, one-sided, pixel, provenance, copy, and environment failures go red", () => {
  const receipt = json<Receipt>(`${ROOT}/receipt.json`);

  const missingState = receipt.matrix.cells.filter(
    (cell) => cell.state !== "error",
  );
  assert.throws(
    () => validateInputFieldComparisonMatrix(missingState),
    /requires 128 cells/,
  );

  const duplicate = structuredClone(receipt.matrix.cells);
  duplicate[duplicate.length - 1] = structuredClone(duplicate[0]!);
  assert.throws(
    () => validateInputFieldComparisonMatrix(duplicate),
    /duplicate Input\/Field cell key|duplicate Input\/Field axis product/,
  );

  const oneSided = structuredClone(receipt.manifests.legacy);
  oneSided.cells.pop();
  assert.throws(
    () =>
      validatePinnedComparisonEvidence(
        receipt.comparisonPin,
        oneSided,
        receipt.manifests.recipeReact,
      ),
    /complete pinned sample matrix/,
  );

  const zeroPixels = structuredClone(receipt.manifests.legacy);
  zeroPixels.cells[0]!.comparedPixels = 0;
  assert.throws(
    () =>
      validatePinnedComparisonEvidence(
        receipt.comparisonPin,
        zeroPixels,
        receipt.manifests.recipeReact,
      ),
    /ZERO-COMPARED-PIXELS/,
  );

  for (const [field, expected] of [
    ["sourceHash", /SOURCE-REFERENCE-PROVENANCE/],
    ["environmentHash", /SOURCE-REFERENCE-PROVENANCE/],
  ] as const) {
    const planted = structuredClone(receipt.comparisonPin);
    const first = planted.cellKeys[0]!;
    planted.referenceProvenance[first]![field] = "";
    assert.throws(
      () =>
        validatePinnedComparisonEvidence(
          planted,
          receipt.manifests.legacy,
          receipt.manifests.recipeReact,
        ),
      expected,
    );
  }

  const copied = structuredClone(receipt.comparisonPin);
  copied.referenceProvenance[copied.cellKeys[0]!]!.producedBy =
    "copied-from-recipe-output";
  assert.throws(
    () =>
      validatePinnedComparisonEvidence(
        copied,
        receipt.manifests.legacy,
        receipt.manifests.recipeReact,
      ),
    /SELF-REFERENCE/,
  );

  const environmentMismatch = structuredClone(receipt.comparisonPin);
  environmentMismatch.referenceProvenance[
    environmentMismatch.cellKeys[0]!
  ]!.environmentHash = "different-environment";
  assert.throws(
    () =>
      validatePinnedComparisonEvidence(
        environmentMismatch,
        receipt.manifests.legacy,
        receipt.manifests.recipeReact,
      ),
    /SOURCE-REFERENCE-PROVENANCE/,
  );
});

test("generic recipe, adapter, compiler, and emitter logic contain no source identity branches", () => {
  const generic = [
    "recipe/recipes/input-field.ts",
    "recipe/adapters/input-field.ts",
    "recipe/output/input-field.ts",
  ]
    .map((file) => readFileSync(file, "utf8").toLowerCase())
    .join("\n");
  for (const identity of [
    "@mui/material",
    "@shopify/polaris",
    "mui.text-field",
    "polaris.text-field",
  ]) {
    assert.equal(generic.includes(identity), false);
  }
  assert.equal(
    Object.values(REVIEWED_SOURCE_INPUT_FIELD_ADAPTERS).every(
      (adapter) =>
        adapter.manualSetupSeconds > 0 &&
        adapter.mappingDecisions.length > 0 &&
        adapter.unsupportedMappingsOutsideMatrix.length > 0,
    ),
    true,
  );
});
