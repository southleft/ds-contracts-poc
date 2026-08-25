/**
 * FIRST-PASS EXAM — the metric this project has never measured.
 *
 *   npm run exam:first-pass -- --exam <name> [--mint] [--write]
 *   npm run first-pass:check [-- --write-receipt | --self-test]
 *
 * THE OWNER'S CRITICISM (2026-08-24): *"I don't think I've seen one successful
 * pass on the first try."* Every green number this repo has ever recorded was
 * won by a heal loop — capture, look, fix the config, re-run; propose, look,
 * add an authored fact, re-propose. END-STATE quality is what the census, the
 * scorecards and the parity gates measure, and it is a different claim from
 * FIRST-PASS quality. This module measures the second one.
 *
 * THE RULE THAT MAKES IT A MEASUREMENT: **no retry, no repair.** The harness
 * runs the DOCUMENTED chain end to end with zero human and zero agent
 * intervention. A stage that fails is recorded and the chain stops for that
 * set. Nothing is fixed and nothing is re-run. A REFUSAL is an honest outcome
 * — the engine declining by name is the behaviour this repo wants — and it is
 * recorded as REFUSED, never as a failure of the run.
 *
 * TWO DIRECTIONS.
 *   · code-to-canvas: capture → promote → validate → generate → bundle → mint.
 *     Input: a library the engine has never captured (a capture config + the
 *     sandbox recipe from its PROVENANCE). The chain runs inside a SHADOW ROOT
 *     — a directory of symlinks to the repo with only the paths the pipeline
 *     writes materialised as real copies — so an exam can never move a
 *     committed byte.
 *   · canvas-to-code: dump → propose → validate → generate (React + WC) →
 *     render → ref. Input: a Figma file key and a page selection the engine
 *     has never proposed from. READ-ONLY REST throughout; the harness asserts
 *     the file key it reads and refuses the forbidden keys by name.
 *
 * THIS MODULE DOES NOT GRADE. It emits, per set, a graded-pair packet:
 *
 *   parity/receipts/v1/first-pass/<exam>/MANIFEST.json   every selected set
 *   parity/receipts/v1/first-pass/<exam>/<set>/attempt.json
 *   parity/receipts/v1/first-pass/<exam>/<set>/{ref,code,canvas}-<slug>.png
 *   parity/receipts/v1/first-pass/<exam>/<set>/verdict.json   (a grader writes this)
 *
 * WHAT THE THREE IMAGES ARE, in both directions:
 *   ref-*    the SOURCE truth, rendered by whoever owns it. code→canvas: the
 *            real npm package in the sandbox (`--keep-originals`). canvas→code:
 *            Figma's own renderer, GET /v1/images/:key?scale=2.
 *   code-*   the engine's CODE surface for that cell. code→canvas: the promoted
 *            contract through core/emit-html (the capture gate's own render).
 *            canvas→code: the GENERATED React, esbuild-bundled and screenshot.
 *   canvas-* the engine's CANVAS surface. code→canvas: the minted Figma set.
 *            canvas→code: absent by construction — the canvas is the SOURCE
 *            there, so `ref-*` already is it. Every absent image is named with
 *            its reason in attempt.json; a blank cell is never allowed.
 *
 * GRADING IS A SEPARATE BLIND PASS. `verdict.json` is written by graders
 * elsewhere against the owner's bar ("I can tell what this is") and carries
 * `{ recognisable: true|false|"unscored", walls: [], notes, reviewedAt }`.
 * `first-pass:check` counts them; it never writes one.
 *
 * BYTE-STABILITY. The receipt quotes a date and an engine SHA. Both are
 * RECORDED INTO MANIFEST.json at exam time and rendered FROM IT — the renderer
 * never reads the clock or `git rev-parse`. Re-rendering a committed exam is
 * therefore byte-identical forever, which is what makes the gate a
 * string-comparison rather than a number-diff.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { REPO } from "./corpus.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FIRST_PASS_DIR = "parity/receipts/v1/first-pass";
export const FIRST_PASS_RECEIPT = "parity/receipts/v1/FIRST-PASS.md";
export const FIRST_PASS_RATCHET = "parity/receipts/v1/first-pass-ratchet.json";

/** The ONLY Figma file any exam may write to. */
export const SCRATCH_FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";

/** Keys an exam may never touch AT ALL — not read, not written. The bridge
 *  keeps several files connected at once and has been observed routing to the
 *  wrong one; naming the forbidden keys here makes "we did not touch it" a
 *  checked fact rather than an intention. */
export const FORBIDDEN_FILE_KEYS = ["Y8Jhw6R49wTLuXZ0is2GmV"];

/** Images per set. A first-pass exam is a look, not a census — the cap keeps
 *  a graded packet reviewable in one screen. Named in the receipt. */
export const CELL_CAP = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExamDirection = "code-to-canvas" | "canvas-to-code";

