/** A host-owned inspection context for an UNACCEPTED retained-source candidate.
 * This does not upgrade its version-zero runtime binding, authorize design
 * adoption, or qualify arbitrary source behavior. The normal emitters continue
 * to refuse it. Only the existing Figma compiler's bounded inspection path may
 * consume this context; the host must authenticate all evidence before storing
 * it here. Canvas metadata and HTTP request bodies are never such a registry. */
import {
  ContractSchema,
  walkAnatomy,
  type Contract,
} from "../scripts/contract-schema.js";
import { canonicalJson, revisionOf } from "./contract-provenance.js";
import { runtimeProjectionRevision } from "./runtime-emission.js";
import type {
  RuntimeArtifactForEmission,
  RuntimeScopeValue,
} from "./runtime-emission.js";
import type { TokenTreeInput } from "./tokens.js";

export interface NativeSourcePartIdentity {
  partPath: string[];
  templateId: string;
  sourceNodeId: string;
  sourceSpan: { start: number; end: number; line: number; column: number };
  kind: "root" | "wrapper" | "slot";
  tag: string;
  sourceSlotName?: string;
  contractSlotName?: string;
  /** Whole wrapper state for an empty main. This is not a public boolean prop
   * and never a claim that Figma evaluates a source predicate automatically. */
  emptyMainVisible?: false;
}

export interface NativeSourceUnqualifiedBinding {
  version: 0;
  kind: "unqualified-source-visual-seed";
  artifactRevision: string;
  interfaceRevision: string;
  projectionRevision: string;
  seedRevision: string;
  contractRevision: string;
  tokenRevision: string;
  properties: Array<{ contractProp: string; sourceProperty: string }>;
  slots: Array<{ contractSlot: string; sourceSlot: string }>;
}

export interface NativeSourceCandidateProjection {
  version: 1;
  purpose: "source-candidate-inspection";
  acceptedContract: null;
  nativeQualification: "unqualified";
  contractId: string;
  /** Entire Contract, including its retained-runtime descriptor and anchors. */
  contractRevision: string;
  binding: NativeSourceUnqualifiedBinding;
  source: {
    revision: string;
    modulePath: string;
    className: string;
    sourceSha256: string;
    programSha256: string;
  };
  evidence: {
    reportRevision: string;
    semanticsRevision: string;
    visualRevision: string;
    tokenProjectionRevision: string;
    wrapperProjectionRevision: string;
  };
  context: { mode: "light" | "dark"; brand: "default" };
  parts: NativeSourcePartIdentity[];
  /** Every original case remains in the denominator. Only observed cases may
   * be rendered as comparison instances; refusal is not omission. */
  cases: Array<{
    id: string;
    status: "observed" | "refused";
    problems: string[];
    properties?: Record<string, RuntimeScopeValue>;
    projectionRevision?: string;
    samplesRevision?: string;
    sourceTreeSha256?: string;
    topologyObservationSha256?: string;
    wrappers?: Array<{ partPath: string[]; visible: boolean }>;
  }>;
}

export interface NativeSourceProjectionContext {
  artifacts: ReadonlyMap<string, RuntimeArtifactForEmission>;
  /** Keyed by the unchanged version-zero binding revision. The separately
   * pinned projection revision catches accidental mutation after preparation. */
  candidates: ReadonlyMap<
    string,
    {
      projection: NativeSourceCandidateProjection;
      revision: string;
    }
  >;
}

export interface ResolvedNativeSourceProjection {
  projection: NativeSourceCandidateProjection;
  revision: string;
  /** Keys are exact anatomy paths, not display names. */
  parts: ReadonlyMap<string, NativeSourcePartIdentity>;
}

const REV = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const key = (path: string[]) => canonicalJson(path);
function refuse(code: string): never {
  throw Error(`NATIVE_SOURCE_CANDIDATE_${code}`);
}
function isRevision(value: unknown): value is string {
  return typeof value === "string" && REV.test(value);
}
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const exactKeys = (value: unknown, keys: string[]) =>
  plain(value) && same(Object.keys(value).sort(), [...keys].sort());
const pathSafe = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[A-Za-z0-9_./-]+$/.test(value) &&
  !value.startsWith("/") &&
  value.split("/").every((p) => p !== "" && p !== "." && p !== "..");

