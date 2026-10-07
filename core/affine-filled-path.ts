import { filledPathsIssue } from '../scripts/contract-schema.js';

type Path = { data: string; windingRule: 'NONZERO' | 'EVENODD' | 'NONE' };
/** Project absolute M/L/C/Q/Z control points through the observed affine map.
 * Affine maps commute with Bezier evaluation, including reflections and skew.
 * The caller retains the original paths and matrix as source evidence. Bounds
 * below are the transformed local viewport, never inferred from raster ink. */
export function projectAffineFilledPath(input: {
  width: number; height: number; paths: Path[]; transform: number[][];
}) {
  const { width, height, paths, transform: m } = input;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 ||
      !Array.isArray(m) || m.length !== 2 || m.some(row => !Array.isArray(row) || row.length !== 3 || row.some(n => !Number.isFinite(n))) ||
      !Array.isArray(paths) || !paths.length || paths.length > 32 || filledPathsIssue(paths))
    throw Error('affine-filled-path-input-unqualified');
  const determinant = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (!Number.isFinite(determinant) || determinant === 0) throw Error('affine-filled-path-singular');
  const point = (x: number, y: number) => [m[0][0] * x + m[0][1] * y + m[0][2], m[1][0] * x + m[1][1] * y + m[1][2]];
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => point(x, y));
  const x = Math.min(...corners.map(p => p[0])), y = Math.min(...corners.map(p => p[1]));
  const targetWidth = Math.max(...corners.map(p => p[0])) - x, targetHeight = Math.max(...corners.map(p => p[1])) - y;
  if (![x, y, targetWidth, targetHeight].every(Number.isFinite) || targetWidth <= 0 || targetHeight <= 0)
    throw Error('affine-filled-path-viewport-unqualified');
  const projected = paths.map(path => {
    const tokens = path.data.match(/[MLCQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!;
    const output: string[] = [];
    for (let i = 0; i < tokens.length;) {
      if (/^[MLCQZ]$/.test(tokens[i])) output.push(tokens[i++]);
      else {
        const p = point(Number(tokens[i++]), Number(tokens[i++]));
        output.push(String(p[0] - x), String(p[1] - y));
      }
    }
    return { data: output.join(' '), windingRule: path.windingRule };
  });
  if (filledPathsIssue(projected)) throw Error('affine-filled-path-output-unqualified');
  return { x, y, width: targetWidth, height: targetHeight, paths: projected };
}
