/** A new, unaccepted projection over the historical measured candidate.
 * Only exact recorded root token identities replace provisional references.
 * The host still authenticates the raw evidence; this stage executes nothing. */
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import { runtimeProjectionRevision } from "../core/runtime-emission.js";
import { flattenTokens, makeResolveLiteral } from "../core/tokens.js";
import { validateContract } from "../packages/core/src/validate.js";
import {
  ContractSchema,
  resolveTokens,
  tokensByPropEntries,
  walkAnatomy,
  type Contract,
} from "../scripts/contract-schema.js";
import type { SourceAnatomyIdentity } from "./source-bound-anatomy.js";
import {
  resolveSourceTokenBindings,
  type SourceTokenBindings,
  type SourceTokenBindingsInput,
  type SourceTokenOutcome,
} from "./source-token-bindings.js";
import {
  buildSourceVisualContractCandidate,
  type SourceVisualContractCandidate,
} from "./source-visual-contract.js";

const CHANNELS = ["background-color", "color", "font-weight"] as const;
type Channel = (typeof CHANNELS)[number];
type Binding = NonNullable<SourceTokenOutcome["binding"]>;
type UnqualifiedBinding = NonNullable<
  SourceVisualContractCandidate["unqualifiedRuntimeBinding"]
>;
export interface SourceTokenProjectionRewrite extends SourceAnatomyIdentity {
  partPath: ["root"];
  channel: Channel;
  address:
    | { storage: "tokens" }
    | { storage: "tokensByProp"; prop: "variant"; value: string };
  previousEffectiveRef: string;
  ref: string;
  tokenPath: string;
  caseIds: string[];
}
export interface SourceTokenProjection {
  version: 1;
  status: "source-token-projected-candidate" | "refused";
  acceptedContract: null;
  qualification: "recorded-source-token-references-only";
  /** Upstream outputs are retained exactly, including seed, sample records and
   * refused cases. Their hashes remain prior identities, never rewritten. */
  visual: SourceVisualContractCandidate;
  tokenBindings: SourceTokenBindings;
  prior: {
    visualRevision: string;
    tokenBindingsRevision: string;
    contractRevision?: string;
    tokenRevision?: string;
    runtimeBindingRevision?: string;
  };
  source?: {
    revision: string;
    sourceSha256: string;
    sourceProgramSha256: string;
    semanticsRevision: string;
  };
  context?: { mode: "dark"; brand: "default"; tokensSha256: string };
  contract?: Contract;
  contractRevision?: string;
  contractProjectionRevision?: string;
  tokens?: Record<string, unknown>;
  tokenRevision?: string;
  unqualifiedRuntimeBinding?: UnqualifiedBinding;
  runtimeBindingRevision?: string;
  sourceTokenPaths: string[];
  rewrites: SourceTokenProjectionRewrite[];
  problems: string[];
  limitations: string[];
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const identity = (value: SourceAnatomyIdentity): SourceAnatomyIdentity => ({
  templateId: value.templateId,
  sourceNodeId: value.sourceNodeId,
  sourceSpan: { ...value.sourceSpan },
});
function fail(code: string): never {
  throw Error(`source-token-projection-${code}`);
}
const pathOf = (ref: string): string => {
  const match = /^\{([a-z0-9-]+(?:\.[a-z0-9-]+)*)\}$/.exec(ref);
  if (!match) fail("reference-shape-unsupported");
  return match[1];
};

/** Equality of resolved values, not token-name selection. Preserve exact alpha:
 * minting's rounded hex representation cannot silently authorize a new value. */
function color(value: string): number[] | undefined {
  const hex = /^#([a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.exec(
    value,
  );
  if (hex) {
    const raw =
      hex[1].length <= 4 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4]
      .map((index) => parseInt(raw.slice(index, index + 2), 16))
      .concat(raw.length === 8 ? parseInt(raw.slice(6), 16) / 255 : 1);
  }
  if (value === "transparent") return [0, 0, 0, 0];
  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(
      value,
    );
  if (!rgb) return;
  const tuple = [
    Number(rgb[1]),
    Number(rgb[2]),
    Number(rgb[3]),
    rgb[4] === undefined ? 1 : Number(rgb[4]),
  ];
  return tuple.every(Number.isFinite) &&
    tuple.slice(0, 3).every((n) => n <= 255) &&
    tuple[3] <= 1
    ? tuple
    : undefined;
}
function equivalent(a: unknown, b: unknown, type: string): boolean {
  if (typeof a !== "string" && typeof a !== "number") return false;
  if (typeof b !== "string" && typeof b !== "number") return false;
  if (String(a) === String(b)) return true;
  if (type !== "color") return false;
  const left = color(String(a).trim()),
    right = color(String(b).trim());
  return !!left && !!right && same(left, right);
}

