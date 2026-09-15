/** A deterministic, private inspection plan assembled from verified source
 * inputs. It prepares no executable transport and performs no native writes. */
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { createFigmaEngine } from "../core/emit-figma-script.js";
import type { NativeSourceWriteContext } from "../core/native-source-write.js";
import {
  prepareNativeTokenContext,
  type NativeTokenContextInput,
} from "../core/native-token-context.js";
import { aliasTarget, flattenTokens } from "../core/tokens.js";
import { resolveTokens, walkAnatomy } from "../scripts/contract-schema.js";
import {
  prepareNativeSourceCandidate,
  type NativeSourceCandidateInput,
} from "./native-source-candidate.js";
import { buildNativeSourceSamples } from "./native-source-samples.js";
import type { SourceVisualContractInput } from "./source-visual-contract.js";

export interface NativeSourcePlanInput {
  source: NativeSourceCandidateInput;
  /** A host-owned journal allocates the operation ID once. File authorization
   * is an apply-time policy, never inferred from a file key in this plan. */
  operation: { id: string; fileKey: string };
}
function fail(code: string): never {
  throw Error(`native-source-plan-${code}`);
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export function prepareNativeSourceInspectionPlan(
  input: NativeSourcePlanInput,
) {
  if (
    !input.operation ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.operation.id) ||
    !/^[A-Za-z0-9]{10,80}$/.test(input.operation.fileKey)
  )
    fail("operation-identity-invalid");
  const prepared = prepareNativeSourceCandidate(input.source);
  const engine = createFigmaEngine({
    ...prepared.engineInput,
    icons: new Map(),
  });
  const component = engine.compileComponentData(
    prepared.contract,
    new Map([[prepared.contract.id, prepared.contract]]),
  );
  const { selection, preparation } = input.source;
  const source: SourceVisualContractInput = {
    source: selection.evidence.source,
    semantics: preparation.report.semantics,
    cases: selection.evidence.rows.flatMap((row) => {
      const bound = selection.report.rows.find(
        (candidate) => candidate.story === row.story,
      );
      if (
        !row.eligible ||
        row.problems.length ||
        !row.semantics ||
        !row.topology ||
        bound?.status !== "structure-matched" ||
        bound.problems.length ||
        !bound.boundTopology
      )
        return [];
      return [
        {
          expectedCaseId: `${row.runId}:${row.story}`,
          semantics: row.semantics,
          boundTopology: bound.boundTopology,
          tree: { root: row.topology.tree, sha256: row.topology.treeSha256 },
        },
      ];
    }),
  };
  const samples = buildNativeSourceSamples({
    source,
    expectedVisualRevision: prepared.projection.evidence.visualRevision,
  });
  if (
    samples.status !== "comparison-samples-lowered" ||
    !same(
      samples.cases.map((c) => c.id),
      prepared.projection.cases.map((c) => c.id),
    )
  )
    fail("sample-coverage-refused");
  for (const [index, c] of prepared.projection.cases.entries()) {
    const sample = samples.cases[index];
    if (
      c.status === "refused"
        ? sample.status !== "refused"
        : sample.status !== "lowered" ||
          sample.sourceTreeSha256 !== c.sourceTreeSha256 ||
          sample.topologyObservationSha256 !== c.topologyObservationSha256
    )
      fail("sample-source-mismatch");
  }
  // Preserve every token reference carried by the finite Contract projection,
  // including channels not yet natively drawable. This is variable carriage,
  // not a claim that every Contract address has an editable native binding.
  const paths = new Set<string>();
  const tree = prepared.engineInput.tokens.primitives;
  const leaves = flattenTokens(tree);
  for (const c of prepared.projection.cases.filter(
    (row) => row.status === "observed",
  )) {
    const values = Object.fromEntries(
      Object.entries(c.properties!).flatMap(([name, value]) =>
        value.kind === "omitted" ? [] : [[name, String(value.value)]],
      ),
    );
    for (const { part } of walkAnatomy(prepared.contract))
      for (const reference of Object.values(resolveTokens(part, values))) {
        const path = aliasTarget(reference);
        if (!path || !leaves.has(path))
          fail("contract-token-reference-invalid");
        paths.add(path);
      }
  }
  const tokenInput: NativeTokenContextInput = {
    fileKey: input.operation.fileKey,
    scopeId: `source-${input.operation.id}`,
    source: {
      revision: prepared.projection.source.revision,
      sourceProgramSha256: prepared.projection.source.programSha256,
      tokensSha256: input.source.tokens.sha256,
    },
    tokenPaths: [...paths].sort(),
    modes: [
      {
        sourceMode: prepared.projection.context.mode,
        brand: prepared.projection.context.brand,
        nativeModeName:
          prepared.projection.context.mode === "dark" ? "Dark" : "Light",
        tokens: structuredClone(tree),
        tokenTreeRevision: revisionOf(tree),
      },
    ],
  };
  const tokenPreparation = prepareNativeTokenContext(tokenInput);
  const plan = {
    version: 1 as const,
    purpose: "source-candidate-inspection" as const,
    acceptedContract: null,
    nativeQualification: "unqualified" as const,
    operation: structuredClone(input.operation),
    source: structuredClone(prepared.projection.source),
    evidence: structuredClone(prepared.projection.evidence),
    sourceProjection: prepared.projection,
    sourceProjectionRevision: prepared.revision,
    component,
    componentRevision: revisionOf(component),
    samples,
    samplesRevision: revisionOf(samples),
    tokenInput,
    tokenPreparation,
    limitations: [
      "source-native-apply-not-authorized-by-plan",
      "source-native-output-not-observed",
      "source-native-automatic-wrapper-reevaluation-unqualified",
      "source-native-inherited-sample-token-bindings-unqualified",
      "source-native-variable-carriage-not-channel-qualification",
    ],
  };
  return { plan, revision: revisionOf(plan) };
}

/** Reopen the authenticated source inputs and reproduce the saved full plan
 * before emitting empty native mains through the existing engine. The caller
 * must journal the command before delivering it. This function does no I/O and
 * grants no dispatch/retry permission; samples are not applied by this phase. */
export function buildNativeSourceComponentWrite(
  input: NativeSourcePlanInput & {
    expectedPlanRevision: string;
    tokens: NativeSourceWriteContext["tokens"];
  },
) {
  const current = prepareNativeSourceInspectionPlan(input);
  if (
    current.revision !== input.expectedPlanRevision ||
    !same(current.plan.tokenInput, input.tokens.input)
  )
    fail("write-plan-stale");
  const prepared = prepareNativeSourceCandidate(input.source);
  const engine = createFigmaEngine({
    ...prepared.engineInput,
    icons: new Map(),
  });
  const script = engine.buildNativeSourceComponentScript(
    prepared.contract,
    new Map([[prepared.contract.id, prepared.contract]]),
    { operation: input.operation, tokens: input.tokens },
  );
  return { planRevision: current.revision, script };
}
