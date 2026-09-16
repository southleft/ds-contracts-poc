import ts from "typescript";
import type { Prop } from "../scripts/contract-schema.js";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import type { RuntimeArtifactForEmission } from "../core/runtime-emission.js";
import type {
  CemDeclarationFacts,
  CemProblem,
} from "../extract/adapters/cem.js";
import {
  readLitTemplateBindings,
  type LitNode,
  type LitSpan,
  type LitTemplateInput,
} from "../extract/adapters/lit-template.js";
import {
  matchLitRender,
  type LitRenderMatch,
  type LitRenderNode,
} from "./lit-render-match.js";
import type { BoundTopologyResult } from "./bound-topology.js";
import type { SemanticIntake } from "./semantics.js";

export type CandidateVariantState =
  { kind: "omitted" } | { kind: "value"; value: string };
export interface ButtonCandidateSourceCase {
  id: string;
  story?: string;
  /** Host's existing source-readiness result, not authority or a signature.
   * The pure reader additionally rechecks source/semantic/topology joins. */
  sourceEligible: boolean;
  problems: string[];
  semantics?: SemanticIntake;
  boundTopology?: BoundTopologyResult;
}
export interface ButtonCandidateSemanticInput {
  source: LitTemplateInput;
  sourceRevision: string;
  sourceProgramSha256: string;
  declaration: CemDeclarationFacts;
  declarationProblems: CemProblem[];
  /** Previously readVerifiedRuntimeArtifact data, adapted for emission. The
   * host authenticates artifact bytes; this function never loads or executes. */
  runtime: RuntimeArtifactForEmission;
  /** Fixed by the source work order. Missing entries become refused rows. */
  expectedCaseIds: string[];
  cases: ButtonCandidateSourceCase[];
}
interface SourceNodeIdentity {
  templateId: string;
  sourceNodeId: string;
  sourceSpan: LitSpan;
  parentSourceNodeId?: string;
}
export interface CandidateSlotSemantics {
  sourceName: string;
  contractName: string;
  sourceNodes: SourceNodeIdentity[];
  observations: Array<{
    caseId: string;
    sourceNodeId: string;
    domPath: string;
    semanticPath: string;
    distribution: "assigned" | "fallback";
    assigned: string[];
    fallback: string[];
    visualPaths: string[];
  }>;
}
export interface CandidateSemanticCase {
  id: string;
  story?: string;
  status: "structure-matched" | "refused";
  problems: string[];
  variant?: CandidateVariantState;
  branch?: { templateId: string; sourceNodeId: string; tag: string };
  sourcePngSha256?: string;
  sourceTreeSha256?: string;
  semanticObservationSha256?: string;
  topologyObservationSha256?: string;
  nodes: LitRenderNode[];
  limitations: string[];
}
export interface ButtonCandidateSemantics {
  version: 1;
  status: "semantic-candidate" | "refused";
  acceptedContract: null;
  source: {
    revision: string;
    programSha256: string;
    sourceSha256: string;
    className: string;
    tagName: string;
  };
  runtime?: {
    artifactRevision: string;
    interfaceRevision: string;
    properties: Array<{ name: string; typeText: string; writable: boolean }>;
  };
  projectedProps: Prop[];
  variant?: {
    property: string;
    values: string[];
    omission: true;
    sourceSpan: LitSpan;
  };
  slots: CandidateSlotSemantics[];
  runtimeOnlyBindings: Array<
    SourceNodeIdentity & {
      sourceProperty: string;
      channel: "attribute" | "boolean-attribute" | "property" | "event";
      targetAttribute: string;
      tag: string;
      /** The authored attribute span belongs to a matched DOM node. No
       * property value, directive implementation or dependency was tested. */
      structurallyMatchedCaseIds: string[];
      dependencyStatus: "unproven";
    }
  >;
  cases: CandidateSemanticCase[];
  coverage: {
    cases: { expected: number; matched: number; refused: number };
    variants: {
      states: Array<{ state: CandidateVariantState; caseIds: string[] }>;
      missing: CandidateVariantState[];
    };
    branches: Array<{
      templateId: string;
      sourceNodeId: string;
      tag: string;
      caseIds: string[];
    }>;
  };
  findings: Array<{ code: string; caseId?: string }>;
  limitations: string[];
}
const hash = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const unique = (names: string[]) => new Set(names).size === names.length;
const ordered = (names: string[]) => [...names].sort();
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
function typeKey(node: ts.TypeNode): string {
  if (ts.isParenthesizedTypeNode(node)) return typeKey(node.type);
  if (ts.isUnionTypeNode(node))
    return canonicalJson(node.types.map(typeKey).sort());
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal))
    return JSON.stringify(node.literal.text);
  return node.getText().replace(/\s/g, "");
}
function declaredTypeKey(text: string): string {
  const file = ts.createSourceFile(
    "declaration.ts",
    `type Field = ${text};`,
    ts.ScriptTarget.Latest,
    true,
  );
  const item = file.statements[0];
  if (!item || !ts.isTypeAliasDeclaration(item) || file.statements.length !== 1)
    return "invalid-type";
  return typeKey(item.type);
}
function literalDomain(node: ts.TypeNode): string[] | undefined {
  const types = ts.isUnionTypeNode(node) ? node.types : [node];
  if (
    !types.every(
      (type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal),
    )
  )
    return undefined;
  const values = types.map(
    (type) => ((type as ts.LiteralTypeNode).literal as ts.StringLiteral).text,
  );
  return unique(values) ? values : undefined;
}

