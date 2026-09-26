import ts from "typescript";

/** Recognize a context export without treating it as a component function.
 * The direct imported factory and the local value must remain intact. This is
 * source classification only, not permission to lower a provider or its API. */
export function isReactContextExport(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
): boolean {
  if (
    !ts.isVariableDeclaration(declaration) ||
    !ts.isIdentifier(declaration.name) ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const)
  )
    return false;
  const call = declaration.initializer;
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    ts.isSpreadElement(call.arguments[0])
  )
    return false;
  const sf = declaration.getSourceFile();
  const bindings = new Map<
    ts.Symbol,
    {
      declaration: ts.Declaration;
      member: "namespace" | "createContext" | "useContext";
    }
  >();
  for (const stmt of sf.statements) {
    if (
      !ts.isImportDeclaration(stmt) ||
      !ts.isStringLiteral(stmt.moduleSpecifier) ||
      stmt.moduleSpecifier.text !== "react" ||
      !stmt.importClause ||
      stmt.importClause.isTypeOnly
    )
      continue;
    const clause = stmt.importClause;
    const add = (
      name: ts.Identifier,
      decl: ts.Declaration,
      member: "namespace" | "createContext" | "useContext",
    ) => {
      const symbol = checker.getSymbolAtLocation(name);
      if (symbol) bindings.set(symbol, { declaration: decl, member });
    };
    if (clause.name) add(clause.name, clause, "namespace");
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
      add(clause.namedBindings.name, clause.namedBindings, "namespace");
    else if (clause.namedBindings)
      for (const item of clause.namedBindings.elements) {
        const member = (item.propertyName ?? item.name).text;
        if (!item.isTypeOnly && member === "default")
          add(item.name, item, "namespace");
        else if (
          !item.isTypeOnly &&
          (member === "createContext" || member === "useContext")
        )
          add(item.name, item, member);
      }
  }
  const importedMember = (
    e: ts.Expression,
    member: "createContext" | "useContext",
  ): boolean => {
    if (ts.isIdentifier(e))
      return bindings.get(checker.getSymbolAtLocation(e)!)?.member === member;
    return (
      ts.isPropertyAccessExpression(e) &&
      e.name.text === member &&
      ts.isIdentifier(e.expression) &&
      bindings.get(checker.getSymbolAtLocation(e.expression)!)?.member ===
        "namespace"
    );
  };
  if (!importedMember(call.expression, "createContext")) return false;
  const symbol = checker.getSymbolAtLocation(declaration.name);
  if (!symbol) return false;
  const typeOnly = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isTypeNode(parent)) return true;
      if (
        ts.isExpression(parent) ||
        ts.isStatement(parent) ||
        ts.isSourceFile(parent)
      )
        return false;
    }
    return false;
  };
  const jsxTag = (node: ts.Node) =>
    (ts.isJsxOpeningElement(node.parent) ||
      ts.isJsxSelfClosingElement(node.parent) ||
      ts.isJsxClosingElement(node.parent)) &&
    node.parent.tagName === node;
  let unsafe = false;
  const visit = (node: ts.Node) => {
    if (unsafe) return;
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      unsafe = true;
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      unsafe = true;
    if (
      ts.isIdentifier(node) &&
      !typeOnly(node) &&
      ["eval", "require"].includes(node.text)
    )
      unsafe = true;
    if (ts.isIdentifier(node) && !typeOnly(node)) {
      const ref = checker.getSymbolAtLocation(node),
        binding = ref && bindings.get(ref),
        parent = node.parent;
      if (binding && parent !== binding.declaration) {
        if (binding.member === "namespace") {
          if (
            !ts.isPropertyAccessExpression(parent) ||
            parent.expression !== node
          )
            unsafe = true;
          else if (
            ["createContext", "useContext"].includes(parent.name.text) &&
            (!ts.isCallExpression(parent.parent) ||
              parent.parent.expression !== parent)
          )
            unsafe = true;
        } else if (!ts.isCallExpression(parent) || parent.expression !== node)
          unsafe = true;
      }
      // Export aliases resolve to the same immutable local binding.
      const value =
        ref && ref.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(ref)
          : ref;
      if (value === symbol && node !== declaration.name) {
        const localExport =
          ts.isExportSpecifier(parent) &&
          ts.isExportDeclaration(parent.parent.parent) &&
          !parent.parent.parent.moduleSpecifier;
        const defaultExport =
          ts.isExportAssignment(parent) &&
          !parent.isExportEquals &&
          parent.expression === node;
        const hook =
          ts.isCallExpression(parent) &&
          parent.arguments.length === 1 &&
          parent.arguments[0] === node &&
          importedMember(parent.expression, "useContext");
        const contextTag =
          jsxTag(node) ||
          (ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            ["Provider", "Consumer"].includes(parent.name.text) &&
            jsxTag(parent));
        const label =
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          parent.name.text === "displayName" &&
          ts.isBinaryExpression(parent.parent) &&
          parent.parent.left === parent &&
          parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          (ts.isStringLiteral(parent.parent.right) ||
            ts.isNoSubstitutionTemplateLiteral(parent.parent.right));
        if (!localExport && !defaultExport && !hook && !contextTag && !label)
          unsafe = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return !unsafe;
}
