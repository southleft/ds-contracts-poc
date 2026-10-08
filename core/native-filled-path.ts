import { filledPathIssue, filledPathsIssue } from '../scripts/contract-schema.js';
import type { NodeSpec } from './emit-figma-script.js';

/** Figma stores endpoints and relative cubic handles as float32. Path strings
 * serialize their sums as doubles. Comparing rounded absolute controls loses
 * that distinction. No epsilon or bounding-box approximation is used here. */
function segments(data: string, x = 0, y = 0) {
  if (filledPathIssue(data) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tokens = data.match(/[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
  type Point = [number, number];
  // A native vector normalizes a source endpoint at its origin to exact zero.
  // Subtracting the separately rounded native origin from the source double
  // can otherwise invent a tiny nonzero coordinate. Only the identical
  // float32 origin gets this treatment; other endpoints retain exact checks.
  const coordinate = (value: number, offset: number) =>
    offset !== 0 && Math.fround(value) === Math.fround(-offset) ? 0 : Math.fround(value + offset);
  const point = (p: Point) => [coordinate(p[0], x), coordinate(p[1], y)];
  const delta = (a: Point, b: Point) => [Math.fround(a[0] - b[0]), Math.fround(a[1] - b[1])];
  const paths: number[][][] = [];
  let from: Point = [0, 0], start: Point = [0, 0], current: number[][] = [];
  const edge = (to: Point, c1 = from, c2 = to) => {
    const a = point(from), b = point(to), t1 = delta(c1, from), t2 = delta(c2, to);
    if (a[0] !== b[0] || a[1] !== b[1] || [...t1, ...t2].some(n => n !== 0))
      current.push([...a, ...b, ...t1, ...t2]);
    from = to;
  };
  let at = 0;
  const pair = (): Point => [Number(tokens[at++]), Number(tokens[at++])];
  while (at < tokens.length) {
    const command = tokens[at++];
    if (command === 'Z') { edge(start); paths.push(current); current = []; continue; }
    let first = true;
    while (at < tokens.length && !/^[MLCQZ]$/.test(tokens[at])) {
      if (command === 'M' && first) { from = start = pair(); }
      else if (command === 'C') { const a = pair(), b = pair(); edge(pair(), a, b); }
      else if (command === 'Q') {
        const control = pair(), to = pair();
        edge(to, [from[0] + (control[0] - from[0]) * 2 / 3, from[1] + (control[1] - from[1]) * 2 / 3],
          [to[0] + (control[0] - to[0]) * 2 / 3, to[1] + (control[1] - to[1]) * 2 / 3]);
      } else edge(pair());
      first = false;
    }
  }
  return paths;
}

export function nativeFilledPathMatches(expected: NodeSpec['shape'], observed: unknown, x: unknown, y: unknown): boolean {
  if (expected?.kind !== 'path' || !expected.paths?.length || expected.paths.length > 32 ||
      filledPathsIssue(expected.paths) || !Array.isArray(observed) || observed.length !== expected.paths.length ||
      typeof x !== 'number' || typeof y !== 'number') return false;
  return expected.paths.every((a, index) => {
    const b = observed[index];
    if (!b || b.windingRule !== a.windingRule || typeof b.data !== 'string') return false;
    // Each ordered region is compared in the independently observed native
    // frame, preserving exact float32 endpoints and relative curve handles.
    const wanted = segments(a.data, -x, -y), actual = segments(b.data);
    return wanted !== null && actual !== null && JSON.stringify(wanted) === JSON.stringify(actual);
  });
}

/** Compare every ordered native region against its verified main. */
export function nativeFilledPathResizeMatches(main: unknown, observed: unknown, sx: number, sy: number): boolean {
  if (!Array.isArray(main) || !main.length || main.length > 32 || !Array.isArray(observed) || observed.length !== main.length ||
      !Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return false;
  if (filledPathsIssue(main) || filledPathsIssue(observed)) return false;
  return main.every((a, index) => {
    const b = observed[index];
    if (!a || !b || a.windingRule !== b.windingRule ||
        typeof a.data !== 'string' || typeof b.data !== 'string') return false;
    const source = segments(a.data), actual = segments(b.data);
    const expected = source?.map(path => path.map(edge => edge.map((n, i) => Math.fround(n * (i % 2 ? sy : sx)))));
    return expected !== undefined && actual !== null && JSON.stringify(expected) === JSON.stringify(actual);
  });
}

/** CSS's path mask owns a fixed viewBox; the editable native vector owns
 * its intrinsic curve bounds. Preserve both without rescaling the path. */
export function lowerNativeFilledPath(spec: NodeSpec): void {
  if (spec.shape?.kind !== 'path' || spec.nativePathInk || spec.nativeMaskPath) return;
  if(spec.mask?.paintedStroke){
    if(spec.mask.type!=='ALPHA' || spec.type!=='shape' || !spec.capturedAbsoluteGeometry ||
      spec.children?.length || !spec.shape.paths?.length || filledPathsIssue(spec.shape.paths) ||
      filledPathsIssue(spec.mask.paintedStroke.paths) || spec.shape.parentViewport || spec.shape.rotation ||
      spec.svg || spec.fill || spec.stroke || spec.gradient || spec.effectStack?.length || spec.dropShadow || spec.bindings ||
      spec.widthFill || spec.fillW || spec.fillH || spec.grow || spec.pct!==undefined || spec.fixedWidth || spec.fixedHeight ||
      Object.keys(spec.lits ?? {}).some(k=>!['width','height'].includes(k)))
      throw Error('NATIVE_PAINTED_MASK_OWNERSHIP_UNQUALIFIED');
    const shape=spec.shape,paint=spec.mask.paintedStroke;
    spec.type='frame';spec.nativePathViewport=true;spec.nativePaintedStrokeMask=true;spec.clipsContent=true;
    spec.lits={width:shape.width,height:shape.height};
    spec.children=[
      {type:'shape',name:'Interior clip',shape:{...shape},nativePathInk:true,nativePathScale:true,mask:{type:'VECTOR'},lits:{fillColor:{r:1,g:1,b:1,a:1}}},
      {type:'shape',name:'Painted stroke ink',shape:{kind:'path',width:shape.width,height:shape.height,paths:paint.paths},nativePathInk:true,nativePathScale:true,lits:{fillColor:{...paint.color,a:1}}}
    ];
    delete spec.shape;return;
  }
  // A native mask must remain the same sibling that owns the following paint.
  // A viewport wrapper would transfer mask ownership and change its scope.
  if (spec.mask?.stroke) {
    if (spec.mask.type !== 'ALPHA' || spec.type !== 'shape' || !spec.capturedAbsoluteGeometry ||
        spec.children?.length || !spec.shape.paths?.length || filledPathsIssue(spec.shape.paths) ||
        spec.shape.parentViewport || spec.shape.rotation || spec.shape.arc || spec.svg || spec.fill || spec.stroke ||
        spec.gradient || spec.effectStack?.length || spec.dropShadow || spec.bindings ||
        spec.widthFill || spec.fillW || spec.fillH || spec.grow || spec.pct !== undefined || spec.fixedWidth || spec.fixedHeight ||
        Object.keys(spec.lits ?? {}).some(k => !['width','height'].includes(k)))
      throw Error('NATIVE_MASK_PATH_OWNERSHIP_UNQUALIFIED');
    spec.nativeMaskPath = true;
    return;
  }
  if (spec.type !== 'shape' || spec.children?.length || !spec.shape.paths?.length || spec.shape.paths.length > 32 ||
      filledPathsIssue(spec.shape.paths) || spec.svg || spec.shape.rotation || spec.shape.arc ||
      spec.stroke || spec.gradient || spec.effectStack?.length || spec.dropShadow || spec.bindings ||
      spec.widthFill || spec.fillW || spec.fillH || spec.grow || spec.pct !== undefined || spec.fixedWidth || spec.fixedHeight ||
      Object.keys(spec.lits ?? {}).some(k => k !== 'fillColor'))
    throw Error('NATIVE_FILLED_PATH_VIEWPORT_UNQUALIFIED');
  const ink: NodeSpec = { type: 'shape', name: 'Path ink', shape: spec.shape, nativePathInk: true,
    ...(spec.shape.parentViewport ? { nativePathScale: true } : {}),
    ...(spec.fill ? { fill: spec.fill } : {}), ...(spec.lits ? { lits: spec.lits } : {}) };
  spec.type = 'frame'; spec.nativePathViewport = true;
  if (spec.shape.parentViewport) spec.pathParentViewport = spec.shape.parentViewport;
  spec.lits = { width: spec.shape.width, height: spec.shape.height };
  // Parent-relative paths were captured against the complete parent plane.
  // Keep native curve ink beyond its intrinsic box instead of cropping it.
  spec.clipsContent = spec.shape.parentViewport ? undefined : true;
  delete spec.shape; delete spec.fill;
  spec.children = [ink];
}
