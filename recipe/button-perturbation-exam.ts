import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import {
  assignButtonSceneOwnership,
  buttonFontByOwnershipKey,
  buttonPlanNamesByOwnershipKey,
  buttonPlanRootChrome,
  BUTTON_SCENE_INVERSION_ROOT,
  BUTTON_V4_PAGE_ID,
  compileButtonBindingsByOwnershipKey,
  compileButtonComponentRefMap,
  compileButtonExpectedScenePlans,
  compileButtonTokenIdentityMap,
  decodeButtonHexTokenName,
  normalizeButtonObserveScene,
  type ButtonExpectedPlanSource,
} from "./button-scene-inversion.js";
import { canonicalJson } from "./normalize.js";
import {
  compareSceneToExpectedPlan,
  type SceneComparison,
  type SceneNodeSnapshot,
  type SceneVariableBinding,
} from "./scene-readback.js";

export const BUTTON_PERTURBATION_EXAM_VERSION = "button-perturbation-exam-v1";
export const BUTTON_PERTURBATION_EXAM_ROOT =
  "recipe/evidence/button-perturbation-exam-v1";
export const BUTTON_PERTURBATION_EXAM_RECEIPT_PATH = `${BUTTON_PERTURBATION_EXAM_ROOT}/receipt.json`;

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const readRawObserve = (path: string): SceneNodeSnapshot =>
  JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as SceneNodeSnapshot;

const walk = (
  node: SceneNodeSnapshot,
  visit: (node: SceneNodeSnapshot) => void,
): void => {
  visit(node);
  for (const child of node.children) walk(child, visit);
};

const firstComponent = (scene: SceneNodeSnapshot): SceneNodeSnapshot => {
  const component = scene.children.find((child) => child.type === "COMPONENT");
  if (!component) throw new TypeError("perturbation exam: no COMPONENT child");
  return component;
};

const colorBindings = (
  node: SceneNodeSnapshot,
): SceneVariableBinding[] =>
  (node.boundVariables ?? []).filter(
    (binding) =>
      binding.resolvedType === "COLOR" && binding.field === "fills.0.color",
  );

const normalizeOwned = (
  owned: SceneNodeSnapshot,
  plan: ButtonExpectedPlanSource,
): SceneNodeSnapshot =>
  normalizeButtonObserveScene(
    owned,
    compileButtonTokenIdentityMap(plan.compileRoot),
    compileButtonComponentRefMap(plan.compileRoot),
    buttonFontByOwnershipKey(plan.expectedScenePlan),
    undefined,
    buttonPlanNamesByOwnershipKey(plan.expectedScenePlan),
    buttonPlanRootChrome(plan.expectedScenePlan),
    compileButtonBindingsByOwnershipKey(plan.compileRoot),
  );

export type PerturbationClass =
  | "bound-token"
  | "literal-fill"
  | "padding"
  | "variant-on-existing-axis"
  | "renamed-node"
  | "rotation-no-source-vocabulary";

export type PerturbationDisposition =
  | "proposed-reviewed-input-diff"
  | "named-receipt";

export interface ProposedReviewedInputDiff {
  kind: "proposed-reviewed-input-diff";
  reviewBeforeWrite: true;
  applied: false;
  sceneChannel: string;
  reviewedInput: {
    identity: string | null;
    note: string;
  };
  from: unknown;
  to: unknown;
}

export interface PerturbationReceipt {
  kind: "named-receipt";
  reason: string;
  sceneChannel: string | null;
  from: unknown;
  to: unknown;
}

export interface PerturbationCaseResult {
  id: string;
  class: PerturbationClass;
  description: string;
  silentlyAbsorbed: boolean;
  deltaCount: {
    missing: number;
    extra: number;
    mismatched: number;
  };
  namedChannels: string[];
  disposition: PerturbationDisposition;
  proposal: ProposedReviewedInputDiff | null;
  receipt: PerturbationReceipt | null;
}

