import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Browser, Page } from "playwright-core";
import {
  readLitTemplateBindings,
  type LitNode,
  type LitSpan,
  type LitTemplateInput,
} from "../extract/adapters/lit-template.js";
import type { SourceProfile, SourceObservation } from "./check.js";
import { observeSource, watchSourceFailures } from "./observe.js";
import { captureReference } from "./replay.js";
import {
  assessSemantics,
  captureStableSemantics,
  semanticHash,
  type SemanticIntake,
  type SemanticObservation,
} from "./semantics.js";

export type DifferentialValue =
  { kind: "value"; value: string | boolean } | { kind: "undefined" };
interface SourceTarget {
  sourceNodeId: string;
  sourceSpan: LitSpan;
}
export type BindingIntervention = SourceTarget &
  (
    | {
        kind: "property";
        name: string;
        values: DifferentialValue[];
        target: {
          path: string;
          tag: string;
          attribute: "aria-label" | "aria-disabled";
        };
      }
    | {
        kind: "slot-text";
        name: string;
        path: string;
        assignedDomPath: string;
        values: DifferentialValue[];
      }
  );
export interface BindingDifferentialInput {
  replay: {
    harPath: string;
    harSha256: string;
    url: string;
    profile: SourceProfile;
    viewport?: { width: number; height: number };
  };
  source: LitTemplateInput;
  semantics: SemanticIntake;
  intervention: BindingIntervention;
  quietMs?: number;
}
export interface BindingDifferentialOptions {
  /** Preserve actual probe images outside the JSON report. This is an artifact
   * sink, never an input to the dependency judgment or original answer key. */
  onImages?: (
    caseIndex: number,
    before: Buffer,
    after: Buffer,
  ) => void | Promise<void>;
}
export interface DifferentialCase {
  value: DifferentialValue;
  status: "observed" | "refused";
  problems: string[];
  before?: SemanticObservation;
  after?: SemanticObservation;
  beforeSha256?: string;
  afterSha256?: string;
  beforePngSha256?: string;
  afterPngSha256?: string;
  afterReadiness?: SourceObservation;
  interventionReceipt?: unknown;
}
export interface BindingDifferentialResult {
  version: 1;
  status: "dependency-observed" | "refused";
  acceptedContract: null;
  inputSha256: string;
  sourceSha256: string;
  declarationSha256: string;
  semanticObservationSha256: string;
  harSha256: string;
  intervention: BindingIntervention;
  denominator: number;
  observed: number;
  cases: DifferentialCase[];
  problems: string[];
  limitations: string[];
  digest: string;
}
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function fail(code: string): never {
  throw new Error(code);
}
const codeOf = (error: unknown) =>
  (error instanceof Error
    ? error.message.match(/\bdifferential-[a-z-]+\b/)?.[0]
    : undefined) ?? "differential-observation-failed";

