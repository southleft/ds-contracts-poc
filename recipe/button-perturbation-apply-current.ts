/** Current-engine replay of the approved offline padding perturbation.
 * The v1 examination stays immutable. This gate authenticates its inputs and
 * compares every current generated artifact, residual and refusal byte.
 * Recording creates a new directory; it never overwrites historical evidence.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyApprovedPaddingToObserve,
  BUTTON_PERTURBATION_APPLY_RECEIPT_PATH,
  BUTTON_PERTURBATION_APPLY_ROOT,
  paddingProposalFromExam,
  readCommittedApplyApproval,
} from "./button-perturbation-apply.js";
import { BUTTON_PERTURBATION_EXAM_RECEIPT_PATH } from "./button-perturbation-exam.js";
import { deriveCanvasFacts } from "./canvas-facts.js";
import { runCanvasToCodeFromFacts } from "./canvas-to-code.js";
import {
  artifactInventory,
  assertArtifactInventory,
  prepareRecording,
} from "./canvas-to-code-held-out-current.js";
import { BUTTON_OBSERVE_PATH } from "./emit-canvas-facts.js";
import { canonicalJson } from "./normalize.js";
import { portableGzipSync } from "./portable-gzip.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CURRENT_PERTURBATION_ROOT = "recipe/evidence/button-perturbation-apply-current";
const sha = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const json = (file: string, value: unknown): void => {
  writeFileSync(file, `${canonicalJson(value)}\n`);
};

/** Pin both frozen examinations and the exact captured scene they consume. */
export function perturbationHistoricalInventory(): Record<string, string> {
  const inventory: Record<string, string> = {};
  for (const root of [BUTTON_PERTURBATION_APPLY_ROOT, path.dirname(BUTTON_PERTURBATION_EXAM_RECEIPT_PATH)]) {
    for (const [file, hash] of Object.entries(artifactInventory(path.join(REPO, root))))
      inventory[`${root}/${file}`] = hash;
  }
  inventory[BUTTON_OBSERVE_PATH] = sha(readFileSync(path.join(REPO, BUTTON_OBSERVE_PATH)));
  return inventory;
}

export async function recordCurrentPerturbation(root: string): Promise<void> {
  prepareRecording(root);
  const history = perturbationHistoricalInventory();
  const original = JSON.parse(readFileSync(path.join(REPO, BUTTON_PERTURBATION_APPLY_RECEIPT_PATH), "utf8"));
  const approval = readCommittedApplyApproval();
  const proposal = paddingProposalFromExam();
  assert.deepEqual(approval, original.approval, "the recorded approval changed");
  assert.deepEqual(proposal, original.proposal, "the approved proposal changed");
  assert.equal(history[BUTTON_OBSERVE_PATH], original.substrate.observeSha256, "the captured scene changed");
  const scenes = applyApprovedPaddingToObserve(approval, proposal);
  assert.deepEqual(scenes.secondApply, scenes.applied, "the approved apply is not a fixed point");
  const appliedBytes = Buffer.from(`${canonicalJson(scenes.applied)}\n`);
  assert.equal(sha(appliedBytes), original.substrate.appliedObserveSha256, "the applied scene changed");
  const doc = deriveCanvasFacts(scenes.applied, {
    observePath: `${BUTTON_PERTURBATION_APPLY_ROOT}/applied-observe-duplicate`,
    observeSha256: sha(appliedBytes),
  });
  const extraNotes = [
    `button-perturbation-apply: approved padding class wrote first-variant layout.padding ${canonicalJson(scenes.from)} → ${canonicalJson(scenes.to)} on the observe duplicate and unbound ${scenes.unboundFields.join(", ") || "no fields"} so size-16 does not resolve to two values; the emitter's size token is symmetric paddingX — any computed-style disagreement on padding is a named apply delta, not a silent loss`,
  ];
  const pipeline = await runCanvasToCodeFromFacts(doc, path.join(root, "attempt"), {
    extraNotes,
    regenerateHint: "tsx recipe/button-perturbation-apply-current.ts --record-to <new-directory>",
    contractFileName: "button.applied.contract.proposed.json",
  });
  const { counts } = pipeline.diff;
  assert.equal(counts.facts, original.render.facts, "the replay must retain every historical fact");
  assert.equal(pipeline.cellsMounted, original.render.cellsMounted, "the replay must mount every historical variant");
  assert.equal(counts.silent, 0);
  assert.equal(counts.unexplainedDeltas, 0);
  assert.equal(counts.matched + counts.namedDeltas + counts.carried + counts.receipted, counts.facts);
  json(path.join(root, "historical-sha256.json"), history);
  json(path.join(root, "result.json"), {
    method: "approved offline observe duplicate through current canvas-to-code engine",
    source: {
      observePath: BUTTON_OBSERVE_PATH,
      observeSha256: history[BUTTON_OBSERVE_PATH],
      appliedObserveSha256: sha(appliedBytes),
      approvalSha256: sha(canonicalJson(approval)),
      proposalSha256: sha(canonicalJson(proposal)),
    },
    fixedPoint: { secondApplyNoOp: true, appliedSceneSha256: sha(canonicalJson(scenes.applied)) },
    render: { ...counts, cellsMounted: pipeline.cellsMounted },
    deltaSummaries: pipeline.diff.deltaSummaries,
    proposalNotes: pipeline.build.proposalNotes,
  });
  writeFileSync(path.join(root, "render-ledger.json.gz"), portableGzipSync(Buffer.from(`${canonicalJson(pipeline.diff)}\n`), { level: 9 }));
  assertArtifactInventory(history, perturbationHistoricalInventory(), "frozen perturbation evidence changed during replay");
}

export async function checkCurrentPerturbation(baseline = path.join(REPO, CURRENT_PERTURBATION_ROOT)): Promise<void> {
  const history = JSON.parse(readFileSync(path.join(baseline, "historical-sha256.json"), "utf8"));
  assertArtifactInventory(history, perturbationHistoricalInventory(), "frozen perturbation evidence");
  const work = mkdtempSync(path.join(os.tmpdir(), "perturbation-current-"));
  try {
    const recording = path.join(work, "recording");
    await recordCurrentPerturbation(recording);
    assertArtifactInventory(artifactInventory(baseline), artifactInventory(recording), "perturbation current-engine replay");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const main = async (): Promise<void> => {
    const args = process.argv.slice(2), recordAt = args.indexOf("--record-to");
    if (recordAt >= 0) {
      const target = args[recordAt + 1];
      if (!target || target.startsWith("--")) throw Error("--record-to requires a new directory");
      await recordCurrentPerturbation(path.resolve(target));
    } else {
      if (!args.includes("--check")) throw Error("use --check or --record-to <new-directory>");
      await checkCurrentPerturbation();
    }
    process.stdout.write(`perturbation current replay: frozen inputs authenticated; current artifacts ${recordAt >= 0 ? "recorded" : "checked"}; no product grade\n`);
  };
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
