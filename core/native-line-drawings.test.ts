import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeLineDrawings, type NativeLineGeometry } from '../packages/schema/src/native-line.js';

const identity: NativeLineGeometry['transform'] = [[1, 0, 0], [0, 1, 0]];
const base: NativeLineGeometry = { length: 10, transform: identity, cap: 'NONE', align: 'CENTER' };
const source = (variantName: string, length: number) => ({ nodeId: variantName, variantName, transform: identity, length });

test('variants that draw the same line share one drawing', () => {
  const line = { ...base, observedSources: ['Size=sm, Tone=a', 'Size=sm, Tone=b', 'Size=lg, Tone=a'].map(name => source(name, 10)) };
  assert.deepEqual(nativeLineDrawings({ line }), [{ line }]);
});

test('distinct geometries group their variants once each', () => {
  const line = { ...base, observedSources: [source('Size=sm, Tone=a', 10), source('Size=sm, Tone=b', 10), source('Size=lg, Tone=a', 20), source('Size=lg, Tone=b', 20)] };
  const drawings = nativeLineDrawings({ line });
  assert.equal(drawings.length, 2);
  assert.deepEqual(drawings.map(drawing => [drawing.line.length, drawing.variantNames]), [
    [10, ['Size=sm, Tone=a', 'Size=sm, Tone=b']],
    [20, ['Size=lg, Tone=a', 'Size=lg, Tone=b']],
  ]);
});

test('a variant without a captured length draws the shared line', () => {
  const line = { ...base, observedSources: [source('Size=lg', 20), { nodeId: 'x', variantName: 'Size=sm', transform: identity }] };
  const drawings = nativeLineDrawings({ line });
  assert.deepEqual(drawings.find(drawing => drawing.variantNames?.includes('Size=sm'))?.line, line);
});
