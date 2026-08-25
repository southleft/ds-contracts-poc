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
 *      no picture" must always come with a reason. Per SURFACE since
 *      2026-08-25: a packet with no `ref-*` and no ref absence and no
 *      retained ref is red on its own, because one `canvas` absence used to
 *      satisfy the whole-packet form of this rule while ref and code had been
 *      silently wiped.
 *   5b. AN ORPHAN IMAGE — a PNG in a packet the attempt names neither as its
 *      own output nor as retained evidence.
 *   5c. AN UNMEASURED EXAM — every set stopped at ERROR, a stage that died
 *      without a named refusal. Such a run learned nothing about the engine,
 *      so `0/N` is not a rate: the ratchet records nothing for it and the
 *      gate refuses it. "Measured nothing" must never read as "measured
 *      zero" — the same class as a killed suite reading as a pass.
 *   6. AN UNEXPLAINED VERDICT — `recognisable: false` naming no wall.
 *   7. THE RATCHET — the first-pass rate of an exam may not FALL without a
 *      reasons row naming the exact from/to, and may not RISE without the
 *      recorded best being raised. A metric that can quietly move is not one.
 *   8. A STALE RECEIPT — parity/receipts/v1/FIRST-PASS.md must be byte-equal
 *      to the rendering recomputed from the committed packets.
 *
 * FALSIFICATION (`--self-test`, run in CI right after the gate): the whole
 * surface is copied to a temp tree, the gate is proven GREEN on the copy, then
 * eight reds are planted one at a time — a deleted packet, a smuggled packet,
 * a corrupted image, a ratchet raised above the truth, an edited receipt, a
 * packet CLEARED WITH NO REPLACEMENT AND NO REASON, an ORPHAN image, and an
 * ALL-INFRASTRUCTURE-FAILURE run trying to record a rate. Every one must go
 * red naming the thing. A gate that cannot be shown going red is not a gate.
 *
 * The runner's PREFLIGHT is falsified in the same pass (`preflightRedCases`):
 * an exam whose git-ignored sandbox is absent must refuse by name and hand
 * back the exact command that creates it, and the same exam with its sandbox
 * present must not refuse. Preflight is what stands between a run that cannot
 * run and the committed evidence, so it is proven going red too.
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
  preflight,
  ratchetFailures,
  ratchetPath,
  readExamState,
  receiptPath,
  renderReceipt,
  setPaths,
  stableJson,
  tally,
  type ExamState,
  type SetAttempt,
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

const readAttempt = (setDir: string): SetAttempt =>
  JSON.parse(
    readFileSync(path.join(setDir, "attempt.json"), "utf8"),
  ) as SetAttempt;

const writeAttempt = (setDir: string, a: SetAttempt): void =>
  writeFileSync(path.join(setDir, "attempt.json"), stableJson(a));

/** Drop the committed-artifact rows so a planted red is refused for the reason
 *  it plants, not for a hash the plant happened to invalidate. */
function stripCommittedArtifacts(a: SetAttempt): void {
  for (const st of a.stages)
    st.artifacts = st.artifacts.filter((art) => !art.committed);
}

/**
 * PREFLIGHT MUST BE SHOWN GOING RED. It is the only thing standing between a
 * run that cannot run and the committed evidence, so "the sandbox is missing"
 * is proven to refuse BY NAME and to hand back the command that fixes it —
 * and the same exam with everything present is proven NOT to refuse, so the
 * guard cannot be a blanket "no".
 */
