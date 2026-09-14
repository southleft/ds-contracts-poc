import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import type { CanvasFactsDocument } from "./canvas-facts.js";
import {
  buildCanvasToCodeFromFacts,
  mountCells,
  renderCells,
} from "./canvas-to-code.js";

test("mixed HUG/FIXED component roots retain the complete observed bbox census", () => {
  const doc = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  ) as CanvasFactsDocument;
  const result = bridgeCanvasFactsToDump(doc);
  const variants = (
    result.dump.Badge as {
      variants: Array<{
        bbox?: { width: number; height: number };
        layout: { primarySizing: string; counterSizing: string };
      }>;
    }
  ).variants;
  assert.equal(variants.length, 10);
  assert.ok(
    variants.every((v) => v.bbox !== undefined),
    "partial bbox census prevents the existing mixed-size proposer from carrying FIXED dots",
  );
  assert.deepEqual(
    variants.slice(0, 5).map((v) => v.layout.primarySizing),
    Array(5).fill("AUTO"),
    "HUG remains a mode, not a frozen width",
  );
  assert.deepEqual(
    variants.slice(5).map((v) => v.bbox),
    Array(5).fill({ width: 8, height: 8 }),
  );
  assert.equal(result.counts.silent, 0);
});

test("generated mixed-size Badge renders every dot and preserves Label-only padding", async () => {
  const doc = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL(
          "./evidence/canvas-to-code-held-out-v2/altitude-badge/canvas-facts.json.gz",
          import.meta.url,
        ),
      ),
    ).toString(),
  ) as CanvasFactsDocument;
  const temp = mkdtempSync(path.join(os.tmpdir(), "ds-mixed-size-"));
  try {
    const built = await buildCanvasToCodeFromFacts(doc, temp);
    const cells = mountCells(doc, built.contract);
    const rendered = await renderCells(built, cells);
    assert.equal(rendered.length, cells.length);
    for (const cell of cells) {
      const actual = rendered.find((r) => r.key === cell.key)!.root;
      const dot = cell.props.shape === "dot";
      assert.equal(actual["padding-left"], dot ? "0px" : "8px");
      assert.equal(actual["padding-right"], dot ? "0px" : "8px");
      if (dot) {
        assert.equal(actual.width, "8px");
        assert.equal(actual.height, "8px");
      } else assert.equal(actual["border-top-left-radius"], "999px");
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