/**
 * ok       the stage did its job
 * REFUSED  the engine declined BY NAME — an honest outcome, not a crash
 * ERROR    the stage died without a named refusal
 * PENDING  a precondition OUTSIDE the engine was absent (e.g. no canvas bridge)
 * SKIPPED  an earlier stage in this set's chain did not produce its input
 */
export type StageStatus = "ok" | "REFUSED" | "ERROR" | "PENDING" | "SKIPPED";

export interface Artifact {
  path: string;
  sha256: string;
  bytes: number;
  /** true = the file lives in the committed packet and the gate re-hashes it.
   *  false = an ephemeral work-dir byte whose hash is a recorded fact only. */
  committed: boolean;
}

export interface StageRecord {
  stage: string;
  status: StageStatus;
  ms: number;
  /** The documented command, verbatim — or null for an in-process stage. */
  command: string | null;
  /** For REFUSED/ERROR: the engine's exact message. Never paraphrased. */
  message: string;
  artifacts: Artifact[];
}

export interface AbsentImage {
  kind: "ref" | "code" | "canvas";
  reason: string;
}

export interface SetAttempt {
  exam: string;
  direction: ExamDirection;
  /** The set as the SOURCE names it (component name / Figma set name). */
  set: string;
  /** The contract id, once one exists; null when the chain never got there. */
  id: string | null;
  source: Record<string, string | number | null>;
  stages: StageRecord[];
  /** Every stage ok, through the last stage of the direction. */
  chainComplete: boolean;
  /** The first stage that was not ok, by name — the honest headline. */
  firstStop: { stage: string; status: StageStatus; message: string } | null;
  images: {
    ref: string[];
    code: string[];
    canvas: string[];
    absent: AbsentImage[];
  };
  totalMs: number;
}

export interface ExamManifest {
  exam: string;
  direction: ExamDirection;
  describe: string;
  /** false for a self-test fixture pointed at an already-known library. */
  heldOut: boolean;
  /** Recorded ONCE, at exam time. The receipt renders this, never the clock. */
  date: string;
  /** Recorded ONCE, at exam time. `git rev-parse HEAD`. */
  engineSha: string;
  input: Record<string, string | string[] | null>;
  /** EVERY set the exam selected, in discovery order. The gate refuses when a
   *  packet directory exists that this list does not name, and when a named
   *  set has no packet — no set can be quietly dropped or quietly added. */
  sets: string[];
  mint: {
    requested: boolean;
    fileKey: string;
    status: StageStatus;
    message: string;
  };
  noRetry: true;
  cellCap: number;
}

export interface Verdict {
  recognisable: true | false | "unscored";
  walls?: string[];
  notes?: string;
  reviewedAt?: string;
}

// ---------------------------------------------------------------------------
// The exam registry — the denominator of exams
// ---------------------------------------------------------------------------

export interface CodeToCanvasExam {
  exam: string;
  direction: "code-to-canvas";
  describe: string;
  heldOut: boolean;
  library: string;
  /** examples/<lib>/ds-library.json — promote's whole input. */
  manifest: string;
  captureConfig: string;
  harness: string;
  /** Component names as the capture config spells them, in exam order. The
   *  token layers are NOT declared here: they are `dtcg` + `mintedOut` from
   *  the library manifest, exactly as `ds-contracts onboard --continue` builds
   *  them. An exam cannot quietly hand the pipeline a different token list. */
  sets: string[];
}

export interface CanvasToCodeExam {
  exam: string;
  direction: "canvas-to-code";
  describe: string;
  heldOut: boolean;
  kit: string;
  fileKey: string;
  /** Page node ids. Every COMPONENT_SET/COMPONENT under them is attempted —
   *  the exam selects PAGES, never individual sets, so it cannot cherry-pick
   *  the ones that pass. */
  pages: string[];
  mode: "exact" | "reviewable-inversion";
  /** The kit's own DTCG corpus. Empty = a foreign kit with no DTCG twin. */
  corpusFiles: string[];
}

export type ExamDef = CodeToCanvasExam | CanvasToCodeExam;

