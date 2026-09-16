import { createHash } from "node:crypto";
import type { Page } from "playwright-core";
import { captureJs, SHADOW_HELPERS_JS } from "../extract/computed/capture.js";
import {
  READ_PSEUDOS,
  type CapturedNode,
  type ReadPseudo,
  type StyleMap,
} from "../extract/computed/lib.js";

export interface TopologyInput {
  hostPath: readonly string[];
  rootPath: readonly string[];
  stageSelector: string;
  channels: readonly string[];
  varPrefix?: string;
  tree: CapturedNode;
  treeSha256: string;
  sourcePngSha256: string;
}
export interface TopologyNode {
  /** Child-node indexes, including comments/whitespace; /shadow is explicit.
   * These identities are local to this observation, not stable across edits. */
  domPath: string;
  kind: "element" | "text" | "comment";
  tag?: string;
  namespace?: string;
  attributes?: Record<string, string>;
  text?: string;
  /** Matches semantics.ts element-index paths, scoped by the owning host. */
  semanticPath?: string;
  shadowHostDomPath?: string;
  /** JSON pointer into the RAW CapturedNode; no inferred part names. */
  visualPath?: string;
  slotChain?: string[];
}
export interface TopologySlot {
  domPath: string;
  name: string;
  shadowHostDomPath: string;
  semanticPath: string;
  assigned: string[];
  fallback: string[];
  distribution: "assigned" | "fallback";
  visualPaths: string[];
}
export interface TopologyPseudoPlane {
  /** A CSS plane belongs to an Element; it is never a fabricated DOM Node. */
  ownerDomPath: string;
  ownerVisualPath: string;
  pseudo: ReadPseudo;
  visualPath: string;
  style: StyleMap;
  slotChain?: string[];
}
export interface SourceTopology {
  hostDomPath: "host";
  rootDomPath: string;
  nodes: TopologyNode[];
  slots: TopologySlot[];
  omitted: Array<{ domPath: string; reason: string }>;
  /** Absent for historical observations without pseudo planes. */
  pseudoPlanes?: TopologyPseudoPlane[];
}
export type TopologyResult = {
  status: "captured" | "refused";
  problems: string[];
  sourcePngSha256: string;
  sourceTreeSha256: string;
  observation?: SourceTopology;
  observationSha256?: string;
  limitations: string[];
};
const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

/** Validate persisted owner edges before consumers join semantic or source
 * bindings. Runtime capture separately corroborates these styles against CSS. */
export function topologyPseudoProblems(topology: SourceTopology): string[] {
  if (topology.pseudoPlanes === undefined) return [];
  const planes = topology.pseudoPlanes;
  if (!Array.isArray(planes) || planes.length > 8000)
    return ["topology-pseudo-record-invalid"];
  const seen = new Set<string>();
  for (const plane of planes) {
    if (
      !plane ||
      typeof plane !== "object" ||
      !READ_PSEUDOS.includes(plane.pseudo)
    )
      return ["topology-pseudo-record-invalid"];
    const owner = topology.nodes.find(
      (node) => node.domPath === plane.ownerDomPath,
    );
    if (
      !owner ||
      owner.kind !== "element" ||
      owner.visualPath === undefined ||
      plane.ownerVisualPath !== owner.visualPath ||
      plane.visualPath !== `${owner.visualPath}/pseudo/${plane.pseudo}` ||
      seen.has(plane.visualPath) ||
      JSON.stringify(plane.slotChain) !== JSON.stringify(owner.slotChain)
    )
      return ["topology-pseudo-owner-invalid"];
    if (
      !plane.style ||
      typeof plane.style !== "object" ||
      Array.isArray(plane.style) ||
      !Object.keys(plane.style).length ||
      !Object.values(plane.style).every((value) => typeof value === "string")
    )
      return ["topology-pseudo-style-invalid"];
    seen.add(plane.visualPath);
  }
  return [];
}

// Supplied lexically from the production helper string, never installed on the
// source window. Used as an identity-level referee, not a rewritten reader.
declare const shChildNodesOf: (element: Element) => Node[];

