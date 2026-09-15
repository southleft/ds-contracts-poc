import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readLitTemplateBindings, type LitAttribute, type LitExpression, type LitNode, type LitTemplateRead } from './lit-template.js';

const sha = (source: string) => createHash('sha256').update(source).digest('hex');
const fixture = JSON.parse(readFileSync(new URL('../fixtures/lit-template/altitude-button.json', import.meta.url), 'utf8'));
const read = (source: string, className = 'Control') => readLitTemplateBindings({ source, sourceSha256: sha(source), modulePath: 'control.ts', className });
const wrap = (body: string, imports = "import {html} from 'lit'; import {ifDefined} from 'lit/directives/if-defined.js';") => `${imports}\nexport class Control { render() { ${body} } }`;
function elements(nodes: LitNode[]): Array<Extract<LitNode, { kind: 'element' }>> {
  return nodes.flatMap(node => node.kind === 'element' ? [node, ...elements(node.children)] : []);
}
function expression(attribute: LitAttribute): LitExpression {
  assert.equal(attribute.parts.length, 1);
  assert.equal(attribute.parts[0].kind, 'expression');
  return (attribute.parts[0] as Extract<LitAttribute['parts'][number], { kind: 'expression' }>).expression;
}
function root(result: LitTemplateRead, tag: string) {
  const found = result.templates.filter(template => template.role === 'returned').flatMap(template => elements(template.roots)).find(element => element.tag === tag);
  assert.ok(found); return found;
}

test('actual hash-bound Button source preserves both return branches, six templates, direct attributes and independent slot topology', () => {
  assert.equal(sha(fixture.source), fixture.sourceSha256);
  assert.equal(fixture.sourceSha256, '14b7d53eaacf027174f5b59b9c1ee0e311e218b40438c9df807d2ae266f0a510');
  assert.equal(fixture.sourceRevision, '0639eccd15bfedc4fa9713d9545a64cef2c0f0a5');
  const result = readLitTemplateBindings(fixture);
  assert.equal(result.status, 'partial');
  assert.equal(result.templates.length, 6);
  assert.equal(result.templates.every(template => template.complete), true);
  const returned = result.templates.filter(template => template.role === 'returned');
  assert.equal(returned.length, 2);
  assert.deepEqual(returned.map(template => template.guards.map(guard => [guard.expression.raw, guard.when])), [[['this.href', 'truthy']], [['this.href', 'falsy']]]);
  const button = root(result, 'button'), anchor = root(result, 'a');
  const expected = { type: 'type', value: 'value', name: 'name', 'aria-label': 'label', 'aria-disabled': 'isDisabled', 'aria-pressed': 'isPressed', 'aria-expanded': 'isExpanded' };
  for (const [name, property] of Object.entries(expected)) {
    const attribute = button.attributes.find(attribute => attribute.name === name)!;
    assert.equal(attribute.channel, 'attribute');
    const fact = expression(attribute);
    assert.equal(fact.kind, 'if-defined');
    assert.equal(fact.kind === 'if-defined' && fact.property, property);
  }
  assert.equal(button.attributes.some(attribute => attribute.name === 'disabled'), false, 'do not invent native disabled from isDisabled');
  assert.equal(button.attributes.some(attribute => attribute.name === 'aria-controls'), false, 'do not merge link-only attrs into button branch');
  assert.ok(anchor.attributes.some(attribute => attribute.name === 'aria-controls'));
  assert.equal(button.attributes.find(attribute => attribute.name === 'click')!.channel, 'event');
  const slots = result.templates.flatMap(template => elements(template.roots)).filter(element => element.slot);
  assert.deepEqual(slots.map(slot => slot.slot!.name).sort(), ['', '', 'after', 'after', 'before', 'before']);
  assert.equal(elements(button.children).find(element => element.tag === 'slot')!.slot!.name, '');
  assert.ok(result.templates.filter(template => template.role === 'nested').every(template => template.guards.some(guard => guard.expression.kind === 'unsupported' && guard.expression.raw.startsWith('this.slotNotEmpty('))));
  assert.ok(result.problems.some(problem => problem.code === 'member-behavior-unresolved' && problem.raw?.includes('setTimeout')));
  assert.ok(result.problems.some(problem => problem.code === 'render-statement-uninterpreted' && problem.raw?.includes('this.componentClassNames')));
  assert.equal(result.bases[0].raw, 'ALElement');
  assert.deepEqual(result.bases[0].import, { module: '../ALElement', imported: 'ALElement', local: 'ALElement' });
  assert.ok(result.members.some(member => member.name === 'formController' && member.visibility === 'protected'));
  assert.ok(result.members.some(member => member.name === 'slotNodes' && member.raw.includes('@queryAssignedNodes()')));
  assert.ok(result.limitations.some(limitation => limitation.includes('runtime import identity are unverified')));
});

