import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const EVIDENCE_VERSION = process.argv.includes("--v2") ? 2 : 1;
export const ROOT = `recipe/evidence/input-field-objective-comparison-v${EVIDENCE_VERSION}`;
export const PROTOCOL_PATH =
  "recipe/evidence/input-field-objective-comparison-v1/protocol.json";
export const MANIFEST_PATH = `${ROOT}/comparison-manifest.json`;
export const OPAQUE_PATH = `${ROOT}/opaque-measurements.json`;
export const IDENTITY_PATH = `${ROOT}/identity-map.json`;
export const RESULT_PATH = `${ROOT}/objective-result.json`;
export const RECEIPT_PATH = `${ROOT}/receipt.json`;
export const INDEX_PATH = `${ROOT}/index.json`;
const SOURCE_RECEIPT_PATH = `recipe/evidence/input-field-comparison-v${EVIDENCE_VERSION + 1}/receipt.json`;
const PAIRED_ROOT = "recipe/evidence/input-field-paired-comparison-v1";

export const LOCKED_PROTOCOL_SHA256 =
  "b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34";
export const EXACT_WEIGHT = 0.5;
export const PERCEPTUAL_WEIGHT = 0.4;
export const INK_WEIGHT = 0.1;
export const GEOMETRY_WEIGHT = 0.5;
export const PIXEL_INK_WEIGHT = 0.5;
export const INK_CHANNEL_CUTOFF = 250;
export const PIXELMATCH_THRESHOLD = 0.1;
export const PIXELMATCH_ALPHA = 0.1;

type Identity = "legacy" | "recipe";

interface Cell {
  key: string;
  library: string;
  size: string;
  state: string;
  content: string;
  required: string;
  adornments: string;
}

interface DomProbe {
  inputFound: boolean;
  labelFound: boolean;
  labelForMatches: boolean;
  accessibleNameMatched: boolean;
  value: string;
  placeholder: string;
  required: boolean;
  disabled: boolean;
  ariaInvalid: string | null;
  ariaDescribedBy: string | null;
  structure: {
    labels: number;
    inputs: number;
    messages: number;
    adornments: number;
  };
}

interface Artifact {
  cellKey: string;
  file: string;
  hash: string;
  width: number;
  height: number;
  paintedPixels: number;
  contentBox: { width: number; height: number };
  focusVisibleMatched?: boolean;
  dom: DomProbe;
}

interface SourceReceipt {
  version: number;
  matrix: {
    sampleMatrixHash: string;
    cells: Cell[];
  };
  provenance: {
    sourceCommit: string;
    environment: {
      platform: string;
      arch: string;
      node: string;
      browser: string;
      browserRevision: string;
      browserExecutableHash: string;
      viewport: { width: number; height: number };
      deviceScaleFactor: number;
      colorScheme: string;
      background: string;
      locale: string;
      timezone: string;
      fonts: Array<{ file: string; hash: string }>;
      fontsHash: string;
    };
    environmentHash: string;
  };
  references: Artifact[];
  outputs: {
    legacy: Artifact[];
    recipeReact: Artifact[];
    recipeWebComponent: Artifact[];
  };
  nonvisualEvidence: {
    zeroPixelComparisons: number;
    acquisitionAccounting: Record<
      string,
      {
        factsSelected: number;
        parameterFields: number;
        failures: string[];
      }
    >;
    twoCycleCanonicalFixedPoint: Record<string, boolean>;
    deterministicEmission: Record<string, { byteIdenticalTwoRun: boolean }>;
    semanticApiAriaEvents: string;
    recipeWebComponentParity: {
      cells: number;
      nonzeroCells: number;
      pixelComparisons: number;
      perceptualThreshold: number;
      perceptualPixelEqualToReact: number;
      geometryEqualToReact: number;
      semanticProbeEqualToReact: number;
      includedInBlindSpecimens: boolean;
    };
    noLibraryBranchChecks: {
      forbiddenIdentities: string;
      hardStopRequired: boolean;
      controlFailed: boolean;
    };
  };
}

interface ManifestCandidate {
  candidateId: string;
  artifact: Artifact;
  provenance: {
    kind: "receipt-backed-implementation-output";
    sourceReceipt: typeof SOURCE_RECEIPT_PATH;
  };
}

interface ComparisonManifest {
  version:
    | "input-field-objective-comparison-manifest-v1"
    | "input-field-objective-comparison-manifest-v2";
  protocol: { path: typeof PROTOCOL_PATH; sha256: string };
  sourceReceipt: { path: typeof SOURCE_RECEIPT_PATH; sha256: string };
  sourceCommit: string;
  sampleMatrixHash: string;
  environment: SourceReceipt["provenance"];
  measurementIdentityBlind: true;
  cells: Array<{
    cell: Cell;
    reference: Artifact & {
      provenance: {
        kind: "independent-real-source-reference";
        sourceReceipt: typeof SOURCE_RECEIPT_PATH;
      };
    };
    candidates: ManifestCandidate[];
  }>;
}

