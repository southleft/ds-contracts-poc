/**
 * IS THE MINTED SET USABLE — `npm run canvas:usable:check`
 *
 *   npx tsx scripts/canvas-usable-check.ts                     # --phase probed
 *   npx tsx scripts/canvas-usable-check.ts --phase full        # every row must be probed
 *   npx tsx scripts/canvas-usable-check.ts --write-receipt     # record the rendering
 *   npx tsx scripts/canvas-usable-check.ts --write-baseline    # re-record the pins, deliberately
 *   npx tsx scripts/canvas-usable-check.ts --self-test         # plant a red per assertion
 *
 * THE BAR. The owner was asked whether a minted Figma set must be *usable* as
 * a design-system component or merely *look right*, and chose usable: "a
 * screenshot-perfect set of frozen rectangles is useless to a DS team."
 * The census measures recognisability and round-trip; both can pass on a set
 * a designer cannot work with. This is the third column.
 *
 * WHAT THIS GATE HOLDS, per set (all four measured through the Plugin API):
 *   1. REFLOW         resize the variant COMPONENT and assert children re-lay.
 *   2. VARIANT AXES   switch an instance across every value of every axis and
 *                     assert the render actually changes.
 *   3. TOKEN BINDING  fills, strokes, spacing, sizing and radii bound to
 *                     variables, not literals; ratio reported per set.
 *   4. NO FAKE LAYOUT no absolutely-positioned child faking a flex row —
 *                     adjudicated against the contract, so a genuine
 *                     `position:absolute` passes.
 * The reasoning lives in extract/figma/census/usable.ts; this file is the
 * denominator, the phases, the receipt and the falsification.
 *
 * THE BASELINE, NOT AN EXCLUSION. Five failures reproduce on the eight
 * altitude sets measured today. A gate nobody runs is a gate that rots — it
 * stops being evidence and nobody notices — so those five are FROZEN BY NAME
 * in parity/receipts/v1/usable-baseline.json and the gate runs in the fast
 * lane against that pin. Four failure classes, so nothing moves silently:
 *   · NEW RED   a named failure the baseline does not pin. The pin key
 *               includes `detail` — which children froze, which axis values
 *               collapsed, which channels are literal — so a pinned defect
 *               that CHANGES SHAPE is a new red, not a quiet re-use of an old
 *               pin.
 *   · FIXED     a pin that no longer reproduces. It REFUSES until it is
 *               re-recorded: a fix nobody records silently un-freezes the
 *               moment the next defect regresses into the same slot.
 *   · STALE     a pin whose set has left the census, or is no longer probed.
 *   · DUPLICATE the same failure pinned twice.
 * Structural failures — a void observation, a wrong probe version, a canvas
 * the probe did not restore — are the gate's OWN integrity and can never be
 * pinned. They can only be fixed.
 *
 * REFUSAL, NEVER A SILENT PASS. The measurement is taken by an agent through
 * the figma-console MCP (a Node process cannot drive the bridge — docs/31 §6)
 * and committed as parity/receipts/v1/usable/<lib>/<id>.json. A row with no
 * observation reads PENDING and REFUSES BY NAME at --phase full; an
 * observation from any file but the scratch project, or at the wrong probe
 * version, is void and refused by name. Where the bridge is unavailable the
 * gate says so — it never reads absence as success.
 *
 * FALSIFICATION (`--self-test`): a real observation is copied and mutated
 * once per assertion, ON A SET THAT IS CLEAN ON THAT ASSERTION so the planted
 * red is the only thing the gate could be reacting to — (a) every child frozen
 * under a resize, (b) two values of an axis given the same fingerprint,
 * (c) every carrying channel turned literal, (d) a child made
 * layoutPositioning ABSOLUTE whose contract part is in flow — plus (e) the
 * file key changed to a non-scratch file, (f) the observation deleted at
 * --phase full, and (g) a PINNED failure healed so it no longer occurs, which
 * must refuse as FIXED. All seven must go red naming the row and the exact
 * code. A gate that cannot go red is not a gate, and a baseline that cannot
 * refuse its own staleness is not a burn-down.
 */
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MANIFEST_PATH,
  REPO,
  type CensusManifest,
  type ManifestRow,
} from "../extract/figma/census/corpus.js";
import {
  USABLE_BASELINE_MARKER,
  USABLE_BASELINE_PATH,
  USABLE_DIR,
  USABLE_RECEIPT_PATH,
  compareBaseline,
  judgeRow,
  redKey,
  packetPath,
  renderUsableReceipt,
  type RowUsable,
  type UsableBaseline,
  type UsableBaselineRow,
  type UsableObservation,
} from "../extract/figma/census/usable.js";