test('lexical import aliases and namespace imports identify html/ifDefined without source-name guessing', () => {
  for (const [imports, html, defined] of [
    ["import {html as view} from 'lit'; import {ifDefined as optional} from 'lit/directives/if-defined.js';", 'view', 'optional'],
    ["import * as Lit from 'lit'; import * as Directive from 'lit-html/directives/if-defined.js';", 'Lit.html', 'Directive.ifDefined'],
  ]) {
    const result = read(wrap('return ' + html + '`<button aria-label=${' + defined + '(this.label)}><slot></slot></button>`;', imports));
    assert.equal(result.status, 'read');
    assert.equal(expression(root(result, 'button').attributes[0]).kind, 'if-defined');
    assert.equal(result.templates[0].import.imported, 'html');
  }
});

test('lookalike local, wrong-module and shadowed directive identities are not granted import semantics', () => {
  const sources = [
    wrap('const ifDefined = (value) => value; return html`<button aria-label=${ifDefined(this.label)}></button>`;'),
    wrap('return html`<button aria-label=${ifDefined(this.label)}></button>`;', "import {html} from 'lit'; import {ifDefined} from './lookalike';"),
    wrap('{ let ifDefined; return html`<button aria-label=${ifDefined(this.label)}></button>`; }'),
    wrap('return html`<button aria-label=${ifDefined(this.label)}></button>`;', "import {html} from 'lit'; import type {ifDefined} from 'lit/directives/if-defined.js';"),
  ];
  for (const source of sources) {
    const result = read(source);
    assert.equal(expression(root(result, 'button').attributes[0]).kind, 'unsupported');
    assert.ok(result.problems.some(problem => problem.code === 'expression-unsupported'));
  }
  for (const source of [
    wrap('const html = () => null; return html`<button></button>`;'),
    wrap('return html`<button></button>`;', "import {html} from './lookalike';"),
  ]) assert.equal(read(source).templates.some(template => template.role === 'returned'), false);
});

test('native attribute, boolean-presence, DOM property and event attachments remain distinct', () => {
  const source = wrap('return html`<div><button disabled=${this.isDisabled}></button><button ?disabled=${this.isDisabled}></button><button .disabled=${this.isDisabled}></button><button aria-disabled=${ifDefined(this.isAriaDisabled)} @click=${this.handleClick}></button></div>`;');
  const result = read(source);
  const buttons = elements(result.templates[0].roots).filter(element => element.tag === 'button');
  assert.deepEqual(buttons.map(button => button.attributes[0].channel), ['attribute', 'boolean-attribute', 'property', 'attribute']);
  assert.equal(buttons[3].attributes[1].channel, 'event');
  assert.deepEqual(buttons.slice(0, 3).map(button => expression(button.attributes[0]).kind), ['property', 'property', 'property']);
  assert.ok(result.problems.some(problem => problem.code === 'event-behavior-unproven'));
  assert.equal(result.templates[0].complete, true);
});

test('source default/named slots are independent from equal-looking API labels and retain fallback children', () => {
  const result = read(wrap('return html`<button aria-label=${ifDefined(this.label)}><span><slot>Fallback</slot></span><slot name="before"></slot><slot name="after"></slot></button>`;'));
  const button = root(result, 'button');
  const slots = elements(button.children).filter(element => element.slot);
  assert.deepEqual(slots.map(slot => slot.slot!.name), ['', 'before', 'after']);
  assert.equal(expression(button.attributes[0]).kind, 'if-defined');
  assert.equal(slots[0].children[0].kind, 'text');
  assert.equal(slots[0].children[0].kind === 'text' && slots[0].children[0].value, 'Fallback');
  assert.equal(JSON.stringify(slots).includes('this.label'), false);
});

test('if/else, early-return fallthrough, ternary and nested && preserve exact guards instead of merging branches', () => {
  const result = read(wrap('if (this.href) return html`<a></a>`; return this.ready ? html`<button>${this.before && html`<span><slot name="before"></slot></span>`}</button>` : html`<div></div>`;'));
  assert.equal(result.templates.length, 4);
  assert.deepEqual(result.templates.filter(template => template.role === 'returned').map(template => template.guards.map(guard => [guard.expression.raw, guard.when])), [
    [['this.href', 'truthy']], [['this.href', 'falsy'], ['this.ready', 'truthy']], [['this.href', 'falsy'], ['this.ready', 'falsy']],
  ]);
  const nested = result.templates.find(template => template.role === 'nested')!;
  assert.deepEqual(nested.guards.map(guard => [guard.expression.raw, guard.when]), [['this.href', 'falsy'], ['this.ready', 'truthy'], ['this.before', 'truthy']]);
  const expressionNode = root(result, 'button').children.find(node => node.kind === 'expression')!;
  assert.equal(expressionNode.kind, 'expression');
  assert.deepEqual(expressionNode.kind === 'expression' && expressionNode.nestedTemplateIds, [nested.id]);
});

