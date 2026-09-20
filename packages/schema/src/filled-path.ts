/** Exact, bounded subset shared by the contract, REST reader and emitters.
 * No arc approximation, number rounding, XML or external asset references. */
export interface FilledPath {
  data: string;
  windingRule: 'NONZERO' | 'EVENODD';
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

export function filledPathMask(shape: { width: number; height: number; paths: FilledPath[] }): string {
  if (!Number.isFinite(shape.width) || shape.width <= 0 || !Number.isFinite(shape.height) || shape.height <= 0 ||
      !Array.isArray(shape.paths) || shape.paths.length === 0 || shape.paths.length !== 1)
    throw new Error('filled-path-invalid-geometry');
  const paths = shape.paths.map((p) => {
    const issue = filledPathIssue(p.data);
    if (issue || !['NONZERO', 'EVENODD'].includes(p.windingRule))
      throw new Error(issue ?? 'filled-path-winding-rule');
    return `<path d="${p.data}" fill="white" fill-rule="${p.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" preserveAspectRatio="none">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}") 0 0 / 100% 100% no-repeat`;
}
