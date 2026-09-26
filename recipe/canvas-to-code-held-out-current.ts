/** Current-engine replay beside the immutable held-out v1/v2 examinations.
 * Recording is explicit and only creates a new directory. Checking compares
 * every artifact byte and the complete historical inventory, including refusals.
 * These are computed-style accounting checks, not visual or product grades.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveCanvasFacts, type CanvasFactsDocument } from "./canvas-facts.js";
import { bridgeCanvasFactsToDump } from "./canvas-facts-to-dump.js";
import { runCanvasToCodeFromFacts } from "./canvas-to-code.js";
import {
  deriveHeldOutCanvasFacts,
  HELD_OUT_ROOT,
  HELD_OUT_SUBSTRATE,
} from "./canvas-to-code-held-out.js";
import { loadObserve } from "./canvas-to-code-held-out-v2.js";
import {
  HELD_OUT_V2_ROOT,
  HELD_OUT_V2_SUBJECTS,
  type HeldOutSubject,
} from "./canvas-to-code-held-out-v2-manifest.js";
import { canonicalJson } from "./normalize.js";
import { portableGzipSync } from "./portable-gzip.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CURRENT_HELD_OUT_ROOT =
  "recipe/evidence/canvas-to-code-held-out-current";
export const COHORTS = ["scratch", "designer"] as const;
export type Cohort = (typeof COHORTS)[number];
type Stage =
  "observe" | "canvas-facts" | "bridge" | "propose" | "emit" | "render";
export interface CurrentResult {
  id: string;
  source: unknown;
  outcome: "accounting-zero-silent" | "refused-by-name";
  refusal?: { stage: Stage; message: string };
  measurement?: {
    canvasFacts: CanvasFactsDocument["counts"];
    bridge: ReturnType<typeof bridgeCanvasFactsToDump>["counts"];
    render: Awaited<
      ReturnType<typeof runCanvasToCodeFromFacts>
    >["diff"]["counts"];
    cellsMounted: number;
    deltaSummaries: string[];
    proposalNotes: string[];
  };
}
const sha = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const json = (file: string, value: unknown): void => {
  writeFileSync(file, `${canonicalJson(value)}\n`);
};
const compressed = (file: string, value: unknown): void => {
  writeFileSync(
    file,
    portableGzipSync(Buffer.from(`${canonicalJson(value)}\n`), { level: 9 }),
  );
};

/** Includes unexpected files; symlinks cannot hide or substitute artifacts. */
export function artifactInventory(root: string): Record<string, string> {
  if (lstatSync(root).isSymbolicLink())
    throw new Error(`held-out current: symlink artifact ${root}`);
  const entries: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink())
        throw new Error(`held-out current: symlink artifact ${file}`);
      if (stat.isDirectory()) walk(file);
      else if (stat.isFile())
        entries[path.relative(root, file)] = sha(readFileSync(file));
      else throw new Error(`held-out current: non-file artifact ${file}`);
    }
  };
  walk(root);
  return entries;
}

export function assertArtifactInventory(
  expected: Record<string, string>,
  actual: Record<string, string>,
  label: string,
): void {
  const differences = [
    ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ]
    .sort()
    .filter((key) => expected[key] !== actual[key]);
  if (differences.length > 0)
    throw new Error(
      `held-out current: ${label} differs: ${differences.join(", ")}`,
    );
}

export function assertCoverage(
  cohort: Cohort,
  results: readonly CurrentResult[],
): void {
  assert.deepEqual(
    results.map((row) => row.id),
    cohort === "scratch"
      ? ["scratch-card"]
      : HELD_OUT_V2_SUBJECTS.map((subject) => subject.slug),
    "held-out current: every subject must appear exactly once in manifest order",
  );
  for (const row of results) {
    if (row.outcome === "accounting-zero-silent") {
      assert.ok(
        row.measurement && !row.refusal,
        `${row.id}: missing measurement or conflicting refusal`,
      );
      const { bridge, render, cellsMounted } = row.measurement;
      assert.equal(bridge.silent, 0);
      assert.equal(
        bridge.named + bridge.carried + bridge.receipted,
        bridge.facts,
      );
      assert.equal(render.silent, 0);
      assert.equal(render.unexplainedDeltas, 0);
      assert.equal(
        render.matched + render.namedDeltas + render.carried + render.receipted,
        render.facts,
      );
      assert.equal(cellsMounted, (row.source as { variants: number }).variants);
    } else {
      assert.equal(row.outcome, "refused-by-name");
      assert.ok(
        row.refusal?.stage && row.refusal.message && !row.measurement,
        `${row.id}: refusal must name the stage and reason`,
      );
    }
  }
}