type Phase = "probed" | "full";

interface RunOptions {
  phase: Phase;
  manifestPath: string;
  usableDir: string;
  baselinePath: string;
  /** null = no receipt surface at all (self-test). */
  receiptPath: string | null;
  writeReceipt?: boolean;
}

export interface RunResult {
  ok: boolean;
  failures: string[];
  rows: RowUsable[];
  receipt: string;
  baseline: UsableBaselineRow[];
  pinned: Set<string>;
}

function readBaseline(p: string): {
  rows: UsableBaselineRow[];
  failures: string[];
} {
  if (!existsSync(p))
    return {
      rows: [],
      failures: [
        `${path.relative(REPO, p)} is MISSING — the gate has nothing to hold today's measured failures against; record it with \`npm run canvas:usable:check -- --write-baseline\``,
      ],
    };
  const b = JSON.parse(readFileSync(p, "utf8")) as UsableBaseline;
  const failures: string[] = [];
  if (b._marker !== USABLE_BASELINE_MARKER)
    failures.push(
      `${path.relative(REPO, p)} carries a different _marker than the gate — the file was hand-edited or is from another gate; re-record with --write-baseline`,
    );
  return { rows: b.rows ?? [], failures };
}

/**
 * Re-record the pins. `why` is HAND-WRITTEN prose — what the defect is and
 * what would fix it — and a re-record must never destroy it: for every pin
 * whose key survives, the committed `why` is carried forward verbatim. (This
 * repo has already lost 24 hand-written cause paragraphs once, to a `--ours`
 * merge resolution on the census. Not twice.) A genuinely new pin is seeded
 * with the gate's own message so it is never blank, and wants replacing by
 * hand.
 */
export function renderBaseline(
  rows: RowUsable[],
  prior: UsableBaselineRow[] = [],
): UsableBaseline {
  const measured = rows.filter((r) => r.observation !== null);
  const carried = new Map(
    prior.map((b) => [redKey(b.library, b.id, b), b.why] as const),
  );
  const pins: UsableBaselineRow[] = [];
  for (const r of rows)
    for (const red of r.reds) {
      const entry = {
        library: r.row.library,
        id: r.row.id,
        assertion: red.assertion,
        code: red.code,
        subject: red.subject,
        detail: red.detail,
        why: red.message,
      };
      const kept = carried.get(redKey(r.row.library, r.row.id, red));
      if (kept) entry.why = kept;
      pins.push(entry);
    }
  return {
    _marker: USABLE_BASELINE_MARKER,
    recordedAt: new Date().toISOString().slice(0, 10),
    totals: {
      probed: measured.length,
      clean: measured.filter(
        (r) =>
          r.structural.length === 0 &&
          [r.reflow, r.variants, r.binding, r.fakeLayout].every(
            (a) => a.verdict !== "fail",
          ),
      ).length,
      pinned: pins.length,
    },
    rows: pins,
  };
}

