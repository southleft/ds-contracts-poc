/**
 * FIRST-PASS EXAM RUNNER — `npm run exam:first-pass`
 *
 *   npm run exam:first-pass -- --list
 *   npm run exam:first-pass -- --exam selftest-tailwind
 *   npm run exam:first-pass -- --exam selftest-tailwind --mint
 *   npm run exam:first-pass -- --exam selftest-flowbite-live
 *
 * WHAT IT MEASURES. Not whether the engine CAN produce a good result — the
 * census, the scorecards and the parity gates already measure that, and every
 * one of those numbers was reached with a heal loop. This measures whether the
 * DOCUMENTED chain produces one on the FIRST TRY, untouched: no human, no
 * agent, no retry, no repair, no substituted input.
 *
 * WHAT IT DOES NOT DO. It does not grade. It writes a graded-pair packet per
 * set — the images, the stage record with every refusal in the engine's own
 * words, the artifact hashes — and a MANIFEST naming every set it selected.
 * Grading is a separate blind pass that writes `verdict.json` beside them.
 *
 * IT REFUSES BEFORE IT DESTROYS (2026-08-25). The committed packet is
 * EVIDENCE, and it may only be cleared once the run is certain it can produce
 * a replacement. `preflight()` checks every precondition — the git-ignored
 * library sandbox with its pinned deps, the config and manifest, the Figma
 * token for direction B, the declared corpus files, a writable work dir and
 * packet dir — and REFUSES BY NAME with the exact command that fixes it,
 * having touched nothing. Then each set's images are cleared only at the
 * instant its replacement is written, and a set that never gets there keeps
 * what it has. THE DEFECT THAT PAID FOR THIS: in a fresh worktree the sandbox
 * does not exist, so all 8 sets died at `capture` — after the harness had
 * already wiped 8/8 ref/code pairs and rewritten every attempt.json. And it
 * exited 0.
 *
 * EXIT CODES. 0 = the run measured something (a completed chain, or an honest
 * REFUSAL, which is the finding the exam exists to collect). 1 = it measured
 * NOTHING — every set died at ERROR, a stage that died without a named
 * refusal — and then `<complete>/<n>` is not a rate, the receipt records none,
 * and the shell is told. 2 = preflight refused; the run never started.
 *
 * WHERE IT WRITES. Packets under parity/receipts/v1/first-pass/<exam>/. The
 * chain itself runs in a scratch work directory (`--work`, default a mkdtemp);
 * direction A additionally runs inside a SHADOW ROOT of symlinks so promote
 * and emit cannot move a committed byte.
 *
 * MINT IS MCP-DRIVEN (docs/31 §6). `--mint` does NOT make this process write to
 * a canvas — it cannot. The figma-console bridge speaks MCP over stdio to its
 * own client and WebSocket to plugin clients, and a Node process is neither.
 * `--mint` says the exam WANTS the write: the harness re-emits every script
 * with `--file-key byMp6lt0Ij9b2QbkDGFwBh`, refuses to call a script mintable
 * unless the engine's WRONG-FILE guard on that key is in its bytes, and then
 * looks for the evidence an MCP-holding agent leaves at
 * `parity/receipts/v1/first-pass/<exam>/mint-evidence.json`. No evidence, and
 * the stage is PENDING with the architecture named — recorded, never quietly
 * dropped, and never counted as minted. The no-retry rule binds the agent too:
 * one attempt, and its evidence records that attempt.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EXAMS,
  EXAM_QUEUE,
  FIRST_PASS_DIR,
  headline,
  isMeasured,
  preflight,
  renderPreflight,
  type SetAttempt,
} from "../extract/figma/census/first-pass.js";
import {
  runCanvasToCode,
  runCodeToCanvas,
} from "../extract/figma/census/first-pass-run.js";

const argv = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};

function list(): void {
  console.log("Exams with a runner:");
  for (const e of EXAMS)
    console.log(
      `  ${e.exam.padEnd(26)} ${e.direction.padEnd(15)} ${e.heldOut ? "HELD OUT" : "self-test"}`,
    );
  console.log("\nRegistered, never attempted (the wave-3 queue):");
  for (const q of EXAM_QUEUE)
    console.log(`  ${q.exam.padEnd(26)} ${q.direction}`);
}

async function main(): Promise<void> {
  if (argv.includes("--list") || argv.length === 0) {
    list();
    if (argv.length === 0) process.exitCode = 2;
    return;
  }
  const name = flag("--exam");
  const def = EXAMS.find((e) => e.exam === name);
  if (!def) {
    console.error(`✖ unknown exam ${JSON.stringify(name)}`);
    list();
    process.exitCode = 2;
    return;
  }
  const work =
    flag("--work") ??
    mkdtempSync(path.join(tmpdir(), `first-pass-${def.exam}-`));
  const mint = argv.includes("--mint");

  // PREFLIGHT BEFORE A SINGLE COMMITTED BYTE MOVES (2026-08-25). The packet
  // under parity/receipts/v1/first-pass/<exam>/ is EVIDENCE of the last run
  // that could measure. Everything the chain needs is checked here first, and
  // an exam that cannot run refuses by name with the remedy, having touched
  // nothing. Exit 2 = it never started.
  const pf = preflight(def, { work, mint });
  if (pf.length > 0) {
    console.error(renderPreflight(def, pf));
    console.error("");
    console.error(
      `  Nothing was cleared, nothing was written. \`git status ${FIRST_PASS_DIR}/${def.exam}\` is clean.`,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`▶ ${def.exam} (${def.direction}) — work dir ${work}`);
  console.log(`  no retry, no repair: every stage runs exactly once.`);
  console.log(`  preflight: every precondition present.`);

  const t0 = Date.now();
  const { manifest, attempts } =
    def.direction === "code-to-canvas"
      ? await runCodeToCanvas(def, { mint, work })
      : await runCanvasToCode(def, { work });
  const ms = Date.now() - t0;

  const complete = attempts.filter((a: SetAttempt) => a.chainComplete).length;
  const measured = attempts.filter((a: SetAttempt) => isMeasured(a)).length;
  const retained = attempts.filter(
    (a: SetAttempt) => (a.images.retained ?? []).length > 0,
  );
  console.log("");
  for (const a of attempts) {
    const stop = a.firstStop;
    const head = stop ? `${stop.status} at ${stop.stage}` : "chain complete";
    console.log(
      `  ${a.chainComplete ? "✔" : "✖"} ${a.set.padEnd(30)} ${head.padEnd(24)} ${(a.totalMs / 1000).toFixed(1)}s  ref ${a.images.ref.length} · code ${a.images.code.length} · canvas ${a.images.canvas.length}`,
    );
    if (stop) console.log(`      ${headline(stop.message).slice(0, 200)}`);
  }
  console.log("");
  if (retained.length > 0)
    console.log(
      `  ${retained.length} set(s) produced no image and therefore CLEARED NOTHING — their committed images are from an earlier run and are recorded as retained: ${retained.map((a) => a.set).join(", ")}`,
    );

  // EXIT CODES TELL THE TRUTH (2026-08-25).
  //   0  the run measured something — including an honest REFUSAL, which is
  //      the finding this exam exists to collect.
  //   1  the run measured NOTHING: no set selected, or every set died at
  //      ERROR — a stage that died without a named refusal. "measured
  //      nothing" must never look like "measured zero"; the exit code and
  //      the gate both say so, and the ratchet records no rate.
  //   2  preflight refused; the run never started.
  if (attempts.length === 0) {
    console.error(
      `  ✖ MEASURED NOTHING: ${def.exam} selected no set at all — there is no denominator, so there is no rate. Nothing was recorded.`,
    );
    process.exitCode = 1;
    return;
  }
  if (measured === 0) {
    console.error(
      `  ✖ MEASURED NOTHING: all ${attempts.length} set(s) stopped at ERROR — a stage that died without a named refusal. This run learned nothing about the engine, so ${complete}/${attempts.length} is NOT a rate and is not recorded as one. Fix the infrastructure named above and re-run; the previous packets, where this run produced no replacement, are untouched.`,
    );
    console.error(
      `  packets → ${FIRST_PASS_DIR}/${def.exam}/ · restore with \`git checkout -- ${FIRST_PASS_DIR}/${def.exam}\``,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `  FIRST PASS: ${complete}/${attempts.length} chains complete on attempt #1 · measured ${measured}/${attempts.length} · mint ${manifest.mint.status} · ${(ms / 1000).toFixed(1)}s`,
  );
  console.log(`  packets → ${FIRST_PASS_DIR}/${def.exam}/`);
  console.log(`  next: npm run first-pass:check -- --write-receipt`);
}

await main();