/** Raw host-selected data only: callers cannot supply an accepted candidate,
 * precomputed binding verdict or replacement Contract. This v1 projection does
 * not alter the existing visual candidate/report derivation or its history. */
export function buildSourceTokenProjection(
  input: SourceTokenBindingsInput,
): SourceTokenProjection {
  const visual = buildSourceVisualContractCandidate(input?.source),
    tokenBindings = resolveSourceTokenBindings(input);
  const out: SourceTokenProjection = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "recorded-source-token-references-only",
    visual,
    tokenBindings,
    prior: {
      visualRevision: revisionOf(visual),
      tokenBindingsRevision: revisionOf(tokenBindings),
      ...(visual.contractRevision
        ? { contractRevision: visual.contractRevision }
        : {}),
      ...(visual.tokenRevision ? { tokenRevision: visual.tokenRevision } : {}),
      ...(visual.contract?.bindings.code.runtime
        ? {
            runtimeBindingRevision:
              visual.contract.bindings.code.runtime.bindingRevision,
          }
        : {}),
    },
    sourceTokenPaths: [],
    rewrites: [],
    problems: [],
    limitations: [
      "The host authenticates the original evidence and fixed dark/default DTCG bytes. Rederivation and hashes establish consistency, not authority for new inputs.",
      "Only the selected source root's recorded background-color, color and font-weight names are projected. Equal-valued tokens, inherited wrapper styles, other channels and sample references grant no additional bindings.",
      "The complete source DTCG and prior provisional leaves are retained. Unused provisional leaves are historical candidates, not new source bindings.",
      "Recorded source names do not qualify native variable IDs/modes, editable runtime channels, CSS cascade winners or arbitrary input combinations. The runtime binding stays version zero; both emitters remain blocked.",
    ],
  };
  try {
    if (
      visual.status !== "measured-candidate" ||
      !visual.contract ||
      !visual.tokens ||
      !visual.seed?.projection ||
      !visual.unqualifiedRuntimeBinding ||
      tokenBindings.status !== "source-bindings-observed"
    )
      fail("upstream-refused");
    const semantics = input.source.semantics,
      priorContract = visual.contract,
      priorBinding = visual.unqualifiedRuntimeBinding,
      rootIdentity = visual.seed.projection.root,
      variant = semantics.variant;
    if (
      !variant ||
      variant.property !== "variant" ||
      !variant.omission ||
      !same(rootIdentity.partPath, ["root"]) ||
      rootIdentity.kind !== "root" ||
      rootIdentity.partName !== "root" ||
      visual.seed.projection.nodes.filter((n) =>
        same(identity(n), identity(rootIdentity)),
      ).length !== 1 ||
      priorBinding.version !== 0 ||
      priorContract.bindings.code.runtime?.bindingRevision !==
        revisionOf(priorBinding) ||
      visual.contractRevision !== revisionOf(priorContract) ||
      priorBinding.contractRevision !==
        runtimeProjectionRevision(priorContract) ||
      priorBinding.tokenRevision !== revisionOf(visual.tokens) ||
      visual.tokenRevision !== revisionOf(visual.tokens) ||
      tokenBindings.sourceRevision !== visual.sourceRevision ||
      tokenBindings.semanticsRevision !== visual.semanticsRevision ||
      visual.semanticsRevision !== revisionOf(semantics) ||
      !same(
        visual.cases.map((c) => c.id),
        semantics.cases.map((c) => c.id),
      ) ||
      !same(
        tokenBindings.cases.map((c) => c.id),
        semantics.cases.map((c) => c.id),
      )
    )
      fail("upstream-identity-mismatch");
    out.source = {
      revision: semantics.source.revision,
      sourceSha256: semantics.source.sourceSha256,
      sourceProgramSha256: semantics.source.programSha256,
      semanticsRevision: revisionOf(semantics),
    };
    out.context = {
      mode: "dark",
      brand: "default",
      tokensSha256: tokenBindings.tokensSha256,
    };
    const sourceTokens = JSON.parse(input.tokens.json) as Record<
      string,
      unknown
    >;
    if (
      Object.keys(sourceTokens).some((key) =>
        Object.hasOwn(visual.tokens!, key),
      )
    )
      fail("token-namespace-collision");
    const sourceLeaves = flattenTokens(sourceTokens),
      resolveSource = makeResolveLiteral(sourceLeaves),
      contract = structuredClone(priorContract),
      root = contract.anatomy.root;
    type Group = {
      value?: string;
      caseIds: string[];
      bindings: Map<Channel, Binding>;
    };
    const groups = new Map<string | undefined, Group>();
    for (const [index, semanticCase] of semantics.cases.entries()) {
      const projected = visual.cases[index],
        observed = tokenBindings.cases[index];
      if (semanticCase.status !== "structure-matched") {
        if (projected.status !== "refused" || observed.status !== "refused")
          fail("refused-case-promoted");
        continue;
      }
      if (
        projected.status !== "projected" ||
        !projected.projection ||
        observed.status !== "observed"
      )
        fail("eligible-case-unavailable");
      const value =
        semanticCase.variant?.kind === "omitted"
          ? undefined
          : semanticCase.variant?.kind === "value"
            ? semanticCase.variant.value
            : fail("case-variant-unavailable");
      if (value !== undefined && !variant.values.includes(value))
        fail("case-variant-unknown");
      const element = projected.projection.elements.filter((e) =>
        same(identity(e), identity(rootIdentity)),
      );
      if (
        element.length !== 1 ||
        element[0].visualPath !== "" ||
        observed.sourceTreeSha256 !== projected.projection.sourceTreeSha256 ||
        observed.projectionTreeSha256 !==
          projected.projection.projectionTreeSha256 ||
        observed.topologyObservationSha256 !==
          projected.projection.topologyObservationSha256
      )
        fail("case-root-identity-mismatch");
      const group = groups.get(value) ?? {
        value,
        caseIds: [],
        bindings: new Map<Channel, Binding>(),
      };
      group.caseIds.push(semanticCase.id);
      for (const channel of CHANNELS) {
        if (
          !visual.channels.some(
            (c) =>
              c.part === "root" &&
              c.channel === channel &&
              c.status === "candidate",
          )
        )
          fail("channel-not-observed");
        const matches = observed.outcomes.filter(
          (o) =>
            o.channel === channel && same(identity(o), identity(rootIdentity)),
        );
        const outcome = matches[0],
          binding = outcome?.binding;
        if (
          matches.length !== 1 ||
          outcome.status !== "bound" ||
          !binding ||
          outcome.visualPath !== "" ||
          outcome.domPath !== element[0].domPath
        )
          fail("root-binding-unqualified");
        const leaf = sourceLeaves.get(binding.tokenPath),
          expectedType = channel === "font-weight" ? "number" : "color";
        if (
          !leaf ||
          leaf.type !== expectedType ||
          binding.variableName !== `--al-${binding.tokenPath}` ||
          String(resolveSource(binding.tokenPath)).trim() !== binding.tokenValue
        )
          fail("source-token-identity-mismatch");
        const previous = group.bindings.get(channel);
        if (previous && previous.tokenPath !== binding.tokenPath)
          fail("same-variant-token-name-conflict");
        group.bindings.set(channel, binding);
      }
      groups.set(value, group);
    }
    if (
      !groups.has(undefined) ||
      groups.size !== variant.values.length + 1 ||
      variant.values.some((v) => !groups.has(v))
    )
      fail("appearance-coverage-incomplete");
    const base = groups.get(undefined)!;
    const entries = tokensByPropEntries(root),
      entriesForVariant = entries.filter((e) => e.prop === "variant");
    if (
      entriesForVariant.length > 1 ||
      entries.some(
        (e) =>
          e.prop !== "variant" &&
          Object.values(e.map).some((row) =>
            CHANNELS.some((c) => Object.hasOwn(row, c)),
          ),
      )
    )
      fail("competing-token-projection");
    let perVariant = entriesForVariant[0];
    const write = (
      group: Group,
      channel: Channel,
      storage: "tokens" | "tokensByProp",
    ) => {
      const binding = group.bindings.get(channel)!,
        ref = `{${binding.tokenPath}}`;
      const previousEffectiveRef = resolveTokens(
        priorContract.anatomy.root,
        group.value === undefined ? {} : { variant: group.value },
      )[channel];
      if (!previousEffectiveRef) fail("prior-reference-unavailable");
      if (storage === "tokens") root.tokens![channel] = ref;
      else {
        if (!perVariant) {
          perVariant = { prop: "variant", map: {} };
          root.tokensByProp = [...entries, perVariant];
        }
        (perVariant.map[group.value!] ??= {})[channel] = ref;
      }
      out.rewrites.push({
        ...identity(rootIdentity),
        partPath: ["root"],
        channel,
        address:
          storage === "tokens"
            ? { storage }
            : { storage, prop: "variant", value: group.value! },
        previousEffectiveRef,
        ref,
        tokenPath: binding.tokenPath,
        caseIds: [...group.caseIds],
      });
    };
    for (const channel of CHANNELS) write(base, channel, "tokens");
    for (const value of variant.values) {
      const group = groups.get(value)!;
      for (const channel of CHANNELS) {
        // Identity differences need overrides even if fusion collapsed equal
        // values into one base token. Existing overrides are rewritten in place.
        if (
          group.bindings.get(channel)!.tokenPath !==
            base.bindings.get(channel)!.tokenPath ||
          Object.hasOwn(perVariant?.map[value] ?? {}, channel)
        )
          write(group, channel, "tokensByProp");
      }
    }
    for (const rewrite of out.rewrites.filter(
      (r) => r.address.storage === "tokens",
    ))
      rewrite.caseIds = [...groups.values()]
        .filter(
          (g) =>
            g.value === undefined ||
            !Object.hasOwn(perVariant?.map[g.value] ?? {}, rewrite.channel),
        )
        .flatMap((g) => g.caseIds);
    const tokens = {
        ...structuredClone(sourceTokens),
        ...structuredClone(visual.tokens),
      },
      previousLeaves = flattenTokens(visual.tokens),
      nextLeaves = flattenTokens(tokens),
      previousValue = makeResolveLiteral(previousLeaves),
      nextValue = makeResolveLiteral(nextLeaves);
    const parts = walkAnatomy(priorContract),
      nextParts = walkAnatomy(contract);
    // Every previous channel on every part and appearance stays value-equivalent.
    // This also refuses a rounded alpha projection and every dangling ref.
    for (const group of groups.values()) {
      const props: Record<string, string> =
        group.value === undefined ? {} : { variant: group.value };
      for (const [index, part] of parts.entries()) {
        if (!same(part.path, nextParts[index]?.path)) fail("anatomy-changed");
        const before = resolveTokens(part.part, props),
          after = resolveTokens(nextParts[index].part, props);
        if (!same(Object.keys(before).sort(), Object.keys(after).sort()))
          fail("channel-inventory-changed");
        for (const channel of Object.keys(before)) {
          const a = pathOf(before[channel]),
            b = pathOf(after[channel]),
            type = previousLeaves.get(a)?.type;
          if (
            !type ||
            nextLeaves.get(b)?.type !== type ||
            !equivalent(previousValue(a), nextValue(b), type)
          )
            fail("resolved-value-changed");
        }
      }
    }
    const tokenRevision = revisionOf(tokens),
      contractProjectionRevision = runtimeProjectionRevision(contract),
      binding = {
        ...priorBinding,
        contractRevision: contractProjectionRevision,
        tokenRevision,
      },
      runtimeBindingRevision = revisionOf(binding);
    contract.bindings.code.runtime!.bindingRevision = runtimeBindingRevision;
    ContractSchema.parse(contract);
    const errors: string[] = [];
    validateContract(
      contract,
      new Map([[contract.id, contract]]),
      errors,
      new Map(),
    );
    if (errors.length) fail("canonical-validation-failed");
    Object.assign(out, {
      status: "source-token-projected-candidate",
      contract,
      contractRevision: revisionOf(contract),
      contractProjectionRevision,
      tokens,
      tokenRevision,
      unqualifiedRuntimeBinding: binding,
      runtimeBindingRevision,
      sourceTokenPaths: [
        ...new Set(out.rewrites.map((r) => r.tokenPath)),
      ].sort(),
    });
  } catch (error) {
    out.rewrites = [];
    out.sourceTokenPaths = [];
    out.problems.push(
      error instanceof Error &&
        /^source-token-projection-[a-z-]+$/.test(error.message)
        ? error.message
        : "source-token-projection-input-invalid",
    );
  }
  return structuredClone(out);
}
