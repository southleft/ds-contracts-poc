import {
  readLitTemplateBindings,
  type LitAttribute,
  type LitExpression,
  type LitNode,
  type LitSpan,
  type LitTemplate,
  type LitTemplateInput,
  type LitTemplateRead,
} from "../extract/adapters/lit-template.js";
import {
  topologyJoinProblems,
  type BoundTopologyResult,
} from "./bound-topology.js";
import {
  assessSemantics,
  semanticHash,
  type SemanticIntake,
  type SemanticObservation,
} from "./semantics.js";
import type { SourceTopology, TopologyNode, TopologySlot } from "./topology.js";

export interface LitRenderInput {
  source: LitTemplateInput;
  semantics: SemanticIntake;
  boundTopology: BoundTopologyResult;
  /** Enumeration is fail-closed, never truncated. Hard maximum: 128 shapes. */
  maxShapes?: number;
}
export interface LitRenderNode {
  templateId: string;
  sourceNodeId: string;
  sourceSpan: LitSpan;
  tag: string;
  domPath: string;
  semanticPath?: string;
  visualPath?: string;
  observedAttributes: Record<string, string>;
}
export interface LitRenderBinding extends LitRenderNode {
  /** Attribute span, not the enclosing element span. */
  sourceSpan: LitSpan;
  attribute: LitAttribute;
  /** Only direct this.p or lexically import-identified ifDefined(this.p). */
  sourceProperty?: string;
  native?: SemanticObservation["nativeElements"][number];
}
export interface LitRenderSlot extends LitRenderNode {
  name: string;
  semanticPath: string;
  assigned: string[];
  fallback: string[];
  distribution: "assigned" | "fallback";
  visualPaths: string[];
}
export interface LitRenderGuard {
  expression: LitExpression;
  when: "truthy" | "falsy";
  evidence: "observed-scalar" | "structure-only-unproven";
  reason?: string;
}
export interface LitRenderMatch {
  version: 1;
  status: "structure-matched" | "refused";
  acceptedContract: null;
  problems: string[];
  limitations: string[];
  sourceSha256: string;
  sourcePngSha256: string;
  sourceTreeSha256: string;
  semanticObservationSha256: string;
  topologyObservationSha256: string;
  sourceRead: LitTemplateRead;
  evaluatedShapes: number;
  matchingShapes: number;
  selectedTemplateIds: string[];
  guards: LitRenderGuard[];
  nodes: LitRenderNode[];
  bindings: LitRenderBinding[];
  slots: LitRenderSlot[];
}

type Scalar = string | number | boolean | null | undefined;
type Evaluation =
  | { known: true; value: Scalar }
  | { known: false; enumerable: boolean; reason: string };
type SourceElement = Extract<LitNode, { kind: "element" }>;
interface ShapeElement {
  source: SourceElement;
  templateId: string;
  children: ShapeElement[];
}
interface Shape {
  nodes: ShapeElement[];
  templates: string[];
  guards: LitRenderGuard[];
}
const empty = (): Shape => ({ nodes: [], templates: [], guards: [] });
const hashPattern = /^[a-f0-9]{64}$/;
const htmlNamespace = "http://www.w3.org/1999/xhtml";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const stringMap = (value: unknown) =>
  object(value) && Object.values(value).every((v) => typeof v === "string");
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");
function fail(code: string): never {
  throw new Error(code);
}

/** Pure correspondence, NOT a source interpreter or contract admission gate.
 * Exact raw source is reparsed. Runtime/semantic digests are re-derived, and the
 * existing independent topology/semantic referee is reused. Image/tree bytes,
 * package resolution, source revision and capture provenance remain the calling
 * evidence loader's responsibility; these hashes are not signatures.
 */
