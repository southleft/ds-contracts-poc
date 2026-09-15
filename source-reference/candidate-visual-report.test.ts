import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { revisionOf } from "../core/contract-provenance.js";
import { emitReact } from "../core/emit-react.js";
import { createFigmaEngine, type NodeSpec } from "../core/emit-figma-script.js";
import { flattenTokens } from "../core/tokens.js";
import type { RuntimeArtifactForEmission } from "../core/runtime-emission.js";
import { prepareNativeSourceCandidate } from "./native-source-candidate.js";
import { prepareNativeSourceInspectionPlan } from "./native-source-plan.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import { altitudeCohort, altitudeButtonVariants } from "./altitude-cohort.js";
import type { CandidateVisualValidationContext } from "./candidate-jobs.js";
import type { CandidatePreparationReport } from "./candidate-report.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";
import { loadRecordedSourceProgram } from "./source-program.js";
import {
  buildCandidateVisualReport,
  buildCandidateVisualReportV3,
  createCandidateVisualValidator,
  readCandidateVisualTokens,
} from "./candidate-visual-report.js";

const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const repository = fileURLToPath(new URL("..", import.meta.url));

/** Original source/tree/semantic records with a data-only preparation handle.
 * Runtime verification is the manager's separate v1 validator; this fixture
 * must never build or load the source runtime to exercise visual assembly. */
function fixture() {
  const pack = JSON.parse(
    readFileSync(
      new URL("./fixtures/source-visual-button-recorded.json", import.meta.url),
      "utf8",
    ),
  );
  const bytes = gunzipSync(Buffer.from(pack.payload, "base64"));
  assert.equal(sha(bytes), pack.payloadSha256);
  const input = JSON.parse(bytes.toString()) as SourceVisualContractInput;
  const request = {
    version: 1 as const,
    baseline: {
      id: input.semantics.cases[0].id.split(":")[0],
      sha256: "a".repeat(64),
    },
    supplement: {
      id: input.semantics.cases[4].id.split(":")[0],
      sha256: "b".repeat(64),
    },
  };
  const selection: VerifiedBindingSelection = {
    id: "00000000-0000-4000-8000-000000000001",
    request,
    reportSha256: "c".repeat(64),
    evidence: {
      request,
      source: input.source,
      sourcePath: input.source.modulePath,
      sourceProgramSha256: input.semantics.source.programSha256,
      sourceRevision: input.semantics.source.revision,
      rows: input.semantics.cases.map((row) => {
        const raw = input.cases.find((item) => item.expectedCaseId === row.id);
        return {
          runId: row.id.split(":")[0],
          story: row.story!,
          eligible: row.status === "structure-matched",
          problems: [...row.problems],
          profile: [...altitudeCohort, ...altitudeButtonVariants].find(
            (entry) => entry.story === row.story,
          )!.profile,
          ...(raw
            ? {
                semantics: raw.semantics,
                topology: {
                  hostPath: ["al-button"],
                  rootPath: ["al-button", "button"],
                  stageSelector: "#storybook-root",
                  channels: [],
                  varPrefix: "--al-",
                  tree: raw.tree.root,
                  treeSha256: raw.tree.sha256,
                  sourcePngSha256: raw.semantics.sourcePngSha256,
                },
              }
            : {}),
        };
      }),
    },
    report: {
      version: 1,
      request,
      sourceProgramSha256: input.semantics.source.programSha256,
      sourceStable: true,
      scope: "Recorded original fixture; no new replay or source build.",
      rows: input.semantics.cases.map((row) => ({
        story: row.story!,
        status: row.status,
        problems: [...row.problems],
        matchedElements: row.nodes.length,
        mappedSlots: 0,
        observedDependencies: 0,
        plannedDependencies: 0,
        differentials: [],
        boundTopology: input.cases.find(
          (item) => item.expectedCaseId === row.id,
        )?.boundTopology,
      })),
    },
  };
  const prepared: CandidatePreparationReport = {
    version: 1,
    request,
    binding: { id: selection.id, reportSha256: selection.reportSha256 },
    sourceProgramSha256: input.semantics.source.programSha256,
    status: "prepared",
    acceptedContract: null,
    adapter: "altitude-button-runtime-v1",
    qualification: "source-and-runtime-only",
    source: {
      revision: input.semantics.source.revision,
      inputRevision: "d".repeat(64),
    },
    runtime: {
      artifactRevision: input.semantics.runtime!.artifactRevision,
      interfaceRevision: input.semantics.runtime!.interfaceRevision,
    },
    semanticsRevision: revisionOf(input.semantics),
    semantics: input.semantics,
  };
  const preparation = {
    id: "00000000-0000-4000-8000-000000000002",
    reportSha256: sha(JSON.stringify(prepared)),
    report: prepared,
  };
  const tokens = readCandidateVisualTokens(repository);
  const context: CandidateVisualValidationContext = {
    directory: path.join(
      repository,
      "private/source-candidate-app/00000000-0000-4000-8000-000000000003",
    ),
    selection,
    preparation: {
      ...preparation,
      directory: path.join(
        repository,
        "private/source-candidate-app",
        preparation.id,
      ),
      selection,
    },
    readArtifact() {
      throw Error(
        "Visual validation must not read or rebuild runtime artifacts.",
      );
    },
  };
  let tokenReads = 0;
  const validate = createCandidateVisualValidator((root) => {
    assert.equal(path.resolve(root), path.resolve(repository));
    tokenReads++;
    return tokens;
  });
  return {
    input,
    selection,
    preparation,
    tokens,
    context,
    validate,
    tokenReads: () => tokenReads,
  };
}

