import { createHash } from "node:crypto";
import type { Page } from "playwright-core";
import type { CemDeclarationFacts } from "../extract/adapters/cem.js";

export type ScalarObservation =
  | { kind: "value"; value: string | number | boolean | null }
  | { kind: "undefined" | "missing" | "non-scalar" | "unreadable" };
export type AssignedContent =
  | { kind: "text"; text: string }
  | {
      kind: "element";
      tag: string;
      attributes: Record<string, string>;
      properties: Record<string, ScalarObservation>;
      children: AssignedContent[];
      shadow?: AssignedContent[];
    };
export interface SemanticObservation {
  problems: string[];
  hostTag: string;
  hostCount: number;
  shadowRoot: boolean;
  attributes: Record<string, string>;
  properties: Record<string, ScalarObservation>;
  slots: Array<{
    name: string;
    path: string;
    assigned: AssignedContent[];
    fallback: AssignedContent[];
  }>;
  nativeElements: Array<{
    path: string;
    tag: string;
    attributes: Record<string, string>;
    properties: Record<string, ScalarObservation>;
  }>;
}
export const semanticHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Observe before the visual capture splices hosts and slots out of its tree.
 * No intentional writes, guessed event wiring or inferred defaults. Component
 * getters are not sandboxed: detect observable side effects and refuse them. */
export async function observeSemantics(
  page: Page,
  hostPath: string[],
  declaration: CemDeclarationFacts,
): Promise<SemanticObservation> {
  const observe = ({
    hostPath,
    names,
  }: {
    hostPath: string[];
    names: string[];
  }): SemanticObservation => {
    let scope: Document | ShadowRoot | null = document;
    let host: Element | null = null;
    let hostCount = 0;
    for (const selector of hostPath) {
      const matches: NodeListOf<Element> | undefined =
        scope?.querySelectorAll(selector);
      hostCount = matches?.length ?? 0;
      host = hostCount === 1 ? matches![0] : null;
      scope = host?.shadowRoot ?? null;
      if (!host) break;
    }
    const attrs = (el: Element) =>
      Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]));
    const scalar = (el: Element, name: string): ScalarObservation => {
      try {
        if (!(name in el)) return { kind: "missing" };
        const value: unknown = Reflect.get(el, name);
        if (value === undefined) return { kind: "undefined" };
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          return { kind: "value", value };
        return { kind: "non-scalar" };
      } catch {
        return { kind: "unreadable" };
      }
    };
    const path = (el: Element): string => {
      const parts: number[] = [];
      let node: Element | null = el;
      while (node) {
        parts.unshift([...node.parentNode!.children].indexOf(node));
        node = node.parentElement;
      }
      return parts.join("/");
    };
    const shadow = host?.shadowRoot;
    const problems: string[] = [];
    const nativeNames = [
      "disabled",
      "checked",
      "indeterminate",
      "required",
      "type",
      "value",
    ];
    const nativeSelector = "button,input,select,textarea,a,label";
    const nativeProperties = (el: Element) => {
      const values = Object.fromEntries(
        (el.matches(nativeSelector) ? nativeNames : [])
          .filter((name) => name in el)
          .map((name) => [name, scalar(el, name)]),
      );
      for (const [name, value] of Object.entries(values))
        if (value.kind !== "value")
          problems.push(`native-property-unobserved:${el.localName}:${name}`);
      return values;
    };
    let remaining = 2000;
    const content = (
      nodes: NodeListOf<ChildNode> | Node[],
      depth = 0,
    ): AssignedContent[] => {
      const result: AssignedContent[] = [];
      for (const node of nodes) {
        if (node.nodeType !== Node.TEXT_NODE && !(node instanceof Element))
          continue;
        if (depth > 64 || --remaining < 0) {
          problems.push("assigned-content-observation-limit");
          break;
        }
        if (node instanceof Element) {
          result.push({
            kind: "element",
            tag: node.localName,
            attributes: attrs(node),
            properties: nativeProperties(node),
            children: content(node.childNodes, depth + 1),
            ...(node.shadowRoot
              ? { shadow: content(node.shadowRoot.childNodes, depth + 1) }
              : {}),
          });
        } else result.push({ kind: "text", text: node.textContent ?? "" });
      }
      return result;
    };
    const structure = () => {
      remaining = 2000;
      return {
        attributes: host ? attrs(host) : {},
        slots: [...(shadow?.querySelectorAll("slot") ?? [])].map((slot) => ({
          name: slot.name,
          path: path(slot),
          assigned: content(slot.assignedNodes({ flatten: false })),
          fallback: content(slot.childNodes),
        })),
        nativeElements: [
          ...(shadow?.querySelectorAll(nativeSelector) ?? []),
        ].map((el) => ({
          path: path(el),
          tag: el.localName,
          attributes: attrs(el),
          properties: nativeProperties(el),
        })),
      };
    };
    // Watch light DOM and open shadow roots. Attribute changes that a getter
    // reverts before returning must still invalidate this observation.
    const mutations = new MutationObserver(() => {});
    const watch = (root: Document | ShadowRoot) => {
      mutations.observe(root, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      });
      for (const el of root.querySelectorAll("*"))
        if (el.shadowRoot) watch(el.shadowRoot);
    };
    watch(document);
    const before = structure();
    const properties = host
      ? Object.fromEntries(names.map((name) => [name, scalar(host!, name)]))
      : {};
    const after = structure();
    if (
      mutations.takeRecords().length ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      problems.push("source-mutated-during-semantic-observation");
    mutations.disconnect();
    return {
      problems: [...new Set(problems)],
      hostTag: host?.localName ?? "",
      hostCount,
      shadowRoot: !!shadow,
      properties,
      ...after,
    };
  };
  // tsx preserves helper function names with __name. Keep that helper lexical
  // inside the serialized probe, never install globals in the source page.
  return page.evaluate(
    `(() => { const __name = value => value; return (${observe.toString()})(${JSON.stringify({ hostPath, names: declaration.properties.map((p) => p.name) })}); })()`,
  );
}

