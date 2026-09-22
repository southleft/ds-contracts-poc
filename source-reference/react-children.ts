import ts from "typescript";

export type ReactChildrenFact = {
  kind: "forwarded" | "replaced" | "absent" | "unresolved";
  reason?: string;
  via?: "spread" | "attribute" | "expression";
  span?: { start: number; end: number };
};

/** Source proof of an unchanged children input reaching the returned JSX root.
 * This says nothing about what an imported root component does with that input.
 * Unknown spreads, transformations, defaults and escaped/mutated inputs refuse
 * proof. JSX children win over attributes; later attributes win over spreads. */
export function readReactChildren(
  fn: ts.FunctionLikeDeclaration,
  root: ts.JsxElement | ts.JsxSelfClosingElement,
  checker: ts.TypeChecker,
  hasChildren: boolean,
): ReactChildrenFact {
  const sf = root.getSourceFile();
  const opening = ts.isJsxElement(root) ? root.openingElement : root;
  const unknown = (reason: string): ReactChildrenFact => ({
    kind: "unresolved",
    reason,
  });
  const inputs = new Map<
    ts.Symbol,
    "object" | "excluded" | "value" | "defaulted"
  >();
  // A sibling prop can contain the same object as children. A copy of the
  // props container does not separate those values. Primitive-only siblings
  // cannot carry this alias; object/unknown values need their own proof.
  const possibleChildAliases = new Set<ts.Symbol>();
  const secondaryAliases = new Set<ts.Symbol>();
  const primitiveOnly = (type: ts.Type): boolean =>
    type.isUnion()
      ? type.types.every(primitiveOnly)
      : !!(
          type.flags &
          (ts.TypeFlags.StringLike |
            ts.TypeFlags.NumberLike |
            ts.TypeFlags.BigIntLike |
            ts.TypeFlags.BooleanLike |
            ts.TypeFlags.ESSymbolLike |
            ts.TypeFlags.Null |
            ts.TypeFlags.Undefined |
            ts.TypeFlags.Void |
            ts.TypeFlags.Never)
        );
  const declarations = new Set<ts.Identifier>();
  const add = (
    id: ts.Identifier,
    kind: "object" | "excluded" | "value" | "defaulted",
  ) => {
    const symbol = checker.getSymbolAtLocation(id);
    if (symbol) inputs.set(symbol, kind);
    declarations.add(id);
  };
  const parameter = fn.parameters[0];
  if (!parameter || parameter.initializer)
    return unknown("children-parameter-default-unresolved");
  let checkSecondaryAliases = ts.isIdentifier(parameter.name);
  if (ts.isIdentifier(parameter.name)) add(parameter.name, "object");
  else if (ts.isObjectBindingPattern(parameter.name)) {
    const elements = parameter.name.elements;
    if (
      elements.some(
        (e) => e.propertyName && ts.isComputedPropertyName(e.propertyName),
      )
    )
      return unknown("children-computed-binding-unresolved");
    const excluded = elements.some(
      (e) =>
        !e.dotDotDotToken &&
        (e.propertyName ?? e.name).getText(sf).replace(/^['"]|['"]$/g, "") ===
          "children",
    );
    const childBinding = elements.find(
      (e) =>
        !e.dotDotDotToken &&
        (e.propertyName ?? e.name).getText(sf).replace(/^['"]|['"]$/g, "") ===
          "children",
    );
    // Destructuring rest copies the container, not its children value. Resolve
    // that property even when children has no separate local binding.
    const childProperty = checker.getPropertyOfType(
      checker.getTypeAtLocation(parameter),
      "children",
    );
    const childType = childBinding
      ? checker.getTypeAtLocation(childBinding.name)
      : childProperty
        ? checker.getTypeOfSymbolAtLocation(childProperty, parameter)
        : undefined;
    const mutableChildren = !childType || !primitiveOnly(childType);
    checkSecondaryAliases = mutableChildren;
    for (const e of elements) {
      if (!ts.isIdentifier(e.name))
        return unknown("children-nested-binding-unresolved");
      if (e.dotDotDotToken) add(e.name, excluded ? "excluded" : "object");
      else if (
        (e.propertyName ?? e.name).getText(sf).replace(/^['"]|['"]$/g, "") ===
        "children"
      )
        add(e.name, e.initializer ? "defaulted" : "value");
      else if (
        mutableChildren &&
        !primitiveOnly(checker.getTypeAtLocation(e.name))
      ) {
        const symbol = checker.getSymbolAtLocation(e.name);
        if (symbol) possibleChildAliases.add(symbol);
        declarations.add(e.name);
      }
    }
  } else return unknown("children-parameter-binding-unresolved");
  if (checkSecondaryAliases) {
    const collect = (name: ts.BindingName) => {
      if (ts.isIdentifier(name)) {
        if (!primitiveOnly(checker.getTypeAtLocation(name))) {
          const symbol = checker.getSymbolAtLocation(name);
          if (symbol) {
            possibleChildAliases.add(symbol);
            secondaryAliases.add(symbol);
          }
          declarations.add(name);
        }
      } else
        for (const element of name.elements)
          if (ts.isBindingElement(element)) collect(element.name);
    };
    for (const p of fn.parameters.slice(1)) collect(p.name);
  }
  const unwrap = (e: ts.Expression): ts.Expression =>
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e)
      ? unwrap(e.expression)
      : e;
  let competingReturn = false;
  const inspectReturns = (node: ts.Node) => {
    if (ts.isFunctionLike(node)) return;
    if (
      ts.isReturnStatement(node) &&
      (!node.expression || unwrap(node.expression) !== root)
    )
      competingReturn = true;
    ts.forEachChild(node, inspectReturns);
  };
  if (fn.body) inspectReturns(fn.body);
  if (competingReturn) return unknown("children-control-flow-unresolved");
  const inputKind = (e: ts.Expression) => {
    e = unwrap(e);
    return ts.isIdentifier(e)
      ? inputs.get(checker.getSymbolAtLocation(e)!)
      : undefined;
  };
  const readsChildren = (e: ts.Expression): boolean => {
    e = unwrap(e);
    return (
      inputKind(e) === "value" ||
      (ts.isPropertyAccessExpression(e) &&
        e.name.text === "children" &&
        inputKind(e.expression) === "object") ||
      (ts.isElementAccessExpression(e) &&
        ts.isStringLiteral(e.argumentExpression) &&
        e.argumentExpression.text === "children" &&
        inputKind(e.expression) === "object")
    );
  };
  const approved = new Set<ts.Node>();
  const approve = (node: ts.Node) => {
    approved.add(node);
    ts.forEachChild(node, approve);
  };
  const forwarded = (
    node: ts.Node,
    via: ReactChildrenFact["via"],
  ): ReactChildrenFact => {
    approve(node);
    return {
      kind: "forwarded",
      via,
      span: { start: node.getStart(sf), end: node.end },
    };
  };
  const expression = (
    e: ts.Expression,
    via: ReactChildrenFact["via"],
  ): ReactChildrenFact => {
    e = unwrap(e);
    if (hasChildren && readsChildren(e)) return forwarded(e, via);
    if (
      ts.isStringLiteral(e) ||
      ts.isNumericLiteral(e) ||
      ts.isJsxElement(e) ||
      ts.isJsxSelfClosingElement(e) ||
      [
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.TrueKeyword,
        ts.SyntaxKind.FalseKeyword,
      ].includes(e.kind)
    )
      return { kind: "replaced" };
    return unknown("children-expression-unresolved");
  };
  let result: ReactChildrenFact = { kind: "absent" };
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attr)) {
      const kind = inputKind(attr.expression);
      if (kind === "excluded") approve(attr.expression);
      else if (kind === "object") {
        approve(attr.expression);
        if (hasChildren) result = forwarded(attr, "spread");
      } else result = unknown("children-spread-unresolved");
    } else if (attr.name.getText(sf) === "children") {
      result =
        attr.initializer &&
        ts.isJsxExpression(attr.initializer) &&
        attr.initializer.expression
          ? expression(attr.initializer.expression, "attribute")
          : { kind: "replaced" };
    } else if (
      attr.name.getText(sf) === "ref" &&
      attr.initializer &&
      ts.isJsxExpression(attr.initializer) &&
      attr.initializer.expression
    ) {
      const ref = unwrap(attr.initializer.expression);
      // Passing the forwardRef binding into the returned element does not
      // execute it. Calls, property access and every other use still refuse.
      if (
        ts.isIdentifier(ref) &&
        secondaryAliases.has(checker.getSymbolAtLocation(ref)!)
      )
        approve(ref);
    }
  }
  if (ts.isJsxElement(root)) {
    // A single-line space is real JSX text; indentation-only multiline text
    // and empty JSX comments do not become a children argument.
    const children = root.children.filter((c) =>
      ts.isJsxText(c)
        ? !!c.text.trim() || !/[\r\n]/.test(c.text)
        : !ts.isJsxExpression(c) || !!c.expression,
    );
    if (
      children.length === 1 &&
      ts.isJsxExpression(children[0]) &&
      children[0].expression
    )
      result = expression(children[0].expression, "expression");
    else if (children.length)
      result = children.every(
        (c) =>
          ts.isJsxText(c) ||
          ts.isJsxElement(c) ||
          ts.isJsxSelfClosingElement(c),
      )
        ? { kind: "replaced" }
        : unknown("children-composition-unresolved");
  }
  if (result.kind !== "forwarded") return result;
  let escaped = false;
  let possibleAliasUsed = false;
  const visit = (node: ts.Node) => {
    // These can reach a parameter without a reference to its binding symbol.
    if (
      (ts.isIdentifier(node) && node.text === "arguments") ||
      (ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "eval")
    )
      escaped = true;

    if (
      ts.isIdentifier(node) &&
      !approved.has(node) &&
      !declarations.has(node)
    ) {
      const symbol = checker.getSymbolAtLocation(node)!;
      if (inputs.has(symbol)) escaped = true;
      if (possibleChildAliases.has(symbol)) possibleAliasUsed = true;
    }
    ts.forEachChild(node, visit);
  };
  // A parameter default on any sibling can mutate an earlier input binding.
  for (const p of fn.parameters) ts.forEachChild(p, visit);
  if (fn.body) visit(fn.body);
  return escaped
    ? unknown("children-input-escape-or-mutation")
    : possibleAliasUsed
      ? unknown("children-alias-unresolved")
      : result;
}