/** Authenticate the original checked-in source graph without importing or
 * building it. Temporary text files only provide the loader's byte boundary. */
function v3Fixture() {
  const f = fixture();
  const pack = JSON.parse(
    readFileSync(
      new URL(
        "./fixtures/source-program-button-recorded.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const directory = mkdtempSync(
    path.join(tmpdir(), "candidate-visual-report-"),
  );
  try {
    const sourceHashes: Record<string, string> = {};
    const put = (name: string, text: string) => {
      mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
      writeFileSync(path.join(directory, name), text);
      sourceHashes[name] = sha(text);
    };
    put(pack.manifestPath, "{}");
    for (const [name, record] of Object.entries(pack.files) as Array<
      [string, { text: string; sha256: string }]
    >) {
      assert.equal(sha(record.text), record.sha256);
      put(name, record.text);
    }
    const program = loadRecordedSourceProgram({
      checkout: directory,
      revision: pack.sourceRevision,
      manifestPath: pack.manifestPath,
      manifestSha256: sourceHashes[pack.manifestPath],
      modulePath: "components/button/button.ts",
      className: "ALButton",
      sourceHashes,
    });
    f.selection.evidence.sourceProgram = program;
    f.selection.evidence.sourcePath = program.entryPath;
    f.selection.evidence.sourceProgramSha256 = program.digest;
    f.selection.report.sourceProgramSha256 = program.digest;
    f.preparation.report.sourceProgramSha256 = program.digest;
    f.preparation.report.semantics.source.programSha256 = program.digest;
    f.preparation.report.semanticsRevision = revisionOf(
      f.preparation.report.semantics,
    );
    f.preparation.reportSha256 = sha(JSON.stringify(f.preparation.report));
    f.context.preparation.reportSha256 = f.preparation.reportSha256;
    return f;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The native context's trust-boundary fixture retains actual source evidence
 * but uses a synthetic, hash-pinned runtime interface. It executes no runtime
 * and makes no native fidelity claim. */
function nativeContextFixture() {
  const f = v3Fixture();
  const iface = {
    module: { path: "fixture.js", exportName: "Fixture" },
    declaration: { path: "fixture.d.ts", exportName: "Fixture" },
    writableProperties: ["variant"],
    properties: [
      {
        name: "variant",
        typeText: "'secondary' | 'tertiary' | 'bare' | 'danger' | undefined",
        writable: true,
      },
    ],
    slots: [{ name: "before" }, { name: "" }, { name: "after" }],
    peerRuntime: {
      name: "react" as const,
      major: 19 as const,
      mounting: "direct-custom-element" as const,
    },
  };
  const artifact: RuntimeArtifactForEmission = {
    artifactRevision: f.preparation.report.runtime.artifactRevision,
    interfaceRevision: revisionOf(iface),
    interface: iface,
    registrationTag: "native-context-fixture",
    stylesheets: [],
  };
  f.preparation.report.runtime.interfaceRevision = artifact.interfaceRevision;
  f.preparation.report.semantics.runtime!.interfaceRevision =
    artifact.interfaceRevision;
  f.preparation.report.semanticsRevision = revisionOf(
    f.preparation.report.semantics,
  );
  f.preparation.reportSha256 = sha(JSON.stringify(f.preparation.report));
  const report = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  return { ...f, artifact, expectedReportRevision: revisionOf(report), report };
}

const nativeOperation = {
  id: "00000000-0000-4000-8000-000000000003",
  fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
};

test("native plan joins the complete source denominator, empty mains, comparison content and scoped variables", () => {
  const source = nativeContextFixture();
  const before = JSON.stringify(source);
  const { plan, revision } = prepareNativeSourceInspectionPlan({
    source,
    operation: nativeOperation,
  });
  assert.equal(plan.acceptedContract, null);
  assert.equal(plan.nativeQualification, "unqualified");
  assert.equal(plan.sourceProjection.binding.version, 0);
  assert.equal(plan.component.variants.length, 5);
  assert.deepEqual(plan.component.boolProps, []);
  assert.equal(plan.samples.cases.length, 7);
  assert.equal(
    plan.samples.cases.filter((c) => c.status === "lowered").length,
    6,
  );
  assert.equal(
    plan.samples.cases.filter((c) => c.status === "refused").length,
    1,
  );
  assert.equal(plan.samples.cases.flatMap((c) => c.slots).length, 7);
  assert.equal(plan.tokenPreparation.modes.length, 1);
  assert.equal(plan.tokenPreparation.modes[0].nativeModeName, "Dark");
  assert.ok(
    plan.tokenPreparation.requestedTokenPaths.includes(
      "theme-color-background-primary-default",
    ),
  );
  assert.ok(
    plan.tokenPreparation.requestedTokenPaths.includes("font-weight-bold"),
  );
  const variableNames = new Set(
    plan.tokenPreparation.variables.map((v) => v.name),
  );
  const boundNames = new Set<string>();
  const inspect = (node: NodeSpec) => {
    for (const name of Object.values(node.bindings ?? {})) boundNames.add(name);
    for (const name of [node.fill, node.stroke]) if (name) boundNames.add(name);
    if (node.type === "slot") assert.equal(node.children?.length ?? 0, 0);
    for (const child of node.children ?? []) inspect(child);
  };
  for (const variant of plan.component.variants) inspect(variant.spec);
  assert.ok(boundNames.size > 0);
  for (const name of boundNames)
    assert.ok(variableNames.has(name), `missing native variable ${name}`);
  assert.ok(
    plan.limitations.includes(
      "source-native-variable-carriage-not-channel-qualification",
    ),
  );
  assert.equal(revisionOf(plan), revision);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(
    prepareNativeSourceInspectionPlan({ source, operation: nativeOperation }),
    { plan, revision },
  );
  // A serialized plan is not engine write authority, even though its values
  // came from verified compilation. Operation integration must recompile.
  const context = prepareNativeSourceCandidate(source);
  const engine = createFigmaEngine({
    ...context.engineInput,
    icons: new Map(),
  });
  assert.throws(
    () => engine.buildBatchScript([plan.component], nativeOperation.fileKey),
    /FIGMA_COMPONENT_DATA_UNVERIFIED|NATIVE_SOURCE_CANDIDATE_WRITE_CONTEXT_REQUIRED/,
  );
});

test("native plan scopes target variables without changing source or comparison evidence", () => {
  const source = nativeContextFixture();
  const first = prepareNativeSourceInspectionPlan({
    source,
    operation: nativeOperation,
  });
  for (const operation of [
    { ...nativeOperation, id: "00000000-0000-4000-8000-000000000004" },
    { ...nativeOperation, fileKey: "AnotherNativeFile1234" },
  ]) {
    const next = prepareNativeSourceInspectionPlan({ source, operation });
    assert.notEqual(next.revision, first.revision);
    assert.notEqual(
      next.plan.tokenPreparation.revision,
      first.plan.tokenPreparation.revision,
    );
    assert.equal(
      next.plan.sourceProjectionRevision,
      first.plan.sourceProjectionRevision,
    );
    assert.equal(next.plan.componentRevision, first.plan.componentRevision);
    assert.equal(next.plan.samplesRevision, first.plan.samplesRevision);
  }
});

test("native plan refuses unpinned operations and stale source evidence", () => {
  const source = nativeContextFixture();
  for (const operation of [
    { ...nativeOperation, id: "caller-description" },
    { ...nativeOperation, fileKey: "" },
    { ...nativeOperation, fileKey: "../another-file" },
  ])
    assert.throws(
      () => prepareNativeSourceInspectionPlan({ source, operation }),
      /operation-identity-invalid/,
    );
  assert.throws(
    () =>
      prepareNativeSourceInspectionPlan({
        source: {
          ...source,
          expectedReportRevision: `sha256:${"0".repeat(64)}`,
        },
        operation: nativeOperation,
      }),
    /report-changed/,
  );
});

test("native inspection context rederives the saved v3 evidence and preserves every source identity and refusal", () => {
  const f = nativeContextFixture();
  const before = JSON.stringify([
    f.preparation,
    f.selection,
    f.tokens,
    f.artifact,
  ]);
  const result = prepareNativeSourceCandidate(f);
  assert.equal(result.status, "inspection-context-prepared");
  assert.equal(result.acceptedContract, null);
  assert.equal(result.nativeQualification, "unqualified");
  assert.equal(result.projection.binding.version, 0);
  assert.deepEqual(result.contract, f.report.tokenProjection.contract);
  assert.equal(result.projection.parts.length, 7);
  assert.equal(
    result.projection.parts.filter((n) => n.emptyMainVisible === false).length,
    2,
  );
  assert.equal(result.projection.cases.length, 7);
  assert.equal(
    result.projection.cases.filter((c) => c.status === "observed").length,
    6,
  );
  assert.equal(
    result.projection.cases.filter((c) => c.status === "refused").length,
    1,
  );
  assert.equal(
    result.projection.cases
      .flatMap((c) => c.wrappers ?? [])
      .filter((w) => w.visible).length,
    1,
  );
  assert.equal(result.projection.evidence.reportRevision, revisionOf(f.report));
  assert.equal(
    JSON.stringify([f.preparation, f.selection, f.tokens, f.artifact]),
    before,
  );
  result.projection.parts[0].partPath[0] = "changed-return-value";
  assert.equal(
    result.engineInput.nativeSourceCandidate.candidates.values().next().value!
      .projection.parts[0].partPath[0],
    "root",
  );
});

test("native inspection requires an independently pinned v3 revision", () => {
  const f = nativeContextFixture();
  for (const expectedReportRevision of [
    undefined,
    "",
    `sha256:${"0".repeat(64)}`,
  ])
    assert.throws(
      () =>
        prepareNativeSourceCandidate({
          ...f,
          expectedReportRevision: expectedReportRevision as string,
        }),
      /report-changed/,
    );
  f.tokens.mode = "light" as "dark";
  assert.throws(
    () => prepareNativeSourceCandidate(f),
    /report-changed|token-context/,
  );
});

test("native inspection rejects a different runtime interface even with unchanged original evidence", () => {
  const f = nativeContextFixture();
  f.artifact.interface.slots[0].name = "unrelated";
  assert.throws(() => prepareNativeSourceCandidate(f), /runtime-changed/);
});

test("native inspection refuses unavailable wrapper evidence even when the host pins the refused report", () => {
  const f = nativeContextFixture();
  delete f.selection.evidence.sourceProgram;
  f.expectedReportRevision = revisionOf(
    buildCandidateVisualReportV3(f.preparation, f.selection, f.tokens),
  );
  assert.throws(() => prepareNativeSourceCandidate(f), /evidence-refused/);
});

test("v2 joins recorded originals and preserves the v1 preparation and seven-case denominator", () => {
  const f = fixture();
  const before = JSON.stringify([f.selection, f.preparation, f.tokens]);
  const report = buildCandidateVisualReport(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.version, 2);
  // Recorded before additive v3 integration: the entire historical v2 payload
  // must retain its exact bytes, not merely its old status/counter names.
  assert.equal(
    sha(JSON.stringify(report)),
    "21e3491ef40eec75660707405460d54dc458a551ce55a2e61d73cd92048f5e2c",
  );
  assert.equal(report.status, "measured-candidate");
  assert.equal(report.acceptedContract, null);
  assert.equal(report.qualification, "observed-values-only");
  assert.equal(report.visual.cases.length, 7);
  assert.equal(
    report.visual.cases.filter((row) => row.status === "projected").length,
    6,
  );
  assert.equal(report.tokenBindings.cases.length, 7);
  assert.equal(report.visualRevision, revisionOf(report.visual));
  assert.equal(report.tokenBindingsRevision, revisionOf(report.tokenBindings));
  assert.equal(report.visual.unqualifiedRuntimeBinding!.version, 0);
  assert.equal(
    report.visual.contract!.props.find((prop) => prop.name === "variant")!
      .default,
    undefined,
  );
  assert.equal(JSON.stringify([f.selection, f.preparation, f.tokens]), before);
  const summary = f.validate(report, f.context);
  assert.equal(summary.counters.plannedCases, 7);
  assert.equal(summary.counters.projectedCases, 6);
  assert.equal(summary.counters.refusedCases, 1);
  assert.equal(summary.counters.stylePlanes, 5);
  assert.equal(summary.counters.boundTokenChannels, 18);
  assert.ok(summary.counters.observedChannels > 0);
  assert.ok(summary.counters.excludedChannels > 0);
  assert.ok(summary.counters.excludedSamples > 0);
  assert.deepEqual(f.validate(structuredClone(report), f.context), summary);
  assert.equal(f.tokenReads(), 2);
  assert.equal(JSON.stringify([f.selection, f.preparation, f.tokens]), before);
  report.request.baseline.sha256 = "f".repeat(64);
  assert.equal(
    JSON.stringify([f.selection, f.preparation, f.tokens]),
    before,
    "returned report owns all nested data",
  );
});

test("reordered binding rows retain run-and-story identities rather than positional pairing", () => {
  const f = fixture();
  const expected = buildCandidateVisualReport(
    f.preparation,
    f.selection,
    f.tokens,
  );
  f.selection.report.rows.reverse();
  assert.deepEqual(
    buildCandidateVisualReport(f.preparation, f.selection, f.tokens),
    expected,
  );
});

test("self-consistent rewritten output hashes cannot admit altered candidate semantics or scope", async (t) => {
  for (const mutation of [
    "candidate-style",
    "token-value",
    "token-identity",
    "public-default",
    "sample-text",
    "dropped-case",
    "refusal",
    "runtime-upgrade",
    "acceptance",
    "qualification",
    "extra-claim",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      const report = buildCandidateVisualReport(
        f.preparation,
        f.selection,
        f.tokens,
      );
      const visual = report.visual;
      if (mutation === "candidate-style")
        visual.contract!.anatomy.root.literals = { color: "#ff0000" };
      if (mutation === "token-value")
        visual.tokens!.invented = { $type: "color", $value: "#ff0000" };
      if (mutation === "token-identity")
        report.tokenBindings.cases[0].outcomes[0].binding!.tokenPath =
          "color-brand-blue-500";
      if (mutation === "public-default")
        visual.contract!.props.find(
          (prop) => prop.name === "variant",
        )!.default = "secondary";
      if (mutation === "sample-text")
        visual.contract!.anatomy.root.text = "Sample button label";
      if (mutation === "dropped-case") {
        visual.cases.splice(2, 1);
        report.tokenBindings.cases.splice(2, 1);
      }
      if (mutation === "refusal")
        visual.cases[2] = {
          ...visual.cases[2],
          status: "projected",
          problems: [],
        };
      if (mutation === "runtime-upgrade") {
        visual.unqualifiedRuntimeBinding!.version = 1 as never;
        visual.contract!.bindings.code.runtime!.bindingRevision = revisionOf(
          visual.unqualifiedRuntimeBinding,
        );
      }
      if (mutation === "acceptance")
        report.acceptedContract = visual.contract as never;
      if (mutation === "qualification")
        report.qualification = "native-verified" as never;
      if (mutation === "extra-claim")
        Object.assign(report, { overallSuccess: true });
      visual.contractRevision = revisionOf(visual.contract);
      visual.tokenRevision = revisionOf(visual.tokens);
      report.visualRevision = revisionOf(visual);
      report.tokenBindingsRevision = revisionOf(report.tokenBindings);
      assert.throws(
        () => f.validate(report, f.context),
        /candidate-visual-report-mismatch/,
      );
    });
});

test("changed preparation, selected cases, original tree or current token bytes invalidate reopen", async (t) => {
  for (const mutation of [
    "preparation-pin",
    "binding-pin",
    "source-revision",
    "run-id",
    "dropped-binding",
    "duplicate-story",
    "original-tree",
    "token-bytes",
  ])
    await t.test(mutation, () => {
      const f = fixture();
      const report = buildCandidateVisualReport(
        f.preparation,
        f.selection,
        f.tokens,
      );
      if (mutation === "preparation-pin")
        f.context.preparation.reportSha256 = "f".repeat(64);
      if (mutation === "binding-pin") f.selection.reportSha256 = "f".repeat(64);
      if (mutation === "source-revision")
        f.selection.evidence.sourceRevision = "f".repeat(40);
      if (mutation === "run-id")
        f.selection.evidence.rows[0].runId = f.selection.evidence.rows[4].runId;
      if (mutation === "dropped-binding") f.selection.report.rows.pop();
      if (mutation === "duplicate-story")
        f.selection.evidence.rows[4].story = f.selection.evidence.rows[0].story;
      if (mutation === "original-tree")
        f.selection.evidence.rows[0].topology!.tree.style.color =
          "rgb(255, 0, 0)";
      if (mutation === "token-bytes") {
        const tree = JSON.parse(f.tokens.json);
        tree["theme-color-background-primary-default"].$value = "#ff0000";
        f.tokens.json = JSON.stringify(tree);
        f.tokens.sha256 = sha(f.tokens.json);
      }
      assert.throws(() => f.validate(report, f.context), /candidate-visual-/);
    });
});

test("missing original topology produces a named refused visual result without dropping cases", () => {
  const f = fixture();
  for (const row of f.selection.evidence.rows) delete row.topology;
  const report = buildCandidateVisualReport(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.status, "visual-refused");
  assert.equal(report.visual.cases.length, 7);
  assert.equal(report.tokenBindings.cases.length, 7);
  assert.ok(report.visual.cases.every((row) => row.status === "refused"));
  assert.equal(report.visual.contract, undefined);
  const summary = f.validate(report, f.context);
  assert.equal(summary.counters.projectedCases, 0);
  assert.equal(summary.counters.refusedCases, 7);
  assert.ok(summary.problems!.includes("candidate-visual-refused"));
});

test("application report retains both native and React emission refusals", () => {
  const f = fixture();
  const { visual } = buildCandidateVisualReport(
    f.preparation,
    f.selection,
    f.tokens,
  );
  const contract = visual.contract!;
  assert.throws(
    () =>
      emitReact(contract, {
        tokens: new Set(flattenTokens(visual.tokens!).keys()),
        icons: new Map(),
        contracts: new Map([[contract.id, contract]]),
      }),
    /TRUSTED-CONTEXT-MISSING/,
  );
  assert.throws(
    () =>
      createFigmaEngine({
        tokens: {
          primitives: visual.tokens!,
          semantic: {},
          light: {},
          dark: {},
          brands: { default: {} },
        },
        icons: new Map(),
      }).compileComponentData(contract, new Map()),
    /RUNTIME-EMISSION-TARGET-UNSUPPORTED/,
  );
});

test("v3 projects exact tokens and joins two wrapper predicates across all original cases", () => {
  const f = v3Fixture();
  const before = JSON.stringify([f.selection, f.preparation, f.tokens]);
  const v2 = buildCandidateVisualReport(f.preparation, f.selection, f.tokens);
  const report = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.version, 3);
  assert.equal(report.status, "measured-candidate");
  assert.equal(report.acceptedContract, null);
  assert.deepEqual(report.visual, v2.visual);
  assert.deepEqual(report.tokenBindings, v2.tokenBindings);
  assert.equal(report.visualRevision, v2.visualRevision);
  assert.equal(report.tokenBindingsRevision, v2.tokenBindingsRevision);
  assert.equal(
    report.tokenProjection.status,
    "source-token-projected-candidate",
  );
  assert.equal(report.tokenProjection.sourceTokenPaths.length, 9);
  assert.equal(report.tokenProjection.rewrites.length, 11);
  assert.equal(report.tokenProjection.unqualifiedRuntimeBinding!.version, 0);
  assert.equal(report.tokenProjection.acceptedContract, null);
  assert.equal(
    report.tokenProjectionRevision,
    revisionOf(report.tokenProjection),
  );
  const wrappers = report.wrapperProjection;
  assert.equal(wrappers.status, "snapshot-wrappers-observed");
  assert.equal(wrappers.qualification, "render-snapshot-predicate-only");
  assert.equal(wrappers.nativeQualification, "unqualified");
  assert.equal(wrappers.acceptedContract, null);
  assert.equal(wrappers.predicates!.predicates.length, 4);
  assert.equal(wrappers.selectedWrappers.length, 2);
  assert.equal(wrappers.unprojectedWrappers.length, 2);
  assert.equal(wrappers.predicatesRevision, revisionOf(wrappers.predicates));
  assert.equal(report.wrapperProjectionRevision, revisionOf(wrappers));
  assert.deepEqual(
    wrappers.cases.map((row) => row.id),
    f.input.semantics.cases.map((row) => row.id),
  );
  assert.equal(
    wrappers.cases.filter((row) => row.status === "refused").length,
    1,
  );
  const snapshots = wrappers.cases.flatMap((row) => row.snapshots);
  assert.equal(snapshots.length, 12);
  const present = snapshots.filter((snapshot) => snapshot.observedWrapper);
  assert.equal(present.length, 1);
  assert.equal(present[0].wrapper.sourceNodeId, "element:6709");
  assert.equal(present[0].wrapperDomPath, "host/shadow/2/2");
  assert.deepEqual(present[0].evaluation.witnesses, ["host/1"]);
  for (const snapshot of snapshots) {
    assert.equal(snapshot.evaluation.matches, snapshot.observedWrapper);
    assert.equal(snapshot.evaluation.nativeQualification, "unqualified");
    assert.deepEqual(snapshot.evaluation.assumptions, [
      "original-dispatch",
      "stable-native-query",
    ]);
  }
  const summary = f.validate(report, f.context);
  assert.deepEqual(
    Object.fromEntries(
      [
        "plannedCases",
        "projectedCases",
        "refusedCases",
        "projectedTokenPaths",
        "projectedTokenAddresses",
        "wrapperPredicates",
        "wrapperSnapshots",
        "wrapperObservedCases",
        "wrapperRefusedCases",
        "wrapperPresentSnapshots",
        "unprojectedWrapperPredicates",
      ].map((key) => [key, summary.counters[key]]),
    ),
    {
      plannedCases: 7,
      projectedCases: 6,
      refusedCases: 1,
      projectedTokenPaths: 9,
      projectedTokenAddresses: 11,
      wrapperPredicates: 2,
      wrapperSnapshots: 12,
      wrapperObservedCases: 6,
      wrapperRefusedCases: 1,
      wrapperPresentSnapshots: 1,
      unprojectedWrapperPredicates: 2,
    },
  );
  assert.ok(summary.problems!.includes("candidate-wrapper-snapshots-only"));
  assert.ok(
    summary.problems!.includes("candidate-wrapper-branches-unprojected"),
  );
  assert.ok(
    summary.problems!.includes("candidate-token-projection-unaccepted"),
  );
  assert.equal(JSON.stringify([f.selection, f.preparation, f.tokens]), before);
});

test("v3 missing authenticated program refuses every wrapper case while historical v2 still reopens", () => {
  const f = fixture();
  const v2 = buildCandidateVisualReport(f.preparation, f.selection, f.tokens);
  const report = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.status, "visual-refused");
  assert.deepEqual(report.wrapperProjection.problems, [
    "candidate-wrapper-source-program-unavailable",
  ]);
  assert.equal(report.wrapperProjection.cases.length, 7);
  assert.ok(
    report.wrapperProjection.cases.every(
      (row) => row.status === "refused" && row.snapshots.length === 0,
    ),
  );
  assert.ok(
    f
      .validate(report, f.context)
      .problems!.includes("candidate-wrapper-source-program-unavailable"),
  );
  assert.equal(f.validate(v2, f.context).counters.projectedCases, 6);
  assert.equal(
    sha(JSON.stringify(v2)),
    "21e3491ef40eec75660707405460d54dc458a551ce55a2e61d73cd92048f5e2c",
  );
});

test("v3 full reconstruction rejects self-rehashed token, predicate, snapshot and qualification claims", async (t) => {
  const f = v3Fixture();
  const original = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  for (const mutation of [
    "token-reference",
    "projection-hash",
    "predicate-selector",
    "predicate-span",
    "predicate-drop",
    "matches",
    "witness",
    "wrapper-readback",
    "dom-path",
    "dropped-case",
    "refused-case",
    "native-upgrade",
    "runtime-upgrade",
    "acceptance",
    "version",
  ])
    await t.test(mutation, () => {
      const report = structuredClone(original);
      const wrapper = report.wrapperProjection;
      const snapshot = wrapper.cases
        .flatMap((row) => row.snapshots)
        .find((row) => row.observedWrapper)!;
      if (mutation === "token-reference")
        report.tokenProjection.contract!.anatomy.root.tokens![
          "background-color"
        ] = "{theme-color-background-danger-default}";
      if (mutation === "projection-hash")
        report.tokenProjection.contractProjectionRevision = "f".repeat(64);
      if (mutation === "predicate-selector")
        wrapper.predicates!.predicates[0].normalForm!.selector =
          '[slot="forged"]';
      if (mutation === "predicate-span")
        wrapper.selectedWrappers[0].sourceSpan.end++;
      if (mutation === "predicate-drop") wrapper.selectedWrappers.pop();
      if (mutation === "matches") snapshot.evaluation.matches = false;
      if (mutation === "witness") snapshot.evaluation.witnesses = [];
      if (mutation === "wrapper-readback") snapshot.observedWrapper = false;
      if (mutation === "dom-path") snapshot.wrapperDomPath = "host/shadow/2/3";
      if (mutation === "dropped-case") wrapper.cases.splice(2, 1);
      if (mutation === "refused-case")
        wrapper.cases.find((row) => row.status === "refused")!.status =
          "snapshot-wrappers-observed";
      if (mutation === "native-upgrade")
        wrapper.nativeQualification = "qualified" as never;
      if (mutation === "runtime-upgrade")
        report.tokenProjection.unqualifiedRuntimeBinding!.version = 1 as never;
      if (mutation === "acceptance")
        wrapper.acceptedContract = report.tokenProjection.contract as never;
      if (mutation === "version") report.version = 4 as never;
      report.tokenProjection.contractRevision = revisionOf(
        report.tokenProjection.contract,
      );
      report.tokenProjection.runtimeBindingRevision = revisionOf(
        report.tokenProjection.unqualifiedRuntimeBinding,
      );
      report.tokenProjectionRevision = revisionOf(report.tokenProjection);
      wrapper.predicatesRevision = revisionOf(wrapper.predicates);
      report.wrapperProjectionRevision = revisionOf(wrapper);
      assert.throws(
        () => f.validate(report, f.context),
        /candidate-visual-report-(?:mismatch|version-invalid)/,
      );
    });
});

test("v3 forged authenticated program fields refuse rather than granting wrapper observations", async (t) => {
  for (const mutation of [
    "digest",
    "entry-text",
    "entry-path",
    "entry-hash",
    "class",
    "revision",
    "rehashed-inventory",
  ])
    await t.test(mutation, () => {
      const f = v3Fixture();
      const original = buildCandidateVisualReportV3(
        f.preparation,
        f.selection,
        f.tokens,
      );
      const program = f.selection.evidence.sourceProgram!;
      if (mutation === "digest") program.digest = "f".repeat(64);
      if (mutation === "entry-text")
        program.modules.find((m) => m.path === program.entryPath)!.text +=
          "\n// changed";
      if (mutation === "entry-path") program.entryPath += ".forged";
      if (mutation === "entry-hash")
        program.modules.find((m) => m.path === program.entryPath)!.sha256 =
          "f".repeat(64);
      if (mutation === "class") program.className = "ForgedButton";
      if (mutation === "revision") program.revision = "f".repeat(40);
      if (mutation === "rehashed-inventory") {
        program.modules.find((m) => m.path === program.entryPath)!.classes = [];
        program.digest = sha(JSON.stringify({ ...program, digest: undefined }));
        f.selection.evidence.sourceProgramSha256 = program.digest;
        f.selection.report.sourceProgramSha256 = program.digest;
        f.preparation.report.sourceProgramSha256 = program.digest;
        f.preparation.report.semantics.source.programSha256 = program.digest;
        f.preparation.report.semanticsRevision = revisionOf(
          f.preparation.report.semantics,
        );
      }
      const refused = buildCandidateVisualReportV3(
        f.preparation,
        f.selection,
        f.tokens,
      );
      assert.equal(refused.status, "visual-refused");
      assert.equal(refused.wrapperProjection.status, "refused");
      assert.equal(refused.wrapperProjection.cases.length, 7);
      assert.ok(
        refused.wrapperProjection.cases.every(
          (row) => row.snapshots.length === 0 && row.status === "refused",
        ),
      );
      assert.ok(
        refused.wrapperProjection.problems.some((code) =>
          /^candidate-wrapper-(?:source-program-identity-mismatch|source-predicates-refused)$/.test(
            code,
          ),
        ),
        JSON.stringify(refused.wrapperProjection.problems),
      );
      assert.throws(
        () => f.validate(original, f.context),
        /candidate-visual-report-mismatch/,
      );
    });
});

test("v3 refuses a matching light-DOM predicate without its source-owned wrapper readback", () => {
  const f = v3Fixture();
  const bound = f.selection.report.rows[0].boundTopology!;
  const topology = bound.topology!;
  topology.observation!.nodes.push({
    domPath: "host/99",
    kind: "element",
    tag: "i",
    attributes: { slot: "after" },
    namespace: "http://www.w3.org/1999/xhtml",
  });
  topology.observationSha256 = sha(JSON.stringify(topology.observation));
  f.preparation.report.semantics.cases[0].topologyObservationSha256 =
    topology.observationSha256;
  f.preparation.report.semanticsRevision = revisionOf(
    f.preparation.report.semantics,
  );
  const report = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(
    report.visual.status,
    "measured-candidate",
    JSON.stringify(report.visual.problems),
  );
  assert.equal(report.status, "visual-refused");
  assert.deepEqual(report.wrapperProjection.problems, [
    "candidate-wrapper-eligible-cases-refused",
  ]);
  assert.ok(
    report.wrapperProjection.cases[0].problems.includes(
      "candidate-wrapper-snapshot-wrapper-presence-mismatch",
    ),
  );
  assert.equal(report.wrapperProjection.cases.length, 7);
  assert.ok(
    report.wrapperProjection.cases.every(
      (row) => row.status === "refused" && row.snapshots.length === 0,
    ),
  );
  assert.equal(f.validate(report, f.context).counters.wrapperSnapshots, 0);
});

test("v3 cannot qualify wrappers when the enclosing href branch loses observed scalar evidence", () => {
  const f = v3Fixture();
  const raw = f.selection.evidence.rows[0].semantics!;
  raw.observation.properties.href = { kind: "unreadable" };
  raw.observationSha256 = sha(JSON.stringify(raw.observation));
  f.selection.report.rows[0].boundTopology!.semanticObservationSha256 =
    raw.observationSha256;
  f.preparation.report.semantics.cases[0].semanticObservationSha256 =
    raw.observationSha256;
  f.preparation.report.semanticsRevision = revisionOf(
    f.preparation.report.semantics,
  );
  const report = buildCandidateVisualReportV3(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.status, "visual-refused");
  assert.equal(report.wrapperProjection.status, "refused");
  assert.ok(
    report.wrapperProjection.problems.includes(
      "candidate-wrapper-visual-source-unavailable",
    ),
  );
  assert.equal(report.wrapperProjection.cases.length, 7);
  assert.ok(
    report.wrapperProjection.cases.every((row) => row.snapshots.length === 0),
  );
  assert.ok(
    f
      .validate(report, f.context)
      .problems!.includes("candidate-wrapper-visual-source-unavailable"),
  );
});
