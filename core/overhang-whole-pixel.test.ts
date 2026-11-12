import assert from 'node:assert/strict';
import test from 'node:test';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Profile convention absolute-overhang-whole-pixel: an absolutely placed part that overhangs its containing box's edge
 *  (a tooltip centered under a narrower anchor, a badge over its anchor's corner) is placed at whole pixels outward, as
 *  the browser's paint extent spans it; an offset inside the box stays as measured, and off, every offset is kept. */
test('with the convention, a negative absolute offset snaps outward to the whole pixel; an in-box offset is kept', () => {
  const placed = (literals: Record<string, string>) => ({ declared: { position: 'absolute' },
    literals: { width: '20px', height: '10px', 'background-color': '#000000', ...literals } });
  const contract = ContractSchema.parse({
    id: 'test.overhang', name: 'Overhang', version: '0.1.0', status: 'draft', description: 'Overhanging and in-box placement',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex' }, literals: { width: '24px', height: '24px' }, parts: {
      bubble: placed({ left: '-46.2109px', top: '32px' }),
      badge: placed({ top: '-4.40625px', right: '-4.40625px' }),
      inside: placed({ left: '3.5px', top: '2.25px' }),
    } } },
    bindings: { code: { anchors: { importPath: 'test/Overhang', export: 'Overhang' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const placed2 = (conventions: Set<string>) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(), conventions });
    const spec = (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as any).variants[0].spec;
    return (name: string) => spec.children.find((c: any) => c.name === name).absolute;
  };
  const on = placed2(new Set(['absolute-overhang-whole-pixel'])), off = placed2(new Set());
  assert.deepEqual(on('bubble'), { h: 'MIN', v: 'MIN', left: -47, top: 32 });
  assert.deepEqual(on('badge'), { h: 'MAX', v: 'MIN', right: -5, top: -5 });
  assert.deepEqual(on('inside'), { h: 'MIN', v: 'MIN', left: 3.5, top: 2.25 });
  assert.deepEqual([off('bubble'), off('badge')], [{ h: 'MIN', v: 'MIN', left: -46.2109, top: 32 }, { h: 'MAX', v: 'MIN', right: -4.40625, top: -4.40625 }]);
});