export function matchLitRender(input: LitRenderInput): LitRenderMatch {
  const read = readLitTemplateBindings(input.source);
  const { semantics, boundTopology: bound } = input;
  const result: LitRenderMatch = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    problems: [],
    limitations: [
      "Structural correspondence only: dynamic attributes, properties, events, directive implementations, helpers, lifecycle effects and target behavior are not qualified.",
      "Source comments, runtime comments (including Lit markers), and ASCII-whitespace-only text nodes are excluded from structural selection. Non-whitespace source-owned text is refused; assigned consumer content is retained by exact slot Node identity, never matched by sample text.",
      "Unknown helper predicates can select one structural correspondence, but their truth/meaning is unproven. Missing, unreadable or non-scalar guard properties are not treated as false.",
      "Only exact literal attributes constrain topology. Dynamic/composite attributes, including classes, do not identify nodes. Equal text in an API label and a content slot proves no binding between them.",
      "Source/PNG/tree provenance and raw visual-tree corroboration belong to the calling evidence loader. Recomputed hashes detect inconsistent records, not forged or untrusted provenance.",
      ...read.limitations,
    ],
    sourceSha256: read.sourceSha256,
    sourcePngSha256: semantics?.sourcePngSha256 ?? "",
    sourceTreeSha256: semantics?.sourceTreeSha256 ?? "",
    semanticObservationSha256: semantics?.observationSha256 ?? "",
    topologyObservationSha256: bound?.topology?.observationSha256 ?? "",
    sourceRead: read,
    evaluatedShapes: 0,
    matchingShapes: 0,
    selectedTemplateIds: [],
    guards: [],
    nodes: [],
    bindings: [],
    slots: [],
  };
  try {
    const limit = input.maxShapes ?? 128;
    if (!Number.isInteger(limit) || limit < 1 || limit > 128)
      fail("render-shape-limit-invalid");
    if (read.status === "refused") fail("render-source-refused");
    // A malformed or unresolved possible template cannot be dropped because a
    // different template happens to resemble the observed DOM.
    if (
      !read.templates.length ||
      read.templates.some(
        (t) =>
          !t.complete ||
          t.role === "unresolved" ||
          t.guardAlternatives ||
          t.unresolvedAncestorTemplateIds?.length,
      )
    )
      fail("render-template-selection-unresolved");
    const structuralProblems = new Set([
      "duplicate-attribute-target",
      "directive-binding-shape-unsupported",
      "html-entity-decoding-unproven",
      "slot-identity-unproven",
      "duplicate-slot-name",
      "cross-template-slot-distribution-unresolved",
      "render-return-unsupported",
      "empty-render-return",
      "render-fallthrough-unresolved",
      "render-control-flow-unresolved",
      "render-state-mutation-unresolved",
      "static-html-values-unverified",
    ]);
    if (read.problems.some((p) => structuralProblems.has(p.code)))
      fail("render-source-topology-unresolved");
    result.limitations.push(
      ...read.problems.map(
        (p) =>
          `source-reader:${p.code}${p.span ? `@${p.span.start}:${p.span.end}` : ""}`,
      ),
    );
    validateEvidence(semantics, bound, read.className);
    const topology = bound.topology!.observation!;
    const joinProblems = topologyJoinProblems(topology, semantics.observation);
    if (joinProblems.length) {
      result.problems.push(...joinProblems);
      return result;
    }
    const templates = new Map(read.templates.map((t) => [t.id, t]));
    const evalExpression = (expr: LitExpression, depth = 0): Evaluation => {
      if (depth > 64) fail("render-expression-depth-limit");
      const recur = (child: LitExpression) => evalExpression(child, depth + 1);
      switch (expr.kind) {
        case "property": {
          const observed = semantics.observation.properties[expr.name];
          if (observed?.kind === "undefined")
            return { known: true, value: undefined };
          if (observed?.kind === "value")
            return { known: true, value: observed.value };
          return {
            known: false,
            enumerable: false,
            reason: `guard-property-unobserved:${expr.name}:${observed?.kind ?? "missing"}`,
          };
        }
        case "literal":
          return { known: true, value: expr.value };
        case "undefined":
          return { known: true, value: undefined };
        case "unsupported":
          return { known: false, enumerable: true, reason: expr.reason };
        case "if-defined":
          return {
            known: false,
            enumerable: false,
            reason: "guard-directive-unverified",
          };
        case "template":
          return {
            known: false,
            enumerable: false,
            reason: "guard-template-value-unsupported",
          };
        case "not": {
          const operand = recur(expr.operand);
          return operand.known
            ? { known: true, value: !operand.value }
            : operand;
        }
        case "conditional": {
          const cond = recur(expr.condition);
          return cond.known
            ? recur(cond.value ? expr.whenTrue : expr.whenFalse)
            : cond;
        }
        case "binary": {
          const left = recur(expr.left);
          if (expr.operator === "&&" || expr.operator === "||") {
            if (!left.known) return left;
            return (expr.operator === "&&" ? !!left.value : !left.value)
              ? recur(expr.right)
              : left;
          }
          const right = recur(expr.right);
          if (!left.known || !right.known) {
            const unknowns = [left, right].filter(
              (x): x is Extract<Evaluation, { known: false }> => !x.known,
            );
            return {
              known: false,
              enumerable: unknowns.every((x) => x.enumerable),
              reason: unknowns.map((x) => x.reason).join(","),
            };
          }
          return {
            known: true,
            value:
              expr.operator === "==="
                ? left.value === right.value
                : left.value !== right.value,
          };
        }
      }
    };
    const guardChoices = (expression: LitExpression): LitRenderGuard[] => {
      const evaluated = evalExpression(expression);
      if (evaluated.known)
        return [
          {
            expression,
            when: evaluated.value ? "truthy" : "falsy",
            evidence: "observed-scalar",
          },
        ];
      if (!evaluated.enumerable) fail(evaluated.reason);
      return ["truthy", "falsy"].map((when) => ({
        expression,
        when: when as "truthy" | "falsy",
        evidence: "structure-only-unproven",
        reason: evaluated.reason,
      }));
    };
    const bounded = <T>(values: T[]): T[] => {
      if (values.length > limit) fail("render-shape-limit-exceeded");
      return values;
    };
    const combine = (left: Shape[], right: Shape[]): Shape[] => {
      if (left.length * right.length > limit)
        fail("render-shape-limit-exceeded");
      return left.flatMap((a) =>
        right.map((b) => ({
          nodes: [...a.nodes, ...b.nodes],
          templates: [...a.templates, ...b.templates],
          guards: [...a.guards, ...b.guards],
        })),
      );
    };
    const withGuard = (shapes: Shape[], guard: LitRenderGuard) =>
      shapes.map((shape) => ({ ...shape, guards: [guard, ...shape.guards] }));
    const expandTemplate = (template: LitTemplate, depth: number): Shape[] =>
      expandNodes(template.roots, template.id, depth + 1).map((shape) => ({
        ...shape,
        templates: [template.id, ...shape.templates],
      }));
    const expandExpression = (expr: LitExpression, depth: number): Shape[] => {
      if (depth > 64) fail("render-template-depth-limit");
      if (expr.kind === "template") {
        const template = templates.get(expr.templateId);
        if (!template || template.role !== "nested")
          fail("render-nested-template-unresolved");
        return expandTemplate(template!, depth + 1);
      }
      if (expr.kind === "conditional")
        return bounded(
          guardChoices(expr.condition).flatMap((guard) =>
            withGuard(
              expandExpression(
                guard.when === "truthy" ? expr.whenTrue : expr.whenFalse,
                depth + 1,
              ),
              guard,
            ),
          ),
        );
      if (
        expr.kind === "binary" &&
        (expr.operator === "&&" || expr.operator === "||")
      ) {
        return bounded(
          guardChoices(expr.left).flatMap((guard) => {
            const takeRight =
              (guard.when === "truthy") === (expr.operator === "&&");
            if (takeRight)
              return withGuard(expandExpression(expr.right, depth + 1), guard);
            const value = evalExpression(expr.left);
            // Unknown helper short-circuit values are only an EMPTY structural
            // candidate; no claim that all falsy values render empty (0 does not).
            if (!value.known && guard.evidence === "structure-only-unproven")
              return withGuard([empty()], guard);
            return withGuard(expandExpression(expr.left, depth + 1), guard);
          }),
        );
      }
      const value = evalExpression(expr);
      if (
        value.known &&
        (value.value === undefined ||
          value.value === null ||
          typeof value.value === "boolean" ||
          value.value === "")
      )
        return [empty()];
      fail("render-child-expression-unresolved");
    };
    const expandNodes = (
      nodes: LitNode[],
      owner: string,
      depth: number,
    ): Shape[] => {
      if (depth > 64) fail("render-template-depth-limit");
      let shapes: Shape[] = [empty()];
      for (const node of nodes) {
        if (node.kind === "comment") continue;
        if (node.kind === "text") {
          if (!/^[\t\n\f\r ]*$/.test(node.value))
            fail("render-source-text-unbound");
          continue;
        }
        if (node.kind !== "element" && node.kind !== "expression")
          fail("render-source-node-unresolved");
        const next =
          node.kind === "expression"
            ? expandExpression(node.expression, depth + 1)
            : expandNodes(node.children, owner, depth + 1).map((shape) => ({
                ...shape,
                nodes: [
                  { source: node, templateId: owner, children: shape.nodes },
                ],
              }));
        shapes = combine(shapes, next);
      }
      return shapes;
    };
    let candidates: Shape[] = [];
    for (const template of read.templates.filter(
      (t) => t.role === "returned",
    )) {
      const guards: LitRenderGuard[] = [];
      let selected = true;
      for (const expected of template.guards) {
        const choice = guardChoices(expected.expression).find(
          (g) => g.when === expected.when,
        );
        if (!choice) {
          selected = false;
          break;
        }
        guards.push(choice);
      }
      if (selected)
        candidates = bounded([
          ...candidates,
          ...expandTemplate(template, 0).map((shape) => ({
            ...shape,
            guards: [...guards, ...shape.guards],
          })),
        ]);
    }
    result.evaluatedShapes = candidates.length;
    const matched: Array<{
      shape: Shape;
      nodes: LitRenderNode[];
      bindings: LitRenderBinding[];
      slots: LitRenderSlot[];
    }> = [];
    for (const shape of candidates) {
      const correspondence = matchShape(shape, topology, semantics.observation);
      if (correspondence) matched.push({ shape, ...correspondence });
    }
    result.matchingShapes = matched.length;
    if (matched.length !== 1)
      fail(
        matched.length
          ? "render-structural-correspondence-ambiguous"
          : "render-structure-mismatch",
      );
    const chosen = matched[0];
    result.status = "structure-matched";
    result.selectedTemplateIds = chosen.shape.templates;
    result.guards = chosen.shape.guards;
    result.nodes = chosen.nodes;
    result.bindings = chosen.bindings;
    result.slots = chosen.slots;
    result.limitations.push(
      ...result.guards
        .filter((g) => g.evidence === "structure-only-unproven")
        .map(
          (g) =>
            `unproven-guard@${g.expression.span.start}:${g.expression.span.end}:${g.when}:${g.expression.raw}`,
        ),
    );
  } catch (error) {
    result.problems.push(
      error instanceof Error ? error.message : "render-evidence-malformed",
    );
  }
  return result;
}

