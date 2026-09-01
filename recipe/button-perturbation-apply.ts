/**
 * Stage 3e apply half of the Button perturbation exam (docs/35 §5):
 * approve-then-apply a named, already-proposed class onto the offline
 * observe / canvas-facts representation, then re-run canvas→code.
 *
 * Review-before-write is absolute: apply refuses unless the committed
 * approval receipt carries `approved: true` and the proposal sha matches.
 * Unapproved proposals never write the scene. Zero Figma writes.
 *
 *   tsx recipe/button-perturbation-apply.ts --write   apply + pipeline + evidence
 *   tsx recipe/button-perturbation-apply.ts --check   recompute vs committed receipt
 */
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import {
  BUTTON_PERTURBATION_EXAM_RECEIPT_PATH,
  runButtonPerturbationExam,
  type ButtonPerturbationExamReport,
  type ProposedReviewedInputDiff,
} from "./button-perturbation-exam.js";
import { BUTTON_V4_PAGE_ID } from "./button-scene-inversion.js";
import { deriveCanvasFacts, sha256OfBytes } from "./canvas-facts.js";
import {
  runCanvasToCodeFromFacts,
  type RenderDiffResult,
} from "./canvas-to-code.js";
import { BUTTON_OBSERVE_PATH } from "./emit-canvas-facts.js";
import { canonicalJson } from "./normalize.js";
import type { SceneNodeSnapshot } from "./scene-readback.js";

export const BUTTON_PERTURBATION_APPLY_VERSION = "button-perturbation-apply-v1";
export const BUTTON_PERTURBATION_APPLY_ROOT =
  "recipe/evidence/button-perturbation-apply-v1";
export const BUTTON_PERTURBATION_APPLY_RECEIPT_PATH = `${BUTTON_PERTURBATION_APPLY_ROOT}/receipt.json`;
export const BUTTON_PERTURBATION_APPLY_APPROVAL_PATH = `${BUTTON_PERTURBATION_APPLY_ROOT}/approval.json`;
export const BUTTON_PERTURBATION_APPLY_REVIEWED_INPUT_PATH = `${BUTTON_PERTURBATION_APPLY_ROOT}/applied-reviewed-input.json`;
export const BUTTON_PERTURBATION_APPLY_LEDGER_PATH = `${BUTTON_PERTURBATION_APPLY_ROOT}/render-ledger.json.gz`;

export const APPLY_CLASS = "padding" as const;

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const readRawObserve = (observePath: string): SceneNodeSnapshot =>
  JSON.parse(
    gunzipSync(readFileSync(observePath)).toString("utf8"),
  ) as SceneNodeSnapshot;

const firstComponent = (scene: SceneNodeSnapshot): SceneNodeSnapshot => {
  const component = scene.children.find((child) => child.type === "COMPONENT");
  if (!component)
    throw new TypeError("perturbation apply: no COMPONENT child");
  return component;
};

export type PaddingBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const isPaddingBox = (value: unknown): value is PaddingBox => {
  if (value === null || typeof value !== "object") return false;
  const box = value as Record<string, unknown>;
  return (
    typeof box.top === "number" &&
    typeof box.right === "number" &&
    typeof box.bottom === "number" &&
    typeof box.left === "number"
  );
};

export const OVERLAY_PERTURBATION_BLOCKER =
  "Tooltip, Menu, and Dialog have no committed SceneNodeSnapshot observe under recipe/evidence/** (no observe*.json.gz / observe*.json). A read-only MCP extract was not taken for those pages — none was a named in-scope substrate. Named: overlay perturbation exam is blocked until a committed observe exists.";

export const APPLY_REFUSAL_UNAPPROVED =
  "review-before-write: apply refused — proposal is not approved";

export interface PerturbationApplyApproval {
  kind: "perturbation-apply-approval";
  artifactVersion: typeof BUTTON_PERTURBATION_APPLY_VERSION;
  class: typeof APPLY_CLASS;
  approved: boolean;
  reviewBeforeWrite: true;
  proposalId: typeof APPLY_CLASS;
  proposalSha256: string;
  examReceiptPath: typeof BUTTON_PERTURBATION_EXAM_RECEIPT_PATH;
  signedPageWritten: false;
  figmaWrites: 0;
}

