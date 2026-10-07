/** Original centerline centerline geometry, never an outlined stroke silhouette.
 * The viewport is the captured SCALE/SCALE parent basis. Painting in that
 * coordinate system avoids CSS layout quantization of fractional path boxes. */
export interface StrokedPath {
  data: string;
  cap: 'NONE' | 'ROUND' | 'SQUARE';
  join: 'MITER' | 'ROUND' | 'BEVEL';
  miterLimit: number;
  viewport: { width: number; height: number; x: number; y: number };
  /** Omitted means SCALE/SCALE. Zero-height lines may stretch; positive-height
   * fixed outlines may use native MIN/MAX/CENTER anchoring. */
  constraints?: { horizontal: 'SCALE' | 'STRETCH' | 'MIN' | 'MAX' | 'CENTER'; vertical: 'SCALE' | 'STRETCH' | 'MIN' | 'MAX' | 'CENTER' };
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
  const token = /[MLCQHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gy;
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
    if (/^[MLCQHVZ]$/.test(value)) tokens.push(value);
    else {
      const number = Number(value);
      if (!Number.isFinite(number) || Math.abs(number) > 1e6) return 'stroked-path-coordinate';
      tokens.push(number);
    }
    if (tokens.length > 16384) return 'stroked-path-complexity';
    at = token.lastIndex;
  }
  let moved = false, drawn = false, subpathDrawn = false;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (typeof command !== 'string') return 'stroked-path-missing-command';
    if (command === 'M') {
      if (moved && !subpathDrawn) return 'stroked-path-empty-subpath';
      moved = true; subpathDrawn = false;
    } else if (!moved) return 'stroked-path-missing-move';
    if (command === 'Z') {
      if (typeof tokens[i] === 'number') return 'stroked-path-arity';
      if (!subpathDrawn) return 'stroked-path-empty';
      moved = false;
      continue;
    }
    const start = i;
    while (i < tokens.length && typeof tokens[i] === 'number') i++;
    const count = i - start, arity = command === 'C' ? 6 : command === 'Q' ? 4 : command === 'H' || command === 'V' ? 1 : 2;
    if (count === 0 || count % arity !== 0) return 'stroked-path-arity';
    if (command !== 'M' || count > 2) { drawn = true; subpathDrawn = true; }
  }
  if (moved && !subpathDrawn) return 'stroked-path-empty-subpath';
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
  if (path.constraints && !(shape.height === 0
      ? ['SCALE', 'STRETCH'].includes(path.constraints.horizontal) && ['SCALE', 'STRETCH'].includes(path.constraints.vertical)
      : ['MIN', 'MAX', 'CENTER'].includes(path.constraints.horizontal) && ['MIN', 'MAX', 'CENTER'].includes(path.constraints.vertical))) return 'stroked-path-constraints';
  if (!Number.isFinite(shape.height) || shape.height < 0 || shape.height > 1e6) return 'stroked-path-viewport';
  if (!viewport || [shape.width, viewport.width, viewport.height].some(value => !Number.isFinite(value) || value <= 0 || value > 1e6) ||
      [viewport.x, viewport.y].some(value => !Number.isFinite(value) || Math.abs(value) > 1e6))
    return 'stroked-path-viewport';
  const bounds = strokedPathBounds(path.data);
  const same = (a: number, b: number) => a === b || Math.fround(a) === Math.fround(b);
  // Figma stores vertices and extents in float32. Reconstructing a cubic's
  // extrema from those vertices can leave a nonzero local origin even in
  // Figma's own vectorPaths readback. Accept only an origin that cannot move
  // either signed extent to another float32 value. No pixel epsilon, path
  // translation, or coordinate rounding is applied to the emitted geometry.
  // Degenerate axes retain exact zero (there is no nonzero extent as a basis).
  const atOrigin = (origin: number, extent: number) => origin === 0 || extent > 0 &&
    Math.fround(extent + origin) === Math.fround(extent) &&
    Math.fround(extent - origin) === Math.fround(extent);
  if (!atOrigin(bounds.x, shape.width) || !atOrigin(bounds.y, shape.height) || !same(bounds.width, shape.width) || !same(bounds.height, shape.height))
    return 'stroked-path-bounds-mismatch';
  return undefined;
}

