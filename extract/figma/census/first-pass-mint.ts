/**
 * THE MINT STAGE, RECORDED — `npm run exam:first-pass -- --exam <e> --record-mint`
 *
 * WHY THIS FILE EXISTS. `mint` is the one stage of the code→canvas chain the
 * harness cannot execute (see `mintDriver` in first-pass-run.ts): the
 * figma-console bridge speaks MCP over stdio to its own client and WebSocket
 * to plugin clients, and a Node process is neither. Before 2026-08-25 that
 * left the stage permanently PENDING and the whole direction unmeasurable
 * past `bundle` — the exam this project had never finished.
 *
 * The stage is therefore modelled as what it is: **driven by an agent, with
 * evidence.** The agent holding the MCP tools runs each emitted script exactly
 * once, exports the sampled variants, and writes `mint-evidence.json` beside
 * the packet. This module reads that evidence and folds it into the packet
 * THROUGH THE HARNESS'S OWN WRITERS, so `attempt.json`, `MANIFEST.json` and
 * the receipt stay byte-stable and the ratchet sees an honest shape-move.
 *
 * IT MAY NOT INVENT A RESULT. Every claim in the evidence is checked against
 * something the agent did not author:
 *
 *   · the file key must be the scratch key, and no forbidden key may appear
 *     anywhere in the evidence bytes;
 *   · every MANIFEST set must appear exactly once — a set cannot be quietly
 *     dropped or added at record time any more than at run time;
 *   · `scriptSha256` must equal the sha256 the HARNESS recorded for that set's
 *     emitted script. The bytes the agent ran are then provably the bytes the
 *     chain emitted, and a hand-edited script cannot be recorded as a mint;
 *   · a set claimed `minted` must name at least one canvas image, and every
 *     named image must be on disk (its sha256 is recorded and the gate
 *     re-hashes it);
 *   · every cell with no canvas image must be named with a reason — the
 *     packet's "a blank cell is never allowed" rule applies to this stage too;
 *   · the evidence may only be recorded onto a stage the harness left PENDING.
 *     A set whose chain stopped earlier has a SKIPPED mint and must be
 *     recorded `not-reached`; nothing can be back-filled onto a broken chain.
 *
 * THE NO-RETRY RULE BINDS THE AGENT. `attemptsPerSet` must be 1 and `noRetry`
 * must be true. A second attempt at a failed mint is the heal loop this metric
 * exists to exclude.
 *
 * WHAT THE FIVE STATUSES MEAN:
 *   minted            the run WROTE to the canvas (created or amended)  → ok
 *   skipped-unchanged the engine compared its own specHash against the one
 *                     stamped on the canvas node, found them equal and wrote
 *                     NOTHING. The canvas already carries these exact bytes,
 *                     from an earlier mint. The stage did its job, so it is
 *                     `ok` — and `bytesWritten: false` says out loud that this
 *                     attempt moved nothing, so a reader can never mistake it
 *                     for a write.                                      → ok
 *   refused           the engine declined BY NAME. The honest outcome.  → REFUSED
 *   failed            the script threw without a named refusal.         → ERROR
 *   not-reached       an earlier stage stopped this chain.        → left SKIPPED
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { REPO } from "./corpus.js";
import {
  FIRST_PASS_DIR,
  FORBIDDEN_FILE_KEYS,
  SCRATCH_FILE_KEY,
  type Artifact,
  type ExamManifest,
  type SetAttempt,
  type StageStatus,
  artifactOf,
  examDir,
  manifestPath,
  packetDir,
  sha,
  slugify,
  writeAttempt,
  writeManifest,
} from "./first-pass.js";

export type MintSetStatus =
  "minted" | "skipped-unchanged" | "refused" | "failed" | "not-reached";

export interface MintCanvasCell {
  /** The packet cell name — the `<cell>` of `ref-<cell>.png`, so the pair
   *  lines up with the committed ref/code images. */
  cell: string;
  /** Basename inside the set's packet directory: `canvas-<cell>.png`. */
  file: string;
  nodeId: string;
  /** The Figma variant this picture is of, as the canvas names it. */
  variant: string;
}

