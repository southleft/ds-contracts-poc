import { strokedPathGeometryIssue, type StrokedPath } from '../../../scripts/contract-schema.js';

/** Figma's version-pinned SVG export is an additional source observation.
 * Admit only a single centerline path whose exported basis and paint agree
 * with the nodes response. Never treat expanded stroke silhouettes as paths. */
export interface StrokeSvgObservation {
  nodeId: string;
  width: number;
  height: number;
  strokeWeight: number;
  strokeColor: string;
  cap: StrokedPath['cap'];
  join: StrokedPath['join'];
  viewport: StrokedPath['viewport'];
}

function attributes(text: string, allowed: string[]): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  const pattern = /\s+([a-zA-Z][a-zA-Z0-9:-]*)="([^"<>&]*)"/gy;
  let at = 0;
  while (at < text.length) {
    if (/^\s*$/.test(text.slice(at))) break;
    pattern.lastIndex = at;
    const match = pattern.exec(text);
    if (!match || !allowed.includes(match[1]!) || Object.hasOwn(attrs, match[1]!)) return undefined;
    attrs[match[1]!] = match[2]!;
    at = pattern.lastIndex;
  }
  return attrs;
}

export function strokeSvgGeometry(svg: string, observed: StrokeSvgObservation):
  { shape: { kind: 'stroked-path'; width: number; height: number; strokePath: StrokedPath } } | { issue: string } {
  if (typeof svg !== 'string' || svg.length > 70000) return { issue: 'stroke-svg-size' };
  const tags = /^\s*<svg([^<>]*)>\s*<path([^<>]*)\/>\s*<\/svg>\s*$/.exec(svg);
  if (!tags) return { issue: 'stroke-svg-structure-unqualified' };
  const root = attributes(tags[1]!, ['width', 'height', 'viewBox', 'fill', 'xmlns']);
  const path = attributes(tags[2]!, ['data-node-id', 'd', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit']);
  if (!root || !path || root.xmlns !== 'http://www.w3.org/2000/svg' || root.fill !== 'none')
    return { issue: 'stroke-svg-attributes-unqualified' };
  if (path['data-node-id'] !== observed.nodeId) return { issue: 'stroke-svg-source-identity-mismatch' };
  if (Number(root.width) !== observed.width || Number(root.height) !== observed.height ||
      root.viewBox !== `0 0 ${root.width} ${root.height}`)
    return { issue: 'stroke-svg-export-basis-mismatch' };
  const cap = observed.cap === 'NONE' ? 'butt' : observed.cap.toLowerCase();
  if (Number(path['stroke-width']) !== observed.strokeWeight || path.stroke?.toLowerCase() !== observed.strokeColor.toLowerCase() ||
      path['stroke-linecap'] !== cap || path['stroke-linejoin'] !== observed.join.toLowerCase())
    return { issue: 'stroke-svg-export-paint-mismatch' };
  const shape = { kind: 'stroked-path' as const, width: observed.width, height: observed.height, strokePath: {
    data: path.d!, cap: observed.cap, join: observed.join,
    // SVG's default. With ROUND/BEVEL this limit has no painting effect.
    miterLimit: Number(path['stroke-miterlimit'] ?? 4), viewport: observed.viewport,
  } };
  if (observed.join === 'MITER' && !path['stroke-miterlimit']) return { issue: 'stroke-svg-miter-limit-unobserved' };
  const issue = strokedPathGeometryIssue(shape);
  return issue ? { issue } : { shape };
}
