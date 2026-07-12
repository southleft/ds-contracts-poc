/**
 * React/TypeScript adapter — reads REAL component source, not contracts.
 *
 * Generalized from parity/extract-code.ts, which assumed this repo's
 * conventions (src/components/<Name>/<Name>.tsx + <Name>Props). This
 * adapter drops those assumptions:
 *   · scans a root directory recursively for .tsx/.ts files
 *   · finds PascalCase exported components (function decls, arrow consts,
 *     forwardRef wrappers)
 *   · resolves the props type from: explicit <Name>Props naming, the
 *     component's first-parameter type reference, or an inline literal —
 *     with one-hop local type-alias resolution ('sm' | 'md' behind
 *     `type Size = …`), marked confidence:'inferred'
 *   · classifies members: string-literal unions → enum; boolean; string;
 *     number; ReactNode → node; on* function types → event
 *   · defaults from destructuring initializers and Component.defaultProps
 *
 * Deliberately single-file syntactic (no ts.Program / type checker): fast,
 * zero-config, and every place a heuristic fills a gap is marked 'inferred'
 * so humans review it — extraction proposes, never decides (docs/11).
 *
 * When a component has a co-located *.module.css, the css-module adapter
 * additionally proposes ANATOMY (part tree, token bindings, layout, states)
 * — see adapters/css-module.ts. Components without one keep the exact
 * behavior above: API surface only, anatomy stays a stub.
 *
 *
 * PURE core (no node:* imports): the directory-walking, file-reading adapter
 * shell lives in extract/adapters/react-tsx.ts; a browser playground hands
 * `extractFromSource` the source text (and optional co-located CSS Module
 * text) directly. Uses the TypeScript compiler API — browser-safe, heavy.
 */
import ts from 'typescript';
import { extractAnatomy, type TokenIndex } from './extract-css-module.js';
import type { ExtractedComponent, ExtractedProp } from '../extract/types.js';

interface TypeTable {
  interfaces: Map<string, ts.InterfaceDeclaration>;
  aliases: Map<string, ts.TypeAliasDeclaration>;
}

/** Merge one or more source files' type declarations into a single table.
 *  EARLIER files win on name collision — callers pass the component file
 *  first, so a sibling type file never shadows an in-file declaration.
 *  (SIBLING-TYPE-FILE RULE: a co-located `<basename>.types.ts` is part of
 *  the module's declared type surface — the `import type { XProps } from
 *  './X.types'` convention — so its interfaces/aliases join the table;
 *  component DISCOVERY still reads only the component file.) */
function collectTypes(sfs: ts.SourceFile | ts.SourceFile[]): TypeTable {
  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  const aliases = new Map<string, ts.TypeAliasDeclaration>();
  for (const sf of Array.isArray(sfs) ? sfs : [sfs]) {
    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node) && !interfaces.has(node.name.text)) interfaces.set(node.name.text, node);
      if (ts.isTypeAliasDeclaration(node) && !aliases.has(node.name.text)) aliases.set(node.name.text, node);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { interfaces, aliases };
}

/** String-literal-union members of a type node, resolving local aliases one hop. */
function literalUnion(type: ts.TypeNode, table: TypeTable, hop = 0): string[] | null {
  if (ts.isUnionTypeNode(type)) {
    const lits: string[] = [];
    for (const t of type.types) {
      if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) lits.push(t.literal.text);
      else if (t.kind === ts.SyntaxKind.UndefinedKeyword) continue; // optionality noise
      else return null;
    }
    return lits.length > 0 ? lits : null;
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && hop < 1) {
    const alias = table.aliases.get(type.typeName.text);
    if (alias) return literalUnion(alias.type, table, hop + 1);
  }
  return null;
}

