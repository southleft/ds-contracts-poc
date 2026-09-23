import ts from "typescript";

export type ReactChildrenFact = {
  kind: "forwarded" | "nested-forwarded" | "replaced" | "absent" | "unresolved";
  /** Static host addresses, relative to the returned root. This is source
   * flow evidence only; it does not authorize root-only native lowering. */
  nestedSlot?: { path: string; hosts: Array<{ path: string; tag: string }> };
  reason?: string;
  via?: "spread" | "attribute" | "expression";
  span?: { start: number; end: number };
};

/** Source proof of an unchanged children input reaching the returned JSX root
 * or one separately recorded host path inside it.
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
  const readAt = (
    element: ts.JsxElement | ts.JsxSelfClosingElement,
  ): ReactChildrenFact => {
    const opening = ts.isJsxElement(element) ? element.openingElement : element;
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
    if (ts.isJsxElement(element)) {
      // A single-line space is real JSX text; indentation-only multiline text
      // and empty JSX comments do not become a children argument.
      const children = element.children.filter((c) =>
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
    return result;
  };
  let result = readAt(root);
  if (result.kind !== "forwarded") {
    // Keep the established root facts byte-identical unless a descendant has
    // a direct unchanged input. Never upgrade the root fact: its projector
    // intentionally discards descendants and would erase these wrappers.
    let candidate = false;
    const rootApproved = new Set(approved);
    const findCandidate = (node: ts.Node) => {
      if (
        node !== root &&
        (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
        readAt(node).kind === "forwarded"
      )
        candidate = true;
      ts.forEachChild(node, findCandidate);
    };
    findCandidate(root);
    // Candidate discovery also visits JSX inside callbacks and attributes.
    // Only actual host-template traversal may approve those input uses.
    approved.clear();
    for (const node of rootApproved) approved.add(node);
    if (!candidate) return result;
    const hosts: Array<{ path: string; tag: string }> = [];
    const slots: Array<{ path: string; fact: ReactChildrenFact }> = [];
    const walk = (
      element: ts.JsxElement | ts.JsxSelfClosingElement,
      path: string,
    ) => {
      const opening = ts.isJsxElement(element)
        ? element.openingElement
        : element;
      if (
        !ts.isIdentifier(opening.tagName) ||
        !/^[a-z][a-z0-9]*$/.test(opening.tagName.text)
      )
        throw Error("children-nested-host-unresolved");
      hosts.push({ path, tag: opening.tagName.text });
      const fact = readAt(element);
      if (fact.kind === "forwarded") {
        slots.push({ path, fact });
        return;
      }
      if (fact.kind === "unresolved")
        throw Error("children-nested-content-unresolved");
      let index = 0;
      if (ts.isJsxElement(element))
        for (const child of element.children) {
          if (ts.isJsxText(child)) continue;
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
            walk(child, path ? `${path}.${index++}` : String(index++));
          } else if (ts.isJsxExpression(child)) {
            if (!child.expression) continue;
            const value = unwrap(child.expression);
            // Primitive literals contribute no element path. Dynamic branches,
            // arrays, portals, fragments and mixed caller content need another
            // structural proof; observing one branch cannot establish it.
            if (
              !ts.isStringLiteral(value) &&
              !ts.isNumericLiteral(value) &&
              ![
                ts.SyntaxKind.NullKeyword,
                ts.SyntaxKind.TrueKeyword,
                ts.SyntaxKind.FalseKeyword,
              ].includes(value.kind)
            )
              throw Error("children-nested-content-unresolved");
          } else throw Error("children-nested-content-unresolved");
        }
    };
    try {
      walk(root, "");
      if (slots.length !== 1 || !slots[0].path)
        return unknown("children-nested-slot-ambiguous");
      result = {
        ...slots[0].fact,
        kind: "nested-forwarded",
        nestedSlot: { path: slots[0].path, hosts },
      };
    } catch (error) {
      return unknown(
        error instanceof Error
          ? error.message
          : "children-nested-content-unresolved",
      );
    }
  }
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
