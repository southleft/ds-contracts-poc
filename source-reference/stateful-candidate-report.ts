/** Source/runtime joins for a stateful component. No native contract, editable
 * channel or behavior qualification is inferred from structural observations. */
import ts from "typescript";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { readLitTemplateBindings } from "../extract/adapters/lit-template.js";
import { bindingStories } from "./binding-evidence.js";
import type { VerifiedBindingSelection } from "./binding-jobs.js";
import type {
  CandidatePreparedReport,
  CandidateValidatedSummary,
} from "./candidate-jobs.js";
import {
  deriveLifecycleIdentityPolicy,
  semanticReplayMatches,
} from "./lifecycle-identity.js";
import { matchLitRender, type LitRenderMatch } from "./lit-render-match.js";
import type { SourceTopology } from "./topology.js";
import {
  projectSourceBoundAnatomy,
  type SourceBoundAnatomy,
} from "./source-bound-anatomy.js";
import {
  altitudeRuntimeRecipeIdentity,
  type RuntimeInputManifest,
  type VerifiedRuntimeArtifact,
} from "./runtime-artifact.js";

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function fail(code: string): never {
  throw Error(`candidate-${code}`);
}
type BooleanState = { kind: "omitted" } | { kind: "value"; value: boolean };
interface StatefulCase {
  id: string;
  story: string;
  status: "structure-matched" | "refused";
  problems: string[];
  states: Record<string, BooleanState>;
  nodes: LitRenderMatch["nodes"];
  slots: LitRenderMatch["slots"];
  texts: NonNullable<LitRenderMatch["texts"]>;
  bindings: LitRenderMatch["bindings"];
  nestedHosts: SourceTopology["nodes"];
  pseudoPlanes: NonNullable<SourceTopology["pseudoPlanes"]>;
  sourcePngSha256?: string;
  sourceTreeSha256?: string;
  semanticObservationSha256?: string;
  topologyObservationSha256?: string;
}
export interface StatefulCandidatePreparationReport extends CandidatePreparedReport {
  adapter: "altitude-checkbox-runtime-v1" | "altitude-checkbox-runtime-v2";
  anatomy?: { version: 2; cases: SourceBoundAnatomy[]; revision: string };
  qualification: "source-and-runtime-only";
  source: { revision: string; inputRevision: string };
  runtime: { artifactRevision: string; interfaceRevision: string };
  semanticsRevision: string;
  semantics: {
    version: 2;
    status: "semantic-candidate" | "refused";
    source: {
      revision: string;
      sourceSha256: string;
      programSha256: string;
      className: string;
      tagName: string;
    };
    runtime: VerifiedRuntimeArtifact["manifest"]["interface"];
    booleanAxes: Array<{
      property: string;
      sourceSpan: { start: number; end: number };
      states: Array<{ state: BooleanState; caseIds: string[] }>;
      missing: BooleanState[];
      projection: "unqualified";
    }>;
    slots: Array<{ name: string; caseIds: string[] }>;
    cases: StatefulCase[];
    coverage: { expected: number; matched: number; refused: number };
    limitations: string[];
  };
}

