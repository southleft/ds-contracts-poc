import ts from "typescript";
import { readReactChildren, type ReactChildrenFact } from "./react-children.js";
import { reactHelperCandidates, type ReactHelperCandidate } from "./react-helper-effects.js";
import { isReactContextExport } from "./react-context-export.js";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const sha = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
export type ReactTypeFact =
  | {
      kind:
        | "string"
        | "number"
        | "boolean"
        | "undefined"
        | "null"
        | "unknown"
        | "any"
        | "object"
        | "function";
      text: string;
    }
  | { kind: "literal"; value: string | number | boolean; text: string }
  | { kind: "union"; members: ReactTypeFact[]; text: string };
export interface ReactSourceProp {
  name: string;
  optional: boolean;
  type: ReactTypeFact;
  declaredIn: { file: string; start: number; end: number }[];
  /** Installed checker facts, not behavior inferred from the callback name.
   * Older archives omit this field and cannot establish a callback signature. */
  callbackSignatures?: Array<{
    parameters: Array<{
      name: string;
      optional: boolean;
      rest: boolean;
      type: ReactTypeFact;
    }>;
    typeParameters: number;
    returnsVoid: boolean;
  }>;
}
export interface ReactRootFact {
  kind: "host" | "component" | "conditional" | "unresolved";
  name?: string;
  module?: string;
  export?: string;
  condition?: string;
  whenTrue?: ReactRootFact;
  whenFalse?: ReactRootFact;
  reason?: string;
  /** A checker-resolved executable export, never a declaration-file guess. */
  definition?: { module: string; exportName: string; sourceSha256: string; span: { start: number; end: number } };
  dependencyProblem?: string;
}
export interface ReactSourceComponent {
  name: string;
  exportName: string;
  module: string;
  sourceSha256: string;
  /** Bounded binding/use proof for the observed implementation, not behavior. */
  implementation?: 'source-checked' | 'unresolved';
  /** Recognized React export wrapper; the span still identifies the complete declaration. */
  wrappers?: Array<"forwardRef">;
  span: { start: number; end: number };
  props: ReactSourceProp[];
  root: ReactRootFact;
  markers: { name: string; value: string }[];
  defaults: Record<string, string | number | boolean | null>;
  forwardedProps: string[];
  children: ReactChildrenFact;
  /** Possible contextual analysis sites. Never unconditional forwarding proof. */
  helperCandidates?: ReactHelperCandidate[];
  componentReferences: {
    span: { start: number; end: number };
    target: ReactRootFact;
  }[];
  problems: string[];
}
export interface ReactSourceProgram {
  version: 1;
  status: "observed" | "refused";
  acceptedContract: null;
  typescriptVersion: string;
  readerOptions: { ignoreDeprecations?: string; jsxDependencyEntries?: string[] };
  compatibilityNotes: string[];
  files: Record<string, string>;
  components: ReactSourceComponent[];
  /** Source-proven contexts remain distinct from component functions. Their
   * providers, consumers and behavior are not conversion-qualified here. */
  contextExports?: Array<{
    module: string;
    exportName: string;
    sourceSha256: string;
    span: { start: number; end: number };
  }>;
  problems: string[];
}

/** Read installed declarations and original JSX. This does not execute source,
 * generate behavior, adopt a contract, or infer an API from a DOM screenshot. */
