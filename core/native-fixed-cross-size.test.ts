import assert from 'node:assert/strict';
import test from 'node:test';
import { predictNativeFixedCrossSize } from './native-fixed-cross-size.js';

function fixture(channel: 'width' | 'height' = 'height', alignment = 'CENTER') {
  const cross = channel === 'height' ? 'y' : 'x';
  const base = { visible: true, width: 100, height: 100, x: 0, y: 0,
    relativeTransform: [[1, 0, 0], [0, 1, 0]], targetAspectRatio: null,
    layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED',
    minWidth: null, maxWidth: null, minHeight: null, maxHeight: null };
  const position = alignment === 'MIN' ? 5 : alignment === 'MAX' ? 21 : 13;
  const child = { id: 'flow', type: 'RECTANGLE', parentId: 'root', childIds: [], metadata: {}, values: {
    ...base, [channel]: 10, [cross]: position,
    relativeTransform: channel === 'height' ? [[1, 0, 0], [0, 1, position]] : [[1, 0, position], [0, 1, 0]],
    layoutPositioning: 'AUTO', layoutAlign: 'INHERIT', layoutGrow: 0,
  } };
  const absolute = { id: 'absolute', type: 'ELLIPSE', parentId: 'root', childIds: [], metadata: {}, values: {
    ...base, width: 6, height: 6, layoutPositioning: 'ABSOLUTE',
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
  } };
  const root = { id: 'root', type: 'COMPONENT', parentId: 'set', childIds: ['flow', 'absolute'], metadata: {}, values: {
    ...base, [channel]: 40, layoutMode: channel === 'height' ? 'HORIZONTAL' : 'VERTICAL',
    layoutWrap: 'NO_WRAP', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED',
    strokesIncludedInLayout: true, strokeAlign: 'INSIDE', counterAxisAlignItems: alignment,
    paddingTop: 3, paddingBottom: 5, strokeTopWeight: 2, strokeBottomWeight: 4,
    paddingLeft: 3, paddingRight: 5, strokeLeftWeight: 2, strokeRightWeight: 4,
  } };
  const set = { id: 'set', type: 'COMPONENT_SET', parentId: 'page', childIds: ['root'], metadata: {}, values: { layoutMode: 'NONE' } };
  return { nodes: [set, root, child, absolute] as any[], root, child, absolute, set };
}

test('fixed cross-axis prediction preserves absolute leaves and accounts for asymmetric insets', () => {
  for (const channel of ['width', 'height'] as const) for (const alignment of ['MIN', 'CENTER', 'MAX']) {
    const f = fixture(channel, alignment), before = structuredClone(f.nodes);
    const changes = predictNativeFixedCrossSize(f.nodes, 'root', channel, 52);
    assert.deepEqual(f.nodes, before, 'prediction cannot mutate its evidence');
    assert.deepEqual(changes.map(t => t.nodeId), ['root', 'flow']);
    assert.deepEqual(changes[0].after, { [channel]: 52 });
    const cross = channel === 'height' ? 'y' : 'x';
    assert.equal(changes[1].after[cross], alignment === 'MIN' ? 5 : alignment === 'MAX' ? 33 : 19);
  }
});

test('the independently measured fractional native center is predicted exactly', () => {
  const f = fixture();
  Object.assign(f.root.values, { height: 18.390625, paddingTop: 0, paddingBottom: 0, strokeTopWeight: 1, strokeBottomWeight: 1 });
  Object.assign(f.child.values, { height: 16, y: 1.1953125, relativeTransform: [[1, 0, 0], [0, 1, 1.1953125]] });
  const changes = predictNativeFixedCrossSize(f.nodes, 'root', 'height', 20);
  assert.deepEqual(changes[1].after, { y: 2, relativeTransform: [[1, 0, 0], [0, 1, 2]] });
});

test('missing layout evidence and dependent or hidden geometry refuse before any prediction', () => {
  const mutations: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.child.values.visible = false; },
    f => { f.root.values.visible = false; },
    f => { delete (f.root.values as any).strokesIncludedInLayout; },
    f => { (f.root.values as any).targetAspectRatio = 2; },
    f => { f.root.values.layoutWrap = 'WRAP'; },
    f => { f.root.values.strokeAlign = 'OUTSIDE'; },
    f => { f.root.values.paddingTop = Math.fround(3.333333); },
    f => { f.root.values.counterAxisSizingMode = 'AUTO'; },
    f => { f.set.values.layoutMode = 'HORIZONTAL'; },
    f => { f.child.values.layoutAlign = 'STRETCH'; },
    f => { f.child.values.layoutGrow = 1; },
    f => { (f.child.values as any).minHeight = 10; },
    f => { f.child.childIds.push('nested' as never); },
    f => { f.child.values.relativeTransform[0][1] = 1; },
    f => { f.child.values.y = 12; f.child.values.relativeTransform[1][2] = 12; },
    f => { f.absolute.values.constraints.vertical = 'SCALE'; },
    f => { f.nodes.push(f.child); },
    f => { f.root.childIds.push('missing'); },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const f = fixture(); mutate(f); const before = structuredClone(f.nodes);
    assert.throws(() => predictNativeFixedCrossSize(f.nodes, 'root', 'height', 52), /native-cross-size-/, String(i));
    assert.deepEqual(f.nodes, before);
  }
  for (const target of [0, -1, NaN, Infinity, 23, 52.98765, 16385]) {
    assert.throws(() => predictNativeFixedCrossSize(fixture().nodes, 'root', 'height', target), /native-cross-size-/);
  }
});
