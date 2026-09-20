/** How a native number may differ from the planned one. Never a tolerance in
 * pixels: only representations Figma is known to produce. */

/** A stored value: itself, or its float32 (Figma stores numbers as float32). */
export const storedAs = (actual: unknown, planned: number): boolean =>
  actual === planned || actual === Math.fround(planned);

/** Spacing of float32 values at this magnitude (one unit in the last place). */
export const ulp32 = (magnitude: number): number => {
  const f = new Float32Array([Math.abs(magnitude)]), i = new Int32Array(f.buffer);
  const low = f[0]; i[0] += 1; return f[0] - low;
};

/** A COMPUTED position. An absolute child's x/y is not kept as written: Figma
 * recomputes it in float32 from the parent's extent when the parent is resized,
 * and under a parent of FRACTIONAL size that arithmetic rounds (planned -8 read
 * back -7.999999046325684 under a parent 18.3906 high; live, 2026-09-18). The
 * bound is the rounding error of that arithmetic, not a pixel tolerance: one
 * float32 unit at the magnitude of its largest operand (parent extent, offset
 * and the child's own extent added together), about 2e-6 px here. The value
 * read back must itself be a float32. With an integer-sized parent the
 * arithmetic is exact, so only the stored forms are accepted there. */
export function positionedAs(actual: unknown, planned: number, parentExtent: unknown, ownExtent: unknown): boolean {
  if (storedAs(actual, planned)) return true;
  if (typeof actual !== 'number' || !Number.isFinite(actual) || Math.fround(actual) !== actual || !Number.isFinite(planned) ||
      typeof parentExtent !== 'number' || !Number.isFinite(parentExtent) || Number.isInteger(parentExtent) ||
      typeof ownExtent !== 'number' || !Number.isFinite(ownExtent)) return false;
  return Math.abs(actual - planned) <= ulp32(Math.abs(parentExtent) + Math.abs(planned) + Math.abs(ownExtent));
}
