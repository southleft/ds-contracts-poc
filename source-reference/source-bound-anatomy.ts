/** Source-owned structure for the existing computed-fusion pipeline. This is
 * neither a renderer nor a semantic/visual Contract admission gate. */
import { createHash } from "node:crypto";
import type { CapturedNode } from "../extract/computed/lib.js";
import type {
  LitSpan,
  LitTemplateInput,
} from "../extract/adapters/lit-template.js";
import { canonicalJson } from "../core/contract-provenance.js";
import type { CandidateSemanticCase } from "./button-candidate-semantics.js";
import type { BoundTopologyResult } from "./bound-topology.js";
import type { SemanticIntake } from "./semantics.js";
import {
  matchLitRender,
  type LitRenderGuard,
  type LitRenderNode,
} from "./lit-render-match.js";
import type { TopologyNode } from "./topology.js";

export interface SourceBoundAnatomyInput {
  /** Supplied independently by the authenticated host's fixed case manifest. */
  expectedCaseId: string;
  sourceProgramSha256: string;
  source: LitTemplateInput;
  case: CandidateSemanticCase;
  semantics: SemanticIntake;
  boundTopology: BoundTopologyResult;
  /** Hash is SHA-256 of JSON.stringify(root), as in the original reader. */
  tree: { root: CapturedNode; sha256: string };
}
export interface SourceAnatomyIdentity {
  templateId: string;
  sourceNodeId: string;
  sourceSpan: LitSpan;
}
export interface SourceOwnedElement extends SourceAnatomyIdentity {
  domPath: string;
  visualPath: string;
  /** Original reader's element-index path. Does not shift after pruning. */
  flatPath: string;
  /** Element-index path in the separately derived pruned tree. */
  projectionFlatPath: string;
  parent?: SourceAnatomyIdentity;
  observedAttributes: Record<string, string>;
  /** Exact styles/variable-reference facts, with only distributed children
   * removed. This is not an empty-source measurement or UA subtraction. */
  node: CapturedNode;
}
export interface SourceSlotBoundary extends SourceAnatomyIdentity {
  sourceName: string;
  domPath: string;
  semanticPath: string;
  owner: SourceAnatomyIdentity;
  ownerVisualPath: string;
  distribution: "assigned" | "fallback";
  assigned: string[];
  fallback: string[];
  visualPaths: string[];
  sampleIds: string[];
}
export interface SourceSlotSample {
  id: string;
  slot: SourceAnatomyIdentity;
  sourceName: string;
  distribution: "assigned" | "fallback";
  domPath: string;
  kind: "element" | "text" | "comment";
  /** Authored fallback descendants, if any, remain identifiable even though
   * terminal content is excluded from the empty-main anatomy. */
  sourceNodes: SourceAnatomyIdentity[];
  visualPath?: string;
  flatPath?: string;
  /** Whole observed assigned/fallback subtree. The distribution and sourceNodes
   * distinguish consumer samples from authored fallback; neither is silently
   * promoted into a main component asset or newly inferred code default. */
  element?: CapturedNode;
  text?: string;
}
export interface SourceBoundAnatomy {
  version: 1;
  status: "structural-projection" | "refused";
  acceptedContract: null;
  caseId: string;
  sourceProgramSha256: string;
  sourceSha256: string;
  sourceTreeSha256: string;
  topologyObservationSha256: string;
  /** A distinct derived tree. Its hash must never replace sourceTreeSha256. */
  root?: CapturedNode;
  projectionTreeSha256?: string;
  elements: SourceOwnedElement[];
  slots: SourceSlotBoundary[];
  samples: SourceSlotSample[];
  guards: LitRenderGuard[];
  problems: string[];
  limitations: string[];
}
interface VisualEntry {
  kind: "element" | "text";
  pointer: string;
  parent?: string;
  flatPath?: string;
  element?: CapturedNode;
  text?: string;
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const hash = /^[a-f0-9]{64}$/;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const stringMap = (v: unknown) =>
  object(v) && Object.values(v).every((x) => typeof x === "string");
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const unique = (a: readonly string[]) => new Set(a).size === a.length;
const identity = (node: LitRenderNode): SourceAnatomyIdentity => ({
  templateId: node.templateId,
  sourceNodeId: node.sourceNodeId,
  sourceSpan: { ...node.sourceSpan },
});
const identityKey = (node: SourceAnatomyIdentity) =>
  JSON.stringify([node.templateId, node.sourceNodeId]);
const parentDom = (value: string) => value.slice(0, value.lastIndexOf("/"));
const below = (child: string, parent: string) =>
  child === parent || child.startsWith(parent + "/");
function fail(code: string): never {
  throw Error(`source-anatomy-${code}`);
}

/** Re-derives source correspondence, checks every raw visual node's exact DOM
 * identity, then partitions at terminal slots. No source/class/text similarity
 * joins, token minting, sample defaults, visibility props or code are produced.
 * Authentic source/readiness and the source-program hash are the host's trust
 * boundary; matching digests alone do not authenticate arbitrary input. */
export function projectSourceBoundAnatomy(
  input: SourceBoundAnatomyInput,
): SourceBoundAnatomy {
  const result: SourceBoundAnatomy = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    caseId:
      typeof input?.expectedCaseId === "string" ? input.expectedCaseId : "",
    sourceProgramSha256:
      typeof input?.sourceProgramSha256 === "string"
        ? input.sourceProgramSha256
        : "",
    sourceSha256:
      typeof input?.source?.sourceSha256 === "string"
        ? input.source.sourceSha256
        : "",
    sourceTreeSha256:
      typeof input?.tree?.sha256 === "string" ? input.tree.sha256 : "",
    topologyObservationSha256: "",
    elements: [],
    slots: [],
    samples: [],
    guards: [],
    problems: [],
    limitations: [
      "Structural candidate only; acceptedContract is null. Source authentication/readiness, runtime retention, authored-vs-UA styles, token identity and target qualification remain separate obligations.",
      "Source AST identities and positional DOM/visual pointers establish ownership. Exact text comparison checks already-identified bytes; it never binds an accessible label to visible content.",
      "Assigned consumer content and source-authored fallback are partitioned at terminal slots. Static source-owned ASCII whitespace remains; static non-whitespace text refuses. Comments and unpainted nodes are not invented as captured elements.",
      "Slots are terminal metadata, not fake styled nodes. Samples distinguish assigned content from authored fallback and preserve fallback source identities; they are not newly inferred code defaults or accepted dependencies/assets. Conditional wrappers/guards remain unproven.",
      "Pruned wrappers retain styles measured with populated slots, including sample-dependent dimensions. This tree is not a measurement of an empty main component or proof that native empty slots preserve its geometry.",
    ],
  };
  try {
    if (
      !object(input) ||
      !input.expectedCaseId ||
      !hash.test(input.sourceProgramSha256) ||
      !object(input.case) ||
      input.case.id !== input.expectedCaseId ||
      input.case.status !== "structure-matched" ||
      !Array.isArray(input.case.problems) ||
      input.case.problems.length ||
      !input.case.branch ||
      !object(input.tree) ||
      !hash.test(input.tree.sha256) ||
      digest(JSON.stringify(input.tree.root)) !== input.tree.sha256 ||
      input.tree.sha256 !== input.case.sourceTreeSha256
    )
      fail("case-or-tree-identity-invalid");
    const match = matchLitRender({
      source: input.source,
      semantics: input.semantics,
      boundTopology: input.boundTopology,
    });
    if (
      match.status !== "structure-matched" ||
      match.problems.length ||
      !same(input.case.nodes, match.nodes) ||
      match.sourceTreeSha256 !== input.tree.sha256 ||
      input.case.sourcePngSha256 !== match.sourcePngSha256 ||
      input.case.semanticObservationSha256 !==
        match.semanticObservationSha256 ||
      input.case.topologyObservationSha256 !== match.topologyObservationSha256
    )
      fail("case-correspondence-mismatch");
    const topology = input.boundTopology.topology!.observation!;
    const rootMatch = match.nodes.filter(
      (node) => node.domPath === topology.rootDomPath,
    );
    if (
      rootMatch.length !== 1 ||
      rootMatch[0].visualPath !== "" ||
      !same(input.case.branch, {
        templateId: rootMatch[0].templateId,
        sourceNodeId: rootMatch[0].sourceNodeId,
        tag: rootMatch[0].tag,
      })
    )
      fail("branch-unavailable");
    if (
      !unique(match.nodes.map(identityKey)) ||
      !unique(match.nodes.map((node) => node.domPath))
    )
      fail("source-identity-ambiguous");

    const visual = new Map<string, VisualEntry>();
    let budget = 2000;
    function walk(
      node: CapturedNode,
      pointer: string,
      flatPath: string,
      parent?: string,
      depth = 0,
    ) {
      if (--budget < 0 || depth > 64) fail("tree-budget-exceeded");
      if (
        !object(node) ||
        typeof node.tag !== "string" ||
        !node.tag ||
        !strings(node.classes) ||
        !stringMap(node.style) ||
        !object(node.pseudo) ||
        Object.keys(node.pseudo).length ||
        !Array.isArray(node.nodes) ||
        "closedShadowRootSuspect" in node
      )
        fail("tree-shape-unavailable");
      visual.set(pointer, {
        kind: "element",
        pointer,
        parent,
        flatPath,
        element: node,
      });
      let elementIndex = 0;
      node.nodes.forEach((child, index) => {
        const childPath = `${pointer}/nodes/${index}`;
        if (child?.t === "el") {
          const path =
            flatPath === ""
              ? String(elementIndex)
              : `${flatPath}.${elementIndex}`;
          elementIndex++;
          walk(child.el, `${childPath}/el`, path, pointer, depth + 1);
        } else if (child?.t === "text" && typeof child.v === "string") {
          if (--budget < 0) fail("tree-budget-exceeded");
          visual.set(childPath, {
            kind: "text",
            pointer: childPath,
            parent: pointer,
            text: child.v,
          });
        } else fail("tree-node-kind-invalid");
      });
    }
    walk(input.tree.root, "", "");
    const dom = new Map<string, TopologyNode>();
    const byVisual = new Map<string, TopologyNode>();
    for (const node of topology.nodes) {
      if (dom.has(node.domPath)) fail("dom-path-ambiguous");
      dom.set(node.domPath, node);
      if (node.visualPath !== undefined) {
        if (byVisual.has(node.visualPath)) fail("visual-path-ambiguous");
        const raw = visual.get(node.visualPath);
        if (
          !raw ||
          raw.kind !== node.kind ||
          (raw.kind === "element"
            ? raw.element!.tag !== node.tag
            : raw.text !== node.text)
        )
          fail("visual-node-mismatch");
        byVisual.set(node.visualPath, node);
      }
    }
    if (byVisual.size !== visual.size) fail("visual-node-unmatched");
    // A rehashed map can otherwise swap two <span> wrappers and their whole
    // subtrees while retaining individually valid tags/parents. Corroborate
    // every visual child position against DOM order and literal slot Node IDs.
    const directDom = (parent: string) =>
      topology.nodes
        .filter(
          (node) =>
            parentDom(node.domPath) === parent &&
            /^\d+$/.test(node.domPath.slice(parent.length + 1)),
        )
        .sort(
          (a, b) =>
            Number(a.domPath.slice(parent.length + 1)) -
            Number(b.domPath.slice(parent.length + 1)),
        );
    const allSlots = new Map(
      topology.slots.map((slot) => [slot.domPath, slot]),
    );
    if (allSlots.size !== topology.slots.length)
      fail("slot-identity-ambiguous");
    let distributionBudget = 8000;
    function distribute(node: TopologyNode, depth = 0): TopologyNode[] {
      if (--distributionBudget < 0 || depth > 64)
        fail("slot-distribution-limit");
      if (node.kind === "comment" || (node.kind === "text" && node.text === ""))
        return [];
      if (node.kind === "element" && node.tag === "slot") {
        const slot = allSlots.get(node.domPath);
        if (!slot) fail("slot-distribution-unobserved");
        return (slot.assigned.length ? slot.assigned : slot.fallback).flatMap(
          (id) => {
            const child = dom.get(id);
            if (!child) fail("slot-assignment-missing");
            return distribute(child, depth + 1);
          },
        );
      }
      if (
        node.kind === "element" &&
        node.namespace === "http://www.w3.org/2000/svg" &&
        ["title", "desc", "metadata"].includes(node.tag!)
      ) {
        if (
          !topology.omitted.some(
            (omission) =>
              omission.domPath === node.domPath &&
              omission.reason === "svg-nonpainting-metadata",
          )
        )
          fail("visual-omission-unobserved");
        return [];
      }
      return [node];
    }
    for (const [pointer, raw] of visual) {
      if (raw.kind !== "element") continue;
      const fact = byVisual.get(pointer)!;
      const shadow = directDom(`${fact.domPath}/shadow`);
      const expected = (
        shadow.length || fact.tag?.includes("-")
          ? shadow
          : directDom(fact.domPath)
      ).flatMap((node) => distribute(node));
      const actual = raw.element!.nodes.map(
        (child, index) =>
          byVisual.get(
            `${pointer}/nodes/${index}${child.t === "el" ? "/el" : ""}`,
          )!.domPath,
      );
      if (
        !same(
          actual,
          expected.map((node) => node.domPath),
        )
      )
        fail("visual-child-order-mismatch");
    }
    const owned = new Map<string, LitRenderNode>();
    const ownedDom = new Map<string, LitRenderNode>();
    const terminalDescendants = match.nodes.filter((node) =>
      match.slots.some(
        (slot) =>
          node.domPath !== slot.domPath && below(node.domPath, slot.domPath),
      ),
    );
    const terminalIds = new Set(terminalDescendants.map(identityKey));
    for (const node of match.nodes.filter(
      (node) => node.tag !== "slot" && !terminalIds.has(identityKey(node)),
    )) {
      const fact = dom.get(node.domPath),
        raw =
          node.visualPath === undefined
            ? undefined
            : visual.get(node.visualPath);
      if (
        !fact ||
        fact.kind !== "element" ||
        !raw ||
        raw.kind !== "element" ||
        node.visualPath !== fact.visualPath ||
        raw.element!.tag !== node.tag ||
        owned.has(node.visualPath!) ||
        fact.slotChain?.length
      )
        fail("owned-node-unavailable");
      owned.set(node.visualPath!, node);
      ownedDom.set(node.domPath, node);
    }
    if (
      !owned.has("") ||
      match.slots.length !==
        match.nodes.filter((node) => node.tag === "slot").length ||
      !unique(match.slots.map((slot) => slot.domPath)) ||
      !unique(match.slots.map((slot) => slot.name))
    )
      fail("slot-identity-ambiguous");
    const slots: SourceSlotBoundary[] = [];
    const samples: SourceSlotSample[] = [];
    const distributed = new Set<string>();
    const sourceSlotPaths = new Set(match.slots.map((slot) => slot.domPath));
    for (const slot of match.slots) {
      const fact = dom.get(slot.domPath),
        owner = ownedDom.get(parentDom(slot.domPath));
      if (
        !owner ||
        !fact ||
        fact.tag !== "slot" ||
        fact.visualPath !== undefined ||
        !unique(slot.assigned) ||
        !unique(slot.fallback) ||
        !unique(slot.visualPaths) ||
        slot.distribution !== (slot.assigned.length ? "assigned" : "fallback")
      )
        fail("slot-boundary-unavailable");
      const actual = [...byVisual]
        .filter(([, node]) => node.slotChain?.includes(slot.domPath))
        .map(([pointer]) => pointer);
      if (!same([...actual].sort(), [...slot.visualPaths].sort()))
        fail("slot-visual-path-mismatch");
      const active =
        slot.distribution === "assigned" ? slot.assigned : slot.fallback;
      const direct: VisualEntry[] = [];
      const sampleIds: string[] = [];
      active.forEach((domPath, index) => {
        const node = dom.get(domPath);
        if (!node) fail("slot-assignment-missing");
        const raw =
          node.visualPath === undefined
            ? undefined
            : visual.get(node.visualPath);
        if (
          raw &&
          (raw.parent !== owner.visualPath ||
            !node.slotChain?.includes(slot.domPath))
        )
          fail("slot-assignment-parent-mismatch");
        if (
          !raw &&
          node.kind !== "comment" &&
          !(node.kind === "text" && node.text === "")
        )
          fail("slot-assignment-unrendered");
        if (raw) direct.push(raw);
        const id = JSON.stringify([
          input.expectedCaseId,
          slot.templateId,
          slot.sourceNodeId,
          index,
        ]);
        sampleIds.push(id);
        samples.push({
          id,
          slot: identity(slot),
          sourceName: slot.name,
          distribution: slot.distribution,
          domPath,
          kind: node.kind,
          sourceNodes: terminalDescendants
            .filter((node) => below(node.domPath, domPath))
            .map(identity),
          ...(raw
            ? {
                visualPath: raw.pointer,
                ...(raw.flatPath !== undefined
                  ? { flatPath: raw.flatPath }
                  : {}),
              }
            : {}),
          ...(raw?.element
            ? { element: structuredClone(raw.element) }
            : { text: node.text ?? "" }),
        });
      });
      for (const pointer of slot.visualPaths) {
        const node = byVisual.get(pointer)!;
        const carriers = direct.filter((raw) =>
          raw.kind === "element"
            ? below(pointer, raw.pointer)
            : pointer === raw.pointer,
        );
        if (
          carriers.length !== 1 ||
          !active.some((id) => below(node.domPath, id)) ||
          node.slotChain!.filter((id) => sourceSlotPaths.has(id)).length !==
            1 ||
          distributed.has(pointer) ||
          owned.has(pointer)
        )
          fail("slot-distribution-ambiguous");
        distributed.add(pointer);
      }
      slots.push({
        ...identity(slot),
        sourceName: slot.name,
        domPath: slot.domPath,
        semanticPath: slot.semanticPath,
        owner: identity(owner),
        ownerVisualPath: owner.visualPath!,
        distribution: slot.distribution,
        assigned: [...slot.assigned],
        fallback: [...slot.fallback],
        visualPaths: [...slot.visualPaths],
        sampleIds,
      });
    }
    for (const [pointer, raw] of visual) {
      if (distributed.has(pointer)) continue;
      const node = byVisual.get(pointer)!;
      if (node.slotChain?.length) fail("unmapped-distribution");
      if (raw.kind === "element") {
        const mapped = owned.get(pointer);
        if (!mapped || node.domPath !== mapped.domPath)
          fail("owned-visual-element-unmatched");
        if (pointer !== "") {
          const parent = owned.get(raw.parent!);
          if (!parent || parentDom(mapped.domPath) !== parent.domPath)
            fail("owned-parent-mismatch");
        }
      } else if (!/^[\t\n\f\r ]*$/.test(raw.text!)) fail("owned-text-unproven");
    }
    const elements: SourceOwnedElement[] = [];
    function prune(pointer: string, projectionFlatPath: string): CapturedNode {
      const raw = visual.get(pointer)!,
        source = owned.get(pointer)!;
      const copy = structuredClone(raw.element!);
      const parent =
        raw.parent === undefined ? undefined : owned.get(raw.parent);
      elements.push({
        ...identity(source),
        domPath: source.domPath,
        visualPath: pointer,
        flatPath: raw.flatPath!,
        projectionFlatPath,
        ...(parent ? { parent: identity(parent) } : {}),
        observedAttributes: { ...source.observedAttributes },
        node: copy,
      });
      let index = 0;
      copy.nodes = raw.element!.nodes.flatMap(
        (child, position): CapturedNode["nodes"] => {
          const childPointer = `${pointer}/nodes/${position}${child.t === "el" ? "/el" : ""}`;
          if (distributed.has(childPointer)) return [];
          if (child.t === "text") return [{ ...child }];
          const next =
            projectionFlatPath === ""
              ? String(index)
              : `${projectionFlatPath}.${index}`;
          index++;
          return [{ t: "el", el: prune(childPointer, next) }];
        },
      );
      return copy;
    }
    const root = prune("", "");
    Object.assign(result, {
      status: "structural-projection",
      root,
      projectionTreeSha256: digest(JSON.stringify(root)),
      topologyObservationSha256: match.topologyObservationSha256,
      elements,
      slots,
      samples,
      guards: structuredClone(match.guards),
    });
    if (samples.some((sample) => sample.distribution === "fallback"))
      result.limitations.push(
        "source-fallback-main-carrier-unqualified: authored fallback remains in the retained source runtime and the identified sample records; an empty main projection does not preserve that fallback. Target lowering must preserve it through a qualified carrier or refuse, not discard it as consumer content.",
      );
    result.limitations.push(...match.limitations);
  } catch (error) {
    result.problems.push(
      error instanceof Error && /^source-anatomy-[a-z-]+$/.test(error.message)
        ? error.message
        : "source-anatomy-input-malformed",
    );
  }
  return result;
}
