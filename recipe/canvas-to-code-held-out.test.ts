/**
 * Gate tests for the held-out canvas→code exam (docs/35 §5 3f).
 * Browserless — Chromium re-render runs in
 * `tsx recipe/canvas-to-code-held-out.ts --check`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";

import {
  HELD_OUT_BLOCKERS_PATH,
  HELD_OUT_BRIDGE_PATH,
  HELD_OUT_OBSERVE_PATH,
  HELD_OUT_RECEIPT_PATH,
  HELD_OUT_RENDER_LEDGER_PATH,
  HELD_OUT_ROOT,
  HELD_OUT_SUBSTRATE,
  HELD_OUT_VERSION,
  type HeldOutNamedBlocker,
  type HeldOutReceipt,
} from "./canvas-to-code-held-out.js";
import type { RenderLedgerRow } from "./canvas-to-code.js";

const receipt = JSON.parse(
  readFileSync(HELD_OUT_RECEIPT_PATH, "utf8"),
) as HeldOutReceipt;

const blockers = JSON.parse(
  readFileSync(HELD_OUT_BLOCKERS_PATH, "utf8"),
) as HeldOutNamedBlocker[];

const bridgeArtifact = JSON.parse(
  gunzipSync(readFileSync(HELD_OUT_BRIDGE_PATH)).toString("utf8"),
) as { counts: HeldOutReceipt["bridge"] };

const renderArtifact = JSON.parse(
  gunzipSync(readFileSync(HELD_OUT_RENDER_LEDGER_PATH)).toString("utf8"),
) as {
  ledger: RenderLedgerRow[];
  counts: Omit<HeldOutReceipt["render"], "cellsMounted">;
};

test("receipt: offline, ungraded, version-pinned, product incomplete", () => {
  assert.equal(receipt.artifactVersion, HELD_OUT_VERSION);
  assert.equal(receipt.substrate.figmaWrites, 0);
  assert.equal(receipt.substrate.liveReads, 0);
  assert.equal(receipt.humanGrade, "pending");
  assert.equal(receipt.gradeInvented, false);
  assert.equal(receipt.overallSuccess, false);
  assert.equal(receipt.productV1, "incomplete");
});

test("substrate: option 1 Scratch Card, not a recipe stay", () => {
  assert.equal(receipt.substrate.option, 1);
  assert.equal(receipt.substrate.kind, HELD_OUT_SUBSTRATE.kind);
  assert.equal(receipt.substrate.fileKey, "byMp6lt0Ij9b2QbkDGFwBh");
  assert.equal(receipt.substrate.pageId, "33:2");
  assert.equal(receipt.substrate.setId, "33:5093");
  assert.equal(receipt.substrate.setName, "Card");
  assert.equal(receipt.substrate.observePath, HELD_OUT_OBSERVE_PATH);
  assert.match(receipt.substrate.notInStayList, /no recipe:card/);
  const observeSha = createHash("sha256")
    .update(readFileSync(HELD_OUT_OBSERVE_PATH))
    .digest("hex");
  assert.equal(receipt.substrate.observeSha256, observeSha);
});

test("bridge + render: zero silent, zero unexplained", () => {
  assert.equal(bridgeArtifact.counts.silent, 0);
  assert.equal(receipt.bridge.silent, 0);
  assert.equal(renderArtifact.counts.silent, 0);
  assert.equal(renderArtifact.counts.unexplainedDeltas, 0);
  assert.equal(receipt.render.silent, 0);
  assert.equal(receipt.render.unexplainedDeltas, 0);
  assert.equal(
    renderArtifact.counts.matched +
      renderArtifact.counts.namedDeltas +
      renderArtifact.counts.carried +
      renderArtifact.counts.receipted,
    renderArtifact.counts.facts,
  );
  for (const row of renderArtifact.ledger) {
    if (row.disposition === "named-delta") {
      assert.ok(
        typeof row.explainedBy === "string" && row.explainedBy.length > 0,
        `${row.factId}: named-delta without explaining note`,
      );
    }
  }
});

test("named blockers: recorded beside the receipt, not silent", () => {
  assert.deepEqual(receipt.namedBlockers, blockers);
  assert.ok(blockers.some((b) => b.id === "product-v1-incomplete"));
  assert.ok(blockers.some((b) => b.id === "no-human-grade"));
  assert.ok(
    blockers.every((b) => b.detail.length > 0),
    "every blocker carries a detail string",
  );
});

test("emitted files: committed bytes match receipt hashes", () => {
  assert.ok(receipt.emitted.length > 0);
  for (const file of receipt.emitted) {
    const bytes = readFileSync(path.join(HELD_OUT_ROOT, file.path));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      file.sha256,
      `${file.path} drifted`,
    );
  }
});

test("cells: every drawn Card variant mounted", () => {
  assert.equal(receipt.render.cellsMounted, HELD_OUT_SUBSTRATE.variants);
});
