/** Source-owned visual candidate: exact source identities feed the existing
 * computed fusion. This is neither a new renderer nor permission to emit. */
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { mintTokens } from "../core/mint-tokens.js";
import { runtimeProjectionRevision } from "../core/runtime-emission.js";
import { validateContract } from "../packages/core/src/validate.js";
import {
  ContractSchema,
  DECLARED_CHANNELS,
  LITERAL_CHANNELS,
  walkAnatomy,
  type Contract,
} from "../scripts/contract-schema.js";
import {
  applyMintToContract,
  enrichLayout,
  prepareMint,
  type AlignedSweep,
} from "../extract/computed/fuse.js";
import type { UnionNode } from "../extract/computed/anatomy.js";
import type {
  PropSpace,
  ComponentConfig,
} from "../extract/computed/capture.js";
import {
  CHANNEL_TO_COMPUTED,
  enumerate,
  isFusable,
  normalizeValue,
  type Capture,
  type FlatEl,
} from "../extract/computed/lib.js";
import type { LitTemplateInput } from "../extract/adapters/lit-template.js";
import type { ButtonCandidateSemantics } from "./button-candidate-semantics.js";
import {
  projectSourceBoundAnatomy,
  type SourceBoundAnatomy,
  type SourceBoundAnatomyInput,
} from "./source-bound-anatomy.js";
import {
  buildSourceVisualSeed,
  type SourceVisualSeed,
} from "./source-visual-seed.js";

