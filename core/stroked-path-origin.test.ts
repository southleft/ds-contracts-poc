import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { strokedPathGeometryIssue, strokedPathSvg } from '../packages/schema/src/stroked-path.js';

const fixture = JSON.parse(readFileSync(new URL('../extract/figma/fixtures/original-network-native-origin.json', import.meta.url), 'utf8'));
function shape(data: string, width = fixture.readback.width, height = fixture.readback.height) {
  return { width, height, strokePath: { data, cap: 'ROUND' as const, join: 'ROUND' as const, miterLimit: 4,
    viewport: { width: 24, height: 24, x: 1.5517578125, y: 1.897247314453125 } } };
}
test('original network and independent native readback retain all coordinates', () => {
  for (const data of [fixture.original, fixture.readback.paths[0].data]) {
    const s = shape(data), before = JSON.stringify(s);
    assert.equal(strokedPathGeometryIssue(s), undefined);
    assert.ok(strokedPathSvg(s).includes(data));
    assert.equal(JSON.stringify(s), before);
    assert.equal(strokedPathGeometryIssue({ ...s, width: s.width + 0.001 }), 'stroked-path-bounds-mismatch');
  }
});
test('origin qualification scales with native precision and refuses resolvable offsets of either sign', () => {
  for (const extent of [0.001, 1, 20, 1000]) {
    for (const offset of [-extent * 2 ** -20, extent * 2 ** -20]) {
      assert.equal(strokedPathGeometryIssue(shape(`M${offset} 0L${extent + offset} 1`, extent, 1)), 'stroked-path-bounds-mismatch');
      assert.equal(strokedPathGeometryIssue(shape(`M0 ${offset}L1 ${extent + offset}`, 1, extent)), 'stroked-path-bounds-mismatch');
    }
  }
});
test('zero-height paths cannot acquire any vertical offset', () => {
  assert.equal(strokedPathGeometryIssue(shape('M0 0L10 0', 10, 0)), undefined);
  for (const offset of [1e-13, -1e-13, 0.001])
    assert.equal(strokedPathGeometryIssue(shape(`M0 ${offset}L10 ${offset}`, 10, 0)), 'stroked-path-bounds-mismatch');
});
