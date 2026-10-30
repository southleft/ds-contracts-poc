/** A filled path can use its existing center-origin rotation channel only
 * when the captured local matrix is a proper rigid rotation. REST serializes
 * the four coefficients independently; the 1e-12 allowance covers that
 * numerical noise, not a supported scale, shear or reflection. No coefficient
 * or angle is rounded, and the original matrix remains in localGeometry. */
export function filledPathRigidRotation(transform: unknown, declaredRadians?: unknown): number | undefined {
  if (!Array.isArray(transform) || transform.length !== 2 ||
      transform.some(row => !Array.isArray(row) || row.length !== 3 ||
        row.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e6))) return undefined;
  const [[a,c],[b,d]] = transform as number[][];
  const angle = Math.atan2(b,a), cos = Math.cos(angle), sin = Math.sin(angle);
  const close = (actual: number, expected: number) => Math.abs(actual-expected) <= 1e-12;
  if (a*d-b*c <= 0 || !close(a,cos) || !close(b,sin) || !close(c,-sin) || !close(d,cos)) return undefined;
  if (declaredRadians !== undefined && (typeof declaredRadians !== 'number' || !Number.isFinite(declaredRadians) ||
      !close(Math.cos(declaredRadians),cos) || !close(Math.sin(declaredRadians),sin))) return undefined;
  return angle * 180 / Math.PI;
}