export interface SourceVisualContractInput {
  /** Host-authenticated semantics and original observation bytes. This pure
   * stage repeats structural checks; it does not authenticate their origin. */
  source: LitTemplateInput;
  semantics: ButtonCandidateSemantics;
  cases: Array<
    Omit<SourceBoundAnatomyInput, "source" | "sourceProgramSha256" | "case">
  >;
}
export interface ObservedChannelDecision {
  part: string;
  channel: string;
  status: "candidate" | "excluded";
  reason: string;
  caseIds: string[];
}
export interface SourceVisualContractCandidate {
  version: 1;
  status: "measured-candidate" | "refused";
  acceptedContract: null;
  qualification: "observed-values-only";
  sourceRevision: string;
  semanticsRevision: string;
  contract?: Contract;
  contractRevision?: string;
  tokens?: Record<string, unknown>;
  tokenRevision?: string;
  seed?: SourceVisualSeed;
  unqualifiedRuntimeBinding?: NonNullable<
    SourceVisualSeed["unqualifiedRuntimeBinding"]
  > & {
    contractRevision: string;
    tokenRevision: string;
  };
  /** All selected rows survive, including source refusals and missing trees. */
  cases: Array<{
    id: string;
    status: "projected" | "refused";
    problems: string[];
    projection?: SourceBoundAnatomy;
  }>;
  stylePlanes: Array<{ value: string; caseId?: string }>;
  channels: ObservedChannelDecision[];
  fusion?: {
    layoutReceipts: string[];
    layoutContradictions: unknown[];
    codeOnly: unknown[];
    overflowBindings: unknown[];
    enrichmentNotes: string[];
    receipts: string[];
  };
  problems: string[];
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const keyOf = (n: { templateId: string; sourceNodeId: string }) =>
  JSON.stringify([n.templateId, n.sourceNodeId]);
const supported = new Set([
  ...LITERAL_CHANNELS,
  ...Object.keys(DECLARED_CHANNELS),
  ...Object.values(CHANNEL_TO_COMPUTED).flat(),
  "display",
  "flex-direction",
  "align-items",
  "justify-content",
  "flex-wrap",
]);
/** These measurements depend on sample content or placement. An authored
 * constraint needs its own proof; a populated sample box is not that proof. */
const sampleGeometry =
  /^(?:(?:min-|max-)?(?:width|height)|margin(?:-|$)|inset(?:-|$)|top$|right$|bottom$|left$|translate(?:-|$)|transform(?:-|$)|flex-basis$)/;
function exclusion(channel: string): string | undefined {
  if (channel.startsWith("--"))
    return "custom-property-environment-not-channel-binding";
  if (sampleGeometry.test(channel))
    return "sample-dependent-geometry-unqualified";
  if (!isFusable(channel)) return "existing-fusion-geometry-or-alias-exclusion";
  if (!supported.has(channel)) return "outside-candidate-channel-vocabulary";
  return undefined;
}
function fail(code: string): never {
  throw Error(`source-visual-contract-${code}`);
}

/** Does not call legacy role/text/presence promotion or fabricate UA controls.
 * Supported observed channels enter the existing layout/mint stages explicitly
 * as candidates. Covariance is not used to infer authored token identity. */
export function buildSourceVisualContractCandidate(
  input: SourceVisualContractInput,
): SourceVisualContractCandidate {
  const out: SourceVisualContractCandidate = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "observed-values-only",
    sourceRevision: input?.semantics?.source?.revision ?? "",
    semanticsRevision: input?.semantics ? revisionOf(input.semantics) : "",
    cases: [],
    stylePlanes: [],
    channels: [],
    problems: [
      "source-visual-authored-versus-ua-controls-unmeasured",
      "source-visual-token-identities-unqualified",
      "source-visual-interaction-planes-unmeasured",
      "source-visual-native-projection-unqualified",
    ],
  };
  try {
    const { semantics } = input;
    if (
      !semantics ||
      !Array.isArray(semantics.cases) ||
      !Array.isArray(input.cases)
    )
      fail("input-invalid");
    if (
      new Set(input.cases.map((c) => c.expectedCaseId)).size !==
        input.cases.length ||
      input.cases.some(
        (c) => !semantics.cases.some((s) => s.id === c.expectedCaseId),
      )
    )
      fail("case-denominator-invalid");
    for (const sourceCase of semantics.cases) {
      const raw = input.cases.find((c) => c.expectedCaseId === sourceCase.id);
      if (
        sourceCase.status !== "structure-matched" ||
        sourceCase.problems.length ||
        !raw
      ) {
        out.cases.push({
          id: sourceCase.id,
          status: "refused",
          problems: [
            ...sourceCase.problems,
            ...(!raw ? ["source-visual-original-tree-unavailable"] : []),
          ],
        });
        continue;
      }
      const projection = projectSourceBoundAnatomy({
        ...raw,
        source: input.source,
        sourceProgramSha256: semantics.source.programSha256,
        case: sourceCase,
      });
      // The Button seed below has no lowering for v2 text/pseudo/dependencies.
      // A richer anatomy must never be silently interpreted as its v1 shape.
      if (projection.version !== 1) fail("projection-version-unsupported");
      out.cases.push({
        id: sourceCase.id,
        status:
          projection.status === "structural-projection"
            ? "projected"
            : "refused",
        problems: projection.problems,
        projection,
      });
    }
    const projected = out.cases.filter((c) => c.status === "projected");
    const baseCaseId = semantics.cases.find(
      (c) => c.status === "structure-matched" && c.variant?.kind === "omitted",
    )?.id;
    const base = projected.find((c) => c.id === baseCaseId);
    if (!base || !semantics.variant) fail("omitted-base-unavailable");
    const seed = buildSourceVisualSeed({
      source: input.source,
      semantics,
      baseCaseId: base.id,
    });
    if (
      seed.status !== "unaccepted-seed" ||
      !seed.contract ||
      !seed.projection ||
      !seed.unqualifiedRuntimeBinding
    )
      fail("seed-refused");
    out.seed = seed;
    out.problems.push(...seed.problems);
    const contract = seed.contract;
    const variant = contract.props[0];
    // Figma's display label (for example '(unset)') is not a token-path
    // segment. This private axis sentinel never enters the public enum.
    let unset = "source-omitted";
    while (semantics.variant.values.includes(unset)) unset += "-omitted";
    const axes = [
      {
        prop: variant.name,
        values: [unset, ...semantics.variant.values],
        unset,
      },
    ];
    const enumeration = enumerate(axes, [], 512, { [variant.name]: unset });
    const rootIdentity = keyOf(seed.projection.root);
    const sameBranch = projected.filter((c) =>
      c.projection!.elements.some(
        (e) => e.visualPath === "" && keyOf(e) === rootIdentity,
      ),
    );
    const valueOf = (id: string) => {
      const v = semantics.cases.find((c) => c.id === id)!.variant;
      return v?.kind === "omitted"
        ? unset
        : v?.kind === "value"
          ? v.value
          : undefined;
    };
    // First declared observation per actual source variant. Additional content
    // cases corroborate common channels below, never create a public axis.
    const selected = new Map<string, typeof base>();
    for (const value of axes[0].values) {
      const row = sameBranch.find((c) => valueOf(c.id) === value);
      out.stylePlanes.push({ value, ...(row ? { caseId: row.id } : {}) });
      if (row) selected.set(value, row);
      else out.problems.push(`source-visual-style-plane-unobserved:${value}`);
    }
    // Even a uniform value would otherwise mint a universal base binding
    // spanning an unobserved appearance. Keep the seed/evidence, but refuse
    // the styled Contract until every declared appearance is observed.
    if (out.stylePlanes.some((p) => !p.caseId))
      fail("appearance-coverage-incomplete");
    const owned = seed.projection.nodes.filter(
      (n) =>
        n.kind !== "slot" &&
        base.projection!.elements.some((e) => keyOf(e) === keyOf(n)),
    );
    // A wrapper seen only with distributed content is not extrapolated across
    // variants. Its measured style remains in that case's exact projection.
    for (const n of seed.projection.nodes.filter(
      (n) => n.kind !== "slot" && !owned.includes(n),
    ))
      out.problems.push(
        `source-visual-wrapper-style-not-fused:${n.sourceNodeId}`,
      );
    const alignedByKey = new Map<string, (FlatEl | null)[]>();
    const captures: Capture[] = [];
    for (const [value, row] of selected) {
      const root = structuredClone(row.projection!.root!);
      const capture: Capture = { combo: value, interaction: "default", root };
      captures.push(capture);
      alignedByKey.set(
        `${value}__default`,
        owned.map((n) => {
          const element = row.projection!.elements.find(
            (e) => keyOf(e) === keyOf(n),
          );
          if (!element) return null;
          const node = structuredClone(element.node);
          node.style = Object.fromEntries(
            Object.entries(node.style).map(([k, v]) => [k, normalizeValue(v)]),
          );
          return {
            path: element.projectionFlatPath,
            sig: keyOf(n),
            partName: n.partName,
            node,
          };
        }),
      );
    }
    const baseFlat = alignedByKey.get(`${unset}__default`)!.map((el) => {
      if (!el) fail("base-identity-missing");
      return el;
    });
    const union: UnionNode[] = baseFlat.map((el, index) => ({
      id: index,
      sig: el.sig,
      rep: el.node,
      repPath: el.path,
      repKey: "",
      inBase: true,
      parent: null,
      children: [],
      partName: el.partName,
    }));
    owned.forEach((n, index) => {
      if (!n.parentSourceNodeId) return;
      const parentIndex = owned.findIndex(
        (p) => p.sourceNodeId === n.parentSourceNodeId,
      );
      if (parentIndex < 0) fail("source-parent-unavailable");
      union[index].parent = union[parentIndex];
      union[parentIndex].children.push(union[index]);
    });
    const aligned: AlignedSweep = {
      captures,
      byKey: new Map(captures.map((c) => [`${c.combo}__default`, c])),
      base: captures.find((c) => c.combo === unset)!,
      baseFlat,
      inBase: owned.map(() => true),
      partNames: owned.map((n) => n.partName),
      union: { entries: union, alignedByKey, receipts: [] },
      getAligned: (key) => alignedByKey.get(key) ?? owned.map(() => null),
      structureReceipts: [],
      anatomyJoin: owned.map((n) => ({ part: n.partName, join: "matched" })),
      staticOnlyParts: seed.projection.nodes
        .filter((n) => !owned.includes(n))
        .map((n) => n.partName),
    };
    const space: PropSpace = {
      contract,
      axes,
      presence: new Map(),
      stateProps: [],
      enumeration: {
        ...enumeration,
        combos: enumeration.combos.filter((c) => selected.has(c.key)),
      },
      baseComboKey: unset,
      baseAxisValues: { [variant.name]: unset },
      heldFixed: [],
    };
    const observed = new Map<string, Set<string>>();
    for (const n of owned) {
      const rows = sameBranch.flatMap((c) => {
        const e = c.projection!.elements.find((e) => keyOf(e) === keyOf(n));
        return e ? [{ id: c.id, value: valueOf(c.id), node: e.node }] : [];
      });
      const channels = new Set(rows.flatMap((r) => Object.keys(r.node.style)));
      const accepted = new Set<string>();
      observed.set(n.partName, accepted);
      for (const channel of [...channels].sort()) {
        let reason = exclusion(channel);
        if (
          !reason &&
          rows.some((r) => typeof r.node.style[channel] !== "string")
        )
          reason = "channel-coverage-incomplete";
        if (
          !reason &&
          rows.some((r) =>
            rows.some(
              (other) =>
                r.value === other.value &&
                normalizeValue(r.node.style[channel]) !==
                  normalizeValue(other.node.style[channel]),
            ),
          )
        )
          reason = "same-variant-content-observations-disagree";
        if (!reason) accepted.add(channel);
        out.channels.push({
          part: n.partName,
          channel,
          status: reason ? "excluded" : "candidate",
          reason: reason ?? "observed-value-not-authored-style-proof",
          caseIds: rows.map((r) => r.id),
        });
      }
    }
    const comp: ComponentConfig = {
      name: contract.id,
      importName: input.source.className,
      contract: "",
      sampleText: "",
      axes: [variant.name],
    };
    const layout = enrichLayout(aligned, space, observed, contract);
    const prep = prepareMint(
      aligned,
      comp,
      space,
      observed,
      [],
      layout.handled,
      contract,
    );
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes, {
      nestedPairs: true,
    });
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes, {
      nestedPairs: true,
    });
    const applied = applyMintToContract(
      contract,
      space,
      mintBase,
      prep.baseObs,
      mintStates,
      prep.stateObs,
      layout.enriched,
      prep.declared,
      prep.declaredStates,
      prep.setPlaneLiterals,
      { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas },
      prep.stateCodeOnly,
    );
    if (
      prep.stateObs.length ||
      Object.keys(mintStates.tree).length ||
      applied.enriched.states.length
    )
      fail("unmeasured-state-produced");
    const enriched = ContractSchema.parse(applied.enriched);
    // Fusion may enrich style vocabulary only. It cannot add sample defaults,
    // public enum omissions, presence booleans, or move source-owned slots.
    if (
      !same(enriched.props, contract.props) ||
      !same(
        walkAnatomy(enriched).map((p) => [p.name, p.path, p.part.slot]),
        walkAnatomy(contract).map((p) => [p.name, p.path, p.part.slot]),
      )
    )
      fail("source-semantics-altered");
    const tokens = structuredClone(mintBase.tree) as Record<string, unknown>;
    const tokenRevision = revisionOf(tokens);
    const binding = {
      ...seed.unqualifiedRuntimeBinding,
      contractRevision: runtimeProjectionRevision(enriched),
      tokenRevision,
    };
    enriched.bindings.code.runtime!.bindingRevision = revisionOf(binding);
    out.unqualifiedRuntimeBinding = binding;
    const errors: string[] = [];
    validateContract(
      enriched,
      new Map([[enriched.id, enriched]]),
      errors,
      new Map(),
    );
    if (errors.length) fail(`canonical-validation:${errors.join(";")}`);
    out.contract = enriched;
    out.contractRevision = revisionOf(enriched);
    out.tokens = tokens;
    out.tokenRevision = tokenRevision;
    out.fusion = {
      layoutReceipts: layout.receipts,
      layoutContradictions: layout.contradictions,
      codeOnly: [...prep.codeOnly, ...prep.stateCodeOnly],
      overflowBindings: applied.overflowBindings,
      enrichmentNotes: applied.enrichmentNotes,
      receipts: [
        ...prep.remintReceipts,
        ...prep.inheritanceReceipts,
        ...prep.orphanRefusals,
      ],
    };
    if (out.cases.some((c) => c.status === "refused"))
      out.problems.push("source-visual-source-cases-refused");
    out.problems = [...new Set(out.problems)];
    out.status = "measured-candidate";
  } catch (error) {
    delete out.contract;
    delete out.contractRevision;
    delete out.tokens;
    delete out.tokenRevision;
    delete out.unqualifiedRuntimeBinding;
    out.problems.push(
      error instanceof Error ? error.message : "source-visual-contract-invalid",
    );
  }
  return structuredClone(out);
}
