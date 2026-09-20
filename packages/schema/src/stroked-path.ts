/** Original open centerline geometry, never an outlined stroke silhouette.
 * The viewport is the captured SCALE/SCALE parent basis. Painting in that
 * coordinate system avoids CSS layout quantization of fractional path boxes. */
export interface StrokedPath {
  data: string;
  cap: 'NONE' | 'ROUND' | 'SQUARE';
  join: 'MITER' | 'ROUND' | 'BEVEL';
  miterLimit: number;
  viewport: { width: number; height: number; x: number; y: number };
}

/** The native viewport and stroke weight are positive pixel measures.
 * Relative CSS units would depend on a browser font or viewport that the
 * captured native vector does not carry. */
export function strokedPathDimensionOk(value: unknown): boolean {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?(?:px)?$/.test(text)) return false;
  const number = Number(text.replace(/px$/, ''));
  return Number.isFinite(number) && number > 0 && number <= 1e6;
}

/** One open absolute M/L/C/Q subpath. No XML, arcs, relative commands,
 * implicit closure, number rounding or approximation. */
export function strokedPathIssue(data: string): string | undefined {
  if (typeof data !== 'string' || data.length === 0 || data.length > 65536)
    return 'stroked-path-size';
  const token = /[MLCQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gy;
  let at = 0;
  const tokens: Array<string | number> = [];
  while (at < data.length) {
    if (/[ \t\r\n]/.test(data[at]!)) { at++; continue; }
    if (data[at] === ',') {
      if (typeof tokens[tokens.length - 1] !== 'number') return 'stroked-path-separator';
      at++;
      while (at < data.length && /[ \t\r\n]/.test(data[at]!)) at++;
      if (at === data.length || !/[-+.0-9]/.test(data[at]!)) return 'stroked-path-separator';
    }
    token.lastIndex = at;
    const match = token.exec(data);
    if (!match) return 'stroked-path-command-or-character';
    const value = match[0];
    if (/^[MLCQ]$/.test(value)) tokens.push(value);
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || Math.abs(number) > 1e6) return 'stroked-path-coordinate';
      tokens.push(number);
    }
    if (tokens.length > 16384) return 'stroked-path-complexity';
    at = token.lastIndex;
  }
  let moved = false, drawn = false;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (typeof command !== 'string') return 'stroked-path-missing-command';
    if (command === 'M') {
      if (moved) return 'stroked-path-multiple-subpaths';
      moved = true;
    } else if (!moved) return 'stroked-path-missing-move';
    const start = i;
    while (i < tokens.length && typeof tokens[i] === 'number') i++;
    const count = i - start, arity = command === 'C' ? 6 : command === 'Q' ? 4 : 2;
    if (count === 0 || count % arity !== 0) return 'stroked-path-arity';
    if (command !== 'M' || count > 2) drawn = true;
  }
  return drawn ? undefined : 'stroked-path-empty';
}

export function strokedPathGeometryIssue(shape: { width: number; height: number; strokePath?: StrokedPath }): string | undefined {
  const path = shape.strokePath;
  if (!path) return 'stroked-path-missing-geometry';
  const issue = strokedPathIssue(path.data);
  if (issue) return issue;
  if (!['NONE', 'ROUND', 'SQUARE'].includes(path.cap) || !['MITER', 'ROUND', 'BEVEL'].includes(path.join) ||
      !Number.isFinite(path.miterLimit) || path.miterLimit < 1 || path.miterLimit > 1000)
    return 'stroked-path-stroke-properties';
  const viewport = path.viewport;
  if (!viewport || [shape.width, shape.height, viewport.width, viewport.height].some(value => !Number.isFinite(value) || value <= 0 || value > 1e6) ||
      [viewport.x, viewport.y].some(value => !Number.isFinite(value) || Math.abs(value) > 1e6))
    return 'stroked-path-viewport';
  const bounds = strokedPathBounds(path.data);
  const same = (a: number, b: number) => a === b || Math.fround(a) === Math.fround(b);
  if (!same(bounds.x, 0) || !same(bounds.y, 0) || !same(bounds.width, shape.width) || !same(bounds.height, shape.height))
    return 'stroked-path-bounds-mismatch';
  return undefined;
}

/** Exact polynomial extrema, not a control-point hull or sampled curve.
 * Called only after the grammar check; the declared box must match the
 * centerline in Figma's local origin, allowing only float32 representation. */
function strokedPathBounds(data: string) {
  const tokens = data.match(/[MLCQ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
  let x = 0, y = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const include = (px: number, py: number) => { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py); };
  const extrema = (p: number[]) => {
    if (p.length === 3) {
      const d = p[0]! - 2 * p[1]! + p[2]!;
      return d === 0 ? [] : [(p[0]! - p[1]!) / d];
    }
    const a = -p[0]! + 3 * p[1]! - 3 * p[2]! + p[3]!;
    const b = 2 * (p[0]! - 2 * p[1]! + p[2]!);
    const c = p[1]! - p[0]!;
    if (a === 0) return b === 0 ? [] : [-c / b];
    const d = b * b - 4 * a * c;
    if (d < 0) return [];
    return [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)];
  };
  const value = (p: number[], t: number) => {
    const q = p.slice();
    for (let n = q.length - 1; n > 0; n--) for (let i = 0; i < n; i++) q[i] = q[i]! * (1 - t) + q[i + 1]! * t;
    return q[0]!;
  };
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++]!;
    const arity = command === 'C' ? 6 : command === 'Q' ? 4 : 2;
    while (i < tokens.length && !/^[MLCQ]$/.test(tokens[i]!)) {
      const args = tokens.slice(i, i += arity).map(Number);
      if (command === 'C' || command === 'Q') {
        const xs = [x, ...args.filter((_, k) => k % 2 === 0)], ys = [y, ...args.filter((_, k) => k % 2 === 1)];
        for (const t of [...extrema(xs), ...extrema(ys)]) if (t > 0 && t < 1) include(value(xs, t), value(ys, t));
      }
      x = args[args.length - 2]!; y = args[args.length - 1]!; include(x, y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Paint and width inherit from the shared CSS token channels on the outer
 * decor element. Only validated geometry enters this static SVG string. */
export function strokedPathSvg(shape: { width: number; height: number; strokePath?: StrokedPath }): string {
  const issue = strokedPathGeometryIssue(shape);
  if (issue) throw new Error(issue);
  const path = shape.strokePath!, viewport = path.viewport;
  const cap = path.cap === 'NONE' ? 'butt' : path.cap.toLowerCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewport.width} ${viewport.height}" preserveAspectRatio="none" fill="none" style="display:block;width:100%;height:100%;overflow:visible"><path d="${path.data}" transform="translate(${viewport.x} ${viewport.y})" stroke-linecap="${cap}" stroke-linejoin="${path.join.toLowerCase()}" stroke-miterlimit="${path.miterLimit}" vector-effect="non-scaling-stroke"/></svg>`;
}
