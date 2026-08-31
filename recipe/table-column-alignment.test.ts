import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  columnAlignmentFindings,
  measureColumnAlignment,
  measureTableSetColumnAlignment,
} from "./table-column-alignment.js";

const SUBSTRATE = "private/table-live-v27-transaction/004-extract.raw.json";

const cell = (index: number, width: number) => ({
  name: `table/cell-instance/${index} :: x`,
  width,
  children: [],
});
const row = (widths: number[]) => ({
  name: "row",
  children: widths.map((width, index) => cell(index, width)),
});
const variant = (name: string, rows: number[][]) => ({
  name,
  description: "recipe-role:table/variant/comfortable",
  children: [
    {
      name: "table/header",
      description: "recipe-role:table/header",
      children: [row(rows[0]!)],
    },
    {
      name: "table/body",
      description: "recipe-role:table/body",
      children: rows.slice(1).map(row),
    },
  ],
});

test("one width per column reads as aligned", () => {
  const report = measureColumnAlignment(
    variant("Density=comfortable", [
      [120, 120, 120],
      [120, 120, 120],
    ]),
  );
  assert.equal(report.rows, 2);
  assert.equal(report.aligned, true);
  assert.equal(report.worstDivergencePx, 0);
  assert.deepEqual(columnAlignmentFindings([report]), []);
});

test("a column carrying two widths is a named finding", () => {
  const report = measureColumnAlignment(
    variant("Density=compact", [
      [127, 89, 89],
      [159, 90, 95],
    ]),
  );
  assert.equal(report.aligned, false);
  assert.equal(report.worstDivergencePx, 32);
  assert.deepEqual(report.columns[0]!.widths, [127, 159]);

  const findings = columnAlignmentFindings([report]);
  assert.equal(findings.length, 3);
  assert.match(findings[0]!, /column 0 carries 2 widths \(127, 159\)/);
  assert.match(findings[0]!, /32px divergence/);
  assert.match(findings[0]!, /Density=compact/);
});

test("a table with no rows reports nothing rather than claiming alignment", () => {
  const empty = measureTableSetColumnAlignment({ name: "set", children: [] });
  assert.deepEqual(empty, []);
});

test(
  "the persisted v27 mint measures as first-party aligned, mui ragged",
  {
    skip: existsSync(SUBSTRATE)
      ? false
      : "private/ substrate absent (gitignored); run after a live attempt",
  },
  () => {
    // This is the measurement the v27 probe could not make. It passed that mint
    // on rolesExact, stateSemanticsExact, noFakeLayout, visibleAreaLoss 0 and
    // overlapPixels 0 while MUI's columns did not line up.
    const raw = JSON.parse(readFileSync(SUBSTRATE, "utf8"));
    const roots = raw.result.payload.roots as Array<{
      source: string;
      tableScene: any;
    }>;

    const firstParty = roots.find((root) => root.source === "first-party")!;
    const mui = roots.find((root) => root.source === "mui")!;

    const firstPartyReports = measureTableSetColumnAlignment(
      firstParty.tableScene,
    );
    assert.ok(firstPartyReports.length > 0);
    for (const report of firstPartyReports) {
      assert.equal(report.aligned, true, `${report.variant} should align`);
      for (const column of report.columns)
        assert.deepEqual(
          column.widths,
          [120],
          "every first-party column is 120",
        );
    }

    const muiReports = measureTableSetColumnAlignment(mui.tableScene);
    assert.ok(muiReports.length > 0);
    for (const report of muiReports) {
      assert.equal(report.aligned, false, `${report.variant} should be ragged`);
      assert.equal(report.worstDivergencePx, 32);
      assert.deepEqual(report.columns[0]!.widths, [127, 159]);
    }
    assert.equal(columnAlignmentFindings(muiReports).length > 0, true);
  },
);
