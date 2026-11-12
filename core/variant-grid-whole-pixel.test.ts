import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Convention variant-grid-whole-pixel: the component set's grid steps each column and row by its cell's size rounded
 *  up, so variants whose own width is fractional (a measured text width) still start on whole pixels, as their exports
 *  do. Off, the grid steps by the exact sizes and later variants start on fractional pixels. */
async function origins(conventions: string[]): Promise<Array<[number, number]>> {
  const tokens = { primitives: { s: { $type: 'dimension', w: { $value: '82.40625px' }, h: { $value: '24.25px' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.tags', name: 'Tags', version: '0.1.0', status: 'draft', description: 'Tags whose text widths are fractional',
    states: [], semantics: { element: 'div' }, props: [{ name: 'type', type: { enum: ['a', 'b', 'c'] }, default: 'a',
      bindings: { figma: { kind: 'VARIANT', property: 'type', values: { a: 'a', b: 'b', c: 'c' } }, code: { prop: 'type' } } }],
    anatomy: { root: { layout: { display: 'flex', direction: 'row' }, tokens: { width: '{s.w}', height: '{s.h}' }, parts: { label: { text: 'Tag content' } } } },
    bindings: { code: { anchors: { importPath: 'test/Tags', export: 'Tags' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens: tokens as never, icons: new Map(), conventions: new Set(conventions) }), { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(contract, new Map([[contract.id, contract]])));
  const set = root.findOne((n: any) => n.type === 'COMPONENT_SET') as any;
  return set.children.map((c: any) => [c.x, c.y]);
}

test('on: every variant starts on a whole pixel', async () => {
  const at = await origins(['variant-grid-whole-pixel']);
  assert.equal(at.length, 3);
  assert.ok(at.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)), JSON.stringify(at));
});

test('off: a variant after a fractional-size one starts on a fractional pixel', async () => {
  const at = await origins([]);
  assert.ok(at.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y)), JSON.stringify(at));
});