test('unsupported helper calls and when callbacks retain nested templates under unresolved guards', () => {
  const result = read(wrap('return html`<div>${when(this.ready, () => html`<slot name="after"></slot>`)}</div>`;', "import {html} from 'lit'; import {when} from 'lit/directives/when.js';"));
  assert.equal(result.status, 'partial');
  assert.equal(result.templates.length, 2);
  const nested = result.templates.find(template => template.role === 'unresolved')!;
  assert.equal(nested.guards[0].expression.kind, 'unsupported');
  assert.ok(nested.guards[0].expression.raw.startsWith('when('));
  assert.equal(elements(nested.roots)[0].slot!.name, 'after');
});

test('composite attrs, dynamic slot names and conflicting targets are reported rather than simplified', () => {
  const result = read(wrap('return html`<button disabled ?disabled=${this.disabled} class="prefix ${this.kind}"><slot name=${this.slotName}></slot></button>`;'));
  assert.equal(result.templates[0].complete, true);
  for (const code of ['duplicate-attribute-target', 'attribute-composition-unsupported', 'slot-identity-unproven']) assert.ok(result.problems.some(problem => problem.code === code));
  const slot = elements(root(result, 'button').children)[0];
  assert.equal(slot.slot, undefined);
  assert.equal(expression(slot.attributes[0]).kind, 'property');
});

test('malformed HTML, unsupported escapes and namespaces retain raw source without claiming complete topology', () => {
  for (const [template, code] of [
    ['<div><slot></div>', 'html-closing-tag-mismatch'],
    ['<button title="missing></button>', 'unclosed-html-attribute'],
    ['<div/>', 'nonvoid-self-closing-html-unsupported'],
    ['<${this.tag}></${this.tag}>', 'dynamic-or-unsupported-tag'],
    ['<svg></svg>', 'raw-text-or-namespace-element-unsupported'],
    ['<div>\\n</div>', 'escaped-template-literal-unsupported'],
  ]) {
    const source = wrap('return html`' + template + '`;');
    const result = read(source);
    assert.equal(result.templates[0].complete, false, template);
    assert.ok(result.problems.some(problem => problem.code === code), template);
    assert.equal(result.templates[0].raw, 'html`' + template + '`');
  }
});

test('all source spans refer to exact bytes including unquoted interpolation boundaries', () => {
  const source = wrap('return html`<button aria-label=${ifDefined(this.label)}>A${this.content}<slot></slot>${this.after}</button>`;');
  const result = read(source);
  const validateExpression = (expression: LitExpression) => assert.equal(source.slice(expression.span.start, expression.span.end), expression.raw);
  const visit = (nodes: LitNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'text') assert.equal(source.slice(node.span.start, node.span.end), node.value);
      if (node.kind === 'expression') validateExpression(node.expression);
      if (node.kind === 'element') {
        assert.ok(source.slice(node.span.start, node.span.end).startsWith('<' + node.rawTag));
        assert.ok(source.slice(node.span.start, node.span.end).endsWith('</' + node.rawTag + '>'));
        for (const attribute of node.attributes) for (const part of attribute.parts) {
          if (part.kind === 'expression') validateExpression(part.expression);
          else assert.equal(source.slice(part.span.start, part.span.end), part.value);
        }
        visit(node.children);
      }
    }
  };
  for (const template of result.templates) { assert.equal(source.slice(template.span.start, template.span.end), template.raw); visit(template.roots); }
  const attribute = root(result, 'button').attributes[0];
  assert.equal(source.slice(attribute.span.start, attribute.span.end), 'aria-label=${ifDefined(this.label)}');
});

test('invalid source hash, syntax and ambiguous class identity fail before binding extraction', () => {
  const source = wrap('return html`<button></button>`;');
  const altered = readLitTemplateBindings({ source: source + ' ', sourceSha256: sha(source), modulePath: 'control.ts', className: 'Control' });
  assert.equal(altered.status, 'refused');
  assert.equal(altered.templates.length, 0);
  assert.equal(read('class Control { render( {').status, 'refused');
  assert.equal(read(source + '\nclass Control {}').status, 'refused');
  assert.equal(read(source, 'Missing').status, 'refused');
});