export interface AppliedReviewedInput {
  kind: "applied-reviewed-input";
  class: typeof APPLY_CLASS;
  representation: "observe-duplicate-scene";
  fixtureTableWrite: false;
  fixtureTableReason: string;
  unboundFields: string[];
  unbindReason: string;
  sceneChannel: string;
  from: PaddingBox;
  to: PaddingBox;
  applied: true;
  appliedTwiceNoOp: boolean;
}

export interface ButtonPerturbationApplyReceipt {
  artifactVersion: typeof BUTTON_PERTURBATION_APPLY_VERSION;
  method: "approve-then-apply-observe-duplicate → canvas-facts → bridge → emit → chromium computed-style diff";
  class: typeof APPLY_CLASS;
  approval: PerturbationApplyApproval;
  proposal: ProposedReviewedInputDiff;
  appliedReviewedInput: AppliedReviewedInput;
  substrate: {
    observePath: string;
    observeSha256: string;
    appliedObserveSha256: string;
    signedPageId: typeof BUTTON_V4_PAGE_ID;
    signedPageWritten: false;
    liveDuplicateCreated: false;
    figmaWrites: 0;
  };
  fixedPoint: {
    secondApplyNoOp: true;
    appliedSceneSha256: string;
    secondApplySceneSha256: string;
  };
  render: RenderDiffResult["counts"] & { cellsMounted: number };
  deltaSummaries: string[];
  checkbox: {
    status: "observe-committed";
    observePath: string;
    exam: "recipe:checkbox:perturbation:check";
  };
  overlay: {
    status: "named-blocker";
    blocker: string;
  };
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
}

export function paddingProposalFromExam(
  exam: ButtonPerturbationExamReport = runButtonPerturbationExam(),
): ProposedReviewedInputDiff {
  const row = exam.cases.find((item) => item.id === APPLY_CLASS);
  if (!row?.proposal)
    throw new TypeError("perturbation apply: padding proposal missing");
  if (row.proposal.applied !== false)
    throw new TypeError("perturbation apply: exam proposal must stay unapplied");
  if (!isPaddingBox(row.proposal.from) || !isPaddingBox(row.proposal.to))
    throw new TypeError("perturbation apply: padding proposal is not a box");
  return row.proposal;
}

export function approvalForProposal(
  proposal: ProposedReviewedInputDiff,
  approved: boolean,
): PerturbationApplyApproval {
  return {
    kind: "perturbation-apply-approval",
    artifactVersion: BUTTON_PERTURBATION_APPLY_VERSION,
    class: APPLY_CLASS,
    approved,
    reviewBeforeWrite: true,
    proposalId: APPLY_CLASS,
    proposalSha256: sha256(canonicalJson(proposal)),
    examReceiptPath: BUTTON_PERTURBATION_EXAM_RECEIPT_PATH,
    signedPageWritten: false,
    figmaWrites: 0,
  };
}

export function assertApplyApproved(
  approval: PerturbationApplyApproval,
  proposal: ProposedReviewedInputDiff,
): void {
  if (approval.approved !== true) throw new Error(APPLY_REFUSAL_UNAPPROVED);
  if (approval.reviewBeforeWrite !== true)
    throw new Error(
      "review-before-write: apply refused — approval is not review-before-write",
    );
  if (approval.class !== APPLY_CLASS || approval.proposalId !== APPLY_CLASS)
    throw new Error("review-before-write: apply refused — class is not padding");
  const expected = sha256(canonicalJson(proposal));
  if (approval.proposalSha256 !== expected)
    throw new Error(
      "review-before-write: apply refused — approval sha does not match the live padding proposal",
    );
}

const PADDING_FIELDS = [
  ["paddingTop", "top"],
  ["paddingRight", "right"],
  ["paddingBottom", "bottom"],
  ["paddingLeft", "left"],
] as const;

