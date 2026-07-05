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
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { ExtractedComponent, ExtractedProp } from '../types.js';

const SKIP_FILE = /\.(stories|test|spec|d)\.tsx?$/;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '__tests__', '__mocks__']);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.has(entry.name)) yield* walkFiles(full);
    } else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      yield full;
    }
  }
}

interface TypeTable {
  interfaces: Map<string, ts.InterfaceDeclaration>;
  aliases: Map<string, ts.TypeAliasDeclaration>;
}

function collectTypes(sf: ts.SourceFile): TypeTable {
  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  const aliases = new Map<string, ts.TypeAliasDeclaration>();
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node)) interfaces.set(node.name.text, node);
    if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
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
  if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
    const ref = t.typeName.text;
    if (ref === 'ReactNode' || ref === 'ReactElement' || ref === 'JSX') {
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

function membersOf(
  typeName: string | ts.TypeLiteralNode,
  table: TypeTable,
): ts.PropertySignature[] {
  if (typeof typeName !== 'string') {
    return typeName.members.filter(ts.isPropertySignature);
  }
  const iface = table.interfaces.get(typeName);
  if (iface) return iface.members.filter(ts.isPropertySignature);
  const alias = table.aliases.get(typeName);
  if (alias) {
    // type X = { ... }  or  type X = Base & { ... } (literal members only)
    if (ts.isTypeLiteralNode(alias.type)) return alias.type.members.filter(ts.isPropertySignature);
    if (ts.isIntersectionTypeNode(alias.type)) {
      return alias.type.types
        .filter(ts.isTypeLiteralNode)
        .flatMap((t) => t.members.filter(ts.isPropertySignature));
    }
  }
  return [];
}

/** PascalCase components exported from this file → their props-type name. */
function findComponents(sf: ts.SourceFile): Map<string, string | ts.TypeLiteralNode> {
  const found = new Map<string, string | ts.TypeLiteralNode>();
  const paramTypeOf = (fn: ts.SignatureDeclaration): string | ts.TypeLiteralNode | null => {
    const p = fn.parameters[0];
    if (!p?.type) return null;
    if (ts.isTypeReferenceNode(p.type) && ts.isIdentifier(p.type.typeName)) return p.type.typeName.text;
    if (ts.isTypeLiteralNode(p.type)) return p.type;
    return null;
  };
  const record = (name: string, propsType: string | ts.TypeLiteralNode | null) => {
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
        const init = decl.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          record(decl.name.text, paramTypeOf(init));
        } else if (ts.isCallExpression(init)) {
          // forwardRef(fn) / memo(fn) / forwardRef<E, P>(fn)
          const inner = init.arguments[0];
          if (inner && (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner))) {
            const generic = init.typeArguments?.[1];
            const genericName =
              generic && ts.isTypeReferenceNode(generic) && ts.isIdentifier(generic.typeName)
                ? generic.typeName.text
                : null;
            record(decl.name.text, genericName ?? paramTypeOf(inner));
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
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

export function extractReactTsx(root: string): ExtractedComponent[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`react-tsx adapter: root directory not found: ${root}`);
  }
  const out: ExtractedComponent[] = [];
  const seen = new Set<string>();
  for (const file of walkFiles(root)) {
    const src = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(path.basename(file), src, ts.ScriptTarget.Latest, true);
    const table = collectTypes(sf);
    for (const [componentName, propsType] of findComponents(sf)) {
      if (seen.has(componentName)) continue;
      const members = membersOf(propsType, table);
      if (members.length === 0) continue; // not a props-taking component we can see
      seen.add(componentName);
      const defaults = collectDefaults(sf, componentName);
      const props: ExtractedProp[] = [];
      for (const m of members) {
        if (!m.name || !ts.isIdentifier(m.name)) continue;
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
      const cssPath = file.replace(/\.tsx?$/, '.module.css');
      if (existsSync(cssPath)) {
        const css = readFileSync(cssPath, 'utf8');
        cssVars = [...new Set([...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((mm) => mm[1]))];
      }
      out.push({
        name: componentName,
        source: path.relative(process.cwd(), file),
        adapter: 'react-tsx',
        props,
        ...(cssVars ? { cssVars } : {}),
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
