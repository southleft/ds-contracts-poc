import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { PNG } from "pngjs";
import { altitudeCohort } from "./altitude-cohort.js";
import type { BindingEvidence } from "./binding-evidence.js";
import type { BindingTraceReport } from "./binding-jobs.js";
import type { BindingDifferentialResult } from "./binding-differential.js";
import { planBindingInterventions, type BindingProbeKey } from "./binding-plan.js";
import { validateBindingReport } from "./binding-report.js";
import { matchLitRender } from "./lit-render-match.js";
import { semanticHash, type SemanticIntake } from "./semantics.js";
import type { BoundTopologyResult } from "./bound-topology.js";

const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const syntheticPng = (original: Buffer, channelMask: number): Buffer => {
  const png = PNG.sync.read(original);
  png.data[0] ^= channelMask;
  return PNG.sync.write(png);
};

/** Original source/topology/PNG bytes are recorded. The job identity, archive
 * reference, interventions, after-observations and changed-image payload below
 * are SYNTHETIC reader fixtures. They exercise record consistency, never claim
 * these dependencies were observed in a browser or that a contract is accepted.
 */
function fixture(key: BindingProbeKey = "label") {
  const recorded = JSON.parse(readFileSync(new URL("./fixtures/lit-render-match/altitude-button.json", import.meta.url), "utf8"));
  const original = recorded.records.find((row: { story: string }) => row.story === "atoms-button--default");
  const source = JSON.parse(readFileSync(new URL("../extract/fixtures/lit-template/altitude-button.json", import.meta.url), "utf8"));
  const semantics = JSON.parse(original.semantics.json) as SemanticIntake;
  const bound = JSON.parse(original.measurement.json).bound as BoundTopologyResult;
  const match = matchLitRender({ source, semantics, boundTopology: bound });
  assert.equal(match.status, "structure-matched", JSON.stringify(match.problems));
  const packed = JSON.parse(readFileSync(new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url), "utf8"));
  const files = JSON.parse(gunzipSync(Buffer.from(packed.payload, "base64")).toString());
  const rawTree = JSON.parse(files["atoms-button--default/source-tree.json"].utf8);
  const originalPng = Buffer.from(files["atoms-button--default/source.png"].base64, "base64");
  assert.equal(sha(originalPng), semantics.sourcePngSha256);
  const entries = altitudeCohort.filter(entry => entry.story.startsWith("atoms-button--"));
  const replay = { harPath: "/synthetic/reader-only/source.har", harSha256: "c".repeat(64), url: "http://127.0.0.1:6017/iframe.html?id=atoms-button--default&viewMode=story" };
  const evidence: BindingEvidence = {
    request: { version: 1, baseline: { id: "00000000-0000-4000-8000-000000000001", sha256: "a".repeat(64) } },
    source, sourcePath: source.sourcePath, sourceProgramSha256: "b".repeat(64), sourceRevision: source.sourceRevision,
    rows: entries.map(entry => entry.story === "atoms-button--default" ? {
      story: entry.story, runId: "00000000-0000-4000-8000-000000000001", profile: entry.profile, eligible: true, problems: [], replay, semantics,
      topology: { hostPath: [semantics.declaration.tagName], rootPath: entry.profile.path, stageSelector: "#storybook-root", channels: rawTree.channels, tree: rawTree.tree, treeSha256: rawTree.treeSha256, sourcePngSha256: rawTree.sourcePngSha256 },
    } : { story: entry.story, runId: "00000000-0000-4000-8000-000000000001", profile: entry.profile, eligible: false, problems: ["reader-fixture-original-unavailable"] }),
  };
  const plans = planBindingInterventions("atoms-button--default", match, bound);
  const planIndex = plans.findIndex(plan => plan.key === key), intervention = plans[planIndex].intervention!;
  const imageBytes = new Map<string, Buffer>([["atoms-button--default/replay.png", originalPng]]);
  const profile = entries[0].profile;
  const cases: BindingDifferentialResult["cases"] = intervention.values.map((value, caseIndex) => {
    const before = structuredClone(semantics.observation), after = structuredClone(before);
    let interventionReceipt: unknown;
    let afterPng: Buffer = originalPng;
    if (intervention.kind === "property") {
      after.properties[intervention.name] = value;
      const native = after.nativeElements.find(native => native.path === intervention.target.path)!;
      if (value.kind === "undefined") delete native.attributes[intervention.target.attribute];
      else native.attributes[intervention.target.attribute] = String(value.value);
      interventionReceipt = { kind: "source-property-setter", property: intervention.name, value };
    } else {
      assert.ok(value.kind === "value" && typeof value.value === "string");
      const slot = after.slots.find(slot => slot.path === intervention.path && slot.name === intervention.name)!;
      const text = slot.assigned.find(node => node.kind === "text")!;
      interventionReceipt = { kind: "assigned-text-data", domPath: intervention.assignedDomPath, before: text.text, after: value.value, preservedSiblings: [] };
      text.text = value.value;
      // Valid PNG with an explicitly synthetic one-channel pixel perturbation.
      // This is reader consistency evidence, not a claimed browser rendering
      // of the changed content or an appearance threshold/grade.
      afterPng = syntheticPng(originalPng, caseIndex + 1);
    }
    imageBytes.set(`atoms-button--default/probe-${planIndex}-case-${caseIndex}-before.png`, originalPng);
    imageBytes.set(`atoms-button--default/probe-${planIndex}-case-${caseIndex}-after.png`, afterPng);
    return {
      value, status: "observed", problems: [], before, after,
      beforeSha256: semanticHash(before), afterSha256: semanticHash(after),
      beforePngSha256: sha(originalPng), afterPngSha256: sha(afterPng), interventionReceipt,
      afterReadiness: { found: true, visible: true, width: 100, height: 40, text: "Synthetic fixture text", styles: {}, tokens: {}, fontsReady: true, platformFonts: [{ familyName: profile.fontFamily, glyphCount: 1 }], failedResources: [], runtimeErrors: [] },
    };
  });
  const result: BindingDifferentialResult = {
    version: 1, status: "dependency-observed", acceptedContract: null,
    inputSha256: semanticHash({ replay: { ...replay, profile }, source, semantics, intervention }),
    sourceSha256: source.sourceSha256, declarationSha256: semantics.declarationSha256, semanticObservationSha256: semantics.observationSha256,
    harSha256: replay.harSha256, intervention, denominator: cases.length, observed: cases.length, cases, problems: [], limitations: ["Synthetic record-validation fixture; no runtime dependency claim."], digest: "",
  };
  result.digest = semanticHash({ ...result, digest: undefined });
  const report: BindingTraceReport = {
    version: 1, request: evidence.request, sourceProgramSha256: evidence.sourceProgramSha256, sourceStable: true,
    rows: entries.map(entry => entry.story === "atoms-button--default" ? {
      story: entry.story, status: "structure-matched", problems: ["reader-fixture-other-probes-unrun"], matchedElements: match.nodes.length, mappedSlots: match.slots.length, plannedDependencies: 3, observedDependencies: 1,
      boundTopology: bound, correspondence: match,
      differentials: plans.map((plan, index) => index === planIndex ? { key: plan.key, problems: [], result } : { key: plan.key, problems: ["binding-probe-not-run"] }),
    } : { story: entry.story, status: "refused", problems: ["reader-fixture-original-unavailable"], matchedElements: 0, mappedSlots: 0, plannedDependencies: 0, observedDependencies: 0, differentials: [] }),
    scope: "Synthetic differential reader fixture over recorded original source; not actual runtime evidence.",
  };
  const saved = JSON.parse(JSON.stringify(report)) as BindingTraceReport;
  const value = saved.rows[0].differentials![planIndex].result!;
  const resign = () => { value.digest = semanticHash({ ...value, digest: undefined }); };
  const image = (story: string, name: string) => {
    const bytes = imageBytes.get(`${story}/${name}`);
    assert.ok(bytes, `Missing explicit test image ${story}/${name}`); return bytes;
  };
  const validate = () => validateBindingReport(saved, evidence, image);
  assert.doesNotThrow(validate, "positive synthetic dependency fixture must be structurally valid");
  return { report: saved, value, resign, validate, imageBytes, planIndex };
}