/** Bounded observation window, not proof that arbitrary getters are pure.
 * Bracket both probes with the same full-page source image used by the witness.
 * Keep exact runtime IDs; an unstable ID is a refusal, not a normalization. */
export async function captureStableSemantics(
  page: Page,
  hostPath: string[],
  declaration: CemDeclarationFacts,
  sourcePngSha256: string,
  quietMs = 500,
): Promise<SemanticObservation> {
  const pngHash = async () =>
    createHash("sha256")
      .update(await page.screenshot({ fullPage: true, caret: "initial" }))
      .digest("hex");
  // Keep this observer alive across asynchronous getter callbacks, including
  // semantic-only changes and changes reverted before the next observation.
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
      for (const el of root.querySelectorAll("*"))
        if (el.shadowRoot) watch(el.shadowRoot);
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
  let pageFailed = false;
  const onError = () => {
    pageFailed = true;
  };
  page.on("pageerror", onError);
  try {
    const beforePng = await pngHash();
    const first = await observeSemantics(page, hostPath, declaration);
    await page.waitForTimeout(quietMs);
    const second = await observeSemantics(page, hostPath, declaration);
    await page.waitForTimeout(quietMs);
    const afterPng = await pngHash();
    const mutations = await monitor.evaluate((m) =>
      (m as { stop(): number }).stop(),
    );
    return {
      ...second,
      problems: [
        ...new Set([
          ...first.problems,
          ...second.problems,
          ...(mutations ? ["source-mutated-during-semantic-window"] : []),
          ...(pageFailed ? ["semantic-source-runtime-error"] : []),
          ...(semanticHash(first) !== semanticHash(second)
            ? ["semantic-observation-not-stable"]
            : []),
          ...(beforePng !== sourcePngSha256 || afterPng !== sourcePngSha256
            ? ["semantic-source-image-not-stable"]
            : []),
        ]),
      ],
    };
  } finally {
    page.off("pageerror", onError);
    try {
      await monitor.evaluate((m) => (m as { stop(): number }).stop());
    } finally {
      await monitor.dispose();
    }
  }
}

