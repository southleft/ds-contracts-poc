/**
 * The adherence judge — `npm run judge -- <screen.tsx …> [--json out.json]`.
 *
 * Deterministically scores ANY React screen file against catalog/catalog.json.
 * No LLM, no rubric drift: the catalog IS the spec, so "does this output
 * follow the design system" is a property that gets CHECKED, not judged.
 * This is also the arm-scoring judge for the AI-adherence eval (docs/07).
 *
 * Checks (each maps to a rule in context/rules.json):
 *   components-from-catalog  unknown capitalized components; unknown props;
 *                            illegal enum values; missing required props
 *   no-raw-equivalents       forbidden raw HTML elements (button, table, …)
 *   no-style-overrides       className/style on catalog components
 *   slot acceptance          children/slot content vs the slot's accepts
 *   text-children            element children inside text-content components
 *   tokens-only              hex/rgb/px literals anywhere; unknown var(--…)
 *   one-primary-action       >1 primary Button per file
 *
 * Score = 100 × (1 − violations / checks). "Adherent" = zero violations.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();

interface CatalogComponent {
  name: string;
  props: Array<{ name: string; type: string | string[]; required?: boolean }>;
  children: { kind: 'text' | 'slot' | 'none'; accepts?: string[]; acceptsMode?: string };
  slots: Array<{ prop: string; accepts: string[]; acceptsMode: string; optional: boolean }>;
}
interface Catalog {
  rules: Array<{ id: string; forbiddenRawElements?: string[] }>;
  tokens: { allCssVariables: string[] };
  components: CatalogComponent[];
}

const catalog: Catalog = JSON.parse(
  readFileSync(path.join(ROOT, 'catalog', 'catalog.json'), 'utf8'),
);
const componentsByName = new Map(catalog.components.map((c) => [c.name, c]));
const knownVars = new Set(catalog.tokens.allCssVariables);
const forbiddenRaw = new Set(
  catalog.rules.find((r) => r.id === 'no-raw-equivalents')?.forbiddenRawElements ?? [],
);
const PASSTHROUGH_ATTR = /^(key|id|ref|role|aria-[\w-]+|data-[\w-]+|on[A-Z]\w*)$/;

interface Violation {
  rule: string;
  detail: string;
}
interface FileReport {
  file: string;
  elements: number;
  checks: number;
  violations: Violation[];
  score: number;
  adherent: boolean;
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function judgeFile(file: string): FileReport {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  let elements = 0;
  let checks = 0;
  let primaryButtons = 0;

  const check = (ok: boolean, rule: string, detail: string) => {
    checks++;
    if (!ok) violations.push({ rule, detail });
  };

  const jsxChildTags = (children: readonly ts.JsxChild[]): string[] => {
    const tags: string[] = [];
    for (const child of children) {
      if (ts.isJsxElement(child)) tags.push(tagName(child.openingElement));
      else if (ts.isJsxSelfClosingElement(child)) tags.push(tagName(child));
      else if (ts.isJsxExpression(child) && child.expression) {
        // dynamic children ({items.map(...)}) — statically unverifiable, not a violation
      }
    }
    return tags;
  };

  const exprElementTags = (expr: ts.Expression): string[] => {
    const tags: string[] = [];
    const walk = (n: ts.Node) => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) tags.push(tagName(n));
      ts.forEachChild(n, walk);
    };
    walk(expr);
    return tags;
  };

  const visitElement = (
    opening: ts.JsxOpeningLikeElement,
    children: readonly ts.JsxChild[] | null,
  ) => {
    const tag = tagName(opening);
    elements++;

    // Lowercase → raw HTML element
    if (/^[a-z]/.test(tag)) {
      check(
        !forbiddenRaw.has(tag),
        'no-raw-equivalents',
        `Raw <${tag}> used — the system provides a component for this`,
      );
      return;
    }

    const comp = componentsByName.get(tag);
    check(Boolean(comp), 'components-from-catalog', `<${tag}> is not in the catalog`);
    if (!comp) return;

    const knownProps = new Map(comp.props.map((p) => [p.name, p]));
    const slotProps = new Map(comp.slots.map((s) => [s.prop, s]));
    let isPrimaryButton = comp.name === 'Button'; // default variant is primary
    const seenProps = new Set<string>();

    for (const attr of opening.attributes.properties) {
      if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name)) continue;
      const attrName = attr.name.text;
      seenProps.add(attrName);

      if (attrName === 'className' || attrName === 'style') {
        check(false, 'no-style-overrides', `${attrName} override on <${tag}>`);
        continue;
      }
      if (PASSTHROUGH_ATTR.test(attrName)) continue;

      const slot = slotProps.get(attrName);
      if (slot) {
        if (
          slot.accepts.length > 0 &&
          attr.initializer &&
          ts.isJsxExpression(attr.initializer) &&
          attr.initializer.expression
        ) {
          for (const t of exprElementTags(attr.initializer.expression)) {
            if (t === 'Fragment' || /^[a-z]/.test(t)) continue;
            check(
              slot.accepts.includes(t),
              'components-from-catalog',
              `<${tag} ${attrName}> slot accepts [${slot.accepts.join(', ')}], got <${t}>`,
            );
          }
        }
        continue;
      }

      const prop = knownProps.get(attrName);
      check(Boolean(prop), 'components-from-catalog', `<${tag}> has no prop "${attrName}"`);
      if (!prop) continue;

      if (Array.isArray(prop.type) && attr.initializer && ts.isStringLiteral(attr.initializer)) {
        const value = attr.initializer.text;
        check(
          prop.type.includes(value),
          'components-from-catalog',
          `<${tag} ${attrName}="${value}"> — legal values: ${prop.type.join(' | ')}`,
        );
        if (comp.name === 'Button' && attrName === 'variant') {
          isPrimaryButton = value === 'primary';
        }
      }
    }

    for (const p of comp.props) {
      if (p.required) {
        check(
          seenProps.has(p.name),
          'components-from-catalog',
          `<${tag}> missing required prop "${p.name}"`,
        );
      }
    }

    if (isPrimaryButton) primaryButtons++;

    // Children policy
    if (children) {
      const childTags = jsxChildTags(children).filter((t) => t !== 'Fragment');
      if (comp.children.kind === 'text') {
        for (const t of childTags) {
          check(
            false,
            'components-from-catalog',
            `<${tag}> takes text content, got <${t}> — that's a contract gap, not a slot`,
          );
        }
      } else if (comp.children.kind === 'slot' && (comp.children.accepts?.length ?? 0) > 0) {
        for (const t of childTags) {
          if (/^[a-z]/.test(t)) continue; // raw elements flagged separately
          check(
            comp.children.accepts!.includes(t),
            'components-from-catalog',
            `<${tag}> children accept [${comp.children.accepts!.join(', ')}], got <${t}>`,
          );
        }
      }
    }
  };

  const walk = (node: ts.Node) => {
    if (ts.isJsxElement(node)) visitElement(node.openingElement, node.children);
    else if (ts.isJsxSelfClosingElement(node)) visitElement(node, null);
    ts.forEachChild(node, walk);
  };
  walk(sf);

  // File-level: token literals + unknown custom properties
  const withoutVars = src.replace(/var\(--[\w-]+\)/g, '');
  for (const hex of withoutVars.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
    check(false, 'tokens-only', `Literal color ${hex}`);
  }
  for (const px of withoutVars.match(/\b[1-9]\d*px\b/g) ?? []) {
    check(false, 'tokens-only', `Literal dimension ${px}`);
  }
  for (const fn of withoutVars.match(/\b(?:rgba?|hsla?)\(/g) ?? []) {
    check(false, 'tokens-only', `Literal color function ${fn}…)`);
  }
  for (const m of src.matchAll(/var\((--[\w-]+)\)/g)) {
    check(knownVars.has(m[1]), 'tokens-only', `Unknown token var(${m[1]})`);
  }
  check(
    primaryButtons <= 1,
    'one-primary-action',
    `${primaryButtons} primary Buttons in one screen (max 1)`,
  );

  const score = checks === 0 ? 0 : Math.max(0, Math.round(100 * (1 - violations.length / checks)));
  return { file: path.relative(ROOT, file), elements, checks, violations, score, adherent: violations.length === 0 };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const jsonFlag = args.indexOf('--json');
const jsonOut = jsonFlag >= 0 ? args[jsonFlag + 1] : null;
const files = args.filter((a, i) => a !== '--json' && (jsonFlag < 0 || i !== jsonFlag + 1));

if (files.length === 0) {
  console.error('Usage: npm run judge -- <screen.tsx …> [--json out.json]');
  process.exit(2);
}

const reports = files.map(judgeFile);
for (const r of reports) {
  const mark = r.adherent ? '✔' : '✖';
  console.log(`${mark} ${r.file} — score ${r.score} (${r.elements} elements, ${r.violations.length} violations)`);
  for (const v of r.violations) console.log(`    [${v.rule}] ${v.detail}`);
}
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ reports }, null, 2) + '\n');
}
process.exit(reports.every((r) => r.adherent) ? 0 : 1);
