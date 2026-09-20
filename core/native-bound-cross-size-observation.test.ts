import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeBoundCrossSizeObservationMatches as matches,
  type NativeBoundCrossSizeObservationPlan } from './native-bound-cross-size-observation.js';
import type { NativeSourceReadback } from './native-source-observation.js';
import type { NativeCrossSizeTransition } from './native-fixed-cross-size.js';

function fixture(): NativeBoundCrossSizeObservationPlan {
  const derived = [0, 1].flatMap((i): NativeCrossSizeTransition[] => [
    { nodeId: `root-${i}`, before: { height: 18.390625 }, after: { height: 20 } },
    { nodeId: `flow-${i}`, before: { y: 1.1953125, relativeTransform: [[1, 0, 0], [0, 1, 1.1953125]] },
      after: { y: 2, relativeTransform: [[1, 0, 0], [0, 1, 2]] } },
  ]);
  const absolute = [0, 1].map(i => ({ nodeId: `absolute-${i}`,
    before: { x: -11, y: -7, width: 54, height: 32.390625, relativeTransform: [[1, 0, -11], [0, 1, -7]] },
    after: { x: -11, y: -7, width: 54, height: 34, relativeTransform: [[1, 0, -11], [0, 1, -7]] } }));
  const baseline: NativeSourceReadback = {
    version: 1, status: 'native-readback-collected', receiptKind: 'independent-native-component-readback',
    operationId: 'op', fileKey: 'writable', planRevision: 'revision', acceptedContract: null,
    nativeQualification: 'unqualified', problems: [],
    nodes: [...derived, ...absolute].map(t => ({ id: t.nodeId, parentId: 'set', type: 'FRAME', childIds: [],
      metadata: { owner: 'op' }, values: { ...structuredClone(t.before), visible: true, fills: [] } })),
    tokens: { receipt: { variables: [
      { id: 'height', valuesByMode: { light: 18.390625, dark: 17 }, scopes: ['WIDTH_HEIGHT'] },
      { id: 'other', valuesByMode: { light: 4 } },
    ] } },
    images: [{ caseId: 'first', nodeId: 'root-0', pngBase64: 'baseline-image' }],
  };
  return { baseline, variable: { id: 'height', modeId: 'light', before: 18.390625, after: 20 }, derived, absolute };
}
function observation(plan: NativeBoundCrossSizeObservationPlan, side: 'before' | 'after', mask = 0) {
  const result = structuredClone(plan.baseline);
  result.tokens!.receipt.variables[0].valuesByMode.light = plan.variable[side];
  for (const t of plan.derived) Object.assign(result.nodes!.find(n => n.id === t.nodeId)!.values, structuredClone(t[side]));
  plan.absolute.forEach((t, i) => Object.assign(result.nodes!.find(n => n.id === t.nodeId)!.values,
    structuredClone(t[mask & (1 << i) ? 'after' : 'before'])));
  return result;
}
test('a variable and all derived geometry form one state; independent leaves can finish in either order', () => {
  const plan = fixture(), original = structuredClone(plan);
  for (const side of ['before', 'after'] as const) for (let mask = 0; mask < 4; mask++) {
    const r = observation(plan, side, mask), saved = structuredClone(r);
    assert.equal(matches(plan, r), true, `${side}/${mask}`);
    assert.equal(matches(plan, r, 'before'), side === 'before' && mask === 0);
    assert.equal(matches(plan, r, 'after'), side === 'after' && mask === 3);
    assert.deepEqual(r, saved);
  }
  assert.deepEqual(plan, original);
});
test('inconsistent native propagation and every independent edit refuse without normalizing them away', () => {
  const plan = fixture();
  const corruptions: Array<(r: NativeSourceReadback) => void> = [
    r => { r.nodes![0].values.height = 18.390625; },
    r => { r.nodes![1].values.y = 1.1953125; },
    r => { r.nodes![1].values.relativeTransform[1][2] = 1.1953125; },
    r => { r.nodes![2].values.height = 20.0000001; },
    r => { r.nodes![0].metadata.owner = 'foreign'; },
    r => { r.nodes![0].childIds.push('new-child'); },
    r => { r.nodes![4].values.fills = [{ type: 'SOLID' }]; },
    r => { r.nodes![4].values.height = 33; },
    r => { r.tokens!.receipt.variables[0].valuesByMode.light = 19; },
    r => { r.tokens!.receipt.variables[0].valuesByMode.dark = 18; },
    r => { r.tokens!.receipt.variables[1].valuesByMode.light = 5; },
    r => { r.tokens!.receipt.variables[0].scopes = []; },
    r => { r.nodes!.pop(); },
    r => { r.nodes!.push(structuredClone(r.nodes![0])); },
    r => { r.tokens!.receipt.variables.push(structuredClone(r.tokens!.receipt.variables[0])); },
    r => { r.planRevision = 'foreign'; },
    r => { r.problems.push('unreadable'); },
    r => { r.status = 'refused'; },
  ];
  corruptions.forEach((corrupt, i) => {
    const r = observation(plan, 'after', 3); corrupt(r); const saved = structuredClone(r);
    assert.equal(matches(plan, r), false, String(i)); assert.deepEqual(r, saved);
  });
  const variableOnly = observation(plan, 'before');
  variableOnly.tokens!.receipt.variables[0].valuesByMode.light = 20;
  assert.equal(matches(plan, variableOnly), false, 'variable-only write is not a valid native intermediate state');
});
test('ambiguous plans refuse; image evidence is explicitly outside this structural comparison', () => {
  for (const corrupt of [
    (p: NativeBoundCrossSizeObservationPlan) => { p.absolute.push(p.derived[0]); },
    (p: NativeBoundCrossSizeObservationPlan) => { p.derived = []; },
    (p: NativeBoundCrossSizeObservationPlan) => { p.derived[0].before.height = 18; },
    (p: NativeBoundCrossSizeObservationPlan) => { p.variable.after = p.variable.before; },
    (p: NativeBoundCrossSizeObservationPlan) => { p.variable.before = NaN; },
    (p: NativeBoundCrossSizeObservationPlan) => { p.variable.after = Infinity; },
  ]) {
    const plan = fixture(), r = observation(plan, 'after', 3); corrupt(plan);
    assert.equal(matches(plan, r), false);
  }
  const plan = fixture(), r = observation(plan, 'after', 3);
  r.images![0].pngBase64 = 'different-image';
  assert.equal(matches(plan, r, 'after'), true);
  for (const r of [null, {}, 0, { nodes: [] }]) assert.equal(matches(plan, r), false);
});
