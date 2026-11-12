import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Convention font-weight-initial-normal: a text that no part's font-weight reaches (a field's placeholder, a closed
 *  select's label) draws at CSS's initial weight, Regular (400), as the browser does. A declared weight still wins.
 *  Off, such a text draws at the writer's fallback face, Medium. */
function faces(conventions: string[]): Record<string, string> {
  const tokens = { primitives: { w: { $type: 'number', bold: { $value: 600 } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.field', name: 'Field', version: '0.1.0', status: 'draft', description: 'A label over a field',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, parts: {
      heading: { text: 'Label', tokens: { 'font-weight': '{w.bold}' } },
      value: { text: 'mm/dd/yyyy' },
    } } },
    bindings: { code: { anchors: { importPath: 'test/Field', export: 'Field' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map(), conventions: new Set(conventions) });
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { variants: Array<{ spec: any }> };
  const out: Record<string, string> = {};
  const walk = (n: any) => { if (n.type === 'text') out[n.name] = n.fontStyle; (n.children ?? []).forEach(walk); };
  walk(data.variants[0]!.spec);
  return out;
}

test('on: a text no font-weight reaches draws Regular; a declared weight still wins', () => {
  assert.deepEqual(faces(['font-weight-initial-normal']), { heading: 'Semi Bold', value: 'Regular' });
});

test('off: such a text draws the writer fallback, Medium', () => {
  assert.deepEqual(faces([]), { heading: 'Semi Bold', value: 'Medium' });
});
