import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { PNG } from "pngjs";

import {
  EXACT_WEIGHT,
  GEOMETRY_WEIGHT,
  INK_WEIGHT,
  LOCKED_PROTOCOL_SHA256,
  PERCEPTUAL_WEIGHT,
  PIXELMATCH_ALPHA,
  PIXELMATCH_THRESHOLD,
  PIXEL_INK_WEIGHT,
  PROTOCOL_PATH,
  evaluateStructure,
  measureVisualPair,
  validateCandidateProvenance,
  validateLockedProtocolBytes,
} from "./input-field-objective-comparison-v1.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");

function png(
  width: number,
  height: number,
  paint?: { x: number; y: number; width: number; height: number },
): Buffer {
  const image = new PNG({ width, height });
  image.data.fill(255);
  if (paint) {
    for (let y = paint.y; y < paint.y + paint.height; y += 1) {
      for (let x = paint.x; x < paint.x + paint.width; x += 1) {
        const offset = (y * width + x) * 4;
        image.data[offset] = 20;
        image.data[offset + 1] = 40;
        image.data[offset + 2] = 60;
        image.data[offset + 3] = 255;
      }
    }
  }
  return PNG.sync.write(image);
}

function transparentPng(width: number, height: number): Buffer {
  const image = new PNG({ width, height });
  image.data.fill(0);
  return PNG.sync.write(image);
}

const cell = {
  key: "mui/size=small/state=default/content=placeholder/required=false/adornments=none",
  library: "mui",
  size: "small",
  state: "default",
  content: "placeholder",
  required: "false",
  adornments: "none",
};

const artifact = {
  cellKey: cell.key,
  file: "candidate.png",
  hash: "candidate-hash",
  width: 20,
  height: 20,
  paintedPixels: 100,
  contentBox: { width: 10, height: 10 },
  dom: {
    inputFound: true,
    labelFound: true,
    labelForMatches: true,
    accessibleNameMatched: true,
    value: "",
    placeholder: "Amount",
    required: false,
    disabled: false,
    ariaInvalid: null,
    ariaDescribedBy: "message",
    structure: { labels: 1, inputs: 1, messages: 1, adornments: 0 },
  },
};

test("locked protocol pins thresholds and all weights before measurement", () => {
  const bytes = readFileSync(path.join(REPO, PROTOCOL_PATH));
  validateLockedProtocolBytes(bytes);
  assert.equal(
    LOCKED_PROTOCOL_SHA256,
    "b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34",
  );
  assert.equal(EXACT_WEIGHT + PERCEPTUAL_WEIGHT + INK_WEIGHT, 1);
  assert.equal(GEOMETRY_WEIGHT + PIXEL_INK_WEIGHT, 1);
  assert.equal(PIXELMATCH_THRESHOLD, 0.1);
  assert.equal(PIXELMATCH_ALPHA, 0.1);
  const manipulated = Buffer.from(
    bytes
      .toString("utf8")
      .replace('"exactDifferenceWeight": 0.5', '"exactDifferenceWeight": 0.49'),
  );
  assert.throws(
    () => validateLockedProtocolBytes(manipulated),
    /LOCKED-PROTOCOL-DRIFT/,
  );
});

test("same bytes and hidden duplicates produce exactly identical metrics", () => {
  const reference = png(20, 20, { x: 4, y: 5, width: 10, height: 8 });
  const candidate = png(20, 20, { x: 5, y: 5, width: 10, height: 8 });
  const first = measureVisualPair(
    reference,
    candidate,
    { width: 10, height: 8 },
    { width: 10, height: 8 },
  );
  const repeated = measureVisualPair(
    reference,
    candidate,
    { width: 10, height: 8 },
    { width: 10, height: 8 },
  );
  const hiddenDuplicate = measureVisualPair(
    Buffer.from(reference),
    Buffer.from(candidate),
    { width: 10, height: 8 },
    { width: 10, height: 8 },
  );
  assert.deepEqual(repeated, first);
  assert.deepEqual(hiddenDuplicate, first);
  assert.equal(first.valid, true);
});

test("zero-alpha and all-white blank candidates fail closed", () => {
  const reference = png(20, 20, { x: 4, y: 4, width: 10, height: 10 });
  for (const candidate of [transparentPng(20, 20), png(20, 20)]) {
    const result = measureVisualPair(
      reference,
      candidate,
      { width: 10, height: 10 },
      { width: 10, height: 10 },
    );
    assert.equal(result.valid, false);
    assert.equal(result.failure, "ZERO_CANDIDATE_INK");
    assert.equal(result.nonzeroPixels.candidate, 0);
    assert.equal(result.pixelInkCompositeError, null);
  }
});

test("a planted shifted-size candidate increases geometry error", () => {
  const reference = png(20, 20, { x: 4, y: 4, width: 10, height: 10 });
  const exact = measureVisualPair(
    reference,
    reference,
    { width: 10, height: 10 },
    { width: 10, height: 10 },
  );
  const shiftedSize = measureVisualPair(
    reference,
    png(30, 24, { x: 8, y: 6, width: 14, height: 12 }),
    { width: 10, height: 10 },
    { width: 14, height: 12 },
  );
  assert.equal(exact.geometryError, 0);
  assert.ok(shiftedSize.geometryError > exact.geometryError);
  assert.ok(shiftedSize.pixelInkCompositeError! > 0);
});

test("missing-label and wrong-state plants fail image-independent assertions", () => {
  const missingLabel = evaluateStructure(cell, {
    ...artifact,
    dom: {
      ...artifact.dom,
      labelFound: false,
      labelForMatches: false,
      structure: { ...artifact.dom.structure, labels: 0 },
    },
  });
  assert.equal(missingLabel.passed, false);
  assert.ok(missingLabel.failures.includes("labelFound"));
  assert.ok(missingLabel.failures.includes("exactlyOneLabel"));

  const disabledCell = {
    ...cell,
    key: cell.key.replace("state=default", "state=disabled"),
    state: "disabled",
  };
  const wrongState = evaluateStructure(disabledCell, {
    ...artifact,
    cellKey: disabledCell.key,
    dom: { ...artifact.dom, disabled: false },
  });
  assert.equal(wrongState.passed, false);
  assert.ok(wrongState.failures.includes("disabledState"));
});

test("copied reference provenance cannot become candidate success", () => {
  const reference = {
    ...artifact,
    file: "recipe/evidence/input-field-comparison-v2/source-reference/ref.png",
    hash: "same-hash",
  };
  const copiedCandidate = {
    candidateId: "OC-COPY",
    artifact: { ...reference },
    provenance: {
      kind: "receipt-backed-implementation-output" as const,
      sourceReceipt:
        "recipe/evidence/input-field-comparison-v2/receipt.json" as const,
    },
  };
  const source = {
    outputs: {
      legacy: [],
      recipeReact: [],
    },
  };
  assert.equal(
    validateCandidateProvenance(
      copiedCandidate,
      reference,
      source as unknown as Parameters<typeof validateCandidateProvenance>[2],
    ),
    false,
  );
  const zeroError = measureVisualPair(
    png(20, 20, { x: 4, y: 4, width: 10, height: 10 }),
    png(20, 20, { x: 4, y: 4, width: 10, height: 10 }),
    { width: 10, height: 10 },
    { width: 10, height: 10 },
  );
  assert.equal(zeroError.overallWeightedError, 0);
});

test("metric function has no recipe, legacy, or library identity branch", () => {
  const source = measureVisualPair.toString();
  assert.doesNotMatch(source, /\b(recipe|legacy|mui|polaris|identity)\b/i);
});