export function buildStatefulCandidatePreparationReport(
  selection: VerifiedBindingSelection,
  artifact: VerifiedRuntimeArtifact,
  inputs: RuntimeInputManifest,
  options?: { anatomyVersion: 2 },
): StatefulCandidatePreparationReport {
  const { evidence, request } = selection,
    { manifest } = artifact;
  const recipe = altitudeRuntimeRecipeIdentity("checkbox");
  const sourceFile = inputs.files.filter(
    (file) => file.kind === "source" && file.path === evidence.sourcePath,
  );
  if (
    request.version !== 2 ||
    request.component !== "al-checkbox" ||
    !same(request, evidence.request) ||
    !same(request, selection.report.request) ||
    selection.report.sourceStable !== true ||
    selection.report.sourceProgramSha256 !== evidence.sourceProgramSha256 ||
    !same(manifest.inputs, inputs) ||
    inputs.adapter !== "altitude-checkbox-v1" ||
    manifest.adapter !== inputs.adapter ||
    manifest.source.inputRevision !== inputs.inputRevision ||
    manifest.source.revision !== inputs.sourceRevision ||
    inputs.sourceRevision !== evidence.sourceRevision ||
    manifest.source.baselineSha256 !== request.baseline.sha256 ||
    manifest.recipe.version !== recipe.version ||
    manifest.recipe.sha256 !== recipe.sha256 ||
    !same(manifest.recipe.conditions, recipe.conditions) ||
    manifest.recipe.repeatedBuildIdentical !== true ||
    sourceFile.length !== 1 ||
    sourceFile[0].sha256 !== evidence.source.sourceSha256 ||
    sourceFile[0].bytes !== Buffer.byteLength(evidence.source.source)
  )
    fail("runtime-source-identity-mismatch");
  const stories = bindingStories(request);
  if (
    !same(
      evidence.rows.map((row) => row.story),
      stories,
    ) ||
    !same(
      selection.report.rows.map((row) => row.story),
      stories,
    )
  )
    fail("stateful-cohort-mismatch");
  const declaration = evidence.rows.find((row) => row.eligible && row.semantics)
    ?.semantics?.declaration;
  const api = manifest.interface;
  if (
    !declaration ||
    declaration.className !== "ALCheckbox" ||
    declaration.tagName !== "al-checkbox" ||
    declaration.modulePath !== evidence.source.modulePath ||
    evidence.source.className !== declaration.className ||
    api.module.exportName !== declaration.className ||
    api.tagBase !== declaration.tagName ||
    artifact.interfaceRevision !== revisionOf(api) ||
    manifest.interfaceRevision !== artifact.interfaceRevision ||
    !same(api.slots, declaration.slots) ||
    !same(api.events, declaration.events) ||
    !same(
      api.originalDeclarations.filter(
        (row) => row.className === declaration.className,
      ),
      [declaration],
    )
  )
    fail("stateful-api-mismatch");
  const source = readLitTemplateBindings(evidence.source);
  if (source.status === "refused") fail("source-declaration-mismatch");
  const file = ts.createSourceFile(
    "source.ts",
    evidence.source.source,
    ts.ScriptTarget.Latest,
    true,
  );
  const classes = file.statements
    .filter(ts.isClassDeclaration)
    .filter((node) => node.name?.text === declaration.className);
  if (classes.length !== 1) fail("source-class-ambiguous");
  const fields = classes[0].members
    .filter(ts.isPropertyDeclaration)
    .filter(
      (field) =>
        !field.modifiers?.some((modifier) =>
          [
            ts.SyntaxKind.PrivateKeyword,
            ts.SyntaxKind.ProtectedKeyword,
            ts.SyntaxKind.StaticKeyword,
          ].includes(modifier.kind),
        ),
    );
  const axes: StatefulCandidatePreparationReport["semantics"]["booleanAxes"] =
    [];
  for (const field of fields) {
    if (!ts.isIdentifier(field.name) || !field.type)
      fail("stateful-field-unqualified");
    const name = field.name.text,
      type = field.type.getText(file);
    const declared = declaration.properties.filter(
      (prop) => prop.name === name,
    );
    const retained = api.properties.filter((prop) => prop.name === name);
    if (
      declared.length !== 1 ||
      retained.length !== 1 ||
      !retained[0].writable ||
      !api.writableProperties.includes(name) ||
      declared[0].typeText !== type ||
      retained[0].typeText !== type ||
      retained[0].declaringClass !== declaration.className
    )
      fail("source-api-type-or-writability-mismatch");
    if (field.type.kind !== ts.SyntaxKind.BooleanKeyword) continue;
    if (field.initializer || declared[0].default !== undefined)
      fail("boolean-default-unqualified");
    axes.push({
      property: name,
      sourceSpan: { start: field.getStart(file), end: field.end },
      states: [
        { state: { kind: "omitted" }, caseIds: [] },
        { state: { kind: "value", value: false }, caseIds: [] },
        { state: { kind: "value", value: true }, caseIds: [] },
      ],
      missing: [],
      projection: "unqualified",
    });
  }
  if (!axes.length) fail("boolean-api-unavailable");
  const cases: StatefulCase[] = evidence.rows.map((original, index) => {
    const bound = selection.report.rows[index];
    const row: StatefulCase = {
      id: `${original.runId}:${original.story}`,
      story: original.story,
      status: "refused",
      problems: [],
      states: {},
      nodes: [],
      slots: [],
      texts: [],
      bindings: [],
      nestedHosts: [],
      pseudoPlanes: [],
    };
    if (
      !original.eligible ||
      original.problems.length ||
      bound.status !== "structure-matched" ||
      bound.problems.length
    ) {
      row.problems.push(
        ...original.problems,
        ...bound.problems,
        "candidate-source-case-unavailable",
      );
      return row;
    }
    const semantics = bound.replaySemantics;
    if (
      !original.semantics ||
      !semantics ||
      !bound.renderObservation ||
      !bound.boundTopology ||
      !same(semantics.declaration, declaration) ||
      !same(original.semantics.declaration, declaration) ||
      semantics.sourcePngSha256 !== original.semantics.sourcePngSha256 ||
      semantics.sourceTreeSha256 !== original.semantics.sourceTreeSha256 ||
      !semanticReplayMatches(
        original.semantics.observation,
        semantics.observation,
        deriveLifecycleIdentityPolicy(evidence.source, declaration),
      )
    )
      fail("stateful-fresh-semantics-mismatch");
    const match = matchLitRender({
      source: evidence.source,
      semantics,
      boundTopology: bound.boundTopology,
      staticRender: {
        observation: bound.renderObservation,
        sourcePngSha256: semantics.sourcePngSha256,
        sourceTreeSha256: semantics.sourceTreeSha256!,
      },
    });
    if (!same(match, bound.correspondence))
      fail("stateful-correspondence-mismatch");
    if (match.status !== "structure-matched") {
      row.problems.push(...match.problems);
      return row;
    }
    for (const axis of axes) {
      const observed = semantics.observation.properties[axis.property];
      if (observed?.kind === "undefined")
        row.states[axis.property] = { kind: "omitted" };
      else if (
        observed?.kind === "value" &&
        typeof observed.value === "boolean"
      )
        row.states[axis.property] = { kind: "value", value: observed.value };
      else fail("stateful-boolean-unobserved");
      axis.states
        .find((item) => same(item.state, row.states[axis.property]))!
        .caseIds.push(row.id);
    }
    const topology = bound.boundTopology.topology!.observation!;
    return {
      ...row,
      status: "structure-matched",
      nodes: match.nodes,
      slots: match.slots,
      texts: match.texts ?? [],
      bindings: match.bindings,
      nestedHosts: topology.nodes.filter(
        (node) =>
          node.domPath !== topology.hostDomPath &&
          node.kind === "element" &&
          node.tag?.includes("-"),
      ),
      pseudoPlanes: topology.pseudoPlanes ?? [],
      sourcePngSha256: match.sourcePngSha256,
      sourceTreeSha256: match.sourceTreeSha256,
      semanticObservationSha256: match.semanticObservationSha256,
      topologyObservationSha256: match.topologyObservationSha256,
    };
  });
  for (const axis of axes)
    axis.missing = axis.states
      .filter((item) => !item.caseIds.length)
      .map((item) => item.state);
  const matched = cases.filter(
    (row) => row.status === "structure-matched",
  ).length;
  const semantics: StatefulCandidatePreparationReport["semantics"] = {
    version: 2,
    status: matched ? "semantic-candidate" : "refused",
    source: {
      revision: evidence.sourceRevision,
      sourceSha256: evidence.source.sourceSha256,
      programSha256: evidence.sourceProgramSha256,
      className: declaration.className,
      tagName: declaration.tagName,
    },
    runtime: api,
    booleanAxes: axes,
    slots: declaration.slots.map((slot) => ({
      name: slot.name,
      caseIds: cases
        .filter((row) => row.slots.some((item) => item.name === slot.name))
        .map((row) => row.id),
    })),
    cases,
    coverage: {
      expected: stories.length,
      matched,
      refused: stories.length - matched,
    },
    limitations: [
      "Original runtime and declarations are retained, not a generated native Contract, acceptance or behavior qualification.",
      "Boolean values are observations after render. Omission is distinct from explicit false; unobserved states and combinations are not qualified.",
      "Source text, slots, pseudo owners and nested open-shadow hosts retain identity. Structural correspondence is not a causal editable binding or a native component mapping.",
      "Runtime packaging tests are separate from these source observations; interaction, accessibility and visual fidelity are not graded by this preparation.",
    ],
  };
  const anatomy =
    options?.anatomyVersion === 2
      ? cases.map((row, index) => {
          const original = evidence.rows[index],
            bound = selection.report.rows[index];
          const root = row.nodes.find(
            (node) =>
              node.domPath ===
              bound.boundTopology?.topology?.observation?.rootDomPath,
          );
          return projectSourceBoundAnatomy({
            version: 2,
            expectedCaseId: row.id,
            sourceProgramSha256: evidence.sourceProgramSha256,
            source: evidence.source,
            case: {
              id: row.id,
              story: row.story,
              status: row.status,
              problems: row.problems,
              limitations: [],
              ...(root
                ? {
                    branch: {
                      templateId: root.templateId,
                      sourceNodeId: root.sourceNodeId,
                      tag: root.tag,
                    },
                  }
                : {}),
              nodes: row.nodes,
              sourcePngSha256: row.sourcePngSha256,
              sourceTreeSha256: row.sourceTreeSha256,
              semanticObservationSha256: row.semanticObservationSha256,
              topologyObservationSha256: row.topologyObservationSha256,
            },
            semantics: bound.replaySemantics!,
            boundTopology: bound.boundTopology!,
            staticRender: bound.renderObservation && {
              observation: bound.renderObservation,
              sourcePngSha256: row.sourcePngSha256!,
              sourceTreeSha256: row.sourceTreeSha256!,
            },
            tree: {
              root: original.topology?.tree!,
              sha256: original.topology?.treeSha256!,
            },
          });
        })
      : undefined;
  return structuredClone({
    version: 1,
    request,
    binding: { id: selection.id, reportSha256: selection.reportSha256 },
    sourceProgramSha256: evidence.sourceProgramSha256,
    status: "prepared",
    acceptedContract: null,
    adapter: anatomy
      ? "altitude-checkbox-runtime-v2"
      : "altitude-checkbox-runtime-v1",
    ...(anatomy
      ? {
          anatomy: {
            version: 2 as const,
            cases: anatomy,
            revision: revisionOf(anatomy),
          },
        }
      : {}),
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

export function summarizeStatefulPreparation(
  report: StatefulCandidatePreparationReport,
): CandidateValidatedSummary {
  const { semantics } = report;
  return {
    counters: {
      ...(report.anatomy
        ? {
            anatomyProjectedCases: report.anatomy.cases.filter(
              (row) => row.status === "structural-projection",
            ).length,
            anatomyRefusedCases: report.anatomy.cases.filter(
              (row) => row.status === "refused",
            ).length,
          }
        : {}),
      plannedCases: semantics.coverage.expected,
      structurallyMatchedCases: semantics.coverage.matched,
      refusedCases: semantics.coverage.refused,
      booleanAxes: semantics.booleanAxes.length,
      missingBooleanStates: semantics.booleanAxes.reduce(
        (n, axis) => n + axis.missing.length,
        0,
      ),
      slots: semantics.slots.length,
      unobservedSlots: semantics.slots.filter((slot) => !slot.caseIds.length)
        .length,
      writableProperties: semantics.runtime.writableProperties.length,
      nestedHosts: semantics.cases.reduce(
        (n, row) => n + row.nestedHosts.length,
        0,
      ),
      sourceTexts: semantics.cases.reduce((n, row) => n + row.texts.length, 0),
    },
    stateful: {
      booleanStates: semantics.booleanAxes.map((axis) => ({
        property: axis.property,
        omitted: axis.states[0].caseIds.length,
        explicitFalse: axis.states[1].caseIds.length,
        explicitTrue: axis.states[2].caseIds.length,
      })),
      slots: semantics.slots.map((slot) => ({
        name: slot.name,
        observedCases: slot.caseIds.length,
      })),
    },
    problems: [
      "candidate-visual-contract-pending",
      "candidate-native-projection-unverified",
      "candidate-stateful-dependencies-unqualified",
      ...(semantics.coverage.refused ? ["candidate-source-cases-refused"] : []),
      ...(semantics.booleanAxes.some((axis) => axis.missing.length)
        ? ["candidate-boolean-states-unobserved"]
        : []),
      ...(semantics.slots.some((slot) => !slot.caseIds.length)
        ? ["candidate-source-slot-unobserved"]
        : []),
    ],
  };
}
