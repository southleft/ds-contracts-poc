/**
 * One named-class perturbation exam on the committed Astryx Checkbox
 * observe (docs/35 §5 stage 3e). The substrate is the read-only MCP extract
 * of Scratch page 198:77718 set 198:77977 — no compile expected-plan exists
 * for checkbox, so this exam is self-baseline: facts from the observe vs
 * the same observe after a scripted padding edit.
 *
 * Overlay archetypes remain a named blocker (no committed observe).
 *
 *   tsx recipe/checkbox-perturbation-exam.ts --write
 *   tsx recipe/checkbox-perturbation-exam.ts --check  (via the gate)
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { deriveCanvasFacts, sha256OfBytes } from "./canvas-facts.js";
import { canonicalJson } from "./normalize.js";
import type { SceneFact, SceneNodeSnapshot } from "./scene-readback.js";

export const CHECKBOX_PERTURBATION_EXAM_VERSION = "checkbox-perturbation-exam-v1";
export const CHECKBOX_PERTURBATION_EXAM_ROOT =
  "recipe/evidence/checkbox-perturbation-exam-v1";
export const CHECKBOX_PERTURBATION_EXAM_RECEIPT_PATH = `${CHECKBOX_PERTURBATION_EXAM_ROOT}/receipt.json`;
export const CHECKBOX_OBSERVE_PATH =
  "recipe/evidence/checkbox-scene-observe-v1/observe-astryx.json.gz";
export const CHECKBOX_PAGE_ID = "198:77718";
export const CHECKBOX_SET_ID = "198:77977";

export const OVERLAY_PERTURBATION_BLOCKER =
  "Tooltip, Menu, and Dialog have no committed SceneNodeSnapshot observe under recipe/evidence/** (no observe*.json.gz / observe*.json). A read-only MCP extract was not taken for those pages — none was a named in-scope substrate. Named: overlay perturbation exam is blocked until a committed observe exists.";

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const readRawObserve = (observePath: string): SceneNodeSnapshot =>
  JSON.parse(
    gunzipSync(readFileSync(observePath)).toString("utf8"),
  ) as SceneNodeSnapshot;

const firstComponent = (scene: SceneNodeSnapshot): SceneNodeSnapshot => {
  const component = scene.children.find((child) => child.type === "COMPONENT");
  if (!component)
    throw new TypeError("checkbox perturbation exam: no COMPONENT child");
  return component;
};

/**
 * VECTOR nodes in this extract have no imageHash / instance payload.
 * scene-readback's IR schema requires a non-empty assetRef; the observed
 * node name is the only identity the extract carries. Named fold, not a
 * glyph-path invention.
 */
export function foldVectorAssetRefFromName(
  scene: SceneNodeSnapshot,
): SceneNodeSnapshot {
  const clone = structuredClone(scene);
  const visit = (node: SceneNodeSnapshot): void => {
    if (node.type === "VECTOR" && !node.instancePayload?.assets?.[0]) {
      node.instancePayload = { text: [], assets: [node.name] };
    }
    for (const child of node.children) visit(child);
  };
  visit(clone);
  return clone;
}

const applyPadding = (
  scene: SceneNodeSnapshot,
): { from: unknown; to: unknown } => {
  const target = firstComponent(scene);
  const from = {
    top: target.paddingTop ?? 0,
    right: target.paddingRight ?? 0,
    bottom: target.paddingBottom ?? 0,
    left: target.paddingLeft ?? 0,
  };
  target.paddingLeft = (target.paddingLeft ?? 0) + 8;
  return { from, to: { ...from, left: target.paddingLeft } };
};

const factMap = (facts: SceneFact[]): Map<string, SceneFact> =>
  new Map(facts.map((fact) => [fact.id, fact]));

export interface CheckboxPerturbationExamReport {
  artifactVersion: typeof CHECKBOX_PERTURBATION_EXAM_VERSION;
  method: "self-baseline-observe-vs-scripted-padding";
  substrate: {
    kind: "committed-observe-extract";
    observePath: typeof CHECKBOX_OBSERVE_PATH;
    observeSha256: string;
    pageId: typeof CHECKBOX_PAGE_ID;
    setId: typeof CHECKBOX_SET_ID;
    signedPageWritten: false;
    liveDuplicateCreated: false;
    figmaWrites: 0;
  };
  namedFold: {
    kind: "vector-assetRef-from-observed-name";
    reason: string;
  };
  class: "padding";
  silentlyAbsorbed: false;
  namedChannels: string[];
  deltaCount: { changed: number; added: number; removed: number };
  proposal: {
    kind: "proposed-reviewed-input-diff";
    reviewBeforeWrite: true;
    applied: false;
    sceneChannel: "layout.padding";
    from: unknown;
    to: unknown;
  };
  overlay: {
    status: "named-blocker";
    blocker: string;
  };
  humanGrade: "pending";
  gradeInvented: false;
  overallSuccess: false;
}

