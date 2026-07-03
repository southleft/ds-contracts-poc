/**
 * Code-side extraction — reads the ACTUAL React source (not the contract)
 * so hand edits are detected. Uses the TypeScript compiler API to pull each
 * component's props interface (names, enum unions, booleans, optionality)
 * and the destructuring defaults, plus the CSS custom properties its
 * CSS Module consumes.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface CodeProp {
  name: string;
  kind: 'enum' | 'boolean' | 'other';
  values?: string[];
  optional: boolean;
  default?: string | boolean;
}

export interface CodeExtract {
  component: string;
  props: CodeProp[];
  cssVars: string[];
}

export function extractCode(root = process.cwd()): CodeExtract[] {
  const dir = path.join(root, 'src', 'components');
  const out: CodeExtract[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    let src: string;
    try {
      src = readFileSync(path.join(dir, name, `${name}.tsx`), 'utf8');
    } catch {
      continue;
    }

    const sf = ts.createSourceFile(`${name}.tsx`, src, ts.ScriptTarget.Latest, true);
    const props: CodeProp[] = [];
    const defaults = new Map<string, string | boolean>();

    const visit = (node: ts.Node): void => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === `${name}Props`) {
        for (const member of node.members) {
          if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name))
            continue;
          const propName = member.name.text;
          let kind: CodeProp['kind'] = 'other';
          let values: string[] | undefined;
          if (member.type) {
            if (member.type.kind === ts.SyntaxKind.BooleanKeyword) {
              kind = 'boolean';
            } else if (ts.isUnionTypeNode(member.type)) {
              const literals = member.type.types
                .filter(ts.isLiteralTypeNode)
                .map((t) => t.literal)
                .filter(ts.isStringLiteral)
                .map((l) => l.text);
              if (literals.length === member.type.types.length) {
                kind = 'enum';
                values = literals;
              }
            }
          }
          props.push({ name: propName, kind, values, optional: !!member.questionToken });
        }
      }
      if (ts.isObjectBindingPattern(node)) {
        for (const el of node.elements) {
          if (el.initializer && ts.isIdentifier(el.name)) {
            if (ts.isStringLiteral(el.initializer)) defaults.set(el.name.text, el.initializer.text);
            else if (el.initializer.kind === ts.SyntaxKind.TrueKeyword)
              defaults.set(el.name.text, true);
            else if (el.initializer.kind === ts.SyntaxKind.FalseKeyword)
              defaults.set(el.name.text, false);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    for (const p of props) {
      if (defaults.has(p.name)) p.default = defaults.get(p.name);
    }

    let cssVars: string[] = [];
    try {
      const css = readFileSync(path.join(dir, name, `${name}.module.css`), 'utf8');
      cssVars = [...new Set([...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]))];
    } catch {
      /* no stylesheet */
    }

    out.push({ component: name, props, cssVars });
  }
  return out;
}