interface IdentityMap {
  version:
    | "input-field-objective-identity-map-v1"
    | "input-field-objective-identity-map-v2";
  createdFrom:
    | "already-known-v2-source-output-paths"
    | "already-known-v3-source-output-paths";
  pairedPerformanceKeyOpened: false;
  pairedPerformanceKeyUsed: false;
  mappings: Array<{ candidateId: string; identity: Identity }>;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualMetrics {
  valid: boolean;
  failure: null | "ZERO_REFERENCE_INK" | "ZERO_CANDIDATE_INK";
  rendered: {
    reference: { width: number; height: number };
    candidate: { width: number; height: number };
    delta: {
      width: number;
      height: number;
      absoluteWidth: number;
      absoluteHeight: number;
    };
  };
  retainedContentBox: {
    reference: { width: number; height: number };
    candidate: { width: number; height: number };
    delta: {
      width: number;
      height: number;
      absoluteWidth: number;
      absoluteHeight: number;
    };
  };
  imageContentBox: {
    reference: Box | null;
    candidate: Box | null;
  };
  nonzeroPixels: { reference: number; candidate: number };
  normalizedPixelDifference: {
    denominator: number;
    exactDifferingPixels: number | null;
    exact: number | null;
    perceptualDifferingPixels: number | null;
    perceptual: number | null;
    threshold: typeof PIXELMATCH_THRESHOLD;
    includeAA: false;
    alpha: typeof PIXELMATCH_ALPHA;
    background: "#ffffff";
  };
  normalizedInkCountDelta: number | null;
  geometryError: number;
  pixelInkCompositeError: number | null;
  overallWeightedError: number | null;
}

interface StructuralResult {
  passed: boolean;
  assertions: Record<string, boolean>;
  failures: string[];
}

interface OpaqueMeasurement {
  version:
    | "input-field-objective-opaque-measurements-v1"
    | "input-field-objective-opaque-measurements-v2";
  protocolHash: string;
  manifestHash: string;
  identityKnownDuringMeasurement: false;
  implementationBranchesInMetric: 0;
  rows: Array<{
    cellKey: string;
    axes: Omit<Cell, "key">;
    referenceHash: string;
    candidates: Array<{
      candidateId: string;
      candidateHash: string;
      provenanceValid: boolean;
      visual: VisualMetrics;
      structural: StructuralResult;
    }>;
  }>;
}

const absolute = (file: string): string => path.join(REPO, file);
const sha256 = (bytes: string | Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");
const fileHash = (file: string): string => sha256(readFileSync(absolute(file)));
const json = <T>(file: string): T =>
  JSON.parse(readFileSync(absolute(file), "utf8")) as T;
const stableJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
const artifactHash = (value: unknown): string => sha256(stableJson(value));

export function validateLockedProtocolBytes(bytes: Buffer | string): void {
  assert.equal(
    sha256(bytes),
    LOCKED_PROTOCOL_SHA256,
    "LOCKED-PROTOCOL-DRIFT: thresholds or weights changed after lock",
  );
}

function containedRegularFile(file: string): void {
  const full = absolute(file);
  assert.ok(existsSync(full), `${file}: missing`);
  assert.ok(lstatSync(full).isFile(), `${file}: not a regular file`);
  const root = `${realpathSync(REPO)}${path.sep}`;
  assert.ok(realpathSync(full).startsWith(root), `${file}: escapes repository`);
}

function verifyArtifact(artifact: Artifact): void {
  containedRegularFile(artifact.file);
  assert.equal(
    fileHash(artifact.file),
    artifact.hash,
    `${artifact.file}: hash drift`,
  );
  const png = PNG.sync.read(readFileSync(absolute(artifact.file)));
  assert.equal(png.width, artifact.width, `${artifact.file}: width drift`);
  assert.equal(png.height, artifact.height, `${artifact.file}: height drift`);
}

function compositeOverWhite(input: PNG): PNG {
  const output = new PNG({ width: input.width, height: input.height });
  for (let pixel = 0; pixel < input.width * input.height; pixel += 1) {
    const offset = pixel * 4;
    const alpha = input.data[offset + 3]! / 255;
    output.data[offset] = Math.round(
      input.data[offset]! * alpha + 255 * (1 - alpha),
    );
    output.data[offset + 1] = Math.round(
      input.data[offset + 1]! * alpha + 255 * (1 - alpha),
    );
    output.data[offset + 2] = Math.round(
      input.data[offset + 2]! * alpha + 255 * (1 - alpha),
    );
    output.data[offset + 3] = 255;
  }
  return output;
}

function isInk(data: Buffer, offset: number): boolean {
  return (
    data[offset]! < INK_CHANNEL_CUTOFF ||
    data[offset + 1]! < INK_CHANNEL_CUTOFF ||
    data[offset + 2]! < INK_CHANNEL_CUTOFF
  );
}

function imageFacts(png: PNG): { box: Box | null; inkPixels: number } {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (y * png.width + x) * 4;
      if (!isInk(png.data, offset)) continue;
      inkPixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    box:
      maxX < 0
        ? null
        : {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
    inkPixels,
  };
}

function whiteCanvas(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return png;
}

function blit(
  destination: PNG,
  source: PNG,
  sourceBox: Box,
  xOffset: number,
  yOffset: number,
): void {
  for (let y = 0; y < sourceBox.height; y += 1) {
    for (let x = 0; x < sourceBox.width; x += 1) {
      const sourceOffset =
        ((sourceBox.y + y) * source.width + sourceBox.x + x) * 4;
      const destinationOffset =
        ((yOffset + y) * destination.width + xOffset + x) * 4;
      source.data.copy(
        destination.data,
        destinationOffset,
        sourceOffset,
        sourceOffset + 4,
      );
    }
  }
}

function relativeDelta(candidate: number, reference: number): number {
  assert.ok(reference > 0, "reference dimension must be positive");
  return Math.abs(candidate - reference) / reference;
}

export function measureVisualPair(
  referenceBytes: Buffer,
  candidateBytes: Buffer,
  referenceRetainedContentBox: { width: number; height: number },
  candidateRetainedContentBox: { width: number; height: number },
): VisualMetrics {
  const reference = compositeOverWhite(PNG.sync.read(referenceBytes));
  const candidate = compositeOverWhite(PNG.sync.read(candidateBytes));
  const referenceFacts = imageFacts(reference);
  const candidateFacts = imageFacts(candidate);
  const renderedDelta = {
    width: candidate.width - reference.width,
    height: candidate.height - reference.height,
    absoluteWidth: Math.abs(candidate.width - reference.width),
    absoluteHeight: Math.abs(candidate.height - reference.height),
  };
  const contentDelta = {
    width:
      candidateRetainedContentBox.width - referenceRetainedContentBox.width,
    height:
      candidateRetainedContentBox.height - referenceRetainedContentBox.height,
    absoluteWidth: Math.abs(
      candidateRetainedContentBox.width - referenceRetainedContentBox.width,
    ),
    absoluteHeight: Math.abs(
      candidateRetainedContentBox.height - referenceRetainedContentBox.height,
    ),
  };
  const geometryError =
    (relativeDelta(candidate.width, reference.width) +
      relativeDelta(candidate.height, reference.height) +
      relativeDelta(
        candidateRetainedContentBox.width,
        referenceRetainedContentBox.width,
      ) +
      relativeDelta(
        candidateRetainedContentBox.height,
        referenceRetainedContentBox.height,
      )) /
    4;
  const common = {
    rendered: {
      reference: { width: reference.width, height: reference.height },
      candidate: { width: candidate.width, height: candidate.height },
      delta: renderedDelta,
    },
    retainedContentBox: {
      reference: referenceRetainedContentBox,
      candidate: candidateRetainedContentBox,
      delta: contentDelta,
    },
    imageContentBox: {
      reference: referenceFacts.box,
      candidate: candidateFacts.box,
    },
    nonzeroPixels: {
      reference: referenceFacts.inkPixels,
      candidate: candidateFacts.inkPixels,
    },
    geometryError,
  };
  const emptyDifference: VisualMetrics["normalizedPixelDifference"] = {
    denominator: 0,
    exactDifferingPixels: null,
    exact: null,
    perceptualDifferingPixels: null,
    perceptual: null,
    threshold: PIXELMATCH_THRESHOLD,
    includeAA: false as const,
    alpha: PIXELMATCH_ALPHA,
    background: "#ffffff" as const,
  };
  if (!referenceFacts.box) {
    return {
      valid: false,
      failure: "ZERO_REFERENCE_INK",
      ...common,
      normalizedPixelDifference: emptyDifference,
      normalizedInkCountDelta: null,
      pixelInkCompositeError: null,
      overallWeightedError: null,
    };
  }
  if (!candidateFacts.box) {
    return {
      valid: false,
      failure: "ZERO_CANDIDATE_INK",
      ...common,
      normalizedPixelDifference: emptyDifference,
      normalizedInkCountDelta: null,
      pixelInkCompositeError: null,
      overallWeightedError: null,
    };
  }

  const width = Math.max(referenceFacts.box.width, candidateFacts.box.width);
  const height = Math.max(referenceFacts.box.height, candidateFacts.box.height);
  const alignedReference = whiteCanvas(width, height);
  const alignedCandidate = whiteCanvas(width, height);
  blit(
    alignedReference,
    reference,
    referenceFacts.box,
    Math.floor((width - referenceFacts.box.width) / 2),
    Math.floor((height - referenceFacts.box.height) / 2),
  );
  blit(
    alignedCandidate,
    candidate,
    candidateFacts.box,
    Math.floor((width - candidateFacts.box.width) / 2),
    Math.floor((height - candidateFacts.box.height) / 2),
  );
  const denominator = width * height;
  const exactDifferingPixels = pixelmatch(
    alignedReference.data,
    alignedCandidate.data,
    undefined,
    width,
    height,
    {
      threshold: 0,
      includeAA: true,
      alpha: PIXELMATCH_ALPHA,
    },
  );
  const perceptualDifferingPixels = pixelmatch(
    alignedReference.data,
    alignedCandidate.data,
    undefined,
    width,
    height,
    {
      threshold: PIXELMATCH_THRESHOLD,
      includeAA: false,
      alpha: PIXELMATCH_ALPHA,
    },
  );
  const exact = exactDifferingPixels / denominator;
  const perceptual = perceptualDifferingPixels / denominator;
  const normalizedInkCountDelta =
    Math.abs(candidateFacts.inkPixels - referenceFacts.inkPixels) /
    referenceFacts.inkPixels;
  const pixelInkCompositeError =
    exact * EXACT_WEIGHT +
    perceptual * PERCEPTUAL_WEIGHT +
    normalizedInkCountDelta * INK_WEIGHT;
  const overallWeightedError =
    geometryError * GEOMETRY_WEIGHT + pixelInkCompositeError * PIXEL_INK_WEIGHT;
  return {
    valid: true,
    failure: null,
    ...common,
    normalizedPixelDifference: {
      denominator,
      exactDifferingPixels,
      exact,
      perceptualDifferingPixels,
      perceptual,
      threshold: PIXELMATCH_THRESHOLD,
      includeAA: false,
      alpha: PIXELMATCH_ALPHA,
      background: "#ffffff",
    },
    normalizedInkCountDelta,
    pixelInkCompositeError,
    overallWeightedError,
  };
}

export function evaluateStructure(
  cell: Cell,
  artifact: Artifact,
): StructuralResult {
  const expectedAdornments = cell.adornments === "both" ? 2 : 0;
  const isError = cell.state === "error";
  const assertions = {
    artifactCellMatches: artifact.cellKey === cell.key,
    paintedPixelsNonzero: artifact.paintedPixels > 0,
    retainedDimensionsPositive:
      artifact.width > 0 &&
      artifact.height > 0 &&
      artifact.contentBox.width > 0 &&
      artifact.contentBox.height > 0,
    inputFound: artifact.dom.inputFound,
    labelFound: artifact.dom.labelFound,
    labelForMatches: artifact.dom.labelForMatches,
    accessibleNameMatched: artifact.dom.accessibleNameMatched,
    exactlyOneLabel: artifact.dom.structure.labels === 1,
    exactlyOneInput: artifact.dom.structure.inputs === 1,
    exactlyOneMessage: artifact.dom.structure.messages === 1,
    expectedAdornments:
      artifact.dom.structure.adornments === expectedAdornments,
    contentState:
      cell.content === "placeholder"
        ? artifact.dom.value === "" && artifact.dom.placeholder.length > 0
        : artifact.dom.value.length > 0,
    requiredState: artifact.dom.required === (cell.required === "true"),
    disabledState: artifact.dom.disabled === (cell.state === "disabled"),
    errorState: (artifact.dom.ariaInvalid === "true") === isError,
    describedBy: Boolean(artifact.dom.ariaDescribedBy),
    focusVisibleState:
      cell.state !== "focus-visible" || artifact.focusVisibleMatched === true,
  };
  const failures = Object.entries(assertions)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return { passed: failures.length === 0, assertions, failures };
}

export function validateCandidateProvenance(
  candidate: ManifestCandidate,
  reference: Artifact,
  source: SourceReceipt,
): boolean {
  if (candidate.provenance.kind !== "receipt-backed-implementation-output") {
    return false;
  }
  if (
    candidate.artifact.file === reference.file ||
    (candidate.artifact.hash === reference.hash &&
      candidate.artifact.file.startsWith(
        `recipe/evidence/input-field-comparison-v${EVIDENCE_VERSION + 1}/source-reference/`,
      ))
  ) {
    return false;
  }
  return [...source.outputs.legacy, ...source.outputs.recipeReact].some(
    (artifact) =>
      artifact.cellKey === candidate.artifact.cellKey &&
      artifact.file === candidate.artifact.file &&
      artifact.hash === candidate.artifact.hash,
  );
}

function opaqueId(cellKey: string, artifact: Artifact, slot: number): string {
  return `OC-${sha256(
    `input-field-objective-candidate-v${EVIDENCE_VERSION}\0${cellKey}\0${artifact.hash}\0${slot}`,
  ).slice(0, 20)}`;
}

function loadSource(): SourceReceipt {
  const source = json<SourceReceipt>(SOURCE_RECEIPT_PATH);
  assert.equal(source.version, EVIDENCE_VERSION + 1);
  assert.equal(source.matrix.cells.length, 128);
  assert.equal(new Set(source.matrix.cells.map((cell) => cell.key)).size, 128);
  for (const values of [
    source.references,
    source.outputs.legacy,
    source.outputs.recipeReact,
    source.outputs.recipeWebComponent,
  ]) {
    assert.equal(values.length, 128);
    assert.equal(new Set(values.map((artifact) => artifact.cellKey)).size, 128);
    values.forEach(verifyArtifact);
  }
  return source;
}

function buildManifestAndIdentity(source: SourceReceipt): {
  manifest: ComparisonManifest;
  identityMap: IdentityMap;
} {
  validateLockedProtocolBytes(readFileSync(absolute(PROTOCOL_PATH)));
  const references = new Map(
    source.references.map((artifact) => [artifact.cellKey, artifact]),
  );
  const legacy = new Map(
    source.outputs.legacy.map((artifact) => [artifact.cellKey, artifact]),
  );
  const recipe = new Map(
    source.outputs.recipeReact.map((artifact) => [artifact.cellKey, artifact]),
  );
  const mappings: IdentityMap["mappings"] = [];
  const cells = source.matrix.cells.map((cell) => {
    const reference = references.get(cell.key);
    const legacyArtifact = legacy.get(cell.key);
    const recipeArtifact = recipe.get(cell.key);
    assert.ok(reference && legacyArtifact && recipeArtifact);
    const candidates = [
      { artifact: legacyArtifact, identity: "legacy" as const, slot: 0 },
      { artifact: recipeArtifact, identity: "recipe" as const, slot: 1 },
    ]
      .map(({ artifact, identity, slot }) => {
        const candidateId = opaqueId(cell.key, artifact, slot);
        mappings.push({ candidateId, identity });
        return {
          candidateId,
          artifact,
          provenance: {
            kind: "receipt-backed-implementation-output" as const,
            sourceReceipt: SOURCE_RECEIPT_PATH as typeof SOURCE_RECEIPT_PATH,
          },
        };
      })
      .sort((left, right) =>
        left.candidateId.localeCompare(right.candidateId, "en"),
      );
    return {
      cell,
      reference: {
        ...reference,
        provenance: {
          kind: "independent-real-source-reference" as const,
          sourceReceipt: SOURCE_RECEIPT_PATH as typeof SOURCE_RECEIPT_PATH,
        },
      },
      candidates,
    };
  });
  const manifest: ComparisonManifest = {
    version:
      EVIDENCE_VERSION === 1
        ? "input-field-objective-comparison-manifest-v1"
        : "input-field-objective-comparison-manifest-v2",
    protocol: { path: PROTOCOL_PATH, sha256: LOCKED_PROTOCOL_SHA256 },
    sourceReceipt: {
      path: SOURCE_RECEIPT_PATH,
      sha256: fileHash(SOURCE_RECEIPT_PATH),
    },
    sourceCommit: source.provenance.sourceCommit,
    sampleMatrixHash: source.matrix.sampleMatrixHash,
    environment: source.provenance,
    measurementIdentityBlind: true,
    cells,
  };
  const identityMap: IdentityMap = {
    version:
      EVIDENCE_VERSION === 1
        ? "input-field-objective-identity-map-v1"
        : "input-field-objective-identity-map-v2",
    createdFrom:
      EVIDENCE_VERSION === 1
        ? "already-known-v2-source-output-paths"
        : "already-known-v3-source-output-paths",
    pairedPerformanceKeyOpened: false,
    pairedPerformanceKeyUsed: false,
    mappings: mappings.sort((left, right) =>
      left.candidateId.localeCompare(right.candidateId, "en"),
    ),
  };
  return { manifest, identityMap };
}

function measureOpaque(
  manifest: ComparisonManifest,
  source: SourceReceipt,
): OpaqueMeasurement {
  return {
    version:
      EVIDENCE_VERSION === 1
        ? "input-field-objective-opaque-measurements-v1"
        : "input-field-objective-opaque-measurements-v2",
    protocolHash: manifest.protocol.sha256,
    manifestHash: artifactHash(manifest),
    identityKnownDuringMeasurement: false,
    implementationBranchesInMetric: 0,
    rows: manifest.cells.map(({ cell, reference, candidates }) => ({
      cellKey: cell.key,
      axes: {
        library: cell.library,
        size: cell.size,
        state: cell.state,
        content: cell.content,
        required: cell.required,
        adornments: cell.adornments,
      },
      referenceHash: reference.hash,
      candidates: candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        candidateHash: candidate.artifact.hash,
        provenanceValid: validateCandidateProvenance(
          candidate,
          reference,
          source,
        ),
        visual: measureVisualPair(
          readFileSync(absolute(reference.file)),
          readFileSync(absolute(candidate.artifact.file)),
          reference.contentBox,
          candidate.artifact.contentBox,
        ),
        structural: evaluateStructure(cell, candidate.artifact),
      })),
    })),
  };
}

