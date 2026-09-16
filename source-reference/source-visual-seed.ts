import {
  ContractSchema,
  type Contract,
  type Part,
} from "../scripts/contract-schema.js";
import { canonicalJson, revisionOf } from "../core/contract-provenance.js";
import {
  readLitTemplateBindings,
  type LitAttribute,
  type LitExpression,
  type LitGuard,
  type LitNode,
  type LitSpan,
  type LitTemplate,
  type LitTemplateInput,
} from "../extract/adapters/lit-template.js";
import type { ButtonCandidateSemantics } from "./button-candidate-semantics.js";

export interface SourceVisualSeedNode {
  templateId: string;
  sourceNodeId: string;
  sourceSpan: LitSpan;
  tag: string;
  kind: "root" | "wrapper" | "slot";
  partPath: string[];
  partName: string;
  parentSourceNodeId?: string;
  sourceSlotName?: string;
  contractSlotName?: string;
  /** Authored syntax only; no guard or attribute implementation is inferred. */
  guards: LitGuard[];
  attributes: LitAttribute[];
  matchedCaseIds: string[];
}
export interface SourceVisualSeedProjection {
  version: 1;
  qualification: "unqualified-source-template";
  source: {
    revision: string;
    sourceSha256: string;
    programSha256: string;
    modulePath: string;
    className: string;
  };
  semanticsRevision: string;
  baseCaseId: string;
  root: SourceVisualSeedNode & { semanticScope: "selected-template-only" };
  nodes: SourceVisualSeedNode[];
  matchedCaseIds: string[];
  unprojectedBranches: Array<{
    templateId: string;
    sourceNodeId: string;
    sourceSpan: LitSpan;
    tag: string;
    guards: LitGuard[];
    matchedCaseIds: string[];
  }>;
}
/** Intentionally NOT RuntimeProjectionBinding. Even accidental registration
 * in a trusted map must fail the existing resolver's version check. */
export interface UnqualifiedSourceVisualBinding {
  version: 0;
  kind: "unqualified-source-visual-seed";
  artifactRevision: string;
  interfaceRevision: string;
  projectionRevision: string;
  seedRevision: string;
  properties: Array<{ contractProp: string; sourceProperty: string }>;
  slots: Array<{ contractSlot: string; sourceSlot: string }>;
}
export interface SourceVisualSeed {
  version: 1;
  status: "unaccepted-seed" | "refused";
  acceptedContract: null;
  contract?: Contract;
  projection?: SourceVisualSeedProjection;
  unqualifiedRuntimeBinding?: UnqualifiedSourceVisualBinding;
  /** A seed may exist while these projection obligations remain refused. */
  problems: string[];
}
export interface SourceVisualSeedInput {
  source: LitTemplateInput;
  semantics: ButtonCandidateSemantics;
  baseCaseId: string;
}

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const hash = /^[a-f0-9]{64}$/;
const revision = /^sha256:[a-f0-9]{64}$/;
type Element = Extract<LitNode, { kind: "element" }>;
const whitespace = (node: LitNode) =>
  node.kind === "comment" ||
  (node.kind === "text" && /^[\t\n\f\r ]*$/.test(node.value));
function fail(code: string): never {
  throw Error(`source-visual-${code}`);
}
const plainPath = (value: string) =>
  typeof value === "string" &&
  value.length > 0 &&
  !value.includes("\\") &&
  !value.includes(":") &&
  value.split("/").every((p) => p !== "" && p !== "." && p !== "..");

/** Creates no styles, samples, accepted Contract or runtime context. Input
 * semantics must already come from the authenticated host; hashes and source
 * identities are checked again here, but are not a substitute for that trust. */