async function replay(
  id: string,
  source: unknown,
  doc: CanvasFactsDocument,
  dir: string,
  contractName: string,
): Promise<CurrentResult> {
  compressed(path.join(dir, "canvas-facts.json.gz"), doc);
  let stage: Stage = "bridge";
  try {
    const bridge = bridgeCanvasFactsToDump(doc);
    assert.equal(bridge.counts.silent, 0, `${id}: silent bridge facts`);
    compressed(path.join(dir, "bridge.json.gz"), bridge);
    stage = "emit";
    const { build, diff, cellsMounted } = await runCanvasToCodeFromFacts(
      doc,
      path.join(dir, "attempt"),
      {
        contractFileName: `${contractName}.contract.proposed.json`,
        regenerateHint:
          "tsx recipe/canvas-to-code-held-out-current.ts --record-to <new-directory>",
      },
    );
    stage = "render";
    assert.equal(diff.counts.silent, 0, `${id}: silent render facts`);
    assert.equal(
      diff.counts.unexplainedDeltas,
      0,
      `${id}: unexplained render differences`,
    );
    compressed(path.join(dir, "render-ledger.json.gz"), diff);
    compressed(path.join(dir, "proposal.json.gz"), build.proposal);
    return {
      id,
      source,
      outcome: "accounting-zero-silent",
      measurement: {
        canvasFacts: doc.counts,
        bridge: bridge.counts,
        render: diff.counts,
        cellsMounted,
        deltaSummaries: diff.deltaSummaries,
        proposalNotes: build.proposalNotes,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (stage === "emit")
      stage = /could not be proposed|propose/i.test(message)
        ? "propose"
        : /render|chromium|mount/i.test(message)
          ? "render"
          : "emit";
    return {
      id,
      source,
      outcome: "refused-by-name",
      refusal: { stage, message },
    };
  }
}

async function replayDesigner(
  subject: HeldOutSubject,
  dir: string,
): Promise<CurrentResult> {
  const historical = path.join(REPO, HELD_OUT_V2_ROOT, subject.slug);
  if (subject.absentOnCanvas) {
    const absent = subject.absentOnCanvas;
    return {
      id: subject.slug,
      source: { ...subject, variants: 0 },
      outcome: "refused-by-name",
      refusal: {
        stage: "observe",
        message: `set-not-on-canvas: ${absent.reason} (measured ${absent.measuredAt}, file version ${absent.fileVersion})`,
      },
    };
  }
  const refusalFile = path.join(historical, "observe-refusal.json");
  if (
    existsSync(refusalFile) &&
    !existsSync(path.join(historical, "observe.json.gz"))
  ) {
    const refusal = JSON.parse(readFileSync(refusalFile, "utf8")) as {
      code: string;
      message: string;
      fileVersion: string;
    };
    return {
      id: subject.slug,
      source: { ...subject, fileVersion: refusal.fileVersion, variants: 0 },
      outcome: "refused-by-name",
      refusal: {
        stage: "observe",
        message: `${refusal.code}: ${refusal.message}`,
      },
    };
  }
  // Authentication failures are fatal, not converted into an accepted refusal.
  const observed = loadObserve(subject);
  compressed(path.join(dir, "observe-meta.json.gz"), observed.meta);
  const source = {
    ...subject,
    variants: observed.meta.variants,
    fileVersion: observed.meta.fileVersion,
    observePath: observed.observePath,
    observeSha256: observed.observeSha256,
  };
  let doc: CanvasFactsDocument;
  try {
    doc = deriveCanvasFacts(observed.scene, {
      observePath: observed.observePath,
      observeSha256: observed.observeSha256,
    });
  } catch (error) {
    return {
      id: subject.slug,
      source,
      outcome: "refused-by-name",
      refusal: {
        stage: "canvas-facts",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  return replay(subject.slug, source, doc, dir, subject.archetype);
}

function historicalInventory(cohort: Cohort): Record<string, string> {
  return artifactInventory(
    path.join(REPO, cohort === "scratch" ? HELD_OUT_ROOT : HELD_OUT_V2_ROOT),
  );
}

/** Create-only: neither a frozen lineage nor an existing recording is replaced. */
export function prepareRecording(root: string): void {
  let ancestor = path.resolve(root);
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = path.resolve(
    realpathSync(ancestor),
    path.relative(ancestor, path.resolve(root)),
  );
  for (const frozen of [HELD_OUT_ROOT, HELD_OUT_V2_ROOT]) {
    const relative = path.relative(path.join(REPO, frozen), resolved);
    if (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw new Error("held-out current: cannot record inside frozen evidence");
  }
  const recipeRelative = path.relative(path.join(REPO, "recipe"), resolved);
  if (
    !recipeRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(recipeRelative) &&
    recipeRelative.split(path.sep).some((part) => /-v\d+(?:\b|[-.])/.test(part))
  )
    throw new Error(
      "held-out current: cannot record inside a versioned recipe lineage",
    );
  if (existsSync(root))
    throw new Error(
      "held-out current: recording directory already exists; choose a new directory",
    );
  mkdirSync(path.dirname(root), { recursive: true });
  mkdirSync(root);
}

export async function recordCohort(
  cohort: Cohort,
  root: string,
): Promise<CurrentResult[]> {
  const history = historicalInventory(cohort);
  const dir = path.join(root, cohort);
  mkdirSync(dir);
  json(path.join(dir, "historical-sha256.json"), history);
  const results: CurrentResult[] = [];
  const subjects = cohort === "scratch" ? [null] : HELD_OUT_V2_SUBJECTS;
  for (const subject of subjects) {
    const id = subject?.slug ?? "scratch-card";
    const subjectDir = path.join(dir, id);
    mkdirSync(subjectDir);
    const row = subject
      ? await replayDesigner(subject, subjectDir)
      : await replay(
          id,
          HELD_OUT_SUBSTRATE,
          deriveHeldOutCanvasFacts(),
          subjectDir,
          "card",
        );
    results.push(row);
    process.stdout.write(
      `${cohort}/${id}: ${row.outcome}${row.refusal ? ` (${row.refusal.stage})` : `; ${row.measurement!.cellsMounted} mounted`}\n`,
    );
  }
  assertCoverage(cohort, results);
  assertArtifactInventory(
    history,
    historicalInventory(cohort),
    "historical evidence changed during replay",
  );
  json(path.join(dir, "results.json"), results);
  return results;
}

export async function checkCohort(
  cohort: Cohort,
  baselineRoot = path.join(REPO, CURRENT_HELD_OUT_ROOT),
): Promise<void> {
  const expected = path.join(baselineRoot, cohort);
  const history = JSON.parse(
    readFileSync(path.join(expected, "historical-sha256.json"), "utf8"),
  ) as Record<string, string>;
  assertArtifactInventory(
    history,
    historicalInventory(cohort),
    "frozen historical evidence",
  );
  const work = mkdtempSync(path.join(os.tmpdir(), "held-out-current-"));
  try {
    await recordCohort(cohort, work);
    assertArtifactInventory(
      artifactInventory(expected),
      artifactInventory(path.join(work, cohort)),
      `${cohort} current-engine replay`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const main = async (): Promise<void> => {
    const args = process.argv.slice(2);
    const recordAt = args.indexOf("--record-to");
    const cohortAt = args.indexOf("--cohort");
    const selected = cohortAt < 0 ? COHORTS : [args[cohortAt + 1]];
    if (selected.some((cohort) => !COHORTS.includes(cohort as Cohort)))
      throw new Error("unknown held-out cohort");
    if (recordAt >= 0) {
      const destination = args[recordAt + 1];
      if (!destination || destination.startsWith("--"))
        throw new Error("--record-to requires a new directory");
      const root = path.resolve(destination);
      prepareRecording(root);
      for (const cohort of selected) await recordCohort(cohort as Cohort, root);
    } else {
      if (!args.includes("--check"))
        throw new Error("use --check or --record-to <new-directory>");
      for (const cohort of selected) await checkCohort(cohort as Cohort);
    }
  };
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
