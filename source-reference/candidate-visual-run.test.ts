import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { revisionOf } from "../core/contract-provenance.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import type {
  CandidateJobRecord,
  CandidateVisualJobRecord,
} from "./candidate-jobs.js";
import { buildCandidatePreparationReport } from "./candidate-report.js";
import {
  runCandidateJob,
  type CandidateRunnerServices,
} from "./candidate-run.js";
import { readCandidateVisualTokens } from "./candidate-visual-report.js";
import {
  altitudeButtonRuntimeRecipeIdentity,
  readVerifiedRuntimeArtifact,
  type RuntimeArtifactManifest,
  type RuntimeInputManifest,
} from "./runtime-artifact.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const parentId = "00000000-0000-4000-8000-000000000001";
const visualId = "00000000-0000-4000-8000-000000000004";

/** Recorded source/topology/style data with a synthetic data-only runtime.
 * The module throws if evaluated. This tests worker joins and read-only reuse,
 * not a fresh source build or browser/Figma conversion. */
function fixture() {
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-visual-worker-")),
  );
  const repo = path.join(root, "repo"),
    jobs = path.join(repo, "private/source-candidate-app"),
    parentDirectory = path.join(jobs, parentId),
    directory = path.join(jobs, visualId);
  mkdirSync(parentDirectory, { recursive: true });
  mkdirSync(directory);
  const pack = JSON.parse(
    readFileSync(
      new URL("./fixtures/source-visual-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const raw = gunzipSync(Buffer.from(pack.payload, "base64"));
  assert.equal(sha(raw), pack.payloadSha256);
  const recorded = JSON.parse(raw.toString()) as SourceVisualContractInput;
  const sourcePath = recorded.source.modulePath!;
  const request = {
    version: 1 as const,
    baseline: {
      id: "2d9e45b2-b81c-4712-b0e9-e029c0ff10df",
      sha256: "a".repeat(64),
    },
    supplement: {
      id: "7b7f1412-acae-4c21-8348-8fcc94557089",
      sha256: "e".repeat(64),
    },
  };
  const selection = {
    id: "00000000-0000-4000-8000-000000000003",
    request,
    reportSha256: "b".repeat(64),
    evidence: {
      request,
      source: recorded.source,
      sourcePath,
      sourceProgramSha256: recorded.semantics.source.programSha256,
      sourceRevision: recorded.semantics.source.revision,
      rows: recorded.semantics.cases.map((row) => {
        const source = recorded.cases.find((c) => c.expectedCaseId === row.id);
        return {
          story: row.story,
          runId: row.id.split(":")[0],
          eligible: !!source,
          problems: source ? [] : ["binding-original-source-refused"],
          ...(source
            ? {
                semantics: source.semantics,
                topology: {
                  tree: source.tree.root,
                  treeSha256: source.tree.sha256,
                },
              }
            : {}),
        };
      }),
    },
    report: {
      version: 1,
      request,
      sourceProgramSha256: recorded.semantics.source.programSha256,
      sourceStable: true,
      rows: recorded.semantics.cases.map((row) => {
        const source = recorded.cases.find((c) => c.expectedCaseId === row.id);
        return {
          story: row.story,
          status: source ? "structure-matched" : "refused",
          problems: source ? [] : ["binding-original-source-refused"],
          boundTopology: source?.boundTopology,
        };
      }),
    },
  } as VerifiedBindingSelection;
  const inputBase = {
    version: 1 as const,
    adapter: "altitude-button-v1" as const,
    sourceRevision: selection.evidence.sourceRevision,
    files: [
      {
        path: sourcePath,
        bytes: Buffer.byteLength(recorded.source.source),
        sha256: recorded.source.sourceSha256,
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
  const declaration = recorded.cases[0].semantics.declaration!;
  const properties = declaration.properties.map((property) => {
    assert.equal(typeof property.typeText, "string");
    return {
      name: property.name,
      typeText: property.typeText!,
      writable: property.name !== "slotNodes",
      sourcePath,
      declaringClass: "ALButton",
      reason:
        property.name === "slotNodes"
          ? ("computed-query" as const)
          : ("lit-property" as const),
    };
  });
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
    writableProperties: properties.filter((p) => p.writable).map((p) => p.name),
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
    ["button.js", Buffer.from('throw new Error("runtime-must-not-execute")')],
    ["button.d.ts", Buffer.from("export declare class ALButton {}")],
    ["theme.css", Buffer.from(":root{--fixture:blue}")],
  ]);
  const manifest: RuntimeArtifactManifest = {
    version: 1,
    kind: "original-custom-element-runtime",
    adapter: "altitude-button-v1",
    source: {
      revision: inputs.sourceRevision,
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
    consumedInputs: [sourcePath],
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
  const manifestBytes = Buffer.from(JSON.stringify(manifest) + "\n"),
    artifactRevision = "sha256:" + sha(manifestBytes),
    archive = path.join(parentDirectory, "runtime", artifactRevision.slice(7));
  mkdirSync(archive, { recursive: true });
  writeFileSync(path.join(archive, "manifest.json"), manifestBytes);
  for (const [name, bytes] of files)
    writeFileSync(path.join(archive, name), bytes);
  const artifact = readVerifiedRuntimeArtifact(archive, artifactRevision);
  const report = buildCandidatePreparationReport(selection, artifact, inputs),
    reportBytes = Buffer.from(JSON.stringify(report) + "\n");
  writeFileSync(path.join(parentDirectory, "report.json"), reportBytes);
  const parent: CandidateJobRecord = {
    version: 1,
    id: parentId,
    request,
    binding: { id: selection.id, reportSha256: selection.reportSha256 },
    sourceProgramSha256: selection.evidence.sourceProgramSha256,
    sourceRevision: selection.evidence.sourceRevision,
    state: "complete",
    startedAt: "2026-09-15T00:00:00.000Z",
    reportSha256: sha(reportBytes),
  };
  const job: CandidateVisualJobRecord = {
    version: 2,
    operation: "source-visual-assembly",
    id: visualId,
    request,
    binding: parent.binding,
    preparation: { id: parentId, reportSha256: parent.reportSha256! },
    sourceProgramSha256: parent.sourceProgramSha256,
    sourceRevision: parent.sourceRevision,
    state: "running",
    startedAt: "2026-09-15T00:00:01.000Z",
  };
  const saveParent = () =>
    writeFileSync(
      path.join(parentDirectory, "job.json"),
      JSON.stringify(parent),
    );
  const saveJob = () =>
    writeFileSync(path.join(directory, "job.json"), JSON.stringify(job));
  saveParent();
  saveJob();
  const tokenPath = path.join(
    repo,
    "examples/altitude/tokens/modes/altitude.dark.dtcg.json",
  );
  mkdirSync(path.dirname(tokenPath), { recursive: true });
  writeFileSync(
    tokenPath,
    readFileSync(
      new URL(
        "../examples/altitude/tokens/modes/altitude.dark.dtcg.json",
        import.meta.url,
      ),
    ),
  );
  let prepared = 0;
  const services: CandidateRunnerServices = {
    selectLatestVerified: () => structuredClone(selection),
    inspectInputs: (checkout) => {
      assert.equal(checkout, path.join(root, "altitude"));
      return structuredClone(inputs);
    },
    prepare: () => {
      prepared++;
      return artifact;
    },
  };
  return {
    repo,
    jobs,
    directory,
    parentDirectory,
    archive,
    report,
    parent,
    job,
    inputs,
    tokenPath,
    selection,
    services,
    saveParent,
    saveJob,
    preparations: () => prepared,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("visual worker reuses verified parent bytes, assembles full recorded cohort, and never prepares or imports", () => {
  const f = fixture();
  try {
    const parentBytes = readFileSync(path.join(f.parentDirectory, "job.json")),
      jobBytes = readFileSync(path.join(f.directory, "job.json"));
    const result = runCandidateJob(f.repo, visualId, f.services);
    assert.equal(result.version, 2);
    if (result.version !== 2) assert.fail("expected visual report");
    assert.equal(result.status, "measured-candidate");
    assert.equal(result.acceptedContract, null);
    assert.equal(result.qualification, "observed-values-only");
    assert.equal(result.visual.cases.length, 7);
    assert.equal(
      result.visual.cases.filter((c) => c.status === "projected").length,
      6,
    );
    assert.equal(result.tokenBindings.cases.length, 7);
    assert.equal(f.preparations(), 0);
    assert.equal(existsSync(path.join(f.directory, "runtime")), false);
    assert.deepEqual(readdirSync(f.directory).sort(), [
      "job.json",
      "report.json",
    ]);
    assert.deepEqual(
      readFileSync(path.join(f.parentDirectory, "job.json")),
      parentBytes,
    );
    assert.deepEqual(
      readFileSync(path.join(f.directory, "job.json")),
      jobBytes,
    );
    assert.deepEqual(
      JSON.parse(readFileSync(path.join(f.directory, "report.json"), "utf8")),
      result,
    );
    assert.throws(
      () => runCandidateJob(f.repo, visualId, f.services),
      /artifact-exists/,
    );
  } finally {
    f.close();
  }
});

test("visual worker refuses stale, failed, interrupted or superseded parents without fallback", async (t) => {
  for (const mutation of [
    "failed",
    "interrupted",
    "stale-binding",
    "report-hash",
    "newer-failed",
    "newer-running",
    "newer-complete",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      try {
        if (mutation === "failed" || mutation === "interrupted") {
          f.parent.state = mutation;
          f.saveParent();
        }
        if (mutation === "stale-binding")
          f.selection.reportSha256 = "f".repeat(64);
        if (mutation === "report-hash")
          writeFileSync(path.join(f.parentDirectory, "report.json"), "{}");
        if (mutation.startsWith("newer-")) {
          const next = {
            ...f.parent,
            id: "00000000-0000-4000-8000-000000000005",
            startedAt: "2026-09-15T00:00:02.000Z",
            state: mutation.slice(6),
          };
          mkdirSync(path.join(f.jobs, next.id));
          writeFileSync(
            path.join(f.jobs, next.id, "job.json"),
            JSON.stringify(next),
          );
        }
        assert.throws(
          () => runCandidateJob(f.repo, visualId, f.services),
          /candidate-/,
        );
        assert.equal(f.preparations(), 0);
        assert.equal(existsSync(path.join(f.directory, "report.json")), false);
      } finally {
        f.close();
      }
    });
});

test("assembly rechecks source, runtime, parent, latest binding, token and own metadata before write", async (t) => {
  for (const mutation of [
    "source",
    "runtime",
    "parent-metadata",
    "parent-report",
    "newer-parent",
    "binding",
    "tokens",
    "job-metadata",
    "output-race",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      try {
        let reads = 0;
        f.services.readVisualTokens = (repo) => {
          const tokens = readCandidateVisualTokens(repo);
          if (reads++ === 0) {
            if (mutation === "source")
              f.inputs.files[0].sha256 = "f".repeat(64);
            if (mutation === "runtime")
              writeFileSync(path.join(f.archive, "button.js"), "changed");
            if (mutation === "parent-metadata") {
              f.parent.startedAt = "2026-09-15T00:00:00.001Z";
              f.saveParent();
            }
            if (mutation === "parent-report")
              writeFileSync(path.join(f.parentDirectory, "report.json"), "{}");
            if (mutation === "newer-parent") {
              const next = {
                ...f.parent,
                id: "00000000-0000-4000-8000-000000000005",
                startedAt: "2026-09-15T00:00:02.000Z",
                state: "failed",
              };
              mkdirSync(path.join(f.jobs, next.id));
              writeFileSync(
                path.join(f.jobs, next.id, "job.json"),
                JSON.stringify(next),
              );
            }
            if (mutation === "binding")
              f.selection.reportSha256 = "f".repeat(64);
            if (mutation === "tokens")
              writeFileSync(f.tokenPath, tokens.json + "\n");
            if (mutation === "job-metadata") {
              f.job.startedAt = "2026-09-15T00:00:01.001Z";
              f.saveJob();
            }
            if (mutation === "output-race")
              writeFileSync(
                path.join(f.directory, "report.json"),
                "preserve concurrent bytes",
              );
          }
          return tokens;
        };
        assert.throws(() => runCandidateJob(f.repo, visualId, f.services));
        assert.equal(f.preparations(), 0);
        if (mutation === "output-race")
          assert.equal(
            readFileSync(path.join(f.directory, "report.json"), "utf8"),
            "preserve concurrent bytes",
          );
        else
          assert.equal(
            existsSync(path.join(f.directory, "report.json")),
            false,
          );
      } finally {
        f.close();
      }
    });
});

test("visual metadata cannot select arbitrary parent paths, runtime paths or operations", async (t) => {
  for (const mutation of [
    "operation",
    "preparation-path",
    "preparation-hash",
    "preparation-extra",
    "self-parent",
    "parent-symlink",
    "report-symlink",
    "extra",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      try {
        if (mutation === "operation") f.job.operation = "prepare" as never;
        if (mutation === "preparation-path")
          f.job.preparation.id = "../outside";
        if (mutation === "preparation-hash")
          f.job.preparation.reportSha256 = "not-a-hash";
        if (mutation === "preparation-extra")
          Object.assign(f.job.preparation, { path: "/outside" });
        if (mutation === "self-parent") f.job.preparation.id = visualId;
        if (mutation === "extra") Object.assign(f.job, { runtime: "/outside" });
        if (mutation === "parent-symlink") {
          rmSync(f.parentDirectory, { recursive: true });
          symlinkSync(f.directory, f.parentDirectory);
        }
        if (mutation === "report-symlink") {
          rmSync(path.join(f.parentDirectory, "report.json"));
          symlinkSync(f.tokenPath, path.join(f.parentDirectory, "report.json"));
        }
        f.saveJob();
        assert.throws(() => runCandidateJob(f.repo, visualId, f.services));
        assert.equal(f.preparations(), 0);
        assert.equal(existsSync(path.join(f.directory, "report.json")), false);
      } finally {
        f.close();
      }
    });
});

test("legacy version-one jobs still prepare and retain the original report schema", () => {
  const f = fixture();
  try {
    const {
      operation: _operation,
      preparation: _preparation,
      ...common
    } = f.job;
    writeFileSync(
      path.join(f.directory, "job.json"),
      JSON.stringify({ ...common, version: 1 }),
    );
    f.services.readVisualTokens = () =>
      assert.fail("legacy worker must not assemble visual report");
    const result = runCandidateJob(f.repo, visualId, f.services);
    assert.equal(result.version, 1);
    assert.equal(result.status, "prepared");
    assert.equal(result.qualification, "source-and-runtime-only");
    assert.equal("visual" in result, false);
    assert.equal(f.preparations(), 1);
    assert.equal(existsSync(path.join(f.directory, "runtime")), true);
  } finally {
    f.close();
  }
});