function validateInput(input: BindingDifferentialInput) {
  const { source, semantics, intervention } = input;
  let url: URL;
  try {
    url = new URL(input.replay.url);
  } catch {
    fail("differential-replay-origin-refused");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.hash
  )
    fail("differential-replay-origin-refused");
  if (
    input.quietMs !== undefined &&
    (!Number.isFinite(input.quietMs) ||
      input.quietMs < 0 ||
      input.quietMs > 5000)
  )
    fail("differential-observation-window-invalid");
  if (
    semantics.status !== "observed" ||
    semantics.problems.length ||
    semanticHash(semantics.declaration) !== semantics.declarationSha256 ||
    semanticHash(semantics.observation) !== semantics.observationSha256 ||
    source.className !== semantics.declaration.className ||
    source.modulePath !== semantics.declaration.modulePath ||
    sha(source.source) !== source.sourceSha256 ||
    !/^[a-f0-9]{64}$/.test(input.replay.harSha256)
  )
    fail("differential-source-evidence-invalid");
  const reassessed = assessSemantics(
    semantics.declaration,
    semantics.observation,
    {
      valid: true,
      sourcePngSha256: semantics.sourcePngSha256,
      sourceTreeSha256: semantics.sourceTreeSha256,
    },
  );
  if (
    reassessed.status !== "observed" ||
    !same(reassessed.coverage, semantics.coverage)
  )
    fail("differential-semantic-assessment-invalid");
  const values = intervention.values;
  const strings =
    values.length === 2 &&
    values.every(
      (value) =>
        value.kind === "value" &&
        typeof value.value === "string" &&
        value.value.length > 0,
    ) &&
    semanticHash(values[0]) !== semanticHash(values[1]);
  const booleans =
    values.length === 3 &&
    values.some((value) => value.kind === "undefined") &&
    values.some((value) => value.kind === "value" && value.value === false) &&
    values.some((value) => value.kind === "value" && value.value === true);
  if (!strings && !booleans) fail("differential-value-domain-unsupported");
  const syntax = readLitTemplateBindings(source);
  const found: Array<Extract<LitNode, { kind: "element" }>> = [];
  for (const template of syntax.templates) {
    if (
      !template.complete ||
      template.role === "unresolved" ||
      template.guardAlternatives ||
      template.unresolvedAncestorTemplateIds?.length
    )
      continue;
    const walk = (nodes: LitNode[]) => {
      for (const node of nodes)
        if (node.kind === "element") {
          if (node.id === intervention.sourceNodeId) found.push(node);
          walk(node.children);
        }
    };
    walk(template.roots);
  }
  if (found.length !== 1) fail("differential-source-target-not-unique");
  const node = found[0];
  const spans: LitSpan[] = [node.span];
  if (intervention.kind === "property") {
    const declarations = semantics.declaration.properties.filter(
      (property) => property.name === intervention.name,
    );
    if (declarations.length !== 1 || declarations[0].readonly)
      fail("differential-property-not-writable-declaration");
    if (
      !["aria-label", "aria-disabled"].includes(
        intervention.target.attribute,
      ) ||
      (intervention.target.attribute === "aria-label" ? !strings : !booleans)
    )
      fail("differential-target-channel-unsupported");
    if (declarations[0].typeText !== (strings ? "string" : "boolean"))
      fail("differential-declared-type-unsupported");
    const attrs = node.attributes.filter(
      (attribute) =>
        attribute.name.toLowerCase() === intervention.target.attribute,
    );
    if (
      node.tag !== intervention.target.tag ||
      attrs.length !== 1 ||
      attrs[0].channel !== "attribute" ||
      attrs[0].parts.length !== 1 ||
      attrs[0].parts[0].kind !== "expression"
    )
      fail("differential-source-binding-unsupported");
    const expression = attrs[0].parts[0].expression;
    if (
      expression.kind !== "if-defined" ||
      expression.property !== intervention.name
    )
      fail("differential-source-binding-unsupported");
    spans.push(attrs[0].span, expression.span);
    const native = semantics.observation.nativeElements.filter(
      (element) => element.path === intervention.target.path,
    );
    if (native.length !== 1 || native[0].tag !== intervention.target.tag)
      fail("differential-native-target-not-unique");
  } else {
    if (
      !strings ||
      node.slot?.name !== intervention.name ||
      semantics.declaration.slots.filter(
        (slot) => slot.name === intervention.name,
      ).length !== 1
    )
      fail("differential-source-slot-unsupported");
    const slots = semantics.observation.slots.filter(
      (slot) =>
        slot.path === intervention.path && slot.name === intervention.name,
    );
    if (
      slots.length !== 1 ||
      !/^host(?:\/(?:shadow|0|[1-9][0-9]*))+$/.test(
        intervention.assignedDomPath,
      )
    )
      fail("differential-slot-target-not-unique");
  }
  if (!spans.some((span) => same(span, intervention.sourceSpan)))
    fail("differential-source-span-mismatch");
}

/** Called only on the newly created HAR-only context owned by this probe. */
async function intervene(
  page: Page,
  hostPath: string[],
  intervention: BindingIntervention,
  value: DifferentialValue,
) {
  const apply = ({
    hostPath,
    intervention,
    value,
  }: {
    hostPath: string[];
    intervention: BindingIntervention;
    value: DifferentialValue;
  }) => {
    function fail(code: string): never {
      throw new Error(code);
    }
    let scope: Document | ShadowRoot | null = document;
    let host: Element | undefined;
    for (const selector of hostPath) {
      const matches: NodeListOf<Element> | undefined =
        scope?.querySelectorAll(selector);
      if (matches?.length !== 1) fail("differential-host-not-unique");
      host = matches[0];
      scope = host.shadowRoot;
    }
    if (!host?.shadowRoot) fail("differential-host-shadow-unavailable");
    if (intervention.kind === "property") {
      let owner: object | null = host;
      let descriptor: PropertyDescriptor | undefined;
      while (owner && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(owner, intervention.name);
        owner = Object.getPrototypeOf(owner);
      }
      // A concrete source setter is required. Never shadow an inherited member
      // with a new own property, delete the API, or synthesize native disabled.
      if (!descriptor?.set) fail("differential-property-setter-unavailable");
      Reflect.apply(descriptor.set, host, [
        value.kind === "undefined" ? undefined : value.value,
      ]);
      return {
        kind: "source-property-setter",
        property: intervention.name,
        value,
      };
    }
    const parts = intervention.path.split("/");
    let parent: Element | ShadowRoot = host.shadowRoot;
    for (const part of parts) {
      if (!/^(0|[1-9][0-9]*)$/.test(part))
        fail("differential-slot-path-invalid");
      const next: Element | undefined = parent.children[Number(part)];
      if (!next) fail("differential-slot-path-invalid");
      parent = next;
    }
    if (
      !(parent instanceof HTMLSlotElement) ||
      (parent.getAttribute("name") ?? "") !== intervention.name
    )
      fail("differential-slot-target-not-unique");
    const assigned = parent.assignedNodes({ flatten: false });
    const textNodes = assigned.filter(
      (node) => node.nodeType === Node.TEXT_NODE,
    );
    if (textNodes.length !== 1) fail("differential-assigned-text-not-unique");
    let target: Node = host;
    for (const part of intervention.assignedDomPath.split("/").slice(1)) {
      const next =
        part === "shadow"
          ? target instanceof Element
            ? target.shadowRoot
            : null
          : target.childNodes[Number(part)];
      if (!next) fail("differential-assigned-dom-path-invalid");
      target = next;
    }
    if (
      target !== textNodes[0] ||
      value.kind !== "value" ||
      typeof value.value !== "string"
    )
      fail("differential-assigned-text-target-mismatch");
    const siblings = assigned
      .filter((node) => node !== target)
      .map((node) => ({
        kind: node.nodeType,
        text: node.textContent,
        ...(node instanceof Element
          ? { tag: node.localName, html: node.outerHTML }
          : {}),
      }));
    const before = target.textContent;
    (target as Text).data = value.value;
    return {
      kind: "assigned-text-data",
      domPath: intervention.assignedDomPath,
      before,
      after: value.value,
      preservedSiblings: siblings,
    };
  };
  return page.evaluate(
    `(() => { const __name = value => value; return (${apply.toString()})(${JSON.stringify({ hostPath, intervention, value })}); })()`,
  );
}