const applyBoundToken = (scene: SceneNodeSnapshot): {
  from: unknown;
  to: unknown;
  identityFrom: string | null;
  identityTo: string | null;
} => {
  const target = firstComponent(scene);
  const current = colorBindings(target)[0];
  if (!current)
    throw new TypeError("perturbation exam: no COLOR fill binding to rebind");
  let replacement: SceneVariableBinding | undefined;
  walk(scene, (node) => {
    if (replacement) return;
    for (const binding of colorBindings(node)) {
      if (binding.variableName !== current.variableName) {
        replacement = binding;
        return;
      }
    }
  });
  if (!replacement)
    throw new TypeError("perturbation exam: no distinct COLOR binding to rebind to");
  const from = current.variableName;
  current.variableName = replacement.variableName;
  return {
    from,
    to: replacement.variableName,
    identityFrom: decodeButtonHexTokenName(from) ?? null,
    identityTo: decodeButtonHexTokenName(replacement.variableName) ?? null,
  };
};

const applyLiteralFill = (scene: SceneNodeSnapshot): { from: unknown; to: unknown } => {
  const target = firstComponent(scene);
  const fill = target.fills?.[0];
  if (!fill || fill.type !== "SOLID" || typeof fill.color !== "string")
    throw new TypeError("perturbation exam: first variant has no solid fill");
  const from = fill.color;
  fill.color = "#ff00ffff";
  return { from, to: fill.color };
};

const applyPadding = (scene: SceneNodeSnapshot): { from: unknown; to: unknown } => {
  const target = firstComponent(scene);
  const from = {
    top: target.paddingTop,
    right: target.paddingRight,
    bottom: target.paddingBottom,
    left: target.paddingLeft,
  };
  target.paddingLeft = (target.paddingLeft ?? 0) + 8;
  return {
    from,
    to: { ...from, left: target.paddingLeft },
  };
};

const applyVariant = (scene: SceneNodeSnapshot): { from: unknown; to: unknown } => {
  const target = firstComponent(scene);
  const from = { ...(target.variantProperties ?? {}) };
  if (from.State === undefined)
    throw new TypeError("perturbation exam: component has no State axis");
  if (from.State === "hover")
    throw new TypeError("perturbation exam: first component is already hover");
  target.variantProperties = { ...from, State: "hover" };
  if (target.name.includes("State="))
    target.name = target.name.replace(/State=[^,]+/, "State=hover");
  return { from, to: { ...target.variantProperties } };
};

const applyRename = (scene: SceneNodeSnapshot): { from: unknown; to: unknown } => {
  const target = firstComponent(scene);
  const from = target.name;
  target.name = "Designer renamed this variant";
  return { from, to: target.name };
};

const applyRotation = (scene: SceneNodeSnapshot): { from: unknown; to: unknown } => {
  const target = firstComponent(scene) as SceneNodeSnapshot & {
    rotation?: number;
  };
  const from = target.rotation ?? 0;
  target.rotation = 15;
  return { from, to: target.rotation };
};

const classify = (
  editClass: PerturbationClass,
  comparison: SceneComparison,
  from: unknown,
  to: unknown,
  reviewed?: { identityFrom: string | null; identityTo: string | null },
): Pick<
  PerturbationCaseResult,
  "disposition" | "proposal" | "receipt" | "silentlyAbsorbed" | "namedChannels"
> => {
  const namedChannels = [
    ...new Set([
      ...comparison.mismatched.map((pair) => pair.expected.channel),
      ...comparison.missing.map((fact) => fact.channel),
      ...comparison.extra.map((fact) => fact.channel),
    ]),
  ].sort();
  const deltaCount =
    comparison.mismatched.length +
    comparison.missing.length +
    comparison.extra.length;
  if (editClass === "rotation-no-source-vocabulary") {
    return {
      silentlyAbsorbed: deltaCount === 0,
      namedChannels,
      disposition: "named-receipt",
      proposal: null,
      receipt: {
        kind: "named-receipt",
        reason:
          "SceneNodeSnapshot and expected-plan fact extraction have no rotation channel. A designer rotation on a live duplicate would not appear in inversion. Named: not expressible in the observe vocabulary; do not invent a rotation fact.",
        sceneChannel: null,
        from,
        to,
      },
    };
  }
  if (deltaCount === 0) {
    return {
      silentlyAbsorbed: true,
      namedChannels,
      disposition: "named-receipt",
      proposal: null,
      receipt: {
        kind: "named-receipt",
        reason: `${editClass} produced zero inversion deltas — silent absorption, which this exam forbids`,
        sceneChannel: null,
        from,
        to,
      },
    };
  }
  const sceneChannel = namedChannels[0] ?? editClass;
  return {
    silentlyAbsorbed: false,
    namedChannels,
    disposition: "proposed-reviewed-input-diff",
    proposal: {
      kind: "proposed-reviewed-input-diff",
      reviewBeforeWrite: true,
      applied: false,
      sceneChannel,
      reviewedInput: {
        identity: reviewed?.identityTo ?? reviewed?.identityFrom ?? null,
        note:
          reviewed?.identityFrom && reviewed.identityTo
            ? `rebind ${reviewed.identityFrom} → ${reviewed.identityTo}; review-before-write, not applied`
            : `scene channel ${sceneChannel} changed; review-before-write proposed diff, not applied`,
      },
      from,
      to,
    },
    receipt: null,
  };
};

