import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { matchLitRender } from "./lit-render-match.js";
import { bindingStories } from "./binding-evidence.js";
import { buildStatefulCandidatePreparationReport } from "./stateful-candidate-report.js";
import { revisionOf } from "../core/contract-provenance.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import {
  altitudeButtonRuntimeRecipeIdentity,
  altitudeRuntimeRecipeIdentity,
  readVerifiedRuntimeArtifact,
  type RuntimeArtifactManifest,
  type RuntimeInputManifest,
} from "./runtime-artifact.js";
import {
  buildCandidatePreparationReport,
  createCandidatePreparationValidator,
} from "./candidate-report.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

/** Real recorded AST/semantic/topology bytes, synthetic artifact envelope.
 * This tests report joins, not execution or qualification of an original build. */
function fixture(component: "button" | "checkbox" = "button") {
  const checkboxFixture =
    component === "checkbox"
      ? JSON.parse(
          readFileSync(
            new URL(
              "./fixtures/lit-render-match/altitude-checkbox.json",
              import.meta.url,
            ),
            "utf8",
          ),
        )
      : null;
  const checkbox = checkboxFixture
    ? JSON.parse(
        gunzipSync(Buffer.from(checkboxFixture.payload, "base64")).toString(),
      )
    : null;
  const checkboxOriginal = checkboxFixture
    ? JSON.parse(
        gunzipSync(
          Buffer.from(checkboxFixture.originalEvidence.payload, "base64"),
        ).toString(),
      )
    : null;
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-report-test-")),
  );
  const directory = path.join(
    root,
    "repo/private/source-candidate-app/00000000-0000-4000-8000-000000000001",
  );
  mkdirSync(directory, { recursive: true });
  const source =
    checkbox?.source ??
    JSON.parse(
      readFileSync(
        new URL(
          "../extract/fixtures/lit-template/altitude-button.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  const recorded = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/lit-render-match/altitude-button.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const rows = checkbox
    ? bindingStories({
        version: 2,
        component: "al-checkbox",
        baseline: { id: "", sha256: "" },
      }).map((story, index) => ({
        runId: "recorded",
        story,
        eligible: index === 0,
        problems: index === 0 ? [] : ["fixture-original-unavailable"],
        ...(index === 0
          ? {
              semantics: checkboxOriginal.semantics,
              topology: (() => {
                const tree = JSON.parse(
                  readFileSync(
                    new URL(
                      "./fixtures/checkbox-anatomy-tree.json",
                      import.meta.url,
                    ),
                    "utf8",
                  ),
                );
                const bytes = gunzipSync(Buffer.from(tree.payload, "base64"));
                assert.equal(sha(bytes), tree.sha256);
                return {
                  tree: JSON.parse(bytes.toString()),
                  treeSha256: tree.sha256,
                };
              })(),
            }
          : {}),
      }))
    : recorded.records.map((row: any) => ({
        runId: "recorded",
        story: row.story,
        eligible: true,
        problems: [],
        semantics: JSON.parse(row.semantics.json),
      }));
  const declaration = rows[0].semantics.declaration;
  const sourceRevision = "0639eccd15bfedc4fa9713d9545a64cef2c0f0a5";
  const request = {
    ...(checkbox
      ? { version: 2 as const, component: "al-checkbox" as const }
      : { version: 1 as const }),
    baseline: {
      id: "00000000-0000-4000-8000-000000000002",
      sha256: "a".repeat(64),
    },
  };
  const selection = {
    id: "00000000-0000-4000-8000-000000000003",
    request,
    reportSha256: "b".repeat(64),
    evidence: {
      request,
      source,
      sourcePath: `components/${component}.ts`,
      sourceProgramSha256: "c".repeat(64),
      sourceRevision,
      rows,
    },
    report: {
      request,
      sourceStable: true,
      sourceProgramSha256: "c".repeat(64),
      rows: checkbox
        ? rows.map((row: any, index: number) => ({
            story: row.story,
            status: index === 0 ? "structure-matched" : "refused",
            problems: row.problems,
            ...(index === 0
              ? {
                  boundTopology: checkbox.boundTopology,
                  replaySemantics: checkbox.semantics,
                  renderObservation: checkbox.staticRender.observation,
                  correspondence: matchLitRender(checkbox),
                }
              : {}),
          }))
        : recorded.records.map((row: any) => ({
            story: row.story,
            status: "structure-matched",
            problems: [],
            boundTopology: JSON.parse(row.measurement.json).bound,
          })),
    },
  } as VerifiedBindingSelection;
  const inputBase = {
    version: 1 as const,
    adapter: `altitude-${component}-v1` as const,
    sourceRevision,
    files: [
      {
        path: `components/${component}.ts`,
        bytes: Buffer.byteLength(source.source),
        sha256: source.sourceSha256,
        kind: "source" as const,
      },
    ],
    packages: [],
    tools: {
      vite: "tools/vite",
      sass: "tools/sass",
      typescript: "tools/typescript",
    },
  };
  const inputs: RuntimeInputManifest = {
    ...inputBase,
    inputRevision: sha(JSON.stringify(inputBase)),
  };
  const properties = declaration.properties.map((p: any) => ({
    name: p.name,
    typeText: p.typeText,
    writable: p.name !== "slotNodes",
    sourcePath: `components/${component}.ts`,
    declaringClass: source.className,
    reason: p.name === "slotNodes" ? "computed-query" : "lit-property",
  }));
  properties.push({
    name: "styleModifier",
    typeText: "string",
    writable: true,
    sourcePath: "components/base.ts",
    declaringClass: "ALElement",
    reason: "lit-property",
  });
  const iface = {
    version: 1 as const,
    module: { path: "button.js", exportName: source.className },
    declaration: { path: "button.d.ts", exportName: source.className },
    tagBase: declaration.tagName,
    properties,
    writableProperties: properties
      .filter((p: any) => p.writable)
      .map((p: any) => p.name),
    slots: declaration.slots,
    events: declaration.events,
    originalDeclarations: [declaration],
    typeDependencies: [],
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  const files = new Map([
    ["button.js", Buffer.from("export class ALButton extends HTMLElement {}")],
    [
      "button.d.ts",
      Buffer.from("export declare class ALButton extends HTMLElement {}"),
    ],
    ["theme.css", Buffer.from(":root{--example:blue}")],
  ]);
  const manifest: RuntimeArtifactManifest = {
    version: 1,
    kind: "original-custom-element-runtime",
    adapter: `altitude-${component}-v1`,
    source: {
      revision: sourceRevision,
      inputRevision: inputs.inputRevision,
      baselineSha256: request.baseline.sha256,
    },
    recipe: {
      ...altitudeRuntimeRecipeIdentity(component),
      node: process.version,
      repeatedBuildIdentical: true,
    },
    interface: iface,
    interfaceRevision: revisionOf(iface),
    inputs,
    consumedInputs: [`components/${component}.ts`],
    stylesheetInputs: [],
    files: [...files].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: sha(bytes),
      kind: name.endsWith(".d.ts")
        ? "declaration"
        : name.endsWith(".css")
          ? "stylesheet"
          : "module",
    })),
    limitations: ["Synthetic data-only fixture."],
  };
  const bytes = Buffer.from(JSON.stringify(manifest) + "\n");
  const artifactRevision = "sha256:" + sha(bytes),
    archive = path.join(directory, "runtime", artifactRevision.slice(7));
  mkdirSync(archive, { recursive: true });
  writeFileSync(path.join(archive, "manifest.json"), bytes);
  for (const [name, data] of files)
    writeFileSync(path.join(archive, name), data);
  const artifact = readVerifiedRuntimeArtifact(archive, artifactRevision);
  const context = {
    selection,
    directory,
    readArtifact: (name: string) => readFileSync(path.join(directory, name)),
  };
  let inspections = 0;
  const validate = createCandidatePreparationValidator((checkout, target) => {
    assert.equal(target, component);
    inspections++;
    assert.equal(checkout, path.join(root, "altitude"));
    return inputs;
  });
  return {
    root,
    directory,
    archive,
    selection,
    inputs,
    artifact,
    context,
    validate,
    inspections: () => inspections,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("Checkbox preparation preserves real source-owned text, nested hosts and omitted Boolean states with missing coverage", () => {
  const f = fixture("checkbox");
  try {
    const report = buildStatefulCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
    );
    assert.equal(report.adapter, "altitude-checkbox-runtime-v1");
    assert.equal(report.acceptedContract, null);
    assert.deepEqual(report.semantics.coverage, {
      expected: 4,
      matched: 1,
      refused: 3,
    });
    assert.equal(report.semantics.booleanAxes.length, 6);
    for (const axis of report.semantics.booleanAxes) {
      assert.deepEqual(axis.states[0].caseIds, [
        "recorded:atoms-checkbox--default",
      ]);
      assert.deepEqual(axis.missing, [
        { kind: "value", value: false },
        { kind: "value", value: true },
      ]);
      assert.equal(axis.projection, "unqualified");
    }
    const row = report.semantics.cases[0];
    assert.equal(row.texts[0].sourceProperty, "fieldNote");
    assert.equal(row.texts[0].value, "This is a field note.");
    assert.equal(row.nestedHosts.length, 1);
    assert.equal(row.nestedHosts[0].tag, "al-field-note");
    assert.equal(row.pseudoPlanes.length, 2);
    assert.deepEqual(
      report.semantics.slots.find((slot) => slot.name === "error")!.caseIds,
      [],
    );
    const summary = f.validate(report, f.context);
    assert.equal(summary.counters.structurallyMatchedCases, 1);
    assert.equal(summary.counters.missingBooleanStates, 12);
    assert.ok(
      summary.problems!.includes("candidate-boolean-states-unobserved"),
    );
    assert.ok(summary.problems!.includes("candidate-source-slot-unobserved"));
    assert.equal(f.inspections(), 1);
  } finally {
    f.close();
  }
});

test("Checkbox preparation refuses changed runtime, missing same-page observations and manufactured state or content", async (t) => {
  for (const mutation of [
    "runtime",
    "cohort",
    "fresh",
    "static",
    "state",
    "text",
    "pseudo",
    "api",
  ])
    await t.test(mutation, () => {
      const f = fixture("checkbox");
      try {
        const bound = f.selection.report.rows[0];
        if (mutation === "runtime")
          f.artifact.manifest.recipe.sha256 = "0".repeat(64);
        if (mutation === "cohort") f.selection.evidence.rows.pop();
        if (mutation === "fresh") delete bound.replaySemantics;
        if (mutation === "static") delete bound.renderObservation;
        if (mutation === "state")
          bound.replaySemantics!.observation.properties.isChecked = {
            kind: "value",
            value: false,
          };
        if (mutation === "text")
          bound.correspondence!.texts![0].value = "Invented text";
        if (mutation === "pseudo")
          bound.boundTopology!.topology!.observation!.pseudoPlanes![0].ownerDomPath =
            "unknown";
        if (mutation === "api")
          f.artifact.manifest.interface.properties[0].typeText = "string";
        assert.throws(
          () =>
            buildStatefulCandidatePreparationReport(
              f.selection,
              f.artifact,
              f.inputs,
            ),
          /candidate-/,
        );
      } finally {
        f.close();
      }
    });
  const f = fixture("checkbox");
  try {
    const report = buildStatefulCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
    );
    report.semantics.booleanAxes[0].missing = [];
    report.semanticsRevision = revisionOf(report.semantics);
    assert.throws(
      () => f.validate(report, f.context),
      /preparation-report-mismatch/,
    );
  } finally {
    f.close();
  }
});