export function checkDependency(
  intervention: BindingIntervention,
  value: DifferentialValue,
  before: SemanticObservation,
  after: SemanticObservation,
  beforePng: string,
  afterPng: string,
): string[] {
  const problems: string[] = [];
  const expected = structuredClone(before);
  if (intervention.kind === "property") {
    expected.properties[intervention.name] = value;
    const native = expected.nativeElements.find(
      (element) => element.path === intervention.target.path,
    )!;
    if (value.kind === "undefined")
      delete native.attributes[intervention.target.attribute];
    else native.attributes[intervention.target.attribute] = String(value.value);
    const actual = after.nativeElements.filter(
      (element) => element.path === intervention.target.path,
    );
    if (
      actual.length !== 1 ||
      !same(after.properties[intervention.name], value) ||
      !same(
        actual[0]?.attributes[intervention.target.attribute],
        native.attributes[intervention.target.attribute],
      )
    )
      problems.push("differential-dependency-not-observed");
    if (!same(before.slots, after.slots))
      problems.push("differential-collateral-slot-change");
    if (
      intervention.target.attribute === "aria-label" &&
      beforePng !== afterPng
    )
      problems.push("differential-label-changed-visible-source");
  } else {
    const slot = expected.slots.find(
      (slot) =>
        slot.path === intervention.path && slot.name === intervention.name,
    )!;
    const text = slot.assigned.filter((node) => node.kind === "text");
    if (
      text.length !== 1 ||
      value.kind !== "value" ||
      typeof value.value !== "string"
    )
      return ["differential-assigned-text-not-unique"];
    text[0].text = value.value;
    if (beforePng === afterPng)
      problems.push("differential-slot-not-visually-observed");
  }
  if (!same(expected, after))
    problems.push("differential-unexpected-semantic-change");
  return problems;
}

/** A finite causal probe on disposable recorded-resource replays, not an
 * accepted Contract, complete API proof, or a replacement source answer key. */