/**
 * Write the approved padding box onto the first COMPONENT. Sides whose
 * literal value left a still-bound token are UNBOUND — Figma does the same
 * when a designer types a new padding over a variable. Leaving both
 * paddingLeft=24 and paddingRight=16 bound to size-16 makes the bridge
 * refuse (one variable, two resolved values).
 */
export function applyAbsolutePadding(
  scene: SceneNodeSnapshot,
  to: PaddingBox,
  from?: PaddingBox,
): { scene: SceneNodeSnapshot; unboundFields: string[] } {
  const clone = structuredClone(scene);
  const target = firstComponent(clone);
  const prior: PaddingBox = from ?? {
    top: target.paddingTop ?? 0,
    right: target.paddingRight ?? 0,
    bottom: target.paddingBottom ?? 0,
    left: target.paddingLeft ?? 0,
  };
  const unboundFields: string[] = [];
  for (const [field, key] of PADDING_FIELDS) {
    target[field] = to[key];
    if (prior[key] !== to[key]) {
      const before = target.boundVariables?.length ?? 0;
      target.boundVariables = (target.boundVariables ?? []).filter(
        (binding) => binding.field !== field,
      );
      if ((target.boundVariables?.length ?? 0) !== before)
        unboundFields.push(field);
    }
  }
  return { scene: clone, unboundFields };
}

export function applyApprovedPaddingToObserve(
  approval: PerturbationApplyApproval,
  proposal: ProposedReviewedInputDiff = paddingProposalFromExam(),
  observePath: string = BUTTON_OBSERVE_PATH,
): {
  original: SceneNodeSnapshot;
  applied: SceneNodeSnapshot;
  secondApply: SceneNodeSnapshot;
  to: PaddingBox;
  from: PaddingBox;
  unboundFields: string[];
} {
  assertApplyApproved(approval, proposal);
  if (!isPaddingBox(proposal.to) || !isPaddingBox(proposal.from))
    throw new TypeError("perturbation apply: padding proposal is not a box");
  const original = readRawObserve(observePath);
  const first = applyAbsolutePadding(original, proposal.to, proposal.from);
  const second = applyAbsolutePadding(
    first.scene,
    proposal.to,
    proposal.from,
  );
  return {
    original,
    applied: first.scene,
    secondApply: second.scene,
    to: proposal.to,
    from: proposal.from,
    unboundFields: first.unboundFields,
  };
}

const FIXTURE_TABLE_REASON =
  "asymmetric paddingLeft 16→24 is not expressible as the symmetric paddingX token in recipe/fixtures/library-buttons.ts without inventing right=24; applied to the observe/canvas-facts representation only";

export function buildAppliedReviewedInput(
  proposal: ProposedReviewedInputDiff,
  secondApplyNoOp: boolean,
  unboundFields: string[],
): AppliedReviewedInput {
  if (!isPaddingBox(proposal.from) || !isPaddingBox(proposal.to))
    throw new TypeError("perturbation apply: padding proposal is not a box");
  return {
    kind: "applied-reviewed-input",
    class: APPLY_CLASS,
    representation: "observe-duplicate-scene",
    fixtureTableWrite: false,
    fixtureTableReason: FIXTURE_TABLE_REASON,
    unboundFields,
    unbindReason:
      "paddingLeft left the bound size-16 token; Figma unbinds a side when its literal no longer matches the variable. Named, not invented.",
    sceneChannel: proposal.sceneChannel,
    from: proposal.from,
    to: proposal.to,
    applied: true,
    appliedTwiceNoOp: secondApplyNoOp,
  };
}

