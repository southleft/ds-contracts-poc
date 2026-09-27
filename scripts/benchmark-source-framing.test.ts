import assert from 'node:assert/strict';
import test from 'node:test';
import { paintBox, snapOutward, unionBox } from './benchmark-source-framing.js';

test('a fractional source root box snaps outward to whole pixels; an integer box is unchanged', () => {
  // The shadcn Switch: 32 × 18.390625 at offset (8, 8.796875).
  assert.deepEqual(snapOutward({ x: 8, y: 8.796875 }, { width: 32, height: 18.390625 }), { x: 8, y: 8, width: 32, height: 20, fractional: true });
  assert.deepEqual(snapOutward({ x: 8, y: 8 }, { width: 360, height: 68 }), { x: 8, y: 8, width: 360, height: 68, fractional: false });
  assert.deepEqual(snapOutward({ x: 3.5, y: 2 }, { width: 43.875, height: 20 }), { x: 3, y: 2, width: 45, height: 20, fractional: true });
  assert.throws(() => snapOutward({ x: 0, y: 0 }, { width: 0, height: 10 }), /source root box invalid/);
});

test('effects past the root box widen the source crop to all paint (the Switch shadow halo)', () => {
  const png = { width: 48, height: 36, data: new Uint8Array(48 * 36 * 4) };
  const paint = (x: number, y: number) => { png.data[(y * 48 + x) * 4 + 3] = 2; };
  for (let y = 9; y < 29; y++) { paint(7, y); paint(40, y); }
  assert.deepEqual(paintBox(png), { x: 7, y: 9, width: 34, height: 20 });
  const root = snapOutward({ x: 8, y: 8.796875 }, { width: 32, height: 18.390625 });
  assert.deepEqual(unionBox(root, paintBox(png)!), { x: 7, y: 8, width: 34, height: 21 });
  assert.equal(paintBox({ width: 2, height: 2, data: new Uint8Array(16) }), null);
  // Paint inside the root box leaves the crop equal to the root box.
  assert.deepEqual(unionBox({ x: 8, y: 8, width: 360, height: 68 }, { x: 8, y: 9, width: 360, height: 60 }), { x: 8, y: 8, width: 360, height: 68 });
});