export const EXAMS: ExamDef[] = [
  {
    exam: "selftest-tailwind",
    direction: "code-to-canvas",
    describe:
      "SELF-TEST FIXTURE — flowbite-react@0.12.17 through the documented code→canvas chain (docs/21 §2). NOT held out: the engine has captured this library before, so its numbers measure the HARNESS, not the engine's reach. It exists so the machinery is exercised before an exam is pointed at a library nobody has captured.",
    heldOut: false,
    library: "tailwind",
    manifest: "examples/tailwind/ds-library.json",
    captureConfig: "extract/computed/configs/tailwind.json",
    harness: "examples/tailwind/.tw-sandbox",
    sets: [
      "Button",
      "Badge",
      "Card",
      "Alert",
      "ToggleSwitch",
      "HelperText",
      "Label",
      "Kbd",
    ],
  },
  {
    exam: "selftest-altitude",
    direction: "code-to-canvas",
    describe:
      "SELF-TEST FIXTURE — altitude-web-components@1.0.2 through the documented code→canvas chain (docs/21 §2). NOT held out. It exists beside selftest-tailwind for one reason: tailwind's chain stops at `promote`, so tailwind alone can never exercise generate → bundle → mint. A library with no authored-facts ledger is the cheapest way to put those stages under the metric too.",
    heldOut: false,
    library: "altitude",
    manifest: "examples/altitude/ds-library.json",
    captureConfig: "extract/computed/configs/altitude.json",
    harness: "examples/altitude/.altitude-sandbox",
    sets: [
      "Button",
      "Badge",
      "Chip",
      "Link",
      "Avatar",
      "Heading",
      "Divider",
      "IconClose",
    ],
  },
  {
    exam: "selftest-flowbite-live",
    direction: "canvas-to-code",
    describe:
      "SELF-TEST FIXTURE — the eight Flowbite pages of file 59mLQlOMiD5w5za6SUcoO5 through the documented canvas→code chain, LIVE over READ-ONLY REST rather than from the committed fixture the design→code census replays. NOT held out: these are pipeline-drawn, stamped sets the engine has proposed from before. It exists to exercise the live half — the network dump, the image export, the browser — that a fixture replay never touches.",
    heldOut: false,
    kit: "flowbite",
    fileKey: "59mLQlOMiD5w5za6SUcoO5",
    pages: [
      "120:1942",
      "120:1981",
      "120:1985",
      "120:1998",
      "120:2003",
      "120:2016",
      "120:2049",
      "120:2112",
    ],
    mode: "exact",
    corpusFiles: [
      "examples/tailwind/tokens/tailwind.dtcg.json",
      "examples/tailwind/tokens/tailwind-minted.dtcg.json",
    ],
  },
];

/** Registered but NOT yet attempted — the wave-3 queue. Kept in the registry
 *  so the receipt can show what the metric has NOT been pointed at yet; an
 *  exam nobody has run is an admission, not a gap in the record. */
export const EXAM_QUEUE: Array<{
  exam: string;
  direction: ExamDirection;
  describe: string;
}> = [
  {
    exam: "cbds-ui-kit",
    direction: "canvas-to-code",
    describe:
      "HELD OUT — CBDS UI Kit Demo (WofZT8xaxXuc2Q6Je9S4XE), a hand-built designer kit the engine has never proposed from. READ-ONLY.",
  },
  {
    exam: "collegetown",
    direction: "canvas-to-code",
    describe:
      "HELD OUT — CollegeTown Design System (ioFDU1TszfuEsopivSB6Ox), a shadcn-shaped designer kit the engine has never proposed from. READ-ONLY.",
  },
  {
    exam: "eventz",
    direction: "canvas-to-code",
    describe:
      "HELD OUT — DEMO Eventz Design System (E7oXr98i91HYQGZxA2USOQ) atoms/molecules, never proposed from in a first-pass exam. READ-ONLY.",
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const sha = (s: string | Buffer): string =>
  createHash("sha256").update(s).digest("hex");

export const stableJson = (x: unknown): string =>
  JSON.stringify(x, null, 2) + "\n";

export function artifactOf(abs: string, committed: boolean): Artifact {
  const buf = readFileSync(abs);
  return {
    path: path.relative(REPO, abs),
    sha256: sha(buf),
    bytes: buf.length,
    committed,
  };
}

/** A filename-safe slug, the census's own rule. */
export const slugify = (name: string): string =>
  name
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cell";

export function headSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------------------------------------------------------------------------
// The stage runner — one attempt, wall-clocked, never retried
// ---------------------------------------------------------------------------

export interface CommandResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  ms: number;
}

/**
 * Run one documented command, ONCE. There is deliberately no retry parameter:
 * a harness that can retry is a harness that measures end-state quality.
 */
export function runOnce(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: Record<string, string>; timeoutMs?: number },
): CommandResult {
  const t0 = Date.now();
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: opts.cwd,
      encoding: "utf8",
      timeout: opts.timeoutMs ?? 20 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, code: 0, stdout, stderr: "", ms: Date.now() - t0 };
  } catch (e) {
    const err = e as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      ok: false,
      code: err.status ?? -1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? err.message ?? ""),
      ms: Date.now() - t0,
    };
  }
}

/**
 * A failure, in the engine's own words. Never paraphrased. Both ENDS are kept
 * — the refusal headline this repo prints FIRST (`✘ Refused …`) and the remedy
 * it prints LAST — because a tail-only capture buried the one line that says
 * what went wrong behind a run's trailing receipts.
 */