export function runUsable(opts: RunOptions): RunResult {
  const manifest = JSON.parse(
    readFileSync(opts.manifestPath, "utf8"),
  ) as CensusManifest;
  const failures: string[] = [];
  const rows: RowUsable[] = [];
  for (const row of manifest.rows) {
    const r = judgeRow(row, opts.usableDir);
    rows.push(r);
    // Structural failures are the gate's OWN integrity — a void observation, a
    // wrong probe version, a canvas the probe did not restore. They can never
    // be pinned in a baseline; they can only be fixed.
    failures.push(...r.structural);
    if (opts.phase === "full" && r.observation === null) {
      failures.push(
        `${row.library}/${row.id}: no usable observation (${path.relative(REPO, packetPath(row, opts.usableDir))} is missing) — run extract/figma/census/usable-probe.plugin.js through the figma-console bridge on page \`Census / ${row.library}\` and record it with extract/figma/census/usable-record.ts`,
      );
    }
  }
  const base = readBaseline(opts.baselinePath);
  failures.push(...base.failures);
  const judged = compareBaseline(rows, base.rows);
  failures.push(...judged.failures);
  const receipt = renderUsableReceipt(
    manifest,
    rows,
    opts.phase,
    failures,
    base.rows,
    judged.pinned,
  );
  if (opts.receiptPath) {
    if (opts.writeReceipt) writeFileSync(opts.receiptPath, receipt);
    else if (failures.length === 0) {
      const committed = existsSync(opts.receiptPath)
        ? readFileSync(opts.receiptPath, "utf8")
        : null;
      if (committed !== receipt)
        failures.push(
          `${path.relative(REPO, opts.receiptPath)} is ${committed === null ? "MISSING" : "STALE"} vs the recomputed rendering — run \`npm run canvas:usable:check -- --phase ${opts.phase} --write-receipt\` and commit the diff`,
        );
    }
  }
  return {
    ok: failures.length === 0,
    failures,
    rows,
    receipt,
    baseline: base.rows,
    pinned: judged.pinned,
  };
}

// ---------------------------------------------------------------------------
// Falsification
// ---------------------------------------------------------------------------

type Mutation = {
  code: string;
  what: string;
  mutate: (o: UsableObservation) => void;
  expect: (f: string) => boolean;
};

const MUTATIONS: Mutation[] = [
  {
    code: "FROZEN-CHILDREN",
    what: "(a) every child frozen under a +40×+40 resize",
    mutate: (o) => {
      o.reflow.responded = [];
      o.reflow.frozen = (o.reflow.before?.children ?? []).map((c) => c.name);
      if (o.reflow.after && o.reflow.before)
        o.reflow.after.children = o.reflow.before.children.map((c) => ({
          ...c,
        }));
      o.reflow.childCount = o.reflow.before?.children.length ?? 0;
      o.reflow.layoutMode = o.reflow.layoutMode ?? "HORIZONTAL";
    },
    expect: (f) => f.includes("FROZEN-CHILDREN:"),
  },
  {
    code: "DEAD-AXIS-VALUE",
    what: "(b) two values of an axis rendering identically",
    mutate: (o) => {
      const axis = (o.variants.axes ?? []).find((a) => a.values.length >= 2);
      if (!axis) throw new Error("self-test victim has no multi-value axis");
      axis.values[1].geometry = axis.values[0].geometry;
      axis.values[1].fills = axis.values[0].fills;
      axis.values[1].text = axis.values[0].text;
    },
    expect: (f) => f.includes("DEAD-AXIS"),
  },
  {
    code: "ALL-LITERAL",
    what: "(c) every carrying channel a literal, nothing bound",
    mutate: (o) => {
      const total = o.binding.total;
      o.binding.bound = 0;
      o.binding.inferred = 0;
      o.binding.literal = total;
      o.binding.byGroup = { fills: { bound: 0, inferred: 0, literal: total } };
      o.binding.literalSites = ["/label·fills[0]=SOLID"];
    },
    expect: (f) => f.includes("ALL-LITERAL:"),
  },
  {
    code: "FAKE-ABSOLUTE",
    what: "(d) an in-flow child absolutely positioned on the canvas",
    mutate: (o) => {
      const victim = o.layoutFacts.find(
        (f) =>
          f.layoutPositioning === "AUTO" && f.path !== `/${o.variantNodeName}`,
      );
      if (!victim) throw new Error("self-test victim has no in-flow child");
      victim.layoutPositioning = "ABSOLUTE";
    },
    expect: (f) => f.includes("FAKE-ABSOLUTE:"),
  },
  {
    code: "WRONG-FILE",
    what: "(e) an observation taken against a file that is not the scratch project",
    mutate: (o) => {
      o.fileKey = "Y8Jhw6R49wTLuXZ0is2GmV";
    },
    expect: (f) => f.includes("not the scratch project"),
  },
];

