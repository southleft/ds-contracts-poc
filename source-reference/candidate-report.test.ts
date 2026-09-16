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
import { revisionOf } from "../core/contract-provenance.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import {
  altitudeButtonRuntimeRecipeIdentity,
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
function fixture() {
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-report-test-")),
  );
  const directory = path.join(
    root,
    "repo/private/source-candidate-app/00000000-0000-4000-8000-000000000001",
  );
  mkdirSync(directory, { recursive: true });
  const source = JSON.parse(
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
  const rows = recorded.records.map((row: any) => ({
    runId: "recorded",
    story: row.story,
    eligible: true,
    problems: [],
    semantics: JSON.parse(row.semantics.json),
  }));
  const declaration = rows[0].semantics.declaration;
  const sourceRevision = "0639eccd15bfedc4fa9713d9545a64cef2c0f0a5";
  const request = {
    version: 1 as const,
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
      sourcePath: "components/button.ts",
      sourceProgramSha256: "c".repeat(64),
      sourceRevision,
      rows,
    },
    report: {
      rows: recorded.records.map((row: any) => ({
        story: row.story,
        status: "structure-matched",
        problems: [],
        boundTopology: JSON.parse(row.measurement.json).bound,
      })),
    },
  } as VerifiedBindingSelection;
  const inputBase = {
    version: 1 as const,
    adapter: "altitude-button-v1" as const,
    sourceRevision,
    files: [
      {
        path: "components/button.ts",
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
    sourcePath: "components/button.ts",
    declaringClass: "ALButton",
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
    module: { path: "button.js", exportName: "ALButton" },
    declaration: { path: "button.d.ts", exportName: "ALButton" },
    tagBase: "al-button",
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
    adapter: "altitude-button-v1",
    source: {
      revision: sourceRevision,
      inputRevision: inputs.inputRevision,
      baselineSha256: request.baseline.sha256,
    },
    recipe: {
      ...altitudeButtonRuntimeRecipeIdentity(),
      node: process.version,
      repeatedBuildIdentical: true,
    },
    interface: iface,
    interfaceRevision: revisionOf(iface),
    inputs,
    consumedInputs: ["components/button.ts"],
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
  const validate = createCandidatePreparationValidator((checkout) => {
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
