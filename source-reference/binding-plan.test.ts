import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { planBindingInterventions } from "./binding-plan.js";
import { runBindingJob } from "./binding-run.js";
import { matchLitRender } from "./lit-render-match.js";
import type { SemanticIntake } from "./semantics.js";
import type { BoundTopologyResult } from "./bound-topology.js";
import { validateBindingReport } from "./binding-report.js";
import type { BindingEvidence } from "./binding-evidence.js";
import type { BindingTraceReport } from "./binding-jobs.js";
import { altitudeCohort } from "./altitude-cohort.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function recordedDefault() {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/lit-render-match/altitude-button.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const source = JSON.parse(
    readFileSync(
      new URL(
        "../extract/fixtures/lit-template/altitude-button.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const row = fixture.records.find(
    (record: { story: string }) => record.story === "atoms-button--default",
  );
  assert.equal(sha(row.measurement.json), row.measurement.sha256);
  assert.equal(sha(row.semantics.json), row.semantics.sha256);
  assert.equal(sha(source.source), fixture.sourceSha256);
  const semantics = JSON.parse(row.semantics.json) as SemanticIntake;
  const bound = JSON.parse(row.measurement.json).bound as BoundTopologyResult;
  const match = matchLitRender({ source, semantics, boundTopology: bound });
  assert.equal(
    match.status,
    "structure-matched",
    JSON.stringify(match.problems),
  );
  return { source, semantics, match, bound };
}

test("recorded default Button derives three exact source/DOM probes with 2/2/3 values", () => {
  const { source, match, bound } = recordedDefault();
  const before = JSON.stringify({ match, bound });
  const plans = planBindingInterventions("atoms-button--default", match, bound);
  assert.deepEqual(
    plans.map((plan) => plan.key),
    ["label", "default-slot", "aria-disabled"],
  );
  assert.ok(plans.every((plan) => plan.intervention && !plan.problems.length));
  assert.deepEqual(
    plans.map((plan) => plan.intervention!.values.length),
    [2, 2, 3],
  );
  const label = plans[0].intervention!,
    content = plans[1].intervention!,
    disabled = plans[2].intervention!;
  assert.equal(label.kind, "property");
  if (label.kind === "property") {
    assert.equal(label.name, "label");
    assert.deepEqual(label.target, {
      path: "0",
      tag: "button",
      attribute: "aria-label",
    });
    assert.equal(
      source.source.slice(label.sourceSpan.start, label.sourceSpan.end),
      "aria-label=${ifDefined(this.label)}",
    );
  }
  assert.equal(content.kind, "slot-text");
  if (content.kind === "slot-text") {
    assert.equal(content.name, "");
    assert.equal(content.assignedDomPath, "host/0");
    assert.equal(content.path, "0/0/0");
    assert.equal(content.sourceNodeId, "element:6873");
  }
  assert.equal(disabled.kind, "property");
  if (disabled.kind === "property") {
    assert.equal(disabled.name, "isDisabled");
    assert.equal(disabled.target.attribute, "aria-disabled");
    assert.deepEqual(disabled.values, [
      { kind: "undefined" },
      { kind: "value", value: false },
      { kind: "value", value: true },
    ]);
  }
  for (const plan of plans.slice(0, 2))
    assert.notDeepEqual(
      plan.intervention!.values[0],
      plan.intervention!.values[1],
    );
  assert.equal(
    JSON.stringify({ match, bound }),
    before,
    "planning does not change raw evidence",
  );
});

test("missing or refused correspondence retains all three obligations; other stories plan zero", () => {
  const { match, bound } = recordedDefault();
  for (const inputs of [
    [],
    [undefined, bound],
    [match, undefined],
    [{ ...match, status: "refused" as const }, bound],
  ] as const) {
    const plans = planBindingInterventions(
      "atoms-button--default",
      inputs[0],
      inputs[1],
    );
    assert.equal(plans.length, 3);
    assert.ok(
      plans.every(
        (plan) =>
          !plan.intervention &&
          plan.problems.includes("binding-plan-structure-unavailable"),
      ),
    );
  }
  for (const story of [
    "atoms-button--secondary",
    "atoms-button--default-disabled",
    "atoms-button--default-icon-before",
    "atoms-button--tertiary",
    "atoms-button--bare",
    "atoms-button--danger",
  ])
    assert.deepEqual(planBindingInterventions(story, match, bound), []);
});

test("duplicate direct attribute bindings refuse the planned target instead of choosing the first", () => {
  const { match, bound } = recordedDefault();
  match.bindings.push(
    structuredClone(
      match.bindings.find((binding) => binding.sourceProperty === "label")!,
    ),
  );
  const plans = planBindingInterventions("atoms-button--default", match, bound);
  assert.equal(plans.length, 3);
  assert.equal(plans[0].intervention, undefined);
  assert.deepEqual(plans[0].problems, [
    "binding-plan-direct-native-attribute-unavailable",
  ]);
  assert.ok(plans[1].intervention && plans[2].intervention);
});