test('unsupported render control flow cannot silently advertise nested templates as returned', () => {
  const result = read(wrap('for (const item of this.items) { return html`<button></button>`; }'));
  assert.equal(result.templates.length, 1);
  assert.equal(result.templates[0].role, 'unresolved');
  assert.ok(result.problems.some(problem => problem.code === 'render-statement-uninterpreted'));
  assert.ok(result.problems.some(problem => problem.code === 'returned-template-missing'));
});

test('regular-function this cannot impersonate component properties while arrow this keeps lexical identity', () => {
  const result = read(wrap('return html`<div>${helper(function () { return html`<button aria-label=${ifDefined(this.label)}></button>`; })}${helper(() => html`<button aria-label=${ifDefined(this.label)}></button>`)}</div>`;'));
  const nested = result.templates.filter(template => template.role === 'unresolved');
  assert.equal(nested.length, 2);
  assert.equal(expression(elements(nested[0].roots)[0].attributes[0]).kind, 'unsupported');
  assert.equal(expression(elements(nested[1].roots)[0].attributes[0]).kind, 'if-defined');
  assert.equal(nested.every(template => template.guards[0].expression.kind === 'unsupported'), true, 'neither helper call is treated as a proved render path');
});

test('HTML contexts with implicit repair cannot be mislabeled as complete browser topology', () => {
  for (const [html, code] of [
    ['<table><tr><td>Cell</td></tr></table>', 'html-parser-context-unproven'],
    ['<p><div>Text</div></p>', 'html-parser-context-unproven'],
    ['<select><div>Text</div></select>', 'html-parser-context-unproven'],
    ['<button><div><button>Text</button></div></button>', 'html-implicit-reparenting-unsupported'],
    ['<a><a>Text</a></a>', 'html-implicit-reparenting-unsupported'],
  ]) {
    const result = read(wrap('return html`' + html + '`;'));
    assert.equal(result.templates[0].complete, false);
    assert.ok(result.problems.some(problem => problem.code === code));
  }
});

test('duplicate slot distribution and encoded literal text remain unresolved rather than silently remapped', () => {
  const result = read(wrap('return html`<div title="A &amp; B">A &amp; B<slot name="same"></slot><slot name="same">fallback</slot></div>`;'));
  assert.ok(result.problems.some(problem => problem.code === 'duplicate-slot-name'));
  assert.equal(result.problems.filter(problem => problem.code === 'html-entity-decoding-unproven').length, 2);
  assert.equal(result.status, 'partial');
  assert.equal(elements(result.templates[0].roots).filter(element => element.slot?.name === 'same').length, 2);
});

test('shared template after conditional fallthrough retains every path and refuses singular selection', () => {
  const result = read(wrap('if (this.ready) {} return html`<button></button>`;'));
  assert.equal(result.templates.length, 1);
  assert.equal(result.templates[0].role, 'unresolved');
  assert.deepEqual(result.templates[0].guardAlternatives!.map(guards => guards.map(guard => [guard.expression.raw, guard.when])), [[['this.ready', 'truthy']], [['this.ready', 'falsy']]]);
  assert.ok(result.problems.some(problem => problem.code === 'template-multiple-paths-unresolved'));
});

test('optional-call/property syntax and nonfinite number literals are preserved without inventing direct bindings', () => {
  for (const expressionSource of ['ifDefined?.(this.label)', 'ifDefined(this?.label)', 'this?.label', '1e999']) {
    const result = read(wrap('return html`<button data-value=${' + expressionSource + '}></button>`;'));
    assert.equal(expression(root(result, 'button').attributes[0]).kind, 'unsupported');
    assert.ok(result.problems.some(problem => problem.code === 'expression-unsupported'));
    assert.doesNotThrow(() => JSON.stringify(result));
  }
});

test('slash immediately following an unquoted value belongs to that value, not a self-closing tag', () => {
  for (const [html, expected] of [['<input value=foo/>', 'foo/'], ['<input value=foo />', 'foo']]) {
    const result = read(wrap('return html`' + html + '`;'));
    assert.equal(result.status, 'read');
    const parts = root(result, 'input').attributes[0].parts;
    assert.equal(parts[0].kind === 'text' && parts[0].value, expected);
  }
});

test('async and generator render methods cannot present yielded templates as returned TemplateResults', () => {
  for (const modifier of ['async ', '*']) {
    const result = read("import {html} from 'lit'; class Control { " + modifier + 'render(){return html`<button></button>`;} }');
    assert.equal(result.status, 'refused');
    assert.equal(result.templates.length, 0);
    assert.ok(result.problems.some(problem => problem.code === 'render-method-shape-unsupported'));
  }
});

