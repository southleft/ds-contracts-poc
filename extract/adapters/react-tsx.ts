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

const SKIP_FILE = /\.(stories|story|test|spec|demos?|d)\.tsx?$/;
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

function membersOf(
  typeName: PropsTypeRef,
  table: TypeTable,
): { resolved: boolean; members: ts.PropertySignature[] } {
  if (typeof typeName !== 'string') {
    if (ts.isIntersectionTypeNode(typeName)) {
      return {
        resolved: true,
        members: typeName.types
          .filter(ts.isTypeLiteralNode)
          .flatMap((t) => t.members.filter(ts.isPropertySignature)),
      };
    }
    return { resolved: true, members: typeName.members.filter(ts.isPropertySignature) };
  }
  const iface = table.interfaces.get(typeName);
  // An interface that RESOLVES but has no own members (extends-only, e.g.
  // `interface CodeProps extends HTMLAttributes<...> {}`) is a legitimate
  // zero-own-prop component API — extract it as such, don't skip it.
  if (iface) return { resolved: true, members: iface.members.filter(ts.isPropertySignature) };
  const alias = table.aliases.get(typeName);
  if (alias) {
    if (ts.isTypeLiteralNode(alias.type)) {
      return { resolved: true, members: alias.type.members.filter(ts.isPropertySignature) };
    }
    if (ts.isIntersectionTypeNode(alias.type)) {
      return {
        resolved: true,
        members: alias.type.types
          .filter(ts.isTypeLiteralNode)
          .flatMap((t) => t.members.filter(ts.isPropertySignature)),
      };
    }
  }
  return { resolved: false, members: [] };
}

/** The type node behind a props-type ref, for cva/VariantProps scanning. */
function typeNodeOf(typeName: PropsTypeRef, table: TypeTable): ts.TypeNode | null {
  if (typeof typeName !== 'string') return typeName;
  const alias = table.aliases.get(typeName);
  return alias ? alias.type : null;
}

/** PascalCase components exported from this file → their props-type name. */
function findComponents(sf: ts.SourceFile): Map<string, PropsTypeRef> {
  const found = new Map<string, PropsTypeRef>();
  const paramTypeOf = (fn: ts.SignatureDeclaration): PropsTypeRef | null => {
    const p = fn.parameters[0];
    if (!p?.type) return null;
    if (ts.isTypeReferenceNode(p.type) && ts.isIdentifier(p.type.typeName)) return p.type.typeName.text;
    if (ts.isTypeLiteralNode(p.type)) return p.type;
    if (ts.isIntersectionTypeNode(p.type)) return p.type;
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

export interface SkippedComponent {
  name: string;
  source: string;
  reason: string;
}

export function extractReactTsx(
  root: string,
  skipped?: SkippedComponent[],
): ExtractedComponent[] {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`react-tsx adapter: root directory not found: ${root}`);
  }
  const out: ExtractedComponent[] = [];
  const seen = new Set<string>();
  for (const file of walkFiles(root)) {
    const src = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(path.basename(file), src, ts.ScriptTarget.Latest, true);
    const table = collectTypes(sf);
    const cvaTables = collectCvaTables(sf);
    for (const [componentName, propsType] of findComponents(sf)) {
      if (seen.has(componentName)) continue;
      const { resolved, members } = membersOf(propsType, table);
      const typeNode = typeNodeOf(propsType, table);
      const cvaProps = typeNode ? cvaPropsFrom(typeNode, cvaTables) : [];
      if (!resolved && members.length === 0 && cvaProps.length === 0) {
        // A component we can SEE but cannot READ is reported, never
        // silently dropped — silent omission is the failure mode this
        // tool exists to eliminate.
        skipped?.push({
          name: componentName,
          source: path.relative(process.cwd(), file),
          reason:
            typeof propsType === 'string'
              ? `props type "${propsType}" not found in this file (imported/composed types are outside single-file extraction)`
              : 'props type has no readable members (composed from imported types?)',
        });
        continue;
      }
      seen.add(componentName);
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