/** Clear EVERY condition that can produce a red, so a pinned failure on this
 *  observation provably stops reproducing. Used only by the self-test. */
function healAll(o: UsableObservation): void {
  o.reflow.error = undefined;
  o.reflow.resizeError = null;
  o.reflow.restoreError = null;
  o.reflow.restoredExact = true;
  o.reflow.frozen = [];
  o.reflow.responded = (o.reflow.before?.children ?? []).map((c) => ({
    name: c.name,
    dx: 1,
    dy: 0,
    dw: 0,
    dh: 0,
  }));
  if (o.reflow.layoutMode === "NONE") o.reflow.layoutMode = "HORIZONTAL";
  o.axesError = null;
  o.variants.error = undefined;
  o.variants.instantiable = true;
  o.variants.instanceRemoved = true;
  let n = 0;
  for (const a of o.variants.axes ?? []) {
    a.errors = [];
    for (const v of a.values) v.geometry = `healed-${n++}`;
  }
  o.binding.literal = 0;
  o.binding.literalSites = [];
  o.binding.literalSitesTruncated = 0;
  o.binding.bound = o.binding.total;
  o.binding.inferred = 0;
  for (const f of o.layoutFacts) {
    f.layoutPositioning = "AUTO";
    if (f.layoutMode === "NONE" && f.childCount >= 2)
      f.layoutMode = "HORIZONTAL";
  }
}