export function refusalMessage(r: CommandResult, cap = 2000): string {
  const raw = [r.stderr.trim(), r.stdout.trim()]
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!raw) return `exited ${r.code} with no output`;
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const kept =
    lines.length <= 18
      ? lines
      : [
          ...lines.slice(0, 9),
          `… ${lines.length - 18} line(s) elided …`,
          ...lines.slice(-9),
        ];
  const text = kept.join("\n");
  return text.length > cap ? text.slice(0, cap) + " […]" : text;
}

/** THE line a reader needs: the refusal headline when the output carries one,
 *  else the last line. This is the one-line column in the receipt. */
export function headline(message: string): string {
  const ls = message.split("\n").filter((l) => l.trim().length > 0);
  const marked = ls.find((l) => /(✘|✖|REFUSED|Refused|refuses|Error:)/.test(l));
  return (marked ?? ls[ls.length - 1] ?? "").trim();
}

/** REFUSED vs ERROR. A refusal is the engine declining BY NAME; anything else
 *  that dies is an ERROR. The vocabulary below is the repo's own — every
 *  phrase here is a string some gate or emitter actually prints. */
export function classify(r: CommandResult): "REFUSED" | "ERROR" {
  const text = `${r.stderr}\n${r.stdout}`.toLowerCase();
  const named = [
    "refused",
    "refuses",
    "refusal",
    "declined",
    "cannot carry",
    "not carryable",
    "outside the",
    "wrong file",
    "no proposal artifacts were written",
  ];
  return named.some((n) => text.includes(n)) ? "REFUSED" : "ERROR";
}

// ---------------------------------------------------------------------------
// The shadow root — an exam can never move a committed byte
// ---------------------------------------------------------------------------

/**
 * Build a directory that LOOKS like the repo (symlink per top-level entry) but
 * whose `writable` paths are real, private copies. The pipeline runs with this
 * as its cwd/root, so `promote` writing examples/<lib>/contracts writes into
 * the copy and the checkout is untouched. `.git` is deliberately not linked:
 * nothing in the chain may reach the object store.
 */
export function makeShadowRoot(work: string, writable: string[]): string {
  const root = path.join(work, "root");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const entry of readdirSync(REPO)) {
    if (entry === ".git") continue;
    symlinkSync(path.join(REPO, entry), path.join(root, entry));
  }
  for (const rel of writable) explode(root, rel);
  return root;
}

function explode(root: string, rel: string): void {
  const segs = rel.split("/").filter(Boolean);
  let cur = root;
  let src = REPO;
  for (let i = 0; i < segs.length; i++) {
    src = path.join(src, segs[i]);
    const next = path.join(cur, segs[i]);
    const last = i === segs.length - 1;
    const st = lstatSync(next, { throwIfNoEntry: false });
    if (last) {
      if (st) rmSync(next, { recursive: true, force: true });
      if (existsSync(src) && statSync(src).isDirectory())
        cpSync(src, next, { recursive: true, dereference: true });
      else mkdirSync(next, { recursive: true });
    } else if (st?.isSymbolicLink()) {
      rmSync(next);
      mkdirSync(next);
      for (const e of readdirSync(src))
        symlinkSync(path.join(src, e), path.join(next, e));
    } else if (!st) {
      mkdirSync(next, { recursive: true });
    }
    cur = next;
  }
}

// ---------------------------------------------------------------------------
// Packet IO
// ---------------------------------------------------------------------------

/**
 * The three surfaces, resolved. They are overridable ONLY so `--self-test`
 * can point the whole gate at a temp copy and plant reds in it — a gate that
 * cannot be shown going red is not a gate. Production callers never set them.
 */
const PATHS = {
  dir: FIRST_PASS_DIR as string,
  receipt: FIRST_PASS_RECEIPT as string,
  ratchet: FIRST_PASS_RATCHET as string,
};
export function setPaths(p: Partial<typeof PATHS>): void {
  Object.assign(PATHS, p);
}
const abs = (p: string): string =>
  path.isAbsolute(p) ? p : path.join(REPO, p);
/**
 * Resolve a path an attempt recorded. Packet paths are stored REPO-relative
 * because that is what a human reads, but they must be RE-ROOTED at the packet
 * tree actually under test — otherwise `--self-test` would hash the real
 * repository's bytes while planting its red in a copy, and the corrupted-image
 * scenario could never fire. Anything outside the packet tree stays
 * repo-relative.
 */
const resolveArtifact = (p: string): string =>
  p.startsWith(`${FIRST_PASS_DIR}/`)
    ? path.join(abs(PATHS.dir), p.slice(FIRST_PASS_DIR.length + 1))
    : path.join(REPO, p);
export const receiptPath = (): string => abs(PATHS.receipt);
export const ratchetPath = (): string => abs(PATHS.ratchet);
export const examDir = (exam: string): string =>
  path.join(abs(PATHS.dir), exam);
export const manifestPath = (exam: string): string =>
  path.join(examDir(exam), "MANIFEST.json");