function classifyMember(
  member: ts.PropertySignature,
  table: TypeTable,
): Omit<ExtractedProp, 'name' | 'optional'> | null {
  if (!member.type) return { kind: 'other', confidence: 'declared' };
  const t = member.type;
  const viaAlias = ts.isTypeReferenceNode(t);
  const union = literalUnion(t, table);
  if (union) return { kind: 'enum', values: union, confidence: viaAlias ? 'inferred' : 'declared' };
  if (t.kind === ts.SyntaxKind.BooleanKeyword) return { kind: 'boolean', confidence: 'declared' };
  if (t.kind === ts.SyntaxKind.StringKeyword) return { kind: 'string', confidence: 'declared' };
  if (t.kind === ts.SyntaxKind.NumberKeyword) return { kind: 'number', confidence: 'declared' };
  if (ts.isFunctionTypeNode(t)) return { kind: 'event', confidence: 'declared' };
  if (ts.isTypeReferenceNode(t)) {
    // ReactNode or React.ReactNode (qualified) — both are node props
    const ref = ts.isIdentifier(t.typeName)
      ? t.typeName.text
      : ts.isQualifiedName(t.typeName)
        ? t.typeName.right.text
        : '';
    if (ref === 'ReactNode' || ref === 'ReactElement') {
      return { kind: 'node', confidence: 'declared' };
    }
  }
  return { kind: 'other', confidence: 'declared' };
}

function jsDocText(node: ts.Node): string | undefined {
  const tags = (node as { jsDoc?: { comment?: string | unknown }[] }).jsDoc;
  const c = tags?.[0]?.comment;
  return typeof c === 'string' ? c : undefined;
}

/** cva('base', { variants: {...}, defaultVariants: {...} }) tables — the
 *  shadcn-era convention. The variant axes and defaults are fully syntactic
 *  in the config object, so `VariantProps<typeof buttonVariants>` resolves
 *  to real enum props without a type checker. */
