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
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

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
  assert.match(out, /every committed shot is its 1x VARIANT cell where one is pinned/);
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

/* ------------------------------------------------------------------------ *
 * C1b — FC-SLOT-FILL-OUTSIDE-EMIT, both halves.
 *
 * The five first-party COMPOSITION stems are slot components whose scored
 * surface is the FILLED one, applied OUTSIDE the emitter. Re-running such a
 * stem's own committed script EMPTIES its slots, and the damage takes two
 * shapes — which is why one check cannot cover it:
 *
 *   HUG tracks   the cell COLLAPSES (measured: sidebar-layout 640x23 -> 640x1)
 *                and C1's box comparison bites.
 *   FIXED tracks the cell holds a perfectly correct 640x480 and loses only its
 *                CONTENT. C1 sees nothing. C1b's ink floor is the only guard.
 *
 * Both are pinned here so neither half can regress into silence again.
 * ------------------------------------------------------------------------ */
const SCRATCH_SHOTS = path.join(ROOT, "parity/receipts/console-loop/shots");

test("red: a composition stem that went BLANK at the right box fails BY NAME (C1b)", () => {
  // bento-grid and page-shell keep 640x480 on FIXED tracks when emptied, so
  // this is the shape C1 provably cannot see.
  const scratch = path.join(SCRATCH_SHOTS, "__c1b-blank-redtest.png");
  const png = new PNG({ width: 640, height: 480 });
  png.data.fill(255);
  writeFileSync(scratch, PNG.sync.write(png));
  try {
    const r = run("first-party", "--red-test", `first-party/page-shell=${path.relative(ROOT, scratch)}`);
    const out = outputOf(r);
    assert.equal(r.status, 1, `a blank composition surface passed the pin:\n${out}`);
    assert.ok(
      out.includes("first-party/page-shell: FC-CELL-INK-LOST"),
      `blank surface refused but did not name FC-CELL-INK-LOST:\n${out}`,
    );
    assert.match(out, /carries 0\.00% ink but this stem pins a floor of/);
  } finally {
    rmSync(scratch, { force: true });
  }
});

test("red: a composition stem whose cell COLLAPSED fails BY NAME (C1)", () => {
  // The HUG-track shape: sidebar-layout 640x23 -> 640x1, measured 2026-08-12.
  const scratch = path.join(SCRATCH_SHOTS, "__c1-collapse-redtest.png");
  const png = new PNG({ width: 640, height: 1 });
  png.data.fill(255);
  writeFileSync(scratch, PNG.sync.write(png));
  try {
    const r = run("first-party", "--red-test", `first-party/sidebar-layout=${path.relative(ROOT, scratch)}`);
    const out = outputOf(r);
    assert.equal(r.status, 1, `a collapsed composition cell passed the pin:\n${out}`);
    assert.ok(
      out.includes("first-party/sidebar-layout: FC-CELL-FRAMING"),
      `collapsed cell refused but did not name FC-CELL-FRAMING:\n${out}`,
    );
  } finally {
    rmSync(scratch, { force: true });
  }
});

test("a hard cell-framing violation is NOT waivable by narration", () => {
  // FC-CELL-FRAMING must fail even though the receipts for these stems are
  // honest fail-closed with named defects — a capture either is that cell or
  // it is not, and no amount of receipt prose changes the pixels.
  const r = run("astryx", "--red-test", "astryx/token=parity/receipts/console-loop/astryx/shots/slider.png");
  const out = outputOf(r);
  assert.equal(r.status, 1, `narration waived a hard framing violation:\n${out}`);
  assert.ok(out.includes("astryx/token: FC-CELL-FRAMING"), out);
});

/* ------------------------------------------------------------------------ *
 * Red tests for the 2026-08-08 reference-audit extension: cellPending, C3b
 * (resolvable provenance) and C4 (reference flush to its stage edge).
 *
 * These three are RECEIPT-side and REFERENCE-side conditions, so the existing
 * `--red-test` shot override cannot reach them. Each case builds a throwaway
 * lane out of PNGs already committed in this tree, runs the pin against that
 * lane by name, and removes it again — so the assertions are made against the
 * real checker, not a mock of it.
 * ------------------------------------------------------------------------ */