export interface SemanticIntake {
  status: "observed" | "refused";
  problems: string[];
  limitations: string[];
  declaration: CemDeclarationFacts;
  observation: SemanticObservation;
  observationSha256: string;
  declarationSha256: string;
  sourceTreeSha256?: string;
  sourcePngSha256: string;
  coverage: {
    declaredProperties: number;
    observedScalarProperties: number;
    declaredSlots: number;
    renderedSlots: number;
    declaredEvents: number;
  };
}

/** An evidence boundary for contract proposals, NOT an accepted contract.
 * Absence in one state never proves a conditional slot does not exist. */
export function assessSemantics(
  declaration: CemDeclarationFacts,
  observation: SemanticObservation,
  reference: {
    valid: boolean;
    sourcePngSha256: string;
    sourceTreeSha256?: string;
  },
  declarationProblems: string[] = [],
): SemanticIntake {
  const problems = [...declarationProblems, ...observation.problems];
  const limitations: string[] = [];
  if (!reference.valid) problems.push("source-reference-invalid");
  if (!/^[a-f0-9]{64}$/.test(reference.sourcePngSha256))
    problems.push("source-image-identity-invalid");
  if (
    observation.hostCount !== 1 ||
    observation.hostTag !== declaration.tagName
  )
    problems.push("declared-host-does-not-match-source");
  if (!observation.shadowRoot) problems.push("open-shadow-root-unavailable");
  for (const property of declaration.properties) {
    const actual = observation.properties[property.name];
    const members = property.typeText
      ?.split("|")
      .map((member) => member.trim());
    const known = members?.every(
      (member) =>
        ["boolean", "string", "number", "null", "undefined"].includes(member) ||
        /^(['"])[^'"\\]*\1$/.test(member),
    );
    if (!actual || ["missing", "unreadable"].includes(actual.kind))
      problems.push(`declared-property-unobserved:${property.name}`);
    else if (actual.kind === "non-scalar") {
      if (known)
        problems.push(`declared-property-type-mismatch:${property.name}`);
      else limitations.push(`non-scalar-property:${property.name}`);
    }
    if (actual?.kind === "value") {
      if (!known)
        limitations.push(`type-not-runtime-checkable:${property.name}`);
      else if (
        !members!.some(
          (member) =>
            member === typeof actual.value ||
            (member === "null" && actual.value === null) ||
            (/^['"]/.test(member) && actual.value === member.slice(1, -1)),
        )
      )
        problems.push(`declared-property-type-mismatch:${property.name}`);
    }
    // undefined is an observed value, not permission to invent a default.
    if (property.default === undefined)
      limitations.push(`default-not-declared:${property.name}`);
  }
  const declaredSlots = new Set(declaration.slots.map((slot) => slot.name));
  const renderedSlots = new Set(observation.slots.map((slot) => slot.name));
  for (const slot of observation.slots)
    if (!declaredSlots.has(slot.name))
      problems.push(`rendered-slot-not-declared:${slot.name || "(default)"}`);
  for (const slot of declaredSlots)
    if (!renderedSlots.has(slot))
      limitations.push(
        `slot-not-rendered-in-this-state:${slot || "(default)"}`,
      );
  for (const event of declaration.events)
    limitations.push(`event-behavior-not-observed:${event.name}`);
  limitations.push(
    "Getter side effects are checked over a bounded observation window, not sandboxed or proven absent. Closed nested shadow roots and event behavior are not inspected.",
    "Declaration/runtime inventory does not establish prop-to-part bindings, complete variant coverage, interaction correctness or a generatable semantic contract.",
  );
  return {
    status: problems.length ? "refused" : "observed",
    problems: [...new Set(problems)],
    limitations,
    declaration,
    observation,
    observationSha256: semanticHash(observation),
    declarationSha256: semanticHash(declaration),
    sourcePngSha256: reference.sourcePngSha256,
    ...(reference.sourceTreeSha256
      ? { sourceTreeSha256: reference.sourceTreeSha256 }
      : {}),
    coverage: {
      declaredProperties: declaration.properties.length,
      observedScalarProperties: Object.values(observation.properties).filter(
        (value) => value.kind === "value" || value.kind === "undefined",
      ).length,
      declaredSlots: declaredSlots.size,
      renderedSlots: renderedSlots.size,
      declaredEvents: declaration.events.length,
    },
  };
}
