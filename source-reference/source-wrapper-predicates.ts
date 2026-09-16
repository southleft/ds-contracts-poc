/** A bounded AST reduction for render-time descendant queries. No source is
 * executed, no slot assignment is inferred, and no Contract channel is added. */
import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import {
  readLitTemplateBindings,
  type LitGuard,
  type LitTemplateInput,
} from "../extract/adapters/lit-template.js";
import type { RecordedSourceProgram, SourceModule } from "./source-program.js";
import type { SourceAnatomyIdentity } from "./source-bound-anatomy.js";
import type { TopologyResult, TopologyNode } from "./topology.js";

export interface SourceWrapperPredicateInput {
  /** Authenticated host identity; a digest alone does not authenticate source. */
  program: RecordedSourceProgram;
  expectedProgramSha256: string;
  source: LitTemplateInput;
}
export interface WrapperMemberIdentity {
  modulePath: string;
  moduleSha256: string;
  className: string;
  name: string;
  span: { start: number; end: number };
}
export interface WrapperCallIdentity {
  modulePath: string;
  moduleSha256: string;
  span: { start: number; end: number };
  raw: string;
  target: WrapperMemberIdentity | "native-query-selector";
}
export interface WrapperClassIdentity {
  modulePath: string;
  moduleSha256: string;
  className: string;
  span: { start: number; end: number };
  base?: {
    expression: string;
    span: { start: number; end: number };
    import?: {
      specifier: string;
      imported: string;
      local: string;
      span: { start: number; end: number };
      path?: string;
    };
  };
}
export interface SourceWrapperPredicate {
  wrapper: SourceAnatomyIdentity;
  status: "predicate-derived" | "refused";
  guard: LitGuard;
  /** Branch selection remains separate from this local wrapper condition. */
  remainingGuards: LitGuard[];
  renderMember?: WrapperMemberIdentity;
  members: WrapperMemberIdentity[];
  calls: WrapperCallIdentity[];
  normalForm?: {
    kind: "host-light-descendant-attribute";
    attribute: "slot";
    value?: string;
    selector: string;
  };
  returns?: { whenMatch: "true"; whenAbsent: "undefined" };
  problems: string[];
}
export interface SourceWrapperPredicates {
  version: 1;
  status: "predicates-observed" | "refused";
  acceptedContract: null;
  qualification: "render-snapshot-predicate-only";
  nativeQualification: "unqualified";
  source: {
    revision: string;
    programSha256: string;
    modulePath: string;
    moduleSha256: string;
    className: string;
  };
  assumptions: ["original-dispatch", "stable-native-query"];
  lineage: WrapperClassIdentity[];
  predicates: SourceWrapperPredicate[];
  problems: string[];
  limitations: string[];
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const hash = /^[a-f0-9]{64}$/;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const unwrap = (node: ts.Expression): ts.Expression => {
  while (ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
};
function fail(code: string): never {
  throw Error(`source-wrapper-${code}`);
}
function problem(error: unknown): string {
  return error instanceof Error &&
    /^source-wrapper-[a-z-]+$/.test(error.message)
    ? error.message
    : "source-wrapper-input-invalid";
}
type Parsed = { module: SourceModule; file: ts.SourceFile };
type Owner = Parsed & { cls: ts.ClassDeclaration };
type Constant = string | boolean | undefined;
// Only the Boolean/query term grammar used by the recorded helper is reduced.
// There are no variables, assignments, loops, arbitrary property reads or calls.
type Term =
  | { kind: "constant"; value: Constant }
  | { kind: "query" }
  | { kind: "not"; operand: Term }
  | { kind: "strict"; left: Term; right: Term; equal: boolean }
  | { kind: "if"; condition: Term; whenTrue: Term; whenFalse: Term };
const QUERY_MATCH = {};
function evaluate(term: Term, present: boolean): Constant | object | null {
  switch (term.kind) {
    case "constant":
      return term.value;
    case "query":
      return present ? QUERY_MATCH : null;
    case "not":
      return !evaluate(term.operand, present);
    case "strict":
      return (
        (evaluate(term.left, present) === evaluate(term.right, present)) ===
        term.equal
      );
    case "if":
      return evaluate(
        evaluate(term.condition, present) ? term.whenTrue : term.whenFalse,
        present,
      );
  }
}
function memberIdentity(
  owner: Owner,
  member: ts.ClassElement,
): WrapperMemberIdentity {
  return {
    modulePath: owner.module.path,
    moduleSha256: owner.module.sha256,
    className: owner.cls.name!.text,
    name: member.name?.getText(owner.file) ?? "(constructor)",
    span: { start: member.getStart(owner.file), end: member.end },
  };
}

/** Derive from exact local inheritance/import/member identities. Helper names
 * are ordinary lookup keys; their implementation must lower to this grammar. */
export function deriveSourceWrapperPredicates(
  input: SourceWrapperPredicateInput,
): SourceWrapperPredicates {
  const out: SourceWrapperPredicates = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "render-snapshot-predicate-only",
    nativeQualification: "unqualified",
    source: {
      revision: input?.program?.revision ?? "",
      programSha256: input?.expectedProgramSha256 ?? "",
      modulePath: input?.program?.entryPath ?? "",
      moduleSha256: input?.source?.sourceSha256 ?? "",
      className: input?.source?.className ?? "",
    },
    assumptions: ["original-dispatch", "stable-native-query"],
    lineage: [],
    predicates: [],
    problems: [],
    limitations: [
      "Host-authenticated source and observation bytes are required; matching hashes are consistency checks, not authority.",
      "Assumes the recorded methods receive original dispatch and the native query is stable for this render snapshot. Runtime overrides, transforms, controllers and external base implementations are not proved by this reducer.",
      "The query visits light-DOM descendant elements, including empty and nested elements. Assigned-node counts, visible ink and text content do not decide this predicate.",
      "Enclosing branch guards, native wrapper removal/layout, source mutation/update behavior and end-to-end equivalence remain unqualified. No public Boolean, accepted Contract or emitter permission is created.",
    ],
  };
  try {
    const { program, source } = input;
    if (
      program.version !== 1 ||
      !["recorded", "partial"].includes(program.status) ||
      !hash.test(input.expectedProgramSha256) ||
      program.digest !== input.expectedProgramSha256 ||
      sha(JSON.stringify({ ...program, digest: undefined })) !==
        program.digest ||
      !/^[a-f0-9]{40}$/.test(program.revision) ||
      program.className !== source.className ||
      !hash.test(source.sourceSha256) ||
      sha(source.source) !== source.sourceSha256 ||
      !(
        program.entryPath === source.modulePath ||
        program.entryPath.endsWith("/" + source.modulePath)
      ) ||
      !Array.isArray(program.modules) ||
      program.modules.length > 128 ||
      new Set(program.modules.map((m) => m.path)).size !==
        program.modules.length ||
      program.problems.some(
        (p) =>
          ![
            "external-import-resolution-unverified",
            "source-asset-dependencies-unverified",
          ].includes(p.code),
      )
    )
      fail("program-identity-invalid");
    const modules = new Map<string, Parsed>();
    for (const module of program.modules) {
      if (!hash.test(module.sha256) || sha(module.text) !== module.sha256)
        fail("module-bytes-changed");
      const file = ts.createSourceFile(
        module.path,
        module.text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      if (
        (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] })
          .parseDiagnostics.length
      )
        fail("source-syntax-invalid");
      modules.set(module.path, { module, file });
    }
    const entry = modules.get(program.entryPath);
    if (
      !entry ||
      entry.module.text !== source.source ||
      entry.module.sha256 !== source.sourceSha256
    )
      fail("entry-identity-invalid");
    const ownerAt = (parsed: Parsed, name: string): Owner => {
      const classes = parsed.file.statements.filter(
        (s): s is ts.ClassDeclaration =>
          ts.isClassDeclaration(s) && s.name?.text === name,
      );
      const records = parsed.module.classes.filter((c) => c.name === name);
      if (classes.length !== 1 || records.length !== 1)
        fail("class-identity-ambiguous");
      const cls = classes[0],
        record = records[0];
      const bases =
        cls.heritageClauses
          ?.filter((h) => h.token === ts.SyntaxKind.ExtendsKeyword)
          .flatMap((h) => h.types) ?? [];
      if (
        bases.length > 1 ||
        record.extends !== bases[0]?.expression.getText(parsed.file) ||
        (ts.canHaveDecorators(cls) && ts.getDecorators(cls)?.length) ||
        cls.members.some((m) => m.name && ts.isComputedPropertyName(m.name))
      )
        fail("class-shape-unqualified");
      const actual = cls.members.map((member) => {
        const modifiers = ts.canHaveModifiers(member)
          ? (ts.getModifiers(member) ?? [])
          : [];
        return {
          name: member.name?.getText(parsed.file) ?? "(constructor)",
          kind: ts.SyntaxKind[member.kind],
          visibility:
            modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ||
            (!!member.name && ts.isPrivateIdentifier(member.name))
              ? "private"
              : modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)
                ? "protected"
                : "public",
          static: modifiers.some((m) => m.kind === ts.SyntaxKind.StaticKeyword),
          span: { start: member.getStart(parsed.file), end: member.end },
          decorators: (ts.canHaveDecorators(member)
            ? (ts.getDecorators(member) ?? [])
            : []
          ).map((d) => d.expression.getText(parsed.file)),
        };
      });
      if (!same(actual, record.members)) fail("member-inventory-mismatch");
      return { ...parsed, cls };
    };
    const lineage: Owner[] = [];
    let nativeBase = false;
    let owner: Owner | undefined = ownerAt(entry, source.className);
    while (owner) {
      if (
        lineage.length >= 16 ||
        lineage.some(
          (o) =>
            o.module.path === owner!.module.path &&
            o.cls.name!.text === owner!.cls.name!.text,
        )
      )
        fail("inheritance-cycle");
      lineage.push(owner);
      const base: ts.Expression | undefined = owner.cls.heritageClauses?.find(
        (h) => h.token === ts.SyntaxKind.ExtendsKeyword,
      )?.types[0]?.expression;
      const classIdentity: WrapperClassIdentity = {
        modulePath: owner.module.path,
        moduleSha256: owner.module.sha256,
        className: owner.cls.name!.text,
        span: { start: owner.cls.getStart(owner.file), end: owner.cls.end },
        ...(base
          ? {
              base: {
                expression: base.getText(owner.file),
                span: { start: base.getStart(owner.file), end: base.end },
              },
            }
          : {}),
      };
      out.lineage.push(classIdentity);
      if (!base) break;
      if (!ts.isIdentifier(base)) fail("base-expression-unqualified");
      const local = owner.file.statements.filter(
        (s) => ts.isClassDeclaration(s) && s.name?.text === base.text,
      );
      const imports = owner.file.statements
        .filter(ts.isImportDeclaration)
        .flatMap((decl) => {
          const bindings = decl.importClause?.namedBindings;
          if (!bindings || !ts.isNamedImports(bindings)) return [];
          return bindings.elements
            .filter((b) => b.name.text === base.text)
            .map((binding) => ({ decl, binding }));
        });
      if (local.length + imports.length !== 1) fail("base-identity-ambiguous");
      if (local.length) {
        owner = ownerAt(owner, base.text);
        continue;
      }
      const { decl, binding } = imports[0];
      if (
        !ts.isStringLiteral(decl.moduleSpecifier) ||
        decl.importClause?.isTypeOnly ||
        binding.isTypeOnly
      )
        fail("base-import-unqualified");
      const imported = (binding.propertyName ?? binding.name).text;
      const specifier = decl.moduleSpecifier.text;
      const records = owner.module.imports.filter(
        (r) =>
          r.specifier === specifier &&
          r.bindings.some(
            (b) => b.local === base.text && b.imported === imported,
          ),
      );
      if (records.length !== 1) fail("base-import-identity-mismatch");
      const record = records[0];
      classIdentity.base!.import = {
        specifier,
        imported,
        local: base.text,
        span: { start: decl.getStart(owner.file), end: decl.end },
        ...(record.path ? { path: record.path } : {}),
      };
      if (record.kind === "external") {
        if (decl.moduleSpecifier.text !== "lit" || imported !== "LitElement")
          fail("external-base-unqualified");
        nativeBase = true;
        break;
      }
      if (!specifier.startsWith(".")) fail("base-import-identity-mismatch");
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(owner.module.path), specifier),
      );
      const candidates = /\.(?:ts|tsx|js|jsx)$/.test(resolved)
        ? [
            resolved,
            ...(/\.jsx?$/.test(resolved)
              ? [
                  resolved.replace(/\.jsx?$/, ".ts"),
                  resolved.replace(/\.jsx?$/, ".tsx"),
                ]
              : []),
          ]
        : !path.posix.extname(resolved)
          ? [
              resolved + ".ts",
              resolved + ".tsx",
              resolved + ".js",
              resolved + ".jsx",
              resolved + "/index.ts",
              resolved + "/index.tsx",
              resolved + "/index.js",
            ]
          : [];
      const available = candidates.filter((p) => modules.has(p));
      if (available.length !== 1 || available[0] !== record.path)
        fail("base-import-identity-mismatch");
      const next =
        record.kind === "local-code" && record.path
          ? modules.get(record.path)
          : undefined;
      if (!next) fail("base-source-unavailable");
      owner = ownerAt(next, imported);
      if (
        !ts
          .getModifiers(owner.cls)
          ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      )
        fail("base-export-unqualified");
    }
    if (!nativeBase) fail("native-base-unqualified");
    const entryOwner = lineage[0];
    const read = readLitTemplateBindings(source);
    if (read.status === "refused") fail("template-read-refused");
    const ast = new Map<string, ts.Node>();
    const index = (node: ts.Node) => {
      ast.set(`${node.getStart(entry.file)}:${node.end}`, node);
      ts.forEachChild(node, index);
    };
    index(entry.file);
    for (const template of read.templates.filter(
      (t) => t.role !== "returned" && t.guards.length,
    )) {
      const localGuards = template.guards.filter(
        (g) => g.expression.kind === "unsupported",
      );
      if (!localGuards.length) continue;
      for (const wrapper of template.roots.filter(
        (n) => n.kind === "element",
      )) {
        const row: SourceWrapperPredicate = {
          wrapper: {
            templateId: template.id,
            sourceNodeId: wrapper.id,
            sourceSpan: { ...wrapper.span },
          },
          status: "refused",
          guard: structuredClone(localGuards[0]),
          remainingGuards: structuredClone(
            template.guards.filter((g) => g !== localGuards[0]),
          ),
          members: [],
          calls: [],
          problems: [],
        };
        out.predicates.push(row);
        try {
          if (
            template.role !== "nested" ||
            !template.complete ||
            template.guardAlternatives ||
            template.unresolvedAncestorTemplateIds?.length ||
            localGuards.length !== 1 ||
            row.guard.when !== "truthy"
          )
            fail("wrapper-guard-unqualified");
          const guard = row.guard.expression,
            node = ast.get(`${guard.span.start}:${guard.span.end}`);
          if (
            !node ||
            !ts.isCallExpression(node) ||
            node.getText(entry.file) !== guard.raw
          )
            fail("guard-call-identity-invalid");
          let enclosing: ts.Node | undefined = node.parent;
          while (enclosing && !ts.isMethodDeclaration(enclosing))
            enclosing = enclosing.parent;
          if (!enclosing || enclosing.parent !== entryOwner.cls)
            fail("guard-owner-unqualified");
          row.renderMember = memberIdentity(entryOwner, enclosing);
          const active = new Set<string>(),
            selectors = new Set<string>();
          let budget = 128;
          const resolve = (name: string) => {
            const found = lineage.flatMap((o) =>
              o.cls.members
                .filter(
                  (m) =>
                    m.name &&
                    (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) &&
                    m.name.text === name,
                )
                .map((member) => ({ owner: o, member })),
            );
            if (found.length !== 1)
              fail(
                found.length
                  ? "member-override-ambiguous"
                  : "helper-unavailable",
              );
            const item = found[0];
            if (
              !ts.isMethodDeclaration(item.member) ||
              !item.member.body ||
              item.member.asteriskToken ||
              (ts.getModifiers(item.member) ?? []).some((m) =>
                [
                  ts.SyntaxKind.StaticKeyword,
                  ts.SyntaxKind.AsyncKeyword,
                ].includes(m.kind),
              ) ||
              ts.getDecorators(item.member)?.length ||
              item.member.parameters.length > 1 ||
              item.member.parameters.some(
                (p) =>
                  !ts.isIdentifier(p.name) || p.initializer || p.dotDotDotToken,
              )
            )
              fail("helper-shape-unqualified");
            return { owner: item.owner, member: item.member };
          };
          // Static construction of a single attribute selector: parameters,
          // literal strings and the helper's template/conditional are sufficient.
          const constant = (
            expression: ts.Expression,
            env: Map<string, Constant>,
          ): Constant => {
            const n = unwrap(expression);
            if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
              return n.text;
            if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
            if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
            if (ts.isIdentifier(n) && env.has(n.text)) return env.get(n.text);
            if (ts.isConditionalExpression(n))
              return constant(
                constant(n.condition, env) ? n.whenTrue : n.whenFalse,
                env,
              );
            if (ts.isTemplateExpression(n))
              return (
                n.head.text +
                n.templateSpans
                  .map((s) => {
                    const value = constant(s.expression, env);
                    if (typeof value !== "string")
                      fail("selector-value-unqualified");
                    return value + s.literal.text;
                  })
                  .join("")
              );
            fail("selector-expression-unqualified");
          };
          const recordCall = (
            o: Owner,
            call: ts.CallExpression,
            target: WrapperCallIdentity["target"],
          ) => {
            const value = {
              modulePath: o.module.path,
              moduleSha256: o.module.sha256,
              span: { start: call.getStart(o.file), end: call.end },
              raw: call.getText(o.file),
              target,
            };
            if (!row.calls.some((c) => same(c, value))) row.calls.push(value);
          };
          const lower = (
            expression: ts.Expression,
            o: Owner,
            env: Map<string, Constant>,
          ): Term => {
            if (--budget < 0) fail("reduction-budget");
            const n = unwrap(expression);
            if (
              ts.isPrefixUnaryExpression(n) &&
              n.operator === ts.SyntaxKind.ExclamationToken
            )
              return { kind: "not", operand: lower(n.operand, o, env) };
            if (
              ts.isBinaryExpression(n) &&
              [
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                ts.SyntaxKind.ExclamationEqualsEqualsToken,
              ].includes(n.operatorToken.kind)
            )
              return {
                kind: "strict",
                left: lower(n.left, o, env),
                right: lower(n.right, o, env),
                equal:
                  n.operatorToken.kind ===
                  ts.SyntaxKind.EqualsEqualsEqualsToken,
              };
            if (ts.isCallExpression(n)) {
              const callee = n.expression;
              if (
                n.questionDotToken ||
                n.typeArguments?.length ||
                !ts.isPropertyAccessExpression(callee) ||
                callee.questionDotToken ||
                callee.expression.kind !== ts.SyntaxKind.ThisKeyword ||
                !ts.isIdentifier(callee.name) ||
                n.arguments.length > 1
              )
                fail("call-shape-unqualified");
              const name = callee.name.text;
              const args = n.arguments.map((arg) => constant(arg, env));
              if (name === "querySelector") {
                if (
                  lineage.some((c) =>
                    c.cls.members.some(
                      (m) =>
                        m.name &&
                        m.name.getText(c.file).replace(/^['"]|['"]$/g, "") ===
                          name,
                    ),
                  )
                )
                  fail("native-query-overridden");
                if (
                  args.length !== 1 ||
                  typeof args[0] !== "string" ||
                  !/^\[slot(?:="[a-zA-Z0-9_-]+")?\]$/.test(args[0])
                )
                  fail("selector-unqualified");
                selectors.add(args[0]);
                recordCall(o, n, "native-query-selector");
                return { kind: "query" };
              }
              const target = resolve(name),
                identity = memberIdentity(target.owner, target.member);
              const key = JSON.stringify(identity);
              if (active.has(key)) fail("helper-recursion");
              if (!row.members.some((m) => same(m, identity)))
                row.members.push(identity);
              recordCall(o, n, identity);
              const next = new Map<string, Constant>();
              if (args.length > target.member.parameters.length)
                fail("helper-argument-unqualified");
              target.member.parameters.forEach((p, i) =>
                next.set((p.name as ts.Identifier).text, args[i]),
              );
              active.add(key);
              const result = body(target.member.body!, target.owner, next);
              active.delete(key);
              return result;
            }
            return { kind: "constant", value: constant(n, env) };
          };
          const body = (
            statement: ts.Statement,
            o: Owner,
            env: Map<string, Constant>,
          ): Term => {
            if (ts.isBlock(statement)) {
              if (statement.statements.length !== 1)
                fail("helper-statements-unqualified");
              return body(statement.statements[0], o, env);
            }
            if (ts.isReturnStatement(statement))
              return statement.expression
                ? lower(statement.expression, o, env)
                : { kind: "constant", value: undefined };
            if (ts.isIfStatement(statement))
              return {
                kind: "if",
                condition: lower(statement.expression, o, env),
                whenTrue: body(statement.thenStatement, o, env),
                whenFalse: statement.elseStatement
                  ? body(statement.elseStatement, o, env)
                  : { kind: "constant", value: undefined },
              };
            fail("helper-statements-unqualified");
          };
          const term = lower(node, entryOwner, new Map());
          if (
            selectors.size !== 1 ||
            evaluate(term, true) !== true ||
            evaluate(term, false) !== undefined
          )
            fail("predicate-return-shape-unqualified");
          // Obvious recorded writes invalidate original dispatch. Opaque runtime
          // effects remain the explicit assumption, not a claim of purity.
          const names = new Set([
            ...row.members.map((m) => m.name),
            "querySelector",
          ]);
          for (const o of lineage) {
            const writes = (n: ts.Node) => {
              const increment =
                (ts.isPrefixUnaryExpression(n) ||
                  ts.isPostfixUnaryExpression(n)) &&
                [
                  ts.SyntaxKind.PlusPlusToken,
                  ts.SyntaxKind.MinusMinusToken,
                ].includes(n.operator);
              if (
                (ts.isBinaryExpression(n) &&
                  n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
                  n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
                ts.isDeleteExpression(n) ||
                increment
              ) {
                const target = ts.isBinaryExpression(n)
                  ? unwrap(n.left)
                  : ts.isDeleteExpression(n)
                    ? unwrap(n.expression)
                    : unwrap(
                        (
                          n as
                            ts.PrefixUnaryExpression | ts.PostfixUnaryExpression
                        ).operand,
                      );
                if (
                  ts.isPropertyAccessExpression(target) &&
                  target.expression.kind === ts.SyntaxKind.ThisKeyword &&
                  names.has(target.name.text)
                )
                  fail("source-dispatch-mutated");
                if (
                  ts.isElementAccessExpression(target) &&
                  target.expression.kind === ts.SyntaxKind.ThisKeyword
                )
                  fail("source-dispatch-mutated");
              }
              ts.forEachChild(n, writes);
            };
            writes(o.cls);
          }
          const selector = [...selectors][0],
            value = /^\[slot="([^"]+)"\]$/.exec(selector)?.[1];
          row.normalForm = {
            kind: "host-light-descendant-attribute",
            attribute: "slot",
            ...(value === undefined ? {} : { value }),
            selector,
          };
          row.returns = { whenMatch: "true", whenAbsent: "undefined" };
          row.status = "predicate-derived";
        } catch (error) {
          row.problems.push(problem(error));
        }
      }
    }
    if (!out.predicates.length) fail("conditional-wrapper-unavailable");
    if (out.predicates.some((p) => p.status === "predicate-derived"))
      out.status = "predicates-observed";
  } catch (error) {
    out.problems.push(problem(error));
    for (const row of out.predicates) {
      row.status = "refused";
      delete row.normalForm;
      delete row.returns;
      row.problems.push("source-wrapper-request-refused");
    }
  }
  return out;
}