function topologyProbe(
  input: Pick<
    TopologyInput,
    "hostPath" | "rootPath" | "stageSelector" | "tree" | "channels"
  > & { readPseudos: readonly ReadPseudo[] },
): SourceTopology {
  const select = (selectors: readonly string[]): Element => {
    let scope: Document | ShadowRoot | null = document;
    let element: Element | null = null;
    if (!selectors.length) throw new Error("topology-path-empty");
    for (const selector of selectors) {
      const matches: NodeListOf<Element> | undefined =
        scope?.querySelectorAll(selector);
      if (matches?.length !== 1) throw new Error("topology-path-not-unique");
      element = matches[0];
      scope = element.shadowRoot;
    }
    return element!;
  };
  const host = select(input.hostPath),
    root = select(input.rootPath);
  if (!host.shadowRoot) throw new Error("topology-host-shadow-unavailable");
  const stages = document.querySelectorAll(input.stageSelector);
  let ancestor: Element | null = host;
  while (ancestor && ancestor !== stages[0]) {
    const owner = ancestor.getRootNode();
    ancestor =
      ancestor.parentElement ??
      (owner instanceof ShadowRoot ? owner.host : null);
  }
  if (stages.length !== 1 || !ancestor)
    throw new Error("topology-stage-identity-mismatch");
  const nodes: TopologyNode[] = [];
  const pseudoPlanes: TopologyPseudoPlane[] = [];
  const identity = new Map<Node, string>();
  const facts = new Map<Node, TopologyNode>();
  const slotElements: HTMLSlotElement[] = [];
  const tagGet = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "tagName",
  )!.get!;
  const tagOf = (el: Element) => String(tagGet.call(el)).toLowerCase();
  let budget = 2000;
  const visit = (node: Node, domPath: string, depth: number) => {
    if (--budget < 0 || depth > 64)
      throw new Error("topology-observation-limit");
    if (identity.has(node)) throw new Error("topology-dom-identity-ambiguous");
    identity.set(node, domPath);
    if (node instanceof Element) {
      const fact: TopologyNode = {
        domPath,
        kind: "element",
        tag: tagOf(node),
        namespace: node.namespaceURI ?? "",
        attributes: Object.fromEntries(
          [...node.attributes].map((a) => [a.name, a.value]),
        ),
      };
      const owner = node.getRootNode();
      if (owner instanceof ShadowRoot) {
        const indexes: number[] = [];
        let part: Element | null = node;
        while (part) {
          indexes.unshift([...part.parentNode!.children].indexOf(part));
          part = part.parentElement;
        }
        fact.semanticPath = indexes.join("/");
        const ownerPath = identity.get(owner.host);
        if (!ownerPath) throw new Error("topology-shadow-owner-unobserved");
        fact.shadowHostDomPath = ownerPath;
      }
      nodes.push(fact);
      facts.set(node, fact);
      if (node instanceof HTMLSlotElement) slotElements.push(node);
      if (tagOf(node).includes("-") && !node.shadowRoot)
        throw new Error("topology-custom-element-shadow-unavailable");
      [...node.childNodes].forEach((child, index) =>
        visit(child, `${domPath}/${index}`, depth + 1),
      );
      if (node.shadowRoot)
        [...node.shadowRoot.childNodes].forEach((child, index) =>
          visit(child, `${domPath}/shadow/${index}`, depth + 1),
        );
    } else if (
      node.nodeType === Node.TEXT_NODE ||
      node.nodeType === Node.COMMENT_NODE
    ) {
      const fact: TopologyNode = {
        domPath,
        kind: node.nodeType === Node.TEXT_NODE ? "text" : "comment",
        text: node.textContent ?? "",
      };
      nodes.push(fact);
      facts.set(node, fact);
    }
  };
  visit(host, "host", 0);
  const rootDomPath = identity.get(root);
  if (
    !rootDomPath ||
    root === host ||
    !(root.getRootNode() instanceof ShadowRoot)
  )
    throw new Error("topology-root-outside-host-shadow");
  const domPathOf = (node: Node) => {
    const result = identity.get(node);
    if (!result) throw new Error("topology-distributed-node-unobserved");
    return result;
  };
  const slots: TopologySlot[] = slotElements.map((slot) => {
    const fact = facts.get(slot)!;
    if (fact.semanticPath === undefined || fact.shadowHostDomPath === undefined)
      throw new Error("topology-slot-outside-shadow");
    const assigned = slot.assignedNodes({ flatten: false }).map(domPathOf);
    return {
      domPath: fact.domPath,
      name: slot.getAttribute("name") ?? "",
      semanticPath: fact.semanticPath,
      shadowHostDomPath: fact.shadowHostDomPath,
      assigned,
      fallback: [...slot.childNodes].map(domPathOf),
      distribution: assigned.length ? "assigned" : "fallback",
      visualPaths: [],
    };
  });
  const slotByPath = new Map(slots.map((slot) => [slot.domPath, slot]));
  const omitted: SourceTopology["omitted"] = [];
  const projected = (
    element: Element,
  ): Array<{ node: Node; chain: string[] }> => {
    const output: Array<{ node: Node; chain: string[] }> = [];
    const distribute = (node: Node, chain: string[], depth: number) => {
      if (depth > 64) throw new Error("topology-slot-distribution-limit");
      if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedNodes({ flatten: false });
        for (const child of assigned.length ? assigned : [...node.childNodes])
          distribute(child, [...chain, domPathOf(node)], depth + 1);
      } else output.push({ node, chain });
    };
    for (const node of element.shadowRoot?.childNodes ?? element.childNodes)
      distribute(node, [], 0);
    const production = shChildNodesOf(element);
    if (
      production.length !== output.length ||
      production.some((node, index) => node !== output[index].node)
    )
      throw new Error("topology-production-distribution-mismatch");
    return output;
  };
  const rendered = new Set<Node>();
  const attach = (node: Node, visualPath: string, slotChain: string[]) => {
    if (rendered.has(node))
      throw new Error("topology-visual-identity-ambiguous");
    rendered.add(node);
    const fact = facts.get(node);
    if (!fact) throw new Error("topology-visual-node-unobserved");
    fact.visualPath = visualPath;
    if (slotChain.length) fact.slotChain = slotChain;
    for (const slotPath of slotChain) {
      const slot = slotByPath.get(slotPath);
      if (!slot) throw new Error("topology-distribution-slot-unobserved");
      slot.visualPaths.push(visualPath);
    }
  };
  const walk = (
    element: Element,
    captured: CapturedNode,
    visualPath: string,
    inheritedSlots: string[],
  ) => {
    if (captured.tag !== tagOf(element))
      throw new Error("topology-captured-tag-mismatch");
    // Resolve ownership by the same actual Element used by the positional
    // visual-tree join. Then independently read every captured CSS channel.
    // Equal text/styles never choose an owner, and a pseudo is not a DOM child.
    const elementStyle = getComputedStyle(element);
    const observedPseudos: string[] = [];
    for (const pseudo of input.readPseudos) {
      const computed = getComputedStyle(element, pseudo);
      const content = computed.getPropertyValue("content");
      const present =
        pseudo === "::before" || pseudo === "::after"
          ? content !== "none" && content !== "normal"
          : computed.getPropertyValue("display") !== "" &&
            (pseudo !== "::marker" ||
              elementStyle.getPropertyValue("display") === "list-item") &&
            (pseudo !== "::placeholder" || "placeholder" in element);
      if (!present) continue;
      observedPseudos.push(pseudo);
      const style = Object.fromEntries(
        input.channels.map((channel) => [
          channel,
          computed.getPropertyValue(channel),
        ]),
      );
      if (JSON.stringify(style) !== JSON.stringify(captured.pseudo[pseudo]))
        throw new Error("topology-pseudo-style-mismatch");
      pseudoPlanes.push({
        ownerDomPath: domPathOf(element),
        ownerVisualPath: visualPath,
        pseudo,
        visualPath: `${visualPath}/pseudo/${pseudo}`,
        style,
        ...(inheritedSlots.length ? { slotChain: [...inheritedSlots] } : {}),
      });
    }
    if (
      JSON.stringify(observedPseudos) !==
      JSON.stringify(Object.keys(captured.pseudo))
    )
      throw new Error("topology-pseudo-census-mismatch");
    if ("closedShadowRootSuspect" in captured)
      throw new Error("topology-shadow-boundary-unrepresented");
    attach(element, visualPath, inheritedSlots);
    const children = projected(element).filter(({ node }) => {
      if (
        node instanceof SVGElement &&
        ["title", "desc", "metadata"].includes(tagOf(node))
      ) {
        omitted.push({
          domPath: domPathOf(node),
          reason: "svg-nonpainting-metadata",
        });
        return false;
      }
      return (
        node instanceof Element ||
        (node.nodeType === Node.TEXT_NODE &&
          (node.textContent?.length ?? 0) > 0)
      );
    });
    if (children.length !== captured.nodes.length)
      throw new Error("topology-captured-child-count-mismatch");
    children.forEach(({ node, chain }, index) => {
      const child = captured.nodes[index],
        slots = [...inheritedSlots, ...chain];
      const childPath = `${visualPath}/nodes/${index}`;
      if (node instanceof Element) {
        if (child.t !== "el")
          throw new Error("topology-captured-node-kind-mismatch");
        walk(node, child.el, `${childPath}/el`, slots);
      } else {
        // Positional identity was established first. Equal text is only an
        // integrity check; it NEVER selects among duplicate source text nodes.
        if (child.t !== "text" || child.v !== node.textContent)
          throw new Error("topology-captured-text-mismatch");
        attach(node, childPath, slots);
      }
    });
  };
  walk(root, input.tree, "", []);
  return {
    hostDomPath: "host",
    rootDomPath,
    nodes,
    slots,
    omitted,
    ...(pseudoPlanes.length ? { pseudoPlanes } : {}),
  };
}

