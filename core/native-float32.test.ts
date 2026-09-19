import assert from 'node:assert/strict';
import test from 'node:test';
import { positionedAs, storedAs, ulp32 } from './native-float32.js';

test('a stored number is itself or its float32, never a neighbour', () => {
  assert.equal(storedAs(0.5, 0.5), true);
  assert.equal(storedAs(18.390600204467773, 18.3906), true);
  assert.equal(storedAs(-7.999999046325684, -8), false);
  assert.equal(storedAs('8', 8), false);
});

test('a computed position may carry the float32 rounding of its parent arithmetic, only under a fractional parent', () => {
  const live = -7.999999046325684, parent = 18.390600204467773, own = 32.39059829711914; // read back on the canvas for a planned -8
  assert.equal(positionedAs(live, -8, parent, own), true);
  assert.equal(positionedAs(-8, -8, 18, own), true);
  assert.equal(ulp32(parent + 8 + own) < 4e-6, true); // the whole allowance here, in pixels
  // An integer-sized parent computes exactly: the same value is a real displacement there.
  assert.equal(positionedAs(live, -8, 18, own), false);
  // Beyond the rounding of that arithmetic, a rounded decimal, or a non-float32 value still refuse.
  assert.equal(positionedAs(Math.fround(-8 + 1e-5), -8, parent, own), false);
  assert.equal(positionedAs(-7.999999, -8, parent, own), false);
  assert.equal(positionedAs(-7, -8, parent, own), false);
  assert.equal(positionedAs(NaN, -8, parent, own), false);
  assert.equal(positionedAs(live, -8, undefined, own), false);
  assert.equal(positionedAs(live, -8, parent, undefined), false);
});
