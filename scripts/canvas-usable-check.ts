/**
 * IS THE MINTED SET USABLE — `npm run canvas:usable:check`
 *
 *   npx tsx scripts/canvas-usable-check.ts                     # --phase probed
 *   npx tsx scripts/canvas-usable-check.ts --phase full        # every row must be probed
 *   npx tsx scripts/canvas-usable-check.ts --write-receipt     # record the rendering
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
 * REFUSAL, NEVER A SILENT PASS. The measurement is taken by an agent through
 * the figma-console MCP (a Node process cannot drive the bridge — docs/31 §6)
 * and committed as parity/receipts/v1/usable/<lib>/<id>.json. A row with no
 * observation reads PENDING and REFUSES BY NAME at --phase full; an
 * observation from any file but the scratch project, or at the wrong probe
 * version, is void and refused by name. Where the bridge is unavailable the
 * gate says so — it never reads absence as success.
 *
 * FALSIFICATION (`--self-test`): a real observation is copied and mutated
 * FOUR times, once per assertion — (a) every child frozen under a resize,
 * (b) two values of an axis given the same fingerprint, (c) every carrying
 * channel turned literal, (d) a child made layoutPositioning ABSOLUTE whose
 * contract part is in flow — plus (e) the file key changed to a non-scratch
 * file and (f) the observation deleted at --phase full. All six must go red
 * naming the row and the code. A gate that cannot go red is not a gate.
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
  USABLE_DIR,
  USABLE_RECEIPT_PATH,
  judgeRow,
  packetPath,
  renderUsableReceipt,
  type RowUsable,
  type UsableObservation,
} from "../extract/figma/census/usable.js";

type Phase = "probed" | "full";

interface RunOptions {
  phase: Phase;
  manifestPath: string;
  usableDir: string;
  /** null = no receipt surface at all (self-test). */
  receiptPath: string | null;
  writeReceipt?: boolean;
}

export interface RunResult {
  ok: boolean;
  failures: string[];
  rows: RowUsable[];
  receipt: string;
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
    failures.push(...r.failures);
    if (opts.phase === "full" && r.observation === null) {
      failures.push(
        `${row.library}/${row.id}: no usable observation (${path.relative(REPO, packetPath(row, opts.usableDir))} is missing) — run extract/figma/census/usable-probe.plugin.js through the figma-console bridge on page \`Census / ${row.library}\` and record it with extract/figma/census/usable-record.ts`,
      );
    }
  }
  const receipt = renderUsableReceipt(manifest, rows, opts.phase, failures);
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
  return { ok: failures.length === 0, failures, rows, receipt };
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

function selfTest(): number {
  const manifestPath = path.join(REPO, MANIFEST_PATH);
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as CensusManifest;
  const base = path.join(REPO, USABLE_DIR);
  const problems: string[] = [];
  const proofs: string[] = [];
  const tmp = mkdtempSync(path.join(tmpdir(), "usable-self-test-"));
  try {
    // A planted red only means something if the gate can read the real thing.
    const real = runUsable({
      phase: "probed",
      manifestPath,
      usableDir: base,
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

    // (f) --phase full with a row unprobed → refusal naming the row.
    const unprobed = manifest.rows.find(
      (r: ManifestRow) => !existsSync(packetPath(r, base)),
    );
    if (unprobed) {
      const full = runUsable({
        phase: "full",
        manifestPath,
        usableDir: base,
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
      "(d) in-flow child positioned ABSOLUTE → FAKE-ABSOLUTE; (e) observation from another file → void; (f) unprobed row at --phase full → refused by name\n" +
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
  const result = runUsable({
    phase,
    manifestPath: path.join(REPO, MANIFEST_PATH),
    usableDir: path.join(REPO, USABLE_DIR),
    receiptPath: path.join(REPO, USABLE_RECEIPT_PATH),
    writeReceipt: argv.includes("--write-receipt"),
  });
  const measured = result.rows.filter((r) => r.observation !== null);
  const clean = measured.filter(
    (r) =>
      [r.reflow, r.variants, r.binding, r.fakeLayout].every(
        (a) => a.verdict !== "fail",
      ) && r.failures.length === 0,
  );
  console.log(
    `canvas usable (${phase}): ${measured.length}/${result.rows.length} census rows probed; ${clean.length}/${measured.length} usable on all four assertions; receipt ${USABLE_RECEIPT_PATH}`,
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
