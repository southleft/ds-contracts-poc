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
import {
  buildSourceTokenProjection,
  type SourceTokenProjection,
} from "./source-token-projection.js";
import type { SourceAnatomyIdentity } from "./source-bound-anatomy.js";
import {
  deriveSourceWrapperPredicates,
  evaluateSourceWrapperPredicate,
  type SourceWrapperEvaluation,
  type SourceWrapperPredicates,
} from "./source-wrapper-predicates.js";

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
export interface CandidateWrapperProjection {
  version: 1;
  status: "snapshot-wrappers-observed" | "refused";
  acceptedContract: null;
  qualification: "render-snapshot-predicate-only";
  nativeQualification: "unqualified";
  sourceProgramSha256: string;
  predicates?: SourceWrapperPredicates;
  predicatesRevision?: string;
  selectedWrappers: SourceAnatomyIdentity[];
  unprojectedWrappers: SourceAnatomyIdentity[];
  cases: Array<{
    id: string;
    status: "snapshot-wrappers-observed" | "refused";
    snapshots: Array<{
      wrapper: SourceAnatomyIdentity;
      evaluation: SourceWrapperEvaluation;
      observedWrapper: boolean;
      wrapperDomPath?: string;
    }>;
    problems: string[];
  }>;
  problems: string[];
}
export interface CandidateVisualReportV3 extends CandidateVisualReportBase {
  version: 3;
  adapter: "altitude-button-visual-v2";
  qualification: CandidateVisualReport["qualification"];
  source: CandidateVisualReport["source"];
  tokens: CandidateVisualReport["tokens"];
  visual: SourceVisualContractCandidate;
  visualRevision: string;
  tokenBindings: SourceTokenBindings;
  tokenBindingsRevision: string;
  tokenProjection: SourceTokenProjection;
  tokenProjectionRevision: string;
  wrapperProjection: CandidateWrapperProjection;
  wrapperProjectionRevision: string;
}
export type AnyCandidateVisualReport =
  CandidateVisualReport | CandidateVisualReportV3;
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

const anatomyIdentity = (
  node: SourceAnatomyIdentity,
): SourceAnatomyIdentity => ({
  templateId: node.templateId,
  sourceNodeId: node.sourceNodeId,
  sourceSpan: { ...node.sourceSpan },
});

/** Separate v3 input assembly. The historical v2 builder remains unchanged;
 * its validation runs first and its complete result is retained in the v3
 * envelope. No saved v2 report is upgraded or rewritten when reopened. */
function visualSourceForV3(
  preparation: Preparation,
  selection: VerifiedBindingSelection,
): SourceVisualContractInput {
  return {
    source: selection.evidence.source,
    semantics: preparation.report.semantics,
    cases: selection.evidence.rows.flatMap((row) => {
      const bound = selection.report.rows.find((c) => c.story === row.story)!;
      return row.eligible &&
        !row.problems.length &&
        bound.status === "structure-matched" &&
        !bound.problems.length &&
        row.semantics &&
        row.topology &&
        bound.boundTopology
        ? [
            {
              expectedCaseId: `${row.runId}:${row.story}`,
              semantics: row.semantics,
              boundTopology: bound.boundTopology,
              tree: {
                root: row.topology.tree,
                sha256: row.topology.treeSha256,
              },
            },
          ]
        : [];
    }),
  };
}