interface CvaTable {
  variants: Map<string, string[]>;
  defaults: Map<string, string | boolean>;
}
function collectCvaTables(sf: ts.SourceFile): Map<string, CvaTable> {
  const tables = new Map<string, CvaTable>();
  const keyText = (n: ts.PropertyName): string | null =>
    ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'cva'
    ) {
      const cfg = node.initializer.arguments.find(ts.isObjectLiteralExpression);
      if (cfg) {
        const table: CvaTable = { variants: new Map(), defaults: new Map() };
        for (const prop of cfg.properties) {
          if (!ts.isPropertyAssignment(prop) || !prop.name) continue;
          const section = keyText(prop.name);
          if (section === 'variants' && ts.isObjectLiteralExpression(prop.initializer)) {
            for (const axis of prop.initializer.properties) {
              if (!ts.isPropertyAssignment(axis) || !axis.name) continue;
              const axisName = keyText(axis.name);
              if (!axisName || !ts.isObjectLiteralExpression(axis.initializer)) continue;
              const options = axis.initializer.properties
                .map((o) => (ts.isPropertyAssignment(o) && o.name ? keyText(o.name) : null))
                .filter((x): x is string => x !== null);
              if (options.length > 0) table.variants.set(axisName, options);
            }
          }
          if (section === 'defaultVariants' && ts.isObjectLiteralExpression(prop.initializer)) {
            for (const d of prop.initializer.properties) {
              if (!ts.isPropertyAssignment(d) || !d.name) continue;
              const dn = keyText(d.name);
              if (!dn) continue;
              if (ts.isStringLiteral(d.initializer)) table.defaults.set(dn, d.initializer.text);
              else if (d.initializer.kind === ts.SyntaxKind.TrueKeyword) table.defaults.set(dn, true);
              else if (d.initializer.kind === ts.SyntaxKind.FalseKeyword) table.defaults.set(dn, false);
            }
          }
        }
        tables.set(node.name.text, table);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return tables;
}

/** VariantProps<typeof X> in a type expression → cva-derived props. */
function cvaPropsFrom(type: ts.TypeNode, cvaTables: Map<string, CvaTable>): ExtractedProp[] {
  const out: ExtractedProp[] = [];
  const parts = ts.isIntersectionTypeNode(type) ? type.types : [type];
  for (const t of parts) {
    if (
      ts.isTypeReferenceNode(t) &&
      ts.isIdentifier(t.typeName) &&
      t.typeName.text === 'VariantProps' &&
      t.typeArguments?.length === 1 &&
      ts.isTypeQueryNode(t.typeArguments[0]) &&
      ts.isIdentifier(t.typeArguments[0].exprName)
    ) {
      const table = cvaTables.get(t.typeArguments[0].exprName.text);
      if (!table) continue;
      for (const [axis, options] of table.variants) {
        const isBool = options.every((o) => o === 'true' || o === 'false');
        out.push({
          name: axis,
          optional: true, // cva variant props are always optional
          ...(isBool ? { kind: 'boolean' as const } : { kind: 'enum' as const, values: options }),
          ...(table.defaults.has(axis) ? { default: table.defaults.get(axis) } : {}),
          confidence: 'declared', // literally declared in the cva config
        });
      }
    }
  }
  return out;
}

type PropsTypeRef = string | ts.TypeLiteralNode | ts.IntersectionTypeNode;

interface MembersResult {
  /** The props-type DECLARATION was found (its members may still be empty). */
  resolved: boolean;
  members: ts.PropertySignature[];
  /** Named type references the expansion could NOT read — imported types,
   *  generic transforms (`ComponentProps<Slots>`, `Omit<X, 'y'>`), mapped
   *  types. Every entry is a receipt: their members are NOT carried. */
  unresolved: string[];
  /** `extends` clause names, when the props type is an interface — the
   *  hollow-extraction receipt names them (parent members are outside
   *  single-file extraction by design). */
  heritage: string[];
}

const heritageNames = (iface: ts.InterfaceDeclaration): string[] =>
  (iface.heritageClauses ?? []).flatMap((h) => h.types.map((t) => t.getText()));

/** Expand a type node to its property signatures. INTERSECTION-NAMED-REF
 *  RULE: a named reference inside an intersection (or behind an alias)
 *  resolves through the module-scope type table — `type BadgeProps = A & B`
 *  where A/B are declared in scope reads A's and B's members instead of
 *  extracting "resolved" with zero props. GENERIC references keep their
 *  hands off: `ComponentProps<Slots>` / `Omit<X, 'y'>` TRANSFORM their
 *  target's members, so expanding the target would claim more than the type
 *  says — they are returned by name as unresolved, never guessed. */
function expandMembers(
  t: ts.TypeNode,
  table: TypeTable,
  hop: number,
): { members: ts.PropertySignature[]; unresolved: string[] } {
  if (ts.isTypeLiteralNode(t)) return { members: t.members.filter(ts.isPropertySignature), unresolved: [] };
  if (ts.isIntersectionTypeNode(t)) {
    const members: ts.PropertySignature[] = [];
    const unresolved: string[] = [];
    for (const part of t.types) {
      const r = expandMembers(part, table, hop);
      members.push(...r.members);
      unresolved.push(...r.unresolved);
    }
    return { members, unresolved };
  }
  if (ts.isParenthesizedTypeNode(t)) return expandMembers(t.type, table, hop);
  if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
    if (!t.typeArguments?.length && hop < 3) {
      const iface = table.interfaces.get(t.typeName.text);
      if (iface) return { members: iface.members.filter(ts.isPropertySignature), unresolved: [] };
      const alias = table.aliases.get(t.typeName.text);
      if (alias) return expandMembers(alias.type, table, hop + 1);
    }
    return { members: [], unresolved: [t.getText()] };
  }
  return { members: [], unresolved: [t.getText()] };
}

function membersOf(typeName: PropsTypeRef, table: TypeTable): MembersResult {
  if (typeof typeName !== 'string') {
    return { resolved: true, ...expandMembers(typeName, table, 0), heritage: [] };
  }
  const iface = table.interfaces.get(typeName);
  // An interface that RESOLVES but has no own members (extends-only, e.g.
  // `interface CodeProps extends HTMLAttributes<...> {}`) is a legitimate
  // zero-own-prop component API — extract it as such (with the hollow
  // receipt naming its heritage), don't skip it.
  if (iface) {
    return {
      resolved: true,
      members: iface.members.filter(ts.isPropertySignature),
      unresolved: [],
      heritage: heritageNames(iface),
    };
  }
  const alias = table.aliases.get(typeName);
  if (alias) return { resolved: true, ...expandMembers(alias.type, table, 1), heritage: [] };
  return { resolved: false, members: [], unresolved: [], heritage: [] };
}

