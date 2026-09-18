import type { JSHandle, Page } from "playwright-core";
import {
  assessSemantics,
  captureStableSemantics,
  semanticHash,
  type AssignedContent,
  type SemanticIntake,
  type SemanticObservation,
} from "./semantics.js";
import {
  captureSourceTopology,
  topologyPseudoProblems,
  type SourceTopology,
  type TopologyInput,
  type TopologyResult,
} from "./topology.js";

export interface BoundTopologyInput {
  topology: TopologyInput;
  semantics: SemanticIntake;
  quietMs?: number;
}
export interface BoundTopologyResult {
  status: "topology-matched" | "refused";
  problems: string[];
  sourcePngSha256: string;
  sourceTreeSha256: string;
  declarationSha256: string;
  semanticObservationSha256: string;
  topology?: TopologyResult;
  limitations: string[];
}

const nativeTags = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "label",
]);
const hashPattern = /^[a-f0-9]{64}$/;
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

function startMutationMonitor() {
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
}

/** Join only overlapping, independently observed facts. Neither text equality
 * nor an element's CSS class is used to infer identity or an API binding. */
export function topologyJoinProblems(
  topology: SourceTopology,
  semantics: SemanticObservation,
): string[] {
  const problems: string[] = topologyPseudoProblems(topology);
  const nodes = new Map(topology.nodes.map((node) => [node.domPath, node]));
  if (nodes.size !== topology.nodes.length)
    return ["bound-topology-node-identity-ambiguous"];
  const host = nodes.get(topology.hostDomPath);
  if (
    !host ||
    host.kind !== "element" ||
    host.tag !== semantics.hostTag ||
    !same(host.attributes, semantics.attributes)
  )
    problems.push("bound-topology-host-mismatch");

  const native = topology.nodes
    .filter(
      (node) =>
        node.shadowHostDomPath === topology.hostDomPath &&
        node.kind === "element" &&
        nativeTags.has(node.tag!),
    )
    .map((node) => ({
      path: node.semanticPath,
      tag: node.tag,
      attributes: node.attributes,
    }));
  if (
    !same(
      native,
      semantics.nativeElements.map(({ path, tag, attributes }) => ({
        path,
        tag,
        attributes,
      })),
    )
  )
    problems.push("bound-topology-native-path-mismatch");

  // The topology IDs originate from actual Node identity. Reconstruct direct
  // light/shadow children from those IDs; comments are omitted by semantics.ts.
  const directChildren = (parent: string) =>
    topology.nodes
      .filter((node) => {
        if (!node.domPath.startsWith(`${parent}/`)) return false;
        return /^\d+$/.test(node.domPath.slice(parent.length + 1));
      })
      .sort(
        (a, b) =>
          Number(a.domPath.slice(parent.length + 1)) -
          Number(b.domPath.slice(parent.length + 1)),
      )
      .map((node) => node.domPath);
  const shape = (paths: string[], depth = 0): unknown[] => {
    if (depth > 64) throw new Error("bound-topology-content-limit");
    return paths.flatMap((path): unknown[] => {
      const node = nodes.get(path);
      if (!node) throw new Error("bound-topology-content-node-missing");
      if (node.kind === "comment") return [];
      if (node.kind === "text") return [{ kind: "text", text: node.text }];
      const shadowChildren = directChildren(`${path}/shadow`);
      // Empty open roots also have an observable shadow: [] in semantics.
      // Custom elements are the only supported shadow hosts in this reader;
      // topology refuses any custom element without an open shadow root.
      const hasShadow = !!node.tag?.includes("-") || shadowChildren.length > 0;
      return [
        {
          kind: "element",
          tag: node.tag,
          attributes: node.attributes,
          children: shape(directChildren(path), depth + 1),
          ...(hasShadow ? { shadow: shape(shadowChildren, depth + 1) } : {}),
        },
      ];
    });
  };
  const semanticShape = (content: AssignedContent[]): unknown[] =>
    content.map((node) =>
      node.kind === "text"
        ? node
        : {
            kind: "element",
            tag: node.tag,
            attributes: node.attributes,
            children: semanticShape(node.children),
            ...(node.shadow ? { shadow: semanticShape(node.shadow) } : {}),
          },
    );
  const slots = topology.slots.filter(
    (slot) => slot.shadowHostDomPath === topology.hostDomPath,
  );
  if (
    !same(
      slots.map((slot) => ({
        path: slot.semanticPath,
        name: slot.name,
        assigned: shape(slot.assigned),
        fallback: shape(slot.fallback),
      })),
      semantics.slots.map((slot) => ({
        path: slot.path,
        name: slot.name,
        assigned: semanticShape(slot.assigned),
        fallback: semanticShape(slot.fallback),
      })),
    )
  )
    problems.push("bound-topology-slot-content-mismatch");
  return problems;
}

