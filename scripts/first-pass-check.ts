/**
 * FIRST-PASS GATE — `npm run first-pass:check`
 *
 *   npm run first-pass:check                     # the gate (a PURE READER)
 *   npm run first-pass:check -- --write-receipt  # record the rendering + raise the ratchet
 *   npm run first-pass:check -- --self-test      # the gate must go red on planted reds
 *
 * WHAT IT REFUSES, by name:
 *   1. AN ORPHAN EXAM — a packet directory the registry
 *      (extract/figma/census/first-pass.ts EXAMS) does not name, or a queue
 *      exam that has packets. An exam cannot appear from nowhere.
 *   2. A RUNNER WITH NO PACKETS — a registered exam nobody has run. Either run
 *      it or move it to EXAM_QUEUE, where "never measured" is on the record.
 *   3. A DROPPED SET — a set MANIFEST.json names with no attempt.json — and a
 *      SMUGGLED SET — a packet directory MANIFEST.json does not name. The
 *      denominator of an exam is its MANIFEST and nothing else.
 *   4. A LYING PACKET — a committed artifact an attempt names that is gone, or
 *      whose sha256 no longer matches what the attempt recorded.
 *   5. A BLANK CELL — a packet with no images and no NAMED absence. "There is
 *      no picture" must always come with a reason.
 *   6. AN UNEXPLAINED VERDICT — `recognisable: false` naming no wall.
 *   7. THE RATCHET — the first-pass rate of an exam may not FALL without a
 *      reasons row naming the exact from/to, and may not RISE without the
 *      recorded best being raised. A metric that can quietly move is not one.
 *   8. A STALE RECEIPT — parity/receipts/v1/FIRST-PASS.md must be byte-equal
 *      to the rendering recomputed from the committed packets.
 *
 * FALSIFICATION (`--self-test`, run in CI right after the gate): the whole
 * surface is copied to a temp tree, the gate is proven GREEN on the copy, then
 * five reds are planted one at a time — a deleted packet, a smuggled packet, a
 * corrupted image, a ratchet raised above the truth, an edited receipt. Every
 * one must go red naming the thing. A gate that cannot be shown going red is
 * not a gate.
 */
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EXAMS,
  EXAM_QUEUE,
  FIRST_PASS_DIR,
  FIRST_PASS_RATCHET,
  FIRST_PASS_RECEIPT,
  applyRatchet,
  committedExams,
  loadRatchet,
  ratchetFailures,
  ratchetPath,
  readExamState,
  receiptPath,
  renderReceipt,
  setPaths,
  stableJson,
  tally,
  type ExamState,
} from "../extract/figma/census/first-pass.js";
import { REPO } from "../extract/figma/census/corpus.js";

interface CheckResult {
  ok: boolean;
  failures: string[];
  receipt: string;
}

function runCheck(opts: { writeReceipt?: boolean }): CheckResult {
  const failures: string[] = [];
  const onDisk = committedExams();
  const withRunner = new Set(EXAMS.map((e) => e.exam));
  const queued = new Set(EXAM_QUEUE.map((e) => e.exam));

  for (const name of onDisk) {
    if (queued.has(name))
      failures.push(
        `ORPHAN: "${name}" is in EXAM_QUEUE (never attempted) but has packets — move it into EXAMS with its runner`,
      );
    else if (!withRunner.has(name))
      failures.push(
        `ORPHAN: packet directory ${FIRST_PASS_DIR}/${name} is in no registry — add it to EXAMS in extract/figma/census/first-pass.ts or delete it`,
      );
  }
  for (const e of EXAMS)
    if (!onDisk.includes(e.exam))
      failures.push(
        `NOT RUN: exam "${e.exam}" has a runner but no packets — run \`npm run exam:first-pass -- --exam ${e.exam}\`, or move it to EXAM_QUEUE where "never measured" is on the record`,
      );

  const states: ExamState[] = [];
  for (const e of EXAMS) {
    if (!onDisk.includes(e.exam)) continue;
    const s = readExamState(e.exam);
    states.push(s);
    failures.push(...s.failures);
  }

  let ratchet = loadRatchet();
  const tallies = states.map(tally);
  if (opts.writeReceipt) {
    for (const t of tallies) ratchet = applyRatchet(t, ratchet);
    writeFileSync(ratchetPath(), stableJson(ratchet));
  } else {
    for (const t of tallies) failures.push(...ratchetFailures(t, ratchet));
  }

  const receipt = renderReceipt(states, ratchet, failures);
  if (opts.writeReceipt) {
    mkdirSync(path.dirname(receiptPath()), { recursive: true });
    writeFileSync(receiptPath(), receipt);
  } else if (failures.length === 0) {
    // A red run's rendering embeds its own failures and could never match a
    // committed green receipt, so the named refusals come first.
    const committed = existsSync(receiptPath())
      ? readFileSync(receiptPath(), "utf8")
      : null;
    if (committed !== receipt)
      failures.push(
        `${FIRST_PASS_RECEIPT} is ${committed === null ? "MISSING" : "STALE"} vs the rendering recomputed from the committed packets — run \`npm run first-pass:check -- --write-receipt\` and commit the diff`,
      );
  }
  return { ok: failures.length === 0, failures, receipt };
}

// ---------------------------------------------------------------------------
// Falsification
// ---------------------------------------------------------------------------