/** The compiler's strict opt-in fence. Does not consult disk/network or accept
 * a `trusted: true` flag. The caller owns registry origin authentication. */
export function resolveNativeSourceProjection(
  contract: Contract,
  input: { tokens: TokenTreeInput; mode: string; brand: string },
  context: NativeSourceProjectionContext,
): ResolvedNativeSourceProjection {
  if (!ContractSchema.safeParse(contract).success) refuse("CONTRACT_INVALID");
  const reference = contract.bindings.code.runtime;
  if (!reference) refuse("RUNTIME_REFERENCE_REQUIRED");
  const entry = context?.candidates?.get(reference.bindingRevision);
  const artifact = context?.artifacts?.get(reference.artifactRevision);
  if (!entry || !artifact) refuse("TRUSTED_CONTEXT_MISSING");
  const p = entry.projection;
  if (
    !p ||
    !isRevision(entry.revision) ||
    revisionOf(p) !== entry.revision ||
    p.version !== 1 ||
    p.purpose !== "source-candidate-inspection" ||
    p.acceptedContract !== null ||
    p.nativeQualification !== "unqualified"
  )
    refuse("PROJECTION_IDENTITY_INVALID");
  if (
    p.contractId !== contract.id ||
    p.contractRevision !== revisionOf(contract)
  )
    refuse("CONTRACT_CHANGED");
  const b = p.binding;
  if (
    !b ||
    !exactKeys(b, [
      "version",
      "kind",
      "artifactRevision",
      "interfaceRevision",
      "projectionRevision",
      "seedRevision",
      "contractRevision",
      "tokenRevision",
      "properties",
      "slots",
    ]) ||
    b.version !== 0 ||
    b.kind !== "unqualified-source-visual-seed" ||
    revisionOf(b) !== reference.bindingRevision ||
    b.artifactRevision !== reference.artifactRevision ||
    b.interfaceRevision !== reference.interfaceRevision ||
    b.contractRevision !== runtimeProjectionRevision(contract) ||
    ![
      b.artifactRevision,
      b.interfaceRevision,
      b.projectionRevision,
      b.seedRevision,
      b.contractRevision,
      b.tokenRevision,
    ].every(isRevision) ||
    artifact.artifactRevision !== reference.artifactRevision ||
    artifact.interfaceRevision !== reference.interfaceRevision ||
    revisionOf(artifact.interface) !== reference.interfaceRevision
  )
    refuse("RUNTIME_IDENTITY_INVALID");
  if (
    !p.source ||
    !/^[a-f0-9]{40}$/.test(p.source.revision) ||
    !SHA.test(p.source.sourceSha256) ||
    !SHA.test(p.source.programSha256) ||
    !pathSafe(p.source.modulePath) ||
    !/^[A-Za-z_$][\w$]*$/.test(p.source.className) ||
    !exactKeys(p.evidence, [
      "reportRevision",
      "semanticsRevision",
      "visualRevision",
      "tokenProjectionRevision",
      "wrapperProjectionRevision",
    ]) ||
    !Object.values(p.evidence).every(isRevision)
  )
    refuse("EVIDENCE_IDENTITY_INVALID");
  if (
    !p.context ||
    !["light", "dark"].includes(p.context.mode) ||
    p.context.brand !== "default" ||
    p.context.mode !== input.mode ||
    p.context.brand !== input.brand
  )
    refuse("TOKEN_CONTEXT_CHANGED");
  // The source report records a resolved DTCG tree for precisely one context.
  // No caller overrides may alter it through another engine layer.
  if (
    !exactKeys(input.tokens, [
      "primitives",
      "semantic",
      "light",
      "dark",
      "brands",
    ]) ||
    revisionOf(input.tokens.primitives) !== b.tokenRevision ||
    !same(input.tokens.semantic, {}) ||
    !same(input.tokens.light, {}) ||
    !same(input.tokens.dark, {}) ||
    !same(input.tokens.brands, { default: {} })
  )
    refuse("TOKENS_CHANGED");
  if (
    contract.status !== "draft" ||
    Object.keys(contract.anatomy).length !== 1 ||
    !contract.anatomy.root ||
    contract.states.length ||
    contract.bindings.figma.statePreviews ||
    contract.events?.length
  )
    refuse("STRUCTURE_UNSUPPORTED");
  const anatomy = walkAnatomy(contract);
  const paths = new Set(anatomy.map((n) => key(n.path)));
  const parts = new Map<string, NativeSourcePartIdentity>();
  const sourceIds = new Set<string>();
  if (!Array.isArray(p.parts) || p.parts.length !== anatomy.length)
    refuse("PART_COVERAGE_INVALID");
  for (const n of p.parts) {
    if (
      !n ||
      !Array.isArray(n.partPath) ||
      !n.partPath.length ||
      n.partPath.some((s) => typeof s !== "string" || !s) ||
      !paths.has(key(n.partPath)) ||
      parts.has(key(n.partPath)) ||
      !/^template:\d+:\d+$/.test(n.templateId) ||
      !/^element:\d+$/.test(n.sourceNodeId) ||
      !n.sourceSpan ||
      ![
        n.sourceSpan.start,
        n.sourceSpan.end,
        n.sourceSpan.line,
        n.sourceSpan.column,
      ].every(Number.isSafeInteger) ||
      n.sourceSpan.start < 0 ||
      n.sourceSpan.end <= n.sourceSpan.start ||
      n.sourceSpan.line < 1 ||
      n.sourceSpan.column < 1 ||
      !/^[a-z][a-z0-9-]*$/.test(n.tag) ||
      !["root", "wrapper", "slot"].includes(n.kind)
    )
      refuse("PART_IDENTITY_INVALID");
    const id = canonicalJson([n.templateId, n.sourceNodeId]);
    if (sourceIds.has(id)) refuse("PART_IDENTITY_INVALID");
    sourceIds.add(id);
    const part = anatomy.find((a) => key(a.path) === key(n.partPath))!.part;
    if (
      part.component ||
      part.repeat ||
      part.text !== undefined ||
      part.content ||
      part.icon ||
      part.shape ||
      part.visibleWhen ||
      part.declared?.display === "contents"
    )
      refuse("PART_LOWERING_UNSUPPORTED");
    if (
      n.kind === "root"
        ? !same(n.partPath, ["root"]) || n.tag !== contract.semantics?.element
        : same(n.partPath, ["root"])
    )
      refuse("PART_IDENTITY_INVALID");
    if (n.kind === "slot") {
      if (
        n.tag !== "slot" ||
        !part.slot ||
        part.parts ||
        part.optional ||
        part.slot.defaultContent?.length ||
        part.slot.name !== n.contractSlotName ||
        typeof n.sourceSlotName !== "string" ||
        n.emptyMainVisible !== undefined
      )
        refuse("SLOT_IDENTITY_INVALID");
    } else if (
      part.slot ||
      n.sourceSlotName !== undefined ||
      n.contractSlotName !== undefined ||
      (n.kind === "wrapper" && n.tag !== part.element)
    )
      refuse("PART_IDENTITY_INVALID");
    if (
      n.emptyMainVisible !== undefined &&
      (n.kind !== "wrapper" || n.emptyMainVisible !== false)
    )
      refuse("WRAPPER_STATE_INVALID");
    parts.set(key(n.partPath), structuredClone(n));
  }
  // Native inspection supports finite enum and boolean axes. Keep all
  // omitted values explicit; no extra code default or public Show-slot prop.
  if (
    !contract.props.length ||
    !Array.isArray(b.properties) ||
    b.properties.length !== contract.props.length ||
    new Set(b.properties.map((x) => x.contractProp)).size !==
      b.properties.length
  )
    refuse("PROPERTY_MAPPING_INVALID");
  for (const prop of contract.props) {
    const mapping = b.properties.find((m) => m.contractProp === prop.name);
    if (
      !mapping ||
      mapping.sourceProperty !== prop.bindings.code.prop ||
      !artifact.interface.writableProperties.includes(mapping.sourceProperty) ||
      !(prop.type === "boolean" || (typeof prop.type === "object" && "enum" in prop.type && prop.type.enum.length > 0)) ||
      prop.default !== undefined ||
      prop.bindings.figma.kind !== "VARIANT" ||
      !prop.bindings.figma.unsetValue
    )
      refuse("PROPERTY_MAPPING_INVALID");
  }
  const slots = p.parts.filter((n) => n.kind === "slot");
  if (
    !Array.isArray(b.slots) ||
    b.slots.length !== slots.length ||
    new Set(b.slots.map((s) => s.contractSlot)).size !== b.slots.length ||
    new Set(b.slots.map((s) => s.sourceSlot)).size !== b.slots.length ||
    slots.some(
      (s) =>
        !b.slots.some(
          (m) =>
            m.contractSlot === s.contractSlotName &&
            m.sourceSlot === s.sourceSlotName,
        ) || !artifact.interface.slots.some((a) => a.name === s.sourceSlotName),
    )
  )
    refuse("SLOT_MAPPING_INVALID");
  const wrappers = p.parts.filter((n) => n.emptyMainVisible === false);
  if (
    !Array.isArray(p.cases) ||
    !p.cases.length ||
    new Set(p.cases.map((c) => c.id)).size !== p.cases.length
  )
    refuse("CASE_COVERAGE_INVALID");
  const observed = p.cases.filter((c) => c.status === "observed");
  for (const c of p.cases) {
    if (
      typeof c.id !== "string" ||
      !c.id ||
      !Array.isArray(c.problems) ||
      c.problems.some((s) => typeof s !== "string" || !s)
    )
      refuse("CASE_IDENTITY_INVALID");
    if (c.status === "refused") {
      if (
        !c.problems.length ||
        [
          c.properties,
          c.projectionRevision,
          c.samplesRevision,
          c.sourceTreeSha256,
          c.topologyObservationSha256,
          c.wrappers,
        ].some((v) => v !== undefined)
      )
        refuse("REFUSED_CASE_INVALID");
      continue;
    }
    if (
      c.status !== "observed" ||
      c.problems.length ||
      !isRevision(c.projectionRevision) ||
      !isRevision(c.samplesRevision) ||
      typeof c.sourceTreeSha256 !== "string" ||
      !SHA.test(c.sourceTreeSha256) ||
      typeof c.topologyObservationSha256 !== "string" ||
      !SHA.test(c.topologyObservationSha256) ||
      !exactKeys(
        c.properties,
        contract.props.map((prop) => prop.name),
      )
    )
      refuse("CASE_IDENTITY_INVALID");
    for (const prop of contract.props) {
      const value = c.properties![prop.name];
      if (
        !value ||
        !(value.kind === "omitted"
          ? exactKeys(value, ["kind"])
          : value.kind === "value" &&
            exactKeys(value, ["kind", "value"]) &&
            (prop.type === "boolean" ? typeof value.value === "boolean" :
              typeof value.value === "string" && typeof prop.type === "object" &&
              "enum" in prop.type && prop.type.enum.includes(value.value)))
      )
        refuse("CASE_PROPERTY_INVALID");
    }
    if (
      !Array.isArray(c.wrappers) ||
      c.wrappers.length !== wrappers.length ||
      new Set(c.wrappers.map((w) => key(w.partPath))).size !==
        wrappers.length ||
      c.wrappers.some(
        (w) =>
          typeof w.visible !== "boolean" ||
          !wrappers.some((n) => same(n.partPath, w.partPath)),
      )
    )
      refuse("CASE_WRAPPERS_INVALID");
  }
  // Every emitted variant combination must be represented by an original.
  let combinations: Record<string, RuntimeScopeValue>[] = [{}];
  for (const prop of contract.props) {
    const type = prop.type;
    if (type !== "boolean" && (typeof type !== "object" || !("enum" in type)))
      refuse("PROPERTY_MAPPING_INVALID");
    const domain = type === "boolean" ? [false, true] : (type as { enum: string[] }).enum;
    combinations = combinations.flatMap((row) => [
      { ...row, [prop.name]: { kind: "omitted" as const } },
      ...domain.map((value) => ({
        ...row,
        [prop.name]: { kind: "value" as const, value },
      })),
    ]);
    if (combinations.length > 128) refuse("CASE_COVERAGE_INVALID");
  }
  if (
    combinations.some((row) => !observed.some((c) => same(c.properties, row)))
  )
    refuse("VARIANT_COVERAGE_INCOMPLETE");
  return { projection: structuredClone(p), revision: entry.revision, parts };
}