/** Exact polynomial extrema, not a control-point hull or sampled curve.
 * Called only after the grammar check; the declared box must match the
 * centerline in Figma's local origin, allowing only float32 representation. */
function strokedPathBounds(data: string) {
  const tokens = data.match(/[MLCQHVZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
  let x = 0, y = 0, startX = 0, startY = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    if (command === 'Z') { x = startX; y = startY; include(x, y); continue; }
    const arity = command === 'C' ? 6 : command === 'Q' ? 4 : command === 'H' || command === 'V' ? 1 : 2;
    let firstMove = command === 'M';
    while (i < tokens.length && !/^[MLCQHVZ]$/.test(tokens[i]!)) {
      const args = tokens.slice(i, i += arity).map(Number);
      if (command === 'C' || command === 'Q') {
        const xs = [x, ...args.filter((_, k) => k % 2 === 0)], ys = [y, ...args.filter((_, k) => k % 2 === 1)];
        for (const t of [...extrema(xs), ...extrema(ys)]) if (t > 0 && t < 1) include(value(xs, t), value(ys, t));
      }
      if (command === 'H') x = args[0]!;
      else if (command === 'V') y = args[0]!;
      else { x = args[args.length - 2]!; y = args[args.length - 1]!; }
      if (firstMove) { startX = x; startY = y; firstMove = false; } include(x, y);
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
  if (shape.height > 0 && path.constraints) {
    const offset = (constraint: string, position: number, parent: number) => constraint === 'MIN'
      ? `${position}px` : `calc(${constraint === 'MAX' ? '100%' : '50%'} + ${position - parent * (constraint === 'MAX' ? 1 : 0.5)}px)`;
    const x = offset(path.constraints.horizontal, viewport.x, viewport.width);
    const y = offset(path.constraints.vertical, viewport.y, viewport.height);
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="display:block;width:100%;height:100%;overflow:visible"><foreignObject width="100%" height="100%" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:100%;height:100%"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" fill="none" style="display:block;position:absolute;left:${x};top:${y};width:${shape.width}px;height:${shape.height}px;overflow:visible"><path d="${path.data}" stroke-linecap="${cap}" stroke-linejoin="${path.join.toLowerCase()}" stroke-miterlimit="${path.miterLimit}" vector-effect="non-scaling-stroke"/></svg></div></foreignObject></svg>`;
  }
  if (shape.height === 0) {
    const c = path.constraints ?? { horizontal: 'SCALE', vertical: 'SCALE' };
    const x = c.horizontal === 'STRETCH' ? `${viewport.x}px` : `${viewport.x / viewport.width * 100}%`;
    const y = c.vertical === 'STRETCH' ? `${viewport.y}px` : `${viewport.y / viewport.height * 100}%`;
    const width = c.horizontal === 'STRETCH' ? `calc(100% - ${viewport.width - shape.width}px)` : `${shape.width / viewport.width * 100}%`;
    // Keep the graphic's complete viewport while CSS lays out its centerline.
    // A foreignObject establishes the CSS containing block for fixed gutters;
    // nested SVG percentage/calc viewports do not reliably invalidate on resize.
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="display:block;width:100%;height:100%;overflow:visible"><foreignObject width="100%" height="100%" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:100%;height:100%"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} 1" preserveAspectRatio="none" fill="none" style="display:block;position:absolute;left:${x};top:${y};width:${width};height:1px;overflow:visible"><path d="${path.data}" stroke-linecap="${cap}" stroke-linejoin="${path.join.toLowerCase()}" stroke-miterlimit="${path.miterLimit}" vector-effect="non-scaling-stroke"/></svg></div></foreignObject></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewport.width} ${viewport.height}" preserveAspectRatio="none" fill="none" style="display:block;width:100%;height:100%;overflow:visible"><path d="${path.data}" transform="translate(${viewport.x} ${viewport.y})" stroke-linecap="${cap}" stroke-linejoin="${path.join.toLowerCase()}" stroke-miterlimit="${path.miterLimit}" vector-effect="non-scaling-stroke"/></svg>`;
}