export function validateButtonPerturbationApply(
  receipt: ButtonPerturbationApplyReceipt,
): string[] {
  const failures: string[] = [];
  if (receipt.artifactVersion !== BUTTON_PERTURBATION_APPLY_VERSION)
    failures.push("artifact version drifted");
  if (receipt.class !== APPLY_CLASS) failures.push("applied class is not padding");
  if (receipt.humanGrade !== "pending" || receipt.gradeInvented !== false)
    failures.push("human grade invented");
  if (receipt.overallSuccess !== false) failures.push("overallSuccess flipped");
  if (receipt.approval.approved !== true)
    failures.push("receipt approval is not approved");
  if (receipt.proposal.applied !== false)
    failures.push("exam proposal record was mutated to applied");
  if (receipt.appliedReviewedInput.applied !== true)
    failures.push("reviewed-input apply flag is not true");
  if (receipt.appliedReviewedInput.fixtureTableWrite !== false)
    failures.push("fixture table was written");
  if (receipt.substrate.signedPageWritten !== false)
    failures.push("signed Button page was written");
  if (receipt.substrate.figmaWrites !== 0) failures.push("Figma writes occurred");
  if (receipt.substrate.signedPageId !== BUTTON_V4_PAGE_ID)
    failures.push("signed page id drifted");
  if (receipt.fixedPoint.secondApplyNoOp !== true)
    failures.push("second apply was not a no-op");
  if (
    receipt.fixedPoint.appliedSceneSha256 !==
    receipt.fixedPoint.secondApplySceneSha256
  )
    failures.push("fixed-point scene hashes drifted");
  if (receipt.render.silent !== 0)
    failures.push("re-render ledger has silent losses");
  if (receipt.render.unexplainedDeltas !== 0)
    failures.push("re-render ledger has unexplained deltas");
  if (receipt.overlay.status !== "named-blocker")
    failures.push("overlay blocker was dropped");
  return failures;
}