function validateEvidence(
  semantics: SemanticIntake,
  bound: BoundTopologyResult,
  className: string,
): void {
  if (
    semantics?.status !== "observed" ||
    !strings(semantics.problems) ||
    semantics.problems.length ||
    bound?.status !== "topology-matched" ||
    !strings(bound.problems) ||
    bound.problems.length
  )
    fail("render-evidence-refused");
  const topo = bound.topology;
  if (
    topo?.status !== "captured" ||
    !strings(topo.problems) ||
    topo.problems.length ||
    !topo.observation
  )
    fail("render-topology-refused");
  const hashes = [
    semantics.sourcePngSha256,
    semantics.sourceTreeSha256,
    semantics.declarationSha256,
    semantics.observationSha256,
    topo.observationSha256,
  ];
  if (!hashes.every((h) => typeof h === "string" && hashPattern.test(h)))
    fail("render-evidence-hash-invalid");
  if (
    semantics.sourcePngSha256 !== bound.sourcePngSha256 ||
    semantics.sourcePngSha256 !== topo.sourcePngSha256 ||
    semantics.sourceTreeSha256 !== bound.sourceTreeSha256 ||
    semantics.sourceTreeSha256 !== topo.sourceTreeSha256 ||
    semantics.declarationSha256 !== bound.declarationSha256 ||
    semantics.observationSha256 !== bound.semanticObservationSha256
  )
    fail("render-evidence-identity-mismatch");
  if (
    semanticHash(semantics.declaration) !== semantics.declarationSha256 ||
    semanticHash(semantics.observation) !== semantics.observationSha256 ||
    semanticHash(topo.observation) !== topo.observationSha256
  )
    fail("render-evidence-hash-mismatch");
  if (semantics.declaration.className !== className)
    fail("render-source-class-mismatch");
  const observation = semantics.observation;
  if (
    !object(observation.properties) ||
    !Object.values(observation.properties).every(
      (v) =>
        object(v) &&
        (["undefined", "missing", "non-scalar", "unreadable"].includes(
          String(v.kind),
        ) ||
          (v.kind === "value" &&
            (v.value === null ||
              typeof v.value === "string" ||
              typeof v.value === "boolean" ||
              (typeof v.value === "number" && Number.isFinite(v.value))))),
    )
  )
    fail("render-scalar-observation-malformed");
  const assessed = assessSemantics(semantics.declaration, observation, {
    valid: true,
    sourcePngSha256: semantics.sourcePngSha256,
    sourceTreeSha256: semantics.sourceTreeSha256,
  });
  if (assessed.status !== "observed")
    fail("render-semantic-assessment-refused");
  const topology = topo.observation;
  if (
    topology.hostDomPath !== "host" ||
    !Array.isArray(topology.nodes) ||
    topology.nodes.length > 2000 ||
    !Array.isArray(topology.slots) ||
    !Array.isArray(topology.omitted)
  )
    fail("render-topology-malformed");
  const ids = new Set<string>();
  for (const node of topology.nodes) {
    if (
      !object(node) ||
      typeof node.domPath !== "string" ||
      !/^host(?:\/(?:\d+|shadow))*$/.test(node.domPath) ||
      ids.has(node.domPath) ||
      !["element", "text", "comment"].includes(node.kind)
    )
      fail("render-topology-node-malformed");
    ids.add(node.domPath);
    if (
      node.kind === "element"
        ? typeof node.tag !== "string" || !stringMap(node.attributes)
        : typeof node.text !== "string"
    )
      fail("render-topology-node-malformed");
  }
  for (const node of topology.nodes) {
    if (node.domPath === "host") continue;
    const parent = node.domPath
      .slice(0, node.domPath.lastIndexOf("/"))
      .replace(/\/shadow$/, "");
    if (
      !topology.nodes.some((n) => n.domPath === parent && n.kind === "element")
    )
      fail("render-topology-parent-missing");
    if (node.kind === "element" && node.domPath.includes("/shadow/")) {
      const marker = node.domPath.lastIndexOf("/shadow/"),
        owner = node.domPath.slice(0, marker);
      let parentPath = `${owner}/shadow`;
      const semanticPath: number[] = [];
      for (const segment of node.domPath
        .slice(marker + "/shadow/".length)
        .split("/")) {
        const path = `${parentPath}/${segment}`;
        const siblings = topology.nodes
          .filter(
            (n) =>
              n.kind === "element" &&
              n.domPath.startsWith(`${parentPath}/`) &&
              /^\d+$/.test(n.domPath.slice(parentPath.length + 1)),
          )
          .sort(
            (a, b) =>
              Number(a.domPath.slice(parentPath.length + 1)) -
              Number(b.domPath.slice(parentPath.length + 1)),
          );
        const index = siblings.findIndex((n) => n.domPath === path);
        if (index < 0) fail("render-topology-element-path-invalid");
        semanticPath.push(index);
        parentPath = path;
      }
      if (
        node.shadowHostDomPath !== owner ||
        node.semanticPath !== semanticPath.join("/")
      )
        fail("render-topology-semantic-path-mismatch");
    }
  }
  if (
    !ids.has(topology.rootDomPath) ||
    topology.slots.some(
      (slot) =>
        !ids.has(slot.domPath) ||
        !strings(slot.assigned) ||
        !strings(slot.fallback) ||
        !strings(slot.visualPaths) ||
        [...slot.assigned, ...slot.fallback].some((id) => !ids.has(id)),
    )
  )
    fail("render-topology-slot-malformed");
  for (const slot of topology.slots) {
    if (
      new Set(slot.assigned).size !== slot.assigned.length ||
      new Set(slot.fallback).size !== slot.fallback.length ||
      slot.assigned.some(
        (id) => id.slice(0, id.lastIndexOf("/")) !== slot.shadowHostDomPath,
      ) ||
      slot.fallback.some(
        (id) => id.slice(0, id.lastIndexOf("/")) !== slot.domPath,
      )
    )
      fail("render-topology-slot-identity-invalid");
  }
}

