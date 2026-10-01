/** Native Figma LINE geometry. Layout and paint bounds are deliberately separate. */
export type NativeLineTransform = [[number, number, number], [number, number, number]];
export interface NativeLineGeometry {
  length: number;
  transform: NativeLineTransform;
  cap: 'NONE' | 'ROUND' | 'SQUARE';
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE';
}
export interface NativeLineFootprint {
  width: number;
  height: number;
  originX: number;
  originY: number;
}
/** The Plugin API permits skew/reflection but prohibits scaling and collapse. */
export function nativeLineIssue(line: NativeLineGeometry): string | undefined {
  if (!Number.isFinite(line.length) || line.length <= 0) return 'native-line-length-invalid';
  if (!Array.isArray(line.transform) || line.transform.length !== 2 ||
      line.transform.some(row => !Array.isArray(row) || row.length !== 3 || row.some(value => !Number.isFinite(value))))
    return 'native-line-transform-invalid';
  const [[a, c], [b, d]] = line.transform;
  if (Math.abs(Math.hypot(a, b) - 1) > 1e-6 || Math.abs(Math.hypot(c, d) - 1) > 1e-6)
    return 'native-line-transform-scale-unsupported';
  if (Math.abs(a * d - b * c) < 1e-6) return 'native-line-transform-collapsed';
  if (!['NONE', 'ROUND', 'SQUARE'].includes(line.cap)) return 'native-line-cap-unsupported';
  if (!['INSIDE', 'CENTER', 'OUTSIDE'].includes(line.align)) return 'native-line-alignment-invalid';
}
function checked(line: NativeLineGeometry): void {
  const issue = nativeLineIssue(line);
  if (issue) throw new Error(issue);
}
/** The zero-height native box has a nonzero layout footprint when rotated.
 * Stroke paint never changes that footprint. Auto-layout controls translation. */
export function nativeLineFootprint(line: NativeLineGeometry): NativeLineFootprint {
  checked(line);
  const x = line.transform[0][0] * line.length;
  const y = line.transform[1][0] * line.length;
  return { width: Math.abs(x), height: Math.abs(y), originX: -Math.min(0, x), originY: -Math.min(0, y) };
}
/** Native LINE paints on local y[-weight,0] for all stored alignments.
 * Round and square caps inset their centerline endpoints by half the weight.
 * These rules were independently observed in native write + REST geometry. */
export function nativeLinePaint(line: NativeLineGeometry, weight: number): {
  x1: number; y1: number; x2: number; y2: number;
  linecap: 'butt' | 'round' | 'square';
} {
  checked(line);
  if (!Number.isFinite(weight) || weight < 0) throw new Error('native-line-stroke-weight-invalid');
  if (line.cap !== 'NONE' && weight > line.length) throw new Error('native-line-short-cap-unqualified');
  const inset = line.cap === 'NONE' ? 0 : weight / 2;
  return { x1: inset, y1: -weight / 2, x2: line.length - inset, y2: -weight / 2,
    linecap: line.cap === 'NONE' ? 'butt' : line.cap === 'ROUND' ? 'round' : 'square' };
}
/** SVG basis in a layout wrapper. Native translation remains in the contract;
 * the wrapper's placement channel applies it, never an ink-bounds substitute. */
export function nativeLineWrapperMatrix(line: NativeLineGeometry): string {
  const footprint = nativeLineFootprint(line);
  const [[a, c], [b, d]] = line.transform;
  return `matrix(${a} ${b} ${c} ${d} ${footprint.originX} ${footprint.originY})`;
}

/** Shared paint projection; dynamic stroke weight keeps native endpoint rules.
 * The outer shape box carries layout and clipping, never an ink-derived box. */
export function nativeLineSvg(shape: {line:NativeLineGeometry}): string {
  const line=shape.line, footprint=nativeLineFootprint(line);
  const capped=line.cap!=='NONE';
  const dash=capped ? `stroke-dasharray:calc(${line.length}px - var(--native-line-stroke-width, 0px)) calc(${line.length}px + var(--native-line-stroke-width, 0px));stroke-dashoffset:calc(var(--native-line-stroke-width, 0px) * -0.5);` : '';
  const cap=line.cap==='NONE'?'butt':line.cap==='ROUND'?'round':'square';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${footprint.width||1}" height="${footprint.height||1}" fill="none" style="display:block;overflow:visible"><g transform="${nativeLineWrapperMatrix(line)}"><g style="transform:translateY(calc(var(--native-line-stroke-width, 0px) * -0.5))"><line x1="0" y1="0" x2="${line.length}" y2="0" stroke-linecap="${cap}" style="stroke:inherit;stroke-width:var(--native-line-stroke-width, 0px);${dash}"/></g></g></svg>`;
}
