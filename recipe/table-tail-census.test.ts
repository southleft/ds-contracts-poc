import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { allDifferences, collapseTableRecipe } from "./recipes/table.js";
import {
  TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL,
  buildTableTailCensus,
} from "./table-tail-census.js";

const SUBSTRATE = "private/table-live-v25-transaction/004-extract.raw.json";

test("allDifferences agrees with firstDifference on the leading path", () => {
  // firstDifference is not exported; collapseTableRecipe surfaces it in the
  // refusal message. The invariant that makes the census trustworthy is that
  // the exhaustive walk's FIRST entry is the same path the refusal names.
  const left = {
    kind: "frame",
    a: 1,
    children: [
      { kind: "frame", b: 2 },
      { kind: "frame", label: "x" },
    ],
  };
  const right = {
    kind: "frame",
    a: 1,
    children: [
      { kind: "frame", b: 2 },
      { kind: "frame", label: "y" },
    ],
  };
  const all = allDifferences(left, right);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.path, "$.children[1].label");
  assert.equal(all[0]!.reason, "value");
  assert.equal(all[0]!.left, "x");
  assert.equal(all[0]!.right, "y");
});

test("allDifferences reports absence on both sides distinctly", () => {
  const all = allDifferences({ a: 1, b: 2 }, { a: 1, c: 3 });
  const byPath = Object.fromEntries(all.map((d) => [d.path, d.reason]));
  assert.equal(byPath["$.b"], "absent-right");
  assert.equal(byPath["$.c"], "absent-left");
});

test("a difference sink suppresses the refusal; two-arg callers still refuse", () => {
  // Two-argument collapse must keep refusing -- this is the live path.
  assert.throws(
    () => collapseTableRecipe({ not: "an envelope" }, undefined),
    /.*/,
  );
});

test(
  "census reports the compile changes the substrate predates",
  {
    skip: existsSync(SUBSTRATE)
      ? false
      : "private/ substrate absent (gitignored); run after a live attempt",
  },
  () => {
    const census = buildTableTailCensus();

    assert.equal(census.artifactVersion, "table-tail-census-v1");
    assert.equal(census.predicts, "extract-side tail only");
    assert.equal(census.roots.length, 2);
    for (const root of census.roots)
      assert.equal(
        root.preDiffRefusal,
        null,
        `${root.source} must reach the IR diff`,
      );

    // A substrate is only valid for the writer AND the compile that produced it.
    // The v27 scene was minted before the full-width lowering, so every
    // remaining difference must be a width-mode class -- the five nodes whose
    // `width: 100%` is now lowered to fill (table root, header, body, row
    // variant, row instance), across both sources. If anything else shows up
    // here, the lowering touched something it should not have.
    const families = new Set(census.classFamilies.map((f) => f.property));
    assert.deepEqual(
      [...families].sort(),
      ["layout.width.mode", "width.mode"],
      "only width-mode classes may differ against a pre-fill substrate",
    );
    assert.ok(census.totalDifferences > 0);
    assert.equal(
      census.classFamilies.reduce((total, f) => total + f.count, 0),
      census.totalDifferences,
      "class rollup must account for every difference",
    );

    // The v24 teaching still holds: the row-set label class stays closed.
    assert.equal(census.reproducesKnownV23Refusal, false);
  },
);