test("prepared report reopens runtime bytes and rederives source semantics without execution or acceptance", () => {
  const f = fixture();
  try {
    const report = buildCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
    );
    assert.equal(report.acceptedContract, null);
    assert.equal(report.qualification, "source-and-runtime-only");
    assert.equal(report.semantics.status, "semantic-candidate");
    const first = f.validate(report, f.context),
      second = f.validate(structuredClone(report), f.context);
    assert.deepEqual(first, second);
    assert.equal(f.inspections(), 2);
    assert.equal(first.counters.plannedCases, f.selection.evidence.rows.length);
    assert.equal(first.counters.slots, 3);
    assert.ok(
      first.problems?.includes("candidate-native-projection-unverified"),
    );
    assert.equal(typeof globalThis.HTMLElement, "undefined");
  } finally {
    f.close();
  }
});

test("report joins refuse changed output, current inputs, binding, source, public API or scope claims", async (t) => {
  for (const mutation of [
    "bytes",
    "inputs",
    "baseline",
    "source",
    "binding",
    "request",
    "semantics",
    "acceptance",
    "qualification",
    "artifact-path",
    "extra",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      try {
        const report = buildCandidatePreparationReport(
          f.selection,
          f.artifact,
          f.inputs,
        );
        if (mutation === "bytes")
          writeFileSync(path.join(f.archive, "button.js"), "changed");
        if (mutation === "inputs") f.inputs.files[0].sha256 = "f".repeat(64);
        if (mutation === "baseline")
          f.selection.request.baseline.sha256 = "f".repeat(64);
        if (mutation === "source")
          f.selection.evidence.sourceRevision = "f".repeat(40);
        if (mutation === "binding") f.selection.reportSha256 = "f".repeat(64);
        if (mutation === "request")
          report.request.baseline.id = "00000000-0000-4000-8000-000000000009";
        if (mutation === "semantics") {
          report.semantics.projectedProps[0].default = "secondary";
          report.semanticsRevision = revisionOf(report.semantics);
        }
        if (mutation === "acceptance") report.acceptedContract = {} as never;
        if (mutation === "qualification")
          report.qualification = "native-verified" as never;
        if (mutation === "artifact-path")
          report.runtime.artifactRevision = "../../outside";
        if (mutation === "extra")
          Object.assign(report, { overallSuccess: true });
        assert.throws(() => f.validate(report, f.context));
      } finally {
        f.close();
      }
    });
});