/** Pure semantic projection for the source-backed Button work order. It
 * constructs no styled anatomy, code defaults, sample nodes, or accepted
 * Contract. Exact source identity is kept separate from host authentication. */
export function deriveButtonCandidateSemantics(
  input: ButtonCandidateSemanticInput,
): ButtonCandidateSemantics {
  // Preserve the host's fixed work-order manifest even when source evidence
  // is malformed before parsing. Missing identities remain empty, not guessed.
  const expectedCaseIds = Array.isArray(input?.expectedCaseIds)
    ? input.expectedCaseIds
    : [];
  const inputCases = Array.isArray(input?.cases) ? input.cases : [];
  const result: ButtonCandidateSemantics = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    source: {
      revision: text(input?.sourceRevision),
      programSha256: text(input?.sourceProgramSha256),
      sourceSha256: text(input?.source?.sourceSha256),
      className: text(input?.source?.className),
      tagName: text(input?.declaration?.tagName),
    },
    projectedProps: [],
    slots: [],
    runtimeOnlyBindings: [],
    cases: [],
    coverage: {
      cases: {
        expected: expectedCaseIds.length,
        matched: 0,
        refused: expectedCaseIds.length,
      },
      variants: { states: [], missing: [] },
      branches: [],
    },
    findings: [],
    limitations: [
      "This is a semantic candidate, not an accepted Contract, source authentication, canvas qualification, grade or signoff.",
      "The trusted host must validate original readiness, raw source/tree/PNG records, source-program bytes and runtime artifact files. This reader verifies overlapping identities, not authenticity.",
      "All original typed API and behavior remain in the immutable runtime. Only the defaultless variant is projected; form/lifecycle/ref behavior is not reconstructed or newly qualified.",
      "Observed properties are post-render observations, not authored input defaults. Equal accessible label and consumer slot text never establish a content binding.",
      "Runtime-only binding cases identify source syntax on structurally matched nodes, not observed property-to-attribute dependencies. Dynamic values, directives and handlers remain unproven here.",
      "slotNotEmpty helpers, conditional named-slot wrappers and arbitrary content are not qualified by structural matching; optional SLOT visibility is not an inferred equivalent.",
      "Branch and variant coverage are finite observed cases, not the full API cross-product. Missing/refused cases stay visible.",
    ],
  };
  function fail(code: string): never {
    throw Error(code);
  }
  try {
    if (
      !object(input) ||
      !object(input.source) ||
      !object(input.declaration) ||
      !Array.isArray(input.expectedCaseIds) ||
      !Array.isArray(input.cases) ||
      !Array.isArray(input.declarationProblems) ||
      inputCases.some((row) => !object(row) || typeof row.id !== "string")
    )
      fail("candidate-semantic-input-invalid");
    if (
      !/^[a-f0-9]{40}$/.test(input.sourceRevision) ||
      !hash.test(input.sourceProgramSha256) ||
      input.declarationProblems.length
    )
      fail("candidate-source-identity-invalid");
    const read = readLitTemplateBindings(input.source);
    if (
      read.status === "refused" ||
      input.source.className !== input.declaration.className ||
      input.source.modulePath !== input.declaration.modulePath
    )
      fail("candidate-source-declaration-mismatch");
    if (
      read.templates.some(
        (template) =>
          !template.complete ||
          template.role === "unresolved" ||
          template.guardAlternatives ||
          template.unresolvedAncestorTemplateIds?.length,
      )
    )
      fail("candidate-source-structure-unresolved");
    if (
      !unique(input.declaration.properties.map((p) => p.name)) ||
      !unique(input.declaration.slots.map((p) => p.name))
    )
      fail("candidate-declaration-ambiguous");
    const runtime = input.runtime,
      api = runtime.interface;
    if (
      !/^sha256:[a-f0-9]{64}$/.test(runtime.artifactRevision) ||
      runtime.interfaceRevision !== revisionOf(api) ||
      !same(api.peerRuntime, {
        name: "react",
        major: 19,
        mounting: "direct-custom-element",
      }) ||
      !unique(api.properties.map((p) => p.name)) ||
      !unique(api.writableProperties) ||
      api.properties.some(
        (p) =>
          typeof p.typeText !== "string" || typeof p.writable !== "boolean",
      ) ||
      !same(
        ordered(api.writableProperties),
        ordered(api.properties.filter((p) => p.writable).map((p) => p.name)),
      )
    )
      fail("candidate-runtime-interface-invalid");
    const file = ts.createSourceFile(
      "source.ts",
      input.source.source,
      ts.ScriptTarget.Latest,
      true,
    );
    const classes = file.statements
      .filter(ts.isClassDeclaration)
      .filter((item) => item.name?.text === input.source.className);
    if (classes.length !== 1) fail("candidate-source-class-ambiguous");
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
    for (const field of fields) {
      if (!ts.isIdentifier(field.name) || !field.type) continue;
      const manifest = input.declaration.properties.find(
        (p) => p.name === field.name.getText(file),
      );
      const retained = api.properties.find(
        (p) => p.name === field.name.getText(file),
      );
      if (!manifest || !retained) fail("candidate-source-api-missing");
      // Opaque ref types stay opaque (Array<Node> vs Node[] is not guessed).
      // Source scalar and literal-union types must agree across all three.
      if (
        literalDomain(field.type) ||
        [
          ts.SyntaxKind.StringKeyword,
          ts.SyntaxKind.BooleanKeyword,
          ts.SyntaxKind.NumberKeyword,
        ].includes(field.type.kind) ||
        ts.isUnionTypeNode(field.type)
      ) {
        if (
          !manifest.typeText ||
          declaredTypeKey(manifest.typeText) !== typeKey(field.type) ||
          declaredTypeKey(retained.typeText) !== typeKey(field.type)
        )
          fail("candidate-source-api-type-mismatch");
        if (
          !retained.writable ||
          !api.writableProperties.includes(manifest.name)
        )
          fail("candidate-source-api-writability-mismatch");
      }
    }
    const variantFields = fields.filter(
      (field) => ts.isIdentifier(field.name) && field.name.text === "variant",
    );
    const variantDeclaration = input.declaration.properties.find(
      (p) => p.name === "variant",
    );
    if (
      variantFields.length !== 1 ||
      !variantFields[0].type ||
      variantFields[0].initializer ||
      variantDeclaration?.default !== undefined
    )
      fail("candidate-variant-default-or-domain-unqualified");
    const values = literalDomain(variantFields[0].type);
    if (!values?.length || values.includes("(unset)"))
      fail("candidate-variant-domain-unqualified");
    const member = read.members.find(
      (member) => member.name === "variant" && member.kind === "field",
    );
    if (!member) fail("candidate-variant-source-span-missing");
    result.variant = {
      property: "variant",
      values,
      omission: true,
      sourceSpan: member.span,
    };
    result.coverage.variants.states = [
      { state: { kind: "omitted" }, caseIds: [] },
      ...values.map((value) => ({
        state: { kind: "value" as const, value },
        caseIds: [] as string[],
      })),
    ];
    const slotSources = new Map<string, SourceNodeIdentity[]>();
    const visit = (
      nodes: LitNode[],
      templateId: string,
      parentSourceNodeId?: string,
    ): void => {
      for (const node of nodes)
        if (node.kind === "element") {
          const identity = {
            templateId,
            sourceNodeId: node.id,
            sourceSpan: node.span,
            ...(parentSourceNodeId ? { parentSourceNodeId } : {}),
          };
          if (node.slot) {
            const entries = slotSources.get(node.slot.name) ?? [];
            entries.push(identity);
            slotSources.set(node.slot.name, entries);
          }
          for (const attribute of node.attributes) {
            if (
              attribute.parts.length !== 1 ||
              attribute.parts[0].kind !== "expression"
            )
              continue;
            const expression = attribute.parts[0].expression;
            const property =
              expression.kind === "if-defined"
                ? expression.property
                : expression.kind === "property"
                  ? expression.name
                  : undefined;
            if (
              property &&
              property !== "variant" &&
              api.properties.some((p) => p.name === property)
            )
              result.runtimeOnlyBindings.push({
                ...identity,
                sourceSpan: attribute.span,
                sourceProperty: property,
                channel: attribute.channel,
                targetAttribute: attribute.name,
                tag: node.tag,
                structurallyMatchedCaseIds: [],
                dependencyStatus: "unproven",
              });
          }
          visit(node.children, templateId, node.id);
        }
    };
    for (const template of read.templates) {
      visit(template.roots, template.id);
      if (template.role === "returned") {
        const roots = template.roots.filter((node) => node.kind === "element");
        if (roots.length !== 1) fail("candidate-root-structure-unqualified");
        result.coverage.branches.push({
          templateId: template.id,
          sourceNodeId: roots[0].id,
          tag: roots[0].tag,
          caseIds: [],
        });
      }
    }
    if (
      !same(
        ordered([...slotSources.keys()]),
        ordered(input.declaration.slots.map((slot) => slot.name)),
      ) ||
      !unique(api.slots.map((slot) => slot.name)) ||
      !same(
        ordered([...slotSources.keys()]),
        ordered(api.slots.map((slot) => slot.name)),
      )
    )
      fail("candidate-slot-identity-mismatch");
    result.slots = input.declaration.slots.map((slot) => ({
      sourceName: slot.name,
      contractName: slot.name === "" ? "children" : slot.name,
      sourceNodes: slotSources.get(slot.name)!,
      observations: [],
    }));
    if (!unique(result.slots.map((slot) => slot.contractName)))
      fail("candidate-slot-code-alias-collision");
    if (
      !expectedCaseIds.length ||
      !unique(expectedCaseIds) ||
      expectedCaseIds.some((id) => typeof id !== "string" || !id) ||
      !unique(inputCases.map((row) => row.id)) ||
      inputCases.some((row) => !expectedCaseIds.includes(row.id))
    )
      fail("candidate-case-identity-ambiguous");
    for (const id of expectedCaseIds) {
      const row = inputCases.find((row) => row.id === id);
      const current: CandidateSemanticCase = {
        id,
        ...(row?.story ? { story: row.story } : {}),
        status: "refused",
        problems: [],
        nodes: [],
        limitations: [],
      };
      result.cases.push(current);
      if (!row) {
        current.problems.push("candidate-case-missing");
        continue;
      }
      const problems =
        Array.isArray(row.problems) &&
        row.problems.every((problem) => typeof problem === "string")
          ? row.problems
          : ["candidate-case-problems-invalid"];
      if (
        row.sourceEligible !== true ||
        problems.length ||
        !row.semantics ||
        !row.boundTopology
      ) {
        current.problems.push(...problems, "candidate-source-case-unavailable");
        continue;
      }
      if (!same(row.semantics.declaration, input.declaration)) {
        current.problems.push("candidate-case-declaration-mismatch");
        continue;
      }
      const observed = row.semantics.observation.properties.variant;
      const state: CandidateVariantState | undefined =
        observed?.kind === "undefined"
          ? { kind: "omitted" }
          : observed?.kind === "value" &&
              typeof observed.value === "string" &&
              values.includes(observed.value)
            ? { kind: "value", value: observed.value }
            : undefined;
      if (!state) {
        current.problems.push("candidate-case-variant-unobserved");
        continue;
      }
      let match: LitRenderMatch;
      try {
        match = matchLitRender({
          source: input.source,
          semantics: row.semantics,
          boundTopology: row.boundTopology,
        });
      } catch {
        current.problems.push("candidate-case-evidence-malformed");
        continue;
      }
      current.limitations = [...match.limitations];
      if (match.status !== "structure-matched" || match.problems.length) {
        current.problems.push(
          ...match.problems,
          "candidate-case-structure-refused",
        );
        continue;
      }
      if (match.texts?.length) {
        current.problems.push("candidate-source-owned-text-unmapped");
        continue;
      }
      const branches = result.coverage.branches.filter(
        (branch) =>
          match.selectedTemplateIds.includes(branch.templateId) &&
          match.nodes.some(
            (node) =>
              node.sourceNodeId === branch.sourceNodeId &&
              node.templateId === branch.templateId,
          ),
      );
      if (branches.length !== 1) {
        current.problems.push("candidate-case-branch-ambiguous");
        continue;
      }
      const branch = branches[0];
      current.status = "structure-matched";
      current.variant = state;
      current.branch = {
        templateId: branch.templateId,
        sourceNodeId: branch.sourceNodeId,
        tag: branch.tag,
      };
      current.nodes = structuredClone(match.nodes);
      current.sourcePngSha256 = match.sourcePngSha256;
      current.sourceTreeSha256 = match.sourceTreeSha256;
      current.semanticObservationSha256 = match.semanticObservationSha256;
      current.topologyObservationSha256 = match.topologyObservationSha256;
      branch.caseIds.push(id);
      result.coverage.variants.states
        .find((entry) => same(entry.state, state))!
        .caseIds.push(id);
      for (const slot of match.slots) {
        const target = result.slots.find(
          (item) => item.sourceName === slot.name,
        )!;
        target.observations.push({
          caseId: id,
          sourceNodeId: slot.sourceNodeId,
          domPath: slot.domPath,
          semanticPath: slot.semanticPath,
          distribution: slot.distribution,
          assigned: [...slot.assigned],
          fallback: [...slot.fallback],
          visualPaths: [...slot.visualPaths],
        });
      }
      for (const binding of result.runtimeOnlyBindings)
        if (
          match.bindings.some(
            (observed) =>
              observed.templateId === binding.templateId &&
              observed.sourceNodeId === binding.sourceNodeId &&
              observed.sourceSpan.start === binding.sourceSpan.start &&
              observed.sourceSpan.end === binding.sourceSpan.end &&
              observed.sourceProperty === binding.sourceProperty &&
              observed.attribute.channel === binding.channel &&
              observed.attribute.name === binding.targetAttribute,
          )
        )
          binding.structurallyMatchedCaseIds.push(id);
    }
    result.coverage.cases.matched = result.cases.filter(
      (row) => row.status === "structure-matched",
    ).length;
    result.coverage.cases.refused =
      result.cases.length - result.coverage.cases.matched;
    result.coverage.variants.missing = result.coverage.variants.states
      .filter((entry) => !entry.caseIds.length)
      .map((entry) => entry.state);
    for (const row of result.cases)
      for (const code of row.problems)
        result.findings.push({ code, caseId: row.id });
    for (const branch of result.coverage.branches)
      if (!branch.caseIds.length)
        result.findings.push({
          code: `candidate-branch-unobserved:${branch.tag}`,
        });
    for (const state of result.coverage.variants.missing)
      result.findings.push({
        code: `candidate-variant-unobserved:${state.kind === "omitted" ? "(omitted)" : state.value}`,
      });
    if (!result.coverage.cases.matched)
      fail("candidate-no-structural-evidence");
    result.runtime = {
      artifactRevision: runtime.artifactRevision,
      interfaceRevision: runtime.interfaceRevision,
      properties: api.properties.map(({ name, typeText, writable }) => ({
        name,
        typeText,
        writable,
      })),
    };
    result.projectedProps = [
      {
        name: "variant",
        type: { enum: [...values] },
        bindings: {
          code: { prop: "variant" },
          figma: {
            kind: "VARIANT",
            property: "Variant",
            unsetValue: "(unset)",
            values: Object.fromEntries(values.map((value) => [value, value])),
          },
        },
      },
    ];
    result.status = "semantic-candidate";
  } catch (error) {
    const code =
      error instanceof Error && /^candidate-[a-z-]+$/.test(error.message)
        ? error.message
        : "candidate-semantic-input-invalid";
    result.findings.push({ code });
    result.projectedProps = [];
    // A bad source/manifest must not erase the work-order denominator or
    // expose a partially accumulated correspondence as usable projection.
    result.cases = expectedCaseIds.map((id) => {
      const old = result.cases.find((row) => row.id === id);
      const row = inputCases.find((row) => row?.id === id);
      return {
        id,
        ...(row?.story ? { story: row.story } : {}),
        status: "refused",
        problems: [...(old?.problems ?? []), code],
        nodes: [],
        limitations: old?.limitations ?? [],
      };
    });
    result.coverage.cases.matched = 0;
    result.coverage.cases.refused = expectedCaseIds.length;
    for (const state of result.coverage.variants.states) state.caseIds = [];
    result.coverage.variants.missing = result.coverage.variants.states.map(
      (entry) => entry.state,
    );
    for (const branch of result.coverage.branches) branch.caseIds = [];
    for (const slot of result.slots) slot.observations = [];
    for (const binding of result.runtimeOnlyBindings)
      binding.structurallyMatchedCaseIds = [];
  }
  return result;
}