export const packetDir = (exam: string, set: string): string =>
  path.join(examDir(exam), slugify(set));

export function writeManifest(m: ExamManifest): void {
  mkdirSync(examDir(m.exam), { recursive: true });
  writeFileSync(manifestPath(m.exam), stableJson(m));
}

export function writeAttempt(a: SetAttempt): void {
  const dir = packetDir(a.exam, a.set);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "attempt.json"), stableJson(a));
}

/** Drop images from an earlier sample rule so a shrinking sample can never
 *  leave an orphan PNG the gate would count. */
export function clearPacketImages(exam: string, set: string): void {
  const dir = packetDir(exam, set);
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir))
    if (/^(ref|code|canvas)-.*\.png$/.test(f)) rmSync(path.join(dir, f));
}

export interface ExamState {
  exam: string;
  manifest: ExamManifest;
  attempts: SetAttempt[];
  verdicts: Map<string, Verdict>;
  failures: string[];
}

/** Read one committed exam and REFUSE on every way its packets can lie:
 *  a named set with no packet, a packet no set names, a committed artifact
 *  that is gone or whose bytes changed. */
export function readExamState(exam: string): ExamState {
  const failures: string[] = [];
  const mp = manifestPath(exam);
  if (!existsSync(mp)) {
    return {
      exam,
      manifest: {
        exam,
        direction: "canvas-to-code",
        describe: "",
        heldOut: false,
        date: "",
        engineSha: "",
        input: {},
        sets: [],
        mint: { requested: false, fileKey: "", status: "PENDING", message: "" },
        noRetry: true,
        cellCap: CELL_CAP,
      },
      attempts: [],
      verdicts: new Map(),
      failures: [`${FIRST_PASS_DIR}/${exam}/MANIFEST.json is missing`],
    };
  }
  const manifest = JSON.parse(readFileSync(mp, "utf8")) as ExamManifest;
  const attempts: SetAttempt[] = [];
  const verdicts = new Map<string, Verdict>();

  const named = new Set(manifest.sets.map((s) => slugify(s)));
  for (const entry of readdirSync(examDir(exam), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!named.has(entry.name))
      failures.push(
        `${exam}: packet directory "${entry.name}" is not a MANIFEST set — a set cannot be quietly ADDED; re-run the exam`,
      );
  }

  for (const set of manifest.sets) {
    const dir = packetDir(exam, set);
    const ap = path.join(dir, "attempt.json");
    if (!existsSync(ap)) {
      failures.push(
        `${exam}/${set}: MANIFEST names this set but ${path.relative(REPO, ap)} is missing — a set cannot be quietly DROPPED`,
      );
      continue;
    }
    const a = JSON.parse(readFileSync(ap, "utf8")) as SetAttempt;
    attempts.push(a);
    for (const st of a.stages) {
      for (const art of st.artifacts) {
        if (!art.committed) continue;
        const abs = resolveArtifact(art.path);
        if (!existsSync(abs)) {
          failures.push(
            `${exam}/${set}: stage ${st.stage} names ${art.path}, which is not on disk`,
          );
          continue;
        }
        const buf = readFileSync(abs);
        if (sha(buf) !== art.sha256)
          failures.push(
            `${exam}/${set}: stage ${st.stage} artifact ${art.path} has sha256 ${sha(buf)}, the attempt recorded ${art.sha256} — the packet and its bytes disagree`,
          );
      }
    }
    for (const kind of ["ref", "code", "canvas"] as const) {
      for (const f of a.images[kind]) {
        if (!existsSync(path.join(REPO, f)))
          failures.push(
            `${exam}/${set}: attempt.json names ${kind} image ${f}, which is not on disk`,
          );
      }
    }
    if (
      a.images.ref.length === 0 &&
      a.images.code.length === 0 &&
      a.images.canvas.length === 0 &&
      a.images.absent.length === 0
    )
      failures.push(
        `${exam}/${set}: the packet has no images AND names no absence — a blank cell is never allowed`,
      );
    const vp = path.join(dir, "verdict.json");
    if (existsSync(vp)) {
      const v = JSON.parse(readFileSync(vp, "utf8")) as Verdict;
      if (v.recognisable === false && (v.walls ?? []).length === 0)
        failures.push(
          `${exam}/${set}: verdict.json says NOT recognisable and names no wall — an unexplained difference is red`,
        );
      verdicts.set(set, v);
    }
  }
  return { exam, manifest, attempts, verdicts, failures };
}