/** Reobserve the exact recorded semantic evidence on both sides of the visual
 * topology capture. Matching pixels alone must never authorize a stale ARIA,
 * native property or distributed-content observation. This is not AST binding. */
export async function captureBoundSourceTopology(
  page: Page,
  input: BoundTopologyInput,
): Promise<BoundTopologyResult> {
  const { topology, semantics } = input;
  const result: BoundTopologyResult = {
    status: "refused",
    problems: [],
    sourcePngSha256: topology.sourcePngSha256,
    sourceTreeSha256: topology.treeSha256,
    declarationSha256: semantics.declarationSha256,
    semanticObservationSha256: semantics.observationSha256,
    limitations: [
      "Topology-matched means only that the recorded semantic observation, live DOM topology, raw visual tree and source PNG matched within this bounded read window. It is not source AST-to-runtime binding or an accepted Contract.",
      "Source/declaration hashes identify the supplied bytes, not the installed implementation or source revision. Callers must independently pin source provenance.",
      "Native property values are bracketed by exact semantic observations; topology independently joins their element paths, tags and attributes, not property implementations.",
      "The semantic native/slot census covers the selected host's own open shadow tree; distributed content retains nested open-shadow structure. Event behavior, closed roots and arbitrary getter purity remain unproven.",
    ],
  };
  let monitor: JSHandle<ReturnType<typeof startMutationMonitor>> | undefined;
  let runtimeError = false;
  const onError = () => {
    runtimeError = true;
  };
  try {
    if (
      semantics.status !== "observed" ||
      semantics.problems.length ||
      !hashPattern.test(semantics.observationSha256) ||
      !hashPattern.test(semantics.declarationSha256) ||
      semanticHash(semantics.observation) !== semantics.observationSha256 ||
      semanticHash(semantics.declaration) !== semantics.declarationSha256
    )
      throw new Error("bound-semantic-evidence-invalid");
    if (
      semantics.sourcePngSha256 !== topology.sourcePngSha256 ||
      semantics.sourceTreeSha256 !== topology.treeSha256
    )
      throw new Error("bound-semantic-reference-mismatch");
    const reassessed = assessSemantics(
      semantics.declaration,
      semantics.observation,
      {
        valid: true,
        sourcePngSha256: topology.sourcePngSha256,
        sourceTreeSha256: topology.treeSha256,
      },
    );
    if (
      reassessed.status !== "observed" ||
      !same(reassessed.coverage, semantics.coverage)
    )
      throw new Error("bound-semantic-assessment-mismatch");
    // Continuous observation covers the gaps between the independently scoped
    // semantic and topology probes, including mutations reverted before a read.
    monitor = await page.evaluateHandle(
      `(() => { const __name = value => value; return (${startMutationMonitor.toString()})(); })()`,
    );
    page.on("pageerror", onError);
    const observe = () =>
      captureStableSemantics(
        page,
        [...topology.hostPath],
        semantics.declaration,
        topology.sourcePngSha256,
        input.quietMs,
      );
    const before = await observe();
    if (semanticHash(before) !== semantics.observationSha256)
      throw new Error("bound-semantic-before-mismatch");
    const captured = await captureSourceTopology(page, topology);
    if (
      captured.status !== "captured" ||
      captured.problems.length ||
      !captured.observation ||
      semanticHash(captured.observation) !== captured.observationSha256
    ) {
      result.problems.push(...captured.problems);
      throw new Error("bound-topology-capture-refused");
    }
    const after = await observe();
    if (semanticHash(after) !== semantics.observationSha256)
      throw new Error("bound-semantic-after-mismatch");
    result.problems.push(
      ...topologyJoinProblems(captured.observation, before),
      ...topologyJoinProblems(captured.observation, after),
    );
    if (!result.problems.length) {
      result.status = "topology-matched";
      result.topology = captured;
    }
  } catch (error) {
    result.problems.push(
      error instanceof Error && /^bound-[a-z-]+$/.test(error.message)
        ? error.message
        : "bound-topology-observation-failed",
    );
  } finally {
    if (monitor) {
      page.off("pageerror", onError);
      try {
        if (await monitor.evaluate((value) => value.stop()))
          result.problems.push("bound-source-mutated-during-window");
      } catch {
        result.problems.push("bound-source-monitor-failed");
      } finally {
        try {
          await monitor.dispose();
        } catch {
          result.problems.push("bound-source-monitor-failed");
        }
      }
    }
    if (runtimeError) result.problems.push("bound-source-runtime-error");
  }
  result.problems = [...new Set(result.problems)];
  if (result.problems.length) {
    result.status = "refused";
    delete result.topology;
  }
  return result;
}
