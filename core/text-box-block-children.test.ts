import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Convention text-box-stacks-block-children: a list item's text and its nested list are a block container's inline run
 *  and a block-level child, which CSS stacks (blockification); the text box lays them out as a column. An inline child
 *  shares the text's line and keeps the row. Off, every such box is a row. */
function boxes(conventions: string[]): Record<string, string | undefined> {
  const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.outline', name: 'Outline', version: '0.1.0', status: 'draft', description: 'A nested list',
    states: [], semantics: { element: 'ul' }, props: [],
    anatomy: { root: { declared: { display: 'block' }, parts: {
      item: { text: 'Level 1', declared: { display: 'list-item' }, parts: {
        nested: { declared: { display: 'block' }, parts: { leaf: { text: 'Level 2', declared: { display: 'list-item' } } } },
      } },
      tagged: { text: 'Item', declared: { display: 'list-item' }, parts: { badge: { text: 'new', declared: { display: 'inline' } } } },
    } } },
    bindings: { code: { anchors: { importPath: 'test/Outline', export: 'Outline' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map(), conventions: new Set(conventions) });
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { variants: Array<{ spec: any }> };
  const out: Record<string, string | undefined> = {};
  for (const c of data.variants[0]!.spec.children) out[c.name] = c.layout?.mode;
  return out;
}

test('on: a list item\'s text stacks above its nested list; an inline child keeps the row', () => {
  assert.deepEqual(boxes(['text-box-stacks-block-children']), { item: 'VERTICAL', tagged: 'HORIZONTAL' });
});

test('off: both text boxes are rows', () => {
  assert.deepEqual(boxes([]), { item: 'HORIZONTAL', tagged: 'HORIZONTAL' });
});

/** Convention line-break-alone-draws-empty-line: "Default tile<br><br><a>Link</a>" is three lines in CSS: the text, an
 *  empty line (the second <br>, alone on its line, at its line height) and the link. The first <br> ends the text's line
 *  and draws nothing. Off, both are empty frames, which fill the stack's height at run time. */
function lineBreaks(conventions: string[]): Array<[string, number | undefined]> {
  const br = { element: 'br', declared: { display: 'inline' }, literals: { 'line-height': '18px' } };
  const contract = ContractSchema.parse({
    id: 'test.breaks', name: 'Breaks', version: '0.1.0', status: 'draft', description: 'Two line breaks between a text and a link',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { text: 'Default tile', declared: { display: 'block' },
      parts: { first: br, second: br, link: { text: 'Link', declared: { display: 'inline' } } } } },
    bindings: { code: { anchors: { importPath: 'test/Breaks', export: 'Breaks' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(), conventions: new Set(conventions) });
  const spec = (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { variants: Array<{ spec: any }> }).variants[0]!.spec;
  assert.equal(spec.layout?.mode, 'VERTICAL');
  return spec.children.map((c: any) => [c.name, c.fixedHeight?.px]);
}

test('line breaks on: the <br> after content draws nothing, the one alone on its line is a line tall', () => {
  assert.deepEqual(lineBreaks(['line-break-alone-draws-empty-line']), [['label', undefined], ['second', 18], ['link', undefined]]);
});

test('line breaks off: both <br> stay empty frames with no height of their own', () => {
  assert.deepEqual(lineBreaks([]), [['label', undefined], ['first', undefined], ['second', undefined], ['link', undefined]]);
});