const FIXTURE_LANE = "redtest-fixture";
const FIXTURE_DIR = path.join(ROOT, "parity/receipts/console-loop", FIXTURE_LANE);
/** A committed reference whose ink is flush to TWO stage edges (mui/menu). */
const CLIPPED_REF = "parity/receipts/console-loop/mui/refs/menu.png";
/** A committed shot that is flush to no edge — safe filler for C2/C4. */
const CLEAN_PNG = "parity/receipts/console-loop/mui/shots/menu-cell.png";

function buildFixture({ stems, guardExtras = {}, receipts, shots = {}, scores = {} }) {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
  mkdirSync(path.join(FIXTURE_DIR, "components"), { recursive: true });
  mkdirSync(path.join(FIXTURE_DIR, "shots"), { recursive: true });
  mkdirSync(path.join(FIXTURE_DIR, "scores"), { recursive: true });
  for (const stem of Object.keys(stems)) {
    copyFileSync(path.join(ROOT, shots[stem] ?? CLEAN_PNG), path.join(FIXTURE_DIR, "shots", `${stem}-cell.png`));
    writeFileSync(
      path.join(FIXTURE_DIR, "components", `${stem}.json`),
      `${JSON.stringify(receipts[stem], null, 2)}\n`,
    );
    if (scores[stem] !== undefined) {
      writeFileSync(
        path.join(FIXTURE_DIR, "scores", `${stem}.json`),
        `${JSON.stringify({ metrics: { pctAAMasked: scores[stem] } }, null, 2)}\n`,
      );
    }
  }
  writeFileSync(
    path.join(FIXTURE_DIR, "framing.json"),
    `${JSON.stringify(
      {
        version: 1,
        kind: "console-loop-capture-framing-pin",
        lane: FIXTURE_LANE,
        note: "throwaway red-test fixture — created and removed by console-loop-capture-framing-check.test.mjs",
        guard: {
          marginMinPx: -1, marginMaxPx: 17, marginSkewMaxPx: 2,
          scaleRatioMax: 1.35, aspectRatioMax: 1.35, dprBand: [1.7, 2.4],
          framingCauses: ["FC-REF-FRAMING", "FC-REF-STAGE-EDGE", "FC-REF-UNVERIFIABLE-PROVENANCE"],
          ...guardExtras,
        },
        refAllow: ["parity/receipts/console-loop/", "extract/computed/out/"],
        stems,
      },
      null,
      2,
    )}\n`,
  );
}
const withFixture = (spec, fn) => {
  buildFixture(spec);
  try {
    return fn(run(FIXTURE_LANE));
  } finally {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
};
const PENDING = { cellPending: { reason: "red-test fixture: no live cell to mint from" } };
const receipt = (reference, referenceSource, defects, ok = false) => ({
  visual: { ok, matchDeveloped: ok, reference, referenceSource, defects },
});

test("red: cellPending without a reason is refused", () => {
  withFixture(
    {
      stems: { nostated: { cellPending: {} } },
      receipts: { nostated: receipt(CLEAN_PNG, CLEAN_PNG, []) },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 1, `pin accepted an unpinned capture with no stated reason:\n${out}`);
      assert.ok(out.includes("cellPending without a reason"), out);
    },
  );
});

test("green: cellPending WITH a reason skips C1 and is counted, not hidden", () => {
  withFixture(
    {
      stems: { pending: PENDING },
      receipts: { pending: receipt(CLEAN_PNG, CLEAN_PNG, []) },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 0, out);
      assert.ok(out.includes("C1 NOT ASSERTED (cell-pending)"), out);
      assert.match(out, /1 cell-PENDING with a named reason/);
    },
  );
});

test("red: C3b refuses a bare-filename referenceSource when the lane opts in", () => {
  withFixture(
    {
      stems: { bare: PENDING },
      guardExtras: { requireResolvableProvenance: true },
      receipts: { bare: receipt(CLEAN_PNG, "pair--unset.lg__default.png#package-left-pill", []) },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 1, `pin accepted a provenance claim nothing can resolve:\n${out}`);
      assert.ok(out.includes("FC-REF-UNVERIFIABLE-PROVENANCE"), out);
      assert.ok(out.includes("carries no repo path"), out);
    },
  );
});

test("green: C3b is OFF for lanes that have not opted in", () => {
  withFixture(
    {
      stems: { bare: PENDING },
      receipts: { bare: receipt(CLEAN_PNG, "pair--unset.lg__default.png#package-left-pill", []) },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 0, `C3b fired on a lane that never opted in — sibling lanes would redden:\n${out}`);
      assert.ok(!out.includes("FC-REF-UNVERIFIABLE-PROVENANCE"), out);
    },
  );
});