export function readReactSourceProgram(
  root: string,
  modules: string[],
  options: { includeJsxDependencies?: boolean } = {},
): ReactSourceProgram {
  root = realpathSync(root);
  const result: ReactSourceProgram = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    typescriptVersion: ts.version,
    readerOptions: options.includeJsxDependencies ? { jsxDependencyEntries: [...modules] } : {},
    compatibilityNotes: [],
    files: {},
    components: [],
    problems: [],
  };
  const read = (file: string) => {
    try {
      const absolute = realpathSync(file);
      const bytes = readFileSync(absolute);
      const hash = sha(bytes);
      if (result.files[absolute] && result.files[absolute] !== hash)
        throw Error("source-program-input-changed");
      result.files[absolute] = hash;
      return bytes.toString("utf8");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "source-program-input-changed"
      )
        throw error;
      return undefined;
    }
  };
  const fail = (reason: string) => {
    result.problems.push(reason);
  };
  try {
    const config = ts.readConfigFile(path.join(root, "tsconfig.json"), read);
    if (config.error) throw Error("source-program-config-unreadable");
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      { ...ts.sys, readFile: read },
      root,
      { noEmit: true },
    );
    if (parsed.errors.length) throw Error("source-program-config-invalid");
    const entries = modules.map((module) =>
      realpathSync(path.resolve(root, module)),
    );
    if (entries.some((file) => !file.startsWith(root + path.sep)))
      throw Error("source-program-module-outside-root");
    const host = ts.createCompilerHost(parsed.options);
    host.readFile = read;
    let program = ts.createProgram(entries, parsed.options, host);
    // TypeScript 6 still reads legacy resolution options. A read-only adapter
    // may acknowledge their deprecation, but must retain the diagnostic and
    // never represent this as proof that the source's own build passes.
    const deprecations = program
      .getOptionsDiagnostics()
      .filter((d) => d.code === 5101);
    if (
      ts.versionMajorMinor.startsWith("6.") &&
      parsed.options.ignoreDeprecations === undefined &&
      deprecations.length
    ) {
      result.readerOptions.ignoreDeprecations = "6.0";
      result.compatibilityNotes = deprecations.map(
        (d) =>
          `Read-only TypeScript ${ts.version} compatibility: ${ts.flattenDiagnosticMessageText(d.messageText, " ")} Source build compatibility is unqualified.`,
      );
      program = ts.createProgram(
        entries,
        { ...parsed.options, ignoreDeprecations: "6.0" },
        host,
      );
    }
    const checker = program.getTypeChecker();
    for (const diagnostic of [
      ...program.getOptionsDiagnostics(),
      ...program.getGlobalDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ])
      fail(
        `${diagnostic.file ? path.relative(root, diagnostic.file.fileName) : "program"}:TS${diagnostic.code}:${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      );

    const text = (type: ts.Type) =>
      checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    const fact = (type: ts.Type, depth = 0): ReactTypeFact => {
      const printed = text(type);
      if (type.isUnion() && depth < 3)
        return {
          kind: "union",
          members: type.types.map((t) => fact(t, depth + 1)),
          text: printed,
        };
      if (type.isStringLiteral() || type.isNumberLiteral())
        return { kind: "literal", value: type.value, text: printed };
      if (type.flags & ts.TypeFlags.BooleanLiteral)
        return { kind: "literal", value: printed === "true", text: printed };
      const kinds: [ts.TypeFlags, ReactTypeFact["kind"]][] = [
        [ts.TypeFlags.Any, "any"],
        [ts.TypeFlags.Unknown, "unknown"],
        [ts.TypeFlags.Undefined, "undefined"],
        [ts.TypeFlags.Null, "null"],
        [ts.TypeFlags.String, "string"],
        [ts.TypeFlags.Number, "number"],
        [ts.TypeFlags.Boolean, "boolean"],
      ];
      for (const [flag, kind] of kinds)
        if (type.flags & flag) return { kind, text: printed } as ReactTypeFact;
      return {
        kind: type.getCallSignatures().length ? "function" : "object",
        text: printed,
      };
    };
    const literal = (
      node: ts.Expression,
    ): string | number | boolean | null | undefined => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        return node.text;
      if (ts.isNumericLiteral(node)) return Number(node.text);
      if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
      if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
      if (node.kind === ts.SyntaxKind.NullKeyword) return null;
      return undefined;
    };
    // Only JSX-referenced exports enter the dependency queue. Reading every
    // value in an imported module would confuse helpers with components and
    // pull unrelated exports into the runtime observation.
    const pending = [...new Set(entries)];
    const entryFiles = new Set(entries);
    const requested = new Map<string, Set<string>>(pending.map(file => [file, new Set()]));
    const readExports = new Map<string, Set<string>>();
    const unalias = (symbol: ts.Symbol) => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const valueExport = (symbol: ts.Symbol) => !!(unalias(symbol).flags & ts.SymbolFlags.Value) &&
      !symbol.declarations?.every(d => ts.isExportSpecifier(d) &&
        (d.isTypeOnly || (ts.isExportDeclaration(d.parent.parent) && d.parent.parent.isTypeOnly)));
    const stableDependencies = new Map<ts.Symbol, boolean>();
    const dependencyImplementationStable = (symbol: ts.Symbol, declaration: ts.Declaration): boolean => {
      const saved = stableDependencies.get(symbol);
      if (saved !== undefined) return saved;
      let stable = ts.isFunctionDeclaration(declaration) || (ts.isVariableDeclaration(declaration) &&
        ts.isVariableDeclarationList(declaration.parent) && !!(declaration.parent.flags & ts.NodeFlags.Const));
      const namespaceContains = (candidate: ts.Symbol | undefined, seen = new Set<ts.Symbol>()): boolean => {
        if (!candidate) return false;
        candidate = unalias(candidate);
        if (seen.has(candidate) || !(candidate.flags & (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule))) return false;
        seen.add(candidate);
        return checker.getExportsOfModule(candidate).some(e => valueExport(e) &&
          (unalias(e) === symbol || namespaceContains(e, seen)));
      };
      // An export object's current value is not proof of its original body.
      // Inspect its uses across the installed source graph, including callers
      // importing it under another name. JSX and import/export/type references
      // preserve identity; passing/storing/mutating the value does not.
      for (const source of program.getSourceFiles()) {
        if (!stable || source.isDeclarationFile) continue;
        let referenced = false, hasEval = false;
        const inspect = (node: ts.Node) => {
          if (ts.isTypeNode(node)) return;
          if (ts.isIdentifier(node) && node.text === 'eval') hasEval = true;
          if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
            const candidate = checker.getSymbolAtLocation(node);
            if (candidate && unalias(candidate) === symbol) {
              referenced = true;
              let use: ts.Node = node;
              if (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) use = node.parent;
              const parent = use.parent;
              const tag = (ts.isJsxOpeningElement(parent) || ts.isJsxClosingElement(parent) || ts.isJsxSelfClosingElement(parent)) && parent.tagName === use;
              const label = ts.isPropertyAccessExpression(parent) && parent.expression === use && parent.name.text === 'displayName' &&
                ts.isBinaryExpression(parent.parent) && parent.parent.left === parent &&
                parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                (ts.isStringLiteral(parent.parent.right) || ts.isNoSubstitutionTemplateLiteral(parent.parent.right));
              if (!(node === (declaration as ts.NamedDeclaration).name || tag || label ||
                ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isExportSpecifier(parent) ||
                (ts.isExportAssignment(parent) && !parent.isExportEquals && parent.expression === use))) stable = false;
            } else if (namespaceContains(candidate) || namespaceContains(checker.getTypeAtLocation(node).getSymbol())) {
              // An escaping namespace can expose this export to untyped code
              // without another symbol-level reference to the component.
              referenced = true;
              const parent = node.parent;
              if (!(ts.isNamespaceImport(parent) || ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) ||
                ts.isNamespaceExport(parent) || (ts.isPropertyAccessExpression(parent) && parent.expression === node))) stable = false;
            }
          }
          ts.forEachChild(node, inspect);
        };
        inspect(source);
        if (hasEval && referenced) stable = false;
      }
      stableDependencies.set(symbol, stable);
      return stable;
    };
    for (let fileIndex = 0; fileIndex < pending.length; fileIndex++) {
      const file = pending[fileIndex];
      const sf = program.getSourceFile(file);
      if (!sf) throw Error("source-program-module-unreadable");
      const moduleSymbol = checker.getSymbolAtLocation(sf);
      if (!moduleSymbol) {
        fail(`${path.relative(root, file)}:module-exports-unavailable`);
        continue;
      }
      const imports = new Map<string, { module: string; export: string }>();
      for (const stmt of sf.statements)
        if (
          ts.isImportDeclaration(stmt) &&
          ts.isStringLiteral(stmt.moduleSpecifier)
        ) {
          const c = stmt.importClause;
          if (c?.name)
            imports.set(c.name.text, {
              module: stmt.moduleSpecifier.text,
              export: "default",
            });
          if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings))
            imports.set(c.namedBindings.name.text, {
              module: stmt.moduleSpecifier.text,
              export: "*",
            });
          if (c?.namedBindings && ts.isNamedImports(c.namedBindings))
            for (const el of c.namedBindings.elements)
              imports.set(el.name.text, {
                module: stmt.moduleSpecifier.text,
                export: el.propertyName?.text ?? el.name.text,
              });
        }
      // Follow only direct immutable calls to the imported React factory. The
      // returned export remains the ownership identity; the inline callback is
      // the source body. Lookalike names and arbitrary higher-order functions
      // do not establish this relationship.
      const forwardRefBody = (
        declaration: ts.Declaration,
      ): ts.ArrowFunction | ts.FunctionExpression | undefined => {
        if (
          !ts.isVariableDeclaration(declaration) ||
          !ts.isVariableDeclarationList(declaration.parent) ||
          !(declaration.parent.flags & ts.NodeFlags.Const)
        )
          return undefined;
        const call = declaration.initializer;
        if (
          !call ||
          !ts.isCallExpression(call) ||
          call.arguments.length !== 1 ||
          (!ts.isArrowFunction(call.arguments[0]) &&
            !ts.isFunctionExpression(call.arguments[0]))
        )
          return undefined;
        const callee = call.expression;
        const namespace =
          ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "forwardRef" &&
          ts.isIdentifier(callee.expression)
            ? callee.expression
            : undefined;
        const direct = ts.isIdentifier(callee) ? callee : undefined;
        const binding = namespace ?? direct;
        if (!binding) return undefined;
        const symbol = checker.getSymbolAtLocation(binding);
        const imported = symbol?.declarations?.find((d) =>
          namespace
            ? ts.isNamespaceImport(d) || ts.isImportClause(d)
            : ts.isImportSpecifier(d) &&
              (d.propertyName ?? d.name).text === "forwardRef",
        );
        if (!imported) return undefined;
        let parent: ts.Node | undefined = imported;
        while (parent && !ts.isImportDeclaration(parent))
          parent = parent.parent;
        if (
          !parent ||
          !ts.isStringLiteral(parent.moduleSpecifier) ||
          parent.moduleSpecifier.text !== "react"
        )
          return undefined;
        // A factory/namespace that escapes or is replaced elsewhere in this
        // module no longer proves that React wrapped this body.
        const factoryBindings = new Map<
          ts.Symbol,
          { declaration: ts.Declaration; namespace: boolean }
        >();
        for (const statement of sf.statements) {
          if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            statement.moduleSpecifier.text !== "react" ||
            !statement.importClause
          )
            continue;
          const clause = statement.importClause;
          const add = (
            name: ts.Identifier,
            declaration: ts.Declaration,
            namespace: boolean,
          ) => {
            const importedSymbol = checker.getSymbolAtLocation(name);
            if (importedSymbol)
              factoryBindings.set(importedSymbol, { declaration, namespace });
          };
          if (clause.name) add(clause.name, clause, true);
          if (
            clause.namedBindings &&
            ts.isNamespaceImport(clause.namedBindings)
          )
            add(clause.namedBindings.name, clause.namedBindings, true);
          else if (clause.namedBindings)
            for (const specifier of clause.namedBindings.elements)
              if (
                (specifier.propertyName ?? specifier.name).text === "forwardRef"
              )
                add(specifier.name, specifier, false);
        }
        let escaped = false;
        const inspect = (node: ts.Node) => {
          const candidate = ts.isIdentifier(node)
            ? checker.getSymbolAtLocation(node)
            : undefined;
          const factoryBinding = candidate && factoryBindings.get(candidate);
          if (factoryBinding) {
            if (node.parent === factoryBinding.declaration) return;
            if (factoryBinding.namespace) {
              if (ts.isQualifiedName(node.parent)) return; // type-only namespace use
              if (
                !ts.isPropertyAccessExpression(node.parent) ||
                node.parent.expression !== node
              )
                escaped = true;
              else if (
                node.parent.name.text === "forwardRef" &&
                (!ts.isCallExpression(node.parent.parent) ||
                  node.parent.parent.expression !== node.parent)
              )
                escaped = true;
            } else if (
              !ts.isCallExpression(node.parent) ||
              node.parent.expression !== node
            )
              escaped = true;
          }
          ts.forEachChild(node, inspect);
        };
        inspect(sf);
        return escaped ? undefined : call.arguments[0];
      };
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const name = exported.getName();
        const wanted = requested.get(file);
        if (!wanted?.has(name) && (!entryFiles.has(file) || (!/^[A-Z]/.test(name) && name !== "default"))) continue;
        if (readExports.get(file)?.has(name)) continue;
        if (!readExports.has(file)) readExports.set(file, new Set());
        readExports.get(file)!.add(name);
        // Type-only re-exports may alias a value symbol, but emit no runtime
        // binding. Interfaces/type aliases likewise cannot identify a rendered
        // component. Keep unsupported VALUE exports on the named refusal path.
        if (
          exported.declarations?.length &&
          exported.declarations.every(
            (d) =>
              ts.isExportSpecifier(d) &&
              (d.isTypeOnly ||
                (ts.isExportDeclaration(d.parent.parent) &&
                  d.parent.parent.isTypeOnly)),
          )
        )
          continue;
        const symbol =
          exported.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exported)
            : exported;
        if (!(symbol.flags & ts.SymbolFlags.Value)) continue;
        const declaration = symbol.valueDeclaration;
        if (!declaration || declaration.getSourceFile() !== sf) {
          fail(`${name}:component-definition-outside-module`);
          continue;
        }
        if (isReactContextExport(declaration, checker)) {
          (result.contextExports ??= []).push({module:path.relative(root,file),exportName:name,
            sourceSha256:sha(sf.text),span:{start:declaration.getStart(sf),end:declaration.end}});
          continue;
        }
        // A default export keeps its actual module/export identity. Initially
        // admit only a local immutable binding whose initializer is read below;
        // export expressions, mutable bindings and function declarations remain
        // named refusals. Never rename source or synthesize a named export.
        if (
          name === "default" &&
          (!ts.isVariableDeclaration(declaration) ||
            !ts.isIdentifier(declaration.name) ||
            !ts.isVariableDeclarationList(declaration.parent) ||
            !(declaration.parent.flags & ts.NodeFlags.Const))
        ) {
          fail("default:component-binding-not-immutable");
          continue;
        }
        if (name === "default") {
          // Const protects the binding, not a forwardRef object's render field.
          // Follow only local uses that cannot replace the implementation. A
          // literal displayName assignment is metadata on the React wrapper.
          // Even JSX exposes the wrapper as element.type; without an escape
          // proof that is another mutable alias, not a safe rendering use.
          let escaped = false;
          const inspect = (node: ts.Node) => {
            if (ts.isIdentifier(node)) {
              // Direct eval can reach this module's binding without a symbol
              // reference. Its string contents are not static source evidence.
              if (node.text === "eval") escaped = true;
              let candidate = checker.getSymbolAtLocation(node);
              if (candidate && candidate.flags & ts.SymbolFlags.Alias)
                candidate = checker.getAliasedSymbol(candidate);
              if (candidate === symbol) {
                const parent = node.parent;
                const localExport =
                  ts.isExportSpecifier(parent) &&
                  ts.isExportDeclaration(parent.parent.parent) &&
                  !parent.parent.parent.moduleSpecifier;
                const defaultExport =
                  ts.isExportAssignment(parent) &&
                  !parent.isExportEquals &&
                  parent.expression === node;
                const label =
                  ts.isPropertyAccessExpression(parent) &&
                  parent.expression === node &&
                  parent.name.text === "displayName" &&
                  ts.isBinaryExpression(parent.parent) &&
                  parent.parent.left === parent &&
                  parent.parent.operatorToken.kind ===
                    ts.SyntaxKind.EqualsToken &&
                  (ts.isStringLiteral(parent.parent.right) ||
                    ts.isNoSubstitutionTemplateLiteral(parent.parent.right));
                if (
                  !(
                    ts.isVariableDeclaration(declaration) &&
                    node === declaration.name
                  ) &&
                  !localExport &&
                  !defaultExport &&
                  !label &&
                  !ts.isTypeQueryNode(parent)
                )
                  escaped = true;
              }
            }
            ts.forEachChild(node, inspect);
          };
          inspect(sf);
          if (escaped) {
            fail("default:component-value-mutation-or-escape");
            continue;
          }
        }
        const wrappedBody = forwardRefBody(declaration);
        const fn = ts.isFunctionDeclaration(declaration)
          ? declaration
          : ts.isVariableDeclaration(declaration) &&
              declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer))
            ? declaration.initializer
            : wrappedBody;
        const stableImplementation = options.includeJsxDependencies && !!fn?.body
          ? dependencyImplementationStable(symbol, declaration) : undefined;
        const unsafeDependency = !entryFiles.has(file) && !!fn?.body && stableImplementation === false;
        if (!fn?.body || unsafeDependency) {
          if (entryFiles.has(file)) fail(`${name}:component-function-unresolved`);
          else {
            const reason = unsafeDependency ? 'dependency-implementation-mutation-or-escape' : 'component-function-unresolved';
            result.components.push({
            name: symbol.getName(), exportName: name, module: path.relative(root, file),
            implementation: 'unresolved',
            sourceSha256: sha(sf.text), span: { start: declaration.getStart(sf), end: declaration.end },
            props: [], root: { kind: 'unresolved', reason },
            children: { kind: 'unresolved', reason },
            markers: [], defaults: {}, forwardedProps: [], componentReferences: [],
            // The export identity can be observed, but a value alias or
            // unsupported wrapper supplies no implementation/content proof.
            problems: [reason],
          });
          }
          continue;
        }
        const signature = checker
          .getTypeOfSymbolAtLocation(symbol, declaration)
          .getCallSignatures();
        const component: ReactSourceComponent = {
          name: symbol.getName(),
          exportName: name,
          module: path.relative(root, file),
          sourceSha256: sha(sf.text),
          ...(stableImplementation === undefined ? {} : { implementation: stableImplementation ? 'source-checked' as const : 'unresolved' as const }),
          ...(wrappedBody ? { wrappers: ["forwardRef" as const] } : {}),
          span: { start: declaration.getStart(sf), end: declaration.end },
          props: [],
          root: { kind: "unresolved", reason: "single-jsx-return-required" },
          markers: [],
          defaults: {},
          forwardedProps: [],
          children: {
            kind: "unresolved",
            reason: "single-jsx-root-unresolved",
          },
          componentReferences: [],
          problems: stableImplementation === false ? ['component-implementation-mutation-or-escape'] : [],
        };
        result.components.push(component);
        if (signature.length !== 1 || signature[0].parameters.length !== 1) {
          component.problems.push("component-props-signature-unresolved");
          continue;
        }
        const parameter = signature[0].parameters[0];
        const propsType = checker.getTypeOfSymbolAtLocation(parameter, fn);
        if (propsType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
          component.problems.push("component-props-type-unresolved");
        component.props = checker
          .getPropertiesOfType(propsType)
          .map((prop) => {
            const type = checker.getTypeOfSymbolAtLocation(prop, fn);
            const signatures = checker
              .getNonNullableType(type)
              .getCallSignatures();
            return {
              name: prop.getName(),
              optional: !!(prop.flags & ts.SymbolFlags.Optional),
              type: fact(type),
              ...(signatures.length
                ? {
                    callbackSignatures: signatures.map((signature) => ({
                      typeParameters: signature.typeParameters?.length ?? 0,
                      returnsVoid: !!(
                        checker.getReturnTypeOfSignature(signature).flags &
                        ts.TypeFlags.Void
                      ),
                      parameters: signature.parameters.map((parameter) => {
                        const declaration = parameter.valueDeclaration;
                        return {
                          name: parameter.getName(),
                          optional:
                            !!(parameter.flags & ts.SymbolFlags.Optional) ||
                            !!(
                              declaration &&
                              ts.isParameter(declaration) &&
                              (declaration.questionToken ||
                                declaration.initializer)
                            ),
                          rest: !!(
                            declaration &&
                            ts.isParameter(declaration) &&
                            declaration.dotDotDotToken
                          ),
                          type: fact(
                            checker.getTypeOfSymbolAtLocation(
                              parameter,
                              declaration ?? fn,
                            ),
                          ),
                        };
                      }),
                    })),
                  }
                : {}),
              declaredIn: (prop.declarations ?? []).map((d) => ({
                file: path.relative(root, d.getSourceFile().fileName),
                start: d.getStart(),
                end: d.end,
              })),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const prop of component.props) {
          const unresolved = (type: ReactTypeFact): boolean =>
            type.kind === "any" ||
            type.kind === "unknown" ||
            (type.kind === "union" && type.members.some(unresolved));
          if (unresolved(prop.type))
            component.problems.push(`unresolved-prop-type:${prop.name}`);
        }
        const binding = fn.parameters[0]?.name;
        if (binding && ts.isObjectBindingPattern(binding))
          for (const el of binding.elements)
            if (!el.dotDotDotToken && el.initializer) {
              const value = literal(el.initializer);
              if (value !== undefined)
                component.defaults[(el.propertyName ?? el.name).getText(sf)] =
                  value;
              else
                component.problems.push(
                  `nonliteral-default:${el.name.getText(sf)}`,
                );
            }
        const locals = new Map<string, ts.Expression>();
        const returns: ts.Expression[] = [];
        if (ts.isBlock(fn.body))
          for (const stmt of fn.body.statements) {
            if (
              ts.isVariableStatement(stmt) &&
              stmt.declarationList.flags & ts.NodeFlags.Const
            )
              for (const decl of stmt.declarationList.declarations)
                if (ts.isIdentifier(decl.name) && decl.initializer)
                  locals.set(decl.name.text, decl.initializer);
            if (ts.isReturnStatement(stmt) && stmt.expression)
              returns.push(stmt.expression);
            if (
              ts.isIfStatement(stmt) ||
              ts.isSwitchStatement(stmt) ||
              ts.isTryStatement(stmt)
            )
              component.problems.push(
                "component-return-control-flow-unresolved",
              );
          }
        else returns.push(fn.body);
        const unwrap = (node: ts.Expression): ts.Expression =>
          ts.isParenthesizedExpression(node) ||
          ts.isAsExpression(node) ||
          ts.isSatisfiesExpression(node)
            ? unwrap(node.expression)
            : node;
        const dependency = (node: ts.Expression, target: ReactRootFact): ReactRootFact => {
          if (!options.includeJsxDependencies) return target;
          const unavailable = (reason: string): ReactRootFact => {
            const problem = `jsx-dependency-${reason}:${node.getText(sf)}`;
            if (!component.problems.includes(problem)) component.problems.push(problem);
            return { ...target, dependencyProblem: reason };
          };
          const binding = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node);
          const resolved = binding && unalias(binding), declaration = resolved?.valueDeclaration;
          if (!resolved || !declaration || declaration.getSourceFile().isDeclarationFile)
            return unavailable('implementation-unavailable');
          const source = declaration.getSourceFile(), absolute = realpathSync(source.fileName);
          if (!absolute.startsWith(root + path.sep)) return unavailable('outside-source-root');
          const sourceModule = checker.getSymbolAtLocation(source);
          const exports = sourceModule ? checker.getExportsOfModule(sourceModule).filter(e => valueExport(e) && unalias(e) === resolved) : [];
          // One exported name, or the declaration's own exported name, gives a
          // deterministic runtime identity even through an import alias/barrel.
          const selected = exports.find(e => e.getName() === resolved.getName()) ?? (exports.length === 1 ? exports[0] : undefined);
          if (!selected) return unavailable(exports.length ? 'export-ambiguous' : 'runtime-export-unavailable');
          const exportName = selected.getName();
          if (!requested.has(absolute)) { requested.set(absolute, new Set([exportName])); pending.push(absolute); }
          else {
            const names = requested.get(absolute);
            if (names && !names.has(exportName)) { names.add(exportName); pending.push(absolute); }
          }
          return { ...target, definition: { module: path.relative(root, absolute), exportName,
            sourceSha256: sha(source.text), span: { start: declaration.getStart(source), end: declaration.end } } };
        };
        const resolve = (
          node: ts.Expression,
          seen = new Set<string>(),
        ): ReactRootFact => {
          node = unwrap(node);
          if (ts.isStringLiteral(node))
            return { kind: "host", name: node.text };
          if (ts.isConditionalExpression(node))
            return {
              kind: "conditional",
              condition: node.condition.getText(sf),
              whenTrue: resolve(node.whenTrue, seen),
              whenFalse: resolve(node.whenFalse, seen),
            };
          if (ts.isIdentifier(node) && locals.has(node.text)) {
            if (seen.has(node.text))
              return { kind: "unresolved", reason: "cyclic-root-alias" };
            return resolve(
              locals.get(node.text)!,
              new Set([...seen, node.text]),
            );
          }
          const parts = node.getText(sf).split(".");
          const imported = imports.get(parts[0]);
          if (imported)
            return dependency(node, {
              kind: "component",
              name: node.getText(sf),
              module: imported.module,
              export: [
                ...(imported.export === "*" ? [] : [imported.export]),
                ...parts.slice(1),
              ].join("."),
            });
          const localSymbol = checker.getSymbolAtLocation(node);
          if (
            localSymbol?.valueDeclaration &&
            ts.isFunctionDeclaration(localSymbol.valueDeclaration) &&
            localSymbol.valueDeclaration.getSourceFile() === sf
          )
            return dependency(node, {
              kind: "component",
              name: node.getText(sf),
              module: path.relative(root, file),
              export: localSymbol.getName(),
            });
          if (options.includeJsxDependencies && localSymbol?.valueDeclaration)
            return dependency(node, { kind: 'component', name: node.getText(sf) });
          return {
            kind: "unresolved",
            name: node.getText(sf),
            reason: "root-symbol-unresolved",
          };
        };
        const rootNode = returns.length === 1 ? unwrap(returns[0]) : undefined;
        if (
          rootNode &&
          (ts.isJsxElement(rootNode) || ts.isJsxSelfClosingElement(rootNode))
        ) {
          const helperCandidates = reactHelperCandidates(fn, checker);
          if (helperCandidates.length) component.helperCandidates = helperCandidates;
          component.children = component.problems.includes(
            "component-return-control-flow-unresolved",
          )
            ? { kind: "unresolved", reason: "children-control-flow-unresolved" }
            : readReactChildren(
                fn,
                rootNode,
                checker,
                component.props.some((p) => p.name === "children"),
              );
          const opening = ts.isJsxElement(rootNode)
            ? rootNode.openingElement
            : rootNode;
          component.root =
            ts.isIdentifier(opening.tagName) &&
            /^[a-z]/.test(opening.tagName.text)
              ? { kind: "host", name: opening.tagName.text }
              : resolve(opening.tagName as ts.Expression);
          const visitReferences = (node: ts.Node) => {
            if (
              ts.isJsxOpeningElement(node) ||
              ts.isJsxSelfClosingElement(node)
            ) {
              if (
                !ts.isIdentifier(node.tagName) ||
                !/^[a-z]/.test(node.tagName.text)
              )
                component.componentReferences.push({
                  span: { start: node.getStart(sf), end: node.end },
                  target: resolve(node.tagName as ts.Expression),
                });
            }
            ts.forEachChild(node, visitReferences);
          };
          visitReferences(rootNode);
          for (const attr of opening.attributes.properties) {
            if (ts.isJsxSpreadAttribute(attr))
              component.forwardedProps.push(attr.expression.getText(sf));
            else if (
              attr.initializer &&
              ts.isStringLiteral(attr.initializer) &&
              attr.name.getText(sf).startsWith("data-")
            )
              component.markers.push({
                name: attr.name.getText(sf),
                value: (attr.initializer as ts.StringLiteral).text,
              });
          }
        } else component.problems.push("single-jsx-root-unresolved");
      }
    }
    if (
      Object.entries(result.files).some(
        ([file, hash]) => sha(readFileSync(file)) !== hash,
      )
    )
      throw Error("source-program-input-changed");
    result.files = Object.fromEntries(
      Object.entries(result.files).sort(([a], [b]) => a.localeCompare(b)),
    );
    const resolvedRoot = (root: ReactRootFact): boolean =>
      root.kind !== "unresolved" &&
      (root.kind !== "conditional" ||
        (!!root.whenTrue &&
          !!root.whenFalse &&
          resolvedRoot(root.whenTrue) &&
          resolvedRoot(root.whenFalse)));
    if (
      !result.problems.length &&
      result.components.length &&
      result.components.every(
        (c) => c.problems.length === 0 && resolvedRoot(c.root),
      )
    )
      result.status = "observed";
  } catch (error) {
    fail(error instanceof Error ? error.message : "source-program-read-failed");
  }
  return result;
}

export function reactSourceProgramUnchanged(program: ReactSourceProgram) {
  try {
    return (
      Object.entries(program.files).length > 0 &&
      Object.entries(program.files).every(
        ([file, hash]) => sha(readFileSync(file)) === hash,
      )
    );
  } catch {
    return false;
  }
}
