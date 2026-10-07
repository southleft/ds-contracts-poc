/** Exact, bounded subset shared by the contract, REST reader and emitters.
 * No arc approximation, number rounding, XML or external asset references. */
export interface FilledPath {
  data: string;
  windingRule: 'NONZERO' | 'EVENODD' | 'NONE';
}

export function filledPathIssue(data: string): string | undefined {
  if (typeof data !== 'string' || data.length === 0 || data.length > 65536)
    return 'filled-path-size';
  const token = /[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gy;
  let at = 0;
  const tokens: Array<string | number> = [];
  while (at < data.length) {
    if (/\s/.test(data[at]!)) { at++; continue; }
    if (data[at] === ',') {
      if (typeof tokens[tokens.length - 1] !== 'number') return 'filled-path-separator';
      at++;
      while (at < data.length && /\s/.test(data[at]!)) at++;
      if (at === data.length || !/[-+.0-9]/.test(data[at]!)) return 'filled-path-separator';
    }
    token.lastIndex = at;
    const match = token.exec(data);
    if (!match) return 'filled-path-command-or-character';
    const value = match[0];
    if (/^[MLCQZ]$/.test(value)) tokens.push(value);
    else {
      const n = Number(value);
      if (!Number.isFinite(n) || Math.abs(n) > 1e6) return 'filled-path-coordinate';
      tokens.push(n);
    }
    if (tokens.length > 16384) return 'filled-path-complexity';
    at = token.lastIndex;
  }
  let open = false;
  let drawn = false;
  let subpaths = 0;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (typeof command !== 'string') return 'filled-path-missing-command';
    if (command === 'Z') {
      if (!open || !drawn) return 'filled-path-empty-subpath';
      open = false;
      subpaths++;
      continue;
    }
    if (command === 'M') {
      if (open) return 'filled-path-open-subpath';
      open = true;
      drawn = false;
    } else if (!open) return 'filled-path-missing-move';
    const start = i;
    while (i < tokens.length && typeof tokens[i] === 'number') i++;
    const count = i - start;
    const arity = command === 'C' ? 6 : command === 'Q' ? 4 : 2;
    if (count === 0 || count % arity !== 0) return 'filled-path-arity';
    if (command !== 'M' || count > 2) drawn = true;
  }
  if (open) return 'filled-path-open-subpath';
  if (!subpaths) return 'filled-path-empty';
  return undefined;
}

/** NONE is carried only for one convex, closed straight-sided contour.
 * Figma fills this contour even with no vector regions; all fill rules agree
 * on its interior. Preserve NONE for native creation and exact readback.
 * No curve, hole, overlap, coordinate rounding or winding inference. */
export function filledPathsIssue(paths: Array<{ data: string; windingRule: string }>): string | undefined {
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 32) return 'filled-path-count';
  for (const path of paths) {
    if (!path || typeof path !== 'object' || typeof path.data !== 'string' || typeof path.windingRule !== 'string') return 'filled-path-invalid-region';
    const issue = filledPathIssue(path.data);
    if (issue) return issue;
    if (path.windingRule === 'NONZERO' || path.windingRule === 'EVENODD') continue;
    if (path.windingRule !== 'NONE') return 'filled-path-winding-rule';
    if (paths.length !== 1) return 'filled-path-none-multiple-contours';
    const tokens = path.data.match(/[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
    const commands = tokens.filter(token => /^[MLCQZ]$/.test(token));
    if (commands[0] !== 'M' || commands[commands.length - 1] !== 'Z' ||
        commands.filter(command => command === 'M').length !== 1 ||
        commands.filter(command => command === 'Z').length !== 1 ||
        commands.some(command => command !== 'M' && command !== 'L' && command !== 'Z'))
      return 'filled-path-none-contour-unqualified';
    const numbers = tokens.filter(token => !/^[MLCQZ]$/.test(token)).map(Number);
    // Native endpoints are float32. Refuse conversion that would alter them.
    if (numbers.some(number => Math.fround(number) !== number)) return 'filled-path-none-coordinate-unqualified';
    const points: Array<[number, number]> = [];
    for (let at = 0; at < numbers.length; at += 2) points.push([numbers[at]!, numbers[at + 1]!]);
    const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
    if (points.length > 1 && same(points[0]!, points[points.length - 1]!)) points.pop();
    if (points.length < 3 || points.length > 256) return 'filled-path-none-point-count';
    if (new Set(points.map(point => JSON.stringify(point))).size !== points.length) return 'filled-path-none-repeated-point';
    // A float32 product has at most 48 significant bits and is exact in a
    // double. Bounds above keep all six products away from overflow/underflow.
    // Accumulate the expanded determinant with error-free TwoSum operations;
    // its highest nonzero term gives the exact sign, without BigInt (which
    // is absent in Figma's plugin sandbox) or a geometric epsilon.
    const orientation = (a: [number, number], b: [number, number], c: [number, number]): number => {
      let expansion: number[] = [];
      for (const term of [b[0]*c[1], -b[1]*c[0], b[1]*a[0], -b[0]*a[1], a[1]*c[0], -a[0]*c[1]]) {
        const next: number[] = [];
        let carry = term;
        for (const component of expansion) {
          const sum = component + carry;
          const virtualCarry = sum - component;
          const error = (component - (sum - virtualCarry)) + (carry - virtualCarry);
          if (error !== 0) next.push(error);
          carry = sum;
        }
        if (carry !== 0) next.push(carry);
        expansion = next;
      }
      const highest = expansion[expansion.length - 1] ?? 0;
      return highest === 0 ? 0 : highest > 0 ? 1 : -1;
    };
    let direction = 0;
    // Every other vertex must lie strictly on the same side of every edge.
    // This proves convexity and excludes stars, crossings and degenerate edges.
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      for (let j = 0; j < points.length; j++) {
        if (j === i || j === (i + 1) % points.length) continue;
        const sign = orientation(a, b, points[j]!);
        if (sign === 0 || (direction !== 0 && direction !== sign))
          return 'filled-path-none-convexity-unqualified';
        direction = sign;
      }
    }
  }
  return undefined;
}

export function filledPathMask(shape: { width: number; height: number; paths: FilledPath[]; parentViewport?: {width:number;height:number;x:number;y:number} }): string {
  if (!Number.isFinite(shape.width) || shape.width <= 0 || !Number.isFinite(shape.height) || shape.height <= 0 ||
      !Array.isArray(shape.paths) || shape.paths.length === 0 || shape.paths.length > 32)
    throw new Error('filled-path-invalid-geometry');
  const pathIssue = filledPathsIssue(shape.paths);
  if (pathIssue) throw new Error(pathIssue);
  const paths = shape.paths.map((p) => {
    return `<path d="${p.data}" fill="white" fill-rule="${p.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}"/>`;
  }).join('');
  const v = shape.parentViewport;
  if (v && (![v.width,v.height,v.x,v.y].every(Number.isFinite) || v.width <= 0 || v.height <= 0))
    throw new Error('filled-path-invalid-parent-viewport');
  // The captured parent owns clipping. Intrinsic vector bounds can be
  // smaller than cubic control hulls; neither path bytes nor translation
  // are rescaled to fit a reparsed native vector box.
  const content = v ? `<g transform="translate(${v.x} ${v.y})">${paths}</g>` : paths;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v?.width ?? shape.width} ${v?.height ?? shape.height}" preserveAspectRatio="none">${content}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}") 0 0 / 100% 100% no-repeat`;
}
