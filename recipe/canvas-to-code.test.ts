/**
 * Gate tests for the canvas→code v1 evidence (docs/35 §5, stages 3a–3d).
 * Browserless — the Chromium re-render itself runs in
 * `tsx recipe/canvas-to-code.ts --check`; these tests hold the COMMITTED
 * evidence to the zero-silent, no-grades, offline-only invariants.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import {
  CANVAS_TO_CODE_BRIDGE_PATH,
  CANVAS_TO_CODE_RECEIPT_PATH,
  CANVAS_TO_CODE_RENDER_LEDGER_PATH,
  CANVAS_TO_CODE_VERSION,
  CHECKBOX_BLOCKER,
  type CanvasToCodeReceipt,
  type RenderLedgerRow,
} from "./canvas-to-code.js";
import {
  checkButtonCanvasFacts,
  CANVAS_TO_CODE_ROOT,
} from "./emit-canvas-facts.js";
import type { BridgeLedgerRow } from "./canvas-facts-to-dump.js";

const receipt = JSON.parse(
  readFileSync(CANVAS_TO_CODE_RECEIPT_PATH, "utf8"),
) as CanvasToCodeReceipt;

const bridgeArtifact = JSON.parse(
  gunzipSync(readFileSync(CANVAS_TO_CODE_BRIDGE_PATH)).toString("utf8"),
) as {
  ledger: BridgeLedgerRow[];
  counts: CanvasToCodeReceipt["bridge"];
  tokenRenames: Array<{ liveName: string; dumpName: string; decoded: boolean }>;
};

const renderArtifact = JSON.parse(
  gunzipSync(readFileSync(CANVAS_TO_CODE_RENDER_LEDGER_PATH)).toString("utf8"),
) as {
  ledger: RenderLedgerRow[];
  counts: Omit<CanvasToCodeReceipt["render"], "cellsMounted">;
};

test("receipt: offline, ungraded, version-pinned", () => {
  assert.equal(receipt.artifactVersion, CANVAS_TO_CODE_VERSION);
  assert.equal(receipt.substrate.figmaWrites, 0);
  assert.equal(receipt.substrate.liveReads, 0);
  assert.equal(receipt.humanGrade, "pending");
  assert.equal(receipt.gradeInvented, false);
  assert.equal(receipt.overallSuccess, false);
});

test("receipt: substrate is the committed observe, byte-pinned", () => {
  const doc = checkButtonCanvasFacts();
  assert.equal(receipt.substrate.observePath, doc.source.observePath);
  assert.equal(receipt.substrate.observeSha256, doc.source.observeSha256);
  assert.equal(receipt.bridge.facts, doc.counts.facts);
  assert.equal(receipt.render.facts, doc.counts.facts);
});

test("bridge: zero silent, ledger complete, counts agree with receipt", () => {
  const { counts, ledger } = bridgeArtifact;
  assert.equal(counts.silent, 0);
  assert.equal(
    counts.named + counts.carried + counts.receipted,
    counts.facts,
  );
  assert.equal(ledger.length, counts.facts);
  assert.deepEqual(
    { ...counts, tokenRenames: bridgeArtifact.tokenRenames.length },
    receipt.bridge,
  );
  for (const rename of bridgeArtifact.tokenRenames)
    assert.equal(
      rename.decoded,
      true,
      `token ${rename.liveName} did not decode — the bridge must NAME undecoded identities`,
    );
});

test("bridge: recomputes identically from the committed canvas facts", () => {
  const bridge = bridgeCanvasFactsToDump(checkButtonCanvasFacts());
  assert.deepEqual(
    { ...bridge.counts, tokenRenames: bridge.tokenRenames.length },
    receipt.bridge,
  );
});

test("render: zero silent, zero unexplained deltas, every delta named", () => {
  const { counts, ledger } = renderArtifact;
  assert.equal(counts.silent, 0);
  assert.equal(counts.unexplainedDeltas, 0);
  assert.equal(
    counts.matched + counts.namedDeltas + counts.carried + counts.receipted,
    counts.facts,
  );
  assert.equal(ledger.length, counts.facts);
  for (const row of ledger) {
    if (row.disposition === "named-delta") {
      assert.ok(
        typeof row.explainedBy === "string" && row.explainedBy.length > 0,
        `${row.factId}: named-delta without an explaining proposal note`,
      );
    }
  }
  const { cellsMounted: _cells, ...receiptCounts } = receipt.render;
  assert.deepEqual(counts, receiptCounts);
});

test("render: every drawn variant cell mounted", () => {
  assert.equal(receipt.render.cellsMounted, 144);
});

test("emitted files: committed bytes match the receipt hashes", () => {
  for (const file of receipt.emitted) {
    const bytes = readFileSync(path.join(CANVAS_TO_CODE_ROOT, file.path));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
      `${file.path} drifted from the receipt hash`,
    );
  }
  assert.ok(
    receipt.emitted.some((file) => file.path.endsWith(".module.css")),
    "emitted set carries a CSS Module",
  );
  assert.ok(
    receipt.emitted.some((file) => file.path.endsWith(".tsx")),
    "emitted set carries a React component",
  );
});

test("checkbox: the named blocker is recorded, not silently skipped", () => {
  assert.equal(receipt.checkbox.status, "named-blocker");
  assert.equal(receipt.checkbox.blocker, CHECKBOX_BLOCKER);
});