function preflightRedCases(): boolean {
  let ok = true;
  const codeExam = EXAMS.find((e) => e.direction === "code-to-canvas");
  const canvasExam = EXAMS.find((e) => e.direction === "canvas-to-code");
  const work = mkdtempSync(path.join(tmpdir(), "first-pass-preflight-"));

  const check = (
    name: string,
    failures: ReturnType<typeof preflight>,
    expect: RegExp | null,
    expectRemedy?: RegExp,
  ): void => {
    if (expect === null) {
      if (failures.length > 0) {
        console.error(
          `✖ self-test: ${name} — preflight refused when it should not:`,
        );
        for (const f of failures)
          console.error(`    ${f.requirement}: ${f.detail}`);
        ok = false;
      } else console.log(`  ✔ ${name}`);
      return;
    }
    const hit = failures.find((f) => expect.test(f.requirement));
    if (!hit) {
      console.error(
        `✖ self-test: ${name} — preflight did NOT refuse by name (${failures.length} failure(s))`,
      );
      for (const f of failures) console.error(`    ${f.requirement}`);
      ok = false;
      return;
    }
    if (expectRemedy && !expectRemedy.test(hit.remedy)) {
      console.error(
        `✖ self-test: ${name} — preflight refused but named no usable remedy: ${JSON.stringify(hit.remedy)}`,
      );
      ok = false;
      return;
    }
    console.log(`  ✔ ${name}`);
  };

  if (!codeExam || codeExam.direction !== "code-to-canvas") {
    console.error("✖ self-test: no code-to-canvas exam to preflight");
    return false;
  }
  // 1. THE REPRODUCTION: the git-ignored sandbox is absent.
  check(
    "PREFLIGHT: a MISSING library sandbox refuses by name and names the recipe",
    preflight(
      { ...codeExam, harness: path.join(work, "no-such-sandbox") },
      {
        work,
        mint: false,
      },
    ),
    /sandbox/,
    /npm i .+@.+ react@18 react-dom@18 esbuild/,
  );
  // 2. A sandbox that exists but has no library installed.
  mkdirSync(path.join(work, "empty-sandbox", "node_modules"), {
    recursive: true,
  });
  check(
    "PREFLIGHT: a sandbox with the library NOT installed refuses by name",
    preflight(
      { ...codeExam, harness: path.join(work, "empty-sandbox") },
      {
        work,
        mint: false,
      },
    ),
    /has .+ installed/,
    /npm i /,
  );
  // 3. A capture config that is not on disk.
  check(
    "PREFLIGHT: an absent capture config refuses by name",
    preflight(
      { ...codeExam, captureConfig: "extract/computed/configs/no-such.json" },
      {
        work,
        mint: false,
      },
    ),
    /capture config .* exists/,
    undefined,
  );
  // 4. Direction B with no token in the environment.
  if (canvasExam && canvasExam.direction === "canvas-to-code")
    check(
      "PREFLIGHT: canvas→code with NO Figma token refuses by name",
      preflight(canvasExam, { work, mint: false, env: {} }),
      /Figma personal access token/,
      /FIGMA_TOKEN/,
    );
  // 5. THE GUARD IS NOT A BLANKET NO: the same exam with everything present
  //    (a fabricated sandbox carrying the pinned versions) must NOT refuse.
  {
    const cfg = JSON.parse(
      readFileSync(path.join(REPO, codeExam.captureConfig), "utf8"),
    ) as { library: { package: string; version: string } };
    const sandbox = path.join(work, "good-sandbox");
    const libDir = path.join(
      sandbox,
      "node_modules",
      ...cfg.library.package.split("/"),
    );
    mkdirSync(libDir, { recursive: true });
    writeFileSync(
      path.join(libDir, "package.json"),
      JSON.stringify({
        name: cfg.library.package,
        version: cfg.library.version,
      }),
    );
    for (const dep of ["react", "react-dom", "esbuild"])
      mkdirSync(path.join(sandbox, "node_modules", dep), { recursive: true });
    check(
      "PREFLIGHT: a COMPLETE sandbox does not refuse (the guard is not a blanket no)",
      preflight({ ...codeExam, harness: sandbox }, { work, mint: false }),
      null,
    );
    // 6. …and version drift, which would silently change every number, does.
    writeFileSync(
      path.join(libDir, "package.json"),
      JSON.stringify({ name: cfg.library.package, version: "0.0.0-drift" }),
    );
    check(
      "PREFLIGHT: library VERSION DRIFT in the sandbox refuses by name",
      preflight({ ...codeExam, harness: sandbox }, { work, mint: false }),
      /the config's pin/,
      /npm i /,
    );
  }
  rmSync(work, { recursive: true, force: true });
  return ok;
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
    // ---- the 2026-08-25 class: destroyed evidence, and a rate from a run
    // that measured nothing --------------------------------------------------
    {
      name: "a packet CLEARED WITH NO REPLACEMENT — the images are gone and no absence names why",
      plant: (dir) => {
        const { setDir } = firstPacket(dir);
        const a = readAttempt(setDir);
        // Exactly what the defect did: every image removed, and the attempt
        // rewritten as if the packet had never had one. Not one absence names
        // a ref or a code surface.
        for (const f of readdirSync(setDir))
          if (/^(ref|code|canvas)-.*\.png$/.test(f))
            rmSync(path.join(setDir, f));
        a.images = {
          ref: [],
          code: [],
          canvas: [],
          absent: [
            { kind: "canvas", reason: "mint SKIPPED — no bridge in this run" },
          ],
        };
        stripCommittedArtifacts(a);
        writeAttempt(setDir, a);
      },
      expect: /vanished with no recorded reason/,
    },
    {
      name: "an ORPHAN image — a PNG the attempt names neither as output nor as retained",
      plant: (dir) => {
        const { setDir } = firstPacket(dir);
        writeFileSync(
          path.join(setDir, "ref-nobody-named-me.png"),
          "not a png",
        );
      },
      expect: /an orphan image is never allowed/,
    },
    {
      name: "an ALL-INFRASTRUCTURE-FAILURE run trying to record a rate — every set ERROR, zero measured",
      plant: (dir) => {
        // The reproduction, frozen into a packet: the sandbox was absent, so
        // every set died at `capture` without the engine ever speaking. The
        // gate must refuse to read 0/N off it as a rate.
        const root = path.join(dir, "first-pass");
        const exam = readdirSync(root).sort()[0];
        const examDir = path.join(root, exam);
        for (const e of readdirSync(examDir, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          const setDir = path.join(examDir, e.name);
          const a = readAttempt(setDir);
          a.chainComplete = false;
          a.firstStop = {
            stage: "capture",
            status: "ERROR",
            message:
              "need --harness <dir> with altitude-web-components@1.0.2, react@18, react-dom@18, esbuild installed",
          };
          a.stages = [
            {
              stage: "capture",
              status: "ERROR",
              ms: 1,
              driver: "harness",
              command: "npx tsx extract/computed/run.ts --harness …",
              message: a.firstStop.message,
              artifacts: [],
            },
          ];
          writeAttempt(setDir, a);
        }
      },
      expect: /UNMEASURED: exam ".*" attempted \d+ set\(s\) and MEASURED NONE/,
    },
  ];

  let ok = preflightRedCases();
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
