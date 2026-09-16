import ts from "typescript";
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
}
export interface ReactSourceComponent {
  name: string;
  exportName: string;
  module: string;
  sourceSha256: string;
  span: { start: number; end: number };
  props: ReactSourceProp[];
  root: ReactRootFact;
  markers: { name: string; value: string }[];
  defaults: Record<string, string | number | boolean | null>;
  forwardedProps: string[];
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
  readerOptions: { ignoreDeprecations?: string };
  compatibilityNotes: string[];
  files: Record<string, string>;
  components: ReactSourceComponent[];
  problems: string[];
}

/** Read installed declarations and original JSX. This does not execute source,
 * generate behavior, adopt a contract, or infer an API from a DOM screenshot. */
export function readReactSourceProgram(
  root: string,
  modules: string[],
): ReactSourceProgram {
  root = realpathSync(root);
  const result: ReactSourceProgram = {
    version: 1,
    status: "refused",
    acceptedContract: null,
    typescriptVersion: ts.version,
    readerOptions: {},
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
    for (const file of entries) {
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
      for (const exported of checker.getExportsOfModule(moduleSymbol)) {
        const name = exported.getName();
        if (!/^[A-Z]/.test(name)) continue;
        const symbol =
          exported.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(exported)
            : exported;
        const declaration = symbol.valueDeclaration;
        if (!declaration || declaration.getSourceFile() !== sf) {
          fail(`${name}:component-definition-outside-module`);
          continue;
        }
        const fn = ts.isFunctionDeclaration(declaration)
          ? declaration
          : ts.isVariableDeclaration(declaration) &&
              declaration.initializer &&
              (ts.isArrowFunction(declaration.initializer) ||
                ts.isFunctionExpression(declaration.initializer))
            ? declaration.initializer
            : undefined;
        if (!fn?.body) {
          fail(`${name}:component-function-unresolved`);
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
          span: { start: declaration.getStart(sf), end: declaration.end },
          props: [],
          root: { kind: "unresolved", reason: "single-jsx-return-required" },
          markers: [],
          defaults: {},
          forwardedProps: [],
          componentReferences: [],
          problems: [],
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
          .map((prop) => ({
            name: prop.getName(),
            optional: !!(prop.flags & ts.SymbolFlags.Optional),
            type: fact(checker.getTypeOfSymbolAtLocation(prop, fn)),
            declaredIn: (prop.declarations ?? []).map((d) => ({
              file: path.relative(root, d.getSourceFile().fileName),
              start: d.getStart(),
              end: d.end,
            })),
          }))
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
            return {
              kind: "component",
              name: node.getText(sf),
              module: imported.module,
              export: [
                ...(imported.export === "*" ? [] : [imported.export]),
                ...parts.slice(1),
              ].join("."),
            };
          const localSymbol = checker.getSymbolAtLocation(node);
          if (
            localSymbol?.valueDeclaration &&
            ts.isFunctionDeclaration(localSymbol.valueDeclaration) &&
            localSymbol.valueDeclaration.getSourceFile() === sf
          )
            return {
              kind: "component",
              name: node.getText(sf),
              module: path.relative(root, file),
              export: localSymbol.getName(),
            };
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