/** Every exam directory on disk, whether or not the registry knows it. */
export function committedExams(): string[] {
  const root = abs(PATHS.dir);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// ---------------------------------------------------------------------------
// Tally
// ---------------------------------------------------------------------------

export interface ExamTally {
  exam: string;
  direction: ExamDirection;
  subject: string;
  heldOut: boolean;
  date: string;
  engineSha: string;
  attempted: number;
  chainComplete: number;
  /** stage name → how many sets stopped there with REFUSED */
  refusedByStage: Map<string, number>;
  /** stage name → how many sets stopped there with ERROR */
  erroredByStage: Map<string, number>;
  /** stage name → how many sets stopped there PENDING (a precondition outside
   *  the engine, e.g. no canvas bridge). Its own column: a chain that ran
   *  clean to its last stage and stopped on a missing bridge is a different
   *  fact from one the engine refused, and collapsing them would hide it. */
  pendingByStage: Map<string, number>;
  minted: number;
  mintStatus: StageStatus;
  mintMessage: string;
  graded: number;
  recognisable: number;
  notRecognisable: number;
}

export function tally(state: ExamState): ExamTally {
  const refusedByStage = new Map<string, number>();
  const erroredByStage = new Map<string, number>();
  const pendingByStage = new Map<string, number>();
  let chainComplete = 0;
  let minted = 0;
  for (const a of state.attempts) {
    if (a.chainComplete) chainComplete++;
    const stop = a.firstStop;
    if (stop?.status === "REFUSED")
      refusedByStage.set(stop.stage, (refusedByStage.get(stop.stage) ?? 0) + 1);
    if (stop?.status === "ERROR")
      erroredByStage.set(stop.stage, (erroredByStage.get(stop.stage) ?? 0) + 1);
    if (stop?.status === "PENDING")
      pendingByStage.set(stop.stage, (pendingByStage.get(stop.stage) ?? 0) + 1);
    if (a.stages.some((s) => s.stage === "mint" && s.status === "ok")) minted++;
  }
  let graded = 0;
  let recognisable = 0;
  let notRecognisable = 0;
  for (const v of state.verdicts.values()) {
    if (v.recognisable === true) {
      graded++;
      recognisable++;
    } else if (v.recognisable === false) {
      graded++;
      notRecognisable++;
    }
  }
  const m = state.manifest;
  const subject =
    (m.input.library as string) ??
    (m.input.kit as string) ??
    (m.input.fileKey as string) ??
    "—";
  return {
    exam: state.exam,
    direction: m.direction,
    subject,
    heldOut: m.heldOut,
    date: m.date,
    engineSha: m.engineSha,
    attempted: state.attempts.length,
    chainComplete,
    refusedByStage,
    erroredByStage,
    pendingByStage,
    minted,
    mintStatus: m.mint.status,
    mintMessage: m.mint.message,
    graded,
    recognisable,
    notRecognisable,
  };
}

const stageList = (m: Map<string, number>): string =>
  m.size === 0
    ? "—"
    : [...m]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([s, n]) => `${s} (${n})`)
        .join(", ");

// ---------------------------------------------------------------------------
// The ratchet
// ---------------------------------------------------------------------------

export interface RatchetRate {
  numerator: number;
  denominator: number;
}
export interface RatchetReason {
  exam: string;
  date: string;
  metric: "chain" | "recognisable";
  from: string;
  to: string;
  reason: string;
}
export interface Ratchet {
  _header: string;
  exams: Record<string, { chain: RatchetRate; recognisable: RatchetRate }>;
  reasons: RatchetReason[];
}

export const RATCHET_HEADER =
  "FIRST-PASS RATCHET — the BEST first-pass rate each exam has ever recorded. `npm run first-pass:check` recomputes the current rate from the committed packets and REFUSES when it is lower, unless a `reasons` row names the decrease with matching from/to. Raised automatically by `--write-receipt`; lowered ONLY through a reasons row. A metric that can quietly fall is not a metric.";

export const emptyRatchet = (): Ratchet => ({
  _header: RATCHET_HEADER,
  exams: {},
  reasons: [],
});

export function loadRatchet(): Ratchet {
  const p = ratchetPath();
  if (!existsSync(p)) return emptyRatchet();
  return JSON.parse(readFileSync(p, "utf8")) as Ratchet;
}

export const rateText = (r: RatchetRate): string =>
  `${r.numerator}/${r.denominator}`;

/** -1 / 0 / 1, comparing a/b against c/d without floating point. A zero
 *  denominator is "nothing measured" and sorts below everything measured. */
export function compareRates(a: RatchetRate, b: RatchetRate): number {
  if (a.denominator === 0 && b.denominator === 0) return 0;
  if (a.denominator === 0) return -1;
  if (b.denominator === 0) return 1;
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left === right ? 0 : left < right ? -1 : 1;
}

export function currentRates(t: ExamTally): {
  chain: RatchetRate;
  recognisable: RatchetRate;
} {
  return {
    chain: { numerator: t.chainComplete, denominator: t.attempted },
    recognisable: { numerator: t.recognisable, denominator: t.graded },
  };
}

/** The ratchet's verdict for one exam. Pure — the gate prints it, the writer
 *  uses it to decide whether the recorded best moves. */
