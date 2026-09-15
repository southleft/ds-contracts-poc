import { createHash } from 'node:crypto';
import ts from 'typescript';

export interface LitSpan { start: number; end: number; line: number; column: number }
export interface LitImportIdentity { module: string; imported: string; local: string }
interface ExpressionBase { raw: string; span: LitSpan }
export type LitExpression = ExpressionBase & (
  | { kind: 'property'; name: string }
  | { kind: 'literal'; value: string | number | boolean | null; undefined?: never }
  | { kind: 'undefined' }
  | { kind: 'if-defined'; property: string; import: LitImportIdentity }
  | { kind: 'not'; operand: LitExpression }
  | { kind: 'binary'; operator: '===' | '!==' | '&&' | '||'; left: LitExpression; right: LitExpression }
  | { kind: 'conditional'; condition: LitExpression; whenTrue: LitExpression; whenFalse: LitExpression }
  | { kind: 'template'; templateId: string }
  | { kind: 'unsupported'; reason: string }
);
export interface LitGuard { expression: LitExpression; when: 'truthy' | 'falsy' }
export type LitAttributePart = { kind: 'text'; value: string; span: LitSpan } | { kind: 'expression'; expression: LitExpression };
export interface LitAttribute {
  /** Exact authored spelling, including the Lit prefix. */
  rawName: string;
  name: string;
  channel: 'attribute' | 'boolean-attribute' | 'property' | 'event';
  span: LitSpan;
  bare: boolean;
  parts: LitAttributePart[];
}
export type LitNode =
  | { kind: 'element'; id: string; tag: string; rawTag: string; span: LitSpan; attributes: LitAttribute[]; children: LitNode[]; slot?: { name: string } }
  | { kind: 'text' | 'comment'; value: string; span: LitSpan }
  | { kind: 'expression'; expression: LitExpression; nestedTemplateIds: string[]; span: LitSpan };
export interface LitTemplate {
  id: string;
  span: LitSpan;
  raw: string;
  import: LitImportIdentity;
  guards: LitGuard[];
  /** Present only when one AST template is reached through multiple paths.
   * `guards` alone is then insufficient, and role is forced to unresolved. */
  guardAlternatives?: LitGuard[][];
  /** Enclosing template selection was refused; guards must not be evaluated
   * as a complete path even if this nested template has only one local guard. */
  unresolvedAncestorTemplateIds?: string[];
  role: 'returned' | 'nested' | 'unresolved';
  complete: boolean;
  roots: LitNode[];
}
export interface LitMember {
  name: string;
  kind: 'field' | 'method' | 'getter' | 'setter' | 'constructor' | 'unsupported';
  visibility: 'public' | 'protected' | 'private';
  static: boolean;
  span: LitSpan;
  raw: string;
}
export interface LitProblem { code: string; message: string; span?: LitSpan; raw?: string }
export interface LitTemplateRead {
  version: 1;
  status: 'read' | 'partial' | 'refused';
  sourceSha256: string;
  modulePath: string;
  className: string;
  templates: LitTemplate[];
  members: LitMember[];
  bases: Array<{ raw: string; span: LitSpan; import?: LitImportIdentity }>;
  problems: LitProblem[];
  limitations: string[];
}
export interface LitTemplateInput { source: string; sourceSha256: string; modulePath: string; className: string }

/** Syntactic evidence only. No source execution, file/module resolution,
 * arbitrary helper interpretation, inferred role map, or accepted Contract.
 * Import identities are lexical facts, NOT authentication of installed code. */
