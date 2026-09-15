import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { revisionOf } from "../core/contract-provenance.js";
import { emitReact } from "../core/emit-react.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import { flattenTokens } from "../core/tokens.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import { altitudeCohort, altitudeButtonVariants } from "./altitude-cohort.js";
import type { CandidateVisualValidationContext } from "./candidate-jobs.js";
import type { CandidatePreparationReport } from "./candidate-report.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";
import {
  buildCandidateVisualReport,
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

test("v2 joins recorded originals and preserves the v1 preparation and seven-case denominator", () => {
  const f = fixture();
  const before = JSON.stringify([f.selection, f.preparation, f.tokens]);
  const report = buildCandidateVisualReport(
    f.preparation,
    f.selection,
    f.tokens,
  );
  assert.equal(report.version, 2);
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
