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
const CHECK = path.join(ROOT, "scripts/live-figma-evidence-check.mjs");

test("live-figma-evidence-check passes on committed receipt", () => {
  const r = spawnSync(process.execPath, [CHECK], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stderr}${r.stdout}`);
  assert.match(r.stdout, /completed receipt/);
});

test("live-figma-evidence-check refuses a forged clean edit", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "live-figma-ev-"));
  try {
    mkdirSync(path.join(dir, "parity/receipts"), { recursive: true });
    mkdirSync(path.join(dir, "scripts"), { recursive: true });
    cpSync(CHECK, path.join(dir, "scripts/live-figma-evidence-check.mjs"));
    const good = JSON.parse(
      readFileSync(
        path.join(ROOT, "parity/receipts/live-figma-variant-drift.json"),
        "utf8",
      ),
    );
    good.phases.afterEdit.drifted = false;
    good.phases.afterEdit.fingerprint = good.phases.baseline.fingerprint;
    good.phases.afterEdit.bound = good.phases.baseline.bound;
    good.phases.afterEdit.paddingLeft = 8;
    writeFileSync(
      path.join(dir, "parity/receipts/live-figma-variant-drift.json"),
      `${JSON.stringify(good, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/live-figma-variant-drift.md"),
      `# stub\n${good.session.fileKey}\n${good.phases.baseline.fingerprint}\n`,
    );
    const r = spawnSync(
      process.execPath,
      [path.join(dir, "scripts/live-figma-evidence-check.mjs")],
      { cwd: dir, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /afterEdit/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