export function readLitTemplateBindings(input: LitTemplateInput): LitTemplateRead {
  const result: LitTemplateRead = {
    version: 1, status: 'refused', sourceSha256: input.sourceSha256, modulePath: input.modulePath, className: input.className,
    templates: [], members: [], bases: [], problems: [],
    limitations: [
      'External directive implementation, package resolution, build transforms and runtime import identity are unverified; named imports establish lexical identity only.',
      'Source AST spans are identities within these exact bytes, not cross-revision or rendered-DOM identities. Runtime topology must independently corroborate bindings and selected branches.',
      'Property access is not proof of getter purity. Inherited APIs, helper implementations, lifecycle effects, event behavior, CSS/token semantics and target preservation require additional evidence.',
      'A syntactically readable binding is not an accepted contract or authorization to emit or apply a component.',
    ],
  };
  if (typeof input.source !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceSha256) || createHash('sha256').update(input.source).digest('hex') !== input.sourceSha256 || !input.modulePath || !input.className) {
    result.problems.push({ code: 'source-identity-invalid', message: 'Expected exact source bytes, SHA-256, module path and class name.' }); return result;
  }
  const fileName = '/source.ts';
  const sourceFile = ts.createSourceFile(fileName, input.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  // The in-memory program gives identifier uses their actual lexical symbols.
  // No default host, filesystem, external source or module resolution is used.
  const host: ts.CompilerHost = {
    getSourceFile: name => name === fileName ? sourceFile : undefined,
    getDefaultLibFileName: () => '/unavailable-lib.d.ts', writeFile: () => undefined,
    getCurrentDirectory: () => '/', getDirectories: () => [], fileExists: name => name === fileName,
    readFile: name => name === fileName ? input.source : undefined,
    getCanonicalFileName: name => name, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  };
  const program = ts.createProgram([fileName], { noLib: true, noResolve: true, target: ts.ScriptTarget.Latest }, host);
  const checker = program.getTypeChecker();
  const spanAt = (start: number, end: number): LitSpan => ({ start, end, line: sourceFile.getLineAndCharacterOfPosition(start).line + 1, column: sourceFile.getLineAndCharacterOfPosition(start).character + 1 });
  const span = (node: ts.Node) => spanAt(node.getStart(sourceFile), node.end);
  const problem = (code: string, message: string, node?: ts.Node) => result.problems.push({ code, message, ...(node ? { span: span(node), raw: node.getText(sourceFile) } : {}) });
  if (program.getSyntacticDiagnostics(sourceFile).length) { problem('typescript-syntax-invalid', 'TypeScript syntax errors prevent reliable source bindings.'); return result; }
  const classes = sourceFile.statements.filter((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === input.className);
  if (classes.length !== 1) { problem('class-identity-not-unique', 'Expected exactly one named top-level class declaration.'); return result; }
  const cls = classes[0];
  const unwrap = (node: ts.Expression): ts.Expression => {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  function importIdentity(expression: ts.Expression): LitImportIdentity | undefined {
    const node = unwrap(expression);
    if (ts.isIdentifier(node)) {
      const declarations = checker.getSymbolAtLocation(node)?.declarations;
      if (declarations?.length !== 1 || !ts.isImportSpecifier(declarations[0])) return;
      const specifier = declarations[0], declaration = specifier.parent.parent.parent;
      if (specifier.isTypeOnly || specifier.parent.parent.isTypeOnly || !ts.isImportDeclaration(declaration) || !ts.isStringLiteral(declaration.moduleSpecifier)) return;
      return { module: declaration.moduleSpecifier.text, imported: (specifier.propertyName ?? specifier.name).text, local: node.text };
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const declarations = checker.getSymbolAtLocation(node.expression)?.declarations;
      if (declarations?.length !== 1 || !ts.isNamespaceImport(declarations[0])) return;
      const namespace = declarations[0], declaration = namespace.parent.parent;
      if (namespace.parent.isTypeOnly || !ts.isImportDeclaration(declaration) || !ts.isStringLiteral(declaration.moduleSpecifier)) return;
      return { module: declaration.moduleSpecifier.text, imported: node.name.text, local: node.expression.text };
    }
  }
  const htmlImport = (node: ts.Expression) => {
    const identity = importIdentity(node);
    return identity?.imported === 'html' && ['lit', 'lit-html'].includes(identity.module) ? identity : undefined;
  };
  const templates = new Map<number, LitTemplate>();
  const templateId = (node: ts.Node) => `template:${node.getStart(sourceFile)}:${node.end}`;
  const classThis = (node: ts.Node): boolean => {
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (ts.isArrowFunction(parent)) continue;
      if (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)) return false;
      if (ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent) || ts.isConstructorDeclaration(parent)) return parent.parent === cls;
      if (ts.isClassLike(parent)) return parent === cls;
    }
    return false;
  };
  const expressionFact = (original: ts.Expression, guards: LitGuard[] = []): LitExpression => {
    const node = unwrap(original), base = { raw: original.getText(sourceFile), span: span(original) };
    if (ts.isPropertyAccessExpression(node) && !node.questionDotToken && node.expression.kind === ts.SyntaxKind.ThisKeyword && ts.isIdentifier(node.name) && classThis(node)) return { ...base, kind: 'property', name: node.name.text };
    if (ts.isStringLiteral(node) || (ts.isNumericLiteral(node) && Number.isFinite(Number(node.text)))) return { ...base, kind: 'literal', value: ts.isNumericLiteral(node) ? Number(node.text) : node.text };
    if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return { ...base, kind: 'literal', value: node.kind === ts.SyntaxKind.TrueKeyword };
    if (node.kind === ts.SyntaxKind.NullKeyword) return { ...base, kind: 'literal', value: null };
    if (ts.isIdentifier(node) && node.text === 'undefined' && !checker.getSymbolAtLocation(node)?.declarations?.length) return { ...base, kind: 'undefined' };
    if (ts.isTaggedTemplateExpression(node) && htmlImport(node.tag)) {
      readTemplate(node, guards, 'nested'); return { ...base, kind: 'template', templateId: templateId(node) };
    }
    if (ts.isCallExpression(node) && !node.questionDotToken) {
      const identity = importIdentity(node.expression);
      const argument = node.arguments.length === 1 ? unwrap(node.arguments[0]) : undefined;
      if (identity?.imported === 'ifDefined' && ['lit/directives/if-defined.js', 'lit-html/directives/if-defined.js'].includes(identity.module) && argument && ts.isPropertyAccessExpression(argument) && !argument.questionDotToken && ts.isIdentifier(argument.name) && argument.expression.kind === ts.SyntaxKind.ThisKeyword && classThis(argument))
        return { ...base, kind: 'if-defined', property: argument.name.text, import: identity };
    }
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return { ...base, kind: 'not', operand: expressionFact(node.operand, guards) };
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
      const left = expressionFact(node.left, guards);
      const operator = node.operatorToken.getText(sourceFile) as '===' | '!==' | '&&' | '||';
      const rightGuards = operator === '&&' || operator === '||' ? [...guards, { expression: left, when: operator === '&&' ? 'truthy' as const : 'falsy' as const }] : guards;
      return { ...base, kind: 'binary', operator, left, right: expressionFact(node.right, rightGuards) };
    }
    if (ts.isConditionalExpression(node)) {
      const condition = expressionFact(node.condition, guards);
      return { ...base, kind: 'conditional', condition,
        whenTrue: expressionFact(node.whenTrue, [...guards, { expression: condition, when: 'truthy' }]),
        whenFalse: expressionFact(node.whenFalse, [...guards, { expression: condition, when: 'falsy' }]) };
    }
    problem('expression-unsupported', 'Expression is preserved but its transformation, helper behavior or lexical binding is not supported.', original);
    // Preserve nested imported templates even inside an uninterpreted helper.
    const unknown: LitExpression = { ...base, kind: 'unsupported', reason: 'expression-unsupported' };
    const visit = (child: ts.Node) => {
      if (child !== node && ts.isTaggedTemplateExpression(child) && htmlImport(child.tag)) readTemplate(child, [...guards, { expression: unknown, when: 'truthy' }], 'unresolved');
      else ts.forEachChild(child, visit);
    };
    visit(node);
    return unknown;
  };
  type Unit = { char: string; offset: number } | { expression: ts.Expression; offset: number; end: number };
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  // This is not a full HTML tree builder. Table/select/formatting/document
  // contexts can insert, close or move nodes, so do not advertise their authored
  // nesting as browser topology. Expand only with native-parser conformance.
  const normalElements = new Set(['div', 'span', 'button', 'a', 'slot', 'input', 'img', 'br', 'hr']);
  function readTemplate(node: ts.TaggedTemplateExpression, guards: LitGuard[], role: LitTemplate['role']): LitTemplate {
    const prior = templates.get(node.pos);
    if (prior) {
      const alternatives = prior.guardAlternatives ?? [prior.guards];
      if (!alternatives.some(existing => JSON.stringify(existing) === JSON.stringify(guards))) {
        prior.guardAlternatives = [...alternatives, guards];
        problem('template-multiple-paths-unresolved', 'One source template is reached through multiple paths. All guards are retained; no single-path topology selection is claimed.', node);
        for (const descendant of templates.values()) if (descendant.span.start > prior.span.start && descendant.span.end < prior.span.end) {
          descendant.role = 'unresolved';
          descendant.unresolvedAncestorTemplateIds = [...new Set([...(descendant.unresolvedAncestorTemplateIds ?? []), prior.id])];
          result.problems.push({ code: 'ancestor-template-selection-unresolved', message: `Enclosing template ${prior.id} has unresolved alternative paths; this descendant's recorded guard is not complete selection evidence.`, span: descendant.span, raw: descendant.raw });
        }
      }
      if (prior.guardAlternatives || prior.unresolvedAncestorTemplateIds?.length) prior.role = 'unresolved';
      else if (role === 'returned') prior.role = role;
      return prior;
    }
    const template: LitTemplate = { id: templateId(node), span: span(node), raw: node.getText(sourceFile), import: htmlImport(node.tag)!, guards, role, complete: false, roots: [] };
    templates.set(node.pos, template); result.templates.push(template);
    const units: Unit[] = [];
    const chars = (start: number, end: number) => {
      const raw = input.source.slice(start, end);
      if (raw.includes('\\')) throw new Error('escaped-template-literal-unsupported');
      for (let offset = start; offset < end; offset++) units.push({ char: input.source[offset], offset });
    };
    try {
      if (ts.isNoSubstitutionTemplateLiteral(node.template)) chars(node.template.getStart(sourceFile) + 1, node.template.end - 1);
      else {
        chars(node.template.head.getStart(sourceFile) + 1, node.template.head.end - 2);
        let interpolationStart = node.template.head.end - 2;
        for (const part of node.template.templateSpans) {
          units.push({ expression: part.expression, offset: interpolationStart, end: part.literal.getStart(sourceFile) + 1 });
          chars(part.literal.getStart(sourceFile) + 1, part.literal.end - (part.literal.kind === ts.SyntaxKind.TemplateTail ? 1 : 2));
          interpolationStart = part.literal.end - 2;
        }
      }
      let index = 0;
      const ch = (at = index) => units[at] && 'char' in units[at] ? (units[at] as { char: string }).char : '';
      const starts = (value: string) => [...value].every((char, offset) => ch(index + offset) === char);
      const offset = (at = index) => units[at]?.offset ?? node.template.end - 1;
      const endOffset = (at = index) => {
        const last = units[at - 1];
        return last ? 'char' in last ? last.offset + 1 : last.end : offset(at);
      };
      const whitespace = () => { while (/\s/.test(ch()) && ch()) index++; };
      const name = () => { let value = ''; while (/[A-Za-z0-9_:.?@-]/.test(ch()) && ch()) value += ch(index++); return value; };
      const fail = (code: string): never => { throw new Error(code); };
      const textPart = (start: number, end: number): LitAttributePart => ({ kind: 'text', value: units.slice(start, end).map(unit => 'char' in unit ? unit.char : '').join(''), span: spanAt(offset(start), endOffset(end)) });
      const childNodes = (closing?: string, ancestors: string[] = []): LitNode[] => {
        const out: LitNode[] = [];
        while (index < units.length) {
          const unit = units[index];
          if ('expression' in unit) {
            const expression = expressionFact(unit.expression, guards);
            const nestedTemplateIds: string[] = [];
            const refs = (node: ts.Node) => {
              if (ts.isTaggedTemplateExpression(node) && htmlImport(node.tag)) nestedTemplateIds.push(templateId(node));
              else ts.forEachChild(node, refs);
            };
            refs(unit.expression);
            out.push({ kind: 'expression', expression, nestedTemplateIds, span: span(unit.expression) }); index++; continue;
          }
          if (starts('<!--')) {
            const start = index; index += 4;
            while (index < units.length && !starts('-->')) { if ('expression' in units[index]) fail('expression-in-html-comment-unsupported'); index++; }
            if (index >= units.length) fail('unclosed-html-comment');
            index += 3;
            out.push({ kind: 'comment', value: units.slice(start + 4, index - 3).map(unit => 'char' in unit ? unit.char : '').join(''), span: spanAt(offset(start), endOffset(index)) }); continue;
          }
          if (starts('</')) {
            index += 2; const actual = name().toLowerCase(); whitespace();
            if (!closing || actual !== closing || ch() !== '>') fail('html-closing-tag-mismatch');
            index++; return out;
          }
          if (ch() === '<') {
            const start = index++; const rawTag = name(), tag = rawTag.toLowerCase();
            if (!/^[a-z][a-z0-9-]*$/i.test(rawTag)) fail('dynamic-or-unsupported-tag');
            if (['script', 'style', 'textarea', 'title', 'svg', 'math'].includes(tag)) fail('raw-text-or-namespace-element-unsupported');
            if (!normalElements.has(tag) && !tag.includes('-')) fail('html-parser-context-unproven');
            if (['button', 'a'].includes(tag) && ancestors.includes(tag)) fail('html-implicit-reparenting-unsupported');
            const attributes: LitAttribute[] = [];
            whitespace();
            while (index < units.length && ch() !== '>' && !starts('/>')) {
              const start = index, rawName = name();
              if (!/^([?.@]?)[A-Za-z_][A-Za-z0-9_:.-]*$/.test(rawName)) fail('dynamic-or-unsupported-attribute-name');
              const prefix = /^[?.@]/.test(rawName) ? rawName[0] : '', attrName = prefix ? rawName.slice(1) : rawName;
              const channel: LitAttribute['channel'] = prefix === '?' ? 'boolean-attribute' : prefix === '.' ? 'property' : prefix === '@' ? 'event' : 'attribute';
              whitespace(); const bare = ch() !== '=', parts: LitAttributePart[] = [];
              if (!bare) {
                index++; whitespace(); const quote = ch() === '"' || ch() === "'" ? ch(index++) : '';
                while (index < units.length && (quote ? ch() !== quote : !!('expression' in units[index]) || (!!ch() && !/\s/.test(ch()) && ch() !== '>'))) {
                  if ('expression' in units[index]) {
                    const current = units[index] as { expression: ts.Expression };
                    parts.push({ kind: 'expression', expression: expressionFact(current.expression, guards) });
                    for (const nested of templates.values()) if (nested.span.start >= current.expression.getStart(sourceFile) && nested.span.end <= current.expression.end) {
                      nested.role = 'unresolved';
                      result.problems.push({ code: 'template-outside-child-position', message: 'A TemplateResult inside an attribute is not evidence of child DOM topology.', span: nested.span, raw: nested.raw });
                    }
                    index++;
                  }
                  else { const partStart = index; while (index < units.length && 'char' in units[index] && (quote ? ch() !== quote : !/\s/.test(ch()) && ch() !== '>')) index++; if (index > partStart) parts.push(textPart(partStart, index)); }
                }
                if (quote) { if (ch() !== quote) fail('unclosed-html-attribute'); index++; }
                else if (!parts.length) fail('empty-unquoted-html-attribute');
              }
              const attribute: LitAttribute = { rawName, name: attrName, channel, span: spanAt(offset(start), endOffset(index)), bare, parts };
              if (attributes.some(previous => previous.name.toLowerCase() === attrName.toLowerCase())) result.problems.push({ code: 'duplicate-attribute-target', message: 'Multiple authored bindings address the same target; no winner selected.', span: attribute.span, raw: rawName });
              if (channel !== 'attribute' && (bare || parts.length !== 1 || parts[0].kind !== 'expression')) result.problems.push({ code: 'directive-binding-shape-unsupported', message: 'Boolean/property/event bindings require one expression in this bounded reader.', span: attribute.span, raw: rawName });
              if (parts.some(part => part.kind === 'text' && part.value.includes('&'))) result.problems.push({ code: 'html-entity-decoding-unproven', message: 'Literal attribute bytes include an entity/ampersand; no decoded value is claimed.', span: attribute.span, raw: rawName });
              if (parts.length > 1) result.problems.push({ code: 'attribute-composition-unsupported', message: 'Composite attribute fragments are preserved; no transformation is inferred.', span: attribute.span, raw: rawName });
              if (channel === 'event') result.problems.push({ code: 'event-behavior-unproven', message: 'The event attachment is recorded; handler behavior and target equivalence are not analyzed.', span: attribute.span, raw: rawName });
              attributes.push(attribute); whitespace();
            }
            const selfClosing = starts('/>');
            if (selfClosing) index += 2; else { if (ch() !== '>') fail('unclosed-html-opening-tag'); index++; }
            if (selfClosing && !voidElements.has(tag)) fail('nonvoid-self-closing-html-unsupported');
            const element: Extract<LitNode, { kind: 'element' }> = { kind: 'element', id: `element:${offset(start)}`, tag, rawTag, span: spanAt(offset(start), endOffset(index)), attributes, children: [] };
            if (tag === 'slot') {
              const names = attributes.filter(attribute => attribute.name.toLowerCase() === 'name');
              if (!names.length) element.slot = { name: '' };
              else if (names.length === 1 && names[0].channel === 'attribute' && !names[0].bare && names[0].parts.every(part => part.kind === 'text') && !names[0].parts.some(part => part.kind === 'text' && part.value.includes('&')))
                element.slot = { name: names[0].parts.map(part => part.kind === 'text' ? part.value : '').join('') };
              else result.problems.push({ code: 'slot-identity-unproven', message: 'Slot name must be one literal HTML attribute; do not infer an identity.', span: element.span });
            }
            if (!voidElements.has(tag)) element.children = childNodes(tag, [...ancestors, tag]);
            element.span.end = endOffset(index); out.push(element); continue;
          }
          const start = index;
          while (index < units.length && 'char' in units[index] && ch() !== '<') index++;
          const text = { kind: 'text' as const, value: units.slice(start, index).map(unit => 'char' in unit ? unit.char : '').join(''), span: spanAt(offset(start), endOffset(index)) };
          if (text.value.includes('&')) result.problems.push({ code: 'html-entity-decoding-unproven', message: 'Literal text bytes include an entity/ampersand; no decoded text is claimed.', span: text.span, raw: text.value });
          out.push(text);
        }
        if (closing) fail('unclosed-html-element'); return out;
      };
      template.roots = childNodes(); template.complete = true;
      const slotNames = new Set<string>();
      const checkSlots = (nodes: LitNode[]) => {
        for (const element of nodes) if (element.kind === 'element') {
          if (element.slot) {
            if (slotNames.has(element.slot.name)) result.problems.push({ code: 'duplicate-slot-name', message: 'Multiple literal slots share a name in this template; native distribution must not be replaced by duplicate consumer rendering.', span: element.span, raw: element.slot.name });
            slotNames.add(element.slot.name);
          }
          checkSlots(element.children);
        }
      };
      checkSlots(template.roots);
    } catch (error) {
      problem(error instanceof Error ? error.message : 'template-parse-failed', 'Template source is retained, but complete topology cannot be proven by the bounded grammar.', node);
    }
    return template;
  }
  for (const clause of cls.heritageClauses ?? []) for (const base of clause.types) {
    result.bases.push({ raw: base.getText(sourceFile), span: span(base), ...(importIdentity(base.expression) ? { import: importIdentity(base.expression) } : {}) });
    problem('inherited-surface-unresolved', 'Superclass/mixin source and inherited public API require independent resolution.', base);
  }
  for (const member of cls.members) {
    const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) ?? [] : [];
    const kind: LitMember['kind'] = ts.isPropertyDeclaration(member) ? 'field' : ts.isMethodDeclaration(member) ? 'method' : ts.isGetAccessorDeclaration(member) ? 'getter' : ts.isSetAccessorDeclaration(member) ? 'setter' : ts.isConstructorDeclaration(member) ? 'constructor' : 'unsupported';
    result.members.push({ name: member.name?.getText(sourceFile) ?? (kind === 'constructor' ? 'constructor' : '(unnamed)'), kind,
      visibility: modifiers.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword) || (member.name && ts.isPrivateIdentifier(member.name)) ? 'private' : modifiers.some(modifier => modifier.kind === ts.SyntaxKind.ProtectedKeyword) ? 'protected' : 'public',
      static: modifiers.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword), span: span(member), raw: member.getText(sourceFile) });
    if (ts.isPropertyDeclaration(member) && member.initializer && !ts.isStringLiteral(member.initializer) && !ts.isNumericLiteral(member.initializer) && ![ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(member.initializer.kind))
      problem('field-initializer-uninterpreted', 'Field initialization may compute values or create controllers/effects; its source is retained, not translated.', member);
    if (kind !== 'field' && member.name?.getText(sourceFile) !== 'render') problem('member-behavior-unresolved', 'Member implementation is retained; methods, accessors, constructors and lifecycle effects are not translated.', member);
  }
  const renders = cls.members.filter((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(sourceFile) === 'render' && !member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword));
  if (renders.length !== 1 || !renders[0].body || renders[0].parameters.length) { problem('render-method-not-unique', 'Expected one instance render() method with a body and no parameters.'); return result; }
  if (renders[0].asteriskToken || renders[0].modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
    problem('render-method-shape-unsupported', 'Async/generator render returns a Promise/iterator, not a directly returned TemplateResult.', renders[0]); return result;
  }
  const renderExpression = (node: ts.Expression, guards: LitGuard[]) => {
    const value = unwrap(node);
    if (ts.isTaggedTemplateExpression(value) && htmlImport(value.tag)) { readTemplate(value, guards, 'returned'); return; }
    if (ts.isConditionalExpression(value)) {
      const condition = expressionFact(value.condition, guards);
      renderExpression(value.whenTrue, [...guards, { expression: condition, when: 'truthy' }]);
      renderExpression(value.whenFalse, [...guards, { expression: condition, when: 'falsy' }]); return;
    }
    expressionFact(value, guards); problem('render-return-unsupported', 'Return expression does not identify a supported imported html template.', node);
  };
  function statements(list: readonly ts.Statement[], contexts: LitGuard[][]): LitGuard[][] {
    let fallthrough = contexts;
    for (const statement of list) {
      if (!fallthrough.length) { problem('unreachable-render-statement', 'Unreachable source retained, not counted as a rendered template.', statement); continue; }
      if (ts.isReturnStatement(statement)) {
        if (statement.expression) for (const guards of fallthrough) renderExpression(statement.expression, guards);
        else problem('empty-render-return', 'Empty return is retained as an unsupported render outcome.', statement);
        fallthrough = []; continue;
      }
      if (ts.isIfStatement(statement)) {
        const next: LitGuard[][] = [];
        for (const guards of fallthrough) {
          const condition = expressionFact(statement.expression, guards);
          next.push(...statements(ts.isBlock(statement.thenStatement) ? statement.thenStatement.statements : [statement.thenStatement], [[...guards, { expression: condition, when: 'truthy' }]]));
          next.push(...(statement.elseStatement ? statements(ts.isBlock(statement.elseStatement) ? statement.elseStatement.statements : [statement.elseStatement], [[...guards, { expression: condition, when: 'falsy' }]]) : [[...guards, { expression: condition, when: 'falsy' as const }]]));
        }
        fallthrough = next; continue;
      }
      if (ts.isBlock(statement)) { fallthrough = statements(statement.statements, fallthrough); continue; }
      problem('render-statement-uninterpreted', 'Statement is preserved; local helpers, effects and unsupported control flow are not evaluated.', statement);
      // Import-identified templates inside an unsupported statement remain
      // discoverable but are explicitly NOT returned/selected topology.
      const opaque: LitExpression = { kind: 'unsupported', reason: 'render-statement-uninterpreted', raw: statement.getText(sourceFile), span: span(statement) };
      const visit = (node: ts.Node) => {
        if (ts.isTaggedTemplateExpression(node) && htmlImport(node.tag)) readTemplate(node, [{ expression: opaque, when: 'truthy' }], 'unresolved');
        else ts.forEachChild(node, visit);
      };
      visit(statement);
    }
    return fallthrough;
  }
  const remaining = statements(renders[0].body.statements, [[]]);
  if (remaining.length) problem('render-fallthrough-unresolved', 'Some render paths have no supported returned template.', renders[0]);
  if (!result.templates.some(template => template.role === 'returned')) problem('returned-template-missing', 'No supported imported html return template was found.');
  for (const outer of result.templates.filter(template => template.role === 'returned')) {
    const owners = new Map<string, Set<string>>();
    for (const template of result.templates.filter(template => template.span.start >= outer.span.start && template.span.end <= outer.span.end)) {
      const walk = (nodes: LitNode[]) => {
        for (const element of nodes) if (element.kind === 'element') {
          if (element.slot) {
            const set = owners.get(element.slot.name) ?? new Set<string>(); set.add(template.id); owners.set(element.slot.name, set);
          }
          walk(element.children);
        }
      };
      walk(template.roots);
    }
    for (const [name, templates] of owners) if (templates.size > 1) result.problems.push({ code: 'cross-template-slot-distribution-unresolved', message: `Slot ${JSON.stringify(name)} occurs across nested templates. Co-rendering/exclusivity and native distribution need proof before mapping consumer content.`, span: outer.span, raw: name });
  }
  result.status = result.problems.length ? 'partial' : 'read';
  return result;
}