test("multiple/absent assigned nodes and nontext content cannot become a single text probe", () => {
  for (const changed of [
    "multiple",
    "absent",
    "element",
    "duplicate-slot",
  ] as const) {
    const { match, bound } = recordedDefault();
    if (changed === "multiple") match.slots[0].assigned.push("host/2");
    if (changed === "absent") match.slots[0].assigned = [];
    if (changed === "element") {
      const node = bound.topology!.observation!.nodes.find(
        (node) => node.domPath === "host/0",
      )!;
      node.kind = "element";
    }
    if (changed === "duplicate-slot")
      match.slots.push(structuredClone(match.slots[0]));
    const plans = planBindingInterventions(
      "atoms-button--default",
      match,
      bound,
    );
    assert.equal(plans.length, 3);
    assert.equal(plans[1].intervention, undefined);
    assert.deepEqual(plans[1].problems, [
      "binding-plan-single-assigned-text-unavailable",
    ]);
  }
});

test("runner module import is inert and outside-owned-job directories refuse before browser launch", async () => {
  const repository = fileURLToPath(new URL("..", import.meta.url));
  for (const directory of [
    repository,
    path.join(repository, "private"),
    path.join(repository, "private", "00000000-0000-4000-8000-000000000001"),
    path.join(repository, "private/source-binding-app/not-a-job"),
  ]) {
    await assert.rejects(
      runBindingJob(repository, directory),
      /binding-run-job-directory-invalid/,
    );
  }
});

test("serialized actual correspondence validates with all three default probes explicitly unrun", () => {
  const { source, semantics, match, bound } = recordedDefault();
  const packed = JSON.parse(
    readFileSync(
      new URL("./fixtures/contract-plan-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const files = JSON.parse(
    gunzipSync(Buffer.from(packed.payload, "base64")).toString(),
  );
  const tree = JSON.parse(files["atoms-button--default/source-tree.json"].utf8);
  const png = Buffer.from(
    files["atoms-button--default/source.png"].base64,
    "base64",
  );
  assert.equal(
    createHash("sha256").update(png).digest("hex"),
    semantics.sourcePngSha256,
  );
  const entries = altitudeCohort.filter((entry) =>
    entry.story.startsWith("atoms-button--"),
  );
  // Job identity is synthetic in this reader test. Only the default's original
  // source/semantic/topology/image payloads are claimed as recorded facts; the
  // other cohort rows are intentionally refused, not relabeled source passes.
  const evidence: BindingEvidence = {
    request: {
      version: 1,
      baseline: {
        id: "00000000-0000-4000-8000-000000000001",
        sha256: "a".repeat(64),
      },
    },
    source,
    sourcePath: source.sourcePath,
    sourceProgramSha256: "b".repeat(64),
    sourceRevision: source.sourceRevision,
    rows: entries.map((entry) =>
      entry.story === "atoms-button--default"
        ? {
            story: entry.story,
            runId: "00000000-0000-4000-8000-000000000001",
            eligible: true,
            problems: [],
            profile: entry.profile,
            semantics,
            topology: {
              hostPath: [semantics.declaration.tagName],
              rootPath: entry.profile.path,
              stageSelector: "#storybook-root",
              channels: tree.channels,
              tree: tree.tree,
              treeSha256: tree.treeSha256,
              sourcePngSha256: tree.sourcePngSha256,
            },
          }
        : {
            story: entry.story,
            runId: "00000000-0000-4000-8000-000000000001",
            eligible: false,
            problems: ["reader-fixture-original-unavailable"],
            profile: entry.profile,
          },
    ),
  };
  const report: BindingTraceReport = {
    version: 1,
    request: evidence.request,
    sourceProgramSha256: evidence.sourceProgramSha256,
    sourceStable: true,
    rows: entries.map((entry) =>
      entry.story === "atoms-button--default"
        ? {
            story: entry.story,
            status: "structure-matched",
            problems: ["binding-probes-not-run"],
            matchedElements: match.nodes.length,
            mappedSlots: match.slots.length,
            plannedDependencies: 3,
            observedDependencies: 0,
            boundTopology: bound,
            correspondence: match,
            differentials: planBindingInterventions(
              entry.story,
              match,
              bound,
            ).map((plan) => ({
              key: plan.key,
              problems: ["binding-probe-not-run"],
            })),
          }
        : {
            story: entry.story,
            status: "refused",
            problems: ["reader-fixture-original-unavailable"],
            matchedElements: 0,
            mappedSlots: 0,
            plannedDependencies: 0,
            observedDependencies: 0,
            differentials: [],
          },
    ),
    scope:
      "Unit reader test: serialized recorded correspondence with no dependency executions or accepted contract.",
  };
  const saved = JSON.parse(JSON.stringify(report));
  assert.doesNotThrow(() =>
    validateBindingReport(saved, evidence, (story, name) => {
      assert.equal(story, "atoms-button--default");
      assert.equal(name, "replay.png");
      return png;
    }),
  );
  saved.rows[0].observedDependencies = 1;
  assert.throws(
    () => validateBindingReport(saved, evidence, () => png),
    /binding-report-probe-count-mismatch/,
  );
});
