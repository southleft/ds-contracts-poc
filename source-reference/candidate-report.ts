/** Host-owned source/runtime preparation. No visual Contract is manufactured,
 * no runtime module is evaluated here, and preparation never means conversion. */
import path from "node:path";
import {
  buildStatefulCandidatePreparationReport,
  summarizeStatefulPreparation,
  type StatefulCandidatePreparationReport,
} from "./stateful-candidate-report.js";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import type { BindingEvidenceRequest } from "./binding-evidence.js";
import type {
  CandidatePreparedReport,
  CandidateReportValidator,
} from "./candidate-jobs.js";
import {
  deriveButtonCandidateSemantics,
  type ButtonCandidateSemantics,
} from "./button-candidate-semantics.js";
import {
  altitudeButtonRuntimeRecipeIdentity,
  inspectAltitudeRuntimeInputs,
  readVerifiedRuntimeArtifact,
  type RuntimeInputManifest,
  type VerifiedRuntimeArtifact,
} from "./runtime-artifact.js";

export interface CandidatePreparationReport extends CandidatePreparedReport {
  version: 1;
  request: BindingEvidenceRequest;
  binding: { id: string; reportSha256: string };
  sourceProgramSha256: string;
  status: "prepared";
  acceptedContract: null;
  adapter: "altitude-button-runtime-v1";
  qualification: "source-and-runtime-only";
  source: { revision: string; inputRevision: string };
  runtime: { artifactRevision: string; interfaceRevision: string };
  semanticsRevision: string;
  semantics: ButtonCandidateSemantics;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(code: string): never {
  throw Error(`candidate-${code}`);
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Pure assembly from authenticated host data. Callers must read the artifact
 * bytes and inspect current source inputs; this function grants no authority. */
export function buildCandidatePreparationReport(
  selection: VerifiedBindingSelection,
  artifact: VerifiedRuntimeArtifact,
  inputs: RuntimeInputManifest,
): CandidatePreparationReport {
  const { manifest } = artifact,
    { evidence } = selection;
  const recipe = altitudeButtonRuntimeRecipeIdentity();
  const entry = inputs.files.filter(
    (file) => file.kind === "source" && file.path === evidence.sourcePath,
  );
  if (
    !same(manifest.inputs, inputs) ||
    manifest.source.inputRevision !== inputs.inputRevision ||
    manifest.source.revision !== inputs.sourceRevision ||
    manifest.source.revision !== evidence.sourceRevision ||
    manifest.source.baselineSha256 !== selection.request.baseline.sha256 ||
    manifest.adapter !== "altitude-button-v1" ||
    manifest.recipe.version !== recipe.version ||
    manifest.recipe.sha256 !== recipe.sha256 ||
    manifest.recipe.repeatedBuildIdentical !== true ||
    !same(manifest.recipe.conditions, recipe.conditions) ||
    !same(evidence.request, selection.request) ||
    entry.length !== 1 ||
    entry[0].sha256 !== evidence.source.sourceSha256 ||
    entry[0].bytes !== Buffer.byteLength(evidence.source.source)
  )
    fail("runtime-source-identity-mismatch");
  const declaration = evidence.rows.find((row) => row.eligible && row.semantics)
    ?.semantics?.declaration;
  if (!declaration) fail("declaration-unavailable");
  const semantics = deriveButtonCandidateSemantics({
    source: evidence.source,
    sourceRevision: evidence.sourceRevision,
    sourceProgramSha256: evidence.sourceProgramSha256,
    declaration,
    declarationProblems: [],
    runtime: {
      artifactRevision: artifact.artifactRevision,
      interfaceRevision: artifact.interfaceRevision,
      registrationTag: artifact.registrationTag,
      interface: manifest.interface,
      stylesheets: manifest.files
        .filter((file) => file.kind === "stylesheet")
        .map((file) => file.path),
    },
    expectedCaseIds: evidence.rows.map((row) => `${row.runId}:${row.story}`),
    cases: evidence.rows.map((row) => {
      const matches = selection.report.rows.filter(
        (bound) => bound.story === row.story,
      );
      const bound = matches.length === 1 ? matches[0] : undefined;
      const matched =
        bound?.status === "structure-matched" && bound.problems.length === 0;
      return {
        id: `${row.runId}:${row.story}`,
        story: row.story,
        sourceEligible: row.eligible === true && matched,
        problems: [
          ...row.problems,
          ...(bound?.problems ?? []),
          ...(!matched ? ["candidate-binding-row-unqualified"] : []),
        ],
        semantics: row.semantics,
        boundTopology: bound?.boundTopology,
      };
    }),
  });
  // Copy nested data: mutating a returned report must never mutate the selected
  // request or become the "expected" value in later re-derivation.
  return structuredClone({
    version: 1,
    request: selection.request,
    binding: { id: selection.id, reportSha256: selection.reportSha256 },
    sourceProgramSha256: evidence.sourceProgramSha256,
    status: "prepared",
    acceptedContract: null,
    adapter: "altitude-button-runtime-v1",
    qualification: "source-and-runtime-only",
    source: {
      revision: inputs.sourceRevision,
      inputRevision: inputs.inputRevision,
    },
    runtime: {
      artifactRevision: artifact.artifactRevision,
      interfaceRevision: artifact.interfaceRevision,
    },
    semanticsRevision: revisionOf(semantics),
    semantics,
  });
}

export function buildAnyCandidatePreparationReport(
  selection: VerifiedBindingSelection,
  artifact: VerifiedRuntimeArtifact,
  inputs: RuntimeInputManifest,
): CandidatePreparationReport | StatefulCandidatePreparationReport {
  return selection.request.version === 2
    ? buildStatefulCandidatePreparationReport(selection, artifact, inputs, {
        anatomyVersion: 2,
      })
    : buildCandidatePreparationReport(selection, artifact, inputs);
}

/** Test seam for read-only current-source inspection, never HTTP-selectable.
 * Artifact verification and semantic re-derivation cannot be replaced here. */
export function createCandidatePreparationValidator(
  inspectInputs: typeof inspectAltitudeRuntimeInputs = inspectAltitudeRuntimeInputs,
): CandidateReportValidator {
  return (value, context) => {
    if (
      !object(value) ||
      !object(value.runtime) ||
      typeof value.runtime.artifactRevision !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(value.runtime.artifactRevision)
    )
      fail("preparation-report-invalid");
    // context.directory is the manager's validated fixed UUID directory, not
    // an artifact path provided by the report or HTTP request.
    const directory = context.directory;
    if (
      !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(
        path.basename(directory),
      ) ||
      path.basename(path.dirname(directory)) !== "source-candidate-app" ||
      path.basename(path.resolve(directory, "../..")) !== "private"
    )
      fail("preparation-directory-invalid");
    const repository = path.resolve(directory, "../../..");
    const artifact = readVerifiedRuntimeArtifact(
      path.join(directory, "runtime", value.runtime.artifactRevision.slice(7)),
      value.runtime.artifactRevision,
    );
    const inputs = inspectInputs(
      path.resolve(repository, "../altitude"),
      context.selection.request.version === 2 ? "checkbox" : "button",
    );
    // Historical v1 reports retain their exact derivation and digest. New
    // preparations carry v2 anatomy; neither version rewrites the other.
    const expected =
      value.adapter === "altitude-checkbox-runtime-v1" &&
      context.selection.request.version === 2
        ? buildStatefulCandidatePreparationReport(
            context.selection,
            artifact,
            inputs,
          )
        : buildAnyCandidatePreparationReport(
            context.selection,
            artifact,
            inputs,
          );
    // Exact schema/scope comparison rejects added grades, fake acceptance and
    // even self-consistently rehashed but invented source semantics.
    if (!same(value, expected)) fail("preparation-report-mismatch");
    if (expected.adapter !== "altitude-button-runtime-v1")
      return summarizeStatefulPreparation(expected);
    const { semantics } = expected;
    return {
      counters: {
        plannedCases: semantics.coverage.cases.expected,
        structurallyMatchedCases: semantics.coverage.cases.matched,
        refusedCases: semantics.coverage.cases.refused,
        variantStates: semantics.coverage.variants.states.filter(
          (state) => state.caseIds.length > 0,
        ).length,
        slots: semantics.slots.length,
        writableProperties:
          semantics.runtime?.properties.filter((property) => property.writable)
            .length ?? 0,
      },
      problems: [
        "candidate-visual-contract-pending",
        "candidate-native-projection-unverified",
        ...(semantics.status === "refused"
          ? ["candidate-semantics-refused"]
          : []),
        ...(semantics.coverage.cases.refused
          ? ["candidate-source-cases-refused"]
          : []),
        ...(semantics.coverage.branches.some((branch) => !branch.caseIds.length)
          ? ["candidate-source-branch-unobserved"]
          : []),
      ],
    };
  };
}

export const validateCandidatePreparationReport =
  createCandidatePreparationValidator();