export function buildSourceVisualSeed(
  input: SourceVisualSeedInput,
): SourceVisualSeed {
  const result: SourceVisualSeed = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    problems: [],
  };
  try {
    const source = input?.source,
      semantics = input?.semantics;
    if (
      !source ||
      !semantics ||
      semantics.version !== 1 ||
      semantics.status !== "semantic-candidate" ||
      semantics.acceptedContract !== null ||
      !semantics.source ||
      source.sourceSha256 !== semantics.source.sourceSha256 ||
      source.className !== semantics.source.className ||
      !hash.test(semantics.source.programSha256) ||
      !/^[a-f0-9]{40}$/.test(semantics.source.revision) ||
      !plainPath(source.modulePath)
    )
      fail("source-identity-invalid");
    const read = readLitTemplateBindings(source);
    if (read.status === "refused" || read.sourceSha256 !== source.sourceSha256)
      fail("source-template-refused");
    const runtime = semantics.runtime;
    if (
      !runtime ||
      !revision.test(runtime.artifactRevision) ||
      !revision.test(runtime.interfaceRevision)
    )
      fail("runtime-identity-missing");
    if (
      !Array.isArray(semantics.cases) ||
      new Set(semantics.cases.map((c) => c.id)).size !== semantics.cases.length
    )
      fail("case-identity-invalid");
    const base = semantics.cases.find((c) => c.id === input.baseCaseId);
    if (
      !base ||
      base.status !== "structure-matched" ||
      base.problems.length ||
      !base.branch
    )
      fail("base-case-unqualified");
    const selected = read.templates.find(
      (t) => t.id === base.branch!.templateId,
    );
    const checkTemplate = (
      template: LitTemplate | undefined,
      role: "returned" | "nested",
    ): LitTemplate => {
      if (
        !template ||
        template.role !== role ||
        !template.complete ||
        template.guardAlternatives ||
        template.unresolvedAncestorTemplateIds?.length
      )
        fail("template-hierarchy-unqualified");
      return template;
    };
    checkTemplate(selected, "returned");
    const oneRoot = (template: LitTemplate): Element => {
      const roots = template.roots.filter((n) => !whitespace(n));
      if (roots.length !== 1 || roots[0].kind !== "element")
        fail("root-hierarchy-unqualified");
      return roots[0];
    };
    const root = oneRoot(selected!);
    if (
      root.id !== base.branch.sourceNodeId ||
      root.tag !== base.branch.tag ||
      !["button", "a"].includes(root.tag)
    )
      fail("root-identity-invalid");
    if (
      !base.nodes.some(
        (n) =>
          n.templateId === selected!.id &&
          n.sourceNodeId === root.id &&
          n.tag === root.tag &&
          same(n.sourceSpan, root.span),
      )
    )
      fail("root-observation-missing");
    const props = semantics.projectedProps;
    if (
      !Array.isArray(props) ||
      props.length !== 1 ||
      !semantics.variant ||
      props[0].name !== semantics.variant.property ||
      props[0].name !== "variant" ||
      props[0].default !== undefined ||
      typeof props[0].type !== "object" ||
      !("enum" in props[0].type) ||
      !same(props[0].type.enum, semantics.variant.values) ||
      semantics.variant.omission !== true ||
      props[0].bindings.code.prop !== "variant" ||
      props[0].bindings.figma.kind !== "VARIANT" ||
      !props[0].bindings.figma.unsetValue ||
      props[0].type.enum.includes(props[0].bindings.figma.unsetValue)
    )
      fail("projected-props-unqualified");
    const matched = semantics.cases.filter(
      (c) => c.status === "structure-matched" && c.problems.length === 0,
    );
    const matchedCaseIds = matched
      .filter((c) => same(c.branch, base.branch))
      .map((c) => c.id);
    const nodes: SourceVisualSeedNode[] = [],
      seen = new Set<string>(),
      visitedTemplates = new Set<string>([selected!.id]);
    const addProblem = (code: string) => {
      if (!result.problems.includes(code)) result.problems.push(code);
    };
    const nestedId = (expression: LitExpression): string | undefined => {
      if (expression.kind === "template") return expression.templateId;
      if (
        expression.kind === "binary" &&
        expression.operator === "&&" &&
        expression.right.kind === "template"
      )
        return expression.right.templateId;
      return undefined;
    };
    const build = (
      node: Element,
      template: LitTemplate,
      partPath: string[],
      parent?: string,
    ): Part => {
      if (seen.has(node.id)) fail("duplicate-source-node");
      seen.add(node.id);
      const isRoot = partPath.length === 1;
      if (!isRoot && !["span", "div", "slot"].includes(node.tag))
        fail("element-hierarchy-unqualified");
      if (node.tag === "slot" && !node.slot) fail("slot-identity-unqualified");
      const slot = node.slot;
      if (slot && node.children.some((n) => !whitespace(n)))
        fail("slot-fallback-unqualified");
      const slotCandidates = slot
        ? semantics.slots.filter((s) => s.sourceName === slot.name)
        : [];
      // Slot identities are checked after walking hierarchy so unknown text
      // cannot be silently masked by a secondary missing-slot error.
      const sourceSlot =
        slotCandidates.length === 1 ? slotCandidates[0] : undefined;
      const part: Part = slot
        ? { slot: { name: slot.name === "" ? "children" : slot.name } }
        : isRoot
          ? {}
          : { element: node.tag };
      const mapping: SourceVisualSeedNode = {
        templateId: template.id,
        sourceNodeId: node.id,
        sourceSpan: node.span,
        tag: node.tag,
        kind: isRoot ? "root" : slot ? "slot" : "wrapper",
        partPath,
        partName: partPath.at(-1)!,
        ...(parent ? { parentSourceNodeId: parent } : {}),
        ...(slot
          ? { sourceSlotName: slot.name, contractSlotName: part.slot!.name }
          : {}),
        guards: template.guards,
        attributes: node.attributes,
        matchedCaseIds: matched
          .filter(
            (c) =>
              same(c.branch, base.branch) &&
              c.nodes.some(
                (n) =>
                  n.templateId === template.id &&
                  n.sourceNodeId === node.id &&
                  n.tag === node.tag &&
                  same(n.sourceSpan, node.span),
              ),
          )
          .map((c) => c.id),
      };
      nodes.push(mapping);
      if (!mapping.matchedCaseIds.length)
        addProblem(`source-visual-node-unobserved:${node.id}`);
      if (!same(template.guards, selected!.guards))
        addProblem("source-visual-conditional-presence-unqualified");
      if (node.attributes.length)
        addProblem("source-visual-attributes-and-behavior-unqualified");
      if (!slot) {
        const children: Record<string, Part> = {};
        const append = (child: Element, owner: LitTemplate) => {
          const name = `node${child.span.start}`;
          if (children[name]) fail("duplicate-part-name");
          children[name] = build(child, owner, [...partPath, name], node.id);
        };
        for (const child of node.children) {
          if (whitespace(child)) continue;
          if (child.kind === "text") fail("literal-text-unqualified");
          if (child.kind === "element") append(child, template);
          else if (child.kind === "expression") {
            const id = nestedId(child.expression);
            if (
              !id ||
              !same(child.nestedTemplateIds, [id]) ||
              visitedTemplates.has(id)
            )
              fail("expression-hierarchy-unqualified");
            const nested = checkTemplate(
              read.templates.find((t) => t.id === id),
              "nested",
            );
            visitedTemplates.add(id);
            append(oneRoot(nested), nested);
          } else fail("node-hierarchy-unqualified");
        }
        if (Object.keys(children).length) part.parts = children;
      }
      if (
        slot &&
        (!sourceSlot ||
          sourceSlot.contractName !== part.slot!.name ||
          !sourceSlot.sourceNodes.some(
            (n) =>
              n.templateId === template.id &&
              n.sourceNodeId === node.id &&
              same(n.sourceSpan, node.span),
          ))
      )
        fail("slot-source-identity-invalid");
      return part;
    };
    const anatomy = { root: build(root, selected!, ["root"]) };
    const slots = nodes.filter((n) => n.kind === "slot");
    if (
      new Set(slots.map((n) => n.sourceSlotName)).size !== slots.length ||
      !same(
        slots.map((n) => n.sourceSlotName).sort(),
        semantics.slots.map((s) => s.sourceName).sort(),
      )
    )
      fail("slot-denominator-unqualified");
    const projection: SourceVisualSeedProjection = {
      version: 1,
      qualification: "unqualified-source-template",
      source: {
        revision: semantics.source.revision,
        sourceSha256: source.sourceSha256,
        programSha256: semantics.source.programSha256,
        modulePath: source.modulePath,
        className: source.className,
      },
      semanticsRevision: revisionOf(semantics),
      baseCaseId: base.id,
      root: { ...nodes[0], semanticScope: "selected-template-only" },
      nodes,
      matchedCaseIds,
      unprojectedBranches: read.templates
        .filter((t) => t.role === "returned" && t.id !== selected!.id)
        .map((t) => {
          checkTemplate(t, "returned");
          const node = oneRoot(t);
          return {
            templateId: t.id,
            sourceNodeId: node.id,
            sourceSpan: node.span,
            tag: node.tag,
            guards: t.guards,
            matchedCaseIds: matched
              .filter(
                (c) =>
                  c.branch?.templateId === t.id &&
                  c.branch.sourceNodeId === node.id &&
                  c.branch.tag === node.tag,
              )
              .map((c) => c.id),
          };
        }),
    };
    let contract = ContractSchema.parse({
      id: `source.${semantics.source.tagName}`,
      name: source.className,
      version: "0.1.0",
      status: "draft",
      archetype: "button",
      description:
        "Unaccepted source-template seed. The root element describes only the selected template; runtime behavior, conditional slot presence, styling and native projection are not qualified.",
      semantics: { element: root.tag },
      props,
      states: [],
      anatomy,
      bindings: {
        figma: { anchors: { fileKey: null, componentSetKey: null } },
        code: {
          anchors: { importPath: source.modulePath, export: source.className },
        },
      },
    });
    const binding: UnqualifiedSourceVisualBinding = {
      version: 0,
      kind: "unqualified-source-visual-seed",
      artifactRevision: runtime.artifactRevision,
      interfaceRevision: runtime.interfaceRevision,
      projectionRevision: revisionOf(projection),
      seedRevision: revisionOf(contract),
      properties: props.map((p) => ({
        contractProp: p.name,
        sourceProperty: p.bindings.code.prop,
      })),
      slots: slots.map((n) => ({
        contractSlot: n.contractSlotName!,
        sourceSlot: n.sourceSlotName!,
      })),
    };
    contract.bindings.code.runtime = {
      version: 1,
      kind: "custom-element",
      artifactRevision: runtime.artifactRevision,
      interfaceRevision: runtime.interfaceRevision,
      bindingRevision: revisionOf(binding),
    };
    contract = ContractSchema.parse(contract);
    addProblem("source-visual-styling-unqualified");
    addProblem("source-visual-native-projection-unqualified");
    if (projection.unprojectedBranches.length)
      addProblem("source-visual-other-root-branches-unprojected");
    result.status = "unaccepted-seed";
    result.contract = contract;
    result.projection = projection;
    result.unqualifiedRuntimeBinding = binding;
    return structuredClone(result);
  } catch (error) {
    result.problems.push(
      error instanceof Error && error.message.startsWith("source-visual-")
        ? error.message
        : "source-visual-input-or-schema-invalid",
    );
    return result;
  }
}
