import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  cpSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(ROOT, "scripts/console-loop-evidence-check.mjs");
const SCORE_LIB = path.join(ROOT, "scripts/console-loop-scorecard-lib.mjs");

/** Scratch fixtures need the shared scorecard lib + a ratchet file. */
function seedFixtureCommon(dir) {
  cpSync(SCORE_LIB, path.join(dir, "scripts/console-loop-scorecard-lib.mjs"));
  writeFileSync(
    path.join(dir, "parity/receipts/console-loop/RATCHET.json"),
    `${JSON.stringify({ version: 1, floors: { "first-party": 0 } }, null, 2)}\n`,
  );
}

test("console-loop-evidence-check passes on committed receipts", () => {
  const r = spawnSync(process.execPath, [CHECK], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stderr}${r.stdout}`);
  assert.match(r.stdout, /required ok/);
});

test("console-loop-evidence-check refuses a mismatched round-trip", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "console-loop-ev-"));
  try {
    mkdirSync(path.join(dir, "parity/receipts/console-loop/components"), {
      recursive: true,
    });
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    cpSync(CHECK, path.join(dir, "scripts/console-loop-evidence-check.mjs"));
    seedFixtureCommon(dir);
    const good = JSON.parse(
      readFileSync(
        path.join(ROOT, "parity/receipts/console-loop/components/badge.json"),
        "utf8",
      ),
    );
    good.roundtrip.mismatches = ["Variant axis missing Error"];
    good.acceptance.zeroMismatch = true; // forged — gate must still fail on mismatches
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/components/badge.json"),
      `${JSON.stringify(good, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/components/badge.md"),
      `# stub\n${good.fileKey}\n${good.fingerprint.v6}\n`,
    );
    // satisfy required trio with copies
    for (const stem of ["switch", "card"]) {
      const src = JSON.parse(
        readFileSync(
          path.join(ROOT, `parity/receipts/console-loop/components/${stem}.json`),
          "utf8",
        ),
      );
      writeFileSync(
        path.join(dir, `parity/receipts/console-loop/components/${stem}.json`),
        `${JSON.stringify(src, null, 2)}\n`,
      );
      writeFileSync(
        path.join(dir, `parity/receipts/console-loop/components/${stem}.md`),
        `# stub\n${src.fileKey}\n${src.fingerprint.v6}\n`,
      );
    }
    const r = spawnSync(
      process.execPath,
      [path.join(dir, "scripts/console-loop-evidence-check.mjs")],
      { cwd: dir, encoding: "utf8", env: { ...process.env, CONSOLE_LOOP_REQUIRED: "badge,switch,card" } },
    );
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /mismatch/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