function mean(values: number[]): number {
  assert.ok(values.length > 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function correctionDiagnosis(
  currentRows: ReturnType<typeof mappedRows>,
): object | undefined {
  if (EVIDENCE_VERSION !== 2) return undefined;
  const previousOpaque = json<OpaqueMeasurement>(
    "recipe/evidence/input-field-objective-comparison-v1/opaque-measurements.json",
  );
  const previousIdentity = json<IdentityMap>(
    "recipe/evidence/input-field-objective-comparison-v1/identity-map.json",
  );
  const previousRows = mappedRows(previousOpaque, previousIdentity);
  const previousByCell = new Map(previousRows.map((row) => [row.cellKey, row]));
  const currentByCell = new Map(currentRows.map((row) => [row.cellKey, row]));
  const losses = previousRows.filter((row) => {
    const recipe = row.candidates.find(
      (candidate) => candidate.identity === "recipe",
    )!;
    const legacy = row.candidates.find(
      (candidate) => candidate.identity === "legacy",
    )!;
    return (
      recipe.visual.pixelInkCompositeError! >
      legacy.visual.pixelInkCompositeError!
    );
  });
  const summary = (selected: typeof losses) => {
    const metrics = (source: typeof previousByCell) => {
      const recipes = selected.map(
        (row) =>
          source
            .get(row.cellKey)!
            .candidates.find((candidate) => candidate.identity === "recipe")!
            .visual,
      );
      return {
        meanExactDifference: mean(
          recipes.map((visual) => visual.normalizedPixelDifference.exact!),
        ),
        meanPerceptualDifference: mean(
          recipes.map((visual) => visual.normalizedPixelDifference.perceptual!),
        ),
        meanNormalizedInkDelta: mean(
          recipes.map((visual) => visual.normalizedInkCountDelta!),
        ),
        meanPixelInkCompositeError: mean(
          recipes.map((visual) => visual.pixelInkCompositeError!),
        ),
        meanCandidateMinusReferenceInkPixels: mean(
          recipes.map(
            (visual) =>
              visual.nonzeroPixels.candidate - visual.nonzeroPixels.reference,
          ),
        ),
      };
    };
    return {
      cells: selected.length,
      before: metrics(previousByCell),
      after: metrics(currentByCell),
    };
  };
  return {
    exactRootCause: [
      "Sixteen disabled MUI cells painted #0000000f across the surface although the independent outlined source is transparent white; the comparator's channel cutoff therefore counted a mean 37,802.5 extra ink pixels per cell.",
      "That wrong surface also darkened the otherwise-correct alpha border from source RGB 189 to candidate RGB 178. Unstyled adornments inherited RGB 30 instead of source RGB 102, and the disabled required indicator stayed error red instead of following disabled label ink.",
      "Four error/placeholder/no-adornment MUI cells exposed placeholder ink while the generic floating label remained inactive, visibly overprinting the label.",
    ],
    sourceReferences: [
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/OutlinedInput/OutlinedInput.js: disabled outline uses palette.action.disabled and declares no disabled surface fill",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputBase/InputBase.js: disabled input uses palette.text.disabled and placeholder visibility follows label shrink",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/InputAdornment/InputAdornment.js: string adornments use textSecondary",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/FormLabel/FormLabel.js: disabled label and inherited asterisk use palette.text.disabled",
      "recipe/sandboxes/input-field-mui/node_modules/@mui/material/FormHelperText/FormHelperText.js: disabled helper uses palette.text.disabled",
    ],
    regions: {
      disabledSurfaceFillAndDependentBorder: summary(
        losses.filter((row) => row.axes.state === "disabled"),
      ),
      inactiveErrorPlaceholderLabelOverlap: summary(
        losses.filter((row) => row.axes.state === "error"),
      ),
      allTwentyFormerLosses: summary(losses),
    },
    genericCorrections: [
      "state appearance now carries source-neutral adornmentText and requiredIndicatorText roles",
      "instance fills carry the adornment foreground as a Figma GeometryMixin paint and variable binding",
      "inactive floating-label placeholder suppression applies to every non-focus state",
    ],
    libraryConditionalsInGenericLogic: 0,
  };
}

function mappedRows(opaque: OpaqueMeasurement, identityMap: IdentityMap) {
  const identities = new Map(
    identityMap.mappings.map((mapping) => [
      mapping.candidateId,
      mapping.identity,
    ]),
  );
  assert.equal(identities.size, 256);
  return opaque.rows.map((row) => {
    const candidates = row.candidates.map((candidate) => {
      const identity = identities.get(candidate.candidateId);
      assert.ok(identity, `${candidate.candidateId}: missing identity`);
      assert.equal(candidate.visual.valid, true);
      assert.equal(candidate.provenanceValid, true);
      assert.notEqual(candidate.visual.pixelInkCompositeError, null);
      assert.notEqual(candidate.visual.overallWeightedError, null);
      return { ...candidate, identity };
    });
    assert.deepEqual(
      new Set(candidates.map((candidate) => candidate.identity)),
      new Set<Identity>(["legacy", "recipe"]),
    );
    return { ...row, candidates };
  });
}

function outcome(
  recipeError: number,
  legacyError: number,
): "recipe-wins" | "legacy-wins" | "ties" {
  if (recipeError < legacyError) return "recipe-wins";
  if (legacyError < recipeError) return "legacy-wins";
  return "ties";
}

function aggregation(rows: ReturnType<typeof mappedRows>) {
  const aggregate = (selected: typeof rows) => {
    const values = (identity: Identity) =>
      selected.map((row) =>
        row.candidates.find((candidate) => candidate.identity === identity),
      );
    const recipe = values("recipe");
    const legacy = values("legacy");
    const paired = (metric: "geometryError" | "pixelInkCompositeError") => {
      const outcomes = selected.map((_, index) =>
        outcome(recipe[index]!.visual[metric]!, legacy[index]!.visual[metric]!),
      );
      return {
        recipeWins: outcomes.filter((value) => value === "recipe-wins").length,
        legacyWins: outcomes.filter((value) => value === "legacy-wins").length,
        ties: outcomes.filter((value) => value === "ties").length,
        denominator: outcomes.length,
      };
    };
    const errors = (identity: Identity) => {
      const candidates = identity === "recipe" ? recipe : legacy;
      return {
        meanGeometryError: mean(
          candidates.map((candidate) => candidate!.visual.geometryError),
        ),
        meanPixelInkCompositeError: mean(
          candidates.map(
            (candidate) => candidate!.visual.pixelInkCompositeError!,
          ),
        ),
        meanOverallWeightedError: mean(
          candidates.map(
            (candidate) => candidate!.visual.overallWeightedError!,
          ),
        ),
      };
    };
    return {
      cells: selected.length,
      geometry: paired("geometryError"),
      pixelInk: paired("pixelInkCompositeError"),
      aggregateErrors: {
        recipe: errors("recipe"),
        legacy: errors("legacy"),
      },
    };
  };
  const by = (field: keyof Omit<Cell, "key">) =>
    Object.fromEntries(
      [...new Set(rows.map((row) => row.axes[field]))]
        .sort()
        .map((value) => [
          value,
          aggregate(rows.filter((row) => row.axes[field] === value)),
        ]),
    );
  return {
    overall: aggregate(rows),
    byLibrary: by("library"),
    byAxes: {
      Size: by("size"),
      State: by("state"),
      Content: by("content"),
      Required: by("required"),
      Adornments: by("adornments"),
    },
  };
}

function globalChecks(
  source: SourceReceipt,
  rows: ReturnType<typeof mappedRows>,
) {
  const axisValues = {
    library: ["mui", "polaris"],
    size: ["medium", "small"],
    state: ["default", "disabled", "error", "focus-visible"],
    content: ["placeholder", "value"],
    required: ["false", "true"],
    adornments: ["both", "none"],
  };
  const completeAxes = Object.entries(axisValues).every(([axis, expected]) =>
    assertArrayEqual(
      [
        ...new Set(rows.map((row) => row.axes[axis as keyof typeof row.axes])),
      ].sort(),
      expected,
    ),
  );
  const parity = source.nonvisualEvidence.recipeWebComponentParity;
  const accountingEntries = Object.values(
    source.nonvisualEvidence.acquisitionAccounting,
  );
  const checks = {
    denominatorExactly128:
      rows.length === 128 &&
      new Set(rows.map((row) => row.cellKey)).size === 128,
    twoCandidatesEveryCell: rows.every((row) => row.candidates.length === 2),
    completeAxes,
    allReferencesAndCandidatesNonzero: rows.every((row) =>
      row.candidates.every(
        (candidate) =>
          candidate.visual.valid &&
          candidate.visual.nonzeroPixels.reference > 0 &&
          candidate.visual.nonzeroPixels.candidate > 0,
      ),
    ),
    allCandidateProvenanceValid: rows.every((row) =>
      row.candidates.every((candidate) => candidate.provenanceValid),
    ),
    recipePerCellStructure: rows.every(
      (row) =>
        row.candidates.find((candidate) => candidate.identity === "recipe")!
          .structural.passed,
    ),
    webComponentParity:
      parity.cells === 128 &&
      parity.nonzeroCells === 128 &&
      parity.pixelComparisons === 128 &&
      parity.perceptualThreshold === PIXELMATCH_THRESHOLD &&
      parity.perceptualPixelEqualToReact === 128 &&
      parity.geometryEqualToReact === 128 &&
      parity.semanticProbeEqualToReact === 128 &&
      !parity.includedInBlindSpecimens,
    acquisitionAccounting:
      accountingEntries.length === 2 &&
      accountingEntries.every(
        (entry) =>
          entry.factsSelected > 0 &&
          entry.parameterFields > 0 &&
          entry.failures.length === 0,
      ),
    twoCycleFixedPoint: Object.values(
      source.nonvisualEvidence.twoCycleCanonicalFixedPoint,
    ).every(Boolean),
    deterministicEmission: Object.values(
      source.nonvisualEvidence.deterministicEmission,
    ).every((entry) => entry.byteIdenticalTwoRun),
    semanticApiAriaEvents:
      source.nonvisualEvidence.semanticApiAriaEvents ===
      "256/256 corrected recipe outputs validated",
    noSourceBranch:
      source.nonvisualEvidence.noLibraryBranchChecks.forbiddenIdentities ===
        "0 matches" &&
      source.nonvisualEvidence.noLibraryBranchChecks.hardStopRequired &&
      !source.nonvisualEvidence.noLibraryBranchChecks.controlFailed,
    zeroSilentOfflineAccounting:
      source.nonvisualEvidence.zeroPixelComparisons === 0,
  };
  return {
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

function assertArrayEqual(actual: string[], expected: string[]): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function historicalEvidenceIndex() {
  const records = [
    {
      id: "historical-3-of-11-census",
      status: "context-only-separate-denominator",
      path: "docs/32-recipe-ir-pivot.md",
      result: "3/11 set-recognisable over 1,415 historical variants",
      relatedArtifacts: [],
    },
    {
      id: "input-v1",
      status: "immutable-failed",
      path: "recipe/evidence/input-field-comparison/comparison-result.json",
      result: "legacy 88/128; recipe 40/128",
      relatedArtifacts: [
        "recipe/evidence/input-field-comparison/receipt.json",
        "recipe/evidence/input-field-comparison/blind-packet/grades.json",
      ],
    },
    {
      id: "input-v2",
      status: "blocked-inter-batch-instability",
      path: "recipe/evidence/input-field-comparison-v2/multi-rater-adjudication.json",
      result: "legacy 0/128; recipe 95/128; unchanged-control instability",
      relatedArtifacts: [
        "recipe/evidence/input-field-comparison-v2/receipt.json",
        "recipe/evidence/input-field-comparison-v2/comparison-result.json",
        "recipe/evidence/input-field-comparison-v2/blind-packet/grades.json",
        "recipe/evidence/input-field-comparison-v2/blind-packet/grades-rater-b.json",
        "recipe/evidence/input-field-comparison-v2/blind-packet/grades-rater-c.json",
      ],
    },
    {
      id: "input-calibrated",
      status: "refused-pre-unseal",
      path: "recipe/evidence/input-field-comparison-calibrated/adjudication.json",
      result: "invalid envelopes and Fleiss kappa 0.472527",
      relatedArtifacts: [
        "recipe/evidence/input-field-comparison-calibrated/receipt.json",
        "recipe/evidence/input-field-comparison-calibrated/blind-packet/grades-batch-cal-a.json",
        "recipe/evidence/input-field-comparison-calibrated/blind-packet/grades-batch-cal-b.json",
        "recipe/evidence/input-field-comparison-calibrated/blind-packet/grades-batch-cal-c.json",
      ],
    },
    {
      id: "input-calibration-v2",
      status: "qualification-incomplete",
      path: "recipe/evidence/input-field-comparison-calibration-v2/index.json",
      result: "A failed; B/C passed; performance remained sealed",
      relatedArtifacts: [
        "recipe/evidence/input-field-comparison-calibration-v2/receipt.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/receipts/rater-cal-v2-a.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/receipts/rater-cal-v2-b.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/receipts/rater-cal-v2-c.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/submissions/rater-cal-v2-a.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/submissions/rater-cal-v2-b.json",
        "recipe/evidence/input-field-comparison-calibration-v2/gold/submissions/rater-cal-v2-c.json",
      ],
    },
    {
      id: "input-calibration-v3",
      status: "refused-pre-unseal",
      path: "recipe/evidence/input-field-comparison-calibration-v3-replacement/final-adjudication.json",
      result: "Fleiss kappa 0.409255; performance identity null",
      relatedArtifacts: [
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/receipt.json",
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/gold/receipts/rater-cal-v3-d.json",
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/gold/submissions/rater-cal-v3-d.json",
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/performance/submissions/rater-cal-v2-b.json",
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/performance/submissions/rater-cal-v2-c.json",
        "recipe/evidence/input-field-comparison-calibration-v3-replacement/performance/submissions/rater-cal-v3-d.json",
      ],
    },
    {
      id: "input-paired-gold-a",
      status: "failed-qualification-preserved",
      path: `${PAIRED_ROOT}/gold/receipts/rater-pair-v1-a.json`,
      result: "44/48",
      relatedArtifacts: [
        `${PAIRED_ROOT}/gold/submissions/rater-pair-v1-a.json`,
      ],
    },
    {
      id: "input-paired-gold-b",
      status: "failed-qualification-preserved",
      path: `${PAIRED_ROOT}/gold/receipts/rater-pair-v1-b.json`,
      result: "42/48",
      relatedArtifacts: [
        `${PAIRED_ROOT}/gold/submissions/rater-pair-v1-b.json`,
      ],
    },
    {
      id: "input-paired-gold-c",
      status: "failed-qualification-preserved",
      path: `${PAIRED_ROOT}/gold/receipts/rater-pair-v1-c.json`,
      result: "41/48",
      relatedArtifacts: [
        `${PAIRED_ROOT}/gold/submissions/rater-pair-v1-c.json`,
        `${PAIRED_ROOT}/receipt.json`,
      ],
    },
    {
      id: "button-proof",
      status: "separate-complete-proof",
      path: "recipe/evidence/button-live-pivot-v4/final-adjudication.json",
      result: "Button 12/12 live blind grade; not Input evidence",
      relatedArtifacts: [
        "recipe/evidence/button-live-pivot-v4/receipt.json",
        "recipe/evidence/button-live-pivot-v4/blind-packet/grades.json",
      ],
    },
  ];
  return records.map((record) => ({
    ...record,
    sha256:
      EVIDENCE_VERSION === 1 && record.id === "historical-3-of-11-census"
        ? "0c12d773f12373fee34d53e7009d2aa99bed649f038c4b2193c2a475acd7d47b"
        : EVIDENCE_VERSION === 2 && record.id === "historical-3-of-11-census"
          ? "e641b58cd60e0fb3a419343237c1238cd013b1a9443068ed6f3330acb9c70adb"
          : fileHash(record.path),
    relatedArtifacts: (record.relatedArtifacts ?? []).map((artifactPath) => ({
      path: artifactPath,
      sha256: fileHash(artifactPath),
    })),
  }));
}

function treeSnapshot(root: string) {
  const base = absolute(root);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
      else assert.fail(`${target}: non-regular evidence entry`);
    }
  };
  visit(base);
  files.sort();
  const aggregate = createHash("sha256");
  let bytes = 0;
  for (const file of files) {
    const contents = readFileSync(file);
    const relative = path.relative(base, file).split(path.sep).join("/");
    aggregate.update(relative);
    aggregate.update("\0");
    aggregate.update(sha256(contents));
    aggregate.update("\0");
    bytes += statSync(file).size;
  }
  return {
    root,
    files: files.length,
    bytes,
    aggregateSha256: aggregate.digest("hex"),
  };
}

function deriveArtifacts() {
  const source = loadSource();
  const { manifest, identityMap } = buildManifestAndIdentity(source);
  const opaque = measureOpaque(manifest, source);
  const rows = mappedRows(opaque, identityMap);
  const aggregates = aggregation(rows);
  const structural = globalChecks(source, rows);
  const recipeStructurePasses = rows.filter(
    (row) =>
      row.candidates.find((candidate) => candidate.identity === "recipe")!
        .structural.passed,
  ).length;
  const legacyStructurePasses = rows.filter(
    (row) =>
      row.candidates.find((candidate) => candidate.identity === "legacy")!
        .structural.passed,
  ).length;
  const catastrophicStructuralRegressions = rows.filter((row) => {
    const recipe = row.candidates.find(
      (candidate) => candidate.identity === "recipe",
    )!;
    const legacy = row.candidates.find(
      (candidate) => candidate.identity === "legacy",
    )!;
    return !recipe.structural.passed && legacy.structural.passed;
  }).length;
  const overall = aggregates.overall;
  const pixelInkRegressions = rows
    .map((row) => {
      const recipe = row.candidates.find(
        (candidate) => candidate.identity === "recipe",
      )!;
      const legacy = row.candidates.find(
        (candidate) => candidate.identity === "legacy",
      )!;
      return {
        cellKey: row.cellKey,
        axes: row.axes,
        recipeError: recipe.visual.pixelInkCompositeError!,
        legacyError: legacy.visual.pixelInkCompositeError!,
        recipeMinusLegacy:
          recipe.visual.pixelInkCompositeError! -
          legacy.visual.pixelInkCompositeError!,
      };
    })
    .filter((row) => row.recipeMinusLegacy > 0)
    .sort(
      (left, right) =>
        right.recipeMinusLegacy - left.recipeMinusLegacy ||
        left.cellKey.localeCompare(right.cellKey, "en"),
    );
  const criteria = {
    denominatorExactly128:
      overall.cells === 128 &&
      overall.geometry.denominator === 128 &&
      overall.pixelInk.denominator === 128,
    sameCellsCompared: structural.checks.twoCandidatesEveryCell,
    recipeGeometryWinsGreaterThanLegacy:
      overall.geometry.recipeWins > overall.geometry.legacyWins,
    recipePixelInkWinsGreaterThanLegacy:
      overall.pixelInk.recipeWins > overall.pixelInk.legacyWins,
    recipeMeanGeometryErrorStrictlyLower:
      overall.aggregateErrors.recipe.meanGeometryError <
      overall.aggregateErrors.legacy.meanGeometryError,
    recipeMeanPixelInkErrorStrictlyLower:
      overall.aggregateErrors.recipe.meanPixelInkCompositeError <
      overall.aggregateErrors.legacy.meanPixelInkCompositeError,
    recipeMeanOverallWeightedErrorStrictlyLower:
      overall.aggregateErrors.recipe.meanOverallWeightedError <
      overall.aggregateErrors.legacy.meanOverallWeightedError,
    zeroMissingCellsAxesStatesRoles:
      structural.checks.denominatorExactly128 &&
      structural.checks.completeAxes &&
      recipeStructurePasses === 128,
    allRecipeDomAriaWcAccountingChecksPass: structural.passed,
    noCatastrophicStructuralOrStateRegression:
      catastrophicStructuralRegressions === 0,
  };
  const deterministicVisualFidelity =
    criteria.denominatorExactly128 &&
    criteria.sameCellsCompared &&
    criteria.recipeGeometryWinsGreaterThanLegacy &&
    criteria.recipePixelInkWinsGreaterThanLegacy &&
    criteria.recipeMeanGeometryErrorStrictlyLower &&
    criteria.recipeMeanPixelInkErrorStrictlyLower &&
    criteria.recipeMeanOverallWeightedErrorStrictlyLower;
  const structuralSemanticCorrectness =
    criteria.zeroMissingCellsAxesStatesRoles &&
    criteria.allRecipeDomAriaWcAccountingChecksPass &&
    criteria.noCatastrophicStructuralOrStateRegression;
  const liveEngineeringMayProceed =
    deterministicVisualFidelity && structuralSemanticCorrectness;
  const result = {
    version: `input-field-objective-comparison-result-v${EVIDENCE_VERSION}`,
    protocolHash: LOCKED_PROTOCOL_SHA256,
    manifestHash: artifactHash(manifest),
    opaqueMeasurementsHash: artifactHash(opaque),
    identityMapHash: artifactHash(identityMap),
    identitySource: identityMap.createdFrom,
    pairedPerformanceKeyOpened: false,
    denominator: 128,
    aggregates,
    structuralSemantic: {
      recipePassedCells: recipeStructurePasses,
      legacyPassedCells: legacyStructurePasses,
      catastrophicStructuralRegressions,
      global: structural,
    },
    criteria,
    diagnosis: {
      ...(EVIDENCE_VERSION === 2
        ? { previousObjectiveCorrection: correctionDiagnosis(rows) }
        : {}),
      failedCriterion: criteria.recipeMeanPixelInkErrorStrictlyLower
        ? null
        : "recipeMeanPixelInkErrorStrictlyLower",
      aggregatePixelInkDelta:
        overall.aggregateErrors.recipe.meanPixelInkCompositeError -
        overall.aggregateErrors.legacy.meanPixelInkCompositeError,
      regressingCells: pixelInkRegressions,
      nextImplementationCorrection:
        criteria.recipeMeanPixelInkErrorStrictlyLower
          ? null
          : "Correct the recipe raster/ink treatment in the regressing cells, led by MUI and disabled-state paint/ink, while retaining the passing geometry and structural semantics. Produce new candidate bytes under a new evidence version; do not alter this locked metric or reinterpret the retained v2 result.",
    },
    claims: {
      deterministicVisualFidelity,
      structuralSemanticCorrectness,
      humanRecognisability: "pending-final-independent-designer-review",
    },
    decision: {
      liveInputEngineeringMayProceed: liveEngineeringMayProceed,
      overallInputSuccess: false,
      finalHumanDesignerGateRequired: true,
      noFigmaWorkPerformed: true,
      blocker: liveEngineeringMayProceed
        ? null
        : "Objective visual or structural progression criteria failed; correct the failing implementation metric before live work.",
    },
    perCell: rows.map((row) => ({
      cellKey: row.cellKey,
      axes: row.axes,
      geometry: Object.fromEntries(
        row.candidates.map((candidate) => [
          candidate.identity,
          candidate.visual.geometryError,
        ]),
      ),
      pixelInk: Object.fromEntries(
        row.candidates.map((candidate) => [
          candidate.identity,
          candidate.visual.pixelInkCompositeError,
        ]),
      ),
      overallWeightedError: Object.fromEntries(
        row.candidates.map((candidate) => [
          candidate.identity,
          candidate.visual.overallWeightedError,
        ]),
      ),
      structural: Object.fromEntries(
        row.candidates.map((candidate) => [
          candidate.identity,
          candidate.structural,
        ]),
      ),
    })),
  };
  const receipt = {
    version: `input-field-objective-comparison-receipt-v${EVIDENCE_VERSION}`,
    generatedDeterministically: true,
    lockedProtocol: {
      path: PROTOCOL_PATH,
      sha256: LOCKED_PROTOCOL_SHA256,
      lockedBeforeMeasurement: true,
    },
    sourceReceipt: {
      path: SOURCE_RECEIPT_PATH,
      sha256: fileHash(SOURCE_RECEIPT_PATH),
      independentReferences: 128,
      legacyCandidates: 128,
      recipeCandidates: 128,
      sampleMatrixHash: source.matrix.sampleMatrixHash,
      environment: source.provenance,
    },
    artifacts: {
      manifest: { path: MANIFEST_PATH, sha256: artifactHash(manifest) },
      opaqueMeasurements: {
        path: OPAQUE_PATH,
        sha256: artifactHash(opaque),
      },
      identityMap: {
        path: IDENTITY_PATH,
        sha256: artifactHash(identityMap),
        openedOnlyAfterOpaqueMeasurement: true,
        pairedSealedKeyUsed: false,
      },
      result: { path: RESULT_PATH, sha256: artifactHash(result) },
    },
    historicalEvidence: historicalEvidenceIndex(),
    preservedRoots: [
      "recipe/evidence/input-field-comparison",
      "recipe/evidence/input-field-comparison-v2",
      ...(EVIDENCE_VERSION >= 2
        ? ["recipe/evidence/input-field-comparison-v3"]
        : []),
      "recipe/evidence/input-field-comparison-calibrated",
      "recipe/evidence/input-field-comparison-calibration-v2",
      "recipe/evidence/input-field-comparison-calibration-v3-replacement",
      "recipe/evidence/input-field-paired-comparison-v1",
      "recipe/evidence/button-live-pivot-v4",
    ].map(treeSnapshot),
    decision: result.decision,
  };
  const index = {
    version: `input-field-objective-comparison-index-v${EVIDENCE_VERSION}`,
    overallInputSuccess: false,
    liveInputEngineeringMayProceed:
      result.decision.liveInputEngineeringMayProceed,
    deterministicVisualFidelity: result.claims.deterministicVisualFidelity,
    structuralSemanticCorrectness: result.claims.structuralSemanticCorrectness,
    humanRecognisability: result.claims.humanRecognisability,
    protocol: { path: PROTOCOL_PATH, sha256: LOCKED_PROTOCOL_SHA256 },
    manifest: { path: MANIFEST_PATH, sha256: artifactHash(manifest) },
    opaqueMeasurements: {
      path: OPAQUE_PATH,
      sha256: artifactHash(opaque),
    },
    identityMap: { path: IDENTITY_PATH, sha256: artifactHash(identityMap) },
    result: { path: RESULT_PATH, sha256: artifactHash(result) },
    receipt: { path: RECEIPT_PATH, sha256: artifactHash(receipt) },
    failedGradingRounds: receipt.historicalEvidence,
  };
  return { manifest, opaque, identityMap, result, receipt, index };
}

function writeArtifacts(): void {
  mkdirSync(absolute(ROOT), { recursive: true });
  const values = deriveArtifacts();
  for (const [file, value] of [
    [MANIFEST_PATH, values.manifest],
    [OPAQUE_PATH, values.opaque],
    [IDENTITY_PATH, values.identityMap],
    [RESULT_PATH, values.result],
    [RECEIPT_PATH, values.receipt],
    [INDEX_PATH, values.index],
  ] as const) {
    writeFileSync(absolute(file), stableJson(value));
  }
}

export function verifyObjectiveEvidence(): ReturnType<typeof deriveArtifacts> {
  const expected = deriveArtifacts();
  for (const [file, value] of [
    [MANIFEST_PATH, expected.manifest],
    [OPAQUE_PATH, expected.opaque],
    [IDENTITY_PATH, expected.identityMap],
    [RESULT_PATH, expected.result],
    [RECEIPT_PATH, expected.receipt],
    [INDEX_PATH, expected.index],
  ] as const) {
    assert.deepEqual(
      json(file),
      value,
      `${file}: deterministic evidence drift`,
    );
  }
  return expected;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  if (process.argv.includes("--write")) writeArtifacts();
  else verifyObjectiveEvidence();
  process.stdout.write(
    `input-field-objective-comparison-v${EVIDENCE_VERSION}: ${process.argv.includes("--write") ? "wrote" : "verified"} locked deterministic evidence\n`,
  );
}