/** The type node behind a props-type ref, for cva/VariantProps scanning. */
function typeNodeOf(typeName: PropsTypeRef, table: TypeTable): ts.TypeNode | null {
  if (typeof typeName !== 'string') return typeName;
  const alias = table.aliases.get(typeName);
  return alias ? alias.type : null;
}

/** PascalCase components exported from this file → their props-type name.
 *
 *  CAST-TRANSPARENCY RULE (silent-loss class: `export const Button =
 *  forwardRef(...) as ForwardRefComponent<ButtonProps>`): `expr as T` and
 *  `expr satisfies T` are type-level wrappers — discovery reads THROUGH
 *  them to the real initializer, and T (like an explicit `const X:
 *  FC<XProps>` annotation) is a props-type candidate: the first type
 *  argument of a generic component type names the props.
 *
 *  CAST-ALIAS RULE (`const Tag = TagBase as TagComponent`): a PascalCase
 *  cast of a PascalCase identifier is a public re-typed alias of that
 *  component — it inherits the target's props type, so the public name is
 *  extracted (or at worst named-skipped), never silently absent. */
function findComponents(sf: ts.SourceFile): Map<string, PropsTypeRef> {
  const found = new Map<string, PropsTypeRef>();
  const castAliases = new Map<string, string>();
  const paramTypeOf = (fn: ts.SignatureDeclaration): PropsTypeRef | null => {
    const p = fn.parameters[0];
    if (!p?.type) return null;
    if (ts.isTypeReferenceNode(p.type) && ts.isIdentifier(p.type.typeName)) return p.type.typeName.text;
    if (ts.isTypeLiteralNode(p.type)) return p.type;
    if (ts.isIntersectionTypeNode(p.type)) return p.type;
    return null;
  };
  /** Props-type candidate from a COMPONENT type (a declared annotation or a
   *  cast target): `ForwardRefComponent<P>` / `FC<P>` / `ComponentType<P>`
   *  all name the props as the first type argument. */
  const propsFromComponentType = (t: ts.TypeNode | undefined): PropsTypeRef | null => {
    if (!t) return null;
    if (ts.isTypeReferenceNode(t) && t.typeArguments?.length) {
      const arg = t.typeArguments[0];
      if (ts.isTypeReferenceNode(arg) && ts.isIdentifier(arg.typeName)) return arg.typeName.text;
      if (ts.isTypeLiteralNode(arg) || ts.isIntersectionTypeNode(arg)) return arg;
    }
    if (ts.isIntersectionTypeNode(t)) {
      for (const part of t.types) {
        const hit = propsFromComponentType(part);
        if (hit) return hit;
      }
    }
    return null;
  };
  const record = (name: string, propsType: PropsTypeRef | null) => {
    if (!/^[A-Z]/.test(name)) return;
    found.set(name, propsType ?? `${name}Props`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      record(node.name.text, paramTypeOf(node));
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        // Read through casts/satisfies (collecting each cast target as a
        // props-type hint) to the real initializer.
        let init = decl.initializer;
        const castTypes: ts.TypeNode[] = [];
        while (
          ts.isAsExpression(init) ||
          ts.isSatisfiesExpression(init) ||
          ts.isParenthesizedExpression(init)
        ) {
          if (!ts.isParenthesizedExpression(init)) castTypes.push(init.type);
          init = init.expression;
        }
        const typeHint = () =>
          propsFromComponentType(decl.type) ??
          castTypes.map(propsFromComponentType).find((x) => x !== null) ??
          null;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          record(decl.name.text, paramTypeOf(init) ?? typeHint());
        } else if (ts.isCallExpression(init)) {
          // forwardRef(fn) / memo(fn) / forwardRef<E, P>(fn)
          const inner = init.arguments[0];
          if (inner && (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))) {
            const generic = init.typeArguments?.[1];
            const genericName =
              generic && ts.isTypeReferenceNode(generic) && ts.isIdentifier(generic.typeName)
                ? generic.typeName.text
                : null;
            record(decl.name.text, genericName ?? paramTypeOf(inner) ?? typeHint());
          }
        } else if (
          ts.isIdentifier(init) &&
          castTypes.length > 0 &&
          /^[A-Z]/.test(decl.name.text) &&
          /^[A-Z]/.test(init.text)
        ) {
          castAliases.set(decl.name.text, init.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // Cast-aliases inherit the target component's props type; an alias whose
  // target is unreadable falls back to <Name>Props → a NAMED skip downstream.
  for (const [name, target] of castAliases) {
    if (found.has(name)) continue;
    found.set(name, found.get(target) ?? `${name}Props`);
  }
  return found;
}

function collectDefaults(sf: ts.SourceFile, componentName: string): Map<string, string | number | boolean> {
  const defaults = new Map<string, string | number | boolean>();
  const visit = (node: ts.Node) => {
    if (ts.isObjectBindingPattern(node)) {
      for (const el of node.elements) {
        if (el.initializer && ts.isIdentifier(el.name)) {
          const init = el.initializer;
          if (ts.isStringLiteral(init)) defaults.set(el.name.text, init.text);
          else if (ts.isNumericLiteral(init)) defaults.set(el.name.text, Number(init.text));
          else if (init.kind === ts.SyntaxKind.TrueKeyword) defaults.set(el.name.text, true);
          else if (init.kind === ts.SyntaxKind.FalseKeyword) defaults.set(el.name.text, false);
        }
      }
    }
    // Legacy: Component.defaultProps = { size: 'md' }
    if (
      ts.isBinaryExpression(node) &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === 'defaultProps' &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === componentName &&
      ts.isObjectLiteralExpression(node.right)
    ) {
      for (const prop of node.right.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          const init = prop.initializer;
          if (ts.isStringLiteral(init)) defaults.set(prop.name.text, init.text);
          else if (ts.isNumericLiteral(init)) defaults.set(prop.name.text, Number(init.text));
          else if (init.kind === ts.SyntaxKind.TrueKeyword) defaults.set(prop.name.text, true);
          else if (init.kind === ts.SyntaxKind.FalseKeyword) defaults.set(prop.name.text, false);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return defaults;
}

export interface SkippedComponent {
  name: string;
  source: string;
  reason: string;
}

/** One source file, as text — the unit the pure extractor reads. */
export interface SourceFileInput {
  /** Path as it should appear in `source:` fields (repo-relative). */
  sourcePath: string;
  /** The .tsx/.ts source text. */
  source: string;
  /** Co-located *.module.css text, when one exists — unlocks anatomy. */
  css?: string;
  /** Sibling type files (`<basename>.types.ts` convention) whose interface/
   *  alias declarations join the module's type table. Component discovery
   *  stays in `source`; on a name collision the component file wins. */
  types?: { sourcePath: string; source: string }[];
}

/** Extract every readable component from one source file. `seen` dedupes
 *  across files (first definition wins, matching the directory walk);
 *  `tokens` is lazy — the index is only built when a CSS Module appears. */
export function extractFromSource(
  input: SourceFileInput,
  tokens: () => TokenIndex,
  seen: Set<string> = new Set(),
  skipped?: SkippedComponent[],
): ExtractedComponent[] {
  const out: ExtractedComponent[] = [];
  const fileName = input.sourcePath.split(/[\\/]/).pop() ?? input.sourcePath;
  const src = input.source;
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true);
  const typeSfs = (input.types ?? []).map((t) =>
    ts.createSourceFile(t.sourcePath.split(/[\\/]/).pop() ?? t.sourcePath, t.source, ts.ScriptTarget.Latest, true),
  );
  const table = collectTypes([sf, ...typeSfs]);
  const cvaTables = collectCvaTables(sf);
  for (const [componentName, propsType] of findComponents(sf)) {
    if (seen.has(componentName)) continue;
    const { resolved, members, unresolved, heritage } = membersOf(propsType, table);
    const typeNode = typeNodeOf(propsType, table);
    const cvaProps = typeNode ? cvaPropsFrom(typeNode, cvaTables) : [];
    // `VariantProps<typeof x>` reads through the cva table, not the type
    // table — when cva carried it, it is not an unresolved reference.
    const unresolvedRefs = [...new Set(unresolved)].filter(
      (u) => !(cvaProps.length > 0 && u.startsWith('VariantProps<')),
    );
    if (members.length === 0 && cvaProps.length === 0) {
      if (!resolved) {
        // A component we can SEE but cannot READ is reported, never
        // silently dropped — silent omission is the failure mode this
        // tool exists to eliminate.
        skipped?.push({
          name: componentName,
          source: input.sourcePath,
          reason:
            typeof propsType === 'string'
              ? `props type "${propsType}" not found in this file (imported/composed types are outside single-file extraction)`
              : 'props type has no readable members (composed from imported types?)',
        });
        continue;
      }
      if (unresolvedRefs.length > 0) {
        // The declaration resolved but EVERY member lives behind named
        // references extraction cannot read — a schema-valid 0-prop contract
        // here would be plausible, valid, and wrong (the hollow-extraction
        // class). A NAMED skip instead.
        skipped?.push({
          name: componentName,
          source: input.sourcePath,
          reason: `props type ${typeof propsType === 'string' ? `"${propsType}" ` : ''}resolves only to named reference(s) [${unresolvedRefs.join(', ')}] whose members are outside module scope — 0 readable props; skipped instead of proposing a hollow contract`,
        });
        continue;
      }
    }
    seen.add(componentName);
    // Receipts a hollow or partially-read API must carry (extraction
    // proposes, never decides — and never claims silently).
    const componentNotes: string[] = [];
    if (members.length === 0 && cvaProps.length === 0) {
      componentNotes.push(
        heritage.length > 0
          ? `props type has NO OWN members (extends ${heritage.join(', ')} — parent members are outside single-file extraction): zero own props is what this module declares — review`
          : 'props type resolved with NO members — a zero-prop API is what this module declares; review',
      );
    } else if (unresolvedRefs.length > 0) {
      componentNotes.push(
        `props type composes named reference(s) [${unresolvedRefs.join(', ')}] whose members are outside module scope — those props are NOT carried (single-file extraction)`,
      );
    }
    const defaults = collectDefaults(sf, componentName);
    const props: ExtractedProp[] = [...cvaProps];
    for (const [i, p] of cvaProps.entries()) {
      if (defaults.has(p.name) && p.default === undefined) {
        props[i] = { ...p, default: defaults.get(p.name) };
      }
    }
    for (const m of members) {
      if (!m.name || !ts.isIdentifier(m.name)) continue;
      if (props.some((x) => x.name === (m.name as ts.Identifier).text)) continue;
      const cls = classifyMember(m, table);
      if (!cls) continue;
      props.push({
        name: m.name.text,
        optional: !!m.questionToken,
        ...(jsDocText(m) ? { description: jsDocText(m) } : {}),
        ...cls,
        ...(defaults.has(m.name.text) ? { default: defaults.get(m.name.text) } : {}),
      });
    }
    let cssVars: string[] | undefined;
    let anatomy: ExtractedComponent['anatomy'];
    if (input.css !== undefined) {
      const css = input.css;
      cssVars = [...new Set([...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((mm) => mm[1]))];
      // A co-located CSS Module makes the component's structure legible —
      // propose anatomy from the JSX tree + the stylesheet (css-module
      // adapter). Extraction failures degrade to notes, never to a crash.
      anatomy = extractAnatomy({ sf, src, componentName, props, css, tokens: tokens() }) ?? undefined;
    }
    out.push({
      name: componentName,
      source: input.sourcePath,
      adapter: 'react-tsx',
      props,
      ...(componentNotes.length > 0 ? { notes: componentNotes } : {}),
      ...(cssVars ? { cssVars } : {}),
      ...(anatomy ? { anatomy } : {}),
    });
  }
  return out;
}
