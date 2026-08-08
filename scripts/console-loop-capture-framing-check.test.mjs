/**
 * Red-test fixture for the capture-framing pin.
 *
 * The pin's whole value is that it REFUSES a mis-framed shot by name. A gate
 * that only ever prints green proves nothing, so this fixture deliberately
 * points a stem at a whole-COMPONENT_SET screenshot and asserts the pin
 * exits non-zero naming that exact stem and the FC-CELL-FRAMING cause.
 *
 *   node --test scripts/console-loop-capture-framing-check.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "scripts/console-loop-capture-framing-check.mjs";
const run = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });
const outputOf = (r) => `${r.stdout ?? ""}${r.stderr ?? ""}`;

/** lane, stem, and a committed WHOLE-SET screenshot to mis-point it at. */
const RED_CASES = [
  ["astryx", "slider", "parity/receipts/console-loop/astryx/shots/slider.png"],
  ["polaris", "text-field", "parity/receipts/console-loop/polaris/shots/text-field.png"],
];

test("green: every committed shot is its pinned 1x VARIANT cell", () => {
  const r = run();
  const out = outputOf(r);
  assert.equal(r.status, 0, `capture-framing pin is red on the committed tree:\n${out}`);
  assert.match(out, /every committed shot is its 1x VARIANT cell/);
});

for (const [lane, stem, setShot] of RED_CASES) {
  test(`red: ${lane}/${stem} pointed at a whole-set shot fails BY NAME`, (t) => {
    if (!existsSync(path.join(ROOT, setShot))) {
      t.skip(`${setShot} not committed in this tree`);
      return;
    }
    const r = run(lane, "--red-test", `${lane}/${stem}=${setShot}`);
    const out = outputOf(r);
    assert.equal(
      r.status,
      1,
      `pin ACCEPTED a whole-set shot for ${lane}/${stem} — the framing guard is not wired:\n${out}`,
    );
    assert.ok(
      out.includes(`${lane}/${stem}:`),
      `pin refused but did not name the stem ${lane}/${stem}:\n${out}`,
    );
    assert.ok(
      out.includes("FC-CELL-FRAMING"),
      `pin refused but did not name the FC-CELL-FRAMING cause:\n${out}`,
    );
    assert.ok(
      out.includes("the shot is not that cell"),
      `pin refused without explaining the measurement:\n${out}`,
    );
  });
}

test("a hard cell-framing violation is NOT waivable by narration", () => {
  // FC-CELL-FRAMING must fail even though the receipts for these stems are
  // honest fail-closed with named defects — a capture either is that cell or
  // it is not, and no amount of receipt prose changes the pixels.
  const r = run("astryx", "--red-test", "astryx/token=parity/receipts/console-loop/astryx/shots/slider.png");
  const out = outputOf(r);
  assert.equal(r.status, 1, `narration waived a hard framing violation:\n${out}`);
  assert.ok(out.includes("astryx/token: FC-CELL-FRAMING"), out);
});