function matchShape(
  shape: Shape,
  topology: SourceTopology,
  semantics: SemanticObservation,
):
  | {
      nodes: LitRenderNode[];
      bindings: LitRenderBinding[];
      slots: LitRenderSlot[];
    }
  | undefined {
  const nodes: LitRenderNode[] = [],
    bindings: LitRenderBinding[] = [],
    slots: LitRenderSlot[] = [];
  const direct = (path: string) =>
    topology.nodes
      .filter(
        (n) =>
          n.domPath.startsWith(`${path}/`) &&
          /^\d+$/.test(n.domPath.slice(path.length + 1)),
      )
      .sort(
        (a, b) =>
          Number(a.domPath.slice(path.length + 1)) -
          Number(b.domPath.slice(path.length + 1)),
      );
  const significant = (children: TopologyNode[]) =>
    children.filter(
      (n) =>
        n.kind !== "comment" &&
        !(n.kind === "text" && /^[\t\n\f\r ]*$/.test(n.text!)),
    );
  const roots = significant(direct("host/shadow"));
  if (
    shape.nodes.length !== 1 ||
    roots.length !== 1 ||
    roots[0].domPath !== topology.rootDomPath ||
    roots[0].visualPath !== ""
  )
    return;
  const match = (
    source: ShapeElement,
    actual: TopologyNode,
    depth: number,
  ): boolean => {
    if (
      depth > 64 ||
      actual.kind !== "element" ||
      actual.tag !== source.source.tag ||
      actual.shadowHostDomPath !== "host" ||
      actual.namespace !== htmlNamespace ||
      typeof actual.semanticPath !== "string"
    )
      return false;
    const attrs = actual.attributes!;
    for (const attr of source.source.attributes) {
      if (
        attr.channel === "attribute" &&
        attr.parts.every((p) => p.kind === "text")
      ) {
        const expected = attr.parts
          .map((p) => (p.kind === "text" ? p.value : ""))
          .join("");
        if (attrs[attr.name.toLowerCase()] !== expected) return false;
      }
    }
    const node: LitRenderNode = {
      templateId: source.templateId,
      sourceNodeId: source.source.id,
      sourceSpan: source.source.span,
      tag: actual.tag!,
      domPath: actual.domPath,
      semanticPath: actual.semanticPath,
      ...(actual.visualPath !== undefined
        ? { visualPath: actual.visualPath }
        : {}),
      observedAttributes: attrs,
    };
    nodes.push(node);
    for (const attribute of source.source.attributes) {
      const expression =
        attribute.parts.length === 1 && attribute.parts[0].kind === "expression"
          ? attribute.parts[0].expression
          : undefined;
      const sourceProperty =
        expression?.kind === "property"
          ? expression.name
          : expression?.kind === "if-defined"
            ? expression.property
            : undefined;
      const native = semantics.nativeElements.find(
        (n) => n.path === actual.semanticPath,
      );
      bindings.push({
        ...node,
        sourceSpan: attribute.span,
        attribute,
        ...(sourceProperty ? { sourceProperty } : {}),
        ...(native ? { native } : {}),
      });
    }
    if (source.source.tag === "slot") {
      const identities = topology.slots.filter(
        (s) => s.domPath === actual.domPath,
      );
      const slot: TopologySlot | undefined =
        identities.length === 1 ? identities[0] : undefined;
      if (
        !source.source.slot ||
        !slot ||
        slot.name !== source.source.slot.name ||
        slot.name !== (attrs.name ?? "") ||
        slot.semanticPath !== actual.semanticPath ||
        slot.shadowHostDomPath !== "host" ||
        slot.distribution !==
          (slot.assigned.length ? "assigned" : "fallback") ||
        slots.some((s) => s.name === slot.name)
      )
        return false;
      slots.push({
        ...node,
        semanticPath: slot.semanticPath,
        name: slot.name,
        assigned: slot.assigned,
        fallback: slot.fallback,
        distribution: slot.distribution,
        visualPaths: slot.visualPaths,
      });
    }
    const children = significant(direct(actual.domPath));
    return (
      children.length === source.children.length &&
      source.children.every((child, i) => match(child, children[i], depth + 1))
    );
  };
  if (!match(shape.nodes[0], roots[0], 0)) return;
  if (
    topology.slots.filter((s) => s.shadowHostDomPath === "host").length !==
    slots.length
  )
    return;
  return { nodes, bindings, slots };
}
