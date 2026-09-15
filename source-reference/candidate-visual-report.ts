/** Read-only assembly from an already verified preparation. The runtime stays
 * in its original preparation directory; this report grants no emitter access. */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import type {
  CandidateVisualReportBase,
  CandidateVisualReportValidator,
} from "./candidate-jobs.js";
import type { CandidatePreparationReport } from "./candidate-report.js";
import {
  buildSourceVisualContractCandidate,
  type SourceVisualContractCandidate,
  type SourceVisualContractInput,
} from "./source-visual-contract.js";
import {
  resolveSourceTokenBindings,
  type SourceTokenBindings,
  type SourceTokenBindingsInput,
} from "./source-token-bindings.js";

export interface CandidateVisualReport extends CandidateVisualReportBase {
  version: 2;
  adapter: "altitude-button-visual-v1";
  qualification: "observed-values-only";
  source: { revision: string; inputRevision: string };
  tokens: { mode: "dark"; brand: "default"; sha256: string };
  visual: SourceVisualContractCandidate;
  visualRevision: string;
  tokenBindings: SourceTokenBindings;
  tokenBindingsRevision: string;
}
type Preparation = {
  id: string;
  reportSha256: string;
  report: CandidatePreparationReport;
};
type Tokens = SourceTokenBindingsInput["tokens"];
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function fail(code: string): never {
  throw Error(`candidate-visual-${code}`);
}

/** The caller authenticates preparation/runtime and selected original bytes.
 * Recheck their joins here; never select a source by class, label or equal value.
 * Unavailable original rows stay in the semantic denominator as refusals. */
export function buildCandidateVisualReport(
  preparation: Preparation,
  selection: VerifiedBindingSelection,
  tokens: Tokens,
): CandidateVisualReport {
  const report = preparation.report,
    { evidence } = selection,
    semantics = report.semantics;
  if (
    !UUID.test(preparation.id) ||
    !HASH.test(preparation.reportSha256) ||
    report.version !== 1 ||
    report.status !== "prepared" ||
    report.acceptedContract !== null ||
    report.adapter !== "altitude-button-runtime-v1" ||
    report.qualification !== "source-and-runtime-only" ||
    !same(report.request, selection.request) ||
    !same(evidence.request, selection.request) ||
    !same(selection.report.request, selection.request) ||
    !same(report.binding, {
      id: selection.id,
      reportSha256: selection.reportSha256,
    }) ||
    report.sourceProgramSha256 !== evidence.sourceProgramSha256 ||
    selection.report.sourceProgramSha256 !== evidence.sourceProgramSha256 ||
    report.source.revision !== evidence.sourceRevision ||
    !HASH.test(report.source.inputRevision) ||
    report.semanticsRevision !== revisionOf(semantics) ||
    semantics.source.revision !== evidence.sourceRevision ||
    semantics.source.programSha256 !== evidence.sourceProgramSha256 ||
    semantics.source.sourceSha256 !== evidence.source.sourceSha256 ||
    (semantics.runtime !== undefined &&
      (semantics.runtime.artifactRevision !== report.runtime.artifactRevision ||
        semantics.runtime.interfaceRevision !==
          report.runtime.interfaceRevision))
  )
    fail("preparation-selection-mismatch");
  const ids = evidence.rows.map((row) => `${row.runId}:${row.story}`),
    stories = evidence.rows.map((row) => row.story);
  // BindingTraceReport v1 has story keys, so a repeated story cannot safely be
  // assigned to two run IDs. Do not pick the first occurrence from either run.
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    new Set(stories).size !== stories.length ||
    !same(
      semantics.cases.map((row) => row.id),
      ids,
    ) ||
    selection.report.rows.length !== ids.length ||
    stories.some(
      (story) =>
        selection.report.rows.filter((row) => row.story === story).length !== 1,
    )
  )
    fail("case-denominator-mismatch");
  const cases: SourceVisualContractInput["cases"] = [];
  for (const row of evidence.rows) {
    const bound = selection.report.rows.find(
      (candidate) => candidate.story === row.story,
    )!;
    if (
      !row.eligible ||
      row.problems.length ||
      bound.status !== "structure-matched" ||
      bound.problems.length ||
      !row.semantics ||
      !row.topology ||
      !bound.boundTopology
    )
      continue;
    cases.push({
      expectedCaseId: `${row.runId}:${row.story}`,
      semantics: row.semantics,
      boundTopology: bound.boundTopology,
      tree: { root: row.topology.tree, sha256: row.topology.treeSha256 },
    });
  }
  const source: SourceVisualContractInput = {
    source: evidence.source,
    semantics,
    cases,
  };
  const visual = buildSourceVisualContractCandidate(source),
    tokenBindings = resolveSourceTokenBindings({ source, tokens });
  return structuredClone({
    version: 2,
    request: selection.request,
    binding: { id: selection.id, reportSha256: selection.reportSha256 },
    sourceProgramSha256: evidence.sourceProgramSha256,
    preparation: {
      id: preparation.id,
      reportSha256: preparation.reportSha256,
    },
    status:
      visual.status === "measured-candidate" &&
      tokenBindings.status === "source-bindings-observed"
        ? "measured-candidate"
        : "visual-refused",
    acceptedContract: null,
    adapter: "altitude-button-visual-v1",
    qualification: "observed-values-only",
    source: report.source,
    tokens: { mode: tokens.mode, brand: tokens.brand, sha256: tokens.sha256 },
    visual,
    visualRevision: revisionOf(visual),
    tokenBindings,
    tokenBindingsRevision: revisionOf(tokenBindings),
  });
}