test("red: C4 refuses a reference whose ink is flush to its stage edge", () => {
  withFixture(
    {
      stems: { clipped: PENDING },
      guardExtras: { stageClipCheck: true },
      receipts: { clipped: receipt(CLIPPED_REF, CLIPPED_REF, ["FC-REF-FRAMING"]) },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 1, `pin accepted a stage-clipped reference:\n${out}`);
      assert.ok(out.includes("FC-REF-STAGE-EDGE"), out);
      assert.ok(out.includes("flush against stage edge(s) [T,B]"), out);
    },
  );
});

test("green: C4 is waived when the receipt NAMES FC-REF-STAGE-EDGE", () => {
  withFixture(
    {
      stems: { clipped: PENDING },
      guardExtras: { stageClipCheck: true },
      receipts: {
        clipped: receipt(CLIPPED_REF, CLIPPED_REF, [
          "FC-REF-STAGE-EDGE: the harness stage cut this render",
          "FC-REF-FRAMING",
        ]),
      },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 0, `an honestly named stage clip should be open, not red:\n${out}`);
      assert.ok(out.includes("open (named)") && out.includes("FC-REF-STAGE-EDGE"), out);
    },
  );
});

/* ------------------------------------------------------------------------ *
 * C5 (reference sweep) and C6 (reference tone) — the two content checks.
 *
 * Both red halves are the MEASURED cases, replayed out of committed PNGs:
 *   C5  the carbon Toggle cell pointed at its own toggled-ON sibling render
 *       (the gate must name the untoggled sibling that wins the sweep);
 *   C6  the mui Button cell pointed at the DISABLED render of its own variant,
 *       carrying the real pctAAMasked=6.36 that pair scored — a number under
 *       2x the bar for two pictures that share almost no colour.
 * ------------------------------------------------------------------------ */
const TOGGLE_SHOT = "parity/receipts/console-loop/carbon/shots/toggle-cell.png";
const TOGGLE_WRONG_REF = "extract/computed/out/carbon/toggle/gate-shots/toggled.enabled__default.png";
const MUI_BUTTON_SHOT = "parity/receipts/console-loop/mui/shots/button-cell.png";
const MUI_BUTTON_DISABLED_REF =
  "extract/computed/out/mui/button/gate-shots/contained.error.large.disabled__default.png";

const sweepSpec = (defects, ok = false) => ({
  stems: { toggleswap: PENDING },
  guardExtras: { referenceSweepCheck: true },
  shots: { toggleswap: TOGGLE_SHOT },
  receipts: { toggleswap: receipt(TOGGLE_WRONG_REF, TOGGLE_WRONG_REF, defects, ok) },
});

test("red: C5 refuses a reference pointed at a sibling VARIANT and names the winner", (t) => {
  if (!existsSync(path.join(ROOT, TOGGLE_WRONG_REF))) {
    t.skip(`${TOGGLE_WRONG_REF} not committed in this tree`);
    return;
  }
  withFixture(sweepSpec(["FC-REF-FRAMING"]), (r) => {
    const out = outputOf(r);
    assert.equal(
      r.status,
      1,
      `pin accepted a reference depicting the TOGGLED render of an untoggled cell:\n${out}`,
    );
    assert.ok(out.includes("FC-REF-WRONG-VARIANT"), out);
    // The whole point of a sweep is that it NAMES the retarget, not just the fault.
    assert.match(
      out,
      /untoggled\.\w[\w.-]*__default\.png/,
      `C5 refused but did not name the sibling stem that wins the sweep:\n${out}`,
    );
    assert.ok(out.includes("colour-histogram distance"), out);
  });
});

test("green: C5 is OFF for lanes that have not opted in", (t) => {
  if (!existsSync(path.join(ROOT, TOGGLE_WRONG_REF))) {
    t.skip(`${TOGGLE_WRONG_REF} not committed in this tree`);
    return;
  }
  const spec = sweepSpec(["FC-REF-FRAMING"]);
  spec.guardExtras = {};
  withFixture(spec, (r) => {
    const out = outputOf(r);
    assert.equal(r.status, 0, `C5 fired on a lane that never opted in:\n${out}`);
    assert.ok(!out.includes("FC-REF-WRONG-VARIANT"), out);
  });
});