test("serialized explicit label, content and ARIA-disabled records derive one observed dependency each", () => {
  for (const key of ["label", "default-slot", "aria-disabled"] as const) {
    const f = fixture(key); assert.doesNotThrow(f.validate);
    f.report.rows[0].observedDependencies = 3;
    assert.throws(f.validate, /binding-report-probe-count-mismatch/);
  }
});

test("resource/runtime failure evidence cannot retain an observed dependency after digest recomputation", () => {
  for (const channel of ["failedResources", "runtimeErrors"] as const) {
    const f = fixture(); f.value.cases[0].afterReadiness![channel].push("explicit fixture failure"); f.resign();
    assert.throws(f.validate, /binding-report-case-fonts-unready/);
  }
});

test("wrong, absent or retargeted setter receipts refuse despite matching semantic deltas", () => {
  for (const receipt of [undefined, { kind: "source-property-setter", property: "name", value: { kind: "value", value: "Contract label alpha" } }, { kind: "native-attribute-write", property: "label" }]) {
    const f = fixture(); f.value.cases[0].interventionReceipt = receipt; f.resign();
    assert.throws(f.validate, /binding-report-case-intervention-mismatch/);
  }
});

test("slot receipt requires exact Node identity, unchanged sibling list and original before text", () => {
  for (const delta of [{ domPath: "host/1" }, { before: "Invented original label" }, { preservedSiblings: [{ kind: 3, text: "extra" }] }]) {
    const f = fixture("default-slot");
    f.value.cases[0].interventionReceipt = { ...(f.value.cases[0].interventionReceipt as Record<string, unknown>), ...delta }; f.resign();
    assert.throws(f.validate, /binding-report-case-intervention-mismatch/);
  }
});

