import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import type { CanvasFactsDocument } from "./canvas-facts.js";

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