export interface ButtonPerturbationExamReport {
  artifactVersion: typeof BUTTON_PERTURBATION_EXAM_VERSION;
  method: "scripted-observe-duplicate-vs-expected-plan";
  substrate: {
    kind: "committed-observe-duplicate";
    observePath: string;
    observeSha256: string;
    signedPageId: typeof BUTTON_V4_PAGE_ID;
    signedPageWritten: false;
    liveDuplicateCreated: false;
    figmaWrites: 0;
  };
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
  cases: PerturbationCaseResult[];
  silentlyAbsorbed: number;
  named: number;
  proposalsEmitted: number;
  receiptsEmitted: number;
  appliedAnyProposal: false;
}

export function runButtonPerturbationExam(): ButtonPerturbationExamReport {
  const plans = compileButtonExpectedScenePlans();
  const altitude = plans.find((plan) => plan.source === "altitude");
  if (!altitude) throw new TypeError("perturbation exam: altitude plan missing");
  const observePath = `${BUTTON_SCENE_INVERSION_ROOT}/observe-altitude.json.gz`;
  const observeBytes = readFileSync(observePath);
  const raw = readRawObserve(observePath);
  const edits: Array<{
    id: string;
    class: PerturbationClass;
    description: string;
    apply: (scene: SceneNodeSnapshot) => {
      from: unknown;
      to: unknown;
      identityFrom?: string | null;
      identityTo?: string | null;
    };
  }> = [
    {
      id: "bound-token",
      class: "bound-token",
      description:
        "Rebind the first variant's fills.0.color onto a different already-named COLOR variable",
      apply: applyBoundToken,
    },
    {
      id: "literal-fill",
      class: "literal-fill",
      description:
        "Paint a literal magenta over the first variant's solid fill (set-root fill is compile-carried chrome and would be absorbed)",
      apply: applyLiteralFill,
    },
    {
      id: "padding",
      class: "padding",
      description: "Increase the first variant's paddingLeft by 8",
      apply: applyPadding,
    },
    {
      id: "variant-on-existing-axis",
      class: "variant-on-existing-axis",
      description: "Retarget the first variant's existing State axis from default to hover",
      apply: applyVariant,
    },
    {
      id: "renamed-node",
      class: "renamed-node",
      description: "Rename the first variant away from its compile-carried name",
      apply: applyRename,
    },
    {
      id: "rotation-no-source-vocabulary",
      class: "rotation-no-source-vocabulary",
      description:
        "Rotate the first variant 15 degrees — no source vocabulary, no observe channel",
      apply: applyRotation,
    },
  ];
  const owned = assignButtonSceneOwnership(structuredClone(raw), altitude.compileRoot);
  const cases = edits.map((edit) => {
    const clone = structuredClone(owned);
    const applied = edit.apply(clone);
    const comparison = compareSceneToExpectedPlan(
      altitude.expectedScenePlan,
      normalizeOwned(clone, altitude),
    );
    const classified = classify(
      edit.class,
      comparison,
      applied.from,
      applied.to,
      "identityFrom" in applied
        ? {
            identityFrom: applied.identityFrom ?? null,
            identityTo: applied.identityTo ?? null,
          }
        : undefined,
    );
    return {
      id: edit.id,
      class: edit.class,
      description: edit.description,
      deltaCount: {
        missing: comparison.missing.length,
        extra: comparison.extra.length,
        mismatched: comparison.mismatched.length,
      },
      ...classified,
    };
  });
  const silentlyAbsorbed = cases.filter((row) => row.silentlyAbsorbed).length;
  const named = cases.filter((row) => !row.silentlyAbsorbed).length;
  return {
    artifactVersion: BUTTON_PERTURBATION_EXAM_VERSION,
    method: "scripted-observe-duplicate-vs-expected-plan",
    substrate: {
      kind: "committed-observe-duplicate",
      observePath,
      observeSha256: sha256(observeBytes),
      signedPageId: BUTTON_V4_PAGE_ID,
      signedPageWritten: false,
      liveDuplicateCreated: false,
      figmaWrites: 0,
    },
    humanGrade: "pending",
    gradeInvented: false,
    overallSuccess: false,
    cases,
    silentlyAbsorbed,
    named,
    proposalsEmitted: cases.filter((row) => row.proposal).length,
    receiptsEmitted: cases.filter((row) => row.receipt).length,
    appliedAnyProposal: false,
  };
}