function buildWrapperProjection(
  source: SourceVisualContractInput,
  selection: VerifiedBindingSelection,
  visual: SourceVisualContractCandidate,
): CandidateWrapperProjection {
  const out: CandidateWrapperProjection = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "render-snapshot-predicate-only",
    nativeQualification: "unqualified",
    sourceProgramSha256: selection.evidence.sourceProgramSha256,
    selectedWrappers: [],
    unprojectedWrappers: [],
    cases: source.semantics.cases.map((row) => ({
      id: row.id,
      status: "refused",
      snapshots: [],
      problems:
        row.status === "structure-matched"
          ? []
          : [...row.problems, "candidate-wrapper-source-case-refused"],
    })),
    problems: [],
  };
  function refusal(code: string): never {
    throw Error(`candidate-wrapper-${code}`);
  }
  try {
    const { evidence } = selection,
      program = evidence.sourceProgram;
    if (!program) refusal("source-program-unavailable");
    const entry = program.modules.filter((m) => m.path === program.entryPath);
    if (
      program.digest !== evidence.sourceProgramSha256 ||
      sha(JSON.stringify({ ...program, digest: undefined })) !==
        program.digest ||
      program.revision !== evidence.sourceRevision ||
      program.entryPath !== evidence.sourcePath ||
      program.className !== evidence.source.className ||
      entry.length !== 1 ||
      entry[0].text !== evidence.source.source ||
      entry[0].sha256 !== evidence.source.sourceSha256 ||
      sha(entry[0].text) !== entry[0].sha256
    )
      refusal("source-program-identity-mismatch");
    const input = {
      program,
      expectedProgramSha256: evidence.sourceProgramSha256,
      source: evidence.source,
    };
    const predicates = deriveSourceWrapperPredicates(input);
    out.predicates = predicates;
    out.predicatesRevision = revisionOf(predicates);
    if (predicates.status !== "predicates-observed")
      refusal("source-predicates-refused");
    const projection = visual.seed?.projection,
      root = projection?.root;
    if (visual.status !== "measured-candidate" || !projection || !root)
      refusal("visual-source-unavailable");
    const selected = predicates.predicates.filter((p) =>
      projection.nodes.some(
        (n) => n.kind === "wrapper" && same(anatomyIdentity(n), p.wrapper),
      ),
    );
    const conditionalNodes = projection.nodes.filter(
      (n) => n.kind === "wrapper" && !same(n.guards, root.guards),
    );
    if (
      !selected.length ||
      selected.length !== conditionalNodes.length ||
      conditionalNodes.some(
        (node) =>
          selected.filter((p) => same(p.wrapper, anatomyIdentity(node)))
            .length !== 1,
      ) ||
      selected.some(
        (p) =>
          p.status !== "predicate-derived" ||
          !same(p.remainingGuards, root.guards),
      )
    )
      refusal("selected-wrapper-coverage-refused");
    out.selectedWrappers = selected.map((p) => anatomyIdentity(p.wrapper));
    out.unprojectedWrappers = predicates.predicates
      .filter((p) => !selected.includes(p))
      .map((p) => anatomyIdentity(p.wrapper));
    for (const [index, semanticCase] of source.semantics.cases.entries()) {
      const row = out.cases[index];
      if (semanticCase.status !== "structure-matched") continue;
      try {
        const raw = source.cases.find((c) => c.expectedCaseId === row.id),
          observed = visual.cases.find((c) => c.id === row.id);
        if (
          !raw ||
          observed?.status !== "projected" ||
          !observed.projection ||
          !raw.boundTopology.topology ||
          !raw.semantics.sourcePngSha256
        )
          refusal("eligible-case-unavailable");
        const actual = observed.projection,
          topology = raw.boundTopology.topology;
        if (
          !same(semanticCase.branch, {
            templateId: root.templateId,
            sourceNodeId: root.sourceNodeId,
            tag: root.tag,
          }) ||
          root.guards.some(
            (guard) =>
              !actual.guards.some(
                (g) =>
                  g.evidence === "observed-scalar" &&
                  g.when === guard.when &&
                  same(g.expression, guard.expression),
              ),
          ) ||
          actual.elements.filter(
            (e) =>
              same(anatomyIdentity(e), anatomyIdentity(root)) &&
              e.visualPath === "" &&
              e.domPath === topology.observation?.rootDomPath,
          ).length !== 1
        )
          refusal("outer-branch-unqualified");
        for (const predicate of selected) {
          const evaluation = evaluateSourceWrapperPredicate({
            ...input,
            wrapper: predicate.wrapper,
            topology,
            expected: {
              sourceTreeSha256: raw.tree.sha256,
              sourcePngSha256: raw.semantics.sourcePngSha256,
              topologyObservationSha256: actual.topologyObservationSha256,
            },
          });
          const nodes = semanticCase.nodes.filter((n) =>
              same(anatomyIdentity(n), predicate.wrapper),
            ),
            elements = actual.elements.filter((e) =>
              same(anatomyIdentity(e), predicate.wrapper),
            );
          if (evaluation.status !== "snapshot-predicate-observed")
            refusal("snapshot-predicate-refused");
          const count = evaluation.matches ? 1 : 0;
          if (
            nodes.length !== count ||
            elements.length !== count ||
            (count === 1 &&
              (nodes[0].domPath !== elements[0].domPath ||
                topology.observation!.nodes.filter(
                  (n) =>
                    n.kind === "element" &&
                    n.domPath === elements[0].domPath &&
                    n.tag === nodes[0].tag &&
                    same(n.attributes, nodes[0].observedAttributes),
                ).length !== 1))
          )
            refusal("snapshot-wrapper-presence-mismatch");
          row.snapshots.push({
            wrapper: anatomyIdentity(predicate.wrapper),
            evaluation,
            observedWrapper: count === 1,
            ...(count === 1 ? { wrapperDomPath: elements[0].domPath } : {}),
          });
        }
        row.status = "snapshot-wrappers-observed";
      } catch (error) {
        row.snapshots = [];
        row.problems.push(
          error instanceof Error &&
            /^candidate-wrapper-[a-z-]+$/.test(error.message)
            ? error.message
            : "candidate-wrapper-case-invalid",
        );
      }
    }
    if (
      source.semantics.cases.some(
        (c, index) =>
          c.status === "structure-matched" &&
          out.cases[index].status !== "snapshot-wrappers-observed",
      )
    )
      refusal("eligible-cases-refused");
    out.status = "snapshot-wrappers-observed";
  } catch (error) {
    const code =
      error instanceof Error &&
      /^candidate-wrapper-[a-z-]+$/.test(error.message)
        ? error.message
        : "candidate-wrapper-input-invalid";
    out.problems.push(code);
    // A global refusal cannot expose a partial successful wrapper cohort.
    for (const row of out.cases) {
      row.status = "refused";
      row.snapshots = [];
      if (!row.problems.includes(code)) row.problems.push(code);
    }
  }
  return out;
}

