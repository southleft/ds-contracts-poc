/** Server-side bridge from rederived source evidence to the shared compiler's
 * inspection context. This is not an accepted Contract or a Figma operation. */
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import {
  resolveNativeSourceProjection,
  type NativeSourceCandidateProjection,
  type NativeSourcePartIdentity,
  type NativeSourceProjectionContext,
} from "../core/native-source-projection.js";
import type { RuntimeArtifactForEmission } from "../core/runtime-emission.js";
import type { TokenTreeInput } from "../core/tokens.js";
import { buildCandidateVisualReportV3 } from "./candidate-visual-report.js";

export interface NativeSourceCandidateInput {
  /** All inputs originate in the manager's latest-verified preparation and
   * binding selection. Reopening must repeat those host validations first. */
  preparation: Parameters<typeof buildCandidateVisualReportV3>[0];
  selection: Parameters<typeof buildCandidateVisualReportV3>[1];
  tokens: Parameters<typeof buildCandidateVisualReportV3>[2];
  /** Pin the particular saved v3 attempt; never silently derive a replacement. */
  expectedReportRevision: string;
  /** Read from the verified private runtime artifact, never from a request. */
  artifact: RuntimeArtifactForEmission;
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const identity = (n: {
  templateId: string;
  sourceNodeId: string;
  sourceSpan: unknown;
}) => canonicalJson([n.templateId, n.sourceNodeId, n.sourceSpan]);
function fail(code: string): never {
  throw Error(`native-source-candidate-${code}`);
}

export function prepareNativeSourceCandidate(
  input: NativeSourceCandidateInput,
) {
  const report = buildCandidateVisualReportV3(
    input.preparation,
    input.selection,
    input.tokens,
  );
  if (
    !/^sha256:[a-f0-9]{64}$/.test(input.expectedReportRevision) ||
    revisionOf(report) !== input.expectedReportRevision
  )
    fail("report-changed");
  const token = report.tokenProjection,
    wrapper = report.wrapperProjection;
  const seed = report.visual.seed?.projection;
  if (
    report.status !== "measured-candidate" ||
    report.acceptedContract !== null ||
    token.status !== "source-token-projected-candidate" ||
    !token.contract ||
    !token.tokens ||
    !token.unqualifiedRuntimeBinding ||
    !seed ||
    wrapper.status !== "snapshot-wrappers-observed" ||
    wrapper.nativeQualification !== "unqualified" ||
    !wrapper.predicates ||
    wrapper.problems.length
  )
    fail("evidence-refused");
  const runtime = input.preparation.report.runtime;
  if (
    input.artifact.artifactRevision !== runtime.artifactRevision ||
    input.artifact.interfaceRevision !== runtime.interfaceRevision ||
    revisionOf(input.artifact.interface) !== runtime.interfaceRevision
  )
    fail("runtime-changed");
  const predicates = wrapper.selectedWrappers.map((w) => {
    const matches = wrapper.predicates!.predicates.filter(
      (p) => identity(p.wrapper) === identity(w),
    );
    if (matches.length !== 1) fail("wrapper-predicate-ambiguous");
    const p = matches[0];
    // Empty native mains represent no light descendants. Only this proven
    // existential query and truthy guard has a false empty state in this slice.
    if (
      p.status !== "predicate-derived" ||
      p.problems.length ||
      p.normalForm?.kind !== "host-light-descendant-attribute" ||
      p.normalForm.attribute !== "slot" ||
      p.guard?.when !== "truthy" ||
      p.returns?.whenMatch !== "true" ||
      p.returns.whenAbsent !== "undefined"
    )
      fail("empty-wrapper-state-unqualified");
    return p;
  });
  const parts: NativeSourcePartIdentity[] = seed.nodes.map((n) => ({
    partPath: [...n.partPath],
    templateId: n.templateId,
    sourceNodeId: n.sourceNodeId,
    sourceSpan: structuredClone(n.sourceSpan),
    kind: n.kind,
    tag: n.tag,
    ...(n.kind === "slot"
      ? {
          sourceSlotName: n.sourceSlotName,
          contractSlotName: n.contractSlotName,
        }
      : {}),
    ...(predicates.some((p) => identity(p.wrapper) === identity(n))
      ? { emptyMainVisible: false as const }
      : {}),
  }));
  if (
    parts.filter((n) => n.emptyMainVisible === false).length !==
    predicates.length
  )
    fail("wrapper-part-coverage-invalid");
  const cases: NativeSourceCandidateProjection["cases"] =
    report.visual.cases.map((c) => {
      const w = wrapper.cases.find((row) => row.id === c.id);
      const semantic = input.preparation.report.semantics.cases.find(
        (row) => row.id === c.id,
      );
      if (c.status === "refused" || w?.status === "refused")
        return {
          id: c.id,
          status: "refused",
          problems: [...new Set([...c.problems, ...(w?.problems ?? [])])],
        };
      const projection = c.projection;
      if (
        !w ||
        !projection ||
        projection.status !== "structural-projection" ||
        !semantic ||
        semantic.status !== "structure-matched" ||
        !semantic.variant ||
        projection.sourceProgramSha256 !== report.sourceProgramSha256 ||
        projection.sourceSha256 !== seed.source.sourceSha256
      )
        fail("case-identity-invalid");
      return {
        id: c.id,
        status: "observed",
        problems: [],
        properties: { variant: structuredClone(semantic.variant) },
        projectionRevision: revisionOf(projection),
        samplesRevision: revisionOf(projection.samples),
        sourceTreeSha256: projection.sourceTreeSha256,
        topologyObservationSha256: projection.topologyObservationSha256,
        wrappers: w.snapshots.map((snapshot) => {
          const part = parts.find(
            (n) => identity(n) === identity(snapshot.wrapper),
          );
          if (
            !part ||
            part.emptyMainVisible !== false ||
            snapshot.evaluation.status !== "snapshot-predicate-observed" ||
            snapshot.evaluation.problems.length ||
            snapshot.evaluation.topologyObservationSha256 !==
              projection.topologyObservationSha256
          )
            fail("case-wrapper-identity-invalid");
          return {
            partPath: [...part.partPath],
            visible: snapshot.observedWrapper,
          };
        }),
      };
    });
  if (
    !same(
      cases.map((c) => c.id),
      input.preparation.report.semantics.cases.map((c) => c.id),
    )
  )
    fail("case-denominator-changed");
  const projection: NativeSourceCandidateProjection = {
    version: 1,
    purpose: "source-candidate-inspection",
    acceptedContract: null,
    nativeQualification: "unqualified",
    contractId: token.contract.id,
    contractRevision: revisionOf(token.contract),
    binding: structuredClone(token.unqualifiedRuntimeBinding),
    source: structuredClone(seed.source),
    evidence: {
      reportRevision: input.expectedReportRevision,
      semanticsRevision: input.preparation.report.semanticsRevision,
      visualRevision: report.visualRevision,
      tokenProjectionRevision: report.tokenProjectionRevision,
      wrapperProjectionRevision: report.wrapperProjectionRevision,
    },
    context: { mode: report.tokens.mode, brand: report.tokens.brand },
    parts,
    cases,
  };
  const revision = revisionOf(projection);
  const context: NativeSourceProjectionContext = {
    artifacts: new Map([
      [input.artifact.artifactRevision, structuredClone(input.artifact)],
    ]),
    candidates: new Map([
      [
        token.contract.bindings.code.runtime!.bindingRevision,
        { projection, revision },
      ],
    ]),
  };
  const tokens: TokenTreeInput = {
    primitives: structuredClone(token.tokens),
    semantic: {},
    light: {},
    dark: {},
    brands: { default: {} },
  };
  // Exercise the same strict fence the compiler will use, before returning
  // private host objects. No public JSON response should include this registry.
  resolveNativeSourceProjection(
    token.contract,
    { tokens, ...projection.context },
    context,
  );
  return {
    version: 1 as const,
    status: "inspection-context-prepared" as const,
    acceptedContract: null,
    nativeQualification: "unqualified" as const,
    contract: structuredClone(token.contract),
    projection: structuredClone(projection),
    revision,
    engineInput: {
      tokens,
      ...projection.context,
      nativeSourceCandidate: context,
    },
  };
}
