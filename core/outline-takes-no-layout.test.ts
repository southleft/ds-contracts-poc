import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Convention outline-takes-no-layout: a stroke drawn from a CSS outline takes no layout space (strokesIncludedInLayout
 *  false), as an outline never does in CSS; a border stroke is untouched. Off, the outline's frame says nothing and
 *  Figma counts its stroke in layout, insetting the children by its weight. */
function strokeLayout(conventions: string[]): Record<string, boolean | undefined> {
  const tokens = { primitives: { s: { $type: 'dimension', one: { $value: '1px' }, neg: { $value: '-1px' } }, c: { $type: 'color', ink: { $value: '#161616' } } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.switcher', name: 'Switcher', version: '0.1.0', status: 'draft', description: 'An outlined row of bordered buttons',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, declared: { 'outline-style': 'solid' },
      tokens: { 'outline-width': '{s.one}', 'outline-offset': '{s.neg}', 'outline-color': '{c.ink}' },
      parts: { tab: { text: 'Tab', declared: { 'border-top-style': 'solid' }, tokens: { 'border-top-width': '{s.one}', 'border-top-color': '{c.ink}' } } } } },
    bindings: { code: { anchors: { importPath: 'test/Switcher', export: 'Switcher' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens: tokens as never, icons: new Map(), conventions: new Set(conventions) });
  const spec = (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { variants: Array<{ spec: any }> }).variants[0]!.spec;
  return { root: spec.strokesIncludedInLayout, tab: spec.children[0].strokesIncludedInLayout };
}

test('on: the outline stroke takes no layout space; the border stroke is untouched', () => {
  assert.deepEqual(strokeLayout(['outline-takes-no-layout']), { root: false, tab: undefined });
});

test('off: neither frame names the field', () => {
  assert.deepEqual(strokeLayout([]), { root: undefined, tab: undefined });
});
