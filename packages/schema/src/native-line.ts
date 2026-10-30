/** Native Figma LINE geometry. Layout and paint bounds are deliberately separate. */
export type NativeLineTransform = [[number, number, number], [number, number, number]];
export interface NativeLineGeometry {
  length: number;
  /** Source-qualified horizontal in-flow allocation; stroke never changes height. */
  fillWidth?: true;
  transform: NativeLineTransform;
  cap: 'NONE' | 'ROUND' | 'SQUARE';
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE';
  /** Captured dash lengths, in path pixels. Absent on a solid line. */
  dashes?: number[];
  /** Captured stroke outline. Dash caps are not reconstructed from the lengths alone. */
  painted?: Array<{ data: string; windingRule: 'NONZERO' | 'EVENODD' }>;
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
  if (line.fillWidth && (line.cap!=='NONE'||line.align!=='CENTER'||a!==1||b!==0||c!==0||d!==1||line.transform[0][2]!==0||line.transform[1][2]!==0)) return 'native-line-fill-basis-unsupported';
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
/** SVG and CSS lengths reject scientific notation; a near-zero basis is a right angle. */
function svgNumber(value: number): string {
  if (!Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) < 1e-6) return '0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}
export function nativeLineWrapperMatrix(line: NativeLineGeometry): string {
  const footprint = nativeLineFootprint(line);
  const [[a, c], [b, d]] = line.transform;
  return `matrix(${svgNumber(a)} ${svgNumber(b)} ${svgNumber(c)} ${svgNumber(d)} ${svgNumber(footprint.originX)} ${svgNumber(footprint.originY)})`;
}

/** Shared paint projection; dynamic stroke weight keeps native endpoint rules.
 * The outer shape box carries layout and clipping, never an ink-derived box. */
interface ObservedLineSource {
  variantName: string;
  transform: NativeLineTransform;
  length?: number;
  cap?: NativeLineGeometry['cap'];
  align?: NativeLineGeometry['align'];
  dashes?: number[];
  painted?: Array<{ data: string; windingRule: 'NONZERO' | 'EVENODD' }>;
}
/** One drawing per distinct captured geometry, with the variants that draw it.
 *  A single geometry is the shared line. A variant without a captured length
 *  draws the shared line. */
export function nativeLineDrawings(shape: {line: NativeLineGeometry & {observedSources?: ObservedLineSource[]}}): Array<{line: NativeLineGeometry; variantNames?: string[]}> {
  const base = shape.line;
  const geometryOf = (source: ObservedLineSource): NativeLineGeometry => source.length === undefined ? base : {
    length: source.length, transform: source.transform, cap: source.cap ?? base.cap, align: source.align ?? base.align,
    ...(source.dashes ? {dashes: source.dashes} : {}),
    ...(source.painted ? {painted: source.painted} : {}),
  };
  const groups = new Map<string, {line: NativeLineGeometry; variantNames: string[]}>();
  for (const source of base.observedSources ?? []) {
    const line = geometryOf(source);
    const key = JSON.stringify([line.length, line.cap, line.align, line.dashes ?? [], line.painted ?? [], line.transform]);
    const group = groups.get(key) ?? {line, variantNames: []};
    if (!group.variantNames.includes(source.variantName)) group.variantNames.push(source.variantName);
    groups.set(key, group);
  }
  if (groups.size <= 1) return [{line: base}];
  return [...groups.values()];
}
export function nativeLineSvg(shape: {line:NativeLineGeometry}): string {
  const line=shape.line, footprint=nativeLineFootprint(line);
  if(line.fillWidth)return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="1" fill="none" style="display:block;overflow:visible"><g style="transform:translateY(calc(var(--native-line-stroke-width, 0px) * -0.5))"><line x1="0" y1="0" x2="100%" y2="0" stroke-linecap="butt" style="stroke:inherit;stroke-width:var(--native-line-stroke-width, 0px)"/></g></svg>`;
  const axis=(value:number)=>svgNumber(value>=1?value:1);
  if (line.painted?.length) {
    const [[a, c], [b, d]] = line.transform;
    const points = line.painted.flatMap(path => {
      const nums = path.data.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
      const out: Array<[number, number]> = [];
      for (let i = 0; i + 1 < nums.length; i += 2) out.push([a * nums[i]! + c * nums[i + 1]!, b * nums[i]! + d * nums[i + 1]!]);
      return out;
    });
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const tidy = (n: number) => Math.round(n * 1000) / 1000;
    const minX = tidy(Math.min(...xs)), minY = tidy(Math.min(...ys));
    const width = Math.max(tidy(Math.max(...xs) - minX), 1), height = Math.max(tidy(Math.max(...ys) - minY), 1);
    const paths=line.painted.map(path=>`<path d="${path.data}" fill-rule="${path.windingRule==='EVENODD'?'evenodd':'nonzero'}" style="fill:inherit;stroke:none"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgNumber(width)}" height="${svgNumber(height)}" viewBox="${svgNumber(minX)} ${svgNumber(minY)} ${svgNumber(width)} ${svgNumber(height)}" style="display:block;overflow:visible;width:${svgNumber(width)}px;height:${svgNumber(height)}px;margin-left:${svgNumber(minX)}px;margin-top:${svgNumber(minY)}px"><g transform="${nativeLineWrapperMatrix(line)}">${paths}</g></svg>`;
  }
  const capped=line.cap!=='NONE';
  const dash=line.dashes?.length ? `stroke-dasharray:${line.dashes.map(n => `${n}px`).join(' ')};`
    : capped ? `stroke-dasharray:calc(${line.length}px - var(--native-line-stroke-width, 0px)) calc(${line.length}px + var(--native-line-stroke-width, 0px));stroke-dashoffset:calc(var(--native-line-stroke-width, 0px) * -0.5);` : '';
  const cap=line.cap==='NONE'?'butt':line.cap==='ROUND'?'round':'square';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${axis(footprint.width)}" height="${axis(footprint.height)}" fill="none" style="display:block;overflow:visible"><g transform="${nativeLineWrapperMatrix(line)}"><g style="transform:translateY(calc(var(--native-line-stroke-width, 0px) * -0.5))"><line x1="0" y1="0" x2="${svgNumber(line.length)}" y2="0" stroke-linecap="${cap}" style="stroke:inherit;stroke-width:var(--native-line-stroke-width, 0px);${dash}"/></g></g></svg>`;
}