test("source refusals remain in the denominator; binding refusal cannot become a structurally matched case", () => {
  const f = fixture();
  try {
    f.selection.report.rows[0].status = "refused";
    f.selection.report.rows[0].problems = ["binding-source-refused"];
    const report = buildCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
    );
    assert.equal(report.semantics.cases[0].status, "refused");
    const validation = f.validate(report, f.context);
    assert.equal(
      validation.counters.plannedCases,
      f.selection.evidence.rows.length,
    );
    assert.ok(validation.counters.refusedCases >= 1);
  } finally {
    f.close();
  }
});

test("recipe claims must match the trusted build recipe, not just an arbitrary rehashed manifest", () => {
  const f = fixture();
  try {
    f.artifact.manifest.recipe.repeatedBuildIdentical = false as never;
    assert.throws(
      () => buildCandidatePreparationReport(f.selection, f.artifact, f.inputs),
      /candidate-/,
    );
    f.artifact.manifest.recipe.repeatedBuildIdentical = true;
    f.artifact.manifest.recipe.sha256 = "0".repeat(64);
    assert.throws(
      () => buildCandidatePreparationReport(f.selection, f.artifact, f.inputs),
      /candidate-/,
    );
  } finally {
    f.close();
  }
});

test("new Checkbox preparation retains v2 anatomy while historical reports keep their original derivation", () => {
  const f = fixture("checkbox");
  try {
    const legacy = buildStatefulCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
    );
    const before = JSON.stringify(legacy);
    const report = buildStatefulCandidatePreparationReport(
      f.selection,
      f.artifact,
      f.inputs,
      { anatomyVersion: 2 },
    );
    assert.equal(report.adapter, "altitude-checkbox-runtime-v2");
    assert.equal(report.anatomy?.version, 2);
    assert.equal(report.anatomy?.cases.length, 4);
    assert.equal(
      report.anatomy?.cases[0].status,
      "structural-projection",
      JSON.stringify(report.anatomy?.cases[0].problems),
    );
    assert.equal(report.anatomy?.cases[0].pseudoPlanes?.length, 2);
    assert.equal(
      report.anatomy?.cases[0].samples.filter(
        (sample) => sample.nestedHosts?.length,
      ).length,
      1,
    );
    assert.equal(
      report.anatomy?.cases.filter((row) => row.status === "refused").length,
      3,
    );
    assert.equal(report.anatomy?.revision, revisionOf(report.anatomy?.cases));
    const summary = f.validate(report, f.context);
    assert.equal(summary.counters.anatomyProjectedCases, 1);
    assert.equal(summary.counters.anatomyRefusedCases, 3);
    assert.equal(
      f.validate(legacy, f.context).counters.anatomyProjectedCases,
      undefined,
    );
    assert.equal(JSON.stringify(legacy), before);
    report.anatomy!.cases[0].pseudoPlanes![0].owner.sourceNodeId = "invented";
    report.anatomy!.revision = revisionOf(report.anatomy!.cases);
    assert.throws(
      () => f.validate(report, f.context),
      /preparation-report-mismatch/,
    );
  } finally {
    f.close();
  }
});
