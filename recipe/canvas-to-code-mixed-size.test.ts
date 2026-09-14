import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import { deriveCanvasFacts, type CanvasFactsDocument } from "./canvas-facts.js";
import type { DumpSet } from "../extract/figma/types.js";
import {
  buildCanvasToCodeFromFacts,
  mountCells,
  renderCells,
  diffRenderedAgainstFacts,
} from "./canvas-to-code.js";

test("percent tracking resolves against captured font size without inventing a missing size", () => {
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
  for (const fontSize of [12, undefined]) {
    const scene = structuredClone(doc.scene);
    const label = scene.children[0].children[0];
    label.letterSpacing = { unit: "PERCENT", value: -5 };
    label.fontSize = fontSize;
    const result = bridgeCanvasFactsToDump(
      deriveCanvasFacts(scene, doc.source),
    );
    const text = (result.dump.Badge as DumpSet).variants[0].children![0].text!;
    assert.equal(text.letterSpacing, fontSize === undefined ? undefined : -0.6);
    assert.equal(result.counts.silent, 0);
  }
});

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
    assert.equal(
      diffRenderedAgainstFacts(doc, built, cells, rendered).counts.namedDeltas,
      0,
    );
    const planted = structuredClone(rendered);
    planted.find((r) => r.label !== null)!.label!["letter-spacing"] = "normal";
    const drift = diffRenderedAgainstFacts(doc, built, cells, planted);
    assert.equal(
      drift.counts.namedDeltas,
      1,
      "a missing tracking value must change the measured result",
    );
    assert.equal(rendered.length, cells.length);
    for (const cell of cells) {
      const actual = rendered.find((r) => r.key === cell.key)!.root;
      const dot = cell.props.shape === "dot";
      assert.equal(actual["padding-left"], dot ? "0px" : "8px");
      assert.equal(actual["padding-right"], dot ? "0px" : "8px");
      if (dot) {
        assert.equal(actual.width, "8px");
        assert.equal(actual.height, "8px");
      } else {
        assert.equal(actual["border-top-left-radius"], "999px");
        assert.equal(
          rendered.find((r) => r.key === cell.key)!.label!["letter-spacing"],
          "1px",
          "captured letter spacing must render",
        );
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