/** Explicit additive derivation: recorded tokens and wrapper predicates improve
 * the candidate while acceptance, native qualification and runtime v0 stay put. */
export function buildCandidateVisualReportV3(
  preparation: Preparation,
  selection: VerifiedBindingSelection,
  tokens: Tokens,
): CandidateVisualReportV3 {
  const previous = buildCandidateVisualReport(preparation, selection, tokens),
    source = visualSourceForV3(preparation, selection),
    tokenProjection = buildSourceTokenProjection({ source, tokens }),
    wrapperProjection = buildWrapperProjection(
      source,
      selection,
      previous.visual,
    );
  return structuredClone({
    ...previous,
    version: 3,
    adapter: "altitude-button-visual-v2",
    status:
      previous.status === "measured-candidate" &&
      tokenProjection.status === "source-token-projected-candidate" &&
      wrapperProjection.status === "snapshot-wrappers-observed"
        ? "measured-candidate"
        : "visual-refused",
    tokenProjection,
    tokenProjectionRevision: revisionOf(tokenProjection),
    wrapperProjection,
    wrapperProjectionRevision: revisionOf(wrapperProjection),
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
    if (value.version !== 2 && value.version !== 3)
      fail("report-version-invalid");
    const expected = (
      value.version === 3
        ? buildCandidateVisualReportV3
        : buildCandidateVisualReport
    )(
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
        ...(expected.version === 3
          ? {
              projectedTokenPaths:
                expected.tokenProjection.sourceTokenPaths.length,
              projectedTokenAddresses: expected.tokenProjection.rewrites.length,
              wrapperPredicates:
                expected.wrapperProjection.selectedWrappers.length,
              wrapperSnapshots: expected.wrapperProjection.cases.reduce(
                (count, row) => count + row.snapshots.length,
                0,
              ),
              wrapperObservedCases: expected.wrapperProjection.cases.filter(
                (row) => row.status === "snapshot-wrappers-observed",
              ).length,
              wrapperRefusedCases: expected.wrapperProjection.cases.filter(
                (row) => row.status === "refused",
              ).length,
              wrapperPresentSnapshots: expected.wrapperProjection.cases.reduce(
                (count, row) =>
                  count +
                  row.snapshots.filter((snapshot) => snapshot.observedWrapper)
                    .length,
                0,
              ),
              unprojectedWrapperPredicates:
                expected.wrapperProjection.unprojectedWrappers.length,
            }
          : {}),
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
        ...(expected.version === 3
          ? [
              "candidate-token-projection-unaccepted",
              "candidate-wrapper-snapshots-only",
              ...(expected.wrapperProjection.unprojectedWrappers.length
                ? ["candidate-wrapper-branches-unprojected"]
                : []),
              ...(expected.tokenProjection.status === "refused"
                ? ["candidate-token-projection-refused"]
                : []),
              ...(expected.wrapperProjection.status === "refused"
                ? ["candidate-wrapper-projection-refused"]
                : []),
              ...new Set(
                [
                  ...expected.wrapperProjection.problems,
                  ...expected.wrapperProjection.cases.flatMap(
                    (row) => row.problems,
                  ),
                ].filter((problem) =>
                  /^candidate-wrapper-[a-z-]+$/.test(problem),
                ),
              ),
            ]
          : []),
      ],
    };
  };
}

export const validateCandidateVisualReport = createCandidateVisualValidator();