/** One fixed host-selected dark/default DTCG source. HTTP/report data never
 * chooses a path or supplies new tokens. Captured environments corroborate it. */
export function readCandidateVisualTokens(repository: string): Tokens {
  let file = path.resolve(repository);
  if (!lstatSync(file).isDirectory()) fail("token-directory-invalid");
  const parts = [
    "examples",
    "altitude",
    "tokens",
    "modes",
    "altitude.dark.dtcg.json",
  ];
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part);
    const stat = lstatSync(file);
    if (
      stat.isSymbolicLink() ||
      (index === parts.length - 1
        ? !stat.isFile() || stat.size > 8 * 1024 * 1024
        : !stat.isDirectory())
    )
      fail("token-file-invalid");
  }
  const json = readFileSync(file, "utf8");
  return { mode: "dark", brand: "default", json, sha256: sha(json) };
}

/** The manager validates the original v1 preparation before calling this.
 * Reopening rederives the entire visual/token report from that verified input;
 * stored flags and even self-consistent output hashes grant no authority. */
export function createCandidateVisualValidator(
  readTokens: typeof readCandidateVisualTokens = readCandidateVisualTokens,
): CandidateVisualReportValidator {
  return (value, context) => {
    const { directory, preparation } = context;
    if (
      !UUID.test(path.basename(directory)) ||
      path.basename(path.dirname(directory)) !== "source-candidate-app" ||
      path.basename(path.resolve(directory, "../..")) !== "private"
    )
      fail("directory-invalid");
    const repository = path.resolve(directory, "../../..");
    const expected = buildCandidateVisualReport(
      {
        ...preparation,
        report: preparation.report as CandidatePreparationReport,
      },
      context.selection,
      readTokens(repository),
    );
    if (!same(value, expected)) fail("report-mismatch");
    const { visual, tokenBindings } = expected,
      outcomes = tokenBindings.cases.flatMap((row) => row.outcomes),
      refusedCases = visual.cases.filter(
        (row) => row.status === "refused",
      ).length;
    return {
      counters: {
        plannedCases: visual.cases.length,
        projectedCases: visual.cases.length - refusedCases,
        refusedCases,
        stylePlanes: visual.stylePlanes.length,
        observedChannels: visual.channels.filter(
          (row) => row.status === "candidate",
        ).length,
        excludedChannels: visual.channels.filter(
          (row) => row.status === "excluded",
        ).length,
        boundTokenChannels: outcomes.filter((row) => row.status === "bound")
          .length,
        ambiguousTokenChannels: outcomes.filter(
          (row) => row.status === "ambiguous",
        ).length,
        unresolvedTokenChannels: outcomes.filter(
          (row) => row.status === "unresolved",
        ).length,
        excludedSamples: tokenBindings.cases.reduce(
          (count, row) => count + row.excludedSampleIds.length,
          0,
        ),
      },
      problems: [
        "candidate-visual-contract-unaccepted",
        "candidate-runtime-binding-unqualified",
        "candidate-native-projection-unverified",
        "candidate-token-bindings-observations-only",
        ...(refusedCases ? ["candidate-source-cases-refused"] : []),
        ...(visual.status === "refused" ? ["candidate-visual-refused"] : []),
        ...(tokenBindings.status === "refused"
          ? ["candidate-token-bindings-refused"]
          : []),
      ],
    };
  };
}

export const validateCandidateVisualReport = createCandidateVisualValidator();
