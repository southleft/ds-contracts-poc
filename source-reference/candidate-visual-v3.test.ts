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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { revisionOf } from "../core/contract-provenance.js";
import { buildCandidatePreparationReport } from "./candidate-report.js";
import {
  runCandidateJob,
  type CandidateRunnerServices,
} from "./candidate-run.js";
import {
  altitudeButtonRuntimeRecipeIdentity,
  readVerifiedRuntimeArtifact,
  type RuntimeArtifactManifest,
  type RuntimeInputManifest,
} from "./runtime-artifact.js";
import { loadRecordedSourceProgram } from "./source-program.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";
import {
  createCandidateJobs,
  type AnyCandidateJobRecord,
  type CandidateJobRecord,
  type CandidateVisualJobRecord,
  type CandidateJobsOptions,
} from "./candidate-jobs.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";

const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** Scheduling/version fixture only. The custom validator authenticates this
 * small receipt; it does not qualify source behavior or native output. */
function managerFixture() {
  const directory = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-v3-manager-")),
  );
  const repo = path.join(directory, "repo"),
    root = path.join(repo, "private/source-candidate-app");
  mkdirSync(repo);
  const request = {
    version: 1 as const,
    baseline: {
      id: "00000000-0000-4000-8000-000000000001",
      sha256: "a".repeat(64),
    },
  };
  const selection = {
    id: "00000000-0000-4000-8000-000000000002",
    request,
    reportSha256: "b".repeat(64),
    report: { sourceProgramSha256: "c".repeat(64) },
    evidence: {
      sourceProgramSha256: "c".repeat(64),
      sourceRevision: "d".repeat(40),
      source: { source: "PRIVATE SOURCE" },
    },
  } as VerifiedBindingSelection;
  const runs: string[] = [],
    callbacks = new Map<string, (error: unknown) => void>(),
    managers: ReturnType<typeof createCandidateJobs>[] = [],
    validatedVersions: number[] = [];
  const options: CandidateJobsOptions = {
    selectLatestVerified: () => structuredClone(selection),
    validateReport: (report) => {
      assert.equal(report.fixture, "prepared-v1");
      return { counters: { prepared: 1 } };
    },
    validateVisualReport: (report, context) => {
      validatedVersions.push(report.version);
      assert.equal(report.fixture, `visual-v${report.version}`);
      assert.deepEqual(report.preparation, {
        id: context.preparation.id,
        reportSha256: context.preparation.reportSha256,
      });
      return {
        counters: { plannedCases: 7, projectedCases: 6, refusedCases: 1 },
      };
    },
    run: (args, done) => {
      assert.deepEqual(args.slice(0, 3), [
        "--import",
        "tsx",
        "source-reference/candidate-run.ts",
      ]);
      assert.equal(args.length, 4);
      runs.push(args[3]);
      callbacks.set(args[3], done);
      return { kill: () => true };
    },
  };
  const open = (version?: 2 | 3) => {
    const manager = createCandidateJobs(repo, {
      ...options,
      ...(version === undefined ? {} : { visualJobVersion: version }),
    });
    managers.push(manager);
    return manager;
  };
  const readJob = (id: string): AnyCandidateJobRecord =>
    JSON.parse(readFileSync(path.join(root, id, "job.json"), "utf8"));
  const bytes = (id: string) => ({
    job: readFileSync(path.join(root, id, "job.json")),
    report: readFileSync(path.join(root, id, "report.json")),
  });
  const complete = (id: string, version?: number) => {
    const job = readJob(id);
    const report = {
      version: version ?? job.version,
      request: job.request,
      binding: job.binding,
      sourceProgramSha256: job.sourceProgramSha256,
      ...(job.version === 1 ? {} : { preparation: job.preparation }),
      status: job.version === 1 ? "prepared" : "measured-candidate",
      acceptedContract: null,
      fixture:
        job.version === 1 ? "prepared-v1" : `visual-v${version ?? job.version}`,
    };
    writeFileSync(path.join(root, id, "report.json"), JSON.stringify(report));
    callbacks.get(id)!(null);
  };
  const prepare = (manager: ReturnType<typeof createCandidateJobs>) => {
    const parent = manager.start(request);
    complete(parent.id);
    assert.equal(manager.selectLatestPreparedVerified(request).id, parent.id);
    return parent;
  };
  const insertNewerPreparation = (
    parentId: string,
    state: "failed" | "running" | "interrupted",
  ) => {
    const id = "00000000-0000-4000-8000-000000000009";
    const record = {
      ...readJob(parentId),
      id,
      state,
      startedAt: "2099-01-01T00:00:00.000Z",
    };
    delete record.reportSha256;
    mkdirSync(path.join(root, id));
    writeFileSync(path.join(root, id, "job.json"), JSON.stringify(record));
    return id;
  };
  return {
    repo,
    root,
    request,
    options,
    runs,
    validatedVersions,
    open,
    prepare,
    readJob,
    bytes,
    complete,
    insertNewerPreparation,
    close() {
      for (const manager of managers) manager.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("v2 remains the manager default and historical v2 reopens under v3 without replay or rewriting", () => {
  const f = managerFixture();
  try {
    const old = f.open(),
      parent = f.prepare(old),
      visual = old.startVisual(f.request);
    assert.equal(f.readJob(visual.id).version, 2);
    f.complete(visual.id);
    const parentBytes = f.bytes(parent.id),
      oldBytes = f.bytes(visual.id);
    old.close();
    const current = f.open(3);
    const rows = current.list(f.request.baseline.id);
    assert.equal(
      rows.find((row) => row.id === visual.id)!.phase,
      "measured-candidate",
    );
    assert.equal(
      rows.find((row) => row.id === visual.id)!.operation,
      "source-visual-assembly",
    );
    assert.equal(current.selectLatestPreparedVerified(f.request).id, parent.id);
    assert.equal(f.runs.length, 2);
    assert.ok(f.validatedVersions.includes(2));
    assert.deepEqual(f.bytes(parent.id), parentBytes);
    assert.deepEqual(f.bytes(visual.id), oldBytes);
    assert.doesNotMatch(
      JSON.stringify(rows),
      /PRIVATE SOURCE|fixture|reportSha256|sourceProgramSha256/,
    );
  } finally {
    f.close();
  }
});

test("v2 to v3 upgrade creates one new attempt, selects matching versions, and remains idempotent", () => {
  const f = managerFixture();
  try {
    const old = f.open(2),
      parent = f.prepare(old),
      v2 = old.startVisual(f.request);
    f.complete(v2.id);
    const prior = f.bytes(v2.id),
      prepared = f.bytes(parent.id);
    old.close();
    const current = f.open(3),
      v3 = current.startVisual(f.request);
    assert.notEqual(v3.id, v2.id);
    const job = f.readJob(v3.id);
    assert.equal(job.version, 3);
    assert.deepEqual(job.preparation, {
      id: parent.id,
      reportSha256: sha(prepared.report),
    });
    assert.equal(v3.phase, "assembling");
    assert.equal(current.startVisual(f.request).id, v3.id);
    assert.equal(current.startVisual(f.request, true).id, v3.id);
    assert.equal(f.runs.length, 3);
    f.complete(v3.id);
    assert.equal(current.startVisual(f.request).id, v3.id);
    assert.equal(
      current.list(f.request.baseline.id).find((row) => row.id === v3.id)!
        .phase,
      "measured-candidate",
    );
    const v3Bytes = f.bytes(v3.id);
    current.close();
    const reopened = f.open(3),
      legacy = f.open(2);
    assert.equal(reopened.startVisual(f.request).id, v3.id);
    assert.equal(legacy.startVisual(f.request).id, v2.id);
    assert.equal(f.runs.length, 3);
    const retry = reopened.startVisual(f.request, true);
    assert.notEqual(retry.id, v3.id);
    assert.equal(f.readJob(retry.id).version, 3);
    f.complete(retry.id);
    assert.equal(f.runs.length, 4);
    assert.deepEqual(f.bytes(v2.id), prior);
    assert.deepEqual(f.bytes(parent.id), prepared);
    assert.deepEqual(f.bytes(v3.id), v3Bytes);
  } finally {
    f.close();
  }
});

test("unsupported configured visual job versions are refused before launch or history creation", () => {
  const f = managerFixture();
  try {
    const initial = f.open(),
      parent = f.prepare(initial);
    initial.close();
    const prepared = f.bytes(parent.id);
    for (const version of [1, 4, 0, -1, Number.NaN, "3", null]) {
      const manager = f.open(version as never);
      assert.throws(
        () => manager.startVisual(f.request),
        /candidate-job-.*version/,
      );
    }
    assert.equal(f.runs.length, 1);
    assert.deepEqual(readdirSync(f.root), [parent.id]);
    assert.deepEqual(f.bytes(parent.id), prepared);
  } finally {
    f.close();
  }
});

test("v3 job cannot seal a v2 report and v2 job cannot adopt a v3 report", async (t) => {
  for (const version of [2, 3] as const)
    await t.test(`job-v${version}`, () => {
      const f = managerFixture();
      try {
        const manager = f.open(version),
          parent = f.prepare(manager),
          visual = manager.startVisual(f.request);
        const prepared = f.bytes(parent.id);
        f.complete(visual.id, version === 2 ? 3 : 2);
        const result = manager
          .list(f.request.baseline.id)
          .find((row) => row.id === visual.id)!;
        assert.equal(result.state, "failed");
        assert.equal(result.phase, "failed");
        assert.equal(f.readJob(visual.id).reportSha256, undefined);
        assert.deepEqual(f.bytes(parent.id), prepared);
      } finally {
        f.close();
      }
    });
});

test("v3 upgrade never falls back past a newer failed, running or interrupted preparation", async (t) => {
  for (const state of ["failed", "running", "interrupted"] as const)
    await t.test(state, () => {
      const f = managerFixture();
      try {
        const old = f.open(2),
          parent = f.prepare(old),
          v2 = old.startVisual(f.request);
        f.complete(v2.id);
        const original = f.bytes(v2.id),
          prepared = f.bytes(parent.id);
        old.close();
        const current = f.open(3);
        f.insertNewerPreparation(parent.id, state);
        assert.throws(
          () => current.startVisual(f.request),
          /latest-preparation-unavailable/,
        );
        assert.throws(
          () => current.startVisual(f.request, true),
          /latest-preparation-unavailable/,
        );
        assert.equal(f.runs.length, 2);
        assert.deepEqual(f.bytes(v2.id), original);
        assert.deepEqual(f.bytes(parent.id), prepared);
      } finally {
        f.close();
      }
    });
});

test("v3 rechecks its selected preparation during completion and does not replay an invalid result", () => {
  const f = managerFixture();
  try {
    const manager = f.open(3),
      parent = f.prepare(manager),
      visual = manager.startVisual(f.request);
    const prepared = f.bytes(parent.id);
    f.insertNewerPreparation(parent.id, "failed");
    f.complete(visual.id);
    assert.equal(manager.startVisual(f.request).state, "failed");
    assert.throws(
      () => manager.startVisual(f.request, true),
      /latest-preparation-unavailable/,
    );
    assert.equal(f.runs.length, 2);
    assert.deepEqual(f.bytes(parent.id), prepared);
  } finally {
    f.close();
  }
});

test("v3 rejects a parent added inside trusted visual validation", () => {
  const f = managerFixture();
  try {
    const initial = f.open(3),
      parent = f.prepare(initial);
    initial.close();
    const original = f.options.validateVisualReport!;
    f.options.validateVisualReport = (report, context) => {
      const summary = original(report, context);
      f.insertNewerPreparation(parent.id, "failed");
      return summary;
    };
    const manager = f.open(3),
      visual = manager.startVisual(f.request);
    f.complete(visual.id);
    assert.equal(
      manager.list(f.request.baseline.id).find((row) => row.id === visual.id)!
        .state,
      "failed",
    );
    assert.equal(f.readJob(visual.id).reportSha256, undefined);
    assert.equal(f.runs.length, 2);
  } finally {
    f.close();
  }
});

const parentId = "00000000-0000-4000-8000-000000000001";
const visualId = "00000000-0000-4000-8000-000000000004";

/** Recorded source/topology/style data with a synthetic data-only runtime.
 * The module throws if evaluated. This tests worker joins and read-only reuse,
 * not a fresh source build or browser/Figma conversion. */
function workerFixture(version: 2 | 3) {
  const root = realpathSync(
    mkdtempSync(path.join(tmpdir(), "candidate-v3-worker-")),
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
  const sourcePack = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/source-program-button-recorded.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const sourcePath = path.posix.join(
    path.posix.dirname(sourcePack.manifestPath),
    recorded.source.modulePath!,
  );
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
  // Record the inherited helper source for v3. This temp checkout is read as
  // data only; no original module, build tool or source browser is executed.
  const sourceCheckout = path.join(root, "recorded-source"),
    sourceHashes: Record<string, string> = {};
  const putSource = (file: string, text: string) => {
    mkdirSync(path.dirname(path.join(sourceCheckout, file)), {
      recursive: true,
    });
    writeFileSync(path.join(sourceCheckout, file), text);
    sourceHashes[file] = sha(text);
  };
  putSource(sourcePack.manifestPath, "{}");
  for (const [file, record] of Object.entries(sourcePack.files) as Array<
    [string, { text: string; sha256: string }]
  >) {
    assert.equal(sha(record.text), record.sha256);
    putSource(file, record.text);
  }
  const program = loadRecordedSourceProgram({
    checkout: sourceCheckout,
    revision: sourcePack.sourceRevision,
    manifestPath: sourcePack.manifestPath,
    manifestSha256: sourceHashes[sourcePack.manifestPath],
    modulePath: "components/button/button.ts",
    className: "ALButton",
    sourceHashes,
  });
  assert.notEqual(program.status, "refused");
  selection.evidence.sourceProgram = program;
  selection.evidence.sourceProgramSha256 = program.digest;
  selection.report.sourceProgramSha256 = program.digest;
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
    version,
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

test("worker dispatches v2 and v3 reports from pinned originals without preparing or importing runtime", async (t) => {
  for (const version of [2, 3] as const)
    await t.test(`v${version}`, () => {
      const f = workerFixture(version);
      try {
        const parentJob = readFileSync(
            path.join(f.parentDirectory, "job.json"),
          ),
          parentReport = readFileSync(
            path.join(f.parentDirectory, "report.json"),
          ),
          job = readFileSync(path.join(f.directory, "job.json"));
        const result = runCandidateJob(f.repo, visualId, f.services);
        assert.equal(result.version, version);
        assert.equal(
          result.status,
          "measured-candidate",
          JSON.stringify(
            result.version === 3
              ? {
                  token: result.tokenProjection.problems,
                  wrapper: result.wrapperProjection.problems,
                  cases: result.wrapperProjection.cases.map((row) => ({
                    id: row.id,
                    problems: row.problems,
                  })),
                }
              : result.visual.problems,
          ),
        );
        assert.equal(result.acceptedContract, null);
        if (result.version === 3) {
          assert.equal(
            result.tokenProjection.status,
            "source-token-projected-candidate",
          );
          assert.equal(result.tokenProjection.rewrites.length, 11);
          assert.equal(result.tokenProjection.sourceTokenPaths.length, 9);
          assert.equal(
            result.wrapperProjection.status,
            "snapshot-wrappers-observed",
          );
          assert.equal(result.wrapperProjection.selectedWrappers.length, 2);
          assert.equal(
            result.wrapperProjection.cases.flatMap((row) => row.snapshots)
              .length,
            12,
          );
          assert.equal(
            result.tokenProjection.unqualifiedRuntimeBinding!.version,
            0,
          );
        } else {
          assert.equal(Object.hasOwn(result, "tokenProjection"), false);
          assert.equal(Object.hasOwn(result, "wrapperProjection"), false);
        }
        assert.equal(f.preparations(), 0);
        assert.equal(existsSync(path.join(f.directory, "runtime")), false);
        assert.deepEqual(readdirSync(f.directory).sort(), [
          "job.json",
          "report.json",
        ]);
        assert.deepEqual(
          readFileSync(path.join(f.parentDirectory, "job.json")),
          parentJob,
        );
        assert.deepEqual(
          readFileSync(path.join(f.parentDirectory, "report.json")),
          parentReport,
        );
        assert.deepEqual(readFileSync(path.join(f.directory, "job.json")), job);
        assert.deepEqual(
          JSON.parse(
            readFileSync(path.join(f.directory, "report.json"), "utf8"),
          ),
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
});

test("v3 worker refuses unsupported versions and superseded preparation without any report or build", async (t) => {
  for (const mutation of [
    "version",
    "newer-failed",
    "parent-hash",
    "job-pin",
  ] as const)
    await t.test(mutation, () => {
      const f = workerFixture(3);
      try {
        if (mutation === "version") {
          f.job.version = 4 as never;
          f.saveJob();
        }
        if (mutation === "parent-hash")
          writeFileSync(path.join(f.parentDirectory, "report.json"), "{}");
        if (mutation === "job-pin") {
          f.job.preparation.reportSha256 = "f".repeat(64);
          f.saveJob();
        }
        if (mutation === "newer-failed") {
          const id = "00000000-0000-4000-8000-000000000005";
          mkdirSync(path.join(f.jobs, id));
          writeFileSync(
            path.join(f.jobs, id, "job.json"),
            JSON.stringify({
              ...f.parent,
              id,
              state: "failed",
              startedAt: "2026-09-15T00:00:02.000Z",
            }),
          );
        }
        assert.throws(
          () => runCandidateJob(f.repo, visualId, f.services),
          /candidate-/,
        );
        assert.equal(f.preparations(), 0);
        assert.equal(existsSync(path.join(f.directory, "report.json")), false);
        assert.equal(existsSync(path.join(f.directory, "runtime")), false);
      } finally {
        f.close();
      }
    });
});
