/** Parent-owned allocation for an observed rigid instance transform.
 * CSS keeps an untransformed flow box, whereas the source's allocation is
 * the transformed bounds. Preserve both boxes and the exact linear matrix.
 * No component name, angle rounding, or axis-aligned source bbox is used. */
export type InstanceAffineObservation = {
  transform: [[number, number, number], [number, number, number]];
  localSize: {width: number; height: number};
};
export type InstanceAffineAllocation = {
  localSize: {width: number; height: number};
  allocation: {left: number; top: number; width: number; height: number};
  /** Transform inside a parent allocation frame, relative to origin (0,0). */
  normalizedTransform: InstanceAffineObservation['transform'];
};
export function allocateInstanceAffine(input: InstanceAffineObservation):
  {allocation: InstanceAffineAllocation} | {issue: string} {
  const m = input?.transform, size = input?.localSize;
  if (!Array.isArray(m) || m.length !== 2 || m.some(row => !Array.isArray(row) || row.length !== 3 || row.some(v => !Number.isFinite(v) || Math.abs(v) > 1e6)) ||
      !size || ![size.width, size.height].every(v => Number.isFinite(v) && v > 0 && v <= 1e6))
    return {issue: 'instance-affine-observation-invalid'};
  const [[a,c,tx],[b,d,ty]] = m;
  // Rigid rotation/reflection preserves paint widths. Scaling and skewing
  // require an additional source paint model; never silently render them.
  const tolerance = 1e-6;
  if (Math.abs(a*a+b*b-1) > tolerance || Math.abs(c*c+d*d-1) > tolerance || Math.abs(a*c+b*d) > tolerance || Math.abs(Math.abs(a*d-b*c)-1) > tolerance)
    return {issue: 'instance-affine-scale-or-skew-unsupported'};
  const xs = [0,a*size.width,c*size.height,a*size.width+c*size.height];
  const ys = [0,b*size.width,d*size.height,b*size.width+d*size.height];
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs)-left, height = Math.max(...ys)-top;
  if (![tx+left,ty+top,width,height].every(v => Number.isFinite(v) && Math.abs(v) <= 1e6))
    return {issue: 'instance-affine-allocation-out-of-range'};
  return {allocation: {localSize: {...size}, allocation: {left:tx+left,top:ty+top,width,height},
    normalizedTransform: [[a,c,-left || 0],[b,d,-top || 0]]}};
}
