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

test("console-loop-mui-evidence-check refuses a pass-claim against a failing scorecard (strict lane)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "console-loop-mui-ev-"));
  try {
    mkdirSync(path.join(dir, "parity/receipts/console-loop/mui/components"), {
      recursive: true,
    });
    mkdirSync(path.join(dir, "parity/receipts/console-loop/mui/scores"), {
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
    const srcDir = path.join(ROOT, "parity/receipts/console-loop/mui/components");
    const forged = JSON.parse(
      readFileSync(path.join(srcDir, "button.json"), "utf8"),
    );
    // Forge a visual pass-claim on a stem whose scorecard fails the one bar.
    forged.visual.ok = true;
    forged.visual.matchDeveloped = true;
    forged.visual.status = "scored-pass";
    forged.visual.defects = [];
    forged.acceptance.visualMatchDeveloped = true;
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.json"),
      `${JSON.stringify(forged, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.md"),
      `# stub\n${forged.fileKey}\n${forged.fingerprint.v6}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/scores/button.json"),
      `${JSON.stringify(
        {
          version: 3,
          status: "fail",
          passBar: { pctAAMaskedMax: 5, compositionOk: true },
          metrics: { pctAAMasked: 88.31 },
          compositionOk: true,
        },
        null,
        2,
      )}\n`,
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
    assert.match(`${r.stderr}${r.stdout}`, /pass-claim contradicts its scorecard/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("console-loop-mui-evidence-check refuses a pass-claim with NO scorecard (strict lane)", () => {
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
    const srcDir = path.join(ROOT, "parity/receipts/console-loop/mui/components");
    const forged = JSON.parse(
      readFileSync(path.join(srcDir, "button.json"), "utf8"),
    );
    forged.visual.ok = true;
    forged.visual.matchDeveloped = true;
    forged.visual.status = "scored-pass";
    forged.visual.defects = [];
    forged.acceptance.visualMatchDeveloped = true;
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.json"),
      `${JSON.stringify(forged, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/button.md"),
      `# stub\n${forged.fileKey}\n${forged.fingerprint.v6}\n`,
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
    assert.match(`${r.stderr}${r.stdout}`, /without pixel scorecard/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("console-loop-mui-evidence-check refuses a CROSS-PLANE reference (state plane the canvas cannot express)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "console-loop-mui-ev-"));
  try {
    for (const d of [
      "parity/receipts/console-loop/mui/components",
      "parity/receipts/console-loop/mui/scores",
      "scripts",
      "examples/mui/oracle",
      "examples/mui/contracts",
      "extract/computed/configs",
    ]) {
      mkdirSync(path.join(dir, d), { recursive: true });
    }
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
    // The two inputs the refusal is derived from: the capture config's stateProps
    // and the contract's own Figma binding for that prop.
    writeFileSync(
      path.join(dir, "extract/computed/configs/mui.json"),
      `${JSON.stringify(
        {
          components: [
            {
              name: "Checkbox",
              contract: "examples/mui/contracts-seed/checkbox.contract.json",
              stateProps: [{ prop: "disabled", state: "disabled" }],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(dir, "examples/mui/contracts/checkbox.contract.json"),
      `${JSON.stringify(
        {
          id: "mui.checkbox",
          states: ["disabled"],
          props: [
            { name: "disabled", type: "boolean", default: false, bindings: { figma: { kind: "BOOLEAN" } } },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const src = path.join(ROOT, "parity/receipts/console-loop/mui/components/checkbox.json");
    const receipt = JSON.parse(readFileSync(src, "utf8"));
    // Honest FAIL-CLOSED receipt — the refusal must fire in this direction too.
    receipt.visual.ok = false;
    receipt.visual.matchDeveloped = false;
    receipt.visual.status = "fail-closed";
    receipt.visual.defects = ["named defect"];
    receipt.acceptance.visualMatchDeveloped = false;
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/checkbox.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/components/checkbox.md"),
      `# stub\n${receipt.fileKey}\n${receipt.fingerprint.v6}\n`,
    );
    writeFileSync(
      path.join(dir, "parity/receipts/console-loop/mui/scores/checkbox.json"),
      `${JSON.stringify(
        {
          version: 3,
          status: "fail",
          passBar: { pctAAMaskedMax: 5, compositionOk: true },
          metrics: { pctAAMasked: 81.48 },
          compositionOk: true,
          reference: "extract/computed/out/mui/checkbox/orig-shots/checked.disabled__default.png",
        },
        null,
        2,
      )}\n`,
    );
    const r = spawnSync(
      process.execPath,
      [path.join(dir, "scripts/console-loop-mui-evidence-check.mjs")],
      {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, CONSOLE_LOOP_MUI_REQUIRED: "checkbox" },
      },
    );
    assert.notEqual(r.status, 0);
    assert.match(`${r.stderr}${r.stdout}`, /CROSS-PLANE REFERENCE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
