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
  "census reproduces the v25 live failure the writer fix targets",
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

    for (const root of census.roots) {
      assert.equal(
        root.preDiffRefusal,
        null,
        `${root.source} must reach the IR diff`,
      );
    }

    // The v25 substrate was minted by the OLD writer, which named every set
    // `<role> :: <source display name>`. The writer now carries the compile
    // label into the set name, and the two host label overrides that patched
    // the symptom were removed. So against THIS substrate the census must show
    // exactly the four name mismatches the writer fix targets -- two per root,
    // on table/row-set and table/cell-set. A live run under the new writer is
    // what turns these to zero; simulating the rename offline predicts zero.
    assert.equal(census.totalAccountingProblems, 4);
    const names = census.roots
      .flatMap((root) => root.accounting.flatMap((row) => row.entries))
      .map((entry) => `${entry.ownershipKey}#${entry.channel}`)
      .sort();
    assert.deepEqual(names, ["cell#name", "cell#name", "row#name", "row#name"]);
    for (const entry of census.roots.flatMap((root) =>
      root.accounting.flatMap((row) => row.entries),
    )) {
      assert.equal(entry.class, "mismatched");
      assert.match(String(entry.expected), /:: Table (row|cell)$/);
      assert.equal(String(entry.observed).endsWith(":: Table"), true);
    }

    assert.equal(
      census.classFamilies.reduce((total, family) => total + family.count, 0),
      census.totalDifferences,
      "class rollup must account for every difference",
    );
  },
);