export async function probeBindingDifferential(
  browser: Browser,
  original: BindingDifferentialInput,
  options: BindingDifferentialOptions = {},
): Promise<BindingDifferentialResult> {
  const input = structuredClone(original);
  const { replay, semantics, intervention } = input;
  const result: BindingDifferentialResult = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    inputSha256: semanticHash(input),
    sourceSha256: input.source.sourceSha256,
    declarationSha256: semantics.declarationSha256,
    semanticObservationSha256: semantics.observationSha256,
    harSha256: replay.harSha256,
    intervention,
    denominator: intervention.values.length,
    observed: 0,
    cases: intervention.values.map((value) => ({
      value,
      status: "refused",
      problems: ["differential-not-run"],
    })),
    problems: [],
    limitations: [
      "Observed dependency covers only these explicit input values and this exact source/HAR baseline. It does not prove every value, lifecycle, interaction, variant, getter or inherited behavior.",
      "Undefined is passed to the existing source setter; it is not deletion of the property, an invented API default, or proof of every omission path.",
      "Source span identity and runtime response are checked, but installed source authentication and structural AST-to-DOM matching remain caller responsibilities.",
      "Each intervention uses a disposable fresh HAR-only context. Changed images/semantics are probe evidence, never new approved source screenshots or grades.",
      "The bounded scope supports direct imported ifDefined property-to-ARIA bindings and explicitly identified single assigned text nodes. Other transformations and multiple targets are refused.",
    ],
    digest: "",
  };
  try {
    validateInput(input);
    for (const [caseIndex, row] of result.cases.entries()) {
      row.problems = [];
      let context: Awaited<ReturnType<Browser["newContext"]>> | undefined;
      let failures: ReturnType<typeof watchSourceFailures> | undefined;
      try {
        if (sha(readFileSync(replay.harPath)) !== replay.harSha256)
          fail("differential-har-identity-mismatch");
        context = await browser.newContext({
          viewport: replay.viewport ?? { width: 900, height: 600 },
          deviceScaleFactor: 1,
          colorScheme: "dark",
          serviceWorkers: "block",
        });
        await context.routeFromHAR(replay.harPath, {
          notFound: "abort",
          update: false,
        });
        await context.routeWebSocket("**/*", (socket) => socket.close());
        const page = await context.newPage();
        failures = watchSourceFailures(page);
        await page.goto(replay.url, { waitUntil: "load", timeout: 30000 });
        const reference = await captureReference(
          page,
          replay.profile,
          failures,
          input.quietMs,
        );
        row.beforePngSha256 = reference.secondSha256;
        if (
          reference.status !== "valid" ||
          reference.secondSha256 !== semantics.sourcePngSha256
        )
          fail("differential-original-reference-mismatch");
        const hostPath = [replay.profile.path[0]];
        row.before = await captureStableSemantics(
          page,
          hostPath,
          semantics.declaration,
          reference.secondSha256,
          input.quietMs,
        );
        row.beforeSha256 = semanticHash(row.before);
        if (row.beforeSha256 !== semantics.observationSha256)
          fail("differential-original-semantics-mismatch");
        row.interventionReceipt = await intervene(
          page,
          hostPath,
          intervention,
          row.value,
        );
        await page.waitForTimeout(input.quietMs ?? 500);
        await page.waitForFunction(
          () => document.fonts.status === "loaded",
          undefined,
          { timeout: 10000 },
        );
        const first = await page.screenshot({
          fullPage: true,
          caret: "initial",
        });
        await page.waitForTimeout(input.quietMs ?? 500);
        const second = await page.screenshot({
          fullPage: true,
          caret: "initial",
        });
        row.afterPngSha256 = sha(second);
        if (options.onImages) {
          try {
            await options.onImages(
              caseIndex,
              Buffer.from(reference.screenshot),
              Buffer.from(second),
            );
          } catch {
            fail("differential-image-artifact-failed");
          }
        }
        if (!first.equals(second))
          fail("differential-mutated-render-not-stable");
        row.afterReadiness = await observeSource(
          page,
          replay.profile,
          failures,
        );
        // Readiness can invoke component/native getters. Reobserve semantics
        // after it, against the changed image, rather than publish stale facts.
        row.after = await captureStableSemantics(
          page,
          hostPath,
          semantics.declaration,
          row.afterPngSha256,
          input.quietMs,
        );
        row.afterSha256 = semanticHash(row.after);
        if (row.after.problems.length)
          fail("differential-mutated-semantics-not-stable");
        const fonts = row.afterReadiness.platformFonts.filter(
          (font) => font.glyphCount > 0,
        );
        if (
          !row.afterReadiness.fontsReady ||
          !fonts.length ||
          fonts.some((font) => font.familyName !== replay.profile.fontFamily) ||
          failures.failedResources.length ||
          failures.runtimeErrors.length
        )
          fail("differential-mutated-source-unready");
        row.problems.push(
          ...checkDependency(
            intervention,
            row.value,
            row.before,
            row.after,
            row.beforePngSha256,
            row.afterPngSha256,
          ),
        );
        if (sha(readFileSync(replay.harPath)) !== replay.harSha256)
          fail("differential-har-identity-mismatch");
      } catch (error) {
        row.problems.push(codeOf(error));
      } finally {
        failures?.dispose();
        try {
          await context?.close();
        } catch {
          row.problems.push("differential-context-close-failed");
        }
      }
      row.problems = [...new Set(row.problems)];
      row.status = row.problems.length ? "refused" : "observed";
    }
    result.observed = result.cases.filter(
      (row) => row.status === "observed",
    ).length;
    result.problems.push(...result.cases.flatMap((row) => row.problems));
    if (result.observed === result.denominator)
      result.status = "dependency-observed";
  } catch (error) {
    result.problems.push(codeOf(error));
  }
  result.problems = [...new Set(result.problems)];
  result.digest = semanticHash({ ...result, digest: undefined });
  return result;
}