function selfTest(): number {
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as CensusManifest;
  const base = path.join(REPO, USABLE_DIR);
  const baselinePath = path.join(REPO, USABLE_BASELINE_PATH);
  const problems: string[] = [];
  const proofs: string[] = [];
  const tmp = mkdtempSync(path.join(tmpdir(), "usable-self-test-"));
  try {
    // A planted red only means something if the gate can read the real thing.
    const real = runUsable({
      phase: "probed",
      manifestPath,
      usableDir: base,
      baselinePath,
      receiptPath: null,
    });
    const measured = real.rows.filter((r) => r.observation !== null);
    if (measured.length === 0) {
      console.error(
        "✘ usable self-test FAILED: no committed observation to plant a red into — run the probe first",
      );
      return 1;
    }
    // The victim must be a set that is CLEAN on the assertion under test, so
    // that the planted red is the only thing the gate could be reacting to.
    // Every clean candidate is tried in manifest order and the FIRST that
    // produces the expected code is the proof; if none does, the assertion is
    // unfalsifiable on this corpus and the self-test says so by name.
    const candidates = (m: Mutation): RowUsable[] =>
      measured.filter((r) => {
        if (m.code === "FROZEN-CHILDREN") return r.reflow.verdict === "pass";
        if (m.code === "DEAD-AXIS-VALUE") return r.variants.verdict === "pass";
        if (m.code === "ALL-LITERAL") return r.binding.verdict === "pass";
        if (m.code === "FAKE-ABSOLUTE") return r.fakeLayout.verdict === "pass";
        return true;
      });

    for (const m of MUTATIONS) {
      const tried: string[] = [];
      let proved = false;
      for (const victim of candidates(m)) {
        const who = `${victim.row.library}/${victim.row.id}`;
        const dir = path.join(tmp, `${m.code}-${victim.row.id}`);
        cpSync(base, dir, { recursive: true });
        const p = packetPath(victim.row, dir);
        const o = JSON.parse(readFileSync(p, "utf8")) as UsableObservation;
        try {
          m.mutate(o);
        } catch (e) {
          tried.push(`${who} (could not plant: ${String(e)})`);
          continue;
        }
        writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
        const run = runUsable({
          phase: "probed",
          manifestPath,
          usableDir: dir,
          baselinePath,
          receiptPath: null,
        });
        if (
          !run.ok &&
          run.failures.some((f) => f.startsWith(`${who}:`) && m.expect(f))
        ) {
          proved = true;
          proofs.push(`${m.code} on ${who}`);
          break;
        }
        tried.push(who);
      }
      if (!proved) {
        problems.push(
          `${m.what} did not turn the gate red by name on any clean row (tried: ${tried.join(", ") || "none — no clean row on that assertion"})`,
        );
      }
    }

    // (g) A PINNED FAILURE THAT NO LONGER OCCURS must refuse. A burn-down
    //     that nobody records silently un-freezes the moment the next defect
    //     regresses into the same slot, so a fix has to be re-recorded.
    const firstPin = readFileSync(baselinePath, "utf8");
    const pins = (JSON.parse(firstPin) as UsableBaseline).rows;
    const pin = pins.find((b) =>
      measured.some((r) => r.row.library === b.library && r.row.id === b.id),
    );
    if (!pin) {
      problems.push(
        "(g) the baseline pins nothing on a probed row, so a healed pin cannot be tested",
      );
    } else {
      const dir = path.join(tmp, "healed");
      cpSync(base, dir, { recursive: true });
      const victimRow = measured.find(
        (r) => r.row.library === pin.library && r.row.id === pin.id,
      )!;
      const pth = packetPath(victimRow.row, dir);
      const o = JSON.parse(readFileSync(pth, "utf8")) as UsableObservation;
      healAll(o);
      writeFileSync(pth, JSON.stringify(o, null, 2) + "\n");
      const run = runUsable({
        phase: "probed",
        manifestPath,
        usableDir: dir,
        baselinePath,
        receiptPath: null,
      });
      const who = `${pin.library}/${pin.id}`;
      if (
        run.ok ||
        !run.failures.some(
          (f) => f.startsWith(`${who}: FIXED`) && f.includes(pin.code),
        )
      ) {
        problems.push(
          `(g) healing the pinned ${pin.code} on ${who} did not refuse as FIXED (${run.ok ? "gate stayed green" : run.failures.slice(0, 2).join(" | ")})`,
        );
      } else {
        proofs.push(`FIXED on ${who} (${pin.code})`);
      }
    }

    // (f) --phase full with a row unprobed → refusal naming the row.
    const unprobed = manifest.rows.find(
      (r: ManifestRow) => !existsSync(packetPath(r, base)),
    );
    if (unprobed) {
      const full = runUsable({
        phase: "full",
        manifestPath,
        usableDir: base,
        baselinePath,
        receiptPath: null,
      });
      const who = `${unprobed.library}/${unprobed.id}`;
      if (
        full.ok ||
        !full.failures.some(
          (f) => f.startsWith(`${who}:`) && f.includes("no usable observation"),
        )
      ) {
        problems.push(
          `(f) --phase full with ${who} unprobed did not refuse by name`,
        );
      }
    } else {
      // Every row is probed: delete one in a copy and hold --phase full there.
      const victim = manifest.rows[0];
      const dir = path.join(tmp, "phase-full");
      cpSync(base, dir, { recursive: true });
      rmSync(packetPath(victim, dir));
      const full = runUsable({
        phase: "full",
        manifestPath,
        usableDir: dir,
        baselinePath,
        receiptPath: null,
      });
      const who = `${victim.library}/${victim.id}`;
      if (
        full.ok ||
        !full.failures.some(
          (f) => f.startsWith(`${who}:`) && f.includes("no usable observation"),
        )
      ) {
        problems.push(
          `(f) deleting ${who}'s observation did not refuse at --phase full`,
        );
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (problems.length > 0) {
    console.error(
      `✘ canvas-usable self-test FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    return 1;
  }
  console.log(
    "✔ canvas-usable self-test: (a) frozen children → FROZEN-CHILDREN; (b) identical axis values → DEAD-AXIS-VALUE; (c) nothing bound → ALL-LITERAL; " +
      "(d) in-flow child positioned ABSOLUTE → FAKE-ABSOLUTE; (e) observation from another file → void; " +
      "(f) unprobed row at --phase full → refused by name; (g) a pinned failure that no longer occurs → FIXED\n" +
      `  proved on: ${proofs.join("; ")}`,
  );
  return 0;
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  const phaseArg = argv[argv.indexOf("--phase") + 1];
  const phase: Phase = argv.includes("--phase")
    ? (phaseArg as Phase)
    : "probed";
  if (phase !== "probed" && phase !== "full") {
    console.error(
      `✘ --phase must be probed or full (got ${JSON.stringify(phaseArg)})`,
    );
    return 2;
  }
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  const usableDir = path.join(REPO, USABLE_DIR);
  const baselinePath = path.join(REPO, USABLE_BASELINE_PATH);
  if (argv.includes("--write-baseline")) {
    // Judges nothing: records today's measured failures as the pins the gate
    // will hold tomorrow. Deliberate, and the diff has to say what moved.
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as CensusManifest;
    const rows = manifest.rows.map((r) => judgeRow(r, usableDir));
    const prior = existsSync(baselinePath)
      ? (JSON.parse(readFileSync(baselinePath, "utf8")) as UsableBaseline).rows
      : [];
    const written = renderBaseline(rows, prior);
    writeFileSync(baselinePath, JSON.stringify(written, null, 2) + "\n");
    console.log(
      `wrote ${USABLE_BASELINE_PATH}: ${written.totals.pinned} pinned failure(s) across ${written.totals.probed} probed set(s); ${written.totals.clean} clean`,
    );
  }
  const result = runUsable({
    phase,
    manifestPath,
    usableDir,
    baselinePath,
    receiptPath: path.join(REPO, USABLE_RECEIPT_PATH),
    writeReceipt: argv.includes("--write-receipt"),
  });
  const measured = result.rows.filter((r) => r.observation !== null);
  const clean = measured.filter(
    (r) =>
      [r.reflow, r.variants, r.binding, r.fakeLayout].every(
        (a) => a.verdict !== "fail",
      ) && r.structural.length === 0,
  );
  console.log(
    `canvas usable (${phase}): ${measured.length}/${result.rows.length} census rows probed; ${clean.length}/${measured.length} usable on all four assertions; ` +
      `${result.pinned.size}/${result.baseline.length} baseline pin(s) still reproducing; receipt ${USABLE_RECEIPT_PATH}`,
  );
  for (const r of measured) {
    const g = (v: string) =>
      v === "pass" ? "pass" : v === "n/a" ? "n/a " : "FAIL";
    console.log(
      `  ${r.row.library}/${r.row.id}: reflow ${g(r.reflow.verdict)} · variants ${g(r.variants.verdict)} · binding ${g(r.binding.verdict)} ${r.bindingRatio} · layout ${g(r.fakeLayout.verdict)}`,
    );
  }
  if (!result.ok) {
    console.error(
      `✘ canvas-usable gate RED — ${result.failures.length} failure(s):\n${result.failures.map((f) => `  - ${f}`).join("\n")}`,
    );
    return 1;
  }
  console.log("✔ canvas-usable gate green");
  return 0;
}

process.exit(main());