export function ratchetFailures(t: ExamTally, r: Ratchet): string[] {
  const failures: string[] = [];
  const best = r.exams[t.exam];
  const cur = currentRates(t);
  if (!best) {
    failures.push(
      `RATCHET: exam "${t.exam}" has packets but no row in ${FIRST_PASS_RATCHET} — run \`npm run first-pass:check -- --write-receipt\` and commit it`,
    );
    return failures;
  }
  for (const metric of ["chain", "recognisable"] as const) {
    const c = cur[metric];
    const b = best[metric];
    const cmp = compareRates(c, b);
    if (cmp > 0) {
      failures.push(
        `RATCHET: exam "${t.exam}" ${metric} is ${rateText(c)} but the recorded best is ${rateText(b)} — the ratchet is STALE; run \`npm run first-pass:check -- --write-receipt\` and commit it`,
      );
    } else if (cmp < 0) {
      const named = r.reasons.find(
        (x) =>
          x.exam === t.exam &&
          x.metric === metric &&
          x.from === rateText(b) &&
          x.to === rateText(c) &&
          x.reason.trim().length > 0,
      );
      if (!named)
        failures.push(
          `RATCHET: exam "${t.exam}" ${metric} FELL from ${rateText(b)} to ${rateText(c)} with no named reason — add a reasons row {exam,date,metric,from:"${rateText(b)}",to:"${rateText(c)}",reason} to ${FIRST_PASS_RATCHET}, or fix the regression`,
        );
    }
  }
  return failures;
}