export function runCheckboxPerturbationExam(): CheckboxPerturbationExamReport {
  const observeBytes = readFileSync(CHECKBOX_OBSERVE_PATH);
  const raw = foldVectorAssetRefFromName(readRawObserve(CHECKBOX_OBSERVE_PATH));
  const source = {
    observePath: CHECKBOX_OBSERVE_PATH,
    observeSha256: sha256OfBytes(observeBytes),
  };
  const baseline = deriveCanvasFacts(raw, source);
  const perturbed = structuredClone(raw);
  const applied = applyPadding(perturbed);
  const after = deriveCanvasFacts(perturbed, source);
  const before = factMap(baseline.facts);
  const next = factMap(after.facts);
  let changed = 0;
  let added = 0;
  let removed = 0;
  const namedChannels = new Set<string>();
  for (const [id, fact] of next) {
    const prior = before.get(id);
    if (prior === undefined) {
      added += 1;
      namedChannels.add(fact.channel);
      continue;
    }
    if (canonicalJson(prior.value) !== canonicalJson(fact.value)) {
      changed += 1;
      namedChannels.add(fact.channel);
    }
  }
  for (const [id, fact] of before) {
    if (!next.has(id)) {
      removed += 1;
      namedChannels.add(fact.channel);
    }
  }
  const channels = [...namedChannels].sort();
  if (!channels.includes("layout.padding"))
    throw new Error(
      "checkbox perturbation exam: padding class was silently absorbed",
    );
  return {
    artifactVersion: CHECKBOX_PERTURBATION_EXAM_VERSION,
    method: "self-baseline-observe-vs-scripted-padding",
    substrate: {
      kind: "committed-observe-extract",
      observePath: CHECKBOX_OBSERVE_PATH,
      observeSha256: source.observeSha256,
      pageId: CHECKBOX_PAGE_ID,
      setId: CHECKBOX_SET_ID,
      signedPageWritten: false,
      liveDuplicateCreated: false,
      figmaWrites: 0,
    },
    namedFold: {
      kind: "vector-assetRef-from-observed-name",
      reason:
        "VECTOR nodes in the extract carry no imageHash; assetRef is the observed node name so the IR schema can parse. Named, not a glyph-path invention.",
    },
    class: "padding",
    silentlyAbsorbed: false,
    namedChannels: channels,
    deltaCount: { changed, added, removed },
    proposal: {
      kind: "proposed-reviewed-input-diff",
      reviewBeforeWrite: true,
      applied: false,
      sceneChannel: "layout.padding",
      from: applied.from,
      to: applied.to,
    },
    overlay: {
      status: "named-blocker",
      blocker: OVERLAY_PERTURBATION_BLOCKER,
    },
    humanGrade: "pending",
    gradeInvented: false,
    overallSuccess: false,
  };
}

export function writeCheckboxPerturbationExamReceipt(
  report = runCheckboxPerturbationExam(),
): CheckboxPerturbationExamReport {
  mkdirSync(CHECKBOX_PERTURBATION_EXAM_ROOT, { recursive: true });
  writeFileSync(
    CHECKBOX_PERTURBATION_EXAM_RECEIPT_PATH,
    `${canonicalJson(report)}\n`,
  );
  return report;
}

export function validateCheckboxPerturbationExam(
  report: CheckboxPerturbationExamReport,
): string[] {
  const failures: string[] = [];
  if (report.artifactVersion !== CHECKBOX_PERTURBATION_EXAM_VERSION)
    failures.push("artifact version drifted");
  if (report.humanGrade !== "pending" || report.gradeInvented !== false)
    failures.push("human grade invented");
  if (report.overallSuccess !== false) failures.push("overallSuccess flipped");
  if (report.silentlyAbsorbed !== false)
    failures.push("padding class was silently absorbed");
  if (!report.namedChannels.includes("layout.padding"))
    failures.push("layout.padding was not named");
  if (report.proposal.applied !== false)
    failures.push("checkbox proposal was applied");
  if (report.proposal.reviewBeforeWrite !== true)
    failures.push("checkbox proposal is not review-before-write");
  if (report.substrate.figmaWrites !== 0) failures.push("Figma writes occurred");
  if (report.substrate.pageId !== CHECKBOX_PAGE_ID)
    failures.push("checkbox page id drifted");
  if (report.overlay.status !== "named-blocker")
    failures.push("overlay blocker was dropped");
  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = process.argv.includes("--write")
    ? writeCheckboxPerturbationExamReceipt()
    : runCheckboxPerturbationExam();
  const failures = validateCheckboxPerturbationExam(report);
  if (failures.length)
    throw new Error(
      `Checkbox perturbation exam refused:\n${failures.join("\n")}`,
    );
  if (!process.argv.includes("--write")) {
    const committed = JSON.parse(
      readFileSync(CHECKBOX_PERTURBATION_EXAM_RECEIPT_PATH, "utf8"),
    );
    if (canonicalJson(committed) !== canonicalJson(report))
      throw new Error(
        "checkbox perturbation exam: committed receipt.json does not match recomputation",
      );
  }
  process.stdout.write(
    `${canonicalJson({
      artifactVersion: report.artifactVersion,
      class: report.class,
      namedChannels: report.namedChannels,
      deltaCount: report.deltaCount,
      overlay: report.overlay.status,
      humanGrade: report.humanGrade,
    })}\n`,
  );
}