export interface SourceWrapperEvaluationInput extends SourceWrapperPredicateInput {
  wrapper: Pick<SourceAnatomyIdentity, "templateId" | "sourceNodeId">;
  topology: TopologyResult;
  expected: {
    sourceTreeSha256: string;
    sourcePngSha256: string;
    topologyObservationSha256: string;
  };
}
export interface SourceWrapperEvaluation {
  version: 1;
  status: "snapshot-predicate-observed" | "refused";
  acceptedContract: null;
  qualification: "render-snapshot-predicate-only";
  nativeQualification: "unqualified";
  predicate?: SourceWrapperPredicate;
  sourceProgramSha256: string;
  topologyObservationSha256: string;
  matches?: boolean;
  callResult?: { kind: "value"; value: true } | { kind: "undefined" };
  witnesses: string[];
  assumptions: SourceWrapperPredicates["assumptions"];
  problems: string[];
}

/** Re-derive the predicate and join an independent hash-pinned topology. The
 * answer is this local condition, not whether its enclosing branch rendered. */
export function evaluateSourceWrapperPredicate(
  input: SourceWrapperEvaluationInput,
): SourceWrapperEvaluation {
  const derived = deriveSourceWrapperPredicates(input);
  const out: SourceWrapperEvaluation = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    qualification: "render-snapshot-predicate-only",
    nativeQualification: "unqualified",
    sourceProgramSha256: derived.source.programSha256,
    topologyObservationSha256: input?.expected?.topologyObservationSha256 ?? "",
    witnesses: [],
    assumptions: derived.assumptions,
    problems: [],
  };
  try {
    const candidates = derived.predicates.filter(
      (p) =>
        p.wrapper.templateId === input.wrapper.templateId &&
        p.wrapper.sourceNodeId === input.wrapper.sourceNodeId,
    );
    if (
      derived.status !== "predicates-observed" ||
      candidates.length !== 1 ||
      candidates[0].status !== "predicate-derived"
    )
      fail("predicate-unavailable");
    out.predicate = candidates[0];
    const { topology, expected } = input,
      observation = topology.observation;
    if (
      topology.status !== "captured" ||
      topology.problems.length ||
      !observation ||
      ![
        expected.sourceTreeSha256,
        expected.sourcePngSha256,
        expected.topologyObservationSha256,
      ].every((value) => typeof value === "string" && hash.test(value)) ||
      topology.sourceTreeSha256 !== expected.sourceTreeSha256 ||
      topology.sourcePngSha256 !== expected.sourcePngSha256 ||
      topology.observationSha256 !== expected.topologyObservationSha256 ||
      sha(JSON.stringify(observation)) !== topology.observationSha256 ||
      observation.hostDomPath !== "host" ||
      !Array.isArray(observation.nodes) ||
      observation.nodes.length > 2000
    )
      fail("topology-identity-invalid");
    const nodes = new Map<string, TopologyNode>();
    for (const node of observation.nodes) {
      if (
        !object(node) ||
        typeof node.domPath !== "string" ||
        !/^host(?:\/(?:shadow\/)?(?:0|[1-9]\d*))*$/.test(node.domPath) ||
        nodes.has(node.domPath) ||
        !["element", "text", "comment"].includes(node.kind) ||
        (node.kind === "element" &&
          (!node.tag ||
            !object(node.attributes) ||
            Object.values(node.attributes).some((v) => typeof v !== "string")))
      )
        fail("topology-node-invalid");
      const shadow = node.domPath.lastIndexOf("/shadow/");
      if (
        (node.kind === "element" || node.shadowHostDomPath !== undefined) &&
        node.shadowHostDomPath !==
          (shadow < 0 ? undefined : node.domPath.slice(0, shadow))
      )
        fail("topology-shadow-identity-invalid");
      nodes.set(node.domPath, node);
    }
    if (
      nodes.get("host")?.kind !== "element" ||
      !nodes.has(observation.rootDomPath)
    )
      fail("topology-host-unavailable");
    for (const node of nodes.values()) {
      if (node.domPath === "host") continue;
      const parent = node.domPath.replace(/\/(?:shadow\/)?\d+$/, "");
      if (nodes.get(parent)?.kind !== "element")
        fail("topology-parent-unavailable");
    }
    const predicate = candidates[0].normalForm!;
    out.witnesses = observation.nodes
      .filter(
        (node) =>
          node.kind === "element" &&
          node.domPath !== "host" &&
          !node.domPath.includes("/shadow/") &&
          Object.hasOwn(node.attributes!, predicate.attribute) &&
          (predicate.value === undefined ||
            node.attributes![predicate.attribute] === predicate.value),
      )
      .map((node) => node.domPath);
    out.matches = out.witnesses.length > 0;
    out.callResult = out.matches
      ? { kind: "value", value: true }
      : { kind: "undefined" };
    out.status = "snapshot-predicate-observed";
  } catch (error) {
    out.witnesses = [];
    out.problems.push(problem(error));
  }
  return out;
}
