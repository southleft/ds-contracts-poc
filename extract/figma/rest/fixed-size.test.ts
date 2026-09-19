import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpSet } from '../types.js';
const box = { x: 100, y: 100, width: 18.125, height: 20.0625 };
const child = (extra: Partial<RestNode> = {}): RestNode => ({ id: '1:3', name: 'Indicator', type: 'FRAME', absoluteBoundingBox: box, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', ...extra });
function capture(node = child(), parent: Partial<RestNode> = {}) {
  const component = { id: '1:2', name: 'Only', type: 'COMPONENT', layoutMode: 'HORIZONTAL', children: [node], ...parent };
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:2': { document: component } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Only;
  return set.variants[0].children![0];
}
test('REST carries each explicit fixed in-flow manual-box dimension exactly', () => {
  assert.deepEqual(capture().fixedSize, { width: 18.125, height: 20.0625 });
  assert.deepEqual(capture(child({ layoutSizingVertical: 'HUG' })).fixedSize, { width: 18.125 });
  assert.deepEqual(capture(child({ layoutSizingHorizontal: 'FILL' })).fixedSize, { height: 20.0625 });
  assert.equal(capture(child({ layoutSizingHorizontal: undefined, layoutSizingVertical: undefined })).fixedSize, undefined);
});
test('fixedSize never duplicates another geometry class or infers a size from an unconstrained axis', () => {
  for (const extra of [{ type: 'TEXT' }, { type: 'INSTANCE' }, { type: 'COMPONENT' }, { layoutMode: 'HORIZONTAL' }, { layoutPositioning: 'ABSOLUTE' }, { absoluteBoundingBox: null }] as Partial<RestNode>[]) {
    assert.equal(capture(child(extra)).fixedSize, undefined, JSON.stringify(extra));
  }
  assert.equal(capture(child(), { layoutMode: 'NONE' }).fixedSize, undefined);
  assert.equal(capture(child({ layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' })).fixedSize, undefined);
});
test('a rotated manual box requires both fixed axes; a small nonzero rotation is not rounded away', () => {
  for (const rotation of [Math.PI / 2, 0.00000001]) {
    assert.deepEqual(capture(child({ rotation })).fixedSize, { width: 18.125, height: 20.0625 });
    assert.equal(capture(child({ rotation, layoutSizingVertical: 'HUG' })).fixedSize, undefined);
  }
});
