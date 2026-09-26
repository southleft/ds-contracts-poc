import { filledPathIssue } from '../scripts/contract-schema.js';
import type { NodeSpec } from './emit-figma-script.js';

/** Figma stores endpoints and relative cubic handles as float32. Path strings
 * serialize their sums as doubles. Comparing rounded absolute controls loses
 * that distinction. No epsilon or bounding-box approximation is used here. */
function segments(data: string, x = 0, y = 0) {
  if (filledPathIssue(data) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tokens = data.match(/[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
  type Point = [number, number];
  const point = (p: Point) => [Math.fround(p[0] + x), Math.fround(p[1] + y)];
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
  if (expected?.kind !== 'path' || expected.paths?.length !== 1 || !Array.isArray(observed) || observed.length !== 1 ||
      typeof x !== 'number' || typeof y !== 'number') return false;
  const a = expected.paths[0], b = observed[0];
  if (!b || b.windingRule !== a.windingRule || typeof b.data !== 'string') return false;
  // The native parser rebases its points to the path's curve bounds before
  // storing them as float32. Compare in that observed local coordinate frame;
  // rounding global sums would introduce an extra, different quantization.
  const wanted = segments(a.data, -x, -y), actual = segments(b.data);
  return wanted !== null && actual !== null && JSON.stringify(wanted) === JSON.stringify(actual);
}

/** Compare a resized inheritance against its independently verified main.
 * Figma scales stored float32 endpoints and relative handles, not a reparsed
 * source SVG. Callers must verify both vector dimensions and parent ratios. */
export function nativeFilledPathResizeMatches(main: unknown, observed: unknown, sx: number, sy: number): boolean {
  if (!Array.isArray(main) || main.length !== 1 || !Array.isArray(observed) || observed.length !== 1 ||
      !Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return false;
  const a = main[0], b = observed[0];
  if (!a || !b || a.windingRule !== b.windingRule || !['NONZERO', 'EVENODD'].includes(a.windingRule) ||
      typeof a.data !== 'string' || typeof b.data !== 'string') return false;
  const source = segments(a.data), actual = segments(b.data);
  const expected = source?.map(path => path.map(edge => edge.map((n, i) => Math.fround(n * (i % 2 ? sy : sx)))));
  return expected !== undefined && actual !== null && JSON.stringify(expected) === JSON.stringify(actual);
}

/** Lower only authenticated compiled drafts. CSS's path mask owns a fixed
 * viewBox; the editable native vector owns its intrinsic curve bounds. */
export function lowerNativeFilledPath(spec: NodeSpec): void {
  if (spec.shape?.kind !== 'path' || spec.nativePathInk) return;
  if (spec.type !== 'shape' || spec.children?.length || spec.shape.paths?.length !== 1 ||
      filledPathIssue(spec.shape.paths[0].data) || spec.svg || spec.shape.rotation || spec.shape.arc ||
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
  spec.clipsContent = true;
  delete spec.shape; delete spec.fill;
  spec.children = [ink];
}
