import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Convention text-align-packs-text-box: a text part's box with no layout of its own packs its text as CSS text-align
 *  places the line (center → CENTER, right → MAX), and a <button> that declares no text-align takes the user-agent
 *  stylesheet's center. A declared start alignment still wins. Off, every such box packs its text at the start. */
function boxes(conventions: string[]): Record<string, [string | undefined, string | undefined]> {
  const tokens = { primitives: { s: { $type: 'dimension', w: { $value: '32px' }, p: { $value: '4px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const box = (extra: object) => ({ tokens: { width: '{s.w}', 'padding-left': '{s.p}', 'padding-right': '{s.p}' }, ...extra });
  const contract = ContractSchema.parse({
    id: 'test.pages', name: 'Pages', version: '0.1.0', status: 'draft', description: 'Page buttons',
    states: [], semantics: { element: 'nav' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, parts: {
      page: box({ element: 'button', text: '1' }),
      left: box({ element: 'button', text: '2', declared: { 'text-align': 'left' } }),
      tail: box({ text: '25', declared: { 'text-align': 'right' } }),
    } } },
    bindings: { code: { anchors: { importPath: 'test/Pages', export: 'Pages' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map(), conventions: new Set(conventions) });
  const data = engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { variants: Array<{ spec: any }> };
  const out: Record<string, [string | undefined, string | undefined]> = {};
  for (const c of data.variants[0]!.spec.children) out[c.name] = [c.layout?.primary, c.children?.[0]?.textAlignH];
  return out;
}

test('on: a button centers its text; a declared right packs it at the end; a declared left stays at the start', () => {
  assert.deepEqual(boxes(['text-align-packs-text-box']), { page: ['CENTER', 'CENTER'], left: ['MIN', 'LEFT'], tail: ['MAX', 'RIGHT'] });
});

test('off: every box packs its text at the start', () => {
  assert.deepEqual(boxes([]), { page: ['MIN', undefined], left: ['MIN', 'LEFT'], tail: ['MIN', 'RIGHT'] });
});
