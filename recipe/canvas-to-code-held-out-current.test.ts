import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  artifactInventory,
  assertArtifactInventory,
  assertCoverage,
  COHORTS,
  CURRENT_HELD_OUT_ROOT,
  expectedInventory,
  prepareRecording,
  type CurrentResult,
} from "./canvas-to-code-held-out-current.js";

const results = (cohort: string): CurrentResult[] =>
  JSON.parse(
    readFileSync(
      path.join(CURRENT_HELD_OUT_ROOT, cohort, "results.json"),
      "utf8",
    ),
  ) as CurrentResult[];

test("current replay retains every subject, exact accounting, and all variant mounts", () => {
  for (const cohort of COHORTS) assertCoverage(cohort, results(cohort));
  assert.equal(results("scratch")[0]!.outcome, "accounting-zero-silent");
});

test("omitting, duplicating, or replacing a refused subject fails coverage", () => {
  const rows = results("designer");
  const index = rows.findIndex((row) => row.outcome === "refused-by-name");
  assert.ok(index >= 0);
  assert.throws(
    () =>
      assertCoverage(
        "designer",
        rows.filter((_, i) => i !== index),
      ),
    /every subject/,
  );
  assert.throws(
    () => assertCoverage("designer", [...rows, rows[index]!]),
    /every subject/,
  );
  const replaced = structuredClone(rows);
  replaced[index]!.id = "substitute";
  assert.throws(() => assertCoverage("designer", replaced), /every subject/);
});

test("silence, unexplained deltas, missing variants, and anonymous refusals cannot pass", () => {
  for (const field of ["silent", "unexplainedDeltas"] as const) {
    const rows = results("scratch");
    rows[0]!.measurement!.render[field] = 1;
    assert.throws(() => assertCoverage("scratch", rows));
  }
  const rows = results("scratch");
  rows[0]!.measurement!.cellsMounted -= 1;
  assert.throws(() => assertCoverage("scratch", rows));
  const designer = results("designer");
  designer.find((row) => row.refusal)!.refusal!.message = "";
  assert.throws(
    () => assertCoverage("designer", designer),
    /refusal must name/,
  );
});

test("byte comparison refuses changed, missing and additional files with the same totals", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "held-out-inventory-test-"));
  try {
    const css = path.join(dir, "output.css");
    writeFileSync(css, "text-align:left");
    const expected = artifactInventory(dir);
    writeFileSync(css, "text-align:center");
    assert.throws(
      () => assertArtifactInventory(expected, artifactInventory(dir), "CSS"),
      /output.css/,
    );
    writeFileSync(css, "text-align:left");
    writeFileSync(path.join(dir, "extra.json"), "{}");
    assert.throws(
      () => assertArtifactInventory(expected, artifactInventory(dir), "extra"),
      /extra.json/,
    );
    rmSync(css);
    assert.throws(
      () =>
        assertArtifactInventory(expected, artifactInventory(dir), "missing"),
      /output.css/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("new evidence does not author owner grades; complete frozen inventories still match", () => {
  const forbidden = new Set([
    "humanGrade",
    "humanSignoff",
    "overallSuccess",
    "liveFigma",
  ]);
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.has(key), `new machine evidence authored ${key}`);
      inspect(child);
    }
  };
  for (const cohort of COHORTS) {
    inspect(results(cohort));
    const currentDir = path.join(CURRENT_HELD_OUT_ROOT, cohort);
    for (const file of Object.keys(artifactInventory(currentDir))) {
      if (file.endsWith(".json"))
        inspect(JSON.parse(readFileSync(path.join(currentDir, file), "utf8")));
      if (file.endsWith(".json.gz"))
        inspect(
          JSON.parse(
            gunzipSync(readFileSync(path.join(currentDir, file))).toString(
              "utf8",
            ),
          ),
        );
    }
    const historical = `recipe/evidence/canvas-to-code-held-out-${cohort === "scratch" ? "v1" : "v2"}`;
    const pinned = JSON.parse(
      readFileSync(
        path.join(CURRENT_HELD_OUT_ROOT, cohort, "historical-sha256.json"),
        "utf8",
      ),
    ) as Record<string, string>;
    assertArtifactInventory(
      pinned,
      artifactInventory(historical),
      "frozen history",
    );
    // Even a receipt-only mutation is rejected, regardless of emitted output.
    assert.throws(
      () =>
        assertArtifactInventory(
          pinned,
          { ...pinned, "receipt.json": "changed" },
          "history",
        ),
      /receipt.json/,
    );
  }
});

test("recording cannot overwrite existing output or write through a symlink into frozen evidence", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "held-out-record-test-"));
  try {
    assert.throws(() => prepareRecording(dir), /already exists/);
    const frozen = path.resolve("recipe/evidence/canvas-to-code-held-out-v1");
    assert.throws(
      () => prepareRecording(path.join(frozen, "new-recording")),
      /frozen evidence/,
    );
    const alias = path.join(dir, "alias");
    symlinkSync(frozen, alias);
    assert.throws(
      () => prepareRecording(path.join(alias, "new-recording")),
      /frozen evidence/,
    );
    assert.throws(() => artifactInventory(alias), /symlink artifact/);
    assert.throws(() => artifactInventory(dir), /symlink artifact/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a platform overlay replaces base bytes on its own platform only and may not add files", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "held-out-overlay-"));
  try {
    const base = path.join(root, "current"), overlay = path.join(`${base}.linux`, "c");
    mkdirSync(path.join(base, "c"), { recursive: true }); mkdirSync(overlay, { recursive: true });
    writeFileSync(path.join(base, "c", "ledger.json.gz"), "mac");
    writeFileSync(path.join(base, "c", "results.json"), "same");
    writeFileSync(path.join(overlay, "ledger.json.gz"), "linux");
    const mac = expectedInventory(base, "c", "darwin"), linux = expectedInventory(base, "c", "linux");
    assert.equal(mac["results.json"], linux["results.json"]);
    assert.notEqual(mac["ledger.json.gz"], linux["ledger.json.gz"]);
    assert.deepEqual(Object.keys(linux).sort(), Object.keys(mac).sort());
    writeFileSync(path.join(overlay, "extra.json"), "x");
    assert.throws(() => expectedInventory(base, "c", "linux"), /linux overlay adds extra\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