/** Raise (or, with a named reason, lower) the recorded best. */
export function applyRatchet(t: ExamTally, r: Ratchet): Ratchet {
  const cur = currentRates(t);
  const best = r.exams[t.exam];
  if (!best) {
    r.exams[t.exam] = cur;
    return r;
  }
  for (const metric of ["chain", "recognisable"] as const) {
    const cmp = compareRates(cur[metric], best[metric]);
    if (cmp > 0) best[metric] = cur[metric];
    else if (cmp < 0) {
      const named = r.reasons.find(
        (x) =>
          x.exam === t.exam &&
          x.metric === metric &&
          x.from === rateText(best[metric]) &&
          x.to === rateText(cur[metric]),
      );
      if (named) best[metric] = cur[metric];
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// The receipt — byte-stable, rendered only from committed bytes
// ---------------------------------------------------------------------------

const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

const cell = (s: string): string =>
  s.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();

export function renderReceipt(
  states: ExamState[],
  ratchet: Ratchet,
  failures: string[],
): string {
  const out: string[] = [];
  out.push("# First-pass exam — does it work on the first try, untouched?");
  out.push("");
  out.push(
    "GENERATED by `npm run first-pass:check -- --write-receipt` (scripts/first-pass-check.ts) — do not edit. Byte-stable: exams in registry order, sets in MANIFEST order; the date and the engine SHA in every row are RECORDED INTO THE EXAM'S MANIFEST at run time and rendered from it — this file never reads the clock, the environment, or git.",
  );
  out.push("");
  out.push("## The bar");
  out.push("");
  out.push(
    "Owner, 2026-08-24: *\"I don't think I've seen one successful pass on the first try.\"* Every green number this repo has recorded was won by a heal loop. FIRST-PASS quality — the documented chain run end to end with **zero human and zero agent intervention and no retry** — is a different claim from end-state quality, and until this receipt existed it had never been measured. A REFUSAL is an honest outcome and is recorded as such; it is not counted as a completed chain, and it is not counted as a failure of the run.",
  );
  out.push("");
  out.push(
    "See [docs/31 — First-pass](../../../docs/31-first-pass.md) for the metric and how to run an exam.",
  );
  out.push("");
  out.push("## The exams");
  out.push("");
  out.push(
    "| date | exam | direction | subject | held out | engine SHA | sets | chain complete #1 | stopped: REFUSED | stopped: ERROR | stopped: PENDING | minted | recognisable #1 |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const tallies: ExamTally[] = [];
  for (const s of states) {
    const t = tally(s);
    tallies.push(t);
    out.push(
      `| ${t.date} | ${t.exam} | ${t.direction} | ${cell(t.subject)} | ${t.heldOut ? "yes" : "no (self-test)"} | \`${t.engineSha.slice(0, 8)}\` | ${t.attempted} | ${t.chainComplete} | ${cell(stageList(t.refusedByStage))} | ${cell(stageList(t.erroredByStage))} | ${cell(stageList(t.pendingByStage))} | ${t.minted} | ${t.graded === 0 ? "ungraded" : `${t.recognisable}/${t.graded}`} |`,
    );
  }
  out.push("");
  out.push(
    "`chain complete #1` = EVERY stage of the direction returned ok on the single attempt. `stopped: REFUSED` is the engine declining BY NAME — the honest outcome. `stopped: ERROR` is a stage that died without one. `stopped: PENDING` is a precondition OUTSIDE the engine (a canvas write needs the figma-console bridge, which a Node process cannot reach), kept in its own column because a chain that ran clean to its last stage and stopped on a missing bridge is a different fact from one the engine refused. `minted` = sets whose bytes actually reached the canvas. `recognisable #1` = graded blind against the owner's bar; `ungraded` means no `verdict.json` has been written yet, and is never rendered as a number.",
  );
  out.push("");

  for (const s of states) {
    const m = s.manifest;
    out.push(`## ${m.exam}`);
    out.push("");
    out.push(cell(m.describe));
    out.push("");
    const inputRows = Object.entries(m.input)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([k, v]) => `\`${k}\` = ${Array.isArray(v) ? v.join(", ") : String(v)}`,
      );
    out.push(
      `Input: ${inputRows.join("; ") || "—"}. Cell cap ${m.cellCap} per set.`,
    );
    out.push("");
    out.push(`Mint: **${m.mint.status}** — ${cell(m.mint.message)}`);
    out.push("");
    out.push(
      "| set | contract id | chain | first stop | stage | message | wall-clock | ref | code | canvas | verdict |",
    );
    out.push("|---|---|---|---|---|---|---|---|---|---|---|");
    for (const set of m.sets) {
      const a = s.attempts.find((x) => x.set === set);
      if (!a) {
        out.push(
          `| ${cell(set)} | — | MISSING | — | — | packet absent | — | — | — | — | — |`,
        );
        continue;
      }
      const v = s.verdicts.get(set);
      const stop = a.firstStop;
      out.push(
        `| ${cell(a.set)} | ${a.id ?? "—"} | ${a.chainComplete ? "complete" : "stopped"} | ${stop ? stop.status : "—"} | ${stop ? stop.stage : "—"} | ${cell(stop ? headline(stop.message).slice(0, 200) : "—")} | ${secs(a.totalMs)} | ${a.images.ref.length} | ${a.images.code.length} | ${a.images.canvas.length} | ${v ? (v.recognisable === true ? "recognisable" : v.recognisable === false ? `NOT (${(v.walls ?? []).join(", ")})` : "unscored") : "ungraded"} |`,
      );
    }
    out.push("");
    const absent = new Map<string, number>();
    for (const a of s.attempts)
      for (const im of a.images.absent)
        absent.set(
          `${im.kind}: ${im.reason}`,
          (absent.get(`${im.kind}: ${im.reason}`) ?? 0) + 1,
        );
    if (absent.size > 0) {
      out.push(
        "Images absent, by named reason (a blank cell is never allowed):",
      );
      out.push("");
      for (const [reason, n] of [...absent].sort(([a], [b]) =>
        a.localeCompare(b),
      ))
        out.push(`- ${n}× ${cell(reason)}`);
      out.push("");
    }
  }

  out.push("## The wave-3 queue — exams the metric has NOT been pointed at");
  out.push("");
  out.push("| exam | direction | what it is |");
  out.push("|---|---|---|");
  for (const q of EXAM_QUEUE)
    out.push(`| ${q.exam} | ${q.direction} | ${cell(q.describe)} |`);
  out.push("");
  out.push(
    'These are registered in `extract/figma/census/first-pass.ts` (`EXAM_QUEUE`) and have no packets. Listing them here keeps "never measured" an admission on the record rather than a silence.',
  );
  out.push("");

  out.push("## The ratchet");
  out.push("");
  out.push(
    "`parity/receipts/v1/first-pass-ratchet.json` records the BEST rate each exam has ever reached. `npm run first-pass:check` recomputes the current rate from the packets and refuses when it is lower without a named reason, and refuses when it is HIGHER and the recorded best was not raised — a stale ratchet is as dead as a falling one.",
  );
  out.push("");
  out.push("| exam | metric | best ever | this commit |");
  out.push("|---|---|---|---|");
  for (const t of tallies) {
    const best = ratchet.exams[t.exam];
    const cur = currentRates(t);
    for (const metric of ["chain", "recognisable"] as const)
      out.push(
        `| ${t.exam} | ${metric} | ${best ? rateText(best[metric]) : "—"} | ${rateText(cur[metric])} |`,
      );
  }
  out.push("");
  if (ratchet.reasons.length > 0) {
    out.push("Named decreases:");
    out.push("");
    out.push("| date | exam | metric | from | to | reason |");
    out.push("|---|---|---|---|---|---|");
    for (const r of ratchet.reasons)
      out.push(
        `| ${r.date} | ${r.exam} | ${r.metric} | ${r.from} | ${r.to} | ${cell(r.reason)} |`,
      );
    out.push("");
  } else {
    out.push("No named decrease has been recorded.");
    out.push("");
  }

  if (failures.length > 0) {
    out.push("## THIS RENDERING IS RED");
    out.push("");
    for (const f of failures) out.push(`- ${cell(f)}`);
    out.push("");
  }
  return out.join("\n");
}
