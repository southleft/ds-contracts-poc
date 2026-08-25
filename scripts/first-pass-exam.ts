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
 * WHERE IT WRITES. Packets under parity/receipts/v1/first-pass/<exam>/. The
 * chain itself runs in a scratch work directory (`--work`, default a mkdtemp);
 * direction A additionally runs inside a SHADOW ROOT of symlinks so promote
 * and emit cannot move a committed byte.
 *
 * MINT. `--mint` asks the harness to drive the figma-console bridge against
 * the scratch file byMp6lt0Ij9b2QbkDGFwBh and NOTHING else. Every emitted
 * script carries the engine's WRONG-FILE guard on that key, and the harness
 * refuses to call a script mintable unless the guard is in its bytes. When no
 * bridge command endpoint answers, the exam stops at "bundle produced, mint
 * pending" and says so in the packet and in the receipt — a pending mint is
 * recorded, never quietly dropped and never counted as minted.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  EXAMS,
  EXAM_QUEUE,
  headline,
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
  console.log(`▶ ${def.exam} (${def.direction}) — work dir ${work}`);
  console.log(`  no retry, no repair: every stage runs exactly once.`);

  const t0 = Date.now();
  const { manifest, attempts } =
    def.direction === "code-to-canvas"
      ? await runCodeToCanvas(def, { mint, work })
      : await runCanvasToCode(def, { work });
  const ms = Date.now() - t0;

  const complete = attempts.filter((a: SetAttempt) => a.chainComplete).length;
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
  console.log(
    `  FIRST PASS: ${complete}/${attempts.length} chains complete on attempt #1 · mint ${manifest.mint.status} · ${(ms / 1000).toFixed(1)}s`,
  );
  console.log(`  packets → parity/receipts/v1/first-pass/${def.exam}/`);
  console.log(`  next: npm run first-pass:check -- --write-receipt`);
}

await main();