test("green: C5 is waived when the receipt NAMES the retarget as examined-and-refused", (t) => {
  if (!existsSync(path.join(ROOT, TOGGLE_WRONG_REF))) {
    t.skip(`${TOGGLE_WRONG_REF} not committed in this tree`);
    return;
  }
  withFixture(
    sweepSpec([
      "FC-REF-SWEEP-DECOY: the sweep winner is a different variant of the same axis; retarget refused",
      "FC-REF-FRAMING",
    ]),
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 0, `an honestly refused retarget should be open, not red:\n${out}`);
      assert.ok(out.includes("open (named)") && out.includes("FC-REF-SWEEP-DECOY"), out);
    },
  );
});

test("red: a swept-out reference on a receipt CLAIMING a pass is never waivable", (t) => {
  if (!existsSync(path.join(ROOT, TOGGLE_WRONG_REF))) {
    t.skip(`${TOGGLE_WRONG_REF} not committed in this tree`);
    return;
  }
  withFixture(sweepSpec(["FC-REF-WRONG-VARIANT", "FC-REF-FRAMING"], true), (r) => {
    const out = outputOf(r);
    assert.equal(r.status, 1, `narration waived a wrong-variant reference under a PASS claim:\n${out}`);
    assert.ok(out.includes("receipt CLAIMS a visual pass"), out);
  });
});

const toneSpec = (defects, aa = 6.36) => ({
  stems: { toneswap: PENDING },
  guardExtras: { referenceToneCheck: true },
  shots: { toneswap: MUI_BUTTON_SHOT },
  scores: { toneswap: aa },
  receipts: { toneswap: receipt(MUI_BUTTON_DISABLED_REF, MUI_BUTTON_DISABLED_REF, defects) },
});

test("red: C6 refuses a tone swap that the AA number reads as near-identical", (t) => {
  if (!existsSync(path.join(ROOT, MUI_BUTTON_DISABLED_REF))) {
    t.skip(`${MUI_BUTTON_DISABLED_REF} not committed in this tree`);
    return;
  }
  withFixture(toneSpec(["FC-REF-FRAMING"]), (r) => {
    const out = outputOf(r);
    assert.equal(
      r.status,
      1,
      `pin accepted a pair sharing almost no colour while AA=6.36 called them close:\n${out}`,
    );
    assert.ok(out.includes("FC-REF-TONE-SWAP"), out);
    assert.ok(out.includes("share almost no colour"), out);
    assert.ok(out.includes("6.36"), `C6 refused without printing the AA it is contradicting:\n${out}`);
  });
});

test("green: C6 is OFF for lanes that have not opted in", (t) => {
  if (!existsSync(path.join(ROOT, MUI_BUTTON_DISABLED_REF))) {
    t.skip(`${MUI_BUTTON_DISABLED_REF} not committed in this tree`);
    return;
  }
  const spec = toneSpec(["FC-REF-FRAMING"]);
  spec.guardExtras = {};
  withFixture(spec, (r) => {
    const out = outputOf(r);
    assert.equal(r.status, 0, `C6 fired on a lane that never opted in:\n${out}`);
    assert.ok(!out.includes("FC-REF-TONE-SWAP"), out);
  });
});

test("green: C6 stays silent outside the band where AA claims closeness", (t) => {
  if (!existsSync(path.join(ROOT, MUI_BUTTON_DISABLED_REF))) {
    t.skip(`${MUI_BUTTON_DISABLED_REF} not committed in this tree`);
    return;
  }
  // Same tone gap, but the stem is already failing loudly at 88.31 — the tone
  // number adds nothing there and must not add a second red to one defect.
  withFixture(toneSpec(["FC-REF-FRAMING"], 88.31), (r) => {
    const out = outputOf(r);
    assert.equal(r.status, 0, `C6 fired on a stem whose AA is nowhere near the bar:\n${out}`);
    assert.ok(!out.includes("FC-REF-TONE-SWAP"), out);
  });
});

test("red: a stage-clipped reference on a receipt CLAIMING a pass is never waivable", () => {
  withFixture(
    {
      stems: { clipped: PENDING },
      guardExtras: { stageClipCheck: true },
      receipts: {
        clipped: receipt(CLIPPED_REF, CLIPPED_REF, ["FC-REF-STAGE-EDGE"], true),
      },
    },
    (r) => {
      const out = outputOf(r);
      assert.equal(r.status, 1, `narration waived a stage clip under a PASS claim:\n${out}`);
      assert.ok(out.includes("receipt CLAIMS a visual pass"), out);
    },
  );
});
