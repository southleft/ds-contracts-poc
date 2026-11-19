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