function stage(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "first-pass-selftest-"));
  cpSync(path.join(REPO, FIRST_PASS_DIR), path.join(dir, "first-pass"), {
    recursive: true,
  });
  cpSync(path.join(REPO, FIRST_PASS_RECEIPT), path.join(dir, "FIRST-PASS.md"));
  cpSync(path.join(REPO, FIRST_PASS_RATCHET), path.join(dir, "ratchet.json"));
  setPaths({
    dir: path.join(dir, "first-pass"),
    receipt: path.join(dir, "FIRST-PASS.md"),
    ratchet: path.join(dir, "ratchet.json"),
  });
  return dir;
}

function firstPacket(dir: string): {
  exam: string;
  set: string;
  setDir: string;
} {
  const root = path.join(dir, "first-pass");
  const exam = readdirSync(root).sort()[0];
  const examDir = path.join(root, exam);
  const manifest = JSON.parse(
    readFileSync(path.join(examDir, "MANIFEST.json"), "utf8"),
  ) as {
    sets: string[];
  };
  const set = manifest.sets[0];
  const setDir = readdirSync(examDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(examDir, e.name))
    .sort()[0];
  return { exam, set, setDir };
}

function selfTest(): boolean {
  const scenarios: Array<{
    name: string;
    plant: (dir: string) => void;
    expect: RegExp;
  }> = [
    {
      name: "a DELETED packet — the set MANIFEST still names",
      plant: (dir) =>
        rmSync(firstPacket(dir).setDir, { recursive: true, force: true }),
      expect: /quietly DROPPED/,
    },
    {
      name: "a SMUGGLED packet — a directory MANIFEST does not name",
      plant: (dir) => {
        const { setDir } = firstPacket(dir);
        mkdirSync(path.join(path.dirname(setDir), "not-a-set"), {
          recursive: true,
        });
      },
      expect: /quietly ADDED/,
    },
    {
      name: "a CORRUPTED image — bytes that no longer hash to the attempt",
      plant: (dir) => {
        const { setDir } = firstPacket(dir);
        const png = readdirSync(setDir).find((f) => f.endsWith(".png"));
        if (!png) throw new Error("self-test needs at least one committed PNG");
        writeFileSync(
          path.join(setDir, png),
          Buffer.concat([
            readFileSync(path.join(setDir, png)),
            Buffer.from([0]),
          ]),
        );
      },
      expect: /the packet and its bytes disagree/,
    },
    {
      name: "a RATCHET raised above the truth — the rate reads as FALLEN",
      plant: (dir) => {
        const p = path.join(dir, "ratchet.json");
        const r = JSON.parse(readFileSync(p, "utf8")) as {
          exams: Record<
            string,
            { chain: { numerator: number; denominator: number } }
          >;
        };
        const first = Object.keys(r.exams).sort()[0];
        r.exams[first].chain = {
          numerator: r.exams[first].chain.denominator + 1,
          denominator: r.exams[first].chain.denominator,
        };
        writeFileSync(p, stableJson(r));
      },
      expect: /FELL from .* with no named reason/,
    },
    {
      name: "an EDITED receipt — prose that no rendering produces",
      plant: (dir) => {
        const p = path.join(dir, "FIRST-PASS.md");
        writeFileSync(
          p,
          readFileSync(p, "utf8") + "\nA line no rendering produces.\n",
        );
      },
      expect: /is STALE vs the rendering/,
    },
  ];

  let ok = true;
  const base = stage();
  const green = runCheck({});
  if (!green.ok) {
    console.error(
      "✖ self-test: the STAGED COPY is not green before any red is planted:",
    );
    for (const f of green.failures) console.error(`    ${f}`);
    ok = false;
  } else {
    console.log("  ✔ staged copy green before planting");
  }
  rmSync(base, { recursive: true, force: true });

  for (const s of scenarios) {
    const dir = stage();
    s.plant(dir);
    const r = runCheck({});
    const named = r.failures.some((f) => s.expect.test(f));
    if (r.ok || !named) {
      console.error(
        `✖ self-test: ${s.name} — the gate did NOT refuse by name (${r.failures.length} failure(s))`,
      );
      for (const f of r.failures.slice(0, 3)) console.error(`    ${f}`);
      ok = false;
    } else {
      console.log(`  ✔ ${s.name}`);
    }
    rmSync(dir, { recursive: true, force: true });
  }
  setPaths({
    dir: FIRST_PASS_DIR,
    receipt: FIRST_PASS_RECEIPT,
    ratchet: FIRST_PASS_RATCHET,
  });
  return ok;
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) {
  console.log("FIRST-PASS GATE — falsification");
  process.exit(selfTest() ? 0 : 1);
}
const write = argv.includes("--write-receipt");
const result = runCheck({ writeReceipt: write });
if (write) {
  console.log(`✔ wrote ${FIRST_PASS_RECEIPT} and ${FIRST_PASS_RATCHET}`);
  if (result.failures.length > 0) {
    console.error(
      `  the rendering is RED — ${result.failures.length} failure(s) are recorded IN it:`,
    );
    for (const f of result.failures) console.error(`    ${f}`);
  }
  process.exit(0);
}
if (!result.ok) {
  console.error(`✖ first-pass:check — ${result.failures.length} failure(s):`);
  for (const f of result.failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  "✔ first-pass:check — every exam's packets, ratchet and receipt agree",
);