test("image bytes and exact post-intervention semantics are rechecked, not trusted from counters", () => {
  const image = fixture();
  const imageKey = `atoms-button--default/probe-${image.planIndex}-case-0-after.png`;
  image.imageBytes.set(imageKey, syntheticPng(image.imageBytes.get(imageKey)!, 7));
  assert.throws(image.validate, /binding-report-case-artifacts-mismatch/);
  const semantic = fixture(); semantic.value.cases[0].after!.nativeElements[0].attributes["aria-label"] = "Not the requested input";
  semantic.value.cases[0].afterSha256 = semanticHash(semantic.value.cases[0].after); semantic.resign();
  assert.throws(semantic.validate, /binding-report-case-dependency-mismatch/);
});

test("malformed PNG bytes refuse even when the case image hash and result digest are updated", () => {
  const f = fixture("default-slot"), invalid = Buffer.from("not a PNG file");
  f.imageBytes.set(`atoms-button--default/probe-${f.planIndex}-case-0-after.png`, invalid);
  f.value.cases[0].afterPngSha256 = sha(invalid); f.resign();
  assert.throws(f.validate, /binding-report-image-invalid/);
});

test("oversized PNG IHDR dimensions refuse before decoder allocation", () => {
  const f = fixture("default-slot");
  const key = `atoms-button--default/probe-${f.planIndex}-case-0-after.png`;
  const invalid = Buffer.from(f.imageBytes.get(key)!);
  invalid.writeUInt32BE(0x7fffffff, 16);
  f.imageBytes.set(key, invalid);
  f.value.cases[0].afterPngSha256 = sha(invalid); f.resign();
  const read = PNG.sync.read;
  let oversizedDecodeAttempted = false;
  PNG.sync.read = (bytes, options) => {
    if (bytes.length >= 24 && bytes.readUInt32BE(16) === 0x7fffffff) {
      oversizedDecodeAttempted = true;
      throw Error("test must not allocate an oversized decode");
    }
    return read(bytes, options);
  };
  try {
    assert.throws(f.validate, /binding-report-image-invalid/);
    assert.equal(oversizedDecodeAttempted, false, "dimensions must be bounded before calling the PNG decoder");
  } finally { PNG.sync.read = read; }
});
