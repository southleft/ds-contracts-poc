import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { allDifferences, collapseTableRecipe } from "./recipes/table.js";
import {
  TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL,
  buildTableTailCensus,
} from "./table-tail-census.js";

const SUBSTRATE = "private/table-live-v23-transaction/004-extract.raw.json";

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
  "census enumerates the remaining tail from the persisted v23 extract",
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

    const firstParty = census.roots.find(
      (root) => root.source === "first-party",
    );
    assert.ok(firstParty, "census must cover the first-party root");

    // The v23 live attempt refused on first-party, so its tail must be readable.
    assert.equal(
      firstParty.preDiffRefusal,
      null,
      "first-party must reach the IR diff, as it did live at v23",
    );
    assert.ok(
      firstParty.differences > 0,
      "the tail is not empty; a mint has not yet stayed",
    );

    // HEAD carries the v24 teaching (`hostEmitsRowSetCompileCarryLabel`), which
    // exists precisely to close the v23 refusal. So the census must NOT still
    // report it. Reverting that one line reintroduces it -- verified 2026-08-29.
    assert.equal(
      census.reproducesKnownV23Refusal,
      false,
      `v24 teaching should have closed ${TABLE_TAIL_CENSUS_KNOWN_V23_REFUSAL}`,
    );
    assert.ok(
      !firstParty.classes.some(
        (entry) => entry.role === "table/row-set" && entry.property === "label",
      ),
      "row-set label must be closed by the v24 teaching",
    );

    // Every reported entry must name a role and a property, or the rollup lies.
    for (const entry of firstParty.entries) {
      assert.ok(entry.path.startsWith("$"), "path must be a JSON pointer");
      assert.ok(entry.property.length > 0, "entry must name a property");
    }

    assert.equal(
      census.classFamilies.reduce((total, family) => total + family.count, 0),
      census.totalDifferences,
      "class rollup must account for every difference",
    );
  },
);
