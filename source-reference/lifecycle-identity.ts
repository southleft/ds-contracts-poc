/** Bounded equivalence of local DOM references, never blanket ID removal.
 * Source syntax authorizes a probe, not a runtime import or behavioral claim. */
import { createHash } from "node:crypto";
import ts from "typescript";
import { z } from "zod";
import type { BrowserContext, Page } from "playwright-core";
import type { CemDeclarationFacts } from "../extract/adapters/cem.js";
import type { LitTemplateInput } from "../extract/adapters/lit-template.js";
import type {
  SemanticObservation,
  ScalarObservation,
  AssignedContent,
} from "./semantics.js";

export interface LifecycleIdentityPolicy {
  version: 1;
  sourceSha256: string;
  className: string;
  tagName: string;
  properties: Array<{
    name: string;
    attribute?: string;
    start: number;
    end: number;
  }>;
}
export interface ReferenceIdentityObservation {
  policy: LifecycleIdentityPolicy;
  problems: string[];
  connections: Array<
    Record<
      string,
      {
        before: ScalarObservation;
        after: ScalarObservation;
        attributePresent: boolean;
      }
    >
  >;
  nodes: Array<{
    path: string;
    scope: string;
    tag: string;
    id: string;
    references: Record<string, string>;
  }>;
  outsideUses: string[];
}
const scalarSchema = z.union([
  z
    .object({
      kind: z.literal("value"),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["undefined", "missing", "non-scalar", "unreadable"]),
    })
    .strict(),
]);
export const referenceIdentitySchema = z
  .object({
    policy: z
      .object({
        version: z.literal(1),
        sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
        className: z.string(),
        tagName: z.string(),
        properties: z
          .array(
            z
              .object({
                name: z.string(),
                attribute: z.string().optional(),
                start: z.number().int().nonnegative(),
                end: z.number().int().positive(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    problems: z.array(z.string()),
    connections: z.array(
      z.record(
        z.string(),
        z
          .object({
            before: scalarSchema,
            after: scalarSchema,
            attributePresent: z.boolean(),
          })
          .strict(),
      ),
    ),
    nodes: z.array(
      z
        .object({
          path: z.string(),
          scope: z.string(),
          tag: z.string(),
          id: z.string(),
          references: z.record(z.string(), z.string()),
        })
        .strict(),
    ),
    outsideUses: z.array(z.string()),
  })
  .strict();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const referenceAttributes = ["for", "aria-labelledby", "aria-describedby"];

/** Recognize only direct fallback assignments to declared string properties
 * inside connectedCallback (including simple positive property guards).
 * Lexical resolution rejects shadowed imports. No component names/role maps. */
export function deriveLifecycleIdentityPolicy(
  input: LitTemplateInput,
  declaration: CemDeclarationFacts,
): LifecycleIdentityPolicy | undefined {
  if (
    hash(input.source) !== input.sourceSha256 ||
    input.className !== declaration.className ||
    input.modulePath !== declaration.modulePath
  )
    return;
  const fileName = "/identity.ts",
    file = ts.createSourceFile(
      fileName,
      input.source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
  const host: ts.CompilerHost = {
    getSourceFile: (n) => (n === fileName ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getDirectories: () => [],
    fileExists: (n) => n === fileName,
    readFile: (n) => (n === fileName ? input.source : undefined),
    getCanonicalFileName: (n) => n,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram(
    [fileName],
    { noLib: true, noResolve: true },
    host,
  );
  if (program.getSyntacticDiagnostics(file).length) return;
  const classes = file.statements.filter(
    (n): n is ts.ClassDeclaration =>
      ts.isClassDeclaration(n) && n.name?.text === input.className,
  );
  if (classes.length !== 1) return;
  const methods = classes[0].members.filter(
    (n): n is ts.MethodDeclaration =>
      ts.isMethodDeclaration(n) &&
      n.name.getText(file) === "connectedCallback" &&
      !n.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
  );
  if (methods.length !== 1 || !methods[0].body || methods[0].parameters.length)
    return;
  const checker = program.getTypeChecker();
  const property = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) &&
    !node.questionDotToken &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
      ? node.name.text
      : undefined;
  const properties: LifecycleIdentityPolicy["properties"] = [];
  const visit = (statement: ts.Statement) => {
    if (ts.isBlock(statement)) {
      statement.statements.forEach(visit);
      return;
    }
    if (
      ts.isIfStatement(statement) &&
      property(statement.expression) &&
      !statement.elseStatement
    ) {
      visit(statement.thenStatement);
      return;
    }
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isBinaryExpression(statement.expression)
    )
      return;
    const assignment = statement.expression,
      name = property(assignment.left),
      right = assignment.right;
    if (
      !name ||
      assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isBinaryExpression(right) ||
      right.operatorToken.kind !== ts.SyntaxKind.BarBarToken ||
      property(right.left) !== name ||
      !ts.isCallExpression(right.right) ||
      right.right.arguments.length ||
      !ts.isIdentifier(right.right.expression)
    )
      return;
    const declarations = checker.getSymbolAtLocation(
      right.right.expression,
    )?.declarations;
    if (declarations?.length !== 1 || !ts.isImportSpecifier(declarations[0]))
      return;
    const specifier = declarations[0],
      imported = specifier.parent.parent.parent;
    if (
      specifier.isTypeOnly ||
      specifier.parent.parent.isTypeOnly ||
      !ts.isImportDeclaration(imported) ||
      !ts.isStringLiteral(imported.moduleSpecifier) ||
      imported.moduleSpecifier.text !== "nanoid" ||
      (specifier.propertyName ?? specifier.name).text !== "nanoid"
    )
      return;
    const fields = declaration.properties.filter(
      (p) =>
        p.name === name &&
        !p.readonly &&
        p.typeText
          ?.split("|")
          .every((t) => ["string", "undefined"].includes(t.trim())),
    );
    if (fields.length !== 1) return;
    properties.push({
      name,
      ...(fields[0].attribute ? { attribute: fields[0].attribute } : {}),
      start: assignment.getStart(file),
      end: assignment.end,
    });
  };
  methods[0].body.statements.forEach(visit);
  if (
    !properties.length ||
    new Set(properties.map((p) => p.name)).size !== properties.length
  )
    return;
  return {
    version: 1,
    sourceSha256: input.sourceSha256,
    className: input.className,
    tagName: declaration.tagName,
    properties,
  };
}

const probeKey = "__dsContractsLifecycleIdentityV1";
/** Install before navigation. Retain records in a private WeakMap; source code
 * cannot write the returned observations back into it. Callback delegates once
 * with unchanged receiver/arguments. Instrumentation is explicit in receipts. */
export async function installLifecycleIdentityProbe(
  context: BrowserContext,
  policy: LifecycleIdentityPolicy,
) {
  const install = ({
    policy,
    key,
  }: {
    policy: LifecycleIdentityPolicy;
    key: string;
  }) => {
    const records = new WeakMap<
      Element,
      ReferenceIdentityObservation["connections"]
    >();
    const problems: string[] = [];
    const scalar = (el: any, name: string): ScalarObservation => {
      try {
        const value = el[name];
        return value === undefined
          ? { kind: "undefined" }
          : value === null ||
              ["string", "boolean", "number"].includes(typeof value)
            ? { kind: "value", value }
            : { kind: "non-scalar" };
      } catch {
        return { kind: "unreadable" };
      }
    };
    if (Object.hasOwn(window, key)) throw Error("identity-probe-key-collision");
    Object.defineProperty(window, key, {
      value: (element: Element) =>
        structuredClone({
          policy,
          problems: [...problems],
          connections: records.get(element) ?? [],
        }),
      writable: false,
      configurable: false,
    });
    const define = customElements.define;
    customElements.define = function (name, constructor, options) {
      if (name === policy.tagName) {
        const original = constructor.prototype.connectedCallback;
        if (typeof original !== "function")
          problems.push("identity-callback-unavailable");
        else
          Object.defineProperty(constructor.prototype, "connectedCallback", {
            configurable: true,
            writable: true,
            value: function (this: Element, ...args: unknown[]) {
              const connection = Object.fromEntries(
                policy.properties.map((p) => [
                  p.name,
                  {
                    before: scalar(this, p.name),
                    after: { kind: "unreadable" } as ScalarObservation,
                    attributePresent:
                      !!p.attribute && this.hasAttribute(p.attribute),
                  },
                ]),
              );
              const result = Reflect.apply(original, this, args);
              for (const p of policy.properties)
                connection[p.name].after = scalar(this, p.name);
              const previous = records.get(this) ?? [];
              previous.push(connection);
              records.set(this, previous);
              return result;
            },
          });
      }
      return Reflect.apply(define, this, [name, constructor, options]);
    };
  };
  await context.addInitScript({
    content: `(()=>{const __name=value=>value;(${install.toString()})(${JSON.stringify({ policy, key: probeKey })})})()`,
  });
}

export async function observeReferenceIdentity(
  page: Page,
  hostPath: string[],
): Promise<ReferenceIdentityObservation | undefined> {
  const observe = ({
    selectors,
    key,
  }: {
    selectors: string[];
    key: string;
  }) => {
    const probe = (window as any)[key];
    if (typeof probe !== "function") return;
    let root: Document | ShadowRoot | null = document,
      host: Element | undefined;
    for (const selector of selectors) {
      const found: NodeListOf<Element> | undefined =
        root?.querySelectorAll(selector);
      host = found?.length === 1 ? found[0] : undefined;
      root = host?.shadowRoot ?? null;
    }
    if (!host || !root) throw Error("identity-host-not-unique");
    const observation = probe(host) as ReferenceIdentityObservation;
    observation.nodes = [];
    observation.outsideUses = [];
    const attrs = ["for", "aria-labelledby", "aria-describedby"];
    const ids = new Set(
      observation.policy.properties
        .map((p) => {
          const value = (host as any)[p.name];
          return typeof value === "string" ? value : "";
        })
        .filter(Boolean),
    );
    const local = new Set<Element>();
    let budget = 4000;
    const walk = (scope: ShadowRoot, scopePath: string) => {
      const visit = (parent: ParentNode, path: string) => {
        [...parent.children].forEach((element, index) => {
          if (--budget < 0) return;
          const p = path + "/" + index;
          local.add(element);
          observation.nodes.push({
            path: p,
            scope: scopePath,
            tag: element.localName,
            id: element.id,
            references: Object.fromEntries(
              attrs
                .filter((a) => element.hasAttribute(a))
                .map((a) => [a, element.getAttribute(a)!]),
            ),
          });
          visit(element, p);
          if (element.shadowRoot) walk(element.shadowRoot, p + "::shadow");
        });
      };
      visit(scope, scopePath);
    };
    walk(root as ShadowRoot, "host::shadow");
    const outside = (scope: Document | ShadowRoot) => {
      for (const el of scope.querySelectorAll("*")) {
        if (--budget < 0) break;
        if (!local.has(el)) {
          if (ids.has(el.id))
            observation.outsideUses.push("id:" + el.localName + ":" + el.id);
          for (const attr of attrs)
            for (const value of (el.getAttribute(attr) ?? "").split(/\s+/))
              if (ids.has(value))
                observation.outsideUses.push(
                  attr + ":" + el.localName + ":" + value,
                );
        }
        if (el.shadowRoot) outside(el.shadowRoot);
      }
    };
    outside(document);
    if (budget < 0) observation.problems.push("identity-inventory-limit");
    return observation;
  };
  return page.evaluate(
    `(()=>{const __name=value=>value;return (${observe.toString()})(${JSON.stringify({ selectors: hostPath, key: probeKey })})})()`,
  );
}

/** Pure comparison view. Every raw value stays in the receipt. Identity proof
 * is usable only with the host-derived policy from the pinned source bytes. */
export function comparableSemantics(
  observation: SemanticObservation,
  policy?: LifecycleIdentityPolicy,
): SemanticObservation {
  const copy = structuredClone(observation),
    evidence = copy.referenceIdentity;
  if (!evidence) return copy;
  if (!referenceIdentitySchema.safeParse(evidence).success)
    throw Error("semantic-identity-shape-invalid");
  const refuse = (code: string): never => {
    throw Error("semantic-identity-" + code);
  };
  if (!policy || !same(evidence.policy, policy)) refuse("policy-mismatch");
  if (
    evidence.problems.length ||
    evidence.connections.length !== 1 ||
    evidence.outsideUses.length
  )
    refuse("provenance-unavailable");
  const connection = evidence.connections[0];
  if (
    !same(
      Object.keys(connection).sort(),
      policy!.properties.map((p) => p.name).sort(),
    )
  )
    refuse("properties-mismatch");
  const paths = new Set<string>(),
    byScope = new Map<string, Map<string, typeof evidence.nodes>>();
  for (const node of evidence.nodes) {
    if (paths.has(node.path) || !node.path.startsWith(node.scope + "/"))
      refuse("node-path-invalid");
    paths.add(node.path);
    let ids = byScope.get(node.scope);
    if (!ids) byScope.set(node.scope, (ids = new Map()));
    if (node.id) ids.set(node.id, [...(ids.get(node.id) ?? []), node]);
  }
  for (const ids of byScope.values())
    for (const nodes of ids.values())
      if (nodes.length !== 1) refuse("duplicate-id");
  for (const node of evidence.nodes)
    for (const [attribute, value] of Object.entries(node.references)) {
      if (!referenceAttributes.includes(attribute) || !value.trim())
        refuse("reference-invalid");
      const tokens = value.trim().split(/\s+/);
      if (attribute === "for" && (node.tag !== "label" || tokens.length !== 1))
        refuse("reference-unsupported");
      for (const token of tokens)
        if (byScope.get(node.scope)?.get(token)?.length !== 1)
          refuse("reference-unresolved");
    }
  // The independent graph must describe the SAME elements as the semantic
  // receipt. A stale graph cannot conceal a broken label/help-text edge.
  const checkElement = (
    path: string,
    tag: string,
    attributes: Record<string, string>,
  ) => {
    const node = evidence.nodes.find((n) => n.path === path);
    if (
      !node ||
      node.tag !== tag ||
      node.id !== (attributes.id ?? "") ||
      !same(
        node.references,
        Object.fromEntries(
          referenceAttributes
            .filter((a) => a in attributes)
            .map((a) => [a, attributes[a]]),
        ),
      )
    )
      refuse("graph-observation-mismatch");
  };
  const checkContent = (items: AssignedContent[], parent: string) => {
    let index = 0;
    for (const item of items)
      if (item.kind === "element") {
        const path = parent + "/" + index++;
        checkElement(path, item.tag, item.attributes);
        checkContent(item.children, path);
        if (item.shadow) checkContent(item.shadow, path + "::shadow");
      }
  };
  for (const node of copy.nativeElements)
    checkElement("host::shadow/" + node.path, node.tag, node.attributes);
  for (const slot of copy.slots)
    checkContent(slot.fallback, "host::shadow/" + slot.path);
  const aliases = new Map<string, string>();
  for (const p of policy!.properties) {
    const proof = connection[p.name],
      actual = copy.properties[p.name];
    if (!same(proof.after, actual)) refuse("lifecycle-value-changed");
    if (proof.before.kind !== "undefined" || proof.attributePresent) continue;
    if (
      actual?.kind !== "value" ||
      typeof actual.value !== "string" ||
      !actual.value ||
      /\s/.test(actual.value)
    )
      continue;
    const id = actual.value;
    const nodes = evidence.nodes.filter((n) => n.id === id);
    if (
      nodes.length !== 1 ||
      nodes[0].scope !== "host::shadow" ||
      aliases.has(id)
    )
      refuse("owner-not-unique");
    if (
      !evidence.nodes.some(
        (n) =>
          n.scope === nodes[0].scope &&
          Object.values(n.references).some((v) =>
            v.trim().split(/\s+/).includes(id),
          ),
      )
    )
      refuse("reference-missing");
    aliases.set(id, `\u0000lifecycle:${p.name}:${nodes[0].path}`);
  }
  const attrs = (attributes: Record<string, string>) => {
    if (attributes.id && aliases.has(attributes.id))
      attributes.id = aliases.get(attributes.id)!;
    for (const key of referenceAttributes)
      if (key in attributes)
        attributes[key] = attributes[key].replace(
          /\S+/g,
          (v) => aliases.get(v) ?? v,
        );
  };
  const content = (nodes: AssignedContent[]) => {
    for (const n of nodes)
      if (n.kind === "element") {
        attrs(n.attributes);
        content(n.children);
        if (n.shadow) content(n.shadow);
      }
  };
  for (const p of policy!.properties) {
    const actual = copy.properties[p.name];
    if (
      actual?.kind === "value" &&
      typeof actual.value === "string" &&
      aliases.has(actual.value)
    ) {
      actual.value = aliases.get(actual.value)!;
      connection[p.name].after = structuredClone(actual);
    }
  }
  // Host attributes are never normalized: a supplied host ID remains exact.
  for (const node of copy.nativeElements) attrs(node.attributes);
  for (const slot of copy.slots) {
    content(slot.assigned);
    content(slot.fallback);
  }
  for (const node of evidence.nodes) {
    node.id = aliases.get(node.id) ?? node.id;
    attrs(node.references);
  }
  return copy;
}

export function semanticReplayMatches(
  source: SemanticObservation,
  replay: SemanticObservation,
  policy?: LifecycleIdentityPolicy,
): boolean {
  try {
    return same(
      comparableSemantics(source, policy),
      comparableSemantics(replay, policy),
    );
  } catch {
    return false;
  }
}