export function writeButtonPerturbationExamReceipt(
  report = runButtonPerturbationExam(),
): ButtonPerturbationExamReport {
  mkdirSync(BUTTON_PERTURBATION_EXAM_ROOT, { recursive: true });
  writeFileSync(
    BUTTON_PERTURBATION_EXAM_RECEIPT_PATH,
    `${canonicalJson(report)}\n`,
  );
  return report;
}

const expressibleMustName = new Set<PerturbationClass>([
  "bound-token",
  "literal-fill",
  "padding",
  "variant-on-existing-axis",
  "renamed-node",
]);

export function validateButtonPerturbationExam(
  report: ButtonPerturbationExamReport,
): string[] {
  const failures: string[] = [];
  if (report.artifactVersion !== BUTTON_PERTURBATION_EXAM_VERSION)
    failures.push("artifact version drifted");
  if (report.humanGrade !== "pending" || report.gradeInvented !== false)
    failures.push("human grade invented");
  if (report.overallSuccess !== false)
    failures.push("overallSuccess flipped");
  if (report.appliedAnyProposal !== false)
    failures.push("proposal was applied");
  if (report.substrate.signedPageWritten !== false)
    failures.push("signed Button page was written");
  if (report.substrate.figmaWrites !== 0) failures.push("Figma writes occurred");
  if (report.substrate.signedPageId !== BUTTON_V4_PAGE_ID)
    failures.push("signed page id drifted");
  if (report.cases.length !== 6) failures.push("expected six scripted edits");
  for (const row of report.cases) {
    if (row.proposal?.applied === true)
      failures.push(`${row.id} applied a proposal`);
    if (row.proposal && row.proposal.reviewBeforeWrite !== true)
      failures.push(`${row.id} proposal is not review-before-write`);
    if (expressibleMustName.has(row.class) && row.silentlyAbsorbed)
      failures.push(`${row.id} was silently absorbed`);
    if (
      row.class === "rotation-no-source-vocabulary" &&
      row.disposition !== "named-receipt"
    )
      failures.push("rotation must be a named receipt, not a proposal");
  }
  if (report.cases.filter((row) => row.class === "rotation-no-source-vocabulary" && row.silentlyAbsorbed).length !== 1)
    failures.push("rotation must remain invisible to observe (named, not invented)");
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = process.argv.includes("--write")
    ? writeButtonPerturbationExamReceipt()
    : runButtonPerturbationExam();
  const failures = validateButtonPerturbationExam(report);
  if (failures.length)
    throw new Error(
      `Button perturbation exam refused:\n${failures.join("\n")}`,
    );
  process.stdout.write(`${canonicalJson({
    artifactVersion: report.artifactVersion,
    named: report.named,
    silentlyAbsorbed: report.silentlyAbsorbed,
    proposalsEmitted: report.proposalsEmitted,
    receiptsEmitted: report.receiptsEmitted,
    humanGrade: report.humanGrade,
    cases: report.cases.map((row) => ({
      id: row.id,
      disposition: row.disposition,
      silentlyAbsorbed: row.silentlyAbsorbed,
      namedChannels: row.namedChannels,
    })),
  })}\n`);
}