export interface MintSetEvidence {
  status: MintSetStatus;
  /** Did THIS attempt move a canvas byte? `skipped-unchanged` is false. */
  bytesWritten: boolean;
  script: string;
  /** Must equal the sha256 the harness recorded for the emitted script. */
  scriptSha256: string;
  ms: number;
  nodeId?: string | null;
  key?: string | null;
  landedOnPage?: string | null;
  /** The engine's own words. Never paraphrased. */
  message: string;
  consoleTail: string[];
  canvas: MintCanvasCell[];
  absentCanvas: Array<{ cell: string; reason: string }>;
}

export interface MintEvidence {
  exam: string;
  driver: "mcp";
  fileKey: string;
  fileName?: string;
  recordedAt: string;
  engineSha: string;
  operator: string;
  noRetry: true;
  attemptsPerSet: 1;
  examPage?: Record<string, unknown>;
  transport?: Record<string, unknown>;
  sets: Record<string, MintSetEvidence>;
}

const STATUS_OF: Record<MintSetStatus, StageStatus | null> = {
  minted: "ok",
  "skipped-unchanged": "ok",
  refused: "REFUSED",
  failed: "ERROR",
  "not-reached": null,
};

export const mintEvidenceFile = (exam: string): string =>
  path.join(examDir(exam), "mint-evidence.json");

export interface RecordMintResult {
  failures: string[];
  manifest?: ExamManifest;
  perSet: Array<{
    set: string;
    from: StageStatus;
    to: StageStatus;
    canvas: number;
  }>;
}

/**
 * Fold `mint-evidence.json` into the committed packet. Returns the failures it
 * refused on; when there are any, NOTHING is written — the packet is evidence
 * and a half-recorded mint is worse than a PENDING one.
 */
