import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpSet } from '../types.js';

const path = 'M0 0L5 5L10 10L2 10C0.89543 10 0 9.10457 0 8L0 0Z';
const cos = Math.cos(Math.PI / 4);

function capture(extra: Partial<RestNode> = {}) {
  const arrow: RestNode = {
    id: '1:3', name: 'Arrow', type: 'VECTOR', rotation: -Math.PI / 4,
    size: { x: 10, y: 10 }, layoutPositioning: 'ABSOLUTE',
    relativeTransform: [[cos, cos, 48], [-cos, cos, 27]],
    constraints: { horizontal: 'CENTER', vertical: 'BOTTOM' },
    fills: [{ type: 'SOLID', color: { r: 0.15, g: 0.15, b: 0.16, a: 1 } }],
    strokes: [], effects: [],
    fillGeometry: [{ path, windingRule: 'NONZERO' }],
    ...extra,
  };
  const parent: RestNode = {
    id: '1:2', name: 'Tip', type: 'COMPONENT', layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 110, height: 28 },
    size: { x: 110, y: 28 }, children: [arrow],
  };
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:2': { document: parent } } } as never);
  const child = (result.dump.Tip as DumpSet).variants[0].children![0];
  return { child, report: result.report };
}

test('a rotated filled vector keeps its local path and the pre-rotation box', () => {
  const { child, report } = capture();
  assert.equal(child.abs, undefined);
  assert.equal(child.shape?.kind, 'path');
  assert.equal(child.shape?.width, 10);
  assert.equal(child.shape?.height, 10);
  assert.equal(child.shape?.rotation, -45);
  assert.equal(child.shape?.paths?.[0]?.data, path);
  assert.equal(child.shape?.x, 50.07);
  assert.equal(child.shape?.y, 22);
  assert.equal(child.shape?.bottom, -4);
  assert.equal(JSON.stringify(report.degradations).includes('vector-geometry-unsupported'), false);
});

test('a skewed matrix stays an unpainted box; a rigid matrix supplies an undeclared rotation', () => {
  assert.equal(capture({ relativeTransform: [[1, 0.2, 48], [0, 1, 27]] }).child.shape, undefined);
  assert.equal(capture({ rotation: undefined }).child.shape?.rotation, -45);
});

test('a vertically mirrored filled vector keeps its path and places the reflection in the visual box', () => {
  const { child } = capture({
    rotation: undefined,
    size: { x: 10, y: 8 },
    relativeTransform: [[1, 0, 4], [0, -1, 20]],
    fillGeometry: [{ path: 'M0 0L10 0L10 8L0 8Z', windingRule: 'NONZERO' }],
  });
  assert.equal(child.shape?.kind, 'path');
  assert.equal(child.shape?.rotation, undefined);
  assert.equal(child.shape?.x, 4);
  assert.equal(child.shape?.y, 12);
  assert.equal(child.shape?.paths?.[0]?.data, 'M0 0L10 0L10 8L0 8Z');
  assert.deepEqual(child.shape?.affineTransform, [[1, 0, 4], [0, -1, 20]]);
});

const ramp = [
  { position: 0, color: { r: 0.16, g: 0.67, b: 0.93, a: 1 } },
  { position: 1, color: { r: 0.13, g: 0.62, b: 0.85, a: 1 } },
];
test('a linear gradient vector keeps its path so the ramp can be clipped to the mark', () => {
  const { child } = capture({
    rotation: undefined,
    relativeTransform: [[1, 0, 0], [0, 1, 0]],
    fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }], gradientStops: ramp }],
  });
  assert.equal(child.shape?.kind, 'path');
  assert.equal(child.fill, undefined);
  assert.deepEqual(child.gradient?.start, { x: 0.5, y: 0 });
  assert.deepEqual(child.gradient?.end, { x: 0.5, y: 1 });
});
test('percentage gradient handles are stored in normalized object space', () => {
  const { child } = capture({
    rotation: undefined,
    relativeTransform: [[1, 0, 0], [0, 1, 0]],
    fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 50, y: 0 }, { x: 50, y: 99.2583 }, { x: 0.37, y: 0 }], gradientStops: ramp }],
  });
  assert.equal(child.shape?.kind, 'path');
  assert.equal(child.gradient?.start.x, 0.5);
  assert.equal(child.gradient?.end.y, 0.9926);
});
test('an open filled subpath is stored closed', () => {
  const { child } = capture({
    rotation: undefined,
    relativeTransform: [[1, 0, 1], [0, 1, 2]],
    fillGeometry: [{ path: 'M0 0L10 0L10 10L0 10', windingRule: 'NONZERO' }],
  });
  assert.equal(child.shape?.paths?.[0]?.data, 'M 0 0 L 10 0 L 10 10 L 0 10 Z');
});
