import { filledPathIssue, strokedPathGeometryIssue, type StrokedPath } from '../../../scripts/contract-schema.js';

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

/** Exact opaque RGB forms emitted by Figma's SVG serializer. Contextual
 * paints, alpha, and unrecognized syntax cannot establish equality. */
function opaqueExportColor(value: string | undefined): string | undefined {
  if (value === undefined) return;
  const color = value.toLowerCase();
  if (color === 'black') return '#000000';
  if (color === 'white') return '#ffffff';
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color))
    return '#' + [...color.slice(1)].map(channel => channel + channel).join('');
}

/** A source observation, deliberately NOT a DumpShape or contract shape.
 * Expanded ink cannot retain editable stroke width, and can extend beyond
 * the logical viewport. Consumers must qualify paint bindings, placement,
 * overflow and native reconstruction before lowering this observation. */
export interface PaintedStrokeObservation {
  nodeId: string;
  width: number;
  height: number;
  strokeColor: string;
  paths: Array<{ path: string; windingRule: 'NONZERO' | 'EVENODD' }>;
}

/** Join a pinned SVG witness to REST strokeGeometry by exact identity, basis,
 * paint and path bytes. The caller owns source-version pinning. This never
 * derives a centerline or changes the meaning of strokeSvgGeometry. */
export function paintedStrokeSvgObservation(svg: string, observed: PaintedStrokeObservation):
  { observation: { kind: 'painted-stroke-outline'; source: PaintedStrokeObservation } } | { issue: string } {
  const refuse = (reason: string) => ({ issue: `painted-stroke-svg-${reason}` });
  if (typeof svg !== 'string' || svg.length > 70000) return refuse('size');
  if (!observed.nodeId || ![observed.width, observed.height].every(n => Number.isFinite(n) && n > 0 && n <= 1e6) ||
      !Array.isArray(observed.paths) || observed.paths.length !== 1 ||
      !observed.paths[0] || !['NONZERO', 'EVENODD'].includes(observed.paths[0].windingRule) ||
      typeof observed.paths[0].path !== 'string' || filledPathIssue(observed.paths[0].path))
    return refuse('native-geometry-unqualified');
  const tags = /^\s*<svg([^<>]*)>\s*<path([^<>]*)\/>\s*<\/svg>\s*$/.exec(svg);
  if (!tags) return refuse('structure-unqualified');
  const root = attributes(tags[1]!, ['width', 'height', 'viewBox', 'fill', 'xmlns']);
  const path = attributes(tags[2]!, ['data-node-id', 'd', 'fill', 'fill-rule']);
  if (!root || !path || root.xmlns !== 'http://www.w3.org/2000/svg' || root.fill !== 'none')
    return refuse('attributes-unqualified');
  if (path['data-node-id'] !== observed.nodeId) return refuse('source-identity-mismatch');
  if (Number(root.width) !== observed.width || Number(root.height) !== observed.height ||
      root.viewBox !== `0 0 ${root.width} ${root.height}`)
    return refuse('export-basis-mismatch');
  if (!opaqueExportColor(path.fill) || opaqueExportColor(path.fill) !== opaqueExportColor(observed.strokeColor))
    return refuse('export-paint-mismatch');
  const winding = observed.paths[0].windingRule === 'EVENODD' ? 'evenodd' : 'nonzero';
  if ((path['fill-rule'] ?? 'nonzero') !== winding || path.d !== observed.paths[0].path)
    return refuse('export-geometry-mismatch');
  return { observation: { kind: 'painted-stroke-outline', source: {
    nodeId: observed.nodeId, width: observed.width, height: observed.height,
    strokeColor: observed.strokeColor, paths: observed.paths.map(p => ({ ...p })),
  } } };
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
  if (Number(path['stroke-width']) !== observed.strokeWeight || opaqueExportColor(path.stroke) === undefined || opaqueExportColor(path.stroke) !== opaqueExportColor(observed.strokeColor) ||
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