export function recordMint(exam: string): RecordMintResult {
  const failures: string[] = [];
  const perSet: RecordMintResult["perSet"] = [];
  const ep = mintEvidenceFile(exam);
  if (!existsSync(ep))
    return {
      failures: [
        `${path.relative(REPO, ep)} does not exist — the MCP-driven mint has not been run. See docs/31 §6 for the operator procedure.`,
      ],
      perSet,
    };

  const raw = readFileSync(ep, "utf8");
  let ev: MintEvidence;
  try {
    ev = JSON.parse(raw) as MintEvidence;
  } catch (e) {
    return {
      failures: [
        `${path.relative(REPO, ep)} does not parse: ${String((e as Error).message ?? e)}`,
      ],
      perSet,
    };
  }

  // ---- the asserts that make the evidence more than a claim ---------------
  if (ev.exam !== exam)
    failures.push(
      `mint-evidence names exam ${JSON.stringify(ev.exam)}, recorded under ${exam}`,
    );
  if (ev.driver !== "mcp")
    failures.push(
      `mint-evidence driver is ${JSON.stringify(ev.driver)}; the canvas write is always "mcp"`,
    );
  if (ev.fileKey !== SCRATCH_FILE_KEY)
    failures.push(
      `mint-evidence names file key ${JSON.stringify(ev.fileKey)} — the ONLY writable file is ${SCRATCH_FILE_KEY}`,
    );
  for (const k of FORBIDDEN_FILE_KEYS)
    if (raw.includes(k))
      failures.push(`mint-evidence names the forbidden file key ${k}`);
  if (ev.noRetry !== true)
    failures.push(
      `mint-evidence must set "noRetry": true — one attempt per set is the metric`,
    );
  if (ev.attemptsPerSet !== 1)
    failures.push(
      `mint-evidence must set "attemptsPerSet": 1, not ${JSON.stringify(ev.attemptsPerSet)}`,
    );

  const mp = manifestPath(exam);
  if (!existsSync(mp))
    return {
      failures: [
        ...failures,
        `${FIRST_PASS_DIR}/${exam}/MANIFEST.json is missing — run the exam first`,
      ],
      perSet,
    };
  const manifest = JSON.parse(readFileSync(mp, "utf8")) as ExamManifest;
  if (manifest.direction !== "code-to-canvas")
    failures.push(
      `${exam} is ${manifest.direction}; only code→canvas has a mint stage`,
    );

  const named = new Set(Object.keys(ev.sets));
  for (const set of manifest.sets)
    if (!named.has(set))
      failures.push(
        `mint-evidence does not name MANIFEST set ${JSON.stringify(set)} — a set cannot be quietly DROPPED`,
      );
  for (const set of named)
    if (!manifest.sets.includes(set))
      failures.push(
        `mint-evidence names ${JSON.stringify(set)}, which the MANIFEST does not — a set cannot be quietly ADDED`,
      );
  if (failures.length > 0) return { failures, perSet };

  // ---- build every write before performing one ---------------------------
  const planned: Array<{
    attempt: SetAttempt;
    from: StageStatus;
    to: StageStatus;
    canvas: number;
  }> = [];
  for (const set of manifest.sets) {
    const e = ev.sets[set];
    const dir = packetDir(exam, set);
    const ap = path.join(dir, "attempt.json");
    if (!existsSync(ap)) {
      failures.push(`${exam}/${set}: attempt.json is missing`);
      continue;
    }
    const a = JSON.parse(readFileSync(ap, "utf8")) as SetAttempt;
    const stage = a.stages.find((s) => s.stage === "mint");
    if (!stage) {
      failures.push(`${exam}/${set}: attempt.json records no mint stage`);
      continue;
    }
    const from = stage.status;
    const to = STATUS_OF[e.status];
    if (to === undefined)
      failures.push(
        `${exam}/${set}: unknown mint status ${JSON.stringify(e.status)}`,
      );

    // A chain that stopped earlier has a SKIPPED mint. Nothing may be
    // back-filled onto it, and an evidence row claiming otherwise is a lie
    // about which stage the chain reached.
    if (from === "SKIPPED" && e.status !== "not-reached") {
      failures.push(
        `${exam}/${set}: the chain stopped before mint (mint is SKIPPED) but the evidence claims ${JSON.stringify(e.status)} — a mint cannot be recorded onto a chain that never reached it`,
      );
      continue;
    }
    if (from !== "SKIPPED" && e.status === "not-reached") {
      failures.push(
        `${exam}/${set}: the chain REACHED mint (${from}) but the evidence says "not-reached"`,
      );
      continue;
    }
    if (e.status === "not-reached") continue;
    if (from !== "PENDING") {
      failures.push(
        `${exam}/${set}: mint is already recorded as ${from}, not PENDING — re-record only onto a pending stage, or re-run the exam`,
      );
      continue;
    }

    // THE BYTES THE AGENT RAN ARE THE BYTES THE CHAIN EMITTED.
    const emitted = stage.artifacts.find((x) => x.path.endsWith(".figma.js"));
    if (!emitted) {
      failures.push(
        `${exam}/${set}: the mint stage names no emitted .figma.js artifact to check the evidence against`,
      );
      continue;
    }
    if (emitted.sha256 !== e.scriptSha256)
      failures.push(
        `${exam}/${set}: the evidence ran a script with sha256 ${e.scriptSha256}, the harness emitted ${emitted.sha256} (${emitted.path}) — refusing to record a mint of bytes this chain did not produce`,
      );
    if (path.basename(emitted.path) !== e.script)
      failures.push(
        `${exam}/${set}: the evidence names script ${JSON.stringify(e.script)}, the harness emitted ${JSON.stringify(path.basename(emitted.path))}`,
      );

    // ---- the pictures ----------------------------------------------------
    const cells = a.images.ref.map((p) =>
      path
        .basename(p)
        .replace(/^ref-/, "")
        .replace(/\.png$/, ""),
    );
    const canvasPaths: string[] = [];
    const canvasArts: Artifact[] = [];
    for (const c of e.canvas) {
      if (c.file !== `canvas-${c.cell}.png`)
        failures.push(
          `${exam}/${set}: canvas image ${JSON.stringify(c.file)} does not match its cell ${JSON.stringify(c.cell)} — the pair would not line up with ref-${c.cell}.png`,
        );
      const abs = path.join(dir, c.file);
      if (!existsSync(abs)) {
        failures.push(
          `${exam}/${set}: the evidence names ${c.file}, which is not on disk`,
        );
        continue;
      }
      canvasPaths.push(path.relative(REPO, abs));
      canvasArts.push(artifactOf(abs, true));
    }
    if (e.status === "minted" && canvasPaths.length === 0)
      failures.push(
        `${exam}/${set}: the evidence claims the bytes reached the canvas and names no picture of them — a minted set with no canvas image is never allowed`,
      );
    if (e.bytesWritten !== (e.status === "minted"))
      failures.push(
        `${exam}/${set}: bytesWritten=${e.bytesWritten} contradicts status ${JSON.stringify(e.status)}`,
      );

    // EVERY cell is accounted for: a picture, or a named reason.
    const covered = new Set(e.canvas.map((c) => c.cell));
    const excused = new Map(e.absentCanvas.map((x) => [x.cell, x.reason]));
    for (const cell of cells)
      if (!covered.has(cell) && !excused.has(cell))
        failures.push(
          `${exam}/${set}: cell ${JSON.stringify(cell)} has ref/code images, no canvas image and no named reason — a blank cell is never allowed`,
        );
    for (const cell of excused.keys())
      if (covered.has(cell))
        failures.push(
          `${exam}/${set}: cell ${JSON.stringify(cell)} is named both present and absent`,
        );

    if (failures.length > 0) continue;

    // ---- fold it in ------------------------------------------------------
    stage.status = to as StageStatus;
    stage.ms = e.ms;
    stage.driver = "mcp";
    // The `minted` column counts THIS, not `ok` — a mint the engine skipped as
    // unchanged completes the chain without moving a byte, and the two must
    // never be summed into one number.
    stage.bytesWritten = e.bytesWritten;
    stage.message =
      `${e.message} [MCP-driven mint, one attempt, evidence ${FIRST_PASS_DIR}/${exam}/mint-evidence.json; ` +
      `operator ${ev.operator}; file ${ev.fileKey}${e.landedOnPage ? `, page ${JSON.stringify(e.landedOnPage)}` : ""}]`;
    stage.artifacts = [
      ...stage.artifacts.filter((x) => !x.committed),
      ...canvasArts,
    ];

    a.images.canvas = canvasPaths;
    a.images.absent = [
      ...a.images.absent.filter((x) => x.kind !== "canvas"),
      ...e.absentCanvas.map((x) => ({
        kind: "canvas" as const,
        reason: `${x.cell}: ${x.reason}`,
      })),
    ];
    const stop =
      a.stages.find((s) => s.status !== "ok" && s.status !== "SKIPPED") ?? null;
    a.chainComplete = a.stages.every((s) => s.status === "ok");
    a.firstStop = stop
      ? { stage: stop.stage, status: stop.status, message: stop.message }
      : null;
    a.totalMs = a.stages.reduce((n, s) => n + s.ms, 0);
    planned.push({
      attempt: a,
      from,
      to: to as StageStatus,
      canvas: canvasPaths.length,
    });
  }

  if (failures.length > 0) return { failures, perSet };

  for (const p of planned) {
    writeAttempt(p.attempt);
    perSet.push({
      set: p.attempt.set,
      from: p.from,
      to: p.to,
      canvas: p.canvas,
    });
  }

  const minted = Object.values(ev.sets).filter(
    (s) => s.status === "minted",
  ).length;
  const unchanged = Object.values(ev.sets).filter(
    (s) => s.status === "skipped-unchanged",
  ).length;
  const refused = Object.values(ev.sets).filter(
    (s) => s.status === "refused",
  ).length;
  const failed = Object.values(ev.sets).filter(
    (s) => s.status === "failed",
  ).length;
  manifest.mint = {
    requested: true,
    fileKey: ev.fileKey,
    status:
      minted + unchanged > 0
        ? "ok"
        : failed > 0
          ? "ERROR"
          : refused > 0
            ? "REFUSED"
            : "PENDING",
    driver: "mcp",
    evidence: `${FIRST_PASS_DIR}/${exam}/mint-evidence.json`,
    message:
      `MCP-DRIVEN, one attempt per set, ${ev.recordedAt}, by ${ev.operator} into ${ev.fileName ?? ev.fileKey} (${ev.fileKey}): ` +
      `${minted} wrote to the canvas, ${unchanged} were SKIPPED as unchanged (the engine's specHash already matched the canvas node, so no byte moved), ` +
      `${refused} REFUSED by name, ${failed} died without one. ` +
      `Evidence, with the exact message and the sha256 of the bytes actually executed, at ${FIRST_PASS_DIR}/${exam}/mint-evidence.json.`,
  };
  writeManifest(manifest);
  return { failures, manifest, perSet };
}

/** Used by the exam runner's summary line. */
export const slugOf = slugify;
export const shaOf = sha;