test('unresolved alternative paths on a parent invalidate nested-template selection too', () => {
  const result = read(wrap('if(this.ready){} return html`<button>${this.active && html`<span>${this.before && html`<slot name="before"></slot>`}</span>`}</button>`;'));
  const parent = result.templates[0];
  assert.equal(parent.guardAlternatives!.length, 2);
  assert.equal(result.templates.length, 3);
  for (const nested of result.templates.slice(1)) {
    assert.equal(nested.role, 'unresolved');
    assert.ok(nested.unresolvedAncestorTemplateIds?.includes(parent.id));
    assert.ok(result.problems.some(problem => problem.code === 'ancestor-template-selection-unresolved' && problem.span?.start === nested.span.start));
  }
});

test('same-name slots across nested templates are not assumed to have independent distribution', () => {
  const result = read(wrap('return html`<div>${true ? html`<slot name="same"></slot>` : null}<slot name="same"></slot></div>`;'));
  assert.equal(result.status, 'partial');
  assert.ok(result.problems.some(problem => problem.code === 'cross-template-slot-distribution-unresolved'));
  assert.equal(result.templates.length, 2);
});

test('html used as an attribute value is not advertised as rendered child topology', () => {
  const result = read(wrap('return html`<div title=${html`<slot name="not-a-child"></slot>`}></div>`;'));
  assert.equal(result.status, 'partial');
  assert.equal(result.templates[1].role, 'unresolved');
  assert.ok(result.problems.some(problem => problem.code === 'template-outside-child-position'));
  assert.equal(root(result, 'div').children.length, 0);
  assert.equal(expression(root(result, 'div').attributes[0]).kind, 'template', 'source expression is retained without claiming a DOM child');
});

test('opaque render control flow stays explicit even when it contains no literal html', () => {
  for (const statement of [
    'try { return this.other(); } catch {}',
    'switch(this.ready) { case true: return this.other(); }',
    'while(this.ready) { return this.other(); }',
    'throw new Error("stop");',
  ]) {
    const result = read(wrap(statement + ' return html`<button></button>`;'));
    assert.ok(result.problems.some(problem => problem.code === 'render-control-flow-unresolved'));
    assert.equal(result.status, 'partial');
    assert.equal(result.templates.length, 1, 'source template is retained, not claimed reachable');
  }
  for (const statement of ['const label = (() => { return "label"; })();', 'function getLabel() { return "label"; }']) {
    const result = read(wrap(statement + ' return html`<button></button>`;'));
    assert.ok(!result.problems.some(problem => problem.code === 'render-control-flow-unresolved'), 'a nested function return is not a render return');
  }
});

test('render instance writes cannot make post-render scalar observations a branch witness', () => {
  for (const statement of [
    'this.href = "changed";', 'this.href ||= "changed";', 'this.count++;', '--this.count;', 'delete this.href;',
    'this["href"] = "changed";', 'this.state.href = "changed";', '[this.href] = ["changed"];', '({href:this.href} = other);',
    '(this as any).href = "changed";', 'this!.href = "changed";',
    '(() => { this.href = "changed"; })();',
    'const later = () => { this.href = "changed"; };',
    '(function () { this.href = "changed"; }).call(this);',
    'function update() { this.href = "changed"; } update.apply(this);',
    'const update = function () { this.href = "changed"; }; update.bind(this)();',
    '(function () { this.href = "changed"; }).call(this as any);',
  ]) {
    const result = read(wrap(statement + ' return html`<button></button>`;'));
    assert.ok(result.problems.some(problem => problem.code === 'render-state-mutation-unresolved'), statement);
    assert.equal(result.status, 'partial');
    assert.equal(result.templates.length, 1, 'syntax remains inspectable without selecting a render branch');
  }
  const inAttribute = read(wrap('return html`<button data-side-effect=${this.href = "changed"}></button>`;'));
  assert.ok(inAttribute.problems.some(problem => problem.code === 'render-state-mutation-unresolved'));
  for (const statement of ['let local; [local = this.href] = [];', 'const callback = function () { this.href = "other receiver"; };']) {
    assert.ok(!read(wrap(statement + ' return html`<button></button>`;')).problems.some(problem => problem.code === 'render-state-mutation-unresolved'), 'reads and another function receiver are not component writes');
  }
  const actual = readLitTemplateBindings(fixture);
  assert.equal(actual.templates.length, 6);
  assert.ok(!actual.problems.some(problem => problem.code === 'render-state-mutation-unresolved'));
});