/** Additive observation only. The existing visual reader is executed verbatim
 * with a lexical window carrier for its bookkeeping; no source globals, DOM
 * attributes, styles, children or component properties are written. */
export async function captureSourceTopology(
  page: Page,
  input: TopologyInput,
): Promise<TopologyResult> {
  const result: TopologyResult = {
    status: "refused",
    problems: [],
    sourcePngSha256: input.sourcePngSha256,
    sourceTreeSha256: input.treeSha256,
    limitations: [
      "Topology identities are observation-local, not cross-state stable IDs or causal prop bindings.",
      "Visual hashes do not bind older semantic observations: consumers must independently reconcile these attributes and slot identities with the same semantic evidence before joining source bindings.",
      "Pseudo planes retain their actual Element owner and independently checked styles; this is not canvas promotion or behavioral qualification. Inaccessible custom-element shadow roots are refused. SVG metadata is explicitly excluded by the unchanged visual reader; SVG nodes are not reconstructed into assets.",
      "Bounded mutation checks do not sandbox source getters or establish source readiness, behavior, token semantics or a generatable contract.",
    ],
  };
  if (
    !/^[a-f0-9]{64}$/.test(input.sourcePngSha256) ||
    !/^[a-f0-9]{64}$/.test(input.treeSha256) ||
    digest(JSON.stringify(input.tree)) !== input.treeSha256 ||
    !input.channels.length
  ) {
    result.problems.push("topology-source-evidence-invalid");
    return result;
  }
  const startMonitor = () => {
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    const watch = (root: Document | ShadowRoot) => {
      observer.observe(root, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      for (const element of root.querySelectorAll("*"))
        if (element.shadowRoot) watch(element.shadowRoot);
    };
    watch(document);
    return {
      stop: () => {
        count += observer.takeRecords().length;
        observer.disconnect();
        return count;
      },
    };
  };
  const monitor = await page.evaluateHandle(
    `(() => { const __name = value => value; return (${startMonitor.toString()})(); })()`,
  );
  try {
    const png = async () =>
      digest(await page.screenshot({ fullPage: true, caret: "initial" }));
    if ((await png()) !== input.sourcePngSha256)
      throw new Error("topology-source-image-changed");
    const read = async () => {
      const tree = await page.evaluate(
        `(() => { const window = {__ALL_PROPS:${JSON.stringify(input.channels)}}; return ${captureJs(input.stageSelector, undefined, input.varPrefix, input.rootPath)}; })()`,
      );
      if (digest(JSON.stringify(tree)) !== input.treeSha256)
        throw new Error("topology-source-tree-changed");
      return page.evaluate<SourceTopology>(
        `(() => { const __name = value => value; ${SHADOW_HELPERS_JS} return (${topologyProbe.toString()})(${JSON.stringify({ hostPath: input.hostPath, rootPath: input.rootPath, stageSelector: input.stageSelector, tree, channels: input.channels, readPseudos: READ_PSEUDOS })}); })()`,
      );
    };
    const first = await read(),
      second = await read();
    if (digest(JSON.stringify(first)) !== digest(JSON.stringify(second)))
      throw new Error("topology-observation-not-stable");
    if ((await png()) !== input.sourcePngSha256)
      throw new Error("topology-source-image-changed");
    if (
      await monitor.evaluate((value) =>
        (value as { stop: () => number }).stop(),
      )
    )
      throw new Error("topology-source-mutated");
    result.status = "captured";
    result.observation = first;
    result.observationSha256 = digest(JSON.stringify(first));
  } catch (error) {
    // Browser exceptions can embed source text/URLs; expose only named codes.
    const message = error instanceof Error ? error.message : "";
    result.problems.push(
      message.match(/\btopology-[a-z-]+\b/)?.[0] ??
        "topology-observation-failed",
    );
  } finally {
    await monitor.evaluate((value) => (value as { stop: () => number }).stop());
    await monitor.dispose();
  }
  return result;
}
