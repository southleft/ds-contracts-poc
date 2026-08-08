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
const CHECK = path.join(ROOT, "scripts/console-loop-mui-evidence-check.mjs");
const SCORE_LIB = path.join(ROOT, "scripts/console-loop-scorecard-lib.mjs");

test("console-loop-mui-evidence-check passes on committed receipts", () => {
  const r = spawnSync(process.execPath, [CHECK], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stderr}${r.stdout}`);
  assert.match(r.stdout, /31\/31/);
});

test("console-loop-mui-evidence-check refuses a mismatched round-trip", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "console-loop-mui-ev-"));
  try {
    mkdirSync(path.join(dir, "parity/receipts/console-loop/mui/components"), {
      recursive: true,
    });
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    mkdirSync(path.join(dir, "examples/mui/oracle"), { recursive: true });
    cpSync(CHECK, path.join(dir, "scripts/console-loop-mui-evidence-check.mjs"));
    cpSync(SCORE_LIB, path.join(dir, "scripts/console-loop-scorecard-lib.mjs"));
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/RATCHET.json"),
      `${JSON.stringify({ version: 1, floors: { mui: 0 } }, null, 2)}\n`,
    );
    cpSync(
      path.join(ROOT, "examples/mui/oracle/DENOMINATOR-50.json"),
      path.join(dir, "examples/mui/oracle/DENOMINATOR-50.json"),
    );
    // Copy all good receipts then forge button
    const srcDir = path.join(ROOT, "parity/receipts/console-loop/mui/components");
    for (const f of ["button", "switch", "chip"]) {
      /* minimal set via env */
    }
    const good = JSON.parse(
      readFileSync(path.join(srcDir, "button.json"), "utf8"),
    );
    good.roundtrip.mismatches = ["Variant axis drifted"];
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.json"),
      `${JSON.stringify(good, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.md"),
      `# stub\n${good.fileKey}\n${good.fingerprint.v6}\n`,
    );
    const r = spawnSync(
      process.execPath,
      [path.join(dir, "scripts/console-loop-mui-evidence-check.mjs")],
      {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, CONSOLE_LOOP_MUI_REQUIRED: "button" },
      },
    );
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /mismatch/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