export async function runButtonPerturbationApply(options: {
  approval: PerturbationApplyApproval;
  write: boolean;
}): Promise<ButtonPerturbationApplyReceipt> {
  const proposal = paddingProposalFromExam();
  const scenes = applyApprovedPaddingToObserve(options.approval, proposal);
  const appliedCanon = canonicalJson(scenes.applied);
  const secondCanon = canonicalJson(scenes.secondApply);
  if (appliedCanon !== secondCanon)
    throw new Error(
      "perturbation apply: second apply of the approved padding box was not a no-op",
    );
  const observeBytes = readFileSync(BUTTON_OBSERVE_PATH);
  const appliedBytes = Buffer.from(`${appliedCanon}\n`, "utf8");
  const appliedDoc = deriveCanvasFacts(scenes.applied, {
    observePath: `${BUTTON_PERTURBATION_APPLY_ROOT}/applied-observe-duplicate`,
    observeSha256: sha256(appliedBytes),
  });
  const extraNotes = [
    `button-perturbation-apply: approved padding class wrote first-variant layout.padding ${canonicalJson(scenes.from)} → ${canonicalJson(scenes.to)} on the observe duplicate and unbound ${scenes.unboundFields.join(", ") || "no fields"} so size-16 does not resolve to two values; the emitter's size token is symmetric paddingX — any computed-style disagreement on padding is a named apply delta, not a silent loss`,
  ];
  const workRoot = options.write
    ? path.join(os.tmpdir(), `button-perturbation-apply-${process.pid}`)
    : mkdtempSync(path.join(os.tmpdir(), "button-perturbation-apply-check-"));
  mkdirSync(workRoot, { recursive: true });
  try {
    const pipeline = await runCanvasToCodeFromFacts(appliedDoc, workRoot, {
      extraNotes,
      regenerateHint: "tsx recipe/button-perturbation-apply.ts --write",
      contractFileName: "button.applied.contract.proposed.json",
    });
    const appliedReviewedInput = buildAppliedReviewedInput(
      proposal,
      true,
      scenes.unboundFields,
    );
    const receipt: ButtonPerturbationApplyReceipt = {
      artifactVersion: BUTTON_PERTURBATION_APPLY_VERSION,
      method:
        "approve-then-apply-observe-duplicate → canvas-facts → bridge → emit → chromium computed-style diff",
      class: APPLY_CLASS,
      approval: options.approval,
      proposal,
      appliedReviewedInput,
      substrate: {
        observePath: BUTTON_OBSERVE_PATH,
        observeSha256: sha256OfBytes(observeBytes),
        appliedObserveSha256: sha256(appliedBytes),
        signedPageId: BUTTON_V4_PAGE_ID,
        signedPageWritten: false,
        liveDuplicateCreated: false,
        figmaWrites: 0,
      },
      fixedPoint: {
        secondApplyNoOp: true,
        appliedSceneSha256: sha256(appliedCanon),
        secondApplySceneSha256: sha256(secondCanon),
      },
      render: { ...pipeline.diff.counts, cellsMounted: pipeline.cellsMounted },
      deltaSummaries: pipeline.diff.deltaSummaries,
      checkbox: {
        status: "observe-committed",
        observePath:
          "recipe/evidence/checkbox-scene-observe-v1/observe-astryx.json.gz",
        exam: "recipe:checkbox:perturbation:check",
      },
      overlay: {
        status: "named-blocker",
        blocker: OVERLAY_PERTURBATION_BLOCKER,
      },
      humanGrade: "pending",
      gradeInvented: false,
      overallSuccess: false,
    };
    const failures = validateButtonPerturbationApply(receipt);
    if (failures.length)
      throw new Error(
        `Button perturbation apply refused:\n${failures.join("\n")}`,
      );
    if (options.write) {
      mkdirSync(path.resolve(REPO, BUTTON_PERTURBATION_APPLY_ROOT), {
        recursive: true,
      });
      writeFileSync(
        path.resolve(REPO, BUTTON_PERTURBATION_APPLY_APPROVAL_PATH),
        `${canonicalJson(options.approval)}\n`,
      );
      writeFileSync(
        path.resolve(REPO, BUTTON_PERTURBATION_APPLY_REVIEWED_INPUT_PATH),
        `${canonicalJson(appliedReviewedInput)}\n`,
      );
      writeFileSync(
        path.resolve(REPO, BUTTON_PERTURBATION_APPLY_LEDGER_PATH),
        gzipSync(
          Buffer.from(
            `${canonicalJson({
              ledger: pipeline.diff.ledger,
              counts: pipeline.diff.counts,
            })}\n`,
            "utf8",
          ),
          { level: 9 },
        ),
      );
      writeFileSync(
        path.resolve(REPO, BUTTON_PERTURBATION_APPLY_RECEIPT_PATH),
        `${canonicalJson(receipt)}\n`,
      );
    } else {
      const committed = JSON.parse(
        readFileSync(
          path.resolve(REPO, BUTTON_PERTURBATION_APPLY_RECEIPT_PATH),
          "utf8",
        ),
      ) as ButtonPerturbationApplyReceipt;
      if (canonicalJson(committed) !== canonicalJson(receipt))
        throw new Error(
          "perturbation apply: committed receipt.json does not match recomputation — re-run `tsx recipe/button-perturbation-apply.ts --write` and review the diff",
        );
    }
    return receipt;
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

export function readCommittedApplyApproval(): PerturbationApplyApproval {
  return JSON.parse(
    readFileSync(
      path.resolve(REPO, BUTTON_PERTURBATION_APPLY_APPROVAL_PATH),
      "utf8",
    ),
  ) as PerturbationApplyApproval;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes("--write");
  const proposal = paddingProposalFromExam();
  const approval = write
    ? approvalForProposal(proposal, true)
    : readCommittedApplyApproval();
  runButtonPerturbationApply({ approval, write })
    .then((receipt) => {
      process.stdout.write(
        `${canonicalJson({
          artifactVersion: receipt.artifactVersion,
          mode: write ? "written" : "checked",
          class: receipt.class,
          approved: receipt.approval.approved,
          fixedPoint: receipt.fixedPoint.secondApplyNoOp,
          render: receipt.render,
          checkbox: receipt.checkbox.status,
          overlay: receipt.overlay.status,
          overallSuccess: receipt.overallSuccess,
        })}\n`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
